(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();
;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();

;

(function () {
  var STATE_KEY = 'engchain-state';
  var THEME_KEY = 'engchain-theme';

  /* ---- 页面分组（支持父子二级，父节点可折叠；页数由 countPages() 动态统计） ---- */
  var MODULES = [
    { name:'工作台', pages:[
      ['home.html','App首页'],
      ['index.html','App首页·认证引导']
    ]},
    { name:'共创计划', pages:[
      ['pages/co-create/index.html','共创者计划·破冰期']
    ]},
    { name:'供需·匹配', pages:[
      { name:'发现·首页', src:'pages/supply/list.html', children:[
        ['pages/supply/detail.html?id=1001','详情·材料采购'],
        ['pages/supply/detail.html?id=1009','详情·材料供应'],
        ['pages/supply/detail.html?id=1004','详情·劳务用工'],
        ['pages/supply/detail.html?id=1005','详情·设备租赁'],
        ['pages/supply/detail.html?id=cp1','详情·建筑合作'],
        ['pages/supply/detail.html?id=a1','详情·中介服务']
      ]}
    ]},
    { name:'资源·机会', pages:[
      { name:'资质招商·首页', src:'pages/franchise/index.html', children:[
        ['pages/supply/detail.html?id=fc1','资质招商·企业详情'],
        ['pages/franchise/delegate-edit.html','委托编辑'],
      ]},
      { name:'建企买卖·首页', src:'pages/trade/index.html', children:[
        ['pages/supply/detail.html?id=t1','企业买卖·M&A']
      ]},
      { name:'人员招聘·首页', src:'pages/personnel/index.html', children:[
        ['pages/supply/detail.html?id=p1','企业招聘·需求详情'],
        ['pages/supply/detail.html?id=talent1','人才详情·一级建造师']
      ]}
    ]},
    { name:'认证卡', pages:[
      ['pages/company/index.html?id=c-znzjs','企业认证主页'],
      ['pages/personal/index.html?id=p-jzs1','个人认证主页']
    ]},
    { name:'行业', pages:[
      ['pages/industry/index.html','行业总览']
    ]},
    { name:'发布', pages:[
      { name:'信息工作台', src:'pages/publish/index.html', children:[
        ['pages/publish/editor.html?role=demand','发布需求·编辑'],
        ['pages/publish/editor.html?role=supply','发布供应·编辑'],
        ['pages/publish/records.html','我的发布'],
        ['pages/publish/drafts.html','草稿箱'],
        ['pages/publish/unlocked.html','已解锁线索'],
        ['pages/publish/success.html','发布成功']
      ]}
    ]},
    { name:'搜索', pages:[
      { name:'AI自然语言搜索', src:'pages/search/index.html', children:[
        ['pages/search/result.html','搜索结果·匹配%'],
        ['pages/search/business.html','企业搜索'],
        ['pages/search/enterprise.html','企业信息搜索·双模式'],
      ]}
    ]},
    { name:'匹配', pages:[
      ['pages/match/preferences.html','匹配偏好设置']
    ]},
    { name:'消息', pages:[
      { name:'会话列表', src:'pages/message/index.html', children:[
        ['pages/message/chat.html','聊天窗口']
      ]},
      ['pages/message/system.html','系统消息']
    ]},
    { name:'钱包', pages:[
      ['pages/wallet/index.html','钱包·首页'],
      ['pages/wallet/credits.html','积分账户·充值解锁'],
      ['pages/wallet/credits-mall.html','积分商城'],
      ['pages/wallet/credits-rules.html','积分规则'],
      ['pages/wallet/membership.html','会员中心'],
      ['pages/wallet/recharge.html','余额充值'],
      ['pages/wallet/withdraw.html','提现'],
      ['pages/wallet/bank-cards.html','银行卡'],
      ['pages/wallet/payment-method.html','支付方式'],
      ['pages/wallet/escrow.html','托管资金'],
      ['pages/wallet/free-quota.html','免费额度'],
      ['pages/wallet/unlock-records.html','解锁记录'],
      { name:'发票管理', src:'pages/wallet/invoice.html', children:[
        ['pages/wallet/invoice-record.html','发票详情'],
        ['pages/wallet/invoice-info.html','开票信息管理'],
        ['pages/wallet/invoice-info-edit.html','编辑开票信息'],
        ['pages/wallet/invoice-title-new.html','新增抬头']
      ]},
      { name:'对公转账', src:'pages/wallet/corp-pay.html', children:[]}
    ]},
    { name:'个人中心', pages:[
      { name:'我的·个人中心', src:'pages/profile/index.html', children:[
        ['pages/profile/my-applies.html','我的投递'],
        ['pages/profile/resume-edit.html','简历编辑'],
        ['pages/profile/privacy.html','隐私设置'],
        ['pages/profile/edit-profile.html','编辑资料'],
        ['pages/profile/contact.html','联系方式'],
        ['pages/profile/history.html','浏览历史'],
        ['pages/profile/delegates.html','我的委托'],
        ['pages/profile/my-jobs.html','我的职位'],
        ['pages/profile/edit.html','编辑主页'],
        ['pages/profile/delegate-detail.html','委托详情'],
        ['pages/profile/delegate-new.html','新建委托'],
        ['pages/profile/delegate-edit.html','委托编辑'],
        ['pages/profile/share.html','分享'],
        ['pages/profile/all-functions.html','全部功能'],
        ['pages/profile/org-members.html','企业成员管理']
      ]},
      { name:'认证中心', src:'pages/profile/auth.html', children:[
        ['pages/profile/auth-enterprise.html','企业工商认证'],
        ['pages/profile/auth-personal.html','个人实名认证'],
        ['pages/profile/auth-payment.html','资金账户认证'],
        ['pages/profile/auth-qualification.html','资质认证'],
        ['pages/profile/auth-result.html','认证结果·成功'],
        ['pages/profile/auth-result.html?state=reviewing','认证结果·审核中'],
        ['pages/profile/auth-partner.html','个人合伙人申请'],
        ['pages/profile/auth-prep.html','认证资料准备'],
        ['pages/profile/entry.html','企业入驻·三类'],
        ['pages/profile/entry-form.html?type=construction','入驻申请·建筑'],
        ['pages/profile/entry-review.html','入驻审核·合伙人'],
        ['pages/profile/entry-result.html','入驻成功'],
        ['pages/profile/entry-personal-result.html','个人入驻·结果']
      ]},
      { name:'设置', src:'pages/profile/settings.html', children:[
        ['pages/profile/general-setting.html','通用设置'],
        ['pages/profile/security.html','账号与安全'],
        ['pages/profile/notify.html','送达方式']
      ]},
      ['pages/profile/about.html','关于我们·合规资质']
    ]},
    { name:'分销', pages:[
      { name:'分销中心', src:'pages/distribution/index.html', children:[
        ['pages/distribution/earnings.html','收益'],
        ['pages/distribution/team.html','我的团队'],
        ['pages/distribution/poster.html','推广海报'],
        ['pages/distribution/rules.html','分销规则'],
        ['pages/distribution/withdraw.html','提现'],
      ]}
    ]},
    { name:'订单', pages:[
      { name:'我的订单', src:'pages/order/index.html', children:[
        ['pages/order/detail.html','订单详情']
      ]}
    ]},
    { name:'中介服务', pages:[
      { name:'服务广场', src:'pages/agency/index.html', children:[
        ['pages/agency/order.html?svcId=a1','在线下单·资质升级'],
        ['pages/agency/order.html?svcId=a2','在线下单·工商注册'],
        ['pages/agency/order.html?svcId=a3','在线下单·安许代办'],
        ['pages/agency/order.html?svcId=a4','在线下单·资质分立'],
        ['pages/agency/order.html?svcId=a5','在线下单·工程担保'],
        ['pages/agency/order.html?svcId=a6','在线下单·造价咨询'],
        ['pages/agency/order.html?svcId=a7','在线下单·劳务派遣'],
        ['pages/agency/my-orders.html','我的单（买方订单）'],
        ['pages/agency/order-detail.html','订单详情'],
        ['pages/agency/seller-board.html','服务商工作台'],
        ['pages/agency/demo-reset.html','演示重置'],
        /* ↓ 以下为服务广场单页内状态/弹层，列项展示但不计入页面统计 */
      ]}
    ]},
    { name:'企业监控', pages:[
      ['pages/monitor/index.html','企业监控·风险雷达']
    ]},
    { name:'平台运营', pages:[
      ['pages/platform/dashboard.html','平台运营台']
    ]},
    { name:'服务商', pages:[
      ['pages/vendor/dashboard.html','服务商工作台'],
      ['pages/vendor/upgrades.html','服务商升级']
    ]},
    { name:'收藏', pages:[
      ['pages/favorite/index.html','我的收藏']
    ]},
    { name:'协议', pages:[
      ['pages/agreement/user.html','用户协议'],
      ['pages/agreement/privacy.html','隐私政策']
    ]},
    { name:'注册登录', pages:[
      ['pages/auth/login.html','登录'],
      ['pages/auth/register.html','注册'],
      ['pages/auth/banned.html','账号封禁']
    ]},
    { name:'其他', pages:[
      ['pages/help/index.html','帮助中心'],
      { name:'退款规则', src:'pages/refund/index.html', children:[
        ['pages/refund/appeal.html','申请退款']
      ]},
      ['pages/guide/index.html','新手指引'],
      ['pages/api/index.html','API 接口页'],
    ]},
    { name:'样式预览', pages:[
      ['docs/cards/index.html','9类卡片·样式总览'],
      ['visual-system.html','视觉系统·参考']
    ]},
    { name:'后台', pages:[
      ['admin/index.html','后台 · 数据总览'],
      { name:'运营中心', src:'admin/operations/supply.html', children:[
        ['admin/operations/orders.html','订单管理'],
        ['admin/operations/messages.html','消息中心']
      ]},
      { name:'用户中心', src:'admin/users/users.html', children:[
        ['admin/users/auth-review.html','认证审核'],
        ['admin/users/entry-review.html','入驻审核'],
        ['admin/users/owner-review.html','企业主验证审核']
      ]},
      { name:'资金中心', src:'admin/finance/wallet.html', children:[
        ['admin/finance/revenue.html','收入看板'],
        ['admin/finance/recharge.html','充值 / 对公审批'],
        ['admin/finance/withdraw.html','提现审批'],
        ['admin/finance/credits.html','积分管理'],
        ['admin/finance/commission.html','佣金结算'],
        ['admin/finance/invoice.html','发票管理']
      ]},
      { name:'分销中心', src:'admin/distribution/overview.html', children:[
        ['admin/distribution/team.html','团队管理'],
        ['admin/distribution/payout.html','佣金发放']
      ]},
      { name:'中介服务', src:'admin/mediation/orders.html', children:[
        ['admin/mediation/sellers.html','服务商管理'],
        ['admin/mediation/escrow.html','托管资金台账']
      ]},
      { name:'风控合规', src:'admin/risk/audit.html', children:[
        ['admin/risk/monitor.html','企业监控'],
        ['admin/risk/compliance.html','合规管理'],
        ['admin/risk/logs.html','操作日志']
      ]},
      { name:'系统设置', src:'admin/system/pricing.html', children:[
        ['admin/system/phase.html','运营周期'],
        ['admin/system/roles.html','角色权限']
      ]},
      ['admin/design-system.html','设计系统·参考'],
      ['folder-cards/index.html','文件夹卡片·组件演示']
    ]}
  ];

  /* ---- 导航渲染（支持叶子节点 / 父节点可折叠） ---- */
  var nav = document.getElementById('pv-nav');
  var frame = document.getElementById('frame');

  /* 从当前页面 URL 推导项目根绝对路径（Windows 格式，如 D:/Engchain3.0/） */
  var ABS_ROOT = (function () {
    var root = location.href.replace(/\/preview\.html.*$/, '/'); // file:///d%3A/Engchain3.0/
    root = root.replace(/^file:\/+/, '');                          // d%3A/Engchain3.0/
    root = decodeURIComponent(root);                                // d:/Engchain3.0/（解码 %3A → : 等）
    if (/^[a-z]:/.test(root)) root = root.charAt(0).toUpperCase() + root.slice(1); // D:/Engchain3.0/
    return root;
  })();

  function leafHtml(src, name, extraCls, isParent) {
    var abs = ABS_ROOT + src;
    var caret = isParent ? '<span class="pl-caret" role="button" title="展开/收起">▾</span>' : '';
    return '<a class="pl ' + extraCls + '" data-src="' + src + '" data-name="' + name + '" data-abs="' + abs + '">' +
      '<span class="ic">›</span>' +
      '<span class="pl-name">' + name + '</span>' +
      '<span class="pl-right">' +
        '<span class="pl-path" title="绝对路径：' + abs + '">' + src + '</span>' +
        caret +
        '<span class="pl-copy" role="button" title="复制地址">' +
          '<svg class="ci-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>' +
          '<svg class="ci-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="display:none"><path d="m5 13 4 4L19 7"/></svg>' +
        '</span>' +
      '</span>' +
    '</a>';
  }
  function itemHtml(it) {
    if (Array.isArray(it)) return leafHtml(it[0], it[1], '', false);
    if (it && it.isState) return leafHtml(it.src, it.name, 'pl-state', false);
    var kids = it.children.map(function (c) {
      if (Array.isArray(c)) return leafHtml(c[0], c[1], 'pl-sub', false);
      if (c && c.isState) return leafHtml(c.src, c.name, 'pl-state', false);
      return leafHtml(c.src, c.name, 'pl-sub', false);
    }).join('');
    return leafHtml(it.src, it.name, 'pl-parent', true) + '<div class="pl-kids">' + kids + '</div>';
  }

  /* ---- 统计目录树页面总数（App / 后台分类） ---- */
  function countPages() {
    var appCount = 0, adminCount = 0;
    function countItem(it) {
      if (Array.isArray(it)) {
        var src = it[0];
        if (src.indexOf('admin/') === 0 || src.indexOf('folder-cards/') === 0) adminCount++;
        else appCount++;
      } else if (it && it.src) {
        /* 单页状态/弹层：列项展示但不计入页面统计 */
        if (it.isState) return;
        if (it.src.indexOf('admin/') === 0 || it.src.indexOf('folder-cards/') === 0) adminCount++;
        else appCount++;
        if (it.children) it.children.forEach(countItem);
      }
    }
    try { MODULES.forEach(function (m) { if (m.pages) m.pages.forEach(countItem); }); } catch (e) { console.warn('countPages error:', e); }
    var total = appCount + adminCount;
    var elTotal = document.getElementById('nh-total');
    var elApp = document.getElementById('nh-app');
    var elAdmin = document.getElementById('nh-admin');
    if (elTotal) elTotal.textContent = '共 ' + total + ' 页';
    if (elApp) elApp.textContent = 'App ' + appCount;
    if (elAdmin) elAdmin.textContent = '后台 ' + adminCount;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', countPages);
  else countPages();

  nav.innerHTML = MODULES.map(function (m) {
    var links = m.pages.map(itemHtml).join('');
    return '<div class="pv-group"><div class="g-name">' + m.name + '</div><div class="links">' + links + '</div></div>';
  }).join('');

  /* 折叠状态恢复（localStorage 记忆） */
  (function restoreCollapse() {
    var collapsed = [];
    try { collapsed = JSON.parse(localStorage.getItem('engchain-nav-collapse') || '[]'); } catch (e) {}
    document.querySelectorAll('.pl-parent').forEach(function (p) {
      if (collapsed.indexOf(p.dataset.src) > -1) p.classList.add('collapsed');
    });
  })();
  /* 复制页面地址：命名（地址） */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return Promise.resolve();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return Promise.resolve(); }, fallback);
    }
    return fallback();
  }
  function flashCopy(el) {
    el.classList.add('ok');
    setTimeout(function () { el.classList.remove('ok'); }, 1300);
  }
  nav.addEventListener('click', function (e) {
    /* 折叠箭头：仅切换展开/收起，不加载页面 */
    var caret = e.target.closest('.pl-caret');
    if (caret) {
      e.preventDefault(); e.stopPropagation();
      var parent = caret.closest('.pl-parent');
      if (parent) {
        parent.classList.toggle('collapsed');
        var collapsed = [];
        document.querySelectorAll('.pl-parent.collapsed').forEach(function (p) { collapsed.push(p.dataset.src); });
        try { localStorage.setItem('engchain-nav-collapse', JSON.stringify(collapsed)); } catch (e) {}
      }
      return;
    }
    var cp = e.target.closest('.pl-copy');
    if (cp) {
      e.preventDefault(); e.stopPropagation();
      var a = cp.closest('.pl');
      if (!a) return;
      copyText('"' + a.dataset.name + '（' + a.dataset.abs + '）"').then(function () { flashCopy(cp); });
      return;
    }
    var a = e.target.closest('.pl');
    if (!a) return;
    nav.querySelectorAll('.pl').forEach(function (x) { x.classList.remove('on'); });
    a.classList.add('on');
    /* 双模型框切换：后台类页面（admin/）→ Web 浏览器模型（browser-window 组件，舞台一部分）；其余 → iPhone 模型 */
    var isAdmin = a.dataset.src.indexOf('admin/') === 0 || a.dataset.src.indexOf('folder-cards/') === 0;
    var dev = document.querySelector('.device');
    var bstage = document.getElementById('browser-stage');
    if (isAdmin) {
      dev.style.display = 'none';
      bstage.hidden = false;
      var bw = document.getElementById('bw-admin');
      if (bw) bw.setAttribute('src', a.dataset.src);
      document.getElementById('browser-label').innerHTML = 'Web 浏览器 · <em>' + a.dataset.name + '</em>';
    } else {
      bstage.hidden = true;
      dev.style.display = '';
      frame.src = a.dataset.src;
      var _pura = document.getElementById('shell-pura');
      if (_pura && !_pura.hidden) {
        var _lp = document.getElementById('label-pura');
        if (_lp) _lp.textContent = 'HUAWEI Pura X View · ' + a.dataset.name;
      } else {
        var _li = document.getElementById('label-iphone');
        if (_li) _li.textContent = 'iPhone 16 Pro · ' + a.dataset.name;
      }
    }
  });

  /* ---- 随内嵌页加载/跳转自动高亮目录树并垂直居中 ----
     跨源下父页读不到 iframe 的 URL（file:// 为 opaque origin），由内嵌页经 postMessage 上报 engchain:nav 携带自身 href，
     这里据此匹配到目录树条目：设 .on 高亮，并在侧边栏滚动区 .pv-scroll 内做一次垂直居中。 */
  function relFromHref(href) {
    if (typeof href !== 'string' || !href) return '';
    var r = href;
    try { r = decodeURIComponent(r); } catch (e) {}
    r = r.replace(/^file:\/+/, '');
    if (r.toLowerCase().indexOf(ABS_ROOT.toLowerCase()) === 0) return r.slice(ABS_ROOT.length);
    return r.replace(/^[a-z]:[\\/]*/i, '');
  }
  function selectNavByHref(href) {
    var rel = relFromHref(href);
    if (!rel) return null;
    var qi = rel.indexOf('?');
    var path = qi > -1 ? rel.slice(0, qi) : rel;
    var q = qi > -1 ? rel.slice(qi) : '';
    function baseOf(s) { var i = s.indexOf('?'); return i > -1 ? s.slice(0, i) : s; }
    var els = Array.prototype.slice.call(nav.querySelectorAll('.pl'));
    var i;
    /* ① 精确命中（含查询串，如 detail.html?id=1009 区分不同参数页） */
    for (i = 0; i < els.length; i++) if (els[i].dataset.src === rel) return els[i];
    /* ② 同页基础路径命中：无查询时任意条目；带查询时仅匹配「自身无查询」的条目（如 index.html?tab=1 仍高亮钱包首页） */
    if (q) { for (i = 0; i < els.length; i++) if (els[i].dataset.src.indexOf('?') === -1 && els[i].dataset.src === path) return els[i]; }
    else   { for (i = 0; i < els.length; i++) if (baseOf(els[i].dataset.src) === path) return els[i]; }
    /* ③ 兜底：未列出的页面 → 高亮其父分组首页节点 */
    for (i = 0; i < els.length; i++) {
      if (!els[i].classList.contains('pl-parent')) continue;
      var dir = baseOf(els[i].dataset.src);
      dir = dir.slice(0, dir.lastIndexOf('/') + 1);
      if (path.indexOf(dir) === 0) return els[i];
    }
    return null;
  }
  function centerNav(el) {
    var scroll = document.querySelector('.pv-scroll');
    if (!scroll || !el) return;
    var sRect = scroll.getBoundingClientRect();
    var eRect = el.getBoundingClientRect();
    var delta = (eRect.top - sRect.top) - (sRect.height - eRect.height) / 2;
    var top = scroll.scrollTop + delta;
    var mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) { scroll.scrollTop = top; }
    else { try { scroll.scrollTo({ top: top, behavior: 'smooth' }); } catch (err) { scroll.scrollTop = top; } }
  }
  function setActiveFromHref(href) {
    var el = selectNavByHref(href);
    nav.querySelectorAll('.pl').forEach(function (x) { x.classList.remove('on'); });
    if (el) { el.classList.add('on'); centerNav(el); }
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!(d && d.type === 'engchain:nav' && typeof d.href === 'string')) return;
    /* 过滤：目录树同时被 iPhone frame（App 页）与 browser-window（后台页）两套 iframe 上报 engchain:nav。
       按 href 是否 admin/ 判断来源，再按浏览器舞台可见性放行 —— 避免隐藏的后台窗口
       （初始 src 或已加载的 admin 页）晚于 App 页上报时覆盖正确高亮。 */
    var rel = relFromHref(d.href);
    var bstage = document.getElementById('browser-stage');
    if (rel.indexOf('admin/') === 0 || rel.indexOf('folder-cards/') === 0) {
      if (bstage && bstage.hidden) return;   // 后台窗口隐藏时，忽略后台页上报
    } else {
      if (bstage && !bstage.hidden) return;  // 后台窗口显示时，忽略 App 页上报
    }
    setActiveFromHref(d.href);
  });
  /* 首帧兜底：iframe 初次加载可能在 listener 就绪前已上报，按当前 src 同步一次 */
  setActiveFromHref(frame.getAttribute('src') || 'home.html');

  /* ---- localStorage 状态读写 ---- */
  function rawState() {
    var s = {}; try { s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (e) {}
    return s;
  }
  function loadState() {
    /* 默认演示账号 = 用户表 u1 陈建国（企业入驻）；status 对齐用户表身份，
       避免空状态被旧默认 registered 误导为"注册会员"（历史污染根因之一） */
    return Object.assign({ user:'陈建国', company:'四川省××建设有限公司', status:'resident', member:true, account:'demo@engchain.cn', loggedIn:true }, rawState());
  }
  function saveState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {} }
  /* 登录态判定：无任何状态（全新）默认已登录；有状态时以显式 loggedIn 为准（退出后缺失 → 未登录） */
  function sideLoggedIn() {
    var s = rawState();
    if (!s || Object.keys(s).length === 0) return true;
    return !!s.loggedIn;
  }

  /* ---- 用户状态（账号权益分级）：单一数据源 = data.js MOCK.statuses，与页面一致 ---- */
  var STATUS_LIST = (window.MOCK && MOCK.statuses) ? MOCK.statuses
    : [{ id:'registered', label:'注册会员', level:1, desc:'基础账号能力', rights:['浏览 / 收藏','限量发布','基础推荐触达'] }];
  function statusById(id) {
    for (var i = 0; i < STATUS_LIST.length; i++) if (STATUS_LIST[i].id === id) return STATUS_LIST[i];
    return STATUS_LIST[1] || STATUS_LIST[0];
  }
  /* v2.0：统一调用 stores.js deriveIdentity()，不再重复实现身份推导逻辑 */
  function deriveSideStatus() {
    if (window.deriveIdentity) return deriveIdentity().primary;
    if (!sideLoggedIn()) return 'guest';
    return 'registered';
  }
  /* 获取双线并行身份对象 */
  function sideIdentity() {
    if (window.deriveIdentity) return deriveIdentity();
    return { personal: 'none', enterprise: 'none', entryTypes: [], isGuest: true, primary: 'guest' };
  }

  /* 状态选择器选项 */
  var sel = document.getElementById('sel-status');
  sel.innerHTML = STATUS_LIST.map(function (x) { return '<option value="' + x.id + '">' + x.label + '</option>'; }).join('');

  function renderState() {
    var idy = sideIdentity();
    var id = idy.primary;
    var cur = statusById(id);
    sel.value = id;
    var loggedIn = sideLoggedIn();
    /* v2.0 双线并行展示：个人线 + 企业线独立显示 */
    var P_LABEL = { none: '未认证', verified: '个人认证', professional: '个人专业入驻' };
    var E_LABEL = { none: '未认证', verified: '企业认证', resident: '企业入驻' };
    var entryText = idy.entryTypes.length ? idy.entryTypes.map(function(t){return {construction:'建筑',agency:'中介',partner:'合伙人'}[t]||t;}).join('+') : '无';
    var chain = [
      '登录' + (loggedIn ? '✓' : '✗'),
      '个人线·' + (P_LABEL[idy.personal] || idy.personal),
      '企业线·' + (E_LABEL[idy.enterprise] || idy.enterprise),
      '入驻类型·' + entryText
    ];
    var rights = (cur.rights || []).join(' / ');
    var titleText = loggedIn ? cur.label : '游客（未登录）';
    document.getElementById('status-note').innerHTML =
      '当前 · <b>' + titleText + '</b>｜' + (cur.desc || '') +
      '<br>双线身份 · 个人:' + (P_LABEL[idy.personal]||idy.personal) + ' / 企业:' + (E_LABEL[idy.enterprise]||idy.enterprise) +
      '<br>持久化 · ' + chain.join(' ｜ ') +
      '<br>权益 · ' + rights;
  }
  function reloadFrame() { frame.src = frame.src; }

  /* ---- 设备比例缩放 ---- */
  var SCALE_KEY = 'engchain-scale';
  var scale = 0.82;
  try { scale = parseFloat(localStorage.getItem(SCALE_KEY) || '0.82'); } catch (e) {}
  function clampScale(v) { return Math.max(0.4, Math.min(1.35, Math.round(v * 20) / 20)); }
  function saveScale() { try { localStorage.setItem(SCALE_KEY, String(scale)); } catch (e) {} }


  /* 「后台演示」模式下 .device 被 renderNav 置为 display:none */
  function deviceHidden() {
    var dev = document.querySelector('.device');
    return !!(dev && dev.style.display === 'none');
  }

  function applyScale() {
    scale = clampScale(scale);
    var phoneShown = !deviceHidden();
    var shown = scale;
    var dev = document.querySelector('.device');
    var bst = document.getElementById('browser-stage');
    if (dev) {
      dev.style.transform = 'scale(' + shown + ')';
      dev.style.marginBottom = Math.round(-117 * shown) + 'px';
    }
    if (bst) bst.style.transform = 'scale(' + scale + ')';
    var zn = document.getElementById('zoom-num');
    if (zn) {
      zn.textContent = Math.round(shown * 100) + '%';
      zn.title = '展示比例 ' + Math.round(shown * 100) + '%';
    }
  }  document.getElementById('zoom-in').addEventListener('click', function () { scale = clampScale(scale + 0.05); applyScale(); saveScale(); });
  document.getElementById('zoom-out').addEventListener('click', function () { scale = clampScale(scale - 0.05); applyScale(); saveScale(); });
  document.getElementById('zoom-reset').addEventListener('click', function () { scale = 0.82; applyScale(); saveScale(); });
  applyScale();

  /* 窗口尺寸变化 → 重新计算（防抖） */
  var fitTimer;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(applyScale, 120);
  });


  /* 主题 */
  /* 后台浏览器模型的明暗同步：跟随 preview 主题（engchain-theme） */
  function applyAdminTheme() {
    var dark = !!document.documentElement.dataset.theme;
    var bw = document.getElementById('bw-admin');
    if (bw) bw.setAttribute('mode', dark ? 'dark' : 'light');
    var t = document.getElementById('btn-bw-theme');
    if (t) t.innerHTML = dark ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> 明亮' : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg> 暗色';
  }
  document.getElementById('seg-theme').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(THEME_KEY, b.dataset.v); } catch (e2) {}
    document.querySelectorAll('#seg-theme button').forEach(function (x) { x.classList.toggle('on', x === b); });
    applyAdminTheme();
    /* 主题只切换风格：经 postMessage 实时下发到演示 iframe，不再整页重载（避免重载导致页面状态/滚动回退）。iframe 跨源时静默，下次加载自取 localStorage */
    try { if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'engchain:theme', theme: b.dataset.v }, '*'); } catch (e3) {}
  });
  /* browser-stage 内明暗按钮：与左侧 seg-theme 共用同一套状态（点击对应 seg 按钮触发完整联动） */
  var btnBwTheme = document.getElementById('btn-bw-theme');
  if (btnBwTheme) btnBwTheme.addEventListener('click', function () {
    var dark = !!document.documentElement.dataset.theme;
    var b = document.querySelector('#seg-theme button[data-v="' + (dark ? 'light' : 'dark') + '"]');
    if (b) b.click();
  });
  var btnBwOpen = document.getElementById('btn-bw-open');
  if (btnBwOpen) btnBwOpen.addEventListener('click', function () { window.open('admin/index.html', '_blank'); });
  /* 用户状态 (选择 → 持久化 + 联动 member + 刷新设备) */
  /* M5补：把演示身份同步到业务 Store（engchain-auth/entry），否则详情/钱包/订单页 deriveStatus 读不到，付费墙/折扣/免费额度无法随状态联动 */
  var selEntrySync = document.getElementById('sel-entrytype');
  function syncBusinessState(status) {
    if (!window.AuthStore || !window.EntryStore) return;
    var now = Date.now(), Y = now + 365 * 864e5;
    var rn = { ok: false, ts: 0 }, en = { ok: false, expireAt: 0 }, ql = { ok: false, list: [] };
    var pe = { ok: false, status: '', note: '', submittedAt: 0, list: [], certs: [], userType: 'jobseeker', resumeComplete: false };
    var entry = { type: null, orderId: null, status: null, active: false, paidAt: 0, expireAt: 0 };
    if (status === 'realname') { rn = { ok: true, ts: now }; }
    else if (status === 'pro') { rn = { ok: true, ts: now }; ql = { ok: true, list: ['一级建造师 · 建筑工程'] }; pe = { ok: true, status: 'active', list: ['一级建造师 · 建筑工程'], userType: 'professional', resumeComplete: true }; }
    else if (status === 'enterprise') { rn = { ok: true, ts: now }; en = { ok: true, expireAt: Y, co: '演示科技有限公司', code: '91510100DEMO01', legal: '张演示', registeredAddress: '四川省成都市武侯区天府大道北段××号', address: '四川省成都市高新区办公路××号' }; }
    else if (status === 'resident') {
      rn = { ok: true, ts: now }; en = { ok: true, expireAt: Y, co: '演示建工集团', code: '91510100DEMO02', legal: '李演示', registeredAddress: '四川省成都市武侯区天府大道北段××号', address: '四川省成都市高新区办公路××号' }; ql = { ok: true, list: ['建筑业企业资质'] }; pe = { ok: true, status: 'active', list: ['建筑业企业资质'], userType: 'professional', resumeComplete: true };
      var et = (selEntrySync && selEntrySync.value) || 'construction';
      entry = { type: et, orderId: 'DEMO' + now.toString().slice(-6), status: 'active', active: true, paidAt: now, expireAt: Y };
    }
    /* [E3 FIX] 必须显式写 personalEntry，否则默认值 {ok:false}（真值对象）会遮蔽 qual，导致 deriveIdentity 推导 pro 失败 */
    AuthStore.write({ realname: rn, enterprise: en, qual: ql, personalEntry: pe });
    EntryStore.write(entry);
    /* 切换身份后清空旧解锁记录与免费额度计数，付费墙按新身份重新评估 */
    try { localStorage.removeItem('engchain-unlocked'); } catch (e) {}
    if (window.CreditStore) { var c = CreditStore.read(); c.quota = { month: new Date().getFullYear() + '-' + (new Date().getMonth() + 1), used: 0 }; CreditStore.write(c); }
  }
  /* [S3 FIX] 演示身份 ↔ 用户表预设用户映射：选择器 = DataBus.login(uid)，不再手写 syncBusinessState。
     login() 自动写 L2 Store（认证/入驻/余额），与 deriveIdentity / orgs.projectAuth 同源，消除双轨跳变。 */
  var STATUS_USER_MAP = { guest:'u7', registered:'u6', realname:'u5', pro:'u4', enterprise:'u3', resident:'u1' };
  var ENTRY_USER_MAP  = { construction:'u1', agency:'u2', partner:'u8' };
  sel.addEventListener('change', function (e) {
    var v = e.target.value;
    var uid = STATUS_USER_MAP[v];
    if (!uid) return;
    if (window.DataBus && DataBus.login) DataBus.login(uid);
    renderState(); renderEntry(); renderKPI(); reloadFrame();
  });
  /* ---- M5：运营周期（破冰期/成熟期）切换 + 两周期逻辑差异说明 ---- */
  function renderMode(){
    var m = window.ModeStore ? ModeStore.read() : {phase:'breakin'};
    var isB = m.phase === 'breakin';
    document.querySelectorAll('#seg-mode button').forEach(function(x){ x.classList.toggle('on', x.dataset.v === m.phase); });
    /* 入驻类型下拉文案随周期取价（单一数据源 data.js breakin.entry / entryTypes） */
    var bi = (MOCK.business && MOCK.business.breakin && MOCK.business.breakin.entry) || {};
    var fe = (MOCK.business && MOCK.business.entryTypes) || {};
    function fmt(n){return n===0?'¥0':('¥'+Number(n).toLocaleString());}
    var optCon=document.querySelector('#sel-entrytype option[value="construction"]');
    var optAge=document.querySelector('#sel-entrytype option[value="agency"]');
    if(optCon)optCon.textContent='建筑企业 '+(isB?fmt(bi.construction):fmt(fe.construction.fee));
    if(optAge)optAge.textContent='中介服务 '+(isB?fmt(bi.agency):fmt(fe.agency.fee));
    var note = document.getElementById('mode-note');
    if (note) note.innerHTML = isB
      ? '<b style="color:var(--text-1);">当前 · 破冰期（冷启动扶持）</b><br>入驻：建筑 <b>¥0</b> / 中介 <b>¥14,999</b>（5折）<br>首档佣金 <b>5%</b>｜实名免费解锁 <b>5+3=8 条</b><br>监控试用 7 天｜游客可看 1 条样例'
      : '<b style="color:var(--text-1);">当前 · 成熟期（标准定价）</b><br>入驻：建筑 <b>¥3,999</b> / 中介 <b>¥29,999</b><br>首档佣金 <b>8%</b>｜实名免费解锁 <b>5 条</b><br>监控按认证等级额度｜游客仅看公开摘要';
  }
  document.getElementById('seg-mode').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (window.ModeStore) ModeStore.switch(b.dataset.v);
    UI.toast((b.dataset.v==='breakin'?'已切换：破冰期（建筑 0 元入驻/中介 5 折/首档佣金 5%/注册送 3 条解锁）':'已切换：成熟期（标准定价/首档佣金 8%）'), 'ok');
    renderMode(); renderKPI(); reloadFrame();
  });
  /* ---- M5：入驻类型（resident 联动 EntryStore）----
     身份门控：仅「企业认证 / 企业入驻」存在入驻类型区分；
     游客 / 注册 / 实名 / 专业认证 4 身份下禁用并置空，避免身份与类型错配。 */
  var selEntry = document.getElementById('sel-entrytype');
  function entryTypeName(id) { return ({construction:'建筑企业', agency:'中介服务企业', partner:'合伙人企业'})[id] || ''; }
  function entryTypeBadge(id) { return ({construction:'蓝V', agency:'金V', partner:'专属'})[id] || ''; }
  function renderEntry() {
    var id = deriveSideStatus();
    var e = window.EntryStore ? EntryStore.read() : {type:null};
    var note = document.getElementById('entry-note');
    var allowed = (id === 'enterprise' || id === 'resident');
    selEntry.disabled = !allowed;
    if (allowed) {
      if (id === 'resident') {
        /* 已入驻：类型由 EntryStore 回填（必有值） */
        selEntry.value = e.type || selEntry.value || 'construction';
        if (note) note.innerHTML = '当前入驻 · <b>' + (entryTypeName(e.type) || '未选择') + '</b>'
          + (entryTypeBadge(e.type) ? '（' + entryTypeBadge(e.type) + '）' : '');
      } else {
        /* 认证企业：可预选，选中即完成入驻（entry 未写入 → 置占位） */
        selEntry.value = e.type || '';
        if (note) note.innerHTML = '<b>已具备入驻资格</b> · 选择企业类型即完成入驻';
      }
    } else {
      selEntry.value = '';
      if (note) note.innerHTML = '入驻类型仅认证企业 / 入驻企业身份可选';
    }
  }
  selEntry.addEventListener('change', function () {
    if (selEntry.disabled || !selEntry.value) { selEntry.value = ''; return; } /* 门控防御：仅启用态可选 */
    /* [S3] 入驻类型 ↔ 企业入驻用户映射：建筑=u1 / 中介=u2 / 合伙人=u8 */
    var uid = ENTRY_USER_MAP[selEntry.value];
    if (uid && window.DataBus && DataBus.login) DataBus.login(uid);
    var label = entryTypeName(selEntry.value) || '';
    UI.toast('已设为：' + label + '（企业入驻）','ok');
    renderState(); renderEntry(); renderKPI(); reloadFrame();
  });
  /* ---- M5：KPI 仪表（五收入流）---- */
  function renderKPI(){
    var a=window.AuthStore?AuthStore.read():{};
    var e=window.EntryStore?EntryStore.read():{};
    var c=window.CreditStore?CreditStore.read():{balance:0};
    var o=window.AgencyOrderStore?AgencyOrderStore.read():{list:[]};
    var cm=window.CommissionStore?CommissionStore.read():{flows:[]};
    var entLabel={construction:'建筑',agency:'中介',partner:'合伙人'}[e.type]||'未入驻';
    var feeTotal=0; for(var i=0;i<cm.flows.length;i++)feeTotal+=cm.flows[i].fee||0;
    var html='<b style="color:var(--text-1);">五收入流 KPI</b><br>'+
      '认证费：'+(a.enterprise&&a.enterprise.ok?'企业 ¥999/年 ✓':'实名免费 · 企业未认证')+'｜'+
      '入驻费：'+(e.active?(entLabel+' ✓'):'未入驻')+'<br>'+
      '积分余额：<b>'+c.balance.toLocaleString()+'</b> ｜ 免费解锁：'+((c.quota&&c.quota.used)||0)+' 条'+
      '｜ 佣金累计：<b>¥'+feeTotal.toLocaleString()+'</b>（'+cm.flows.length+' 单）<br>'+
      '中介订单：'+o.list.length+' 单（'+(o.list.filter(function(x){return x.state==='settled';}).length)+' 已结算）';
    var kpi=document.getElementById('kpi-note');
    if(kpi)kpi.innerHTML=html;
  }
  /* 重置：调用 DataBus.resetAll() 恢复全部用户初始状态（仅业务数据，保留主题偏好） */
  document.getElementById('reset-state').addEventListener('click', function () {
    if (!confirm('确定重置全部演示数据？\n\n将恢复 8 类用户的初始状态（认证/入驻/余额/积分/订单/供需/消息等），当前演示操作记录将被清除。\n\n主题偏好不会被重置。')) return;
    var result = null;
    try {
      if (window.DataBus && DataBus.resetAll) {
        result = DataBus.resetAll();
      } else {
        /* fallback：清业务键（保留主题） */
        var KEEP = ['engchain-theme', 'engchain-sidenav'];
        var keys = [];
        for (var i2 = 0; i2 < localStorage.length; i2++) { var k = localStorage.key(i2); if (k && k.indexOf('engchain-') === 0 && KEEP.indexOf(k) === -1) keys.push(k); }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      }
    } catch (e) {}
    renderState(); renderMode(); renderEntry(); renderKPI(); reloadFrame();
    var msg = result ? ('已重置 ' + result.removed + ' 项数据，恢复 ' + result.users + ' 用户初始状态') : '已重置全部演示数据';
    UI.toast(msg, 'ok');
  });

  /* 首屏主题 & 状态 */
  var t0; try { t0 = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (t0 !== 'light') document.documentElement.dataset.theme = 'dark';
  document.querySelectorAll('#seg-theme button').forEach(function (x) { x.classList.toggle('on', (document.documentElement.dataset.theme ? 'dark' : 'light') === x.dataset.v); });
  applyAdminTheme();
  /* 首屏业务 Store 对齐：仅当认证/入驻全部为空时按当前账号身份推入，绝不覆盖页面内已完成的真实认证/入驻。
     FIX：身份来源改为权威用户表（DataBus.current()），不再读状态面板残留值 —— 旧逻辑会把
     空状态按 rawState().status（默认 registered）盲写为注册会员基线，导致"我的"页身份降级且无法恢复 */
  (function alignOnLoad() {
    var a = window.AuthStore ? AuthStore.read() : {};
    var e = window.EntryStore ? EntryStore.read() : {};
    var anyAuth = (a.realname && a.realname.ok) || (a.enterprise && a.enterprise.ok) || (a.qual && a.qual.ok);
    var anyEntry = !!(e.type && e.active);
    if (!anyAuth && !anyEntry) {
      var cu = (window.DataBus && DataBus.current) ? DataBus.current() : null;
      /* [S3] 首屏空 Store 时按当前账号 login 对齐，不再手写 syncBusinessState */
      if (cu && window.DataBus && DataBus.login) DataBus.login(cu.id);
    }
  })();
  renderState();
  /* 实时镜像：iframe 页内登录/认证/入驻/退出（storage 跨文档事件）+ 本窗口 store 事件 → 侧栏自动同步 */
  function refreshAll() { renderState(); renderMode(); renderEntry(); renderKPI(); }
  window.addEventListener('storage', refreshAll);
  window.addEventListener('engchain:state', refreshAll);
  window.addEventListener('engchain:auth', refreshAll);
  window.addEventListener('engchain:entry', refreshAll);
  /* ---- 全屏展示 · 设备选择弹窗（浏览器窗口居中 / 自适应；仅已配置机型可点击） ---- */
  var btnShow = document.getElementById('btn-showcase');
  var fsOverlay = document.getElementById('fs-overlay');
  var fsClose = document.getElementById('fs-close');
  var fsReturnFocus = null;
  function openFs() {
    fsReturnFocus = document.activeElement;
    fsOverlay.classList.add('open');
    fsOverlay.setAttribute('aria-hidden', 'false');
    if (fsClose) { try { fsClose.focus(); } catch (e) {} }
  }
  function closeFs() {
    fsOverlay.classList.remove('open');
    fsOverlay.setAttribute('aria-hidden', 'true');
    if (fsReturnFocus && fsReturnFocus.focus) { try { fsReturnFocus.focus(); } catch (e) {} }
  }
  if (btnShow && fsOverlay) {
    btnShow.addEventListener('click', function (e) { e.preventDefault(); openFs(); });
    if (fsClose) fsClose.addEventListener('click', closeFs);
    /* 点击遮罩空白处关闭 */
    fsOverlay.addEventListener('click', function (e) { if (e.target === fsOverlay) closeFs(); });
    /* Esc 关闭 */
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fsOverlay.classList.contains('open')) closeFs(); });
    fsOverlay.querySelectorAll('.fs-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (card.classList.contains('disabled')) return;   /* 灰度机型：点击无效 */
        var href = card.getAttribute('data-href');
        if (href) window.location.href = href;
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  }
  /* ---- 妯″瀷灞曠ず 路 鎵嬫満澶栧３鍒囨崲 ---- */
  var currentShell = 'iphone';
  try { currentShell = localStorage.getItem('engchain-shell') || 'iphone'; } catch(e) {}
  var btnModel = document.getElementById('btn-model');
  var modelOverlay = document.getElementById('model-overlay');
  var modelClose = document.getElementById('model-close');
  var shellIphone = document.getElementById('shell-iphone');
  var shellPura = document.getElementById('shell-pura');
  var puraDevice = document.getElementById('pura-device');

  function switchShell(model) {
    currentShell = model;
    try { localStorage.setItem('engchain-shell', model); } catch(e) {}
    var frame = document.getElementById('frame');
    if (model === 'pura') {
      shellIphone.setAttribute('hidden', '');
      shellPura.removeAttribute('hidden');
      var ps = shellPura.querySelector('.pura-screen');
      if (frame && ps) ps.appendChild(frame);
    } else {
      shellPura.setAttribute('hidden', '');
      shellIphone.removeAttribute('hidden');
      var ips = shellIphone.querySelector('.ip-screen');
      if (frame && ips) ips.appendChild(frame);
    }
    applyScale();
  }

  function openModel() { modelOverlay.classList.add('open'); modelOverlay.setAttribute('aria-hidden','false'); }
  function closeModel() { modelOverlay.classList.remove('open'); modelOverlay.setAttribute('aria-hidden','true'); }

  if (btnModel && modelOverlay) {
    btnModel.addEventListener('click', function(e) { e.preventDefault(); openModel(); });
    if (modelClose) modelClose.addEventListener('click', closeModel);
    modelOverlay.addEventListener('click', function(e) { if (e.target === modelOverlay) closeModel(); });
    document.addEventListener('keydown', function(e) { if (e.key==='Escape' && modelOverlay.classList.contains('open')) closeModel(); });
    modelOverlay.querySelectorAll('.model-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var m = card.getAttribute('data-model');
        if (m) { switchShell(m); closeModel(); }
      });
    });
  }
  if (puraDevice) {
    puraDevice.addEventListener('click', function(e) {
      if (!e.target.closest('.pura-screen')) puraDevice.classList.toggle('flipped');
    });
  }

  /* ---- 机身配色切换 ---- */
  var SHELL_COLORS = {
    iphone: [
      { id:'natural', name:'原色钛', css:'linear-gradient(150deg,#48484A,#1E1E20)' },
      { id:'blue', name:'蓝色钛', css:'linear-gradient(150deg,#5B6F8A,#2A3A4A)' },
      { id:'white', name:'白色钛', css:'linear-gradient(150deg,#F5F5F7,#D8D8DC)' },
      { id:'black', name:'黑色钛', css:'linear-gradient(150deg,#3A3A3C,#1A1A1C)' }
    ],
    pura: [
      { id:'white', name:'零度白', css:'linear-gradient(150deg,#fdfefe,#cfd4de)' },
      { id:'red', name:'跃影红', css:'linear-gradient(150deg,#e04b6a,#8f0e31)' },
      { id:'flax', name:'亚麻灰', css:'linear-gradient(150deg,#d6d2c8,#8e8a7c)' },
      { id:'black', name:'幻夜黑', css:'linear-gradient(150deg,#5a5d65,#15171c)' }
    ]
  };
  var shellColors = { iphone:'natural', pura:'white' };
  try { var sc = JSON.parse(localStorage.getItem('engchain-shell-color') || '{}'); if (sc.iphone) shellColors.iphone = sc.iphone; if (sc.pura) shellColors.pura = sc.pura; } catch(e) {}

  function renderSwatches() {
    var box = document.getElementById('color-swatches');
    if (!box) return;
    var colors = SHELL_COLORS[currentShell] || SHELL_COLORS.iphone;
    box.innerHTML = colors.map(function(co) {
      return '<button class="swatch' + (shellColors[currentShell] === co.id ? ' active' : '') + '" data-color="' + co.id + '" style="background:' + co.css + ';" title="' + co.name + '"></button>';
    }).join('');
    box.querySelectorAll('.swatch').forEach(function(btn) {
      btn.addEventListener('click', function() { applyShellColor(this.getAttribute('data-color')); });
    });
  }

  function applyShellColor(color) {
    shellColors[currentShell] = color;
    try { localStorage.setItem('engchain-shell-color', JSON.stringify(shellColors)); } catch(e) {}
    var dev = (currentShell === 'pura') ? document.getElementById('pura-device') : document.getElementById('iphone-device');
    if (dev) dev.setAttribute('data-color', color);
    renderSwatches();
  }

  // 在 switchShell 中调用 renderSwatches
  var origSwitchShell = switchShell;
  switchShell = function(model) {
    origSwitchShell(model);
    renderSwatches();
    applyShellColor(shellColors[model]);
  };

  // 初始化配色
  renderSwatches();
  applyShellColor(shellColors[currentShell]);

  if (currentShell === 'pura') switchShell('pura');

  renderMode(); renderEntry(); renderKPI();
})();
