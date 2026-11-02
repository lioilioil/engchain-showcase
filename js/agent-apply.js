/* ============================================================================
   js/agent-apply.js —— M2-1 总代申请提交 / M2-4 驳回重提 / M2-2 App 导入种子
   ----------------------------------------------------------------------------
   - ¥0 确认提交，无任何付费入口/金额按钮；不调用 DataBus.entryApply，不写旧 entry 队列；
   - 缺执照/意向省拦截；提交 → pending 落 engchain-province-agents；
   - 一公司一记录：rejected 复用原记录回退 pending，rejects[] 保留历史，不新建重复；
   - 个人合伙人(u9)申请链路完全不经本模块。
   浏览器 → window.AgentApply；node → module.exports（smoke-m2 注入 store）。
   ============================================================================ */
(function (root) {
  'use strict';

  function deps() {
    var R = (typeof window !== 'undefined' && window.AgentRules) || (typeof require === 'function' ? require('./agent-rules.js') : null);
    var S = (typeof window !== 'undefined' && window.AgentStore) || (typeof require === 'function' ? require('./agent-store.js') : null);
    var B = (typeof window !== 'undefined' && window.AgentBridge) || (typeof require === 'function' ? require('./agent-bridge.js') : null);
    var RF = (typeof window !== 'undefined' && window.AgentReferral) || (typeof require === 'function' ? require('./agent-referral.js') : null);
    return { R: R, S: S, B: B, RF: RF };
  }

  function currentUid() {
    try {
      if (typeof window !== 'undefined' && window.DataBus && typeof DataBus.current === 'function') {
        var u = DataBus.current(); return u ? u.id : '';
      }
    } catch (e) {}
    return '';
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* M2-1 提交省级总代申请（fee 恒 0，无付费）
     两种口径：
       payload.personal = true → 个人实名申请（entry-form.html?type=provinceAgent）：
         不采集企业主体，实名与注册手机号由账户自动引用，必填只有「意向授权省」；
         主体资料（执照/USCC/法人）留待审核阶段补齐，故不解锁 D31 自然人主体位。
       默认 → 企业主体申请：保留原四要素必填校验与一公司一记录口径。 */
  function submitProvinceApplication(payload, opts) {
    opts = opts || {};
    var d = deps(), R = d.R, S = opts.store || d.S;
    if (!R || !S) return { error: 'E_DEPS_MISSING', msg: 'AgentRules/AgentStore 未加载' };
    payload = payload || {};
    var personal = !!payload.personal;

    if (personal) {
      /* 实名前置：未完成个人实名认证不可提交（表单已断链，此处兜底防绕过） */
      if (!payload.realnameOk) return { error: 'E_REALNAME_REQUIRED', msg: '请先完成个人实名认证后再申请省代' };
      if (!String(payload.realName || '').trim()) return { error: 'E_REALNAME_REQUIRED', msg: '未读取到实名信息，请先完善实名认证' };
      if (!String(payload.mobile || '').trim()) return { error: 'E_MOBILE_REQUIRED', msg: '未读取到注册手机号，请先完善账户信息' };
      if (!String(payload.province || '').trim()) return { error: 'E_PROVINCE_REQUIRED', msg: '请选择意向授权省（缺意向省拦截）' };
    } else {
      /* 必填拦截：执照 / 意向省 / 公司名 / uscc / 法人 / 联系人 */
      if (!String(payload.companyName || '').trim()) return { error: 'E_COMPANY_EMPTY', msg: '请填写分公司名称' };
      if (!String(payload.uscc || '').trim()) return { error: 'E_USCC_EMPTY', msg: '请填写统一社会信用代码' };
      if (!String(payload.license || '').trim()) return { error: 'E_LICENSE_REQUIRED', msg: '请上传/填写营业执照（缺执照拦截）' };
      if (!String(payload.province || '').trim()) return { error: 'E_PROVINCE_REQUIRED', msg: '请选择意向授权省（缺意向省拦截）' };
      if (!String(payload.legalRep || '').trim()) return { error: 'E_LEGALREP_EMPTY', msg: '请填写法定代表人' };
      if (!String(payload.contact || '').trim()) return { error: 'E_CONTACT_EMPTY', msg: '请填写联系人' };
    }

    var uid = payload.uid || currentUid();
    if (personal && !uid) return { error: 'E_UID_REQUIRED', msg: '请先登录后提交申请' };
    var uscc = personal ? '' : R.normalizeUscc(payload.uscc);
    var province = R.normalizeProvince(payload.province, opts.quotaCfg && opts.quotaCfg.aliases);

    /* 四道校验（M1-3）：省独家 / uscc 唯一 / 一人一省 / 自然人禁入 */
    var ctx = { provinceAgents: S.listProvinces(), subAgents: S.listSubs(), quotaCfg: opts.quotaCfg || {} };
    var v = R.validateProvinceAgent({ uid: uid, province: province, uscc: uscc, isNaturalPerson: personal ? false : !!payload.isNaturalPerson }, ctx);

    /* 主体落库字段：个人口径把实名人与注册手机号作为联络主体，企业字段留空待审核补齐 */
    var realName = String(payload.realName || '').trim();
    var mobile = String(payload.mobile || '').trim();
    var altContact = String(payload.altContact || '').trim();
    var altPhone = String(payload.altPhone || '').trim();
    var remark = String(payload.remark || '').trim();
    function branchOf() {
      if (!personal) {
        return { name: payload.companyName, uscc: uscc, license: payload.license,
          legalRep: payload.legalRep, contact: payload.contact, phone: payload.phone || '' };
      }
      return { name: '', uscc: '', license: '', legalRep: realName, contact: realName, phone: mobile,
        altContact: altContact, altPhone: altPhone };
    }
    function applicantOf() {
      if (!personal) return null;
      return { name: realName, mobile: mobile, altContact: altContact, altPhone: altPhone,
        realnameAt: payload.realnameAt || 0, mode: 'personal' };
    }
    function materialsOf() {
      if (!personal) return payload.materials || [];
      return remark ? [remark] : [];
    }

    /* M2-4 一公司一记录：已存在同 uscc 记录 → 复用（rejected/terminated 释放态回退 pending；
       active/suspended/pending 直接冲突拦截，不新建重复记录）。
       个人口径无 uscc，按 uid 归口（一账号一记录）。 */
    var existing = personal
      ? (ctx.provinceAgents.filter(function (a) { return a.uid === uid; })[0] || null)
      : ctx.provinceAgents.find(function (a) {
        return R.normalizeUscc(a.branchCompany && a.branchCompany.uscc) === uscc;
      });
    if (existing) {
      if (existing.status === 'active' || existing.status === 'suspended') {
        return { error: 'E_ALREADY_AGENT', msg: '当前账号已是' + (existing.province || '') + '在册省级总代' };
      }
      if (existing.status === 'pending') {
        return { error: personal ? 'E_APPLY_PENDING' : (v.code === 'E_PROVINCE_TAKEN' ? 'E_PROVINCE_TAKEN' : 'E_USCC_DUPLICATE'),
          msg: v.ok ? (personal ? '你的省代申请正在审核中，不可重复提交' : '该公司已有在审/在册总代记录，不可重复提交') : v.msg };
      }
      /* 释放态（rejected/terminated/revoked）：复用原记录回退 pending，保留 rejects 历史 */
      existing.status = 'pending';
      existing.rejectReason = '';
      existing.branchCompany = branchOf();
      existing.applicant = applicantOf();
      existing.applyMode = personal ? 'personal' : 'company';
      existing.remark = personal ? remark : '';
      existing.province = province;
      existing.materials = materialsOf();
      existing.statusLog = existing.statusLog || [];
      existing.statusLog.push({ operator: uid || 'self', at: Date.now(), reason: '补资料重新提交', fromStatus: existing.status, toStatus: 'pending' });
      var saved = S.saveProvince(existing);
      if (saved.error) return saved;
      return { ok: true, reused: true, record: existing };
    }

    if (!v.ok) return { error: v.code, msg: v.msg };

    var rec = {
      id: 'pa-' + Date.now().toString(36),
      uid: uid,
      province: province,
      provinceCode: '',
      branchCompany: branchOf(),
      applicant: applicantOf(),
      applyMode: personal ? 'personal' : 'company',
      remark: personal ? remark : '',
      status: 'pending',
      appointedAt: 0, appointedBy: '', source: 'apply',
      rejects: [], statusLog: [{ operator: uid || 'self', at: Date.now(), reason: personal ? '个人实名提交省代申请' : '提交申请', fromStatus: '', toStatus: 'pending' }],
      provinceHistory: [], sealedAt: 0, orgId: '', legalRep: personal ? realName : payload.legalRep, admins: [],
      materials: materialsOf(), fee: 0 /* M2-1：fee 恒 0，无付费入口 */
    };
    var r = S.saveProvince(rec);
    if (r.error) return r;
    return { ok: true, reused: false, record: rec };
  }

  /* 列出当前用户总代申请（含 rejected，供重提） */
  function listMyApplications(uid, opts) {
    var S = (opts && opts.store) || deps().S;
    uid = uid || currentUid();
    return S.listProvinces().filter(function (a) { return a.uid === uid; });
  }

  /* M2-4 驳回重提：rejected → pending，rejects[] 保留、rejectReason 落盘可见 */
  function resubmit(recordId, payload, opts) {
    opts = opts || {};
    var d = deps(), S = opts.store || d.S;
    var rec = S.getProvince(recordId);
    if (!rec) return { error: 'E_RECORD_NOT_FOUND', msg: '记录不存在' };
    if (rec.status !== 'rejected') return { error: 'E_STATUS_NOT_REJECTED', msg: '仅驳回态可重提' };
    payload = payload || {};
    if (!String(payload.license || rec.license || '').trim()) return { error: 'E_LICENSE_REQUIRED', msg: '请补全营业执照' };
    if (!String(payload.province || rec.province || '').trim()) return { error: 'E_PROVINCE_REQUIRED', msg: '请选择意向授权省' };
    rec.status = 'pending';
    rec.rejectReason = '';
    rec.branchCompany = {
      name: payload.companyName || rec.branchCompany.name,
      uscc: rec.branchCompany.uscc,
      license: payload.license || rec.branchCompany.license,
      legalRep: payload.legalRep || rec.branchCompany.legalRep,
      contact: payload.contact || rec.branchCompany.contact,
      phone: payload.phone || rec.branchCompany.phone || ''
    };
    rec.province = payload.province ? d.R.normalizeProvince(payload.province, opts.quotaCfg && opts.quotaCfg.aliases) : rec.province;
    rec.materials = payload.materials || rec.materials || [];
    rec.statusLog = rec.statusLog || [];
    rec.statusLog.push({ operator: currentUid() || 'self', at: Date.now(), reason: '驳回后补资料重提', fromStatus: 'rejected', toStatus: 'pending' });
    return S.saveProvince(rec);
  }

  /* M2-2 App 侧导入审核种子（落盘 + 重算/刷新由调用方触发） */
  function importSeed(seedText, opts) {
    var d = deps(), B = d.B;
    if (!B) return { ok: false, error: 'E_DEPS_MISSING', msg: 'AgentBridge 未加载' };
    return B.applySeed(seedText, opts || {});
  }

  /* ========================================================================
     T2 二级自助申请（双轨路径②：招商码 → 企业自助申请 → 总代初审 → 平台终审）
     ------------------------------------------------------------------------
     语义（执行计划 §0.5/§0.9-4）：招商绑定不写 Referral 键，仅经招商码关联
     上级总代；落盘复用 sub-agents pending（appliedBy='self' + inviteCode 标记）；
     比例由总代初审时确定（申请时不填）；驳回复用 rejects 数组。
     ======================================================================== */
  function submitSubApplication(payload, opts) {
    opts = opts || {};
    var d = deps(), R = d.R, S = opts.store || d.S, RF = d.RF;
    if (!R || !S || !RF) return { error: 'E_DEPS_MISSING', msg: 'AgentRules/AgentStore/AgentReferral 未加载' };
    payload = payload || {};

    /* ① 招商码有效性：必须存在且 active（作废码不可申请） */
    var code = String(payload.inviteCode || '').trim().toUpperCase();
    var invite = RF.getByCode ? RF.getByCode(code) : null;
    if (!invite || invite.status !== 'active') return { error: 'E_INVITE_INVALID', msg: '招商码无效或已作废，请联系总代重新获取' };

    /* ② 上级总代在册（按招商码 uid 取，active/suspended 均可被申请） */
    var parents = S.listProvinces() || [];
    var parent = null;
    for (var i = 0; i < parents.length; i++) if (parents[i].uid === invite.uid) { parent = parents[i]; break; }
    if (!parent || (parent.status !== 'active' && parent.status !== 'suspended')) {
      return { error: 'E_PARENT_NOT_ACTIVE', msg: '招商总代不在册或已终止，暂不可申请' };
    }

    /* ③ 必填主体信息（企业主体，自然人禁入在 validateSubAgent 内） */
    if (!String(payload.companyName || '').trim()) return { error: 'E_COMPANY_EMPTY', msg: '请填写公司名称' };
    if (!String(payload.uscc || '').trim()) return { error: 'E_USCC_EMPTY', msg: '请填写统一社会信用代码' };
    if (!String(payload.license || '').trim()) return { error: 'E_LICENSE_REQUIRED', msg: '请填写营业执照编号' };
    if (!String(payload.legalRep || '').trim()) return { error: 'E_LEGALREP_EMPTY', msg: '请填写法定代表人' };
    if (!String(payload.contact || '').trim()) return { error: 'E_CONTACT_EMPTY', msg: '请填写联系人' };

    var uid = payload.uid || currentUid();
    if (!uid) return { error: 'E_UID_REQUIRED', msg: '请先登录后提交申请' };
    var uscc = R.normalizeUscc(payload.uscc);

    /* ④ 复用校验纯函数（零改）：自然人/上级在册/自指/双角色/同省/uscc 唯一/名额 */
    var quotaCfg = opts.quotaCfg || {};
    var ctx = { provinceAgents: S.listProvinces(), subAgents: S.listSubs(), quotaCfg: quotaCfg };
    var v = R.validateSubAgent({
      parent: parent, uid: uid, uscc: uscc, province: parent.province,
      ratioToSub: 0, isNaturalPerson: false
    }, ctx);
    if (!v.ok) return { error: v.code, msg: v.msg };

    /* ⑤ 一公司一记录：同 uscc 已绑定（approved/pending/suspended）拦截；rejected 释放复用回退 pending */
    var existing = null;
    for (var j = 0; j < ctx.subAgents.length; j++) {
      var s0 = ctx.subAgents[j];
      if (s0.parentUid !== parent.uid) continue;
      if (R.normalizeUscc(s0.company && s0.company.uscc) === uscc) { existing = s0; break; }
    }
    if (existing) {
      if (existing.status === 'approved' || existing.status === 'pending' || existing.status === 'suspended') {
        return { error: 'E_USCC_DUPLICATE', msg: '该公司已在该总代下在审/在册，不可重复提交' };
      }
      if (existing.status === 'rejected') {
        existing.status = 'pending';
        existing.company = { name: payload.companyName, uscc: uscc, license: payload.license, legalRep: payload.legalRep, contact: payload.contact, phone: payload.phone || '' };
        existing.appliedBy = 'self'; existing.inviteCode = code; existing.appliedAt = Date.now();
        existing.firstReview = null;
        existing.statusLog = existing.statusLog || [];
        existing.statusLog.push({ operator: uid || 'self', at: Date.now(), reason: '驳回后企业重新申请', fromStatus: 'rejected', toStatus: 'pending' });
        var r2 = S.saveSub(existing);
        if (r2.error) return r2;
        if (RF.markUsed) RF.markUsed(code, existing.id);
        logBehavior(d.S, 'sub_apply_resubmitted', { subId: existing.id, uid: uid, inviteCode: code, uscc: uscc }, uid);
        return { ok: true, reused: true, record: existing };
      }
    }

    /* ⑥ 新记录落盘 pending（appliedBy='self' 标记双轨来源） */
    var rec = {
      id: 'sb-' + Date.now().toString(36),
      parentUid: parent.uid,
      uid: uid,
      company: { name: payload.companyName, uscc: uscc, license: payload.license, legalRep: payload.legalRep, contact: payload.contact, phone: payload.phone || '' },
      province: v.province || parent.province,
      ratioToSub: 0,
      status: 'pending',
      appliedBy: 'self', inviteCode: code, appliedAt: Date.now(), firstReview: null,
      statusLog: [{ operator: uid, at: Date.now(), reason: '企业自助申请二级合作', fromStatus: '', toStatus: 'pending' }],
      rejects: [], ratioLog: [],
      signature: { status: 'pending' },
      sealedAt: 0
    };
    var r = S.saveSub(rec);
    if (r.error) return r;
    if (RF.markUsed) RF.markUsed(code, rec.id);
    logBehavior(d.S, 'sub_apply_submitted', { subId: rec.id, uid: uid, inviteCode: code, uscc: uscc, company: payload.companyName }, uid);
    return { ok: true, reused: false, record: rec };
  }

  /* 行为日志（D30，本地长期保留） */
  function logBehavior(S, action, detail, operator) {
    if (!S || typeof S.appendBehavior !== 'function') return;
    try {
      S.appendBehavior({ at: Date.now(), action: action, detail: JSON.stringify(detail || {}), operator: operator || '', subject: operator || '', uid: operator || '' });
    } catch (e) {}
  }

  /* 查询当前用户的二级申请（含状态，供 apply.html 结果展示） */
  function listSubApplications(uid, opts) {
    var S = (opts && opts.store) || deps().S;
    uid = uid || currentUid();
    return (S.listSubs() || []).filter(function (s) { return s.uid === uid && s.appliedBy === 'self'; });
  }

  /* 34 省清单（与 editor.html:700 对齐；港澳台本期不纳入代理体系） */
  var PROVINCE_LIST = ['北京市','天津市','上海市','重庆市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区'];

  function el(html) { var d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; }
  function val(id){ var e=document.getElementById(id); return e?e.value.trim():''; }

  /* H-4：toast 统一三态；优先委托 AgentUI 单一实现，未加载时本地兜底（同 #ag-toast 元素） */
  function applyToast(msg, ok) {
    if (typeof document === 'undefined') return;
    if (window.AgentUI && typeof window.AgentUI.toast === 'function') {
      window.AgentUI.toast(msg, ok);
      return;
    }
    var kind = ok === false ? 'err' : 'ok';
    var variant = kind === 'err' ? ' ag-toast--err' : ' ag-toast--ok';
    var t = document.getElementById('ag-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ag-toast';
      t.className = 'ag-toast';
      document.body.appendChild(t);
    }
    t.className = 'ag-toast ag-toast--show' + variant;
    t.textContent = msg || '';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'ag-toast'; }, 2400);
  }

  /* M2-1 省级总代表单 · 个人实名口径（¥0，无付费入口）；浏览器专用
     页面：pages/profile/entry-form.html?type=provinceAgent
     口径（2026-11）：不采集企业主体（分公司/营业执照/USCC/法人已全部去掉）。
       实名 + 注册手机号由账户自动引用且只读；必填只有「意向授权省」；
       备选联系人/电话与备注选填；主体资料留待审核阶段由商务经理补齐。
     底部 .pa-dock 悬浮操作坞：联系商务经理 + 提交申请（固定于浏览窗底部）。 */
  function mountProvinceForm(container, opts) {
    if (typeof document === 'undefined' || !container) return;
    opts = opts || {};

    /* —— 账户身份（只读引用，不可在表单内改写） —— */
    var u = {};
    try { u = (window.DataBus && typeof DataBus.current === 'function') ? (DataBus.current() || {}) : {}; } catch (e) { u = {}; }
    var rn = (u.auth && u.auth.realname) || {};
    var uid = String(u.id || '');
    var realnameOk = !!rn.ok;
    var realName = String(rn.name || u.name || '').trim();
    var mobileRaw = String(u.mobile || '').replace(/\D/g, '') || String(rn.mobile || '').replace(/\D/g, '');
    var realnameAt = Number(rn.ts) || 0;
    var formed = realnameOk && !!realName && !!mobileRaw;  /* 实名 + 手机号齐备才可提交 */

    function sic(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
    function fmtMobile(m) {
      var d = String(m || '').replace(/\D/g, '');
      return d.length === 11 ? d.slice(0, 3) + ' ' + d.slice(3, 7) + ' ' + d.slice(7) : String(m || '');
    }
    function fmtDate(ts) {
      if (!ts) return '—';
      var d = new Date(ts);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    /* 同账号唯一：个人口径按 uid 去重，已提交/已开通时给出常驻提示 */
    var existing = null;
    try {
      var S = deps().S;
      var rows = (S && typeof S.listProvinces === 'function') ? S.listProvinces() : [];
      for (var i = 0; i < rows.length; i++) { if (rows[i] && rows[i].uid === uid) { existing = rows[i]; break; } }
    } catch (e) { existing = null; }

    var provinceOpts = PROVINCE_LIST.map(function (p) { return '<option value="' + escAttr(p) + '">' + escAttr(p) + '</option>'; }).join('');

    /* —— 申请身份卡：已实名 → 只读展示；未实名 → 阻断态 + 去认证 —— */
    var idBody;
    if (formed) {
      idBody =
        '<div class="pa-idrow">' +
          '<span class="pa-idrow-ic">' + sic('shield') + '</span>' +
          '<div class="pa-idrow-main"><div class="pa-idrow-lb">实名主体</div><div class="pa-idrow-val">' + escAttr(realName) + '</div></div>' +
          '<span class="pa-ok">' + sic('check') + '已实名</span>' +
        '</div>' +
        '<div class="pa-idrow">' +
          '<span class="pa-idrow-ic">' + sic('phone') + '</span>' +
          '<div class="pa-idrow-main"><div class="pa-idrow-lb">注册手机号</div><div class="pa-idrow-val">' + escAttr(fmtMobile(mobileRaw)) + '</div></div>' +
        '</div>' +
        '<div class="pa-hint">' + sic('info') + '<span>实名与手机号随账户自动带入，不可在此修改；如信息有误请前往 <a href="auth-personal.html">实名认证</a>。</span></div>';
    } else if (!uid) {
      idBody =
        '<div class="pa-gate">' +
          '<span class="pa-gate-ic">' + sic('alert') + '</span>' +
          '<div class="pa-gate-main"><div class="pa-gate-title">尚未登录</div>' +
          '<div class="pa-gate-sub">登录后自动引用账户实名与注册手机号。</div></div>' +
          '<button type="button" class="pa-gate-btn" onclick="location.href=\'../auth/login.html\'">去登录</button>' +
        '</div>';
    } else {
      idBody =
        '<div class="pa-gate">' +
          '<span class="pa-gate-ic">' + sic('alert') + '</span>' +
          '<div class="pa-gate-main"><div class="pa-gate-title">未完成个人实名认证</div>' +
          '<div class="pa-gate-sub">省代申请以实名主体发起，完成认证后即可提交。</div></div>' +
          '<button type="button" class="pa-gate-btn" onclick="location.href=\'auth-personal.html\'">去实名认证</button>' +
        '</div>' +
        '<div class="pa-hint">' + sic('info') + '<span>实名信息仅用于主体核验，不会在申请页展示证件号码。</span></div>';
    }

    /* —— 已提交过：常驻提示（pending / active / suspended） —— */
    var existNote = '';
    if (existing && (existing.status === 'pending' || existing.status === 'active' || existing.status === 'suspended')) {
      var stTxt = existing.status === 'active' ? '已开通' : (existing.status === 'suspended' ? '已暂停' : '审核中');
      existNote =
        '<section class="pa-card">' +
          '<div class="pa-idrow" style="border-bottom:none;padding-bottom:2px;">' +
            '<span class="pa-idrow-ic">' + sic('clock') + '</span>' +
            '<div class="pa-idrow-main"><div class="pa-idrow-lb">本账号已有省代申请</div>' +
            '<div class="pa-idrow-val" style="font-size:13px;">' + escAttr(existing.province || '—') + ' · ' + stTxt + '</div></div>' +
            '<a class="pa-link" href="entry-review.html">查看进度</a>' +
          '</div>' +
        '</section>';
    }

    container.innerHTML =
      '<div class="pa-form">' +
        '<section class="pa-hero">' +
          '<div class="pa-hero-top">' +
            '<span class="pa-hero-eyebrow">' + sic('award') + '省级总代 · 一省独家</span>' +
            '<span class="pa-hero-fee"><b>¥0</b><span>免费申请</span></span>' +
          '</div>' +
          '<div class="pa-hero-title">申请成为省级总代</div>' +
          '<div class="pa-hero-sub">个人实名即可发起申请，企业主体资料由商务经理在审核阶段协助补齐。通过后开通本省独家授权。</div>' +
          '<div class="pa-flow">' +
            '<span class="pa-flow-step is-now"><span class="pa-flow-num">1</span>填写申请</span>' +
            '<span class="pa-flow-line"></span>' +
            '<span class="pa-flow-step"><span class="pa-flow-num">2</span>商务对接</span>' +
            '<span class="pa-flow-line"></span>' +
            '<span class="pa-flow-step"><span class="pa-flow-num">3</span>审核开通</span>' +
          '</div>' +
        '</section>' +
        existNote +
        '<section class="pa-card">' +
          '<div class="pa-card-hd"><span class="pa-card-title">申请身份</span>' +
            '<span class="pa-card-tag ' + (formed ? 'pa-card-tag--req' : '') + '">' + (formed ? '需实名' : '待完成') + '</span></div>' +
          idBody +
        '</section>' +
        '<section class="pa-card">' +
          '<div class="pa-card-hd"><span class="pa-card-title">备选联系方式</span><span class="pa-card-tag pa-card-tag--opt">选填</span></div>' +
          '<div class="pa-field"><label for="pa-alt-contact">备选联系人</label>' +
            '<input id="pa-alt-contact" type="text" maxlength="20" autocomplete="off" placeholder="如：合伙人姓名"></div>' +
          '<div class="pa-field" id="w-pa-alt-phone"><label for="pa-alt-phone">备选电话</label>' +
            '<input id="pa-alt-phone" type="tel" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="11 位手机号"></div>' +
          '<div class="pa-err pa-err--block" id="e-pa-alt-phone"></div>' +
          '<div class="pa-hint">' + sic('info') + '<span>首选联系号码为注册手机号；备选号码仅在无人接听时使用。</span></div>' +
        '</section>' +
        '<section class="pa-card">' +
          '<div class="pa-card-hd"><span class="pa-card-title">意向授权省</span><span class="pa-card-tag pa-card-tag--req">必选</span></div>' +
          '<div id="pa-conflict" class="ag-banner-err" hidden>' +
            '<svg class="ag-banner-err__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>' +
            '<span id="pa-conflict-tx"></span>' +
          '</div>' +
          '<div class="pa-select-wrap" id="w-pa-province">' +
            '<select id="pa-province" class="pa-select" aria-label="意向授权省"><option value="">请选择意向授权省</option>' + provinceOpts + '</select>' +
          '</div>' +
          '<div class="pa-err pa-err--block" id="e-pa-province"></div>' +
          '<div class="pa-prov-note">' + sic('info') + '<span>一省仅授权一家，已被占用的省份不可重复开通。</span></div>' +
        '</section>' +
        '<section class="pa-card">' +
          '<div class="pa-card-hd"><span class="pa-card-title">备注</span><span class="pa-card-tag pa-card-tag--opt">选填</span></div>' +
          '<textarea id="pa-remark" class="pa-ta" maxlength="200" placeholder="可补充区域资源、渠道团队、合作计划等，便于商务经理评估"></textarea>' +
          '<div class="pa-ta-count" id="pa-ta-count">0/200</div>' +
        '</section>' +
      '</div>';

    /* —— 底部悬浮操作坞（挂在 .phone 上，等同窗口底部固定） —— */
    var phone = container.closest ? container.closest('.phone') : null;
    var prevDock = phone ? phone.querySelector('.pa-dock') : null;
    if (prevDock) prevDock.parentNode.removeChild(prevDock);
    var dock = el('<div class="pa-dock">' +
      '<button type="button" class="pa-dock-contact" id="pa-contact">' + sic('headset') + '联系商务经理</button>' +
      '<button type="button" class="pa-dock-submit" id="pa-submit">提交申请</button>' +
    '</div>');
    if (phone) phone.appendChild(dock);
    function dropDock() { if (dock && dock.parentNode) dock.parentNode.removeChild(dock); }

    var submitBtn = dock.querySelector('#pa-submit');
    /* 未实名即锁定提交（点击仍给出口，避免灰按钮无反馈） */
    if (!formed) { submitBtn.disabled = true; submitBtn.textContent = '请先完成实名认证'; }
    else if (existing && (existing.status === 'pending' || existing.status === 'active' || existing.status === 'suspended')) {
      submitBtn.disabled = true;
      submitBtn.textContent = existing.status === 'pending' ? '申请审核中'
        : (existing.status === 'active' ? '本省省代已开通' : '省代账号已暂停');
    }

    var contactBtn = dock.querySelector('#pa-contact');
    if (contactBtn) {
      contactBtn.onclick = function () {
        /* 复用既有客服弹窗，只把身份文案换成商务经理（不新建样式） */
        if (window.UI && typeof UI.openKefu === 'function') UI.openKefu({ role: 'manager' });
        else if (typeof window.openKefu === 'function') window.openKefu({ role: 'manager' });
      };
    }

    /* —— 内联校验：红框 + 行下文案（错误码仍以引擎为准） —— */
    function setProvErr(msg) {
      var w = container.querySelector('#w-pa-province'), e = container.querySelector('#e-pa-province');
      if (w) w.classList.toggle('is-err', !!msg);
      if (e) e.textContent = msg || '';
    }
    function setPhoneErr(msg) {
      var w = container.querySelector('#w-pa-alt-phone'), e = container.querySelector('#e-pa-alt-phone');
      if (w) w.classList.toggle('is-err', !!msg);
      if (e) e.textContent = msg || '';
    }
    /* M2-6 持久冲突红条：同省已有在册独家总代时留在表单内，不随 toast 消失 */
    function showConflict(msg) {
      var box = container.querySelector('#pa-conflict'), tx = container.querySelector('#pa-conflict-tx');
      if (!box) return;
      if (tx) tx.textContent = msg;
      box.hidden = false;
    }
    function hideConflict() {
      var box = container.querySelector('#pa-conflict');
      if (box) box.hidden = true;
    }

    var provSel = container.querySelector('#pa-province');
    if (provSel) {
      provSel.addEventListener('change', function () { setProvErr(''); hideConflict(); });
    }
    var altPhone = container.querySelector('#pa-alt-phone');
    if (altPhone) {
      altPhone.addEventListener('input', function () {
        /* 只留数字，便于逐位输入 */
        var d = String(altPhone.value || '').replace(/\D/g, '').slice(0, 11);
        if (this.value !== d) this.value = d;
        setPhoneErr('');
      });
    }
    var remark = container.querySelector('#pa-remark');
    var count = container.querySelector('#pa-ta-count');
    if (remark && count) {
      remark.addEventListener('input', function () {
        count.textContent = remark.value.length + '/200';
      });
    }

    submitBtn.onclick = function () {
      if (!formed) {
        applyToast(!uid ? '请先登录后再申请' : '请先完成个人实名认证后再申请省代', false);
        return;
      }
      var province = val('pa-province');
      var altC = val('pa-alt-contact');
      var altP = val('pa-alt-phone');
      var remarkTx = val('pa-remark');
      setProvErr(''); setPhoneErr(''); hideConflict();

      var bad = false;
      if (!province) { setProvErr('请选择意向授权省'); bad = true; }
      if (altP && !/^1[3-9]\d{9}$/.test(altP)) { setPhoneErr('请填写 11 位有效手机号'); bad = true; }
      if (bad) {
        var first = container.querySelector('.pa-select-wrap.is-err, .pa-field.is-err');
        if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }

      submitBtn.disabled = true;
      var r = submitProvinceApplication({
        personal: true, uid: uid,
        realnameOk: realnameOk, realName: realName, mobile: mobileRaw, realnameAt: realnameAt,
        altContact: altC, altPhone: altP,
        province: province, remark: remarkTx
      }, { quotaCfg: opts.quotaCfg });

      if (r && r.ok) {
        dropDock();
        var rec = (r.item || r.record || r.agent || r.data || {});
        container.innerHTML =
          '<section class="pa-card" style="padding:0">' +
          '<div class="pa-done">' +
            '<div class="pa-done-ic">' + sic('check') + '</div>' +
            '<div class="pa-done-title">申请已提交</div>' +
            '<div class="pa-done-sub">商务经理将在 1-3 个工作日内与你联系核验资料。¥0 免费审核，通过后开通本省独家授权。</div>' +
            '<div class="pa-done-meta">' +
              '<div class="pa-done-meta-row"><span>意向授权省</span><span>' + escAttr(province) + '</span></div>' +
              '<div class="pa-done-meta-row"><span>申请主体</span><span>' + escAttr(realName) + '</span></div>' +
              '<div class="pa-done-meta-row"><span>联系电话</span><span>' + escAttr(fmtMobile(mobileRaw)) + '</span></div>' +
              '<div class="pa-done-meta-row"><span>提交时间</span><span>' + escAttr(fmtDate((rec && rec.createdAt) || Date.now())) + '</span></div>' +
              '<div class="pa-done-meta-row"><span>当前状态</span><span>待审核</span></div>' +
            '</div>' +
            '<div class="pa-done-acts">' +
              '<button type="button" class="ag-btn ag-btn--primary" onclick="location.href=\'entry-review.html\'">查看申请进度</button>' +
              '<button type="button" class="ag-btn ag-btn--ghost" onclick="location.href=\'entry.html\'">返回入驻中心</button>' +
            '</div>' +
          '</div>' +
          '</section>';
        applyToast('申请已提交，等待平台审核', true);
        return;
      }

      submitBtn.disabled = false;
      var code = (r && (r.error || r.code)) || '';
      var txt = (r && r.msg) || '提交失败';
      if (code === 'E_PROVINCE_TAKEN') {
        txt = '该省已独家授权，不可重复开通';
        showConflict('该省已有在册省级总代（省独家），不可重复开通；请更换意向授权省。');
      } else if (code === 'E_PROVINCE_REQUIRED') {
        setProvErr(txt);
      } else if (code === 'E_ALREADY_AGENT' || code === 'E_APPLY_PENDING') {
        showConflict(txt);
      }
      applyToast(txt, false);
    };
  }

  /* M2-2 App 侧「导入审核种子」面板（方案A：粘贴 admin 导出的审核种子 JSON） */
  function mountSeedImport(container, opts) {
    if (typeof document === 'undefined' || !container) return;
    opts = opts || {};
    container.innerHTML =
      '<section class="ag-card">'+
        '<h3>后台导入审核记录</h3>'+
        '<div class="ag-meta" style="line-height:1.7;">将后台导出的审核记录内容粘贴到此处完成登记落盘；仅平台内部使用。</div>'+
        '<textarea id="si-text" rows="5" class="ag-input" placeholder=\'{"schema":"engchain-agent-seed/1","actions":[...]}\' style="margin-top:10px;"></textarea>'+
        '<div id="si-msg" class="ag-meta" style="margin-top:10px;"></div>'+
        '<div class="ag-actions" style="margin-top:10px;"><button class="ag-btn ag-btn--primary" id="si-btn">导入并落盘</button></div>'+
      '</section>';
    container.querySelector('#si-btn').onclick=function(){
      var r=importSeed(container.querySelector('#si-text').value, { quotaCfg: opts.quotaCfg });
      var box=container.querySelector('#si-msg');
      if(r.ok){ applyToast('导入成功：'+r.applied.length+' 个动作已落盘，可刷新查看身份/省/名额。', true); box.textContent=''; }
      else { applyToast('导入失败：'+(r.failed&&r.failed[0]?r.failed[0].msg:(r.error||'未知错误'))+'（未写入任何记录）', false); box.textContent=''; }
    };
  }

  /* M2-4 我的省代申请列表：pending/rejected 可见，驳回原因落盘，驳回可重提 */
  function mountMyApplications(container, opts) {
    if (typeof document === 'undefined' || !container) return;
    opts = opts || {};
    function draw() {
      var mine = listMyApplications(opts.uid, opts);
      if (!mine.length) { container.innerHTML = '<div class="ag-empty"><div class="ag-empty__title">暂无省级总代申请</div>'
        + '<div class="ag-empty__sub">提交省级总代（省代）申请后，进度将在此展示。</div></div>'; return; }
      var statusMap = { pending: ['待审核', 'ag-st-pending'], active: ['已生效', 'ag-st-active'], suspended: ['已暂停', 'ag-st-suspended'], rejected: ['已驳回', 'ag-st-terminated'], terminated: ['已终止', 'ag-st-terminated'], revoked: ['已清退', 'ag-st-revoked'], approved: ['已通过', 'ag-st-active'] };
      var provOpts = PROVINCE_LIST.map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('');
      container.innerHTML = '<section class="ag-card"><h3>我的省级总代申请</h3>' +
        mine.map(function (a) {
          var st = statusMap[a.status] || [a.status, ''];
          var rj = a.status === 'rejected' ? '<div class="ag-field-err" style="display:block;margin-top:6px;">驳回原因：' + (a.rejectReason || '—') + '</div>' : '';
          /* D-3：驳回态补资料小表单（执照号/公司名/意向省），patch 合并后再重提；缺执照不再按钮失效
             个人实名口径无企业主体，不给执照补填表单，直接回到申请页重提（原记录复用回退 pending） */
          var patchForm = a.status === 'rejected'
            ? (a.applyMode === 'personal'
              ? '<div class="ag-actions" style="margin-top:8px;"><a class="ag-btn ag-btn--primary ag-btn--sm" href="entry-form.html?type=provinceAgent">重新提交申请</a></div>'
              : '<div class="ag-field" style="margin-top:10px;"><label>营业执照编号（必填）</label>'
              + '<input id="rl-' + a.id + '" class="ag-input" placeholder="补填营业执照编号" value="' + escAttr(a.branchCompany && a.branchCompany.license || '') + '">'
              + '<div class="ag-field-err"></div></div>'
              + '<div class="ag-field"><label>公司名称</label>'
              + '<input id="rc-' + a.id + '" class="ag-input" placeholder="补填公司名称" value="' + escAttr(a.branchCompany && a.branchCompany.name || '') + '"></div>'
              + '<div class="ag-field"><label>意向授权省</label>'
              + '<select id="rp-' + a.id + '" class="ag-input"><option value="">请选择省份</option>'
              + PROVINCE_LIST.map(function(p){return '<option value="'+p+'"'+(p===a.province?' selected':'')+'>'+p+'</option>';}).join('')
              + '</select><div class="ag-field-err"></div></div>'
              + '<div class="ag-actions" style="margin-top:8px;"><button class="ag-btn ag-btn--primary ag-btn--sm" onclick="AgentApply._resubmitForm(\'' + a.id + '\')">补资料并重新提交</button></div>')
            : '';
          /* P0-5：已生效卡补「进入工作台」CTA（suspended 仍可进入只读视图） */
          var activeCta = (a.status === 'active' || a.status === 'suspended')
            ? '<div class="ag-actions" style="margin-top:8px;"><a class="ag-btn ag-btn--primary ag-btn--sm" href="../province-agent/uni/pages/home.html">进入工作台</a></div>'
            : '';
          return '<div class="ag-member" style="align-items:flex-start;flex-direction:column;gap:6px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">' +
            '<div class="ag-member__main"><div class="ag-member__name">' + ((a.applicant && a.applicant.name) || (a.branchCompany && a.branchCompany.name) || '—') + '</div>' +
            '<div class="ag-member__sub">授权省：' + (a.province || '—') + (a.applyMode === 'personal' ? ' · 个人实名申请' : '') + '</div>' + rj + '</div>' +
            '<span class="ag-badge ' + (st[1] || '') + '">' + st[0] + '</span></div>' +
            patchForm + activeCta + '</div>';
        }).join('') + '</section>';
    }
    AgentApply._resubmit = function (id) {
      var r = resubmit(id, {}, opts);
      if (r.ok) { draw(); applyToast('已补资料重新提交', true); if (opts.onChange) opts.onChange(); }
      else applyToast(r.msg || r.error || '重提失败', false);
    };
    /* D-3：读取补资料小表单，patch 合并后重提；缺执照内联提示 */
    AgentApply._resubmitForm = function (id) {
      var license = (container.querySelector('#rl-' + id) || {}).value || '';
      var companyName = (container.querySelector('#rc-' + id) || {}).value || '';
      var province = (container.querySelector('#rp-' + id) || {}).value || '';
      license = license.trim(); companyName = companyName.trim(); province = province.trim();
      if (!license) { applyToast('请先补填营业执照编号', false); return; }
      var r = resubmit(id, { license: license, companyName: companyName, province: province }, opts);
      if (r.ok) { draw(); applyToast('已补资料重新提交', true); if (opts.onChange) opts.onChange(); }
      else applyToast(r.msg || r.error || '重提失败', false);
    };
    draw();
  }

  var api = {
    submitProvinceApplication: submitProvinceApplication,
    listMyApplications: listMyApplications,
    resubmit: resubmit,
    importSeed: importSeed,
    submitSubApplication: submitSubApplication,
    listSubApplications: listSubApplications,
    mountProvinceForm: mountProvinceForm,
    mountSeedImport: mountSeedImport,
    mountMyApplications: mountMyApplications,
    PROVINCE_LIST: PROVINCE_LIST
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentApply = api;
})(typeof window !== 'undefined' ? window : globalThis);
