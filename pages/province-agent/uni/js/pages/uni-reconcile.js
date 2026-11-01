/* ============================================================
   uni-reconcile.js · 对账中心（省代，modes=['province']）
   ------------------------------------------------------------
   信息架构：吸顶「卷宗切换（卷宗01 我与平台 / 卷宗02 我与二级）」
   + 视图分段（核对 / 明细 / 分析），一屏内完成
   「看状态 → 处理待办 → 逐笔核对 → 平账留痕」的闭环。

   核对：卷宗状态带（未结清 / 金额构成 / 台账 / 时限 / 进度轴 / 下一步）
         + 待办登记（按层给出唯一正确动作）+ 逐笔核对（口径公式 + 前置门槛）
   明细：状态筛选 + 按月分组登记流水 + 对账单 + 对账历史入口
   分析：差异归因 + 时效与进度 + 风险提示 + 月度对照

   财务口径（本页唯一计算源 bandModel，按 status 分桶，不做单值相减）：
     bill      账单金额
     conf      已确认到账（confirmed 合计）
     pend      待确认到账（pending_confirm 合计）
     disp      争议待核（disputed 合计）
     regSum    已登记（不含冲销 void）
     overReg   超登 = max(regSum − bill, 0)，平账不采纳
     gap       未登记 = max(bill − regSum, 0)
     unsettled 未结清 = max(bill − conf, 0)  ← 全页唯一对外口径
   旧口径 diff = bill − regsSum(不含 void/争议) 会把争议金额同时算进「差额」
   与「已登记」，诱发重复登记，本页已废弃。

   动作矩阵（与 store 契约一致，不放假按钮）：
     L1 待确认 → 「提出异议」随时可用（异议是升级动作，不该被门槛挡住）；
                 逐笔核对 100% 后才给「核对无误·确认」（确认是放款动作，必须先验完）
     L1 异议   → 「线下核实后确认」(须填核实说明) / 「冲销重登」
     L2 待确认 → 「提醒二级确认」（layer=2 的确认仅 sub_admin 可执行）
     L2 异议   → 「冲销作废」，核实确认在二级端完成
     两卷宗   → 平账（差异清零且无待办登记后方可）
   S1 铁律：全页仅一行 `Uni.stateVariantFor(STATE_VARIANTS, ctx.identity)`。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui, Uni = window.Uni;

  var METHOD = { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" };
  var REG_CLS = { pending_confirm: "wait", confirmed: "ok", disputed: "bad", void: "mute" };
  var LAYER = {
    "1": { no: "卷宗01", dir: "平台 → 省代", short: "我与平台", who: "平台" },
    "2": { no: "卷宗02", dir: "省代 → 二级", short: "我与二级企业", who: "二级企业" }
  };
  /* 卷宗状态机（文字承载语义，颜色只做强化） */
  var STATE = {
    balanced: { t: "已平账", cls: "ok", tone: "ok" },
    locked: { t: "已锁定", cls: "bad", tone: "bad" },
    empty: { t: "未出账", cls: "mute", tone: "mute" },
    disputed: { t: "有异议", cls: "bad", tone: "bad" },
    pending: { t: "待确认", cls: "wait", tone: "wait" },
    ready: { t: "待平账", cls: "gold", tone: "ok" },
    progress: { t: "待登记", cls: "info", tone: "wait" }
  };
  var VIEWS = [{ k: "check", t: "核对" }, { k: "list", t: "明细" }, { k: "insight", t: "分析" }];
  var FILTERS = [["all", "全部"], ["pending_confirm", "待确认"], ["confirmed", "已确认"], ["disputed", "有异议"], ["void", "已作废"]];
  var STATUS_NOTE = {
    suspended: "当前合作状态为「已暂停」，对账台账仍可查看，登记、异议、确认与平账已锁定；恢复合作后自动解锁。",
    terminated: "当前合作状态为「已终止」，对账台账转为归档只读。"
  };
  /* 演示当日：与 store 动作时间戳（2026-10-27）、种子消息时间保持同一时间线，
     保证 10 月卷宗处于「对账进行中」而非永久逾期锁定（真机接入后取系统时间）。 */
  var DEMO_TODAY = "2026-10-27";

  /* ---------- 文件级视图状态（actGuarded 全量重挂载后保持所在卷宗/视图） ---------- */
  var _tab = "1", _view = "check", _filter = "all";
  var _focusPending = true, _comingFromTodo = false;

  /* ============================================================
     一、时间与金额工具
     ============================================================ */
  function d0(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  /* 距今（演示当日）多少天：正数=已过去，负数=尚未到 */
  function daysSince(s) {
    var a = d0(s), b = d0(DEMO_TODAY);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }
  function daysTo(s) { return daysSince(s) === null ? null : -daysSince(s); }
  function mmdd(s) { return s ? String(s).slice(5, 10) : ""; }
  function monthOf(r) { return String((r && r.date) || "").slice(0, 7); }
  function layerOfCalcId(id) { var m = /-l([12])$/.exec(String(id || "")); return m ? m[1] : "1"; }

  /* 逐笔核对状态（Uni.detailState：v2 持久化，跨页生效） */
  function checkedIds(calcId) { return (Uni.detailState.get(calcId) || []).map(function (r) { return r.id; }); }
  function toggleChecked(calcId, id) {
    var on = checkedIds(calcId).indexOf(id) < 0;
    Uni.detailState.set(calcId, id, on ? "checked" : null, (Uni.getCtx() || {}).identity || "admin");
    return on;
  }
  function checkedCount(calc) {
    var ids = checkedIds(calc.id);
    return ((calc && calc.detail) || []).filter(function (d) { return ids.indexOf(d.id) > -1; }).length;
  }
  function allCheckedOf(calc) {
    var dl = (calc && calc.detail) || [];
    if (!dl.length) return true; /* 无明细不设门槛 */
    return checkedCount(calc) === dl.length;
  }

  /* ============================================================
     二、身份变体（S1：唯一身份分支）
     ============================================================ */
  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function () { return { canAct: true, note: null }; },
      entries: [], perms: { act: true }, badges: {}, empty: {},
      lockedNote: "登记、异议、确认与平账均已锁定"
    },
    legal_rep: {
      label: "省级总代 · 法定代表人",
      data: function () {
        return { canAct: false, note: "法定代表人视角：可查看全部对账台账、凭证与留痕；登记付款、提出异议、确认到账与月度平账仅管理员可执行。" };
      },
      entries: [], perms: { act: false }, badges: {}, empty: {},
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function () {
        return { canAct: false, note: "员工视角：对账台账与凭证仅可查看；登记付款、提出异议、确认到账与月度平账仅管理员可操作。" };
      },
      entries: [], perms: { act: false }, badges: {}, empty: {},
      lockedNote: "全部对账动作已锁定，仅可查看"
    },
    sub_admin: {
      /* 本路由仅 province 模式可达；此处仅为 schema 完整性 */
      label: "二级合作企业 · 管理员",
      data: function () { return { canAct: false, note: null }; },
      entries: [], perms: { act: false }, badges: {}, empty: {},
      lockedNote: null
    }
  };

  /* ============================================================
     三、卷宗模型（全页唯一计算源）
     ============================================================ */
  function bandModel(ctx, layer) {
    var s = ctx.s || {};
    var calc = (layer === "1" ? s.calc1 : s.calc2) ||
      { id: layer === "1" ? "c1-l1" : "c1-l2", month: "", calcAmount: 0, detail: [] };
    var regs = (layer === "1" ? s.payRegs1 : s.payRegs2) || [];
    var stmts = (s.statements || []).filter(function (x) { return layerOfCalcId(x.calcId) === layer; });
    var st = (s.statements || []).filter(function (x) { return x.calcId === calc.id; })[0] || null;

    var cur = regs.filter(function (r) { return r.calcId === calc.id; });
    var hist = regs.filter(function (r) { return r.calcId !== calc.id; });

    var bill = Number(calc.calcAmount || 0);
    var confSum = 0, pendSum = 0, dispSum = 0, regSum = 0;
    cur.forEach(function (r) {
      var a = Number(r.amount || 0);
      if (r.status === "void") return;
      regSum += a;
      if (r.status === "confirmed") confSum += a;
      else if (r.status === "disputed") dispSum += a;
      else pendSum += a;
    });
    var pend = cur.filter(function (r) { return r.status === "pending_confirm"; });
    var disp = cur.filter(function (r) { return r.status === "disputed"; });
    var conf = cur.filter(function (r) { return r.status === "confirmed"; });

    var overReg = Math.max(regSum - bill, 0);
    var gap = Math.max(bill - regSum, 0);
    var unsettled = Math.max(bill - confSum, 0);

    var remain = daysTo(calc.dueAt);
    var balanced = !!(st && st.status === "balanced");
    var overdue = !balanced && remain !== null && remain < 0;
    var isEmpty = bill <= 0 && !cur.length;
    var ready = !balanced && bill > 0 && !disp.length && !pend.length &&
      Math.abs(confSum - bill) < 0.005 && Math.abs(regSum - confSum) < 0.005;

    var state;
    if (balanced) state = "balanced";
    else if (isEmpty) state = "empty";
    else if (overdue) state = "locked";
    else if (disp.length) state = "disputed";
    else if (pend.length) state = "pending";
    else if (ready) state = "ready";
    else state = "progress";

    /* 历史月已确认合计（月度对照） */
    var prevConf = 0;
    hist.forEach(function (r) { if (r.status === "confirmed") prevConf += Number(r.amount || 0); });

    return {
      layer: layer, L: LAYER[layer], calc: calc, st: st, stmts: stmts,
      cur: cur, hist: hist, detail: calc.detail || [],
      bill: bill, confSum: confSum, pendSum: pendSum, dispSum: dispSum, regSum: regSum,
      pend: pend, disp: disp, conf: conf,
      overReg: overReg, gap: gap, unsettled: unsettled,
      remain: remain, balanced: balanced, locked: overdue, overdue: overdue,
      isEmpty: isEmpty, ready: ready, state: state, prevConf: prevConf,
      overPaid: confSum - bill > 0.005
    };
  }

  function metaOf(bm) { return STATE[bm.state] || STATE.progress; }

  /* 停留天数（超期判定：以登记自身 dueDay 处理期为限）
     · 争议行以提出异议当日计时，待确认行以登记当日计时 */
  function stayAt(r) {
    return (r.status === "disputed" ? (r.disputedAt || r.createdAt) : (r.createdAt || r.date)) || "";
  }
  function maxStay(list) {
    var n = 0;
    list.forEach(function (r) { var d = daysSince(stayAt(r)); if (d !== null && d > n) n = d; });
    return n;
  }
  function staleHint(r) {
    var n = daysSince(stayAt(r)), lim = Number(r.dueDay || 0);
    if (n === null || !lim || n <= lim) return "";
    return '<div class="ur-gate">' + ui.icon("alert-circle", 13) +
      "<span>已停留 " + n + " 天，超出 " + lim + " 天处理期。</span></div>";
  }

  /* ============================================================
     四、通用片段
     ============================================================ */
  function sechead(lbl, right, tight) {
    return '<div class="uh-sechead" style="margin:' + (tight ? "2px 0 10px" : "0 0 12px") + '">' +
      '<span class="lbl">' + lbl + "</span>" +
      (right ? '<span style="display:flex;align-items:center;gap:8px">' + right + "</span>" : "") +
      "</div>";
  }
  function kv(k, v, tone, tail) {
    return '<div class="uh-kv"><span class="k">' + k + (tail ? "<em>" + tail + "</em>" : "") + "</span>" +
      '<span class="v' + (tone ? " v--" + tone : "") + '">' + v + "</span></div>";
  }
  function dueBox(tone, ic, text) {
    return '<div class="ur-due ur-due--' + tone + '">' + ui.icon(ic, 14) + "<span>" + ui.esc(text) + "</span></div>";
  }
  function pct(a, b) { return (Math.round((b ? a / b : 0) * 1000) / 10) + "%"; }

  /* ============================================================
     五、吸顶导航（卷宗切换 + 视图分段）
     ============================================================ */
  function navHtml(b1, b2) {
    var cur = _tab === "2" ? b2 : b1;
    var todoN = cur.pend.length + cur.disp.length;
    return '<section class="ur-nav">' +
      '<div class="ur-switch" role="tablist" aria-label="对账卷宗">' +
      [b1, b2].map(function (b) {
        var M = metaOf(b), on = b.layer === _tab;
        return '<button type="button" role="tab" aria-selected="' + on + '" class="ur-switch__i' + (on ? " is-on" : "") +
          '" data-tab="' + b.layer + '">' +
          '<span class="ur-switch__n">' + LAYER[b.layer].no + "</span>" +
          '<span class="ur-switch__s">' + LAYER[b.layer].short + ' · <b class="ur-t-' + M.tone + '">' + M.t + "</b></span>" +
          "</button>";
      }).join("") +
      "</div>" +
      '<div class="ur-views" role="tablist" aria-label="视图">' +
      VIEWS.map(function (v) {
        var on = _view === v.k;
        var dot = (v.k === "check" && todoN > 0) ? '<i class="ur-view__dot"></i>' : "";
        return '<button type="button" role="tab" aria-selected="' + on + '" class="ur-view' + (on ? " is-on" : "") +
          '" data-view="' + v.k + '">' + v.t + dot + "</button>";
      }).join("") +
      "</div></section>";
  }

  /* ============================================================
     六、核对视图 · 卷宗状态带
     ============================================================ */
  function heroHtml(bm, actOk, who) {
    var M = metaOf(bm), L = LAYER[bm.layer];
    var h = '<section class="card uh-sec" data-band="' + bm.layer + '">' +
      '<div class="ur-hero__top">' +
      '<span class="ur-tier ur-tier--' + (bm.layer === "1" ? "in" : "out") + '">' + L.dir + "</span>" +
      '<span class="ur-hero__mon">' + ui.esc(bm.calc.month || "—") + " 账期</span>" +
      '<span class="uh-badge uh-badge--' + M.cls + '">' + M.t + "</span>" +
      "</div>" +
      (bm.isEmpty ? '<div class="ur-hero__lab">本月未出账</div>'
        : '<div class="ur-hero__lab">未结清 <em>账单 − 已确认到账</em></div>') +
      '<div class="uh-bignum" data-count="' + bm.unsettled + '">' + ui.moneyD(0) + "</div>";

    /* 金额构成条：以 max(账单, 已登记) 归一，超登时在账单处画基准线 */
    if (bm.bill > 0) {
      var denom = Math.max(bm.bill, bm.regSum) || 1;
      var segs = [];
      if (bm.confSum) segs.push(["ok", bm.confSum]);
      if (bm.pendSum) segs.push(["wait", bm.pendSum]);
      if (bm.dispSum) segs.push(["bad", bm.dispSum]);
      if (bm.gap) segs.push(["gap", bm.gap]);
      h += '<div class="ur-comp">' + segs.map(function (x) {
        return '<i class="ur-comp__seg ur-comp__s--' + x[0] + '" data-w="' + pct(x[1], denom) + '"></i>';
      }).join("") + (bm.overReg > 0
        ? '<i class="ur-comp__mark" style="left:' + pct(bm.bill, denom) + '"></i>' : "") + "</div>";

      var lg = [["ok", "已确认", bm.confSum]];
      if (bm.pendSum) lg.push(["wait", "待确认", bm.pendSum]);
      if (bm.dispSum) lg.push(["bad", "争议", bm.dispSum]);
      if (bm.gap) lg.push(["gap", "未登记", bm.gap]);
      h += '<div class="ur-legend">' + lg.map(function (x) {
        return '<span class="ur-legend__i"><i class="ur-dot ur-dot--' + x[0] + '"></i>' + x[1] + " " + ui.money(x[2]) + "</span>";
      }).join("") + "</div>";
    }

    if (!bm.isEmpty) {
      var rows = kv("账单金额", ui.money(bm.bill));
      rows += kv("已确认到账", ui.money(bm.confSum), bm.confSum > 0 ? "ok" : "mute", bm.conf.length ? bm.conf.length + " 笔" : "");
      if (bm.pendSum) rows += kv("待确认到账", ui.money(bm.pendSum), "wait", bm.pend.length + " 笔");
      if (bm.dispSum) rows += kv("争议待核", ui.money(bm.dispSum), "bad", bm.disp.length + " 笔");
      if (bm.gap) rows += kv("未登记", ui.money(bm.gap), "wait", "待补登记");
      if (bm.overReg) rows += kv("超登", ui.money(bm.overReg), "bad", "平账不采纳");
      h += '<div class="ur-ledger">' + rows + "</div>";
      h += dueHtml(bm);
      h += lifeHtml(bm);
    }
    var nx = nextOf(bm, actOk, who);
    h += '<div class="ur-next ' + nx.cls + '">' + nx.t + "</div>";
    return h + "</section>";
  }

  function dueHtml(bm) {
    if (bm.isEmpty) return "";
    if (bm.balanced) {
      var at = bm.st && bm.st.balancedAt ? " · " + mmdd(bm.st.balancedAt) : "";
      var by = bm.st && bm.st.balancedBy ? " · " + bm.st.balancedBy + " 确认" : "";
      return dueBox("ok", "check-circle", "已平账" + at + by);
    }
    if (bm.locked) return dueBox("over", "lock", "对账窗口已于 " + mmdd(bm.calc.dueAt) + " 关闭 · 本月锁定只读");
    var d = bm.remain;
    if (d === null) return "";
    if (d === 0) return dueBox("warn", "clock", "今天 23:59 截止对账 · 请完成核对后平账");
    if (d <= 2) return dueBox("warn", "clock", "仅剩 " + d + " 天 · 对账截止 " + mmdd(bm.calc.dueAt));
    return dueBox("ok", "clock", "剩余 " + d + " 天 · 对账截止 " + mmdd(bm.calc.dueAt));
  }

  /* 账务进度轴：出账 → 登记 → 确认 → 平账（各带日期，当前节点高亮） */
  function lifeHtml(bm) {
    var regDate = "";
    bm.cur.forEach(function (r) {
      if (r.status === "void") return;
      var d = r.createdAt || r.date;
      if (d && d > regDate) regDate = d;
    });
    var confDate = "";
    bm.conf.forEach(function (r) { if (r.confirmedAt && r.confirmedAt > confDate) confDate = r.confirmedAt; });
    var steps = [
      { t: "出账", d: bm.calc.issueAt || "", done: !!bm.calc.issueAt },
      { t: "登记", d: regDate, done: bm.regSum > 0 },
      { t: "确认", d: confDate, done: bm.bill > 0 && bm.confSum + 0.005 >= bm.bill },
      { t: "平账", d: bm.balanced ? ((bm.st && bm.st.balancedAt) || "") : "", done: bm.balanced }
    ];
    var at = -1;
    for (var i = 0; i < steps.length; i++) { if (!steps[i].done) { at = i; break; } }
    return '<div class="ur-life">' + steps.map(function (s, i) {
      var cls = s.done ? " is-done" : (i === at ? " is-cur" : "");
      return '<div class="ur-life__s' + cls + '"><span class="dot"></span>' +
        '<span class="lb">' + s.t + "</span>" +
        '<span class="dt">' + (mmdd(s.d) || "—") + "</span></div>";
    }).join("") + "</div>";
  }

  /* 下一步：把状态翻译成一句话执行路径。三种口吻（who）：
     self  — 有操作权：给出按钮名（指令式，「点【…】」）；
     admin — 页面只读（法代/员工）：陈述「待管理员…」，不描述他们点不到的按钮；
     none  — 账号状态受限（暂停/终止）自身不可操作：去主语陈述，避免让管理员
             「等自己」。 */
  function nextOf(bm, canAct, who) {
    var M = ui.money, self = canAct, blocked = who === "none";
    if (bm.balanced) return { cls: "is-ok", t: "已平账留痕，本月无待办；下月出账后自动生成新卷宗。" };
    if (bm.isEmpty) return { cls: "is-mute", t: "平台尚未出账，出账后自动生成本月卷宗。" };
    if (bm.locked) return { cls: "is-warn", t: "已过对账截止日，本月锁定只读；如需修正请联系平台运营发起线下调整。" };
    if (bm.disp.length) {
      if (bm.layer === "1") {
        if (self) return { cls: "is-warn", t: "先线下核实争议 <b>" + M(bm.dispSum) + "</b>：核实无误点【线下核实后确认】，金额不符点【冲销重登】后按实际金额重登。" };
        return { cls: "is-warn", t: (blocked ? "争议 <b>" : "待管理员线下核实争议 <b>") + M(bm.dispSum) + "</b>：核实无误后确认到账，金额不符则冲销后按实际金额重登。" };
      }
      if (self) return { cls: "is-warn", t: "二级已就 <b>" + M(bm.dispSum) + "</b> 提异议：核实后由二级端确认；如登记有误，在本页【冲销作废】后按实际金额重登。" };
      return { cls: "is-warn", t: blocked
        ? "二级已就 <b>" + M(bm.dispSum) + "</b> 提异议，待核实：由二级端确认，或冲销作废后按实际金额重登。"
        : "二级已就 <b>" + M(bm.dispSum) + "</b> 提异议，待核实：二级端确认，或由管理员冲销作废后按实际金额重登。" };
    }
    if (bm.pend.length) {
      if (bm.layer === "1") {
        var left = bm.detail.length - checkedCount(bm.calc);
        var tail = (left > 0 ? "（还剩 " + left + " 笔）" : "已完成");
        if (self) return { cls: "is-warn", t: "逐笔核对" + tail + "后确认到账 <b>" + M(bm.pendSum) + "</b>；确认后即可平账。" };
        return { cls: "is-warn", t: (blocked ? "需先逐笔核对" + tail + "并确认到账 <b>" : "待管理员完成逐笔核对" + tail + "并确认到账 <b>") + M(bm.pendSum) + "</b>；确认后即可平账。" };
      }
      if (self) return { cls: "is-warn", t: "待二级企业确认 <b>" + M(bm.pendSum) + "</b>：二级确认在二级端完成，本页仅提醒；确认后回本页平账。" };
      return { cls: "is-warn", t: "待二级企业确认 <b>" + M(bm.pendSum) + "</b>：确认在二级端完成，" +
        (blocked ? "回本页即可平账。" : "管理员可在本页提醒；确认后即可平账。") };
    }
    if (bm.overPaid) {
      return { cls: "is-warn", t: "已确认金额超过账单 <b>" + M(bm.confSum - bm.bill) + "</b>，" +
        (self ? "请冲销超登登记后再平账。" : blocked ? "需冲销超登登记后方可平账。" : "待管理员冲销超登登记后再平账。") };
    }
    if (bm.ready) {
      return { cls: "is-ok", t: "账单与到账金额已对齐，" + (self ? "可执行<b>平账留痕</b>。" : blocked ? "可平账留痕。" : "待管理员执行平账留痕。") };
    }
    if (bm.gap > 0) {
      var tail2 = self ? "登记线下付款并上传凭证后进入确认环节。" : blocked ? "需补登记线下付款并上传凭证。" : "待管理员登记线下付款并上传凭证。";
      return { cls: "is-warn", t: "仍有 <b>" + M(bm.gap) + "</b> 未登记：" + tail2 };
    }
    return { cls: "is-mute", t: "本月无待办。" };
  }

  /* ============================================================
     七、核对视图 · 逐笔核对
     ============================================================ */
  function formulaOf(bm) {
    var base = Number(bm.calc.eligibleBase || 0);
    if (!base) bm.detail.forEach(function (d) { base += Number(d.amount || 0); });
    if (!base) return "";
    var gs = Number(bm.calc.grossShare || 0);
    var rs = Number(bm.calc.ratioToSub || 0);
    var factors = [];
    if (gs) factors.push(Math.round(gs * 100) + "%");
    if (rs) {
      if (!gs) factors.push(Math.round((bm.bill / (base * rs)) * 100) + "%"); /* 二级：平台分润段 */
      factors.push(Math.round(rs * 100) + "%");
    }
    if (!factors.length) factors.push(Math.round((bm.bill / base) * 100) + "%");
    return "口径：" + (bm.layer === "2" ? "二级" : "") + "合格消费 <b>" + ui.money(base) + "</b> × " +
      factors.join(" × ") + " = " + (bm.layer === "1" ? "应结" : "应付") + " <b>" + ui.money(bm.bill) + "</b>";
  }

  function checklistHtml(bm, actOk) {
    var dl = bm.detail;
    if (!dl.length) return "";
    var on = checkedIds(bm.calc.id), n = 0;
    var rows = dl.map(function (d) {
      var isOn = on.indexOf(d.id) > -1;
      if (isOn) n++;
      return '<button type="button" class="ur-oline' + (isOn ? " is-on" : "") + (actOk ? "" : " is-static") +
        '" data-dl="' + ui.esc(d.id) + '" data-layer="' + bm.layer + '"' +
        (actOk ? "" : ' aria-disabled="true"') + ">" +
        '<span class="ur-oline__ck">' + ui.icon("check", 12) + "</span>" +
        '<span class="ur-oline__main">' +
        '<span class="ur-oline__nm">' + ui.esc(d.user) + "</span>" +
        '<span class="ur-oline__meta">' + Uni.itemTag(d.item) + "<span>" + ui.esc(d.order) + " · " + ui.esc(d.date) + "</span></span>" +
        "</span>" +
        '<span class="ur-oline__amt">' + ui.money(d.amount) + "</span>" +
        "</button>";
    }).join("");

    var right = (actOk && n < dl.length
      ? '<button type="button" class="ur-mini" data-act="checkAll" data-layer="' + bm.layer + '">全部核对</button>' : "") +
      '<span class="uh-badge uh-badge--' + (n === dl.length ? "ok" : "wait") + '">已核对 ' + n + "/" + dl.length + "</span>";

    var f = formulaOf(bm);
    var gate = "";
    if (actOk && bm.layer === "1" && bm.pend.length) {
      gate = n === dl.length
        ? '<div class="ur-gate ur-gate--ok">' + ui.icon("check-circle", 13) + "<span>逐笔核对已全部完成，可确认到账。</span></div>"
        : '<div class="ur-gate">' + ui.icon("alert-circle", 13) + "<span>确认到账前须逐笔核对，还剩 " + (dl.length - n) + " 笔未核对。</span></div>";
    } else if (bm.balanced) {
      gate = '<div class="ur-gate ur-gate--ok">' + ui.icon("check-circle", 13) + "<span>本卷宗已平账，明细转为留痕档案。</span></div>";
    }

    return '<section class="card uh-sec" data-anchor="dl">' + sechead("逐笔核对", right, true) +
      rows + (f ? '<div class="ur-formula">' + f + "</div>" : "") + gate + "</section>";
  }

  /* ============================================================
     八、登记行（待办 / 明细共用）
     ============================================================ */
  function regRow(r, bm, actOk, withOps) {
    var badge = REG_CLS[r.status] || "mute";
    var vn = (r.vouchers || []).length;
    var h = '<div class="ur-reg' + (r.status === "void" ? " is-void" : "") + '">' +
      '<div class="ur-reg__hd">' +
      '<button type="button" class="ur-reg__tap" data-reg="' + ui.esc(r.id) + '">' +
      '<span class="ur-reg__top">' +
      '<span class="ur-reg__amt">' + ui.money(r.amount) + "</span>" +
      '<span class="uh-badge uh-badge--' + badge + '">' + ui.REG[r.status] + "</span>" +
      "</span>" +
      '<span class="ur-reg__meta">' + (METHOD[r.method] || "线下付款") + " · " + ui.esc(r.date) +
      " · 登记人 " + ui.esc(r.registeredBy || "—") + (vn ? " · 凭证 " + vn + " 张" : "") + "</span>" +
      "</button>" +
      (vn ? '<button type="button" class="ur-reg__doc" data-voucher="' + ui.esc(r.id) + '">' +
        ui.icon("receipt", 13) + "回单</button>" : "") +
      "</div>";
    if (r.reason) h += '<div class="ur-reg__why">异议：' + ui.esc(r.reason) + "</div>";
    if (r.verifiedNote) h += '<div class="ur-reg__why ur-reg__why--ok">核实：' + ui.esc(r.verifiedNote) + "</div>";
    if (r.voidInfo) h += '<div class="ur-reg__why ur-reg__why--void">已冲销：' + ui.esc(r.voidInfo.reason) + "（" + ui.esc(r.voidInfo.at || "") + "）</div>";
    if (withOps) h += opsHtml(r, bm, actOk);
    return h + "</div>";
  }

  /* 动作矩阵：不同层级 + 不同状态 → 唯一正确动作 */
  function opsHtml(r, bm, actOk) {
    if (!actOk || r.calcId !== bm.calc.id) return "";
    var id = ui.esc(r.id);
    if (bm.layer === "1") {
      if (r.status === "pending_confirm") {
        var gated = !allCheckedOf(bm.calc);
        return '<div class="btn-row ur-reg__ops">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="dispute" data-id="' + id + '">提出异议</button>' +
          (gated
            ? '<button type="button" class="btn btn-sm is-gated" data-act="goto-dl">先完成逐笔核对 ' +
              checkedCount(bm.calc) + "/" + bm.detail.length + "</button>"
            : '<button type="button" class="btn btn-primary btn-sm" data-act="confirm" data-id="' + id + '">核对无误·确认</button>') +
          "</div>";
      }
      if (r.status === "disputed") {
        return '<div class="btn-row ur-reg__ops">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="void" data-id="' + id + '">冲销重登</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-act="verify" data-id="' + id + '">线下核实后确认</button>' +
          "</div>" + staleHint(r);
      }
      return "";
    }
    if (r.status === "pending_confirm") {
      return '<div class="btn-row ur-reg__ops">' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="remind" data-id="' + id + '">提醒二级确认</button>' +
        "</div>" +
        '<div class="ur-gate">' + ui.icon("info", 13) +
        "<span>二级确认在二级端完成，本页仅提醒并留痕；二级确认后回本页平账。</span></div>" + staleHint(r);
    }
    if (r.status === "disputed") {
      return '<div class="btn-row ur-reg__ops">' +
        '<button type="button" class="btn btn-danger btn-sm" data-act="void" data-id="' + id + '">冲销作废</button>' +
        "</div>" +
        '<div class="ur-gate">' + ui.icon("info", 13) +
        "<span>二级端核实后由二级确认；如登记金额有误，冲销后按实际金额重登。</span></div>" + staleHint(r);
    }
    return "";
  }

  function todosHtml(bm, actOk) {
    var rows = bm.disp.concat(bm.pend);
    if (!rows.length) {
      return '<section class="card uh-sec" data-anchor="todo">' +
        sechead("待办登记", '<span class="uh-badge uh-badge--ok">无待办</span>', true) +
        '<div class="ur-empty">本月登记已全部闭环' +
        (bm.conf.length ? "（" + bm.conf.length + " 笔已确认）" : "") + "。</div></section>";
    }
    return '<section class="card uh-sec" data-anchor="todo">' +
      sechead("待办登记", '<span class="uh-badge uh-badge--wait">' + rows.length + " 笔</span>", true) +
      rows.map(function (r) { return regRow(r, bm, actOk, true); }).join("") +
      "</section>";
  }

  /* ============================================================
     九、明细视图
     ============================================================ */
  function listPanel(bm, ctx) {
    var all = bm.cur.concat(bm.hist).slice().sort(function (a, b) {
      if ((a.date || "") === (b.date || "")) return 0;
      return (a.date || "") < (b.date || "") ? 1 : -1;
    });
    var counts = { all: all.length };
    FILTERS.forEach(function (f) { if (f[0] !== "all") counts[f[0]] = 0; });
    all.forEach(function (r) { if (counts[r.status] !== undefined) counts[r.status]++; });

    var chips = '<section class="uh-sec"><div class="ur-chips">' + FILTERS.map(function (f) {
      return '<button type="button" class="ur-chip' + (_filter === f[0] ? " is-on" : "") + '" data-chip="' + f[0] + '">' +
        f[1] + "<b>" + (counts[f[0]] || 0) + "</b></button>";
    }).join("") + "</div></section>";

    var list = _filter === "all" ? all : all.filter(function (r) { return r.status === _filter; });
    var groups = {};
    list.forEach(function (r) { var m = monthOf(r) || "—"; (groups[m] = groups[m] || []).push(r); });
    var keys = Object.keys(groups).sort().reverse();

    var body = keys.map(function (m) {
      var isCur = m === (bm.calc.month || "");
      var stt = bm.stmts.filter(function (s) { return s.month === m; })[0];
      var tag = isCur ? " · 本月" : (stt && stt.status === "balanced" ? " · 已平账" : "");
      return '<div class="ur-subhead">' + m + tag + " · " + groups[m].length + " 笔</div>" +
        '<div class="card" style="padding:2px 14px">' +
        groups[m].map(function (r) { return regRow(r, bm, false, false); }).join("") + "</div>";
    }).join("");

    if (!list.length) {
      body = '<div class="card" style="padding:4px 14px"><div class="ur-empty">该筛选条件下暂无登记记录。</div></div>';
    }

    /* 对账单（本层全部账期；点击行 = 打开该期单据） */
    var stmts = bm.stmts.slice().sort(function (a, b) { return (a.month || "") < (b.month || "") ? 1 : -1; });
    var stmtRows = stmts.length ? stmts.map(function (s) {
      var ok = s.status === "balanced";
      var hrec = histRecOf(ctx, s, bm.layer);
      return '<button type="button" class="ur-stmt" data-stmt="' + ui.esc(s.month) + '"' +
        ' aria-label="查看 ' + ui.esc(s.month) + ' 对账单">' +
        '<span class="k">' + ui.esc(s.month) + " 账期</span>" +
        '<span class="v">' +
        (hrec ? "<b>" + ui.money(hrec.amount) + "</b>" : "") +
        '<span class="uh-badge uh-badge--' + (ok ? "ok" : "wait") + '">' + (ok ? "已平账" : "未平账") + "</span>" +
        ui.icon("chev-r", 15) + "</span></button>";
    }).join("") : '<div class="ur-empty">暂无对账单记录。</div>';

    return chips +
      '<section class="uh-sec">' + body + "</section>" +
      '<section class="card uh-sec">' + sechead("对账单", "", true) + stmtRows + "</section>" +
      '<section class="card uh-sec" style="padding:0 14px">' +
      '<a class="ur-link" href="reconcile-history.html"><span class="ur-link__t">对账历史</span>' +
      '<span class="ur-link__s">全部月份留痕</span>' + ui.icon("chev", 16) + "</a>" +
      "</section>";
  }

  /* ============================================================
     十、分析视图（差异归因 / 时效 / 风险 / 月度对照）
     ============================================================ */
  function fact(ic, tone, t, d, v, s) {
    return '<div class="ur-fact">' +
      '<span class="ur-fact__ic' + (tone ? " ur-fact__ic--" + tone : "") + '">' + ui.icon(ic, 15) + "</span>" +
      '<span class="ur-fact__b"><span class="ur-fact__t">' + t + "</span>" +
      '<span class="ur-fact__d">' + d + "</span></span>" +
      (v ? '<span class="ur-fact__v">' + v + (s ? "<small>" + s + "</small>" : "") + "</span>" : "") +
      "</div>";
  }

  function insightPanel(bm) {
    /* 1 · 差异归因 */
    var facts = [];
    if (bm.dispSum) {
      facts.push(fact("alert-circle", "bad", "争议待核 · " + bm.disp.length + " 笔",
        "已登记但金额/凭证存疑，不计入已确认；核实后确认或冲销重登。",
        ui.money(bm.dispSum), "停留 " + maxStay(bm.disp) + " 天"));
    }
    if (bm.pendSum) {
      facts.push(fact("clock", "wait", "待确认到账 · " + bm.pend.length + " 笔",
        "回单已上传，等待" + LAYER[bm.layer].who + "确认；确认后计入已确认。",
        ui.money(bm.pendSum), "停留 " + maxStay(bm.pend) + " 天"));
    }
    if (bm.gap) {
      facts.push(fact("doc", "wait", "未登记", "账单与登记之间仍有差额，需登记线下付款并上传凭证。",
        ui.money(bm.gap), "待补登记"));
    }
    if (bm.overReg) {
      facts.push(fact("warn", "bad", "超登", "登记总额超过应付，超登部分不会被平账采纳，须冲销多余登记。",
        ui.money(bm.overReg), "须冲销"));
    }
    if (bm.regSum > 0 && Math.abs(bm.regSum - bm.bill) < 0.005 && (bm.pendSum || bm.dispSum)) {
      facts.push(fact("reconcile", "ok", "账实相符",
        "登记总额 " + ui.money(bm.regSum) + " 与账单一致，差额全部来自确认环节，非漏登。"));
    }
    if (!facts.length) {
      facts.push(fact(bm.balanced ? "check-circle" : "reconcile", "ok",
        bm.balanced ? "已平账" : "无差异",
        bm.balanced ? "本月账单、登记、确认三方一致，已平账留痕。" : "账单与登记一致，可执行平账。"));
    }
    var card1 = '<section class="card uh-sec">' +
      sechead("差异归因", '<span class="uh-badge uh-badge--' + metaOf(bm).cls + '">' + metaOf(bm).t + "</span>", true) +
      facts.join("") + "</section>";

    /* 2 · 时效与进度 */
    var cover = bm.bill > 0 ? Math.min(bm.regSum / bm.bill, 1) : 0;
    var confRate = bm.bill > 0 ? Math.min(bm.confSum / bm.bill, 1) : 0;
    var tiles = '<div class="ur-tiles">' +
      tile("登记覆盖", Math.round(cover * 100) + "%", "已登记 " + ui.money(bm.regSum) + " / 账单 " + ui.money(bm.bill)) +
      tile("确认到账", Math.round(confRate * 100) + "%", "已确认 " + ui.money(bm.confSum)) +
      tile("逐笔核对", checkedCount(bm.calc) + "/" + bm.detail.length, "核对后解锁确认") +
      tile("距截止", bm.remain === null ? "—" : (bm.remain < 0 ? "已逾期" : bm.remain + " 天"), "截止 " + (mmdd(bm.calc.dueAt) || "—")) +
      "</div>";
    var ageRows = "";
    if (bm.disp.length) ageRows += kv("争议最长停留", maxStay(bm.disp) + " 天", "bad", "处理期 3 天");
    if (bm.pend.length) ageRows += kv("待确认最长停留", maxStay(bm.pend) + " 天", "wait", "处理期 " + (bm.pend[0] && bm.pend[0].dueDay ? bm.pend[0].dueDay : 3) + " 天");
    if (ageRows) ageRows = '<div class="ur-ledger" style="margin-top:12px">' + ageRows + "</div>";
    var card2 = '<section class="card uh-sec">' + sechead("时效与进度", "", true) + tiles + ageRows + "</section>";

    /* 3 · 风险提示（财务主管视角：只列需要动手的事） */
    var risks = [];
    if (bm.disp.length && maxStay(bm.disp) > 3) {
      risks.push(fact("alert-circle", "bad", "争议超期",
        ui.money(bm.dispSum) + " 的异议已停留 " + maxStay(bm.disp) + " 天，超出 3 天处理期" +
        (bm.bill ? "，占本月账单 " + Math.round(bm.dispSum / bm.bill * 100) + "%" : "") + "。",
        "", "需处理"));
    }
    if (bm.pend.length) {
      var pd = maxStay(bm.pend), lim = Number((bm.pend[0] && bm.pend[0].dueDay) || 3);
      if (pd > lim) risks.push(fact("clock", "wait", "确认超期",
        ui.money(bm.pendSum) + " 待确认已停留 " + pd + " 天，超出 " + lim + " 天确认期。", "", "需提醒"));
    }
    if (bm.overReg) {
      risks.push(fact("warn", "bad", "超登未冲销",
        "超登 " + ui.money(bm.overReg) + " 无法平账，须先冲销。", "", "需冲销"));
    }
    if (!bm.balanced && bm.remain !== null && bm.remain >= 0 && bm.remain <= 3) {
      risks.push(fact("clock", "wait", "临近截止",
        "距对账截止 " + mmdd(bm.calc.dueAt) + " 仅剩 " + bm.remain + " 天，逾期后本月锁定只读。", "", "需赶期"));
    }
    var card3 = '<section class="card uh-sec">' +
      sechead("风险提示", '<span class="uh-badge uh-badge--' + (risks.length ? "bad" : "ok") + '">' +
        (risks.length ? risks.length + " 项" : "无风险") + "</span>", true) +
      (risks.length ? risks.join("") : '<div class="ur-empty">按当前口径无超期、无超登，节奏正常。</div>') +
      "</section>";

    /* 4 · 月度对照 */
    var delta = bm.prevConf > 0 ? Math.round((bm.bill - bm.prevConf) / bm.prevConf * 100) : null;
    var cmp = kv("本月账单", ui.money(bm.bill), "ok") +
      kv("上月已确认", ui.money(bm.prevConf), "", delta === null ? "" : (delta >= 0 ? "+" : "") + delta + "%");
    var card4 = '<section class="card uh-sec">' + sechead("月度对照", "", true) + cmp + "</section>";

    return card1 + card2 + card3 + card4;
  }

  function tile(k, v, s) {
    return '<div class="ur-tile"><div class="ur-tile__k">' + k + '</div>' +
      '<div class="ur-tile__v">' + v + '</div>' +
      '<div class="ur-tile__s">' + s + "</div></div>";
  }

  /* ============================================================
     十一、页底口径说明
     ============================================================ */
  function rulesClauseHtml() {
    return '<div class="uh-clause"><div class="no">合格消费</div><div class="c">以平台月度合格消费账单为准；退货、退款、取消订单不计入。</div></div>' +
      '<div class="uh-clause"><div class="no">我与平台（第一层）</div><div class="c">T+5 工作日内可提出异议，双方补充凭证后线下核实闭环。</div></div>' +
      '<div class="uh-clause"><div class="no">我与二级企业（第二层）</div><div class="c">出账后 15 天内仅提醒，不自动确认、不自动到账；确认在二级端完成。</div></div>' +
      '<div class="uh-clause"><div class="no">平账条件</div><div class="c">无未闭环异议、无待确认登记、已登记与账单差异 ¥0 后方可月度平账留痕。</div></div>' +
      '<div class="uh-clause"><div class="no">凭证强制</div><div class="c">线下付款必须上传凭证；冲销、确认、平账均留痕可追溯。</div></div>';
  }
  function rulesCard() {
    return '<section class="uh-sec"><div class="card" style="padding:0 14px">' +
      '<button type="button" class="ur-link" data-act="rules">' +
      '<span class="ur-link__t">费用口径与对账规则</span>' +
      '<span class="ur-link__s">结算范围 · 时限</span>' + ui.icon("chev", 16) + "</button></div></section>";
  }

  /* ============================================================
     十二、页级粘性底栏（仅卷宗级动作）
     ============================================================ */
  function footHtml(bm, actOk) {
    if (!actOk) return "";
    if (bm.gap > 0) {
      return '<button type="button" class="btn btn-primary btn-sm" data-act="addreg" data-layer="' + bm.layer + '">登记线下付款</button>';
    }
    if (bm.ready) {
      return '<button type="button" class="btn btn-primary btn-sm" data-act="balance" data-layer="' + bm.layer + '">平账留痕</button>';
    }
    if (bm.layer === "2" && bm.pend.length) {
      return '<button type="button" class="btn btn-primary btn-sm" data-act="remind">提醒二级确认</button>';
    }
    return "";
  }

  /* ============================================================
     十三、弹窗
     ============================================================ */
  function regOf(ctx, id) {
    var all = (ctx.s.payRegs1 || []).concat(ctx.s.payRegs2 || []);
    return all.filter(function (r) { return r.id === id; })[0] || null;
  }
  /* 登记线下付款 */
  function registerSheet(ctx, Uni, bm) {
    var cap = Math.max(bm.gap, 0);
    var vouchers = [];
    var sh = Uni.sheet({
      title: "登记线下付款",
      body:
        '<div class="uh-sheetkv"><span class="k">' + (bm.layer === "1" ? "应结金额" : "应付金额") + '</span><span class="v">' + ui.money(bm.bill) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">已登记（不含冲销）</span><span class="v">' + ui.money(bm.regSum) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">可登记</span><span class="v">' + ui.money(cap) + "</span></div>" +
        '<div style="height:14px"></div>' +
        '<div class="field"><label class="field-label">金额<em class="req">*</em></label>' +
        '<input class="input" id="ur-amount" type="number" inputmode="decimal" value="' + cap + '"></div>' +
        '<div class="field"><label class="field-label">付款方式</label><div class="seg" data-pick>' +
        '<button type="button" class="seg-item active" data-v="bank">对公转账</button>' +
        '<button type="button" class="seg-item" data-v="wechat">微信/支付宝</button>' +
        '<button type="button" class="seg-item" data-v="cash">现金</button></div></div>' +
        '<div class="field"><label class="field-label">付款日期</label>' +
        '<input class="input" id="ur-date" type="date" value="' + DEMO_TODAY + '" max="' + DEMO_TODAY + '"></div>' +
        '<div class="field" style="margin-bottom:0"><label class="field-label">付款凭证<em class="req">*</em></label>' +
        '<div class="ur-upload" id="ur-voucher">' + ui.icon("camera", 22) + "<div>点击上传凭证图片</div></div>" +
        '<input type="file" id="ur-file" accept="image/*" hidden></div>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "提交登记", kind: "primary", onClick: function (sh) {
          var amount = Number(sh.querySelector("#ur-amount").value);
          var mit = sh.querySelector("[data-pick] .seg-item.active");
          var method = mit ? mit.getAttribute("data-v") : "bank";
          var date = sh.querySelector("#ur-date").value || DEMO_TODAY;
          if (!amount || amount <= 0) { Uni.toast("请填写正确金额", "err"); return false; }
          if (amount > cap + 0.01) { Uni.toast("超出可登记金额 " + ui.money(cap), "err"); return false; }
          if (!vouchers.length) { Uni.toast("请上传付款凭证（凭证强制）", "err"); return false; }
          var r = Uni.actGuarded("pay/addReg", { layer: bm.layer, data: { amount: amount, method: method, date: date, vouchers: vouchers } });
          if (!r.ok) return false;
          Uni.toast("已提交登记，待确认到账", "ok");
        }
      }]
    });
    var up = sh.querySelector("#ur-voucher"), file = sh.querySelector("#ur-file");
    up.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      ui.fileToVoucher(f).then(function (v) {
        vouchers.push(v);
        up.innerHTML = ui.icon("image", 20) + "<div>" + ui.esc(v.name) + "</div>";
        up.style.color = "var(--text-2)";
      });
    });
    sh.querySelectorAll("[data-pick] .seg-item").forEach(function (b) {
      b.addEventListener("click", function () {
        sh.querySelectorAll("[data-pick] .seg-item").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
      });
    });
  }

  /* 登记详情（留痕全貌） */
  function regDetailSheet(ctx, Uni, bm, rec, actOk) {
    var badge = REG_CLS[rec.status] || "mute";
    var mine = rec.calcId === bm.calc.id;
    var canVoid = actOk && mine && rec.status !== "confirmed" && rec.status !== "void";
    var body =
      '<div class="uh-finhead" style="margin-bottom:4px"><span class="uh-eyebrow">' +
      (mine ? ui.esc(bm.calc.month || "") + " 账期 · 本月" : "历史账期") + '</span>' +
      '<span class="uh-badge uh-badge--' + badge + '">' + ui.REG[rec.status] + "</span></div>" +
      '<div class="uh-bignum" style="font-size:28px">' + ui.moneyD(rec.amount) + "</div>" +
      '<div style="height:12px"></div>' +
      '<div class="uh-sheetkv"><span class="k">付款方式</span><span class="v">' + (METHOD[rec.method] || "线下付款") + "</span></div>" +
      '<div class="uh-sheetkv"><span class="k">付款日期</span><span class="v">' + ui.esc(rec.date) + "</span></div>" +
      '<div class="uh-sheetkv"><span class="k">登记人</span><span class="v">' + ui.esc(rec.registeredBy || "—") + "</span></div>" +
      '<div class="uh-sheetkv"><span class="k">登记时间</span><span class="v">' + ui.esc(rec.createdAt || rec.date) + "</span></div>" +
      (rec.confirmedAt ? '<div class="uh-sheetkv"><span class="k">确认时间</span><span class="v">' + ui.esc(rec.confirmedAt) +
        (rec.signMethod === "esign" ? " · 电子签" : " · 记录确认") + "</span></div>" : "") +
      (rec.disputedAt ? '<div class="uh-sheetkv"><span class="k">异议时间</span><span class="v">' + ui.esc(rec.disputedAt) + "</span></div>" : "") +
      (rec.reason ? '<div class="ur-reg__why" style="margin-top:12px">异议：' + ui.esc(rec.reason) + "</div>" : "") +
      (rec.verifiedNote ? '<div class="ur-reg__why ur-reg__why--ok" style="margin-top:8px">核实：' + ui.esc(rec.verifiedNote) + "</div>" : "") +
      (rec.voidInfo ? '<div class="ur-reg__why ur-reg__why--void" style="margin-top:8px">冲销：' + ui.esc(rec.voidInfo.reason) +
        "（" + ui.esc(rec.voidInfo.at || "") + "）</div>" : "") +
      ((rec.vouchers || []).length
        ? '<button type="button" class="btn btn-ghost btn-block" id="ur-doc" style="margin-top:14px">' +
          ui.icon("receipt", 16) + " 查看付款凭证</button>" : "");

    var ft = [{ t: "关闭", kind: "ghost" }];
    if (canVoid) {
      ft.push({
        t: "冲销该登记", kind: "danger", onClick: function (sh) {
          sh.close();
          voidSheet(ctx, Uni, bm, rec);
          return false;
        }
      });
    }
    var sh = Uni.sheet({ title: "登记详情", body: body, footer: ft });
    var doc = sh.querySelector("#ur-doc");
    if (doc) doc.addEventListener("click", function () {
      var v = (rec.vouchers || [])[0];
      if (v) Uni.voucherCenter(v);
    });
  }

  /* 冲销（必填原因，留痕） */
  function voidSheet(ctx, Uni, bm, rec) {
    Uni.sheet({
      title: "冲销该登记",
      body:
        '<div class="uh-sheetkv"><span class="k">登记金额</span><span class="v">' + ui.money(rec.amount) + "</span></div>" +
        '<div class="uh-readnote" style="margin:12px 0">冲销后该笔登记作废并保留留痕，可按实际金额重新登记；已确认记录不可冲销。</div>' +
        '<div class="field" style="margin-bottom:0"><label class="field-label">冲销原因<em class="req">*</em></label>' +
        '<textarea class="textarea" id="ur-void-why" placeholder="例如：回单金额登记有误，按实际 ¥4,520 重新登记"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "确认冲销", kind: "danger", onClick: function (sh) {
          var why = (sh.querySelector("#ur-void-why").value || "").trim();
          if (!why) { Uni.toast("请填写冲销原因", "err"); return false; }
          var r = Uni.actGuarded("pay/void", { layer: bm.layer, id: rec.id, reason: why });
          if (!r.ok) return false;
          Uni.toast("已冲销，可按实际金额重新登记", "ok");
        }
      }]
    });
  }

  /* 确认到账（留痕方式可选；L1 需先完成逐笔核对） */
  function confirmSheet(ctx, Uni, bm, rec) {
    var cid = bm.calc.id;
    var sh = Uni.sheet({
      title: "确认到账",
      body:
        '<div class="uh-finhead" style="margin-bottom:4px"><span class="uh-eyebrow">本次确认</span></div>' +
        '<div class="uh-bignum" style="font-size:28px">' + ui.moneyD(rec.amount) + "</div>" +
        '<div style="height:12px"></div>' +
        '<div class="uh-sheetkv"><span class="k">付款方式</span><span class="v">' + (METHOD[rec.method] || "线下付款") + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">付款日期</span><span class="v">' + ui.esc(rec.date) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">逐笔核对</span><span class="v">' + checkedCount(bm.calc) + "/" + bm.detail.length + " 笔</span></div>" +
        '<div class="uh-readnote" style="margin-top:12px">确认即代表已核对回单金额与账单一致，确认后计入本月已确认并留痕，不可撤销。</div>' +
        '<div class="field" style="margin:14px 0 0"><label class="field-label">留痕方式</label><div class="seg" data-pick>' +
        '<button type="button" class="seg-item active" data-v="esign">电子签留痕</button>' +
        '<button type="button" class="seg-item" data-v="record">仅记录确认</button></div></div>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "确认到账", kind: "primary", onClick: function (sh) {
          var s = sh.querySelector("[data-pick] .seg-item.active");
          var r = Uni.actGuarded("pay/confirm", { layer: bm.layer, id: rec.id, signMethod: s ? s.getAttribute("data-v") : "record" });
          if (!r.ok) return false;
          Uni.detailState.confirmBill(cid, ctx.identity);
          Uni.toast("已确认到账", "ok");
        }
      }]
    });
    /* seg 切换（作用域限定在本弹窗，避免多弹窗叠加时互相干扰） */
    sh.querySelectorAll("[data-pick] .seg-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = b.parentNode;
        box.querySelectorAll(".seg-item").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
      });
    });
  }

  /* 提出异议（必填说明） */
  function disputeSheet(ctx, Uni, bm, rec) {
    Uni.sheet({
      title: "提出异议",
      body:
        '<div class="uh-sheetkv"><span class="k">登记金额</span><span class="v">' + ui.money(rec.amount) + "</span></div>" +
        '<div class="uh-readnote" style="margin:12px 0">异议期内提出，双方补充凭证后线下核实闭环；异议期间该笔不计入已确认。</div>' +
        '<div class="field" style="margin-bottom:0"><label class="field-label">异议说明<em class="req">*</em></label>' +
        '<textarea class="textarea" id="ur-d-why" placeholder="例如：回单金额与账单相差 ¥240（信息服务费），待双方核实"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "提交异议", kind: "danger", onClick: function (sh) {
          var why = (sh.querySelector("#ur-d-why").value || "").trim();
          if (!why) { Uni.toast("请填写异议说明", "err"); return false; }
          var r = Uni.actGuarded("pay/dispute", { layer: bm.layer, id: rec.id, reason: why });
          if (!r.ok) return false;
          Uni.toast("已提交异议", "ok");
        }
      }]
    });
  }

  /* 线下核实后确认（异议闭环） */
  function verifySheet(ctx, Uni, bm, rec) {
    var cid = bm.calc.id;
    Uni.sheet({
      title: "线下核实后确认",
      body:
        '<div class="uh-sheetkv"><span class="k">争议金额</span><span class="v">' + ui.money(rec.amount) + "</span></div>" +
        '<div class="ur-reg__why" style="margin:12px 0">异议：' + ui.esc(rec.reason || "—") + "</div>" +
        '<div class="field" style="margin-bottom:0"><label class="field-label">核实说明<em class="req">*</em></label>' +
        '<textarea class="textarea" id="ur-v-note" placeholder="例如：10-26 与平台财务核对，¥240 为信息服务费差额，已确认计入"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "核实并确认到账", kind: "primary", onClick: function (sh) {
          var v = (sh.querySelector("#ur-v-note").value || "").trim();
          if (!v) { Uni.toast("请填写线下核实说明", "err"); return false; }
          var r = Uni.actGuarded("pay/confirm", { layer: bm.layer, id: rec.id, verifiedNote: v, signMethod: "record" });
          if (!r.ok) return false;
          Uni.detailState.confirmBill(cid, ctx.identity);
          Uni.toast("已核实并确认到账", "ok");
        }
      }]
    });
  }

  /* ============================================================
     十四、挂载
     ============================================================ */
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function flash(el, sel) {
    var t = el.querySelector(sel);
    if (!t) return;
    try { t.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" }); }
    catch (e) { t.scrollIntoView(); }
    t.classList.add("ur-flash");
    setTimeout(function () { t.classList.remove("ur-flash"); }, 1300);
  }

  /* 待办跳转 ?focus=1|2：只在该次进入时生效，随后清掉 query 避免刷新反复强制切换 */
  function applyFocus(b1, b2) {
    if (!_focusPending) return false;
    _focusPending = false;
    var f = null;
    try { f = new URLSearchParams(window.location.search).get("focus"); } catch (e) { f = null; }
    if (f !== "1" && f !== "2") return false;
    var b = f === "2" ? b2 : b1;
    if (!b.isEmpty) _tab = f;
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    } catch (e) { /* file:// 等环境忽略 */ }
    return true;
  }

  /* ---------- P1-1 对账单 → 单据弹窗（模板与下载统一走 uni-doc.js） ----------
     对账单记录只带 {month, calcId, status}，卷宗模板要 hist 形态
     {month,type,issueAt,dueAt,amount,state}；月份+层级在 hist 中唯一。
     取不到就返回 null 让调用方明确提示缺失——不按 calc 实算值拼一张
     缺出账日/截止日/平账时间的假单据（虚构凭证比空白更危险）。 */
  function histRecOf(ctx, stmt, layer) {
    var s = ctx.s || {};
    var type = layer === "1" ? "platform" : "sub";
    return (s.hist || []).filter(function (h) {
      if ((h.month || "") !== (stmt.month || "")) return false;
      return ctx.mode === "sub" ? true : (h.type || "platform") === type;
    })[0] || null;
  }

  function stmtDocSheet(ctx, Uni, h) {
    var Doc = window.UniDoc;
    if (!Doc) { Uni.toast("对账文件模块未加载，请刷新后重试", "err"); return; }
    /* 模板/下载/摘要口径全部收敛在 uni-doc.js，三个入口（对账中心、历史账期、
       经营台账）看到的是同一张单 */
    Doc.openSheet(ctx, h, Uni, {
      more: { t: "全部账期", on: function () { Uni.navTo("reconcile-history.html"); } }
    });
  }

  function mount(el, ctx) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = (V && typeof V.data === "function") ? V.data(ctx) : { canAct: false, note: null };

    var b1 = bandModel(ctx, "1"), b2 = bandModel(ctx, "2");
    _comingFromTodo = applyFocus(b1, b2);
    if (_view !== "check" && _view !== "list" && _view !== "insight") _view = "check";

    var bm = _tab === "2" ? b2 : b1;
    var pageEmpty = b1.isEmpty && b2.isEmpty;

    var profileStatus = (ctx.s.profile || {}).status;
    var statusNote = STATUS_NOTE[profileStatus];
    var note = statusNote || vm.note || (ctx.readonly ? (V && V.lockedNote) : null);

    /* 只读 / 员工 / 逾期 / 已平账：一律不给可点但必拒的按钮 */
    var canAct = !!vm.canAct && !ctx.readonly;
    var actOk = canAct && !bm.locked && !bm.isEmpty && !bm.balanced;
    /* 下一步文案口吻：self=本人可操作；admin=角色只读（待管理员）；none=账号状态受限（去主语） */
    var nextWho = canAct ? "self" : (profileStatus !== "active" ? "none" : "admin");

    var html = "";
    if (note) {
      html += '<section class="uh-sec"><div class="uh-readnote">' +
        ui.icon(ctx.readonly ? "lock" : "info", 15) + "<span>" + ui.esc(note) + "</span></div></section>";
    }
    if (pageEmpty) {
      html += '<section class="uh-sec"><div class="card">' +
        Uni.emptyHtml("本月暂无对账卷宗", "平台出账后自动生成卷宗；出账前无需核对，也不可平账。", "reconcile") +
        "</div></section>";
    } else {
      html += navHtml(b1, b2);
      var panel;
      if (_view === "list") panel = listPanel(bm, ctx);
      else if (_view === "insight") panel = insightPanel(bm);
      else {
        panel = '<div class="ur-grid">' +
          '<div class="ur-grid__aside">' + heroHtml(bm, actOk, nextWho) + "</div>" +
          '<div class="ur-grid__main">' +
          todosHtml(bm, actOk) +
          checklistHtml(bm, actOk) +
          '<button type="button" class="ur-more" data-act="goto-list">查看全部登记明细' + ui.icon("chev", 14) + "</button>" +
          "</div></div>";
      }
      html += '<div class="ur-panel" role="tabpanel">' + panel + "</div>";
    }
    html += rulesCard();
    html += '<div class="uh-stickybar is-empty"></div>';

    el.innerHTML = html;
    if (pageEmpty) { el.classList.remove("ur-hasbar"); return; }

    /* 粘性底栏：仅卷宗级动作（登记 / 平账 / 提醒二级） */
    var sb = el.querySelector(".uh-stickybar");
    var foot = footHtml(bm, actOk);
    if (sb) {
      sb.innerHTML = foot;
      sb.classList.toggle("is-empty", !foot);
    }
    el.classList.toggle("ur-hasbar", !!foot);

    /* 主数字 count-up（reduced-motion 直跳终值） */
    var cnum = el.querySelector("[data-count]");
    if (cnum) Uni.countUp(cnum, parseFloat(cnum.getAttribute("data-count")) || 0, 460, ui.moneyD);

    /* 构成条入场：宽度从 0 过渡到目标值 */
    var segs = el.querySelectorAll(".ur-comp__seg");
    if (segs.length) {
      if (reduceMotion()) {
        Array.prototype.forEach.call(segs, function (s) { s.style.width = s.getAttribute("data-w"); });
      } else {
        requestAnimationFrame(function () {
          Array.prototype.forEach.call(segs, function (s) { s.style.width = s.getAttribute("data-w"); });
        });
      }
    }

    wireStuck(el);

    /* ---- 卷宗切换 ---- */
    el.querySelectorAll("[data-tab]").forEach(function (n) {
      n.addEventListener("click", function () {
        var t = n.getAttribute("data-tab");
        if (t === _tab) return;
        _tab = t;
        mount(el, ctx);
        var p = el.querySelector(".ur-panel");
        if (p) { try { p.scrollIntoView({ block: "start" }); } catch (e) {} }
      });
    });

    /* ---- 视图切换 ---- */
    el.querySelectorAll("[data-view]").forEach(function (n) {
      n.addEventListener("click", function () {
        var v = n.getAttribute("data-view");
        if (v === _view) return;
        _view = v;
        mount(el, ctx);
        var p = el.querySelector(".ur-panel");
        if (p) {
          try { p.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" }); }
          catch (e) { p.scrollIntoView(); }
        }
      });
    });

    /* ---- 明细筛选 ---- */
    el.querySelectorAll("[data-chip]").forEach(function (n) {
      n.addEventListener("click", function () {
        var f = n.getAttribute("data-chip");
        if (f === _filter) return;
        _filter = f;
        mount(el, ctx);
      });
    });

    /* ---- 逐笔核对 ---- */
    el.querySelectorAll("[data-dl]").forEach(function (n) {
      n.addEventListener("click", function () {
        if (!actOk) {
          Uni.toast(canAct ? "本月对账已锁定，无法核对" : "逐笔核对仅管理员可操作", "err");
          return;
        }
        var on = toggleChecked(bm.calc.id, n.getAttribute("data-dl"));
        Uni.toast(on ? "已核对该笔订单" : "已取消核对");
        mount(el, ctx);
      });
    });

    /* ---- 登记详情 / 凭证 ---- */
    el.querySelectorAll("[data-reg]").forEach(function (n) {
      n.addEventListener("click", function () {
        var rec = regOf(ctx, n.getAttribute("data-reg"));
        if (!rec) return;
        var layer = layerOfCalcId(rec.calcId);
        regDetailSheet(ctx, Uni, bandModel(ctx, layer), rec, canAct && !bandModel(ctx, layer).locked);
      });
    });
    el.querySelectorAll("[data-voucher]").forEach(function (n) {
      n.addEventListener("click", function () {
        var rec = regOf(ctx, n.getAttribute("data-voucher"));
        var v = rec && rec.vouchers && rec.vouchers[0];
        if (v) Uni.voucherCenter(v);
        else Uni.toast("该登记未上传凭证");
      });
    });

    /* ---- P1-1 对账单行 → 单据弹窗（只读，不涉动作权限） ---- */
    el.querySelectorAll("[data-stmt]").forEach(function (n) {
      n.addEventListener("click", function () {
        var month = n.getAttribute("data-stmt");
        var stmt = (bm.stmts || []).filter(function (x) { return x.month === month; })[0];
        if (!stmt) return;
        var h = histRecOf(ctx, stmt, bm.layer);
        if (!h) { Uni.toast("该账期对账文件缺失", "err"); return; }
        stmtDocSheet(ctx, Uni, h);
      });
    });

    /* ---- 动作分发 ---- */
    el.querySelectorAll("[data-act]").forEach(function (n) {
      n.addEventListener("click", function () {
        var act = n.getAttribute("data-act");
        var id = n.getAttribute("data-id");
        var layer = n.getAttribute("data-layer") || _tab;

        if (act === "rules") {
          Uni.sheet({
            title: "费用口径与对账规则",
            body: Uni.scopeSheetBody(rulesClauseHtml()),
            footer: [{ t: "关闭", kind: "ghost" }]
          });
          return;
        }
        if (act === "goto-list") { _view = "list"; mount(el, ctx); return; }
        if (act === "goto-dl") { flash(el, '[data-anchor="dl"]'); return; }

        if (!canAct) { Uni.toast(V.lockedNote || "当前为只读态，对账动作已锁定", "err"); return; }
        if (bm.locked) { Uni.toast("本月对账窗口已关闭，仅可查看", "err"); return; }

        if (act === "checkAll") {
          var dl = bm.detail;
          if (!dl.length) { Uni.toast("该卷宗暂无明细可核对"); return; }
          dl.forEach(function (d) { Uni.detailState.set(bm.calc.id, d.id, "checked", ctx.identity); });
          Uni.toast("已全部核对（" + dl.length + " 笔）", "ok");
          mount(el, ctx);
          return;
        }
        if (act === "addreg") { if (bm.gap <= 0) { Uni.toast("当前无需登记：登记总额已达账单金额"); return; } registerSheet(ctx, Uni, bm); return; }
        if (act === "balance") {
          if (!bm.ready) { Uni.toast("差异未清零或仍有待办登记，不能平账", "err"); return; }
          Uni.dialog({
            title: "确认本月平账？",
            text: "平账后本月卷宗锁定为「已完成」，差异须为 ¥0 且无待确认/异议登记。平账记录留痕但不可撤销。",
            ok: "确认平账", cancel: "取消",
            onOk: function () { Uni.actGuarded("stmt/balance", { layer: bm.layer }); }
          });
          return;
        }
        if (act === "remind") {
          var r = Uni.actGuarded("msg/add", {
            msg: {
              icon: "bell", type: "info", to: "reconcile.html",
              title: "已提醒二级企业确认" + (bm.layer === "2" ? "" : "") + "收款",
              desc: "卷宗02 · " + ui.money(bm.bill) + "，请二级企业在二级端确认到账"
            }
          });
          if (r.ok) Uni.toast("已发送提醒", "ok");
          return;
        }

        var rec = regOf(ctx, id);
        if (!rec) return;
        if (act === "confirm") {
          if (bm.layer === "1" && !allCheckedOf(bm.calc)) {
            Uni.toast("请先完成逐笔核对（" + checkedCount(bm.calc) + "/" + bm.detail.length + "）", "err");
            flash(el, '[data-anchor="dl"]');
            return;
          }
          confirmSheet(ctx, Uni, bm, rec);
          return;
        }
        if (act === "dispute") { disputeSheet(ctx, Uni, bm, rec); return; }
        if (act === "verify") { verifySheet(ctx, Uni, bm, rec); return; }
        if (act === "void") { voidSheet(ctx, Uni, bm, rec); return; }
      });
    });

    /* 来自待办中心：定位后高亮待办卡（首屏可见，不额外滚动） */
    if (_comingFromTodo) {
      _comingFromTodo = false;
      var todo = el.querySelector('[data-anchor="todo"]');
      if (todo) {
        todo.classList.add("ur-flash");
        setTimeout(function () { todo.classList.remove("ur-flash"); }, 1300);
      }
    }
  }

  /* 吸顶背景（监听器文件级单例，重挂载仅换目标） */
  var _navEl = null, _navScroller = null;
  function onNavScroll() {
    if (_navEl && _navScroller) _navEl.classList.toggle("is-stuck", _navScroller.scrollTop > 4);
  }
  function wireStuck(el) {
    var nav = el.querySelector(".ur-nav");
    var sc = el.closest(".scroll") || el;
    if (!nav) return;
    if (_navScroller !== sc) {
      if (_navScroller) _navScroller.removeEventListener("scroll", onNavScroll);
      _navScroller = sc;
      sc.addEventListener("scroll", onNavScroll, { passive: true });
    }
    _navEl = nav;
    onNavScroll();
  }

  window.Uni.register({
    view: "uni-reconcile",
    route: "reconcile.html",
    modes: ["province"],
    STATE_VARIANTS: STATE_VARIANTS,
    skeleton: true,
    mount: mount
  });
})();
