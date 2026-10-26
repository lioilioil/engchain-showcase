/* page-home.js · 省代工作台 #/home
   【S3-E1-INDEX】身份卡只留 身份·公司·编号·有效期·状态徽章 + 角色徽章弹层 + 详情入口→#/profile；
   待办列表条与三入口卡（对账差异/在途冻结/线索沉寂）已收口至消息中心（E4 接入），home 不重复渲染；
   「邀请用户入驻」改为底部悬浮按钮（复刻 franchise .app-float-cta 视觉）。 */
(function () {
  "use strict";
  var ui;
  var fabWire = false;   /* hashchange 离场摘除监听仅挂一次 */

  function render(ctx) {
    ui = ctx.ui;
    var V3 = ctx.V3, d = ctx.d, st = ctx.state;
    /* 【S4-B】展示口径联动：比例显示值跟随 subs[0].ratioToSub（单二级 demo），
       传入 subsList 启用多二级聚合；无二级时回退 financeBase 种子值。 */
    var ratioDisp = (d.subs && d.subs.length) ? (d.subs[0].ratioToSub || 0) : d.financeBase.ratioToSub;
    var fin = V3.store.calcFinance(Object.assign({}, d.financeBase, { ratioToSub: ratioDisp, subsList: d.subs }));
    var fn = V3.store.funnelOf(d.leads);
    var isEmpty = st.scenario === "empty";
    var h = "";

    /* 暂停只读横幅 */
    if (ctx.readonly) {
      h += '<div class="v3-lockbanner">' + ui.icon("lock", 18) +
        '<div><b>账号已暂停 · 仅可查看</b><div class="v3-xs v3-mt2" style="color:#B9C4D4">发起邀请、登记付款、确认平账等操作已锁定，历史数据仍可查阅。</div></div></div>';
    }

    /* 身份卡（L1 深色全宽色带）：只留 身份·公司·编号·有效期·状态徽章；
       角色徽章点击弹层说明权限边界；「身份详情 ›」→ #/profile */
    var stCls = d.profile.status === "active" ? "on" : "warn";
    var stLabel = ui.ACCT[d.profile.status] || d.profile.status;
    var roleLabel = ctx.role === "staff" ? "员工" : "老板 / 管理员";
    h += '<section class="s-idcard">' +
      '<span class="ic-status ' + stCls + '"><span class="pa2-hdot"></span>' + ui.esc(stLabel) + "</span>" +
      '<span class="ic-eyebrow"><span class="tag">授权</span>省级总代</span>' +
      '<h2 class="ic-name">' + ui.esc(d.profile.agentName) + "</h2>" +
      '<p class="ic-desc">授权编号 <b>' + ui.esc(d.profile.authNo) + "</b> · 有效期至 <b>" + ui.esc(d.profile.validTill) + "</b></p>" +
      '<button type="button" class="ic-role" data-act="role">' +
        '<span class="rb">' + ui.esc(roleLabel) + "</span><span class=\"rk\">权限说明</span>" + ui.icon("chev", 14) + "</button>" +
      '<button type="button" class="ic-detail" data-go="#/profile">' +
        "<span>身份详情 · 授权证书 / 团队 / 规则</span>" + ui.icon("chev", 16) + "</button>" +
      "</section>";

    /* 财务大数字卡（segment 切换：总盘 / 自身线；明细静态呈现——【S4-B·F1】删除展开/收起动效） */
    var ratioPct = Math.round(fin.ratioToSub * 100);
    h += '<section class="v3-card v3-earn v3-mt12" >' +
      '<div class="seg"><button data-fin="gross" class="on">总盘</button><button data-fin="self">自身线</button></div>' +
      '<div class="v3-flex v3-between"><div><div class="big num" id="earn-big">' + ui.moneyD(fin.gross) + '</div>' +
      '<div class="sub" id="earn-sub">本月总盘 = 合格消费 × 50%</div></div></div>' +
      '<div class="rows" id="earn-rows">' +
      dline("合格消费", ui.money(fin.eligible)) +
      dline("约定给二级（" + ratioPct + "%）", ui.money(fin.agreed)) +
      dline("省代自留", ui.money(fin.selfKeep)) +
      dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small") +
      "</div></section>";

    /* 邀请速览（一行横向数字流，纯展示；邀请动作唯一主入口 = 底部悬浮按钮 FAB） */
    h += '<div class="section-head-row"><span class="t">邀请速览</span></div>';
    h += '<section class="v3-card">' +
      '<div class="pa2-funnel-line">' +
        fstep("直接邀请", fn.direct) + farrow() +
        fstep("已注册", fn.registered) + farrow() +
        fstep("已入驻", fn.onboarded) + farrow() +
        fstep("已消费", fn.paid) +
      "</div>" +
      '<div class="v3-stat-money v3-mt10" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额 · 仅统计不发钱</div>' +
      '<div class="amt num v3-mt3" >' + ui.moneyD(fn.paidAmount) + '</div>' +
      (fn.ignored ? '<div class="v3-note-line v3-mt9" >另有 ' + fn.ignored + " 位再邀请用户 · 不归属不分佣不传递</div>" : "") +
      "</section>";

    /* 合作管理（二级）— L3 通栏行；行内 chip 已并入详情 sheet（清单 B8） */
    h += '<div class="section-head-row"><span class="t">合作管理 · 二级企业</span><span class="act" data-go="#/subs">全部 ›</span></div>';
    h += '<section class="v3-sub-list">';
    if (d.subs && d.subs.length) {
      d.subs.forEach(function (s) {
        h += '<button class="v3-sub-row" data-sub="' + s.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(s.name.slice(0, 1)) + '</span>' +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
          '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "") + " · 比例 " + Math.round((s.ratioToSub || 0) * 100) + '%</span></span>' +
          '<span class="v3-row__right"><span class="v3-badge v3-badge--active">生效</span></span>' + ui.icon("chev", 18) + "</button>";
      });
    } else {
      h += '<div class="v3-empty v3-ep26" >' + ui.emptyHtml("还没有二级企业",
        '<div>名额 0 / ' + d.profile.cap + "，可在「二级管理」发起合作或邀请终端用户入驻。</div>",
        "crown") + "</div>";
    }
    h += "</section>";

    /* 工作台导航已删除（运营规则/税务指引/授权徽章与 #/profile 重复 → profile 保留，home 删除；V1） */

    h += '<div class="trust">润锦工程链 Engchain 3.0 · 原型数据均为 Mock</div>';

    if (isEmpty) {
      // empty 场景：数据为 0 时仍正常渲染骨架，额外空态提示（邀请动作统一走底部悬浮按钮）
      h = '<div class="v3-empty">' + ui.emptySvg("tray") +
        '<div class="t">还没有任何邀请数据</div><div class="d">点击底部「邀请获客」悬浮按钮，生成你的第一个渠道码；也可发起二级合作。</div></div>' + h;
    }
    return h;
  }

  function dline(k, v, cls) {
    return '<div class="v3-dline"><span class="k">' + k + '</span><span class="v ' + (cls || "") + ' num">' + v + "</span></div>";
  }
  function fstep(k, v) {
    return '<div class="fs"><span class="fv num">' + v + '</span><span class="fk">' + k + "</span></div>";
  }
  function farrow() { return '<span class="fa">' + ui.icon("chev", 12) + "</span>"; }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    var ratioDisp = (d.subs && d.subs.length) ? (d.subs[0].ratioToSub || 0) : d.financeBase.ratioToSub;
    var fin = V3.store.calcFinance(Object.assign({}, d.financeBase, { ratioToSub: ratioDisp, subsList: d.subs }));

    el.addEventListener("click", function (e) {
      var goEl = e.target.closest("[data-go]");
      if (goEl) { ctx.go(goEl.getAttribute("data-go")); return; }
      if (e.target.closest("[data-act='role']")) { permSheet(ctx); return; }
      var sub = e.target.closest("[data-sub]");
      if (sub) {
        var id = sub.getAttribute("data-sub");
        var s = d.subs.filter(function (x) { return x.id === id; })[0];
        if (s) openSub(s, ctx);
      }
    });

    /* 【S4-B·F1】删除「查看明细/收起明细」展开收起动效——明细静态呈现，无 toggle */

    /* 财务 segment */
    var big = el.querySelector("#earn-big"), sub = el.querySelector("#earn-sub"), rows = el.querySelector("#earn-rows");
    Array.prototype.forEach.call(el.querySelectorAll("[data-fin]"), function (b) {
      b.addEventListener("click", function () {
        if (b.classList.contains("on")) return;
        el.querySelectorAll("[data-fin]").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        if (b.getAttribute("data-fin") === "self") {
          big.innerHTML = ui.moneyD(fin.selfLine);
          sub.textContent = "自身线 = 自身合格消费 × 50%（独立，不与总盘相加）";
          rows.innerHTML = dline("自身合格消费", ui.money(d.financeBase.selfBase || 0)) +
            dline("自身线比例", "50%") + dline("自身线经营所得", ui.money(fin.selfLine)) +
            dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small");
        } else {
          big.innerHTML = ui.moneyD(fin.gross);
          sub.textContent = "本月总盘 = 合格消费 × 50%";
          rows.innerHTML = dline("合格消费", ui.money(fin.eligible)) +
            dline("约定给二级（" + Math.round(fin.ratioToSub * 100) + "%）", ui.money(fin.agreed)) +
            dline("省代自留", ui.money(fin.selfKeep)) +
            dline("T+" + V3.store.CONST.frozenDays + " 在途冻结", ui.money(fin.frozen), "small");
        }
      });
    });

    mountFab(ctx);
  }

  /* 底部悬浮按钮（复刻 franchise .app-float-cta：玻璃容器 + 图标 + 短文案） */
  function mountFab(ctx) {
    var ui = ctx.ui;
    var phone = document.querySelector(".phone");
    if (!phone) return;
    var old = document.getElementById("e1-fab");
    if (old) old.remove();
    var fab = document.createElement("div");
    fab.className = "app-float-cta";
    fab.id = "e1-fab";
    fab.setAttribute("data-lg-glass", "");
    fab.innerHTML =
      '<button type="button" class="afc-item" id="e1-fab-btn">' + ui.icon("invite", 18) +
      '<span class="afc-label">邀请获客</span></button>';
    phone.appendChild(fab);
    fab.querySelector("#e1-fab-btn").addEventListener("click", function () {
      if (ctx.readonly) { ui.toast("账号暂停中，仅可查看", "err"); return; }
      ctx.go("#/invite");
    });
    /* 离场摘除：离开 home 即移除悬浮按钮（只挂一次 hashchange） */
    if (!fabWire) {
      fabWire = true;
      window.addEventListener("hashchange", function () {
        var k = (location.hash || "#/home").replace(/^#\/?/, "").split("?")[0];
        if (k !== "home") { var f = document.getElementById("e1-fab"); if (f) f.remove(); }
      });
    }
  }

  /* 权限说明弹层（角色徽章 → 权限边界说明） */
  function permSheet(ctx) {
    var isStaff = ctx.role === "staff";
    ctx.ui.openSheet({
      title: "权限说明 · " + (isStaff ? "员工" : "老板 / 管理员"),
      body: isStaff
        ? '<div class="dl">' +
          kv("可操作", "生成邀请码、跟进线索、登记线下付款并上传凭证") +
          kv("不可操作", "确认到账 / 月度平账、配置二级比例、签署协议、查看自留收益、全量导出") +
          kv("可见范围", "仅本人名下线索") + "</div>"
        : '<div class="dl">' +
          kv("可操作", "邀请获客、发起二级合作与初审、登记付款、确认到账、月度平账留痕") +
          kv("收益可见", "总盘 / 自身线 / 自留收益全量可见") +
          kv("配置范围", "二级比例在平台配置 + O4 协议范围内设定") + "</div>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }]
    });
  }

  function openSub(s, ctx) {
    var ui = ctx.ui;
    var fin = ctx.V3.store.calcFinance(ctx.d.financeBase);
    ui.openSheet({
      title: "二级企业 · 授权详情",
      body: '<div class="dl">' +
        kv("企业名称", ui.esc(s.name)) + kv("合作起始", ui.esc(s.since || "—")) +
        kv("约定所得比例", Math.round((s.ratioToSub || 0) * 100) + "%（平台配置 + O4 协议）") +
        kv("本月该二级总盘（测算）", ui.money(fin.gross)) +
        kv("本月约定所得（测算）", ui.money(Math.round(fin.gross * (s.ratioToSub || 0)))) +
        kv("邀请终端用户", "允许（单层绑定）") + kv("发展下级企业", "永久禁止（两级封顶）") +
        "</div>" +
        '<div class="sub-scope v3-mt12" >该二级可直接邀请终端用户并据此计本人线；' +
        "终端用户再邀请不归属、不分佣、不向下传递；二级无招商码。</div>" +
        '<p class="v3-legal v3-mt10" >' + ctx.V3.MONEY_NOTE + "</p>",
      footer: ctx.canBoss
        ? [{ t: "关闭", kind: "v3-btn--ghost" },
           { t: "分成配置 ›", kind: "v3-btn--primary", onClick: function () { ctx.go("#/share-config"); } }]
        : [{ t: "关闭", kind: "v3-btn--ghost", onClick: function (ov) { ctx.ui.closeAll(); } }]
    });
  }
  function kv(k, v) { return '<span class="k">' + k + '</span><span class="v">' + v + "</span>"; }

  window.V3PAGES.home = { title: "工作台", render: render, mount: mount };

  /* ============================================================
     【S4-B·F4】二级管理 #/subs + 分成配置 #/share-config
     - 由「邀请获客」拆分迁入：发展二级企业 / 二级列表 / 状态管理 / 分成配置统一在此；
       #/invite 仅保留自身获客（终端用户邀请、线索、转化、交易跟踪）。
     - 注册时机：page-home.js 晚于 router.js 加载，可覆盖 S2 stub 占位。
     ============================================================ */
  function segBar(active) {
    return '<div class="v3-subseg s4b-subseg">' +
      '<button type="button" class="v3-seg' + (active === "subs" ? " active" : "") + '" data-key="subs">二级列表</button>' +
      '<button type="button" class="v3-seg' + (active === "share-config" ? " active" : "") + '" data-key="share-config">分成配置</button></div>';
  }
  function wireSegBar(el) {
    var bar = el.querySelector(".s4b-subseg");
    if (bar) bar.addEventListener("click", function (e) {
      var b = e.target.closest(".v3-seg"); if (!b) return;
      window.V3.router.go("#/" + b.getAttribute("data-key"));
    });
  }

  /* ---------- #/subs 二级列表（含招商码 / 发起二级 / 待初审） ---------- */
  function renderSubs(ctx) {
    var ui = ctx.ui, d = ctx.d, V3 = ctx.V3;
    var h = segBar("subs");
    var pend = (d.subApps || []).filter(function (a) { return a.status === "pending"; });
    h += '<section class="s4b-summary"><div><div class="n num">' + (d.subs || []).length + '</div><div class="k">在管二级企业</div></div>' +
      '<div><div class="n num">' + d.profile.used + ' / ' + d.profile.cap + '</div><div class="k">名额使用</div></div>' +
      (pend.length ? '<div><div class="n num">' + pend.length + '</div><div class="k">待初审申请</div></div>' : "") + "</section>";

    /* 待初审（置顶） */
    if (pend.length) {
      h += '<div class="section-head-row"><span class="t">二级申请 · 待初审 ' + pend.length + "</span></div>";
      h += '<div class="v3-sub-list" style="border-radius:17px" id="s4b-apps">';
      h += pend.map(function (a) {
        return '<button class="v3-sub-row" data-s4b="app" data-id="' + a.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(a.entName.slice(0, 1)) + "</span>" +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(a.entName) +
          ' <span class="v3-badge v3-badge--pending">待初审</span></span>' +
          '<span class="v3-row__s">' + ui.esc(a.contact) + " " + ui.esc(a.phone) + " · 申请比例 " + Math.round(a.ratioToSub * 100) + "%</span></span>" +
          ui.icon("chev", 17) + "</button>";
      }).join("");
      h += "</div>";
    }

    /* 二级列表 */
    h += '<div class="section-head-row"><span class="t">已合作二级企业</span></div>';
    h += '<div class="v3-sub-list" style="border-radius:17px" id="s4b-sublist">';
    if (d.subs && d.subs.length) {
      h += d.subs.map(function (s) {
        return '<button class="v3-sub-row" data-s4b="sub" data-id="' + s.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(s.name.slice(0, 1)) + "</span>" +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(s.name) + "</span>" +
          '<span class="v3-row__s">合作自 ' + ui.esc(s.since || "—") + " · 比例 " + Math.round((s.ratioToSub || 0) * 100) + '%</span></span>' +
          '<span class="v3-row__right">' +
          (s.status === "active" ? '<span class="v3-badge v3-badge--active">生效</span>' : '<span class="v3-badge v3-badge--suspended">' + ui.ACCT[s.status] + "</span>") +
          "</span>" + ui.icon("chev", 18) + "</button>";
      }).join("");
    } else {
      h += '<div class="v3-empty v3-ep26" >' + ui.emptyHtml("还没有二级企业", "通过下方「发起新的二级合作」提交申请，审核通过后成为在管二级。", "crown") + "</div>";
    }
    h += "</div>";

    /* 招商码 */
    h += '<div class="section-head-row"><span class="t">招商码（AG · 仅招二级）</span></div>';
    h += '<section class="v3-sub-list" style="border-radius:17px" id="s4b-aglist">';
    var codes = d.agentCodes || [];
    if (!codes.length) {
      h += '<div class="v3-empty v3-ep24" >' + ui.emptyHtml("暂无招商码",
        ctx.canBoss ? '<button class="v3-btn v3-btn--navy v3-btn--sm" data-s4b="gen-ag">生成招商码</button>' : "", "crown") + "</div>";
    } else {
      h += codes.map(function (c) {
        return '<div class="v3-sub-row"><span class="v3-avatar v3-avatar--sub">' + ui.icon("crown", 19) + "</span>" +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(c.code) +
          (c.status === "active" ? ' <span class="v3-badge v3-badge--active">生效</span>' : ' <span class="v3-badge v3-badge--void">已作废</span>') +
          '</span><span class="v3-row__s">招商专用 · 创建 ' + ui.esc(c.createdAt) + "</span></span>" +
          (c.status === "active" && ctx.canBoss ? '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-s4b="void-ag" data-id="' + c.id + '">作废</button>' : "") +
          (c.status === "active" && ctx.canBoss ? '<button class="v3-btn v3-btn--navy v3-btn--sm" data-s4b="ag-share" data-id="' + c.id + '">分享</button>' : "") +
          "</div>";
      }).join("");
      if (ctx.canBoss && !codes.some(function (c) { return c.status === "active"; }))
        h += '<button class="v3-sub-row" data-s4b="gen-ag"><span class="v3-row__main"><span class="v3-row__t v3-goldtext">+ 生成新招商码</span></span>' + ui.icon("chev", 17) + "</button>";
    }
    h += "</section>";

    /* 发起二级合作 */
    var quotaFull = d.profile.used >= d.profile.cap;
    h += '<div class="section-head-row"><span class="t">发起二级合作</span></div>';
    h += '<section class="v3-card"><div class="v3-flex v3-between v3-mb8" ><span class="v3-sm v3-muted">名额（已入驻 / 上限）</span>' +
      '<span class="v3-strong num">' + d.profile.used + " / " + d.profile.cap + "</span></div>" +
      '<div class="v3-progress v3-mb12" ><i style="width:' + Math.round(d.profile.used / d.profile.cap * 100) + '%"></i></div>';
    if (ctx.readonly) {
      h += '<button class="v3-btn v3-btn--block is-disabled">账号暂停中，不可发起</button>';
    } else if (!ctx.canBoss) {
      h += '<button class="v3-btn v3-btn--block is-disabled">仅法人 / 管理员可发起二级</button>';
    } else if (quotaFull) {
      h += '<button class="v3-btn v3-btn--block is-disabled">名额已满</button>' +
        '<div class="v3-alert v3-alert--warn v3-mt10" >名额已满；仍可继续邀请终端用户入驻（获客不限名额）。</div>';
    } else {
      h += '<button class="v3-btn v3-btn--navy v3-btn--block" data-s4b="new-app">+ 发起新的二级合作</button>';
    }
    h += "</section>";
    return h;
  }

  /* ---------- #/share-config 分成配置（可操作 UI + 落 store + 联动测算） ---------- */
  function renderShareConfig(ctx) {
    var ui = ctx.ui, d = ctx.d, V3 = ctx.V3;
    var fin = V3.store.calcFinance(d.financeBase);
    var h = segBar("share-config");
    /* C-02 常驻说明卡 → 页尾折叠（V1 同一说明只占一处、默认收起；内容不删只改承载） */
    h += '<details class="v3-note-fold v3-my12"><summary>' + ui.icon("shield", 15) +
      '<span class="sum">约定所得比例说明</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body">区间 <b>0–50%</b>（平台配置 + O4 协议内）；比例按二级逐个配置，保存后立即联动财务测算与留痕；历史协议条款为签署只读，变更后建议与二级补签约定。</div></details>';
    if (ctx.readonly) h += '<div class="v3-alert v3-alert--warn v3-mb12" >账号暂停中：仅可查看，不可配置。</div>';
    if (!ctx.canBoss) h += '<div class="v3-alert v3-alert--warn v3-mb12" >仅老板 / 管理员可配置二级比例。</div>';

    var subs = d.subs || [];
    if (!subs.length) {
      h += '<div class="v3-empty v3-ep28" >' + ui.emptyHtml("暂无可配置的二级企业", "先在「二级列表」发起并通过初审后，再在此配置约定所得比例。", "crown") + "</div>";
      return h;
    }
    h += '<div class="section-head-row"><span class="t">逐个配置约定所得比例</span></div>';
    h += '<div id="s4b-cards">';
    subs.forEach(function (s) {
      var cur = Math.round((s.ratioToSub || 0) * 100);
      var log = s.ratioLog || [];
      h += '<section class="v3-card s4b-cfg" data-id="' + s.id + '">' +
        '<div class="s4b-cfg__hd"><span class="v3-avatar v3-avatar--sub">' + ui.esc(s.name.slice(0, 1)) + "</span>" +
        '<span class="s4b-cfg__name">' + ui.esc(s.name) + "</span>" +
        '<span class="v3-badge v3-badge--gold">当前 ' + cur + '%</span></div>' +
        '<div class="v3-stepper s4b-slider"><input type="range" min="0" max="50" step="1" value="' + cur + '"' + (ctx.canBoss && !ctx.readonly ? "" : " disabled") + ' /><span class="val" data-v>' + cur + '%</span></div>' +
        '<div class="s4b-est">本月总盘（测算）<b class="num">' + ui.money(fin.gross) + "</b> → 该二级约定所得 ≈ <b class='num' data-est>" + ui.money(Math.round(fin.gross * cur / 100)) + "</b>（仅测算 · 不发钱）</div>" +
        (ctx.canBoss && !ctx.readonly
          ? '<button class="v3-btn v3-btn--navy v3-btn--block v3-mt10" data-s4b="save-ratio">保存该二级比例</button>'
          : "") +
        '<div class="s4b-log"><div class="t">变更留痕' + (s.ratioUpdatedAt ? "（最近 " + ui.esc(s.ratioUpdatedAt) + "）" : "") + '</div>' +
        (log.length
          ? log.slice().reverse().slice(0, 6).map(function (r) {
              return '<div class="li"><span class="at">' + ui.esc(r.at) + '</span><span class="ch num">' + Math.round(r.from * 100) + '% → ' + Math.round(r.to * 100) + '%</span><span class="by">' + (r.by === "staff" ? "员工" : "管理员") + '</span></div>';
            }).join("")
          : '<div class="li faint">暂无变更记录（沿用发起时约定比例）</div>') + "</div></section>";
    });
    h += "</div>";
    return h;
  }

  /* ---------- subs / share-config 共用 sheet（自邀请获客页迁入） ---------- */
  function subsPosterSheet(ctx, c, isAg) {
    var ui = ctx.ui, code = (c && c.code) || "——";
    ctx.ui.openSheet({
      title: isAg ? "招商码海报" : "渠道码海报 · 分享",
      body: '<div class="v3-poster"><div class="pt">入驻润锦工程链<br/>工程信息 · 一站直达</div>' +
        '<div class="ps">' + (isAg ? "诚邀优质工程服务企业成为区域合作伙伴" : "服务与权益有保障") + "</div>" +
        '<div class="pq"><div class="v3-qr"></div></div><div class="pc">' + ui.esc(code) + "</div></div>" +
        '<div class="iv-codeline v3-mt12" >' + ui.esc(code) + "</div>" +
        '<p class="v3-legal v3-mt12" style="text-align:center">二维码为原型占位；分享 / 复制为 Mock 演示。</p>',
      footer: [{ t: "完成", kind: "v3-btn--primary", onClick: function () { ctx.ui.closeAll(); } }]
    });
  }
  function subsNewAppSheet(ctx, done) {
    var ui = ctx.ui, d = ctx.d;
    ctx.ui.openSheet({
      title: "发起二级合作",
      body:
        '<div class="v3-field"><label>企业名称</label><input class="v3-input" id="a-name" placeholder="营业执照全称" /></div>' +
        '<div class="v3-field"><label>统一社会信用代码</label><input class="v3-input" id="a-uscc" placeholder="18 位" /></div>' +
        '<div class="v3-field"><label>联系人</label><input class="v3-input" id="a-contact" placeholder="姓名" /></div>' +
        '<div class="v3-field"><label>联系手机</label><input class="v3-input" id="a-phone" type="tel" placeholder="11 位手机号" /></div>' +
        '<div class="v3-field"><label>约定所得比例（0–50%，平台配置 + 协议内）</label>' +
        '<div class="v3-stepper"><input type="range" id="a-ratio" min="0" max="50" step="1" value="20" /><span class="val" id="a-ratio-v">20%</span></div>' +
        '<div class="v3-hint">获批后可在「分成配置」页逐个调整该比例。</div></div>' +
        '<div class="v3-xs v3-muted">提交后进入待初审，名额占用将在审核通过后 +1（当前 ' + d.profile.used + "/" + d.profile.cap + "）。</div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交申请", kind: "v3-btn--navy", onClick: function (wrap) {
          var name = wrap.querySelector("#a-name").value.trim(), uscc = wrap.querySelector("#a-uscc").value.trim(),
              contact = wrap.querySelector("#a-contact").value.trim(), phone = wrap.querySelector("#a-phone").value.trim(),
              ratio = Number(wrap.querySelector("#a-ratio").value) / 100;
          if (!name || !uscc || !contact || !/^1\d{10}$/.test(phone)) { ui.toast("请完整填写企业与联系人信息", "err"); return false; }
          if (d.profile.used >= d.profile.cap) { ui.toast("名额已满，不可再招二级", "err"); return false; }
          ctx.V3.store.act("app/create", { entName: name, uscc: uscc, contact: contact, phone: phone, ratioToSub: ratio });
          ui.toast("已提交，待初审", "ok"); done && done();
        } }
      ],
      onMount: function (wrap) {
        var r = wrap.querySelector("#a-ratio"), rv = wrap.querySelector("#a-ratio-v");
        r.addEventListener("input", function () { rv.textContent = r.value + "%"; });
      }
    });
  }
  function subsAppSheet(ctx, a, done) {
    if (!a) return;
    var ui = ctx.ui;
    if (!ctx.canBoss) {
      ui.openSheet({ title: a.entName, body: "<div class='dl'>" +
        '<span class="k">联系人</span><span class="v">' + ui.esc(a.contact) + " " + ui.esc(a.phone) + "</span>" +
        '<span class="k">申请比例</span><span class="v">' + Math.round(a.ratioToSub * 100) + "%</span>" +
        '<span class="k">状态</span><span class="v">待管理员初审</span></div>' +
        '<div class="v3-readnote v3-mt12" >员工仅有查看权限，不能审批、不能配置比例。</div>',
        footer: [{ t: "关闭", kind: "v3-btn--ghost" }] });
      return;
    }
    ui.openSheet({
      title: "二级申请 · 初审",
      body: '<div class="dl">' +
        '<span class="k">企业名称</span><span class="v">' + ui.esc(a.entName) + "</span>" +
        '<span class="k">信用代码</span><span class="v">' + ui.esc(a.uscc) + "</span>" +
        '<span class="k">联系人</span><span class="v">' + ui.esc(a.contact) + " " + ui.esc(a.phone) + "</span>" +
        '<span class="k">申请比例</span><span class="v v3-goldtext">' + Math.round(a.ratioToSub * 100) + "%（需在 0–50% 与平台配置内）</span></span>" +
        "</div>" +
        '<div class="sh-sec">审批结论</div>' +
        '<div class="v3-field v3-reveal" id="rej-box"><label>驳回原因（必填）</label>' +
        '<textarea class="v3-textarea" id="a-reason" placeholder="如：资质材料不完整，请补充建筑业相关资质"></textarea></div>' +
        '<div class="v3-xs v3-muted">通过后名额 +1，系统生成二级账号与 O4 协议；二级可直接邀终端用户，但不能再发展下级。</div>',
      footer: [
        { t: "驳回", kind: "v3-btn--danger", onClick: function (wrap) {
          var reason = wrap.querySelector("#a-reason").value.trim();
          if (!reason) { ui.toast("请填写驳回原因", "err"); return false; }
          ctx.V3.store.act("app/review", { id: a.id, pass: false, reason: reason }); ui.toast("已驳回", "ok"); done && done();
        } },
        { t: "通过并生成协议", kind: "v3-btn--primary", onClick: function () {
          ctx.V3.store.act("app/review", { id: a.id, pass: true }); ui.toast("已通过，名额 +1", "ok"); done && done();
        } }
      ]
    });
  }

  /* ---------- 两个视图的 mount ---------- */
  function mountSubs(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    function refresh() { V3.router.render(); }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-s4b]"); if (!b) return;
      var act = b.getAttribute("data-s4b"), id = b.getAttribute("data-id");
      if (act === "gen-ag") {
        if (!ctx.canBoss) return ui.toast("仅管理员可生成招商码", "err");
        V3.store.act("agent/gen", {}); ui.toast("招商码已生成", "ok"); refresh();
      } else if (act === "ag-share") {
        subsPosterSheet(ctx, (d.agentCodes || []).filter(function (c) { return c.id === id; })[0] || {}, true);
      } else if (act === "void-ag") {
        ctx.ui.openModal({
          title: "作废该招商码？", icon: "warn", danger: true,
          body: "作废后该码立即失效且不可恢复（仅留痕）。已通过该码进入审批流的申请不受影响。", okText: "确认作废",
          onOk: function () { V3.store.act("agent/void", { id: id, reason: "主动作废" }); ui.toast("已作废", "ok"); refresh(); }
        });
      } else if (act === "new-app") {
        if (ctx.readonly) return ui.toast("账号暂停中，仅可查看", "err");
        subsNewAppSheet(ctx, refresh);
      } else if (act === "app") {
        subsAppSheet(ctx, (d.subApps || []).filter(function (x) { return x.id === id; })[0], refresh);
      } else if (act === "sub") {
        var s = (d.subs || []).filter(function (x) { return x.id === id; })[0];
        if (s) openSub(s, ctx);
      }
    });
    wireSegBar(el);
  }
  function mountShareConfig(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    var fin = V3.store.calcFinance(d.financeBase);
    el.addEventListener("input", function (e) {
      var r = e.target.closest(".s4b-slider input[type=range]"); if (!r) return;
      var card = r.closest(".s4b-cfg");
      if (card) {
        var est = card.querySelector("[data-est]"), v = card.querySelector("[data-v]");
        var pct = Number(r.value) / 100;
        if (v) v.textContent = r.value + "%";
        if (est) est.innerHTML = ui.money(Math.round(fin.gross * pct));
      }
    });
    el.addEventListener("click", function (e) {
      var save = e.target.closest('[data-s4b="save-ratio"]');
      if (!save) return;
      var card = save.closest(".s4b-cfg");
      if (!card) return;
      var id = card.getAttribute("data-id");
      var ratio = Number(card.querySelector(".s4b-slider input").value) / 100;
      if (isNaN(ratio) || ratio < V3.store.CONST.ratioMin || ratio > V3.store.CONST.ratioMax) {
        ui.toast("比例需在 0–50% 区间", "err"); return;
      }
      var before = Math.round((((d.subs || []).filter(function (x) { return x.id === id; })[0] || {}).ratioToSub || 0) * 100);
      V3.store.act("sub/setRatio", { id: id, ratio: ratio });
      var after = Math.round(ratio * 100);
      ui.toast("比例已保存 " + before + "% → " + after + "%，测算已联动", "ok");
      V3.router.render();
    });
    wireSegBar(el);
  }

  window.V3PAGES.subs = { title: "二级管理", render: renderSubs, mount: mountSubs };
  window.V3PAGES["share-config"] = { title: "分成配置", render: renderShareConfig, mount: mountShareConfig };
})();
