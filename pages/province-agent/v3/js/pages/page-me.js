/* page-me.js · 我的 #/me（P0 轻量：身份 / 角色切换 / 主题 / 授权 / 跳转二级视角） */
(function () {
  function render(ctx) {
    var ui = ctx.ui, d = ctx.d, st = ctx.state;
    var h = "";

    /* 身份 Hero（与省代工作台 pa2-hero 统一语系：深色全宽） */
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    h += '<section class="pa2-hero me-hero">' +
      '<span class="pa2-hbadge ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<div class="pa2-eyebrow"><span class="tag">授权</span>省级总代</div>' +
      '<div class="me-avatar-wrap"><span class="me-avatar">' + ui.esc(d.profile.agentName.slice(0, 1)) + "</span></div>" +
      '<h2 class="pa2-hero-title">' + ui.esc(d.profile.agentName) + "</h2>" +
      '<p class="pa2-hero-desc">授权编号 <b>' + ui.esc(d.profile.authNo) + "</b> · 有效期至 <b>" + ui.esc(d.profile.validTill) + "</b></p>" +
      "</section>";

    /* 演示：身份角色切换（D5） */
    h += '<div class="me-roleline">' + ui.icon("shield", 15) + "<span>原型演示身份（用于验证 D5 权限差异）：</span></div>";
    h += '<section class="v3-card"><div class="v3-radio" id="role-sel">' +
      roleOpt("boss", "老板 / 管理员", st.role === "boss") + roleOpt("staff", "员工", st.role === "staff") + "</div>" +
      '<div class="v3-xs v3-muted v3-mt9" >员工可发码 / 跟进 / 登记传凭证；不可签协议、改比例、确认平账、查看自留、全量导出，仅看本人名下线索。</div></section>';

    /* 设置列表（去卡片化：通栏背景 + 分割线，与 page-home 导航列表一致） */
    h += '<div class="section-head-row"><span class="t">设置</span></div>';
    h += '<section class="v3-sub-list">' +
      meNavRow("eye", "外观主题", st.theme === "dark" ? "深色模式" : "浅色模式", "theme") +
      meNavRow("user", "进入二级企业视角", "二级企业工作台", "goto-sub") +
      "</section>";

    /* 授权与资料 */
    h += '<div class="section-head-row"><span class="t">授权与资料</span></div>';
    h += '<section class="v3-sub-list">' +
      meNavRow("shield", "授权证书", "查看", "cert") +
      meNavRow("doc", "运营规则", "O4 协议与招募口径", "rules") +
      meNavRow("receipt", "税务指引", "个人/企业分表", "tax") +
      meNavRow("chart", "团队成员", "D5 权限管理", "team") +
      meNavRow("crown", "授权徽章", "五档徽章样例", "badge") +
      "</section>";

    /* 财务口径：长 kv 块 → 折叠摘要（渐进披露） */
    h += '<details class="v3-note-fold v3-mt14"><summary>' + ui.icon("receipt", 15) +
      '<span class="sum">财务口径（锁定 · 只读）</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">总盘 = 合格消费 × <b>50%</b>；自身线 = 自身合格消费 × <b>10%</b>（独立不相加）<br/>' +
      "约定给二级比例区间 <b>0–50%</b>（平台配置 + 协议）；在途冻结 <b>T+7</b><br/>" +
      "合格：订单净额 / 积分付费 / 增值付费；排除：充值 / 免费积分 / 报名费 / 退款冲回<br/>" +
      "名额 <b>1 / 21</b>。</div></details>";

    h += '<button class="v3-btn v3-btn--block v3-btn--ghost v3-mt16" data-me-act="logout">退出登录（Mock）</button>';
    h += '<div class="trust">润锦工程链 Engchain 3.0 · v3 高保真原型 · 数据均为本地 Mock</div>';
    return h;
  }
  function roleOpt(v, label, on) {
    return '<label class="' + (on ? "on" : "") + '"><input type="radio" name="role" value="' + v + '" ' + (on ? "checked" : "") + '><span>' + label + "</span></label>";
  }
  function meNavRow(ic, t, s, act) {
    return '<button class="v3-sub-row v3-nav-item" data-me-act="' + act + '"><span class="v3-nav-ic">' + window.V3.ui.icon(ic, 20) + "</span>" +
      '<span class="v3-row__main"><span class="v3-row__t">' + t + "</span>" +
      '<span class="v3-row__s">' + s + "</span></span>" +
      window.V3.ui.icon("chev", 16) + "</button>";
  }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui;
    el.querySelector("#role-sel").addEventListener("click", function (e) {
      var lb = e.target.closest("label"); if (!lb) return;
      var v = lb.querySelector("input").value;
      V3.store.act("role/set", { role: v });
      ui.toast(v === "boss" ? "已切换为老板视角" : "已切换为员工视角（D5）", "ok");
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
      else if (act === "logout") {
        ui.openModal({ title: "退出登录", icon: "warn", body: "原型演示：退出登录为 Mock，不会真实清除会话。", okText: "知道了", cancel: false });
      } else {
        ui.toast("该模块为现有页面，P0 原型以入口占位（保留现网）", "");
      }
    });
  }

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
        '<p class="v3-legal v3-mt10" >证书信息以平台正式签发为准；本页为原型 Mock 展示。</p>',
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  window.V3PAGES.me = { title: "我的", render: render, mount: mount };
})();
