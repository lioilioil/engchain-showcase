/* ============================================================================
   preview-sheet.js — 站内页面预览弹窗（自下而上 + 放大至全屏 + 关闭）
   ----------------------------------------------------------------------------
   供消息页（通知分页跳转）、会话页（正在对接的订单条 / 富交互卡片动作）共用：
   - 弹窗执行 app demo 已有 bottom-sheet 交互规则（UI.sheet：拖拽 / 遮罩关闭 /
     右上角关闭 / 脚部置底）
   - 右上角关闭键左侧为「放大至全屏」icon，点击后先播完退场动画再完整打开该页面
   - 站内相对链接用 iframe 预览，并净化 app demo 外壳（状态栏 / 灵动岛 /
     Pura 侧边栏 / 底部导航 / 页头），只呈现页面主体；外部链接不拦截直接打开
   - file:// 等跨源环境无法直写 iframe 子文档时，经 postMessage 通知子页面
     common.js 进入精简模式（html.engchain-preview）兜底，多档延迟重发确保到达
   ============================================================================ */
(function () {
  if (window.__pagePreviewInited) return;
  window.__pagePreviewInited = true;

  /* 公共样式（幂等注入，与消息页原内联样式一致） */
  function injectStyle() {
    if (!document.head || document.getElementById('engchain-preview-sheet-style')) return;
    var st = document.createElement('style');
    st.id = 'engchain-preview-sheet-style';
    st.textContent =
      '.sheet.notice-preview-sheet{height:80vh;}' +
      '.sheet.notice-preview-sheet .sheet-body{padding:0;display:flex;min-height:0;position:relative;}' +
      '.notice-preview-frame{flex:1;width:100%;height:100%;border:none;background:var(--bg);display:block;opacity:0;transition:opacity .28s ease;}' +
      '.notice-preview-frame.np-loaded{opacity:1;}' +
      '.np-loading{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);font-size:12px;background:var(--bg);transition:opacity .28s ease;}' +
      '.np-loading.np-done{opacity:0;pointer-events:none;}' +
      '.np-spin{width:26px;height:26px;border-radius:50%;border:2.5px solid var(--line-strong);border-top-color:var(--primary-dim);animation:np-spin .8s linear infinite;}' +
      '@keyframes np-spin{to{transform:rotate(360deg);}}' +
      '.np-error{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--text-3);font-size:12.5px;background:var(--bg);padding:24px;text-align:center;}' +
      '.np-err-ic{width:44px;height:44px;border-radius:50%;background:var(--bg-card-2);display:flex;align-items:center;justify-content:center;color:var(--text-3);}' +
      '.np-err-ic svg{width:20px;height:20px;}' +
      '.np-err-txt{line-height:1.6;}' +
      '.sheet-head-actions{display:flex;align-items:center;gap:8px;flex:none;}' +
      '.sheet-expand{flex:none;}';
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyle);
  } else {
    injectStyle();
  }

  function jsq(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"'); }

  /* 预览净化样式：iframe 内仅保留页面主体内容，隐藏 app demo 外壳
     （状态栏 / 灵动岛 / 侧边栏 / 底部导航 / 页头），避免「壳套壳」。
     只注入到 iframe 子文档，顶层正常浏览不受影响。 */
  var PREVIEW_CLEAN_CSS =
    '.status-bar, .dynamic-island, .pura-sidebar, .ps-expand-handle, .app-nav-shell, .app-tabbar, .page-progress{display:none!important;}' +
    '.navbar, .page-header, .topbar{display:none!important;}' +
    '.phone{height:100%!important;max-height:100%!important;}' +
    '.pura-content{margin-left:0!important;padding-top:0!important;width:100%!important;height:100%!important;transform:none!important;transform-origin:initial!important;}';

  function fallbackPreviewMode(win) {
    try { if (win) win.postMessage({ type: 'engchain:preview-mode' }, '*'); } catch (e) {}
  }
  function cleanPreviewShell(doc, win) {
    /* 同源（HTTP 服务等）：直写 iframe 子文档，加载即净化，无闪烁 */
    try {
      if (doc && doc.head) {
        if (doc.getElementById('engchain-preview-clean')) return;
        var st = doc.createElement('style');
        st.id = 'engchain-preview-clean';
        st.textContent = PREVIEW_CLEAN_CSS;
        doc.head.appendChild(st);
        return;
      }
    } catch (e) { /* 落入下方兜底 */ }
    /* 跨源（file:// 下 contentDocument 为 null 或访问抛错）：
       由子页面 common.js 的 engchain:preview-mode 监听加精简类兜底；
       file:// 冷加载时子页监听注册与父页 load 存在时序竞态，多档延迟重发确保到达 */
    fallbackPreviewMode(win);
    setTimeout(function () { fallbackPreviewMode(win); }, 300);
    setTimeout(function () { fallbackPreviewMode(win); }, 1200);
  }

  window.openPagePreview = function (href, label) {
    if (!href || href === '#') return;
    /* 外部链接不适合 iframe 预览：不拦截，直接完整打开 */
    if (/^(https?:|javascript:|mailto:|tel:)/i.test(href)) { location.href = href; return; }
    /* 若已有弹窗（推荐列表 / 通知详情 / 会话菜单等）先收起，再开预览 */
    if (window.UI && UI.closeSheet) UI.closeSheet();
    /* 解析为绝对地址：iframe 预览与全屏跳转共用同一目标，不受 base 元素干扰 */
    var url;
    try { url = new URL(href, document.baseURI).href; } catch (e) { url = href; }
    var sh = UI.sheet();
    /* 加 sheet-expanded：拖拽逻辑将其识别为已展开态（80vh），下拉回弹/快甩收起与其他满屏 sheet 一致 */
    sh.classList.add('notice-preview-sheet', 'sheet-expanded');
    sh.setText(label || '页面预览');
    var body = sh.body();
    function buildFrame() {
      body.innerHTML = '<div class="np-loading"><span class="np-spin"></span><span class="np-txt">正在加载…</span></div>';
      var frame = document.createElement('iframe');
      frame.className = 'notice-preview-frame';
      frame.src = url;
      frame.title = label || '页面预览';
      body.appendChild(frame);
      frame.addEventListener('load', function () {
        cleanPreviewShell(frame.contentDocument, frame.contentWindow);
        frame.classList.add('np-loaded');
        var ld = body.querySelector('.np-loading');
        if (ld) { ld.classList.add('np-done'); setTimeout(function () { if (ld && ld.parentNode) ld.parentNode.removeChild(ld); }, 280); }
      });
      frame.addEventListener('error', function () {
        body.innerHTML = '<div class="np-error">' +
          '<div class="np-err-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg></div>' +
          '<div class="np-err-txt">页面加载失败，请检查网络后重试</div>' +
          '<button type="button" class="n-btn primary" id="np-retry">重试</button></div>';
        var retry = body.querySelector('#np-retry');
        if (retry) retry.addEventListener('click', buildFrame);
      });
    }
    buildFrame();
    var head = sh.querySelector('.sheet-head');
    var closeBtn = head ? head.querySelector('.sheet-close') : null;
    var expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'icon-btn sheet-expand';
    expandBtn.setAttribute('aria-label', '全屏打开');
    expandBtn.title = '全屏打开';
    expandBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
    expandBtn.addEventListener('click', function () {
      UI.closeSheet();
      /* 先播完弹窗退场动画（约 0.3s）再跳转，避免关闭动效被截断、页面生硬切换 */
      setTimeout(function () { location.href = url; }, 280);
    });
    if (head && closeBtn) {
      /* sheet-head 为 space-between 布局，两个图标需包进同一按钮组，
         否则会被 flex 空隙拆散（放大键远离关闭键） */
      var grp = document.createElement('div');
      grp.className = 'sheet-head-actions';
      head.insertBefore(grp, closeBtn);
      grp.appendChild(expandBtn);
      grp.appendChild(closeBtn);
    }
    sh.show();
  };
  /* 消息页沿用原函数名（页面 onclick 与内部调用不变） */
  window.openNoticePreview = window.openPagePreview;
})();
