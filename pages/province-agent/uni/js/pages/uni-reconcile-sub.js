/* ============================================================
   uni-reconcile-sub.js · 对账中心（二级企业确认到账 · reconcile-sub.html）
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
  /* 演示时钟统一取 store.TODAY（10-27）：墙钟会让 10 月账期在演示当天整体变成"逾期锁定" */
  var TODAY = (store && store.TODAY) || "2026-10-27";

  /* 省代视角的「这一家」：?sub=<企业 id>。二级视角恒为自身，不需要参数。
     二级合作页点「查看对账单」必须落到该企业的账单，而不是省代 ↔ 平台的
     主对账页（reconcile.html，那是第一层：平台→省代，与二级企业无关）。 */
  function querySub(ctx) {
    if (ctx.mode === "sub") return null;
    var id;
    try { id = new URLSearchParams(window.location.search).get("sub"); } catch (e) { id = ""; }
    if (!id) return null;
    return (ctx.s.subs || []).filter(function (p) { return p.id === id; })[0] || null;
  }
  function shortName(n) {
    return String(n || "").replace(/(股份有限公司|有限责任公司|有限公司)$/, "");
  }
  /* 单个二级企业本期账目（省代视角；与 aggregate 同一份 calc2 明细，只按 subId 归集） */
  function perSubCalc(agg, sub) {
    if (!agg) return null;
    var detail = (agg.detail || []).filter(function (x) { return x.subId === sub.id; });
    var base = detail.reduce(function (a, x) { return a + (x.amount || 0); }, 0);
    var ratio = Number(sub.ratioToSub) || 0;
    return {
      /* checkId 独立：逐笔核对的勾选要按企业分开存，不能串到聚合账或别家 */
      id: agg.id + ":" + sub.id,
      regsCalcId: agg.id,
      layer: agg.layer, month: agg.month,
      issueAt: agg.issueAt, dueAt: agg.dueAt,
      disputeDeadline: agg.disputeDeadline, dueDay: agg.dueDay,
      eligibleBase: base, ratioToSub: ratio,
      /* 与 store.subDueOf 同一算式同一常量（grossShare=0.5），不另写一个 0.5 */
      calcAmount: Math.round(base * (store.CONST ? store.CONST.grossShare : 0.5) * ratio),
      detail: detail
    };
  }

  /* 逐笔核对状态（批次四：统一 Uni.detailState，DL v2 持久化 + v1 迁移；核对待持久、跨页生效） */
  function checkedIds(calcId) { return (window.Uni.detailState.get(calcId) || []).map(function (r) { return r.id; }); }
  function toggleChecked(calcId, id) {
    var on = checkedIds(calcId).indexOf(id) < 0;
    window.Uni.detailState.set(calcId, id, on ? "checked" : null,
      (window.Uni.getCtx && window.Uni.getCtx().identity) || "admin");
    return on;
  }
  function allCheckedOf(calc) {
    var dl = (calc && calc.detail) || [];
    if (!dl.length) return true; /* 无明细不设门槛 */
    var ids = checkedIds(calc.id);
    return dl.every(function (d) { return ids.indexOf(d.id) > -1; });
  }

  /* ---------- 数据源选择（纯数据判断：产出 view-model，不改变 DOM 结构） ---------- */
  function pickSource(ctx) {
    if (ctx.mode === "sub") {
      return { calc: (ctx.s.calc && ctx.s.calc[0]) || null, regs: ctx.s.payRegs || [], sub: null };
    }
    var agg = ctx.s.calc2 || null;
    var sub = querySub(ctx);
    if (!sub) return { calc: agg, regs: ctx.s.payRegs2 || [], sub: null };
    return {
      sub: sub,
      calc: perSubCalc(agg, sub),
      regs: (ctx.s.payRegs2 || []).filter(function (r) { return r.subId === sub.id; })
    };
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
    /* 单企业账单的合成 calc 用它自己的 id 存核对勾选，但登记记录仍挂在真实账期 id 上 */
    var regCalcId = calc.regsCalcId || calc.id;
    if (src.sub) vm.cardTitle = "本月应付 " + shortName(src.sub.name) + " · 分润款";
    var cur = regs.filter(function (r) { return r.calcId === regCalcId; });
    var history = regs.filter(function (r) { return r.calcId !== regCalcId; });
    var sum = store.regsSum(regs, regCalcId);
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
    vm.overdue = !!calc.dueAt && new Date(calc.dueAt + "T23:59:59") < new Date(TODAY + "T23:59:59");
    vm.canActEff = vm.canAct && !vm.overdue;

    var dueDay = calc.dueDay || 0;
    vm.dueCls = dueDay >= 15 ? "bad" : (dueDay >= 10 ? "wait" : "ok");
    /* 逐笔核对：二级管理员照旧；省代在「某家企业的账单」里也逐笔核对（按企业独立留痕），
       聚合账页不放行，避免省代在总盘上把别家的明细一起勾掉 */
    vm.canCheck = vm.canActEff || (!!src.sub && !ctx.readonly && !vm.overdue);
    vm.duePct = Math.min(Math.round(dueDay / 15 * 100), 100);
    vm.kvs = [
      { k: "未到账差异", v: ui.moneyD(calc.calcAmount - sum) },
      { k: "已登记", v: cur.length + " 笔" },
      { k: "已确认到账", v: confirmedCount + " 笔" },
      { k: "待确认 / 有异议", v: pending.length + " / " + disputed.length + " 笔" }
    ];

    vm.regs = cur.concat(history).map(function (r) {
      var isCur = r.calcId === regCalcId;
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
        var gated = !allCheckedOf(calc);
        row.acts = [
          { k: "未收到/提异议", act: "dispute", cls: "ghost" },
          { k: "核对无误·确认", act: "confirm", cls: "primary", disabled: gated }
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
          notice: "数据仅可查看；确认到账、提出异议与线下核实仅管理员可操作。",
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
      lockedNote: "确认到账与异议均已锁定，台账与对账单仍可查阅"
    },
    /* 2026-11-01 审计补齐：二级员工此前无页内变体，回退复用 sub_admin 变体——
       拿到 perms.confirm / perms.dispute 的值取决于回退路径，且提示文案按管理员口吻写。
       此处与省代员工同构：可查看登记与凭证，确认到账与异议仅企业管理员可操作。 */
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: function (ctx) {
        return buildVm(ctx, {
          cardTitle: "本月省代应付款",
          notice: "数据仅可查看；确认到账、提出异议与线下核实仅企业管理员可操作。",
          canAct: false
        });
      },
      entries: [],
      perms: { confirm: false, dispute: false },
      badges: {},
      empty: {},
      lockedNote: "全部经营动作已锁定，仅可查看"
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
        return '<button class="btn btn-' + a.cls + ' btn-sm" data-act="' + a.act + '" data-id="' + ui.esc(row.id) + '"' +
          (a.disabled ? ' disabled title="请先完成逐笔核对（明细 100%）"' : "") + '>' + ui.esc(a.k) + '</button>';
      }).join("") + '</div>';
    }
    return h + '</div>';
  }

  /* ---------- 弹窗：确认到账（E101） ---------- */
  function confirmSheet(ctx, Uni, rec) {
    var cid = (pickSource(ctx).calc || {}).id;
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
          if (r.ok) { if (cid) Uni.detailState.confirmBill(cid, ctx.identity); Uni.toast("已确认，等待省代平账", "ok"); }
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
          if (r.ok) { var cid2 = (pickSource(ctx).calc || {}).id; if (cid2) Uni.detailState.confirmBill(cid2, ctx.identity); Uni.toast("已签署，等待省代平账", "ok"); }
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
          if (r.ok) { var cid3 = (pickSource(ctx).calc || {}).id; if (cid3) Uni.detailState.confirmBill(cid3, ctx.identity); Uni.toast("已确认，等待省代平账", "ok"); }
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
        (vm.canCheck ? "" : ' disabled aria-disabled="true"') + '>' +
        '<span class="amt">' + ui.money(d.amount) + '</span>' +
        '<span class="info"><span class="nm">' + ui.esc(d.user) + '</span>' +
        '<span class="od">' + Uni.itemTag(d.item) + ' ' + ui.esc(d.order) + ' · ' + ui.esc(d.date) + '</span></span>' +
        '<span class="uh-badge uh-badge--' + (on ? "ok" : "wait") + '">' + (on ? "已核对" : "待核对") + '</span>' +
        '</button>';
    }).join("");
    return '<section class="uh-sec"><div class="uc-dlsec">' +
      '<div class="uh-sechead"><span class="lbl">逐笔核对</span>' +
      (vm.canCheck && detail.length
        ? '<button type="button" class="btn btn-ghost btn-xs" data-act="checkAll" style="margin-left:auto">全选核对</button>'
        : "") +
      '<span class="uh-badge uh-badge--mute">已核对 ' + checked.length + '/' + detail.length + '</span></div>' +
      '<div class="card" style="padding:2px 14px">' + rows + '</div>' +
      '<div class="uc-dlsec__sum"><span>已核对金额 ' + ui.money(sumOn) + '</span>' +
      '<span>明细合计（合格消费）' + ui.money(calc.eligibleBase) + '</span></div>' +
      (vm.canCheck ? '<div class="uh-note" style="margin-top:6px">逐笔确认订单计入合格消费分润；差异以线下凭证核实后闭环。</div>' : "") +
      '</div></section>';
  }

  /* ---------- 对账时限：剩余天数 / 逾期 ---------- */
  function remainDays(dueAt) {
    if (!dueAt) return 1;
    var due = new Date(dueAt + "T23:59:59");
    return Math.ceil((due - new Date(TODAY + "T23:59:59")) / 86400000);
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
  /* 历史账期弹窗：模板统一走 uni-doc.js（对账单摘要 + 账单信息 + 可下载卷宗），
     本页只补「去对账」这个就地动作 */
  var Doc = window.UniDoc;
  var HIST_LB = Doc.HIST_LB, HIST_CLS = Doc.HIST_CLS;
  function histSheet(h, ctx, Uni) {
    var more = h.state === "pending"
      ? { t: "去对账", on: function () {
        var band = document.querySelector("[data-band='cur']");
        if (band) band.scrollIntoView({ behavior: "smooth", block: "start" });
      } }
      : null;
    Doc.openSheet(ctx, h, Uni, { more: more });
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

  /* ---------- 省代视角：单企业账目抬头（?sub= 时的页首） ---------- */
  function scopeHeadHtml(ctx, src, vm) {
    var p = src.sub, ag = p.agreement || {};
    var agSt = AG_TXT[ag.state] || { t: "未签", c: "mute" };
    return '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">二级企业账目</span>' +
      '<span class="uh-badge uh-badge--' + agSt.c + '">协议' + agSt.t + '</span></div>' +
      '<div class="uh-row" style="padding:0;min-height:auto;cursor:default">' +
      '<span class="uh-row__ic">' + ui.icon("building", 18) + '</span>' +
      '<span class="uh-row__main"><span class="uh-row__t">' + ui.esc(p.name) + '</span>' +
      '<span class="uh-row__s">' + ui.esc(p.uscc || "") + ' · 合作自 ' + ui.esc(p.since || "") + '</span></span>' +
      '</div>' +
      '<div class="uh-kv"><span class="k">约定比例</span><span class="v">' + Math.round((Number(p.ratioToSub) || 0) * 100) + '%</span></div>' +
      '<div class="uh-kv"><span class="k">本月合格消费（该企业名下）</span><span class="v">' + ui.money(vm.calcObj ? vm.calcObj.eligibleBase : 0) + '</span></div>' +
      '<div class="uh-kv"><span class="k">协议编号 / 版本</span><span class="v">' + ui.esc(ag.id || "—") + " · " + ui.esc(ag.version || "—") + '</span></div>' +
      '<div class="btn-row" style="margin-top:10px">' +
      '<a class="btn btn-ghost btn-sm" href="' + Uni.hrefOf("agreement.html") + "?sub=" + encodeURIComponent(p.id) + '">查看合作协议</a>' +
      '<a class="btn btn-ghost btn-sm" href="' + Uni.hrefOf("reconcile-sub.html") + '">全部二级企业</a>' +
      '</div></section>';
  }

  /* ---------- 省代视角：二级企业账目清单（无 ?sub= 时的页首总览） ---------- */
  var AG_TXT = {
    signed: { t: "已签", c: "ok" },
    pending: { t: "待签", c: "wait" },
    pending_mine: { t: "待我方签", c: "info" },
    rejected: { t: "已拒签", c: "bad" }
  };
  function subLedgerHtml(ctx, Uni) {
    var agg = ctx.s.calc2;
    if (!agg) return "";
    var tDue = 0, tReg = 0, rows = "";
    (ctx.s.subs || []).filter(function (p) { return p.status === "active"; }).forEach(function (p) {
      var due = store.subDueOf(ctx.s, p);
      var regs = (ctx.s.payRegs2 || []).filter(function (r) { return r.subId === p.id && r.calcId === agg.id; });
      var reg = store.regsSum(regs, agg.id);
      var disp = regs.some(function (r) { return r.status === "disputed"; });
      var pend = regs.some(function (r) { return r.status === "pending_confirm"; });
      tDue += due; tReg += reg;
      var b = due <= 0 ? { t: "本期无应付", c: "mute" }
        : disp ? { t: "有异议", c: "bad" }
          : pend ? { t: "待确认", c: "wait" }
            : reg >= due - 0.01 ? { t: "已结清", c: "ok" }
              : reg > 0 ? { t: "部分登记", c: "wait" }
                : { t: "未登记", c: "info" };
      var agSt = AG_TXT[(p.agreement || {}).state] || { t: "未签", c: "mute" };
      rows += '<button type="button" class="uh-row" data-sub="' + ui.esc(p.id) + '">' +
        '<span class="uh-row__ic">' + ui.icon("building", 18) + '</span>' +
        '<span class="uh-row__main"><span class="uh-row__t">' + ui.esc(shortName(p.name)) + '</span>' +
        '<span class="uh-row__s">协议' + agSt.t + ' · ' + Math.round((Number(p.ratioToSub) || 0) * 100) +
        '% · 消费 ' + ui.money(p.subGross || 0) +
        (reg > 0 && reg < due ? ' · 已登记 ' + ui.money(reg) : '') + '</span></span>' +
        '<span class="uh-row__right"><span class="uh-row__amt">' + ui.money(due) + '</span>' +
        '<span class="uh-badge uh-badge--' + b.c + '">' + b.t + '</span></span>' +
        '<span class="uh-chev">' + ui.icon("chev", 16) + '</span></button>';
    });
    return '<section class="card uh-sec" style="padding-top:6px">' +
      '<div class="uh-finhead" style="margin:6px 0 2px"><span class="uh-eyebrow">二级企业账目 · 本月应付合计 ' + ui.money(tDue) + '</span>' +
      '<span class="uh-badge uh-badge--mute">已登记 ' + ui.money(tReg) + '</span></div>' +
      (rows || Uni.emptyHtml("暂无在营二级企业", "二级企业审核通过后，账目会出现在这里", "building")) +
      '<div class="uh-note" style="padding:10px 14px 4px">点任一企业进入其本月账目：明细、登记与凭证只针对该企业，不与其他企业混盘。</div>' +
      '</section>';
  }

  /* ---------- 省代：在「该企业账目」里登记线下付款 ---------- */
  function registerSheet(ctx, Uni, vm) {
    var p = pickSource(ctx).sub;
    if (!p) return;
    var cap = Math.max(vm.tri.due - vm.tri.registered, 0);
    var vouchers = [];
    var sh = Uni.sheet({
      title: "登记线下付款 · " + shortName(p.name),
      body:
        '<div class="uh-sheetkv"><span class="k">该企业本月应付</span><span class="v">' + ui.money(vm.tri.due) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">已登记（不含冲销）</span><span class="v">' + ui.money(vm.tri.registered) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">可登记</span><span class="v">' + ui.money(cap) + "</span></div>" +
        '<div style="height:14px"></div>' +
        '<div class="field"><label class="field-label">金额<em class="req">*</em></label>' +
        '<input class="input" id="urs-amount" type="number" inputmode="decimal" value="' + cap + '"></div>' +
        '<div class="field"><label class="field-label">付款方式</label><div class="seg" data-pick>' +
        '<button type="button" class="seg-item active" data-v="bank">对公转账</button>' +
        '<button type="button" class="seg-item" data-v="wechat">微信/支付宝</button>' +
        '<button type="button" class="seg-item" data-v="cash">现金</button></div></div>' +
        '<div class="field"><label class="field-label">付款日期</label>' +
        '<input class="input" id="urs-date" type="date" value="' + TODAY + '" max="' + TODAY + '"></div>' +
        '<div class="field" style="margin-bottom:0"><label class="field-label">付款凭证<em class="req">*</em></label>' +
        '<div class="ur-upload" id="urs-voucher">' + ui.icon("camera", 22) + "<div>点击上传凭证图片</div></div>" +
        '<input type="file" id="urs-file" accept="image/*" hidden></div>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "提交登记", kind: "primary", onClick: function (ov) {
          var amount = Number(ov.querySelector("#urs-amount").value);
          var mit = ov.querySelector("[data-pick] .seg-item.active");
          var method = mit ? mit.getAttribute("data-v") : "bank";
          var date = ov.querySelector("#urs-date").value || TODAY;
          if (!amount || amount <= 0) { Uni.toast("请填写正确金额", "err"); return false; }
          if (amount > cap + 0.01) { Uni.toast("超出该企业可登记金额 " + ui.money(cap), "err"); return false; }
          if (!vouchers.length) { Uni.toast("请上传付款凭证（凭证强制）", "err"); return false; }
          var r = Uni.actGuarded("pay/addReg", {
            layer: "2",
            data: { subId: p.id, amount: amount, method: method, date: date, vouchers: vouchers }
          });
          if (!r.ok) return false;
          Uni.toast("已登记 " + ui.money(amount) + "，待该企业确认到账", "ok");
          mount(document.getElementById("ag-view"), ctx, Uni);
        }
      }]
    });
    var up = sh.querySelector("#urs-voucher"), file = sh.querySelector("#urs-file");
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

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var scope = pickSource(ctx);

    /* 全部登记记录（供凭证预览与动作弹窗反查） */
    var src = ctx.mode === "sub" ? (ctx.s.payRegs || []) : (ctx.s.payRegs2 || []);
    function recOf(id) { return src.filter(function (r) { return r.id === id; })[0]; }

    var html = "";

    /* 省代视角：带 ?sub= 是「这一家」的账单，不带是二级企业账目清单。
       二级视角（ctx.mode === "sub"）永远是自身，两者都不渲染。 */
    if (ctx.mode !== "sub") {
      html += scope.sub ? scopeHeadHtml(ctx, scope, vm) : subLedgerHtml(ctx, Uni);
    }

    /* E097 时限说明条（文案随身份换源；为空则不渲染） */
    if (vm.notice) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) +
        '<span>' + ui.esc(vm.notice) + "</span></div></section>";
    }

    /* 暂停封条 */
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(Uni.lockTitle(ctx, V)) + '（仅可查看）</span>' +
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
      '<div class="uh-bignum" data-count="' + vm.amount + '">' + ui.moneyD(0) + "</div>" +
      Uni.plainNote("应得 = 平台盘 × 约定比例") +
      '<div class="urs-duebar"><div class="urs-duebar__fill urs-duebar__fill--' + vm.dueCls + '" style="width:' + vm.duePct + '%"></div></div>' +
      '<div class="uh-ledgerline"></div>' +
      (function () {
        var calcO = vm.calcObj || {};
        var dlArr = calcO.detail || [];
        var sumOn = 0;
        dlArr.forEach(function (d) { if (checkedIds(calcO.id).indexOf(d.id) > -1) sumOn += d.amount; });
        var due = vm.tri ? vm.tri.due : 0, cfm = vm.tri ? vm.tri.confirmed : 0;
        return Uni.progressBar({
          det: dlArr.length ? Math.round(sumOn / (vm.calcObj.eligibleBase || 1) * 100) : 0,
          cfm: due > 0 ? Math.round(cfm / due * 100) : 0,
          diff: due - cfm
        });
      })() +
      dueBarHtml(vm.calcObj);
    vm.kvs.forEach(function (kv) {
      html += '<div class="uh-kv"><span class="k">' + ui.esc(kv.k) + "</span><span class=\"v\">" + kv.v + "</span></div>";
    });
    /* 省代在单企业账单里登记付款：额度按该企业应付算，不占别家额度 */
    if (ctx.mode !== "sub" && ctx.identity === "admin" && !ctx.readonly && scope.sub && !vm.overdue &&
      vm.tri && vm.tri.due - vm.tri.registered > 0.01) {
      html += '<div class="btn-row" style="margin-top:12px">' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="addreg">登记线下付款 · ' +
        ui.money(vm.tri.due - vm.tri.registered) + '</button></div>';
    }
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

    /* 计费范围：合格消费口径（计入 / 不计入）折叠为「一句话 + 查看口径说明」（P1-7 去墙化） */
    html += Uni.scopeCardFold(
      "费用按平台月度合格消费账单口径结算；线下凭证核实后闭环。",
      "费用计算范围与结算口径",
      Uni.scopeSheetBody()
    );

    /* 批次九 L2：页级粘性底栏容器（sub_admin 可操作时放「全选核对」主按钮） */
    html += '<div class="uh-stickybar"></div>';

    el.innerHTML = html;
    Uni.bindScopeFold(el, Uni);

    /* 批次九 L2/L8：粘性底栏填充 + 应付款主数字 count-up */
    var sb = el.querySelector(".uh-stickybar");
    if (sb) {
      var actBtn = (vm.canActEff && !ctx.readonly && !vm.overdue)
        ? '<button type="button" class="btn btn-primary" data-act="checkAll">全选核对</button>'
        : "";
      sb.innerHTML = actBtn;
      sb.classList.toggle("is-empty", !actBtn);
    }
    var cnum = el.querySelector("[data-count]");
    if (cnum) Uni.countUp(cnum, parseFloat(cnum.getAttribute("data-count")), 420, ui.moneyD);

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
        if (ctx.readonly || !vm.canCheck) { Uni.toast("逐笔核对仅管理员可操作", "err"); return; }
        var calc = pickSource(ctx).calc;
        if (!calc) return;
        toggleChecked(calc.id, n.getAttribute("data-dl"));
        Uni.toast(checkedIds(calc.id).indexOf(n.getAttribute("data-dl")) > -1 ? "已核对该笔订单" : "已取消核对", "ok");
        mount(el, ctx, Uni);
      });
    });

    /* 省代：二级企业账目清单 → 进入该企业账单 */
    el.querySelectorAll("[data-sub]").forEach(function (n) {
      n.addEventListener("click", function () {
        var id = n.getAttribute("data-sub");
        Uni.navTo("reconcile-sub.html?sub=" + encodeURIComponent(id));
      });
    });

    /* 历史对账记录 */
    el.querySelectorAll("[data-hist]").forEach(function (n) {
      n.addEventListener("click", function () {
        var month = n.getAttribute("data-hist");
        var hist = (ctx.s.hist || []).filter(function (h) { return h.month === month; });
        if (hist.length) histSheet(hist[0], ctx, Uni);
      });
    });

    /* 行动作 */
    el.querySelectorAll("[data-act]").forEach(function (n) {
      var act = n.getAttribute("data-act");
      n.addEventListener("click", function () {
        if (act === "scopeFold") {
          return Uni.sheet({
            title: n.getAttribute("data-title"),
            body: n.getAttribute("data-body"),
            footer: [{ t: "关闭", kind: "ghost" }]
          });
        }
        /* 批次九 L2：粘性底栏「全选核对」无 data-id，须在 rec 判空前处理 */
        if (act === "checkAll") {
          var calc = pickSource(ctx).calc;
          if (!calc) return;
          var dl = calc.detail || [];
          if (!dl.length) { Uni.toast("暂无明细可核对"); return; }
          dl.forEach(function (d) { Uni.detailState.set(calc.id, d.id, "checked", ctx.identity); });
          Uni.toast("已全部核对（" + dl.length + " 笔）", "ok");
          return mount(el, ctx, Uni);
        }
        /* 省代单企业账单：登记线下付款（无 data-id，须在 rec 判空前处理） */
        if (act === "addreg") {
          if (!scope.sub) return;
          return registerSheet(ctx, Uni, vm);
        }
        var rec = recOf(n.getAttribute("data-id"));
        if (!rec) return;
        if (act === "confirm") return confirmSheet(ctx, Uni, rec);
        if (act === "verify") return verifySheet(ctx, Uni, rec);
        if (act === "dispute") return disputeSheet(ctx, Uni, rec);
      });
    });

    /* 页头语境：走的是"某家企业的账单"时，标题换成企业名，返回键回到二级账目清单 */
    if (ctx.mode !== "sub") {
      var tt = el.closest(".phone") && el.closest(".phone").querySelector(".topbar-title");
      if (tt) tt.textContent = scope.sub ? shortName(scope.sub.name) + " · 对账" : "对账中心";
      var back = el.closest(".phone") && el.closest(".phone").querySelector(".nav-back");
      if (back && scope.sub) back.setAttribute("href", "reconcile-sub.html");
    }

    /* 待办弹窗放大跳转：?focus=cur 定位到当月对账主卡 */
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
    skeleton: true,
    mount: mount
  });
})();
