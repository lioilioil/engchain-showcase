/* page-reconcile.js · 省代对账中心
   L1 我与平台（T+5 异议） / L2 我与二级（15 天仅提醒）
   修复：L2 异议/补登记/平账闭环、超登校验、凭证预览、真实状态、单源数字、去法律效力承诺。 */
(function () {
  "use strict";
  var P = window.V3PAGES = window.V3PAGES || {};
  var curLayer = "1";

  function layerData(ctx) {
    var d = ctx.d;
    if (curLayer === "1") {
      return {
        layer: "1",
        title: "我与平台",
        sub: "平台 → 省代总代 · T+5 工作日异议",
        calc: d.calc1, regs: d.payRegs1,
        party: "平台",
        deadline: "T+5 工作日内",
        deadlineNote: "与平台对账：请在 T+5 工作日内完成核实与异议。"
      };
    }
    var sub = d.subs[0];
    return {
      layer: "2",
      title: "我与二级企业",
      sub: "省代 → 二级合作 · 出账后 15 天仅提醒",
      calc: d.calc2, regs: d.payRegs2,
      party: sub ? sub.name : "二级合作企业",
      deadline: "出账后 15 天内",
      deadlineNote: "出账后 15 天内仅提醒，系统不会自动确认、不会自动到账。"
    };
  }

  function stats(regs, calc) {
    var cur = regs.filter(function (r) { return r.calcId === calc.id; });
    var confirmed = cur.filter(function (r) { return r.status === "confirmed"; });
    var pending = cur.filter(function (r) { return r.status === "pending_confirm"; });
    var disputed = cur.filter(function (r) { return r.status === "disputed"; });
    var sum = window.V3.store.regsSum(regs, calc.id);
    return {
      cur: cur, confirmed: confirmed, pending: pending, disputed: disputed,
      sum: sum, diff: calc.calcAmount - sum,
      stmt: window.V3.store.getState().state.statements.filter(function (s) { return s.calcId === calc.id; })[0]
    };
  }

  function render(ctx) {
    var ui = ctx.ui;
    var L = layerData(ctx);
    var st = stats(L.regs, L.calc);
    var balanced = st.stmt && st.stmt.status === "balanced";
    var h = "";

    h += '<div class="v3-page-head"><div class="v3-page-title">对账中心</div>' +
      '<div class="v3-page-sub">平台账单、线下付款登记与月度平账留痕</div></div>';
    if (ctx.isStaff) {
      h += '<div class="v3-readnote v3-mb12">' + ui.icon("lock", 14) +
        "<span>员工视角：对账数据仅可查看；付款登记、异议、确认与平账留痕仅老板可操作。</span></div>";
    }

    /* 层切换 */
    h += '<div class="rc-seg"><button class="' + (curLayer === "1" ? "on" : "") + '" data-layer="1">' +
      "我与平台" + (ctx.V3.store.todoOf(ctx.s).l1 && (ctx.V3.store.todoOf(ctx.s).l1.pending + ctx.V3.store.todoOf(ctx.s).l1.disputed) ? '<span class="rc-seg__n">' + (ctx.V3.store.todoOf(ctx.s).l1.pending + ctx.V3.store.todoOf(ctx.s).l1.disputed) + "</span>" : "") + "</button>" +
      '<button class="' + (curLayer === "2" ? "on" : "") + '" data-layer="2">我与二级企业' +
      (ctx.V3.store.todoOf(ctx.s).l2 && (ctx.V3.store.todoOf(ctx.s).l2.pending + ctx.V3.store.todoOf(ctx.s).l2.disputed) ? '<span class="rc-seg__n">' + (ctx.V3.store.todoOf(ctx.s).l2.pending + ctx.V3.store.todoOf(ctx.s).l2.disputed) + "</span>" : "") + "</button></div>";

    /* 焦点卡：唯一大数字 */
    h += '<div class="rc-focus"><div class="rc-focus__k">' + L.calc.month + " · " + L.title + "（" + L.party + "）</div>";
    if (balanced) {
      h += '<div class="rc-focus__n rc-focus__n--ok num">' + ui.moneyD(0) + "</div><div class=\"rc-focus__s\">差异已清零 · 已平账留痕</div>";
    } else {
      h += '<div class="rc-focus__n' + (st.diff ? " rc-focus__n--bad" : "") + ' num">' + ui.moneyD(st.diff) + "</div>" +
        '<div class="rc-focus__s">未清差异（账单金额 ¥' + ui.moneyPlain(L.calc.calcAmount) + " − 已确认 ¥" + ui.moneyPlain(st.sum) + "）</div>";
    }
    h += '<div class="rc-focus__meta">登记 ' + st.cur.length + " 笔 · 已确认 " + st.confirmed.length + " 笔 · 异议 " + st.disputed.length + " 笔</div>";

    /* lifeBar */
    h += '<div class="rc-life">' + lifeNodes(balanced, st) + "</div>";

    /* band */
    h += renderBand(ctx, L, st, balanced);

    /* 规则入口 */
    h += '<div class="rc-rules"><button class="rc-rules-entry" data-act="show-rules">' + ui.icon("bank", 13) +
      "<span>结算口径与时限说明 ›</span></button></div>";

    /* 本月登记行 */
    h += '<div class="v3-sec-title">付款登记与凭证</div><div class="v3-stack">';
    if (!st.cur.length) {
      h += '<div class="v3-placeholder">本月暂无付款登记' + (ctx.canBoss ? "，线下付款后请登记并上传凭证" : "") + "</div>";
    }
    st.cur.forEach(function (r) { h += rowCard(ctx, L, r); });
    h += "</div>";

    /* 历史（已平账月份） */
    var prev = L.regs.filter(function (r) { return r.calcId !== L.calc.id; });
    if (prev.length) {
      h += '<div class="v3-sec-title">历史（已平账）</div><div class="v3-stack">';
      prev.forEach(function (r) { h += rowCard(ctx, L, r, true); });
      h += "</div>";
    }
    h += '<div class="gb-pay-end"></div>';
    return h;
  }

  function lifeNodes(balanced, st) {
    /* 阶段语义：无登记→账单出账；有登记（含待确认/异议）→付款登记；
       已确认且差异为零→双方确认；已平账→平账留痕 */
    var step = 1;
    if (balanced) step = 4;
    else if (st.cur.length && st.sum > 0 && st.pending.length + st.disputed.length === 0 && st.diff === 0) step = 3;
    else if (st.cur.length) step = 2;
    var nodes = ["账单出账", "付款登记", "双方确认", "平账留痕"];
    return nodes.map(function (n, i) {
      var idx = i + 1;
      var cls = balanced ? "done" : (idx < step ? "done" : idx === step ? "cur" : "");
      return '<div class="rc-life__n ' + cls + '"><span class="rc-life__dot">' + (idx < step ? "✓" : idx) + "</span>" +
        "<span>" + n + "</span></div>";
    }).join('<div class="rc-life__line"></div>');
  }

  function renderBand(ctx, L, st, balanced) {
    var ui = ctx.ui;
    var can = ctx.canBoss;
    var cls, txt, primary = "";
    if (balanced) {
      cls = "rc-band--ok";
      txt = ui.icon("check", 15) + "<span>本月已平账留痕（" + ui.esc(st.stmt.balancedAt || "") + "）</span>";
    } else if (st.disputed.length) {
      cls = "rc-band--warn";
      txt = ui.icon("warn", 15) + "<span><b>" + st.disputed.length + " 笔异议待闭环</b>（" + L.deadline + "），请线下核实；核实后可确认或冲销重登。</span>";
      /* A19：异议未闭环时不出「平账」按钮——即使 diff 恰好为 0，守卫 stmt/balance 也会因
         "存在未闭环异议" 拦截。渲染层与守卫对齐：异议态仅保留"登记线下付款"（差额>0 时）。 */
      if (can && st.diff > 0) primary = '<button type="button" class="v3-btn v3-btn--primary v3-btn--sm" data-act="register">登记线下付款</button>';
    } else if (st.diff !== 0) {
      cls = "rc-band--bad";
      txt = ui.icon("bank", 15) + "<span>差异 <b>" + ui.money(st.diff) + "</b>（账单金额 − 已确认登记）；线下付款完成后请先<b>登记并上传凭证</b>。</span>";
      if (can) primary = '<button type="button" class="v3-btn v3-btn--primary v3-btn--sm" data-act="register">登记线下付款</button>';
    } else if (st.pending.length) {
      cls = "rc-band--warn";
      if (L.layer === "1") {
        txt = ui.icon("clock", 15) + "<span>金额已对齐，<b>" + st.pending.length + " 笔待你核对确认</b>，确认后进入双方留痕。</span>";
      } else {
        txt = ui.icon("clock", 15) + "<span>金额已对齐，<b>" + st.pending.length + " 笔待二级企业确认</b>；15 天内仅提醒，不自动确认。</span>";
        if (can) primary = '<button type="button" class="v3-btn v3-btn--ghost v3-btn--sm" data-act="remind">' + ui.icon("bell", 15) + " 提醒二级确认</button>";
      }
    } else {
      cls = "rc-band--ok";
      txt = ui.icon("check", 15) + "<span>差异 ¥0、凭证齐全，<b>可月度平账留痕</b>。</span>";
      if (can) primary = '<button type="button" class="v3-btn v3-btn--primary v3-btn--sm" data-act="balance">平账留痕</button>';
    }
    return '<div class="rc-band ' + cls + '"><div class="rc-band__txt">' + txt + "</div>" + (primary ? '<div class="rc-band__act">' + primary + "</div>" : "") + "</div>";
  }

  function rowCard(ctx, L, r, history) {
    var ui = ctx.ui;
    var h = '<div class="rc-row' + (r.status === "void" ? " rc-row--void" : "") + '">' +
      '<div class="rc-row__hd"><span class="rc-row__amt num">' + ui.money(r.amount) + "</span>" +
      '<span class="v3-badge ' + ui.REG_BADGE[r.status] + '">' + ui.REG[r.status] + "</span></div>" +
      '<div class="s-prow"><span class="k">方式</span><span class="v">' + methodName(r.method) + "</span></div>" +
      '<div class="s-prow"><span class="k">付款日</span><span class="v">' + ui.esc(r.date) + "</span></div>" +
      '<div class="s-prow"><span class="k">登记人</span><span class="v">' + ui.esc(r.registeredBy) + "</span></div>";
    (r.vouchers || []).forEach(function (v, i) {
      h += '<button type="button" class="s-prow s-prow--voucher s-prow--btn" data-act="voucher" data-id="' + r.id + '" data-i="' + i + '">' +
        '<span class="k">' + ui.icon(v.kind === "image" ? "image" : "file-text", 15) + '<span class="v3-ml6">' + ui.esc(v.name) + "</span></span>" +
        '<span class="v"><span class="v3-badge v3-badge--active">查看凭证</span></span></button>';
    });
    if (r.status === "confirmed") {
      h += '<div class="s-prow"><span class="k">' + ui.icon("shield", 14) + '<span class="v3-ml6">' +
        (r.signMethod === "esign" ? "电子签留痕" : "双方确认记录") + "</span></span></div>";
    }
    if (r.status === "disputed" && r.reason) {
      h += '<div class="v3-alert v3-alert--warn v3-mt8">' + ui.icon("warn", 13) + "<span>" + ui.esc(r.reason) + "</span></div>";
      if (r.verifiedNote) h += '<div class="v3-alert v3-alert--ok v3-mt8">' + ui.icon("check-circle", 13) + "<span>核实说明：" + ui.esc(r.verifiedNote) + "</span></div>";
    }
    if (r.status === "void" && r.voidInfo) {
      h += '<div class="v3-alert v3-alert--mute v3-mt8">' + ui.icon("x-circle", 13) + "<span>已冲销：" + ui.esc(r.voidInfo.reason) + "</span></div>";
    }
    if (history) { h += "</div>"; return h; }

    if (!history && r.status === "pending_confirm" && ctx.canBoss) {
      if (L.layer === "1") {
        h += '<div class="s-actions s-actions--2">' +
          '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="dispute" data-id="' + r.id + '">提出异议</button>' +
          '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm" data-id="' + r.id + '">核对无误 · 确认</button></div>';
      } else {
        h += '<div class="s-actions"><button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="remind">' + ui.icon("bell", 15) + " 提醒二级确认</button></div>";
      }
    }
    if (!history && r.status === "disputed" && ctx.canBoss) {
      h += '<div class="s-actions s-actions--2">' +
        '<button class="v3-btn v3-btn--ghost v3-btn--sm v3-btn--danger" data-act="void" data-id="' + r.id + '">冲销作废</button>' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="verify" data-id="' + r.id + '">线下核实后确认</button></div>';
    }
    h += "</div>";
    return h;
  }

  function methodName(m) { return { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" }[m] || "线下"; }

  /* ---------- 弹层 ---------- */
  function registerSheet(ctx) {
    var L = layerData(ctx);
    var st = stats(L.regs, L.calc);
    var remain = st.diff;
    var ui = ctx.ui;
    var vouchers = [];
    ui.openSheet({
      title: "登记线下付款 · " + L.title,
      body:
        '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("warn", 14) +
        "<span>请在实际付款并取得凭证后登记；<b>上传凭证为必填</b>，金额不可超过未登记差额。</span></div>" +
        '<div class="v3-kv"><span class="k">账单金额</span><span class="v num">' + ui.money(L.calc.calcAmount) + "</span></div>" +
        '<div class="v3-kv"><span class="k">已确认登记</span><span class="v num">' + ui.money(st.sum) + "</span></div>" +
        '<div class="v3-kv"><span class="k">未登记差额</span><span class="v num"><b>' + ui.money(remain) + "</b></span></div>" +
        '<div class="v3-field v3-mt12"><label>本次登记金额（元）</label><input class="v3-input" id="rg-amount" type="number" min="0" value="' + Math.max(remain, 0) + '"></div>' +
        '<div class="v3-field"><label>付款方式</label><select class="v3-select" id="rg-method">' +
        '<option value="bank">对公转账</option><option value="wechat">微信/支付宝</option><option value="cash">现金</option><option value="other">其他</option></select></div>' +
        '<div class="v3-field"><label>付款日期</label><input class="v3-input" id="rg-date" type="date" value="2026-10-27" max="2026-10-31"></div>' +
        '<div class="v3-field"><label>付款凭证（必填，支持图片/PDF）</label>' +
        '<label class="v3-upload" id="rg-up"><span class="ic">' + ui.icon("camera", 22) + "</span>点击上传回单 / 截图" +
        '<input type="file" id="rg-file" accept="image/*,application/pdf" multiple style="display:none"></label>' +
        '<div class="v3-vlist v3-mt8" id="rg-vlist"></div></div>',
      onMount: function (wrap) {
        var inp = wrap.querySelector("#rg-file");
        inp.addEventListener("change", function () {
          Array.prototype.forEach.call(inp.files, function (file) {
            ui.fileToVoucher(file).then(function (v) {
              vouchers.push(v);
              renderVList(wrap, vouchers);
            });
          });
        });
      },
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交登记", kind: "v3-btn--primary", onClick: function (wrap) {
          var amount = Number(wrap.querySelector("#rg-amount").value);
          if (!amount || amount <= 0) { ui.toast("请填写正确金额", "err"); return false; }
          if (!vouchers.length) { ui.toast("请上传付款凭证", "err"); return false; }
          var r = ctx.V3.store.act("pay/addReg", {
            layer: L.layer,
            data: {
              amount: amount,
              method: wrap.querySelector("#rg-method").value,
              date: wrap.querySelector("#rg-date").value,
              vouchers: vouchers
            }
          });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已登记，等待确认", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }
  function renderVList(wrap, vouchers) {
    var box = wrap.querySelector("#rg-vlist");
    if (!box) return;
    box.innerHTML = vouchers.map(function (v, i) {
      return '<div class="v3-vchip">' + (v.thumb ? '<img src="' + v.thumb + '">' : "") +
        '<span>' + window.V3.ui.esc(v.name) + "</span></div>";
    }).join("");
  }

  function disputeSheet(ctx, L, r) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "提出异议 · " + L.title,
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("clock", 14) +
      "<span>" + L.deadlineNote + "</span></div>" +
      '<div class="v3-field"><label>异议说明（必填）</label>' +
      '<textarea class="v3-textarea" id="dp-reason" placeholder="如：未到账 / 金额不符 / 凭证不清"></textarea></div>' +
      '<div class="v3-field"><label>补充凭证（可选）</label>' +
      '<label class="v3-upload" id="dp-up"><span class="ic">' + ui.icon("camera", 22) + "</span>上传补充凭证" +
      '<input type="file" id="dp-file" accept="image/*,application/pdf" multiple style="display:none"></label>' +
      '<div class="v3-vlist v3-mt8" id="dp-vlist"></div></div>',
      onMount: function (wrap) {
        var vs = [];
        wrap.querySelector("#dp-file").addEventListener("change", function (e) {
          Array.prototype.forEach.call(e.target.files, function (file) {
            ui.fileToVoucher(file).then(function (v) { vs.push(v); renderVList(wrap, vs); });
          });
        });
      },
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交异议", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#dp-reason").value.trim();
          if (!reason) { ui.toast("请填写异议说明", "err"); return false; }
          var r2 = ctx.V3.store.act("pay/dispute", { layer: L.layer, id: r.id, reason: reason });
          if (!r2.ok) { ui.toast(r2.reason, "err"); return false; }
          ui.toast("已提交异议", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function confirmSheet(ctx, L, r) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "确认付款 · " + L.title,
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("warn", 14) +
      "<span>仅在实际核对到账金额与凭证一致后确认；确认后进入双方留痕。</span></div>" +
      '<div class="v3-kv"><span class="k">确认金额</span><span class="v num">' + ui.money(r.amount) + "</span></div>" +
      '<div class="v3-kv"><span class="k">确认方式</span><span class="v">双方确认记录（电子签留痕）</span></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "电子签留痕", kind: "v3-btn--ghost", onClick: function () {
          esignModal(ctx, L, r);
          return false;
        } },
        { t: "确认到账（记录）", kind: "v3-btn--primary", onClick: function () {
          var res = ctx.V3.store.act("pay/confirm", { layer: L.layer, id: r.id, signMethod: "record" });
          if (!res.ok) { ui.toast(res.reason, "err"); return false; }
          ui.toast("已确认", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function verifySheet(ctx, L, r) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "线下核实后确认",
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("warn", 14) +
      "<span>该笔存在异议，确认前必须填写线下核实说明并留痕。</span></div>" +
      '<div class="v3-alert v3-alert--mute v3-mb12">' + ui.esc(r.reason || "") + "</div>" +
      '<div class="v3-field"><label>核实说明（必填）</label><textarea class="v3-textarea" id="vf-note" placeholder="如：已与对方核对回单，差异为信息服务费…"></textarea></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "确认闭环", kind: "v3-btn--primary", onClick: function (wrap) {
          var note = wrap.querySelector("#vf-note").value.trim();
          if (!note) { ui.toast("请填写核实说明", "err"); return false; }
          var res = ctx.V3.store.act("pay/confirm", { layer: L.layer, id: r.id, signMethod: "record", verifiedNote: note });
          if (!res.ok) { ui.toast(res.reason, "err"); return false; }
          ui.toast("异议已闭环", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function voidSheet(ctx, L, r) {
    var ui = ctx.ui;
    ui.openModal({
      danger: true, icon: "warn", title: "冲销该笔登记？",
      body: "冲销后该笔标记为作废并留痕，可重新登记正确金额。已确认记录不可冲销。",
      okText: "确认冲销",
      onOk: function () {
        var res = ctx.V3.store.act("pay/void", { layer: L.layer, id: r.id });
        if (!res.ok) { ui.toast(res.reason, "err"); return false; }
        ui.toast("已冲销", "ok");
        ctx.V3.router.render();
      }
    });
  }

  function esignModal(ctx, L, r) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "电子签署",
      body: '<div class="v3-alert v3-alert--warn v3-mb12">' + ui.icon("info", 14) +
      "<span>签署后生成电子签留痕。</span></div>" +
      '<div class="v3-kv"><span class="k">签署金额</span><span class="v num">' + ui.money(r.amount) + "</span></div>" +
      '<div class="v3-kv"><span class="k">层级</span><span class="v">' + L.title + "</span></div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "同意并签署", kind: "v3-btn--primary", onClick: function () {
          var res = ctx.V3.store.act("pay/confirm", { layer: L.layer, id: r.id, signMethod: "esign" });
          if (!res.ok) { ui.toast(res.reason, "err"); return false; }
          ui.toast("电子签留痕完成", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function rulesSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "结算口径与时限",
      body: '<div class="v3-legal-body"><p><b>合格消费：</b>平台月度账单中实际完成的合格消费，退货、退款、取消订单不计入。</p>' +
      '<p><b>第一层（平台 → 省代）：</b>T+5 工作日内完成核对与异议。</p>' +
      '<p><b>第二层（省代 → 二级）：</b>出账后 15 天内仅提醒，系统不自动确认、不自动到账。</p>' +
      '<p><b>平账：</b>登记全部确认、无未闭环异议、差异为 ¥0 后，由省代月度平账留痕。</p>' +
      '<p><b>凭证：</b>所有线下付款必须登记凭证，金额不可超过未登记差额。</p></div>',
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  function mount(el, ctx) {
    var ui = ctx.ui;
    el.addEventListener("click", function (e) {
      var layerBtn = e.target.closest("[data-layer]");
      if (layerBtn) { curLayer = layerBtn.getAttribute("data-layer"); ctx.V3.router.render(); return; }
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      var L = layerData(ctx);
      var find = function (id) { return L.regs.filter(function (x) { return x.id === id; })[0]; };
      if (act === "register") {
        if (!ctx.canBoss) return ctx.ui.toast("仅老板可登记", "err");
        registerSheet(ctx);
      } else if (act === "balance") {
        if (!ctx.canBoss) return ctx.ui.toast("仅老板可平账", "err");
        var res = ctx.V3.store.act("stmt/balance", { layer: L.layer });
        if (!res.ok) { ctx.ui.toast(res.reason, "err"); return; }
        ctx.ui.toast("已月度平账留痕", "ok");
        ctx.V3.router.render();
      } else if (act === "remind") {
        if (!ctx.canBoss) return ctx.ui.toast("仅老板可发送提醒", "err");
        var r = ctx.V3.store.act("msg/add", { msg: { icon: "bell", type: "warn", title: "已提醒二级企业确认收款", desc: L.calc.month + " " + ui.money(L.calc.calcAmount) + "，15 天内仅提醒不自动到账", to: "#/reconcile" } });
        if (!r.ok) { ctx.ui.toast(r.reason, "err"); return; }
        ctx.ui.toast("已提醒二级企业", "ok");
        ctx.V3.router.render();
      } else if (act === "show-rules") {
        rulesSheet(ctx);
      } else if (act === "voucher") {
        var reg = find(b.getAttribute("data-id"));
        var v = reg && reg.vouchers[Number(b.getAttribute("data-i"))];
        if (v) ui.previewVoucher(v);
      } else if (act === "confirm") {
        confirmSheet(ctx, L, find(b.getAttribute("data-id")));
      } else if (act === "verify") {
        verifySheet(ctx, L, find(b.getAttribute("data-id")));
      } else if (act === "dispute") {
        disputeSheet(ctx, L, find(b.getAttribute("data-id")));
      } else if (act === "void") {
        voidSheet(ctx, L, find(b.getAttribute("data-id")));
      }
    });
  }

  P.reconcile = { title: "对账中心", render: render, mount: mount };
})();
