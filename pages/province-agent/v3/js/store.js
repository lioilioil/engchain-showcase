/* ============================================================
   store.js · v3 原型数据引擎（Mock）
   - 锁定口径常量只读；测算口径永不被登记改写
   - 所有写操作只改 Mock state + appendBehavior 留痕；不触发任何资金动作
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 锁定只读常量（来自 agent-ledger.js DEFAULTS，原型零改动） ---------- */
  var CONST = {
    grossShare: 0.50,
    selfRate: 0.50, /* 【S4-B】自身线系数 0.10→0.50（用户指令授权；独立分区、仅测算不入对账层） */
    frozenDays: 7,
    ratioMin: 0, ratioMax: 0.50,
    cap: 21,
    eligibleTypes: ["order_paid_net", "points_unlock_paid", "value_added_paid"],
    excludedTypes: ["recharge", "free_points", "entry_fee", "refund_reversal"],
    // 演示 T1
    demo: { eligible: 10000, gross: 5000, agreedToSub: 1000, ratioToSub: 0.20,
            selfKeep: 4000, frozen: 3000, selfLine: 4000, selfLineBase: 8000 }, /* selfLine=8000×0.5=4000 */
    // 【假设】营销参数，待真实埋点/合规回填（R6）
    bindWindowDays: 30, reassignOnce: 1, idleRecycleDays: 30
  };
  var MONEY_NOTE = "模拟测算 · 非税务意见 · 非实际代扣 / 非实际到账 · 不可提现";

  var CH_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function rndCode(n) {
    var s = "";
    for (var i = 0; i < (n || 6); i++) s += CH_CODE_CHARS[Math.floor(Math.random() * CH_CODE_CHARS.length)];
    return s;
  }
  function genChannelCode(ownerType) {
    var seg = ownerType === "sub" ? "CH-S" : ownerType === "staff" ? "CH-E" : "CH-P";
    return seg + "-" + rndCode(6);
  }
  function genAgentCode() { return "AG-" + rndCode(6); }

  var LS_KEY = "engchain-v3-demo-state-v1";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  /* ---------- 纯函数口径（只读复算，任何 action 不得改写） ---------- */
  function calcFinance(base) {
    // base: { eligible, frozen, ratioToSub, selfBase, subsList?(多二级聚合,可选) }
    var eligible = base.eligible || 0;
    var gross = Math.round(eligible * CONST.grossShare);            // 总盘 = 合格消费 ×50%
    var ratio = base.ratioToSub || 0;
    var agreed = Math.round(gross * ratio);                         // 约定给二级（省代视角演示）
    var selfKeep = gross - agreed;                                  // 自留 = 总盘 − 约定
    var selfLine = Math.round((base.selfBase || 0) * CONST.selfRate);// 自身线 = 自身合格消费×50%（独立）
    var out = { eligible: eligible, gross: gross, agreed: agreed, ratioToSub: ratio,
             selfKeep: selfKeep, frozen: base.frozen || 0, selfLine: selfLine };
    /* 【S4-B】可选多二级聚合：传入 subsList 时按各自 ratioToSub 汇总约定所得。
       eligible 暂取 demo 单值（多二级消费基数埋点为后续）；不传则维持单值聚合（向后兼容）。 */
    if (base.subsList && base.subsList.length) {
      out.agreedAll = base.subsList.reduce(function (s, x) {
        return s + Math.round(gross * (Number(x.ratioToSub) || 0));
      }, 0);
      out.selfKeepAll = gross * base.subsList.length - out.agreedAll;
    }
    return out;
  }
  function subSettle(base) {
    // 二级本人：settleAgg = 总盘×50%×ratioToSub 纯展示
    var gross = Math.round((base.eligible || 0) * CONST.grossShare);
    return { eligible: base.eligible || 0, gross: gross,
             agreed: Math.round(gross * (base.ratioToSub || 0)), ratioToSub: base.ratioToSub || 0,
             frozen: base.frozen || 0 };
  }
  function regsSum(payRegs, calcId) {
    return (payRegs || [])
      .filter(function (r) { return r.calcId === calcId && r.status !== "void"; })
      .reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
  }
  function diffOf(calc, payRegs) {
    return calc.calcAmount - regsSum(payRegs, calc.id);
  }

  /* ---------- store ---------- */
  var state = null;
  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(state); } catch (e) {} }); }
  function hydrate(data, meta) {
    state = clone(data);
    state.mode = (meta && meta.mode) || data.mode || "province";
    state.theme = (meta && meta.theme) || data.theme || "light";
    state.role = (meta && meta.role) || data.role || "boss";
    state.scenario = (meta && meta.scenario) || data.scenario || "active";
    if (!state.behavior) state.behavior = [];
    persist(); emit();
  }
  function getState() { return state; }
  function domain() { return state.mode === "sub" ? state.sub : state.province; }
  function subscribe(f) { listeners.push(f); return function () {
    listeners = listeners.filter(function (x) { return x !== f; });
  }; }
  function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function behavior(act, detail) {
    state.behavior.unshift({ at: new Date().toISOString(), act: act, detail: detail || {} });
    if (state.behavior.length > 200) state.behavior.length = 200;
  }
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  /* ---------- 对账层取数（省代两层 / 二级取 layer2 本企业） ---------- */
  function layerBox(layer) {
    var d = domain();
    if (state.mode === "sub") return { calc: d.calc, regs: d.payRegs, stmts: d.statements };
    var k = String(layer) === "2" ? "2" : "1";
    return { calc: d["calc" + k], regs: d["payRegs" + k], stmts: d["statements" + k] };
  }

  /* ---------- actions ---------- */
  function act(type, p) {
    p = p || {};
    var d = domain();
    switch (type) {
      case "theme/set":
        state.theme = p.theme; break;
      case "role/set":
        state.role = p.role; break;

      /* B 轨 渠道码 */
      case "channel/gen": {
        var ownerType = p.ownerType || (state.mode === "sub" ? "sub" : "province");
        d.channels.unshift({ id: uid("ch"), code: genChannelCode(ownerType), ownerType: ownerType,
          ownerName: p.ownerName || (ownerType === "sub" ? d.profile.name : "本公司"),
          tpl: p.tpl || "tpl1", src: p.src || "wechat", status: "active",
          createdAt: todayStr(), voidInfo: null });
        behavior("channel-gen", { tpl: p.tpl, src: p.src });
        break;
      }
      case "channel/void": {
        var c = find(d.channels, p.id); if (c && c.status === "active") { c.status = "void"; c.voidInfo = { reason: p.reason || "主动作废", at: todayStr() }; }
        behavior("channel-void", { id: p.id });
        break;
      }

      /* 线索 */
      case "lead/follow": {
        var l = find(d.leads, p.id);
        if (l) { l.follows = l.follows || []; l.follows.unshift({ at: todayStr(), text: p.text, by: state.role });
                 l.nextFollowAt = p.nextFollowAt || l.nextFollowAt; }
        behavior("lead-follow", { id: p.id });
        break;
      }
      case "lead/stage": {
        var ld = find(d.leads, p.id);
        if (ld) { var old = ld.stage; ld.stage = p.stage;
                  if ((p.stage === "paid" || p.stage === "repaid") && !ld.paidAmount) ld.paidAmount = p.paidAmount || 0; }
        behavior("lead-stage", { id: p.id, from: old, to: p.stage });
        break;
      }
      case "lead/rebind": {
        var lx = find(d.leads, p.id);
        if (lx && !lx.rebound) { lx.rebound = true; behavior("lead-rebind", { id: p.id }); }
        break;
      }

      /* A 轨 招商码 / 发起二级 / 初审（仅省代 boss） */
      case "agent/gen": {
        if (state.mode !== "province" || state.role !== "boss") break;
        var hasActive = d.agentCodes.some(function (x) { return x.status === "active"; });
        if (!hasActive) d.agentCodes.unshift({ id: uid("ag"), code: genAgentCode(), status: "active", createdAt: todayStr(), voidInfo: null });
        behavior("agent-gen", {});
        break;
      }
      case "agent/void": {
        if (state.mode !== "province" || state.role !== "boss") break;
        var ag = find(d.agentCodes, p.id); if (ag) { ag.status = "void"; ag.voidInfo = { reason: p.reason || "主动作废", at: todayStr() }; }
        behavior("agent-void", { id: p.id });
        break;
      }
      case "app/create": {
        if (state.mode !== "province" || state.role !== "boss") break;
        var used = d.profile.used, cap = d.profile.cap;
        if (used >= cap) { break; } // 名额满：拦截（UI 也禁用）
        d.subApps.unshift({ id: uid("app"), entName: p.entName, uscc: p.uscc, contact: p.contact,
          phone: p.phone, ratioToSub: p.ratioToSub, status: "pending", rejectReason: null, createdAt: todayStr() });
        behavior("subapp-create", { ent: p.entName, ratio: p.ratioToSub });
        break;
      }
      case "app/review": {
        if (state.mode !== "province" || state.role !== "boss") break;
        var a = find(d.subApps, p.id); if (!a || a.status !== "pending") break;
        if (p.pass) {
          a.status = "approved";
          d.profile.used = Math.min(d.profile.cap, d.profile.used + 1);
          d.profile.subsCount = (d.profile.subsCount || 0) + 1;
          d.subs = d.subs || [];
          d.subs.push({ id: uid("sub"), name: a.entName, status: "active", ratioToSub: a.ratioToSub,
                       inviteScope: "标准授权（平台配置 + O4 协议内）", inviteRate: null, inviteRateReadonly: true,
                       /* 【S4-B】分成配置留痕字段 */
                       ratioUpdatedAt: todayStr(),
                       ratioLog: [{ at: todayStr(), from: 0, to: a.ratioToSub, by: "boss" }] });
        } else { a.status = "rejected"; a.rejectReason = p.reason || "资料不全"; }
        behavior("subapp-review", { id: p.id, pass: !!p.pass });
        break;
      }

      /* 【S4-B】二级分成配置：获批后修改约定所得比例（boss 权限 / 账号生效 / 0–50% 校验 / 留痕） */
      case "sub/setRatio": {
        if (state.mode !== "province" || state.role !== "boss") break;
        if (d.profile.status !== "active") break; /* 暂停/非生效账号拦截 */
        var s2 = find(d.subs, p.id); if (!s2 || s2.status !== "active") break;
        var nr = Math.round((Number(p.ratio) || 0) * 100) / 100;
        if (isNaN(nr) || nr < CONST.ratioMin || nr > CONST.ratioMax) break; /* 超界拒绝 */
        var oldR = Number(s2.ratioToSub) || 0;
        if (nr === oldR) break;
        s2.ratioToSub = nr;
        s2.ratioLog = s2.ratioLog || [];
        s2.ratioLog.push({ at: todayStr(), from: oldR, to: nr, by: state.role });
        if (s2.ratioLog.length > 50) s2.ratioLog = s2.ratioLog.slice(-50);
        s2.ratioUpdatedAt = todayStr();
        behavior("sub-ratio-change", { id: p.id, from: oldR, to: nr });
        break;
      }

      /* 线下付款登记（凭证强制由 UI 校验） */
      case "pay/addReg": {
        var box = layerBox(p.layer);
        box.regs.unshift({ id: uid("reg"), calcId: p.calcId, amount: Number(p.amount) || 0,
          method: p.method || "bank", date: p.date || todayStr(),
          vouchers: p.vouchers || [], registeredBy: state.role,
          status: "pending_confirm", createdAt: todayStr(), voidInfo: null });
        behavior("pay-register", { calcId: p.calcId, amount: p.amount, vouchers: (p.vouchers || []).length });
        break;
      }
      case "pay/confirm": {
        var b2 = layerBox(p.layer); var r = find(b2.regs, p.id);
        if (r && r.status !== "void") { r.status = "confirmed"; r.confirmedAt = todayStr(); r.signMethod = p.signMethod || "record"; }
        behavior("pay-confirm", { id: p.id, signMethod: p.signMethod || "record" });
        break;
      }
      case "pay/dispute": {
        var b3 = layerBox(p.layer); var r3 = find(b3.regs, p.id);
        if (r3 && r3.status !== "void") { r3.status = "disputed"; r3.reason = p.reason || "";
          if (p.vouchers && p.vouchers.length) r3.vouchers = (r3.vouchers || []).concat(p.vouchers); }
        behavior("pay-dispute", { id: p.id, reason: p.reason });
        break;
      }
      case "pay/void": { // 作废 = 红冲，只追加不可物理删
        var b4 = layerBox(p.layer); var r4 = find(b4.regs, p.id);
        if (r4 && r4.status !== "void") {
          r4.status = "void"; r4.voidInfo = { reason: p.reason, at: todayStr(), by: state.role };
          b4.regs.unshift({ id: uid("red"), calcId: r4.calcId, amount: -Math.abs(r4.amount), method: r4.method,
            date: todayStr(), vouchers: [], registeredBy: state.role, status: "void",
            createdAt: todayStr(), redFlushOf: r4.id, voidInfo: { reason: "红字冲销原登记笔", at: todayStr() } });
        }
        behavior("pay-redflush", { id: p.id, reason: p.reason });
        break;
      }
      case "stmt/balance": {
        var b5 = layerBox(p.layer); var st = find(b5.stmts, p.id);
        if (!st) break;
        var calc = find(b5.calc, st.calcId);
        var diff = diffOf(calc, b5.regs);
        if (diff === 0 && st.status === "open") { st.status = "balanced"; st.balancedAt = todayStr(); }
        behavior("stmt-balance", { id: p.id, diff: diff });
        break;
      }

      /* 二级 O4 协议 */
      case "agree/sign": {
        if (state.mode === "sub" && d.agreement) { d.agreement.state = "signed"; d.agreement.completedAt = todayStr(); }
        behavior("agree-sign", {});
        break;
      }
      case "agree/reject": {
        if (state.mode === "sub" && d.agreement) { d.agreement.state = "rejected"; d.agreement.rejectReason = p.reason; }
        behavior("agree-reject", { reason: p.reason });
        break;
      }
      default:
        break;
    }
    persist(); emit();
  }

  /* ---------- 聚合 selectors ---------- */
  function funnelOf(leads) {
    var c = { direct: 0, registered: 0, onboarded: 0, paid: 0, repaid: 0, lost: 0, ignored: 0, paidAmount: 0 };
    (leads || []).forEach(function (l) {
      if (l.viaUserReinvite) { c.ignored++; return; } // 用户再邀请：不归属不计佣
      c.direct++;
      if (["registered", "onboarded", "paid", "repaid"].indexOf(l.stage) >= 0) c.registered++;
      if (["onboarded", "paid", "repaid"].indexOf(l.stage) >= 0) c.onboarded++;
      if (["paid", "repaid"].indexOf(l.stage) >= 0) { c.paid++; c.paidAmount += Number(l.paidAmount) || 0; }
      if (l.stage === "repaid") c.repaid++;
      if (l.stage === "lost") c.lost++;
    });
    return c;
  }

  window.V3 = window.V3 || {};
  window.V3.MONEY_NOTE = MONEY_NOTE;
  window.V3.store = {
    CONST: CONST, MONEY_NOTE: MONEY_NOTE,
    hydrate: hydrate, getState: getState, subscribe: subscribe, act: act,
    domain: domain, behavior: behavior,
    calcFinance: calcFinance, subSettle: subSettle, regsSum: regsSum, diffOf: diffOf, funnelOf: funnelOf,
    genChannelCode: genChannelCode, genAgentCode: genAgentCode,
    _lsKey: LS_KEY, resetStorage: function () { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
  };
})();
