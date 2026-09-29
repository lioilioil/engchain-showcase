/* ================================================================
 * publish-types.js — 9类信息 × 供需方向 → 16个发布意图(type)注册表
 * 被以下页面共用：
 *   - pages/publish/choose.html  （发布前类型选择页）
 *   - pages/publish/editor.html  （按 type 锁定品类与方向，渲染专属结构）
 *
 * 命名口径（与用户确认）：
 *   资源对接类：资质招商/寻找加盟、公司转让/收购、招聘/求职
 *   供需对接类：材料/设备/劳务/项目合作/中介服务 的 供给侧 与 需求侧
 * 中介需求侧（找中介服务）本期开放，见 publishableCats。
 * ================================================================ */
(function (global) {
  var PUBLISH_TYPES = {
    /* ---------- 资源对接类 ---------- */
    'franchise-supply': {
      cat: '资质招商', role: 'supply', group: 'resource',
      label: '资质招商', sub: '招区域加盟 / 分公司合作',
      nav: '发布资质招商', desc: '你有资质，招加盟或设分公司'
    },
    'franchise-demand': {
      cat: '资质招商', role: 'demand', group: 'resource',
      label: '寻找资质加盟', sub: '想挂靠/加盟一家有资质的公司',
      nav: '发布加盟意向', desc: '你想找资质合作，发需求'
    },
    'trade-supply': {
      cat: '建企买卖', role: 'supply', group: 'resource',
      label: '转让公司/资质', sub: '出让公司股权与资质',
      nav: '发布公司转让', desc: '卖公司、卖资质整体转让'
    },
    'trade-demand': {
      cat: '建企买卖', role: 'demand', group: 'resource',
      label: '收购公司/资质', sub: '求购带资质建筑公司',
      nav: '发布收购意向', desc: '买公司、买资质，提收购四要素'
    },
    'personnel-demand': {
      cat: '招聘', role: 'demand', group: 'resource',
      label: '发布招聘岗位', sub: '企业招人',
      nav: '发布招聘', desc: '企业发岗位，收简历'
    },
    'talent-supply': {
      cat: '求职', role: 'supply', group: 'resource',
      label: '求职找岗位', sub: '建造师/工程师投简历',
      nav: '发布求职', desc: '人才发简历，等企业联系'
    },

    /* ---------- 供需对接类 ---------- */
    'material-supply': {
      cat: '材料', role: 'supply', group: 'supply',
      label: '供应材料', sub: '卖建材',
      nav: '发布材料供应', desc: '你有材料要卖'
    },
    'material-demand': {
      cat: '材料', role: 'demand', group: 'supply',
      label: '采购材料', sub: '买建材',
      nav: '发布材料采购', desc: '你要采购材料'
    },
    'equipment-supply': {
      cat: '设备', role: 'supply', group: 'supply',
      label: '出租/出售设备', sub: '塔吊/挖机/脚手架等',
      nav: '发布设备出租', desc: '你有设备要出租或出售'
    },
    'equipment-demand': {
      cat: '设备', role: 'demand', group: 'supply',
      label: '租赁设备', sub: '租设备用',
      nav: '发布设备租赁', desc: '你要租设备'
    },
    'labor-supply': {
      cat: '劳务', role: 'supply', group: 'supply',
      label: '提供劳务班组', sub: '派工干活',
      nav: '发布劳务供给', desc: '你有班组要接活'
    },
    'labor-demand': {
      cat: '劳务', role: 'demand', group: 'supply',
      label: '发布用工需求', sub: '招工人/班组',
      nav: '发布用工需求', desc: '你要找工人干活'
    },
    'cooperation-supply': {
      cat: '项目合作', role: 'supply', group: 'supply',
      label: '承接项目合作', sub: '分包/联营接单',
      nav: '发布承接合作', desc: '你有能力接项目'
    },
    'cooperation-demand': {
      cat: '项目合作', role: 'demand', group: 'supply',
      label: '发包/找合作方', sub: '找分包/联营方',
      nav: '发布合作需求', desc: '你要发项目找合作方'
    },
    'agency-supply': {
      cat: '中介服务', role: 'supply', group: 'supply',
      label: '提供中介服务', sub: '资质代办/担保/咨询',
      nav: '发布中介服务', desc: '中介服务商挂服务菜单',
      viaSeller: true
    },
    'agency-demand': {
      cat: '中介服务', role: 'demand', group: 'supply',
      label: '找中介服务', sub: '找代办/担保/咨询',
      nav: '发布找中介需求', desc: '你要办资质、找担保等'
    }
  };

  /* type → 编辑器 URL */
  function editorHref(typeKey) {
    var t = PUBLISH_TYPES[typeKey];
    if (!t) return 'editor.html';
    var q = 'type=' + encodeURIComponent(typeKey);
    if (t.viaSeller) q += '&via=seller';
    return 'editor.html?' + q;
  }

  /* 当前身份在某方向下可发的 type key 列表 */
  function availableTypes(acc, role) {
    var out = [];
    var cats = [];
    try { cats = (window.publishableCats && publishableCats(acc, role)) || []; } catch (e) { cats = []; }
    Object.keys(PUBLISH_TYPES).forEach(function (k) {
      var t = PUBLISH_TYPES[k];
      if (t.role !== role) return;
      if (cats.indexOf(t.cat) < 0) return;
      out.push(k);
    });
    return out;
  }

  global.PUBLISH_TYPES = PUBLISH_TYPES;
  global.publishTypeHref = editorHref;
  global.availablePublishTypes = availableTypes;
})(window);
