/* ============================================================================
   工程链 ENGCHAIN · 管理后台 — 共享脚本 admin.js（Phase 1）
   - 三栏骨架：顶栏（brand/面包屑/搜索/主题/账号）+ 侧边部门导航 + 内容区
   - 主题联动：engchain-theme（与 App/preview 同源，storage 事件实时跟随）
   - DataBus：用户表 / 当前登录账号 / 操作日志（后台留痕）
   - 组件：toast / confirm 审批弹窗 / 金额格式化 / 状态徽标
   ============================================================================ */
(function () {
  'use strict';
  if (window.AdminShell) return;
  window.AdminShell = true;

  var LS = window.localStorage;
  /* 相对基准：index.html → ''；子目录页 → '../' */
  var p = location.pathname;
  var m = /\/admin\/([^/]*\.html).*/.exec(p);
  var BASE = (m && m[1]) ? '' : '../';

  /* ---- 部门导航树（页面归属 Phase 见计划 §五） ---- */
  var NAV = [
    { sec: '总览', items: [ { t: '数据总览', f: 'index.html' } ] },
    { sec: '运营中心', items: [
      { t: '供需管理', f: 'operations/supply.html' },
      { t: '订单管理', f: 'operations/orders.html' },
      { t: '消息中心', f: 'operations/messages.html' } ] },
    { sec: '用户与认证', items: [
      { t: '用户管理', f: 'users/users.html' },
      { t: '认证审核', f: 'users/auth-review.html' },
      { t: '入驻审核', f: 'users/entry-review.html' } ] },
    { sec: '资金中心', items: [
      { t: '钱包总览', f: 'finance/wallet.html' },
      { t: '充值 / 对公审批', f: 'finance/recharge.html' },
      { t: '提现审批', f: 'finance/withdraw.html' },
      { t: '积分管理', f: 'finance/credits.html' },
      { t: '佣金结算', f: 'finance/commission.html' },
      { t: '发票管理', f: 'finance/invoice.html' } ] },
    { sec: '分销中心', items: [
      { t: '分销总览', f: 'distribution/overview.html' },
      { t: '团队关系树', f: 'distribution/team.html' },
      { t: '返佣批次发放', f: 'distribution/payout.html' } ] },
    { sec: '中介服务', items: [
      { t: '托管订单', f: 'mediation/orders.html' },
      { t: '服务商管理', f: 'mediation/sellers.html' },
      { t: '托管资金台账', f: 'mediation/escrow.html' } ] },
    { sec: '风控合规', items: [
      { t: '合规审计', f: 'risk/audit.html' },
      { t: '合规管理', f: 'risk/compliance.html' },
      { t: '企业监控', f: 'risk/monitor.html' },
      { t: '操作日志', f: 'risk/logs.html' } ] },
    { sec: '系统设置', items: [
      { t: '定价配置', f: 'system/pricing.html' },
      { t: '运营周期', f: 'system/phase.html' },
      { t: '角色权限', f: 'system/roles.html' } ] }
  ];

  var TITLES = {};
  NAV.forEach(function (g) { g.items.forEach(function (it) { TITLES[it.f] = it.t; }); });

  /* ---- 工具 ---- */
  function fmtMoney(v, yuan) {
    var n = Number(v || 0);
    if (yuan === false) {
      return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function badgeHtml(status) {
    var map = {
      active: ['badge-success', '生效中'], approved: ['badge-success', '已通过'],
      settled: ['badge-success', '已结算'], paid: ['badge-success', '已入账'],
      submitted: ['badge-info', '待确认入账'], pending: ['badge-warning', '待审核'],
      rejected: ['badge-danger', '已驳回'], cancelled: ['badge-outline', '已取消'],
      processing: ['badge-info', '打款中'], disabled: ['badge-outline', '已停用'],
      risk: ['badge-danger', '风险'], normal: ['badge-success', '正常'],
      on: ['badge-success', '上架'], off: ['badge-outline', '已下架'],
      warned: ['badge-warning', '已警告'],
      serving: ['badge-info', '履约中'], await_accept: ['badge-warning', '待验收'],
      escrowed: ['badge-info', '已托管'], await_confirm: ['badge-warning', '待验收'],
      draft: ['badge-outline', '草稿'], disputed: ['badge-danger', '平台介入中'],
      refunded: ['badge-outline', '已退款'], partial_refund: ['badge-warning', '部分退款'],
      frozen: ['badge-warning', '冻结中'], clawback: ['badge-danger', '已追回'],
      published: ['badge-success', '已发布']
    };
    var k = status in map ? status : 'pending';
    return '<span class="badge ' + map[k][0] + '">' + map[k][1] + '</span>';
  }

  /* ---- toast — 增强：类型样式 / 手动关闭按钮 / 堆叠 ---- */
  function toast(msg, type) {
    var w = document.querySelector('.ab-toast-wrap');
    if (!w) { w = document.createElement('div'); w.className = 'ab-toast-wrap'; document.body.appendChild(w); }
    var t = document.createElement('div');
    t.className = 'ab-toast' + (type ? ' ' + type : '');
    var msgSpan = document.createElement('span');
    msgSpan.className = 't-msg';
    msgSpan.textContent = msg;
    var closeBtn = document.createElement('button');
    closeBtn.className = 't-close';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.innerHTML = '&times;';
    t.appendChild(msgSpan);
    t.appendChild(closeBtn);
    w.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    var timer = setTimeout(function () { dismiss(); }, 3000);
    function dismiss() {
      clearTimeout(timer);
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 260);
    }
    closeBtn.addEventListener('click', dismiss);
  }

  /* ---- 共享：遮罩 z-index 堆叠 / 背景滚动锁定 / 焦点陷阱 ---- */
  var _overlayZ = 1000;
  var _scrollDepth = 0;
  var _prevOverflow = '';
  function nextZ() { return ++_overlayZ; }
  function lockScroll() {
    if (_scrollDepth === 0) {
      _prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    _scrollDepth++;
  }
  function unlockScroll() {
    _scrollDepth = Math.max(0, _scrollDepth - 1);
    if (_scrollDepth === 0) { document.body.style.overflow = _prevOverflow; }
  }
  function getFocusable(container) {
    var sel = 'a[href], button:not([disabled]), textarea:not([disabled]),' +
      ' input:not([disabled]):not([type="hidden"]), select:not([disabled]),' +
      ' [tabindex]:not([tabindex="-1"])';
    var nodes = container.querySelectorAll(sel);
    var arr = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement) arr.push(n);
    }
    return arr;
  }
  function trapFocus(container, opts) {
    opts = opts || {};
    function onKey(e) {
      if (e.key === 'Escape') {
        if (opts.onEscape) { e.preventDefault(); opts.onEscape(); }
        return;
      }
      if (e.key === 'Enter' && opts.onEnter) {
        var ae = document.activeElement;
        var tag = ae ? ae.tagName : '';
        if (tag !== 'BUTTON' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'A' &&
            !(tag === 'INPUT' && ae.type !== 'hidden')) {
          opts.onEnter(e);
        }
        return;
      }
      if (e.key !== 'Tab') return;
      var items = getFocusable(container);
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault(); last.focus();
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return function release() { document.removeEventListener('keydown', onKey); };
  }

  /* ---- 确认弹窗（审批用）— 重写：Escape/焦点陷阱/动效/ARIA/滚动锁定/loading/z-index/Enter ----
     API 向后兼容：Admin.confirm({title, body, ok, onYes, onNo, danger, dismiss}) */
  function confirmDialog(opts) {
    opts = opts || {};
    var instance = { _closed: false, _loading: false };
    var z = nextZ();
    var titleId = 'confirm-title-' + z;
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.zIndex = z;
    var dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', titleId);
    var titleEl = document.createElement('div');
    titleEl.className = 'cd-title';
    titleEl.id = titleId;
    titleEl.textContent = opts.title || '请确认';
    var bodyEl = document.createElement('div');
    bodyEl.className = 'cd-body';
    if (opts.body instanceof HTMLElement) { bodyEl.appendChild(opts.body); }
    else { bodyEl.innerHTML = opts.body || ''; }
    var actions = document.createElement('div');
    actions.className = 'cd-actions';
    var noBtn = document.createElement('button');
    noBtn.className = 'btn btn-outline';
    noBtn.textContent = '取消';
    var yesBtn = document.createElement('button');
    yesBtn.className = 'btn ' + (opts.danger ? 'btn-destructive' : 'btn-primary');
    yesBtn.textContent = opts.ok || '确认';
    actions.appendChild(noBtn);
    actions.appendChild(yesBtn);
    dialog.appendChild(titleEl);
    dialog.appendChild(bodyEl);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    lockScroll();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('open'); });
    });
    var releaseFocus = trapFocus(dialog, {
      onEscape: function () { if (opts.dismiss !== false && !instance._loading) doNo(); },
      onEnter: function () { if (!instance._loading) doYes(); }
    });
    setTimeout(function () { (opts.danger ? noBtn : yesBtn).focus(); }, 30);
    function doYes() {
      if (instance._loading || instance._closed) return;
      instance._loading = true;
      yesBtn.disabled = true;
      noBtn.disabled = true;
      var originalText = yesBtn.textContent;
      yesBtn.innerHTML = '<span class="btn-spinner"></span><span>处理中…</span>';
      yesBtn.classList.add('btn-loading');
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        instance.close();
      }
      var ret;
      try { ret = opts.onYes ? opts.onYes() : undefined; }
      catch (e) { finish(); throw e; }
      if (ret && typeof ret.then === 'function') {
        ret.then(finish, function () {
          instance._loading = false;
          yesBtn.disabled = false;
          noBtn.disabled = false;
          yesBtn.textContent = originalText;
          yesBtn.classList.remove('btn-loading');
        });
      } else { finish(); }
    }
    function doNo() {
      if (instance._loading || instance._closed) return;
      instance.close();
      if (opts.onNo) opts.onNo();
    }
    yesBtn.addEventListener('click', doYes);
    noBtn.addEventListener('click', doNo);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay && opts.dismiss !== false) doNo();
    });
    instance.close = function () {
      if (instance._closed) return;
      instance._closed = true;
      releaseFocus();
      unlockScroll();
      overlay.classList.remove('open');
      overlay.classList.add('closing');
      setTimeout(function () { overlay.remove(); }, 220);
    };
    return instance;
  }

  /* ---- 主题联动（engchain-theme：仅显式 'light' 为亮，其余为暗） ---- */
  function applyTheme() {
    var t = 'light';
    try { t = LS.getItem('engchain-theme') || 'light'; } catch (e) {}
    var dark = t !== 'light';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }
  applyTheme();
  window.addEventListener('storage', function (e) {
    if (e.key === 'engchain-theme') applyTheme();
  });
  window.addEventListener('engchain:theme', function () { applyTheme(); });

  /* ---- 顶栏 ---- */
  /* lucide 风格图标（stroke 内联 SVG） */
  var ICONS = {
    'index.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    'operations/supply.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
    'operations/orders.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    'operations/messages.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    'users/users.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'users/auth-review.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>',
    'users/entry-review.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a4 4 0 0 0 4-4"/><path d="M6 22h4"/><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M12 6v4"/><path d="M10 8h4"/></svg>',
    'finance/wallet.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
    'finance/recharge.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    'finance/withdraw.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14v2"/><path d="M12 6v2"/><path d="M6 12H4"/><path d="M20 12h-2"/><path d="m6.3 18.3-1.4-1.4"/><path d="m19.1 5.1-1.4 1.4"/><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"/></svg>',
    'finance/credits.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
    'finance/commission.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    'finance/invoice.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
    'distribution/overview.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M9 2v2"/><path d="M15 20v2"/><path d="M9 20v2"/></svg>',
    'distribution/team.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'distribution/payout.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>',
    'mediation/orders.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    'mediation/sellers.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'mediation/escrow.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    'risk/audit.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    'risk/monitor.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>',
    'risk/logs.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/></svg>',
    'system/pricing.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    'system/phase.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    'system/roles.html': '<svg class="sn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 7.5a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0-5Z"/><path d="M6.6 4.6 6 8l-3.4 1.6 1.2 3.2-1.4 2.6 3.8 1.6 1.4 2.4 3.6-.2 1.6 3.2 3.2-1.4 3.6.4 1-3.4 3.4-1.4-1-3.2 1.4-3.4-3.8-1.2-1.2-3.6Z"/><path d="M22 2 2 22"/></svg>'
  };

  /* ---- 可复用迷你 SVG（lucide 风格，替换 emoji） ---- */
  var S = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>',
    slider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    panelL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
    panelR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>',
    arrows: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };
  function ic(name, cls) {
    var s = S[name] || '';
    return cls ? s.replace('<svg ', '<svg class="' + cls + '" ') : s;
  }
  function themeBtnHtml(cur) {
    var next = cur === 'light' ? 'dark' : 'light';
    /* 圆形 ghost 图标按钮（对齐 shadcn theme-switch：仅太阳/月亮，无文字标签） */
    return ic(next === 'light' ? 'sun' : 'moon');
  }

  function renderTopbar(current) {
    var bar = document.querySelector('.topbar');
    if (!bar) return;
    var u = null;
    if (window.DataBus) u = DataBus.current();
    var an = (u && u.name) ? u.name : '陈建国';
    var av = (u && u.avatar) ? u.avatar : (an ? an.charAt(0) : '管');
    var ac = (u && u.company) ? u.company : '工程链 · 管理后台';
    var t = TITLES[current] || '数据总览';
    var cur = 'light';
    try { cur = LS.getItem('engchain-theme') || 'light'; } catch (e) {}
    bar.innerHTML =
      '<div class="brand"><span class="logo">链</span><span>工程链 <span style="font-weight:400;font-size:12px;color:var(--muted-foreground);">管理后台</span></span></div>' +
      '<div class="crumb"><b>总览</b><span class="crumb-sep">' + ic('chev') + '</span><span>' + t + '</span></div>' +
      '<span class="sp"></span>' +
      '<a class="top-search" id="cmd-open" href="javascript:void 0"><span class="ts-ic">' + ic('search') + '</span><span>搜索页面 / 功能…</span><span class="ts-kbd">⌘K</span></a>' +
      '<a class="tb-ic-btn" id="tb-bell" title="消息中心" href="' + BASE + 'operations/messages.html" data-plain><span>' + ic('bell') + '</span></a>' +
      '<button class="btn-theme" id="btn-theme" title="切换明暗主题">' + themeBtnHtml(cur) + '</button>' +
      '<button class="tb-ic-btn" id="tb-cfg" title="外观设置"><span>' + ic('slider') + '</span></button>' +
      '<div class="u-drop"><button class="u-drop-btn" id="ud-btn"><span class="u-av">' + av + '</span><span class="u-name">' + an + '<span class="u-sub">平台管理员 · ' + ac + '</span></span><span class="u-carets">' + ic('chev') + '</span></button></div>';
    bar.querySelector('#btn-theme').onclick = function () {
      var cur = 'light';
      try { cur = LS.getItem('engchain-theme') || 'light'; } catch (e) {}
      setTheme(cur === 'light' ? 'dark' : 'light');
    };
    var co = bar.querySelector('#cmd-open');
    if (co) co.onclick = function (e) { e.preventDefault(); openCmdk(); };
    var cf = bar.querySelector('#tb-cfg');
    if (cf) cf.onclick = function () { openCfg(); };
    var ud = bar.querySelector('.u-drop');
    bar.querySelector('#ud-btn').onclick = function (ev) {
      ev.stopPropagation();
      var old = ud.querySelector('.u-menu');
      if (old) { old.remove(); return; }
      var mm = document.createElement('div');
      mm.className = 'u-menu';
      mm.innerHTML =
        '<div class="um-h"><div style="font-weight:600;font-size:14px;">' + an + '</div>' +
        '<div style="font-size:12px;color:var(--muted-foreground);margin-top:2px;">' + ac + '</div>' +
        '<div style="margin-top:8px;"><span class="badge badge-gold">平台管理员</span></div></div>' +
        '<button class="um-i" data-go="login">' + ic('arrows') + ' 切换身份 / 登录</button>' +
        '<button class="um-i" data-go="preview">' + ic('panelL') + ' 返回原型总览</button>' +
        '<button class="um-i danger" data-go="logout">' + ic('x') + ' 退出登录</button>';
      ud.appendChild(mm);
      mm.querySelectorAll('.um-i').forEach(function (b) {
        b.onclick = function () {
          var go = b.getAttribute('data-go');
          if (go === 'login') location.href = '/pages/auth/login.html';
          else if (go === 'preview') location.href = '/preview.html';
          else { try { LS.setItem('engchain-state', 'logged_out'); } catch (e) {} location.href = '/pages/auth/login.html'; }
        };
      });
      var close = function (e) { if (!ud.contains(e.target)) { mm.remove(); document.removeEventListener('click', close); } };
      setTimeout(function () { document.addEventListener('click', close); }, 0);
    };
  }

  /* ---- 部门角色权限（Phase 7）：超管/运营/财务/风控 → 侧边导航可见性过滤 ---- */
  var ROLES = {
    super: null,
    ops: { secs: ['总览', '运营中心', '分销中心', '中介服务', '系统设置'] },
    finance: { secs: ['总览', '资金中心', '分销中心', '中介服务', '系统设置'] },
    risk: { secs: ['总览', '风控合规', '系统设置'] }
  };
  function currentRole() {
    try { return localStorage.getItem('engchain-role') || 'super'; } catch (e) { return 'super'; }
  }
  function roleAllowed(sec) {
    var r = ROLES[currentRole()];
    if (!r || !r.secs) return true;
    return r.secs.indexOf(sec) >= 0;
  }

  /* ---- 操作级权限（任务 2-4）：权限点 → 允许角色；null = 全部登录角色 ---- */
  var PERMS = {
    'approve.first': ['ops', 'super'],   /* 入驻/提现 初审（运营） */
    'approve.final': ['risk', 'super'],  /* 入驻 终审（风控复核） */
    'payout': ['finance', 'super'],      /* 提现终审打款（财务资金操作） */
    'ban': ['risk', 'super'],            /* 用户封禁（风控） */
    'settings': ['super'],               /* 系统设置（超管） */
    'export': null                       /* 数据导出：全部角色 */
  };
  function can(perm) {
    if (!perm) return true;
    var allow = PERMS[perm];
    if (!allow) return true;             /* 未知权限点默认放行 */
    return allow.indexOf(currentRole()) >= 0;
  }
  function applyPerms() {
    document.querySelectorAll('[data-perm]').forEach(function (el) {
      if (!can(el.getAttribute('data-perm'))) el.style.display = 'none';
    });
  }
  /* 页面 → 所属模块（页面级守卫用） */
  var PAGE_SEC = {
    'index.html': '总览',
    'operations/supply.html': '运营中心', 'operations/orders.html': '运营中心', 'operations/messages.html': '运营中心',
    'users/users.html': '用户与认证', 'users/auth-review.html': '用户与认证', 'users/entry-review.html': '用户与认证',
    'finance/wallet.html': '资金中心', 'finance/recharge.html': '资金中心', 'finance/withdraw.html': '资金中心',
    'finance/credits.html': '资金中心', 'finance/commission.html': '资金中心', 'finance/invoice.html': '资金中心',
    'distribution/overview.html': '分销中心', 'distribution/team.html': '分销中心', 'distribution/payout.html': '分销中心',
    'mediation/orders.html': '中介服务', 'mediation/sellers.html': '中介服务', 'mediation/escrow.html': '中介服务',
    'risk/audit.html': '风控合规', 'risk/monitor.html': '风控合规', 'risk/compliance.html': '风控合规', 'risk/logs.html': '风控合规',
    'system/pricing.html': '系统设置', 'system/phase.html': '系统设置', 'system/roles.html': '系统设置'
  };
  function guardPage() {
    var cur = document.body.getAttribute('data-page') || '';
    var sec = PAGE_SEC[cur];
    if (!sec) return;
    var hide = !roleAllowed(sec);
    var main = document.querySelector('.main');
    var ov = document.getElementById('perm-ov');
    var sn = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); };
    if (hide) {
      if (main) main.style.display = 'none';
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'perm-ov';
        ov.style.cssText = 'position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;background:var(--background);color:var(--foreground);';
        ov.innerHTML = '<div style="text-align:center;padding:28px;"><div class="e-ic" style="margin:0 auto 12px;display:inline-flex;color:var(--destructive);">' + S.shield + '</div><div style="font-size:18px;font-weight:700;font-family:var(--font-display);">当前角色无权访问「' + sn(sec) + '」模块</div><div style="margin-top:8px;color:var(--muted-foreground);font-size:13px;">当前角色：' + sn(currentRole()) + ' · 请在右上角用户菜单切换身份后重试</div></div>';
        document.body.appendChild(ov);
      }
    } else if (ov) {
      ov.remove();
      if (main) main.style.display = '';
    }
  }

  /* ---- 侧边导航 ---- */
  function renderSidenav(current) {
    var nav = document.querySelector('.sidenav');
    if (!nav) return;
    var collapsed = false;
    try { collapsed = LS.getItem('engchain-sidenav') === '1'; } catch (e) {}
    nav.classList.toggle('collapsed', collapsed);
    var html =
      '<div class="sn-brand"><span class="logo">链</span><span><span class="sn-name">工程链</span><span class="sn-sub">管理后台</span></span></div>' +
      '<div class="sn-toggle"><button id="sn-collapse" title="折叠 / 展开侧栏">' + (collapsed ? ic('panelL') : ic('panelR')) + '</button></div>';
    NAV.forEach(function (g) {
      if (!roleAllowed(g.sec)) return;
      html += '<div class="sn-sec">' + g.sec + '</div>';
      g.items.forEach(function (it) {
        var on = it.f === current ? ' on' : '';
        var svhic = ICONS[it.f] || '';
        html += '<a class="sn-item' + on + '" href="' + BASE + it.f + '">' + (svhic ? '<span class="sn-ic">' + svhic + '</span>' : '') + '<span class="sn-t">' + it.t + '</span></a>';
      });
    });
    nav.innerHTML = html;
    var tb = nav.querySelector('#sn-collapse');
    if (tb) tb.onclick = function () {
      var n = '0';
      try { n = LS.getItem('engchain-sidenav') === '1' ? '0' : '1'; } catch (e) {}
      try { LS.setItem('engchain-sidenav', n); } catch (e) {}
      nav.classList.toggle('collapsed', n === '1');
    };
  }

  /* ---- 主题（外观抽屉 / 顶栏按钮共用） ---- */
  function setTheme(v) {
    try { LS.setItem('engchain-theme', v); } catch (e) {}
    applyTheme();
    var bt = document.querySelector('#btn-theme');
    if (bt) bt.innerHTML = themeBtnHtml(v);
    window.dispatchEvent(new CustomEvent('engchain:theme', { detail: { theme: v } }));
    if (window.DataBus) DataBus.audit('切换主题', '系统', '', v === 'light' ? '亮色' : '暗色');
    syncCfgOpts();
  }
  function applyRadius(v) {
    var MAP = { sm: '0.5rem', md: '0.625rem', lg: '0.75rem' };
    try { LS.setItem('engchain-radius', v); } catch (e) {}
    document.documentElement.style.setProperty('--radius', MAP[v] || '0.625rem');
    syncCfgOpts();
  }
  function syncCfgOpts() {
    var d = document.querySelector('.cfg-drawer');
    if (!d) return;
    var t; try { t = LS.getItem('engchain-theme') || 'light'; } catch (e) {}
    var r; try { r = LS.getItem('engchain-radius') || 'md'; } catch (e) {}
    d.querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
    d.querySelectorAll('[data-r]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-r') === r); });
  }

  /* ---- 命令面板（⌘K / 点击搜索） ---- */
  function openCmdk() {
    if (document.querySelector('.cmdk')) return;
    var ov = document.createElement('div');
    ov.className = 'cmdk';
    ov.innerHTML =
      '<div class="cmk-box">' +
      '<div class="cmk-input"><span>' + ic('search') + '</span><input id="cmk-input" placeholder="搜索页面 / 功能…  回车跳转" autocomplete="off" spellcheck="false"></div>' +
      '<div class="cmk-list" id="cmk-list"></div>' +
      '</div>';
    document.body.appendChild(ov);
    var list = ov.querySelector('#cmk-list');
    var input = ov.querySelector('#cmk-input');
    var items = [];
    NAV.forEach(function (g) {
      if (!roleAllowed(g.sec)) return;
      g.items.forEach(function (it) {
        items.push({ sec: g.sec, t: it.t, href: BASE + it.f, key: it.f });
      });
    });
    function render(q) {
      q = (q || '').toLowerCase();
      var html = '', seen = {};
      items.forEach(function (it) {
        if (q && it.t.toLowerCase().indexOf(q) < 0) return;
        if (!seen[it.sec]) { seen[it.sec] = 1; html += '<div class="cmk-group-label">' + it.sec + '</div>'; }
        html += '<button class="cmk-item" data-href="' + it.href + '">' + (ICONS[it.key] || '') + '<span>' + it.t + '</span><span class="cmk-arrow">' + ic('arrows') + '</span></button>';
      });
      list.innerHTML = html || '<div class="cmk-empty">未找到匹配项</div>';
      var first = list.querySelector('.cmk-item');
      if (first) first.classList.add('on');
      list.querySelectorAll('.cmk-item').forEach(function (b) {
        b.onclick = function () { close(); location.href = b.getAttribute('data-href'); };
      });
    }
    function move(d) {
      var arr = Array.prototype.slice.call(list.querySelectorAll('.cmk-item'));
      if (!arr.length) return;
      var idx = arr.indexOf(list.querySelector('.cmk-item.on'));
      idx = (idx < 0 ? 0 : idx + d + arr.length) % arr.length;
      arr.forEach(function (x) { x.classList.remove('on'); });
      arr[idx].classList.add('on');
      try { arr[idx].scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    function close() { ov.remove(); document.removeEventListener('keydown', key); }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') {
        var o = list.querySelector('.cmk-item.on');
        if (o) { location.href = o.getAttribute('data-href'); close(); }
      }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    }
    document.addEventListener('keydown', key);
    input.addEventListener('input', function () { render(input.value); });
    /* 输入框 keydown 不再 stopPropagation —— 让 Escape/Enter/↑↓ 冒泡到 document 的 key 处理器，
       否则输入框获得焦点时会吞掉这些键（之前导致 ⌘K 面板无法 Esc 关闭 / 方向键失效） */
    input.addEventListener('keydown', function () {});
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    render('');
    input.focus();
  }

  /* ---- 外观抽屉（主题 / 圆角） ---- */
  function openCfg() {
    var old = document.querySelector('.cfg-drawer');
    if (old) { old.remove(); return; }
    var d = document.createElement('div');
    d.className = 'cfg-drawer';
    d.innerHTML =
      '<div class="cd-h"><span class="cd-title">外观</span><button class="btn btn-ghost btn-sm cd-close">' + ic('x') + '</button></div>' +
      '<div class="cd-body">' +
      '<div class="cd-label">主题</div>' +
      '<div class="cd-opts">' +
      '<button class="cd-opt" data-t="light">' + ic('sun') + ' 亮色</button>' +
      '<button class="cd-opt" data-t="dark">' + ic('moon') + ' 暗色</button>' +
      '</div>' +
      '<div class="cd-label">内容圆角</div>' +
      '<div class="cd-opts">' +
      '<button class="cd-opt" data-r="sm">小</button>' +
      '<button class="cd-opt" data-r="md">中</button>' +
      '<button class="cd-opt" data-r="lg">大</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(d);
    function closeCfg() { d.remove(); document.removeEventListener('click', out); document.removeEventListener('keydown', key); }
    function out(e) { if (!d.contains(e.target)) closeCfg(); }
    function key(e) { if (e.key === 'Escape') closeCfg(); }
    setTimeout(function () { document.addEventListener('click', out); }, 0);
    document.addEventListener('keydown', key);
    var cl = d.querySelector('.cd-close');
    if (cl) cl.onclick = function () { closeCfg(); };
    d.querySelectorAll('[data-t]').forEach(function (b) {
      b.onclick = function () { setTheme(b.getAttribute('data-t')); };
    });
    d.querySelectorAll('[data-r]').forEach(function (b) {
      b.onclick = function () { applyRadius(b.getAttribute('data-r')); };
    });
    syncCfgOpts();
  }

  /* ---- 启动：从 data-page 属性取当前页 ---- */

  /* ====================================================================
     Phase 0 · 设计系统基建 — JS 交互组件下沉
     全部使用 var/function（ES5+ 兼容），中文注释，不依赖外部库
     ==================================================================== */

  /* ---- 通用：HTML 转义 ---- */
  function escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- 1. Paginator（增强分页器） ---- */
  function Paginator(opts) {
    this.container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
    this.total = opts.total || 0;
    this.pageSize = opts.pageSize || 10;
    this.pageSizeOptions = opts.pageSizeOptions || [10, 20, 50, 100];
    this.current = 1;
    this.onChange = opts.onChange || function () {};
    this.render();
  }
  Paginator.prototype.totalPages = function () {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  };
  Paginator.prototype.pageList = function () {
    var tp = this.totalPages();
    var cur = this.current;
    var list = [];
    if (tp <= 7) { for (var i = 1; i <= tp; i++) list.push(i); }
    else {
      list.push(1);
      if (cur > 3) list.push('...');
      var start = Math.max(2, cur - 1);
      var end = Math.min(tp - 1, cur + 1);
      for (var j = start; j <= end; j++) list.push(j);
      if (cur < tp - 2) list.push('...');
      list.push(tp);
    }
    return list;
  };
  Paginator.prototype.render = function () {
    var self = this;
    if (!this.container) return;
    /* 总条数为 0 时隐藏分页器 */
    if (this.total <= 0) { this.container.innerHTML = ''; return; }
    var tp = this.totalPages();
    var chevL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
    var chevR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    var chevLL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>';
    var chevRR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/></svg>';
    var html = '<div class="paginator">';
    html += '<span class="pg-info">共 ' + this.total + ' 条 · 第 ' + this.current + '/' + tp + ' 页</span>';
    html += '<div class="pg-btns">';
    html += '<button class="pg-btn" data-page="1" title="首页"' + (this.current === 1 ? ' disabled' : '') + '>' + chevLL + '</button>';
    html += '<button class="pg-btn" data-page="' + (this.current - 1) + '" title="上一页"' + (this.current === 1 ? ' disabled' : '') + '>' + chevL + '</button>';
    var pages = this.pageList();
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] === '...') { html += '<span class="pg-ellipsis">…</span>'; }
      else { html += '<button class="pg-btn' + (pages[i] === this.current ? ' active' : '') + '" data-page="' + pages[i] + '"' + (pages[i] === this.current ? ' aria-current="page"' : '') + '>' + pages[i] + '</button>'; }
    }
    html += '<button class="pg-btn" data-page="' + (this.current + 1) + '" title="下一页"' + (this.current === tp ? ' disabled' : '') + '>' + chevR + '</button>';
    html += '<button class="pg-btn" data-page="' + tp + '" title="末页"' + (this.current === tp ? ' disabled' : '') + '>' + chevRR + '</button>';
    html += '</div>';
    html += '<select class="pg-size">';
    for (var k = 0; k < this.pageSizeOptions.length; k++) {
      var sz = this.pageSizeOptions[k];
      html += '<option value="' + sz + '"' + (sz === this.pageSize ? ' selected' : '') + '>' + sz + ' 条/页</option>';
    }
    html += '</select></div>';
    this.container.innerHTML = html;
    this.container.querySelectorAll('.pg-btn[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = parseInt(btn.getAttribute('data-page'), 10);
        if (!isNaN(p)) self.goTo(p);
      });
    });
    var sel = this.container.querySelector('.pg-size');
    if (sel) sel.addEventListener('change', function () {
      self.pageSize = parseInt(sel.value, 10) || 10;
      self.current = 1;
      self.render();
      self.onChange(self.current, self.pageSize);
    });
  };
  Paginator.prototype.goTo = function (page) {
    var tp = this.totalPages();
    page = Math.max(1, Math.min(tp, page));
    if (page === this.current) return;
    this.current = page;
    this.render();
    this.onChange(this.current, this.pageSize);
  };
  Paginator.prototype.setTotal = function (total) {
    this.total = total || 0;
    var tp = this.totalPages();
    if (this.current > tp) this.current = tp;
    this.render();
  };

  /* ---- 2. Drawer（侧边抽屉）— 增强：焦点陷阱/滚动锁定/ARIA/z-index/CSS类动画 ---- */
  var Drawer = {
    open: function (opts) {
      opts = opts || {};
      var instance = { _closed: false };
      var z = nextZ();
      var titleId = 'drawer-title-' + z;
      var overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';
      overlay.style.zIndex = z;
      var panel = document.createElement('div');
      panel.className = 'drawer' + (opts.side === 'left' ? ' drawer-left' : '');
      panel.style.zIndex = z + 1;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      if (opts.title) panel.setAttribute('aria-labelledby', titleId);
      if (opts.width) panel.style.width = opts.width;
      var header = document.createElement('div');
      header.className = 'drawer-header';
      var titleSpan = document.createElement('span');
      titleSpan.className = 'dh-title';
      titleSpan.id = titleId;
      titleSpan.textContent = opts.title || '';
      var closeBtn = document.createElement('button');
      closeBtn.className = 'dh-close';
      closeBtn.title = '关闭';
      closeBtn.setAttribute('aria-label', '关闭');
      closeBtn.innerHTML = ic('x');
      header.appendChild(titleSpan);
      header.appendChild(closeBtn);
      panel.appendChild(header);
      var body = document.createElement('div');
      body.className = 'drawer-body';
      if (opts.content instanceof HTMLElement) { body.appendChild(opts.content); }
      else if (typeof opts.content === 'string') { body.innerHTML = opts.content; }
      panel.appendChild(body);
      if (opts.footer) {
        var footer = document.createElement('div');
        footer.className = 'drawer-footer';
        if (opts.footer instanceof HTMLElement) { footer.appendChild(opts.footer); }
        else { footer.innerHTML = opts.footer; }
        panel.appendChild(footer);
      }
      document.body.appendChild(overlay);
      document.body.appendChild(panel);
      lockScroll();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          overlay.classList.add('open');
          panel.classList.add('open');
        });
      });
      var releaseFocus = trapFocus(panel, {
        onEscape: function () { instance.close(); }
      });
      setTimeout(function () { closeBtn.focus(); }, 30);
      instance.close = function () {
        if (instance._closed) return;
        instance._closed = true;
        releaseFocus();
        unlockScroll();
        overlay.classList.remove('open');
        panel.classList.remove('open');
        overlay.classList.add('closing');
        panel.classList.add('closing');
        setTimeout(function () {
          overlay.remove();
          panel.remove();
          if (opts.onClose) opts.onClose();
        }, 260);
      };
      overlay.addEventListener('click', function () { instance.close(); });
      closeBtn.addEventListener('click', function () { instance.close(); });
      instance.overlay = overlay;
      instance.panel = panel;
      instance.body = body;
      return instance;
    }
  };

  /* ---- 3. Modal（通用弹窗）— 增强：动效/焦点陷阱/滚动锁定/ARIA/z-index/独立类名 ---- */
  var Modal = {
    open: function (opts) {
      opts = opts || {};
      var instance = { _closed: false };
      var z = nextZ();
      var titleId = 'modal-title-' + z;
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.zIndex = z;
      var dg = document.createElement('div');
      dg.className = 'modal-dialog';
      dg.setAttribute('role', 'dialog');
      dg.setAttribute('aria-modal', 'true');
      if (opts.title) dg.setAttribute('aria-labelledby', titleId);
      if (opts.width) dg.style.maxWidth = opts.width;
      if (opts.title) {
        var t = document.createElement('div');
        t.className = 'modal-title';
        t.id = titleId;
        t.textContent = opts.title;
        dg.appendChild(t);
      }
      var b = document.createElement('div');
      b.className = 'modal-body';
      if (opts.content instanceof HTMLElement) { b.appendChild(opts.content); }
      else if (typeof opts.content === 'string') { b.innerHTML = opts.content; }
      dg.appendChild(b);
      if (opts.footer) {
        var f = document.createElement('div');
        f.className = 'modal-footer';
        if (opts.footer instanceof HTMLElement) { f.appendChild(opts.footer); }
        else { f.innerHTML = opts.footer; }
        dg.appendChild(f);
      }
      overlay.appendChild(dg);
      document.body.appendChild(overlay);
      lockScroll();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { overlay.classList.add('open'); });
      });
      var releaseFocus = trapFocus(dg, {
        onEscape: function () { if (opts.dismissible !== false) instance.close(); }
      });
      setTimeout(function () {
        var focusables = getFocusable(dg);
        if (focusables.length) focusables[0].focus();
        else { dg.setAttribute('tabindex', '-1'); dg.focus(); }
      }, 30);
      instance.close = function () {
        if (instance._closed) return;
        instance._closed = true;
        releaseFocus();
        unlockScroll();
        overlay.classList.remove('open');
        overlay.classList.add('closing');
        setTimeout(function () {
          overlay.remove();
          if (opts.onClose) opts.onClose();
        }, 220);
      };
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay && opts.dismissible !== false) instance.close();
      });
      instance.overlay = overlay;
      instance.dialog = dg;
      instance.body = b;
      return instance;
    }
  };

  /* ---- 4. FilterBar（筛选栏渲染器） ---- */
  var FilterBar = {
    render: function (opts) {
      var container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
      if (!container) return {};
      var fields = opts.fields || [];
      var onFilter = opts.onFilter || function () {};
      var onReset = opts.onReset || function () {};
      var html = '<div class="filters">';
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        html += '<div class="form-item" style="min-width:160px;">';
        html += '<label class="lbl">' + escHtml(f.label || f.key) + '</label>';
        if (f.type === 'select') {
          html += '<select class="select" data-key="' + escHtml(f.key) + '" style="width:100%;">';
          html += '<option value="">全部</option>';
          var ops = f.options || [];
          for (var j = 0; j < ops.length; j++) {
            var ov = typeof ops[j] === 'object' ? ops[j].value : ops[j];
            var ol = typeof ops[j] === 'object' ? ops[j].label : ops[j];
            html += '<option value="' + escHtml(ov) + '">' + escHtml(ol) + '</option>';
          }
          html += '</select>';
        } else if (f.type === 'date') {
          html += '<input type="date" class="input" data-key="' + escHtml(f.key) + '" style="width:100%;">';
        } else if (f.type === 'daterange') {
          html += '<div style="display:flex;gap:6px;align-items:center;">';
          html += '<input type="date" class="input" data-key="' + escHtml(f.key) + '_start" style="flex:1;min-width:0;">';
          html += '<span style="color:var(--muted-foreground);">至</span>';
          html += '<input type="date" class="input" data-key="' + escHtml(f.key) + '_end" style="flex:1;min-width:0;">';
          html += '</div>';
        } else {
          html += '<input type="text" class="input" data-key="' + escHtml(f.key) + '" placeholder="' + escHtml(f.placeholder || '请输入') + '" style="width:100%;">';
        }
        html += '</div>';
      }
      html += '<div class="form-item" style="justify-content:flex-end;">';
      html += '<label class="lbl">&nbsp;</label>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<button class="btn btn-primary" id="fb-filter">查询</button>';
      html += '<button class="btn btn-outline" id="fb-reset">重置</button>';
      html += '</div></div>';
      html += '</div>';
      container.innerHTML = html;
      function getValues() {
        var vals = {};
        container.querySelectorAll('[data-key]').forEach(function (el) {
          vals[el.getAttribute('data-key')] = el.value;
        });
        return vals;
      }
      container.querySelector('#fb-filter').onclick = function () { onFilter(getValues()); };
      container.querySelector('#fb-reset').onclick = function () {
        container.querySelectorAll('[data-key]').forEach(function (el) { el.value = ''; });
        onReset();
      };
      /* Enter 键在输入框内触发查询 */
      container.querySelectorAll('.input, .select').forEach(function (el) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); onFilter(getValues()); }
        });
      });
      return { getValues: getValues, container: container };
    }
  };

  /* ---- 5. TableRenderer（数据驱动表格渲染器） ---- */
  var TableRenderer = {
    render: function (opts) {
      var container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
      if (!container) return {};
      var columns = opts.columns || [];
      var data = opts.data || [];
      var options = opts.options || {};
      var selectable = options.selectable === true;
      var rowClick = options.rowClick || null;
      var emptyText = options.emptyText || '暂无数据';
      var emptyOpts = options.empty || null;
      var loading = options.loading === true;
      var sortKey = options.sortKey || null;
      var sortDir = options.sortDir || 'asc';
      var onSort = options.onSort || null;
      var selectedRows = {};
      var html = '<div class="table-wrap loading-wrap">';
      if (loading) html += '<div class="loading-overlay"><div class="spinner"></div></div>';
      html += '<table><thead><tr>';
      if (selectable) {
        html += '<th class="col-check"><input type="checkbox" class="checkbox" id="tr-check-all"></th>';
      }
      for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        var sortCls = '';
        if (col.sortable) {
          sortCls = ' sortable';
          if (sortKey === col.key) sortCls += ' ' + sortDir;
        }
        var style = col.width ? ' style="width:' + col.width + ';"' : '';
        html += '<th class="' + sortCls + '" data-key="' + escHtml(col.key) + '"' + style + '>';
        html += escHtml(col.label || col.key);
        if (col.sortable) {
          html += '<span class="sort-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></span>';
        }
        html += '</th>';
      }
      html += '</tr></thead><tbody>';
      if (data.length === 0 && !loading) {
        var colspan = columns.length + (selectable ? 1 : 0);
        /* 富空态：icon + 标题 + 提示（info 传达），替代裸文本单元格。
           向后兼容：未传 options.empty 时，emptyText（多为各页的「暂无××」）作为标题展示。 */
        var icon = (emptyOpts && emptyOpts.icon) ? emptyOpts.icon :
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
        var title = (emptyOpts && emptyOpts.title) ? emptyOpts.title : emptyText;
        var desc = (emptyOpts && emptyOpts.desc) ? emptyOpts.desc : '';
        var action = (emptyOpts && emptyOpts.action) ? emptyOpts.action : '';
        html += '<tr><td colspan="' + colspan + '"><div class="table-empty">' +
          '<div class="te-icon">' + icon + '</div>' +
          '<div class="te-title">' + escHtml(title) + '</div>' +
          (desc ? '<div class="te-desc">' + escHtml(desc) + '</div>' : '') +
          (action ? '<div class="te-action">' + action + '</div>' : '') +
          '</div></td></tr>';
      }
      for (var r = 0; r < data.length; r++) {
        var row = data[r];
        var rowId = row.id != null ? row.id : r;
        var trCls = rowClick ? ' clickable' : '';
        html += '<tr data-row-id="' + escHtml(rowId) + '" class="' + trCls + '">';
        if (selectable) {
          html += '<td class="col-check"><input type="checkbox" class="checkbox tr-check" data-row-id="' + escHtml(rowId) + '"></td>';
        }
        for (var c = 0; c < columns.length; c++) {
          var cl = columns[c];
          var cellVal = cl.render ? cl.render(row, r) : (row[cl.key] != null ? row[cl.key] : '');
          html += '<td>' + cellVal + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      container.innerHTML = html;
      if (rowClick) {
        container.querySelectorAll('tbody tr.clickable').forEach(function (tr) {
          tr.onclick = function (e) {
            if (e.target.classList.contains('checkbox') || e.target.closest('.checkbox')) return;
            var idx = tr.getAttribute('data-row-id');
            var rowData = null;
            for (var k = 0; k < data.length; k++) {
              if (String(data[k].id != null ? data[k].id : k) === String(idx)) { rowData = data[k]; break; }
            }
            rowClick(rowData, idx, tr);
          };
        });
      }
      if (onSort) {
        container.querySelectorAll('th.sortable').forEach(function (th) {
          th.onclick = function () {
            var key = th.getAttribute('data-key');
            var dir = 'asc';
            if (sortKey === key && sortDir === 'asc') dir = 'desc';
            onSort(key, dir);
          };
        });
      }
      if (selectable) {
        var allCb = container.querySelector('#tr-check-all');
        if (allCb) {
          allCb.onchange = function () {
            container.querySelectorAll('.tr-check').forEach(function (cb) {
              cb.checked = allCb.checked;
              var rid = cb.getAttribute('data-row-id');
              if (allCb.checked) selectedRows[rid] = true;
              else delete selectedRows[rid];
              cb.closest('tr').classList.toggle('selected', allCb.checked);
            });
          };
        }
        container.querySelectorAll('.tr-check').forEach(function (cb) {
          cb.onclick = function (e) { e.stopPropagation(); };
          cb.onchange = function () {
            var rid = cb.getAttribute('data-row-id');
            if (cb.checked) selectedRows[rid] = true;
            else delete selectedRows[rid];
            cb.closest('tr').classList.toggle('selected', cb.checked);
          };
        });
      }
      return {
        container: container,
        getSelected: function () {
          var ids = [];
          for (var k in selectedRows) if (selectedRows[k]) ids.push(k);
          return ids;
        },
        clearSelection: function () {
          selectedRows = {};
          container.querySelectorAll('.tr-check').forEach(function (cb) { cb.checked = false; });
          container.querySelectorAll('tr.selected').forEach(function (tr) { tr.classList.remove('selected'); });
        }
      };
    }
  };

  /* ---- 6. EmptyState（空态渲染器） ---- */
  var EmptyState = {
    html: function (opts) {
      opts = opts || {};
      var iconSvg = opts.icon || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>';
      var html = '<div class="empty">';
      html += '<div class="e-ic">' + iconSvg + '</div>';
      if (opts.title) html += '<div style="font-size:15px;font-weight:600;color:var(--foreground);margin-bottom:4px;">' + escHtml(opts.title) + '</div>';
      if (opts.desc) html += '<div style="font-size:13px;color:var(--muted-foreground);max-width:360px;margin:0 auto;line-height:1.6;">' + escHtml(opts.desc) + '</div>';
      if (opts.action) html += '<div style="margin-top:14px;">' + opts.action + '</div>';
      html += '</div>';
      return html;
    }
  };

  /* ---- 7. LoadingState（加载态） ---- */
  var LoadingState = {
    show: function (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;
      el.classList.add('loading-wrap');
      if (el.querySelector('.loading-overlay')) return;
      var ov = document.createElement('div');
      ov.className = 'loading-overlay';
      ov.innerHTML = '<div class="spinner"></div>';
      el.appendChild(ov);
    },
    hide: function (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;
      var ov = el.querySelector('.loading-overlay');
      if (ov) ov.remove();
    }
  };

  /* ---- 8. 状态徽标增强（statusDot / badgeWithDot） ---- */
  var DOT_MAP = {
    active: 'ok', approved: 'ok', settled: 'ok', paid: 'ok', published: 'ok',
    normal: 'ok', on: 'ok', serving: 'ok', escrowed: 'info',
    pending: 'warn', submitted: 'warn', await_accept: 'warn', await_confirm: 'warn',
    warned: 'warn', frozen: 'warn', partial_refund: 'warn',
    processing: 'info', draft: 'muted', disabled: 'muted', off: 'muted',
    cancelled: 'muted', refunded: 'muted',
    rejected: 'danger', risk: 'danger', disputed: 'danger', clawback: 'danger'
  };
  function statusDot(status) {
    var cls = DOT_MAP[status] || 'muted';
    return '<span class="status-dot ' + cls + '"></span>';
  }
  function badgeWithDot(status) {
    var cls = DOT_MAP[status] || 'muted';
    var badge = badgeHtml(status);
    return badge.replace('">', '"><span class="status-dot ' + cls + '" style="margin-right:4px;"></span>');
  }

  /* ---- 9. Dropdown（下拉菜单） ---- */
  var Dropdown = {
    create: function (opts) {
      var trigger = typeof opts.trigger === 'string' ? document.querySelector(opts.trigger) : opts.trigger;
      if (!trigger) return null;
      var items = opts.items || [];
      var instance = { menu: null, _open: false };
      function buildMenu() {
        var menu = document.createElement('div');
        menu.className = 'dropdown-menu' + (opts.align === 'right' ? ' dropdown-menu-right' : '');
        var html = '';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (it.sep) { html += '<div class="dropdown-sep"></div>'; continue; }
          var dangerCls = it.danger ? ' danger' : '';
          var iconHtml = it.icon ? it.icon : '';
          html += '<button class="dropdown-item' + dangerCls + '" data-idx="' + i + '">' + iconHtml + escHtml(it.label || '') + '</button>';
        }
        menu.innerHTML = html;
        menu.querySelectorAll('.dropdown-item').forEach(function (btn) {
          btn.onclick = function (e) {
            e.stopPropagation();
            var idx = parseInt(btn.getAttribute('data-idx'), 10);
            if (items[idx] && items[idx].onClick) items[idx].onClick();
            instance.close();
          };
        });
        return menu;
      }
      instance.open = function () {
        if (instance._open) return;
        instance._open = true;
        instance.menu = buildMenu();
        document.body.appendChild(instance.menu);
        var rect = trigger.getBoundingClientRect();
        var menuRect = instance.menu.getBoundingClientRect();
        var top = rect.bottom + window.scrollY + 6;
        var left = rect.left + window.scrollX;
        /* 防溢出：若下方空间不足则向上展开 */
        if (rect.bottom + menuRect.height > window.innerHeight && rect.top > menuRect.height) {
          top = rect.top + window.scrollY - menuRect.height - 6;
        }
        instance.menu.style.top = top + 'px';
        if (opts.align === 'right') {
          instance.menu.style.left = 'auto';
          instance.menu.style.right = (window.innerWidth - rect.right - window.scrollX) + 'px';
        } else {
          instance.menu.style.left = left + 'px';
        }
        setTimeout(function () { document.addEventListener('click', onOutside); }, 0);
        document.addEventListener('keydown', onKey);
      };
      instance.close = function () {
        if (!instance._open) return;
        instance._open = false;
        if (instance.menu) instance.menu.remove();
        document.removeEventListener('click', onOutside);
        document.removeEventListener('keydown', onKey);
      };
      function onKey(e) { if (e.key === 'Escape') instance.close(); }
      instance.toggle = function () {
        if (instance._open) instance.close();
        else instance.open();
      };
      function onOutside(e) {
        if (instance.menu && !instance.menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
          instance.close();
        }
      }
      trigger.onclick = function (e) {
        e.stopPropagation();
        instance.toggle();
      };
      return instance;
    }
  };

  /* ---- 10. Tabs（标签页控制器）— 增强：键盘左右键/Home/End/ARIA ---- */
  var Tabs = {
    init: function (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;
      var tabList = el.querySelector('.tabs');
      if (tabList) tabList.setAttribute('role', 'tablist');
      var tabs = el.querySelectorAll('.tab');
      var panels = el.querySelectorAll('.tab-panel');
      tabs.forEach(function (tab, idx) {
        var target = tab.getAttribute('data-tab');
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
        tab.setAttribute('aria-controls', 'panel-' + target);
        tab.setAttribute('tabindex', tab.classList.contains('active') ? '0' : '-1');
        var panel = el.querySelector('.tab-panel[data-panel="' + target + '"]');
        if (panel) { panel.setAttribute('role', 'tabpanel'); panel.id = 'panel-' + target; }
        function activate() {
          tabs.forEach(function (t) {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          tab.setAttribute('tabindex', '0');
          panels.forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-panel') === target);
          });
        }
        tab.addEventListener('click', activate);
        tab.addEventListener('keydown', function (e) {
          var nextIdx = null;
          if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
          else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = tabs.length - 1;
          if (nextIdx !== null) {
            e.preventDefault();
            tabs[nextIdx].focus();
            tabs[nextIdx].click();
          }
        });
      });
    }
  };

  function boot() {
    var cur = document.body.getAttribute('data-page') || '';
    try { applyRadius(LS.getItem('engchain-radius') || 'md'); } catch (e) {}
    renderTopbar(cur);
    renderSidenav(cur);
    /* 审批操作留痕的统一入口 */
    window.Admin = {
      NAV: NAV, BASE: BASE, toast: toast, confirm: confirmDialog,
      fmt: fmtMoney, badge: badgeHtml, current: cur, role: currentRole,
      refreshNav: function () { renderSidenav(cur); },
      log: function (action, module, target, extra) {
        if (window.DataBus) DataBus.audit(action, module, target, extra);
      },
      can: can, applyPerms: applyPerms, guardPage: guardPage,
      perms: PERMS, pageSec: PAGE_SEC,
      /* 数据导出：CSV（UTF-8 BOM，Excel 直开） */
      exportCSV: function (filename, headers, rows) {
        var esc = function (v) { v = String(v == null ? '' : v); return '"' + v.replace(/"/g, '""') + '"'; };
        var csv = '\ufeff' + headers.map(esc).join(',') + '\n' +
          rows.map(function (r) { return r.map(esc).join(','); }).join('\n');
        try {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 600);
          return true;
        } catch (e) { return false; }
      }
    };
    window.addEventListener('storage', function (e) {
      if (e.key === 'engchain-role') { renderSidenav(cur); guardPage(); applyPerms(); }
    });
    guardPage();
    applyPerms();
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openCmdk(); }
    });
    /* Phase 0 路 new components mount */
    window.Admin.Paginator = Paginator;
    window.Admin.Drawer = Drawer;
    window.Admin.Modal = Modal;
    window.Admin.FilterBar = FilterBar;
    window.Admin.TableRenderer = TableRenderer;
    window.Admin.EmptyState = EmptyState;
    window.Admin.LoadingState = LoadingState;
    window.Admin.statusDot = statusDot;
    window.Admin.badgeWithDot = badgeWithDot;
    window.Admin.Dropdown = Dropdown;
    window.Admin.Tabs = Tabs;

    document.dispatchEvent(new CustomEvent('admin:ready', { detail: window.Admin }));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
