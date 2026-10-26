/* sub-page-invite.js · 二级 邀请码海报 #/invite · 邀请用户 #/invite-users · 统计 #/invite-stats */
(function () {
  "use strict";

  /* ---------------- 邀请码 · 海报 ---------------- */
  function renderInvite(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var chans = (d.channels || []).filter(function (c) { return c.status === "active"; });
    /* 顶部说明（~55 字）→ 折叠摘要 */
    var h = '<details class="v3-note-fold v3-mb12"><summary>' + ui.icon("shield", 15) +
      '<span class="sum">渠道码使用说明</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">你的渠道码（<b>CH-S</b>）仅用于<b>直接邀请终端用户</b>；你没有招商码、不能发展下级。用户再邀请不归属、不分佣、不传递。</div></details>';
    h += '<div class="section-head-row"><span class="t">我的渠道码</span>' +
      (ctx.readonly ? "" : '<span class="act" data-act="gen">+ 生成渠道码</span>') + "</div>";
    if (chans.length) {
      h += '<div class="v3-stack">' + chans.map(function (c) {
        return '<div class="v3-codecard"><div class="v3-qr"></div><div style="flex:1;min-width:0">' +
          '<div class="v3-codebig v3-ellipsis">' + ui.esc(c.code) + "</div>" +
          '<div class="v3-xs v3-muted v3-mt3" >本企业渠道码 · ' + ui.esc(c.createdAt) + "</div></div>" +
          '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="poster" data-id="' + c.id + '">海报/分享</button></div>';
      }).join("") + "</div>";
    } else {
      h += '<div class="v3-placeholder">暂无生效渠道码，点击右上角生成。</div>';
    }
    h += '<details class="v3-note-fold v3-mt12"><summary>' + ui.icon("lock", 15) +
      '<span class="sum">授权范围（只读）</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">规模 / 范围 / 费率：<b>由省代在平台配置 + O4 协议授权</b>，App 只读、无自助改费率入口。</div></details>';
    h += '<button class="v3-btn v3-btn--block v3-btn--navy v3-mt12" data-go="#/invite-users">查看我的邀请用户</button>';
    return h;
  }
  function mountInvite(el, ctx) {
    el.addEventListener("click", function (e) {
      var g = e.target.closest("[data-go]"); if (g) return ctx.go(g.getAttribute("data-go"));
      var b = e.target.closest("[data-act]"); if (!b) return;
      if (b.getAttribute("data-act") === "gen") genSheet(ctx);
      else if (b.getAttribute("data-act") === "poster") {
        var c = ctx.d.channels.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        poster(ctx, c);
      }
    });
  }
  function genSheet(ctx) {
    var ui = ctx.ui;
    if (ctx.readonly) return ui.toast("合作暂停中，仅可查看", "err");
    ui.openSheet({
      title: "生成渠道码（CH-S）",
      body: '<div class="v3-field"><label>投放场景</label><select class="v3-select" id="s-src"><option value="wechat">微信 / 线上</option><option value="offline">线下 / 名片</option></select></div>' +
        '<div class="v3-field"><label>海报模板</label><select class="v3-select" id="s-tpl"><option value="tpl1">工程服务蓝金版</option><option value="tpl2">线下合作版</option></select></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "生成并看海报", kind: "v3-btn--primary", onClick: function (wrap) {
          ctx.V3.store.act("channel/gen", {
            ownerType: "sub", src: wrap.querySelector("#s-src").value, tpl: wrap.querySelector("#s-tpl").value,
            ownerName: ctx.d.profile.name
          });
          ui.toast("渠道码已生成", "ok"); ctx.V3.router.render();
          setTimeout(function () { poster(ctx, ctx.V3.store.domain().channels[0]); }, 60);
        } }
      ]
    });
  }
  function poster(ctx, c) {
    var ui = ctx.ui, code = (c && c.code) || "——";
    ui.openSheet({
      title: "渠道码海报",
      body: '<div class="v3-poster"><div class="pt">入驻润锦工程链<br/>本地企业服务直达</div>' +
        '<div class="ps">企业直接邀请 · 单层绑定 · 服务有保障</div>' +
        '<div class="pq"><div class="v3-qr"></div></div><div class="pc">' + ui.esc(code) + "</div></div>" +
        '<div class="iv-codeline v3-mt12" >' + ui.esc(code) + "</div>" +
        '<div class="iv-sharegrid">' + share("share", "微信好友") + share("link", "复制链接") + share("qr", "保存图片") + "</div>" +
        '<p class="v3-legal v3-mt12" style="text-align:center">二维码为原型占位；分享为 Mock。</p>',
      footer: [{ t: "完成", kind: "v3-btn--primary" }],
      onMount: function (wrap) {
        wrap.querySelectorAll(".iv-sharegrid button").forEach(function (x) {
          x.addEventListener("click", function () { ui.toast("已触发分享（Mock）", "ok"); });
        });
      }
    });
  }
  function share(ic, t) { return '<button>' + window.V3.ui.icon(ic, 22) + "<span>" + t + "</span></button>"; }

  /* ---------------- 我的邀请用户 ---------------- */
  function renderUsers(ctx) {
    var ui = ctx.ui;
    var mine = (ctx.d.leads || []).filter(function (l) { return !l.viaUserReinvite; });
    var xs = (ctx.d.leads || []).filter(function (l) { return l.viaUserReinvite; });
    var h = '<div class="v3-chips" id="u-chips"><button class="v3-chip on" data-f="all">全部</button>' +
      '<button class="v3-chip" data-f="registered">已注册</button><button class="v3-chip" data-f="onboarded">已入驻</button>' +
      '<button class="v3-chip" data-f="paid">已消费</button></div>';
    h += '<div id="u-list" class="v3-sub-list" style="border-radius:17px"></div>';
    if (xs.length) {
      h += '<div class="v3-sec-title">用户再邀请（不归属）</div><div class="v3-sub-list iv-reinvite" style="border-radius:17px">' +
        xs.map(function (l) {
          return '<div class="v3-sub-row"><span class="v3-avatar">' + ui.esc(l.name.slice(-1)) + "</span>" +
            '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(l.name) + ' <span class="v3-badge v3-badge--neutral">不归属</span></span>' +
            '<span class="v3-row__s">再邀请用户 · 不归属不计佣</span></span></div>';
        }).join("") + "</div>";
    }
    return h;
  }
  function userRows(ctx, f) {
    var ui = ctx.ui;
    var list = ctx.d.leads.filter(function (l) { return !l.viaUserReinvite && (f === "all" || l.stage === f); });
    if (!list.length) return '<div class="v3-empty v3-ep26" >' + ui.emptyHtml("该状态暂无用户", "", "user") + "</div>";
    return list.map(function (l) {
      return '<button class="v3-sub-row" data-uid="' + l.id + '"><span class="v3-avatar">' + ui.esc(l.name.slice(0, 1)) + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(l.name) +
        ' <span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span>" +
        '<span class="v3-row__s">' + ui.esc(l.phone) + "</span></span>" +
        (l.paidAmount ? '<span class="v3-row__amt v3-goldtext num">' + ui.money(l.paidAmount) + "</span>" : "") +
        ui.icon("chev", 17) + "</button>";
    }).join("");
  }
  function mountUsers(el, ctx) {
    var f = "all";
    var listEl = el.querySelector("#u-list");
    function rf() { listEl.innerHTML = userRows(ctx, f); }
    rf();
    el.querySelector("#u-chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-f]"); if (!b) return;
      f = b.getAttribute("data-f");
      el.querySelectorAll("#u-chips .v3-chip").forEach(function (x) { x.classList.toggle("on", x === b); });
      rf();
    });
    listEl.addEventListener("click", function (e) {
      var r = e.target.closest("[data-uid]"); if (!r) return;
      var l = ctx.d.leads.filter(function (x) { return x.id === r.getAttribute("data-uid"); })[0];
      leadDetail(ctx, l, rf);
    });
  }
  function leadDetail(ctx, l, rf) {
    var ui = ctx.ui;
    ui.openSheet({
      title: l.name + " · 邀请详情",
      body: '<div class="iv-lead-flat v3-mb10" >' + ui.icon("link", 16) +
        "<span><b>企业直接邀请 · 单层绑定 · 无下线</b></span></div>" +
        '<div class="dl">' +
        '<span class="k">手机</span><span class="v">' + ui.esc(l.phone) + "</span>" +
        '<span class="k">阶段</span><span class="v"><span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span>" +
        (l.paidAmount ? '<span class="k">已产生付费</span><span class="v v3-goldtext num">' + ui.money(l.paidAmount) + "</span>" : "") +
        '<span class="k">来源码</span><span class="v">' + ui.esc(l.channelCode) + "</span></div>" +
        '<div class="sh-sec">跟进记录</div><div class="v3-timeline">' +
        ((l.follows && l.follows.length) ? l.follows.map(function (x) { return '<div class="v3-tl"><div class="t">' + ui.esc(x.text) + '</div><div class="time">' + ui.esc(x.at) + "</div></div>"; }).join("")
          : '<div class="v3-xs v3-faint">暂无跟进</div>') + "</div>",
      footer: ctx.readonly ? [{ t: "关闭", kind: "v3-btn--ghost" }] :
        [{ t: "新增跟进", kind: "v3-btn--primary", onClick: function () {
          ui.openSheet({
            title: "新增跟进",
            body: '<div class="v3-field"><textarea class="v3-textarea" id="uf-text" placeholder="记录跟进情况"></textarea></div>',
            footer: [
              { t: "取消", kind: "v3-btn--ghost" },
              { t: "保存", kind: "v3-btn--primary", onClick: function (wrap) {
                var t = wrap.querySelector("#uf-text").value.trim();
                if (!t) { ui.toast("请填写内容", "err"); return false; }
                ctx.V3.store.act("lead/follow", { id: l.id, text: t }); ui.toast("已保存", "ok"); ctx.V3.ui.closeAll(); rf();
              } }
            ]
          });
          return false;
        } }]
    });
  }

  /* ---------------- 转化与分佣统计 ---------------- */
  function renderStats(ctx) {
    var ui = ctx.ui, V3 = ctx.V3, fn = V3.store.funnelOf(ctx.d.leads);
    var fin = V3.store.subSettle(ctx.d.financeBase);
    function row(lab, n, max, idx) {
      var w = max ? Math.max(6, Math.round(n / max * 100)) : 0;
      return '<div class="iv-funnel-row"><span class="iv-step">' + (idx + 1) + '</span><span class="lab">' + lab + '</span><span class="track"><i style="width:' + w + '%"></i></span><span class="val num">' + n + "</span></div>";
    }
    var h = '<section class="v3-card iv-funnel"><div class="v3-sm v3-strong v3-mb10" >邀请转化漏斗（仅直接邀请用户）</div>' +
      row("直接邀请", fn.direct, fn.direct, 0) + row("已注册", fn.registered, fn.direct, 1) +
      row("已入驻", fn.onboarded, fn.direct, 2) + row("已消费", fn.paid, fn.direct, 3) + row("已复购", fn.repaid, fn.direct, 4) +
      '<div class="v3-stat-money v3-mt12" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额（D4）</div>' +
      '<div class="amt num v3-mt3" >' + ui.moneyD(fn.paidAmount) + "</div>" +
      '<div class="v3-xs v3-mt3" >只统计不发钱</div></div></section>';

    h += '<section class="sub-finance v3-mt12" ><div class="v3-xs" style="color:var(--v3-on-navy-2)">本月本人经营所得（测算）</div>' +
      '<div class="big num v3-mt2" >' + ui.moneyD(fin.agreed) + "</div>" +
      '<div class="rows"><div class="v3-dline"><span class="k">合格消费</span><span class="v num">' + ui.money(fin.eligible) + "</span></div>" +
      '<div class="v3-dline"><span class="k">总盘 ×50%</span><span class="v num">' + ui.money(fin.gross) + "</span></div>" +
      '<div class="v3-dline"><span class="k">约定比例</span><span class="v num">' + Math.round(fin.ratioToSub * 100) + "%（只读）</span></div></div></section>";

    if (fn.ignored) h += '<div class="v3-note-tags v3-mt12"><span class="t">另有 ' + fn.ignored + " 位用户再邀请，已自动排除</span><span class=\"t\">不归属</span><span class=\"t\">不分佣</span><span class=\"t\">不传递</span></div>";
    return h;
  }

  window.V3SUBPAGES.invite = { title: "邀请码 · 海报", render: renderInvite, mount: mountInvite };
  window.V3SUBPAGES["invite-users"] = { title: "我的邀请用户", render: renderUsers, mount: mountUsers };
  window.V3SUBPAGES["invite-stats"] = { title: "转化与分佣", render: renderStats, mount: function () {} };
})();
