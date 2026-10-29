/* ============================================================
   uni-statement.js · 月度对账单（statement.html）（E106–E107）
   模板节奏（三身份同构，数据驱动填充）：
     暂停封条 → 逐月对账单卡片（应付 − 已登记到账算式 + 差异五态结论）
   身份差异仅限：数据换源（二级=s.statements+s.calc+s.payRegs；
   省代=statement 全量 + calc1/calc2/payRegs1/payRegs2）、五态结论文案（数据值）。
   组件视觉全部为系统类（.card/.btn…）；内容基元（uh-）来自 css/uni-layout.css。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  /* ---------- view-model 折算（数据映射层） ---------- */
  function buildVm(ctx, opt) {
    var vm = { notice: opt.notice, cards: [] };
    var isSub = ctx.mode === "sub";
    var stmts = (ctx.s.statements || []).slice().reverse(); /* 最近月在前 */

    stmts.forEach(function (st) {
      var regs, calcObj;
      if (isSub) {
        regs = (ctx.s.payRegs || []).filter(function (r) { return r.calcId === st.calcId; });
        calcObj = (ctx.s.calc || []).filter(function (c) { return c.id === st.calcId; })[0] || null;
      } else {
        var isL1 = st.calcId === "c1-l1" || st.calcId === "c0-l1";
        regs = (isL1 ? ctx.s.payRegs1 : ctx.s.payRegs2) || [];
        regs = regs.filter(function (r) { return r.calcId === st.calcId; });
        calcObj = st.calcId === "c1-l1" ? ctx.s.calc1 : (st.calcId === "c1-l2" ? ctx.s.calc2 : null);
      }
      var sum = store.regsSum(regs, st.calcId);
      var amount = calcObj ? calcObj.calcAmount : sum; /* 已平账月：应付 = 已确认到账 */
      var diff = amount - sum;
      var pending = regs.filter(function (r) { return r.status === "pending_confirm"; });
      var disputed = regs.filter(function (r) { return r.status === "disputed"; });

      /* E107 差异状态五态 */
      var verdict, vCls;
      if (st.status === "balanced") {
        verdict = "差异 ¥0 · 已平账留痕"; vCls = "ok";
      } else if (disputed.length) {
        verdict = disputed.length + " 笔登记存在异议（" + ui.money(disputed[0].amount) + "），" + opt.actionPage;
        vCls = "bad";
      } else if (pending.length) {
        verdict = "已登记 " + sum + "，" + pending.length + " 笔" + opt.pendingText;
        vCls = "wait";
      } else if (diff > 0) {
        verdict = "差异 " + ui.money(diff) + "，" + opt.diffText;
        vCls = "info";
      } else {
        verdict = "金额已对齐，" + opt.readyText;
        vCls = "gold";
      }

      vm.cards.push({
        month: st.month,
        badgeCls: st.status === "balanced" ? "ok" : "wait",
        badgeTxt: st.status === "balanced" ? "已平账" : "对账中",
        amount: amount, sum: sum, diff: diff,
        verdict: verdict, vCls: vCls,
        balancedBy: st.balancedBy || "", balancedAt: st.balancedAt || ""
      });
    });
    return vm;
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        return buildVm(ctx, {
          actionPage: "请到对账中心核实后闭环",
          pendingText: "待二级企业确认（15 天仅提醒）",
          diffText: "待二级企业补齐登记",
          readyText: "可进行月度平账留痕"
        });
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "对账单已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        return buildVm(ctx, {
          actionPage: "请到对账中心核实后闭环",
          pendingText: "待二级企业确认（15 天仅提醒）",
          diffText: "待二级企业补齐登记",
          readyText: "由管理员完成月度平账留痕"
        });
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "对账单已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        return buildVm(ctx, {
          actionPage: "请到收款确认页提出异议或线下核实",
          pendingText: "待你核对确认（15 天仅提醒）",
          diffText: "待省代补齐",
          readyText: "待省代平账"
        });
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "对账单已锁定，仅可查看"
    }
  };

  /* ---------- 逐月对账单卡（系统 .card + uh- 基元） ---------- */
  function statementCard(c) {
    return '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">月度对账单 · ' + ui.esc(c.month) + "</span>" +
      '<span class="uh-badge uh-badge--' + c.badgeCls + '">' + c.badgeTxt + "</span></div>" +
      '<div class="uh-sheetkv" style="margin-top:8px"><span class="k">应付金额</span><span class="v">' + ui.money(c.amount) + "</span></div>" +
      '<div class="uh-sheetkv"><span class="k">已登记到账</span><span class="v">' + ui.money(c.sum) + "</span></div>" +
      '<div class="uh-ledgerline"></div>' +
      '<div class="uh-kv" style="padding-bottom:0"><span class="k">差异</span><span class="v">' + ui.money(c.diff) + "</span></div>" +
      '<div class="st-verdict st-verdict--' + c.vCls + '">' + ui.esc(c.verdict) + "</div>" +
      (c.balancedAt ? '<div class="uh-note" style="margin-top:8px">平账留痕：' + ui.esc(c.balancedBy) + " · " + ui.esc(c.balancedAt) + "</div>" : "") +
      "</section>";
  }

  /* 唯一渲染路径：全页仅这一个身份取值行 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    el.innerHTML =
      (ctx.readonly
        ? '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">' + (ctx.mode === "sub" ? "合作已暂停" : "合作权限已暂停") + '（仅可查看）</span>' +
          '<span class="lb-s">' + ui.esc(V.lockedNote) + '</span></div></div></section>'
        : "") +
      (vm.cards.length
        ? '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">逐月对账</span>' +
          '<span class="uh-badge uh-badge--mute">' + vm.cards.length + " 个月</span></div></section>" +
          vm.cards.map(statementCard).join("")
        : '<section class="uh-sec"><div class="card">' +
          Uni.emptyHtml("暂无对账单", "月度出账后，对账单将逐月出现在这里", "doc") +
          '</div></section>');
  }

  window.Uni.register({
    view: "uni-statement",
    route: "statement.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
