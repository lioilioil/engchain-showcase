/* ============================================================
   工程链：求职者隐私护栏（屏蔽企业 / 简历可见性 / 投递偏好）
   ----------------------------------------------------------------------------
   存储口径
   - 屏蔽名单按「候选人」分键：engchain-blocked-companies
       v2: { v:2, byOwner: { <候选人账号>: [ entry ] } }
     旧版扁平数组 [{id,name,short,...}] 首次读取时迁移到当前候选人名下，不丢数据。
   - 简历公开 / 投递偏好按「候选人」分键：engchain-apply-prefs
       v1: { v:1, byOwner: { <候选人账号>: { resumePublic, resumeScope, ... } } }

   企业身份判定
   屏蔽名单里存的是「企业本身的身份」（全称 / 简称 / 统一社会信用代码 / 所属组织），
   不是它的登录账号。因此被屏蔽企业在平台尚未注册（未来才注册）时同样能命中 ——
   只要它注册后填的企业全称或信用代码与名单一致，屏蔽立即生效。

   唯一判定入口（页面不要再自行比对）
   - pages/personnel/index.html  currentData()      → PrivacyGuard.filterTalents
   - js/detail.js                attach() 状态门前   → PrivacyGuard.checkTalent
   - js/detail.js                相似人才推荐        → PrivacyGuard.filterTalents
   - pages/personal/index.html   渲染前              → PrivacyGuard.checkTalent
   ============================================================ */
(function () {
  'use strict';
  if (window.PrivacyGuard) return;

  var BLOCK_KEY = 'engchain-blocked-companies';
  var PREF_KEY = 'engchain-apply-prefs';

  /* 默认偏好：新用户默认简历公开、通知全开 */
  var PREF_DEFAULT = {
    resumePublic: true,      /* 简历公开：关闭后从「持证人才」下架，任何企业都不可见 */
    resumeScope: 'all',      /* 谁可以看我的简历：all | verified | applied */
    hideCompany: false,      /* 隐藏当前公司：卡片上隐去就职单位 */
    notifyView: true,        /* 企业查看我的简历时通知我 */
    notifyInterview: true,   /* 收到面试邀请时通知我 */
    attachResume: true,      /* 投递时默认附上简历附件 */
    autoGreet: ''            /* 自动打招呼语（空 = 不自动打招呼） */
  };

  function readJSON(k, d) {
    try {
      var v = JSON.parse(localStorage.getItem(k) || 'null');
      return (v === null || v === undefined) ? d : v;
    } catch (e) { return d; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  /* ---- 归一化：企业名（去空白 / 全角括号 / 通用后缀，忽略大小写） ---- */
  function normName(s) {
    var t = String(s == null ? '' : s);
    t = t.replace(/[\s　]/g, '');
    t = t.replace(/[（]/g, '(').replace(/[）]/g, ')');
    t = t.replace(/\((集团|股份|有限|责任|公司)\)/g, '');
    t = t.replace(/集团$/, '');
    t = t.replace(/(股份)?(有限)?(责任)?公司$/, '');
    return t.toLowerCase();
  }
  /* ---- 归一化：统一社会信用代码（演示数据含 × 占位的视为无效码，不参与比对） ---- */
  function normCode(s) {
    var t = String(s == null ? '' : s).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    return t.length >= 8 ? t : '';
  }

  /* ---- 当前登录者 ---- */
  function stateOf() {
    try { return (window.UI && UI.state && UI.state.get()) || {}; } catch (e) { return {}; }
  }
  function isGuest() {
    try {
      if (window.DataBus && DataBus.isGuest) return !!DataBus.isGuest();
    } catch (e) {}
    var st = stateOf();
    return st.loggedIn === false || st.status === 'guest';
  }
  function currentUser() {
    try { return (window.DataBus && DataBus.current) ? DataBus.current() : null; } catch (e) { return null; }
  }
  function userById(uid) {
    try {
      if (window.DataBus && DataBus.byId) return DataBus.byId(uid);
    } catch (e) {}
    try {
      var a = (window.DataBus && DataBus.users) ? DataBus.users() : readJSON('engchain-users', []);
      for (var i = 0; i < (a || []).length; i++) if (a[i].id === uid) return a[i];
    } catch (e) {}
    return null;
  }

  /* ---- 候选人键：统一用账号；只有 uid 时反查账号，保证名单与条目同口径 ---- */
  function canonicalOwner(v) {
    v = String(v == null ? '' : v);
    if (!v) return '';
    if (v.indexOf('@') >= 0) return v;
    var u = userById(v);
    if (u && u.account) return u.account;
    return v;
  }
  function ownerKey() {
    if (isGuest()) return '';
    var u = currentUser();
    if (!u || !u.id || u.id === 'u7') return '';
    return canonicalOwner(u.account || u.id);
  }

  /* ---- 屏蔽名单存取 ---- */
  function rawDB() {
    var v = readJSON(BLOCK_KEY, null);
    if (Array.isArray(v)) return { v: 2, byOwner: {}, legacy: v };
    if (v && v.v === 2 && v.byOwner && typeof v.byOwner === 'object') return v;
    return { v: 2, byOwner: {} };
  }
  function normalizeEntry(e) {
    if (!e) return null;
    var name = String(e.name || '').trim();
    if (!name) return null;
    var uscc = normCode(e.uscc);
    var key = e.key || (uscc ? ('u:' + uscc) : ('n:' + normName(name)));
    return {
      key: key,
      name: name,
      short: e.short || '',
      uscc: e.uscc || '',
      companyId: e.companyId || '',
      orgId: e.orgId || '',
      industry: e.industry || '',
      location: e.location || '',
      ts: e.ts || Date.now()
    };
  }
  function migrateLegacy(owner) {
    var db = rawDB();
    if (!db.legacy) return;
    if (owner) {
      var cur = db.byOwner[owner] || [];
      db.legacy.forEach(function (e) {
        var n = normalizeEntry(e);
        if (n && !cur.some(function (x) { return x.key === n.key; })) cur.push(n);
      });
      db.byOwner[owner] = cur;
    }
    delete db.legacy;
    writeJSON(BLOCK_KEY, db);
  }
  function list(owner) {
    owner = owner || ownerKey();
    if (!owner) return [];
    migrateLegacy(owner);
    var db = rawDB();
    return (db.byOwner[owner] || []).map(function (x) { return x; });
  }
  function add(entry, owner) {
    owner = owner || ownerKey();
    if (!owner) return [];
    migrateLegacy(owner);
    var n = normalizeEntry(entry);
    if (!n) return list(owner);
    var db = rawDB();
    var cur = db.byOwner[owner] || [];
    if (!cur.some(function (x) { return x.key === n.key; })) cur.push(n);
    db.byOwner[owner] = cur;
    writeJSON(BLOCK_KEY, db);
    emit('engchain:privacy-changed', { owner: owner, type: 'block' });
    return cur;
  }
  function remove(key, owner) {
    owner = owner || ownerKey();
    if (!owner) return [];
    migrateLegacy(owner);
    var db = rawDB();
    db.byOwner[owner] = (db.byOwner[owner] || []).filter(function (x) { return x.key !== key; });
    writeJSON(BLOCK_KEY, db);
    emit('engchain:privacy-changed', { owner: owner, type: 'unblock' });
    return db.byOwner[owner];
  }
  function has(entry, owner) {
    var n = normalizeEntry(entry);
    if (!n) return false;
    return list(owner).some(function (x) { return x.key === n.key; });
  }

  /* ---- 偏好存取 ---- */
  function prefs(owner) {
    owner = owner || ownerKey();
    var db = readJSON(PREF_KEY, null);
    if (!db || db.v !== 1 || !db.byOwner) db = { v: 1, byOwner: {} };
    var cur = (owner && db.byOwner[owner]) || {};
    var out = {};
    for (var k in PREF_DEFAULT) out[k] = (cur[k] === undefined ? PREF_DEFAULT[k] : cur[k]);
    return out;
  }
  function setPref(key, value, owner) {
    owner = owner || ownerKey();
    if (!owner) return prefs(owner);
    var db = readJSON(PREF_KEY, null);
    if (!db || db.v !== 1 || !db.byOwner) db = { v: 1, byOwner: {} };
    var cur = db.byOwner[owner] || {};
    cur[key] = value;
    db.byOwner[owner] = cur;
    writeJSON(PREF_KEY, db);
    emit('engchain:privacy-changed', { owner: owner, type: 'pref', key: key });
    return prefs(owner);
  }
  function setPrefs(patch, owner) {
    owner = owner || ownerKey();
    if (!owner) return prefs(owner);
    var db = readJSON(PREF_KEY, null);
    if (!db || db.v !== 1 || !db.byOwner) db = { v: 1, byOwner: {} };
    var cur = db.byOwner[owner] || {};
    for (var k in patch) if (PREF_DEFAULT.hasOwnProperty(k)) cur[k] = patch[k];
    db.byOwner[owner] = cur;
    writeJSON(PREF_KEY, db);
    emit('engchain:privacy-changed', { owner: owner, type: 'pref' });
    return prefs(owner);
  }

  /* ---- 查看者身份（企业侧） ----
     口径：企业全称 / 简称 / 信用代码 / 所属组织。
     注意：DataBus.current() 在账号匹配不到时会回退成 u1（四川省××建设有限公司），
     因此这里额外校验 account 与 uid 是否自洽，不自洽就不臆测身份，避免误屏蔽。 */
  function viewerIdent() {
    var out = { guest: true, uid: '', account: '', names: [], codes: [], orgIds: [] };
    if (isGuest()) return out;
    var u = currentUser();
    if (!u || !u.id || u.id === 'u7') return out;
    var st = stateOf();
    if (st.account && u.account && st.account !== u.account) return out;

    out.guest = false;
    out.uid = u.id;
    out.account = u.account || '';
    if (u.company) out.names.push(u.company);
    var en = u.auth && u.auth.enterprise;
    if (en) {
      if (en.co) out.names.push(en.co);
      if (en.shortName) out.names.push(en.shortName);
      var c = normCode(en.code);
      if (c) out.codes.push(c);
    }
    /* 同一企业组织的成员同口径命中（企业主体，不是个人） */
    try {
      if (window.OrgsStore && OrgsStore.orgsOf) {
        (OrgsStore.orgsOf(u.id) || []).forEach(function (x) {
          var o = (x && x.org) || {};
          if (o.orgId) out.orgIds.push(o.orgId);
          if (o.co) out.names.push(o.co);
          if (o.shortName) out.names.push(o.shortName);
          var oc = normCode(o.code);
          if (oc) out.codes.push(oc);
        });
      }
    } catch (e) {}

    out.nameSet = {};
    out.names.forEach(function (n) { var k = normName(n); if (k) out.nameSet[k] = 1; });
    out.codeSet = {};
    out.codes.forEach(function (c) { out.codeSet[c] = 1; });
    return out;
  }

  /* ---- 名单条目 × 查看者 是否命中 ---- */
  function entryHits(entry, v) {
    if (!entry || !v || v.guest) return false;
    if (entry.orgId && v.orgIds.length && v.orgIds.indexOf(entry.orgId) >= 0) return true;
    var ec = normCode(entry.uscc);
    if (ec && v.codeSet[ec]) return true;
    if (v.names.length) {
      if (v.nameSet[normName(entry.name)]) return true;
      if (entry.short && v.nameSet[normName(entry.short)]) return true;
    }
    return false;
  }

  /* ---- 人才条目 → 候选人键 ---- */
  function talentOwnerKey(rec) {
    if (!rec) return '';
    return canonicalOwner(rec.account || rec.uid || rec.publisher || rec.publisherId || rec.owner || '');
  }

  /* ---- 核心判定：当前查看者能否看到这条人才 ----
     返回 { hidden:false } 或 { hidden:true, reason:'private'|'blocked' } */
  function checkTalent(rec, ident) {
    var out = { hidden: false, reason: '' };
    if (!rec) return out;
    var owner = talentOwnerKey(rec);
    if (!owner) return out;                       /* 平台预置条目无归属：恒可见 */
    var v = ident || viewerIdent();
    /* 本人永远能看自己的简历 */
    if (!v.guest && v.account && v.account === owner) return out;

    var pf = prefs(owner);
    if (pf.resumePublic === false) { out.hidden = true; out.reason = 'private'; return out; }
    /* 仅认证企业可见：查看者未通过企业认证则不展示 */
    if (pf.resumeScope === 'verified' && (!v.codes.length && !v.orgIds.length)) {
      out.hidden = true; out.reason = 'private'; return out;
    }
    if (v.guest) return out;
    var bl = list(owner);
    for (var i = 0; i < bl.length; i++) {
      if (entryHits(bl[i], v)) { out.hidden = true; out.reason = 'blocked'; return out; }
    }
    return out;
  }

  function isHidden(rec, ident) { return checkTalent(rec, ident).hidden; }

  function filterTalents(arr, ident) {
    if (!arr || !arr.length) return arr || [];
    var v = ident || viewerIdent();
    return arr.filter(function (r) { return !checkTalent(r, v).hidden; });
  }

  /* ---- 企业候选池（屏蔽页搜索用） ----
     1) 已注册企业（engchain-users 里有企业身份/企业名的账号）
     2) 全量企业主数据（MOCK.companies，模拟平台企业库 API：覆盖尚未注册的企业） */
  function enterprisePool() {
    var out = [], seen = {};
    function push(e) {
      var nk = normName(e.name);
      if (!nk) return;
      var k = e.uscc && normCode(e.uscc) ? ('u:' + normCode(e.uscc)) : ('n:' + nk);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(e);
    }
    try {
      var users = (window.DataBus && DataBus.users) ? DataBus.users() : readJSON('engchain-users', []);
      (users || []).forEach(function (u) {
        if (!u || !u.id || u.id === 'u7') return;
        var en = u.auth && u.auth.enterprise;
        var co = String(u.company || (en && en.co) || '').trim();
        if (!co) return;
        push({
          key: 'co:' + u.id, companyId: '', orgId: '', name: co,
          short: (en && en.shortName) || '', uscc: (en && en.code) || '',
          industry: '平台已注册企业', location: '', registered: true
        });
      });
    } catch (e) {}
    try {
      (window.MOCK && window.MOCK.companies || []).forEach(function (c) {
        if (!c || !c.name) return;
        push({
          key: 'cc:' + c.id, companyId: c.id, orgId: '', name: c.name,
          short: c.short || '', uscc: c.creditCode || '',
          industry: c.industry || '', location: c.location || '', registered: false
        });
      });
    } catch (e) {}
    return out;
  }

  window.PrivacyGuard = {
    BLOCK_KEY: BLOCK_KEY,
    PREF_KEY: PREF_KEY,
    PREF_DEFAULT: PREF_DEFAULT,
    normName: normName,
    normCode: normCode,
    ownerKey: ownerKey,
    canonicalOwner: canonicalOwner,
    list: list,
    add: add,
    remove: remove,
    has: has,
    prefs: prefs,
    setPref: setPref,
    setPrefs: setPrefs,
    viewer: viewerIdent,
    talentOwnerKey: talentOwnerKey,
    checkTalent: checkTalent,
    isHidden: isHidden,
    filterTalents: filterTalents,
    enterprisePool: enterprisePool
  };
})();
