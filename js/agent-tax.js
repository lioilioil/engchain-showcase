/* ============================================================================
   js/agent-tax.js —— M1-5 税算纯函数（D32 现行法定值；个人/企业分两张表）
   ----------------------------------------------------------------------------
   - 方案A 劳务报酬：61号公告第八条减除费用 + 预扣率表二（20/30/40%，0/2000/7000）
   - 方案B 经营所得：法定五级超额累进（5/10/20/30/35%，0/1500/10500/40500/65500）；
     deemedLevyRate=null（不填/不设默认/禁1%），null 时仅展示五级表、不产税额
   - 企业税目块仅展示不计算；个人/企业分表，不套用同一张
   - 全部税数字为「模拟测算，非税务意见，非实际代扣金额」
   - 不改个人合伙人 8%/2% 返佣费率、¥50 门槛、T+1 结算（R-01~R-04）
   浏览器 → window.AgentTax；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';

  /* 法定出厂默认（与 data.js MOCK.business.withholdingTax 同值；data.js 缺失时回退本默认） */
  var DEFAULTS = {
    disclaimer: '模拟测算，非税务意见，非实际代扣金额，非完税凭证；本页数字仅为演示测算，不构成申报、扣缴、开票或实名认证依据。',
    activeScheme: 'labor',
    labor: {
      /* 61号公告第八条：每次收入 ≤4000 减 800；>4000 减 20%（法定固定值） */
      deduction: { threshold: 4000, fixed: 800, pct: 0.2 },
      /* 个人所得税预扣率表二（居民个人劳务报酬预扣预缴，法定固定值；预扣率非最终税负） */
      brackets: [
        { max: 20000, rate: 0.20, quick: 0 },
        { max: 50000, rate: 0.30, quick: 2000 },
        { max: Infinity, rate: 0.40, quick: 7000 }
      ],
      note: '20%/30%/40% 为预扣预缴率，不是最终税负；年度并入综合所得适用 3%–45% 七级超额累进汇算，多退少补（个税法第十一条；61号公告第八条末款）。'
    },
    business: {
      /* 核定附征率定稿：null（不填、不设默认、禁止默认1%）；生产前由注册地主管税务机关按行业核定 */
      deemedLevyRate: null,
      /* 法定五级超额累进（个税法税率表二，按年，需成本费用损失，非按笔附征） */
      statutoryBrackets: [
        { max: 30000, rate: 0.05, quick: 0 },
        { max: 90000, rate: 0.10, quick: 1500 },
        { max: 300000, rate: 0.20, quick: 10500 },
        { max: 500000, rate: 0.30, quick: 40500 },
        { max: Infinity, rate: 0.35, quick: 65500 }
      ]
    },
    /* 生产所得定性三要件判定顺序（定稿）：①是否办理市场主体登记 ②是否持续经营 ③是否存在雇佣关系 */
    naturalPersonQualification: {
      steps: ['是否办理市场主体登记', '是否持续经营', '是否存在雇佣关系'],
      conclusion: '未登记 + 非持续经营 + 无雇佣关系的推荐/介绍返佣 → 劳务报酬所得；办理个体工商户/个独登记并持续经营 → 经营所得。生产定性以主管税务机关认定为准。'
    },
    /* 企业税目书面陈述：仅展示，不计算（平台不付款、仅台账测算） */
    enterpriseTaxItems: [
      { name: '增值税·一般纳税人（现代服务—商务辅助—经纪代理服务）', rate: '6%', calc: false, basis: '《增值税法》2026-01-01施行第十条（三）；财税〔2016〕36号附件1税目注释' },
      { name: '增值税·小规模纳税人', rate: '3%征收率；2026-01-01至2027-12-31 3%减按1%；月10万/季30万以下免征', calc: false, basis: '财政部税务总局2026年第10号公告；税务总局2026年第4号公告' },
      { name: '企业所得税', rate: '基本税率25%', calc: false, basis: '《企业所得税法》第四条' },
      { name: '小型微利优惠', rate: '减按25%计应纳税所得额×20%，实际税负5%（至2027-12-31）', calc: false, basis: '财政部税务总局2023年第12号公告第三条/第五条' },
      { name: '附加税费', rate: '城建税市区7%/县城镇5%/其他1%；教育费附加3%；地方教育附加2%；六税两费减半（至2027-12-31）', calc: false, basis: '城建税法第四条；国务院令448号；财综〔2010〕98号；2023年第12号公告第二条' }
    ]
  };

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

  /* 合并外部配置（data.js MOCK.business.withholdingTax），缺省回退法定默认 */
  function resolveCfg(over) {
    var cfg = deepClone(DEFAULTS);
    over = over || {};
    ['disclaimer', 'activeScheme'].forEach(function (k) { if (over[k] !== undefined) cfg[k] = over[k]; });
    if (over.labor) {
      if (over.labor.deduction) Object.assign(cfg.labor.deduction, over.labor.deduction);
      if (Array.isArray(over.labor.brackets)) cfg.labor.brackets = over.labor.brackets;
      if (over.labor.note) cfg.labor.note = over.labor.note;
    }
    if (over.business) {
      /* deemedLevyRate 显式 null 必须保留；仅在提供非 null 值时覆盖，禁止悄悄补默认 1% */
      if (over.business.deemedLevyRate !== undefined) cfg.business.deemedLevyRate = over.business.deemedLevyRate;
      if (Array.isArray(over.business.statutoryBrackets)) cfg.business.statutoryBrackets = over.business.statutoryBrackets;
    }
    if (over.naturalPersonQualification) Object.assign(cfg.naturalPersonQualification, over.naturalPersonQualification);
    if (Array.isArray(over.enterpriseTaxItems)) cfg.enterpriseTaxItems = over.enterpriseTaxItems;
    return cfg;
  }

  /* 方案A 劳务报酬按次预扣：应纳税所得额=收入−减除费用；预扣税额=max(0, 所得×率−速扣)；
     税后(预扣口径)=收入−预扣税额。负数/非正数税取 0。 */
  function laborWithholding(gross, over) {
    var cfg = resolveCfg(over);
    var g = Math.max(0, Number(gross) || 0);
    var d = cfg.labor.deduction;
    var deduction = g <= d.threshold ? d.fixed : r2(g * d.pct);
    var taxable = Math.max(0, r2(g - deduction));
    var rate = 0, quick = 0, bracketIdx = -1;
    for (var i = 0; i < cfg.labor.brackets.length; i++) {
      var b = cfg.labor.brackets[i];
      if (taxable <= b.max) { rate = b.rate; quick = b.quick; bracketIdx = i; break; }
    }
    var tax = Math.max(0, r2(taxable * rate - quick));
    var net = r2(g - tax);
    return {
      scheme: 'labor', gross: r2(g), deduction: r2(deduction), taxable: taxable,
      rate: rate, quick: quick, bracketIdx: bracketIdx,
      tax: tax, net: net,
      note: cfg.labor.note, disclaimer: cfg.disclaimer
    };
  }

  /* 方案B 经营所得（按年应纳税所得额五级超额）。
     deemedLevyRate===null → 仅展示五级表、不产税额（tax=null, displayOnly=true），
     绝不默认 1%；非 null 附征率时才按附征率简易测算（附征率由主管局核定，本版不启用）。 */
  function businessAnnualTaxable(taxableIncome, over) {
    var cfg = resolveCfg(over);
    var ti = Math.max(0, Number(taxableIncome) || 0);
    var rows = cfg.business.statutoryBrackets.map(function (b) {
      return { max: b.max, rate: b.rate, quick: b.quick };
    });
    if (cfg.business.deemedLevyRate == null) {
      return { scheme: 'business', taxableIncome: r2(ti), tax: null, displayOnly: true,
        deemedLevyRate: null, brackets: rows,
        note: 'deemedLevyRate=null：仅展示法定五级表，不产税额；核定附征率生产前由注册地主管税务机关按行业核定。',
        disclaimer: cfg.disclaimer };
    }
    var rate = 0, quick = 0;
    for (var i = 0; i < rows.length; i++) {
      if (ti <= rows[i].max) { rate = rows[i].rate; quick = rows[i].quick; break; }
    }
    var tax = Math.max(0, r2(ti * rate - quick));
    return { scheme: 'business', taxableIncome: r2(ti), tax: tax, displayOnly: false,
      deemedLevyRate: cfg.business.deemedLevyRate, brackets: rows, rate: rate, quick: quick,
      note: '查账五级表测算；附征率仅在主管局核定后启用。', disclaimer: cfg.disclaimer };
  }

  /* 企业税目（只读展示，无计算列） */
  function enterpriseTaxItems(over) { return resolveCfg(over).enterpriseTaxItems; }
  function qualificationSteps(over) { return resolveCfg(over).naturalPersonQualification; }
  function disclaimer(over) { return resolveCfg(over).disclaimer; }

  var api = {
    DEFAULTS: DEFAULTS,
    resolveCfg: resolveCfg,
    laborWithholding: laborWithholding,
    businessAnnualTaxable: businessAnnualTaxable,
    enterpriseTaxItems: enterpriseTaxItems,
    qualificationSteps: qualificationSteps,
    disclaimer: disclaimer,
    round2: r2
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentTax = api;
})(typeof window !== 'undefined' ? window : globalThis);
