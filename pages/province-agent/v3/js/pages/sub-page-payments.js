/* sub-page-payments.js · 二级 收款确认 #/payments · 月度对账单 #/statement · 待办 #/inbox */
(function () {
  "use strict";

  function methodName(m) { return { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" }[m] || "线下"; }

  /* ---------------- 收款确认 ---------------- */
  function renderPayments(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var cur = d.calc[0];
    var curRegs = d.payRegs.filter(function (r) { return r.calcId === cur.id; });
    var h = '<div class="v3-readnote v3-mb12" >' + ui.icon("clock", 16) +
      "<span>省代在 <b>App 外</b> 线下付款后登记凭证；请你核对到账与凭证一致再确认。" +
      "出账后 <b>15 天内仅提醒，绝不自动确认到账</b>。</span></div>";

    /* 临期进度 */
    var dueDay = cur.dueDay || 0, pct = Math.round(dueDay / 15 * 100);
    var dueCls = dueDay >= 15 ? "danger" : dueDay >= 10 ? "warn" : "ok";
    h += '<section class="v3-card"><div class="v3-flex v3-between"><span class="v3-sm v3-strong">' + cur.month + " 省代应付款（测算）</span>" +
      '<span class="v3-due v3-due--' + dueCls + '">第 ' + dueDay + " / 15 天</span></div>" +
      '<div class="v3-display num v3-goldtext v3-mt8mb10" >' + ui.money(cur.calcAmount) + "</div>" +
      '<div class="v3-progress"><i class="' + (dueCls === "ok" ? "" : dueCls) + '" style="width:' + pct + '%"></i></div>' +
      '<div class="v3-xs v3-muted v3-mt7" >逾期仍只提醒省代与你，<b>系统不会自动确认、不会自动到账</b>。</div></section>';

    h += '<div class="v3-sec-title">付款登记与凭证</div>';
    if (!curRegs.length) {
      h += '<div class="v3-placeholder">省代尚未登记本月线下付款，请留意待办提醒。</div>';
    } else {
      curRegs.forEach(function (r) { h += regCard(ctx, r); });
    }

    var prev = d.calc[1];
    var prevRegs = d.payRegs.filter(function (r) { return r.calcId === prev.id; });
    h += '<div class="v3-sec-title">' + prev.month + " 历史（已平账）</div>";
    prevRegs.forEach(function (r) { h += regCard(ctx, r, true); });

    h += '<p class="v3-legal v3-mt12" >' + ctx.V3.MONEY_NOTE + "</p>";
    return h;
  }

  function regCard(ctx, r, history) {
    var ui = ctx.ui;
    var h = '<div class="rc-reg" style="' + (r.status === "void" ? "opacity:.6" : "") + '">' +
      '<div class="rc-reg__hd"><span class="amt num">' + ui.money(r.amount) + "</span>" +
      '<span class="v3-badge ' + ui.REG_BADGE[r.status] + '">' + ui.REG[r.status] + "</span></div>" +
      '<div class="kv-mini">方式 ' + methodName(r.method) + " · 付款日 " + ui.esc(r.date) + " · 登记人 " + ui.esc(r.registeredBy) + "</div>";
    (r.vouchers || []).forEach(function (v) {
      h += '<div class="rc-voucherline">' + ui.icon(v.kind === "image" ? "camera" : "file", 16) +
        "<span>" + ui.esc(v.name) + "</span><span class='v3-badge v3-badge--active v3-mxa' >已附凭证</span></div>";
    });
    if (r.status === "confirmed") {
      h += '<div class="rc-voucherline v3-mt6" >' + ui.icon("shield", 16) +
        "<span>" + (r.signMethod === "esign" ? "确认 + 电子签留痕" : "双方确认记录") + "</span></div>";
    }
    if (r.status === "disputed" && r.reason) h += '<div class="v3-alert v3-alert--warn v3-mt8" >' + ui.esc(r.reason) + "</div>";

    if (!history && r.status === "pending_confirm" && !ctx.readonly) {
      h += '<div class="rc-actions">' +
        '<button class="v3-btn v3-btn--danger v3-btn--sm" data-act="dispute" data-id="' + r.id + '">未收到 / 提异议</button>' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm" data-id="' + r.id + '">核对无误 · 确认</button></div>';
    }
    if (!history && r.status === "disputed" && !ctx.readonly) {
      h += '<div class="rc-actions"><button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm" data-id="' + r.id + '">线下核实后确认</button></div>';
    }
    h += "</div>";
    return h;
  }

  function mountPayments(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id");
      if (b.getAttribute("data-act") === "confirm") confirmSheet(ctx, id);
      else disputeSheet(ctx, id);
    });
  }
  function confirmSheet(ctx, id) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "确认省代线下到账",
      body: '<div class="v3-alert v3-alert--warn v3-mb12" >仅在你已<b>实际核对到账金额与凭证一致</b>后确认；确认后进入双方留痕。</div>' +
        '<div class="rc-voucherline">' + ui.icon("shield", 16) + "<span>确认方式：双方确认记录（电子签正式接入为 P1，现可模拟签署）</span></div>",
      footer: [
        { t: "确认到账（记录）", kind: "v3-btn--primary", onClick: function () {
          V3.store.act("pay/confirm", { layer: "2", id: id, signMethod: "record" }); ui.toast("已确认", "ok"); V3.router.render();
        } },
        { t: "确认并电子签", kind: "v3-btn--navy", onClick: function () {
          ui.openModal({
            title: "电子签署（Mock）", icon: "shield",
            body: "此处为电子签能力演示占位，正式环境接入可信电子签并留存证书。", okText: "同意并签署",
            onOk: function () { V3.ui.closeAll(); V3.store.act("pay/confirm", { layer: "2", id: id, signMethod: "esign" }); ui.toast("电子签完成（Mock，正式 P1）", "ok"); V3.router.render(); }
          });
          return false;
        } }
      ]
    });
  }
  function disputeSheet(ctx, id) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "提出异议",
      body: '<div class="v3-field"><label>异议说明（必填）</label><textarea class="v3-textarea" id="pd-reason" placeholder="如：未收到该笔 / 金额不符 / 凭证不清"></textarea></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交异议", kind: "v3-btn--danger", onClick: function (wrap) {
          var r = wrap.querySelector("#pd-reason").value.trim();
          if (!r) { ui.toast("请填写异议说明", "err"); return false; }
          V3.store.act("pay/dispute", { layer: "2", id: id, reason: r }); ui.toast("已提交异议", "ok"); V3.router.render();
        } }
      ]
    });
  }

  /* ---------------- 月度对账单（只读） ---------------- */
  function renderStatement(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var h = '<div class="v3-readnote v3-mb12" >' + ui.icon("receipt", 16) +
      "<span>月度对账单由双方确认后由对账流程平账留痕；你在此<b>只读查看</b>测算、登记与差异。</span></div>";
    d.statements.forEach(function (st, i) {
      var calc = d.calc[i];
      var sum = V3.store.regsSum(d.payRegs, calc.id);
      var diff = calc.calcAmount - sum;
      h += '<section class="rc-layer v3-mb12" ><div class="rc-layer__hd">' + ui.icon("doc", 17) +
        '<span class="t">' + calc.month + " 对账单</span>" +
        (st.status === "balanced" ? '<span class="v3-badge v3-badge--active">已平账</span>' : '<span class="v3-badge v3-badge--pending">对账中</span>') +
        "</div>" +
        '<div class="rc-calc"><div class="box calc"><div class="n num">' + ui.money(calc.calcAmount) + '</div><div class="k">测算应付</div></div>' +
        '<div class="op">−</div><div class="box reg"><div class="n num">' + ui.money(sum) + '</div><div class="k">已登记到账</div></div></div>';
      if (st.status === "balanced") h += '<div class="rc-diff zero">' + ui.icon("check", 16) + "<span><b>差异 ¥0 · 已平账留痕</b></span></div>";
      else if (diff === 0) h += '<div class="rc-diff zero">' + ui.icon("clock", 16) + "<span>金额已对齐，待确认后平账（15 天内仅提醒）。</span></div>";
      else h += '<div class="rc-diff bad">' + ui.icon("warn", 16) + "<span><b>差异 " + ui.money(diff) + "</b>，待省代补齐。</span></div>";
      h += "</section>";
    });
    h += '<p class="v3-legal">' + V3.MONEY_NOTE + "</p>";
    return h;
  }

  /* ---------------- 待办 ---------------- */
  function renderInbox(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var items = [];
    d.payRegs.forEach(function (r) {
      var calc = d.calc.filter(function (c) { return c.id === r.calcId; })[0];
      if (r.status === "pending_confirm") items.push({ type: "warn", icon: "clock", t: "待确认收款 " + ui.money(r.amount), s: calc.month + " · 出账第 " + (r.dueDay || calc.dueDay || 0) + " / 15 天，仅提醒不自动到账", go: "#/payments" });
      if (r.status === "disputed") items.push({ type: "danger", icon: "warn", t: "有异议的付款 " + ui.money(r.amount), s: r.reason || "待线下核实", go: "#/payments" });
    });
    (d.alerts || []).forEach(function (a) { items.push({ type: a.type, icon: a.icon, t: a.title, s: a.desc, go: a.to || "#/payments" }); });
    if (d.agreement && d.agreement.state === "pending_mine") items.push({ type: "info", icon: "doc", t: "O4 协议待签署", s: "请查看并完成签署 / 拒签", go: "#/home" });

    if (!items.length) return '<div class="v3-empty"><div class="ic">' + ui.icon("check", 28) + '</div><div class="t">暂无待办</div><div class="d">所有收款均已确认，协议已签署。</div></div>';
    return '<div class="v3-stack">' + items.map(function (it) {
      return '<button class="v3-alert v3-alert--' + it.type + '" style="width:100%;text-align:left" data-go="' + it.go + '">' +
        "<span>" + it.icon + "</span><div><b>" + ui.esc(it.t) + "</b><div class='v3-xs v3-mt2' >" + ui.esc(it.s) + "</div></div></button>";
    }).join("") + "</div>";
  }
  function mountInbox(el, ctx) {
    el.addEventListener("click", function (e) { var g = e.target.closest("[data-go]"); if (g) ctx.go(g.getAttribute("data-go")); });
  }

  window.V3SUBPAGES.payments = { title: "收款确认", render: renderPayments, mount: mountPayments };
  window.V3SUBPAGES.statement = { title: "月度对账单", render: renderStatement, mount: function () {} };
  window.V3SUBPAGES.inbox = { title: "待办提醒", render: renderInbox, mount: mountInbox };
})();
