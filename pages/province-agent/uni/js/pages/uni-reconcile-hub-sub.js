/* ============================================================
   uni-reconcile-hub-sub.js · 对账中心（二级聚合页三 tab · reconcile-hub-sub.html）
   拍板③：二级端「对账中心」入口收口为聚合页，三 tab：
     Tab1 对账核对（= 原 reconcile-sub 核心：应付款/收口进度/逐笔核对/登记）
     Tab2 经营台账（= 原 ledger-sub 核心：应得/趋势/月度台账）
     Tab3 阅读对账单（= 原 statement-sub 核心：双月卡 + 层级徽章）
   数据单一源：store/scenarios（批次六定稿矩阵：10 月 6,000→600、9 月 4,600→460）。
   方案 A（拍板④，批次三先落交互目标态）：勾选明细 → 收口进度联动 → 全核对后
   「核对无误·确认」启用 → 差异收口；勾选态为内存（会话内保留，批次四统一
   store 数据模型 + DL_KEY 迁移）。
   组件视觉：.uls-tabs/.uh-badge/.uh-kv/.uh-readnote/.card/.btn 全部系统复用，
   新增组件（金额卡/收口进度条/结论条/明细勾选行）见 uni-reconcile-hub-sub.css。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var METHOD = { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" };
  var REG_TXT = { pending_confirm: "待确认", confirmed: "已确认", disputed: "有异议", void: "已作废" };
  var REG_CLS = { pending_confirm: "wait", confirmed: "ok", disputed: "bad", void: "mute" };
  var ITEM_LABEL = { cert: "企业认证", entry: "企业入驻", unlock: "线索解锁", order: "供需订单" };
  var G = 0.5, R = 0.2; /* 规则常量：分润基准 50%、平台分成 20%（与 store CONST/financeSplit 同源） */

  function money(v) { return "¥" + Number(v || 0).toLocaleString("zh-CN"); }
  function esc(s) { return String(s == null ? "" : s); }

  /* ---------- view-model 折算（数据映射层：store/scenarios 派生，无 DOM） ---------- */
  function buildVm(ctx, opt) {
    var s = ctx.s;
    var calc = (s.calc && s.calc[0]) || null;          /* sc-1（10 月） */
    var prev = (s.calc && s.calc[1]) || null;          /* sc-0（9 月） */
    var regs = s.payRegs || [];
    var stmts = s.statements || [];
    var cur = calc ? regs.filter(function (r) { return r.calcId === calc.id; }) : [];
    var hist = calc ? regs.filter(function (r) { return r.calcId !== calc.id; }) : [];
    var sum = calc ? store.regsSum(regs, calc.id) : 0;
    var prevSum = prev ? store.regsSum(regs, prev.id) : 0;
    var pending = cur.filter(function (r) { return r.status === "pending_confirm"; });
    var disputed = cur.filter(function (r) { return r.status === "disputed"; });
    var confirmedCur = cur.filter(function (r) { return r.status === "confirmed"; });
    var confirmedAmt = confirmedCur.reduce(function (t, r) { return t + (r.amount || 0); }, 0);
    var pendingAmt = pending.reduce(function (t, r) { return t + (r.amount || 0); }, 0);
    var disputedAmt = disputed.reduce(function (t, r) { return t + (r.amount || 0); }, 0);
    var due = calc ? calc.calcAmount : 0;
    var dueDay = calc ? (calc.dueDay || 0) : 0;
    var eligible = calc ? (calc.eligibleBase || 0) : 0;
    var prevEligible = prev ? (prev.eligibleBase || 0) : 0;
    var prevDue = prev ? prev.calcAmount : 0;
    var stCur = store.subSettle(calc || {});
    var stPrev = store.subSettle(prev || {});
    var openStmts = stmts.filter(function (x) { return x.status === "open"; }).length;
    return {
      calc: calc, prev: prev,
      due: due, dueDay: dueDay, eligible: eligible,
      sum: sum, prevSum: prevSum,
      confirmedAmt: confirmedAmt, pendingAmt: pendingAmt, disputedAmt: disputedAmt,
      detail: (calc && calc.detail) || [], prevDetail: (prev && prev.detail) || [],
      cur: cur, hist: hist,
      tri: { due: due, registered: sum, confirmed: confirmedAmt, pending: pendingAmt, disputed: disputedAmt, pendingCnt: pending.length, disputedCnt: disputed.length },
      sub: { eligible: stCur.eligible, gross: stCur.gross, ratio: stCur.ratioToSub, agreed: stCur.agreed, frozen: stCur.frozen },
      prevRow: { eligible: prevEligible, gross: stPrev.gross, agreed: stPrev.agreed, settled: prevSum },
      openStmts: openStmts,
      note: opt.notice, lockedNote: opt.lockedNote,
      /* 口径注（P0-6）：差异 = 应付款 − 已确认到账；异议排除（字数 ≤28） */
      readNote: "差异=应付款−已确认到账" + (disputedAmt ? "；异议¥" + Number(disputedAmt).toLocaleString("zh-CN") + "已排除" : "")
    };
  }

  /* ---------- 渲染拼装 ---------- */
  function tabsHtml(vm) {
    var badge1 = vm.tri.pendingCnt > 0 ? '<span class="uls-tab__badge">' + vm.tri.pendingCnt + "</span>" : "";
    var badge3 = vm.openStmts > 0 ? '<span class="uls-tab__badge">' + vm.openStmts + "</span>" : "";
    return '<div class="uls-tabs">' +
      '<button class="uls-tab active" data-p="p1">对账核对' + badge1 + "</button>" +
      '<button class="uls-tab" data-p="p2">经营台账</button>' +
      '<button class="uls-tab" data-p="p3">阅读对账单' + badge3 + "</button>" +
      "</div>";
  }

  /* 批次九 L2：页级粘性底栏主按钮（常驻「去对账/去确认/查看平账」，点击回 Tab1） */
  function sbHtml() {
    return '<button type="button" class="btn btn-primary" id="sbGo">去对账</button>';
  }

  function lockbarHtml(vm) {
    /* 批次九 L1：聚合页锁条为「仅提醒」语境，降噪为次要信息行（无警示底，逾期警示由原子页承担） */
    return '<div class="uh-lockbar" style="display:flex;gap:8px;background:transparent;border:0;border-radius:var(--r-m);padding:4px 0;margin-bottom:8px;">' +
      '<span style="color:var(--info);font-size:14px;line-height:1.3;">ℹ</span>' +
      '<div><span style="font-size:var(--fs-sm);font-weight:600;color:var(--text-2);">第 ' + vm.dueDay + '/15 天 · 对账截止 ' + (vm.calc && vm.calc.dueAt ? vm.calc.dueAt : "—") + '</span>' +
      '<span style="display:block;font-size:var(--fs-xs);color:var(--text-3);margin-top:2px;">出账后 15 天内仅提醒，绝不自动确认到账；逾期仍只提醒，不自动确认、不自动到账。</span></div></div>';
  }

  function amtCardHtml(vm, k, v, sub, cnt) {
    return '<div class="card uh-amtcard"><div class="k">' + k + '</div>' +
      '<div class="v"' + (cnt !== undefined ? ' data-count="' + cnt + '"' : "") + '>' + v + '</div><div class="sub">' + sub + "</div></div>";
  }

  function tab1Html(vm, V) {
    var can = !!V.canAct;
    var detailRows = (vm.detail || []).map(function (d, i) {
      var on = !!checked[d.id]; /* 批次四：DL v2 覆盖层核对态（刷新保留） */
      var st = on ? "已核对" : "待核对";
      var stCls = on ? "ok" : "";
      return '<div class="uh-dlrow' + (on ? " is-on" : "") + '" data-id="' + d.id + '">' +
        '<span class="uh-chk">' + (on ? "✓" : "") + '</span>' +
        '<div class="uh-dl"><div class="dln">' + esc(d.user) + "</div>" +
        '<div class="st">' + (ITEM_LABEL[d.item] || "其他付费") + " " + esc(d.order) + " · " + esc(d.date) + "</div></div>" +
        '<div class="m"><div class="amt">' + money(d.amount) + "</div><div class='st " + stCls + "'>" + st + "</div></div></div>";
    }).join("");
    var regRows = [].concat(vm.cur, vm.hist).map(function (r) {
      var isCur = r.calcId === vm.calc.id;
      var meta = (METHOD[r.method] || r.method) + " · " + r.date + " · 登记人 " + r.registeredBy +
        (r.signMethod === "esign" ? " · 电子签留痕" : (r.confirmedAt ? " · 双方确认记录" : ""));
      var note = r.reason ? '<div class="uh-note" style="margin-top:4px;">异议：' + esc(r.reason) + "</div>" : "";
      var acts = "";
      if (can && isCur && r.status === "pending_confirm") {
        acts = '<div class="btn-row" style="display:flex;gap:8px;margin-top:9px;">' +
          '<button class="btn btn-ghost" data-act="dispute" data-id="' + r.id + '">未收到/提异议</button>' +
          '<button class="btn btn-primary" data-act="confirm" data-id="' + r.id + '" disabled>核对无误·确认</button></div>';
      } else if (can && isCur && r.status === "disputed") {
        acts = '<div class="btn-row" style="display:flex;gap:8px;margin-top:9px;">' +
          '<button class="btn btn-primary" data-act="verify" data-id="' + r.id + '">线下核实后确认</button></div>';
      } else {
        acts = '<div class="btn-row" style="display:flex;gap:8px;margin-top:9px;">' +
          '<button class="btn btn-ghost" data-act="voucher" data-id="' + r.id + '">查看凭证</button></div>';
      }
      return '<div class="urs-item"' + (isCur ? "" : ' style="opacity:.72;"') + ">" +
        '<div class="urs-hd"><span class="urs-amt">' + money(r.amount) + '</span>' +
        '<span class="uh-badge uh-badge--' + (REG_CLS[r.status] || "mute") + '">' + (REG_TXT[r.status] || "—") + "</span>" +
        '<span style="margin-left:auto;font-size:11px;color:var(--text-3);">' + (isCur ? "" : "历史 · ") + "</span></div>" +
        '<div class="urs-meta">' + meta + "</div>" + note + acts + "</div>";
    }).join("") || '<div class="uh-note">暂无付款登记</div>';

    return '<div class="uh-pane on" id="p1">' +
      (vm.dueDay > 0 ? lockbarHtml(vm) : "") +
      amtCardHtml(vm, "本月省代应付款", money(vm.due),
        "合格消费 <b>" + money(vm.eligible) + "</b> × 约定 <b>50%</b> × 平台分成 <b>20%</b>", vm.due) +
      '<div class="card"><div class="uh-sechead" style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="lbl" style="font-size:var(--fs-base);font-weight:700;">对账收口</span></div>' +
      '<div class="uh-kv"><span class="k">应得（省代应付款）</span><span class="v">' + money(vm.tri.due) + "</span></div>" +
      '<div class="uh-kv"><span class="k">已核对明细</span><span class="v" id="kvDetail">' + money(checkedSum(vm)) + " / " + money(vm.eligible) + "</span></div>" +
      '<div class="uh-kv"><span class="k">已确认到账</span><span class="v" id="kvConfirm">' + money(vm.tri.confirmed) + "</span></div>" +
      '<div class="uh-kv"><span class="k">未收口差异</span><span class="v" id="kvDiff" style="color:var(--warning-ink);">' + money(vm.tri.due - vm.tri.confirmed) + "</span></div>" +
      '<div class="uh-progress"><div class="prow"><span>明细核对 <b id="prDet">0%</b></span><span>确认到账 <b id="prCfm">' + Math.round(vm.tri.confirmed / (vm.tri.due || 1) * 100) + '%</b></span></div>' +
      '<div class="uh-ptrack"><div class="seg seg--detail" id="segDet" style="width:0%"></div><div class="seg seg--confirm" id="segCfm" style="width:' + Math.round(vm.tri.confirmed / (vm.tri.due || 1) * 100) + '%"></div></div></div></div>' +
      '<div class="card"><div class="uh-verdict uh-verdict--bad" id="verdict">' +
      '<div class="tx"><span class="vt" id="vdT">有差异 ' + money(vm.tri.due - vm.tri.confirmed) + " 待收口</span>" +
      '<span class="vs" id="vdS">先逐笔核对明细，再确认到账</span></div>' +
      '<button class="go" id="vdGo">去对账</button></div>' +
      '<div class="uh-diffnote"><span class="ic">ℹ</span><span>' + vm.readNote + "</span></div></div>" +
      '<div class="card"><div class="uh-sechead" style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="lbl" style="font-size:var(--fs-base);font-weight:700;">逐笔核对 · 明细</span>' +
      (can ? '<span class="more" id="checkAll" style="margin-left:auto;font-size:var(--fs-sm);color:var(--primary-dim);font-weight:600;">全选核对</span>' : "") + "</div>" +
      '<div id="dlList">' + detailRows + "</div>" +
      '<div class="uh-readnote" style="margin-top:10px;"><span class="ic">ℹ</span><span>勾选明细计入对账进度；明细全部核对后，「核对无误·确认」才可操作（同一笔款只计一次）。</span></div></div>' +
      '<div class="card"><div class="uh-sechead" style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="lbl" style="font-size:var(--fs-base);font-weight:700;">付款登记与凭证</span></div>' +
      '<div id="regList">' + regRows + "</div></div></div>";
  }

  function tab2Html(vm) {
    var bars = [
      { m: "2026-10", v: vm.sub.agreed, pct: 100, cur: true },
      { m: "2026-09", v: vm.prevRow.agreed, pct: Math.max(Math.round(vm.prevRow.agreed / (vm.sub.agreed || 1) * 100), 18), cur: false }
    ];
    return '<div class="uh-pane" id="p2">' +
      amtCardHtml(vm, "本月应得（实得口径）", money(vm.sub.agreed),
        "合格消费 <b>" + money(vm.sub.eligible) + "</b> × 约定 <b>50%</b> × 平台分成 <b>20%</b>", vm.sub.agreed) +
      '<div class="card"><div class="uh-sechead" style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="lbl" style="font-size:var(--fs-base);font-weight:700;">应得趋势</span>' +
      '<span class="more" style="margin-left:auto;font-size:var(--fs-sm);color:var(--text-3);">10 月 / 9 月</span></div>' +
      '<div class="uh-trend">' + bars.map(function (b) {
        return '<div class="uh-tr-col' + (b.cur ? " cur" : "") + '"><div class="bar" style="height:' + (b.pct >= 100 ? 64 : Math.round(64 * b.pct / 100)) + 'px"></div>' +
          '<span class="tv">' + money(b.v) + '</span><span class="tm">' + b.m + "</span></div>";
      }).join("") + "</div></div>" +
      '<div class="card"><div class="uh-sechead" style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="lbl" style="font-size:var(--fs-base);font-weight:700;">月度台账</span>' +
      '<span class="more" style="margin-left:auto;font-size:var(--fs-sm);color:var(--text-3);">合格消费 → 应得</span></div>' +
      '<table class="uh-ltable"><tr><th>月份</th><th>合格消费</th><th>约定</th><th>应得</th><th>状态</th></tr>' +
      '<tr><td>2026-10</td><td>' + money(vm.sub.eligible) + "</td><td>20%</td><td>" + money(vm.sub.agreed) + '</td><td class="ok">核算中</td></tr>' +
      '<tr><td>2026-09</td><td>' + money(vm.prevRow.eligible) + "</td><td>20%</td><td>" + money(vm.prevRow.agreed) + '</td><td class="ok">已结</td></tr>' +
      "</table></div></div>";
  }

  function stCardHtml(vm, st, month, due, diff, extra) {
    var badge = '<span class="uh-tier uh-tier--s">省代→二级</span>';
    var stB = st === "open"
      ? '<span class="uh-badge uh-badge--wait">对账中</span>'
      : '<span class="uh-badge uh-badge--ok">已平账</span>';
    return '<div class="card uh-st-card"><div class="uh-st-hd"><span class="month">' + month + "</span>" + badge + stB +
      (st === "open" ? '<button class="go" data-go="p1">去对账 ›</button>' : "") + "</div>" +
      '<div class="uh-st-body">' + extra + "</div></div>";
  }

  function tab3Html(vm) {
    var cell = function (k, v, cls) {
      return '<div class="uh-st-cell"><div class="k">' + k + '</div><div class="v' + (cls ? " " + cls : "") + '">' + v + "</div></div>";
    };
    var openCell = cell("应付款", money(vm.tri.due)) +
      cell("差异", money(vm.tri.due - vm.tri.registered), "diff") +
      cell("待确认/异议", (vm.tri.pendingCnt > 0 ? vm.tri.pendingCnt + " / " : "0 / ") + money(vm.tri.disputed) + "", null);
    var closedCell = cell("应付款", money(vm.prevRow.settled)) +
      cell("差异", money(0), "ok") +
      cell("已确认", money(vm.prevRow.settled), "ok");
    return '<div class="uh-pane" id="p3">' +
      stCardHtml(vm, "open", "2026-10", vm.tri.due, 0, openCell) +
      stCardHtml(vm, "balanced", "2026-09", vm.prevRow.settled, 0, closedCell) +
      "</div>";
  }

  function emptyHtml(vm) {
    return '<div class="uh-pane on" id="p1"><div class="card" style="padding:34px 16px;text-align:center;color:var(--text-3);">暂无对账数据</div></div>';
  }

  /* ---------- 挂载（契约：renderCurrent 调 mount(container, ctx, Uni)） ---------- */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    if (!vm.calc) { el.innerHTML = emptyHtml(vm); bindTabs(el); return; }
    loadDetailChecked(vm); /* 批次四：DL v2 载入核对记录（刷新保留） */
    var html = tabsHtml(vm) + tab1Html(vm, V) + tab2Html(vm) + tab3Html(vm);
    /* 批次九 L2：页级粘性底栏（Tab1 显示，Tab2/3 隐藏由 bindTabs 切换） */
    html += '<div class="uh-stickybar">' + sbHtml() + '</div>';
    el.innerHTML = html;
    bindTabs(el);
    if (V.canAct) { bindDl(el, vm, ctx, Uni); bindReg(el, vm, ctx, Uni); }
    refresh(vm); /* 初始进度/结论条/确认按钮态对齐 DL v2 */
    /* 批次九 L8：应付款大数字 count-up（420ms ease-out；reduced-motion 直跳） */
    var cnum = el.querySelector("[data-count]");
    if (cnum) Uni.countUp(cnum, parseFloat(cnum.getAttribute("data-count")), 420, money);
    /* 批次九 L2：底栏主按钮点击 → 回 Tab1（对账核对）；文案由 refresh 同步 */
    var sbGo = el.querySelector("#sbGo");
    if (sbGo) sbGo.addEventListener("click", function () {
      [].forEach.call(el.querySelectorAll(".uls-tab"), function (t) { t.classList.toggle("active", t.dataset.p === "p1"); });
      [].forEach.call(el.querySelectorAll(".uh-pane"), function (p) { p.classList.toggle("on", p.id === "p1"); });
      var sbx = el.querySelector(".uh-stickybar");
      if (sbx) sbx.classList.remove("is-empty");
    });
  }

  function bindTabs(el) {
    var tabs = el.querySelector(".uls-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest(".uls-tab"); if (!b) return;
      [].forEach.call(tabs.children, function (t) { t.classList.toggle("active", t === b); });
      [].forEach.call(el.querySelectorAll(".uh-pane"), function (p) { p.classList.toggle("on", p.id === b.dataset.p); });
      var sbx = el.querySelector(".uh-stickybar");
      if (sbx) sbx.classList.toggle("is-empty", b.dataset.p !== "p1");
      el.querySelector(".scroll") && el.querySelector(".scroll").scrollTop !== undefined
        && (el.querySelector(".scroll").scrollTop = 0);
    });
    var go = el.querySelector("[data-go='p1']");
    if (go) go.addEventListener("click", function () {
      [].forEach.call(tabs.children, function (t) { t.classList.toggle("active", t.dataset.p === "p1"); });
      [].forEach.call(el.querySelectorAll(".uh-pane"), function (p) { p.classList.toggle("on", p.id === "p1"); });
    });
  }

  /* 方案 A：勾选明细 → 进度/结论条联动（批次四：Uni.detailState DL v2 持久化，刷新保留） */
  var checked = {};
  function loadDetailChecked(vm) {
    checked = {};
    var cid = vm.calc && vm.calc.id;
    if (!cid) return;
    (Uni.detailState.get(cid) || []).forEach(function (r) { checked[r.id] = r; });
  }
  function checkedSum(vm) { return vm.detail.reduce(function (t, d) { return t + (checked[d.id] ? d.amount : 0); }, 0); }
  function allChecked(vm) { return vm.detail.length > 0 && vm.detail.every(function (d) { return !!checked[d.id]; }); }

  function paintDl(vm) {
    var rows = el_cur().querySelectorAll(".uh-dlrow");
    rows.forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.classList.toggle("on", !!checked[id]);
      var st = row.querySelector(".m .st");
      if (st) {
        if (checked[id]) { st.textContent = "已核对"; st.className = "st ok"; }
        else { st.textContent = "待核对"; st.className = "st"; }
      }
      var chk = row.querySelector(".uh-chk");
      if (chk) chk.textContent = checked[id] ? "✓" : "";
    });
  }
  function refresh(vm) {
    var cs = checkedSum(vm);
    var prDet = Math.round(cs / (vm.eligible || 1) * 100);
    var prCfm = vm.confirmedAmt > 0 ? 100 : 0;
    var diff = (vm.due - vm.confirmedAmt);
    var q = el_cur();
    q.querySelector("#kvDetail").textContent = money(cs) + " / " + money(vm.eligible);
    q.querySelector("#kvConfirm").textContent = money(vm.confirmedAmt);
    var kvD = q.querySelector("#kvDiff");
    kvD.textContent = money(diff);
    kvD.style.color = diff ? "var(--warning-ink)" : "var(--success)";
    q.querySelector("#prDet").textContent = prDet + "%";
    q.querySelector("#prCfm").textContent = (prCfm) + "%";
    q.querySelector("#segDet").style.width = prDet + "%";
    q.querySelector("#segCfm").style.width = prCfm + "%";
    var v = q.querySelector("#verdict");
    if (vm.confirmedAmt > 0) {
      v.className = "uh-verdict uh-verdict--ok";
      q.querySelector("#vdT").textContent = "差异已收口 " + money(0);
      q.querySelector("#vdS").textContent = vm.detail.length + "/" + vm.detail.length + " 明细已核对 · 到账已确认 · 等待省代平账";
      q.querySelector("#vdGo").textContent = "查看平账";
    } else if (allChecked(vm)) {
      v.className = "uh-verdict uh-verdict--bad";
      q.querySelector("#vdT").textContent = "明细已全部核对 · 待确认到账";
      q.querySelector("#vdS").textContent = "点击登记行「核对无误·确认」完成收口";
      q.querySelector("#vdGo").textContent = "去确认";
    } else {
      v.className = "uh-verdict uh-verdict--bad";
      q.querySelector("#vdT").textContent = "有差异 " + money(diff) + " 待收口";
      q.querySelector("#vdS").textContent = "先逐笔核对明细，再确认到账";
      q.querySelector("#vdGo").textContent = "去对账";
    }
    var cb = q.querySelector("[data-act='confirm']");
    if (cb) cb.disabled = !allChecked(vm) || vm.confirmedAmt > 0;
    /* 批次九 L2：粘性底栏主按钮文案随状态同步（查看平账/去确认/去对账） */
    var sbGo = el.querySelector("#sbGo");
    if (sbGo) {
      var go = q.querySelector("#vdGo");
      sbGo.textContent = go ? go.textContent : "去对账";
    }
  }
  var el_cur = function () { return document.getElementById("ag-view"); };

  function bindDl(el, vm, ctx, Uni) {
    var list = el.querySelector("#dlList");
    if (!list) return;
    list.addEventListener("click", function (e) {
      var row = e.target.closest(".uh-dlrow"); if (!row) return;
      var id = row.getAttribute("data-id");
      var on = !checked[id];
      checked[id] = on ? { state: "checked" } : null;
      Uni.detailState.set(vm.calc.id, id, on ? "checked" : null, ctx.identity);
      paintDl(vm); refresh(vm);
    });
    var all = el.querySelector("#checkAll");
    if (all) all.addEventListener("click", function () {
      vm.detail.forEach(function (d) { checked[d.id] = { state: "checked" }; });
      vm.detail.forEach(function (d) { Uni.detailState.set(vm.calc.id, d.id, "checked", ctx.identity); });
      paintDl(vm); refresh(vm);
    });
  }

  function bindReg(el, vm, ctx, Uni) {
    var box = el.querySelector("#regList");
    if (!box) return;
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]"); if (!btn) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      if (act === "confirm") {
        vm.confirmedAmt = vm.tri.due;
        if (vm.calc && vm.calc.id) Uni.detailState.confirmBill(vm.calc.id, ctx.identity);
        loadDetailChecked(vm); /* checked → confirmed 升级同步内存（UI 勾选态不变） */
        paintDl(vm); refresh(vm); return;
      }
      var rec = (vm.cur.concat(vm.hist)).filter(function (r) { return r.id === id; })[0];
      if (!rec) return;
      if (act === "voucher" && rec.vouchers && rec.vouchers[0]) Uni.voucherCenter(rec.vouchers[0]);
      if (act === "dispute" || act === "verify") Uni.toast("线下核实后可确认 / 提异议（演示层：见对账中心原子页操作）", "info");
    });
  }

  /* ---------- 身份变体 ---------- */
  var STATE_VARIANTS = {
    sub_admin: {
      label: "二级合作企业 · 管理员",
      canAct: true,
      data: function (ctx) {
        return buildVm(ctx, {
          notice: "对账核对、台账与对账单为同一对账数据的三视图；仅管理员可操作确认/异议。",
          lockedNote: "对账核对与确认操作仅管理员可操作"
        });
      },
      entries: [],
      perms: { reconcile: true },
      badges: {},
      empty: {},
      lockedNote: "对账核对与确认操作仅管理员可操作"
    },
    sub_legal: {
      label: "二级合作企业 · 法代",
      canAct: false,
      data: function (ctx) { return buildVm(ctx, { notice: "只读视图：全部 tab 仅可查看。", lockedNote: "全部 tab 仅可查看" }); },
      entries: [],
      perms: {},
      badges: { reconcile: "法代 · 只读" },
      empty: {},
      lockedNote: "全部 tab 仅可查看"
    },
    sub_staff: {
      label: "二级合作企业 · 员工",
      canAct: false,
      data: function (ctx) { return buildVm(ctx, { notice: "只读视图：全部 tab 仅可查看。", lockedNote: "全部 tab 仅可查看" }); },
      entries: [],
      perms: {},
      badges: { reconcile: "员工 · 只读" },
      empty: {},
      lockedNote: "全部 tab 仅可查看"
    }
  };

  window.Uni.register({
    view: "uni-reconcile-hub-sub",
    route: "reconcile-hub-sub.html",
    modes: ["sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    skeleton: true,
    mount: mount
  });
})();
