/* ============================================================
   uni-messages.js · 消息中心（E004 · 独立页种子 2）
   三类聚合同一列项模板（参考「会话列表-通知」n-item）：
   ① 待办事项 → 点击复用工作台待办操作闭环（uni-todo-ops.js）；
   ② 系统消息 → 业务通知 + 平台公告，点击展开全文并记已读；
   ③ 动作留痕 → 省内免费解锁执行记录：月度统计卡 + 月份分档 + 明细，
      点击自下而上弹窗查看单条完整留痕。
   数据源：store.messagesOf（待办 / 系统消息）与 store.freeActsOf（动作留痕）。
   动作留痕是独立事件源——审计流水若并进 messagesOf，底部导航的消息角标会被撑爆。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支；
   可见范围由各变体自带的 scope 字段（all / self / own）在 sectionsOf 里一次性收口，
   页面其余位置不再做身份判断。
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
      scope: "all",
      data: function (ctx) { return sectionsOf(ctx, "all"); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "合作申请、协议与对账动态将聚合在这里" } },
      lockedNote: "账号暂停期间仅接收状态提示"
    },
    staff: {
      label: "省级总代 · 员工",
      scope: "self",
      data: function (ctx) { return sectionsOf(ctx, "self"); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "与本人渠道相关的动态将出现在这里" } },
      lockedNote: "账号暂停期间仅接收状态提示"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      scope: "own",
      data: function (ctx) { return sectionsOf(ctx, "own"); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "与上级省代的对账、协议动态将聚合在这里" } },
      lockedNote: "合作暂停期间仅接收状态提示"
    },
    /* 2026-11-01 审计补齐：二级员工此前无页内变体，回退复用 sub_admin 变体，
       会读到全企业的付款/对账通知。此处给与省代员工同构的 self 口径。 */
    sub_staff: {
      label: "二级合作企业 · 员工",
      scope: "self",
      data: function (ctx) { return sectionsOf(ctx, "self"); },
      entries: [],
      perms: {},
      badges: {},
      empty: { all: { title: "暂无新消息", desc: "与本人渠道相关的动态将出现在这里" } },
      lockedNote: "合作暂停期间仅接收状态提示"
    }
  };

  /* ---------------- 已读状态（UI.state 持久化，跨页 / 刷新保留） ---------------- */
  function readIds() {
    try {
      var r = window.UI.state.get().msgRead;
      return Object.prototype.toString.call(r) === "[object Array]" ? r : [];
    } catch (e) { return []; }
  }
  function markRead(ids) {
    var add = (ids || []).filter(function (x) { return !!x; });
    if (!add.length) return;
    try {
      var cur = readIds().slice();
      add.forEach(function (id) { if (cur.indexOf(id) < 0) cur.push(id); });
      window.UI.state.set({ msgRead: cur.slice(-300) });
    } catch (e) {}
  }

  /* ---------------- 数据映射 ---------------- */
  /* 动作留痕可见范围：all = 省代成员 + 全部下级二级企业；self = 仅本人；
     own = 仅本企业成员（二级企业视角）。范围来自变体配置，函数本身无身份分支。 */
  function actsFor(ctx, scope) {
    var all = store.freeActsOf(store.getState());
    if (scope === "self") return all.filter(function (a) { return a.actor === ctx.staffName; });
    if (scope === "own") return all.filter(function (a) { return a.org === ctx.s.profile.name; });
    return all;
  }

  /* 员工口径（省代员工 / 二级员工）：不下发付款、对账这类带企业级金额的通知。
     与工作台首页动态流 uni-home.js feedForStaff 保持同一口径，避免两处口径打架。 */
  function isStaffScope(ctx) {
    return ctx.identity === "staff" || ctx.identity === "sub_staff";
  }

  function sectionsOf(ctx, scope) {
    var msgs = store.messagesOf(store.getState());
    var buckets = { todo: [], state: [], log: actsFor(ctx, scope) };
    var staff = isStaffScope(ctx);
    msgs.forEach(function (m) {
      if (staff && (m.tag === "付款" || m.tag === "对账")) return;
      if (m.source === "todo") buckets.todo.push(m);
      else buckets.state.push(m);
    });
    return buckets;
  }

  /* ---------------- 通用格式化 ---------------- */
  function pad2(n) { return ("0" + n).slice(-2); }
  function curMonth() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
  function prevMonth() {
    var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  function monthLabel(m) {
    if (m === curMonth()) return "本月";
    if (m === prevMonth()) return "上月";
    return Number(m.slice(5, 7)) + "月";
  }
  /* "YYYY-MM-DD HH:MM" → 今天 14:30 / 昨天 16:40 / 3天前 09:12 / 10-18 09:12 */
  function friendly(t) {
    if (!t) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?$/.exec(t);
    if (!m) return t;
    var hm = m[4] || "";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var diff = Math.round((today - d) / 86400000);
    if (diff === 0) return "今天" + (hm ? " " + hm : "");
    if (diff === 1) return "昨天" + (hm ? " " + hm : "");
    if (diff > 1 && diff < 7) return diff + "天前" + (hm ? " " + hm : "");
    var md = m[2] + "-" + m[3];
    return (m[1] === String(new Date().getFullYear()) ? md : m[1] + "-" + md) + (hm ? " " + hm : "");
  }
  function money(n) { return "¥" + Number(n || 0).toLocaleString("zh-CN"); }

  /* 月份区间：从最早一条到「最晚一条 / 当月」的较晚者，保证跨月后本月分档仍在 */
  function monthKeys(list) {
    if (!list.length) return [curMonth()];
    var min = list[list.length - 1].month, max = list[0].month;
    var cm = curMonth();
    if (cm > max) max = cm;
    var out = [], y = Number(min.slice(0, 4)), mo = Number(min.slice(5, 7));
    var ey = Number(max.slice(0, 4)), em = Number(max.slice(5, 7));
    var guard = 0;
    while ((y < ey || (y === ey && mo <= em)) && guard++ < 240) {
      out.push(y + "-" + pad2(mo));
      mo++; if (mo > 12) { mo = 1; y++; }
    }
    return out;
  }

  /* ---------------- 列表项模板 ---------------- */
  function todoItemHtml(m, idx) {
    var cat = Uni.catOf(m.type);
    return '<div class="nm-item" data-msg="' + idx + '">' +
      '<div class="nm-head"><span class="nm-cat" ' + cat.style + '>' + cat.t + '</span>' +
      '<span class="nm-title">' + ui.esc(m.title) + '</span>' +
      (m.time ? '<span class="nm-time">' + ui.esc(m.time) + '</span>' : '') + '</div>' +
      '<div class="nm-body"><span class="nm-body__tx">' + ui.esc(m.desc || "") + '</span>' +
      (m.to ? '<span class="nm-go">前往处理 ' + ui.icon("chev", 13) + '</span>' : '') +
      '</div></div>';
  }

  function stateItemHtml(m, idx, unread) {
    var cat = Uni.catOf(m.type);
    return '<div class="nm-item' + (unread ? " is-unread" : "") + '" data-msg="' + idx + '">' +
      '<div class="nm-head">' +
      (unread ? '<i class="nm-dot" aria-hidden="true"></i>' : '') +
      '<span class="nm-cat" ' + cat.style + '>' + ui.esc(m.tag || cat.t) + '</span>' +
      '<span class="nm-title">' + ui.esc(m.title) + '</span>' +
      (m.time ? '<span class="nm-time">' + ui.esc(friendly(m.time)) + '</span>' : '') + '</div>' +
      '<div class="nm-body"><span class="nm-body__tx">' + ui.esc(m.desc || "") + '</span>' +
      '<span class="nm-go">详情 ' + ui.icon("chev", 13) + '</span></div></div>';
  }

  function actItemHtml(a, idx) {
    var p = a.layer === "省代";
    return '<div class="nm-item" data-act="' + idx + '">' +
      '<div class="nm-head">' +
      '<span class="nm-org' + (p ? " nm-org--p" : "") + '">' + ui.esc(p ? "省代" : a.orgShort) + '</span>' +
      '<span class="nm-title">' + ui.esc(a.actor + " · " + a.item) + '</span>' +
      '<span class="nm-time">' + ui.esc(friendly(a.at)) + '</span></div>' +
      '<div class="nm-body"><span class="nm-body__tx">' +
      ui.esc("「" + a.target + "」 · 折抵 " + money(a.price)) + '</span>' +
      '<span class="nm-go">详情 ' + ui.icon("chev", 13) + '</span></div></div>';
  }

  /* ---------------- 动作留痕：月度统计卡 ---------------- */
  function statsHtml(list, allScope, scopeMonth, months, scope) {
    var n = list.length;
    var moneySum = 0, actors = {}, orgs = {};
    list.forEach(function (a) {
      moneySum += Number(a.price) || 0;
      actors[a.actor] = 1;
      if (a.layer !== "省代") orgs[a.orgShort] = 1;
    });
    /* 趋势柱一律用「当前可见范围」的完整记录集，不能用全量 —— 否则员工 /
       二级企业视角会在柱状图里读出别家企业的月度次数 */
    var byMonth = {};
    months.forEach(function (m) { byMonth[m] = 0; });
    allScope.forEach(function (a) {
      if (byMonth[a.month] != null) byMonth[a.month] += 1;
    });
    var max = 1;
    months.forEach(function (m) { if (byMonth[m] > max) max = byMonth[m]; });

    var bars = months.map(function (m) {
      var c = byMonth[m];
      var h = Math.max(8, Math.round(c / max * 100));
      return '<button type="button" class="nm-bar' + (m === scopeMonth ? " is-on" : "") +
        '" data-month="' + m + '" aria-label="' + monthLabel(m) + ' ' + c + ' 次">' +
        '<span class="nm-bar__v">' + (c || "") + '</span>' +
        '<span class="nm-bar__col"><i style="height:' + (c ? h : 0) + '%"></i></span>' +
        '<span class="nm-bar__m">' + monthLabel(m) + '</span></button>';
    }).join("");

    return '<section class="uh-sec"><div class="nm-stats">' +
      '<div class="nm-stats__head"><span class="nm-stats__lbl">省内免费解锁</span>' +
      '<span class="nm-stats__scope">' + (scopeMonth ? monthLabel(scopeMonth) + " · " + scopeMonth : "全部记录") + '</span></div>' +
      '<div class="nm-metrics">' +
      '<div class="nm-metric"><b class="nm-num">' + n + '</b><span>解锁次数</span></div>' +
      '<div class="nm-metric"><b class="nm-num">' + money(moneySum) + '</b><span>折抵金额</span></div>' +
      '<div class="nm-metric"><b class="nm-num">' + Object.keys(actors).length + '</b><span>执行成员</span></div>' +
      '<div class="nm-metric"><b class="nm-num">' + Object.keys(orgs).length + '</b><span>' +
      ui.esc(scope === "own" ? "纳入企业" : "覆盖二级企业") + '</span></div>' +
      '</div>' +
      '<div class="nm-trend">' + bars + '</div>' +
      '<div class="nm-stats__foot">' + ui.icon("info", 13) +
      '<span>省内授权范围内信息解锁免费，原价仅计入折抵额，不产生实际扣费</span></div>' +
      '</div></section>';
  }

  /* ---------------- 详情：动作留痕（自下而上弹窗） ---------------- */
  function actSheet(a, Uni) {
    var p = a.layer === "省代";
    var kv = function (k, v) {
      return '<div class="uh-kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    };
    var rows =
      kv("执行人", ui.esc(a.actor)) +
      kv("身份", ui.esc(a.role)) +
      kv("所属企业", ui.esc(a.org)) +
      kv("企业层级", ui.esc(a.layer)) +
      kv("执行时间", ui.esc(a.at)) +
      kv("解锁项", ui.esc(a.item)) +
      kv("目标企业", ui.esc(a.target)) +
      kv("所在地", ui.esc(a.city)) +
      kv("原价", ui.esc(money(a.price))) +
      kv("本次实付", '<span class="nm-free">¥0</span>') +
      kv("折抵金额", ui.esc(money(a.price) + "（省内免费）")) +
      kv("解锁入口", ui.esc("APP · " + a.via)) +
      kv("记录编号", '<span class="nm-id">' + ui.esc(a.id) + "</span>");

    Uni.sheet({
      title: "免费解锁详情",
      body:
        '<div class="nm-detail-head"><span class="nm-org' + (p ? " nm-org--p" : "") + '">' +
        ui.esc(p ? "省代成员" : "二级企业成员") + '</span>' +
        '<span class="nm-detail-time">' + ui.esc(friendly(a.at)) + '</span></div>' +
        '<div class="nm-detail-title">' + ui.esc(a.item + " · " + a.target) + '</div>' +
        '<div class="nm-subline">本次解锁在四川省授权范围内，免收原价 ' + ui.esc(money(a.price)) + '</div>' +
        '<div class="nm-kvlist">' + rows + '</div>' +
        '<div class="nm-note">' + ui.icon("info", 14) +
        '<span>该记录由 APP 实时写入，不可编辑。省内免费解锁不计入成员积分消耗；' +
        '超出四川省授权范围或解锁非免费项时，仍按原价扣费并单独留痕。</span></div>',
      footer: [{ t: "关闭", kind: "ghost" }]
    });
  }

  /* ---------------- 详情：系统消息 / 待办兜底 ---------------- */
  function detailSheet(m, Uni) {
    var cat = Uni.catOf(m.type);
    var foot = m.to
      ? [{ t: "关闭", kind: "ghost" },
         { t: "前往处理", kind: "primary", onClick: function (sh) { sh.close(); Uni.navTo(m.to); } }]
      : [{ t: "关闭", kind: "primary" }];
    var body = m.body && m.body !== m.desc ? m.body : (m.desc || "暂无更多内容。");
    Uni.sheet({
      title: "消息详情",
      body:
        '<div class="nm-detail-head"><span class="nm-cat" ' + cat.style + '>' +
        ui.esc(m.tag || cat.t) + '</span>' +
        (m.time ? '<span class="nm-detail-time">' + ui.esc(friendly(m.time)) + '</span>' : '') + '</div>' +
        '<div class="nm-detail-title">' + ui.esc(m.title) + '</div>' +
        '<div class="nm-detail-body">' + ui.esc(body) + '</div>' +
        (m.id ? '<div class="nm-meta">编号 ' + ui.esc(m.id) + '</div>' : ""),
      footer: foot
    });
  }

  /* 待办消息点击 → 复用工作台首页同一套待办操作闭环（uni-todo-ops.js） */
  function openTodoOps(ctx, m, Uni) {
    if (!window.UniTodoOps) { detailSheet(m, Uni); return; }
    window.UniTodoOps.open(ctx, { key: m.key, id: m.id, t: m.title, s: m.desc }, Uni);
  }

  /* ---------------- 页面 ---------------- */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var order = ["todo", "state", "log"];
    var tabParam = "";
    try { tabParam = new window.URLSearchParams(window.location.search).get("tab") || ""; } catch (e) {}
    var cur = order.indexOf(tabParam) > -1 ? tabParam : "";
    if (!cur) {
      for (var i = 0; i < order.length; i++) if (vm[order[i]].length) { cur = order[i]; break; }
    }
    if (!cur) cur = order[0];

    var month = "";          // "" = 全部；否则 "YYYY-MM"
    var READ = readIds();
    var renderMsgs = [];
    var renderActs = [];

    var EMPTY_TXT = {
      todo: { title: "暂无待办事项", desc: "需要处理的事项将出现在这里" },
      state: { title: "暂无系统消息", desc: "平台公告、对账与合作通知将出现在这里" },
      log: { title: "暂无动作留痕", desc: "成员在 APP 内免费解锁信息的记录会留在这里" }
    };

    function isUnread(m) {
      return m.source === "state" && m.icon !== "lock" && READ.indexOf(m.id) < 0;
    }
    function unreadCount() {
      return vm.state.filter(isUnread).length;
    }

    /* --- 分页 bar（带计数：待办条数 / 未读条数 / 留痕条数） --- */
    function segHtml() {
      var counts = { todo: vm.todo.length, state: unreadCount(), log: vm.log.length };
      return '<section class="uh-sec"><div class="seg" data-tabs>' + SECTIONS.map(function (s) {
        var c = counts[s.key];
        return '<button class="seg-item' + (s.key === cur ? " active" : "") + '" data-tab="' + s.key + '">' +
          s.title + (c ? '<span class="nm-tabn">' + (c > 99 ? "99+" : c) + '</span>' : '') + '</button>';
      }).join("") + '</div></section>';
    }

    function emptyPane(key) {
      return '<section class="uh-sec">' + Uni.emptyHtml(EMPTY_TXT[key].title, EMPTY_TXT[key].desc, "tray") + "</section>";
    }

    /* --- 待办 --- */
    function todoPaneHtml() {
      if (!vm.todo.length) return '<div data-msgs>' + emptyPane("todo") + "</div>";
      renderMsgs = [];
      var body = vm.todo.map(function (m) {
        var idx = renderMsgs.length;
        renderMsgs.push(m);
        return todoItemHtml(m, idx);
      }).join("");
      return '<div data-msgs><section class="uh-sec"><div class="nm-list">' + body + "</div></section></div>";
    }

    /* --- 系统消息 --- */
    function statePaneHtml() {
      if (!vm.state.length) return '<div data-msgs>' + emptyPane("state") + "</div>";
      renderMsgs = [];
      var unread = unreadCount();
      var body = vm.state.map(function (m) {
        var idx = renderMsgs.length;
        renderMsgs.push(m);
        return stateItemHtml(m, idx, isUnread(m));
      }).join("");
      var head = unread
        ? '<div class="nm-secthead"><span>未读 ' + unread + ' 条</span>' +
          '<button type="button" class="nm-readall" data-readall>全部已读</button></div>'
        : "";
      return '<div data-msgs><section class="uh-sec">' + head +
        '<div class="nm-list">' + body + "</div></section></div>";
    }

    /* --- 动作留痕 --- */
    function logPaneHtml() {
      if (!vm.log.length) return '<div data-acts>' + emptyPane("log") + "</div>";
      var months = monthKeys(vm.log);
      if (month && months.indexOf(month) < 0) month = "";
      var list = month ? vm.log.filter(function (a) { return a.month === month; }) : vm.log;

      var chips = '<div class="nm-chips">' +
        '<button type="button" class="nm-chip' + (month ? "" : " is-on") + '" data-month="">全部</button>' +
        months.map(function (m) {
          return '<button type="button" class="nm-chip' + (m === month ? " is-on" : "") +
            '" data-month="' + m + '">' + monthLabel(m) + "</button>";
        }).join("") + "</div>";

      renderActs = [];
      var rows = list.map(function (a) {
        var idx = renderActs.length;
        renderActs.push(a);
        return actItemHtml(a, idx);
      }).join("");

      return '<div data-acts>' +
        statsHtml(list, vm.log, month, months, V.scope) +
        '<section class="uh-sec">' + chips +
        (list.length
          ? '<div class="nm-list">' + rows + "</div>"
          : '<div class="nm-listempty">' + monthLabel(month) + "暂无解锁记录</div>") +
        "</section></div>";
    }

    function paneHtml() {
      if (cur === "todo") return todoPaneHtml();
      if (cur === "state") return statePaneHtml();
      return logPaneHtml();
    }

    /* 内容区重渲染 */
    function renderPane() {
      var pane = el.querySelector("[data-pane]");
      if (!pane) return;
      pane.innerHTML = paneHtml();
      var seg = el.querySelector("[data-tabs]");
      if (seg) seg.outerHTML = segHtml();
    }
    function renderPage() {
      var top = el.scrollTop;
      el.innerHTML =
        segHtml() +
        (ctx.readonly ? '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) +
          "<span>" + ui.esc(V.lockedNote) + "</span></div></section>" : "") +
        '<div data-pane></div>';
      el.querySelector("[data-pane]").innerHTML = paneHtml();
      el.scrollTop = top;
    }

    /* 交互一律事件委托挂在 el 上：innerHTML / outerHTML 重渲染都不会丢监听。
       mount 可能因切换身份被再次调用，故先摘掉上一次挂的同一个 handler 再挂新的，
       否则会叠加出多份闭包（旧闭包里的 vm / cur 已经过期）。 */
    function onClick(e) {
      var tab = e.target.closest("[data-tab]");
      if (tab) {
        if (tab.getAttribute("data-tab") === cur) return;
        cur = tab.getAttribute("data-tab");
        renderPage();
        el.scrollTop = 0;
        try { window.history.replaceState(null, "", "messages.html?tab=" + cur); } catch (err) {}
        return;
      }
      var mch = e.target.closest("[data-month]");
      if (mch) {
        var v = mch.getAttribute("data-month");
        if (v === month) return;
        month = v;
        renderPane();
        return;
      }
      var ra = e.target.closest("[data-readall]");
      if (ra) {
        markRead(vm.state.map(function (m) { return m.id; }));
        READ = readIds();
        Uni.toast("已全部标记为已读");
        renderPage();
        return;
      }
      var mi = e.target.closest("[data-msg]");
      if (mi) {
        var m = renderMsgs[Number(mi.getAttribute("data-msg"))];
        if (!m) return;
        if (m.source === "todo" && m.key) { openTodoOps(ctx, m, Uni); return; }
        if (isUnread(m)) { markRead([m.id]); READ = readIds(); }
        detailSheet(m, Uni);
        if (cur === "state") renderPane();
        return;
      }
      var ai = e.target.closest("[data-act]");
      if (ai) {
        var a = renderActs[Number(ai.getAttribute("data-act"))];
        if (a) actSheet(a, Uni);
      }
    }
    if (el.__nmHandler) el.removeEventListener("click", el.__nmHandler);
    el.__nmHandler = onClick;
    el.addEventListener("click", onClick);

    renderPage();
  }

  window.Uni.register({
    view: "uni-messages",
    route: "messages.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
