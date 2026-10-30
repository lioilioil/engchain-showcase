/* ============================================================
   uni-team.js · 团队管理（E069–E070 · v3 UI 重构）
   能力：管理员身份栏（含委托状态） / 成员分组（在职·已停用）/ 搜索（姓名·电话）/
         添加成员（上限 5 人）/ 成员详情弹窗（自下而上 bottom sheet，
         承载详细信息与成员操作）/ 管理员委托（法定代表人可 设为·更换·撤销 管理员委托）/
         经营归账字段（所属渠道码·邀请用户数·名下合格消费金额）/ 权限说明
   角色模型：法定代表人（企业主体，天然持有管理权，不可停用）>
             管理员（法定代表人委托的经营负责人，1 名，可管理团队）> 员工。
             委托持久于本地覆盖层 adminName；未显式委托时默认法定代表人兼任。
   数据：store 场景种子（省代/二级 team）+ 本地覆盖层（engchain-uni-team-v1），
         新增成员、停用状态与管理员委托持久于 localStorage，跨页生效；
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

  /* ---------- 本地覆盖层（新增成员 + 停用状态 + 管理员委托） ---------- */
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

  var ROLE_META = {
    legal: { label: "法定代表人", badge: "uh-badge--gold", av: "tm-avatar--legal", note:
      "企业主体，天然持有经营终审权；可委托、更换或撤销管理员，不可被停用。" },
    admin: { label: "管理员", badge: "uh-badge--info", av: "tm-avatar--admin", note:
      "由法定代表人委托的经营负责人：可添加与停用成员、审批合作、配置比例与月度平账。" },
    staff: { label: "员工", badge: "uh-badge--mute", av: "tm-avatar--staff", note:
      "仅可管理本人渠道码与本人线索；付款登记、合作审批、比例配置、协议与月度平账由管理员或法定代表人操作。" }
  };

  function enrich(m, ctx, disabled, adminName) {
    var st = ownedStats(ctx, m.name);
    var inviteCount = m.leads != null ? m.leads : st.count;
    var rows = [];
    rows.push({ k: "职务", v: m.title || "—" });
    rows.push({ k: "电话", v: m.phone || "—" });
    rows.push({ k: "加入时间", v: m.since || "—" });
    if (m.channel) rows.push({ k: "所属渠道码", v: m.channel });
    rows.push({ k: "邀请用户数", v: inviteCount + " 人" });
    rows.push({ k: "名下合格消费金额", v: ui.money(st.amount) });
    var isAdmin = !m.isLegal && m.name === adminName;
    var roleKey = m.isLegal ? "legal" : (isAdmin ? "admin" : "staff");
    var meta = ROLE_META[roleKey];
    return {
      name: m.name, isLegal: !!m.isLegal, isAdmin: isAdmin, disabled: !!disabled,
      roleKey: roleKey, roleLabel: meta.label, roleBadge: meta.badge, roleAv: meta.av,
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
    var legalName = null;
    list.forEach(function (m) { if (m.isLegal) legalName = m.name; });
    /* 管理员委托：未显式委托时默认法定代表人兼任 */
    var adminName = ov.adminName != null ? ov.adminName : legalName;
    return {
      list: list.map(function (m) { return enrich(m, ctx, !!ov.disabled[m.name], adminName); }),
      adminName: adminName,
      legalName: legalName
    };
  }

  function findMember(model, name) {
    for (var i = 0; i < model.list.length; i++) {
      if (model.list[i].name === name) return model.list[i];
    }
    return null;
  }

  function ownerOf(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].isLegal || list[i].role === "boss" || list[i].role === "admin") return list[i];
    }
    return list[0] || null;
  }

  /* 当前登录者姓名（（我）标记的唯一定义：仅当前身份本人） */
  function loginName(ctx) {
    if (ctx.identity === "staff" || ctx.identity === "sub_staff") return ctx.staffName || "";
    var o = ownerOf(membersModel(ctx).list);
    return o ? o.name : "";
  }

  /* 操作权限判定 */
  function canManage(ctx) {
    if (ctx.readonly) return false;
    if (_V.manage) return true; /* admin / sub_admin 登录 */
    if (ctx.identity === "staff" || ctx.identity === "sub_staff") {
      return loginName(ctx) === membersModel(ctx).adminName; /* 登录员工 = 当前管理员 */
    }
    return false;
  }
  /* 当前操作者是否为法定代表人（唯一可变更管理员委托） */
  function isLegalOperator(ctx, model) {
    return !!model.legalName && loginName(ctx) === model.legalName;
  }

  /* ---------- STATE_VARIANTS（manage = 可添加/停用成员；委托变更另由法人判定） ---------- */
  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      manage: true,
      data: function (ctx) { return membersModel(ctx); },
      lockedNote: "团队信息已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      manage: false,
      data: function (ctx) { return membersModel(ctx); },
      lockedNote: "团队信息已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      manage: true,
      data: function (ctx) { return membersModel(ctx); },
      lockedNote: "合作已暂停，团队信息仍可查阅"
    }
  };

  var _V = null;
  function V() { return _V; }
  var _el = null, _ctx = null, _Uni = null;
  function rerender() { if (_el && _ctx && _Uni) mount(_el, _ctx, _Uni); }

  /* ---------- 管理员身份栏（含委托状态与更换入口） ---------- */
  function ownerCardHtml(owner, ctx, model, manage, legalOp) {
    if (!owner) return "";
    var isMe = ctx.identity === "sub_admin" || (ctx.identity === "admin" && owner.isLegal) || (ctx.identity === "staff" && owner.name === ctx.staffName) || (ctx.identity === "sub_staff" && owner.name === ctx.staffName);
    var sub = (owner.rows && owner.rows[0] ? owner.rows[0].v : "") + " · " + (owner.rows[2] ? owner.rows[2].v : "");
    var admin = findMember(model, model.adminName);
    var delegateTxt = admin
      ? (admin.isLegal
          ? "法定代表人兼任（当前）"
          : ui.esc(admin.name) + " · 管理员（法定代表人委托）")
      : "未设置";
    var chgBtn = legalOp
      ? '<button class="btn btn-ghost btn-sm tm-delegate__btn" data-act="change-admin">' +
        ui.icon("shield", 14) + '<span>更换管理员</span></button>'
      : "";
    return '<section class="uh-sec"><div class="card tm-owner">' +
      '<div class="uh-avatar tm-avatar tm-avatar--legal">' + ui.icon("crown", 20) + '</div>' +
      '<div class="tm-owner__main">' +
      '<div class="tm-owner__nm">' + ui.esc(owner.name) + (isMe ? '<span class="mc-self">（我）</span>' : "") +
      ' <span class="uh-badge uh-badge--gold">法定代表人</span></div>' +
      '<div class="tm-owner__sub">' + ui.esc(sub) + '</div>' +
      '<div class="tm-owner__delegate' + (admin && !admin.isLegal ? " tm-owner__delegate--link" : "") + '"' +
      (admin && !admin.isLegal ? ' data-act="open-member" data-name="' + ui.esc(admin.name) + '"' : "") + '>' +
      '<span class="tm-delegate__k">' + ui.icon("shield", 13) + '管理员委托</span>' +
      '<span class="tm-delegate__v">' + delegateTxt +
      (admin && !admin.isLegal ? ui.icon("chev", 13) : "") + '</span>' +
      '</div>' +
      '</div>' +
      chgBtn +
      '</div></section>';
  }

  /* ---------- 成员摘要卡（点击 → 详情弹窗；在职/停用同模板） ---------- */
  function memberCardHtml(m, ctx) {
    var isMe = m.name === loginName(ctx);
    var av = m.isLegal
      ? ui.icon("crown", 20)
      : (m.isAdmin
          ? ui.icon("shield", 18)
          : '<span class="tm-initial">' + ui.esc(m.initial) + '</span>');
    return '<section class="card tm-card' + (m.disabled ? " tm-off" : "") + '" data-act="open-member" data-name="' + ui.esc(m.name) + '" role="button" tabindex="0">' +
      '<div class="uh-avatar tm-avatar ' + m.roleAv + '">' + av + '</div>' +
      '<div class="tm-card__nm">' + ui.esc(m.name) + (isMe ? '<span class="mc-self">（我）</span>' : "") + '</div>' +
      '<div class="tm-card__tags">' +
      '<span class="uh-badge ' + m.roleBadge + '">' + ui.esc(m.roleLabel) + '</span>' +
      (m.disabled ? '<span class="uh-badge uh-badge--bad">已停用</span>' : '<span class="uh-badge uh-badge--ok">在职</span>') +
      '</div>' +
      '<div class="tm-card__chev">' + ui.icon("chev", 16) + '</div>' +
      '</section>';
  }

  /* ---------- 成员详情弹窗（自下而上 bottom sheet） ---------- */
  function memberSheetBody(m, ctx, model) {
    var kv = m.rows.map(function (r) {
      return '<div class="uh-kv"><span class="k">' + ui.esc(r.k) + '</span><span class="v">' + ui.esc(r.v) + '</span></div>';
    }).join("");
    var brief = (m.rows[0] ? m.rows[0].v : "") + " · " + (m.rows[2] ? m.rows[2].v : "");
    var head =
      '<div class="tm-detail__head">' +
      '<div class="uh-avatar tm-avatar tm-avatar--lg ' + m.roleAv + '">' +
      (m.isLegal ? ui.icon("crown", 24) : (m.isAdmin ? ui.icon("shield", 22) : '<span class="tm-initial">' + ui.esc(m.initial) + '</span>')) +
      '</div>' +
      '<div class="tm-detail__id">' +
      '<div class="tm-detail__nm">' + ui.esc(m.name) +
      '<span class="uh-badge ' + m.roleBadge + '">' + ui.esc(m.roleLabel) + '</span>' +
      (m.disabled ? '<span class="uh-badge uh-badge--bad">已停用</span>' : '<span class="uh-badge uh-badge--ok">在职</span>') +
      '</div>' +
      '<div class="tm-detail__sub">' + ui.esc(brief) + '</div>' +
      '</div></div>';
    var note =
      '<div class="uh-clause"><div class="no">权限说明</div><div class="c">' + ui.esc(ROLE_META[m.roleKey].note) + '</div></div>';
    if (m.isAdmin && !m.isLegal) {
      note += '<div class="uh-clause"><div class="no">委托关系</div><div class="c">由法定代表人 <b>' + ui.esc(model.legalName || "—") +
        '</b> 委托；法定代表人可随时更换或撤销该委托。</div></div>';
    }
    return head + '<div class="tm-detail__kv">' + kv + '</div>' + note;
  }

  /* 弹窗底部固定操作按钮（按身份与权限显隐；danger 在左、primary 在右） */
  function memberActs(m, ctx, model) {
    var manage = canManage(ctx);
    var legalOp = isLegalOperator(ctx, model);
    var items = [];
    if (m.isLegal) return items;
    if (m.disabled) {
      if (manage) items.push({ act: "enable", t: "启用成员", kind: "primary" });
    } else {
      if (legalOp) {
        if (m.isAdmin) {
          items.push({ act: "revoke-admin", t: "撤销管理员委托", kind: "danger" });
          items.push({ act: "change-admin", t: "更换管理员委托", kind: "primary" });
        } else {
          if (manage) items.push({ act: "disable", t: "停用成员", kind: "danger" });
          items.push({ act: "delegate", t: "设为管理员", kind: "primary" });
        }
      } else if (manage) {
        items.push({ act: "disable", t: "停用成员", kind: "danger" });
      }
    }
    return items;
  }

  function openMemberSheet(ctx, Uni, name) {
    var model = membersModel(ctx);
    var m = findMember(model, name);
    if (!m) return;
    var body = memberSheetBody(m, ctx, model);
    var ft = memberActs(m, ctx, model).map(function (it) {
      return {
        t: it.t, kind: it.kind,
        onClick: function (sh) { sh.close(); handleMemberAct(it.act, ctx, Uni, name); return false; }
      };
    });
    var sh = Uni.sheet({ title: "成员详情", body: body, footer: ft });
  }

  function handleMemberAct(act, ctx, Uni, name) {
    if (act === "delegate") delegateTo(ctx, Uni, name);
    else if (act === "change-admin") openChangeAdmin(ctx, Uni);
    else if (act === "revoke-admin") revokeAdmin(ctx, Uni, name);
    else if (act === "disable") confirmToggle(ctx, Uni, name, true);
    else if (act === "enable") confirmToggle(ctx, Uni, name, false);
  }

  /* ---------- 管理员委托流程（仅法定代表人） ---------- */
  function delegateTo(ctx, Uni, name) {
    var model = membersModel(ctx);
    var cur = findMember(model, model.adminName);
    var curTxt = cur
      ? (cur.isLegal ? "法定代表人兼任" : "成员「" + cur.name + "」")
      : "未设置";
    Uni.center({
      title: "设为管理员",
      body:
        '<div class="uh-clause"><div class="c">将 <b>' + ui.esc(name) + '</b> 设为管理员后，其将获得团队管理与经营终审权限。' +
        '当前管理员为 ' + ui.esc(curTxt) + '，确认后自动卸任为员工。</div></div>',
      footer: [
        { t: "取消", kind: "ghost", onClick: function (ov) { ov.close(); } },
        {
          t: "确认委托", kind: "primary",
          onClick: function (ov) {
            var o = loadOverride();
            o.adminName = name;
            saveOverride(o);
            Uni.toast("已委托 " + name + " 为管理员", "ok");
            ov.close();
            rerender();
            return true;
          }
        }
      ]
    });
  }

  function openChangeAdmin(ctx, Uni) {
    var model = membersModel(ctx);
    var candidates = model.list.filter(function (m) { return !m.isLegal && !m.disabled; });
    if (!candidates.length) { Uni.toast("暂无可委托的在职成员", "err"); return; }
    var picked = "";
    var rows = candidates.map(function (m) {
      return '<button type="button" class="tm-pick" data-pick="' + ui.esc(m.name) + '">' +
        '<div class="uh-avatar tm-avatar ' + m.roleAv + '">' + (m.isAdmin ? ui.icon("shield", 18) : '<span class="tm-initial">' + ui.esc(m.initial) + '</span>') + '</div>' +
        '<div class="tm-pick__main">' +
        '<div class="tm-pick__nm">' + ui.esc(m.name) + '</div>' +
        '<div class="tm-pick__sub">' + ui.esc(m.rows[0] ? m.rows[0].v : "") + ' · ' + ui.esc(m.rows[2] ? m.rows[2].v : "") + '</div>' +
        '</div>' +
        '<span class="tm-pick__radio"></span>' +
        '</button>';
    }).join("");
    var body =
      '<div class="uh-eyebrow">选择新的管理员（在职成员）</div>' +
      '<div class="tm-picklist">' + rows + '</div>' +
      '<div class="uh-readnote">' + ui.icon("info", 15) +
      '<span>确认后原管理员自动卸任为员工；法定代表人兼任时由新管理员接任。</span></div>';
    var sh = Uni.sheet({
      title: "更换管理员委托",
      body: body,
      footer: [
        { t: "取消", kind: "ghost", onClick: function (s) { s.close(); } },
        {
          t: "确认更换", kind: "primary",
          onClick: function (s) {
            if (!picked) { Uni.toast("请选择新的管理员", "err"); return false; }
            var o = loadOverride();
            o.adminName = picked;
            saveOverride(o);
            Uni.toast("管理员已更换为 " + picked, "ok");
            s.close();
            rerender();
            return true;
          }
        }
      ]
    });
    Array.prototype.forEach.call(sh.querySelectorAll("[data-pick]"), function (row) {
      row.addEventListener("click", function () {
        picked = this.getAttribute("data-pick");
        Array.prototype.forEach.call(sh.querySelectorAll("[data-pick]"), function (r) {
          r.classList.toggle("tm-pick--on", r === this);
        }, this);
      });
    });
  }

  function revokeAdmin(ctx, Uni, name) {
    var model = membersModel(ctx);
    Uni.center({
      title: "撤销管理员委托",
      body:
        '<div class="uh-clause"><div class="c">撤销后 <b>' + ui.esc(name) + '</b> 回到员工身份，' +
        '经营终审与团队管理权回归法定代表人 <b>' + ui.esc(model.legalName || "—") + '</b>。</div></div>',
      footer: [
        { t: "取消", kind: "ghost", onClick: function (ov) { ov.close(); } },
        {
          t: "确认撤销", kind: "danger",
          onClick: function (ov) {
            var o = loadOverride();
            o.adminName = model.legalName;
            saveOverride(o);
            Uni.toast("已撤销管理员委托", "ok");
            ov.close();
            rerender();
            return true;
          }
        }
      ]
    });
  }

  /* ---------- 列表区 HTML（成员 + 已停用 + 说明；搜索时局部重建） ---------- */
  function listHtml(model, ctx, manage) {
    var q = searchKw().trim().toLowerCase();
    var filtered = q ? model.list.filter(function (m) {
      return m.name.toLowerCase().indexOf(q) > -1 || String(m.rows[1] ? m.rows[1].v : "").toLowerCase().indexOf(q) > -1;
    }) : model.list;
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
      '<div class="uh-clause"><div class="c">法定代表人可委托一名在职成员为管理员（经营终审），并可随时更换或撤销委托；管理员可添加与停用成员。</div>' +
      '<div class="c">员工仅可管理本人渠道码与本人线索；付款登记、合作审批、比例配置、协议与月度平账仅管理员或法定代表人可操作。</div>' +
      '<div class="c">停用成员后，其名下渠道码与线索冻结、不计入团队业绩，启用后恢复。</div></div>' +
      (manage ? '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>团队成员上限 ' + TEAM_LIMIT + ' 人，成员新增后自动持久保存。</span></div>' : '') +
      '</div></section>';
    return h;
  }

  /* ---------- 唯一渲染路径 ---------- */
  function mount(el, ctx, Uni) {
    _V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    _el = el; _ctx = ctx; _Uni = Uni;
    var model = _V.data(ctx);
    var owner = ownerOf(model.list);
    var manage = canManage(ctx);
    var legalOp = isLegalOperator(ctx, model);

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(_V.lockedNote) + '</span></div></div></section>';
    }
    html += ownerCardHtml(owner, ctx, model, manage, legalOp);

    html += '<section class="uh-sec"><div class="tm-tools">' +
      '<div class="tm-search">' + ui.icon("search", 16) +
      '<input id="tm-search-input" placeholder="搜索成员姓名 / 电话"></div>' +
      (manage ? '<button class="btn btn-primary btn-sm tm-add" data-act="add">' + ui.icon("plus", 16) + '添加成员</button>' : "") +
      '</div></section>';

    html += '<div id="tm-list">' + listHtml(model, ctx, manage) + '</div>';

    el.innerHTML = html;
    bindEvents(el, ctx, Uni, model, legalOp);
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents(el, ctx, Uni, model, legalOp) {
    var inp = el.querySelector("#tm-search-input");
    if (inp) {
      inp.value = searchKw();
      inp.addEventListener("input", function () {
        setSearchKw(this.value);
        var l = document.getElementById("tm-list");
        if (l) { l.innerHTML = listHtml(membersModel(ctx), ctx, canManage(ctx)); bindListEvents(l, ctx, Uni); }
      });
    }
    var addBtn = el.querySelector("[data-act='add']");
    if (addBtn) addBtn.addEventListener("click", function () { openAddSheet(ctx, Uni); });
    var chgBtn = el.querySelector("[data-act='change-admin']");
    if (chgBtn) chgBtn.addEventListener("click", function () { openChangeAdmin(ctx, Uni); });
    bindListEvents(el, ctx, Uni);
  }
  function bindListEvents(root, ctx, Uni) {
    root.querySelectorAll("[data-act='open-member']").forEach(function (n) {
      function open() { openMemberSheet(ctx, Uni, n.getAttribute("data-name")); }
      n.addEventListener("click", open);
      n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  /* ---------- 添加成员（管理权持有者） ---------- */
  function openAddSheet(ctx, Uni) {
    var total = membersModel(ctx).list.length;
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
        '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>新增成员默认为员工角色：仅可管理本人渠道与线索，经营终审权由法定代表人及其委托的管理员持有。</span></div>',
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
            if (membersModel(ctx).list.length + 1 > TEAM_LIMIT) { Uni.toast("成员数已达上限 " + TEAM_LIMIT + " 人", "err"); return false; }
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

  /* ---------- 停用 / 启用（管理权持有者；停用管理员自动解除委托） ---------- */
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
            if (toDisable) {
              ov.disabled[name] = true;
              /* 停用的若是当前管理员，自动解除委托并回归法定代表人 */
              var model = membersModel(ctx);
              if (ov.adminName === name && model.legalName) ov.adminName = model.legalName;
            } else {
              delete ov.disabled[name];
            }
            saveOverride(ov);
            Uni.toast(toDisable ? "已停用：" + name : "已启用：" + name, "ok");
            ov2.close();
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
