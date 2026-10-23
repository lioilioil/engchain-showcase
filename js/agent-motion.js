/* ============================================================================
   js/agent-motion.js —— UI2 slow-push 动效入口（静态页轻量版）
   ----------------------------------------------------------------------------
   与 agent-ui.js 内 agAnimate 同源实现：卡片 stagger 入场 + hero 数字 count-up。
   静态页（data-center/network/rules/recruit/apply/tax-guide/badge）引用本文件，
   DOMContentLoaded 后自动执行；prefers-reduced-motion 降级为瞬时。
   只做视觉层，不触碰费率/税算/门控/数据结构。
   ============================================================================ */
(function (root) {
  'use strict';
  if (!root.document) return;

  function prefersReduced() {
    try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function rise(scope) {
    if (prefersReduced()) return;
    var cards = (scope || root.document).querySelectorAll('.ag-card');
    cards.forEach(function (el, i) {
      if (i <= 6) el.style.animationDelay = (i * 55) + 'ms';
    });
  }

  function countUp(scope) {
    if (prefersReduced()) return;
    var els = (scope || root.document).querySelectorAll('.ag-big');
    els.forEach(function (el) {
      if (el.dataset.agCounted) return;
      el.dataset.agCounted = '1';
      var txt = el.textContent, m = txt.match(/([\d,]+(?:\.\d+)?)/);
      if (!m) return;
      var target = parseFloat(m[1].replace(/,/g, ''));
      var dec = (m[1].split('.')[1] || '').length;
      var dur = 560, t0 = null;
      function fmtv(v) { return v.toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = txt.replace(m[1], fmtv(target * e));
        if (p < 1) root.requestAnimationFrame(step);
      }
      root.requestAnimationFrame(step);
    });
  }

  function animate(scope) { rise(scope); countUp(scope); }

  root.AgentMotion = { animate: animate };

  if (root.document.readyState !== 'loading') {
    root.requestAnimationFrame(function () { animate(root.document); });
  } else {
    root.document.addEventListener('DOMContentLoaded', function () { animate(root.document); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
