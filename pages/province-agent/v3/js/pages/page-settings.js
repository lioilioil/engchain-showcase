/* page-settings.js · 省代「我的 / 设置」（注册 me 与 settings；全 v3，不跳 legacy） */
(function () {
  "use strict";
  var P = window.V3PAGES = window.V3PAGES || {};

  function render(ctx) {
    var ui = ctx.ui, d = ctx.d, p = d.profile;
    var h = '<div class="v3-page-head"><div class="v3-page-title">我的 · 设置</div></div>';

    /* 企业卡 */
    h += '<div class="v3-me-card"><div class="v3-me-card__hd">' +
      '<span class="v3-avatar v3-avatar--lg v3-avatar--boss">' + ui.icon("crown", 26) + "</span>" +
      '<div class="v3-me-card__info"><div class="v3-me-card__name">' + ui.esc(p.name) + "</div>" +
      '<div class="v3-me-card__sub">省级总代 · ' + ui.esc(p.contact) + "</div>" +
      '<span class="v3-badge ' + ui.ACCT_BADGE[p.status] + '">' + ui.ACCT[p.status] + "</span></div></div>" +
      '<div class="v3-kv"><span class="k">授权编号</span><span class="v num">' + ui.esc(p.authNo) + "</span></div>" +
      '<div class="v3-kv"><span class="k">统一社会信用代码</span><span class="v num">' + ui.esc(p.uscc) + "</span></div>" +
      '<div class="v3-kv"><span class="k">法定代表人</span><span class="v">' + ui.esc(p.legalPerson) + "</span></div>" +
      '<div class="v3-kv"><span class="k">合作自</span><span class="v">' + ui.esc(p.since) + "</span></div>" +
      '<div class="v3-kv"><span class="k">地址</span><span class="v">' + ui.esc(p.address) + "</span></div></div>";

    /* 演示控制 */
    h += '<div class="v3-sec-title">偏好设置</div>';
    h += '<div class="v3-card v3-card--pad">' +
      '<div class="v3-setrow"><span class="v3-setrow__t">' + ui.icon("users", 16) + "<span>身份视角</span></span>" +
      '<div class="v3-seg v3-seg--mini">' +
      '<button class="' + (ctx.s.role === "boss" ? "on" : "") + '" data-role="boss">老板</button>' +
      '<button class="' + (ctx.s.role === "staff" ? "on" : "") + '" data-role="staff">员工</button></div></div>' +
      '<div class="v3-setrow"><span class="v3-setrow__t">' + ui.icon("eye", 16) + "<span>主题外观</span></span>" +
      '<div class="v3-seg v3-seg--mini">' +
      '<button class="' + (ctx.s.theme === "light" ? "on" : "") + '" data-theme="light">浅色</button>' +
      '<button class="' + (ctx.s.theme === "dark" ? "on" : "") + '" data-theme="dark">深色</button></div></div></div>';

    /* 菜单 */
    h += '<div class="v3-sec-title">企业与规则</div><div class="v3-card v3-card--pad v3-list">' +
      menuRow(ui, "badge", "资质证书", "cert") +
      menuRow(ui, "shield", "角色与权限说明", "perm") +
      menuRow(ui, "users", "团队成员", "team", true) +
      menuRow(ui, "crown", "分佣与约定比例", "share", true) +
      menuRow(ui, "receipt", "税务说明", "tax", true) +
      menuRow(ui, "bank", "结算口径", "rules") +
      "</div>";

    h += '<div class="v3-card v3-card--pad v3-list">' +
      menuRow(ui, "info", "关于工作台", "about") +
      "</div>";

    return h;
  }
  function menuRow(ui, icon, label, act, go) {
    return '<button class="v3-row" data-' + (go ? 'go="#/' + (act === "team" ? "team" : act === "share" ? "share-config" : "tax") + '"' : 'act="' + act + '"') + '>' +
      '<span class="v3-row__main">' + ui.icon(icon, 17) + "<span>" + label + "</span></span>" +
      ui.icon("chev", 14) + "</button>";
  }

  function certSheet(ctx) {
    var ui = ctx.ui, p = ctx.d.profile;
    ui.openSheet({
      title: "资质证书",
      body: '<div class="v3-cert-paper">' +
        '<div class="v3-cert-paper__tt">省级总代授权书</div>' +
        '<div class="v3-cert-paper__bd">' +
        '<p>兹授权 <b>' + ui.esc(p.name) + "</b>（统一社会信用代码 " + ui.esc(p.uscc) + "）</p>" +
        "<p>作为工程服务合作平台省级总代，在授权区域内开展合作业务。</p>" +
        '<p>授权编号：<b class="num">' + ui.esc(p.authNo) + "</b></p>" +
        '<p>合作自 ' + ui.esc(p.since) + " 起。</p>" +
        '<p class="v3-cert-paper__tip">授权书以平台盖章签发版本为准。</p>' +
        "</div></div>",
      footer: [{ t: "关闭", kind: "v3-btn--primary" }]
    });
  }

  function permSheet(ctx) {
    var ui = ctx.ui;
    var isStaff = ctx.s.role === "staff";
    ui.openSheet({
      title: "角色与权限说明",
      body:
      '<div class="v3-perm-hero"><div class="v3-perm-hero-icon">' + ui.icon(isStaff ? "user" : "shield", 26) + "</div>" +
        '<div class="v3-perm-hero__t">当前视角：' + (isStaff ? "员工（" + ctx.s.roleStaffName + "）" : "老板（法定代表人）") + "</div></div>" +
      '<div class="v3-perm-group"><div class="v3-perm-group__t">' + ui.icon("check-circle", 14) + (isStaff ? "<span>员工可操作</span>" : "<span>老板可操作</span>") + "</div>" +
        (isStaff
          ? "<p>· 生成与作废本人渠道码（CH-E）</p><p>· 本人渠道线索的跟进与阶段更新</p><p>· 查看经营数据与对账信息</p>"
          : "<p>· 全部经营数据、合作审批与比例配置</p><p>· 招商码/渠道码生成与作废</p><p>· 付款登记、确认、异议与月度平账</p><p>· 协议发起与团队管理</p>") +
      "</div>" +
      '<div class="v3-perm-group"><div class="v3-perm-group__t v3-perm-group__t--no">' + ui.icon("x-circle", 14) +
        (isStaff ? "<span>员工不可操作</span>" : "<span>需留意</span>") + "</div>" +
        (isStaff
          ? "<p>· 二级合作审批、发起与驳回</p><p>· 付款登记、冲销、平账与协议签署</p><p>· 他人渠道码与线索</p>"
          : "<p>· 所有操作均按角色留痕，暂停态全部锁定（仅可查看）</p>") +
      "</div>",
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  function rulesSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "结算口径",
      body: '<div class="v3-legal-body"><p>1. 省代总盘 = 平台合格消费 × 50%；二级约定比例 0–50%，逐二级配置。</p>' +
      "<p>2. 第一层 T+5 工作日异议；第二层出账后 15 天仅提醒，不自动确认。</p>" +
      "<p>3. 无钱包、无自动提现；线下对公转账 + 双方确认留痕。</p>" +
      "<p>4. 退货、退款、取消订单不计入合格消费。</p></div>",
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  function mount(el, ctx) {
    el.addEventListener("click", function (e) {
      /* 仅匹配按钮本身：html 元素上也带 data-theme，closest 会误中祖先导致全页点击被吞 */
      var role = e.target.closest && e.target.closest("button[data-role]");
      if (role) {
        ctx.V3.store.act("role/set", { role: role.getAttribute("data-role") });
        ctx.V3.router.render();
        return;
      }
      var th = e.target.closest && e.target.closest("button[data-theme]");
      if (th) {
        var theme = th.getAttribute("data-theme");
        ctx.V3.store.act("theme/set", { theme: theme });
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem("engchain-theme", theme); } catch (err) {}
        ctx.V3.router.render();
        return;
      }
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "cert") certSheet(ctx);
      else if (act === "perm") permSheet(ctx);
      else if (act === "rules") rulesSheet(ctx);
      else if (act === "about") {
        ctx.ui.openModal({ icon: "info", title: "关于工作台", body: "省级总代与二级合作双视角工作台，提供经营数据查看、月度对账与电子签留痕。", cancel: false, okText: "知道了" });
      }
    });
  }

  var view = {
    title: "我的", render: render, mount: mount,
    subSheets: { cert: certSheet, perm: permSheet, rules: rulesSheet }
  };
  P.me = view;
  P.settings = view;
})();
