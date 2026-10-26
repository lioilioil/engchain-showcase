/* page-reconcile.js · 对账留痕 #/reconcile
   【S4-C 深度重构】从 3 步任务流升级为「行级勾稽网」：
   ① 行级匹配（登记行 ↔ 测算池勾稽：已勾稽/待核对/勾稽挂起/已冲销 + 勾稽条）
   ② 差异分解卡（漏登差额 / 异议挂起 / 冲销红字，纯视图归集不改数）
   ③ 证据链（每行玻璃 bottom sheet 时间线：登记→凭证→异议→确认→冲销）
   ④ 状态机（每行微阶段条：登记→待核对→确认/异议→平账，迁移沿用 store 原 actions）
   弹窗：统一走 ui.openSheet / ui.openModal（v3-sheet/v3-modal 液态玻璃承载，§二规范），不新增第三种样式。
   A1 对账规则收为页内「说明 ›」玻璃弹层（合规原文不删字）；B2 登记人角色中文化。
   口径：diff = calcAmount − regsSum（regsSum=该 calcId 下 status≠void 金额求和）；不读 calcFinance、不引入 selfRate。 */
(function () {
  "use strict";

  function layerData(d, layer) {
    if (String(layer) === "1") return { calc: d.calc1, regs: d.payRegs1, stmts: d.statements1,
      title: "我与平台的对账", side: "你确认平台线下到账", counter: "平台 · 润锦工程链" };
    return { calc: d.calc2, regs: d.payRegs2, stmts: d.statements2,
      title: "我与二级企业的对账", side: "二级确认后才到账 · 15 天只提醒", counter: "成都蓉建科贸有限公司" };
  }

  /* 角色名中文化（B2：登记人 boss → 老板） */
  function roleName(r) {
    return ({ boss: "老板", admin: "管理员", staff: "员工" })[r] || r || "—";
  }

  function render(ctx) {
    var ui = ctx.ui;
    /* A1：正文区不再常驻规则折叠条 → 页内首行「说明 ›」玻璃弹层承载 */
    var h = '<div class="rc-headrow"><span class="rc-sec">本月对账进度</span>' +
      '<button type="button" class="rc-rules-entry" data-act="show-rules">' + ui.icon("bank", 13) + "<span>说明 ›</span></button></div>";
    h += '<div class="rc-seg" id="rc-seg">' +
      '<button type="button" data-l="1" class="on"></button>' +
      '<button type="button" data-l="2"></button></div>';
    h += '<div id="rc-body"></div>';
    return h;
  }

  /* 层内未处理数（段切换小徽章） */
  function layerOpen(ctx, layer) {
    var V3 = ctx.V3, d = ctx.d, L = layerData(d, layer);
    var curCalc = L.calc[0];
    var regs = L.regs.filter(function (r) { return r.calcId === curCalc.id && r.status !== "void"; });
    return regs.filter(function (r) { return r.status !== "confirmed"; }).length;
  }

  function renderLayer(ctx, layer) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var L = layerData(d, layer);
    var isL2 = String(layer) === "2";
    var curCalc = L.calc[0], prevCalc = L.calc[1];
    var curStmt = L.stmts[0];
    var regs = L.regs.filter(function (r) { return r.calcId === curCalc.id; });
    var sum = V3.store.regsSum(L.regs, curCalc.id);
    var diff = curCalc.calcAmount - sum;
    var activeRegs = regs.filter(function (r) { return r.status !== "void"; });
    var disputedRegs = activeRegs.filter(function (r) { return r.status === "disputed"; });
    var pendingRegs = activeRegs.filter(function (r) { return r.status === "pending_confirm"; });
    var disputedSum = disputedRegs.reduce(function (s, r) { return s + r.amount; }, 0);
    var redCount = regs.filter(function (r) { return r.redFlushOf; }).length;
    var allConfirmed = activeRegs.length > 0 && activeRegs.every(function (r) { return r.status === "confirmed"; });
    var balanced = curStmt.status === "balanced";
    var canAct = ctx.canBoss && !ctx.readonly;

    /* ---------- 顶部一句话状态行 + 唯一主操作（继承迭代三口径） ---------- */
    var bandCls = "ok", bandTxt = "", primary = "";
    if (balanced) {
      bandCls = "ok";
      bandTxt = ui.icon("check", 15) + "<span>本月已平账留痕（" + ui.esc(curStmt.balancedAt || prevCalc.balancedAt || "") + "）</span>";
    } else if (disputedRegs.length) {
      bandCls = "bad";
      bandTxt = ui.icon("warn", 15) + "<span>差异 " + ui.money(diff) + "，<b>" + disputedRegs.length +
        " 笔异议待线下核实</b>，暂不能平账（差异未清）</span>";
      if (!isL2 && canAct) primary = '<button type="button" class="v3-btn v3-btn--navy v3-btn--sm" data-act="first-dispute">处理异议</button>';
    } else if (diff !== 0) {
      bandCls = "bad";
      bandTxt = ui.icon("warn", 15) + "<span>差异 " + ui.money(diff) + "（平台测算 − 你的实付登记），<b>暂不能平账</b>（差异未清）</span>";
      primary = '<button type="button" class="v3-btn v3-btn--navy v3-btn--sm" data-act="add-reg">登记线下付款</button>';
    } else if (pendingRegs.length) {
      bandCls = "warn";
      bandTxt = ui.icon("clock", 15) + "<span>金额已对齐，<b>" + pendingRegs.length +
        " 笔待确认</b>" + (isL2 ? "（等待二级，仅提醒不自动到账）" : "") + "</span>";
      if (!isL2 && canAct) primary = '<button type="button" class="v3-btn v3-btn--navy v3-btn--sm" data-act="first-confirm">确认到账</button>';
      else if (isL2) primary = '<button type="button" class="v3-btn v3-btn--ghost v3-btn--sm" data-act="remind">' + ui.icon("bell", 15) + " 提醒二级确认</button>";
      else primary = '<button type="button" class="v3-btn v3-btn--ghost v3-btn--sm is-disabled">待管理员确认</button>';
    } else if (allConfirmed) {
      bandCls = "ok";
      bandTxt = ui.icon("check", 15) + "<span>差异 ¥0，凭证齐全，<b>可月度平账留痕</b></span>";
      if (!isL2 && canAct) primary = '<button type="button" class="v3-btn v3-btn--navy v3-btn--sm" data-act="balance">月度平账留痕</button>';
    } else {
      bandCls = "warn";
      bandTxt = ui.icon("bank", 15) + "<span>本月线下付款完成后，请先<b>登记并上传凭证</b>（凭证强制）。</span>";
      if (!isL2 && canAct) primary = '<button type="button" class="v3-btn v3-btn--navy v3-btn--sm" data-act="add-reg">登记线下付款</button>';
    }

    var h = '<div class="rc-band rc-band--' + bandCls + '" data-layer="' + layer + '">' +
      '<div class="rc-band__txt">' + bandTxt + "</div>" +
      (primary ? '<div class="rc-band__op">' + primary + "</div>" : "") +
      "</div>";

    /* ---------- 3 步条（补登记 → 核对 → 确认/异议） ---------- */
    var s1c = activeRegs.length ? "done" : "cur";
    var s2c = activeRegs.length === 0 ? "" : (allConfirmed || disputedRegs.length) ? "done" : "cur";
    var s3c = allConfirmed ? "done" : (activeRegs.length ? "cur" : "");
    h += '<div class="s-stepbar">' +
      '<div class="st ' + s1c + '"><span class="sdot">1</span><span class="slab">补登记<br/>登记线下付款+凭证</span></div>' +
      '<div class="st ' + s2c + '"><span class="sdot">2</span><span class="slab">核对<br/>测算 vs 实付</span></div>' +
      '<div class="st ' + s3c + '"><span class="sdot">3</span><span class="slab">确认/异议<br/>确认到账 · 提异议</span></div></div>';

    /* ---------- 测算 vs 实付 双数字面板 ---------- */
    h += '<section class="rc-calcpanel">' +
      '<div class="cp-box"><div class="cp-n num">' + ui.money(curCalc.calcAmount) + '</div><div class="cp-k">平台测算应付（只读）</div></div>' +
      '<div class="cp-op">−</div>' +
      '<div class="cp-box"><div class="cp-n num">' + ui.money(sum) + '</div><div class="cp-k">线下实付登记</div></div></section>';

    /* ---------- ① 行级匹配：勾稽条 ---------- */
    h += '<section class="rc-tie">' +
      '<div class="rc-tie__seg"><b class="num">' + ui.money(curCalc.calcAmount) + '</b><span>测算应付</span></div>' +
      '<div class="rc-tie__eq">=</div>' +
      '<div class="rc-tie__seg"><b class="num">' + ui.money(sum) + '</b><span>已勾稽登记</span></div>';
    if (diff !== 0) {
      h += '<div class="rc-tie__plus">+</div>' +
        '<div class="rc-tie__seg is-gap"><b class="num">' + ui.money(Math.abs(diff)) + '</b><span>未勾稽差额</span></div>';
    }
    h += "</section>";

    /* ---------- ② 差异分解卡（条件出现：有差额或有异议） ---------- */
    if (diff !== 0 || disputedRegs.length) {
      h += '<section class="rc-diff">' +
        '<div class="rc-diff__t"><span>差异分解</span>' +
        '<button type="button" data-act="diff-detail" class="rc-diff__more">明细 ›</button></div>';
      if (diff !== 0) h += '<div class="rc-diff__row"><span>漏登差额（待补登记）</span><b class="num">' + ui.money(diff) + "</b></div>";
      if (disputedRegs.length) h += '<div class="rc-diff__row"><span>异议挂起（' + disputedRegs.length + " 笔 · 线下核实中）</span><b class=\"num\">" + ui.money(disputedSum) + "</b></div>";
      h += '<div class="rc-diff__row"><span>冲销红字留痕</span><span>' + redCount + " 笔</span></div></section>";
    }

    /* ---------- 明细行头（B1：只留月份，时限说明收进说明弹层） ---------- */
    h += '<div class="rc-rows-head"><span class="v3-sm v3-strong">' + curCalc.month + " 登记明细</span></div>";
    h += '<section class="rc-rows">';
    if (!regs.length) {
      h += '<div class="v3-placeholder" >尚无登记。请在 App 外完成付款后，登记金额并上传凭证（凭证强制）。</div>';
    } else {
      regs.forEach(function (r) { h += regRow(ctx, r, isL2, canAct); });
    }
    h += "</section>";

    /* 历史月份 */
    h += '<div class="rc-prev"><span class="v3-xs v3-muted">' + prevCalc.month + " 月度对账单</span>" +
      '<span class="v3-badge v3-badge--active">已平账 ' + ui.money(prevCalc.calcAmount) + "</span></div>";
    return h;
  }

  /* ④ 状态机微阶段条：登记 → 待核对 → 确认/异议 → 平账 */
  function lifeBar(r) {
    var st = r.status, voided = st === "void";
    var stage = [
      { t: "登记", cls: voided ? "" : "on" },
      { t: "待核对", cls: (st === "pending_confirm" || st === "confirmed" || st === "disputed") ? "on" : "" },
      { t: st === "disputed" ? "有异议" : "确认", cls: st === "confirmed" ? "on" : (st === "disputed" ? "on bad" : "") },
      { t: "平账", cls: "" }
    ];
    var h = '<div class="rc-lifecycle">';
    stage.forEach(function (s, i) {
      if (i) h += '<span class="ll"></span>';
      h += '<span class="ld ' + s.cls + '"><i></i>' + s.t + "</span>";
    });
    h += "</div>";
    return h;
  }

  function regRow(ctx, r, isL2, canAct) {
    var ui = ctx.ui;
    var voided = r.status === "void";
    var isRed = !!r.redFlushOf;
    var matchChip = ({ pending_confirm: "待核对", confirmed: "已勾稽", disputed: "勾稽挂起", void: "已冲销" })[r.status];
    var h = '<div class="rc-row' + (voided ? " is-void" : "") + '" data-rid="' + r.id + '">' +
      '<div class="rc-row__hd"><span class="amt num' + (isRed ? " is-neg" : "") + '">' + ui.money(r.amount) + "</span>" +
      '<span class="v3-badge ' + ui.REG_BADGE[r.status] + '">' + ui.REG[r.status] + "</span>" +
      '<span class="rc-match rc-match--' + r.status + '">' + matchChip + "</span></div>" +
      lifeBar(r) +
      '<div class="rc-row__meta"><span>' + ui.esc(r.date) + "</span><span>" + methodName(r.method) + "</span><span>登记人 " + ui.esc(roleName(r.registeredBy)) + "</span></div>";
    (r.vouchers || []).forEach(function (v) {
      h += '<div class="rc-row__vch">' + ui.icon(v.kind === "image" ? "camera" : "file", 14) +
        "<span>" + ui.esc(v.name) + '</span><span class="v3-badge v3-badge--active">凭证</span></div>';
    });
    if (r.status === "confirmed" && r.signMethod) {
      h += '<div class="rc-row__vch" >' + ui.icon("shield", 14) +
        "<span>" + (r.signMethod === "esign" ? "确认 + 电子签留痕" : "双方确认记录") + "</span></div>";
    }
    if (r.status === "disputed" && r.reason) h += '<div class="rc-row__reason" >' + ui.esc(r.reason) + "</div>";
    if (r.voidInfo) h += '<div class="v3-xs v3-faint v3-mt6" >冲销：' + ui.esc(r.voidInfo.reason) + " · " + ui.esc(r.voidInfo.at) + "</div>";

    /* ③ 证据链入口（每行可展开留痕时间线）+ 行内操作按状态显隐（主操作 ≤2） */
    h += '<div class="rc-row__ops">';
    h += '<button type="button" class="v3-btn v3-btn--link v3-btn--sm" data-act="evidence">证据链 ›</button>';
    if (!voided && !ctx.readonly) {
      if (r.status === "pending_confirm") {
        if (isL2) {
          h += '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="remind">等待二级确认</button>';
        } else if (ctx.canBoss) {
          h += '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm">确认到账</button>' +
               '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="dispute">提异议</button>' +
               '<button class="v3-btn v3-btn--link v3-btn--sm" data-act="redflush">冲销</button>';
        } else {
          h += '<button class="v3-btn v3-btn--ghost v3-btn--sm is-disabled">待管理员确认</button>';
        }
      }
      if (r.status === "disputed" && !isL2 && ctx.canBoss) {
        h += '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm">线下核实后确认</button>' +
             '<button class="v3-btn v3-btn--link v3-btn--sm" data-act="redflush">冲销</button>';
      }
    }
    h += "</div>";
    h += "</div>";
    return h;
  }
  function methodName(m) { return { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" }[m] || "线下"; }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui;
    var curLayer = "1";
    var bodyEl = el.querySelector("#rc-body");

    function paintSeg() {
      var seg = el.querySelector("#rc-seg");
      seg.querySelectorAll("button").forEach(function (b) {
        var l = b.getAttribute("data-l");
        var L = layerData(ctx.d, l);
        var n = layerOpen(ctx, l);
        b.innerHTML = "<span>" + L.title + "</span>" + (n ? '<span class="rc-seg__n">' + n + "</span>" : "");
        b.classList.toggle("on", l === curLayer);
      });
      bodyEl.innerHTML = renderLayer(ctx, curLayer);
    }
    paintSeg();

    el.querySelector("#rc-seg").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-l]"); if (!b) return;
      curLayer = b.getAttribute("data-l");
      paintSeg();
    });

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var layer = curLayer;
      var act = b.getAttribute("data-act");
      if (act === "add-reg") registerSheet(ctx, layer);
      else if (act === "show-rules") rulesSheet(ctx, layer);
      else if (act === "diff-detail") diffDetailSheet(ctx, layer);
      else if (act === "evidence") evidenceSheet(ctx, layer, b.closest("[data-rid]").getAttribute("data-rid"));
      else if (act === "first-dispute") {
        var d1 = ctx.d, L1 = layerData(d1, layer);
        var rg = L1.regs.filter(function (r) { return r.calcId === L1.calc[0].id && r.status === "disputed"; })[0];
        if (rg) confirmSheet(ctx, layer, rg.id);
      } else if (act === "first-confirm") {
        var d2 = ctx.d, L2 = layerData(d2, layer);
        var rp = L2.regs.filter(function (r) { return r.calcId === L2.calc[0].id && r.status === "pending_confirm"; })[0];
        if (rp) confirmSheet(ctx, layer, rp.id);
      }
      else if (act === "confirm") confirmSheet(ctx, layer, b.closest("[data-rid]").getAttribute("data-rid"));
      else if (act === "dispute") disputeSheet(ctx, layer, b.closest("[data-rid]").getAttribute("data-rid"));
      else if (act === "redflush") redFlushSheet(ctx, layer, b.closest("[data-rid]").getAttribute("data-rid"));
      else if (act === "balance") balanceSheet(ctx, layer);
      else if (act === "remind") { ui.toast("已发送提醒 · 仅提醒不自动到账", "ok"); }
    });
  }

  /* ---- A1：对账规则「说明 ›」玻璃弹层（合规原文不删字） ---- */
  function rulesSheet(ctx, layer) {
    var L = layerData(ctx.d, layer);
    var curCalc = L.calc[0];
    var moneyNote = (window.V3.store && window.V3.store.MONEY_NOTE) || "";
    ctx.ui.openSheet({
      title: "对账说明",
      body:
        '<div class="rc-prose">' +
        '<p class="lab">勾稽口径</p>' +
        '<p>线下付款在 App 外完成；此处只做<b>登记、凭证、确认、对账留痕</b>。' +
        "测算金额只读，恒等呈现 <b>平台测算应付 − 你的实付登记 = 差异</b>，差异为 0 且全部确认才可平账。</p>" +
        '<p class="lab">时限（' + curCalc.month + '）</p>' +
        "<p>" + ctx.ui.esc(curCalc.dueLabel) + "。</p>" +
        '<p class="lab">在途冻结（T+7）</p>' +
        "<p>新发生消费满 7 日无退款才转合格基数；在途冻结不进当月对账数字，到期入下月。</p>" +
        '<p class="lab">资金边界</p>' +
        "<p>" + ctx.ui.esc(moneyNote) + "。</p>" +
        "</div>",
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  /* ---- 差异分解明细弹层 ---- */
  function diffDetailSheet(ctx, layer) {
    var L = layerData(ctx.d, layer);
    var curCalc = L.calc[0];
    var regs = L.regs.filter(function (r) { return r.calcId === curCalc.id; });
    var sum = ctx.V3.store.regsSum(L.regs, curCalc.id);
    var diff = curCalc.calcAmount - sum;
    var disputed = regs.filter(function (r) { return r.status === "disputed"; });
    var disputedSum = disputed.reduce(function (s, r) { return s + r.amount; }, 0);
    var redCount = regs.filter(function (r) { return r.redFlushOf; }).length;
    var rows = "";
    if (diff !== 0) rows += kv("漏登差额", ctx.ui.money(diff) + " · 测算应付中尚未登记的部分，补登记后自动冲抵");
    if (disputed.length) rows += kv("异议挂起", ctx.ui.money(disputedSum) + " · " + disputed.length + " 笔登记线下核实中，不进平账");
    rows += kv("冲销红字", redCount + " 笔 · 追加的等额负数留痕，不物理删除原凭证");
    rows += kv("勾稽恒等式", ctx.ui.money(curCalc.calcAmount) + " = 已勾稽 " + ctx.ui.money(sum) + " + 未勾稽 " + ctx.ui.money(Math.abs(diff)));
    ctx.ui.openSheet({
      title: "差异分解明细",
      body: '<div class="rc-kvs">' + rows + "</div>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }
  function kv(k, v) {
    return '<div class="rc-kv"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
  }

  /* ---- ③ 证据链：单笔登记留痕时间线 ---- */
  function evidenceSheet(ctx, layer, rid) {
    var L = layerData(ctx.d, layer);
    var r = null;
    L.regs.forEach(function (x) { if (x.id === rid) r = x; });
    if (!r) return;
    var ui = ctx.ui, items = [];
    items.push({ t: "登记", bad: false, p: (r.date || "") + " · " + methodName(r.method) + " · 登记人 " + roleName(r.registeredBy) + " · 金额 " + ui.money(r.amount) });
    (r.vouchers || []).forEach(function (v) {
      items.push({ t: "凭证", bad: false, p: v.name + "（" + (v.kind === "image" ? "图片" : "文件") + "）" + (r.redFlushOf ? "" : " · 凭证强制校验通过") });
    });
    if (r.status === "disputed" && r.reason) items.push({ t: "异议挂起", bad: true, p: r.reason });
    if (r.status === "confirmed") items.push({ t: "确认一致", bad: false, p: (r.confirmedAt || "") + " · " + (r.signMethod === "esign" ? "双方确认 + 电子签留痕" : "双方确认记录") });
    if (r.voidInfo) items.push({ t: "冲销", bad: true, p: r.voidInfo.reason + " · " + (r.voidInfo.at || "") + (r.redFlushOf ? " · 本行为红字记录" : "") });
    if (r.redFlushOf) items.push({ t: "红字关联", bad: true, p: "本笔为冲销红字记录，勾稽原登记笔（不物理删除原凭证）" });
    var body = '<div class="rc-tl">' + items.map(function (it) {
      return '<div class="rc-tl__item' + (it.bad ? " is-bad" : "") + '"><span class="rc-tl__dot"></span>' +
        '<div class="rc-tl__bd"><b>' + it.t + "</b><p>" + ui.esc(it.p) + "</p></div></div>";
    }).join("") + "</div>";
    ctx.ui.openSheet({
      title: "证据链 · " + ui.money(r.amount),
      body: body,
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  /* ---- 登记线下付款（凭证强制） ---- */
  var pendingVouchers = [];
  function registerSheet(ctx, layer) {
    var ui = ctx.ui;
    if (ctx.readonly) { ui.toast("账号暂停中，不可登记", "err"); return; }
    pendingVouchers = [];
    ui.openSheet({
      title: "登记线下付款 · " + (layer === "1" ? "我与平台" : "我与二级企业"),
      body:
        '<div class="v3-alert v3-alert--info v3-mb12" >请确认已在 <b>App 外</b> 完成线下付款，再据实登记；金额与凭证将进入只读勾稽。</div>' +
        '<div class="v3-field"><label>实付金额（元）</label><input class="v3-input" id="r-amt" type="number" inputmode="decimal" placeholder="0.00" /></div>' +
        '<div class="v3-field"><label>付款方式</label><select class="v3-select" id="r-method"><option value="bank">对公转账</option><option value="wechat">微信 / 支付宝</option><option value="cash">现金</option><option value="other">其他</option></select></div>' +
        '<div class="v3-field"><label>付款日期</label><input class="v3-input" id="r-date" type="date" /></div>' +
        '<div class="v3-field"><label>付款凭证（强制，至少 1 张）</label>' +
        '<label class="v3-upload" id="r-up"><span class="ic">' + ui.icon("camera", 24) + '</span>点击上传回单 / 截图（原型内本地读取，不上传服务器）<input type="file" id="r-file" accept="image/*,application/pdf" multiple style="display:none" /></label>' +
        '<div class="v3-mt8" id="r-vlist" ></div><div class="v3-hint">缺凭证不可提交确认；支持多张。</div></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交登记", kind: "v3-btn--primary", onClick: function (wrap) {
          var amt = Number(wrap.querySelector("#r-amt").value), method = wrap.querySelector("#r-method").value,
              date = wrap.querySelector("#r-date").value;
          if (!(amt > 0)) { ui.toast("请填写有效实付金额", "err"); return false; }
          if (!date) { ui.toast("请选择付款日期", "err"); return false; }
          if (!pendingVouchers.length) { ui.toast("凭证为强制项，请至少上传 1 张", "err"); return false; }
          var L = layerData(ctx.d, layer);
          ctx.V3.store.act("pay/addReg", { layer: layer, calcId: L.calc[0].id, amount: amt, method: method, date: date, vouchers: pendingVouchers });
          ui.toast("已登记，等待核对", "ok"); ctx.V3.router.render();
        } }
      ],
      onMount: function (wrap) {
        wrap.querySelector("#r-date").value = new Date().toISOString().slice(0, 10);
        wrap.querySelector("#r-file").addEventListener("change", function (ev) {
          var files = Array.prototype.slice.call(ev.target.files || []);
          Promise.all(files.map(ui.fileToVoucher)).then(function (vs) {
            pendingVouchers = pendingVouchers.concat(vs); renderVList(wrap);
          });
        });
      }
    });
  }
  function renderVList(wrap) {
    wrap.querySelector("#r-vlist").innerHTML = pendingVouchers.map(function (v, i) {
      return '<div class="rc-row__vch">' + (window.V3.ui.icon(v.kind === "image" ? "camera" : "file", 16)) +
        "<span>" + window.V3.ui.esc(v.name) + "</span><button class='v3-btn v3-btn--link v3-btn--sm' data-rmv='" + i + "'>移除</button></div>";
    }).join("");
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-rmv]"), function (b) {
      b.addEventListener("click", function () { pendingVouchers.splice(Number(b.getAttribute("data-rmv")), 1); renderVList(wrap); });
    });
  }

  /* ---- 确认 ---- */
  function confirmSheet(ctx, layer, rid) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "确认到账",
      body:
        '<div class="v3-alert v3-alert--warn v3-mb12" >仅在你已<b>实际核对线下到账与凭证一致</b>后确认；确认进入双方留痕。</div>' +
        (layer === "2" ? '<div class="v3-readnote v3-mb12" >第二层出账后 15 天内仅提醒，<b>绝不自动确认到账</b>。</div>' : "") +
        '<div class="rc-row__vch">' + ui.icon("shield", 16) + "<span>确认方式：双方确认记录（电子签正式接入为 P1）</span></div>",
      footer: [
        { t: "确认到账（确认记录）", kind: "v3-btn--primary", onClick: function () {
          ctx.V3.store.act("pay/confirm", { layer: layer, id: rid, signMethod: "record" }); ui.toast("已确认", "ok"); ctx.V3.router.render();
        } },
        { t: "确认并电子签", kind: "v3-btn--navy", onClick: function () {
          esignMock(ctx, function () {
            ctx.V3.ui.closeAll();
            ctx.V3.store.act("pay/confirm", { layer: layer, id: rid, signMethod: "esign" });
            ui.toast("电子签完成（Mock，正式 P1）", "ok"); ctx.V3.router.render();
          });
          return false;
        } }
      ]
    });
  }
  function esignMock(ctx, done) {
    ctx.ui.openModal({
      title: "电子签署（Mock）", icon: "shield",
      body: "此处为电子签能力演示占位：正式环境将接入可信电子签并留存签署证书。点击同意即模拟完成签署。",
      okText: "同意并签署", onOk: function () { done(); }
    });
  }

  /* ---- 异议 ---- */
  var disVouchers = [];
  function disputeSheet(ctx, layer, rid) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "提出异议",
      body: '<div class="v3-field"><label>异议说明（必填）</label><textarea class="v3-textarea" id="d-reason" placeholder="如：金额不符 / 未收到该笔 / 凭证不清晰"></textarea>' +
        '<div class="v3-hint">第一层 T+5 工作日内提出并闭环线下核实；可补传凭证。</div></div>' +
        '<label class="v3-upload" id="d-up"><span class="ic">' + ui.icon("camera", 22) + '</span>补充凭证（可选）<input type="file" id="d-file" accept="image/*,application/pdf" multiple style="display:none"/></label><div class="v3-mt8" id="d-vlist"></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交异议", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#d-reason").value.trim();
          if (!reason) { ui.toast("请填写异议说明", "err"); return false; }
          ctx.V3.store.act("pay/dispute", { layer: layer, id: rid, reason: reason, vouchers: disVouchers });
          disVouchers = []; ui.toast("已提异议，暂不能平账", "ok"); ctx.V3.router.render();
        } }
      ],
      onMount: function (wrap) {
        disVouchers = [];
        wrap.querySelector("#d-file").addEventListener("change", function (ev) {
          Promise.all(Array.prototype.slice.call(ev.target.files || []).map(ui.fileToVoucher)).then(function (vs) {
            disVouchers = disVouchers.concat(vs);
            wrap.querySelector("#d-vlist").innerHTML = disVouchers.map(function (v) { return '<div class="rc-row__vch">' + ui.icon(v.kind === "image" ? "camera" : "file", 16) + "<span>" + ui.esc(v.name) + "</span></div>"; }).join("");
          });
        });
      }
    });
  }

  /* ---- 冲销（原红冲；trust 页尾原文并入本弹层正文） ---- */
  function redFlushSheet(ctx, layer, rid) {
    ctx.ui.openModal({
      title: "确认冲销该笔登记？", icon: "warn", danger: true,
      body: "冲销将追加一笔等额<b>负数记录</b>，<b>冲销只追加红字记录，不物理删除任何凭证</b>；冲销后差异会相应变化。", okText: "确认冲销",
      onOk: function () { ctx.V3.store.act("pay/void", { layer: layer, id: rid, reason: "登记有误，冲销更正" }); ctx.ui.toast("已冲销（留痕）", "ok"); ctx.V3.router.render(); }
    });
  }

  /* ---- 平账 ---- */
  function balanceSheet(ctx, layer) {
    var ui = ctx.ui;
    ui.openModal({
      title: "月度平账留痕", icon: "check",
      body: "平台测算应付与你的实付登记<b>差异为 ¥0</b> 且全部凭证已确认。平账后本月对账单封存留痕，后续更正只能冲销。",
      okText: "确认平账", onOk: function () {
        var L = layerData(ctx.d, layer);
        ctx.V3.store.act("stmt/balance", { layer: layer, id: L.stmts[0].id });
        ui.toast("已平账留痕", "ok"); ctx.V3.router.render();
      }
    });
  }

  window.V3PAGES.reconcile = { title: "对账留痕", render: render, mount: mount };
})();
