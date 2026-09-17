/* 收尾实拍：浅色 / 深色两个主题下，居右成簇后的底部区域。
   同裁切框，含窗口左右边缘，便于核对「球离右缘 12px」与「Dock↔球 8px」。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_final');
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
  for (const [key, theme, scroll] of [['light', 'light', 0], ['dark', 'dark', 0], ['light-scrolled', 'light', 900]]) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('engchain-theme', t); } catch (e) { /* 无痕下忽略 */ }
    }, theme);
    await sleep(1200);
    if (scroll) {
      await page.evaluate(y => {
        const sc = document.querySelector('.app-scroll, .app-main, .page-scroll') || document.scrollingElement;
        if (sc) sc.scrollTop = y;
      }, scroll);
      await sleep(800);
    }
    const m = await page.evaluate(() => {
      const shell = document.querySelector('.app-nav-shell').getBoundingClientRect();
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const orb = document.querySelector('.ai-orb-entry').getBoundingClientRect();
      return { shellTop: shell.top, shellH: shell.height, orbR: orb.right, orbL: orb.left,
               barL: bar.left, barR: bar.right, win: window.innerWidth };
    });
    const file = key + '.png';
    await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: m.shellTop - 14, width: m.win, height: m.shellH + 28 } });
    await page.close();
    rows.push({ key, theme, file, scroll, ...m, mid: m.orbL - m.barR, right: m.win - m.orbR });
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
 .shot{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.16)}
 .shot img{display:block;width:100%}
</style>
<h1>Dock 与球 · 居右成簇（--lg-orb-gap: 8px）</h1>
<p class="sub">构建产物实拍 · iPhone 390×844 · 3× · 整条底栏全宽，含窗口左右边缘</p>
${rows.map(r => `<div class="row">
  <span class="tag">${r.key}${r.scroll ? '（页面已滚动 ' + r.scroll + 'px）' : ''} · Dock↔球 ${r.mid.toFixed(1)} · 球→右缘 ${r.right.toFixed(1)}</span>
  <div class="shot"><img src="${r.file}"></div>
</div>`).join('')}`);

  console.log('\n主题'.padEnd(18) + 'Dock左'.padStart(9) + 'Dock右'.padStart(9) + 'Dock↔球'.padStart(10) + '球左/右'.padStart(16) + '球→右缘'.padStart(10));
  console.log('-'.repeat(74));
  for (const r of rows) {
    console.log(r.key.padEnd(18) + r.barL.toFixed(1).padStart(9) + r.barR.toFixed(1).padStart(9)
      + r.mid.toFixed(1).padStart(10) + (r.orbL.toFixed(1) + '/' + r.orbR.toFixed(1)).padStart(16)
      + r.right.toFixed(1).padStart(10));
  }
  console.log('对照页 -> ' + path.join(OUT, 'compare.html'));
})();
