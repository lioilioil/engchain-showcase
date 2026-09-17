/* 分层对照：每关闭一层看剩余效果，用于如实说明各层贡献 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '_layers');
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

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2200);
    if (theme === 'dark') { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await sleep(900); }
    const bar = await page.evaluate(() => { const r = document.querySelector('.app-tabbar').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const clip = { x: Math.max(0, bar.x - 14), y: bar.y - 14, width: bar.w + 28, height: bar.h + 28 };

    const variants = [
      ['all', '.x{}'],
      ['no-gl', 'canvas.lg-gl{display:none !important}'],
      ['no-refraction', '.lg-warp,.tg-warp{filter:none !important}'],
      ['no-glass-at-all', '.lg-layer,.tg-lens,canvas.lg-gl{display:none !important}'],
    ];
    for (const [name, css] of variants) {
      await page.addStyleTag({ content: css });
      await sleep(700);
      await page.screenshot({ path: path.join(OUT, theme + '-' + name + '.png'), clip });
    }
    await page.close();
  }
  await browser.close();
  console.log('done -> ' + OUT);
})();
