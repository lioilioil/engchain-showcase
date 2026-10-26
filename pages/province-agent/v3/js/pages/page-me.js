/* page-me.js · 身份详情 #/profile（原「我的」取消后注册为 V3PAGES.profile；同时别名保留 V3PAGES.me）
   【S3-E1-INDEX】身份信息 + 授权证书 + 权限徽章弹层 + 团队/徽章/规则入口 + 二级企业视角入口；
   原型演示身份内容收进底部「演示说明」折叠，不裸露 dev 文案 */
(function () {
  function render(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    var roleLabel = ctx.role === "staff" ? "员工" : "老板 / 管理员";
    var h = "";

    /* 身份信息（L1 深色色带，与工作台身份卡同语系） */
    h += '<section class="s-idcard s-idcard--center">' +
      '<span class="ic-status ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<span class="ic-eyebrow"><span class="tag">授权</span>省级总代</span>' +
      '<div class="ic-avatar"><span>' + ui.esc(d.profile.agentName.slice(0, 1)) + "</span></div>" +
      '<h2 class="ic-name">' + ui.esc(d.profile.agentName) + "</h2>" +
      '<p class="ic-desc">授权编号 <b>' + ui.esc(d.profile.authNo) + "</b> · 有效期至 <b>" + ui.esc(d.profile.validTill) + "</b></p>" +
      '<button type="button" class="ic-role" data-me-act="perm">' +
        '<span class="rb">' + ui.esc(roleLabel) + "</span><span class=\"rk\">权限说明</span>" + ui.icon("chev", 14) + "</button>" +
      "</section>";

    /* 授权与资料（L3 通栏行） */
    h += '<div class="s-sec-title">授权与资料</div>';
    h += '<section class="v3-sub-list">' +
      meRow("shield", "授权证书", d.profile.province + " · 省级总代", "cert") +
      meRow("chart", "团队管理", "成员与权限", "team") +
      meRow("crown", "授权徽章", "五档徽章样例", "badge") +
      meRow("doc", "运营规则", "O4 协议与招募口径", "rules") +
      meRow("receipt", "税务指引", "个人/企业分表", "tax") +
      "</section>";

    /* 视角与设置 */
    h += '<div class="s-sec-title">视角与设置</div>';
    h += '<section class="v3-sub-list">' +
      meRow("user", "进入二级企业视角", "二级企业工作台", "goto-sub") +
      meRow("eye", "外观主题", ctx.state.theme === "dark" ? "深色模式" : "浅色模式", "theme") +
      "</section>";

    /* 财务口径：折叠摘要（渐进披露） */
    h += '<details class="v3-note-fold v3-mt14"><summary>' + ui.icon("receipt", 15) +
      '<span class="sum">财务口径（锁定 · 只读）</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">总盘 = 合格消费 × <b>50%</b>；自身线 = 自身合格消费 × <b>10%</b>（独立不相加）<br/>' +
      "约定给二级比例区间 <b>0–50%</b>（平台配置 + 协议）；在途冻结 <b>T+7</b><br/>" +
      "合格：订单净额 / 积分付费 / 增值付费；排除：充值 / 免费积分 / 报名费 / 退款冲回<br/>" +
      "名额 <b>" + d.profile.used + " / " + d.profile.cap + "</b>。</div></details>";

    /* 退出登录 */
    h += '<button class="v3-btn v3-btn--block v3-btn--ghost v3-mt16" data-me-act="logout">退出登录</button>';

    /* 演示说明（原型能力收进折叠：角色切换验证权限差异，不裸露在主流程） */
    h += '<details class="v3-note-fold v3-mt12"><summary>' + ui.icon("shield", 15) +
      '<span class="sum">演示说明（原型）</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body"><div class="v3-xs v3-muted v3-mb8">切换角色验证权限边界（不影响正式数据）：</div>' +
      '<div class="v3-radio" id="role-sel">' +
      roleOpt("boss", "老板 / 管理员", ctx.role === "boss") + roleOpt("staff", "员工", ctx.role === "staff") + "</div>" +
      '<div class="v3-xs v3-muted v3-mt9" >员工可发码 / 跟进 / 登记传凭证；不可签协议、改比例、确认平账、查看自留、全量导出，仅看本人名下线索。</div></div></details>';

    h += '<div class="trust">润锦工程链 Engchain 3.0 · 数据以平台正式签发为准</div>';
    return h;
  }

  function roleOpt(v, label, on) {
    return '<label class="' + (on ? "on" : "") + '"><input type="radio" name="role" value="' + v + '" ' + (on ? "checked" : "") + '><span>' + label + "</span></label>";
  }
  function meRow(ic, t, s, act) {
    return '<button class="v3-sub-row v3-nav-item" data-me-act="' + act + '"><span class="v3-nav-ic">' + window.V3.ui.icon(ic, 20) + "</span>" +
      '<span class="v3-row__main"><span class="v3-row__t">' + t + "</span>" +
      '<span class="v3-row__s">' + s + "</span></span>" +
      window.V3.ui.icon("chev", 16) + "</button>";
  }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui;
    var roleSel = el.querySelector("#role-sel");
    if (roleSel) roleSel.addEventListener("click", function (e) {
      var lb = e.target.closest("label"); if (!lb) return;
      var v = lb.querySelector("input").value;
      V3.store.act("role/set", { role: v });
      ui.toast(v === "boss" ? "已切换为老板视角" : "已切换为员工视角", "ok");
      V3.router.render();
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-me-act]"); if (!b) return;
      var act = b.getAttribute("data-me-act");
      if (act === "theme") {
        V3.store.act("theme/set", { theme: ctx.state.theme === "dark" ? "light" : "dark" });
        V3.router.render();
      } else if (act === "goto-sub") { location.href = "sub.html#/home"; }
      else if (act === "cert") certModal(ctx);
      else if (act === "perm") permSheet(ctx);
      else if (act === "team") { location.href = "team.html"; }
      else if (act === "badge") { location.href = "badge.html"; }
      else if (act === "rules") { location.href = "rules.html"; }
      else if (act === "tax") { location.href = "tax-guide.html"; }
      else if (act === "logout") {
        ui.openModal({ title: "退出登录", icon: "warn", body: "原型演示：退出登录为演示动作，不会真实清除会话。", okText: "知道了", cancel: false });
      }
    });
  }

  /* 授权证书（复用原 modal 内容，去原型 Mock 字样） */
  function certModal(ctx) {
    var d = ctx.d;
    ctx.ui.openSheet({
      title: "授权证书",
      body: '<div class="v3-hero v3-mb12" ><div class="eyebrow"><span class="tag" style="color:#E3C88E">授权</span>证书</div>' +
        '<div class="prov"><div class="name" style="font-size:20px">' + ctx.ui.esc(d.profile.agentName) + "</div></div>" +
        '<div class="meta"><div>授权编号<b>' + ctx.ui.esc(d.profile.authNo) + "</b></div>" +
        "<div>有效期至<b>" + ctx.ui.esc(d.profile.validTill) + "</b></div></div></div>" +
        '<div class="kv-mini">授权区域：<b>' + ctx.ui.esc(d.profile.province) + "</b><br/>" +
        "授权类型：<b>省级总代</b>，可在平台配置与 O4 协议范围内直接邀请终端用户、招募二级企业（两级封顶）。</div>" +
        '<p class="v3-legal v3-mt10" >证书信息以平台正式签发为准。</p>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  /* 权限说明弹层 */
  function permSheet(ctx) {
    var isStaff = ctx.role === "staff";
    ctx.ui.openSheet({
      title: "权限说明 · " + (isStaff ? "员工" : "老板 / 管理员"),
      body: isStaff
        ? '<div class="dl">' +
          kv("可操作", "生成邀请码、跟进线索、登记线下付款并上传凭证") +
          kv("不可操作", "确认到账 / 月度平账、配置二级比例、签署协议、查看自留收益、全量导出") +
          kv("可见范围", "仅本人名下线索") + "</div>"
        : '<div class="dl">' +
          kv("可操作", "邀请获客、发起二级合作与初审、登记付款、确认到账、月度平账留痕") +
          kv("收益可见", "总盘 / 自身线 / 自留收益全量可见") +
          kv("配置范围", "二级比例在平台配置 + O4 协议范围内设定") + "</div>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }
  function kv(k, v) { return '<span class="k">' + k + '</span><span class="v">' + v + "</span>"; }

  window.V3PAGES.profile = { title: "身份详情", render: render, mount: mount };
  window.V3PAGES.me = window.V3PAGES.profile;   /* 别名：#/me 不再可达，保留兼容 */
})();
