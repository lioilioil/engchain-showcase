/* ============================================================
   uni-invite-stats.js · 获客转化（获客域 3 页之三）
   模板节奏（三身份同构，数据驱动填充）：
     暂停封条/权限说明条 → 转化漏斗卡 → 焦点金额卡 → 分佣口径说明卡
   组件视觉全部为系统类（.card/.uh-finhead/.uh-bignum/.uh-kv/.uh-clause）；
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  /* ---------- P2-1 渠道码统计联动：注册 → 入驻 → 消费 → 线别归属 ----------
     线别判定按渠道码 ownerType：省代侧（CH-P 招商 / CH-E 员工）→ 自营线；
     二级侧（CH-S）→ 二级线。演示数据按 owner 名对线索归因。 */
  function lineStatsOf(s) {
    var out = { self: [], sub: [] };
    ["direct", "agent"].forEach(function (ch) {
      (s.channels[ch] || []).forEach(function (c) {
        if (c.status !== "active") return;
        var leads = (s.leads[ch] || []).filter(function (l) { return l.owner === c.ownerName; });
        var paid = leads.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; });
        var row = {
          code: c.code, owner: c.ownerName,
          reg: leads.length,
          onb: leads.filter(function (l) { return ["onboarded", "paid", "repaid"].indexOf(l.stage) >= 0; }).length,
          paid: paid.length,
          amount: paid.reduce(function (s2, l) { return s2 + (l.amount || 0); }, 0)
        };
        (c.ownerType === "sub" ? out.sub : out.self).push(row);
      });
    });
    return out;
  }
  function lineRowHtml(r, line) {
    var pct = r.reg ? Math.max(Math.round(r.paid / r.reg * 100), 6) : 6;
    return '<div class="uc-fnl__row">' +
      '<div class="uc-line__top"><span class="uc-line__label"><span class="uc-line__code">' + ui.esc(r.code) + '</span><span class="uc-line__owner"> · ' + ui.esc(r.owner) + '</span></span>' +
      '<span class="uh-badge uh-badge--mute">' + ui.esc(line) + '</span></div>' +
      '<div class="uc-line__stats">' + r.reg + " 注册 · " + r.onb + " 入驻 · " + r.paid + " 消费 · <b>" + ui.money(r.amount) + "</b></div>" +
      '<div class="uc-fnl__track"><div class="uc-fnl__bar" style="width:' + pct + '%"></div></div>' +
      "</div>";
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var f = store.funnelOf(ctx.s.leads || {});
        return {
          funnel: f,
          lineStats: lineStatsOf(ctx.s),
          funnelLabels: ["注册用户", "完成入驻", "产生合格消费", "沉寂流失"],
          focus: { eyebrow: "已转化合格消费合计", big: f.paidAmount, rows: [], note: "" },
          clauses: [
            { no: "分佣比例", c: "约定比例在二级合作中逐家配置（0–50%），本页不展示可提现金额。" },
            { no: "钱包与提现", c: "本端没有钱包、没有自动提现；线下付款凭凭证登记留痕。" }
          ],
          consume: store.consumeOf(store.getState(), { scope: "all" }),
          consumeLabels: {
            scopeNote: "省代全团队 · 成员邀请注册用户的平台消费（脱敏展示）",
            byMember: "按来源成员（注册 → 消费 → 合格金额）",
            byChannel: "按渠道方式（注册 → 消费 → 合格金额）",
            byType: "消费事项分布"
          },
          showMember: true,
          note: "",
          lockedTitle: "合作权限已暂停"
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "转化数据仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s, my = ctx.staffName;
        var mine = { direct: [], agent: [] };
        ["direct", "agent"].forEach(function (ch) {
          (s.leads[ch] || []).forEach(function (l) { if (l.owner === my) mine[ch].push(l); });
        });
        var f = store.funnelOf(mine);
        return {
          funnel: f,
          funnelLabels: ["注册用户", "完成入驻", "产生合格消费", "沉寂流失"],
          focus: { eyebrow: "本人已转化合格消费合计", big: f.paidAmount, rows: [], note: "" },
          clauses: [
            { no: "数据口径", c: "本页仅统计你本人渠道码带来的注册与转化数据。" },
            { no: "钱包与提现", c: "本端没有钱包、没有自动提现；分佣结算仅管理员可见。" }
          ],
          consume: store.consumeOf(store.getState(), { scope: "mine", myName: ctx.staffName }),
          consumeLabels: {
            scopeNote: "仅本人渠道码（CH-E）获客数据 · 不含团队统计",
            byChannel: "本人按渠道方式（注册 → 消费 → 合格金额）",
            byType: "本人消费事项分布"
          },
          showMember: false,
          note: "员工权限：仅查看本人渠道码的获客转化数据。",
          lockedTitle: "合作权限已暂停"
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "转化数据仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var f = store.funnelOf(ctx.s.leads || {});
        var cur = (ctx.s.calc && ctx.s.calc[0]) || {};
        var st = store.subSettle(cur);
        return {
          funnel: f,
          lineStats: lineStatsOf(ctx.s),
          funnelLabels: ["直接邀请", "完成入驻", "产生合格消费", "沉寂流失"],
          focus: {
            eyebrow: "本月本人经营所得",
            big: st.agreed,
            rows: [
              { k: "合格消费", v: ui.money(st.eligible) },
              { k: "总盘（合格消费×50%）", v: ui.money(st.gross) },
              { k: "约定所得比例", v: Math.round(st.ratioToSub * 100) + "%" }
            ],
            note: "不构成可提现金额"
          },
          clauses: [
            { no: "钱包与提现", c: "本端没有钱包、没有提现；约定所得由省代按平台月度对账数据线下支付。" },
            { no: "绑定归属", c: "用户再邀请不归属、不计佣、不传递（两级封顶）。" }
          ],
          consume: store.consumeOf(store.getState(), { scope: "sub" }),
          consumeLabels: {
            scopeNote: "本企业渠道码（CH-S）邀请用户的平台消费（脱敏展示）",
            byMember: "按归属人（注册 → 消费 → 合格金额）",
            byChannel: "按渠道方式（注册 → 消费 → 合格金额）",
            byType: "消费事项分布"
          },
          showMember: true,
          note: "",
          lockedTitle: "合作已暂停"
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "经营数据仅可查看"
    }
  };

  /* ---------- 暂停封条标题（数据级：二级「合作已暂停」/省代「合作权限已暂停」） ---------- */
  function lockedTitleOf(V) { return V.lockedTitle || "合作已暂停"; }

  /* ---------- 漏斗行（同一渲染器） ---------- */
  function funnelRowsHtml(vm) {
    var f = vm.funnel;
    var total = Math.max(f.registered, 1);
    var steps = [
      { label: vm.funnelLabels[0], v: f.registered, pct: 100, cls: "" },
      { label: vm.funnelLabels[1], v: f.onboarded, pct: f.onboarded / total * 100, cls: "" },
      { label: vm.funnelLabels[2], v: f.paid, pct: f.paid / total * 100, cls: "" },
      { label: vm.funnelLabels[3], v: f.lost, pct: f.lost / total * 100, cls: " is-lost" }
    ];
    return '<div class="uc-fnl">' + steps.map(function (s) {
      return '<div class="uc-fnl__row">' +
        '<div class="uc-fnl__hd"><span class="uc-fnl__label">' + ui.esc(s.label) + "</span>" +
        '<span class="uc-fnl__num"><span class="uc-fnl__cnt">' + s.v + ' 人</span><span class="uc-fnl__pct">' + Math.round(s.pct) + '%</span></span></div>' +
        '<div class="uc-fnl__track"><div class="uc-fnl__bar' + s.cls + '" style="width:' + Math.round(s.pct) + '%"></div></div>' +
        "</div>";
    }).join("") + "</div>";
  }

  /* ---------- 消费记录域（获客转化 · 逐笔消费记录 + 运营统计） ---------- */
  var CHANNEL_LABEL = { direct: "直接合作（CH-P/CH-E）", agent: "招商渠道（AG-）", school: "本企业码（CH-S）" };
  function channelLabelOf(ch) { return CHANNEL_LABEL[ch] || ch || "—"; }

  /* 记录行：脱敏展示（姓名姓* / 电话前3后4 / 企业首字**），事项按主体系口径标合格 */
  function consumeRowHtml(r, Uni) {
    var ct = Uni.consumeTypeOf(r.type);
    var tag = ct.eligible
      ? '<span class="uc-cons__tag is-ok">计入合格</span>'
      : '<span class="uc-cons__tag">不计合格</span>';
    var who = Uni.maskName(r.name) + " · " + Uni.maskPhone(r.phone) +
      (r.company ? " · " + Uni.maskCompany(r.company) : "");
    return '<div class="uc-cons__row">' +
      '<span class="uc-cons__amt">' + ui.money(r.amount) + "</span>" +
      '<div class="uc-cons__body">' +
      '<div class="uc-cons__top"><span class="uc-cons__item"><span class="uc-cons__nm">' + ui.esc(ct.label) + "</span>" + tag + '</span></div>' +
      '<div class="uc-cons__sub">' + ui.esc(r.date) + " · " + ui.esc(who) + "</div>" +
      '<div class="uc-cons__src">来源 ' + ui.esc(r.member || "—") + " · " + ui.esc(channelLabelOf(r.channel)) + "</div>" +
      "</div></div>";
  }

  function consumeCardHtml(vm, Uni) {
    var recs = vm.consume.records;
    if (!recs.length) {
      return '<section class="card uh-sec"><div class="uh-finhead"><span class="uh-eyebrow">消费记录</span>' +
        '<span class="uh-badge uh-badge--mute">' + ui.esc(vm.consumeLabels.scopeNote) + '</span></div>' +
        Uni.emptyHtml("暂无消费记录", "邀请用户产生平台消费后将出现在这里", "receipt") + "</section>";
    }
    return '<section class="card uh-sec"><div class="uh-finhead"><span class="uh-eyebrow">消费记录</span>' +
      '<span class="uh-badge uh-badge--mute">' + ui.esc(vm.consumeLabels.scopeNote) + '</span></div>' +
      '<div class="uc-cons">' + recs.map(function (r) { return consumeRowHtml(r, Uni); }).join("") + "</div>" +
      "</section>";
  }

  /* 运营数据统计：按来源成员 / 按渠道方式 / 消费事项分布 */
  function statsHtml(vm, Uni) {
    var html = "";
    if (vm.showMember && vm.consume.byMember.length) {
      html += '<div class="uh-sechead"><span class="lbl">' + ui.esc(vm.consumeLabels.byMember) + "</span></div>" +
        vm.consume.byMember.map(function (m) {
          return '<div class="uh-kv"><span class="k">' + ui.esc(m.member) +
            '</span><span class="v uv"><b>' + m.reg + '</b> 注册 · <b>' + m.paid + '</b> 消费 · <b class="uv-amt">' + ui.money(m.amount) + "</b></span></div>";
        }).join("");
    }
    if (vm.consume.byChannel.length) {
      html += '<div class="uh-sechead"><span class="lbl">' + ui.esc(vm.consumeLabels.byChannel) + "</span></div>" +
        vm.consume.byChannel.map(function (c) {
          return '<div class="uh-kv"><span class="k">' + ui.esc(channelLabelOf(c.channel)) +
            '</span><span class="v uv"><b>' + c.reg + '</b> 注册 · <b>' + c.paid + '</b> 消费 · <b class="uv-amt">' + ui.money(c.paidAmount) + "</b></span></div>";
        }).join("");
    }
    if (vm.consume.byType.length) {
      var max = 1;
      vm.consume.byType.forEach(function (t) { if (t.amount > max) max = t.amount; });
      html += '<div class="uh-sechead"><span class="lbl">' + ui.esc(vm.consumeLabels.byType) + "</span></div>" +
        '<div class="uc-fnl">' + vm.consume.byType.map(function (t) {
          var ct = Uni.consumeTypeOf(t.type);
          return '<div class="uc-fnl__row"><div class="uc-fnl__hd">' +
            '<span class="uc-fnl__label">' + ui.esc(ct.label) + (ct.eligible ? "" : ' <span class="uc-cons__tag">不计合格</span>') + "</span>" +
            '<span class="uc-fnl__num uv"><b>' + t.count + '</b> 笔 · <b class="uv-amt">' + ui.money(t.amount) + "</b></span></div>" +
            '<div class="uc-fnl__track"><div class="uc-fnl__bar' + (ct.eligible ? "" : " uc-bar--mute") + '" style="width:' +
            Math.max(Math.round(t.amount / max * 100), 6) + '%"></div></div></div>';
        }).join("") + "</div>";
    }
    if (!html) return "";
    return '<section class="card uh-sec"><div class="uh-finhead"><span class="uh-eyebrow">运营数据统计</span>' +
      '<span class="uh-badge uh-badge--mute">成员/渠道金额为合格消费（分佣口径）；事项分布含全部事项，企业入驻不计合格</span></div>' + html + "</section>";
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var fc = vm.focus;

    var rows = fc.rows.map(function (r) {
      return '<div class="uh-kv"><span class="k">' + ui.esc(r.k) + '</span><span class="v">' + r.v + "</span></div>";
    }).join("");

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(lockedTitleOf(V)) + "（仅可查看）</span>" +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
    }
    if (vm.note) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + "<span>" + ui.esc(vm.note) + "</span></div></section>";
    }
    /* 段1 消费记录（团队/本人范围；脱敏展示 + 来源 + 渠道方式） */
    html += consumeCardHtml(vm, Uni);
    /* 段2 漏斗卡 */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">获客转化漏斗</span></div>' +
      funnelRowsHtml(vm) + "</section>";
    /* P2-1 渠道码线别归属（注册 → 入驻 → 消费 → 线别；员工为本人视角已由台账覆盖） */
    if (vm.lineStats && (vm.lineStats.self.length || vm.lineStats.sub.length)) {
      var lr = [];
      vm.lineStats.self.forEach(function (r) { lr.push(lineRowHtml(r, "自营线")); });
      vm.lineStats.sub.forEach(function (r) { lr.push(lineRowHtml(r, "二级线")); });
      html += '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">渠道码线别归属</span>' +
        '<span class="uh-badge uh-badge--mute">注册 → 入驻 → 消费 → 线别</span></div>' +
        '<div class="uc-fnl">' + lr.join("") + "</div>" +
        '<div class="uh-note">线别判定：省代侧渠道码（招商/员工）→ 自营线；二级渠道码 → 二级线。演示口径，与主体系渠道归属字段同源。</div>' +
        "</section>";
    }
    /* 段2 焦点金额卡 */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">' + ui.esc(fc.eyebrow) + "</span></div>" +
      '<div class="uh-bignum">' + ui.moneyD(fc.big) + "</div>" +
      (rows ? '<div class="uh-ledgerline"></div>' + rows : "") +
      (fc.note ? '<div class="uh-note">' + ui.esc(fc.note) + "</div>" : "") +
      "</section>";
    /* 段5 运营数据统计（成员/渠道/事项） */
    html += statsHtml(vm, Uni);
    /* 段6 分佣口径说明卡 */
    html += '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">分佣口径说明</span></div>' +
      vm.clauses.map(function (c) {
        return '<div class="uh-clause"><div class="no">' + ui.esc(c.no) + "</div><div class=\"c\">" + ui.esc(c.c) + "</div></div>";
      }).join("") +
      "</section>";

    el.innerHTML = html;
  }

  window.Uni.register({
    view: "uni-invite-stats",
    route: "invite-stats.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
