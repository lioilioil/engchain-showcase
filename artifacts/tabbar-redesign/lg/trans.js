/* 透光率：只量玻璃本身。
   上一版把采样带放在了 Dock 两端，正好压在第一个图标的笔画和边缘高光上，
   白侧被图标压暗、黑侧被高光提亮，落差被两头吃掉。
   这一版把图标和角标藏掉，采样带移到图标之间的净空区，并躲开边缘高光带。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_trans');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HIDE_UI = `.app-tab svg, .app-tab .badge{visibility:hidden !important}
  .tab-glass{display:none !important}`;   // 只量 Dock 玻璃本身；滑动透镜另有独立滤镜，会污染采样

const OLD = `
.lg-base{background:linear-gradient(180deg,rgba(255,255,255,.36) 0%,rgba(255,255,255,.17) 42%,rgba(255,255,255,.13) 64%,rgba(255,255,255,.28) 100%) !important;
  -webkit-backdrop-filter:blur(26px) saturate(190%) brightness(1.02) !important; backdrop-filter:blur(26px) saturate(190%) brightness(1.02) !important;}
.lg-spec{box-shadow: inset 0 1.5px 1px rgba(255,255,255,.78), inset 0 -1px 2px rgba(255,255,255,.22),
  inset 0 0 0 1px rgba(255,255,255,.34), 0 16px 44px rgba(22,22,22,.20), 0 5px 16px rgba(22,22,22,.10) !important;}
.tg-spec{background:linear-gradient(180deg,rgba(255,255,255,.36) 0%,rgba(255,255,255,.04) 48%,
  rgba(255,255,255,.05) 76%,rgba(255,255,255,.15) 100%) !important;
  box-shadow: inset 0 1.5px 1.5px rgba(255,255,255,.96), inset 0 -4px 7px -3px rgba(138,126,102,.22),
  inset 0 0 0 1px rgba(255,255,255,.62), 0 7px 20px rgba(22,22,22,.15), 0 1px 2px rgba(22,22,22,.07) !important;}
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 4 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  for (const [label, css] of [['new', null], ['old', OLD]]) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(3000);
    await page.addStyleTag({ content: HIDE_UI + (css || '') });
    const box = await page.evaluate((stage) => {
      const shell = document.querySelector('.app-nav-shell');
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;z-index:49;pointer-events:none;'
        + 'height:' + Math.round(bar.height + stage) + 'px;'
        + 'background:linear-gradient(90deg,#fff 0 50%,#000 50% 100%);';
      shell.parentNode.insertBefore(d, shell);
      return { top: bar.top, h: bar.height, left: bar.left, w: bar.width };
    }, 80);
    await sleep(800);

    // 净空区：第一个与第二个图标之间（bar 内 62~100px），黑侧镜像
    const W = 38;
    const yIn = Math.round(box.top + box.h / 2 - 1);
    const yOut = Math.round(box.top - 40);
    const white = { x: box.left + 62, width: W, height: 3 };
    const black = { x: box.left + box.w - 100, width: W, height: 3 };
    for (const [nm, y] of [['in', yIn], ['out', yOut]]) {
      await page.screenshot({ path: path.join(OUT, `${label}_${nm}_white.png`), clip: { ...white, y } });
      await page.screenshot({ path: path.join(OUT, `${label}_${nm}_black.png`), clip: { ...black, y } });
    }
    await page.close();
  }
  await browser.close();
  console.log('done -> ' + OUT);
})();
