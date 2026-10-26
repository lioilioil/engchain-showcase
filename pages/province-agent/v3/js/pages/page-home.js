/* page-home.js · 省代工作台 #/home
   【S3-E1-INDEX】身份卡只留 身份·公司·编号·有效期·状态徽章 + 角色徽章弹层 + 详情入口→#/profile；
   待办列表条与三入口卡（对账差异/在途冻结/线索沉寂）已收口至消息中心（E4 接入），home 不重复渲染；
   「邀请用户入驻」改为底部悬浮按钮（复刻 franchise .app-float-cta 视觉）。 */
(function () {
  "use strict";
  var ui;
  var fabWire = false;   /* hashchange 离场摘除监听仅挂一次 */

  function render(ctx) {
    ui = ctx.ui;
    var V3 = ctx.V3, d = ctx.d, st = ctx.state;
    var fin = V3.store.calcFinance(d.financeBase);
    var fn = V3.store.funnelOf(d.leads);
    var isEmpty = st.scenario === "empty";
    var h = "";

    /* 暂停只读横幅 */
    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        '<div><b>账号已暂停 · 仅可查看</b><div class="v3-xs v3-mt2" style="color:#B9C4D4">发起邀请、登记付款、确认平账等操作已锁定，历史数据仍可查阅。</div></div></div>';
    }

    /* 身份卡（L1 深色全宽色带）：只留 身份·公司·编号·有效期·状态徽章；
       角色徽章点击弹层说明权限边界；「身份详情 ›」→ #/profile */
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    var roleLabel = ctx.role === "staff" ? "员工" : "老板 / 管理员";
    h += '<section class="s-idcard">' +
      '<span class="ic-status ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<span class="ic-eyebrow"><span class="tag">授权</span>省级总代</span>' +
      '<h2 class="ic-name">' + ui.esc(d.profile.agentName) + "</h2>" +
      '<p class="ic-desc">授权编号 <b>' + ui.esc(d.profile.authNo) + "</b> · 有效期至 <b>" + ui.esc(d.profile.validTill) + "</b></p>" +
      '<button type="button" class="ic-role" data-act="role">' +
        '<span class="rb">' + ui.esc(roleLabel) + "</span><span class=\"rk\">权限说明</span>" + ui.icon("chev", 14) + "</button>" +
      '<button type="button" class="ic-detail" data-go="#/profile">' +
        "<span>身份详情 · 授权证书 / 团队 / 规则</span>" + ui.icon("chev", 16) + "</button>" +
      "</section>";

    /* 财务大数字卡（segment 切换：总盘 / 自身线；明细默认收起——T+N 在途冻结为非交互展示值） */
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

    /* 邀请速览（一行横向数字流，纯展示；邀请动作唯一主入口 = 底部悬浮按钮 FAB） */
    h += '<div class="section-head-row"><span class="t">邀请速览</span></div>';
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

    /* 合作管理（二级）— L3 通栏行；二级发起动作统一由底部悬浮按钮进入邀请获客 */
    h += '<div class="section-head-row"><span class="t">合作管理 · 二级企业</span></div>';
    h += '<section class="v3-sub-list">';
    if (d.subs && d.subs.length) {
      d.subs.forEach(function (s) {
        h += '<button class="v3-sub-row" data-sub="' + s.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(s.name.slice(0, 1)) + '</span>' +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
          '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "") +
          '<span class="v3-minichip">可邀终端用户</span><span class="v3-minichip">两级封顶</span></span></span>' +
          '<span class="v3-row__right"><span class="v3-badge v3-badge--gold">比例 ' + Math.round(s.ratioToSub * 100) + '%</span>' +
          '<span class="v3-badge v3-badge--active">生效</span></span>' + ui.icon("chev", 18) + "</button>";
      });
    } else {
      h += '<div class="v3-empty v3-ep26" >' + ui.emptyHtml("还没有二级企业",
        '<div>名额 0 / ' + d.profile.cap + '，点击底部「邀请获客」悬浮按钮可发起合作或邀请终端用户入驻。</div>',
        "crown") + "</div>";
    }
    h += "</section>";

    /* 工作台导航 — 单列 L3 通栏行 */
    h += '<div class="section-head-row"><span class="t">工作台导航</span></div>';
    h += '<section class="v3-sub-list">' +
      navItem("doc", "运营规则", "O4 协议与招募口径", "rules.html") +
      navItem("receipt", "税务指引", "个人/企业分表", "tax-guide.html") +
      navItem("users", "招商中心", "A 轨招商码与海报", "recruit.html") +
      navItem("shield", "授权徽章", "五档徽章样例", "badge.html") +
      "</section>";

    h += '<div class="trust">润锦工程链 Engchain 3.0 · 原型数据均为 Mock</div>';

    if (isEmpty) {
      // empty 场景：数据为 0 时仍正常渲染骨架，额外空态提示（邀请动作统一走底部悬浮按钮）
      h = '<div class="v3-empty">' + ui.emptySvg("tray") +
        '<div class="t">还没有任何邀请数据</div><div class="d">点击底部「邀请获客」悬浮按钮，生成你的第一个渠道码；也可发起二级合作。</div></div>' + h;
    }
    return h;
  }

  function dline(k, v, cls) {
    return '<div class="v3-dline"><span class="k">' + k + '</span><span class="v ' + (cls || "") + ' num">' + v + "</span></div>";
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

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    var fin = V3.store.calcFinance(d.financeBase);

    el.addEventListener("click", function (e) {
      var goEl = e.target.closest("[data-go]");
      if (goEl) { ctx.go(goEl.getAttribute("data-go")); return; }
      if (e.target.closest("[data-act='role']")) { permSheet(ctx); return; }
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

    mountFab(ctx);
  }

  /* 底部悬浮按钮（复刻 franchise .app-float-cta：玻璃容器 + 图标 + 短文案） */
  function mountFab(ctx) {
    var ui = ctx.ui;
    var phone = document.querySelector(".phone");
    if (!phone) return;
    var old = document.getElementById("e1-fab");
    if (old) old.remove();
    var fab = document.createElement("div");
    fab.className = "app-float-cta";
    fab.id = "e1-fab";
    fab.setAttribute("data-lg-glass", "");
    fab.innerHTML =
      '<button type="button" class="afc-item" id="e1-fab-btn">' + ui.icon("invite", 18) +
      '<span class="afc-label">邀请获客</span></button>';
    phone.appendChild(fab);
    fab.querySelector("#e1-fab-btn").addEventListener("click", function () {
      if (ctx.readonly) { ui.toast("账号暂停中，仅可查看", "err"); return; }
      ctx.go("#/invite");
    });
    /* 离场摘除：离开 home 即移除悬浮按钮（只挂一次 hashchange） */
    if (!fabWire) {
      fabWire = true;
      window.addEventListener("hashchange", function () {
        var k = (location.hash || "#/home").replace(/^#\/?/, "").split("?")[0];
        if (k !== "home") { var f = document.getElementById("e1-fab"); if (f) f.remove(); }
      });
    }
  }

  /* 权限说明弹层（角色徽章 → 权限边界说明） */
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
