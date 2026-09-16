/* ============================================================================
   ENGCHAIN 全局「回到顶部」玻璃按钮（BackToTop）
   视觉规则：
   - 页面下滑超过 2 个窗口高度时，窗口下方居中渐显圆形玻璃按钮（中心为 SVG 上箭头）
   - 点击按钮 → 页面平滑滚动置顶
   - 页面回到 2 个窗口高度以内时，按钮下滑渐变消失
   兼容：
   - 手机壳 demo（.phone 内滚动容器）：按钮挂载到 .phone 内，fixed 相对 .phone（transform 创建包含块），
     随手机壳等比缩放，位于窗口底部居中，自动避开底部 tabbar / fixed-cta / 操作栏
   - admin 后台 / preview / 独立页（无 .phone）：按钮挂载 body，fixed 相对视口底部居中，
     滚动容器自动检测（.pv-scroll / 页面可滚动元素 / window）
   用法：任意页面直接 <script src="js/back-to-top.js"></script>；
        common.js 已自动加载本文件（幂等，重复加载无害）。
   ============================================================================ */
(function () {
  'use strict';
  if (window.EngchainBackTop) return;   /* 幂等：同一页面只初始化一次 */
  window.EngchainBackTop = true;

  /* ---------- 样式（幂等注入） ---------- */
  var STYLE_ID = 'engchain-backtop-style';
  var CSS = [
    '.engchain-backtop{',
    '  position: fixed;',
    '  left: 50%;',
    '  z-index: 60;',
    '  width: 52px; height: 52px;',
    '  border-radius: 50%;',
    '  display: flex; align-items: center; justify-content: center;',
    '  cursor: pointer;',
    '  padding: 0; border: 0; outline: none;',
    '  -webkit-tap-highlight-color: transparent;',
    '  background: linear-gradient(135deg, rgba(255,255,255,.78), rgba(255,255,255,.30));',
    '  -webkit-backdrop-filter: blur(20px) saturate(180%);',
    '  backdrop-filter: blur(20px) saturate(180%);',
    '  border: 1px solid rgba(255,255,255,.60);',
    '  box-shadow: 0 10px 28px rgba(24,22,16,.18), inset 0 1px 0 rgba(255,255,255,.90), inset 0 -1px 0 rgba(255,255,255,.18);',
    '  color: var(--text-1, #3A3630);',
    '  opacity: 0;',
    '  transform: translate(-50%, 30px) scale(.92);',
    '  pointer-events: none;',
    '  transition: opacity .42s cubic-bezier(.4,0,.2,1), transform .42s cubic-bezier(.2,.8,.3,1);',
    '}',
    '.engchain-backtop svg { width: 22px; height: 22px; display: block; }',
    '.engchain-backtop.is-show {',
    '  opacity: 1;',
    '  transform: translate(-50%, 0) scale(1);',
    '  pointer-events: auto;',
    '}',
    '.engchain-backtop:hover {',
    '  background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(255,255,255,.46));',
    '}',
    '.engchain-backtop:active { transform: translate(-50%, 0) scale(.94); }',
    '.engchain-backtop:focus-visible { box-shadow: 0 0 0 3px rgba(37,99,235,.35), 0 10px 28px rgba(24,22,16,.18); }',
    '[data-theme="dark"] .engchain-backtop {',
    '  border-color: rgba(255,255,255,.16);',
    '  background: linear-gradient(135deg, rgba(58,58,66,.74), rgba(40,40,48,.32));',
    '  box-shadow: 0 10px 28px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.16), inset 0 -1px 0 rgba(255,255,255,.06);',
    '  color: rgba(255,255,255,.92);',
    '}',
    '[data-theme="dark"] .engchain-backtop:hover {',
    '  background: linear-gradient(135deg, rgba(72,72,82,.82), rgba(50,50,60,.42));',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  .engchain-backtop { transition: opacity .15s linear, transform .15s linear; }',
    '}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- 滚动容器检测 ---------- */
  /* 在 root 内找第一个真正可滚动的容器（overflow auto/scroll 且内容溢出） */
  function findScrollable(root) {
    if (!root) return null;
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var cs;
      try { cs = window.getComputedStyle(el); } catch (e) { continue; }
      var oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2) {
        return el;
      }
    }
    return null;
  }

  /* ---------- 初始化 ---------- */
  function init() {
    if (document.querySelector('.engchain-backtop')) return;

    var phone = document.querySelector('.phone');
    var host, scroller;

    if (phone) {
      /* 手机壳 demo：挂到 .phone 内，fixed 相对 .phone 定位 */
      host = phone;
      var inner = findScrollable(phone);
      scroller = inner || phone.querySelector('.scroll') || phone;
    } else {
      /* 无 .phone：挂 body，fixed 相对视口 */
      host = document.body;
      var pv = document.querySelector('.pv-scroll');
      if (pv && pv.scrollHeight > pv.clientHeight + 2) {
        scroller = pv;
      } else if (document.scrollingElement && document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 2) {
        scroller = window;
      } else {
        scroller = findScrollable(document.body) || window;
      }
    }

    /* 创建按钮：圆形玻璃 + 居中 SVG 上箭头 */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'engchain-backtop';
    btn.setAttribute('aria-label', '回到顶部');
    btn.setAttribute('tabindex', '0');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6"/><path d="m5.5 12.5 6.5-6.5 6.5 6.5"/></svg>';
    host.appendChild(btn);

    /* 底部位置：自动避开底部固定栏（tabbar / fixed-cta / detail-actionbar / 输入条） */
    function measureBottom() {
      var sels = ['.app-nav-shell', '.app-tabbar', '.fixed-cta', '.detail-actionbar', '.ai-orb-entry', '.chat-input'];
      var max = 28;
      var hostRect = host.getBoundingClientRect();
      var scale = 1;
      if (host === phone) {
        var tf = window.getComputedStyle(host).transform;
        var m = tf && tf !== 'none' ? /matrix\(([^)]+)\)/.exec(tf) : null;
        if (m) {
          var parts = m[1].split(',');
          scale = parseFloat(parts[3]) || 1;
        }
      }
      for (var i = 0; i < sels.length; i++) {
        var el = host.querySelector(sels[i]);
        if (!el) continue;
        var r = el.getBoundingClientRect();
        if (r.height <= 0) continue;
        var dist = hostRect.bottom - r.top;
        if (dist > max && dist < hostRect.height) max = dist;
      }
      /* 布局坐标 = 视觉坐标 / scale（--fit-scale 缩放下补偿） */
      return (max + 14) / scale;
    }

    function applyBottom() {
      btn.style.bottom = measureBottom() + 'px';
    }
    applyBottom();

    /* 滚动状态 */
    function getTop() {
      if (scroller === window) {
        return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      }
      return scroller.scrollTop;
    }
    function getViewH() {
      if (scroller === window) return window.innerHeight || document.documentElement.clientHeight;
      return scroller.clientHeight;
    }

    var raf = null;
    function update() {
      raf = null;
      var show = getTop() > getViewH() * 2;   /* 下滑超过 2 个窗口高度才显示 */
      btn.classList.toggle('is-show', show);
    }
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }

    (scroller === window ? window : scroller).addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { applyBottom(); update(); });

    /* 内容可能由页面 JS 动态渲染，延迟重测滚动容器与底部位置 */
    setTimeout(function () {
      if (!phone) {
        var pv2 = document.querySelector('.pv-scroll');
        if (pv2 && pv2.scrollHeight > pv2.clientHeight + 2) scroller = pv2;
      }
      applyBottom();
      update();
    }, 300);

    /* 点击 → 平滑置顶 */
    btn.addEventListener('click', function () {
      if (scroller === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        scroller.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    update();
  }

  injectStyle();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
