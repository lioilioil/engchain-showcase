/* ============================================================================
   Liquid Glass Dock — 仅供 home-liquidglass.html 测试页
   ----------------------------------------------------------------------------
   本文件不修改 js/common.js / css/app.css 的任何内容，全部改动发生在本页运行时：
     1. 等 common.js 注入完 .app-nav-shell 后，往 .app-tabbar 里补折射/高光分层
     2. 用 canvas 生成位移贴图 → 注入 SVG feDisplacementMap 滤镜 → 挂到折射层
     3. 叠加 WebGL 静态边缘高光（不含时间驱动噪声，见第 5 节说明）
     4. 读取 .tab-glass 的实际位移速度 → 写 --lg-sq/--lg-sqy 做液态挤压
   右侧 AI 球（.ai-orb-entry）不在此文件的任何选择器内，保持原样。
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 配置 */
  var CFG = {
    enableWarp: true,        // SVG 位移折射总开关
    /* Dock（大背景）的折射：alpha 降到 ×0.7 之后，玻璃变透了，
       边缘就得把折射补强，「这是一块玻璃」才立得住。
       scale = feDisplacementMap 的最大位移（±scale/2 px），
       barBand = 折射带从边缘往内的宽度。两者一起决定水滴边缘的观感：
       只加 scale 会变成一圈硬边，只加 band 会摊薄到看不出来。 */
    barScale: 9,             // Dock 折射强度（原 6；贴图边界内缩 scale/2，故条上取小值）
    barBand: 13,             // Dock 边缘折射带宽度（原与 lens 共用 8）
    lensScale: 14,           // 透镜折射强度（背景是玻璃自身，不存在正文拉扯）
    chroma: 2.5,             // 色散：三通道 scale 差值
    band: 8,                 // 通用边缘折射带宽度（px，从玻璃边缘往内）—— 仅透镜用
    glMaxDpr: 2,             // WebGL 画布最大像素比
    squashAmp: 0.10,         // 液态挤压最大幅度
    squashRef: 1500          // 挤压参考速度（px/s）
  };

  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';

  /* ------------------------------------------------------------ 能力检测 */
  function supportsBackdrop() {
    try {
      var s = window.CSS && CSS.supports;
      if (!s) return false;
      return s('backdrop-filter', 'blur(2px)') || s('-webkit-backdrop-filter', 'blur(2px)');
    } catch (e) { return false; }
  }
  // Firefox 会解析 filter:url() 但渲染成透明洞（配合 backdrop-filter 时），直接跳过折射层
  var IS_FIREFOX = /Firefox/i.test(navigator.userAgent);
  var WARP_OK = CFG.enableWarp && supportsBackdrop() && !IS_FIREFOX;

  /* -------------------------------------------------------- 位移贴图生成 */
  /* 生成规则：地图覆盖「外扩后的采样区」，圆角矩形画在采样区正中（= 可见玻璃的位置）。
     矩形内部从边缘往里 band 像素内产生位移，方向沿 SDF 外法线，中心保持中性不位移。

     pad 的作用（关键）：位移在贴图边界处取最大值 scale/2，若贴图边界 = 可见边界，
     像素会被推出玻璃之外，形成一圈灰白残影（backdrop 的边缘像素被外扩）。
     把贴图矩形向内缩 scale/2，最大外推恰好落在可见边界上，残影结构性消失；
     同时可见形状最外圈 scale/2 宽度保持中性，正好对应真实玻璃「表面不折射」的那层。 */
  function makeDisplacementMap(regW, regH, visW, visH, radius, band, pad) {
    var res = Math.min(1, 220 / Math.max(regW, regH));
    var mw = Math.max(16, Math.round(regW * res));
    var mh = Math.max(12, Math.round(regH * res));
    var padPx = Math.max(0, (pad || 0) * res);
    var hw = Math.max(1, visW * res * 0.5 - padPx);
    var hh = Math.max(1, visH * res * 0.5 - padPx);
    var r = Math.max(1, Math.min(radius * res - padPx, Math.min(hw, hh)));
    var cx = mw * 0.5, cy = mh * 0.5;
    var bandPx = Math.max(1.5, band * res);

    function sd(px, py) {
      var qx = Math.abs(px - cx) - hw + r;
      var qy = Math.abs(py - cy) - hh + r;
      var mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0;
      return Math.min(Math.max(qx, qy), 0) + Math.sqrt(mx * mx + my * my) - r;
    }

    var cv = document.createElement('canvas');
    cv.width = mw; cv.height = mh;
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    var img = ctx.createImageData(mw, mh);
    var d = img.data;
    var e = 0.75;

    for (var y = 0; y < mh; y++) {
      for (var x = 0; x < mw; x++) {
        var px = x + 0.5, py = y + 0.5;
        var s = sd(px, py);
        var mag = 0;
        if (s < 0) {
          var t = 1 + s / bandPx;               // 表面 s=0 → 1；深过 band → 0
          if (t > 0) mag = t * t * (3 - 2 * t); // smoothstep
        }
        var nx = 0, ny = 0;
        if (mag > 0.0005) {
          var gx = sd(px + e, py) - sd(px - e, py);
          var gy = sd(px, py + e) - sd(px, py - e);
          var L = Math.sqrt(gx * gx + gy * gy) || 1;
          nx = gx / L; ny = gy / L;
        }
        var i = (y * mw + x) * 4;
        d[i] = 128 + nx * mag * 127;      // R → X 位移
        d[i + 1] = 128;                   // G 未使用
        d[i + 2] = 128 + ny * mag * 127;  // B → Y 位移
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    try { return cv.toDataURL('image/png'); } catch (err) { return null; }
  }

  /* ------------------------------------------------------------ SVG 滤镜 */
  function ensureSvgRoot() {
    var root = document.getElementById('lg-svg-defs');
    if (root) return root;
    root = document.createElementNS(SVGNS, 'svg');
    root.setAttribute('id', 'lg-svg-defs');
    root.setAttribute('width', '0');
    root.setAttribute('height', '0');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.appendChild(root);
    return root;
  }

  /* 三通道色散滤镜链：
     feImage(位移贴图) → 三次 feDisplacementMap（scale 略有差值）→ 按 R/G/B 拆分 → screen 叠加。
     scale 为正 = 沿外法线采样 = 从玻璃外侧取像素，这是真实玻璃边缘的成像方式。 */
  function installFilter(id, mapURL, scale, chroma) {
    var root = ensureSvgRoot();
    var f = document.getElementById(id);
    if (!f) {
      f = document.createElementNS(SVGNS, 'filter');
      f.setAttribute('id', id);
      f.setAttribute('filterUnits', 'objectBoundingBox');
      f.setAttribute('x', '-6%');
      f.setAttribute('y', '-12%');
      f.setAttribute('width', '112%');
      f.setAttribute('height', '124%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      root.appendChild(f);
    }
    while (f.firstChild) f.removeChild(f.firstChild);

    function add(tag, attrs) {
      var el = document.createElementNS(SVGNS, tag);
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'xlink:href') el.setAttributeNS(XLINK, 'xlink:href', attrs[k]);
        else el.setAttribute(k, attrs[k]);
      }
      f.appendChild(el);
      return el;
    }

    add('feImage', {
      result: 'MAP', href: mapURL, 'xlink:href': mapURL,
      x: '0', y: '0', width: '100%', height: '100%',
      preserveAspectRatio: 'none'
    });

    var scales = [scale - chroma, scale, scale + chroma];
    var mats = [
      '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',   // 保留 R
      '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',   // 保留 G
      '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'    // 保留 B
    ];
    for (var i = 0; i < 3; i++) {
      add('feDisplacementMap', {
        'in': 'SourceGraphic', in2: 'MAP', scale: scales[i],
        xChannelSelector: 'R', yChannelSelector: 'B', result: 'D' + i
      });
      add('feColorMatrix', { 'in': 'D' + i, type: 'matrix', values: mats[i], result: 'C' + i });
    }
    add('feBlend', { 'in': 'C0', in2: 'C1', mode: 'screen', result: 'CRG' });
    add('feBlend', { 'in': 'CRG', in2: 'C2', mode: 'screen' });
  }

  /* ------------------------------------------------------------- WebGL 层 */
  var VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  /* 静态高光着色器。刻意不含 uTime —— 时间驱动的颗粒/流动会给玻璃表面
     带来持续可见的闪烁（实测跨帧标准差 0.315 → 0.086 全来自这两项），
     而且与 iOS 26 的观感相反：那里的玻璃是「静的」，动的是它下面的内容和它自己的位移。
     立体感只靠一道很窄的边缘高光立住，不做大面积渐变，否则会显得厚重。 */
  var FRAG = [
    'precision highp float;',
    'uniform vec2 uDpr, uBar, uPointer;',
    'uniform vec4 uLens;',
    'uniform float uRadius, uDark;',
    'float sdRR(vec2 p, vec2 b, float r){',
    '  vec2 q = abs(p) - b + r;',
    '  return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r;',
    '}',
    // 形参名不能取 half —— half/fixed 等是 GLSL ES 1.00 保留字，用作标识符会编译失败
    // w = 高光带宽度(px)：越窄越像真实玻璃的锐边，越宽越像塑料
    'float rimLight(vec2 p, vec2 c, vec2 hs, float r, float w, float gain){',
    '  vec2 q = p - c;',
    '  float d = sdRR(q, hs, r);',
    '  if (d > 0.0) return 0.0;',
    '  float depth = -d;',
    '  float e = 1.0;',
    '  vec2 g = vec2(sdRR(q+vec2(e,0.),hs,r)-sdRR(q-vec2(e,0.),hs,r),',
    '                sdRR(q+vec2(0.,e),hs,r)-sdRR(q-vec2(0.,e),hs,r));',
    '  vec2 n = normalize(g + vec2(1e-5));',
    '  vec3 N = normalize(vec3(n.x, -n.y, 0.55));',
    '  float fres = pow(1.0 - clamp(depth / w, 0.0, 1.0), 3.0);',   // 只在最外 w 像素内亮起
    '  vec2 lp = (uPointer.x < -9000.0) ? (c + vec2(-hs.x*0.5, -hs.y*1.15)) : uPointer;',
    '  vec2 ld = normalize(lp - p + vec2(1e-5));',
    '  vec3 L = normalize(vec3(ld * 0.7, 0.85));',
    '  vec3 H = normalize(L + vec3(0.0,0.0,1.0));',
    '  float sp = pow(max(dot(N,H), 0.0), 22.0);',                  // 宽而弱的镜面，不是光斑
    '  float topBias = mix(0.5, 1.0, clamp(-n.y * 0.5 + 0.5, 0.0, 1.0));',  // 上缘最亮
    '  return clamp(fres * topBias * gain + sp * 0.16, 0.0, 1.0);',
    '}',
    'void main(){',
    '  vec2 p = gl_FragCoord.xy / uDpr;',
    '  p.y = uBar.y - p.y;',                                   // gl 原点在左下 → 翻到左上
    '  float d = sdRR(p - uBar*0.5, uBar*0.5, uRadius);',
    '  if (d > 0.0){ gl_FragColor = vec4(0.0); return; }',
    '  float a = rimLight(p, uBar*0.5, uBar*0.5, uRadius, 3.0, 0.30);',
    '  vec2 lc = uLens.xy + uLens.zw*0.5;',
    '  vec2 lh = uLens.zw*0.5;',
    '  a += rimLight(p, lc, lh, min(lh.x,lh.y), 2.0, 0.26);',
    '  a = clamp(a, 0.0, 0.70) * mix(1.0, 0.55, uDark);',
    '  gl_FragColor = vec4(vec3(1.0), a);',
    '}'
  ].join('\n');

  function initGL(canvas) {
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false });
    } catch (e) { gl = null; }
    if (!gl) return null;

    // 编译失败必须可见：本层曾因一个保留字标识符而整层静默失效
    function sh(type, src, label) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.console && console.warn) {
          console.warn('[lg-dock] ' + label + '着色器编译失败：' + gl.getShaderInfoLog(s));
        }
        return null;
      }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT, '顶点'), fs = sh(gl.FRAGMENT_SHADER, FRAG, '片元');
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console && console.warn) {
        console.warn('[lg-dock] 着色器链接失败：' + gl.getProgramInfoLog(prog));
      }
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uDpr', 'uBar', 'uPointer', 'uLens', 'uRadius', 'uDark'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    var lost = false;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; });

    return {
      resize: function (w, h, dpr) {
        var pw = Math.max(1, Math.round(w * dpr));
        var ph = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw; canvas.height = ph;
        }
        gl.viewport(0, 0, pw, ph);
      },
      render: function (st) {
        if (lost) return;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(U.uDpr, st.dpr, st.dpr);
        gl.uniform2f(U.uBar, st.w, st.h);
        gl.uniform4f(U.uLens, st.lens.x, st.lens.y, st.lens.w, st.lens.h);
        gl.uniform2f(U.uPointer, st.pointer.x, st.pointer.y);
        gl.uniform1f(U.uRadius, st.radius);
        gl.uniform1f(U.uDark, st.dark ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  /* ---------------------------------------------------------------- 工具 */
  function px(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }
  function cssVar(el, name, fallback) {
    try { return px(getComputedStyle(el).getPropertyValue(name), fallback); }
    catch (e) { return fallback; }
  }

  /* ------------------------------------------------------------ 主流程 */
  function build() {
    var tabbar = document.querySelector('.app-tabbar');
    var shell = document.querySelector('.app-nav-shell');
    if (!tabbar || !shell) return false;
    if (tabbar.dataset.lgDone === '1') return true;
    tabbar.dataset.lgDone = '1';

    var glass = tabbar.querySelector('.tab-glass');

    /* --- 1. 分层注入 --- */
    var base = document.createElement('div'); base.className = 'lg-layer lg-base';
    var warp = document.createElement('div'); warp.className = 'lg-layer lg-warp';
    var spec = document.createElement('div'); spec.className = 'lg-layer lg-spec';
    var glcv = document.createElement('canvas'); glcv.className = 'lg-gl';
    glcv.setAttribute('aria-hidden', 'true');

    tabbar.insertBefore(base, tabbar.firstChild);
    tabbar.insertBefore(warp, base.nextSibling);
    tabbar.insertBefore(spec, warp.nextSibling);
    tabbar.appendChild(glcv);

    var lensWarp = null;
    if (glass) {
      var lens = document.createElement('div'); lens.className = 'tg-lens';
      lensWarp = document.createElement('div'); lensWarp.className = 'tg-warp';
      var lensSpec = document.createElement('div'); lensSpec.className = 'tg-spec';
      lens.appendChild(lensWarp); lens.appendChild(lensSpec);
      glass.appendChild(lens);
    }

    /* --- 2. 折射滤镜（能力检测通过才挂） --- */
    /* 尺寸一律取 offsetWidth/offsetHeight（布局值），不用 getBoundingClientRect()。
       因为按下态给 .app-tabbar 加了 transform:scale()，而 getBoundingClientRect()
       返回的是**变换后**的视觉尺寸：位移贴图会被按 1.02 倍生成，且 ResizeObserver
       的尺寸键在每次按下/松手都会变 → 重建两张贴图（含 canvas.toDataURL）。
       布局值与 transform 无关，这类问题从根上不存在。 */
    function refreshFilters() {
      if (!WARP_OK) return;
      try {
        var bw = tabbar.offsetWidth, bh = tabbar.offsetHeight;
        if (bw < 2 || bh < 2) return;
        var bleed = cssVar(tabbar, '--lg-bleed', 16);
        var rBar = cssVar(tabbar, '--lg-r', 30);
        var url = makeDisplacementMap(bw + 2 * bleed, bh + 2 * bleed,
                                      bw, bh, rBar, CFG.barBand, CFG.barScale * 0.5);
        if (url) {
          installFilter('lg-disp-bar', url, CFG.barScale, CFG.chroma);
          warp.style.filter = 'url(#lg-disp-bar)';
          warp.style.webkitFilter = 'url(#lg-disp-bar)';
        }
        if (glass && lensWarp) {
          var gw = glass.offsetWidth, gh = glass.offsetHeight;
          if (gw > 2 && gh > 2) {
            var lbleed = cssVar(tabbar, '--lg-lens-bleed', 14);
            var lr = cssVar(tabbar, '--lg-lens-r', 27);
            var lurl = makeDisplacementMap(gw + 2 * lbleed, gh + 2 * lbleed,
                                           gw, gh, lr, CFG.band * 0.8,
                                           CFG.lensScale * 0.5);
            if (lurl) {
              installFilter('lg-disp-lens', lurl, CFG.lensScale, CFG.chroma);
              lensWarp.style.filter = 'url(#lg-disp-lens)';
              lensWarp.style.webkitFilter = 'url(#lg-disp-lens)';
            }
          }
        }
      } catch (e) { /* 折射是增强，失败不影响页面 */ }
    }
    refreshFilters();

    /* --- 3. WebGL 高光层 --- */
    var glc = initGL(glcv);
    if (glc) glcv.classList.add('lg-ready');

    /* --- 4. 指针状态 --- */
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    var pointer = { x: -9999, y: -9999 };
    function aim(x, y) { pointer.x = x; pointer.y = y; glDirty = true; wake(); }
    tabbar.addEventListener('mousemove', function (e) {
      var r = tabbar.getBoundingClientRect();
      aim(e.clientX - r.left, e.clientY - r.top);
    });
    tabbar.addEventListener('mouseleave', function () { aim(-9999, -9999); });

    /* --- 5. 事件驱动的渲染循环 -------------------------------------------
       曾经这里是一个永不停止的 30fps rAF：即使画面完全静止也每帧重绘。
       那是底部闪烁的第二大来源（WebGL 层的 uTime 噪声是第一大）。
       现在只在「有事发生」时醒来，画完就自己停下：
         · 拖拽 / 吸附 —— 透镜在动，挤压形变和高光都要跟
         · 指针移动 —— 镜面高光跟随
         · 尺寸 / 主题变化 —— 几何和明暗变了
    ------------------------------------------------------------------- */
    var rafId = 0, glDirty = true, squashUntil = 0, lastLeft = null, lastT = 0, vel = 0;

    function wake() { if (!rafId) rafId = requestAnimationFrame(frame); }
    function wakeSquash(ms) {
      var until = performance.now() + ms;
      if (until > squashUntil) squashUntil = until;
      wake();
    }

    function frame(t) {
      rafId = 0;
      var br = tabbar.getBoundingClientRect();
      if (br.width < 2 || br.height < 2) return;

      /* 5a. 液态挤压：读 .tab-glass 实际左边缘速度 → 横向拉伸 + 纵向补偿 */
      if (glass && t < squashUntil) {
        var gl_ = glass.getBoundingClientRect();
        if (lastLeft !== null && t > lastT) {
          var dt = Math.max(8, t - lastT);
          vel = vel * 0.72 + ((gl_.left - lastLeft) / dt * 1000) * 0.28;
        }
        lastLeft = gl_.left; lastT = t;
        if (Math.abs(vel) > 3) squashUntil = Math.max(squashUntil, t + 200);  // 还在动 → 继续采样

        var m = Math.max(-1, Math.min(1, vel / CFG.squashRef));
        var amp = reduced ? 0 : CFG.squashAmp;
        glass.style.setProperty('--lg-sq', (1 + Math.abs(m) * amp).toFixed(4));
        glass.style.setProperty('--lg-sqy', (1 - Math.abs(m) * amp * 0.5).toFixed(4));
        glass.style.setProperty('--lg-so', vel >= 0 ? '0%' : '100%');
        glDirty = true;                                   // 透镜几何变了，高光要跟
      } else if (lastLeft !== null) {
        lastLeft = null; vel = 0;
        if (glass) {
          glass.style.setProperty('--lg-sq', '1');
          glass.style.setProperty('--lg-sqy', '1');
        }
        glDirty = true;                                   // 收尾帧：用最终几何重绘一次
      }

      /* 5b. WebGL 高光：只在脏的时候画一次 */
      if (glc && glDirty && !reduced && !document.hidden) {
        glDirty = false;
        var dpr = Math.min(CFG.glMaxDpr, window.devicePixelRatio || 1);
        glc.resize(br.width, br.height, dpr);
        var lensRect = { x: 0, y: 0, w: 0, h: 0 };
        if (glass) {
          var g2 = glass.getBoundingClientRect();
          lensRect = { x: g2.left - br.left, y: g2.top - br.top, w: g2.width, h: g2.height };
        }
        glc.render({
          dpr: dpr, w: br.width, h: br.height,
          lens: lensRect, pointer: pointer,
          radius: cssVar(tabbar, '--lg-r', 30),
          dark: document.documentElement.getAttribute('data-theme') === 'dark'
        });
      }

      if (t < squashUntil || glDirty) wake();
    }

    /* 透镜位移（拖拽跟手 + moveTo 的 transition）→ 唤醒挤压采样。
       这里刻意「不」监听 .tab-glass 的 style 属性：本函数每帧都会写
       --lg-sq/--lg-sqy，观察 style 会把自己的写入当成外部事件，
       于是窗口被无限续期、循环永远停不下来（实测 60fps 空转）。
       改监听真正代表「透镜要动了」的外部信号：class 变化、按下、点击、抬起。 */
    if (glass) {
      new MutationObserver(function () { wakeSquash(700); })
        .observe(glass, { attributes: true, attributeFilter: ['class'] });
    }
    function onDown() { wakeSquash(1200); }
    function onRelease() { wakeSquash(700); }          // 松手后的吸附 / 回弹过渡
    tabbar.addEventListener('mousedown', onDown);
    tabbar.addEventListener('touchstart', onDown, { passive: true });
    tabbar.addEventListener('pointerdown', onDown, { passive: true });
    tabbar.addEventListener('click', function () { wakeSquash(700); });
    document.addEventListener('mouseup', onRelease, true);
    document.addEventListener('touchend', onRelease, true);
    document.addEventListener('pointerup', onRelease, true);

    /* 主题切换 → 高光明暗变了 */
    try {
      new MutationObserver(function () { glDirty = true; wake(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}

    wake();

    /* --- 6. 尺寸变化时重建位移贴图 --- */
    if (window.ResizeObserver) {
      var lastKey = '';
      var ro = new ResizeObserver(function () {
        // 同样用布局值：ResizeObserver 报的本来就是布局盒，这里若拿
        // getBoundingClientRect()（变换后的视觉尺寸）去比，等于自己造抖动。
        var key = tabbar.offsetWidth + 'x' + tabbar.offsetHeight
                + '|' + (glass ? glass.offsetWidth : 0);
        if (key === lastKey) return;
        lastKey = key;
        refreshFilters();
        glDirty = true; wake();
      });
      ro.observe(tabbar);
      if (glass) ro.observe(glass);
    }
    function onResize() { refreshFilters(); glDirty = true; wake(); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    /* --- 7. 主题切换时无需重建滤镜（配色走 CSS），由上面的 data-theme 观察者唤醒重绘 --- */
    return true;
  }

  /* ------------------------------------------------------------ 启动 */
  function boot() {
    if (build()) return;
    // common.js 在 DOMContentLoaded 里注入 tabbar；若本次未就绪，用 MutationObserver 兜底
    var mo = new MutationObserver(function () {
      if (build()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
})();
