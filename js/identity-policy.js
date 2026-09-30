/* ============================================================================
   工程链 ENGCHAIN — 产品身份适用策略（唯一权威 · 纯策略 · 零业务写入）
   ----------------------------------------------------------------------------
   v2（2026-09-27）：单账号 · 资质挂载 · 外显分离。
   本文件只做"某产品/动作对【当前本人资质】是否开放"的只读判定，供页面门控统一调用。
   它【绝不】读写任何资质 Store，也【绝不】依据组织任职（OrgsStore）授予个人权益：
     · 个人权益：只来自 stores.js 的 deriveIdentity()/entryAccess()/publishableCats()；
     · 组织任职：只决定"能否以某企业名义署名"（canActForOrg），不改变个人是否有资质；
     · 外显身份 displayOrgId：仅名称展示，零权益含义，本文件不让其影响任何 allow 结果。

   对接约定：
     IdentityPolicy.access(featureKey)  -> { allow, reason, acc }
     IdentityPolicy.canPublish(category, role) -> Boolean
     IdentityPolicy.canActForOrg(orgId, actionKey) -> Boolean   // 任职 + 本人资质双校验
     IdentityPolicy.displaySubject()   -> { kind, orgId, name, co, role }   // 纯外显
   任何 allow=false 的 reason 均可直接用于门控弹层/引导文案。
============================================================================ */
window.IdentityPolicy = (function () {
  'use strict';

  function acc() {
    try { return (window.entryAccess && entryAccess()) || null; } catch (e) { return null; }
  }
  function isGuest(a) {
    if (a && a.statusId === 'guest') return true;
    try { return !!(window.DataBus && DataBus.isGuest && DataBus.isGuest()); } catch (e) { return false; }
  }
  function deny(reason, a) { return { allow: false, reason: reason, acc: a || acc() }; }
  function pass(a) { return { allow: true, reason: '', acc: a || acc() }; }

  /* 中文引导文案集中处（仅在门控需要时引用，不主动弹窗） */
  var R = {
    login: '请先登录后再使用该功能',
    realname: '完成实名认证后即可使用',
    qualify: '需完成对应个人或企业资质认证',
    resident: '该功能面向已完成企业入驻的账号',
    agency: '该功能面向已入驻「中介」类型的企业',
    team: '团队管理仅向合伙人类型的企业入驻账号开放',
    esign: '电子签面向企业入驻用户或个人合伙人开放',
    publish: '当前身份暂不支持发布该品类',
    actFor: '需在该企业任职且本人具备对应企业资质，才能以该企业名义操作',
    platform: '该入口仅限平台内部运营人员使用'
  };

  /* 功能 -> 本人资质要求。判定全部基于 entryAccess 的只读字段，不读外显、不读任职。 */
  var FEATURES = {
    /* 分销中心：企业入驻 或 个人合伙人（acc.dist） */
    distribution:        function (a, g) { if (g) return R.login; return a.dist ? '' : R.resident; },
    /* 分销-团队管理：仅企业入驻且入驻类型含 partner（个人合伙人无团队） */
    'distribution:team': function (a, g) { if (g) return R.login; return a.hasTeam ? '' : R.team; },
    /* 中介服务工作台：企业入驻且类型含 agency */
    agency:              function (a, g) { if (g) return R.login; return a.agency ? '' : R.agency; },
    /* 企业发票抬头 / 对公信息：企业入驻 */
    'invoice:corp':      function (a, g) { if (g) return R.login; return a.isResident ? '' : R.resident; },
    /* 对公提现：企业入驻 */
    'withdraw:corp':     function (a, g) { if (g) return R.login; return a.isResident ? '' : R.resident; },
    /* 电子签：企业入驻 或 个人合伙人（与 EsignStore.canUse 同口径） */
    esign:               function (a, g) {
      if (g) return R.login;
      var can = false;
      try { can = window.EsignStore && typeof EsignStore.canUse === 'function' ? !!EsignStore.canUse() : !!a.dist; } catch (e) { can = !!a.dist; }
      return can ? '' : R.esign;
    },
    /* 招聘-我发布的职位/招聘工作台：企业认证或入驻（中介类型除外，由品类层再校） */
    recruit:             function (a, g) {
      if (g) return R.login;
      var ent = a.identity && a.identity.enterprise;
      return (ent === 'verified' || ent === 'resident') ? '' : R.qualify;
    },
    /* 平台运营台：仅平台内部人员（DataBus.isPlatformStaff），与 C/B 端身份正交 */
    'platform:dashboard': function (a, g) {
      if (g) return R.login;
      try { if (window.DataBus && DataBus.isPlatformStaff && DataBus.isPlatformStaff()) return ''; } catch (e) {}
      return R.platform;
    }
  };

  function access(featureKey) {
    var a = acc();
    var guest = isGuest(a);
    /* 未提供 a（stores 未就绪）保守不放行 */
    if (!a) return deny(guest ? R.login : R.qualify, a);
    if (guest) return deny(R.login, a);
    var fn = FEATURES[featureKey];
    if (!fn) {
      /* 未知功能键：默认登录即可（不替业务放大企业向权益），具体门控应由调用方另判 */
      return pass(a);
    }
    var reason = fn(a, false);
    return reason ? deny(reason, a) : pass(a);
  }

  /* 品类发布：直接委托唯一矩阵 publishableCats；role='demand'|'supply' */
  function canPublish(category, role) {
    var a = acc(); if (!a) return false;
    try {
      var cats = window.publishableCats ? publishableCats(a, role === 'supply' ? 'supply' : 'demand') : [];
      return cats.indexOf(category) >= 0;
    } catch (e) { return false; }
  }

  /* 外显署名主体（纯展示）：委托 OrgsStore.displaySubject */
  function displaySubject() {
    try {
      if (window.OrgsStore && OrgsStore.displaySubject) return OrgsStore.displaySubject();
    } catch (e) {}
    var name = '';
    try { name = (window.DataBus && DataBus.current && DataBus.current()) ? (DataBus.current().name || '') : ''; } catch (e) {}
    return { kind: 'personal', orgId: null, name: name, co: '', role: '' };
  }

  /* 以某企业名义执行动作：①在该企业有 active 任职 且 ②本人具备对应企业向资质。
     两道都过才 true。任职由 OrgsStore 校验，资质由本人 entryAccess 校验（见 OrgsStore.canActFor）。
     注意：这只决定"能否署名该企业"，不向个人发放任何其本不具备的资质。 */
  function canActForOrg(orgId, actionKey) {
    try {
      if (window.OrgsStore && OrgsStore.canActFor) return !!OrgsStore.canActFor(orgId, actionKey);
    } catch (e) {}
    return false;
  }

  /* 产品适用面标签（人读，配合《产品身份适用矩阵》文档）：
     'all' 通用 / 'personal' 仅个人资质线 / 'enterprise' 企业向（认证或入驻）/ 'resident' 须企业入驻 */
  function audienceOf(featureKey) {
    var map = {
      distribution: 'all',            /* 企业入驻 或 个人合伙人 */
      'distribution:team': 'resident',
      agency: 'resident',
      'invoice:corp': 'resident',
      'withdraw:corp': 'resident',
      esign: 'all',
      recruit: 'enterprise'
    };
    return map[featureKey] || 'all';
  }

  return {
    access: access,
    canPublish: canPublish,
    canActForOrg: canActForOrg,
    displaySubject: displaySubject,
    audienceOf: audienceOf,
    reasons: R
  };
})();
