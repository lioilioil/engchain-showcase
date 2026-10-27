/* sub-page-invite.js · 二级 邀请码·海报 #/invite · 邀请用户 #/invite-users · 转化分佣 #/invite-stats
   数据对齐新种子：channels.school 数组、leads.school 数组、funnelOf 新口径。 */
(function () {
  "use strict";
  var SP = window.V3SUBPAGES = window.V3SUBPAGES || {};

  function allLeads(ctx) {
    var d = ctx.d;
    var out = [];
    Object.keys(d.leads || {}).forEach(function (ch) {
      (d.leads[ch] || []).forEach(function (l) { out.push(l); });
    });
    return out;
  }
  function copyText(text, ui) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { ui.toast("已复制", "ok"); }, function () { fb(); });
    } else fb();
    function fb() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ui.toast("已复制", "ok"); } catch (e) { ui.toast("复制失败，请手动复制", "err"); }
      document.body.removeChild(ta);
    }
  }

  /* ---------------- 邀请码 · 海报 ---------------- */
  function renderInvite(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var chans = (d.channels.school || []).filter(function (c) { return c.status === "active"; });
    var h = '<div class="v3-page-head"><div class="v3-page-title">邀请码 · 海报</div>' +
      '<div class="v3-page-sub">仅用于直接邀请终端用户，单层绑定，不能发展下级</div></div>';
    h += '<div class="section-head-row"><span class="t">我的渠道码<span class="gb-help" data-act="chan-help">说明</span></span>' +
      (ctx.canOwner ? '<span class="act" data-act="gen">+ 生成渠道码</span>' : "") + "</div>";
    if (chans.length) {
      h += '<div class="v3-stack">' + chans.map(function (c) {
        return '<div class="v3-codecard"><div class="v3-qr" data-code="' + c.code + '"></div>' +
          '<div style="flex:1;min-width:0"><div class="v3-codebig v3-ellipsis num">' + ui.esc(c.code) + "</div>" +
          '<div class="v3-xs v3-muted v3-mt3">本企业渠道码 · 已注册 ' + c.users + " 人 · 至 " + ui.esc(c.validUntil) + "</div></div>" +
          '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="poster" data-code="' + c.code + '">海报/分享</button></div>';
      }).join("") + "</div>";
    } else {
      h += '<div class="v3-placeholder">' + (ctx.canOwner ? "暂无生效渠道码，点击右上角生成。" : "暂无渠道码。") + "</div>";
    }
    return h;
  }

  function mountInvite(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "gen") genSheet(ctx);
      else if (act === "chan-help") chanHelpSheet(ctx);
      else if (act === "poster") {
        var code = b.getAttribute("data-code");
        poster(ctx, code);
      }
    });
  }

  function chanHelpSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "渠道码与授权范围",
      body: '<p class="v3-legal">你的渠道码（<b>CH-S</b>）仅用于<b>直接邀请终端用户</b>；你没有招商码、不能发展下级。用户再邀请不归属、不分佣、不传递。</p>' +
        '<p class="v3-legal v3-mt8">规模 / 范围 / 费率：<b>由省代在平台配置 + O4 协议授权</b>，本端只读，无自助改费率入口。</p>' +
        '<p class="v3-legal v3-mt8">二维码为演示二维码，非真实可扫码；分享请复制链接或码后转发。</p>',
      footer: [{ t: "我知道了", kind: "v3-btn--primary" }]
    });
  }

  function genSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "生成渠道码（CH-S）",
      body: '<div class="v3-field"><label>投放场景</label><select class="v3-select" id="s-src">' +
        '<option value="wechat">微信 / 线上</option><option value="offline">线下 / 名片</option></select></div>' +
        '<div class="v3-readnote">' + ui.icon("info", 13) + "<span>渠道码长期有效，可在海报中使用；旧码作废后已绑定用户不受影响。</span></div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "生成并查看海报", kind: "v3-btn--primary", onClick: function () {
          var r = ctx.V3.store.act("channel/gen", { channel: "school" });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("渠道码已生成", "ok");
          ctx.V3.router.render();
          setTimeout(function () { poster(ctx, r.code); }, 60);
        } }
      ]
    });
  }

  function poster(ctx, code) {
    var ui = ctx.ui;
    code = code || "——";
    var fn = ctx.V3.store.funnelOf(ctx.d.leads);
    ui.openSheet({
      title: "渠道码海报",
      body: '<div class="v3-poster"><div class="pt">入驻工程链平台<br/>本地企业服务直达</div>' +
        '<div class="ps">企业直接邀请 · 单层绑定 · 服务有保障</div>' +
        '<div class="pq"><div class="v3-qr" data-code="' + code + '"></div></div>' +
        '<div class="pc num">' + ui.esc(code) + "</div>" +
        '<div class="gb-pstats">' +
        '<div class="it"><div class="n num">' + fn.registered + '</div><div class="k">注册</div></div>' +
        '<div class="it"><div class="n num">' + fn.paid + '</div><div class="k">已消费</div></div>' +
        '<div class="it"><div class="n num">' + fn.lost + '</div><div class="k">沉寂</div></div>' +
        "</div></div>" +
        '<div class="iv-codeline v3-mt12 num">' + ui.esc(code) + "</div>" +
        '<div class="v3-actions v3-actions--2 v3-mt12">' +
        '<button type="button" class="v3-btn v3-btn--ghost" data-ps="copy">' + ui.icon("link", 15) + " 复制码</button>" +
        '<button type="button" class="v3-btn v3-btn--primary" data-ps="hint">分享指引</button></div>',
      footer: [{ t: "完成", kind: "v3-btn--primary" }],
      onMount: function (wrap) {
        wrap.querySelector('[data-ps="copy"]').addEventListener("click", function () {
          copyText("https://engchain.com/invite?code=" + code, ui);
        });
        wrap.querySelector('[data-ps="hint"]').addEventListener("click", function () {
          ui.toast("演示环境：请复制链接后在微信转发", "");
        });
      }
    });
  }

  /* ---------------- 邀请用户 ---------------- */
  function renderUsers(ctx) {
    var ui = ctx.ui;
    var h = '<div class="v3-page-head"><div class="v3-page-title">我的邀请用户</div>' +
      '<div class="v3-page-sub">企业直接邀请 · 单层绑定</div></div>';
    h += '<div class="v3-chips" id="u-chips"><button class="v3-chip on" data-f="all">全部</button>' +
      '<button class="v3-chip" data-f="registered">已注册</button><button class="v3-chip" data-f="onboarded">已入驻</button>' +
      '<button class="v3-chip" data-f="paid">已消费</button></div>';
    h += '<div id="u-list" class="v3-stack"></div>';
    return h;
  }
  function userRows(ctx, f) {
    var ui = ctx.ui;
    var list = allLeads(ctx).filter(function (l) { return f === "all" || l.stage === f; });
    if (!list.length) return '<div class="v3-empty">' + ui.emptyHtml("该状态暂无用户", "", "user") + "</div>";
    return list.map(function (l) {
      return '<div class="v3-card v3-card--pad"><button class="v3-sub-row v3-sub-row--plain" data-uid="' + l.id + '">' +
        '<span class="v3-avatar"><span class="v3-avatar__txt">' + ui.esc(l.name.slice(0, 1)) + "</span></span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(l.name) +
        ' <span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span>" +
        '<span class="v3-row__s">' + ui.esc(l.phone) + " · " + ui.esc(l.boundAt || l.createdAt) + "</span></span>" +
        (l.amount ? '<span class="v3-row__amt v3-goldtext num">' + ui.money(l.amount) + "</span>" : "") +
        ui.icon("chev", 17) + "</button></div>";
    }).join("");
  }
  function mountUsers(el, ctx) {
    var f = "all";
    var listEl = el.querySelector("#u-list");
    function rf() { listEl.innerHTML = userRows(ctx, f); }
    rf();
    el.querySelector("#u-chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-f]");
      if (!b) return;
      f = b.getAttribute("data-f");
      Array.prototype.forEach.call(el.querySelectorAll("#u-chips .v3-chip"), function (x) { x.classList.toggle("on", x === b); });
      rf();
    });
    listEl.addEventListener("click", function (e) {
      var r = e.target.closest("[data-uid]");
      if (!r) return;
      var l = allLeads(ctx).filter(function (x) { return x.id === r.getAttribute("data-uid"); })[0];
      if (l) leadDetail(ctx, l, rf);
    });
  }
  function leadDetail(ctx, l, rf) {
    var ui = ctx.ui;
    ui.openSheet({
      title: l.name + " · 邀请详情",
      body: '<div class="iv-lead-flat v3-mb10">' + ui.icon("link", 16) +
        "<span><b>企业直接邀请 · 单层绑定 · 无下级</b></span></div>" +
        '<div class="dl">' +
        '<span class="k">手机</span><span class="v">' + ui.esc(l.phone) + "</span>" +
        '<span class="k">绑定时间</span><span class="v">' + ui.esc(l.boundAt || l.createdAt) + "</span>" +
        '<span class="k">阶段</span><span class="v"><span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span>" +
        (l.amount ? '<span class="k">合格消费</span><span class="v v3-goldtext num">' + ui.money(l.amount) + "</span>" : "") +
        "</div>" +
        '<div class="sh-sec">跟进记录</div><div class="v3-timeline">' +
        ((l.notes && l.notes.length) ? l.notes.map(function (x) {
          return '<div class="v3-tl"><div class="t">' + ui.esc(x.text) + "</div><div class=\"time\">" + ui.esc(x.by) + " · " + ui.esc(x.at) + "</div></div>";
        }).join("") : '<div class="v3-xs v3-faint">暂无跟进</div>') + "</div>",
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
                var r = ctx.V3.store.act("lead/follow", { channel: "school", id: l.id, note: t });
                if (!r.ok) { ui.toast(r.reason, "err"); return false; }
                ui.closeAll();
                ui.toast("已保存", "ok");
                rf();
              } }
            ]
          });
          return false;
        } }]
    });
  }

  /* ---------------- 转化分佣 ---------------- */
  function renderStats(ctx) {
    var ui = ctx.ui, V3 = ctx.V3;
    var fn = V3.store.funnelOf(ctx.d.leads);
    var fin = V3.store.subSettle(ctx.d.calc[0]);
    function row(lab, n, idx) {
      return '<div class="iv-funnel-row"><span class="iv-step">' + (idx + 1) + '</span>' +
        '<span class="lab">' + lab + '</span><span class="val num">' + n + " 人</span></div>";
    }
    var h = '<div class="v3-page-head"><div class="v3-page-title">转化与分佣</div>' +
      '<div class="v3-page-sub">仅统计直接邀请用户；金额为只读测算</div></div>';
    h += '<section class="s-l2 iv-funnel"><div class="v3-sm v3-strong v3-mb10">邀请转化漏斗</div>' +
      row("直接邀请", fn.registered, 0) + row("完成入驻", fn.onboarded, 1) +
      row("产生合格消费", fn.paid, 2) + row("沉寂 / 流失", fn.lost, 3) +
      '<div class="s-prow s-prow--div v3-mt12"><span class="k">已转化合格消费 · 仅统计</span>' +
      '<span class="v num v3-goldtext">' + ui.moneyD(fn.paidAmount) + "</span></div></section>";

    h += '<section class="sub-finance v3-mt12"><div class="v3-xs">本月本人经营所得（测算）</div>' +
      '<div class="big num v3-mt2">' + ui.moneyD(fin.agreed) + "</div>" +
      '<div class="rows"><div class="v3-dline"><span class="k">合格消费</span><span class="v num">' + ui.money(fin.eligible) + "</span></div>" +
      '<div class="v3-dline"><span class="k">总盘 ×50%</span><span class="v num">' + ui.money(fin.gross) + "</span></div>" +
      '<div class="v3-dline"><span class="k">约定比例</span><span class="v num">' + Math.round(fin.ratioToSub * 100) + "%（只读）</span></div></div>" +
      '<div class="v3-fin__note">模拟测算，不构成可提现金额，以省代线下付款与双方确认记录为准。</div></section>';

    h += '<div class="v3-info-card"><div class="v3-info-card__title">' + ui.icon("shield", 15) + "<span>分佣口径</span></div>" +
      '<div class="v3-legal-body"><p>本端没有钱包、没有提现；约定所得由省代按平台月度对账数据线下支付。</p>' +
      "<p>用户再邀请不归属、不计佣、不传递。</p></div></div>";
    return h;
  }

  SP.invite = {
    title: "邀请码",
    render: renderInvite,
    mount: mountInvite,
    fab: function (ctx) {
      if (ctx.canOwner) ctx.fab([{ icon: "qr", label: "生成渠道码", onClick: function (c) { genSheet(c); } }]);
    }
  };
  SP["invite-users"] = { title: "邀请用户", render: renderUsers, mount: mountUsers };
  SP["invite-stats"] = { title: "转化分佣", render: renderStats, mount: function () {} };
})();
