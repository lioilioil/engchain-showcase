/* ============================================================================
   js/agent-region.js —— M4-1 本省免解锁 / M4-2 本省无限关注（纯函数 + 当前身份读取）
   ----------------------------------------------------------------------------
   规则（D13/§3.5）：
   - 默认拒绝；仅授权省「同省」放行；省名归一；trade（建企买卖保证金）不免；
   - 不写 engchain-unlocked（免解锁不落 mark）；终止态（terminated/revoked/removed）不放行；
   - 总代/二级 active 本省无限关注；外省受限；无省不误放开；终止态不可关注；
   - 建筑30/中介50 旧额度不变（本模块只给「active 代理」返回无限，不改其它档位）。
   浏览器 → window.AgentRegion；node → module.exports（纯函数可注入 bits）。
   ============================================================================ */
(function (root) {
  'use strict';

  var TERMINAL = ['terminated', 'revoked', 'removed'];

  function norm(s) {
    return String(s == null ? '' : s).trim().replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '').replace(/\s/g, '');
  }

  /* 终止态判定（含二级 removed/terminated、总代 terminated/revoked/suspended 收回） */
  function isTerminal(status) {
    return TERMINAL.indexOf(status) >= 0 || status === 'suspended';
  }

  /* 当前代理身份位（浏览器读 AgentStore/DataBus；测试可直接传 bits） */
  function currentBits() {
    var bits = { active: false, province: '', status: '', kind: '' };
    try {
      var U = (root.DataBus && root.DataBus.current) ? (root.DataBus.current() || {}).id || '' : '';
      if (!U) return bits;
      if (root.AgentStore && typeof root.AgentStore.bitsFor === 'function') {
        var b = root.AgentStore.bitsFor(U) || {};
        bits = { active: !!(b.isProvinceAgent || b.isSubAgent), province: b.agentProvince || '', status: b.status || '', kind: b.isProvinceAgent ? 'province' : (b.isSubAgent ? 'sub' : '') };
      }
    } catch (e) {}
    return bits;
  }

  /* M4-1 本省免解锁：rec 需带 province/location；bizKey==='trade' 一律不免 */
  function isProvinceFreeUnlock(rec, bits) {
    bits = bits || currentBits();
    if (!bits || !bits.active) return false;
    if (isTerminal(bits.status)) return false;           /* 终止/暂停收回，不放行 */
    if (!bits.province) return false;                    /* 无省不误放开 */
    if (!rec) return false;
    if (rec.bizKey === 'trade') return false;            /* 保证金类排除 */
    var recProv = rec.province || rec.location || rec.region || '';
    return norm(recProv) === norm(bits.province);
  }

  /* M4-2 本省无限关注：active 代理同省 → true（无限）；其余返回 null 表示走旧额度 */
  function unlimitedFollow(companyProvince, bits) {
    bits = bits || currentBits();
    if (!bits || !bits.active) return null;
    if (isTerminal(bits.status)) return false;           /* 终止态不可关注 */
    if (!bits.province) return null;
    if (companyProvince == null) return null;            /* 无省信息不误放开 */
    return norm(companyProvince) === norm(bits.province);
  }

  var api = {
    norm: norm, isTerminal: isTerminal,
    currentBits: currentBits,
    isProvinceFreeUnlock: isProvinceFreeUnlock,
    unlimitedFollow: unlimitedFollow
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentRegion = api;
})(typeof window !== 'undefined' ? window : globalThis);
