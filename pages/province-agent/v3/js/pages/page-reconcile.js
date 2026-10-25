/* page-reconcile.js · 对账留痕 #/reconcile（两层 / 凭证强制 / diff=0 平账 / 红冲） */
(function () {
  "use strict";

  function layerData(d, layer) {
    if (String(layer) === "1") return { calc: d.calc1, regs: d.payRegs1, stmts: d.statements1, title: "第一层 · 平台 ⇄ 省代", side: "你确认平台线下到账", tone: "1" };
    return { calc: d.calc2, regs: d.payRegs2, stmts: d.statements2, title: "第二层 · 省代 ⇄ 二级", side: "等待二级确认（15 天只提醒）", tone: "2" };
  }

  function render(ctx) {
    var ui = ctx.ui;
    var h = '<div class="v3-readnote v3-mb12" >' + ui.icon("bank", 16) +
      "<span>线下付款在 App 外完成；此处只做<b>登记 · 凭证 · 确认 · 对账留痕</b>。" +
      "测算金额只读，恒等呈现 <b>测算应付 − 线下实付登记 = 差异</b>，差异为 0 且全部确认才可平账。</span></div>";
    h += layerCard(ctx, "1");
    h += '<div style="height:12px"></div>';
    h += layerCard(ctx, "2");
    h += '<div class="trust">全程为 ' + ctx.V3.MONEY_NOTE + "<br/>红冲只追加红字记录，不物理删除任何凭证。</div>";
    return h;
  }

  function layerCard(ctx, layer) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var L = layerData(d, layer);
    var curCalc = L.calc[0], prevCalc = L.calc[1];
    var curStmt = L.stmts[0];
    var regs = L.regs.filter(function (r) { return r.calcId === curCalc.id; });
    var sum = V3.store.regsSum(L.regs, curCalc.id);
    var diff = curCalc.calcAmount - sum;
    var activeRegs = regs.filter(function (r) { return r.status !== "void"; });
    var allConfirmed = activeRegs.length > 0 && activeRegs.every(function (r) { return r.status === "confirmed"; });
    var balanced = curStmt.status === "balanced";
    var isL2 = String(layer) === "2";

    var h = '<section class="rc-layer" data-layer="' + layer + '">' +
      '<div class="rc-layer__hd"><span>' + (isL2 ? ui.icon("user", 18) : ui.icon("bank", 18)) + "</span>" +
      '<span class="t">' + L.title + "</span>" +
      (balanced ? '<span class="v3-badge v3-badge--active">已平账</span>' : '<span class="v3-badge v3-badge--pending">对账中</span>') +
      "</div><div class='v3-pad12-14-0'>" +
      '<div class="rc-dueline">' + ui.icon("clock", 15) + "<span>" + ui.esc(curCalc.dueLabel) + "</span></div></div>";

    /* 三行勾稽 */
    h += '<div class="rc-calc"><div class="box calc"><div class="n num">' + ui.money(curCalc.calcAmount) + '</div><div class="k">测算应付（只读）</div></div>' +
      '<div class="op">−</div><div class="box reg"><div class="n num">' + ui.money(sum) + '</div><div class="k">线下实付登记</div></div></div>';
    if (balanced) {
      h += '<div class="rc-diff zero">' + ui.icon("check", 16) + "<span><b>差异 ¥0 · 已平账留痕</b>（" + ui.esc(curStmt.balancedAt) + "）</span></div>";
    } else if (diff === 0 && allConfirmed) {
      h += '<div class="rc-diff zero">' + ui.icon("check", 16) + "<span><b>差异 ¥0，全部已确认</b>，可平账留痕。</span></div>";
    } else if (diff === 0 && !allConfirmed) {
      h += '<div class="rc-diff bad" style="background:var(--v3-warn-bg);color:var(--v3-warn);border-color:var(--v3-warn-line)">' +
        ui.icon("clock", 16) + "<span><b>金额已对齐</b>，但仍有 " + activeRegs.filter(function (r) { return r.status !== "confirmed"; }).length +
        " 笔待确认" + (isL2 ? "（等待二级，仅提醒不自动到账）" : "") + "。</span></div>";
    } else {
      h += '<div class="rc-diff bad">' + ui.icon("warn", 16) + "<span><b>差异 " + ui.money(diff) + "</b>，平账已锁定，请补齐登记 / 处理异议。</span></div>";
    }

    /* 流程链 */
    var step = 1;
    if (activeRegs.length) step = 2;
    if (activeRegs.some(function (r) { return r.status === "confirmed" || r.status === "disputed"; })) step = 3;
    if (allConfirmed && diff === 0) step = balanced ? 5 : 4;
    if (balanced) step = 5;
    h += '<div class="rc-steps">' +
      ["测算单", "App 外付款", "登记+凭证", "确认/异议", "差异0平账"].map(function (s, i) {
        return '<span class="rc-step ' + (i + 1 <= step ? "on" : "") + '">' + s + "</span>";
      }).join("") + "</div>";

    /* 登记明细 */
    h += '<div class="v3-px14" ><div class="v3-flex v3-between v3-mt2mb8" ><span class="v3-sm v3-strong">' + curCalc.month + " 登记明细</span>" +
      '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="add-reg">+ 登记线下付款</button></div>';
    if (!regs.length) {
      h += '<div class="v3-placeholder v3-mb10" >尚无登记。请在 App 外完成付款后，登记金额并上传凭证（凭证强制）。</div>';
    } else {
      regs.forEach(function (r) { h += regCard(ctx, r, isL2); });
    }

    /* 平账 / 第二层提醒 */
    if (!balanced) {
      if (isL2) {
        h += '<button class="v3-btn v3-btn--block v3-btn--ghost v3-mt4mb14" data-act="remind" >' + ui.icon("bell", 17) + " 提醒二级确认（不自动到账）</button>";
      } else {
        var canBalance = diff === 0 && allConfirmed && ctx.canBoss && !ctx.readonly;
        h += '<button class="v3-btn v3-btn--block v3-mt4mb14 ' + (canBalance ? "v3-btn--navy" : "is-disabled") + '" ' +
     (canBalance ? 'data-act="balance"' : "") + ' >差异 0 且全部确认后 · 月度平账留痕</button>';
      }
    }
    h += "</div>"; // end padding

    /* 历史月份 */
    h += '<div style="border-top:1px solid var(--v3-line)" class="v3-flex v3-between v3-pad10-14">' +
      "<span class='v3-xs v3-muted'>" + prevCalc.month + " 月度对账单</span>" +
      '<span class="v3-badge v3-badge--active">已平账 ' + ui.money(prevCalc.calcAmount) + "</span></div>";

    h += "</section>";
    return h;
  }

  function regCard(ctx, r, isL2) {
    var ui = ctx.ui;
    var voided = r.status === "void";
    var h = '<div class="rc-reg" style="' + (voided ? "opacity:.6" : "") + '" data-rid="' + r.id + '">' +
      '<div class="rc-reg__hd"><span class="amt num">' + ui.money(r.amount) + "</span>" +
      '<span class="v3-badge ' + ui.REG_BADGE[r.status] + '">' + ui.REG[r.status] + "</span></div>" +
      '<div class="kv-mini">' + (r.redFlushOf ? "<b>红字冲销原登记笔</b> · " : "") +
      "方式 " + methodName(r.method) + " · 付款日 " + ui.esc(r.date) + " · 登记人 " + ui.esc(r.registeredBy) + "</div>";
    (r.vouchers || []).forEach(function (v) {
      h += '<div class="rc-voucherline">' + ui.icon(v.kind === "image" ? "camera" : "file", 16) +
        "<span>" + ui.esc(v.name) + "</span><span class='v3-badge v3-badge--active v3-mxa' >凭证</span></div>";
    });
    if (r.status === "confirmed" && r.signMethod) {
      h += '<div class="rc-voucherline v3-mt6" >' + ui.icon("shield", 16) +
        "<span>" + (r.signMethod === "esign" ? "确认 + 电子签留痕" : "双方确认记录") + "</span></div>";
    }
    if (r.status === "disputed" && r.reason) h += '<div class="v3-alert v3-alert--warn v3-mt8" >' + ui.esc(r.reason) + "</div>";
    if (r.voidInfo) h += '<div class="v3-xs v3-faint v3-mt6" >作废/红冲：' + ui.esc(r.voidInfo.reason) + " · " + ui.esc(r.voidInfo.at) + "</div>";

    if (!voided && !ctx.readonly) {
      h += '<div class="rc-actions">';
      if (r.status === "pending_confirm") {
        if (isL2) {
          h += '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="remind">等待二级确认</button>';
        } else {
          if (ctx.canBoss) h += '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm">确认到账</button>';
          else h += '<button class="v3-btn v3-btn--ghost v3-btn--sm is-disabled">待管理员确认（D5）</button>';
        }
      }
      if (r.status === "disputed" && !isL2 && ctx.canBoss) {
        h += '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="confirm">线下核实后确认</button>';
      }
      if (r.status !== "confirmed" && (!isL2)) {
        h += '<button class="v3-btn v3-btn--danger v3-btn--sm" data-act="dispute">提异议</button>';
      }
      if (ctx.canBoss && r.status !== "confirmed") {
        h += '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="redflush">红冲</button>';
      }
      h += "</div>";
    }
    h += "</div>";
    return h;
  }
  function methodName(m) { return { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" }[m] || "线下"; }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var layer = b.closest(".rc-layer").getAttribute("data-layer");
      var act = b.getAttribute("data-act");
      if (act === "add-reg") registerSheet(ctx, layer);
      else if (act === "confirm") {
        var rid = b.closest("[data-rid]").getAttribute("data-rid");
        confirmSheet(ctx, layer, rid);
      } else if (act === "dispute") {
        disputeSheet(ctx, layer, b.closest("[data-rid]").getAttribute("data-rid"));
      } else if (act === "redflush") {
        redFlushSheet(ctx, layer, b.closest("[data-rid]").getAttribute("data-rid"));
      } else if (act === "balance") {
        balanceSheet(ctx, layer);
      } else if (act === "remind") {
        ui.toast("已发送提醒（Mock）· 仅提醒，不自动到账", "ok");
      }
    });
  }

  /* ---- 登记线下付款（凭证强制） ---- */
  var pendingVouchers = [];
  function registerSheet(ctx, layer) {
    var ui = ctx.ui;
    if (ctx.readonly) { ui.toast("账号暂停中，不可登记", "err"); return; }
    pendingVouchers = [];
    var ov = ui.openSheet({
      title: "登记线下付款 · 第" + (layer === "1" ? "一" : "二") + "层",
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
          V3.store.act("pay/addReg", { layer: layer, calcId: L.calc[0].id, amount: amt, method: method, date: date, vouchers: pendingVouchers });
          ui.toast("已登记，等待确认", "ok"); V3.router.render();
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
      return '<div class="rc-voucherline">' + (window.V3.ui.icon(v.kind === "image" ? "camera" : "file", 16)) +
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
        '<div class="rc-voucherline">' + ui.icon("shield", 16) + "<span>确认方式：双方确认记录（电子签正式接入为 P1）</span></div>",
      footer: [
        { t: "确认到账（确认记录）", kind: "v3-btn--primary", onClick: function () {
          V3.store.act("pay/confirm", { layer: layer, id: rid, signMethod: "record" }); ui.toast("已确认", "ok"); V3.router.render();
        } },
        { t: "确认并电子签", kind: "v3-btn--navy", onClick: function () {
          esignMock(ctx, function () { V3.ui.closeAll(); V3.store.act("pay/confirm", { layer: layer, id: rid, signMethod: "esign" }); ui.toast("电子签完成（Mock，正式 P1）", "ok"); V3.router.render(); });
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
  function disputeSheet(ctx, layer, rid) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "提出异议",
      body: '<div class="v3-field"><label>异议说明（必填）</label><textarea class="v3-textarea" id="d-reason" placeholder="如：金额不符 / 未收到该笔 / 凭证不清晰"></textarea>' +
        '<div class="v3-hint">第一层 T+5 工作日内提出并闭环线下核实；可补传凭证。</div></div>' +
        '<label class="v3-upload" id="d-up"><span class="ic">' + ui.icon("camera", 22) + "</span>补充凭证（可选）<input type='file' id='d-file' accept='image/*,application/pdf' multiple style='display:none'/></label><div class="v3-mt8" id='d-vlist' ></div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交异议", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#d-reason").value.trim();
          if (!reason) { ui.toast("请填写异议说明", "err"); return false; }
          V3.store.act("pay/dispute", { layer: layer, id: rid, reason: reason, vouchers: disVouchers });
          disVouchers = []; ui.toast("已提异议，平账锁定", "ok"); V3.router.render();
        } }
      ],
      onMount: function (wrap) {
        disVouchers = [];
        wrap.querySelector("#d-file").addEventListener("change", function (ev) {
          Promise.all(Array.prototype.slice.call(ev.target.files || []).map(ui.fileToVoucher)).then(function (vs) {
            disVouchers = disVouchers.concat(vs);
            wrap.querySelector("#d-vlist").innerHTML = disVouchers.map(function (v) { return '<div class="rc-voucherline">' + ui.icon(v.kind === "image" ? "camera" : "file", 16) + "<span>" + ui.esc(v.name) + "</span></div>"; }).join("");
          });
        });
      }
    });
  }
  var disVouchers = [];

  /* ---- 红冲 ---- */
  function redFlushSheet(ctx, layer, rid) {
    ctx.ui.openModal({
      title: "确认红冲该笔登记？", icon: "warn", danger: true,
      body: "红冲将追加一笔等额<b>负数记录</b>冲销，不删除原凭证；红冲后差异会相应变化。", okText: "确认红冲",
      onOk: function () { V3.store.act("pay/void", { layer: layer, id: rid, reason: "登记有误，红冲更正" }); ctx.ui.toast("已红冲（留痕）", "ok"); V3.router.render(); }
    });
  }

  /* ---- 平账 ---- */
  function balanceSheet(ctx, layer) {
    var ui = ctx.ui;
    ui.openModal({
      title: "月度平账留痕", icon: "check",
      body: "测算应付与线下实付登记<b>差异为 ¥0</b> 且全部凭证已确认。平账后本月对账单封存留痕，后续更正只能红冲。",
      okText: "确认平账", onOk: function () {
        var L = layerData(ctx.d, layer);
        V3.store.act("stmt/balance", { layer: layer, id: L.stmts[0].id });
        ui.toast("已平账留痕", "ok"); V3.router.render();
      }
    });
  }

  window.V3PAGES.reconcile = { title: "对账留痕", render: render, mount: mount };
})();
