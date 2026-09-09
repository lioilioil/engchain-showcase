<!DOCTYPE html>
<html lang="zh-CN">
<head>
<script data-engchain-basefix="2">
(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();
</script><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>全部信息总览 · 工程链</title>
<link rel="stylesheet" href="../css/app.css">
<style>
/* ===== 全部信息总览页（all-listings）=====
   卡片样式与「发现」页 100% 一致：统一由 window.Cards.render 输出 .job-card，
   数据源为 js/data.js 的 catalog（+ 本地用户发布条目），与发现页同源。 */

/* 顶部统计 hero */
.al-hero {
  margin: 0 16px 14px; padding: 18px 18px 16px;
  background: linear-gradient(150deg, #1e1c2a 0%, #141320 55%, #191724 100%);
  color: #F4F2EE; border-radius: var(--r-xl); position: relative; overflow: hidden;
  box-shadow: var(--shadow-float);
}
.al-hero::before { content: ""; position: absolute; right: -30px; top: -40px; width: 170px; height: 170px; border-radius: 50%; background: radial-gradient(circle, rgba(201,169,97,.16), transparent 66%); }
.al-hero::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent); }
.al-hero-tag { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-display); font-size: 10px; font-weight: 600; letter-spacing: .16em; color: var(--primary); margin-bottom: 8px; position: relative; z-index: 1; }
.al-hero-tag::before { content: ""; width: 15px; height: 1px; background: var(--primary); opacity: .6; }
.al-hero-title { position: relative; z-index: 1; font-family: var(--font-display); font-size: 20px; font-weight: 700; line-height: 1.3; letter-spacing: -.01em; }
.al-hero-sub { position: relative; z-index: 1; font-size: 11.5px; color: rgba(244,242,238,.6); margin-top: 6px; line-height: 1.55; letter-spacing: .01em; }
.al-hero-stats { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 14px; padding: 12px 0 2px; border-top: 1px solid rgba(255,255,255,.10); }
.al-hero-stats .hs-item { text-align: center; }
.al-hero-stats .hs-item + .hs-item { border-left: 1px solid rgba(255,255,255,.08); }
.al-hero-stats .hs-num { font-family: var(--font-num); font-feature-settings: "tnum" 1; font-size: 17px; font-weight: 700; color: #F4F2EE; }
.al-hero-stats .hs-num i { font-style: normal; color: var(--primary); }
.al-hero-stats .hs-label { font-size: 10px; color: rgba(244,242,238,.55); margin-top: 2px; }

/* 吸顶分类导航 */
.al-nav { position: sticky; top: 0; z-index: 30; background: var(--bg); display: flex; gap: 7px; overflow-x: auto; padding: 10px 16px 12px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.al-nav::-webkit-scrollbar { display: none; }
.al-nav::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); opacity: 0; transition: opacity var(--d-fast); pointer-events: none; }
.al-nav.is-stuck::after { opacity: 1; }
.al-nav-chip {
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: var(--r-full); font-size: 12px; font-weight: 500;
  color: var(--text-2); background: var(--bg-card-2); border: 1px solid var(--line);
  cursor: pointer; transition: all var(--d-fast); white-space: nowrap; user-select: none;
}
.al-nav-chip:active { transform: scale(.96); }
.al-nav-chip .cn-cnt { font-family: var(--font-num); font-size: 10px; color: var(--text-3); }
.al-nav-chip.active { background: var(--primary-soft); border-color: var(--accent-line); color: var(--primary-dim); font-weight: 600; }
.al-nav-chip.active .cn-cnt { color: var(--primary-dim); }

/* 分组容器 */
.al-groups { padding-bottom: 30px; }
.al-section { margin: 0 16px 22px; }
.al-head { display: flex; align-items: center; gap: 10px; padding: 16px 0 10px; }
.al-ic {
  flex: none; width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dim));
  color: var(--text-inv); display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 10px -3px var(--primary-dim);
}
.al-ic svg { width: 17px; height: 17px; }
.al-tit { flex: 1; min-width: 0; }
.al-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); display: flex; align-items: baseline; gap: 7px; }
.al-name .an-cnt { font-family: var(--font-num); font-size: 11px; font-weight: 600; color: var(--text-3); }
.al-desc { font-size: 10.5px; color: var(--text-3); margin-top: 2px; line-height: 1.4; }
.al-link {
  flex: none; display: inline-flex; align-items: center; gap: 3px;
  font-size: 11.5px; font-weight: 600; color: var(--primary-dim);
  padding: 5px 11px; border-radius: var(--r-full); background: var(--primary-soft);
  text-decoration: none; transition: transform var(--d-fast);
}
.al-link:active { transform: scale(.96); }
.al-link svg { width: 11px; height: 11px; }
.al-cards { }
.al-cards .job-card { margin-left: 0; margin-right: 0; }
.al-empty { padding: 26px 16px; text-align: center; font-size: 12px; color: var(--text-3); background: var(--bg-card); border: 1px dashed var(--line); border-radius: var(--r-m); }

/* 底部说明 */
.al-foot { margin: 6px 16px 0; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--line); border-radius: var(--r-m); font-size: 11px; color: var(--text-3); line-height: 1.7; }
.al-foot b { color: var(--text-2); font-weight: 600; }
.al-foot .af-dot { color: var(--primary-dim); font-weight: 700; }
</style>
</head>
<body>
<div class="phone">
  <div class="navbar" style="height:50px;">
    <button class="nav-back" onclick="history.back()" aria-label="返回">‹</button>
    <div class="nav-title">全部信息总览</div>
    <div class="nav-right">
      <button class="icon-btn" onclick="location.href='search/index.html'" aria-label="搜索"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg></button>
    </div>
  </div>

  <div class="scroll no-pad" style="padding-bottom:40px;">
    <!-- 顶部统计 hero -->
    <div class="al-hero">
      <div class="al-hero-tag">ALL LISTINGS · 全部信息</div>
      <div class="al-hero-title">工程链全部信息业务<br>卡片式关联总览</div>
      <div class="al-hero-sub">材料 · 设备 · 劳务 · 项目合作 · 中介服务 · 资质招商 · 建企买卖 · 企业招聘 · 人才求职 —— 全部以「发现」页同款卡片展示，点击卡片进入对应详情页</div>
      <div class="al-hero-stats" id="heroStats"></div>
    </div>

    <!-- 吸顶分类导航 -->
    <nav class="al-nav" id="alNav" aria-label="信息分类"></nav>

    <!-- 分组卡片区 -->
    <div class="al-groups" id="alGroups"></div>

    <div class="al-foot">
      <b>说明</b>：本页为 <b>全部信息业务的关联展示页</b>，卡片样式与「发现」页（pages/supply/list.html）<b>逐类一致</b> ——
      由统一渲染器 <code style="font-family:var(--font-num);">window.Cards.render()</code> 输出 .job-card 卡片，数据来自 <code style="font-family:var(--font-num);">js/data.js</code> 的 catalog 目录，并同步混入本地用户发布的上架条目（与发现页 mergedList 同源）。
      点击任意卡片跳转至对应详情页（pages/supply/detail.html?id=…）；点击分组右上角「查看专页」进入该业务专页。
    </div>
  </div>
</div>

<script src="../js/data.js"></script>
<script src="../js/common.js"></script>
<script src="../js/stores.js"></script>
<script src="../js/databus.js"></script>
<script>
(function () {
  window.__ROOT__ = '../';

  /* ---- 与发现页（pages/supply/list.html）同源的合并数据逻辑 ---- */
  var BIZ_MAP = { '材料':'material','设备':'equipment','劳务':'labor','项目合作':'cooperation','合作':'cooperation','中介服务':'agency','中介':'agency','资质招商':'franchise','建企买卖':'trade','招聘':'personnel','求职':'talent' };

  function normSupplyItem(x) {
    var isUser = (x.source === 'user_publish' || x.source === 'migrated_publish');
    return Object.assign({}, x, {
      id: x.id, bizKey: x.bizKey || BIZ_MAP[x.cat] || 'material',
      dir: x.dir || x.type || 'demand', title: x.title || '', cat: x.cat || x.category || '',
      sub: x.sub || x.subType || '', city: x.city || x.location || '',
      price: x.price || x.budget || '', budget: x.budget || x.price || '', unit: x.unit || '',
      tags: x.tags || [], company: x.company || '',
      match: typeof x.match === 'number' ? x.match : (isUser ? 55 : 70),
      verified: x.verified !== undefined ? x.verified : !isUser, hot: x.hot || false,
      _badge: isUser ? '用户发布' : '平台认证'
    });
  }
  function readActiveSupplies() {
    try { return (window.SupplyStore ? SupplyStore.listActive() : []) || []; } catch (e) { return []; }
  }
  function mergedList() {
    var mock = (window.MOCK && MOCK.catalog) ? MOCK.catalog.slice() : [];
    var active = readActiveSupplies().map(normSupplyItem);
    var seen = {}, out = [];
    active.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = true; out.push(x); } });
    mock.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = true; out.push(x); } });
    return out;
  }

  /* ---- 分组定义（顺序 = 首页/发现页 tab 顺序）---- */
  var GROUPS = [
    { key: 'material',    label: '材料',      desc: '建材供应与采购需求',           icon: 'box',       page: 'supply/list.html?type=supply' },
    { key: 'equipment',   label: '设备',      desc: '机械租赁与设备供应',           icon: 'tool',      page: 'supply/list.html?type=supply' },
    { key: 'labor',       label: '劳务',      desc: '劳务班组与用工需求',           icon: 'user',      page: 'supply/list.html?type=supply' },
    { key: 'cooperation', label: '项目合作',  desc: '分包 / 联合体 / EPC 合作机会', icon: 'buil',      page: 'supply/list.html?type=supply' },
    { key: 'agency',      label: '中介服务',  desc: '资质代办 / 担保 / 造价 / 派遣', icon: 'headset',   page: 'supply/list.html?type=service' },
    { key: 'franchise',   label: '资质招商',  desc: '资质加盟 / 招商合作',          icon: 'award',     page: 'franchise/index.html' },
    { key: 'trade',       label: '建企买卖',  desc: '企业股权与资产转让',           icon: 'bank',      page: 'trade/index.html' },
    { key: 'personnel',   label: '企业招聘',  desc: '企业持证人才招聘需求',         icon: 'recruit',   page: 'personnel/index.html' },
    { key: 'talent',      label: '人才求职',  desc: '持证人才求职供给',             icon: 'user',      page: 'personnel/index.html?tab=talent' }
  ];

  /* ---- 渲染统计 hero ---- */
  function renderHero(list) {
    var verified = list.filter(function (x) { return x.verified; }).length;
    var hot = list.filter(function (x) { return x.hot; }).length;
    var userPub = list.filter(function (x) { return x._badge === '用户发布'; }).length;
    var el = document.getElementById('heroStats');
    el.innerHTML = [
      { n: list.length, l: '信息总数' },
      { n: GROUPS.length, l: '业务类型' },
      { n: verified, l: '平台认证' },
      { n: hot, l: '热点信息' }
    ].map(function (s, i) {
      var n = String(s.n);
      if (i === 3) n = n + '<i>+</i>';
      return '<div class="hs-item"><div class="hs-num">' + n + '</div><div class="hs-label">' + s.l + '</div></div>';
    }).join('');
  }

  /* ---- 渲染吸顶分类导航 ---- */
  function renderNav(list) {
    var nav = document.getElementById('alNav');
    var chips = GROUPS.map(function (g, i) {
      var n = list.filter(function (x) { return x.bizKey === g.key; }).length;
      return '<span class="al-nav-chip' + (i === 0 ? ' active' : '') + '" data-key="' + g.key + '">' + g.label + '<span class="cn-cnt">' + n + '</span></span>';
    }).join('');
    nav.innerHTML = chips;
    nav.querySelectorAll('.al-nav-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        nav.querySelectorAll('.al-nav-chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
        var target = document.getElementById('sec-' + chip.dataset.key);
        var scroll = document.querySelector('.scroll');
        if (target && scroll) scroll.scrollTo({ top: target.offsetTop - 46, behavior: 'smooth' });
      });
    });
  }

  /* ---- 渲染分组卡片区（Cards.render 与发现页同款） ---- */
  function renderGroups(list) {
    var wrap = document.getElementById('alGroups');
    wrap.innerHTML = GROUPS.map(function (g) {
      var items = list.filter(function (x) { return x.bizKey === g.key; });
      var cardsHtml = items.length
        ? window.Cards.render(items, 'supply/detail.html?id=')
        : '<div class="al-empty">该分类暂无信息</div>';
      return '<section class="al-section" id="sec-' + g.key + '">' +
        '<div class="al-head">' +
          '<div class="al-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><use href="#i-' + g.icon + '"/></svg></div>' +
          '<div class="al-tit">' +
            '<div class="al-name">' + g.label + '<span class="an-cnt">' + items.length + ' 条</span></div>' +
            '<div class="al-desc">' + g.desc + ' · 与「发现」页同款卡片</div>' +
          '</div>' +
          '<a class="al-link" href="' + g.page + '">查看专页<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg></a>' +
        '</div>' +
        '<div class="al-cards">' + cardsHtml + '</div>' +
      '</section>';
    }).join('');

    /* 为用户发布条目注入角标（与发现页一致） */
    var cards = wrap.querySelectorAll('.al-cards .job-card');
    var idx = 0;
    GROUPS.forEach(function (g) {
      list.filter(function (x) { return x.bizKey === g.key; }).forEach(function (item) {
        if (item._badge && cards[idx]) {
          var tag = document.createElement('span');
          tag.className = 'tag ' + (item._badge === '用户发布' ? 'tag-supply' : 'tag-gold');
          tag.style.cssText = 'margin-left:6px;font-size:10px;';
          tag.textContent = item._badge;
          var tagsRow = cards[idx].querySelector('.jc-tags');
          if (tagsRow) tagsRow.appendChild(tag);
        }
        idx++;
      });
    });
  }

  /* ---- 吸顶分隔线检测 ---- */
  function checkStuck() {
    var nav = document.getElementById('alNav');
    var scroll = document.querySelector('.scroll');
    if (!nav || !scroll) return;
    var nr = nav.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
    nav.classList.toggle('is-stuck', nr.top <= sr.top + 4);
  }

  function render() {
    var list = mergedList();
    renderHero(list);
    renderNav(list);
    renderGroups(list);
    checkStuck();
  }

  var scrollEl = document.querySelector('.scroll');
  if (scrollEl) {
    scrollEl.addEventListener('scroll', checkStuck);
    window.addEventListener('resize', checkStuck);
  }
  render();
  window.addEventListener('engchain:supply', render);
  window.addEventListener('storage', function (e) { if (e.key === 'engchain-supply') render(); });
})();
</script>
</body>
</html>
