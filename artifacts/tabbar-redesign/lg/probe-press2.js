/* 需求 3 的关键验证：.app-tabbar 带 2D transform 时，子层 backdrop-filter 还在不在采样页面背景？
   判据用黑白测试底：若 Backdrop Root 被切断，玻璃就采不到背景，
   测出来的透光率会突变（要么全透、要么全无），而不是保持 ~96%。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_press2');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HIDE = `.app-tab svg, .app-tab .badge{visibility:hidden !important} .tab-glass{display:none !important}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 4 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  for (const [label, css] of [
    ['plain', ''],
    ['scale-tabbar', '.app-tabbar{transform:scale(1.03) !important}'],
    ['scale-shell', '.app-nav-shell{transform:scale(1.03) !important}'],
  ]) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(3000);
    await page.addStyleTag({ content: HIDE + css });
    const box = await page.evaluate(() => {
      const shell = document.querySelector('.app-nav-shell');
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;z-index:49;pointer-events:none;'
        + 'height:' + Math.round(bar.height + 80) + 'px;'
        + 'background:linear-gradient(90deg,#fff 0 50%,#000 50% 100%);';
      shell.parentNode.insertBefore(d, shell);
      return { x: bar.left, y: bar.top, w: bar.width, h: bar.height };
    });
    await sleep(700);
    // 采样点按未缩放几何取，缩放下会略微偏移，故两套都取
    const yIn = Math.round(box.y + box.h / 2 - 1);
    const yOut = Math.round(box.y - 40);
    for (const [nm, y] of [['in', yIn], ['out', yOut]]) {
      await page.screenshot({ path: path.join(OUT, `${label}_${nm}_w.png`), clip: { x: box.x + 62, y, width: 38, height: 3 } });
      await page.screenshot({ path: path.join(OUT, `${label}_${nm}_b.png`), clip: { x: box.x + box.w - 100, y, width: 38, height: 3 } });
    }
    await page.close();
  }
  await browser.close();
  console.log('done -> ' + OUT);
})();
