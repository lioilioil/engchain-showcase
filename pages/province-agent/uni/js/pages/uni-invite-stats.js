/* ============================================================
   uni-invite-stats.js · 获客转化（获客域 3 页之三）
   页内三分页：明细（逐笔消费）/ 统计（口径与结构）/ 分析（趋势与建议）
   ------------------------------------------------------------
   · 交互词汇与「获客记录」同源：吸顶 .seg 主 bar + 共享筛选行 +
     底部 sheet 筛选 + 20 条/页 + 视角（自营线/二级线）多选
   · 明细 = 记录粒度（事项/合格可筛）；统计 = 用户粒度（日期/渠道/成员）；
     分析 = 自然月口径（不接明细筛选，见页内说明）
   · S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);`
   · 组件视觉全部系统类（.card/.seg/.uh-*），本页私有类统一 .us- 前缀
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui, U = window.Uni;
  var PAGE_SIZE = 20;

  /* ---------- 通用工具 ---------- */
  function pad2(n) { return ("0" + n).slice(-2); }
  function fmtDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function monthOf(ds) { return ds ? String(ds).slice(0, 7) : ""; }
  function ymInt(m) { var p = m.split("-"); return Number(p[0]) * 12 + Number(p[1]) - 1; }
  function intYm(i) { return Math.floor(i / 12) + "-" + pad2(i % 12 + 1); }
  function monthShift(m, n) { return intYm(ymInt(m) + n); }
  function monthShort(m) { return Number(m.split("-")[1]) + "月"; }
  function quickRange(key) {
    var now = new Date();
    if (key === "7d") { var s7 = new Date(now); s7.setDate(s7.getDate() - 6); return { start: fmtDate(s7), end: fmtDate(now) }; }
    if (key === "30d") { var s30 = new Date(now); s30.setDate(s30.getDate() - 29); return { start: fmtDate(s30), end: fmtDate(now) }; }
    if (key === "month") {
      return { start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    return { start: "", end: "" };
  }
  function pctOf(part, whole) { return whole > 0 ? Math.round(part / whole * 100) + "%" : "—"; }
  function dayGap(ds) {
    if (!ds) return null;
    var d = new Date(String(ds).slice(0, 10) + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / 86400000);
  }
  function leadDate(l) { return String(l.boundAt || l.createdAt || "").slice(0, 10); }

  /* ---------- 口径：生命周期 → 漏斗层级（单调，不因个体状态回退） ----------
     游客 0 / 已注册·流失 1 / 各类认证 2 / 各类入驻 3 / 产生过合格消费 4 */
  var LIFECYCLE_BY_STAGE = { registered: "已注册", onboarded: "已企业入驻", paid: "已企业入驻", repaid: "已企业入驻", lost: "流失" };
  var RANK_BY_LIFE = {
    "游客": 0, "已注册": 1, "流失": 1,
    "已个人认证": 2, "已企业认证": 2, "已加入认证企业": 2,
    "已企业入驻": 3, "已加入入驻企业": 3
  };
  function lifecycleOf(l) { return l.lifecycle || LIFECYCLE_BY_STAGE[l.stage] || "已注册"; }
  function eligibleSum(l) {
    var t = 0;
    (l.consumption || []).forEach(function (c) { if (U.consumeTypeOf(c.type).eligible) t += c.amount || 0; });
    return t;
  }
  function rankOf(l) {
    var r = RANK_BY_LIFE[lifecycleOf(l)];
    if (r == null) r = 1;
    return eligibleSum(l) > 0 ? 4 : r;
  }

  /* ---------- 用户粒度聚合 ---------- */
  function aggOf(leads) {
    var o = { leads: leads.length, paid: 0, recs: 0, eligibleRecs: 0, all: 0, eligible: 0, ranks: [0, 0, 0, 0, 0] };
    leads.forEach(function (l) {
      var r = rankOf(l);
      (l.consumption || []).forEach(function (c) {
        o.recs += 1;
        o.all += c.amount || 0;
        if (U.consumeTypeOf(c.type).eligible) { o.eligibleRecs += 1; o.eligible += c.amount || 0; }
      });
      if (r === 4) o.paid += 1;
      for (var i = 0; i <= r; i++) o.ranks[i] += 1;
    });
    return o;
  }

  /* ---------- 渠道码短名（筛选摘要用） ---------- */
  var CH_LABEL = { province: "管理员码 CH-P", staff: "员工码 CH-E", sub: "二级码 CH-S" };
  var CH_SHORT = { province: "渠道码CH-P", staff: "员工码CH-E", sub: "二级码CH-S" };

  /* ---------- 身份变体（6 身份显式定义；fallback 会剥离 data 函数导致白屏） ---------- */
  var CLAUSES_COMMON = [
    { no: "合格口径", c: "订单成交实付净额、积分解锁实付、增值服务实付计入合格；企业入驻费属于入驻成本，不计入合格消费。" },
    { no: "分佣比例", c: "约定比例在二级合作中逐家配置（0–50%）；本页展示合格消费，不展示可提现金额。" },
    { no: "钱包与提现", c: "本端没有钱包、没有自动提现；线下付款凭凭证登记留痕。" }
  ];
  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        return {
          self: s.leads.direct || [],
          sub: s.leadsSub || s.leads.school || [],
          showMembers: true,
          canScope: true,
          settlement: null,
          clauses: CLAUSES_COMMON,
          note: "",
          lockedTitle: "合作权限已暂停",
          empty: { title: "暂无转化数据", desc: "渠道码带来用户并产生消费后，明细与统计将出现在这里" }
        };
      },
      lockedNote: "转化数据仅可查看"
    },
    /* 显式定义：法代与管理员同范围，只读由 ctx.readonly 门控 */
    legal_rep: {
      label: "省级总代 · 法定代表人",
      data: function (ctx) {
        var s = ctx.s;
        return {
          self: s.leads.direct || [],
          sub: s.leadsSub || s.leads.school || [],
          showMembers: true,
          canScope: true,
          settlement: null,
          clauses: CLAUSES_COMMON,
          note: "",
          lockedTitle: "合作权限已暂停",
          empty: { title: "暂无转化数据", desc: "渠道码带来用户并产生消费后，明细与统计将出现在这里" }
        };
      },
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s, my = ctx.staffName;
        var mine = (s.leads.direct || []).filter(function (l) { return l.owner === my; });
        return {
          self: mine,
          sub: [],
          showMembers: false,
          canScope: false,
          settlement: null,
          clauses: CLAUSES_COMMON,
          note: "员工权限：仅统计你本人渠道码带来的获客与转化数据。",
          lockedTitle: "合作权限已暂停",
          empty: { title: "暂无本人转化数据", desc: "你的渠道码带来用户并产生消费后，数据将出现在这里" }
        };
      },
      lockedNote: "转化数据仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var s = ctx.s, cur = (s.calc && s.calc[0]) || {}, st = store.subSettle(cur);
        return {
          self: s.leads.school || [],
          sub: [],
          showMembers: true,
          canScope: false,
          settlement: {
            eyebrow: "本月本人经营所得 · 平台月度对账口径",
            big: st.agreed,
            rows: [
              { k: "合格消费", v: ui.money(st.eligible) },
              { k: "总盘（合格消费×50%）", v: ui.money(st.gross) },
              { k: "约定所得比例", v: Math.round(st.ratioToSub * 100) + "%" }
            ],
            note: "不构成可提现金额。此卡为月度对账口径，与下方「明细口径」逐笔合计不同，结算以月度对账为准。"
          },
          clauses: [
            { no: "绑定归属", c: "单层绑定：用户通过你的渠道码注册后即永久归属本企业；用户再邀请不归属、不计佣、不传递。" },
            { no: "合格口径", c: "订单成交实付净额、积分解锁实付、增值服务实付计入合格；企业入驻费不计入。" },
            { no: "钱包与提现", c: "本端没有钱包、没有提现；约定所得由省代按平台月度对账数据线下支付。" }
          ],
          note: "",
          lockedTitle: "合作已暂停",
          empty: { title: "暂无转化数据", desc: "渠道码带来用户并产生消费后，明细与统计将出现在这里" }
        };
      },
      lockedNote: "经营数据仅可查看"
    },
    /* 显式定义：随机数不变，只读由 ctx.readonly 门控 */
    sub_legal: {
      label: "二级合作企业 · 法定代表人",
      data: function (ctx) {
        var s = ctx.s, cur = (s.calc && s.calc[0]) || {}, st = store.subSettle(cur);
        return {
          self: s.leads.school || [],
          sub: [],
          showMembers: true,
          canScope: false,
          settlement: {
            eyebrow: "本月本人经营所得 · 平台月度对账口径",
            big: st.agreed,
            rows: [
              { k: "合格消费", v: ui.money(st.eligible) },
              { k: "总盘（合格消费×50%）", v: ui.money(st.gross) },
              { k: "约定所得比例", v: Math.round(st.ratioToSub * 100) + "%" }
            ],
            note: "不构成可提现金额。此卡为月度对账口径，与下方「明细口径」逐笔合计不同，结算以月度对账为准。"
          },
          clauses: [
            { no: "绑定归属", c: "单层绑定：用户通过你的渠道码注册后即永久归属本企业；用户再邀请不归属、不计佣、不传递。" },
            { no: "合格口径", c: "订单成交实付净额、积分解锁实付、增值服务实付计入合格；企业入驻费不计入。" },
            { no: "钱包与提现", c: "本端没有钱包、没有提现；约定所得由省代按平台月度对账数据线下支付。" }
          ],
          note: "",
          lockedTitle: "合作已暂停",
          empty: { title: "暂无转化数据", desc: "渠道码带来用户并产生消费后，明细与统计将出现在这里" }
        };
      },
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    /* 显式定义：二级员工只看本人用户，且不展示经营所得卡（口径为全企业月度合计） */
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: function (ctx) {
        var s = ctx.s, my = ctx.staffName;
        var mine = (s.leads.school || []).filter(function (l) { return l.owner === my; });
        return {
          self: mine,
          sub: [],
          showMembers: false,
          canScope: false,
          settlement: null,
          clauses: [
            { no: "数据范围", c: "仅统计你本人渠道码带来的用户；经营所得为企业口径月度合计，仅管理员可见。" },
            { no: "合格口径", c: "订单成交实付净额、积分解锁实付、增值服务实付计入合格；企业入驻费不计入。" }
          ],
          note: "二级员工：仅统计本人渠道码带来的用户与消费数据。",
          lockedTitle: "合作已暂停",
          empty: { title: "暂无本人转化数据", desc: "你的渠道码带来用户并产生消费后，数据将出现在这里" }
        };
      },
      lockedNote: "经营数据仅可查看"
    }
  };

  /* ---------- 分页 / 空态 ---------- */
  function loadFootHtml(total, shown, filtered) {
    if (total > shown) {
      return '<button type="button" class="btn btn-ghost us-loadmore" data-loadmore>加载更多（剩余 ' + (total - shown) + " 笔）</button>";
    }
    return '<div class="us-allloaded">已全部加载 · 共 ' + total + " 笔" + (filtered ? "（已筛选）" : "") + "</div>";
  }

  /* ---------- 唯一渲染路径 ---------- */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var isSubMode = ctx.mode === "sub";
    var LINE_LABEL = isSubMode ? { self: "本企业线", sub: "二级线" } : { self: "自营线", sub: "二级线" };

    /* 码名称索引：自营码 channels.direct / 二级码 channels.school + 合作企业 channels */
    function buildCodeMap() {
      var m = {}, ch = ctx.s.channels || {};
      function add(c) { if (c && c.code) m[c.code] = c; }
      (ch.direct || []).forEach(add);
      (ch.school || []).forEach(add);
      (ctx.s.subs || []).forEach(function (x) { (x.channels || []).forEach(add); });
      return m;
    }
    var codeMap = buildCodeMap();
    function codeNameOf(l) { var c = l.code && codeMap[l.code]; return c ? c.name : ""; }
    var subsById = {};
    (ctx.s.subs || []).forEach(function (x) { subsById[x.id] = x; });

    /* ---- 页面交互态 ---- */
    var view = "detail";                                  // detail | stats | analysis
    var scopeSet = { self: true, sub: false };            // 视角：默认自营线（与获客记录一致）
    var canScope = !!vm.canScope && (vm.sub || []).length > 0;
    var visibleCount = PAGE_SIZE;
    /* 筛选：日期/渠道/成员 = 用户粒度（明细+统计共用）；事项/合格 = 记录粒度（仅明细） */
    var fQuick = "all", fStart = "", fEnd = "", fChannel = "all", fMember = "all", fType = "all", fElig = "all";

    function merged() {
      var out = [];
      if (scopeSet.self) (vm.self || []).forEach(function (l) { l.__line = "self"; out.push(l); });
      if (scopeSet.sub) (vm.sub || []).forEach(function (l) { l.__line = "sub"; l.__channelKey = "sub"; out.push(l); });
      return out;
    }
    function channelKeyOf(l) {
      if (isSubMode) return "sub";
      if (l.__channelKey === "sub") return "sub";
      if (l.channel === "school") return "sub";
      return l.owner && l.owner === ctx.staffName ? "staff" : "province";
    }
    function membersOf(list) {
      var seen = {}, out = [];
      list.forEach(function (l) {
        var o = l.owner || "未知成员";
        if (!seen[o]) { seen[o] = 1; out.push({ key: o, label: o }); }
      });
      return out;
    }
    function channelKeysOf(list) {
      var seen = {};
      list.forEach(function (l) { seen[channelKeyOf(l)] = 1; });
      return Object.keys(seen);
    }
    function typeKeysOf(list) {
      var seen = {};
      list.forEach(function (l) { (l.consumption || []).forEach(function (c) { seen[c.type] = 1; }); });
      return Object.keys(seen);
    }
    function matchesCohort(l) {
      var d = leadDate(l);
      if (fStart && d < fStart) return false;
      if (fEnd && d > fEnd) return false;
      if (fChannel !== "all" && channelKeyOf(l) !== fChannel) return false;
      if (fMember !== "all" && (l.owner || "") !== fMember) return false;
      return true;
    }
    function resetFilters() {
      fQuick = "all"; fStart = ""; fEnd = ""; fChannel = "all"; fMember = "all"; fType = "all"; fElig = "all";
    }
    /* 已激活筛选摘要（按分页各自适用的筛选组生成） */
    function activeSummary() {
      var out = [];
      if (fQuick === "7d") out.push("获客近7天");
      else if (fQuick === "30d") out.push("获客仅30天");
      else if (fQuick === "month") out.push("获客本月");
      if (fStart || fEnd) out.push("获客 " + (fStart || "…") + "–" + (fEnd || "…"));
      if (fChannel !== "all") out.push(CH_SHORT[fChannel] || fChannel);
      if (fMember !== "all") out.push(fMember);
      if (view === "detail" && fType !== "all") out.push(U.consumeTypeOf(fType).label);
      if (view === "detail" && fElig === "ok") out.push("仅合格");
      else if (view === "detail" && fElig === "no") out.push("仅不计合格");
      return out;
    }
    function dateOnlyActive() {
      return fQuick !== "all" && fChannel === "all" && fMember === "all" &&
        (view !== "detail" || (fType === "all" && fElig === "all"));
    }

    /* ---------- 筛选行（明细/统计共用；分析不接明细筛选） ---------- */
    var QUICK_OPTS = [{ v: "all", t: "全部" }, { v: "7d", t: "近7天" }, { v: "30d", t: "仅30天" }, { v: "month", t: "本月" }];
    function dateCapsHtml() {
      return '<span class="us-datecaps">' + QUICK_OPTS.map(function (o) {
        return '<button type="button" class="us-datecap' + (o.v === fQuick ? " is-on" : "") +
          '" data-usdatecap="' + o.v + '">' + o.t + "</button>";
      }).join("") + "</span>";
    }
    function filterRowHtml() {
      var summary = activeSummary();
      var showCaps = summary.length === 0 || dateOnlyActive();
      return '<section class="uh-sec"><div class="uh-sechead us-listhead">' +
        '<span class="us-leftstate' + (summary.length && !showCaps ? " is-on" : "") + '">' +
        (showCaps ? dateCapsHtml()
          : '<span class="us-dot" aria-hidden="true"></span><span class="us-leftstate__tx">已筛选：' + ui.esc(summary.join(" · ")) + "</span>") +
        "</span>" +
        '<span class="more us-filterbtn" data-usfilter>' +
        (summary.length ? '<span class="us-dot" aria-hidden="true"></span>' : "") + "筛选</span></div></section>";
    }

    /* ---------- 筛选底部弹窗 ---------- */
    function chipsHtml(name, cur, opts) {
      return '<div class="us-chips">' + opts.map(function (o) {
        return '<button type="button" class="us-chip' + (o.v === cur ? " is-on" : "") +
          '" data-usfchip="' + name + '" data-usfcv="' + ui.esc(o.v) + '">' + ui.esc(o.t) + "</button>";
      }).join("") + "</div>";
    }
    function openFilterSheet() {
      var base = merged();
      var isDetail = view === "detail";
      var chKeys = channelKeysOf(base);
      var mems = membersOf(base);
      var tys = typeKeysOf(base);
      var t = { quick: fQuick, start: fStart, end: fEnd, channel: fChannel, member: fMember, type: fType, elig: fElig };
      function bodyHtml() {
        var parts = ['<div class="us-filtbody">'];
        parts.push('<div class="us-fg"><div class="us-fg__head">获客日期</div>' +
          chipsHtml("quick", t.quick, QUICK_OPTS) +
          '<div class="us-dates"><input type="date" class="input" data-usfs-start value="' + t.start + '" aria-label="获客开始日期">' +
          '<span class="us-dates__sep">至</span>' +
          '<input type="date" class="input" data-usfs-end value="' + t.end + '" aria-label="获客结束日期"></div>' +
          '<div class="uh-note us-fgnote">按用户获客（首次绑定）时间筛选，不是消费发生时间。</div></div>');
        if (chKeys.length > 1) {
          parts.push('<div class="us-fg"><div class="us-fg__head">渠道</div>' + chipsHtml("channel", t.channel,
            [{ v: "all", t: "全部" }].concat(chKeys.map(function (k) { return { v: k, t: CH_LABEL[k] || k }; }))) + "</div>");
        }
        if (vm.showMembers && mems.length > 1) {
          parts.push('<div class="us-fg"><div class="us-fg__head">成员</div>' +
            chipsHtml("member", t.member, [{ v: "all", t: "全部" }].concat(mems)) + "</div>");
        }
        if (isDetail && tys.length > 1) {
          parts.push('<div class="us-fg"><div class="us-fg__head">事项</div>' + chipsHtml("type", t.type,
            [{ v: "all", t: "全部" }].concat(tys.map(function (k) { return { v: k, t: U.consumeTypeOf(k).label }; }))) + "</div>");
        }
        if (isDetail) {
          parts.push('<div class="us-fg"><div class="us-fg__head">合格口径</div>' +
            chipsHtml("elig", t.elig, [{ v: "all", t: "全部" }, { v: "ok", t: "仅合格" }, { v: "no", t: "仅不计合格" }]) +
            '<div class="uh-note us-fgnote">订单成交、积分解锁、增值服务计入合格；企业入驻费不计入。</div></div>');
        }
        parts.push("</div>");
        return parts.join("");
      }
      function bind(sh) {
        var body = sh.querySelector(".us-filtbody");
        if (!body) return;
        body.querySelectorAll("[data-usfchip]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var g = btn.getAttribute("data-usfchip"), v = btn.getAttribute("data-usfcv");
            if (g === "quick") {
              t.quick = v;
              var r = quickRange(v); t.start = r.start; t.end = r.end;
              var si = sh.querySelector("[data-usfs-start]"), ei = sh.querySelector("[data-usfs-end]");
              if (si) si.value = t.start;
              if (ei) ei.value = t.end;
            } else if (g === "channel") t.channel = v;
            else if (g === "member") t.member = v;
            else if (g === "type") t.type = v;
            else if (g === "elig") t.elig = v;
            btn.parentNode.querySelectorAll("[data-usfchip]").forEach(function (b) { b.classList.remove("is-on"); });
            btn.classList.add("is-on");
          });
        });
        ["[data-usfs-start]", "[data-usfs-end]"].forEach(function (sel) {
          var inp = sh.querySelector(sel);
          if (inp) inp.addEventListener("change", function () { t.quick = "all"; });
        });
      }
      var sh = Uni.sheet({
        title: "筛选",
        body: bodyHtml(),
        footer: [
          { t: "重置", kind: "ghost", onClick: function () {
              t = { quick: "all", start: "", end: "", channel: "all", member: "all", type: "all", elig: "all" };
              sh.querySelector(".us-filtbody").outerHTML = bodyHtml();
              bind(sh);
              return false;
            } },
          { t: "确认", kind: "primary", onClick: function () {
              var si = sh.querySelector("[data-usfs-start]"), ei = sh.querySelector("[data-usfs-end]");
              fQuick = t.quick; fStart = (si && si.value) || ""; fEnd = (ei && ei.value) || "";
              fChannel = t.channel; fMember = t.member; fType = t.type; fElig = t.elig;
              visibleCount = PAGE_SIZE; renderAll();
            } }
        ]
      });
      bind(sh);
    }

    /* ---------- 视角多选（自营线 / 二级线，禁止空集） ---------- */
    function openScopeCenter() {
      var tSelf = scopeSet.self, tSub = scopeSet.sub;
      function rowHtml(k, on, label, sub) {
        return '<button type="button" class="us-scoperow" data-usscopepick="' + k + '">' +
          '<span class="us-cbx' + (on ? " is-on" : "") + '">' + ui.icon("check", 14) + "</span>" +
          '<span class="us-scoperow__tx"><span>' + label + '</span><span class="us-scoperow__s">' + sub + "</span></span></button>";
      }
      var ov = Uni.center({
        title: "视角",
        body: '<div class="us-scopebox">' +
          rowHtml("self", tSelf, "省代自营线", "管理员码与员工码带来的用户") +
          rowHtml("sub", tSub, "二级线", "二级合作企业码带来的用户（只读）") +
          '<div class="uh-note">切换视角会重置筛选与分页。</div></div>',
        footer: [
          { t: "取消", kind: "ghost" },
          { t: "确认", kind: "primary", onClick: function () {
              if (!tSelf && !tSub) { Uni.toast("至少保留一条获客线"); return false; }
              if (tSelf === scopeSet.self && tSub === scopeSet.sub) return true;
              scopeSet = { self: tSelf, sub: tSub };
              resetFilters(); visibleCount = PAGE_SIZE; renderAll();
            } }
        ]
      });
      ov.querySelectorAll("[data-usscopepick]").forEach(function (row) {
        row.addEventListener("click", function () {
          var k = row.getAttribute("data-usscopepick");
          if (k === "self") tSelf = !tSelf; else tSub = !tSub;
          if (!tSelf && !tSub) {
            Uni.toast("至少保留一条获客线");
            if (k === "self") tSelf = true; else tSub = true;
          }
          row.querySelector(".us-cbx").classList.toggle("is-on", k === "self" ? tSelf : tSub);
        });
      });
    }

    /* ---------- 明细：逐笔消费记录 ---------- */
    function recordsOf(cohort) {
      var out = [];
      cohort.forEach(function (l) {
        (l.consumption || []).forEach(function (c) {
          var ct = U.consumeTypeOf(c.type);
          if (fType !== "all" && c.type !== fType) return;
          if (fElig === "ok" && !ct.eligible) return;
          if (fElig === "no" && ct.eligible) return;
          out.push({ lead: l, date: c.date || "", type: c.type, amount: c.amount || 0, line: l.__line, eligible: ct.eligible });
        });
      });
      out.sort(function (a, b) {
        var d = String(b.date).localeCompare(String(a.date));
        return d !== 0 ? d : String(a.lead.id).localeCompare(String(b.lead.id));
      });
      return out;
    }
    function recRowHtml(rec, i) {
      var ct = U.consumeTypeOf(rec.type);
      var codeNm = codeNameOf(rec.lead);
      return '<button type="button" class="us-rrow" data-usrec="' + i + '">' +
        '<span class="us-rrow__amt">' + ui.money(rec.amount) + "</span>" +
        '<span class="us-rrow__body">' +
          '<span class="us-rrow__t">' + ui.esc(ct.label) +
            (ct.eligible ? '<span class="us-tag is-ok">计入合格</span>' : '<span class="us-tag">不计合格</span>') +
            (rec.line === "sub" ? '<span class="us-tag is-line">二级线</span>' : "") +
          "</span>" +
          '<span class="us-rrow__s">' + ui.esc(rec.date || "—") + " · " +
            ui.esc(U.maskName(rec.lead.name)) + " · " + ui.esc(U.maskPhone(rec.lead.phone)) + "</span>" +
          '<span class="us-rrow__src">来源 ' + ui.esc(rec.lead.owner || "—") +
            (codeNm ? " · " + ui.esc(codeNm) : "") + "</span>" +
        "</span>" +
        '<span class="us-rrow__chev">' + ui.icon("chev", 14) + "</span></button>";
    }
    function detailBodyHtml() {
      var cohort = merged().filter(matchesCohort);
      var recs = recordsOf(cohort);
      var filtered = activeSummary().length > 0;
      if (!recs.length) {
        return '<section class="uh-sec"><div class="us-emptywrap">' + Uni.emptyHtml(
          filtered ? "暂无匹配记录" : vm.empty.title,
          filtered ? "当前筛选条件下没有符合条件的消费记录，可调整条件后重试" : vm.empty.desc, "receipt") + "</div></section>";
      }
      var el = 0, amt = 0;
      recs.forEach(function (r) { if (r.eligible) { el += 1; amt += r.amount; } });
      var shown = recs.slice(0, visibleCount);
      var html = '<section class="uh-sec"><div class="us-sum">' +
        '<span class="us-sum__l"><b>' + recs.length + "</b> 笔消费 · <b>" + el + "</b> 笔合格</span>" +
        '<span class="us-sum__r">合格金额 <b>' + ui.money(amt) + "</b></span></div>" +
        '<div class="us-rlist">' + shown.map(recRowHtml).join("") + "</div>" +
        loadFootHtml(recs.length, shown.length, filtered) + "</section>";
      return html;
    }
    function openRecSheet(rec) {
      var l = rec.lead, ct = U.consumeTypeOf(rec.type);
      var codeNm = codeNameOf(l);
      var rows = [
        ["用户", U.maskName(l.name) + " · " + U.maskPhone(l.phone)],
        ["企业", l.company ? U.maskCompany(l.company) : "—"],
        ["消费事项", ct.label],
        ["消费金额", ui.money(rec.amount)],
        ["消费日期", rec.date || "—"],
        ["合格口径", ct.eligible ? "计入合格消费" : "不计入合格消费"],
        ["来源成员", l.owner || "—"],
        ["渠道码", (l.code || "—") + (codeNm ? " · " + codeNm : "")],
        ["归属线别", LINE_LABEL[rec.line] || "—"],
        ["获客时间", leadDate(l) || "—"],
        ["当前阶段", lifecycleOf(l)],
        ["该用户合格消费累计", ui.money(eligibleSum(l))]
      ];
      var body = rows.map(function (r) {
        return '<div class="uh-sheetkv"><span class="k">' + ui.esc(r[0]) + '</span><span class="v">' + ui.esc(r[1]) + "</span></div>";
      }).join("") +
        (ct.eligible ? "" : '<div class="uh-note">企业入驻费属于入驻成本，不计入合格消费，不参与分佣计算。</div>');
      Uni.sheet({ title: "消费明细", body: body, footer: [{ t: "关闭", kind: "ghost" }] });
    }

    /* ---------- 统计：KPI / 漏斗 / 来源效能 / 事项构成 / 口径 ---------- */
    function kvHtml(k, v) { return '<div class="uh-kv"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>"; }

    function settlementCardHtml(s) {
      var rows = s.rows.map(function (r) { return kvHtml(ui.esc(r.k), ui.esc(r.v)); }).join("");
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">' + ui.esc(s.eyebrow) + "</span>" +
        '<span class="uh-badge uh-badge--gold">月度对账</span></div>' +
        '<div class="uh-bignum">' + ui.moneyD(s.big) + "</div>" +
        '<div class="uh-ledgerline"></div>' + rows +
        (s.note ? '<div class="uh-note">' + ui.esc(s.note) + "</div>" : "") + "</section>";
    }

    function kpiCardHtml(a) {
      var aov = a.paid > 0 ? Math.round(a.eligible / a.paid) : 0;
      var okRate = a.all > 0 ? Math.round(a.eligible / a.all * 100) + "%" : "—";
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">获客用户合格消费 · 明细口径</span></div>' +
        '<div class="uh-bignum">' + ui.moneyD(a.eligible) + "</div>" +
        '<div class="us-mini"><span>付费用户 <b>' + a.paid + "</b> 人</span><i></i>" +
        "<span>客单价 <b>" + ui.money(aov) + "</b></span><i></i>" +
        "<span>合格金额占比 <b>" + okRate + "</b></span></div>" +
        '<div class="uh-ledgerline"></div>' +
        kvHtml("全部消费（含入驻费）", ui.money(a.all)) +
        kvHtml("消费笔数", a.recs + " 笔") +
        kvHtml("合格笔数", a.eligibleRecs + " 笔") +
        '<div class="uh-note">合格口径：订单成交实付净额、积分解锁实付、增值服务实付；企业入驻费不计入。' +
        (isSubMode ? "本卡为逐笔合计，与月度对账卡口径不同。" : "") + "</div></section>";
    }

    function funnelCardHtml(a) {
      var labels = ["获客用户", "完成注册", "完成认证", "完成入驻", "产生合格消费"];
      var base = a.ranks[0];
      var rows = labels.map(function (lb, i) {
        var v = a.ranks[i], pct = base > 0 ? Math.round(v / base * 100) : 0;
        return '<div class="us-fnl__row' + (i === labels.length - 1 ? " is-final" : "") + '">' +
          '<div class="us-fnl__hd"><span class="us-fnl__label">' + lb + "</span>" +
          '<span class="us-fnl__num"><b>' + v + '</b> 人<span class="us-fnl__pct">' + pct + "%</span></span></div>" +
          '<div class="us-fnl__track"><div class="us-fnl__bar" style="width:' + Math.max(pct, v > 0 ? 2 : 0) + '%"></div></div>' +
          "</div>";
      }).join("");
      var overall = base > 0 ? Math.round(a.ranks[4] / base * 100) + "%" : "—";
      var regRate = base > 0 ? Math.round(a.ranks[1] / base * 100) + "%" : "—";
      var lost = base - a.ranks[1];
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">获客转化漏斗</span>' +
        '<span class="uh-badge uh-badge--mute">' + base + " 位用户</span></div>" +
        '<div class="us-fnl">' + rows + "</div>" +
        '<div class="us-fnl__foot"><span>注册率 <b>' + regRate + "</b></span>" +
        "<span>整体转化 <b>" + overall + "</b></span>" +
        "<span>游客/流失 <b>" + lost + "</b></span></div>" +
        '<div class="uh-note">完成认证 = 已完成个人或企业认证；完成入驻 = 已完成企业入驻或已加入入驻企业；产生合格消费 = 至少一笔计入合格口径的消费。</div>' +
        "</section>";
    }

    /* 来源分组：自营线按渠道码、二级线按合作企业；两者都按合格消费降序 */
    function groupRowsOf(leads, keyFn, labelFn, tagFn) {
      var g = {}, order = [];
      leads.forEach(function (l) {
        var k = keyFn(l);
        if (!g[k]) { g[k] = { key: k, leads: [] }; order.push(k); }
        g[k].leads.push(l);
      });
      var rows = order.map(function (k) {
        var ls = g[k].leads, paid = 0, amt = 0;
        ls.forEach(function (l) {
          var e = eligibleSum(l);
          if (e > 0) paid += 1;
          amt += e;
        });
        return { key: k, label: labelFn(g[k].leads[0], k), tag: tagFn(g[k].leads[0], k), leads: ls.length, paid: paid, amount: amt };
      });
      rows.sort(function (a, b) { return b.amount - a.amount || b.leads - a.leads; });
      return rows;
    }
    function grpRowHtml(r, maxAmt) {
      var w = maxAmt > 0 ? Math.max(Math.round(r.amount / maxAmt * 100), r.amount > 0 ? 4 : 0) : 0;
      return '<div class="us-grp">' +
        '<div class="us-grp__top"><span class="us-grp__name">' + ui.esc(r.label) +
        (r.tag ? '<span class="us-grp__tag">' + ui.esc(r.tag) + "</span>" : "") + "</span>" +
        '<span class="us-grp__amt">' + ui.money(r.amount) + "</span></div>" +
        '<div class="us-grp__meta">获客 ' + r.leads + " · 付费 " + r.paid + " · 付费率 " + pctOf(r.paid, r.leads) + "</div>" +
        '<div class="us-grp__track"><div class="us-grp__bar" style="width:' + w + '%"></div></div></div>';
    }

    function sourceCardHtml(cohort) {
      var selfLeads = cohort.filter(function (l) { return l.__line !== "sub"; });
      var subLeads = cohort.filter(function (l) { return l.__line === "sub"; });
      var blocks = [];
      if (selfLeads.length) {
        var rows = groupRowsOf(selfLeads,
          function (l) { return l.code || "none"; },
          function (l, k) { return codeNameOf(l) || (k === "none" ? "未挂渠道码" : k); },
          function (l) { return l.code || ""; });
        blocks.push({ head: isSubMode ? "按渠道码（本企业）" : "按自营渠道码", rows: rows });
      }
      if (subLeads.length) {
        var srows = groupRowsOf(subLeads,
          function (l) { return l.subId || "none"; },
          function (l, k) { var x = subsById[k]; return (x && x.name) || "未知合作企业"; },
          function () { return "二级线"; });
        blocks.push({ head: "按二级合作企业", rows: srows });
      }
      if (!blocks.length) return "";
      var maxAmt = 0;
      blocks.forEach(function (b) { b.rows.forEach(function (r) { if (r.amount > maxAmt) maxAmt = r.amount; }); });
      var html = "";
      blocks.forEach(function (b) {
        if (blocks.length > 1 || isSubMode) html += '<div class="uh-sechead"><span class="lbl">' + ui.esc(b.head) + "</span></div>";
        html += b.rows.map(function (r) { return grpRowHtml(r, maxAmt); }).join("");
      });
      /* 成员维度：仅管理员类身份且成员 ≥2 */
      var mems = membersOf(cohort);
      if (vm.showMembers && mems.length > 1) {
        var mrows = groupRowsOf(cohort, function (l) { return l.owner || "未知成员"; },
          function (l, k) { return k; }, function () { return ""; });
        html += '<div class="uh-sechead"><span class="lbl">按来源成员</span></div>' +
          mrows.map(function (r) { return grpRowHtml(r, maxAmt); }).join("");
      }
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">来源效能</span>' +
        '<span class="uh-badge uh-badge--mute">金额为合格消费</span></div>' + html + "</section>";
    }

    function typeCardHtml(cohort) {
      var m = {}, order = [];
      cohort.forEach(function (l) {
        (l.consumption || []).forEach(function (c) {
          if (!m[c.type]) { m[c.type] = { type: c.type, count: 0, amount: 0 }; order.push(c.type); }
          m[c.type].count += 1; m[c.type].amount += c.amount || 0;
        });
      });
      if (!order.length) return "";
      var rows = order.map(function (k) { return m[k]; });
      rows.sort(function (a, b) { return b.amount - a.amount; });
      var max = rows[0].amount || 1;
      var html = rows.map(function (r) {
        var ct = U.consumeTypeOf(r.type);
        return '<div class="us-comp">' +
          '<div class="us-comp__top"><span class="us-comp__n">' + ui.esc(ct.label) +
          (ct.eligible ? "" : '<span class="us-tag">不计合格</span>') + "</span>" +
          '<span class="us-comp__v">' + r.count + " 笔 · " + ui.money(r.amount) + "</span></div>" +
          '<div class="us-comp__track"><div class="us-comp__bar' + (ct.eligible ? "" : " is-mute") +
          '" style="width:' + Math.max(Math.round(r.amount / max * 100), 3) + '%"></div></div></div>';
      }).join("");
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">消费事项构成</span>' +
        '<span class="uh-badge uh-badge--mute">全部事项</span></div>' + html + "</section>";
    }

    function clauseCardHtml(clauses) {
      return '<section class="card uh-sec">' +
        '<button type="button" class="us-fold" data-usfold aria-expanded="false">' +
        "<span>" + ui.icon("info", 15) + "分佣与口径说明</span>" +
        '<span class="us-fold__chev">' + ui.icon("chev", 14) + "</span></button>" +
        '<div class="us-foldbody" hidden>' +
        clauses.map(function (c) {
          return '<div class="uh-clause"><div class="no">' + ui.esc(c.no) + '</div><div class="c">' + ui.esc(c.c) + "</div></div>";
        }).join("") + "</div></section>";
    }

    function statsBodyHtml() {
      var cohort = merged().filter(matchesCohort);
      if (!cohort.length) {
        var filtered = activeSummary().length > 0;
        return '<section class="uh-sec"><div class="us-emptywrap">' + Uni.emptyHtml(
          filtered ? "当前筛选下暂无数据" : vm.empty.title,
          filtered ? "可放宽获客日期或渠道条件后重试" : vm.empty.desc, "chart") + "</div></section>";
      }
      var a = aggOf(cohort);
      var html = "";
      if (vm.settlement) html += settlementCardHtml(vm.settlement);
      html += kpiCardHtml(a);
      html += funnelCardHtml(a);
      html += sourceCardHtml(cohort);
      html += typeCardHtml(cohort);
      html += clauseCardHtml(vm.clauses);
      return html;
    }

    /* ---------- 分析：环比 / 趋势 / 健康度 / 建议 / 口径 ---------- */
    function monthAgg(cohort) {
      var m = {};
      cohort.forEach(function (l) {
        var mm = monthOf(leadDate(l));
        if (!mm) return;
        if (!m[mm]) m[mm] = { month: mm, leads: 0, paid: 0, amount: 0 };
        m[mm].leads += 1;
        var e = eligibleSum(l);
        if (e > 0) { m[mm].paid += 1; m[mm].amount += e; }
      });
      return m;
    }
    function periodOf(cohort, byMonth) {
      var keys = Object.keys(byMonth).sort();
      var cur = keys.length ? keys[keys.length - 1] : monthOf(fmtDate(new Date()));
      return { cur: cur, prev: monthShift(cur, -1) };
    }
    function num(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
    /* suffix：人 / pt 等量词；isMoney：金额差值补 ¥ 前缀，避免与旁列 ¥ 金额混淆 */
    function deltaChip(cur, prev, suffix, isMoney) {
      var d = cur - prev;
      if (d === 0) return '<span class="us-delta is-flat">持平</span>';
      var cls = d > 0 ? " is-up" : " is-down";
      var sign = d > 0 ? "+" : "−";
      return '<span class="us-delta' + cls + '">' + sign + (isMoney ? "¥" : "") + num(Math.abs(d)) + (suffix || "") + "</span>";
    }

    function compareCardHtml(byMonth, cur, prev) {
      var c = byMonth[cur] || { leads: 0, paid: 0, amount: 0 };
      var p = byMonth[prev] || { leads: 0, paid: 0, amount: 0 };
      var cr = c.leads > 0 ? Math.round(c.paid / c.leads * 100) : 0;
      var pr = p.leads > 0 ? Math.round(p.paid / p.leads * 100) : 0;
      function row(label, cv, pv, chip, noBase) {
        return '<div class="us-cmp__row"><div class="us-cmp__top"><span class="us-cmp__k">' + label + "</span>" +
          '<span class="us-cmp__v">' + cv + chip + "</span></div>" +
          '<div class="us-cmp__meta">' + (noBase ? "上期无获客，环比无基数" : "上期 " + pv) + "</div></div>";
      }
      var isCurMonth = cur === monthOf(fmtDate(new Date()));
      /* noBase 只看「上期有没有获客」：上期有获客但为 0 付费/0 消费是真实零值，
         不能标成「无数据」；只有整月没有获客时，环比才没有比较基数。 */
      var noBase = p.leads === 0;
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">环比 · 本期 vs 上期</span>' +
        '<span class="uh-badge uh-badge--mute">' + ui.esc(cur) + " / " + ui.esc(prev) + "</span></div>" +
        row("新增获客", c.leads + " 人", p.leads + " 人", deltaChip(c.leads, p.leads), noBase) +
        row("付费用户", c.paid + " 人", p.paid + " 人", deltaChip(c.paid, p.paid), noBase) +
        row("付费率", cr + "%", pr + "%", deltaChip(cr, pr, "pt"), noBase) +
        row("合格消费", ui.money(c.amount), ui.money(p.amount), deltaChip(c.amount, p.amount, "", true), noBase) +
        '<div class="uh-note">按获客月份归集：本期为 ' + ui.esc(cur) + " 获客用户在其后产生的合格消费累计，上期为 " +
        ui.esc(prev) + " 获客用户。付费用户 = 已产生至少一笔合格消费的用户。" +
        (isCurMonth ? "本期仍在累计中，与已结束的上期比较需注意数据尚未成熟。" : "") + "</div></section>";
    }

    function trendCardHtml(byMonth, cur) {
      var keys = Object.keys(byMonth).sort();
      var start = keys.length ? keys[0] : cur;
      var list = [];
      for (var i = ymInt(start); i <= ymInt(cur); i++) list.push(intYm(i));
      if (list.length > 6) list = list.slice(list.length - 6);
      var max = 0;
      list.forEach(function (m) { var a = byMonth[m]; if (a && a.leads > max) max = a.leads; });
      var cols = list.map(function (m) {
        var a = byMonth[m] || { leads: 0, paid: 0, amount: 0 };
        var h = max > 0 ? Math.max(Math.round(a.leads / max * 84), a.leads > 0 ? 8 : 3) : 3;
        return '<div class="us-trend__col">' +
          '<span class="us-trend__v">' + a.leads + "</span>" +
          '<span class="us-trend__track"><span class="us-trend__bar" style="height:' + h + 'px"></span></span>' +
          '<span class="us-trend__m">' + monthShort(m) + "</span>" +
          '<span class="us-trend__r">' + (a.leads > 0 ? Math.round(a.paid / a.leads * 100) + "%" : "—") + "</span>" +
          "</div>";
      }).join("");
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">获客趋势</span>' +
        '<span class="uh-badge uh-badge--mute">近 ' + list.length + " 个月</span></div>" +
        '<div class="us-trend">' + cols + "</div>" +
        '<div class="uh-note">柱高 = 当月新增获客人数；灰字为当月获客用户的付费率。</div></section>';
    }

    function healthOf(cohort) {
      var todo = [], silent = [], valuable = [];
      cohort.forEach(function (l) {
        var r = rankOf(l), e = eligibleSum(l);
        if (r === 1) todo.push(l);
        if (r === 1) {
          var gap = dayGap(l.loginAt || leadDate(l));
          if (gap != null && gap >= 30) silent.push(l);
        } else if (lifecycleOf(l) === "流失") {
          silent.push(l);
        }
        if (e > 0) valuable.push({ l: l, e: e });
      });
      valuable.sort(function (a, b) { return b.e - a.e; });
      return { todo: todo, silent: silent, valuable: valuable.slice(0, 3) };
    }
    function openListSheet(title, desc, rows) {
      var body = '<div class="us-ulnote">' + ui.esc(desc) + "</div>" +
        (rows.length ? '<div class="us-ulist">' + rows.map(function (r) {
          return '<div class="us-urow"><span class="us-urow__n">' + ui.esc(r.n) + "</span>" +
            '<span class="us-urow__s">' + ui.esc(r.s) + "</span>" +
            '<span class="us-urow__a">' + ui.esc(r.a) + "</span></div>";
        }).join("") + "</div>" : Uni.emptyHtml("暂无数据", "当前视角下没有符合条件的用户", "user"));
      Uni.sheet({ title: title, body: body, footer: [{ t: "关闭", kind: "ghost" }] });
    }

    function healthCardHtml(h) {
      var total = h.valuable.reduce(function (s, x) { return s + x.e; }, 0);
      /* empty=true 表示这一类当前没有用户：不可点、无箭头，
         避免点开一个空清单的死路。 */
      function row(key, ic, title, desc, n, empty) {
        var inner =
          '<span class="us-hrow__ic">' + ui.icon(ic, 17) + "</span>" +
          '<span class="us-hrow__body"><span class="us-hrow__t">' + title + "</span>" +
          '<span class="us-hrow__s">' + desc + "</span></span>" +
          '<span class="us-hrow__n">' + n + "</span>";
        if (empty) return '<div class="us-hrow is-empty">' + inner + "</div>";
        return '<button type="button" class="us-hrow" data-ushealth="' + key + '">' + inner +
          '<span class="us-hrow__chev">' + ui.icon("chev", 14) + "</span></button>";
      }
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">用户健康度</span></div>' +
        row("todo", "clock", "待转化", "已注册但尚未产生合格消费", h.todo.length + " 人", h.todo.length === 0) +
        row("silent", "alert-circle", "沉寂预警", "已流失，或未付费且超 30 天未登录", h.silent.length + " 人", h.silent.length === 0) +
        row("value", "crown", "高价值用户", "合格消费 TOP3", ui.money(total), total <= 0) +
        "</section>";
    }

    function tipsOf(a, h, byMonth, cur, prev) {
      var out = [];
      var c = byMonth[cur] || { leads: 0, paid: 0, amount: 0 };
      var p = byMonth[prev] || { leads: 0, paid: 0, amount: 0 };
      var cr = c.leads > 0 ? Math.round(c.paid / c.leads * 100) : 0;
      var pr = p.leads > 0 ? Math.round(p.paid / p.leads * 100) : 0;
      if (c.leads > p.leads && cr < pr) {
        out.push({ w: 4, ic: "warn", t: "新增在涨、转化在降",
          d: "本期新增 " + c.leads + " 人（上期 " + p.leads + " 人），付费率由 " + pr + "% 降至 " + cr +
            "%。建议对注册 7 天内的用户安排首单引导，别让量变空转。" });
      } else if (pr - cr >= 10) {
        out.push({ w: 3, ic: "warn", t: "付费率明显回落",
          d: "本期付费率 " + cr + "%，较上期 " + pr + "% 下降 " + (pr - cr) +
            " 个百分点。建议回看本期获客的渠道与首次沟通话术，确认是否引入了低意向人群。" });
      }
      if (h.todo.length >= 5) {
        out.push({ w: 3, ic: "clock", t: h.todo.length + " 位已注册用户还未产生消费",
          d: "这批人已完成注册、停在转化第一步，是当前最容易撬动的增量。建议按渠道码分批指派跟进。" });
      }
      if (h.silent.length >= 1) {
        out.push({ w: 2, ic: "alert-circle", t: h.silent.length + " 位用户已沉寂超过 30 天",
          d: "其中含已标记流失的用户。建议本周内做一次电话或短信召回，避免线索彻底冷却。" });
      }
      var top = null;
      var groups = {};
      merged().forEach(function (l) {
        if (l.__line === "sub") return;
        var k = l.code || "none";
        groups[k] = (groups[k] || 0) + 1;
      });
      Object.keys(groups).forEach(function (k) {
        if (!top || groups[k] > groups[top]) top = k;
      });
      var total = 0;
      Object.keys(groups).forEach(function (k) { total += groups[k]; });
      if (top && total >= 8 && groups[top] / total >= 0.4) {
        var nm = codeMap[top] ? codeMap[top].name : top;
        out.push({ w: 1, ic: "chart", t: "获客集中在单一渠道码",
          d: "「" + nm + "」贡献 " + Math.round(groups[top] / total * 100) + "% 的获客，单一渠道波动会直接影响总量。建议再培育 1–2 个稳定的渠道码。" });
      }
      out.sort(function (x, y) { return y.w - x.w; });
      if (!out.length) {
        out.push({ w: 0, ic: "check-circle", t: "转化节奏平稳",
          d: "本期各项指标无明显异常波动，保持现有跟进节奏即可。" });
      }
      return out.slice(0, 3);
    }
    function tipsCardHtml(tips) {
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">运营建议</span>' +
        '<span class="uh-badge uh-badge--mute">基于当前数据</span></div>' +
        tips.map(function (t) {
          return '<div class="us-tip"><span class="us-tip__ic">' + ui.icon(t.ic, 16) + "</span>" +
            '<div class="us-tip__b"><div class="us-tip__t">' + ui.esc(t.t) + "</div>" +
            '<div class="us-tip__d">' + ui.esc(t.d) + "</div></div></div>";
        }).join("") + "</section>";
    }

    function analysisBodyHtml() {
      var cohort = merged();
      if (!cohort.length) {
        return '<section class="uh-sec"><div class="us-emptywrap">' + Uni.emptyHtml(vm.empty.title, vm.empty.desc, "chart") + "</div></section>";
      }
      var byMonth = monthAgg(cohort);
      var per = periodOf(cohort, byMonth);
      var a = aggOf(cohort);
      var h = healthOf(cohort);
      var tips = tipsOf(a, h, byMonth, per.cur, per.prev);
      var lineText = scopeSet.self && scopeSet.sub ? "自营线 + 二级线" : scopeSet.sub ? "二级线" : (isSubMode ? "本企业线" : "自营线");
      return '<section class="uh-sec"><div class="us-scopeline">' +
        '<span class="us-scopeline__l">' + ui.icon("chart", 14) + "分析口径</span>" +
        '<span class="us-scopeline__r">' + ui.esc(lineText) + " · " + a.leads + " 位获客用户</span></div>" +
        '<div class="uh-note us-scopenote">分析按自然月归集，不受明细筛选影响；金额为合格消费。</div></section>' +
        compareCardHtml(byMonth, per.cur, per.prev) +
        trendCardHtml(byMonth, per.cur) +
        healthCardHtml(h) +
        tipsCardHtml(tips) +
        clauseCardHtml([
          { no: "本期/上期", c: "按获客月份归集：本期 = " + per.cur + " 获客的用户，上期 = " + per.prev + " 获客的用户。" },
          { no: "付费率", c: "当期获客用户中已产生至少一笔合格消费的人数占比。" },
          { no: "沉寂预警", c: "已标记流失，或尚未产生合格消费且最近登录距今满 30 天。" },
          { no: "高价值用户", c: "按累计合格消费降序取前 3 位，用于重点维护。" }
        ]);
    }

    function openHealthSheet(key, h) {
      if (key === "todo") {
        openListSheet("待转化用户", "已完成注册、尚未产生合格消费的用户。",
          h.todo.map(function (l) {
            return { n: U.maskName(l.name), s: (leadDate(l) || "—") + " · 来源 " + (l.owner || "—"), a: "未消费" };
          }));
      } else if (key === "silent") {
        openListSheet("沉寂预警", "已流失，或未付费且最近登录距今满 30 天的用户。",
          h.silent.map(function (l) {
            var gap = dayGap(l.loginAt || leadDate(l));
            return { n: U.maskName(l.name), s: lifecycleOf(l) + (gap != null ? " · 最近活跃 " + gap + " 天前" : ""), a: lifecycleOf(l) === "流失" ? "已流失" : "待召回" };
          }));
      } else {
        openListSheet("高价值用户", "按累计合格消费降序排列的前 3 位用户。",
          h.valuable.map(function (x) {
            return { n: U.maskName(x.l.name), s: (leadDate(x.l) || "—") + " · 来源 " + (x.l.owner || "—"), a: ui.money(x.e) };
          }));
      }
    }

    /* ---------- 页面骨架 ---------- */
    function syncScopeTop() {
      var btn = document.getElementById("us-scope-top");
      if (!btn) return;
      if (!canScope) { btn.style.display = "none"; return; }
      btn.style.display = "";
      var hint = document.getElementById("us-scope-hint");
      if (hint) hint.textContent = (scopeSet.self ? "自营线" : "") + (scopeSet.self && scopeSet.sub ? " + " : "") + (scopeSet.sub ? "二级线" : "");
    }
    function renderAll() {
      var html = "";
      /* ★ 全页唯一主 bar：吸顶，不随内容滚动（与获客记录同源） */
      html += '<div class="us-mainbar"><section class="uh-sec us-mainsec"><div class="seg us-mainseg" role="tablist">' +
        '<button class="seg-item' + (view === "detail" ? " active" : "") + '" data-usview="detail">明细</button>' +
        '<button class="seg-item' + (view === "stats" ? " active" : "") + '" data-usview="stats">统计</button>' +
        '<button class="seg-item' + (view === "analysis" ? " active" : "") + '" data-usview="analysis">分析</button>' +
        "</div></section></div>";
      if (ctx.readonly) {
        html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">' + ui.esc(vm.lockedTitle) + "（仅可查看）</span>" +
          '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
      }
      if (vm.note) {
        html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + "<span>" + ui.esc(vm.note) + "</span></div></section>";
      }
      if (view === "detail") html += filterRowHtml() + detailBodyHtml();
      else if (view === "stats") html += filterRowHtml() + statsBodyHtml();
      else html += analysisBodyHtml();
      el.innerHTML = html;
      syncScopeTop();
    }

    renderAll();

    var topScopeBtn = document.getElementById("us-scope-top");
    if (topScopeBtn) topScopeBtn.addEventListener("click", function () { openScopeCenter(); });

    /* ---------- 事件委派（一次绑定，随 renderAll 重建子节点仍生效） ---------- */
    el.addEventListener("click", function (e) {
      var v = e.target.closest("[data-usview]");
      if (v) {
        view = v.getAttribute("data-usview");
        visibleCount = PAGE_SIZE;
        renderAll();
        el.scrollTop = 0;
        return;
      }
      var cap = e.target.closest("[data-usdatecap]");
      if (cap) {
        var dk = cap.getAttribute("data-usdatecap");
        fQuick = dk;
        if (dk === "all") { fStart = ""; fEnd = ""; }
        else { var dr = quickRange(dk); fStart = dr.start; fEnd = dr.end; }
        visibleCount = PAGE_SIZE; renderAll(); return;
      }
      if (e.target.closest("[data-usfilter]")) { openFilterSheet(); return; }
      if (e.target.closest("[data-loadmore]")) { visibleCount += PAGE_SIZE; renderAll(); return; }
      var fb = e.target.closest("[data-usfold]");
      if (fb) {
        var body = fb.parentNode.querySelector(".us-foldbody");
        if (body) {
          var open = !!body.hidden;
          body.hidden = !open;
          fb.classList.toggle("is-open", open);
          fb.setAttribute("aria-expanded", open ? "true" : "false");
        }
        return;
      }
      var hb = e.target.closest("[data-ushealth]");
      if (hb) {
        var hk = hb.getAttribute("data-ushealth");
        openHealthSheet(hk, healthOf(merged()));
        return;
      }
      var rr = e.target.closest("[data-usrec]");
      if (rr) {
        var recs = recordsOf(merged().filter(matchesCohort));
        var rec = recs[Number(rr.getAttribute("data-usrec"))];
        if (rec) openRecSheet(rec);
      }
    });
  }

  window.Uni.register({
    view: "uni-invite-stats",
    route: "invite-stats.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
