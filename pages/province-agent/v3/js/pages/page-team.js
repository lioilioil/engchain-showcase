/* page-team.js · 省代团队（v3 数据：成员与渠道归属、获客统计真实） */
(function () {
  "use strict";
  var P = window.V3PAGES = window.V3PAGES || {};

  function memberLeads(d, name) {
    var n = 0, amount = 0;
    ["direct", "agent"].forEach(function (ch) {
      (d.leads[ch] || []).forEach(function (l) {
        if (l.owner === name) { n++; amount += l.amount || 0; }
      });
    });
    return { n: n, amount: amount };
  }

  function render(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var team = d.team || [];
    var h = '<div class="v3-page-head"><div class="v3-page-title">团队成员</div>' +
      '<div class="v3-page-sub">成员角色、渠道归属与获客情况</div></div>';
    h += '<div class="v3-stack">';
    team.forEach(function (m) {
      var st = memberLeads(d, m.name);
      h += '<div class="v3-card v3-card--pad"><div class="v3-sub-row v3-sub-row--plain">' +
        '<span class="v3-avatar ' + (m.isLegal ? "v3-avatar--boss" : "") + '">' +
        (m.isLegal ? ui.icon("crown", 19) : '<span class="v3-avatar__txt">' + ui.esc(m.name.slice(0, 1)) + "</span>") + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(m.name) +
        (m.isLegal ? '<span class="v3-badge v3-badge--gold v3-ml6">法人</span>' : '<span class="v3-badge v3-badge--active v3-ml6">员工</span>') + "</span>" +
        '<span class="v3-row__s">' + ui.esc(m.title) + " · " + ui.esc(m.phone) + "</span>" +
        '<span class="v3-row__s">加入于 ' + ui.esc(m.since) + (m.channel ? " · 渠道码 " + m.channel : "") + "</span></span>" +
        '<span class="v3-row__right v3-team-stat"><b class="num">' + st.n + '</b><span>邀请用户</span></span></div>' +
        (st.amount ? '<div class="v3-kv v3-mt8"><span class="k">名下合格消费</span><span class="v num">' + ui.money(st.amount) + "</span></div>" : "") +
        "</div>";
    });
    h += "</div>";
    h += '<div class="v3-info-card"><div class="v3-info-card__title">' + ui.icon("info", 15) + "<span>成员管理说明</span></div>" +
      '<div class="v3-legal-body"><p>员工仅可操作本人渠道码与本人渠道线索，付款、审批、平账、协议等动作仅老板可执行。</p>' +
      "<p>新增成员与角色权限配置为后续版本能力，暂不开放。</p></div></div>";
    return h;
  }

  function mount(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (b && b.getAttribute("data-act") === "invite") ctx.ui.toast("成员管理将在后续版本开放", "");
    });
  }

  P.team = { title: "团队", render: render, mount: mount };
})();
