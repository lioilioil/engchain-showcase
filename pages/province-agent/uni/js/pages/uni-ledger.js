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
    ["direct", "agent"].forEach(function (ch) {
      (s.leads[ch] || []).forEach(function (l) {
        if (l.owner !== my) return;
        users++;
        if (l.stage === "paid" || l.stage === "repaid") {
          paidAmt += l.amount || 0;
          mine.push({ user: l.name || "用户", channel: (ch === "direct" ? "直接合作" : "招商渠道"), amount: l.amount || 0, stageTxt: "已消费" });
        }
      });
    });
    var codes = [];
    ["direct", "agent"].forEach(function (ch) {
      (s.channels[ch] || []).forEach(function (c) {
        if (c.ownerName === my && c.status === "active" && codes.indexOf(c.code) < 0) codes.push(c.code);
      });
    });
    var byChannel = { "直接合作": 0, "招商渠道": 0 };
    mine.forEach(function (r) { byChannel[r.channel] += r.amount; });
    var max = Math.max(byChannel["直接合作"], byChannel["招商渠道"]);
    var bars = ["直接合作", "招商渠道"].map(function (lb, i) {
      return { label: lb, value: byChannel[lb], cur: i === 0,
               pct: max > 0 ? Math.max(Math.round(byChannel[lb] / max * 100), 16) : 16 };
    });
    return {
      notice: "员工视角：仅展示本人渠道码带来的用户及其消费记录；不展示企业分佣台账。",
      cardTitle: "我的获客消费",
      big: paidAmt,
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
      kvs: [],
      bars: [],
      rows: []
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
      vm.kvs = [
        { k: "合格消费", v: ui.money(cur.eligible) },
        { k: "总盘（合格消费 ×50%）", v: ui.money(cur.gross) },
        { k: "约定所得比例", v: cur.ratio },
        { k: "T+7 在途冻结", v: ui.money(curSt.frozen) }
      ];
    } else {
      /* 省代口径：T3 统一两分区（二级线 50% 盘 + 自营线 50% 全额） */
      var fin = window.Uni.financeSplit(ctx.s);
      var prevSum = store.regsSum(ctx.s.payRegs1 || [], "c0-l1"); /* 上月 L1 已确认 = 上月已平账口径 */
      var curIncome = fin.sub.retained + fin.self.amount;          /* 本月省代实得 = 二级线自留 + 自营线全额 */
      vm.rows = [
        { month: "2026-09", eligible: Math.round(prevSum / 0.5), gross: prevSum, ratio: "—", income: Math.round(prevSum * 0.5) },
        { month: "2026-10", eligible: fin.gross, gross: fin.total, ratio: "—", income: curIncome }
      ];
      vm.bars = [
        { label: "2026-09", value: Math.round(prevSum * 0.5), cur: false },
        { label: "2026-10", value: curIncome, cur: true }
      ];
      vm.big = fin.total;
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
      vm.panorama = [
        { name: "代理 · 二级线所得", value: ui.money(fin.sub.retained) + "（自留）", attr: "只读分账 · 不可提现", cls: "mute" },
        { name: "代理 · 自营线收益", value: ui.money(fin.self.amount) + "（全额）", attr: "只读分账 · 独立分区", cls: "mute" },
        { name: "代理 · 招商预估", value: activeSubs2.length + " 家二级在约", attr: "按约定比例逐家配置 · 待确认金额不展示", cls: "mute" },
        { name: "个人合伙人 · 返佣", value: ui.money(rebate) + "（" + rebateCount + " 笔）", attr: "可提现 · 用户端钱包", cls: "ok" },
        { name: "旧返佣 · 留痕", value: ui.money(legacySelf) + "（" + legacyCount + " 笔）", attr: "只读留痕 · 不计收益", cls: "mute" }
      ];
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
          cardTitle: "本月经营总盘",
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

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var badge = V.badges.ledger ? '<span class="uh-badge uh-badge--gold">' + ui.esc(V.badges.ledger) + "</span>" : "";

    /* 柱图 */
    var bars = vm.bars.map(function (b) {
      return '<div class="ulg-bar"><div class="ulg-col' + (b.cur ? " ulg-col--cur" : "") + '" style="height:' + b.pct + '%"></div>' +
        '<div class="ulg-col__v">' + ui.money(b.value) + "</div>" +
        '<div class="ulg-col__lb">' + ui.esc(b.label) + "</div></div>";
    }).join("");

    /* 表格（员工=本人获客用户消费明细；管理员/二级=月度台账） */
    var headCells = vm.staff
      ? "<th>用户</th><th>渠道</th><th>消费金额</th><th>状态</th>"
      : "<th>月份</th><th>合格消费</th><th>总盘 50%</th><th>比例</th><th>经营所得</th>";
    var rows = vm.rows.map(function (r) {
      if (vm.staff) {
        return "<tr><td>" + ui.esc(r.user) + "</td>" +
          "<td>" + ui.esc(r.channel) + "</td>" +
          "<td>" + ui.money(r.amount) + "</td>" +
          "<td>" + ui.esc(r.stageTxt) + "</td></tr>";
      }
      return "<tr><td>" + ui.esc(r.month) + "</td>" +
        "<td>" + ui.money(r.eligible) + "</td>" +
        "<td>" + ui.money(r.gross) + "</td>" +
        "<td>" + ui.esc(r.ratio) + "</td>" +
        "<td>" + ui.money(r.income) + "</td></tr>";
    }).join("");

    var html = "";

    /* 只读口径说明条 */
    html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) + "<span>" + ui.esc(vm.notice) + "</span></div></section>";

    /* 暂停封条 */
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + '</span></div></div></section>';
    }

    /* 经营所得卡 */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + ui.esc(vm.cardTitle) + "</span>" + badge + "</div>" +
      '<div class="uh-bignum">' + ui.moneyD(vm.big) + "</div>" +
      '<div class="uh-ledgerline"></div>';
    vm.kvs.forEach(function (kv) {
      html += '<div class="uh-kv"><span class="k">' + ui.esc(kv.k) + "</span><span class=\"v\">" + kv.v + "</span></div>";
    });
    html += '<div class="uh-note">' + (vm.staff ? "仅展示本人获客用户的消费记录，不涉及企业分佣台账。" : "约定所得为只读台账口径，不构成可提现金额。") + '</div></section>';

    /* 月度趋势柱图（员工=本人渠道消费构成） */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + (vm.staff ? "我的获客消费构成" : "月度经营所得趋势") + '</span>' +
      '<span class="uh-badge uh-badge--mute">' + (vm.staff ? "按渠道" : "最近月高亮") + '</span></div>' +
      '<div class="ulg-bars">' + bars + "</div></section>";

    /* 月度台账表格 */
    html += '<section class="card uh-sec" style="padding:6px 16px 14px">' +
      '<div class="uh-finhead" style="margin:10px 0 4px"><span class="uh-eyebrow">月度台账</span></div>' +
      '<table class="ulg-table"><thead><tr>' +
      headCells +
      "</tr></thead><tbody>" + rows + "</tbody></table></section>";

    /* P1-1/P1-2/P1-4 省代经营分析三卡（员工仅本人获客视图，不展示企业分佣视角） */
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

      /* ---- P1-2 资金流分配链路（静态示意，复用系统视觉变量） ---- */
      var pool = vm.srcSplit.subPool, agreed = vm.srcSplit.subAgreed, retained = vm.srcSplit.subRetained, selfAmt = vm.srcSplit.self.amount;
      var flowLine = function (row) {
        return '<div class="ulg-flow__row"><span class="ulg-flow__seg">' + row + '</span></div>';
      };
      var arrow = '<span class="ulg-flow__arr">→</span>';
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">资金流分配链路</span>' +
        '<span class="uh-badge uh-badge--mute">两分区独立标注</span></div>' +
        '<div class="ulg-flow">' +
        '<div class="ulg-flow__node">平台 · 全省合格消费</div>' + arrow +
        '<div class="ulg-flow__node">省代分账盘（×50%）</div>' +
        '<div class="ulg-flow__br">' +
        '<div class="ulg-flow__branch">' +
        flowLine('<b>自营线</b> 直营获客消费 ×50% → <b>' + ui.money(selfAmt) + '</b> 全额归省代（独立分区）') +
        '</div>' +
        '<div class="ulg-flow__branch">' +
        flowLine('<b>二级线盘</b> 二级获客消费 ×50% → ' + ui.money(pool) + '：' +
          '逐家约定（' + vm.srcSplit.subs.map(function (p) { return ui.esc(p.name) + " " + Math.round(p.ratio * 100) + "%=" + ui.money(p.agreed); }).join(" · ") + '）' +
          ' · 自留 ' + ui.money(retained) + ' 归省代') +
        '</div>' +
        '</div>' +
        '</div></section>';

      /* ---- P1-4 收益全景（五条线 + 属性标注：只读分账 / 可提现 / 留痕） ---- */
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">收益全景</span>' +
        '<span class="uh-badge uh-badge--mute">五条线 · 属性标注</span></div>' +
        vm.panorama.map(function (p) {
          return '<div class="uh-clause"><div class="no">' + ui.esc(p.name) +
            ' <span class="uh-badge uh-badge--' + p.cls + '" style="margin-left:6px">' + ui.esc(p.attr) + '</span></div>' +
            '<div class="c">' + ui.esc(p.value) + '</div></div>';
        }).join("") + '</section>';
    }

    /* 计入/排除口径说明卡（员工不涉及分佣口径，隐藏） */
    if (!vm.staff) {
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">计入 / 排除口径</span></div>' +
        '<div class="uh-clause" style="margin-top:10px"><div class="no">计入项</div>' +
        "<div class=\"c\">订单净额 · 积分解锁付费 · 增值服务付费</div></div>" +
        '<div class="uh-clause"><div class="no">排除项</div>' +
        "<div class=\"c\">充值 · 免费积分 · 报名费 · 退款冲回</div></div>" +
        '<div class="uh-clause" style="margin-bottom:0"><div class="no">退款口径</div>' +
        "<div class=\"c\">冻结期内剔除、当月红字冲减、跨月等额回冲。</div></div></section>";
    }

    el.innerHTML = html;
  }

  window.Uni.register({
    view: "uni-ledger",
    route: "ledger.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
