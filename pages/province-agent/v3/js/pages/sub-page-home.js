/* sub-page-home.js · 二级 工作台 #/home + 经营台账 #/ledger */
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

    /* 身份卡（与省代 pa2-hero 统一语系：深色全宽） */
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    h += '<section class="pa2-hero">' +
      '<span class="pa2-hbadge ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<div class="pa2-eyebrow"><span class="tag">合作</span>二级企业</div>' +
      '<h2 class="pa2-hero-title">' + ui.esc(d.profile.name) + "</h2>" +
      '<p class="pa2-hero-desc">上级总代 <b>' + ui.esc(d.profile.parent) + "</b> · 合作编号 <b>" + ui.esc(d.profile.authNo) + "</b></p>" +
      "</section>";

    /* 授权范围（D1 只读）：75 字长段 → 折叠摘要（渐进披露，首屏只留一行） */
    h += '<details class="v3-note-fold v3-note-fold--gold v3-mt12"><summary>' + ui.icon("shield", 15) +
      '<span class="sum">授权范围说明</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">你可<b>直接邀请终端用户</b>并据本人线计经营所得；<b>不能发展下级企业</b>（两级封顶），' +
      "邀请规模 / 范围 / 费率由省代在平台配置 + O4 协议授权，App 内<b>只读</b>、无自助改费率入口。</div></details>";

    /* O4 协议 */
    var ag = d.agreement || {};
    h += '<section class="v3-card v3-mt12" ><div class="v3-card__hd"><span class="t">O4 合作协议</span>' +
      (ag.state === "signed" ? '<span class="v3-badge v3-badge--active">已签署 ' + ui.esc(ag.completedAt || "") + "</span>"
        : ag.state === "rejected" ? '<span class="v3-badge v3-badge--revoked">已拒签</span>'
        : '<span class="v3-badge v3-badge--pending">待我签署</span>') + "</div>" +
      '<div class="v3-kvrow"><div class="cell"><div class="k">协议编号</div><div class="v">' + ui.esc(ag.code || "") + "</div></div>" +
      '<div class="cell"><div class="k">版本</div><div class="v">' + ui.esc(ag.version || "") + "</div></div>" +
      '<div class="cell"><div class="k">状态</div><div class="v">' + (ag.state === "signed" ? "已签署" : "待签署") + "</div></div></div>";
    if (ag.state === "pending_mine" && !ctx.readonly) {
      h += '<div class="v3-flex v3-mt11" style="gap:8px">' +
        '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="agree-view" style="flex:1">查看协议</button>' +
        '<button class="v3-btn v3-btn--danger v3-btn--sm" data-act="agree-reject" style="flex:1">拒签</button>' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="agree-sign" style="flex:1">签署协议</button></div>';
    } else {
      h += '<button class="v3-btn v3-btn--ghost v3-btn--sm v3-mt11" data-act="agree-view" >查看协议条款</button>';
      if (ag.state === "rejected" && ag.rejectReason) h += '<div class="v3-alert v3-alert--warn v3-mt9" >' + ui.esc(ag.rejectReason) + "</div>";
    }
    h += "</section>";

    /* 财务卡（hideRetained：不见总代自留 / 自身线） */
    h += '<section class="sub-finance v3-mt12" ><div class="v3-xs" style="color:var(--v3-on-navy-2)">本月本人经营所得（测算）</div>' +
      '<div class="big num v3-mt2" >' + ui.moneyD(fin.agreed) + '</div>' +
      '<div class="rows">' +
      '<div class="v3-dline"><span class="k">合格消费</span><span class="v num">' + ui.money(fin.eligible) + "</span></div>" +
      '<div class="v3-dline"><span class="k">总盘（合格消费 × 50%）</span><span class="v num">' + ui.money(fin.gross) + "</span></div>" +
      '<div class="v3-dline"><span class="k">约定所得比例</span><span class="v num">' + Math.round(fin.ratioToSub * 100) + "%</span></div>" +
      '<div class="v3-dline"><span class="k">T+7 在途冻结</span><span class="v num">' + ui.money(fin.frozen) + "</span></div>" +
      "</div></section>";

    /* 本人三项 */
    h += '<div class="v3-sec-title">邀请获客</div><div class="v3-tiles v3-pad16" style="background:var(--v3-surface);border:1px solid var(--v3-line);border-radius:var(--v3-r-lg);box-shadow:var(--v3-sh-card)">' +
      tile("invite", "邀请码·海报", "#/invite") + tile("user", "我的邀请用户", "#/invite-users") +
      tile("chart", "转化分佣统计", "#/invite-stats") + tile("receipt", "收款确认", "#/payments") +
      "</div>";

    /* 待办 / 预警 */
    if (d.alerts && d.alerts.length) {
      h += '<div class="v3-stack v3-mt12">';
      d.alerts.forEach(function (a) {
        h += '<button class="v3-alert v3-alert--' + (a.type || "info") + '" style="width:100%;text-align:left" data-go="' + (a.to || "#/payments") + '">' +
          "<span>" + (a.icon || "ℹ") + '</span><div><b>' + ui.esc(a.title) + "</b><div class='v3-xs v3-mt2' >" + ui.esc(a.desc) + "</div></div></button>";
      });
      h += "</div>";
    }

    /* 速览 + 入口 */
    h += '<section class="v3-card v3-mt12" ><div class="v3-tri">' +
      tri("直接邀请", fn.direct) + tri("已入驻", fn.onboarded) + tri("已消费", fn.paid) + "</div>" +
      '<div class="v3-stat-money v3-mt11" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额（D4）</div>' +
      '<div class="amt num v3-mt3" >' + ui.moneyD(fn.paidAmount) + "</div></div></section>";

    h += '<div class="section-head-row"><span class="t">快捷入口</span></div>';
    h += '<section class="v3-sub-list v3-mt2">' +
      srow("收款确认", "#/payments", "确认省代线下到账 · 15 天只提醒") +
      srow("月度对账单", "#/statement", "按月查看测算与留痕") +
      srow("待办提醒", "#/inbox", "待确认 / 临期事项") +
      srow("经营台账", "#/ledger", "合格消费 / 冻结 / 规则口径") +
      "</section>";

    h += '<div class="trust">二级企业视角 · 原型数据均为 Mock</div>';
    return h;
  }
  function tri(k, n) { return '<div class="cell"><div class="num">' + n + '</div><div class="k">' + k + "</div></div>"; }
  function tile(ic, t, go) {
    return '<button class="v3-tile v3-tap" data-go="' + go + '"><span class="ic">' + window.V3.ui.icon(ic, 23) + "</span><span>" + t + "</span></button>";
  }
  function srow(t, go, s) {
    return '<button class="v3-sub-row" data-go="' + go + '"><span class="v3-row__main"><span class="v3-row__t">' + t + "</span>" +
      '<span class="v3-row__s">' + s + "</span></span>" + window.V3.ui.icon("chev", 17) + "</button>";
  }

  function mountHome(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui;
    el.addEventListener("click", function (e) {
      var g = e.target.closest("[data-go]"); if (g) { ctx.go(g.getAttribute("data-go")); return; }
      var b = e.target.closest("[data-act]"); if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "agree-view") agreeSheet(ctx);
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
      body: '<div class="kv-mini v3-mb10" >协议编号 <b>' + ui.esc(c.code) + "</b> · 版本 <b>" + ui.esc(c.version) + "</b></div>" +
        '<div class="v3-timeline">' + (c.clauses || []).map(function (cl, i) {
          return '<div class="v3-tl"><div class="t">' + (i + 1) + ". " + ui.esc(cl) + "</div></div>";
        }).join("") + "</div>" +
        '<p class="v3-legal v3-mt8" >' + ctx.V3.MONEY_NOTE + "；正式协议以平台电子签文本为准。</p>",
      footer: [{ t: "我已阅读", kind: "v3-btn--ghost" }]
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
    /* 计入/排除口径长块 → 折叠 */
    h += '<details class="v3-note-fold v3-mt12"><summary>' + ctx.ui.icon("filter", 15) +
      '<span class="sum">计入 / 排除口径</span><span class="chev">' + ctx.ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">计入：<b>订单净额 / 积分解锁付费 / 增值服务付费</b><br/>' +
      "排除：<b>充值 / 免费积分 / 报名费 / 退款冲回</b><br/>" +
      "退款：冻结期内剔除、当月红字冲减、跨月等额回冲（两线不交叉）。</div></details>";
    return h;
  }

  window.V3SUBPAGES.home = { title: "二级企业 · 工作台", render: renderHome, mount: mountHome };
  window.V3SUBPAGES.ledger = { title: "经营台账", render: renderLedger, mount: function () {} };
})();
