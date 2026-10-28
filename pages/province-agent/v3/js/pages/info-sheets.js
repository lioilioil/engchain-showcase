/* info-sheets.js · 两端工作台「说明/信息弹窗」统一模块
   省代：identityBoss/identityStaff/cert/perm/tax/rules
   二级：identity/agree/auth/info/tax
   说明类条目一律垂直居中（openCenter）；身份/企业信息用自下而上（openSheet），与"设置"解耦。
   数据全部来自 store 种子；纯只读，无任何操作入口。 */
(function () {
  "use strict";
  var P = window.V3PAGES = window.V3PAGES || {};
  var SP = window.V3SUBPAGES = window.V3SUBPAGES || {};

  /* ================= 省代：身份/企业信息（自下而上） ================= */
  function identityBoss(ctx) {
    var ui = ctx.ui, p = ctx.d.profile;
    ui.openSheet({
      title: "企业信息",
      body: '<div class="v3-me-card"><div class="v3-me-card__hd">' +
        '<span class="v3-avatar v3-avatar--lg v3-avatar--boss">' + ui.icon("crown", 26) + "</span>" +
        '<div class="v3-me-card__info"><div class="v3-me-card__name">' + ui.esc(p.name) + "</div>" +
        '<div class="v3-me-card__sub">省级总代 · ' + ui.esc(p.contact) + "</div>" +
        '<span class="v3-badge ' + ui.ACCT_BADGE[p.status] + '">' + ui.ACCT[p.status] + "</span></div></div>" +
        '<div class="v3-kv"><span class="k">授权编号</span><span class="v num">' + ui.esc(p.authNo) + "</span></div>" +
        '<div class="v3-kv"><span class="k">统一社会信用代码</span><span class="v num">' + ui.esc(p.uscc) + "</span></div>" +
        '<div class="v3-kv"><span class="k">法定代表人</span><span class="v">' + ui.esc(p.legalPerson) + "</span></div>" +
        '<div class="v3-kv"><span class="k">合作自</span><span class="v">' + ui.esc(p.since) + "</span></div>" +
        '<div class="v3-kv"><span class="k">地址</span><span class="v">' + ui.esc(p.address) + "</span></div></div>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  function identityStaff(ctx) {
    var ui = ctx.ui, d = ctx.d, p = d.profile;
    var me = (d.team || []).filter(function (m) { return m.name === ctx.s.roleStaffName; })[0] ||
      { title: "渠道专员", name: ctx.s.roleStaffName };
    ui.openSheet({
      title: "我的信息",
      body: '<div class="v3-me-card"><div class="v3-me-card__hd">' +
        '<span class="v3-avatar v3-avatar--lg v3-avatar--staff"><span class="v3-avatar__txt">' + ui.esc(me.name.slice(0, 1)) + "</span></span>" +
        '<div class="v3-me-card__info"><div class="v3-me-card__name">' + ui.esc(me.name) +
        '<span class="v3-badge v3-badge--active v3-ml6">员工</span></div>' +
        '<div class="v3-me-card__sub">' + ui.esc(me.title || "渠道专员") + "</div></div></div>" +
        '<div class="v3-kv"><span class="k">所属企业</span><span class="v">' + ui.esc(p.name) + "</span></div>" +
        '<div class="v3-kv"><span class="k">合作状态</span><span class="v">' + ui.ACCT[p.status] + "</span></div>" +
        '<div class="v3-kv"><span class="k">授权编号</span><span class="v num">' + ui.esc(p.authNo) + "</span></div>" +
        '<div class="v3-kv"><span class="k">员工权限</span><span class="v">仅本人渠道码与线索</span></div></div>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  /* ================= 省代：资质证书 ================= */
  function certSheet(ctx) {
    var ui = ctx.ui, p = ctx.d.profile;
    ui.openCenter({
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

  /* ================= 省代：角色与权限说明 ================= */
  function permSheet(ctx) {
    var ui = ctx.ui;
    var isStaff = ctx.s.role === "staff";
    ui.openCenter({
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

  /* ================= 省代：结算口径 ================= */
  function rulesSheet(ctx) {
    var ui = ctx.ui;
    ui.openCenter({
      title: "结算口径",
      body: '<div class="v3-legal-body"><p>1. 省代总盘 = 平台合格消费 × 50%；二级约定比例 0–50%，逐二级配置。</p>' +
        "<p>2. 第一层 T+5 工作日异议；第二层出账后 15 天仅提醒，不自动确认。</p>" +
        "<p>3. 无钱包、无自动提现；线下对公转账 + 双方确认留痕。</p>" +
        "<p>4. 退货、退款、取消订单不计入合格消费。</p></div>",
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  /* ================= 税务说明（两端共用，isSub 差异保留） ================= */
  function taxSheet(ctx) {
    var ui = ctx.ui, isSub = ctx.isSub;
    ui.openCenter({
      title: "税务说明",
      body: '<div class="v3-info-card"><div class="v3-info-card__title">' + ui.icon("receipt", 16) + "<span>税费与发票</span></div>" +
        '<div class="v3-info-card__body"><div class="v3-legal-body"><p>1. 各合作主体依法各自承担税费，平台与省代不代扣代缴经营所得税。</p>' +
        '<p>2. 月度对账单仅作为结算对账依据，发票按实际结算金额另行开具。</p>' +
        '<p>3. 本页仅展示约定所得，<b>不构成可提现余额</b>；实际款项以 App 外公对公转账及双方确认记录为准。</p>' +
        '<p>4. 退货、退款、取消订单不计入合格消费口径。</p>' +
        (isSub ? '<p>5. 二级合作企业向省代开具发票的类型与时点，以双方协议约定为准。</p>' :
          '<p>5. 省代对平台开具发票的规则，以平台合作协议约定为准。</p>') +
        "</div></div></div>" +
        '<div class="v3-readnote v3-mt8">' + ui.icon("shield", 13) +
        "<span>正式发票与税务规则以平台财务中心上线后公示为准。</span></div>",
      footer: [{ t: "关闭", kind: "v3-btn--primary" }]
    });
  }

  /* ================= 二级：合作信息（自下而上） ================= */
  function identitySub(ctx) {
    var ui = ctx.ui, d = ctx.d, p = d.profile, par = d.parent;
    ui.openSheet({
      title: "企业信息",
      body: '<div class="v3-me-card"><div class="v3-me-card__hd">' +
        '<span class="v3-avatar v3-avatar--lg v3-avatar--sub">' + ui.icon("building", 26) + "</span>" +
        '<div class="v3-me-card__info"><div class="v3-me-card__name">' + ui.esc(p.name) + "</div>" +
        '<div class="v3-me-card__sub">二级合作企业 · ' + ui.esc(p.contact) + "</div>" +
        '<span class="v3-badge ' + ui.ACCT_BADGE[p.status] + '">' + ui.ACCT[p.status] + "</span></div></div>" +
        '<div class="v3-kv"><span class="k">合作编号</span><span class="v num">' + ui.esc(p.authNo) + "</span></div>" +
        '<div class="v3-kv"><span class="k">统一社会信用代码</span><span class="v num">' + ui.esc(p.uscc) + "</span></div>" +
        '<div class="v3-kv"><span class="k">负责人</span><span class="v">' + ui.esc(p.contact) + " " + ui.esc(p.phone) + "</span></div>" +
        '<div class="v3-kv"><span class="k">上级总代</span><span class="v">' + ui.esc(par.name) + "</span></div>" +
        '<div class="v3-kv"><span class="k">约定比例</span><span class="v">' + Math.round(par.ratioToSub * 100) + "%（只读）</span></div>" +
        '<div class="v3-kv"><span class="k">合作起始</span><span class="v">' + ui.esc(par.since) + "</span></div></div>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  /* ================= 二级：合作协议（只读居中） ================= */
  function agreeSheet(ctx) {
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
    ui.openCenter({
      title: "合作协议 · " + (c.id || ""),
      body: body,
      footer: [{ t: "关闭", kind: "v3-btn--primary" }]
    });
  }

  /* ================= 二级：授权范围 ================= */
  function authSheet(ctx) {
    var ui = ctx.ui;
    ui.openCenter({
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

  /* ================= 二级：合作信息（居中） ================= */
  function infoSheet(ctx) {
    var ui = ctx.ui, d = ctx.d;
    ui.openCenter({
      title: "合作信息",
      body: '<div class="v3-ag-period">' +
        '<div class="v3-ag-period__row"><span>上级总代</span><span>' + ui.esc(d.parent.name) + "</span></div>" +
        '<div class="v3-ag-period__row"><span>合作起始</span><span>' + ui.esc(d.parent.since) + "</span></div>" +
        '<div class="v3-ag-period__row"><span>约定比例</span><span>' + Math.round(d.parent.ratioToSub * 100) + "%（只读）</span></div>" +
        '<div class="v3-ag-period__row"><span>发展下级</span><span>永久禁止</span></div></div>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  P.infoSheets = {
    identityBoss: identityBoss, identityStaff: identityStaff,
    cert: certSheet, perm: permSheet, tax: taxSheet, rules: rulesSheet
  };
  SP.infoSheets = {
    identity: identitySub, agree: agreeSheet, auth: authSheet, info: infoSheet, tax: taxSheet
  };
})();
