/* 死代码清理的验证：清理前后逐像素相同。
   死代码的定义就是「删掉它，渲染结果不变」—— 所以判据必须是像素，
   而不是「测试还是绿的」（测试根本覆盖不到背景渐变这种像素级装饰）。

   只截 .app-tabbar 自身的 bbox：球是它的兄弟节点而非子节点，
   这样球的呼吸动画天然被排除在外，不需要额外遮罩。
   同时用 prefers-reduced-motion 冻结其余动画，让渲染可复现。

   用法: node dockpix.js <before|after>
        两次输出会落在 _pix/<阶段>-*.png 并打印 sha256。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const stage = process.argv[2];
if (stage !== 'before' && stage !== 'after') {
  console.error('用法: node dockpix.js <before|after>');
  process.exit(2);
}

const BASE = 'http://127.0.0.1:8765/';
// [页面, 主题, 视口高, 标签]  —— 覆盖浅/深主题与两个不同目录深度的子页前缀。
// 刻意不含短屏(≤720px)：那会进 Pura 侧边栏模式，而 app.css 里
// `.phone.has-pura-sidebar .app-nav-shell{display:none}` 把整个外壳隐藏，
// Dock 本就不显示，没有像素可比。短屏路径由 verify.js 的 46px 断言覆盖。
const CASES = [
  ['home.html', 'light', 844, 'home-light'],
  ['home.html', 'dark', 844, 'home-dark'],
  ['pages/supply/list.html', 'light', 844, 'supply-light'],
  ['pages/supply/list.html', 'dark', 844, 'supply-dark'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '_pix');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  // 预热：浏览器冷启动的第一次渲染与之后并不完全一致。
  // 实测同一份 CSS 连拍三次，hl2 与 hl3 逐像素相同（0 差异），
  // 而 hl1 与它们差 14999 像素、最大通道差仅 3/255 —— 是首帧的细微差别，
  // 不是随机噪声。不预热的话「前后相同」这个判据会被这 3/255 直接证伪。
  {
    const warm = await browser.newPage();
    await warm.goto(BASE + CASES[0][0], { waitUntil: 'networkidle0' });
    await sleep(1200);
    await warm.close();
  }

  const rows = [];
  for (const [rel, theme, h, tag] of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: h, deviceScaleFactor: 3 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(BASE + rel, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('engchain-theme', t); } catch (e) {}
    }, theme);
    await sleep(1500);   // 等玻璃层把 backdrop 采完、canvas 就绪
    const box = await page.evaluate(() => {
      const el = document.querySelector('.app-tabbar');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    });
    if (!box) { console.error('\n找不到 .app-tabbar: ' + rel); process.exit(1); }
    if (box.width <= 0 || box.height <= 0) {
      // 视口组合下 Dock 本就不可见（如 Pura 侧边栏模式隐藏了外壳）。
      // 这不是失败，但必须说出来 —— 悄悄跳过会让「截了 5 张」变成假象。
      console.error('\nSKIP ' + tag + ': .app-tabbar 尺寸为 0（该视口下不可见）');
      await page.close();
      continue;
    }
    const file = path.join(OUT, stage + '-' + tag + '.png');
    await page.screenshot({ path: file, clip: box });
    await page.close();

    const buf = fs.readFileSync(file);
    rows.push({ tag, box, sha: crypto.createHash('sha256').update(buf).digest('hex') });
    process.stdout.write('.');
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, stage + '.json'), JSON.stringify(rows, null, 2));
  console.log('\n' + stage + ':');
  for (const r of rows) console.log('  ' + r.tag.padEnd(14) + r.sha.slice(0, 16) + '  ' + r.box.width + 'x' + r.box.height);
})();
