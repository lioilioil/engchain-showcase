/* ============================================================
   uni-share-config.js · 约定比例配置（E034–E035）
   两段同一模板：比例卡列表 → 比例变更记录（ratioLog 最近 8 条）。
   身份差异全部落在 V.data() / V.perms / V.empty（S1/S2）。
   组件视觉全部为系统类（.card/.btn…）；内容基元（uh-）来自 css/uni-layout.css。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var BY_NAME = { boss: "管理员", staff: "员工" };

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        return {
          cards: s.subs.filter(function (p) { return p.status === "active"; }),
          log: (s.ratioLog || []).slice(0, 8),
          note: null
        };
      },
      entries: [],
      perms: { adjust: true },
      badges: {},
      empty: {
        cards: { title: "暂无生效中合作", desc: "审批通过的二级合作将在这里配置约定比例" },
        log: { title: "暂无比例变更记录", desc: "调整约定比例后将在这里留痕" }
      },
      lockedNote: "比例配置与变更记录均已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s;
        return {
          cards: s.subs.filter(function (p) { return p.status === "active"; }),
          log: (s.ratioLog || []).slice(0, 8),
          note: "约定比例调整仅管理员可操作；比例档案与变更记录仅可查看。"
        };
      },
      entries: [],
      perms: { adjust: false },
      badges: {},
      empty: {
        cards: { title: "暂无生效中合作", desc: "审批通过的二级合作将在这里配置约定比例" },
        log: { title: "暂无比例变更记录", desc: "调整约定比例后将在这里留痕" }
      },
      lockedNote: "比例档案已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var s = ctx.s, p = s.parent || {};
        /* 同一模板换源：比例卡 = 我与上级省代的约定比例（只读） */
        return {
          cards: [{
            id: "archive",
            name: p.name ? p.name.replace(/（.*）/, "") : s.profile.name,
            since: p.since || s.profile.since,
            ratioToSub: p.ratioToSub != null ? p.ratioToSub : 0
          }],
          log: (s.ratioLog || []).slice(0, 8),
          note: "约定比例由上级省代配置，本端为只读状态；如需调整请与上级省代沟通。"
        };
      },
      entries: [],
      perms: { adjust: false },
      badges: {},
      empty: {
        cards: { title: "暂无约定比例档案", desc: "合作生效后与上级省代的约定比例将出现在这里" },
        log: { title: "暂无比例变更记录", desc: "上级省代调整比例后将在这里留痕" }
      },
      lockedNote: "合作已暂停，比例档案仍可查阅"
    }
  };

  /* 输入框页内样式（仅引用系统令牌；系统组件库无输入框组件，保持与全组一致） */
  var FIELD_STYLE = "width:100%;box-sizing:border-box;padding:11px 12px;border-radius:var(--r-m);" +
    "border:1px solid var(--line);background:var(--bg-card);color:var(--text-1);" +
    "font-size:var(--fs-base);font-family:inherit";

  /* ---------- 比例卡（系统 .card + uh- 基元；按钮按 perms/readonly 渲染） ---------- */
  function ratioCard(p, V, ro) {
    var act = (!V.perms.adjust || ro) ? "" :
      '<div class="sc-card__ft"><button class="btn btn-ghost btn-sm" data-act="ratio" data-id="' + ui.esc(p.id) + '">调整比例</button></div>';
    return '<section class="card uh-sec sc-card">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">合作企业</span>' +
      '<span class="uh-badge uh-badge--ok">生效中</span></div>' +
      '<div class="sc-card__nm">' + ui.esc(p.name) + '</div>' +
      '<div class="sc-num">' + Math.round(p.ratioToSub * 100) + '<span class="cur">%</span></div>' +
      '<div class="uh-ledgerline"></div>' +
      '<div class="uh-kv"><span class="k">合作自</span><span class="v">' + ui.esc(p.since) + '</span></div>' +
      act + '</section>';
  }

  /* ---------- 变更记录行（uh-list 通用行） ---------- */
  function logRow(r) {
    var by = BY_NAME[r.by] || "管理员";
    return '<div class="uh-row">' +
      '<span class="uh-row__ic">' + ui.icon("history", 18) + '</span>' +
      '<span class="uh-row__main"><span class="uh-row__t">' + ui.esc(r.sub) + '</span>' +
      '<span class="uh-row__s">' + Math.round((r.from || 0) * 100) + '% → ' + Math.round(r.to * 100) + '% · ' +
      ui.esc(r.note || "") + '<span class="time">' + ui.esc(by) + ' · ' + ui.esc(r.at || "") + '</span></span>' +
      '<span class="uh-badge uh-badge--mute">调整</span></div>';
  }

  /* ---------- 弹窗：调整比例（系统 .sheet） ---------- */
  function ratioSheet(p, Uni) {
    var cur = Math.round(p.ratioToSub * 100);
    Uni.sheet({
      title: "调整约定比例",
      body:
        '<div class="uh-sheetkv"><span class="k">合作企业</span><span class="v">' + ui.esc(p.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">当前比例</span><span class="v">' + cur + '%</span></div>' +
        '<div style="height:12px"></div>' +
        '<div style="font-size:var(--fs-sm);color:var(--text-3);margin-bottom:6px">新约定比例（0–50%）</div>' +
        '<input type="number" id="sc-newratio" min="0" max="50" value="' + cur + '" style="' + FIELD_STYLE + '">' +
        '<div class="uh-readnote" style="margin-top:10px">' + ui.icon("info", 15) +
        '<span>变更后需与二级补签合作协议，将生成一条待办。</span></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认变更", kind: "primary", onClick: function (ov) {
        var v = Number(ov.querySelector("#sc-newratio").value);
        if (isNaN(v) || v < 0 || v > 50) { Uni.toast("约定比例须在 0–50% 之间"); return false; }
        var r = Uni.actGuarded("sub/setRatio", { id: p.id, ratio: v / 100, from: p.ratioToSub });
        if (r.ok) Uni.toast("比例已变更，待补签协议", "ok");
      } }]
    });
  }

  /* 唯一渲染路径：全页仅这一个身份取值行 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var cardsHtml = vm.cards.length
      ? vm.cards.map(function (p) { return ratioCard(p, V, ctx.readonly); }).join("")
      : '<section class="uh-sec">' + Uni.emptyHtml(V.empty.cards.title, V.empty.cards.desc, "badge") + '</section>';
    var logHtml = vm.log.length
      ? '<div class="uh-list">' + vm.log.map(logRow).join("") + '</div>'
      : '<section class="uh-sec">' + Uni.emptyHtml(V.empty.log.title, V.empty.log.desc, "tray") + '</section>';

    el.innerHTML =
      (ctx.readonly
        ? '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
          '<span class="lb-s">' + ui.esc(V.lockedNote) + '</span></div></div></section>'
        : "") +
      (vm.note
        ? '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) +
          '<span>' + ui.esc(vm.note) + '</span></div></section>'
        : "") +
      '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">约定比例</span>' +
      (vm.cards.length ? '<span class="uh-badge uh-badge--mute">生效 ' + vm.cards.length + ' 家</span>' : "") +
      '</div>' + cardsHtml + '</section>' +
      '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">比例变更记录</span>' +
      (vm.log.length ? '<span class="uh-badge uh-badge--mute">近 ' + vm.log.length + ' 条</span>' : "") +
      '</div>' + logHtml + '</section>';

    var subs = {};
    (ctx.s.subs || []).forEach(function (p) { subs[p.id] = p; });
    el.querySelectorAll('[data-act="ratio"]').forEach(function (n) {
      n.addEventListener("click", function () {
        var p = subs[n.getAttribute("data-id")];
        if (p) ratioSheet(p, Uni);
      });
    });
  }

  window.Uni.register({
    view: "uni-share-config",
    route: "share-config.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
