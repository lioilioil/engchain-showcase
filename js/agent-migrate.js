/* ============================================================================
   js/agent-migrate.js —— M4-5 存量旧数据版本化迁移（非全局重置）
   ----------------------------------------------------------------------------
   原则：
   - 版本号一次迁移，幂等；resetAll 与自动迁移分工（不以全局重置为唯一手段）；
   - 清 engchain-dist-seeded-v1、旧 full 档位 Rebate/Referral、u8 旧身份回退；
   - owner→legalRep/admin 映射（M1-9），旧 owner 保留 canManage 兼容不失权；
   - 不删 franchise（¥29,800 独立付费）、不删个人合伙人(u9)、不动 base/limited 真实返佣；
   - 新用户空表正常播种（迁移只清旧线残留，不制造空表阻断）。
   浏览器 window.AgentMigrate；node module.exports（注入 storage）。
   ============================================================================ */
(function (root) {
  'use strict';
  var SCHEMA_KEY = 'engchain-agent-migration-v';
  var CURRENT = 'agent-schema/1';

  function makeStorage(ls) {
    return {
      get: function (k) { try { return ls.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { ls.setItem(k, v); } catch (e) {} },
      remove: function (k) { try { ls.removeItem(k); } catch (e) {} },
      parse: function (k, dft) {
        try { var v = ls.getItem(k); return v == null ? dft : JSON.parse(v); } catch (e) { return dft; }
      },
      write: function (k, v) { try { ls.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
  }

  /* 步骤1：清旧分销演示种子标记（旧企业合伙人线，M4-4 停注入后清残留） */
  function stepClearDistSeed(s) {
    s.remove('engchain-dist-seeded-v1');
    return { step: 'clearDistSeed', ok: true };
  }

  /* 步骤2：清旧 full 档位 Rebate 记录与 u8 受益的旧线记录；保留个人合伙人/base/limited 真实记录 */
  function stepPruneOldRebate(s) {
    var removed = 0;
    var rb = s.parse('engchain-rebate-orders', []);
    if (Array.isArray(rb)) {
      var kept = rb.filter(function (r) {
        if (r && (r.tier === 'full' || r.ruleSnapshot && r.ruleSnapshot.tier === 'full')) return false;
        if (r && r.beneficiaryId === 'u8') return false;
        return true;
      });
      removed += rb.length - kept.length;
      s.write('engchain-rebate-orders', kept);
    }
    var rf = s.parse('engchain-referral', []);
    if (Array.isArray(rf)) {
      var keptRf = rf.filter(function (l) {
        if (!l) return true;
        if (l.inviterId === 'u8' || l.inviteeId === 'u8') return false;
        return true;
      });
      removed += rf.length - keptRf.length;
      s.write('engchain-referral', keptRf);
    }
    return { step: 'pruneOldRebate', removed: removed, ok: true };
  }

  /* 步骤3：u8 旧企业合伙人身份回退为实名普通用户（与 M4-4 种子口径一致），不动其他账号 */
  function stepRevertU8(s) {
    var users = s.parse('engchain-users', null);
    if (!Array.isArray(users)) return { step: 'revertU8', changed: false, ok: true };
    var changed = false;
    users.forEach(function (u) {
      if (u && u.id === 'u8' && u.identity && (u.identity.enterprise === 'resident' || (u.entry && u.entry.active && u.entry.type === 'partner'))) {
        u.tag = '实名用户'; u.status = 'verified'; u.company = '';
        u.identity = { personal: 'verified', enterprise: 'none', entryTypes: [] };
        u.auth = { realname: (u.auth && u.auth.realname) || { ok: true }, enterprise: { ok: false, expireAt: 0 }, personalQual: { ok: false, list: [] }, enterpriseQual: { ok: false, list: [] }, qual: { ok: false, list: [] }, payment: { ok: false, ts: 0 } };
        u.entry = { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' };
        changed = true;
      }
    });
    if (changed) s.write('engchain-users', users);
    return { step: 'revertU8', changed: changed, ok: true };
  }

  /* 步骤4：owner→legalRep/admin 映射（M1-9）：旧 owner 保留 canManage 兼容，追加 role=admin 不失权；
     legalRep 由执照派生另由团队视图只读展示，此处只做角色兼容映射，不改归属。 */
  function stepMapLegacyOwner(s) {
    var orgs = s.parse('engchain-orgs', null);
    var mapped = 0;
    if (Array.isArray(orgs)) {
      orgs.forEach(function (o) {
        var members = o && o.members;
        if (!Array.isArray(members)) return;
        members.forEach(function (m) {
          if (m && m.role === 'owner' && !m.newRole) {
            m.newRole = 'admin';        /* 旧 owner 平滑映射 admin，canManage 保留 */
            m.legacyOwner = true;
            mapped++;
          }
        });
      });
      if (mapped) s.write('engchain-orgs', orgs);
    }
    return { step: 'mapLegacyOwner', mapped: mapped, ok: true };
  }

  function run(storage) {
    var ls = storage || (root.localStorage);
    if (!ls) return { ok: false, reason: 'no storage' };
    var s = makeStorage(ls);
    var current = s.get(SCHEMA_KEY);
    if (current === CURRENT) return { ok: true, skipped: true, current: current };
    var report = [stepClearDistSeed(s), stepPruneOldRebate(s), stepRevertU8(s), stepMapLegacyOwner(s)];
    s.set(SCHEMA_KEY, CURRENT);
    return { ok: true, current: CURRENT, report: report };
  }

  var api = {
    CURRENT: CURRENT, SCHEMA_KEY: SCHEMA_KEY,
    makeStorage: makeStorage, run: run,
    _steps: { clearDistSeed: stepClearDistSeed, pruneOldRebate: stepPruneOldRebate, revertU8: stepRevertU8, mapLegacyOwner: stepMapLegacyOwner }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.AgentMigrate = api;
    /* 浏览器：脚本加载即执行一次版本化迁移（幂等，已迁移则跳过）；不做全局重置 */
    try { api.run(); } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
