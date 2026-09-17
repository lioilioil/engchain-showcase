/* 底部文字回声归因：大模糊半径的 backdrop 越界采样 vs 折射层 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '_probe2');
const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
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
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(2500);

  const bar = await page.evaluate(() => {
    const r = document.querySelector('.app-tabbar').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  // 只切底部 26px，放大看回声
  const bottom = { x: 0, y: bar.y + bar.h - 20, width: 390, height: 44 };

  const variants = [
    ['base', '.p{}'],
    ['warp-off', '.lg-warp{filter:none !important}'],
    ['blur-8', '.lg-base{backdrop-filter:blur(8px) saturate(190%) !important;-webkit-backdrop-filter:blur(8px) saturate(190%) !important;.lg-warp{backdrop-filter:blur(8px)!important}}'],
    ['nobf', '.lg-base{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}.lg-warp{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'],
  ];

  for (const [name, css] of variants) {
    await page.addStyleTag({ content: css });
    await sleep(800);
    await page.screenshot({ path: path.join(OUT, 'b-' + name + '.png'), clip: bottom });
  }

  await browser.close();
  console.log('done -> ' + OUT);
})();
