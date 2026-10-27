/* sub-page-invite.js · 二级 邀请码海报 #/invite · 邀请用户 #/invite-users · 统计 #/invite-stats */
(function () {
  "use strict";

  /* ---------------- 邀请码 · 海报 ---------------- */
  function renderInvite(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var chans = (d.channels || []).filter(function (c) { return c.status === "active"; });
    /* S4-G：A7 渠道码使用说明 + 授权范围（只读）两处 details 三处合一 → 渠道码卡旁「说明 ›」玻璃弹层
       G-B（P1-7）：说明入口由独立 act2 文字链降级为标题内小灰字 .gb-help，不与「+ 生成渠道码」主操作同排争焦点（V4 一屏唯一焦点） */
    var h = '<div class="section-head-row"><span class="t">我的渠道码' +
      '<span class="gb-help" data-act="chan-help">说明</span></span>' +
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
    /* 导航职责单一化：去 #/invite-users 的 data-go CTA（邀请获客大类子导航已含「邀请用户」页签，不重复切页） */
    return h;
  }
  function mountInvite(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      if (b.getAttribute("data-act") === "gen") genSheet(ctx);
      else if (b.getAttribute("data-act") === "chan-help") chanHelpSheet(ctx);
      else if (b.getAttribute("data-act") === "poster") {
        var c = ctx.d.channels.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        poster(ctx, c);
      }
    });
  }
  /* S4-G：A7 三处合一弹层（渠道码使用说明 + 授权范围只读），合规原文不删只改承载 */
  function chanHelpSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "渠道码与授权范围",
      body: '<p class="v3-legal">你的渠道码（<b>CH-S</b>）仅用于<b>直接邀请终端用户</b>；你没有招商码、不能发展下级。用户再邀请不归属、不分佣、不传递。</p>' +
        '<p class="v3-legal v3-mt8">规模 / 范围 / 费率：<b>由省代在平台配置 + O4 协议授权</b>，App 只读、无自助改费率入口。</p>',
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
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
    /* G-B（P1-7）：二维码下补数据概览行（线索/已消费/今日新增），消除大面积空白；
       数据全部取 store 真实漏斗与 leads，不发明新字段；今日新增 = leads[].createdAt === 今天 */
    var fn = ctx.V3.store.funnelOf(ctx.d.leads || []);
    var _t = new Date();
    var _ts = _t.getFullYear() + "-" + ("0" + (_t.getMonth() + 1)).slice(-2) + "-" + ("0" + _t.getDate()).slice(-2);
    var todayN = (ctx.d.leads || []).filter(function (l) { return l.createdAt === _ts; }).length;
    ui.openSheet({
      title: "渠道码海报",
      body: '<div class="v3-poster"><div class="pt">入驻润锦工程链<br/>本地企业服务直达</div>' +
        '<div class="ps">企业直接邀请 · 单层绑定 · 服务有保障</div>' +
        '<div class="pq"><div class="v3-qr"></div></div><div class="pc">' + ui.esc(code) + "</div>" +
        /* G-B（P1-7）：数据概览三列，tabular-nums，浅分隔，不抢海报主视觉 */
        '<div class="gb-pstats">' +
          '<div class="it"><div class="n num">' + fn.direct + '</div><div class="k">线索</div></div>' +
          '<div class="it"><div class="n num">' + fn.paid + '</div><div class="k">已消费</div></div>' +
          '<div class="it"><div class="n num">' + todayN + '</div><div class="k">今日新增</div></div>' +
        '</div></div>' +
        '<div class="iv-codeline v3-mt12" >' + ui.esc(code) + "</div>" +
        /* T2-D（V7）：3 分享 Mock 按钮合并为 1 个「分享」，点击 toast */
        '<button type="button" class="v3-btn v3-btn--primary v3-btn--block v3-mt12 t2d-share">分享</button>' +
        '<p class="v3-legal v3-mt12" style="text-align:center">二维码为原型占位；分享为 Mock。</p>',
      footer: [{ t: "完成", kind: "v3-btn--primary" }],
      onMount: function (wrap) {
        var sh = wrap.querySelector(".t2d-share");
        if (sh) sh.addEventListener("click", function () { ui.toast("已复制（Mock）", "ok"); });
      }
    });
  }

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
      /* T2-D：删装饰性轨道条（V1），纯数字行 */
      return '<div class="iv-funnel-row"><span class="iv-step">' + (idx + 1) + '</span><span class="lab">' + lab + '</span><span class="val num">' + n + "</span></div>";
    }
    var h = '<section class="s-l2 iv-funnel"><div class="v3-sm v3-strong v3-mb10">邀请转化漏斗（仅直接邀请用户）</div>' +
      row("直接邀请", fn.direct, fn.direct, 0) + row("已注册", fn.registered, fn.direct, 1) +
      row("已入驻", fn.onboarded, fn.direct, 2) + row("已消费", fn.paid, fn.direct, 3) + row("已复购", fn.repaid, fn.direct, 4) +
      '<div class="s-prow s-prow--div v3-mt12"><span class="k">邀请已产生付费金额 · 仅统计不发钱</span>' +
      '<span class="v num v3-goldtext">' + ui.moneyD(fn.paidAmount) + "</span></div></section>";

    h += '<section class="sub-finance v3-mt12" ><div class="v3-xs t2d-fin-x">本月本人经营所得（测算）</div>' +
      '<div class="big num v3-mt2" >' + ui.moneyD(fin.agreed) + "</div>" +
      '<div class="rows"><div class="v3-dline"><span class="k">合格消费</span><span class="v num">' + ui.money(fin.eligible) + "</span></div>" +
      '<div class="v3-dline"><span class="k">总盘 ×50%</span><span class="v num">' + ui.money(fin.gross) + "</span></div>" +
      '<div class="v3-dline"><span class="k">约定比例</span><span class="v num">' + Math.round(fin.ratioToSub * 100) + "%（只读）</span></div></div></section>";

    if (fn.ignored) h += '<div class="v3-xs v3-muted v3-mt12">另有 ' + fn.ignored + " 位用户再邀请，已自动排除 · 不归属不分佣不传递</div>";
    return h;
  }

  window.V3SUBPAGES.invite = { title: "邀请码 · 海报", render: renderInvite, mount: mountInvite };
  window.V3SUBPAGES["invite-users"] = { title: "我的邀请用户", render: renderUsers, mount: mountUsers };
  window.V3SUBPAGES["invite-stats"] = { title: "转化与分佣", render: renderStats, mount: function () {} };
})();
