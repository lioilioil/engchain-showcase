/* ============================================================================
   工程链 ENGCHAIN — 通用脚本 (common.js)
   Toast / 半屏弹窗 / 居中对话框 / 返回 / iPhone 状态栏 / 支付墙解锁
   ============================================================================ */
window.UI = (function () {
  /* ---- 页面相对路径基准：页面位于 pages/xx/ 目录时与根目录的差价 ---- */
  function base(depth) {
    // depth = 页面距离根的层数(0=根, 1=pages/xx/)
    return depth === 0 ? '' : '../'.repeat(depth);
  }

  let lastSheet = null; // 最近打开的 sheet，供 closeSheet() 关闭 (模块级，避免在 IIFE 内引用尚未赋值的 window.UI)

  /* ---- Toast ---- */
  const toastWrap = createToastWrap();
  function createToastWrap() {
    let el = document.querySelector('.toast-wrap');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-wrap';
      document.body.appendChild(el);
    }
    return el;
  }
  function toast(text, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    const badgeMap = { ok: '成功', warn: '提示', err: '错误' };
    if (kind && badgeMap[kind]) {
      const badge = document.createElement('span');
      badge.className = 'toast-badge';
      badge.textContent = badgeMap[kind];
      t.appendChild(badge);
    }
    const txt = document.createElement('span');
    txt.className = 'toast-text';
    txt.textContent = text;
    t.appendChild(txt);
    toastWrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(-8px)';
      setTimeout(() => t.remove(), 300);
    }, 1800);
  }
  toast.ok = (t) => toast(t, 'ok');
  toast.warn = (t) => toast(t, 'warn');
  toast.err = (t) => toast(t, 'err');

  /* ---- 半屏弹窗 (bottom sheet) ---- */
  function sheet() {
    // 动态创建 sheet 容器
    const wrap = document.createElement('div');
    wrap.className = 'sheet';
    wrap.innerHTML = '<div class="grab"></div><div class="sheet-head"><div class="fs-17 fw-600"></div><button class="icon-btn sheet-close"><svg class="ic"><use href="#i-x"/></svg></button></div><div class="sheet-body"></div>';
    document.body.appendChild(wrap);
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', close);
    wrap.querySelector('.sheet-close').addEventListener('click', close);
    wrap.show = () => {
      requestAnimationFrame(() => { overlay.style.opacity = '1'; overlay.style.visibility = 'visible'; wrap.classList.add('show'); });
      document.body.style.overflow = 'hidden';
    };
    wrap.setText = (title) => { wrap.querySelector('.sheet-head .fs-17').textContent = title; };
    wrap.body = () => wrap.querySelector('.sheet-body');
    wrap.html = (c) => { wrap.querySelector('.sheet-body').innerHTML = c; return wrap; };
    lastSheet = wrap;
    function close() {
      overlay.style.opacity = '0'; overlay.style.visibility = 'hidden'; wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); overlay.remove(); document.body.style.overflow = ''; }, 300);
    }
    wrap.close = close;
    return wrap;
  }

  /* ---- 居中对话框 ---- */
  function dialog(opts) {
    const o = { title: '', text: '', ok: '确定', cancel: '取消', onOk: null, onCancel: null, danger: false, ...opts };
    const ov = document.createElement('div');
    ov.className = 'modal-overlay show';
    ov.innerHTML = `<div class="dialog">
      <div class="d-title"></div>
      <div class="d-text"></div>
      <div class="d-actions">
        <button class="btn btn-ghost d-cancel"></button>
        <button class="btn d-ok"></button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('.d-title').textContent = o.title;
    ov.querySelector('.d-text').innerHTML = o.text;
    ov.querySelector('.d-ok').textContent = o.ok;
    ov.querySelector('.d-ok').className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + ' d-ok';
    ov.querySelector('.d-cancel').textContent = o.cancel;
    function close() { ov.remove(); document.body.style.overflow = ''; }
    ov.querySelector('.d-ok').addEventListener('click', () => { o.onOk && o.onOk(); close(); });
    ov.querySelector('.d-cancel').addEventListener('click', () => { o.onCancel && o.onCancel(); close(); });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    return ov;
  }

  /* ---- 返回上一页 ---- */
  function back(fallback) {
    if (history.length > 1) history.back();
    else location.href = (window.__ROOT__ || '') + 'home.html' + (fallback ? fallback : '');
  }

  /* ---- 渲染 iPhone 状态栏 (每页顶部) ---- */
  function statusBar() {
    const d = new Date();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `
      <div class="status-bar">
        <span>${hh}:${mm}</span>
        <span class="sb-right">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><rect x="0" y="7" width="3" height="5" rx="1" fill="currentColor"/><rect x="4.5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="9" y="2.5" width="3" height="9.5" rx="1" fill="currentColor"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill="currentColor"/><path d="M8 6c1.8 0 3.4.7 4.6 1.9l-1.6 1.6A4.4 4.4 0 0 0 8 8.2c-1.2 0-2.3.5-3 1.3l-1.6-1.6A6.4 6.4 0 0 1 8 6Z" fill="currentColor" opacity=".9"/><path d="M8 2.5c2.9 0 5.5 1.2 7.4 3.1l-1.6 1.6A8.2 8.2 0 0 0 8 4.7c-2.2 0-4.3.9-5.8 2.5L.6 5.6A10.4 10.4 0 0 1 8 2.5Z" fill="currentColor" opacity=".6"/></svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3.5" stroke="currentColor"/><rect x="2" y="2" width="18" height="8" rx="2.5" fill="currentColor"/><path d="M22.5 4v4a2 2 0 0 0 0-4Z" fill="currentColor"/><path d="M2 4v4" stroke="#F4F2EE" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
      </div>`;
  }

  /* ---- 灵动岛 ---- */
  function dynamicIsland() { return `<div class="dynamic-island"></div>`; }

  /* ---- 金额格式化 ---- */
  function money(n) { return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

  /* ---- HTML 转义 ---- */
  function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

  /* 主题切换（明/暗）。默认明色（对齐参考 V3.3），尊重系统偏好与本地记忆 */
  const theme = {
    get() { return document.documentElement.dataset.theme || 'light'; },
    set(t) {
      if (t === 'dark') document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem('engchain-theme', t); } catch (e) {}
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); return this.get(); },
  };

  /* 账单/演示状态 —— 存于 localStorage，跨页保留，用于模拟「登录账号 + 会员」。
     注意：用户是「供需综合体」——一个用户/企业可同时是供方与需方，因此不设身份切换。 */
  const stateStore = (function () {
    const KEY = 'engchain-state';
    const def = { user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'demo@engchain.cn', mobile: '13800138000' };
    function load() { let s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {} return Object.assign({}, def, s); }
    function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} window.dispatchEvent(new CustomEvent('engchain:state', { detail: s })); return s; }
    return {
      KEY,
      get: load,
      set(part) { return save(Object.assign(load(), part)); },
      reset() { try { localStorage.removeItem(KEY); } catch (e) {} return save(def); },
    };
  })();

  /* 关闭最近打开的 sheet */
  function closeSheet() { if (lastSheet) { lastSheet.close(); } }

  /* ---- 动态加载 thinking-orb.js（AI 球 Canvas 动画引擎） ---- */
  let _orbLoading = false;
  function ensureThinkingOrb(cb) {
    if (window.ThinkingOrb) { if (cb) cb(); return; }
    if (_orbLoading) {
      // 已在加载中，轮询等待
      var check = setInterval(function () {
        if (window.ThinkingOrb) { clearInterval(check); if (cb) cb(); }
      }, 50);
      return;
    }
    _orbLoading = true;
    var root = window.__ROOT__ || '';
    var s = document.createElement('script');
    s.src = root + 'js/thinking-orb.js';
    s.onload = function () { _orbLoading = false; if (cb) cb(); };
    s.onerror = function () { _orbLoading = false; };
    document.head.appendChild(s);
  }

  /* ---- 底部悬浮导航栏 (统一渲染，替换各页手写底栏的冗余) ---- */
  // active: home | discover | message | me；root: 页面到仓库根的相对路径
  function tabbar(active, root) {
    root = root || window.__ROOT__ || '';
    const TABS = [
      { key: 'home',     label: '首页', href: root + 'home.html',                          icon: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3Z"/>' },
      { key: 'discover', label: '发现', href: root + 'pages/supply/list.html',               icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>' },
      { key: 'message',  label: '消息', href: root + 'pages/message/index.html',             icon: '<path d="M21 12a8 8 0 1 0-3.2 6.4L21 21l-.6-3.2A8 8 0 0 0 21 12Z"/>', badge: 3 },
      { key: 'me',       label: '我的', href: root + 'pages/profile/index.html',             icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>' },
    ];
    var tabs = '<nav class="app-tabbar" aria-label="主导航">' +
      '<div class="tab-glass" aria-hidden="true"></div>' +
      TABS.map(function (t) {
      return '<a href="' + t.href + '" class="app-tab' + (active === t.key ? ' active' : '') + '" data-key="' + t.key + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' + t.icon + '</svg>' +
        '<span class="tab-label">' + t.label + '</span>' +
        (t.badge ? '<span class="badge">' + t.badge + '</span>' : '') +
        '</a>';
    }).join('') + '</nav>';
    var orbActive = active === 'workbench';
    var orb = '<a class="ai-orb-entry' + (orbActive ? ' active' : '') + '" href="' + root + 'pages/publish/index.html" aria-label="AI 信息工作台" title="信息工作台">' +
      '<span class="glass-orb" aria-hidden="true">' +
        '<svg class="glass-orb-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
      '</span></a>';
    return '<div class="app-nav-shell">' + tabs + orb + '</div>';
  }

  /* ---- 页面过渡管理器（Tab 切换淡出/淡入 + 预加载 + 进度条）---- */
  var pageTransition = {
    _progressEl: null,

    // 开始跳转过渡：当前页面淡出 + 显示进度条 + 延迟跳转
    start: function (href) {
      // 防止重复触发
      if (document.body.classList.contains('page-leaving')) return;
      document.body.classList.add('page-leaving');
      this._showProgress();
      // 等待淡出动画完成（300ms）后跳转
      setTimeout(function () {
        window.location.href = href;
      }, 300);
    },

    // 显示顶部加载进度条
    _showProgress: function () {
      if (!this._progressEl) {
        this._progressEl = document.createElement('div');
        this._progressEl.className = 'page-progress';
        document.body.appendChild(this._progressEl);
      }
      this._progressEl.classList.add('active');
    },

    // 预加载其他 Tab 页面（浏览器空闲时预取 HTML，加速后续跳转）
    prefetch: function () {
      // UX-FIX：后台（/admin/）页面不引入 App 端 Tab 导航，预取 App 路由会解析成 /admin/... 全部 404，直接跳过。
      try { if (location.pathname.indexOf('/admin/') !== -1) return; } catch (e) {}
      var root = window.__ROOT__ || '';
      var pages = [
        'home.html',
        'pages/supply/list.html',
        'pages/message/index.html',
        'pages/profile/index.html'
      ];
      pages.forEach(function (url) {
        // 跳过当前页
        if (location.href.indexOf(url) !== -1) return;
        try {
          var link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = root + url;
          link.as = 'document';
          document.head.appendChild(link);
        } catch (e) {}
      });
    }
  };

  /* ---- 底部 Tabbar 玻璃块滑动交互 ----
     独立 .tab-glass 元素通过 transform: translateX() 平滑滑动；
     支持点击滑动后跳转、触摸左右滑动切换、鼠标拖拽切换、resize 重算位置。 */
  function initTabbarGlass() {
    var tabbar = document.querySelector('.app-tabbar');
    if (!tabbar) return;
    var glass = tabbar.querySelector('.tab-glass');
    var tabs = tabbar.querySelectorAll('.app-tab');
    if (!glass || tabs.length === 0) return;

    var activeIndex = 0;
    tabs.forEach(function (t, i) { if (t.classList.contains('active')) activeIndex = i; });

    // 计算每个 tab 相对 tabbar 的位置和宽度
    function measure() {
      var parentRect = tabbar.getBoundingClientRect();
      var arr = [];
      tabs.forEach(function (t) {
        var r = t.getBoundingClientRect();
        arr.push({ left: r.left - parentRect.left, width: r.width });
      });
      return arr;
    }
    var positions = measure();

    // 移动玻璃块到指定 index
    function moveTo(index, animate) {
      if (index < 0) index = 0;
      if (index >= positions.length) index = positions.length - 1;
      var p = positions[index];
      glass.style.transition = animate
        ? 'transform .42s cubic-bezier(.34,1.4,.64,1), width .3s ease'
        : 'none';
      glass.style.transform = 'translateX(' + p.left + 'px)';
      glass.style.width = p.width + 'px';
      glass.classList.toggle('is-first', index === 0);
      glass.classList.toggle('is-last', index === positions.length - 1);
    }

    // 初始化位置（无动画）
    requestAnimationFrame(function () { moveTo(activeIndex, false); });

    // 点击 tab：先滑动玻璃块，再延迟跳转
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var href = t.getAttribute('href');
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        activeIndex = i;
        moveTo(i, true);
        UI.pageTransition.start(href);
      });
    });

    // ===== 触摸滑动（移动端）=====
    var touchStartX = 0, touchStartY = 0, isTouching = false;
    var dragStartIndex = 0, currentOffset = 0;

    tabbar.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isTouching = true;
      dragStartIndex = activeIndex;
      currentOffset = 0;
      glass.style.transition = 'none';
    }, { passive: true });

    tabbar.addEventListener('touchmove', function (e) {
      if (!isTouching) return;
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) {
        e.preventDefault();
        currentOffset = dx;
        var targetLeft = positions[dragStartIndex].left + dx;
        var minL = positions[0].left, maxL = positions[positions.length - 1].left;
        if (targetLeft < minL) targetLeft = minL + (targetLeft - minL) * 0.3;
        if (targetLeft > maxL) targetLeft = maxL + (targetLeft - maxL) * 0.3;
        glass.style.transform = 'translateX(' + targetLeft + 'px)';
      }
    }, { passive: false });

    function endDrag() {
      if (!isTouching && !isMouseDragging) return;
      isTouching = false;
      isMouseDragging = false;
      var threshold = positions[0].width * 0.28;
      var newIndex = dragStartIndex;
      if (currentOffset < -threshold && dragStartIndex < positions.length - 1) newIndex = dragStartIndex + 1;
      else if (currentOffset > threshold && dragStartIndex > 0) newIndex = dragStartIndex - 1;
      activeIndex = newIndex;
      tabs.forEach(function (x, i) { x.classList.toggle('active', i === newIndex); });
      moveTo(newIndex, true);
      if (newIndex !== dragStartIndex) {
        var href = tabs[newIndex].getAttribute('href');
        UI.pageTransition.start(href);
      }
    }
    tabbar.addEventListener('touchend', endDrag);
    tabbar.addEventListener('touchcancel', endDrag);

    // ===== 鼠标拖拽（桌面端）=====
    var mouseStartX = 0, isMouseDragging = false;
    tabbar.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.app-tab')) return; // 点击链接走点击逻辑
      mouseStartX = e.clientX;
      isMouseDragging = true;
      dragStartIndex = activeIndex;
      currentOffset = 0;
      glass.style.transition = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!isMouseDragging) return;
      var dx = e.clientX - mouseStartX;
      currentOffset = dx;
      var targetLeft = positions[dragStartIndex].left + dx;
      var minL = positions[0].left, maxL = positions[positions.length - 1].left;
      if (targetLeft < minL) targetLeft = minL + (targetLeft - minL) * 0.3;
      if (targetLeft > maxL) targetLeft = maxL + (targetLeft - maxL) * 0.3;
      glass.style.transform = 'translateX(' + targetLeft + 'px)';
    });
    document.addEventListener('mouseup', endDrag);

    // ===== 窗口 resize：重新计算位置 =====
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        positions = measure();
        moveTo(activeIndex, false);
      }, 120);
    });
  }

  /* ---- 图标：全局 SVG sprite（只允许 SVG，禁用 emoji/字符图标）----
     注入一个隐藏 <svg>，内含参考系统同款 24×24 描边 symbol；页面用
     <svg class="ic"><use href="#i-NAME"/></svg> 引用。 */
  const SPRITE = {
    'check':    '<path d="M20 6L9 17l-5-5"/>',
    'chev-r':   '<path d="M9 18l6-6-6-6"/>',
    'company':  '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>',
    'buil':     '<path d="M3 21h18M5 21V7l7-4 7 4v14"/>',
    'lock':     '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'shield':   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'edit':     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    'doc':      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    'pin':      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    'chat':     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'bell':     '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'eye':      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'recruit':  '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    /* —— 扩展：参考系统未收录的图标，维持 Feather 风格、stroke 1.8 —— */
    'gear':     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    'star':     '<path d="M12 3l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17.8 6.2 20.9l1.3-6.6L2.5 9.8l6.6-.7z"/>',
    'bolt':     '<path d="M13 2L3 14h7l-1 8 10-12h-7z"/>',
    'headset':  '<path d="M3 18v-2a9 9 0 0 1 18 0v2"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    'box':      '<path d="M21 16v-8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
    'wallet':   '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    'share':    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    'fav':      '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    'feedback': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    'help':     '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 2-2.5 3.7"/><path d="M12 17h.01"/>',
    'info':     '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    'logout':   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    'upload':   '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
    'mail':     '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/>',
    'sparkle':  '<path d="M12 3c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z"/><path d="M19 15c.3 1.6.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.9 2.5-2.5z"/>',
    'mic':      '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/>',
    'search':   '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
    'tag':      '<path d="M20.6 13.4l-7.9-7.9a2 2 0 0 0-1.4-.6H5a2 2 0 0 0-2 2v6.3c0 .5.2 1 .6 1.4l7.9 7.9a2 2 0 0 0 2.8 0l6.3-6.3a2 2 0 0 0 0-2.8z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    'tool':     '<path d="M14.7 6.3a4 4 0 0 1 5 0l-2 2 1.5 1.5 2-2a4 4 0 0 1-6.5 4.5L7.2 19.8a2 2 0 0 1-2.8-2.8l7.5-7.5a4 4 0 0 1 2.8-3.2z"/>',
    'user':     '<circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/>',
    'truck':    '<path d="M1 6h13v9H1z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/>',
    'form':     '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v8"/>',
    'scaffold': '<path d="M4 21V4M12 21V4M20 21V4M2 8h20M2 14h20"/>',
    'clock':    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'bank':     '<path d="M3 21h18M5 21v-7M9 21v-7M15 21v-7M19 21v-7M2 10l10-7 10 7z"/>',
    'card':     '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    'folder':   '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'briefcase':'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
    'clip':     '<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5"/>',
    'external': '<path d="M7 17L17 7M9 7h8v8"/>',
    'fire':     '<path d="M12 2c1 3 3.5 4.3 4 6.2a5 5 0 0 1-8 3.8C7 13 9 12 9 9.5 6.5 10.5 6 12.6 6 13a6 6 0 0 0 12 0C18 5 12 8 12 2z"/>',
    'x':        '<path d="M18 6L6 18M6 6l12 12"/>',
    /* —— 补充：我的页面等使用的 Feather 风格图标 —— */
    'shield':   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    'award':    '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/>',
    'upload':   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    'file':     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    'box':      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'
  };
  function injectSprite() {
    if (document.getElementById('engchain-sprite')) return;
    const ns = '<svg id="engchain-sprite" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
      Object.keys(SPRITE).map(k => '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + SPRITE[k] + '</symbol>').join('') +
      '</svg>';
    (document.head || document.documentElement).insertAdjacentHTML('beforeend', ns);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectSprite);
  else injectSprite();
  // 返回一段可复用的图标 markup；cls 用于着色/缩放（如 .accent）
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  // 「分类 → 参考图标名」映射（最近浏览/分类缩略图）：分类文本归一到 SVG sprite 图标名
  const CAT_ICON = { 混凝土: 'box', 材料: 'box', 人工: 'user', 劳务: 'user', 设备: 'tool', 机械: 'gear', 运输: 'truck', 模板: 'form', 脚手架: 'scaffold', default: 'doc' };
  function catIcon(t) { for (const k in CAT_ICON) { if ((t || '').indexOf(k) > -1) return CAT_ICON[k]; } return CAT_ICON.default; }

  // 「企业认证卡片 · 高端视觉」渲染：c = MOCK.companyById(id)
  // opts.home = 企业主页 href；opts.compact=true 返回压缩卡(点击弹窗)，默认返回折叠卡(全局 .cert-toggle 委托)
  const DIM_ICON = { 资质: 'shield', 经营: 'buil', 信用: 'star', 服务: 'sparkle' };
  function dimIcon(k) { for (const key in DIM_ICON) { if ((k || '').indexOf(key) > -1) return DIM_ICON[key]; } return 'check'; }
  // —— 共享片段构建器：供 折叠卡(企业主页默认) / 压缩卡(详情页) / 弹窗完整卡 复用 ——
  function certHeader(c) {
    return '<div class="cert-header">' +
      '<div class="cert-badge-wrap"><div class="cert-seal">' + icon('shield', '') + '</div>' +
        '<div class="cert-badge-text"><div class="cert-badge-title">' + (c.name || '平台认证企业') +
          '<svg class="verified-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div>' +
        '<div class="cert-badge-sub">ENGCHAIN 官方认证 · 信息已核验</div>' +
        '<div class="cert-badge-meta">' + (c.industry || '工程服务') + ' · 工商存续 · 平台年度核验</div></div></div>' +
      '<div class="cert-score"><div class="cert-score-row"><span class="cert-score-num">' + (c.score && c.score.value) + '</span><span class="cert-score-max">/10</span></div>' +
        '<div class="cert-score-label">GEO 综合评分</div>' +
        '<div class="cert-score-grade">✦ ' + ((c.score && c.score.grade) || '—') + '</div></div>' +
    '</div>';
  }
  function certTags(c) {
    const tags = c.tags || [];
    return '<div class="cert-tags">' + tags.map(t => '<span class="cert-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-' + (t.ic || 'check') + '"/></svg>' + t.t + '</span>').join('') +
      (c.reviewCount ? '<span class="cert-tag review">' + c.reviewCount + '条企业评价</span>' : '') + '</div>';
  }
  function certDims(c) {
    const dims = c.dims || [];
    return '<div class="cert-mid"><div class="cert-divider"></div><div class="cert-dimensions">' +
      dims.map(function (d) {
        return '<div class="cert-dim"><div class="cert-dim-top"><span class="cert-dim-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-' + dimIcon(d.k) + '"/></svg>' + d.k + '</span><span class="cert-dim-val">' + d.v + '</span></div>' +
          '<div class="cert-dim-bar"><div class="cert-dim-fill" style="width:' + (d.s || 0) + '%"></div></div></div>';
      }).join('') + '</div></div>';
  }
  function certDetail(c) {
    const dims = c.dims || [];
    const certs = c.certs || [];
    const basic = [
      { k: '企业名称', v: c.name || '' },
      { k: '统一社会信用代码', v: c.creditCode || '' },
      { k: '法定代表人', v: c.legalRep || '' },
      { k: '注册资本', v: c.regCapital || '' },
      { k: '成立日期', v: c.founded || '' },
      { k: '经营状态', v: c.status || '', ok: true }
    ];
    const gw = (dims.length ? (100 / dims.length) : 25);
    const formula = dims.map(d => d.k + '(' + Math.round(gw) + '%)×' + d.v).join(' + ');
    const avg = dims.length ? (dims.reduce((a, d) => a + parseFloat(d.v), 0) / dims.length) : 0;
    return '<div class="cert-detail"><div class="cert-detail-inner">' +
      '<div class="cert-detail-section"><div class="cert-detail-title">企业基本信息</div><div class="cert-detail-grid">' +
        basic.map(b => '<div class="cert-detail-item"><span class="cdi-label">' + b.k + '</span><span class="cdi-value' + (b.ok ? ' cdi-success' : '') + '">' + b.v + '</span></div>').join('') + '</div></div>' +
      '<div class="cert-detail-section"><div class="cert-detail-title">认证项目清单</div><div class="cert-cert-list">' +
        certs.map(ct => '<div class="cert-cert-item"><span class="cci-icon">✓</span><span class="cci-name">' + ct.name + '</span><span class="cci-date">' + ct.date + '</span></div>').join('') + '</div></div>' +
      '<div class="cert-detail-section"><div class="cert-detail-title">GEO 评分计算说明</div><div class="cert-score-formula">' +
        '<p>综合评分 = ' + formula + '</p><p class="cert-score-result">≈ <strong>' + avg.toFixed(1) + '</strong>' + ((c.score && c.score.grade) ? '（' + c.score.grade + '）' : '') + '</p>' +
        '<p class="cert-score-note">数据来源：国家企业信用信息公示系统、中国执行信息公开网、平台交易数据，每日更新</p></div></div>' +
    '</div></div>';
  }
  function certFooter(c, opts) {
    return '<div class="cert-footer">' +
      '<div class="cert-verify">' + icon('shield', '') + '区块链存证 · 可在线验证</div>' +
      (opts && opts.home ? '<a class="cert-home" href="' + opts.home + '">企业主页 ›</a>' : '<div class="cert-id">' + (c.certId || '') + '</div>') +
    '</div>';
  }
  // opts.compact=true → 详情页压缩卡（仅头部，卡片整体点击弹窗）；默认 → 企业主页折叠卡（全局 .cert-toggle 委托两级展开）
  function certCard(c, opts) {
    opts = opts || {};
    c = c || {};
    if (opts.compact) {
      return '<div class="cert-card cert-card--compact" role="button" tabindex="0" aria-label="展开企业认证档案">' +
        certHeader(c) +
        (opts && opts.home ? '<a class="cert-home" href="' + opts.home + '" onclick="event.stopPropagation();">企业主页 ›</a>' : '') +
        '<div class="cert-compact-cue"><span>点击查看完整认证档案</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div>' +
      '</div>';
    }
    return '<div class="cert-card">' + certHeader(c) + certTags(c) + certDims(c) + certDetail(c) + certFooter(c, opts) +
      '<div class="cert-toggle"><span>查看资质评分</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div>' +
    '</div>';
  }
  // 弹窗完整展开卡：全部区块展开、无 fold/toggle
  function certFull(c, opts) {
    opts = opts || {};
    c = c || {};
    return '<div class="cert-card cert-card--full">' + certHeader(c) + certTags(c) + certDims(c) + certDetail(c) + certFooter(c, opts) + '</div>';
  }
  // 企业认证档案 · 弹窗（蒙版 + 居中展开卡）：详情页压缩卡点击触发
  function certModal(c, opts) {
    const o = opts || {};
    const ov = document.createElement('div');
    ov.className = 'cert-modal-overlay';
    ov.innerHTML =
      '<div class="cert-modal" role="dialog" aria-modal="true" aria-label="企业认证档案">' +
        '<div class="cert-modal-head"><span>企业认证档案</span><button class="cert-modal-close" aria-label="关闭">×</button></div>' +
        '<div class="cert-modal-scroll">' + certFull(c, o) + '</div>' +
      '</div>';
    document.body.appendChild(ov);
    function close() {
      ov.classList.remove('show');
      setTimeout(function () { ov.remove(); document.body.style.overflow = ''; }, 240);
    }
    ov.querySelector('.cert-modal-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    requestAnimationFrame(function () { ov.classList.add('show'); document.body.style.overflow = 'hidden'; });
    return { close: close };
  }

  /* ---- 城市选择数据：大陆 31 省级行政区 + 地级市/州/盟 ---- */
  const HOT_CITIES = ['北京', '上海', '广州', '深圳', '成都', '杭州', '重庆', '西安', '武汉', '南京', '天津', '苏州'];
  const CITY_DATA = [
    ['北京', ['北京']], ['天津', ['天津']], ['上海', ['上海']], ['重庆', ['重庆']],
    ['河北', ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水']],
    ['山西', ['太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁']],
    ['辽宁', ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛']],
    ['吉林', ['长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边']],
    ['黑龙江', ['哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化', '大兴安岭']],
    ['江苏', ['南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁']],
    ['浙江', ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水']],
    ['安徽', ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城']],
    ['福建', ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德']],
    ['江西', ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶']],
    ['山东', ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽']],
    ['河南', ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店', '济源']],
    ['湖北', ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施']],
    ['湖南', ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西']],
    ['广东', ['广州', '韶关', '深圳', '珠海', '汕头', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮']],
    ['海南', ['海口', '三亚', '三沙', '儋州']],
    ['四川', ['成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝', '甘孜', '凉山']],
    ['贵州', ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南']],
    ['云南', ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆']],
    ['陕西', ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛']],
    ['甘肃', ['兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏', '甘南']],
    ['青海', ['西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西']],
    ['内蒙古', ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安', '锡林郭勒', '阿拉善']],
    ['广西', ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左']],
    ['西藏', ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里']],
    ['宁夏', ['银川', '石嘴山', '吴忠', '固原', '中卫']],
    ['新疆', ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '克孜勒苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰']]
  ];
  const ALL_CITIES = (function () { const m = {}; CITY_DATA.forEach(function (g) { g[1].forEach(function (c) { m[c] = g[0]; }); }); return m; })();

  /* ---- 城市选择 Bottom Sheet（80% 高度，自下而上）：当前定位 + 搜索 + 热门 + 省/市两级。opts={current,onSelect} ---- */
  function cityPicker(opts) {
    opts = opts || {};
    const sh = sheet();
    sh.classList.add('city-sheet');
    sh.setText('选择城市');
    const body = sh.body();
    body.innerHTML =
      '<div class="city-loc"><span class="cl-label">当前定位</span>' +
        '<button type="button" class="cl-current" data-city="成都"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>成都</button></div>' +
      '<div class="city-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input type="text" id="city-kw" placeholder="搜索城市名" autocomplete="off"></div>' +
      '<div class="city-sec" data-sec="hot"><div class="cs-title">热门城市</div><div class="cs-grid" id="cs-hot"></div></div>' +
      '<div class="city-sec" data-sec="prov"><div class="cs-title">按省份选择</div><div class="cs-provs" id="cs-provs"></div></div>' +
      '<div class="city-sec cs-cities-sec" data-sec="cities"><div class="cs-title" id="cs-cities-title"></div><div class="cs-grid" id="cs-cities"></div></div>' +
      '<div class="city-sec" data-sec="search" hidden><div class="cs-title">搜索结果</div><div class="cs-grid" id="cs-search"></div></div>';

    function gridHtml(list) {
      return list.map(function (c) { return '<button type="button" class="cs-cell" data-city="' + c + '">' + c + '</button>'; }).join('');
    }
    document.getElementById('cs-hot').innerHTML = gridHtml(HOT_CITIES);
    const provsBox = document.getElementById('cs-provs');
    provsBox.innerHTML = CITY_DATA.map(function (g, i) {
      return '<button type="button" class="cs-prov' + (i === 0 ? ' active' : '') + '" data-p="' + g[0] + '">' + g[0] + '</button>';
    }).join('');
    function renderProv(p) {
      const g = CITY_DATA.find(function (x) { return x[0] === p; });
      document.getElementById('cs-cities-title').textContent = p + '（' + (g ? g[1].length : 0) + ' 城）';
      document.getElementById('cs-cities').innerHTML = g ? gridHtml(g[1]) : '';
    }
    renderProv(CITY_DATA[0][0]);

    const kw = document.getElementById('city-kw');
    kw.addEventListener('input', function () {
      const v = kw.value.trim();
      const secs = body.querySelectorAll('[data-sec]');
      if (!v) { secs.forEach(function (s) { s.hidden = (s.dataset.sec === 'search'); }); return; }
      const hit = Object.keys(ALL_CITIES).filter(function (c) { return c.indexOf(v) > -1; });
      document.getElementById('cs-search').innerHTML = hit.length ? gridHtml(hit) : '<div class="cs-empty">未找到「' + v + '」相关城市</div>';
      secs.forEach(function (s) { s.hidden = (s.dataset.sec !== 'search'); });
    });
    provsBox.addEventListener('click', function (e) {
      const b = e.target.closest('.cs-prov'); if (!b) return;
      provsBox.querySelectorAll('.cs-prov').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); renderProv(b.dataset.p);
    });
    body.addEventListener('click', function (e) {
      const cell = e.target.closest('[data-city]');
      if (!cell) return;
      if (opts.onSelect) opts.onSelect(cell.dataset.city);
      sh.close();
    });
    sh.show();
    return sh;
  }

  return { base, toast, sheet, dialog, back, statusBar, dynamicIsland, money, esc, theme, state: stateStore, closeSheet, tabbar, initTabbarGlass, pageTransition, ensureThinkingOrb, icon, catIcon, certCard, certModal, cityPicker, cityData: CITY_DATA, cityLookup: ALL_CITIES };
})();

/* ============================================================================
   对公转账记录 (CorpPay) —— localStorage 持久化，余额充值 / 钱包收支明细 / 对公确认支付 共用
   status: pending(待上传凭证) → submitted(待确认入账)
   ============================================================================ */
const CorpPay = (function () {
  const KEY = 'engchain-corp-pays';
  const BANK = { name: '四川成链信息科技有限公司', bank: '中国建设银行成都高新支行', acct: '5100 0000 0000 0000 0000' };
  const STATUS = { pending: '待上传凭证', submitted: '待确认入账', approved: '已入账', rejected: '已驳回' };
  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} return a; }
  // 首次初始化：预置「待上传凭证 + 待确认入账」两条演示记录，让钱包收支明细默认展示两个状态并完整可跳转
  function seed() {
    const now = Date.now();
    return save([
      { id: genId(), amount: 800, status: 'pending', createdAt: now - 60 * 60 * 1000, account: BANK, remark: '工程链充值・尾号 4638' },
      { id: genId(), amount: 1500, status: 'submitted', createdAt: now - 24 * 60 * 60 * 1000, submittedAt: now - 23 * 60 * 60 * 1000, account: BANK, remark: '工程链充值・尾号 4638' }
    ]);
  }
  function load() {
    let a = [];
    try {
      if (localStorage.getItem(KEY) === null) return seed(); // 从未初始化 → 写入演示记录
      a = JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) { return []; }
    return Array.isArray(a) ? a : [];
  }
  return {
    KEY, BANK, STATUS, seed,
    list: load,
    get(id) { return load().find(r => String(r.id) === String(id)) || null; },
    create(rec) {
      const a = load();
      const r = Object.assign({ id: genId(), createdAt: Date.now(), status: 'pending' }, rec);
      a.unshift(r); save(a); return r;
    },
    update(id, patch) {
      const a = load(); const i = a.findIndex(r => String(r.id) === String(id));
      if (i > -1) { a[i] = Object.assign({}, a[i], patch); save(a); return a[i]; }
      return null;
    }
  };
})();
window.CorpPay = CorpPay;

/* ============================================================================
   浏览历史 (ViewHistory) —— localStorage 持久化，仅保留 1 个月内记录
   个人中心「最近浏览」/「浏览历史」页共用；详情页查看时自动记录
   ============================================================================ */
const ViewHistory = (function () {
  const KEY = 'engchain-view-history';
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 1 个月
  const MAX_ITEMS = 100; // 上限防止无限增长
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function load() {
    let a = [];
    try { a = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
    if (!Array.isArray(a)) return [];
    // 过滤超过 1 个月的记录
    const now = Date.now();
    a = a.filter(function (r) { return r.viewedAt && (now - r.viewedAt) <= MAX_AGE; });
    return a;
  }
  return {
    KEY, MAX_AGE,
    list: load,
    /* 添加浏览记录：同 id 去重并移到最前，更新浏览时间 */
    add(item) {
      if (!item || !item.id) return null;
      const a = load();
      const idx = a.findIndex(function (r) { return String(r.id) === String(item.id); });
      const rec = Object.assign({ viewedAt: Date.now() }, item);
      if (idx > -1) a.splice(idx, 1); // 移除旧记录
      a.unshift(rec); // 插入到最前
      if (a.length > MAX_ITEMS) a.length = MAX_ITEMS;
      save(a);
      window.dispatchEvent(new CustomEvent('engchain:view-history', { detail: rec }));
      return rec;
    },
    /* 清空全部浏览历史 */
    clear() { save([]); window.dispatchEvent(new CustomEvent('engchain:view-history-clear')); },
    /* 获取最近 N 条（用于个人中心横向滚动展示） */
    recent(n) { return load().slice(0, n || 4); }
  };
})();
window.ViewHistory = ViewHistory;

/* ---- 自动引导：注入状态栏 + 灵动岛，补齐 __ROOT__ ---- */
(function autoBootstrap() {
  // 页面过渡：判断是否为同域 Tab 切换跳转，若是则先隐藏内容等待淡入
  try {
    var _ref = document.referrer;
    var _isInternalNav = _ref && _ref.indexOf(location.origin) === 0 && _ref !== location.href;
    if (_isInternalNav && document.body) {
      document.body.classList.add('page-loading');
    }
  } catch (e) {}
  if (!window.__ROOT__) {
    // 计算页面距仓库根的深度：pages/profile/index.html → 2 → ../../（autoBootstrap 兜底，供 back() 回退使用）
    window.__ROOT__ = location.pathname.includes('/pages/') ? '../'.repeat(location.pathname.split('/pages/')[1].split('/').length) : '';
  }
  document.addEventListener('DOMContentLoaded', function () {
    // 主题：默认明色（对齐参考 V3.3）；仅当用户显式选择暗色，或系统偏好暗色时切暗
    let t;
    try { t = localStorage.getItem('engchain-theme'); } catch (e) {}
    if (!t) t = 'light';
    UI.theme.set(t === 'dark' ? 'dark' : 'light');
    // 接收 preview.html 等宿主经 postMessage 实时下发的主题（仅切风格，不重载/不触发导航）
    window.addEventListener('message', function (e) {
      const d = e.data;
      if (d && d.type === 'engchain:theme') UI.theme.set(d.theme === 'dark' ? 'dark' : 'light');
    });

    // 向 preview.html 宿主上报当前页 URL：file:// 下 iframe 是跨源，父页读不到 location，
    // 只能由页面主动 postMessage（parent 是预览框架时的监听，用于侧栏目录高亮/垂直居中）
    const reportNav = function () {
      if (window.parent === window) return; // 顶层窗口（如 preview 自身）不广播
      try { window.parent.postMessage({ type: 'engchain:nav', href: location.href }, '*'); } catch (e) {}
    };
    reportNav();
    window.addEventListener('popstate', reportNav);
    window.addEventListener('hashchange', reportNav);

    // 演示状态 → 反映到 body 属性，供页面/样式读取（用户为供需综合体，不再有 data-identity）
    const st = UI.state.get();
    document.body.setAttribute('data-user', st.user);

    const phone = document.querySelector('.phone');
    if (phone && !phone.querySelector('.status-bar')) {
      phone.insertAdjacentHTML('afterbegin', UI.statusBar() + UI.dynamicIsland());
    }
    // 底部悬浮导航栏：页面 <body data-tab="home|discover|publish|message|me"> 时统一注入
    const tab = document.body.dataset.tab;
    if (tab && phone && !phone.querySelector('.app-tabbar')) {
      phone.insertAdjacentHTML('beforeend', UI.tabbar(tab, window.__ROOT__));
      UI.ensureThinkingOrb(function () { window.ThinkingOrb.initAll(); });
      UI.initTabbarGlass();
    }
    /* ---- Pura X View 侧边栏布局（仅短屏触发，不影响 iPhone） ---- */
    if (phone && window.innerHeight <= 720 && !phone.querySelector('.pura-sidebar')) {
      (function initPuraSidebar() {
        var root = window.__ROOT__ || '';
        var activeTab = document.body.dataset.tab || 'home';
        var SIDEBAR_TABS = [
          { key: 'home',     label: '首页', href: root + 'home.html',                    icon: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3Z"/>' },
          { key: 'discover', label: '发现', href: root + 'pages/supply/list.html',       icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>' },
          { key: 'message',  label: '消息', href: root + 'pages/message/index.html',     icon: '<path d="M21 12a8 8 0 1 0-3.2 6.4L21 21l-.6-3.2A8 8 0 0 0 21 12Z"/>', badge: 3 },
          { key: 'me',       label: '我的', href: root + 'pages/profile/index.html',     icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>' }
        ];

        /* 读取持久化状态：默认展开 */
        var collapsed = false;
        try { collapsed = localStorage.getItem('engchain-pura-sidebar') === 'collapsed'; } catch(e) {}

        /* 构建侧边栏 HTML（含收起按钮） */
        var sidebarHTML = '<nav class="pura-sidebar active" aria-label="主导航">' +
          '<div class="ps-user" id="ps-user" title="个人中心">我</div>' +
          '<div class="ps-tabs">' +
          SIDEBAR_TABS.map(function(t) {
            return '<button class="ps-tab' + (activeTab === t.key ? ' active' : '') + '" data-href="' + t.href + '" data-key="' + t.key + '" title="' + t.label + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' + t.icon + '</svg>' +
              (t.badge ? '<span class="ps-badge">' + t.badge + '</span>' : '') +
            '</button>';
          }).join('') +
          '<button class="ps-fab" data-href="' + root + 'pages/publish/index.html' + '" title="发布">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
          '</div>' +
          '<div class="ps-bottom">' +
            '<button class="ps-theme" id="ps-theme" title="切换主题">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>' +
            '</button>' +
            '<button class="ps-collapse" id="ps-collapse" title="收起侧边栏">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>' +
            '</button>' +
          '</div>' +
        '</nav>';

        /* 展开把手（收起态显示在屏幕左侧边缘） */
        var expandHandleHTML = '<button class="ps-expand-handle" id="ps-expand-handle" title="展开侧边栏" style="display:none;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>' +
        '</button>';

        /* 创建内容区包裹层，将 phone 原有子元素移入 */
        var content = document.createElement('div');
        content.className = 'pura-content';
        while (phone.firstChild) {
          content.appendChild(phone.firstChild);
        }

        /* 插入侧边栏、展开把手和内容区 */
        phone.insertAdjacentHTML('afterbegin', sidebarHTML + expandHandleHTML);
        phone.appendChild(content);
        phone.classList.add('has-pura-sidebar');

        /* 状态栏/灵动岛移到 phone 直接子元素，确保全宽绝对定位相对于 phone（而非 content） */
        var sb = content.querySelector('.status-bar');
        if (sb) phone.insertBefore(sb, phone.firstChild);
        var di = content.querySelector('.dynamic-island');
        if (di) phone.insertBefore(di, phone.firstChild);

        /* 切换函数 */
        function setSidebarCollapsed(collapse) {
          collapsed = collapse;
          try { localStorage.setItem('engchain-pura-sidebar', collapse ? 'collapsed' : 'expanded'); } catch(e) {}
          phone.classList.toggle('sidebar-collapsed', collapse);
          var handle = document.getElementById('ps-expand-handle');
          if (handle) handle.style.display = collapse ? 'flex' : 'none';
        }

        /* 绑定 Tab 点击 */
        phone.querySelectorAll('.ps-tab, .ps-fab').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            var href = this.getAttribute('data-href');
            if (href) {
              if (window.UI && UI.pageTransition) {
                UI.pageTransition.start(href);
              } else {
                window.location.href = href;
              }
            }
          });
        });

        /* 头像点击进个人中心 */
        var psUser = document.getElementById('ps-user');
        if (psUser) {
          psUser.addEventListener('click', function() {
            window.location.href = root + 'pages/profile/index.html';
          });
        }

        /* 主题切换 */
        var psTheme = document.getElementById('ps-theme');
        if (psTheme) {
          psTheme.addEventListener('click', function() {
            var cur = document.documentElement.getAttribute('data-theme') || 'light';
            var next = cur === 'dark' ? 'light' : 'dark';
            if (window.UI && UI.theme) UI.theme.set(next);
          });
        }

        /* 收起按钮 */
        var psCollapse = document.getElementById('ps-collapse');
        if (psCollapse) {
          psCollapse.addEventListener('click', function() { setSidebarCollapsed(true); });
        }

        /* 展开把手 */
        var psExpand = document.getElementById('ps-expand-handle');
        if (psExpand) {
          psExpand.addEventListener('click', function() { setSidebarCollapsed(false); });
        }

        /* 初始化状态 */
        setSidebarCollapsed(collapsed);
      })();
    }

    // 付费墙字段（contact-grid 内由详情页自行唤起付费墙，避免与全局提示重复）
    document.querySelectorAll('.obscured').forEach(function (el) {
      if (el.closest('.contact-grid')) return;
      el.addEventListener('click', function () { UI.toast('解锁会员后可见', 'warn'); });
    });
    // 企业认证卡片 · 两级折叠（委托，一处生效）
    // 第 1 级：展开「资质合规 / 经营稳定」+ 认证标签；第 2 级：展开完整认证档案，共两次点击看全
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.cert-toggle');
      if (!t) return;
      var card = t.closest('.cert-card');
      if (!card) return;
      var stage = card.classList.contains('fold-2') ? 2 : (card.classList.contains('fold-1') ? 1 : 0);
      var next = (stage + 1) % 3;
      card.classList.remove('fold-1', 'fold-2');
      if (next >= 1) card.classList.add('fold-1');
      if (next >= 2) card.classList.add('fold-2');
      var lbl = t.querySelector('span');
      if (lbl) lbl.textContent = next === 0 ? '查看资质评分' : (next === 1 ? '查看完整认证详情' : '收起');
    });

    // 页面过渡：内容就绪后触发淡入动画
    if (document.body.classList.contains('page-loading')) {
      // 延迟一帧，确保 DOM 渲染完成后再淡入
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          document.body.classList.remove('page-loading');
          document.body.classList.add('page-ready');
          setTimeout(function () { document.body.classList.remove('page-ready'); }, 600);
        });
      });
    }
    // 预加载其他 Tab 页面资源（空闲时执行，加速后续切换）
    if (window.requestIdleCallback) {
      requestIdleCallback(function () { UI.pageTransition.prefetch(); });
    } else {
      setTimeout(function () { UI.pageTransition.prefetch(); }, 800);
    }
  });
})();

/* ============================================================================
   工程链 ENGCHAIN — 统一分类卡片 (Cards)
   首页 / 资源页 / 发现页共用：按 bizKey 输出对应卡片模板
   资质招商 / 建企买卖 / 企业招聘 / 人才求职 / 项目合作 / 材料 / 设备 / 劳务 / 中介
   ============================================================================ */
window.Cards = (function () {
  function esc(s) { return String(s == null ? '' : s); }

  function fieldsOf(s, keys) {
    var out = [];
    (s.fields || []).forEach(function (f) { if (keys.indexOf(f.k) !== -1) out.push(f.v); });
    return out;
  }

  /* 顶部徽标行：类型/方向 + 认证 + 热点 + 匹配度 */
  function head(s) {
    var out = '';
    if (s.bizKey === 'talent') out += '<span class="tag tag-supply">求职</span>';
    else if (s.bizKey === 'agency') out += '<span class="tag tag-purple">服务</span>';
    else if (s.bizKey === 'franchise') out += '<span class="tag tag-gold">资质招商</span>';
    else if (s.bizKey === 'trade') out += '<span class="tag tag-gold">建企买卖</span>';
    else if (s.bizKey === 'cooperation') out += '<span class="tag tag-blue">项目合作</span>';
    else out += s.dir === 'demand' ? '<span class="tag tag-demand">需求</span>' : '<span class="tag tag-supply">供应</span>';
    if (s.verified) out += '<span class="tag tag-gold">✓已认证</span>';
    if (s.hot) out += '<span class="tag tag-red">热点</span>';
    out += '<span class="match-pill match-high" style="margin-left:auto;">' + (s.match || '—') + '%</span>';
    return '<div class="jc-tags" style="display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:9px;">' + out + '</div>';
  }

  function chips(arr, n) {
    var list = (arr || []).filter(Boolean).slice(0, n == null ? 3 : n);
    if (!list.length) return '';
    return '<div class="jc-tags" style="margin-bottom:10px;">' + list.map(function (t) { return '<span class="jc-tag">' + esc(t) + '</span>'; }).join('') + '</div>';
  }

  function statRow(items) {
    return '<div style="display:flex;border-top:1px solid var(--line);padding:9px 0 8px;margin:9px 0 4px;">' + items.map(function (it) {
      return '<div style="flex:1;text-align:center;"><div style="font-family:var(--font-num);font-size:14.5px;font-weight:700;' + (it[2] ? 'color:' + it[2] + ';' : 'color:var(--primary-dim);') + '">' + esc(it[0]) + '</div><div style="font-size:9.5px;color:var(--text-3);margin-top:1px;">' + esc(it[1]) + '</div></div>';
    }).join('') + '</div>';
  }

  function company(s) {
    var M = window.MOCK || {};
    var co = (M.companyById ? M.companyById(s.companyId) : null) || {};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21V8l6-3v16M9 21V5l9-2v18M3 21h18"/></svg>' + (co.short || s.company || '');
  }

  /* 企业标识单字：通过 companyId 关联 companies.avatar，无则取 short 首字 */
  function companyAvatar(s) {
    var M = window.MOCK || {};
    var co = (M.companyById ? M.companyById(s.companyId) : null) || {};
    if (co.avatar) return co.avatar;
    if (co.short) return String(co.short).charAt(0);
    return '';
  }

  function foot(price, unit, right) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">' +
      '<div class="jc-price">' + price + (unit ? '<span class="unit">' + esc(unit) + '</span>' : '') + '</div>' +
      (right || '') + '</div>';
  }

  function meta(s) {
    var parts = [];
    if (s.city) parts.push(esc(s.city));
    if (s.cat) parts.push(esc(s.cat) + (s.sub ? '·' + esc(s.sub) : ''));
    return parts.join('<span class="dot"></span>');
  }

  /* ---- 资质招商 ---- */
  function franchise(s) {
    var name = s.name || s.title;
    var q = ((s.qualCategory || '') + (s.qualLevel || '')).trim();
    var m = esc(s.region || s.location || s.city || '');
    if (s.mode) m += ' · ' + esc(s.mode);
    var price = (s.unlockPrice ? '¥' + s.unlockPrice : (s.budget || '面议'));
    if (s.originalPrice) price += '<span class="o" style="font-size:11px;color:var(--text-3);text-decoration:line-through;font-weight:400;margin-left:5px;">¥' + s.originalPrice + '</span>';
    var unit = s.unlockPrice ? '意向金' : (s.unit || '');
    var body = head(s) + '<div class="jc-title">' + esc(name) + (q ? ' · ' + esc(q) : '') + '</div>' +
      '<div class="jc-meta">' + m + '</div>' + chips(s.tags, 3);
    if (s.regions && s.regions.length) {
      body += statRow([
        [s.branchCount || 0, '已加盟'],
        [s.annualProjects || 0, '年中标'],
        [(s.regions || []).filter(function (r) { return r.status !== 'full'; }).length, '区域空缺', 'var(--error)']
      ]);
    } else {
      var fr = fieldsOf(s, ['首批名额', '分成']);
      if (fr.length) body += statRow([
        ['首批/分成', fr[0]],
        ['开放', fieldsOf(s, ['开放区域', '开放城市'])[0] || '—'],
        ['费用', s.budget ? s.budget + '万' : '面议']
      ]);
    }
    return body + foot(price, unit, '<div class="jc-company">' + company(s) + '</div>');
  }

  /* ---- 建企买卖 ---- */
  function trade(s) {
    return head(s) +
      '<div class="jc-title">' + esc(s.maskedName || s.title) + '</div>' +
      '<div class="jc-meta">' + esc(s.location || s.city || '') + (s.transferMethod ? '<span class="dot"></span>' + esc(s.transferMethod) : '') + '</div>' +
      chips(s.tags, 3) +
      foot(s.price ? s.price + '万' : '面议', s.price ? '100%转让' : '', '<div class="jc-company">' + company(s) + '</div>');
  }

  /* ---- 企业招聘 ---- */
  function personnel(s) {
    var kv = [];
    if (s.hireCount) kv.push(esc('招 ' + s.hireCount));
    if (s.jobType) kv.push(esc(s.jobType));
    if (!kv.length) kv = fieldsOf(s, ['需求人数', '社保要求']);
    var m = esc(s.city || '');
    if (kv.length) m = kv.join('<span class="dot"></span>') + '<span class="dot"></span>' + m;
    var av = companyAvatar(s);
    var avatarHtml = av ? '<div class="jc-avatar">' + esc(av) + '</div>' : '';
    return head(s) +
      '<div class="jc-head">' + avatarHtml + '<div class="jc-title">' + esc(s.title) + '</div></div>' +
      '<div class="jc-meta">' + m + '</div>' + chips(s.tags, 3) +
      foot(s.budget || '', s.unit || '', '<div class="jc-company">' + company(s) + '</div>');
  }

  /* ---- 人才求职 ---- */
  function talent(s) {
    var av = esc(s.avatar || (s.nameMasked ? String(s.nameMasked).charAt(0) : ''));
    var avatarHtml = av ? '<div class="jc-avatar">' + av + '</div>' : '';
    var regTxt = s.registerStatus && typeof s.registerStatus === 'object' ? s.registerStatus.status : s.registerStatus;
    var ssTxt = s.socialSecurity && typeof s.socialSecurity === 'object' ? s.socialSecurity.status : s.socialSecurity;
    var salTxt = (s.expectedSalary && s.expectedSalary.salaryRange) ? s.expectedSalary.salaryRange : (s.salaryRange || '面议');
    return head(s) +
      '<div class="jc-head">' + avatarHtml + '<div class="jc-title">' + esc(s.nameMasked || s.name || '') + ' · ' + esc(s.title || '') + '</div></div>' +
      '<div class="jc-meta">' + esc(s.location || s.city || '') + '<span class="dot"></span>' + esc(s.experience || '') + '<span class="dot"></span>' + esc(s.expectedPosition || '') + '</div>' +
      chips([regTxt, ssTxt, s.workArea, s.arrivalTime ? s.arrivalTime + '到岗' : ''], 3) +
      foot(esc(salTxt), '期望年薪', '<div class="jc-company">' + esc(s.nameMasked || s.name || '') + '</div>');
  }

  /* ---- 项目合作 / 材料 / 设备 / 劳务 / 中介：共用供需卡，按类型微调 meta ---- */
  function supplyLike(s) {
    var amt = s.price || s.budget || '';
    var unit = s.unit || '';
    var m = meta(s);
    if (s.bizKey === 'cooperation') {
      var cw = fieldsOf(s, ['合作方式'])[0];
      if (cw) m = esc(cw) + '<span class="dot"></span>' + m;
    }
    if (s.bizKey === 'agency') {
      var sc = fieldsOf(s, ['办理范围', '周期']);
      if (sc.length) m = sc.join('<span class="dot"></span>') + '<span class="dot"></span>' + m;
    }
    return head(s) +
      '<div class="jc-title">' + esc(s.title) + '</div>' +
      '<div class="jc-meta">' + m + '</div>' + chips(s.tags, 3) +
      foot(amt, unit, '<div class="jc-company">' + company(s) + '</div>');
  }

  var BUILDERS = {
    franchise: franchise, trade: trade, personnel: personnel, talent: talent,
    cooperation: supplyLike, material: supplyLike, equipment: supplyLike, labor: supplyLike, agency: supplyLike
  };

  /* 渲染一列卡片：list=条目数组；href=详情前缀（默认按 __ROOT__ 推算） */
  function render(list, href) {
    href = href || (window.__ROOT__ || '') + 'pages/supply/detail.html?id=';
    return list.map(function (s) {
      var fn = BUILDERS[s.bizKey] || supplyLike;
      /* 供应/需求类卡片附加方向类名，用于左上角弥散渐变标识（仅明亮模式） */
      var dirCls = '';
      if (s.dir === 'demand') dirCls = ' is-demand';
      else if (s.dir === 'supply') dirCls = ' is-supply';
      return '<a href="' + href + s.id + '" class="job-card' + dirCls + '">' + fn(s) + '</a>';
    }).join('');
  }

  return { render: render, esc: esc };
})();

/* ===== 通用列表底部组件（List Footer）===== */
window.ListFooter = (function () {
  function esc(s) { return String(s == null ? '' : s); }

  function render(config) {
    var buttons = (config.buttons || []).map(function (b, i) {
      return '<button type="button" class="lf-btn lf-btn-' + (b.style || 'outline') + '" data-lf-btn="' + i + '">' + esc(b.text) + '</button>';
    }).join('');
    var html = '<div class="list-footer">' +
      (config.icon ? '<div class="lf-icon">' + config.icon + '</div>' : '') +
      (config.title ? '<div class="lf-title">' + esc(config.title) + '</div>' : '') +
      (config.desc ? '<div class="lf-desc">' + esc(config.desc) + '</div>' : '') +
      (buttons ? '<div class="lf-buttons">' + buttons + '</div>' : '') +
    '</div>';
    if (config.buttons && config.buttons.length) {
      setTimeout(function () {
        config.buttons.forEach(function (b, i) {
          var btn = document.querySelector('.list-footer [data-lf-btn="' + i + '"]');
          if (btn && b.onClick) btn.addEventListener('click', b.onClick);
        });
      }, 0);
    }
    return html;
  }

  return { render: render };
})();

/* ============================================================================
   跨 tab 数据变更桥接器：监听 storage 事件，派发同文档 CustomEvent
   使已监听 engchain:* 事件的页面自动获得跨 tab 重渲染能力
   ============================================================================ */
(function () {
  var KEY_TO_EVENT = {
    'engchain-mode': 'engchain:mode',
    'engchain-users': 'engchain:entry',
    'engchain-entry': 'engchain:entry',
    'engchain-auth': 'engchain:auth',
    'engchain-state': 'engchain:state',
    'engchain-balance': 'engchain:balance',
    'engchain-credits': 'engchain:credits',
    'engchain-favorites': 'engchain:favorite',
    'engchain-orders': 'engchain:orders',
    'engchain-supply': 'engchain:supply',
    'engchain-withdrawals': 'engchain:withdrawals',
    'engchain-messages': 'engchain:messages'
  };
  var debounceTimers = {};
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    var evtName = KEY_TO_EVENT[e.key];
    if (!evtName) return;
    /* 派发通用变更事件 */
    window.dispatchEvent(new CustomEvent('engchain:store-change', { detail: { key: e.key, newValue: e.newValue, oldValue: e.oldValue } }));
    /* 派发专用事件（100ms 防抖，避免连续 storage 事件导致重复渲染） */
    if (debounceTimers[evtName]) clearTimeout(debounceTimers[evtName]);
    debounceTimers[evtName] = setTimeout(function () {
      window.dispatchEvent(new CustomEvent(evtName, { detail: { source: 'storage', key: e.key } }));
    }, 100);
  });
})();
