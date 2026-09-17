/* 判定「祖先 transform 是否切断子层 backdrop 采样」。
   不看图、不猜 —— 用可判死的实验：

     Dock 是 .phone 内 position:absolute 的浮层，内容滚动时它自己不移动。
     所以把背后内容滚动 N px：
        采样还活着 → Dock 透出的背景变了 → Dock 区域像素必然改变
        采样被切断 → Dock 只画自己的层，与背后无关 → 像素一模一样

   先自证实验有效：对 --lg-bleed 无关的 .lg-base 单独验一遍（它必须变化），
   否则「没变化」可能只是这个实验压根不灵敏。

   用法: node probe-backdrop.js */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BASE = 'http://127.0.0.1:8765/';
const OUT = path.join(__dirname, '_probe');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 极简 PNG 解码：只在 Chrome 输出的 8bit RGBA / RGB 上工作。 */
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3;
  const stride = w * bpp;
  const px = Buffer.alloc(w * h * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    cur.copy(px, y * stride);
    prev = cur;
  }
  return { w, h, bpp, px };
}

function diff(A, B) {
  const n = Math.min(A.px.length, B.px.length);
  let changed = 0, maxd = 0, sum = 0;
  for (let i = 0; i < n; i += A.bpp) {
    let d = 0;
    for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.px[i + k] - B.px[i + k]));
    if (d > 0) changed++;
    if (d > maxd) maxd = d;
    sum += d;
  }
  const total = n / A.bpp;
  return { total, changed, maxd, mean: +(sum / total).toFixed(2) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const VARIANTS = [
    ['A 基线（无 transform）', ''],
    ['B scale 放在 .app-tabbar 上', '.app-tabbar{transform:scale(1.02);transform-origin:50% 50%}'],
    ['C scale 放在 .lg-base/.lg-spec 上', '.lg-base,.lg-spec{transform:scale(1.02);transform-origin:50% 50%}'],
  ];

  console.log('每格 = Dock 区域在「内容滚动 0px」与「滚动 40px」两张图之间的像素差');
  console.log('活着 ⇒ 差异显著；被切断 ⇒ 全 0\n');

  for (const [label, css] of VARIANTS) {
    const shots = [];
    for (const scroll of [0, 40]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(BASE + 'home.html', { waitUntil: 'networkidle0' });
      await sleep(1400);
      if (css) await page.addStyleTag({ content: css });
      await page.evaluate(s => {
        const el = document.querySelector('.scroll');
        if (el) el.scrollTop = s;
      }, scroll);
      await sleep(1000);
      const box = await page.evaluate(() => {
        const b = document.querySelector('.app-tabbar').getBoundingClientRect();
        return { x: Math.round(b.left), y: Math.round(b.top),
                 width: Math.round(b.width), height: Math.round(b.height) };
      });
      const f = path.join(OUT, 'bd-' + label[0] + '-' + scroll + '.png');
      await page.screenshot({ path: f, clip: box });
      shots.push(decodePNG(fs.readFileSync(f)));
      await page.close();
      process.stdout.write('.');
    }
    const d = diff(shots[0], shots[1]);
    console.log('\n' + label.padEnd(34) + ' 变化 ' + String(d.changed).padStart(6) + '/' + d.total
      + '  (' + (100 * d.changed / d.total).toFixed(1) + '%)  最大通道差 ' + d.maxd
      + '  平均 ' + d.mean);
  }

  await browser.close();
})();
