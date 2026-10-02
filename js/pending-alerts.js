/* ============================================================================
   pending-alerts.js — 用户待执行信息提醒模式（iOS 27 顶部下拉 · 液态玻璃横幅）
   ────────────────────────────────────────────────────────────────────────────
   模式定位：程序打开时从窗口顶部向下弹出的提醒横幅，用于展示需要用户处理/执行的
   事项（待付款订单、待实名认证、委托状态变更、解锁订单等）。

   · 视觉：明亮/暗色两套液态玻璃（webgl-apple-liquid-glass 真实折射，非平面模糊；
     无 WebGL2 时库自动回退 backdrop-filter 并标记 data-liquid-glass="fallback"）。
   · 交互：点击横幅 → 从底部向下展开（同一横幅高度延展，非新弹窗）；再点收回；
     多条横幅纵向重叠（边缘可辨识）；左右滑动或点击横幅外区域 → 向上收回关闭。
   · 展示规则：同屏最多 MAX_VISIBLE 条，超出进队列（顶部关闭后补位）。
   · 组件化：window.PendingAlerts（add/remove/dismissAll/clear/getActive/setTypeStyle），
     类型可扩展（内置 pay-order / realname / delegate-status / unlock / generic）。

   依赖（运行时读取，缺失自动降级）：window.LiquidGlass（js/liquid-glass.iife.js）。
   样式：css/pending-alerts.css。本组件零后端依赖；真实环境由后台推送/轮询后调用 add()。
   ============================================================================ */
(function () {
'use strict';

var CONTAINER_ID = 'pendingAlerts';
var MAX_VISIBLE = 3;
var STACK_STEP = 38;     /* 收起态 64px - 重叠 26px（与 css/pending-alerts.css 中 .pa-banner+ 的 margin/重叠口径一致） */
var ENTER_STAGGER = 90;  /* ms，多条横幅进入错峰 */
var LEAVE_STAGGER = 80;  /* ms，多条横幅收回错峰 */
var LEAVE_MS = 360;      /* ms，收回动画时长 */
var SWIPE_THRESHOLD = 70; /* px，判定滑动关闭 */
var GLASS = {
  light: { tint: 0.55, tintTone: 'light' },
  dark:  { tint: 0.62, tintTone: 'dark' }
};
var GLASS_MATERIAL = { refraction: 78, rim: 0.3, highlight: 0.3, hairline: 0.9 };

var TYPE_STYLES = {
  'pay-order':       { icon: 'pay',       accent: 'gold'    },
  'realname':        { icon: 'realname',  accent: 'blue'    },
  'delegate-status': { icon: 'status',    accent: 'green'   },
  'unlock':          { icon: 'unlock',    accent: 'teal'    },
  'generic':         { icon: 'generic',   accent: 'neutral' }
};
var ICONS = {
  pay:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 10h18"/><path d="M8 15h8"/></svg>',
  realname: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 2.5v5.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V5.5L12 3z"/><path d="M9.3 12l2 2 3.4-3.6"/></svg>',
  status:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  unlock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  generic:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>'
};
var CHEV_SVG = '<svg class="pa-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>';

var container = null;
var els = {};        /* id -> DOM 元素 */
var metas = {};      /* id -> alert 描述 */
var glassInsts = {}; /* id -> LiquidGlass 实例（不可用则无此键） */
var visibleOrder = []; /* 当前可见 id（新在前） */
var queue = [];      /* 超出 MAX_VISIBLE 的等待队列 */
var themeObs = null;
var reduced = false;
try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

/* ---------- 工具 ---------- */
function theme() {
  var t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' ? 'dark' : 'light';
}
function glassOpts() { return GLASS[theme()]; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function typeStyle(type) { return TYPE_STYLES[type] || TYPE_STYLES.generic; }

/* ---------- 容器与全局事件 ---------- */
function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.className = 'pa-wrap';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  /* 点击横幅外区域 → 全部向上收回关闭 */
  document.addEventListener('click', function (ev) {
    if (!container || !container.childElementCount) return;
    if (ev.target && ev.target.closest && ev.target.closest('.pa-banner')) return;
    dismissAll();
  }, true);
  /* 主题跟随：<html data-theme> 变化 → 更新各玻璃实例明暗参数 */
  if (!themeObs && window.MutationObserver) {
    themeObs = new MutationObserver(function () {
      var o = glassOpts();
      for (var id in glassInsts) {
        try { glassInsts[id].update(o); } catch (e) {}
      }
      refreshAllGlass();
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  return container;
}

/* ---------- 玻璃 ---------- */
function applyGlass(id) {
  var el = els[id];
  if (!el || !window.LiquidGlass) return;
  try {
    var g = new window.LiquidGlass(el, {
      tint: glassOpts().tint,
      tintTone: glassOpts().tintTone,
      frost: 0.16,
      backdrop: 'auto',
      material: GLASS_MATERIAL
    });
    glassInsts[id] = g;
  } catch (e) { /* 玻璃不可用：样式层有半透明回退底 */ }
}
function destroyGlass(id) {
  var g = glassInsts[id];
  if (g) { try { g.destroy(); } catch (e) {} delete glassInsts[id]; }
}
function refreshAllGlass() {
  try { if (window.LiquidGlass && LiquidGlass.refreshAll) LiquidGlass.refreshAll(); } catch (e) {}
}

/* ---------- 布局：绝对定位堆叠（展开覆盖下方、不推挤；移除后其余上移补位） ---------- */
function repositionAll() {
  visibleOrder.forEach(function (id, idx) {
    var el = els[id];
    if (!el) return;
    el.style.top = (idx * STACK_STEP) + 'px';
  });
}
function layoutStack() {
  /* 新在前：第一条 z 最高（覆盖下方横幅），其余递减；展开态置顶 */
  visibleOrder.forEach(function (id, idx) {
    var el = els[id];
    if (!el) return;
    var base = 30 - idx * 10;
    el.style.zIndex = el.classList.contains('pa-open') ? '100' : String(base);
  });
}

/* ---------- 横幅构建 ---------- */
function bannerHtml(a) {
  var st = typeStyle(a.type);
  var icon = (a.icon && ICONS[a.icon]) ? ICONS[a.icon] : (a.icon || ICONS[st.icon] || ICONS.generic);
  var side = '';
  if (a.amount) side += '<div class="pa-amount">' + esc(a.amount) + '</div>';
  if (a.badge) side += '<div class="pa-badge">' + esc(a.badge) + '</div>';
  var detail = '';
  if (a.desc) detail += '<div class="pa-desc">' + esc(a.desc) + '</div>';
  if (a.meta) detail += '<div class="pa-meta">' + esc(a.meta) + '</div>';
  if (a.primary || a.secondary) {
    detail += '<div class="pa-acts">' +
      (a.primary ? '<button type="button" class="pa-act primary">' + esc(a.primary.label) + '</button>' : '') +
      (a.secondary ? '<button type="button" class="pa-act ghost">' + esc(a.secondary.label) + '</button>' : '') +
      '</div>';
  }
  return '<div class="pa-main"><div class="pa-main-inner">' +
      '<div class="pa-row">' +
        '<div class="pa-ic pa-ac-' + esc(st.accent) + '">' + icon + '</div>' +
        '<div class="pa-copy">' +
          '<div class="pa-title">' + esc(a.title) + '</div>' +
          '<div class="pa-subtitle">' + esc(a.subtitle || '') + '</div>' +
        '</div>' +
        '<div class="pa-side">' + side + CHEV_SVG + '</div>' +
      '</div>' +
      (detail ? '<div class="pa-detail"><div class="pa-detail-inner">' + detail + '</div></div>' : '') +
    '</div></div>';
}

function bindBanner(id, a) {
  var el = els[id];
  if (!el) return;

  /* 点击：主区域切换展开；按钮区不切换（各自 onClick） */
  el.addEventListener('click', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('.pa-act')) return;
    if (el._swiped) { el._swiped = false; return; }
    toggle(id);
  });

  /* 主/次操作按钮 */
  var pBtn = el.querySelector('.pa-act.primary');
  if (pBtn && a.primary && a.primary.onClick) pBtn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    a.primary.onClick(ev);
  });
  var sBtn = el.querySelector('.pa-act.ghost');
  if (sBtn && a.secondary && a.secondary.onClick) sBtn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    a.secondary.onClick(ev);
  });

  /* 左右滑动收回（pointer 统一 touch/mouse；touch-action: pan-y 保持纵向滚动） */
  var sx = 0, sy = 0, swiping = false, moved = 0;
  el.addEventListener('pointerdown', function (ev) {
    if (reduced) return;
    swiping = true;
    sx = ev.clientX; sy = ev.clientY; moved = 0;
    el.setPointerCapture && el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener('pointermove', function (ev) {
    if (!swiping) return;
    var dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    moved = Math.abs(dx);
    if (Math.abs(dx) > Math.abs(dy)) {
      el.classList.add('pa-dragging');
      var t = Math.max(-100, Math.min(100, dx));
      el.style.transform = 'translateX(' + t + 'px)';
    }
  });
  function endSwipe(ev) {
    if (!swiping) return;
    swiping = false;
    el.classList.remove('pa-dragging');
    var dx = ev.clientX - sx;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      el._swiped = true;
      remove(id);
    } else {
      el.style.transform = '';
    }
  }
  el.addEventListener('pointerup', endSwipe);
  el.addEventListener('pointercancel', function () { if (swiping) { swiping = false; el.classList.remove('pa-dragging'); el.style.transform = ''; } });

  /* 展开动画结束 → 玻璃重绘对齐 */
  el.addEventListener('transitionend', function (ev) {
    if (ev.propertyName === 'grid-template-rows') refreshAllGlass();
  });
}

/* ---------- 展开/收回 ---------- */
function toggle(id) {
  var el = els[id];
  if (!el) return;
  var open = el.classList.toggle('pa-open');
  el.setAttribute('data-pa-open', open ? '1' : '0');
  layoutStack();
}

/* ---------- 展示 ---------- */
function add(a) {
  if (!a || !a.id) return null;
  if (els[a.id]) return a.id;          /* 同 id 去重 */
  metas[a.id] = a;
  if (visibleOrder.length >= MAX_VISIBLE) {
    queue.push(a.id);
    return a.id;                       /* 进队列，顶部关闭后补位 */
  }
  ensureContainer();
  var el = document.createElement('div');
  el.className = 'pa-banner pa-enter';
  el.setAttribute('data-pa-type', a.type || 'generic');
  el.setAttribute('data-pa-open', '0');
  el.style.top = '0px';
  el.style.zIndex = '30';
  el.innerHTML = bannerHtml(a);
  if (!reduced) el.style.animationDelay = (visibleOrder.length * ENTER_STAGGER) + 'ms';
  /* 新在上：既有横幅下移一步，为顶部的横幅让位 */
  visibleOrder.forEach(function (id) {
    var oe = els[id];
    if (oe) oe.style.top = (parseFloat(oe.style.top || 0) + STACK_STEP) + 'px';
  });
  container.insertBefore(el, container.firstChild);
  els[a.id] = el;
  visibleOrder.unshift(a.id);
  layoutStack();
  bindBanner(a.id, a);
  applyGlass(a.id);
  /* 进入动画结束后移除 enter 类（transition 由 CSS 负责） */
  var delay = reduced ? 0 : (visibleOrder.length - 1) * ENTER_STAGGER + 520;
  setTimeout(function () {
    if (els[a.id]) els[a.id].classList.remove('pa-enter');
  }, delay + 80);
  return a.id;
}

function remove(id) {
  var el = els[id];
  if (!el) return;
  var idx = visibleOrder.indexOf(id);
  if (idx >= 0) visibleOrder.splice(idx, 1);
  el.classList.add('pa-leave');
  if (reduced) {
    teardown(id);
  } else {
    setTimeout(function () { teardown(id); }, LEAVE_MS);
  }
}

function teardown(id) {
  var el = els[id];
  if (!el) return;
  destroyGlass(id);
  if (el.parentNode) el.parentNode.removeChild(el);
  var ix = visibleOrder.indexOf(id);
  if (ix >= 0) visibleOrder.splice(ix, 1);   /* remove() 已删则跳过；dismissAll/clear 走此处清理 */
  delete els[id];
  delete metas[id];
  repositionAll();   /* 其余横幅上移补位 */
  layoutStack();
  dequeue();         /* 顶部关闭后，队列补位（在旧横幅完全移除后入栈） */
}

function dequeue() {
  if (!queue.length) return;
  if (visibleOrder.length >= MAX_VISIBLE) return;
  var nid = queue.shift();
  var a = metas[nid];
  if (!a) return dequeue();
  /* 重新入栈（add 会因 els[nid] 已删而重建） */
  add(a);
}

function dismissAll() {
  var ids = visibleOrder.slice();
  var i = 0;
  ids.forEach(function (id, idx) {
    var el = els[id];
    if (!el) return;
    el.classList.add('pa-leave');
    if (!reduced) el.style.transitionDelay = (idx * LEAVE_STAGGER) + 'ms';
    setTimeout(function () { teardown(id); }, (reduced ? 0 : idx * LEAVE_STAGGER) + (reduced ? 0 : LEAVE_MS));
  });
  queue = [];
}

function clear() {
  for (var id in els) teardown(id);
  queue = [];
}

function getActive() {
  return visibleOrder.slice();
}

function setTypeStyle(type, st) {
  if (!type || !st) return;
  TYPE_STYLES[type] = { icon: st.icon || TYPE_STYLES.generic.icon, accent: st.accent || 'neutral' };
}

window.PendingAlerts = {
  version: '2.0',
  add: add,
  remove: remove,
  dismissAll: dismissAll,
  clear: clear,
  getActive: getActive,
  setTypeStyle: setTypeStyle,
  MAX_VISIBLE: MAX_VISIBLE
};
})();
