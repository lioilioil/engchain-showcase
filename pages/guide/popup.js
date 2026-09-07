/**
 * 工程链 ENGCHAIN — 破冰期引导弹窗
 * 全局对象：window.GuidePopup
 *   - GuidePopup.showVisitor()  游客富交互弹窗（全屏大图）
 *   - GuidePopup.showUser()     注册用户福利弹窗（卡片式）
 *   - GuidePopup.init()         根据身份与 localStorage 自动弹出
 *   - GuidePopup.willShow()     本次是否会自动弹出（与 init 同口径，供入口页决定跳转）
 *   - showVisitor/showUser/init 均支持 opts.onClose：弹窗被"关闭 / 稍后再说 / 点遮罩"关闭后回调；
 *     "立即注册 / 去登录 / 立即前往 / 福利项跳转"等导航按钮不触发 onClose。
 *
 * 依赖：无硬依赖；若 window.UI 存在则使用 UI.toast 做轻提示。
 * 路径：通过 window.__ROOT__ 解析素材与跳转地址（首页为 ''，guide 页为 '../../'）。
 */
(function (global) {
  'use strict';

  var ROOT = function () { return global.__ROOT__ || ''; };
  var VISITOR_KEY = 'engchain-guide-popup-visitor';
  var USER_KEY = 'engchain-guide-popup-user';
  var STYLE_ID = 'engchain-guide-popup-style';
  var activeOverlay = null;
  var carouselTimer = null;

  /* ---------- 工具 ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function lockBody() {
    document.body.style.overflow = 'hidden';
  }
  function unlockBody() {
    document.body.style.overflow = '';
  }
  function toast(msg, type) {
    if (global.UI && UI.toast) { UI.toast(msg, type); }
  }
  function isRegistered() {
    try {
      var raw = localStorage.getItem('engchain-state');
      if (!raw) return false;
      var s = JSON.parse(raw);
      return !!(s && s.user);
    } catch (e) { return false; }
  }
  function getAuth() {
    try { return JSON.parse(localStorage.getItem('engchain-auth') || '{}'); } catch (e) { return {}; }
  }
  /** 福利任务完成数（4 项：实名 / 首发 / 邀请 / 企认） */
  function getWelfareDone() {
    var done = 0;
    var auth = getAuth();
    if (auth.realname && auth.realname.ok) done++;
    if (localStorage.getItem('engchain-published') === '1') done++;
    if (localStorage.getItem('engchain-invited') === '1') done++;
    if (auth.enterprise && auth.enterprise.ok) done++;
    return done;
  }

  /* ---------- 注入样式（仅一次） ---------- */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ===== 通用遮罩 ===== */
      '.gp-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease;}',
      '.gp-overlay.gp-show{opacity:1;}',
      '.gp-overlay.gp-hide{opacity:0;pointer-events:none;}',

      /* ===== 游客弹窗 ===== */
      '.gp-visitor{background:#000;}',
      '.gp-visitor-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.12);transition:opacity .7s ease,transform 1s cubic-bezier(.22,.61,.36,1);}',
      '.gp-visitor.gp-show .gp-visitor-bg{opacity:1;transform:scale(1);}',
      '.gp-visitor-mask{position:absolute;inset:0;background:linear-gradient(to top,rgba(18,12,4,.94) 0%,rgba(18,12,4,.62) 42%,rgba(18,12,4,.18) 72%,rgba(18,12,4,0) 100%);}',
      '.gp-visitor-close{position:absolute;top:calc(env(safe-area-inset-top,0px) + 16px);right:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:background .2s,transform .15s;-webkit-tap-highlight-color:transparent;}',
      '.gp-visitor-close:active{background:rgba(0,0,0,.55);transform:scale(.92);}',
      '.gp-visitor-body{position:relative;z-index:2;align-self:flex-end;width:100%;padding:0 24px calc(env(safe-area-inset-bottom,0px) + 40px);box-sizing:border-box;opacity:0;transform:translateY(32px);transition:opacity .55s ease .25s,transform .55s cubic-bezier(.22,.61,.36,1) .25s;}',
      '.gp-visitor.gp-show .gp-visitor-body{opacity:1;transform:translateY(0);}',
      '.gp-v-tag{display:inline-block;padding:5px 12px;border-radius:20px;background:rgba(201,169,97,.18);border:1px solid rgba(201,169,97,.4);color:#E8D5A3;font-size:11px;font-weight:600;letter-spacing:.04em;}',
      '.gp-v-title{margin-top:14px;font-size:26px;font-weight:800;color:#fff;line-height:1.28;letter-spacing:.01em;}',
      '.gp-v-title span{background:linear-gradient(135deg,#F0DDA8,#C9A961);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}',
      /* 卖点轮播 */
      '.gp-v-carousel{margin-top:22px;position:relative;min-height:48px;}',
      '.gp-v-slide{position:absolute;inset:0;opacity:0;transform:translateY(8px);transition:opacity .4s ease,transform .4s ease;pointer-events:none;}',
      '.gp-v-slide.active{opacity:1;transform:translateY(0);pointer-events:auto;position:relative;}',
      '.gp-v-slide-text{font-size:15px;color:rgba(255,255,255,.88);line-height:1.5;display:flex;align-items:flex-start;gap:8px;}',
      '.gp-v-slide-text::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:#C9A961;margin-top:8px;box-shadow:0 0 8px rgba(201,169,97,.6);}',
      '.gp-v-dots{display:flex;gap:6px;margin-top:12px;}',
      '.gp-v-dot{width:18px;height:3px;border-radius:2px;background:rgba(255,255,255,.25);border:none;padding:0;cursor:pointer;transition:background .3s,width .3s;}',
      '.gp-v-dot.active{background:#C9A961;width:28px;}',
      /* 注册按钮 */
      '.gp-v-register{margin-top:28px;width:100%;height:54px;border:none;border-radius:14px;background:linear-gradient(135deg,#D4B876 0%,#C9A961 50%,#A98A47 100%);color:var(--text-inv);font-size:16px;font-weight:700;letter-spacing:.03em;cursor:pointer;box-shadow:0 6px 20px rgba(201,169,97,.4),inset 0 1px 0 rgba(255,255,255,.3);animation:gpBreath 2.4s ease-in-out infinite;transition:transform .15s;-webkit-tap-highlight-color:transparent;}',
      '.gp-v-register:active{transform:scale(.97);}',
      '@keyframes gpBreath{0%,100%{box-shadow:0 6px 20px rgba(201,169,97,.4),inset 0 1px 0 rgba(255,255,255,.3);}50%{box-shadow:0 6px 32px rgba(201,169,97,.65),0 0 0 4px rgba(201,169,97,.12),inset 0 1px 0 rgba(255,255,255,.3);}}',
      '.gp-v-login{margin-top:14px;text-align:center;font-size:13px;color:rgba(255,255,255,.6);}',
      '.gp-v-login a{color:#E8D5A3;text-decoration:none;font-weight:600;}',

      /* ===== 注册用户弹窗 ===== */
      '.gp-user-mask{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);}',
      '.gp-user-card{position:relative;z-index:2;width:320px;max-width:calc(100vw - 40px);border-radius:20px;overflow:hidden;background:var(--bg-card);box-shadow:0 20px 60px rgba(0,0,0,.3);opacity:0;transform:translateY(100px) scale(.9);transition:opacity .45s cubic-bezier(.34,1.56,.64,1),transform .45s cubic-bezier(.34,1.56,.64,1);}',
      '.gp-user.gp-show .gp-user-card{opacity:1;transform:translateY(0) scale(1);}',
      '.gp-user.gp-hide .gp-user-card{opacity:0;transform:scale(.92) translateY(20px);transition:opacity .25s ease,transform .25s ease;}',
      '.gp-u-banner{position:relative;height:140px;background-size:cover;background-position:center;}',
      '.gp-u-banner-mask{position:absolute;inset:0;background:linear-gradient(135deg,rgba(20,16,40,.72) 0%,rgba(40,30,10,.55) 100%);}',
      '.gp-u-banner-text{position:relative;z-index:2;padding:22px 20px 0;color:#fff;}',
      '.gp-u-banner-title{font-size:20px;font-weight:800;letter-spacing:.02em;}',
      '.gp-u-banner-sub{margin-top:5px;font-size:12px;color:rgba(255,255,255,.78);}',
      '.gp-u-close{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,.3);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:background .2s;}',
      '.gp-u-close:active{background:rgba(0,0,0,.5);}',
      '.gp-u-body{padding:16px 18px 18px;}',
      /* 进度 */
      '.gp-u-progress-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}',
      '.gp-u-progress-label{font-size:12px;color:var(--text-3);}',
      '.gp-u-progress-label b{color:var(--primary);font-weight:700;}',
      '.gp-u-bar{width:100%;height:6px;border-radius:3px;background:var(--primary-soft);overflow:hidden;}',
      '.gp-u-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#E8D5A3,#C9A961,#A98A47);width:0;transition:width .7s cubic-bezier(.22,.61,.36,1);box-shadow:0 0 6px rgba(201,169,97,.4);}',
      /* 福利列表 */
      '.gp-u-list{margin-top:14px;display:flex;flex-direction:column;gap:2px;}',
      '.gp-u-item{display:flex;align-items:center;gap:12px;padding:11px 10px;border-radius:12px;cursor:pointer;transition:background .15s;-webkit-tap-highlight-color:transparent;}',
      '.gp-u-item:active{background:var(--primary-soft);}',
      '.gp-u-item-icon{flex:none;width:38px;height:38px;border-radius:11px;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;color:var(--primary);box-shadow:inset 0 0 0 1px var(--accent-line);}',
      '.gp-u-item-icon svg{width:20px;height:20px;}',
      '.gp-u-item-info{flex:1;min-width:0;}',
      '.gp-u-item-title{font-size:13.5px;font-weight:600;color:var(--text-1);line-height:1.3;}',
      '.gp-u-item-desc{font-size:11px;color:var(--text-3);margin-top:2px;line-height:1.35;}',
      '.gp-u-item-reward{flex:none;text-align:right;}',
      '.gp-u-item-amount{font-size:14px;font-weight:800;color:var(--primary);line-height:1.2;}',
      '.gp-u-item-unit{font-size:10px;color:var(--primary-dim);}',
      '.gp-u-item-done{flex:none;width:22px;height:22px;border-radius:50%;background:var(--success);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;}',
      /* 按钮区 */
      '.gp-u-actions{margin-top:16px;display:flex;gap:10px;}',
      '.gp-u-btn-primary{flex:1;height:46px;border:none;border-radius:12px;background:linear-gradient(135deg,#D4B876,#C9A961,#A98A47);color:var(--text-inv);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(201,169,97,.35);transition:transform .15s;}',
      '.gp-u-btn-primary:active{transform:scale(.96);}',
      '.gp-u-btn-secondary{flex:1;height:46px;border:1px solid var(--line);border-radius:12px;background:var(--bg-card-2);color:var(--text-2);font-size:14px;font-weight:600;cursor:pointer;transition:background .15s;}',
      '.gp-u-btn-secondary:active{background:var(--bg-inset);}',
    ].join('');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- 通用：移除弹窗 ---------- */
  function removeOverlay(overlay, immediate) {
    if (!overlay) return;
    if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
    if (immediate) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (activeOverlay === overlay) activeOverlay = null;
      unlockBody();
      return;
    }
    overlay.classList.add('gp-hide');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (activeOverlay === overlay) activeOverlay = null;
      unlockBody();
    }, 320);
  }

  /* ---------- 游客弹窗 ---------- */
  function showVisitor(opts) {
    opts = opts || {};
    injectStyle();
    if (activeOverlay) removeOverlay(activeOverlay, true);

    var root = ROOT();
    var bgUrl = root + 'assets/guide/hero-construction.jpg';
    var loginHref = root + 'pages/profile/index.html';
    var registerHref = root + 'pages/profile/index.html';

    var overlay = el('div', 'gp-overlay gp-visitor');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '工程链新用户引导');

    overlay.innerHTML =
      '<div class="gp-visitor-bg" style="background-image:url(\'' + bgUrl + '\')"></div>' +
      '<div class="gp-visitor-mask"></div>' +
      '<button type="button" class="gp-visitor-close" aria-label="关闭">×</button>' +
      '<div class="gp-visitor-body">' +
        '<span class="gp-v-tag">建筑行业供需一站式平台</span>' +
        '<div class="gp-v-title">连接建筑供需<br><span>成就每一项工程</span></div>' +
        '<div class="gp-v-carousel" id="gpVCarousel">' +
          '<div class="gp-v-slide active"><div class="gp-v-slide-text">海量供需信息，覆盖全国300+城市</div></div>' +
          '<div class="gp-v-slide"><div class="gp-v-slide-text">AI智能匹配，精准对接需求</div></div>' +
          '<div class="gp-v-slide"><div class="gp-v-slide-text">实名认证保障，交易安全可靠</div></div>' +
        '</div>' +
        '<div class="gp-v-dots" id="gpVDots">' +
          '<button type="button" class="gp-v-dot active" data-i="0" aria-label="卖点1"></button>' +
          '<button type="button" class="gp-v-dot" data-i="1" aria-label="卖点2"></button>' +
          '<button type="button" class="gp-v-dot" data-i="2" aria-label="卖点3"></button>' +
        '</div>' +
        '<button type="button" class="gp-v-register" id="gpVRegister">立即注册，解锁全部功能</button>' +
        '<div class="gp-v-login">已有账号？<a href="' + loginHref + '" id="gpVLogin">去登录</a></div>' +
      '</div>';

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    lockBody();

    // 触发入场动画
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('gp-show'); });
    });

    // 卖点轮播
    var slides = overlay.querySelectorAll('.gp-v-slide');
    var dots = overlay.querySelectorAll('.gp-v-dot');
    var cur = 0;
    function goSlide(n) {
      cur = (n + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.toggle('active', i === cur);
        dots[i].classList.toggle('active', i === cur);
      }
    }
    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        goSlide(parseInt(d.dataset.i, 10));
        restartCarousel();
      });
    });
    function restartCarousel() {
      if (carouselTimer) clearInterval(carouselTimer);
      carouselTimer = setInterval(function () { goSlide(cur + 1); }, 3000);
    }
    restartCarousel();

    // 关闭（仅 × 按钮，不支持遮罩关闭）；关闭后回调 opts.onClose（入口页用它跳转新首页）
    overlay.querySelector('.gp-visitor-close').addEventListener('click', function () {
      markShown(VISITOR_KEY);
      removeOverlay(overlay);
      if (opts && typeof opts.onClose === 'function') opts.onClose();
    });

    // 注册按钮
    overlay.querySelector('#gpVRegister').addEventListener('click', function () {
      markShown(VISITOR_KEY);
      removeOverlay(overlay);
      setTimeout(function () { location.href = registerHref; }, 200);
    });

    // 登录链接
    var loginLink = overlay.querySelector('#gpVLogin');
    if (loginLink) loginLink.addEventListener('click', function () {
      markShown(VISITOR_KEY);
    });

    return overlay;
  }

  /* ---------- 注册用户弹窗 ---------- */
  function showUser(opts) {
    opts = opts || {};
    injectStyle();
    if (activeOverlay) removeOverlay(activeOverlay, true);

    var root = ROOT();
    var bannerUrl = root + 'assets/guide/supply-network.jpg';
    var done = getWelfareDone();

    var welfare = [
      { icon: 'shield',   title: '完成实名认证', desc: '解锁信息发布与联系能力', amount: '¥50', unit: '积分', href: root + 'pages/profile/auth.html',       ok: !!(getAuth().realname && getAuth().realname.ok) },
      { icon: 'doc',      title: '首次发布供需', desc: '首页曝光推荐',             amount: '¥30', unit: '积分', href: root + 'pages/publish/index.html',    ok: localStorage.getItem('engchain-published') === '1' },
      { icon: 'share',    title: '邀请好友注册', desc: '分销佣金资格',             amount: '¥20', unit: '积分/人', href: root + 'pages/distribution/index.html', ok: localStorage.getItem('engchain-invited') === '1' },
      { icon: 'company',  title: '完成企业认证', desc: '企业专属标识',             amount: '¥100', unit: '积分', href: root + 'pages/profile/auth.html',      ok: !!(getAuth().enterprise && getAuth().enterprise.ok) },
    ];

    var overlay = el('div', 'gp-overlay gp-user');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '新用户专属福利');

    var listHtml = welfare.map(function (w, idx) {
      return '<div class="gp-u-item" data-href="' + w.href + '" data-idx="' + idx + '">' +
        '<span class="gp-u-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#i-' + w.icon + '"/></svg></span>' +
        '<div class="gp-u-item-info">' +
          '<div class="gp-u-item-title">' + w.title + '</div>' +
          '<div class="gp-u-item-desc">' + w.desc + '</div>' +
        '</div>' +
        (w.ok
          ? '<span class="gp-u-item-done">✓</span>'
          : '<span class="gp-u-item-reward"><div class="gp-u-item-amount">' + w.amount + '</div><div class="gp-u-item-unit">' + w.unit + '</div></span>') +
      '</div>';
    }).join('');

    overlay.innerHTML =
      '<div class="gp-user-mask"></div>' +
      '<div class="gp-user-card">' +
        '<div class="gp-u-banner" style="background-image:url(\'' + bannerUrl + '\')">' +
          '<div class="gp-u-banner-mask"></div>' +
          '<button type="button" class="gp-u-close" aria-label="关闭">×</button>' +
          '<div class="gp-u-banner-text">' +
            '<div class="gp-u-banner-title">新用户专属福利</div>' +
            '<div class="gp-u-banner-sub">完成任务，赢取丰厚奖励</div>' +
          '</div>' +
        '</div>' +
        '<div class="gp-u-body">' +
          '<div class="gp-u-progress-row">' +
            '<span class="gp-u-progress-label">已完成 <b>' + done + '</b>/4 项任务</span>' +
          '</div>' +
          '<div class="gp-u-bar"><div class="gp-u-bar-fill" id="gpUFill"></div></div>' +
          '<div class="gp-u-list">' + listHtml + '</div>' +
          '<div class="gp-u-actions">' +
            '<button type="button" class="gp-u-btn-secondary" id="gpULater">稍后再说</button>' +
            '<button type="button" class="gp-u-btn-primary" id="gpUGo">立即前往</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    lockBody();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('gp-show');
        var fill = overlay.querySelector('#gpUFill');
        if (fill) setTimeout(function () { fill.style.width = (done / 4 * 100) + '%'; }, 200);
      });
    });

    function closeUser() {
      markShown(USER_KEY);
      removeOverlay(overlay);
      if (opts && typeof opts.onClose === 'function') opts.onClose();
    }

    overlay.querySelector('.gp-u-close').addEventListener('click', closeUser);
    overlay.querySelector('#gpULater').addEventListener('click', closeUser);

    // 遮罩点击关闭
    overlay.querySelector('.gp-user-mask').addEventListener('click', closeUser);

    // 主按钮：跳转到第一个未完成任务
    overlay.querySelector('#gpUGo').addEventListener('click', function () {
      var firstUndone = welfare.filter(function (w) { return !w.ok; })[0];
      var target = firstUndone ? firstUndone.href : (root + 'pages/profile/auth.html');
      markShown(USER_KEY);
      removeOverlay(overlay);
      setTimeout(function () { location.href = target; }, 200);
    });

    // 福利项点击跳转
    overlay.querySelectorAll('.gp-u-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var href = item.dataset.href;
        markShown(USER_KEY);
        removeOverlay(overlay);
        setTimeout(function () { location.href = href; }, 200);
      });
    });

    return overlay;
  }

  /* ---------- localStorage 标记 ---------- */
  function markShown(key) {
    try { localStorage.setItem(key, String(Date.now())); } catch (e) {}
  }
  function hasShown(key) {
    try { return !!localStorage.getItem(key); } catch (e) { return false; }
  }

  /* ---------- 初始化：自动判断弹出 ---------- */
  function init(opts) {
    opts = opts || {};
    injectStyle();
    // 延迟到页面渲染后
    setTimeout(function () {
      if (isRegistered()) {
        if (!hasShown(USER_KEY)) showUser(opts);
      } else {
        if (!hasShown(VISITOR_KEY)) showVisitor(opts);
      }
    }, 600);
  }

  /* ---------- 本次是否会自动弹出（与 init 同口径，供入口页判断跳转） ---------- */
  function willShow() {
    return isRegistered() ? !hasShown(USER_KEY) : !hasShown(VISITOR_KEY);
  }

  /* ---------- 导出 ---------- */
  global.GuidePopup = {
    showVisitor: showVisitor,
    showUser: showUser,
    init: init,
    willShow: willShow,
    _keys: { visitor: VISITOR_KEY, user: USER_KEY },
  };
})(window);
