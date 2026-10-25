/* ============================================================
   router.js · hash 路由 / 页内分段导航 / 主题
   【视觉统一】不再自绘外壳（无 #device / 无自建顶栏 / 无自建 4-Tab）：
   页面外壳 = App demo .phone + .navbar（HTML 静态，common.js 注入状态栏/灵动岛/首页钮）；
   省代四视图 = 页内分段 .seg（App 语系）；二级 = .sub-tabs 横向分段 + 金色动画指示条。
   演示场景：不再提供页内 ⚙ 浮层，统一由 preview.html 演示切换器播种。
   ============================================================ */
(function () {
  "use strict";
  window.V3PAGES = {};
  window.V3SUBPAGES = {};

  var TABS = [
    { key: "home", label: "工作台", icon: "home" },
    { key: "invite", label: "邀请获客", icon: "invite" },
    { key: "reconcile", label: "对账留痕", icon: "reconcile" },
    { key: "me", label: "我的", icon: "me" }
  ];
  var SUBNAV = [
    { key: "home", label: "工作台" },
    { key: "invite", label: "邀请码·海报" },
    { key: "invite-users", label: "我的邀请用户" },
    { key: "invite-stats", label: "转化分佣统计" },
    { key: "payments", label: "收款确认" },
    { key: "statement", label: "月度对账单" },
    { key: "inbox", label: "待办" },
    { key: "ledger", label: "经营台账" }
  ];
  var TITLES = {
    home: "工作台", invite: "邀请获客", reconcile: "对账留痕", me: "我的",
    "invite-users": "我的邀请用户", "invite-stats": "转化与分佣", payments: "收款确认",
    statement: "月度对账单", inbox: "待办提醒", ledger: "经营台账"
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

  /* 二级分段指示条：跟随激活项滑动（对齐 home.html 算法） */
  function moveSubInd() {
    var sc = root.querySelector(".v3-subnav .sub-scroll");
    if (!sc) return;
    var ind = root.querySelector(".v3-subnav .sub-ind");
    var on = sc.querySelector(".sub-item.active");
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

  function render() {
    var V3 = window.V3, s = V3.store.getState();
    if (!s) return;
    applyTheme();
    var isSub = s.mode === "sub";
    var key = currentKey();
    var registry = isSub ? window.V3SUBPAGES : window.V3PAGES;
    var validKeys = isSub ? SUBNAV.map(function (x) { return x.key; }) : TABS.map(function (x) { return x.key; });
    if (validKeys.indexOf(key) < 0) { location.replace("#/home"); key = "home"; }

    var page = registry[key] || registry.home;
    var d = isSub ? s.sub : s.province;
    var readonly = isReadonly(d);
    var ctx = {
      state: s, d: d, ui: V3.ui, V3: V3, key: key,
      mode: s.mode, role: s.role, readonly: readonly,
      canBoss: !isSub && s.role === "boss" && !readonly,
      go: go
    };

    setNavTitle(page.title || TITLES[key] || (isSub ? "二级企业工作台" : "省级总代工作台"));

    /* 省代四视图：页内分段 Tab（App .seg 语系，sticky）
       ⚠ 不可用 <a href="#/key">：页面 base 为目录级，点击会按 base 解析成目录 URL 而整页换页；
       改用 <button> + location.hash 赋值（App demo 同款模式）。 */
    var segHtml = "";
    if (!isSub) {
      var dotCount = d.payRegs1 ? d.payRegs1.filter(function (r) { return r.status === "pending_confirm" || r.status === "disputed"; }).length : 0;
      var l2c = d.payRegs2 ? d.payRegs2.filter(function (r) { return r.status === "pending_confirm"; }).length : 0;
      var todoN = dotCount + l2c + ((d.subApps || []).filter(function (a) { return a.status === "pending"; }).length);
      segHtml = '<div class="v3-segbar"><div class="seg">' + TABS.map(function (t) {
        var dot = (t.key === "reconcile" && (dotCount + l2c) > 0) ? '<span class="v3-tab__dot">' + (dotCount + l2c) + "</span>"
          : (t.key === "home" && todoN > 0) ? '<span class="v3-tab__dot">' + todoN + "</span>" : "";
        return '<button type="button" class="seg-item ' + (t.key === key ? "active" : "") + '" data-key="' + t.key + '">' +
          "<span>" + t.label + "</span>" + dot + "</button>";
      }).join("") + "</div></div>";
    }

    /* 二级横向分段（App .sub-tabs 语系 + 金色动画指示条，sticky） */
    var subnavHtml = "";
    if (isSub) {
      subnavHtml = '<div class="v3-subnav"><div class="sub-tabs"><div class="sub-scroll">' +
        SUBNAV.map(function (n) {
          return '<button type="button" class="sub-item ' + (n.key === key ? "active" : "") + '" data-key="' + n.key + '">' +
            "<span>" + n.label + "</span></button>";
        }).join("") +
        '<span class="sub-ind" aria-hidden="true"></span>' +
        "</div></div></div>";
    }

    root.innerHTML = segHtml + subnavHtml +
      '<div id="ag-view"><div class="v3-page" id="v3-page-body"></div></div>';

    var bodyEl = document.getElementById("v3-page-body");
    bodyEl.innerHTML = page.render(ctx);
    if (page.mount) page.mount(bodyEl, ctx);

    /* 省代分段：点击切换 */
    var segSc = root.querySelector(".v3-segbar .seg");
    if (segSc) {
      segSc.addEventListener("click", function (e) {
        var btn = e.target.closest(".seg-item");
        if (!btn) return;
        root.querySelectorAll(".seg-item").forEach(function (x) { x.classList.toggle("active", x === btn); });
        go("#/" + btn.getAttribute("data-key"));
      });
    }

    /* 二级分段：点击切换 + 指示条 + 居中滚动 */
    var subSc = root.querySelector(".v3-subnav .sub-scroll");
    if (subSc) {
      subSc.addEventListener("click", function (e) {
        var btn = e.target.closest(".sub-item");
        if (!btn) return;
        root.querySelectorAll(".sub-item").forEach(function (x) { x.classList.toggle("active", x === btn); });
        moveSubInd();
        var targetLeft = btn.offsetLeft - (subSc.clientWidth - btn.offsetWidth) / 2;
        var maxLeft = Math.max(0, subSc.scrollWidth - subSc.clientWidth);
        subSc.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior: "smooth" });
        go("#/" + btn.getAttribute("data-key"));
      });
      moveSubInd();
    }

    root.scrollTop = 0;
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
})();
