/* ============================================================================
   js/agent-referral.js —— T1-1 省代招商码模块（省级总代体系·招商物料中心）
   ----------------------------------------------------------------------------
   语义边界（执行计划 §0.5/§8 红线11）：
   - 招商码 = 总代招募二级的「渠道授权凭证」，与分销 Referral 完全隔离；
   - 招商关系禁止写入 engchain-referral-links（该键按 L1/L2 触发分销返佣与积分，
     误写将错误产生返佣单）；招商关系仅落 engchain-agent-invites；
   - 二级申请入口链接为 apply.html?invite=<CODE>（T2 实现），不进入 register 注册链。

   键（localStorage，纯 Mock）：
     engchain-agent-invites      招商码记录（数组）
     engchain-agent-invite-logs  招商行为日志（数组，D30 长期保留，手动清理同 M1-10 语义）
   约束：
     - 仅 active 总代可新建招商码；suspended 仅查看既有码（不可新建）；二级/游客不可见招商权
     - 一总代同时仅一有效码；作废后可再生成（历史留痕）
     - 缺键 try/catch 回退空表不报错；node → module.exports（scripts/smoke-m5.js 注入内存 shim）
   浏览器 → window.AgentReferral；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';

  var KEYS = {
    invites: 'engchain-agent-invites',
    logs: 'engchain-agent-invite-logs'
  };

  var _storage = null;
  function storage() {
    if (_storage) return _storage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }
  /* 注入存储适配器（node 内存 shim / 自定义后端）与存储层（AgentStore shim）；浏览器默认 */
  function init(opts) {
    _storage = (opts && opts.storage) || null;
    _storeOverride = (opts && opts.store) || null;
    return api;
  }

  function read(key, def) {
    var s = storage();
    if (!s) return def;
    try {
      var v = s.getItem(key);
      if (v == null) return def;
      var p = JSON.parse(v);
      return p == null ? def : p;
    } catch (e) { return def; }
  }
  function write(key, val) {
    var s = storage();
    if (!s) return;
    try { s.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* 延迟取存储层（浏览器 window.AgentStore / node require），避免加载顺序耦合；
     支持 init({store}) 注入（node 测试/自定义后端） */
  var _storeOverride = null;
  function store() {
    if (_storeOverride) return _storeOverride;
    if (typeof window !== 'undefined' && window.AgentStore) return window.AgentStore;
    if (typeof require === 'function') { try { return require('./agent-store.js'); } catch (e) { return null; } }
    return null;
  }

  /* 可读字符集：去 I/O/0/1，避免手输混淆 */
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randCode() {
    var s = 'AG';
    for (var i = 0; i < 6; i++) s += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
    return s;
  }
  function uniqueCode() {
    var list = read(KEYS.invites, []);
    var used = {};
    for (var i = 0; i < list.length; i++) used[list[i].code] = true;
    for (var k = 0; k < 50; k++) {
      var c = randCode();
      if (!used[c]) return c;
    }
    return 'AG' + Date.now().toString(36).toUpperCase();
  }

  /* ---------------- 招商码记录 ---------------- */
  function listInvites() {
    var a = read(KEYS.invites, []);
    return Array.isArray(a) ? a : [];
  }
  function getByCode(code) {
    if (!code) return null;
    var l = listInvites();
    var c = String(code).trim().toUpperCase();
    for (var i = 0; i < l.length; i++) if (String(l[i].code).toUpperCase() === c) return l[i];
    return null;
  }
  function listByUid(uid) {
    var l = listInvites();
    return l.filter(function (r) { return r.uid === uid; });
  }
  /* 当前有效码（status=active 且未全部作废） */
  function activeCodeFor(uid) {
    var l = listByUid(uid);
    for (var i = 0; i < l.length; i++) if (l[i].status === 'active') return l[i];
    return null;
  }

  /* 资格：仅 active 总代可新建招商码（suspended 保留查看既有码，不可新建；其余不可见招商权） */
  function recruitState(uid) {
    var S = store();
    if (!S || !uid) return { allowCreate: false, canView: false, reason: 'E_NOT_PROVINCE_AGENT' };
    var list = (S.listProvinces && S.listProvinces()) || [];
    var pa = null;
    for (var i = 0; i < list.length; i++) if (list[i].uid === uid) { pa = list[i]; break; }
    if (!pa) return { allowCreate: false, canView: false, reason: 'E_NOT_PROVINCE_AGENT' };
    if (pa.status === 'active') return { allowCreate: true, canView: true, province: pa.province, record: pa, reason: '' };
    if (pa.status === 'suspended') return { allowCreate: false, canView: true, province: pa.province, record: pa, reason: 'E_SUSPENDED_READONLY' };
    return { allowCreate: false, canView: false, reason: 'E_PROVINCE_NOT_ACTIVE', record: pa };
  }

  /* 生成/获取当前有效招商码：一总代一有效码，历史码留痕 */
  function createCode(uid, opts) {
    opts = opts || {};
    var st = recruitState(uid);
    if (!st.allowCreate) return { error: st.reason || 'E_NOT_ELIGIBLE', msg: '仅 active 状态的在册总代可生成招商码' };
    var exist = activeCodeFor(uid);
    if (exist) return { ok: true, code: exist.code, record: exist, reused: true };
    var rec = {
      id: 'iv-' + Date.now(),
      code: uniqueCode(),
      uid: uid,
      province: st.province,
      status: 'active',
      at: Date.now(),
      usedBy: []
    };
    var l = listInvites();
    l.push(rec);
    write(KEYS.invites, l);
    api.log('code_created', { uid: uid, code: rec.code, province: st.province }, opts);
    return { ok: true, code: rec.code, record: rec, reused: false };
  }
  function codeFor(uid, opts) {
    var exist = activeCodeFor(uid);
    if (exist) return { ok: true, code: exist.code, record: exist, reused: true };
    return createCode(uid, opts);
  }
  function uidByCode(code) {
    var r = getByCode(code);
    return r ? r.uid : null;
  }

  /* 作废（总代终止/暂停时 UI 可调用；历史留痕，不再可申请） */
  function revokeCode(code, opts) {
    opts = opts || {};
    var l = listInvites();
    var hit = null;
    for (var i = 0; i < l.length; i++) if (l[i].code === code && l[i].status === 'active') { hit = l[i]; break; }
    if (!hit) return { error: 'E_CODE_NOT_ACTIVE' };
    hit.status = 'revoked';
    hit.revokedAt = Date.now();
    write(KEYS.invites, l);
    api.log('code_revoked', { code: code, uid: hit.uid }, opts);
    return { ok: true, record: hit };
  }

  /* 标记：二级申请使用（T2 申请链路写入时调用；不写 Referral 键） */
  function markUsed(code, subId, opts) {
    opts = opts || {};
    var l = listInvites();
    var hit = null;
    for (var i = 0; i < l.length; i++) if (l[i].code === code && l[i].status === 'active') { hit = l[i]; break; }
    if (!hit) return { error: 'E_CODE_NOT_ACTIVE' };
    if (hit.usedBy.indexOf(subId) === -1) hit.usedBy.push(subId);
    write(KEYS.invites, l);
    api.log('code_used', { code: code, uid: hit.uid, subId: subId }, opts);
    return { ok: true, record: hit };
  }

  /* ---------------- 招商行为日志（D30：长期保留，手动清理同 M1-10） ---------------- */
  function listLogs(filter) {
    var l = read(KEYS.logs, []);
    l = Array.isArray(l) ? l : [];
    if (!filter) return l;
    return l.filter(function (r) {
      if (filter.uid && r.operator !== filter.uid) return false;
      if (filter.action && r.action !== filter.action) return false;
      if (filter.rangeStart && r.at < filter.rangeStart) return false;
      if (filter.rangeEnd && r.at > filter.rangeEnd) return false;
      return true;
    });
  }
  function log(action, detail, opts) {
    opts = opts || {};
    var operator = (opts.operator) || (detail && detail.uid) || '';
    var l = listLogs();
    l.push({ id: 'ivl-' + Date.now(), at: Date.now(), operator: operator, action: action, detail: detail || {} });
    write(KEYS.logs, l);
    return { ok: true };
  }
  /* 手动清理（D30 语义：封存/招商码记录不删，仅清理日志条目） */
  function cleanupLogs(range, opts) {
    opts = opts || {};
    if (range == null || range.start == null || range.end == null) return { error: 'E_RANGE_EMPTY' };
    if (range.start > range.end) return { error: 'E_RANGE_INVALID' };
    var now = Date.now();
    if (range.end > now) return { error: 'E_RANGE_FUTURE' };
    var l = listLogs();
    var kept = l.filter(function (r) { return r.at < range.start || r.at > range.end; });
    var count = l.length - kept.length;
    write(KEYS.logs, kept);
    return { ok: true, count: count };
  }

  var api = {
    KEYS: KEYS,
    init: init,
    listInvites: listInvites,
    getByCode: getByCode,
    listByUid: listByUid,
    activeCodeFor: activeCodeFor,
    recruitState: recruitState,
    createCode: createCode,
    codeFor: codeFor,
    uidByCode: uidByCode,
    revokeCode: revokeCode,
    markUsed: markUsed,
    listLogs: listLogs,
    log: log,
    cleanupLogs: cleanupLogs,
    __resetForTest: function () {
      write(KEYS.invites, []);
      write(KEYS.logs, []);
      return { ok: true };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AgentReferral = api;
})(typeof self !== 'undefined' ? self : this);
