/* ============================================================
   uni-messages.js · 消息中心（E004 · 独立页种子 2）
   三类聚合同一列项模板（参考「会话列表-通知」n-item）：
   待办派生项 → 点击复用工作台待办操作闭环（uni-todo-ops.js）；
   系统消息 / 动作留痕 → 点击打开详情弹窗。
   数据全部来自 store.messagesOf（单源派生，待办项带 key 透传）。
   组件视觉全部为系统类；列项样式见 css/pages/uni-messages.css。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var SECTIONS = [
    { key: "todo", title: "待办事项" },
    { key: "state", title: "系统消息" },
    { key: "log", title: "动作留痕" }
  ];

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) { return sectionsOf(ctx); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "合作申请、协议与对账动态将聚合在这里" } },
      lockedNote: "账号暂停期间仅接收状态提示"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) { return sectionsOf(ctx); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "与本人渠道相关的动态将出现在这里" } },
      lockedNote: "账号暂停期间仅接收状态提示"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) { return sectionsOf(ctx); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "与上级省代的对账、协议动态将聚合在这里" } },
      lockedNote: "合作暂停期间仅接收状态提示"
    }
  };

  /* 数据映射：messagesOf 全量 → 按 source 分桶（纯数据，同模板渲染） */
  function sectionsOf(ctx) {
    var msgs = store.messagesOf(store.getState());
    var buckets = { todo: [], state: [], log: [] };
    msgs.forEach(function (m) {
      var b = buckets[m.source] || buckets.log;
      b.push(m);
    });
    return buckets;
  }

  /* 列项尾部入口文案：动作留痕 → 去查看；待办/状态 → 前往处理 */
  function goLabel(m) { return m.source === "log" ? "去查看" : "前往处理"; }

  /* 列项（参考「会话列表-通知」n-item：分类胶囊 + 标题 + 右上时间 / 描述 + 右侧操作入口） */
  function itemHtml(m, idx) {
    var cat = Uni.catOf(m.type);
    return '<div class="nm-item" data-msg="' + idx + '">' +
      '<div class="nm-head"><span class="nm-cat" ' + cat.style + '>' + cat.t + '</span>' +
      '<span class="nm-title">' + ui.esc(m.title) + '</span>' +
      (m.time ? '<span class="nm-time">' + ui.esc(m.time) + '</span>' : '') + '</div>' +
      '<div class="nm-body"><span class="nm-body__tx">' + ui.esc(m.desc || "") + '</span>' +
      (m.to ? '<span class="nm-go">' + ui.esc(goLabel(m)) + ' ' + ui.icon("chev", 13) + '</span>' : '') +
      '</div></div>';
  }

  /* 详情弹窗（系统消息 / 动作留痕）：分类 + 时间头 / 大标题 / 全文 / 动作按钮 */
  function detailSheet(m, Uni) {
    var cat = Uni.catOf(m.type);
    var foot = m.to
      ? [{ t: "关闭", kind: "ghost" },
         { t: goLabel(m), kind: "primary", onClick: function (sh) { sh.close(); Uni.navTo(m.to); } }]
      : [{ t: "关闭", kind: "primary" }];
    Uni.sheet({
      title: "消息详情",
      body:
        '<div class="nm-detail-head"><span class="nm-cat" ' + cat.style + '>' + cat.t + '</span>' +
        (m.time ? '<span class="nm-detail-time">' + ui.esc(m.time) + '</span>' : '') + '</div>' +
        '<div class="nm-detail-title">' + ui.esc(m.title) + '</div>' +
        '<div class="nm-detail-body">' + ui.esc(m.desc || "") + '</div>',
      footer: foot
    });
  }

  /* 待办消息点击 → 复用工作台首页同一套待办操作闭环（uni-todo-ops.js） */
  function openTodoOps(ctx, m, Uni) {
    if (!window.UniTodoOps) { detailSheet(m, Uni); return; }
    window.UniTodoOps.open(ctx, { key: m.key, id: m.id, t: m.title, s: m.desc }, Uni);
  }

  /* 唯一渲染路径：顶部分页bar（待办事项/系统消息/动作留痕）→ 当前分类全量内容 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var renderMsgs = [];

    /* 初始分类：URL ?tab= 优先；否则首个有内容的分类；兜底"待办事项" */
    var order = ["todo", "state", "log"];
    var tabParam = "";
    try { tabParam = new window.URLSearchParams(window.location.search).get("tab") || ""; } catch (e) {}
    var cur = order.indexOf(tabParam) > -1 ? tabParam : "";
    if (!cur) {
      for (var i = 0; i < order.length; i++) if (vm[order[i]].length) { cur = order[i]; break; }
    }
    if (!cur) cur = order[0];

    var EMPTY_TXT = {
      todo: { title: "暂无待办事项", desc: "需要处理的事项将出现在这里" },
      state: { title: "暂无系统消息", desc: "平台状态提示将出现在这里" },
      log: { title: "暂无动作留痕", desc: "你的操作记录将留痕在这里" }
    };

    /* 分页bar：系统 .seg 分段控件（既有样式） */
    function segHtml() {
      return '<section class="uh-sec"><div class="seg" data-tabs>' + SECTIONS.map(function (s) {
        return '<button class="seg-item' + (s.key === cur ? " active" : "") + '" data-tab="' + s.key + '">' + s.title + '</button>';
      }).join("") + '</div></section>';
    }

    /* 当前分类全部内容（列项模板不变） */
    function listHtml() {
      renderMsgs = [];
      var items = vm[cur];
      if (!items.length) {
        return '<div data-msgs><section class="uh-sec">' +
          Uni.emptyHtml(EMPTY_TXT[cur].title, EMPTY_TXT[cur].desc, "tray") + "</section></div>";
      }
      var body = items.map(function (m) {
        var idx = renderMsgs.length;
        renderMsgs.push(m);
        return itemHtml(m, idx);
      }).join("");
      return '<div data-msgs><section class="uh-sec"><div class="nm-list">' + body + "</div></section></div>";
    }

    el.innerHTML =
      segHtml() +
      (ctx.readonly ? '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + '<span>' + ui.esc(V.lockedNote) + '</span></div></section>' : "") +
      listHtml();

    /* 分页bar 切换：重渲染当前分类列表，并同步 URL（?tab=） */
    var tabs = el.querySelector("[data-tabs]");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      cur = b.getAttribute("data-tab");
      tabs.querySelectorAll("[data-tab]").forEach(function (x) {
        x.classList.toggle("active", x.getAttribute("data-tab") === cur);
      });
      el.querySelectorAll("[data-msgs]").forEach(function (n) { n.outerHTML = listHtml(); });
      bindMsgs();
      try { window.history.replaceState(null, "", "messages.html?tab=" + cur); } catch (err) {}
    });

    function bindMsgs() {
      el.querySelectorAll("[data-msg]").forEach(function (n) {
        n.addEventListener("click", function () {
          var m = renderMsgs[Number(n.getAttribute("data-msg"))];
          if (!m) return;
          if (m.source === "todo" && m.key) openTodoOps(ctx, m, Uni);
          else detailSheet(m, Uni);
        });
      });
    }
    bindMsgs();
  }

  window.Uni.register({
    view: "uni-messages",
    route: "messages.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
