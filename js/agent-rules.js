/* ============================================================================
   js/agent-rules.js —— 省级总代体系 M1 纯规则层（M1-3 / M1-4 / M1-7 / M1-11）
   ----------------------------------------------------------------------------
   纯函数、无 localStorage 依赖、无页面依赖，可在 node 下直接 require 测试，
   供 M2 申请/审核两处复用。浏览器与 node 双出口：
     浏览器 → window.AgentRules；node → module.exports。
   本模块不回写 entry.types / auth.partner / BalanceStore（资金隔离 D11）。
   ============================================================================ */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------
     M1-4 省名归一 + countRule + quotaCap（D7/D27）
     - 直辖市按 1；自治州/地区/盟与地级市同级计入；cityCount<10 保底 10
     - 港澳台本期不纳入（无记录，不返回名额）
     - 无匹配 → 回退配置补录骨架（needsBackfill，不崩溃、不写死 10 以外的推算）
     ------------------------------------------------------------------ */
  var MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市'];
  /* 本期不纳入（港澳台）：无配额记录，校验直接拦截 */
  var EXCLUDED_PROVINCES = ['台湾省', '香港特别行政区', '澳门特别行政区'];

  /* 常见别名 → 标准省名（与 pages/publish/editor.html:700 的 34 省清单对齐） */
  var PROVINCE_ALIASES = {
    '四川': '四川省', '成都': '四川省',
    '北京': '北京市', '上海': '上海市', '天津': '天津市', '重庆': '重庆市',
    '河北': '河北省', '山西': '山西省', '内蒙古': '内蒙古自治区', '内蒙': '内蒙古自治区',
    '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省',
    '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省', '福建': '福建省',
    '江西': '江西省', '山东': '山东省', '河南': '河南省', '湖北': '湖北省',
    '湖南': '湖南省', '广东': '广东省', '广西': '广西壮族自治区',
    '海南': '海南省', '贵州': '贵州省', '云南': '云南省', '西藏': '西藏自治区',
    '陕西': '陕西省', '甘肃': '甘肃省', '青海': '青海省',
    '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区'
  };

  function trim(s) { return String(s == null ? '' : s).trim(); }

  /* 省名归一：去空白、去「省/市/自治区/特别行政区/壮族/回族/维吾尔」后缀后再别名映射，
     最后回到标准全称。无法识别时原样返回（交由调用方判定无匹配）。 */
  function normalizeProvince(name, aliases) {
    var raw = trim(name);
    if (!raw) return '';
    var map = Object.assign({}, PROVINCE_ALIASES, aliases || {});
    if (map[raw]) return map[raw];
    /* 去后缀再试一次：四川省→四川→四川省；广西省→广西→广西壮族自治区 */
    var stripped = raw
      .replace(/特别行政区$/, '')
      .replace(/维吾尔自治区$/, '').replace(/壮族自治区$/, '').replace(/回族自治区$/, '')
      .replace(/自治区$/, '')
      .replace(/省$/, '').replace(/市$/, '');
    if (map[stripped]) return map[stripped];
    /* 全称直接命中（已带标准后缀） */
    if (EXCLUDED_PROVINCES.indexOf(raw) >= 0) return raw;
    return raw;
  }

  /* 在配置块中按归一省名查找记录 */
  function findQuotaRecord(provinceName, cfg) {
    if (!cfg || !Array.isArray(cfg.provinces)) return null;
    var norm = normalizeProvince(provinceName, cfg.aliases);
    for (var i = 0; i < cfg.provinces.length; i++) {
      var r = cfg.provinces[i];
      if (normalizeProvince(r.provinceName, cfg.aliases) === norm) return r;
    }
    return null;
  }

  /* countRule：由 cityCount 现算 quotaCap = max(minCap, cityCount)；
     直辖市 cityCount=1 但仍受 minCap 保底。返回 {cityCount, quotaCap, needsBackfill} */
  function quotaCapOf(provinceName, cfg) {
    var minCap = (cfg && typeof cfg.minCap === 'number') ? cfg.minCap : 10;
    var norm = normalizeProvince(provinceName, cfg && cfg.aliases);
    if (!norm) return { ok: false, code: 'E_PROVINCE_EMPTY', cityCount: null, quotaCap: null, needsBackfill: false };
    if (EXCLUDED_PROVINCES.indexOf(norm) >= 0) {
      return { ok: false, code: 'E_PROVINCE_EXCLUDED', province: norm, cityCount: null, quotaCap: null, needsBackfill: false };
    }
    var rec = findQuotaRecord(norm, cfg);
    if (!rec) {
      /* 无匹配：回退配置补录骨架（保底 minCap，待生产按民政部行政区划补真实计数） */
      return { ok: true, code: 'BACKFILL', province: norm, cityCount: null, quotaCap: minCap, needsBackfill: true,
        countRule: (cfg && cfg.countRule) || '待补录：直辖市按1；自治州/地区/盟同级；<10保底10' };
    }
    var cityCount = Number(rec.cityCount) || 0;
    var quotaCap = Math.max(minCap, cityCount);
    return { ok: true, code: 'OK', province: norm, provinceCode: rec.provinceCode || '',
      cityCount: cityCount, quotaCap: quotaCap, needsBackfill: false,
      countRule: rec.countRule || '' , remark: rec.remark || ''};
  }

  /* ------------------------------------------------------------------
     M1-3 名额计数：只数签约二级公司记录，不数团队成员（D7/D33）。
     已释放态 removed/terminated 不占名额；rejected 不占；含其余在册状态。
     ------------------------------------------------------------------ */
  var SUB_OCCUPIED = ['approved', 'pending', 'suspended'];
  /* 只数签约二级公司记录，不数公司内团队成员（D7/D33）：
     isTeamMember 标记或缺公司/uscc 身份的记录一律不计入。 */
  function countActiveSubAgents(parentUid, subAgents) {
    var n = 0;
    (subAgents || []).forEach(function (s) {
      if (!s || s.parentUid !== parentUid) return;
      if (s.isTeamMember === true) return;
      if (SUB_OCCUPIED.indexOf(s.status) < 0) return;
      if (!s.company && !s.uscc) return;
      n++;
    });
    return n;
  }

  /* uscc 归一：去空白、大写，便于唯一绑定去重 */
  function normalizeUscc(uscc) {
    return trim(uscc).toUpperCase().replace(/\s+/g, '');
  }

  /* ------------------------------------------------------------------
     M1-3 校验纯函数集（提交/后台通过两处调用；各拦截返回错误码，不写死 10）
     ctx: { provinceAgents:[], subAgents:[], quotaCfg:{} }
     ------------------------------------------------------------------ */

  /* 总代申请校验 */
  function validateProvinceAgent(input, ctx) {
    ctx = ctx || {};
    var pa = ctx.provinceAgents || [];
    var province = normalizeProvince(input && input.province, ctx.quotaCfg && ctx.quotaCfg.aliases);
    /* 自然人身份位不开放总代主体申请（D31 主体边界） */
    if (input && input.isNaturalPerson) return { ok: false, code: 'E_NATURAL_PERSON_FORBIDDEN', msg: '自然人不能登记为省级总代主体，新体系主体法定为公司' };
    if (!province) return { ok: false, code: 'E_PROVINCE_EMPTY', msg: '请选择授权省' };
    var q = quotaCapOf(province, ctx.quotaCfg);
    if (!q.ok) return { ok: false, code: q.code, msg: '该省本期不纳入代理体系' };
    var uscc = normalizeUscc(input && input.uscc);
    /* 省独家：仅在册（active/suspended）占位，terminated/revoked 已释放可重授（D4/§3.9） */
    for (var i = 0; i < pa.length; i++) {
      var a = pa[i];
      if (a.status !== 'active' && a.status !== 'suspended') continue;
      if (normalizeProvince(a.province, ctx.quotaCfg && ctx.quotaCfg.aliases) === province) {
        return { ok: false, code: 'E_PROVINCE_TAKEN', msg: '该省已有在册省级总代（省独家）' };
      }
      if (uscc && normalizeUscc(a.branchCompany && a.branchCompany.uscc) === uscc) {
        return { ok: false, code: 'E_USCC_DUPLICATE', msg: '统一社会信用代码已绑定在册总代' };
      }
    }
    /* 一人一省：同一主体(uid/uscc)不得在另一省在册 */
    for (var j = 0; j < pa.length; j++) {
      var b = pa[j];
      if (b.status !== 'active' && b.status !== 'suspended') continue;
      if (input && b.uid === input.uid) return { ok: false, code: 'E_ONE_PROVINCE_PER_SUBJECT', msg: '同一主体已在册另一省，一人一省' };
    }
    return { ok: true, code: 'OK', province: province, quota: q };
  }

  /* 二级申请校验 */
  function validateSubAgent(input, ctx) {
    ctx = ctx || {};
    var pa = ctx.provinceAgents || [];
    var subs = ctx.subAgents || [];
    var parent = input && input.parent;
    if (input && input.isNaturalPerson) return { ok: false, code: 'E_NATURAL_PERSON_FORBIDDEN', msg: '自然人不能登记为二级公司主体' };
    if (!parent || (parent.status !== 'active' && parent.status !== 'suspended')) {
      return { ok: false, code: 'E_PARENT_NOT_ACTIVE', msg: '上级总代不在册或已终止，不可发起二级' };
    }
    /* 自指拦截：不能绑定自己（uid 相同或 uscc 相同） */
    var uscc = normalizeUscc(input && input.uscc);
    var parentUscc = normalizeUscc(parent.branchCompany && parent.branchCompany.uscc);
    if ((input && input.uid && parent.uid === input.uid) || (uscc && uscc === parentUscc)) {
      return { ok: false, code: 'E_SELF_REF', msg: '不可自指绑定为自己的二级' };
    }
    /* 一公司不可同时为总代+二级（省独家/唯一绑定/自指互斥，D31） */
    for (var i = 0; i < pa.length; i++) {
      var a = pa[i];
      if (a.status !== 'active' && a.status !== 'suspended') continue;
      if (uscc && normalizeUscc(a.branchCompany && a.branchCompany.uscc) === uscc) {
        return { ok: false, code: 'E_COMPANY_DUAL_ROLE', msg: '该公司已是在册省级总代，不可同时登记为二级' };
      }
    }
    /* 同省归一：二级必须与总代同省（D6，省内可跨市） */
    var province = normalizeProvince(input && input.province, ctx.quotaCfg && ctx.quotaCfg.aliases);
    var parentProvince = normalizeProvince(parent.province, ctx.quotaCfg && ctx.quotaCfg.aliases);
    if (!province) return { ok: false, code: 'E_PROVINCE_EMPTY', msg: '请选择省份' };
    if (province !== parentProvince) return { ok: false, code: 'E_PROVINCE_MISMATCH', msg: '二级必须与总代同省，跨省禁止' };
    /* uscc 唯一绑定：一公司绑一总代（D8），removed/terminated 已释放 */
    for (var j = 0; j < subs.length; j++) {
      var s = subs[j];
      if (s.status === 'removed' || s.status === 'terminated' || s.status === 'rejected') continue;
      if (uscc && normalizeUscc(s.company && s.company.uscc) === uscc) {
        return { ok: false, code: 'E_USCC_DUPLICATE', msg: '该公司已绑定其他总代（uscc 唯一绑定）' };
      }
    }
    /* 名额：读省表 quotaCap，只数签约二级公司不数成员（D7） */
    var q = quotaCapOf(parentProvince, ctx.quotaCfg);
    var used = countActiveSubAgents(parent.uid, subs);
    if (q.ok && used >= q.quotaCap) {
      return { ok: false, code: 'E_QUOTA_EXCEEDED', msg: '该省二级名额已满（' + used + '/' + q.quotaCap + '）' };
    }
    return { ok: true, code: 'OK', province: province, quota: q, used: used };
  }

  /* ------------------------------------------------------------------
     M1-7 终止态状态机骨架（D28/§3.9）
     总代 active/suspended/terminated/revoked；二级 approved/removed/terminated。
     合法边：suspended↔active 可恢复；terminated/revoked 不可逆；
     removed/terminated 释放名额与绑定；封存只标记不删。
     ------------------------------------------------------------------ */
  var PROVINCE_EDGES = {
    active: ['suspended', 'terminated', 'revoked'],
    suspended: ['active', 'terminated', 'revoked'],
    terminated: [],
    revoked: []
  };
  var SUB_EDGES = {
    pending: ['approved', 'rejected'],
    approved: ['removed', 'terminated'],
    suspended: ['approved', 'removed', 'terminated'],
    removed: [],
    terminated: [],
    rejected: ['pending']
  };

  function canTransition(kind, from, to) {
    var edges = kind === 'province' ? PROVINCE_EDGES : SUB_EDGES;
    var list = edges[from];
    return !!(list && list.indexOf(to) >= 0);
  }
  function isTerminal(kind, status) {
    return kind === 'province'
      ? (status === 'terminated' || status === 'revoked')
      : (status === 'removed' || status === 'terminated');
  }
  /* 终止/封存态是否释放省或名额绑定 */
  function releasesOnTermination(kind, status) {
    if (kind === 'province') return status === 'terminated' || status === 'revoked';
    return status === 'removed' || status === 'terminated';
  }

  /* ------------------------------------------------------------------
     M1-11 兼任并集骨架（D31）
     各资格位独立布尔并存、不互关；收益线独立标识；hasAny 并集门控。
     ------------------------------------------------------------------ */
  var REVENUE_LINES = ['individualPartner', 'agentSubLedger', 'selfLine', 'legacyRebate', 'franchise'];

  /* 并集门控：任一命中即放行对应既有入口；不新增公司主体资格 */
  function hasAny(bits, flags) {
    if (!bits) return false;
    for (var i = 0; i < flags.length; i++) {
      if (bits[flags[i]]) return true;
    }
    return false;
  }

  /* 汇总资格位（各线独立，关闭新身份不清除个人合伙人位） */
  function buildUnionBits(parts) {
    parts = parts || {};
    return {
      individualPartner: !!parts.individualPartner,
      legacyRebate: !!parts.legacyRebate,
      isProvinceAgent: !!parts.isProvinceAgent,
      isSubAgent: !!parts.isSubAgent,
      franchise: !!parts.franchise,
      revenueLines: REVENUE_LINES.filter(function (ln) {
        if (ln === 'agentSubLedger') return !!parts.isProvinceAgent || !!parts.isSubAgent;
        if (ln === 'selfLine') return !!parts.isProvinceAgent;
        return !!parts[ln];
      })
    };
  }

  var api = {
    MUNICIPALITIES: MUNICIPALITIES,
    EXCLUDED_PROVINCES: EXCLUDED_PROVINCES,
    normalizeProvince: normalizeProvince,
    normalizeUscc: normalizeUscc,
    findQuotaRecord: findQuotaRecord,
    quotaCapOf: quotaCapOf,
    countActiveSubAgents: countActiveSubAgents,
    validateProvinceAgent: validateProvinceAgent,
    validateSubAgent: validateSubAgent,
    PROVINCE_EDGES: PROVINCE_EDGES,
    SUB_EDGES: SUB_EDGES,
    canTransition: canTransition,
    isTerminal: isTerminal,
    releasesOnTermination: releasesOnTermination,
    REVENUE_LINES: REVENUE_LINES,
    hasAny: hasAny,
    buildUnionBits: buildUnionBits
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
