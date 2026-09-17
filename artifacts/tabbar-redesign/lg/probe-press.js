/* 需求 3 的前提验证：给 .app-tabbar 加 transform 会不会打断子层的 backdrop-filter 采样？
   规范上 transform 会形成 Backdrop Root，后代再也看不到页面背景。
   先量出来，再决定是用 transform 还是别的实现方式。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_press');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(3000);

  const r = await page.evaluate(() => {
    const q = document.querySelector('.app-tabbar').getBoundingClientRect();
    return { x: q.left - 10, y: q.top - 10, width: q.width + 20, height: q.height + 20 };
  });

  const cases = [
    ['a-baseline', '.x{}'],
    ['b-scale-tabbar', '.app-tabbar{transform:scale(1.03) !important}'],
    ['c-scale-shell', '.app-nav-shell{transform:scale(1.03) !important}'],
    ['d-opacity-tabbar', '.app-tabbar{opacity:.9 !important}'],
  ];
  for (const [name, css] of cases) {
    await page.addStyleTag({ content: css });
    await sleep(700);
    await page.screenshot({ path: path.join(OUT, name + '.png'), clip: r });
  }
  await browser.close();
  console.log('done -> ' + OUT);
})();
