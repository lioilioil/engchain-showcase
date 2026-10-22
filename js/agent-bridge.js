/* ============================================================================
   js/agent-bridge.js —— M2-2 双端审核桥接（方案A 共享种子导出/导入，最小闭环）
   ----------------------------------------------------------------------------
   背景：admin(:5173) 与 App(:8767) 跨源不共享 localStorage，demo 无后端。
   方案A：admin 内存审核动作 → 生成可导出审核种子 JSON → App 侧「导入审核种子」
   落盘 engchain-province-agents / engchain-sub-agents 并触发重算/刷新。
   生产演进：替换为真实后端桥接（审核 API + 事件推送），本模块为 demo 隔离层，不编造后端。
   事务式：先全量校验（四道校验走 M1-3 纯函数），任一失败整体不落库、无占位残留。
   浏览器 → window.AgentBridge；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';

  var SEED_SCHEMA = 'engchain-agent-seed/1';

  function deps() {
    var R = (typeof window !== 'undefined' && window.AgentRules) || (typeof require === 'function' ? require('./agent-rules.js') : null);
    var S = (typeof window !== 'undefined' && window.AgentStore) || (typeof require === 'function' ? require('./agent-store.js') : null);
    return { R: R, S: S };
  }

  /* ---------- 种子构造 / 解析 ---------- */
  function buildSeed(actions, meta) {
    return {
      schema: SEED_SCHEMA,
      exportedAt: Date.now(),
      meta: meta || {},
      actions: Array.isArray(actions) ? actions : []
    };
  }
  function parseSeed(text) {
    var seed = typeof text === 'string' ? JSON.parse(text) : text;
    if (!seed || seed.schema !== SEED_SCHEMA) throw new Error('E_SEED_SCHEMA: 非本系统审核种子（schema=' + (seed && seed.schema) + '）');
    if (!Array.isArray(seed.actions)) throw new Error('E_SEED_ACTIONS: 种子缺少 actions 数组');
    return seed;
  }
  function seedToText(seed) { return JSON.stringify(seed, null, 2); }

  /* ---------- 校验上下文（从当前 Store 快照构建，供 M1-3 纯函数） ---------- */
  function ctxFromStore(S, quotaCfg) {
    return {
      provinceAgents: S.listProvinces(),
      subAgents: S.listSubs(),
      quotaCfg: quotaCfg || {}
    };
  }

  function findProvince(S, id) { return S.getProvince(id); }
  function findSub(S, id) { return S.getSub(id); }

  /* ---------- 单动作校验 → 返回 {ok, plan?, error, code} ---------- */
  function validateOp(op, env) {
    var R = env.R, S = env.S, ctx = env.ctx;
    var parts = String(op.op || '').split('.');
    var kind = parts[0], action = parts[1];
    if (!kind || !action) return { error: 'E_OP_UNKNOWN', code: 'E_OP_UNKNOWN', msg: '无法识别动作: ' + op.op };

    /* ===== 总代 ===== */
    if (kind === 'province') {
      if (action === 'approve') {
        var rec = findProvince(S, op.id);
        if (!rec) return { error: 'E_RECORD_NOT_FOUND', code: 'E_RECORD_NOT_FOUND', msg: '待审核总代记录不存在: ' + op.id };
        if (rec.status !== 'pending') return { error: 'E_STATUS_NOT_PENDING', code: 'E_STATUS_NOT_PENDING', msg: '仅 pending 可通过' };
        /* 省独家二次校验（排除自身） */
        var others = ctx.provinceAgents.filter(function (a) { return a.id !== rec.id; });
        var v = R.validateProvinceAgent({
          uid: rec.uid, province: rec.province,
          uscc: rec.branchCompany && rec.branchCompany.uscc, isNaturalPerson: false
        }, { provinceAgents: others, subAgents: ctx.subAgents, quotaCfg: ctx.quotaCfg });
        if (!v.ok) return { error: v.msg, code: v.code };
        return { ok: true, plan: { type: 'province.approve', rec: rec, op: op } };
      }
      if (action === 'reject') {
        var rj = findProvince(S, op.id);
        if (!rj) return { error: 'E_RECORD_NOT_FOUND', code: 'E_RECORD_NOT_FOUND', msg: '待审核总代记录不存在: ' + op.id };
        if (!op.rejectReason || !String(op.rejectReason).trim()) return { error: 'E_REJECT_REASON_REQUIRED', code: 'E_REJECT_REASON_REQUIRED', msg: '驳回原因必填' };
        return { ok: true, plan: { type: 'province.reject', rec: rj, op: op } };
      }
      if (action === 'directGrant') {
        var nr = op.record;
        if (!nr || !nr.branchCompany) return { error: 'E_RECORD_MISSING', code: 'E_RECORD_MISSING', msg: '直接指定缺少公司资料' };
        var dv = R.validateProvinceAgent({
          uid: nr.uid, province: nr.province, uscc: nr.branchCompany.uscc, isNaturalPerson: false
        }, ctx);
        if (!dv.ok) return { error: dv.msg, code: dv.code };
        return { ok: true, plan: { type: 'province.directGrant', record: nr, op: op, quota: dv.quota } };
      }
      if (['suspend', 'resume', 'terminate', 'revoke'].indexOf(action) >= 0) {
        var tr = findProvince(S, op.id);
        if (!tr) return { error: 'E_RECORD_NOT_FOUND', code: 'E_RECORD_NOT_FOUND', msg: '记录不存在: ' + op.id };
        var toMap = { suspend: 'suspended', resume: 'active', terminate: 'terminated', revoke: 'revoked' };
        if (!R.canTransition('province', tr.status, toMap[action])) {
          return { error: 'E_ILLEGAL_EDGE', code: 'E_ILLEGAL_EDGE', msg: '非法状态流转: ' + tr.status + ' → ' + toMap[action] };
        }
        return { ok: true, plan: { type: 'province.transition', to: toMap[action], rec: tr, op: op } };
      }
    }

    /* ===== 二级 ===== */
    if (kind === 'sub') {
      if (action === 'approve') {
        var srec = findSub(S, op.id);
        if (!srec) return { error: 'E_RECORD_NOT_FOUND', code: 'E_RECORD_NOT_FOUND', msg: '待审核二级记录不存在: ' + op.id };
        if (srec.status !== 'pending') return { error: 'E_STATUS_NOT_PENDING', code: 'E_STATUS_NOT_PENDING', msg: '仅 pending 可通过' };
        var parent = S.getProvince(srec.parentUid) || ctx.provinceAgents.find(function (a) { return a.uid === srec.parentUid; });
        if (!parent) return { error: 'E_PARENT_NOT_FOUND', code: 'E_PARENT_NOT_FOUND', msg: '上级总代不存在' };
        var sv = R.validateSubAgent({
          uid: srec.uid, uscc: srec.company && srec.company.uscc, province: srec.province,
          parent: parent, isNaturalPerson: false
        }, { provinceAgents: ctx.provinceAgents, subAgents: ctx.subAgents.filter(function (x) { return x.id !== srec.id; }), quotaCfg: ctx.quotaCfg });
        if (!sv.ok) return { error: sv.msg, code: sv.code };
        return { ok: true, plan: { type: 'sub.approve', rec: srec, op: op } };
      }
      if (action === 'reject') {
        var srj = findSub(S, op.id);
        if (!srj) return { error: 'E_RECORD_NOT_FOUND', code: 'E_RECORD_NOT_FOUND', msg: '待审核二级记录不存在: ' + op.id };
        if (!op.rejectReason || !String(op.rejectReason).trim()) return { error: 'E_REJECT_REASON_REQUIRED', code: 'E_REJECT_REASON_REQUIRED', msg: '驳回原因必填' };
        return { ok: true, plan: { type: 'sub.reject', rec: srj, op: op } };
      }
      if (action === 'directGrant') {
        var snr = op.record;
        if (!snr || !snr.company) return { error: 'E_RECORD_MISSING', code: 'E_RECORD_MISSING', msg: '直接指定缺少公司资料' };
        var sparent = S.getProvince(snr.parentUid) || ctx.provinceAgents.find(function (a) { return a.uid === snr.parentUid; });
        if (!sparent) return { error: 'E_PARENT_NOT_FOUND', code: 'E_PARENT_NOT_FOUND', msg: '上级总代不存在' };
        var sdv = R.validateSubAgent({
          uid: snr.uid, uscc: snr.company.uscc, province: snr.province, parent: sparent, isNaturalPerson: false
        }, ctx);
        if (!sdv.ok) return { error: sdv.msg, code: sdv.code };
        return { ok: true, plan: { type: 'sub.directGrant', record: snr, op: op } };
      }
      if (['remove', 'terminate'].indexOf(action) >= 0) {
        var str = findSub(S, op.id);
        if (!str) return { error: 'E_RECORD_NOT_FOUND', code: 'E_RECORD_NOT_FOUND', msg: '记录不存在: ' + op.id };
        var stMap = { remove: 'removed', terminate: 'terminated' };
        if (!R.canTransition('sub', str.status, stMap[action])) {
          return { error: 'E_ILLEGAL_EDGE', code: 'E_ILLEGAL_EDGE', msg: '非法状态流转: ' + str.status + ' → ' + stMap[action] };
        }
        return { ok: true, plan: { type: 'sub.transition', to: stMap[action], rec: str, op: op } };
      }
    }
    return { error: 'E_OP_UNKNOWN', code: 'E_OP_UNKNOWN', msg: '不支持的动作: ' + op.op };
  }

  /* ---------- 执行计划（校验全过后才写） ---------- */
  function executePlan(plan, env) {
    var S = env.S, now = Date.now();
    var op = plan.op;
    var log = { operator: op.operator || 'admin', at: op.at || now, reason: op.reason || '', fromStatus: '', toStatus: '' };
    switch (plan.type) {
      case 'province.approve': {
        var rec = plan.rec;
        log.fromStatus = rec.status; log.toStatus = 'active';
        rec.status = 'active'; rec.appointedAt = now; rec.source = 'admin';
        rec.statusLog = rec.statusLog || []; rec.statusLog.push(log);
        return S.saveProvince(rec);
      }
      case 'province.reject': {
        var rj = plan.rec;
        log.fromStatus = rj.status; log.toStatus = 'rejected';
        rj.status = 'rejected'; rj.rejectReason = op.rejectReason;
        rj.rejects = rj.rejects || [];
        rj.rejects.push({ at: now, reason: op.rejectReason, operator: log.operator });
        rj.statusLog = rj.statusLog || []; rj.statusLog.push(log);
        return S.saveProvince(rj);
      }
      case 'province.directGrant': {
        var nr = Object.assign({ id: 'pa-' + now.toString(36), status: 'active', appointedAt: now,
          appointedBy: op.operator || 'admin', source: 'admin', rejects: [], statusLog: [], provinceHistory: [], sealedAt: 0 }, plan.record);
        nr.statusLog.push({ operator: log.operator, at: now, reason: '后台直接指定开通', fromStatus: '', toStatus: 'active' });
        return S.saveProvince(nr);
      }
      case 'province.transition':
        return S.transition('province', plan.rec.id, plan.to, { operator: log.operator, reason: op.reason || log.reason });
      case 'sub.approve': {
        var srec = plan.rec;
        log.fromStatus = srec.status; log.toStatus = 'approved';
        srec.status = 'approved'; srec.reviewedAt = now;
        srec.statusLog = srec.statusLog || []; srec.statusLog.push(log);
        return S.saveSub(srec);
      }
      case 'sub.reject': {
        var srj = plan.rec;
        log.fromStatus = srj.status; log.toStatus = 'rejected';
        srj.status = 'rejected'; srj.rejectReason = op.rejectReason;
        srj.rejects = srj.rejects || [];
        srj.rejects.push({ at: now, reason: op.rejectReason, operator: log.operator });
        srj.statusLog = srj.statusLog || []; srj.statusLog.push(log);
        return S.saveSub(srj);
      }
      case 'sub.directGrant': {
        var snr = Object.assign({ id: 'sb-' + now.toString(36), status: 'approved', createdAt: now, reviewedAt: now,
          rejects: [], ratioLog: [], statusLog: [], sealedAt: 0, signature: {} }, plan.record);
        snr.statusLog.push({ operator: log.operator, at: now, reason: '后台直接指定开通', fromStatus: '', toStatus: 'approved' });
        return S.saveSub(snr);
      }
      case 'sub.transition':
        return S.transition('sub', plan.rec.id, plan.to, { operator: log.operator, reason: op.reason || log.reason });
      default:
        return { error: 'E_PLAN_UNKNOWN' };
    }
  }

  /* ---------- 事务式应用：先全量校验，任一失败整体不落库 ---------- */
  function applySeed(seedText, opts) {
    opts = opts || {};
    var env = deps();
    if (!env.R || !env.S) return { ok: false, error: 'E_DEPS_MISSING', msg: 'AgentRules/AgentStore 未加载' };
    var seed;
    try { seed = parseSeed(seedText); } catch (e) { return { ok: false, error: e.message }; }
    var S = env.S;
    if (opts.store) S = opts.store;
    var R = opts.rules || env.R;
    var ctx = ctxFromStore(S, opts.quotaCfg);

    var plans = [], failed = [];
    for (var i = 0; i < seed.actions.length; i++) {
      var v = validateOp(seed.actions[i], { R: R, S: S, ctx: ctx });
      if (!v.ok) {
        failed.push({ index: i, op: seed.actions[i].op, code: v.code, msg: v.msg });
      } else {
        plans.push(v.plan);
      }
    }
    if (failed.length) return { ok: false, committed: false, failed: failed, applied: [] };

    var applied = [];
    for (var j = 0; j < plans.length; j++) {
      var r = executePlan(plans[j], { R: R, S: S });
      if (r && r.error) return { ok: false, committed: false, failed: [{ index: j, code: r.error, msg: r.msg || r.error }], applied: applied };
      applied.push(plans[j].type);
    }
    return { ok: true, committed: true, applied: applied, failed: [] };
  }

  var api = {
    SEED_SCHEMA: SEED_SCHEMA,
    buildSeed: buildSeed,
    parseSeed: parseSeed,
    seedToText: seedToText,
    validateOp: validateOp,
    applySeed: applySeed
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentBridge = api;
})(typeof window !== 'undefined' ? window : globalThis);
