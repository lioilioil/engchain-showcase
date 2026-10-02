/* ============================================================================
   dynamic-island.js — 待执行信息提醒 · 双机型灵动岛组件 v1.0
   ────────────────────────────────────────────────────────────────────────────
   一套「待执行事项」数据，两种硬件呈现（与 css/dynamic-island.css 配套）：

   · iPhone 16 Pro（model:'iphone'）：通知「成为岛」
       idle 黑药丸 → compact 实时活动（自动轮播多条）→ 点击 morph 为黑色大卡；
       卡片内可滑动切换事项、主操作/稍后处理、点外部收回。
   · HUAWEI Pura X View（model:'pura'）：通知「环绕孔」
       前置打孔两侧玻璃翼片（不遮挡摄像头，金环呼吸）→ 点击在孔下融成挂扣玻璃卡；
       玻璃由 js/liquid-glass.iife.js 提供 WebGL 真实折射，无 WebGL2 自动回退模糊。
   · model:'auto'：window.innerHeight <= 720 判定 pura（与 common.js Pura 布局同口径）。

   API（数据格式与 PendingAlerts 兼容，可平替接入）：
     var island = DynamicIsland.create(container, { model: 'iphone' });
     island.add({ id, type, icon, title, subtitle, desc, meta, amount,
                  primary:{label,onClick}, secondary:{label,onClick} });
     island.remove(id) / island.clear() / island.getActive()

   零后端依赖；真实环境由后台推送/轮询后调用 add()。
============================================================================ */
(function () {
'use strict';

var TYPE_STYLES = {
  'pay-order':       { icon: 'pay',      accent: 'gold'    },
  'realname':        { icon: 'realname', accent: 'blue'    },
  'delegate-status': { icon: 'status',   accent: 'green'   },
  'unlock':          { icon: 'unlock',   accent: 'teal'    },
  'generic':         { icon: 'generic',  accent: 'neutral' }
};
var ICONS = {
  pay:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 10h18"/><path d="M8 15h8"/></svg>',
  realname: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 2.5v5.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V5.5L12 3z"/><path d="M9.3 12l2 2 3.4-3.6"/></svg>',
  status:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  unlock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  generic:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>'
};

var ROTATE_MS = 3000;
var GLASS = {
  light: { tint: 0.55, tintTone: 'light' },
  dark:  { tint: 0.62, tintTone: 'dark'  }
};
var GLASS_MATERIAL = { refraction: 80, rim: 0.3, highlight: 0.3, hairline: 0.9 };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function typeStyle(type) { return TYPE_STYLES[type] || TYPE_STYLES.generic; }
function iconHtml(a, st) {
  var key = (a.icon && ICONS[a.icon]) ? a.icon : st.icon;
  return ICONS[key] || ICONS.generic;
}
/* 第一行右侧「其他关键信息」：金额 / 日期 / 数量 / 用户名等；优先显式 keyinfo，否则取金额 */
function keyInfo(a) {
  return (a.keyinfo != null && a.keyinfo !== '') ? a.keyinfo : (a.amount || '');
}
function themeOf(scope) {
  var t = scope && scope.getAttribute && scope.getAttribute('data-theme');
  if (t === 'dark') return 'dark';
  var p = scope && scope.parentNode;
  while (p) {
    if (p.getAttribute && p.getAttribute('data-theme') === 'dark') return 'dark';
    p = p.parentNode;
  }
  return 'light';
}

function Island(container, opts) {
  var self = this;
  opts = opts || {};
  var model = opts.model === 'auto' || !opts.model
    ? (window.innerHeight <= 720 ? 'pura' : 'iphone')
    : opts.model;
  if (model !== 'pura') model = 'iphone';
  this.model = model;

  this.items = [];
  this.focus = 0;
  this.phase = 'idle';
  this.glass = [];
  this._container = container;
  this._glassReady = {};
  this._rotateTimer = null;
  this._swapLock = false;

  var root = document.createElement('div');
  root.className = 'di-root di-model-' + model;
  root.setAttribute('aria-live', 'polite');
  if (model === 'iphone') root.innerHTML =
    '<div class="di-veil"></div>' +
    '<div class="di-ip" role="button" tabindex="0" aria-label="待执行事项">' +
      '<div class="di-ip-glow"></div>' +
      '<div class="di-ip-core"></div>' +
      '<div class="di-live">' +
        '<div class="di-lv1"><span class="di-ic"></span><span class="di-lv-cat"></span><span class="di-lv-key"></span></div>' +
        '<div class="di-lv2"><span class="di-lv-sub"></span></div>' +
      '</div>' +
      '<div class="di-ip-body"></div>' +
    '</div>';
  else root.innerHTML =
    '<div class="di-veil"></div>' +
    '<div class="di-hole"><i class="di-hole-ring"></i></div>' +
    '<div class="di-pw di-pw-l"><span class="di-ic"></span><span class="di-pw-title"></span></div>' +
    '<div class="di-pw di-pw-r"></div>' +
    '<div class="di-pura-card"></div>';

  container.appendChild(root);
  this.root = root;
  this.$ = function (sel) { return root.querySelector(sel); };
  this.$$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

  /* 主题跟随：监听 <html data-theme>（真实 app）与容器自身 data-theme（隔离演示屏） */
  if (model === 'pura' && window.MutationObserver) {
    var selfRef = this;
    function syncGlass() {
      var o = GLASS[themeOf(container)];
      selfRef.glass.forEach(function (g) { try { g.update(o); } catch (e) {} });
    }
    var obs = new MutationObserver(syncGlass);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (container && container !== document.documentElement) {
      obs.observe(container, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  this.bindChrome();
}

/* ---------- 玻璃（Pura，延迟挂载：元素可见且有尺寸后再创建，避免零尺寸纹理报错） ---------- */
Island.prototype._ensureGlass = function (sel) {
  if (!window.LiquidGlass || this._glassReady[sel]) return;
  var el = this.$(sel);
  if (!el || !el.offsetWidth || !el.offsetHeight) return;
  try {
    var opts;
    if (this.model === 'iphone') {
      /* iPhone 弹窗恒按暗色液态玻璃渲染，明暗主题一致；自固定黑岛向外扩散 */
      opts = { frost: 0.60, tint: 0.80, tintTone: 'dark', backdrop: 'auto', material: GLASS_MATERIAL };
    } else {
      opts = Object.assign(
        { frost: sel === '.di-pura-card' ? 0.30 : 0.22, backdrop: 'auto', material: GLASS_MATERIAL },
        GLASS[themeOf(this._container)]
      );
    }
    var g = new window.LiquidGlass(el, opts);
    this.glass.push(g);
    this._glassReady[sel] = true;
  } catch (e) {}
};
/* 等元素形变动画结束、尺寸连续稳定后再挂玻璃，避免在零/瞬变尺寸上创建 WebGL 纹理 */
Island.prototype._whenSettled = function (sel, cb) {
  var self = this;
  var el = this.$(sel);
  if (!el) return;
  var lastW = -1, lastH = -1, stable = 0, elapsed = 0;
  var STEP = 50, MAX = 900;
  (function poll() {
    if (self._glassReady[sel]) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (w > 0 && h > 0 && w === lastW && h === lastH) {
      stable += STEP;
      if (stable >= 100) { cb(); return; }
    } else {
      stable = 0;
    }
    lastW = w; lastH = h; elapsed += STEP;
    if (elapsed >= MAX) { if (w > 0 && h > 0) cb(); return; }
    setTimeout(poll, STEP);
  })();
};
Island.prototype._refreshGlass = function () {
  var self = this;
  if (!window.LiquidGlass) return;
  var sels = this.model === 'iphone'
    ? ['.di-ip']
    : ['.di-pw-l', '.di-pw-r', '.di-pura-card'];
  sels.forEach(function (sel) {
    if (self._glassReady[sel]) return;
    self._whenSettled(sel, function () {
      self._ensureGlass(sel);
      try { window.LiquidGlass.refreshAll && window.LiquidGlass.refreshAll(); } catch (e) {}
    });
  });
};

/* ---------- 渲染 ---------- */
Island.prototype._cur = function () { return this.items[this.focus] || null; };

Island.prototype._compactHtml = function () {
  var a = this._cur();
  if (!a) return;
  var st = typeStyle(a.type);
  var ic = '<span class="di-ic di-ic-' + st.accent + '">' + iconHtml(a, st) + '</span>';
  var side = '';
  if (a.amount) side += '<span class="di-amount">' + esc(a.amount) + '</span>';
  if (this.items.length > 1) side += '<span class="di-count">+' + this.items.length + '</span>';
  /* Pura 无金额时右翼显示金点（事项挂在孔上的锚点暗示）；iPhone 留空 */
  if (!side && this.model === 'pura') {
    side = '<span style="width:7px;height:7px;border-radius:50%;background:var(--primary,#B89968);display:block;flex:none;box-shadow:0 0 0 3px rgba(184,153,104,.20);"></span>';
  }

  if (this.model === 'iphone') {
    var live = this.$('.di-live');
    live.querySelector('.di-lv1 .di-ic').outerHTML = ic;
    live.querySelector('.di-lv-cat').textContent = a.title;
    var kv = keyInfo(a);
    var kh = kv ? '<span class="di-lv-keyv">' + esc(kv) + '</span>' : '';
    if (this.items.length > 1) kh += '<span class="di-count">+' + this.items.length + '</span>';
    live.querySelector('.di-lv-key').innerHTML = kh;
    live.querySelector('.di-lv-sub').textContent = a.subtitle || '';
  } else {
    var l = this.$('.di-pw-l');
    l.querySelector('.di-ic').outerHTML = ic;
    l.querySelector('.di-pw-title').textContent = a.title;
    this.$('.di-pw-r').innerHTML = side;
  }
};

Island.prototype._bodyHtml = function () {
  var a = this._cur();
  if (!a) return '';
  var st = typeStyle(a.type);
  var detail = '';
  if (a.desc) detail += '<div class="di-desc">' + esc(a.desc) + '</div>';
  if (a.meta) detail += '<div class="di-meta">' + esc(a.meta) + '</div>';
  if (a.primary || a.secondary) {
    detail += '<div class="di-acts">' +
      (a.primary ? '<button type="button" class="di-act di-act-primary" data-act="primary">' + esc(a.primary.label) + '</button>' : '') +
      (a.secondary ? '<button type="button" class="di-act di-act-ghost" data-act="secondary">' + esc(a.secondary.label) + '</button>' : '') +
      '</div>';
  }
  var dots = '';
  if (this.items.length > 1) {
    dots = '<div class="di-pager">' + this.items.map(function (_, i) {
      return '<i' + (i === this.focus ? ' class="on"' : '') + '></i>';
    }, this).join('') + '</div>';
  }

  if (this.model === 'iphone') {
    /* 第一行：图标+分类名（左）｜关键信息+关闭（右），落在固定黑岛核上；
       第二行：简要描述（放大）；其下为详情/meta/按钮/分页 */
    var kv = keyInfo(a);
    return '<div class="di-x1">' +
        '<span class="di-ic di-ic-' + st.accent + '">' + iconHtml(a, st) + '</span>' +
        '<span class="di-x-cat">' + esc(a.title) + '</span>' +
        '<span class="di-x-side">' +
          (kv ? '<span class="di-x-keyv">' + esc(kv) + '</span>' : '') +
          '<button type="button" class="di-b-close" data-act="dismiss" aria-label="关闭此事项">✕</button>' +
        '</span>' +
      '</div>' +
      (a.subtitle ? '<div class="di-x2">' + esc(a.subtitle) + '</div>' : '') +
      detail + dots;
  }

  return '<div class="di-b-head">' +
      '<span class="di-ic di-ic-' + st.accent + '">' + iconHtml(a, st) + '</span>' +
      '<span class="di-b-copy"><span class="di-b-title">' + esc(a.title) + '</span>' +
      '<span class="di-b-sub">' + esc(a.subtitle || '') + '</span></span>' +
      '<span class="di-b-side">' +
        (a.amount ? '<span class="di-amount">' + esc(a.amount) + '</span>' : '') +
        '<button type="button" class="di-b-close" data-act="dismiss" aria-label="关闭此事项">✕</button>' +
      '</span>' +
    '</div>' + detail + dots;
};

/* 按当前事项内容估算展开卡高度（与 CSS 行高/留白口径一致），让宽高同步平滑 morph */
Island.prototype._ipOpenHeight = function (a) {
  var W = 366 - 36;                 // 内容可用宽（左右各 18 内边距）
  function units(t) {
    var u = 0, s = String(t || '');
    for (var i = 0; i < s.length; i++) u += s.charCodeAt(i) > 255 ? 1 : 0.56;
    return u;
  }
  function lines(t, px) { return Math.max(1, Math.ceil(units(t) / Math.floor(W / px))); }
  var h = 58 /* 贴顶黑带 */ + 15 /* 底部留白 */;
  if (a.subtitle) h += 13 + lines(a.subtitle, 15.5) * 22;
  if (a.desc)     h += 11 + Math.min(2, lines(a.desc, 13.5)) * 22;   // desc 两行截断
  if (a.meta)     h += 7 + lines(a.meta, 10.5) * 16;
  if (a.primary || a.secondary) h += 12 + 38;                        // 按钮行
  if (this.items.length > 1) h += 9 + 8;                             // 分页点
  return Math.round(h);
};

Island.prototype.renderBody = function () {
  var html = this._bodyHtml();
  if (this.model === 'iphone') {
    this.$('.di-ip-body').innerHTML = html;
    var a0 = this._cur();
    if (a0) this.$('.di-ip').style.height = this._ipOpenHeight(a0) + 'px';
  } else {
    this.$('.di-pura-card').innerHTML = html;
  }
  this.bindBody();
};

/* ---------- 相位 ---------- */
Island.prototype._activate = function () {
  if (this.phase === 'idle') {
    this.root.classList.add('di-arrive');
    var r = this.root;
    setTimeout(function () { r.classList.remove('di-arrive'); }, 560);
  }
  this.root.classList.add('is-active');
  this.phase = 'active';
  this._compactHtml();
  this._startRotate();
  this._refreshGlass();
};

Island.prototype.open = function () {
  if (!this.items.length) return;
  this._stopRotate();
  this.phase = 'open';
  this.renderBody();
  this.root.classList.add('is-open');
  this._refreshGlass();
};

Island.prototype.close = function () {
  if (this.phase !== 'open') return;
  this.root.classList.remove('is-open');
  if (this.model === 'iphone') this.$('.di-ip').style.height = '';
  this.phase = 'active';
  this._compactHtml();
  this._startRotate();
};

Island.prototype._idle = function () {
  this._stopRotate();
  this.root.classList.remove('is-open', 'is-active', 'di-arrive');
  if (this.model === 'iphone') this.$('.di-ip').style.height = '';
  this.phase = 'idle';
};

/* ---------- 轮播 ---------- */
Island.prototype._startRotate = function () {
  var self = this;
  this._stopRotate();
  if (this.items.length < 2 || this.phase === 'open') return;
  this._rotateTimer = setInterval(function () {
    self.focus = (self.focus + 1) % self.items.length;
    self._swapCompact();
  }, ROTATE_MS);
};
Island.prototype._stopRotate = function () {
  if (this._rotateTimer) clearInterval(this._rotateTimer);
  this._rotateTimer = null;
};
Island.prototype._swapCompact = function () {
  var self = this;
  if (this._swapLock) return;
  this._swapLock = true;
  var target;
  if (this.model === 'iphone') {
    this.$('.di-live').classList.add('di-swap');
    target = '.di-live';
  } else {
    this.$('.di-pw-l').classList.add('di-swap');
    this.$('.di-pw-r').classList.add('di-swap');
    target = '.di-pw';
  }
  setTimeout(function () {
    self._compactHtml();
    if (self.model === 'iphone') self.$('.di-live').classList.remove('di-swap');
    else { self.$('.di-pw-l').classList.remove('di-swap'); self.$('.di-pw-r').classList.remove('di-swap'); }
    self._swapLock = false;
  }, 200);
};

/* ---------- 数据 ---------- */
Island.prototype.add = function (a) {
  if (!a || !a.id) return null;
  if (this.items.some(function (x) { return x.id === a.id; })) return a.id;
  this.items.unshift(a);
  this.focus = 0;
  this._activate();
  if (this.phase === 'open') this.renderBody();
  return a.id;
};

Island.prototype.remove = function (id) {
  var ix = -1;
  for (var i = 0; i < this.items.length; i++) if (this.items[i].id === id) { ix = i; break; }
  if (ix < 0) return;
  this.items.splice(ix, 1);
  if (this.focus >= this.items.length) this.focus = Math.max(0, this.items.length - 1);
  if (!this.items.length) { this._idle(); return; }
  if (this.phase === 'open') { this.renderBody(); }
  else { this._compactHtml(); this._startRotate(); }
};

Island.prototype.clear = function () {
  this.items = [];
  this.focus = 0;
  this._idle();
};

Island.prototype.getActive = function () { return this.items.map(function (a) { return a.id; }); };

/* ---------- 事件 ---------- */
Island.prototype.bindChrome = function () {
  var self = this;
  /* 点击 compact（iPhone 岛体 / Pura 翼片）→ 展开 */
  var openers = this.model === 'iphone' ? ['.di-ip'] : ['.di-pw-l', '.di-pw-r'];
  openers.forEach(function (sel) {
    var el = self.$(sel);
    if (!el) return;
    el.addEventListener('click', function () {
      if (el._swiped) { el._swiped = false; return; }
      if (self.phase === 'active') self.open();
    });
  });
  /* 遮罩 → 收回展开（不关事项） */
  this.$('.di-veil').addEventListener('click', function () { self.close(); });
};

Island.prototype.bindBody = function () {
  var self = this;
  var bodyEl = this.$(this.model === 'iphone' ? '.di-ip-body' : '.di-pura-card');
  var a = this._cur();
  if (!bodyEl || !a) return;

  bodyEl.querySelectorAll('[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var act = btn.getAttribute('data-act');
      if (act === 'primary' && a.primary && a.primary.onClick) a.primary.onClick(ev);
      else if (act === 'secondary' && a.secondary && a.secondary.onClick) a.secondary.onClick(ev);
      /* primary / secondary / 关闭：处理完即从岛移除（完成态语义） */
      self.remove(a.id);
    });
  });

  /* 手势：左右滑切换事项；上滑收回展开 */
  var sx = 0, sy = 0, ing = false;
  var src = this.model === 'iphone' ? this.$('.di-ip') : this.$('.di-pura-card');
  src.addEventListener('pointerdown', function (ev) {
    ing = true; sx = ev.clientX; sy = ev.clientY;
    src.setPointerCapture && src.setPointerCapture(ev.pointerId);
  });
  src.addEventListener('pointerup', function (ev) {
    if (!ing) return;
    ing = false;
    var dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) {
      src._swiped = true;
      if (self.items.length > 1) {
        /* 右滑看上一条，左滑看下一条 */
        self.focus = (self.focus + (dx > 0 ? self.items.length - 1 : 1)) % self.items.length;
        self.renderBody();
        if (self.phase === 'active') self._compactHtml();
      }
    } else if (dy < -46 && Math.abs(dy) > Math.abs(dx)) {
      self.close();
    }
    if (src._swiped) setTimeout(function () { src._swiped = false; }, 60);
  });
  src.addEventListener('pointercancel', function () { ing = false; });
};

/* ---------- 工厂 ---------- */
window.DynamicIsland = {
  version: '1.0',
  create: function (container, opts) {
    if (!container) container = document.body;
    return new Island(container, opts);
  }
};
})();
