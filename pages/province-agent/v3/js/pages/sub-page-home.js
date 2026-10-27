/* sub-page-home.js · 二级 工作台 #/home + 经营台账 #/ledger
   真实数据：上级总代/约定比例/协议主体/台账两月；协议强制阅读；FAB 经路由统一管理。 */
(function () {
  "use strict";
  var SP = window.V3SUBPAGES = window.V3SUBPAGES || {};

  /* ---------------- 工作台 ---------------- */
  function renderHome(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var calc = d.calc[0];
    var fin = V3.store.subSettle(calc);
    var fn = V3.store.funnelOf(d.leads);
    var ag = d.agreement || {};
    var todo = V3.store.todoOf(ctx.s);
    var h = "";

    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        '<div><b>合作已暂停 · 仅可查看</b><div class="v3-xs v3-mt2">邀请、收款确认等操作已锁定，台账与协议仍可查阅。</div></div></div>';
    }

    /* 上级总代信息条 */
    h += '<div class="s-infobar" data-go="#/me">' +
      '<div class="s-infobar__row"><span class="s-infobar__label">上级总代</span>' +
      '<span class="s-infobar__value">' + ui.esc(d.parent.name) + "</span></div>" +
      '<div class="s-infobar__row"><span class="s-infobar__label">约定比例</span>' +
      '<span class="s-infobar__value s-infobar__value--gold">' + Math.round(d.parent.ratioToSub * 100) + "%</span></div>" +
      '<div class="s-infobar__row"><span class="s-infobar__label">合作起始</span>' +
      '<span class="s-infobar__value">' + ui.esc(d.parent.since) + "</span></div></div>";

    /* 待办（单源派生） */
    if (todo.items.length) {
      h += '<div class="v3-sec-title v3-mt12">待办</div><div class="v3-stack">';
      todo.items.forEach(function (it) {
        h += '<div class="v3-msg v3-msg--link" data-go="' + it.to + '">' +
          '<span class="v3-msg__ic v3-msg__ic--' + it.type + '">' + ui.icon(it.icon, 16) + "</span>" +
          '<div class="v3-msg__bd"><div class="v3-msg__t">' + ui.esc(it.t) + "</div>" +
          '<div class="v3-msg__d">' + ui.esc(it.s) + "</div></div>" +
          '<span class="v3-msg__go">' + ui.icon("chev", 14) + "</span></div>";
      });
      h += "</div>";
    }

    /* 业绩概览（首屏主角，无时间 tabs） */
    h += '<section class="sub-finance"><div class="v3-xs">' + calc.month + " 本人经营所得（测算）</div>" +
      '<div class="big num v3-mt2">' + ui.moneyD(fin.agreed) + "</div>" +
      '<div class="rows">' +
      '<div class="v3-dline"><span class="k">合格消费</span><span class="v num">' + ui.money(fin.eligible) + "</span></div>" +
      '<div class="v3-dline"><span class="k">总盘（合格消费 × 50%）</span><span class="v num">' + ui.money(fin.gross) + "</span></div>" +
      '<div class="v3-dline"><span class="k">约定所得比例</span><span class="v num">' + Math.round(fin.ratioToSub * 100) + "%</span></div>" +
      '<div class="v3-dline"><span class="k">T+7 在途冻结</span><span class="v num">' + ui.money(fin.frozen) + "</span></div>" +
      "</div>" +
      '<div class="v3-fin__note">模拟测算，不构成可提现金额；以省代线下付款与双方确认记录为准。</div></section>';

    /* 协议 */
    var agState = ag.state === "signed" ? "已签署" : ag.state === "rejected" ? "已拒签" : "待我签署";
    var agBadge = ag.state === "signed" ? '<span class="v3-badge v3-badge--active">已签署 ' + ui.esc(ag.signedAt || "") + "</span>"
      : ag.state === "rejected" ? '<span class="v3-badge v3-badge--revoked">已拒签</span>'
      : '<span class="v3-badge v3-badge--pending">待我签署</span>';
    h += '<section class="s-l2 v3-mt12 s-agree"><div class="s-panel-hd"><span class="t">合作协议</span>' + agBadge + "</div>" +
      '<div class="s-prow"><span class="k">协议编号</span><span class="v num">' + ui.esc(ag.id || "") + "</span></div>" +
      '<div class="s-prow"><span class="k">版本</span><span class="v">' + ui.esc(ag.version || "") + "</span></div>" +
      '<div class="s-prow"><span class="k">状态</span><span class="v">' + agState + "</span></div>";
    if (ag.state === "pending_mine" && !ctx.readonly) {
      h += '<div class="s-actions s-actions--2"><button class="v3-btn v3-btn--ghost v3-btn--sm v3-btn--danger" data-act="agree-reject">拒签</button>' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="agree-view">阅读并签署</button></div>';
    } else {
      h += '<div class="s-actions"><button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="agree-view">查看协议</button></div>';
      if (ag.state === "rejected") {
        h += '<div class="v3-alert v3-alert--warn v3-mt9">' + ui.icon("warn", 13) +
          "<span>拒签原因：" + ui.esc(ag.rejectReason || "—") + "；省代修订后可重新发起协议。</span></div>";
      }
    }
    h += "</section>";

    /* 邀请速览 */
    h += '<section class="s-l2 v3-mt12"><div class="v3-sm v3-strong v3-mb10">邀请获客速览</div>' +
      '<div class="s-tris">' +
      tri("直接邀请", fn.registered) + tri("已入驻", fn.onboarded) + tri("已消费", fn.paid) + "</div>" +
      '<div class="s-prow s-prow--div"><span class="k">邀请已产生合格消费</span>' +
      '<span class="v num v3-goldtext">' + ui.moneyD(fn.paidAmount) + "</span></div></section>";

    /* 收款入口（有红点时突出） */
    var payTodo = todo.payments || 0;
    h += '<section class="s-l2 v3-mt12"><button class="v3-sub-row v3-sub-row--plain" data-go="#/payments">' +
      '<span class="v3-avatar v3-avatar--sub">' + ui.icon("bank", 19) + "</span>" +
      '<span class="v3-row__main"><span class="v3-row__t">收款确认</span>' +
      '<span class="v3-row__s">核对省代线下付款与凭证' + (payTodo ? "（" + payTodo + " 笔待确认）" : "") + "</span></span>" +
      (payTodo ? '<span class="v3-badge v3-badge--pending">' + payTodo + "</span>" : "") +
      ui.icon("chev", 16) + "</button>" +
      '<button class="v3-sub-row v3-sub-row--plain" data-go="#/statement"><span class="v3-avatar v3-avatar--sub">' +
      ui.icon("receipt", 19) + "</span><span class=\"v3-row__main\"><span class=\"v3-row__t\">月度对账单</span>" +
      '<span class="v3-row__s">只读查看测算、登记与差异</span></span>' + ui.icon("chev", 16) + "</button></section>";

    return h;
  }
  function tri(k, n) { return '<div class="cell"><div class="num">' + n + '</div><div class="k">' + k + "</div></div>"; }

  /* ---------------- 协议 ---------------- */
  function agreeSheet(ctx, signable) {
    var ui = ctx.ui, c = ctx.d.agreement || {};
    var pv = c.province || {}, sv = c.sub || {};
    var read = false;
    function partyHtml(role, name, p) {
      return '<div class="v3-ag-party"><span class="v3-ag-party__role">' + role + "</span>" +
        '<span class="v3-ag-party__name">' + ui.esc(name) + "</span>" +
        '<div class="v3-ag-party__detail"><div><span>统一社会信用代码</span><span class="num">' + ui.esc(p.uscc || "—") + "</span></div>" +
        '<div><span>法定代表人</span><span>' + ui.esc(p.legalPerson || "—") + "</span></div>" +
        '<div><span>联系人</span><span>' + ui.esc(p.contact || "—") + " " + ui.esc(p.phone || "") + "</span></div>" +
        '<div><span>注册地址</span><span>' + ui.esc(p.address || "—") + "</span></div></div></div>";
    }
    var header = '<div class="v3-ag-doc-header"><h3 class="v3-ag-doc-header__title">二级合作协议</h3>' +
      '<div class="v3-ag-doc-header__sub">O4 模板 · 版本 ' + ui.esc(c.version || "") + " · 编号 " + ui.esc(c.id || "") + "</div></div>";
    var period = '<div class="v3-ag-section"><div class="v3-ag-section__title">合作期限</div><div class="v3-ag-period">' +
      '<div class="v3-ag-period__row"><span>发起日期</span><span>' + ui.esc(c.sentAt || "") + "</span></div>" +
      '<div class="v3-ag-period__row"><span>到期日期</span><span>' + ui.esc(c.expireAt || "") + "</span></div>" +
      '<div class="v3-ag-period__row"><span>合作期限</span><span>一年，到期前 30 日按规则续签</span></div></div></div>';
    var clauses = '<div class="v3-ag-section"><div class="v3-ag-section__title">协议条款</div><div class="v3-ag-clauses">' +
      (c.terms || []).map(function (cl) {
        return '<div class="v3-ag-clause"><div class="v3-ag-clause__title">' + cl.no + " · " + cl.t + "</div>" +
          '<div class="v3-ag-clause__body">' + cl.c + "</div></div>";
      }).join("") + "</div></div>";
    var footer = '<div class="v3-ag-footer"><p class="v3-ag-footer__dim">演示协议文本，正式协议以平台电子签服务签署版本为准。</p></div>';

    var footerBtns = [];
    if (signable && c.state === "pending_mine" && !ctx.readonly) {
      footerBtns.push({ t: "拒签", kind: "v3-btn--danger", onClick: function () { ui.closeAll(); rejectSheet(ctx); return false; } });
      footerBtns.push({
        t: "我已阅读并签署", kind: "v3-btn--primary",
        onClick: function (wrap) {
          if (!read) { ui.toast("请先勾选并阅读全部条款", "err"); return false; }
          var r = ctx.V3.store.act("agree/sign", { confirmed: true });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("协议已签署（演示）", "ok");
          ctx.V3.router.render();
        }
      });
    } else {
      footerBtns.push({ t: "关闭", kind: "v3-btn--primary" });
    }

    ui.openSheet({
      title: "O4 合作协议",
      body: '<div class="v3-ag-doc">' + header +
        '<div class="v3-ag-section"><div class="v3-ag-section__title">协议双方</div><div class="v3-ag-parties">' +
        partyHtml("甲方（省级总代）", pv.name, pv) + partyHtml("乙方（二级企业）", sv.name, sv) + "</div></div>" +
        period + clauses + footer + "</div>" +
        (signable && c.state === "pending_mine" ? '<label class="v3-ag-read"><input type="checkbox" id="ag-read"> 我已完整阅读并知悉全部条款，确认信息无误</label>' : ""),
      footer: footerBtns,
      onMount: function (wrap) {
        var cb = wrap.querySelector("#ag-read");
        if (cb) cb.addEventListener("change", function () { read = cb.checked; });
      }
    });
  }

  function rejectSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "拒签 O4 协议",
      body: '<div class="v3-field"><label>拒签原因（必填）</label>' +
        '<textarea class="v3-textarea" id="ar-reason" placeholder="请说明原因，省代可据此修订后重新发起"></textarea></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "确认拒签", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#ar-reason").value.trim();
          if (!reason) { ui.toast("请填写拒签原因", "err"); return false; }
          var r = ctx.V3.store.act("agree/reject", { reason: reason });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已提交拒签", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function authSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "授权范围说明",
      body:
        '<div class="v3-perm-hero"><div class="v3-perm-hero-icon">' + ui.icon("shield", 28) + "</div>" +
        '<div class="v3-perm-hero-info"><div class="v3-perm-hero-name">二级企业授权</div>' +
        '<div class="v3-perm-hero-desc">由省级总代直接授权，在约定范围内开展业务</div></div></div>' +
        '<div class="v3-perm-section"><div class="v3-perm-section__title">' + ui.icon("check-circle", 14) + "<span>可开展业务</span></div>" +
        '<div class="v3-perm-list"><div class="v3-perm-item">直接邀请终端用户注册</div>' +
        '<div class="v3-perm-item">按约定比例取得经营所得（只读测算）</div>' +
        '<div class="v3-perm-item">跟进自有渠道线索与转化</div></div></div>' +
        '<div class="v3-perm-section"><div class="v3-perm-section__title v3-perm-section__title--no">' + ui.icon("x-circle", 14) + "<span>禁止事项</span></div>" +
        '<div class="v3-perm-list"><div class="v3-perm-item">不得发展下级企业（两级封顶）</div>' +
        '<div class="v3-perm-item">不得自行调整费率与约定比例</div>' +
        '<div class="v3-perm-item">不得跨区域开展授权范围外业务</div></div></div>',
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  function certSheet(ctx) {
    var ui = ctx.ui, d = ctx.d;
    ui.openSheet({
      title: "合作信息",
      body:
        '<div class="v3-perm-hero"><div class="v3-perm-hero-icon">' + ui.icon("building", 28) + "</div>" +
        '<div class="v3-perm-hero-info"><div class="v3-perm-hero-name">' + ui.esc(d.profile.name) + "</div>" +
        '<div class="v3-perm-hero-desc">合作编号：' + ui.esc(d.profile.authNo) + "</div></div></div>" +
        '<div class="v3-perm-section"><div class="v3-perm-section__title">' + ui.icon("info", 14) + "<span>合作基本信息</span></div>" +
        '<div class="v3-ag-period">' +
        '<div class="v3-ag-period__row"><span>上级总代</span><span>' + ui.esc(d.parent.name) + "</span></div>" +
        '<div class="v3-ag-period__row"><span>合作起始</span><span>' + ui.esc(d.parent.since) + "</span></div>" +
        '<div class="v3-ag-period__row"><span>约定比例</span><span>' + Math.round(d.parent.ratioToSub * 100) + "%（只读）</span></div>" +
        '<div class="v3-ag-period__row"><span>发展下级</span><span>永久禁止</span></div></div></div>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  /* ---------------- 经营台账 ---------------- */
  function renderLedger(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, d = ctx.d;
    var h = '<div class="sub-note v3-mb12">' + ui.icon("receipt", 15) +
      "<span>经营台账为只读口径复算：<b>总盘 50%</b>、本人约定所得按省代授权比例、<b>T+7 冻结</b>；仅展示已有月度数据。</span></div>";

    /* 仅真实两月趋势 */
    var months = d.calc.slice().reverse();
    var vals = months.map(function (c) { return V3.store.subSettle(c).agreed; });
    var maxV = Math.max.apply(null, vals.concat([1]));
    h += '<div class="v3-trend-card"><div class="v3-trend-title">月度经营所得（演示数据）</div><div class="v3-trend-chart">';
    vals.forEach(function (v, i) {
      var height = Math.round(v / maxV * 100);
      h += '<div class="v3-trend-col"><div class="v3-trend-bar' + (i === vals.length - 1 ? " v3-trend-bar--active" : "") +
        '" style="height:' + Math.max(height, 6) + '%"></div><div class="v3-trend-label">' + months[i].month + "</div></div>";
    });
    h += "</div></div>";

    var rows = d.calc.map(function (c) {
      var f = V3.store.subSettle(c);
      return "<tr><td>" + c.month + "</td><td class='num'>" + ui.money(f.eligible) + "</td><td class='num'>" + ui.money(f.gross) +
        "</td><td class='num'>" + Math.round(f.ratioToSub * 100) + "%</td><td class='num'>" + ui.money(f.agreed) + "</td></tr>";
    }).join("");
    h += '<div class="v3-table-wrap"><table class="v3-table"><thead><tr><th>月份</th><th>合格消费</th><th>总盘50%</th><th>比例</th><th>本人所得</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";

    h += '<div class="v3-info-card v3-mt12"><div class="v3-info-card__title">' + ui.icon("filter", 15) + "<span>计入 / 排除口径</span></div>" +
      '<div class="v3-info-card__body">计入：<b>订单净额 / 积分解锁付费 / 增值服务付费</b><br>' +
      "排除：<b>充值 / 免费积分 / 报名费 / 退款冲回</b><br>" +
      "退款：冻结期内剔除、当月红字冲减、跨月等额回冲（两线不交叉）。</div></div>";
    return h;
  }

  function mountHome(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "agree-view") {
        var ag = ctx.d.agreement;
        agreeSheet(ctx, ag.state === "pending_mine");
      } else if (act === "agree-reject") {
        rejectSheet(ctx);
      } else if (act === "auth") {
        authSheet(ctx);
      } else if (act === "cert") {
        certSheet(ctx);
      }
    });
  }

  SP.home = {
    title: "工作台",
    render: renderHome,
    mount: mountHome,
    fab: function (ctx) {
      ctx.fab([{ icon: "invite", label: "邀请获客", onClick: function (c) { c.go("#/invite"); } }]);
    }
  };
  SP.ledger = { title: "经营台账", render: renderLedger, mount: function () {} };
})();
