/* ============================================================
   scenarios.js · 演示场景种子（无外部依赖；数据全部与 UI 口径一致）
   场景：active / suspended / empty / dark / sub-active / sub-readonly / sub-dark
   说明：
   - 待办与消息由 store.todoOf / messagesOf 派生，种子不写 alerts 假数据
   - 线索 owner 字段用于员工（王敏）数据隔离演示
   - 所有金额为演示模拟数据，页面统一标注"模拟测算"
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 省代（老板 / 员工） ---------------- */
  function provinceSeed(status, isEmpty) {
    var z = !!isEmpty;
    var zero = function (v) { return z ? 0 : v; };
    var arr = function (a) { return z ? [] : a; };

    var calc1 = {
      id: "c1-l1",
      month: "2026-10",
      layer: "平台→省代",
      eligibleBase: 10000,
      grossShare: 0.5,
      calcAmount: z ? 0 : 5000,
      frozenDays: 7,
      disputeDeadline: "T+5 工作日",
      dueDay: 3
    };
    var calc2 = {
      id: "c1-l2",
      layer: "省代→二级",
      month: "2026-10",
      eligibleBase: 10000,
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 1000,
      disputeDeadline: "出账后 15 天",
      dueDay: 12
    };

    var payRegs1 = z ? [] : [
      {
        id: "r0-l1", calcId: "c0-l1", amount: 4600, method: "bank",
        date: "2026-09-10",
        vouchers: [{ name: "9月转款回单.jpg", kind: "image", thumb: "" }],
        registeredBy: "王建国", status: "confirmed",
        confirmedAt: "2026-09-11", signMethod: "esign", createdAt: "2026-09-10", voidInfo: null
      },
      {
        id: "r1-l1", calcId: "c1-l1", amount: 4760, method: "bank",
        date: "2026-10-09",
        vouchers: [{ name: "10月转款回单.jpg", kind: "image", thumb: "" }],
        registeredBy: "王建国", status: "disputed",
        reason: "平台回单金额与测算口径差 ¥240（信息服务费），待双方核实",
        disputedAt: "2026-10-10", dueDay: 3, createdAt: "2026-10-09"
      }
    ];
    var payRegs2 = z ? [] : [
      {
        id: "r0-l2", calcId: "c0-l2", amount: 920, method: "bank",
        date: "2026-09-12",
        vouchers: [{ name: "9月二级回单.jpg", kind: "image", thumb: "" }],
        registeredBy: "王建国", status: "confirmed",
        confirmedAt: "2026-09-13", signMethod: "esign", createdAt: "2026-09-12"
      },
      {
        id: "r1-l2", calcId: "c1-l2", amount: 1000, method: "bank",
        date: "2026-10-11",
        vouchers: [{ name: "10月二级回单.jpg", kind: "image", thumb: "" }],
        registeredBy: "王建国", status: "pending_confirm",
        dueDay: 12, createdAt: "2026-10-11"
      }
    ];

    return {
      mode: "province",
      role: "boss",
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
          gross: z ? 0 : 10000,
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
            name: "成都蓉建科贸有限公司",
            uscc: "91510107MA6XR4TQ8L",
            contact: "陈志远",
            phone: "139****6620",
            address: "成都市武侯区武科西一路 88 号",
            ratioToSub: 0.20,
            since: "2026-08-12",
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
        agentCodes: z ? {
          direct: { code: "", status: "inactive", channel: "direct", validUntil: "2026-12-31" },
          agent: { code: "", status: "inactive", channel: "agent", validUntil: "2026-12-31" }
        } : {
          direct: { code: "AG-7KQ2TZ", status: "active", channel: "direct", createdAt: "2026-08", validUntil: "2026-12-31" },
          agent: { code: "AG-3MN9WP", status: "void", channel: "agent", voidAt: "2026-09", validUntil: "2026-05-31" }
        },
        channels: z ? { direct: [], agent: [] } : {
          direct: [
            { code: "CH-P-8KQ2TV", channel: "direct", ownerType: "province", ownerName: "王建国", createdAt: "2026-08", users: 8, validUntil: "2026-12-31", status: "active" },
            { code: "CH-P-9WT1XC", channel: "direct", ownerType: "province", ownerName: "王建国", createdAt: "2026-07", users: 3, validUntil: "2026-09-30", status: "void" }
          ],
          agent: [
            { code: "CH-P-4HN7MW", channel: "agent", ownerType: "province", ownerName: "王建国", createdAt: "2026-08", users: 6, validUntil: "2026-12-31", status: "active" },
            { code: "CH-E-2QP6ZK", channel: "agent", ownerType: "staff", ownerName: "王敏", createdAt: "2026-09", users: 4, validUntil: "2026-12-31", status: "active" }
          ]
        },
        team: z ? [] : [
          { name: "王建国", role: "boss", title: "法定代表人 / 总经理", phone: "138****8021", since: "2026-08-12", leads: 0, isLegal: true },
          { name: "王敏", role: "staff", title: "渠道专员", phone: "135****4902", since: "2026-09-02", leads: 4, isLegal: false, channel: "CH-E-2QP6ZK" }
        ],
        leads: z ? { direct: [], agent: [] } : {
          direct: [
            { id: "L001", name: "张磊", phone: "139****1123", stage: "paid", owner: "王建国", createdAt: "2026-09-15", boundAt: "2026-09-15", amount: 3600, notes: [{ at: "2026-09-15", by: "王建国", text: "扫码注册，当日完成首单" }] },
            { id: "L002", name: "李婷", phone: "138****7745", stage: "onboarded", owner: "王建国", createdAt: "2026-09-20", boundAt: "2026-09-20", notes: [{ at: "2026-09-20", by: "王建国", text: "已提交资质，待首单" }] },
            { id: "L003", name: "王浩", phone: "137****6688", stage: "registered", owner: "王建国", createdAt: "2026-10-03", boundAt: "2026-10-03", notes: [] },
            { id: "L005", name: "陈静", phone: "135****0211", stage: "paid", owner: "王建国", createdAt: "2026-09-08", boundAt: "2026-09-08", amount: 2800, notes: [{ at: "2026-09-08", by: "王建国", text: "复购 2 次" }] },
            { id: "L006", name: "赵强", phone: "136****8834", stage: "lost", owner: "王建国", createdAt: "2026-08-21", boundAt: "2026-08-21", notes: [{ at: "2026-10-01", by: "王建国", text: "超过 30 天未活跃，建议关注（演示仅提示）" }] }
          ],
          agent: [
            { id: "L101", name: "孙丽", phone: "139****2267", stage: "paid", owner: "王建国", createdAt: "2026-09-11", boundAt: "2026-09-11", amount: 1980, notes: [{ at: "2026-09-11", by: "王建国", text: "招商渠道导流" }] },
            { id: "L102", name: "周杰", phone: "138****5590", stage: "onboarded", owner: "王建国", createdAt: "2026-09-18", boundAt: "2026-09-18", notes: [] },
            { id: "L103", name: "吴敏", phone: "137****3318", stage: "registered", owner: "王敏", createdAt: "2026-09-25", boundAt: "2026-09-25", notes: [{ at: "2026-09-25", by: "王敏", text: "本人渠道码注册" }] },
            { id: "L104", name: "郑凯", phone: "136****7742", stage: "paid", owner: "王敏", createdAt: "2026-10-02", boundAt: "2026-10-02", amount: 1600, notes: [{ at: "2026-10-02", by: "王敏", text: "首单完成" }] },
            { id: "L105", name: "冯雪", phone: "135****9961", stage: "registered", owner: "王敏", createdAt: "2026-10-08", boundAt: "2026-10-08", notes: [] }
          ]
        },
        msgLog: []
      }
    };
  }

  /* ---------------- 协议条款（O4 正式演示文本） ---------------- */
  function agreementTerms() {
    return [
      { no: "第一条", t: "合作主体", c: "甲方为省级总代四川锦程工程供应链有限公司，乙方为经甲方审核通过的二级合作企业；双方均为合法存续的市场主体，独立经营、自负盈亏。" },
      { no: "第二条", t: "合作内容与区域", c: "甲方授权乙方在约定区域内开展工程服务用户推广与转化，乙方不得跨区域恶性竞争，不得转授权、不得发展下级分润主体。" },
      { no: "第三条", t: "约定所得比例", c: "乙方按其名下合格消费额的约定比例（见合作配置单，初始 20%）取得合作所得；比例可经双方书面（含本协议电子流程）确认后调整，调整后以补签版本为准。" },
      { no: "第四条", t: "结算口径", c: "以平台月度合格消费账单为基准，退货、退款、取消订单不计入；账单按月生成，双方通过收款确认与月度对账单留痕。" },
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
      eligibleBase: 10000,
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 1000,
      dueDay: 12
    };
    var calcPrev = {
      id: "sc-0", month: "2026-09",
      eligibleBase: 9200,
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 920
    };
    return {
      mode: "sub",
      role: "sub_owner",
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
            id: "sr-0", calcId: "sc-0", amount: 920, method: "bank",
            date: "2026-09-12",
            vouchers: [{ name: "9月回单.jpg", kind: "image", thumb: "" }],
            registeredBy: "省代（王建国）", status: "confirmed",
            confirmedAt: "2026-09-13", signMethod: "esign", createdAt: "2026-09-12"
          },
          {
            id: "sr-1", calcId: "sc-1", amount: 1000, method: "bank",
            date: "2026-10-11",
            vouchers: [{ name: "10月回单.jpg", kind: "image", thumb: "" }],
            registeredBy: "省代（王建国）", status: "pending_confirm",
            dueDay: 12, createdAt: "2026-10-11"
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
        channels: z ? { school: [] } : {
          school: [
            { code: "CH-S-5KQ8TN", channel: "school", ownerType: "sub", ownerName: "陈志远", createdAt: "2026-08", users: 5, validUntil: "2026-12-31", status: "active" }
          ]
        },
        leads: z ? { school: [] } : {
          school: [
            { id: "U001", name: "黄磊", phone: "139****8820", stage: "paid", owner: "陈志远", createdAt: "2026-09-05", boundAt: "2026-09-05", amount: 5200 },
            { id: "U002", name: "许静", phone: "138****4412", stage: "onboarded", owner: "陈志远", createdAt: "2026-09-19", boundAt: "2026-09-19" },
            { id: "U003", name: "邓涛", phone: "137****6609", stage: "registered", owner: "陈志远", createdAt: "2026-10-09", boundAt: "2026-10-09" }
          ]
        },
        msgLog: []
      }
    };
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

  function seedByScenario(key) {
    var fn = SCENARIOS[key] || SCENARIOS.active;
    return fn();
  }

  window.V3 = window.V3 || {};
  window.V3.scenarios = {
    seedByScenario: seedByScenario,
    provinceSeed: provinceSeed,
    subSeed: subSeed,
    agreementTerms: agreementTerms,
    keys: Object.keys(SCENARIOS)
  };
})();
