/* ============================================================
   uni-subs.js · 二级合作管理（E024–E033）
   顶部胶囊 tab（生效中/待审批/已驳回，样式同「会话列表-会话/消息」）；
   生效中合作卡：协议状态化操作（已签→查看协议 / 待签·拒签→重发协议）
   + 约定比例；详情弹窗承载合作管理（对账单/操作记录/暂停/恢复/终止）。
   身份差异全部落在 V.data() / V.perms / V.empty（S1/S2）。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var REJECT_QUICK = ["资质不符", "经营范围不符", "信息填写有误"];
  var AG_STATE = { signed: { t: "已签署", cls: "ok" }, pending: { t: "待对方签署", cls: "wait" }, rejected: { t: "已拒签", cls: "bad" } };

  /* ---------- 招商申请跨端覆盖层（M4：用户端 apply 页写入，工作台合并展示与审批） ---------- */
  var SUB_APPS_KEY = "engchain-sub-apps";
  var SUB_ACTIVE_KEY = "engchain-sub-active";
  function readKey(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function writeKey(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function mergedSubApps(s) {
    var base = (s.subApps || []).slice();
    readKey(SUB_APPS_KEY).forEach(function (a) {
      if (!base.some(function (x) { return x.id === a.id; })) base.push(a);
    });
    return base;
  }
  function mergedActive(s) {
    return (s.subs || []).concat(readKey(SUB_ACTIVE_KEY));
  }
  /* 审批同步：更新跨端申请状态；通过时生成生效子企业档案 */
  function applyReview(appId, pass, reason) {
    var list = readKey(SUB_APPS_KEY), hit = null;
    list.forEach(function (a) {
      if (a.id === appId) { a.status = pass ? "approved" : "rejected"; if (!pass) a.rejectReason = reason; hit = a; }
    });
    if (hit) writeKey(SUB_APPS_KEY, list);
    if (pass && hit) {
      var act = readKey(SUB_ACTIVE_KEY);
      var now = new Date(), pad = function (n) { return n < 10 ? "0" + n : "" + n; };
      act.push({
        id: "sub-" + String(appId).replace(/^app-apply-/, "apply"),
        name: hit.name, uscc: hit.uscc, contact: hit.contact, phone: hit.phone,
        address: hit.address || "",
        ratioToSub: hit.ratio != null ? hit.ratio : 0.2,
        since: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()),
        status: "active", channel: "agent", source: "apply",
        agreement: { state: "pending" }
      });
      writeKey(SUB_ACTIVE_KEY, act);
    }
  }

  /* 多选批量状态（文件级：批量弹窗与 mount 共享）+ 当前 tab */
  var _multi = false, _sel = {}, _rerender = null, _tab = "active";

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        var apps = mergedSubApps(s); /* M4：合并跨端招商申请 */
        return {
          subtitle: "合作申请、生效主体与约定比例配置",
          pending: apps.filter(function (a) { return a.status === "pending"; }),
          active: mergedActive(s).filter(function (a) { return a.status === "active" || a.status === "suspended"; }),
          rejected: apps.filter(function (a) { return a.status === "rejected"; }),
          note: null
        };
      },
      entries: [],
      perms: { createApp: true, review: true, setRatio: true, resend: true, status: true },
      badges: {},
      empty: {
        pending: { title: "暂无待审批申请", desc: "新的二级合作申请提交后将出现在这里" },
        active: { title: "暂无生效中合作", desc: "审批通过的二级合作将在这里建立档案" },
        rejected: { title: "暂无已驳回申请", desc: "被驳回的合作申请将留痕在这里" }
      },
      lockedNote: "审批、比例配置与协议操作均已锁定"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s;
        var apps = mergedSubApps(s); /* M4：合并跨端招商申请 */
        return {
          subtitle: "合作申请、生效主体与约定比例配置",
          pending: apps.filter(function (a) { return a.status === "pending"; }),
          active: mergedActive(s).filter(function (a) { return a.status === "active" || a.status === "suspended"; }),
          rejected: apps.filter(function (a) { return a.status === "rejected"; }),
          note: "审批、发起合作与比例配置仅管理员可操作；列表数据仅可查看。"
        };
      },
      entries: [],
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false },
      badges: {},
      empty: {
        pending: { title: "暂无待审批申请", desc: "新的二级合作申请提交后将出现在这里" },
        active: { title: "暂无生效中合作", desc: "审批通过的二级合作将在这里建立档案" },
        rejected: { title: "暂无已驳回申请", desc: "被驳回的合作申请将留痕在这里" }
      },
      lockedNote: "合作管理动作已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        var p = s.parent || {};
        return {
          subtitle: "我的合作档案：与上级总代的合作信息（只读状态）",
          pending: [],
          active: [{
            id: "archive",
            name: p.name ? p.name.replace(/（.*）/, "") : "—",
            uscc: p.uscc || s.profile.uscc,
            contact: p.contact || "",
            phone: p.phone || "",
            address: p.address || "",
            ratioToSub: p.ratioToSub != null ? p.ratioToSub : 0,
            since: p.since || s.profile.since,
            status: "active",
            agreement: { state: "signed" }
          }],
          rejected: [],
          note: "合作档案为只读口径：约定比例由上级省代配置，协议事项请与上级省代沟通。"
        };
      },
      entries: [],
      perms: { createApp: false, review: false, setRatio: false, resend: false, status: false },
      badges: {},
      empty: {
        pending: { title: "暂无合作申请", desc: "你与上级总代之间没有待审批的申请记录" },
        active: { title: "暂无合作档案", desc: "合作生效后档案将出现在这里" },
        rejected: { title: "无已驳回记录", desc: "你与上级总代之间没有被驳回的申请记录" }
      },
      lockedNote: "合作已暂停，档案仍可查阅，联系上级省代处理"
    }
  };

  /* ---------- 顶部胶囊 tab（样式同「会话列表-会话/消息」msg-tabs） ---------- */
  function tabsBar(vm, isSub) {
    var tabs = [
      { k: "active", t: "生效中", n: vm.active.length },
      { k: "pending", t: "待审批", n: vm.pending.length },
      { k: "rejected", t: "已驳回", n: vm.rejected.length }
    ];
    if (isSub) tabs = [tabs[0]];
    return '<section class="uh-sec" style="margin-top:0"><div class="uls-tabs">' +
      tabs.map(function (x) {
        return '<button class="uls-tab' + (_tab === x.k ? " active" : "") + '" data-tab="' + x.k + '">' + x.t +
          /* 仅待审批 tab 显示数量徽标；数量为 0 时不显示 */
          (x.k === "pending" && x.n ? '<span class="uls-tab__badge">' + x.n + "</span>" : "") + "</button>";
      }).join("") + "</div></section>";
  }

  /* ---------- 待审批申请卡（紧凑名片：摘要 + 快捷操作，点击主体进详情） ---------- */
  function pendingCard(a, canReview) {
    var acts = (!canReview) ? "" :
      '<div class="uls-tile__ft"><button class="btn btn-ghost btn-sm" data-act="rej" data-id="' + ui.esc(a.id) + '">驳回</button>' +
      '<button class="btn btn-primary btn-sm" data-act="pass" data-id="' + ui.esc(a.id) + '">通过</button></div>';
    return '<div class="uls-tile" data-open="' + ui.esc(a.id) + '">' +
      '<div class="uls-tile__hd"><span class="uls-tile__nm">' + ui.esc(a.name) + '</span>' +
      '<span class="uh-badge uh-badge--info">待审批</span></div>' +
      '<div class="uls-tile__sum"><span>申请比例 <b>' + Math.round(a.ratio * 100) + '%</b> · 提交 <b>' + ui.esc(a.submittedAt || "—") + '</b></span></div>' +
      acts + '</div>';
  }

  /* 生效中卡协议操作按钮（状态化） */
  function agBtn(p, canManage) {
    if (!canManage) return "";
    var st = (p.agreement && p.agreement.state) || "signed";
    if (st === "signed") {
      return '<button class="btn btn-ghost btn-sm" data-act="view-ag" data-id="' + ui.esc(p.id) + '">查看协议</button>';
    }
    return '<button class="btn btn-ghost btn-sm" data-act="resend" data-id="' + ui.esc(p.id) + '">重发协议</button>';
  }

  /* ---------- 生效中合作卡（紧凑名片；含已暂停态；多选模式显示勾选态、隐藏单卡操作） ---------- */
  function activeCard(p, canManage, selOn, isSel) {
    var suspended = p.status === "suspended";
    var st = (p.agreement && p.agreement.state) || "signed";
    var stateBadge = suspended
      ? '<span class="uh-badge uh-badge--wait">已暂停</span>'
      : '<span class="uh-badge uh-badge--ok">生效中</span>';
    var agBadge = (selOn || suspended) ? "" :
      '<span class="uh-badge uh-badge--' + (AG_STATE[st] ? AG_STATE[st].cls : "ok") + '">' + (AG_STATE[st] ? AG_STATE[st].t : "已签署") + '</span>';
    var acts = "";
    if (!selOn && canManage) {
      acts = '<div class="uls-tile__ft">';
      if (suspended) {
        acts += '<button class="btn btn-ghost btn-sm" data-act="view-ag" data-id="' + ui.esc(p.id) + '">查看协议</button>' +
          '<button class="btn btn-primary btn-sm" data-act="resume" data-id="' + ui.esc(p.id) + '">恢复合作</button>';
      } else {
        acts += '<button class="btn btn-ghost btn-sm" data-act="ratio" data-id="' + ui.esc(p.id) + '">约定比例</button>' +
          agBtn(p, canManage);
      }
      acts += '</div>';
    }
    var na = selOn && suspended;
    return '<div class="uls-tile' + (selOn ? " uls-tile--multi" : "") + (isSel ? " uls-tile--sel" : "") + (na ? " uls-tile--na" : "") + '" data-open="' + ui.esc(p.id) + '">' +
      (selOn ? (na ? '<span class="uls-chk uls-chk--na"></span>' : '<span class="uls-chk' + (isSel ? " on" : "") + '">' + ui.icon("check", 12) + '</span>') : "") +
      '<div class="uls-tile__hd"><span class="uls-tile__nm">' + ui.esc(p.name) + '</span>' +
      stateBadge + agBadge + '</div>' +
      '<div class="uls-tile__sum"><span>约定比例 <b>' + Math.round(p.ratioToSub * 100) + '%</b> · 合作自 <b>' + ui.esc(p.since) + '</b></span></div>' +
      acts + '</div>';
  }

  /* ---------- 已驳回申请卡（紧凑名片） ---------- */
  function rejectedCard(a) {
    return '<div class="uls-tile uls-tile--dim" data-open="' + ui.esc(a.id) + '">' +
      '<div class="uls-tile__hd"><span class="uls-tile__nm">' + ui.esc(a.name) + '</span>' +
      '<span class="uh-badge uh-badge--bad">已驳回</span></div>' +
      '<div class="uls-tile__sum"><span>申请比例 <b>' + Math.round(a.ratio * 100) + '%</b> · 处理 <b>' + ui.esc(a.handledAt || a.submittedAt || "—") + '</b></span></div>' +
      '<div class="uls-tile__reason">' + ui.esc(a.rejectReason || "未说明原因") + '</div></div>';
  }

  /* ---------- 详情弹窗：合作申请（待审批 / 已驳回） ---------- */
  function appDetailSheet(a, canReview, Uni) {
    Uni.sheet({
      title: a.status === "rejected" ? "驳回记录详情" : "合作申请详情",
      body:
        '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(a.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">统一社会信用代码</span><span class="v">' + ui.esc(a.uscc || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">联系人</span><span class="v">' + ui.esc(a.contact || "—") + (a.phone ? " · " + ui.esc(a.phone) : "") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">地址</span><span class="v">' + ui.esc(a.address || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">申请比例</span><span class="v">' + Math.round(a.ratio * 100) + '%</span></div>' +
        '<div class="uh-sheetkv"><span class="k">提交时间</span><span class="v">' + ui.esc(a.submittedAt || "—") + '</span></div>' +
        (a.handledAt ? '<div class="uh-sheetkv"><span class="k">处理时间</span><span class="v">' + ui.esc(a.handledAt) + '</span></div>' : "") +
        (a.rejectReason ? '<div class="uh-sheetkv"><span class="k">驳回原因</span><span class="v">' + ui.esc(a.rejectReason) + '</span></div>' : ""),
      footer: canReview
        ? [{ t: "驳回", kind: "ghost", onClick: function (ov) { ov.close(); rejectSheet(a, Uni); } },
           { t: "确认通过", kind: "primary", onClick: function (ov) {
               var r = Uni.actGuarded("app/review", { id: a.id, pass: true });
               if (r.ok) Uni.toast("已通过，合作协议已生成", "ok");
             } }]
        : [{ t: "关闭", kind: "primary" }]
    });
  }

  /* ---------- 协议查看 sheet（生效中合作） ---------- */
  function agreementViewSheet(p, Uni) {
    var st = (p.agreement && p.agreement.state) || "signed";
    var ag = AG_STATE[st] ? AG_STATE[st].t : "已签署";
    Uni.sheet({
      title: "合作协议",
      body:
        '<div class="uh-sheetkv"><span class="k">合作企业</span><span class="v">' + ui.esc(p.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">协议编号</span><span class="v">' + ui.esc(p.agreement && p.agreement.id ? p.agreement.id : ("O4-" + p.id.toUpperCase() + "-" + (p.since || "2026-08"))) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">合作期限</span><span class="v">' + ui.esc(p.since) + " 起 · 一年" + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">约定比例</span><span class="v">' + Math.round(p.ratioToSub * 100) + '%</span></div>' +
        '<div class="uh-sheetkv"><span class="k">协议状态</span><span class="v">' + ui.esc(ag) + '</span></div>' +
        '<div class="uh-sechead">协议要点</div>' +
        '<div class="uh-clause"><div class="no">1 · 分润结算</div><div class="c">按约定比例结算合格消费分润，以月度对账单为准。</div></div>' +
        '<div class="uh-clause"><div class="no">2 · 对账窗口</div><div class="c">月度对账在账单生成后 5 日内完成，超期将锁定该月对账。</div></div>' +
        '<div class="uh-clause"><div class="no">3 · 状态变更</div><div class="c">合作暂停或终止须双方确认并留痕，终止后不再产生分润结算。</div></div>',
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  /* ---------- 操作记录 sheet（比例变更 / 协议重发 / 状态变更留痕） ---------- */
  function recordsSheet(p, Uni) {
    var d = store.getState().state;
    var rows = [];
    (d.ratioLog || []).forEach(function (r) { if (r.subId === p.id) rows.push({ icon: "file-text", t: "约定比例 " + Math.round(r.from * 100) + "% → " + Math.round(r.to * 100) + "%", d: r.at + " · " + (r.note || "") }); });
    (d.statusLog || []).forEach(function (r) { if (r.subId === p.id) rows.push({ icon: r.to === "terminated" ? "warn" : "bell", t: "合作" + { suspended: "暂停", active: "恢复", terminated: "终止" }[r.to] + "合作", d: r.at + " · " + r.reason }); });
    if (!rows.length) rows.push({ icon: "check", t: "暂无操作记录", d: "合作档案建立后尚未发生变更" });
    Uni.sheet({
      title: "操作记录",
      body: rows.map(function (r) {
        return '<div class="uh-todo-row"><div class="mn"><span class="mt" style="font-weight:600;color:var(--text-1)">' + ui.esc(r.t) + '</span>' +
          '<span class="mt">' + ui.esc(r.d) + '</span></div></div>';
      }).join(""),
      footer: [{ t: "关闭", kind: "primary" }]
    });
  }

  /* ---------- 合作状态管理弹窗：暂停 / 恢复 / 终止 ---------- */
  function statusDialog(p, to, Uni) {
    var M = {
      suspended: { title: "暂停合作？", desc: "暂停后将冻结该企业的分润结算与对账，仅保留查看权限。恢复前需双方确认问题已解决。", ok: "确认暂停", act: "suspended" },
      active: { title: "恢复合作？", desc: "恢复后该企业重新参与分润结算与对账，协议与约定比例不变。", ok: "确认恢复", act: "active" },
      terminated: { title: "终止合作？", desc: "终止后合作关系解除，不再产生分润结算，档案转入归档只读。该操作不可撤销。", ok: "确认终止", act: "terminated" }
    }[to];
    var sh = Uni.sheet({
      title: M.title, danger: to === "terminated",
      body:
        '<div class="uh-sheetkv"><span class="k">合作企业</span><span class="v">' + ui.esc(p.name) + '</span></div>' +
        '<div style="height:8px"></div>' +
        '<div class="uh-readnote">' + ui.icon("info", 15) + '<span>' + M.desc + '</span></div>' +
        '<div class="field" style="margin-top:12px"><label class="field-label">操作原因（必填 · 留痕）</label>' +
        '<textarea class="textarea" id="su-status-reason" placeholder="说明原因，将留痕在操作记录中"></textarea></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: M.ok, kind: to === "terminated" ? "danger" : "primary", onClick: function (ov) {
          var v = ov.querySelector("#su-status-reason").value.trim();
          if (!v) { Uni.toast("请填写操作原因"); return false; }
          var r = Uni.actGuarded("sub/setStatus", { id: p.id, to: M.act, reason: v });
          if (r.ok) { Uni.toast((M.act === "active" ? "已恢复合作" : M.act === "suspended" ? "已暂停合作" : "已终止合作"), "ok"); if (_rerender) _rerender(); return true; }
          Uni.toast(r.reason || "操作失败");
          return false;
      } }]
    });
    return sh;
  }

  /* ---------- 详情弹窗：生效中合作（完整信息 + 合作管理操作） ---------- */
  function subDetailSheet(p, canManage, Uni) {
    var st = (p.agreement && p.agreement.state) || "signed";
    var agT = AG_STATE[st] ? AG_STATE[st].t : "已签署";
    var mgr = canManage
      ? '<div class="uh-sechead" style="margin:14px 0 8px">合作管理</div>' +
        '<button class="uc-dlrow" data-mgr="records" data-id="' + ui.esc(p.id) + '">' +
        '<span class="uh-row__ic">' + ui.icon("clock", 18) + '</span>' +
        '<span class="uh-row__main"><span class="uh-row__t">操作记录</span><span class="uh-row__s">比例变更 · 协议重发 · 状态变更留痕</span></span>' +
        ui.icon("chev", 16) + '</button>' +
        '<button class="uc-dlrow" data-mgr="recon" data-id="' + ui.esc(p.id) + '">' +
        '<span class="uh-row__ic">' + ui.icon("chart", 18) + '</span>' +
        '<span class="uh-row__main"><span class="uh-row__t">查看对账单</span><span class="uh-row__s">分润结算与月度对账明细</span></span>' +
        ui.icon("chev", 16) + '</button>' +
        (p.status === "active"
          ? '<button class="uc-dlrow" data-mgr="pause" data-id="' + ui.esc(p.id) + '">' +
            '<span class="uh-row__ic">' + ui.icon("pause", 18) + '</span>' +
            '<span class="uh-row__main"><span class="uh-row__t">暂停合作</span><span class="uh-row__s">冻结分润结算与对账</span></span>' +
            ui.icon("chev", 16) + '</button>'
          : '<button class="uc-dlrow" data-mgr="resume" data-id="' + ui.esc(p.id) + '">' +
            '<span class="uh-row__ic">' + ui.icon("play", 18) + '</span>' +
            '<span class="uh-row__main"><span class="uh-row__t">恢复合作</span><span class="uh-row__s">重新参与分润结算</span></span>' +
            ui.icon("chev", 16) + '</button>') +
        '<button class="uc-dlrow" data-mgr="terminate" data-id="' + ui.esc(p.id) + '" style="color:var(--error)">' +
        '<span class="uh-row__ic">' + ui.icon("warn", 18) + '</span>' +
        '<span class="uh-row__main"><span class="uh-row__t">终止合作</span><span class="uh-row__s">解除合作关系 · 不可撤销</span></span>' +
        ui.icon("chev", 16) + '</button>'
      : "";
    var foot = canManage
      ? [{ t: st === "signed" ? "查看协议" : "重新发起协议", kind: "ghost", onClick: function (ov) {
             ov.close();
             if (st === "signed") agreementViewSheet(p, Uni); else resendDialog(p, Uni);
         } },
         { t: "配置约定比例", kind: "primary", onClick: function (ov) { ov.close(); ratioSheet(p, Uni); } }]
      : [{ t: "关闭", kind: "primary" }];
    var sh = Uni.sheet({
      title: "合作档案详情",
      body:
        '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(p.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">统一社会信用代码</span><span class="v">' + ui.esc(p.uscc || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">联系人</span><span class="v">' + ui.esc(p.contact || "—") + (p.phone ? " · " + ui.esc(p.phone) : "") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">地址</span><span class="v">' + ui.esc(p.address || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">约定比例</span><span class="v">' + Math.round(p.ratioToSub * 100) + '%</span></div>' +
        '<div class="uh-sheetkv"><span class="k">合作自</span><span class="v">' + ui.esc(p.since) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">协议状态</span><span class="v">' + ui.esc(agT) + '</span></div>' +
        mgr,
      footer: foot
    });
    if (sh) {
      Array.prototype.forEach.call(sh.querySelectorAll("[data-mgr]"), function (n) {
        n.addEventListener("click", function (e) {
          e.stopPropagation();
          var mgr = n.getAttribute("data-mgr");
          if (typeof sh.close === "function") sh.close();
          if (mgr === "records") recordsSheet(p, Uni);
          else if (mgr === "recon") Uni.navTo("reconcile.html");
          else if (mgr === "pause") statusDialog(p, "suspended", Uni);
          else if (mgr === "resume") statusDialog(p, "active", Uni);
          else if (mgr === "terminate") statusDialog(p, "terminated", Uni);
        });
      });
    }
    return sh;
  }

  /* ---------- 空态段 ---------- */
  function emptyBlock(Uni, em) {
    return '<div class="card">' + Uni.emptyHtml(em.title, em.desc, "doc") + '</div>';
  }

  /* ---------- 弹窗：发起新二级合作 ---------- */
  function createSheet(Uni) {
    Uni.sheet({
      title: "发起新二级合作",
      body:
        '<div class="field"><label class="field-label">企业名称（必填）</label><input class="input" id="su-n" placeholder="例如：德阳恒基建材有限公司"></div>' +
        '<div class="field"><label class="field-label">统一社会信用代码（必填 · 18 位）</label><input class="input" id="su-uscc" maxlength="18" placeholder="18 位 USCC"></div>' +
        '<div class="field"><label class="field-label">联系人</label><input class="input" id="su-contact" placeholder="企业负责人姓名"></div>' +
        '<div class="field"><label class="field-label">联系电话（11 位手机号）</label><input class="input" id="su-phone" maxlength="11" placeholder="11 位手机号"></div>' +
        '<div class="field"><label class="field-label">地址</label><input class="input" id="su-addr" placeholder="企业经营地址"></div>' +
        '<div class="field"><label class="field-label">约定比例（0–50%）</label>' +
        '<input class="input" id="su-ratio" type="number" value="20" min="0" max="50">' +
        '<div class="uh-note">比例范围 0–50%</div></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "提交合作申请", kind: "primary", onClick: function (ov) {
        var name = ov.querySelector("#su-n").value.trim();
        var uscc = ov.querySelector("#su-uscc").value.trim();
        var contact = ov.querySelector("#su-contact").value.trim();
        var phone = ov.querySelector("#su-phone").value.trim();
        var address = ov.querySelector("#su-addr").value.trim();
        var ratio = Number(ov.querySelector("#su-ratio").value);
        if (!name) { Uni.toast("请填写企业名称"); return false; }
        if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(uscc)) { Uni.toast("统一社会信用代码应为 18 位"); return false; }
        if (phone && !/^1\d{10}$/.test(phone)) { Uni.toast("请输入正确的手机号"); return false; }
        if (isNaN(ratio) || ratio < 0 || ratio > 50) { Uni.toast("约定比例须在 0–50% 之间"); return false; }
        var r = Uni.actGuarded("app/create", { data: { name: name, uscc: uscc, contact: contact, phone: phone, address: address, ratio: ratio / 100, channel: "agent" } });
        if (r.ok) Uni.toast("已提交合作申请", "ok");
      } }]
    });
  }

  /* ---------- 弹窗：通过合作申请 ---------- */
  function passSheet(app, Uni) {
    Uni.sheet({
      title: "合作申请审批",
      body:
        '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(app.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">USCC</span><span class="v">' + ui.esc(app.uscc) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">联系人</span><span class="v">' + ui.esc(app.contact || "—") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">申请比例</span><span class="v">' + Math.round(app.ratio * 100) + '%</span></div>' +
        '<div class="uh-readnote" style="margin-top:12px">' + ui.icon("info", 15) +
        '<span>通过后将自动生成合作协议，并通知二级企业登录后签署。</span></div>',
      footer: [{ t: "再想想", kind: "ghost" },
      { t: "确认通过", kind: "primary", onClick: function () {
        var r = Uni.actGuarded("app/review", { id: app.id, pass: true });
        if (r.ok) { applyReview(app.id, true, ""); Uni.toast("已通过，合作协议已生成", "ok"); if (_rerender) _rerender(); }
      } }]
    });
  }

  /* ---------- 弹窗：驳回原因 ---------- */
  function rejectSheet(app, Uni) {
    var sh = Uni.sheet({
      title: "驳回合作申请",
      body:
        '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(app.name) + '</span></div>' +
        '<div style="height:10px"></div>' +
        '<div class="field"><label class="field-label">驳回原因（必填）</label>' +
        '<textarea class="textarea" id="su-rej" placeholder="说明驳回原因，留痕在申请档案中"></textarea></div>' +
        '<div class="uls-quick">' +
        REJECT_QUICK.map(function (q) {
          return '<button class="btn btn-ghost btn-sm" data-quick="' + ui.esc(q) + '">' + q + '</button>';
        }).join("") + '</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认驳回", kind: "danger", onClick: function (ov) {
        var v = ov.querySelector("#su-rej").value.trim();
        if (!v) { Uni.toast("请填写驳回原因"); return false; }
        var r = Uni.actGuarded("app/review", { id: app.id, pass: false, reason: v });
        if (r.ok) { applyReview(app.id, false, v); Uni.toast("已驳回，留痕在申请档案", "ok"); if (_rerender) _rerender(); }
      } }]
    });
    Array.prototype.forEach.call(sh.querySelectorAll("[data-quick]"), function (b) {
      b.addEventListener("click", function () {
        sh.querySelector("#su-rej").value = b.getAttribute("data-quick");
      });
    });
  }

  /* ---------- 弹窗：配置/调整约定比例 ---------- */
  function ratioSheet(p, Uni) {
    var cur = Math.round(p.ratioToSub * 100);
    Uni.sheet({
      title: "配置约定比例",
      body:
        '<div class="uh-sheetkv"><span class="k">合作企业</span><span class="v">' + ui.esc(p.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">当前比例</span><span class="v">' + cur + '%</span></div>' +
        '<div style="height:10px"></div>' +
        '<div class="field"><label class="field-label">新约定比例（0–50%）</label>' +
        '<input class="input" id="su-newratio" type="number" value="' + cur + '" min="0" max="50"></div>' +
        '<div class="uh-readnote" style="margin-top:10px">' + ui.icon("info", 15) +
        '<span>变更后需与二级补签合作协议，将生成一条待办。</span></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认变更", kind: "primary", onClick: function (ov) {
        var raw = (ov.querySelector("#su-newratio").value || "").trim();
        if (!raw) { Uni.toast("请输入约定比例"); return false; }
        var v = Number(raw);
        if (isNaN(v) || v < 0 || v > 50) { Uni.toast("约定比例须在 0–50% 之间"); return false; }
        var r = Uni.actGuarded("sub/setRatio", { id: p.id, ratio: v / 100, from: p.ratioToSub });
        if (r.ok) { Uni.toast("比例已变更，待补签协议", "ok"); if (_rerender) _rerender(); }
      } }]
    });
  }

  /* ---------- 弹窗：重新发起合作协议（确认） ---------- */
  function resendDialog(p, Uni) {
    var st = (p.agreement && p.agreement.state) || "signed";
    Uni.dialog({
      title: "重新发起合作协议？", danger: true,
      text: st === "rejected"
        ? "该企业此前已拒签，修订后重新发起；发起后将通知二级企业重新查阅并签署。"
        : "用于二级企业待签或协议修订后重新发起；重新发起后将通知二级企业重新查阅并签署。",
      ok: "确认重新发起",
      onOk: function () {
        var r = Uni.actGuarded("agree/resend", { id: p.id });
        if (r.ok) { Uni.toast("协议已重新发起", "ok"); if (_rerender) _rerender(); }
      }
    });
  }

  /* ---------- 批量弹窗：统一配置约定比例（多选企业） ---------- */
  function batchRatioSheet(list, Uni) {
    Uni.sheet({
      title: "批量配置约定比例",
      body:
        '<div class="uh-sheetkv"><span class="k">涉及企业</span><span class="v">' + list.length + " 家</span></div>" +
        '<div class="uls-picklist">' + list.map(function (p) {
          return '<span class="uls-pickitem">' + ui.esc(p.name) + '</span>';
        }).join("") + '</div>' +
        '<div class="field"><label class="field-label">统一新约定比例（0–50%）</label>' +
        '<input class="input" id="su-bratio" type="number" min="0" max="50" placeholder="输入 0–50 整数"></div>' +
        '<div class="uh-readnote" style="margin-top:10px">' + ui.icon("info", 15) +
        '<span>将统一调整 ' + list.length + ' 家企业的约定比例；变更后各需与二级补签协议。</span></div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认批量变更", kind: "primary", onClick: function (ov) {
          var raw = (ov.querySelector("#su-bratio").value || "").trim();
          if (!raw) { Uni.toast("请输入约定比例"); return false; }
          var v = Number(raw);
          if (isNaN(v) || v < 0 || v > 50) { Uni.toast("约定比例须在 0–50% 之间"); return false; }
          var done = 0, firstErr = "";
          list.forEach(function (p) {
            var r = store.act("sub/setRatio", { id: p.id, ratio: v / 100, from: p.ratioToSub });
            if (r.ok) done++; else if (!firstErr) firstErr = r.reason || "变更失败";
          });
          if (done) Uni.toast("已更新 " + done + " 家约定比例，待补签协议", "ok");
          else if (firstErr) Uni.toast(firstErr);
          if (done) { _multi = false; _sel = {}; if (_rerender) _rerender(); }
      } }]
    });
  }

  /* ---------- 批量弹窗：重新发起合作协议（多选企业） ---------- */
  function batchResendDialog(list, Uni) {
    Uni.dialog({
      title: "批量重发协议？", danger: true,
      text: "将向 " + list.length + " 家企业重新发起合作协议（用于协议修订或拒签后重发），各企业将收到重新查阅并签署的提醒。",
      ok: "确认批量重发",
      onOk: function () {
        var done = 0, firstErr = "";
        list.forEach(function (p) {
          var r = store.act("agree/resend", { id: p.id });
          if (r.ok) done++; else if (!firstErr) firstErr = r.reason || "重发失败";
        });
        if (done) Uni.toast("已向 " + done + " 家企业重新发起协议", "ok");
        else if (firstErr) Uni.toast(firstErr);
        if (done) { _multi = false; _sel = {}; if (_rerender) _rerender(); }
      }
    });
  }

  /* 唯一渲染路径（tab + 多选状态由闭包维护，操作后重渲染） */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var ro = ctx.readonly;
    var isSub = ctx.mode === "sub";

    var canReview = !ro && V.perms.review;
    var canManage = !ro && V.perms.setRatio;

    _multi = false; _sel = {}; _tab = "active";

    function render() {
      var vm = V.data(ctx);

      var sec = function (k, head, grid) {
        return '<section class="uh-sec">' + head + '<div class="uls-grid">' + grid + '</div></section>';
      };

      /* 各 tab 内容按需构建（仅当前 tab 渲染） */
      var body = "";
      if (_tab === "pending") {
        var pendingHtml = vm.pending.length
          ? vm.pending.map(function (a) { return pendingCard(a, canReview); }).join("")
          : emptyBlock(Uni, V.empty.pending);
        body += sec("pending",
          '<div class="uh-sechead"><span class="lbl">待审批申请</span>' +
          (vm.pending.length ? '<span class="uh-badge uh-badge--info">待处理 ' + vm.pending.length + '</span>' : "") + '</div>',
          pendingHtml);
      } else if (_tab === "rejected") {
        var rejectedHtml = vm.rejected.length
          ? vm.rejected.map(function (a) { return rejectedCard(a); }).join("")
          : emptyBlock(Uni, V.empty.rejected);
        body += sec("rejected",
          '<div class="uh-sechead"><span class="lbl">已驳回申请</span></div>',
          rejectedHtml);
      } else {
        var activeHtml = vm.active.length
          ? vm.active.map(function (p) { return activeCard(p, canManage, _multi, !!_sel[p.id]); }).join("")
          : emptyBlock(Uni, V.empty.active);
        /* 生效中段头：多选入口 / 多选态（仅可操作身份 & ≥2 家时提供批量管理） */
        var multiHead = "";
        var selCount = Object.keys(_sel).length;
        if (canManage && vm.active.length > 1 && !isSub) {
          if (_multi) {
            multiHead = '<div class="uh-sechead uls-multihead"><span class="lbl">已选 ' + selCount + ' 家</span>' +
              '<span class="grp"><button class="btn btn-ghost btn-sm" data-multi="all">全选</button>' +
              '<button class="btn btn-ghost btn-sm" data-multi="exit">取消</button></span></div>';
          } else {
            multiHead = '<div class="uh-sechead uls-multihead"><span class="lbl">生效中合作</span>' +
              '<span class="grp"><span class="uh-badge uh-badge--ok">生效中 ' + vm.active.length + '</span>' +
              '<a class="uls-link" data-multi="enter">批量操作</a></span></div>';
          }
        } else if (vm.active.length) {
          multiHead = '<div class="uh-sechead"><span class="lbl">生效中合作</span>' +
            '<span class="uh-badge uh-badge--ok">生效中 ' + vm.active.length + '</span></div>';
        }
        body += sec("active", multiHead, activeHtml);
      }

      /* 多选批量操作栏（固定底部，仅生效中 tab） */
      var batchBar = (_multi && _tab === "active") ? '<div class="uls-batchbar' + (selCount ? "" : " is-empty") + '">' +
        '<span class="uls-batchbar__cnt">已选 ' + selCount + " 家</span>" +
        '<div class="uls-batchbar__btns">' +
        '<button class="btn btn-ghost btn-sm" data-batch="ratio">批量配置比例</button>' +
        '<button class="btn btn-primary btn-sm" data-batch="resend">批量重发协议</button>' +
        '</div></div>' : "";

      el.innerHTML =
        (ro ? '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
          '<span class="lb-s">' + ui.esc(V.lockedNote) + '</span></div></div></section>' : "") +
        tabsBar(vm, isSub) +
        (vm.note ? '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) + '<span>' + ui.esc(vm.note) + '</span></div></section>' : "") +
        body +
        batchBar;

      var apps = {};
      mergedSubApps(ctx.s).forEach(function (a) { apps[a.id] = a; });
      var subs = {};
      (ctx.s.subs || []).forEach(function (p) { subs[p.id] = p; });
      vm.active.forEach(function (p) { if (!subs[p.id]) subs[p.id] = p; });

      /* tab 切换 */
      el.querySelectorAll("[data-tab]").forEach(function (n) {
        n.addEventListener("click", function () {
          _tab = n.getAttribute("data-tab");
          _multi = false; _sel = {};
          render();
        });
      });

      el.querySelectorAll('[data-act="pass"]').forEach(function (n) {
        n.addEventListener("click", function () { var a = apps[n.getAttribute("data-id")]; if (a) passSheet(a, Uni); });
      });
      el.querySelectorAll('[data-act="rej"]').forEach(function (n) {
        n.addEventListener("click", function () { var a = apps[n.getAttribute("data-id")]; if (a) rejectSheet(a, Uni); });
      });
      el.querySelectorAll('[data-act="ratio"]').forEach(function (n) {
        n.addEventListener("click", function () { var p = subs[n.getAttribute("data-id")]; if (p) ratioSheet(p, Uni); });
      });
      el.querySelectorAll('[data-act="resend"]').forEach(function (n) {
        n.addEventListener("click", function () {
          var p = subs[n.getAttribute("data-id")]; if (p) resendDialog(p, Uni);
        });
      });
      el.querySelectorAll('[data-act="view-ag"]').forEach(function (n) {
        n.addEventListener("click", function () {
          var p = subs[n.getAttribute("data-id")]; if (p) agreementViewSheet(p, Uni);
        });
      });
      el.querySelectorAll('[data-act="resume"]').forEach(function (n) {
        n.addEventListener("click", function () {
          var p = subs[n.getAttribute("data-id")]; if (p) statusDialog(p, "active", Uni);
        });
      });
      /* 详情弹窗内合作管理操作：绑定在 Uni.sheet 容器内（见 subDetailSheet），此处仅保留 data-open 卡片主体绑定 */
      el.querySelectorAll("[data-open]").forEach(function (n) {
        n.addEventListener("click", function (e) {
          if (e.target.closest("[data-act]")) return;
          var id = n.getAttribute("data-open");
          if (_multi && n.classList.contains("uls-tile--multi")) {
            if (_sel[id]) delete _sel[id]; else _sel[id] = true;
            render();
            return;
          }
          var a = apps[id], p = subs[id];
          if (a) appDetailSheet(a, canReview && a.status === "pending", Uni);
          else if (p) subDetailSheet(p, canManage, Uni);
        });
      });

      /* 多选入口 / 全选 / 取消 */
      el.querySelectorAll("[data-multi]").forEach(function (n) {
        n.addEventListener("click", function () {
          var a = n.getAttribute("data-multi");
          if (a === "enter") { _multi = true; _sel = {}; }
          else if (a === "all") { V.data(ctx).active.filter(function (p) { return p.status !== "suspended"; }).forEach(function (p) { _sel[p.id] = true; }); }
          else { _multi = false; _sel = {}; }
          render();
        });
      });

      /* 批量操作（底部栏） */
      el.querySelectorAll("[data-batch]").forEach(function (n) {
        n.addEventListener("click", function () {
          var pick = V.data(ctx).active.filter(function (p) { return _sel[p.id] && p.status !== "suspended"; });
          if (!pick.length) { Uni.toast("请先选择企业"); return; }
          if (n.getAttribute("data-batch") === "ratio") batchRatioSheet(pick, Uni);
          else batchResendDialog(pick, Uni);
        });
      });
    }

    render();
    _rerender = render;

    /* FAB：发起新二级合作（只读/无权限不渲染） */
    if (!ro && V.perms.createApp) {
      var fab = document.createElement("button");
      fab.className = "uh-fab";
      fab.setAttribute("aria-label", "发起新二级合作");
      fab.innerHTML = ui.icon("user-plus", 22);
      fab.addEventListener("click", function () { createSheet(Uni); });
      el.appendChild(fab);
    }
  }

  window.Uni.register({
    view: "uni-subs",
    route: "subs.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
