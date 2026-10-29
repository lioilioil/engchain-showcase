/* ============================================================
   uni-reconcile.js · 对账中心（modes=['province']，sub 域自动回落 home）
   顶部卷宗 tab（卷宗01=我与平台 L1 / 卷宗02=我与二级企业 L2，
   样式复用二级合作页胶囊 bar：uni-subs.css .uls-tabs/.uls-tab，不新建样式）；
   卷宗 bar 随页滚动吸顶（sticky，监听文件级单例防重复绑定）；
   卷宗内容按功能目标拆为多张卡片：卡1 卷宗现状（差异/截止/进度/下一步提示）、
   卡2 逐笔核对（订单明细）、卡3 待办事项（待处理登记+收口动作）、
   卡4 登记与凭证留痕（凭证档案），各卡一功能、标题即分隔；
   历史对账记录已迁移至独立页 reconcile-history.html，本页不再渲染。
   同一带模板 ×2，仅数据换源。
   组件视觉全部为系统类（.card/.btn/.seg/.input/.textarea/.uh-* 基元）；
   弹窗/Toast 一律经 Uni.sheet / Uni.center / Uni.dialog / Uni.toast。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var METHOD = { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" };
  var REG_CLS = { pending_confirm: "wait", confirmed: "ok", disputed: "bad", void: "mute" };
  var STEPS = ["出账", "登记", "确认", "平账留痕"];

  /* 当前卷宗 tab（文件级：actGuarded 触发全量重挂载后保持所在卷宗） */
  var _tab = "1";

  /* 卷宗 tab 吸顶（文件级单例：滚动监听只绑一次，重挂载仅换目标元素） */
  var _stickyBar = null, _stickyScroller = null;
  function stickyHandler() {
    if (_stickyBar && _stickyScroller) _stickyBar.classList.toggle("is-stuck", _stickyScroller.scrollTop > 8);
  }
  function wireSticky(el) {
    var bar = el.querySelector(".uc-bandtabs");
    var sc = el.closest(".scroll");
    if (!bar || !sc) return;
    if (_stickyScroller !== sc) {
      if (_stickyScroller) _stickyScroller.removeEventListener("scroll", stickyHandler);
      _stickyScroller = sc;
      sc.addEventListener("scroll", stickyHandler, { passive: true });
    }
    _stickyBar = bar;
    stickyHandler();
  }

  /* 逐笔核对状态（本地覆盖层：按账单 calcId 记录已核对明细 id） */
  var DL_KEY = "engchain-uni-detail-v1";
  function loadChecked() { try { return JSON.parse(localStorage.getItem(DL_KEY)) || {}; } catch (e) { return {}; } }
  function checkedIds(calcId) { return loadChecked()[calcId] || []; }
  function toggleChecked(calcId, id) {
    var o = loadChecked();
    var a = o[calcId] || [];
    var i = a.indexOf(id);
    if (i > -1) a.splice(i, 1); else a.push(id);
    o[calcId] = a;
    try { localStorage.setItem(DL_KEY, JSON.stringify(o)); } catch (e) {}
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        return { canAct: true, note: null };
      },
      entries: [],
      perms: { act: true },
      badges: {},
      empty: {},
      lockedNote: "登记、异议、确认与平账均已锁定"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        return {
          canAct: false,
          note: "数据仅可查看；登记付款、提出异议、确认到账与月度平账仅管理员可操作。"
        };
      },
      entries: [],
      perms: { act: false },
      badges: {},
      empty: {},
      lockedNote: "全部经营动作已锁定，仅可查看"
    },
    sub_admin: {
      /* 本路由仅 province 模式可达；此处仅为 schema 完整性 */
      label: "二级合作企业 · 管理员",
      data: function (ctx) { return { canAct: false, note: null }; },
      entries: [],
      perms: { act: false },
      badges: {},
      empty: {},
      lockedNote: null
    }
  };

  /* ---------- 对账时限：剩余天数 / 逾期 ---------- */
  function remainDays(dueAt) {
    if (!dueAt) return 1;
    var due = new Date(dueAt + "T23:59:59");
    return Math.ceil((due - new Date()) / 86400000);
  }
  function dueBarHtml(calc) {
    if (!calc.dueAt) return "";
    var d = remainDays(calc.dueAt);
    var cls = d < 0 ? "over" : (d === 0 ? "zero" : "ok");
    var txt = d < 0
      ? "对账已逾期 · 该月对账状态已锁定，仅可查看"
      : (d === 0 ? "今天 23:59 截止对账 · 请尽快完成核对确认" : "对账截止 " + calc.dueAt + " · 剩余 " + d + " 天");
    return '<div class="uc-due uc-due--' + cls + '">' + ui.icon(d < 0 ? "lock" : "clock", 14) + '<span>' + txt + '</span></div>';
  }

  /* ---------- 带模型（纯数据折算） ---------- */
  function bandModel(ctx, layer) {
    var s = ctx.s;
    var calc = layer === "1" ? s.calc1 : s.calc2;
    var regs = layer === "1" ? s.payRegs1 : s.payRegs2;
    var cur = regs.filter(function (r) { return r.calcId === calc.id; });
    var history = regs.filter(function (r) { return r.calcId !== calc.id; });
    var sum = store.regsSum(regs, calc.id);
    var diff = calc.calcAmount - sum;
    var st = s.statements.filter(function (x) { return x.calcId === calc.id; })[0];
    var pending = cur.filter(function (r) { return r.status === "pending_confirm"; });
    var disputed = cur.filter(function (r) { return r.status === "disputed"; });
    var confirmedCount = cur.filter(function (r) { return r.status === "confirmed"; }).length;

    var state, step; // state: balanced/disputed/diff/pending/ready
    if (st && st.status === "balanced") { state = "balanced"; step = 4; }
    else if (disputed.length) { state = "disputed"; step = 3; }
    else if (pending.length) { state = "pending"; step = 2; }
    else if (diff === 0) { state = "ready"; step = 3; }
    else { state = "diff"; step = 2; }

    /* 逾期判定：出账后 5 天对账窗口，超期且未平账 → 锁定该月对账 */
    var overdue = !!calc.dueAt && new Date(calc.dueAt + "T23:59:59") < new Date() && !(st && st.status === "balanced");

    return {
      layer: layer, calc: calc, cur: cur, history: history,
      diff: diff, sum: sum, state: state, step: step,
      overdue: overdue,
      pending: pending, disputed: disputed,
      meta: "登记 " + cur.length + " 笔 · 已确认 " + confirmedCount + " 笔 · 异议 " + disputed.length + " 笔",
      counterpart: layer === "1" ? "我与平台" : "我与二级企业"
    };
  }

  /* 按状态求和（口径与 store.regsSum 一致：不含冲销） */
  function sumOf(regs, status) {
    var t = 0;
    regs.forEach(function (r) { if (!status || r.status === status) t += Number(r.amount || 0); });
    return t;
  }

  /* 下一步提示：把状态转成一句话执行路径（直指待办，减少理解成本） */
  function bandHint(bm) {
    if (bm.state === "balanced") return "本卷宗已完成对账并平账留痕，无待办事项。";
    if (bm.overdue) return "该月对账已锁定，仅可查看凭证与明细。";
    var parts = [];
    if (bm.disputed.length) parts.push(bm.disputed.length + " 笔异议待线下核实");
    if (bm.pending.length) parts.push(bm.pending.length + " 笔登记待确认到账");
    if (bm.diff > 0) parts.push("差额 " + ui.money(bm.diff) + " 待登记线下付款或补录");
    else if (!bm.pending.length && !bm.disputed.length) parts.push("金额已对齐，可进行平账留痕");
    return parts.length ? "下一步：" + parts.join("；") + "。" : "";
  }

  /* ---------- 登记行卡 ---------- */
  function regHtml(r, bm, canAct) {
    var badgeCls = REG_CLS[r.status] || "mute";
    var row = '<div class="uc-reg' + (bm.cur.indexOf(r) < 0 ? " is-history" : "") + '">' +
      '<div class="uc-reg__hd">' +
      '<span class="uc-reg__amt">' + ui.money(r.amount) + '</span>' +
      '<span class="uh-badge uh-badge--' + badgeCls + '">' + ui.REG[r.status] + '</span>' +
      '<span style="flex:1"></span>' +
      '<button class="btn btn-ghost btn-sm" data-voucher="' + ui.esc(r.id) + '">查看凭证</button>' +
      '</div>' +
      '<div class="uc-reg__meta">' + (METHOD[r.method] || r.method) + " · " + ui.esc(r.date) +
      " · 登记人 " + ui.esc(r.registeredBy) +
      (r.signMethod === "esign" ? " · 电子签留痕" : (r.confirmedAt ? " · 双方确认记录" : "")) +
      "</div>";
    if (r.reason) row += '<div class="uc-reg__note">异议：' + ui.esc(r.reason) + '</div>';
    if (r.verifiedNote) row += '<div class="uc-reg__note">线下核实：' + ui.esc(r.verifiedNote) + '</div>';
    if (r.voidInfo) row += '<div class="uc-reg__note">已冲销：' + ui.esc(r.voidInfo.reason) + "（" + ui.esc(r.voidInfo.at) + "）</div>";

    /* 动作区：仅 boss 当前月未平账行 */
    if (canAct && bm.cur.indexOf(r) >= 0) {
      var acts = "";
      if (r.status === "pending_confirm" && bm.layer === "1") {
        acts = '<button class="btn btn-ghost btn-sm" data-act="dispute" data-id="' + ui.esc(r.id) + '" style="flex:1">提出异议</button>' +
          '<button class="btn btn-primary btn-sm" data-act="confirm" data-id="' + ui.esc(r.id) + '" style="flex:1">核对无误·确认</button>';
      } else if (r.status === "pending_confirm" && bm.layer === "2") {
        acts = '<button class="btn btn-ghost btn-sm" data-act="remind" data-id="' + ui.esc(r.id) + '" style="flex:1">提醒二级确认</button>';
      } else if (r.status === "disputed" && bm.layer === "2") {
        acts = '<button class="btn btn-danger btn-sm" data-act="void" data-id="' + ui.esc(r.id) + '" style="flex:1">冲销作废</button>' +
          '<button class="btn btn-primary btn-sm" data-act="verify" data-id="' + ui.esc(r.id) + '" style="flex:1">线下核实后确认</button>';
      }
      if (acts) row += '<div class="btn-row uc-reg__acts">' + acts + '</div>';
    }
    return row + '</div>';
  }

  /* ---------- 逐笔核对区块（订单明细列表 + 核对状态 + 合计） ---------- */
  function bandDetailHtml(bm, canAct, Uni) {
    var calc = bm.calc;
    var detail = calc.detail || [];
    if (!detail.length) return "";
    var checked = checkedIds(calc.id);
    var sumOn = 0;
    var rows = detail.map(function (d) {
      var on = checked.indexOf(d.id) > -1;
      if (on) sumOn += d.amount;
      return '<button type="button" class="uc-dlrow' + (on ? " is-on" : "") + '" data-dl="' + ui.esc(d.id) + '"' +
        (canAct ? "" : ' disabled aria-disabled="true"') + '>' +
        '<span class="amt">' + ui.money(d.amount) + '</span>' +
        '<span class="info"><span class="nm">' + ui.esc(d.user) + '</span>' +
        '<span class="od">' + Uni.itemTag(d.item) + ' ' + ui.esc(d.order) + ' · ' + ui.esc(d.date) + '</span></span>' +
        '<span class="uh-badge uh-badge--' + (on ? "ok" : "wait") + '">' + (on ? "已核对" : "待核对") + '</span>' +
        '</button>';
    }).join("");
    /* 列表直接置于卡片内（.uc-dlrow 自带 hairline 分隔），不嵌套 .card，避免卡中卡 */
    return '<div class="uh-sechead"><span class="lbl">逐笔核对</span>' +
      '<span class="uh-badge uh-badge--mute">已核对 ' + checked.length + '/' + detail.length + '</span></div>' +
      rows +
      '<div class="uc-dlsec__sum"><span>已核对金额 ' + ui.money(sumOn) + '</span>' +
      '<span>明细合计 ' + ui.money(calc.eligibleBase) + '</span></div>' +
      (canAct ? '<div class="uh-note" style="margin-top:6px">逐笔确认订单计入合格消费分润；异议中金额不计入已登记到账，线下凭证核实后闭环。</div>' : "");
  }

  /* ---------- 生命节点 ---------- */
  function lifeHtml(bm) {
    var out = "";
    for (var i = 1; i <= 4; i++) {
      var cls = i < bm.step ? "done" : (i === bm.step && bm.state !== "balanced" ? "cur" : "");
      if (bm.state === "balanced") cls = "done";
      out += '<div class="uc-life__step ' + cls + '"><span class="dot"></span><span class="lb">' + STEPS[i - 1] + '</span></div>';
    }
    return '<div class="uc-life">' + out + '</div>';
  }

  /* ---------- 带底动作 ---------- */
  function bandFoot(bm, canAct) {
    if (!canAct) return "";
    var btns = "";
    if (bm.state === "diff" || (bm.state === "disputed" && bm.diff > 0)) {
      btns += '<button class="btn btn-primary btn-sm" data-act="addreg" data-layer="' + bm.layer + '" style="flex:1">登记线下付款</button>';
    }
    if (bm.state === "ready") {
      btns += '<button class="btn btn-primary btn-sm" data-act="balance" data-layer="' + bm.layer + '" style="flex:1">平账留痕</button>';
    }
    return btns ? '<div class="btn-row uc-band__ft">' + btns + '</div>' : "";
  }

  function bandHtml(bm, canAct, Uni) {
    var cur = bm.cur;
    var confSum = sumOf(cur, "confirmed");
    /* 待办：当月未闭环登记（异议/待确认）；留痕：当月已闭环 + 历史月登记（只读档案） */
    var actRegs = cur.filter(function (r) { return r.status === "pending_confirm" || r.status === "disputed"; });
    var archRegs = cur.filter(function (r) { return r.status === "confirmed" || r.status === "void"; }).concat(bm.history);

    /* ---- 卡1 · 卷宗现状：状态 / 差异焦点 / 截止期 / 进度 / 下一步提示 ---- */
    var focusNum = bm.state === "balanced"
      ? '<div class="uh-bignum" style="font-size:26px">' + ui.moneyD(0) +
        '<span class="uc-zero-note">差异已清零</span></div>'
      : '<div class="uh-bignum">' + ui.moneyD(bm.diff) + '</div>';
    var hint = bandHint(bm);
    var hintCls = bm.state === "balanced" ? "ok" : (bm.state === "diff" || bm.disputed.length ? "no" : "");
    var headCard =
      '<section class="card uh-sec" data-band="' + bm.layer + '">' +
      (bm.overdue
        ? '<div class="uh-lockbar" style="margin:0 0 12px">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">对账已逾期 · 该月对账状态已锁定</span>' +
          '<span class="lb-s">已超过出账后 5 天对账期限，仅可查看凭证与明细，不可手动对账。</span></div></div>'
        : "") +
      '<div class="uh-finhead"><span class="uh-eyebrow">卷宗 0' + bm.layer + ' · ' + bm.counterpart + '</span>' +
      (bm.pending.length || bm.disputed.length
        ? '<span class="uh-badge uh-badge--wait">待处理 ' + (bm.pending.length + bm.disputed.length) + '</span>' :
        (bm.state === "balanced" ? '<span class="uh-badge uh-badge--ok">已平账</span>' :
          (bm.diff === 0 ? '<span class="uh-badge uh-badge--ok">金额已对齐</span>' : '<span class="uh-badge uh-badge--info">对账中</span>'))) +
      '</div>' +
      '<div class="uc-band__meta">' + ui.esc(bm.calc.month) + " · " + ui.esc(bm.calc.layer) + " · " + ui.esc(bm.calc.disputeDeadline) + '</div>' +
      dueBarHtml(bm.calc) +
      focusNum +
      '<div class="uc-band__sum">账单 ' + ui.money(bm.calc.calcAmount) + ' · 已登记 ' + ui.money(bm.sum) +
        ' · 已确认 ' + ui.money(confSum) + '</div>' +
      (hint ? '<div class="uc-band__hint' + (hintCls ? " " + hintCls : "") + '">' + ui.esc(hint) + '</div>' : "") +
      lifeHtml(bm) +
      '</section>';

    /* ---- 卡2 · 逐笔核对：订单明细（独立功能目标） ---- */
    var detailHtml = bandDetailHtml(bm, canAct, Uni);
    var detailCard = detailHtml
      ? '<section class="card uh-sec" data-band="' + bm.layer + '">' + detailHtml + '</section>'
      : "";

    /* ---- 卡3 · 待办事项：待处理登记 + 收口动作 ---- */
    var footHtml = bandFoot(bm, canAct);
    var todoCard = (actRegs.length || footHtml)
      ? '<section class="card uh-sec" data-band="' + bm.layer + '">' +
        '<div class="uh-sechead"><span class="lbl">待办事项</span>' +
        (actRegs.length ? '<span class="uh-badge uh-badge--wait">待处理 ' + actRegs.length + ' 笔</span>' : "") +
        '</div>' +
        (actRegs.length ? '<div class="uc-regs">' + actRegs.map(function (r) { return regHtml(r, bm, canAct); }).join("") + '</div>' : "") +
        footHtml +
        '</section>'
      : "";

    /* ---- 卡4 · 登记与凭证留痕：已闭环 + 历史月（凭证档案，只读） ---- */
    var archCard =
      '<section class="card uh-sec" data-band="' + bm.layer + '">' +
      '<div class="uh-sechead"><span class="lbl">登记与凭证留痕</span>' +
      '<span class="uh-badge uh-badge--mute">' + archRegs.length + ' 笔</span></div>' +
      (archRegs.length
        ? '<div class="uc-regs">' + archRegs.map(function (r) { return regHtml(r, bm, canAct); }).join("") + '</div>'
        : '<div class="uc-empty">该月暂无付款登记留痕</div>') +
      '</section>';

    return headCard + detailCard + todoCard + archCard;
  }

  /* ---------- 弹窗：登记线下付款 ---------- */
  function registerSheet(ctx, Uni, layer) {
    var bm = bandModel(ctx, layer);
    var remain = Math.max(bm.diff, 0);
    var vouchers = [];
    var sh = Uni.sheet({
      title: "登记线下付款",
      body:
        '<div class="uh-sheetkv"><span class="k">账单金额</span><span class="v">' + ui.money(bm.calc.calcAmount) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">未登记差额</span><span class="v">' + ui.money(remain) + '</span></div>' +
        '<div style="height:12px"></div>' +
        '<div class="field"><label class="field-label">金额</label><input class="input" id="ur-amount" type="number" value="' + remain + '"></div>' +
        '<div class="field"><label class="field-label">付款方式</label><div class="seg" data-pick>' +
        '<button class="seg-item active" data-v="bank">对公转账</button>' +
        '<button class="seg-item" data-v="wechat">微信/支付宝</button>' +
        '<button class="seg-item" data-v="cash">现金</button></div></div>' +
        '<div class="field"><label class="field-label">付款日期</label><input class="input" id="ur-date" type="date" value="2026-10-27" max="2026-10-31"></div>' +
        '<div class="field"><label class="field-label">付款凭证（必传）</label>' +
        '<div class="uc-upload" id="ur-voucher">' + ui.icon("camera", 22) + '<div>点击上传凭证图片</div></div>' +
        '<input type="file" id="ur-file" accept="image/*" hidden></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "提交登记", kind: "primary", onClick: function (sh) {
          var amount = Number(sh.querySelector("#ur-amount").value);
          var mit = sh.querySelector("[data-pick] .seg-item.active");
          var method = mit ? mit.getAttribute("data-v") : "bank";
          var date = sh.querySelector("#ur-date").value;
          if (!amount || amount <= 0) { Uni.toast("请填写正确金额"); return false; }
          if (!vouchers.length) { Uni.toast("请上传付款凭证（凭证强制）"); return false; }
          var r = Uni.actGuarded("pay/addReg", { layer: layer, data: { amount: amount, method: method, date: date, vouchers: vouchers } });
          if (r.ok) Uni.toast("已提交登记", "ok");
      } }]
    });
    var up = sh.querySelector("#ur-voucher"), file = sh.querySelector("#ur-file");
    up.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0]; if (!f) return;
      ui.fileToVoucher(f).then(function (v) {
        vouchers.push(v);
        up.innerHTML = ui.esc(v.name);
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

  /* ---------- 结算口径与时限说明（并入页底"费用计算范围"卡片右栏完整展示） ---------- */
  function rulesClauseHtml() {
    return '<div class="uh-clause"><div class="no">合格消费</div><div class="c">以平台月度合格消费账单为准；退货、退款、取消订单不计入。</div></div>' +
      '<div class="uh-clause"><div class="no">我与平台（第一层）</div><div class="c">T+5 工作日内可提出异议，双方补充凭证后核实闭环。</div></div>' +
      '<div class="uh-clause"><div class="no">我与二级企业（第二层）</div><div class="c">出账后 15 天内仅提醒，不自动确认、不自动到账。</div></div>' +
      '<div class="uh-clause"><div class="no">平账条件</div><div class="c">无未闭环异议、无待确认登记、差异 ¥0 后方可月度平账留痕。</div></div>' +
      '<div class="uh-clause"><div class="no">凭证强制</div><div class="c">线下付款必须上传凭证；冲销与确认均留痕。</div></div>';
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var isProvince = ctx.mode === "province"; /* 本页 modes=['province']，二级域不可达；bar 仅省代渲染 */

    /* 待办跳转钩子 ?focus=1/2：直接定位到对应卷宗 tab */
    var f = new URLSearchParams(window.location.search).get("focus");
    if (f === "1" || f === "2") _tab = f;

    var b1 = bandModel(ctx, "1");
    var b2 = bandModel(ctx, "2");

    /* 顶部卷宗 tab（卷宗01=我与平台 / 卷宗02=我与二级企业；
       样式复用二级合作页胶囊 bar uni-subs.css .uls-tabs/.uls-tab，不新建样式） */
    function tabsBar() {
      if (!isProvince) return "";
      /* .uc-bandtabs：卷宗 bar 吸顶容器（sticky，样式在 uni-reconcile.css） */
      return '<section class="uh-sec uc-bandtabs" style="margin-top:0"><div class="uls-tabs">' +
        [{ k: "1", t: "卷宗01" }, { k: "2", t: "卷宗02" }].map(function (x) {
          return '<button class="uls-tab' + (_tab === x.k ? " active" : "") + '" data-tab="' + x.k + '">' + x.t + "</button>";
        }).join("") + "</div></section>";
    }

    var html = "";
    if (vm.note) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + '<span>' + ui.esc(vm.note) + '</span></div></section>';
    }
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + '<span>' + ui.esc(V.lockedNote || "") + '</span></div></section>';
    }
    /* 只读（暂停）态下经营动作整体隐藏：与锁条文案一致，不留可点但应拒的按钮；
       逾期月（出账后 5 天窗口外）同样锁定对账操作 */
    var canAct1 = vm.canAct && !ctx.readonly && !b1.overdue;
    var canAct2 = vm.canAct && !ctx.readonly && !b2.overdue;
    html += tabsBar();
    /* 卷宗 tab 切换：仅渲染当前卷宗带（历史对账记录已迁移至独立页 reconcile-history.html） */
    html += (_tab === "2" ? bandHtml(b2, canAct2, Uni) : bandHtml(b1, canAct1, Uni));

    /* 计费范围 + 结算口径与时限说明：同一卡片内并列两栏，置于页面最下方 */
    html += Uni.scopeCard(rulesClauseHtml());

    el.innerHTML = html;
    wireSticky(el); /* 卷宗 tab 吸顶：重挂载后重新绑定目标元素（监听器文件级单例） */

    /* 卷宗 tab 切换（省代双卷宗；二级域不可达本页） */
    el.querySelectorAll("[data-tab]").forEach(function (n) {
      n.addEventListener("click", function () {
        _tab = n.getAttribute("data-tab");
        mount(el, ctx, Uni);
      });
    });

    /* 凭证预览（统一系统回单卡渲染） */
    el.querySelectorAll("[data-voucher]").forEach(function (n) {
      n.addEventListener("click", function () {
        var id = n.getAttribute("data-voucher");
        var regs = ctx.s.payRegs1.concat(ctx.s.payRegs2);
        var rec = regs.filter(function (r) { return r.id === id; })[0];
        if (rec && rec.vouchers && rec.vouchers[0]) Uni.voucherCenter(rec.vouchers[0]);
      });
    });

    /* 逐笔核对：负责人逐笔标记（本地覆盖层持久，跨页生效） */
    var calc1 = ctx.s.calc1 || { id: "c1-l1" }, calc2 = ctx.s.calc2 || { id: "c1-l2" };
    el.querySelectorAll("[data-dl]").forEach(function (n) {
      n.addEventListener("click", function () {
        if (ctx.readonly || !vm.canAct) { Uni.toast("逐笔核对仅管理员可操作", "err"); return; }
        var band = n.closest("[data-band]");
        var layer = band ? band.getAttribute("data-band") : "1";
        var calcId = layer === "1" ? calc1.id : calc2.id;
        toggleChecked(calcId, n.getAttribute("data-dl"));
        Uni.toast(checkedIds(calcId).indexOf(n.getAttribute("data-dl")) > -1 ? "已核对该笔订单" : "已取消核对", "ok");
        mount(el, ctx, Uni);
      });
    });

    el.querySelectorAll("[data-act]").forEach(function (n) {
      if (n.getAttribute("data-voucher")) return;
      var act = n.getAttribute("data-act");
      var layer = n.getAttribute("data-layer") || (n.closest("[data-band]") || {}).getAttribute && n.closest("[data-band]").getAttribute("data-band");
      var id = n.getAttribute("data-id");
      n.addEventListener("click", function () {
        if (ctx.readonly) { Uni.toast(V.lockedNote || "当前为只读态，经营动作已锁定"); return; }
        if (act === "addreg") return registerSheet(ctx, Uni, layer);
        if (act === "balance") return Uni.actGuarded("stmt/balance", { layer: layer });
        if (act === "remind") return Uni.actGuarded("msg/add", { msg: { icon: "bell", type: "info", title: "已提醒二级企业确认收款", to: "reconcile.html" } });
        if (act === "dispute") {
          Uni.sheet({
            title: "提出异议",
            body: '<div class="uh-readnote" style="margin-bottom:10px">T+5 工作日异议期内提出，双方补充凭证后线下核实。</div>' +
              '<div class="field"><label class="field-label">异议说明</label>' +
              '<textarea class="textarea" id="ur-d-reason" placeholder="例如：回单金额与账单相差 ¥240，待核实"></textarea></div>',
            footer: [{ t: "取消", kind: "ghost" },
            { t: "提交异议", kind: "danger", onClick: function (sh) {
                var v = sh.querySelector("#ur-d-reason").value.trim();
                Uni.actGuarded("pay/dispute", { layer: layer, id: id, reason: v });
            } }]
          });
          return;
        }
        if (act === "confirm") {
          var rec = b1.cur.concat(b2.cur).filter(function (r) { return r.id === id; })[0];
          Uni.sheet({
            title: "核对付款",
            body: '<div class="uh-sheetkv"><span class="k">付款登记</span><span class="v">' + ui.money(rec ? rec.amount : 0) + '</span></div>' +
              '<div class="uh-sheetkv"><span class="k">方式</span><span class="v">对公转账</span></div>' +
              '<div class="uh-note">确认即代表已核对到账金额与凭证一致。</div>',
            footer: [{ t: "取消", kind: "ghost" },
            { t: "确认到账（记录）", kind: "ghost", onClick: function () {
                Uni.actGuarded("pay/confirm", { layer: layer, id: id, signMethod: "record" });
            } },
            { t: "电子签留痕", kind: "primary", onClick: function () {
                Uni.actGuarded("pay/confirm", { layer: layer, id: id, signMethod: "esign" });
            } }]
          });
          return;
        }
        if (act === "verify") {
          Uni.sheet({
            title: "线下核实后确认",
            body: '<div class="field"><label class="field-label">核实说明</label>' +
              '<textarea class="textarea" id="ur-v-note" placeholder="线下核实情况说明（必填）"></textarea></div>',
            footer: [{ t: "取消", kind: "ghost" },
            { t: "确认到账", kind: "primary", onClick: function (sh) {
                var v = sh.querySelector("#ur-v-note").value.trim();
                if (!v) { Uni.toast("异议记录须填写线下核实说明后再确认"); return false; }
                Uni.actGuarded("pay/confirm", { layer: layer, id: id, verifiedNote: v });
            } }]
          });
          return;
        }
        if (act === "void") {
          return Uni.dialog({
            title: "冲销该登记？", text: "冲销后该笔登记作废，可重新登记。已确认记录不可冲销。",
            ok: "确认冲销", cancel: "取消", danger: true,
            onOk: function () { Uni.actGuarded("pay/void", { layer: layer, id: id, reason: "信息登记错误，冲销后重登" }); }
          });
        }
      });
    });
  }

  window.Uni.register({
    view: "uni-reconcile",
    route: "reconcile.html",
    modes: ["province"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
