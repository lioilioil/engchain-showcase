/* ============================================================
   uni-ledger.js · 经营台账（ledger.html）

   —— 页面定位（与相邻页面分工，互不重叠）——
     · 对账中心   = 单个账期的「过程」：逐笔核对、异议、确认、平账
     · 对账历史   = 历次对账单的「档案」：按账单类型归档索引与下载
     · 经营台账   = 按账期归集的「结果」：赚了多少、怎么算出来的、从哪来、往哪走、可导出

   信息架构（四身份同构，差异仅在数据源与文案）：
     ① 账期条     横向账期切换（sticky），全页账期口径的唯一入口
     ② 本期概览   经营实得（大数字 + 环比）+ 可复算式 + 收款登记进度 + 三格 KPI
     ③ 账期趋势   三指标切换 · 均值基线 · 点柱切账期
     ④ 账期台账   账簿式表格（账期/账单/付二级/实得/状态）→ 行点开「账期分解」
     ⑤ 分账结构   这笔钱是怎么算出来的（省代=两分区树；二级=单企业树）
     ⑥ 来源结构   省代=逐家二级线留存排行；二级=按事项类型构成
     ⑦ 口径说明   折叠；含「本页与相邻页面的分工」

   口径纪律（沿用既有审计结论）：
     · 主数字必带可复算算式，禁止与台账行出现两个真值（P0-1）
     · 账期集合以 hist（月度账单权威清单）为准，不静默缺席任何账期（P1-3）
     · 无复算记录的账期只列账单金额并显式标注「不可复算」，不臆造合格消费
     · 分账明细（基数口径）与月度账单（账期口径）不等时明示，不掩盖（P0-2）

   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   视觉全部复用 app.css 令牌与 uni-layout.css 基元；弹窗/Toast 经 Uni.*。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  /* ================= 常量 ================= */

  /* 事项类型（与 uni-doc 同一套词表；此处用于「收入构成」而非单据行） */
  var ITEM_LB = { cert: "企业认证", entry: "企业入驻", unlock: "线索解锁", order: "供需订单" };
  var ITEM_IC = { cert: "badge", entry: "company", unlock: "unlock", order: "box" };
  var ITEM_SEQ = ["cert", "entry", "unlock", "order"];

  /* 付款登记状态 → 归集桶（与对账中心共用同一批登记记录，本页只呈现「结果」不提供动作） */
  var REG_CLS = { confirmed: "ok", pending_confirm: "wait", disputed: "bad" };
  var REG_LB = { confirmed: "已确认", pending_confirm: "待确认", disputed: "争议" };

  /* 会话内状态：mount 重建不丢失（账期 / 趋势指标） */
  var _s = { month: null, metric: null };

  function histLb() {
    return (window.UniDoc && window.UniDoc.HIST_LB) || { pending: "对账中", settled: "已平账", overdue: "逾期锁定" };
  }
  function histCls() {
    return (window.UniDoc && window.UniDoc.HIST_CLS) || { pending: "wait", settled: "ok", overdue: "bad" };
  }

  /* ================= 通用小工具 ================= */

  function num(v) { return typeof v === "number" && isFinite(v); }
  function share(a, b) { return b > 0 && num(a) ? Math.min(a / b, 1) : 0; }
  function pctTxt(a, b) { return b > 0 ? Math.round(a / b * 1000) / 10 : 0; }
  function signPct(p) { return (p > 0 ? "+" : "") + (Math.round(p * 10) / 10) + "%"; }

  function deltaOf(cur, prev, key) {
    if (!cur || !prev) return null;
    var a = cur[key], b = prev[key];
    if (!num(a) || !num(b) || b === 0) return null;
    return { pct: (a - b) / Math.abs(b) * 100, abs: a - b, prevMonth: prev.month };
  }

  function deltaHtml(d, emptyTxt) {
    if (!d) return '<span class="ulg-delta ulg-delta--flat">' + ui.esc(emptyTxt || "无上期可比") + "</span>";
    var up = d.pct >= 0;
    return '<span class="ulg-delta ulg-delta--' + (up ? "up" : "down") + '">' +
      '<svg class="ulg-delta__ar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>' +
      "<b>" + signPct(d.pct) + "</b><em>较 " + ui.esc(d.prevMonth) + "</em></span>";
  }

  /* CSV 落地：BOM + CRLF，Excel 直接可读 */
  function downloadCsv(name, rows) {
    var text = "﻿" + rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? "" : c);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\r\n");
    try {
      var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      return true;
    } catch (e) { return false; }
  }

  /* ================= 数据层：账期集合 ================= */

  /* 账单月份 ↔ 账单编号映射（用于把付款登记归到账期；登记自带日期时以日期兜底） */
  function calcIdMap(s, isSub) {
    var m = {};
    if (isSub) {
      (s.calc || []).forEach(function (c) { if (c && c.id && c.month) m[c.id] = c.month; });
    } else {
      [s.calc1, s.calc2].forEach(function (c) { if (c && c.id && c.month) m[c.id] = c.month; });
    }
    return m;
  }

  function regMonth(reg, cmap) {
    var cid = reg && reg.calcId;
    if (cid && cmap[cid]) return cmap[cid];
    var d = (reg && reg.date) || "";
    return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : "";
  }

  /* → { "2026-10": { ok, wait, bad, total, n } } */
  function regsByMonth(regs, cmap) {
    var out = {};
    (regs || []).forEach(function (r) {
      var m = regMonth(r, cmap);
      if (!m) return;
      var b = out[m] || (out[m] = { ok: 0, wait: 0, bad: 0, total: 0, n: 0 });
      var k = REG_CLS[r.status] || "wait";
      var amt = Number(r.amount) || 0;
      b[k] += amt;
      b.total += amt;
      b.n++;
    });
    return out;
  }

  /* ---------- 省代：账期行以 hist（月度账单权威清单）为唯一来源 ---------- */
  function provincePeriods(ctx) {
    var LB = histLb(), CLS = histCls(), s = ctx.s;
    var map = {}, order = [];
    (s.hist || []).forEach(function (h) {
      if (!h || !h.month) return;
      var e = map[h.month];
      if (!e) { e = map[h.month] = { month: h.month, plat: null, sub: null }; order.push(h.month); }
      if ((h.type || "platform") === "sub") e.sub = h; else e.plat = h;
    });
    var cmap = calcIdMap(s, false);
    var regIn = regsByMonth(s.payRegs1, cmap);   /* 平台 → 省代（进账） */
    var regOut = regsByMonth(s.payRegs2, cmap);  /* 省代 → 二级（出账） */

    return order.sort().reverse().map(function (m) {
      var e = map[m];
      var bill = e.plat ? Number(e.plat.amount || 0) : 0;
      var paySub = e.sub ? Number(e.sub.amount || 0) : 0;
      var st = (e.plat && e.plat.state) || (e.sub && e.sub.state) || "pending";
      return {
        month: m,
        bill: bill,
        paySub: paySub,
        income: bill - paySub,                 /* 省代实得 = 收平台账单 − 付二级账单 */
        eligible: Math.round(bill / 0.5),      /* 合格消费 = 账单 ÷ 50% 分佣线 */
        state: st,
        stateTxt: LB[st] || "对账中",
        stateCls: CLS[st] || "mute",
        issueAt: (e.plat && e.plat.issueAt) || (e.sub && e.sub.issueAt) || "",
        dueAt: (e.plat && e.plat.dueAt) || (e.sub && e.sub.dueAt) || "",
        settledAt: (e.plat && e.plat.settledAt) || (e.sub && e.sub.settledAt) || "",
        regIn: regIn[m] || null,
        regOut: regOut[m] || null,
        detail: (s.calc1 && s.calc1.month === m) ? (s.calc1.detail || []) : null,
        detailOut: (s.calc2 && s.calc2.month === m) ? (s.calc2.detail || []) : null
      };
    });
  }

  /* ---------- 二级：账单金额/状态取 hist，复算口径取 calc ---------- */
  function subPeriods(ctx) {
    var LB = histLb(), CLS = histCls(), s = ctx.s;
    var calcMap = {}, histMap = {}, seen = {}, order = [];
    function add(m) { if (m && !seen[m]) { seen[m] = 1; order.push(m); } }
    (s.calc || []).forEach(function (c) { if (c && c.month) { calcMap[c.month] = c; add(c.month); } });
    (s.hist || []).forEach(function (h) { if (h && h.month) { histMap[h.month] = h; add(h.month); } });

    var cmap = calcIdMap(s, true);
    var regIn = regsByMonth(s.payRegs, cmap);    /* 省代 → 二级（本企业进账） */

    return order.sort().reverse().map(function (m) {
      var c = calcMap[m], h = histMap[m];
      var st = h ? h.state : "pending";
      var row = {
        month: m,
        state: st,
        stateTxt: LB[st] || "对账中",
        stateCls: CLS[st] || "mute",
        issueAt: (h && h.issueAt) || (c && c.issueAt) || "",
        dueAt: (h && h.dueAt) || (c && c.dueAt) || "",
        settledAt: (h && h.settledAt) || (c && c.settledAt) || "",
        regIn: regIn[m] || null,
        detail: (c && (c.detail || []).length) ? c.detail : null,
        derived: !c
      };
      if (c) {
        var st2 = store.subSettle(c);
        row.eligible = st2.eligible;
        row.gross = st2.gross;
        row.ratio = st2.ratioToSub;
        row.ratioTxt = Math.round(st2.ratioToSub * 100) + "%";
        row.income = st2.agreed;
        row.frozen = st2.frozen;
      } else {
        /* 逾期锁定账期无当月复算记录：只列账单金额，合格消费留空不臆造 */
        row.eligible = null;
        row.gross = null;
        row.ratio = null;
        row.ratioTxt = "—";
        row.income = h ? Number(h.amount || 0) : 0;
        row.frozen = 0;
      }
      return row;
    });
  }

  /* ---------- 员工：仅本人渠道码带来的用户及其消费 ---------- */
  function staffVm(ctx) {
    var s = ctx.s, my = ctx.staffName;
    var isSub = ctx.mode === "sub";
    var chKeys = isSub ? ["school"] : ["direct"];
    var chLabel = isSub ? "二级渠道" : "直接合作";
    var mine = [], users = 0, paidAmt = 0;
    chKeys.forEach(function (ch) {
      (s.leads[ch] || []).forEach(function (l) {
        if (l.owner !== my) return;
        users++;
        if (l.stage === "paid" || l.stage === "repaid") {
          paidAmt += l.amount || 0;
          mine.push({ user: l.name || "用户", channel: chLabel, amount: l.amount || 0, at: (l.paidAt || l.createdAt || "").slice(0, 10) });
        }
      });
    });
    var codes = [];
    chKeys.forEach(function (ch) {
      (s.channels[ch] || []).forEach(function (c) {
        if (c.ownerName === my && c.status === "active" && codes.indexOf(c.code) < 0) codes.push(c.code);
      });
    });
    return {
      staff: true,
      role: "staff",
      who: my || "本人",
      channel: chLabel,
      periods: [],
      cur: null,
      total: paidAmt,
      registered: users,
      buyers: mine.length,
      codes: codes,
      rows: mine.sort(function (a, b) { return a.at < b.at ? 1 : -1; })
    };
  }

  /* ================= 数据层：分账结构 / 来源排行 ================= */

  function provinceSplit(ctx) {
    var fin = window.Uni.financeSplit(ctx.s);
    var subs = (fin.sub.perSub || []).slice().sort(function (a, b) { return b.agreed - a.agreed; });
    /* 逐家净留存 = 该线盘 ×50% − 约定付出；用于「来源排行」（按为省代创造的实际留存排序） */
    var rank = subs.map(function (p) {
      var pool = Math.round(p.settled * 0.5);
      return {
        name: p.name,
        settled: p.settled,
        ratio: p.ratio,
        agreed: p.agreed,
        pool: pool,
        retained: pool - p.agreed
      };
    }).sort(function (a, b) { return b.retained - a.retained; });

    var total = fin.sub.retained + fin.self.amount;
    return {
      gross: fin.gross,
      sub: fin.sub,
      self: fin.self,
      total: total,
      subCount: subs.length,
      selfLine: { name: "自营线 · 直营获客", settled: fin.self.settledGross, ratio: 1, agreed: 0, pool: fin.self.amount, retained: fin.self.amount, self: true },
      rank: rank
    };
  }

  /* 二级：按事项类型拆解本期合格消费（有当月明细时才有） */
  function itemSplit(period) {
    if (!period || !period.detail) return null;
    var acc = {}, total = 0;
    period.detail.forEach(function (d) {
      var k = d.item || "order";
      acc[k] = (acc[k] || 0) + (Number(d.amount) || 0);
      total += Number(d.amount) || 0;
    });
    var rows = ITEM_SEQ.filter(function (k) { return acc[k]; }).map(function (k) {
      return { key: k, label: ITEM_LB[k], icon: ITEM_IC[k], amount: acc[k], share: share(acc[k], total) };
    }).sort(function (a, b) { return b.amount - a.amount; });
    return { rows: rows, total: total };
  }

  /* ================= 数据层：统一 view-model ================= */

  function buildVm(ctx, role) {
    if (role === "staff") return staffVm(ctx);

    var isSub = role === "sub";
    var periods = isSub ? subPeriods(ctx) : provincePeriods(ctx);

    /* 当前账期：优先保留用户选择，失效则回到最新账期 */
    var months = periods.map(function (p) { return p.month; });
    if (!_s.month || months.indexOf(_s.month) < 0) _s.month = months[0] || null;
    var idx = months.indexOf(_s.month);
    var cur = periods[idx] || null;
    var prev = idx >= 0 ? periods[idx + 1] || null : null;

    var vm = {
      staff: false,
      role: role,
      periods: periods,
      cur: cur,
      prev: prev,
      delta: deltaOf(cur, prev, "income"),
      split: isSub ? null : provinceSplit(ctx),
      items: isSub ? itemSplit(cur) : null,
      empty: !periods.length
    };

    if (isSub) {
      vm.metrics = [
        { key: "income", label: "经营所得" },
        { key: "eligible", label: "合格消费" },
        { key: "gross", label: "分账总盘" }
      ];
    } else {
      vm.metrics = [
        { key: "income", label: "经营实得" },
        { key: "bill", label: "平台账单" },
        { key: "eligible", label: "合格消费" }
      ];
    }
    if (!_s.metric || !vm.metrics.some(function (m) { return m.key === _s.metric; })) {
      _s.metric = vm.metrics[0].key;
    }
    vm.metric = _s.metric;
    return vm;
  }

  /* ================= 渲染：账期条 ================= */

  function periodBarHtml(vm) {
    if (!vm.periods.length) return "";
    var chips = vm.periods.map(function (p) {
      var on = p.month === (vm.cur && vm.cur.month);
      return '<button type="button" class="ulg-pchip' + (on ? " is-on" : "") + '" role="tab" ' +
        'aria-selected="' + (on ? "true" : "false") + '" data-month="' + ui.esc(p.month) + '">' +
        '<span class="ulg-pchip__m"><i class="ulg-dot ulg-dot--' + p.stateCls + '" aria-hidden="true"></i>' +
        ui.esc(p.month) + "</span>" +
        '<span class="ulg-pchip__a">' + ui.moneyPlain(p.income) + "</span>" +
        "</button>";
    }).join("");

    var sum = vm.periods.reduce(function (a, p) { return a + (num(p.income) ? p.income : 0); }, 0);
    return '<div class="ulg-pbar"><div class="ulg-pbar__in">' +
      '<div class="ulg-periods" role="tablist" aria-label="账期切换">' + chips + "</div>" +
      '<div class="ulg-pbar__sum">近 ' + vm.periods.length + " 期累计 <b>" + ui.money(sum) + "</b></div>" +
      "</div></div>";
  }

  /* ================= 渲染：本期概览 ================= */

  function receiptHtml(reg, label) {
    if (!reg || !reg.n) {
      return '<div class="ulg-receipt"><div class="ulg-receipt__h"><span>' + ui.esc(label) + "</span>" +
        '<span class="ulg-receipt__none">本期暂无付款登记</span></div></div>';
    }
    var okW = share(reg.ok, reg.total) * 100;
    var waitW = share(reg.wait, reg.total) * 100;
    var badW = share(reg.bad, reg.total) * 100;
    var segs = "";
    if (okW > 0) segs += '<i class="ulg-seg ulg-seg--ok" style="width:' + okW + '%"></i>';
    if (waitW > 0) segs += '<i class="ulg-seg ulg-seg--wait" style="width:' + waitW + '%"></i>';
    if (badW > 0) segs += '<i class="ulg-seg ulg-seg--bad" style="width:' + badW + '%"></i>';
    return '<div class="ulg-receipt">' +
      '<div class="ulg-receipt__h"><span>' + ui.esc(label) + '</span>' +
      '<span class="ulg-receipt__none">登记 ' + reg.n + " 笔 · " + ui.money(reg.total) + "</span></div>" +
      '<div class="ulg-receipt__bar">' + segs + "</div>" +
      '<div class="ulg-receipt__l">' +
      '<span class="d-ok"><i></i>已确认 ' + ui.money(reg.ok) + "</span>" +
      '<span class="d-wait"><i></i>待确认 ' + ui.money(reg.wait) + "</span>" +
      '<span class="d-bad"><i></i>争议 ' + ui.money(reg.bad) + "</span>" +
      "</div></div>";
  }

  function heroHtml(vm) {
    var p = vm.cur;
    var isSub = vm.role === "sub";

    var formula = isSub
      ? (p.derived
        ? "该账期无复算记录 · 仅列账单金额"
        : "= 合格消费 <b>" + ui.money(p.eligible) + "</b> × 50% → 分账总盘 <b>" + ui.money(p.gross) +
          "</b> → 约定 <b>" + ui.esc(p.ratioTxt) + "</b>")
      : "= 平台账单 <b>" + ui.money(p.bill) + "</b> − 付二级 <b>" + ui.money(p.paySub) + "</b>";

    var kpis = "";
    if (isSub) {
      kpis =
        '<div class="ulg-kv3__i"><span>合格消费</span><b>' + (num(p.eligible) ? ui.money(p.eligible) : "—") + "</b></div>" +
        '<div class="ulg-kv3__i"><span>分账总盘</span><b>' + (num(p.gross) ? ui.money(p.gross) : "—") + "</b></div>" +
        '<div class="ulg-kv3__i"><span>约定比例</span><b>' + ui.esc(p.ratioTxt) + "</b></div>";
    } else {
      kpis =
        '<div class="ulg-kv3__i"><span>平台合格消费</span><b>' + ui.money(p.eligible) + "</b></div>" +
        '<div class="ulg-kv3__i"><span>平台账单</span><b>' + ui.money(p.bill) + "</b></div>" +
        '<div class="ulg-kv3__i"><span>付二级企业</span><b>' + ui.money(p.paySub) + "</b></div>";
    }

    return '<section class="card ulg-hero" id="lg-hero">' +
      '<div class="ulg-hero__head"><span class="uh-eyebrow">' + (isSub ? "本期经营所得" : "本期经营实得") + "</span>" +
      '<span class="uh-badge uh-badge--' + p.stateCls + '">' + ui.esc(p.stateTxt) + "</span></div>" +
      '<div class="ulg-hero__main">' +
      '<div class="uh-bignum ulg-bignum" data-count="' + (num(p.income) ? p.income : 0) + '">' + ui.moneyD(0) + "</div>" +
      deltaHtml(vm.delta, "首期无环比") +
      "</div>" +
      '<div class="ulg-formula">' + formula + "</div>" +
      receiptHtml(p.regIn, isSub ? "省代付款登记" : "平台付款登记") +
      '<div class="ulg-kv3">' + kpis + "</div>" +
      "</section>";
  }

  /* ================= 渲染：账期趋势 ================= */

  function metricVal(p, key) {
    var v = p[key];
    return num(v) ? v : null;
  }

  function trendHtml(vm) {
    if (vm.periods.length < 2) {
      return '<section class="card ulg-blk">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">账期趋势</span></div>' +
        '<div class="uh-note" style="margin-top:8px">仅 1 个账期，暂无可比趋势；次期账单出账后自动生成。</div></section>';
    }

    var key = vm.metric;
    var asc = vm.periods.slice().reverse();                 /* 时间正序 */
    var vals = asc.map(function (p) { return metricVal(p, key); });
    var finite = vals.filter(function (v) { return v !== null; });
    var max = finite.length ? Math.max.apply(null, finite) : 0;
    var scale = max > 0 ? max * 1.24 : 1;

    var cols = "", axis = "";
    asc.forEach(function (p, i) {
      var v = vals[i];
      var on = p.month === (vm.cur && vm.cur.month);
      var d = i > 0 ? deltaOf(p, asc[i - 1], key) : null;
      var h = v === null ? 0 : Math.max(share(v, scale) * 100, 2);
      cols += '<button type="button" class="ulg-col' + (on ? " is-on" : "") + (v === null ? " is-na" : "") + '" ' +
        'data-month="' + ui.esc(p.month) + '" aria-label="' + ui.esc(p.month) + (v === null ? " 无数据" : " " + ui.money(v)) + '">' +
        (v === null
          ? '<span class="ulg-col__na">—</span>'
          : '<span class="ulg-col__v" style="bottom:calc(' + h + '% + 4px)">' + ui.moneyPlain(v) + "</span>" +
            '<i class="ulg-col__bar" style="height:' + h + '%"></i>') +
        "</button>";
      axis += '<div class="ulg-ax' + (on ? " is-on" : "") + '" data-month="' + ui.esc(p.month) + '">' +
        "<span>" + ui.esc(p.month.slice(5)) + "月</span>" +
        (d ? '<em class="' + (d.pct >= 0 ? "up" : "down") + '">' + signPct(d.pct) + "</em>" : '<em class="flat">首期</em>') +
        "</div>";
    });

    var avgBottom = finite.length ? share(finite.reduce(function (a, b) { return a + b; }, 0) / finite.length, scale) * 100 : 0;
    /* 均值只画虚线不写字：本期与均值接近时（数据本就平淡）标签必与柱顶数值相撞 */
    var rule = finite.length ? '<div class="ulg-rule" style="bottom:' + avgBottom + '%"></div>' : "";

    var mtabs = vm.metrics.map(function (m) {
      return '<button type="button" class="ulg-mtab' + (m.key === key ? " is-on" : "") + '" data-metric="' + m.key + '">' + ui.esc(m.label) + "</button>";
    }).join("");

    /* 基线可比：本期 vs 近 N 期均值 */
    var note = "";
    if (finite.length) {
      var avg = finite.reduce(function (a, b) { return a + b; }, 0) / finite.length;
      var curv = metricVal(vm.cur, key);
      if (num(curv) && avg > 0) {
        var dev = (curv - avg) / avg * 100;
        note = "虚线为近 " + finite.length + " 期均值 " + ui.money(Math.round(avg)) + " · 本期" +
          (Math.abs(dev) < 0.5 ? "持平均值" : (dev > 0 ? "高于均值 " : "低于均值 ") + Math.abs(Math.round(dev * 10) / 10) + "%");
      }
    }

    return '<section class="card ulg-blk">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">账期趋势</span>' +
      '<div class="ulg-mtabs" role="tablist">' + mtabs + "</div></div>" +
      '<div class="ulg-plot">' + rule + '<div class="ulg-cols">' + cols + "</div></div>" +
      '<div class="ulg-axis">' + axis + "</div>" +
      (note ? '<div class="uh-note" style="margin-top:10px">' + ui.esc(note) + "</div>" : "") +
      "</section>";
  }

  /* ================= 渲染：账期台账 ================= */

  function ledgerBookHtml(vm) {
    var isSub = vm.role === "sub";
    var rows = vm.periods.map(function (p) {
      var on = p.month === (vm.cur && vm.cur.month);
      var cells;
      if (isSub) {
        cells = "<td>" + (num(p.eligible) ? ui.moneyPlain(p.eligible) : "—") + "</td>" +
          "<td>" + (num(p.gross) ? ui.moneyPlain(p.gross) : "—") + "</td>" +
          '<td class="tb-strong">' + ui.moneyPlain(p.income) + "</td>";
      } else {
        cells = "<td>" + ui.moneyPlain(p.bill) + "</td>" +
          "<td>" + ui.moneyPlain(p.paySub) + "</td>" +
          '<td class="tb-strong">' + ui.moneyPlain(p.income) + "</td>";
      }
      return '<tr class="ulg-brow' + (on ? " is-on" : "") + '" data-month="' + ui.esc(p.month) + '" tabindex="0" role="button" ' +
        'aria-label="查看 ' + ui.esc(p.month) + ' 账期分解">' +
        '<td class="tb-month"><span>' + ui.esc(p.month) + "</span>" +
        '<i class="ulg-tag ulg-tag--' + p.stateCls + '">' + ui.esc(p.stateTxt) + "</i></td>" +
        cells +
        '<td class="tb-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></td>' +
        "</tr>";
    }).join("");

    var head = isSub
      ? "<th>账期 / 状态</th><th>合格消费</th><th>分账总盘</th><th>经营所得</th><th></th>"
      : "<th>账期 / 状态</th><th>平台账单</th><th>付二级</th><th>经营实得</th><th></th>";

    var note = vm.periods.some(function (p) { return p.derived; })
      ? "标「—」的账期无当月复算记录（逾期锁定 / 未结算），仅列账单金额，不做推算。"
      : "点任意账期查看当期分解与对账单。";

    return '<section class="card ulg-blk ulg-bookcard">' +
      '<div class="uh-finhead" style="margin-bottom:10px"><span class="uh-eyebrow">账期台账</span>' +
      '<button type="button" class="ulg-tool" data-act="export">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>' +
      "导出 CSV</button></div>" +
      '<div class="ulg-book"><table class="ulg-table"><thead><tr>' + head + "</tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>" +
      '<div class="uh-note" style="margin-top:10px">' + ui.esc(note) + "</div>" +
      "</section>";
  }

  /* ================= 渲染：分账结构（这笔钱怎么算出来的） ================= */

  function treeRow(lv, label, value, opts) {
    var o = opts || {};
    var w = o.share != null ? Math.round(o.share * 100) : null;
    return '<div class="ulg-trow ulg-trow--lv' + lv + (o.total ? " is-total" : "") + (o.neg ? " is-neg" : "") + '"' +
      (w != null ? ' style="--w:' + w + '%"' : "") + ">" +
      '<span class="ulg-trow__lb">' + ui.esc(label) + "</span>" +
      (o.tag ? '<i class="ulg-trow__tag">' + ui.esc(o.tag) + "</i>" : "") +
      '<span class="ulg-trow__v">' + ui.esc(value) + "</span>" +
      "</div>";
  }

  function splitHtml(vm) {
    if (vm.role === "sub") {
      var p = vm.cur;
      if (!p || !num(p.eligible)) {
        return '<section class="card ulg-blk">' +
          '<div class="uh-finhead"><span class="uh-eyebrow">分账结构</span>' +
          '<span class="uh-badge uh-badge--mute">账期口径</span></div>' +
          '<div class="uh-note" style="margin-top:8px">该账期无复算记录，分账结构不可复算；请查看对账单或对账历史。</div></section>';
      }
      var rows =
        treeRow(0, "本企业合格消费", ui.money(p.eligible), { share: 1 }) +
        treeRow(1, "分账总盘（×50%）", ui.money(p.gross), { share: 0.5 }) +
        treeRow(2, "约定所得（× " + p.ratioTxt + "）", ui.money(p.income), { share: p.ratio * 0.5, neg: false }) +
        treeRow(0, "本期经营所得", ui.money(p.income), { total: true });
      return '<section class="card ulg-blk">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">分账结构</span>' +
        '<span class="uh-badge uh-badge--mute">账期口径 · ' + ui.esc(p.month) + "</span></div>" +
        '<div class="ulg-tree">' + rows + "</div>" +
        (p.frozen ? '<div class="uh-note" style="margin-top:8px">T+7 冻结期内 ' + ui.money(p.frozen) + " 暂不计入可结算所得。</div>" : "") +
        "</section>";
    }

    var sp = vm.split;
    if (!sp || !sp.gross) {
      return '<section class="card ulg-blk">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">分账结构</span></div>' +
        '<div class="uh-note" style="margin-top:8px">尚无经营基数，平台产生首笔合格消费后自动生成。</div></section>';
    }
    var rows2 =
      treeRow(0, "平台合格消费", ui.money(sp.gross), { share: 1 }) +
      treeRow(1, "二级线 · " + sp.subCount + " 家在约", ui.money(sp.sub.settledGross), { share: share(sp.sub.settledGross, sp.gross) }) +
      treeRow(2, "二级线盘（×50%）", ui.money(sp.sub.pool), {}) +
      treeRow(2, "约定给二级企业", ui.money(-sp.sub.agreed), { neg: true }) +
      treeRow(2, "二级线自留", ui.money(sp.sub.retained), {}) +
      treeRow(1, "自营线 · 直营获客", ui.money(sp.self.settledGross), { share: share(sp.self.settledGross, sp.gross) }) +
      treeRow(2, "自营线收益（×50% 全额）", ui.money(sp.self.amount), {}) +
      treeRow(0, "经营基数合计", ui.money(sp.total), { total: true });

    /* 分账明细与月度账单不等时明示（P0-2：不让卡片自相矛盾） */
    var warn = "";
    if (vm.cur && !vm.cur.derived && num(vm.cur.income) && sp.total !== vm.cur.income) {
      warn = '<div class="uh-note" style="color:var(--warning-ink);margin-top:8px">' +
        "分账明细合计 " + ui.money(sp.total) + " 与 " + ui.esc(vm.cur.month) + " 账单实得 " + ui.money(vm.cur.income) +
        " 不一致：台账以账单为准，明细待核。</div>";
    }

    return '<section class="card ulg-blk">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">分账结构</span>' +
      '<span class="uh-badge uh-badge--mute">基数口径</span></div>' +
      '<div class="ulg-tree">' + rows2 + "</div>" +
      '<div class="uh-note" style="margin-top:10px">经营基数按各二级企业最近账期合格消费测算，不随上方账期切换；账期口径见「账期台账」。</div>' +
      warn + "</section>";
  }

  /* ================= 渲染：来源结构 ================= */

  function rankHtml(vm) {
    if (vm.role === "sub") {
      var it = vm.items;
      var headSub = '<div class="uh-finhead"><span class="uh-eyebrow">收入构成 · 按事项</span>' +
        '<span class="uh-badge uh-badge--mute">账期口径' + (vm.cur ? " · " + ui.esc(vm.cur.month) : "") + "</span></div>";
      if (!it || !it.rows.length) {
        return '<section class="card ulg-blk">' + headSub +
          '<div class="uh-note" style="margin-top:8px">该账期暂无事项级明细；明细分项随月度账单归档，可在「对账单」中查看。</div></section>';
      }
      var mx = it.rows[0].amount || 1;
      var bodySub = it.rows.map(function (r) {
        return '<div class="ulg-rk" style="--w:' + Math.round(r.amount / mx * 100) + '%">' +
          '<span class="ulg-rk__n">' + ui.icon(r.icon, 15) + '<span class="ulg-rk__t">' + ui.esc(r.label) + "</span></span>" +
          '<span class="ulg-rk__p">' + Math.round(r.share * 1000) / 10 + "%</span>" +
          '<span class="ulg-rk__v">' + ui.money(r.amount) + "</span></div>";
      }).join("");
      return '<section class="card ulg-blk">' + headSub +
        '<div class="ulg-rklist">' + bodySub + "</div>" +
        '<div class="ulg-rkfoot"><span>合格消费合计</span><b>' + ui.money(it.total) + "</b></div></section>";
    }

    var sp = vm.split;
    var head = '<div class="uh-finhead"><span class="uh-eyebrow">来源结构 · 省代留存排行</span>' +
      '<span class="uh-badge uh-badge--mute">基数口径</span></div>';
    if (!sp || !sp.rank.length) {
      return '<section class="card ulg-blk">' + head +
        '<div class="uh-note" style="margin-top:8px">暂无在约二级企业，来源结构在签约后生成。</div></section>';
    }

    var all = [sp.selfLine].concat(sp.rank).sort(function (a, b) { return b.retained - a.retained; });
    var max = all[0] ? all[0].retained || 1 : 1;
    var body = all.map(function (r) {
      return '<div class="ulg-rk' + (r.self ? " is-self" : "") + '" style="--w:' + Math.round(r.retained / max * 100) + '%" ' +
        (r.self ? "" : 'data-sub="' + ui.esc(r.name) + '" tabindex="0" role="button"') + ">" +
        '<span class="ulg-rk__n"><span class="ulg-rk__t">' + ui.esc(r.name) + "</span>" +
        (r.self ? '<i class="ulg-rk__tg">自营</i>' : '<i class="ulg-rk__tg">约定 ' + Math.round(r.ratio * 100) + "%</i>") + "</span>" +
        '<span class="ulg-rk__p">消费 ' + ui.moneyPlain(r.settled) + "</span>" +
        '<span class="ulg-rk__v">' + ui.money(r.retained) + "</span></div>";
    }).join("");

    return '<section class="card ulg-blk">' + head +
      '<div class="ulg-rklist">' + body + "</div>" +
      '<div class="ulg-rkfoot"><span>合计（= 经营基数）</span><b>' + ui.money(sp.total) + "</b></div>" +
      '<div class="uh-note" style="margin-top:8px">留存 = 该线盘（合格消费 ×50%）− 约定付出；自营线 100% 归省代。</div>' +
      "</section>";
  }

  /* ================= 渲染：员工视角 ================= */

  function staffHtml(vm) {
    if (!vm.rows.length) {
      return '<section class="card ulg-blk">' +
        window.Uni.emptyHtml("暂无获客消费记录",
          "名下获客用户产生有效消费后，这里会按月汇总本人消费明细。", "receipt") + "</section>";
    }
    var rows = vm.rows.map(function (r) {
      return '<div class="ulg-staffrow">' +
        '<span class="ulg-staffrow__u">' + ui.esc(r.user) + '<em>' + ui.esc(r.at || "—") + "</em></span>" +
        '<span class="ulg-staffrow__c">' + ui.esc(r.channel) + "</span>" +
        '<span class="ulg-staffrow__v">' + ui.money(r.amount) + "</span></div>";
    }).join("");

    return '<section class="card ulg-blk">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">我的获客消费</span>' +
      '<span class="uh-badge uh-badge--mute">本人渠道</span></div>' +
      '<div class="uh-bignum ulg-bignum" data-count="' + vm.total + '">' + ui.moneyD(0) + "</div>" +
      '<div class="ulg-formula">= 已消费 <b>' + vm.buyers + " 人</b> 的消费合计（名下注册 <b>" + vm.registered + " 人</b>）</div>" +
      '<div class="ulg-kv3">' +
      '<div class="ulg-kv3__i"><span>名下注册</span><b>' + vm.registered + " 人</b></div>" +
      '<div class="ulg-kv3__i"><span>已消费</span><b>' + vm.buyers + " 人</b></div>" +
      '<div class="ulg-kv3__i"><span>渠道码</span><b>' + (vm.codes.length ? vm.codes.length + " 个" : "未生成") + "</b></div>" +
      "</div></section>" +
      '<section class="card ulg-blk">' +
      '<div class="uh-finhead" style="margin-bottom:6px"><span class="uh-eyebrow">消费明细</span>' +
      '<span class="uh-badge uh-badge--mute">' + vm.rows.length + " 笔</span></div>" +
      '<div class="ulg-stafflist">' + rows + "</div></section>";
  }

  /* ================= 口径说明（含页面分工） ================= */

  function scopeBody(vm) {
    var common =
      '<div class="uh-clause"><div class="no">本页与相邻页面的分工</div><div class="c">' +
      "<b>对账中心</b>：单个账期的核对过程——逐笔比对、异议、确认、平账，以及付款登记与凭据流转。<br>" +
      "<b>对账历史</b>：历次对账单的档案索引——按账单类型归档、下载留存。<br>" +
      "<b>经营台账</b>：本页。按账期归集的经营结果——赚了多少、怎么算出来的、从哪来、走向如何，并可整表导出。</div></div>" +
      '<div class="uh-clause"><div class="no">计入项</div><div class="c">订单净额 · 积分解锁付费 · 增值服务付费 · 企业认证与入驻费</div></div>' +
      '<div class="uh-clause"><div class="no">排除项</div><div class="c">充值 · 免费积分 · 报名费 · 退款冲回（冻结期内剔除、当月红字冲减、跨月等额回冲）</div></div>';

    if (vm.role === "staff") {
      return '<div class="uh-clause"><div class="no">员工口径</div><div class="c">' +
        "仅展示本人渠道码带来的用户及其消费记录，不涉及企业分佣台账、不展示其他成员数据。</div></div>" + common;
    }
    if (vm.role === "sub") {
      return '<div class="uh-clause"><div class="no">分账路径</div><div class="c">' +
        "本企业合格消费 → 分账总盘（×50%）→ × 约定所得比例 = 约定所得；T+7 冻结期内不计入可结算。</div></div>" +
        '<div class="uh-clause"><div class="no">账期口径说明</div><div class="c">' +
        "账期金额与状态取自月度账单；合格消费、总盘、比例由约定比例复算。无当月复算记录的账期（逾期锁定 / 未结算）只列账单金额，不做推算。</div></div>" +
        common;
    }
    return '<div class="uh-clause"><div class="no">分账路径</div><div class="c">' +
      "全省合格消费 → 省代分账盘（×50%）→ 二级线按逐家约定比例分配，余额自留；自营线（直营获客）不参与逐家分配，×50% 全额归省代。</div></div>" +
      '<div class="uh-clause"><div class="no">两种口径</div><div class="c">' +
      "<b>账期口径</b>：本期概览、账期趋势、账期台账，取自月度账单，可逐期对比。<br>" +
      "<b>基数口径</b>：分账结构、来源结构，按各二级企业最近账期合格消费测算，用于看结构而非看单期。</div></div>" +
      common;
  }

  /* ================= 交互：账期分解弹窗 ================= */

  function detailHtml(ctx, vm, p) {
    var isSub = vm.role === "sub";
    var rows = [];

    function kv(k, v, cls) {
      rows.push('<div class="uh-sheetkv"><span class="k">' + ui.esc(k) + '</span><span class="v"' +
        (cls ? ' style="color:' + cls + '"' : "") + ">" + v + "</span></div>");
    }

    if (isSub) {
      kv("合格消费", num(p.eligible) ? ui.money(p.eligible) : "不可复算（无当月记录）");
      kv("分账总盘（×50%）", num(p.gross) ? ui.money(p.gross) : "—");
      kv("约定比例", ui.esc(p.ratioTxt));
      kv("经营所得", ui.money(p.income));
    } else {
      kv("平台合格消费", ui.money(p.eligible));
      kv("平台账单", ui.money(p.bill));
      kv("付二级企业", ui.money(p.paySub));
      kv("经营实得", ui.money(p.income));
    }
    if (p.issueAt) kv("出账日", ui.esc(p.issueAt));
    if (p.dueAt) kv("应付日", ui.esc(p.dueAt));
    if (p.settledAt) kv("结算日", ui.esc(p.settledAt));

    var regHtml = "";
    if (p.regIn && p.regIn.n) {
      regHtml = '<div class="uh-sechead" style="margin:14px 0 8px"><span class="lbl">' +
        (isSub ? "省代付款登记" : "平台付款登记") + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">已确认</span><span class="v" style="color:var(--success)">' + ui.money(p.regIn.ok) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">待确认</span><span class="v" style="color:var(--warning-ink)">' + ui.money(p.regIn.wait) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">争议</span><span class="v" style="color:var(--error)">' + ui.money(p.regIn.bad) + "</span></div>";
    }

    /* 事项构成：仅当月有明细的账期（省代取平台→省代明细；二级取本企业明细） */
    var it = p.detail && p.detail.length ? itemSplit({ detail: p.detail }) : null;
    var itHtml = "";
    if (it && it.rows.length) {
      itHtml = '<div class="uh-sechead" style="margin:16px 0 8px"><span class="lbl">事项构成（合格消费）</span></div>' +
        it.rows.map(function (r) {
          return '<div class="uh-sheetkv"><span class="k">' + ui.esc(r.label) + '</span><span class="v">' +
            ui.money(r.amount) + " · " + Math.round(r.share * 1000) / 10 + "%</span></div>";
        }).join("");
    }

    return '<div class="ulg-dhead">' +
      '<span class="ulg-dhead__m">' + ui.esc(p.month) + " 账期</span>" +
      '<span class="uh-badge uh-badge--' + p.stateCls + '">' + ui.esc(p.stateTxt) + "</span></div>" +
      '<div class="uh-ledgerline"></div>' +
      rows.join("") + regHtml + itHtml;
  }

  function openDetail(ctx, vm, month, Uni) {
    var p = vm.periods.filter(function (x) { return x.month === month; })[0];
    if (!p) { Uni.toast("该账期数据缺失", "err"); return; }

    var hasDoc = !!(ctx.s.hist || []).filter(function (h) {
      if ((h.month || "") !== month) return false;
      return ctx.mode === "sub" ? true : (h.type || "platform") === "platform";
    })[0];

    Uni.sheet({
      title: "账期分解",
      body: detailHtml(ctx, vm, p),
      footer: [
        {
          t: hasDoc ? "对账单" : "无对账单",
          kind: "ghost",
          onClick: function () {
            if (!hasDoc || !window.UniDoc) { Uni.toast("该账期对账单缺失", "err"); return false; }
            var h = (ctx.s.hist || []).filter(function (x) {
              return (x.month || "") === month && (ctx.mode === "sub" ? true : (x.type || "platform") === "platform");
            })[0];
            window.UniDoc.openSheet(ctx, h, Uni, {
              more: { t: "去对账中心", on: function () { Uni.navTo("reconcile.html"); } }
            });
          }
        },
        { t: "去对账中心", kind: "primary", onClick: function () { Uni.navTo("reconcile.html"); } }
      ]
    });
  }

  /* ================= 状态变体 ================= */

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) { return buildVm(ctx, "province"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) { return buildVm(ctx, "staff"); },
      entries: [], perms: {},
      badges: { ledger: "员工 · 只读" },
      empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) { return buildVm(ctx, "sub"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    },
    /* 二级员工无企业台账读取权，回退到本人渠道视角（不得落到 sub_admin 的 data） */
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: function (ctx) { return buildVm(ctx, "staff"); },
      entries: [], perms: {},
      badges: { ledger: "员工 · 仅本人渠道" },
      empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    }
  };

  /* ================= 唯一渲染路径 ================= */

  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var sc = el.closest ? el.closest(".scroll") : null;

    function paint() {
      var html = "";

      /* 只读封条（法代 / 冻结态） */
      if (ctx.readonly) {
        html += '<section class="ulg-blk ulg-locks"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">' + ui.esc(Uni.lockTitle(ctx, V)) + "（仅可查看）</span>" +
          '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
      }

      if (vm.staff) {
        html += '<div class="ulg-pad">' + staffHtml(vm) + "</div>";
      } else if (vm.empty) {
        html += '<div class="ulg-pad">' +
          '<section class="card ulg-blk">' +
          Uni.emptyHtml("暂无经营台账",
            "平台月度账单出账后自动生成台账；出账前无可复算的经营数据。", "receipt") + "</section>" +
          "</div>";
        el.innerHTML = html;
        if (sc) sc.scrollTop = 0;
        return;
      } else {
        html += periodBarHtml(vm);
        html += '<div class="ulg-pad">';
        html += heroHtml(vm);
        html += trendHtml(vm);
        html += ledgerBookHtml(vm);
        html += splitHtml(vm);
        html += rankHtml(vm);
        html += "</div>";
      }

      el.innerHTML = html;

      /* 主数字 count-up（reduced-motion 直跳，由 Uni.countUp 内部处理） */
      var cnum = el.querySelector("[data-count]");
      if (cnum) Uni.countUp(cnum, parseFloat(cnum.getAttribute("data-count")), 420, ui.moneyD);

      wire();
    }

    /* 切账期：重算 → 重绘 → 把账期条带回滚动视口顶部（内容高度相近，不打断阅读） */
    function gotoMonth(m) {
      if (!m || m === _s.month) return;
      _s.month = m;
      vm = V.data(ctx);
      paint();
      if (sc) {
        var bar = el.querySelector(".ulg-pbar");
        var hero = el.querySelector("#lg-hero");
        if (hero) {
          var hr = hero.getBoundingClientRect();
          var cr = sc.getBoundingClientRect();
          var stick = bar ? bar.offsetHeight : 0;
          sc.scrollTo({ top: Math.max(0, sc.scrollTop + (hr.top - cr.top) - stick), behavior: "smooth" });
        }
      }
    }

    function wire() {
      /* 账期条 + 趋势柱 + 台账行：同一套 data-month 委托 */
      el.querySelectorAll('.ulg-pchip[data-month], .ulg-col[data-month], .ulg-ax[data-month]').forEach(function (n) {
        n.addEventListener("click", function () { gotoMonth(n.getAttribute("data-month")); });
      });

      /* 台账行：点开账期分解（键盘可达） */
      el.querySelectorAll(".ulg-brow[data-month]").forEach(function (n) {
        function open() { openDetail(ctx, vm, n.getAttribute("data-month"), Uni); }
        n.addEventListener("click", open);
        n.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); open(); }
        });
      });

      /* 趋势指标切换 */
      el.querySelectorAll("[data-metric]").forEach(function (n) {
        n.addEventListener("click", function () {
          var k = n.getAttribute("data-metric");
          if (k === _s.metric) return;
          _s.metric = k;
          vm = V.data(ctx);          /* 必须重算：vm.metric 由 buildVm 读 _s.metric，否则标签不跟随 */
          paint();
        });
      });

      /* 导出 CSV */
      el.querySelectorAll('[data-act="export"]').forEach(function (n) {
        n.addEventListener("click", function () { exportCsv(ctx, vm, Uni); });
      });

      /* 来源排行 → 该二级线明细（省代） */
      el.querySelectorAll('.ulg-rk[data-sub]').forEach(function (n) {
        function open() {
          var name = n.getAttribute("data-sub");
          var row = vm.split && vm.split.rank.filter(function (r) { return r.name === name; })[0];
          if (!row) return;
          Uni.sheet({
            title: name,
            body: '<div class="uh-kv"><span class="k">合格消费（基数）</span><span class="v">' + ui.money(row.settled) + "</span></div>" +
              '<div class="uh-kv"><span class="k">该线盘（×50%）</span><span class="v">' + ui.money(row.pool) + "</span></div>" +
              '<div class="uh-kv"><span class="k">约定比例</span><span class="v">' + Math.round(row.ratio * 100) + "%</span></div>" +
              '<div class="uh-kv"><span class="k">约定付出</span><span class="v" style="color:var(--warning-ink)">' + ui.money(row.agreed) + "</span></div>" +
              '<div class="uh-kv"><span class="k">省代留存</span><span class="v">' + ui.money(row.retained) + "</span></div>" +
              '<div class="uh-note" style="margin-top:10px">基数为该企业最近账期合格消费；逐家账期明细见「对账中心 → 明细」。</div>',
            footer: [
              { t: "关闭", kind: "ghost" },
              { t: "去对账中心", kind: "primary", onClick: function () { Uni.navTo("reconcile.html?focus=2"); } }
            ]
          });
        }
        n.addEventListener("click", open);
        n.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); open(); }
        });
      });
    }

    /* 口径说明：入口在页头右上角（页底折叠卡已移除），弹出同一份口径正文 */
    var scopeBtn = document.getElementById("lg-scope");
    if (scopeBtn && !scopeBtn.getAttribute("data-bound")) {
      scopeBtn.setAttribute("data-bound", "1");
      scopeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        Uni.sheet({
          title: "经营台账口径说明",
          body: scopeBody(vm),
          footer: [{ t: "关闭", kind: "ghost" }]
        });
      });
    }

    paint();
  }

  /* ================= 导出 ================= */

  function exportCsv(ctx, vm, Uni) {
    var isSub = vm.role === "sub";
    var head = isSub
      ? ["账期", "状态", "合格消费", "分账总盘", "约定比例", "经营所得", "已确认", "待确认", "争议", "出账日", "应付日", "结算日"]
      : ["账期", "状态", "合格消费", "平台账单", "付二级企业", "经营实得", "已确认", "待确认", "争议", "出账日", "应付日", "结算日"];

    var rows = [head];
    vm.periods.slice().reverse().forEach(function (p) {
      var reg = p.regIn || { ok: 0, wait: 0, bad: 0 };
      rows.push(isSub
        ? [p.month, p.stateTxt, num(p.eligible) ? p.eligible : "", num(p.gross) ? p.gross : "", p.ratioTxt, p.income,
           reg.ok, reg.wait, reg.bad, p.issueAt, p.dueAt, p.settledAt]
        : [p.month, p.stateTxt, p.eligible, p.bill, p.paySub, p.income,
           reg.ok, reg.wait, reg.bad, p.issueAt, p.dueAt, p.settledAt]);
    });

    var who = isSub ? "二级企业" : "省级总代";
    var stamp = (vm.cur && vm.cur.month) || "";
    var ok = downloadCsv("经营台账_" + who + (stamp ? "_" + stamp : "") + ".csv", rows);
    if (ok) Uni.toast("已导出 " + (rows.length - 1) + " 个账期");
    else Uni.toast("导出失败，请检查浏览器下载权限", "err");
  }

  window.Uni.register({
    view: "uni-ledger",
    route: "ledger.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    skeleton: true,
    mount: mount
  });
})();
