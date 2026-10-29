/* ============================================================
   uni-todo-ops.js · 待办操作闭环（共享模块，版本 A1）
   工作台首页（uni-home）与消息中心（uni-messages）共用：
   每个待办 = 对应功能页中的一个操作分支，弹窗内载入该分支的
   完整明细与操作区，绝大多数操作直接在弹窗内完成。
   右上角放大 icon = 切换至对应功能页（完整操作界面）。
   依赖：window.V3.ui；Uni（uni-shared）由调用方注入。
   ============================================================ */
(function () {
  "use strict";
  var ui = window.V3.ui;

  var TODO_META = {
    "l1-disputed":   { title: "与平台对账有异议待处理", go: "reconcile.html", focus: "1", ops: "verify-l1" },
    "l1-pending":    { title: "平台对账有付款待确认",   go: "reconcile.html", focus: "1", ops: "confirm-l1" },
    "l2-disputed":   { title: "二级提出收款异议",       go: "reconcile.html", focus: "2", ops: "verify-l2" },
    "l2-pending":    { title: "二级收款待确认",         go: "reconcile.html", focus: "2", ops: "remind-l2" },
    "sub-pending":   { title: "有二级合作申请待审批",   go: "subs.html",      focus: "", ops: "review" },
    "pay-pending":   { title: "有省代付款待你确认",     go: "reconcile-sub.html", focus: "cur", ops: "confirm-sub" },
    "pay-disputed":  { title: "有异议的付款待核实",     go: "reconcile-sub.html", focus: "cur", ops: "verify-sub" },
    "agree-sign":    { title: "O4 合作协议待签署",       go: "agreement.html", focus: "", ops: "sign" },
    "agree-rejected": { title: "合作协议已拒签",         go: "agreement.html", focus: "", ops: "view" }
  };
  var PAY_METHOD = { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" };
  function payMethod(m) { return PAY_METHOD[m] || m || "—"; }

  /* 数据查找（选中行 → 明细对象） */
  function findRec(s, id) {
    var pool = [];
    (s.payRegs1 || []).forEach(function (x) { pool.push(x); });
    (s.payRegs2 || []).forEach(function (x) { pool.push(x); });
    (s.payRegs || []).forEach(function (x) { pool.push(x); });
    for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i];
    return null;
  }
  function findApp(s, id) {
    var apps = s.subApps || [];
    for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i];
    return null;
  }

  /* 注册/异议明细行（全部展示，可选中：点击切换高亮，操作按钮统一在底部固定区） */
  function regOpRows(rows) {
    return (rows || []).map(function (r) {
      var note = (r.notes || r.reason) ? '<div class="uh-todo-note">' + ui.esc(r.notes || r.reason) + '</div>' : "";
      return '<div class="uh-todo-row uh-todo-row--sel" data-sel-row="' + ui.esc(r.id) + '" data-sel-layer="' + ui.esc(r.layer || "") + '">' +
        '<span class="uh-todo-radio" aria-hidden="true"></span>' +
        '<div class="mn"><span class="amt">' + ui.money(r.amount) + "</span>" +
        '<span class="mt">' + ui.esc(payMethod(r.method)) + " · " + ui.esc(r.date) + "</span>" + note + '</div></div>';
    }).join("");
  }

  /* 待办分支完整明细（全部从 ctx.s 现算，不写死数值） */
  function todoDetailHtml(key, ctx, ops) {
    var s = ctx.s, html = "";
    var want = key.indexOf("disputed") > -1 ? "disputed" : "pending_confirm";
    if (key === "l1-disputed" || key === "l1-pending" || key === "l2-disputed" || key === "l2-pending") {
      var layer = key.indexOf("l2") === 0 ? "c1-l2" : "c1-l1";
      var regs = (layer === "c1-l1" ? s.payRegs1 : s.payRegs2) || [];
      var rows = regs.filter(function (r) { return r.calcId === layer && r.status === want; })
        .map(function (r) { r.layer = layer === "c1-l1" ? "1" : "2"; return r; });
      html = '<div class="uh-sechead">' + (key.indexOf("disputed") > -1 ? "异议明细" : "待确认明细") + " · " + rows.length + " 笔</div>" +
        (rows.length ? regOpRows(rows) : '<div class="uh-dim">暂无明细，可前往对账中心查看完整账单</div>');
    } else if (key === "sub-pending") {
      var apps = (s.subApps || []).filter(function (a) { return a.status === "pending"; });
      html = '<div class="uh-sechead">待审批申请 · ' + apps.length + " 家</div>" +
        (apps.length ? apps.map(function (a) {
          return '<div class="uh-todo-row uh-todo-row--sel" data-sel-row="' + ui.esc(a.id) + '">' +
            '<span class="uh-todo-radio" aria-hidden="true"></span>' +
            '<div class="mn"><span class="amt">' + ui.esc(a.name) + '</span>' +
            '<span class="mt">申请比例 ' + Math.round(a.ratio * 100) + "% · " + ui.esc(a.submittedAt || a.createdAt || "") + '</span></div></div>';
        }).join("") : '<div class="uh-dim">暂无待审批申请</div>');
    } else if (key === "pay-pending" || key === "pay-disputed") {
      var rows2 = (s.payRegs || []).filter(function (r) { return r.status === want; })
        .map(function (r) { r.layer = "2"; return r; });
      html = '<div class="uh-sechead">' + (key.indexOf("disputed") > -1 ? "异议付款" : "待确认付款") + " · " + rows2.length + " 笔</div>" +
        (rows2.length ? regOpRows(rows2) : '<div class="uh-dim">暂无明细，可前往收款确认页查看</div>');
    } else if (key === "agree-sign") {
      var ag = s.agreement;
      if (ag) {
        html = '<div class="uh-sheetkv"><span class="k">甲方</span><span class="v">' + ui.esc(ag.province.name) + '</span></div>' +
          '<div class="uh-sheetkv"><span class="k">乙方</span><span class="v">' + ui.esc(ag.sub.name) + '</span></div>' +
          '<div class="uh-sheetkv"><span class="k">合作期限</span><span class="v">' + ui.esc(ag.sentAt) + " 起 · 一年" + '</span></div>' +
          '<div class="uh-sechead">协议要点</div>' +
          (ag.terms || []).map(function (t) {
            return '<div class="uh-clause"><div class="no">' + ui.esc(t.no + " · " + t.t) + '</div><div class="c">' + ui.esc(t.c) + '</div></div>';
          }).join("");
      }
    } else if (key === "agree-rejected") {
      var ag2 = s.agreement;
      if (ag2) {
        html = '<div class="uh-sheetkv"><span class="k">协议编号</span><span class="v">' + ui.esc(ag2.id) + '</span></div>' +
          '<div class="uh-sheetkv"><span class="k">合作方</span><span class="v">' + ui.esc(ag2.province.name) + '</span></div>' +
          '<div class="uh-sechead">拒签原因</div>' +
          '<div class="uh-dim">' + ui.esc(ag2.rejectReason || "省代未填写原因，可联系对方重新发起") + '</div>' +
          '<div class="uh-readnote" style="margin-top:10px">' + ui.icon("info", 15) +
          '<span>协议需由省代修订后重新发起，二级企业暂无可执行操作。</span></div>';
      }
    }
    return html || '<div class="uh-dim">暂无详细内容</div>';
  }

  /* ---------- 待办行内操作：确认到账（记录 / 电子签留痕） ---------- */
  function todoConfirmSheet(rec, layer, mode, Uni, todoSh) {
    var ft = [
      { t: "取消", kind: "ghost" },
      { t: "确认到账（记录）", kind: "ghost", onClick: function (sh) {
          var r = Uni.actGuarded("pay/confirm", { layer: layer, id: rec.id, signMethod: "record" });
          if (r.ok) { Uni.toast("已确认到账", "ok"); sh.close(); if (todoSh) todoSh.close(); }
      } }
    ];
    if (mode === "sub") {
      ft.push({ t: "电子签留痕", kind: "primary", onClick: function (sh) { sh.close(); todoEsignCenter(rec, Uni, todoSh); } });
    } else {
      ft.push({ t: "电子签留痕", kind: "primary", onClick: function (sh) {
          var r = Uni.actGuarded("pay/confirm", { layer: layer, id: rec.id, signMethod: "esign" });
          if (r.ok) { Uni.toast("已确认到账（电子签留痕）", "ok"); sh.close(); if (todoSh) todoSh.close(); }
      } });
    }
    Uni.sheet({
      title: "核对付款",
      body: '<div class="uh-sheetkv"><span class="k">付款登记</span><span class="v">' + ui.money(rec.amount) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">付款方式</span><span class="v">' + ui.esc(payMethod(rec.method)) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">付款日期</span><span class="v">' + ui.esc(rec.date) + '</span></div>' +
        '<div style="height:8px"></div><div class="uh-note">确认即代表已核对到账金额与凭证一致。</div>',
      footer: ft
    });
  }

  /* 二级电子签留痕（居中二次确认） */
  function todoEsignCenter(rec, Uni, todoSh) {
    Uni.center({
      title: "电子签署留痕",
      body: '<div style="font-size:var(--fs-base);color:var(--text-1);line-height:1.6">签署金额 ' + ui.money(rec.amount) +
        "。<br>我已知悉并确认该笔款项已到账，电子签署后不可撤销。</div>",
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认签署", kind: "primary", onClick: function (ov) {
          var r = Uni.actGuarded("pay/confirm", { layer: "2", id: rec.id, signMethod: "esign" });
          if (r.ok) { Uni.toast("已确认到账（电子签留痕）", "ok"); if (todoSh) todoSh.close(); }
      } }]
    });
  }

  /* ---------- 待办行内操作：线下核实后确认（异议分支） ---------- */
  function todoVerifySheet(rec, layer, mode, Uni, todoSh) {
    var sub = mode === "sub";
    Uni.sheet({
      title: "线下核实后确认",
      body: (rec.notes || rec.reason ? '<div class="uh-readnote" style="margin-bottom:12px">原异议记录：' + ui.esc(rec.notes || rec.reason) + "</div>" : "") +
        '<div class="field"><label class="field-label">核实说明（必填）</label>' +
        '<textarea class="textarea" id="ut-v-note" placeholder="例如：线下已收到差额款项，双方核对一致"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认到账", kind: "primary", onClick: function (ov) {
          var v = ov.querySelector("#ut-v-note").value.trim();
          if (!v) { Uni.toast("异议记录须填写线下核实说明后再确认"); return false; }
          var r = Uni.actGuarded("pay/confirm", { layer: layer, id: rec.id, verifiedNote: v });
          if (r.ok) { Uni.toast(sub ? "已确认，等待省代平账" : "已确认到账", "ok"); ov.close(); if (todoSh) todoSh.close(); }
      } }]
    });
  }

  /* ---------- 待办行内操作：审批通过 / 驳回（原因输入） ---------- */
  function reviewRejectSheet(app, Uni) {
    var sh = Uni.sheet({
      title: "驳回合作申请",
      body:
        '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(app.name) + '</span></div>' +
        '<div style="height:10px"></div>' +
        '<div class="field"><label class="field-label">驳回原因（必填）</label>' +
        '<textarea class="textarea" id="ut-rej" placeholder="说明驳回原因，留痕在申请档案中"></textarea></div>' +
        '<div class="uls-quick">' +
        ["资质不符", "经营范围不符", "信息填写有误"].map(function (qk) {
          return '<button class="btn btn-ghost btn-sm" data-quick="' + ui.esc(qk) + '">' + qk + '</button>';
        }).join("") + '</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认驳回", kind: "danger", onClick: function (ov) {
          var v = ov.querySelector("#ut-rej").value.trim();
          if (!v) { Uni.toast("请填写驳回原因"); return false; }
          var r = Uni.actGuarded("app/review", { id: app.id, pass: false, reason: v });
          if (r.ok) { Uni.toast("已驳回该申请", "ok"); ov.close(); }
      } }]
    });
    Array.prototype.forEach.call(sh.querySelectorAll("[data-quick]"), function (b) {
      b.addEventListener("click", function () { sh.querySelector("#ut-rej").value = b.getAttribute("data-quick"); });
    });
  }

  /* ---------- 协议签署 / 查看 sheet（二级） ---------- */
  function agreementSheet(ctx, mode, Uni) {
    var ag = ctx.s.agreement;
    var terms = (ag.terms || []).map(function (t) {
      return '<div class="uh-clause"><div class="no">' + ui.esc(t.no + " · " + t.t) + '</div><div class="c">' + ui.esc(t.c) + '</div></div>';
    }).join("");
    var foot;
    if (mode === "sign") {
      foot = [
        { t: "取消", kind: "ghost" },
        { t: "同意并签署", kind: "primary", onClick: function (ov) {
            var ok = ov.querySelector("#uni-agree-ck");
            if (!ok || !ok.checked) { Uni.toast("请先完整阅读并勾选确认"); return false; }
            var r = Uni.actGuarded("agree/sign", { confirmed: true });
            if (r.ok) Uni.toast("已完成签署", "ok");
            return r.ok;
        } }
      ];
    } else {
      foot = [{ t: "关闭", kind: "primary" }];
    }
    Uni.sheet({
      title: "合作协议 " + ag.id,
      body: '<div class="uh-sheetkv"><span class="k">甲方</span><span class="v">' + ui.esc(ag.province.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">乙方</span><span class="v">' + ui.esc(ag.sub.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">合作期限</span><span class="v">' + ui.esc(ag.sentAt) + " 起 · 一年" + '</span></div>' +
        '<div style="height:12px"></div>' + terms +
        (mode === "sign" ? '<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);color:var(--text-2);margin-top:6px;min-height:32px">' +
          '<input type="checkbox" id="uni-agree-ck"> 我已完整阅读并知悉全部条款</label>' : ""),
      footer: foot
    });
  }

  /* ---------- 待办操作弹窗（bottom sheet）：完整明细 + 底部固定操作区 + 右上角放大/关闭 ---------- */
  function open(ctx, item, Uni) {
    var m = TODO_META[item.key];
    if (!m) return;
    var goUrl = m.go + (m.focus ? ("?focus=" + m.focus) : "");
    var ops = m.ops || "";
    var mode = ctx.mode === "sub" ? "sub" : "prov";
    var sel = { id: null, layer: "1" };
    var foot = [];
    if (ops === "sign") {
      foot.push({ t: "取消", kind: "ghost" });
      foot.push({ t: "立即签署", kind: "primary", onClick: function (sh) { sh.close(); agreementSheet(ctx, "sign", Uni); } });
    } else if (ops === "remind-l2") {
      foot.push({ t: "提醒二级确认", kind: "primary", onClick: function (sh) {
          var r = Uni.actGuarded("msg/add", { msg: { icon: "bell", type: "info", title: "已提醒二级企业确认收款", to: "reconcile.html" } });
          if (r.ok) { Uni.toast("已提醒二级确认收款", "ok"); sh.close(); }
      } });
    } else if (ops === "view") {
      foot.push({ t: "查看协议", kind: "primary", onClick: function (sh) { sh.close(); Uni.navTo(goUrl); } });
    } else if (ops === "confirm-l1" || ops === "confirm-sub") {
      /* 底部固定：确认到账（作用于选中明细行） */
      foot.push({ t: "确认到账", kind: "primary", onClick: function (sh) {
          var rec = findRec(ctx.s, sel.id);
          if (!rec) { Uni.toast("请选择待确认明细"); return; }
          todoConfirmSheet(rec, sel.layer, mode, Uni, sh);
      } });
    } else if (ops === "verify-l1" || ops === "verify-sub") {
      /* 底部固定：线下核实确认（作用于选中异议行） */
      foot.push({ t: "线下核实确认", kind: "primary", onClick: function (sh) {
          var rec = findRec(ctx.s, sel.id);
          if (!rec) { Uni.toast("请选择异议明细"); return; }
          todoVerifySheet(rec, sel.layer, mode, Uni, sh);
      } });
    } else if (ops === "review") {
      /* 底部固定：通过 / 驳回（作用于选中审批企业） */
      foot.push({ t: "驳回", kind: "danger", onClick: function (sh) {
          var app = findApp(ctx.s, sel.id);
          if (!app) { Uni.toast("请选择待审批企业"); return; }
          sh.close();
          reviewRejectSheet(app, Uni);
      } });
      foot.push({ t: "通过", kind: "primary", onClick: function (sh) {
          var app = findApp(ctx.s, sel.id);
          if (!app) { Uni.toast("请选择待审批企业"); return; }
          var r = Uni.actGuarded("app/review", { id: app.id, pass: true });
          if (r.ok) { Uni.toast("已通过，合作协议已生成", "ok"); sh.close(); }
      } });
    }
    /* 其余类型无底部操作（仅右上角关闭 / 放大） */

    var sh = Uni.sheet({
      title: m.title,
      body: '<div class="uh-readnote" style="margin:0 0 10px">' + ui.icon("info", 15) + '<span>' + ui.esc(item.s || "") + '</span></div>' +
        todoDetailHtml(item.key, ctx, ops),
      footer: foot,
      expand: { onClick: function () { Uni.navTo(goUrl); } }
    });

    /* 选中管理：默认选中 item.id 对应的明细行（逐笔待办定位），否则第一行；点击切换高亮，底部操作作用于选中行 */
    var rows = sh.querySelectorAll("[data-sel-row]");
    if (rows.length) {
      var setSel = function (el) {
        for (var i = 0; i < rows.length; i++) rows[i].classList.remove("on");
        el.classList.add("on");
        sel.id = el.getAttribute("data-sel-row");
        sel.layer = el.getAttribute("data-sel-layer") || "1";
      };
      var target = null;
      if (item.id) {
        for (var r = 0; r < rows.length; r++) {
          if (rows[r].getAttribute("data-sel-row") === item.id) { target = rows[r]; break; }
        }
      }
      setSel(target || rows[0]);
      for (var i = 0; i < rows.length; i++) {
        rows[i].addEventListener("click", function () { setSel(this); });
      }
    }
  }

  window.UniTodoOps = {
    TODO_META: TODO_META,
    open: open,
    agreement: agreementSheet
  };
})();
