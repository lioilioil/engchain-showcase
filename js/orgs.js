/* ============================================================================
   工程链 ENGCHAIN — 企业组织与成员中心 OrgsStore（v1.0）
   ----------------------------------------------------------------------------
   解决：一家企业（已认证/已入驻）如何被多个个人用户绑定叠加企业身份。

   模型（在原有"账号=自然人"之上叠加，不破坏 u1-u8 seed）：
     User（自然人，实名认证 + 个人专业入驻）
       └─ membership[] 加入了哪些企业：{ orgId, role, status }
     Organization（企业实体）
       ├─ 认证主体：co/code/legal/shortName/entryTypes/enterpriseQual/entStatus/expireAt
       ├─ ownerUid 企业主；members[] 成员；invites[] 邀请；joins[] 加入申请
       └─ memberLimit 软上限（默认 10，防一张执照被无限拉人蹭资质）

   身份投影（最小侵入关键）：
     login / switchOrg 时，以"账号原始 auth 快照 + 当前代表企业投影"重算
     AuthStore / EntryStore —— 个人线（realname/personalEntry）原样保留，
     企业线（enterprise/enterpriseQual/entry.types）按当前代表企业覆盖。
     于是 deriveIdentity / publishableCats / entryAccess / my-jobs 等现有页面
     零改动即按"当前代表企业"工作；能力 = 个人侧 ∪ 企业侧（并集不互斥）。

   角色三档：owner 企业主 / admin 管理员(HR) / member 普通成员。
   钱与企业主体操作只归 owner；admin/member 共享企业发布与招聘处理能力。
   ============================================================================ */
window.OrgsStore = (function () {
  'use strict';
  var LS = window.localStorage;
  var KEY = 'engchain-orgs';
  var DAY = 864e5, YEAR = 365 * DAY;
  var now = Date.now();
  var MEMBER_LIMIT = 10;

  /* ---- seed：预置两家演示企业实体 ----
     org1 川×建设（建筑入驻 resident）：owner=u1 陈建国；预置一条给 u5 的待接受邀请(admin)
     org2 成×工程咨询（建筑入驻 resident）：owner=u3 王强；u5 已是 member
     → 登录 u5 可完整演示：待接受邀请 + 多企业身份切换 + 员工代表企业发招聘 */
  function seedOrgs() {
    return [
      {
        orgId: 'org1', co: '四川省××建设有限公司', shortName: '川×建设',
        code: '91510100MA6×××12X', legal: '陈建国',
        entryTypes: ['construction'], entStatus: 'resident',
        enterpriseQual: ['建筑业企业资质 · 建筑工程施工总承包贰级'],
        expireAt: now + YEAR, ownerUid: 'u1', memberLimit: MEMBER_LIMIT,
        members: [
          { uid: 'u1', role: 'owner', status: 'active', joinedAt: now - DAY * 180 }
        ],
        invites: [
          { inviteId: 'inv-o1-u5', targetUid: 'u5', mobile: '139****8866', role: 'admin', status: 'pending', inviterUid: 'u1', createdAt: now - DAY * 2 }
        ],
        joins: [
          { joinId: 'join-org1-u4', uid: 'u4', name: '张敏', note: '申请加入贵司市场部企业号，协助发布招聘', status: 'pending', createdAt: now - DAY * 1 }
        ]
      },
      {
        orgId: 'org2', co: '成都成×工程咨询有限公司', shortName: '成×咨询',
        code: '91510100MA7×××88Y', legal: '王强',
        entryTypes: ['construction'], entStatus: 'resident',
        enterpriseQual: [],
        expireAt: now + YEAR, ownerUid: 'u3', memberLimit: MEMBER_LIMIT,
        members: [
          { uid: 'u3', role: 'owner', status: 'active', joinedAt: now - DAY * 60 },
          { uid: 'u5', role: 'member', status: 'active', joinedAt: now - DAY * 20 }
        ],
        invites: [], joins: []
      }
    ];
  }

  function load() {
    var raw = LS.getItem(KEY);
    if (raw === null) { var s = seedOrgs(); save(s); return s; }
    try { var a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; } catch (e) {}
    s = seedOrgs(); save(s); return s;
  }
  function save(a) { try { LS.setItem(KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function get(orgId) { var a = load(); for (var i = 0; i < a.length; i++) if (a[i].orgId === orgId) return a[i]; return null; }

  /* 当前登录用户（DataBus 封装） */
  function me() { return (window.DataBus && DataBus.current) ? DataBus.current() : null; }

  /* 某用户在某企业的成员记录（active） */
  function membershipOf(uid, orgId) {
    var org = get(orgId); if (!org) return null;
    for (var i = 0; i < org.members.length; i++) {
      var m = org.members[i];
      if (m.uid === uid && m.status === 'active') return { org: org, role: m.role, joinedAt: m.joinedAt };
    }
    return null;
  }
  /* 某用户加入的全部 active 企业 */
  function orgsOf(uid) {
    var a = load(), out = [];
    a.forEach(function (org) {
      for (var i = 0; i < org.members.length; i++) {
        if (org.members[i].uid === uid && org.members[i].status === 'active') {
          out.push({ org: org, role: org.members[i].role, joinedAt: org.members[i].joinedAt });
          break;
        }
      }
    });
    return out;
  }
  function memberCount(org) { return (org.members || []).filter(function (m) { return m.status === 'active'; }).length; }

  /* 当前代表企业：读 UI.state.currentOrgId，校验仍 active 后返回 {org, role} */
  function currentMembership() {
    var u = me(); if (!u) return null;
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    if (st.loggedIn === false) return null;
    var cur = st.currentOrgId || null;
    if (cur && cur !== 'personal') {
      var m = membershipOf(u.id, cur);
      if (m) return m;
    }
    return null;
  }

  /* ---- 身份投影：账号原始 auth/entry + 当前代表企业覆盖 ---- */
  function projectAuth() {
    var u = me(); if (!u || !window.AuthStore || !window.EntryStore) return;
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    if (st.loggedIn === false) return;
    var baseAuth = JSON.parse(JSON.stringify(u.auth || {}));
    var baseEntry = JSON.parse(JSON.stringify(u.entry || {}));
    var m = currentMembership();
    if (m) {
      var org = m.org;
      /* 企业认证投影（个人线 realname/personalEntry 不动） */
      baseAuth.enterprise = {
        ok: true, expireAt: org.expireAt, co: org.co, code: org.code, legal: org.legal,
        shortName: org.shortName, nameBasis: '品牌简称', nameProof: []
      };
      baseAuth.enterpriseQual = { ok: !!(org.enterpriseQual && org.enterpriseQual.length), list: (org.enterpriseQual || []).slice() };
      /* 入驻投影 */
      if (org.entStatus === 'resident') {
        baseEntry = {
          types: org.entryTypes.slice(), type: org.entryTypes[0], active: true, status: 'active',
          orderId: baseEntry.orderId || null, paidAt: baseEntry.paidAt || 0, expireAt: org.expireAt
        };
      } else {
        baseEntry = { types: [], type: null, active: false, status: 'none', orderId: null, paidAt: 0, expireAt: 0 };
      }
    }
    AuthStore.write(baseAuth);
    EntryStore.write(baseEntry);
    var companyName = m ? (m.org.shortName || m.org.co) : (u.company || '');
    if (window.UI && UI.state) UI.state.set({
      company: companyName, orgRole: m ? m.role : '', orgName: m ? (m.org.shortName || m.org.co) : ''
    });
  }

  /* 登录某账号后，为其选默认代表企业：有 active 成员身份则取第一个，否则纯个人 */
  function defaultOrgIdFor(uid) {
    var list = orgsOf(uid);
    return list.length ? list[0].org.orgId : null;
  }

  /* 切换当前代表企业（orgId 传 null / 'personal' 表示以个人身份对外） */
  function switchOrg(orgId) {
    var u = me(); if (!u) return false;
    if (orgId && orgId !== 'personal' && !membershipOf(u.id, orgId)) {
      if (window.UI && UI.toast) UI.toast.err('你未加入该企业');
      return false;
    }
    if (window.UI && UI.state) UI.state.set({ currentOrgId: orgId || null });
    projectAuth();
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
    window.dispatchEvent(new CustomEvent('engchain:auth', {}));
    window.dispatchEvent(new CustomEvent('engchain:entry', {}));
    return true;
  }

  /* ============ 邀请制（企业侧发起） ============ */
  /* 邀请某已注册实名成员加入企业；role: 'admin' | 'member' */
  function invite(orgId, targetUid, role) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    if (!cm || (cm.role !== 'owner' && cm.role !== 'admin')) return { error: '仅企业主/管理员可邀请成员' };
    if (!targetUid) return { error: '请选择被邀请人' };
    var target = (window.DataBus && DataBus.byId) ? DataBus.byId(targetUid) : null;
    if (!target) return { error: '用户不存在' };
    /* 已在成员中 */
    if (membershipOf(targetUid, orgId)) return { error: '该成员已在企业内' };
    /* 上限 */
    if (memberCount(org) >= org.memberLimit) return { error: '成员数已达上限（' + org.memberLimit + '人），如需扩容请联系平台' };
    /* 重复 pending 邀请 */
    for (var i = 0; i < org.invites.length; i++) {
      if (org.invites[i].targetUid === targetUid && org.invites[i].status === 'pending') return { error: '已向该成员发出邀请，等待其接受' };
    }
    org.invites.push({
      inviteId: 'inv-' + orgId + '-' + targetUid, targetUid: targetUid,
      mobile: (target.auth && target.auth.realname && target.auth.realname.mobile) || '',
      role: role || 'member', status: 'pending', inviterUid: u.id, createdAt: Date.now()
    });
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('邀请成员', '企业', target.name, '邀请加入 ' + (org.shortName || org.co) + ' 担任 ' + (role === 'admin' ? '管理员' : '成员'));
    return { ok: true };
  }
  /* 某用户待接受的邀请 */
  function pendingInvitesFor(uid) {
    var a = load(), out = [];
    a.forEach(function (org) {
      org.invites.forEach(function (iv) {
        if (iv.targetUid === uid && iv.status === 'pending') out.push({ org: org, invite: iv });
      });
    });
    return out;
  }
  function acceptInvite(inviteId) {
    var u = me(); if (!u) return { error: '未登录' };
    var a = load();
    for (var i = 0; i < a.length; i++) {
      var org = a[i];
      for (var j = 0; j < org.invites.length; j++) {
        var iv = org.invites[j];
        if (iv.inviteId === inviteId && iv.status === 'pending') {
          if (iv.targetUid !== u.id) return { error: '该邀请不属于当前账号' };
          if (memberCount(org) >= org.memberLimit) { iv.status = 'revoked'; save(a); return { error: '企业成员已满，邀请失效' }; }
          iv.status = 'accepted';
          org.members.push({ uid: u.id, role: iv.role, status: 'active', joinedAt: Date.now() });
          save(a);
          if (window.DataBus && DataBus.audit) DataBus.audit('接受邀请', '企业', u.name, '加入 ' + (org.shortName || org.co));
          /* 接受后自动代表该企业 */
          if (window.UI && UI.state) UI.state.set({ currentOrgId: org.orgId });
          projectAuth();
          window.dispatchEvent(new CustomEvent('engchain:org', {}));
          return { ok: true, orgId: org.orgId };
        }
      }
    }
    return { error: '邀请不存在或已处理' };
  }
  function rejectInvite(inviteId) {
    var a = load();
    for (var i = 0; i < a.length; i++) {
      var org = a[i];
      for (var j = 0; j < org.invites.length; j++) {
        if (org.invites[j].inviteId === inviteId && org.invites[j].status === 'pending') {
          org.invites[j].status = 'rejected'; save(a); return { ok: true };
        }
      }
    }
    return { error: '邀请不存在' };
  }

  /* ============ 申请制（员工侧发起） ============ */
  function requestJoin(orgId, note) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    if (st.loggedIn === false) return { error: '请先登录' };
    if (!(u.auth && u.auth.realname && u.auth.realname.ok)) return { error: '需先完成实名认证，才能代表企业' };
    if (membershipOf(u.id, orgId)) return { error: '你已在该企业内' };
    for (var i = 0; i < org.joins.length; i++) {
      if (org.joins[i].uid === u.id && org.joins[i].status === 'pending') return { error: '已提交申请，等待企业审批' };
    }
    org.joins.push({ joinId: 'join-' + orgId + '-' + u.id, uid: u.id, name: u.name, note: note || '', status: 'pending', createdAt: Date.now() });
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('申请加入', '企业', u.name, '申请加入 ' + (org.shortName || org.co));
    return { ok: true };
  }
  function pendingJoins(orgId) {
    var org = get(orgId); if (!org) return [];
    return (org.joins || []).filter(function (j) { return j.status === 'pending'; });
  }
  function approveJoin(joinId) {
    var a = load(); var org = a.find(function (x) { return x.orgId === _orgIdOfJoin(joinId); }); var u = me(); if (!org) return { error: '申请不存在' };
    var cm = membershipOf(u.id, org.orgId);
    if (!cm || (cm.role !== 'owner' && cm.role !== 'admin')) return { error: '仅企业主/管理员可审批' };
    if (memberCount(org) >= org.memberLimit) return { error: '成员数已达上限' };
    for (var i = 0; i < org.joins.length; i++) {
      var j = org.joins[i];
      if (j.joinId === joinId && j.status === 'pending') {
        j.status = 'approved';
        org.members.push({ uid: j.uid, role: 'member', status: 'active', joinedAt: Date.now() });
        save(a);
        if (window.DataBus && DataBus.audit) DataBus.audit('批准加入', '企业', j.name, '批准加入 ' + (org.shortName || org.co));
        return { ok: true };
      }
    }
    return { error: '申请不存在' };
  }
  function rejectJoin(joinId) {
    var a = load(); var org = a.find(function (x) { return x.orgId === _orgIdOfJoin(joinId); }); if (!org) return { error: '申请不存在' };
    for (var i = 0; i < org.joins.length; i++) {
      if (org.joins[i].joinId === joinId && org.joins[i].status === 'pending') {
        org.joins[i].status = 'rejected'; save(a); return { ok: true };
      }
    }
    return { error: '申请不存在' };
  }
  function _orgIdOfJoin(joinId) { /* joinId 形如 join-<orgId>-<uid> */
    var parts = String(joinId).split('-');
    return parts.length >= 2 ? parts[1] : null;
  }

  /* ============ 成员管理 ============ */
  function members(orgId) {
    var org = get(orgId); if (!org) return [];
    return (org.members || []).map(function (m) {
      var u = (window.DataBus && DataBus.byId) ? DataBus.byId(m.uid) : null;
      return { uid: m.uid, role: m.role, status: m.status, joinedAt: m.joinedAt,
        name: u ? u.name : m.uid, avatar: u ? u.avatar : '?' };
    }).filter(function (x) { return x.status === 'active'; });
  }
  function canManage(orgId) {
    var u = me(); if (!u) return false;
    var m = membershipOf(u.id, orgId);
    return !!(m && (m.role === 'owner' || m.role === 'admin'));
  }
  function myRole(orgId) {
    var u = me(); if (!u) return '';
    var m = membershipOf(u.id, orgId);
    return m ? m.role : '';
  }
  /* 移除成员：仅 owner；不可移除自己（owner 不可被踢） */
  function removeMember(orgId, uid) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    if (!cm || cm.role !== 'owner') return { error: '仅企业主可移除成员' };
    if (uid === org.ownerUid) return { error: '企业主不可被移除' };
    for (var i = 0; i < org.members.length; i++) {
      if (org.members[i].uid === uid) { org.members.splice(i, 1); break; }
    }
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('移除成员', '企业', uid, '移出 ' + (org.shortName || org.co));
    return { ok: true };
  }

  /* ============ 登录 / 重置联动 ============ */
  function onLogin() {
    var u = me(); if (!u) return;
    var def = defaultOrgIdFor(u.id);
    if (window.UI && UI.state) UI.state.set({ currentOrgId: def });
    projectAuth();
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
  }
  function onReset() { try { LS.removeItem(KEY); } catch (e) {} load(); }

  /* 启动即绑定事件（脚本加载时执行一次） */
  function init() {
    load();
    window.addEventListener('engchain:login', onLogin);
    window.addEventListener('engchain:reset', onReset);
    /* 页面首次进入（非经 login 事件，如直接打开且 state 已在）补一次投影 */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { onLogin(); });
    } else { onLogin(); }
  }

  return {
    KEY: KEY, MEMBER_LIMIT: MEMBER_LIMIT,
    load: load, get: get, list: load,
    orgsOf: orgsOf, membershipOf: membershipOf, currentMembership: currentMembership,
    members: members, memberCount: memberCount,
    canManage: canManage, myRole: myRole,
    invite: invite, pendingInvitesFor: pendingInvitesFor, acceptInvite: acceptInvite, rejectInvite: rejectInvite,
    requestJoin: requestJoin, pendingJoins: pendingJoins, approveJoin: approveJoin, rejectJoin: rejectJoin,
    removeMember: removeMember,
    switchOrg: switchOrg, projectAuth: projectAuth, defaultOrgIdFor: defaultOrgIdFor,
    init: init
  };
})();
/* 立即自启动（依赖 stores/databus 已就绪；本文件在它们之后加载） */
if (window.OrgsStore) window.OrgsStore.init();
