/* ============================================================================
   GEO 驾驶舱 · 弹窗宿主帮助器 geo-sheet.js（零新增 CSS，复用 UI.sheet 与
   app.css 既有 html.engchain-preview 精简规则）
   ----------------------------------------------------------------------------
   两层自动分派：
   - 顶层窗口（index.html 宿主）：window.GEOSHEET
       open(src,label) / navigate(src) / back() / close() / exitTo(url) /
       setTitle(t) / _stack
   - iframe 内（audit/optimize/knowledge/pricing）：
       GEOEXIT(url) / GEOCLOSE() / GEOBACK() / GEO_TITLE(t)
     postMessage 通知宿主；独立直链（顶层）时自动回退原生行为。
   ============================================================================ */
(function () {
  if (window.__GEOSHEET__) return;
  window.__GEOSHEET__ = true;

  var inFrame = (window.self !== window.top);

  /* ================= 子页桥接（iframe 内 postMessage；顶层回退原生） ================= */
  function post(msg) {
    try { window.parent.postMessage(msg, '*'); } catch (e) {}
  }
  /* 退出弹窗并整页跳转 url（brands.html / report.html）；顶层直接跳转 */
  window.GEOEXIT = function (url) {
    if (!url) return;
    if (inFrame) post({ type: 'geo-sheet:exit', url: url });
    else location.href = url;
  };
  /* 关闭弹窗回驾驶舱（宿主即 index）；顶层静默（独立直链无可关闭层） */
  window.GEOCLOSE = function () {
    if (inFrame) post({ type: 'geo-sheet:close' });
  };
  /* 弹内返回由宿主弹栈；顶层回退 history.back() */
  window.GEOBACK = function () {
    if (inFrame) post({ type: 'geo-sheet:back' });
    else if (window.history && history.length > 1) history.back();
  };
  /* 链式跳转后更新 sheet 标题；顶层无操作 */
  window.GEO_TITLE = function (t) {
    if (inFrame && t) post({ type: 'geo-sheet:title', title: t });
  };

  /* ================= 宿主层（仅顶层窗口执行） ================= */
  if (inFrame) return;

  var sheet = null;
  var frame = null;
  var stack = [];
  var suppressRecord = false;

  /* 复用 app.css html.engchain-preview：隐藏 frame 内 navbar、.phone 撑满；
     不复制任何预览清理样式块。跨源不可直写时回退 common.js 既有消息协议。 */
  function applyPreview(doc) {
    try {
      if (doc && doc.documentElement) {
        doc.documentElement.classList.add('engchain-preview');
      }
    } catch (e) {
      try { window.postMessage({ type: 'engchain:preview-mode' }, '*'); } catch (_) {}
    }
  }

  function recordLoad() {
    if (!frame) return;
    if (suppressRecord) { suppressRecord = false; return; }
    try {
      var href = frame.contentWindow.location.href;
      if (stack[stack.length - 1] !== href) stack.push(href);
    } catch (e) {}
  }

  function goSrc(src) {
    suppressRecord = true;
    frame.src = src;
  }

  function open(src, label) {
    /* 先关闭既有 sheet，防叠加 */
    if (window.UI && typeof UI.closeSheet === 'function') UI.closeSheet();
    sheet = null; frame = null;
    stack.length = 0;

    sheet = UI.sheet();
    if (label) sheet.setText(label);
    /* 进入既有展开态（80vh），让 iframe 100% 高度有确定参照；不新增样式 */
    sheet.classList.add('sheet-expanded');
    sheet.style.height = Math.round((window.innerHeight || 800) * 0.8) + 'px';

    var body = sheet.body();
    body.innerHTML = '';
    frame = document.createElement('iframe');
    frame.setAttribute('title', label || 'GEO 详情');
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = 'none';
    frame.style.background = 'var(--bg)';
    frame.addEventListener('load', function () {
      applyPreview(frame.contentDocument);
      recordLoad();
    });
    body.appendChild(frame);
    suppressRecord = false;
    frame.src = src;
    sheet.show();
  }

  /* 同 sheet 内替换 src（链内前进），入栈 */
  function navigate(src) {
    if (!sheet || !frame) { open(src); return; }
    stack.push(src);
    goSrc(src);
  }

  /* 弹内栈回退；栈空则关闭 */
  function back() {
    if (stack.length > 1) {
      stack.pop();
      var prev = stack[stack.length - 1];
      if (frame) goSrc(prev);
    } else {
      close();
    }
  }

  function close() {
    if (window.UI && typeof UI.closeSheet === 'function') UI.closeSheet();
    sheet = null;
    frame = null;
    stack.length = 0;
  }

  /* 关闭后整页跳转（brands.html / report.html 等顶层目的地） */
  function exitTo(url) {
    close();
    if (url) location.href = url;
  }

  function setTitle(t) {
    if (sheet && t) sheet.setText(t);
  }

  window.GEOSHEET = {
    open: open,
    navigate: navigate,
    back: back,
    close: close,
    exitTo: exitTo,
    setTitle: setTitle,
    _stack: stack
  };

  /* 仅接受当前 frame 发来的消息 */
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d.type !== 'string') return;
    if (frame && e.source !== frame.contentWindow) return;
    switch (d.type) {
      case 'geo-sheet:exit': exitTo(d.url); break;
      case 'geo-sheet:close': close(); break;
      case 'geo-sheet:back': back(); break;
      case 'geo-sheet:title': setTitle(d.title); break;
    }
  });
})();
