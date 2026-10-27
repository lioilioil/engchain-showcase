/* sub-page-payments.js · 二级 收款确认 #/payments · 月度对账单 #/statement
   修复：凭证预览、对账单按 calcId 关联、异议确认需核实说明、演示口径统一、去 inbox。 */
(function () {
  "use strict";
  var SP = window.V3SUBPAGES = window.V3SUBPAGES || {};

  function methodName(m) { return { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" }[m] || "线下"; }

  /* ---------------- 收款确认 ---------------- */
  function renderPayments(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var cur = d.calc[0];
    var curRegs = d.payRegs.filter(function (r) { return r.calcId === cur.id; });
    var h = '<div class="v3-page-head"><div class="v3-page-title">收款确认</div>' +
      '<div class="v3-page-sub">省代在 App 外线下付款后登记凭证，核对到账一致后确认</div></div>';

    h += '<div class="sub-note v3-mb12">' + ui.icon("clock", 15) +
      "<span>出账后 <b>15 天内仅提醒，绝不自动确认到账</b>；逾期仍只提醒省代与你，系统不会自动确认、不会自动到账。</span></div>";

    var dueDay = cur.dueDay || 0, pct = Math.round(dueDay / 15 * 100);
    var dueCls = dueDay >= 15 ? "danger" : dueDay >= 10 ? "warn" : "ok";
    h += '<section class="s-l2"><div class="v3-flex v3-between"><span class="v3-sm v3-strong">' + cur.month + " 省代应付款（测算）</span>" +
      '<span class="v3-due v3-due--' + dueCls + '">第 ' + dueDay + " / 15 天</span></div>" +
      '<div class="v3-display num v3-goldtext v3-mt8">' + ui.moneyD(cur.calcAmount) + "</div>" +
      '<div class="v3-progress"><i class="' + (dueCls === "ok" ? "" : dueCls) + '" style="width:' + pct + '%"></i></div></section>';

    h += '<div class="v3-sec-title">付款登记与凭证</div>';
    if (!curRegs.length) {
      h += '<div class="v3-placeholder">省代尚未登记本月线下付款，请留意消息中心通知。</div>';
    } else {
      h += '<div class="v3-stack">' + curRegs.map(function (r) { return regPanel(ctx, r); }).join("") + "</div>";
    }

    var prev = d.calc[1];
    var prevRegs = d.payRegs.filter(function (r) { return r.calcId === prev.id; });
    if (prevRegs.length) {
      h += '<div class="v3-sec-title">' + prev.month + " 历史（已平账）</div><div class=\"v3-stack\">" +
        prevRegs.map(function (r) { return regPanel(ctx, r, true); }).join("") + "</div>";
    }
    h += '<div class="gb-pay-end"></div>';
    return h;
  }

  function regPanel(ctx, r, history) {
    var ui = ctx.ui;
    var h = '<section class="s-l2 s-payreg' + (r.status === "void" ? " s-payreg--void" : "") + '">' +
      '<div class="s-panel-hd"><span class="t num">' + ui.money(r.amount) + "</span>" +
      '<span class="v3-badge ' + ui.REG_BADGE[r.status] + '">' + ui.REG[r.status] + "</span></div>" +
      '<div class="s-prow"><span class="k">方式</span><span class="v">' + methodName(r.method) + "</span></div>" +
      '<div class="s-prow"><span class="k">付款日</span><span class="v">' + ui.esc(r.date) + "</span></div>" +
      '<div class="s-prow"><span class="k">登记人</span><span class="v">' + ui.esc(r.registeredBy) + "</span></div>";
    (r.vouchers || []).forEach(function (v, i) {
      h += '<button type="button" class="s-prow s-prow--voucher s-prow--btn" data-act="voucher" data-id="' + r.id + '" data-i="' + i + '">' +
        '<span class="k">' + ui.icon(v.kind === "image" ? "image" : "file-text", 15) +
        '<span class="v3-ml6">' + ui.esc(v.name) + "</span></span>" +
        '<span class="v"><span class="v3-badge v3-badge--active">查看凭证</span></span></button>';
    });
    if (r.status === "confirmed") {
      h += '<div class="s-prow"><span class="k">' + ui.icon("shield", 15) + '<span class="v3-ml6">' +
        (r.signMethod === "esign" ? "电子签留痕（演示）" : "双方确认记录") + "</span></span></div>";
    }
    if (r.status === "disputed" && r.reason) {
      h += '<div class="v3-alert v3-alert--warn v3-mt8">' + ui.icon("warn", 13) + "<span>" + ui.esc(r.reason) + "</span></div>";
    }
    if (r.status === "disputed" && r.verifiedNote) {
      h += '<div class="v3-alert v3-alert--ok v3-mt8">' + ui.icon("check-circle", 13) + "<span>核实说明：" + ui.esc(r.verifiedNote) + "</span></div>";
    }
    if (r.status === "void" && r.voidInfo) {
      h += '<div class="v3-alert v3-alert--mute v3-mt8">' + ui.icon("x-circle", 13) + "<span>已冲销：" + ui.esc(r.voidInfo.reason) + "</span></div>";
    }

    if (!history && r.status === "pending_confirm" && !ctx.readonly) {
      h += '<div class="s-actions s-actions--2">' +
        '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="dispute" data-id="' + r.id + '">未收到 / 提异议</button>' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm" data-id="' + r.id + '">核对无误 · 确认</button></div>';
    }
    if (!history && r.status === "disputed" && !ctx.readonly) {
      h += '<div class="s-actions"><button class="v3-btn v3-btn--primary v3-btn--sm" data-act="verify" data-id="' + r.id + '">线下核实后确认</button></div>';
    }
    h += "</section>";
    return h;
  }

  function mountPayments(el, ctx) {
    var ui = ctx.ui;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      var id = b.getAttribute("data-id");
      var reg = ctx.d.payRegs.filter(function (x) { return x.id === id; })[0];
      if (act === "voucher") {
        var v = reg && reg.vouchers[Number(b.getAttribute("data-i"))];
        if (v) ui.previewVoucher(v);
      } else if (act === "confirm") {
        confirmSheet(ctx, reg);
      } else if (act === "verify") {
        verifySheet(ctx, reg);
      } else if (act === "dispute") {
        disputeSheet(ctx, reg);
      }
    });
  }

  function confirmSheet(ctx, reg) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "确认省代线下到账",
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("warn", 14) +
      "<span>仅在你已<b>实际核对到账金额与凭证一致</b>后确认；确认后进入双方留痕。</span></div>" +
      '<div class="v3-kv"><span class="k">确认金额</span><span class="v num">' + ui.money(reg.amount) + "</span></div>" +
      '<div class="v3-kv"><span class="k">确认方式</span><span class="v">双方确认记录（电子签为演示留痕）</span></div>',
      footer: [
        { t: "电子签留痕（演示）", kind: "v3-btn--ghost", onClick: function () {
          esignModal(ctx, reg);
          return false;
        } },
        { t: "确认到账（记录）", kind: "v3-btn--primary", onClick: function () {
          var r = ctx.V3.store.act("pay/confirm", { layer: "2", id: reg.id, signMethod: "record" });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已确认，等待省代平账", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function verifySheet(ctx, reg) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "线下核实后确认",
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("warn", 14) +
      "<span>该笔曾提出异议，确认前必须填写线下核实说明。</span></div>" +
      '<div class="v3-alert v3-alert--mute v3-mb12">' + ui.esc(reg.reason || "") + "</div>" +
      '<div class="v3-field"><label>核实说明（必填）</label><textarea class="v3-textarea" id="vv-note" placeholder="如：已与省代核对，补差额将在下月账单中体现"></textarea></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "确认闭环", kind: "v3-btn--primary", onClick: function (wrap) {
          var note = wrap.querySelector("#vv-note").value.trim();
          if (!note) { ui.toast("请填写核实说明", "err"); return false; }
          var r = ctx.V3.store.act("pay/confirm", { layer: "2", id: reg.id, signMethod: "record", verifiedNote: note });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已确认，等待省代平账", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function esignModal(ctx, reg) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "电子签署（演示留痕）",
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("info", 14) +
      "<span>当前为演示环境，电子签为模拟留痕，正式电子签以平台接入第三方服务为准。</span></div>" +
      '<div class="v3-kv"><span class="k">签署金额</span><span class="v num">' + ui.money(reg.amount) + "</span></div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "同意并签署（演示）", kind: "v3-btn--primary", onClick: function () {
          var r = ctx.V3.store.act("pay/confirm", { layer: "2", id: reg.id, signMethod: "esign" });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("电子签留痕完成（演示）", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function disputeSheet(ctx, reg) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "提出异议",
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("clock", 14) +
      "<span>出账后 15 天内可提出异议，异议仅提醒双方线下核实，不会自动退款。</span></div>" +
      '<div class="v3-field"><label>异议说明（必填）</label><textarea class="v3-textarea" id="pd-reason" placeholder="如：未收到该笔 / 金额不符 / 凭证不清"></textarea></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交异议", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#pd-reason").value.trim();
          if (!reason) { ui.toast("请填写异议说明", "err"); return false; }
          var r = ctx.V3.store.act("pay/dispute", { layer: "2", id: reg.id, reason: reason });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已提交异议", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  /* ---------------- 月度对账单（只读） ---------------- */
  function renderStatement(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var h = '<div class="v3-page-head"><div class="v3-page-title">月度对账单</div>' +
      '<div class="v3-page-sub">只读查看测算、登记与差异；平账由省代完成</div></div>';
    h += '<div class="v3-stack">';
    d.statements.forEach(function (st) {
      var calc = d.calc.filter(function (c) { return c.id === st.calcId; })[0];
      if (!calc) return;
      var monthRegs = d.payRegs.filter(function (r) { return r.calcId === calc.id; });
      var pend = monthRegs.filter(function (r) { return r.status === "pending_confirm"; });
      var disp = monthRegs.filter(function (r) { return r.status === "disputed"; });
      var sumAmt = function (list) { return list.reduce(function (s, r) { return s + r.amount; }, 0); };
      var registered = sumAmt(monthRegs.filter(function (r) { return r.status !== "void"; }));
      var confirmed = sumAmt(monthRegs.filter(function (r) { return r.status === "confirmed"; }));
      var diff = calc.calcAmount - confirmed;
      h += '<section class="s-l2 s-stmt">' +
        '<div class="s-panel-hd"><span class="t">' + calc.month + " 对账单</span>" +
        (st.status === "balanced" ? '<span class="v3-badge v3-badge--active">已平账</span>' : '<span class="v3-badge v3-badge--pending">对账中</span>') +
        "</div>" +
        '<div class="s-calcrow">' +
        '<div class="box"><div class="n num">' + ui.money(calc.calcAmount) + '</div><div class="k">测算应付</div></div>' +
        '<div class="op">−</div>' +
        '<div class="box"><div class="n num">' + ui.money(registered) + '</div><div class="k">已登记到账</div></div>' +
        "</div>";
      if (st.status === "balanced") {
        h += '<div class="s-diff s-diff--ok">' + ui.icon("check", 15) + "<span><b>差异 ¥0 · 已平账留痕</b></span></div>";
      } else if (disp.length) {
        h += '<div class="s-diff s-diff--bad">' + ui.icon("warn", 15) +
          "<span><b>" + disp.length + " 笔登记存在异议</b>（" + ui.money(sumAmt(disp)) + "），请在收款确认页提出异议或线下核实。</span></div>";
      } else if (pend.length) {
        h += '<div class="s-diff">' + ui.icon("clock", 15) +
          "<span>已登记 " + ui.money(registered) + "，<b>" + pend.length + " 笔待你核对确认</b>（15 天内仅提醒，不会自动确认）。</span></div>";
      } else if (diff > 0) {
        h += '<div class="s-diff s-diff--bad">' + ui.icon("warn", 15) + "<span><b>差异 " + ui.money(diff) + "</b>，待省代补齐。</span></div>";
      } else {
        h += '<div class="s-diff s-diff--ok">' + ui.icon("check", 15) +
          "<span><b>金额已对齐，待省代平账</b>（15 天内仅提醒）。</span></div>";
      }
      h += "</section>";
    });
    h += "</div>";
    return h;
  }

  SP.payments = { title: "收款确认", render: renderPayments, mount: mountPayments };
  SP.statement = { title: "月度对账单", render: renderStatement, mount: function () {} };
})();
