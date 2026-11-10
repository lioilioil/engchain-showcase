/* ============================================================
   uni-home.js · 工作台（独立页种子 1 · 全组视觉模式基线）
   模板节奏（三身份同构，数据驱动填充）：
     暂停封条 → 身份条 → 财务卡 → 待办列表 → 合作档案块 → 宫格 → 动态流
   组件视觉全部为系统类（.card/.btn/.seg/.app-section-head/.empty-state/
   .app-tabbar…）；页面级排版类（uh-）定义在 css/pages/uni-home.css。
   弹窗/Toast 一律经 Uni.sheet / Uni.center / Uni.toast（系统视觉）。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  /* 账号状态词（定稿词表）：省代 active=已开通，二级 approved=已绑定；其余状态两域共用。
     统一走这里，避免页面里再写死「生效中」这类与预览/我的不一致的说法。 */
  function acctTxt(ctx, st) {
    var sub = ctx && ctx.mode === "sub";
    var d = sub ? (ui.ACCT_SUB || ui.ACCT) : ui.ACCT;
    return (d && d[st]) || (sub ? "已绑定" : "已开通");
  }

  /* 员工视角动态脱敏：付款/对账类通知带企业级金额，不对员工下发。
     员工只保留协议、合作进展这类非财务通知。 */
  function feedForStaff(state) {
    return store.activitiesOf(state).filter(function (m) {
      return m.tag !== "付款" && m.tag !== "对账";
    });
  }

  /* 宫格条目共享元数据（条目渲染器唯一，三身份复用） */
  var ENTRY_META = {
    "invite-code.html":    { icon: "qr",      label: "经营与渠道" },
    "invite-records.html": { icon: "user",    label: "获客记录" },
    "invite-stats.html":   { icon: "chart",   label: "获客转化" },
    "reconcile.html":      { icon: "receipt", label: "对账中心" },
    "ledger.html":         { icon: "history", label: "经营台账" },
    "subs.html":           { icon: "building", label: "二级合作" },
    "team.html":           { icon: "users",   label: "团队管理" },
    "agreement.html":      { icon: "file",    label: "合作协议" },
    "reconcile-hub-sub.html": { icon: "receipt", label: "对账中心" }
  };

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var state = store.getState(), s = ctx.s;
        var fin = window.Uni.financeSplit(s);          // T3 统一口径：二级线 50% 盘 + 自营线 50% 全额
        var funnel = store.funnelOf(s.leads || {});
        var activeSubs = (s.subs || []).filter(function (x) { return x.status === "active"; });
        var total = fin.total, agreedAll = fin.sub.agreed, retained = fin.sub.retained, selfAmt = fin.self.amount;
        return {
          company: s.profile.name,
          roleLine: "省级总代 · 编号 " + s.profile.authNo,
          badge: acctTxt(ctx, s.profile.status),
          badgeCls: "ok",
          metaL: "授权编号 " + s.profile.authNo,
          metaR: "合作自 " + s.profile.since,
          finTitle: "本月经营总盘",
          fin: {
            variant: "boss",
            mark: "ENGCHAIN · 省代总盘",
            seg: ["总盘", "自留"],
            views: [
              { hero: ui.moneyD(total), tag: "总盘收入",
                sub: "二级线盘 " + ui.money(fin.sub.pool) + " + 自营线全额 " + ui.money(selfAmt) + " · 给二级 " + ui.money(agreedAll) },
              { hero: ui.moneyD(retained), tag: "二级线自留",
                sub: "自营线全额 " + ui.money(selfAmt) + "（独立分区，不与自留相加）" }
            ],
            metrics: [
              { k: "平台合格消费", v: ui.money(fin.gross) },
              { k: "二级线盘（×50%）", v: ui.money(fin.sub.pool) },
              { k: "自营线收益（×50%）", v: ui.money(selfAmt) },
              { k: "本月付费（省代渠道）", v: funnel.paid + " 人" }
            ]
          },
          todo: store.todoOf(state),
          feed: store.activitiesOf(state),
          /* 合作档案已收敛：入口统一由「常用功能 → 二级合作」承担（原合作档案块删除） */
          partner: null,
          emptyState: !fin || (fin.gross === 0 && !s.subs.length && !s.subApps.length),
          permNote: ""
        };
      },
      /* P0-4：对账单改为「对账中心 → 明细 → 单据」二级承载。
         2026-11-01：协议中心补入口，紧邻「二级合作」——协议是按二级企业发的，
         两者必须能互相跳转（二级合作档案 → 该企业协议，协议 → 该企业对账单）。 */
      entries: ["invite-code.html", "invite-records.html", "invite-stats.html", "reconcile.html",
        "ledger.html", "subs.html", "agreement.html", "team.html"],
      perms: { invite: true, createSub: true },
      badges: {},
      empty: { feed: { title: "暂无动态", desc: "合作申请、对账与付款进展将出现在这里" } },
      lockedNote: "数据、审批、发码与对账登记均已锁定"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var state = store.getState(), s = ctx.s, my = ctx.staffName;
        var myLeads = [];
        ["direct"].forEach(function (ch) {
          (s.leads[ch] || []).forEach(function (l) { if (l.owner === my) myLeads.push(l); });
        });
        var users = 0, myCode = "尚未生成";
        ["direct"].forEach(function (ch) {
          (s.channels[ch] || []).forEach(function (c) {
            if (c.ownerName === my && c.status === "active") { users += c.users || 0; if (myCode === "尚未生成") myCode = c.code; }
          });
        });
        var paid = myLeads.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; });
        var amount = paid.reduce(function (sum, l) { return sum + (l.amount || 0); }, 0);
        var activeSubs = s.subs.filter(function (x) { return x.status === "active"; });
        var pRows = activeSubs.slice(0, 2).map(function (p) {
          return { id: p.id, icon: "building", t: p.name, s: "合作自 " + p.since,
                   amt: Math.round(p.ratioToSub * 100) + "%", badge: "生效中", badgeCls: "ok", act: "sub-open" };
        });
        return {
          company: s.profile.name,
          roleLine: "员工 · " + my + "（渠道专员）",
          badge: acctTxt(ctx, s.profile.status),
          badgeCls: "ok",
          metaL: "授权编号 " + s.profile.authNo,
          metaR: "合作自 " + s.profile.since,
          finTitle: "我的获客概览",
          fin: {
            variant: "staff",
            mark: "ENGCHAIN · 员工渠道",
            seg: [],
            views: [{ hero: ui.moneyD(amount), tag: "已消费金额（本人渠道）", sub: "名下渠道 · 本月累计" }],
            metrics: [
              { k: "名下已注册用户", v: users + " 人" },
              { k: "已跟进线索", v: myLeads.length + " 条" },
              { k: "已消费用户", v: paid.length + " 人" },
              { k: "我的渠道码", v: myCode }
            ]
          },
          todo: store.todoOf(state),
          feed: feedForStaff(state),
          partner: { layout: "list", eyebrow: "合作档案", more: { text: "全部合作", go: "subs.html" }, rows: pRows },
          emptyState: false,
          permNote: "员工权限：仅可管理本人渠道码与本人线索；登记付款、合作审批、比例配置、协议与月度平账仅管理员可操作。"
        };
      },
      entries: ["invite-code.html", "invite-records.html", "invite-stats.html", "team.html"],
      perms: { invite: true, createSub: false },
      badges: { fin: "员工 · 仅本人渠道" },
      empty: { feed: { title: "暂无动态", desc: "完成本人渠道推广后，动态将出现在这里" } },
      lockedNote: "经营动作均已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var state = store.getState(), s = ctx.s;
        var cur = (s.calc && s.calc[0]) || null;
        var st = store.subSettle(cur);
        var funnel = store.funnelOf(s.leads || {});
        return {
          company: s.profile.name,
          roleLine: "上级总代 · " + (s.parent ? s.parent.name.replace(/（.*）/, "") : "—"),
          badge: acctTxt(ctx, s.profile.status),
          badgeCls: "ok",
          metaL: "约定比例 " + Math.round((s.parent ? s.parent.ratioToSub : 0) * 100) + "%",
          metaR: "合作自 " + (s.parent ? s.parent.since : s.profile.since),
          finance: st, finTitle: "本月经营所得",
          fin: {
            variant: "sub",
            mark: "SECONDARY · 二级所得",
            seg: [],
            views: [{ hero: ui.moneyD(st.agreed), tag: "约定所得", sub: "约定比例 " + Math.round(st.ratioToSub * 100) + "% · 在途冻结 " + ui.money(st.frozen) }],
            metrics: [
              { k: "名下合格消费", v: ui.money(st.eligible) },
              { k: "总盘（合格消费×50%）", v: ui.money(st.gross) },
              { k: "本月付费（本企渠道）", v: funnel.paid + " 人" },
              { k: "已注册用户", v: funnel.registered + " 人" }
            ]
          },
          seg: [],
          todo: store.todoOf(state),
          feed: store.activitiesOf(state),
          /* 合作协议档案块已下线：协议状态/签署动作由「待办事项」承载，
             已签署的全文与双方信息见 设置 → 合作协议（含下载），首页不再重复一遍 */
          partner: null,
          funnel: funnel,
          emptyState: false,
          finNote: "约定所得为只读台账口径，不构成可提现金额",
          permNote: ""
        };
      },
      entries: ["invite-code.html", "invite-records.html", "agreement.html", "reconcile-hub-sub.html", "team.html"],
      perms: { invite: true, createSub: false, signAgreement: true },
      badges: {},
      empty: { feed: { title: "暂无动态", desc: "与上级省代的对账、协议动态将出现在这里" } },
      lockedNote: "邀请与确认到账均已锁定，台账与协议仍可查阅"
    },
    sub_staff: {
      /* 2026-11-01 数据级脱敏：此前无本变体，回退 sub_admin 后被 stateVariantFor
         强制只读且数据仍是全企业口径——员工能看到陈志远名下全部 8 条线索与
         全盘对账金额。现按员工身份重算：只统计本人（ctx.staffName）名下渠道码
         与名下线索，企业盘（finance/subSettle）、对账、协议与团队一律不下发。 */
      label: "二级合作企业 · 员工",
      data: function (ctx) {
        var state = store.getState(), s = ctx.s, my = ctx.staffName;
        var par = s.parent || {};
        /* 二级域线索/渠道统一挂 school 桶 */
        var myLeads = [];
        (s.leads.school || []).forEach(function (l) { if (l.owner === my) myLeads.push(l); });
        var users = 0, myCode = "尚未生成";
        (s.channels.school || []).forEach(function (c) {
          if (c.ownerName === my) {
            if (c.status === "active") { users += c.users || 0; if (myCode === "尚未生成") myCode = c.code; }
          }
        });
        var paid = myLeads.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; });
        var amount = paid.reduce(function (sum, l) { return sum + (l.amount || 0); }, 0);
        return {
          company: s.profile.name,
          roleLine: "企业成员 · " + my + "（渠道专员）",
          badge: acctTxt(ctx, s.profile.status),
          badgeCls: "ok",
          metaL: "约定比例 " + Math.round((par.ratioToSub || 0) * 100) + "%",
          metaR: "合作自 " + (par.since || s.profile.since),
          finTitle: "我的获客概览",
          fin: {
            variant: "staff",
            mark: "SECONDARY · 员工渠道",
            seg: [],
            views: [{ hero: ui.moneyD(amount), tag: "已消费金额（本人渠道）", sub: "名下渠道 · 本月累计" }],
            metrics: [
              { k: "名下已注册用户", v: users + " 人" },
              { k: "已跟进线索", v: myLeads.length + " 条" },
              { k: "已消费用户", v: paid.length + " 人" },
              { k: "我的渠道码", v: myCode }
            ]
          },
          /* 二级员工无付款确认/异议/协议签署职责：待办由 store.todoOf 的
             sub_staff 分支直接返回空集，这里不再做二次过滤 */
          todo: store.todoOf(state),
          feed: feedForStaff(state),
          partner: null,
          emptyState: false,
          permNote: "员工权限：仅可管理本人渠道码与本人线索；付款确认、异议处理、比例配置、团队管理与对账平账仅企业管理员可执行。"
        };
      },
      entries: ["invite-code.html", "invite-records.html"],
      perms: { invite: true, genCode: true, createSub: false, signAgreement: false },
      badges: { fin: "员工 · 仅本人渠道" },
      empty: { feed: { title: "暂无动态", desc: "完成本人渠道推广后，动态将出现在这里" } },
      lockedNote: "付款确认、异议与团队管理仅企业管理员可操作"
    }
  };

  /* ---------- 子渲染：底部公司信息区（文字展开 · 点击查看详情） ---------- */
  function footerHtml(vm) {
    return '<section class="uh-fsec"><button class="uh-finfo" data-act="identity">' +
      '<span class="uh-finfo__nm">' + ui.esc(vm.company || "") + '</span>' +
      '<span class="uh-finfo__sub">' + ui.esc(vm.roleLine || "") + ' · ' + ui.esc(vm.badge || "") + '</span>' +
      '<span class="uh-finfo__no">' + ui.esc(vm.metaR || "") + '</span>' +
      '</button></section>';
  }

  /* ---------- 子渲染：财务卡（银行卡式 · 深色金属渐变，参考钱包余额卡视觉语言） ---------- */
  function finHtml(vm, V) {
    var f = vm.fin;
    if (!f) return "";
    var badge = V.badges.fin ? '<span class="ub-badge">' + ui.esc(V.badges.fin) + '</span>' : "";
    var seg = f.seg.length > 1
      ? '<div class="ub-seg" data-seg>' + f.seg.map(function (t, i) {
          return '<button class="ub-seg-item' + (i === 0 ? " active" : "") + '" data-i="' + i + '">' + ui.esc(t) + '</button>';
        }).join("") + '</div>' : "";
    var v0 = f.views[0];
    var metrics = f.metrics.map(function (m) {
      return '<div class="ub-m"><span class="ub-m__k">' + ui.esc(m.k) + '</span><span class="ub-m__v">' + m.v + '</span></div>';
    }).join("");
    return '<section class="uh-sec" data-fin>' +
      '<div class="ub-card ub-card--' + ui.esc(f.variant || "boss") + '">' +
      '<i class="ub-glow"></i><i class="ub-grain"></i><i class="ub-sheen"></i><span class="ub-mark">' + ui.esc(f.mark) + '</span>' +
      '<div class="ub-content">' +
      '<div class="ub-top"><span class="ub-title">' + ui.esc(vm.finTitle) + '</span>' + seg + badge + '</div>' +
      '<div class="ub-hero" data-hero>' + v0.hero + '<span class="ub-hero-tag" data-tag>' + ui.esc(v0.tag) + '</span></div>' +
      '<div class="ub-sub" data-sub>' + ui.esc(v0.sub) + '</div>' +
      '<div class="ub-line"></div>' +
      '<div class="ub-metrics">' + metrics + '</div>' +
      '</div></div></section>';
  }

  /* 唯一渲染路径：全页仅这一个身份取值行 */
  function todoHtml(vm, V) {
    var all = vm.todo.items || [];
    /* 待办最多展示 5 条；超出时标题行右侧提供「查看全部」→ 消息中心-待办事项 */
    var items = all.slice(0, 5);
    var countBadge = vm.todo.total ? '<span class="uh-badge uh-badge--mute">' + vm.todo.total + '</span>' : "";
    var more = all.length > 5
      ? '<button class="more" data-go="messages.html?tab=todo">查看全部 ' + ui.icon("chev", 13) + '</button>'
      : "";
    var body = items.length
      ? items.map(function (it) {
        var cat = Uni.catOf(it.type);
        return '<div class="nm-item" data-todo="' + ui.esc(it.key) + "::" + ui.esc(it.id || "") + '">' +
          '<div class="nm-head"><span class="nm-cat" ' + cat.style + '>' + cat.t + '</span>' +
          '<span class="nm-title">' + ui.esc(it.t) + '</span>' +
          '<span class="nm-time">今天</span></div>' +
          '<div class="nm-body"><span class="nm-body__tx">' + ui.esc(it.s || "") + '</span>' +
          '<span class="nm-go">前往处理 ' + ui.icon("chev", 13) + '</span></div>' +
          '</div>';
      }).join("")
      : '<div class="empty-state">' + ui.emptyHtml("暂无待办事项", "", "tray") + '</div>';
    return '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">待办事项</span>' + countBadge + more + '</div>' +
      '<div class="nm-list">' + body + '</div></section>';
  }

  /* ---------- 子渲染：合作档案块（省代员工视角；二级协议档案已并入「待办事项」与设置页弹窗） ---------- */
  function partnerHtml(vm) {
    var p = vm.partner;
    if (!p) return "";
    var right = p.more
      ? '<button class="more" data-go="' + ui.esc(p.more.go) + '">' + ui.esc(p.more.text) + ui.icon("chev", 13) + '</button>'
      : (p.badge ? '<span class="uh-badge uh-badge--' + p.badge.cls + '">' + ui.esc(p.badge.text) + '</span>' : "");
    var body = '<div class="uh-list" style="padding:6px 16px">' + p.rows.map(function (r) {
          return '<div class="uh-kv"><span class="k">' + ui.esc(r.k) + '</span><span class="v">' + ui.esc(r.v) + '</span></div>';
        }).join("") + '</div>';
    var foot = (p.footer || []).length
      ? '<div class="btn-row" style="padding:12px 14px 14px;border-top:1px solid var(--line)">' + p.footer.map(function (b) {
          return '<button class="btn ' + (b.kind === "primary" ? "btn-primary" : "btn-ghost") + ' btn-sm" style="flex:1" data-act="' + b.act + '">' + ui.esc(b.t) + '</button>';
        }).join("") + '</div>'
      : "";
    return '<section class="uh-sec"><div class="app-section-head"><span class="label">' + ui.esc(p.eyebrow) + '</span>' + right + '</div>' +
      body + foot + '</section>';
  }

  /* ---------- 子渲染：宫格 ---------- */
  function gridHtml(vm, V, Uni) {
    var todo = vm.todo || {};
    var tiles = V.entries.map(function (route) {
      var m = ENTRY_META[route] || { icon: "file", label: route };
      var dot = (route === "subs.html" && todo.subs > 0) ? '<span class="dot"></span>' :
        (route === "reconcile-hub-sub.html" && todo.payments > 0 ? '<span class="dot"></span>' : "");
      return '<button class="uh-tile" data-go="' + route + '">' + dot +
        '<span class="ic">' + ui.icon(m.icon, 18) + '</span><span>' + ui.esc(m.label) + '</span></button>';
    }).join("");
    return '<section class="uh-sec"><div class="app-section-head"><span class="label">常用功能</span></div>' +
      '<div class="uh-grid">' + tiles + '</div></section>';
  }

  /* ---------- 子渲染：最新动态（顶部单行滚动条 · 右→左无缝循环 · icon+时间+详情） ---------- */
  function tickerHtml(vm, V) {
    var items = vm.feed || [];
    if (!items.length) return "";
    var one = items.map(function (m) {
      var tx = (m.title || "") + (m.desc ? " · " + m.desc : "");
      return '<span class="uh-tickitem" data-tick="' + ui.esc(m.to || "") + '">' +
        '<span class="uh-tickitem__ic">' + ui.icon(m.icon || "bell", 13) + '</span>' +
        '<span class="uh-tickitem__time">' + ui.esc(m.time || "") + '</span>' +
        '<span class="uh-tickitem__tx">' + ui.esc(tx) + '</span>' +
        '</span>';
    }).join("");
    return '<section class="uh-sec uh-ticksec"><div class="uh-ticker">' +
      '<div class="uh-ticker__track" data-track>' + one + '</div></div></section>';
  }

  /* ---------- 企业信息 sheet ----------
     2026-11-01 审计修复：原实现用 `else` 兜底承接二级管理员，
     legal_rep（省代法定代表人）走同一分支时 s.parent 不存在 → TypeError、sheet 打不开。
     改为按 mode + 身份显式分派，并对 s.parent 统一取 {} 兜底。 */
  function identitySheet(ctx, vm) {
    var s = ctx.s, par = s.parent || {}, rows = [];
    var id = ctx.identity;
    if (ctx.mode === "province") {
      if (id === "staff") {
        rows = [["姓名", ctx.staffName], ["职务", "渠道专员"], ["所属企业", s.profile.name],
        ["合作状态", acctTxt(ctx, s.profile.status)], ["授权编号", s.profile.authNo],
        ["权限说明", "仅本人渠道码与本人线索；对账/审批/比例/协议仅管理员"]];
      } else {
        /* admin / legal_rep：省代企业档案（法代只读，仅多一行身份标注） */
        rows = [["企业名称", s.profile.name], ["联系人", s.profile.contact], ["合作状态", acctTxt(ctx, s.profile.status)],
        ["授权编号", s.profile.authNo], ["统一社会信用代码", s.profile.uscc], ["法定代表人", s.profile.legalPerson],
        ["合作起始", s.profile.since], ["地址", s.profile.address]];
        if (id === "legal_rep") rows.push(["当前身份", "法定代表人 · 只读视图"]);
      }
    } else {
      if (id === "sub_staff") {
        rows = [["姓名", ctx.staffName], ["职务", "渠道专员"], ["所属企业", s.profile.name],
        ["合作状态", acctTxt(ctx, s.profile.status)], ["合作编号", s.profile.authNo],
        ["上级总代", par.name || "—"], ["权限说明", "仅本人渠道码与本人线索；对账/异议/团队仅企业管理员"]];
      } else {
        /* sub_admin / sub_legal */
        rows = [["企业名称", s.profile.name], ["合作编号", s.profile.authNo], ["统一社会信用代码", s.profile.uscc],
        ["负责人", s.profile.contact], ["上级总代", par.name || "—"],
        ["约定比例", Math.round((par.ratioToSub || 0) * 100) + "%（只读）"],
        ["合作起始", par.since || s.profile.since]];
        if (id === "sub_legal") rows.push(["当前身份", "法定代表人 · 只读视图"]);
      }
    }
    Uni.sheet({
      title: "企业信息",
      body: rows.map(function (r) {
        return '<div class="uh-sheetkv"><span class="k">' + ui.esc(r[0]) + '</span><span class="v">' + ui.esc(r[1]) + '</span></div>';
      }).join(""),
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  /* 协议与待办操作闭环（确认到账 / 线下核实 / 审批 / 签署 / 驳回）：
     共享实现见 ..\uni-todo-ops.js —— 工作台首页与消息中心复用同一套操作弹窗。 */

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    /* 2026-11-01 审计修复：法代（legal_rep / sub_legal）没有页内变体，回退时复用管理员
       data()，页脚身份行会原样显示管理员那句「省级总代 · 编号 …」。这里换成身份全称，
       与顶部身份胶囊、锁定条保持同一口径。 */
    if ((ctx.identity === "legal_rep" || ctx.identity === "sub_legal") && vm) {
      vm.roleLine = ctx.identityLabel;
    }

    var html = "";
    /* 段0 暂停封条
       2026-11-01 审计修复：readonly 有两种来源——①企业合作状态非 active（真暂停）
       ②当前身份本身只读（法定代表人）。原实现一律渲染「合作已暂停」，把法代误标成
       合作中断。改为按来源取标题：状态暂停 → 合作暂停；身份只读 → V.lockedTitle。 */
    if (ctx.readonly) {
      var paused = ctx.s.profile.status !== "active";
      var lockT = paused
        ? (ctx.mode === "sub" ? "合作已暂停" : "合作权限已暂停")
        : (V.lockedTitle || "只读视图");
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(lockT) + '（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + '</span></div></div></section>';
    }
    /* 段1 最新动态滚动条（顶部） */
    html += tickerHtml(vm, V);

    if (vm.emptyState) {
      /* E017 空态 hero：无经营数据 */
      html += '<section class="uh-sec"><div class="card" style="padding:30px 18px">' +
        ui.emptyHtml("暂无经营数据", "发起新二级合作后，经营总盘与对账数据将出现在这里", "crown") +
        '<button class="btn btn-primary" data-act="new-sub" style="margin-top:6px">发起新二级合作</button></div></section>';
    } else {
      /* 段2 财务卡 */
      html += finHtml(vm, V);
      if (vm.permNote) {
        html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) + '<span>' + ui.esc(vm.permNote) + '</span></div></section>';
      }
      /* 段3 待办 */
      html += todoHtml(vm, V);
    }
    /* 段4 合作档案块 */
    html += partnerHtml(vm);
    /* 段5 宫格 */
    html += gridHtml(vm, V, Uni);
    /* 段6 底部公司信息区 */
    html += footerHtml(vm);

    el.innerHTML = html;

    /* 最新动态滚动条：无缝循环（偶数份内容）+ 动态时长 + 点击跳转 */
    var track = el.querySelector("[data-track]");
    if (track) {
      var oneW = track.scrollWidth, boxW = track.parentElement.clientWidth;
      if (oneW > 0) {
        var n = Math.max(2, Math.ceil((boxW * 2) / oneW));
        if (n % 2) n += 1;
        var html0 = track.innerHTML;
        for (var i = 1; i < n; i++) track.innerHTML += html0;
      }
      var dur = Math.max(18, Math.round(track.scrollWidth / 55));
      track.style.animation = "uh-tick " + dur + "s linear infinite";
      track.querySelectorAll("[data-tick]").forEach(function (tn) {
        tn.addEventListener("click", function () {
          var to = tn.getAttribute("data-tick");
          if (to) Uni.navTo(to);
        });
      });
    }

    /* 卡内分段：总盘/自留 切换（纯数据口径切换，重渲染 hero / 标签 / 副行） */
    var segBtn = el.querySelector("[data-seg]");
    if (segBtn) {
      var finCard = el.querySelector("[data-fin]");
      segBtn.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        segBtn.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var i = Number(b.getAttribute("data-i"));
        var vv = vm.fin.views[i];
        var hero = finCard.querySelector("[data-hero]");
        var sub = finCard.querySelector("[data-sub]");
        hero.innerHTML = vv.hero + '<span class="ub-hero-tag" data-tag>' + ui.esc(vv.tag) + '</span>';
        sub.textContent = vv.sub;
      });
    }

    /* data-go 统一委托 */
    el.querySelectorAll("[data-go]").forEach(function (n) {
      n.addEventListener("click", function () { Uni.navTo(n.getAttribute("data-go")); });
    });
    /* 待办条目 → 操作分支弹窗（不直接跳页；弹窗右上角放大 = 切换功能页） */
    el.querySelectorAll("[data-todo]").forEach(function (n) {
      n.addEventListener("click", function () {
        var v = (n.getAttribute("data-todo") || "").split("::");
        var key = v[0], id = v[1] || "";
        var it = null;
        (vm.todo.items || []).forEach(function (x) {
          if (x.key === key && (id === "" || x.id === id)) it = x;
        });
        if (it) window.UniTodoOps.open(ctx, it, Uni);
      });
    });
    /* 身份条 */
    var idb = el.querySelector('[data-act="identity"]');
    if (idb) idb.addEventListener("click", function () { identitySheet(ctx, vm); });

    /* 协议动作（签署/查看/拒签）已随首页协议档案块下线：签署走「待办事项」，
       全文与留痕走 设置 → 合作协议（uni-settings.js 内绑定下载） */

    var newSub = el.querySelector('[data-act="new-sub"]');
    if (newSub) newSub.addEventListener("click", function () { Uni.navTo("subs.html"); });
  }

  window.Uni.register({
    view: "uni-home",
    route: "home.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
