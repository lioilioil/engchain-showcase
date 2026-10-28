/* ============================================================
   router.js · 路由 / 导航 / 页脚（顶部 sticky 页签，非底部 Tab）
   省代：home / invite / reconcile / me（设置）
   二级：home / invite / ledger / me（我的），含子 seg
   ============================================================ */
(function () {
  "use strict";

  var root = null;
  var store = null;
  var ui = null;
  var themeApplied = false;

  var TABS = [
    { key: "home", label: "工作台", icon: "home" },
    { key: "invite", label: "获客", icon: "invite" },
    { key: "reconcile", label: "对账", icon: "reconcile" }
  ];
  var SUB_TABS = [
    { key: "home", label: "工作台", icon: "home" },
    { key: "invite", label: "邀请获客", icon: "invite" },
    { key: "ledger", label: "经营台账", icon: "chart" }
  ];

  /* 二级子 seg（合法路由同步登记） */
  var SUBCATS = {
    invite: [
      { key: "invite", label: "邀请码·海报" },
      { key: "invite-users", label: "邀请用户" },
      { key: "invite-stats", label: "转化分佣" }
    ],
    ledger: [
      { key: "ledger", label: "台账总览" },
      { key: "payments", label: "收款确认" },
      { key: "statement", label: "月度对账单" },
      { key: "tax", label: "税务说明" }
    ]
  };

  var PROV_EXTRA = ["subs", "share-config", "team"];
  var SUB_EXTRA = ["invite-users", "invite-stats", "payments", "statement"];

  function currentTab(isSub) {
    var key = (location.hash || "#/home").replace("#/", "").split("?")[0];
    var tabs = isSub ? SUB_TABS : TABS;
    var found = tabs.filter(function (t) { return t.key === key; })[0];
    if (found) return found.key;
    if (isSub) {
      if (SUBCATS.invite.some(function (s) { return s.key === key; })) return "invite";
      if (SUBCATS.ledger.some(function (s) { return s.key === key; })) return "ledger";
    }
    return tabs[0].key;
  }

  function isValidKey(key, isSub) {
    var tabs = isSub ? SUB_TABS : TABS;
    if (tabs.some(function (t) { return t.key === key; })) return true;
    if ((isSub ? SUB_EXTRA : PROV_EXTRA).indexOf(key) >= 0) return true;
    return false;
  }

  /* ---------------- 主题：仅初始化时同步一次（全局→SPA） ---------------- */
  function applyTheme(s) {
    if (themeApplied) {
      document.documentElement.setAttribute("data-theme", s.theme || "light");
      return;
    }
    try {
      var t = localStorage.getItem("engchain-theme") || "light";
      if (t !== s.theme) store.act("theme/set", { theme: t });
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {
      document.documentElement.setAttribute("data-theme", s.theme || "light");
    }
    themeApplied = true;
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (d && d.type === "theme" && d.theme) {
      store.act("theme/set", { theme: d.theme });
      document.documentElement.setAttribute("data-theme", d.theme);
    }
    if (d && d.type === "role" && d.role) {
      store.act("role/set", { role: d.role });
      render();
    }
    if (d && d.type === "scenario") {
      var s = window.V3.scenarios.seedByScenario(d.key);
      store.seed(s, d.key);
      render();
    }
  });

  /* ---------------- 导航栏 ---------------- */
  function renderTabs(ctx) {
    var s = ctx.s, isSub = ctx.isSub, d = ctx.d;
    var tabs = isSub ? SUB_TABS : TABS;
    var active = currentTab(isSub);
    var todo = store.todoOf(s);

    var badge = function (key) {
      var n = 0;
      if (isSub) {
        if (key === "ledger") n = todo.payments || 0;
        if (key === "home") n = todo.agreement || 0;
      } else {
        if (key === "reconcile") n = todo.reconcile || 0;
        if (key === "home") n = todo.subs || 0;
      }
      return n ? '<span class="v3-tab__dot">' + n + "</span>" : "";
    };

    return '<nav class="v3-subnav"><div class="sub-scroll">' + tabs.map(function (t) {
      return '<button class="sub-item' + (t.key === active ? " active" : "") +
        '" data-go="#/' + t.key + '">' +
        '<span class="sub-ico">' + ui.icon(t.icon, 18) + badge(t.key) + "</span>" +
        '<span class="sub-label">' + t.label + "</span></button>";
    }).join("") + "</div></nav>" + renderSubseg(ctx, active);
  }

  /* 二级子 seg */
  function renderSubseg(ctx, activeTab) {
    if (!ctx.isSub) return "";
    if (activeTab !== "invite" && activeTab !== "ledger") return "";
    var key = (location.hash || "").replace("#/", "").split("?")[0];
    var cats = SUBCATS[activeTab];
    var todo = store.todoOf(ctx.s);
    return '<div class="v3-subseg"><div class="sub-scroll">' + cats.map(function (c) {
      var n = c.key === "payments" ? (todo.payments || 0) : 0;
      return '<button class="v3-subseg__item' + (c.key === key ? " active" : "") + '" data-go="#/' + c.key + '">' +
        c.label + (n ? '<span class="v3-subseg__n">' + n + "</span>" : "") + "</button>";
    }).join("") + "</div></div>";
  }

  /* ---------------- 标题栏（齿轮进 v3 设置） ---------------- */
  function renderNavbar(ctx) {
    var isSub = ctx.isSub;
    var title = isSub ? "二级合作工作台" : "省级总代工作台";
    var todo = store.todoOf(ctx.s);
    return '<div class="v3-navbar">' +
      '<button class="v3-iconbtn v3-navbar__back" id="v3-nav-back" title="返回" aria-label="返回">' + ui.icon("back", 20) + "</button>" +
      '<div class="v3-navbar__t">' + title + "</div>" +
      '<button class="v3-iconbtn" id="v3-nav-msgs" title="消息中心">' + ui.icon("bell", 20) +
      (todo.total ? '<span class="v3-tab__dot v3-tab__dot--nav">' + todo.total + "</span>" : "") +
      "</button>" +
      '<button class="v3-iconbtn" id="v3-nav-settings" title="设置">' + ui.icon("settings", 20) + "</button>" +
      "</div>";
  }

  /* ---------------- 消息中心（navbar 弹窗，见 openMessagesSheet） ---------------- */

  /* ---------------- navbar 弹层：消息中心 / 设置（自下而上 bottom sheet） ---------------- */
  function setRow(ui, icon, label, act) {
    return '<button class="v3-row" data-act="' + act + '">' +
      '<span class="v3-row__main">' + ui.icon(icon, 17) + "<span>" + label + "</span></span>" +
      "</button>";
  }

  function openMessagesSheet(ctx) {
    var ui = ctx.ui, msgs = store.messagesOf(ctx.s);
    var body = '<div class="v3-sheet__sub">待办、协议、对账与系统通知统一在此查看</div>';
    if (!msgs.length) {
      body += '<div class="v3-sheet-empty">' + ui.emptyHtml("暂无新消息", "<div>当前没有待处理事项。</div>", "bell") + "</div>";
    } else {
      body += '<div class="v3-stack">' + msgs.map(function (m) {
        var click = m.to ? ' data-go="' + m.to + '" role="button"' : "";
        return '<div class="v3-msg' + (m.to ? " v3-msg--link" : "") + '"' + click + '>' +
          '<span class="v3-msg__ic v3-msg__ic--' + (m.type || "info") + '">' + ui.icon(m.icon || "bell", 16) + "</span>" +
          '<div class="v3-msg__bd"><div class="v3-msg__t">' + ui.esc(m.title) + "</div>" +
          '<div class="v3-msg__d">' + ui.esc(m.desc || "") + "</div>" +
          '<div class="v3-msg__time">' + ui.esc(m.time || "刚刚") + "</div></div>" +
          (m.to ? '<span class="v3-msg__go">' + ui.icon("chev", 14) + "</span>" : "") +
          "</div>";
      }).join("") + "</div>";
    }
    ui.openSheet({
      title: "消息中心",
      body: body,
      onMount: function (ov) {
        Array.prototype.forEach.call(ov.querySelectorAll("[data-go]"), function (b) {
          b.addEventListener("click", function () {
            ui.closeAll();
            ctx.go(b.getAttribute("data-go"));
          });
        });
      }
    });
  }

  function openSettingsSheet(ctx) {
    var ui = ctx.ui, isSub = ctx.isSub;
    var pages = isSub ? window.V3SUBPAGES : window.V3PAGES;
    var subs = (pages.infoSheets) || {};
    var body = '<div class="v3-sec-title">规则与说明</div><div class="v3-card v3-card--pad v3-list">' +
      (isSub
        ? setRow(ui, "file-text", "合作协议", "agree") +
          setRow(ui, "shield", "授权范围", "auth") +
          setRow(ui, "building", "合作信息", "info") +
          setRow(ui, "receipt", "税务说明", "tax")
        : setRow(ui, "badge", "资质证书", "cert") +
          setRow(ui, "shield", "角色与权限说明", "perm") +
          setRow(ui, "receipt", "税务说明", "tax") +
          setRow(ui, "bank", "结算口径", "rules")) + "</div>";
    ui.openSheet({
      title: "设置",
      body: body,
      onMount: function (ov) {
        ov.addEventListener("click", function (e) {
          var b = e.target.closest("[data-act]");
          if (!b) return;
          var act = b.getAttribute("data-act");
          if (subs[act]) { ui.closeAll(); subs[act](ctx); }
        });
      }
    });
  }

  /* ---------------- FAB（每页自描述；路由统一清除/重建，修复离场 bug） ---------------- */
  function clearFab() {
    var old = document.querySelector(".app-float-cta");
    if (old) old.remove();
  }
  function renderFab(items, ctx) {
    clearFab();
    if (!items || !items.length) return;
    var host = document.querySelector(".phone") || document.body;
    var bar = document.createElement("div");
    bar.className = "app-float-cta";
    bar.setAttribute("data-lg-glass", "");
    bar.innerHTML = items.map(function (it, i) {
      return (i ? '<span class="afc-sep">·</span>' : "") +
        '<button type="button" class="afc-item" data-fab="' + i + '">' + ui.icon(it.icon, 18) + "<span>" + it.label + "</span></button>";
    }).join("");
    Array.prototype.forEach.call(bar.querySelectorAll("[data-fab]"), function (b) {
      b.addEventListener("click", function () {
        var it = items[Number(b.getAttribute("data-fab"))];
        if (it && it.onClick) it.onClick(ctx);
      });
    });
    host.appendChild(bar);
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    clearFab();
    var s = store.getState();
    if (!s) {
      var sk = store.currentScenario();
      var seeded = window.V3.scenarios.seedByScenario(sk);
      s = store.seed(seeded, sk);
    }
    var isSub = s.mode === "sub";
    var d = s.state;
    applyTheme(s);

    var pages = isSub ? window.V3SUBPAGES : window.V3PAGES;

    var key = (location.hash || "#/home").replace("#/", "").split("?")[0];
    if (!isValidKey(key, isSub)) key = "home";
    var view = pages[key];
    if (!view) key = "home", view = pages[key];

    var ctx = {
      V3: window.V3, s: s, d: d, isSub: isSub,
      ui: ui,
      role: s.role,
      readonly: d.profile.status !== "active",
      isBoss: s.mode === "province" && s.role === "boss",
      isStaff: s.mode === "province" && s.role === "staff",
      isOwner: s.mode === "sub" && s.role === "sub_owner",
      canBoss: s.mode === "province" && s.role === "boss" && d.profile.status === "active",
      canOwner: s.mode === "sub" && s.role === "sub_owner" && d.profile.status === "active"
    };
    ctx.go = function (hash) {
      if (location.hash === hash) render(); else location.hash = hash;
    };
    ctx.fab = function (items) {
      /* 账号暂停/只读：不渲染任何写操作入口 FAB（含视觉层） */
      if (ctx.readonly) return;
      renderFab(items, ctx);
    };

    root = document.getElementById("ag-root");
    root.innerHTML =
      '<div class="v3-chrome">' + renderNavbar(ctx) + renderTabs(ctx) + "</div>" +
      '<div class="v3-page" id="v3-page"><div class="v3-page__in" id="v3-page-in">' +
      view.render(ctx) + "</div></div>";

    var pageEl = document.getElementById("v3-page-in");
    if (view.mount) view.mount(pageEl, ctx);
    if (view.fab) view.fab(ctx);

    /* 标题栏：返回 / 设置 / 消息 */
    var backBtn = document.getElementById("v3-nav-back");
    if (backBtn) backBtn.addEventListener("click", function () {
      if (history.length > 1) history.back();
      else location.href = "../../index.html";
    });
    var gear = document.getElementById("v3-nav-settings");
    if (gear) gear.addEventListener("click", function () { openSettingsSheet(ctx); });
    var bellBtn = document.getElementById("v3-nav-msgs");
    if (bellBtn) bellBtn.addEventListener("click", function () { openMessagesSheet(ctx); });

    /* 统一 data-go（弹层内连接除外） */
    Array.prototype.forEach.call(root.querySelectorAll("[data-go]"), function (b) {
      if (b.closest(".v3-overlay")) return;
      b.addEventListener("click", function () { ctx.go(b.getAttribute("data-go")); });
    });

    scrollTop();
  }

  function scrollTop() {
    try { window.scrollTo(0, 0); } catch (e) {}
    ["#ag-root", ".phone", ".v3-page"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.scrollTop = 0;
    });
  }

  function init() {
    store = window.V3.store;
    ui = window.V3.ui;
    var loaded = store.load();
    var scenarioKey = store.currentScenario();
    if (!loaded) {
      var seeded = window.V3.scenarios.seedByScenario(scenarioKey);
      store.seed(seeded, scenarioKey);
    }
    render();
    window.addEventListener("hashchange", render);
    /* 主题跨页实时联动：通用设置 / preview 写入 engchain-theme 后，已打开的工作台即时跟随（同源 storage 事件） */
    window.addEventListener("storage", function (e) {
      if (e.key !== "engchain-theme" || !e.newValue) return;
      try { store.act("theme/set", { theme: e.newValue }); } catch (err) {}
      document.documentElement.setAttribute("data-theme", e.newValue);
    });
  }

  window.V3 = window.V3 || {};
  window.V3.router = { render: render, init: init, currentTab: currentTab };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
