(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();


(function () {
  window.__ROOT__ = '';

  /* ---- 信息流内嵌轮播：原顶部小轮播移入下方"资源/供需"列表中间（每列表各插 1 次） ---- */
  var INFEED_SLIDES = [
    { bg: 'linear-gradient(120deg,#3A2F1D 0%,#6B5326 60%,#8A6A2E 100%)', tag: 'AI 智能匹配', title: '直达高匹配供需', sub: '依据身份与浏览足迹 · 实时更新' },
    { bg: 'linear-gradient(120deg,#2B2B33 0%,#3E3E4A 60%,#4C4C5A 100%)', tag: '合规保障', title: '平台核验 · 双端认证', sub: '企业工商 + 实名认证，信息可信' },
    { bg: 'linear-gradient(120deg,#20301F 0%,#2F4A2C 55%,#3D6038 100%)', tag: '热点 · 供应', title: '西南自营仓库 · 现货', sub: '盘扣脚手架 ¥0.32/吨/天 · 可租可售' },
    { bg: 'linear-gradient(120deg,#1E2C3E 0%,#29435C 55%,#33546F 100%)', tag: '重点 · 需求', title: '天府新区 急需 C30/C40', sub: '预算 ¥135万 · 成都 · 需方直连' }
  ];
  function infeedCarouselHTML() {
    return '<div class="app-carousel" id="carousel"><div class="ac-track" id="ac-track">' +
      INFEED_SLIDES.map(function (s) {
        /* E3-15 轮播 slide 可点击 → AI 搜索页 */
        return '<div class="ac-slide" style="background:' + s.bg + ';cursor:pointer;" onclick="location.href=\'pages/search/index.html?mode=ai\'"><span class="ac-tag">' + s.tag + '</span><div><div class="ac-title">' + s.title + '</div><div class="ac-sub">' + s.sub + '</div></div></div>';
      }).join('') +
      '</div><div class="ac-dots" id="ac-dots"></div></div>';
  }
  var acTimer = null;
  function initInfeedCarousel() {
    var track = document.getElementById('ac-track');
    var dots = document.getElementById('ac-dots');
    if (!track || !dots) return;
    clearInterval(acTimer);
    var slides = track.children.length, idx = 0;
    dots.innerHTML = '';
    for (var i = 0; i < slides; i++) { var d = document.createElement('i'); d.className = 'ac-dot'; dots.appendChild(d); }
    var dNodes = dots.querySelectorAll('.ac-dot');
    function go(n) {
      idx = (n + slides) % slides;
      track.style.transform = 'translateX(-' + idx * 100 + '%)';
      dNodes.forEach(function (d, k) { d.classList.toggle('active', k === idx); });
    }
    function autoplay() {
      clearInterval(acTimer);
      acTimer = setInterval(function () { go(idx + 1); }, 4000);
    }
    go(0); autoplay();
  }
  /* 在渲染后的卡片列表中插入轮播：只 1 次，置于列表中间（资源 / 供需 每个列表均插） */
  function injectInfeedCarousel() {
    var cards = tabList.children;
    var n = cards.length;
    if (n === 0) return;
    var anchor = cards[Math.floor((n - 1) / 2)];
    if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', infeedCarouselHTML());
    initInfeedCarousel();
  }

  /* ---- 重点项目 / 共创 轮播：自动 + 指示点 + 触摸拖动 ---- */
  (function () {
    /* 共创卡为「破冰期」活动引导入口：成熟期隐藏（ModeStore 与 preview 运营周期同源） */
    var coCreateCard = document.getElementById('co-create-card');
    if (coCreateCard && window.ModeStore && !ModeStore.isBreakIn()) {
      coCreateCard.parentNode.removeChild(coCreateCard);
    }
    var box = document.getElementById('hero-carousel');
    var htrack = document.getElementById('hc-track');
    var hdots = document.getElementById('hc-dots');
    var n = htrack.children.length, hi = 0, htimer;
    for (var k = 0; k < n; k++) { var dot = document.createElement('button'); dot.type = 'button'; dot.className = 'hc-dot'; hdots.appendChild(dot); }
    var dn = hdots.querySelectorAll('.hc-dot');
    function hgo(x) {
      hi = (x + n) % n;
      htrack.style.transform = 'translateX(-' + hi * 100 + '%)';
      dn.forEach(function (d, j) { d.classList.toggle('active', j === hi); });
    }
    function hplay() { clearInterval(htimer); htimer = setInterval(function () { hgo(hi + 1); }, 4500); }
    dn.forEach(function (d, j) { d.addEventListener('click', function () { hgo(j); hplay(); }); });
    var sx = 0, ddx = 0, dragging = false;
    htrack.addEventListener('touchstart', function (e) { dragging = true; sx = e.touches[0].clientX; ddx = 0; clearInterval(htimer); htrack.style.transition = 'none'; }, { passive: true });
    htrack.addEventListener('touchmove', function (e) { if (!dragging) return; ddx = e.touches[0].clientX - sx; htrack.style.transform = 'translateX(calc(-' + hi * 100 + '% + ' + ddx + 'px))'; }, { passive: true });
    function endDrag() {
      if (!dragging) return; dragging = false; htrack.style.transition = '';
      var w = box.clientWidth;
      if (ddx > w * 0.2) hgo(hi - 1); else if (ddx < -w * 0.2) hgo(hi + 1); else hgo(hi);
      ddx = 0; hplay();
    }
    htrack.addEventListener('touchend', endDrag);
    htrack.addEventListener('touchcancel', endDrag);
    /* 共创卡 → 共创者计划活动详情页（破冰期运营活动入口） */
    var co = document.getElementById('co-create-card');
    if (co) {
      co.addEventListener('click', function () { location.href = (window.__ROOT__ || '') + 'pages/co-create/index.html'; });
      co.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = (window.__ROOT__ || '') + 'pages/co-create/index.html'; } });
    }
    /* 运营周期在 preview / 后台切换时（跨窗口 storage 事件）重载，保证卡片显隐同步 */
    window.addEventListener('storage', function (ev) { if (ev.key === 'engchain-mode') location.reload(); });
    hgo(0); hplay();
  })();

  /* ---- 定位：点击弹出城市选择（80% 底部弹层，选择后持久化） ---- */
  (function () {
    var loc = document.getElementById('app-location');
    var locText = document.getElementById('app-location-text');
    var saved = localStorage.getItem('engchain-city');
    if (saved) { locText.textContent = saved; }
    else {
      /* [Auth 连通] 首次进入未设置城市时，默认用已认证地域兜底 */
      try {
        var au = (window.AuthStore && AuthStore.read) ? AuthStore.read() : {};
        var en = au.enterprise || {};
        var basic = (au.personalEntry && au.personalEntry.profile && au.personalEntry.profile.basic) || {};
        var region = en.region || basic.location || '';
        if (region) locText.textContent = region;
      } catch (e) {}
    }
    function openCity() {
      UI.cityPicker({
        current: locText.textContent,
        onSelect: function (city) {
          locText.textContent = city;
          localStorage.setItem('engchain-city', city);
          UI.toast('已切换至 ' + city, 'ok');
        }
      });
    }
    loc.addEventListener('click', openCity);
    loc.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCity(); } });
  })();

  /* ---- E1-01 / E1-13：顶栏登录入口 + 首页按身份状态的条件横幅 ---- */
  (function () {
    var AUTH_LOGIN = (window.__ROOT__ || '') + 'pages/auth/login.html';
    var root = window.__ROOT__ || '';

    function meIdy() {
      try { if (window.deriveIdentity) return deriveIdentity(); } catch (e) {}
      return { primary: 'guest', isGuest: true, enterprise: 'none', personal: 'none' };
    }
    function meState() {
      try { return UI.state.get(); } catch (e) { return {}; }
    }

    /* E1-01 顶栏右侧：游客=登录/注册胶囊；已登录=隐藏（用户入口由侧边栏/个人中心承担，避免重复） */
    function renderAuthEntry() {
      var box = document.getElementById('home-auth-entry');
      if (!box) return;
      var st = meState();
      if (!st.loggedIn) {
        box.style.display = '';
        box.innerHTML =
          '<a href="' + AUTH_LOGIN + '" style="display:inline-flex;align-items:center;height:30px;padding:0 13px;border-radius:999px;background:linear-gradient(135deg,var(--primary),var(--primary-dim));color:var(--text-inv);font-size:12px;font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,.28);white-space:nowrap;">登录/注册</a>';
      } else {
        box.style.display = 'none';
      }

       }

 /* E1-13 首页 6 级状态条件横幅：游客注册引导 / 已认证权益提示 / 入驻用户专属入口 */
    function renderStatusBanner() {
      var box = document.getElementById('home-status-banner');
      if (!box) return;
      var idy = meIdy();
      var html = '';
      if (idy.isGuest || idy.primary === 'guest') {
        /* 游客：注册引导横幅 */
        html = '<div onclick="location.href=\'' + AUTH_LOGIN + '\'" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(37,99,235,.10),rgba(37,99,235,.03));border:1px solid rgba(37,99,235,.18);cursor:pointer;">' +
          '<span style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--text-1);">注册即送 50 积分 · 实名认证免费解锁</div>' +
          '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">发布供需、联系洽谈、收藏关注，一站式工程合作</div></span>' +
          '<span style="flex:none;height:30px;padding:0 13px;border-radius:999px;background:var(--primary);color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;">立即注册</span>' +
        '</div>';
      } else if (idy.enterprise === 'resident') {
        /* 入驻用户：专属入口 */
        html = '<div style="padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(201,169,97,.14),rgba(201,169,97,.04));border:1px solid rgba(201,169,97,.28);">' +
          '<div style="font-size:12.5px;font-weight:700;color:var(--primary-dim);margin-bottom:8px;">入驻专属工作台</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<a href="' + root + 'pages/publish/records.html" style="flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:var(--primary-soft);font-size:11.5px;font-weight:600;color:var(--primary-dim);text-decoration:none;">我的发布</a>' +
            '<a href="' + root + 'pages/distribution/index.html" style="flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:var(--primary-soft);font-size:11.5px;font-weight:600;color:var(--primary-dim);text-decoration:none;">佣金数据</a>' +
            '<a href="' + root + 'pages/profile/entry.html" style="flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:var(--primary-soft);font-size:11.5px;font-weight:600;color:var(--primary-dim);text-decoration:none;">入驻服务</a>' +
          '</div></div>';
      } else if (idy.primary === 'realname' || idy.primary === 'pro' || idy.primary === 'partner' || idy.primary === 'enterprise') {
        /* 已认证（实名+）：权益提示 */
        html = '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:14px;background:var(--success-soft,rgba(91,154,111,.1));border:1px solid rgba(91,154,111,.22);">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex:none;color:var(--success,#5B9A6F);"><path d="M20 6L9 17l-5-5"/></svg>' +
          '<span style="flex:1;font-size:12px;color:var(--text-2);">已完成认证 · 发布供需与联系洽谈权益已解锁，入驻企业享专属折扣</span>' +
          '<a href="' + root + 'pages/profile/auth-prep.html" style="flex:none;font-size:11.5px;font-weight:700;color:var(--primary-dim);text-decoration:none;">去入驻 ›</a>' +
        '</div>';
      }
      box.innerHTML = html;
    }

    /* E2-19 破冰期优惠横幅显隐 */
    function renderBreakinBanner() {
      var b = document.getElementById('home-breakin-banner');
      if (!b) return;
      var on = !!(window.ModeStore && ModeStore.isBreakIn());
      b.style.display = on ? 'flex' : 'none';
      /* [FIX] 常驻福利条：破冰期显示新用户福利，正式期隐藏或显示实名认证权益 */
      var wb = document.getElementById('home-welfare-bar');
      if (wb) wb.style.display = on ? 'block' : 'none';
    }

    function renderAll() { renderAuthEntry(); }
    renderAll();


    /* 监听身份/入驻/存储变化，重渲染（E1-13 状态感知） */
    window.addEventListener('engchain:auth', renderAll);
    window.addEventListener('engchain:entry', renderAll);
    window.addEventListener('engchain:store-change', renderAll);
    window.addEventListener('engchain:state', renderAll);
    window.addEventListener('storage', function (e) {
      if (e.key && e.key.indexOf('engchain-') === 0) renderAll();
    });
  })();

  /* ---- 统一分类卡片（供需 / 资源 共用 · 9 类模板由 js/common.js 的 window.Cards 提供） ---- */

  /* ---- mergedList 同源：MOCK.catalog + SupplyStore active（用户发布） ---- */
  var FLOW_KEYS = {
    match: ['material','equipment','labor','cooperation','agency'],
    resource: ['franchise','trade','personnel','talent']
  };
  function readActiveSupplies() {
    try { return (window.SupplyStore ? SupplyStore.listActive() : []) || []; } catch (e) { return []; }
  }
  function mergedCatalog() {
    var mock = (window.MOCK && MOCK.catalog) ? MOCK.catalog.slice() : [];
    var active = readActiveSupplies();
    var seen = {}, out = [];
    active.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = true; out.push(x); } });
    mock.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = true; out.push(x); } });
    return out;
  }
  function listFor(flow, key) {
    var all = mergedCatalog();
    if (key === 'all') return all.filter(function (x) { return FLOW_KEYS[flow].indexOf(x.bizKey) >= 0; });
    return all.filter(function (x) { return x.bizKey === key; });
  }
  function countFor(flow, key) { return listFor(flow, key).length; }

  /* ---- 一级 Tab：供需 / 资源（随上滑吸顶） ---- */
  var segItems = document.querySelectorAll('#home-tabs .seg-item');
  var tabList = document.getElementById('tab-list');
  segItems.forEach(function (it) { it.querySelector('.seg-cnt').textContent = countFor(it.dataset.flow, 'all'); });

  /* ---- 二级分类 Tab（全部 + 两字分类 · 横向滑动 · 动画指示条） ---- */
  var SUBTABS = {
    match: [{ key: 'all', label: '全部' }, { key: 'cooperation', label: '项目合作' }, { key: 'material', label: '材料' }, { key: 'equipment', label: '设备' }, { key: 'labor', label: '劳务' }, { key: 'agency', label: '中介' }],
    resource: [{ key: 'all', label: '全部' }, { key: 'franchise', label: '资质招商' }, { key: 'trade', label: '建企买卖' }, { key: 'personnel', label: '企业招聘' }, { key: 'talent', label: '人才求职' }]
  };
  var subTabs = document.getElementById('sub-tabs');
  var subScroll = document.getElementById('sub-scroll');
  var subInd = document.getElementById('sub-ind');
  var subMore = document.getElementById('sub-more');
  var currentFlow = 'match', currentSub = 'all';

  function renderList() {
    tabList.innerHTML = window.Cards.render(listFor(currentFlow, currentSub));
    injectInfeedCarousel();
  }
  /* 查看全部：供需→发现页；资源→对应专门页（资质招商/建企买卖/人员招聘/持证人才） */
  function updateMoreLink() {
    if (currentFlow === 'resource') {
      /* 资源"全部"：首页已内联完整展示，隐藏查看全部 */
      if (currentSub === 'all') { subMore.style.display = 'none'; return; }
      subMore.style.display = '';
      var R = {
        franchise: 'pages/franchise/index.html',
        trade: 'pages/trade/index.html',
        personnel: 'pages/personnel/index.html',
        talent: 'pages/personnel/index.html?tab=talent'
      };
      subMore.href = R[currentSub] || '';
      return;
    }
    subMore.style.display = '';
    if (currentSub === 'all') {
      /* 供需"全部"：首页已内联完整展示，隐藏查看全部（与资源一致） */
      subMore.style.display = 'none';
      return;
    }
    subMore.href = 'pages/supply/list.html';
  }
  function moveInd(item) {
    var sr = subScroll.getBoundingClientRect(), ir = item.getBoundingClientRect();
    var x = Math.round(ir.left - sr.left + subScroll.scrollLeft);
    var w = Math.round(ir.width);
    subInd.style.transform = 'translateX(' + x + 'px)';
    subInd.style.width = w + 'px';
  }
  function renderSubs(flow) {
    currentFlow = flow; currentSub = 'all';
    subScroll.innerHTML = SUBTABS[flow].map(function (t) {
      var n = countFor(flow, t.key);
      return '<button type="button" class="sub-item' + (t.key === 'all' ? ' active' : '') + '" data-key="' + t.key + '"><span class="sub-label">' + t.label + '</span><span class="sub-cnt">' + n + '</span></button>';
    }).join('');
    subScroll.appendChild(subInd);
    subScroll.scrollLeft = 0;
    var first = subScroll.querySelector('.sub-item');
    if (first) moveInd(first);
    renderList();
    updateMoreLink();
  }
  subScroll.addEventListener('click', function (e) {
    var btn = e.target.closest('.sub-item');
    if (!btn) return;
    currentSub = btn.dataset.key;
    subScroll.querySelectorAll('.sub-item').forEach(function (x) { x.classList.toggle('active', x === btn); });
    moveInd(btn);
    renderList();
    updateMoreLink();
    /* 手动滚动 sub-scroll，使选中项水平居中；避免 scrollIntoView 递归滚动外层 .scroll 导致整页左移 */
    var targetLeft = btn.offsetLeft - (subScroll.clientWidth - btn.offsetWidth) / 2;
    var maxLeft = Math.max(0, subScroll.scrollWidth - subScroll.clientWidth);
    subScroll.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior: 'smooth' });
  });
  segItems.forEach(function (it) { it.addEventListener('click', function () { segItems.forEach(function (x) { x.classList.toggle('active', x === it); }); renderSubs(it.dataset.flow); }); });
  /* 手势优先级：在 #tab-list 上左右滑 → 先滚二级分类条 → 到头切 资源/供需 → 再到头切主页面 */
  function switchFlow(f){ segItems.forEach(function(x){ x.classList.toggle('active', x.dataset.flow===f); }); renderSubs(f); }
  window.__SWIPE_ZONES__ = window.__SWIPE_ZONES__ || [];
  window.__SWIPE_ZONES__.push({
    trigger: '#tab-list',
    consumers: [
      { type: 'scroll', el: '#sub-scroll' },
      { type: 'seg',
        canNext: function () { return currentFlow === 'resource'; },
        next:    function () { switchFlow('match'); },
        canPrev: function () { return currentFlow === 'match'; },
        prev:    function () { switchFlow('resource'); } }
    ]
  });
  renderSubs('resource');
})();
