/* 两件事的测量，都不改写任何源文件：
   A. Pura 收起态的真实几何 —— 说明 Dock 被拉开的成因与目标宽度。
   B. 「整体放大」若用 transform: scale() 放在 .app-tabbar 上，
      会不会切断子层（.lg-warp / .tg-warp）的 backdrop 采样。
      B 只截图，不改文件；判定靠肉眼看图 + 像素统计。

   用法: node probe-pura.js            需要 http://127.0.0.1:8765/ */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'http://127.0.0.1:8765/';
const OUT = path.join(__dirname, '_probe');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GEO = `(function(){
  const q = s => document.querySelector(s);
  const r = el => { if(!el) return null; const b = el.getBoundingClientRect();
    return {l:+b.left.toFixed(1), r:+b.right.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1)}; };
  const phone = q('.phone');
  return {
    cls: phone ? phone.className : null,
    phone: r(phone),
    shell: r(q('.app-nav-shell')),
    tabbar: r(q('.app-tabbar')),
    orb: r(q('.ai-orb-entry')),
    orbDisplay: q('.ai-orb-entry') ? getComputedStyle(q('.ai-orb-entry')).display : null,
    lgH: getComputedStyle(document.documentElement).getPropertyValue('--lg-h').trim(),
    tabbarFlex: q('.app-tabbar') ? getComputedStyle(q('.app-tabbar')).flex : null,
  };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  // ---------- A. Pura 几何（四种组合） ----------
  console.log('=== A. Pura 模式几何（390×700，触发侧边栏）===');
  for (const [collapsed, side] of [[false, 'left'], [true, 'left'], [true, 'right']]) {
    const label = (collapsed ? '收起' : '展开') + '·侧栏在' + (side === 'left' ? '左' : '右');
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 700, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument((c, s) => {
      try {
        localStorage.setItem('engchain-pura-sidebar', c ? 'collapsed' : 'expanded');
        localStorage.setItem('engchain-pura-sidebar-side', s);
      } catch (e) {}
    }, collapsed, side);
    await page.goto(BASE + 'home.html', { waitUntil: 'networkidle0' });
    await sleep(1600);
    const g = await page.evaluate(GEO);
    console.log('\n-- ' + label + ' --');
    console.log('  phone 类名 : ' + g.cls);
    console.log('  shell      : ' + JSON.stringify(g.shell));
    console.log('  tabbar     : ' + JSON.stringify(g.tabbar) + '   flex=' + g.tabbarFlex);
    console.log('  orb        : ' + JSON.stringify(g.orb) + '   display=' + g.orbDisplay);
    console.log('  --lg-h     : ' + g.lgH);
    if (g.orb && g.tabbar && g.tabbar.w > 0) {
      console.log('  Dock↔球间距 : ' + (g.orb.l - g.tabbar.r).toFixed(1)
        + 'px   球→右缘 ' + (g.phone.r - g.orb.r).toFixed(1)
        + 'px   球→左缘 ' + (g.orb.l - g.phone.l).toFixed(1) + 'px');
    }
    await page.close();
  }

  // ---------- B. transform 会不会切断 backdrop 采样 ----------
  // 在正常 390×844 下做，避免混入 Pura 布局的变量。
  console.log('\n=== B. transform:scale(1.02) 放在 .app-tabbar 上，折射层是否还在 ===');
  const CASES = [
    ['baseline', ''],
    ['scale-on-tabbar', '.app-tabbar{transform:scale(1.02);transform-origin:50% 50%}'],
  ];
  for (const [tag, css] of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(BASE + 'home.html', { waitUntil: 'networkidle0' });
    await sleep(1400);
    if (css) await page.addStyleTag({ content: css });
    await sleep(900);
    const box = await page.evaluate(() => {
      const el = document.querySelector('.app-tabbar');
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.left) - 6, y: Math.round(b.top) - 6,
               width: Math.round(b.width) + 12, height: Math.round(b.height) + 12 };
    });
    const file = path.join(OUT, 'transform-' + tag + '.png');
    await page.screenshot({ path: file, clip: box });
    const buf = fs.readFileSync(file);
    // 顺带统计：折射正常时玻璃区应有明显的横向明暗变化；采样被切断会趋于平坦/纯色
    const stats = await page.evaluate(() => {
      const w = document.querySelector('.lg-warp');
      const cs = getComputedStyle(w);
      return { backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
               clip: cs.clipPath, transform: cs.transform };
    });
    console.log('  ' + tag.padEnd(18) + crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12)
      + '  warp=' + JSON.stringify(stats));
    await page.close();
  }

  await browser.close();
  console.log('\n图在 ' + OUT + '，肉眼比对 transform-*.png');
})();
