/* ============================================================
   uni-reconcile-history.js · 历史对账记录（modes=['province','sub'] 双端共用）
   按月倒序直排全部 hist 记录（无 .card 包裹）；行本身只读不可点，
   仅右侧 .hist-go 按钮（chev-r 16px，44×44 透明热区）触发弹窗；
   省代身份顶部双类型 tab（与平台 / 与二级企业，样式复用 uni-subs 页
   .uls-tabs/.uls-tab，不新建）；页底居中悬浮「共 N 张」数量胶囊；
   弹窗内除既有键值 + 状态说明条外，附「明细对账文件卡」：
   按对账状态（pending/settled/overdue）拼装自包含 HTML 对账卷宗，
   Blob 真实生成 → 真实大小渲染 → 浏览器下载 → toast。
   2026-11-01：卷宗模板整体迁至 uni/js/uni-doc.js（window.UniDoc），
   本页与「对账中心 · 明细 → 对账单」共用同一份模板，不再各维护一套。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var ui = window.V3.ui;
  var Doc = window.UniDoc;
  var HIST_LB = Doc.HIST_LB, HIST_CLS = Doc.HIST_CLS;

  /* 本页纯查看 + 下载取证，不锁任何动作；各身份同权（查看与下载本就不区分角色）。
     2026-11-01 审计补齐：补 sub_staff 显式变体——此前二级员工回退 sub_admin 变体，
     身份胶囊与抬头文案按管理员显示。 */
  var STATE_VARIANTS = {
    admin: { label: "省级总代 · 管理员", locked: false, note: null },
    staff: { label: "省级总代 · 员工", locked: false, note: null },
    sub_admin: { label: "二级合作企业 · 管理员", locked: false, note: null },
    sub_staff: { label: "二级合作企业 · 员工", locked: false, note: null }
  };

  /* ---------- 弹窗：模板统一走 uni-doc.js（三处入口同一张单） ---------- */
  function openSheet(h, ctx, Uni) {
    /* 待对账项给「去对账」：二级 → 对账中心卷宗02；平台 → 默认卷宗01 */
    var more = h.state === "pending"
      ? {
        t: "去对账",
        on: function () { Uni.navTo(ctx.mode === "sub" ? "reconcile-sub.html" : (h.type === "sub" ? "reconcile.html?focus=2" : "reconcile.html")); }
      }
      : null;
    Doc.openSheet(ctx, h, Uni, { more: more });
  }

  /* ---------- 唯一渲染路径 ---------- */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var isProvince = ctx.mode === "province";

    /* nav-back 模式修正（UI 规范 2.2 建议，采纳）：sub 系返回 reconcile-sub.html */
    var back = document.querySelector(".nav-back");
    if (back && ctx.mode === "sub") back.setAttribute("href", "reconcile-sub.html");

    /* hist 按 month 倒序直排（同月内维持种子原序：province platform 在前 sub 在后） */
    var all = (ctx.s.hist || []).slice().sort(function (a, b) {
      return a.month === b.month ? 0 : (a.month < b.month ? 1 : -1);
    });

    /* 空态（empty / sub-empty 场景 hist 播种为 []） */
    if (!all.length) {
      el.innerHTML = Uni.emptyHtml("暂无历史对账记录",
        "月度账单出账后生成对账记录，届时可在此查看与下载明细卷宗。", "history");
      return;
    }

    /* 省代身份双类型 tab（与平台 / 与二级企业）：
       样式复用二级合作页顶部胶囊 bar（uni-subs.css .uls-tabs/.uls-tab），不新建样式；
       sub 域仅一种对账项，不渲染 tab。 */
    var TABS = [{ k: "platform", t: "与平台" }, { k: "sub", t: "与二级企业" }];
    var _tab = "platform";

    function tabsBar() {
      if (!isProvince) return "";
      return '<section class="uh-sec" style="margin-top:0"><div class="uls-tabs">' +
        TABS.map(function (x) {
          return '<button class="uls-tab' + (_tab === x.k ? " active" : "") + '" data-tab="' + x.k + '">' + x.t + "</button>";
        }).join("") + "</div></section>";
    }

    function render() {
      var hist = isProvince ? all.filter(function (h) { return h.type === _tab; }) : all;
      var body = "";

      if (!hist.length) {
        /* tab 过滤后空态 */
        var em = isProvince
          ? { t: "暂无" + (_tab === "platform" ? "与平台" : "与二级企业") + "对账记录", d: "该类型月度账单出账后生成对账记录，届时可在此查看与下载明细卷宗。" }
          : { t: "暂无历史对账记录", d: "月度账单出账后生成对账记录，届时可在此查看与下载明细卷宗。" };
        body = '<section class="uh-sec"><div class="card">' + Uni.emptyHtml(em.t, em.d, "history") + '</div></section>';
      } else {
        var rows = hist.map(function (h, i) {
          var tl = Doc.typeLabel(h);
          /* 省代模式顶部 tab 已标明类型，行内不再重复类型文案（仅金额）；sub 模式保留原标签 */
          var rowT = isProvince ? ui.money(h.amount) : ui.esc(tl) + " · " + ui.money(h.amount);
          return '<div class="uc-histrow" role="group" aria-label="' + ui.esc(h.month + " " + tl + " 对账记录") + '">' +
            '<span class="m">' + ui.esc(h.month) + '</span>' +
            '<span class="t">' + rowT + '</span>' +
            '<span class="uh-badge uh-badge--' + (HIST_CLS[h.state] || "mute") + '">' + (HIST_LB[h.state] || h.state) + '</span>' +
            '<button type="button" class="arr hist-go" data-hist-go="' + i + '" aria-label="查看 ' +
            ui.esc(h.month + " " + tl) + ' 对账记录' + '">' +
            ui.icon("chev-r", 16) + '</button>' +
            '</div>';
        }).join("");
        /* 无章节标题行；数量胶囊置页面窗口底部居中固定悬浮，列表底部预留 84px 防遮挡 */
        body = '<section class="uh-sec" style="padding-bottom:84px"><div class="uc-hist">' + rows + '</div></section>' +
          '<div class="uc-histcnt" role="status" aria-label="对账记录数量">共 <b>' + hist.length + '</b> 张</div>';
      }

      el.innerHTML = tabsBar() + body;

      /* 事件绑定：tab 切换（省代双类型） */
      el.querySelectorAll("[data-tab]").forEach(function (n) {
        n.addEventListener("click", function () {
          _tab = n.getAttribute("data-tab");
          render();
        });
      });

      /* 事件绑定：行是 div 无点击行为；仅 .hist-go 按钮可点（弹窗） */
      el.querySelectorAll("[data-hist-go]").forEach(function (n) {
        n.addEventListener("click", function () {
          openSheet(hist[Number(n.getAttribute("data-hist-go"))], ctx, Uni);
        });
      });
    }

    render();
  }

  window.Uni.register({
    view: "uni-reconcile-history",
    route: "reconcile-history.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
