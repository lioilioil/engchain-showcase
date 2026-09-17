/* 真页面实拍：app demo 的 home.html 底栏（浅色 / 深色 / 已滚动），
   确认效果在真实页面里也是对的，而不只是在测量里对。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home.html';
const OUT = path.join(__dirname, '_demo');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const rows = [];
  for (const [key, theme, scroll] of [['light', 'light', 0], ['dark', 'dark', 0], ['light-scrolled', 'light', 800]]) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('engchain-theme', t); } catch (e) {}
    }, theme);
    await sleep(1400);
    if (scroll) {
      await page.evaluate(y => {
        const sc = document.querySelector('.app-scroll, .app-main, .page-scroll') || document.scrollingElement;
        if (sc) sc.scrollTop = y;
      }, scroll);
      await sleep(900);
    }
    const m = await page.evaluate(() => {
      const shell = document.querySelector('.app-nav-shell').getBoundingClientRect();
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const orb = document.querySelector('.ai-orb-entry').getBoundingClientRect();
      return { top: shell.top, h: shell.height, win: window.innerWidth,
               barL: bar.left, barR: bar.right, orbL: orb.left, orbR: orb.right };
    });
    const file = key + '.png';
    await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: m.top - 16, width: m.win, height: m.h + 32 } });
    await page.close();
    rows.push({ key, file, scroll, ...m, gap: m.orbL - m.barR, right: m.win - m.orbR });
    process.stdout.write('.');
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'compare.html'), `<!doctype html><meta charset="utf-8">
<style>
 body{margin:0;background:#F2F2F4;font:13px/1.55 "Segoe UI",system-ui,sans-serif;color:#1A1A1A;padding:18px 20px 24px}
 h1{font-size:14px;font-weight:700;margin:0 0 2px}
 .sub{font-size:12px;color:#6A6A6A;margin:0 0 16px}
 .row{margin:0 0 14px}
 .tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.03em;color:#26445E;background:#D8E6F2;border-radius:5px;padding:2px 7px;margin:0 6px 5px 0}
 .shot{border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.16)}
 .shot img{display:block;width:100%}
</style>
<h1>app demo · home.html 底栏实拍（已挂载）</h1>
<p class="sub">http://127.0.0.1:8765/home.html · iPhone 390×844 · 3× · 整条底栏全宽，含窗口左右边缘</p>
${rows.map(r => `<div class="row">
  <span class="tag">${r.key}${r.scroll ? '（已滚动 ' + r.scroll + 'px）' : ''} · Dock↔球 ${r.gap.toFixed(1)} · 球→右缘 ${r.right.toFixed(1)}</span>
  <div class="shot"><img src="${r.file}"></div>
</div>`).join('')}`);

  console.log('\n' + '主题'.padEnd(18) + 'Dock左'.padStart(9) + 'Dock右'.padStart(9) + 'Dock↔球'.padStart(10) + '球→右缘'.padStart(10));
  console.log('-'.repeat(58));
  for (const r of rows) {
    console.log(r.key.padEnd(18) + r.barL.toFixed(1).padStart(9) + r.barR.toFixed(1).padStart(9)
      + r.gap.toFixed(1).padStart(10) + r.right.toFixed(1).padStart(10));
  }
  console.log('对照页 -> ' + path.join(OUT, 'compare.html'));
})();
