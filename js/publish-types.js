/* ================================================================
 * publish-types.js — 16类信息注册表（详细8类 + 简要8类）
 * 被以下页面共用：
 *   - pages/publish/choose.html  （发布前类型选择页，按详细/简要分组）
 *   - pages/publish/editor.html  （详细类：按 type 渲染专属结构）
 *   - pages/publish/brief-editor.html （简要类：一句话AI分析+文件发布）
 *
 * 命名口径（2026-10-09 与用户确认）：
 *   详细类：材料-供应 / 劳务-供应 / 设备-供应 / 运输-供应 / 建筑企业-招商 /
 *          建企转让-需求 / 人才-招聘 / 提供服务-中介
 *   简要类：材料-需求 / 劳务-需求 / 设备-需求 / 运输-需求 /
 *          加盟或单项目挂靠-需求 / 收购或控股建筑企业-需求 / 人才应聘-需求 / 找中介服务-需求
 * 判定逻辑：长期存在方 / 先发生方发布详细类；一次性意向方发布简要类。
 * 招标不单独成类，发布详细类的需求即承载招标语义。
 * ================================================================ */
(function (global) {
  var PUBLISH_TYPES = {

    /* ===================== 详细类（8）：企业认证即可发布 ===================== */
    'material-supply': {
      cat: '材料', role: 'supply', group: 'supply', detailLevel: 'detail',
      label: '材料-供应', sub: '卖建材',
      guideLabel: '我有材料要卖', guideSub: '材料生产企业 / 经销商发布供应',
      nav: '发布材料供应', desc: '你有材料要卖'
    },
    'labor-supply': {
      cat: '劳务', role: 'supply', group: 'supply', detailLevel: 'detail',
      label: '劳务-供应', sub: '班组供应 / 分包承接',
      guideLabel: '我有班组要接活', guideSub: '劳务公司 / 班组长发布供应',
      nav: '发布劳务供应', desc: '你有班组要接活'
    },
    'equipment-supply': {
      cat: '设备', role: 'supply', group: 'supply', detailLevel: 'detail',
      label: '设备-供应', sub: '塔吊/挖机/脚手架等',
      guideLabel: '我有设备可租可卖', guideSub: '租赁公司 / 机主发布供应',
      nav: '发布设备供应', desc: '你有设备要出租或出售'
    },
    'transport-supply': {
      cat: '运输', role: 'supply', group: 'supply', detailLevel: 'detail',
      label: '运输-供应', sub: '砂石/混凝土/设备运输',
      guideLabel: '我有车队运力', guideSub: '物流 / 运输公司发布供应',
      nav: '发布运输供应', desc: '你有车队、线路与运力'
    },
    'franchise-supply': {
      cat: '资质招商', role: 'supply', group: 'resource', detailLevel: 'detail',
      label: '建筑企业-招商', sub: '加盟招商 / 单项目合作',
      guideLabel: '我司招加盟 / 单项目合作', guideSub: '总公司招商，长期合作',
      nav: '发布招商', desc: '招加盟、开分公司、单项目合作'
    },
    'trade-supply': {
      cat: '建企买卖', role: 'supply', group: 'resource', detailLevel: 'detail',
      label: '建企转让-需求', sub: '转让公司股权与资质',
      guideLabel: '我要转让公司', guideSub: '转让公司股权与资质',
      nav: '发布建企转让', desc: '转让公司、资质，找买家'
    },
    'personnel-demand': {
      cat: '招聘', role: 'demand', group: 'resource', detailLevel: 'detail',
      label: '人才-招聘', sub: '企业招人',
      guideLabel: '企业方，我要招人', guideSub: '发布详细招聘岗位',
      nav: '发布招聘', desc: '企业发岗位，收简历'
    },
    'agency-supply': {
      cat: '中介服务', role: 'supply', group: 'supply', detailLevel: 'detail',
      label: '提供服务-中介', sub: '资质代办/担保/咨询',
      guideLabel: '我是服务商，提供服务', guideSub: '资质代办 / 咨询等中介服务',
      nav: '发布中介服务', desc: '中介服务商挂服务菜单',
      viaSeller: true
    },

    /* ===================== 简要类（8）：个人认证即可发布 ===================== */
    'material-demand': {
      cat: '材料', role: 'demand', group: 'supply', detailLevel: 'brief',
      label: '材料-需求', sub: '一句话采购',
      guideLabel: '我要采购材料', guideSub: '项目采购询价，一句话发布',
      nav: '发布材料需求', desc: '你要采购材料'
    },
    'labor-demand': {
      cat: '劳务', role: 'demand', group: 'supply', detailLevel: 'brief',
      label: '劳务-需求', sub: '一句话用工',
      guideLabel: '我要找工人干活', guideSub: '项目分包 / 找班组，一句话发布',
      nav: '发布用工需求', desc: '你要找工人干活'
    },
    'equipment-demand': {
      cat: '设备', role: 'demand', group: 'supply', detailLevel: 'brief',
      label: '设备-需求', sub: '买卖 / 租赁一句话',
      guideLabel: '我要租或买设备', guideSub: '项目急租 / 采购，一句话发布',
      nav: '发布设备需求', desc: '你要租或买设备'
    },
    'transport-demand': {
      cat: '运输', role: 'demand', group: 'supply', detailLevel: 'brief',
      label: '运输-需求', sub: '租赁 / 承包一句话',
      guideLabel: '我要用车运输', guideSub: '项目运输 / 租赁承包，一句话发布',
      nav: '发布运输需求', desc: '你要用车运输'
    },
    'franchise-demand': {
      cat: '资质招商', role: 'demand', group: 'resource', detailLevel: 'brief',
      label: '加盟或单项目挂靠-需求', sub: '想挂靠 / 加盟',
      guideLabel: '我想加盟或挂靠', guideSub: '加入总公司 / 单项目挂靠',
      nav: '发布加盟意向', desc: '你想找资质合作，发需求'
    },
    'trade-demand': {
      cat: '建企买卖', role: 'demand', group: 'resource', detailLevel: 'brief',
      label: '收购或控股建筑企业-需求', sub: '收购带资质公司',
      guideLabel: '我要收购公司', guideSub: '收购 / 控股建筑企业',
      nav: '发布收购意向', desc: '买公司、控股，提收购意向'
    },
    'talent-supply': {
      cat: '求职', role: 'demand', group: 'resource', detailLevel: 'brief',
      label: '人才应聘-需求', sub: '一句话求职 + 简历',
      guideLabel: '个人，我要找工作', guideSub: '求职简历 / 求职意向',
      nav: '发布应聘', desc: '人才发求职意向，等企业联系'
    },
    'agency-demand': {
      cat: '中介服务', role: 'demand', group: 'supply', detailLevel: 'brief',
      label: '找中介服务-需求', sub: '资质新办 / 担保一句话',
      guideLabel: '我要找中介办事', guideSub: '找中介代办 / 咨询服务',
      nav: '发布找中介需求', desc: '你要办资质、找担保等'
    },

  };

  /* 当前身份可发布的 16 类列表（按新权限口径）：
     - 游客/未认证：不可发布
     - 个人认证（实名）/个人入驻：仅简要类（应聘类个人仅人才应聘-需求）
     - 企业认证/入驻：详细类 + 简要类
     - 单一合伙人身份：仅分销推荐，不直接发布（返回空） */
  function availableTypesByAccount(acc) {
    var out = [];
    try {
      /* acc 为 entryAccess() 返回对象（含 identity=deriveIdentity() 结果） */
      var idy = (acc && acc.identity) ? acc.identity : {};
      var isEnterprise = idy.enterprise === 'verified' || idy.enterprise === 'resident';
      var isPersonal = idy.personal === 'verified' || idy.personal === 'professional' || idy.personal === 'full';
      var isApplicant = idy.personal === 'professional' || idy.personal === 'full';
      var isPurePartner = idy.personal === 'partner' && !isEnterprise;
      if (isPurePartner) return out; /* 单一合伙人身份仅分销推荐，不直接发布 */
      Object.keys(PUBLISH_TYPES).forEach(function (k) {
        var t = PUBLISH_TYPES[k];
        if (t.hide) return;
        if (t.detailLevel === 'detail' && !isEnterprise) return;
        if (t.detailLevel === 'brief' && !isEnterprise && !isPersonal) return;
        /* 人才应聘-需求仅应聘类个人可发（企业侧不代发求职） */
        if (t.cat === '求职' && !isApplicant) return;
        out.push(k);
      });
    } catch (e) { out = []; }
    return out;
  }

  /* type → 编辑器 URL（简要类 → brief-editor.html，详细类 → editor.html） */
  function editorHref(typeKey) {
    var t = PUBLISH_TYPES[typeKey];
    if (!t || t.hide) return 'choose.html';
    var q = 'type=' + encodeURIComponent(typeKey);
    if (t.viaSeller) q += '&via=seller';
    return (t.detailLevel === 'brief' ? 'brief-editor.html?' : 'editor.html?') + q;
  }

  /* 兼容旧接口：按角色返回可发 type（choose.html 新版改用 availableTypesByAccount） */
  function availableTypes(acc, role) {
    var all = availableTypesByAccount(acc);
    return all.filter(function (k) { return !role || PUBLISH_TYPES[k].role === role; });
  }

  global.PUBLISH_TYPES = PUBLISH_TYPES;
  global.publishTypeHref = editorHref;
  global.availablePublishTypes = availableTypes;
  global.availableTypesByAccount = availableTypesByAccount;
})(window);
