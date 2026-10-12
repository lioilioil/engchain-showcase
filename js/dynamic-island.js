/* ============================================================================
   dynamic-island.js — 待执行信息提醒 · 多硬件顶部形态组件 v1.3
   ────────────────────────────────────────────────────────────────────────────
   一套「待执行事项」数据，同一张连续 morph 液态玻璃卡，按「顶部硬件形态」分列锚点：

   · hardware:'island'（iPhone 16 Pro 等灵动药丸岛）
       idle 显示黑色灵动岛 → compact 实时活动；多条时向下层叠（最多露 3 层边），
       点击堆叠扇形展开为等宽列表，点列表卡再 morph 黑色详情大卡。
   · hardware:'punch'（HUAWEI Pura 等居中小圆打孔，多数安卓直屏）
   · hardware:'pill' （居中药丸/跑道挖孔，多数安卓曲面/旗舰）
       idle「只显示裸打孔、不出现任何药丸岛」→ 有消息时同一张卡从打孔处生长，
       黑色以打孔为锚向四周无边界弥散、化入恒暗液态玻璃；打孔镜头全程不被遮挡。
   玻璃由 js/liquid-glass.iife.js 提供 WebGL2 真实折射，无 WebGL2 自动回退静态炭玻璃。

   model:'iphone'→island / model:'pura'→punch；model:'auto' 按 window.innerHeight<=720
   判定 pura（与 common.js Pura 布局同口径）。真实接入可用 opts.hardware 显式覆盖
   （'island' | 'punch' | 'pill'），以适配更多机型的灵动岛/打孔情况。

   API（数据格式与 PendingAlerts 兼容，可平替接入）：
     var island = DynamicIsland.create(container, { model: 'iphone' });
     // 或 DynamicIsland.create(container, { hardware: 'pill' });
     island.add({ id, type, icon, category, title, subtitle, desc, meta, amount, keyinfo, ts,
                  primary:{label,onClick}, secondary:{label,onClick} });
     // 多条按 ts（触发时间，缺省取 add 时刻）倒序：最新在最上层。
     island.remove(id) / island.clear() / island.getActive() / island.destroy()
   opts.externalAnchor=true：打孔机型的前置镜头由设备外壳提供时，组件不自绘锚点（idle 只透出外壳硬件）。

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

/* 信息提醒卡专属暗色液态玻璃参数（双机型共用，与主 tabbar / 按钮玻璃完全独立，不联动、不随主题） */
var ISLAND_GLASS = { tint: 0.78, tintTone: 'dark', frost: 0.5, live: 'auto' };
var ISLAND_MATERIAL = { refraction: 64, rim: 0.30, highlight: 0.30, hairline: 1.0 };

/* 探测 GPU 最大纹理尺寸，据此为灵动岛大卡挑一个安全的渲染像素比，规避 morph 大卡超纹理上限 */
var _glMaxTex = null;
function glMaxTextureSize() {
  if (_glMaxTex !== null) return _glMaxTex;
  _glMaxTex = 0;
  try {
    var c = document.createElement('canvas');
    var g = c.getContext('webgl2') || c.getContext('webgl');
    if (g) _glMaxTex = g.getParameter(g.MAX_TEXTURE_SIZE) || 0;
  } catch (e) { _glMaxTex = 0; }
  return _glMaxTex;
}
function islandSafeDpr() {
  var dpr = window.devicePixelRatio || 1;
  var max = glMaxTextureSize();
  if (!max) return 1;                                   // 能力未知：保守按 1，绝不超限
  var side = Math.max(window.innerWidth || 0, window.innerHeight || 0);
  if (side * dpr <= max * 0.9) return Math.min(dpr, 2); // 物理像素安全：用满 DPR
  var d = (max * 0.9) / side;                           // 反推安全 DPR
  return d >= 1 ? Math.min(Math.floor(d * 100) / 100, 2) : 1;
}

/* 实时磨砂（backdrop-filter）是否可用于 iPhone 通知卡：
   - 浏览器不支持 backdrop-filter → 不可用，走静态炭玻璃；
   - 自动化 / 无头环境（navigator.webdriver）实测其合成器不按圆角裁剪 backdrop，会出直角灰块 → 降级静态。
   真实手机与普通桌面 Chrome / Safari webdriver 为 false，走真正的实时磨砂液态玻璃。 */
function backdropFrostReliable() {
  try {
    if (navigator.webdriver === true) return false;
    var ok = window.CSS && CSS.supports && (
      CSS.supports('backdrop-filter', 'blur(4px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(4px)'));
    return !!ok;
  } catch (e) { return false; }
}

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
/* 第一行左侧「分类名」：消息所属大类/频道短标签（如「服务信息」），短且固定，置于灵动岛内不挤占 */
function categoryOf(a) {
  return (a.category != null && a.category !== '') ? a.category : '服务信息';
}

/* ── 顶部硬件形态（决定「无消息时屏幕顶部显示什么」，以及黑色从哪种锚点弥散）────────────
   · island：灵动药丸岛（iPhone 16 Pro 类）。idle 显示一颗黑色灵动岛，通知在岛上 morph。
   · punch ：居中小圆打孔（HUAWEI Pura 等多数安卓直屏）。idle「只显示裸打孔」，不出现任何药丸岛。
   · pill  ：居中药丸/跑道挖孔（多数安卓曲面/旗舰）。idle 同样只显示裸胶囊挖孔，不出现药丸岛。
   真实接入可用 opts.hardware 显式指定；缺省按 model 映射。
   日后新增左置/右置打孔、水滴屏等，只需在此追加形态并在 CSS 给出对应锚点位置/形状。 */
var HW_BY_MODEL = { iphone: 'island', pura: 'punch' };
function resolveHardware(model, opts) {
  var h = opts && opts.hardware;
  if (h === 'island' || h === 'punch' || h === 'pill') return h;
  return HW_BY_MODEL[model] || 'punch';
}

function Island(container, opts) {
  var self = this;
  opts = opts || {};
  var model = opts.model === 'auto' || !opts.model
    ? (window.innerHeight <= 720 ? 'pura' : 'iphone')
    : opts.model;
  if (model !== 'pura') model = 'iphone';
  this.model = model;
  /* 顶部硬件形态（island/punch/pill）；可被 opts.hardware 覆盖，用于多机型/多挖孔适配 */
  var hw = resolveHardware(model, opts);
  this.hw = hw;
  this._destroyed = false;
  /* 持有者回调（原型方法里拿不到构造局部 opts，故挂到实例）：任一移除路径都通知外部同步缓存 */
  this._onRemove = (typeof opts.onRemove === 'function') ? opts.onRemove : null;
  this._onClear = (typeof opts.onClear === 'function') ? opts.onClear : null;

  this.items = [];
  this.phase = 'idle';
  this.openId = null;       /* open 详情当前条目 id（多条款详情间切换用） */
  this.openReturn = 'active'; /* 关闭详情后返回：'active'(单卡/堆叠) | 'list'(扇形列表) */
  this._seq = 0;            /* 同毫秒到达的稳定次序（新到的更靠前） */
  this.glass = [];
  this._container = container;
  this._glassReady = {};
  this._glassRetries = {};
  this._glassInflight = {};

  var root = document.createElement('div');
  root.className = 'di-root di-model-' + model + ' di-hw-' + hw;
  root.setAttribute('aria-live', 'polite');
  /* 双机型/多硬件共用同一套「连续 morph 液态玻璃卡」结构（几何 / 玻璃 / 白字 / 黑弥散完全一致，
     因而卡到窗口边缘距离一致）。顶部锚点按硬件形态分列：
     island=纯黑灵动药丸 .di-ip-core（在卡内随卡 morph，idle 即黑岛）；
     punch =常驻居中圆打孔 .di-ip-hole、pill=常驻居中胶囊挖孔 .di-ip-hole.di-ip-hole-pill
            （均为 root 直接子层、位置固定、全程可见、不被卡裁剪；idle 时通知卡整体隐藏，只留裸孔）。
     黑色统一由 .di-ip-glow 从锚点向四周无边界弥散，化入 .di-ip-glass 恒暗液态玻璃。 */
  var innerAnchor = hw === 'island' ? '<div class="di-ip-core"></div>' : '';
  /* externalAnchor：打孔机型的前置镜头已由「设备外壳」提供并覆盖在本页之上（如 preview 的
     HUAWEI Pura 外壳 .pura-cam）。此时组件不再自绘镜头/金环，idle 整条卡隐藏，只透出外壳硬件；
     有消息时同一张卡仍从该锚点位置生长、黑色在锚点处弥散，镜头由外壳层级保证永不被遮挡。 */
  var outerAnchor = '';
  if ((hw === 'punch' || hw === 'pill') && !opts.externalAnchor) {
    outerAnchor = '<div class="di-ip-hole' + (hw === 'pill' ? ' di-ip-hole-pill' : '') + '">' +
                    '<i class="di-ip-hole-ring"></i>' +
                  '</div>';
  }
  root.innerHTML =
    '<div class="di-veil"></div>' +
    '<div class="di-scrim"></div>' +
    '<div class="di-ip" role="button" tabindex="0" aria-label="待执行事项">' +
      '<div class="di-ip-glass"></div>' +
      '<div class="di-ip-glow"></div>' +
      innerAnchor +
      '<div class="di-live">' +
        '<div class="di-lv1"><span class="di-ic"></span><span class="di-lv-cat"></span><span class="di-lv-key"></span></div>' +
        '<div class="di-lv2"><span class="di-lv-sub"></span></div>' +
      '</div>' +
      '<div class="di-ip-body"></div>' +
    '</div>' +
    '<div class="di-deck" aria-hidden="true"></div>' +
    outerAnchor;

  container.appendChild(root);
  this.root = root;
  this.$ = function (sel) { return root.querySelector(sel); };
  this.$$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

  this.bindChrome();
}

/* ---------- 玻璃（延迟挂载：元素可见且有尺寸后再创建，避免零尺寸纹理报错） ----------
   全局构造队列：iPhone 与 Pura 多个 LiquidGlass 上下文若在同一 morph 窗口并发首次初始化，
   在部分集显（Intel Iris）驱动上会互相干扰、backdrop 纹理瞬时分配异常。串行化构造并在每个
   上下文之间让出两帧，保证每次 new LiquidGlass 都拿到一次干净、静止的首帧。 */
var _lgQueue = Promise.resolve();
function enqueueLG(job) {
  _lgQueue = _lgQueue.then(function () {
    return new Promise(function (resolve) {
      var g = null;
      try { g = job(); } catch (e) { resolve(null); return; }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { resolve(g); });
      });
    });
  }).catch(function () { return null; });
  return _lgQueue;
}

Island.prototype._ensureGlass = function (sel) {
  if (this._destroyed) return false;
  if (!window.LiquidGlass || this._glassReady[sel] || this._glassInflight[sel]) return false;
  var el = this.$(sel);
  if (!el || !el.offsetWidth || !el.offsetHeight) return false;
  /* 双机型共用同一张连续卡玻璃：只在非 idle 挂（idle 不调用 _refreshGlass，此为双保险）；
     几何区间硬校验：morph 并发重布局的坏帧里 offset/getBoundingClientRect 可能读到异常尺寸，
     导致纹理分配超过 GPU 上限，坏帧直接放弃等待重试。 */
  if (this.phase === 'idle') return false;
  var w = el.offsetWidth, h = el.offsetHeight;
  if (!(w >= 280 && w <= 420 && h >= 60 && h <= 640)) return false;
  var self = this;
  /* 信息提醒卡：独立的恒暗液态玻璃（不读主题、不与主 tabbar/按钮联动），双机型同一参数；
     maxDpr 封顶，规避大卡 morph 在高 DPR / 低纹理上限 GPU 上超纹理 */
  var opts = Object.assign({ backdrop: 'auto', material: ISLAND_MATERIAL, maxDpr: islandSafeDpr() }, ISLAND_GLASS);
  /* 占位认领，阻止 settled 轮询重复入队；真正成功后才置 _glassReady */
  this._glassInflight[sel] = true;
  enqueueLG(function () { return new window.LiquidGlass(el, opts); }).then(function (g) {
    self._glassInflight[sel] = false;
    if (self._destroyed) { try { g && g.destroy && g.destroy(); } catch (e) {} return; }
    if (!g) { self._rearmGlass(sel); return; }
    self.glass.push(g);
    /* 挂载后校验：确认 canvas 真正注入且进入 webgl/fallback；失败销毁并退避重挂。 */
    var tries = 0;
    (function verify() {
      var cv = el.querySelector('canvas');
      var mode = el.getAttribute('data-liquid-glass');
      if (cv && (mode === 'webgl' || mode === 'fallback')) {
        self._glassReady[sel] = true; self._glassRetries[sel] = 0; return;
      }
      tries += 1;
      if (tries < 16) { setTimeout(verify, 60); return; }
      try { g.destroy && g.destroy(); } catch (e) {}
      var i = self.glass.indexOf(g); if (i >= 0) self.glass.splice(i, 1);
      self._glassReady[sel] = false;
      self._rearmGlass(sel);
    })();
  });
  return true;
};
/* 玻璃挂载失败后的自动重挂：退避递增、次数封顶，几何恢复正常后即成功 */
Island.prototype._rearmGlass = function (sel) {
  var self = this;
  if (this._destroyed) return;
  this._glassRetries = this._glassRetries || {};
  var n = (this._glassRetries[sel] || 0) + 1;
  if (n > 12) { this._glassRetries[sel] = 0; return; }
  this._glassRetries[sel] = n;
  var delay = Math.min(120 + n * 70, 700);
  setTimeout(function () {
    if (self._destroyed) return;
    if (self._glassReady[sel] || self._glassInflight[sel]) { self._glassRetries[sel] = 0; return; }
    if (!self._ensureGlass(sel)) self._whenSettled(sel, function () { return self._ensureGlass(sel); });
  }, delay);
};
/* 等元素形变动画结束、尺寸连续稳定后再挂玻璃；挂载未真正成功会持续重试到超时 */
Island.prototype._whenSettled = function (sel, cb) {
  var self = this;
  var el = this.$(sel);
  if (!el) return;
  var lastW = -1, lastH = -1, stable = 0, elapsed = 0;
  var STEP = 50, MAX = 1600;
  (function poll() {
    if (self._destroyed) return;
    if (self._glassReady[sel] || self._glassInflight[sel]) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (w > 0 && h > 0 && w === lastW && h === lastH) {
      stable += STEP;
      if (stable >= 120) {
        var ok = cb();
        if (ok === true) return;
        stable = 0;   /* 条件不满足（如仍在 idle/形变），继续轮询重试 */
      }
    } else {
      stable = 0;
    }
    lastW = w; lastH = h; elapsed += STEP;
    if (elapsed >= MAX) return;
    setTimeout(poll, STEP);
  })();
};
Island.prototype._refreshGlass = function () {
  var self = this;
  if (!window.LiquidGlass) return;
  var sels = ['.di-ip-glass'];
  sels.forEach(function (sel) {
    if (self._glassReady[sel]) return;
    /* 玻璃挂在「无 transform 的内层」.di-ip-glass 上（inset 跟随 .di-ip morph），双机型同；
       避免挂在带 translateX/scale 形变的父盒上导致 backdrop 纹理坐标异常、超 GPU 上限；
       等元素有尺寸且连续稳定后再创建，杜绝零尺寸/瞬变纹理。 */
    self._whenSettled(sel, function () {
      self._ensureGlass(sel);
      try { window.LiquidGlass.refreshAll && window.LiquidGlass.refreshAll(); } catch (e) {}
    });
  });
};

/* ---------- 渲染 ---------- */
/* compact/堆叠最上卡恒为时间倒序后的第一条 items[0]；open 详情显示 openId 指向条 */
Island.prototype._cur = function () {
  if (this.phase === 'open' && this.openId != null) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].id === this.openId) return this.items[i];
  }
  return this.items[0] || null;
};
Island.prototype._indexOfId = function (id) {
  for (var i = 0; i < this.items.length; i++) if (this.items[i].id === id) return i;
  return -1;
};

Island.prototype._compactHtml = function () {
  var a = this._cur();
  if (!a) return;
  var st = typeStyle(a.type);
  var ic = '<span class="di-ic di-ic-' + st.accent + '">' + iconHtml(a, st) + '</span>';

  /* 双机型同一套两行实时活动：
     第一行（锚点带内）：短「分类名」（左）｜关键信息 +n（右，居中让给药丸/镜头）；
     第二行（锚点下方）：本条「简要描述」(title)，避免长文字与灵动岛/打孔冲突。 */
  var live = this.$('.di-live');
  live.querySelector('.di-lv1 .di-ic').outerHTML = ic;
  live.querySelector('.di-lv-cat').textContent = categoryOf(a);
  var kv = keyInfo(a);
  var kh = kv ? '<span class="di-lv-keyv">' + esc(kv) + '</span>' : '';
  if (this.items.length > 1) kh += '<span class="di-count">+' + this.items.length + '</span>';
  live.querySelector('.di-lv-key').innerHTML = kh;
  live.querySelector('.di-lv-sub').textContent = a.title || '';
};

/* ---------- 多卡堆叠 / 列表（.di-deck 内渲染全部条目，几何由 CSS is-stack / is-list 接管） ---------- */
Island.prototype._cardHtml = function (a, i) {
  var st = typeStyle(a.type);
  var ic = '<span class="di-ic di-ic-' + st.accent + '">' + iconHtml(a, st) + '</span>';
  var kv = keyInfo(a);
  var kh = kv ? '<span class="di-lv-keyv">' + esc(kv) + '</span>' : '';
  return '<div class="di-card" data-id="' + esc(String(a.id)) + '" data-i="' + i + '" style="--di-i:' + i + '">' +
      '<div class="di-card-glow"></div>' +
      '<div class="di-cbody">' +
        '<div class="di-lv1">' + ic +
          '<span class="di-lv-cat">' + esc(categoryOf(a)) + '</span>' +
          '<span class="di-lv-key">' + kh + '</span>' +
          '<button type="button" class="di-cx" data-cx="1" aria-label="关闭此事项">✕</button>' +
        '</div>' +
        '<div class="di-lv2"><span class="di-lv-sub">' + esc(a.title || '') + '</span></div>' +
      '</div>' +
    '</div>';
};
Island.prototype.renderDeck = function () {
  var deck = this.$('.di-deck');
  if (!deck) return;
  deck.innerHTML = this.items.map(function (a, i) { return this._cardHtml(a, i); }, this).join('');
};
/* 依条数切换堆叠态（>1 才出现露边背板），并同步卡堆 DOM */
Island.prototype._syncStack = function () {
  this.root.classList.toggle('is-stack', this.items.length > 1);
  this.renderDeck();
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
    var onIx = this._indexOfId(this.openId);
    dots = '<div class="di-pager">' + this.items.map(function (_, i) {
      return '<i' + (i === onIx ? ' class="on"' : '') + '></i>';
    }, this).join('') + '</div>';
  }

  /* 双机型同一套展开内容：
     第一行（黑带内）：图标 + 短「分类名」（左）｜关键信息 + 关闭（右）；
     第二行：本条「简要描述」(title，放大)；其下为补充说明(subtitle)/详情/meta/按钮/分页 */
  var kv = keyInfo(a);
  return '<div class="di-x1">' +
      '<span class="di-ic di-ic-' + st.accent + '">' + iconHtml(a, st) + '</span>' +
      '<span class="di-x-cat">' + esc(categoryOf(a)) + '</span>' +
      '<span class="di-x-side">' +
        (kv ? '<span class="di-x-keyv">' + esc(kv) + '</span>' : '') +
        '<button type="button" class="di-b-close" data-act="dismiss" aria-label="关闭此事项">✕</button>' +
      '</span>' +
    '</div>' +
    (a.title ? '<div class="di-x2">' + esc(a.title) + '</div>' : '') +
    (a.subtitle ? '<div class="di-x-note">' + esc(a.subtitle) + '</div>' : '') +
    detail + dots;
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
  if (a.title)    h += 13 + lines(a.title, 15.5) * 22;    // 第二行：简要描述（放大）
  if (a.subtitle) h += 8 + lines(a.subtitle, 13) * 19;    // 补充说明
  if (a.desc)     h += 11 + Math.min(2, lines(a.desc, 13.5)) * 22;   // desc 两行截断
  if (a.meta)     h += 7 + lines(a.meta, 10.5) * 16;
  if (a.primary || a.secondary) h += 12 + 38;                        // 按钮行
  if (this.items.length > 1) h += 9 + 8;                             // 分页点
  return Math.round(h);
};

Island.prototype.renderBody = function () {
  var html = this._bodyHtml();
  this.$('.di-ip-body').innerHTML = html;
  var a0 = this._cur();
  if (a0) this.$('.di-ip').style.height = this._ipOpenHeight(a0) + 'px';
  this.bindBody();
};

/* ---------- 相位：idle / active(单卡 或 多卡堆叠 is-stack) / list(扇形列表 is-list) / open(详情) ---------- */
Island.prototype._activate = function () {
  if (this.phase === 'idle') {
    this.root.classList.add('di-arrive');
    var r = this.root;
    setTimeout(function () { r.classList.remove('di-arrive'); }, 560);
  }
  this.root.classList.add('is-active');
  this.root.classList.remove('is-list');
  this.phase = 'active';
  this.openId = this.items[0] ? this.items[0].id : null;
  this._syncStack();
  this._compactHtml();
  this._refreshGlass();
};

/* 堆叠态点击最上卡 → 扇形展开列表；单条 active 点击 → 直接进该条详情（由 click 处分流） */
Island.prototype.openList = function () {
  if (this.items.length < 2) return;
  this.phase = 'active';
  this.openReturn = 'list';
  this._syncStack();
  this.root.classList.add('is-list');      /* scrim 淡入、deck 扇形展开、主卡隐藏均由 CSS 承接 */
};
Island.prototype.closeList = function () {
  if (!this.root.classList.contains('is-list')) return;
  this.root.classList.remove('is-list');
  this.phase = 'active';
  this._compactHtml();                     /* 主卡重新显示最新条，与 deck 第 0 张合龙 */
  this._syncStack();
};

/* 打开某条详情（open 大卡 morph）。fromList 决定关闭后回到列表还是堆叠/单卡 */
Island.prototype.open = function (id) {
  if (!this.items.length) return;
  var a = null;
  if (id != null) { for (var i = 0; i < this.items.length; i++) if (this.items[i].id === id) { a = this.items[i]; break; } }
  if (!a) a = this.items[0];
  this.openId = a.id;
  this.openReturn = this.root.classList.contains('is-list') ? 'list' : 'active';
  this.phase = 'open';
  this.root.classList.remove('is-list');   /* 列表收起，详情大卡盖在 deck 之上（deck 由 CSS 淡出） */
  this.renderBody();
  this.root.classList.add('is-open');
  this._refreshGlass();
};

Island.prototype.close = function () {
  if (this.phase !== 'open') return;
  this.root.classList.remove('is-open');
  this.$('.di-ip').style.height = '';
  this.phase = 'active';
  if (this.openReturn === 'list') {
    this._syncStack();
    this.root.classList.add('is-list');
  } else {
    this.root.classList.remove('is-list');
    this._syncStack();
    this._compactHtml();
  }
};

Island.prototype._idle = function () {
  this.root.classList.remove('is-open', 'is-active', 'is-list', 'is-stack', 'di-arrive');
  this.$('.di-ip').style.height = '';
  var deck = this.$('.di-deck'); if (deck) deck.innerHTML = '';
  this.openId = null;
  this.phase = 'idle';
};

/* ---------- 横滑切条（仅 open 详情态：多条详情间左右切换；堆叠/列表态不响应横滑） ---------- */
Island.prototype._swipeLayer = function () {
  return this.phase === 'open' ? this.$('.di-ip-body') : null;
};
/* dir>0 右滑（上一条）：当前详情继续向该方向滑出，新详情从对侧滑入；dir<0 反向。
   用 Web Animations API 显式播放关键帧，结束即 cancel 归还内联样式；高/宽随 renderBody 平滑 morph。 */
Island.prototype._swipeTo = function (dir) {
  if (this.phase !== 'open' || this.items.length < 2) return;
  var self = this;
  var n = this.items.length;
  var curIx = this._indexOfId(this.openId); if (curIx < 0) curIx = 0;
  var nextIx = (curIx + (dir > 0 ? n - 1 : 1)) % n;
  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce) {
    self.openId = self.items[nextIx].id; self.renderBody();
    return;
  }
  var OUT = 58;
  var l = this.$('.di-ip-body');
  var fromX = 0, fromOp = 1, outA = null;
  if (l) {
    var mm = /matrix\([^)]*,\s*(-?[\d.]+),\s*0\)\s*$/.exec(getComputedStyle(l).transform || '');
    if (mm) fromX = parseFloat(mm[1]) || 0;
    fromOp = parseFloat(getComputedStyle(l).opacity); if (isNaN(fromOp)) fromOp = 1;
    l.style.transition = 'none'; l.style.transform = ''; l.style.opacity = '';
    outA = l.animate(
      [{ transform: 'translateX(' + fromX + 'px)', opacity: String(fromOp) },
       { transform: 'translateX(' + (dir * OUT) + 'px)', opacity: '0' }],
      { duration: 150, easing: 'ease', fill: 'forwards' });
  }
  setTimeout(function () {
    if (outA) { try { outA.cancel(); } catch (e) {} }
    self.openId = self.items[nextIx].id;
    self.renderBody();
    var l2 = self.$('.di-ip-body');
    if (!l2) return;
    l2.style.transition = ''; l2.style.transform = ''; l2.style.opacity = '';
    var inA = l2.animate(
      [{ transform: 'translateX(' + (-dir * OUT) + 'px)', opacity: '0' },
       { transform: 'translateX(0)', opacity: '1' }],
      { duration: 240, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' });
    inA.onfinish = function () { try { inA.cancel(); } catch (e) {} };
    setTimeout(function () { try { inA.cancel(); } catch (e) {} }, 260);
  }, 155);
};

/* ---------- 横滑「关闭/滑除」（堆叠最上主卡、扇形列表卡；iOS 通知滑除语义） ---------- */
/* 堆叠/单卡态：向左或向右滑除最上面一条。释放即移除，下一条顶位补来（≥1）或收回 idle。 */
Island.prototype._dismissTop = function (dir, dx) {
  var self = this, ip = this.$('.di-ip');
  var id = this.items[0] && this.items[0].id;
  if (id == null || !ip) return;
  var op = parseFloat(getComputedStyle(ip).opacity); if (isNaN(op)) op = 1;
  var fly = ip.animate(
    [{ transform: 'translateX(calc(-50% + ' + dx + 'px))', opacity: String(op) },
     { transform: 'translateX(calc(-50% + ' + (dir * 360) + 'px)) scale(.92)', opacity: '0' }],
    { duration: 210, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' });
  setTimeout(function () {
    try { fly.cancel(); } catch (e) {}
    self.remove(id);                                   /* active 非 list：下一最上条顶上来 / 单卡 / idle */
    ip.style.transition = ''; ip.style.transform = ''; ip.style.opacity = '';
    if (self.phase !== 'idle') {                       /* 下一条顶位：一次性轻微入场 */
      var inA = ip.animate(
        [{ transform: 'translateX(-50%) translateY(-8px) scale(.96)', opacity: '0' },
         { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: '1' }],
        { duration: 260, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' });
      setTimeout(function () { try { inA.cancel(); } catch (e) {} }, 270);
    }
  }, 200);
};

/* 扇形列表：滑除指定卡（dir=±1 横向飞出；dir=0 为点 ✕，原地收束淡出）。
   采用 keyed 补位：只移除被删节点，其余兄弟按新序重排 --di-i，由 CSS transition 平滑上移，不整堆重建。 */
Island.prototype._dismissDeckCard = function (cardEl, id, dir, dx) {
  var self = this, deck = this.$('.di-deck');
  var ix = this._indexOfId(id);
  if (ix < 0 || !deck) return;
  this.items.splice(ix, 1);
  if (this._onRemove) { try { this._onRemove(id); } catch (e) {} }

  if (cardEl) {                                   /* 立即标记离场：不参与后续任何补位重排/手势，防快速连删残影 */
    cardEl.setAttribute('data-leaving', '1');
    cardEl.style.pointerEvents = 'none';
  }
  /* 剩余「存活」卡（排除其它正在飞出的卡）立即按新序重排 */
  var remain = Array.prototype.slice.call(deck.querySelectorAll('.di-card')).filter(function (c) {
    return c !== cardEl && !c.hasAttribute('data-leaving');
  });
  remain.forEach(function (c, k) {                      /* 剩余卡立即按新序重排（与删后 items 倒序一致） */
    c.dataset.i = String(k);
    c.style.setProperty('--di-i', String(k));
  });
  if (cardEl) {
    cardEl.classList.remove('is-dragging');
    cardEl.style.transition = '';
    var op = parseFloat(getComputedStyle(cardEl).opacity); if (isNaN(op)) op = 1;
    var yExp = 'calc(var(--di-i, 0) * 86px)';
    var endTo = dir === 0
      ? ['translate(-50%, calc(var(--di-i, 0) * 86px + 12px)) scale(.90)', '0']
      : ['translate(calc(-50% + ' + (dir * 360) + 'px), ' + yExp + ') scale(.92)', '0'];
    var a = cardEl.animate(
      [{ transform: 'translate(calc(-50% + ' + (dx || 0) + 'px), ' + yExp + ')', opacity: String(op) },
       { transform: endTo[0], opacity: endTo[1] }],
      { duration: 210, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' });
    setTimeout(function () { try { a.cancel(); } catch (e) {} if (cardEl.parentNode) cardEl.parentNode.removeChild(cardEl); }, 210);
  }

  var nLeft = this.items.length;
  if (nLeft === 0) setTimeout(function () { self._idle(); }, 200);
  else if (nLeft === 1) setTimeout(function () { self.closeList(); }, 200);   /* 剩 1：扇形收回成单卡 */
};


Island.prototype._sortItems = function () {
  this.items.sort(function (x, y) {
    var tx = +x.ts, ty = +y.ts;
    if (ty !== tx) return ty - tx;            /* 触发时间倒序 */
    return (y._seq || 0) - (x._seq || 0);     /* 同毫秒：后到的更靠前 */
  });
};
Island.prototype.add = function (a) {
  if (!a || !a.id) return null;
  var existed = this.items.some(function (x) { return x.id === a.id; });
  if (existed) {
    for (var k = 0; k < this.items.length; k++) if (this.items[k].id === a.id) { this.items[k] = a; break; }
  } else {
    if (a.ts == null && a.time != null) a.ts = a.time;
    if (a.ts == null) a.ts = Date.now();
    a._seq = ++this._seq;
    this.items.push(a);
  }
  this._sortItems();
  if (this.phase === 'idle' || this.phase === 'active') {
    this._activate();
  } else if (this.root.classList.contains('is-list')) {
    this._syncStack();                       /* 列表态新增：保持展开、就地重排 */
  } else if (this.phase === 'open') {
    this.renderBody();
  }
  return a.id;
};

Island.prototype.remove = function (id) {
  var ix = this._indexOfId(id);
  if (ix < 0) return;
  this.items.splice(ix, 1);
  /* 无论从哪条路径移除（✕ / 主 / 次按钮 / API），都通知持有者同步持久缓存，杜绝切机型重建后已处理事项复活 */
  if (this._onRemove) { try { this._onRemove(id); } catch (e) {} }
  if (!this.items.length) { this._idle(); return; }

  var wasList = this.root.classList.contains('is-list');     /* 列表卡 ✕（未进详情） */
  if (this.phase === 'open' && this.openId === id) {
    /* 在详情里处理/关闭当前条：收起详情，回到来源（列表 / 堆叠/单卡）。来源以 openReturn 为准，
       因为 open() 进入时已移除 is-list 类，不能再靠 classList 判断 */
    var backToList = this.openReturn === 'list';
    this.root.classList.remove('is-open');
    this.$('.di-ip').style.height = '';
    this.phase = 'active';
    if (backToList && this.items.length > 1) { this._syncStack(); this.root.classList.add('is-list'); }
    else { this.root.classList.remove('is-list'); this._activate(); }
    return;
  }
  if (wasList) {
    if (this.items.length === 1) { this.closeList(); }   /* 只剩一条：扇形收回成单卡 */
    else { this._syncStack(); }                          /* 列表内 ✕：其余卡扇形重排 */
  } else {
    this._syncStack();
    this._compactHtml();
  }
};

Island.prototype.clear = function () {
  this.items = [];
  this.openId = null;
  if (this._onClear) { try { this._onClear(); } catch (e) {} }
  this._idle();
};

Island.prototype.getActive = function () { return this.items.map(function (a) { return a.id; }); };

/* ---------- 销毁（供运行中切换机型/外壳时重建：销毁 WebGL 玻璃、移除整棵 DOM） ---------- */
Island.prototype.destroy = function () {
  this._destroyed = true;
  (this.glass || []).forEach(function (g) {
    try { g && g.destroy && g.destroy(); } catch (e) {}
  });
  this.glass = [];
  this._glassReady = {}; this._glassInflight = {};
  if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
};

/* ---------- 事件 ---------- */
Island.prototype.bindChrome = function () {
  var self = this;
  var card = this.$('.di-ip');
  var veil = this.$('.di-veil');

  var scrim = this.$('.di-scrim');
  var deck = this.$('.di-deck');

  if (card) {
    /* 点击最上卡：多条堆叠 → 扇形展开列表；单条 → 直接进详情。手势末尾的合成 click 需忽略 */
    card.addEventListener('click', function () {
      if (self._swiped) { self._swiped = false; return; }
      if (self.phase !== 'active') return;
      if (self.items.length >= 2) self.openList();
      else self.open(self.items[0] && self.items[0].id);
    });

    /* 手势（构造时只绑定一次）：左右滑切换事项、上滑收回展开。
       关键：不使用 setPointerCapture —— 它会把「在按钮/✕ 上按下」的整条指针序列捕获到卡片，
       真实 pointerup/click 被重定向，导致按钮真实点击全部失效（而 element.click() 合成点击不经过
       指针捕获仍能触发，极易误判为正常）。改为在 window 上临时监听 pointerup（pointerdown 只记起点，
       位移在抬起时按起止点一次性计算）；并且在任何可交互子元素上按下时不接管手势，让按钮原生的
       pointerdown→pointerup→click 完整送达，从根本上恢复 ✕ / 主 / 次按钮的真实点击。 */
    /* —— 指针手势（构造时只绑定一次，不使用 setPointerCapture）——
       · 横滑：仅 open 详情态在多条详情间左右切换，内容层实时跟手位移，抬手达阈值/快速轻扫即切换并播放
         滑动动效，未达阈值回弹；堆叠/列表态多卡已同时可见，不响应横滑（交给点击/蒙版）；
       · 上滑：open 详情态收起，返回来源（列表 / 堆叠/单卡）；
       · 纯点击：不在此处理，交由 card 的 click 分流（多条→openList、单条→open），手势末尾用 _swiped 抑制误触。
       真机由 .di-ip{touch-action:none} 保证指针不被页面滚动取消。 */
    var sx = 0, sy = 0, st = 0, tracking = false, pid = null, axis = null;
    var SWIPE_PX = 46, SWIPE_FLICK = 24, FLICK_MS = 260, DRAG_DAMP = 0.55;   /* open 详情切条阈值 */
    var DISMISS_PX = 104, DISMISS_FLICK = 44, DISMISS_FL_MS = 300;          /* compact/堆叠 滑除阈值 */
    /* 未达阈值：按相位把跟手改动的层平滑归位（open=详情内容层，其余=主卡本体） */
    function springBack() {
      if (self.phase === 'open') {
        var l = self._swipeLayer();
        if (!l) return;
        l.style.transition = 'transform .24s cubic-bezier(.32,.72,0,1), opacity .24s ease';
        l.style.transform = ''; l.style.opacity = '';
        setTimeout(function () { l.style.transition = ''; }, 250);
      } else {
        card.style.transition = 'transform .26s cubic-bezier(.32,.72,0,1), opacity .26s ease';
        card.style.transform = ''; card.style.opacity = '';   /* 清 inline 回 CSS translateX(-50%) */
        setTimeout(function () { card.style.transition = ''; }, 270);
      }
    }
    function endTrack() {
      tracking = false; pid = null; axis = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    }
    function onMove(ev) {
      if (!tracking || ev.pointerId !== pid) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (axis === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';   /* 首次越阈即锁定方向，避免斜向抖动 */
      }
      /* 横滑：open 详情=多详情间切条；compact/堆叠=滑除最新条。纵向不在此处理 */
      if (axis !== 'x') return;
      if (self.phase === 'open') {
        if (self.items.length < 2) return;
        var l = self._swipeLayer();
        if (!l) return;
        l.style.transition = 'none';
        l.style.transform = 'translateX(' + (dx * DRAG_DAMP) + 'px)';
        l.style.opacity = String(Math.max(0.45, 1 - Math.abs(dx) / 180));
      } else if (self.phase === 'active') {
        /* compact / 堆叠最上卡：主卡整体跟手，位移叠加在居中 translateX(-50%) 上 */
        card.style.transition = 'none';
        card.style.transform = 'translateX(calc(-50% + ' + dx + 'px))';
        card.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 170));
      }
    }
    function onUp(ev) {
      if (!tracking || ev.pointerId !== pid) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy, dt = Date.now() - st;
      var wasX = axis === 'x';
      var flickFast = Math.abs(dx) > DISMISS_FLICK && dt < DISMISS_FL_MS && Math.abs(dx) > Math.abs(dy);
      var openSwipe = wasX && self.phase === 'open' && self.items.length > 1 &&
        (Math.abs(dx) > SWIPE_PX || (Math.abs(dx) > SWIPE_FLICK && dt < FLICK_MS && Math.abs(dx) > Math.abs(dy)));
      var dismiss = wasX && self.phase === 'active' && (Math.abs(dx) > DISMISS_PX || flickFast);
      var upward = axis === 'y' && dy < -46 && Math.abs(dy) > Math.abs(dx) && self.phase === 'open';
      endTrack();
      if (openSwipe) {
        self._swiped = true;                       /* 抑制手势后紧随的 click */
        self._swipeTo(dx > 0 ? 1 : -1);           /* open 详情：右滑=上一条，左滑=下一条 */
        setTimeout(function () { self._swiped = false; }, 140);
      } else if (dismiss) {
        self._swiped = true;                       /* 抑制随后的 click（否则误触发展开/列表） */
        self._dismissTop(dx > 0 ? 1 : -1, dx);     /* compact/堆叠：滑除最上条，下一条顶位 */
        setTimeout(function () { self._swiped = false; }, 240);
      } else if (upward) {
        self._swiped = true;
        self.close();
        setTimeout(function () { self._swiped = false; }, 140);
      } else if (wasX) {
        springBack();                              /* 未达阈值：跟手回弹 */
      }
    }
    function onCancel() {
      var wasX = axis === 'x';
      endTrack();
      if (wasX) springBack();                      /* 被系统打断（来电/滚动）也平滑回弹 */
    }
    card.addEventListener('pointerdown', function (ev) {
      if (self.phase === 'idle') return;
      /* 在按钮 / ✕ 等可交互元素上按下：不接管卡片手势，保证其 click 完整送达 */
      if (ev.target && ev.target.closest && ev.target.closest('button, .di-act, .di-b-close')) return;
      tracking = true; pid = ev.pointerId; axis = null;
      sx = ev.clientX; sy = ev.clientY; st = Date.now();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    });
  }

  /* 详情态顶部遮罩 → 反向 morph 收回（保留事项，回到来源：列表 / 堆叠/单卡） */
  if (veil) veil.addEventListener('click', function () { if (self.phase === 'open') self.close(); });

  /* 列表态全页蒙版空白处 → 扇形收回到堆叠（保留全部事项）。卡片在蒙版上层，点卡不触发此处理 */
  if (scrim) scrim.addEventListener('click', function () { if (self.root.classList.contains('is-list')) self.closeList(); });

  /* 卡堆：① pointer 手势——扇形列表里横滑某张＝滑除该条（iOS 通知滑除）；
     ② click 委托——点卡进详情，点该卡 ✕ 单独关闭。容器常驻、仅 innerHTML 重建，故手势绑在 deck 上。 */
  if (deck) {
    var dSx = 0, dSy = 0, dSt = 0, dTrack = false, dPid = null, dAxis = null, dCard = null, dId = null;
    var DIS_PX = 104, DIS_FLICK = 44, DIS_FLMS = 300;
    function deckY(c) { return (parseInt(c.getAttribute('data-i'), 10) || 0) * 86; }
    function dEnd() {
      dTrack = false; dPid = null; dAxis = null;
      window.removeEventListener('pointermove', dMove);
      window.removeEventListener('pointerup', dUp);
      window.removeEventListener('pointercancel', dCancel);
    }
    function dReset() {                       /* 未达阈值：去拖拽态，清 inline，CSS 过渡把卡拉回列位 */
      if (!dCard) return;
      dCard.classList.remove('is-dragging');
      dCard.style.transform = ''; dCard.style.opacity = '';
      dCard = null; dId = null;
    }
    function dMove(ev) {
      if (!dTrack || ev.pointerId !== dPid) return;
      var dx = ev.clientX - dSx, dy = ev.clientY - dSy;
      if (dAxis === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        dAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (dAxis !== 'x' || !dCard) return;
      dCard.style.transform = 'translate(calc(-50% + ' + dx + 'px), ' + deckY(dCard) + 'px)';
      dCard.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 180));
    }
    function dUp(ev) {
      if (!dTrack || ev.pointerId !== dPid) return;
      var dx = ev.clientX - dSx, dy = ev.clientY - dSy, dt = Date.now() - dSt;
      var wasX = dAxis === 'x';
      var flick = Math.abs(dx) > DIS_FLICK && dt < DIS_FLMS && Math.abs(dx) > Math.abs(dy);
      var dismiss = wasX && (Math.abs(dx) > DIS_PX || flick);
      var cardEl = dCard, id = dId;
      dEnd();
      if (dismiss && cardEl) {
        self._deckSwiped = true;             /* 抑制抬手后紧随的 click（点卡进详情） */
        setTimeout(function () { self._deckSwiped = false; }, 240);
        self._dismissDeckCard(cardEl, id, dx > 0 ? 1 : -1, dx);
        dCard = null; dId = null;
      } else if (wasX) {
        dReset();                            /* 未达阈值：跟手回弹 */
      } else { dCard = null; dId = null; }
    }
    function dCancel() { dEnd(); dReset(); };
    deck.addEventListener('pointerdown', function (ev) {
      if (!self.root.classList.contains('is-list')) return;   /* 仅扇形列表支持卡内横滑 */
      var cardEl = ev.target && ev.target.closest ? ev.target.closest('.di-card') : null;
      if (!cardEl) return;
      if (ev.target.closest && ev.target.closest('button, [data-cx]')) return;  /* ✕ 交给 click */
      dTrack = true; dPid = ev.pointerId; dAxis = null;
      dCard = cardEl; dId = cardEl.getAttribute('data-id');
      dSx = ev.clientX; dSy = ev.clientY; dSt = Date.now();
      cardEl.classList.add('is-dragging');
      window.addEventListener('pointermove', dMove);
      window.addEventListener('pointerup', dUp);
      window.addEventListener('pointercancel', dCancel);
    });

    deck.addEventListener('click', function (ev) {
      var cardEl = ev.target && ev.target.closest ? ev.target.closest('.di-card') : null;
      if (!cardEl) return;
      var id = cardEl.getAttribute('data-id');
      if (ev.target.closest('[data-cx]')) {
        ev.stopPropagation();
        self._dismissDeckCard(cardEl, id, 0, 0);     /* ✕：原地收束淡出 + 其余卡补位 */
        return;
      }
      if (self._deckSwiped) return;                  /* 横滑抬手的合成 click 不进详情 */
      self.open(id);
    });
  }
};

Island.prototype.bindBody = function () {
  var self = this;
  var bodyEl = this.$('.di-ip-body');
  var a = this._cur();
  if (!bodyEl || !a) return;

  bodyEl.querySelectorAll('[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var act = btn.getAttribute('data-act');
      if (act === 'primary' && a.primary && a.primary.onClick) a.primary.onClick(ev);
      else if (act === 'secondary' && a.secondary && a.secondary.onClick) a.secondary.onClick(ev);
      /* ✕ 关闭 / 主按钮 / 次按钮：处理完即从岛移除本条（完成态语义）；
         移除后由 remove() 走同一条 .52s morph 反向收回到 compact / idle，动效与展开对称。 */
      self.remove(a.id);
    });
  });
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
