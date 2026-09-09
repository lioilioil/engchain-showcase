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
        shortName: '', nameBasis: '', nameProof: [] },
      personalQual: { ok: false, list: [], certs: [], status: '', note: '', submittedAt: 0 },
      personalEntry: { ok: false, status: '', note: '', submittedAt: 0, list: [], certs: [],
        userType: 'jobseeker', resumeComplete: false, /* v3.1：个人入驻两类用户区分（jobseeker求职/standard标准）+ 简历完成标记 */
        profile: { basic: { gender: '', birth: '', location: '', jobStatus: '', mobile: '' },
          education: [], work: [], project: [], skills: [],
          jobIntent: { position: '', salary: '', location: '', workType: '' },
          intro: '', resumeFile: '' } },
      enterpriseQual: { ok: false, list: [] },
      partner: { ok: false, status: '', note: '', submittedAt: 0, approvedAt: 0,
        channel: [], intent: '', intro: '', experience: '', profitConfig: {} },
      qual: { ok: false, list: [] } },
    'engchain:auth');

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
      qualifications: [], intro: { founded: '', capital: '', staffSize: '', desc: '' },
      cases: [], address: { province: '', city: '', district: '', detail: '' }, website: '', attachments: [] },
    'engchain:entry');
  EntryStore.approve = function () { var s = this.read(); s.status = 'active'; s.active = true; return this.write(s); };
  EntryStore.pending = function () { var s = this.read(); s.status = 'pending'; s.active = false; return this.write(s); };

  /* ---- 解锁积分账户（R3+R4） ---- */
  var CreditStore = makeStore('engchain-credits',
    { balance: 0, logs: [], quota: { month: '', used: 0 } },
    'engchain:credits');
  CreditStore.monthKey = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); };
  CreditStore.add = function (credits, reason, meta) {
    var s = this.read(); s.balance += credits;
    var rec = Object.assign({ type: 'recharge', credits: credits, reason: reason || '充值到账', ts: Date.now(), status: 'success' }, meta || {});
    s.logs.unshift(rec);
    return this.write(s);
  };
  CreditStore.consume = function (cost, reason, meta) {
    var s = this.read(); if (s.balance < cost) return null;
    s.balance -= cost;
    var rec = Object.assign({ type: 'unlock', credits: -cost, reason: reason || '信息解锁', ts: Date.now(), status: 'success' }, meta || {});
    s.logs.unshift(rec);
    return this.write(s);
  };
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
  /* 邀请奖励（v1.3）：被邀注册填写邀请码后发放给邀请方（原型：非本人账号即视为有效） */
  CreditStore.inviteReward = function (code) {
    if (!code) return false;
    var cfg = (MOCK.business.credits && MOCK.business.credits.rewards) || {};
    var amt = cfg.invite || 50;
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    var me = st.account || '';
    if (!code || code === me) return false;
    this.add(amt, '邀请好友奖励');
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

  /* ---- 人民币余额账本（v1.3）：充值/提现/对公审批入账 全部落账 ---- */
  var BalanceStore = makeStore('engchain-balance',
    {
      balance: (MOCK.wallet && typeof MOCK.wallet.balance === 'number') ? MOCK.wallet.balance : 1286.50,
      frozen: (MOCK.wallet && typeof MOCK.wallet.frozen === 'number') ? MOCK.wallet.frozen : 200,
      totalIn: (MOCK.wallet && typeof MOCK.wallet.total === 'number') ? MOCK.wallet.total : 13486.50,
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
  AgencyOrderStore.transition = function (id, next, patch) {
    var s = this.read(); var it = null; var i;
    for (i = 0; i < s.list.length; i++) if (s.list[i].id === id) { it = s.list[i]; break; }
    if (!it) return null;
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

  /* ---- 佣金流水 + 防跳单违规（R5 后台跟踪） ---- */
  var CommissionStore = makeStore('engchain-commission', { flows: [], violations: [] }, 'engchain:commission');
  CommissionStore.addFlow = function (f) { var s = this.read(); s.flows.unshift(f); return this.write(s); };
  CommissionStore.addViolation = function (v) { var s = this.read(); s.violations.unshift(v); return this.write(s); };

  /* ---- 企业关注/监控（P0-7.1） ---- */
  var MonitorStore = makeStore('engchain-monitor', { follows: [], feed: [] }, 'engchain:monitor');
  MonitorStore.follow = function (companyId) {
    var s = this.read(); var i;
    for (i = 0; i < s.follows.length; i++) if (s.follows[i].companyId === companyId) return s;
    s.follows.push({ companyId: companyId, ts: Date.now() });
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
    if (amount >= 1000000 && total < cm.minCommission) total = cm.minCommission;
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
  window.LeadStore = LeadStore;
  window.SvcRatingStore = SvcRatingStore;
  window.ModeStore = ModeStore;
  /* 派生规则暴露给后台复用（规则同源：后台佣金试算/身份派生与 App 同一函数） */
  window.commissionRate = commissionRate;
  window.deriveStatus = deriveStatus;
  window.deriveIdentity = deriveIdentity;
  window.creditDiscount = creditDiscount;
  window.entryAccess = entryAccess;
})();
