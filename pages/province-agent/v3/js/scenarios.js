/* ============================================================
   scenarios.js · v3 演示种子 + window.applyV3Scenario(key)
   active / suspended / empty / dark / sub-active / sub-readonly
   ============================================================ */
(function () {
  "use strict";

  function provinceSeed(status, isEmpty) {
    var z = !!isEmpty;
    return {
      mode: "province",
      province: {
        profile: {
          agentName: "四川润锦工程服务有限公司", province: "四川省",
          status: status, used: z ? 0 : 1, cap: 21, subsCount: z ? 0 : 1,
          authNo: "RJ-PA-2026-SC-018", validTill: "2027-09-30"
        },
        financeBase: { eligible: z ? 0 : 10000, frozen: z ? 0 : 3000, ratioToSub: 0.20, selfBase: z ? 0 : 8000 },
        subs: z ? [] : [
          { id: "sub-rongjian", name: "成都蓉建科贸有限公司", status: "active", ratioToSub: 0.20,
            inviteScope: "标准授权（平台配置 + O4 协议约定范围内）", inviteRate: null, inviteRateReadonly: true,
            scopeText: "可邀终端用户；规模/费率只读", since: "2026-08-12" }
        ],
        agentCodes: z ? [] : [
          { id: "ag-1", code: "AG-7KQ2TZ", status: "active", createdAt: "2026-08-10", voidInfo: null },
          { id: "ag-0", code: "AG-3MN9WP", status: "void", createdAt: "2026-05-02",
            voidInfo: { reason: "换发新码", at: "2026-08-09" } }
        ],
        subApps: z ? [] : [
          { id: "app-1", entName: "德阳恒基建设咨询有限公司", uscc: "91510600MA6XXXX3K2", contact: "周恒",
            phone: "138****6021", ratioToSub: 0.18, status: "pending", rejectReason: null, createdAt: "2026-10-21" },
          { id: "app-2", entName: "绵阳顺达工程服务有限公司", uscc: "91510700MAXXXX8D7", contact: "李达",
            phone: "139****1182", ratioToSub: 0.25, status: "pending", rejectReason: null, createdAt: "2026-10-22" },
          { id: "app-3", entName: "南充某工程咨询行", uscc: "91511300MAXXXX0Q9", contact: "赵某",
            phone: "137****4460", ratioToSub: 0.30, status: "rejected", rejectReason: "资质材料不完整，补齐后可重新申请", createdAt: "2026-10-09" }
        ],
        channels: z ? [] : [
          { id: "ch-1", code: "CH-P-8KQ2TV", ownerType: "province", ownerName: "本公司总码", tpl: "tpl1", src: "wechat", status: "active", createdAt: "2026-10-01", voidInfo: null },
          { id: "ch-2", code: "CH-P-4HN7MW", ownerType: "province", ownerName: "线下展会码", tpl: "tpl2", src: "offline", status: "active", createdAt: "2026-10-12", voidInfo: null },
          { id: "ch-3", code: "CH-E-2QP6ZK", ownerType: "staff", ownerName: "员工·王敏", tpl: "tpl1", src: "wechat", status: "active", createdAt: "2026-10-05", voidInfo: null },
          { id: "ch-0", code: "CH-P-9WT1XC", ownerType: "province", ownerName: "旧版总码", tpl: "tpl1", src: "wechat", status: "void", createdAt: "2026-09-01", voidInfo: { reason: "版本更换", at: "2026-09-30" } }
        ],
        leads: z ? [] : [
          { id: "ld-1", name: "张*", phone: "138****2210", stage: "repaid", channelCode: "CH-P-8KQ2TV", viaUserReinvite: false, paidAmount: 3600, src: "wechat", nextFollowAt: "", idleDays: 2, createdAt: "2026-10-06",
            follows: [{ at: "2026-10-12", text: "已解锁会员+增值包，复购一次", by: "boss" }] },
          { id: "ld-2", name: "刘**", phone: "139****8834", stage: "paid", channelCode: "CH-P-8KQ2TV", viaUserReinvite: false, paidAmount: 2800, src: "wechat", nextFollowAt: "2026-10-26", idleDays: 4, createdAt: "2026-10-09", follows: [] },
          { id: "ld-3", name: "陈工", phone: "137****5120", stage: "paid", channelCode: "CH-E-2QP6ZK", viaUserReinvite: false, paidAmount: 1980, src: "wechat", nextFollowAt: "", idleDays: 9, createdAt: "2026-10-08", follows: [] },
          { id: "ld-4", name: "王*", phone: "186****3077", stage: "onboarded", channelCode: "CH-P-4HN7MW", viaUserReinvite: false, paidAmount: 0, src: "offline", nextFollowAt: "2026-10-25", idleDays: 3, createdAt: "2026-10-15", follows: [] },
          { id: "ld-5", name: "赵*", phone: "135****9921", stage: "onboarded", channelCode: "CH-P-8KQ2TV", viaUserReinvite: false, paidAmount: 0, src: "wechat", nextFollowAt: "", idleDays: 31, createdAt: "2026-09-20", follows: [] },
          { id: "ld-6", name: "孙**", phone: "158****0456", stage: "registered", channelCode: "CH-P-4HN7MW", viaUserReinvite: false, paidAmount: 0, src: "offline", nextFollowAt: "2026-10-24", idleDays: 1, createdAt: "2026-10-20", follows: [] },
          { id: "ld-7", name: "周*", phone: "177****6630", stage: "registered", channelCode: "CH-E-2QP6ZK", viaUserReinvite: false, paidAmount: 0, src: "wechat", nextFollowAt: "", idleDays: 6, createdAt: "2026-10-18", follows: [] },
          { id: "ld-8", name: "吴*", phone: "152****7788", stage: "lost", channelCode: "CH-P-8KQ2TV", viaUserReinvite: false, paidAmount: 0, src: "wechat", nextFollowAt: "", idleDays: 40, createdAt: "2026-09-10", follows: [] },
          { id: "ld-x", name: "（他人邀请）钱*", phone: "131****0000", stage: "onboarded", channelCode: "—", viaUserReinvite: true, paidAmount: 0, src: "—", nextFollowAt: "", idleDays: 0, createdAt: "2026-10-17", follows: [] }
        ],

        calc1: [
          { id: "c1-l1", month: "2026-10", level: 1, counterparty: "平台 · 润锦工程链", calcAmount: 5000, issuedAt: "2026-10-31", dueLabel: "T+3 工作日内确认 · 异议 T+5 工作日闭环" },
          { id: "c0-l1", month: "2026-09", level: 1, counterparty: "平台 · 润锦工程链", calcAmount: 4600, issuedAt: "2026-09-30", dueLabel: "已平账" }
        ],
        payRegs1: [
          { id: "r1-l1", calcId: "c1-l1", amount: 4760, method: "bank", date: "2026-11-03",
            vouchers: [{ name: "对公转账回单-1103.jpg", kind: "image" }], registeredBy: "boss", status: "disputed",
            reason: "平台反馈本月还差 ¥240 未到账，待线下核实", createdAt: "2026-11-03", voidInfo: null },
          { id: "r0-l1", calcId: "c0-l1", amount: 4600, method: "bank", date: "2026-10-09",
            vouchers: [{ name: "9月对公转款回单.jpg", kind: "image" }], registeredBy: "boss", status: "confirmed", confirmedAt: "2026-10-10", signMethod: "record", createdAt: "2026-10-09", voidInfo: null }
        ],
        statements1: [
          { id: "st-cur-1", calcId: "c1-l1", month: "2026-10", status: "open" },
          { id: "st-prev-1", calcId: "c0-l1", month: "2026-09", status: "balanced", balancedAt: "2026-10-11" }
        ],

        calc2: [
          { id: "c1-l2", month: "2026-10", level: 2, counterparty: "成都蓉建科贸有限公司", calcAmount: 1000, issuedAt: "2026-10-31", dueLabel: "出账后 15 天内确认 · 仅提醒不自动到账", dueDay: 12 },
          { id: "c0-l2", month: "2026-09", level: 2, counterparty: "成都蓉建科贸有限公司", calcAmount: 920, issuedAt: "2026-09-30", dueLabel: "已平账" }
        ],
        payRegs2: [
          { id: "r1-l2", calcId: "c1-l2", amount: 1000, method: "bank", date: "2026-11-02",
            vouchers: [{ name: "转给蓉建科贸回单.jpg", kind: "image" }], registeredBy: "boss", status: "pending_confirm",
            createdAt: "2026-11-02", dueDay: 12, voidInfo: null },
          { id: "r0-l2", calcId: "c0-l2", amount: 920, method: "bank", date: "2026-10-08",
            vouchers: [{ name: "9月转款回单.jpg", kind: "image" }], registeredBy: "boss", status: "confirmed", confirmedAt: "2026-10-09", signMethod: "esign", createdAt: "2026-10-08", voidInfo: null }
        ],
        statements2: [
          { id: "st-cur-2", calcId: "c1-l2", month: "2026-10", status: "open" },
          { id: "st-prev-2", calcId: "c0-l2", month: "2026-09", status: "balanced", balancedAt: "2026-10-10" }
        ],

        alerts: [
          { type: "danger", icon: "⚠", title: "平台⇄省代对账差异 ¥240", desc: "10 月测算 ¥5,000 − 已登记 ¥4,760，差异未清零，平账已锁定，请先处理异议。", to: "#/reconcile" },
          { type: "info", icon: "⏱", title: "T+7 冻结 ¥3,000", desc: "本月在途冻结金额，到期后入下月总盘（模拟测算）。" },
          { type: "warn", icon: "🔔", title: "1 条线索 31 天未跟进", desc: "赵* 已超沉寂阈值，建议回收或重新分配。", to: "#/invite" }
        ]
      }
    };
  }

  function subSeed(readonly) {
    var status = readonly ? "suspended" : "active";
    return {
      mode: "sub",
      sub: {
        profile: { name: "成都蓉建科贸有限公司", parent: "四川润锦工程服务有限公司（省级总代）", province: "四川省",
          status: status, ratioToSub: 0.20, authNo: "O4-2026-10", since: "2026-08-12",
          inviteScope: "标准授权（平台配置 + O4 协议内）", inviteRateReadonly: true },
        financeBase: { eligible: 10000, frozen: 3000, ratioToSub: 0.20 },
        agreement: { state: readonly ? "signed" : "pending_mine", code: "O4-2026-10", version: "v2026.10",
          rejectReason: null, completedAt: readonly ? "2026-08-12" : null,
          clauses: ["合作期限与授权范围", "约定所得比例 20%（平台配置 + 协议约定）", "终端用户单层绑定，不发展下级企业", "线下结算与对账、凭证与电子签留痕", "模拟测算口径与免责条款"] },
        channels: [
          { id: "sch-1", code: "CH-S-5KQ8TN", ownerType: "sub", ownerName: "本企业渠道码", tpl: "tpl1", src: "wechat", status: "active", createdAt: "2026-10-03", voidInfo: null }
        ],
        leads: [
          { id: "sld-1", name: "林*", phone: "139****2014", stage: "paid", channelCode: "CH-S-5KQ8TN", viaUserReinvite: false, paidAmount: 2400, src: "wechat", idleDays: 3, follows: [], nextFollowAt: "" },
          { id: "sld-2", name: "郭**", phone: "137****8852", stage: "onboarded", channelCode: "CH-S-5KQ8TN", viaUserReinvite: false, paidAmount: 0, src: "wechat", idleDays: 5, follows: [], nextFollowAt: "2026-10-27" },
          { id: "sld-3", name: "何*", phone: "186****3301", stage: "registered", channelCode: "CH-S-5KQ8TN", viaUserReinvite: false, paidAmount: 0, src: "wechat", idleDays: 2, follows: [], nextFollowAt: "" },
          { id: "sld-x", name: "（用户再邀请）高*", phone: "130****0000", stage: "registered", channelCode: "—", viaUserReinvite: true, paidAmount: 0, src: "—", idleDays: 0, follows: [], nextFollowAt: "" }
        ],
        calc: [
          { id: "sc-1", month: "2026-10", level: 2, counterparty: "四川润锦工程服务有限公司", calcAmount: 1000, issuedAt: "2026-10-31", dueLabel: "出账后 15 天内确认 · 仅提醒不自动到账", dueDay: 12 },
          { id: "sc-0", month: "2026-09", level: 2, counterparty: "四川润锦工程服务有限公司", calcAmount: 920, issuedAt: "2026-09-30", dueLabel: "已平账" }
        ],
        payRegs: [
          { id: "sr-1", calcId: "sc-1", amount: 1000, method: "bank", date: "2026-11-02",
            vouchers: [{ name: "省代转款回单.jpg", kind: "image" }], registeredBy: "省代", status: "pending_confirm", createdAt: "2026-11-02", dueDay: 12, voidInfo: null },
          { id: "sr-0", calcId: "sc-0", amount: 920, method: "bank", date: "2026-10-08",
            vouchers: [{ name: "9月回单.jpg", kind: "image" }], registeredBy: "省代", status: "confirmed", confirmedAt: "2026-10-09", signMethod: "esign", createdAt: "2026-10-08", voidInfo: null }
        ],
        statements: [
          { id: "sst-1", calcId: "sc-1", month: "2026-10", status: "open" },
          { id: "sst-0", calcId: "sc-0", month: "2026-09", status: "balanced", balancedAt: "2026-10-10" }
        ],
        alerts: [
          { type: "warn", icon: "🔔", title: "1 笔省代线下付款待你确认", desc: "出账第 12 天 / 15 天，仅提醒，逾期不会自动确认到账。", to: "#/payments" }
        ]
      }
    };
  }

  function applyV3Scenario(key) {
    var V3 = window.V3;
    if (key === "sub-active" || key === "sub-readonly" || key === "sub-dark") {
      V3.store.hydrate(subSeed(key === "sub-readonly"),
        { mode: "sub", theme: key === "sub-dark" ? "dark" : null, scenario: key === "sub-dark" ? "sub-active" : key, role: "sub_owner" });
    } else if (key === "dark") {
      V3.store.hydrate(provinceSeed("active", false), { mode: "province", theme: "dark", scenario: "active", role: "boss" });
    } else if (key === "active" || key === "suspended") {
      V3.store.hydrate(provinceSeed(key, false), { mode: "province", theme: "light", scenario: key, role: "boss" });
    } else if (key === "empty") {
      V3.store.hydrate(provinceSeed("active", true), { mode: "province", theme: "light", scenario: "empty", role: "boss" });
    } else {
      return;
    }
    window.dispatchEvent(new Event("v3:scenario"));
  }

  window.applyV3Scenario = applyV3Scenario;
  // 默认装载（按所在文件判定视角；同一目录 localStorage 共享，跨文件打开时强制纠偏）
  document.addEventListener("DOMContentLoaded", function () {
    if (!window.V3 || !window.V3.store) return;
    var isSubFile = window.V3_APP === "sub";
    var st = null;
    try { st = JSON.parse(localStorage.getItem(window.V3.store._lsKey) || "null"); } catch (e) {}
    var needSeed = !st || (isSubFile ? st.mode !== "sub" : st.mode !== "province");
    if (needSeed) {
      applyV3Scenario(isSubFile ? "sub-active" : "active");
    } else {
      // LS 已存在且视角匹配（刷新 / 二次打开 / 多标签）：必须先把持久化状态恢复进内存，
      // 否则 store.state 仍为 null，router 命中 if(!s) return 会白屏。
      window.V3.store.hydrate(st, null);
      window.dispatchEvent(new Event("v3:scenario"));
    }
  });
})();
