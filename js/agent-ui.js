/* ============================================================================
   js/agent-ui.js —— M3-1/M3-3/M3-4/M3-5/M3-6/M3-10 视图装配（薄视图层）
   ----------------------------------------------------------------------------
   只渲染/接线与展示取值，不另造数据层，不改费率/税算/门控/存储键；
   复用 AgentStore/AgentLedger/AgentTax/AgentAccess/AgentEsign/OrgsStore。
   视觉层（视觉方案 v1）：状态中文词典+语义色、主次按钮、内联错误+toast、
   两分区只读台账表、暂停锁定、终止/封存独立说明块、二级两行卡片、统一空态。
   ============================================================================ */
(function (root) {
  'use strict';

  function g(n) { return root[n]; }
  function uid() { var db = g('DataBus'); return db && db.current ? (db.current() || {}).id || '' : ''; }
  function fmt(n) { return (Number(n) || 0).toFixed(2); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(sel) { return root.document ? root.document.querySelector(sel) : null; }

  /* ---------- 状态词典（H-04：中文 + 语义色，禁止渲染英文枚举） ---------- */
  var STATUS_LABEL = {
    active: ['已生效', 'ag-st-active'],
    pending: ['待审核', 'ag-st-pending'],
    suspended: ['已暂停', 'ag-st-suspended'],
    rejected: ['已驳回', 'ag-st-terminated'],
    terminated: ['已终止', 'ag-st-terminated'],
    revoked: ['已清退', 'ag-st-revoked'],
    approved: ['已通过', 'ag-st-active'],
    removed: ['已解除', 'ag-st-removed']
  };
  function badge(status) {
    var m = STATUS_LABEL[status] || ['状态未知', ''];
    return '<span class="ag-badge ' + m[1] + '">' + m[0] + '</span>';
  }

  /* L-2：O4 协议状态中文词典，禁裸英文枚举（completed/pending_mine/signing/rejected/draft） */
  var PROTO_STATUS = {
    completed: '已完成',
    pending_mine: '待我签署',
    signing: '签署中',
    rejected: '已拒签',
    draft: '草稿'
  };
  function protoStatusTxt(s) { return PROTO_STATUS[s] || '状态未知'; }

  /* L-2：总代视角协议状态词典（甲方视角：pending_mine 意为“待二级签署”，非“待我签署”；
     T1 协议中心/档案/详情共用，T2 二级视角仍用 protoStatusTxt 的“待我签署”） */
  var PROTO_TXT_OWNER = {
    pending: '待发起',
    pending_mine: '待二级签署',
    completed: '已签署',
    rejected: '已拒签'
  };
  function protoTxtOwner(s) { return PROTO_TXT_OWNER[s] || protoStatusTxt(s); }

  /* ---------- 统一 toast（H-4：成功/失败/警告三态，单一实现；兼容旧布尔 ok） ---------- */
  function toast(msg, kind) {
    if (typeof document === 'undefined') return;
    /* 兼容旧调用：toast(msg, true)=成功，false=失败；新调用 toast(msg,'warn') */
    if (kind === true) kind = 'ok';
    else if (kind === false) kind = 'err';
    if (!kind) kind = 'ok';
    var variant = kind === 'err' ? ' ag-toast--err' : kind === 'warn' ? ' ag-toast--warn' : ' ag-toast--ok';
    var t = document.getElementById('ag-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ag-toast';
      t.className = 'ag-toast';
      document.body.appendChild(t);
    }
    t.className = 'ag-toast ag-toast--show' + variant;
    t.textContent = msg || '';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'ag-toast'; }, 2400);
  }

  /* S1-2：协议取最新一条（listBySub 按 push 序追加，重新发起后最新在后）；
     避免固定取 [0] 导致重新发起后仍显示旧 rejected 合同 */
  function latestContract(E, subId) {
    var list = E && E.listBySub ? (E.listBySub(subId) || []) : [];
    return list.length ? list[list.length - 1] : null;
  }
  function latestContractId(E, subId) {
    var c = latestContract(E, subId);
    return c ? c.id : '';
  }

  /* ---------- H-1/H-5 统一底部抽屉（遮罩/×/Esc 三通道关闭，锁背景滚动） ----------
     R-3：关闭时摘除旧遮罩/抽屉节点，避免重复开关累积隐藏 DOM */
  function closeDrawer() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.ag-drawer-mask,.ag-drawer').forEach(function (n) { n.remove(); });
    document.body.style.overflow = '';
  }
  function openDrawer(opts) {
    if (typeof document === 'undefined' || !opts) return null;
    closeDrawer();
    var doc = root.document;
    var mask = doc.createElement('div');
    mask.className = 'ag-drawer-mask';
    var drawer = doc.createElement('div');
    drawer.className = 'ag-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.innerHTML = '<div class="ag-drawer__grab"></div>'
      + '<div class="ag-drawer__head"><div class="ag-drawer__title">' + esc(opts.title || '') + '</div>'
      + '<button class="ag-drawer__close" type="button" aria-label="关闭">×</button></div>'
      + '<div class="ag-drawer__body"></div>'
      + (opts.footHtml ? '<div class="ag-drawer__foot">' + opts.footHtml + '</div>' : '');
    doc.body.appendChild(mask);
    doc.body.appendChild(drawer);
    var body = drawer.querySelector('.ag-drawer__body');
    body.innerHTML = opts.bodyHtml || '';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { mask.classList.add('is-open'); drawer.classList.add('is-open'); });
    function close() { closeDrawer(); }
    mask.onclick = close;
    drawer.querySelector('.ag-drawer__close').onclick = close;
    doc.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); doc.removeEventListener('keydown', esc); }
    });
    if (opts.onOpen) opts.onOpen({ body: body, drawer: drawer, close: close });
    return { body: body, drawer: drawer, close: close };
  }

  /* ---------- 居中确认弹窗（危险操作：遮罩不可点关，说明不可逆后果） ---------- */
  function openConfirm(opts) {
    if (typeof document === 'undefined' || !opts) return;
    var doc = root.document;
    var mask = doc.createElement('div');
    mask.className = 'ag-modal-mask';
    mask.innerHTML = '<div class="ag-modal" role="alertdialog">'
      + '<div class="ag-modal__title">' + esc(opts.title || '确认操作') + '</div>'
      + '<div class="ag-modal__desc">' + esc(opts.desc || '') + '</div>'
      + '<div class="ag-modal__acts">'
      + '<button class="ag-btn ag-btn--ghost" type="button" data-cancel>取消</button>'
      + '<button class="ag-btn ag-btn--danger" type="button" data-ok>' + esc(opts.dangerLabel || '确认') + '</button>'
      + '</div></div>';
    doc.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('is-open'); });
    mask.querySelector('[data-cancel]').onclick = function () { mask.remove(); };
    mask.querySelector('[data-ok]').onclick = function () {
      mask.remove();
      if (opts.onConfirm) opts.onConfirm();
    };
  }

  /* ---------- S1-3 组件级 busy 防重（点击置灰 + 「处理中」，失败原位恢复可重试） ---------- */
  function busy(btn, label, fn) {
    if (!btn || btn.disabled) return;
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = label || '处理中…';
    var restore = function () { btn.disabled = false; btn.textContent = orig; };
    try {
      var r = fn();
      if (r && typeof r.then === 'function') r.then(restore, restore);
      else restore();
    } catch (e) { restore(); throw e; }
  }

  /* D-6：叠加身份实时推导（entryAccess 实时计算，不读 seed 写死的 union） */
  function isIndividualPartnerNow() {
    var acc = typeof g('entryAccess') === 'function' ? g('entryAccess')() : null;
    return !!(acc && acc.isIndividualPartner);
  }

  /* ---------- 成员名解析（M-06：姓名/公司回退 uid） ---------- */
  function nameOf(uidVal) {
    var db = g('DataBus');
    var u = db && db.byId ? db.byId(uidVal) : null;
    if (u && u.name) return u.name;
    return uidVal || '成员';
  }
  function fmtDate(ts) {
    var d = new Date(Number(ts) || Date.now());
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* 真实省表 quotaCap（max(minCap,cityCount)），禁止 n/10 残留 */
  function quotaCap(province) {
    var Rules = g('AgentRules');
    if (Rules && Rules.quotaCapOf) {
      var cfg = (g('MOCK') && g('MOCK').business && g('MOCK').business.provinceAgentQuota) || null;
      var r = Rules.quotaCapOf(province, cfg);
      return typeof r === 'number' ? r : (r && r.quotaCap) || 10;
    }
    return 10;
  }

  /* 统一空态（M-08：无 demo 播种文案；S2-6 场景图标：subs 无二级 / proto 无协议 / rec 无记录 / inv 无邀请，缺省同 rec） */
  var EMPTY_ICONS = {
    subs: '<svg class="ag-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
    proto: '<svg class="ag-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    rec: '<svg class="ag-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>',
    inv: '<svg class="ag-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>'
  };
  function emptyState(title, sub, icon) {
    return '<div class="ag-empty">'
      + (EMPTY_ICONS[icon] || EMPTY_ICONS.rec)
      + '<div class="ag-empty__title">' + esc(title) + '</div>'
      + (sub ? '<div class="ag-empty__sub">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function escAttr(s) { return esc(s).replace(/'/g, '&#39;'); }

  /* ---------- 阶段2 辅助（纯展示聚合，不改费率/计算） ---------- */
  function esign() { return g('AgentEsign') || null; }

  /* 归属总代主体：按 parentUid 反查省级总代记录的公司名（T2 归属信息） */
  function parentCompanyOf(parentUid) {
    var Store = g('AgentStore');
    if (!Store || !parentUid) return '';
    var pa = (Store.listProvinces() || []).filter(function (p) { return p.uid === parentUid; })[0];
    return pa && pa.branchCompany ? (pa.branchCompany.name || '') : '';
  }

  /* T+7 冻结聚合：笔数 + 金额（仅合格消费、未退款、frozen） */
  function frozenStats(entries, Ledger, predicate) {
    var count = 0, amount = 0;
    (entries || []).forEach(function (e) {
      if (e.frozenStatus !== 'frozen' || e.refunded) return;
      if (!Ledger.isEligibleConsumption(e.type, Ledger.DEFAULTS)) return;
      if (predicate && !predicate(e)) return;
      count++; amount = Ledger.round2(amount + (Number(e.amount) || 0));
    });
    return { count: count, amount: amount };
  }

  /* 当前月键（本月口径），与 Ledger.monthKey 同格式 */
  function thisMonth() { return g('AgentLedger').monthKey(Date.now()); }

  /* C5 状态中心时间线：合并 statusLog + ratioLog（比例变更次级标注） */
  function timelineHtml(statusLog, ratioLog, opts) {
    opts = opts || {};
    /* E1-T2-04：二级视角隐藏内部 operator（admin/播种），只展示事件与结果原因 */
    function metaOf(l) {
      if (opts.hideOperator) { return l.reason ? String(l.reason) : ''; }
      return (l.operator ? '操作方：' + l.operator : '') + (l.reason ? ' · ' + l.reason : '');
    }
    var items = [];
    (statusLog || []).forEach(function (l) {
      var tone = l.toStatus === 'suspended' ? 'suspended'
        : (l.toStatus === 'terminated' || l.toStatus === 'revoked') ? 'terminated'
        : (l.toStatus === 'revoked' || l.toStatus === 'removed') ? 'revoked' : 'active';
      items.push({ at: l.at, tone: tone, event: (STATUS_LABEL[l.toStatus] || [l.toStatus])[0], meta: metaOf(l) });
    });
    (ratioLog || []).forEach(function (r) {
      items.push({ at: r.at, tone: 'active', event: '约定比例调整为 ' + fmt((r.ratio || 0) * 100) + '%', meta: metaOf(r) });
    });
    items.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    if (!items.length) return emptyState('暂无状态变更记录', '开通/比例/状态变更会在此留痕。', 'rec');
    return '<ul class="ag-timeline">' + items.map(function (it) {
      return '<li data-tone="' + it.tone + '"><div class="ag-timeline__t">' + fmtDate(it.at) + '</div>'
        + '<div class="ag-timeline__e">' + esc(it.event) + '</div>'
        + (it.meta ? '<div class="ag-timeline__m">' + esc(it.meta) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* C4 授权证书静态卡（demo 静态；suspended/terminated 同步置灰） */
  function certiHtml(me) {
    var off = me.status === 'terminated' || me.status === 'revoked' || me.sealedAt;
    var no = 'DEMO-AG-' + (me.uid || me.id || '').toUpperCase();
    return '<div class="ag-certi ' + (off ? 'is-off' : '') + '">'
      + '<svg class="ag-certi__shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/></svg>'
      + '<div class="ag-certi__prov">授权省：' + esc(me.province || '—') + '</div>'
      + '<div class="ag-certi__field">被授权主体：' + esc((me.branchCompany && me.branchCompany.name) || '—') + '</div>'
      + '<div class="ag-certi__field">证书编号：<span class="ag-certi__no">' + esc(no) + '</span></div>'
      + '<div class="ag-certi__field">有效期：以平台核发通知为准</div>'
      + '<div class="ag-mt-2">' + badge(me.status) + '</div>'
      + '<div class="ag-disc">本平台演示环境证书，正式编号与签发以平台核发为准。</div></div>';
  }

  /* ---------- P2-3 正式徽章：总代盾 / 二级六边形（明度+形状双编码；不改既有五档用户徽章） ---------- */
  function emblemHtml(kind, sm) {
    if (kind === 'pa') return '<span class="ag-emblem ag-emblem--shield' + (sm ? ' is-sm' : '') + '">省代</span>';
    if (kind === 'sub') return '<span class="ag-emblem ag-emblem--hex' + (sm ? ' is-sm' : '') + '">二级</span>';
    return '';
  }

  /* ---------- P2-2 本地公告位（静态非推送；关闭按 id 写 localStorage 记忆；无公告不渲染） ---------- */
  var LOCAL_NOTICES = [
    { id: 'ann-2026-10', text: '省级总代与二级合作体系已上线，结算按 T+7 冻结后入账；本公告为本地静态展示，非平台推送。' }
  ];
  function localNoticeHtml() {
    var out = '';
    LOCAL_NOTICES.forEach(function (n) {
      try { if (localStorage.getItem('ag-notice:' + n.id)) return; } catch (e) { return; }
      out += '<div class="ag-notice-local" data-notice="' + escAttr(n.id) + '">'
        + '<svg class="ag-notice-local__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/></svg>'
        + '<div class="ag-notice-local__body"><span class="ag-notice-local__head">公告</span>' + esc(n.text) + '</div>'
        + '<button type="button" class="ag-notice-local__close" data-notice-close="' + escAttr(n.id) + '" aria-label="关闭公告">×</button></div>';
    });
    return out;
  }

  /* ---------- P2-1 台账月份切换（纯视图切片；看板/累计汇总口径不随切换改变） ---------- */
  function ymOf(ts) {
    var d = new Date(Number(ts) || Date.now());
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function monthShift(ym, delta) {
    var p = String(ym).split('-').map(Number);
    var d = new Date(p[0] || 1970, (p[1] || 1) - 1 + delta, 1);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  /* P2-1 模块级月份切片绑定（纯视图；看板/累计口径不随切换改变；空月走 ag-empty） */
  var __mlState = new WeakMap();
  function mountMonthLedger(holder, allRows, tableFn) {
    if (!holder) return;
    function render() {
      var now = thisMonth();
      var cur = __mlState.get(holder) || now;
      var isCur = cur === now;
      var rows = allRows.filter(function (e) { return (e.month || ymOf(e.at)) === cur; });
      var nextDisabled = monthShift(cur, 1) > now;
      var switcher = '<div class="ag-month-switch ag-seg">'
        + '<button type="button" data-ml-prev aria-label="上月">‹</button>'
        + '<span class="ag-ms-label' + (isCur ? ' is-today' : '') + '" data-ml-today>' + (isCur ? '本月' : cur) + '</span>'
        + '<button type="button" data-ml-next' + (nextDisabled ? ' disabled' : '') + ' aria-label="下月">›</button></div>';
      holder.innerHTML = switcher + (rows.length ? tableFn(rows)
        : emptyState(cur + ' 暂无结算记录', '切换其他月份查看，口径与累计一致'));
      bindLedgerScrollHints(holder);
    }
    render();
    holder.onclick = function (e) {
      var now = thisMonth();
      var prev = e.target.closest ? e.target.closest('[data-ml-prev]') : null;
      var next = e.target.closest ? e.target.closest('[data-ml-next]') : null;
      var today = e.target.closest ? e.target.closest('[data-ml-today]') : null;
      if (prev) __mlState.set(holder, monthShift(__mlState.get(holder) || now, -1));
      else if (next && !next.disabled) __mlState.set(holder, monthShift(__mlState.get(holder) || now, 1));
      else if (today) __mlState.delete(holder);
      else return;
      render();
    };
  }

  /* ---------- H-02 两分区只读台账明细表 ---------- */
  function ledgerTable(entries, ratioUsed, Ledger, ratioMap, opts) {
    opts = opts || {};
    var DEFAULTS = Ledger.DEFAULTS || {};
    var rows = (entries || []).map(function (e) {
      var isSelf = e.line === 'selfLedger';
      var settled = e.frozenStatus === 'settled' && !e.refunded;
      var eligible = Ledger.isEligibleConsumption(e.type, DEFAULTS);
      /* D-15：税注记行（tax_note）单独标注，不计入结算消费/总盘/约定/自留 */
      if (e.type === 'tax_note') {
        var nNote = e.note || (e.tax && e.tax.note) || '税注记';
        return '<tr><td>' + fmtDate(e.at) + '</td><td>' + esc(e.serialNo || '—') + '</td>'
          + '<td>税注记</td><td class="ag-num">—</td><td class="ag-num">—</td>'
          + '<td class="ag-num">—</td><td class="ag-num">—</td>'
          + '<td><span class="ag-badge" style="color:var(--text-3);">税注记</span></td>'
          + '<td class="ag-tax-note">' + esc(nNote) + '</td></tr>';
      }
      var rowPool = '', rowAgreed = '', rowRetained = '', note = '';
      var statusCls, statusTxt;
      if (e.refunded || e.clawed) { statusCls = 'ag-rs-refunded'; statusTxt = '已退款/冲减'; }
      else if (e.frozenStatus === 'frozen') { statusCls = 'ag-rs-frozen'; statusTxt = '冻结中(T+7)'; }
      else if (settled) { statusCls = 'ag-rs-settled'; statusTxt = '已结算'; }
      else { statusCls = 'ag-rs-refunded'; statusTxt = e.frozenStatus || '—'; }

      if (isSelf) {
        rowPool = '—';
        rowAgreed = settled && eligible ? '自身10% ' + fmt(Ledger.round2((Number(e.amount) || 0) * DEFAULTS.selfRate)) : '—';
        rowRetained = '—';
      } else if (settled && eligible) {
        var gp = Ledger.round2((Number(e.amount) || 0) * DEFAULTS.grossShare);
        /* D-4：按该二级自身 ratioToSub 算约定，不再统一取 subs[0] */
        var rowRatio = (ratioMap && ratioMap[e.subject] != null) ? Number(ratioMap[e.subject]) : (Number(ratioUsed) || 0);
        var ga = Ledger.round2(gp * rowRatio);
        rowPool = fmt(gp); rowAgreed = fmt(ga); rowRetained = opts.hideRetained ? '—' : fmt(Ledger.round2(gp - ga));
      } else {
        rowPool = rowAgreed = rowRetained = '—';
      }
      if (e.tax && e.tax.tax != null) {
        note = '预扣 ' + fmt(e.tax.tax) + ' / 税后 ' + fmt(e.tax.net) + (e.tax.certNo ? ' · ' + esc(e.tax.certNo) : '');
      } else if (e.refunded) {
        note = e.redOffset ? '红字冲减 ' + fmt(e.redOffset) : (e.clawed ? '等额冲减 ' + fmt(e.refundAmount || 0) : '已剔除');
      } else if (e.type === 'recharge') {
        note = '充值不进基数';
      }

      var serial = e.refunded ? '<span class="ag-serial-del">' + esc(e.serialNo || '—') + '</span>' : esc(e.serialNo || '—');
      return '<tr>'
        + '<td>' + fmtDate(e.at) + '</td>'
        + '<td>' + serial + '</td>'
        + '<td>' + (isSelf ? '自身线' : '二级线') + '</td>'
        + '<td class="ag-num">' + fmt(e.amount) + '</td>'
        + '<td class="ag-num">' + rowPool + '</td>'
        + '<td class="ag-num">' + rowAgreed + '</td>'
        + '<td class="ag-num">' + rowRetained + '</td>'
        + '<td><span class="ag-row-status ' + statusCls + '">' + statusTxt + '</span></td>'
        + '<td class="ag-tax-note">' + note + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="ag-ledger-scroll" data-ledger-scroll="1"><table class="ag-ledger">'
      + '<thead><tr><th>日期</th><th>流水号</th><th>线别</th><th>结算消费</th><th>总盘×50%</th><th>约定</th><th>自留</th><th>状态</th><th>税/冲减备注</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-3);">暂无台账记录</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  /* S2-5：台账横滑到最右时隐藏右缘遮罩（is-at-end），DOM 重挂后重新绑定 */
  function bindLedgerScrollHints(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-ledger-scroll]').forEach(function (sc) {
      if (sc.dataset.bound === '1') return;
      sc.dataset.bound = '1';
      var sync = function () {
        var atEnd = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4;
        sc.classList.toggle('is-at-end', atEnd);
      };
      sync();
      sc.addEventListener('scroll', sync, { passive: true });
    });
  }

  /* ---------- M3-1 总代工作台 ---------- */
  function mountWorkbench(rootEl) {
    var el = typeof rootEl === 'string' ? $(rootEl) : rootEl;
    if (!el || !g('AgentStore')) return;
    var U = uid(), Store = g('AgentStore'), Ledger = g('AgentLedger'), Tax = g('AgentTax');
    /* 全状态查找：active/suspended 进入工作台；terminated/revoked/sealed 走独立说明块 */
    var me = null, sealed = false;
    (Store.listProvinces() || []).forEach(function (p) { if (p.uid === U) { me = p; } });
    if (me) sealed = !!Number(me.sealedAt);

    /* H-06：终止/封存独立只读说明块，不复用「未开通」空文案；
       D-1：terminated/revoked 优先于 sealedAt，封存仅在生效态单独成块，互不覆盖 */
    var isTerminated = me && (me.status === 'terminated' || me.status === 'revoked');
    if (me && (isTerminated || sealed)) {
      var termTitle, termDesc;
      if (me.status === 'revoked') {
        termTitle = '账号已清退';
        termDesc = '违规清退为不可逆状态，无恢复入口；台账与协议转为只读，不再产生新的约定/自留分成。';
      } else if (me.status === 'terminated') {
        termTitle = '账号已解约 · 已终止';
        termDesc = '该省独家授权已收回，终止为不可逆状态，无恢复入口；台账与协议转为只读，不再产生新的约定/自留分成。';
      } else {
        termTitle = '账号已封存 · 只读';
        termDesc = '封存仅标记只读，原始记录完整保留；台账与协议可查阅，不再产生新的约定/自留分成。';
      }
      /* D-10：终止/封存独立块内提供封存台账只读折叠区（复用现有只读表，不产生新操作） */
      var sealedEntries = (Store.listLedger() || []).filter(function (e) { return e.line === 'subLedger' || e.line === 'selfLedger'; });
      var ledgerFold = '<details class="ag-card ag-mt-3"><summary class="ag-ledger-fold__summary">查看封存台账（只读）</summary>'
        + ledgerTable(sealedEntries, 0, Ledger) + '</details>';
      el.innerHTML = '<div class="ag-wrap">'
        + '<div class="ag-terminal ag-card">'
        + '<svg class="ag-terminal__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'
        + '<div class="ag-terminal__title">' + termTitle + '</div>'
        + '<div class="ag-terminal__desc">' + termDesc + '</div>'
        + badge(me.status)
        + '</div>'
        + ledgerFold
        + '</div>';
      return;
    }

    if (!me || (me.status !== 'active' && me.status !== 'suspended')) {
      el.innerHTML = '<div class="ag-wrap">' + emptyState(
        '当前账号未开通省级总代',
        '开通需经平台人工审核（¥0）；可在入驻类型选择页提交省级总代（省代）申请。', 'subs') + '</div>';
      return;
    }

    var locked = me.status === 'suspended';
    var E = esign();
    var protoCount = (subs || []).filter(function (s) {
      return !!(latestContract(E, s.id));
    }).length;
    var cap = quotaCap(me.province);
    var used = Store.countActiveSubAgents ? Store.countActiveSubAgents(me.id)
      : (Store.listSubs() || []).filter(function (s) { return s.parentUid === U && (s.status === 'approved' || s.status === 'suspended'); }).length;
    var subs = (Store.listSubs() || []).filter(function (s) { return s.parentUid === U; });
    /* T2-4 自动发起 O4：平台终审已通过（approved）的企业自助申请（appliedBy==='self'），
       未签约且无在途协议时自动发起合作协议（双轨路径②自动衔接；现状路径保留手动发起） */
    var autoSend = [];
    subs.forEach(function (s) {
      if (s.status !== 'approved' || s.appliedBy !== 'self') return;
      if (s.signature && s.signature.status === 'completed') return;
      if (latestContract(E, s.id)) return;
      var rr = E.sendContract({
        subId: s.id, parentUid: U, subUid: s.uid || '',
        parentName: (me.branchCompany && me.branchCompany.legalRep) || '总代',
        parentCompany: (me.branchCompany && me.branchCompany.name) || me.province,
        subName: (s.company && s.company.legalRep) || '',
        subCompany: (s.company && s.company.name) || ''
      });
      if (rr.ok) {
        autoSend.push(s.company && s.company.name || s.id);
        s.statusLog = s.statusLog || [];
        s.statusLog.push({ operator: 'platform', at: Date.now(), reason: '平台终审通过，自动发起合作协议', fromStatus: 'approved', toStatus: 'approved' });
        Store.saveSub(s);
      }
    });
    var entries = Store.listLedger() || [];
    /* D-4：二级自身比例映射，台账按每条二级自身 ratioToSub 计算约定/自留 */
    var ratioByUid = {};
    subs.forEach(function (s) { ratioByUid[s.uid] = Number(s.ratioToSub) || 0; });
    var ratioUsed = (subs[0] && subs[0].ratioToSub) || 0;
    var sub = Ledger.partitionSubtotals(entries, Object.assign({}, Ledger.DEFAULTS, { _ratio: ratioUsed }));
    /* D-4：按二级逐笔累加约定/自留，覆盖单比例口径（总盘不变） */
    var perAgreed = 0, perRetained = 0;
    entries.filter(function (e) {
      return e.line === 'subLedger' && e.frozenStatus === 'settled' && !e.refunded
        && Ledger.isEligibleConsumption(e.type, Ledger.DEFAULTS);
    }).forEach(function (e) {
      var gp = Ledger.round2((Number(e.amount) || 0) * Ledger.DEFAULTS.grossShare);
      var r = ratioByUid[e.subject] != null ? Number(ratioByUid[e.subject]) : ratioUsed;
      var ga = Ledger.round2(gp * r);
      perAgreed = Ledger.round2(perAgreed + ga);
      perRetained = Ledger.round2(perRetained + Ledger.round2(gp - ga));
    });
    sub.subLedger.agreed = perAgreed;
    sub.subLedger.retained = perRetained;

    /* P1-1 经营看板：本月/累计双口径纯聚合（不改费率）；T+7 冻结笔数+金额独立成卡 */
    var curMonth = thisMonth();
    function agg(rows) {
      var gross = 0, agreed = 0, retained = 0, selfBase = 0;
      rows.forEach(function (e) {
        if (e.frozenStatus !== 'settled' || e.refunded || e.clawed) return;
        if (!Ledger.isEligibleConsumption(e.type, Ledger.DEFAULTS)) return;
        if (e.line === 'subLedger') {
          var gp = Ledger.round2((Number(e.amount) || 0) * Ledger.DEFAULTS.grossShare);
          var r = ratioByUid[e.subject] != null ? Number(ratioByUid[e.subject]) : ratioUsed;
          var ga = Ledger.round2(gp * r);
          gross = Ledger.round2(gross + (Number(e.amount) || 0));
          agreed = Ledger.round2(agreed + ga);
          retained = Ledger.round2(retained + Ledger.round2(gp - ga));
        } else if (e.line === 'selfLedger') {
          selfBase = Ledger.round2(selfBase + (Number(e.amount) || 0));
        }
      });
      return { gross: gross, pool: Ledger.round2(gross * Ledger.DEFAULTS.grossShare), agreed: agreed, retained: retained, selfAmt: Ledger.round2(selfBase * Ledger.DEFAULTS.selfRate) };
    }
    var cumAgg = agg(entries);
    var monAgg = agg(entries.filter(function (e) { return e.month === curMonth; }));
    var frozen = frozenStats(entries, Ledger, function (e) { return e.line === 'subLedger'; });

    function boardCell(lb, val, sub) {
      return '<div class="ag-board-cell"><div class="ag-board-cell__lb">' + lb + '</div>'
        + '<div class="ag-board-cell__val">¥' + fmt(val) + '</div>'
        + (sub ? '<div class="ag-board-cell__sub">' + esc(sub) + '</div>' : '') + '</div>';
    }
    var boardHtml = function (mode) {
      var a = mode === 'month' ? monAgg : cumAgg;
      return '<div class="ag-seg" id="ag-board-seg">'
        + '<button data-mode="month" class="' + (mode === 'month' ? 'is-on' : '') + '">本月</button>'
        + '<button data-mode="cum" class="' + (mode === 'cum' ? 'is-on' : '') + '">累计</button></div>'
        /* S2-7：主收益「约定所得」置顶大数字卡（挂接 .ag-big），辅助指标网格次级弱化 */
        + '<div class="ag-hero ag-card--deep">'
        + '<div class="ag-hero__lb">约定所得（' + (mode === 'month' ? '本月' : '累计') + '）</div>'
        + '<div class="ag-big">¥' + fmt(a.agreed) + '</div>'
        + '<div class="ag-hero__sub">' + (mode === 'month' ? '本月已结算' : '累计已结算') + ' · 模拟测算，非税务意见</div></div>'
        + '<div class="ag-board-grid">'
        + boardCell('合格消费', a.gross, mode === 'month' ? '本月已结算' : '累计已结算')
        + boardCell('总盘(×50%)', a.pool)
        + boardCell('总代自留', a.retained)
        + boardCell('自身10%', a.selfAmt, '自身线独立分区')
        + '<div class="ag-board-cell ag-board-cell--frozen"><div class="ag-board-cell__lb">T+7 冻结待结算</div>'
        + '<div class="ag-board-cell__val">' + frozen.count + ' 笔</div>'
        + '<div class="ag-board-cell__sub">¥' + fmt(frozen.amount) + '</div></div>'
        + '</div>';
    };

    var rootCls = 'ag-wrap' + (locked ? ' ag-is-locked' : '');
    var lockBanner = locked
      ? '<div class="ag-lock-banner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px;"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>'
        + '<div><b>账号已暂停</b>：发起二级、比例补改、协议操作已锁定，台账只读保留；恢复生效后自动解锁。</div></div>'
      : '';

    /* P0-5 本地代理通知位：pending 二级待审 / 已开通待签约（纯本地推导，不做真实推送）
       T2 双轨：appliedBy==='self' 走总代初审→平台终审；现状（无标记）走平台直接审核 */
    var pendBySelf = subs.filter(function (s) { return s.status === 'pending' && s.appliedBy === 'self'; });
    var pendByAdmin = subs.filter(function (s) { return s.status === 'pending' && !s.appliedBy; });
    var unsigned = subs.filter(function (s) {
      if (s.status !== 'approved') return false;
      var cs = s.signature && s.signature.status === 'completed';
      var c = latestContract(E, s.id);
      return !cs && !(c && c.status === 'pending_mine');
    });
    var noticeItems = [];
    if (autoSend.length) noticeItems.push('平台终审已通过，自动发起 ' + autoSend.length + ' 份合作协议（待二级签署）');
    if (pendBySelf.length) noticeItems.push(pendBySelf.length + ' 个企业自助申请待总代初审');
    if (pendByAdmin.length) noticeItems.push(pendByAdmin.length + ' 个二级申请待平台审核开通');
    if (unsigned.length) noticeItems.push(unsigned.length + ' 个已开通二级待发起合作协议');
    var noticeBar = noticeItems.length
      ? '<div class="ag-notice"><span class="ag-notice__dot"></span><div>' + noticeItems.map(esc).join('；') + '。审核结果与协议待签将在此同步（本地通知位，非真实推送）。</div></div>'
      : '';

    el.innerHTML = '<div class="' + rootCls + '">'
      + lockBanner
      + noticeBar
      /* 身份卡（H-01 身份并列不合并；叠加身份独立 chip；P2-3 总代盾徽章；H-1 仅 home 视图） */
      + '<section class="ag-card ag-card--deep ag-rise" data-view="home">'
      + '<div class="ag-identity-row">' + emblemHtml('pa') + '<div class="ag-prov">授权省：' + esc(me.province) + '</div></div>'
      + '<div class="ag-quota">名额 ' + used + ' / ' + cap + '（省表核定名额，非固定 10）</div>'
      + '<div class="ag-mt-2">' + badge(me.status) + '</div>'
      + '<div class="ag-union">'
      + '<span class="ag-chip ag-chip--pa">省级总代</span>'
      + (isIndividualPartnerNow() ? '<span class="ag-chip ag-chip--ip">叠加 · 个人合伙人（并集独立，不合并身份）</span>' : '')
      + '</div>'
      + '<div class="ag-entry-row"><a class="ag-link" href="javascript:void(0)" id="ag-cert-toggle">查看授权证书</a></div>'
      + '</section>'

      /* P2-2 本地公告位（身份卡正下方/看板之上，可关闭记忆，非推送） */
      + localNoticeHtml()

      /* 授权证书改为抽屉承载（H-1），不再内嵌折叠卡 */

      /* P1-1 经营看板（本月/累计切换 + T+7 冻结；H-1 home 概览） */
      + '<section class="ag-card ag-rise" data-view="home"><h3>经营看板</h3><div id="ag-board">' + boardHtml('cum') + '</div></section>'

      /* H-1 快捷入口（仅 home 视图）：二级/协议/台账/状态下沉为独立视图 */
      + '<section class="ag-card" data-view="home" id="ag-quick">'
      + '<h3>代理工作台</h3><div class="ag-quick-grid">'
      + '<a class="ag-quick" href="#/subs"><b>' + subs.length + '</b><span>二级合作方</span></a>'
      + '<a class="ag-quick" href="#/agreements"><b>' + protoCount + '</b><span>协议中心</span></a>'
      + '<a class="ag-quick" href="#/ledger"><b>台账</b><span>双分区明细</span></a>'
      + '<a class="ag-quick" href="#/status"><b>记录</b><span>状态与行为</span></a>'
      + '</div></section>'

      /* 二级合作方（H-01：两行卡片式；H-1 #/subs 视图） */
      + '<section class="ag-card" data-view="subs"><h3>二级合作方（' + subs.length + '）</h3><div id="ag-subs"></div></section>'

      /* H-1 抽屉化：发起二级收进底部抽屉，#/subs 视图只留发起入口（suspended 由 ag-form-block 门控隐藏） */
      + '<section class="ag-card ag-form-block" data-view="subs"><h3>发起二级合作方</h3>'
      + '<p class="ag-meta">填写二级公司资料与约定比例，提交后进入平台审核队列。</p>'
      + '<button class="ag-btn ag-btn--primary" data-open-subform>发起二级（约定比例选填 0–50%）</button></section>'

      /* H-1 #/ledger 视图：二级线台账（P2-1 月份切片，容器由 mountMonthLedger 填充） */
      + '<section class="ag-card" data-view="ledger"><h3>二级线台账（subLedger · 独立小计）</h3>'
      + '<div id="ag-led-sub"></div>'
      + '<div class="ag-amount-block"><div class="ag-amount-row"><span>结算消费 → 总盘(×50%)</span><b>' + fmt(sub.subLedger.settledGross) + ' → ' + fmt(sub.subLedger.pool) + '</b></div>'
      + '<div class="ag-amount-row"><span>约定所得</span><b>' + fmt(sub.subLedger.agreed) + '</b></div>'
      + '<div class="ag-amount-row"><span>总代自留</span><b>' + fmt(sub.subLedger.retained) + '</b></div></div></section>'

      /* H-1 #/ledger 视图：自身线（P2-1 月份切片） */
      + '<section class="ag-card" data-view="ledger"><h3>自身线（selfLedger · 10% · 独立不相加）</h3>'
      + '<div id="ag-led-self"></div>'
      + '<div class="ag-amount-block"><div class="ag-amount-row"><span>自身结算消费 ×10%</span><b>' + fmt(sub.selfLedger.settledBase) + ' = ' + fmt(sub.selfLedger.amount) + '</b></div></div></section>'

      /* H-1 #/agreements 视图：协议中心（列表；八条进抽屉，H-5） */
      + '<section class="ag-card" data-view="agreements"><h3>协议中心（O4 二级合作协议）</h3><div id="ag-proto-list"></div></section>'

      /* H-1 #/status 视图：状态中心（statusLog/ratioLog 时间线） */
      + '<section class="ag-card" data-view="status"><h3>状态中心</h3>' + timelineHtml(me.statusLog, me.ratioLog) + '</section>'

      /* H-1 #/status 视图：行为记录只读（AgentStore.listBehavior，名下二级相关） */
      + '<section class="ag-card" data-view="status"><h3>行为记录（只读）</h3><div id="ag-behavior"></div></section>'

      /* 入口行：数据中心/授权网络/团队/规则税务（home 次级入口，内容不改仅补链；T3 授权网络、T4 数据中心） */
      + '<section class="ag-card" data-view="home"><div class="ag-entry-row">'
      + '<a class="ag-btn ag-btn--ghost ag-btn--sm" href="data-center.html">数据中心</a>'
      + '<a class="ag-btn ag-btn--ghost ag-btn--sm" href="network.html">授权网络</a>'
      + '<a class="ag-btn ag-btn--ghost ag-btn--sm" href="team.html?org=' + esc(me.orgId || '') + '">团队管理</a>'
      + '<a class="ag-btn ag-btn--ghost ag-btn--sm" href="tax-guide.html">规则与税务</a>'
      + '</div></section>'

      /* H-1 #/ledger 视图：打印/CSV 次级描边；H-03 suspended 置灰 */
      + '<section class="ag-card" data-view="ledger"><div class="ag-actions ag-actions--edit">'
      + '<button class="ag-btn ag-btn--ghost" onclick="window.print()" ' + (locked ? 'disabled' : '') + '>打印视图</button>'
      + '<button class="ag-btn ag-btn--ghost" id="ag-csv" ' + (locked ? 'disabled' : '') + '>导出当前月 CSV</button></div>'
      + '<div class="ag-note">屏幕视图按应用容器宽度 2–3 列自适应，打印视图按 A4 纸面展开为 3 列全宽；金额为模拟测算，非税务意见，非实际代扣金额。</div>'
      + '<div class="ag-disc">' + (Tax && Tax.disclaimer ? Tax.disclaimer() : '模拟测算，非税务意见，非实际代扣金额') + '</div></section>'
      + '</div>';

    /* S2-5：台账横滑遮罩提示绑定 */
    bindLedgerScrollHints(el);

    /* P2-2 本地公告关闭（写 localStorage 记忆，刷新不再出现） */
    el.querySelectorAll('[data-notice-close]').forEach(function (btn) {
      btn.onclick = function () {
        try { localStorage.setItem('ag-notice:' + btn.dataset.noticeClose, '1'); } catch (e) {}
        var card = btn.closest('[data-notice]');
        if (card) card.remove();
      };
    });

    var box = el.querySelector('#ag-subs');
    var canAdmin = !!(g('OrgsStore') && OrgsStore.canManage && OrgsStore.canManage(me.orgId));

    function subCardHtml(s) {
      var Es = esign();
      var c = latestContract(Es, s.id);
      var signed = s.signature && s.signature.status === 'completed';
      /* T2 双轨初审：企业自助申请（appliedBy==='self'）pending 态由总代初审；
         已初审（firstReview.passed）转平台终审；现状路径（无标记）直接平台审核 */
      var statusBadge = badge(s.status);
      var firstReviewOps = '';
      var selfNote = '';
      if (s.appliedBy === 'self' && s.status === 'pending') {
        selfNote = '<div class="ag-note">企业自助申请 · 招商码 ' + esc(s.inviteCode || '') + '</div>';
        if (s.firstReview && s.firstReview.passed) {
          statusBadge = '<span class="ag-badge ag-st-pending">已初审 · 待平台终审</span>';
          selfNote = '<div class="ag-note">企业自助申请 · 招商码 ' + esc(s.inviteCode || '') + ' · 总代初审已通过（约定 ' + fmt((s.firstReview.ratioToSub || 0) * 100) + '%）</div>';
        } else {
          statusBadge = '<span class="ag-badge ag-st-pending">待总代初审</span>';
          if (canAdmin && !locked) {
            firstReviewOps = '<button class="ag-btn ag-btn--sm ag-btn--primary" data-first-review="' + escAttr(s.id) + '">初审同意</button>'
              + '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-first-reject="' + escAttr(s.id) + '">初审驳回</button>';
          }
        }
      }
      /* P0-2 O4：发起/待签/已签/拒签真实接线（引擎 AgentEsign，独立键 engchain-agent-esign）
         S2-6：主操作（发起/重新发起/去签署）用 primary 按钮，次级（补改比例/查看协议）ghost，文字链接（详情/团队）分组 */
      var sig;
      if (signed) {
        sig = '<span class="ag-sig">已签 ' + esc(s.signature.code || '') + '</span>'
          + '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-proto="' + escAttr(s.id) + '">查看协议</button>';
      } else if (c && c.status === 'pending_mine') {
        sig = '<span class="ag-badge ag-st-pending">待二级签署</span>';
      } else if (c && c.status === 'rejected') {
        sig = '<span class="ag-badge ag-st-terminated">已拒签</span>'
          + (canAdmin && !locked ? '<button class="ag-btn ag-btn--sm ag-btn--primary" data-send-contract="' + escAttr(s.id) + '">重新发起</button>' : '');
      } else if (s.status === 'approved' && canAdmin && !locked) {
        sig = '<span class="ag-badge ag-st-pending">未签约</span>'
          + '<button class="ag-btn ag-btn--sm ag-btn--primary" data-send-contract="' + escAttr(s.id) + '">发起协议</button>';
      } else {
        sig = '<span class="ag-sig">协议待发起</span>';
      }
      var adminOps;
      if (canAdmin && !locked) {
        var curPct = fmt((s.ratioToSub || 0) * 100) + '%';
        /* H-1 抽屉化：比例补改收进底部抽屉，卡片只留只读徽章 + 入口 */
        adminOps = '<span class="ag-ratio-view ag-sig" data-sid="' + escAttr(s.id) + '">约定 ' + curPct + '</span>'
          + '<button class="ag-btn ag-btn--sm ag-btn--ghost ag-ratio-edit" data-sid="' + escAttr(s.id) + '">补改比例</button>';
      } else {
        adminOps = '<span class="ag-sig">约定 ' + fmt((s.ratioToSub || 0) * 100) + '%</span>';
      }
      /* P2-6 详情入口（仅 admin/非锁定）；T2 不自见；S2-6 文字链接统一 .ag-card__links 组 */
      var detailLink = (canAdmin && !locked)
        ? '<a class="ag-link" href="javascript:void(0)" data-sub-profile="' + escAttr(s.id) + '">详情</a>' : '';
      return '<div class="ag-sub-card ag-rise">'
        + '<div class="ag-sub-card__top"><span class="ag-sub-card__name">' + emblemHtml('sub', true) + ' ' + esc((s.company && s.company.name) || s.id) + '</span>'
        + statusBadge + '</div>'
        + selfNote
        + '<div class="ag-sub-card__ops">' + adminOps + firstReviewOps + sig + '</div>'
        + '<div class="ag-sub-card__links">' + detailLink
        + '<a class="ag-link" href="team.html?org=' + esc(me.orgId) + '">团队管理</a></div>'
        + '</div>';
    }

    /* M3-6 比例补改：仅 admin；0–50% 校验，超界拦截不留存；ratioLog 留痕重算（总盘不变）；H-1 收进抽屉 */
    function bindSubList() {
      /* T2 双轨初审：企业自助申请由总代初审（同意填约定比例 / 驳回必填原因，写 rejects） */
      box.querySelectorAll('[data-first-review]').forEach(function (b) {
        b.onclick = function () {
          var sid = b.dataset.firstReview;
          var rec = Store.getSub(sid); if (!rec) return;
          openDrawer({
            title: '初审同意 · 确定约定比例',
            bodyHtml: '<div class="ag-field"><label>约定比例（0–0.5）</label>'
              + '<input class="ag-input ag-first-ratio" type="number" min="0" max="0.5" step="0.01" value="0">'
              + '<div class="ag-field-err"></div></div>'
              + '<div class="ag-disc">初审通过后转平台终审；平台通过后自动发起 O4 协议，由二级签署。比例进入 ratioLog 留痕。</div>',
            footHtml: '<button class="ag-btn ag-btn--ghost" data-drawer-cancel>取消</button>'
              + '<button class="ag-btn ag-btn--primary" data-drawer-save>初审通过 · 转平台终审</button>',
            onOpen: function (d) {
              d.body.parentNode.querySelector('[data-drawer-cancel]').onclick = closeDrawer;
              var save = d.body.parentNode.querySelector('[data-drawer-save]');
              save.onclick = function () {
                var input = d.body.querySelector('.ag-first-ratio');
                var err = d.body.querySelector('.ag-field-err');
                var rv = Ledger.validateRatio(input.value === '' ? '0' : input.value);
                if (!rv.ok) { if (err) { err.textContent = rv.msg || '比例无效'; err.style.display = 'block'; } return; }
                rec.firstReview = { passed: true, at: Date.now(), operator: U, ratioToSub: rv.value };
                rec.ratioToSub = rv.value;
                rec.ratioLog = rec.ratioLog || [];
                rec.ratioLog.push({ ratio: rv.value, at: Date.now(), operator: U, reason: '总代初审确定约定比例' });
                rec.statusLog = rec.statusLog || [];
                rec.statusLog.push({ operator: U, at: Date.now(), reason: '总代初审通过，转平台终审', fromStatus: 'pending', toStatus: 'pending' });
                Store.saveSub(rec);
                closeDrawer();
                toast('初审通过，已转平台终审（约定 ' + (rv.value * 100) + '%）', true);
                mountWorkbench(el);
              };
            }
          });
        };
      });
      box.querySelectorAll('[data-first-reject]').forEach(function (b) {
        b.onclick = function () {
          var sid = b.dataset.firstReject;
          var rec = Store.getSub(sid); if (!rec) return;
          openDrawer({
            title: '初审驳回 · 必填原因',
            bodyHtml: '<div class="ag-field"><label>驳回原因<span class="ag-req">*</span></label>'
              + '<textarea class="ag-input ag-first-reason" rows="3" placeholder="请填写驳回原因（将写入 rejects 留痕并反馈企业）"></textarea>'
              + '<div class="ag-field-err"></div></div>',
            footHtml: '<button class="ag-btn ag-btn--ghost" data-drawer-cancel>取消</button>'
              + '<button class="ag-btn ag-btn--primary" data-drawer-save>确认驳回</button>',
            onOpen: function (d) {
              d.body.parentNode.querySelector('[data-drawer-cancel]').onclick = closeDrawer;
              var save = d.body.parentNode.querySelector('[data-drawer-save]');
              save.onclick = function () {
                var reason = (d.body.querySelector('.ag-first-reason') || {}).value || '';
                if (!String(reason).trim()) { toast('请填写驳回原因', 'err'); return; }
                rec.status = 'rejected';
                rec.rejects = rec.rejects || [];
                rec.rejects.push({ at: Date.now(), operator: U, reason: String(reason).trim() });
                rec.statusLog = rec.statusLog || [];
                rec.statusLog.push({ operator: U, at: Date.now(), reason: '总代初审驳回', fromStatus: 'pending', toStatus: 'rejected' });
                Store.saveSub(rec);
                closeDrawer();
                toast('已初审驳回，原因写入 rejects 留痕', false);
                mountWorkbench(el);
              };
            }
          });
        };
      });
      box.querySelectorAll('.ag-ratio-edit').forEach(function (b) {
        b.onclick = function () {
          var sid = b.dataset.sid;
          var rec = Store.getSub(sid); if (!rec) return;
          openDrawer({
            title: '补改约定比例',
            bodyHtml: '<div class="ag-field"><label>约定比例（0–0.5，留空即 0% 全自留）</label>'
              + '<input class="ag-input ag-ratio-input" type="number" min="0" max="0.5" step="0.01" value="' + (rec.ratioToSub || 0) + '">'
              + '<div class="ag-field-err"></div></div>'
              + '<div class="ag-disc">比例仅影响约定所得分配，总盘 50% 与自身 10% 不变；变更写入比例历史留痕。</div>',
            footHtml: '<button class="ag-btn ag-btn--ghost" data-drawer-cancel>取消</button>'
              + '<button class="ag-btn ag-btn--primary" data-drawer-save>保存留痕</button>',
            onOpen: function (d) {
              d.body.parentNode.querySelector('[data-drawer-cancel]').onclick = closeDrawer;
              var save = d.body.parentNode.querySelector('[data-drawer-save]');
              save.onclick = function () {
                var input = d.body.querySelector('.ag-ratio-input');
                var err = d.body.querySelector('.ag-field-err');
                var rv = Ledger.validateRatio(input.value);
                if (!rv.ok) { if (err) { err.textContent = rv.msg || '比例无效'; err.style.display = 'block'; } return; }
                rec.ratioLog = rec.ratioLog || [];
                rec.ratioLog.push({ ratio: rv.value, at: Date.now(), operator: 'admin', reason: '比例补改' });
                rec.ratioToSub = rv.value;
                Store.saveSub(rec);
                closeDrawer();
                toast('已按新比例 ' + (rv.value * 100) + '% 留痕重算（总盘不变）', true);
                mountWorkbench(el);
              };
            }
          });
        };
      });
      box.querySelectorAll('[data-sub-profile]').forEach(function (a) {
        a.onclick = function () { renderSubProfile(a.dataset.subProfile); };
      });
    }
    function renderSubList() {
      box.innerHTML = subs.map(subCardHtml).join('') || emptyState('暂无二级合作方', '发起并经审核通过后，二级公司将在此列出。', 'subs');
      bindSubList();
    }

    /* P2-6 二级档案详情视图（T1 admin 只读；T2 不自见；封存/终止只读） */
    function renderSubProfile(sid) {
      var s = Store.getSub(sid);
      if (!s) { renderSubList(); return; }
      var Es = esign();
      var contract = latestContract(Es, s.id);
      var sealed = s.status === 'terminated' || s.status === 'revoked' || s.sealedAt;
      var mineRows = entries.filter(function (e) { return e.subject === s.uid && e.line === 'subLedger'; });
      var cf = s.company || {};
      var field = function (k, v) {
        return '<div class="ag-sub-profile__field"><span>' + k + '</span><span>' + esc(v || '—') + '</span></div>';
      };
      var ratioTimeline = timelineHtml(null, s.ratioLog);
      box.innerHTML = '<a class="ag-back-link" href="javascript:void(0)" data-sub-back>‹ 返回列表</a>'
        + '<section class="ag-card"><div class="ag-sub-profile__name">' + emblemHtml('sub') + esc(cf.name || s.id) + ' ' + badge(s.status) + '</div>'
        + '<div class="ag-sub-profile__ratio">' + fmt((s.ratioToSub || 0) * 100) + '%</div>'
        + field('统一社会信用代码', cf.uscc) + field('营业执照编号', cf.license)
        + field('法定代表人', cf.legalRep) + field('联系人', cf.contact)
        + field('意向授权省', s.province) + field('约定比例', fmt((s.ratioToSub || 0) * 100) + '%')
        + '</section>'
        + '<section class="ag-card"><h3>协议状态</h3>'
        + (contract ? '<div class="ag-meta">' + esc(contract.code || '') + ' · ' + protoTxtOwner(contract.status)
          + (contract.completedAt ? ' · 完成 ' + fmtDate(contract.completedAt) : '')
          + (canAdmin && !locked && !sealed ? ' <button class="ag-btn ag-btn--sm ag-btn--ghost" data-proto="' + escAttr(s.id) + '">查看协议</button>' : '')
          + '</div>' : '<div class="ag-meta">协议待发起</div>')
        + '</section>'
        + '<section class="ag-card"><h3>比例历史</h3>' + ratioTimeline + '</section>'
        + '<section class="ag-card"><h3>该二级本人线台账</h3>'
        + (mineRows.length ? ledgerTable(mineRows, s.ratioToSub, Ledger, ratioByUid) : emptyState('暂无该二级台账记录', '按该二级聚合的合格消费逐笔列示。'))
        + '</section>'
        + (sealed ? '<div class="ag-disc">该合作方已' + (s.status === 'terminated' ? '终止' : '封存') + '，档案与台账只读，无操作入口。</div>' : '');
      var back = box.querySelector('[data-sub-back]');
      if (back) back.onclick = renderSubList;
      var pv = box.querySelector('[data-proto]');
      if (pv) pv.onclick = function () {
        var d = Es.contractById(pv.dataset.proto) || latestContract(Es, pv.dataset.proto);
        openDrawer({ title: '二级合作协议（O4）', bodyHtml: protoDetail(d) });
      };
      bindLedgerScrollHints(box);
    }

    renderSubList();

    /* P2-2 本地公告关闭（写 localStorage 记忆，刷新不再出现） */
    el.querySelectorAll('[data-notice-close]').forEach(function (btn) {
      btn.onclick = function () {
        try { localStorage.setItem('ag-notice:' + btn.dataset.noticeClose, '1'); } catch (e) {}
        var card = btn.closest('[data-notice]');
        if (card) card.remove();
      };
    });

    /* P2-1 月份切片绑定：二级线 / 自身线各自独立月份状态（纯视图，不改汇总/看板口径） */
    mountMonthLedger(el.querySelector('#ag-led-sub'),
      entries.filter(function (e) { return e.line === 'subLedger'; }),
      function (rows) { return ledgerTable(rows, ratioUsed, Ledger, ratioByUid); });
    mountMonthLedger(el.querySelector('#ag-led-self'),
      entries.filter(function (e) { return e.line === 'selfLedger'; }),
      function (rows) { return ledgerTable(rows, ratioUsed, Ledger); });

    /* P1-1 看板本月/累计切换（纯前端重渲染，不改聚合口径） */
    function rebindSeg() {
      var b2 = el.querySelector('#ag-board'); if (!b2) return;
      b2.querySelectorAll('#ag-board-seg button').forEach(function (btn) {
        btn.onclick = function () {
          b2.querySelectorAll('#ag-board-seg button').forEach(function (x) { x.classList.remove('is-on'); });
          btn.classList.add('is-on');
          b2.innerHTML = boardHtml(btn.dataset.mode);
          rebindSeg();
        };
      });
    }
    rebindSeg();

    /* H-1：授权证书进底部抽屉（替代内嵌折叠卡） */
    var certToggle = el.querySelector('#ag-cert-toggle');
    if (certToggle) certToggle.onclick = function () {
      openDrawer({ title: '授权证书', bodyHtml: certiHtml(me) });
    };

    /* P0-2 O4 协议：发起（甲方自动已签，待二级）/ 查看详情 */
    function protoDetail(c) {
      if (!c) return '<div class="ag-empty__sub">暂无协议记录。</div>';
      var parties = (c.parties || []).map(function (p) {
        var st = p.status === 'signed' ? '已签' : (p.status === 'rejected' ? '已拒签' : '待签');
        return '<div class="ag-meta">' + esc(p.role) + ' · ' + esc(p.company || p.name || '—') + '：' + st
          + (p.signedAt ? '（' + fmtDate(p.signedAt) + '）' : '')
          + (p.rejectReason ? '，原因：' + esc(p.rejectReason) : '') + '</div>';
      }).join('');
      var clauses = (c.clauses || []).map(function (cl) {
        return '<div class="ag-clause"><div class="ag-clause__no">第' + cl.no + '条 · ' + esc(cl.title) + '</div>'
          + '<div class="ag-clause__body">' + esc(cl.body) + '</div></div>';
      }).join('');
      var ev = c.evidence ? '<div class="ag-disc">本平台演示环境存证（编号 ' + esc(c.evidence.certNo || '') + '），正式存证以第三方电子签服务为准 · ' + fmtDate(c.evidence.timestamp || c.completedAt) + '</div>' : '';
      return '<div class="ag-card ag-mt-3">'
        + '<div class="ag-sub-card__name">《二级合作协议（O4）》' + esc(c.code || '') + '</div>'
        + '<div class="ag-meta ag-mt-1">版本 ' + esc(c.version || '') + ' · 状态 ' + protoTxtOwner(c.status)
        + (c.completedAt ? ' · 签署完成 ' + fmtDate(c.completedAt) : '') + '</div>'
        + parties + clauses + ev + '</div>';
    }
    function renderProtoCenter() {
      var list = el.querySelector('#ag-proto-list'); var detail = el.querySelector('#ag-proto-detail');
      if (!list) return;
      var E = esign(); if (!E) return;
      var rows = subs.map(function (s) {
        var c = latestContract(E, s.id);
        if (!c) return '';
        return '<div class="ag-proto-row"><div class="ag-proto-row__main">'
          + '<div class="ag-proto-row__title">' + esc(c.code || '') + ' · ' + esc((s.company && s.company.name) || '') + '</div>'
          + '<div class="ag-proto-row__meta">' + esc(c.version || '') + ' · ' + protoTxtOwner(c.status) + '</div></div>'
          + '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-proto="' + escAttr(s.id) + '">查看</button></div>';
      }).join('');
      list.innerHTML = rows || emptyState('暂无协议', '发起二级协议后在此集中查看。', 'proto');
      if (detail) detail.innerHTML = '';
    }
    renderProtoCenter();

    el.querySelectorAll('[data-send-contract]').forEach(function (btn) {
      btn.onclick = function () {
        var E = esign(); if (!E) return;
        var rec = Store.getSub(btn.dataset.sendContract); if (!rec) return;
        busy(btn, '发起中…', function () {
          var r = E.sendContract({
            subId: rec.id, parentUid: me.uid || me.id, subUid: rec.uid || '',
            parentName: (me.branchCompany && me.branchCompany.legalRep) || '总代',
            parentCompany: (me.branchCompany && me.branchCompany.name) || me.province,
            subName: (rec.company && rec.company.legalRep) || '',
            subCompany: (rec.company && rec.company.name) || ''
          });
          if (r.ok) { toast('协议已发起，待二级签署', true); mountWorkbench(el); }
          else toast(r.msg || '发起失败', false);
        });
      };
    });
    /* H-5：协议八条进底部抽屉，签署/查看聚焦抽屉，身份卡只留摘要行 */
    el.querySelectorAll('[data-proto]').forEach(function (btn) {
      btn.onclick = function () {
        var E = esign(); var c = E.contractById(btn.dataset.proto) || latestContract(E, btn.dataset.proto);
        openDrawer({ title: '二级合作协议（O4）', bodyHtml: protoDetail(c) });
      };
    });

    /* P1-7 行为记录只读（名下二级 + 本人，本地封存口径） */
    var behBox = el.querySelector('#ag-behavior');
    if (behBox) {
      var beh = (Store.listBehavior() || []).filter(function (b) {
        return b.subject === U || b.uid === U || (b.subUid && subs.some(function (s) { return s.uid === b.subUid; }));
      }).slice(-20).reverse();
      behBox.innerHTML = beh.length
        ? '<div class="ag-member" style="flex-direction:column;align-items:stretch;gap:4px;">' + beh.map(function (b) {
            return '<div class="ag-meta">' + fmtDate(b.at) + ' · ' + esc(b.action || b.event || '记录') + (b.detail ? ' · ' + esc(b.detail) : '') + '</div>';
          }).join('') + '</div>'
        : emptyState('暂无行为记录', '本地操作留痕将在此只读展示。', 'rec');
    }

    var csv = el.querySelector('#ag-csv');
    if (csv) csv.onclick = function () {
      busy(csv, '导出中…', function () {
        var month = Ledger.monthKey(Date.now());
        var csvText = Ledger.toCsv(entries, month);
        download('agent-ledger-' + month + '.csv', '\ufeff' + csvText);
        toast('已导出当前月两分区 CSV', true);
      });
    };

    /* H-1 抽屉化：发起二级表单收进底部抽屉，字段校验/落盘在抽屉作用域内完成，busy 防连点 */
    var openSubformBtn = el.querySelector('[data-open-subform]');
    if (openSubformBtn) openSubformBtn.onclick = function () {
      var formBody = '<div class="ag-field" id="f-sub-co"><label>二级公司名称<span class="ag-req">*</span></label>'
        + '<input class="ag-input" data-f="co" placeholder="二级公司全称"><div class="ag-field-err"></div></div>'
        + '<div class="ag-field" id="f-sub-uscc"><label>统一社会信用代码</label>'
        + '<input class="ag-input" data-f="uscc" placeholder="18 位统一社会信用代码（选填）"></div>'
        + '<div class="ag-field" id="f-sub-license"><label>营业执照编号</label>'
        + '<input class="ag-input" data-f="license" placeholder="营业执照编号（选填）"></div>'
        + '<div class="ag-field" id="f-sub-legal"><label>法定代表人</label>'
        + '<input class="ag-input" data-f="legalRep" placeholder="法定代表人姓名（选填）"></div>'
        + '<div class="ag-field" id="f-sub-contact"><label>联系人</label>'
        + '<input class="ag-input" data-f="contact" placeholder="联系人姓名（选填）"></div>'
        + '<div class="ag-field" id="f-sub-prov"><label>意向授权省（同省约束，默认本省）</label>'
        + '<input class="ag-input" data-f="prov" value="' + esc(me.province) + '" readonly></div>'
        + '<div class="ag-field" id="f-sub-ratio"><label>约定比例（0–0.5，可空=全自留）</label>'
        + '<input class="ag-input" data-f="ratio" type="number" min="0" max="0.5" step="0.01" placeholder="0–0.5，留空即 0% 全自留">'
        + '<div class="ag-field-err"></div></div>';
      openDrawer({
        title: '发起二级合作方',
        bodyHtml: formBody,
        footHtml: '<button class="ag-btn ag-btn--ghost" data-drawer-cancel>取消</button>'
          + '<button class="ag-btn ag-btn--primary" data-drawer-save>提交申请 · 等待审核开通</button>',
        onOpen: function (d) {
          d.body.parentNode.querySelector('[data-drawer-cancel]').onclick = closeDrawer;
          var save = d.body.parentNode.querySelector('[data-drawer-save]');
          save.onclick = function () {
            if (save.disabled) return;
            function fv(k) { var n = d.body.querySelector('[data-f="' + k + '"]'); return n ? n.value.trim() : ''; }
            function mark(wrapSel, ok, msg) {
              var wrap = d.body.querySelector(wrapSel); if (!wrap) return;
              wrap.classList.toggle('ag-field--error', !ok);
              var e = wrap.querySelector('.ag-field-err'); if (e) e.textContent = ok ? '' : msg;
            }
            var co = fv('co'), uscc = fv('uscc'), license = fv('license'), legalRep = fv('legalRep'), contact = fv('contact');
            var subProv = fv('prov') || me.province;
            var rv = Ledger.validateRatio(fv('ratio') === '' ? 0 : Number(fv('ratio')));
            mark('#f-sub-co', !!co, '请填写二级公司名称');
            mark('#f-sub-ratio', rv.ok, rv.msg);
            if (!co || !rv.ok) { toast('请检查标红项', 'err'); return; }
            /* D-1：先过规则校验（同省/自指/唯一绑定/名额），通过后落盘 pending 二级记录 */
            var Rules = g('AgentRules');
            var quotaCfg = (g('MOCK') && g('MOCK').business && g('MOCK').business.provinceAgentQuota) || {};
            var v = Rules && Rules.validateSubAgent
              ? Rules.validateSubAgent({ company: { name: co, uscc: uscc }, uscc: uscc, province: subProv, ratioToSub: rv.value, parent: me, isNaturalPerson: false },
                  { provinceAgents: Store.listProvinces(), subAgents: Store.listSubs(), quotaCfg: quotaCfg })
              : { ok: true };
            if (!v.ok) { mark('#f-sub-co', false, v.msg || '发起未通过校验'); toast(v.msg || v.code || '发起失败', 'err'); return; }
            save.disabled = true; /* busy 防连点 */
            var rec = {
              id: 'sb-' + Date.now().toString(36),
              /* R-1：parentUid 口径与 seed/工作台过滤一致，存上级 uid（me.uid），回退记录 id */
              parentUid: me.uid || me.id,
              uid: '',
              company: { name: co, uscc: uscc, license: license, legalRep: legalRep, contact: contact, phone: '' },
              province: subProv || me.province,
              ratioToSub: rv.value,
              status: 'pending',
              statusLog: [{ operator: U, at: Date.now(), reason: '发起二级申请', fromStatus: '', toStatus: 'pending' }],
              rejects: [], ratioLog: [],
              signature: { status: 'pending' },
              sealedAt: 0
            };
            var saved = Store.saveSub(rec);
            save.disabled = false;
            if (saved && saved.error) { toast(saved.msg || saved.error || '落盘失败', 'err'); return; }
            closeDrawer();
            toast('已登记发起请求，待后台审核开通', true);
            mountWorkbench(el);
          };
        }
      });
    };

    /* H-1 hash 视图路由：home/subs/agreements/ledger/status；hashchange 历史栈切换，不整页 remount 丢滚动 */
    function agApplyRoute() {
      var hash = (root.location && root.location.hash || '').replace(/^#\/?/, '');
      var valid = { home: 1, subs: 1, agreements: 1, ledger: 1, status: 1 };
      if (!valid[hash]) hash = 'home';
      el.querySelectorAll('[data-view]').forEach(function (sec) {
        sec.style.display = (sec.dataset.view === hash) ? '' : 'none';
      });
      var bar = el.querySelector('#ag-route-back');
      if (hash !== 'home') {
        if (!bar) {
          bar = root.document.createElement('div');
          bar.id = 'ag-route-back';
          bar.className = 'ag-route-back';
          el.insertBefore(bar, el.firstChild);
        }
        bar.innerHTML = '<a href="#/home">‹ 返回工作台概览</a>';
      } else if (bar) { bar.remove(); }
      var scroller = el.querySelector('.ag-wrap') || el;
      if (scroller && scroller.scrollTop) scroller.scrollTop = 0;
    }
    root.addEventListener('hashchange', agApplyRoute);
    agApplyRoute();
  }

  /* ---------- M3-1 二级视角：只见本人约定所得，不见自留/自身收益 ----------
     H-05：本人约定所得 = 本人 settled 合格二级线消费 ×50% ×本人 ratioToSub，
     与工作台 partitionSubtotals 同口径（纯展示取值，不新增计算函数）。 */
  function mountSubView(rootEl) {
    var el = typeof rootEl === 'string' ? $(rootEl) : rootEl;
    if (!el || !g('AgentStore')) return;
    var U = uid(), Store = g('AgentStore'), Ledger = g('AgentLedger');
    var rec = null;
    (Store.listSubs() || []).forEach(function (s) { if (s.uid === U) rec = s; });
    if (!rec) {
      el.innerHTML = '<div class="ag-wrap">' + emptyState('当前账号无二级合作记录', '与总代签署协议并通过审核后开通本视角。', 'subs') + '</div>';
      return;
    }
    var allRows = (Store.listLedger() || []).filter(function (e) {
      return e.subject === U && e.line === 'subLedger' && Ledger.isEligibleConsumption(e.type, Ledger.DEFAULTS);
    });
    function settleAgg(rows) {
      var settled = rows.filter(function (e) { return e.frozenStatus === 'settled' && !e.refunded && !e.clawed; });
      var gross = settled.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
      var pool = Ledger.round2(gross * Ledger.DEFAULTS.grossShare);
      var agreed = Ledger.round2(pool * (rec.ratioToSub || 0));
      return { gross: gross, pool: pool, agreed: agreed };
    }
    var cum = settleAgg(allRows);
    var mon = settleAgg(allRows.filter(function (e) { return e.month === thisMonth(); }));
    var frozen = frozenStats(allRows, Ledger, function () { return true; });
    var signed = rec.signature && rec.signature.status === 'completed';
    var E = esign();
    var contract = latestContract(E, rec.id);
    var parentCo = parentCompanyOf(rec.parentUid);

    function subBoard(mode) {
      var a = mode === 'month' ? mon : cum;
      function cell(lb, val, sub) {
        return '<div class="ag-board-cell"><div class="ag-board-cell__lb">' + lb + '</div>'
          + '<div class="ag-board-cell__val">¥' + fmt(val) + '</div>'
          + (sub ? '<div class="ag-board-cell__sub">' + esc(sub) + '</div>' : '') + '</div>';
      }
      return '<div class="ag-seg" id="ag-sub-seg">'
        + '<button data-mode="month" class="' + (mode === 'month' ? 'is-on' : '') + '">本月</button>'
        + '<button data-mode="cum" class="' + (mode === 'cum' ? 'is-on' : '') + '">累计</button></div>'
        /* S2-7：主收益「本人约定所得」置顶大数字卡，辅助指标次级弱化 */
        + '<div class="ag-hero ag-card--sub">'
        + '<div class="ag-hero__lb">本人约定所得（' + (mode === 'month' ? '本月' : '累计') + '）</div>'
        + '<div class="ag-big">¥' + fmt(a.agreed) + '</div>'
        + '<div class="ag-hero__sub">不展示自留/自身线 · 模拟测算，非税务意见</div></div>'
        + '<div class="ag-board-grid">'
        + cell('本人合格消费', a.gross, mode === 'month' ? '本月已结算' : '累计已结算')
        + cell('总盘（×50%）', a.pool)
        + '<div class="ag-board-cell ag-board-cell--frozen"><div class="ag-board-cell__lb">T+7 冻结待结算</div>'
        + '<div class="ag-board-cell__val">' + frozen.count + ' 笔</div>'
        + '<div class="ag-board-cell__sub">¥' + fmt(frozen.amount) + '</div></div>'
        + '</div>';
    }

    /* P0-2 协议状态分支：已签查看 / pending_mine 去签署·拒签 / rejected 已拒签 / 待发起 */
    var protoRow;
    if (signed) {
      protoRow = '<span class="ag-sig">已签署 ' + esc(rec.signature.code || '') + '</span>'
        + '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-sub-proto>查看协议</button>';
    } else if (contract && contract.status === 'pending_mine') {
      protoRow = '<span class="ag-badge ag-st-pending">待我签署</span>'
        + '<button class="ag-btn ag-btn--sm ag-btn--primary" data-sub-sign>去签署</button>'
        + '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-sub-reject>拒签</button>';
    } else if (contract && contract.status === 'rejected') {
      protoRow = '<span class="ag-badge ag-st-terminated">已拒签</span>'
        + '<span class="ag-sig">' + esc(contract.rejectReason || '') + '</span>';
    } else {
      protoRow = '<span class="ag-sig">协议待发起</span>';
    }

    /* L-4：拒签内联必填原因面板（替代 window.prompt 原生弹窗） */
    var rejectPanel = '';
    if (contract && contract.status === 'pending_mine') {
      rejectPanel = '<div id="ag-sub-reject-box" class="ag-reject-box" style="display:none;">'
        + '<div class="ag-field"><textarea id="ag-sub-reject-reason" rows="2" placeholder="请填写拒签原因（必填）"></textarea></div>'
        + '<div class="ag-reject-acts">'
        + '<button type="button" class="ag-btn ag-btn--sm ag-btn--danger" data-sub-reject-confirm>确认拒签</button>'
        + '<button type="button" class="ag-btn ag-btn--sm ag-btn--ghost" data-sub-reject-cancel>取消</button>'
        + '</div>'
        + '<div class="ag-field-err" id="ag-sub-reject-err" style="display:none;"></div>'
        + '</div>';
    }

    /* E1-T2-01：无协议记录时不渲染空白「协议详情」卡；有协议才出卡；R-1 归属 home 视图，#/ledger 隐藏 */
    var protoCard = contract
      ? '<section class="ag-card" data-view="home"><h3>协议详情</h3><div id="ag-sub-proto-panel">'
        + '<div class="ag-empty__sub">点「查看协议」阅读条款；已签协议可随时回看。</div></div></section>'
      : '';

    el.innerHTML = '<div class="ag-wrap">'
      + '<section class="ag-card ag-card--sub ag-rise" data-view="home">'
      + '<div class="ag-identity-row">' + emblemHtml('sub') + '<div class="ag-prov">' + esc((rec.company && rec.company.name) || '') + '</div></div>'
      /* E1-T2-03：归属省/比例/状态/归属总代结构化分行，去分隔符混排 */
      + '<div class="ag-sub-profile__field"><span>归属省</span><span>' + esc(rec.province) + '</span></div>'
      + '<div class="ag-sub-profile__field"><span>约定比例</span><span>' + fmt((rec.ratioToSub || 0) * 100) + '%</span></div>'
      + '<div class="ag-sub-profile__field"><span>状态</span><span>' + badge(rec.status) + '</span></div>'
      + (parentCo ? '<div class="ag-sub-profile__field"><span>归属总代</span><span>' + esc(parentCo) + '</span></div>' : '')
      + '<div class="ag-meta ag-mt-2" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">协议：' + protoRow + '</div>'
      + rejectPanel
      + '</section>'

      /* P2-2 本地公告位（身份卡正下方/看板之上，可关闭记忆，非推送） */
      + localNoticeHtml()

      + '<section class="ag-card ag-rise" data-view="home"><h3>本人约定所得（仅可见本人）</h3><div id="ag-sub-board">' + subBoard('cum') + '</div></section>'

      /* H-1 T2 快捷入口（仅 home）：台账下沉独立视图 */
      + '<section class="ag-card" data-view="home"><div class="ag-quick-grid">'
      + '<a class="ag-quick" href="#/ledger"><b>台账</b><span>本人逐笔明细</span></a>'
      + '</div></section>'

      /* H-1 #/ledger 视图：本人逐笔台账独立承载 */
      + '<section class="ag-card" data-view="ledger"><h3>本人逐笔台账</h3>'
      + '<div id="ag-sub-led"></div>'
      + '</section>'

      + protoCard

      + '<section class="ag-card" data-view="home"><h3>状态中心</h3>' + timelineHtml(rec.statusLog, rec.ratioLog, { hideOperator: true }) + '</section>'

      /* E1-T2-06：业务入口（团队/规则）与钱包弱出口分组，钱包视觉降级（home） */
      + '<section class="ag-card" data-view="home"><div class="ag-entry-row">'
      + '<a class="ag-btn ag-btn--ghost ag-btn--sm" href="team.html?org=' + esc(rec.orgId || '') + '">本公司团队</a>'
      + '<a class="ag-btn ag-btn--ghost ag-btn--sm" href="tax-guide.html">规则与税务</a>'
      + '</div>'
      + '<div class="ag-entry-row ag-entry-row--weak ag-mt-3">'
      + '<a class="ag-link" href="../../pages/wallet/index.html">自身余额（钱包）›</a>'
      + '</div>'
      + '<div class="ag-disc">本视角不展示总代自留与总代自身收益线；金额为模拟测算，非税务意见，非实际代扣金额。</div></section>'
      + '</div>';

    /* S2-5：台账横滑遮罩提示绑定 */
    bindLedgerScrollHints(el);

    /* P1-1 二级看板本月/累计切换 */
    function rebindSubSeg() {
      var b = el.querySelector('#ag-sub-board'); if (!b) return;
      b.querySelectorAll('#ag-sub-seg button').forEach(function (btn) {
        btn.onclick = function () {
          b.querySelectorAll('#ag-sub-seg button').forEach(function (x) { x.classList.remove('is-on'); });
          btn.classList.add('is-on');
          b.innerHTML = subBoard(btn.dataset.mode);
          rebindSubSeg();
        };
      });
    }
    rebindSubSeg();

    /* P2-2 本地公告关闭记忆；P2-1 本人台账月份切片 */
    el.querySelectorAll('[data-notice-close]').forEach(function (btn) {
      btn.onclick = function () {
        try { localStorage.setItem('ag-notice:' + btn.dataset.noticeClose, '1'); } catch (e) {}
        var card = btn.closest('[data-notice]');
        if (card) card.remove();
      };
    });
    mountMonthLedger(el.querySelector('#ag-sub-led'), allRows,
      function (rows) { return ledgerTable(rows, rec.ratioToSub, Ledger, {}, { hideRetained: true }); });

    /* P0-2 二级签署/拒签/查看，写回 rec.signature 并落盘 */
    function subProtoDetail(c) {
      if (!c) return '<div class="ag-empty__sub">暂无协议记录。</div>';
      var parties = (c.parties || []).map(function (p) {
        var st = p.status === 'signed' ? '已签' : (p.status === 'rejected' ? '已拒签' : '待签');
        return '<div class="ag-meta">' + esc(p.role) + ' · ' + esc(p.company || p.name || '—') + '：' + st
          + (p.signedAt ? '（' + fmtDate(p.signedAt) + '）' : '')
          + (p.rejectReason ? '，原因：' + esc(p.rejectReason) : '') + '</div>';
      }).join('');
      var clauses = (c.clauses || []).map(function (cl) {
        return '<div class="ag-clause"><div class="ag-clause__no">第' + cl.no + '条 · ' + esc(cl.title) + '</div>'
          + '<div class="ag-clause__body">' + esc(cl.body) + '</div></div>';
      }).join('');
      return '<div class="ag-card ag-mt-3"><div class="ag-sub-card__name">《二级合作协议（O4）》'
        + esc(c.code || '') + '</div><div class="ag-meta ag-mt-1">版本 ' + esc(c.version || '')
        + ' · 状态 ' + protoStatusTxt(c.status) + (c.completedAt ? ' · 完成 ' + fmtDate(c.completedAt) : '') + '</div>'
        + parties + clauses + '</div>';
    }
    /* H-5：T2 协议进抽屉，待我签署时底部固定操作区放 去签署/拒签，身份卡只留摘要 */
    var show = el.querySelector('[data-sub-proto]');
    if (show) show.onclick = function () {
      var foot = (contract && contract.status === 'pending_mine')
        ? '<button class="ag-btn ag-btn--ghost" type="button" data-drawer-reject>拒签</button>'
          + '<button class="ag-btn ag-btn--primary" type="button" data-drawer-sign>去签署</button>'
        : '';
      var d = openDrawer({ title: '二级合作协议（O4）', bodyHtml: subProtoDetail(contract), footHtml: foot });
      if (d) {
        var sb = d.body.parentNode.querySelector('[data-drawer-sign]');
        if (sb) sb.onclick = function () {
          busy(sb, '签署中…', function () {
            var r = E.sign(contract.id, 'sub', '企业签名', {
              onSigned: function (subId, signature) {
                var r2 = Store.getSub(subId);
                if (r2) { r2.signature = signature; Store.saveSub(r2); }
              }
            });
            if (r.ok) { closeDrawer(); toast('协议已签署完成', true); mountSubView(el); }
            else { closeDrawer(); toast(r.msg || '签署失败', 'err'); }
          });
        };
        var rb = d.body.parentNode.querySelector('[data-drawer-reject]');
        if (rb) rb.onclick = function () {
          closeDrawer();
          var row = el.querySelector('[data-sub-reject]');
          if (row) { row.click(); var box2 = el.querySelector('#ag-sub-reject-box'); if (box2) box2.style.display = ''; }
        };
      }
    };
    var signBtn = el.querySelector('[data-sub-sign]');
    if (signBtn) signBtn.onclick = function () {
      busy(signBtn, '签署中…', function () {
        var r = E.sign(contract.id, 'sub', '企业签名', {
          onSigned: function (subId, signature) {
            var r2 = Store.getSub(subId);
            if (r2) { r2.signature = signature; Store.saveSub(r2); }
          }
        });
        if (r.ok) { toast('协议已签署完成', true); mountSubView(el); }
        else toast(r.msg || '签署失败', false);
      });
    };
    /* L-4：拒签内联原因面板：展开/取消/空原因内联拦截/确认拒签 */
    var rejToggle = el.querySelector('[data-sub-reject]');
    var rejBox = el.querySelector('#ag-sub-reject-box');
    if (rejToggle && rejBox) {
      rejToggle.onclick = function () {
        rejBox.style.display = rejBox.style.display === 'none' ? '' : 'none';
      };
      var cancelBtn = rejBox.querySelector('[data-sub-reject-cancel]');
      if (cancelBtn) cancelBtn.onclick = function () {
        rejBox.style.display = 'none';
        var ta = rejBox.querySelector('#ag-sub-reject-reason');
        if (ta) ta.value = '';
        var err = rejBox.querySelector('#ag-sub-reject-err');
        if (err) { err.style.display = 'none'; err.textContent = ''; }
      };
      var confirmBtn = rejBox.querySelector('[data-sub-reject-confirm]');
      if (confirmBtn) confirmBtn.onclick = function () {
        var ta = rejBox.querySelector('#ag-sub-reject-reason');
        var err = rejBox.querySelector('#ag-sub-reject-err');
        var reason = ta ? String(ta.value || '').trim() : '';
        if (!reason) {
          /* CSS .ag-field-err 默认 display:none，须显式 block 才能覆盖显示 */
          if (err) { err.textContent = '请填写拒签原因（必填）'; err.style.display = 'block'; }
          if (ta) ta.focus();
          return;
        }
        /* openConfirm 居中确认：拒签使协议回到未签约、需重新发起，遮罩不可点关；
           S1-3 防重：data-ok 在 onConfirm 前已移除，用模块级锁代替按钮 busy */
        openConfirm({
          title: '确认拒签协议',
          desc: '拒签后本协议将回到未签约状态，需由总代重新发起；已填原因：' + reason + '。是否确认拒签？',
          dangerLabel: '确认拒签',
          onConfirm: function () {
            if (window.__agRejectBusy) return;
            window.__agRejectBusy = true;
            try {
              var r = E.reject(contract.id, 'sub', reason, {
                onRejected: function (subId, why) {
                  var r2 = Store.getSub(subId);
                  if (r2) { r2.signature = { status: 'rejected', rejectReason: why, completedAt: 0 }; Store.saveSub(r2); }
                }
              });
              if (r.ok) { toast('已拒签', 'err'); mountSubView(el); }
              else toast(r.msg || '拒签失败', 'err');
            } finally { window.__agRejectBusy = false; }
          }
        });
      };
    }

    /* H-1 T2 hash 视图路由：home 概览 / #/ledger 本人台账；hashchange 历史栈切换 */
    function subApplyRoute() {
      var hash = (root.location && root.location.hash || '').replace(/^#\/?/, '');
      if (hash !== 'ledger') hash = 'home';
      el.querySelectorAll('[data-view]').forEach(function (sec) {
        sec.style.display = (sec.dataset.view === hash) ? '' : 'none';
      });
      var bar = el.querySelector('#ag-route-back');
      if (hash !== 'home') {
        if (!bar) {
          bar = root.document.createElement('div');
          bar.id = 'ag-route-back';
          bar.className = 'ag-route-back';
          el.insertBefore(bar, el.firstChild);
        }
        bar.innerHTML = '<a href="#/home">‹ 返回我的概览</a>';
      } else if (bar) { bar.remove(); }
      var scroller = el.querySelector('.ag-wrap') || el;
      if (scroller && scroller.scrollTop) scroller.scrollTop = 0;
    }
    root.addEventListener('hashchange', subApplyRoute);
    subApplyRoute();
  }

  /* ---------- M3-10 团队页（复用 OrgsStore；legalRep 只读 / admin 操作 / member 日常） ---------- */
  function mountTeam(rootEl, orgId) {
    var el = typeof rootEl === 'string' ? $(rootEl) : rootEl;
    if (!el || !g('OrgsStore')) return;
    if (!orgId) {
      el.innerHTML = '<div class="ag-wrap">' + emptyState('未指定企业组织', '请从总代工作台进入本公司团队管理。') + '</div>';
      return;
    }
    var org = OrgsStore.get(orgId);
    var view = OrgsStore.agentRoleView ? OrgsStore.agentRoleView(orgId) : { canManage: false, canSeeFinance: false };
    if (!org) {
      el.innerHTML = '<div class="ag-wrap">' + emptyState('未找到企业组织', '组织记录可能已被移除。') + '</div>';
      return;
    }
    var members = org.members || [];
    var invites = (org.invites || []).filter(function (i) { return i.status === 'pending'; });
    var joins = OrgsStore.pendingJoins ? OrgsStore.pendingJoins(orgId) : [];

    /* D-7：法人判定 = role/uid/ownerUid 命中，或档案姓名与 org.legal 姓名双匹配 */
    function isLegal(m) {
      var nm = nameOf(m.uid);
      return m.role === 'legalRep' || m.uid === org.legal || m.uid === org.ownerUid
        || (org.legal && nm === org.legal);
    }
    function roleChip(m) {
      if (isLegal(m)) return '<span class="ag-role-chip ag-role-chip--legal">法定代表人·只读</span>';
      if (m.role === 'owner') return '<span class="ag-role-chip">管理员（迁移期）</span>';
      if (m.role === 'admin') return '<span class="ag-role-chip">管理员</span>';
      return '<span class="ag-role-chip">成员</span>';
    }

    var rows = members.map(function (m) {
      var legal = isLegal(m);
      var act = view.canManage && !legal && m.role !== 'owner'
        ? '<button class="ag-btn ag-btn--sm ag-btn--danger" data-remove="' + esc(m.uid) + '">移除</button>' : '';
      var initial = (nameOf(m.uid) || '?').slice(0, 1);
      return '<div class="ag-member ag-rise">'
        + '<div class="ag-member__avatar">' + esc(initial) + '</div>'
        + '<div class="ag-member__main"><div class="ag-member__name">' + esc(nameOf(m.uid)) + '</div>'
        + '<div class="ag-member__sub">' + roleChip(m) + ' ' + esc(m.uid) + '</div></div>'
        + act + '</div>';
    }).join('');

    var inviteRows = invites.map(function (i) {
      return '<div class="ag-member"><div class="ag-member__main"><div class="ag-member__name">' + esc(nameOf(i.targetUid || i.uid)) + '</div>'
        + '<div class="ag-member__sub">邀请角色：' + esc(i.role || '成员') + '</div></div>'
        + (view.canManage
          /* D-2：接受只能由被邀请人本人完成，管理员视图不渲染「接受」，仅保留拒绝 */
          ? '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-rejecti="' + esc(i.inviteId) + '">拒绝</button>' : '')
        + '</div>';
    }).join('');

    var joinRows = joins.map(function (j) {
      return '<div class="ag-member"><div class="ag-member__main"><div class="ag-member__name">' + esc(j.name || nameOf(j.uid)) + '</div>'
        + '<div class="ag-member__sub">申请加入</div></div>'
        + (view.canManage
          ? '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-approve="' + esc(j.joinId || j.id) + '">通过</button>'
            + '<button class="ag-btn ag-btn--sm ag-btn--ghost" data-rejectj="' + esc(j.joinId || j.id) + '">拒绝</button>' : '')
        + '</div>';
    }).join('');

    /* P1-6：管理员邀请入口（R-2 移除内联常驻表单，统一走邀请抽屉；legalRep 只读不动） */
    var inviteBox = view.canManage
      ? '<div class="ag-mt-3"><button class="ag-btn ag-btn--primary ag-btn--sm" id="ag-invite-btn">邀请成员</button></div>'
      : '';

    el.innerHTML = '<div class="ag-wrap">'
      + '<section class="ag-card"><h3>成员（' + members.length + '，成员不计省名额）</h3>'
      + (rows || emptyState('暂无成员', '管理员可发送邀请，邀请经对方接受后加入。'))
      + inviteBox
      + '<div class="ag-note">法定代表人由执照登记派生，只读无操作按钮；管理员可邀请/审批/移除；成员只见日常，不见资金与成员管理。移除成员不删除企业订单与台账。角色调整留痕由平台后台承担，本期不在成员页改动法定代表人。</div></section>'
      + '<section class="ag-card"><h3>待处理邀请（' + invites.length + '）</h3>'
      + (inviteRows || emptyState('无待处理邀请', '没有等待接受的邀请记录。', 'inv')) + '</section>'
      + '<section class="ag-card"><h3>加入申请（' + joins.length + '）</h3>'
      + (joinRows || emptyState('无加入申请', '没有等待审批的加入申请。', 'inv')) + '</section>'
      + '</div>';

    /* openConfirm 居中确认弹窗：移除成员不可逆后果，遮罩不可点关 */
    el.querySelectorAll('[data-remove]').forEach(function (b) {
      b.onclick = function () {
        var nm = nameOf(b.dataset.remove) || b.dataset.remove;
        openConfirm({
          title: '移除成员',
          desc: '将把「' + nm + '」移出本公司团队，不删除其历史订单与台账；此操作需要管理员确认，是否继续？',
          dangerLabel: '确认移除',
          onConfirm: function () {
            var r = OrgsStore.removeMember(orgId, b.dataset.remove);
            toast(r.error || '已移除（不删除企业订单/台账）', !r.error);
            if (!r.error) mountTeam(rootEl, orgId);
          }
        });
      };
    });
    el.querySelectorAll('[data-rejecti]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.rejectInvite(b.dataset.rejecti); toast(r.error || '已拒绝', !r.error); }; });
    el.querySelectorAll('[data-approve]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.approveJoin(b.dataset.approve); toast(r.error || '已通过', !r.error); }; });
    el.querySelectorAll('[data-rejectj]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.rejectJoin(b.dataset.rejectj); toast(r.error || '已拒绝', !r.error); }; });
    /* H-1 抽屉化：邀请成员收进底部抽屉 */
    var invBtn = el.querySelector('#ag-invite-btn');
    if (invBtn) invBtn.onclick = function () {
      openDrawer({
        title: '邀请成员',
        bodyHtml: '<div class="ag-field"><label>对方 uid<span class="ag-req">*</span></label>'
          + '<input class="ag-input" data-f="uid" placeholder="被邀请人 uid"><div class="ag-field-err"></div></div>'
          + '<div class="ag-field"><label>角色</label>'
          + '<select class="ag-input" data-f="role"><option value="member">成员</option><option value="admin">管理员</option></select></div>',
        footHtml: '<button class="ag-btn ag-btn--ghost" data-drawer-cancel>取消</button>'
          + '<button class="ag-btn ag-btn--primary" data-drawer-save>发送邀请</button>',
        onOpen: function (d) {
          d.body.parentNode.querySelector('[data-drawer-cancel]').onclick = closeDrawer;
          var save = d.body.parentNode.querySelector('[data-drawer-save]');
          save.onclick = function () {
            if (save.disabled) return;
            var target = (d.body.querySelector('[data-f="uid"]') || {}).value || '';
            var role = (d.body.querySelector('[data-f="role"]') || {}).value || 'member';
            target = target.trim();
            var err = d.body.querySelector('.ag-field-err');
            if (!target) { if (err) { err.textContent = '请填写对方 uid'; err.style.display = 'block'; } return; }
            busy(save, '发送中…', function () {
              var r = OrgsStore.invite(orgId, target, role);
              if (r.error) { toast(r.error, 'err'); return; }
              closeDrawer();
              toast('邀请已发送，待对方接受', true);
              mountTeam(rootEl, orgId);
            });
          };
        }
      });
    };
  }

  /* ---------- M3-4 个人合伙人提现税列叠加（不改原 fee/到账/余额） ---------- */
  function mountWithdrawTax(balanceAmount, hostEl) {
    if (!g('AgentTax') || !hostEl) return;
    var acc = g('entryAccess') ? g('entryAccess')() : null;
    if (!acc || !acc.isIndividualPartner) return; /* 仅个人合伙人；公司台账只展示企业书面税目 */
    var t = AgentTax.laborWithholding(Number(balanceAmount) || 0);
    var block = document.createElement('div');
    block.className = 'ag-card';
    block.innerHTML = '<h3>预扣测算（劳务报酬·方案A，仅展示）</h3>'
      + '<div class="ag-amount-block"><div class="ag-amount-row"><span>税前</span><b>¥' + fmt(t.gross) + '</b></div>'
      + '<div class="ag-amount-row"><span>预扣率</span><b>' + Math.round(t.rate * 100) + '%</b></div>'
      + '<div class="ag-amount-row"><span>预扣税额</span><b>¥' + fmt(t.tax) + '</b></div>'
      + '<div class="ag-amount-row"><span>税后实发(预扣口径)</span><b>¥' + fmt(t.net) + '</b></div>'
      + '<div class="ag-amount-row"><span>税单号(模拟)</span><b>' + (t.certNo || 'EC-DEMO') + '</b></div></div>'
      + '<div class="ag-disc">' + AgentTax.disclaimer() + '</div>';
    hostEl.appendChild(block);
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  }

  var api = {
    mountWorkbench: mountWorkbench,
    mountSubView: mountSubView,
    mountTeam: mountTeam,
    mountWithdrawTax: mountWithdrawTax,
    quotaCap: quotaCap,
    toast: toast,
    badge: badge,
    nameOf: nameOf
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
