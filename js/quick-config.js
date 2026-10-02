/* ============================================================
 * quick-config.js — 「我的」常用服务快捷工具配置（跨页共享）
 * window.QuickConfig
 * 纯前端多页应用，localStorage 持久化；防御性兜底，绝不向外抛错。
 * 依赖（运行时可选链 + typeof 兜底）：
 *   localStorage / window.entryAccess(stores.js) / window.DataBus(databus.js) / window.OrgsStore(orgs.js)
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'engchain-quick-tools';

  /* 必选三档（当前身份下"应必选"的判定见 requiredNow()） */
  var REQUIRED = ['auth-center', 'my-jobs', 'org-members'];

  /* 固定 11 项（默认已添加，可删可加回） */
  var FIXED = [
    'delegate', 'dist', 'agency-sv', 'invoice', 'refund',
    'ent-search', 'hist-files', 'industry', 'my-applies',
    'platform-dash', 'demo-reset'
  ];

  /* 52 项最小展示表 { id, n, label, href }。
   * n/href/label 与 pages/profile/all-functions.html 的 GROUPS 逐项一致；
   * 页面加载后由 all-functions 侧做 key 集合相等的运行时自检（见该页 __quickSelfCheck）。 */
  var CATALOG = {
    /* 交易服务 */
    'orders':        { id:'orders',        n:'01', label:'我的订单', href:'../order/index.html' },
    'wallet':        { id:'wallet',        n:'02', label:'我的钱包', href:'../wallet/index.html' },
    'invoice':       { id:'invoice',       n:'03', label:'发票管理', href:'../wallet/invoice.html' },
    'refund':        { id:'refund',        n:'04', label:'退款售后', href:'../refund/index.html' },
    'member':        { id:'member',        n:'05', label:'年度会员', href:'../wallet/membership.html' },
    'upgrades':      { id:'upgrades',      n:'06', label:'增值道具', href:'../vendor/upgrades.html' },
    'match':         { id:'match',         n:'07', label:'智能推荐', href:'../match/preferences.html' },
    'esign':         { id:'esign',         n:'08', label:'电子签',   href:'../esign/index.html' },
    'monitor':       { id:'monitor',       n:'09', label:'企业监控', href:'../monitor/index.html' },
    'delegate':      { id:'delegate',      n:'10', label:'我的委托', href:'delegates.html' },
    /* 内容管理 */
    'pub-records':   { id:'pub-records',   n:'11', label:'发布管理', href:'../publish/records.html' },
    'pub-center':    { id:'pub-center',    n:'12', label:'发布中心', href:'../publish/index.html' },
    'fav':           { id:'fav',           n:'13', label:'我的收藏', href:'../favorite/index.html' },
    'history':       { id:'history',       n:'14', label:'浏览记录', href:'history.html' },
    'hist-files':    { id:'hist-files',    n:'50', label:'历史文件', href:'history-files.html' },
    'dashboard':     { id:'dashboard',     n:'15', label:'经营看板', href:'../vendor/dashboard.html' },
    'industry':      { id:'industry',      n:'16', label:'行业总览', href:'../industry/index.html' },
    'api':           { id:'api',           n:'17', label:'数据服务', href:'../api/index.html' },
    /* AI 增长 */
    'geo':           { id:'geo',           n:'18', label:'GEO 品牌雷达', href:'../geo/index.html' },
    /* 市场与服务 */
    'trade':         { id:'trade',         n:'19', label:'建企买卖', href:'../trade/index.html' },
    'ent-search':    { id:'ent-search',    n:'49', label:'企业查询', href:'../search/index.html?v=enterprise' },
    'personnel':     { id:'personnel',    n:'20', label:'人员招聘', href:'../personnel/index.html' },
    'agency-plaza':  { id:'agency-plaza',  n:'21', label:'服务广场', href:'../agency/index.html' },
    'franchise':     { id:'franchise',     n:'22', label:'资质招商', href:'../franchise/index.html' },
    'co-create':      { id:'co-create',     n:'23', label:'共创者计划', href:'../co-create/index.html' },
    /* 人才服务 */
    'resume':        { id:'resume',        n:'24', label:'简历投递', href:'my-applies.html' },
    'my-applies':    { id:'my-applies',    n:'25', label:'我的投递', href:'my-applies.html' },
    'my-jobs':       { id:'my-jobs',       n:'26', label:'我的招聘', href:'my-jobs.html' },
    /* 认证入驻 */
    'auth-center':   { id:'auth-center',   n:'27', label:'认证中心', href:'auth.html' },
    'auth-realname': { id:'auth-realname', n:'28', label:'个人认证', href:'auth-prep.html?type=realname' },
    'auth-pro':      { id:'auth-pro',      n:'29', label:'个人入驻', href:'auth-prep.html?type=qualification' },
    'auth-partner':  { id:'auth-partner',  n:'30', label:'个人合伙人', href:'auth-prep.html?type=partner' },
    'auth-ent':      { id:'auth-ent',      n:'31', label:'企业认证', href:'auth-prep.html?type=enterprise' },
    'auth-entry':    { id:'auth-entry',    n:'32', label:'企业入驻', href:'auth-prep.html?type=entry' },
    'org-members':   { id:'org-members',   n:'51', label:'企业成员', href:'org-members.html' },
    /* 消息互动 */
    'message':       { id:'message',       n:'33', label:'我的消息', href:'../message/index.html' },
    'feedback':      { id:'feedback',      n:'34', label:'意见反馈', href:'../help/feedback.html' },
    /* 分销与邀请 */
    'dist':          { id:'dist',          n:'35', label:'分销中心', href:'../distribution/index.html' },
    'agency-sv':     { id:'agency-sv',     n:'36', label:'中介服务', href:'../agency/seller-board.html' },
    'share':         { id:'share',          n:'37', label:'我的分享', href:'share.html' },
    /* 钱包与积分 */
    'credits':       { id:'credits',       n:'38', label:'我的积分', href:'../wallet/credits.html' },
    'credits-mall':  { id:'credits-mall',  n:'39', label:'积分商城', href:'../wallet/credits-mall.html' },
    'free-quota':    { id:'free-quota',    n:'40', label:'免费额度', href:'../wallet/free-quota.html' },
    'pay-method':    { id:'pay-method',    n:'41', label:'支付方式', href:'../wallet/payment-method.html' },
    /* 平台治理 */
    'platform-dash': { id:'platform-dash', n:'42', label:'平台运营台', href:'../platform/dashboard.html' },
    /* 系统设置 */
    'guide':         { id:'guide',         n:'43', label:'新手指引', href:'../guide/index.html' },
    'general':       { id:'general',      n:'44', label:'通用设置', href:'general-setting.html' },
    'security':      { id:'security',      n:'45', label:'账号安全', href:'security.html' },
    'notify':        { id:'notify',        n:'46', label:'通知设置', href:'notify.html' },
    'help':          { id:'help',          n:'47', label:'帮助中心', href:'../help/index.html' },
    'about':         { id:'about',         n:'48', label:'关于我们', href:'about.html' },
    'demo-reset':    { id:'demo-reset',    n:'52', label:'演示重置', href:'../agency/demo-reset.html' }
  };

  /* 默认数组（首装态 = 现网 renderQuick 视觉顺序，14 项） */
  var DEFAULT = [
    'delegate', 'dist', 'agency-sv', 'invoice', 'refund',
    'auth-center', 'my-jobs', 'org-members',
    'ent-search', 'hist-files', 'industry', 'my-applies',
    'platform-dash', 'demo-reset'
  ];

  /* ---------- 身份工具（全部防御性兜底） ---------- */
  function loggedIn() {
    try {
      return !!(window.UI && UI.state && UI.state.get && UI.state.get() && UI.state.get().loggedIn);
    } catch (e) { return false; }
  }
  function access() {
    try { return (typeof window.entryAccess === 'function') ? window.entryAccess() : null; }
    catch (e) { return null; }
  }

  /* §4.1 我的招聘可见：已登录 && 企业认证(verified)/企业入驻(resident) && 非中介入驻 */
  function canShowMyJobs() {
    try {
      if (!loggedIn()) return false;
      var a = access(); if (!a) return false;
      var ent = a.identity ? a.identity.enterprise : 'none';
      return (ent === 'verified' || ent === 'resident') && !a.agency;
    } catch (e) { return false; }
  }

  /* §4.2 企业成员可见：已登录 && 当前用户在任一企业存在 membership */
  function canShowOrgMembers() {
    try {
      if (!loggedIn()) return false;
      var me = (window.DataBus && typeof window.DataBus.current === 'function') ? window.DataBus.current() : null;
      if (!me) return false;
      if (!(window.OrgsStore && typeof window.OrgsStore.orgsOf === 'function')) return false;
      return window.OrgsStore.orgsOf(me.id).length > 0;
    } catch (e) { return false; }
  }

  /* 当前身份下"应必选"的 id 列表（auth-center 恒必选；动态项仅可见时必选） */
  function requiredNow() {
    var r = ['auth-center'];
    if (canShowMyJobs()) r.push('my-jobs');
    if (canShowOrgMembers()) r.push('org-members');
    return r;
  }

  /* 动态必选项在当前身份下不可见 → 配置数组中保留、展示时过滤 */
  function isHiddenDynamic(id) {
    if (id === 'my-jobs') return !canShowMyJobs();
    if (id === 'org-members') return !canShowOrgMembers();
    return false;
  }

  /* ---------- 清洗管线（§2.3） ---------- */
  function clean(ids) {
    if (!Array.isArray(ids)) ids = [];
    var out = [], seen = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (typeof id !== 'string') continue;
      if (!CATALOG[id]) continue;          /* 剔未知 id */
      if (seen[id]) continue;              /* 去重，保首次 */
      seen[id] = true;
      out.push(id);
    }
    /* 必选项补回末尾 */
    var req = requiredNow();
    for (var k = 0; k < req.length; k++) {
      if (out.indexOf(req[k]) < 0) out.push(req[k]);
    }
    return out;
  }

  function writeRaw(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function load() {
    try {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      var arr = null;
      if (raw) { try { arr = JSON.parse(raw); } catch (e) { arr = null; } }
      if (!Array.isArray(arr)) arr = DEFAULT.slice();   /* 非法/缺失 → 默认 */
      arr = clean(arr);
      writeRaw(arr);                                    /* 静默写回干净数据 */
      return arr;
    } catch (e) {
      var d = DEFAULT.slice();
      writeRaw(d);
      return d;
    }
  }

  function save(ids) {
    var arr = clean(ids);
    writeRaw(arr);
    return arr;
  }

  function reset() {
    var arr = clean(DEFAULT.slice());
    writeRaw(arr);
    return arr;
  }

  /* 展示用有序 id 列表 = 配置数组过滤掉当前身份下不可见的动态必选项 */
  function visibleIds() {
    var arr = load();
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (isHiddenDynamic(arr[i])) continue;
      out.push(arr[i]);
    }
    return out;
  }

  function isRequired(id) {
    return requiredNow().indexOf(id) >= 0;
  }

  /* ---------- 面板操作（内部完成 save） ---------- */
  function add(id) {
    if (typeof id !== 'string' || !CATALOG[id]) return load();
    var arr = load();
    if (arr.indexOf(id) >= 0) return arr;                /* 幂等 */
    arr.push(id);
    return save(arr);
  }

  function remove(id) {
    if (typeof id !== 'string') return load();
    var arr = load();
    if (isRequired(id)) return arr;                      /* 必选项拒绝删除 */
    var i = arr.indexOf(id);
    if (i < 0) return arr;
    arr.splice(i, 1);
    return save(arr);
  }

  /* 拖拽重排：入参为"当前可见项"的新顺序；
   * 映射回完整配置数组时保留不可见动态项的槽位与相对顺序。 */
  function reorder(orderedVisible) {
    var full = load();
    var queue = Array.isArray(orderedVisible) ? orderedVisible.slice() : [];
    var out = [];
    for (var i = 0; i < full.length; i++) {
      var id = full[i];
      if (isHiddenDynamic(id)) { out.push(id); }        /* 不可见项原地保位 */
      else { out.push(queue.shift()); }                  /* 可见项按新顺序依次取值 */
    }
    while (queue.length) out.push(queue.shift());        /* 兜底：残留可见项补末尾 */
    return save(out);
  }

  window.QuickConfig = {
    KEY: KEY,
    REQUIRED: REQUIRED,
    FIXED: FIXED,
    CATALOG: CATALOG,
    load: load,
    save: save,
    reset: reset,
    canShowMyJobs: canShowMyJobs,
    canShowOrgMembers: canShowOrgMembers,
    visibleIds: visibleIds,
    isRequired: isRequired,
    add: add,
    remove: remove,
    reorder: reorder
  };
})();
