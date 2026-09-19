/* 左右滑动切页 —— 全局手势层（挂在 .phone 上，各页零改动）
 *
 * 规则（2026-09-17 与用户确认）：
 *   · 5 个主站页按站序环游：主页 → 发现 → 消息 → 我的 → 信息工作台
 *     左滑 = 下一站，右滑 = 上一站；序列两端缺的方向做橡皮筋回弹（不出邻站牌、不切页）
 *   · 其余子页：右滑 = 返回父页（左滑无目标 → 橡皮筋）
 *   · 4 个多入口页（supply/detail、auth/login、company/index、search/business）
 *     固定父页必然回错地方（同一页从 A 进和从 B 进，右滑都回同一处），改用 UI.back()
 *   · 手势优先让给当前页的横向滚动区（分类条/连拍图）：区域滚到端点后，
 *     超出的那段位移才驱动页面位移（无缝接力，无跳变）
 *   · 自管横向手势、且不是滚动容器的容器，加 data-swipe-ignore 属性即可豁免
 *     （home.html 的 #hc-track、pages/wallet/index.html 的 #car-wrap —— transform 驱动，滚不动）
 *
 * 只在归属表内的 app 页生效：admin/、docs/、folder-cards/、.tmp_backup_* 等
 * 同仓库其它界面即使有 .phone 也不会被挂上手势（它们不在表内）。
 *
 * 归属表由 artifacts/swipe-nav/gen-parent-map.js 生成（证据是实际入站链接，
 * 不是人工猜测）。新增页面后重跑该脚本，粘贴下面的 OVERRIDE / INDEX_DIRS。
 */
(function () {
  'use strict';
  if (window.SwipeNav) return;

  var ROOT = window.__ROOT__ || '';

  /* ===================== 数据 ===================== */

  /* 站序：左滑=下一站，右滑=上一站。图标与 common.js 的 tabbar TABS 同源 */
  var STATIONS = [
    { path: 'home.html',                label: '首页',       icon: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3Z"/>' },
    { path: 'pages/supply/list.html',   label: '发现',       icon: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
    { path: 'pages/message/index.html', label: '消息',       icon: '<path d="M21 12a8 8 0 1 0-3.2 6.4L21 21l-.6-3.2A8 8 0 0 0 21 12Z"/>' },
    { path: 'pages/profile/index.html', label: '我的',       icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>' },
    { path: 'pages/publish/index.html', label: '信息工作台', icon: '<path d="M12 5v14M5 12h14"/>' }
  ];

  /* 子页返回时邻站牌上的图标（不是站名，所以用返回箭头而不是站图标） */
  var BACK_ICON = '<path d="M15 5l-7 7 7 7"/>';

  /* R1 默认规则的作用域：这些目录的 index.html 就是同目录子页的父页（67 页） */
  var INDEX_DIRS = [
    'pages/agency', 'pages/api', 'pages/co-create', 'pages/company', 'pages/distribution',
    'pages/favorite', 'pages/franchise', 'pages/guide', 'pages/help', 'pages/industry',
    'pages/message', 'pages/monitor', 'pages/order', 'pages/personal', 'pages/personnel',
    'pages/profile', 'pages/publish', 'pages/refund', 'pages/search', 'pages/trade', 'pages/wallet'
  ];

  /* 显式父页：R1 判不出来的（目录无 index / 顶层区段）+ R1 判错的（多入口页） */
  var OVERRIDE = {
    'pages/agency/demo-reset.html': 'pages/profile/index.html',
    'pages/agency/index.html': 'home.html',
    'pages/agreement/privacy.html': 'pages/profile/settings.html',
    'pages/agreement/user.html': 'pages/profile/settings.html',
    'pages/api/index.html': 'pages/profile/all-functions.html',
    'pages/auth/banned.html': 'pages/auth/login.html',
    'pages/auth/login.html': 'home.html',
    'pages/auth/register.html': 'pages/auth/login.html',
    'pages/co-create/index.html': 'home.html',
    'pages/distribution/index.html': 'pages/profile/index.html',
    'pages/favorite/index.html': 'pages/profile/index.html',
    'pages/franchise/index.html': 'home.html',
    'pages/guide/index.html': 'home.html',
    'pages/help/index.html': 'pages/profile/index.html',
    'pages/industry/index.html': 'pages/profile/all-functions.html',
    'pages/match/preferences.html': 'pages/profile/all-functions.html',
    'pages/monitor/index.html': 'home.html',
    'pages/order/index.html': 'pages/profile/index.html',
    'pages/personal/index.html': 'pages/publish/index.html',
    'pages/personnel/index.html': 'pages/supply/list.html',
    'pages/platform/dashboard.html': 'pages/profile/index.html',
    'pages/refund/appeal.html': 'pages/refund/index.html',
    'pages/refund/index.html': 'pages/profile/index.html',
    'pages/search/index.html': 'home.html',
    'pages/trade/index.html': 'pages/supply/list.html',
    'pages/vendor/dashboard.html': 'pages/profile/all-functions.html',
    'pages/vendor/upgrades.html': 'pages/profile/all-functions.html',
    'pages/wallet/index.html': 'pages/profile/index.html'
  };

  /* 多入口页：有历史就回历史，没有才落到上面的固定父页（UI.back 自己会兜底到首页） */
  var USE_HISTORY = {
    'pages/supply/detail.html': 1,
    'pages/auth/login.html': 1,
    'pages/company/index.html': 1,
    'pages/search/business.html': 1
  };

  /* ===================== 配置 ===================== */

  var CFG = {
    lockPx: 8,          /* 轴向锁定阈值 */
    lockRatio: 1.2,     /* |dx| > |dy| * ratio 才算横向，否则让给纵向滚动 */
    commit: 0.28,       /* 提交阈值：占屏宽比例（与 tabbar 的 positions[0].width*0.28 同口径） */
    flickRatio: 0.10,   /* 轻扫提交所需的最小位移 */
    flickV: 0.45,       /* 轻扫速度阈值 px/ms */
    flickMs: 200,       /* 速度采样的最大时间跨度 */
    resist: 0.35,       /* 该方向没有目标时的橡皮筋阻尼 */
    tapPx: 8,           /* 手指行程超过它就算「滑动」而非「点击」：滑动结束后吞掉补发的 click */
    spring: 320,        /* 回弹时长 */
    commitMs: 300,      /* 提交滑出时长，与 pageTransition 的淡出（300ms）对齐 */
    parallax: 0.3       /* 邻站牌视差（相对内容位移的比例） */
  };

  /* 不参与位移的骨架：状态栏/灵动岛由 common.js 注入 .phone 内部且是静态流内元素，
     必须按类名排除，否则状态栏会跟着手指滑走 */
  var CHROME = '.status-bar, .dynamic-island, .app-nav-shell, .pura-sidebar, .swipe-peek';
  /* 手势起始点落在这些区域时直接放弃（把事件留给 tabbar 自己的横向拖动；
     AI 球在 .app-nav-shell 内，一并让开 —— 球是禁改项，不碰它的交互面） */
  var BAIL = '.app-nav-shell, .app-tabbar, .pura-sidebar';
  /* 自管横向手势的容器 */
  var IGNORE = '[data-swipe-ignore]';
  /* 这些元素上按下不启动手势，保住文本选择/输入 */
  var TEXT = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

  /* ===================== 归属 ===================== */

  /* 当前页在仓库内的相对路径。以 '/pages/' 为锚，兼容子路径部署与 file:// */
  function currentPath() {
    var p = location.pathname;
    var i = p.indexOf('/pages/');
    if (i >= 0) return p.slice(i + 1);
    if (/(^|\/)home\.html$/.test(p)) return 'home.html';
    return null;
  }

  function parentOf(path) {
    if (OVERRIDE[path]) return OVERRIDE[path];
    var slash = path.lastIndexOf('/');
    if (slash < 0) return 'home.html';                       /* 根层页（home.html 已由站序处理） */
    var dir = path.slice(0, slash);
    var file = path.slice(slash + 1);
    if (dir === 'pages') return 'home.html';
    if (file === 'index.html') return null;                  /* 区段首页都在 OVERRIDE 里 */
    return INDEX_DIRS.indexOf(dir) >= 0 ? dir + '/index.html' : null;
  }

  /* 返回 null = 不在归属表内，本页不挂手势 */
  function buildTargets(path) {
    for (var i = 0; i < STATIONS.length; i++) {
      if (STATIONS[i].path !== path) continue;
      return {
        next: i < STATIONS.length - 1 ? STATIONS[i + 1] : null,   /* 左滑 */
        prev: i > 0 ? STATIONS[i - 1] : null                      /* 右滑 */
      };
    }
    var par = parentOf(path);
    var byHistory = !!USE_HISTORY[path];
    if (!par && !byHistory) return null;
    return {
      next: null,
      prev: { label: '返回', icon: BACK_ICON, path: par, useHistory: byHistory }
    };
  }

  /* ===================== 状态 ===================== */

  var phone = null;
  var targets = null;
  var reduced = false;
  var curW = 0;
  var layers = [];
  var peek = null, peekCard = null, peekIco = null, peekLbl = null;
  var drag = null;
  var springTimer = 0;
  var lastTouchTs = 0;
  var activeRegion = null;          /* 本次手势正在接力的横滑区（收尾时要还原它的滚动行为） */
  var activeRegionBehavior = '';

  function fitScale() {
    var v = parseFloat(getComputedStyle(phone).getPropertyValue('--fit-scale'));
    return (isFinite(v) && v > 0) ? v : 1;
  }

  /* ===================== 邻站牌 =====================
     画在内容层「之上」，用 clip-path 裁成内容实际让出的那条缝。
     为什么不藏在内容层下面：各页的内容层（.app-top / .scroll / .profile-page）
     都没有自己的背景，页面背景来自 .phone —— 内容层是透明的，藏在下面的
     邻站牌会透过内容整片显出来。裁切则天然正确：缝里显示的内容来自屏幕外
     （空的），所以裁出来的那块必然是纯背景。也因此不需要重构 DOM。 */

  function injectPeek() {
    phone.insertAdjacentHTML('afterbegin',
      '<div class="swipe-peek" aria-hidden="true" data-side="next">' +
        '<div class="swipe-peek-card">' +
          '<span class="swipe-peek-ico"></span>' +
          '<span class="swipe-peek-lbl"></span>' +
        '</div>' +
      '</div>');
    peek = phone.querySelector('.swipe-peek');
    peekCard = peek.querySelector('.swipe-peek-card');
    peekIco = peek.querySelector('.swipe-peek-ico');
    peekLbl = peek.querySelector('.swipe-peek-lbl');
    setPeekSide('next');
  }

  function setPeekSide(side) {
    var t = side === 'next' ? targets.next : targets.prev;
    peek.setAttribute('data-side', side);
    peekLbl.textContent = t ? t.label : '';
    peekIco.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      (t ? t.icon : '') + '</svg>';
  }

  /* 缝宽 rest（内容让出多少像素就露出多少）；rest = 屏宽即整层裁掉 */
  function clipFor(side, rest) {
    return side === 'next'
      ? 'inset(0 0 0 ' + rest + 'px)'      /* 左起裁掉 rest → 只留右侧 rest 宽 */
      : 'inset(0 ' + rest + 'px 0 0)';     /* 右起裁掉 rest → 只留左侧 rest 宽 */
  }
  function clipClosed(side) {
    return side === 'next' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
  }

  /* ===================== 内容层 ===================== */

  /* 跟着手指走的层：.phone 的直接子元素里，去掉骨架与浮层。
     每次手势开始时重算 —— Pura 侧边栏等是运行时插进来的 */
  function contentLayers() {
    var out = [];
    var kids = phone.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.matches(CHROME)) continue;
      var pos = getComputedStyle(el).position;
      if (pos === 'absolute' || pos === 'fixed') continue;
      out.push(el);
    }
    return out;
  }

  /* ===================== 手势 ===================== */

  /* 触点在哪个横向滚动容器内（.scroll 与各轮播是 overflow-x:hidden，自动不入选） */
  function findRegion(el) {
    while (el && el !== phone) {
      if (el.scrollWidth - el.clientWidth > 1) {
        var ox = getComputedStyle(el).overflowX;
        if (ox === 'auto' || ox === 'scroll') return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function onStart(e) {
    if (e.type === 'mousedown') {
      if (e.button !== 0) return;
      if (Date.now() - lastTouchTs < 700) return;             /* 触摸后的合成鼠标事件 */
      if (e.target.closest && e.target.closest(TEXT)) return;
    } else {
      lastTouchTs = Date.now();
      if (e.touches.length !== 1) { drag = null; return; }
    }
    var tgt = e.target;
    if (tgt.closest && (tgt.closest(BAIL) || tgt.closest(IGNORE))) { drag = null; return; }

    var pt = e.touches ? e.touches[0] : e;
    drag = {
      x0: pt.clientX, y0: pt.clientY,
      axis: null, x: 0, raw: 0,
      s: 1,
      samples: [],
      region: findRegion(tgt),
      rx0: 0, rmax: 0
    };
    if (drag.region) {
      drag.rx0 = drag.region.scrollLeft;
      drag.rmax = drag.region.scrollWidth - drag.region.clientWidth;
      /* 拖动期间区域位移由 JS 写 scrollLeft 驱动。容器若带 scroll-behavior:smooth，
         每次写入都会被动画化，区域就追不上手指（一滑一顿）。手势期间临时改 auto。 */
      activeRegion = drag.region;
      activeRegionBehavior = drag.region.style.scrollBehavior;
      drag.region.style.scrollBehavior = 'auto';
    }
  }

  function onMove(e) {
    if (!drag) return;
    var pt = e.touches ? e.touches[0] : e;
    var dx = pt.clientX - drag.x0, dy = pt.clientY - drag.y0;

    if (drag.axis === null) {
      if (Math.abs(dx) < CFG.lockPx && Math.abs(dy) < CFG.lockPx) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) * CFG.lockRatio ? 'x' : 'y';
      if (drag.axis === 'x') { drag.s = fitScale(); beginDrag(); }
    }
    if (drag.axis !== 'x') return;

    if (e.cancelable) e.preventDefault();

    /* 手指位移（屏幕像素）→ 手机内部布局像素。.phone 带 scale(--fit-scale)，
       不换算的话 Pura 侧边栏/预览壳里位移会被放大 */
    var dxl = dx / drag.s;

    /* ① 横向滚动区先吃。用「从起始 scrollLeft 推算目标位置再夹紧」而不是
       逐段累加，这样区域吃满后反向拖动能正确回滚 */
    var rest = dxl;
    if (drag.region) {
      var want = drag.rx0 - dxl;
      var clamped = want < 0 ? 0 : (want > drag.rmax ? drag.rmax : want);
      drag.region.scrollLeft = clamped;
      rest = dxl - (drag.rx0 - clamped);                       /* 区域吃掉之外的，才是页面位移 */
    }

    /* ② 该方向没有目标就橡皮筋（不出邻站牌） */
    var hasTarget = rest === 0 || (rest < 0 ? !!targets.next : !!targets.prev);
    var x = hasTarget ? rest : rest * CFG.resist;

    drag.x = x;
    drag.raw = dxl;                                          /* 手指总行程（含被横滑区吃掉的部分） */
    drag.samples.push([Date.now(), x]);
    if (drag.samples.length > 6) drag.samples.shift();

    applyX(x, hasTarget);
  }

  /* 手势结束后浏览器仍会补发一次 click：按下与抬起若落在同一张卡片上，
     就变成「滑走的同时又点进详情页」（右滑走掉了，左滑却被卡片的 href 抢走）。
     横向手势一旦真的移动过，就吞掉紧随其后的那一次 click。
     只拦 320ms 内、且只拦一次事件，之后的正常点击不受影响。 */
  function swallowClick() {
    var kill = function (e) { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('click', kill, true);
    setTimeout(function () { window.removeEventListener('click', kill, true); }, 320);
  }

  function onEnd() {
    var d = drag;
    drag = null;
    if (!d || d.axis !== 'x') return;

    var x = d.x;
    if (Math.abs(d.raw) > CFG.tapPx) swallowClick();
    var dir = x < 0 ? -1 : 1;
    var t = dir < 0 ? targets.next : targets.prev;

    var passed = false;
    if (t && x !== 0) {
      if (Math.abs(x) > curW * CFG.commit) {
        passed = true;
      } else if (Math.abs(x) > curW * CFG.flickRatio) {
        /* 快速轻扫：末段采样的速度够快且方向一致 */
        var a = d.samples[0], b = d.samples[d.samples.length - 1];
        var dt = b[0] - a[0], dv = b[1] - a[1];
        passed = dt > 0 && dt < CFG.flickMs && dv * dir > 0 && Math.abs(dv) / dt > CFG.flickV;
      }
    }
    if (passed) commit(t, dir);
    else springBack();
  }

  function onCancel() {
    var d = drag;
    if (!d) return;
    drag = null;
    if (Math.abs(d.raw) > CFG.tapPx) swallowClick();
    springBack();
  }

  function beginDrag() {
    curW = phone.clientWidth;
    layers = reduced ? [] : contentLayers();
    phone.classList.add('swipe-active');
    if (peek) peek.style.transition = 'none';
    if (reduced) return;
    for (var i = 0; i < layers.length; i++) {
      layers[i].style.transition = 'none';
      layers[i].style.willChange = 'transform';
    }
    if (peekCard) peekCard.style.transition = 'none';
  }

  function applyX(x, hasTarget) {
    if (reduced || !peek) return;
    for (var i = 0; i < layers.length; i++) {
      layers[i].style.transform = 'translate3d(' + x + 'px,0,0)';
    }
    var side = x < 0 ? 'next' : 'prev';
    if (hasTarget && x !== 0 && peek.getAttribute('data-side') !== side) setPeekSide(side);
    /* 缝宽 = 屏宽 - 已让出的位移；没目标（橡皮筋）时整层裁掉 */
    var gap = (hasTarget && x !== 0) ? Math.max(0, curW - Math.abs(x)) : curW;
    peek.style.clipPath = clipFor(side, gap);
    if (peekCard) peekCard.style.transform =
      'translateY(-50%) translate3d(' + (x * CFG.parallax) + 'px,0,0)';
  }

  function commit(t, dir) {
    var ease = 'transform ' + CFG.commitMs + 'ms cubic-bezier(.4,0,.2,1)';
    if (!reduced) {
      for (var i = 0; i < layers.length; i++) {
        layers[i].style.transition = ease;
        layers[i].style.transform = 'translate3d(' + (dir * curW) + 'px,0,0)';
      }
      /* 内容整片滑出，邻站牌同步完全揭开 */
      if (peek) {
        peek.style.transition = 'clip-path ' + CFG.commitMs + 'ms cubic-bezier(.4,0,.2,1)';
        peek.style.clipPath = clipFor(dir < 0 ? 'next' : 'prev', 0);
      }
      if (peekCard) {
        peekCard.style.transition = ease;
        peekCard.style.transform =
          'translateY(-50%) translate3d(' + (dir * curW * CFG.parallax) + 'px,0,0)';
      }
    }
    /* 与页面原有的淡出淡入叠加：pageTransition 自己负责 300ms 后跳转 */
    if (t.useHistory && window.UI && UI.back) UI.back();
    else if (window.UI && UI.pageTransition) UI.pageTransition.start(ROOT + t.path);
    else location.href = ROOT + t.path;
  }

  function springBack() {
    var ease = 'transform ' + CFG.spring + 'ms cubic-bezier(.22,1,.36,1)';
    if (!reduced) {
      for (var i = 0; i < layers.length; i++) {
        layers[i].style.transition = ease;
        layers[i].style.transform = 'translate3d(0,0,0)';
      }
      if (peek) {
        peek.style.transition = 'clip-path ' + CFG.spring + 'ms cubic-bezier(.22,1,.36,1)';
        peek.style.clipPath = clipClosed(peek.getAttribute('data-side'));
      }
      if (peekCard) {
        peekCard.style.transition = ease;
        peekCard.style.transform = 'translateY(-50%)';
      }
    }
    clearTimeout(springTimer);
    springTimer = setTimeout(cleanup, CFG.spring + 40);
  }

  function cleanup() {
    for (var i = 0; i < layers.length; i++) {
      layers[i].style.transition = '';
      layers[i].style.transform = '';
      layers[i].style.willChange = '';
    }
    if (peek) { peek.style.transition = ''; peek.style.clipPath = ''; }
    if (peekCard) { peekCard.style.transition = ''; peekCard.style.transform = ''; }
    phone.classList.remove('swipe-active');
    if (activeRegion) { activeRegion.style.scrollBehavior = activeRegionBehavior; activeRegion = null; }
    layers = [];
  }

  /* ===================== 启动 ===================== */

  function init() {
    phone = document.querySelector('.phone');
    if (!phone) return;

    var path = currentPath();
    if (!path) return;
    targets = buildTargets(path);
    if (!targets || (!targets.next && !targets.prev)) return;   /* 不在归属表内 → 本页不挂手势 */

    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    injectPeek();

    phone.addEventListener('touchstart', onStart, { passive: true });
    phone.addEventListener('touchmove', onMove, { passive: false });
    phone.addEventListener('touchend', onEnd);
    phone.addEventListener('touchcancel', onCancel);
    /* 桌面演示：鼠标拖动同样可用（与 tabbar 的做法一致） */
    phone.addEventListener('mousedown', onStart);
    /* 起手落在 <a>/<img> 上时，浏览器会开始原生拖拽，把 mousemove/mouseup 全吞掉 ——
       手势就此收不了尾：内容停在半路不回弹、也不切页。横向意图一旦明确就取消原生拖拽。
       （只影响鼠标路径；触摸不触发原生拖拽） */
    phone.addEventListener('dragstart', function (e) {
      if (drag && drag.axis !== 'y') e.preventDefault();
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    /* 尺寸变了，缓存的层列表作废 */
    window.addEventListener('resize', function () { layers = []; });
  }

  window.SwipeNav = { init: init, _targets: function () { return targets; }, _parentOf: parentOf };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
