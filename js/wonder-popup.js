/* ============================================================================
   工程链 ENGCHAIN — 惊喜时刻弹窗 WonderPopup（渲染 + 动效编排）v3.0
   ----------------------------------------------------------------------------
   2026-10-03 无容器异形重做：透明底游戏化能量空投箱三态 PNG（闭合/开启/锦鲤）
   漂浮在毛玻璃遮罩上，无任何矩形卡片；文案描边分层、胶囊控件、代码粒子。
   配合 js/wonder-engine.js 使用，本身不做任何业务决策；对外 API 与 v1/v2 完全兼容。
   WonderPopup.show({
     decisionId, persona, guest, budgetState,
     unlockPrice?, balance?, topLabel?,
     nba:{ctaText,ctaHref,altText,altHref,postTitle},
     onReveal() -> {kind:'credits'|'pending'|'none', amount, tier, tierLabel, expireAt},
     onCta(result), onDismiss(phase)
   })
   时间轴：omen(.6s) → gather(闭合箱+轻触开启) → 轻触开箱 burst+粒子+countup(≤1.6s) → result
   ============================================================================ */
(function (w, d) {
  'use strict';

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  /* 四角星：补给能量的轻量符号 */
  var SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.4 4.9 2.6 7.1 7.5 7.5-4.9.4-7.1 2.6-7.5 7.5-.4-4.9-2.6-7.1-7.5-7.5C9.4 9.1 11.6 6.9 12 2z"/></svg>';

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

  /* 开箱粒子：金币 + 四角星屑，自箱口向上扇形喷射 */
  function particleSpans(lucky) {
    var n = lucky ? 26 : 15;
    var html = '';
    for (var i = 0; i < n; i++) {
      var isCoin = (i % 5 === 0) || (lucky && i % 3 === 0);
      /* 角度集中在上半扇形（约 -150° ~ -30°），即向上并向两侧散开 */
      var ang = -Math.PI / 2 + ((i * 37 % 100) / 100 - 0.5) * (lucky ? 2.5 : 1.9);
      var dist = (lucky ? 120 : 88) + (i % 5) * 26 + (isCoin ? 10 : 0);
      var tx = Math.round(Math.cos(ang) * dist);
      var ty = Math.round(Math.sin(ang) * dist);           /* 负值=向上 */
      var size = isCoin ? (9 + (i % 3) * 3) : (6 + (i % 3) * 3);
      var dur = 820 + (i % 5) * 95;
      var delay = (i % 4) * 45;
      var rot = (i * 53) % 360;
      var cls = isCoin ? 'wp-coin' : 'wp-spark';
      html += '<span class="' + cls + '" style="--tx:' + tx + 'px;--ty:' + ty + 'px;--rot:' + rot + 'deg;--s:' + size + 'px;--dur:' + dur + 'ms;--delay:' + delay + 'ms"></span>';
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

  /* 真实价值锚定：用引擎传入的“解锁一条线索所需积分”，不编造数字 */
  function renderAnchor(root, ctx, result) {
    var box = root.querySelector('.wp-anchor');
    if (!box || !result || (result.kind !== 'credits' && result.kind !== 'pending')) return;
    var goal = ctx.unlockPrice || 98;
    var base = result.kind === 'credits' ? (ctx.balance || 0) : 0;
    var total = base + (result.amount || 0);
    var pct = Math.max(4, Math.min(100, Math.round(total / goal * 100)));
    var cat = ctx.topLabel || '';
    var leadTxt;
    if (total >= goal) {
      leadTxt = '本次补给已可解锁 <b>1 条</b>' + (cat ? cat : '商机') + '线索';
    } else {
      var n = goal - total;
      var what = cat ? '一条' + cat + '线索' : '一条商机线索';
      leadTxt = (result.kind === 'pending' ? '注册到账后，' : '') + '再攒 <b>' + n + '</b> 积分，即可解锁' + what;
    }
    root.querySelector('.wp-anchor-txt').innerHTML = leadTxt;
    root.querySelector('.wp-anchor-goal').textContent = '解锁一条线索需 ' + goal + ' 积分';
    var fill = root.querySelector('.wp-anchor-fill');
    fill.style.width = '0%';
    setTimeout(function () { fill.style.width = pct + '%'; }, reduced() ? 0 : 480);
  }

  function show(ctx) {
    if (current) return null;
    var rm = reduced();
    var root = mountRoot();
    var ctrl = { root: root, ctx: ctx, timers: [], onDismiss: ctx.onDismiss, revealed: false };
    current = ctrl;
    function later(fn, ms) { var id = setTimeout(fn, rm ? Math.min(ms, 30) : ms); ctrl.timers.push(id); return id; }

    root.innerHTML =
      '<div class="wp-scrim"></div>' +
      (rm ? '' :
        '<div class="wp-omen"><span class="wp-omen-dot"></span><span class="wp-omen-text">等等，有份补给正在靠近…</span>' +
        '<span class="wp-omen-x" role="button" aria-label="放弃本次补给">' + CLOSE + '</span></div>') +
      '<div class="wp-stage wp-phase-gather" role="dialog" aria-modal="true" aria-label="浏览补给">' +
        '<button class="wp-close" type="button" aria-label="关闭">' + CLOSE + '</button>' +
        '<span class="wp-badge">ENGCHAIN · 浏览补给</span>' +
        '<div class="wp-hero">' +
          '<span class="wp-rays" aria-hidden="true"></span>' +
          '<span class="wp-himg is-sealed" role="img" aria-label="待开启的补给箱"></span>' +
          '<span class="wp-himg is-open" role="img" aria-label="开启的补给箱"></span>' +
          '<span class="wp-himg is-lucky" role="img" aria-label="锦鲤大奖补给箱"></span>' +
          '<span class="wp-burst" aria-hidden="true"></span>' +
          '<span class="wp-flash" aria-hidden="true"></span>' +
          '<div class="wp-particles" aria-hidden="true"></div>' +
        '</div>' +
        '<button class="wp-tap" type="button" aria-label="轻触开启补给">' +
          '<span class="wp-tap-ring"><span class="wp-tap-pill">' + SPARK + '轻触开启</span></span>' +
        '</button>' +
        '<div class="wp-copy">' +
          '<h3 class="wp-title">逛了这么久，这份补给给你</h3>' +
          '<p class="wp-desc">为你留意的商机配了一份补给，轻触开启查收。</p>' +
          '<div class="wp-amount"><span class="wp-amount-num">0</span><span class="wp-amount-unit">积分</span></div>' +
          '<div class="wp-tierline"></div>' +
          '<div class="wp-anchor"><div class="wp-anchor-track"><span class="wp-anchor-fill"></span></div>' +
            '<div class="wp-anchor-txt"></div><div class="wp-anchor-goal"></div></div>' +
          '<p class="wp-note"></p>' +
          '<div class="wp-actions">' +
            '<a class="wp-btn" href="' + esc(ctx.nba.ctaHref) + '">' + esc(ctx.nba.ctaText) + ARROW + '</a>' +
            (ctx.nba.altText ? '<a class="wp-alt" href="' + esc(ctx.nba.altHref || '#') + '">' + esc(ctx.nba.altText) + '</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>';

    var stage = root.querySelector('.wp-stage');
    var tap = root.querySelector('.wp-tap');
    var heroEl = root.querySelector('.wp-hero');
    var copyEl = root.querySelector('.wp-copy');
    var particles = root.querySelector('.wp-particles');
    var omen = root.querySelector('.wp-omen');
    var badgeEl = root.querySelector('.wp-badge');

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
    function escHandler(e) { if (e.key === 'Escape' && current === ctrl) closeAll(ctrl.revealed ? 'result' : 'gather'); }
    d.addEventListener('keydown', escHandler);
    ctrl.escHandler = escHandler;

    function reveal() {
      if (ctrl.revealed) return;
      ctrl.revealed = true;
      var result = { kind: 'none' };
      try { result = ctx.onReveal() || { kind: 'none' }; } catch (e) { result = { kind: 'error' }; }

      var note = root.querySelector('.wp-note');
      var numEl = root.querySelector('.wp-amount-num');
      var titleEl = root.querySelector('.wp-title');
      var descEl = root.querySelector('.wp-desc');
      var btn = root.querySelector('.wp-btn');
      var alt = root.querySelector('.wp-alt');

      /* 预算熔断 / 异常：零成本纯商机引导。引擎已下发与“无奖励”一致的 nba，
         标题—描述—CTA 三者统一，不再出现“没有奖励却让去领奖励”的矛盾。 */
      if (result.kind === 'none' || result.kind === 'error' || result.kind === 'exhausted') {
        stage.classList.add('wp-no-reward');
        particles.style.display = 'none';
        badgeEl.textContent = 'ENGCHAIN · 商机提醒';
        titleEl.textContent = '今日补给已发完';
        descEl.textContent = ctx.nba.postTitle || '为你留意了几条今日新上架的商机，先去看看有没有合适的';
        if (alt) alt.style.display = 'none';
        toResult(0);
        return;
      }

      var lucky = result.tier === 'lucky';
      if (lucky) {
        stage.classList.add('lucky');
        badgeEl.textContent = '今日锦鲤';
      }
      particles.innerHTML = particleSpans(lucky);
      stage.classList.add('wp-revealed');

      countUp(numEl, result.amount, 820, function () { toResult(140); });
      root.querySelector('.wp-tierline').textContent = result.tierLabel || '';
      note.textContent = result.kind === 'pending'
        ? '已为你预留 7 天，注册领取后到账'
        : '已到账 · 7 天内有效，可在钱包查看';

      renderAnchor(root, ctx, result);
      ctrl.result = result;
    }

    function toResult(delay) {
      later(function () {
        stage.classList.remove('wp-phase-gather');
        stage.classList.add('wp-phase-result');
        var titleEl = root.querySelector('.wp-title');
        var descEl = root.querySelector('.wp-desc');
        if (!stage.classList.contains('wp-no-reward')) {
          titleEl.textContent = '补给已就位';
          descEl.textContent = ctx.nba.postTitle || '';
        }
        var btnEl = root.querySelector('.wp-btn');
        if (btnEl) btnEl.focus({ preventScroll: true });
      }, delay == null ? 500 : delay);
    }

    /* 开启热区：轻触胶囊 + 整个箱子主视觉 + 下方文案均可点（gather 期）。
       reveal 幂等，结果态再点不会重复结算；CTA/次级链接的点击不被拦截，正常跳转。 */
    tap.addEventListener('click', reveal);
    heroEl.addEventListener('click', reveal);
    copyEl.addEventListener('click', reveal);

    /* 预算已熔断：零成本纯引导，不让用户点开“空盒子”，主视觉落定后自动揭晓 */
    if (ctx.budgetState === 'exhausted') {
      var pill = root.querySelector('.wp-tap-pill');
      if (pill) pill.innerHTML = SPARK + '查收新商机';
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

    /* omen 退场（.6s 后 stage 已随 CSS 入场） */
    if (omen) {
      later(function () { if (omen && omen.parentNode) omen.style.transition = 'opacity .3s'; if (omen) omen.style.opacity = '0'; }, 900);
      later(function () { if (omen && omen.parentNode) omen.parentNode.removeChild(omen); }, 1250);
    }

    return { close: function () { closeAll('api'); } };
  }

  w.WonderPopup = { show: show, close: function () { closeAll('api'); }, isOpen: function () { return !!current; } };
})(window, document);
