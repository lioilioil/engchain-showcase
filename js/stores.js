/* =====================================================================
   js/stores.js —— 商业模式 v1.2 Store 基建（COMMERCE-EXECUTION-MANUAL §2.1）
   遵循 common.js 的 stateStore / CorpPay 范式：
   - 所有 localStorage 键统一 engchain-* 前缀
   - 每个 Store 提供 read/write/reset，write 派发 CustomEvent('engchain:<name>',{detail})
   依赖：js/data.js（window.MOCK.business）；js/common.js（window.UI）
   引入顺序：data.js → common.js → stores.js
   ===================================================================== */
(function () {
  'use strict';
  var LS = window.localStorage;
  var MOCK = window.MOCK || {};

  function jsonSafe(v) { try { return JSON.parse(v); } catch (e) { return null; } }

  /* 通用 Store 工厂 */
  function makeStore(KEY, def, evtName) {
    function load() { return Object.assign({}, def, jsonSafe(LS.getItem(KEY)) || {}); }
    function save(s) {
      try { LS.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      window.dispatchEvent(new CustomEvent(evtName, { detail: s }));
      return s;
    }
    return {
      KEY: KEY,
      read: load,
      get: load,
      write: save,
      set: function (part) { return save(Object.assign(load(), part)); },
      reset: function () { try { LS.removeItem(KEY); } catch (e) {} return save(def); }
    };
  }

  /* ---- 认证记录（R1，v3.0 五身份叠加） ----
     personalQual = 个人建筑类专业资质（建造师等）；enterpriseQual = 企业资质（建筑业企业资质等）
     personalEntry = 个人入驻（资质+完整简历，v3.0 新增；personalQual 保留为兼容别名）
     partner = 个人合伙人（分销意向+推广渠道，v3.0 新增；与企业入驻 partner 类型分离）
     enterprise.shortName/nameBasis/nameProof = 企业简称及命名依据（v3.0 新增）
     旧 qual 字段保留为兼容别名（取 personalQual + enterpriseQual 合并） */
  var AuthStore = makeStore('engchain-auth',
    { realname: { ok: false, ts: 0, name: '', idNo: '', mobile: '', idMask: '' },
      enterprise: { ok: false, expireAt: 0, co: '', code: '', legal: '', status: '', note: '', fee: 0, submittedAt: 0,
        shortName: '', nameBasis: '', nameProof: [],
        /* [FEAT 9.2-3] 多维资质核验：5项逐项提交/审核 */
        dimensions: { business: { status: 'pending', submittedAt: 0, files: [] }, legal: { status: 'pending', submittedAt: 0, files: [] }, qualification: { status: 'pending', submittedAt: 0, files: [] }, bank: { status: 'pending', submittedAt: 0, files: [] }, office: { status: 'pending', submittedAt: 0, files: [] } } },
      personalQual: { ok: false, list: [], certs: [], status: '', note: '', submittedAt: 0 },
      personalEntry: { ok: false, status: '', note: '', submittedAt: 0, list: [], certs: [],
        userType: 'jobseeker', resumeComplete: false, /* v3.1：个人入驻两类用户区分（jobseeker求职/standard标准）+ 简历完成标记 */
        profile: { basic: { gender: '', birth: '', location: '', jobStatus: '', mobile: '', wechat: '', address: '' },
          education: [], work: [], project: [], skills: [],
          jobIntent: { position: '', salary: '', salaryRange: '', minAcceptable: '', certSubsidy: '', arrivalTime: '', location: '', workType: '' },
          intro: '', resumeFile: '', regStatus: null, socialSecurity: null } },
      enterpriseQual: { ok: false, list: [] },
      partner: { ok: false, status: '', note: '', submittedAt: 0, approvedAt: 0,
        channel: [], intent: '', intro: '', experience: '', profitConfig: {} },
      qual: { ok: false, list: [] } },
    'engchain:auth');
  /* [FEAT 9.2-3] 提交某一维核验材料 */
  AuthStore.submitDimension = function (type, payload) {
    var s = this.read();
    if (!s.enterprise) s.enterprise = {};
    if (!s.enterprise.dimensions) s.enterprise.dimensions = {};
    if (!s.enterprise.dimensions[type]) s.enterprise.dimensions[type] = { status: 'pending', submittedAt: 0, files: [] };
    s.enterprise.dimensions[type].status = 'pending_review';
    s.enterprise.dimensions[type].submittedAt = Date.now();
    s.enterprise.dimensions[type].files = (payload && payload.files) || s.enterprise.dimensions[type].files || [];
    return this.write(s);
  };
  /* [FEAT 9.2-3] 返回各维度审核状态和整体进度，并计算认证等级 */
  AuthStore.dimensionStatus = function () {
    var s = this.read();
    var dims = (s.enterprise && s.enterprise.dimensions) || {};
    var cfg = (MOCK.business.certification && MOCK.business.certification.dimensions) || [];
    var list = [];
    var doneCount = 0;
    cfg.forEach(function (d) {
      var cur = dims[d.id] || { status: 'pending', submittedAt: 0, files: [] };
      var isDone = cur.status === 'approved' || cur.status === 'done';
      if (isDone) doneCount++;
      list.push({ id: d.id, label: d.label, required: d.required, status: cur.status, submittedAt: cur.submittedAt, done: isDone });
    });
    /* 认证等级：完成必选项=基础认证，完成3项以上=高级认证，完成全部5项=完整认证 */
    var level = 'none';
    if (doneCount >= 5) level = 'full';
    else if (doneCount >= 3) level = 'advanced';
    else if (doneCount >= 2) level = 'basic';
    var levelLabelMap = { none: '未认证', basic: '基础认证', advanced: '高级认证', full: '完整认证' };
    return { list: list, doneCount: doneCount, total: cfg.length, level: level, levelLabel: levelLabelMap[level] || '未认证' };
  };

  /* ---- 入驻记录（R2，v2.0 多类型并行 + v3.0 扩展资料） ----
     types = 入驻类型数组，支持并行（合伙人可与建筑/中介同时存在；建筑⇄中介互斥）
     qualifications[] = 建筑资质列表（v3.0 新增）
     intro{} = 企业介绍（成立年份/注册资本/员工规模/简介，v3.0 新增）
     cases[] = 企业案例列表（v3.0 新增）
     address/website = 办公地址/官网（v3.0 新增）
     旧 type 字段保留为兼容别名（取 types[0]） */
  var EntryStore = makeStore('engchain-entry',
    { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0,
      depositType: null, depositPaid: 0, fee: 0, contact: '', tel: '', scope: '', submittedAt: 0, note: '',
      /* [FEAT 9.2-2] 付费模式：once=一次性入驻 / yearly=年度订阅 */
      cycle: 'once',
      qualifications: [], intro: { founded: '', capital: '', staffSize: '', desc: '' },
      cases: [], address: { province: '', city: '', district: '', detail: '' }, website: '', attachments: [] },
    'engchain:entry');
  /* [FEAT 9.2-2] 年度订阅续费：cycle==='yearly' 时扣减年费并延长一年 */
  EntryStore.renew = function (fee) {
    var s = this.read();
    if (s.cycle !== 'yearly') return { error: '当前非年度订阅模式' };
    var price = fee || 0;
    if (price > 0 && window.BalanceStore) {
      var r = BalanceStore.consume(price, 'entry_renew', { method: 'balance', remark: '入驻年费续费' });
      if (!r) return { error: '余额不足，请先充值' };
    }
    var base = Math.max(s.expireAt || Date.now(), Date.now());
    s.expireAt = base + 365 * 864e5;
    s.paidAt = Date.now();
    s.renewedAt = Date.now();
    return this.write(s);
  };
  /* [FEAT 9.2-2] 到期提醒：expireAt - now <= remindDays 天 */
  EntryStore.needRenew = function () {
    var s = this.read();
    if (s.cycle !== 'yearly' || !s.active || !s.expireAt) return false;
    var remindDays = (MOCK.business.subscription && MOCK.business.subscription.remindDays) || 30;
    var daysLeft = (s.expireAt - Date.now()) / 864e5;
    return daysLeft <= remindDays && daysLeft > 0;
  };
  EntryStore.approve = function () { var s = this.read(); s.status = 'active'; s.active = true; return this.write(s); };
  EntryStore.pending = function () { var s = this.read(); s.status = 'pending'; s.active = false; return this.write(s); };

  /* ---- 解锁积分账户（R3+R4） ---- */
  var CreditStore = makeStore('engchain-credits',
    { balance: 0, logs: [], quota: { month: '', used: 0 } },
    'engchain:credits');
  CreditStore.monthKey = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); };
  /* [FEAT 9.2-2] 积分 TTL：入账流水记录 expireAt = ts + ttlDays*86400000；旧历史流水无 expireAt，不参与过期清理（平滑迁移）。 */
  CreditStore._ttlMs = function () {
    var days = (MOCK.business.credits && MOCK.business.credits.ttlDays) || 365;
    return days * 864e5;
  };
  CreditStore.add = function (credits, reason, meta) {
    this.expireDue();
    var s = this._rawLoad(); s.balance += credits;
    var rec = Object.assign({ type: 'recharge', credits: credits, reason: reason || '充值到账', ts: Date.now(), expireAt: Date.now() + this._ttlMs(), status: 'success' }, meta || {});
    s.logs.unshift(rec);
    return this.write(s);
  };
  /* [FEAT 9.2-2] 惰性过期清理：扫描 logs 中 expireAt<=now 的入账流水，批量扣减 balance 并写 credits_expired 汇总流水。
     内部直接读写 LS（_rawLoad/write），避免 read() 递归调用。 */
  CreditStore.expireDue = function () {
    var now = Date.now();
    var s = this._rawLoad();
    var expiredTotal = 0;
    (s.logs || []).forEach(function (rec) {
      if (rec && rec.credits > 0 && rec.expireAt && !rec.expired && rec.expireAt <= now) {
        rec.expired = true;
        expiredTotal += rec.credits;
      }
    });
    if (expiredTotal > 0) {
      s.balance = Math.max(0, (s.balance || 0) - expiredTotal);
      s.logs.unshift({ type: 'credits_expired', credits: -expiredTotal, reason: '积分到期自动清零', ts: now, status: 'success' });
      this.write(s);
    }
    return expiredTotal;
  };
  /* [FEAT 9.2-2] 查询未来 withinDays 天内即将过期的积分数（钱包页"即将过期"提示用） */
  CreditStore.expiringSoon = function (withinDays) {
    this.expireDue();
    var s = this._rawLoad();
    var horizon = Date.now() + (withinDays || 30) * 864e5;
    var sum = 0;
    (s.logs || []).forEach(function (rec) {
      if (rec && rec.credits > 0 && rec.expireAt && !rec.expired && rec.expireAt <= horizon) sum += rec.credits;
    });
    return sum;
  };
  CreditStore.consume = function (cost, reason, meta) {
    this.expireDue(); /* [FEAT 9.2-2] 消费前先惰性清理过期积分 */
    var s = this._rawLoad(); if (s.balance < cost) return null;
    s.balance -= cost;
    var rec = Object.assign({ type: 'unlock', credits: -cost, reason: reason || '信息解锁', ts: Date.now(), status: 'success' }, meta || {});
    s.logs.unshift(rec);
    return this.write(s);
  };
  /* [FEAT 9.2-2] 包裹 read()：每次读取前惰性过期清理；_rawLoad 为 makeStore 原始 load */
  CreditStore._rawLoad = CreditStore.read;
  CreditStore.read = function () { this.expireDue(); return this._rawLoad(); };
  CreditStore.freeUsed = function () {
    var s = this.read(); var mk = this.monthKey();
    if (s.quota.month !== mk) { s.quota = { month: mk, used: 0 }; this.write(s); }
    return s.quota.used;
  };
  CreditStore.freeSpend = function (n) {
    var s = this.read(); var mk = this.monthKey();
    if (s.quota.month !== mk) s.quota = { month: mk, used: 0 };
    s.quota.used += (n || 1);
    return this.write(s);
  };
  /* 任务奖励领取（v1.3）：注册/实名/入驻等一次性奖励，防重发放 */
  var REWARDS_KEY = 'engchain-credits-rewards';
  CreditStore.rewards = function () {
    try { var r = JSON.parse(LS.getItem(REWARDS_KEY)); if (r && r.claimed) return r; } catch (e) {}
    return { claimed: {} };
  };
  CreditStore.claimed = function (key) { return !!this.rewards().claimed[key]; };
  CreditStore.claim = function (key, amount, reason) {
    var r = this.rewards();
    if (r.claimed[key]) return false;
    var cfg = (MOCK.business.credits && MOCK.business.credits.rewards) || {};
    var amt = (typeof amount === 'number') ? amount : (cfg[key] || 0);
    if (amt <= 0) return false;
    r.claimed[key] = { ts: Date.now() };
    try { LS.setItem(REWARDS_KEY, JSON.stringify(r)); } catch (e) {}
    this.add(amt, reason || '任务奖励');
    return true;
  };
  /* 邀请奖励（v1.3）：被邀注册填写邀请码后发放给邀请方
     [FIX BM-036] 修复：原实现接受任意非空邀请码即发 50 积分，无防重。
     新规则：(1) 邀请码必须对应用户表中真实存在的用户（account 或 id 匹配）；
             (2) 同一设备已领取过的邀请码不可重复领取（localStorage 记录）。 */
  var INVITED_CODES_KEY = 'engchain-credits-invited-codes';
  CreditStore._invitedCodes = function () {
    try { var r = JSON.parse(LS.getItem(INVITED_CODES_KEY) || '[]'); if (Array.isArray(r)) return r; } catch (e) {}
    return [];
  };
  CreditStore.inviteReward = function (code) {
    if (!code) return false;
    code = String(code).trim();
    if (!code) return false;
    var cfg = (MOCK.business.credits && MOCK.business.credits.rewards) || {};
    var amt = cfg.invite || 50;
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    var me = st.account || '';
    if (code === me) return false;
    /* (1) 邀请码须对应真实用户（account 或 id 匹配用户表） */
    var exists = false;
    try {
      if (window.DataBus && typeof window.DataBus.users === 'function') {
        var users = window.DataBus.users() || [];
        for (var i = 0; i < users.length; i++) {
          if (String(users[i].account) === code || String(users[i].id) === code) { exists = true; break; }
        }
      }
    } catch (e) {}
    if (!exists) return false;
    /* (2) 同一设备防重：已领过该邀请码则拒绝 */
    var claimed = this._invitedCodes();
    if (claimed.indexOf(code) >= 0) return false;
    claimed.push(code);
    try { LS.setItem(INVITED_CODES_KEY, JSON.stringify(claimed)); } catch (e) {}
    this.add(amt, '邀请好友奖励', { inviteCode: code });
    return true;
  };

  /* ---- 每日签到（v1.3）：同日防重、连签计数、满 N 天额外送 ---- */
  var CheckinStore = makeStore('engchain-checkin', { last: '', count: 0 }, 'engchain:checkin');
  CheckinStore.today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  CheckinStore.yesterday = function () { var d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  CheckinStore.checkedToday = function () { return this.read().last === this.today(); };
  CheckinStore.checkin = function () {
    var s = this.read();
    var today = this.today();
    if (s.last === today) return { ok: false, credits: 0, count: s.count, reason: '今日已签到' };
    var count = (s.last === this.yesterday()) ? (s.count + 1) : 1;
    var cfg = (MOCK.business.credits && MOCK.business.credits.rewards) || {};
    var base = cfg.checkin || 10;
    var streak = cfg.checkinStreak || 50;
    var days = cfg.checkinStreakDays || 7;
    var extra = (count % days === 0) ? streak : 0;
    s.last = today; s.count = count;
    this.write(s);
    if (extra) CreditStore.add(base + extra, '连续签到 ' + count + ' 天奖励');
    else CreditStore.add(base, '每日签到');
    return { ok: true, credits: base + extra, count: count, extra: extra };
  };

  /* ---- 人民币余额账本（v1.3）：充值/提现/对公审批入账 全部落账 ----
     [FIX BM-045] 注释：当前原型为单用户单钱包，frozen 种子 ¥200 为演示占位数据；
     多用户切换时余额会随用户表快照同步（见 databus.js login / syncSnapshotIfCurrent）。
     [FIX BM-038] 新增 totalRebate 字段：分销返佣累计（与 totalIn 累计充值口径分离，不污染充值统计）。 */
  var BalanceStore = makeStore('engchain-balance',
    {
      balance: (MOCK.wallet && typeof MOCK.wallet.balance === 'number') ? MOCK.wallet.balance : 1286.50,
      frozen: (MOCK.wallet && typeof MOCK.wallet.frozen === 'number') ? MOCK.wallet.frozen : 200,
      totalIn: (MOCK.wallet && typeof MOCK.wallet.total === 'number') ? MOCK.wallet.total : 13486.50,
      totalRebate: 0,
      logs: []
    }, 'engchain:balance');
  /* 首访种子流水：把 MOCK.transactions 静态明细映射为余额账流水（幂等：logs 非空即跳过） */
  BalanceStore.seedLogs = function () {
    var s = this.read();
    if (s.logs && s.logs.length) return s;
    var arr = ((MOCK.transactions) || []).map(function (t) {
      return { type: t.type, amount: t.amount, method: t.type, reason: t.t, ts: new Date(String(t.date).replace(/-/g, '/')).getTime() || Date.now() };
    });
    s.logs = arr;
    return this.write(s);
  };
  BalanceStore.available = function () {
    var s = this.read();
    return Math.round((s.balance - s.frozen) * 100) / 100;
  };
  /* [FIX BM-050] recharge 保持干净：只做充值入账（balance += amt, totalIn += amt），
     不夹带任何返佣/外部 monkey-patch 钩子。返佣请显式调用下方 rebate()。 */
  BalanceStore.recharge = function (amount, method, extra) {
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    s.balance += amt; s.totalIn += amt;
    s.logs.unshift({
      type: 'recharge', amount: amt, method: method || 'wechat',
      reason: (extra && extra.remark) || (method === 'corp' ? '对公转账' : '充值到账'),
      ts: Date.now()
    });
    return this.write(s);
  };
  /* [FIX BM-005/BM-008/BM-009] 统一消费入口：校验 available() 后扣减并写 logs。
     type 建议 'certification'/'entry'/'consume'；meta.method 记录支付方式。 */
  BalanceStore.consume = function (amount, type, meta) {
    meta = meta || {};
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    if (amt <= 0) return s;
    if (this.available() < amt) return null;
    s.balance = Math.round((s.balance - amt) * 100) / 100;
    s.logs.unshift({
      type: type || 'consume', amount: -amt, method: meta.method || 'balance',
      reason: meta.remark || '消费支出', ts: Date.now()
    });
    return this.write(s);
  };
  /* [FIX BM-003/BM-006] 退款回退：balance += amt，写退款流水。 */
  BalanceStore.refund = function (amount, reason, meta) {
    meta = meta || {};
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    s.balance = Math.round((s.balance + amt) * 100) / 100;
    s.logs.unshift({
      type: 'refund', amount: amt, method: meta.method || 'balance',
      reason: reason || '退款', ts: Date.now()
    });
    return this.write(s);
  };
  /* [FIX BM-038] 分销返佣派发：balance += amt 且 totalRebate += amt（不计入 totalIn 累计充值）。 */
  BalanceStore.rebate = function (amount, reason, meta) {
    meta = meta || {};
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    if (amt <= 0) return s;
    s.balance = Math.round((s.balance + amt) * 100) / 100;
    s.totalRebate = Math.round(((s.totalRebate || 0) + amt) * 100) / 100;
    s.logs.unshift({
      type: 'rebate', amount: amt, method: 'rebate',
      reason: reason || '分销返佣', ts: Date.now()
    });
    return this.write(s);
  };
  /* [FIX BM-007] 保证金冻结：available() 校验后 frozen += amt。 */
  BalanceStore.freezeDeposit = function (amount, reason) {
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    if (amt <= 0) return s;
    if (this.available() < amt) return null;
    s.frozen = Math.round((s.frozen + amt) * 100) / 100;
    s.logs.unshift({ type: 'freeze', amount: -amt, method: 'deposit', reason: reason || '保证金冻结', ts: Date.now() });
    return this.write(s);
  };
  /* [FIX BM-007] 保证金解冻（驳回/退出）：frozen -= amt，余额不变。 */
  BalanceStore.unfreezeDeposit = function (amount, reason) {
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    s.frozen = Math.max(0, Math.round((s.frozen - amt) * 100) / 100);
    s.logs.unshift({ type: 'unfreeze', amount: amt, method: 'deposit', reason: reason || '保证金解冻', ts: Date.now() });
    return this.write(s);
  };
  /* [FIX BM-007] 保证金转正（终审入驻）：frozen 划转至实缴 depositPaid（frozen -= amt 且 balance -= amt）。 */
  BalanceStore.commitDeposit = function (amount, reason) {
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    s.frozen = Math.max(0, Math.round((s.frozen - amt) * 100) / 100);
    s.balance = Math.max(0, Math.round((s.balance - amt) * 100) / 100);
    s.logs.unshift({ type: 'deposit_paid', amount: -amt, method: 'deposit', reason: reason || '保证金缴纳', ts: Date.now() });
    return this.write(s);
  };
  BalanceStore.withdraw = function (amount, method, extra) {
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    if (s.balance - s.frozen < amt) return null;
    s.balance -= amt;
    s.logs.unshift({
      type: 'withdraw', amount: -amt, method: method || 'bank',
      reason: (extra && extra.remark) || '余额提现',
      ts: Date.now()
    });
    return this.write(s);
  };
  /* 对公审批通过入账（v1.3）：CorpPay 记录 approved 后调用 */
  BalanceStore.settleCorp = function (corpId, amount) {
    var s = this.read(); var amt = Math.round(amount * 100) / 100;
    s.balance += amt; s.totalIn += amt;
    s.logs.unshift({
      type: 'recharge', amount: amt, method: 'corp', reason: '对公转账 · 审批通过', corpId: corpId,
      ts: Date.now()
    });
    return this.write(s);
  };

  /* ---- 中介线上订单（R5） ---- */
  var AgencyOrderStore = makeStore('engchain-agency-orders', { list: [] }, 'engchain:agency-orders');
  AgencyOrderStore.create = function (o) {
    var s = this.read();
    o.id = 'AO' + String(Date.now()).slice(-8);
    o.state = 'pending'; o.createdAt = Date.now(); o.updatedAt = o.createdAt;
    s.list.unshift(o);
    this.write(s);
    return o;
  };
  AgencyOrderStore.byId = function (id) {
    var s = this.read(); var i;
    for (i = 0; i < s.list.length; i++) if (s.list[i].id === id) return s.list[i];
    return null;
  };
  /* [FIX BM-023] 修复：原 transition() 不校验状态机，订单可任意跳变。
     新增合法迁移表校验，非法迁移返回 null 并 console.warn。 */
  var AGENCY_ORDER_LEGAL = {
    pending: ['paid', 'cancelled'],
    paid: ['serving', 'cancelled', 'refunded'],
    serving: ['completed', 'refunded'],
    completed: [],
    cancelled: [],
    refunded: []
  };
  AgencyOrderStore.transition = function (id, next, patch) {
    var s = this.read(); var it = null; var i;
    for (i = 0; i < s.list.length; i++) if (s.list[i].id === id) { it = s.list[i]; break; }
    if (!it) return null;
    var allowed = AGENCY_ORDER_LEGAL[it.state] || [];
    if (allowed.indexOf(next) < 0) {
      console.warn('[AgencyOrder] 非法状态迁移 ' + it.state + ' -> ' + next + ' (order ' + id + ')');
      return null;
    }
    it.state = next;
    if (patch) for (var k in patch) if (patch.hasOwnProperty(k)) it[k] = patch[k];
    it.updatedAt = Date.now();
    return this.write(s);
  };

  /* ---- 发票（engchain-invoices：申请→审核→开票/驳回全链路） ----
     items[] = { id, title, tax, type, amount, email, orderId, status, ts, issuedAt, rejectNote, invoiceNo }
     status: pending(待审核) / issued(已开票) / rejected(已驳回)
     与 databus.js 旧 engchain-invoices 数组兼容：首次加载自动迁移旧格式 */
  var InvoiceStore = makeStore('engchain-invoices', { items: [] }, 'engchain:invoice');
  (function migrateInvoices() {
    try {
      var old = JSON.parse(LS.getItem('engchain-invoices') || 'null');
      if (Array.isArray(old) && old.length) {
        var s = InvoiceStore.read();
        if (!s.items || !s.items.length) {
          s.items = old.map(function (x) {
            var stMap = { pending: 'pending', issued: 'issued', shipped: 'issued', void: 'rejected' };
            return {
              id: x.id || ('INV' + Date.now()),
              title: x.title || '', tax: x.tax || '', type: x.type || '增值税普通发票',
              amount: x.amount || 0, email: x.email || '', orderId: x.orderId || '',
              status: stMap[x.status] || 'pending',
              ts: x.applyAt ? new Date(String(x.applyAt).replace(/-/g, '/')).getTime() : Date.now(),
              issuedAt: x.status === 'issued' ? Date.now() : 0,
              rejectNote: x.note || '', invoiceNo: x.invoiceNo || ''
            };
          });
          InvoiceStore.write(s);
        }
      }
    } catch (e) {}
  })();
  InvoiceStore.apply = function (payload) {
    var s = this.read();
    var item = Object.assign({ id: 'INV' + Date.now(), status: 'pending', ts: Date.now(), issuedAt: 0, rejectNote: '', invoiceNo: '' }, payload);
    s.items.unshift(item);
    this.write(s);
    return item;
  };
  InvoiceStore.approve = function (id) {
    var s = this.read();
    s.items.forEach(function (i) {
      if (i.id === id) { i.status = 'issued'; i.issuedAt = Date.now(); i.invoiceNo = i.invoiceNo || ('FP' + Date.now()); }
    });
    this.write(s);
  };
  InvoiceStore.reject = function (id, note) {
    var s = this.read();
    s.items.forEach(function (i) {
      if (i.id === id) { i.status = 'rejected'; i.rejectNote = note || '资料不完整'; }
    });
    this.write(s);
  };
  InvoiceStore.list = function () { return this.read().items || []; };

  /* ---- 佣金流水 + 防跳单违规（R5 后台跟踪） ----
     [FIX BM-025] 修复：原 flows 无状态细分（仅 done），T+1 为文案。
     新结构：flow.status = pending(待结算) / settled(已结算) / withdrawable(可提现) / paid(已提现)；
     frozenUntil = 可结算时间戳（默认创建 +1 天），读取时惰性到期自动 pending->settled。 */
  var CommissionStore = makeStore('engchain-commission', { flows: [], violations: [] }, 'engchain:commission');
  CommissionStore.addFlow = function (f) {
    var s = this.read();
    f = Object.assign({ status: 'pending', frozenUntil: Date.now() + 864e5 }, f || {});
    s.flows.unshift(f);
    return this.write(s);
  };
  CommissionStore.addViolation = function (v) { var s = this.read(); s.violations.unshift(v); return this.write(s); };
  /* 惰性结算：frozenUntil 到期的 pending 流水自动转 settled，返回本次结算条数 */
  CommissionStore._lazySettle = function (s) {
    var now = Date.now(), n = 0;
    (s.flows || []).forEach(function (fl) {
      if (fl.status === 'pending' && fl.frozenUntil && fl.frozenUntil <= now) { fl.status = 'settled'; n++; }
    });
    return n;
  };
  CommissionStore.settleFlow = function (id) {
    var s = this.read(); var hit = false;
    (s.flows || []).forEach(function (fl) {
      if (String(fl.id) === String(id) && fl.status === 'pending') { fl.status = 'settled'; hit = true; }
    });
    if (hit) this.write(s);
    return hit;
  };
  CommissionStore.markWithdrawable = function (id) {
    var s = this.read(); var hit = false;
    (s.flows || []).forEach(function (fl) {
      if (String(fl.id) === String(id) && fl.status === 'settled') { fl.status = 'withdrawable'; hit = true; }
    });
    if (hit) this.write(s);
    return hit;
  };

  /* ---- 企业关注/监控（P0-7.1） ----
     [FIX BM-040] 修复：监控限额原仅页面级校验，未下沉 Store 层。
     follow() 现按当前身份从 MOCK.business.monitor.limits 取限额；超限返回 {error}。
     checkDailyPush() 每日首次调用为每个 follow 生成一条 feed 推送。 */
  var MonitorStore = makeStore('engchain-monitor', { follows: [], feed: [], lastPushDate: '' }, 'engchain:monitor');
  MonitorStore._limitForIdentity = function () {
    var limits = (MOCK.business.monitor && MOCK.business.monitor.limits) || { realname: 5, pro: 10, construction: 30, agency: 50, partner: 200 };
    var idy = (typeof deriveIdentity === 'function') ? deriveIdentity() : {};
    if (idy.isGuest) return limits.realname;
    if (idy.primary === 'partner') return limits.partner;
    if (idy.primary === 'pro') return limits.pro;
    if (idy.primary === 'realname') return limits.realname;
    if (idy.primary === 'resident') {
      var t = (idy.entryTypes && idy.entryTypes[0]) || 'construction';
      return limits[t] || limits.construction;
    }
    return limits.realname;
  };
  MonitorStore.follow = function (companyId) {
    var s = this.read(); var i;
    for (i = 0; i < s.follows.length; i++) if (s.follows[i].companyId === companyId) return s;
    var limit = this._limitForIdentity();
    if (s.follows.length >= limit) return { error: '关注数量已达上限' };
    s.follows.push({ companyId: companyId, ts: Date.now() });
    return this.write(s);
  };
  /* [FIX BM-040] 每日推送：跨天首次调用时为每个 follow 生成一条 feed */
  MonitorStore.checkDailyPush = function () {
    var s = this.read();
    var d = new Date(); var today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (s.lastPushDate === today) return s;
    s.lastPushDate = today;
    var dims = (MOCK.business.monitor && MOCK.business.monitor.dimensions) || ['资质到期', '项目更新'];
    (s.follows || []).forEach(function (f, idx) {
      s.feed.unshift({
        companyId: f.companyId,
        dim: dims[idx % dims.length],
        title: '监控日报 · ' + (f.companyId || '企业'),
        read: false,
        ts: Date.now()
      });
    });
    return this.write(s);
  };
  MonitorStore.unfollow = function (companyId) {
    var s = this.read(); s.follows = s.follows.filter(function (x) { return x.companyId !== companyId; });
    return this.write(s);
  };
  MonitorStore.isFollowed = function (companyId) {
    var s = this.read(); var i;
    for (i = 0; i < s.follows.length; i++) if (s.follows[i].companyId === companyId) return true;
    return false;
  };
  MonitorStore.pushFeed = function (item) {
    var s = this.read(); s.feed.unshift(Object.assign({ read: false, ts: Date.now() }, item));
    return this.write(s);
  };

  /* ---- 收藏夹（engchain-favorites：供需/人才/企业等收藏条目） ----
     items[] = { id, bizKey, title, type, dir, location, amount, ts }
     兼容旧键 engchain-favorite（原始数组）首次加载自动迁移 */
  var FavoriteStore = makeStore('engchain-favorites', { items: [] }, 'engchain:favorite');
  (function migrateFavorites() {
    try {
      var old = JSON.parse(LS.getItem('engchain-favorite') || 'null');
      if (Array.isArray(old) && old.length) {
        var s = FavoriteStore.read();
        var existIds = {};
        (s.items || []).forEach(function (it) { existIds[it.id] = true; });
        old.forEach(function (x) {
          var o = (typeof x === 'object' && x) ? x : { id: String(x) };
          if (!existIds[o.id]) { s.items.push({ id: o.id, bizKey: o.bizKey || 'supply', title: o.title || '收藏条目', type: o.type || '', dir: o.dir || '', location: o.location || '', amount: o.amount || '', ts: o.ts || Date.now() }); existIds[o.id] = true; }
        });
        FavoriteStore.write(s);
      }
      LS.removeItem('engchain-favorite');
    } catch (e) {}
  })();
  FavoriteStore.list = function () { return this.read().items || []; };
  FavoriteStore.add = function (item) {
    var s = this.read();
    if (!s.items) s.items = [];
    for (var i = 0; i < s.items.length; i++) if (String(s.items[i].id) === String(item.id)) return s.items[i];
    s.items.unshift(Object.assign({ ts: Date.now() }, item));
    this.write(s);
    return item;
  };
  FavoriteStore.remove = function (id) {
    var s = this.read();
    s.items = (s.items || []).filter(function (it) { return String(it.id) !== String(id); });
    this.write(s);
    return true;
  };
  FavoriteStore.has = function (id) {
    return (this.read().items || []).some(function (it) { return String(it.id) === String(id); });
  };
  FavoriteStore.toggle = function (item) {
    if (this.has(item.id)) { this.remove(item.id); return false; }
    this.add(item); return true;
  };

  /* ---- 统一供需 Store（L1：发布→审核→上架→App 可见 主供需体系） ----
     数据结构：{ items: [...] }，状态机：pending_review(待审核)→active(已上架) / rejected(已驳回)；active↔off(已下架)
     迁移：旧 engchain-supply 数组格式（状态 pending/on/off/rejected）→ 对象格式 + 状态统一
     迁移：旧 engchain-publish 孤岛键记录 → SupplyStore（Step 6） */
  /* 先迁移旧数组格式，避免 makeStore 的 Object.assign 把数组展开成数字键 */
  (function migrateSupplyArrayFormat() {
    try {
      var raw = LS.getItem('engchain-supply');
      if (raw === null) return;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        var items = parsed.map(function (x) {
          var st = x.status;
          if (st === 'on') st = 'active';
          else if (st === 'pending') st = 'pending_review';
          return Object.assign({}, x, { status: st });
        });
        LS.setItem('engchain-supply', JSON.stringify({ items: items }));
      }
    } catch (e) {}
  })();

  var SupplyStore = makeStore('engchain-supply', { items: [] }, 'engchain:supply');
  SupplyStore.add = function (item) {
    var s = this.read();
    s.items.unshift(Object.assign({ id: 'SP' + Date.now(), status: 'pending_review', ts: Date.now() }, item));
    this.write(s);
    return s.items[0];
  };
  SupplyStore.approve = function (id) {
    var s = this.read();
    s.items.forEach(function (i) { if (i.id === id) i.status = 'active'; });
    this.write(s);
  };
  SupplyStore.reject = function (id, note) {
    var s = this.read();
    s.items.forEach(function (i) { if (i.id === id) { i.status = 'rejected'; i.rejectNote = note; } });
    this.write(s);
  };
  SupplyStore.listActive = function () {
    return this.read().items.filter(function (i) { return i.status === 'active'; });
  };
  SupplyStore.listPending = function () {
    return this.read().items.filter(function (i) { return i.status === 'pending_review'; });
  };
  SupplyStore.byId = function (id) {
    var items = this.read().items, i;
    for (i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  };
  SupplyStore.remove = function (id) {
    var s = this.read();
    s.items = s.items.filter(function (i) { return i.id !== id; });
    this.write(s);
  };

  /* ---- 投递记录（v3.1：个人向企业岗位投递简历的持久化存储） ---- */
  var ApplyStore = makeStore('engchain-applies', { items: [] }, 'engchain:apply');
  ApplyStore.add = function (record) {
    var s = this.read();
    var id = record.id || ('AP' + Date.now());
    var item = Object.assign({
      id: id, jobId: '', jobTitle: '', company: '', resumeSnapshot: {},
      applyMsg: '', certsSelected: [], expSelected: '', status: 'pending',
      ts: Date.now(), updatedAt: Date.now()
    }, record);
    var existIdx = s.items.findIndex(function (i) { return i.jobId === item.jobId; });
    if (existIdx >= 0) {
      item.id = s.items[existIdx].id;
      item.ts = s.items[existIdx].ts;
      s.items[existIdx] = item;
    } else {
      s.items.unshift(item);
    }
    this.write(s);
    return item;
  };
  ApplyStore.list = function () { return this.read().items; };
  ApplyStore.byJob = function (jobId) {
    return this.read().items.find(function (i) { return i.jobId === jobId; }) || null;
  };
  ApplyStore.hasApplied = function (jobId) {
    return !!this.byJob(jobId);
  };
  ApplyStore.updateStatus = function (id, status) {
    var s = this.read();
    s.items.forEach(function (i) { if (i.id === id) { i.status = status; i.updatedAt = Date.now(); } });
    this.write(s);
  };
  ApplyStore.remove = function (id) {
    var s = this.read();
    s.items = s.items.filter(function (i) { return i.id !== id; });
    this.write(s);
  };

  /* 迁移旧 engchain-publish 孤岛键中的发布记录 → SupplyStore（Step 6，幂等） */
  (function migrateOldPublishRecords() {
    try {
      var old = JSON.parse(LS.getItem('engchain-publish') || 'null');
      if (old && old.records && old.records.length) {
        var s = SupplyStore.read();
        old.records.forEach(function (r) {
          if (!s.items.find(function (x) { return x.id === r.id; })) {
            var amount = r.price ? (r.price + (r.unit ? ' ' + r.unit : '')) : '';
            s.items.push(Object.assign({
              id: r.id, status: r.status === 'active' ? 'active' : (r.status === 'review' ? 'pending_review' : 'rejected'),
              ts: Date.now(), title: r.title || '未命名信息', cat: r.category || '材料',
              dir: r.role || 'demand', company: r.company || '', location: r.location || '',
              amount: amount, publisher: 'u1', source: 'migrated_publish',
              sub: r.subType || '', unit: r.unit || '', qty: r.qty || '', price: r.price || '',
              spec: r.spec || '', delivery: r.delivery || '', qualification: r.qualification || '',
              tags: r.tags || [], desc: r.description || '', contact: r.contact || {}, address: r.address || ''
            }));
          }
        });
        SupplyStore.write(s);
      }
    } catch (e) {}
  })();

  /* ---- 服务广场·询盘线索（v3.2）：用户"免费咨询"留资即生成线索，服务商工作台可见 ----
     字段：id / svcId / svcName / sellerId / buyerId / name / phone / serve(办理事项) / urge(紧急度)
           note / status(new=新线索|contacted=已联系|dealt=已成交|invalid=无效) / createdAt ---- */
  var LeadStore = makeStore('engchain-agency-leads', { items: [] }, 'engchain:lead');
  LeadStore.create = function (input) {
    var s = this.read();
    var lead = Object.assign({
      id: 'LD' + Date.now() + Math.floor(Math.random() * 90 + 10),
      svcId: input.svcId || '', svcName: input.svcName || '中介服务', sellerId: input.sellerId || 'u2',
      buyerId: input.buyerId || '', name: input.name || '', phone: input.phone || '',
      serve: input.serve || '', urge: input.urge || '', note: input.note || '',
      status: 'new', createdAt: Date.now()
    }, input);
    s.items.unshift(lead);
    this.write(s);
    return lead;
  };
  LeadStore.list = function (opt) {
    opt = opt || {};
    var a = this.read().items.slice().sort(function (x, y) { return y.createdAt - x.createdAt; });
    if (opt.sellerId) a = a.filter(function (l) { return l.sellerId === opt.sellerId; });
    if (opt.svcId) a = a.filter(function (l) { return l.svcId === opt.svcId; });
    if (opt.status) a = a.filter(function (l) { return l.status === opt.status; });
    return a;
  };
  LeadStore.byId = function (id) {
    var items = this.read().items, i;
    for (i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  };
  LeadStore.setStatus = function (id, status) {
    var s = this.read();
    var hit = null;
    s.items.forEach(function (l) { if (l.id === id) { l.status = status; l.updatedAt = Date.now(); hit = l; } });
    this.write(s);
    return hit;
  };
  LeadStore.countBySvc = function (svcId) {
    return this.list({ svcId: svcId }).length;
  };
  LeadStore.stats = function (sellerId) {
    var all = this.list({ sellerId: sellerId });
    return {
      total: all.length,
      fresh: all.filter(function (l) { return l.status === 'new'; }).length,
      bySvc: (function () {
        var m = {};
        all.forEach(function (l) { m[l.svcId] = (m[l.svcId] || 0) + 1; });
        return m;
      })()
    };
  };

  /* ---- 服务评价聚合（v3.2）：订单评价回流到服务卡片，形成口碑资产 ---- */
  var SvcRatingStore = makeStore('engchain-svc-ratings', { items: {} }, 'engchain:svc-rating');
  SvcRatingStore.add = function (svcId, score) {
    var s = this.read();
    var r = s.items[svcId] || { count: 0, sum: 0 };
    r.count += 1; r.sum += (Number(score) || 0);
    s.items[svcId] = r;
    this.write(s);
    return r;
  };
  SvcRatingStore.get = function (svcId) {
    var r = this.read().items[svcId];
    if (!r || !r.count) return null;
    return { count: r.count, avg: Math.round((r.sum / r.count) * 10) / 10 };
  };

  /* ---- 服务商信用分（v3.3 WP4）：评价均分 + 履约率，首期只展示不计权 ----
     公式：基础分60 + 评价分(avg/5*20) + 履约率分(履约订单/总订单*20)，上限100
     无订单/无评价时返回默认分80（新服务商起步分） */
  function svcCreditOf(sellerId, svcId) {
    var base = 60, ratingMax = 20, fulfillMax = 20, defaultScore = 80;
    var ratingScore = 0, ratingInfo = null;
    if (svcId) {
      /* 单服务维度：直接查该服务的评价 */
      var r = SvcRatingStore.get(svcId);
      if (r && r.count > 0) { ratingScore = Math.min(ratingMax, (r.avg / 5) * ratingMax); ratingInfo = r; }
    } else if (sellerId) {
      /* 服务商综合维度：遍历该服务商所有订单关联的服务，聚合评价 */
      try {
        if (window.Mediation) {
          var allOrders = Mediation.list({ uid: sellerId, role: 'seller' });
          var svcIds = {};
          allOrders.forEach(function (o) { if (o.svcId) svcIds[o.svcId] = true; });
          var totalCount = 0, totalSum = 0;
          Object.keys(svcIds).forEach(function (sid) {
            var sr = SvcRatingStore.get(sid);
            if (sr && sr.count > 0) { totalCount += sr.count; totalSum += sr.sum; }
          });
          if (totalCount > 0) {
            var avg = Math.round((totalSum / totalCount) * 10) / 10;
            ratingScore = Math.min(ratingMax, (avg / 5) * ratingMax);
            ratingInfo = { count: totalCount, avg: avg };
          }
        }
      } catch (e) {}
    }
    var fulfillScore = 0, totalOrders = 0, fulfillRate = null;
    try {
      if (window.Mediation && sellerId) {
        var orders = Mediation.list({ uid: sellerId, role: 'seller' });
        totalOrders = orders.length;
        if (totalOrders > 0) {
          var bad = orders.filter(function (o) { return o.state === 'disputed' || o.state === 'refunded' || o.state === 'partial_refund'; }).length;
          fulfillRate = Math.round(((totalOrders - bad) / totalOrders) * 100);
          fulfillScore = Math.min(fulfillMax, ((totalOrders - bad) / totalOrders) * fulfillMax);
        }
      }
    } catch (e) {}
    if (ratingScore === 0 && totalOrders === 0) return { score: defaultScore, rating: null, fulfillRate: null, totalOrders: 0, level: '新入驻' };
    var score = Math.round(Math.min(100, base + ratingScore + fulfillScore));
    var level = score >= 95 ? '金牌' : (score >= 85 ? '银牌' : (score >= 70 ? '铜牌' : '观察'));
    return { score: score, rating: ratingInfo, fulfillRate: fulfillRate, totalOrders: totalOrders, level: level };
  }

  /* ---- 破冰期/成熟期模式（v1.2 §10.4；phase: breakin=破冰期 / normal=成熟期） ---- */
  var ModeStore = makeStore('engchain-mode', { phase: 'breakin' }, 'engchain:mode');
  ModeStore.isBreakIn = function () {
    var b = MOCK.business && MOCK.business.breakin;
    return !!(b && b.enabled && this.read().phase === 'breakin');
  };
  ModeStore.switch = function (phase) { return this.set({ phase: phase === 'normal' ? 'normal' : 'breakin' }); };

  /* ---- v3.0 五身份叠加推导：返回结构化身份对象 ----
     个人线 personal: none=未认证 / verified=个人认证(实名) / professional=个人入驻(资质+简历)
                      / partner=个人合伙人 / full=个人入驻+个人合伙人(叠加)
     企业线 enterprise: none=未认证 / verified=企业认证 / resident=企业入驻
     identities[]: 所有拥有的身份标识数组（realname/pro/partner/enterprise/resident）
     partner: 是否拥有个人合伙人身份（布尔，与企业入驻 partner 类型区分）
     entryTypes: 入驻类型数组（支持并行）
     primary 优先级：企业入驻>企业认证>个人合伙人>个人入驻>个人认证>游客
     这是全局唯一的身份推导函数，所有页面应调用此函数 */
  function deriveIdentity() {
    var a = AuthStore.read();
    var e = EntryStore.read();
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    /* 显式退出登录 → 游客 */
    if (st && st.loggedIn === false) {
      return { personal: 'none', partner: false, enterprise: 'none', identities: [], entryTypes: [], isGuest: true, primary: 'guest',
        personalEntryUserType: 'jobseeker', personalEntryResumeComplete: false };
    }
    /* 个人线推导 */
    var realnameOk = !!(a.realname && a.realname.ok);
    /* personalEntry 优先（v3.0 新结构），回退 personalQual / qual（兼容旧数据） */
    var pe = a.personalEntry || a.personalQual || a.qual || { ok: false, list: [] };
    /* v3.1：个人入驻用户类型与简历完成标记，仅从 personalEntry 读取，旧数据回退默认值 */
    var peUserType = (a.personalEntry && a.personalEntry.userType) ? a.personalEntry.userType : 'jobseeker';
    var peResumeComplete = !!(a.personalEntry && a.personalEntry.resumeComplete);
    var proOk = !!(pe.ok && pe.list && pe.list.length);
    var partnerOk = !!(a.partner && a.partner.ok);
    var personal = 'none';
    if (proOk && partnerOk) personal = 'full';
    else if (partnerOk) personal = 'partner';
    else if (proOk) personal = 'professional';
    else if (realnameOk) personal = 'verified';
    /* identities 数组：列出所有叠加身份 */
    var identities = [];
    if (realnameOk) identities.push('realname');
    if (proOk) identities.push('pro');
    if (partnerOk) identities.push('partner');
    /* 企业线推导 */
    var enterprise = 'none';
    var types = (e.types && e.types.length) ? e.types : (e.type ? [e.type] : []);
    if (types.length && e.active && e.status === 'active') enterprise = 'resident';
    else if (a.enterprise && a.enterprise.ok && a.enterprise.expireAt > Date.now()) enterprise = 'verified';
    if (enterprise === 'verified') identities.push('enterprise');
    if (enterprise === 'resident') identities.push('resident');
    /* 主身份（v3.0 优先级：企业入驻>企业认证>个人合伙人>个人入驻>个人认证>游客） */
    var primary = 'registered';
    if (enterprise === 'resident') primary = 'resident';
    else if (enterprise === 'verified') primary = 'enterprise';
    else if (partnerOk) primary = 'partner';
    else if (proOk) primary = 'pro';
    else if (realnameOk) primary = 'realname';
    return { personal: personal, partner: partnerOk, enterprise: enterprise, identities: identities, entryTypes: types, isGuest: false, primary: primary,
      personalEntryUserType: peUserType, personalEntryResumeComplete: peResumeComplete };
  }

  /* ---- 状态推导：据认证/入驻记录返回当前有效用户状态 id（六级，@deprecated 兼容旧代码） ----
     v2.0：内部调用 deriveIdentity()，返回主身份单值；新代码应直接使用 deriveIdentity() */
  function deriveStatus() {
    return deriveIdentity().primary;
  }

  /* ---- 会员折扣：按入驻类型取积分折扣系数（v2.0 多类型并行取最高折扣） ---- */
  function creditDiscount() {
    /* [FEAT 9.2-1] 年度解锁会员：积分折扣提升至 0.5x（最高优先级） */
    if (window.MemberStore && MemberStore.isActive()) {
      var annualCfg = (MOCK.business.membership && MOCK.business.membership.membershipAnnual) || {};
      return annualCfg.creditDiscount || 0.5;
    }
    var idy = deriveIdentity();
    /* P3-7：个人合伙人享有 0.8x 积分折扣（假设：与建筑企业同档，作为推广者激励；产品决策可调整） */
    if (idy.partner && idy.enterprise !== 'resident') return 0.8;
    if (idy.enterprise !== 'resident') return 1;
    var types = idy.entryTypes;
    if (!types.length) return 1;
    var t = (MOCK.business.membership && MOCK.business.membership.types) || [];
    var best = 1;
    for (var i = 0; i < t.length; i++) {
      if (types.indexOf(t[i].id) >= 0 && t[i].creditDiscount < best) best = t[i].creditDiscount;
    }
    return best;
  }

  /* ---- 佣金阶梯：按金额取费率（P0-5.1）；破冰期首档优惠至 commissionFirstTier ---- */
  function commissionRate(amount) {
    var cm = MOCK.business.commission || { tier: [] };
    var rate = 0.08; var i;
    for (i = 0; i < cm.tier.length; i++) if (amount >= cm.tier[i].min) rate = cm.tier[i].rate;
    var firstMin = (cm.tier[1] && cm.tier[1].min) || 50000;
    if (window.ModeStore && ModeStore.isBreakIn() && MOCK.business.breakin && amount < firstMin) {
      rate = MOCK.business.breakin.commissionFirstTier || rate;
    }
    var total = Math.round(amount * rate);
    /* [FIX BM-027] 修复：原保底仅在 amount>=1000000 时检查（3% 档下 1000000*0.03=30000>10000 永不触发），
       改为所有费率档计算后统一校验保底 minCommission。 */
    if (amount > 0 && total < cm.minCommission) total = cm.minCommission;
    return { rate: rate, fee: total };
  }

  /* ---- 入口门控源：身份+入驻类型 → 专有入口显隐/档位（单一来源，v3.0 五身份叠加） ----
     规则：分销中心 = 企业入驻 或 个人合伙人；中介服务 = 中介服务企业（入驻类型含 agency）专有。
     多类型入驻时：分销档位取最高（合伙人>中介>建筑），中介权限只要含 agency 即可。
     个人合伙人：享有二级分销 distTier='full'，但无团队管理权限（hasTeam=false）。
     profile 宫格 / distribution×3 / agency×2 统一引用本函数，杜绝入口显隐与页面门控错配。 */
  function entryAccess() {
    var idy = deriveIdentity();
    var id = idy.primary;
    var types = idy.entryTypes;
    var isResident = (idy.enterprise === 'resident');
    /* 个人合伙人：拥有 partner 身份但非企业入驻（与企业入驻 partner 类型区分） */
    var isIndividualPartner = !!(idy.partner && idy.identities.indexOf('partner') >= 0 && !isResident);
    /* 主入驻类型：取数组第一个（兼容旧单值 type） */
    var type = isResident ? (types.length ? types[0] : 'construction') : '';
    /* 多类型入驻时分销档位取最高：合伙人=完整二级 / 中介=受限一级6% / 建筑=基础一级
       个人合伙人也享有完整二级分销，但无团队管理 */
    var distTier = 'base';
    if (types.indexOf('partner') >= 0) distTier = 'full';
    else if (types.indexOf('agency') >= 0) distTier = 'limited';
    else if (isIndividualPartner) distTier = 'full';
    var dist = isResident || isIndividualPartner;
    return {
      statusId: id,
      identity: idy,
      isResident: isResident,
      isIndividualPartner: isIndividualPartner,
      type: type,
      types: types,
      /* 分销中心：企业入驻 或 个人合伙人可见；档位按入驻类型/身份取最高 */
      dist: dist,
      distTier: distTier,
      distBadge: distTier === 'full' ? (isIndividualPartner ? '个人合伙人' : '专属') : (distTier === 'limited' ? '受限' : '蓝V'),
      /* 中介服务：入驻类型含 agency 即可（多类型并行时也有效） */
      agency: isResident && types.indexOf('agency') >= 0,
      agencyBadge: '金V',
      /* 团队管理：仅企业入驻且类型含 partner 时拥有；个人合伙人无团队管理 */
      hasTeam: isResident && types.indexOf('partner') >= 0
    };
  }


  /* ---- [FEAT 9.2-1] 增值道具 Store（R6 B端增值道具） ----
     键 engchain-upgrades，结构 { items: [{id, type, targetId, startedAt, expireAt, status}] } */
  var UpgradeStore = makeStore('engchain-upgrades', { items: [] }, 'engchain:upgrades');
  UpgradeStore.purchase = function (type, targetId) {
    var cfg = (MOCK.business.commission && MOCK.business.commission.vendorUpgrades && MOCK.business.commission.vendorUpgrades[type]) || null;
    if (!cfg || !cfg.enabled) return { error: '该道具未上架' };
    /* [FEAT 9.2-4] 入驻类型权限检查 */
    var idy = (typeof deriveIdentity === 'function') ? deriveIdentity() : {};
    var isIndividualPartner = !!(idy.partner && idy.enterprise !== 'resident');
    var types = idy.entryTypes || [];
    var allowed = cfg.entryTypes || [];
    var canBuy = false;
    /* 个人合伙人：可购买 topListing 和 saasTools */
    if (isIndividualPartner && (type === 'topListing' || type === 'saasTools')) canBuy = true;
    /* 企业入驻：检查 entryTypes 匹配 */
    if (!canBuy) {
      for (var i = 0; i < types.length; i++) {
        if (allowed.indexOf(types[i]) >= 0) { canBuy = true; break; }
      }
    }
    if (!canBuy) return { error: '您的入驻类型暂不支持购买该道具' };
    /* 扣减费用 */
    var price = cfg.price || 0;
    var consumed = BalanceStore.consume(price, 'upgrade', { remark: '购买' + (cfg.label || type) });
    if (!consumed) return { error: '余额不足，无法购买' };
    /* 创建道具记录 */
    var now = Date.now();
    var duration = (cfg.durationDays || 0) * 86400000;
    var item = {
      id: 'UG' + now + Math.floor(Math.random() * 90 + 10),
      type: type,
      targetId: targetId || '',
      startedAt: now,
      expireAt: duration ? now + duration : 0,
      count: cfg.count || 0,
      status: 'active',
      purchasedAt: now
    };
    var s = this.read();
    s.items.unshift(item);
    this.write(s);
    return item;
  };
  UpgradeStore.isActive = function (type, targetId) {
    var now = Date.now();
    var items = this.read().items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type !== type || it.status !== 'active') continue;
      if (targetId && it.targetId && it.targetId !== targetId) continue;
      if (it.expireAt && it.expireAt <= now) continue;
      return true;
    }
    return false;
  };
  UpgradeStore.listActive = function () {
    var now = Date.now();
    return (this.read().items || []).filter(function (it) {
      if (it.status !== 'active') return false;
      if (it.expireAt && it.expireAt <= now) return false;
      return true;
    });
  };
  UpgradeStore.listAvailable = function () {
    var vus = (MOCK.business.commission && MOCK.business.commission.vendorUpgrades) || {};
    var idy = (typeof deriveIdentity === 'function') ? deriveIdentity() : {};
    var isIndividualPartner = !!(idy.partner && idy.enterprise !== 'resident');
    var types = idy.entryTypes || [];
    var out = [];
    Object.keys(vus).forEach(function (key) {
      var cfg = vus[key];
      if (!cfg || !cfg.enabled) return;
      var allowed = cfg.entryTypes || [];
      var canBuy = false;
      if (isIndividualPartner && (key === 'topListing' || key === 'saasTools')) canBuy = true;
      if (!canBuy) {
        for (var i = 0; i < types.length; i++) {
          if (allowed.indexOf(types[i]) >= 0) { canBuy = true; break; }
        }
      }
      out.push(Object.assign({}, cfg, { key: key, available: canBuy }));
    });
    return out;
  };
  UpgradeStore.countActiveByType = function (type) {
    return this.listActive().filter(function (it) { return it.type === type; }).length;
  };

  /* ---- [FEAT 9.2-3] 供需匹配智能推送 Store ----
     键 engchain-matches，结构 { feed: [...], preferences: {cats, dir, location} } */
  var MatchStore = makeStore('engchain-matches',
    { feed: [], preferences: { cats: [], dir: '', location: '' } }, 'engchain:matches');
  MatchStore.setPreferences = function (prefs) {
    return this.set({ preferences: Object.assign({}, this.read().preferences, prefs || {}) });
  };
  MatchStore.generate = function () {
    var s = this.read();
    var prefs = s.preferences || { cats: [], dir: '', location: '' };
    var list = [];
    try { list = (window.SupplyStore ? SupplyStore.listActive() : []) || []; } catch (e) {}
    var scored = list.map(function (item) {
      var score = 0;
      /* 品类匹配 */
      if (prefs.cats && prefs.cats.length) {
        var cat = item.cat || item.category || '';
        if (prefs.cats.indexOf(cat) >= 0) score += 40;
      }
      /* 方向匹配 */
      if (prefs.dir) {
        var dir = item.dir || item.type || '';
        if (dir === prefs.dir) score += 30;
      }
      /* 地区匹配 */
      if (prefs.location) {
        var loc = item.city || item.location || '';
        if (loc === prefs.location || loc.indexOf(prefs.location) >= 0) score += 30;
      }
      /* 无偏好时给基础分 */
      if (!prefs.cats.length && !prefs.dir && !prefs.location) score = 50;
      return { item: item, score: Math.min(100, score) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var top = scored.slice(0, 10);
    /* 生成 feed（保留已读状态） */
    var existing = {};
    (s.feed || []).forEach(function (f) { existing[f.sourceId] = f; });
    var now = Date.now();
    var newFeed = top.map(function (x, idx) {
      var src = x.item;
      var eid = src.id || ('M' + idx);
      var old = existing[eid];
      return {
        id: eid,
        type: src.dir === 'supply' ? 'supply' : 'demand',
        title: src.title || src.cat || '供需信息',
        desc: src.desc || src.sub || '',
        matchScore: x.score,
        sourceId: src.id,
        cat: src.cat || '',
        location: src.city || src.location || '',
        ts: old ? old.ts : now,
        read: old ? old.read : false
      };
    });
    this.write({ feed: newFeed, preferences: prefs });
    return newFeed;
  };
  MatchStore.markRead = function (id) {
    var s = this.read();
    (s.feed || []).forEach(function (f) { if (f.id === id) f.read = true; });
    this.write(s);
  };
  MatchStore.listUnread = function () {
    return (this.read().feed || []).filter(function (f) { return !f.read; });
  };
  /* ---- [FEAT 9.2-1] 年度解锁会员订阅（P1）：年费 ¥999/年，全部详情免费解锁 + 积分折扣 0.5x ----
     结构：{ active, type, startedAt, expireAt, autoRenew }
     subscribe()：BalanceStore.consume 扣年费；已在有效期内则续费叠加（expireAt 在原到期日上顺延 365 天） */
  var MemberStore = makeStore('engchain-member',
    { active: false, type: 'annual', startedAt: 0, expireAt: 0, autoRenew: false },
    'engchain:member');
  MemberStore.isActive = function () {
    var s = this.read();
    return !!(s.active && s.expireAt > Date.now());
  };
  MemberStore.subscribe = function (type) {
    var cfg = (MOCK.business.membership && MOCK.business.membership.membershipAnnual) || { price: 999, cycle: 'year', label: '年度解锁会员' };
    var price = Math.round((cfg.price || 999) * 100) / 100;
    if (window.BalanceStore) {
      if (BalanceStore.available() < price) return { ok: false, reason: 'insufficient_balance' };
      BalanceStore.consume(price, 'membership', { remark: (cfg.label || '年度解锁会员') + '订阅' });
    }
    var now = Date.now();
    var s = this.read();
    var base = (s.active && s.expireAt > now) ? s.expireAt : now;
    s.active = true; s.type = type || 'annual';
    if (!s.startedAt) s.startedAt = now;
    s.expireAt = base + 365 * 864e5;
    this.write(s);
    return { ok: true, expireAt: s.expireAt };
  };
  MemberStore.renew = function () { return this.subscribe(this.read().type || 'annual'); };

  /* ---- [FEAT 9.2-4] 每日免费浏览摘要额度（P1）：游客3 / 注册未实名5 / 实名及以上10，跨天 0 点重置 ----
     remaining() 惰性跨天重置 used；use(n) 原子扣减并返回是否成功。 */
  var FreeQuotaStore = makeStore('engchain-free-quota', { date: '', used: 0 }, 'engchain:free-quota');
  FreeQuotaStore._today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  FreeQuotaStore._limit = function () {
    var q = (MOCK.business.freeDailyQuota) || { guest: 3, registered: 5, realname: 10 };
    var idy = (typeof deriveIdentity === 'function') ? deriveIdentity() : {};
    if (idy.isGuest) return q.guest || 3;
    var realnameOk = (idy.personal === 'verified' || idy.personal === 'professional' || idy.personal === 'full' ||
                      idy.enterprise === 'verified' || idy.enterprise === 'resident');
    return realnameOk ? (q.realname || 10) : (q.registered || 5);
  };
  FreeQuotaStore.remaining = function () {
    var s = this.read(); var today = this._today();
    if (s.date !== today) { s.date = today; s.used = 0; this.write(s); }
    return Math.max(this._limit() - (s.used || 0), 0);
  };
  FreeQuotaStore.use = function (n) {
    n = n || 1;
    if (this.remaining() < n) return false;
    var s = this.read(); s.used = (s.used || 0) + n; this.write(s);
    return true;
  };

  /* ---- [FEAT 9.2-4] 经营数据看板 Store（P2） ----
     键 engchain-dashboard，结构 { stats, trends, topCategories }
     generate()：从 SupplyStore/LeadStore 等聚合数据生成统计；trend(period) 返回趋势 */
  var DashboardStore = makeStore('engchain-dashboard',
    { stats: { publishCount: 0, viewCount: 0, inquiryCount: 0, orderCount: 0, totalAmount: 0, avgAmount: 0 },
      trends: { daily: [], weekly: [], monthly: [] }, topCategories: [] },
    'engchain:dashboard');
  DashboardStore.generate = function () {
    var s = this.read();
    var publishCount = 0, inquiryCount = 0, orderCount = 0, totalAmount = 0;
    try {
      var supplies = (window.SupplyStore ? SupplyStore.read().items : []) || [];
      publishCount = supplies.filter(function (i) { return i.status === 'active'; }).length;
    } catch (e) {}
    try {
      var leads = (window.LeadStore ? LeadStore.list() : []) || [];
      inquiryCount = leads.length;
    } catch (e) {}
    try {
      var orders = (window.Mediation ? Mediation.list({}) : []) || [];
      orderCount = orders.filter(function (o) { return o.state === 'completed' || o.state === 'settled'; }).length;
      totalAmount = orders.reduce(function (sum, o) { return sum + (Number(o.amount) || 0); }, 0);
    } catch (e) {}
    /* 模拟浏览量与客单价 */
    var viewCount = publishCount * 47 + inquiryCount * 12;
    var avgAmount = orderCount > 0 ? Math.round(totalAmount / orderCount) : 0;
    s.stats = { publishCount: publishCount, viewCount: viewCount, inquiryCount: inquiryCount, orderCount: orderCount, totalAmount: totalAmount, avgAmount: avgAmount };
    /* 生成近30天趋势 Mock 数据 */
    var daily = [];
    var now = Date.now();
    for (var i = 29; i >= 0; i--) {
      var dayTs = now - i * 864e5;
      var seed = (i * 7 + 13) % 100;
      daily.push({
        date: new Date(dayTs).getMonth() + 1 + '/' + new Date(dayTs).getDate(),
        amount: Math.round(5000 + seed * 300 + (29 - i) * 100),
        inquiries: 2 + (seed % 8),
        views: 20 + (seed % 40)
      });
    }
    s.trends.daily = daily;
    /* 近6个月周/月趋势 */
    var weekly = [], monthly = [];
    for (var w = 11; w >= 0; w--) {
      var wSeed = (w * 13 + 7) % 100;
      weekly.push({ label: 'W' + (12 - w), amount: Math.round(20000 + wSeed * 800), inquiries: 10 + (wSeed % 20) });
    }
    for (var m = 5; m >= 0; m--) {
      var mSeed = (m * 17 + 3) % 100;
      monthly.push({ label: (m + 1) + '月', amount: Math.round(80000 + mSeed * 3000), inquiries: 40 + (mSeed % 30) });
    }
    s.trends.weekly = weekly;
    s.trends.monthly = monthly;
    /* 品类分布 */
    var catMap = {};
    supplies.forEach(function (sup) {
      var c = sup.cat || '其他';
      catMap[c] = (catMap[c] || 0) + 1;
    });
    s.topCategories = Object.keys(catMap).map(function (k) { return { name: k, count: catMap[k] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
    this.write(s);
    return s;
  };
  DashboardStore.trend = function (period) {
    var s = this.read();
    return (s.trends && s.trends[period]) || [];
  };

  /* ---- [FEAT 9.2-5] 行业资讯/数据报告订阅 Store（P2） ----
     键 engchain-reports，结构 { subscribed, expireAt, readIds, reports } */
  var ReportStore = makeStore('engchain-reports',
    { subscribed: false, expireAt: 0, readIds: [], reports: [] },
    'engchain:reports');
  ReportStore.subscribe = function (cycle) {
    var cfg = (MOCK.business.industryReport && MOCK.business.industryReport.subscription) || { monthly: 29, yearly: 299 };
    var price = cycle === 'yearly' ? (cfg.yearly || 299) : (cfg.monthly || 29);
    if (window.BalanceStore) {
      if (BalanceStore.available() < price) return { error: '余额不足，请先充值' };
      BalanceStore.consume(price, 'report_subscribe', { remark: '行业报告订阅-' + (cycle === 'yearly' ? '年费' : '月费') });
    }
    var now = Date.now();
    var s = this.read();
    var base = (s.subscribed && s.expireAt > now) ? s.expireAt : now;
    s.subscribed = true;
    s.expireAt = cycle === 'yearly' ? base + 365 * 864e5 : base + 30 * 864e5;
    this.write(s);
    return { ok: true, expireAt: s.expireAt, price: price };
  };
  ReportStore.isSubscribed = function () {
    var s = this.read();
    return !!(s.subscribed && s.expireAt > Date.now());
  };
  ReportStore.list = function (category) {
    var reports = (window.MOCK && MOCK.reports) || [];
    if (category && category !== '全部') reports = reports.filter(function (r) { return r.category === category; });
    return reports;
  };
  ReportStore.read = function (id) {
    var s = this.read();
    if (s.readIds.indexOf(id) < 0) { s.readIds.push(id); this.write(s); }
  };
  ReportStore.isRead = function (id) {
    return (this.read().readIds || []).indexOf(id) >= 0;
  };

  /* ---- [FEAT 9.2-6] R7 B端数据服务/API Store（P3） ----
     键 engchain-api，结构 { balance, calls, subscriptions } */
  var ApiStore = makeStore('engchain-api',
    { balance: 0, calls: [], subscriptions: [] },
    'engchain:api');
  ApiStore.recharge = function (amount) {
    var amt = Math.round(amount * 100) / 100;
    if (amt <= 0) return { error: '充值金额必须大于0' };
    if (window.BalanceStore) {
      if (BalanceStore.available() < amt) return { error: '余额不足，请先充值' };
      BalanceStore.consume(amt, 'api_recharge', { remark: 'API余额充值' });
    }
    var s = this.read();
    s.balance = Math.round((s.balance + amt) * 100) / 100;
    this.write(s);
    return { ok: true, balance: s.balance };
  };
  ApiStore.call = function (productId, params) {
    var products = (MOCK.business.dataApi && MOCK.business.dataApi.products) || [];
    var prod = null;
    for (var i = 0; i < products.length; i++) { if (products[i].id === productId) { prod = products[i]; break; } }
    if (!prod) return { error: 'API产品不存在' };
    var s = this.read();
    if (s.balance < prod.price) return { error: 'API余额不足，请充值' };
    s.balance = Math.round((s.balance - prod.price) * 100) / 100;
    var result = (window.MOCK && MOCK.apiResults && MOCK.apiResults[productId]) ? MOCK.apiResults[productId](params || {}) : { code: 0, message: 'success', data: {} };
    var callRec = {
      id: 'API' + Date.now() + Math.floor(Math.random() * 90 + 10),
      product: productId, productName: prod.name,
      params: params || {}, result: result,
      ts: Date.now(), status: 'success', cost: prod.price
    };
    s.calls.unshift(callRec);
    this.write(s);
    return callRec;
  };
  ApiStore.history = function () {
    return (this.read().calls || []).slice(0, 50);
  };
  ApiStore.products = function () {
    return (MOCK.business.dataApi && MOCK.business.dataApi.products) || [];
  };

  /* ---- [FEAT 9.2-7] 收入结构规划与路线图 Store（P3） ----
     键 engchain-revenue，结构 { streams, monthly, total }
     generate()：从 BalanceStore.logs/CommissionStore 等聚合各收入流数据 */
  var RevenueStore = makeStore('engchain-revenue',
    { streams: { R1_cert: 0, R2_entry: 0, R3_unlock: 0, R4_credits: 0, R5_commission: 0, R6_upgrade: 0, R7_api: 0, other: 0 },
      monthly: [], total: 0 },
    'engchain:revenue');
  RevenueStore.generate = function () {
    var s = this.read();
    var streams = { R1_cert: 0, R2_entry: 0, R3_unlock: 0, R4_credits: 0, R5_commission: 0, R6_upgrade: 0, R7_api: 0, other: 0 };
    /* R1/R2/R6：从 BalanceStore.logs 聚合 */
    try {
      var logs = (window.BalanceStore ? BalanceStore.read().logs : []) || [];
      logs.forEach(function (log) {
        var amt = Math.abs(Number(log.amount) || 0);
        if (log.type === 'certification') streams.R1_cert += amt;
        else if (log.type === 'entry') streams.R2_entry += amt;
        else if (log.type === 'entry_renew') streams.R2_entry += amt;
        else if (log.type === 'membership') streams.R6_upgrade += amt;
        else if (log.type === 'upgrade') streams.R6_upgrade += amt;
        else if (log.type === 'report_subscribe') streams.R6_upgrade += amt;
        else if (log.type === 'api_recharge') streams.R7_api += amt;
        else if (log.type === 'consume' || log.type === 'recharge') { /* skip */ }
      });
    } catch (e) {}
    /* R3/R4：从 CreditStore.logs 聚合（积分兑换金额） */
    try {
      var creditLogs = (window.CreditStore ? CreditStore.read().logs : []) || [];
      creditLogs.forEach(function (log) {
        var amt = Math.abs(Number(log.credits) || 0);
        if (log.type === 'unlock') streams.R3_unlock += Math.round(amt);
        else if (log.type === 'recharge') streams.R4_credits += Math.round(amt);
      });
    } catch (e) {}
    /* R5：从 CommissionStore.flows 聚合 */
    try {
      var flows = (window.CommissionStore ? CommissionStore.read().flows : []) || [];
      flows.forEach(function (fl) {
        streams.R5_commission += Math.abs(Number(fl.amount) || Number(fl.fee) || 0);
      });
    } catch (e) {}
    /* R7：从 ApiStore.calls 聚合 API 调用费用 */
    try {
      var apiCalls = (window.ApiStore ? ApiStore.read().calls : []) || [];
      apiCalls.forEach(function (c) { streams.R7_api += Math.abs(Number(c.cost) || 0); });
    } catch (e) {}
    /* 生成 Mock 月度趋势（近6个月） */
    var monthly = [];
    var now = new Date();
    for (var m = 5; m >= 0; m--) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var seed = (m * 13 + 7) % 100;
      monthly.push({
        month: (d.getMonth() + 1) + '月',
        total: Math.round(50000 + seed * 2000 + (5 - m) * 8000),
        R1_cert: Math.round(streams.R1_cert / 6 + seed * 200),
        R2_entry: Math.round(streams.R2_entry / 6 + seed * 300),
        R3_unlock: Math.round(streams.R3_unlock / 6 + seed * 150),
        R5_commission: Math.round(streams.R5_commission / 6 + seed * 250)
      });
    }
    s.streams = streams;
    s.monthly = monthly;
    s.total = Object.keys(streams).reduce(function (sum, k) { return sum + streams[k]; }, 0);
    this.write(s);
    return s;
  };
  RevenueStore.byStream = function () {
    var s = this.read();
    var streams = s.streams || {};
    var total = s.total || 1;
    var labels = { R1_cert: 'R1认证费', R2_entry: 'R2入驻费', R3_unlock: 'R3解锁', R4_credits: 'R4积分', R5_commission: 'R5佣金', R6_upgrade: 'R6增值', R7_api: 'R7API', other: '其他' };
    return Object.keys(streams).map(function (k) {
      return { key: k, label: labels[k] || k, amount: streams[k] || 0, pct: Math.round((streams[k] / total) * 1000) / 10 };
    });
  };
  RevenueStore.trend = function () {
    return (this.read().monthly) || [];
  };

  window.AuthStore = AuthStore;
  window.EntryStore = EntryStore;
  window.CreditStore = CreditStore;
  window.CheckinStore = CheckinStore;
  window.BalanceStore = BalanceStore;
  window.AgencyOrderStore = AgencyOrderStore;
  window.InvoiceStore = InvoiceStore;
  window.CommissionStore = CommissionStore;
  window.MonitorStore = MonitorStore;
  window.FavoriteStore = FavoriteStore;
  window.SupplyStore = SupplyStore;
  window.ApplyStore = ApplyStore;
  window.LeadStore = LeadStore;
  window.SvcRatingStore = SvcRatingStore;
  window.ModeStore = ModeStore;
  window.MemberStore = MemberStore;
  window.FreeQuotaStore = FreeQuotaStore;
  window.UpgradeStore = UpgradeStore;
  window.MatchStore = MatchStore;
  window.DashboardStore = DashboardStore;
  window.ReportStore = ReportStore;
  window.ApiStore = ApiStore;
  window.RevenueStore = RevenueStore;
  /* 派生规则暴露给后台复用（规则同源：后台佣金试算/身份派生与 App 同一函数） */
  window.commissionRate = commissionRate;
  window.deriveStatus = deriveStatus;
  window.deriveIdentity = deriveIdentity;
  window.creditDiscount = creditDiscount;
  window.entryAccess = entryAccess;
  window.svcCreditOf = svcCreditOf;
})();
