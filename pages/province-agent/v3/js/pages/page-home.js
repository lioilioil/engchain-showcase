/* page-home.js · 省代工作台 #/home */
(function () {
  "use strict";
  var ui;
  function pct(used, cap) { return Math.max(3, Math.round((used / cap) * 100)); }

  function render(ctx) {
    ui = ctx.ui;
    var V3 = ctx.V3, d = ctx.d, st = ctx.state;
    var fin = V3.store.calcFinance(d.financeBase);
    var fn = V3.store.funnelOf(d.leads);
    var pendApps = (d.subApps || []).filter(function (a) { return a.status === "pending"; });
    var regs1 = d.payRegs1 || [], regs2 = d.payRegs2 || [];
    var pendPay = regs1.filter(function (r) { return r.status === "pending_confirm"; }).length +
                  regs2.filter(function (r) { return r.status === "pending_confirm"; }).length;
    var disputes = regs1.filter(function (r) { return r.status === "disputed"; }).length;
    var diff1 = V3.store.diffOf(d.calc1[0], regs1);
    var diff2 = V3.store.diffOf(d.calc2[0], regs2);
    var isEmpty = st.scenario === "empty";

    var h = "";

    /* 暂停只读横幅 */
    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        '<div><b>账号已暂停 · 仅可查看</b><div class="v3-xs v3-mt2" style="color:#B9C4D4">发起邀请、登记付款、确认平账等操作已锁定，历史数据仍可查阅。</div></div></div>';
    }

    /* Hero 授权卡 */
    h += '<section class="v3-hero">' +
      '<span class="v3-hero__link" data-me>授权证书</span>' +
      '<div class="eyebrow">PROVINCE AGENT · 省级总代</div>' +
      '<div class="prov"><div class="name">' + ui.esc(d.profile.agentName) + "</div>" +
      '<span class="v3-status-pill"><span class="d"></span>' + ui.ACCT[d.profile.status] + "</span></div>" +
      '<div class="meta"><div>授权编号<b>' + ui.esc(d.profile.authNo) + "</b></div>" +
      "<div>有效期至<b>" + ui.esc(d.profile.validTill) + "</b></div></div>" +
      '<div class="v3-quota"><div class="qrow"><span>二级名额（已入驻 / 上限）</span><span><b class="num">' +
      d.profile.used + " / " + d.profile.cap + "</b></span></div>" +
      '<div class="bar"><i style="width:' + pct(d.profile.used, d.profile.cap) + '%"></i></div>' +
      '<div class="qrow v3-mt6" ><span>名额满后仍可继续邀请终端用户</span></div></div>' +
      "</section>";

    /* 财务大数字卡（segment 切换：总盘 / 自身线） */
    h += '<section class="v3-card v3-earn v3-mt12" >' +
      '<div class="seg"><button data-fin="gross" class="on">总盘 50%</button><button data-fin="self">自身线 10%</button></div>' +
      '<div class="v3-flex v3-between"><div><div class="big num" id="earn-big">' + ui.money(fin.gross) + '</div>' +
      '<div class="sub" id="earn-sub">本月总盘 = 合格消费 × 50%</div></div></div>' +
      '<div class="rows" id="earn-rows">' +
      dline("合格消费", ui.money(fin.eligible)) +
      dline("约定给二级（20%）", ui.money(fin.agreed)) +
      dline("省代自留", ui.money(fin.selfKeep)) +
      dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small") +
      "</div>" +
      '<p class="v3-legal v3-mt9" >' + V3.MONEY_NOTE + "</p></section>";

    /* 金色主 CTA：邀请用户入驻（B 轨） */
    h += '<button class="v3-cta-gold v3-press v3-mt12" id="cta-invite" ' + (ctx.readonly ? "data-locked" : "") + ">" +
      '<span style="font-size:24px">' + ui.icon("invite", 26) + "</span>" +
      "<span><div class=\"t\">邀请用户入驻</div><div class=\"s\">渠道码 · 海报 · 分享链接，直接绑定到你（B 轨获客）</div></span>" +
      '<span class="arrow">' + ui.icon("chev", 16) + "</span></button>";

    /* 待办带 */
    var todoN = pendApps.length + pendPay + disputes;
    if (todoN > 0) {
      h += '<div class="v3-todoband v3-mt12" data-go="#/reconcile">' +
        '<span class="n">' + todoN + '</span><span class="txt"><b>' +
        (pendApps.length ? pendApps.length + " 条二级申请待初审 · " : "") +
        (pendPay ? pendPay + " 笔收款待确认 · " : "") +
        (disputes ? disputes + " 条对账异议待处理" : "") +
        '</b></span><span class="go">去处理 ' + ui.icon("chev", 14) + "</span></div>";
    }

    /* 异常预警条 */
    if (d.alerts && d.alerts.length) {
      h += '<div class="v3-stack v3-mt12">';
      d.alerts.forEach(function (a) {
        h += '<div class="v3-alert v3-alert--' + (a.type || "info") + '" ' + (a.to ? 'data-go="' + a.to + '"' : "") + ">" +
          "<span>" + (a.icon || "ℹ") + '</span><div><b>' + ui.esc(a.title) + "</b><div class='v3-xs v3-mt2' >" +
          ui.esc(a.desc) + "</div></div></div>";
      });
      h += "</div>";
    }

    /* 邀请速览漏斗 + D4 付费金额 */
    h += '<div class="section-head-row"><span class="t">邀请速览</span><span class="act" data-go="#/invite">完整漏斗 ›</span></div>';
    h += '<section class="v3-card">' +
      '<div class="pa-funnel-mini">' +
      funnelBar(fn.direct, fn.direct, "直接邀请", "") +
      funnelBar(fn.registered, fn.direct, "已注册", "alt") +
      funnelBar(fn.onboarded, fn.direct, "已入驻", "") +
      funnelBar(fn.paid, fn.direct, "已消费", "alt") +
      "</div>" +
      '<div class="v3-stat-money v3-mt12" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额（D4 · 只统计不发钱）</div>' +
      '<div class="amt num v3-mt3" >' + ui.money(fn.paidAmount) + '</div>' +
      '<div class="v3-xs v3-mt3" >来自你直接邀请用户的合格消费；' + V3.MONEY_NOTE + "</div></div>" +
      (fn.ignored ? '<div class="v3-readnote v3-mt10" >' + ui.icon("eye", 16) +
        "<span>另有 <b>" + fn.ignored + "</b> 位为终端用户再邀请，<b>不归属 · 不分佣 · 不传递</b>，不计入本漏斗。</span></div>" : "") +
      "</section>";

    /* 合作管理（二级） */
    h += '<div class="section-head-row"><span class="t">合作管理 · 二级企业</span><span class="act" data-go="#/invite">发起二级 ›</span></div>';
    h += '<section class="v3-list v3-card--pad0" style="border-radius:17px">';
    if (pendApps.length) {
      h += '<button class="v3-row" data-go="#/invite" style="background:var(--v3-gold-tint)"><span class="v3-avatar v3-avatar--sub">' + ui.icon("bell", 20) + '</span>' +
        '<span class="v3-row__main"><span class="v3-row__t">' + pendApps.length + ' 家企业申请待初审</span>' +
        '<span class="v3-row__s">点击前往 A 轨招商 · 初审并配置约定比例</span></span>' + ui.icon("chev", 18) + "</button>";
    }
    if (d.subs && d.subs.length) {
      d.subs.forEach(function (s) {
        h += '<button class="v3-row" data-sub="' + s.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(s.name.slice(0, 1)) + '</span>' +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) +
          ' <span class="v3-badge v3-badge--gold">比例 ' + Math.round(s.ratioToSub * 100) + '%</span></span>' +
          '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "") + " · 可邀终端用户 · 不可再发展下级</span></span>" +
          '<span class="v3-badge v3-badge--active">生效</span>' + ui.icon("chev", 18) + "</button>";
      });
    } else if (!pendApps.length) {
      h += '<div class="v3-empty v3-ep26" ><div class="t">还没有二级企业</div>' +
        '<div class="d">名额 0 / ' + d.profile.cap + "，可通过 A 轨招商码发起合作；同时你始终可以直接邀请终端用户。</div>" +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-go="#/invite">发起二级合作</button></div>';
    }
    h += "</section>";

    /* 对账入口（两层） */
    h += '<div class="section-head-row"><span class="t">对账留痕</span><span class="act" data-go="#/reconcile">进入 ›</span></div>';
    h += '<div class="pa-quick">' +
      quickCard("平台 ⇄ 省代", d.calc1[0].calcAmount, diff1 === 0 ? "本月已平账" : "差异 " + ui.money(diff1), diff1 === 0 ? "" : "bad", "#/reconcile") +
      quickCard("省代 ⇄ 二级", d.calc2[0].calcAmount, diff2 === 0 ? "待对方确认" : "待确认 " + ui.money(diff2), diff2 === 0 ? "warn" : "", "#/reconcile") +
      "</div>";

    /* 更多服务 */
    h += '<div class="v3-sec-title">更多服务</div><section class="v3-card"><div class="v3-tiles">' +
      tile("rules", "规则说明") + tile("receipt", "税务指引") + tile("team", "团队成员") + tile("badge", "授权徽章") +
      "</div></section>";

    h += '<div class="trust">' + V3.MONEY_NOTE + "<br/>润锦工程链 Engchain 3.0 · 原型数据均为 Mock，不构成任何资金 / 税务指令</div>";

    if (isEmpty) {
      // empty 场景：数据为 0 时仍正常渲染骨架，额外空态提示
      h = '<div class="v3-empty"><div class="ic">' + ui.icon("invite", 28) + '</div>' +
        '<div class="t">还没有任何邀请数据</div><div class="d">生成你的第一个 B 轨渠道码，直接邀请终端用户入驻；A 轨可另行发起二级合作。</div>' +
        '<button class="v3-btn v3-btn--primary" data-go="#/invite">去生成渠道码</button></div>' + h;
    }
    return h;
  }

  function dline(k, v, cls) {
    return '<div class="v3-dline"><span class="k">' + k + '</span><span class="v ' + (cls || "") + ' num">' + v + "</span></div>";
  }
  function funnelBar(n, max, label, alt) {
    var hgt = 20 + (max ? Math.round((n / max) * 54) : 0);
    return '<div class="b ' + alt + '" style="height:' + hgt + 'px"><i class="num">' + n + '</i>' + label + "</div>";
  }
  function quickCard(title, amt, sub, cls, go) {
    return '<button class="q ' + cls + '" data-go="' + go + '"><div class="k">' + title + '</div>' +
      '<div class="n num">' + ui.money(amt) + '</div><div class="k">' + sub + "</div></button>";
  }
  function tile(ic, t) {
    return '<div class="v3-tile v3-tap"><span class="ic">' + (window.V3.ui.icon(ic, 22)) + "</span><span>" + t + "</span></div>";
  }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    var fin = V3.store.calcFinance(d.financeBase);

    el.addEventListener("click", function (e) {
      var goEl = e.target.closest("[data-go]");
      if (goEl) { ctx.go(goEl.getAttribute("data-go")); return; }
      if (e.target.closest("[data-me]")) { ctx.go("#/me"); return; }
      if (e.target.closest("[data-locked]")) { ui.toast("账号暂停中，仅可查看", "err"); return; }
      var cta = e.target.closest("#cta-invite");
      if (cta) { ctx.go("#/invite"); return; }
      var sub = e.target.closest("[data-sub]");
      if (sub) {
        var id = sub.getAttribute("data-sub");
        var s = d.subs.filter(function (x) { return x.id === id; })[0];
        if (s) openSub(s, ctx);
      }
    });

    /* 财务 segment */
    var big = el.querySelector("#earn-big"), sub = el.querySelector("#earn-sub"), rows = el.querySelector("#earn-rows");
    Array.prototype.forEach.call(el.querySelectorAll("[data-fin]"), function (b) {
      b.addEventListener("click", function () {
        if (b.classList.contains("on")) return;
        el.querySelectorAll("[data-fin]").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        if (b.getAttribute("data-fin") === "self") {
          big.textContent = ui.money(fin.selfLine);
          sub.textContent = "自身线 = 自身合格消费 × 10%（独立，不与总盘相加）";
          rows.innerHTML = dline("自身合格消费", ui.money(d.financeBase.selfBase || 0)) +
            dline("自身线比例", "10%") + dline("自身线经营所得", ui.money(fin.selfLine)) +
            dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small");
        } else {
          big.textContent = ui.money(fin.gross);
          sub.textContent = "本月总盘 = 合格消费 × 50%";
          rows.innerHTML = dline("合格消费", ui.money(fin.eligible)) +
            dline("约定给二级（20%）", ui.money(fin.agreed)) +
            dline("省代自留", ui.money(fin.selfKeep)) +
            dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small");
        }
      });
    });
  }

  function openSub(s, ctx) {
    var ui = ctx.ui;
    ctx.ui.openSheet({
      title: "二级企业 · 授权详情",
      body: '<div class="dl">' +
        kv("企业名称", ui.esc(s.name)) + kv("合作起始", ui.esc(s.since || "—")) +
        kv("约定所得比例", Math.round(s.ratioToSub * 100) + "%（平台配置 + O4 协议）") +
        kv("邀请终端用户", "允许（单层绑定）") + kv("发展下级企业", "永久禁止（两级封顶）") +
        kv("规模 / 费率", "由省代在平台配置 + 协议授权，App 只读") +
        "</div>" +
        '<div class="sub-scope v3-mt12" >D1：该二级可直接邀请终端用户并据此计本人线；' +
        "终端用户再邀请不归属、不分佣、不向下传递；二级无招商码。</div>" +
        '<p class="v3-legal v3-mt10" >' + ctx.V3.MONEY_NOTE + "</p>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost", onClick: function (ov) { ctx.ui.closeAll(); } }]
    });
  }
  function kv(k, v) { return '<span class="k">' + k + '</span><span class="v">' + v + "</span>"; }

  window.V3PAGES.home = { title: "工作台", render: render, mount: mount };
})();
