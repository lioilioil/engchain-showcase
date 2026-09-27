/*!
 * thinking-orb.js — AI 球 Canvas 动画引擎（占位空实现 / defensive no-op shim）
 * -----------------------------------------------------------------------------
 * 历史原因：js/common.js 的 UI.ensureThinkingOrb() 会按需动态加载本文件，
 * 但引擎资源此前未随演示工程提供，导致每个包含悬浮 AI 球的页面产生一次
 * /js/thinking-orb.js 404（console error）。
 *
 * 在真正的动画引擎接入前，本文件提供“静默降级”实现：
 *   - 定义 window.ThinkingOrb，使 ensureThinkingOrb 的 onload 正常触发；
 *   - initAll / init / destroy / on / refresh 等均为 no-op；
 *   - 页面内 AI 球容器保持其静态 HTML 外观（与“文件 404、回调不执行”时的现状完全一致）。
 * 当真实引擎就位时，直接整体替换本文件即可，无需改动调用方。
 */
(function () {
  if (window.ThinkingOrb) return;
  function noop() {}
  window.ThinkingOrb = {
    initAll: noop,
    init: noop,
    mount: noop,
    destroy: noop,
    destroyAll: noop,
    refresh: noop,
    on: noop,
    off: noop,
    setTheme: noop,
    __shim: true
  };
  try { window.dispatchEvent(new CustomEvent('engchain:thinking-orb-ready')); } catch (e) {}
})();
