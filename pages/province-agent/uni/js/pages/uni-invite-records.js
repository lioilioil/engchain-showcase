/* ============================================================
   uni-invite-records.js · 获客记录（获客域 3 页之二）
   模板节奏（三身份同构，数据驱动填充）：
     暂停封条/权限说明条 → 多维筛选区（日期/渠道码类型/来源成员）→ 线索/用户列表 → 空态
     点击行 → 详情 sheet（跟进时间线 + 新增跟进 + 更新阶段）
   组件视觉全部为系统类（.card/.btn/.seg/.input/.textarea/.uh-* 基础样式）；
   弹窗/Toast 一律经 Uni.sheet / Uni.toast。
   本页不展示任何付费金额：列表与详情均不含金额字样。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var STAGE_BADGE = { registered: "info", onboarded: "ok", paid: "gold", repaid: "ok", lost: "bad" };

  /* ---------- 渠道码类型（数据层 Uni.leadChannelTypeOf 就绪后优先调用；缺失时同规则兜底） ---------- */
  var CH_LABEL = { province: "管理员码 CH-P", staff: "员工码 CH-E", agent: "招商码 AG-", sub: "二级码 CH-S" };
  function channelOf(Uni, vm, lead, staffName) {
    if (typeof Uni.leadChannelTypeOf === "function") {
      var r = Uni.leadChannelTypeOf(lead, staffName);
      if (r && r.key && CH_LABEL[r.key]) return { key: r.key, label: r.label || CH_LABEL[r.key] };
    }
    /* 兜底：lead.channel 缺失时按本页数据集合的来源桶推断 */
    var ch = lead.channel || (vm.channelMap && vm.channelMap[lead.id]) || "";
    if (ch === "school") return { key: "sub", label: CH_LABEL.sub };
    if (ch === "direct") return { key: "province", label: CH_LABEL.province };
    if (ch === "agent") {
      return lead.owner === staffName
        ? { key: "staff", label: CH_LABEL.staff }
        : { key: "agent", label: CH_LABEL.agent };
    }
    return { key: "other", label: "其他渠道" };
  }

  /* ---------- 日期工具（快捷档以当前真实日期推算） ---------- */
  function pad2(n) { return ("0" + n).slice(-2); }
  function fmtDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function quickRange(key) {
    var now = new Date();
    if (key === "7d") { var s7 = new Date(now); s7.setDate(s7.getDate() - 6); return { start: fmtDate(s7), end: fmtDate(now) }; }
    if (key === "30d") { var s30 = new Date(now); s30.setDate(s30.getDate() - 29); return { start: fmtDate(s30), end: fmtDate(now) }; }
    if (key === "month") {
      return { start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    return { start: "", end: "" };
  }

  /* ---------- 集合派生（身份差异全部收进 data()） ---------- */
  function ownerList(list) {
    var seen = {}, out = [];
    list.forEach(function (l) {
      var o = l.owner || "未知成员";
      if (!seen[o]) { seen[o] = 1; out.push({ key: o, label: o }); }
    });
    return out;
  }
  function mapChannel(list, ch) {
    var m = {};
    list.forEach(function (l) { m[l.id] = ch; });
    return m;
  }
  function lastPayDate(l) {
    var max = "";
    (l.consumption || []).forEach(function (c) {
      var d = (c.date || "").slice(0, 10);
      if (d && d > max) max = d;
    });
    return max;
  }
  function loginDate(l) { return (l.loginAt || l.boundAt || l.createdAt || "—").slice(0, 10); }
  function activityText(l) {
    var pay = lastPayDate(l);
    return "登录 " + loginDate(l) + (pay ? " · 付费 " + pay : " · 尚未付费");
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        var direct = s.leads.direct || [], agent = s.leads.agent || [];
        var all = direct.concat(agent);
        return {
          collection: all,
          channelMap: Object.assign(mapChannel(direct, "direct"), mapChannel(agent, "agent")),
          members: ownerList(all),
          showChannel: true,
          canFollow: true, canStage: true,
          note: "",
          lockedTitle: "合作权限已暂停",
          subBindNote: ""
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: { leads: { title: "暂无获客记录", desc: "渠道码带来的注册用户将出现在这里" } },
      lockedNote: "线索跟进与阶段更新均已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s, my = ctx.staffName;
        var mine = (s.leads.direct || []).filter(function (l) { return l.owner === my; })
          .concat((s.leads.agent || []).filter(function (l) { return l.owner === my; }));
        return {
          collection: mine,
          channelMap: Object.assign(mapChannel(s.leads.direct || [], "direct"), mapChannel(s.leads.agent || [], "agent")),
          members: [],
          showChannel: true,
          canFollow: true, canStage: true,
          note: "员工权限：仅可见、仅可跟进本人渠道码带来的线索。",
          lockedTitle: "合作权限已暂停",
          subBindNote: ""
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: { leads: { title: "暂无本人线索", desc: "你的渠道码带来注册后，线索将出现在这里" } },
      lockedNote: "线索跟进与阶段更新均已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var all = ctx.s.leads.school || [];
        return {
          collection: all,
          channelMap: mapChannel(all, "school"),
          members: ownerList(all),
          showChannel: false,
          canFollow: true, canStage: false,
          note: "",
          lockedTitle: "合作已暂停",
          subBindNote: "单层绑定：用户通过你的渠道码注册后即永久归属本企业；用户再邀请不归属、不计佣、不传递。"
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: { leads: { title: "暂无用户", desc: "邀请用户完成注册与入驻后将出现在这里" } },
      lockedNote: "线索跟进已锁定，仅可查看"
    }
  };

  /* ---------- 更新阶段 sheet（E048） ---------- */
  function stageSheet(ctx, Uni, lead) {
    var cur = lead.stage;
    Uni.sheet({
      title: "更新用户阶段",
      body: '<div class="field"><label class="field-label">选择新阶段</label>' +
        '<div class="seg" data-pick>' +
        '<button class="seg-item' + (cur === "registered" ? " active" : "") + '" data-v="registered">已注册</button>' +
        '<button class="seg-item' + (cur === "onboarded" ? " active" : "") + '" data-v="onboarded">已入驻</button>' +
        '<button class="seg-item' + (cur === "paid" ? " active" : "") + '" data-v="paid">已消费</button></div></div>' +
        '<div class="uh-note">阶段更新后实时计入获客转化漏斗。</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认更新", kind: "primary", onClick: function (sh) {
          var it = sh.querySelector("[data-pick] .seg-item.active");
          var st = it ? it.getAttribute("data-v") : "";
          if (!st) { Uni.toast("请选择新阶段"); return false; }
          Uni.actGuarded("lead/stage", { channel: lead.channel, id: lead.id, stage: st });
      } }]
    });
  }

  /* ---------- 详情 sheet（E047/E093；本页全 sheet 无金额） ---------- */
  function detailSheet(ctx, Uni, vm, lead) {
    var st = STAGE_BADGE[lead.stage] || "mute";
    var notes = lead.notes || [];
    var timeline = notes.length
      ? notes.map(function (n) {
          return '<div class="uc-tl__item"><div class="uc-tl__dot"></div>' +
            '<div class="uc-tl__body"><div class="uc-tl__t">' + ui.esc(n.text) + "</div>" +
            '<div class="uc-tl__s">' + ui.esc(n.by) + " · " + ui.esc(n.at) + "</div></div></div>";
        }).join("")
      : '<div class="uh-note">暂无跟进记录</div>';
    var followBox = (!ctx.readonly && vm.canFollow)
      ? '<div class="field"><label class="field-label">新增跟进</label>' +
        '<textarea class="textarea" id="ur-lead-note" placeholder="记录本次沟通要点，保存后留痕"></textarea></div>'
      : "";
    var foot = [];
    if (vm.canStage && !ctx.readonly) {
      foot.push({ t: "更新用户阶段", kind: "ghost", onClick: function () {
        stageSheet(ctx, Uni, lead); return false;
      } });
    }
    foot.push(ctx.readonly
      ? { t: "关闭", kind: "primary" }
      : { t: "保存跟进", kind: "primary", onClick: function (sh) {
          var v = sh.querySelector("#ur-lead-note").value.trim();
          if (!v) { Uni.toast("请填写跟进内容"); return false; }
          var r = Uni.actGuarded("lead/follow", { channel: lead.channel, id: lead.id, note: v });
          if (r.ok) Uni.toast("已保存跟进", "ok");
      } });
    var c = channelOf(Uni, vm, lead, ctx.staffName);
    Uni.sheet({
      title: "获客详情",
      body:
        (vm.subBindNote ? '<div class="uh-readnote" style="margin-bottom:12px">' + ui.icon("info", 14) + "<span>" + ui.esc(vm.subBindNote) + "</span></div>" : "") +
        '<div class="uh-sheetkv"><span class="k">姓名</span><span class="v">' + ui.esc(Uni.maskName(lead.name)) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">手机</span><span class="v">' + ui.esc(Uni.maskPhone(lead.phone)) + "</span></div>" +
        (lead.company ? '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(Uni.maskCompany(lead.company)) + "</span></div>" : "") +
        '<div class="uh-sheetkv"><span class="k">来源成员</span><span class="v">' + ui.esc(lead.owner || "—") + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">获客方式</span><span class="v">' + ui.esc(c.label) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">活跃度</span><span class="v">' + ui.esc(activityText(lead)) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">绑定时间</span><span class="v">' + ui.esc(lead.boundAt || lead.createdAt) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">当前阶段</span><span class="v">' +
          '<span class="uh-badge uh-badge--' + st + '">' + ui.STAGE[lead.stage] + "</span></span></div>" +
        '<div style="height:14px"></div>' +
        '<div class="uh-eyebrow" style="margin-bottom:8px">跟进记录</div>' +
        '<div class="uc-tl">' + timeline + "</div>" + followBox,
      footer: foot
    });
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var staffName = ctx.staffName;

    /* 筛选状态（内存中当前身份数据集合；筛选变化仅重渲染列表） */
    var fQuick = "all", fStart = "", fEnd = "", fChannel = "all", fMember = "all";

    /* 渠道码类型 seg（admin/legal_rep/staff；sub_admin 数据天然全部 CH-S，不渲染） */
    var channelSegHtml = vm.showChannel
      ? '<div class="uh-sechead" style="margin:16px 0 8px"><span class="lbl">渠道码类型</span></div>' +
        '<div class="seg" data-channel>' +
        '<button class="seg-item active" data-cv="all">全部</button>' +
        '<button class="seg-item" data-cv="province">管理员码 CH-P</button>' +
        '<button class="seg-item" data-cv="staff">员工码 CH-E</button>' +
        '<button class="seg-item" data-cv="agent">招商码 AG-</button></div>'
      : "";
    /* 来源成员 seg（staff 仅本人，不渲染） */
    var memberSegHtml = vm.members.length
      ? '<div class="uh-sechead" style="margin:16px 0 8px"><span class="lbl">来源成员</span></div>' +
        '<div class="seg" data-member>' +
        '<button class="seg-item active" data-mv="all">全部</button>' +
        vm.members.map(function (m) {
          return '<button class="seg-item" data-mv="' + ui.esc(m.key) + '">' + ui.esc(m.label) + "</button>";
        }).join("") + "</div>"
      : "";

    /* 筛选区（自身只渲染一次，不随列表刷新） */
    var filterHtml = '<section class="uh-sec ir-filter">' +
      '<div class="uh-sechead" style="margin:12px 0 8px"><span class="lbl">绑定/注册日期</span></div>' +
      '<div class="seg" data-date-quick>' +
      '<button class="seg-item active" data-dq="all">全部</button>' +
      '<button class="seg-item" data-dq="7d">近7天</button>' +
      '<button class="seg-item" data-dq="30d">近30天</button>' +
      '<button class="seg-item" data-dq="month">本月</button></div>' +
      '<div class="ir-dates">' +
      '<input type="date" class="input" data-date-start aria-label="开始日期">' +
      '<span class="ir-dates__sep">至</span>' +
      '<input type="date" class="input" data-date-end aria-label="结束日期"></div>' +
      channelSegHtml + memberSegHtml +
      "</section>";

    /* 列表行：会话设置条目样式；阶段配色沿用 tint 机制；六字段脱敏展示 */
    var LEAD_TINT = {
      registered: "color-mix(in srgb, var(--primary-dim) 12%, transparent);color:var(--primary-dim)",
      onboarded: "color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)",
      paid: "color-mix(in srgb, var(--primary-dim) 18%, transparent);color:var(--primary-dim)",
      repaid: "color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)",
      lost: "color-mix(in srgb, var(--warning) 12%, transparent);color:var(--warning-ink)"
    };
    function matches(l) {
      var d = (l.boundAt || l.createdAt || "").slice(0, 10);
      if (fStart && d < fStart) return false;
      if (fEnd && d > fEnd) return false;
      if (fChannel !== "all" && channelOf(Uni, vm, l, staffName).key !== fChannel) return false;
      if (fMember !== "all" && (l.owner || "") !== fMember) return false;
      return true;
    }
    function listHtml() {
      var rows = vm.collection.filter(matches);
      var filtered = fQuick !== "all" || fStart || fEnd || fChannel !== "all" || fMember !== "all";
      if (!rows.length) {
        var title = filtered ? "暂无匹配用户" : V.empty.leads.title;
        var desc = filtered ? "当前筛选条件下没有符合的用户，可调整条件后重试" : V.empty.leads.desc;
        return '<div data-leads><section class="uh-sec">' +
          '<div style="margin-top:14px">' + Uni.emptyHtml(title, desc, "user") + "</div></section></div>";
      }
      var body = rows.map(function (l) {
        var st = STAGE_BADGE[l.stage] || "mute";
        var c = channelOf(Uni, vm, l, staffName);
        var row = '<div class="set-item" data-lead="' + ui.esc(l.id) + '">' +
          '<div class="si-ic" style="background:' + (LEAD_TINT[l.stage] || LEAD_TINT.registered) + '">' + ui.icon("user", 18) + '</div>' +
          '<div class="si-body">' +
            '<div class="si-title">' + ui.esc(Uni.maskName(l.name)) +
            '<span class="uh-badge uh-badge--' + st + ' uc-rowbadge">' + ui.STAGE[l.stage] + '</span></div>' +
            '<div class="si-sub">' + ui.esc(Uni.maskPhone(l.phone)) +
            (l.company ? " · " + ui.esc(Uni.maskCompany(l.company)) : "") + '</div>' +
            '<div class="si-sub">来源 ' + ui.esc(l.owner || "—") + " · " + ui.esc(c.label) + '</div>' +
            '<div class="si-sub">' + ui.esc(activityText(l)) + '</div>' +
          '</div>' +
          '<span style="color:var(--text-3);flex:none;display:flex">' + ui.icon("chev", 14) + "</span></div>";
        if (l.stage === "lost") {
          row += '<div class="uc-losttip">' + ui.icon("warn", 13) +
            "<span>超过 30 天未活跃，仅作提示（暂不支持回收/换绑）</span></div>";
        }
        return row;
      }).join("");
      return '<div data-leads><section class="uh-sec"><div class="uh-list" style="padding:0 14px">' + body + "</div></section></div>";
    }

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(V.lockedTitle) + "（仅可查看）</span>" +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
    }
    if (vm.note) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + "<span>" + ui.esc(vm.note) + "</span></div></section>";
    }
    html += filterHtml;
    html += listHtml();

    el.innerHTML = html;

    /* 详情 sheet 查找索引（覆盖本身份全量集合） */
    var leadIndex = {};
    vm.collection.forEach(function (l) { leadIndex[l.id] = l; });
    function bindRows() {
      el.querySelectorAll("[data-lead]").forEach(function (n) {
        if (n._bound) return; n._bound = true;
        n.addEventListener("click", function () {
          var lead = leadIndex[n.getAttribute("data-lead")];
          if (lead) detailSheet(ctx, Uni, vm, lead);
        });
      });
    }
    function refreshList() {
      el.querySelectorAll("[data-leads]").forEach(function (n) { n.outerHTML = listHtml(); });
      bindRows();
    }

    /* 日期快捷 seg（点击填充起止日期并高亮） */
    var quickBox = el.querySelector("[data-date-quick]");
    var startInput = el.querySelector("[data-date-start]");
    var endInput = el.querySelector("[data-date-end]");
    function syncQuickActive() {
      quickBox.querySelectorAll(".seg-item").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-dq") === fQuick);
      });
    }
    quickBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-dq]"); if (!b) return;
      fQuick = b.getAttribute("data-dq");
      var r = quickRange(fQuick);
      fStart = r.start; fEnd = r.end;
      startInput.value = fStart; endInput.value = fEnd;
      syncQuickActive();
      refreshList();
    });
    /* 手动改起止日期：清除快捷高亮 */
    function onManualDate() {
      fQuick = "all";
      fStart = (startInput.value || "").slice(0, 10);
      fEnd = (endInput.value || "").slice(0, 10);
      syncQuickActive();
      refreshList();
    }
    startInput.addEventListener("change", onManualDate);
    endInput.addEventListener("change", onManualDate);

    /* 渠道码类型 seg */
    var channelBox = el.querySelector("[data-channel]");
    if (channelBox) channelBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cv]"); if (!b) return;
      fChannel = b.getAttribute("data-cv");
      channelBox.querySelectorAll(".seg-item").forEach(function (x) {
        x.classList.toggle("active", x.getAttribute("data-cv") === fChannel);
      });
      refreshList();
    });

    /* 来源成员 seg */
    var memberBox = el.querySelector("[data-member]");
    if (memberBox) memberBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mv]"); if (!b) return;
      fMember = b.getAttribute("data-mv");
      memberBox.querySelectorAll(".seg-item").forEach(function (x) {
        x.classList.toggle("active", x.getAttribute("data-mv") === fMember);
      });
      refreshList();
    });

    bindRows();
  }

  window.Uni.register({
    view: "uni-invite-records",
    route: "invite-records.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
