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
    stepsHTML: stepsHTML, docHTML: docHTML, docSections: docSections, externalPending: externalPending
  };
})();
