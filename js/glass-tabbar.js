/* ============================================================================
   glass-tabbar.js — 主 Tabbar 液态玻璃（apple-liquid-glass-webgl 版）
   ----------------------------------------------------------------------------
   用途：替换 js/liquid-dock.js 的自研玻璃层。布局几何仍由 liquid-dock.css
         （56px 胶囊 / 220px 定宽 / 居右成簇 / AI 球锚点）承担，本脚本只负责
         用 LiquidGlass 库渲染 Dock 玻璃（WebGL2 折射 + tint + frost）。
   特性：
     - 等 common.js 注入 .app-tabbar 后挂载（MutationObserver + readyState 兜底）
     - 明暗联动：MutationObserver 监听 <html data-theme> → update tint/tintTone/frost
     - 参数可调：localStorage 'engchain-glass-cfg' + postMessage 'engchain:glass-cfg'
       + storage 事件（preview.html 左侧边栏控制台联动）
     - 暴露 window.LG_TABBAR = { getCfg, setCfg } 供外部调用
   红线：不触碰 .app-nav-shell / .ai-orb-entry / .tab-glass 位置逻辑
         （透镜位置由 common.js initTabbarGlass 控制，与本脚本无关）。
   ========================================================================== */

(function () {
  var CFG_KEY = 'engchain-glass-cfg';

  var DEFAULTS = {
    tintLight: 0.45,   /* 明亮模式乳白层 */
    tintDark: 0.5,     /* 暗色模式乳白层 */
    frostLight: 0.5,   /* 明亮模式模糊强度 */
    frostDark: 0.48    /* 暗色模式模糊强度 */
  };

  function clamp(v, lo, hi) { v = Number(v); if (isNaN(v)) return lo; return Math.min(hi, Math.max(lo, v)); }

  function loadCfg() {
    var cfg = {};
    try {
      var raw = localStorage.getItem(CFG_KEY);
      if (raw) cfg = JSON.parse(raw);
    } catch (e) {}
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = (cfg[k] !== undefined && cfg[k] !== null) ? clamp(cfg[k], 0, 1.5) : DEFAULTS[k];
    });
    return out;
  }

  function saveCfg(cfg) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  var cfg = loadCfg();
  var dockGlass = null;

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function params() {
    var d = isDark();
    return {
      tint: d ? cfg.tintDark : cfg.tintLight,
      tintTone: d ? 'dark' : 'light',
      frost: d ? cfg.frostDark : cfg.frostLight
    };
  }

  function mount() {
    var tabbar = document.querySelector('.app-tabbar');
    if (!tabbar || dockGlass) return false;
    try {
      dockGlass = new LiquidGlass(tabbar, {
        tint: params().tint,
        tintTone: params().tintTone,
        frost: params().frost,
        live: 'auto'
      });
      return true;
    } catch (e) {
      console.warn('[glass-tabbar] init failed:', e);
      return false;
    }
  }

  function apply() {
    if (!dockGlass) return;
    try {
      dockGlass.update(params());
      LiquidGlass.refreshAll();
    } catch (e) {}
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { mount(); apply(); }, 300); });
    } else {
      setTimeout(function () { mount(); apply(); }, 300);
    }
    var mo = new MutationObserver(function () {
      if (mount()) { apply(); mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 9000);
  }

  /* 明暗联动：跟随 <html data-theme>（common.js / preview postMessage 均落到该属性） */
  function watchTheme() {
    try {
      new MutationObserver(apply)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}
  }

  /* preview.html 左侧边栏参数面板：postMessage 下发（与 engchain:theme 同通道） */
  function watchMessages() {
    try {
      window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || d.type !== 'engchain:glass-cfg') return;
        var next = {};
        Object.keys(DEFAULTS).forEach(function (k) {
          next[k] = d[k] !== undefined && d[k] !== null ? clamp(d[k], 0, 1.5) : cfg[k];
        });
        cfg = next;
        saveCfg(cfg);
        apply();
      });
    } catch (e) {}
  }

  /* storage 事件：其他同源窗口（如 preview）写入参数时同步 */
  function watchStorage() {
    try {
      window.addEventListener('storage', function (e) {
        if (e.key !== CFG_KEY) return;
        cfg = loadCfg();
        apply();
      });
    } catch (e) {}
  }

  /* 对外 API */
  window.LG_TABBAR = {
    getCfg: function () { return JSON.parse(JSON.stringify(cfg)); },
    setCfg: function (next) {
      var merged = {};
      Object.keys(DEFAULTS).forEach(function (k) {
        merged[k] = (next && next[k] !== undefined && next[k] !== null) ? clamp(next[k], 0, 1.5) : cfg[k];
      });
      cfg = merged;
      saveCfg(cfg);
      apply();
    },
    isSupported: function () { return LiquidGlass.isSupported(); }
  };

  boot();
  watchTheme();
  watchMessages();
  watchStorage();
})();
