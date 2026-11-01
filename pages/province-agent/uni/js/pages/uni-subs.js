/* ============================================================
   uni-subs.js · 二级合作管理（E024–E033）
   ┌ 省代视角（province）：合作总览 → 待办提醒 → 三段 tab
   │  · 生效中：协议 / 状态 / 约定比例 / 本月应得四要素一屏可读；
   │    待签与暂停卡内直接给「重发协议 / 恢复合作」一键入口；
   │  · 待审批：申请详情 → 通过（落档案 + 生成待签协议）/ 驳回（留痕）；
   │  · 已驳回：申请与驳回原因留痕，支持重新发起；
   │  · 已结束：终止档案只读查阅（归档 tab，仅在有档案时出现）。
   └ 二级视角（sub）：合作档案 + 本月所得拆解 + 协议签署入口 + 相关入口。
   身份差异只落在 STATE_VARIANTS（perms / note / lockedNote / readonly），
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;
  var esc = ui.esc;
  var G = 0.5; /* 规则常量：二级线分佣比例 50%（与 Uni.financeSplit 同源） */
  /* 约定比例区间：与 store.CONST 同源（当前 0–50%），界面文案不写死数字 */
  var RC = store.CONST || {};
  var RATIO_MIN = Math.round(Number(RC.ratioMin || 0) * 100);
  var RATIO_MAX = Math.round(Number(RC.ratioMax || 0.5) * 100);

  var REJECT_QUICK = ["资质不符", "经营范围不符", "信息填写有误", "重复提交"];
  var ITEM_LABEL = { cert: "证书认证", entry: "入驻申请", unlock: "解锁供需", order: "订单支付" };

  /* 协议状态字典：pending = 待对方（二级）签署；pending_mine = 待我方（二级）签署 */
  var AG_STATE = {
    signed: { t: "已签署", cls: "ok" },
    pending: { t: "待对方签署", cls: "info" },
    pending_mine: { t: "待我方签署", cls: "info" },
    rejected: { t: "已拒签", cls: "bad" }
  };
  function agInfo(st) { return AG_STATE[st] || AG_STATE.signed; }

  /* ---------- 招商申请跨端覆盖层（工作台合并展示与审批）
     注：写入方 pages/apply/ 已下线；本键保留用于读取历史/种子数据，勿删，
     否则已存在的申请记录会在工作台凭空消失。 ---------- */
  var SUB_APPS_KEY = "engchain-sub-apps";
  function readKey(k) {
    try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; }
  }
  function writeKey(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function mergedSubApps(s) {
    var base = (s.subApps || []).slice();
    readKey(SUB_APPS_KEY).forEach(function (a) {
      if (!base.some(function (x) { return x.id === a.id; })) base.push(a);
    });
    return base;
  }
  function isStoreApp(id) {
    return (store.getState().state.subApps || []).some(function (x) { return x.id === id; });
  }
  function markLocalApp(id, status, reason) {
    var list = readKey(SUB_APPS_KEY);
    list.forEach(function (a) {
      if (a.id !== id) return;
      a.status = status;
      a.handledAt = todayStr();
      if (reason) a.rejectReason = reason;
    });
    writeKey(SUB_APPS_KEY, list);
  }
  /* 审批桥接：工作台种子申请走 app/review；跨端申请先落库再审批，避免
     「通过后档案重复 / 列表不刷新」两处历史问题（旧实现在 LS 里另建 active）。 */
  function approveApp(a) {
    if (isStoreApp(a.id)) return store.act("app/review", { id: a.id, pass: true });
    if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(String(a.uscc || "").toUpperCase())) {
      return { ok: false, reason: "统一社会信用代码不符合规范（18 位，不含 I/O/S/V/Z）" };
    }
    var r = store.act("app/create", {
      data: {
        name: a.name, uscc: a.uscc, contact: a.contact, phone: a.phone,
        address: a.address, ratio: a.ratio == null ? 0.2 : a.ratio
      },
      channel: a.channel || "agent"
    });
    if (!r.ok) return r;
    var d = store.getState().state;
    var created = d.subApps[d.subApps.length - 1];
    r = store.act("app/review", { id: created.id, pass: true });
    if (r.ok) markLocalApp(a.id, "approved");
    return r;
  }
  function rejectApp(a, reason) {
    if (isStoreApp(a.id)) return store.act("app/review", { id: a.id, pass: false, reason: reason });
    markLocalApp(a.id, "rejected", reason);
    return { ok: true };
  }

  /* ---------- 本页局部：重发后的协议状态覆盖 ----------
     store 的 agree/resend 只落消息与留痕、不改协议状态（公共库只读），
     页内用一份 id 白名单把「已重发」呈现为待签，不改动共享数据。 */
  var RESENT_KEY = "engchain-subs-resent";
  function readResent() { return readKey(RESENT_KEY); }
  function isResent(id) { return readResent().indexOf(id) > -1; }
  function markResent(id) {
    var list = readResent();
    if (list.indexOf(id) > -1) return;
    list.push(id);
    writeKey(RESENT_KEY, list);
  }
  /* 省代视角：该合作当前协议状态（含重发覆盖） */
  function agStateOf(p) {
    var st = (p.agreement && p.agreement.state) || "";
    if (!st) return "pending";                 /* 新通过的合作 = 待对方签署 */
    if (st !== "signed" && isResent(p.id)) return "pending";
    return st;
  }

  /* ---------- 通用小工具 ---------- */
  function pct(r) { return Math.round(Number(r || 0) * 100) + "%"; }

  /* ---------- 比例输入（发起合作 / 配置比例 / 批量配置 三处共用） ----------
     整数数字框 + 单位后缀；越界时红框 + 行内提示，提交前再兜底校验一次 */
  function ratioFieldHtml(o) {
    return '<div class="field su-ratiofield' + (o.last ? ' su-ratiofield--last' : '') + '" data-ratio-field>' +
      '<label class="field-label" for="' + o.id + '">' + o.label + '</label>' +
      '<div class="unit-input">' +
        '<input class="input" id="' + o.id + '" type="number" inputmode="numeric" step="1" ' +
          'min="' + RATIO_MIN + '" max="' + RATIO_MAX + '" value="' + o.value + '"' +
          (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') +
          ' aria-describedby="' + o.id + '-msg">' +
        '<span class="unit">%</span>' +
      '</div>' +
      '<div class="su-field-msg" id="' + o.id + '-msg" data-ratio-msg role="alert" hidden></div>' +
      (o.note ? '<div class="uh-note">' + o.note + '</div>' : '') +
      '</div>';
  }

  function bindRatioInput(sh) {
    var field = sh && sh.querySelector("[data-ratio-field]");
    if (!field) return null;
    var inp = field.querySelector("input"), msg = field.querySelector("[data-ratio-msg]");
    var last = inp.value;

    function paint(text) {
      field.classList.toggle("is-err", !!text);
      inp.setAttribute("aria-invalid", text ? "true" : "false");
      if (msg) {
        msg.hidden = !text;
        msg.innerHTML = text ? ui.icon("x-circle", 14) + '<span>' + esc(text) + '</span>' : "";
      }
      if (text) window.requestAnimationFrame(reveal);
    }
    /* 提示出现在输入框下方，字段若已贴到弹窗底边会被挡住——把它滚回可视区 */
    function reveal() {
      var box = field.parentNode;
      while (box && !(box.classList && box.classList.contains("sheet-body"))) box = box.parentNode;
      if (!box) return;
      var br = box.getBoundingClientRect(), fr = field.getBoundingClientRect();
      var k = box.clientHeight ? br.height / box.clientHeight : 1;   /* .phone 的 fit 缩放 */
      var pad = 10 * k;
      if (fr.bottom + pad > br.bottom) box.scrollTop += (fr.bottom + pad - br.bottom) / k;
      else if (fr.top - pad < br.top) box.scrollTop -= (br.top - fr.top + pad) / k;
    }
    function errOf() {
      var raw = inp.value.trim();
      if (raw === "") return "请填写 " + RATIO_MIN + "–" + RATIO_MAX + " 的整数";
      var n = Number(raw);
      if (!/^\d+$/.test(raw)) return "仅可填写整数，请去掉小数或符号";
      if (n > RATIO_MAX) return "超出授权上限：约定比例最高 " + RATIO_MAX + "%，请下调后再提交";
      if (n < RATIO_MIN) return "约定比例不能低于 " + RATIO_MIN + "%";
      return "";
    }

    /* 整数约束（一层）：在插入前拦掉小数点 / 指数 / 正负号 / 空白，连粘贴一起挡 */
    inp.addEventListener("beforeinput", function (e) {
      if (e.data && /\D/.test(e.data)) e.preventDefault();
    });
    /* 整数约束（二层，兜底不支持 beforeinput 的环境） */
    inp.addEventListener("keydown", function (e) {
      if (e.key && e.key.length === 1 && !/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
      }
    });
    /* 输入中：仅越界才提示，不因为中途清空而报错 */
    inp.addEventListener("input", function () {
      if (inp.value !== "" && !/^\d+$/.test(inp.value)) { inp.value = last; return; }
      last = inp.value;
      paint(inp.value.trim() === "" ? "" : errOf());
      if (typeof sh.__ratioChange === "function") sh.__ratioChange(inp.value);
    });

    return {
      input: inp,
      value: function () { return inp.value.trim(); },
      /* 快选芯片等程序化赋值：同步校验态与联动回调 */
      set: function (v) {
        inp.value = String(v);
        last = inp.value;
        paint(inp.value.trim() === "" ? "" : errOf());
        if (typeof sh.__ratioChange === "function") sh.__ratioChange(inp.value);
      },
      refresh: function () { paint(inp.value.trim() === "" ? "" : errOf()); },
      /* 提交前校验：空值也提示，并把焦点送回输入框 */
      validate: function () {
        var e = errOf();
        paint(e);
        if (e) inp.focus();
        return !e;
      }
    };
  }
  function todayStr() {
    var d = new Date(), p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function kv(k, v) { return '<div class="uh-sheetkv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function mgrRow(ic, t, s, act, danger) {
    return '<button type="button" class="uh-row' + (danger ? ' is-danger' : '') + '" data-mgr="' + act + '">' +
      '<span class="uh-row__ic">' + ui.icon(ic, 18) + '</span>' +
      '<span class="uh-row__main"><span class="uh-row__t">' + esc(t) + '</span><span class="uh-row__s">' + esc(s) + '</span></span>' +
      '<span class="uh-chev">' + ui.icon("chev", 16) + '</span></button>';
  }
  /* 已勾选且可批量操作的家数（暂停中的不计） */
  function countSel(live) {
    return Object.keys(_sel).filter(function (id) {
      return live.some(function (p) { return p.id === id && p.status !== "suspended"; });
    }).length;
  }
  function linkRow(ic, t, s, act) {
    return '<button type="button" class="uh-row" data-subact="' + act + '">' +
      '<span class="uh-row__ic">' + ui.icon(ic, 18) + '</span>' +
      '<span class="uh-row__main"><span class="uh-row__t">' + esc(t) + '</span><span class="uh-row__s">' + esc(s) + '</span></span>' +
      '<span class="uh-chev">' + ui.icon("chev", 16) + '</span></button>';
  }

  /* ---------- 模块级交互状态（跨 mount 保留：操作后不跳回首个 tab） ---------- */
  var _multi = false, _sel = {}, _tab = "active", _filter = "all";
  var _ctx = null, _first = true, _lastIdentity = null;
  var _pop = null;
  function closeStatusPop() {
    if (!_pop) return;
    var p = _pop; _pop = null;
    p.classList.remove("show");
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 160);
  }
  document.addEventListener("click", function (e) {
    if (!_pop) return;
    if (e.target && (e.target.closest(".uls-pop") || e.target.closest("[data-more]"))) return;
    closeStatusPop();
  });
  document.addEventListener("scroll", function () { if (_pop) closeStatusPop(); }, true);

  /* ---------- 生效中筛选 ---------- */
  var FILTERS = [
    { k: "all", t: "全部", on: function () { return true; } },
    { k: "wait", t: "待签", on: function (p) { var s = agStateOf(p); return s === "pending" || s === "pending_mine"; } },
    { k: "signed", t: "已签", on: function (p) { return agStateOf(p) === "signed"; } },
    { k: "rej", t: "拒签", on: function (p) { return agStateOf(p) === "rejected"; } },
    { k: "susp", t: "暂停", on: function (p) { return p.status === "suspended"; } }
  ];

  /* ============================================================
     数据视图（两种身份口径，供 STATE_VARIANTS.data 复用）
     ============================================================ */
  function provinceVm(ctx) {
    var s = ctx.s;
    var apps = mergedSubApps(s);
    var subs = (s.subs || []).slice();
    return {
      live: subs.filter(function (p) { return p.status === "active" || p.status === "suspended"; }),
      ended: subs.filter(function (p) { return p.status === "terminated"; }),
      pending: apps.filter(function (a) { return a.status === "pending"; }),
      rejected: apps.filter(function (a) { return a.status === "rejected"; })
    };
  }
  function subVm(ctx) {
    var s = ctx.s, p = s.parent || {};
    var ag = s.agreement || {};
    var calc = (s.calc || [])[0] || {};
    return {
      archive: {
        name: String(p.name || "").replace(/（.*）/, "") || "上级省代",
        uscc: p.uscc || s.profile.uscc,
        contact: p.contact || "",
        phone: p.phone || "",
        address: p.address || "",
        ratioToSub: p.ratioToSub != null ? p.ratioToSub : calc.ratioToSub,
        since: p.since || s.profile.since
      },
      agreement: ag,
      calc: calc,
      live: [], ended: [], pending: [], rejected: []
    };
  }

  /* ============================================================
     身份变体（S1：唯一身份分支点由 mount 内的 stateVariantFor 提供）
     ============================================================ */
  var STATE_VARIANTS = {
    /* —— 省代 —— */
    admin: {
      label: "省级总代 · 管理员",
      data: provinceVm,
      perms: { createApp: true, review: true, setRatio: true, resend: true, status: true, sign: false },
      note: null,
      lockedNote: "审批、比例配置与协议操作均已锁定；恢复账号后可继续操作"
    },
    staff: {
      label: "省级总代 · 员工",
      data: provinceVm,
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false, sign: false },
      note: "员工可查阅全部合作档案、协议与对账；审批、发起合作与比例配置由管理员执行。",
      lockedNote: "员工可查阅全部合作档案；合作管理动作已锁定，仅可查看。"
    },
    legal_rep: {
      label: "省级总代 · 法定代表人",
      data: provinceVm,
      readonly: true,
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false, sign: false },
      note: "法定代表人只读视图：可查阅全部合作档案、协议与对账，不执行审批与配置。",
      /* 2026-11-01 审计修复：锁条现在「暂停 或 身份只读」都会出现，说明文案不能再假设账号已暂停，
         改为对两种来源都成立的中性表述。 */
      lockedNote: "法定代表人为只读视图：可查阅全部合作档案与口径，不执行审批、比例配置与协议操作。"
    },
    /* —— 二级 —— */
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: subVm,
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false, sign: true },
      note: "约定比例由上级省代配置；协议与结算以双方签署版本为准。",
      lockedNote: "分润结算与对账冻结，合作档案仍可查阅；恢复后联系上级省代处理。"
    },
    sub_legal: {
      label: "二级合作企业 · 法定代表人",
      data: subVm,
      readonly: true,
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false, sign: false },
      note: "法定代表人只读视图：可查阅合作协议与对账，签署与配置由企业管理员执行。",
      lockedNote: "法定代表人为只读视图：可查阅全部合作档案与结算口径，不执行签署与对账操作。"
    },
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: subVm,
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false, sign: false },
      note: "员工仅可查阅合作档案；协议签署与比例配置由企业管理员执行。",
      lockedNote: "员工仅可查阅合作档案；合作暂停期间结算与对账冻结。"
    }
  };

  /* ============================================================
     省代视角 · 结构件
     ============================================================ */
  /* 合作总览：在营 / 本月合格消费 / 本月约定分润（口径与 financeSplit 一致） */
  function overviewHtml(vm) {
    var live = 0, settled = 0, agreed = 0;
    vm.live.forEach(function (p) {
      if (p.status !== "active") return;
      var g = Number(p.subGross || 0);
      live++;
      settled += g;
      agreed += Math.round(g * G * Number(p.ratioToSub || 0));
    });
    return '<section class="uh-sec"><div class="su-ov">' +
      '<div class="su-ov__cell"><span class="su-ov__k">在营合作</span>' +
      '<span class="su-ov__v">' + live + '<em>家</em></span></div>' +
      '<div class="su-ov__cell"><span class="su-ov__k">本月合格消费</span>' +
      '<span class="su-ov__v" data-cnt="settled">' + ui.money(settled) + '</span></div>' +
      '<div class="su-ov__cell"><span class="su-ov__k">本月约定分润</span>' +
      '<span class="su-ov__v su-ov__v--accent" data-cnt="agreed">' + ui.money(agreed) + '</span></div>' +
      '</div></section>';
  }

  /* 待办提醒：只有存在可推进事项时才出现（点击直达对应 tab / 筛选） */
  function alertsHtml(vm) {
    var wait = 0, rej = 0, susp = 0;
    vm.live.forEach(function (p) {
      if (p.status === "suspended") { susp++; return; }
      var st = agStateOf(p);
      if (st === "rejected") rej++;
      else if (st !== "signed") wait++;
    });
    var items = [];
    if (vm.pending.length) items.push({ tone: "info", t: "待审批", n: vm.pending.length, jump: "pending" });
    if (wait) items.push({ tone: "info", t: "协议待签", n: wait, jump: "wait" });
    if (rej) items.push({ tone: "bad", t: "协议拒签", n: rej, jump: "rej" });
    if (susp) items.push({ tone: "mute", t: "暂停中", n: susp, jump: "susp" });
    if (!items.length) return "";
    return '<div class="su-alerts">' + items.map(function (x) {
      return '<button type="button" class="su-alert su-alert--' + x.tone + '" data-jump="' + x.jump + '">' +
        x.t + '<b>' + x.n + '</b>' + ui.icon("chev", 12) + '</button>';
    }).join("") + '</div>';
  }

  function tabsHtml(vm) {
    var tabs = [
      { k: "active", t: "生效中", n: vm.live.length },
      { k: "pending", t: "待审批", n: vm.pending.length },
      { k: "rejected", t: "已驳回", n: vm.rejected.length }
    ];
    if (vm.ended.length) tabs.push({ k: "ended", t: "已结束", n: vm.ended.length });
    return '<section class="uh-sec"><div class="uls-tabs">' + tabs.map(function (x) {
      return '<button type="button" class="uls-tab' + (_tab === x.k ? " active" : "") + '" data-tab="' + x.k + '">' + x.t +
        (x.k !== "active" && x.n ? '<span class="uls-tab__badge">' + x.n + '</span>' : "") + '</button>';
    }).join("") + '</div></section>';
  }

  function filtersHtml(vm) {
    if (vm.live.length < 5) return "";
    return '<div class="su-filters">' + FILTERS.map(function (f) {
      var n = vm.live.filter(f.on).length;
      if (f.k !== "all" && !n) return "";
      return '<button type="button" class="su-chip' + (_filter === f.k ? " is-on" : "") + '" data-filter="' + f.k + '">' +
        f.t + '<b>' + n + '</b></button>';
    }).join("") + '</div>';
  }

  function liveCard(p, caps) {
    var st = agStateOf(p), ai = agInfo(st);
    var susp = p.status === "suspended";
    var on = !!_sel[p.id];
    var settled = Number(p.subGross || 0);
    var amt = Math.round(settled * G * Number(p.ratioToSub || 0));
    var badges = susp
      ? '<span class="uh-badge uh-badge--wait">已暂停</span>'
      : '<span class="uh-badge uh-badge--ok">生效中</span>' +
        '<span class="uh-badge uh-badge--' + ai.cls + (st === "signed" ? " uh-badge--quiet" : "") + '">' + ai.t + '</span>';
    var foot = "";
    if (_multi) {
      if (susp) foot = '<div class="su-card__ft"><span class="su-card__hint">已暂停合作，不参与批量操作</span></div>';
    } else if (susp && caps.status) {
      foot = '<div class="su-card__ft"><span class="su-card__hint">已暂停：分润结算与对账冻结</span>' +
        '<button type="button" class="su-card__act" data-quick="resume" data-id="' + esc(p.id) + '">恢复合作</button></div>';
    } else if (!susp && st !== "signed" && caps.resend) {
      var hint = st === "rejected" ? "对方已拒签，修订后可重新发起" : "对方尚未签署，可重新发起";
      foot = '<div class="su-card__ft"><span class="su-card__hint">' + hint + '</span>' +
        '<button type="button" class="su-card__act" data-quick="resend" data-id="' + esc(p.id) + '">重发协议</button></div>';
    }
    return '<div class="su-card' + (on ? " is-sel" : "") + (susp && _multi ? " is-na" : "") + '"' +
      ' data-open="' + esc(p.id) + '" role="button" tabindex="0">' +
      (_multi ? '<span class="su-check' + (on ? " is-on" : "") + (susp ? " is-na" : "") + '">' +
        (on ? ui.icon("check", 12) : "") + '</span>' : "") +
      '<div class="su-card__main">' +
        '<div class="su-card__nm">' + esc(p.name) + '</div>' +
        '<div class="su-card__meta">' + badges +
          '<span class="su-card__ratio">约定 <b>' + pct(p.ratioToSub) + '</b></span></div>' +
        '<div class="su-card__sub">合作自 ' + esc(p.since || "—") + '</div>' +
      '</div>' +
      '<div class="su-card__amt">' +
        (susp ? '<b class="is-off">冻结</b><span>暂停结算</span>'
              : '<b>' + ui.money(amt) + '</b><span>本月应得</span>') +
      '</div>' +
      (_multi ? "" : '<span class="su-card__chev">' + ui.icon("chev", 16) + '</span>') +
      foot + '</div>';
  }

  function pendingCard(a, caps) {
    return '<div class="su-card" data-open="' + esc(a.id) + '" role="button" tabindex="0">' +
      '<div class="su-card__main">' +
        '<div class="su-card__nm">' + esc(a.name) + '</div>' +
        '<div class="su-card__meta"><span class="uh-badge uh-badge--info">待审批</span>' +
          '<span class="su-card__ratio">申请 <b>' + pct(a.ratio) + '</b></span></div>' +
        '<div class="su-card__sub">提交于 ' + esc(a.submittedAt || "—") + '</div>' +
      '</div>' +
      '<span class="su-card__cta">' + (caps.review ? "去审批" : "查看") + '</span></div>';
  }

  function rejectedCard(a) {
    return '<div class="su-card is-dim" data-open="' + esc(a.id) + '" role="button" tabindex="0">' +
      '<div class="su-card__main">' +
        '<div class="su-card__nm">' + esc(a.name) + '</div>' +
        '<div class="su-card__meta"><span class="uh-badge uh-badge--bad">已驳回</span>' +
          '<span class="su-card__ratio">申请 <b>' + pct(a.ratio) + '</b></span></div>' +
        '<div class="su-card__sub">处理于 ' + esc(a.handledAt || a.submittedAt || "—") + '</div>' +
        '<div class="su-card__reason">' + esc(a.rejectReason || "未说明原因") + '</div>' +
      '</div>' +
      '<span class="su-card__chev">' + ui.icon("chev", 16) + '</span></div>';
  }

  function endedCard(p) {
    return '<div class="su-card is-dim" data-open="' + esc(p.id) + '" role="button" tabindex="0">' +
      '<div class="su-card__main">' +
        '<div class="su-card__nm">' + esc(p.name) + '</div>' +
        '<div class="su-card__meta"><span class="uh-badge uh-badge--mute">已终止</span>' +
          '<span class="su-card__ratio">原约定 <b>' + pct(p.ratioToSub) + '</b></span></div>' +
        '<div class="su-card__sub">终止于 ' + esc(p.statusAt || "—") + ' · 档案归档只读</div>' +
      '</div>' +
      '<span class="su-card__chev">' + ui.icon("chev", 16) + '</span></div>';
  }

  /* 空态（按 tab 语义化） */
  var EMPTY = {
    active: { t: "暂无生效中合作", d: "审批通过的二级合作将在这里建立档案", ic: "users" },
    pending: { t: "暂无待审批申请", d: "新的二级合作申请提交后将出现在这里", ic: "clipboard" },
    rejected: { t: "暂无已驳回申请", d: "被驳回的合作申请将留痕在这里", ic: "x-circle" },
    ended: { t: "暂无已结束合作", d: "终止的合作档案将归档在这里，仅作查阅", ic: "history" }
  };
  function emptyBlock(Uni, key, filtered, caps) {
    var m = filtered
      ? { t: "没有符合条件的合作", d: "切换到「全部」可查看该项下的其他企业", ic: "filter" }
      : (EMPTY[key] || EMPTY.active);
    var cta = (caps && caps.create && key === "active" && !filtered)
      ? '<div class="su-empty__cta"><button type="button" class="btn btn-primary btn-sm" data-create>发起新二级合作</button></div>'
      : "";
    return '<div class="card su-empty">' + Uni.emptyHtml(m.t, m.d, m.ic) + cta + '</div>';
  }

  function sectionHead(lbl, right) {
    return '<div class="uh-sechead"><span class="lbl">' + lbl + '</span>' +
      (right ? '<div class="su-headright">' + right + '</div>' : "") + '</div>';
  }

  /* 省代视角主体 */
  function provinceBody(vm, caps) {
    /* 批量模式：只保留可勾选的合作列表，提醒/分页/筛选全部让位 */
    if (_multi) return batchBody(vm, caps);

    var html = "";
    html += '<section class="uh-sec">' + alertsHtml(vm) + '</section>';
    html += tabsHtml(vm);

    if (_tab === "pending") {
      html += '<section class="uh-sec">' +
        sectionHead("待审批申请", vm.pending.length ? '<span class="uh-badge uh-badge--info">' + vm.pending.length + ' 条</span>' : "") +
        (vm.pending.length
          ? '<div class="su-list">' + vm.pending.map(function (a) { return pendingCard(a, caps); }).join("") + '</div>'
          : emptyBlock(caps.Uni, "pending", false, caps)) +
        '</section>';
      return html;
    }
    if (_tab === "rejected") {
      html += '<section class="uh-sec">' +
        sectionHead("已驳回申请", vm.rejected.length ? '<span class="uh-badge uh-badge--bad">' + vm.rejected.length + ' 条</span>' : "") +
        (vm.rejected.length
          ? '<div class="su-list">' + vm.rejected.map(rejectedCard).join("") + '</div>'
          : emptyBlock(caps.Uni, "rejected", false, caps)) +
        '</section>';
      return html;
    }
    if (_tab === "ended") {
      html += '<section class="uh-sec">' +
        sectionHead("已结束合作", '<span class="uh-badge uh-badge--mute">' + vm.ended.length + ' 家</span>') +
        (vm.ended.length
          ? '<div class="su-list">' + vm.ended.map(endedCard).join("") + '</div>'
          : emptyBlock(caps.Uni, "ended", false, caps)) +
        '</section>';
      return html;
    }

    /* 生效中 */
    var list = vm.live.filter(function (p) {
      var f = null;
      FILTERS.forEach(function (x) { if (x.k === _filter) f = x; });
      return f ? f.on(p) : true;
    });
    var head = sectionHead("生效中合作",
        '<span class="uh-badge uh-badge--ok">' + vm.live.length + ' 家</span>' +
        (caps.batch && vm.live.length > 1 ? '<button type="button" class="su-linkbtn" data-multi="enter">批量操作</button>' : ""));
    html += '<section class="uh-sec">' + head + filtersHtml(vm) +
      (list.length
        ? '<div class="su-list">' + list.map(function (p) { return liveCard(p, caps); }).join("") + '</div>'
        : emptyBlock(caps.Uni, "active", _filter !== "all", caps)) +
      '</section>';
    return html;
  }

  /* 批量模式主体：勾选区 + 提示，不再重复展示概览与筛选 */
  function batchBody(vm, caps) {
    var list = vm.live;
    var tip = '<div class="su-batchtip">' + ui.icon("info", 14) +
      '<span>勾选需统一处理的合作；<b>已暂停</b>的合作不参与批量操作</span></div>';
    return '<section class="uh-sec su-batchsec">' + tip +
      (list.length
        ? '<div class="su-list">' + list.map(function (p) { return liveCard(p, caps); }).join("") + '</div>'
        : emptyBlock(caps.Uni, "active", false, caps)) +
      '</section>';
  }

  /* ============================================================
     二级视角 · 主体（档案 + 本月所得 + 协议签署 + 相关入口）
     ============================================================ */
  function subBody(vm, ctx, canSign) {
    var a = vm.archive, ag = vm.agreement || {}, c = vm.calc || {};
    var st = ag.state || "signed";
    var ai = agInfo(st);
    var income = Number(c.calcAmount || 0);
    var sign = "";
    if (st === "pending_mine" && canSign) {
      sign = '<button type="button" class="su-sign" data-subact="sign">' +
        '<span class="su-sign__ic">' + ui.icon("file-text", 20) + '</span>' +
        '<span class="su-sign__main"><b>合作协议待你签署</b>' +
        '<span>省代已于 ' + esc(ag.sentAt || "—") + ' 发起 · 请查阅条款后签署</span></span>' +
        '<span class="su-sign__go">去签署</span></button>';
    } else if (st === "pending_mine") {
      sign = '<div class="su-sign is-static">' +
        '<span class="su-sign__ic">' + ui.icon("lock", 20) + '</span>' +
        '<span class="su-sign__main"><b>合作协议待签署</b>' +
        '<span>签署由企业管理员执行，当前身份仅可查阅</span></span></div>';
    } else if (st === "rejected") {
      sign = '<div class="su-sign is-bad">' +
        '<span class="su-sign__ic">' + ui.icon("x-circle", 20) + '</span>' +
        '<span class="su-sign__main"><b>合作协议已拒签</b>' +
        '<span>' + esc(ag.rejectReason || "请联系上级省代修订后重新发起") + '</span></span></div>';
    } else {
      /* 已签署：不再占一整块卡片，只留一行安静的状态线 */
      sign = '<div class="su-signline">' + ui.icon("check-circle", 15) +
        '<span>协议' + ai.t + ' · ' + esc(ag.signedAt || "—") +
        (ag.signerName ? " · " + esc(ag.signerName) : "") +
        ' · 有效期至 ' + esc(ag.expireAt || "—") + '</span></div>';
    }
    var signUnder = st === "signed";

    return '<section class="uh-sec"><div class="card su-arch">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">' + esc(c.month || "本月") + ' 合作所得</span>' +
          '<span class="uh-badge uh-badge--' + ai.cls + '">' + ai.t + '</span></div>' +
        '<div class="uh-bignum" data-cnt="income">' + ui.moneyD(income) + '</div>' +
        Uni2.plainNote("合格消费 <b>" + ui.money(Number(c.eligibleBase || 0)) + '</b> × 约定 <b>' + pct(c.ratioToSub != null ? c.ratioToSub : a.ratioToSub) +
          '</b> × 分佣线 <b>' + pct(G) + '</b>') +
        '<div class="uh-ledgerline"></div>' +
        '<div class="uh-kv"><span class="k">上级省代</span><span class="v">' + esc(a.name) + '</span></div>' +
        '<div class="uh-kv"><span class="k">合作起始</span><span class="v">' + esc(a.since || "—") + '</span></div>' +
        '<div class="uh-kv"><span class="k">约定比例</span><span class="v">' + pct(a.ratioToSub) + '</span></div>' +
        '<div class="uh-kv"><span class="k">统一信用代码</span><span class="v">' + esc(a.uscc || "—") + '</span></div>' +
      '</div>' + (signUnder ? sign : "") + '</section>' +
      (signUnder ? "" : '<section class="uh-sec">' + sign + '</section>') +
      '<section class="uh-sec">' +
        sectionHead("合作条款", "") +
        '<div class="uh-list">' +
          linkRow("file-text", "合作协议", "条款全文 · " + ai.t + " · " + (ag.version || "—"), "agree") +
          linkRow("chart", "本月对账明细", "合格消费 " + ui.money(Number(c.eligibleBase || 0)) + " · 应得 " + ui.money(income), "calc") +
          linkRow("building", "上级省代信息", a.name + (a.contact ? " · " + a.contact : ""), "parent") +
        '</div>' +
      '</section>';
  }
  /* 二级主体里提前引用 Uni.plainNote（避免把 Uni 透传进纯函数） */
  var Uni2 = { plainNote: function (inner) { return window.Uni.plainNote(inner); } };

  /* ============================================================
     省代视角 · 弹窗
     ============================================================ */
  function appDetailSheet(a, caps) {
    var U = caps.Uni;
    var pending = a.status === "pending";
    U.sheet({
      title: pending ? "合作申请详情" : "驳回记录详情",
      body:
        kv("企业名称", esc(a.name)) +
        kv("统一社会信用代码", esc(a.uscc || "—")) +
        kv("联系人", esc(a.contact || "—") + (a.phone ? " · " + esc(a.phone) : "")) +
        kv("地址", esc(a.address || "—")) +
        kv("申请比例", pct(a.ratio)) +
        kv("提交时间", esc(a.submittedAt || "—")) +
        (a.handledAt ? kv("处理时间", esc(a.handledAt)) : "") +
        (a.rejectReason ? kv("驳回原因", '<span style="color:var(--error)">' + esc(a.rejectReason) + '</span>') : "") +
        (pending
          ? '<div class="su-infonote" style="margin-top:12px">' + ui.icon("info", 15) +
            '<span>通过后自动建立合作档案并生成待签协议；驳回需填写原因并留痕。</span></div>'
          : ""),
      footer: (pending && caps.review)
        ? [{ t: "驳回", kind: "ghost", onClick: function (ov) { ov.close(); rejectSheet(a, U); } },
           { t: "确认通过", kind: "primary", onClick: function () {
             var r = approveApp(a);
             if (r.ok) { U.toast("已通过，合作协议已生成", "ok"); U.renderCurrent(); }
             else U.toast(r.reason || "审批失败", "err");
           } }]
        : [{ t: "关闭", kind: "primary" }]
    });
  }

  function liveDetailSheet(p, caps) {
    var U = caps.Uni;
    var st = agStateOf(p), ai = agInfo(st);
    var ag = p.agreement || {};
    var susp = p.status === "suspended";
    var settled = Number(p.subGross || 0);
    var amt = Math.round(settled * G * Number(p.ratioToSub || 0));
    var rows = mgrRow("history", "操作记录", "比例变更 · 协议重发 · 状态变更留痕", "records") +
      /* 目标必须是「这家企业」的账单：reconcile.html 是平台 → 省代的第一层对账，
         与二级企业无关，点进来只能看到全省聚合数，等于没有针对性 */
      mgrRow("chart", "查看对账单", "该企业本月分润应付 · 逐笔明细与付款登记", "recon") +
      mgrRow("file-text", "合作协议", (ag.id ? ag.id + " · " : "") + ai.t + " · 全文、签署与补签留痕", "agree");
    if (!susp && caps.ratio) rows += mgrRow("badge", "配置约定比例", "当前 " + pct(p.ratioToSub) + "，调整后需补签", "ratio");
    if (!susp && caps.resend && st !== "signed") rows += mgrRow("send", "重新发起协议", "当前" + ai.t + "，重新发起后待对方签署", "resend");
    if (!susp && caps.status) rows += mgrRow("clock", "暂停合作", "冻结分润结算与对账", "pause");
    if (susp && caps.status) rows += mgrRow("refresh", "恢复合作", "重新参与分润结算与对账", "resume");
    if (caps.status) rows += mgrRow("x-circle", "终止合作", "解除合作关系 · 不可撤销", "terminate", true);

    var sh = U.sheet({
      title: "合作档案",
      body:
        kv("企业名称", esc(p.name)) +
        kv("统一社会信用代码", esc(p.uscc || "—")) +
        kv("联系人", esc(p.contact || "—") + (p.phone ? " · " + esc(p.phone) : "")) +
        kv("地址", esc(p.address || "—")) +
        kv("协议编号", esc(ag.id || "—") + (ag.version ? " · " + esc(ag.version) : "")) +
        kv("协议状态", '<span class="uh-badge uh-badge--' + ai.cls + '">' + ai.t + '</span>' +
          (ag.state === "signed" && ag.expireAt ? '<span style="color:var(--text-3);margin-left:6px">有效期至 ' + esc(ag.expireAt) + '</span>' : "")) +
        kv("约定比例", pct(p.ratioToSub)) +
        kv("合作起始", esc(p.since || "—")) +
        kv("本月合格消费", ui.money(settled)) +
        kv("本月应得", '<b>' + (susp ? "已冻结" : ui.money(amt)) + '</b>') +
        '<div class="uh-sechead" style="margin:16px 0 8px"><span class="lbl">合作管理</span></div>' +
        '<div class="uh-list">' + rows + '</div>',
      footer: [{ t: "关闭", kind: "primary" }]
    });
    if (!sh) return;
    Array.prototype.forEach.call(sh.querySelectorAll("[data-mgr]"), function (n) {
      n.addEventListener("click", function (e) {
        e.stopPropagation();
        var act = n.getAttribute("data-mgr");
        sh.close();
        if (act === "records") recordsSheet(p, U);
        else if (act === "recon") U.navTo("reconcile-sub.html?sub=" + encodeURIComponent(p.id));
        else if (act === "agree") U.navTo("agreement.html?sub=" + encodeURIComponent(p.id));
        else if (act === "ratio") ratioSheet(p, U);
        else if (act === "resend") resendDialog(p, U);
        else if (act === "pause") statusDialog(p, "suspended", U);
        else if (act === "resume") statusDialog(p, "active", U);
        else if (act === "terminate") statusDialog(p, "terminated", U);
      });
    });
  }

  function endedDetailSheet(p, U) {
    U.sheet({
      title: "已结束合作",
      body:
        kv("企业名称", esc(p.name)) +
        kv("统一社会信用代码", esc(p.uscc || "—")) +
        kv("联系人", esc(p.contact || "—") + (p.phone ? " · " + esc(p.phone) : "")) +
        kv("合作起始", esc(p.since || "—")) +
        kv("终止时间", esc(p.statusAt || "—")) +
        kv("原约定比例", pct(p.ratioToSub)) +
        (p.statusReason ? kv("终止原因", esc(p.statusReason)) : "") +
        '<div class="uh-readnote" style="margin-top:12px">' + ui.icon("info", 15) +
        '<span>合作已终止，档案转入归档只读；如需重新合作，请重新发起合作申请。</span></div>',
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  /* 协议正文不再在合作弹窗里预览：协议要素、条款全文、签署留痕与签署动作
     都归 agreement.html?sub=<id> 一处，弹窗只做跳转，避免两处口径各说各话 */

  /* 操作记录：合并比例变更 / 协议重发 / 状态变更，按时间倒序 */
  function recordsSheet(p, U) {
    var d = store.getState().state;
    var rows = [];
    (d.ratioLog || []).forEach(function (r) {
      if (r.subId !== p.id) return;
      if (r.act === "resend") rows.push({ ic: "send", t: "重新发起合作协议", d: r.at + " · 已通知对方查阅并签署" });
      else rows.push({ ic: "badge", t: "约定比例 " + pct(r.from) + " → " + pct(r.to), d: r.at + (r.note ? " · " + r.note : "") });
    });
    (d.statusLog || []).forEach(function (r) {
      if (r.subId !== p.id) return;
      var L = { suspended: "暂停合作", active: "恢复合作", terminated: "终止合作" }[r.to] || "状态变更";
      rows.push({ ic: r.to === "terminated" ? "warn" : "refresh", t: L, d: r.at + (r.reason ? " · " + r.reason : "") });
    });
    rows.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
    if (!rows.length) rows.push({ ic: "check", t: "暂无操作记录", d: "合作档案建立后尚未发生变更" });
    U.sheet({
      title: "操作记录",
      body: rows.map(function (r) {
        return '<div class="uh-todo-row"><div class="mn">' +
          '<span class="mt" style="font-weight:600;color:var(--text-1)">' + ui.icon(r.ic, 13) + " " + esc(r.t) + '</span>' +
          '<span class="mt">' + esc(r.d) + '</span></div></div>';
      }).join(""),
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  /* 配置比例：常用比例快选 + 按本月消费实时估算分润 */
  function ratioSheet(p, U) {
    var cur = Math.round(Number(p.ratioToSub || 0) * 100);
    var base = Number(p.subGross || 0);
    function est(v) {
      return '<span>按本月合格消费 ' + ui.money(base) + ' 估算</span><b>' +
        ui.money(Math.round(base * G * (Number(v) || 0) / 100)) + '</b>';
    }
    var sh = U.sheet({
      title: "配置约定比例",
      body:
        kv("合作企业", esc(p.name)) +
        kv("当前比例", pct(p.ratioToSub)) +
        kv("本月合格消费", ui.money(base)) +
        '<div style="margin-top:12px">' + ratioFieldHtml({
          id: "su-newratio", label: "新约定比例（" + RATIO_MIN + "–" + RATIO_MAX + "%）", value: cur
        }) + '</div>' +
        '<div class="uls-quick">' + [10, 15, 20, 25, 30].map(function (v) {
          return '<button type="button" class="su-quickchip' + (v === cur ? " is-on" : "") + '" data-qv="' + v + '">' + v + '%</button>';
        }).join("") + '</div>' +
        '<div class="su-est" id="su-est">' + est(cur) + '</div>' +
        '<div class="uh-note">变更后需与二级补签协议，补签完成前仍按原比例结算。</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认变更", kind: "primary", onClick: function (ov) {
        var ctl = sh && sh.__ratioCtl;
        if (!ctl || !ctl.validate()) return false;
        var v = Number(ctl.value());
        var r = store.act("sub/setRatio", { id: p.id, ratio: v / 100, from: p.ratioToSub });
        if (!r.ok) { U.toast(r.reason || "变更失败", "err"); return false; }
        U.renderCurrent();
        U.toast("比例已变更，待补签协议", "ok");
      } }]
    });
    if (!sh) return;
    var box = sh.querySelector("#su-est");
    function sync() {
      if (!box) return;
      var v = ctl ? ctl.value() : "";
      box.innerHTML = est(v);
      Array.prototype.forEach.call(sh.querySelectorAll("[data-qv]"), function (b) {
        b.classList.toggle("is-on", Number(b.getAttribute("data-qv")) === Number(v));
      });
    }
    sh.__ratioChange = sync;
    var ctl = sh.__ratioCtl = bindRatioInput(sh);
    sync();
    Array.prototype.forEach.call(sh.querySelectorAll("[data-qv]"), function (b) {
      b.addEventListener("click", function () { ctl.set(b.getAttribute("data-qv")); });
    });
  }

  function statusDialog(p, to, U) {
    var M = {
      suspended: { title: "暂停合作？", desc: "暂停后该企业的分润结算与对账冻结，仅保留查看权限。恢复前需双方确认问题已解决。", ok: "确认暂停" },
      active: { title: "恢复合作？", desc: "恢复后该企业重新参与分润结算与对账，协议与约定比例不变。", ok: "确认恢复" },
      terminated: { title: "终止合作？", desc: "终止后合作关系解除，不再产生分润结算，档案转入归档只读。该操作不可撤销。", ok: "确认终止" }
    }[to];
    U.sheet({
      title: M.title, danger: to === "terminated",
      body:
        kv("合作企业", esc(p.name)) +
        '<div style="height:10px"></div>' +
        '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>' + M.desc + '</span></div>' +
        '<div class="field" style="margin-top:12px"><label class="field-label">操作原因（必填 · 留痕）</label>' +
        '<textarea class="textarea" id="su-status-reason" placeholder="说明原因，将留痕在操作记录中"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: M.ok, kind: to === "terminated" ? "danger" : "primary", onClick: function (ov) {
        var v = (ov.querySelector("#su-status-reason").value || "").trim();
        if (!v) { U.toast("请填写操作原因"); return false; }
        var r = store.act("sub/setStatus", { id: p.id, to: to, reason: v });
        if (!r.ok) { U.toast(r.reason || "操作失败", "err"); return false; }
        U.renderCurrent();
        U.toast(to === "active" ? "已恢复合作" : to === "suspended" ? "已暂停合作" : "已终止合作", "ok");
      } }]
    });
  }

  function createSheet(U) {
    var sh = U.sheet({
      title: "发起新二级合作",
      body:
        '<div class="field"><label class="field-label">企业名称（必填）</label><input class="input" id="su-n" placeholder="例如：德阳恒基建材有限公司"></div>' +
        '<div class="field"><label class="field-label">统一社会信用代码（必填 · 18 位）</label><input class="input" id="su-uscc" maxlength="18" placeholder="18 位统一社会信用代码"></div>' +
        '<div class="field"><label class="field-label">联系人</label><input class="input" id="su-contact" placeholder="企业负责人姓名"></div>' +
        '<div class="field"><label class="field-label">联系电话（11 位手机号）</label><input class="input" id="su-phone" maxlength="11" placeholder="11 位手机号"></div>' +
        '<div class="field"><label class="field-label">地址</label><input class="input" id="su-addr" placeholder="企业经营地址"></div>' +
        ratioFieldHtml({
          id: "su-ratio", label: "约定比例（" + RATIO_MIN + "–" + RATIO_MAX + "%）", value: 20, last: true,
          note: "提交后进入待审批，通过即建立合作档案并生成待签协议。"
        }),
      footer: [{ t: "取消", kind: "ghost" },
      { t: "提交申请", kind: "primary", onClick: function (ov) {
        var name = (ov.querySelector("#su-n").value || "").trim();
        var uscc = (ov.querySelector("#su-uscc").value || "").trim().toUpperCase();
        var contact = (ov.querySelector("#su-contact").value || "").trim();
        var phone = (ov.querySelector("#su-phone").value || "").trim();
        var address = (ov.querySelector("#su-addr").value || "").trim();
        if (!name) { U.toast("请填写企业名称"); return false; }
        if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(uscc)) { U.toast("统一社会信用代码应为 18 位"); return false; }
        if (phone && !/^1\d{10}$/.test(phone)) { U.toast("请输入正确的手机号"); return false; }
        var ratioCtl = sh && sh.__ratioCtl;
        if (!ratioCtl || !ratioCtl.validate()) return false;
        var ratio = Number(ratioCtl.value());
        var r = store.act("app/create", {
          data: { name: name, uscc: uscc, contact: contact, phone: phone, address: address, ratio: ratio / 100 },
          channel: "agent"
        });
        if (!r.ok) { U.toast(r.reason || "提交失败", "err"); return false; }
        _tab = "pending";
        U.renderCurrent();
        U.toast("已提交合作申请", "ok");
      } }]
    });
    if (sh) sh.__ratioCtl = bindRatioInput(sh);
  }

  function rejectSheet(a, U) {
    var sh = U.sheet({
      title: "驳回合作申请",
      body:
        kv("企业名称", esc(a.name)) +
        '<div style="height:10px"></div>' +
        '<div class="field"><label class="field-label">驳回原因（必填）</label>' +
        '<textarea class="textarea" id="su-rej" placeholder="说明驳回原因，留痕在申请档案中"></textarea></div>' +
        '<div class="uls-quick">' + REJECT_QUICK.map(function (q) {
          return '<button type="button" class="su-quickchip" data-quick-text="' + esc(q) + '">' + esc(q) + '</button>';
        }).join("") + '</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认驳回", kind: "danger", onClick: function (ov) {
        var v = (ov.querySelector("#su-rej").value || "").trim();
        if (!v) { U.toast("请填写驳回原因"); return false; }
        var r = rejectApp(a, v);
        if (!r.ok) { U.toast(r.reason || "驳回失败", "err"); return false; }
        U.renderCurrent();
        U.toast("已驳回，留痕在申请档案", "ok");
      } }]
    });
    if (!sh) return;
    Array.prototype.forEach.call(sh.querySelectorAll("[data-quick-text]"), function (b) {
      b.addEventListener("click", function () {
        sh.querySelector("#su-rej").value = b.getAttribute("data-quick-text");
      });
    });
  }

  function resendDialog(p, U) {
    var st = agStateOf(p);
    U.dialog({
      title: "重新发起合作协议？",
      text: (st === "rejected" ? "该企业此前已拒签，修订后重新发起。" : "用于协议修订或对方长期未签署时重新发起。") +
        "发起后协议回到待签署状态，并通知对方重新查阅与签署。",
      ok: "确认重新发起",
      onOk: function () {
        var r = store.act("agree/resend", { id: p.id });
        if (!r.ok) { U.toast(r.reason || "重发失败", "err"); return; }
        markResent(p.id);
        U.renderCurrent();
        U.toast("协议已重新发起，待对方签署", "ok");
      }
    });
  }

  /* ============================================================
     批量操作（多选）
     ============================================================ */
  function batchBarHtml(vm) {
    var n = countSel(vm.live);
    return '<div class="uls-batchbar' + (n ? "" : " is-empty") + '">' +
      '<span class="uls-batchbar__cnt">已选 <b>' + n + '</b> 家</span>' +
      '<div class="uls-batchbar__btns">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-more="1">更多</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-batch="ratio">配置比例</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-batch="resend">重发协议</button>' +
      '</div></div>';
  }

  function pickListHtml(list) {
    return '<div class="uls-picklist">' + list.map(function (p) {
      return '<span class="uls-pickitem">' + esc(p.name) + '</span>';
    }).join("") + '</div>';
  }

  function batchRatioSheet(list, U) {
    var base = list.reduce(function (a, p) { return a + Number(p.subGross || 0); }, 0);
    function est(v) {
      return '<span>' + list.length + ' 家 · 本月合格消费合计 ' + ui.money(base) + ' 估算</span><b>' +
        ui.money(Math.round(base * G * (Number(v) || 0) / 100)) + '</b>';
    }
    var sh = U.sheet({
      title: "批量配置约定比例",
      body:
        kv("涉及企业", list.length + " 家") +
        pickListHtml(list) +
        '<div style="margin-top:12px">' + ratioFieldHtml({
          id: "su-bratio", label: "统一新约定比例（" + RATIO_MIN + "–" + RATIO_MAX + "%）", value: "",
          placeholder: "输入 " + RATIO_MIN + "–" + RATIO_MAX + " 的整数"
        }) + '</div>' +
        '<div class="su-est" id="su-best">' + est(0) + '</div>' +
        '<div class="uh-note">各企业变更后需分别补签协议，补签完成前仍按原比例结算。</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认变更", kind: "primary", onClick: function (ov) {
        var ctl = sh && sh.__ratioCtl;
        if (!ctl || !ctl.validate()) return false;
        var v = Number(ctl.value());
        var done = 0, err = "";
        list.forEach(function (p) {
          var r = store.act("sub/setRatio", { id: p.id, ratio: v / 100, from: p.ratioToSub });
          if (r.ok) done++; else if (!err) err = r.reason || "变更失败";
        });
        if (!done) { U.toast(err || "变更失败", "err"); return false; }
        _multi = false; _sel = {};
        U.renderCurrent();
        U.toast("已更新 " + done + " 家约定比例，待补签协议", "ok");
      } }]
    });
    if (!sh) return;
    var box = sh.querySelector("#su-best");
    sh.__ratioChange = function (v) { if (box) box.innerHTML = est(v); };
    sh.__ratioCtl = bindRatioInput(sh);
  }

  function batchResendDialog(list, U) {
    U.dialog({
      title: "批量重发协议？",
      text: "将向 " + list.length + " 家企业重新发起合作协议，发起后协议回到待签署状态并通知对方。",
      ok: "确认批量重发",
      onOk: function () {
        var done = 0, err = "";
        list.forEach(function (p) {
          var r = store.act("agree/resend", { id: p.id });
          if (r.ok) { done++; markResent(p.id); } else if (!err) err = r.reason || "重发失败";
        });
        if (!done) { U.toast(err || "重发失败", "err"); return; }
        _multi = false; _sel = {};
        U.renderCurrent();
        U.toast("已向 " + done + " 家企业重新发起协议", "ok");
      }
    });
  }

  function batchStatusSheet(list, to, U) {
    var M = {
      suspended: { title: "批量暂停合作？", desc: "将统一暂停所选企业的分润结算与对账，仅保留查看权限。恢复前需双方确认问题已解决。", ok: "确认暂停", done: "暂停" },
      terminated: { title: "批量终止合作？", desc: "将统一解除所选企业的合作关系，不再产生分润结算，档案转入归档只读。该操作不可撤销。", ok: "确认终止", done: "终止" }
    }[to];
    if (!M) return;
    U.sheet({
      title: M.title, danger: to === "terminated",
      body:
        kv("涉及企业", list.length + " 家") +
        pickListHtml(list) +
        '<div style="height:8px"></div>' +
        '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>' + M.desc + '</span></div>' +
        '<div class="field" style="margin-top:12px"><label class="field-label">操作原因（必填 · 留痕）</label>' +
        '<textarea class="textarea" id="su-bstatus-reason" placeholder="说明原因，将留痕在操作记录中"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: M.ok, kind: to === "terminated" ? "danger" : "primary", onClick: function (ov) {
        var v = (ov.querySelector("#su-bstatus-reason").value || "").trim();
        if (!v) { U.toast("请填写操作原因"); return false; }
        var done = 0, err = "";
        list.forEach(function (p) {
          var r = store.act("sub/setStatus", { id: p.id, to: to, reason: v });
          if (r.ok) done++; else if (!err) err = r.reason || "操作失败";
        });
        if (!done) { U.toast(err || "操作失败", "err"); return false; }
        _multi = false; _sel = {};
        U.renderCurrent();
        U.toast("已" + M.done + " " + done + " 家合作", "ok");
      } }]
    });
  }

  /* ============================================================
     二级视角 · 弹窗
     ============================================================ */
  function subAgreementSheet(ctx, U, caps) {
    var ag = ctx.s.agreement || {};
    var st = ag.state || "signed", ai = agInfo(st);
    U.sheet({
      title: "合作协议",
      body:
        kv("协议编号", esc(ag.id || "—")) +
        kv("协议版本", esc(ag.version || "—")) +
        kv("协议状态", '<span class="uh-badge uh-badge--' + ai.cls + '">' + ai.t + '</span>') +
        kv("发起时间", esc(ag.sentAt || "—")) +
        (ag.signedAt ? kv("签署时间", esc(ag.signedAt) + (ag.signerName ? " · " + esc(ag.signerName) : "")) : "") +
        kv("有效期至", esc(ag.expireAt || "—")) +
        '<div class="uh-sheetkv"><span class="k">省代</span><span class="v">' +
          esc((ag.province && ag.province.name) || (ctx.s.parent && ctx.s.parent.name) || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">我方</span><span class="v">' +
          esc((ag.sub && ag.sub.name) || (ctx.s.profile && ctx.s.profile.name) || "—") + '</span></div>' +
        ((st === "pending_mine" && !caps.sign)
          ? '<div class="su-infonote" style="margin-top:12px">' + ui.icon("info", 15) +
            '<span>协议签署由企业管理员执行，当前身份仅可查阅条款。</span></div>'
          : "") +
        '<div class="uh-sechead" style="margin:16px 0 6px"><span class="lbl">协议正文</span></div>' +
        (U.richDoc(U.agreementBody(ag)) ||
          '<div class="uh-plain">正文由省代在后台编辑生成，当前版本暂无可展示的正文。</div>'),
      footer: (st === "pending_mine" && caps.sign)
        ? [{ t: "关闭", kind: "ghost" },
           { t: "前往签署", kind: "primary", onClick: function (ov) { ov.close(); U.navTo("agreement.html"); } }]
        : [{ t: "关闭", kind: "primary" }]
    });
  }

  function subCalcSheet(ctx, U) {
    var c = (ctx.s.calc || [])[0] || {};
    var detail = c.detail || [];
    var total = Number(c.eligibleBase || 0);
    U.sheet({
      title: "本月对账明细",
      body:
        kv("账单月份", esc(c.month || "—")) +
        kv("出账时间", esc(c.issueAt || "—")) +
        kv("合格消费", ui.money(total)) +
        kv("约定比例", pct(c.ratioToSub)) +
        kv("本月所得", '<b>' + ui.money(Number(c.calcAmount || 0)) + '</b>') +
        '<div class="uh-note">所得 = 合格消费 × 分佣线 ' + pct(G) + ' × 约定比例，逐笔明细见下。</div>' +
        '<div class="uh-sechead" style="margin:16px 0 6px"><span class="lbl">分摊明细</span></div>' +
        (detail.length
          ? detail.map(function (d) {
              return '<div class="uh-todo-row"><div class="mn">' +
                '<span class="mt" style="font-weight:600;color:var(--text-1)">' + esc(ITEM_LABEL[d.item] || d.item) + " · " + esc(d.user || "—") + '</span>' +
                '<span class="mt">' + esc(d.date || "—") + " · " + esc(d.order || "") + '</span></div>' +
                '<span class="uh-row__amt">' + ui.money(d.amount) + '</span></div>';
            }).join("")
          : '<div class="empty-state" style="padding:24px 0"><div class="e-desc">本月暂无合格消费明细</div></div>'),
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  function subParentSheet(ctx, U) {
    var p = ctx.s.parent || {};
    U.sheet({
      title: "上级省代信息",
      body:
        kv("企业名称", esc(p.name || "—")) +
        kv("统一社会信用代码", esc(p.uscc || "—")) +
        kv("联系人", esc(p.contact || "—") + (p.phone ? " · " + esc(p.phone) : "")) +
        kv("法定代表人", esc(p.legalPerson || "—")) +
        kv("地址", esc(p.address || "—")) +
        kv("合作起始", esc(p.since || "—")) +
        kv("约定比例", pct(p.ratioToSub)) +
        '<div class="uh-note">合作条款、比例与结算均以上级省代签署版本为准；如有异议可在对账中心发起核实。</div>',
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  /* ============================================================
     规则说明（页头「规则」入口）
     ============================================================ */
  function rulesSheet(ctx, caps) {
    var isSub = ctx.mode === "sub";
    var rules = isSub
      ? [
          { t: "合作归属", c: "你与上级省代为一对一合作关系，合作协议由省代发起，双方签署后生效。" },
          { t: "约定比例", c: "约定比例由上级省代配置（" + RATIO_MIN + "–" + RATIO_MAX + "%），调整后需双方补签协议，补签完成前按原比例结算。" },
          { t: "协议签署", c: "收到协议后请查阅全部条款再签署；签署记录与版本变更均留痕，历史版本不覆盖。" },
          { t: "结算口径", c: "本月所得 = 本人线合格消费 × 分佣线 50% × 约定比例，以对账中心的对账单为准。" },
          { t: "争议与暂停", c: "对账差异可在对账中心发起异议；合作暂停期间档案仍可查阅，结算与对账冻结。" }
        ]
      : [
          { t: "合作申请", c: "提交后进入待审批；审批通过即建立合作档案，并生成待对方签署的合作协议。" },
          { t: "约定比例", c: "范围 " + RATIO_MIN + "–" + RATIO_MAX + "%，须为整数；调整后需双方补签协议，补签完成前仍按原比例结算。" },
          { t: "协议签署", c: "双方签署后生效；拒签或长期未签可重新发起，发起记录与历史留痕可查。" },
          { t: "结算口径", c: "本月应得 = 该企业合格消费 × 分佣线 50% × 约定比例，以对账中心的对账单为准。" },
          { t: "状态变更", c: "暂停冻结结算与对账，恢复后继续；终止不可撤销，档案转入归档只读。" }
        ];
    caps.Uni.sheet({
      title: "合作规则说明",
      body: rules.map(function (r, i) {
        return '<div class="su-rule"><span class="su-rule__no">' + (i + 1) + '</span>' +
          '<div class="su-rule__bd"><b>' + esc(r.t) + '</b><p>' + esc(r.c) + '</p></div></div>';
      }).join(""),
      footer: [{ t: "我知道了", kind: "primary" }]
    });
  }

  /* ============================================================
     唯一渲染入口
     ============================================================ */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var ro = ctx.readonly;
    var isSub = ctx.mode === "sub";
    var suspended = !!(ctx.s.profile && ctx.s.profile.status !== "active");

    if (_lastIdentity !== ctx.identity) {
      _lastIdentity = ctx.identity;
      _multi = false; _sel = {};
      _tab = isSub ? "active" : "active";
      _filter = "all";
      _first = true;
    }
    _ctx = ctx;

    var caps = {
      Uni: Uni,
      review: !ro && V.perms.review,
      ratio: !ro && V.perms.setRatio,
      resend: !ro && V.perms.resend,
      status: !ro && V.perms.status,
      create: !ro && V.perms.createApp,
      sign: !ro && !!V.perms.sign,
      batch: !ro && V.perms.setRatio && V.perms.status
    };

    var vm = V.data(ctx);

    /* “更多”气泡：自按钮位置向上弹出（相对 .phone 定位，兼容页面缩放） */
    function statusPopFor(btn) {
      if (_pop) { closeStatusPop(); return; }
      var host = el.closest(".phone") || document.querySelector(".phone") || document.body;
      var pop = document.createElement("div");
      pop.className = "uls-pop";
      pop.innerHTML =
        '<div class="uls-pop__arrow"></div>' +
        '<button type="button" class="uls-pop__item" data-popact="suspended">暂停合作</button>' +
        '<button type="button" class="uls-pop__item uls-pop__item--danger" data-popact="terminated">终止合作</button>';
      pop.style.position = "absolute";
      host.appendChild(pop);
      var hr = host.getBoundingClientRect();
      var scale = host.offsetWidth ? hr.width / host.offsetWidth : 1;
      var r = btn.getBoundingClientRect();
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = Math.min(Math.max(8, host.offsetWidth - pw - 8), Math.max(8, (r.right - hr.left) / scale - pw));
      var top = Math.max(8, (r.top - hr.top) / scale - ph - 10);
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      var ar = pop.querySelector(".uls-pop__arrow");
      if (ar) ar.style.left = Math.max(10, Math.min(pw - 24, (r.left + r.width / 2 - hr.left) / scale - left - 6)) + "px";
      _pop = pop;
      requestAnimationFrame(function () { pop.classList.add("show"); });
      Array.prototype.forEach.call(pop.querySelectorAll("[data-popact]"), function (it) {
        it.addEventListener("click", function () {
          var to = it.getAttribute("data-popact");
          closeStatusPop();
          var pick = liveSel();
          if (!pick.length) { Uni.toast("请先选择企业"); return; }
          batchStatusSheet(pick, to, Uni);
        });
      });
    }
    function liveSel() {
      var cur = V.data(ctx);
      return cur.live.filter(function (p) { return _sel[p.id] && p.status !== "suspended"; });
    }

    function render() {
      var now = V.data(ctx);
      vm = now;
      closeStatusPop();
      if (isSub) _tab = "active";

      var head = "";
      if (_multi && !isSub) {
        head = '<div class="uls-batchhead">' +
          '<button type="button" class="uls-batchhead__back" data-batchback>返回</button>' +
          '<span class="uls-batchhead__title">批量操作 · 已选 ' + countSel(now.live) + ' 家</span>' +
          '<span class="uls-batchhead__act">' +
          '<button type="button" class="su-linkbtn" data-multi="all">全选</button>' +
          '<button type="button" class="su-linkbtn" data-multi="clear">清空</button>' +
          '</span></div>';
      }
      /* 2026-11-01 审计修复：锁条原先只看企业是否暂停，合作正常的法定代表人（identityReadonly）
         进本页既无锁条也无说明，看起来与管理员同权。改为「暂停 或 身份只读」都出锁条，
         标题统一由 Uni.lockTitle 判定，避免再写死「合作权限已暂停」。 */
      var lock = (suspended || ro)
        ? '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">' + esc(Uni.lockTitle(ctx, V)) + '（仅可查看）</span>' +
          '<span class="lb-s">' + esc(V.lockedNote || "") + '</span></div></div></section>'
        : "";
      var note = (V.note && !suspended)
        ? '<section class="uh-sec"><div class="su-infonote">' + ui.icon("info", 15) + '<span>' + esc(V.note) + '</span></div></section>'
        : "";
      /* 空态卡片里已有主 CTA，再挂 FAB 就是同屏两个同样的按钮 */
      var emptyCta = !isSub && _tab === "active" && !now.live.length;
      var fab = (!isSub && caps.create && !_multi && !emptyCta)
        ? '<button type="button" class="su-fab" data-create aria-label="发起新二级合作">' +
          ui.icon("user-plus", 18) + '<span>发起合作</span></button>'
        : "";

      el.innerHTML = head + lock +
        ((isSub || _multi) ? "" : overviewHtml(now)) +
        note +
        (isSub ? subBody(now, ctx, caps.sign) : provinceBody(now, caps)) +
        ((!_multi && !isSub) ? '<section class="uh-sec su-footnote"><div class="uh-note">本月数据为演示模拟测算；分佣线 50% 为规则常量，不含平台其他费用。</div></section>' : "") +
        fab +
        ((_multi && !isSub) ? batchBarHtml(now) : "");

      document.body.classList.toggle("uls-batch", _multi && !isSub);
      el.classList.toggle("su-has-fab", !!fab);

      /* 数字滚动（仅首次渲染，切换 tab 不重复动画） */
      if (_first) {
        _first = false;
        if (!isSub) {
          var se = el.querySelector('[data-cnt="settled"]');
          var ag = el.querySelector('[data-cnt="agreed"]');
          if (se) Uni.countUp(se, now.live.reduce(function (a, p) {
            return a + (p.status === "active" ? Number(p.subGross || 0) : 0);
          }, 0), 700, function (v) { return ui.money(v); });
          if (ag) Uni.countUp(ag, now.live.reduce(function (a, p) {
            return a + (p.status === "active" ? Math.round(Number(p.subGross || 0) * G * Number(p.ratioToSub || 0)) : 0);
          }, 0), 700, function (v) { return ui.money(v); });
        } else {
          var inc = el.querySelector('[data-cnt="income"]');
          if (inc) Uni.countUp(inc, Number((now.calc || {}).calcAmount || 0), 700, function (v) { return ui.moneyD(v); });
        }
      }

      bind();
    }

    function bind() {
      var apps = {};
      mergedSubApps(ctx.s).forEach(function (a) { apps[a.id] = a; });
      var subs = {};
      ((V.data(ctx).live || []).concat(V.data(ctx).ended || [])).forEach(function (p) { subs[p.id] = p; });

      /* tab */
      Array.prototype.forEach.call(el.querySelectorAll("[data-tab]"), function (n) {
        n.addEventListener("click", function () {
          _tab = n.getAttribute("data-tab");
          _multi = false; _sel = {};
          render();
        });
      });
      /* 提醒直达 */
      Array.prototype.forEach.call(el.querySelectorAll("[data-jump]"), function (n) {
        n.addEventListener("click", function () {
          var j = n.getAttribute("data-jump");
          _tab = "active";
          _filter = "all";
          if (j === "pending") _tab = "pending";
          else _filter = j;
          render();
        });
      });
      /* 筛选 */
      Array.prototype.forEach.call(el.querySelectorAll("[data-filter]"), function (n) {
        n.addEventListener("click", function () {
          _filter = n.getAttribute("data-filter");
          render();
        });
      });
      /* 卡片主体：多选态切换选中，否则进详情 */
      Array.prototype.forEach.call(el.querySelectorAll("[data-open]"), function (n) {
        function go(e) {
          if (e && e.target.closest("[data-quick]")) return;
          var id = n.getAttribute("data-open");
          if (_multi) {
            if (n.classList.contains("is-na")) { Uni.toast("该企业已暂停合作，暂不可批量选择"); return; }
            if (_sel[id]) delete _sel[id]; else _sel[id] = true;
            render();
            return;
          }
          var a = apps[id], p = subs[id];
          if (a) appDetailSheet(a, caps);
          else if (p && p.status === "terminated") endedDetailSheet(p, Uni);
          else if (p) liveDetailSheet(p, caps);
        }
        n.addEventListener("click", go);
        n.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); }
        });
      });
      /* 卡内一键动作（重发协议 / 恢复合作） */
      Array.prototype.forEach.call(el.querySelectorAll("[data-quick]"), function (n) {
        n.addEventListener("click", function (e) {
          e.stopPropagation();
          var id = n.getAttribute("data-id");
          var p = subs[id];
          if (!p) return;
          if (n.getAttribute("data-quick") === "resend") resendDialog(p, Uni);
          else statusDialog(p, "active", Uni);
        });
      });
      /* 多选入口 / 全选 / 清空 / 退出 */
      Array.prototype.forEach.call(el.querySelectorAll("[data-multi]"), function (n) {
        n.addEventListener("click", function () {
          var a = n.getAttribute("data-multi");
          if (a === "enter") { _multi = true; _sel = {}; _filter = "all"; }
          else if (a === "all") {
            V.data(ctx).live.forEach(function (p) { if (p.status !== "suspended") _sel[p.id] = true; });
          } else if (a === "clear") { _sel = {}; }
          else { _multi = false; _sel = {}; }
          render();
        });
      });
      Array.prototype.forEach.call(el.querySelectorAll("[data-batchback]"), function (n) {
        n.addEventListener("click", function () { _multi = false; _sel = {}; render(); });
      });
      Array.prototype.forEach.call(el.querySelectorAll("[data-more]"), function (n) {
        n.addEventListener("click", function () { statusPopFor(n); });
      });
      Array.prototype.forEach.call(el.querySelectorAll("[data-batch]"), function (n) {
        n.addEventListener("click", function () {
          var pick = liveSel();
          if (!pick.length) { Uni.toast("请先选择企业"); return; }
          if (n.getAttribute("data-batch") === "ratio") batchRatioSheet(pick, Uni);
          else batchResendDialog(pick, Uni);
        });
      });
      var createBtn = el.querySelector("[data-create]");
      if (createBtn) createBtn.addEventListener("click", function () { createSheet(Uni); });

      /* 二级视角：相关入口 + 签署 */
      Array.prototype.forEach.call(el.querySelectorAll("[data-subact]"), function (n) {
        n.addEventListener("click", function (e) {
          e.stopPropagation();
          var act = n.getAttribute("data-subact");
          if (act === "sign") {
            if (!caps.sign) { Uni.toast("协议签署由企业管理员执行"); return; }
            Uni.navTo("agreement.html"); return;
          }
          if (act === "agree") subAgreementSheet(ctx, Uni, caps);
          else if (act === "calc") subCalcSheet(ctx, Uni);
          else if (act === "parent") subParentSheet(ctx, Uni);
        });
      });
    }

    render();

    /* 页头「规则」入口（页面静态按钮，每次 mount 重绑以保证 ctx 最新） */
    var rulesBtn = document.getElementById("su-rules");
    if (rulesBtn) rulesBtn.onclick = function () { rulesSheet(ctx, caps); };
  }

  window.Uni.register({
    view: "uni-subs",
    route: "subs.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
