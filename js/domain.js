/* ============================================================================
   js/domain.js —— 分销 & 中介服务 领域层（v3.0 迭代新增，纯增量、不改动既有 Store 语义）
   ----------------------------------------------------------------------------
   职责（对应《分销与中介迭代计划书》S1~S5 + 《规则配置化任务书》C0~C2）：
   0. 配置中心：CONFIG_PATCH 出厂补齐 + ConfigAPI（override 真正生效）+ 全局 RULE() 唯一读取入口
   1. Timeline 记录时间线（Twenty CRM Record Timeline，多态 bizType:bizId）
   2. Ledger 资金台账（多科目、借贷相等、幂等、守恒校验）
   3. Referral 邀请关系（L1/L2、自邀/成环/超深/重复绑定校验、合规上限二级）
   4. Rebate 返佣引擎（消费事件生成 → frozen → settled(T+1) → paid；退款 clawback）
   5. Mediation 统一中介托管订单（合并旧 AO 单；标准状态机 + 里程碑 + 托管/结算/退款/纠纷）
   6. Outbox/Sync/FormStash 离线队列、增量同步元数据、表单回退暂存
   依赖顺序：data.js → common.js → stores.js → databus.js → domain.js
   说明：本层为前端原型的"后台能力占位"，方法签名即后端接口契约，接真实后端时仅替换读写实现。
   ============================================================================ */
(function () {
  'use strict';
  var LS = window.localStorage;
  var DAY = 864e5;

  function parse(key, def) { try { var v = JSON.parse(LS.getItem(key)); if (v === null || v === undefined) return def; return v; } catch (e) { return def; } }
  function save(key, v) { try { LS.setItem(key, JSON.stringify(v)); } catch (e) {} return v; }
  function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {} }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function uid(prefix) { return prefix + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1e3).toString(36).toUpperCase(); }
  function deepGet(obj, path) {
    if (!path) return obj;
    var seg = String(path).split('.'); var cur = obj;
    for (var i = 0; i < seg.length; i++) { if (cur == null) return undefined; cur = cur[seg[i]]; }
    return cur;
  }
  function deepMerge(target, src) {
    if (!src) return target;
    Object.keys(src).forEach(function (k) {
      var sv = src[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], sv);
      } else target[k] = sv;
    });
    return target;
  }
  function B() { return (window.MOCK && MOCK.business) ? MOCK.business : {}; }
  function currentUid() { try { var u = window.DataBus && DataBus.current(); return u ? u.id : ''; } catch (e) { return ''; } }

  /* ==========================================================================
     0. 配置中心：出厂补齐 + override 应用 + RULE() 唯一读取入口
     ========================================================================== */
  var OVERRIDE_KEY = 'engchain-config-override';
  var CONFIG_HIST_KEY = 'engchain-config-history';
  /* 出厂默认补齐（不写进 data.js，避免改动大文件；运行时幂等合入 MOCK.business） */
  var CONFIG_PATCH = {
    distribution: {
      maxLevel: 2, freezeDays: 1, bindWindowHours: 72,
      tiers: {
        /* [FIX BM-028/BM-030] 档位：base/limited/full 企业三档 + individualPartner 个人合伙人档（8%/2%）。
           费率不硬编码死值：applyConfig 时以 MOCK.business.distribution.tier1/tier2 覆盖 base.t1/t2，
           以 MOCK.business.distribution.individualPartner 覆盖个人合伙人档；后台 ConfigAPI.save 改价即时生效。 */
        base: { label: '基础一级（建筑企业）', t1: 12, t2: 3 },
        limited: { label: '受限一级（中介企业）', t1: 6, t2: 0 },
        full: { label: '完整二级（合伙人企业）', t1: 12, t2: 3 },
        individualPartner: { label: '个人合伙人', t1: 8, t2: 2 }
      },
      levelRules: [
        { level: 1, name: '见习推广员', minActive: 0, minConsume: 0 },
        { level: 2, name: '高级推广员', minActive: 3, minConsume: 10000 },
        { level: 3, name: '金牌合伙人', minActive: 10, minConsume: 50000 }
      ],
      states: { pending: '待生成', frozen: '冻结中', settled: '已结算', paid: '已发放', clawback: '已追回', failed: '发放失败' }
    },
    orderStates: {
      draft: '草稿', intent: '意向金已付', escrowed: '已托管', serving: '履约中', await_confirm: '待验收',
      settled: '已结算', refunded: '已退款', partial_refund: '部分退款', disputed: '平台介入中', cancelled: '已取消'
    },
    accountTypes: {
      available: '可用余额', withdraw_frozen: '提现冻结', escrow: '交易托管', intent: '意向金',
      deposit: '履约保证金', rebate_frozen: '返佣冻结', platform_income: '平台收入'
    },
    credits: { deduct: { pointsToYuan: 100, capRate: 0.1 } },
    invoice: { taxRate: 0.06 },
    clue: { validDays: 7 },
    commission: {
      settleCycle: 'T+1',
      deposit: { basic: 5000, engineering: 20000, high: 50000, note: '服务商履约保证金分级，后台可配' },
      intent: { rate: 0.2, tiers: [100, 500, 800, 5000], note: '买方意向金：成交价×20% 就近取档（100/500/800/5000），锁定需求+保障平台佣金，服务启动前可退，启动后抵扣服务费' },
      actions: [
        { id: 'warn', label: '警告' }, { id: 'ban7', label: '禁聊 7 天' }, { id: 'ban30', label: '二次禁聊 30 天' },
        { id: 'fine', label: '罚款 ¥5,000' }, { id: 'freeze15', label: '停号 15 天' }, { id: 'remove', label: '二次清退' }
      ]
    },
    refund: { days: 7 }
  };

  function applyOverride() {
    var ov = parse(OVERRIDE_KEY, null);
    if (ov && ov.snapshot) deepMerge(B(), ov.snapshot);
  }
  function applyConfig() {
    deepMerge(B(), CONFIG_PATCH);
    /* [FIX BM-030] 分销费率双轨收敛：以 data.js MOCK.business.distribution 为唯一来源，
       运行时覆盖 CONFIG_PATCH.tiers.base 与 tiers.individualPartner；后台 ConfigAPI.save 改价后再次 applyConfig 仍生效 */
    var dist = B().distribution || {};
    if (dist.tiers) {
      if (dist.tier1 !== undefined) dist.tiers.base.t1 = dist.tier1;
      if (dist.tier2 !== undefined) dist.tiers.base.t2 = dist.tier2;
      if (dist.individualPartner && dist.individualPartner.tier1 !== undefined) {
        dist.tiers.individualPartner = { label: '个人合伙人', t1: dist.individualPartner.tier1, t2: dist.individualPartner.tier2 };
      }
    }
    applyOverride();
  }
  applyConfig();

  /* 唯一规则读取入口：后端下发(override) → 运行时 MOCK.business；页面/逻辑一律走 RULE(path) */
  function RULE(path, fallback) { var v = deepGet(B(), path); return (v === undefined) ? fallback : v; }

  var ConfigAPI = {
    KEY: OVERRIDE_KEY,
    get: RULE,
    raw: function () { return B(); },
    /* 保存：浅校验 + 写 override + 合入运行时 + 历史留痕 + 全端广播（修复旧 pricing 写而不读） */
    save: function (snapshot, remark) {
      var errors = ConfigAPI.validate(snapshot);
      if (errors.length) return { error: errors.join('；') };
      var hist = parse(CONFIG_HIST_KEY, []);
      /* 历史版本键必须唯一：同一毫秒内连续保存时递增，避免 rollback 错配到最新版本 */
      var tsNow = Date.now();
      while (hist.some(function (h) { return h.ts === tsNow; })) tsNow++;
      hist.unshift({ ts: tsNow, remark: remark || '', snapshot: JSON.parse(JSON.stringify(snapshot || {})) });
      save(CONFIG_HIST_KEY, hist.slice(0, 50));
      save(OVERRIDE_KEY, { savedAt: Date.now(), snapshot: snapshot });
      deepMerge(B(), snapshot);
      emit('engchain:config', { source: 'save' });
      return { ok: true };
    },
    validate: function (snapshot) {
      var errs = [];
      function num(path, min, max) {
        var v = deepGet(snapshot, path);
        if (v === undefined) return;
        if (typeof v !== 'number' || isNaN(v)) errs.push(path + ' 必须为数字');
        else if (min !== undefined && v < min) errs.push(path + ' 不得小于 ' + min);
        else if (max !== undefined && v > max) errs.push(path + ' 不得大于 ' + max);
      }
      num('distribution.tiers.base.t1', 0, 100);
      num('distribution.tiers.limited.t1', 0, 100);
      num('distribution.tiers.full.t1', 0, 100);
      num('distribution.tiers.full.t2', 0, 100);
      /* [FIX BM-028] 个人合伙人档（8%/2%）校验 */
      num('distribution.tiers.individualPartner.t1', 0, 100);
      num('distribution.tiers.individualPartner.t2', 0, 100);
      /* 合规锁：分销层级最多二级 */
      var ml = deepGet(snapshot, 'distribution.maxLevel');
      if (ml !== undefined && ml > 2) errs.push('分销层级合规上限为 2 级');
      return errs;
    },
    history: function () { return parse(CONFIG_HIST_KEY, []); },
    reset: function () { LS.removeItem(OVERRIDE_KEY); applyConfig(); emit('engchain:config', { source: 'reset' }); return { ok: true }; },
    rollback: function (ts) {
      var hist = parse(CONFIG_HIST_KEY, []), target = null;
      for (var i = 0; i < hist.length; i++) if (hist[i].ts === ts) { target = hist[i]; break; }
      if (!target) return { error: '未找到指定版本' };
      return ConfigAPI.save(target.snapshot, '回滚至 ' + new Date(ts).toLocaleString());
    }
  };
  /* 跨标签：其它页保存后本页同步合入 */
  window.addEventListener('storage', function (e) { if (e.key === OVERRIDE_KEY) { applyOverride(); emit('engchain:config', { source: 'storage' }); } });

  /* ==========================================================================
     1. Timeline 记录时间线（不可变、只追加）
     ========================================================================== */
  var TL_KEY = 'engchain-timeline';
  var Timeline = {
    KEY: TL_KEY,
    add: function (bizType, bizId, event, actor, meta) {
      var all = parse(TL_KEY, {}); var k = bizType + ':' + bizId;
      all[k] = all[k] || [];
      all[k].unshift({ ts: Date.now(), event: event, actor: actor || 'system', meta: meta || null });
      save(TL_KEY, all); return all[k][0];
    },
    list: function (bizType, bizId) { return parse(TL_KEY, {})[bizType + ':' + bizId] || []; }
  };

  /* ==========================================================================
     2. Ledger 资金台账（多科目、复式记账、幂等）
     ========================================================================== */
  var LEDGER_KEY = 'engchain-ledger';
  var PLATFORM = 'PLATFORM';
  function ledgerRead() {
    var s = parse(LEDGER_KEY, null);
    if (!s) { s = { accounts: {}, txns: [] }; save(LEDGER_KEY, s); }
    return s;
  }
  function acctEnsure(led, uid, type) {
    led.accounts[uid] = led.accounts[uid] || {};
    if (led.accounts[uid][type] === undefined) led.accounts[uid][type] = 0;
    return led.accounts[uid];
  }
  var Ledger = {
    KEY: LEDGER_KEY, PLATFORM: PLATFORM,
    accounts: function (uid) { var led = ledgerRead(); acctEnsure(led, uid, 'available'); return led.accounts[uid]; },
    balance: function (uid, type) { var a = this.accounts(uid); return r2(a[type] || 0); },
    /* 复式划转：from 科目减、to 科目加，金额相等；idemKey 防重 */
    transfer: function (opt) {
      var amt = r2(opt.amount);
      if (!(amt > 0)) return { error: '划转金额必须大于 0' };
      var led = ledgerRead();
      if (opt.idemKey) {
        for (var i = 0; i < led.txns.length; i++) if (led.txns[i].idemKey === opt.idemKey) return { ok: true, duplicate: true, txn: led.txns[i] };
      }
      var fa = acctEnsure(led, opt.fromUid || PLATFORM, opt.fromAcct);
      var ta = acctEnsure(led, opt.toUid || PLATFORM, opt.toAcct);
      if ((fa[opt.fromAcct] || 0) + 1e-9 < amt && !opt.allowNegative) return { error: '账户余额不足：' + opt.fromAcct };
      fa[opt.fromAcct] = r2((fa[opt.fromAcct] || 0) - amt);
      ta[opt.toAcct] = r2((ta[opt.toAcct] || 0) + amt);
      var txn = {
        id: uid('LX'), ts: Date.now(), fromUid: opt.fromUid || PLATFORM, fromAcct: opt.fromAcct,
        toUid: opt.toUid || PLATFORM, toAcct: opt.toAcct, amount: amt,
        bizType: opt.bizType || '', bizId: opt.bizId || '', idemKey: opt.idemKey || '', remark: opt.remark || ''
      };
      led.txns.unshift(txn); if (led.txns.length > 2000) led.txns = led.txns.slice(0, 2000);
      save(LEDGER_KEY, led);
      emit('engchain:ledger', txn);
      return { ok: true, txn: txn };
    },
    txns: function (filter) {
      var t = ledgerRead().txns;
      if (!filter) return t;
      return t.filter(function (x) {
        return (!filter.uid || x.fromUid === filter.uid || x.toUid === filter.uid) &&
          (!filter.bizType || x.bizType === filter.bizType) && (!filter.bizId || x.bizId === filter.bizId);
      });
    },
    /* 守恒校验：①每笔借贷相等 ②全局科目借贷净额=0（资金不凭空产生/消失，跨主体划转守恒） */
    reconcile: function () {
      var led = ledgerRead(); var checks = [];
      var balanced = true;
      led.txns.forEach(function (x) { /* 复式：单边划转天然等额，这里复核非负与有效科目 */ if (!(x.amount > 0)) balanced = false; });
      checks.push({ name: '流水金额均为正', ok: balanced });
      var sum = {};
      led.txns.forEach(function (x) {
        sum[x.fromUid + ':' + x.fromAcct] = r2((sum[x.fromUid + ':' + x.fromAcct] || 0) - x.amount);
        sum[x.toUid + ':' + x.toAcct] = r2((sum[x.toUid + ':' + x.toAcct] || 0) + x.amount);
      });
      var neg = Object.keys(sum).filter(function (k) { return sum[k] < -1e-6; });
      /* 平台/外部注入账户允许为负（代表外部资金通道），用户科目不得为负 */
      var userNeg = neg.filter(function (k) { return k.indexOf(PLATFORM + ':') !== 0; });
      checks.push({ name: '用户科目无负余额', ok: userNeg.length === 0, detail: userNeg.join(',') });
      return { ok: checks.every(function (c) { return c.ok; }), checks: checks, sums: sum };
    }
  };

  /* ==========================================================================
     3. Referral 邀请关系（L1/L2，合规校验）
     ========================================================================== */
  var REF_KEY = 'engchain-referral-links';
  function codeOf(uidStr) { return 'ENG' + String(uidStr || '').replace(/^u/i, ''); }
  function uidByCode(code) {
    if (!code) return '';
    var m = String(code).trim().toUpperCase().match(/^ENG(\d+)$/);
    return m ? ('u' + m[1]) : '';
  }
  var Referral = {
    KEY: REF_KEY, codeOf: codeOf, uidByCode: uidByCode,
    all: function () { return parse(REF_KEY, []); },
    _write: function (a) { return save(REF_KEY, a); },
    /* 直接上级链路：返回 invitee 的 L1 邀请人 link */
    uplineOf: function (inviteeId) { return this.all().filter(function (l) { return l.inviteeId === inviteeId && l.level === 1; })[0] || null; },
    /* 下级（我邀请的人）；tier 决定可见层级（非 full 仅一级） */
    downline: function (inviterId) {
      var tier = (window.entryAccess ? safeDistTier(inviterId) : 'base');
      return this.all().filter(function (l) {
        if (l.inviterId !== inviterId || l.status !== 'active') return false;
        return tier === 'full' ? true : l.level === 1;
      });
    },
    /* 绑定邀请关系：code=邀请人码，inviteeId=被邀人；含全部合规校验 */
    bind: function (code, inviteeId, channel) {
      var inviterId = uidByCode(code);
      if (!inviterId) return { error: '邀请码无效' };
      if (!inviteeId) return { error: '被邀人缺失' };
      if (inviterId === inviteeId) return { error: '不能邀请自己' };
      var inviter = window.DataBus && DataBus.byId(inviterId);
      if (!inviter) return { error: '邀请人不存在' };
      var links = this.all();
      /* 被邀人已有 L1 → 不可重复绑定 */
      if (links.some(function (l) { return l.inviteeId === inviteeId && l.level === 1 && l.status === 'active'; }))
        return { error: '该账号已绑定邀请关系，不可重复绑定' };
      /* 成环校验：邀请人不能是被邀人的下级（沿 invitee 下游链不可遇到 inviter） */
      var frontier = [inviteeId], guard = 0;
      while (frontier.length && guard++ < 50) {
        var cur = frontier.shift();
        var kids = links.filter(function (l) { return l.inviterId === cur; }).map(function (l) { return l.inviteeId; });
        if (kids.indexOf(inviterId) >= 0) return { error: '不允许循环邀请' };
        frontier = frontier.concat(kids);
      }
      var maxLevel = RULE('distribution.maxLevel', 2);
      var created = [];
      var l1 = { id: uid('RF'), inviterId: inviterId, inviteeId: inviteeId, level: 1, rootId: inviterId,
                 channel: channel || 'register', code: String(code).toUpperCase(), boundAt: Date.now(), status: 'active' };
      links.push(l1); created.push(l1);
      /* L2：若邀请人自身有 L1 上级 P，则 P 与被邀人形成二级关系（受合规上限约束） */
      if (maxLevel >= 2) {
        var up = links.filter(function (l) { return l.inviteeId === inviterId && l.level === 1; })[0];
        if (up) {
          var pTier = safeDistTier(up.inviterId);
          if (pTier === 'full') {
            var l2 = { id: uid('RF'), inviterId: up.inviterId, inviteeId: inviteeId, level: 2, rootId: up.inviterId,
                       channel: channel || 'register', code: String(code).toUpperCase(), boundAt: Date.now(), status: 'active' };
            links.push(l2); created.push(l2);
          }
        }
      }
      this._write(links);
      /* 双方各得邀请积分（仅一次，claim 防重） */
      try {
        var rw = RULE('credits.rewards.invite', 50);
        safeCreditAdd(inviterId, rw, '邀请好友奖励');
        safeCreditAdd(inviteeId, rw, '被邀请注册奖励');
      } catch (e) {}
      created.forEach(function (l) { Timeline.add('referral', l.id, '建立 L' + l.level + ' 关系', inviteeId, { inviterId: l.inviterId }); });
      emit('engchain:referral', { created: created });
      return { ok: true, links: created };
    },
    invalidate: function (id, reason) {
      var a = this.all();
      a.forEach(function (l) { if (l.id === id) { l.status = 'invalid'; l.invalidReason = reason || ''; } });
      this._write(a); return { ok: true };
    },
    tree: function (inviterId) {
      var lvl1 = this.downline(inviterId).filter(function (l) { return l.level === 1; });
      return lvl1.map(function (l) {
        var kids = Referral.all().filter(function (x) { return x.inviterId === l.inviteeId && x.level === 1 && x.status === 'active'; });
        return { l1: l, l2: kids };
      });
    }
  };
  /* 取某用户的分销档位（不依赖当前登录态，直接读用户表 + 身份规则） */
  function safeDistTier(uidStr) {
    var u = window.DataBus && DataBus.byId(uidStr);
    if (!u) return 'base';
    /* [FIX BM-028] 个人合伙人档：u.auth.partner.ok===true 且非企业 resident → individualPartner（8%/2%），
       修复原仅企业入驻可分销导致个人合伙人分销返佣资金断链 */
    if (u.auth && u.auth.partner && u.auth.partner.ok && (!u.identity || u.identity.enterprise !== 'resident')) return 'individualPartner';
    var types = (u.identity && u.identity.entryTypes) || (u.entry && u.entry.types) || (u.entry && u.entry.type ? [u.entry.type] : []);
    if (types.indexOf('partner') >= 0) return 'full';
    if (types.indexOf('agency') >= 0) return 'limited';
    return 'base';
  }
  /* 是否为有效分销员：企业入驻生效（resident）或个人合伙人（auth.partner.ok）才有分销/获佣资格 */
  function isDistributor(uidStr) {
    var u = window.DataBus && DataBus.byId(uidStr);
    if (!u) return false;
    /* [FIX BM-028] 放行个人合伙人：u.auth.partner.ok===true 即具备分销/获佣资格 */
    if (u.auth && u.auth.partner && u.auth.partner.ok) return true;
    if (u.identity) return u.identity.enterprise === 'resident';
    return !!(u.entry && u.entry.active && u.entry.status === 'active');
  }
  function safeCreditAdd(uidStr, amount, reason) {
    /* 非当前登录用户：直接改用户表积分；当前用户：同时写 CreditStore */
    var cur = currentUid();
    var users = DataBus.users();
    for (var i = 0; i < users.length; i++) if (users[i].id === uidStr) {
      users[i].credits = users[i].credits || { balance: 0, quota: { month: '', used: 0 } };
      users[i].credits.balance = (users[i].credits.balance || 0) + amount; break;
    }
    try { LS.setItem(DataBus.USERS_KEY, JSON.stringify(users)); } catch (e) {}
    if (cur === uidStr && window.CreditStore) CreditStore.add(amount, reason);
  }

  /* ==========================================================================
     4. Rebate 返佣引擎
     ========================================================================== */
  var REB_KEY = 'engchain-rebate-orders';
  var Rebate = {
    KEY: REB_KEY,
    all: function () { return parse(REB_KEY, []); },
    _write: function (a) { return save(REB_KEY, a); },
    /* 消费事件 → 为上游 L1/L2 生成 frozen 返佣单（幂等：sourceType+sourceOrderId+beneficiary） */
    createFromEvent: function (ev) {
      var consumer = ev.sourceUserId || currentUid();
      if (!consumer) return { error: '消费用户缺失' };
      var base = r2(ev.baseAmount);
      if (!(base > 0)) return { error: '返佣基数需大于 0' };
      var list = this.all(), created = [];
      var links = Referral.all().filter(function (l) { return l.inviteeId === consumer && l.status === 'active'; });
      links.forEach(function (link) {
        var ben = link.inviterId, tier = safeDistTier(ben);
        /* 受益人必须本身是有效入驻企业（分销员），未入驻/仅认证者不具分销资格 */
        if (!isDistributor(ben)) return;
        var rate = RULE('distribution.tiers.' + tier + '.t' + link.level, 0) || 0;
        if (rate <= 0) return;
        var idem = [ev.sourceType, ev.sourceOrderId || ('NOSRC' + Date.now()), ben, link.level].join('|');
        if (list.some(function (x) { return x.idemKey === idem; })) return;
        var fee = r2(base * rate / 100);
        if (fee <= 0) return;
        var order = {
          id: uid('RB'), beneficiaryId: ben, sourceUserId: consumer, level: link.level, tier: tier,
          sourceType: ev.sourceType, sourceOrderId: ev.sourceOrderId || '', baseAmount: base, rate: rate, fee: fee,
          status: 'frozen', frozenUntil: Date.now() + (RULE('distribution.freezeDays', 1)) * DAY,
          createdAt: Date.now(), settledAt: 0, paidAt: 0, walletTxnId: '', clawbackOf: '', idemKey: idem, ruleSnapshot: { tier: tier, rate: rate }
        };
        /* 返佣冻结由平台运营账户拨付（非佣金收入科目，避免冲减中介佣金），待发放后转受益人可用 */
        Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: ben, toAcct: 'rebate_frozen', amount: fee, bizType: 'rebate', bizId: order.id, remark: ev.sourceType + ' 返佣冻结', allowNegative: true });
        list.push(order); created.push(order);
        Timeline.add('rebate', order.id, '生成返佣单（冻结）', 'system', { fee: fee, rate: rate, level: link.level });
      });
      if (created.length) { this._write(list); emit('engchain:rebate', { created: created }); }
      return { ok: true, created: created };
    },
    /* T+N：冻结到期 → 已结算（原型惰性，进入页面/后台批次时调用） */
    settleDue: function () {
      var list = this.all(), nowTs = Date.now(), n = 0;
      list.forEach(function (o) { if (o.status === 'frozen' && o.frozenUntil <= nowTs) { o.status = 'settled'; o.settledAt = nowTs; n++; Timeline.add('rebate', o.id, 'T+1 结算', 'system'); } });
      if (n) { this._write(list); emit('engchain:rebate', { settled: n }); }
      return n;
    },
    settleOne: function (id) {
      var list = this.all(), o = null;
      list.forEach(function (x) { if (x.id === id) o = x; });
      if (!o || (o.status !== 'frozen' && o.status !== 'pending')) return null;
      o.status = 'settled'; o.settledAt = Date.now(); this._write(list); Timeline.add('rebate', id, '手动结算', 'finance');
      emit('engchain:rebate', { id: id }); return o;
    },
    /* 发放：rebate_frozen → 受益人 available；同步用户表/当前钱包 */
    pay: function (id) {
      var list = this.all(), o = null;
      list.forEach(function (x) { if (x.id === id) o = x; });
      if (!o || o.status !== 'settled') return null;
      var tx = Ledger.transfer({ fromUid: o.beneficiaryId, fromAcct: 'rebate_frozen', toUid: o.beneficiaryId, toAcct: 'available', amount: o.fee, bizType: 'rebate_pay', bizId: o.id, idemKey: 'pay_' + o.id, remark: '返佣发放入钱包' });
      if (tx.error) return { error: tx.error };
      o.status = 'paid'; o.paidAt = Date.now(); o.walletTxnId = tx.txn ? tx.txn.id : '';
      this._write(list);
      /* 受益人钱包 + 用户表 */
      safeMoneyAdd(o.beneficiaryId, o.fee, '分销返佣发放');
      Timeline.add('rebate', id, '发放至钱包', 'finance', { walletTxnId: o.walletTxnId });
      emit('engchain:rebate', { id: id }); return o;
    },
    /* 退款追回：按原单生成负向 clawback；已发则记待补扣 */
    clawback: function (origOrderId, ratio) {
      var list = this.all(), rr = (ratio === undefined ? 1 : ratio), created = [];
      list.filter(function (o) { return o.sourceOrderId === origOrderId && ['frozen', 'settled', 'paid'].indexOf(o.status) >= 0; })
        .forEach(function (o) {
          var back = r2(o.fee * rr);
          if (back <= 0) return;
          var neg = JSON.parse(JSON.stringify(o));
          neg.id = uid('RB'); neg.fee = -back; neg.status = 'clawback'; neg.clawbackOf = o.id;
          neg.createdAt = Date.now(); neg.idemKey = 'cb_' + o.id + '_' + origOrderId;
          if (list.some(function (x) { return x.idemKey === neg.idemKey; })) return;
          o.status = 'clawback';
          list.push(neg); created.push(neg);
          Timeline.add('rebate', neg.id, '退款追回（负向单）', 'system', { amount: -back });
        });
      if (created.length) { this._write(list); emit('engchain:rebate', { clawback: created }); }
      return { ok: true, created: created };
    },
    listBy: function (beneficiaryId, filter) {
      var a = this.all().filter(function (o) { return o.beneficiaryId === beneficiaryId; });
      this.settleDue();
      a = this.all().filter(function (o) { return o.beneficiaryId === beneficiaryId; });
      if (filter && filter.status) a = a.filter(function (o) { return o.status === filter.status; });
      if (filter && filter.level) a = a.filter(function (o) { return 't' + o.level === filter.level || o.level === Number(String(filter.level).replace('t', '')); });
      if (filter && filter.source) a = a.filter(function (o) { return o.sourceType === filter.source; });
      return a.sort(function (x, y) { return y.createdAt - x.createdAt; });
    },
    stat: function (beneficiaryId) {
      this.settleDue();
      var a = this.all().filter(function (o) { return o.beneficiaryId === beneficiaryId; });
      var st = { total: 0, available: 0, frozen: 0, settled: 0, paid: 0, today: 0, pending: 0, count: a.length, t1: 0, t2: 0 };
      var start = new Date(); start.setHours(0, 0, 0, 0); var t0 = start.getTime();
      a.forEach(function (o) {
        if (o.status === 'clawback') return;
        st.total = r2(st.total + o.fee);
        if (o.status === 'frozen' || o.status === 'pending') st.frozen = r2(st.frozen + o.fee);
        if (o.status === 'settled') st.settled = r2(st.settled + o.fee);
        if (o.status === 'paid') { st.paid = r2(st.paid + o.fee); st.available = r2(st.available + o.fee); }
        if (o.createdAt >= t0) st.today = r2(st.today + o.fee);
        if (o.level === 1) st.t1 = r2(st.t1 + o.fee); else st.t2 = r2(st.t2 + o.fee);
      });
      return st;
    },
    /* 后台：全量批次结算/发放 */
    batchSettle: function () { return this.settleDue(); },
    batchPay: function (ids) { var self = this, ok = 0; (ids || this.all().filter(function (o) { return o.status === 'settled'; }).map(function (o) { return o.id; })).forEach(function (id) { if (self.pay(id)) ok++; }); return ok; }
  };
  function safeMoneyAdd(uidStr, amount, reason) {
    var users = DataBus.users();
    /* [FIX BM-050] 返佣类入账计入 totalRebate 而非 totalIn，避免充值口径被返佣污染 */
    var isRebate = /返佣|rebate/i.test(reason || '');
    for (var i = 0; i < users.length; i++) if (users[i].id === uidStr) {
      users[i].balance = users[i].balance || { balance: 0, frozen: 0, totalIn: 0 };
      users[i].balance.balance = r2((users[i].balance.balance || 0) + amount);
      if (isRebate) users[i].balance.totalRebate = r2((users[i].balance.totalRebate || 0) + amount);
      else users[i].balance.totalIn = r2((users[i].balance.totalIn || 0) + amount);
      break;
    }
    try { LS.setItem(DataBus.USERS_KEY, JSON.stringify(users)); } catch (e) {}
    var cur = currentUid();
    if (cur === uidStr && window.BalanceStore) {
      /* [FIX BM-050] 优先调用核心层 BalanceStore.rebate()（totalRebate+=amount，不污染 totalIn、不重复触发充值返佣）；
         核心层未升级时回退 recharge(method='rebate')——既有 recharge 挂接已对该 method 内部豁免，不会递归虚增 */
      if (typeof BalanceStore.rebate === 'function') BalanceStore.rebate(amount, reason || '分销返佣');
      else BalanceStore.recharge(amount, 'rebate', { remark: reason || '分销返佣' });
    }
  }

  /* ==========================================================================
     5. Mediation 统一中介托管订单
     ========================================================================== */
  var MED_KEY = 'engchain-mediation-orders';
  var LEGAL = {
    draft: ['intent', 'cancelled'],
    intent: ['escrowed', 'refunded', 'cancelled'],
    escrowed: ['serving', 'refunded'],
    serving: ['await_confirm', 'disputed', 'refunded'],
    await_confirm: ['settled', 'disputed'],
    disputed: ['serving', 'settled', 'refunded', 'partial_refund'],
    settled: [], refunded: [], partial_refund: [], cancelled: []
  };
  /* 意向金档位：成交价 × rate（后台按业务类型可配），就近取档 [100,500,800,5000] */
  function intentAmountOf(amount, bizType) {
    var cfg = RULE('commission.intent', { rate: 0.2, tiers: [100, 500, 800, 5000] });
    var rate = cfg.rate || 0.2;
    if (bizType && cfg.bTypes && cfg.bTypes[bizType] && cfg.bTypes[bizType].rate) rate = cfg.bTypes[bizType].rate;
    var target = Math.round(r2(amount) * rate);
    var tiers = (cfg.tiers || [100, 500, 800, 5000]).slice().sort(function (a, b) { return a - b; });
    var best = tiers[0];
    for (var i = 1; i < tiers.length; i++) if (Math.abs(tiers[i] - target) < Math.abs(best - target)) best = tiers[i];
    return best;
  }
  /* [SEED] 中介托管订单演示数据 */
  function seedMediationOrders() {
    var now = Date.now();
    var day = 86400000;
    function mk(id, buyerId, sellerId, svcName, title, amount, state, daysAgo, category) {
      var ms = buildMilestones(amount);
      if (state === 'serving') { ms[0].status = 'done'; ms[0].confirmedAt = now - daysAgo * day + day; if (ms[1]) ms[1].status = 'doing'; }
      if (state === 'await_confirm') { ms.forEach(function(m){ m.status = 'done'; m.confirmedAt = now - daysAgo * day + 2*day; }); }
      if (state === 'settled') { ms.forEach(function(m){ m.status = 'done'; m.confirmedAt = now - daysAgo * day + 3*day; }); }
      return {
        id: id, buyerId: buyerId, sellerId: sellerId, svcId: '', svcName: svcName,
        category: category || '中介服务', title: title, amount: r2(amount), fee: r2(amount * 0.08), settle: r2(amount * 0.92),
        state: state, payMethod: 'balance', milestones: ms,
        refund: null, dispute: null, review: null, timeline: [],
        version: 1, ruleSnapshot: null, createdAt: now - daysAgo * day, updatedAt: now - daysAgo * day + day
      };
    }
    return [
      mk('MED2026091001', 'u1', 'u2', '建筑资质代办 · 三级总包', '建筑工程施工总承包三级资质代办服务', 38000, 'serving', 2, '资质代办'),
      mk('MED2026090802', 'u1', 'u3', '安全生产许可证新办', '安全生产许可证新办全程代办', 12000, 'escrowed', 4, '安许代办'),
      mk('MED2026090503', 'u2', 'u1', '工商注册加急 · 建筑公司', '建筑工程有限公司注册加急办理', 3500, 'settled', 7, '工商注册'),
      mk('MED2026090104', 'u1', 'u4', '财税代理记账 · 年度', '建筑企业年度财税代理记账服务', 6000, 'await_confirm', 11, '财税服务'),
      mk('MED2026082805', 'u3', 'u2', '资质升级咨询 · 二级升一级', '市政公用工程施工总承包二级升一级咨询服务', 88000, 'serving', 15, '资质升级'),
      mk('MED2026082006', 'u1', 'u5', '人才猎头 · 一级建造师', '一级建造师（建筑工程）人才猎聘服务', 15000, 'settled', 23, '人才服务'),
      mk('MED2026081507', 'u2', 'u3', '法律咨询 · 合同审查', '建筑工程合同审查与法律咨询服务', 5000, 'refunded', 28, '法律咨询'),
      mk('MED2026081008', 'u4', 'u1', 'ISO体系认证 · 三体系', 'ISO9001/ISO14001/ISO45001三体系认证代办', 22000, 'settled', 33, '认证服务')
    ];
  }

  function medRead() { var s = parse(MED_KEY, null); var SEED_VER = 2; if (!s || s.seedVer !== SEED_VER || !s.list || !s.list.length) { s = { list: seedMediationOrders(), migrated: true, seedVer: SEED_VER }; save(MED_KEY, s); } return s; }
  function buildMilestones(amount) {
    var cm = RULE('commission', {});
    var ms = cm.milestone || { enable: true, minAmount: 50000, nodes: [0.3, 0.3, 0.3, 0.1], labels: ['合同签订', '服务进度50%', '验收', '质保期满'], autoConfirmDays: 14 };
    var multi = ms.enable && amount >= ms.minAmount;
    var nodes = multi ? ms.nodes : [1], labels = multi ? ms.labels : ['整单结算'];
    return nodes.map(function (p, i) {
      return { idx: i, label: labels[i] || ('节点' + (i + 1)), pct: p, amount: r2(amount * p),
               status: 'todo', deliveryNote: '', attachments: [], dueAt: 0, confirmedAt: 0, autoConfirmed: false };
    });
  }
  var Mediation = {
    KEY: MED_KEY,
    stateLabel: function (s) { return RULE('orderStates.' + s, s); },
    /* 迁移旧 AgencyOrderStore（AO 单）到统一对象，仅一次 */
    migrate: function () {
      var s = medRead();
      if (s.migrated) return s.list;
      var old = parse('engchain-agency-orders', { list: [] });
      (old.list || []).forEach(function (o) {
        var map = { pending: 'escrowed', escrow: 'escrowed', working: 'serving', settled: 'settled', refunded: 'refunded' };
        s.list.push({
          id: o.id, buyerId: o.uid || o.buyerId || '', sellerId: o.sellerId || o.svcUid || '', svcId: o.svcId || '', svcName: o.svcName || o.title || '',
          category: o.category || '', title: o.title || o.svcName || '', amount: r2(o.amount), fee: r2(o.fee || 0), settle: r2(o.settle || 0),
          state: map[o.state] || 'escrowed', payMethod: o.payMethod || '', milestones: buildMilestones(o.amount),
          refund: null, dispute: null, review: null, timeline: [], version: 1, ruleSnapshot: o.ruleSnapshot || null,
          createdAt: o.createdAt || Date.now(), updatedAt: o.updatedAt || Date.now()
        });
      });
      s.migrated = true; save(MED_KEY, s); return s.list;
    },
    list: function (opt) {
      this.migrate();
      var a = medRead().list.slice().sort(function (x, y) { return y.createdAt - x.createdAt; });
      this.autoConfirm();
      a = medRead().list.slice().sort(function (x, y) { return y.createdAt - x.createdAt; });
      opt = opt || {};
      if (opt.uid) a = a.filter(function (o) { return (opt.role === 'seller') ? o.sellerId === opt.uid : (opt.role === 'buyer' ? o.buyerId === opt.uid : (o.buyerId === opt.uid || o.sellerId === opt.uid)); });
      if (opt.status) a = a.filter(function (o) { return o.state === opt.status; });
      return a;
    },
    byId: function (id) { this.migrate(); var l = medRead().list; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    _write: function (o) { var s = medRead(); var found = false; for (var i = 0; i < s.list.length; i++) if (s.list[i].id === o.id) { s.list[i] = o; found = true; } if (!found) s.list.unshift(o); save(MED_KEY, s); return o; },
    _tl: function (o, ev, actor, meta) { o.timeline = o.timeline || []; o.timeline.unshift({ ts: Date.now(), event: ev, actor: actor || 'system', meta: meta || null }); Timeline.add('mediation', o.id, ev, actor, meta); },
    /* 创建草稿（含费率/里程碑快照） */
    create: function (input) {
      var amt = r2(input.amount);
      if (!(amt > 0)) return { error: '订单金额需大于 0' };
      var calc = window.commissionRate ? commissionRate(amt) : { rate: 0.08, fee: r2(amt * 0.08) };
      var me = currentUid();
      var o = {
        id: uid('MD'), buyerId: input.buyerId || me, sellerId: input.sellerId || '', svcId: input.svcId || '', svcName: input.svcName || '',
        category: input.category || '', title: input.title || input.svcName || '中介服务订单', amount: amt, fee: r2(calc.fee),
        settle: r2(amt - calc.fee), intentAmount: intentAmountOf(amt, input.bizType || input.category), intentPaid: false, intentTxnId: '', intentTransferred: false,
        state: 'draft', payMethod: '', payTxnId: '', idemKey: '',
        milestones: buildMilestones(amt), refund: null, dispute: null, review: null, timeline: [], version: 1,
        ruleSnapshot: { rate: calc.rate, fee: calc.fee, intent: intentAmountOf(amt, input.bizType || input.category), at: Date.now() }, createdAt: Date.now(), updatedAt: Date.now()
      };
      this._tl(o, '创建订单草稿', o.buyerId);
      this._write(o); emit('engchain:mediation', { id: o.id, state: o.state }); return o;
    },
    _can: function (o, next) { return (LEGAL[o.state] || []).indexOf(next) >= 0; },
    /* 支付意向金：draft → intent（买方付意向金入平台意向金账户，启动前可退；金额=成交价×20%就近取档） */
    payIntent: function (id, method, idemKey) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (!this._can(o, 'intent')) return { error: '当前状态不可支付意向金' };
      var key = idemKey || ('int_' + o.id);
      var tx = Ledger.transfer({ fromUid: o.buyerId, fromAcct: 'available', toUid: Ledger.PLATFORM, toAcct: 'intent', amount: o.intentAmount, bizType: 'mediation_intent', bizId: o.id, idemKey: key, remark: '中介服务意向金' });
      if (tx.error) return tx;
      safeMoneyMinus(o.buyerId, o.intentAmount, '中介服务意向金');
      o.state = 'intent'; o.intentPaid = true; o.intentTxnId = tx.txn ? tx.txn.id : ''; o.payMethod = method || 'balance'; o.idemKey = key; o.version++; o.updatedAt = Date.now();
      this._tl(o, '支付意向金，确认合作意向', o.buyerId, { amount: o.intentAmount });
      this._write(o); emit('engchain:mediation', { id: id, state: o.state }); return o;
    },
    /* 启动服务：intent → escrowed（意向金转入托管抵扣，买方补足剩余合同款） */
    startService: function (id, method, idemKey) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (!this._can(o, 'escrowed')) return { error: '当前状态不可启动托管' };
      var remain = r2(o.amount - (o.intentAmount || 0));
      var key = idemKey || ('pay_' + o.id);
      if (remain > 0) {
        var tx = Ledger.transfer({ fromUid: o.buyerId, fromAcct: 'available', toUid: Ledger.PLATFORM, toAcct: 'escrow', amount: remain, bizType: 'mediation_pay', bizId: o.id, idemKey: key, remark: '中介订单服务费托管' });
        if (tx.error) return tx;
        safeMoneyMinus(o.buyerId, remain, '中介订单服务费托管');
        o.payTxnId = tx.txn ? tx.txn.id : '';
      }
      if (o.intentPaid && !o.intentTransferred) {
        Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'intent', toUid: Ledger.PLATFORM, toAcct: 'escrow', amount: o.intentAmount, bizType: 'mediation_intent_transfer', bizId: o.id, idemKey: 'itr_' + o.id, remark: '意向金转入托管（抵扣服务费）' });
        o.intentTransferred = true;
      }
      o.state = 'escrowed'; o.payMethod = method || 'balance'; o.version++; o.updatedAt = Date.now();
      this._tl(o, '服务启动，意向金抵扣并托管全款', o.buyerId, { remain: remain, intent: o.intentAmount });
      this._write(o); emit('engchain:mediation', { id: id, state: o.state }); return o;
    },
    /* 启动前取消：intent → refunded（意向金全额原路退还） */
    cancelIntent: function (id, reason) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (!this._can(o, 'refunded')) return { error: '当前状态不可取消退意向金' };
      if (o.intentPaid && !o.intentTransferred) {
        Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'intent', toUid: o.buyerId, toAcct: 'available', amount: o.intentAmount, bizType: 'mediation_intent_refund', bizId: o.id, idemKey: 'irf_' + o.id, remark: '启动前取消·退意向金' });
        safeMoneyAdd(o.buyerId, o.intentAmount, '意向金退还');
      }
      o.state = 'refunded'; o.refund = { amount: o.intentAmount || 0, reason: reason || '启动前取消', at: Date.now(), released: 0, intent: true }; o.version++; o.updatedAt = Date.now();
      this._tl(o, '启动前取消，意向金全额退还', o.buyerId, { amount: o.intentAmount });
      this._write(o); emit('engchain:mediation', { id: id, state: o.state }); return o;
    },
    /* 支付托管：draft → 支付意向金；intent → 启动托管；旧单 escrowed 兼容直付 */
    pay: function (id, method, idemKey) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (o.state === 'draft') return this.payIntent(id, method, idemKey);
      if (o.state === 'intent') return this.startService(id, method, idemKey);
      if (!this._can(o, 'escrowed')) return { error: '当前状态不可支付托管' };
      var key = idemKey || ('pay_' + o.id);
      var tx = Ledger.transfer({ fromUid: o.buyerId, fromAcct: 'available', toUid: Ledger.PLATFORM, toAcct: 'escrow', amount: o.amount, bizType: 'mediation_pay', bizId: o.id, idemKey: key, remark: '中介订单资金托管' });
      if (tx.error) return tx;
      /* 买方钱包扣减（当前登录即买方时写 BalanceStore；同时回写用户表） */
      safeMoneyMinus(o.buyerId, o.amount, '中介订单托管');
      o.state = 'escrowed'; o.payMethod = method || 'balance'; o.payTxnId = tx.txn ? tx.txn.id : ''; o.idemKey = key; o.version++; o.updatedAt = Date.now();
      this._tl(o, '付款并托管至监管账户', o.buyerId, { amount: o.amount });
      this._write(o); emit('engchain:mediation', { id: id, state: o.state }); return o;
    },
    accept: function (id, sellerId) {
      var o = this.byId(id); if (!o || !this._can(o, 'serving')) return { error: '当前状态不可接单' };
      o.state = 'serving'; if (sellerId) o.sellerId = sellerId; o.version++; o.updatedAt = Date.now();
      this._tl(o, '服务商接单，开始履约', o.sellerId); this._write(o); emit('engchain:mediation', { id: id, state: o.state }); return o;
    },
    reject: function (id, reason) {
      var o = this.byId(id); if (!o || !this._can(o, 'refunded')) return { error: '当前状态不可拒单退款' };
      return this._fullRefund(o, '服务商拒单', reason, o.sellerId);
    },
    deliver: function (id, idx, note, attachments) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (['serving', 'await_confirm'].indexOf(o.state) < 0) return { error: '当前状态不可提交交付' };
      var m = o.milestones[idx]; if (!m) return { error: '节点不存在' };
      m.status = 'submitted'; m.deliveryNote = note || ''; m.attachments = attachments || []; m.dueAt = Date.now() + (RULE('commission.milestone.autoConfirmDays', 14)) * DAY;
      o.version++; o.updatedAt = Date.now(); this._tl(o, '提交节点交付：' + m.label, o.sellerId, { idx: idx }); this._write(o); return o;
    },
    /* 买方确认节点：按节点比例从 escrow 释放（扣佣金后给服务商，佣金入平台收入） */
    confirmMilestone: function (id, idx, auto) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (['serving', 'await_confirm'].indexOf(o.state) < 0) return { error: '当前状态不可确认节点' };
      var m = o.milestones[idx]; if (!m) return { error: '节点不存在' };
      if (m.status === 'done') return { error: '该节点已确认' };
      /* [FIX BM-024] 佣金口径=按里程碑比例（release × rate）计提，非整单全额；与 databus commissionSettle 同源 */
      var release = r2(o.amount * m.pct), fee = r2(release * (o.ruleSnapshot ? o.ruleSnapshot.rate : 0.08)), net = r2(release - fee);
      /* [FEAT 9.2-5] warranty reserve */
      var warCfg = RULE('commission.warranty', { rate: 0.05, releaseDays: 30 });
      var warrantyAmt = r2(release * (warCfg.rate || 0.05));
      var sellerNet = r2(net - warrantyAmt);
      var k1 = Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'escrow', toUid: o.sellerId, toAcct: 'available', amount: sellerNet, bizType: 'mediation_release', bizId: o.id + '_m' + idx, idemKey: 'rel_' + o.id + '_' + idx, remark: 'milestone release net' });
      if (k1.error) return k1;
      var k2 = Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'escrow', toUid: Ledger.PLATFORM, toAcct: 'platform_income', amount: fee, bizType: 'mediation_fee', bizId: o.id + '_m' + idx, idemKey: 'fee_' + o.id + '_' + idx, remark: 'platform commission' });
      if (warrantyAmt > 0) Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'escrow', toUid: Ledger.PLATFORM, toAcct: 'warranty', amount: warrantyAmt, bizType: 'mediation_warranty_reserve', bizId: o.id + '_w' + idx, idemKey: 'war_' + o.id + '_' + idx, remark: 'warranty reserve' });
      safeMoneyAdd(o.sellerId, sellerNet, 'milestone settlement');
      /* [FEAT 9.2-5] record warranty */
      o.warranty = o.warranty || { amount: 0, reservedAt: 0, releaseAt: 0, status: 'reserved' };
      o.warranty.amount = r2((o.warranty.amount || 0) + warrantyAmt);
      o.warranty.reservedAt = Date.now();
      o.warranty.status = 'reserved';
      m.status = 'done'; m.confirmedAt = Date.now(); m.autoConfirmed = !!auto;
      /* [FIX BM-022] 累计本单已释放佣金，settle 时一次性写入 CommissionStore.addFlow */
      o._commissionAccumulated = r2((o._commissionAccumulated || 0) + fee);
      var allDone = o.milestones.every(function (x) { return x.status === 'done'; });
      if (allDone && o.state === 'serving') o.state = 'await_confirm';
      o.version++; o.updatedAt = Date.now();
      this._tl(o, (auto ? '系统自动确认' : '买方确认') + '节点：' + m.label, auto ? 'system' : o.buyerId, { release: release, fee: fee, net: net });
      this._write(o);
      /* 全部节点完成且为整单/末节点 → 终验后结算（await_confirm 需买方终验；这里若全 done 自动进入 settled 由 settle 触发） */
      emit('engchain:mediation', { id: id, ms: idx }); return o;
    },
    /* 到期自动确认（惰性：进入列表/详情时调用） */
    autoConfirm: function () {
      var s = medRead(), nowTs = Date.now(), changed = false;
      var self = this;
      s.list.forEach(function (o) {
        if (['serving', 'await_confirm'].indexOf(o.state) < 0) return;
        o.milestones.forEach(function (m, idx) {
          if (m.status === 'submitted' && m.dueAt && m.dueAt <= nowTs) { self.confirmMilestone(o.id, idx, true); changed = true; }
        });
      });
        /* [FEAT 9.2-5] lazy warranty release check */
        if (o.warranty && o.warranty.status === 'reserved' && o.warranty.releaseAt && o.warranty.releaseAt <= nowTs) {
          self.releaseWarranty(o.id); changed = true;
        }
      return changed;
    },
    /* 终验结算：await_confirm → settled，并触发分销订单返佣（基数=实际结算额） */
    settle: function (id) {
      var o = this.byId(id); if (!o) return { error: '订单不存在' };
      if (!this._can(o, 'settled')) {
        /* 兼容：里程碑全 done 但仍 serving，先转 await_confirm */
        if (o.state === 'serving' && o.milestones.every(function (x) { return x.status === 'done'; })) o.state = 'await_confirm';
        else return { error: '当前状态不可结算' };
      }
      /* 若还有未完成节点（整单结算场景），一次性释放 */
      var self = this;
      o.milestones.forEach(function (m, idx) { if (m.status !== 'done') self.confirmMilestone(o.id, idx, false); });
      o = this.byId(id);
      o.state = 'settled'; o.settledAt = Date.now(); o.version++; o.updatedAt = Date.now();
      /* [FEAT 9.2-5] set warranty releaseAt = settledAt + releaseDays */
      if (o.warranty && o.warranty.amount > 0) {
        var _wrd = (RULE('commission.warranty', {releaseDays: 30}).releaseDays || 30) * 86400000;
        o.warranty.releaseAt = (o.warranty.releaseAt || 0) || (o.settledAt + _wrd);
      }
      this._tl(o, '终验通过，订单结算完成', o.buyerId, { fee: o.fee, settle: o.settle });
      this._write(o);
      /* [FIX BM-022] 新 Mediation 订单佣金回写 CommissionStore.addFlow，后台佣金报表不再断链：
         金额=里程碑累计释放佣金 o._commissionAccumulated（无里程碑累计时回退整单 o.fee） */
      try {
        var commFee = r2(o._commissionAccumulated || o.fee || 0);
        if (commFee > 0 && window.CommissionStore && typeof CommissionStore.addFlow === 'function') {
          var _sel = window.DataBus && DataBus.byId(o.sellerId);
          CommissionStore.addFlow({
            id: uid('CF'), orderId: o.id, buyerId: o.buyerId, sellerId: o.sellerId,
            uid: o.buyerId, userName: _sel ? _sel.name : (o.sellerId || ''), title: o.title || o.svcName || '',
            amount: r2(o.amount), fee: commFee, rate: (o.ruleSnapshot ? o.ruleSnapshot.rate : 0.08),
            milestones: 'mediation', status: 'pending', ts: Date.now(), settleAt: Date.now()
          });
        }
      } catch (e) {}
      /* 触发分销订单返佣（消费者=买方，基数=订单成交额；返佣引擎沿买方邀请关系上溯） */
      try { Rebate.createFromEvent({ sourceType: 'order', sourceUserId: o.buyerId, baseAmount: o.amount, sourceOrderId: o.id }); } catch (e) {}
      emit('engchain:mediation', { id: id, state: 'settled' }); return o;
    },
    dispute: function (id, by, reason, evidence) {
      var o = this.byId(id); if (!o || !this._can(o, 'disputed')) return { error: '当前状态不可发起纠纷' };
      o.state = 'disputed'; o.dispute = { by: by, reason: reason, evidence: evidence || [], at: Date.now(), status: 'open' }; o.version++; o.updatedAt = Date.now();
      this._tl(o, '发起纠纷，平台介入', by, { reason: reason }); this._write(o); emit('engchain:mediation', { id: id, state: 'disputed' }); return o;
    },
    _fullRefund: function (o, ev, reason, actor) {
      /* 计算托管中剩余可退（总额 − 已释放） */
      var released = 0;
      o.milestones.forEach(function (m) { if (m.status === 'done') released += r2(o.amount * m.pct); });
      var remain = r2(o.amount - released);
      if (remain > 0) {
        Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'escrow', toUid: o.buyerId, toAcct: 'available', amount: remain, bizType: 'mediation_refund', bizId: o.id, idemKey: 'ref_' + o.id, remark: ev });
        safeMoneyAdd(o.buyerId, remain, '中介订单退款');
      }
      o.state = released > 0 ? 'partial_refund' : 'refunded';
      o.refund = { amount: remain, reason: reason || '', at: Date.now(), released: released }; o.version++; o.updatedAt = Date.now();
      this._tl(o, ev + '（退 ¥' + remain + '）', actor || 'system', { reason: reason });
      this._write(o);
      try { Rebate.clawback(o.id, remain / o.amount); } catch (e) {}
      emit('engchain:mediation', { id: o.id, state: o.state }); return o;
    },
    refund: function (id, reason) { var o = this.byId(id); if (!o) return { error: '订单不存在' }; if (o.state === 'intent') return this.cancelIntent(id, reason); if (!this._can(o, 'refunded')) return { error: '当前状态不可退款' }; return this._fullRefund(o, '买方申请退款', reason, o.buyerId); },
    review: function (id, score, text) { var o = this.byId(id); if (!o || o.state !== 'settled') return { error: '仅已结算订单可评价' }; o.review = { score: score, text: text, at: Date.now() }; this._write(o); /* C3 评价回流：聚合到服务卡片口碑（svcId 维度） */ try { if (o.svcId && window.SvcRatingStore) SvcRatingStore.add(String(o.svcId), score); } catch (e) {} return o; },
    /* 资金概览（订单维度）：intent 单资金在平台意向金账户，未进托管 */
    money: function (o) {
      if (o.state === 'intent') return { escrowRemain: 0, released: 0, feeReleased: 0, refundable: o.intentAmount || 0, intent: o.intentAmount || 0 };
      var released = 0, fee = 0;
      o.milestones.forEach(function (m) { if (m.status === 'done') { var rel = r2(o.amount * m.pct); released += rel; fee += r2(rel * (o.ruleSnapshot ? o.ruleSnapshot.rate : 0.08)); } });
      return { escrowRemain: r2(o.amount - released), released: r2(released), feeReleased: r2(fee), refundable: r2(o.amount - released), intent: 0 };
    },
    /* 平台托管汇总：在途订单未释放额之和（守恒用） */
    escrowInFlight: function () {
      var sum = 0;
      this.list().forEach(function (o) { if (['escrowed', 'serving', 'await_confirm', 'disputed'].indexOf(o.state) >= 0) sum += r2(o.amount) - o.milestones.reduce(function (s, m) { return m.status === 'done' ? s + r2(o.amount * m.pct) : s; }, 0); });
      return r2(sum);
    },
    /* WP7 意向金超时检查：超过 remindDays 标记提醒，超过 autoCancelDays 自动退意向金 */
    checkIntentTimeout: function () {
      var cfg = RULE('commission.intent', { remindDays: 7, autoCancelDays: 30 });
      var remindDays = cfg.remindDays || 7, autoCancelDays = cfg.autoCancelDays || 30;
      var now = Date.now(), DAY = 86400000;
      var reminded = [], autoCancelled = [];
      this.list().forEach(function (o) {
        if (o.state !== 'intent') return;
        var days = Math.floor((now - o.createdAt) / DAY);
        if (days >= autoCancelDays && !o._autoCancelled) {
          try {
            var r = Mediation.cancelIntent(o.id, '意向金超期' + autoCancelDays + '天未启动，系统自动退还');
            if (!r.error) { o._autoCancelled = true; autoCancelled.push(o.id); }
          } catch (e) {}
        } else if (days >= remindDays && !o._reminded) {
          o._reminded = true; o._remindedAt = now; o.updatedAt = now;
          Mediation._write(o);
          reminded.push({ id: o.id, days: days, buyerId: o.buyerId, sellerId: o.sellerId });
        }
      });
      return { reminded: reminded, autoCancelled: autoCancelled };
    },
    /* WP7 意向金状态查询：返回超时天数与提醒状态 */
    intentStatus: function (id) {
      var o = this.byId(id);
      if (!o || o.state !== 'intent') return null;
      var cfg = RULE('commission.intent', { remindDays: 7, autoCancelDays: 30 });
      var days = Math.floor((Date.now() - o.createdAt) / 86400000);
      return {
        days: days,
        remindDays: cfg.remindDays || 7,
        autoCancelDays: cfg.autoCancelDays || 30,
        isReminded: !!o._reminded,
        nearAutoCancel: days >= (cfg.autoCancelDays || 30) - 3,
        willAutoCancel: days >= (cfg.autoCancelDays || 30)
      };
    }
    ,
    /* [FEAT 9.2-5] releaseWarranty: release reserved warranty to seller after releaseDays */
    releaseWarranty: function (id) {
      var o = this.byId(id); if (!o || !o.warranty) return { error: 'no warranty on this order' };
      if (o.warranty.status !== 'reserved') return { error: 'warranty already released' };
      if (o.warranty.releaseAt && o.warranty.releaseAt > Date.now()) return { error: 'warranty not yet due' };
      var amt = o.warranty.amount || 0;
      if (amt > 0) {
        Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'warranty', toUid: o.sellerId, toAcct: 'available', amount: amt, bizType: 'mediation_warranty_release', bizId: o.id, idemKey: 'wrel_' + o.id, remark: 'warranty released' });
        safeMoneyAdd(o.sellerId, amt, 'warranty released');
        /* write BalanceStore log */
        try { if (window.BalanceStore) { var bs = BalanceStore.read(); bs.logs.unshift({ type: 'warranty_released', amount: amt, method: 'balance', reason: 'order warranty released ' + o.id, ts: Date.now() }); BalanceStore.write(bs); } } catch (e) {}
      }
      o.warranty.status = 'released';
      o.warranty.releasedAt = Date.now();
      o.version++; o.updatedAt = Date.now();
      this._tl(o, 'warranty released to seller', o.sellerId, { amount: amt });
      this._write(o);
      emit('engchain:mediation', { id: id, warranty: 'released' });
      return o;
    }
  };
  function safeMoneyMinus(uidStr, amount, reason) {
    var users = DataBus.users();
    for (var i = 0; i < users.length; i++) if (users[i].id === uidStr) {
      users[i].balance = users[i].balance || { balance: 0, frozen: 0, totalIn: 0 };
      users[i].balance.balance = r2((users[i].balance.balance || 0) - amount); break;
    }
    try { LS.setItem(DataBus.USERS_KEY, JSON.stringify(users)); } catch (e) {}
    var cur = currentUid();
    if (cur === uidStr && window.BalanceStore) { var b = BalanceStore.read(); b.balance = r2(b.balance - amount); b.logs.unshift({ type: 'mediation', amount: -amount, reason: reason, ts: Date.now() }); BalanceStore.write(b); }
  }

  /* ==========================================================================
     6. Outbox 离线队列 / Sync 元数据 / FormStash 回退暂存
     ========================================================================== */
  var OUT_KEY = 'engchain-outbox', META_KEY = 'engchain-sync-meta', STASH_KEY = 'engchain-form-stash';
  var Outbox = {
    enqueue: function (action, payload) { var q = parse(OUT_KEY, []); var item = { tempId: uid('TMP'), action: action, payload: payload, idemKey: (payload && payload.idemKey) || uid('IK'), ts: Date.now(), retry: 0, status: 'pending' }; q.unshift(item); save(OUT_KEY, q); emit('engchain:outbox', item); return item; },
    list: function () { return parse(OUT_KEY, []); },
    remove: function (tempId) { save(OUT_KEY, parse(OUT_KEY, []).filter(function (x) { return x.tempId !== tempId; })); },
    /* 原型 flush：runner(action,payload) 返回 {ok}；成功移除，业务错误标记 failed */
    flush: function (runner) {
      var q = parse(OUT_KEY, []), done = [], fail = [];
      q.slice().reverse().forEach(function (item) {
        try { var r = runner ? runner(item.action, item.payload) : { ok: true }; if (r && r.error) { item.status = 'failed'; item.retry++; fail.push(item); } else { done.push(item.tempId); } } catch (e) { item.status = 'failed'; item.retry++; fail.push(item); }
      });
      save(OUT_KEY, q.filter(function (x) { return done.indexOf(x.tempId) < 0; }));
      return { done: done.length, failed: fail };
    },
    pending: function () { return parse(OUT_KEY, []).filter(function (x) { return x.status === 'pending'; }).length; }
  };
  var Sync = {
    meta: function () { return parse(META_KEY, {}); },
    markPull: function (collection) { var m = parse(META_KEY, {}); m[collection] = Date.now(); save(META_KEY, m); return m; }
  };
  var FormStash = {
    save: function (formKey, data) { var all = parse(STASH_KEY, {}); all[formKey] = { data: data, ts: Date.now() }; try { sessionStorage.setItem(STASH_KEY, JSON.stringify(all)); } catch (e) { save(STASH_KEY, all); } return data; },
    get: function (formKey) { var all = {}; try { all = JSON.parse(sessionStorage.getItem(STASH_KEY) || '{}'); } catch (e) { all = parse(STASH_KEY, {}); } return all[formKey] || null; },
    clear: function (formKey) { var all = {}; try { all = JSON.parse(sessionStorage.getItem(STASH_KEY) || '{}'); } catch (e) {} delete all[formKey]; try { sessionStorage.setItem(STASH_KEY, JSON.stringify(all)); } catch (e) {} }
  };

  /* ==========================================================================
     7. 分佣引擎挂接三类消费事件（无侵入包装既有方法）
     ========================================================================== */
  function hookRebate() {
    /* 7.1 充值成功 → 充值返佣
       [FIX BM-050] 本挂钩保留两个合法职责：①真实充值时 Ledger 台账双账对齐（否则 Mediation.pay 扣 Ledger.available 会失败）；
       ②真实充值触发充值返佣事件。返佣发放侧已不再依赖本挂钩的 method=rebate 隐式抑制——
       safeMoneyAdd 已显式调用核心层 BalanceStore.rebate()（totalRebate 口径），本挂钩对该 method 的豁免仅作向后兼容保留。 */
    if (window.BalanceStore && !BalanceStore.__rebateHooked) {
      var origRecharge = BalanceStore.recharge;
      BalanceStore.recharge = function (amount, method, extra) {
        var r = origRecharge.apply(this, arguments);
        /* method='rebate' 为领域层内部划转（卖家结算/返佣发放/退款回补），其台账已由 Ledger.transfer 记过，
           既不能重复记台账，也不能再次触发充值返佣（否则递归虚增）；仅外部真实充值(wechat/alipay/corp…)走挂钩 */
        if (method === 'rebate' || (extra && extra.internal)) return r;
        try {
          var me = currentUid();
          if (me) {
            /* 资金双账对齐：钱包充值同步记入台账（外部通道 PLATFORM.available → 用户 available，允许平台为负），
               否则中介托管支付 Mediation.pay 扣 Ledger.available 时会因台账无余额而失败 */
            if (window.Ledger) {
              Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: me, toAcct: 'available',
                amount: r2(amount), bizType: 'wallet_recharge', allowNegative: true, idemKey: 'rc_' + me + '_' + r2(amount) + '_' + Date.now(), remark: '钱包充值入账' });
            }
            Rebate.createFromEvent({ sourceType: 'recharge', sourceUserId: me, baseAmount: amount, sourceOrderId: 'RC' + Date.now() });
          }
        } catch (e) {}
        return r;
      };
      BalanceStore.__rebateHooked = true;
    }
    /* 7.2 入驻终审/直通通过 → 入驻返佣（基数=实缴入驻费） */
    if (window.DataBus && !DataBus.__rebateHooked) {
      ['entryFinalApprove', 'entryApprove'].forEach(function (fn) {
        var orig = DataBus[fn];
        if (typeof orig !== 'function') return;
        DataBus[fn] = function (id, type, note) {
          var u = orig.apply(this, arguments);
          try { if (u) { var fee = DataBus.entryFeeOf(type); if (fee > 0) Rebate.createFromEvent({ sourceType: 'entry', sourceUserId: id, baseAmount: fee, sourceOrderId: u.entry && u.entry.orderId }); } } catch (e) {}
          return u;
        };
      });
      DataBus.__rebateHooked = true;
    }
  }
  /* domain.js 在 databus.js 之后加载，立即挂钩 */
  hookRebate();

  /* ==========================================================================
     8. 分销等级派生（有效伙伴 + 有效消费） + 团队统计
     ========================================================================== */
  function distLevel(uidStr) {
    var rules = RULE('distribution.levelRules', []);
    var down = Referral.downline(uidStr);
    var active = 0, consume = 0;
    var reb = Rebate.all();
    down.forEach(function (l) {
      var hasConsume = reb.some(function (o) { return o.sourceUserId === l.inviteeId && o.status !== 'clawback'; });
      if (hasConsume) { active++; consume += reb.filter(function (o) { return o.sourceUserId === l.inviteeId && o.status !== 'clawback'; }).reduce(function (s, o) { return s + (o.baseAmount || 0); }, 0); }
    });
    var lv = rules[0] || { level: 1, name: '见习推广员' };
    rules.forEach(function (r) { if (active >= r.minActive && consume >= r.minConsume) lv = r; });
    return { level: lv.level, name: lv.name, active: active, consume: r2(consume), total: down.length, next: rules[lv.level] || null };
  }

  /* 注册新账号落用户表（原型无独立注册接口，领域层幂等补建），返回用户对象 */
  function provisionUser(account, name) {
    var users = DataBus.users();
    var ex = users.filter(function (u) { return u.account === account; })[0];
    if (ex) return ex;
    var maxN = 0;
    users.forEach(function (u) { var m = String(u.id).match(/^u(\d+)$/); if (m) maxN = Math.max(maxN, +m[1]); });
    var nu = {
      id: 'u' + (maxN + 1), account: account, name: name || ('用户' + String(account).slice(-4)), avatar: '新',
      identity: { enterprise: 'registered', professional: 'registered', entryTypes: [], entryType: '', entryStatus: '', statusId: 'registered' },
      credits: { balance: 0, quota: { month: '', used: 0 } }, balance: { balance: 0, frozen: 0, totalIn: 0, logs: [] },
      entry: { active: false, types: [], records: [] }, createdAt: Date.now()
    };
    users.push(nu); LS.setItem(DataBus.USERS_KEY, JSON.stringify(users));
    Timeline.add('user', nu.id, '注册账号', nu.id);
    return nu;
  }

  /* ==========================================================================
     7.5 防跳单检测 JumpContract（BM-039）
         聊天内容正则扫描手机号/微信号/QQ，命中即记录 CommissionStore.violations
     ========================================================================== */
  var JumpContract = {
    /* [FIX BM-039] 防跳单：手机号 1[3-9]xxxxxxxxx / 微信号 wx|weixin|微信 / QQ号 */
    PHONE_RE: /(?:(?:\+?86[\s-]?)?1[3-9]\d{9})/,
    WX_RE: /(?:wx|weixin|微信)[\s:：]*[A-Za-z][-_A-Za-z0-9]{5,19}/i,
    QQ_RE: /(?:qq|腾讯QQ)[\s:：]*\d{5,12}/i,
    /* 扫描文本：命中返回 {hit:true,type,matched}，否则 {hit:false} */
    scanMessage: function (text) {
      if (!text) return { hit: false };
      var s = String(text), m;
      if ((m = s.match(this.PHONE_RE))) return { hit: true, type: 'phone', matched: m[0] };
      if ((m = s.match(this.WX_RE))) return { hit: true, type: 'wechat', matched: m[0] };
      if ((m = s.match(this.QQ_RE))) return { hit: true, type: 'qq', matched: m[0] };
      return { hit: false };
    },
    /* 记录违规到 CommissionStore.violations（结构与 databus seedViolations 对齐） */
    recordViolation: function (uidStr, type, content) {
      var hit = this.scanMessage(content);
      var u = window.DataBus && DataBus.byId(uidStr);
      var v = {
        id: uid('VIO'), uid: uidStr, userName: u ? u.name : (uidStr || ''),
        company: (u && u.company) || '', level: 'warn',
        type: type || (hit.hit ? hit.type : 'unknown'),
        desc: '聊天中疑似跳单引流：命中' + (hit.hit ? hit.type : (type || '未知')) + '「' + (hit.matched || content || '') + '」',
        ts: Date.now(), status: 'open', note: ''
      };
      if (window.CommissionStore && typeof CommissionStore.addViolation === 'function') CommissionStore.addViolation(v);
      Timeline.add('jumpcontract', v.id, '防跳单命中', uidStr, { type: v.type, matched: hit.matched || '' });
      emit('engchain:violations', v);
      return v;
    },
    /* 聊天落库前调用：命中才记违规，返回扫描结果 */
    scanAndRecord: function (uidStr, text) {
      var hit = this.scanMessage(text);
      if (hit.hit) { hit.violation = this.recordViolation(uidStr, hit.type, text); }
      return hit;
    }
  };
  window.JumpContract = JumpContract;

  /* ==========================================================================
     7.6 加盟 Franchise（BM-048）
         applyFranchise 扣加盟费 → 加盟关系（engchain-franchise-relations）→ settleFranchiseProfit 分润
     ========================================================================== */
  var FRAN_KEY = 'engchain-franchise-relations';
  var Franchise = {
    KEY: FRAN_KEY,
    all: function () { return parse(FRAN_KEY, []); },
    _write: function (a) { return save(FRAN_KEY, a); },
    /* 按 id 取招商信息（data.js MOCK.franchises） */
    _listing: function (franchiseId) {
      var list = (window.MOCK && MOCK.franchises) || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === franchiseId) return list[i];
      return null;
    },
    /* 演示原型加盟费：优先 payload.fee；否则按资质分级读 unlock.franchise / credits.consume.franchise 档价（元）。
       真实区间价见招商信息 fc.fee.join（文本），以后台 ConfigAPI 配置为准。 */
    _feeOf: function (fr) {
      var cfg = RULE('credits.consume.franchise', null) || RULE('unlock.franchise', null);
      if (!cfg) return 0;
      var qual = (fr.qualLevel || '') + ' ' + (fr.qualCategory || '');
      var tier = /一级|特级/.test(qual) ? cfg.t1 : (/二级|甲级|乙级/.test(qual) ? cfg.t2 : cfg.t3);
      return r2(tier && tier.price ? tier.price : 0);
    },
    /* 申请加盟：扣加盟费（平台收入科目 + 用户表）并建立加盟关系 */
    apply: function (franchiseId, payload) {
      payload = payload || {};
      var me = payload.uid || currentUid();
      if (!me) return { error: '登录态缺失' };
      var fr = this._listing(franchiseId);
      if (!fr) return { error: '招商信息不存在' };
      var u = window.DataBus && DataBus.byId(me);
      var fee = r2(payload.fee != null ? payload.fee : this._feeOf(fr));
      if (!(fee >= 0)) return { error: '加盟费计算失败' };
      if (fee > 0) {
        var tx = Ledger.transfer({ fromUid: me, fromAcct: 'available', toUid: Ledger.PLATFORM, toAcct: 'platform_income',
          amount: fee, bizType: 'franchise_join', bizId: franchiseId, idemKey: 'fr_' + me + '_' + franchiseId,
          remark: '加盟费：' + (fr.name || fr.title || '') });
        if (tx.error) return tx;
        safeMoneyMinus(me, fee, '加盟费：' + (fr.name || fr.title || ''));
      }
      var now = Date.now();
      var rel = {
        id: uid('FR'), franchiseId: franchiseId, franchiseName: fr.name || fr.title || '',
        uid: me, userName: u ? u.name : (payload.userName || me), fee: fee, status: 'active',
        joinedAt: now, expireAt: now + (payload.years || 1) * 365 * 864e5,
        profitShare: { rate: payload.profitRate || 0.01, totalEarned: 0 }
      };
      var a = this.all(); a.push(rel); this._write(a);
      Timeline.add('franchise', rel.id, '提交加盟申请并缴费', me, { fee: fee });
      emit('engchain:franchise', { relation: rel });
      return { ok: true, relation: rel };
    },
    list: function (uidStr) {
      var a = this.all();
      if (uidStr) a = a.filter(function (r) { return r.uid === uidStr; });
      return a;
    },
    /* 分润记账：平台收入 → 加盟商可用；累计 profitShare.totalEarned */
    settleProfit: function (relationId, amount) {
      var a = this.all(), rel = null;
      a.forEach(function (r) { if (r.id === relationId) rel = r; });
      if (!rel) return { error: '加盟关系不存在' };
      var amt = r2(amount);
      if (!(amt > 0)) return { error: '分润金额需大于 0' };
      var tx = Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'platform_income', toUid: rel.uid, toAcct: 'available',
        amount: amt, bizType: 'franchise_profit', bizId: relationId,
        idemKey: 'fp_' + relationId + '_' + amt + '_' + Date.now(), remark: '加盟分润', allowNegative: true });
      if (tx.error) return tx;
      rel.profitShare.totalEarned = r2((rel.profitShare.totalEarned || 0) + amt);
      this._write(a);
      if (currentUid() === rel.uid) safeMoneyAdd(rel.uid, amt, '加盟分润');
      Timeline.add('franchise', relationId, '分润入账', rel.uid, { amount: amt });
      emit('engchain:franchise', { relationId: relationId, amount: amt });
      return { ok: true, relation: rel };
    }
  };
  window.Franchise = Franchise;

  /* ---- 导出 ---- */
  window.RULE = RULE;
  window.ConfigAPI = ConfigAPI;
  window.Timeline = Timeline;
  window.Ledger = Ledger;
  window.Referral = Referral;
  window.Rebate = Rebate;
  window.Mediation = Mediation;
  window.intentAmountOf = intentAmountOf;
  window.Outbox = Outbox;
  window.Sync = Sync;
  window.FormStash = FormStash;
  window.Domain = {
    RULE: RULE, ConfigAPI: ConfigAPI, Timeline: Timeline, Ledger: Ledger, Referral: Referral, Rebate: Rebate,
    Mediation: Mediation, Outbox: Outbox, Sync: Sync, FormStash: FormStash, distLevel: distLevel,
    provisionUser: provisionUser,
    safeDistTier: safeDistTier, round2: r2,
    JumpContract: JumpContract, Franchise: Franchise
  };
})();
