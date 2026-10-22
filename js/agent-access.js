/* ============================================================================
   js/agent-access.js —— M3-7 旧返佣出口门控矩阵（D11/F-01/F-06/D31 并集）
   ----------------------------------------------------------------------------
   - 新代理身份（总代/二级）的测算佣金不可提现、不进旧返佣中心/海报/直达URL；
   - 自身余额（wallet 自有经营余额）开放，沿用原门槛，不经本模块改写；
   - 叠加个人合伙人：保留其返佣/提现入口（并集门控，各资格位独立不互关）；
   - u9 个人合伙人、旧 base/limited 企业正常。
   纯函数，供各旧出口复用；浏览器 → window.AgentAccess；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';

  /* acc 字段（来自 entryAccess）：
     isIndividualPartner, isResident, dist, distTier,
     agent:{active,isProvinceAgent,isSubAgent,legacyDistributor} | undefined */
  function agentBlocked(acc) {
    var a = acc && acc.agent;
    if (!a || !a.active) return false;
    /* 叠加个人合伙人 → 不关闭其个人线入口（并集） */
    if (acc.isIndividualPartner) return false;
    return !a.legacyDistributor;
  }

  /* 旧邀请返佣中心 / 佣金提现 / 海报 / 直达URL：新代理（无个人合伙人叠加）否定门控 */
  function legacyExitAllowed(exit, acc) {
    acc = acc || {};
    /* 自身余额出口不在旧返佣门控内，单独处理 */
    if (exit === 'ownBalance') return true;
    if (exit === 'agentLedger') return !!(acc.agent && acc.agent.active);
    /* 个人合伙人(u9) / 旧企业入驻(base/limited/resident) 原样放行 */
    if (acc.isIndividualPartner) return true;
    if (acc.isResident || acc.dist) return true;
    /* 仅新代理身份：旧返佣出口关闭 */
    return !agentBlocked(acc);
  }

  /* 测算佣金是否可提现：新代理测算一律不可提（平台不付款） */
  function commissionWithdrawable(acc) {
    if (acc && acc.agent && acc.agent.active && !acc.isIndividualPartner) return false;
    return true; /* 个人合伙人/旧线按各自既有规则，本模块不阻断 */
  }

  /* 并集门控：任一资格位命中即放行对应既有入口（不新增公司主体资格） */
  function hasAny(bits, flags) {
    if (!bits) return false;
    for (var i = 0; i < flags.length; i++) if (bits[flags[i]]) return true;
    return false;
  }

  var api = {
    legacyExitAllowed: legacyExitAllowed,
    commissionWithdrawable: commissionWithdrawable,
    agentBlocked: agentBlocked,
    hasAny: hasAny
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentAccess = api;
})(typeof window !== 'undefined' ? window : globalThis);
