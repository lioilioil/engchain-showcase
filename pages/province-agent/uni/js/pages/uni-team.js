/* ============================================================
   uni-team.js · 团队管理（E069–E070 · v2 功能增强）
   能力：管理员身份栏 / 成员分组（在职·已停用）/ 搜索（姓名·电话）/
         添加成员（上限 5 人）/ 停用·启用（负责人可操作，员工只读）/
         经营归账字段（所属渠道码·邀请用户数·名下合格消费金额）/ 权限说明
   数据：store 场景种子（省代/二级 team）+ 本地覆盖层（engchain-uni-team-v1），
         新增成员与停用状态持久于 localStorage，跨页生效；
         二级场景补团队种子后与省代同构（旧数据无 team 时折算负责人单人团队）。
   组件视觉全部为系统类（.card/.btn/.sheet/.cert-modal）；内容基元（uh-）来自 uni-layout.css。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var TEAM_LIMIT = 5;
  var OVERRIDE_KEY = "engchain-uni-team-v1";
  var KW_KEY = "engchain-uni-team-kw";

  /* ---------- 本地覆盖层（新增成员 + 停用状态） ---------- */
  function loadOverride() {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY)) || { added: [], disabled: {} }; }
    catch (e) { return { added: [], disabled: {} }; }
  }
  function saveOverride(o) {
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function searchKw() {
    try { return localStorage.getItem(KW_KEY) || ""; } catch (e) { return ""; }
  }
  function setSearchKw(k) {
    try { localStorage.setItem(KW_KEY, k); } catch (e) {}
  }

  /* 名下线索统计（员工归账口径：只数本人 owner 线索） */
  function ownedStats(ctx, name) {
    var leads = ctx.s.leads || {};
    var count = 0, amount = 0;
    Object.keys(leads).forEach(function (ch) {
      (leads[ch] || []).forEach(function (l) {
        if (l.owner === name) {
          count++;
          if (l.stage === "paid" || l.stage === "repaid") amount += l.amount || 0;
        }
      });
    });
    return { count: count, amount: amount };
  }

  function enrich(m, ctx, disabled) {
    var st = ownedStats(ctx, m.name);
    var inviteCount = m.leads != null ? m.leads : st.count;
    var rows = [];
    rows.push({ k: "职务", v: m.title || "—" });
    rows.push({ k: "电话", v: m.phone || "—" });
    rows.push({ k: "加入时间", v: m.since || "—" });
    if (m.channel) rows.push({ k: "所属渠道码", v: m.channel });
    rows.push({ k: "邀请用户数", v: inviteCount + " 人" });
    rows.push({ k: "名下合格消费金额", v: ui.money(st.amount) });
    return {
      name: m.name, isLegal: !!m.isLegal, disabled: !!disabled,
      badge: m.isLegal ? "法人" : "员工",
      initial: (m.name || "?").slice(0, 1),
      rows: rows
    };
  }

  function membersModel(ctx) {
    var base = ctx.s.team || [];
    /* 兼容旧二级数据（无 team 种子时折算负责人单人团队） */
    if (ctx.mode === "sub" && !base.length && ctx.s.profile) {
      base = [{
        name: ctx.s.profile.contact || "负责人",
        role: "admin",
        title: ctx.s.profile.legalPerson ? "法定代表人" : "负责人",
        phone: ctx.s.profile.phone,
        since: ctx.s.parent ? ctx.s.parent.since : ctx.s.profile.since,
        isLegal: true, channel: ""
      }];
    }
    var ov = loadOverride();
    var list = base.concat(ov.added.map(function (a) {
      return {
        name: a.name, role: "staff", title: a.title || "渠道专员",
        phone: a.phone || "—", since: a.since, leads: 0, isLegal: false, channel: ""
      };
    }));
    return list.map(function (m) { return enrich(m, ctx, !!ov.disabled[m.name]); });
  }

  function ownerOf(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].isLegal || list[i].role === "boss" || list[i].role === "admin") return list[i];
    }
    return list[0] || null;
  }

  /* 当前登录者姓名（（我）标记的唯一定义：仅当前身份本人） */
  function loginName(ctx) {
    if (ctx.identity === "staff") return ctx.staffName || "";
    var o = ownerOf(membersModel(ctx));
    return o ? o.name : "";
  }

  /* ---------- STATE_VARIANTS（manage = 可添加/停用成员） ---------- */
  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      manage: true,
      data: function (ctx) { return { members: membersModel(ctx) }; },
      lockedNote: "团队信息已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      manage: false,
      data: function (ctx) { return { members: membersModel(ctx) }; },
      lockedNote: "团队信息已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      manage: true,
      data: function (ctx) { return { members: membersModel(ctx) }; },
      lockedNote: "合作已暂停，团队信息仍可查阅"
    }
  };

  var _V = null;
  function V() { return _V; }
  var _el = null, _ctx = null, _Uni = null;
  function rerender() { if (_el && _ctx && _Uni) mount(_el, _ctx, _Uni); }

  /* ---------- 管理员身份栏 ---------- */
  function ownerCardHtml(owner, ctx) {
    if (!owner) return "";
    var isMe = ctx.identity === "sub_admin" || (ctx.identity === "admin" && owner.isLegal) || (ctx.identity === "staff" && owner.name === ctx.staffName);
    var sub = (owner.rows && owner.rows[0] ? owner.rows[0].v : "") + " · " + (owner.rows[2] ? owner.rows[2].v : "");
    return '<section class="uh-sec"><div class="card tm-owner">' +
      '<div class="uh-avatar tm-avatar tm-avatar--legal">' + ui.icon("crown", 20) + '</div>' +
      '<div class="tm-owner__main">' +
      '<div class="tm-owner__nm">' + ui.esc(owner.name) + (isMe ? '<span class="mc-self">（我）</span>' : "") +
      ' <span class="uh-badge uh-badge--gold">' + ui.esc(owner.badge) + '</span></div>' +
      '<div class="tm-owner__sub">' + ui.esc(sub) + '</div>' +
      '</div>' +
      '<div class="uh-badge uh-badge--mute">企业主体</div>' +
      '</div></section>';
  }

  /* ---------- 成员卡（在职/停用同模板，操作按权限显隐） ---------- */
  function memberCardHtml(m, ctx) {
    var isMe = m.name === loginName(ctx);
    var rows = m.rows.map(function (r) {
      return '<div class="uh-kv' + (m.disabled ? " tm-off-row" : "") + '"><span class="k">' + ui.esc(r.k) + '</span><span class="v">' + ui.esc(r.v) + '</span></div>';
    }).join("");
    var av = m.isLegal
      ? ui.icon("crown", 20)
      : '<span class="tm-initial">' + ui.esc(m.initial) + '</span>';
    var acts = "";
    if (V().manage && !ctx.readonly && !m.isLegal) {
      acts = m.disabled
        ? '<button class="btn btn-ghost btn-sm tm-act" data-act="enable" data-name="' + ui.esc(m.name) + '">启用</button>'
        : '<button class="btn btn-ghost btn-sm tm-act" data-act="disable" data-name="' + ui.esc(m.name) + '" style="color:var(--error)">停用</button>';
    }
    return '<section class="card uh-sec tm-card' + (m.disabled ? " tm-off" : "") + '">' +
      '<div class="tm-card__hd">' +
      '<div class="uh-avatar tm-avatar' + (m.isLegal ? " tm-avatar--legal" : "") + '">' + av + '</div>' +
      '<div class="tm-card__nm">' + ui.esc(m.name) + (isMe ? '<span class="mc-self">（我）</span>' : "") + '</div>' +
      '<span class="uh-badge uh-badge--gold">' + ui.esc(m.badge) + '</span>' +
      (m.disabled ? '<span class="uh-badge uh-badge--bad">已停用</span>' : '<span class="uh-badge uh-badge--ok">在职</span>') +
      '</div>' + rows +
      (acts ? '<div class="tm-card__acts">' + acts + '</div>' : "") +
      '</section>';
  }

  /* ---------- 列表区 HTML（成员 + 已停用 + 说明；搜索时局部重建） ---------- */
  function listHtml(members, ctx, manage) {
    var q = searchKw().trim().toLowerCase();
    var filtered = q ? members.filter(function (m) {
      return m.name.toLowerCase().indexOf(q) > -1 || String(m.rows[1] ? m.rows[1].v : "").toLowerCase().indexOf(q) > -1;
    }) : members;
    var on = filtered.filter(function (m) { return !m.disabled; });
    var off = filtered.filter(function (m) { return m.disabled; });
    var h = "";
    h += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">成员</span>' +
      '<span class="uh-badge uh-badge--mute">' + on.length + ' 人</span></div>' +
      (on.length ? on.map(function (m) { return memberCardHtml(m, ctx); }).join("") :
        '<div class="card" style="padding:18px 14px"><div class="uh-readnote">' + ui.icon("users", 15) +
        '<span>' + (q ? "没有匹配的在职成员" : "暂无在职成员") + '</span></div></div>') +
      '</section>';
    if (off.length) {
      h += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">已停用</span>' +
        '<span class="uh-badge uh-badge--mute">' + off.length + ' 人</span></div>' +
        off.map(function (m) { return memberCardHtml(m, ctx); }).join("") + '</section>';
    }
    h += '<section class="uh-sec"><div class="card">' +
      '<div class="uh-finhead" style="margin-bottom:4px"><span class="uh-eyebrow">成员管理说明</span></div>' +
      '<div class="uh-clause"><div class="c">员工仅可管理本人渠道码与本人线索；付款登记、合作审批、比例配置、协议与月度平账仅管理员可操作。</div>' +
      '<div class="c">停用成员后，其名下渠道码与线索冻结、不计入团队业绩，启用后恢复。</div></div>' +
      (manage ? '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>团队成员上限 ' + TEAM_LIMIT + ' 人，成员新增后自动持久保存。</span></div>' : '') +
      '</div></section>';
    return h;
  }

  /* ---------- 唯一渲染路径 ---------- */
  function mount(el, ctx, Uni) {
    _V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    _el = el; _ctx = ctx; _Uni = Uni;
    var members = _V.data(ctx).members;
    var owner = ownerOf(members);
    var manage = _V.manage && !ctx.readonly;

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(_V.lockedNote) + '</span></div></div></section>';
    }
    html += ownerCardHtml(owner, ctx);

    html += '<section class="uh-sec"><div class="tm-tools">' +
      '<div class="tm-search">' + ui.icon("search", 16) +
      '<input id="tm-search-input" placeholder="搜索成员姓名 / 电话"></div>' +
      (manage ? '<button class="btn btn-primary btn-sm tm-add" data-act="add">' + ui.icon("plus", 16) + '添加成员</button>' : "") +
      '</div></section>';

    html += '<div id="tm-list">' + listHtml(members, ctx, manage) + '</div>';

    el.innerHTML = html;
    bindEvents(el, ctx, Uni);
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents(el, ctx, Uni) {
    var inp = el.querySelector("#tm-search-input");
    if (inp) {
      inp.value = searchKw();
      inp.addEventListener("input", function () {
        setSearchKw(this.value);
        var l = document.getElementById("tm-list");
        if (l) { l.innerHTML = listHtml(membersModel(ctx), ctx, _V.manage && !ctx.readonly); bindListEvents(l, ctx, Uni); }
      });
    }
    var addBtn = el.querySelector("[data-act='add']");
    if (addBtn) addBtn.addEventListener("click", function () { openAddSheet(ctx, Uni); });
    bindListEvents(el, ctx, Uni);
  }
  function bindListEvents(root, ctx, Uni) {
    root.querySelectorAll("[data-act='disable']").forEach(function (n) {
      n.addEventListener("click", function () { confirmToggle(ctx, Uni, n.getAttribute("data-name"), true); });
    });
    root.querySelectorAll("[data-act='enable']").forEach(function (n) {
      n.addEventListener("click", function () { confirmToggle(ctx, Uni, n.getAttribute("data-name"), false); });
    });
  }

  /* ---------- 添加成员（负责人） ---------- */
  function openAddSheet(ctx, Uni) {
    var total = membersModel(ctx).length;
    if (total >= TEAM_LIMIT) { Uni.toast("成员数已达上限 " + TEAM_LIMIT + " 人", "err"); return; }
    Uni.sheet({
      title: "添加成员",
      body:
        '<div class="field"><label class="field-label">姓名<span class="req">*</span></label>' +
        '<input class="input" id="tm-name" maxlength="12" placeholder="请输入成员姓名"></div>' +
        '<div class="field"><label class="field-label">手机号<span class="req">*</span></label>' +
        '<input class="input" id="tm-mobile" type="tel" inputmode="numeric" maxlength="11" placeholder="输入 11 位手机号"></div>' +
        '<div class="field"><label class="field-label">职务</label>' +
        '<input class="input" id="tm-title" maxlength="12" placeholder="如：渠道专员"></div>' +
        '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>新增成员默认为员工角色：仅可管理本人渠道与线索，经营终审权仅负责人。</span></div>',
      footer: [
        { t: "取消", kind: "ghost", onClick: function (sh) { sh.close(); } },
        {
          t: "添加", kind: "primary",
          onClick: function (sh) {
            var name = ((sh.querySelector("#tm-name") || {}).value || "").trim();
            var mob = ((sh.querySelector("#tm-mobile") || {}).value || "").trim();
            var title = ((sh.querySelector("#tm-title") || {}).value || "").trim() || "渠道专员";
            if (!name) { Uni.toast("请输入成员姓名", "err"); return false; }
            if (!/^1\d{10}$/.test(mob)) { Uni.toast("请输入 11 位有效手机号", "err"); return false; }
            var ov = loadOverride();
            if (membersModel(ctx).length + 1 > TEAM_LIMIT) { Uni.toast("成员数已达上限 " + TEAM_LIMIT + " 人", "err"); return false; }
            var d = new Date();
            ov.added.push({
              name: name, phone: mob, title: title,
              since: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
            });
            saveOverride(ov);
            Uni.toast("已添加成员：" + name, "ok");
            rerender();
            return true;
          }
        }
      ]
    });
  }

  /* ---------- 停用 / 启用（负责人，居中确认弹窗） ---------- */
  function confirmToggle(ctx, Uni, name, toDisable) {
    var ov = loadOverride();
    Uni.center({
      title: toDisable ? "停用成员" : "启用成员",
      body:
        '<div class="uh-clause"><div class="c">' +
        (toDisable
          ? '停用 <b>' + ui.esc(name) + '</b> 后，其名下渠道码与线索冻结、不计入团队业绩；可随时启用恢复。'
          : '确认启用 <b>' + ui.esc(name) + '</b>？启用后其名下渠道码与线索恢复计入。') +
        '</div></div>',
      footer: [
        { t: "取消", kind: "ghost", onClick: function (ov2) { ov2.close(); } },
        {
          t: toDisable ? "停用" : "启用", kind: toDisable ? "danger" : "primary",
          onClick: function (ov2) {
            if (toDisable) ov.disabled[name] = true; else delete ov.disabled[name];
            saveOverride(ov);
            Uni.toast(toDisable ? "已停用：" + name : "已启用：" + name, "ok");
            rerender();
            return true;
          }
        }
      ]
    });
  }

  window.Uni.register({
    view: "uni-team",
    route: "team.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
