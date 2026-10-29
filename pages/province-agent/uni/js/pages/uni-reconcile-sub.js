/* ============================================================
   uni-reconcile-sub.js · 对账中心（二级企业收款确认 · reconcile-sub.html）
   模板节奏（三身份同构，数据驱动填充）：
     时限说明条 → 应付款卡（第 x/15 天进度）→ 登记行卡列表（含历史只读）
   身份差异仅限：数据换源（sub=s.calc[0]/s.payRegs；province=s.calc2/s.payRegs2）、
   说明文案、动作按钮显隐（sub_admin 可确认/提异议；其余只读）。
   组件视觉全部为系统类（.card/.btn/.uh-* 基元/.empty-state…）；
   弹窗/Toast 一律经 Uni.sheet / Uni.center / Uni.toast（系统视觉）。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var METHOD = { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" };
  var REG_CLS = { pending_confirm: "wait", confirmed: "ok", disputed: "bad", void: "mute" };

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

  /* ---------- 数据源选择（纯数据判断：产出 view-model，不改变 DOM 结构） ---------- */
  function pickSource(ctx) {
    if (ctx.mode === "sub") {
      return { calc: (ctx.s.calc && ctx.s.calc[0]) || null, regs: ctx.s.payRegs || [] };
    }
    return { calc: ctx.s.calc2 || null, regs: ctx.s.payRegs2 || [] };
  }

  /* ---------- view-model 折算（数据映射层） ---------- */
  function buildVm(ctx, opt) {
    var src = pickSource(ctx);
    var calc = src.calc, regs = src.regs;
    var vm = {
      notice: opt.notice,
      cardTitle: opt.cardTitle,
      canAct: !!opt.canAct && !ctx.readonly,
      amount: calc ? calc.calcAmount : 0,
      dueDay: calc ? (calc.dueDay || 0) : 0,
      dueCls: "mute", duePct: 0,
      kvs: [], regs: [], hasCalc: !!calc, calcObj: calc
    };
    if (!calc) return vm;
    var cur = regs.filter(function (r) { return r.calcId === calc.id; });
    var history = regs.filter(function (r) { return r.calcId !== calc.id; });
    var sum = store.regsSum(regs, calc.id);
    var pending = cur.filter(function (r) { return r.status === "pending_confirm"; });
    var disputed = cur.filter(function (r) { return r.status === "disputed"; });
    var confirmedCount = cur.filter(function (r) { return r.status === "confirmed"; }).length;
    /* P2-2 应得 vs 已登记 vs 待确认（金额口径三态对照） */
    var confirmedAmt = cur.filter(function (r) { return r.status === "confirmed"; })
      .reduce(function (s2, r) { return s2 + (r.amount || 0); }, 0);
    var pendingAmt = pending.reduce(function (s2, r) { return s2 + (r.amount || 0); }, 0);
    var disputedAmt = disputed.reduce(function (s2, r) { return s2 + (r.amount || 0); }, 0);
    vm.tri = {
      due: calc.calcAmount, registered: sum,
      confirmed: confirmedAmt, pending: pendingAmt, disputed: disputedAmt,
      dueDay: calc.dueDay || 0
    };

    /* 逾期判定：出账后 5 天对账窗口，超期 → 锁定该月对账（仅可查看） */
    vm.overdue = !!calc.dueAt && new Date(calc.dueAt + "T23:59:59") < new Date();
    vm.canActEff = vm.canAct && !vm.overdue;

    var dueDay = calc.dueDay || 0;
    vm.dueCls = dueDay >= 15 ? "bad" : (dueDay >= 10 ? "wait" : "ok");
    vm.duePct = Math.min(Math.round(dueDay / 15 * 100), 100);
    vm.kvs = [
      { k: "未到账差异", v: ui.moneyD(calc.calcAmount - sum) },
      { k: "已登记", v: cur.length + " 笔" },
      { k: "已确认到账", v: confirmedCount + " 笔" },
      { k: "待确认 / 有异议", v: pending.length + " / " + disputed.length + " 笔" }
    ];

    vm.regs = cur.concat(history).map(function (r) {
      var isCur = r.calcId === calc.id;
      var row = {
        id: r.id, amount: r.amount, status: r.status,
        badgeCls: REG_CLS[r.status] || "mute", badgeTxt: ui.REG[r.status] || "—",
        meta: (METHOD[r.method] || r.method) + " · " + r.date + " · 登记人 " + r.registeredBy +
          (r.signMethod === "esign" ? " · 电子签留痕" : (r.confirmedAt ? " · 双方确认记录" : "")),
        notes: [], isHistory: !isCur, acts: []
      };
      if (r.reason) row.notes.push("异议：" + r.reason);
      if (r.verifiedNote) row.notes.push("线下核实：" + r.verifiedNote);
      if (r.voidInfo) row.notes.push("已冲销：" + r.voidInfo.reason + "（" + r.voidInfo.at + "）");
      if (vm.canActEff && isCur && r.status === "pending_confirm") {
        row.acts = [
          { k: "未收到/提异议", act: "dispute", cls: "ghost" },
          { k: "核对无误·确认", act: "confirm", cls: "primary" }
        ];
      } else if (vm.canActEff && isCur && r.status === "disputed") {
        row.acts = [{ k: "线下核实后确认", act: "verify", cls: "primary" }];
      }
      return row;
    });
    return vm;
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        return buildVm(ctx, {
          cardTitle: "本月应付二级款",
          notice: "",
          canAct: false
        });
      },
      entries: [],
      perms: { confirm: false, dispute: false },
      badges: {},
      empty: {},
      lockedNote: "登记、异议与确认均已锁定"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        return buildVm(ctx, {
          cardTitle: "本月应付二级款",
          notice: "数据仅可查看；收款确认、提出异议与线下核实仅管理员可操作。",
          canAct: false
        });
      },
      entries: [],
      perms: { confirm: false, dispute: false },
      badges: {},
      empty: {},
      lockedNote: "全部经营动作已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        return buildVm(ctx, {
          cardTitle: "本月省代应付款",
          notice: "出账后 15 天内仅提醒，绝不自动确认到账；逾期仍只提醒，系统不会自动确认、不会自动到账。",
          canAct: true
        });
      },
      entries: [],
      perms: { confirm: true, dispute: true },
      badges: {},
      empty: { regs: { title: "暂无付款登记", desc: "省代线下付款登记后，将逐笔出现在这里供你核对确认" } },
      lockedNote: "收款确认与异议均已锁定，台账与对账单仍可查阅"
    }
  };

  /* ---------- 登记行卡（系统 .card 内分段 + uh 基元） ---------- */
  function regHtml(row) {
    var h = '<div class="urs-item' + (row.isHistory ? " is-history" : "") + '">' +
      '<div class="urs-hd">' +
      '<span class="urs-amt">' + ui.money(row.amount) + '</span>' +
      '<span class="uh-badge uh-badge--' + row.badgeCls + '">' + row.badgeTxt + '</span>' +
      '<button class="urs-link" data-voucher="' + ui.esc(row.id) + '">' + ui.icon("image", 14) + "查看凭证</button>" +
      '</div>' +
      '<div class="urs-meta">' + ui.esc(row.meta) + '</div>';
    row.notes.forEach(function (n) {
      h += '<div class="urs-note">' + ui.esc(n) + '</div>';
    });
    if (row.acts.length) {
      h += '<div class="btn-row">' + row.acts.map(function (a) {
        return '<button class="btn btn-' + a.cls + ' btn-sm" data-act="' + a.act + '" data-id="' + ui.esc(row.id) + '">' + ui.esc(a.k) + '</button>';
      }).join("") + '</div>';
    }
    return h + '</div>';
  }

  /* ---------- 弹窗：确认到账（E101） ---------- */
  function confirmSheet(ctx, Uni, rec) {
    Uni.sheet({
      title: "确认到账",
      body:
        '<div class="uh-sheetkv"><span class="k">付款登记</span><span class="v">' + ui.money(rec.amount) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">付款方式</span><span class="v">' + ui.esc(METHOD[rec.method] || rec.method) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">付款日期</span><span class="v">' + ui.esc(rec.date) + "</span></div>" +
        '<div style="height:10px"></div><div class="uh-note">确认即代表已核对到账金额与凭证一致。确认后等待省代月度平账。</div>',
      footer: [
        { t: "取消", kind: "ghost" },
        { t: "确认到账（记录）", kind: "ghost", onClick: function () {
          var r = Uni.actGuarded("pay/confirm", { layer: "2", id: rec.id, signMethod: "record" });
          if (r.ok) Uni.toast("已确认，等待省代平账", "ok");
        } },
        { t: "电子签留痕", kind: "primary", onClick: function () {
          esignModal(ctx, Uni, rec); return false;
        } }
      ]
    });
  }

  /* ---------- 弹窗：电子签署（E103） ---------- */
  function esignModal(ctx, Uni, rec) {
    Uni.center({
      title: "电子签署留痕",
      body: '<div style="font-size:var(--fs-base);color:var(--text-1);line-height:1.6">' +
        "签署金额 " + ui.money(rec.amount) + "。<br>我已知悉并确认该笔款项已到账，电子签署后不可撤销。</div>",
      footer: [
        { t: "取消", kind: "ghost" },
        { t: "同意并签署", kind: "primary", onClick: function () {
          var r = Uni.actGuarded("pay/confirm", { layer: "2", id: rec.id, signMethod: "esign" });
          if (r.ok) Uni.toast("已签署，等待省代平账", "ok");
        } }
      ]
    });
  }

  /* ---------- 弹窗：线下核实后确认（E102） ---------- */
  function verifySheet(ctx, Uni, rec) {
    Uni.sheet({
      title: "线下核实后确认",
      body:
        '<div class="uh-readnote" style="margin-bottom:12px">原异议记录：' + ui.esc(rec.reason || "") + "</div>" +
        '<div class="field"><label class="field-label">核实说明（必填）</label>' +
        '<textarea class="textarea" id="urs-v-note" placeholder="例如：线下已收到差额 ¥240，双方核对一致"></textarea></div>',
      footer: [
        { t: "取消", kind: "ghost" },
        { t: "确认到账", kind: "primary", onClick: function (ov) {
          var v = ov.querySelector("#urs-v-note").value.trim();
          if (!v) { Uni.toast("异议记录须填写线下核实说明后再确认"); return false; }
          var r = Uni.actGuarded("pay/confirm", { layer: "2", id: rec.id, verifiedNote: v });
          if (r.ok) Uni.toast("已确认，等待省代平账", "ok");
        } }
      ]
    });
  }

  /* ---------- 弹窗：提出异议（E104） ---------- */
  function disputeSheet(ctx, Uni, rec) {
    Uni.sheet({
      title: "提出异议",
      body:
        '<div class="uh-readnote" style="margin-bottom:12px">15 天口径：出账后仅提醒双方线下核实；提出异议不会自动退款、不会自动确认到账。</div>' +
        '<div class="field"><label class="field-label">异议说明（必填）</label>' +
        '<textarea class="textarea" id="urs-d-reason" placeholder="例如：回单金额与登记不符，少到账 ¥240"></textarea></div>',
      footer: [
        { t: "取消", kind: "ghost" },
        { t: "提交异议", kind: "danger", onClick: function (ov) {
          var v = ov.querySelector("#urs-d-reason").value.trim();
          if (!v) { Uni.toast("请填写异议说明"); return false; }
          Uni.actGuarded("pay/dispute", { layer: "2", id: rec.id, reason: v });
        } }
      ]
    });
  }

  /* ---------- 逐笔核对区块（二级视角：省代应付款账单明细） ---------- */
  function detailHtml(vm, ctx, Uni) {
    if (!vm.calcObj) return "";
    var calc = vm.calcObj;
    var detail = calc.detail || [];
    if (!detail.length) return "";
    var checked = checkedIds(calc.id);
    var sumOn = 0;
    var rows = detail.map(function (d) {
      var on = checked.indexOf(d.id) > -1;
      if (on) sumOn += d.amount;
      return '<button type="button" class="uc-dlrow' + (on ? " is-on" : "") + '" data-dl="' + ui.esc(d.id) + '"' +
        (vm.canActEff ? "" : ' disabled aria-disabled="true"') + '>' +
        '<span class="amt">' + ui.money(d.amount) + '</span>' +
        '<span class="info"><span class="nm">' + ui.esc(d.user) + '</span>' +
        '<span class="od">' + Uni.itemTag(d.item) + ' ' + ui.esc(d.order) + ' · ' + ui.esc(d.date) + '</span></span>' +
        '<span class="uh-badge uh-badge--' + (on ? "ok" : "wait") + '">' + (on ? "已核对" : "待核对") + '</span>' +
        '</button>';
    }).join("");
    return '<section class="uh-sec"><div class="uc-dlsec">' +
      '<div class="uh-sechead"><span class="lbl">逐笔核对</span>' +
      '<span class="uh-badge uh-badge--mute">已核对 ' + checked.length + '/' + detail.length + '</span></div>' +
      '<div class="card" style="padding:2px 14px">' + rows + '</div>' +
      '<div class="uc-dlsec__sum"><span>已核对金额 ' + ui.money(sumOn) + '</span>' +
      '<span>明细合计 ' + ui.money(calc.eligibleBase) + '</span></div>' +
      (vm.canActEff ? '<div class="uh-note" style="margin-top:6px">逐笔确认订单计入合格消费分润；差异以线下凭证核实后闭环。</div>' : "") +
      '</div></section>';
  }

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

  /* ---------- 历史对账记录（按月查询） ---------- */
  var HIST_LB = { pending: "对账中", settled: "已平账", overdue: "逾期锁定" };
  var HIST_CLS = { pending: "wait", settled: "ok", overdue: "bad" };
  var HIST_NOTE = {
    pending: "该月账单处于 5 天对账窗口内，请完成逐笔核对与到账确认；超期将锁定该月对账。",
    settled: "该月已完成对账并平账留痕，无未闭环差异。",
    overdue: "该月账单已超过对账期限（出账后 5 天），对账状态已锁定，仅可查看凭证与明细，不可手动对账。"
  };
  function histSheet(h, Uni) {
    var cls = HIST_CLS[h.state] || "mute";
    var body =
      '<div class="uh-sheetkv"><span class="k">账单月份</span><span class="v">' + h.month + '</span></div>' +
      '<div class="uh-sheetkv"><span class="k">出账日</span><span class="v">' + (h.issueAt || "—") + '</span></div>' +
      '<div class="uh-sheetkv"><span class="k">对账截止</span><span class="v">' + (h.dueAt || "—") + '</span></div>' +
      '<div class="uh-sheetkv"><span class="k">账单金额</span><span class="v">' + ui.money(h.amount) + '</span></div>' +
      (h.settledAt ? '<div class="uh-sheetkv"><span class="k">平账时间</span><span class="v">' + h.settledAt + '</span></div>' : "") +
      '<div style="height:12px"></div>' +
      '<div class="uc-histnote uc-histnote--' + cls + '"><b>' + (HIST_LB[h.state] || h.state) + '</b> · ' + (HIST_NOTE[h.state] || "") + '</div>';
    var footer = [{ t: "关闭", kind: "ghost" }];
    if (h.state === "pending") {
      footer.push({
        t: "去对账", kind: "primary", onClick: function (ov) {
          ov.close();
          var band = document.querySelector("[data-band='cur']");
          if (band) band.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
    Uni.center({ title: "对账记录 · " + h.month, body: body, footer: footer });
  }
  function histHtml(ctx, ui) {
    var hist = ctx.s.hist || [];
    if (!hist.length) return "";
    var rows = hist.map(function (h) {
      return '<button type="button" class="uc-histrow" data-hist="' + h.month + '">' +
        '<span class="m">' + h.month + '</span>' +
        '<span class="t">省代应付款 · ' + ui.money(h.amount) + '</span>' +
        '<span class="uh-badge uh-badge--' + (HIST_CLS[h.state] || "mute") + '">' + (HIST_LB[h.state] || h.state) + '</span>' +
        '<span class="arr">' + ui.icon("chev-r", 16) + '</span></button>';
    }).join("");
    return '<section class="uh-sec"><div class="uc-hist">' +
      '<div class="uh-sechead"><span class="lbl">历史对账记录</span>' +
      '<span class="uh-badge uh-badge--mute">共 ' + hist.length + ' 张</span></div>' +
      '<div class="card" style="padding:2px 14px">' + rows + '</div></div></section>';
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    /* 全部登记记录（供凭证预览与动作弹窗反查） */
    var src = ctx.mode === "sub" ? (ctx.s.payRegs || []) : (ctx.s.payRegs2 || []);
    function recOf(id) { return src.filter(function (r) { return r.id === id; })[0]; }

    var html = "";

    /* E097 时限说明条（文案随身份换源；为空则不渲染） */
    if (vm.notice) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) +
        '<span>' + ui.esc(vm.notice) + "</span></div></section>";
    }

    /* 暂停封条 */
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + '</span></div></div></section>';
    }

    /* 应付款卡（data-band=cur 供历史记录"去对账"定位）+ 对账截止条 */
    html += '<section class="card uh-sec" data-band="cur">' +
      (vm.overdue
        ? '<div class="uh-lockbar" style="margin:0 0 12px">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">对账已逾期 · 该月对账状态已锁定</span>' +
          '<span class="lb-s">已超过出账后 5 天对账期限，仅可查看凭证与明细，不可手动对账。</span></div></div>'
        : "") +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + ui.esc(vm.cardTitle) + "</span>" +
      '<span class="uh-badge uh-badge--' + vm.dueCls + '">第 ' + vm.dueDay + "/15 天</span></div>" +
      dueBarHtml(vm.calcObj) +
      '<div class="uh-bignum">' + ui.moneyD(vm.amount) + "</div>" +
      '<div class="urs-duebar"><div class="urs-duebar__fill urs-duebar__fill--' + vm.dueCls + '" style="width:' + vm.duePct + '%"></div></div>' +
      '<div class="uh-ledgerline"></div>';
    vm.kvs.forEach(function (kv) {
      html += '<div class="uh-kv"><span class="k">' + ui.esc(kv.k) + "</span><span class=\"v\">" + kv.v + "</span></div>";
    });
    html += "</section>";

    /* P2-2 应得 vs 已登记 vs 待确认（金额口径三态对照；双端管理员可见） */
    if (vm.tri && vm.calcObj) {
      var tri = vm.tri;
      var confPct = tri.due > 0 ? Math.min(Math.round(tri.confirmed / tri.due * 100), 100) : 0;
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">应得 vs 已登记 vs 待确认</span>' +
        '<span class="uh-badge uh-badge--mute">金额口径</span></div>' +
        '<div class="uh-kv"><span class="k">应得（省代应付款）</span><span class="v">' + ui.money(tri.due) + '</span></div>' +
        '<div class="uh-kv"><span class="k">已登记（含待确认 / 异议）</span><span class="v">' + ui.money(tri.registered) + '</span></div>' +
        '<div class="uh-kv"><span class="k">已确认到账</span><span class="v">' + ui.money(tri.confirmed) + '</span></div>' +
        '<div class="uh-kv"><span class="k">待确认 / 有异议</span><span class="v">' + ui.money(tri.pending) + " / " + ui.money(tri.disputed) + '</span></div>' +
        '<div class="urs-duebar" style="margin-top:10px">' +
        '<div class="urs-duebar__fill urs-duebar__fill--' + (confPct >= 100 ? "ok" : "wait") + '" style="width:' + Math.max(confPct, 4) + '%"></div></div>' +
        '<div class="uh-note" style="margin-top:6px">已确认 ' + Math.round(confPct) + '% · 未登记差额 ' + ui.money(Math.max(tri.due - tri.registered, 0)) + '（线下凭证核实后闭环，不自动到账）</div>' +
        "</section>";
    }

    /* 逐笔核对（页内区块，sub_admin 可操作） */
    html += detailHtml(vm, ctx, Uni);

    /* E099/E105 登记行卡列表 */
    html += '<section class="card uh-sec" style="padding-top:6px">' +
      '<div class="uh-finhead" style="margin:6px 0 2px"><span class="uh-eyebrow">付款登记与凭证</span></div>';
    html += vm.regs.length
      ? vm.regs.map(regHtml).join("")
      : Uni.emptyHtml(V.empty.regs.title, V.empty.regs.desc, "tray");
    html += "</section>";

    /* 历史对账记录（按月查询，含逾期锁定月） */
    html += histHtml(ctx, ui);

    /* 计费范围：合格消费口径（计入 / 不计入），双端共用，置于页面最下方 */
    html += Uni.scopeCard();

    el.innerHTML = html;

    /* E100 凭证预览（统一系统回单卡渲染） */
    el.querySelectorAll("[data-voucher]").forEach(function (n) {
      n.addEventListener("click", function () {
        var rec = recOf(n.getAttribute("data-voucher"));
        if (rec && rec.vouchers && rec.vouchers[0]) Uni.voucherCenter(rec.vouchers[0]);
      });
    });

    /* 逐笔核对：负责人逐笔标记（本地覆盖层持久，跨页生效） */
    el.querySelectorAll("[data-dl]").forEach(function (n) {
      n.addEventListener("click", function () {
        if (ctx.readonly || !vm.canActEff) { Uni.toast("逐笔核对仅管理员可操作", "err"); return; }
        var calc = pickSource(ctx).calc;
        if (!calc) return;
        toggleChecked(calc.id, n.getAttribute("data-dl"));
        Uni.toast(checkedIds(calc.id).indexOf(n.getAttribute("data-dl")) > -1 ? "已核对该笔订单" : "已取消核对", "ok");
        mount(el, ctx, Uni);
      });
    });

    /* 历史对账记录 */
    el.querySelectorAll("[data-hist]").forEach(function (n) {
      n.addEventListener("click", function () {
        var month = n.getAttribute("data-hist");
        var hist = (ctx.s.hist || []).filter(function (h) { return h.month === month; });
        if (hist.length) histSheet(hist[0], Uni);
      });
    });

    /* 行动作 */
    el.querySelectorAll("[data-act]").forEach(function (n) {
      var act = n.getAttribute("data-act");
      n.addEventListener("click", function () {
        var rec = recOf(n.getAttribute("data-id"));
        if (!rec) return;
        if (act === "confirm") return confirmSheet(ctx, Uni, rec);
        if (act === "verify") return verifySheet(ctx, Uni, rec);
        if (act === "dispute") return disputeSheet(ctx, Uni, rec);
      });
    });

    /* 待办弹窗放大跳转：?focus=cur 定位到当月收款确认主卡 */
    var f = new URLSearchParams(window.location.search).get("focus");
    if (f) {
      var band = el.querySelector('[data-band="' + f + '"]');
      if (band) setTimeout(function () { band.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
    }
  }

  window.Uni.register({
    view: "uni-reconcile-sub",
    route: "reconcile-sub.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
