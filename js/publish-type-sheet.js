/* ================================================================
 * publish-type-sheet.js — 「切换发布类型」自下而上底部弹窗（bottom sheet）
 * 被详细类 editor.html、简要类 brief-editor.html 复用，替代整页跳转 choose.html。
 *
 * 设计口径（2026-10-15 与用户确认）：
 *   - 仅用于提交页顶部类型卡「更换类型」：在当前页原地弹出，不离开页面层级；
 *   - 复用 publish-types.js 的 16 类注册表 / 当前身份可发类型 / 编辑器路由，
 *     与 choose.html 的分组、供需要、权限锁定、认证引导保持一致；
 *   - 选中一个【与当前不同且可发布】的类型后直接切换，不做二次确认
 *     （切换必然进入另一种空白提交页，不存在编辑内容复用）；
 *   - 是否保存草稿由调用方决定：本组件只产出目标 href，editor 在 onPick 中
 *     主动取消自动保存定时器并丢弃本次未手动存草稿的自动草稿后再跳转。
 *
 * 依赖（两页面均已引入）：common.js(UI) / stores.js / databus.js(entryAccess) /
 *                        publish-types.js(PUBLISH_TYPES/availableTypesByAccount/publishTypeHref)
 *
 * 用法：
 *   PublishTypeSheet.open({
 *     current: 'material-supply',          // 当前 typeKey，用于标记“当前”并禁用该项
 *     onPick: function(href, key){ ... }   // 可选；默认 location.href = href
 *   });
 * ================================================================ */
(function (global) {
  'use strict';

  var GROUPS = [
    { name: '材料', keys: ['material-supply', 'material-demand'] },
    { name: '设备', keys: ['equipment-supply', 'equipment-demand'] },
    { name: '劳务', keys: ['labor-supply', 'labor-demand'] },
    { name: '运输', keys: ['transport-supply', 'transport-demand'] },
    { name: '建筑企业', keys: ['franchise-supply', 'franchise-demand', 'trade-supply', 'trade-demand'] },
    { name: '人才', keys: ['personnel-demand', 'talent-supply'] },
    { name: '中介服务', keys: ['agency-supply', 'agency-demand'] }
  ];

  var SVG = {
    demand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    supply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 2-1.73z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 一次性注入样式（局部色板，兼容暗色，不依赖具体页面变量） */
  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css = ''
      + '.pts-mask{position:fixed;inset:0;z-index:99990;background:rgba(20,15,8,.46);opacity:0;transition:opacity .24s ease;-webkit-tap-highlight-color:transparent;}'
      + '.pts-mask.pts-show{opacity:1;}'
      + '.pts-sheet{position:fixed;left:0;right:0;bottom:0;z-index:99991;max-height:84vh;display:flex;flex-direction:column;'
      + 'background:#FBFAF7;border-radius:20px 20px 0 0;box-shadow:0 -12px 40px rgba(20,15,8,.22);'
      + 'transform:translateY(102%);transition:transform .28s cubic-bezier(.22,.61,.36,1);padding-bottom:env(safe-area-inset-bottom);}'
      + '.pts-sheet.pts-show{transform:translateY(0);}'
      + '.pts-grab{flex:none;width:38px;height:4px;border-radius:99px;background:rgba(38,30,18,.18);margin:9px auto 2px;}'
      + '.pts-hd{flex:none;display:flex;align-items:flex-start;gap:10px;padding:8px 16px 10px;}'
      + '.pts-hd .pts-ti{flex:1;min-width:0;}'
      + '.pts-hd b{display:block;font-size:16px;font-weight:800;color:#26201A;letter-spacing:.01em;}'
      + '.pts-hd .pts-sub{display:block;margin-top:3px;font-size:11px;line-height:1.5;color:rgba(38,30,18,.58);}'
      + '.pts-x{flex:none;width:30px;height:30px;border-radius:99px;border:1px solid rgba(38,30,18,.12);background:#fff;color:rgba(38,30,18,.6);display:flex;align-items:center;justify-content:center;cursor:pointer;}'
      + '.pts-x svg{width:15px;height:15px;}'
      + '.pts-bd{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px 14px 14px;}'
      + '.pts-grp{margin-top:12px;}'
      + '.pts-gh{display:flex;align-items:center;gap:7px;margin:0 2px 7px;}'
      + '.pts-gh i{flex:none;width:21px;height:21px;border-radius:7px;background:rgba(138,106,40,.12);color:#7A5C1E;font-style:normal;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;}'
      + '.pts-gh b{font-size:13px;font-weight:700;color:#26201A;}'
      + '.pts-gh span{font-size:10px;color:rgba(38,30,18,.42);}'
      + '.pts-row{position:relative;display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;margin-bottom:7px;border-radius:13px;background:#fff;border:1px solid rgba(38,30,18,.09);cursor:pointer;transition:transform .12s;}'
      + '.pts-row:active{transform:scale(.985);}'
      + '.pts-ic{flex:none;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;}'
      + '.pts-ic svg{width:16px;height:16px;}'
      + '.pts-ic.supply{background:rgba(138,106,40,.12);color:#7A5C1E;}'
      + '.pts-ic.demand{background:rgba(43,107,79,.1);color:#2B6B4F;}'
      + '.pts-main{flex:1;min-width:0;}'
      + '.pts-main b{display:block;font-size:13.5px;font-weight:700;color:#26201A;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.pts-main span{display:block;margin-top:2px;font-size:10.5px;color:rgba(38,30,18,.45);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.pts-badge{flex:none;font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:99px;}'
      + '.pts-badge.supply{color:#7A5C1E;background:rgba(138,106,40,.12);}'
      + '.pts-badge.demand{color:#2B6B4F;background:rgba(43,107,79,.1);}'
      + '.pts-badge.cur{color:#2B6B4F;background:rgba(43,107,79,.12);display:inline-flex;align-items:center;gap:3px;}'
      + '.pts-badge.cur svg{width:11px;height:11px;}'
      + '.pts-badge.lock{color:#8A5A2A;background:rgba(138,90,42,.1);border:1px dashed rgba(138,90,42,.34);display:inline-flex;align-items:center;gap:3px;}'
      + '.pts-badge.lock svg{width:11px;height:11px;}'
      + '.pts-row.is-current{border-color:rgba(43,107,79,.35);background:rgba(43,107,79,.05);cursor:default;}'
      + '.pts-row.is-locked{opacity:.62;}'
      + '.pts-row.is-locked .pts-main b{color:rgba(38,30,18,.45);}'
      + '.pts-row.is-locked .pts-ic{background:#EFECE3;color:rgba(38,30,18,.4);}'
      + 'html[data-theme="dark"] .pts-sheet{background:#211D18;box-shadow:0 -12px 40px rgba(0,0,0,.5);}'
      + 'html[data-theme="dark"] .pts-hd b{color:#F4F0E9;}'
      + 'html[data-theme="dark"] .pts-hd .pts-sub{color:rgba(244,240,233,.6);}'
      + 'html[data-theme="dark"] .pts-x{background:#2A251E;border-color:rgba(244,240,233,.16);color:rgba(244,240,233,.7);}'
      + 'html[data-theme="dark"] .pts-grab{background:rgba(244,240,233,.2);}'
      + 'html[data-theme="dark"] .pts-gh b{color:#F4F0E9;}'
      + 'html[data-theme="dark"] .pts-gh span{color:rgba(244,240,233,.45);}'
      + 'html[data-theme="dark"] .pts-gh i{background:rgba(201,164,92,.16);color:#C9A45C;}'
      + 'html[data-theme="dark"] .pts-row{background:#2A251E;border-color:rgba(244,240,233,.1);}'
      + 'html[data-theme="dark"] .pts-main b{color:#F4F0E9;}'
      + 'html[data-theme="dark"] .pts-main span{color:rgba(244,240,233,.45);}'
      + 'html[data-theme="dark"] .pts-row.is-current{border-color:rgba(111,184,154,.4);background:rgba(111,184,154,.08);}'
      + 'html[data-theme="dark"] .pts-ic.supply{background:rgba(201,164,92,.16);color:#C9A45C;}'
      + 'html[data-theme="dark"] .pts-badge.supply{color:#C9A45C;background:rgba(201,164,92,.16);}'
      + 'html[data-theme="dark"] .pts-lock-ic{color:rgba(244,240,233,.5);}';
    var st = document.createElement('style');
    st.setAttribute('data-pts', '1');
    st.textContent = css;
    document.head.appendChild(st);
  }

  function getAccount() {
    try { return global.entryAccess ? global.entryAccess() : null; } catch (e) { return null; }
  }
  function authState() {
    var st = (global.UI && global.UI.state) ? global.UI.state.get() : {};
    var loggedIn = !!(st.loggedIn && st.status !== 'guest');
    var auth = (global.AuthStore && global.AuthStore.read) ? global.AuthStore.read() : {};
    var realname = !!(auth.realname && auth.realname.ok);
    return { loggedIn: loggedIn, realname: realname };
  }
  function lockReason(t, au) {
    if (!au.loggedIn) return '需登录';
    if (!au.realname) return '需实名';
    if (t.detailLevel === 'detail') return '需企业认证';
    if (t.cat === '求职') return '需专业入驻';
    return '需认证';
  }

  var openSheet = null;

  function close() {
    if (!openSheet) return;
    var mask = openSheet.mask, panel = openSheet.panel;
    mask.classList.remove('pts-show');
    panel.classList.remove('pts-show');
    var ref = openSheet;
    openSheet = null;
    setTimeout(function () {
      if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    }, 300);
    document.removeEventListener('keydown', ref.onKey, true);
  }

  function open(opts) {
    opts = opts || {};
    if (openSheet) close();
    injectStyle();

    var PT = global.PUBLISH_TYPES || {};
    var current = opts.current || '';
    var allowed = {};
    try { (global.availableTypesByAccount(getAccount()) || []).forEach(function (k) { allowed[k] = true; }); } catch (e) {}
    var au = authState();

    var mask = document.createElement('div');
    mask.className = 'pts-mask';
    var panel = document.createElement('div');
    panel.className = 'pts-sheet';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', '切换发布类型');

    var rowsHtml = '';
    GROUPS.forEach(function (g) {
      var inner = '';
      g.keys.forEach(function (k) {
        var t = PT[k];
        if (!t || t.hide) return;
        var isCur = (k === current);
        var locked = !allowed[k] && !isCur;
        var side = t.role === 'supply' ? 'supply' : 'demand';
        var badge;
        if (isCur) badge = '<span class="pts-badge cur">' + SVG.check + '当前</span>';
        else if (locked) badge = '<span class="pts-badge lock">' + SVG.lock + esc(lockReason(t, au)) + '</span>';
        else badge = '<span class="pts-badge ' + side + '">' + (side === 'supply' ? '供' : '需') + '</span>';
        inner += '<button type="button" class="pts-row' + (isCur ? ' is-current' : '') + (locked ? ' is-locked' : '') + '"'
          + ' data-key="' + esc(k) + '" data-locked="' + (locked ? '1' : '0') + '"' + (isCur ? ' disabled' : '') + '>'
          + '<span class="pts-ic ' + side + '">' + SVG[side] + '</span>'
          + '<span class="pts-main"><b>' + esc(t.guideLabel || t.label) + '</b><span>' + esc(t.guideSub || t.sub) + '</span></span>'
          + badge + '</button>';
      });
      if (inner) rowsHtml += '<div class="pts-grp"><div class="pts-gh"><i>' + esc(g.name.charAt(0)) + '</i><b>' + esc(g.name) + '</b><span>' + g.keys.length + ' 类</span></div>' + inner + '</div>';
    });

    panel.innerHTML = ''
      + '<div class="pts-grab"></div>'
      + '<div class="pts-hd"><div class="pts-ti"><b>切换发布类型</b>'
      + '<span class="pts-sub">选择后进入该类型的全新表单；当前未点「存草稿」的内容不会保留、也不会自动保存。</span></div>'
      + '<button type="button" class="pts-x" aria-label="关闭">' + SVG.close + '</button></div>'
      + '<div class="pts-bd">' + rowsHtml + '</div>';

    document.body.appendChild(mask);
    document.body.appendChild(panel);

    var sheet = { mask: mask, panel: panel, onKey: function (e) { if (e.key === 'Escape') close(); } };
    openSheet = sheet;
    document.addEventListener('keydown', sheet.onKey, true);

    requestAnimationFrame(function () {
      mask.classList.add('pts-show');
      panel.classList.add('pts-show');
    });

    mask.addEventListener('click', close);
    panel.querySelector('.pts-x').addEventListener('click', close);

    panel.addEventListener('click', function (ev) {
      var row = ev.target.closest('.pts-row');
      if (!row || row.disabled) return;
      var k = row.getAttribute('data-key');
      var t = PT[k];
      if (!t) return;

      if (row.getAttribute('data-locked') === '1') {
        var reason = lockReason(t, au);
        if (global.UI && UI.toast) UI.toast('「' + reason + '」后方可发布', 'warn');
        setTimeout(function () {
          global.location.href = !au.loggedIn ? '../auth/login.html'
            : (!au.realname ? '../profile/auth-personal.html' : '../profile/auth.html');
        }, 420);
        return;
      }
      if (k === current) { close(); return; }

      /* 目标编辑器 URL：复用统一路由，并标记 fresh=1 —— 目标页以全新空白表单起步，不弹自动草稿恢复 */
      var href = global.publishTypeHref(k);
      href += (href.indexOf('?') >= 0 ? '&' : '?') + 'fresh=1';
      close();
      if (typeof opts.onPick === 'function') {
        var ret = opts.onPick(href, k);
        if (ret === false) return; /* 调用方自行接管导航 */
      }
      global.location.href = href;
    });
  }

  global.PublishTypeSheet = { open: open, close: close };
})(window);
