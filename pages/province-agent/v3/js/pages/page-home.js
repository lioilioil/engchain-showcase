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
    var reconWarn = diff1 !== 0 || diff2 !== 0;
    var isEmpty = st.scenario === "empty";

    var h = "";

    /* 暂停只读横幅 */
    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        '<div><b>账号已暂停 · 仅可查看</b><div class="v3-xs v3-mt2" style="color:#B9C4D4">发起邀请、登记付款、确认平账等操作已锁定，历史数据仍可查阅。</div></div></div>';
    }

    /* Hero 授权卡（auth 风深色：眉标 + 右上角毛玻璃状态徽章 + 4格权益快览 + 名额进度段） */
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    var todoN = pendApps.length + pendPay + disputes + (reconWarn ? 1 : 0);
    var segs = "";
    var usedSeg = d.profile.used > 0 ? Math.max(1, Math.round((d.profile.used / d.profile.cap) * 5)) : 0;
    for (var si = 0; si < 5; si++) segs += '<i class="' + (si < usedSeg ? "on" : "") + '"></i>';
    h += '<section class="pa2-hero">' +
      '<span class="pa2-hbadge ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<div class="pa2-eyebrow"><span class="tag">授权</span>省级总代工作台</div>' +
      '<h2 class="pa2-hero-title">' + ui.esc(d.profile.agentName) + "</h2>" +
      '<p class="pa2-hero-desc">授权编号 <b>' + ui.esc(d.profile.authNo) + "</b> · 有效期至 <b>" + ui.esc(d.profile.validTill) + "</b></p>" +
      '<div class="pa2-hfacts">' +
        hfact(d.profile.used + "/" + d.profile.cap, "二级名额") +
        hfact(todoN, "待办") +
        hfact(ui.money(fin.frozen), "在途冻结") +
      "</div>" +
      '<div class="pa2-hprog"><div class="segs">' + segs + '</div>' +
        '<span class="pn num">' + d.profile.used + "/" + d.profile.cap + "</span>" +
        '<span class="pl">二级名额</span></div>' +
      "</section>";

    /* 财务大数字卡（segment 切换：总盘 / 自身线；明细默认收起，点击展开） */
    h += '<section class="v3-card v3-earn v3-mt12" >' +
      '<div class="seg"><button data-fin="gross" class="on">总盘 50%</button><button data-fin="self">自身线 10%</button></div>' +
      '<div class="v3-flex v3-between"><div><div class="big num" id="earn-big">' + ui.moneyD(fin.gross) + '</div>' +
      '<div class="sub" id="earn-sub">本月总盘 = 合格消费 × 50%</div></div></div>' +
      '<button type="button" id="earn-toggle" class="v3-detail-toggle">查看明细 ▾</button>' +
      '<div class="rows" id="earn-rows" style="display:none">' +
      dline("合格消费", ui.money(fin.eligible)) +
      dline("约定给二级（20%）", ui.money(fin.agreed)) +
      dline("省代自留", ui.money(fin.selfKeep)) +
      dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small") +
      "</div></section>";

    /* 金色主 CTA：邀请用户入驻（B 轨） */
    h += '<button class="v3-cta-gold v3-press v3-mt12" id="cta-invite" ' + (ctx.readonly ? "data-locked" : "") + ">" +
      '<span style="font-size:24px">' + ui.icon("invite", 26) + "</span>" +
      "<span><div class=\"t\">邀请用户入驻</div></span>" +
      '<span class="arrow">' + ui.icon("chev", 16) + "</span></button>";

    /* 待办：拆成独立可点行（一卡 + N 行，每行 ≥56px 热区，不再"·"串联） */
    if (todoN > 0) {
      var todoRows = [];
      if (pendApps.length) todoRows.push({ ic: "crown", t: "二级申请待初审", dd: "A 轨招商 · 需你初审", n: pendApps.length, go: "#/invite" });
      if (pendPay) todoRows.push({ ic: "receipt", t: "收款待确认", dd: "线下到账核对", n: pendPay, go: "#/reconcile" });
      if (disputes) todoRows.push({ ic: "warn", t: "对账异议待处理", dd: "二级已提异议", n: disputes, go: "#/reconcile" });
      if (reconWarn) todoRows.push({ ic: "reconcile", t: "两层对账待核对", dd: "差异未清零", n: "!", go: "#/reconcile" });
      h += '<div class="v3-todos">' +
        '<div class="v3-todos__hd"><span class="t">待办事项</span><span class="n">' + todoN + "</span></div>" +
        todoRows.map(function (r) {
          return '<button class="row" data-go="' + r.go + '">' +
            '<span class="ic">' + ui.icon(r.ic, 15) + "</span>" +
            '<span class="main"><span class="tt">' + r.t + '</span><span class="dd">' + r.dd + "</span></span>" +
            '<span class="cnt">' + r.n + "</span>" + ui.icon("chev", 16) + "</button>";
        }).join("") + "</div>";
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

    /* 邀请速览（一行横向数字流，不占高） */
    h += '<div class="section-head-row"><span class="t">邀请速览</span><span class="act" data-go="#/invite">完整漏斗 ›</span></div>';
    h += '<section class="v3-card">' +
      '<div class="pa2-funnel-line">' +
        fstep("直接邀请", fn.direct) + farrow() +
        fstep("已注册", fn.registered) + farrow() +
        fstep("已入驻", fn.onboarded) + farrow() +
        fstep("已消费", fn.paid) +
      "</div>" +
      '<div class="v3-stat-money v3-mt10" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额（D4 · 只统计不发钱）</div>' +
      '<div class="amt num v3-mt3" >' + ui.moneyD(fn.paidAmount) + '</div>' +
      (fn.ignored ? '<div class="v3-note-tags v3-mt9"><span class="t">另有 ' + fn.ignored + " 位用户再邀请</span><span class=\"t\">不归属</span><span class=\"t\">不分佣</span><span class=\"t\">不传递</span></div>" : "") +
      "</section>";

    /* 合作管理（二级）— V4: 去卡片化，改为通栏背景 + 分割线 */
    h += '<div class="section-head-row"><span class="t">合作管理 · 二级企业</span><span class="act" data-go="#/invite">发起二级 ›</span></div>';
    h += '<section class="v3-sub-list">';
    if (pendApps.length) {
      h += '<button class="v3-sub-row" data-go="#/invite" style="background:var(--v3-gold-tint)"><span class="v3-avatar v3-avatar--sub">' + ui.icon("bell", 20) + '</span>' +
        '<span class="v3-row__main"><span class="v3-row__t">' + pendApps.length + ' 家企业申请待初审</span>' +
        '<span class="v3-row__s">点击前往 A 轨招商 · 初审并配置约定比例</span></span>' + ui.icon("chev", 18) + "</button>";
    }
    if (d.subs && d.subs.length) {
      d.subs.forEach(function (s) {
        h += '<button class="v3-sub-row" data-sub="' + s.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(s.name.slice(0, 1)) + '</span>' +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
          '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "") +
          '<span class="v3-minichip">可邀终端用户</span><span class="v3-minichip">两级封顶</span></span></span>' +
          '<span class="v3-row__right"><span class="v3-badge v3-badge--gold">比例 ' + Math.round(s.ratioToSub * 100) + '%</span>' +
          '<span class="v3-badge v3-badge--active">生效</span></span>' + ui.icon("chev", 18) + "</button>";
      });
    } else if (!pendApps.length) {
      h += '<div class="v3-empty v3-ep26" >' + ui.emptyHtml("还没有二级企业",
        '<div>名额 0 / ' + d.profile.cap + '，可通过 A 轨招商码发起合作；同时你始终可以直接邀请终端用户。</div>' +
        '<button class="v3-btn v3-btn--primary v3-btn--sm" data-go="#/invite">发起二级合作</button>',
        "crown") + "</div>";
    }
    h += "</section>";

    /* 对账入口已并入待办带，此处不再单独占卡 */

    /* 更多服务 — V4: 从 2×2 权益带改为单列列表（去均匀网格 A6） */
    h += '<div class="section-head-row"><span class="t">工作台导航</span></div>';
    h += '<section class="v3-sub-list">' +
      navItem("doc", "运营规则", "O4 协议与招募口径", "rules.html") +
      navItem("receipt", "税务指引", "个人/企业分表", "tax-guide.html") +
      navItem("users", "招商中心", "A 轨招商码与海报", "recruit.html") +
      navItem("shield", "授权徽章", "五档徽章样例", "badge.html") +
      "</section>";

    h += '<div class="trust">润锦工程链 Engchain 3.0 · 原型数据均为 Mock</div>';

    if (isEmpty) {
      // empty 场景：数据为 0 时仍正常渲染骨架，额外空态提示
      h = '<div class="v3-empty">' + ui.emptySvg("tray") +
        '<div class="t">还没有任何邀请数据</div><div class="d">生成你的第一个 B 轨渠道码，直接邀请终端用户入驻；A 轨可另行发起二级合作。</div>' +
        '<button class="v3-btn v3-btn--primary" data-go="#/invite">去生成渠道码</button></div>' + h;
    }
    return h;
  }

  function dline(k, v, cls) {
    return '<div class="v3-dline"><span class="k">' + k + '</span><span class="v ' + (cls || "") + ' num">' + v + "</span></div>";
  }
  function hfact(v, k) {
    return '<div class="pa2-hfact"><div class="v">' + v + '</div><div class="k">' + k + "</div></div>";
  }
  function benItem(ic, t, s, href) {
    return '<a class="pa2-ben-item" href="' + href + '"><span class="bi">' + ui.icon(ic, 16) + "</span>" +
      '<span class="bm"><strong>' + t + "</strong><span>" + s + "</span></span></a>";
  }
  function navItem(ic, t, s, href) {
    return '<a class="v3-sub-row v3-nav-item" href="' + href + '"><span class="v3-nav-ic">' + ui.icon(ic, 20) + "</span>" +
      '<span class="v3-row__main"><span class="v3-row__t">' + t + "</span>" +
      '<span class="v3-row__s">' + s + "</span></span>" +
      ui.icon("chev", 16) + "</a>";
  }
  function fstep(k, v) {
    return '<div class="fs"><span class="fv num">' + v + '</span><span class="fk">' + k + "</span></div>";
  }
  function farrow() { return '<span class="fa">' + ui.icon("chev", 12) + "</span>"; }
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

    /* 财务明细展开/收起 */
    var toggle = el.querySelector("#earn-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var rowsEl = el.querySelector("#earn-rows");
        var isOpen = rowsEl.classList.contains("is-open");
        if (isOpen) {
          rowsEl.style.gridTemplateRows = "0fr";
          rowsEl.style.opacity = "0";
          rowsEl.classList.remove("is-open");
          toggle.textContent = "查看明细 ▾";
          setTimeout(function () { rowsEl.style.display = "none"; }, 280);
        } else {
          rowsEl.style.display = "grid";
          rowsEl.style.gridTemplateRows = "0fr";
          rowsEl.style.opacity = "0";
          rowsEl.offsetHeight;
          rowsEl.style.gridTemplateRows = "1fr";
          rowsEl.style.opacity = "1";
          rowsEl.classList.add("is-open");
          toggle.textContent = "收起明细 ▴";
        }
      });
    }

    /* 财务 segment */
    var big = el.querySelector("#earn-big"), sub = el.querySelector("#earn-sub"), rows = el.querySelector("#earn-rows");
    Array.prototype.forEach.call(el.querySelectorAll("[data-fin]"), function (b) {
      b.addEventListener("click", function () {
        if (b.classList.contains("on")) return;
        el.querySelectorAll("[data-fin]").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        if (b.getAttribute("data-fin") === "self") {
          big.innerHTML = ui.moneyD(fin.selfLine);
          sub.textContent = "自身线 = 自身合格消费 × 10%（独立，不与总盘相加）";
          rows.innerHTML = dline("自身合格消费", ui.money(d.financeBase.selfBase || 0)) +
            dline("自身线比例", "10%") + dline("自身线经营所得", ui.money(fin.selfLine)) +
            dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small");
        } else {
          big.innerHTML = ui.moneyD(fin.gross);
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
