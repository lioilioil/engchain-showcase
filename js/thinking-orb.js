/**
 * thinking-orb.js — 纯 JS 移植 thinking-orbs (MIT, Jakub Antalik)
 * 仅移植 solving/rubik 模式：3D 球面点阵按魔方层旋转，打乱→复原→静置→重复
 * 适配 ENGCHAIN 金色主题，零依赖，支持 DPR/离屏暂停/reduced-motion
 *
 * 用法：
 *   var orb = new ThinkingOrb({ size: 44, dark: false });
 *   container.appendChild(orb.canvas);
 *   orb.destroy(); // 清理
 */
(function (global) {
  'use strict';

  /* ========== 核心工具 (port from engine/core.ts) ========== */

  /** 确定性哈希 [0,1) */
  function hashD(a, b) {
    var h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return h - Math.floor(h);
  }

  /** 最短有符号角距，包裹到 (-π, π] */
  function angleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  /** 共享旋转 + 倾斜 + 正交投影 */
  function makeProj(yaw, tilt, cx, cy, scale) {
    var st = Math.sin(tilt), ct = Math.cos(tilt);
    var sy = Math.sin(yaw), cyw = Math.cos(yaw);
    return function (x, y, z) {
      var x1 = x * cyw + z * sy;
      var z1 = -x * sy + z * cyw;
      var y1 = y * ct - z1 * st;
      var z2 = y * st + z1 * ct;
      return [cx + x1 * scale, cy - y1 * scale, z2];
    };
  }

  /**
   * 绘制：z 排序远→近，金色点阵。
   * 亮色背景：近点深金、远点浅金；暗色背景：近点亮金、远点暗金。
   */
  function paint(ctx, dots, dark, rMin) {
    rMin = rMin || 0.3;
    dots.sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var alpha = d.a != null ? d.a : 1;
      if (alpha < 0.02) continue;
      // v = 0(远/融入背景), 1(近/突出)
      var v = dark ? (1 - d.white) : d.white;
      v = Math.min(1, Math.max(0, v));
      var r, g, b;
      if (dark) {
        // v=0 → #4A3818(深金), v=1 → #FFD980(亮饱和金)
        r = Math.round(74 + v * 181);
        g = Math.round(56 + v * 161);
        b = Math.round(24 + v * 104);
      } else {
        // v=0 → #DCC896(亮金), v=1 → #5C4210(深饱和金棕)
        r = Math.round(220 - v * 128);
        g = Math.round(200 - v * 134);
        b = Math.round(150 - v * 134);
      }
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(rMin, d.r), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 点阵半径针对 300pt 基准调优，亚线性缩放保持小尺寸可读性 */
  function radiusScale(size, pow) {
    return Math.pow(size / 300, pow);
  }

  /* ========== rubik/solving 模式 (port from engine/lattice.ts) ========== */

  /** 旋转动作 */
  function makeMoves(count) {
    var moves = [];
    for (var i = 0; i < count; i++) {
      var axis = Math.min(2, Math.floor(hashD(i, 2.3) * 3));
      var lo = -1.0 + 0.5 * Math.min(3, Math.floor(hashD(i, 5.9) * 4));
      var dir = hashD(i, 7.7) < 0.5 ? 1 : -1;
      moves.push({ axis: axis, lo: lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
    }
    return moves;
  }

  /**
   * 打乱→复原心跳：快速缓动旋转打乱，然后反向回退（回文），
   * 所有层咔哒复原后静置，重复。
   */
  function solveCycle(time, count, slotDur, rest) {
    var cyc = 2 * count * slotDur + rest;
    var tc = time % cyc;
    var amount = new Array(count);
    for (var i = 0; i < count; i++) amount[i] = 0;
    var active = -1;
    if (tc < 2 * count * slotDur) {
      var slot = Math.floor(tc / slotDur);
      var p = (tc - slot * slotDur) / slotDur;
      var cl = Math.min(1, p / 0.7);
      var ep = 1 - Math.pow(1 - cl, 3); // machine ease-out
      if (slot < count) {
        for (var j = 0; j < slot; j++) amount[j] = 1;
        amount[slot] = ep;
        active = slot;
      } else {
        var u = 2 * count - 1 - slot;
        for (var k = 0; k < u; k++) amount[k] = 1;
        amount[u] = 1 - ep;
        active = u;
      }
    }
    return { amount: amount, active: active };
  }

  /** 对 3D 点应用旋转动作 */
  function applyMoves(pt3, moves, sc) {
    var x = pt3[0], y = pt3[1], z = pt3[2];
    var inActive = false;
    for (var i = 0; i < moves.length; i++) {
      if (sc.amount[i] <= 0) continue;
      var mv = moves[i];
      var coord = mv.axis === 0 ? x : mv.axis === 1 ? y : z;
      if (coord < mv.lo || coord >= mv.hi) continue;
      if (i === sc.active) inActive = true;
      var a = mv.ang * sc.amount[i];
      var ca = Math.cos(a), sa = Math.sin(a);
      if (mv.axis === 0) {
        var y2 = y * ca - z * sa;
        z = y * sa + z * ca;
        y = y2;
      } else if (mv.axis === 1) {
        var x2 = x * ca + z * sa;
        z = -x * sa + z * ca;
        x = x2;
      } else {
        var x3 = x * ca - y * sa;
        y = x * sa + y * ca;
        x = x3;
      }
    }
    return [x, y, z, inActive];
  }

  /** rubik 主绘制：球面点阵按层旋转打乱→复原 */
  function drawRubik(ctx, size, t, dark, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.82;
    var pt = makeProj(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), cx, cy, R);
    var rs = radiusScale(size, o.rsPow != null ? o.rsPow : 0.6);
    var moveCount = o.moveCount != null ? o.moveCount : 14;
    var moves = makeMoves(moveCount);
    var sc = solveCycle(t, moveCount, 0.42, 1.2);
    var dots = [];
    var latRings = o.latRings != null ? o.latRings : 15;
    var lonDensity = o.lonDensity != null ? o.lonDensity : 40;
    for (var li = 0; li <= latRings; li++) {
      var lat = -Math.PI / 2 + (li / latRings) * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      var lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (var lj = 0; lj < lonCount; lj++) {
        var lon = (lj / lonCount) * 2 * Math.PI;
        var res = applyMoves([cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon)], moves, sc);
        var proj = pt(res[0], res[1], res[2]);
        var depth = (proj[2] + 1) / 2;
        var inActive = res[3];
        dots.push({
          x: proj[0], y: proj[1], z: proj[2],
          r: ((o.rBase != null ? o.rBase : 0.6) + (o.rDepth != null ? o.rDepth : 1.7) * depth + (inActive ? (o.rActive != null ? o.rActive : 0.3) : 0)) * rs,
          white: (o.inkFar != null ? o.inkFar : 0.62) - (o.inkSpan != null ? o.inkSpan : 0.54) * depth - (inActive ? 0.14 : 0)
        });
      }
    }
    paint(ctx, dots, dark, o.rMin);
  }

  /* ========== 预设解析 (port from presets.ts + profiles.ts) ========== */

  /** rubik 基础配置 (BASE_PROFILES.rubik) */
  var RUBIK_BASE = {
    latRings: 15, lonDensity: 40, moveCount: 14,
    rBase: 0.6, rDepth: 1.7, rActive: 0.3,
    inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3
  };

  /** solving 64px 预设：speed=1.82, count=0.35, size=1.5（点半径放大） */
  var SOLVING_PRESET = { speed: 1.82, count: 0.35, size: 1.5 };

  /** 应用 count 乘数（纬圈×经度密度成对 √scale） */
  function applyCount(opts, scale) {
    var out = {};
    for (var k in opts) out[k] = opts[k];
    var rt = Math.sqrt(scale);
    if (out.latRings != null) out.latRings = Math.max(2, Math.round(out.latRings * rt));
    if (out.lonDensity != null) out.lonDensity = Math.max(2, Math.round(out.lonDensity * rt));
    return out;
  }

  /** 应用 radius 乘数 */
  function applySize(opts, scale) {
    var out = {};
    for (var k in opts) out[k] = opts[k];
    var radiusKeys = ['rBase', 'rDepth', 'rActive', 'rDot', 'ghostR', 'partR', 'partRDepth'];
    for (var i = 0; i < radiusKeys.length; i++) {
      var key = radiusKeys[i];
      if (out[key] != null) out[key] = out[key] * scale;
    }
    return out;
  }

  /** 解析 solving 预设 → 最终绘制参数 */
  function resolveSolving() {
    var opts = applyCount(RUBIK_BASE, SOLVING_PRESET.count);
    opts = applySize(opts, SOLVING_PRESET.size);
    return { speed: SOLVING_PRESET.speed, opts: opts };
  }

  /* ========== ThinkingOrb 类 (port from ThinkingOrb.tsx lifecycle) ========== */

  function ThinkingOrb(options) {
    options = options || {};
    this.size = options.size || 44;
    this.dark = !!options.dark;
    this.speed = options.speed || 1;
    this.paused = !!options.paused;
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var canvas = document.createElement('canvas');
    canvas.className = 'ai-orb-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Solving…');
    canvas.style.width = this.size + 'px';
    canvas.style.height = this.size + 'px';
    canvas.style.display = 'block';
    this.canvas = canvas;

    this._dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
    canvas.width = Math.round(this.size * this._dpr);
    canvas.height = Math.round(this.size * this._dpr);

    this._ctx = canvas.getContext('2d');
    var resolved = resolveSolving();
    this._effSpeed = resolved.speed * this.speed;
    this._opts = resolved.opts;

    this._raf = 0;
    this._running = false;
    this._visible = true;
    this._io = null;
    this._onVis = null;

    this._frame = this._frame.bind(this);
    this._loop = this._loop.bind(this);

    // 至少绘制一帧（即使暂停/离屏）
    this._frame((performance.now() / 1000) * this._effSpeed);

    if (this.reducedMotion) {
      // reduced-motion：静态帧
      this._frame(0.6 * this._effSpeed);
      return;
    }

    this._start();

    // 离屏自动暂停
    var self = this;
    if (typeof IntersectionObserver !== 'undefined') {
      this._io = new IntersectionObserver(function (entries) {
        var entry = entries[0];
        self._visible = entry.isIntersecting;
        if (self._visible && document.visibilityState !== 'hidden') self._start();
        else self._stop();
      });
      this._io.observe(canvas);
    }

    // 标签页隐藏自动暂停
    this._onVis = function () {
      if (document.visibilityState === 'hidden') self._stop();
      else if (self._visible) self._start();
    };
    document.addEventListener('visibilitychange', this._onVis);
  }

  ThinkingOrb.prototype._frame = function (tSec) {
    var ctx = this._ctx;
    if (!ctx) return;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, this.size, this.size);
    drawRubik(ctx, this.size, tSec, this.dark, this._opts);
  };

  ThinkingOrb.prototype._loop = function () {
    this._frame((performance.now() / 1000) * this._effSpeed);
    if (this._running) this._raf = requestAnimationFrame(this._loop);
  };

  ThinkingOrb.prototype._start = function () {
    if (this._running || this.paused || this.reducedMotion) return;
    this._running = true;
    this._raf = requestAnimationFrame(this._loop);
  };

  ThinkingOrb.prototype._stop = function () {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  };

  /** 切换暗色模式（运行时调用） */
  ThinkingOrb.prototype.setDark = function (dark) {
    this.dark = !!dark;
    this._frame((performance.now() / 1000) * this._effSpeed);
  };

  /** 销毁：停止动画、移除监听 */
  ThinkingOrb.prototype.destroy = function () {
    this._stop();
    if (this._io) { this._io.disconnect(); this._io = null; }
    if (this._onVis) { document.removeEventListener('visibilitychange', this._onVis); this._onVis = null; }
    this._ctx = null;
  };

  /* ========== 全局初始化：扫描 .ai-orb-canvas 占位并初始化 ========== */

  /**
   * 初始化页面中所有 data-thinking-orb 占位元素。
   * 用法：在 tabbar HTML 插入后调用 ThinkingOrb.initAll()
   */
  ThinkingOrb.initAll = function () {
    var placeholders = document.querySelectorAll('[data-thinking-orb]');
    for (var i = 0; i < placeholders.length; i++) {
      var el = placeholders[i];
      if (el.dataset.orbInited) continue;
      var size = parseInt(el.dataset.orbSize, 10) || 44;
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var orb = new ThinkingOrb({ size: size, dark: dark });
      el.parentNode.replaceChild(orb.canvas, el);
      el.dataset.orbInited = '1';
      // 存储引用以便主题切换时更新
      orb.canvas._thinkingOrb = orb;
    }
    // 监听主题切换（仅设置一次）
    if (!ThinkingOrb._themeObs && typeof MutationObserver !== 'undefined') {
      ThinkingOrb._themeObs = new MutationObserver(function (mutations) {
        for (var j = 0; j < mutations.length; j++) {
          if (mutations[j].attributeName === 'data-theme') {
            var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            ThinkingOrb.updateTheme(isDark);
            break;
          }
        }
      });
      ThinkingOrb._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  };

  /** 主题切换时更新所有 orb 的暗色模式 */
  ThinkingOrb.updateTheme = function (dark) {
    var canvases = document.querySelectorAll('.ai-orb-canvas');
    for (var i = 0; i < canvases.length; i++) {
      if (canvases[i]._thinkingOrb) canvases[i]._thinkingOrb.setDark(dark);
    }
  };

  global.ThinkingOrb = ThinkingOrb;

})(typeof window !== 'undefined' ? window : this);
