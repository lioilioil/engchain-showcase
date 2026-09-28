/* ============================================================================
   工程链 ENGCHAIN — 惊喜时刻引擎 WonderEngine（纯逻辑 · 零 DOM 强依赖）
   ----------------------------------------------------------------------------
   v1.0（2026-09-28）：长时间浏览无有效动作时，主动推送
     "必中但档位随机"的最小单元价值奖励 + 基于画像的下一步行动（NBA）。
   模块：Tracker 行为采集 / Profile 画像 / Gate 触发门禁 / Budget 预算配额
         / Granter 受限随机发奖（幂等）/ Director 总编排
   设计约束详见 docs/惊喜时刻-不确定性价值弹窗-执行方案-20260928.md
   依赖（均为可选，缺失时降级）：
     MOCK.business.wonder      配置（data.js）
     window.CreditStore        积分入账（add/read）
     window.entryAccess / window.deriveIdentity / window.UI.state  身份
   ============================================================================ */
(function (w) {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  var LS_PREFIX = 'engchain-wonder-';
  var DAY = 86400000;

  function cfg() {
    try { return (w.MOCK && MOCK.business && MOCK.business.wonder) || null; } catch (e) { return null; }
  }
  function load(key, def) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      if (!raw) return def;
      var v = JSON.parse(raw);
      return v == null ? def : v;
    } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch (e) {}
  }
  function dayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  /* 密码学随机加权（不用 Math.random，可审计、防控制台刷档） */
  function randInt(n) {
    if (n <= 0) return 0;
    if (w.crypto && crypto.getRandomValues) {
      var a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shortId() {
    var s = 'abcdefghijklmnopqrstuvwxyz0123456789', out = '';
    for (var i = 0; i < 8; i++) out += s.charAt(randInt(s.length));
    return out;
  }
  function root() { return (typeof w.__ROOT__ === 'string' && w.__ROOT__) || ''; }

  var listeners = {};
  function emit(ev, payload) {
    (listeners[ev] || []).forEach(function (fn) { try { fn(payload); } catch (e) {} });
  }

  /* ---------------- 身份读取（只读，不自造身份） ---------------- */
  function identity() {
    /* 调试钩子（仅演示台使用，下划线前缀；生产路径不设置） */
    if (w.WonderEngine && w.WonderEngine._debugIdentity) {
      return Object.assign({ loggedIn: false, segment: 'guest', uid: 'guest', access: null, raw: null }, w.WonderEngine._debugIdentity);
    }
    var idy = null;
    try { if (w.deriveIdentity) idy = deriveIdentity(); } catch (e) {}
    var loggedIn = false;
    try { loggedIn = !!(w.UI && UI.state && UI.state.get().loggedIn); } catch (e) {}
    var a = null;
    try { if (w.entryAccess) a = entryAccess(); } catch (e) {}
    if (a && a.statusId === 'guest') { loggedIn = false; idy = idy || { isGuest: true, enterprise: 'none' }; }

    var uid = 'guest';
    try {
      var cur = (w.DataBus && DataBus.current) ? DataBus.current() : null;
      if (cur && cur.id && loggedIn) uid = String(cur.id);
    } catch (e) {}

    var seg = 'guest';
    if (loggedIn && idy) {
      if (idy.enterprise === 'resident') seg = 'resident';
      else if (['realname', 'pro', 'partner', 'enterprise'].indexOf(idy.primary) >= 0) seg = 'verified';
      else seg = 'unverified';
    } else if (loggedIn) {
      seg = (a && a.isResident) ? 'resident' : (a && a.dist ? 'verified' : 'unverified');
    }
    return { loggedIn: loggedIn, segment: seg, uid: uid, access: a, raw: idy };
  }

  /* 注册时间近似：取注册奖励领取时刻（CreditStore 防重表）；取不到返回 null */
  function registeredAt() {
    try {
      var raw = localStorage.getItem('engchain-credits-rewards');
      var r = raw ? JSON.parse(raw) : null;
      if (r && r.claimed && r.claimed.register && r.claimed.register.ts) return r.claimed.register.ts;
    } catch (e) {}
    return null;
  }

  function creditBalance() {
    try { if (w.CreditStore) return CreditStore.read().balance || 0; } catch (e) {}
    return 0;
  }
  /* 单次解锁最低价（作为"余额枯竭"门槛） */
  function minUnlockPrice() {
    try {
      var c = MOCK.business.credits.consume, vals = [];
      Object.keys(c).forEach(function (k) {
        if (typeof c[k] === 'number') vals.push(c[k]);
        else if (c[k] && typeof c[k] === 'object') {
          Object.keys(c[k]).forEach(function (kk) { if (c[k][kk] && c[k][kk].price) vals.push(c[k][kk].price); });
        }
      });
      if (vals.length) return Math.min.apply(null, vals);
    } catch (e) {}
    return 29;
  }

  /* ======================================================================
     Tracker —— 活跃计时 + 行为信号
     会话态（sessionStorage）：activeMs 累计、软信号、是否已有效动作/已展现
     持久信号（localStorage 14 天）：品类分布、详情数、付费墙、最近有效动作
     ====================================================================== */
  var SIG_KEY = 'signals', SESSION_KEY = 'session';
  var SIG_TTL = 14 * DAY;

  function loadSignals() {
    var s = load(SIG_KEY, null);
    var now = Date.now();
    if (!s || !s.day0 || now - s.day0 > SIG_TTL) {
      s = { day0: now, catTally: {}, detailCount: 0, detailViews: [], paywallCount: 0, lastEffectiveTs: 0, effective30d: [] };
    }
    return s;
  }
  function saveSignals(s) { save(SIG_KEY, s); }

  function sess() {
    var s;
    try { s = JSON.parse(sessionStorage.getItem(LS_PREFIX + SESSION_KEY) || 'null'); } catch (e) { s = null; }
    if (!s) s = { activeMs: 0, lastBeat: Date.now(), lastAct: Date.now(), shown: false, paywall: null, views: {} };
    return s;
  }
  function saveSess(s) {
    try { sessionStorage.setItem(LS_PREFIX + SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }

  var Tracker = {
    timersBound: false,
    scenario: 'home',

    bind: function (scenario) {
      this.scenario = scenario || 'home';
      if (this.timersBound) return;
      this.timersBound = true;
      var self = this, t;
      ['scroll', 'touchstart', 'touchend', 'mousemove', 'click', 'keydown'].forEach(function (ev) {
        w.addEventListener(ev, function () { self.heartbeat(); }, { passive: true });
      });
      document.addEventListener('visibilitychange', function () {
        var s = sess();
        s.hidden = document.hidden;
        s.lastBeat = Date.now();
        saveSess(s);
      });
      /* 解锁成功 = 有效动作（变现） */
      w.addEventListener('engchain-unlock-changed', function (e) {
        self.trackEffective('unlock', (e && e.detail) || {});
      });
      /* 点击付费墙（未支付）= 强意图软信号 */
      document.addEventListener('click', function (e) {
        var t0 = e.target && e.target.closest ? e.target.closest('[data-pw-unlock],[data-wonder-paywall]') : null;
        if (t0) self.trackPaywall();
        var catEl = e.target && e.target.closest ? e.target.closest('[data-cat]') : null;
        if (catEl && catEl.getAttribute('data-cat')) self.trackView(catEl.getAttribute('data-cat'));
      }, true);

      /* 轮询登录态/余额变化 → 有效动作 */
      var lastLogin = identity().loggedIn, lastBal = creditBalance();
      setInterval(function () {
        var idn = identity();
        if (!lastLogin && idn.loggedIn) { self.trackEffective('login', {}); }
        lastLogin = idn.loggedIn;
        var bal = creditBalance();
        if (bal > lastBal) { self.trackEffective('credit', { delta: bal - lastBal }); }
        lastBal = bal;
      }, 4000);

      /* tick：活跃累计 */
      setInterval(function () { self.tick(); }, 4000);
      this.heartbeat();
    },

    heartbeat: function () {
      var s = sess();
      s.lastAct = Date.now();
      if (!s.lastBeat || Date.now() - s.lastBeat > 60000) s.activeMs = 0; /* 跨太久重新计 */
      s.lastBeat = Date.now();
      saveSess(s);
    },

    tick: function () {
      var c = cfg(); if (!c) return;
      var s = sess();
      var now = Date.now();
      if (document.hidden) { s.lastBeat = now; saveSess(s); return; }
      var within = (now - (s.lastAct || 0)) <= (c.activeHeartbeatSec || 30) * 1000;
      if (within && s.lastBeat) {
        var gap = Math.min(now - s.lastBeat, 5000);
        s.activeMs += gap;
      }
      s.lastBeat = now;
      saveSess(s);
    },

    trackView: function (cat) {
      if (!cat) return;
      var sig = loadSignals();
      sig.catTally[cat] = (sig.catTally[cat] || 0) + 1;
      saveSignals(sig);
      var s = sess();
      s.views[cat] = (s.views[cat] || 0) + 1;
      saveSess(s);
      this.heartbeat();
    },

    trackDetail: function (cat, id, href) {
      var sig = loadSignals();
      sig.detailCount++;
      if (cat) sig.catTally[cat] = (sig.catTally[cat] || 0) + 1;
      sig.detailViews.unshift({ id: id || '', cat: cat || '', href: href || (location.pathname + location.search), ts: Date.now() });
      sig.detailViews = sig.detailViews.slice(0, 60);
      saveSignals(sig);
      var s = sess();
      s.lastDetail = { id: id || '', cat: cat || '', href: href || (location.pathname + location.search), ts: Date.now() };
      if (cat) s.views[cat] = (s.views[cat] || 0) + 1;
      saveSess(s);
      this.heartbeat();
    },

    trackPaywall: function (info) {
      var sig = loadSignals();
      sig.paywallCount++;
      saveSignals(sig);
      var s = sess();
      s.paywall = Object.assign({ ts: Date.now(), href: location.pathname + location.search }, info || {}, s.lastDetail || {});
      saveSess(s);
      emit('softsignal', { type: 'paywall' });
    },

    trackEffective: function (type, meta) {
      var sig = loadSignals();
      sig.lastEffectiveTs = Date.now();
      sig.effective30d.unshift({ type: type, ts: Date.now() });
      sig.effective30d = sig.effective30d.slice(0, 50);
      /* 解锁成功则清除本会话付费墙软信号 */
      if (type === 'unlock') {
        var s0 = sess(); s0.paywall = null; saveSess(s0);
      }
      saveSignals(sig);
      /* 有效动作后沉默计时清零重计 */
      var s = sess();
      s.activeMs = 0;
      s.paywall = type === 'unlock' ? null : s.paywall;
      s.lastBeat = Date.now(); s.lastAct = Date.now();
      saveSess(s);
      emit('effective', { type: type, meta: meta || {} });
    },

    /* 达到"沉默触发"所需活跃毫秒（软信号缩短） */
    idleThresholdMs: function () {
      var c = cfg();
      var base = (c.idleTriggerSec || 90) * 1000;
      var s = sess();
      if (s.paywall && (Date.now() - s.paywall.ts) < 30 * 60000) {
        base = Math.round(base * (c.softSignalCooldownRatio != null ? c.softSignalCooldownRatio : 0.5));
      }
      return base;
    },
    isIdleReady: function () {
      return sess().activeMs >= this.idleThresholdMs();
    }
  };

  /* ======================================================================
     Profile —— 画像分群 + NBA
     ====================================================================== */
  var CAT_LABEL = {
    material: '建材', equipment: '设备租赁', labor: '劳务班组', cooperation: '合伙合作',
    franchise: '资质招商', talent: '工程人才', personnel: '企业招聘', agency: '中介服务'
  };
  function topCats(signals, n) {
    return Object.keys(signals.catTally || {}).map(function (k) {
      return { cat: k, count: signals.catTally[k], label: CAT_LABEL[k] || k };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, n || 2);
  }

  function nbaFor(persona, ctx) {
    var r = root();
    switch (persona) {
      case 'near-paywall':
        return {
          ctaText: '用刚到账的积分解锁这条线索',
          ctaHref: ctx.lastDetailHref || (r + 'pages/search/index.html'),
          altText: '先收下，去充值', altHref: r + 'pages/wallet/recharge.html',
          postTitle: '你刚才在看的线索，现在可以直接联系对方'
        };
      case 'guest-intent':
      case 'guest-wanderer':
        return {
          ctaText: '注册领取预留的' + ctx.valueHint + '积分',
          ctaHref: r + 'pages/auth/login.html?from=wonder',
          altText: '先逛逛热门商机', altHref: r + 'pages/search/index.html',
          postTitle: persona === 'guest-intent' ? '你看的这批商机，登录后可持续追踪' : '注册后奖励立即到账，还能解锁供需联系方式'
        };
      case 'unverified-scout':
        return {
          ctaText: '去实名认证，解锁发布与洽谈',
          ctaHref: r + 'pages/profile/auth-prep.html',
          altText: '继续看' + (ctx.topLabel || '新') + '商机', altHref: r + 'pages/search/index.html',
          postTitle: '实名后可发布供需、联系洽谈，平台权益全部解锁'
        };
      case 'balance-low':
        return {
          ctaText: '收下积分，去解锁联系方式',
          ctaHref: ctx.lastDetailHref || (r + 'pages/search/index.html'),
          altText: '每日签到再领积分', altHref: r + 'pages/wallet/credits.html',
          postTitle: '积分已到账，足够再解锁一条线索'
        };
      case 'resident-silent':
        return {
          ctaText: '发布一条供需，让商机来找你',
          ctaHref: r + 'pages/publish/index.html',
          altText: '进入我的工作台', altHref: r + 'pages/publish/records.html',
          postTitle: '最近一周还没有新发布，一条供需可能带来主动询盘'
        };
      default:
        return {
          ctaText: '看看为你挑选的' + (ctx.topLabel || '') + '新商机',
          ctaHref: r + 'pages/search/index.html' + (ctx.topCat ? '?cat=' + ctx.topCat : ''),
          altText: '先收下，随便逛逛', altHref: r + 'home.html',
          postTitle: '根据你最近的浏览，为你留意了几条新线索'
        };
    }
  }

  var Profile = {
    derive: function () {
      var idn = identity();
      var sig = loadSignals();
      var s = sess();
      var tops = topCats(sig, 2);
      var top = tops[0] || null;
      var now = Date.now();
      var paywallLive = s.paywall && (now - s.paywall.ts) < 30 * 60000;
      var detailRecent = sig.detailViews.filter(function (d) { return now - d.ts < 30 * 60000; }).length;
      var daysSinceEffective = sig.lastEffectiveTs ? (now - sig.lastEffectiveTs) / DAY : 999;

      var persona = 'generic';
      if (paywallLive && idn.segment !== 'guest') persona = 'near-paywall';
      else if (idn.segment === 'guest' && (detailRecent >= 3 || sig.paywallCount > 0)) persona = 'guest-intent';
      else if (idn.segment === 'guest') persona = 'guest-wanderer';
      else if (idn.segment === 'unverified') persona = 'unverified-scout';
      else if (creditBalance() < minUnlockPrice() && (detailRecent > 0 || paywallLive)) persona = 'balance-low';
      else if (idn.segment === 'resident' && daysSinceEffective > 7) persona = 'resident-silent';
      else if (idn.loggedIn) persona = 'verified-buyer';

      var lastHref = (s.paywall && s.paywall.href) || (s.lastDetail && s.lastDetail.href) || '';
      var nba = nbaFor(persona, {
        topLabel: top ? top.label : '', topCat: top ? top.cat : '',
        lastDetailHref: lastHref, valueHint: ''
      });

      return {
        persona: persona,
        segment: idn.segment,
        guest: !idn.loggedIn,
        uid: idn.uid,
        topCats: tops,
        nba: nba,
        detailCount: sig.detailCount,
        paywallLive: !!paywallLive,
        daysSinceEffective: Math.round(daysSinceEffective * 10) / 10,
        balance: creditBalance()
      };
    }
  };

  /* ======================================================================
     Frequency —— 用户级频控（会话/日/周/间隔/新人/时间防回拨）
     ====================================================================== */
  var FREQ_KEY = 'freq';
  function freqToday() {
    var f = load(FREQ_KEY, null), dk = dayKey();
    if (!f || f.day !== dk) f = { day: dk, dayCount: 0, dismissDay: '', showQueue: [], lastShowTs: 0, lastClock: Date.now() };
    return f;
  }
  function saveFreq(f) {
    f.showQueue = (f.showQueue || []).filter(function (ts) { return Date.now() - ts < 7 * DAY; });
    f.lastClock = Date.now();
    save(FREQ_KEY, f);
  }

  var Frequency = {
    /* 返回 {ok, reason} */
    check: function () {
      var c = cfg(), idn = identity();
      var f = freqToday();
      var now = Date.now();
      /* 时钟回拨防护 */
      if (f.lastClock && now < f.lastClock - 60000) return { ok: false, reason: 'clock-tamper' };
      /* 单会话 */
      if (sess().shown) return { ok: false, reason: 'session-cap' };
      /* 新人保护（注册奖励 24h 内） */
      var quietMs = (c.newUserQuietHours || 0) * 3600000;
      var regTs = registeredAt();
      if (idn.loggedIn && regTs && now - regTs < quietMs) return { ok: false, reason: 'new-user-quiet' };
      if (f.dayCount >= c.freq.dailyCap) return { ok: false, reason: 'daily-cap' };
      if (f.dismissDay === f.day) return { ok: false, reason: 'dismissed-today' };
      var week = (f.showQueue || []).filter(function (ts) { return now - ts < (c.freq.weeklyWindowDays || 7) * DAY; });
      if (week.length >= c.freq.weeklyCap) return { ok: false, reason: 'weekly-cap' };
      if (f.lastShowTs && now - f.lastShowTs < c.freq.minGapHours * 3600000) return { ok: false, reason: 'min-gap' };
      return { ok: true };
    },
    markShown: function () {
      var f = freqToday(), now = Date.now();
      f.dayCount++;
      f.lastShowTs = now;
      f.showQueue.unshift(now);
      saveFreq(f);
      var s = sess(); s.shown = true; saveSess(s);
    },
    markDismiss: function () {
      var f = freqToday();
      f.dismissDay = f.day;
      saveFreq(f);
    },
    state: function () { var f = freqToday(); return { day: f.day, dayCount: f.dayCount, weekCount: (f.showQueue || []).length, lastShowTs: f.lastShowTs, dismissDay: f.dismissDay }; }
  };

  /* ======================================================================
     Budget —— 全局日预算 + 大奖配额 + 降档/熔断；Grants 流水
     ====================================================================== */
  var BUDGET_KEY = 'budget', GRANTS_KEY = 'grants';
  function budgetState0() {
    var b = load(BUDGET_KEY, null), dk = dayKey();
    if (!b || b.day !== dk) b = { day: dk, spent: 0, jackpotCount: 0, overrun: 0 };
    return b;
  }
  function grantsLog() {
    var g = load(GRANTS_KEY, []);
    var cutoff = Date.now() - 60 * DAY;
    return (Array.isArray(g) ? g : []).filter(function (r) { return r.ts > cutoff; });
  }
  function pushGrant(rec) {
    var g = grantsLog();
    g.unshift(rec);
    save(GRANTS_KEY, g.slice(0, 500));
  }
  function userJackpot30d(uid) {
    var cutoff = Date.now() - 30 * DAY;
    return grantsLog().filter(function (r) { return r.uid === uid && r.tier === 'lucky' && r.ts > cutoff; }).length;
  }
  function grantExists(grantId) {
    return grantsLog().some(function (r) { return r.grantId === grantId && r.committed; });
  }

  var Budget = {
    status: function () {
      var c = cfg(), b = budgetState0();
      var ratio = b.spent / c.budget.dailyCredits;
      if (ratio >= 1) return { state: 'exhausted', ratio: ratio, spent: b.spent };
      if (ratio >= c.budget.warnRatio) return { state: 'warn', ratio: ratio, spent: b.spent };
      return { state: 'normal', ratio: ratio, spent: b.spent };
    },
    jackpotAvailable: function (uid) {
      var c = cfg(), b = budgetState0();
      if (b.jackpotCount >= c.budget.jackpotDailyCap) return false;
      if (uid !== 'guest' && userJackpot30d(uid) >= c.budget.jackpotPerUserCap) return false;
      return true;
    },
    /* 真实入账后提交预算 */
    commit: function (rec) {
      var b = budgetState0();
      b.spent += rec.amount;
      if (rec.tier === 'lucky') b.jackpotCount++;
      if (b.spent > cfg().budget.dailyCredits) b.overrun += rec.amount; /* 承诺类入账超支留痕 */
      save(BUDGET_KEY, b);
      pushGrant(rec);
    },
    raw: function () { return budgetState0(); }
  };

  /* ======================================================================
     Granter —— 受限加权随机 + 幂等入账/游客预挂账
     ====================================================================== */
  var PENDING_KEY = 'pending';

  function eligibleTiers(budgetSt, uid) {
    var c = cfg();
    return c.tiers.filter(function (t) {
      if (t.id === 'lucky') {
        if (budgetSt !== 'normal') return false;             /* 预警/熔断：移除大奖 */
        if (!Budget.jackpotAvailable(uid)) return false;     /* 配额/用户上限 */
      }
      return true;
    });
  }
  function pickTier(tiers) {
    var total = tiers.reduce(function (s, t) { return s + t.weight; }, 0);
    var r = randInt(total), acc = 0;
    for (var i = 0; i < tiers.length; i++) {
      acc += tiers[i].weight;
      if (r < acc) return tiers[i];
    }
    return tiers[tiers.length - 1];
  }
  function pickValue(tier) {
    var vals = tier.values || [0];
    return vals[randInt(vals.length)];
  }

  var Granter = {
    /* 预期单次成本（供运营精算/演示台） */
    expectedCost: function () {
      var c = cfg(), total = c.tiers.reduce(function (s, t) { return s + t.weight; }, 0);
      return c.tiers.reduce(function (s, t) {
        var mean = t.values.reduce(function (a, b) { return a + b; }, 0) / t.values.length;
        return s + mean * (t.weight / total);
      }, 0);
    },

    /* 结算：点击揭晓时调用。decisionId 对应 Director 暂存决策 */
    settle: function (decision) {
      if (!decision || decision.settled) return decision && decision.result ? decision.result : { kind: 'none' };
      var c = cfg(), idn = identity();
      var bst = Budget.status();

      /* 预算硬熔断：退化为纯引导（必中承诺只在有预算时成立） */
      if (bst.state === 'exhausted') {
        decision.settled = true;
        decision.result = { kind: 'none', budgetState: 'exhausted' };
        return decision.result;
      }

      var tiers = eligibleTiers(bst.state, idn.loggedIn ? idn.uid : 'guest');
      /* 游客防刷：预挂账最高中到 star（锦鲤档只发给真实账号） */
      if (!idn.loggedIn) tiers = tiers.filter(function (t) { return t.id !== 'lucky'; });
      if (!tiers.length) tiers = c.tiers.filter(function (t) { return t.id === 'glow'; });
      /* 调试钩子（仅演示台：强制档位） */
      if (w.WonderEngine && w.WonderEngine._debugTier) {
        var forced = c.tiers.filter(function (t) { return t.id === w.WonderEngine._debugTier; });
        if (forced.length) tiers = forced;
      }

      var tier = pickTier(tiers);
      var value = pickValue(tier);
      var grantId = 'w_' + dayKey() + '_' + (idn.loggedIn ? idn.uid : 'g') + '_' + shortId();
      var now = Date.now();
      var expireAt = now + (c.grantTtlDays || 7) * DAY;

      var result;
      if (!idn.loggedIn) {
        /* 游客：预挂账，只保留最新一笔，不入 CreditStore、不占预算 */
        var pending = { grantId: grantId, tier: tier.id, tierLabel: tier.label, amount: value, persona: decision.persona, ts: now, expireAt: expireAt };
        save(PENDING_KEY, pending);
        result = { kind: 'pending', grantId: grantId, tier: tier.id, tierLabel: tier.label, amount: value, expireAt: expireAt };
      } else {
        if (grantExists(grantId)) { decision.settled = true; decision.result = { kind: 'none' }; return decision.result; }
        var ok = false;
        try {
          if (w.CreditStore) {
            CreditStore.add(value, '浏览补给奖励', {
              type: 'wonder_grant', tier: tier.id, grantId: grantId, persona: decision.persona, expireAt: expireAt
            });
            ok = true;
          }
        } catch (e) { ok = false; }
        if (!ok) { decision.settled = true; decision.result = { kind: 'error' }; return decision.result; }
        Budget.commit({ grantId: grantId, uid: idn.uid, tier: tier.id, amount: value, persona: decision.persona, ts: now, committed: true });
        result = { kind: 'credits', grantId: grantId, tier: tier.id, tierLabel: tier.label, amount: value, expireAt: expireAt, balance: creditBalance() };
      }
      decision.settled = true;
      decision.result = result;
      emit('grant', result);
      return result;
    },

    /* 注册后认领游客预挂账（幂等；承诺优先，允许计入当日预算并留痕 overrun） */
    claimPending: function () {
      var idn = identity();
      if (!idn.loggedIn) return { ok: false, reason: 'guest' };
      var p = load(PENDING_KEY, null);
      if (!p) return { ok: false, reason: 'empty' };
      if (Date.now() > p.expireAt) { save(PENDING_KEY, null); return { ok: false, reason: 'expired' }; }
      if (grantExists(p.grantId)) { save(PENDING_KEY, null); return { ok: false, reason: 'duplicate' }; }
      if (!w.CreditStore) return { ok: false, reason: 'no-store' };
      CreditStore.add(p.amount, '浏览补给奖励（注册认领）', {
        type: 'wonder_grant', tier: p.tier, grantId: p.grantId, persona: p.persona, wonderClaim: true, expireAt: p.expireAt
      });
      Budget.commit({ grantId: p.grantId, uid: idn.uid, tier: p.tier, amount: p.amount, persona: p.persona, ts: Date.now(), committed: true, claimed: true });
      save(PENDING_KEY, null);
      var res = { ok: true, amount: p.amount, tier: p.tier, grantId: p.grantId, balance: creditBalance() };
      emit('claim', res);
      return res;
    },
    pending: function () { return load(PENDING_KEY, null); }
  };

  /* ======================================================================
     Gate —— 触发前避让态检查
     ====================================================================== */
  function isBlocked() {
    try {
      /* 已有 GuestGate 或其他模态/动作面板在场 */
      if (document.querySelector('.gg--overlay,.gg--screen,[role="dialog"][aria-modal="true"],.modal-show,.sheet-show')) return true;
      var ae = document.activeElement;
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || '')) return true;
      if (ae && ae.isContentEditable) return true;
      /* 支付进行中（页面自定义标记） */
      if (document.querySelector('[data-wonder-busy="pay"]')) return true;
    } catch (e) {}
    return false;
  }

  /* ======================================================================
     Director —— 总编排
     ====================================================================== */
  var decisions = {};
  var Director = {
    booted: false,
    scenario: 'home',
    timer: null,

    detectScenario: function () {
      var forced = document.body && document.body.getAttribute('data-wonder-scenario');
      if (forced) return forced;
      var tab = document.body && document.body.getAttribute('data-tab');
      if (tab === 'home') return 'home';
      if (document.querySelector('.detail-actionbar')) return 'detail';
      if (document.getElementById('list')) return 'list';
      var p = location.pathname;
      if (/\/search\//.test(p)) return 'list';
      if (/detail/.test(p)) return 'detail';
      if (/home\.html/.test(p) || /\/$/.test(p)) return 'home';
      return 'other';
    },

    boot: function (opts) {
      opts = opts || {};
      var c = cfg();
      if (!c || c.enabled === false) return false;
      this.scenario = opts.scenario || this.detectScenario();
      if (c.scenarios.indexOf(this.scenario) < 0) return false;
      if (this.booted) return true;
      this.booted = true;
      Tracker.bind(this.scenario);

      /* 启动时从 URL/容器推断一次品类 */
      try {
        var urlCat = new URLSearchParams(location.search).get('cat');
        var bodyCat = document.body && document.body.getAttribute('data-cat');
        var cat = bodyCat || urlCat;
        if (cat) Tracker.trackView(cat);
      } catch (e) {}

      var self = this;
      this.timer = setInterval(function () { self.tick(); }, 4000);
      emit('boot', { scenario: this.scenario });
      return true;
    },

    tick: function () {
      if (document.hidden) return;
      if (sess().shown) return;
      if (!Tracker.isIdleReady()) return;
      this.fire('auto');
    },

    /* 组装决策并弹窗。force=true 时跳过频控/沉默检查（演示/运营），预算与幂等仍生效 */
    fire: function (reason, forceOpts) {
      var c = cfg();
      forceOpts = forceOpts || {};
      if (!forceOpts.bypassGate) {
        if (isBlocked()) return { fired: false, reason: 'blocked' };
        var gate = Frequency.check();
        if (!gate.ok) return { fired: false, reason: gate.reason };
      }
      if (typeof w.WonderPopup === 'undefined' || !w.WonderPopup.show) return { fired: false, reason: 'no-popup' };

      var prof = Profile.derive();
      var bst = Budget.status();

      /* 游客 CTA 文案需要奖励量级暗示：预挂账最高 star，取 star 均值 */
      if (prof.guest) {
        var starTier = c.tiers.filter(function (t) { return t.id === 'star'; })[0];
        if (starTier) prof.nba.ctaText = prof.nba.ctaText.replace('预留的' + '积分', '预留的惊喜');
        prof.nba.ctaText = '注册领取为你预留的奖励';
      }

      var decisionId = 'd_' + shortId();
      var decision = {
        id: decisionId,
        reason: reason,
        scenario: this.scenario,
        persona: prof.persona,
        profile: prof,
        nba: prof.nba,
        guest: prof.guest,
        budgetState: bst.state,
        ts: Date.now(),
        settled: false,
        result: null
      };
      decisions[decisionId] = decision;

      Frequency.markShown();
      emit('show', decision);

      var self = this;
      w.WonderPopup.show({
        decisionId: decisionId,
        persona: prof.persona,
        guest: prof.guest,
        nba: prof.nba,
        budgetState: bst.state,
        onReveal: function () { return self.settle(decisionId); },
        onCta: function (result) { emit('cta', { decision: decision, result: result }); self._lastResult = result; },
        onDismiss: function (phase) { Frequency.markDismiss(); emit('dismiss', { phase: phase || 'result' }); }
      });
      return { fired: true, decisionId: decisionId, decision: decision };
    },

    settle: function (decisionId) {
      var d = decisions[decisionId];
      if (!d) return { kind: 'none' };
      return Granter.settle(d);
    }
  };

  /* ---------------- 调试/状态（演示台用） ---------------- */
  function debugState() {
    return {
      config: cfg(),
      scenario: Director.scenario,
      session: sess(),
      signals: loadSignals(),
      profile: Profile.derive(),
      frequency: Frequency.state(),
      budget: { raw: Budget.raw(), status: Budget.status() },
      pending: Granter.pending(),
      expectedCost: Granter.expectedCost()
    };
  }

  w.WonderEngine = {
    boot: function (opts) { return Director.boot(opts); },
    fire: function (opts) { return Director.fire('manual', opts || {}); },
    settle: function (id) { return Director.settle(id); },
    track: function (sig) {
      if (!sig) return;
      if (sig.type === 'view') Tracker.trackView(sig.cat);
      else if (sig.type === 'detail') Tracker.trackDetail(sig.cat, sig.id, sig.href);
      else if (sig.type === 'paywall') Tracker.trackPaywall(sig);
      else if (sig.type === 'effective') Tracker.trackEffective(sig.subtype || sig.action || 'manual', sig);
    },
    claimPending: function () { return Granter.claimPending(); },
    pending: function () { return Granter.pending(); },
    expectedCost: function () { return Granter.expectedCost(); },
    state: debugState,
    resetAll: function () {
      ['signals', 'freq', 'budget', 'grants', 'pending'].forEach(function (k) {
        try { localStorage.removeItem(LS_PREFIX + k); } catch (e) {}
      });
      try { sessionStorage.removeItem(LS_PREFIX + SESSION_KEY); } catch (e) {}
    },
    /* 演示台：模拟预算消耗 / 强制大奖配额用尽 */
    debugSpendBudget: function (ratio) {
      var c = cfg(), b = Budget.raw();
      b.spent = Math.round(c.budget.dailyCredits * ratio);
      save(BUDGET_KEY, b);
      return Budget.status();
    },
    debugResetFreq: function () {
      try {
        localStorage.removeItem(LS_PREFIX + FREQ_KEY);
        var s = sess(); s.shown = false; saveSess(s);
      } catch (e) {}
    },
    on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    off: function (ev) { listeners[ev] = []; },
    _tierForDebug: function (tierId) {
      var c = cfg();
      var t = c.tiers.filter(function (x) { return x.id === tierId; })[0] || c.tiers[0];
      return { tier: t, value: pickValue(t) };
    },
    _internal: { Tracker: Tracker, Profile: Profile, Frequency: Frequency, Budget: Budget, Granter: Granter, identity: identity }
  };
})(window);
