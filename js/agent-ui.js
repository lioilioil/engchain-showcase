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

  /* ---------- 轻量 toast（M-02/M-11：替代裸 alert/黑字，不引入依赖） ---------- */
  function toast(msg, ok) {
    if (typeof document === 'undefined') return;
    var t = document.getElementById('ag-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ag-toast';
      t.className = 'ag-toast';
      document.body.appendChild(t);
    }
    t.className = 'ag-toast ag-toast--show' + (ok ? ' ag-toast--ok' : '');
    t.textContent = msg || '';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'ag-toast'; }, 2200);
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

  /* 统一空态（M-08：无 demo 播种文案） */
  function emptyState(title, sub) {
    return '<div class="ag-empty">'
      + '<svg class="ag-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>'
      + '<div class="ag-empty__title">' + esc(title) + '</div>'
      + (sub ? '<div class="ag-empty__sub">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  /* ---------- H-02 两分区只读台账明细表 ---------- */
  function ledgerTable(entries, ratioUsed, Ledger, ratioMap) {
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
        rowPool = fmt(gp); rowAgreed = fmt(ga); rowRetained = fmt(Ledger.round2(gp - ga));
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

    return '<div class="ag-ledger-scroll"><table class="ag-ledger">'
      + '<thead><tr><th>日期</th><th>流水号</th><th>线别</th><th>结算消费</th><th>总盘×50%</th><th>约定</th><th>自留</th><th>状态</th><th>税/冲减备注</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-3);">暂无台账记录</td></tr>') + '</tbody>'
      + '</table></div>';
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
      var ledgerFold = '<details class="ag-card" style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;font-size:13px;padding:6px 2px;">查看封存台账（只读）</summary>'
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
        '开通需经平台人工审核（¥0）；可在入驻类型选择页提交省级总代（省代）申请。') + '</div>';
      return;
    }

    var locked = me.status === 'suspended';
    var cap = quotaCap(me.province);
    var used = Store.countActiveSubAgents ? Store.countActiveSubAgents(me.id)
      : (Store.listSubs() || []).filter(function (s) { return s.parentUid === U && (s.status === 'approved' || s.status === 'suspended'); }).length;
    var subs = (Store.listSubs() || []).filter(function (s) { return s.parentUid === U; });
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

    var rootCls = 'ag-wrap' + (locked ? ' ag-is-locked' : '');
    var lockBanner = locked
      ? '<div class="ag-lock-banner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px;"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>'
        + '<div><b>账号已暂停</b>：发起二级、比例补改、协议操作已锁定，台账只读保留；恢复生效后自动解锁。</div></div>'
      : '';

    el.innerHTML = '<div class="' + rootCls + '">'
      + lockBanner
      /* 身份卡（H-01 身份并列不合并；叠加身份独立 chip） */
      + '<section class="ag-card ag-card--deep ag-rise">'
      + '<div class="ag-prov">授权省：' + esc(me.province) + '</div>'
      + '<div class="ag-quota">名额 ' + used + ' / ' + cap + '（省表核定名额，非固定 10）</div>'
      + '<div style="margin-top:8px;">' + badge(me.status) + '</div>'
      + '<div class="ag-union">'
      + '<span class="ag-chip ag-chip--pa">省级总代</span>'
      + (isIndividualPartnerNow() ? '<span class="ag-chip ag-chip--ip">叠加 · 个人合伙人（并集独立，不合并身份）</span>' : '')
      + '</div></section>'

      /* 二级合作方（H-01：两行卡片式） */
      + '<section class="ag-card"><h3>二级合作方（' + subs.length + '）</h3><div id="ag-subs"></div></section>'

      /* 发起二级（H-03：suspended 由 .ag-form-block 隐藏） */
      + '<section class="ag-card ag-form-block"><h3>发起二级（约定比例选填 0–50%）</h3>'
      + '<div class="ag-field" id="f-sub-co"><label>二级公司名称<span class="ag-req">*</span></label>'
      + '<input id="ag-sub-co" class="ag-input" placeholder="二级公司全称"><div class="ag-field-err"></div></div>'
      + '<div class="ag-field" id="f-sub-uscc"><label>统一社会信用代码</label>'
      + '<input id="ag-sub-uscc" class="ag-input" placeholder="18 位统一社会信用代码（选填）"></div>'
      + '<div class="ag-field" id="f-sub-ratio"><label>约定比例（0–0.5，可空=全自留）</label>'
      + '<input id="ag-sub-ratio" class="ag-input" type="number" min="0" max="0.5" step="0.01" placeholder="0–0.5，留空即 0% 全自留">'
      + '<div class="ag-field-err"></div></div>'
      + '<div class="ag-actions"><button class="ag-btn ag-btn--primary" id="ag-submit">提交申请 · 等待审核开通</button></div>'
      + '<div id="ag-form-msg"></div></section>'

      /* H-02 二级线台账 */
      + '<section class="ag-card"><h3>二级线台账（subLedger · 独立小计）</h3>'
      + ledgerTable(entries.filter(function (e) { return e.line === 'subLedger'; }), ratioUsed, Ledger, ratioByUid)
      + '<div class="ag-amount-block"><div class="ag-amount-row"><span>结算消费 → 总盘(×50%)</span><b>' + fmt(sub.subLedger.settledGross) + ' → ' + fmt(sub.subLedger.pool) + '</b></div>'
      + '<div class="ag-amount-row"><span>约定所得</span><b>' + fmt(sub.subLedger.agreed) + '</b></div>'
      + '<div class="ag-amount-row"><span>总代自留</span><b>' + fmt(sub.subLedger.retained) + '</b></div></div></section>'

      /* 自身线 */
      + '<section class="ag-card"><h3>自身线（selfLedger · 10% · 独立不相加）</h3>'
      + ledgerTable(entries.filter(function (e) { return e.line === 'selfLedger'; }), ratioUsed, Ledger)
      + '<div class="ag-amount-block"><div class="ag-amount-row"><span>自身结算消费 ×10%</span><b>' + fmt(sub.selfLedger.settledBase) + ' = ' + fmt(sub.selfLedger.amount) + '</b></div></div></section>'

      /* M-01：打印/CSV 次级描边；H-03 suspended 置灰 */
      + '<section class="ag-card"><div class="ag-actions ag-actions--edit">'
      + '<button class="ag-btn ag-btn--ghost" onclick="window.print()" ' + (locked ? 'disabled' : '') + '>打印视图</button>'
      + '<button class="ag-btn ag-btn--ghost" id="ag-csv" ' + (locked ? 'disabled' : '') + '>导出当前月 CSV</button></div>'
      + '<div class="ag-disc">' + (Tax && Tax.disclaimer ? Tax.disclaimer() : '模拟测算，非税务意见，非实际代扣金额') + '</div></section>'
      + '</div>';

    var box = el.querySelector('#ag-subs');
    var canAdmin = !!(g('OrgsStore') && OrgsStore.canManage && OrgsStore.canManage(me.orgId));
    box.innerHTML = subs.map(function (s) {
      var signed = s.signature && s.signature.status === 'completed';
      /* D-8：待签琥珀徽标+占位 CTA；已签「查看协议」占位按钮；完整签署板后续迭代 */
      var sig = signed
        ? '<span class="ag-sig">已签 ' + esc(s.signature.code || '') + '</span>'
          + '<button class="ag-btn ag-btn--sm ag-btn--ghost" onclick="AgentUI.toast(\'完整协议查看将在后续版本上线\', false)">查看协议</button>'
        : '<span class="ag-badge ag-st-pending">待签署</span>'
          + '<button class="ag-btn ag-btn--sm ag-btn--ghost" onclick="AgentUI.toast(\'完整签署流程将在后续版本上线\', false)">去签署</button>';
      var adminOps = canAdmin && !locked
        ? '<input class="ag-ratio" data-sid="' + esc(s.id) + '" type="number" min="0" max="0.5" step="0.01" value="' + (s.ratioToSub || 0) + '">'
          + '<button class="ag-btn ag-btn--sm ag-btn--ghost ag-ratio-save" data-sid="' + esc(s.id) + '">补改比例</button>'
        : '<span class="ag-sig">约定 ' + fmt((s.ratioToSub || 0) * 100) + '%</span>';
      return '<div class="ag-sub-card ag-rise">'
        + '<div class="ag-sub-card__top"><span class="ag-sub-card__name">' + esc((s.company && s.company.name) || s.id) + '</span>'
        + badge(s.status) + '</div>'
        + '<div class="ag-sub-card__ops">' + adminOps + sig
        + '<a class="ag-link" href="team.html?org=' + esc(me.orgId) + '">团队管理</a></div>'
        + '</div>';
    }).join('') || emptyState('暂无二级合作方', '发起并经审核通过后，二级公司将在此列出。');

    /* M3-6 比例补改：仅 admin；0–50% 校验，超界拦截不留存；ratioLog 留痕重算（总盘不变） */
    box.querySelectorAll('.ag-ratio-save').forEach(function (b) {
      b.onclick = function () {
        var sid = b.dataset.sid;
        var input = box.querySelector('.ag-ratio[data-sid="' + sid + '"]');
        var rv = Ledger.validateRatio(input.value);
        if (!rv.ok) { toast(rv.msg || '比例无效', false); return; }
        var rec = Store.getSub(sid); if (!rec) return;
        rec.ratioLog = rec.ratioLog || [];
        rec.ratioLog.push({ ratio: rv.value, at: Date.now(), operator: 'admin', reason: '比例补改' });
        rec.ratioToSub = rv.value;
        Store.saveSub(rec);
        toast('已按新比例 ' + (rv.value * 100) + '% 留痕重算（总盘不变）', true);
        mountWorkbench(el);
      };
    });

    var csv = el.querySelector('#ag-csv');
    if (csv) csv.onclick = function () {
      var month = Ledger.monthKey(Date.now());
      var csvText = Ledger.toCsv(entries, month);
      download('agent-ledger-' + month + '.csv', '\ufeff' + csvText);
      toast('已导出当前月两分区 CSV', true);
    };

    var btn = el.querySelector('#ag-submit');
    if (btn) btn.onclick = function () {
      /* M-02：内联红框错误，保留原校验逻辑 */
      function field(id, ok, msg) {
        var f = el.querySelector('#' + id);
        var wrap = f ? f.closest('.ag-field') : null;
        if (!wrap) return;
        wrap.classList.toggle('ag-field--error', !ok);
        var e = wrap.querySelector('.ag-field-err');
        if (e) e.textContent = ok ? '' : msg;
      }
      var co = el.querySelector('#ag-sub-co').value.trim();
      var uscc = el.querySelector('#ag-sub-uscc').value.trim();
      var rv = Ledger.validateRatio(el.querySelector('#ag-sub-ratio').value === '' ? 0 : Number(el.querySelector('#ag-sub-ratio').value));
      field('f-sub-co', !!co, '请填写二级公司名称');
      field('f-sub-ratio', rv.ok, rv.msg);
      if (!co || !rv.ok) { toast('请检查标红项', false); return; }

      /* D-1：先过规则校验（同省/自指/唯一绑定/名额），通过后落盘 pending 二级记录 */
      var Rules = g('AgentRules');
      var quotaCfg = (g('MOCK') && g('MOCK').business && g('MOCK').business.provinceAgentQuota) || {};
      var v = Rules && Rules.validateSubAgent
        ? Rules.validateSubAgent({ company: { name: co, uscc: uscc }, uscc: uscc, province: me.province, ratioToSub: rv.value, parent: me, isNaturalPerson: false },
            { provinceAgents: Store.listProvinces(), subAgents: Store.listSubs(), quotaCfg: quotaCfg })
        : { ok: true };
      if (!v.ok) {
        toast(v.msg || v.code || '发起失败', false);
        field('f-sub-co', false, v.msg || '发起未通过校验');
        return;
      }
      var rec = {
        id: 'sb-' + Date.now().toString(36),
        /* R-1：parentUid 口径与 seed/工作台过滤一致，存上级 uid（me.uid），回退记录 id */
        parentUid: me.uid || me.id,
        uid: '',
        company: { name: co, uscc: uscc, license: '', legalRep: '', contact: '', phone: '' },
        province: me.province,
        ratioToSub: rv.value,
        status: 'pending',
        statusLog: [{ operator: U, at: Date.now(), reason: '发起二级申请', fromStatus: '', toStatus: 'pending' }],
        rejects: [], ratioLog: [],
        signature: { status: 'pending' },
        sealedAt: 0
      };
      var saved = Store.saveSub(rec);
      if (saved && saved.error) { toast(saved.msg || saved.error || '落盘失败', false); return; }
      toast('已登记发起请求，待后台审核开通', true);
      mountWorkbench(el);
    };
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
      el.innerHTML = '<div class="ag-wrap">' + emptyState('当前账号无二级合作记录', '与总代签署协议并通过审核后开通本视角。') + '</div>';
      return;
    }
    var mine = (Store.listLedger() || []).filter(function (e) {
      return (e.subject === U) && e.line === 'subLedger' && e.frozenStatus === 'settled'
        && !e.refunded && Ledger.isEligibleConsumption(e.type, Ledger.DEFAULTS);
    });
    var gross = mine.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
    var pool = Ledger.round2(gross * Ledger.DEFAULTS.grossShare);
    var agreed = Ledger.round2(pool * (rec.ratioToSub || 0));
    var frozenCount = (Store.listLedger() || []).filter(function (e) {
      /* D-9：仅本人 subLedger 合格消费的冻结笔计入，排除充值/非合格类型 */
      return e.subject === U && e.line === 'subLedger' && e.frozenStatus === 'frozen'
        && !e.refunded && Ledger.isEligibleConsumption(e.type, Ledger.DEFAULTS);
    }).length;
    var signed = rec.signature && rec.signature.status === 'completed';

    el.innerHTML = '<div class="ag-wrap">'
      + '<section class="ag-card ag-card--sub ag-rise">'
      + '<div class="ag-prov">' + esc((rec.company && rec.company.name) || '') + '</div>'
      + '<div class="ag-meta" style="margin-top:6px;">归属省：' + esc(rec.province) + ' ｜ 约定比例 ' + fmt((rec.ratioToSub || 0) * 100) + '% ｜ ' + badge(rec.status) + '</div>'
      + '<div class="ag-meta" style="margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">协议：'
      + (signed
        ? '<span class="ag-sig">已签署 ' + esc(rec.signature.code || '') + '</span><button class="ag-btn ag-btn--sm ag-btn--ghost" onclick="AgentUI.toast(\'完整协议查看将在后续版本上线\', false)">查看协议</button>'
        : '<span class="ag-badge ag-st-pending">待签署</span><button class="ag-btn ag-btn--sm ag-btn--ghost" onclick="AgentUI.toast(\'完整签署流程将在后续版本上线\', false)">去签署</button>')
      + '</div>'
      + '<h3 style="margin-top:16px;">本人约定所得（仅可见本人）</h3>'
      + '<div class="ag-big">¥' + fmt(agreed) + '</div>'
      + '<div class="ag-amount-block">'
      + '<div class="ag-amount-row"><span>本人合格消费（已结算）</span><b>¥' + fmt(gross) + '</b></div>'
      + '<div class="ag-amount-row"><span>总盘（×50%）</span><b>¥' + fmt(pool) + '</b></div>'
      + (frozenCount ? '<div class="ag-amount-row"><span>冻结中（T+7 未计入）</span><b>' + frozenCount + ' 笔</b></div>' : '')
      + '</div>'
      + '<div class="ag-disc">本视角不展示总代自留与总代自身收益线；金额为模拟测算，非税务意见，非实际代扣金额。</div>'
      + '</section></div>';
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

    el.innerHTML = '<div class="ag-wrap">'
      + '<section class="ag-card"><h3>成员（' + members.length + '，成员不计省名额）</h3>'
      + (rows || emptyState('暂无成员', '管理员可发送邀请，邀请链接经对方接受后加入。'))
      + '<div class="ag-note">法定代表人由执照登记派生，只读无操作按钮；管理员可邀请/审批/移除；成员只见日常，不见资金与成员管理。移除成员不删除企业订单与台账。</div></section>'
      + '<section class="ag-card"><h3>待处理邀请（' + invites.length + '）</h3>'
      + (inviteRows || emptyState('无待处理邀请', '没有等待接受的邀请记录。')) + '</section>'
      + '<section class="ag-card"><h3>加入申请（' + joins.length + '）</h3>'
      + (joinRows || emptyState('无加入申请', '没有等待审批的加入申请。')) + '</section>'
      + '</div>';

    el.querySelectorAll('[data-remove]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.removeMember(orgId, b.dataset.remove); toast(r.error || '已移除（不删除企业订单/台账）', !r.error); }; });
    el.querySelectorAll('[data-rejecti]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.rejectInvite(b.dataset.rejecti); toast(r.error || '已拒绝', !r.error); }; });
    el.querySelectorAll('[data-approve]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.approveJoin(b.dataset.approve); toast(r.error || '已通过', !r.error); }; });
    el.querySelectorAll('[data-rejectj]').forEach(function (b) { b.onclick = function () { var r = OrgsStore.rejectJoin(b.dataset.rejectj); toast(r.error || '已拒绝', !r.error); }; });
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
