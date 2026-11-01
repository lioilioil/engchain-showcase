/* ============================================================
   uni-invite-records.js · 获客记录（重构版 20261102uni18）
   uni18 增量：列表排序改为按获客日期（boundAt||createdAt）倒序。原实现沿用种子顺序，
               自营线整段在前、二级线整段在后，「全部」视角下最新线索沉到最后，
               与"新→旧"的阅读预期相反；日期相同者保持种子原序
   uni17 增量：日期口径重整（原「全部/近7天/仅30天/本月」既有缺档又有语义矛盾：
               缺今天/昨天——获客最常看的两档；「本月」与「仅30天」部分重叠却不互含，
               用户看不出当前集合到底是什么）。改为：
               ① 顶部胶囊 = 全部/今天/昨天/近7天/近30天（五档，两两不重叠或严格嵌套）；
                  同时把 uni13 起沿用的"仅30天"改正为"近30天"——"仅"读作"恰好只有"，
                  与"近7天"的区间语义打架，是本轮"措辞矛盾"的一部分
               ② 筛选弹窗日期组 = 上述五档 + 本月（1 日至今）+ 上月（整月）+ 自定义区间，
                  区间边界由 quickRange 统一现算，不再出现"标签与区间不一致"
               ③ 引入 fQuick="custom"：手改日期即归入自定义档，摘要显示区间而非档名
               ④ 弹窗改两列（左标签/右选项）+ 实时命中数，改一项立刻看到影响
   uni16 增量：筛选行（日期胶囊组 + 筛选按钮 + 筛选摘要）抽为 filterRowHtml()，
               在记录/统计/对比三个分页顶部（主 bar 下方）同样位置一致渲染；
               筛选状态三页共享、操作三页同步生效，统计/对比空态亦保留筛选行
   uni15 增量：① 主 bar（记录/统计/对比）去除玻璃背景层/模糊/底边，仅保留吸顶
              ② 记录列表去卡片化（.ir-listflat：去边框/背景/圆角/阴影，保留行分隔）
              ③ 来源行改为「来源 姓名 · 成员所在公司（省代或二级企业）· 渠道码名称」，
                 不再展示码类型标签；线索挂 code（种子 uni15 同步补全）
   uni14 增量：记录列表头左侧日期属性改为胶囊按钮组（全部/近7天/仅30天/本月，
               默认选中全部）；仅日期快捷筛选时胶囊常驻并高亮当前档，存在
               渠道/成员/阶段/付费等筛选时原位替换为筛选摘要（已筛选：…）
   uni13 增量：① 主 bar（记录/统计/对比）吸顶固定（.ir-mainbar），不随内容滚动
              ② 记录列表头左侧新增日期属性，筛选确认后以筛选摘要原位替换；
                 独立 .ir-fsum 行删除
              ③ 快捷日期措辞统一：近30天 → 仅30天（筛选弹窗/摘要/表头左侧一致）
   uni12 增量：招商码下线联动——CH_LABEL/筛选/分组/对比渠道项删 agent，
               agent 线索桶并入 direct（员工码按 owner 判定归 staff）
   uni11 增量：① 筛选改底部 sheet 弹窗（五分组/重置/确认/遮罩取消）
              ② 视角改右上角「视角」→ 居中弹窗双复选，scope 单值升级为集合 {self,sub}
              ③ lifecycle 8 值新状态机（姓名后徽章），付费胶囊移到徽章右侧相邻
   结构：视角入口 → 锁条/权限说明条 → 唯一主 bar（记录/统计/对比）→ 内容区
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  /* ---------- lifecycle 8 值状态机（uni11 §4） ---------- */
  var LIFECYCLES = ["游客", "已注册", "已个人认证", "已企业认证", "已企业入驻",
    "已加入认证企业", "已加入入驻企业", "流失"];
  /* 读：旧 stage → lifecycle 兜底映射（旧数据不破图） */
  var LIFECYCLE_BY_STAGE = { registered: "已注册", onboarded: "已企业入驻", paid: "已企业入驻", repaid: "已企业入驻", lost: "流失" };
  /* 写：lifecycle → stage（更新阶段双写时回写旧字段，store.js 零改动） */
  var STAGE_BY_LIFECYCLE = {
    "已注册": "registered", "已个人认证": "registered", "已企业认证": "registered",
    "已加入认证企业": "registered", "游客": "registered",
    "已企业入驻": "onboarded", "已加入入驻企业": "onboarded", "流失": "lost"
  };
  /* 徽章视觉类（§4.5 令牌表；淡金/success 双档为页内私有类，全令牌） */
  var LIFECYCLE_BADGE = {
    "游客": "uh-badge--mute", "已注册": "uh-badge--info", "已个人认证": "ir-badge-l1",
    "已企业认证": "uh-badge--gold", "已企业入驻": "uh-badge--ok",
    "已加入认证企业": "ir-badge-l2", "已加入入驻企业": "ir-badge-l3", "流失": "uh-badge--bad"
  };
  function lifecycleOf(l) { return l.lifecycle || LIFECYCLE_BY_STAGE[l.stage] || "已注册"; }

  /* 分页：手机端滚动列表，每页 20 条 + 加载更多 */
  var PAGE_SIZE = 20;

  /* ---------- 渠道码类型 ---------- */
  var CH_LABEL = { province: "管理员码 CH-P", staff: "员工码 CH-E", sub: "二级码 CH-S" };
  var CH_SHORT = { province: "渠道码CH-P", staff: "员工码CH-E", sub: "二级码CH-S" };
  function channelOf(Uni, vm, lead, staffName) {
    /* sub 线（leadsSub 独立桶）统一页面标注 CH-S，不走 leadChannelTypeOf（§6 补充点 ③） */
    if (lead.__channelKey === "sub") return { key: "sub", label: CH_LABEL.sub };
    if (typeof Uni.leadChannelTypeOf === "function") {
      var r = Uni.leadChannelTypeOf(lead, staffName);
      if (r && r.key && CH_LABEL[r.key]) return { key: r.key, label: r.label || CH_LABEL[r.key] };
    }
    var ch = lead.channel || (vm.channelMap && vm.channelMap[lead.id]) || "";
    if (ch === "school") return { key: "sub", label: CH_LABEL.sub };
    /* 20261030：agent 桶已合并入 direct；员工码按 owner 判定（与 Uni.leadChannelTypeOf 同构） */
    if (ch === "direct") {
      return lead.owner === staffName
        ? { key: "staff", label: CH_LABEL.staff }
        : { key: "province", label: CH_LABEL.province };
    }
    return { key: "other", label: "其他渠道" };
  }
  /* store 写动作靠 d.leads[channel] 定位桶；lead 本身不带 channel 字段，统一由 channelMap 取桶名 */
  function bucketOf(vm, lead) { return (vm.channelMap && vm.channelMap[lead.id]) || lead.channel || ""; }

  /* ---------- 日期工具（快捷档以当前真实日期推算） ----------
     口径（uni17 明确，避免档位互相矛盾）：
       今天/昨天 = 单日闭区间；近7天 = 含今天在内最近 7 个自然日；近30天 = 最近 30 个自然日；
       本月 = 本月 1 日至今天（不是"到月末"，否则区间会指向未来）；
       上月 = 上月 1 日至上月最后一天。五档中除"全部"外两两不重叠或严格嵌套，可叠加推断。 */
  function pad2(n) { return ("0" + n).slice(-2); }
  function fmtDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function shiftDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d; }
  function quickRange(key) {
    var now = new Date(), today = fmtDate(now);
    if (key === "today") return { start: today, end: today };
    if (key === "yday") { var y = fmtDate(shiftDays(-1)); return { start: y, end: y }; }
    if (key === "7d") return { start: fmtDate(shiftDays(-6)), end: today };
    if (key === "30d") return { start: fmtDate(shiftDays(-29)), end: today };
    if (key === "month") return { start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: today };
    if (key === "lastmonth") {
      return {
        start: fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: fmtDate(new Date(now.getFullYear(), now.getMonth(), 0))
      };
    }
    return { start: "", end: "" };
  }
  /* 日期档全表（弹窗用）；顶部胶囊只取前 5 档，本月/上月放弹窗内，避免表头过长 */
  var QUICK_DEF = [
    { v: "all", t: "全部" },
    { v: "today", t: "今天" },
    { v: "yday", t: "昨天" },
    { v: "7d", t: "近7天" },
    { v: "30d", t: "近30天" },
    { v: "month", t: "本月" },
    { v: "lastmonth", t: "上月" }
  ];
  var CAP_DEF = QUICK_DEF.slice(0, 5);
  function quickLabelOf(v) {
    var hit = QUICK_DEF.filter(function (o) { return o.v === v; })[0];
    return hit ? hit.t : "";
  }
  function isCapValue(v) {
    return CAP_DEF.some(function (o) { return o.v === v; });
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
  /* 行内日期简写：与今年同年只出 MM-DD，跨年才出完整 YYYY-MM-DD。
     活动行要在一行内放下"获客/登录/付费"三段，全写完整日期在 390px 下会折行把
     最后一段日期拆成两截（"2026-10-" / "30"）；同年省略年份不影响判读。 */
  function dShort(s) {
    if (!s || s === "—") return "—";
    return s.slice(0, 4) === String(new Date().getFullYear()) ? s.slice(5, 10) : s;
  }
  /* uni18：行内补出"获客日期"——日期胶囊/弹窗的日期档（今天/近7天/本月…）正是按它判定的，
     此前行内只显示"登录/付费"，选中「近7天」时若登录日期在区间外，看上去就像筛错了。
     取值与 matchWith 完全同源（boundAt||createdAt，取前 10 位）。 */
  function activityText(l) {
    var pay = lastPayDate(l);
    var lead = (l.boundAt || l.createdAt || "").slice(0, 10);
    return "获客 " + dShort(lead) + " · 登录 " + dShort(loginDate(l)) +
      (pay ? " · 付费 " + dShort(pay) : " · 尚未付费");
  }
  /* 付费状态口径：是否存在任意一条消费记录（与 lifecycle 正交） */
  function paidFlag(l) { return Array.isArray(l.consumption) && l.consumption.length > 0; }
  /* 整数百分比；分母 0 显示 — */
  function pctOf(part, whole) { return whole > 0 ? Math.round(part / whole * 100) + "%" : "—"; }

  /* ---------- 权限矩阵（6 身份；写权限逐行在运行时按桶判断） ---------- */
  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        var direct = s.leads.direct || [], school = s.leadsSub || s.leads.school || [];
        return {
          self: direct,                                // 省代自营线（direct 桶含管理员/员工码，agent 已合并）
          school: school,                              // 二级线（独立桶 leadsSub，省代统计口径不受污染）
          channelMap: Object.assign(mapChannel(direct, "direct"), mapChannel(school, "school")),
          showChannel: true,
          showMembers: true,
          canScope: true,                             // 唯一可见视角多选入口
          canFollow: true, canStage: true,            // 逐行：仅 self 行可写，sub 行只读（§3.3）
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
        var direct = s.leads.direct || [], school = s.leadsSub || s.leads.school || [];
        return {
          self: direct,
          school: school,
          channelMap: Object.assign(mapChannel(direct, "direct"), mapChannel(school, "school")),
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
        var mine = (s.leads.direct || []).filter(function (l) { return l.owner === my; });
        return {
          self: mine,
          school: [],
          channelMap: mapChannel(s.leads.direct || [], "direct"),
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
          /* 20261030 评审决策：store 守卫已放行 isOwner，sub_admin 可跟进/更新本企业 school 全量线索；
             by 归属由 store 写为 profile.contact（陈志远）。sub_legal 仍只读（ctx.readonly 门控）。 */
          canFollow: true, canStage: true,
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

  /* ---------- 更新阶段 sheet（uni11 §4.3：8 值单选列表，默认当前 lifecycle，双写落盘） ---------- */
  function stageSheet(ctx, Uni, vm, lead, onDone) {
    var cur = lifecycleOf(lead);
    var rows = LIFECYCLES.map(function (v) {
      return '<button type="button" class="ir-radio' + (v === cur ? " is-on" : "") + '" data-v="' + ui.esc(v) + '">' +
        '<span class="ir-radio__dot"></span><span>' + ui.esc(v) + "</span></button>";
    }).join("");
      var sh = Uni.sheet({
        title: "更新用户阶段",
        body: '<div class="ir-radiolist">' + rows + '</div>' +
          '<div class="uh-note">阶段更新后本页徽章与漏斗即时刷新，并同步记录到获客转化漏斗。</div>',
        footer: [{ t: "取消", kind: "ghost" },
        { t: "确认更新", kind: "primary", onClick: function () {
            var it = document.querySelector(".ir-radiolist .ir-radio.is-on");
            var life = it ? it.getAttribute("data-v") : "";
            if (!life) { Uni.toast("请选择新阶段"); return false; }
            /* 双写：先内存写 lifecycle，再 actGuarded 一次 save 落盘两个字段（store.js 零改动） */
            lead.lifecycle = life;
            var r = Uni.actGuarded("lead/stage", { channel: bucketOf(vm, lead), id: lead.id, stage: STAGE_BY_LIFECYCLE[life] });
            if (r && r.ok && onDone) onDone();
          } }]
      });
      /* 单选行点击绑定（sheet 挂在 body 下，不走 el 委派；此前缺失导致选中态不可切换） */
      sh.querySelectorAll(".ir-radiolist .ir-radio").forEach(function (r) {
        r.addEventListener("click", function () {
          sh.querySelectorAll(".ir-radiolist .ir-radio").forEach(function (x) { x.classList.remove("is-on"); });
          r.classList.add("is-on");
        });
      });
    }

  /* APP 操作记录（接口规格：lead.ops = [{type,at,desc,meta?}]；type 枚举
     register 注册完成 / login App登录 / entry 提交入驻申请 / unlock 解锁供需 /
     order 下单支付。当前由种子 opsOf 派生，绝不编造。） */
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

  /* ---------- 详情 sheet（perm 为逐行运行时写权限门控；sub 行只读说明） ---------- */
  function detailSheet(ctx, Uni, vm, lead, perm, onDone) {
    perm = perm || { canFollow: false, canStage: false };
    var life = lifecycleOf(lead);
    var notes = lead.notes || [];            // school 桶 lead 无 notes，必须兜底 []
    var timeline = notes.length
      ? notes.map(function (n) {
          return '<div class="uc-tl__item"><div class="uc-tl__dot"></div>' +
            '<div class="uc-tl__body"><div class="uc-tl__t">' + ui.esc(n.text) + "</div>" +
            '<div class="uc-tl__s">' + ui.esc(n.by) + " · " + ui.esc(n.at) + "</div></div></div>";
        }).join("")
      : '<div class="uh-note">暂无跟进记录</div>';
    var followBox = (!ctx.readonly && perm.canFollow)
      ? '<div class="field"><label class="field-label">新增跟进</label>' +
        '<textarea class="textarea" id="ur-lead-note" placeholder="记录本次沟通要点，保存后留痕"></textarea></div>'
      : "";
    var foot = [];
    if (perm.canStage && !ctx.readonly) {
      foot.push({ t: "更新用户阶段", kind: "ghost", onClick: function () {
        stageSheet(ctx, Uni, vm, lead, onDone); return false;
      } });
    }
    foot.push((!ctx.readonly && perm.canFollow)
      ? { t: "保存跟进", kind: "primary", onClick: function (sh) {
          var v = sh.querySelector("#ur-lead-note").value.trim();
          if (!v) { Uni.toast("请填写跟进内容"); return false; }
          var r = Uni.actGuarded("lead/follow", { channel: bucketOf(vm, lead), id: lead.id, note: v });
          if (r.ok) { Uni.toast("已保存跟进", "ok"); if (onDone) onDone(); }
        } }
      : { t: "关闭", kind: "primary" });
    var c = channelOf(Uni, vm, lead, ctx.staffName);
    var paid = paidFlag(lead);
    Uni.sheet({
      title: "获客详情",
      body:
        (vm.subBindNote ? '<div class="uh-readnote" style="margin-bottom:12px">' + ui.icon("info", 14) + "<span>" + ui.esc(vm.subBindNote) + "</span></div>" : "") +
        (lead.__line === "sub" ? '<div class="uh-readnote" style="margin-bottom:12px">' + ui.icon("info", 15) + "<span>二级线用户由对应二级企业维护，本视角下仅可查看。</span></div>" : "") +
        '<div class="uh-sheetkv"><span class="k">姓名</span><span class="v">' + ui.esc(Uni.maskName(lead.name)) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">手机</span><span class="v">' + ui.esc(Uni.maskPhone(lead.phone)) + "</span></div>" +
        (lead.company ? '<div class="uh-sheetkv"><span class="k">企业名称</span><span class="v">' + ui.esc(Uni.maskCompany(lead.company)) + "</span></div>" : "") +
        '<div class="uh-sheetkv"><span class="k">来源成员</span><span class="v">' + ui.esc(lead.owner || "—") + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">获客方式</span><span class="v">' + ui.esc(c.label) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">活跃度</span><span class="v">' + ui.esc(activityText(lead)) + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">绑定时间</span><span class="v">' + ui.esc(lead.boundAt || lead.createdAt || "—") + "</span></div>" +
        '<div class="uh-sheetkv"><span class="k">当前阶段</span><span class="v">' +
          '<span class="uh-badge ' + LIFECYCLE_BADGE[life] + '">' + ui.esc(life) + "</span></span></div>" +
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

    /* uni15：码名称索引（自营码 channels.direct + 二级码 subs[].channels / channels.school）
       与来源成员所在公司（二级线按 subId 查合作企业，其余回退 profile 企业名） */
    function buildCodeMap() {
      var m = {}, ch = ctx.s.channels || {};
      (ch.direct || []).forEach(function (c) { if (c && c.code) m[c.code] = c; });
      (ch.school || []).forEach(function (c) { if (c && c.code) m[c.code] = c; });
      (ctx.s.subs || []).forEach(function (s) { (s.channels || []).forEach(function (c) { if (c && c.code) m[c.code] = c; }); });
      return m;
    }
    var codeMap = buildCodeMap();
    function memberCompanyOf(l) {
      var sub = (ctx.s.subs || []).filter(function (x) { return x.id === l.subId; })[0];
      if (sub && sub.name) return sub.name;
      return (ctx.s.profile && ctx.s.profile.name) || "";
    }
    function codeNameOf(l) {
      var code = l.code || "";
      if (!code) return "";
      var c = codeMap[code];
      return c ? c.name : "";
    }

    /* ---- 运行时交互态（身份差异之外的页面态） ---- */
    var view = "list";                 // list | stats | compare
    /* 视角集合（uni11 §3）：默认仅自营线；二级线默认不选，与 uni10 默认口径一致 */
    var scopeSet = { self: true, sub: false };
    /* 视角入口兜底：无任何二级企业（subs 为空）时入口整体隐藏，保持自营线单路径 */
    var canScope = !!vm.canScope && (ctx.s.subs || []).length > 0;
    var visibleCount = PAGE_SIZE;
    /* 筛选组：组内单选、组间 AND（弹窗临时态在打开时预填）
       fQuick ∈ all | today | yday | 7d | 30d | month | lastmonth | custom
       custom = 用户手改日期区间，摘要改为展示区间而非档名 */
    var fQuick = "all", fStart = "", fEnd = "", fChannel = "all", fMember = "all", fStage = "all", fPaid = "all";

    /* 合并集合（§3.2：self=direct 标 __line=self；sub=leadsSub||school 标 __line=sub 且 __channelKey='sub'）
       uni18：按获客日期（boundAt||createdAt）倒序。原实现直接沿用种子声明顺序，自营线整段在前、
       二级线整段在后——切到「全部」视角时最新线索反而沉到最后，与"获客记录"应新→旧的阅读预期相反，
       也让「今天/昨天」这类档位的命中行散落各页。日期相同者保持种子原序（sort 稳定）。 */
    function mergedCollection() {
      var out = [];
      if (scopeSet.self) (vm.self || []).forEach(function (l) { l.__line = "self"; out.push(l); });
      if (scopeSet.sub) (vm.school || []).forEach(function (l) { l.__line = "sub"; l.__channelKey = "sub"; out.push(l); });
      out.sort(function (a, b) {
        var da = a.boundAt || a.createdAt || "", db = b.boundAt || b.createdAt || "";
        return da < db ? 1 : da > db ? -1 : 0;
      });
      return out;
    }
    function currentMembers() { return ownerList(mergedCollection()); }
    /* 写权限逐行按桶（§3.3）：admin 仅 self 行可写，sub 行只读；legal_rep 恒只读（ctx.readonly） */
    function rowPerm(lead) {
      if (ctx.readonly) return { canFollow: false, canStage: false };
      if (vm.canScope && lead.__line === "sub") return { canFollow: false, canStage: false };
      return { canFollow: !!vm.canFollow, canStage: !!vm.canStage };
    }

    /* 筛选匹配：组内单选组间 AND（阶段=lifecycle 8 值）。
       拆出 matchWith(l, f)：页头筛选与弹窗"实时命中数"共用同一套判定，口径不可能分叉。 */
    function fstate() {
      return { start: fStart, end: fEnd, channel: fChannel, member: fMember, stage: fStage, paid: fPaid };
    }
    function matchWith(l, f) {
      var d = (l.boundAt || l.createdAt || "").slice(0, 10);
      if (f.start && d < f.start) return false;
      if (f.end && d > f.end) return false;
      if (f.channel !== "all" && channelOf(Uni, vm, l, staffName).key !== f.channel) return false;
      if (f.member !== "all" && (l.owner || "") !== f.member) return false;
      if (f.stage !== "all" && lifecycleOf(l) !== f.stage) return false;
      if (f.paid === "yes" && !paidFlag(l)) return false;
      if (f.paid === "no" && paidFlag(l)) return false;
      return true;
    }
    function matches(l) { return matchWith(l, fstate()); }
    function countWith(f) {
      return mergedCollection().filter(function (l) { return matchWith(l, f); }).length;
    }
    function resetFilters() {
      fQuick = "all"; fStart = ""; fEnd = ""; fChannel = "all"; fMember = "all"; fStage = "all"; fPaid = "all";
    }
    /* 已激活筛选摘要（§2.4 短词逐字）；quick 档只出档名，自定义档只出区间，
       不再出现"近7天 · 2026-10-26–2026-11-01"这种同一信息说两遍的写法 */
    function activeSummary() {
      var out = [];
      if (fQuick === "custom") {
        if (fStart || fEnd) out.push((fStart || "…") + "–" + (fEnd || "…"));
      } else if (fQuick !== "all") {
        /* all 不算筛选态：否则默认页会显示「已筛选：全部」并把胶囊组挤掉 */
        var lbl = quickLabelOf(fQuick);
        if (lbl) out.push(lbl);
      }
      if (fChannel !== "all") out.push(CH_SHORT[fChannel] || fChannel);
      if (fMember !== "all") out.push(fMember);
      if (fStage !== "all") out.push(fStage);
      if (fPaid === "yes") out.push("已付费");
      else if (fPaid === "no") out.push("未付费");
      return out;
    }

    /* ---------- 筛选底部弹窗（uni17：两列布局 + 实时命中数） ----------
       左列固定标签、右列选项流式换行；每改一项整块重绘（paint），
       选中态由 t 单一推导，不会出现"手改日期后旧档仍高亮"的错位。 */
    function blankFilters() {
      return { quick: "all", start: "", end: "", channel: "all", member: "all", stage: "all", paid: "all" };
    }
    function chipsHtml(name, cur, opts) {
      return '<div class="ir-chips">' + opts.map(function (o) {
        return '<button type="button" class="ir-chip' + (o.v === cur ? " is-on" : "") +
          '" data-fchip="' + name + '" data-fcv="' + ui.esc(o.v) + '">' + ui.esc(o.t) + "</button>";
      }).join("") + "</div>";
    }
    /* 区间提示：与实际过滤用同一份 quickRange，标签与区间不可能对不上 */
    function dateHint(q, s, e) {
      if (q === "custom") {
        return (s || e)
          ? "自定义区间：" + (s || "…") + " – " + (e || "…")
          : "自定义区间：尚未选择日期（当前不限日期）";
      }
      if (q === "all") return "不限日期";
      var r = quickRange(q), lbl = quickLabelOf(q);
      if (q === "today" || q === "yday") return lbl + "：" + r.start;
      if (q === "month") return "本月 1 日至今天：" + r.start + " – " + r.end;
      if (q === "lastmonth") return "上月整月：" + r.start + " – " + r.end;
      return lbl + "：" + r.start + " – " + r.end + "（含今天）";
    }
    function openFilterSheet() {
      var t = { quick: fQuick, start: fStart, end: fEnd, channel: fChannel, member: fMember, stage: fStage, paid: fPaid };
      var sh = Uni.sheet({
        title: "筛选",
        body: '<div class="ir-filtbody"></div>',
        footer: [
          { t: "重置", kind: "ghost", onClick: function () { t = blankFilters(); paint(); return false; } },
          { t: "确认", kind: "primary", onClick: function () {
              /* 自定义档但两个日期都空 = 没设日期条件，回落到"全部"，避免摘要空白却挂着筛选态 */
              if (t.quick === "custom" && !t.start && !t.end) t.quick = "all";
              fQuick = t.quick; fStart = t.start; fEnd = t.end;
              fChannel = t.channel; fMember = t.member; fStage = t.stage; fPaid = t.paid;
              visibleCount = PAGE_SIZE; renderAll();
            } }
        ]
      });
      /* common.js 的 boostStickyFoot 会在弹出后的 rAF 里给 .sheet-body 预留
         calc(var(--sp-5) + 78px)（约 98px）置底按钮空间；本弹窗内容短、按钮本来
         就在文档流里，这段留白会变成正文与按钮之间的一大片空白，故清掉。
         用双层 rAF 保证排在 boost 自己的 rAF 之后执行。 */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var b = sh.querySelector(".sheet-body");
          if (b && !b._irNoPad) { b._irNoPad = 1; b.style.paddingBottom = ""; }
        });
      });
      var bodyEl = sh.querySelector(".ir-filtbody");
      function fg(label, inner) {
        return '<div class="ir-fg"><div class="ir-fg__head">' + label + '</div>' +
          '<div class="ir-fg__body">' + inner + "</div></div>";
      }
      function innerHtml() {
        var parts = [];
        /* 日期组（恒显）：7 档 + 自定义；自定义时才展开两个日期输入 */
        var customOn = t.quick === "custom";
        parts.push(fg("日期",
          chipsHtml("quick", t.quick, QUICK_DEF.concat([{ v: "custom", t: "自定义" }])) +
          '<div class="ir-dates"' + (customOn ? "" : " hidden") + ">" +
            '<input type="date" class="input" data-fs-start value="' + ui.esc(t.start) + '" aria-label="开始日期">' +
            '<span class="ir-dates__sep">至</span>' +
            '<input type="date" class="input" data-fs-end value="' + ui.esc(t.end) + '" aria-label="结束日期">' +
          "</div>" +
          '<div class="ir-fghint">' + ui.esc(dateHint(t.quick, t.start, t.end)) + "</div>"));
        /* 渠道组：仅含 self 时渲染；集合含 sub 时追加 CH-S；仅 sub 选中时整组隐藏（§2.2/§6） */
        if (vm.showChannel && scopeSet.self) {
          var chOpts = [
            { v: "all", t: "全部" }, { v: "province", t: "管理员码CH-P" },
            { v: "staff", t: "员工码CH-E" }
          ];
          if (scopeSet.sub) chOpts.push({ v: "sub", t: "二级码CH-S" });
          parts.push(fg("渠道", chipsHtml("channel", t.channel, chOpts)));
        }
        /* 成员组：showMembers 且派生 owner ≥2 且列表非空 */
        var mems = currentMembers();
        if (vm.showMembers && mems.length > 1) {
          parts.push(fg("成员", chipsHtml("member", t.member,
            [{ v: "all", t: "全部" }].concat(mems.map(function (m) { return { v: m.key, t: m.label }; })))));
        }
        /* 阶段组：lifecycle 8 值（恒显） */
        parts.push(fg("阶段",
          chipsHtml("stage", t.stage, [{ v: "all", t: "全部" }].concat(LIFECYCLES.map(function (v) { return { v: v, t: v }; }))) +
          '<div class="ir-fghint">已认证 = 完成个人或企业认证；已入驻 = 完成企业入驻。</div>'));
        /* 付费组（恒显） */
        parts.push(fg("付费", chipsHtml("paid", t.paid,
          [{ v: "all", t: "全部" }, { v: "yes", t: "已付费" }, { v: "no", t: "未付费" }])));
        /* 实时命中数：与列表同一判定函数，改一项立刻看到影响 */
        parts.push('<div class="ir-fcount">当前条件命中 <b class="ir-num">' + countWith(t) + "</b> 条</div>");
        return parts.join("");
      }
      function bind() {
        bodyEl.querySelectorAll("[data-fchip]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var g = btn.getAttribute("data-fchip"), v = btn.getAttribute("data-fcv");
            if (g === "quick") {
              t.quick = v;
              /* 选回快捷档 → 区间由 quickRange 重算；切到自定义 → 保留现有区间供微调 */
              if (v !== "custom") { var r = quickRange(v); t.start = r.start; t.end = r.end; }
            } else if (g === "channel") t.channel = v;
            else if (g === "member") t.member = v;
            else if (g === "stage") t.stage = v;
            else if (g === "paid") t.paid = v;
            paint();
          });
        });
        var si = bodyEl.querySelector("[data-fs-start]"), ei = bodyEl.querySelector("[data-fs-end]");
        function onDate() {
          t.quick = "custom";
          t.start = (si && si.value) || "";
          t.end = (ei && ei.value) || "";
          paint();
        }
        /* 用 change（选完日期才触发），避免逐字符重绘抢焦点 */
        if (si) si.addEventListener("change", onDate);
        if (ei) ei.addEventListener("change", onDate);
      }
      function paint() {
        bodyEl.innerHTML = innerHtml();
        bind();
      }
      paint();
    }

    /* ---------- 视角多选居中弹窗（§3：双复选，禁止空集） ---------- */
    function openScopeCenter() {
      var tSelf = scopeSet.self, tSub = scopeSet.sub;
      function rowHtml(k, on, label) {
        return '<button type="button" class="ir-scoperow" data-scopepick="' + k + '">' +
          '<span class="ir-cbx' + (on ? " is-on" : "") + '">' + ui.icon("check", 14) + "</span>" +
          "<span>" + label + "</span></button>";
      }
      var ov = Uni.center({
        title: "视角",
        body: '<div class="ir-scopebox">' +
          rowHtml("self", tSelf, "省代自营线") +
          rowHtml("sub", tSub, "二级线") +
          '<div class="uh-note">二级线用户由对应二级企业维护，勾选后该视角下数据只读。</div></div>',
        footer: [
          { t: "取消", kind: "ghost" },
          { t: "确认", kind: "primary", onClick: function () {
              if (!tSelf && !tSub) { Uni.toast("至少保留一条获客线"); return false; }
              if (tSelf === scopeSet.self && tSub === scopeSet.sub) return true;
              /* 切换视角 = 重置全部筛选 + 分页回 20（§3.2） */
              scopeSet = { self: tSelf, sub: tSub };
              resetFilters(); visibleCount = PAGE_SIZE; renderAll();
            } }
        ]
      });
      ov.querySelectorAll("[data-scopepick]").forEach(function (row) {
        row.addEventListener("click", function () {
          var k = row.getAttribute("data-scopepick");
          if (k === "self") tSelf = !tSelf; else tSub = !tSub;
          if (!tSelf && !tSub) {
            Uni.toast("至少保留一条获客线");
            if (k === "self") tSelf = true; else tSub = true;
          }
          row.querySelector(".ir-cbx").classList.toggle("is-on", k === "self" ? tSelf : tSub);
        });
      });
    }

    /* ---------- 记录视图：行（图标/lifecycle 徽章+付费胶囊相邻/手机/企业/来源/活跃） ---------- */
    var LEAD_TINT = {
      registered: "color-mix(in srgb, var(--primary-dim) 12%, transparent);color:var(--primary-dim)",
      onboarded: "color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)",
      paid: "color-mix(in srgb, var(--primary-dim) 18%, transparent);color:var(--primary-dim)",
      repaid: "color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)",
      lost: "color-mix(in srgb, var(--warning) 12%, transparent);color:var(--warning-ink)"
    };
    function rowHtml(l) {
      var life = lifecycleOf(l);
      var paid = paidFlag(l);
      var srcCo = memberCompanyOf(l);
      var codeNm = codeNameOf(l);
      var row = '<div class="set-item" data-lead="' + ui.esc(l.id) + '">' +
        '<div class="si-ic" style="background:' + (LEAD_TINT[l.stage] || LEAD_TINT.registered) + '">' + ui.icon("user", 18) + '</div>' +
        '<div class="si-body">' +
          '<div class="si-title">' + ui.esc(Uni.maskName(l.name)) +
          '<span class="uh-badge ' + (LIFECYCLE_BADGE[life] || "uh-badge--mute") + ' uc-rowbadge">' + ui.esc(life) + "</span>" +
          '<span class="ir-paycap">' + (paid ? "已付费" : "未付费") + "</span></div>" +
          '<div class="si-sub">' + ui.esc(Uni.maskPhone(l.phone)) +
          (l.company ? " · " + ui.esc(Uni.maskCompany(l.company)) : "") + '</div>' +
          '<div class="si-sub">来源 ' + ui.esc(l.owner || "—") +
          (srcCo ? " · " + ui.esc(srcCo) : "") +
          (codeNm ? " · " + ui.esc(codeNm) : "") + '</div>' +
          '<div class="si-sub">' + ui.esc(activityText(l)) + '</div>' +
        '</div>' +
        '<span class="ir-rowright">' +
          '<span class="ir-chev">' + ui.icon("chev", 14) + "</span>" +
        "</span></div>";
      if (l.stage === "lost") {
        row += '<div class="uc-losttip">' + ui.icon("warn", 13) +
          "<span>超过 30 天未活跃，仅作提示（暂不支持回收/换绑）</span></div>";
      }
      return row;
    }
    /* 表头左侧：日期快捷胶囊组（uni14：仅日期快捷筛选时胶囊常驻并高亮当前档；
       存在渠道/成员/阶段/付费等筛选时原位替换为筛选摘要） */
    /* 只有"当前日期档正是胶囊里的某一档、且无其他筛选"时才留胶囊；
       本月/上月/自定义不在胶囊序列里，改走摘要，避免"胶囊全灰却挂着筛选态" */
    function dateOnlyActive() {
      return isCapValue(fQuick) && fQuick !== "all" &&
        fChannel === "all" && fMember === "all" && fStage === "all" && fPaid === "all";
    }
    function dateCapsHtml() {
      return '<span class="ir-datecaps">' + CAP_DEF.map(function (o) {
        return '<button type="button" class="ir-datecap' + (o.v === fQuick ? " is-on" : "") +
          '" data-datecap="' + o.v + '">' + o.t + "</button>";
      }).join("") + "</span>";
    }
    /* 筛选行（uni16：记录/统计/对比三视图顶部一致渲染；筛选态三视图同步生效） */
    function filterRowHtml() {
      var summary = activeSummary();
      var showCaps = summary.length === 0 || dateOnlyActive();
      return '<section class="uh-sec"><div class="uh-sechead ir-listhead">' +
        '<span class="ir-leftstate' + (summary.length && !showCaps ? " is-on" : "") + '">' +
        (showCaps
          ? dateCapsHtml()
          : '<span class="ir-dot" aria-hidden="true"></span><span class="ir-leftstate__tx">已筛选：' + ui.esc(summary.join(" · ")) + "</span>") +
        "</span>" +
        '<span class="more ir-filterbtn" data-filter-toggle>' +
        (summary.length ? '<span class="ir-dot" aria-hidden="true"></span>' : "") + "筛选</span>" +
        "</div></section>";
    }
    function listViewHtml() {
      var F = mergedCollection().filter(matches);
      var html = filterRowHtml();
      if (!F.length) {
        /* 视角/筛选为空 → 空态（二级线待接入说明仅在仅选二级线且桶空时提示） */
        if (scopeSet.sub && !scopeSet.self && !(vm.school || []).length) {
          var actSubs = (ctx.s.subs || []).filter(function (x) { return x.status === "active"; });
          return html + '<section class="uh-sec"><div style="margin-top:14px">' + Uni.emptyHtml("二级企业获客数据待接入", "当前版本暂无二级线获客流水，待数据接入后自动展示", "tray") + "</div>" +
            '<div class="uh-note ir-subnote">已合作二级企业（只读）：' +
            ui.esc(actSubs.map(function (x) { return x.name; }).join(" · ") || "—") + "</div></section>";
        }
        var filtered = activeSummary().length > 0;
        return html + '<section class="uh-sec"><div style="margin-top:14px">' + Uni.emptyHtml(
          filtered ? "暂无匹配用户" : V.empty.leads.title,
          filtered ? "当前筛选条件下没有符合的用户，可调整条件后重试" : V.empty.leads.desc, "user") + "</div></section>";
      }
      var shown = F.slice(0, visibleCount);
      var body = '<div class="uh-list ir-listflat" style="padding:0 14px">' + shown.map(rowHtml).join("") + "</div>";
      var rest = F.length - visibleCount;
      if (rest > 0) body += '<button type="button" class="btn btn-ghost ir-loadmore" data-loadmore>加载更多（剩余 ' + rest + " 条）</button>";
      else body += '<div class="ir-allloaded">已全部加载 · 共 ' + F.length + " 条</div>";
      return html + '<section class="uh-sec">' + body + "</section>";
    }

    /* ---------- 统计视图：漏斗现算（§4.4）+ 分组卡 ---------- */
    function kvRow(k, v) {
      return '<div class="uh-kv"><span class="k">' + k + '</span><span class="v ir-num">' + ui.esc(v) + "</span></div>";
    }
    function statsViewHtml() {
      var F = mergedCollection().filter(matches);
      var Fn = F.length;
      var html = filterRowHtml();
      var AUTH = { "已个人认证": 1, "已企业认证": 1, "已企业入驻": 1, "已加入认证企业": 1, "已加入入驻企业": 1 };
      var cReg = F.filter(function (l) { return lifecycleOf(l) !== "游客" && lifecycleOf(l) !== "流失"; }).length;
      var cAuth = F.filter(function (l) { return AUTH[lifecycleOf(l)]; }).length;
      var cSettled = F.filter(function (l) { var v = lifecycleOf(l); return v === "已企业入驻" || v === "已加入入驻企业"; }).length;
      var cConsume = F.filter(paidFlag).length;
      var cLost = F.filter(function (l) { return lifecycleOf(l) === "流失"; }).length;
      var onRate = Fn > 0 ? Math.round(cSettled / Fn * 100) + "%" : "—";
      var payRate = Fn > 0 ? Math.round(cConsume / Fn * 100) + "%" : "—";

      html += '<section class="uh-sec">' +
        '<div class="uh-finhead ir-fin"><div class="uh-eyebrow">获客漏斗概览</div>' +
        '<div class="uh-bignum ir-num">' + Fn + '<span class="ir-bignum-sub">当前筛选集</span></div></div>' +
        kvRow("总用户", Fn) + kvRow("已注册", cReg) + kvRow("已认证", cAuth) + kvRow("已入驻", cSettled) +
        kvRow("已消费", cConsume) + kvRow("流失", cLost) +
        kvRow("入驻率（已入驻/总用户）", onRate) + kvRow("付费率（已消费/总用户）", payRate) +
        "</section>";

      /* 按渠道分组 */
      var byCh = groupBy(F, function (l) { return channelOf(Uni, vm, l, staffName).key; });
      var chOrder = ["province", "staff", "sub", "other"];
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
      if (vm.showMembers && members.length > 1) {
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

    /* ---------- 对比视图：线别对比（双线选中才显示）+ 渠道条 + 成员条 ---------- */
    function compareBar(label, ratio, meta) {
      var w = Math.max(2, Math.round(ratio * 100));
      return '<div class="ir-cmprow"><div class="ir-cmprow__lbl">' + ui.esc(label) + '</div>' +
        '<div class="ir-bar-track"><div class="ir-bar-fill" style="width:' + w + '%"></div></div>' +
        '<div class="ir-cmprow__meta ir-num">' + ui.esc(meta) + "</div></div>";
    }
    function compareViewHtml() {
      var F = mergedCollection().filter(matches);
      var html = filterRowHtml();
      if (!F.length) {
        return html + '<section class="uh-sec">' + Uni.emptyHtml("暂无对比数据", "当前视角与筛选下没有获客记录", "tray") + "</section>";
      }
      /* 线别对比（§3.4）：仅 self+sub 双线均选中时显示，各自行内现算 */
      if (scopeSet.self && scopeSet.sub) {
        var sf = F.filter(function (l) { return l.__line === "self"; });
        var ub = F.filter(function (l) { return l.__line === "sub"; });
        var sp = sf.filter(paidFlag).length, up = ub.filter(paidFlag).length;
        var maxN = Math.max(sf.length, ub.length, 1);
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">线别对比</span></div>' +
          '<div class="ir-cmpcard">' +
          compareBar("省代自营线", sf.length / maxN, "注册 " + sf.length + " · 付费 " + sp + " · 付费率 " + pctOf(sp, sf.length)) +
          compareBar("二级线", ub.length / maxN, "注册 " + ub.length + " · 付费 " + up + " · 付费率 " + pctOf(up, ub.length)) +
          "</div></section>";
      }
      /* 渠道对比：合并集合现算（CH-P/CH-E/CH-S）；分组=1 降级单行汇总（§3.4） */
      var byCh = groupBy(F, function (l) { return channelOf(Uni, vm, l, staffName).key; });
      var chKeys = Object.keys(byCh).filter(function (k) { return k !== "other"; });
      if (chKeys.length === 1) {
        var g0 = byCh[chKeys[0]];
        var p0 = g0.filter(paidFlag).length;
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">渠道对比</span></div>' +
          '<div class="ir-cmpcard"><div class="ir-cmprow ir-cmp-single"><div class="ir-cmprow__lbl">' +
          ui.esc(CH_LABEL[chKeys[0]] || chKeys[0]) + "</div>" +
          '<div class="ir-cmprow__meta ir-num">注册 ' + g0.length + " · 付费率 " + pctOf(p0, g0.length) + "</div></div></div></section>";
      } else if (chKeys.length > 1) {
        var maxPaid = 0;
        chKeys.forEach(function (k) { maxPaid = Math.max(maxPaid, byCh[k].filter(paidFlag).length); });
        var chOrder = ["province", "staff", "sub"];
        var bars = chOrder.filter(function (k) { return byCh[k]; }).map(function (k) {
          var g = byCh[k];
          var paid = g.filter(paidFlag).length;
          return compareBar(CH_LABEL[k] || k, maxPaid > 0 ? paid / maxPaid : 0,
            "注册 " + g.length + " · 付费率 " + pctOf(paid, g.length));
        }).join("");
        html += '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">渠道对比</span></div>' +
          '<div class="ir-cmpcard">' + bars + "</div></section>";
      }
      /* 成员对比：条长 = 组内注册数 / max；无成员维度身份整卡不渲染 */
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
      return html;
    }

    /* ---------- 页面骨架 ---------- */
    function renderAll() {
      var html = "";
      /* 视角入口：页面标题行右侧（topbar-right；仅 canScope 且 subs 非空） */
      function syncScopeTop() {
        var btn = document.getElementById("ir-scope-top");
        if (!btn) return;
        if (!canScope) { btn.style.display = "none"; return; }
        btn.style.display = "";
        var hint = document.getElementById("ir-scope-hint");
        if (hint) hint.textContent = (scopeSet.self ? "自营线" : "") + (scopeSet.self && scopeSet.sub ? " + " : "") + (scopeSet.sub ? "二级线" : "");
      }
      /* ★ 全页唯一主 bar（记录/统计/对比）：.ir-mainbar 吸顶，不随内容滚动 */
      html += '<div class="ir-mainbar"><section class="uh-sec ir-mainsec"><div class="seg ir-mainseg" role="tablist">' +
        '<button class="seg-item' + (view === "list" ? " active" : "") + '" data-view="list">记录</button>' +
        '<button class="seg-item' + (view === "stats" ? " active" : "") + '" data-view="stats">统计</button>' +
        '<button class="seg-item' + (view === "compare" ? " active" : "") + '" data-view="compare">对比</button>' +
        "</div></section></div>";
      /* 锁条 / 权限说明条（按身份渲染，可空） */
      if (ctx.readonly) {
        html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          /* 2026-11-01 审计修复：此处原只取 V.lockedTitle，而暂停类标题挂在 vm.lockedTitle 上
             （V.lockedTitle 仅由 stateVariantFor 给法代改写），导致管理员在暂停态渲染出空标题。
             统一走 Uni.lockTitle：先认身份只读覆盖，再按企业实际状态判定。 */
          '<div><span class="lb-t">' + ui.esc(Uni.lockTitle(ctx, V)) + "（仅可查看）</span>" +
          '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
      }
      if (vm.note) {
        html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("lock", 15) + "<span>" + ui.esc(vm.note) + "</span></div></section>";
      }
      if (view === "list") html += listViewHtml();
      else if (view === "stats") html += statsViewHtml();
      else html += compareViewHtml();
      el.innerHTML = html;
      syncScopeTop();
    }

    renderAll();

    /* 视角入口挂到页面标题行右侧（topbar 在内容区 el 之外，直接绑定） */
    var topScopeBtn = document.getElementById("ir-scope-top");
    if (topScopeBtn) topScopeBtn.addEventListener("click", function () { openScopeCenter(); });

    /* 详情 sheet 查找索引（覆盖本身份全量集合） */
    function leadIndexOf() {
      var idx = {};
      (vm.self || []).forEach(function (l) { idx[l.id] = l; });
      (vm.school || []).forEach(function (l) { idx[l.id] = l; });
      return idx;
    }

    /* ---------- 事件委派（一次绑定，随 renderAll 重建子节点仍生效） ---------- */
    el.addEventListener("click", function (e) {
      /* 主 bar 视图切换（保留筛选态与视角集合，分页重置 20） */
      var v = e.target.closest("[data-view]");
      if (v) { view = v.getAttribute("data-view"); visibleCount = PAGE_SIZE; renderAll(); return; }
      /* 日期快捷胶囊：直接应用快捷日期档（全部=清除日期筛选） */
      var cap = e.target.closest("[data-datecap]");
      if (cap) {
        var dk = cap.getAttribute("data-datecap");
        fQuick = dk;
        if (dk === "all") { fStart = ""; fEnd = ""; }
        else { var dr = quickRange(dk); fStart = dr.start; fEnd = dr.end; }
        visibleCount = PAGE_SIZE; renderAll(); return;
      }
      /* 筛选底部弹窗 */
      if (e.target.closest("[data-filter-toggle]")) { openFilterSheet(); return; }
      /* 加载更多 */
      if (e.target.closest("[data-loadmore]")) { visibleCount += PAGE_SIZE; renderAll(); return; }
      /* 详情 sheet（逐行写权限门控） */
      var row = e.target.closest("[data-lead]");
      if (row) {
        var idx = leadIndexOf();
        var lead = idx[row.getAttribute("data-lead")];
        if (lead) detailSheet(ctx, Uni, vm, lead, rowPerm(lead), renderAll);
      }
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
