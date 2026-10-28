/* sub-page-me.js · 二级 我的 / 设置（注册 me 与 settings；去钱包/提现/假团队） */
(function () {
  "use strict";
  var SP = window.V3SUBPAGES = window.V3SUBPAGES || {};

  function render(ctx) {
    var ui = ctx.ui, d = ctx.d, p = d.profile, par = d.parent;
    var h = '<div class="v3-page-head"><div class="v3-page-title">我的 · 设置</div></div>';

    /* 企业卡 */
    h += '<div class="v3-me-card"><div class="v3-me-card__hd">' +
      '<span class="v3-avatar v3-avatar--lg v3-avatar--sub">' + ui.icon("building", 26) + "</span>" +
      '<div class="v3-me-card__info"><div class="v3-me-card__name">' + ui.esc(p.name) + "</div>" +
      '<div class="v3-me-card__sub">二级合作企业 · ' + ui.esc(p.contact) + "</div>" +
      '<span class="v3-badge ' + ui.ACCT_BADGE[p.status] + '">' + ui.ACCT[p.status] + "</span></div></div>" +
      '<div class="v3-kv"><span class="k">合作编号</span><span class="v num">' + ui.esc(p.authNo) + "</span></div>" +
      '<div class="v3-kv"><span class="k">统一社会信用代码</span><span class="v num">' + ui.esc(p.uscc) + "</span></div>" +
      '<div class="v3-kv"><span class="k">负责人</span><span class="v">' + ui.esc(p.contact) + " " + ui.esc(p.phone) + "</span></div>" +
      '<div class="v3-kv"><span class="k">上级总代</span><span class="v">' + ui.esc(par.name) + "</span></div>" +
      '<div class="v3-kv"><span class="k">约定比例</span><span class="v">' + Math.round(par.ratioToSub * 100) + "%（只读）</span></div>" +
      '<div class="v3-kv"><span class="k">合作起始</span><span class="v">' + ui.esc(par.since) + "</span></div></div>";

    /* 合作与账务 */
    h += '<div class="v3-sec-title">合作与账务</div><div class="v3-card v3-card--pad v3-list">' +
      menuRow(ui, "file-text", "合作协议", "agree") +
      menuRow(ui, "shield", "授权范围", "auth") +
      menuRow(ui, "building", "合作信息", "info") +
      menuRow(ui, "bank", "收款确认", "go", "#/payments") +
      menuRow(ui, "receipt", "月度对账单", "go", "#/statement") +
      menuRow(ui, "receipt", "经营台账（只读）", "go", "#/ledger") +
      menuRow(ui, "bell", "消息中心", "go", "#/messages") +
      menuRow(ui, "file-text", "税务说明", "go", "#/tax") +
      "</div>";

    h += '<div class="v3-card v3-card--pad v3-list">' +
      menuRow(ui, "info", "关于工作台", "about") +
      "</div>";

    return h;
  }

  function menuRow(ui, icon, label, act, go) {
    var attr = go ? 'data-go="' + go + '"' : 'data-act="' + act + '"';
    return '<button class="v3-row" ' + attr + '>' +
      '<span class="v3-row__main">' + ui.icon(icon, 17) + "<span>" + label + "</span></span>" +
      ui.icon("chev", 14) + "</button>";
  }

  function agreementView(ctx) {
    var ui = ctx.ui, c = ctx.d.agreement || {};
    var pv = c.province || {}, sv = c.sub || {};
    var body = '<div class="v3-ag-doc">' +
      '<div class="v3-ag-section"><div class="v3-ag-section__title">协议双方</div>' +
      '<div class="v3-ag-party"><span class="v3-ag-party__role">甲方（省级总代）</span><span class="v3-ag-party__name">' + ui.esc(pv.name) + "</span>" +
      '<div class="v3-ag-period"><div class="v3-ag-period__row"><span>USCC</span><span class="num">' + ui.esc(pv.uscc || "—") + "</span></div>" +
      '<div class="v3-ag-period__row"><span>法定代表人</span><span>' + ui.esc(pv.legalPerson || "—") + "</span></div></div></div>" +
      '<div class="v3-ag-party v3-mt8"><span class="v3-ag-party__role">乙方（二级企业）</span><span class="v3-ag-party__name">' + ui.esc(sv.name) + "</span>" +
      '<div class="v3-ag-period"><div class="v3-ag-period__row"><span>USCC</span><span class="num">' + ui.esc(sv.uscc || "—") + "</span></div>" +
      '<div class="v3-ag-period__row"><span>负责人</span><span>' + ui.esc(sv.contact || "—") + "</span></div></div></div></div>" +
      '<div class="v3-ag-section"><div class="v3-ag-section__title">协议条款</div><div class="v3-ag-clauses">' +
      (c.terms || []).map(function (cl) {
        return '<div class="v3-ag-clause"><div class="v3-ag-clause__title">' + cl.no + " · " + cl.t + "</div>" +
          '<div class="v3-ag-clause__body">' + cl.c + "</div></div>";
      }).join("") + "</div></div>" +
      '<div class="v3-ag-footer"><p class="v3-ag-footer__dim">协议经电子签签署后生效。</p></div></div>';
    ui.openSheet({
      title: "合作协议 · " + (c.id || ""),
      body: body,
      footer: [{ t: "关闭", kind: "v3-btn--primary" }]
    });
  }

  function authView(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "授权范围",
      body: '<div class="v3-perm-section"><div class="v3-perm-section__title">' + ui.icon("check-circle", 14) + "<span>可开展</span></div>" +
        '<div class="v3-perm-list"><div class="v3-perm-item">直接邀请终端用户注册</div>' +
        '<div class="v3-perm-item">按约定比例取得经营所得（只读）</div>' +
        '<div class="v3-perm-item">跟进自有渠道线索与转化</div></div></div>' +
        '<div class="v3-perm-section"><div class="v3-perm-section__title v3-perm-section__title--no">' + ui.icon("x-circle", 14) + "<span>禁止</span></div>" +
        '<div class="v3-perm-list"><div class="v3-perm-item">不得发展下级企业（两级封顶）</div>' +
        '<div class="v3-perm-item">不得自行调整费率与约定比例</div>' +
        '<div class="v3-perm-item">不得跨区域开展授权范围外业务</div></div></div>' +
        '<div class="v3-perm-section"><div class="v3-perm-section__title">' + ui.icon("info", 14) + "<span>说明</span></div>" +
        '<p class="v3-legal">规模、范围、费率由省代在平台配置并通过 O4 协议授权，本端只读。</p></div>',
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  function infoView(ctx) {
    var ui = ctx.ui, d = ctx.d;
    ui.openSheet({
      title: "合作信息",
      body: '<div class="v3-ag-period">' +
        '<div class="v3-ag-period__row"><span>上级总代</span><span>' + ui.esc(d.parent.name) + "</span></div>" +
        '<div class="v3-ag-period__row"><span>合作起始</span><span>' + ui.esc(d.parent.since) + "</span></div>" +
        '<div class="v3-ag-period__row"><span>约定比例</span><span>' + Math.round(d.parent.ratioToSub * 100) + "%（只读）</span></div>" +
        '<div class="v3-ag-period__row"><span>发展下级</span><span>永久禁止</span></div></div>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  function mount(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "agree") agreementView(ctx);
      else if (act === "auth") authView(ctx);
      else if (act === "info") infoView(ctx);
      else if (act === "about") {
        ctx.ui.openModal({ icon: "info", title: "关于工作台", body: "二级合作企业工作台，无钱包、无提现，经营所得由省代线下付款并双方确认。", cancel: false, okText: "知道了" });
      }
    });
  }

  var view = {
    title: "我的", render: render, mount: mount,
    subSheets: { agree: agreementView, auth: authView, info: infoView }
  };
  SP.me = view;
  SP.settings = view;
})();
