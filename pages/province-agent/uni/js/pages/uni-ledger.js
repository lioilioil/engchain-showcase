/* ============================================================
   uni-ledger.js · 经营台账（ledger.html）
   模板节奏（三身份同构，数据驱动填充）：
     只读口径说明条 → 经营所得卡（大数字 + KV）→ 月度趋势柱图 → 月度台账表格 → 计入/排除口径卡
   身份差异仅限：数据换源（二级=逐月 subSettle；省代=calcFinance + 上月已平账口径回推）、
   说明文案、徽章。员工只读。
   组件视觉全部为系统类（.card/.btn/.uh-* 基元…）；弹窗/Toast 经 Uni.*。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  /* ---------- 员工视角：仅本人获客用户及其消费记录（M3 渠道归因数据隔离） ---------- */
  function buildStaffVm(ctx) {
    var s = ctx.s, my = ctx.staffName;
    var mine = [], users = 0, paidAmt = 0;
    ["direct"].forEach(function (ch) {
      (s.leads[ch] || []).forEach(function (l) {
        if (l.owner !== my) return;
        users++;
        if (l.stage === "paid" || l.stage === "repaid") {
          paidAmt += l.amount || 0;
          mine.push({ user: l.name || "用户", channel: "直接合作", amount: l.amount || 0, stageTxt: "已消费" });
        }
      });
    });
    var codes = [];
    ["direct"].forEach(function (ch) {
      (s.channels[ch] || []).forEach(function (c) {
        if (c.ownerName === my && c.status === "active" && codes.indexOf(c.code) < 0) codes.push(c.code);
      });
    });
    var byChannel = { "直接合作": 0 };
    mine.forEach(function (r) { byChannel[r.channel] += r.amount; });
    var max = Math.max(byChannel["直接合作"], 1);
    var bars = ["直接合作"].map(function (lb) {
      return { label: lb, value: byChannel[lb], cur: true,
               pct: max > 0 ? Math.max(Math.round(byChannel[lb] / max * 100), 16) : 16 };
    });
    return {
      notice: "员工视角：仅展示本人渠道码带来的用户及其消费记录；不展示企业分佣台账。",
      cardTitle: "我的获客消费",
      big: paidAmt,
      bigMonth: "",
      bigNote: window.Uni.plainNote("= 已消费 <b>" + mine.length + " 人</b> 消费合计（名下注册 <b>" + users + " 人</b>）"),
      kvs: [
        { k: "名下已注册用户", v: users + " 人" },
        { k: "已消费用户", v: mine.length + " 人" },
        { k: "已消费金额", v: ui.money(paidAmt) },
        { k: "名下渠道码", v: codes.length ? codes.join(" · ") : "尚未生成" }
      ],
      bars: bars,
      rows: mine,
      staff: true
    };
  }

  /* ---------- view-model 折算（数据映射层：口径换源全部在此） ---------- */
  function buildVm(ctx, opt) {
    var vm = {
      notice: opt.notice,
      cardTitle: opt.cardTitle,
      big: 0,
      bigMonth: "",
      bigNote: "",
      bigWarn: "",
      flowPath: "",
      panoNote: "",
      kvs: [],
      bars: [],
      rows: [],
      tableNote: ""
    };

    if (ctx.mode === "sub") {
      /* 二级口径：逐月 subSettle 派生 */
      var calcs = ctx.s.calc || [];
      calcs.forEach(function (c, i) {
        var st = store.subSettle(c);
        vm.rows.push({
          month: c.month, eligible: st.eligible, gross: st.gross,
          ratio: Math.round(st.ratioToSub * 100) + "%", income: st.agreed
        });
        vm.bars.push({ label: c.month, value: st.agreed, cur: i === 0 });
      });
      var cur = vm.rows[0] || { eligible: 0, gross: 0, income: 0, ratio: "0%", frozen: 0 };
      var curSt = store.subSettle(calcs[0] || {});
      vm.big = cur.income;
      vm.bigMonth = cur.month || "";
      /* P0-1：主数字必带可复算的算式，禁止与月度台账行出现两个真值 */
      /* 算式必须一步算得出主数字：合格消费 6,000 × 约定 20% ≠ 600，中间要先过 ×50% 分佣线 */
      vm.bigNote = window.Uni.plainNote("= 总盘 <b>" + ui.money(cur.gross) + "</b>（合格消费 ×50%）× 约定 <b>" + cur.ratio + "</b>");
      /* P0-2：分账链路由整段示意图收敛为一句可读路径，随口径说明抽屉展开 */
      vm.flowPath = "合格消费 → 总盘 ×50% → × 本人约定比例 = 约定所得（T+7 冻结期内不计）";
      vm.kvs = [
        { k: "合格消费", v: ui.money(cur.eligible) },
        { k: "总盘（合格消费 ×50%）", v: ui.money(cur.gross) },
        { k: "约定所得比例", v: cur.ratio },
        { k: "T+7 在途冻结", v: ui.money(curSt.frozen) }
      ];
      /* 台账行由结算复算派生，账单里存在但无复算记录的账期（逾期锁定 / 未结算）
         不能静默缺席，否则台账月份集合会小于对账历史 */
      var haveM = {};
      vm.rows.forEach(function (r) { haveM[r.month] = 1; });
      var missM = (ctx.s.hist || []).map(function (h) { return h.month; })
        .filter(function (m, i, a) { return m && !haveM[m] && a.indexOf(m) === i; });
      if (missM.length) {
        vm.tableNote = missM.sort().reverse().join("、") +
          " 账期无结算复算记录（逾期锁定 / 未结算），不在本表计列，明细见对账历史。";
      }
    } else {
      /* 省代口径：T3 统一两分区（二级线 50% 盘 + 自营线 50% 全额） */
      var fin = window.Uni.financeSplit(ctx.s);
      var curIncome = fin.sub.retained + fin.self.amount;          /* 分账口径自算值（无月度账单时兜底） */
      /* P1-3：月度行改由 hist（月度账单权威清单，与「对账历史」同源）派生。
         旧实现写死 2026-09 / 2026-10 两行，且 09 行取自付款登记，
         台账月份集合会与对账历史漂移（2026-08 逾期月整月缺席）。 */
      var HIST = window.UniDoc ? window.UniDoc.HIST_LB : { pending: "对账中", settled: "已平账", overdue: "逾期锁定" };
      var mMap = {};
      (ctx.s.hist || []).forEach(function (h) {
        if (!h || !h.month) return;
        var e = mMap[h.month] || (mMap[h.month] = { month: h.month, plat: null, sub: null });
        if (h.type === "sub") e.sub = h; else e.plat = h;
      });
      vm.rows = Object.keys(mMap).sort(function (a, b) { return a < b ? 1 : -1; }).map(function (m) {
        var e = mMap[m];
        var plat = e.plat ? Number(e.plat.amount || 0) : 0;
        var sub = e.sub ? Number(e.sub.amount || 0) : 0;
        var st = (e.plat && e.plat.state) || (e.sub && e.sub.state) || "pending";
        return {
          month: m, eligible: Math.round(plat / 0.5), gross: plat,
          state: st, stateTxt: HIST[st] || "对账中",
          income: plat - sub /* 省代实得 = 收平台账单 − 付二级账单 */
        };
      });
      /* 柱图按时间正序（最新月高亮） */
      vm.bars = vm.rows.slice().reverse().map(function (r, i, arr) {
        return { label: r.month, value: r.income, cur: i === arr.length - 1 };
      });
      /* P0-1：主数字 = 最新账期省代实得，与月度台账首行取自同一份月度账单记录（单一真值）；
         无账单数据时回落到分账口径自算值。 */
      var curRow = vm.rows[0] || null;
      vm.big = curRow ? curRow.income : curIncome;
      vm.bigMonth = curRow ? curRow.month : ((ctx.s.calc1 && ctx.s.calc1.month) || "");
      vm.bigNote = window.Uni.plainNote(curRow
        ? "= 平台账单 <b>" + ui.money(curRow.gross) + "</b> − 付二级 <b>" + ui.money(curRow.gross - curRow.income) + "</b>"
        : "= 二级线自留 <b>" + ui.money(fin.sub.retained) + "</b> + 自营线收益 <b>" + ui.money(fin.self.amount) + "</b>");
      /* 大数字取自月度账单（hist），下方分账明细取自 financeBase —— 两套源。
         当前种子相等（4,400 = 2,400 + 2,000）不等于永远相等：只要有人改了一边，
         卡片会一边显示账单实得、一边明细相加是别的数，且静默无提示。
         不等时明示，宁可暴露口径差异也不让卡片自相矛盾。 */
      var finIncome = fin.sub.retained + fin.self.amount;
      vm.bigWarn = curRow && finIncome !== curRow.income
        ? "分账明细合计 " + ui.money(finIncome) + " 与月度账单实得 " + ui.money(curRow.income) + " 不一致：以账单为准，明细待核。"
        : "";
      /* P0-2：分账链路由整段示意图收敛为一句可读路径，随口径说明抽屉展开 */
      vm.flowPath = "全省合格消费 → 省代分账盘 ×50% → 自营线全额归省代；二级线按逐家约定分配，余额自留";
      vm.kvs = [
        { k: "平台合格消费", v: ui.money(fin.gross) },
        { k: "二级线盘（×50%）", v: ui.money(fin.sub.pool) },
        { k: "约定给二级", v: ui.money(fin.sub.agreed) },
        { k: "二级线自留", v: ui.money(fin.sub.retained) },
        { k: "自营线收益（×50%）", v: ui.money(fin.self.amount) }
      ];
      /* P1-1 按来源拆分：直营线（自营）与各二级线逐家（消费 / 总盘贡献 / 约定分配 / 自留） */
      var activeSubs2 = (ctx.s.subs || []).filter(function (x) { return x.status === "active" || x.status === "approved"; });
      var pendApps2 = (ctx.s.subApps || []).filter(function (a) { return a.status === "pending"; }).length;
      vm.srcSplit = {
        self: { label: "自营线 · 直营获客", settledGross: fin.self.settledGross, amount: fin.self.amount },
        subs: (fin.sub.perSub || []).map(function (p) {
          return { name: p.name, settled: p.settled, ratio: p.ratio, agreed: p.agreed };
        }),
        subGross: fin.sub.settledGross, subPool: fin.sub.pool,
        subAgreed: fin.sub.agreed, subRetained: fin.sub.retained,
        activeSubs: activeSubs2.length, pendingApps: pendApps2
      };
      /* P1-4 收益全景五条线：二级线所得 / 自营线收益 / 招商（家数）/ 个人合伙人返佣（可提现）/ 旧返佣留痕 */
      var rebate = 0, rebateCount = 0;
      try {
        var rb = JSON.parse(window.localStorage.getItem("engchain-rebate-orders") || "[]");
        if (Array.isArray(rb)) rb.forEach(function (r) {
          if (r && !r.voided && !r.clawed && r.amount) { rebate += Number(r.amount) || 0; rebateCount++; }
        });
      } catch (e) {}
      var legacySelf = 0, legacyCount = 0;
      try {
        var alg = JSON.parse(window.localStorage.getItem("engchain-agent-ledger") || "null");
        var alEntries = alg && alg.entries ? alg.entries : (Array.isArray(alg) ? alg : []);
        alEntries.forEach(function (e) {
          if (e && e.legacySelf && e.amount) { legacySelf += Number(e.amount) || 0; legacyCount++; }
        });
      } catch (e) {}
      /* P0-3：唯一可提现项置顶并给主色；无金额 / 不计收益项降为脚注，不再与真金白银同权排列 */
      vm.panorama = [
        { name: "个人合伙人 · 返佣", value: ui.money(rebate), attr: "可提现 · 用户端钱包", cls: "ok", sub: rebateCount + " 笔可提现" },
        { name: "代理 · 二级线自留", value: ui.money(fin.sub.retained), attr: "只读分账 · 不可提现", cls: "mute", sub: "逐家约定后的余额" },
        { name: "代理 · 自营线收益", value: ui.money(fin.self.amount), attr: "只读分账 · 独立分区", cls: "mute", sub: "直营获客消费 ×50% 全额" }
      ];
      vm.panoNote = "另：招商预估 " + activeSubs2.length + " 家二级在约（按约定比例逐家配置，待确认金额不展示）；" +
        "旧返佣留痕 " + ui.money(legacySelf) + "（" + legacyCount + " 笔），不计收益。";
    }

    /* 柱图比例（相对最大值，最近月高亮） */
    var max = vm.bars.reduce(function (m, b) { return Math.max(m, b.value); }, 0);
    vm.bars.forEach(function (b) {
      b.pct = max > 0 ? Math.max(Math.round(b.value / max * 100), 16) : 16;
    });
    return vm;
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        return buildVm(ctx, {
          cardTitle: "本月经营实得",
          notice: "经营台账为只读口径：二级线盘 = 二级线合格消费 × 50%，约定给二级按各家合作比例逐家配置；自营线 = 省代直营获客合格消费 × 50% 全额（独立分区）。不执行提现，仅记录、计算与分析。"
        });
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        return buildStaffVm(ctx); /* M3：员工仅本人获客用户及其消费记录 */
      },
      entries: [],
      perms: {},
      badges: { ledger: "员工 · 只读" },
      empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        return buildVm(ctx, {
          cardTitle: "本月经营所得",
          notice: "经营台账为只读口径复算：总盘 50%、本人约定所得按省代授权比例、T+7 冻结；仅展示已有月度数据。"
        });
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "台账数据已锁定，仅可查看"
    }
  };

  /* 台账行 → 单据：月份在 hist 中唯一（省代取平台侧、二级取本域账单），
     找不到就不弹空单，明确提示缺失 */
  function histOf(ctx, month) {
    var want = ctx.mode === "sub" ? null : "platform";
    var hit = (ctx.s.hist || []).filter(function (h) {
      if ((h.month || "") !== month) return false;
      return want ? (h.type || "platform") === want : true;
    })[0];
    return hit || null;
  }

  /* P1-7 口径折叠（data-act 委托，复用对账中心已验证链路）；空态与满态共用 */
  function bindScopeFold(el, Uni) {
    el.querySelectorAll("[data-act]").forEach(function (n) {
      if (n.getAttribute("data-act") !== "scopeFold") return;
      n.addEventListener("click", function () {
        Uni.sheet({
          title: n.getAttribute("data-title"),
          body: n.getAttribute("data-body"),
          footer: [{ t: "关闭", kind: "ghost" }]
        });
      });
    });
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var badge = V.badges.ledger ? '<span class="uh-badge uh-badge--gold">' + ui.esc(V.badges.ledger) + "</span>" : "";
    /* P0-1：主数字必须自带所属月份，避免「总盘 / 实得」口径切换后读者不知是哪个月 */
    var monthBadge = vm.bigMonth ? '<span class="uh-badge uh-badge--mute">' + ui.esc(vm.bigMonth) + "</span>" : "";

    /* 柱图 */
    var bars = vm.bars.map(function (b) {
      return '<div class="ulg-bar"><div class="ulg-col' + (b.cur ? " ulg-col--cur" : "") + '" style="height:' + b.pct + '%"></div>' +
        '<div class="ulg-col__v">' + ui.money(b.value) + "</div>" +
        '<div class="ulg-col__lb">' + ui.esc(b.label) + "</div></div>";
    }).join("");

    /* 表格（员工=本人获客用户消费明细；管理员/二级=月度台账）
       省代行来自月度账单记录，第四列给「对账状态」并整行可点开单据；
       二级行来自约定比例复算，第四列仍是「比例」。 */
    var isSub = ctx.mode === "sub";
    var headCells = vm.staff
      ? "<th>用户</th><th>渠道</th><th>消费金额</th><th>状态</th>"
      : (isSub
        ? "<th>月份</th><th>合格消费</th><th>总盘 50%</th><th>比例</th><th>经营所得</th>"
        : "<th>月份</th><th>合格消费</th><th>总盘 50%</th><th>对账状态</th><th>经营所得</th>");
    var rows = vm.rows.map(function (r) {
      if (vm.staff) {
        return "<tr><td>" + ui.esc(r.user) + "</td>" +
          "<td>" + ui.esc(r.channel) + "</td>" +
          "<td>" + ui.money(r.amount) + "</td>" +
          "<td>" + ui.esc(r.stageTxt) + "</td></tr>";
      }
      if (isSub) {
        return "<tr><td>" + ui.esc(r.month) + "</td>" +
          "<td>" + ui.money(r.eligible) + "</td>" +
          "<td>" + ui.money(r.gross) + "</td>" +
          "<td>" + ui.esc(r.ratio) + "</td>" +
          "<td>" + ui.money(r.income) + "</td></tr>";
      }
      var stCls = (window.UniDoc && window.UniDoc.HIST_CLS[r.state]) || "mute";
      return '<tr class="ulg-row" data-month="' + ui.esc(r.month) + '" tabindex="0" role="button" ' +
        'aria-label="查看 ' + ui.esc(r.month) + " 对账单\">" +
        "<td>" + ui.esc(r.month) + "</td>" +
        "<td>" + ui.money(r.eligible) + "</td>" +
        "<td>" + ui.money(r.gross) + "</td>" +
        '<td><span class="uh-badge uh-badge--' + stCls + '">' + ui.esc(r.stateTxt) + "</span></td>" +
        "<td>" + ui.money(r.income) + "</td></tr>";
    }).join("");

    var html = "";

    /* P2：趋势柱只给横向高低，读者无法判断「这个月算好还是差」；
       补一条可比基线（近 N 月均值 + 本月相对偏离） */
    var barNote = "";
    if (!vm.staff && vm.bars.length >= 2) {
      var bvals = vm.bars.map(function (b) { return b.value; });
      var bavg = Math.round(bvals.reduce(function (a, b) { return a + b; }, 0) / bvals.length);
      var curBar = vm.bars.filter(function (b) { return b.cur; })[0] || vm.bars[bvals.length - 1];
      var bpct = bavg > 0 ? Math.round((curBar.value - bavg) / bavg * 100) : 0;
      barNote = "近 " + bvals.length + " 月均值 " + ui.money(bavg) + " · " +
        curBar.label + " " + (bpct >= 0 ? "+" : "") + bpct + "%";
    }

    /* 只读口径说明：折叠为「一句话 + 查看口径说明」（P1-7 去墙化） */
    html += Uni.scopeCardFold(
      vm.staff
        ? "仅展示本人获客用户的消费记录，不涉及企业分佣台账。"
        : (ctx.mode === "sub" ? "经营台账为只读口径复算：总盘 50%、T+7 冻结。" : "经营台账为只读口径：两级分账、不执行提现。"),
      "经营台账口径说明",
      '<div class="uh-readnote" style="margin-bottom:12px">' + ui.esc(vm.notice) + "</div>" +
      (!vm.staff
        ? (vm.flowPath ? '<div class="uh-clause"><div class="no">分账路径</div><div class="c">' + ui.esc(vm.flowPath) + "</div></div>" : "") +
          '<div class="uh-clause"><div class="no">计入项</div>' +
          "<div class=\"c\">订单净额 · 积分解锁付费 · 增值服务付费</div></div>" +
          '<div class="uh-clause"><div class="no">排除项</div>' +
          "<div class=\"c\">充值 · 免费积分 · 报名费 · 退款冲回</div></div>" +
          '<div class="uh-clause"><div class="no">退款口径</div>' +
          "<div class=\"c\">冻结期内剔除、当月红字冲减、跨月等额回冲。</div></div>"
        : "")
    );

    /* 暂停封条 */
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + '</span></div></div></section>';
    }

    /* P2：完全无数据时给空态，不铺一屏 ¥0 卡片和空表格
       （员工看获客消费、管理员看月度账单，两者口径不同但空态语义一致） */
    var noData = vm.staff ? !vm.rows.length
      : (!vm.rows.length && !(ctx.s.hist || []).length);
    if (noData) {
      html += '<section class="uh-sec"><div class="card">' +
        Uni.emptyHtml(
          vm.staff ? "暂无获客消费记录" : "暂无经营台账",
          vm.staff
            ? "名下获客用户产生有效消费后，这里会按月汇总本人消费明细。"
            : "平台月度账单出账后自动生成台账；出账前无可复算的经营数据。",
          "ledger") + "</div></section>";
      el.innerHTML = html;
      Uni.bindScopeFold(el, Uni);
      bindScopeFold(el, Uni);
      return;
    }

    /* 批次九 L5：桌面「经营所得 + 月度趋势」两栏并列（移动端单列顺序不变） */
    html += '<div class="ulg-grid">';

    /* 经营所得卡 */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + ui.esc(vm.cardTitle) + "</span>" + monthBadge + badge + "</div>" +
      '<div class="uh-bignum" data-count="' + vm.big + '">' + ui.moneyD(0) + "</div>" +
      (vm.bigNote || "") +
      (vm.bigWarn ? '<div class="uh-note" style="color:var(--warning-ink)">' + vm.bigWarn + "</div>" : "") +
      '<div class="uh-ledgerline"></div>';
    vm.kvs.forEach(function (kv) {
      html += '<div class="uh-kv"><span class="k">' + ui.esc(kv.k) + "</span><span class=\"v\">" + kv.v + "</span></div>";
    });
    html += '<div class="uh-note">' + (vm.staff ? "仅展示本人获客用户的消费记录，不涉及企业分佣台账。" : "约定所得为只读台账口径，不构成可提现金额。") + '</div></section>';

    /* 月度趋势柱图（员工=本人渠道消费构成） */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + (vm.staff ? "我的获客消费构成" : "月度经营所得趋势") + '</span>' +
      '<span class="uh-badge uh-badge--mute">' + (vm.staff ? "按渠道" : "最近月高亮") + '</span></div>' +
      '<div class="ulg-bars">' + bars + "</div>" +
      (barNote ? '<div class="uh-note">' + ui.esc(barNote) + "</div>" : "") + "</section>" +
      '</div>';

    /* 月度台账表格 */
    var colSpan = vm.staff ? 4 : 5;
    html += '<section class="card uh-sec" style="padding:6px 16px 14px">' +
      '<div class="uh-finhead" style="margin:10px 0 4px"><span class="uh-eyebrow">月度台账</span>' +
      (!vm.staff && !isSub ? '<span class="uh-badge uh-badge--mute">点行查看单据</span>' : "") + "</div>" +
      '<table class="ulg-table"><thead><tr>' +
      headCells +
      "</tr></thead><tbody>" + (vm.rows.length ? rows : '<tr><td colspan="' + colSpan + '" style="text-align:center;color:var(--text-3);padding:16px 0;">暂无月度台账</td></tr>') + "</tbody></table>" +
      (vm.tableNote ? '<div class="uh-note">' + ui.esc(vm.tableNote) + "</div>" : "") + "</section>";

    /* P1-1 / P0-3 省代经营分析两卡（员工仅本人获客视图，不展示企业分佣视角） */
    if (!vm.staff && vm.srcSplit) {
      /* ---- P1-1 按来源拆分经营分析（直营线 / 各二级线逐家） ---- */
      var s1 = [];
      s1.push('<div class="uh-kv"><span class="k">' + ui.esc(vm.srcSplit.self.label) + '</span>' +
        '<span class="v">合格消费 ' + ui.money(vm.srcSplit.self.settledGross) + ' · 收益（×50% 全额）' + ui.money(vm.srcSplit.self.amount) + '</span></div>');
      vm.srcSplit.subs.forEach(function (p) {
        s1.push('<div class="uh-kv"><span class="k">二级线 · ' + ui.esc(p.name) + '</span>' +
          '<span class="v">消费 ' + ui.money(p.settled) + ' · 比例 ' + Math.round(p.ratio * 100) + '% · 约定 ' + ui.money(p.agreed) + '</span></div>');
      });
      s1.push('<div class="uh-kv"><span class="k">二级线合计</span>' +
        '<span class="v">盘 ' + ui.money(vm.srcSplit.subPool) + ' · 约定 ' + ui.money(vm.srcSplit.subAgreed) + ' · 自留 ' + ui.money(vm.srcSplit.subRetained) + '</span></div>');
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">按来源拆分经营分析</span>' +
        '<span class="uh-badge uh-badge--mute">两分区独立</span></div>' +
        '<div class="uh-ledgerline"></div>' + s1.join("") + '</section>';

      /* ---- P0-3 收益全景（可提现置顶 + 只读分账 + 脚注） ---- */
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">收益全景</span>' +
        '<span class="uh-badge uh-badge--mute">属性标注</span></div>' +
        vm.panorama.map(function (p) {
          return '<div class="uh-clause"><div class="no">' + ui.esc(p.name) +
            ' <span class="uh-badge uh-badge--' + p.cls + '" style="margin-left:6px">' + ui.esc(p.attr) + '</span></div>' +
            '<div class="c">' + ui.esc(p.value) + (p.sub ? '<span class="ulg-pano__sub">' + ui.esc(p.sub) + '</span>' : '') + '</div></div>';
        }).join("") +
        (vm.panoNote ? '<div class="uh-note">' + ui.esc(vm.panoNote) + '</div>' : '') + '</section>';
    }

    el.innerHTML = html;
    Uni.bindScopeFold(el, Uni);
    bindScopeFold(el, Uni);
    /* 批次九 L8：经营所得主数字 count-up（420ms ease-out；reduced-motion 直跳） */
    var cnum = el.querySelector("[data-count]");
    if (cnum) Uni.countUp(cnum, parseFloat(cnum.getAttribute("data-count")), 420, ui.moneyD);
    /* P1-3：月度台账行 → 对账单单据（模板与下载走 uni-doc.js，三个入口同一张单） */
    el.querySelectorAll("[data-month]").forEach(function (n) {
      function open() {
        var h = histOf(ctx, n.getAttribute("data-month"));
        if (!window.UniDoc) { Uni.toast("对账文件模块未加载，请刷新后重试", "err"); return; }
        if (!h) { Uni.toast("该账期对账单缺失", "err"); return; }
        window.UniDoc.openSheet(ctx, h, Uni, {
          more: { t: "去对账中心", on: function () { Uni.navTo("reconcile.html"); } }
        });
      }
      n.addEventListener("click", open);
      n.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); open(); }
      });
    });
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
