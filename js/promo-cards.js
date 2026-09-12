/* ============================================================
   promo-cards.js — 统一营销活动卡片展示系统
   一套卡片池 · 两种展示形态 · 四个展示区域
   - 大卡片轮播：首页首屏
   - 小条目旗帜：列表页/详情页/我的页
   - 关闭记录：sessionStorage（仅本次会话）
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 工具函数 ---------- */
  function getIdentity() {
    try {
      if (window.deriveIdentity) return deriveIdentity();
    } catch (e) {}
    try {
      var st = window.UI && UI.state ? UI.state.get() : {};
      if (!st.loggedIn) return { primary: 'guest', isGuest: true, enterprise: 'none', personal: 'none' };
    } catch (e) {}
    return { primary: 'guest', isGuest: true, enterprise: 'none', personal: 'none' };
  }

  function isBreakIn() {
    try { return !!(window.ModeStore && ModeStore.isBreakIn && ModeStore.isBreakIn()); } catch (e) { return false; }
  }

  function getClosedIds() {
    try {
      var raw = sessionStorage.getItem('engchain-closed-cards');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function markClosed(id) {
    var ids = getClosedIds();
    if (ids.indexOf(id) < 0) ids.push(id);
    try { sessionStorage.setItem('engchain-closed-cards', JSON.stringify(ids)); } catch (e) {}
  }

  function isClosed(id) { return getClosedIds().indexOf(id) >= 0; }

  /* ---------- 卡片池 ---------- */
  var CARDS = [
    {
      id: 'register-guide',
      type: 'guide',
      icon: '🎁',
      title: '注册即送 50 积分',
      subtitle: '实名认证免费解锁供需权益',
      shortText: '注册送50积分 · 实名解锁5条供需',
      cta: '立即注册',
      ctaHref: 'pages/auth/login.html',
      targetIdentity: ['guest'],
      weight: 100,
      regions: ['home', 'list', 'detail', 'me'],
      bg: 'blue'
    },
    {
      id: 'verify-guide',
      type: 'guide',
      icon: '✅',
      title: '完成实名认证',
      subtitle: '解锁发布供需与联系洽谈权益',
      shortText: '实名认证 · 解锁发布与联系洽谈',
      cta: '去认证',
      ctaHref: 'pages/profile/auth-prep.html',
      targetIdentity: ['unverified'],
      weight: 90,
      regions: ['home', 'list', 'detail', 'me'],
      bg: 'green'
    },
    {
      id: 'entry-guide',
      type: 'guide',
      icon: '🏢',
      title: '入驻企业享专属折扣',
      subtitle: '流量扶持 · 官方认证 · 佣金从优',
      shortText: '企业入驻 · 专属折扣与流量扶持',
      cta: '去入驻',
      ctaHref: 'pages/profile/entry.html',
      targetIdentity: ['verified'],
      weight: 80,
      regions: ['home', 'list', 'detail', 'me'],
      bg: 'gold'
    },
    {
      id: 'breakin-promo',
      type: 'promo',
      icon: '⭐',
      title: '破冰期限时优惠',
      subtitle: '建筑 0 元入驻 · 中介 5 折',
      shortText: '限时优惠 · 建筑0元入驻 · 中介5折',
      cta: '立即入驻',
      ctaHref: 'pages/profile/entry.html',
      targetIdentity: ['guest', 'unverified', 'verified', 'resident'],
      weight: 120,
      regions: ['home', 'list', 'detail', 'me'],
      bg: 'gold',
      breakInOnly: true
    },
    {
      id: 'resident-workbench',
      type: 'tool',
      icon: '📊',
      title: '入驻专属工作台',
      subtitle: '我的发布 · 佣金数据 · 入驻服务',
      shortText: '工作台 · 我的发布/佣金数据/入驻服务',
      cta: '进入工作台',
      ctaHref: 'pages/publish/records.html',
      targetIdentity: ['resident'],
      weight: 70,
      regions: ['home', 'me'],
      bg: 'gold'
    }
  ];

  /* ---------- 身份匹配 ---------- */
  function matchIdentity(card) {
    var idy = getIdentity();
    var current;
    if (idy.isGuest || idy.primary === 'guest') current = 'guest';
    else if (idy.enterprise === 'resident') current = 'resident';
    else if (idy.primary === 'realname' || idy.primary === 'pro' || idy.primary === 'partner' || idy.primary === 'enterprise') current = 'verified';
    else current = 'unverified';
    return card.targetIdentity.indexOf(current) >= 0;
  }

  /* ---------- 过滤可用卡片 ---------- */
  function filterCards(region) {
    return CARDS.filter(function (c) {
      if (c.regions.indexOf(region) < 0) return false;
      if (isClosed(c.id)) return false;
      if (!matchIdentity(c)) return false;
      if (c.breakInOnly && !isBreakIn()) return false;
      return true;
    });
  }

  /* ---------- 权重随机选择 ---------- */
  function pickRandom(cards, count) {
    if (!cards.length) return [];
    var pool = cards.slice();
    var result = [];
    var n = Math.min(count || 1, pool.length);
    for (var i = 0; i < n; i++) {
      var total = 0;
      pool.forEach(function (c) { total += c.weight; });
      var r = Math.random() * total;
      var acc = 0, idx = 0;
      for (var j = 0; j < pool.length; j++) {
        acc += pool[j].weight;
        if (r <= acc) { idx = j; break; }
      }
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  /* ---------- 背景样式映射 ---------- */
  var BG_MAP = {
    blue: 'linear-gradient(135deg,rgba(37,99,235,.10),rgba(37,99,235,.03));border:1px solid rgba(37,99,235,.18)',
    green: 'linear-gradient(135deg,rgba(91,154,111,.12),rgba(91,154,111,.04));border:1px solid rgba(91,154,111,.22)',
    gold: 'linear-gradient(135deg,rgba(201,169,97,.14),rgba(201,169,97,.04));border:1px solid rgba(201,169,97,.28)'
  };

  /* ---------- 大卡片渲染 ---------- */
  function renderLargeCard(card) {
    var root = window.__ROOT__ || '';
    var bg = BG_MAP[card.bg] || BG_MAP.gold;
    return '<div class="promo-card promo-card-lg" data-id="' + card.id + '" style="background:' + bg + ';border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;flex:none;width:100%;box-sizing:border-box;min-height:72px;" onclick="location.href=\'' + root + card.ctaHref + '\'">' +
      '<span style="flex:none;font-size:24px;">' + card.icon + '</span>' +
      '<span style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + card.title + '</div>' +
        '<div style="font-size:11px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + card.subtitle + '</div>' +
      '</span>' +
      '<span style="flex:none;height:30px;padding:0 13px;border-radius:999px;background:var(--primary);color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;">' + card.cta + '</span>' +
      '<span class="promo-close" data-id="' + card.id + '" style="flex:none;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.3;border-radius:50%;" onclick="event.stopPropagation();PromoCards.close(\'' + card.id + '\')">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</span>' +
    '</div>';
  }

  /* ---------- 小旗帜渲染 ---------- */
  function renderSmallFlag(card) {
    var root = window.__ROOT__ || '';
    return '<div class="promo-card promo-flag" data-id="' + card.id + '" style="display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:8px;background:rgba(201,169,97,.08);border:1px solid rgba(201,169,97,.2);font-size:11px;color:var(--text-2);cursor:pointer;box-sizing:border-box;overflow:hidden;" onclick="location.href=\'' + root + card.ctaHref + '\'">' +
      '<span style="flex:none;font-size:13px;">' + card.icon + '</span>' +
      '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">' + card.shortText + '</span>' +
      '<span class="promo-close" data-id="' + card.id + '" style="flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.25;border-radius:50%;" onclick="event.stopPropagation();PromoCards.close(\'' + card.id + '\')">' +
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</span>' +
    '</div>';
  }

  /* ---------- 关闭处理 ---------- */
  function closeCard(id) {
    markClosed(id);
    /* 移除所有该卡片的 DOM 元素 */
    var els = document.querySelectorAll('.promo-card[data-id="' + id + '"]');
    els.forEach(function (el) {
      el.style.transition = 'opacity .2s,transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'scale(.95)';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        /* 触发轮播重渲染 */
        if (window.PromoCards && PromoCards._onChange) PromoCards._onChange();
      }, 200);
    });
  }

  /* ---------- 首页大卡片轮播 ---------- */
  var carousel = {
    el: null,
    track: null,
    dots: null,
    cards: [],
    index: 0,
    timer: null,
    interval: 4000,
    touching: false,

    init: function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      this.el = container;
      this._retryCount = 0;
      this._tryRender();
    },

    _tryRender: function () {
      var container = this.el;
      if (!container) return;
      this.cards = filterCards('home');
      if (!this.cards.length) {
        this._retryCount = (this._retryCount || 0) + 1;
        if (this._retryCount < 15) {
          var self = this;
          setTimeout(function () { self._tryRender(); }, 200);
        } else {
          container.style.display = 'none';
        }
        return;
      }
      container.style.display = '';
      this.render();
      this.startAuto();
      var self = this;
      if (!this._eventsBound) {
        container.addEventListener('touchstart', function () { self.touching = true; self.stopAuto(); }, { passive: true });
        container.addEventListener('touchend', function () { self.touching = false; self.startAuto(); });
        container.addEventListener('mouseenter', function () { self.stopAuto(); });
        container.addEventListener('mouseleave', function () { if (!self.touching) self.startAuto(); });
        this._eventsBound = true;
      }
    },

    render: function () {
      var self = this;
      var html = '<div class="promo-carousel-track" style="display:flex;gap:10px;transition:transform .4s ease;will-change:transform;">' +
        this.cards.map(function (c) { return renderLargeCard(c); }).join('') +
        '</div>' +
        '<div class="promo-carousel-dots" style="display:flex;justify-content:center;gap:6px;margin-top:8px;">' +
        this.cards.map(function (_, i) {
          return '<span class="promo-dot" data-idx="' + i + '" style="width:6px;height:6px;border-radius:50%;background:var(--line);cursor:pointer;transition:all .3s;' + (i === 0 ? 'background:var(--primary);width:18px;border-radius:3px;' : '') + '"></span>';
        }).join('') +
        '</div>';
      this.el.innerHTML = html;
      this.track = this.el.querySelector('.promo-carousel-track');
      this.dots = this.el.querySelectorAll('.promo-dot');
      this.index = 0;
      this.updatePosition();
      /* dots 点击 */
      this.dots.forEach(function (d) {
        d.addEventListener('click', function () {
          self.goTo(parseInt(d.dataset.idx, 10));
          self.restartAuto();
        });
      });
    },

    updatePosition: function () {
      if (!this.track) return;
      var cardW = this.track.children[0] ? this.track.children[0].offsetWidth + 10 : 0;
      this.track.style.transform = 'translateX(-' + (this.index * cardW) + 'px)';
      this.dots.forEach(function (d, i) {
        if (i === self.index) { d.style.background = 'var(--primary)'; d.style.width = '18px'; d.style.borderRadius = '3px'; }
        else { d.style.background = 'var(--line)'; d.style.width = '6px'; d.style.borderRadius = '50%'; }
      });
    },

    goTo: function (idx) {
      if (!this.cards.length) return;
      this.index = ((idx % this.cards.length) + this.cards.length) % this.cards.length;
      this.updatePosition();
    },

    next: function () { this.goTo(this.index + 1); },

    startAuto: function () { this.stopAuto(); var self = this; this.timer = setInterval(function () { self.next(); }, this.interval); },
    stopAuto: function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
    restartAuto: function () { this.stopAuto(); this.startAuto(); },

    refresh: function () {
      this.cards = filterCards('home');
      if (!this.cards.length) { this.el.style.display = 'none'; this.stopAuto(); return; }
      this.el.style.display = '';
      this.render();
      this.restartAuto();
    }
  };

  /* 修复 updatePosition 中的 self 引用 */
  var _origUpdate = carousel.updatePosition;
  carousel.updatePosition = function () {
    if (!this.track) return;
    var cardW = this.track.children[0] ? this.track.children[0].offsetWidth + 10 : 0;
    this.track.style.transform = 'translateX(-' + (this.index * cardW) + 'px)';
    var self = this;
    this.dots.forEach(function (d, i) {
      if (i === self.index) { d.style.background = 'var(--primary)'; d.style.width = '18px'; d.style.borderRadius = '3px'; }
      else { d.style.background = 'var(--line)'; d.style.width = '6px'; d.style.borderRadius = '50%'; }
    });
  };

  /* ---------- 小旗帜：获取随机1张 ---------- */
  function getSmallFlag(region) {
    var cards = filterCards(region);
    var picked = pickRandom(cards, 1);
    return picked.length ? picked[0] : null;
  }

  function renderSmallFlagFor(region) {
    var card = getSmallFlag(region);
    return card ? renderSmallFlag(card) : '';
  }

  /* ---------- 列表页：每N条插入小旗帜 ---------- */
  function injectIntoList(listEl, itemSelector, interval) {
    if (!listEl) return;
    interval = interval || 6;
    /* 移除之前注入的小旗帜 */
    var old = listEl.querySelectorAll('.promo-flag.injected');
    old.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });

    var items = listEl.querySelectorAll(itemSelector);
    if (!items.length) return;
    var card = getSmallFlag('list');
    if (!card) return;

    /* 在每 interval 条后插入，位置在区间内随机 */
    for (var i = interval - 1; i < items.length; i += interval) {
      var insertAfter = items[i];
      var flag = document.createElement('div');
      flag.innerHTML = renderSmallFlag(card);
      flag = flag.firstElementChild;
      flag.classList.add('injected');
      flag.style.margin = '8px 0';
      if (insertAfter.nextSibling) listEl.insertBefore(flag, insertAfter.nextSibling);
      else listEl.appendChild(flag);
    }
  }

  /* ---------- 详情页/我的页：注入1张小旗帜 ---------- */
  function injectIntoContainer(containerEl, region) {
    if (!containerEl) return;
    /* 移除之前注入的 */
    var old = containerEl.querySelectorAll('.promo-flag.injected');
    old.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    var html = renderSmallFlagFor(region);
    if (!html) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var flag = wrap.firstElementChild;
    flag.classList.add('injected');
    flag.style.margin = '10px 0';
    containerEl.appendChild(flag);
  }

  /* ---------- 导出 ---------- */
  window.PromoCards = {
    CARDS: CARDS,
    close: closeCard,
    getClosedIds: getClosedIds,
    filterCards: filterCards,
    pickRandom: pickRandom,
    renderLargeCard: renderLargeCard,
    renderSmallFlag: renderSmallFlag,
    renderSmallFlagFor: renderSmallFlagFor,
    getSmallFlag: getSmallFlag,
    initCarousel: function (id) { carousel.init(id); },
    refreshCarousel: function () { carousel.refresh(); },
    injectIntoList: injectIntoList,
    injectIntoContainer: injectIntoContainer,
    _onChange: function () { if (carousel.el && carousel.el.style.display !== 'none') carousel.refresh(); }
  };

  /* 自动初始化：检测到轮播容器则自动初始化（不依赖页面手动调用） */
  function autoInitCarousel() {
    if (document.getElementById('home-promo-carousel')) {
      carousel.init('home-promo-carousel');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitCarousel);
  } else {
    autoInitCarousel();
  }

  /* 自动注入小旗帜：列表页每6条插入1张、详情页/我的页各1张 */
  function autoInjectFlags() {
    /* 列表页：#list 容器，每6条插入1张 */
    var listEl = document.getElementById('list');
    if (listEl) {
      var doInject = function () { injectIntoList(listEl, '#list > *', 6); };
      setTimeout(doInject, 600);
      try {
        var listObserver = new MutationObserver(function () { doInject(); });
        listObserver.observe(listEl, { childList: true });
      } catch (e) {}
    }

    /* 详情页：有 .detail-actionbar 的页面，.scroll 容器底部注入1张 */
    var detailScroll = document.querySelector('.scroll');
    var detailActionbar = document.querySelector('.detail-actionbar');
    if (detailScroll && detailActionbar) {
      setTimeout(function () { injectIntoContainer(detailScroll, 'detail'); }, 500);
    }

    /* 我的页：.profile-content 注入1张 */
    var profileContent = document.querySelector('.profile-content');
    if (profileContent) {
      setTimeout(function () { injectIntoContainer(profileContent, 'me'); }, 500);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInjectFlags);
  } else {
    autoInjectFlags();
  }
})();
