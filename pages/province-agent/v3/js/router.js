/* ============================================================
   router.js · hash 路由 / 外壳 / 主题 / 演示场景
   省代：底部 4 Tab；二级：顶部胶囊导航
   页面自注册到 window.V3PAGES / window.V3SUBPAGES
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

  function openDemoSheet() {
    var ui = window.V3.ui, st = window.V3.store.getState();
    var cur = st.scenario, isSub = st.mode === "sub";
    function scn(k, label, tag) {
      return '<button class="v3-scn ' + (cur === k || (k === "sub-dark" && st.theme === "dark") ? "on" : "") + '" style="margin:4px" data-scn="' + k + '">' +
        (tag ? tag + " · " : "") + label + "</button>";
    }
    var body;
    if (isSub) {
      body = '<div class="v3-xs v3-muted" style="margin-bottom:6px">二级企业视角</div>' +
        scn("sub-active", "正常态") + scn("sub-readonly", "暂停只读态") + scn("sub-dark", "暗色主题");
    } else {
      body = '<div class="v3-xs v3-muted" style="margin-bottom:6px">省代视角</div>' +
        scn("active", "正常态") + scn("suspended", "暂停只读态") + scn("empty", "空态") + scn("dark", "暗色主题");
    }
    var ov = ui.openSheet({
      title: "演示场景（Mock）",
      body: body +
        '<p class="v3-legal" style="margin-top:14px">所有金额均为 <b>模拟测算 · 非实际到账 · 不可提现</b>；' +
        '也可在控制台执行 <b>applyV3Scenario("suspended")</b> 等切换。</p>',
      onMount: function (wrap) {
        Array.prototype.forEach.call(wrap.querySelectorAll("[data-scn]"), function (b) {
          b.addEventListener("click", function () {
            window.V3.ui.closeAll();
            window.applyV3Scenario(b.getAttribute("data-scn"));
          });
        });
      }
    });
    return ov;
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

    var isTabbed = !isSub;
    document.body.classList.toggle("has-subnav", false);

    var header =
      '<div class="v3-hdr">' +
      (isSub ? "" : "") +
      '<div class="v3-hdr__title">' + V3.ui.esc(page.title || TITLES[key] || "工作台") + "</div>" +
      '<button class="v3-hdr__demo" id="v3-demo-btn" aria-label="演示场景">⚙</button></div>';

    var subnavHtml = "";
    if (isSub) {
      subnavHtml = '<div class="v3-subnav">' + SUBNAV.map(function (n) {
        return '<a href="#/' + n.key + '" class="' + (n.key === key ? "on" : "") + '">' + n.label + "</a>";
      }).join("") + "</div>";
    }

    var tabbarHtml = "";
    if (isTabbed) {
      var dotCount = d.payRegs1 ? d.payRegs1.filter(function (r) { return r.status === "pending_confirm" || r.status === "disputed"; }).length : 0;
      var l2c = d.payRegs2 ? d.payRegs2.filter(function (r) { return r.status === "pending_confirm"; }).length : 0;
      var todoN = dotCount + l2c + ((d.subApps || []).filter(function (a) { return a.status === "pending"; }).length);
      tabbarHtml =
        '<nav class="v3-tabbar">' + TABS.map(function (t) {
          var dot = (t.key === "reconcile" && (dotCount + l2c) > 0) ? '<span class="v3-tab__dot">' + (dotCount + l2c) + "</span>"
            : (t.key === "home" && todoN > 0) ? '<span class="v3-tab__dot">' + todoN + "</span>" : "";
          return '<a class="v3-tab ' + (t.key === key ? "on" : "") + '" href="#/' + t.key + '">' +
            dot + V3.ui.icon(t.icon, 22) + "<span>" + t.label + "</span></a>";
        }).join("") + "</nav>";
    }

    root.innerHTML = header + subnavHtml +
      '<div id="ag-view"><div class="v3-page ' + (isTabbed ? "" : "v3-page--notab") + '" id="v3-page-body"></div></div>' +
      tabbarHtml;

    var bodyEl = document.getElementById("v3-page-body");
    bodyEl.innerHTML = page.render(ctx);
    if (page.mount) page.mount(bodyEl, ctx);

    var demoBtn = document.getElementById("v3-demo-btn");
    if (demoBtn) demoBtn.addEventListener("click", openDemoSheet);

    root.scrollTop = 0;
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("v3:scenario", render);
  document.addEventListener("DOMContentLoaded", function () {
    if (window.V3.store.getState()) { render(); return; }
    // 初始化链（scenarios.js 从 localStorage 恢复 / 重新种子）若因脚本调度或刷新竞态
    // 在本轮 DOMContentLoaded 尚未把状态放进内存，则短暂等待，就绪后立即补渲染，
    // 避免任何启动 / 下拉刷新 / 多标签场景下命中一次性白屏。
    var n = 0;
    var t = setInterval(function () {
      if ((window.V3 && window.V3.store && window.V3.store.getState()) || ++n > 40) {
        clearInterval(t);
        if (window.V3 && window.V3.store && window.V3.store.getState()) render();
      }
    }, 50);
  });
  // 暴露给页面用
  window.V3.router = { render: render, go: go, currentKey: currentKey, openDemoSheet: openDemoSheet };
})();
