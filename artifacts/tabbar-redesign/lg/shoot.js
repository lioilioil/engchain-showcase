/* Liquid Glass Dock 测试页截图与运行时诊断 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '_shots');
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
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(2500);

  // ---- 运行时诊断 ----
  const diag = await page.evaluate(() => {
    const tb = document.querySelector('.app-tabbar');
    const glass = document.querySelector('.tab-glass');
    const bar = document.querySelector('.lg-warp');
    const lens = document.querySelector('.tg-warp');
    const cv = document.querySelector('canvas.lg-gl');
    const rb = tb && tb.getBoundingClientRect();
    const rl = glass && glass.getBoundingClientRect();
    let glOk = false, bfOk = false;
    if (cv) { try { glOk = !!(cv.getContext('webgl') || cv.getContext('experimental-webgl')); } catch (e) {} }
    bfOk = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)')));
    return {
      shell: !!document.querySelector('.app-nav-shell'),
      orb: !!document.querySelector('.ai-orb-entry'),
      orbRect: (function () { const o = document.querySelector('.ai-orb-entry'); if (!o) return null; const r = o.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.left.toFixed(1), y: +r.top.toFixed(1) }; })(),
      tabbar: !!tb,
      layers: {
        base: !!document.querySelector('.lg-base'),
        warp: !!document.querySelector('.lg-warp'),
        spec: !!document.querySelector('.lg-spec'),
        gl: !!cv,
        lens: !!document.querySelector('.tg-lens')
      },
      barRect: rb ? { w: +rb.width.toFixed(1), h: +rb.height.toFixed(1), x: +rb.left.toFixed(1), y: +rb.top.toFixed(1) } : null,
      lensRect: rl ? { w: +rl.width.toFixed(1), h: +rl.height.toFixed(1) } : null,
      barFilter: bar ? getComputedStyle(bar).filter : null,
      lensFilter: lens ? getComputedStyle(lens).filter : null,
      svgFilters: Array.from(document.querySelectorAll('#lg-svg-defs filter')).map(f => f.id),
      tabLabelsHidden: Array.from(document.querySelectorAll('.app-tab .tab-label')).map(l => {
        const r = l.getBoundingClientRect();
        return { t: l.textContent, w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      }),
      tabColors: Array.from(document.querySelectorAll('.app-tab')).map(t => getComputedStyle(t).color),
      glOk, bfOk,
      isFirefox: /Firefox/i.test(navigator.userAgent)
    };
  });
  console.log('DIAG ' + JSON.stringify(diag, null, 2));
  console.log('ERRORS ' + JSON.stringify(errs, null, 2));

  const clip = diag.barRect ? {
    x: Math.max(0, diag.barRect.x - 26),
    y: Math.max(0, diag.barRect.y - 22),
    width: Math.min(390, diag.barRect.w + 46 + 70),
    height: diag.barRect.h + 44
  } : { x: 0, y: 700, width: 390, height: 144 };

  // ---- 浅色模式 ----
  await page.screenshot({ path: path.join(OUT, 'lg-light-full.png') });
  await page.screenshot({ path: path.join(OUT, 'lg-light-bar.png'), clip });

  // 悬停到左侧，验证指针跟随高光
  await page.mouse.move(diag.barRect ? diag.barRect.x + 40 : 60, diag.barRect ? diag.barRect.y + diag.barRect.h / 2 : 780);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'lg-light-bar-hover.png'), clip });

  // ---- 深色模式 ----
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, 'lg-dark-full.png') });
  await page.screenshot({ path: path.join(OUT, 'lg-dark-bar.png'), clip });

  // ---- 折射开关 A/B：关掉外扩做对比 ----
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.setProperty('--lg-bleed', '0px');
    document.documentElement.style.setProperty('--lg-lens-bleed', '0px');
  });
  await sleep(400);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, 'lg-light-bar-nobleed.png'), clip });

  await browser.close();
  console.log('done -> ' + OUT);
})();
