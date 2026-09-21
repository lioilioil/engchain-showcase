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

  /* ---- seed：预置三家演示企业实体 ----
     org1 川×建设（建筑入驻 resident）：owner=u1 陈建国；预置一条给 u5 的待接受邀请(admin)
     org2 成×工程咨询（建筑入驻 resident）：owner=u3 王强；u5 已是 member
     org3 ×诚劳务（建筑入驻 resident）：企业主空缺（ownerUid:''），成员 u4 张敏
     → 登录 u4 可演示「企业主为空」：空态邀请按钮 → 邀请企业主（默认身份=企业主）→ 短信 → 邀请入驻标签
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
      },
      {
        orgId: 'org3', co: '成都×诚劳务有限公司', shortName: '×诚劳务',
        code: '91510100MA9×××33K', legal: '罗×军',
        entryTypes: ['construction'], entStatus: 'resident',
        enterpriseQual: ['建筑业企业资质 · 施工劳务不分等级'],
        expireAt: now + YEAR, ownerUid: '', memberLimit: MEMBER_LIMIT,
        members: [
          { uid: 'u4', role: 'member', status: 'active', joinedAt: now - DAY * 10 }
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
    if (window.DataBus && DataBus.isGuest && DataBus.isGuest()) return null;   /* [S5] */
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    var cur = st.currentOrgId || null;
    if (cur && cur !== 'personal') {
      var m = membershipOf(u.id, cur);
      if (m) return m;
    }
    return null;
  }

  /* ---- 身份投影：L2 Store 基础 + 当前代表企业覆盖（[S1] base 从 L2 读，与 deriveIdentity 同源） ---- */
  function projectAuth() {
    var u = me(); if (!u || !window.AuthStore || !window.EntryStore) return;
    if (window.DataBus && DataBus.isGuest && DataBus.isGuest()) return;   /* [S5] 统一游客判断 */
    var baseAuth = JSON.parse(JSON.stringify(AuthStore.read() || {}));
    var baseEntry = JSON.parse(JSON.stringify(EntryStore.read() || {}));
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
  /* 角色文案 */
  function roleLabel(r) { return r === 'owner' ? '企业主' : r === 'admin' ? '管理员' : '成员'; }
  /* 企业是否已有 active 企业主 */
  function hasOwner(orgId) {
    var org = get(orgId); if (!org) return false;
    return (org.members || []).some(function (m) { return m.role === 'owner' && m.status === 'active'; });
  }
  /* 待接受的企业主邀请（每企业最多一条） */
  function ownerInviteOf(orgId) {
    var org = get(orgId); if (!org) return null;
    var list = org.invites || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].role === 'owner' && list[i].status === 'pending') return list[i];
    }
    return null;
  }
  /* 谁能邀请：owner/admin 可邀任意身份；企业主空缺时，普通成员可邀企业主 */
  function canInvite(org, cm, role) {
    if (!org || !cm) return false;
    if (cm.role === 'owner' || cm.role === 'admin') return true;
    if (role === 'owner' && !hasOwner(org.orgId) && !ownerInviteOf(org.orgId)) return true;
    return false;
  }
  /* 邀请某已注册实名成员加入企业；role: 'owner' | 'admin' | 'member' */
  function invite(orgId, targetUid, role) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    if (!canInvite(org, cm, role)) return { error: '仅企业主/管理员可邀请成员' };
    if (!targetUid) return { error: '请选择被邀请人' };
    var target = (window.DataBus && DataBus.byId) ? DataBus.byId(targetUid) : null;
    if (!target) return { error: '用户不存在' };
    /* 已在成员中 */
    if (membershipOf(targetUid, orgId)) return { error: '该成员已在企业内' };
    /* 上限 */
    if (memberCount(org) >= org.memberLimit) return { error: '成员数已达上限（' + org.memberLimit + '人），如需扩容请联系平台' };
    /* 企业主邀请唯一性 */
    if (role === 'owner') {
      if (hasOwner(orgId)) return { error: '该企业已有企业主，不能再邀请企业主' };
      if (ownerInviteOf(orgId)) return { error: '已有待接受的企业主邀请，请先处理' };
    }
    /* 重复 pending 邀请 */
    for (var i = 0; i < org.invites.length; i++) {
      if (org.invites[i].targetUid === targetUid && org.invites[i].status === 'pending') return { error: '已向该成员发出邀请，等待其接受' };
    }
    var rl = roleLabel(role || 'member');
    var iv = {
      inviteId: 'inv-' + orgId + '-' + targetUid + '-' + Date.now(), targetUid: targetUid,
      mobile: maskMobile(target.mobile || ''), mobileRaw: target.mobile || '',
      name: target.name, role: role || 'member', status: 'pending', inviterUid: u.id,
      createdAt: Date.now(), via: 'users', sendAt: Date.now(), sendCount: 1
    };
    org.invites.push(iv);
    save(a);
    /* 已认证用户：短信 + 站内消息双通道提醒 */
    sendSms(target.mobile || '', '【工程链】' + (org.shortName || org.co) + ' 邀请您加入企业团队担任' + rl + '，请登录 App 在企业成员管理中确认。');
    try {
      if (window.DataBus && DataBus.pushDirectMessage) DataBus.pushDirectMessage(target.id, '企业邀请通知', (org.shortName || org.co) + ' 邀请您加入企业团队担任' + rl + '，请进入「企业成员管理」查看并确认。');
    } catch (e) {}
    if (window.DataBus && DataBus.audit) DataBus.audit('邀请成员', '企业', target.name, '邀请加入 ' + (org.shortName || org.co) + ' 担任 ' + rl);
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
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
          iv.status = 'accepted'; iv.updatedAt = Date.now();
          org.members.push({ uid: u.id, role: iv.role, status: 'active', joinedAt: Date.now() });
          if (iv.role === 'owner') {
            /* 企业主邀请：原 owner 降为管理员，ownerUid 落到新企业主 */
            (org.members || []).forEach(function (m) {
              if (m.uid !== u.id && m.role === 'owner' && m.status === 'active') m.role = 'admin';
            });
            org.ownerUid = u.id;
          }
          save(a);
          if (window.DataBus && DataBus.audit) DataBus.audit('接受邀请', '企业', u.name, '加入 ' + (org.shortName || org.co) + ' 担任 ' + roleLabel(iv.role));
          try {
            if (window.DataBus && DataBus.pushDirectMessage && iv.inviterUid && iv.inviterUid !== u.id) {
              DataBus.pushDirectMessage(iv.inviterUid, '成员已加入企业', u.name + ' 已接受邀请，成为 ' + (org.shortName || org.co) + ' 的' + roleLabel(iv.role) + '。');
            }
          } catch (e) {}
          window.dispatchEvent(new CustomEvent('engchain:org', {}));
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
          org.invites[j].status = 'rejected'; org.invites[j].updatedAt = Date.now(); save(a);
          window.dispatchEvent(new CustomEvent('engchain:org', {}));
          return { ok: true };
        }
      }
    }
    return { error: '邀请不存在' };
  }

  /* ============ 申请制（员工侧发起） ============ */
  function requestJoin(orgId, note) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    if (window.DataBus && DataBus.isGuest && DataBus.isGuest()) return { error: '请先登录' };   /* [S5] */
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
        name: u ? u.name : m.uid, avatar: u ? u.avatar : '?',
        mobile: u ? maskMobile(u.mobile || '') : '' };
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

  /* ============ 手机号搜索邀请（v1.2） ============
     输入手机号 → 判定该手机号用户状态：
       - 已注册且已实名认证 → 生成邀请 + 短信 + 站内消息提醒（case: verified）
       - 已注册未实名       → 短信邀请引导认证（case: unverified）
       - 未注册             → 短信邀请引导注册（case: unregistered，姓名取自表单）
     邀请记录统一写入 org.invites（含 role: owner 企业主邀请）；
     短信 1 个被邀请账号 1 天 1 次（sendAt / canSendInviteSms / sendInviteSms）。
     短信为演示模拟：写 engchain-sms 短信箱 + 页面 toast 提示。 */
  var SMS_KEY = 'engchain-sms';
  var SMS_DAY = 24 * 3600 * 1000; /* 一个邀请账号 1 天发送 1 次 */
  function loadSms() {
    try { var raw = LS.getItem(SMS_KEY); var a = raw ? JSON.parse(raw) : []; if (Array.isArray(a)) return a; } catch (e) {}
    return [];
  }
  function saveSms(a) { try { LS.setItem(SMS_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function maskMobile(m) { return String(m || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'); }
  function sendSms(mobile, text) {
    var a = loadSms();
    var rec = { id: 'SMS' + String(Date.now()).slice(-6), mobile: maskMobile(mobile), text: text, ts: Date.now() };
    a.unshift(rec);
    saveSms(a);
    return rec;
  }
  function smsInbox() { return loadSms(); }
  function inviteSmsText(orgName, rl, target, name) {
    if (target) {
      var real = !!(target.auth && target.auth.realname && target.auth.realname.ok);
      if (real) return '【工程链】' + orgName + ' 邀请您加入企业团队担任' + rl + '，请登录 App 在企业成员管理中确认。';
      return '【工程链】' + orgName + ' 邀请您加入企业团队担任' + rl + '。您的账号尚未完成实名认证，请登录 App 完成实名认证后接受邀请。';
    }
    return '【工程链】' + orgName + ' 邀请' + (name || '您') + '加入企业团队担任' + rl + '。请注册工程链账号并完成实名认证后加入。';
  }
  /* 短信发送限制检查：pending 且距上次发送 ≥ 24h */
  function canSendInviteSms(orgId, inviteId) {
    var org = get(orgId); if (!org) return { ok: false, reason: '企业不存在' };
    var inv = null;
    for (var i = 0; i < (org.invites || []).length; i++) if (org.invites[i].inviteId === inviteId) { inv = org.invites[i]; break; }
    if (!inv) return { ok: false, reason: '邀请不存在' };
    if (inv.status !== 'pending') return { ok: false, reason: '邀请已处理' };
    if (inv.sendAt && (Date.now() - inv.sendAt < SMS_DAY)) {
      return { ok: false, reason: '今日已发送', remain: SMS_DAY - (Date.now() - inv.sendAt) };
    }
    return { ok: true };
  }
  /* 补发邀请短信：1 天 1 次，超次数返回 error（按钮置灰由 canSendInviteSms 控制） */
  /* 邀请发起人可管理自己创建的待接受邀请（企业主空缺时，普通成员发起的企业主邀请） */
  function canManageInvite(org, cm, inv, uid) {
    if (canInvite(org, cm, inv ? inv.role : '')) return true;
    if (!inv || inv.status !== 'pending') return false;
    return inv.inviterUid === uid;
  }
  function sendInviteSms(orgId, inviteId) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    var inv = null;
    for (var i = 0; i < org.invites.length; i++) if (org.invites[i].inviteId === inviteId) { inv = org.invites[i]; break; }
    if (!inv) return { error: '邀请不存在' };
    if (!canManageInvite(org, cm, inv, u.id)) return { error: '仅企业主/管理员可发送邀请短信' };
    if (inv.status !== 'pending') return { error: '邀请已处理，无需再发送' };
    var chk = canSendInviteSms(orgId, inviteId);
    if (!chk.ok) return { error: chk.reason === '今日已发送' ? '今日已发送过邀请短信，请明天再试' : chk.reason };
    var mobile = inv.mobileRaw || '';
    if (!/^1\d{10}$/.test(mobile)) {
      var target = inv.targetUid ? ((window.DataBus && DataBus.byId) ? DataBus.byId(inv.targetUid) : null) : null;
      mobile = (target && target.mobile) || '';
    }
    if (!/^1\d{10}$/.test(mobile)) return { error: '该邀请缺少可用手机号' };
    var rl = roleLabel(inv.role);
    sendSms(mobile, inviteSmsText(org.shortName || org.co, rl, inv.targetUid ? ((window.DataBus && DataBus.byId) ? DataBus.byId(inv.targetUid) : null) : null, inv.name));
    inv.sendAt = Date.now(); inv.sendCount = (inv.sendCount || 0) + 1; inv.updatedAt = Date.now();
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('补发邀请短信', '企业', inv.name || maskMobile(mobile), '补发 ' + (org.shortName || org.co) + ' 邀请短信（' + roleLabel(inv.role) + '）');
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
    return { ok: true, sms: maskMobile(mobile) };
  }

  /* 手机号邀请（含企业主角色与姓名）；role: 'member' | 'admin' | 'owner' */
  function inviteByMobile(orgId, mobile, role, name) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    if (!canInvite(org, cm, role)) return { error: '仅企业主/管理员可邀请成员' };
    var p = String(mobile || '').replace(/\s+/g, '');
    if (!/^1\d{10}$/.test(p)) return { error: '请输入正确的 11 位手机号' };
    if (role === 'owner') {
      if (hasOwner(orgId)) return { error: '该企业已有企业主，不能再邀请企业主' };
      if (ownerInviteOf(orgId)) return { error: '已有待接受的企业主邀请，请先处理' };
    }
    if (memberCount(org) >= org.memberLimit) return { error: '成员数已达上限（' + org.memberLimit + '人），如需扩容请联系平台' };
    var orgName = org.shortName || org.co;
    var rl = roleLabel(role || 'member');
    var target = (window.DataBus && DataBus.byMobile) ? DataBus.byMobile(p) : null;

    if (target) {
      if (membershipOf(target.id, orgId)) return { error: '该手机号用户已是本企业成员' };
      for (var i = 0; i < org.invites.length; i++) {
        if (org.invites[i].targetUid === target.id && org.invites[i].status === 'pending') return { error: '已向该用户发出邀请，等待其接受' };
      }
      var real = !!(target.auth && target.auth.realname && target.auth.realname.ok);
      var inv = {
        inviteId: 'inv-' + orgId + '-' + (target.id || 'm') + '-' + Date.now(), targetUid: target.id,
        mobile: maskMobile(p), mobileRaw: p, name: target.name || name || '',
        role: role || 'member', status: 'pending', inviterUid: u.id, createdAt: Date.now(),
        via: 'mobile', sendAt: Date.now(), sendCount: 1
      };
      org.invites.push(inv);
      save(a);
      sendSms(p, inviteSmsText(orgName, rl, target, name));
      window.dispatchEvent(new CustomEvent('engchain:org', {}));
      if (real) {
        try {
          if (window.DataBus && DataBus.pushDirectMessage) DataBus.pushDirectMessage(target.id, '企业邀请通知', orgName + ' 邀请您加入企业团队担任' + rl + '，请进入「企业成员管理」查看并确认。');
        } catch (e) {}
        if (window.DataBus && DataBus.audit) DataBus.audit('手机号邀请（已认证）', '企业', target.name, '短信+站内消息邀请加入 ' + orgName + ' 担任 ' + rl);
        return { ok: true, case: 'verified', uid: target.id, name: target.name, sms: maskMobile(p) };
      }
      if (window.DataBus && DataBus.audit) DataBus.audit('手机号邀请（未认证）', '企业', target.name, '短信邀请 ' + maskMobile(p) + ' 完成实名认证后加入 ' + orgName);
      return { ok: true, case: 'unverified', uid: target.id, name: target.name, sms: maskMobile(p) };
    }

    /* 未注册：短信邀请注册 */
    var inv2 = {
      inviteId: 'inv-' + orgId + '-m-' + Date.now(), targetUid: null,
      mobile: maskMobile(p), mobileRaw: p, name: name || '',
      role: role || 'member', status: 'pending', inviterUid: u.id, createdAt: Date.now(),
      via: 'mobile', sendAt: Date.now(), sendCount: 1
    };
    org.invites.push(inv2);
    save(a);
    sendSms(p, inviteSmsText(orgName, rl, null, name));
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
    if (window.DataBus && DataBus.audit) DataBus.audit('手机号邀请（未注册）', '企业', maskMobile(p), '短信邀请注册工程链后加入 ' + orgName);
    return { ok: true, case: 'unregistered', sms: maskMobile(p) };
  }

  /* ============ 邀请修改（v1.2） ============
     修改待接受邀请的姓名 / 手机号 / 身份；手机号变更会重新识别注册状态并重置短信频率。 */
  function updateInvite(orgId, inviteId, patch) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    var inv = null;
    for (var i = 0; i < org.invites.length; i++) if (org.invites[i].inviteId === inviteId) { inv = org.invites[i]; break; }
    if (!inv) return { error: '邀请不存在' };
    if (!canManageInvite(org, cm, inv, u.id)) return { error: '仅企业主/管理员可修改邀请' };
    if (inv.status !== 'pending') return { error: '邀请已处理，无法修改' };
    patch = patch || {};
    var changed = false;

    if (patch.mobile !== undefined && patch.mobile !== null) {
      var nm = String(patch.mobile).replace(/\s+/g, '');
      if (!/^1\d{10}$/.test(nm)) return { error: '请输入正确的 11 位手机号' };
      if (nm !== (inv.mobileRaw || '')) {
        var t2 = (window.DataBus && DataBus.byMobile) ? DataBus.byMobile(nm) : null;
        if (t2) {
          if (membershipOf(t2.id, orgId)) return { error: '该手机号用户已是本企业成员' };
          for (var i = 0; i < org.invites.length; i++) {
            var oi = org.invites[i];
            if (oi.inviteId !== inviteId && oi.targetUid === t2.id && oi.status === 'pending') return { error: '已向该用户发出邀请，等待其接受' };
          }
          inv.targetUid = t2.id; inv.name = t2.name;
        } else {
          inv.targetUid = null;
        }
        inv.mobileRaw = nm; inv.mobile = maskMobile(nm);
        inv.sendAt = 0; inv.sendCount = 0; /* 更换手机号 = 新账号，重置 1 天 1 次频率 */
        changed = true;
      }
    }
    if (patch.name !== undefined && patch.name !== null && String(patch.name).trim() !== (inv.name || '')) {
      inv.name = String(patch.name).trim(); changed = true;
    }
    if (patch.role !== undefined && patch.role !== inv.role) {
      if (patch.role === 'owner') {
        if (hasOwner(orgId)) return { error: '该企业已有企业主，不能改设为企业主' };
        var curOwnerInv = ownerInviteOf(orgId);
        if (curOwnerInv && curOwnerInv.inviteId !== inviteId) return { error: '已有待接受的企业主邀请' };
      }
      inv.role = patch.role; changed = true;
    }
    if (!changed) return { error: '未做任何修改' };
    inv.updatedAt = Date.now();
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('修改企业邀请', '企业', inv.name || inv.mobile, '修改 ' + (org.shortName || org.co) + ' 的邀请信息');
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
    return { ok: true };
  }

  /* ============ 邀请通知（消息页「通知」栏目） ============
     某用户收到的企业邀请（含待处理 / 已接受 / 已拒绝），按最近更新时间倒序。 */
  function inviteNoticesFor(uid) {
    var a = load(), out = [];
    if (!uid) return out;
    a.forEach(function (org) {
      (org.invites || []).forEach(function (iv) {
        if (iv.targetUid === uid && (iv.status === 'pending' || iv.status === 'accepted' || iv.status === 'rejected')) {
          out.push({ org: org, invite: iv });
        }
      });
    });
    out.sort(function (x, y) {
      return ((y.invite.updatedAt || y.invite.createdAt) || 0) - ((x.invite.updatedAt || x.invite.createdAt) || 0);
    });
    return out;
  }

  /* ============ 退出企业 ============ */
  function leave(orgId) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var m = membershipOf(u.id, orgId);
    if (!m) return { error: '你不在该企业内' };
    if (m.role === 'owner') return { error: '企业主不能直接退出，请先申请移交企业主身份' };
    for (var i = 0; i < org.members.length; i++) {
      if (org.members[i].uid === u.id) { org.members.splice(i, 1); break; }
    }
    save(a);
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    if (st.currentOrgId === orgId) { UI.state.set({ currentOrgId: null }); }
    projectAuth();
    window.dispatchEvent(new CustomEvent('engchain:org', {}));
    if (window.DataBus && DataBus.audit) DataBus.audit('退出企业', '企业', u.name, '退出 ' + (org.shortName || org.co));
    return { ok: true };
  }

  /* ============ 企业主移交 + 身份验证（v1.1） ============
     owner/admin 均可发起移交；企业主身份要求接收人完成
     「法人认证」或「实际控制人验证」，后台审核通过后生效。 */
  function transfersOf(orgId) { var org = get(orgId); return (org && org.transfers) || []; }
  function pendingTransferForUser(org, uid) {
    if (!org || !org.transfers) return null;
    for (var i = 0; i < org.transfers.length; i++) {
      var t = org.transfers[i];
      if (t.toUid === uid && (t.status === 'verify-pending' || t.status === 'owner-confirm')) return t;
    }
    return null;
  }
  function ownerConfirmingTransfers(orgId) {
    var org = get(orgId); if (!org) return [];
    return (org.transfers || []).filter(function (t) { return t.status === 'owner-confirm'; });
  }
  function requestTransfer(orgId, toUid) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var cm = membershipOf(u.id, orgId);
    if (!cm || (cm.role !== 'owner' && cm.role !== 'admin')) return { error: '仅企业主/管理员可申请移交' };
    if (toUid === u.id) return { error: '不能向自己移交企业主身份' };
    var tm = membershipOf(toUid, orgId);
    if (!tm) return { error: '接收人需先加入本企业成为成员' };
    if (tm.role === 'owner') return { error: '接收人已是企业主' };
    var ts = org.transfers || [];
    for (var i = 0; i < ts.length; i++) {
      if (ts[i].status === 'pending' || ts[i].status === 'verify-pending' || ts[i].status === 'owner-confirm') return { error: '已有待处理的移交申请，请先完成后再发起' };
    }
    var t = { id: 'tr-' + Date.now(), fromUid: u.id, toUid: toUid, status: cm.role === 'owner' ? 'verify-pending' : 'owner-confirm', verify: { mode: '', status: 'none' }, createdAt: Date.now(), updatedAt: Date.now() };
    (org.transfers = org.transfers || []).push(t);
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('申请移交企业主', '企业', u.name, '申请将 ' + (org.shortName || org.co) + ' 企业主身份移交给 ' + toUid);
    try {
      if (window.DataBus && DataBus.pushDirectMessage) {
        DataBus.pushDirectMessage(toUid, '企业主移交申请', (org.shortName || org.co) + ' 申请将企业主身份移交给您。请完成企业主身份验证（法人认证或实际控制人验证），后台审核通过后正式生效。');
        if (cm.role === 'admin') DataBus.pushDirectMessage(org.ownerUid, '移交待确认', '管理员申请将企业主身份移交给新成员，请在企业成员管理中确认。');
      }
    } catch (e) {}
    return { ok: true, transferId: t.id };
  }
  /* owner 确认管理员发起的移交申请 */
  function confirmTransfer(transferId) {
    var a = load(); var u = me(); if (!u) return { error: '未登录' };
    for (var i = 0; i < a.length; i++) {
      var org = a[i];
      var ts = org.transfers || [];
      for (var j = 0; j < ts.length; j++) {
        var t = ts[j];
        if (t.id === transferId && t.status === 'owner-confirm') {
          var cm = membershipOf(u.id, org.orgId);
          if (!cm || cm.role !== 'owner') return { error: '仅企业主可确认移交' };
          t.status = 'verify-pending'; t.updatedAt = Date.now(); save(a);
          try { if (window.DataBus && DataBus.pushDirectMessage) DataBus.pushDirectMessage(t.toUid, '企业主移交已确认', '企业主已确认移交申请，请完成企业主身份验证（法人认证或实际控制人验证）。'); } catch (e) {}
          return { ok: true };
        }
      }
    }
    return { error: '待确认的移交不存在' };
  }
  /* owner 驳回管理员发起的移交申请 */
  function rejectTransfer(transferId) {
    var a = load(); var u = me(); if (!u) return { error: '未登录' };
    for (var i = 0; i < a.length; i++) {
      var org = a[i];
      var ts = org.transfers || [];
      for (var j = 0; j < ts.length; j++) {
        var t = ts[j];
        if (t.id === transferId && t.status === 'owner-confirm') {
          var cm = membershipOf(u.id, org.orgId);
          if (!cm || cm.role !== 'owner') return { error: '仅企业主可驳回移交' };
          t.status = 'rejected'; t.updatedAt = Date.now(); save(a);
          if (window.DataBus && DataBus.audit) DataBus.audit('驳回企业主移交', '企业', t.toUid, (org.shortName || org.co) + ' 移交申请被企业主驳回');
          return { ok: true };
        }
      }
    }
    return { error: '待确认的移交不存在' };
  }
  /* 接收人提交企业主身份验证：mode='legal' 法人认证 | 'controller' 实际控制人验证 */
  function submitOwnerVerify(orgId, mode, payload) {
    var a = load(); var org = a.find(function (x) { return x.orgId === orgId; }); var u = me(); if (!org || !u) return { error: '企业不存在' };
    var t = pendingTransferForUser(org, u.id);
    if (!t || t.status !== 'verify-pending') return { error: '当前没有待处理的移交验证申请' };
    if (t.verify && t.verify.status === 'pending') return { error: '验证材料已提交，等待后台审核' };
    var name = (payload && payload.name) || u.name || '';
    var idNo = (payload && payload.idNo) || '';
    if (!name) return { error: '请填写姓名' };
    if (!/^\d{6}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idNo)) return { error: '请填写正确的 18 位身份证号' };
    if (mode === 'legal') {
      if (name !== (org.legal || '')) return { error: '法人认证：姓名须与营业执照法定代表人「' + (org.legal || '') + '」一致' };
    } else if (mode === 'controller') {
      if (!payload || !payload.declaration) return { error: '实际控制人验证：需勾选实际控制人声明' };
    } else {
      return { error: '请选择验证方式' };
    }
    t.verify = { mode: mode, status: 'pending', name: name, idNo: idNo, submittedAt: Date.now(), payload: payload || {} };
    t.updatedAt = Date.now();
    save(a);
    if (window.DataBus && DataBus.audit) DataBus.audit('提交企业主验证', '企业', name, (mode === 'legal' ? '法人认证' : '实际控制人验证') + ' · ' + (org.shortName || org.co));
    return { ok: true, transferId: t.id };
  }
  /* 后台审核企业主验证：通过 → 移交生效（接收人=owner，原 owner 降为 admin） */
  function reviewOwnerVerify(transferId, approve) {
    var a = load();
    for (var i = 0; i < a.length; i++) {
      var org = a[i];
      var ts = org.transfers || [];
      for (var j = 0; j < ts.length; j++) {
        var t = ts[j];
        if (t.id === transferId && t.verify && t.verify.status === 'pending') {
          if (approve) {
            var from = null, to = null;
            org.members.forEach(function (m) {
              if (m.uid === t.fromUid && m.status === 'active') from = m;
              if (m.uid === t.toUid && m.status === 'active') to = m;
            });
            if (!to) { t.verify.status = 'rejected'; t.status = 'rejected'; save(a); return { error: '接收人已不在企业内，移交自动失效' }; }
            if (from && from.role === 'owner') from.role = 'admin';
            to.role = 'owner';
            org.ownerUid = t.toUid;
            t.verify.status = 'approved'; t.verify.reviewedAt = Date.now();
            t.status = 'done'; t.updatedAt = Date.now();
            save(a);
            try {
              if (window.DataBus && DataBus.pushDirectMessage) {
                DataBus.pushDirectMessage(t.toUid, '企业主移交完成', '恭喜，您已成为 ' + (org.shortName || org.co) + ' 的企业主。');
                if (t.fromUid !== t.toUid) DataBus.pushDirectMessage(t.fromUid, '企业主移交完成', '您已将 ' + (org.shortName || org.co) + ' 的企业主身份移交给新企业主，您的角色已转为管理员。');
              }
            } catch (e) {}
            if (window.DataBus && DataBus.audit) DataBus.audit('审核通过企业主移交', '企业', t.toUid, (org.shortName || org.co) + ' 企业主移交生效');
            return { ok: true };
          }
          t.verify.status = 'rejected'; t.verify.reviewedAt = Date.now();
          t.status = 'rejected'; t.updatedAt = Date.now();
          save(a);
          if (window.DataBus && DataBus.audit) DataBus.audit('驳回企业主移交', '企业', t.toUid, (org.shortName || org.co) + ' 企业主移交被驳回');
          return { ok: true };
        }
      }
    }
    return { error: '待审核的验证单不存在' };
  }
  /* 待后台审核的企业主验证单（跨企业汇总） */
  function pendingOwnerReviews() {
    var a = load(), out = [];
    a.forEach(function (org) {
      (org.transfers || []).forEach(function (t) {
        if (t.verify && t.verify.status === 'pending') out.push({ org: org, transfer: t });
      });
    });
    return out;
  }
  function transferById(transferId) {
    var a = load();
    for (var i = 0; i < a.length; i++) {
      var ts = a[i].transfers || [];
      for (var j = 0; j < ts.length; j++) if (ts[j].id === transferId) return { org: a[i], transfer: ts[j] };
    }
    return null;
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
    inviteByMobile: inviteByMobile, smsInbox: smsInbox, sendSms: sendSms,
    hasOwner: hasOwner, ownerInviteOf: ownerInviteOf,
    canSendInviteSms: canSendInviteSms, sendInviteSms: sendInviteSms,
    updateInvite: updateInvite, inviteNoticesFor: inviteNoticesFor,
    leave: leave,
    transfersOf: transfersOf, pendingTransferForUser: pendingTransferForUser,
    ownerConfirmingTransfers: ownerConfirmingTransfers,
    requestTransfer: requestTransfer, confirmTransfer: confirmTransfer, rejectTransfer: rejectTransfer,
    submitOwnerVerify: submitOwnerVerify, reviewOwnerVerify: reviewOwnerVerify,
    pendingOwnerReviews: pendingOwnerReviews, transferById: transferById,
    switchOrg: switchOrg, projectAuth: projectAuth, defaultOrgIdFor: defaultOrgIdFor,
    init: init
  };
})();
/* 立即自启动（依赖 stores/databus 已就绪；本文件在它们之后加载） */
if (window.OrgsStore) window.OrgsStore.init();
