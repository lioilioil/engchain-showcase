/* page-home.js · 省代工作台首页 / 合作管理(#/subs) / 分佣设置(#/share-config)
   数据全部来自 store 种子；写操作经 act 守卫；演示数据统一标注"模拟测算"。 */
(function () {
  "use strict";
  var P = window.V3PAGES = window.V3PAGES || {};

  function pct(r) { return Math.round(Number(r) * 100) + "%"; }
  function roleName(by) { return by === "boss" ? "老板" : by === "staff" ? "员工" : by || "管理员"; }

  /* ================= 首页 ================= */
  function renderHome(ctx) {
    var ui = ctx.ui, d = ctx.d, V3 = ctx.V3;
    var fin = V3.store.calcFinance(d.financeBase, d.subs);
    var todo = V3.store.todoOf(ctx.s);
    var isEmpty = d.financeBase.gross === 0 && !d.subs.length && !d.subApps.length;

    var h = "";
    /* 暂停条 */
    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        "<div><b>合作权限已暂停（仅可查看）</b><div class=\"v3-xs\">数据、审批、发码与登记动作均已锁定，请联系平台处理</div></div></div>";
    }

    /* 身份条 */
    if (ctx.isStaff) {
      var me = (d.team || []).filter(function (m) { return m.name === ctx.s.roleStaffName; })[0] || { title: "渠道专员", name: ctx.s.roleStaffName };
      h += '<div class="v3-idbar" data-act="idcard" role="button"><div class="v3-idbar__main">' +
        '<span class="v3-avatar v3-avatar--staff"><span class="v3-avatar__txt">' + ui.esc(me.name.slice(0, 1)) + "</span></span>" +
        '<div class="v3-idbar__txt"><div class="v3-idbar__name">' + ui.esc(me.name) + '<span class="v3-badge v3-badge--active v3-ml6">员工</span></div>' +
        '<div class="v3-idbar__sub">' + ui.esc(me.title || "渠道专员") + " · 所属 " + ui.esc(d.profile.name) + "</div></div></div>" +
        '<div class="v3-idbar__right"><span class="v3-badge ' + ui.ACCT_BADGE[d.profile.status] + '">' + ui.ACCT[d.profile.status] + "</span>" +
        ui.icon("chev", 14) + "</div></div>";
      return h + staffHome(ctx, me);
    }
    h += '<div class="v3-idbar" data-act="idcard" role="button"><div class="v3-idbar__main">' +
      '<span class="v3-avatar v3-avatar--boss">' + ui.icon("crown", 18) + "</span>" +
      '<div class="v3-idbar__txt"><div class="v3-idbar__name">' + ui.esc(d.profile.name) + "</div>" +
      '<div class="v3-idbar__sub">省级总代 · 编号 ' + ui.esc(d.profile.authNo) + "</div></div></div>" +
      '<div class="v3-idbar__right"><span class="v3-badge ' + ui.ACCT_BADGE[d.profile.status] + '">' + ui.ACCT[d.profile.status] + "</span>" +
      ui.icon("chev", 14) + "</div></div>";

    /* 空态 */
    if (isEmpty) {
      h += '<div class="v3-empty v3-empty--hero">' +
        ui.emptyHtml("暂无经营数据", "<div>完成第一家二级合作或生成渠道码后，<br>这里将展示经营数据、待办与合作动态。</div>", "tray") +
        (ctx.canBoss ? '<button class="v3-btn v3-btn--primary v3-btn--block" data-act="quick-apply">发起新二级合作</button>' : "") +
        "</div>";
      return h;
    }

    /* 财务卡（总盘 / 自身线；无时间 tabs） */
    h += '<div class="v3-fin v3-fin--gold"><div class="v3-fin__top">' +
      '<div class="v3-seg v3-seg--mini"><button class="on" data-fin="total">省代总盘</button>' +
      '<button data-fin="self">自留所得</button></div>' +
      '</div>' +
      '<div class="v3-fin__main"><span class="v3-fin__k">省代总盘（平台合格消费 50%）</span>' +
      '<div class="v3-fin__num num" data-fin-num="total">' + ui.moneyD(fin.gross) + "</div>" +
      '<div class="v3-fin__num num v3-fin__num--hide" data-fin-num="self">' + ui.moneyD(fin.selfKeepAll || 0) + "</div>" +
      '<div class="v3-fin__rows">' +
      '<div class="v3-fin__row"><span>约定给二级</span><b class="num">' + (fin.agreedAll == null ? "逐二级配置" : ui.money(fin.agreedAll)) + "</b></div>" +
      '<div class="v3-fin__row"><span>T+7 冻结</span><b class="num">' + ui.money(fin.frozen) + "</b></div>" +
      "</div></div></div>";

    /* 待办（单源派生，可直达） */
    if (todo.items.length) {
      h += '<div class="v3-sec-title">待办</div><div class="v3-stack">';
      todo.items.forEach(function (it) {
        h += '<div class="v3-msg v3-msg--link" data-go="' + it.to + '">' +
          '<span class="v3-msg__ic v3-msg__ic--' + it.type + '">' + ui.icon(it.icon, 16) + "</span>" +
          '<div class="v3-msg__bd"><div class="v3-msg__t">' + ui.esc(it.t) + "</div>" +
          '<div class="v3-msg__d">' + ui.esc(it.s) + "</div></div>" +
          '<span class="v3-msg__go">' + ui.icon("chev", 14) + "</span></div>";
      });
      h += "</div>";
    }

    /* 合作管理预览 */
    h += '<div class="v3-sec-title v3-sec-title--bar"><span>合作管理</span>' +
      '<button class="v3-textbtn" data-go="#/subs">全部 ›</button></div>';
    h += '<div class="v3-card v3-card--pad v3-stack-narrow">';
    if (!d.subs.length) {
      h += '<div class="v3-placeholder">暂无生效中的二级合作</div>';
    } else {
      d.subs.slice(0, 2).forEach(function (s) {
        h += '<button class="v3-sub-row" data-act="open-sub" data-id="' + s.id + '">' +
          '<span class="v3-avatar v3-avatar--sub">' + ui.icon("building", 19) + "</span>" +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
          '<span class="v3-row__s">约定比例 ' + pct(s.ratioToSub) + " · 合作自 " + ui.esc(s.since || "—") + "</span></span>" +
          '<span class="v3-row__right"><span class="v3-badge ' + ui.ACCT_BADGE[s.status] + '">' + ui.ACCT[s.status] + "</span>" +
          ui.icon("chev", 16) + "</span></button>";
      });
    }
    h += "</div>";

    /* 常用功能（老板视角；独立页面入口，非分页/状态页） */
    h += '<div class="v3-sec-title">常用功能</div><div class="v3-card v3-card--pad v3-stack-narrow">' +
      '<button class="v3-row" data-go="#/team"><span class="v3-row__main">' + ui.icon("users", 18) + "<span>团队成员</span></span>" + ui.icon("chev", 15) + "</button>" +
      '<button class="v3-row" data-go="#/share-config"><span class="v3-row__main">' + ui.icon("crown", 18) + "<span>分佣与约定比例</span></span>" + ui.icon("chev", 15) + "</button></div>";

    /* 最近动态（真实派生） */
    h += '<div class="v3-sec-title">最近动态</div><div class="v3-card v3-card--pad v3-stack-narrow">' +
      activityRows(ctx).join("") + "</div>";

    return h;
  }

  /* ================= 员工视角首页（仅本人渠道数据） ================= */
  function staffHome(ctx, me) {
    var ui = ctx.ui, d = ctx.d, name = me.name;
    var ownCodes = [];
    ["direct", "agent"].forEach(function (ch) {
      (d.channels[ch] || []).forEach(function (c) {
        if (c.ownerType === "staff" && c.ownerName === name) ownCodes.push(c);
      });
    });
    var ownLeads = [];
    ["direct", "agent"].forEach(function (ch) {
      (d.leads[ch] || []).forEach(function (l) { if (l.owner === name) ownLeads.push(l); });
    });
    var users = ownCodes.reduce(function (s, c) { return s + (c.users || 0); }, 0);
    var paid = ownLeads.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; }).length;
    var amount = ownLeads.reduce(function (s, l) { return s + (l.amount || 0); }, 0);
    var activeCode = ownCodes.filter(function (c) { return c.status === "active"; })[0];

    var h = "";
    h += '<div class="v3-sec-title">我的获客</div>';
    h += '<div class="v3-card v3-card--pad v3-staff-card">' +
      '<div class="v3-stats"><div class="v3-stat"><b class="num">' + users + "</b><span>已注册用户</span></div>" +
      '<div class="v3-stat"><b class="num">' + ownLeads.length + "</b><span>已跟进线索</span></div>" +
      '<div class="v3-stat"><b class="num">' + paid + "</b><span>已消费</span></div></div>" +
      '<div class="v3-kv"><span class="k">名下合格消费</span><span class="v num">' + ui.money(amount) + "</span></div>" +
      (activeCode ? '<div class="v3-kv"><span class="k">本人渠道码</span><span class="v num">' + ui.esc(activeCode.code) + "</span></div>" : "") +
      '<div class="v3-actions v3-mt12"><button class="v3-btn v3-btn--primary v3-btn--block" data-go="#/invite">' +
      ui.icon("qr", 16) + " 进入我的获客</button></div></div>";

    h += '<div class="v3-sec-title">快捷入口</div><div class="v3-card v3-card--pad v3-stack-narrow">' +
      '<button class="v3-row" data-go="#/invite"><span class="v3-row__main">' + ui.icon("qr", 18) + "<span>渠道码与海报</span></span>" + ui.icon("chev", 15) + "</button>" +
      '<button class="v3-row" data-go="#/team"><span class="v3-row__main">' + ui.icon("users", 18) + "<span>团队成员</span></span>" + ui.icon("chev", 15) + "</button></div>";

    h += '<div class="v3-info-card"><div class="v3-info-card__title">' + ui.icon("shield", 15) + "<span>员工权限说明</span></div>" +
      '<div class="v3-legal-body"><p>员工仅可操作<b>本人渠道码</b>与<b>本人渠道线索</b>（发码、跟进、更新阶段）。</p>' +
      "<p>付款登记、对账确认、平账、合作审批、协议签署与分佣配置仅老板可执行；页面不展示全量财务数据。</p></div></div>";
    return h;
  }

  function activityRows(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var rows = [];
    d.subApps.forEach(function (a) {
      if (a.status === "pending") rows.push({ at: a.submittedAt, ic: "file-text", type: "info", t: a.name + " 提交合作申请", s: "约定比例 " + pct(a.ratio) + "，待审批", to: "#/subs" });
      if (a.status === "rejected") rows.push({ at: a.handledAt || "", ic: "x-circle", type: "danger", t: a.name + " 合作申请已驳回", s: a.rejectReason || "", to: "#/subs" });
      if (a.status === "approved") rows.push({ at: a.handledAt || "", ic: "check-circle", type: "ok", t: a.name + " 已成为二级合作", s: "合作自 " + a.handledAt, to: "#/subs" });
    });
    d.subs.forEach(function (s) {
      rows.push({ at: s.since, ic: "badge", type: "info", t: s.name + " 开始合作", s: "约定比例 " + pct(s.ratioToSub), to: "#/subs" });
    });
    d.payRegs1.forEach(function (r) {
      if (r.status === "disputed") rows.push({ at: r.disputedAt || "", ic: "warn", type: "danger", t: "与平台对账存在异议", s: r.reason || "待核实", to: "#/reconcile" });
    });
    d.payRegs2.forEach(function (r) {
      if (r.status === "pending_confirm") rows.push({ at: r.createdAt || "", ic: "clock", type: "warn", t: "二级收款待确认", s: ui.money(r.amount) + " · 出账第 " + (r.dueDay || 0) + " / 15 天", to: "#/reconcile" });
    });
    rows.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return rows.slice(0, 5).map(function (r) {
      return '<div class="v3-actrow" data-go="' + r.to + '">' +
        '<span class="v3-actrow__ic v3-msg__ic--' + r.type + '">' + ui.icon(r.ic, 15) + "</span>" +
        '<div class="v3-actrow__bd"><div class="v3-actrow__t">' + ui.esc(r.t) + "</div>" +
        '<div class="v3-actrow__s">' + ui.esc(r.s) + "</div></div>" +
        '<span class="v3-actrow__time">' + ui.esc(String(r.at || "").slice(5)) + "</span></div>";
    });
  }

  /* ================= 合作管理 #/subs ================= */
  function renderSubs(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var h = '<div class="v3-page-head"><div class="v3-page-title">二级合作管理</div>' +
      '<div class="v3-page-sub">合作申请、生效主体与约定比例配置</div></div>';
    if (ctx.canBoss) {
      h += '<button class="v3-btn v3-btn--primary v3-btn--block" data-act="create-app">' +
        ui.icon("plus", 16) + " 发起新二级合作</button>";
    }

    var pending = d.subApps.filter(function (a) { return a.status === "pending"; });
    var rejected = d.subApps.filter(function (a) { return a.status === "rejected"; });

    h += '<div class="v3-sec-title">待审批（' + pending.length + "）</div>";
    h += '<div class="v3-stack">';
    if (!pending.length) h += '<div class="v3-placeholder">暂无待审批申请</div>';
    pending.forEach(function (a) {
      h += '<div class="v3-card v3-card--pad"><div class="v3-sub-row v3-sub-row--plain">' +
        '<span class="v3-avatar v3-avatar--sub">' + ui.icon("building", 18) + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(a.name) + "</span>" +
        '<span class="v3-row__s">' + ui.esc(a.contact || "—") + " " + ui.esc(a.phone || "") + ' · <span class="v3-nowrap">提交于 ' + ui.esc(a.submittedAt) + "</span></span>" +
        '<span class="v3-row__s">申请比例 ' + pct(a.ratio) + "</span></span>" +
        '<span class="v3-badge v3-badge--pending">待审批</span></div>' +
        '<div class="v3-kv v3-mt8"><span class="k">统一社会信用代码</span><span class="v num">' + ui.esc(a.uscc) + "</span></div>" +
        '<div class="v3-kv"><span class="k">地址</span><span class="v">' + ui.esc(a.address || "—") + "</span></div>" +
        (ctx.canBoss ? '<div class="v3-actions v3-actions--2 v3-mt12">' +
          '<button class="v3-btn v3-btn--ghost v3-btn--danger" data-act="reject-app" data-id="' + a.id + '">驳回</button>' +
          '<button class="v3-btn v3-btn--primary" data-act="approve-app" data-id="' + a.id + '">通过</button></div>' : "") +
        "</div>";
    });
    h += "</div>";

    h += '<div class="v3-sec-title">生效中（' + d.subs.length + "）</div><div class=\"v3-stack\">";
    if (!d.subs.length) h += '<div class="v3-placeholder">暂无生效中合作</div>';
    d.subs.forEach(function (s) {
      h += '<div class="v3-card v3-card--pad"><button class="v3-sub-row v3-sub-row--plain" data-act="open-sub" data-id="' + s.id + '">' +
        '<span class="v3-avatar v3-avatar--sub">' + ui.icon("building", 18) + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
        '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "—") + " · 约定 " + pct(s.ratioToSub) + "</span></span>" +
        '<span class="v3-row__right"><span class="v3-badge ' + ui.ACCT_BADGE[s.status] + '">' + ui.ACCT[s.status] + "</span>" +
        ui.icon("chev", 16) + "</span></button>" +
        (ctx.canBoss ? '<div class="v3-actions v3-mt12">' +
          '<button class="v3-btn v3-btn--ghost v3-btn--block" data-act="set-ratio" data-id="' + s.id + '">配置约定比例</button>' +
          '<button class="v3-btn v3-btn--ghost v3-btn--block" data-act="resend-ag" data-id="' + s.id + '">重新发起协议</button></div>' : "") +
        "</div>";
    });
    h += "</div>";

    if (rejected.length) {
      h += '<div class="v3-sec-title">已驳回（' + rejected.length + "）</div><div class=\"v3-stack\">";
      rejected.forEach(function (a) {
        h += '<div class="v3-card v3-card--pad"><div class="v3-sub-row v3-sub-row--plain">' +
          '<span class="v3-avatar v3-avatar--sub">' + ui.icon("building", 18) + "</span>" +
          '<span class="v3-row__main"><span class="v3-row__t v3-row__t--mute">' + ui.esc(a.name) + "</span>" +
          '<span class="v3-row__s">驳回原因：' + ui.esc(a.rejectReason || "—") + "</span></span>" +
          '<span class="v3-badge v3-badge--terminated">已驳回</span></div></div>';
      });
      h += "</div>";
    }
    return h;
  }

  /* ================= 分佣设置 #/share-config ================= */
  function renderShareConfig(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var h = '<div class="v3-page-head"><div class="v3-page-title">约定比例配置</div>' +
      '<div class="v3-page-sub">省代与二级企业的月度所得约定比例（0–50%）</div></div>';
    h += '<div class="v3-stack">';
    if (!d.subs.length) h += '<div class="v3-placeholder">暂无可配置的二级合作</div>';
    d.subs.forEach(function (s) {
      h += '<div class="v3-card v3-card--pad">' +
        '<div class="v3-sub-row v3-sub-row--plain"><span class="v3-avatar v3-avatar--sub">' + ui.icon("building", 18) + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
        '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "—") + "</span></span></div>" +
        '<div class="v3-share-num"><span class="num">' + pct(s.ratioToSub) + "</span><span>月度合格消费约定比例</span></div>" +
        (ctx.canBoss ? '<button class="v3-btn v3-btn--ghost v3-btn--block v3-mt12" data-act="set-ratio" data-id="' + s.id + '">调整比例</button>' : "") +
        "</div>";
    });
    h += "</div>";

    h += '<div class="v3-sec-title">变更记录</div><div class="v3-card v3-card--pad v3-stack-narrow">';
    if (!d.ratioLog || !d.ratioLog.length) h += '<div class="v3-placeholder">暂无变更记录</div>';
    (d.ratioLog || []).slice(0, 8).forEach(function (l) {
      h += '<div class="v3-actrow"><span class="v3-actrow__ic v3-msg__ic--info">' + ui.icon("history", 15) + "</span>" +
        '<div class="v3-actrow__bd"><div class="v3-actrow__t">' + ui.esc(l.sub) + " · " + pct(l.from) + " → " + pct(l.to) + "</div>" +
        '<div class="v3-actrow__s">' + ui.esc(l.note || "") + " · " + roleName(l.by) + "</div></div>" +
        '<span class="v3-actrow__time">' + ui.esc(String(l.at || "").slice(5, 10)) + "</span></div>";
    });
    h += "</div>";
    return h;
  }

  /* ================= 弹层 ================= */
  function createAppSheet(ctx) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "发起新二级合作",
      body:
        '<div class="v3-field"><label>企业名称（必填）</label><input class="v3-input" id="ca-name" placeholder="如：成都某某工程有限公司"></div>' +
        '<div class="v3-field"><label>统一社会信用代码（必填，18 位）</label><input class="v3-input" id="ca-uscc" maxlength="18" placeholder="18 位统一社会信用代码"></div>' +
        '<div class="v3-field"><label>联系人</label><input class="v3-input" id="ca-contact" placeholder="联系人姓名"></div>' +
        '<div class="v3-field"><label>联系电话</label><input class="v3-input" id="ca-phone" type="tel" maxlength="11" placeholder="11 位手机号"></div>' +
        '<div class="v3-field"><label>企业地址</label><input class="v3-input" id="ca-address" placeholder="企业注册/经营地址"></div>' +
        '<div class="v3-field"><label>约定比例（0–50%）</label>' +
        '<div class="v3-ratio-pick"><input class="v3-input" id="ca-ratio" type="number" min="0" max="50" step="1" value="20"><span class="v3-ratio-pick__u">%</span></div></div>' +
        '<div class="v3-readnote">' + ui.icon("info", 13) + "<span>提交后进入双方资质审核；合作以签署 O4 协议为准。</span></div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交申请", kind: "v3-btn--primary", onClick: function (wrap) {
          var get = function (id) { return wrap.querySelector(id).value.trim(); };
          var data = {
            name: get("#ca-name"), uscc: get("#ca-uscc"), contact: get("#ca-contact"),
            phone: get("#ca-phone"), address: get("#ca-address"), ratio: Number(get("#ca-ratio")) / 100
          };
          if (!data.name) { ui.toast("请填写企业名称", "err"); return false; }
          if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(data.uscc.toUpperCase())) { ui.toast("统一社会信用代码应为 18 位", "err"); return false; }
          if (data.phone && !/^1\d{10}$/.test(data.phone)) { ui.toast("请输入正确的手机号", "err"); return false; }
          var r = ctx.V3.store.act("app/create", { channel: "direct", data: data });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已提交合作申请", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function reviewSheet(ctx, app) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "合作申请审批",
      body:
        '<div class="v3-kv"><span class="k">企业名称</span><span class="v">' + ui.esc(app.name) + "</span></div>" +
        '<div class="v3-kv"><span class="k">信用代码</span><span class="v num">' + ui.esc(app.uscc) + "</span></div>" +
        '<div class="v3-kv"><span class="k">联系人</span><span class="v">' + ui.esc(app.contact || "—") + " " + ui.esc(app.phone || "") + "</span></div>" +
        '<div class="v3-kv"><span class="k">地址</span><span class="v">' + ui.esc(app.address || "—") + "</span></div>" +
        '<div class="v3-kv"><span class="k">申请比例</span><span class="v">' + pct(app.ratio) + "</span></div>" +
        '<div class="v3-readnote v3-mt8">' + ui.icon("shield", 13) + "<span>通过后自动生成合作协议，待二级企业登录后签署。</span></div>",
      footer: [
        { t: "驳回", kind: "v3-btn--danger", onClick: function (wrap) {
          rejectReasonSheet(ctx, app);
          return false;
        } },
        { t: "通过", kind: "v3-btn--primary", onClick: function () {
          var r = ctx.V3.store.act("app/review", { id: app.id, pass: true });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已通过，协议已生成", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }
  function rejectReasonSheet(ctx, app) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "驳回合作申请",
      body: '<div class="v3-field"><label>驳回原因（必填，将对企业可见）</label>' +
        '<textarea class="v3-textarea" id="rj-reason" placeholder="如：资质不符 / 经营范围不符"></textarea></div>' +
        '<button class="v3-btn v3-btn--ghost v3-btn--block" data-quick="资质不符">资质不符（快捷填入）</button>',
      onMount: function (wrap) {
        var q = wrap.querySelector("[data-quick]");
        if (q) q.addEventListener("click", function () { wrap.querySelector("#rj-reason").value = "资质不符"; });
      },
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "确认驳回", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#rj-reason").value.trim();
          if (!reason) { ui.toast("请填写驳回原因", "err"); return false; }
          var r = ctx.V3.store.act("app/review", { id: app.id, pass: false, reason: reason });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已驳回", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  function openSubSheet(ctx, s) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "合作企业详情",
      body:
        '<div class="v3-idcard"><div class="v3-idcard__hd">' +
        '<span class="v3-avatar v3-avatar--sub v3-avatar--lg">' + ui.icon("building", 24) + "</span>" +
        '<div><div class="v3-idcard__name">' + ui.esc(s.name) + "</div>" +
        '<span class="v3-badge ' + ui.ACCT_BADGE[s.status] + '">' + ui.ACCT[s.status] + "</span></div></div>" +
        '<div class="v3-kv v3-mt12"><span class="k">统一社会信用代码</span><span class="v num">' + ui.esc(s.uscc || "—") + "</span></div>" +
        '<div class="v3-kv"><span class="k">联系人</span><span class="v">' + ui.esc(s.contact || "—") + " " + ui.esc(s.phone || "") + "</span></div>" +
        '<div class="v3-kv"><span class="k">地址</span><span class="v">' + ui.esc(s.address || "—") + "</span></div>" +
        '<div class="v3-kv"><span class="k">合作起始</span><span class="v">' + ui.esc(s.since || "—") + "</span></div>" +
        '<div class="v3-kv"><span class="k">约定比例</span><span class="v">' + pct(s.ratioToSub) + "</span></div></div>",
      footer: [
        { t: "关闭", kind: "v3-btn--ghost" },
        { t: "配置约定比例", kind: "v3-btn--primary", onClick: function () {
          ui.closeAll();
          ratioSheet(ctx, s);
          return false;
        } }
      ]
    });
  }

  function ratioSheet(ctx, s) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "调整约定比例 · " + s.name,
      body:
        '<div class="v3-field"><label>新约定比例（0–50%）</label>' +
        '<div class="v3-ratio-pick"><input class="v3-input" id="rt-val" type="number" min="0" max="50" value="' + Math.round(s.ratioToSub * 100) + '"><span class="v3-ratio-pick__u">%</span></div></div>' +
        '<div class="v3-readnote">' + ui.icon("info", 13) + "<span>比例变更后需与二级企业补签合作协议，将生成一条待办。</span></div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "确认调整", kind: "v3-btn--primary", onClick: function (wrap) {
          var v = Number(wrap.querySelector("#rt-val").value);
          if (isNaN(v) || v < 0 || v > 50) { ui.toast("比例须在 0–50% 之间", "err"); return false; }
          var r = ctx.V3.store.act("sub/setRatio", { id: s.id, ratio: v / 100, from: s.ratioToSub });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已调整，待补签协议", "ok");
          ctx.V3.router.render();
        } }
      ]
    });
  }

  /* ================= 挂载 ================= */
  function mountHome(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "quick-apply" || act === "create-app") {
        if (!ctx.canBoss) return ctx.ui.toast("仅老板可发起合作", "err");
        createAppSheet(ctx);
      } else if (act === "idcard") {
        var sheets = window.V3PAGES.infoSheets;
        if (ctx.isStaff) sheets.identityStaff(ctx); else sheets.identityBoss(ctx);
      } else if (act === "open-sub") {
        var s = ctx.d.subs.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        if (s) openSubSheet(ctx, s);
      } else if (act === "approve-app") {
        var a = ctx.d.subApps.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        if (a) reviewSheet(ctx, a);
      } else if (act === "reject-app") {
        var ar = ctx.d.subApps.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        if (ar) rejectReasonSheet(ctx, ar);
      } else if (act === "set-ratio") {
        var sr = ctx.d.subs.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        if (sr) ratioSheet(ctx, sr);
      } else if (act === "resend-ag") {
        if (!ctx.canBoss) return ctx.ui.toast("仅老板可重新发起协议", "err");
        resendAgreement(ctx);
      }
    });
    /* 财务卡 seg */
    var seg = el.querySelector("[data-fin]");
    if (seg) {
      el.querySelector(".v3-fin .v3-seg").addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-fin]");
        if (!btn) return;
        Array.prototype.forEach.call(el.querySelectorAll("[data-fin]"), function (x) { x.classList.remove("on"); });
        btn.classList.add("on");
        var k = btn.getAttribute("data-fin");
        el.querySelectorAll("[data-fin-num]").forEach(function (n) {
          n.classList.toggle("v3-fin__num--hide", n.getAttribute("data-fin-num") !== k);
        });
        el.querySelector(".v3-fin__k").textContent = k === "total" ? "省代总盘（平台合格消费 50%）" : "自留所得";
      });
    }
  }

  function resendAgreement(ctx) {
    var ui = ctx.ui;
    ui.openModal({
      icon: "file-text", title: "重新发起合作协议？",
      body: "用于二级企业拒签或修订约定后重新发起；将生成一条留痕并通知二级企业重新查阅签署。",
      okText: "确认重新发起",
      onOk: function () {
        var r = ctx.V3.store.act("agree/resend", {});
        if (!r.ok) { ui.toast(r.reason, "err"); return false; }
        ui.toast("协议已重新发起", "ok");
        ctx.V3.router.render();
      }
    });
  }

  function mountSubs(el, ctx) {
    mountHome(el, ctx);
  }

  P.home = {
    title: "工作台",
    render: renderHome,
    mount: mountHome,
    fab: function (ctx) {
      if (ctx.isStaff) {
        ctx.fab([{ icon: "invite", label: "邀请用户", onClick: function (c) { c.go("#/invite"); } }]);
        return;
      }
      ctx.fab([
        { icon: "invite", label: "邀请用户", onClick: function (c) { c.go("#/invite"); } },
        { icon: "plus", label: "招二级", onClick: function (c) { if (c.canBoss) c.go("#/subs"); else c.ui.toast("仅老板可发起合作", "err"); } }
      ]);
    }
  };
  P.subs = { title: "二级合作", render: renderSubs, mount: mountSubs, fab: function (ctx) {
    if (ctx.canBoss) ctx.fab([{ icon: "plus", label: "发起合作", onClick: function () { createAppSheet(ctx); } }]);
  } };
  P["share-config"] = { title: "分佣设置", render: renderShareConfig, mount: mountSubs };
})();
