/* 闪烁归因：连拍多帧，逐像素求跨帧标准差。
   关键是对照组 —— `no-glass-at-all` 把玻璃层全部拆掉，只留原始 app.css 的 tabbar。
   若 all 与 no-glass-at-all 的标准差相当，说明残余抖动来自页面自身（首页的入场动画等），
   与 tabbar 无关；只有 all 明显高于对照组时，才轮到玻璃层背锅。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '_flicker');
const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FRAMES = 16;
const GAP = 70;
const SETTLE = 6000;          // 等首页入场动画彻底跑完再采样

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const variants = [
    ['A-all', '.x{}'],
    ['B-control-no-glass', '.lg-layer,.tg-lens,canvas.lg-gl{display:none !important}'],
    ['C-no-gl', 'canvas.lg-gl{display:none !important}'],
    ['D-no-refraction', '.lg-warp,.tg-warp{filter:none !important}'],
    ['E-no-css-anim', '*,*::before,*::after{animation:none !important;transition:none !important}'],
  ];

  for (const [name, css] of variants) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(SETTLE);
    await page.addStyleTag({ content: css });
    await sleep(1200);
    const bar = await page.evaluate(() => {
      const r = document.querySelector('.app-tabbar').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const clip = { x: Math.max(0, bar.x - 10), y: Math.max(0, bar.y - 10), width: bar.w + 20, height: bar.h + 20 };
    for (let i = 0; i < FRAMES; i++) {
      await page.screenshot({ path: path.join(OUT, `${name}_${String(i).padStart(2, '0')}.png`), clip });
      await sleep(GAP);
    }
    await page.close();
  }
  await browser.close();
  console.log('captured ' + variants.length * FRAMES + ' frames -> ' + OUT);
})();
