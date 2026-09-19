/* ============================================================================
   工程链 ENGCHAIN — 游客登录引导统一组件 GuestGate
   依赖：css/guest-gate.css（页面需同时引入）
   判定：页面自行判断游客态后调用 GuestGate.open(opts)
   opts:
     mode     'replace'(清空 .phone 整页替换) | 'overlay'(盖在 .phone 上, 默认)
     auth     true 时使用登录/注册页背景变体
     title    主标题，如「登录后查看钱包」
     note     说明文案
     badge    眉标胶囊文字，默认「游客模式」
     btnText  主按钮文案，默认「去登录」
     btnHref  主按钮跳转，默认 ../auth/login.html
     altText  次链文案（如「返回分销中心 ›」），留空则不渲染
     altHref  次链跳转
     icon     'lock' | 'shield' | 'user' | 'key'，默认 lock
   ========================================================================== */
(function (w) {
  'use strict';

  var ICONS = {
    lock:     '<rect x="4.5" y="11" width="15" height="9.5" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><circle cx="12" cy="15.5" r="1.1"/>',
    shield:   '<path d="M12 3l7 2.5v5.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V5.5L12 3z"/><path d="M9.3 12l2 2 3.4-3.6"/>',
    user:     '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.8-5.6 7-5.6s6.2 1.8 7 5.6"/>',
    users:    '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 20c.6-3.4 3-5 5.5-5s4.9 1.6 5.5 5"/><path d="M15.5 6a3.2 3.2 0 0 1 0 6.2M17.6 15.4c1.5.8 2.5 2.3 2.9 4.6"/>',
    key:      '<circle cx="8" cy="12" r="3.4"/><path d="M11.4 12H21"/><path d="M17 12v3M19.5 12v2"/>',
    list:     '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    edit:     '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>',
    check:    '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.2l2.6 2.6 5-5.4"/>',
    share:    '<circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="6" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="M8.3 10.7l6.9-3.7M8.3 13.3l6.9 3.7"/>',
    image:    '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17l4.5-4.5 3 3L16 12l3 3.5"/>'
  };

  var ARROW = '<svg class="gg-btn-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var TRUST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 2.5v5.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V5.5L12 3z"/><path d="M9.3 12l2 2 3.4-3.6"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function open(opts) {
    var o = opts || {};
    var phone = o.phone || document.querySelector('.phone');
    if (!phone) return null;

    var icon = ICONS[o.icon] || ICONS.lock;
    var badge = o.badge == null ? '游客模式' : o.badge;
    var btnText = o.btnText || '去登录';
    var btnHref = o.btnHref || '../auth/login.html';

    var html = '';
    html += '<div class="gg-bg" aria-hidden="true"></div>';
    html += '<div class="gg-inner">';
    html += '  <div class="gg-orb" aria-hidden="true"><svg class="gg-ic" viewBox="0 0 24 24">' + icon + '</svg></div>';
    if (badge) html += '  <div class="gg-badge">' + esc(badge) + '</div>';
    html += '  <h1 class="gg-title">' + esc(o.title || '登录后查看') + '</h1>';
    if (o.note) html += '  <p class="gg-note">' + esc(o.note) + '</p>';
    html += '  <a class="gg-btn" href="' + esc(btnHref) + '">' + esc(btnText) + ARROW + '</a>';
    if (o.altText) html += '  <a class="gg-alt" href="' + esc(o.altHref || '#') + '">' + esc(o.altText) + '</a>';
    html += '</div>';
    html += '<div class="gg-foot"><span class="gg-trust">' + TRUST + '信息加密传输 · 安全登录</span></div>';

    var el = document.createElement('div');
    var mode = o.mode || 'overlay';
    el.className = 'gg gg--' + (mode === 'replace' ? 'screen' : 'overlay') + (o.auth ? ' gg--auth' : '');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', o.title || '登录引导');
    el.innerHTML = html;

    if (mode === 'replace') {
      phone.innerHTML = '';
      phone.appendChild(el);
    } else {
      // 避免重复注入
      var old = phone.querySelector('.gg--overlay');
      if (old) old.parentNode.removeChild(old);
      phone.appendChild(el);
    }
    return el;
  }

  w.GuestGate = { open: open };
})(window);
