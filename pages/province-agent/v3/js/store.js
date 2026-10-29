/* ============================================================
   store.js · 省级总代 / 二级合作 · 演示数据模型（单一数据源）
   规则：
   - 所有写操作统一走 act(type, payload)，返回 { ok:true } 或 { ok:false, reason }
   - 角色：admin（省代管理员，旧值 boss 兼容）/ staff（省代员工，仅本人渠道数据）/
            sub_admin（二级管理员，旧值 sub_owner 兼容）；T2 统一身份模型见 uni-shared.js
   - 暂停态 profile.status !== 'active' 时所有写操作拒绝（只读）
   - 测算均为演示口径，页面须标注"模拟测算，以平台月度对账为准"
   ============================================================ */
(function () {
  "use strict";

  var LS_KEY = "engchain-v3-demo-state-v1";
  var STATE_KEY = "engchain-v3-demo-scenario";

  /* 业务常量（演示口径；分佣规则常量权威见 js/agent-ledger.js DEFAULTS：grossShare=0.5） */
  var CONST = {
    grossShare: 0.50,          // 省代总盘 = 平台总合格消费 × 50%
    selfRate: 0.50,            // legacy：旧"自留率"模型残留，仅 calcFinance（已无调用方）使用
    frozenDays: 7,             // T+7 冻结
    ratioMin: 0, ratioMax: 0.50, // 约定比例 0–50%
    cap: 21,
    bindWindowDays: 30,        // 注册后 30 天内必须绑定上级
    reassignOnce: 1,           // 每个用户最多换绑 1 次
    idleRecycleDays: 30,       // 渠道沉寂 30 天提示回收（本期仅提示，不做回收动作）
    l1DisputeDays: 5,          // 第一层：T+5 工作日内可提异议
    l2DisputeDays: 15          // 第二层：出账后 15 天内仅提醒，不自动确认
  };

  /* ---------------- 编号 ---------------- */
  var pad = function (n) { return String(n < 10 ? "0" + n : n); };
  var rnd6 = function () { return Math.random().toString(36).slice(2, 8).toUpperCase(); };
  function genAgentCode() {
    return "AG-" + rnd6();
  }
  function genChannelCode(state, ownerType) {
    /* ownerType: CH-P 省代招商（老板）/ CH-E 省代员工 / CH-S 二级 */
    var prefix = "CH-P";
    if (ownerType === "staff" || state.role === "staff") prefix = "CH-E";
    if (state.mode === "sub" || ownerType === "sub") prefix = "CH-S";
    return prefix + "-" + rnd6();
  }
  function genId(prefix) { return prefix + "-" + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 90 + 10); }

  /* ---------------- 汇总（省代） ---------------- */
  /* 多二级口径（决策 9）：演示为"全省单盘测算"，不做 N×gross 合计；
     仅当生效中二级为 1 家时输出约定合计与自留合计，多家时返回 null 并由 UI 标注口径 */
  /* legacy：旧"全省单盘+自留率"模型（已无调用方；统一口径见 uni-shared financeSplit 与 js/agent-ledger.js） */
  function calcFinance(fin, subs) {
    if (!fin) return null;
    var gross = Math.round(fin.gross * CONST.grossShare);
    var eligible = gross;
    var selfRate = fin.selfRate == null ? CONST.selfRate : fin.selfRate;
    var activeSubs = (subs || []).filter(function (s) { return s.status === "active"; });
    var agreedAll = null, selfKeepAll = null;
    if (activeSubs.length === 1) {
      agreedAll = Math.round(gross * activeSubs[0].ratioToSub);
      selfKeepAll = gross - agreedAll;
    }
    return {
      gross: gross,
      eligible: eligible,
      grossShare: CONST.grossShare,
      selfRate: selfRate,
      selfKeep: Math.round(gross * selfRate),
      agreedAll: agreedAll,
      selfKeepAll: selfKeepAll,
      multiSub: activeSubs.length > 1,
      frozen: Math.round(0.05 * gross),
      cap: CONST.cap
    };
  }

  /* ---------------- 二级经营测算（只读） ---------------- */
  function subSettle(calc) {
    var eligible = calc.eligibleBase || 0;
    var gross = Math.round(eligible * CONST.grossShare);
    var ratio = calc.ratioToSub == null ? 0 : calc.ratioToSub;
    var agreed = Math.round(gross * ratio);
    return {
      eligible: eligible,
      gross: gross,
      ratioToSub: ratio,
      agreed: agreed,
      frozen: Math.round(agreed * 0.05)
    };
  }
  function funnelOf(leads) {
    var all = [];
    Object.keys(leads || {}).forEach(function (ch) {
      all = all.concat(leads[ch]);
    });
    return {
      registered: all.length,
      onboarded: all.filter(function (l) { return ["onboarded", "paid", "repaid"].indexOf(l.stage) >= 0; }).length,
      paid: all.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; }).length,
      lost: all.filter(function (l) { return l.stage === "lost"; }).length,
      paidAmount: all.reduce(function (s, l) { return s + (l.amount || 0); }, 0)
    };
  }

  /* ---------------- 获客转化（消费记录域）：逐笔消费明细 + 成员/渠道/事项聚合 ---------------- */
  /* scope: all=省代团队（管理员/法代）| mine=员工本人 | sub=二级企业 | sub_mine=二级员工本人
     记录为逐笔消费（含企业入驻等非合格事项）；展示层按主体系 eligibleTypes 口径标注合格 */
  function consumeOf(state, opts) {
    opts = opts || {};
    var d = state.state;
    var scope = opts.scope || "all";
    var my = opts.myName || "";
    var pairs = [];
    var channels = [];
    if (state.mode === "province") {
      ["direct", "agent"].forEach(function (ch) {
        (d.leads[ch] || []).forEach(function (l) {
          if (scope === "mine" && l.owner !== my) return;
          pairs.push({ l: l, ch: ch });
        });
        (d.channels[ch] || []).forEach(function (c) { channels.push(c); });
      });
    } else {
      (d.leads.school || []).forEach(function (l) {
        if (scope === "sub_mine" && l.owner !== my) return;
        pairs.push({ l: l, ch: "school" });
      });
      (d.channels.school || []).forEach(function (c) { channels.push(c); });
    }
    var records = [];
    pairs.forEach(function (p) {
      (p.l.consumption || []).forEach(function (c) {
        records.push({
          leadId: p.l.id, name: p.l.name, phone: p.l.phone, company: p.l.company || "",
          member: p.l.owner || "", channel: p.ch, stage: p.l.stage,
          date: c.date, type: c.type, amount: c.amount
        });
      });
    });
    records.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
    var byType = {}, byChannel = {}, byMember = {};
    records.forEach(function (r) {
      byType[r.type] = byType[r.type] || { type: r.type, count: 0, amount: 0 };
      byType[r.type].count += 1;
      byType[r.type].amount += r.amount;
      byChannel[r.channel] = byChannel[r.channel] || { channel: r.channel, count: 0, amount: 0, reg: 0, paid: 0, paidAmount: 0 };
      byChannel[r.channel].count += 1;
      byChannel[r.channel].amount += r.amount;
      if (r.member) {
        byMember[r.member] = byMember[r.member] || { member: r.member, reg: 0, paid: 0, amount: 0 };
      }
    });
    pairs.forEach(function (p) {
      var l = p.l;
      if (byChannel[p.ch]) {
        byChannel[p.ch].reg += 1;
        if (l.stage === "paid" || l.stage === "repaid") byChannel[p.ch].paid += 1;
        byChannel[p.ch].paidAmount += (l.amount || 0);
      }
      if (byMember[l.owner]) {
        byMember[l.owner].reg += 1;
        if (l.stage === "paid" || l.stage === "repaid") byMember[l.owner].paid += 1;
        byMember[l.owner].amount += (l.amount || 0);
      }
    });
    var arrOf = function (m) {
      return Object.keys(m).map(function (k) { return m[k]; });
    };
    return {
      records: records,
      byType: arrOf(byType),
      byChannel: arrOf(byChannel),
      byMember: arrOf(byMember).sort(function (a, b) { return b.amount - a.amount; }),
      channelCount: channels.length
    };
  }

  /* ---------------- 登记勾稽 ---------------- */
  /* 勾稽口径：仅确认计入；异议/作废不计入"已确认到账" */
  function regsOf(d, layer, calcId) {
    var list = layer === "1" ? d.payRegs1 : d.payRegs2;
    if (layer === "2" && d.payRegs) list = d.payRegs; // 二级域
    if (!list) return [];
    return list.filter(function (r) { return r.calcId === calcId; });
  }
  function regsSum(list, calcId) {
    return list.filter(function (r) { return r.calcId === calcId && r.status !== "void" && r.status !== "disputed"; })
      .reduce(function (s, r) { return s + r.amount; }, 0);
  }
  function regsAllSum(list, calcId) {
    return list.filter(function (r) { return r.calcId === calcId && r.status !== "void"; })
      .reduce(function (s, r) { return s + r.amount; }, 0);
  }
  function monthlyStatement(calc, regs) {
    var sum = regsSum(regs, calc.id);
    var diff = calc.calcAmount - sum;
    return {
      id: "st-" + calc.id,
      calcId: calc.id,
      month: calc.month,
      calcAmount: calc.calcAmount,
      registered: sum,
      diff: diff,
      status: diff === 0 ? "balanced" : "open"
    };
  }

  /* ---------------- 待办 / 消息（单源派生） ---------------- */
  function todoOf(state) {
    var d = state.state;
    var items = [];
    if (state.mode === "province") {
      /* 员工无审批/平账/对账处理职责，不派生 boss 待办与角标 */
      if (state.role === "staff") {
        return { reconcile: 0, invite: 0, subs: 0, total: 0,
          l1: { pending: 0, disputed: 0 }, l2: { pending: 0, disputed: 0 }, items: [] };
      }
      /* 逐笔待办：每笔付款登记/异议、每家待审批申请各一条明细；total 与 items 同源 */
      var l1Regs = (d.payRegs1 || []).filter(function (r) { return r.calcId === "c1-l1"; });
      var l2Regs = (d.payRegs2 || []).filter(function (r) { return r.calcId === "c1-l2"; });
      var l1Dis = l1Regs.filter(function (r) { return r.status === "disputed"; });
      var l1Pend = l1Regs.filter(function (r) { return r.status === "pending_confirm"; });
      var l2Dis = l2Regs.filter(function (r) { return r.status === "disputed"; });
      var l2Pend = l2Regs.filter(function (r) { return r.status === "pending_confirm"; });
      var subPending = (d.subApps || []).filter(function (a) { return a.status === "pending"; });
      l1Dis.forEach(function (r) {
        items.push({ key: "l1-disputed", id: r.id, type: "danger", icon: "warn",
          t: "与平台对账有异议待处理 · ¥" + r.amount,
          s: "第一层 ¥" + r.amount + "，T+5 工作日内核实", to: "#/reconcile" });
      });
      l1Pend.forEach(function (r) {
        items.push({ key: "l1-pending", id: r.id, type: "warn", icon: "clock",
          t: "平台对账有付款待确认 · ¥" + r.amount,
          s: "第一层 ¥" + r.amount + " 待确认，请核对凭证", to: "#/reconcile" });
      });
      l2Dis.forEach(function (r) {
        items.push({ key: "l2-disputed", id: r.id, type: "danger", icon: "warn",
          t: "二级提出收款异议 · ¥" + r.amount,
          s: "第二层 ¥" + r.amount + " 异议待线下核实", to: "#/reconcile" });
      });
      l2Pend.forEach(function (r) {
        items.push({ key: "l2-pending", id: r.id, type: "warn", icon: "clock",
          t: "二级收款待确认 · ¥" + r.amount,
          s: "第二层 ¥" + r.amount + " 待二级确认", to: "#/reconcile" });
      });
      subPending.forEach(function (a) {
        items.push({ key: "sub-pending", id: a.id, type: "info", icon: "file-text",
          t: "二级合作申请待审批 · " + a.name,
          s: "申请比例 " + Math.round(a.ratio * 100) + "% · " + (a.submittedAt || a.createdAt || ""), to: "#/subs" });
      });
      return {
        reconcile: l1Dis.length + l1Pend.length + l2Dis.length + l2Pend.length,
        invite: 0,
        subs: subPending.length,
        total: items.length,
        l1: { pending: l1Pend.length, disputed: l1Dis.length },
        l2: { pending: l2Pend.length, disputed: l2Dis.length },
        items: items
      };
    }
    var pendRegs = (d.payRegs || []).filter(function (r) { return r.status === "pending_confirm"; });
    var dispRegs = (d.payRegs || []).filter(function (r) { return r.status === "disputed"; });
    var agreePending = d.agreement && (d.agreement.state === "pending_mine" || d.agreement.state === "rejected") ? 1 : 0;
    pendRegs.forEach(function (r) {
      items.push({ key: "pay-pending", id: r.id, type: "warn", icon: "clock",
        t: "有省代付款待你确认 · ¥" + r.amount,
        s: "¥" + r.amount + "，请核对到账与凭证后确认", to: "#/payments" });
    });
    dispRegs.forEach(function (r) {
      items.push({ key: "pay-disputed", id: r.id, type: "danger", icon: "warn",
        t: "有异议的付款待核实 · ¥" + r.amount,
        s: "¥" + r.amount + "，线下核实后可确认", to: "#/payments" });
    });
    if (d.agreement && d.agreement.state === "pending_mine") items.push({ key: "agree-sign", type: "info", icon: "file-text", t: "O4 合作协议待签署", s: "请阅读条款后完成签署", to: "#/home" });
    if (d.agreement && d.agreement.state === "rejected") items.push({ key: "agree-rejected", type: "info", icon: "file-text", t: "合作协议已拒签，待省代重新发起", s: "可查看拒签原因", to: "#/home" });
    return {
      payments: pendRegs.length + dispRegs.length,
      agreement: agreePending,
      total: items.length,
      items: items
    };
  }

  /* 消息列表：派生待办 + 手动动作留痕（msgLog）+ 静态运营提示 */
  function messagesOf(state) {
    var todo = todoOf(state);
    var msgs = [];
    var d = state.state;
    todo.items.forEach(function (it) {
      msgs.push({ key: it.key, id: it.id, icon: it.icon, type: it.type, title: it.t, desc: it.s, to: it.to, time: "今天", source: "todo" });
    });
    if (d.profile.status === "suspended") {
      msgs.push({ icon: "lock", type: "danger", title: "账号已暂停（仅可查看）", desc: "全部经营动作锁定，请联系平台或上级处理", to: state.mode === "sub" ? "#/home" : "#/home", time: "今天", source: "state" });
    }
    (d.msgLog || []).forEach(function (m) {
      msgs.push({ icon: m.icon || "bell", type: m.type || "info", title: m.title, desc: m.desc, to: m.to || "", time: m.time || "刚刚", source: "log" });
    });
    return msgs;
  }

  /* 首页动态流：独立事件源（仅 msgLog 时间线，不含待办派生与状态封条） */
  function activitiesOf(state) {
    var d = state.state;
    return (d.msgLog || []).slice();
  }

  /* ---------------- store 主体 ---------------- */
  var state = null;

  function seed(initial, scenarioKey) {
    /* 深拷贝种子，防止重置不彻底 */
    state = JSON.parse(JSON.stringify(initial));
    state.scenarioKey = scenarioKey || (state.mode === "sub" ? "sub-active" : "active");
    if (!state.state.msgLog) state.state.msgLog = [];
    save();
    return state;
  }
  function getState() { return state; }
  function reset(initial, scenarioKey) { return seed(initial, scenarioKey); }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function appMode() { return window.V3_APP === "sub" ? "sub" : "province"; }
  function defaultScenario() { return appMode() === "sub" ? "sub-active" : "active"; }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        /* 双壳共用 LS 键：模式不匹配或种子版本过旧（_v 不符）时强制重新播种，
           避免省代/二级串数据，以及沿用陈旧种子（如生效中合作家数变更后） */
        var ver = window.V3.scenarios.dataVersion();
        state = (parsed && parsed.mode === appMode() && parsed._v === ver) ? parsed : null;
      }
    } catch (e) { state = null; }
    return state;
  }
  function currentScenario() {
    try {
      var k = localStorage.getItem(STATE_KEY);
      if (k && window.V3.scenarios && window.V3.scenarios.seedByScenario(k)) {
        var seed = window.V3.scenarios.seedByScenario(k);
        if (seed.mode === appMode()) return k;
      }
    } catch (e) {}
    return defaultScenario();
  }

  /* ---------------- 守卫 ---------------- */
  function ctxInfo() {
    var d = state.state;
    var role = state.role;
    var mode = state.mode;
    var readonly = d.profile.status !== "active";
    return {
      mode: mode, role: role, readonly: readonly,
      isBoss: mode === "province" && (role === "boss" || role === "admin"),
      isStaff: mode === "province" && role === "staff",
      isOwner: mode === "sub" && (role === "sub_owner" || role === "sub_admin"),
      isSubStaff: mode === "sub" && role === "sub_staff",
      staffName: state.roleStaffName || "王敏"
    };
  }
  function fail(reason) { return { ok: false, reason: reason }; }
  var ok = function () { return { ok: true }; };

  function act(type, payload) {
    payload = payload || {};
    var d = state.state, c = ctxInfo();
    var p = payload;

    /* 只读：除主题/角色演示切换外一律拒绝 */
    if (c.readonly && type !== "theme/set" && type !== "role/set") {
      return fail("账号已暂停，仅可查看");
    }

    switch (type) {
      case "theme/set":
        state.theme = p.theme; save(); return ok();

      case "role/set":
        /* 演示身份切换（非真实业务动作） */
        state.role = p.role;
        if (p.role === "staff" && !state.roleStaffName) state.roleStaffName = "王敏";
        save(); return ok();

      /* ---------- 渠道码 ---------- */
      case "channel/gen": {
        if (c.mode === "province" && !c.isBoss && !c.isStaff) return fail("仅管理员或员工可生成渠道码");
        if (c.mode === "sub" && !c.isOwner && !c.isSubStaff) return fail("仅二级管理员或员工可生成渠道码");
        var list = d.channels, ch = p.channel;
        if (!list[ch]) return fail("渠道不存在");
        var ownerType = p.ownerType || (c.isStaff ? "staff" : (c.isSubStaff ? "sub" : (c.mode === "sub" ? "sub" : "province")));
        var code = genChannelCode(state, ownerType);
        var ownerName = c.isStaff ? c.staffName : (c.isOwner || c.isSubStaff ? d.profile.contact : "王建国");
        list[ch].push({
          code: code,
          channel: ch,
          ownerType: ownerType,
          ownerName: ownerName,
          createdAt: "2026-10",
          users: 0,
          validUntil: "2026-12-31",
          status: "active"
        });
        save(); return { ok: true, code: code };
      }

      case "channel/void": {
        if (c.mode === "province" && !c.isBoss && !c.isStaff) return fail("无权限作废旧码");
        if (c.mode === "sub" && !c.isOwner && !c.isSubStaff) return fail("无权限作废旧码");
        var arr = d.channels[p.channel] || [];
        var rec = arr.filter(function (x) { return x.code === p.code; })[0];
        if (!rec) return fail("渠道码不存在");
        if (c.isStaff && rec.ownerName !== c.staffName) return fail("员工仅可作废本人渠道码");
        if (c.isSubStaff && rec.ownerName !== c.staffName) return fail("员工仅可作废本人渠道码");
        rec.status = "void";
        rec.voidAt = "2026-10";
        save(); return ok();
      }

      /* ---------- 线索（员工仅本人） ---------- */
      case "lead/follow": {
        if (!c.isBoss && !c.isStaff && !c.isSubStaff) return fail("无权限跟进线索");
        var lf = d.leads[p.channel].filter(function (x) { return x.id === p.id; })[0];
        if (!lf) return fail("线索不存在");
        if ((c.isStaff || c.isSubStaff) && lf.owner !== c.staffName) return fail("仅可跟进本人渠道线索");
        lf.notes = lf.notes || [];
        lf.notes.push({ at: "今天", by: c.isStaff ? c.staffName : (c.isSubStaff ? c.staffName : "王建国"), text: p.note });
        save(); return ok();
      }

      case "lead/stage": {
        if (!c.isBoss && !c.isStaff && !c.isSubStaff) return fail("无权限更新线索");
        var ls = d.leads[p.channel].filter(function (x) { return x.id === p.id; })[0];
        if (!ls) return fail("线索不存在");
        if ((c.isStaff || c.isSubStaff) && ls.owner !== c.staffName) return fail("仅可更新本人渠道线索");
        ls.stage = p.stage;
        save(); return ok();
      }

      case "lead/rebind": {
        /* 本期不做回收/换绑动作（决策 10） */
        return fail("线索已进入沉寂期，暂不支持换绑");
      }

      /* ---------- 招商码 ---------- */
      case "agent/gen": {
        if (!c.isBoss) return fail("仅管理员可生成招商码");
        var a = d.agentCodes[p.channel];
        if (a.status !== "active" || a.code) return fail("当前招商码有效，无需重复生成");
        a.code = genAgentCode();
        a.status = "active";
        a.createdAt = "2026-10";
        save(); return { ok: true, code: a.code };
      }

      case "agent/void": {
        if (!c.isBoss) return fail("仅管理员可作废招商码");
        var av = d.agentCodes[p.channel];
        if (!av.code) return fail("尚无招商码");
        av.status = "void";
        av.voidAt = "2026-10";
        save(); return ok();
      }

      /* ---------- 二级合作 ---------- */
      case "app/create": {
        if (!c.isBoss) return fail("仅管理员可发起二级合作");
        if (!p.data || !p.data.name || !p.data.uscc) return fail("请填写企业名称与统一社会信用代码");
        if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(String(p.data.uscc).trim())) return fail("统一社会信用代码应为 18 位");
        if (p.data.phone && !/^1\d{10}$/.test(p.data.phone)) return fail("请输入正确的手机号");
        d.subApps.push({
          id: genId("app"),
          name: p.data.name, uscc: p.data.uscc, contact: p.data.contact || "", phone: p.data.phone || "",
          address: p.data.address || "",
          ratio: p.data.ratio || 0.20,
          channel: p.channel,
          status: "pending",
          submittedAt: "2026-10-27"
        });
        save(); return ok();
      }

      case "app/review": {
        if (!c.isBoss) return fail("仅管理员可审批");
        var app = d.subApps.filter(function (x) { return x.id === p.id; })[0];
        if (!app || app.status !== "pending") return fail("申请不存在或已处理");
        if (p.pass) {
          app.status = "approved";
          app.handledAt = "2026-10-27";
          d.subs.push({
            id: genId("sub"),
            name: app.name,
            uscc: app.uscc,
            contact: app.contact || "负责人",
            phone: app.phone || "",
            address: app.address || "",
            ratioToSub: app.ratio,
            since: "2026-10-27",
            status: "active",
            channel: app.channel
          });
          pushMsg(d, { icon: "file-text", type: "info", title: "合作已通过：" + app.name, desc: "合作协议已生成，待二级企业登录后签署", to: "#/subs" });
        } else {
          app.status = "rejected";
          app.rejectReason = p.reason || "资质不符";
          app.handledAt = "2026-10-27";
        }
        save(); return ok();
      }

      case "sub/setRatio": {
        if (!c.isBoss) return fail("仅管理员可配置约定比例");
        var s = d.subs.filter(function (x) { return x.id === p.id; })[0];
        if (!s || s.status !== "active") return fail("二级合作不可用");
        var ratio = Number(p.ratio);
        if (isNaN(ratio) || ratio < CONST.ratioMin || ratio > CONST.ratioMax) return fail("约定比例须在 0–50% 之间");
        s.ratioToSub = ratio;
        d.ratioLog = d.ratioLog || [];
        d.ratioLog.unshift({
          id: genId("rl"), subId: s.id, sub: s.name,
          from: p.from == null ? ratio : p.from,
          to: ratio,
          by: "boss",
          at: "2026-10-27 15:20",
          note: "比例变更后需双方补签合作协议"
        });
        pushMsg(d, { icon: "file-text", type: "warn", title: "比例已变更，待补签协议：" + s.name, desc: "新约定比例 " + Math.round(ratio * 100) + "%，需与二级补签后生效", to: "#/subs" });
        save(); return ok();
      }

      /* ---------- 合作状态管理：暂停 / 恢复 / 终止（留痕 + 通知） ---------- */
      case "sub/setStatus": {
        if (!c.isBoss) return fail("仅管理员可管理合作状态");
        var st = d.subs.filter(function (x) { return x.id === p.id; })[0];
        if (!st) return fail("二级合作不存在");
        var to = p.to;
        if (["active", "suspended", "terminated"].indexOf(to) < 0) return fail("无效的合作状态");
        if (to === st.status) return fail("合作已是该状态");
        if (to === "active" && st.status !== "suspended") return fail("仅暂停中的合作可恢复");
        if (to === "terminated" && st.status === "terminated") return fail("合作已终止");
        if (!p.reason || !String(p.reason).trim()) return fail("请填写操作原因");
        var ST_LABEL = { suspended: "暂停", active: "恢复", terminated: "终止" };
        st.status = to;
        st.statusAt = new Date().toISOString().slice(0, 10);
        st.statusReason = String(p.reason).trim();
        d.statusLog = d.statusLog || [];
        d.statusLog.unshift({
          id: genId("sl"), subId: st.id, sub: st.name,
          to: to, reason: st.statusReason, by: "boss", at: st.statusAt
        });
        pushMsg(d, { icon: to === "terminated" ? "warn" : "bell", type: to === "terminated" ? "danger" : "warn",
          title: "合作" + ST_LABEL[to] + "：" + st.name, desc: st.statusReason, to: "#/subs" });
        save(); return ok();
      }

      /* ---------- 付款登记 / 确认 / 异议 / 冲销 ---------- */
      case "pay/addReg": {
        if (!c.isBoss) return fail("仅管理员可登记线下付款");
        var regs = p.layer === "1" ? d.payRegs1 : d.payRegs2;
        var calc = (p.layer === "1" ? d.calc1 : d.calc2);
        if (!p.data || !p.data.amount || Number(p.data.amount) <= 0) return fail("请填写正确金额");
        if (!p.data.vouchers || !p.data.vouchers.length) return fail("请上传付款凭证（凭证强制）");
        var confirmed = regsSum(regs, calc.id);
        var remain = calc.calcAmount - confirmed;
        if (Number(p.data.amount) > remain + 0.01) {
          return fail("登记金额 ¥" + Number(p.data.amount).toLocaleString() + " 超过未登记差额 ¥" + remain.toLocaleString() + "，请先冲销更正后再登记");
        }
        regs.push({
          id: genId("r"),
          calcId: calc.id,
          amount: Number(p.data.amount),
          method: p.data.method || "bank",
          date: p.data.date || "2026-10-27",
          vouchers: p.data.vouchers,
          registeredBy: "王建国",
          status: "pending_confirm",
          dueDay: p.layer === "1" ? 3 : 12,
          createdAt: "2026-10-27"
        });
        save(); return ok();
      }

      case "pay/confirm": {
        if (p.layer === "2") {
          if (!c.isOwner) return fail("仅二级管理员可确认");
          var r2 = d.payRegs.filter(function (x) { return x.id === p.id; })[0];
          if (!r2 || r2.status === "void") return fail("付款记录不存在");
          if (r2.status === "confirmed") return fail("该登记已确认，无需重复确认");
          if (r2.status === "disputed" && !p.verifiedNote) return fail("异议记录须填写线下核实说明后再确认");
          r2.status = "confirmed";
          r2.confirmedAt = "2026-10-27";
          r2.signMethod = p.signMethod || "record";
          r2.verifiedNote = p.verifiedNote || "";
          save(); return ok();
        }
        if (!c.isBoss) return fail("仅管理员可确认平台对账");
        var r1 = (p.layer === "1" ? d.payRegs1 : d.payRegs2).filter(function (x) { return x.id === p.id; })[0];
        if (!r1 || r1.status === "void") return fail("付款记录不存在");
        if (r1.status === "confirmed") return fail("该登记已确认，无需重复确认");
        if (r1.status === "disputed" && !p.verifiedNote) return fail("异议记录须填写线下核实说明后再确认");
        r1.status = "confirmed";
        r1.confirmedAt = "2026-10-27";
        r1.signMethod = p.signMethod || "record";
        r1.verifiedNote = p.verifiedNote || "";
        save(); return ok();
      }

      case "pay/dispute": {
        if (p.layer === "2") {
          if (!c.isOwner) return fail("仅二级管理员可提异议");
        } else if (!c.isBoss) return fail("仅管理员可对平台对账提异议");
        if (!p.reason) return fail("请填写异议说明");
        var rd = (p.layer === "2" ? d.payRegs : (p.layer === "1" ? d.payRegs1 : d.payRegs2))
          .filter(function (x) { return x.id === p.id; })[0];
        if (!rd || rd.status === "void") return fail("付款记录不存在");
        rd.status = "disputed";
        rd.reason = p.reason;
        rd.disputedAt = "2026-10-27";
        save(); return ok();
      }

      case "pay/void": {
        if (!c.isBoss) return fail("仅管理员可冲销/作废登记");
        var rv = (p.layer === "1" ? d.payRegs1 : d.payRegs2).filter(function (x) { return x.id === p.id; })[0];
        if (!rv) return fail("付款记录不存在");
        if (rv.status === "confirmed") return fail("已确认记录不可冲销");
        rv.status = "void";
        rv.voidInfo = { reason: p.reason || "信息登记错误，冲销后重登", at: "2026-10-27", by: "王建国" };
        save(); return ok();
      }

      case "stmt/balance": {
        if (!c.isBoss) return fail("仅管理员可月度平账");
        var regsB = p.layer === "1" ? d.payRegs1 : d.payRegs2;
        var calcB = p.layer === "1" ? d.calc1 : d.calc2;
        var stmts = d.statements;
        var st = stmts.filter(function (x) { return x.calcId === calcB.id; })[0];
        if (!st || st.status !== "open") return fail("对账单不存在或已平账");
        var rel = regsB.filter(function (r) { return r.calcId === calcB.id; });
        if (rel.some(function (r) { return r.status === "disputed"; })) return fail("存在未闭环异议，不能平账");
        if (rel.some(function (r) { return r.status === "pending_confirm"; })) return fail("存在待确认登记，不能平账");
        var sum = regsSum(regsB, calcB.id);
        if (calcB.calcAmount - sum !== 0) return fail("差异未清零，不能平账");
        st.status = "balanced";
        st.balancedAt = "2026-10-27";
        st.balancedBy = "王建国";
        save(); return ok();
      }

      /* ---------- 协议（二级） ---------- */
      case "agree/sign": {
        if (!c.isOwner) return fail("仅二级管理员可签署");
        var ag = d.agreement;
        if (!ag || (ag.state !== "pending_mine")) return fail("当前协议无需签署");
        if (!p.confirmed) return fail("请先完整阅读并勾选确认");
        ag.state = "signed";
        ag.signedAt = "2026-10-27";
        ag.signerName = d.profile.contact || "负责人";
        save(); return ok();
      }

      case "agree/reject": {
        if (!c.isOwner) return fail("仅二级管理员可拒签");
        if (!p.reason) return fail("请填写拒签原因");
        var ar = d.agreement;
        if (!ar || ar.state !== "pending_mine") return fail("当前协议不可拒签");
        ar.state = "rejected";
        ar.rejectReason = p.reason;
        ar.rejectedAt = "2026-10-27";
        save(); return ok();
      }

      case "agree/resend": {
        if (!c.isBoss) return fail("仅省代管理员可重新发起协议");
        /* 按 id 定位目标二级（单卡/批量均传 id）；未传时回退第一家生效中（兼容旧调用） */
        var target = null;
        if (p.id) {
          var hit = d.subs.filter(function (x) { return x.id === p.id && x.status === "active"; })[0];
          if (hit) target = hit;
        } else {
          target = d.subs.filter(function (x) { return x.status === "active"; })[0];
        }
        if (!target) return fail("没有可重新发起协议的二级企业");
        pushMsg(d, { icon: "file-text", type: "info", title: "协议已重新发起：" + target.name, desc: "已通知二级企业重新查阅并签署", to: "#/subs" });
        d.ratioLog = d.ratioLog || [];
        d.ratioLog.unshift({ id: genId("rl"), subId: target.id, sub: target.name, act: "resend", by: "boss", at: new Date().toLocaleString("zh-CN", { hour12: false }) });
        save(); return ok();
      }

      /* ---------- 提醒（落消息留痕） ---------- */
      case "msg/add": {
        if (!c.isBoss && !c.isOwner) return fail("无权限发送提醒");
        pushMsg(d, p.msg || { icon: "bell", type: "info", title: "提醒", desc: "" });
        save(); return ok();
      }

      default:
        return fail("未知动作：" + type);
    }
  }

  function pushMsg(d, m) {
    d.msgLog = d.msgLog || [];
    d.msgLog.unshift(Object.assign({ time: "刚刚" }, m));
    if (d.msgLog.length > 20) d.msgLog.length = 20;
  }

  window.V3 = window.V3 || {};
  window.V3.store = {
    LS_KEY: LS_KEY,
    CONST: CONST,
    genAgentCode: genAgentCode,
    genChannelCode: genChannelCode,
    calcFinance: calcFinance,
    subSettle: subSettle,
    funnelOf: funnelOf,
    consumeOf: consumeOf,
    regsSum: regsSum,
    regsAllSum: regsAllSum,
    monthlyStatement: monthlyStatement,
    todoOf: todoOf,
    messagesOf: messagesOf,
    activitiesOf: activitiesOf,
    seed: seed,
    getState: getState,
    reset: reset,
    save: save,
    load: load,
    currentScenario: currentScenario,
    act: act
  };
})();
