/* 目视对照：改动前后 × 浅色/深色，出图供人眼判断 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_compare');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OLD = `
.lg-base{background:linear-gradient(180deg,rgba(255,255,255,.36) 0%,rgba(255,255,255,.17) 42%,rgba(255,255,255,.13) 64%,rgba(255,255,255,.28) 100%) !important;
  -webkit-backdrop-filter:blur(26px) saturate(190%) brightness(1.02) !important; backdrop-filter:blur(26px) saturate(190%) brightness(1.02) !important;}
[data-theme="dark"] .lg-base{background:linear-gradient(180deg,rgba(52,52,60,.50) 0%,rgba(34,34,40,.34) 42%,rgba(28,28,34,.28) 64%,rgba(44,44,52,.44) 100%) !important;
  -webkit-backdrop-filter:blur(26px) saturate(165%) brightness(.94) !important; backdrop-filter:blur(26px) saturate(165%) brightness(.94) !important;}
.lg-spec{box-shadow: inset 0 1.5px 1px rgba(255,255,255,.78), inset 0 -1px 2px rgba(255,255,255,.22),
  inset 0 0 0 1px rgba(255,255,255,.34), 0 16px 44px rgba(22,22,22,.20), 0 5px 16px rgba(22,22,22,.10) !important;}
[data-theme="dark"] .lg-spec{box-shadow: inset 0 1.5px 1px rgba(255,255,255,.22), inset 0 -1px 2px rgba(255,255,255,.08),
  inset 0 0 0 1px rgba(255,255,255,.14), 0 18px 48px rgba(0,0,0,.60), 0 5px 16px rgba(0,0,0,.34) !important;}
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
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  for (const theme of ['light', 'dark']) {
    for (const [ver, css] of [['new', null], ['old', OLD]]) {
      const page = await browser.newPage();
      await page.goto(URL, { waitUntil: 'networkidle0' });
      await sleep(2500);
      if (theme === 'dark') { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); }
      if (css) await page.addStyleTag({ content: css });
      await sleep(1400);
      const r = await page.evaluate(() => {
        const s = document.querySelector('.app-nav-shell').getBoundingClientRect();
        return { x: s.left - 8, y: s.top - 26, w: s.width + 16, h: s.height + 44 };
      });
      await page.screenshot({ path: path.join(OUT, `${theme}-${ver}.png`), clip: { x: Math.max(0, r.x), y: r.y, width: r.w, height: r.h } });
      await page.close();
    }
  }
  await browser.close();
  console.log('done -> ' + OUT);
})();
