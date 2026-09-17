/* 归因 A/B：定位左边缘灰白残影来自哪一层；并抓取 404 的真实 URL */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '_probe');
const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', r => failed.push('FAILED ' + r.url() + ' :: ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) failed.push('HTTP ' + r.status() + ' ' + r.url()); });

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(2500);
  console.log('FAILED_REQUESTS ' + JSON.stringify(failed, null, 2));

  const bar = await page.evaluate(() => {
    const r = document.querySelector('.app-tabbar').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const clip = { x: Math.max(0, bar.x - 30), y: Math.max(0, bar.y - 26), width: bar.w + 60 + 70, height: bar.h + 52 };

  // 左边缘放大切片，专门看残影
  const left = { x: Math.max(0, bar.x - 26), y: bar.y - 16, width: 130, height: bar.h + 32 };

  const variants = [
    ['base', ''],
    ['no-warp-filter', '.lg-warp{filter:none !important}'],
    ['no-warp-layer', '.lg-warp{display:none !important}'],
    ['no-spec', '.lg-spec{box-shadow:none !important}'],
    ['no-gl', 'canvas.lg-gl{display:none !important}'],
    ['no-base', '.lg-base{display:none !important}'],
    ['no-lens-shadow', '.tg-spec{box-shadow:none !important}'],
  ];

  for (const [name, css] of variants) {
    if (css) await page.addStyleTag({ content: css });
    else await page.addStyleTag({ content: '.lg-probe-anchor{}' });
    await sleep(700);
    await page.screenshot({ path: path.join(OUT, 'v-' + name + '-left.png'), clip: left });
    await page.screenshot({ path: path.join(OUT, 'v-' + name + '-bar.png'), clip });
  }

  await browser.close();
  console.log('done -> ' + OUT);
})();
