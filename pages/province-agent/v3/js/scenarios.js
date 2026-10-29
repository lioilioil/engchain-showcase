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
      issueAt: "2026-10-25",
      dueAt: "2026-10-30",
      eligibleBase: 10000,
      grossShare: 0.5,
      calcAmount: z ? 0 : 5000,
      frozenDays: 7,
      disputeDeadline: "T+5 工作日",
      dueDay: 3,
      detail: z ? [] : [
        { id: "D101", item: "cert", user: "成都远大工程有限公司", order: "AC20261001001", amount: 999, date: "2026-10-03" },
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
      eligibleBase: 10000,
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 1000,
      disputeDeadline: "出账后 15 天",
      dueDay: 12,
      detail: z ? [] : [
        { id: "D201", item: "cert", user: "成都蓉建科贸有限公司", order: "AC20261002001", amount: 999, date: "2026-10-02" },
        { id: "D202", item: "entry", user: "成都蓉建科贸有限公司", order: "EN20261002005", amount: 3999, date: "2026-10-06" },
        { id: "D203", item: "unlock", user: "成都蓉建科贸有限公司", order: "UL20261002012", amount: 1800, date: "2026-10-09" },
        { id: "D204", item: "order", user: "成都蓉建科贸有限公司", order: "DD20260902018", amount: 3202, date: "2026-10-11" }
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
        id: "r0-l2", calcId: "c0-l2", amount: 920, method: "bank",
        date: "2026-09-12",
        vouchers: [{
          name: "9月二级转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026091200713052",
            payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
            payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
            amount: 920, amountCn: "玖佰贰拾元整",
            purpose: "2026-09 二级合作分润 · 结算单 ST-202609-L2",
            at: "2026-09-12 11:24:18", by: "王建国"
          }
        }],
        registeredBy: "王建国", status: "confirmed",
        confirmedAt: "2026-09-13", signMethod: "esign", createdAt: "2026-09-12"
      },
      {
        id: "r1-l2", calcId: "c1-l2", amount: 1000, method: "bank",
        date: "2026-10-11",
        vouchers: [{
          name: "10月二级转款回单.png", kind: "receipt",
          meta: {
            bank: "中国建设银行", bankNo: "EB2026101100824176",
            payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
            payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
            amount: 1000, amountCn: "壹仟元整",
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

    return {
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
            ratioToSub: 0.18,
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
            ratioToSub: 0.22,
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
            ratioToSub: 0.16,
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
            ratioToSub: 0.15,
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
            ratioToSub: 0.24,
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
            ratioToSub: 0.19,
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
            { id: "L009", name: "马超", phone: "133****4478", stage: "registered", owner: "王建国", createdAt: "2026-10-12", boundAt: "2026-10-12", loginAt: "2026-10-13", notes: [] }
          ],
          agent: [
            { id: "L101", name: "孙丽", phone: "139****2267", stage: "paid", owner: "王建国", createdAt: "2026-09-11", boundAt: "2026-09-11", loginAt: "2026-09-20", amount: 1980, company: "绵阳恒达商贸有限公司",
              consumption: [
                { date: "2026-09-11", type: "entry_fee", amount: 600 },
                { date: "2026-09-11", type: "order_paid_net", amount: 1980 }
              ],
              notes: [{ at: "2026-09-11", by: "王建国", text: "招商渠道导流" }] },
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
              notes: [] }
          ]
        },
        hist: z ? [] : [
          { month: "2026-10", type: "platform", issueAt: "2026-10-25", dueAt: "2026-10-30", amount: 5000, state: "pending" },
          { month: "2026-10", type: "sub", issueAt: "2026-10-25", dueAt: "2026-10-30", amount: 1000, state: "pending" },
          { month: "2026-09", type: "platform", issueAt: "2026-09-25", dueAt: "2026-09-30", amount: 4600, state: "settled", settledAt: "2026-09-28" },
          { month: "2026-09", type: "sub", issueAt: "2026-09-25", dueAt: "2026-09-30", amount: 920, state: "settled", settledAt: "2026-09-14" },
          { month: "2026-08", type: "platform", issueAt: "2026-08-25", dueAt: "2026-08-30", amount: 5200, state: "overdue" },
          { month: "2026-08", type: "sub", issueAt: "2026-08-25", dueAt: "2026-08-30", amount: 880, state: "overdue" }
        ],
        msgLog: z ? [] : [
          { icon: "check", type: "ok", title: "二级企业合作已通过", desc: "成都蓉建科贸有限公司已入驻并生效", time: "今天 14:30", to: "subs.html" },
          { icon: "receipt", type: "info", title: "月度对账单已生成", desc: "2026-09 合格消费账单已生成，待确认", time: "今天 10:20", to: "statement.html" },
          { icon: "file", type: "info", title: "合作协议已签署", desc: "与成都蓉建科贸有限公司约定比例 20%", time: "昨天 16:40", to: "agreement.html" },
          { icon: "bank", type: "ok", title: "平台付款已登记", desc: "平台已登记对公转账 ¥24,000", time: "昨天 11:05", to: "reconcile.html" }
        ],
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
      issueAt: "2026-10-25",
      dueAt: "2026-10-30",
      eligibleBase: 10000,
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 1000,
      dueDay: 12,
      detail: z ? [] : [
        { id: "D301", item: "cert", user: "黄磊", order: "AC20261002001", amount: 999, date: "2026-10-02" },
        { id: "D302", item: "entry", user: "许静", order: "EN20261002005", amount: 3999, date: "2026-10-06" },
        { id: "D303", item: "unlock", user: "邓涛", order: "UL20261002012", amount: 1800, date: "2026-10-09" },
        { id: "D304", item: "order", user: "周林", order: "DD20260902018", amount: 3202, date: "2026-10-11" }
      ]
    };
    var calcPrev = {
      id: "sc-0", month: "2026-09",
      issueAt: "2026-09-25",
      dueAt: "2026-09-30",
      settledAt: "2026-09-14",
      eligibleBase: 9200,
      ratioToSub: 0.20,
      calcAmount: z ? 0 : 920,
      detail: z ? [] : [
        { id: "D401", item: "cert", user: "黄磊", order: "AC20260901003", amount: 999, date: "2026-09-04" },
        { id: "D402", item: "entry", user: "许静", order: "EN20260901008", amount: 3999, date: "2026-09-09" },
        { id: "D403", item: "unlock", user: "邓涛", order: "UL20260901011", amount: 1600, date: "2026-09-15" },
        { id: "D404", item: "order", user: "周林", order: "DD20260901016", amount: 2602, date: "2026-09-21" }
      ]
    };
    return {
      mode: "sub",
      role: "sub_admin",
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
            vouchers: [{
              name: "9月转款回单.png", kind: "receipt",
              meta: {
                bank: "中国建设银行", bankNo: "EB2026091200713052",
                payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
                payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
                amount: 920, amountCn: "玖佰贰拾元整",
                purpose: "2026-09 二级合作分润 · 结算单 ST-202609-L2",
                at: "2026-09-12 11:24:18", by: "王建国"
              }
            }],
            registeredBy: "省代（王建国）", status: "confirmed",
            confirmedAt: "2026-09-13", signMethod: "esign", createdAt: "2026-09-12"
          },
          {
            id: "sr-1", calcId: "sc-1", amount: 1000, method: "bank",
            date: "2026-10-11",
            vouchers: [{
              name: "10月转款回单.png", kind: "receipt",
              meta: {
                bank: "中国建设银行", bankNo: "EB2026101100824176",
                payer: "四川锦程工程供应链有限公司", payerAcct: "6222 **** **** 0181",
                payee: "成都蓉建科贸有限公司", payeeAcct: "6217 **** **** 5520",
                amount: 1000, amountCn: "壹仟元整",
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
          { name: "陈志远", role: "boss", title: "法定代表人 / 总经理", phone: "139****6620", since: "2026-08-12", leads: 0, isLegal: true },
          { name: "刘颖", role: "staff", title: "渠道专员", phone: "136****5588", since: "2026-09-05", leads: 0, isLegal: false }
        ],
        channels: z ? { school: [] } : {
          school: [
            { code: "CH-S-5KQ8TN", channel: "school", ownerType: "sub", ownerName: "陈志远", createdAt: "2026-08", users: 5, validUntil: "2026-12-31", status: "active" }
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
            { id: "U006", name: "蒋雪", phone: "139****7736", stage: "registered", owner: "陈志远", createdAt: "2026-10-16", boundAt: "2026-10-16", loginAt: "2026-10-18" }
          ]
        },
        hist: z ? [] : [
          { month: "2026-10", issueAt: "2026-10-25", dueAt: "2026-10-30", amount: 1000, state: "pending" },
          { month: "2026-09", issueAt: "2026-09-25", dueAt: "2026-09-30", amount: 920, state: "settled", settledAt: "2026-09-14" },
          { month: "2026-08", issueAt: "2026-08-25", dueAt: "2026-08-30", amount: 880, state: "overdue" }
        ],
        msgLog: z ? [] : [
          { icon: "receipt", type: "info", title: "月度对账单已生成", desc: "2026-09 合格消费账单已生成，待确认", time: "今天 09:00", to: "statement.html" },
          { icon: "bank", type: "ok", title: "省代付款已登记", desc: "省代已登记对公转账 ¥4,800", time: "昨天 15:30", to: "reconcile-sub.html" },
          { icon: "file", type: "info", title: "合作协议已签署", desc: "与四川锦程工程供应链有限公司约定比例 20%", time: "2026-08-12", to: "agreement.html" }
        ],
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

  /* 种子数据版本：种子内容/结构变更（新增企业、修改比例、调整字段）时 +1。
     旧版缓存（_v 不符或无 _v）在 boot 时自动失效并重播种，避免页面沿用陈旧种子。 */
  var DATA_VERSION = 5;

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
