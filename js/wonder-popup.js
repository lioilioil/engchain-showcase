/* ============================================================================
   工程链 ENGCHAIN — 惊喜时刻弹窗 WonderPopup（渲染 + 动效编排）
   ----------------------------------------------------------------------------
   v1.0（2026-09-28）。配合 js/wonder-engine.js 使用，本身不做任何业务决策。
   WonderPopup.show({
     decisionId, persona, guest, budgetState, nba:{ctaText,ctaHref,altText,altHref,postTitle},
     onReveal() -> {kind:'credits'|'pending'|'none', amount, tier, tierLabel, expireAt},
     onCta(result), onDismiss(phase)
   })
   时间轴：omen(.6s) → gather(.7s) → 轻触揭晓 → burst+countup(≤1.6s) → result
   ============================================================================ */
(function (w, d) {
  'use strict';

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  /* 徽印：等高线圆环 + 定位星点（工程蓝图里一处发光坐标） */
  var MARK = '<svg class="wp-emblem-mark" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<circle cx="24" cy="24" r="15.5" opacity=".55"/><circle cx="24" cy="24" r="9.5" opacity=".7"/>' +
    '<path d="M24 8.5v4M24 35.5v4M8.5 24h4M35.5 24h4" opacity=".6"/>' +
    '<circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none"/>' +
    '</svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reduced() {
    try { return w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  var current = null;

  function mountRoot() {
    var phone = d.querySelector('.phone');
    var root = d.createElement('div');
    root.className = 'wp-root' + (phone ? '' : ' wp-fixed');
    (phone || d.body).appendChild(root);
    return root;
  }

  /* 从屏外汇聚的光点初始坐标（相对中心） */
  function seedSpans(n) {
    var html = '', R = 150;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (i % 2) * 0.35;
      var fx = Math.round(Math.cos(ang) * R * (0.75 + (i % 3) * 0.18));
      var fy = Math.round(Math.sin(ang) * R * (0.75 + (i % 3) * 0.18));
      var dur = 560 + (i % 4) * 90;
      var delay = (i % 5) * 55;
      html += '<span class="wp-seed" style="--fx:' + fx + 'px;--fy:' + fy + 'px;--dur:' + dur + 'ms;--delay:' + delay + 'ms"></span>';
    }
    return html;
  }

  /* 揭晓粒子 */
  function moteSpans(lucky) {
    var n = lucky ? 22 : 14;
    var html = '', R = 168;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (i % 3) * 0.22;
      var dist = R * (0.7 + (i % 4) * 0.16);
      var tx = Math.round(Math.cos(ang) * dist);
      var ty = Math.round(Math.sin(ang) * dist - 12);
      var size = 4 + (i % 3) * 2 + (lucky ? 1 : 0);
      var dur = 780 + (i % 5) * 90;
      var delay = (i % 4) * 40;
      var rot = (i * 47) % 360;
      var spark = i % 4 === 0 ? ' wp-spark' : '';
      html += '<span class="wp-mote' + spark + '" style="--tx:' + tx + 'px;--ty:' + ty + 'px;--rot:' + rot + 'deg;--size:' + size + 'px;--dur:' + dur + 'ms;--delay:' + delay + 'ms"></span>';
    }
    return html;
  }

  function countUp(el, target, durMs, done) {
    if (reduced()) { el.textContent = target; done && done(); return; }
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / durMs);
      var e = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
      el.textContent = Math.round(target * e);
      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = target; done && done(); }
    }
    requestAnimationFrame(frame);
  }

  function closeAll(phase, opts) {
    if (!current) return;
    var c = current;
    current = null;
    (c.timers || []).forEach(clearTimeout);
    if (c.escHandler) d.removeEventListener('keydown', c.escHandler);
    if (c.onDismiss && !(opts && opts.skipDismiss)) { try { c.onDismiss(phase); } catch (e) {} }
    c.root.classList.add('wp-leave');
    setTimeout(function () { if (c.root && c.root.parentNode) c.root.parentNode.removeChild(c.root); }, reduced() ? 0 : 300);
  }

  function show(ctx) {
    if (current) return null;
    var rm = reduced();
    var root = mountRoot();
    var ctrl = { root: root, ctx: ctx, timers: [], onDismiss: ctx.onDismiss, revealed: false };
    current = ctrl;
    function later(fn, ms) { var id = setTimeout(fn, rm ? Math.min(ms, 30) : ms); ctrl.timers.push(id); }

    root.innerHTML =
      '<div class="wp-scrim"></div>' +
      (rm ? '' :
        '<div class="wp-omen"><span class="wp-omen-dot"></span><span class="wp-omen-text">等等，有份补给正在靠近…</span>' +
        '<span class="wp-omen-x" role="button" aria-label="放弃本次补给">' + CLOSE + '</span></div>') +
      '<div class="wp-dialog wp-phase-gather" role="dialog" aria-modal="true" aria-label="浏览补给">' +
        '<button class="wp-close" type="button" aria-label="关闭">' + CLOSE + '</button>' +
        '<div class="wp-stage">' +
          '<div class="wp-particles">' + seedSpans(10) + moteSpans(false) + '<span class="wp-sheen"></span></div>' +
          '<span class="wp-burst-ring"></span>' +
          '<div class="wp-emblem" role="button" tabindex="0" aria-label="轻触揭晓补给">' +
            '<span class="wp-emblem-disc"></span>' + MARK +
            '<span class="wp-emblem-hint">轻 触 揭 晓</span>' +
          '</div>' +
        '</div>' +
        '<div class="wp-badge">ENGCHAIN · 浏览补给</div>' +
        '<h3 class="wp-title">逛了这么久，这份补给给你</h3>' +
        '<p class="wp-desc">在工程蓝图里发现了一处发光的坐标，轻触徽印，查收今天的小奇迹。</p>' +
        '<div class="wp-amount"><span class="wp-amount-num">0</span><span class="wp-amount-unit">积分</span></div>' +
        '<div class="wp-tierline"></div>' +
        '<p class="wp-note"></p>' +
        '<div class="wp-actions">' +
          '<a class="wp-btn" href="' + esc(ctx.nba.ctaHref) + '">' + esc(ctx.nba.ctaText) + ARROW + '</a>' +
          (ctx.nba.altText ? '<a class="wp-alt" href="' + esc(ctx.nba.altHref || '#') + '">' + esc(ctx.nba.altText) + '</a>' : '') +
        '</div>' +
      '</div>';

    var dialog = root.querySelector('.wp-dialog');
    var emblem = root.querySelector('.wp-emblem');
    var particles = root.querySelector('.wp-particles');
    var omen = root.querySelector('.wp-omen');

    /* omen 关闭 = 放弃（不结算、不发奖） */
    var omenX = root.querySelector('.wp-omen-x');
    if (omenX) omenX.addEventListener('click', function (e) { e.stopPropagation(); closeAll('omen'); });

    root.querySelector('.wp-close').addEventListener('click', function () {
      closeAll(ctrl.revealed ? 'result' : 'gather');
    });
    root.querySelector('.wp-scrim').addEventListener('click', function () {
      /* 揭晓前点遮罩可放弃；落定后避免误触，只能用按钮/关闭 */
      if (!ctrl.revealed) closeAll('gather');
    });
    d.addEventListener('keydown', escHandler);
    ctrl.escHandler = escHandler;
    function escHandler(e) { if (e.key === 'Escape' && current === ctrl) closeAll(ctrl.revealed ? 'result' : 'gather'); }

    function reveal() {
      if (ctrl.revealed) return;
      ctrl.revealed = true;
      var result = { kind: 'none' };
      try { result = ctx.onReveal() || { kind: 'none' }; } catch (e) { result = { kind: 'error' }; }

      var tierline = root.querySelector('.wp-tierline');
      var note = root.querySelector('.wp-note');
      var numEl = root.querySelector('.wp-amount-num');
      var unitEl = root.querySelector('.wp-amount-unit');
      var titleEl = root.querySelector('.wp-title');
      var descEl = root.querySelector('.wp-desc');
      var btn = root.querySelector('.wp-btn');
      var alt = root.querySelector('.wp-alt');

      if (result.kind === 'none' || result.kind === 'error' || result.kind === 'exhausted') {
        /* 预算熔断：无奖励纯引导，零成本保留触达 */
        dialog.classList.add('wp-no-reward');
        particles.style.display = 'none';
        root.querySelector('.wp-badge').textContent = 'ENGCHAIN · 商机提醒';
        titleEl.textContent = '今日补给已发完';
        descEl.textContent = ctx.nba.postTitle || '不过我们为你留意了几条新商机，先去看看？';
        root.querySelector('.wp-amount').style.display = 'none';
        tierline.style.display = 'none';
        toResult(0);
        return;
      }

      var lucky = result.tier === 'lucky';
      if (lucky) dialog.classList.add('lucky');
      /* 重绘粒子数量（lucky 22 粒） */
      particles.innerHTML = moteSpans(lucky) + '<span class="wp-sheen"></span>';
      dialog.classList.add('wp-revealed');

      countUp(numEl, result.amount, 820, function () {
        toResult(140);
      });
      tierline.textContent = result.tierLabel ? (result.tierLabel + (lucky ? ' · 今日锦鲤' : '')) : '';
      if (result.kind === 'pending') {
        note.textContent = '已为你预留 7 天，注册领取后到账';
        unitEl.textContent = '积分';
      } else {
        note.textContent = '已到账，可在钱包查看 · 7 天有效';
      }
      ctrl.result = result;
    }

    function toResult(delay) {
      later(function () {
        dialog.classList.remove('wp-phase-gather');
        dialog.classList.add('wp-phase-result');
        var titleEl = root.querySelector('.wp-title');
        var descEl = root.querySelector('.wp-desc');
        if (!dialog.classList.contains('wp-no-reward')) {
          titleEl.textContent = '补给已就位';
          descEl.textContent = ctx.nba.postTitle || '';
        }
        /* 焦点入主按钮 */
        var btnEl = root.querySelector('.wp-btn');
        if (btnEl) btnEl.focus({ preventScroll: true });
      }, delay == null ? 500 : delay);
    }

    emblem.addEventListener('click', reveal);
    emblem.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
    });

    /* 预算已熔断：本次是零成本纯引导，不让用户点开一个"空盒子"，徽印落定后自动揭晓 */
    if (ctx.budgetState === 'exhausted') {
      var hintEl = root.querySelector('.wp-emblem-hint');
      if (hintEl) hintEl.textContent = '查 收 商 机 提 醒';
      later(reveal, 780);
    }
    root.querySelector('.wp-btn').addEventListener('click', function () {
      try { ctx.onCta && ctx.onCta(ctrl.result || { kind: 'none' }); } catch (e) {}
    });
    var altLink = root.querySelector('.wp-alt');
    if (altLink) {
      altLink.addEventListener('click', function () {
        try { ctx.onDismiss && ctx.onDismiss('alt'); } catch (e) {}
      });
    }

    /* 阶段推进：omen 600ms 后 dialog 已随 CSS 入场；汇聚结束即可揭晓（hint 由 CSS 1.5s 出现） */
    if (omen) {
      later(function () { if (omen && omen.parentNode) omen.style.transition = 'opacity .3s'; if (omen) omen.style.opacity = '0'; }, 900);
      later(function () { if (omen && omen.parentNode) omen.parentNode.removeChild(omen); }, 1250);
    }

    return { close: function () { closeAll('api'); } };
  }

  w.WonderPopup = { show: show, close: function () { closeAll('api'); }, isOpen: function () { return !!current; } };
})(window, document);
