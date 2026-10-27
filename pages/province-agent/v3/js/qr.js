/* ============================================================
   qr.js · 真实 QR Code 编码器（字节模式 · 纠错等级 M · 版本 1–10）
   纯手写零依赖：GF(256) Reed-Solomon + BCH 格式/版本信息 +
   8 掩码全评分自动选优（标准 4 条罚分规则），输出 crispEdges SVG。
   渠道码 / 海报二维码为真实可扫描图案（内容指向 .example 保留域）。
   ============================================================ */
(function () {
  "use strict";
  window.V3 = window.V3 || {};

  /* ---- GF(256)，本原多项式 0x11D ---- */
  var EXP = [], LOG = [];
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenPoly(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var r = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { r[j] ^= g[j]; r[j + 1] ^= gmul(g[j], EXP[i]); }
      g = r;
    }
    return g;
  }
  function rsEc(data, n) {
    var gen = rsGenPoly(n);
    var buf = new Array(data.length + n).fill(0);
    for (var i = 0; i < data.length; i++) buf[i] = data[i];
    for (i = 0; i < data.length; i++) {
      var f = buf[i]; if (f === 0) continue;
      for (var j = 0; j < gen.length; j++) buf[i + j] ^= gmul(gen[j], f);
    }
    return buf.slice(data.length);
  }

  /* ---- 纠错等级 M 分块表：[ecPerBlock, [[块数, 每块数据码字], ...]] ---- */
  var ECC = {
    1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]],
    5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]],
    8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]]
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function utf8(str) {
    if (window.TextEncoder) return Array.from(new TextEncoder().encode(str));
    var s = unescape(encodeURIComponent(str)), a = [];
    for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i));
    return a;
  }
  function dataCodewords(ver) {
    var t = 0; ECC[ver][1].forEach(function (g) { t += g[0] * g[1]; }); return t;
  }

  /* ---- 字节流编码：模式 0100 + 计数 + 数据 + 终止符 + 0xEC/0x11 填充 ---- */
  function encodeBytes(bytes) {
    var ver = 0;
    for (var v = 1; v <= 10; v++) {
      if (4 + (v <= 9 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v) * 8) { ver = v; break; }
    }
    if (!ver) return null;
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    var cap = dataCodewords(ver) * 8;
    push(0, Math.min(4, cap - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    for (var p = 0; cw.length < dataCodewords(ver); p++) cw.push(p % 2 === 0 ? 0xEC : 0x11);

    var blocks = [], ecBlocks = [], ecLen = ECC[ver][0];
    ECC[ver][1].forEach(function (g) { for (var k = 0; k < g[0]; k++) blocks.push(cw.splice(0, g[1])); });
    blocks.forEach(function (blk) { ecBlocks.push(rsEc(blk, ecLen)); });
    var out = [], maxLen = 0;
    blocks.forEach(function (blk) { maxLen = Math.max(maxLen, blk.length); });
    for (i = 0; i < maxLen; i++) blocks.forEach(function (blk) { if (i < blk.length) out.push(blk[i]); });
    for (i = 0; i < ecLen; i++) ecBlocks.forEach(function (e) { out.push(e[i]); });
    return { ver: ver, codewords: out };
  }

  /* ---- 8 掩码条件（ISO 18004） ---- */
  var MASKS = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x, y) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return ((x * y) % 2) + ((x * y) % 3) === 0; },
    function (x, y) { return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; },
    function (x, y) { return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; }
  ];

  /* ---- 功能图形基座：定位/分隔/定时/校正/版本信息 + 格式信息保留区 ---- */
  function makeBase(ver) {
    var size = ver * 4 + 17, mod = [], fn = [], i;
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(0)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, v) { mod[y][x] = v ? 1 : 0; fn[y][x] = true; }

    [[0, 0], [size - 7, 0], [0, size - 7]].forEach(function (p) {
      for (var dy = -1; dy <= 7; dy++) {
        for (var dx = -1; dx <= 7; dx++) {
          var x = p[0] + dx, y = p[1] + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          var d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
          setF(x, y, d !== 2 && d !== 4);
        }
      }
    });
    for (i = 0; i < size; i++) { if (!fn[6][i]) setF(i, 6, i % 2 === 0); if (!fn[i][6]) setF(6, i, i % 2 === 0); }

    var ap = ALIGN[ver];
    ap.forEach(function (cy) {
      ap.forEach(function (cx) {
        if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) return;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) setF(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      });
    });

    if (ver >= 7) {
      var rem = ver;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var vbit = ((vb >>> i) & 1) === 1;
        var a = size - 11 + i % 3, b = Math.floor(i / 3);
        setF(a, b, vbit); setF(b, a, vbit);
      }
    }

    /* 格式信息保留（drawFormat 时写入真值） */
    for (i = 0; i <= 8; i++) { if (i !== 6) { fn[i][8] = true; fn[8][i] = true; } }
    for (i = 0; i < 8; i++) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }
    return { size: size, mod: mod, fn: fn };
  }

  function drawCodewords(base, codewords) {
    var size = base.size, mod = base.mod, fn = base.fn;
    var i = 0, total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && i < total) {
            mod[y][x] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
            i++;
          }
        }
      }
    }
  }

  function drawFormat(mod, fn, size, mask) {
    var d = mask; /* EC 等级 M 指示位 = 00 */
    var rem = d, i;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((d << 10) | rem) ^ 0x5412;
    function bit(k) { return ((bits >>> k) & 1) === 1; }
    function set(x, y, v) { mod[y][x] = v ? 1 : 0; fn[y][x] = true; }
    for (i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true); /* 固定暗模块 */
  }

  function applyMask(mod, fn, size, m) {
    var f = MASKS[m];
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) if (!fn[y][x] && f(x, y)) mod[y][x] ^= 1;
    }
  }

  /* ---- 标准罚分（规则 1–4），用于掩码选优 ---- */
  var P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  function penalty(mod, size) {
    var score = 0, x, y, run, v, i;
    for (y = 0; y < size; y++) {
      run = 1;
      for (x = 1; x < size; x++) {
        if (mod[y][x] === mod[y][x - 1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (x = 0; x < size; x++) {
      run = 1;
      for (y = 1; y < size; y++) {
        if (mod[y][x] === mod[y - 1][x]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        v = mod[y][x];
        if (v === mod[y][x + 1] && v === mod[y + 1][x] && v === mod[y + 1][x + 1]) score += 3;
      }
    }
    function scanPat(arr) {
      for (var off = 0; off + 11 <= arr.length; off++) {
        var m1 = true, m2 = true;
        for (var k = 0; k < 11; k++) {
          if (arr[off + k] !== P1[k]) m1 = false;
          if (arr[off + k] !== P2[k]) m2 = false;
          if (!m1 && !m2) break;
        }
        if (m1) score += 40;
        if (m2) score += 40;
      }
    }
    for (y = 0; y < size; y++) scanPat(mod[y]);
    for (x = 0; x < size; x++) {
      var col = [];
      for (y = 0; y < size; y++) col.push(mod[y][x]);
      scanPat(col);
    }
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) dark += mod[y][x];
    var total = size * size;
    var kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    if (kk > 0) score += kk * 10;
    return score;
  }

  function matrix(text) {
    var enc = encodeBytes(utf8(String(text == null ? "" : text)));
    if (!enc) return null;
    var base = makeBase(enc.ver);
    drawCodewords(base, enc.codewords);
    var best = null, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      var mod = base.mod.map(function (r) { return r.slice(); });
      applyMask(mod, base.fn, base.size, m);
      drawFormat(mod, base.fn, base.size, m);
      var s = penalty(mod, base.size);
      if (s < bestScore) { bestScore = s; best = mod; }
    }
    return { size: base.size, mod: best };
  }

  function svg(text, opts) {
    opts = opts || {};
    var q = matrix(text);
    if (!q) return "";
    var margin = opts.margin == null ? 2 : opts.margin;
    var n = q.size + margin * 2, d = "";
    for (var y = 0; y < q.size; y++) {
      var x = 0;
      while (x < q.size) {
        if (q.mod[y][x]) {
          var w = 1;
          while (x + w < q.size && q.mod[y][x + w]) w++;
          d += "M" + (x + margin) + " " + (y + margin) + "h" + w + "v1h-" + w + "Z";
          x += w;
        } else x++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n +
      '" shape-rendering="crispEdges" role="img" aria-label="二维码">' +
      '<path d="' + d + '" fill="' + (opts.dark || "#1F2A44") + '"/></svg>';
  }

  window.V3.qr = {
    matrix: matrix,
    svg: svg,
    /* 演示内容指向 RFC 2606 保留域 .example：真实可扫描、绝不会命中线上站点 */
    url: function (code) { return "https://engchain.example/r/" + encodeURIComponent(code || ""); }
  };
})();
