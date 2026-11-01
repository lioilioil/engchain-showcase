/* ============================================================
   uni-agreement.js · 合作协议 · 省代协议中心 / 二级签署台
   ------------------------------------------------------------
   两种应用场景，一套页面两种形态（不是同一张卡换文案）：

   · 省代（admin / staff / legal_rep）= 协议中心（台账制）
     名下 N 家二级企业各有一份协议，核心问题是"哪几份还没签、该催谁"。
     形态：台账统计（待签 / 已签 / 拒签）+ 按状态分组的协议行 + 单份详情。
     ?sub=<企业 id> 直达某一家（从二级合作档案进来），不带参数是台账。

   · 二级（sub_admin / sub_staff / sub_legal）= 签署台（单份制）
     只有一份与上级省代的协议，核心问题是"我签了没、什么时候到期"。
     形态：状态抬头 + 有效期进度 + 流转时间线 + 双方主体 + 全文条款 + 签署底栏。

   数据：省代侧读 state.subs[].agreement（每家一条），二级侧读 state.agreement。
   协议正文由后台富文本编辑器维护（Word 粘贴），每家一条、随协议存档；
   前端统一走 Uni.agreementBody() 取数 + Uni.richDoc() 排版，各展示位共用一套。

   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;
  var TODAY = (store && store.TODAY) || "2026-10-27";
  var FIELD_STYLE = "width:100%;box-sizing:border-box;min-height:88px;padding:10px 12px;border-radius:var(--r-m);" +
    "border:1px solid var(--line);background:var(--bg-card);color:var(--text-1);" +
    "font-size:var(--fs-base);font-family:inherit;resize:none";

  /* 协议状态字典。pending 在省代侧是「待对方签署」，二级侧的「待我签署」走 pending_mine */
  var ST = {
    signed: { t: "已签署", c: "ok", s: "协议已生效，双方按约定比例结算" },
    pending: { t: "待对方签署", c: "wait", s: "已发起，等待二级企业查阅并签署" },
    pending_mine: { t: "待我方签署", c: "info", s: "上级省代已发起，等待本企业签署" },
    rejected: { t: "已拒签", c: "bad", s: "乙方已拒签，修订条款后需重新发起" }
  };
  function stOf(s) { return ST[s] || { t: "未生成", c: "mute", s: "" }; }
  /* 协议正文：省代侧的协议对象不带双方主体，用页面上已装配好的 side 补进去 */
  function bodyOf(ag, side, ratio) {
    return window.Uni.agreementBody(ag, {
      jia: (side && side.jia) || {}, yi: (side && side.yi) || {}, ratio: ratio
    });
  }
  function shortName(n) { return String(n || "").replace(/(股份有限公司|有限责任公司|有限公司)$/, ""); }
  function dayDiff(from, to) {
    if (!from || !to) return 0;
    return Math.round((new Date(to + "T00:00:00") - new Date(from + "T00:00:00")) / 86400000);
  }
  function pct(n) { return Math.round((Number(n) || 0) * 100) + "%"; }

  /* 省代侧：?sub=<企业 id> 时只渲染这一家 */
  function qSub(ctx) {
    if (ctx.mode === "sub") return null;
    var id;
    try { id = new URLSearchParams(window.location.search).get("sub"); } catch (e) { id = ""; }
    if (!id) return null;
    return (ctx.s.subs || []).filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ---------------- 数据装配 ---------------- */

  /* 省代：协议台账（只统计在营企业；已终止的合作不再产生协议义务） */
  function provListVm(ctx) {
    var items = (ctx.s.subs || []).filter(function (p) { return p.status === "active"; }).map(function (p) {
      var ag = p.agreement || {};
      var st = ag.state || "pending";
      var sentDays = ag.sentAt ? dayDiff(ag.sentAt, TODAY) : 0;
      return {
        p: p, ag: ag, st: st,
        sentDays: sentDays,
        /* 超 30 天未签 = 需要省代介入的信号（协议第九条：到期前 30 日无异议则续签，同理催签） */
        stale: st !== "signed" && st !== "rejected" && sentDays > 30
      };
    });
    var counts = { pending: 0, signed: 0, rejected: 0 };
    items.forEach(function (i) {
      if (i.st === "signed") counts.signed++;
      else if (i.st === "rejected") counts.rejected++;
      else counts.pending++;
    });
    return {
      view: "list", items: items, counts: counts, total: items.length,
      stale: items.filter(function (i) { return i.stale; }).length
    };
  }

  /* 省代：某一家企业的协议详情 */
  function provDetailVm(ctx, p) {
    var ag = p.agreement || {};
    var prov = ctx.s.profile || {};
    var side = {
      jia: { name: prov.name, uscc: prov.uscc, legalPerson: prov.legalPerson, contact: prov.contact, phone: prov.phone, address: prov.address },
      yi: { name: p.name, uscc: p.uscc, legalPerson: p.legalPerson, contact: p.contact, phone: p.phone, address: p.address }
    };
    /* 比例以「这份协议发起时锁定的」为准：事后调比例要补签，档案页不能跟着变，
       否则同一屏里正文写着 20%、要素行写着 25%，等于把合同改了还没留痕 */
    var ratio = ag.ratio != null ? ag.ratio : p.ratioToSub;
    return {
      view: "detail", st: ag.state || "pending", ag: ag, side: side,
      body: bodyOf(ag, side, ratio),
      meta: [
        { k: "约定比例", v: pct(ratio) },
        { k: "合作自", v: p.since || "—" }
      ],
      sub: p
    };
  }

  /* 二级：本企业与上级省代的那一份协议 */
  function subVm(ctx) {
    var ag = ctx.s.agreement || null;
    if (!ag) return { view: "none" };
    var side = { jia: ag.province || {}, yi: ag.sub || {} };
    return {
      view: "detail", st: ag.state || "pending", ag: ag, side: side,
      body: bodyOf(ag, side, ag.ratio != null ? ag.ratio : (ag.ratioToSub || 0.2)),
      meta: [
        { k: "约定比例", v: pct(ag.ratio != null ? ag.ratio : (ag.ratioToSub || 0.2)) },
        { k: "结算层级", v: "省代 → 本企业（二级）" }
      ],
      sub: null
    };
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) { var s = qSub(ctx); return s ? provDetailVm(ctx, s) : provListVm(ctx); },
      perms: { resend: true },
      lockedNote: "协议发起与重新发起均已锁定"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) { var s = qSub(ctx); return s ? provDetailVm(ctx, s) : provListVm(ctx); },
      perms: { resend: false },
      note: "协议发起、重发与补签归管理员执行；员工可查看全部协议档案与签署留痕。",
      lockedNote: "协议档案仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) { return subVm(ctx); },
      perms: { sign: true },
      lockedNote: "合作已暂停，协议仍可查阅"
    },
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: function (ctx) { return subVm(ctx); },
      perms: { sign: false },
      note: "协议签署与拒签仅企业管理员可执行；员工仅可查看协议档案。",
      lockedNote: "协议档案仅可查看"
    },
    sub_legal: {
      label: "二级合作企业 · 法定代表人",
      data: function (ctx) { return subVm(ctx); },
      perms: { sign: false },
      note: "法定代表人身份为全量只读视图，可查看协议全文与签署留痕。",
      lockedNote: "协议档案仅可查看"
    }
  };

  /* ---------------- 渲染基元 ---------------- */

  /* 协议正文渲染：正文来自后台富文本编辑器，统一走 Uni.richDoc() 清洗排版，
     排版样式在 uni-layout.css 的 .uh-doc 里定义一次，各展示位共用 */
  function docHtml(body) {
    var html = window.Uni && window.Uni.richDoc ? window.Uni.richDoc(body) : "";
    return html || '<div class="uh-plain">正文由省代在后台编辑生成，当前版本暂无可展示的正文。</div>';
  }

  function partyHtml(label, p) {
    var rows = [
      ["统一社会信用代码", p.uscc], ["法定代表人", p.legalPerson],
      ["联系人 · 电话", (p.contact || "—") + (p.phone ? " · " + p.phone : "")],
      ["地址", p.address]
    ];
    return '<div class="ag-party"><div class="ag-party__h">' + ui.esc(label) + '</div>' +
      '<div class="ag-party__n">' + ui.esc(p.name || "—") + '</div>' +
      rows.map(function (r) {
        return '<div class="uh-kv"><span class="k">' + ui.esc(r[0]) + '</span><span class="v">' + ui.esc(r[1] || "—") + '</span></div>';
      }).join("") + '</div>';
  }

  /* 流转时间线：发起 → 查阅签署 → 生效；拒签单独一条 */
  function timelineHtml(ag, st) {
    var items = [{
      t: "协议发起", k: "done",
      d: (ag.sentAt || "—") + " · 省代在线发起并送达乙方"
    }];
    if (st === "signed") {
      items.push({ t: "乙方查阅并签署", k: "done", d: (ag.signedAt || "—") + (ag.signerName ? " · " + ag.signerName : "") });
      items.push({ t: "协议生效", k: "done", d: "有效期至 " + (ag.expireAt || "—") });
    } else if (st === "rejected") {
      items.push({ t: "乙方拒签", k: "bad", d: (ag.rejectedAt || "—") + " · " + (ag.rejectReason || "未说明原因") });
      items.push({ t: "修订后重新发起", k: "todo", d: "重新发起后退回第一步，起草与签署留痕重新累积" });
    } else {
      var d = ag.sentAt ? dayDiff(ag.sentAt, TODAY) : 0;
      items.push({
        t: st === "pending_mine" ? "等待本企业签署" : "等待乙方查阅并签署", k: "now",
        d: (d <= 0 ? "今日发起 · 待查阅" : "已发起 " + d + " 天") +
          (d > 30 ? " · 超过 30 天未签，建议重新发起或调整条款" : "")
      });
      items.push({ t: "协议生效", k: "todo", d: "双方签署后生效，有效期一年" });
    }
    return '<div class="ag-tl">' + items.map(function (i) {
      return '<div class="ag-tl__i is-' + i.k + '">' +
        '<div class="ag-tl__t">' + ui.esc(i.t) + '</div>' +
        '<div class="ag-tl__d">' + ui.esc(i.d) + '</div></div>';
    }).join("") + "</div>";
  }

  /* 有效期进度：一年期协议已走过多少（仅已签署有意义） */
  function lifeHtml(ag, st) {
    if (st !== "signed" || !ag.signedAt || !ag.expireAt) return "";
    var span = dayDiff(ag.signedAt, ag.expireAt) || 365;
    var used = dayDiff(ag.signedAt, TODAY);
    var left = dayDiff(TODAY, ag.expireAt);
    var p = Math.max(0, Math.min(100, Math.round(used / span * 100)));
    var cls = left <= 30 ? " ag-life__fill--bad" : (left <= 90 ? " ag-life__fill--warn" : "");
    return '<div class="ag-life">' +
      '<div class="ag-life__bar"><div class="ag-life__fill' + cls + '" style="width:' + Math.max(p, 3) + '%"></div></div>' +
      '<div class="ag-life__lg"><span>生效 ' + ui.esc(ag.signedAt) + '</span>' +
      '<span>剩余 ' + left + ' 天 · 至 ' + ui.esc(ag.expireAt) + '</span></div></div>';
  }

  /* ---------------- 省代：协议台账 ---------------- */
  function provRowHtml(it) {
    var ag = it.ag, s = stOf(it.st);
    var sub = ag.version ? (ag.id || "—") + " · " + ag.version : "协议编号待生成";
    /* 第三行按语义分段并禁止段内换行：中文会在任意字间断行，
       「有效期至 2027-08-11」被拆成「有效 / 期至 …」两截最难看。
       段间分隔点由 CSS ::before 生成而非文本节点——折行时分隔点跟着下一段走，
       不会在行尾留下一个孤零零的「·」。
       超期未签把「已 N 天未签」整段转警示色，不再单独堆一句「建议重发」：
       页头的处理提示已经说过一遍，行内再叠一次只是噪音。 */
    var segs; /* [文本, 附加类名] */
    if (it.st === "signed") {
      segs = [["签署 " + (ag.signedAt || "—"), ""]];
      if (ag.signerName) segs.push([ag.signerName, ""]);
      segs.push(["有效期至 " + (ag.expireAt || "—"), ""]);
    } else if (it.st === "rejected") {
      segs = [["拒签于 " + (ag.rejectedAt || "—"), ""]];
    } else {
      /* 重发当天 sentDays 为 0：「已 0 天未签」是病句，当天改用「今日送达」 */
      segs = [["发起 " + (ag.sentAt || "—"), ""],
        [it.sentDays > 0 ? "已 " + it.sentDays + " 天未签" : "今日送达",
          it.stale ? " ag-seg--warn" : ""]];
    }
    var third = segs.map(function (x) {
      return '<span class="ag-seg' + x[1] + '">' + ui.esc(x[0]) + '</span>';
    }).join("");
    return '<div class="uh-row ag-row" data-open="' + ui.esc(it.p.id) + '" role="button" tabindex="0">' +
      '<span class="uh-row__ic">' + ui.icon("doc", 18) + '</span>' +
      '<span class="uh-row__main">' +
      '<span class="uh-row__t">' + ui.esc(shortName(it.p.name)) + '</span>' +
      '<span class="uh-row__s ag-nw">' + ui.esc(sub) + '</span>' +
      '<span class="uh-row__s"><span class="time">' + third + '</span></span>' +
      (it.st === "rejected" && ag.rejectReason
        ? '<span class="ag-rej">' + ui.esc(ag.rejectReason) + '</span>' : "") +
      '</span>' +
      '<span class="uh-row__right"><span class="uh-badge uh-badge--' + s.c + '">' + s.t + '</span>' +
      '<span class="uh-row__amt" style="font-size:var(--fs-sm);font-weight:600;color:var(--text-3)">' + pct(it.p.ratioToSub) + '</span></span>' +
      '<span class="uh-chev">' + ui.icon("chev", 16) + '</span></div>';
  }

  function provGroupHtml(title, tone, arr) {
    if (!arr.length) return "";
    return '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">' + ui.esc(title) + '</span>' +
      '<span class="uh-badge uh-badge--' + tone + '">' + arr.length + " 份</span></div>" +
      '<div class="card" style="padding:2px 14px">' + arr.map(provRowHtml).join("") + '</div></section>';
  }

  function provListHtml(vm) {
    var g = { pending: [], rejected: [], signed: [] };
    vm.items.forEach(function (i) {
      if (i.st === "rejected") g.rejected.push(i);
      else if (i.st === "signed") g.signed.push(i);
      else g.pending.push(i);
    });
    /* 待签在前（要动作），拒签次之（要修订），已签最后（归档态） */
    var todo = vm.counts.pending + vm.counts.rejected;
    var ledger =
      '<div class="uh-finhead"><span class="uh-eyebrow">协议台账</span>' +
      '<span class="uh-badge uh-badge--mute">在营 ' + vm.total + ' 家</span></div>' +
      '<div class="ag-stats">' +
      '<div class="ag-stat ag-stat--wait"><b>' + vm.counts.pending + '</b><span>待签署</span></div>' +
      '<div class="ag-stat ag-stat--ok"><b>' + vm.counts.signed + '</b><span>已签署</span></div>' +
      '<div class="ag-stat ag-stat--bad"><b>' + vm.counts.rejected + '</b><span>已拒签</span></div>' +
      '</div>' +
      '<div class="uh-note" style="margin-top:10px">' +
      (todo === 0
        ? "全部协议已签署，无待办。协议到期前 30 日双方无异议则按届时规则续签。"
        : "有 " + todo + " 份协议需要处理" +
          (vm.stale ? "，其中 " + vm.stale + " 份已发起超过 30 天仍未签署，建议重新发起" : "") +
          "。协议未签不影响已发生的消费分润，但补签前不产生新的授权。") +
      '</div>';

    if (!vm.total) {
      return '<section class="uh-sec"><div class="card">' + ledger + '</div></section>' +
        '<section class="uh-sec">' + window.Uni.emptyHtml("暂无合作协议", "二级企业审核通过后，系统将自动生成合作协议并送达对方签署", "doc") + '</section>';
    }
    return '<section class="uh-sec"><div class="card">' + ledger + '</div></section>' +
      provGroupHtml("待签 / 待重发", "wait", g.pending) +
      provGroupHtml("已拒签", "bad", g.rejected) +
      provGroupHtml("已签署", "ok", g.signed);
  }

  /* ---------------- 单份协议详情（省代 ?sub= / 二级自身） ---------------- */
  function detailHtml(vm, ctx, V) {
    var ag = vm.ag, s = stOf(vm.st);
    var isProv = !!vm.sub;
    var title = isProv ? vm.sub.name : ((vm.side.jia || {}).name || "合作协议");

    var head =
      '<section class="uh-sec"><div class="card">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + (isProv ? "合作协议档案" : "本企业合作协议") + '</span>' +
      '<span class="uh-badge uh-badge--' + s.c + '">' + s.t + '</span></div>' +
      '<div class="ag-hero">' +
      '<span class="ag-hero__ic">' + ui.icon(isProv ? "building" : "doc", 22) + '</span>' +
      '<span><span class="ag-hero__t">' + ui.esc(isProv ? shortName(title) : "合作协议") + '</span>' +
      '<span class="ag-hero__s">' + ui.esc(s.s) + '</span></span></div>' +
      '<div style="margin-top:12px">' +
      '<div class="uh-kv"><span class="k">协议编号 / 版本</span><span class="v">' + ui.esc(ag.id || "—") + " · " + ui.esc(ag.version || "—") + '</span></div>' +
      (isProv
        ? '<div class="uh-kv"><span class="k">乙方（二级企业）</span><span class="v">' + ui.esc(vm.sub.name) + '</span></div>'
        : '<div class="uh-kv"><span class="k">甲方（省级总代）</span><span class="v">' + ui.esc((vm.side.jia || {}).name || "—") + '</span></div>') +
      vm.meta.map(function (r) {
        return '<div class="uh-kv"><span class="k">' + ui.esc(r.k) + '</span><span class="v">' + ui.esc(r.v) + '</span></div>';
      }).join("") +
      '<div class="uh-kv"><span class="k">发起时间</span><span class="v">' + ui.esc(ag.sentAt || "—") + '</span></div>' +
      (ag.signedAt ? '<div class="uh-kv"><span class="k">签署时间 / 签署人</span><span class="v">' +
        ui.esc(ag.signedAt) + " · " + ui.esc(ag.signerName || "—") + '</span></div>' : "") +
      '<div class="uh-kv"><span class="k">' + (ag.signedAt ? "有效期至" : "拟定期限至") + '</span><span class="v">' + ui.esc(ag.expireAt || "—") + '</span></div>' +
      '</div>' +
      lifeHtml(ag, vm.st) +
      '</div></section>';

    /* 拒签原因：省代重发前必须看得到，二级也知道自己为什么没签。
       重发过的协议保留上一条原因——省代需要确认这次修订确实覆盖了对方的异议。 */
    var rej = "";
    if (vm.st === "rejected") {
      rej = '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("warn", 15) +
        '<span><b>拒签原因（' + ui.esc(ag.rejectedAt || "—") + '）</b>：' + ui.esc(ag.rejectReason || "未说明原因") +
        (isProv ? "。修订条款后重新发起，签署留痕将从重发日起重新累积。" : "。请等待省代修订后重新发起。") + '</span></div></section>';
    } else if (vm.st === "pending" && ag.rejectReason) {
      rej = '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) +
        '<span><b>上次拒签（已重新发起）</b>：' + ui.esc(ag.rejectReason) +
        '。请确认本次条款已覆盖该异议后再推动对方签署。</span></div></section>';
    }

    var tl = '<section class="uh-sec"><div class="card">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">流转进度</span></div>' +
      timelineHtml(ag, vm.st) + '</div></section>';

    var parties = '<section class="uh-sec"><div class="card">' +
      partyHtml("甲方（省级总代）", vm.side.jia || {}) +
      '<div style="height:14px"></div>' +
      partyHtml("乙方（" + (isProv ? "二级合作企业" : "本企业") + "）", vm.side.yi || {}) +
      '</div></section>';

    var termSec = '<section class="uh-sec"><div class="card">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">协议正文</span>' +
      '<span class="uh-badge uh-badge--mute">' + ui.esc(ag.version || "—") + '</span></div>' +
      docHtml(vm.body) + '</div></section>';

    /* 省代侧的动作与交叉入口；二级侧的动作走底部粘性栏 */
    var acts = "";
    if (isProv) {
      var canResend = V.perms.resend && !ctx.readonly && ctx.s.profile.status === "active" && vm.st !== "signed";
      acts = '<section class="uh-sec ag-acts">' +
        (canResend ? '<div class="ag-acts__main"><button type="button" class="btn btn-primary btn-block" data-act="resend">' +
          (vm.st === "rejected" ? "修订后重新发起" : "重新发起协议") + '</button></div>' : "") +
        '<div class="ag-acts__sub">' +
        '<a class="btn btn-ghost" href="reconcile-sub.html?sub=' + encodeURIComponent(vm.sub.id) + '">本月对账单</a>' +
        '<a class="btn btn-ghost" href="agreement.html">全部协议</a>' +
        '</div></section>';
    } else {
      acts = '<section class="uh-sec">' +
        '<div class="uh-readnote">' + ui.icon("info", 15) +
        '<span>协议经双方电子签留痕后生效；到期前 30 日双方无异议则按届时规则续签。对账与结算口径以对账中心的对账单为准。</span></div>' +
        '<div class="ag-acts__sub" style="margin-top:10px">' +
        '<a class="btn btn-ghost" href="reconcile-sub.html">本月对账单</a>' +
        '<a class="btn btn-ghost" href="settings.html">企业资料</a>' +
        '</div></section>';
    }

    return head + rej + tl + parties + termSec + acts;
  }

  /* ---------------- 弹窗 ---------------- */
  /* 二级：签署确认（全文已在页面上，弹窗只做"确认已读 + 电子签"这一步） */
  function signSheet(ag, Uni) {
    Uni.sheet({
      title: "签署合作协议",
      body:
        '<div class="uh-sheetkv"><span class="k">协议编号</span><span class="v">' + ui.esc(ag.id || "—") + " · " + ui.esc(ag.version || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">甲方</span><span class="v">' + ui.esc((ag.province || {}).name || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">约定比例</span><span class="v">' + pct(ag.ratioToSub || 0.2) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">有效期</span><span class="v">' + ui.esc(ag.sentAt || "—") + " 起 · 至 " + ui.esc(ag.expireAt || "—") + '</span></div>' +
        '<div class="uh-readnote" style="margin:12px 0">' + ui.icon("info", 15) +
        '<span>签署即表示本企业已完整阅读并同意页面所列十条条款；电子签留痕会记录签署人与签署时间。</span></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);color:var(--text-2);min-height:32px">' +
        '<input type="checkbox" id="ag-ck"> 我已完整阅读并知悉全部十条条款</label>',
      footer: [
        { t: "取消", kind: "ghost" },
        { t: "确认签署", kind: "primary", onClick: function (ov) {
          var ck = ov.querySelector("#ag-ck");
          if (!ck || !ck.checked) { Uni.toast("请先完整阅读并勾选确认"); return false; }
          var r = Uni.actGuarded("agree/sign", { confirmed: true });
          if (r.ok) Uni.toast("已完成签署，协议生效", "ok");
          return r.ok;
        } }
      ]
    });
  }

  function rejectSheet(Uni) {
    Uni.sheet({
      title: "拒签合作协议",
      body:
        '<div class="uh-readnote" style="margin-bottom:10px">' + ui.icon("info", 15) +
        '<span>拒签原因将同步给上级省代，省代可据此修订条款后重新发起；拒签不影响已发生的消费分润。</span></div>' +
        '<div style="font-size:var(--fs-sm);color:var(--text-3);margin-bottom:6px">拒签原因（必填）</div>' +
        '<textarea id="ag-reason" placeholder="例如：第七条开票主体与税率口径需进一步确认" style="' + FIELD_STYLE + '"></textarea>',
      footer: [{ t: "取消", kind: "ghost" },
      {
        t: "确认拒签", kind: "danger", onClick: function (ov) {
          var v = ov.querySelector("#ag-reason").value.trim();
          if (!v) { Uni.toast("请填写拒签原因"); return false; }
          var r = Uni.actGuarded("agree/reject", { reason: v });
          if (r.ok) Uni.toast("已拒签，已通知省代", "ok");
          return r.ok;
        }
      }]
    });
  }

  function resendDialog(p, Uni) {
    var ag = p.agreement || {};
    var days = ag.sentAt ? dayDiff(ag.sentAt, TODAY) : 0;
    Uni.dialog({
      title: "重新发起合作协议？", danger: true,
      text: (ag.state === "rejected"
        ? "该企业此前已拒签（" + ui.esc(ag.rejectReason || "未说明原因") + "）。"
        : days > 0
          ? "该协议已发起 " + days + " 天仍未签署。"
          : "该协议今日刚发起，对方尚未签署。") +
        "重新发起后协议回到待签署状态，原签署/拒签留痕清空，并通知对方重新查阅签署。",
      ok: "确认重新发起",
      onOk: function () {
        var r = Uni.actGuarded("agree/resend", { id: p.id });
        if (r.ok) Uni.toast("协议已重新发起，等待对方签署", "ok");
      }
    });
  }

  /* ---------------- 唯一渲染路径 ---------------- */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(Uni.lockTitle(ctx, V)) + '（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + '</span></div></div></section>';
    }
    if (V.note && !ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) +
        '<span>' + ui.esc(V.note) + '</span></div></section>';
    }

    if (vm.view === "none") {
      html += '<section class="uh-sec">' + Uni.emptyHtml("暂无合作协议", "上级省代发起合作后，协议将出现在这里", "doc") + '</section>';
    } else if (vm.view === "list") {
      html += provListHtml(vm);
    } else {
      html += detailHtml(vm, ctx, V);
      /* 二级待签：底部粘性栏放签署主操作 */
      if (!vm.sub && vm.st === "pending_mine" && V.perms.sign && !ctx.readonly && !V.readonly) {
        html += '<div class="uh-stickybar">' +
          '<button type="button" class="btn btn-ghost" data-act="reject">拒签</button>' +
          '<button type="button" class="btn btn-primary" data-act="sign">阅读并签署</button></div>';
        el.classList.add("ag-hasbar");
      }
    }
    el.innerHTML = html;

    /* 台账行 → 该企业协议详情（同一页，?sub= 直达，可刷新/可分享） */
    el.querySelectorAll("[data-open]").forEach(function (n) {
      var go = function () { Uni.navTo("agreement.html?sub=" + encodeURIComponent(n.getAttribute("data-open"))); };
      n.addEventListener("click", go);
      n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });

    var signBtn = el.querySelector('[data-act="sign"]');
    if (signBtn) signBtn.addEventListener("click", function () { signSheet(ctx.s.agreement || {}, Uni); });
    var rejectBtn = el.querySelector('[data-act="reject"]');
    if (rejectBtn) rejectBtn.addEventListener("click", function () { rejectSheet(Uni); });
    var resendBtn = el.querySelector('[data-act="resend"]');
    if (resendBtn) resendBtn.addEventListener("click", function () { resendDialog(vm.sub, Uni); });

    /* 页头语境：进的是"某一家的协议"时，标题换成企业名，返回键回到协议台账 */
    if (ctx.mode !== "sub") {
      var phone = el.closest(".phone");
      var tt = phone && phone.querySelector(".topbar-title");
      if (tt) tt.textContent = vm.sub ? shortName(vm.sub.name) + " · 协议" : "合作协议";
      var back = phone && phone.querySelector(".nav-back");
      if (back && vm.sub) back.setAttribute("href", "agreement.html");
    }
  }

  window.Uni.register({
    view: "uni-agreement",
    route: "agreement.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
