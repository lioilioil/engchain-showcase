/* ============================================================
   uni-invite-records.js · 获客记录（重构版 20261030uni8）
   结构：唯一主 bar（记录/统计/对比三视图）→ 锁条/权限说明条 → 内容区
     记录视图：章节头「筛选」入口 + 折叠 chip 面板 + 20 条/页「加载更多」列表
     统计视图：漏斗概览卡 + 按渠道分组卡 + 按成员分组卡
     对比视图：渠道付费对比条 + 成员注册对比条
     行：图标块(stage tint)/姓名/阶段徽章/手机/企业/来源/活跃/付费状态 chip
     详情 sheet：现有字段 + 付费状态行 + APP 操作记录（待数据占位）
   组件视觉全部为系统/uni-layout 基元；弹窗/Toast 一律 Uni.sheet / Uni.toast。
   本页不展示任何付费金额。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var STAGE_BADGE = { registered: "info", onboarded: "ok", paid: "gold", repaid: "ok", lost: "bad" };

  /* 分页：手机端滚动列表，每页 20 条 + 加载更多 */
  var PAGE_SIZE = 20;

  /* ---------- 渠道码类型（数据层 Uni.leadChannelTypeOf 就绪后优先调用；缺失时按 channelMap 兜底） ---------- */
  var CH_LABEL = { province: "管理员码 CH-P", staff: "员工码 CH-E", agent: "招商码 AG-", sub: "二级码 CH-S" };
  function channelOf(Uni, vm, lead, staffName) {
    if (typeof Uni.leadChannelTypeOf === "function") {
      var r = Uni.leadChannelTypeOf(lead, staffName);
      if (r && r.key && CH_LABEL[r.key]) return { key: r.key, label: r.label || CH_LABEL[r.key] };
    }
    /* 兜底：lead.channel 缺失时按 channelMap[lead.id] 的来源桶推断 */
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
  /* store 写动作靠 d.leads[channel] 定位桶；lead 本身不带 channel 字段，统一由 channelMap 取桶名 */
  function bucketOf(vm, lead) { return (vm.channelMap && vm.channelMap[lead.id]) || lead.channel || ""; }

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
    (list || []).forEach(function (l) {
      var o = l.owner || "未知成员";
      if (!seen[o]) { seen[o] = 1; out.push({ key: o, label: o }); }
    });
    return out;
  }
  function mapChannel(list, ch) {
    var m = {};
    (list || []).forEach(function (l) { m[l.id] = ch; });
    return m;
  }
  function groupBy(arr, keyFn) {
    var g = {};
    (arr || []).forEach(function (it) {
      var k = keyFn(it);
      if (!g[k]) g[k] = [];
      g[k].push(it);
    });
    return g;
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
  /* 付费状态口径：是否存在任意一条消费记录（纯 store 现算） */
  function paidFlag(l) { return Array.isArray(l.consumption) && l.consumption.length > 0; }
  /* 整数百分比；分母 0 显示 — */
  function pctOf(part, whole) { return whole > 0 ? Math.round(part / whole * 100) + "%" : "—"; }

  /* ---------- 权限矩阵（6 身份；sub_staff 为本版新增修复串数据漏洞） ---------- */
  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        var direct = s.leads.direct || [], agent = s.leads.agent || [], school = s.leads.school || [];
        return {
          self: direct.concat(agent),                 // 省代自营线
          school: school,                             // 二级线（当前 demo 态通常缺省 → 空态）
          channelMap: Object.assign(mapChannel(direct, "direct"), mapChannel(agent, "agent"), mapChannel(school, "school")),
          showChannel: true,
          showMembers: true,                          // 成员筛选/分组由当前集合派生
          canScope: true,                             // 唯一可见二级视角切换器
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
    /* 显式定义：避免 stateVariantFor 走 fallback JSON 深拷贝时剥离 data 函数导致白屏。
       只读由 ctx.readonly（identityReadonly=true）在 UI 层门控，本变体数据范围与 admin 同构。 */
    legal_rep: {
      label: "省级总代 · 法定代表人",
      data: function (ctx) {
        var s = ctx.s;
        var direct = s.leads.direct || [], agent = s.leads.agent || [], school = s.leads.school || [];
        return {
          self: direct.concat(agent),
          school: school,
          channelMap: Object.assign(mapChannel(direct, "direct"), mapChannel(agent, "agent"), mapChannel(school, "school")),
          showChannel: true,
          showMembers: true,
          canScope: true,
          canFollow: true, canStage: true,            // ctx.readonly=true 已门控全部写入口
          note: "",
          lockedTitle: "合作权限已暂停",
          subBindNote: ""
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: { leads: { title: "暂无获客记录", desc: "渠道码带来的注册用户将出现在这里" } },
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s, my = ctx.staffName;
        var mine = (s.leads.direct || []).filter(function (l) { return l.owner === my; })
          .concat((s.leads.agent || []).filter(function (l) { return l.owner === my; }));
        return {
          self: mine,
          school: [],
          channelMap: Object.assign(mapChannel(s.leads.direct || [], "direct"), mapChannel(s.leads.agent || [], "agent")),
          showChannel: true,
          showMembers: false,
          canScope: false,
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
          self: all,
          school: [],
          channelMap: mapChannel(all, "school"),
          showChannel: false,
          showMembers: true,
          canScope: false,
          /* 产品决定：store 守卫 lead/follow 仅放行 boss/staff/subStaff，sub_admin 点了必失败；
             本版 UI 层直接不渲染跟进输入框与阶段按钮，消灭无效入口 */
          canFollow: false, canStage: false,
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
    },
    /* 显式定义：避免 fallback 深拷贝剥离 data 函数白屏；数据范围与 sub_admin 同构，只读由 ctx.readonly 门控 */
    sub_legal: {
      label: "二级合作企业 · 法定代表人",
      data: function (ctx) {
        var all = ctx.s.leads.school || [];
        return {
          self: all,
          school: [],
          channelMap: mapChannel(all, "school"),
          showChannel: false,
          showMembers: true,
          canScope: false,
          canFollow: false, canStage: false,
          note: "",
          lockedTitle: "合作已暂停",
          subBindNote: "单层绑定：用户通过你的渠道码注册后即永久归属本企业；用户再邀请不归属、不计佣、不传递。"
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: { leads: { title: "暂无用户", desc: "邀请用户完成注册与入驻后将出现在这里" } },
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    sub_staff: {
      label: "二级合作企业 · 员工",
      /* 修复现状漏洞：此前未定义本键 → 回退 sub_admin 全量 school 数据。
         现显式定义：仅 owner===本人 的 school 线索，与 store 守卫一致。 */
      data: function (ctx) {
        var my = ctx.staffName;
        var all = ctx.s.leads.school || [];
        return {
          self: all.filter(function (l) { return l.owner === my; }),
          school: [],
          channelMap: mapChannel(all, "school"),
          members: [],
          showChannel: false,
          showMembers: false,
          canScope: false,
          canFollow: true, canStage: true,
          note: "二级员工：仅可见、仅可跟进本人渠道码带来的用户。",
          lockedTitle: "合作已暂停",
          subBindNote: "单层绑定：用户通过你的渠道码注册后即永久归属本企业；用户再邀请不归属、不计佣、不传递。"
        };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: { leads: { title: "暂无本人线索", desc: "你的渠道码带来注册后，用户将出现在这里" } },
      lockedNote: "线索跟进与阶段更新均已锁定，仅可查看"
    }
  };

  /* ---------- 更新阶段 sheet（阶段选项保持三档：已注册/已入驻/已消费） ---------- */
  function stageSheet(ctx, Uni, vm, lead) {
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
          Uni.actGuarded("lead/stage", { channel: bucketOf(vm, lead), id: lead.id, stage: st });
      } }]
    });
  }

  /* APP 操作记录（接口规格：lead.ops = [{type,at,desc,meta?}]；type 枚举
     register 注册完成 / login App登录 / cert 提交企业认证 / entry 提交入驻申请 /
     unlock 解锁供需 / order 下单 / pay 支付成功。当前无数据 → 渲染待接入占位，绝不编造。） */
  function opsBlock(lead) {
    var ops = Array.isArray(lead.ops) ? lead.ops : [];
    if (ops.length) {
      return '<div class="uc-tl">' + ops.map(function (o) {
        return '<div class="uc-tl__item"><div class="uc-tl__dot"></div>' +
          '<div class="uc-tl__body"><div class="uc-tl__t">' + ui.esc(o.desc || o.type || "") + "</div>" +
          '<div class="uc-tl__s">' + ui.esc(o.type || "") + (o.at ? " · " + ui.esc(o.at) : "") + "</div></div></div>";
      }).join("") + "</div>";
    }
    return '<div class="uh-todo-note ir-ops-empty">' +
      "<div>APP 操作记录待数据接入，当前版本暂无流水</div>" +
      '<span class="uc-itchip ir-ops-chip">待数据支持</span></div>';
  }

  /* ---------- 详情 sheet（本版新增：付费状态行 + APP 操作记录章节） ---------- */
  function detailSheet(ctx, Uni, vm, lead) {
    var st = STAGE_BADGE[lead.stage] || "mute";
    var notes = lead.notes || [];            // school 桶 lead 无 notes，必须兜底 []
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
        stageSheet(ctx, Uni, vm, lead); return false;
      } });
    }
    foot.push((!ctx.readonly && vm.canFollow)
      ? { t: "保存跟进", kind: "primary", onClick: function (sh) {
          var v = sh.querySelector("#ur-lead-note").value.trim();
          if (!v) { Uni.toast("请填写跟进内容"); return false; }
          var r = Uni.actGuarded("lead/follow", { channel: bucketOf(vm, lead), id: lead.id, note: v });
          if (r.ok) Uni.toast("已保存跟进", "ok");
        } }
      : { t: "关闭", kind: "primary" });
    var c = channelOf(Uni, vm, lead, ctx.staffName);
    var paid = paidFlag(lead);
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
        '<div class="uh-sheetkv"><span class="k">付费状态</span><span class="v">' +
          '<span class="uh-badge ' + (paid ? "uh-badge--gold" : "uh-badge--mute") + '">' + (paid ? "是" : "无") + "</span></span></div>" +
        '<div style="height:14px"></div>' +
        '<div class="uh-eyebrow" style="margin-bottom:8px">跟进记录</div>' +
        '<div class="uc-tl">' + timeline + "</div>" +
        '<div style="height:14px"></div>' +
        '<div class="uh-eyebrow" style="margin-bottom:8px">APP 操作记录</div>' +
        opsBlock(lead) + followBox,
      footer: foot
    });
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var staffName = ctx.staffName;

    /* ---- 运行时交互态（身份差异之外的页面态） ---- */
    var view = "list";                 // list | stats | compare
    var scope = "self";                // self=省代自营线 | sub=二级线（仅 admin/legal_rep 可切）
    /* 二级视角兜底：无任何二级企业（subs 为空）时切换器整体隐藏，保持自营线单路径 */
    var canScope = !!vm.canScope && (ctx.s.subs || []).length > 0;
    var filterOpen = false;
    var visibleCount = PAGE_SIZE;
    /* 筛选组：组内单选、组间 AND */
    var fQuick = "all", fStart = "", fEnd = "", fChannel = "all", fMember = "all", fStage = "all", fPaid = "all";

    /* 当前集合（随 scope 切换；二级线桶缺省/为空时为空数组 → 渲染待接入空态） */
    function currentCollection() { return scope === "sub" ? (vm.school || []) : (vm.self || []); }
    function currentMembers() { return ownerList(currentCollection()); }

    /* 阶段口径映射：已认证=onboarded；已消费=paid||repaid（人工阶段口径，与 ui.STAGE 字典文案不冲突） */
    function stageMatch(l) {
      if (fStage === "all") return true;
      if (fStage === "registered") return l.stage === "registered";
      if (fStage === "onboarded") return l.stage === "onboarded";
      if (fStage === "paid") return l.stage === "paid" || l.stage === "repaid";
      if (fStage === "lost") return l.stage === "lost";
      return true;
    }
    function matches(l) {
      var d = (l.boundAt || l.createdAt || "").slice(0, 10);
      if (fStart && d < fStart) return false;
      if (fEnd && d > fEnd) return false;
      if (fChannel !== "all" && channelOf(Uni, vm, l, staffName).key !== fChannel) return false;
      if (fMember !== "all" && (l.owner || "") !== fMember) return false;
      if (!stageMatch(l)) return false;
      if (fPaid === "yes" && !paidFlag(l)) return false;
      if (fPaid === "no" && paidFlag(l)) return false;
      return true;
    }
    /* 已激活筛选摘要（折叠态章节头展示） */
    function activeSummary() {
      var out = [];
      if (fQuick === "7d") out.push("近7天");
      else if (fQuick === "30d") out.push("近30天");
      else if (fQuick === "month") out.push("本月");
      else if (fStart || fEnd) out.push("自定义日期");
      if (fChannel !== "all") out.push((CH_LABEL[fChannel] || fChannel).split(" ")[0] + " " + (CH_LABEL[fChannel] || "").replace(/^[^ ]+ /, "").trim());
      if (fMember !== "all") out.push(fMember);
      if (fStage === "registered") out.push("已注册");
      else if (fStage === "onboarded") out.push("已认证");
      else if (fStage === "paid") out.push("已消费");
      else if (fStage === "lost") out.push("流失");
      if (fPaid === "yes") out.push("已付费");
      else if (fPaid === "no") out.push("未付费");
      return out;
    }

    /* ---------- chip 组（次级筛选形态，非 seg） ---------- */
    function chips(name, cur, opts) {
      return '<div class="ir-chips">' + opts.map(function (o) {
        return '<button type="button" class="ir-chip' + (o.v === cur ? " is-on" : "") +
          '" data-chip="' + name + '" data-cv="' + ui.esc(o.v) + '">' + ui.esc(o.t) + "</button>";
      }).join("") + "</div>";
    }
    function filterPanelHtml() {
      var parts = [];
      parts.push('<div class="ir-chipgroup"><div class="ir-chipgroup__lbl">日期快捷</div>' +
        chips("quick", fQuick, [
          { v: "all", t: "全部" }, { v: "7d", t: "近7天" }, { v: "30d", t: "近30天" }, { v: "month", t: "本月" }
        ]) + "</div>");
      parts.push('<div class="ir-dates">' +
        '<input type="date" class="input" data-date-start value="' + fStart + '" aria-label="开始日期">' +
        '<span class="ir-dates__sep">至</span>' +
        '<input type="date" class="input" data-date-end value="' + fEnd + '" aria-label="结束日期"></div>');
      if (vm.showChannel && scope === "self") {
        parts.push('<div class="ir-chipgroup"><div class="ir-chipgroup__lbl">渠道</div>' +
          chips("channel", fChannel, [
            { v: "all", t: "全部" }, { v: "province", t: "管理员码 CH-P" },
            { v: "staff", t: "员工码 CH-E" }, { v: "agent", t: "招商码 AG-" }
          ]) + "</div>");
      }
      var members = currentMembers();
      if (vm.showMembers && members.length) {
        parts.push('<div class="ir-chipgroup"><div class="ir-chipgroup__lbl">成员</div>' +
          chips("member", fMember, [{ v: "all", t: "全部" }].concat(members.map(function (m) {
            return { v: m.key, t: m.label };
          }))) + "</div>");
      }
      parts.push('<div class="ir-chipgroup"><div class="ir-chipgroup__lbl">阶段</div>' +
        chips("stage", fStage, [
          { v: "all", t: "全部" }, { v: "registered", t: "已注册" }, { v: "onboarded", t: "已认证" },
          { v: "paid", t: "已消费" }, { v: "lost", t: "流失" }
        ]) + "</div>");
      parts.push('<div class="ir-chipgroup"><div class="ir-chipgroup__lbl">付费</div>' +
        chips("paid", fPaid, [{ v: "all", t: "全部" }, { v: "yes", t: "已付费" }, { v: "no", t: "未付费" }]) + "</div>");
      return '<div class="card ir-panel">' + parts.join("") + "</div>";
    }

    /* ---------- 记录视图：行（8 元素：图标/姓名/阶段徽章/手机/企业/来源/活跃/付费 chip） ---------- */
    var LEAD_TINT = {
      registered: "color-mix(in srgb, var(--primary-dim) 12%, transparent);color:var(--primary-dim)",
      onboarded: "color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)",
      paid: "color-mix(in srgb, var(--primary-dim) 18%, transparent);color:var(--primary-dim)",
      repaid: "color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)",
      lost: "color-mix(in srgb, var(--warning) 12%, transparent);color:var(--warning-ink)"
    };
    function rowHtml(l) {
      var st = STAGE_BADGE[l.stage] || "mute";
      var c = channelOf(Uni, vm, l, staffName);
      var paid = paidFlag(l);
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
        '<span class="ir-rowright">' +
          '<span class="uh-badge ' + (paid ? "uh-badge--gold" : "uh-badge--mute") + ' ir-paychip">' + (paid ? "已付费" : "未付费") + "</span>" +
          '<span class="ir-chev">' + ui.icon("chev", 14) + "</span>" +
        "</span></div>";
      if (l.stage === "lost") {
        row += '<div class="uc-losttip">' + ui.icon("warn", 13) +
          "<span>超过 30 天未活跃，仅作提示（暂不支持回收/换绑）</span></div>";
      }
      return row;
    }
    function listViewHtml() {
      var F = currentCollection().filter(matches);
      var summary = activeSummary();
      var head = '<section class="uh-sec">' +
        '<div class="uh-sechead ir-listhead"><span class="lbl">获客记录</span>' +
        '<span class="more ir-filterbtn" data-filter-toggle>筛选' + (filterOpen ? " ▲" : " ▾") + "</span></div>";
      if (summary.length) head += '<div class="ir-fsum">已筛选：' + ui.esc(summary.join(" · ")) + "</div>";
      if (filterOpen) head += filterPanelHtml();

      var body;
      if (!F.length) {
        /* 二级线空态（待数据支持，不编造记录） */
        if (scope === "sub") {
          var actSubs = (ctx.s.subs || []).filter(function (x) { return x.status === "active"; });
          body = '<div style="margin-top:14px">' + Uni.emptyHtml("二级企业获客数据待接入", "当前版本暂无二级线获客流水，待数据接入后自动展示", "tray") + "</div>" +
            '<div class="uh-note ir-subnote">已合作二级企业（只读）：' +
            ui.esc(actSubs.map(function (x) { return x.name; }).join(" · ") || "—") + "</div>";
        } else {
          var filtered = summary.length > 0;
          body = '<div style="margin-top:14px">' + Uni.emptyHtml(
            filtered ? "暂无匹配用户" : V.empty.leads.title,
            filtered ? "当前筛选条件下没有符合的用户，可调整条件后重试" : V.empty.leads.desc, "user") + "</div>";
        }
        return head + body + "</section>";
      }
      var shown = F.slice(0, visibleCount);
      body = '<div class="uh-list" style="padding:0 14px">' + shown.map(rowHtml).join("") + "</div>";
      var rest = F.length - visibleCount;
      if (rest > 0) body += '<button type="button" class="btn btn-ghost ir-loadmore" data-loadmore>加载更多（剩余 ' + rest + " 条）</button>";
      else body += '<div class="ir-allloaded">已全部加载 · 共 ' + F.length + " 条</div>";
      return head + body + "</section>";
    }

    /* ---------- 统计视图：漏斗概览 + 分组卡（数字全部现算） ---------- */
    function kvRow(k, v) {
      return '<div class="uh-kv"><span class="k">' + k + '</span><span class="v ir-num">' + ui.esc(v) + "</span></div>";
    }
    function statsViewHtml() {
      var N = currentCollection().length;
      var F = currentCollection().filter(matches);
      var Fn = F.length;
      var cReg = F.filter(function (l) { return l.stage === "registered"; }).length;
      var cAuth = F.filter(function (l) { return l.stage === "onboarded"; }).length;
      var cCons = F.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; }).length;
      var cPaidUsers = F.filter(paidFlag).length;
      var cLost = F.filter(function (l) { return l.stage === "lost"; }).length;
      var onRate = N > 0 ? Math.round((cAuth + cCons) / N * 100) + "%" : "—";
      var payRate = Fn > 0 ? Math.round(cPaidUsers / Fn * 100) + "%" : "—";

      var html = '<section class="uh-sec">' +
        '<div class="uh-finhead ir-fin"><div class="uh-eyebrow">获客漏斗概览</div>' +
        '<div class="uh-bignum ir-num">' + N + '<span class="ir-bignum-sub">当前筛选 ' + Fn + "</span></div></div>" +
        kvRow("已注册", cReg) + kvRow("已认证", cAuth) + kvRow("已消费（阶段口径）", cCons) +
        kvRow("已付费用户（实付）", cPaidUsers) + kvRow("流失", cLost) +
        kvRow("入驻率（认证+消费/总数）", onRate) + kvRow("付费率（已付费/筛选集）", payRate) +
        "</section>";

      /* 按渠道分组 */
      var byCh = groupBy(F, function (l) { return channelOf(Uni, vm, l, staffName).key; });
      var chOrder = ["province", "staff", "agent", "sub", "other"];
      var chRows = chOrder.filter(function (k) { return byCh[k]; }).map(function (k) {
        var g = byCh[k];
        var paid = g.filter(paidFlag).length;
        return '<div class="ir-grp"><div class="ir-grp__t">' + ui.esc(CH_LABEL[k] || k) + "</div>" +
          '<div class="ir-grp__nums"><span>注册 <b class="ir-num">' + g.length + "</b></span>" +
          "<span>付费 <b class=\"ir-num\">" + paid + "</b></span>" +
          '<span class="ir-num ir-grp-rate">' + pctOf(paid, g.length) + "</span></div></div>";
      }).join("");
      if (chRows) html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">按渠道分组</span></div>' +
        '<div class="uh-list ir-grplist">' + chRows + "</div></section>";

      /* 按成员分组（仅 showMembers 且 members 非空身份） */
      var members = currentMembers();
      if (vm.showMembers && members.length) {
        var byM = groupBy(F, function (l) { return l.owner || "未知成员"; });
        var mRows = Object.keys(byM).map(function (k) {
          var g = byM[k];
          var paid = g.filter(paidFlag).length;
          return '<div class="ir-grp"><div class="ir-grp__t">' + ui.esc(k) + "</div>" +
            '<div class="ir-grp__nums"><span>注册 <b class="ir-num">' + g.length + "</b></span>" +
            "<span>付费 <b class=\"ir-num\">" + paid + "</b></span>" +
            '<span class="ir-num ir-grp-rate">' + pctOf(paid, g.length) + "</span></div></div>";
        }).join("");
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">按成员分组</span></div>' +
          '<div class="uh-list ir-grplist">' + mRows + "</div></section>";
      }
      return html;
    }

    /* ---------- 对比视图：渠道付费对比条 + 成员注册对比条 ---------- */
    function compareBar(label, ratio, meta) {
      var w = Math.max(2, Math.round(ratio * 100));
      return '<div class="ir-cmprow"><div class="ir-cmprow__lbl">' + ui.esc(label) + '</div>' +
        '<div class="ir-bar-track"><div class="ir-bar-fill" style="width:' + w + '%"></div></div>' +
        '<div class="ir-cmprow__meta ir-num">' + ui.esc(meta) + "</div></div>";
    }
    function compareViewHtml() {
      var F = currentCollection().filter(matches);
      var html = "";
      /* 渠道对比：条长 = 组内付费数 / max(各组付费数) */
      var byCh = groupBy(F, function (l) { return channelOf(Uni, vm, l, staffName).key; });
      var chKeys = Object.keys(byCh).filter(function (k) { return k !== "other"; });
      var maxPaid = 0;
      chKeys.forEach(function (k) { maxPaid = Math.max(maxPaid, byCh[k].filter(paidFlag).length); });
      if (chKeys.length <= 1) {
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">渠道对比</span></div>' +
          '<div class="uh-todo-note ir-cmpnote">当前身份仅存在一个渠道维度，多渠道付费对比暂无意义。</div></section>';
      } else {
        var chOrder = ["province", "staff", "agent", "sub"];
        var bars = chOrder.filter(function (k) { return byCh[k]; }).map(function (k) {
          var g = byCh[k];
          var paid = g.filter(paidFlag).length;
          return compareBar(CH_LABEL[k] || k, maxPaid > 0 ? paid / maxPaid : 0,
            "注册 " + g.length + " · 付费率 " + pctOf(paid, g.length));
        }).join("");
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">渠道对比</span></div>' +
          '<div class="ir-cmpcard">' + bars + "</div></section>";
      }
      /* 成员对比：条长 = 组内注册数 / max(各组注册数)；无成员维度身份整卡不渲染 */
      var members = currentMembers();
      if (members.length > 1) {
        var byM = groupBy(F, function (l) { return l.owner || "未知成员"; });
        var maxReg = 0;
        Object.keys(byM).forEach(function (k) { maxReg = Math.max(maxReg, byM[k].length); });
        var mbars = Object.keys(byM).map(function (k) {
          var g = byM[k];
          var paid = g.filter(paidFlag).length;
          return compareBar(k, maxReg > 0 ? g.length / maxReg : 0,
            "注册 " + g.length + " · 付费率 " + pctOf(paid, g.length));
        }).join("");
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">成员对比</span></div>' +
          '<div class="ir-cmpcard">' + mbars + "</div></section>";
      }
      if (!html) html = '<section class="uh-sec">' + Uni.emptyHtml("暂无对比数据", "当前筛选条件下没有可对比的分组", "tray") + "</section>";
      return html;
    }

    /* ---------- 页面骨架 ---------- */
    function renderAll() {
      var html = "";
      /* 二级视角切换器（按钮/胶囊形态，非 seg；仅 admin/legal_rep 且 subs 非空） */
      if (canScope) {
        html += '<section class="uh-sec ir-scope">' +
          '<span class="ir-scope__lbl">二级视角</span>' +
          '<span class="ir-scope__opts">' +
          '<button type="button" class="ir-chip' + (scope === "self" ? " is-on" : "") + '" data-scope="self">省代自营线</button>' +
          '<button type="button" class="ir-chip' + (scope === "sub" ? " is-on" : "") + '" data-scope="sub">二级线</button>' +
          "</span></section>";
      }
      /* ★ 全页唯一主 bar（记录/统计/对比） */
      html += '<section class="uh-sec ir-mainsec"><div class="seg ir-mainseg" role="tablist">' +
        '<button class="seg-item' + (view === "list" ? " active" : "") + '" data-view="list">记录</button>' +
        '<button class="seg-item' + (view === "stats" ? " active" : "") + '" data-view="stats">统计</button>' +
        '<button class="seg-item' + (view === "compare" ? " active" : "") + '" data-view="compare">对比</button>' +
        "</div></section>";
      /* 锁条 / 权限说明条（按身份渲染，可空） */
      if (ctx.readonly) {
        html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">' + ui.esc(V.lockedTitle) + "（仅可查看）</span>" +
          '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
      }
      if (vm.note) {
        html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + "<span>" + ui.esc(vm.note) + "</span></div></section>";
      }
      if (view === "list") html += listViewHtml();
      else if (view === "stats") html += statsViewHtml();
      else html += compareViewHtml();
      el.innerHTML = html;
    }

    renderAll();

    /* 详情 sheet 查找索引（覆盖本身份全量集合） */
    function leadIndexOf() {
      var idx = {};
      (vm.self || []).forEach(function (l) { idx[l.id] = l; });
      (vm.school || []).forEach(function (l) { idx[l.id] = l; });
      return idx;
    }

    /* ---------- 事件委派（一次绑定，随 renderAll 重建子节点仍生效） ---------- */
    el.addEventListener("click", function (e) {
      /* 主 bar 视图切换（保留筛选态与 scope，分页重置 20） */
      var v = e.target.closest("[data-view]");
      if (v) { view = v.getAttribute("data-view"); visibleCount = PAGE_SIZE; renderAll(); return; }
      /* scope 切换 */
      var s = e.target.closest("[data-scope]");
      if (s) { scope = s.getAttribute("data-scope"); visibleCount = PAGE_SIZE; fMember = "all"; renderAll(); return; }
      /* 筛选面板展开/收起 */
      if (e.target.closest("[data-filter-toggle]")) { filterOpen = !filterOpen; renderAll(); return; }
      /* chip 单选 */
      var chip = e.target.closest("[data-chip]");
      if (chip) {
        var g = chip.getAttribute("data-chip"), cv = chip.getAttribute("data-cv");
        if (g === "quick") { fQuick = cv; var r = quickRange(cv); fStart = r.start; fEnd = r.end; }
        else if (g === "channel") fChannel = cv;
        else if (g === "member") fMember = cv;
        else if (g === "stage") fStage = cv;
        else if (g === "paid") fPaid = cv;
        visibleCount = PAGE_SIZE;
        renderAll();
        return;
      }
      /* 加载更多 */
      if (e.target.closest("[data-loadmore]")) { visibleCount += PAGE_SIZE; renderAll(); return; }
      /* 详情 sheet */
      var row = e.target.closest("[data-lead]");
      if (row) {
        var idx = leadIndexOf();
        var lead = idx[row.getAttribute("data-lead")];
        if (lead) detailSheet(ctx, Uni, vm, lead);
      }
    });
    /* 手动改起止日期 → 清除快捷高亮（沿用现状） */
    el.addEventListener("change", function (e) {
      if (!e.target.matches("[data-date-start],[data-date-end]")) return;
      fQuick = "all";
      fStart = (el.querySelector("[data-date-start]") || {}).value || "";
      fEnd = (el.querySelector("[data-date-end]") || {}).value || "";
      visibleCount = PAGE_SIZE;
      renderAll();
    });
  }

  window.Uni.register({
    view: "uni-invite-records",
    route: "invite-records.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
