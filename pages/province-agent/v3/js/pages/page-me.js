/* page-me.js · 我的 #/me（P0 轻量：身份 / 角色切换 / 主题 / 授权 / 跳转二级视角） */
(function () {
  function render(ctx) {
    var ui = ctx.ui, d = ctx.d, st = ctx.state;
    var h = "";
    h += '<section class="v3-card me-profile"><span class="v3-avatar">' + ui.esc(d.profile.agentName.slice(0, 1)) + "</span>" +
      "<div><div class='v3-h-title'>" + ui.esc(d.profile.agentName) + "</div>" +
      '<div class="v3-sm v3-muted v3-mt3" >' + ui.esc(d.profile.authNo) + " · 有效期至 " + ui.esc(d.profile.validTill) + "</div>" +
      '<div class="v3-mt6" ><span class="v3-badge ' + ui.ACCT_BADGE[d.profile.status] + '">' + ui.ACCT[d.profile.status] + "</span></div></div></section>";

    /* 演示：身份角色切换（D5） */
    h += '<div class="me-roleline">' + ui.icon("shield", 15) + "<span>原型演示身份（用于验证 D5 权限差异）：</span></div>";
    h += '<section class="v3-card"><div class="v3-radio" id="role-sel">' +
      roleOpt("boss", "老板 / 管理员", st.role === "boss") + roleOpt("staff", "员工", st.role === "staff") + "</div>" +
      '<div class="v3-xs v3-muted v3-mt9" >员工可发码 / 跟进 / 登记传凭证；不可签协议、改比例、确认平账、查看自留、全量导出，仅看本人名下线索。</div></section>';

    /* 主题（演示场景切换统一在 preview.html 演示切换器） */
    h += '<div class="me-group">' +
      row("theme", "外观主题", st.theme === "dark" ? "深色" : "浅色") +
      row("goto-sub", "进入二级企业视角", "二级企业工作台") +
      "</div>";

    /* 授权与资料 */
    h += '<div class="me-group">' +
      row("cert", "授权证书", "查看") +
      row("rules", "规则说明", "") +
      row("tax", "税务指引", "") +
      row("team", "团队成员（D5 权限）", "") +
      row("badge", "授权徽章", "") +
      "</div>";

    /* 合规口径 */
    h += '<section class="v3-card v3-mt14" ><div class="v3-sm v3-strong v3-mb8" >财务口径（锁定 · 只读）</div>' +
      '<div class="kv-mini">总盘 = 合格消费 × <b>50%</b>；自身线 = 自身合格消费 × <b>10%</b>（独立不相加）<br/>' +
      "约定给二级比例区间 <b>0–50%</b>（平台配置 + 协议）；在途冻结 <b>T+7</b><br/>" +
      "合格：订单净额 / 积分付费 / 增值付费；排除：充值 / 免费积分 / 报名费 / 退款冲回<br/>" +
      "名额 <b>1 / 21</b>；" + ui.esc(ctx.V3.MONEY_NOTE) + "</div></section>";

    h += '<button class="v3-btn v3-btn--block v3-btn--ghost v3-mt16" data-me-act="logout">退出登录（Mock）</button>';
    h += '<div class="trust">润锦工程链 Engchain 3.0 · v3 高保真原型 · 数据均为本地 Mock</div>';
    return h;
  }
  function roleOpt(v, label, on) {
    return '<label class="' + (on ? "on" : "") + '"><input type="radio" name="role" value="' + v + '" ' + (on ? "checked" : "") + '><span>' + label + "</span></label>";
  }
  function row(act, t, sub) {
    return '<button class="me-row v3-tap" data-me-act="' + act + '"><span class="ic">' + window.V3.ui.icon(
      act === "theme" ? "eye" : act === "goto-sub" ? "user" : act === "cert" ? "shield" : "doc", 21) +
      "</span><span class='t'>" + t + "</span><span class='v3-xs v3-faint'>" + sub + "</span>" + window.V3.ui.icon("chev", 17) + "</button>";
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
      body: '<div class="v3-hero v3-mb12" ><div class="eyebrow">AUTHORIZATION</div>' +
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
