/* sub-page-home.js · 二级 工作台 #/home + 经营台账 #/ledger
   【S3-E2-SUB 深度重构】
   - 身份卡：切换到 .s-idcard 骨架；上级总代 / 合作编号 结构化分行（消灭"·合作编号"换行纠缠）
   - O4 协议：卡内嵌 kv + 按钮组 → L2 面板内通栏行（.s-prow）+ 按钮行（.s-actions）
   - 财务卡：保持深色 L2，主指标唯一突出（本人经营所得），明细 L3 通栏行
   - 邀请速览：L2 面板内 3 格数字 + 付费额通栏行（去 v3-stat-money 嵌套盒）
   - 移除：邀请获客 tiles / 快捷入口列表（壳层 4 大类 + 子导航已承担，避免重复导航）
   - 待办：E4 消息中心统一接管（navbar 右上角「消息」icon），工作台不再行内渲染待办列表
*/
(function () {
  "use strict";

  /* ---------------- 工作台 ---------------- */
  function renderHome(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var fin = V3.store.subSettle(d.financeBase);
    var fn = V3.store.funnelOf(d.leads);
    var h = "";

    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        '<div><b>合作已暂停 · 仅可查看</b><div class="v3-xs v3-mt2" style="color:#B9C4D4">邀请、收款确认等操作已锁定，台账与协议仍可查阅。</div></div></div>';
    }

    /* L1 身份色带（壳层 .s-idcard 骨架；结构化两行：上级总代 / 合作编号） */
    /* S4-G：A6 授权范围说明由常驻金边框 fold 收为身份卡弹层（玻璃规范），正文区不再常驻 */
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    h += '<section class="s-idcard">' +
      '<span class="ic-status ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<div class="ic-eyebrow"><span class="tag">合作</span>二级企业</div>' +
      '<h2 class="ic-name">' + ui.esc(d.profile.name) + "</h2>" +
      '<div class="ic-rows">' +
        '<div class="ic-row"><span class="lab">上级总代</span><span class="val">' + ui.esc(d.profile.parent) + "</span></div>" +
        '<div class="ic-row"><span class="lab">合作编号</span><span class="val">' + ui.esc(d.profile.authNo) + "</span></div>" +
        '<div class="ic-row ic-row--link" data-act="auth"><span class="lab">授权范围</span><span class="val">' + ui.icon("chev", 13) + "</span></div>" +
      "</div></section>";

    /* L2 协议面板：卡内嵌 kv + 按钮组 → 面板内通栏行（L3） */
    var ag = d.agreement || {};
    var agBadge = ag.state === "signed"
      ? '<span class="v3-badge v3-badge--active">已签署 ' + ui.esc(ag.completedAt || "") + "</span>"
      : ag.state === "rejected"
        ? '<span class="v3-badge v3-badge--revoked">已拒签</span>'
        : '<span class="v3-badge v3-badge--pending">待我签署</span>';
    h += '<section class="s-l2 v3-mt12 s-agree">' +
      '<div class="s-panel-hd"><span class="t">O4 合作协议</span>' + agBadge + "</div>" +
      '<div class="s-prow"><span class="k">协议编号</span><span class="v num">' + ui.esc(ag.code || "") + "</span></div>" +
      '<div class="s-prow"><span class="k">版本</span><span class="v">' + ui.esc(ag.version || "") + "</span></div>" +
      '<div class="s-prow"><span class="k">状态</span><span class="v">' + (ag.state === "signed" ? "已签署" : "待签署") + "</span></div>";
    if (ag.state === "pending_mine" && !ctx.readonly) {
      /* T2-D：3 并列按钮 → 1 主（签署）+ 2 次（查看 ghost / 拒签 文字链），一屏唯一主焦点（V4） */
      h += '<div class="s-actions s-actions--main">' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="agree-sign">签署协议</button></div>' +
        '<div class="s-actions s-actions--sub">' +
        '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="agree-view">查看协议</button>' +
        '<button class="v3-btn v3-btn--link t2d-link-danger" data-act="agree-reject">拒签</button></div>';
    } else {
      h += '<div class="s-actions"><button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="agree-view">查看协议条款</button></div>';
      if (ag.state === "rejected" && ag.rejectReason) h += '<div class="v3-alert v3-alert--warn v3-mt9">' + ui.esc(ag.rejectReason) + "</div>";
    }
    h += "</section>";

    /* 财务卡（T2-B 已改白底 L2，主指标唯一突出；明细 L3 通栏行） */
    h += '<section class="sub-finance v3-mt12"><div class="v3-xs t2d-fin-x">本月本人经营所得（测算）</div>' +
      '<div class="big num v3-mt2">' + ui.moneyD(fin.agreed) + '</div>' +
      '<div class="rows">' +
      '<div class="v3-dline"><span class="k">合格消费</span><span class="v num">' + ui.money(fin.eligible) + "</span></div>" +
      '<div class="v3-dline"><span class="k">总盘（合格消费 × 50%）</span><span class="v num">' + ui.money(fin.gross) + "</span></div>" +
      '<div class="v3-dline"><span class="k">约定所得比例</span><span class="v num">' + Math.round(fin.ratioToSub * 100) + "%</span></div>" +
      '<div class="v3-dline"><span class="k">T+7 在途冻结</span><span class="v num">' + ui.money(fin.frozen) + "</span></div>" +
      "</div></section>";

    /* 邀请速览（L2 面板：3 格数字 + 付费额通栏行；原 v3-stat-money 嵌套盒拍平） */
    h += '<section class="s-l2 v3-mt12">' +
      '<div class="v3-sm v3-strong v3-mb10">邀请获客速览</div>' +
      '<div class="s-tris">' +
        tri("直接邀请", fn.direct) + tri("已入驻", fn.onboarded) + tri("已消费", fn.paid) +
      "</div>" +
      '<div class="s-prow s-prow--div"><span class="k">邀请已产生付费金额</span>' +
        '<span class="v num v3-goldtext">' + ui.moneyD(fn.paidAmount) + "</span></div>" +
      "</section>";

    /* 待办提醒：E4 消息中心统一接管（navbar 右上角「消息」icon），工作台不再行内渲染待办列表。
       壳层工作台大类角标数字 = 待办总数（router.js 计算），与消息中心通知数一致。 */

    h += '<div class="trust">二级企业视角 · 原型数据均为 Mock</div>';
    return h;
  }
  function tri(k, n) { return '<div class="cell"><div class="num">' + n + '</div><div class="k">' + k + "</div></div>"; }

  function mountHome(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "agree-view") agreeSheet(ctx);
      else if (act === "auth") authSheet(ctx);
      else if (act === "agree-sign" && !ctx.readonly) {
        V3.store.act("agree/sign", {}); ui.toast("协议已签署", "ok"); V3.router.render();
      } else if (act === "agree-reject" && !ctx.readonly) {
        ui.openSheet({
          title: "拒签 O4 协议",
          body: '<div class="v3-field"><label>拒签原因（必填）</label><textarea class="v3-textarea" id="ar-reason" placeholder="请说明原因，省代可据此调整后重新发起"></textarea></div>',
          footer: [
            { t: "取消", kind: "v3-btn--ghost" },
            { t: "确认拒签", kind: "v3-btn--danger", onClick: function (wrap) {
              var r = wrap.querySelector("#ar-reason").value.trim();
              if (!r) { ui.toast("请填写拒签原因", "err"); return false; }
              V3.store.act("agree/reject", { reason: r }); ui.toast("已提交拒签", "ok"); V3.router.render();
            } }
          ]
        });
      } else if (act === "cert") {
        certSheet(ctx);
      }
    });
  }
  function agreeSheet(ctx) {
    var ui = ctx.ui, c = ctx.d.agreement || {};
    ctx.ui.openSheet({
      title: "O4 合作协议条款",
      body: '<div class="kv-mini v3-mb10">协议编号 <b>' + ui.esc(c.code) + "</b> · 版本 <b>" + ui.esc(c.version) + "</b></div>" +
        '<div class="v3-timeline">' + (c.clauses || []).map(function (cl, i) {
          return '<div class="v3-tl"><div class="t">' + (i + 1) + ". " + ui.esc(cl) + "</div></div>";
        }).join("") + "</div>" +
        '<p class="v3-legal v3-mt8">' + ctx.V3.MONEY_NOTE + "；正式协议以平台电子签文本为准。</p>",
      footer: [{ t: "我已阅读", kind: "v3-btn--ghost" }]
    });
  }
  /* S4-G：A6 授权范围说明收为身份卡弹层（玻璃承载），合规原文不删只改承载 */
  function authSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "授权范围说明",
      body: '<p class="v3-legal">你可<b>直接邀请终端用户</b>并据本人线计经营所得；<b>不能发展下级企业</b>（两级封顶），' +
        "邀请规模 / 范围 / 费率由省代在平台配置 + O4 协议授权，App 内<b>只读</b>、无自助改费率入口。</p>",
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }
  function certSheet(ctx) {
    var d = ctx.d;
    ctx.ui.openSheet({
      title: "合作信息",
      body: '<div class="dl">' +
        '<span class="k">企业名称</span><span class="v">' + ctx.ui.esc(d.profile.name) + "</span>" +
        '<span class="k">上级总代</span><span class="v">' + ctx.ui.esc(d.profile.parent) + "</span>" +
        '<span class="k">合作编号</span><span class="v">' + ctx.ui.esc(d.profile.authNo) + "</span>" +
        '<span class="k">合作起始</span><span class="v">' + ctx.ui.esc(d.profile.since) + "</span>" +
        '<span class="k">约定比例</span><span class="v">' + Math.round(d.profile.ratioToSub * 100) + "%（只读）</span>" +
        '<span class="k">发展下级</span><span class="v">永久禁止</span></div>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  /* ---------------- 经营台账 ---------------- */
  function renderLedger(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var h = '<details class="v3-note-fold v3-mb12"><summary>' + ui.icon("receipt", 15) +
      '<span class="sum">台账口径说明</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">经营台账为只读口径复算：<b>总盘 50%</b>、本人约定所得按省代授权比例、<b>T+7 冻结</b>；不含总代自留 / 自身线。</div></details>';
    var rows = d.calc.map(function (c) {
      var fin = V3.store.subSettle({ eligible: c.month === "2026-10" ? 10000 : 9200, ratioToSub: d.financeBase.ratioToSub });
      return "<tr><td>" + c.month + "</td><td class='num'>" + ui.money(fin.eligible) + "</td><td class='num'>" + ui.money(fin.gross) +
        "</td><td class='num'>" + Math.round(fin.ratioToSub * 100) + "%</td><td class='num'>" + ui.money(c.calcAmount) + "</td></tr>";
    }).join("");
    h += '<div class="v3-table-wrap"><table class="v3-table"><thead><tr><th>月份</th><th>合格消费</th><th>总盘50%</th><th>比例</th><th>本人所得</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";
    h += '<details class="v3-note-fold v3-mt12"><summary>' + ctx.ui.icon("filter", 15) +
      '<span class="sum">计入 / 排除口径</span><span class="chev">' + ctx.ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">计入：<b>订单净额 / 积分解锁付费 / 增值服务付费</b><br/>' +
      "排除：<b>充值 / 免费积分 / 报名费 / 退款冲回</b><br/>" +
      "退款：冻结期内剔除、当月红字冲减、跨月等额回冲（两线不交叉）。</div></details>";
    return h;
  }

  window.V3SUBPAGES.home = { title: "二级企业 · 工作台", render: renderHome, mount: mountHome };
  window.V3SUBPAGES.ledger = { title: "经营台账", render: renderLedger, mount: function () {} };

  /* S4-G：grab 手柄拖拽关闭（§二.2.3）。遮罩点击关闭由 ui.js 既有逻辑提供；
     ui.js 禁改，故以文档级指针委托实现拖拽跟随 + 阈值松手关闭（>100px）。 */
  (function () {
    var sheet = null, startY = 0, curY = 0, dragging = false;
    document.addEventListener("pointerdown", function (e) {
      var h = e.target && e.target.closest ? e.target.closest(".v3-sheet__handle") : null;
      if (!h) return;
      sheet = h.closest(".v3-sheet");
      if (!sheet) return;
      startY = e.clientY; curY = 0; dragging = true;
      sheet.style.transition = "none";
      try { sheet.setPointerCapture(e.pointerId); } catch (_) {}
    }, { passive: true });
    document.addEventListener("pointermove", function (e) {
      if (!dragging || !sheet) return;
      curY = Math.max(0, e.clientY - startY);
      sheet.style.transform = "translateY(" + curY + "px)";
    }, { passive: true });
    function endDrag() {
      if (!dragging || !sheet) return;
      dragging = false;
      sheet.style.transition = "";
      if (curY > 100) { var ov = sheet.closest(".v3-overlay"); if (ov) ov.classList.remove("show"); }
      else sheet.style.transform = "";
      sheet = null; curY = 0;
    }
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  })();
})();
