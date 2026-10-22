/* ============================================================================
   js/agent-store.js —— M1-1 新代理存储读写模块（四键 + 清理日志）
   ----------------------------------------------------------------------------
   键（localStorage，纯 Mock，按执行文档 v0.5 §5.1 schema）：
     engchain-province-agents   省级总代记录（数组）
     engchain-sub-agents        二级合作分代理商记录（数组）
     engchain-agent-ledger      逐笔台账 + 两线月汇总版本化缓存（对象包裹，兼容旧数组）
     engchain-agent-behavior    行为记录（数组，长期保留 D30）
     engchain-behavior-cleanup-log  手动清理日志（数组）
   约束：
     - 缺键 try/catch 回退空表不报错；旧记录兼容；
     - 禁止回写 entry.types / auth.partner / BalanceStore（资金隔离 D11）；
     - 封存（sealedAt / sealed）只标记不删；封存记录不参与行为清理（D30/§3.9）。
   浏览器 → window.AgentStore；node → module.exports（scripts/smoke-m1.js 注入内存 shim）。
   ============================================================================ */
(function (root) {
  'use strict';

  var KEYS = {
    provinces: 'engchain-province-agents',
    subs: 'engchain-sub-agents',
    ledger: 'engchain-agent-ledger',
    behavior: 'engchain-agent-behavior',
    cleanupLog: 'engchain-behavior-cleanup-log'
  };

  /* 延迟取规则层（浏览器 window.AgentRules / node require），避免加载顺序耦合 */
  function rules() {
    if (typeof window !== 'undefined' && window.AgentRules) return window.AgentRules;
    if (typeof require === 'function') { try { return require('./agent-rules.js'); } catch (e) { return null; } }
    return null;
  }

  var _storage = null;
  function storage() {
    if (_storage) return _storage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }
  /* 注入存储适配器（node 内存 shim / 自定义后端）；浏览器默认 window.localStorage */
  function init(opts) { _storage = (opts && opts.storage) || null; return api; }

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

  /* ---------------- 省级总代 ---------------- */
  function listProvinces() {
    var a = read(KEYS.provinces, []);
    return Array.isArray(a) ? a : [];
  }
  function getProvince(id) {
    var l = listProvinces();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function saveProvince(rec) {
    if (!rec || !rec.id) return { error: 'E_RECORD_ID_MISSING' };
    var existing = getProvince(rec.id);
    if (existing && existing.sealedAt) return { error: 'E_SEALED_READONLY', msg: '封存记录只读，不可改' };
    var l = listProvinces();
    var idx = -1;
    for (var i = 0; i < l.length; i++) if (l[i].id === rec.id) { idx = i; break; }
    rec.statusLog = Array.isArray(rec.statusLog) ? rec.statusLog : [];
    rec.rejects = Array.isArray(rec.rejects) ? rec.rejects : [];
    rec.provinceHistory = Array.isArray(rec.provinceHistory) ? rec.provinceHistory : [];
    if (idx >= 0) l[idx] = rec; else l.push(rec);
    write(KEYS.provinces, l);
    return { ok: true, record: rec };
  }

  /* ---------------- 二级 ---------------- */
  function listSubs(filter) {
    var l = read(KEYS.subs, []);
    l = Array.isArray(l) ? l : [];
    if (!filter) return l;
    return l.filter(function (s) {
      if (filter.parentUid && s.parentUid !== filter.parentUid) return false;
      if (filter.uscc && rules().normalizeUscc(s.company && s.company.uscc) !== rules().normalizeUscc(filter.uscc)) return false;
      return true;
    });
  }
  function getSub(id) {
    var l = listSubs();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function saveSub(rec) {
    if (!rec || !rec.id) return { error: 'E_RECORD_ID_MISSING' };
    var existing = getSub(rec.id);
    if (existing && existing.sealedAt) return { error: 'E_SEALED_READONLY', msg: '封存记录只读，不可改' };
    var l = listSubs();
    var idx = -1;
    for (var i = 0; i < l.length; i++) if (l[i].id === rec.id) { idx = i; break; }
    rec.statusLog = Array.isArray(rec.statusLog) ? rec.statusLog : [];
    rec.rejects = Array.isArray(rec.rejects) ? rec.rejects : [];
    rec.ratioLog = Array.isArray(rec.ratioLog) ? rec.ratioLog : [];
    rec.signature = rec.signature || {};
    if (idx >= 0) l[idx] = rec; else l.push(rec);
    write(KEYS.subs, l);
    return { ok: true, record: rec };
  }

  /* ---------------- 台账（两分区 subLedger/selfLedger；月汇总版本化缓存） ---------------- */
  function readLedgerStore() {
    var raw = read(KEYS.ledger, { entries: [], summaries: {}, version: 0 });
    /* 旧记录兼容：早期可能直接存数组 */
    if (Array.isArray(raw)) raw = { entries: raw, summaries: {}, version: 1 };
    if (!raw || typeof raw !== 'object') raw = { entries: [], summaries: {}, version: 0 };
    raw.entries = Array.isArray(raw.entries) ? raw.entries : [];
    raw.summaries = raw.summaries || {};
    raw.version = Number(raw.version) || 0;
    return raw;
  }
  function writeLedgerStore(s) { write(KEYS.ledger, s); }

  function appendEntry(entry) {
    var s = readLedgerStore();
    entry = entry || {};
    entry.serialNo = entry.serialNo || ('ALG-' + (s.entries.length + 1) + '-' + Date.now().toString(36));
    entry.month = entry.month || monthKey(entry.at || Date.now());
    entry.line = (entry.line === 'selfLedger') ? 'selfLedger' : 'subLedger';
    entry.frozenStatus = entry.frozenStatus || 'frozen';
    entry.at = entry.at || Date.now();
    s.entries.push(entry);
    s.version += 1; /* 版本号失效旧月汇总缓存，读取时按 version 重算 */
    writeLedgerStore(s);
    return { ok: true, entry: entry };
  }
  function monthKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function listLedger(filter) {
    var s = readLedgerStore();
    var out = s.entries.slice();
    if (!filter) return out;
    return out.filter(function (e) {
      if (filter.line && e.line !== filter.line) return false;
      if (filter.month && e.month !== filter.month) return false;
      if (filter.frozenStatus && e.frozenStatus !== filter.frozenStatus) return false;
      return true;
    });
  }
  /* 月汇总（版本化缓存：缓存 version != 当前 version 则重算）。
     企业税目不进计算列；只汇总 settled，frozen 不计入总盘。 */
  function monthlySummary(month, line) {
    var s = readLedgerStore();
    var ck = month + ':' + line;
    var cached = s.summaries[ck];
    if (cached && cached.version === s.version) return cached;
    var sum = { month: month, line: line, grossAmount: 0, amount: 0, taxAmount: 0, netAmount: 0, count: 0, version: s.version };
    s.entries.forEach(function (e) {
      if (e.month !== month || e.line !== line) return;
      if (e.frozenStatus !== 'settled') return;
      sum.grossAmount = r2(sum.grossAmount + (Number(e.grossAmount) || 0));
      sum.amount = r2(sum.amount + (Number(e.amount) || 0));
      sum.taxAmount = r2(sum.taxAmount + (Number(e.taxAmount) || 0));
      sum.netAmount = r2(sum.netAmount + (Number(e.netAmount) || 0));
      sum.count += 1;
    });
    s.summaries[ck] = sum;
    writeLedgerStore(s);
    return sum;
  }
  function sealEntry(serialNo) {
    var s = readLedgerStore();
    for (var i = 0; i < s.entries.length; i++) {
      if (s.entries[i].serialNo === serialNo) { s.entries[i].sealed = true; writeLedgerStore(s); return { ok: true }; }
    }
    return { error: 'E_ENTRY_NOT_FOUND' };
  }

  /* ---------------- 行为记录（D30 长期保留 + 手动按范围清理 + 封存隔离） ---------------- */
  function listBehavior() {
    var a = read(KEYS.behavior, []);
    return Array.isArray(a) ? a : [];
  }
  function appendBehavior(rec) {
    var l = listBehavior();
    rec = rec || {};
    rec.at = rec.at || Date.now();
    rec.sealed = !!rec.sealed;
    /* idemKey 幂等：同键不重复写 */
    if (rec.idemKey) {
      for (var i = 0; i < l.length; i++) if (l[i].idemKey === rec.idemKey) return { ok: true, dedup: true, record: l[i] };
    }
    l.push(rec);
    write(KEYS.behavior, l);
    return { ok: true, record: rec };
  }
  function listCleanupLog() {
    var a = read(KEYS.cleanupLog, []);
    return Array.isArray(a) ? a : [];
  }
  function appendCleanupLog(entry) {
    var l = listCleanupLog();
    l.push(entry);
    write(KEYS.cleanupLog, l);
  }
  /* 手动按时间范围清理非封存行为记录；禁止一键清空全部（无 range 即拦截）。
     sealed 封存记录不参与清理；只动 behavior 键，不删台账。 */
  function cleanupBehaviorRange(opts) {
    opts = opts || {};
    var start = Number(opts.rangeStart), end = Number(opts.rangeEnd);
    if (!start || !end) return { error: 'E_RANGE_EMPTY', msg: '必须提供完整时间范围 rangeStart/rangeEnd，禁止一键清空全部' };
    if (start > end) return { error: 'E_RANGE_INVALID', msg: 'rangeStart 不能晚于 rangeEnd' };
    var now = Date.now();
    if (end > now) return { error: 'E_RANGE_FUTURE', msg: 'rangeEnd 不能晚于当前时间（越界拦截）' };
    var l = listBehavior();
    var kept = [], removed = 0;
    l.forEach(function (b) {
      if (b.sealed === true) { kept.push(b); return; }           /* 封存隔离：不参与清理 */
      var t = Number(b.at) || 0;
      if (t >= start && t <= end) { removed++; return; }
      kept.push(b);
    });
    write(KEYS.behavior, kept);
    appendCleanupLog({
      operator: opts.operator || 'system',
      at: now, rangeStart: start, rangeEnd: end, count: removed
    });
    return { ok: true, count: removed };
  }

  /* ---------------- M1-7 终止态状态机编排（合法边校验 + statusLog + sealedAt） ---------------- */
  function transition(kind, id, toStatus, opts) {
    opts = opts || {};
    var R = rules();
    var rec = kind === 'province' ? getProvince(id) : getSub(id);
    if (!rec) return { error: 'E_RECORD_NOT_FOUND' };
    var from = rec.status;
    if (from === toStatus) return { error: 'E_SAME_STATUS', msg: '目标状态与当前状态相同' };
    if (!R || !R.canTransition(kind, from, toStatus)) {
      return { error: 'E_ILLEGAL_EDGE', msg: '非法状态流转：' + from + ' → ' + toStatus };
    }
    if (rec.sealedAt) return { error: 'E_SEALED_READONLY', msg: '封存记录只读，状态不可再变' };
    rec.status = toStatus;
    rec.statusLog = rec.statusLog || [];
    rec.statusLog.push({
      operator: opts.operator || 'system', at: Date.now(), reason: opts.reason || '',
      fromStatus: from, toStatus: toStatus
    });
    /* 封存只标记不删：terminated/revoked/removed 置 sealedAt，台账封存只读 */
    if (R.isTerminal(kind, toStatus)) rec.sealedAt = Date.now();
    var saved = kind === 'province' ? saveProvince(rec) : saveSub(rec);
    if (saved.error) return saved;
    return { ok: true, record: rec, released: R.releasesOnTermination(kind, toStatus) };
  }

  /* ---------------- M1-9 orgId 关联（台账/协议/收益归企业主体） ---------------- */
  function linkOrg(kind, id, orgId) {
    var rec = kind === 'province' ? getProvince(id) : getSub(id);
    if (!rec) return { error: 'E_RECORD_NOT_FOUND' };
    rec.orgId = orgId || '';
    var saved = kind === 'province' ? saveProvince(rec) : saveSub(rec);
    return saved.error ? saved : { ok: true, record: rec };
  }

  /* ---------------- M1-2/M1-11 资格位读取（只读叠加；终止态即时失效） ---------------- */
  function bitsFor(uid) {
    var R = rules();
    var out = {
      isProvinceAgent: false, isSubAgent: false,
      agentProvince: '', agentQuotaUsed: 0, agentQuotaCap: null,
      status: null, orgId: ''
    };
    if (!uid) return out;
    var pa = listProvinces();
    for (var i = 0; i < pa.length; i++) {
      var a = pa[i];
      if (a.uid !== uid) continue;
      if (a.status === 'active' || a.status === 'suspended') {
        out.isProvinceAgent = true;
        out.agentProvince = a.province || '';
        out.status = a.status;
        out.orgId = a.orgId || '';
        if (R) out.agentQuotaUsed = R.countActiveSubAgents(uid, listSubs());
      }
      break;
    }
    var subs = listSubs();
    for (var j = 0; j < subs.length; j++) {
      var s = subs[j];
      if (s.uid !== uid) continue;
      if (s.status === 'approved' || s.status === 'suspended') {
        out.isSubAgent = true;
        if (!out.agentProvince) out.agentProvince = s.province || '';
        out.status = out.status || s.status;
        out.orgId = s.orgId || '';
      }
      break;
    }
    return out;
  }

  /* 测试/重置骨架：清空四键+清理日志（仅脚本调用，不在页面暴露一键清空） */
  function reset() {
    [KEYS.provinces, KEYS.subs, KEYS.ledger, KEYS.behavior, KEYS.cleanupLog].forEach(function (k) {
      var s = storage(); if (s) { try { s.removeItem(k); } catch (e) {} }
    });
    return { ok: true };
  }

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  var api = {
    KEYS: KEYS,
    init: init, reset: reset,
    listProvinces: listProvinces, getProvince: getProvince, saveProvince: saveProvince,
    listSubs: listSubs, getSub: getSub, saveSub: saveSub,
    appendEntry: appendEntry, listLedger: listLedger, monthlySummary: monthlySummary, sealEntry: sealEntry,
    listBehavior: listBehavior, appendBehavior: appendBehavior,
    listCleanupLog: listCleanupLog, appendCleanupLog: appendCleanupLog, cleanupBehaviorRange: cleanupBehaviorRange,
    transition: transition, linkOrg: linkOrg, bitsFor: bitsFor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
