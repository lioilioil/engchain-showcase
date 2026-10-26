/* ============================================================
   router.js · hash 路由 / 页内分段导航 / 主题
   【S 壳层 · 深度重构】
   - index：3 Tab（工作台/邀请获客/对账留痕），去「我的」→ 非 Tab 路由 #/profile（身份详情）
   - sub：4 大类 Tab（工作台/邀请获客/收款与对账/台账税务）+ 大类内子导航（seg 子页签）
   - 顶栏标题跟随当前视图/子页；首页标题「工作台总览」消除与首个 Tab 重复
   - 角标：工作台=待办总数；对账/收款与对账=未平·待确认数；不重复堆叠
   ============================================================ */
(function () {
  "use strict";
  window.V3PAGES = {};
  window.V3SUBPAGES = {};

  /* index 端 Tab（3 项，去「我的」） */
  var TABS = [
    { key: "home", label: "工作台" },
    { key: "invite", label: "邀请获客" },
    { key: "reconcile", label: "对账留痕" }
  ];
  /* #/profile 为非 Tab 路由：不出现在 Tab 条，带返回，标题「身份详情」 */
  var EXTRA_INDEX_ROUTES = ["profile"];

  /* sub 端 4 大类层级结构：大类 -> 类内子页 */
  var SUBCATS = [
    { key: "home", label: "工作台", subs: ["home", "inbox"] },
    { key: "invite", label: "邀请获客", subs: ["invite", "invite-users", "invite-stats"] },
    { key: "payments", label: "收款与对账", subs: ["payments", "statement"] },
    { key: "ledger", label: "台账税务", subs: ["ledger", "tax"] }
  ];
  /* 类内子页签短标签 */
  var SUBSEG_LABEL = {
    home: "首页", inbox: "待办",
    invite: "邀请码·海报", "invite-users": "邀请用户", "invite-stats": "转化分佣",
    payments: "收款确认", statement: "月度对账单",
    ledger: "经营台账", tax: "税务说明"
  };

  /* 顶栏标题（权威，优先于 page.title；消除「工作台」与首个 Tab 重复） */
  var INDEX_TITLES = {
    home: "工作台总览", invite: "邀请获客", reconcile: "对账留痕",
    profile: "身份详情", me: "我的"
  };
  var SUB_TITLES = {
    home: "工作台", inbox: "待办提醒",
    invite: "邀请码·海报", "invite-users": "我的邀请用户", "invite-stats": "转化与分佣",
    payments: "收款确认", statement: "月度对账单",
    ledger: "经营台账", tax: "税务说明"
  };

  var root = document.getElementById("ag-root");

  function currentKey() {
    var h = (location.hash || "#/home").replace(/^#\/?/, "").split("?")[0].split("/");
    return h[0] || "home";
  }
  function go(hash) { if (location.hash === hash) { render(); } else { location.hash = hash; } }

  function applyTheme() {
    var s = window.V3.store.getState();
    document.documentElement.setAttribute("data-theme", s.theme === "dark" ? "dark" : "light");
  }

  function isReadonly(d) { return d.profile.status !== "active"; }

  /* 二级大类归属：根据当前子页 key 反查所属大类 */
  function catOfSub(key) {
    for (var i = 0; i < SUBCATS.length; i++) {
      if (SUBCATS[i].subs.indexOf(key) >= 0) return SUBCATS[i];
    }
    return SUBCATS[0];
  }

  /* 指示条滑动（通用：容器 / 激活项 / 指示条） */
  function moveInd(containerSel, activeSel, indSel) {
    var sc = root.querySelector(containerSel);
    if (!sc) return;
    var ind = root.querySelector(indSel);
    var on = sc.querySelector(activeSel);
    if (!ind || !on) return;
    var sr = sc.getBoundingClientRect(), ir = on.getBoundingClientRect();
    ind.style.transform = "translateX(" + Math.round(ir.left - sr.left + sc.scrollLeft) + "px)";
    ind.style.width = Math.round(ir.width) + "px";
  }

  function setNavTitle(title) {
    var nt = document.querySelector(".navbar .nav-title");
    if (nt) nt.textContent = title;
    document.title = title + " · 工程链";
  }

  function badge(n) { return n > 0 ? '<span class="v3-tab__dot">' + n + "</span>" : ""; }

  function render() {
    var V3 = window.V3, s = V3.store.getState();
    if (!s) return;
    applyTheme();
    var isSub = s.mode === "sub";
    var key = currentKey();
    var registry = isSub ? window.V3SUBPAGES : window.V3PAGES;

    var validKeys;
    if (isSub) {
      validKeys = SUBCATS.reduce(function (a, c) { return a.concat(c.subs); }, []);
    } else {
      validKeys = TABS.map(function (x) { return x.key; }).concat(EXTRA_INDEX_ROUTES);
    }
    if (validKeys.indexOf(key) < 0) { location.replace("#/home"); key = "home"; }

    /* #/profile 暂挂 me 视图（E1 将把 page-me 改造为身份详情视图并注册 V3PAGES.profile） */
    var pageKey = key;
    if (!isSub && key === "profile" && !registry.profile) pageKey = "me";
    var page = registry[pageKey] || registry.home;
    if (!page) return; /* 防御：preview iframe 重载竞态下视图未注册时不炸 render 链 */
    var d = isSub ? s.sub : s.province;
    var readonly = isReadonly(d);
    var ctx = {
      state: s, d: d, ui: V3.ui, V3: V3, key: key,
      mode: s.mode, role: s.role, readonly: readonly,
      canBoss: !isSub && s.role === "boss" && !readonly,
      go: go
    };

    /* 标题跟随：TITLES 权威 > page.title 兜底 */
    var title = (isSub ? SUB_TITLES[key] : INDEX_TITLES[key]) || page.title || (isSub ? "二级企业工作台" : "省级总代工作台");
    setNavTitle(title);

    /* ---------- 角标计数 ---------- */
    var homeBadge = "", reconcileBadge = "", catBadge = {};
    if (!isSub) {
      var r1 = d.payRegs1 || [], r2 = d.payRegs2 || [];
      var pend1 = r1.filter(function (r) { return r.status === "pending_confirm"; }).length;
      var disp1 = r1.filter(function (r) { return r.status === "disputed"; }).length;
      var pend2 = r2.filter(function (r) { return r.status === "pending_confirm"; }).length;
      var disp2 = r2.filter(function (r) { return r.status === "disputed"; }).length;
      var subAppPending = (d.subApps || []).filter(function (a) { return a.status === "pending"; }).length;
      var todoN = pend1 + disp1 + pend2 + disp2 + subAppPending;   /* 待办总数 */
      var reconcileN = pend1 + disp1 + pend2 + disp2;              /* 对账未平·待处理数 */
      homeBadge = badge(todoN);
      reconcileBadge = badge(reconcileN);
    } else {
      var regs = d.payRegs || [];
      var subPend = regs.filter(function (r) { return r.status === "pending_confirm"; }).length;
      var subDisp = regs.filter(function (r) { return r.status === "disputed"; }).length;
      var agreePending = (d.agreement && d.agreement.state === "pending_mine") ? 1 : 0;
      var subTodoN = subPend + subDisp + (d.alerts || []).length + agreePending;
      catBadge["home"] = badge(subTodoN);      /* 工作台大类 = 待办总数 */
      catBadge["payments"] = badge(subPend);   /* 收款与对账大类 = 收款确认数（独立显示，不堆叠） */
    }

    /* ---------- 导航 HTML ---------- */
    var navHtml;
    if (!isSub) {
      /* index：3 文字 Tab（App 语系）+ 金色滑动指示条 */
      navHtml = '<div class="v3-subnav"><div class="sub-tabs"><div class="sub-scroll">' +
        TABS.map(function (t) {
          var b = t.key === "home" ? homeBadge : t.key === "reconcile" ? reconcileBadge : "";
          return '<button type="button" class="sub-item ' + (t.key === key ? "active" : "") + '" data-key="' + t.key + '">' +
            "<span>" + t.label + "</span>" + b + "</button>";
        }).join("") +
        '<span class="sub-ind" aria-hidden="true"></span>' +
        "</div></div></div>";
    } else {
      /* sub：4 大类 Tab（L1）+ 大类内子页签（L2） */
      var activeCat = catOfSub(key);
      navHtml = '<div class="v3-subsplit">' +
        '<div class="v3-cattabs"><div class="cat-scroll">' +
        SUBCATS.map(function (c) {
          return '<button type="button" class="v3-cat ' + (c.key === activeCat.key ? "active" : "") + '" data-cat="' + c.key + '" data-first="' + c.subs[0] + '">' +
            "<span>" + c.label + "</span>" + (catBadge[c.key] || "") + "</button>";
        }).join("") +
        '<span class="v3-cat-ind" aria-hidden="true"></span>' +
        "</div></div>" +
        '<div class="v3-subseg">' +
        activeCat.subs.map(function (k) {
          return '<button type="button" class="v3-seg ' + (k === key ? "active" : "") + '" data-key="' + k + '">' +
            (SUBSEG_LABEL[k] || k) + "</button>";
        }).join("") +
        "</div></div>";
    }

    root.innerHTML = navHtml +
      '<div id="ag-view" class="v3-fade-enter"><div class="v3-page" id="v3-page-body"></div></div>';

    var bodyEl = document.getElementById("v3-page-body");
    /* 文字密度专项：合规免责（MONEY_NOTE）统一收为页尾折叠脚注，首屏只留摘要行，不删文案只改承载形态 */
    var _ui = window.V3.ui;
    var legalNote = '<details class="v3-note-fold v3-legal-note"><summary>' + _ui.icon("shield", 14) +
      '<span class="sum">合规与测算说明</span><span class="chev">' + _ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">' + _ui.esc(window.V3.MONEY_NOTE) +
      "<br/>本页为高保真原型演示，数据均为本地 Mock；不构成任何资金 / 税务指令。</div></details>";
    bodyEl.innerHTML = page.render(ctx) + legalNote;
    if (page.mount) page.mount(bodyEl, ctx);

    requestAnimationFrame(function () {
      var view = document.getElementById("ag-view");
      if (view) view.classList.remove("v3-fade-enter");
    });

    /* ---------- 事件绑定 ---------- */
    /* index：3 Tab 点击（按钮 + location.hash，避免 base 解析整页换页） */
    var idxSc = root.querySelector(".v3-subnav .sub-scroll");
    if (idxSc) {
      idxSc.addEventListener("click", function (e) {
        var btn = e.target.closest(".sub-item");
        if (!btn) return;
        go("#/" + btn.getAttribute("data-key"));
      });
    }
    /* sub：大类 Tab（跳类内首页）+ 子页签（切子页） */
    var catSc = root.querySelector(".v3-cattabs .cat-scroll");
    if (catSc) {
      catSc.addEventListener("click", function (e) {
        var btn = e.target.closest(".v3-cat");
        if (!btn) return;
        go("#/" + btn.getAttribute("data-first"));
      });
    }
    var segBar = root.querySelector(".v3-subsplit .v3-subseg");
    if (segBar) {
      segBar.addEventListener("click", function (e) {
        var btn = e.target.closest(".v3-seg");
        if (!btn) return;
        go("#/" + btn.getAttribute("data-key"));
      });
    }

    /* 指示条 */
    requestAnimationFrame(function () {
      moveInd(".v3-subnav .sub-scroll", ".sub-item.active", ".v3-subnav .sub-ind");
      moveInd(".v3-cattabs .cat-scroll", ".v3-cat.active", ".v3-cat-ind");
    });

    try { root.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { root.scrollTop = 0; }
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("v3:scenario", render);
  document.addEventListener("DOMContentLoaded", function () {
    if (window.V3.store.getState()) { render(); return; }
    var n = 0;
    var t = setInterval(function () {
      if ((window.V3 && window.V3.store && window.V3.store.getState()) || ++n > 40) {
        clearInterval(t);
        if (window.V3 && window.V3.store && window.V3.store.getState()) render();
      }
    }, 50);
  });
  window.V3.router = { render: render, go: go, currentKey: currentKey };

  /* shell 级 tax 子页 stub：摘要 + 完整指南外链（E2 可后续注册 V3SUBPAGES.tax 覆盖） */
  if (!window.V3SUBPAGES.tax) {
    window.V3SUBPAGES.tax = {
      title: "税务说明",
      render: function (ctx) {
        var ui = ctx.ui;
        return '<div class="v3-sec-title">税务说明（摘要）</div>' +
          '<section class="v3-card"><p class="v3-legal">' +
          "二级企业经营所得按主体性质分别申报：企业主体按企业所得税口径，个人 / 个体按经营所得口径；" +
          "邀请分佣、收款确认均以平台留痕凭证为对账依据，具体税率与申报义务以税务机关口径为准。</p>" +
          '<button class="v3-btn v3-btn--block v3-btn--navy v3-mt12" onclick="location.href=\'tax-guide.html\'">' +
          ui.icon("receipt", 16) + "<span>查看完整税务指引</span></button></section>";
      },
      mount: function () {}
    };
  }
})();
