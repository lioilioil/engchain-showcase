/* 在真实页面的不同滚动位置出图，检验 Dock 落在各种背景上是否都成立 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_look');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2500);
    if (theme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await sleep(1000);
    const max = await page.evaluate(() => {
      const s = document.querySelector('.scroll');
      return s ? s.scrollHeight - s.clientHeight : document.body.scrollHeight;
    });
    for (const [i, frac] of [0, 0.35, 0.7, 1].entries()) {
      await page.evaluate((y) => {
        const s = document.querySelector('.scroll');
        (s || document.scrollingElement).scrollTop = y;
      }, Math.round(max * frac));
      await sleep(900);
      await page.screenshot({ path: path.join(OUT, `${theme}-${i}.png`) });
    }
    await page.close();
  }
  await browser.close();
  console.log('done -> ' + OUT);
})();
