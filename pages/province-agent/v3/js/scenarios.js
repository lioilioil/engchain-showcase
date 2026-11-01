/* ============================================================
   scenarios.js · 演示场景种子（无外部依赖；数据全部与 UI 口径一致）
   场景：active / suspended / empty / dark / sub-active / sub-readonly / sub-dark
   说明：
   - 待办与消息由 store.todoOf / messagesOf 派生，种子不写 alerts 假数据
   - 线索 owner 字段用于员工（王敏）数据隔离演示
   - 渠道语义 20261030：删除招商码（agentCodes）、channels/leads 的 agent 桶合并入 direct
     （subs/subApps 的 channel:"agent" 为二级合作来源标记，非招商码，保留）
   - 所有金额为演示模拟数据，页面统一标注"模拟测算"
   ============================================================ */
(function () {
  "use strict";

  /* 相对日期锚（20261102）：以真实当天为锚生成 "YYYY-MM-DD"。
     原因：获客记录等页的日期快捷档（今天/昨天/近7天）按系统时钟现算，
     而种子此前全是静态绝对日期（最新 2026-10-18），时间一过这些档位必然全空，
     看起来像功能坏了。仅"近日线索"用相对日期，历史线索仍保持静态绝对日期。 */
  function dayAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    var p = function (v) { return ("0" + v).slice(-2); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ══════════════ 消息中心种子（20261102） ══════════════
     freeActs（动作留痕）：四川省授权范围内「信息解锁」这一原付费项对省代成员 +
     下级二级企业全员免费，每一次执行都留痕。一条记录就是四要素：
       谁（执行人 / 身份 / 所属企业）· 何时 · 解锁了什么（原付费项，带原价）
       · 对哪家目标企业（含所在城市与入口）
     元组位序：[执行人, 身份, 组织key, 目标企业, 解锁项key, 城市, 几天前, 时分, 入口]
     日期一律用 dayAgo(n) 相对当前时钟生成 —— 写死绝对日期的话，
     「本月 / 上月 / 近 6 月趋势」一过月就整体失效（任务 4 踩过的同一个坑）。
     只覆盖当前演示时间窗（约 3 个月）；更早的历史不在演示范围内。 */
  var FREE_ORGS = {
    pv: { name: "四川锦程工程供应链有限公司", short: "锦程供应链", layer: "省代", id: "province" },
    rj: { name: "成都蓉建科贸有限公司", short: "蓉建科贸", layer: "二级企业", id: "sub-rongjian" },
    lz: { name: "泸州川南建材有限公司", short: "川南建材", layer: "二级企业", id: "sub-luzhou" },
    yb: { name: "宜宾叙府工程设备有限公司", short: "叙府工程", layer: "二级企业", id: "sub-yibin" },
    ls: { name: "乐山嘉州建设材料有限公司", short: "嘉州建材", layer: "二级企业", id: "sub-leshan" },
    sn: { name: "遂宁锦华商贸有限公司", short: "锦华商贸", layer: "二级企业", id: "sub-suining" },
    gy: { name: "广元利州工程服务有限公司", short: "利州工程", layer: "二级企业", id: "sub-guangyuan" },
    nj: { name: "内江甜城物资有限公司", short: "甜城物资", layer: "二级企业", id: "sub-neijiang" },
    zg: { name: "自贡富顺机械有限公司", short: "富顺机械", layer: "二级企业", id: "sub-zigong" }
  };
  /* 原付费项与单价：省内免费后实付 ¥0，原价即折抵额 */
  var FREE_ITEMS = {
    gs: { t: "企业工商信息", p: 30 },
    fr: { t: "法人及联系人", p: 30 },
    lx: { t: "企业联系方式", p: 20 },
    zz: { t: "资质证书", p: 50 },
    zj: { t: "在建项目", p: 60 },
    tb: { t: "招投标记录", p: 50 },
    yj: { t: "企业业绩档案", p: 80 }
  };
  var FREE_ACT_ROWS = [
    /* —— 本月（今天）—— */
    ["王敏", "渠道专员", "pv", "成都锦程商贸有限公司", "gs", "成都", 0, "09:12", "扫码"],
    ["王建国", "法定代表人", "pv", "内江川威建设有限公司", "zz", "内江", 0, "08:41", "搜索"],
    ["刘颖", "渠道专员", "rj", "成都筑信工程有限公司", "lx", "成都", 0, "10:26", "分享"],
    ["陈志远", "法定代表人", "rj", "四川明驰装饰工程有限公司", "zj", "成都", 0, "11:05", "搜索"],
    ["何斌", "法定代表人", "lz", "泸州汇川建材有限公司", "tb", "泸州", 0, "13:47", "推荐"],
    ["唐雪", "法定代表人", "gy", "广元朝天建筑劳务有限公司", "gs", "广元", 0, "15:20", "扫码"],
    /* —— 上月 —— */
    ["王敏", "渠道专员", "pv", "自贡大山铺建筑劳务有限公司", "lx", "自贡", 1, "16:33", "分享"],
    ["罗刚", "法定代表人", "yb", "宜宾临港物流服务部", "gs", "宜宾", 1, "09:05", "搜索"],
    ["张敏", "渠道专员", "lz", "什邡恒运商贸有限公司", "fr", "德阳", 1, "14:12", "扫码"],
    ["王建国", "法定代表人", "pv", "绵阳恒达商贸有限公司", "yj", "绵阳", 2, "10:48", "搜索"],
    ["杨帆", "法定代表人", "ls", "乐山五通桥物资经营部", "lx", "乐山", 2, "11:36", "扫码"],
    ["黄磊", "法定代表人", "sn", "遂宁船山机电安装队", "zz", "遂宁", 2, "17:02", "推荐"],
    ["刘颖", "渠道专员", "rj", "德阳华瑞物资有限公司", "tb", "德阳", 3, "09:27", "搜索"],
    ["王敏", "渠道专员", "pv", "南充顺通安装工程有限公司", "gs", "南充", 4, "13:15", "扫码"],
    ["张强", "法定代表人", "nj", "内江威远建材有限公司", "zj", "内江", 4, "15:41", "分享"],
    ["陈志远", "法定代表人", "rj", "广汉鑫诚建材有限公司", "yj", "广汉", 5, "10:09", "搜索"],
    ["周琳", "渠道专员", "gy", "广元旺苍砂石有限公司", "zz", "广元", 6, "16:58", "扫码"],
    ["王建国", "法定代表人", "pv", "成都经开工程监理有限公司", "tb", "成都", 8, "11:22", "推荐"],
    ["王丽", "渠道专员", "yb", "宜宾叙州建设劳务有限公司", "lx", "宜宾", 8, "14:05", "扫码"],
    ["刘波", "法定代表人", "zg", "自贡富顺砼业有限公司", "gs", "自贡", 10, "09:44", "搜索"],
    ["李倩", "渠道专员", "ls", "峨眉山景城装饰有限公司", "fr", "乐山", 10, "10:52", "分享"],
    ["王敏", "渠道专员", "pv", "眉山岷东建筑安装有限公司", "zj", "眉山", 12, "15:18", "搜索"],
    ["刘燕", "渠道专员", "sn", "射洪鑫源建材有限公司", "tb", "遂宁", 14, "11:07", "扫码"],
    ["陈曦", "渠道专员", "zg", "富顺东湖劳务服务部", "lx", "自贡", 14, "16:26", "推荐"],
    ["王建国", "法定代表人", "pv", "资阳雁江机电安装有限公司", "zz", "资阳", 16, "10:31", "扫码"],
    ["孙浩", "渠道专员", "nj", "隆昌市鑫和物流有限公司", "gs", "内江", 18, "13:49", "搜索"],
    ["陈志远", "法定代表人", "rj", "成都温江市政工程队", "yj", "成都", 18, "17:11", "分享"],
    ["何斌", "法定代表人", "lz", "泸州纳溪建工有限公司", "zj", "泸州", 20, "09:38", "扫码"],
    ["王敏", "渠道专员", "pv", "达州通川路桥工程有限公司", "lx", "达州", 22, "14:24", "搜索"],
    ["罗刚", "法定代表人", "yb", "屏山县锦屏建设有限公司", "zz", "宜宾", 22, "16:02", "推荐"],
    ["杨帆", "法定代表人", "ls", "犍为县嘉信建材有限公司", "gs", "乐山", 24, "10:16", "扫码"],
    ["周琳", "渠道专员", "gy", "苍溪县水利工程有限公司", "tb", "广元", 26, "15:33", "搜索"],
    ["王建国", "法定代表人", "pv", "广安前锋装饰工程有限公司", "yj", "广安", 28, "11:49", "扫码"],
    ["张强", "法定代表人", "nj", "资中县永盛建材有限公司", "fr", "内江", 30, "16:41", "分享"],
    /* —— 前两月 —— */
    ["刘颖", "渠道专员", "rj", "绵阳润泽商贸有限公司", "gs", "绵阳", 33, "09:21", "搜索"],
    ["王敏", "渠道专员", "pv", "巴中恩阳水利工程有限公司", "zz", "巴中", 35, "14:07", "扫码"],
    ["李倩", "渠道专员", "ls", "夹江县雅城建安公司", "lx", "乐山", 37, "10:35", "推荐"],
    ["陈志远", "法定代表人", "rj", "什邡市恒信机械有限公司", "tb", "德阳", 40, "15:52", "搜索"],
    ["王建国", "法定代表人", "pv", "雅安雨城园林绿化有限公司", "zj", "雅安", 42, "11:14", "扫码"],
    ["罗刚", "法定代表人", "yb", "大英县卓越建材有限公司", "fr", "遂宁", 48, "13:42", "分享"],
    ["何斌", "法定代表人", "lz", "合江县长江砂石有限公司", "lx", "泸州", 51, "10:08", "推荐"],
    ["王敏", "渠道专员", "pv", "攀枝花仁和钢构有限公司", "zz", "攀枝花", 54, "15:19", "搜索"],
    ["何斌", "法定代表人", "lz", "沐川县绿源林业有限公司", "gs", "乐山", 57, "11:47", "扫码"],
    ["王建国", "法定代表人", "pv", "成都天府新区建设投资有限公司", "zj", "成都", 63, "09:33", "搜索"],
    ["陈志远", "法定代表人", "rj", "德阳市旌阳区恒达建材有限公司", "zz", "德阳", 66, "14:51", "扫码"],
    ["王敏", "渠道专员", "pv", "泸州龙马潭物流有限公司", "tb", "泸州", 70, "10:26", "分享"],
    ["刘颖", "渠道专员", "rj", "广汉市三星机械有限公司", "yj", "广汉", 74, "16:04", "搜索"],
    ["王敏", "渠道专员", "pv", "叙永县永宁建工有限公司", "gs", "泸州", 79, "11:38", "扫码"],
    ["王建国", "法定代表人", "pv", "成都市新都区建工劳务有限公司", "lx", "成都", 84, "15:27", "推荐"]
  ];
  /* onlyOrgKey 非空时只返回该组织的执行记录（二级企业视角只看得见自己的成员） */
  function buildFreeActs(onlyOrgKey) {
    var out = [];
    FREE_ACT_ROWS.forEach(function (r, i) {
      if (onlyOrgKey && r[2] !== onlyOrgKey) return;
      var org = FREE_ORGS[r[2]], item = FREE_ITEMS[r[4]];
      if (!org || !item) return;
      var at = dayAgo(r[6]) + " " + r[7];
      out.push({
        id: "FA-" + at.replace(/[^0-9]/g, "").slice(0, 8) + "-" + ("00" + (i + 1)).slice(-3),
        at: at,
        month: at.slice(0, 7),
        actor: r[0], role: r[1],
        org: org.name, orgShort: org.short, orgId: org.id, layer: org.layer,
        target: r[3], item: item.t, price: item.p,
        city: r[5], via: r[8]
      });
    });
    return out;
  }
  /* 省代视角的留痕覆盖省代本身 + 全部下级二级企业，故按组织去重排序 */
  function freeActsProvince() { return buildFreeActs(null); }
  function freeActsSub() { return buildFreeActs("rj"); }

  /* 系统消息（平台公告 / 安全 / 维护 / 版本）：与 msgLog 的业务通知分开存放，
     因为 msgLog 还要喂首页「最近动态」，塞公告会把动态流冲淡。 */
  function sysMsgsProvince() {
    return [
      { id: "SM-P-05", icon: "refresh", type: "info", tag: "版本", at: dayAgo(6) + " 10:00",
        title: "APP 3.2.0 已更新", desc: "新增「动作留痕」与省内免费额度看板",
        body: "本次更新内容：\n1. 消息中心新增「动作留痕」，可查询省代与二级企业成员在 APP 内执行的原付费项免费解锁记录，并支持按月统计；\n2. 工作台首页待办新增分类计数；\n3. 对账单生成速度优化，10 万条明细内秒开。\n如更新后出现异常，可在「设置 - 关于」中反馈。" },
      { id: "SM-P-04", icon: "refresh", type: "warn", tag: "维护", at: dayAgo(4) + " 09:30", to: "",
        title: "系统维护通知（11-03 02:00–04:00）", desc: "维护期间解锁与对账功能暂停约 2 小时",
        body: "为提升对账与结算稳定性，平台将于 11-03 02:00–04:00 进行数据库扩容。\n维护期间：信息解锁、对账单生成、付款登记暂不可用；查看类功能不受影响。\n已提交的付款登记会在维护结束后自动补录，无需重复操作。" },
      { id: "SM-P-03", icon: "shield", type: "danger", tag: "安全", at: dayAgo(2) + " 21:14",
        title: "异地登录提醒", desc: "王敏 于 泸州市 使用新设备登录",
        body: "账号「四川锦程工程供应链有限公司」于 " + dayAgo(2) + " 21:14 在泸州市使用新设备登录。\n如非本人操作，请立即修改密码并联系平台客服冻结账号。" },
      { id: "SM-P-02", icon: "receipt", type: "info", tag: "规则", at: dayAgo(3) + " 18:00", to: "reconcile.html",
        title: "2026-11 对账结算周期说明", desc: "结算日改为每月 25 日出账、次月 5 日截止",
        body: "自 2026-11 起，两级对账单统一在每月 25 日出具，核对与平账截止日为次月 5 日。\n逾期未平账的账单将进入「逾期」状态，并按合作协议第 6 条计收滞纳金。\n二级企业侧账单与省代侧账单同期出具，双方各自确认后由平台统一汇总。" },
      { id: "SM-P-01", icon: "bell", type: "ok", tag: "公告", at: dayAgo(5) + " 09:00",
        title: "省内免费解锁权益已生效", desc: "四川省内信息解锁对省代及二级企业全员免费",
        body: "自 " + dayAgo(5) + " 起，四川省授权范围内的全部成员（含省代企业成员与下级二级企业全员）在 APP 内解锁下列信息不再扣费：\n企业工商信息、法人及联系人、企业联系方式、资质证书、在建项目、招投标记录、企业业绩档案。\n原付费价格仅作为折抵金额记录，用于核算省内免费额度使用情况；超出四川省授权范围或解锁非免费项时仍按原价计费。\n每一次免费解锁都会写入「动作留痕」，省代管理员可查看全部成员记录，成员本人可查看本人记录。" }
    ];
  }
  function sysMsgsSub() {
    return [
      { id: "SM-S-03", icon: "refresh", type: "info", tag: "版本", at: dayAgo(6) + " 10:00",
        title: "APP 3.2.0 已更新", desc: "新增「动作留痕」与省内免费额度看板",
        body: "本次更新内容：\n1. 消息中心新增「动作留痕」，可查询本企业成员在 APP 内执行的原付费项免费解锁记录；\n2. 对账单生成速度优化。\n如更新后出现异常，可在「设置 - 关于」中反馈。" },
      { id: "SM-S-02", icon: "refresh", type: "warn", tag: "维护", at: dayAgo(4) + " 09:30",
        title: "系统维护通知（11-03 02:00–04:00）", desc: "维护期间解锁与对账功能暂停约 2 小时",
        body: "为提升对账与结算稳定性，平台将于 11-03 02:00–04:00 进行数据库扩容。\n维护期间：信息解锁、对账单生成、付款登记暂不可用；查看类功能不受影响。" },
      { id: "SM-S-01", icon: "bell", type: "ok", tag: "公告", at: dayAgo(5) + " 09:00",
        title: "省内免费解锁权益已生效", desc: "本企业全员在四川省内解锁信息不再扣费",
        body: "自 " + dayAgo(5) + " 起，四川省授权范围内的全部成员在 APP 内解锁下列信息不再扣费：\n企业工商信息、法人及联系人、企业联系方式、资质证书、在建项目、招投标记录、企业业绩档案。\n原付费价格仅作为折抵金额记录；超出四川省授权范围或解锁非免费项时仍按原价计费。\n每一次免费解锁都会写入「动作留痕」，本企业管理员可查看全员记录。" }
    ];
  }

  /* APP 操作流水派生器（演示层）：仅按种子既有真实字段格式化，不伪造行为。
     事件 type：register 注册完成 / login App登录 / entry 提交入驻申请并缴入驻费 /
     unlock 解锁供需 / order 下单或增值服务支付；cert 事件留给真实埋点（演示层不产）。
     按 at 升序返回。 */
  function opsOf(lead) {
    var ev = [];
    if (lead.createdAt || lead.boundAt) {
      ev.push({ type: "register", at: (lead.boundAt || lead.createdAt).slice(0, 10), desc: "完成手机号注册" });
    }
    if (lead.loginAt) ev.push({ type: "login", at: lead.loginAt.slice(0, 10), desc: "登录 App" });
    (lead.consumption || []).forEach(function (c) {
      var at = (c.date || "").slice(0, 10);
      if (!at) return;
      if (c.type === "entry_fee") ev.push({ type: "entry", at: at, desc: "提交入驻申请并缴纳入驻费" });
      else if (c.type === "points_unlock_paid") ev.push({ type: "unlock", at: at, desc: "解锁供需详情" });
      else if (c.type === "value_added_paid") ev.push({ type: "order", at: at, desc: "购买增值服务并完成支付" });
      else ev.push({ type: "order", at: at, desc: "产生供需订单并完成支付" });
    });
    ev.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
    return ev;
  }

  /* ---------------- 省代（老板 / 员工） ---------------- */
  function provinceSeed(status, isEmpty) {
    var z = !!isEmpty;
    var zero = function (v) { return z ? 0 : v; };
    var arr = function (a) { return z ? [] : a; };

    var calc1 = {
      id: "c1-l1",
      month: "2026-10",
      layer: "平台→省代",
      issueAt: "2026-10-25",
      dueAt: "2026-10-30",
      eligibleBase: 10000,
      grossShare: 0.5,
      calcAmount: z ? 0 : 5000,
      frozenDays: 7,
      disputeDeadline: "T+5 工作日",
      dueDay: 3,
      detail: z ? [] : [        { id: "D101", item: "cert", user: "成都远大工程有限公司", order: "AC20261001001", amount: 999, date: "2026-10-03" },
        { id: "D102", item: "entry", user: "绵阳宏达建设集团有限公司", order: "EN20261001005", amount: 3999, date: "2026-10-05" },
        { id: "D103", item: "unlock", user: "德阳恒基建材有限公司", order: "UL20261001012", amount: 1800, date: "2026-10-08" },
        { id: "D104", item: "order", user: "南充嘉陵建筑工程有限公司", order: "DD20260901018", amount: 3202, date: "2026-10-12" }
      ]
    };
    var calc2 = {
      id: "c1-l2",
      layer: "省代→二级",
      month: "2026-10",
      issueAt: "2026-10-25",
      dueAt: "2026-10-30",
      eligibleBase: 6000,          /* 方案甲 20261030：二级独立口径 = 二级线合格消费（financeBase.subGross），不再引用全省 10000 */
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 600,     /* 600 = 6,000 × 50% × 20%（二级线盘 × 约定比例） */
      disputeDeadline: "出账后 15 天",
      dueDay: 12,
      detail: z ? [] : [
        { id: "D201", item: "cert", user: "成都蓉建科贸有限公司", order: "AC20261002001", amount: 1800, date: "2026-10-02" },
        { id: "D202", item: "entry", user: "成都蓉建科贸有限公司", order: "EN20261002005", amount: 1500, date: "2026-10-06" },
        { id: "D203", item: "unlock", user: "成都蓉建科贸有限公司", order: "UL20261002012", amount: 1300, date: "2026-10-09" },
        { id: "D204", item: "order", user: "成都蓉建科贸有限公司", order: "DD20260902018", amount: 1400, date: "2026-10-11" }
      ]
    };

    var payRegs1 = z ? [] : [
      {
        id: "r0-l1", calcId: "c0-l1", amount: 4600, method: "bank",
        date: "2026-09-10",
        vouchers: [{
          name: "9月平台转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026091000421807",
            payer: "平台结算户", payerAcct: "8111 **** **** 1208",
            payee: "四川锦程工程供应链有限公司", payeeAcct: "6222 **** **** 0181",
            amount: 4600, amountCn: "肆仟陆佰元整",
            purpose: "2026-09 合格消费分润 · 结算单 ST-202609-L1",
            at: "2026-09-10 15:02:40", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "confirmed",
        confirmedAt: "2026-09-11", signMethod: "esign", createdAt: "2026-09-10", voidInfo: null
      },
      {
        id: "r1-l1", calcId: "c1-l1", amount: 4760, method: "bank",
        date: "2026-10-09",
        vouchers: [{
          name: "10月平台转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026100900582101",
            payer: "平台结算户", payerAcct: "8111 **** **** 1208",
            payee: "四川锦程工程供应链有限公司", payeeAcct: "6222 **** **** 0181",
            amount: 4760, amountCn: "肆仟柒佰陆拾元整",
            purpose: "2026-10 合格消费分润 · 结算单 ST-202610-L1",
            at: "2026-10-09 14:32:10", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "disputed",
        reason: "平台回单金额与账单相差 ¥240（信息服务费），待双方核实",
        disputedAt: "2026-10-10", dueDay: 3, createdAt: "2026-10-09"
      },
      {
        id: "r2-l1", calcId: "c1-l1", amount: 240, method: "bank",
        date: "2026-10-15",
        vouchers: [{
          name: "10月差额补付回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026101500231198",
            payer: "平台结算户", payerAcct: "8111 **** **** 1208",
            payee: "四川锦程工程供应链有限公司", payeeAcct: "6222 **** **** 0181",
            amount: 240, amountCn: "贰佰肆拾元整",
            purpose: "2026-10 差额补付 · 异议核实后补转 ST-202610-L1",
            at: "2026-10-15 10:18:36", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "pending_confirm",
        dueDay: 3, createdAt: "2026-10-15"
      }
    ];
    var payRegs2 = z ? [] : [
      {
        id: "r0-l2", calcId: "c0-l2", amount: 460, method: "bank",
        date: "2026-09-12",
        vouchers: [{
          name: "9月二级转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026091200713052",
            payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
            payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
            amount: 460, amountCn: "肆佰陆拾元整",
            purpose: "2026-09 二级合作分润 · 结算单 ST-202609-L2",
            at: "2026-09-12 11:24:18", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "confirmed",
        confirmedAt: "2026-09-13", signMethod: "esign", createdAt: "2026-09-12"
      },
      {
        id: "r1-l2", calcId: "c1-l2", amount: 600, method: "bank",
        date: "2026-10-11",
        vouchers: [{
          name: "10月二级转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026101100824176",
            payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
            payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
            amount: 600, amountCn: "陆佰元整",
            purpose: "2026-10 二级合作分润 · 结算单 ST-202610-L2",
            at: "2026-10-11 09:47:52", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "pending_confirm",
        dueDay: 12, createdAt: "2026-10-11"
      },
      {
        id: "r2-l2", calcId: "c1-l2", amount: 180, method: "bank",
        date: "2026-10-16",
        vouchers: [{
          name: "10月二级转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026101600357219",
            payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
            payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
            amount: 180, amountCn: "壹佰捌拾元整",
            purpose: "2026-10 二级合作分润 · 结算单 ST-202610-L2",
            at: "2026-10-16 16:05:31", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "disputed",
        reason: "二级企业反馈实收分润与结算单相差 ¥180，待线下核实",
        disputedAt: "2026-10-17", dueDay: 2, createdAt: "2026-10-16"
      }
    ];

    var seed = {
      mode: "province",
      role: "admin",
      roleStaffName: "王敏",
      theme: "light",
      state: {
        profile: {
          role: "province_master",
          name: "四川锦程工程供应链有限公司",
          authNo: "51010020260812001",
          status: status || "active",
          since: "2026-08-12",
          uscc: "91510100MA6C8X2K4P",
          contact: "王建国",
          phone: "138****8021",
          legalPerson: "王建国",
          address: "中国（四川）自由贸易试验区成都高新区天府大道中段 666 号"
        },
        financeBase: {
          gross: z ? 0 : 10000,      // 平台合格消费（二级线 + 自营线合计，兼容旧展示）
          subGross: z ? 0 : 6000,    // 二级线合格消费（二级企业获客用户）
          selfGross: z ? 0 : 4000,   // 自营线合格消费（省代直营获客用户，与二级企业无关）
          selfRate: 0.5
        },
        calc1: calc1,
        calc2: calc2,
        payRegs1: payRegs1,
        payRegs2: payRegs2,
        statements: z ? [
          { id: "st-l1", calcId: "c1-l1", month: "2026-10", status: "open", balancedAt: "" },
          { id: "st-l2", calcId: "c1-l2", month: "2026-10", status: "open", balancedAt: "" }
        ] : [
          { id: "st-l1-prev", calcId: "c0-l1", month: "2026-09", status: "balanced", balancedAt: "2026-09-12", balancedBy: "王建国" },
          { id: "st-l2-prev", calcId: "c0-l2", month: "2026-09", status: "balanced", balancedAt: "2026-09-14", balancedBy: "王建国" },
          { id: "st-l1", calcId: "c1-l1", month: "2026-10", status: "open", balancedAt: "" },
          { id: "st-l2", calcId: "c1-l2", month: "2026-10", status: "open", balancedAt: "" }
        ],
        ratioLog: z ? [] : [
          { id: "rl-1", subId: "sub-rongjian", sub: "成都蓉建科贸有限公司", from: 0.15, to: 0.20, by: "boss", at: "2026-09-28 14:02", note: "首次合作约定" }
        ],
        subs: z ? [] : [
          {
            id: "sub-rongjian",
            agreement: { state: "signed" },
            name: "成都蓉建科贸有限公司",
            uscc: "91510107MA6XR4TQ8L",
            contact: "陈志远",
            phone: "139****6620",
            address: "成都市武侯区武科西一路 88 号",
            ratioToSub: 0.20,
            subGross: 2400,
            since: "2026-08-12",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-luzhou",
            agreement: { state: "pending" },
            name: "泸州川南建材有限公司",
            uscc: "91510502MA63Q2BX7W",
            contact: "何斌",
            phone: "138****4471",
            address: "四川省泸州市江阳区酒城大道三段 51 号",
            ratioToSub: 0.20,
            subGross: 1200,
            since: "2026-08-25",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-yibin",
            agreement: { state: "signed" },
            name: "宜宾叙府工程设备有限公司",
            uscc: "91511500MA64J5NQ9H",
            contact: "罗刚",
            phone: "137****8853",
            address: "四川省宜宾市翠屏区临港大道 108 号",
            ratioToSub: 0.20,
            subGross: 1000,
            since: "2026-09-03",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-leshan",
            agreement: { state: "signed" },
            name: "乐山嘉州建设材料有限公司",
            uscc: "91511100MA6AC9RM4T",
            contact: "杨帆",
            phone: "136****2096",
            address: "四川省乐山市市中区柏杨中路 66 号",
            ratioToSub: 0.20,
            subGross: 500,
            since: "2026-09-15",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-suining",
            agreement: { state: "pending" },
            name: "遂宁锦华商贸有限公司",
            uscc: "91510900MA697T8LQ2",
            contact: "黄磊",
            phone: "135****7748",
            address: "四川省遂宁市船山区滨江路 39 号",
            ratioToSub: 0.20,
            subGross: 400,
            since: "2026-09-22",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-guangyuan",
            agreement: { state: "signed" },
            name: "广元利州工程服务有限公司",
            uscc: "91510800MA64F5NWK3",
            contact: "唐雪",
            phone: "158****3315",
            address: "四川省广元市利州区东坝街道 27 号",
            ratioToSub: 0.20,
            subGross: 300,
            since: "2026-10-05",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-neijiang",
            agreement: { state: "rejected" },
            name: "内江甜城物资有限公司",
            uscc: "91511000MA6BX9PQ8G",
            contact: "张强",
            phone: "186****6629",
            address: "四川省内江市东兴区汉安大道 74 号",
            ratioToSub: 0.20,
            subGross: 200,
            since: "2026-10-12",
            status: "active",
            channel: "agent"
          },
          {
            id: "sub-zigong",
            agreement: { state: "signed" },
            name: "自贡富顺机械有限公司",
            uscc: "91510321MA65L7NW4R",
            contact: "刘波",
            phone: "139****5172",
            address: "四川省自贡市富顺县釜江大道 112 号",
            ratioToSub: 0.20,
            since: "2026-10-18",
            status: "active",
            channel: "agent"
          }
        ],
        subApps: z ? [] : [
          {
            id: "app-1", name: "德阳恒基建材有限公司",
            uscc: "91510600MA65K2B71N", contact: "刘芳", phone: "138****2245",
            address: "四川省德阳市旌阳区泰山北路 19 号",
            ratio: 0.18, channel: "agent", status: "pending", submittedAt: "2026-10-25"
          },
          {
            id: "app-2", name: "绵阳顺达工程服务有限公司",
            uscc: "91510703MA69H8P52R", contact: "周明", phone: "137****7710",
            address: "四川省绵阳市涪城区临园路西段 24 号",
            ratio: 0.25, channel: "direct", status: "pending", submittedAt: "2026-10-26"
          },
          {
            id: "app-3", name: "南充宏远物资有限公司",
            uscc: "91511302MA6B4X7Q9D", contact: "赵伟", phone: "136****3308",
            address: "四川省南充市顺庆区模范街 72 号",
            ratio: 0.20, channel: "direct", status: "rejected",
            rejectReason: "营业执照经营范围与工程服务类目不符", handledAt: "2026-10-20", submittedAt: "2026-10-18"
          }
        ],
        channels: z ? { direct: [] } : {
          direct: [
            { code: "CH-P-8KQ2TV", name: "成都建筑协会", channel: "direct", ownerType: "province", ownerName: "王建国", createdAt: "2026-08", users: 8, validUntil: "2026-12-31", status: "active" },
            { code: "CH-P-9WT1XC", name: "德阳工程交流群", channel: "direct", ownerType: "province", ownerName: "王建国", createdAt: "2026-07", users: 3, validUntil: "2026-09-30", status: "void" },
            { code: "CH-P-4HN7MW", name: "建材市场地推", channel: "direct", ownerType: "province", ownerName: "王建国", createdAt: "2026-08", users: 6, validUntil: "2026-12-31", status: "active" },
            { code: "CH-E-2QP6ZK", name: "朋友圈推广", channel: "direct", ownerType: "staff", ownerName: "王敏", createdAt: "2026-09", users: 4, validUntil: "2026-12-31", status: "active" }
          ]
        },
        team: z ? [] : [
          { name: "王建国", role: "boss", title: "法定代表人 / 总经理", phone: "138****8021", since: "2026-08-12", leads: 0, isLegal: true, avatar: "../../../../assets/me/avatars/ox-01.jpg" },
          { name: "王敏", role: "staff", title: "渠道专员", phone: "135****4902", since: "2026-09-02", leads: 6, isLegal: false, channel: "CH-E-2QP6ZK", avatar: "../../../../assets/me/avatars/cat-01.jpg" }
        ],
        leads: z ? { direct: [] } : {
          direct: [
            { id: "L001", name: "张磊", phone: "139****1123", stage: "paid", owner: "王建国", createdAt: "2026-09-15", boundAt: "2026-09-15", loginAt: "2026-10-06", amount: 3600, company: "成都筑信工程有限公司",
              consumption: [
                { date: "2026-09-15", type: "order_paid_net", amount: 2200 },
                { date: "2026-09-20", type: "points_unlock_paid", amount: 1400 }
              ],
              notes: [{ at: "2026-09-15", by: "王建国", text: "扫码注册，当日完成首单" }] },
            { id: "L002", name: "李婷", phone: "138****7745", stage: "onboarded", owner: "王建国", createdAt: "2026-09-20", boundAt: "2026-09-20", loginAt: "2026-10-08", company: "四川明驰装饰工程有限公司",
              consumption: [
                { date: "2026-09-22", type: "entry_fee", amount: 1000 }
              ],
              notes: [{ at: "2026-09-20", by: "王建国", text: "已提交资质，待首单" }] },
            { id: "L003", name: "王浩", phone: "137****6688", stage: "registered", owner: "王建国", createdAt: "2026-10-03", boundAt: "2026-10-03", loginAt: "2026-10-04", notes: [] },
            { id: "L005", name: "陈静", phone: "135****0211", stage: "paid", owner: "王建国", createdAt: "2026-09-08", boundAt: "2026-09-08", loginAt: "2026-10-12", amount: 2800, company: "成都锦程商贸有限公司",
              consumption: [
                { date: "2026-09-08", type: "order_paid_net", amount: 1600 },
                { date: "2026-09-28", type: "value_added_paid", amount: 1200 }
              ],
              notes: [{ at: "2026-09-08", by: "王建国", text: "复购 2 次" }] },
            { id: "L006", name: "赵强", phone: "136****8834", stage: "lost", owner: "王建国", createdAt: "2026-08-21", boundAt: "2026-08-21", loginAt: "2026-09-16", notes: [{ at: "2026-10-01", by: "王建国", text: "超过 30 天未活跃，建议关注" }] },
            { id: "L007", name: "刘洋", phone: "137****5527", stage: "repaid", owner: "王建国", createdAt: "2026-09-10", boundAt: "2026-09-10", loginAt: "2026-10-10", amount: 4800, company: "成都川渝物资有限公司",
              consumption: [
                { date: "2026-09-10", type: "order_paid_net", amount: 2600 },
                { date: "2026-09-17", type: "points_unlock_paid", amount: 1400 },
                { date: "2026-09-24", type: "value_added_paid", amount: 800 }
              ],
              notes: [{ at: "2026-09-24", by: "王建国", text: "复购用户，已产生 2 次成交" }] },
            { id: "L008", name: "何燕", phone: "135****9306", stage: "onboarded", owner: "王建国", createdAt: "2026-09-26", boundAt: "2026-09-26", loginAt: "2026-10-15", company: "南充顺通安装工程有限公司",
              consumption: [
                { date: "2026-09-27", type: "entry_fee", amount: 1000 }
              ],
              notes: [] },
            { id: "L009", name: "马超", phone: "133****4478", stage: "registered", owner: "王建国", createdAt: "2026-10-12", boundAt: "2026-10-12", loginAt: "2026-10-13", notes: [] },
            { id: "L101", name: "孙丽", phone: "139****2267", stage: "paid", owner: "王建国", createdAt: "2026-09-11", boundAt: "2026-09-11", loginAt: "2026-09-20", amount: 1980, company: "绵阳恒达商贸有限公司",
              consumption: [
                { date: "2026-09-11", type: "entry_fee", amount: 600 },
                { date: "2026-09-11", type: "order_paid_net", amount: 1980 }
              ],
              notes: [{ at: "2026-09-11", by: "王建国", text: "渠道码导流" }] },
            { id: "L102", name: "周杰", phone: "138****5590", stage: "onboarded", owner: "王建国", createdAt: "2026-09-18", boundAt: "2026-09-18", loginAt: "2026-09-28", company: "德阳华瑞物资有限公司",
              consumption: [
                { date: "2026-09-19", type: "entry_fee", amount: 1000 }
              ],
              notes: [] },
            { id: "L103", name: "吴敏", phone: "137****3318", stage: "registered", owner: "王敏", createdAt: "2026-09-25", boundAt: "2026-09-25", loginAt: "2026-09-26", notes: [{ at: "2026-09-25", by: "王敏", text: "本人渠道码注册" }] },
            { id: "L104", name: "郑凯", phone: "136****7742", stage: "paid", owner: "王敏", createdAt: "2026-10-02", boundAt: "2026-10-02", loginAt: "2026-10-11", amount: 1600, company: "泸州汇川建材有限公司",
              consumption: [
                { date: "2026-10-02", type: "points_unlock_paid", amount: 900 },
                { date: "2026-10-05", type: "value_added_paid", amount: 700 }
              ],
              notes: [{ at: "2026-10-02", by: "王敏", text: "首单完成" }] },
            { id: "L105", name: "冯雪", phone: "135****9961", stage: "registered", owner: "王敏", createdAt: "2026-10-08", boundAt: "2026-10-08", loginAt: "2026-10-09", notes: [] },
            { id: "L106", name: "林芳", phone: "138****2173", stage: "paid", owner: "王敏", createdAt: "2026-10-06", boundAt: "2026-10-06", loginAt: "2026-10-18", amount: 2400,
              consumption: [
                { date: "2026-10-06", type: "points_unlock_paid", amount: 1200 },
                { date: "2026-10-09", type: "order_paid_net", amount: 800 },
                { date: "2026-10-12", type: "value_added_paid", amount: 400 }
              ],
              notes: [{ at: "2026-10-06", by: "王敏", text: "个人用户，员工码注册" }] },
            { id: "L107", name: "秦浩", phone: "137****6845", stage: "paid", owner: "王敏", createdAt: "2026-10-14", boundAt: "2026-10-14", loginAt: "2026-10-20", amount: 650, company: "眉山嘉恒工程服务有限公司",
              consumption: [
                { date: "2026-10-14", type: "entry_fee", amount: 800 },
                { date: "2026-10-15", type: "order_paid_net", amount: 650 }
              ],
              notes: [] },
            /* 20261102 近日线索：相对日期锚定，保证「今天/昨天/近7天」档位始终有样本
               （4 条覆盖 今天·1天前·3天前·6天前，阶段/付费各取一档，漏斗四段皆有数） */
            { id: "L108", name: "邹蕾", phone: "135****6612", stage: "registered", owner: "王建国", createdAt: dayAgo(0), boundAt: dayAgo(0), loginAt: dayAgo(0), notes: [] },
            { id: "L109", name: "范宇", phone: "138****3907", stage: "registered", owner: "王敏", createdAt: dayAgo(1), boundAt: dayAgo(1), loginAt: dayAgo(1),
              notes: [{ at: dayAgo(1), by: "王敏", text: "朋友圈扫码注册，待首次下单" }] },
            { id: "L110", name: "石磊", phone: "137****2245", stage: "onboarded", owner: "王建国", createdAt: dayAgo(3), boundAt: dayAgo(3), loginAt: dayAgo(1), company: "内江川威建设有限公司",
              consumption: [
                { date: dayAgo(2), type: "entry_fee", amount: 1000 }
              ] },
            { id: "L111", name: "程曦", phone: "136****8871", stage: "paid", owner: "王建国", createdAt: dayAgo(6), boundAt: dayAgo(6), loginAt: dayAgo(0), amount: 1200, company: "自贡大山铺建筑劳务有限公司",
              consumption: [
                { date: dayAgo(4), type: "order_paid_net", amount: 1200 }
              ] }
          ]
        },
        /* 二级线获客明细独立桶（不入 s.leads，省代 funnelOf/consumeOf 统计口径零污染）。
           6 条移植自 subSeed（sub-rongjian 陈志远）+ 4 条扩展（luzhou/yibin/leshan）。 */
        leadsSub: z ? [] : [
          { id: "U001", name: "黄磊", phone: "139****8820", stage: "paid", owner: "陈志远", subId: "sub-rongjian", createdAt: "2026-09-05", boundAt: "2026-09-05", loginAt: "2026-09-25", amount: 5200, company: "德阳金鑫工程有限公司",
            consumption: [ { date: "2026-09-05", type: "order_paid_net", amount: 3200 }, { date: "2026-09-12", type: "points_unlock_paid", amount: 2000 } ] },
          { id: "U002", name: "许静", phone: "138****4412", stage: "onboarded", owner: "陈志远", subId: "sub-rongjian", createdAt: "2026-09-19", boundAt: "2026-09-19", loginAt: "2026-09-29", company: "绵阳润泽商贸有限公司",
            consumption: [ { date: "2026-09-20", type: "entry_fee", amount: 1000 } ] },
          { id: "U003", name: "邓涛", phone: "137****6609", stage: "registered", owner: "陈志远", subId: "sub-rongjian", createdAt: "2026-10-09", boundAt: "2026-10-09", loginAt: "2026-10-10" },
          { id: "U004", name: "蔡敏", phone: "135****2287", stage: "paid", owner: "陈志远", subId: "sub-rongjian", createdAt: "2026-09-23", boundAt: "2026-09-23", loginAt: "2026-10-09", amount: 2800, company: "广汉鑫诚建材有限公司",
            consumption: [ { date: "2026-09-23", type: "order_paid_net", amount: 1800 }, { date: "2026-09-27", type: "points_unlock_paid", amount: 1000 } ] },
          { id: "U005", name: "罗军", phone: "136****1145", stage: "onboarded", owner: "陈志远", subId: "sub-rongjian", createdAt: "2026-10-05", boundAt: "2026-10-05", loginAt: "2026-10-13", company: "什邡恒运商贸有限公司",
            consumption: [ { date: "2026-10-06", type: "entry_fee", amount: 1000 } ] },
          { id: "U006", name: "蒋雪", phone: "139****7736", stage: "registered", owner: "陈志远", subId: "sub-rongjian", createdAt: "2026-10-16", boundAt: "2026-10-16", loginAt: "2026-10-18" },
          { id: "U101", name: "周明", phone: "135****8821", stage: "paid", owner: "何斌", subId: "sub-luzhou", createdAt: "2026-09-08", boundAt: "2026-09-08", loginAt: "2026-09-22", amount: 2700, company: "泸州川南建材工程分公司",
            consumption: [ { date: "2026-09-08", type: "order_paid_net", amount: 1800 }, { date: "2026-09-15", type: "points_unlock_paid", amount: 900 } ] },
          { id: "U102", name: "李娟", phone: "138****3390", stage: "onboarded", owner: "何斌", subId: "sub-luzhou", createdAt: "2026-09-28", boundAt: "2026-09-28", loginAt: "2026-10-09", company: "泸州江阳安装工程队",
            consumption: [ { date: "2026-09-29", type: "entry_fee", amount: 1000 } ] },
          { id: "U103", name: "吴强", phone: "137****5512", stage: "registered", owner: "罗刚", subId: "sub-yibin", createdAt: "2026-10-15", boundAt: "2026-10-15", loginAt: "2026-10-19", company: "宜宾临港物流服务部" },
          { id: "U104", name: "郑丽", phone: "139****7743", stage: "paid", owner: "杨帆", subId: "sub-leshan", createdAt: "2026-09-12", boundAt: "2026-09-12", loginAt: "2026-09-26", amount: 800, company: "乐山五通桥物资经营部",
            consumption: [ { date: "2026-09-13", type: "value_added_paid", amount: 800 } ] },
          /* 20261102 近日线索（相对日期，同 subSeed 的 U007/U008 保持同构） */
          { id: "U007", name: "廖婷", phone: "135****4408", stage: "registered", owner: "陈志远", subId: "sub-rongjian", createdAt: dayAgo(0), boundAt: dayAgo(0), loginAt: dayAgo(0) },
          { id: "U008", name: "唐锐", phone: "139****2261", stage: "registered", owner: "陈志远", subId: "sub-rongjian", createdAt: dayAgo(1), boundAt: dayAgo(1), loginAt: dayAgo(1) }
        ],
        hist: z ? [] : [
          { month: "2026-10", type: "platform", issueAt: "2026-10-25", dueAt: "2026-10-30", amount: 5000, state: "pending" },
          { month: "2026-10", type: "sub", issueAt: "2026-10-25", dueAt: "2026-10-30", amount: 600, state: "pending" },
          { month: "2026-09", type: "platform", issueAt: "2026-09-25", dueAt: "2026-09-30", amount: 4600, state: "settled", settledAt: "2026-09-28" },
          { month: "2026-09", type: "sub", issueAt: "2026-09-25", dueAt: "2026-09-30", amount: 460, state: "settled", settledAt: "2026-09-14" },
          { month: "2026-08", type: "platform", issueAt: "2026-08-25", dueAt: "2026-08-30", amount: 5200, state: "overdue" },
          { month: "2026-08", type: "sub", issueAt: "2026-08-25", dueAt: "2026-08-30", amount: 880, state: "overdue" }
        ],
        msgLog: z ? [] : [
          { id: "ML-P-04", icon: "check", type: "ok", tag: "合作", title: "二级企业合作已通过", desc: "成都蓉建科贸有限公司已入驻并生效", time: "今天 14:30", to: "subs.html",
            body: "成都蓉建科贸有限公司提交的二级合作申请已通过平台审核，合作关系自今日起生效。\n约定比例：20%（二级企业按其合格消费的 20% 向省代结算）\n生效后该企业全员自动纳入四川省内免费解锁范围，可在「动作留痕」中查看其执行记录。" },
          { id: "ML-P-03", icon: "receipt", type: "info", tag: "对账", title: "本月对账单已生成", desc: "2026-10 两级账单已生成，待核对与平账", time: "今天 10:20", to: "reconcile.html?focus=1",
            body: "2026-10 的两级对账单已生成：\n· 平台 → 省代（一级线）\n· 省代 → 二级企业（二级线）\n请在结算截止日前完成核对与平账。对金额有异议的，可发起异议并填写线下核实说明。" },
          { id: "ML-P-02", icon: "file", type: "info", tag: "协议", title: "合作协议已签署", desc: "与成都蓉建科贸有限公司约定比例 20%", time: "昨天 16:40", to: "agreement.html",
            body: "O4 合作协议已由双方完成电子签署，条款自签署日起生效，有效期一年。\n约定比例：20%\n可在「合作协议」中查看条款全文、签署双方与签署时间，并下载协议副本。" },
          { id: "ML-P-01", icon: "bank", type: "ok", tag: "付款", title: "平台付款已登记", desc: "平台已登记对公转账 ¥24,000", time: "昨天 11:05", to: "reconcile.html",
            body: "平台已登记一笔对公转账：\n· 金额：¥24,000.00\n· 用途：2026-09 一级线结余付款\n· 状态：已到账\n该笔款项已自动参与对账单平账计算。" }
        ],
        freeActs: z ? [] : freeActsProvince(),
        sysMsgs: z ? [] : sysMsgsProvince(),
      }
    };
    /* APP 操作流水：按既有真实字段派生回填（不伪造） */
    Object.keys(seed.state.leads).forEach(function (b) { (seed.state.leads[b] || []).forEach(function (l) { l.ops = opsOf(l); }); });
    (seed.state.leadsSub || []).forEach(function (l) { l.ops = opsOf(l); });
    /* uni11：lifecycle 状态机字段回填（页面层现算；store funnelOf 口径不动） */
    var LIFECYCLE_BY_STAGE = { registered: "已注册", onboarded: "已企业入驻", paid: "已企业入驻", repaid: "已企业入驻", lost: "流失" };
    Object.keys(seed.state.leads).forEach(function (b) { (seed.state.leads[b] || []).forEach(function (l) { if (!l.lifecycle) l.lifecycle = LIFECYCLE_BY_STAGE[l.stage] || "已注册"; }); });
    (seed.state.leadsSub || []).forEach(function (l) { if (!l.lifecycle) l.lifecycle = LIFECYCLE_BY_STAGE[l.stage] || "已注册"; });
    /* uni11 §5.2：新增演示 lead（覆盖 8 状态；空场景不补） */
    if (!z) {
      /* 自营线 direct：游客×1 / 已个人认证 / 已企业认证 / 已加入认证企业 / 已加入入驻企业 */
      seed.state.leads.direct.push(
        { id: "G001", name: "访客A", phone: "", stage: "registered", owner: "王建国", lifecycle: "游客" },
        { id: "P001", name: "陈晨", phone: "138****6620", stage: "registered", owner: "王建国", lifecycle: "已个人认证", createdAt: "2026-10-18", boundAt: "2026-10-18", loginAt: "2026-10-19" },
        { id: "Q001", name: "刘一帆", phone: "139****5517", stage: "registered", owner: "王建国", lifecycle: "已企业认证", createdAt: "2026-10-11", boundAt: "2026-10-11", loginAt: "2026-10-14", company: "成都经开工程监理有限公司" },
        { id: "J001", name: "杨光", phone: "136****9923", stage: "registered", owner: "王建国", lifecycle: "已加入认证企业", createdAt: "2026-10-09", boundAt: "2026-10-09", loginAt: "2026-10-12", company: "成都蓉建科贸有限公司" },
        { id: "H001", name: "黄敏", phone: "135****3308", stage: "onboarded", owner: "王建国", lifecycle: "已加入入驻企业", createdAt: "2026-10-05", boundAt: "2026-10-05", loginAt: "2026-10-16", company: "绵阳润泽商贸有限公司" }
      );
      /* 自营线 direct：游客×1 / 已个人认证 / 已企业认证 / 已加入认证企业 / 已加入入驻企业（原 agent 桶已合并入 direct） */
      seed.state.leads.direct.push(
        { id: "G002", name: "访客B", phone: "", stage: "registered", owner: "王敏", lifecycle: "游客" },
        { id: "P002", name: "何静", phone: "137****1145", stage: "registered", owner: "王敏", lifecycle: "已个人认证", createdAt: "2026-10-17", boundAt: "2026-10-17", loginAt: "2026-10-18" },
        { id: "Q002", name: "罗成", phone: "138****8830", stage: "registered", owner: "王敏", lifecycle: "已企业认证", createdAt: "2026-10-10", boundAt: "2026-10-10", loginAt: "2026-10-13", company: "成都温江市政工程队" },
        { id: "J002", name: "高翔", phone: "135****7726", stage: "registered", owner: "王敏", lifecycle: "已加入认证企业", createdAt: "2026-10-08", boundAt: "2026-10-08", loginAt: "2026-10-11", company: "德阳华瑞物资有限公司" },
        { id: "H002", name: "唐莉", phone: "136****4419", stage: "onboarded", owner: "王敏", lifecycle: "已加入入驻企业", createdAt: "2026-10-04", boundAt: "2026-10-04", loginAt: "2026-10-15", company: "德阳金鑫工程有限公司" }
      );
      /* 二级线 leadsSub：游客×2 / 已个人认证×2 / 已加入认证企业×2 / 已加入入驻企业×2（挂现有 4 家） */
      (seed.state.leadsSub = seed.state.leadsSub || []).push(
        { id: "U201", name: "访客甲", phone: "", stage: "registered", owner: "陈志远", subId: "sub-rongjian", lifecycle: "游客" },
        { id: "U202", name: "访客乙", phone: "", stage: "registered", owner: "何斌", subId: "sub-luzhou", lifecycle: "游客" },
        { id: "U203", name: "冯军", phone: "137****5582", stage: "registered", owner: "陈志远", subId: "sub-rongjian", lifecycle: "已个人认证", createdAt: "2026-10-14", boundAt: "2026-10-14", loginAt: "2026-10-16" },
        { id: "U204", name: "宋佳", phone: "138****2260", stage: "registered", owner: "杨帆", subId: "sub-leshan", lifecycle: "已个人认证", createdAt: "2026-10-13", boundAt: "2026-10-13", loginAt: "2026-10-15" },
        { id: "U205", name: "曹阳", phone: "139****7741", stage: "registered", owner: "陈志远", subId: "sub-rongjian", lifecycle: "已加入认证企业", createdAt: "2026-10-07", boundAt: "2026-10-07", loginAt: "2026-10-12", company: "成都蓉建科贸有限公司" },
        { id: "U206", name: "邓辉", phone: "136****8815", stage: "registered", owner: "何斌", subId: "sub-luzhou", lifecycle: "已加入认证企业", createdAt: "2026-10-06", boundAt: "2026-10-06", loginAt: "2026-10-10", company: "泸州川南建材工程分公司" },
        { id: "U207", name: "彭琳", phone: "135****3394", stage: "onboarded", owner: "罗刚", subId: "sub-yibin", lifecycle: "已加入入驻企业", createdAt: "2026-09-30", boundAt: "2026-09-30", loginAt: "2026-10-14", company: "宜宾叙府工程设备有限公司" },
        { id: "U208", name: "蔡文", phone: "137****6648", stage: "onboarded", owner: "陈志远", subId: "sub-rongjian", lifecycle: "已加入入驻企业", createdAt: "2026-09-27", boundAt: "2026-09-27", loginAt: "2026-10-12", company: "成都蓉建科贸有限公司" }
      );
      /* 回填新 lead 的 ops（新 lead 无 consumption；游客无时间字段 → ops 为空 → 渲染占位） */
      Object.keys(seed.state.leads).forEach(function (b) { (seed.state.leads[b] || []).forEach(function (l) { if (!l.ops) l.ops = opsOf(l); }); });
      (seed.state.leadsSub || []).forEach(function (l) { if (!l.ops) l.ops = opsOf(l); });
    }
    /* uni15：线索挂渠道码（来源行展示"码名称"；不改变任何统计口径）。
       自营线：王建国 CH-P（成都建筑协会/建材市场地推）、王敏 CH-E（朋友圈推广）；
       二级线：按 subId 归属企业码；合作企业补 channels（省代视角可见二级码名称）。 */
    var DIRECT_CODE = {
      L001: "CH-P-8KQ2TV", L002: "CH-P-4HN7MW", L003: "CH-P-8KQ2TV", L005: "CH-P-4HN7MW",
      L006: "CH-P-8KQ2TV", L007: "CH-P-4HN7MW", L008: "CH-P-8KQ2TV", L009: "CH-P-4HN7MW",
      L101: "CH-P-8KQ2TV", L102: "CH-P-4HN7MW",
      L103: "CH-E-2QP6ZK", L104: "CH-E-2QP6ZK", L105: "CH-E-2QP6ZK", L106: "CH-E-2QP6ZK", L107: "CH-E-2QP6ZK",
      /* 20261102 近日线索同补码（否则这几行来源行缺"码名称"，与其余线索不一致） */
      L108: "CH-P-8KQ2TV", L109: "CH-E-2QP6ZK", L110: "CH-P-4HN7MW", L111: "CH-P-8KQ2TV",
      G001: "CH-P-8KQ2TV", P001: "CH-P-4HN7MW", Q001: "CH-P-8KQ2TV", J001: "CH-P-4HN7MW", H001: "CH-P-8KQ2TV",
      G002: "CH-E-2QP6ZK", P002: "CH-E-2QP6ZK", Q002: "CH-E-2QP6ZK", J002: "CH-E-2QP6ZK", H002: "CH-E-2QP6ZK"
    };
    (seed.state.leads.direct || []).forEach(function (l) { if (DIRECT_CODE[l.id]) l.code = DIRECT_CODE[l.id]; });
    var SUB_CODE = {
      "sub-rongjian": "CH-S-5KQ8TN", "sub-luzhou": "CH-S-3LX7PM",
      "sub-yibin": "CH-S-7YB2QW", "sub-leshan": "CH-S-9LS4KR"
    };
    (seed.state.leadsSub || []).forEach(function (l) { if (SUB_CODE[l.subId]) l.code = SUB_CODE[l.subId]; });
    var SUB_CHANNELS = {
      "sub-rongjian": [{ code: "CH-S-5KQ8TN", name: "成都建筑协会" }],
      "sub-luzhou": [{ code: "CH-S-3LX7PM", name: "泸州建材地推" }],
      "sub-yibin": [{ code: "CH-S-7YB2QW", name: "宜宾工程交流群" }],
      "sub-leshan": [{ code: "CH-S-9LS4KR", name: "乐山材料供应圈" }]
    };
    (seed.state.subs || []).forEach(function (s) { if (SUB_CHANNELS[s.id]) s.channels = SUB_CHANNELS[s.id]; });
    return seed;
  }

  /* ---------------- 协议条款（O4 正式演示文本） ---------------- */
  function agreementTerms() {
    return [
      { no: "第一条", t: "合作主体", c: "甲方为省级总代四川锦程工程供应链有限公司，乙方为经甲方审核通过的二级合作企业；双方均为合法存续的市场主体，独立经营、自负盈亏。" },
      { no: "第二条", t: "合作内容与区域", c: "甲方授权乙方在约定区域内开展工程服务用户推广与转化，乙方不得跨区域恶性竞争，不得转授权、不得发展下级分润主体。" },
      { no: "第三条", t: "约定所得比例", c: "乙方按其名下合格消费额的约定比例（见合作配置单，初始 20%）取得合作所得；比例可经双方书面（含本协议电子流程）确认后调整，调整后以补签版本为准。" },
      { no: "第四条", t: "结算口径", c: "以平台月度合格消费账单为基准，退货、退款、取消订单不计入；账单按月生成，双方通过对账中心与对账单留痕。" },
      { no: "第五条", t: "付款与确认", c: "甲方在 App 外通过对公转账等线下方式付款并登记凭证；乙方核对到账金额与凭证一致后在系统内确认。出账后 15 天内仅提醒，系统不自动确认、不自动到账。" },
      { no: "第六条", t: "异议处理", c: "乙方发现未到账、金额不符或凭证不清，可提出异议；双方线下核实并补充凭证，异议闭环前不进行月度平账。" },
      { no: "第七条", t: "发票与税费", c: "各方依法各自承担税费；如需开票，按实际结算金额与发票管理规则另行办理。" },
      { no: "第八条", t: "合规经营", c: "双方不得虚假交易、刷单套利、违规承诺收益；不得利用本合作从事违法活动。违反者甲方有权暂停或终止合作。" },
      { no: "第九条", t: "协议期限与续签", c: "本协议自双方签署之日起生效，有效期一年；到期前 30 日双方无异议则按届时规则续签。" },
      { no: "第十条", t: "暂停与终止", c: "乙方违规或资质失效的，甲方可暂停其经营权限（仅可查看）；终止后渠道码失效、未结算款项按已确认数据继续结清。" }
    ];
  }

  /* ---------------- 二级合作 ---------------- */
  function subSeed(status, isEmpty) {
    var z = !!isEmpty;
    var calcCur = {
      id: "sc-1", month: "2026-10",
      issueAt: "2026-10-25",
      dueAt: "2026-10-30",
      eligibleBase: 6000,          /* 方案甲 20261030：二级独立口径（与 calc2/c1-l2 同盘） */
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 600,
      dueDay: 12,
      detail: z ? [] : [
        { id: "D301", item: "cert", user: "黄磊", order: "AC20261002001", amount: 1800, date: "2026-10-02" },
        { id: "D302", item: "entry", user: "许静", order: "EN20261002005", amount: 1500, date: "2026-10-06" },
        { id: "D303", item: "unlock", user: "邓涛", order: "UL20261002012", amount: 1300, date: "2026-10-09" },
        { id: "D304", item: "order", user: "周林", order: "DD20260902018", amount: 1400, date: "2026-10-11" }
      ]
    };
    var calcPrev = {
      id: "sc-0", month: "2026-09",
      issueAt: "2026-09-25",
      dueAt: "2026-09-30",
      settledAt: "2026-09-14",
      eligibleBase: 4600,          /* 方案甲 20261030：9 月二级独立口径 */
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 460,
      detail: z ? [] : [
        { id: "D401", item: "cert", user: "黄磊", order: "AC20260901003", amount: 1200, date: "2026-09-04" },
        { id: "D402", item: "entry", user: "许静", order: "EN20260901008", amount: 1100, date: "2026-09-09" },
        { id: "D403", item: "unlock", user: "邓涛", order: "UL20260901011", amount: 1300, date: "2026-09-15" },
        { id: "D404", item: "order", user: "周林", order: "DD20260901016", amount: 1000, date: "2026-09-21" }
      ]
    };
    var seed = {
      mode: "sub",
      role: "sub_admin",
      roleStaffName: "刘颖",   /* T2 二级员工视角归属人（sub_staff 仅见本人卡/线索） */
      theme: "light",
      state: {
        profile: {
          role: "sub_partner",
          name: "成都蓉建科贸有限公司",
          authNo: "51010720260812007",
          status: status || "active",
          since: "2026-08-12",
          uscc: "91510107MA6XR4TQ8L",
          contact: "陈志远",
          phone: "139****6620",
          legalPerson: "陈志远",
          address: "成都市武侯区武科西一路 88 号"
        },
        parent: {
          name: "四川锦程工程供应链有限公司（省级总代）",
          uscc: "91510100MA6C8X2K4P",
          contact: "王建国",
          phone: "138****8021",
          legalPerson: "王建国",
          address: "中国（四川）自由贸易试验区成都高新区天府大道中段 666 号",
          ratioToSub: 0.20,
          since: "2026-08-12"
        },
        calc: [calcCur, calcPrev],
        payRegs: z ? [] : [
          {
            id: "sr-0", calcId: "sc-0", amount: 460, method: "bank",
            date: "2026-09-12",
            vouchers: [{
              name: "9月转款回单.png", kind: "receipt",
              meta: {
                bank: "中国建设银行", bankNo: "EB2026091200713052",
                payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
                payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
                amount: 460, amountCn: "肆佰陆拾元整",
                purpose: "2026-09 二级合作分润 · 结算单 ST-202609-L2",
                at: "2026-09-12 11:24:18", by: "王建国"
              }
            }],
            registeredBy: "省代（王建国）", status: "confirmed",
            confirmedAt: "2026-09-13", signMethod: "esign", createdAt: "2026-09-12"
          },
          {
            id: "sr-1", calcId: "sc-1", amount: 600, method: "bank",
            date: "2026-10-11",
            vouchers: [{
              name: "10月转款回单.png", kind: "receipt",
              meta: {
                bank: "中国建设银行", bankNo: "EB2026101100824176",
                payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
                payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
                amount: 600, amountCn: "陆佰元整",
                purpose: "2026-10 二级合作分润 · 结算单 ST-202610-L2",
                at: "2026-10-11 09:47:52", by: "王建国"
              }
            }],
            registeredBy: "省代（王建国）", status: "pending_confirm",
            dueDay: 12, createdAt: "2026-10-11"
          },
          {
            id: "sr-2", calcId: "sc-1", amount: 80, method: "bank",
            date: "2026-10-16",
            vouchers: [{
              name: "10月转款回单.png", kind: "receipt",
              meta: {
                bank: "中国建设银行", bankNo: "EB2026101600357219",
                payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
                payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
                amount: 80, amountCn: "捌拾元整",
                purpose: "2026-10 二级合作分润 · 结算单 ST-202610-L2",
                at: "2026-10-16 16:05:31", by: "王建国"
              }
            }],
            registeredBy: "省代（王建国）", status: "disputed",
            reason: "核对实收与结算单相差 ¥80，已发起线下核实",
            disputedAt: "2026-10-17", dueDay: 2, createdAt: "2026-10-16"
          }
        ],
        statements: z ? [
          { id: "sst-1", calcId: "sc-1", month: "2026-10", status: "open", balancedAt: "" }
        ] : [
          { id: "sst-0", calcId: "sc-0", month: "2026-09", status: "balanced", balancedAt: "2026-09-14", balancedBy: "省代" },
          { id: "sst-1", calcId: "sc-1", month: "2026-10", status: "open", balancedAt: "" }
        ],
        agreement: {
          id: "O4-2026-10",
          version: "v2026.10",
          state: z ? "signed" : (status === "suspended" ? "signed" : "pending_mine"),
          province: {
            name: "四川锦程工程供应链有限公司",
            uscc: "91510100MA6C8X2K4P",
            legalPerson: "王建国",
            contact: "王建国",
            phone: "138****8021",
            address: "中国（四川）自由贸易试验区成都高新区天府大道中段 666 号"
          },
          sub: {
            name: "成都蓉建科贸有限公司",
            uscc: "91510107MA6XR4TQ8L",
            legalPerson: "陈志远",
            contact: "陈志远",
            phone: "139****6620",
            address: "成都市武侯区武科西一路 88 号"
          },
          sentAt: "2026-10-27",
          expireAt: "2027-10-26",
          terms: agreementTerms(),
          signedAt: z || status === "suspended" ? "2026-10-15" : "",
          signerName: z || status === "suspended" ? "陈志远" : "",
          rejectReason: "",
          rejectedAt: ""
        },
        team: z ? [] : [
          { name: "陈志远", role: "boss", title: "法定代表人 / 总经理", phone: "139****6620", since: "2026-08-12", leads: 6, isLegal: true, avatar: "../../../../assets/me/avatars/horse-01.jpg" },
          { name: "刘颖", role: "staff", title: "渠道专员", phone: "136****5588", since: "2026-09-05", leads: 2, isLegal: false, avatar: "../../../../assets/me/avatars/dog-01.jpg" }
        ],
        channels: z ? { school: [] } : {
          school: [
            { code: "CH-S-5KQ8TN", name: "成都建筑协会", channel: "school", ownerType: "sub", ownerName: "陈志远", createdAt: "2026-08", users: 5, validUntil: "2026-12-31", status: "active" },
            /* 2026-11-01 员工视角数据补全：刘颖名下渠道码（二级员工脱敏后的唯一可见渠道） */
            { code: "CH-S-9WK3RD", name: "德阳建筑劳务协会", channel: "school", ownerType: "sub", ownerName: "刘颖", createdAt: "2026-09", users: 2, validUntil: "2026-12-31", status: "active" }
          ]
        },
        leads: z ? { school: [] } : {
          school: [
            { id: "U001", name: "黄磊", phone: "139****8820", stage: "paid", owner: "陈志远", createdAt: "2026-09-05", boundAt: "2026-09-05", loginAt: "2026-09-25", amount: 5200, company: "德阳金鑫工程有限公司",
              consumption: [
                { date: "2026-09-05", type: "order_paid_net", amount: 3200 },
                { date: "2026-09-12", type: "points_unlock_paid", amount: 2000 }
              ] },
            { id: "U002", name: "许静", phone: "138****4412", stage: "onboarded", owner: "陈志远", createdAt: "2026-09-19", boundAt: "2026-09-19", loginAt: "2026-09-29", company: "绵阳润泽商贸有限公司",
              consumption: [
                { date: "2026-09-20", type: "entry_fee", amount: 1000 }
              ] },
            { id: "U003", name: "邓涛", phone: "137****6609", stage: "registered", owner: "陈志远", createdAt: "2026-10-09", boundAt: "2026-10-09", loginAt: "2026-10-10" },
            { id: "U004", name: "蔡敏", phone: "135****2287", stage: "paid", owner: "陈志远", createdAt: "2026-09-23", boundAt: "2026-09-23", loginAt: "2026-10-09", amount: 2800, company: "广汉鑫诚建材有限公司",
              consumption: [
                { date: "2026-09-23", type: "order_paid_net", amount: 1800 },
                { date: "2026-09-27", type: "points_unlock_paid", amount: 1000 }
              ] },
            { id: "U005", name: "罗军", phone: "136****1145", stage: "onboarded", owner: "陈志远", createdAt: "2026-10-05", boundAt: "2026-10-05", loginAt: "2026-10-13", company: "什邡恒运商贸有限公司",
              consumption: [
                { date: "2026-10-06", type: "entry_fee", amount: 1000 }
              ] },
            { id: "U006", name: "蒋雪", phone: "139****7736", stage: "registered", owner: "陈志远", createdAt: "2026-10-16", boundAt: "2026-10-16", loginAt: "2026-10-18" },
            /* 20261102 近日用户（相对日期，与 provinceSeed.leadsSub 的 U007/U008 同构）
               2026-11-01：归属改为渠道专员刘颖，挂其名下渠道码 CH-S-9WK3RD——
               用于支撑二级员工身份的数据级脱敏视图（否则员工名下无任何线索） */
            { id: "U007", name: "廖婷", phone: "135****4408", stage: "registered", owner: "刘颖", code: "CH-S-9WK3RD", createdAt: dayAgo(0), boundAt: dayAgo(0), loginAt: dayAgo(0) },
            { id: "U008", name: "唐锐", phone: "139****2261", stage: "registered", owner: "刘颖", code: "CH-S-9WK3RD", createdAt: dayAgo(1), boundAt: dayAgo(1), loginAt: dayAgo(1) }
          ]
        },
        hist: z ? [] : [
          { month: "2026-10", issueAt: "2026-10-25", dueAt: "2026-10-30", amount: 600, state: "pending" },
          { month: "2026-09", issueAt: "2026-09-25", dueAt: "2026-09-30", amount: 460, state: "settled", settledAt: "2026-09-14" },
          { month: "2026-08", issueAt: "2026-08-25", dueAt: "2026-08-30", amount: 880, state: "overdue" }
        ],
        msgLog: z ? [] : [
          { id: "ML-S-03", icon: "receipt", type: "info", tag: "对账", title: "本月对账单已生成", desc: "2026-10 合格消费账单已生成，待核对与平账", time: "今天 09:00", to: "reconcile-hub-sub.html",
            body: "2026-10 的合格消费账单已由省代侧出具，请在结算截止日前完成核对与平账。\n对金额有异议的，可发起异议并填写线下核实说明，由省代确认后重新出账。" },
          { id: "ML-S-02", icon: "bank", type: "ok", tag: "付款", title: "省代付款已登记", desc: "省代已登记对公转账 ¥4,800", time: "昨天 15:30", to: "reconcile-sub.html",
            body: "省代已登记一笔对公转账：\n· 金额：¥4,800.00\n· 用途：2026-09 二级线分成付款\n· 状态：已到账\n如与你的实际到账金额不一致，请发起异议。" },
          { id: "ML-S-01", icon: "file", type: "info", tag: "协议", title: "合作协议已签署", desc: "与四川锦程工程供应链有限公司约定比例 20%", time: "2026-08-12", to: "agreement.html",
            body: "O4 合作协议已由双方完成电子签署，条款自签署日起生效，有效期一年。\n约定比例：20%\n可在「合作协议」中查看条款全文、签署双方与签署时间，并下载协议副本。" }
        ],
        freeActs: z ? [] : freeActsSub(),
        sysMsgs: z ? [] : sysMsgsSub(),
      }
    };
    /* APP 操作流水：按既有真实字段派生回填（school 桶） */
    Object.keys(seed.state.leads).forEach(function (b) { (seed.state.leads[b] || []).forEach(function (l) { l.ops = opsOf(l); }); });
    /* uni11：lifecycle 状态机字段回填 */
    Object.keys(seed.state.leads).forEach(function (b) { (seed.state.leads[b] || []).forEach(function (l) { if (!l.lifecycle) l.lifecycle = ({ registered: "已注册", onboarded: "已企业入驻", paid: "已企业入驻", repaid: "已企业入驻", lost: "流失" })[l.stage] || "已注册"; }); });
    /* uni15：二级企业渠道码（来源行展示码名称：成都建筑协会）
       2026-11-01：改为「缺省才回填」——多成员渠道后不能把所有人的码都刷成同一个 */
    (seed.state.leads.school || []).forEach(function (l) { if (!l.code) l.code = "CH-S-5KQ8TN"; });
    return seed;
  }

  var SCENARIOS = {
    active: function () { return provinceSeed("active"); },
    suspended: function () { return provinceSeed("suspended"); },
    empty: function () { return provinceSeed("active", true); },
    dark: function () { var s = provinceSeed("active"); s.theme = "dark"; return s; },
    "sub-active": function () { return subSeed("active"); },
    "sub-readonly": function () { return subSeed("suspended"); },
    "sub-dark": function () { var s = subSeed("active"); s.theme = "dark"; return s; },
    "sub-empty": function () { return subSeed("active", true); }
  };

  /* 种子数据版本：种子内容/结构变更（新增企业、修改比例、调整字段）时 +1。
     旧版缓存（_v 不符或无 _v）在 boot 时自动失效并重播种，避免页面沿用陈旧种子。 */
  var DATA_VERSION = 16;

  function seedByScenario(key) {
    var fn = SCENARIOS[key] || SCENARIOS.active;
    var s = fn();
    s._v = DATA_VERSION;
    return s;
  }

  window.V3 = window.V3 || {};
  window.V3.scenarios = {
    seedByScenario: seedByScenario,
    provinceSeed: provinceSeed,
    subSeed: subSeed,
    agreementTerms: agreementTerms,
    dataVersion: function () { return DATA_VERSION; },
    keys: Object.keys(SCENARIOS)
  };
})();
