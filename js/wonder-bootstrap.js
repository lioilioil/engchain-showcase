/* ============================================================================
   工程链 ENGCHAIN — 惊喜时刻统一引导（路径无关 · 每页仅需引入一次）
   依赖：wonder-engine.js、wonder-popup.js（由各页面按自身相对路径先行引入）
   职责：在内容浏览页启动引擎；详情页自动上报品类/记录用于画像。
   不做任何业务决策，逻辑全部在 wonder-engine.js。
   ============================================================================ */
(function (w) {
  'use strict';
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    if (!w.WonderEngine || !w.WonderPopup || typeof WonderEngine.boot !== 'function') return;
    var ok = WonderEngine.boot();
    if (!ok) return; /* 配置关闭或当前场景不在白名单（事务页不启动） */

    /* 详情页：上报品类 + 记录，作为意图画像信号（trackDetail 自带活跃心跳） */
    var cat = '', id = '';
    try {
      var p = new URLSearchParams(location.search);
      id = p.get('id') || '';
      cat = p.get('cat') || '';
      if (!cat && document.body) cat = document.body.getAttribute('data-cat') || '';
      /* detail.html 的 rec 在 IIFE 内部（非全局），用 MOCK.listingById 自行查询品类；
         覆盖官方数据（用户自发布记录查不到时回退 URL/body 信号，画像尽力而为） */
      if (!cat && id && w.MOCK && typeof MOCK.listingById === 'function') {
        try { var r0 = MOCK.listingById(id); if (r0) cat = r0.cat || r0.category || ''; } catch (e) {}
      }
      if (!cat && w.rec) cat = w.rec.cat || w.rec.category || '';
      if (!id && w.rec && w.rec.id != null) id = String(w.rec.id);
    } catch (e) {}

    if (cat || id) {
      WonderEngine.track({ type: 'detail', cat: cat, id: id, href: location.pathname + location.search });
    }
  });
})(window);
