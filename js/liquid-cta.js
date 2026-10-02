/* ============================================================================
   liquid-cta.js — 液态玻璃 CTA 引擎（v2：逐按钮玻璃 + 彩色 tint）
   复用主 tabbar（js/liquid-glass.iife.js 内 LG_TABBAR）的玻璃参数体系：
   tint  light .45 / dark .5 · frost  light .5 / dark .48 · live 'auto'
   本版改动（相对 v1）：
   1. 玻璃不再挂在 [data-lg-cta] 容器上（不再有"整块玻璃背景"），
      改为对容器内每个按钮（.lg-btn / .dab-icon / .dab-cta）单独挂载。
   2. 彩色玻璃：material.tintColor 按按钮语义取值——
      主行动(金) #B89968 · 解锁/已提交(绿) #2B6B4F · 中性(白)
      可用 data-lg-tint-color="#hex" 覆盖；.dab-icon.active 收藏激活 → 金。
   3. 解锁态/已提交态/收藏激活态 的 class 变化 → 实时 update tintColor。
   能力：
   1. LGCTA.mount(btn, overrides)  — 给单个按钮挂 WebGL2 液态折射 + 明暗联动
   2. LGCTA.floating(bar, trigger, scroller) — trigger 滚出可视区 → bar 加 .show
   3. 自动扫描 [data-lg-cta] 容器内按钮（DOMContentLoaded）
   4. .lg-btn[data-lg-src] 点击委托给源按钮（同一行为，零重复逻辑）
   5. LGCTA.setDynamic(bar, key) — 按 data-lg-labels / data-lg-hrefs 切换按钮态
   降级：WebGL2 不可用或 prefers-reduced-transparency → data-liquid-glass="fallback"，
   CSS（liquid-cta.css 的 backdrop-filter + 半透明底色）兜底，视觉不塌。
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULTS = { tintLight: .45, tintDark: .5, frostLight: .5, frostDark: .48 };
  /* 按钮玻璃参数（preview.html「按钮玻璃」面板下发，独立于主 Tabbar）：
     不同主色按钮需要不同的乳白强度才能获得最佳观感：
     - gold（品牌金主行动）：tint 0.85/0.80 —— 金色清晰且保留约 60% 内容透射
     - green（解锁/已提交态）：tint 0.70/0.65 —— 状态色不必过浓，透射优先
     - neutral（中性次行动/图标）：tint 0.40/0.45 —— 薄玻璃
     - frost（全部按钮的预模糊）：与色彩无关，统一 0.15 保证内容清晰 */
  var BTN_CFG_KEY = 'engchain-btn-glass-cfg-v2';
  var BTN_DEFAULTS = {
    goldLight: 1.40, goldDark: 1.40,
    greenLight: 1.25, greenDark: 1.20,
    neutralLight: 0.45, neutralDark: 0.45,
    frostLight: 0.15, frostDark: 0.15
  };
  function clampNum(v, lo, hi) { v = Number(v); if (isNaN(v)) return lo; return Math.min(hi, Math.max(lo, v)); }
  function loadBtnCfg() {
    var cfg = {};
    try { var raw = localStorage.getItem(BTN_CFG_KEY); if (raw) cfg = JSON.parse(raw); } catch (e) {}
    var out = {};
    Object.keys(BTN_DEFAULTS).forEach(function (k) {
      out[k] = (cfg[k] !== undefined && cfg[k] !== null) ? clampNum(cfg[k], 0, 1.5) : BTN_DEFAULTS[k];
    });
    /* 旧版配置迁移：tintLight/tintDark/frostLight/frostDark → 新三色结构 */
    if (cfg.tintLight !== undefined && cfg.goldLight === undefined) out.goldLight = clampNum(cfg.tintLight, 0, 1.5);
    if (cfg.tintDark !== undefined && cfg.goldDark === undefined) out.goldDark = clampNum(cfg.tintDark, 0, 1.5);
    if (cfg.frostLight !== undefined && cfg.frostLight === undefined) out.frostLight = clampNum(cfg.frostLight, 0, 1.5);
    if (cfg.frostDark !== undefined && cfg.frostDark === undefined) out.frostDark = clampNum(cfg.frostDark, 0, 1.5);
    return out;
  }
  var btnCfg = loadBtnCfg();
  /* 按钮语义 → 玻璃颜色（0-1 RGB，乘在明暗 tint 基底上） */
  var COLORS = {
    primary:  [0.620, 0.480, 0.260],  /* 品牌金（明亮·深金 #9E7A42，加深按钮深度） */
    primaryDark: [0.900, 0.780, 0.560],  /* 品牌金（暗色·亮金 #E6C78F，提升按钮亮度） */
    unlocked: [0.140, 0.380, 0.270],  /* 解锁/成功绿（明亮·深绿 #245F45，加深按钮深度） */
    unlockedDark: [0.450, 0.720, 0.580],  /* 解锁/成功绿（暗色·亮绿 #73B894） */
    neutral:  [1.000, 1.000, 1.000]   /* 中性乳白（次行动/图标钮） */
  };
  /* 按钮语义 → tint 强度：彩色玻璃需要足够浓度才"看得出颜色"，
     同时保留内容半透（tintOpacity 与 1-tintOpacity 平衡）。 */
  var SEM_TINT = {
    gold:    { light: 1.00, dark: 0.90 },
    green:   { light: 0.85, dark: 0.75 },
    neutral: { light: 0.40, dark: 0.45 }
  };
  /* 玻璃材质（V2 全量参数，液态光学优先）：
     - frost 0.15：按钮短边 46px → ~7px 预模糊，内容清晰不糊
     - refraction 84 / dispersion 3.0：强折射 + RGB 色散（边缘更可见）
     - rim 0.55 / reflection 0.55 / highlight 0.60：边缘捕捉、反射与内光斑
       （玻璃厚度感与"液态"观感的主要来源）
     - echo 0.40 / hairline 0.95：内辉光与发丝描边 */
  var GLASS_MATERIAL = {
    refraction: 84,
    edgeReach: 0.18,
    edgeWidth: 0.24,
    dispersion: 3.0,
    frost: 0.15,
    body: 0.72,
    absorption: 0.58,
    rim: 0.55,
    reflection: 0.55,
    highlight: 0.60,
    echo: 0.40,
    hairline: 0.95
  };
  /* 按钮材质参数（preview.html「按钮材质」面板下发，独立于 tint/frost）：
     与 GLASS_MATERIAL 同字段，仅面板可调的关键项；加载时合并覆盖，
     持久化 key 'engchain-btn-glass-material'，postMessage 'engchain:btn-glass-material'。 */
  var MAT_KEY = 'engchain-btn-glass-material';
  var MAT_DEFAULTS = { refraction: 84, dispersion: 3.0, reflection: 0.55, highlight: 0.60, hairline: 0.95, edgeWidth: 0.24 };
  try { var mRaw = localStorage.getItem(MAT_KEY); if (mRaw) Object.assign(GLASS_MATERIAL, JSON.parse(mRaw)); } catch (e) {}
  var mounted = [];

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }
  function supportsLG() {
    return !!(window.LiquidGlass && LiquidGlass.isSupported && LiquidGlass.isSupported());
  }
  function reducedTransparency() {
    try { return window.matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches; }
    catch (e) { return false; }
  }
  function readNum(el, attr, fallback) {
    var v = el.getAttribute(attr);
    if (v == null || v === '') return fallback;
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  /* 按钮类 → 语义（覆盖全站底部固定操作栏的通用按钮体系）：
     金：btn-primary / btn-submit / btn-next / at-cta / radar-bar-btn.primary / lg-btn-primary / dab-cta
     绿：is-unlocked / lg-btn-submitted
     中性：btn-ghost / btn-secondary / btn-prev / btn-draft / radar-bar-btn.secondary / dab-icon */
  var GOLD_CLS = ['lg-btn-primary', 'dab-cta', 'btn-primary', 'btn-submit', 'btn-next', 'at-cta'];
  var NEUTRAL_CLS = ['btn-ghost', 'btn-secondary', 'btn-prev', 'btn-draft', 'dab-icon'];
  function hasCls(btn, arr) {
    for (var i = 0; i < arr.length; i++) { if (btn.classList.contains(arr[i])) return true; }
    return false;
  }
  function isGoldBtn(btn) { return hasCls(btn, GOLD_CLS) || (btn.classList.contains('radar-bar-btn') && btn.classList.contains('primary')); }
  function isNeutralBtn(btn) { return hasCls(btn, NEUTRAL_CLS) || (btn.classList.contains('radar-bar-btn') && btn.classList.contains('secondary')); }
  function semanticTint(btn, dark) {
    if (isGoldBtn(btn)) {
      return dark ? btnCfg.goldDark : btnCfg.goldLight;
    }
    if (btn.classList.contains('lg-btn-submitted') || btn.classList.contains('is-unlocked')) {
      return dark ? btnCfg.greenDark : btnCfg.greenLight;
    }
    return dark ? btnCfg.neutralDark : btnCfg.neutralLight;
  }
  function params(btn, overrides) {
    var d = isDark();
    /* 彩色按钮（金/绿）暗色下用亮基底，保证品牌色可见；
       中性按钮沿用 tabbar 同款（暗色深基底） */
    var colorful = isGoldBtn(btn) || btn.classList.contains('lg-btn-submitted') || btn.classList.contains('is-unlocked');
    return {
      tint: readNum(btn, 'data-lg-tint', (overrides && overrides.tint) != null ? overrides.tint : semanticTint(btn, d)),
      tintTone: (overrides && overrides.tintTone) ? overrides.tintTone : (colorful ? 'light' : (d ? 'dark' : 'light')),
      frost: readNum(btn, 'data-lg-frost', (overrides && overrides.frost) != null ? overrides.frost : (d ? btnCfg.frostDark : btnCfg.frostLight)),      live: 'auto'
    };
  }
  /* ---- 颜色解析：#rrggbb / rgb(r,g,b) / [r,g,b] 0-1 ---- */
  function parseColor(v) {
    if (!v) return null;
    if (typeof v === 'string') {
      var hex = v.replace('#', '');
      var n = parseInt(hex, 16);
      if (hex.length === 6 && !isNaN(n)) return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
      var m = v.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
      return null;
    }
    if (Array.isArray(v) && v.length === 3) return v.map(Number);
    return null;
  }
  /* ---- 按钮语义 → tintColor ---- */
  function colorFor(btn) {
    var custom = parseColor(btn.getAttribute('data-lg-tint-color'));
    if (custom) return custom;
    if (btn.classList.contains('is-unlocked') || btn.classList.contains('lg-btn-submitted')) return isDark() ? COLORS.unlockedDark : COLORS.unlocked;
    if (isGoldBtn(btn)) return isDark() ? COLORS.primaryDark : COLORS.primary;
    if (btn.classList.contains('dab-icon') && btn.classList.contains('active')) return isDark() ? COLORS.primaryDark : COLORS.primary;
    return COLORS.neutral;
  }

  /* ---- 单按钮挂载（幂等） ---- */
  function mountButton(btn) {
    if (!btn || btn.getAttribute('data-lg-mounted')) return null;
    if (!supportsLG() || reducedTransparency()) {
      btn.setAttribute('data-liquid-glass', 'fallback');
      return null;
    }
    try {
      var g = new LiquidGlass(btn, Object.assign({}, params(btn, null), {
        material: Object.assign({}, GLASS_MATERIAL, { tintColor: colorFor(btn) })
      }));
      btn.setAttribute('data-lg-mounted', '1');
      mounted.push({ el: btn, glass: g });
      watchClass(btn);
      return g;
    } catch (e) {
      btn.setAttribute('data-liquid-glass', 'fallback');
      return null;
    }
  }

  /* ---- 按钮 class 变化 → 实时更新玻璃（颜色与材质，解锁/已提交/收藏激活） ---- */
  function watchClass(btn) {
    var last = btn.className;
    try {
      new MutationObserver(function () {
        if (btn.className === last) return;
        last = btn.className;
        for (var i = 0; i < mounted.length; i++) {
          if (mounted[i].el === btn) {
            try {
              mounted[i].glass.update({
                material: Object.assign({}, GLASS_MATERIAL, { tintColor: colorFor(btn) })
              });
            } catch (e) {}
            break;
          }
        }
      }).observe(btn, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }

  /* ---- 明暗主题联动（一次性全局观察者） ---- */
  function watchTheme() {
    try {
      new MutationObserver(function () {
        mounted.forEach(function (rec) {
          try {
            rec.glass.update(Object.assign({}, params(rec.el, null), {
              material: Object.assign({}, GLASS_MATERIAL, { tintColor: colorFor(rec.el) })
            }));
          } catch (e) {}
        });
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}
  }

  /* ---- 滚动显现：trigger 滚出 scroller 可视区顶部 → bar.show ---- */
  function floating(bar, trigger, scroller) {
    if (!bar || !trigger || !scroller) return;
    function check() {
      var t = trigger.getBoundingClientRect();
      var s = scroller.getBoundingClientRect();
      bar.classList.toggle('show', t.bottom <= s.top + 6);
    }
    scroller.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    setInterval(check, 250); /* 兜底：路由/弹层引起的布局变化 */
    check();
  }

  /* ---- 点击委托：data-lg-src → 源按钮 .click()；否则 data-lg-href 跳转 ---- */
  function bindClicks(root) {
    var btns = (root ? root.querySelectorAll('.lg-btn') : document.querySelectorAll('.lg-btn'));
    Array.prototype.forEach.call(btns, function (btn) {
      if (btn.getAttribute('data-lg-bound')) return;
      btn.setAttribute('data-lg-bound', '1');
      btn.addEventListener('click', function () {
        var sel = btn.getAttribute('data-lg-src');
        var src = sel && document.querySelector(sel);
        if (src) {
          try { src.click(); } catch (e) {
            var h = src.getAttribute('href');
            if (h) window.location.href = h;
          }
          return;
        }
        var href = btn.getAttribute('data-lg-href');
        if (href) window.location.href = href;
      });
    });
  }

  /* ---- 双态按钮（personnel：企业招聘→我要招聘 / 持证人才→我要投递） ---- */
  function setDynamic(bar, key) {
    if (!bar || !key) return;
    var labels = {}, hrefs = {};
    try { labels = JSON.parse(bar.getAttribute('data-lg-labels') || '{}'); } catch (e) {}
    try { hrefs = JSON.parse(bar.getAttribute('data-lg-hrefs') || '{}'); } catch (e) {}
    var btn = bar.querySelector('.lg-btn');
    if (!btn) return;
    var lab = btn.querySelector('.lg-btn-label');
    if (lab && labels[key]) lab.textContent = labels[key];
    if (hrefs[key]) { btn.setAttribute('data-lg-href', hrefs[key]); btn.removeAttribute('data-lg-src'); }
  }

  /* ---- 挂载选择器：容器内所有语义按钮（通用 .btn 体系 + 特殊类） ---- */
  var BTN_SELECTOR = '.btn, .lg-btn, .dab-icon, .dab-cta, .at-cta, .radar-bar-btn';
  /* ---- 自动初始化：容器不再挂玻璃，逐个按钮挂载 ---- */
  function boot() {
    document.querySelectorAll('[data-lg-cta]').forEach(function (el) {
      var kind = el.getAttribute('data-lg-cta');
      var btns = el.querySelectorAll(BTN_SELECTOR);
      Array.prototype.forEach.call(btns, function (b) { mountButton(b); });
      if (kind === 'floating') {
        var trigger = document.querySelector(el.getAttribute('data-lg-trigger') || '');
        var scroller = document.querySelector(el.getAttribute('data-lg-scroller') || '.scroll');
        floating(el, trigger, scroller);
      }
    });
    bindClicks(null);
  }
  /* ---- 动态按钮支持：JS 模板生成的 fixed-cta / display 切换的元素 ---- */
  var _dynT = null;
  function scanDynamic() {
    document.querySelectorAll('[data-lg-cta]').forEach(function (el) {
      var btns = el.querySelectorAll(BTN_SELECTOR);
      Array.prototype.forEach.call(btns, function (b) { mountButton(b); });
    });
  }
  try {
    new MutationObserver(function () {
      if (_dynT) return;
      _dynT = setTimeout(function () {
        _dynT = null;
        scanDynamic();
        try { LiquidGlass.refreshAll && LiquidGlass.refreshAll(); } catch (e) {}
      }, 120);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  } catch (e) {}
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  watchTheme();

  /* ---- preview.html「按钮玻璃」面板联动：postMessage + localStorage 双通道 ---- */
  function applyBtnCfg(next) {
    if (!next) return;
    var merged = {};
    Object.keys(BTN_DEFAULTS).forEach(function (k) {
      merged[k] = (next[k] !== undefined && next[k] !== null) ? clampNum(next[k], 0, 1.5) : btnCfg[k];
    });
    btnCfg = merged;
    try { localStorage.setItem(BTN_CFG_KEY, JSON.stringify(btnCfg)); } catch (e) {}
    mounted.forEach(function (rec) {
      try { rec.glass.update(Object.assign({}, params(rec.el, null), { material: Object.assign({}, GLASS_MATERIAL, { tintColor: colorFor(rec.el) }) })); } catch (e) {}
    });
  }
  /* ---- preview.html「按钮材质」面板联动：postMessage + localStorage 双通道（更新 GLASS_MATERIAL） ---- */
  var MAT_RANGE = { refraction: [0, 150], dispersion: [0, 6], reflection: [0, 1], highlight: [0, 1], hairline: [0, 1], edgeWidth: [0, 0.6] };
  function applyMatCfg(next) {
    if (!next) return;
    Object.keys(MAT_RANGE).forEach(function (k) {
      if (next[k] !== undefined && next[k] !== null) GLASS_MATERIAL[k] = clampNum(next[k], MAT_RANGE[k][0], MAT_RANGE[k][1]);
    });
    try { localStorage.setItem(MAT_KEY, JSON.stringify(GLASS_MATERIAL)); } catch (e) {}
    mounted.forEach(function (rec) {
      try { rec.glass.update(Object.assign({}, params(rec.el, null), { material: Object.assign({}, GLASS_MATERIAL, { tintColor: colorFor(rec.el) }) })); } catch (e) {}
    });
  }
  try {
    window.addEventListener('storage', function (e) {
      if (e.key === BTN_CFG_KEY && e.newValue) {
        try { applyBtnCfg(JSON.parse(e.newValue)); } catch (err) {}
      } else if (e.key === MAT_KEY && e.newValue) {
        try { applyMatCfg(JSON.parse(e.newValue)); } catch (err) {}
      }
    });
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (d && d.type === 'engchain:btn-glass-cfg') {
        applyBtnCfg(d);
      } else if (d && d.type === 'engchain:btn-glass-material') {
        applyMatCfg(d);
      }
    });
  } catch (e) {}

  /* 滚动时强制刷新玻璃 backdrop：液态玻璃需透射"正在滚动的页面内容"，
     库 v2 渲染默认只响应 dirty/resize/live(canvas/video)，滚动容器内容移动
     不会自动触发重绘 → 这里以 window 捕获监听任意滚动，节流 70ms 刷新全部实例。 */
  var _scrollT = null;
  try {
    window.addEventListener('scroll', function () {
      if (_scrollT) return;
      _scrollT = setTimeout(function () {
        _scrollT = null;
        try { LiquidGlass.refreshAll(); } catch (e) {}
      }, 70);
    }, { capture: true, passive: true });
  } catch (e) {}

  window.LGCTA = {
    mount: mountButton,
    floating: floating,
    setDynamic: setDynamic,
    isSupported: supportsLG,
    refreshAll: function () { try { LiquidGlass.refreshAll && LiquidGlass.refreshAll(); } catch (e) {} }
  };
})();
