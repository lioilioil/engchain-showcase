/* ============================================================================
   电子签板块共享脚本（pages/esign/esign.common.js）
   依赖（按序）：common.js(UI) · data.js(MOCK) · stores.js(EsignStore/BalanceStore/entryAccess)
                · databus.js(DataBus)
   职责：身份门控、发起流草稿、合同状态/倒计时/进度映射、结构化合同正文、
        跨窗口订阅、对方 H5 待签检索。所有写操作一律经 EsignStore（含 audit/金额/次数）。
   ============================================================================ */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function money(n) {
    if (n === 0) return '¥0';
    return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dtime(ts) { if (!ts) return ''; var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ddate(ts) { if (!ts) return ''; var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function countdown(deadline) {
    var diff = (deadline || 0) - Date.now();
    if (diff <= 0) return { overdue: true, urgent: false, text: '已超过签署截止时间' };
    var d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4);
    var text = d > 0 ? ('剩 ' + d + ' 天 ' + pad(h) + ' 时') : ('剩 ' + h + ' 时 ' + pad(m) + ' 分');
    return { overdue: false, urgent: diff <= 2 * 864e5, text: text };
  }

  /* ---- 线性图标（统一风格，不使用 emoji） ---- */
  var ICONS = {
    shield: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    clock: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
    upload: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    truck: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1"/><path d="M14 9h4l3 3v5a1 1 0 0 1-1 1h-1"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/></svg>',
    wrench: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.5-.7-.7-2.5z"/></svg>',
    users: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    sign: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17.5 14.5 6l3.5 3.5L6.5 21H3z"/><path d="M14.5 6l2-2a2 2 0 0 1 3 3l-2 2"/><path d="M4 22h8"/></svg>',
    plus: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    bell: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    warning: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    receipt: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2.5-1.5L9 22l3-1.5L15 22l2.5-1.5L20 22V2l-2.5 1.5L15 2l-3 1.5L9 2 6.5 3.5z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
    package: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
    chevron: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M15.4 12 9.7 6.3a1 1 0 0 1 1.4-1.4l6.4 6.4a1 1 0 0 1 0 1.4l-6.4 6.4a1 1 0 1 1-1.4-1.4z"/></svg>',
    arrow: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    lock: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    x: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };
  function ic(name, cls) { return ICONS[name] ? ICONS[name].replace('class="ic"', 'class="ic ' + (cls || '') + '"') : ''; }

  /* ---- 工程合同模板（发起流/首页快捷/模板列表单一来源） ---- */
  var TEMPLATES = [
    { id: 't-material', cat: 'purchase', scene: '材料采购', name: '材料采购合同', desc: '建材采购，含明细清单、交货与付款方式',
      fields: [['project', '工程名称', true], ['location', '工程/交货地点', false], ['detail', '材料明细（规格/数量/单价）', true, 'textarea'], ['amount', '合同总金额（元）', false, 'number'], ['payMethod', '付款方式', false, 'select', ['货到付款', '月结', '验收后付款', '分期付款']], ['finishDate', '交货期限', false, 'date']] },
    { id: 't-equipment', cat: 'purchase', scene: '设备租赁', name: '设备租赁合同', desc: '塔吊 / 挖机等工程设备租赁，含租期与租金',
      fields: [['project', '使用工程名称', true], ['detail', '设备型号 / 数量', true, 'textarea'], ['amount', '租金合计（元）', false, 'number'], ['payMethod', '租金结算方式', false, 'select', ['月租', '按台班', '完工一次性结算']], ['finishDate', '租赁期限至', false, 'date']] },
    { id: 't-labor', cat: 'contract', scene: '劳务分包', name: '劳务分包合同', desc: '工程劳务分包，含分包范围、计价与工期',
      fields: [['project', '工程名称', true], ['location', '工程地点', false], ['detail', '分包范围与工作内容', true, 'textarea'], ['amount', '合同价款（元）', false, 'number'], ['payMethod', '计价方式', false, 'select', ['固定总价', '综合单价', '按实结算']], ['finishDate', '完工日期', false, 'date']] },
    { id: 't-nda', cat: 'coop', scene: '保密协议', name: '保密协议（NDA）', desc: '合作前技术与商务信息保密',
      fields: [['project', '合作/项目名称', true], ['detail', '保密信息范围与保密期限', true, 'textarea']] },
    { id: 't-frame', cat: 'coop', scene: '框架协议', name: '战略合作框架协议', desc: '长期合作意向、范围与基本原则',
      fields: [['project', '合作主题', true], ['detail', '合作范围与主要约定', true, 'textarea'], ['finishDate', '合作期限至', false, 'date']] },
    { id: 't-service', cat: 'general', scene: '服务合同', name: '专业服务合同', desc: '咨询 / 设计 / 监理等专业服务',
      fields: [['project', '服务项目', true], ['detail', '服务内容与交付要求', true, 'textarea'], ['amount', '服务费用（元）', false, 'number'], ['finishDate', '服务完成期限', false, 'date']] }
  ];
  function tpl(id) { return TEMPLATES.filter(function (t) { return t.id === id; })[0] || TEMPLATES[0]; }

  /* ---- 身份/数据 ---- */
  function user() { try { return DataBus.current(); } catch (e) { return null; } }
  function isGuest() { try { return !!(window.DataBus && DataBus.isGuest && DataBus.isGuest()); } catch (e) { return false; } }
  function canUse() { try { return !!(window.entryAccess && entryAccess().dist); } catch (e) { return false; } }
  function isPersonal() {
    try { var a = window.entryAccess ? entryAccess() : null; var u = user();
      return !!(a && a.isIndividualPartner) || !!(u && !u.company);
    } catch (e) { return false; }
  }
  function bundle() { return window.EsignStore ? EsignStore.bundle() : { guest: true, sub: { contracts: [], orders: [], refunds: [], quota: {} } }; }

  function myParty(c, uid) {
    uid = uid || (user() || {}).id;
    return (c.parties || []).filter(function (p) { return p.ownerUid === uid; })[0] || null;
  }
  function otherParties(c) {
    var u = (user() || {}).id;
    var list = (c.parties || []).filter(function (p) { return p.ownerUid !== u; });
    return list.length ? list : (c.parties || []).filter(function (p) { return !p.ownerUid; });
  }
  function progress(c) {
    var total = (c.parties || []).length, signed = (c.parties || []).filter(function (p) { return p.status === 'signed'; }).length;
    return { signed: signed, total: total };
  }
  function roleText(c) {
    var mp = myParty(c); var t = '我方' + (mp ? ' · ' + mp.role : '');
    if (c.initiatorUid === (user() || {}).id) t += ' · 发起';
    return t;
  }
  function amountText(c) { return c.amount > 0 ? money(c.amount) : '无金额'; }
  function counterpartyText(c) {
    var ops = otherParties(c);
    if (!ops.length) return '—';
    var names = ops.map(function (p) { return p.company || p.name; });
    return names.length > 1 ? names[0] + ' 等 ' + names.length + ' 方' : names[0];
  }

  var STATUS_LABEL = { completed: '已完成', rejected: '对方已拒签', expired: '已过期', withdrawn: '已撤回', voided: '已作废' };
  /* 合同 → 卡片/徽标/脚注统一映射（修复"已签还显示我要签"） */
  function meta(c) {
    var uid = (user() || {}).id, cd = countdown(c.deadline);
    if (c.status === 'completed') return { key: 'done', spine: 's-done', badge: 'b-done', badgeText: '已完成', foot: 'st-done', footText: (c.evidence ? '已存证 · ' + ddate(c.completedAt) + ' 完成' : '已完成') };
    if (c.status === 'pending_mine') return { key: 'mine', spine: 's-mine', badge: 'b-mine', badgeText: '待我签', foot: cd.urgent ? 'st-urgent' : 'st-wait', footText: cd.overdue ? '已逾期' : cd.text };
    if (c.status === 'signing') {
      var mp = myParty(c, uid);
      var minePending = mp && mp.status !== 'signed';
      if (minePending) return { key: 'mine', spine: 's-mine', badge: 'b-mine', badgeText: '待我签', foot: cd.urgent ? 'st-urgent' : 'st-wait', footText: cd.overdue ? '已逾期' : cd.text };
      return { key: 'other', spine: 's-other', badge: 'b-other', badgeText: '待对方签', foot: 'st-wait', footText: cd.overdue ? '已逾期' : '等待对方签署 · ' + cd.text };
    }
    return { key: 'closed', spine: '', badge: 'b-gray', badgeText: STATUS_LABEL[c.status] || '已结束', foot: 'st-gray', footText: STATUS_LABEL[c.status] || '' };
  }

  /* 用印时间线（卡片展开 / 详情共用） */
  function timeline(c) {
    var items = [];
    items.push({ c: 'done', t: '合同已发起', s: dtime(c.sentAt || c.createdAt) + ' · ' + esc(c.initiatorCompany || c.initiatorName) });
    (c.parties || []).forEach(function (p) {
      if (p.status === 'signed') items.push({ c: 'done', t: esc((p.company || p.name)) + ' 已签署', s: dtime(p.signedAt) + ' · ' + esc(p.signMethod || '电子签名') });
      else if (p.status === 'rejected') items.push({ c: 'cur', t: esc(p.company || p.name) + ' 拒签', s: dtime(p.rejectedAt) + ' · ' + esc(p.rejectReason || '暂不同意签署') });
      else items.push({ c: 'cur', t: '等待 ' + esc(p.company || p.name) + ' 签署', s: p.role + ' · 邀请链接 ' + (EsignStore.pricing().signValidDays) + ' 天内有效' });
    });
    if (c.status === 'completed' && c.evidence) items.push({ c: 'done', t: '已生成司法存证', s: esc(c.evidence.certNo) + ' · ' + dtime(c.evidence.timestamp) });
    return items;
  }
  function timelineHTML(c) {
    return timeline(c).map(function (t) {
      return '<div class="es-tl-item ' + t.c + '"><div class="tt">' + t.t + '</div><div class="ts">' + t.s + '</div></div>';
    }).join('') + (c.evidence ? evidenceHTML(c.evidence) : '');
  }
  function evidenceHTML(ev) {
    return '<div class="es-evid">' + ic('shield') + '<span><div class="ek">司法存证编号 / 哈希 · ' + esc(ev.provider) + '</div>' +
      '<div class="ev">' + esc(ev.certNo) + ' · ' + esc(ev.hash) + '</div></span></div>';
  }

  /* ---- 合同卷宗卡 ---- */
  function segBar(c) {
    var pg = progress(c), h = '<span class="es-miniflow">';
    var pendingSeen = false;
    for (var i = 0; i < pg.total; i++) {
      var cls = i < pg.signed ? 'on' : (!pendingSeen ? 'cur' : '');
      if (i >= pg.signed) pendingSeen = true;
      h += '<span class="seg ' + cls + '"></span>';
    }
    return h + '</span><span class="pf">签署 <b>' + pg.signed + '</b>/' + pg.total + ' 方</span>';
  }
  function cardHTML(c) {
    var m = meta(c);
    return '<article class="es-cc ' + m.spine + '" data-id="' + esc(c.id) + '">' +
      '<div class="body">' +
        '<div class="r1"><h4>' + esc(c.title) + '</h4><span class="es-badge ' + m.badge + '">' + m.badgeText + '</span></div>' +
        '<div class="r2"><span class="amt es-mono">' + amountText(c) + '</span><span class="role">' + esc(roleText(c)) + '</span>' +
          '<span class="other">' + esc(counterpartyText(c)) + '</span></div>' +
        '<div class="r3">' + segBar(c) + '</div>' +
        '<div class="foot"><span class="cno">' + esc(c.code) + '</span>' +
          '<span class="st ' + m.foot + '">' + esc(m.footText) + '</span>' +
          '<span class="caret">' + ic('chevron') + '</span></div>' +
      '</div>' +
      '<div class="more"><div class="es-tl">' + timelineHTML(c) + '</div></div>' +
    '</article>';
  }

  /* ---- 订阅数据变化（本窗口自定义事件 + 跨窗口 storage） ---- */
  function subscribe(fn) {
    function h() { try { fn(); } catch (e) {} }
    window.addEventListener('engchain:esign', h);
    window.addEventListener('engchain:balance', h);
    window.addEventListener('storage', function (e) {
      if (e.key === 'engchain-esign' || e.key === 'engchain-balance' || e.key === null) h();
    });
  }

  /* ---- 身份门控 + 初始化 ---- */
  function lock(mode) {
    var view = document.querySelector('#esView,#esScroll,#v,.es-scroll,.es-view');
    if (!view) return;
    var isLogin = mode === 'guest';
    view.innerHTML =
      '<div style="padding:16px 14px 40px;"><div class="es-lock">' +
        '<div class="li">' + ic('lock') + '</div>' +
        '<h3>' + (isLogin ? '登录后使用电子签' : '完成入驻后开通电子签') + '</h3>' +
        '<p>' + (isLogin
          ? '电子签面向入驻企业与个人合伙人开放。登录后可处理待签合同、在线发起工程合同并查看司法存证。'
          : '完成<b>企业入驻</b>（建筑 / 中介 / 合伙人）或申请<b>个人合伙人</b>认证后，即可在线签署工程合同、购买签署次数并享受司法存证服务。') + '</p>' +
        '<button class="es-btn primary block" id="esLockCta">' + (isLogin ? '立即登录 / 注册' : '去认证中心开通') + '</button>' +
        '<div class="es-muted" style="margin-top:14px;">签署与存证由 ' + esc((MOCK.business.esign || {}).provider || 'e签宝') + ' 提供 · 合同内容仅签署双方可见</div>' +
      '</div></div>';
    $('#esLockCta').onclick = function () {
      location.href = isLogin ? '../auth/login.html' : '../profile/auth.html';
    };
  }
  function init(onReady) {
    document.addEventListener('DOMContentLoaded', function () {
      try { if (window.EsignStore && EsignStore.settleMyApprovedRefunds) EsignStore.settleMyApprovedRefunds(); } catch (e) {}
      try { if (window.EsignStore && EsignStore.expireDue) EsignStore.expireDue(); } catch (e) {}
      if (isGuest()) return lock('guest');
      if (!canUse()) return lock('dist');
      onReady({ user: user(), bundle: bundle() });
    });
  }

  /* ---- 发起流草稿（localStorage，单份进行中草稿） ---- */
  var DRAFT_KEY = 'engchain-esign-draft';
  var Draft = {
    get: function () { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } },
    set: function (d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} return d; },
    clear: function () { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  };
  function newDraft() {
    return { via: 'template', templateId: 't-material', title: '', project: '', location: '', detail: '', amount: '', payMethod: '', finishDate: '',
      fileName: '', meRole: '甲方', signOrder: 'unordered', parties: [], fieldsOk: {} };
  }

  /* 由草稿组装正式签署方并发送（扣次数/落库/审计均在 EsignStore） */
  function sendFromDraft(d) {
    var u = user() || {};
    var personal = isPersonal();
    var parties = [];
    parties.push({
      key: 'me', name: u.name || '当前用户', company: u.company || '个人合伙人 · ' + (u.name || ''),
      role: d.meRole || '甲方', signerType: personal ? 'personal' : 'enterprise',
      order: 1, ownerUid: u.id, status: 'pending'
    });
    (d.parties || []).forEach(function (cp, i) {
      parties.push({
        key: 'cp' + (i + 1), name: cp.name, company: cp.company, mobileMask: cp.mobileMask,
        role: cp.role || (d.meRole === '甲方' ? '乙方' : '甲方'),
        signerType: cp.signerType || 'enterprise',
        order: d.signOrder === 'sequential' ? i + 2 : 1, status: 'pending'
      });
    });
    return EsignStore.sendContract({
      draftId: d.id, via: d.via, templateId: d.templateId, fileName: d.fileName,
      title: d.title, amount: d.amount ? Number(d.amount) : 0,
      parties: parties, signOrder: d.signOrder
    });
  }

  /* ---- 步骤条 ---- */
  var STEP_LABELS = ['方式', '内容', '签署方', '签章位', '确认'];
  function stepsHTML(cur) {
    return '<div class="es-steps">' + STEP_LABELS.map(function (lb, i) {
      var cls = i < cur ? 'done' : (i === cur ? 'cur' : '');
      return '<div class="es-step ' + cls + '"><div class="dot">' + (i < cur ? '✓' : (i + 1)) + '</div>' + lb + '</div>';
    }).join('') + '</div>';
  }

  /* ---- 结构化合同正文（模板/上传统一渲染，替代纯白 PDF 占位） ---- */
  function fieldVal(d, k, fallback) {
    var v = d[k]; return (v === '' || v == null) ? (fallback || '＿＿＿＿＿＿') : esc(v);
  }
  function docSections(d) {
    var meName = (user() || {}).name || '', meCo = (user() || {}).company || ('个人合伙人 · ' + meName);
    var cp0 = (d.parties || [])[0] || { company: '（待添加对方）', name: '' };
    var oppCo = cp0.company || cp0.name || '（待添加对方）';
    var a = d.meRole === '甲方' ? [meCo, oppCo] : [oppCo, meCo];
    var amount = d.amount ? money(d.amount) : '＿＿＿＿';
    var secs = [
      ['一、合同双方', '<p>甲方：' + esc(a[0]) + '</p><p>乙方：' + esc(a[1]) + '</p>'],
      ['二、标的与项目', '<p>项目名称：' + fieldVal(d, 'project') + '</p>' + (d.location ? '<p>地点：' + fieldVal(d, 'location') + '</p>' : '')],
      ['三、数量与价款', '<p>' + esc(d.detail ? d.detail.replace(/\n/g, '<br>') : '详见合同附件清单') + '</p><p>合同总金额（含税）：' + amount + ' 元</p>'],
      ['四、履行与验收', '<p>' + (d.finishDate ? '履行/交货/完成期限：' + esc(d.finishDate) : '履行期限由双方另行约定') + '；按国家及行业标准验收。</p>'],
      ['五、付款方式', '<p>' + esc(d.payMethod || '由双方按进度协商支付') + '。甲方凭乙方合规发票付款。</p>'],
      ['六、双方责任', '<p>甲方按约提供条件并及时付款；乙方按约保质保量履行，提供合规票据与资料。</p>'],
      ['七、违约责任', '<p>任一方违约的，按合同金额及实际损失承担违约责任；逾期履行按日万分之三计违约金。</p>'],
      ['八、争议解决', '<p>因本合同发生争议，由工程所在地人民法院管辖；本合同采用电子方式签署，与纸质合同具同等效力。</p>']
    ];
    return secs;
  }
  function docHTML(d) {
    var signTitle = d.title || tpl(d.templateId).name;
    var parties = [{ key: 'me', company: (user() || {}).company || ('个人合伙人 · ' + ((user() || {}).name || '')) }].concat(
      (d.parties || []).map(function (cp, i) { return { key: 'cp' + (i + 1), company: cp.company || cp.name }; }));
    var signBoxes = parties.map(function (p) {
      return '<div class="signbox"><b>' + esc(p.company) + '</b><br>（盖章/签字）<br>日期：____年__月__日</div>';
    }).join('');
    var body = docSections(d).map(function (s) { return '<h4>' + s[0] + '</h4>' + s[1]; }).join('');
    return '<h2>' + esc(signTitle) + '</h2><div class="sub">合同编号：签署后自动生成 · 本文为结构化合同演示文本</div>' +
      body + '<h4>九、签章页</h4><div class="signarea">' + signBoxes + '</div>';
  }

  /* ==========================================================================
     完整合同正文（详情 / 签署 / 对方 H5 共用）
     依据模板生成符合签署规范的结构化条款：合同双方 → 鉴于 → 标的 → 质量/交付
     → 价款 → 包装/运输 → 权利义务 → 违约责任 → 保密 → 变更解除 → 争议解决
     → 生效与效力（电子签署声明）→ 附件 → 签章页。
     数字一律取自已落库合同（c.amount / c.parties / c.sentAt / c.deadline），
     缺失信息用规范占位（＿＿）或按条款说明，不编造具体数值。
     ========================================================================== */
  var CN_D = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  var CN_U = ['', '拾', '佰', '仟'], CN_B = ['', '万', '亿'];
  function amountCN(n) {
    n = Math.round(Number(n || 0));
    if (n === 0) return '人民币零元整';
    var s = String(n), groups = [], out = '';
    while (s.length > 4) { groups.unshift(s.slice(-4)); s = s.slice(0, -4); }
    groups.unshift(s);
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], gi = groups.length - i - 1, txt = '', pending = false;
      for (var j = 0; j < g.length; j++) {
        var d = +g[j], pos = g.length - j - 1;
        if (d === 0) { if (txt && pos > 0 && +g[j + 1] !== 0 && !pending) txt += '零'; }
        else { txt += CN_D[d] + (pos > 0 ? CN_U[pos] : ''); pending = false; }
      }
      if (txt) { if (gi > 0) txt += CN_B[gi]; out += txt; }
    }
    return '人民币' + out + '元整';
  }

  /* 已知演示主体的工商信息（其余主体仅展示企业名/联系人，不编造证照号） */
  var COMPANY_REG = {
    '成都恒信建材有限公司': { code: '91510100MA62QX8X3K', legal: '王强', addr: '成都市金牛区金府路 668 号', contact: '王强' },
    '四川省××建设有限公司': { code: '91510700MA67Y2C4P9', legal: '陈建国', addr: '成都市锦江区东大街 99 号', contact: '陈建国' }
  };
  function partyInfoLines(p) {
    var reg = COMPANY_REG[p.company] || null;
    var out = [];
    if (reg) {
      out.push('统一社会信用代码：' + reg.code + '　法定代表人：' + reg.legal);
      out.push('注册地址：' + reg.addr);
      out.push('联系人：' + (reg.contact || p.name || '') + (p.mobileMask ? '　联系电话：' + p.mobileMask : ''));
    } else {
      out.push((p.name ? '联系人：' + p.name : '企业名称：' + (p.company || '＿＿＿＿＿＿')));
      if (p.mobileMask) out.push('联系电话：' + p.mobileMask);
      out.push('统一社会信用代码 / 注册地址：以企业实名认证信息为准');
    }
    return out;
  }

  /* 页号标记：按正文长度自动分页（2~3 页） */
  function pageMarkers(count) {
    var pages = count > 9 ? 3 : 2;
    var size = Math.max(3, Math.ceil(count / pages));
    var out = [];
    for (var i = size; i < count; i += size) out.push(i);
    return out;
  }

  /* 每份合同的完整条款。返回 [{a,t,html}]，a 为目录锚点。 */
  function contractArticles(c) {
    var parties = (c.parties || []).length ? c.parties : [];
    var amt = c.amount > 0 ? money(c.amount) : '＿＿＿＿';
    var amtCN = c.amount > 0 ? amountCN(c.amount) : '＿＿＿＿';
    var sdate = ddate(c.sentAt || c.createdAt) || '____年__月__日';
    var ddate2 = c.deadline ? ddate(c.deadline) : '____年__月__日';
    var items = (c.detail && c.detail.items && c.detail.items.length) ? c.detail.items : null;
    var nItems = items ? items.length : 0;
    var qtyTotal = items ? items.reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0) : 0;
    var unit = (c.detail && c.detail.unit) || '（见附件清单）';
    function partyBlock() {
      return parties.map(function (p) {
        var lines = partyInfoLines(p);
        return '<div class="es-partyblock"><div class="pn">' + esc(p.role) + '（' +
          (p.signerType === 'personal' ? '签字' : '盖章') + '）：' + esc(p.company || p.name) + '</div>' +
          '<div class="pi">' + lines.map(esc).join('<br>') + '</div></div>';
      }).join('');
    }
    function tbl() {
      if (!items) return '';
      var rows = items.map(function (it, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(it.spec || it.name || '') + '</td>' +
          '<td class="num">' + (it.qty != null ? it.qty : '') + '</td><td class="num">' + (it.unit || '') + '</td>' +
          '<td class="num">' + (it.price != null ? money(it.price) : '') + '</td>' +
          '<td class="num">' + (it.amount != null ? money(it.amount) : '') + '</td></tr>';
      }).join('');
      return '<table><tr><th>序号</th><th>品名 / 规格</th><th class="num">数量</th><th class="num">单位</th>' +
        '<th class="num">单价</th><th class="num">金额</th></tr>' + rows +
        '<tr><td colspan="5" style="text-align:right">合计（含税）</td><td class="tamt es-mono">' + money(c.amount) + '</td></tr></table>';
    }

    var arts = [
      { a: 'a0', t: '合同双方', html: partyBlock() },
      { a: 'a1', t: '鉴于条款', html: '<p>鉴于' + esc(c.initiatorCompany || c.initiatorName || '发起方') + '与' +
        parties.map(function (p) { return esc(p.company || p.name); }).join('、') +
        '（以下合称"双方"，单称"一方"）拟就《' + esc(c.title) + '》事项达成合作，双方依据《中华人民共和国民法典》及相关法律法规，本着平等自愿、诚实信用原则，经协商一致订立本合同，以资共同遵守。</p>' }
    ];

    var core = [];
    if (c.templateId === 't-material') {
      core = [
        { t: '第一条　合同标的与数量', html:
          '<p>1.1　甲方向乙方采购的货物品种、规格、数量及单价如下（含税）：</p>' + (tbl() ||
            '<p class="noind">标的名称、规格、型号、数量与单价详见附件一《货物明细清单》，本合同签订时已由双方确认并随本合同同步生效。</p>') +
          (items ? '<p>1.2　上述合计数量 ' + qtyTotal + unit + '，合计金额（含税）' + amt + '；除双方书面确认外，合同期内单价不作调整。</p>'
            : '<p>1.2　除双方书面确认外，合同期内单价不作调整。</p>') },
        { t: '第二条　质量标准', html: '<p>2.1　货物应符合国家现行质量标准及双方约定标准，随货附出厂质量证明书、产品合格证等资料。</p>' +
          '<p>2.2　一方对质量有异议的，应在收货后 7 日内书面提出，双方共同委托具备资质的第三方机构检测；检测合格的，费用由异议方承担，不合格的由供货方承担。</p>' },
        { t: '第三条　交货与验收', html: '<p>3.1　交货地点：' + esc(c.location || '合同约定的工程现场指定地点') + '。</p>' +
          '<p>3.2　交货期限：' + (c.finishDate ? esc(c.finishDate) : '以甲方书面通知为准') + '，可分批交付。</p>' +
          '<p>3.3　验收：收货方在货到当日清点数量、核对规格与质量证明资料，验收合格后签署收货单，作为结算依据。</p>' },
        { t: '第四条　合同价款与支付', html: '<p>4.1　合同总金额（含税）为' + amt + '（大写：' + amtCN + '）。</p>' +
          '<p>4.2　支付方式：' + esc(c.payMethod || '货到验收合格后按约定账期支付') + '；付款方凭对方开具的合规增值税发票付款。</p>' +
          '<p>4.3　逾期付款的，按逾期金额的日万分之三向对方支付违约金。</p>' },
        { t: '第五条　包装与运输', html: '<p>5.1　运输与包装由供货方负责并承担费用；货物捆扎、标识应符合运输与卸货安全要求。</p>' +
          '<p>5.2　运输途中损耗与安全责任由供货方承担；因不可抗力导致延迟交货的，双方协商顺延。</p>' },
        { t: '第六条　双方权利义务', html: '<p>6.1　收货方应按约收货并支付货款，提供必要的堆场、卸货条件与现场配合。</p>' +
          '<p>6.2　供货方应按约保质保量、按期交货，并提供合规票据、质量证明及必要的技术资料。</p>' +
          '<p>6.3　未经对方书面同意，任何一方不得将本合同项下权利义务转让给第三方。</p>' },
        { t: '第七条　违约责任', html: '<p>7.1　供货方逾期交货的，每逾期一日按该批货款金额的 0.3% 支付违约金；逾期超过 15 日的，收货方有权解除合同并要求赔偿损失。</p>' +
          '<p>7.2　收货方逾期付款的，按逾期金额的日万分之三支付违约金。</p>' +
          '<p>7.3　违约金不足以弥补实际损失的部分，违约方应继续承担赔偿责任。</p>' },
        { t: '第八条　保密', html: '<p>8.1　双方对本合同内容及履行中知悉的对方商业秘密负有保密义务，未经对方书面同意不得向第三方披露，法律法规另有规定的除外。</p>' +
          '<p>8.2　保密义务自本合同签订之日起持续 2 年，不因本合同终止而失效。</p>' },
        { t: '第九条　合同变更与解除', html: '<p>9.1　本合同变更须经双方书面一致同意并签署补充协议；因项目取消或不可抗力致使合同无法履行的，双方协商解除，已履行部分据实结算。</p>' },
        { t: '第十条　争议解决', html: '<p>10.1　因本合同发生的争议，双方应友好协商解决；协商不成的，向' + esc(c.location ? '工程所在地' : '合同签订地') + '人民法院提起诉讼。</p>' +
          '<p>10.2　本合同的订立、效力、解释与履行均适用中华人民共和国法律。</p>' },
        { t: '第十一条　合同生效与效力', html: '<p>11.1　本合同采用电子方式签署，双方经实名认证后以电子签名 / 电子印章完成签署，自双方均完成签署之日起生效，与手写签名或加盖实体印章的纸质合同具有同等法律效力。</p>' +
          '<p>11.2　本合同为电子文本，签署完成后由存证机构出具存证证明，可作为司法证据核验。</p>' }
      ];
    } else if (c.templateId === 't-equipment') {
      core = [
        { t: '第一条　租赁标的', html: '<p>1.1　甲方将设备出租给乙方使用，设备名称、型号、数量及新旧程度详见附件一《设备清单》。</p>' +
          '<p>1.2　租赁设备用于' + esc(c.project || '合同约定的工程项目') + '，未经甲方书面同意不得转租或用于其他用途。</p>' },
        { t: '第二条　租期与租金', html: '<p>2.1　租赁期限自设备交付之日起至' + (c.finishDate ? esc(c.finishDate) : '双方约定的归还之日') + '止。</p>' +
          '<p>2.2　租金合计（含税）' + amt + '（大写：' + amtCN + '），结算方式：' + esc(c.payMethod || '按合同约定结算') + '。</p>' },
        { t: '第三条　交付与验收', html: '<p>3.1　甲方按约将设备交付至' + esc(c.location || '合同约定地点') + '，双方共同验收并签署交接单。</p>' +
          '<p>3.2　设备交付后至归还前的保管、操作安全责任由乙方承担；乙方应按操作规程使用并妥善保管。</p>' },
        { t: '第四条　维修与费用', html: '<p>4.1　租赁期内设备日常保养由乙方负责，正常损耗外的维修由甲方负责；因乙方操作不当造成的损坏由乙方承担修复费用。</p>' },
        { t: '第五条　双方权利义务', html: '<p>5.1　甲方保证设备权属清晰、可正常使用；乙方应按约支付租金并按时归还设备。</p>' +
          '<p>5.2　未经对方书面同意，任何一方不得转让本合同项下权利义务。</p>' },
        { t: '第六条　违约责任', html: '<p>6.1　任一方逾期履行义务的，按合同金额的日万分之三向对方支付违约金；逾期超过 15 日的，守约方有权解除合同。</p>' +
          '<p>6.2　违约金不足以弥补实际损失的部分，违约方应继续承担赔偿责任。</p>' },
        { t: '第七条　保密', html: '<p>7.1　双方对合同内容及履约中知悉的商业秘密负有保密义务，保密期限自签订之日起 2 年。</p>' },
        { t: '第八条　变更与解除', html: '<p>8.1　合同变更须双方书面一致同意；因不可抗力致使合同无法履行的，双方协商解除，已履行部分据实结算。</p>' },
        { t: '第九条　争议解决', html: '<p>9.1　争议协商不成的，向' + esc(c.location ? '工程所在地' : '合同签订地') + '人民法院提起诉讼。</p>' },
        { t: '第十条　合同生效与效力', html: '<p>10.1　本合同采用电子方式签署，经实名认证后以电子签名 / 电子印章签署，自双方均完成签署之日起生效，与纸质合同具有同等法律效力。</p>' +
          '<p>10.2　本合同为电子文本，签署完成后由存证机构出具存证证明，可作为司法证据核验。</p>' }
      ];
    } else if (c.templateId === 't-labor') {
      core = [
        { t: '第一条　分包范围与内容', html: '<p>1.1　甲方将' + esc(c.project || '合同约定的工程') + '中的劳务作业分包给乙方，分包范围与工作内容以双方确认的' + (c.detail && c.detail.text ? esc(c.detail.text) : '工程量清单 / 分包范围说明') + '为准。</p>' },
        { t: '第二条　工期与进度', html: '<p>2.1　开工与完工日期：' + (c.finishDate ? '至 ' + esc(c.finishDate) : '以甲方开工通知为准') + '；乙方应按进度计划组织作业。</p>' },
        { t: '第三条　价款与支付', html: '<p>3.1　合同价款（含税）' + amt + '（大写：' + amtCN + '），计价方式：' + esc(c.payMethod || '按约定计价') + '。</p>' +
          '<p>3.2　甲方按已完成并验收合格的工作量及约定节点支付，凭合规发票付款。</p>' },
        { t: '第四条　质量与安全', html: '<p>4.1　乙方作业应符合国家及行业施工质量、安全标准，遵守现场管理制度，对作业安全承担责任。</p>' },
        { t: '第五条　双方权利义务', html: '<p>5.1　甲方提供必要的作业条件与技术交底，按约支付价款；乙方应保证人员资质合规、服从现场管理、按约保质保量完成作业。</p>' },
        { t: '第六条　违约责任', html: '<p>6.1　任一方违约的，应承担继续履行、赔偿损失等责任；逾期履行的按日万分之三计违约金。</p>' },
        { t: '第七条　保密与廉洁', html: '<p>7.1　双方对合同内容及履约中知悉的信息承担保密义务；合作中不得从事商业贿赂等违法违规行为。</p>' },
        { t: '第八条　变更与解除', html: '<p>8.1　合同变更须双方书面一致同意；因不可抗力致使合同无法履行的，双方协商解除，已履行部分据实结算。</p>' },
        { t: '第九条　争议解决与生效', html: '<p>9.1　争议协商不成的，向工程所在地人民法院提起诉讼。</p>' +
          '<p>9.2　本合同采用电子方式签署，经实名认证后以电子签名 / 电子印章签署，自双方均完成签署之日起生效，与纸质合同具有同等法律效力；签署完成后由存证机构出具存证证明。</p>' }
      ];
    } else if (c.templateId === 't-nda') {
      core = [
        { t: '第一条　保密信息', html: '<p>1.1　保密信息指一方（披露方）向另一方（接收方）披露的与' + esc(c.project || '合作事项') + '相关的技术、商务、经营信息，包括但不限于图纸、数据、价格、客户与商业计划。</p>' },
        { t: '第二条　保密义务', html: '<p>2.1　接收方应仅为约定目的使用保密信息，不得向任何第三方披露，并采取与保护自身商业秘密同等的保护措施。</p>' +
          '<p>2.2　保密义务自本合同签订之日起持续 ' + (c.detail && c.detail.years ? esc(c.detail.years) : '2') + ' 年，不因本合同终止而失效。</p>' },
        { t: '第三条　例外情形', html: '<p>3.1　下列信息不属于保密信息：已公开的信息；接收方独立开发的信息；法律法规或监管机关要求披露的信息（披露范围以法定为准）。</p>' },
        { t: '第四条　违约责任', html: '<p>4.1　接收方违反保密义务的，应赔偿披露方因此遭受的直接损失，并承担相应法律责任。</p>' },
        { t: '第五条　争议解决与生效', html: '<p>5.1　争议协商不成的，向合同签订地人民法院提起诉讼。</p>' +
          '<p>5.2　本合同采用电子方式签署，经实名认证后以电子签名签署，自双方均完成签署之日起生效，与纸质合同具有同等法律效力。</p>' }
      ];
    } else if (c.templateId === 't-frame') {
      core = [
        { t: '第一条　合作宗旨', html: '<p>1.1　双方本着优势互补、长期共赢的原则，就' + esc(c.project || '约定合作领域') + '建立战略合作关系。</p>' },
        { t: '第二条　合作范围', html: '<p>2.1　合作范围包括：' + (c.detail && c.detail.text ? esc(c.detail.text) : '由双方在单笔合同中另行约定的具体事项') + '。</p>' },
        { t: '第三条　单笔合同', html: '<p>3.1　本协议为框架性约定；具体项目、数量、价格、交付及验收等以双方签署的单笔合同为准，单笔合同与本协议不一致的，以单笔合同为准。</p>' },
        { t: '第四条　合作期限', html: '<p>4.1　合作期限自本协议签署之日起至 ' + (c.finishDate ? esc(c.finishDate) : '约定终止之日') + '；期满双方可协商续签。</p>' },
        { t: '第五条　保密与诚信', html: '<p>5.1　双方对合作中知悉的商业秘密承担保密义务；合作中应遵守法律法规与商业道德。</p>' },
        { t: '第六条　解除与终止', html: '<p>6.1　任一方严重违约或出现重大信用风险时，另一方有权书面通知解除本协议；已履行部分据实结算。</p>' },
        { t: '第七条　争议解决与生效', html: '<p>7.1　争议协商不成的，向合同签订地人民法院提起诉讼。</p>' +
          '<p>7.2　本协议采用电子方式签署，经实名认证后以电子签名 / 电子印章签署，自各方均完成签署之日起生效，与纸质协议具有同等法律效力。</p>' }
      ];
    } else if (c.templateId === 't-service') {
      core = [
        { t: '第一条　服务内容', html: '<p>1.1　乙方向甲方提供' + esc(c.project || '约定的专业服务') + '，具体服务内容、交付成果以' + (c.detail && c.detail.text ? esc(c.detail.text) : '双方确认的服务方案') + '为准。</p>' },
        { t: '第二条　交付与验收', html: '<p>2.1　服务完成期限：' + (c.finishDate ? esc(c.finishDate) : '以约定为准') + '；交付成果由甲方按约定标准验收。</p>' },
        { t: '第三条　费用与支付', html: '<p>3.1　服务费用（含税）' + amt + '（大写：' + amtCN + '），支付方式：' + esc(c.payMethod || '按约定节点支付') + '。</p>' },
        { t: '第四条　双方义务', html: '<p>4.1　甲方应及时提供必要资料与配合；乙方应按约保质保量完成服务，并对其交付成果负责。</p>' },
        { t: '第五条　知识产权与保密', html: '<p>5.1　服务成果的知识产权归属及使用范围按双方书面约定执行；双方对合作中知悉的商业秘密承担保密义务。</p>' },
        { t: '第六条　违约责任', html: '<p>6.1　任一方违约的，应承担继续履行、赔偿损失等责任；逾期履行的按日万分之三计违约金。</p>' },
        { t: '第七条　争议解决与生效', html: '<p>7.1　争议协商不成的，向合同签订地人民法院提起诉讼。</p>' +
          '<p>7.2　本合同采用电子方式签署，经实名认证后以电子签名 / 电子印章签署，自双方均完成签署之日起生效，与纸质合同具有同等法律效力；签署完成后由存证机构出具存证证明。</p>' }
      ];
    } else {
      core = [
        { t: '第一条　合同标的', html: '<p>1.1　双方就《' + esc(c.title) + '》项下事项达成一致，具体标的、数量及内容以双方确认的约定为准。</p>' },
        { t: '第二条　价款与支付', html: '<p>2.1　合同金额（含税）' + amt + '（大写：' + amtCN + '），支付方式：' + esc(c.payMethod || '由双方协商确定') + '。</p>' },
        { t: '第三条　履行与验收', html: '<p>3.1　双方应按约履行义务并按国家及行业标准验收；' + (c.finishDate ? '履行/完成期限：' + esc(c.finishDate) + '。' : '') + '</p>' },
        { t: '第四条　双方权利义务', html: '<p>4.1　一方应提供必要的条件与配合，另一方应按约保质保量履行并提供合规票据与资料。</p>' },
        { t: '第五条　违约责任', html: '<p>5.1　任一方违约的，按合同金额及实际损失承担违约责任；逾期履行按日万分之三计违约金。</p>' },
        { t: '第六条　保密', html: '<p>6.1　双方对合同内容及履约中知悉的商业秘密承担保密义务，未经书面同意不得向第三方披露。</p>' },
        { t: '第七条　变更与解除', html: '<p>7.1　合同变更须双方书面一致同意；因不可抗力致使合同无法履行的，双方协商解除。</p>' },
        { t: '第八条　争议解决', html: '<p>8.1　争议协商不成的，向合同签订地人民法院提起诉讼。</p>' },
        { t: '第九条　生效与效力', html: '<p>9.1　本合同采用电子方式签署，经实名认证后以电子签名 / 电子印章签署，自双方均完成签署之日起生效，与纸质合同具有同等法律效力。</p>' }
      ];
    }

    arts = arts.concat(core.map(function (x, i) { return { a: 'a' + (i + 2), t: x.t, html: x.html }; }));

    /* 附件一（材料/设备/劳务带明细附件节；其余模板无附件或并入正文） */
    if (c.templateId === 't-material' || c.templateId === 't-equipment' || c.templateId === 't-labor') {
      arts.push({
        a: 'att', t: '附件一　' + (c.templateId === 't-material' ? '货物明细清单' : (c.templateId === 't-equipment' ? '设备清单' : '分包范围清单')),
        html: items ? tbl() + '<p class="noind">本附件与合同正文同步生效，共 ' + nItems + ' 项，合计金额（含税）' + amt + '。</p>'
          : '<p class="noind">本附件与合同正文同步生效；具体明细以发起方在签署前确认并上传的清单为准（共 ＿＿ 项，合计金额（含税）' + amt + '）。</p>'
      });
    }

    /* 签章页 */
    arts.push({
      a: 'sig', t: '签章页',
      html: '<div class="es-sigline">' + (parties.length ? parties.map(function (p) {
        var sealed = p.status === 'signed';
        var nm = p.company || p.name || '';
        var short = nm.length > 7 ? nm.slice(0, 7) : nm;
        return '<div class="es-sbox ' + (sealed ? 'sealed' : '') + '"><b>' + esc(p.role) + '（' +
          (p.signerType === 'personal' ? '签字' : '盖章') + '）</b>' +
          '<div class="es-sname">' + esc(nm) + '</div>' +
          (sealed ? '<div class="es-seal">' + esc(short) + '<br>电子签</div>' : '<div class="es-wa">待<br>签<br>署</div>') +
          (sealed && p.signedAt ? '<div class="es-sdate">' + esc(ddate(p.signedAt)) + ' · ' + esc(p.signMethod || '电子签名') + '</div>'
            : '<div class="es-sdate">日期：____年__月__日</div>') +
          '</div>';
      }).join('') : '<p class="noind">（签署方信息待确认）</p>') + '</div>'
    });
    return arts;
  }

  /* 目录（详情 / 签署共用，随正文锚点跳转） */
  function contractTOC(c) {
    return contractArticles(c).map(function (x, i) { return { a: x.a, t: x.t, no: i + 1 }; });
  }

  /* 完整合同文档 HTML。opts.sealMine：签署中把我方视作已签（落章后的即时反馈） */
  function contractDocHTML(c, opts) {
    opts = opts || {};
    var arts = contractArticles(c);
    var markers = pageMarkers(arts.length);
    var provider = (window.EsignStore && EsignStore.pricing && EsignStore.pricing().provider) || 'e签宝';
    var body = '<div class="es-doc" id="esDoc" style="--es-dfs:13px">' +
      '<div class="es-doc-meta"><span>合同编号：' + esc(c.code) + '</span><span>签订日期：' + esc(ddate(c.sentAt || c.createdAt) || '＿＿＿＿') + '</span>' +
      '<span>签订地点：' + esc(c.place || '成都市') + '</span></div>' +
      '<h2>' + esc(c.title) + '</h2><div class="dno es-mono">合同编号 ' + esc(c.code) + ' · 电子文本</div>' +
      '<svg class="es-docwm" viewBox="0 0 320 240" preserveAspectRatio="none" aria-hidden="true"><g fill="none">' +
      '<path d="M24 40h272M24 64h272M24 88h272M24 112h272M24 136h272M24 160h272M24 184h272" stroke="#8A6A30" stroke-width="1" opacity=".05"/>' +
      '<text x="160" y="150" text-anchor="middle" font-size="15" font-family="serif" fill="#B2442E" opacity=".10" transform="rotate(-12 160 150)">工程链 · 电子签 · 合同正文</text></g></svg>';
    arts.forEach(function (a, i) {
      body += '<div class="es-clause" data-a="' + a.a + '">' + (a.t ? '<h4>' + esc(a.t) + '</h4>' : '') + a.html + '</div>';
      if (markers.indexOf(i) >= 0) body += '<div class="es-pg">— 第 ' + (markers.indexOf(i) + 1) + ' 页 · 共 ' + (markers.length + 1) + ' 页 —</div>';
    });
    body += '<div class="es-doc-foot">本合同经电子方式签署，签署记录、签署时间与文件哈希由 ' + esc(provider) +
      ' 存证。全文共 ' + (arts.length - 1) + ' 条' + (c.templateId === 't-material' || c.templateId === 't-equipment' || c.templateId === 't-labor' ? ' 1 附件' : '') +
      '，签署前请完整阅读。</div></div>';
    return body;
  }

  /* 阅读进度：0~1，按文档在本滚动容器中的位置计算 */
  function docReadPct(scrollEl, docEl) {
    if (!scrollEl || !docEl) return 0;
    var sr = scrollEl.getBoundingClientRect(), dr = docEl.getBoundingClientRect();
    var docTop = dr.top - sr.top + scrollEl.scrollTop;
    var read = scrollEl.scrollTop + scrollEl.clientHeight - docTop;
    var h = docEl.offsetHeight || 1;
    return Math.max(0, Math.min(1, read / h));
  }

  /* ---- 对方 H5：检索跨用户"等待外部方签署"的合同（演示免登选择器） ---- */
  function externalPending() {
    var out = [];
    try {
      var s = EsignStore.read();
      Object.keys(s.byUid || {}).forEach(function (uid) {
        var sub2 = s.byUid[uid], list = sub2.contracts || [];
        list.forEach(function (c) {
          if (c.status !== 'pending_mine' && c.status !== 'signing') return;
          (c.parties || []).forEach(function (p) {
            if (!p.ownerUid && p.status === 'pending') {
              out.push({ ownerUid: uid, ownerName: c.initiatorCompany || c.initiatorName, id: c.id, code: c.code,
                title: c.title, partyKey: p.key, name: p.name, company: p.company, role: p.role, deadline: c.deadline });
            }
          });
        });
      });
    } catch (e) {}
    return out;
  }

  window.ES = {
    $: $, $$: $$, qs: qs, esc: esc, money: money, dtime: dtime, ddate: ddate, countdown: countdown,
    ic: ic, ICONS: ICONS,
    TEMPLATES: TEMPLATES, tpl: tpl,
    user: user, isGuest: isGuest, canUse: canUse, isPersonal: isPersonal, bundle: bundle,
    myParty: myParty, otherParties: otherParties, progress: progress, roleText: roleText,
    amountText: amountText, counterpartyText: counterpartyText, meta: meta,
    timeline: timeline, timelineHTML: timelineHTML, evidenceHTML: evidenceHTML, cardHTML: cardHTML,
    subscribe: subscribe, init: init,
    Draft: Draft, newDraft: newDraft, sendFromDraft: sendFromDraft,
    stepsHTML: stepsHTML, docHTML: docHTML, docSections: docSections, externalPending: externalPending,
    amountCN: amountCN, COMPANY_REG: COMPANY_REG,
    contractArticles: contractArticles, contractTOC: contractTOC, contractDocHTML: contractDocHTML,
    docReadPct: docReadPct
  };
})();
