/* ============================================================================
   ChatSheet v2.0 — 会话消息页嵌入弹窗（「联系TA」）
   ----------------------------------------------------------------------------
   企业/个人认证主页底部「联系TA」弹窗：
   - 执行 app demo 已有 bottom-sheet 通用交互规则（UI.sheet：顶部横线拖拽
     上拖展开至视口 80% / 下拖回弹或关闭、遮罩点击关闭、右上角关闭、置底按钮）
   - 内容为真实会话消息页 pages/message/chat.html 的 iframe 嵌入，
     与 preview-sheet.js（消息页/会话页页面预览弹窗）的企业嵌入方式一致：
     净化 app demo 外壳（状态栏 / 灵动岛 / 侧边栏 / 底部导航 / 页头），
     只呈现会话主体（上下文条 + 消息 + 输入区），支持全屏展开完整会话页
   - 保留 ChatSheet.open(options) 用法；options.convId 指定会话 id，
     缺省按认证类型映射：企业认证 → c2，个人/其他 → c1
   ============================================================================ */
(function () {
  'use strict';

  function rootOf() {
    try { return window.__ROOT__ || '../../'; } catch (e) { return '../../'; }
  }

  /* 会话 id 缺省映射（与 pages/message/chat.html 的 META 数据对齐） */
  function convIdOf(o) {
    if (o && o.convId) return o.convId;
    var cert = (o && o.cert) || '';
    if (cert.indexOf('企业') > -1) return 'c2';
    return 'c1';
  }

  function convName(id) {
    try {
      var list = (window.MOCK && MOCK.conversations) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i].name;
      }
      return '';
    } catch (e) { return ''; }
  }

  /* 动态补加载 preview-sheet.js（企业嵌入弹窗的基础设施，与消息页/会话页共用） */
  var _previewLoading = false;
  function ensurePreviewSheet(cb) {
    if (window.openPagePreview) { cb(); return; }
    if (_previewLoading) { setTimeout(function () { ensurePreviewSheet(cb); }, 80); return; }
    _previewLoading = true;
    var s = document.createElement('script');
    s.src = rootOf() + 'js/preview-sheet.js';
    s.onload = function () { _previewLoading = false; cb(); };
    s.onerror = function () { _previewLoading = false; cb(); };
    document.head.appendChild(s);
  }

  function open(options) {
    options = options || {};
    var id = convIdOf(options);
    /* 相对地址交由 preview-sheet 按页面 base 解析，兼容 file:// 与 HTTP 服务两种打开方式 */
    var url = '../message/chat.html?id=' + encodeURIComponent(id);
    var label = options.name || convName(id) || '会话消息';
    if (options.cert) label += ' · ' + options.cert;
    ensurePreviewSheet(function () {
      if (window.openPagePreview) { window.openPagePreview(url, label); return; }
      openFallback(url, label);
    });
  }

  /* 极端兜底：preview-sheet.js 加载失败时，仍以 UI.sheet + iframe 嵌入并带通用拖拽规则 */
  var _fbCssId = 'engchain-chatsheet-fallback-css';
  function openFallback(url, label) {
    if (!window.UI || !UI.sheet) return;
    if (!document.getElementById(_fbCssId)) {
      var st = document.createElement('style');
      st.id = _fbCssId;
      st.textContent =
        '.sheet.cs-fb-sheet{height:80vh;}' +
        '.sheet.cs-fb-sheet .sheet-body{padding:0;display:flex;min-height:0;position:relative;overflow:hidden;}' +
        '.cs-fb-frame{flex:1;width:100%;height:100%;border:none;background:var(--bg);display:block;}' +
        '.cs-fb-loading{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--text-3);font-size:12px;background:var(--bg);}' +
        '.cs-fb-spin{width:22px;height:22px;border-radius:50%;border:2.5px solid var(--line-strong);border-top-color:var(--primary-dim);animation:cs-fb-spin .8s linear infinite;}' +
        '@keyframes cs-fb-spin{to{transform:rotate(360deg);}}';
      document.head.appendChild(st);
    }
    var sh = UI.sheet();
    sh.classList.add('cs-fb-sheet', 'sheet-expanded');
    sh.setText(label || '会话消息');
    var body = sh.body();
    var ld = document.createElement('div');
    ld.className = 'cs-fb-loading';
    ld.innerHTML = '<span class="cs-fb-spin"></span><span>正在加载…</span>';
    body.appendChild(ld);
    var frame = document.createElement('iframe');
    frame.className = 'cs-fb-frame';
    frame.src = url;
    frame.title = label || '会话消息';
    body.appendChild(frame);
    frame.addEventListener('load', function () {
      var ok = false;
      try {
        if (frame.contentDocument && frame.contentDocument.head) {
          if (!frame.contentDocument.getElementById('engchain-preview-clean')) {
            var css = '.status-bar,.dynamic-island,.pura-sidebar,.ps-expand-handle,.app-nav-shell,.app-tabbar,.page-progress{display:none!important}.navbar,.page-header,.topbar{display:none!important}.phone{height:100%!important;max-height:100%!important}.pura-content{margin-left:0!important;padding-top:0!important;width:100%!important;height:100%!important;transform:none!important;transform-origin:initial!important}';
            var el = frame.contentDocument.createElement('style');
            el.id = 'engchain-preview-clean';
            el.textContent = css;
            frame.contentDocument.head.appendChild(el);
          }
          ok = true;
        }
      } catch (e) { /* 跨源：走 postMessage 兜底 */ }
      if (!ok) { try { frame.contentWindow.postMessage({ type: 'engchain:preview-mode' }, '*'); } catch (e) {} }
      if (ld && ld.parentNode) ld.parentNode.removeChild(ld);
    });
    sh.show();
  }

  function close() {
    if (window.UI && UI.closeSheet) UI.closeSheet();
  }

  window.ChatSheet = {
    open: open,
    close: close,
    isFull: function () { return false; }
  };
})();
