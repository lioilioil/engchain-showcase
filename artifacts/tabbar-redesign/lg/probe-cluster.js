/* 事实采集：外壳里到底有哪几个 flex 子项、谁在吃剩余空间。
   「Dock↔球」的间距不是 flex gap 一项决定的 —— 先量清楚再说方案。 */
const puppeteer = require('puppeteer-core');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(2400);

  const d = await page.evaluate(() => {
    const W = window.innerWidth;
    const shellEl = document.querySelector('.app-nav-shell');
    const shell = shellEl.getBoundingClientRect();
    const scs = getComputedStyle(shellEl);
    const kids = [...shellEl.children].map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        cls: el.className,
        tag: el.tagName.toLowerCase(),
        l: +r.left.toFixed(2), r: +r.right.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
        ml: cs.marginLeft, mr: cs.marginRight,
        flex: cs.flex, disp: cs.display, order: cs.order, pos: cs.position
      };
    });
    const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
    const orbEl = document.querySelector('.ai-orb-entry');
    const orb = orbEl.getBoundingClientRect();
    return {
      win: W,
      shell: { l: +shell.left.toFixed(2), r: +shell.right.toFixed(2), w: +shell.width.toFixed(2), h: +shell.height.toFixed(2) },
      shellCss: { display: scs.display, gap: scs.gap, justify: scs.justifyContent, align: scs.alignItems, left: scs.left, right: scs.right },
      kids,
      bar: { l: +bar.left.toFixed(2), r: +bar.right.toFixed(2), w: +bar.width.toFixed(2) },
      orb: { l: +orb.left.toFixed(2), r: +orb.right.toFixed(2), w: +orb.width.toFixed(2), disp: getComputedStyle(orbEl).display },
      lgW: getComputedStyle(document.documentElement).getPropertyValue('--lg-w').trim() || '(未定义)',
      lgH: getComputedStyle(document.documentElement).getPropertyValue('--lg-h').trim()
    };
  });

  console.log('视口宽 ' + d.win + '   外壳 ' + JSON.stringify(d.shell) + '   外壳CSS ' + JSON.stringify(d.shellCss));
  console.log('--lg-h=' + d.lgH + '   --lg-w=' + d.lgW);
  console.log('\n外壳子项：');
  for (const k of d.kids) {
    console.log('  ' + (k.cls || k.tag).padEnd(22) + ' L' + String(k.l).padStart(7) + ' R' + String(k.r).padStart(7)
      + ' W' + String(k.w).padStart(7) + ' H' + String(k.h).padStart(6)
      + '  ml=' + k.ml.padEnd(7) + ' mr=' + k.mr.padEnd(7) + ' flex=' + k.flex.padEnd(18) + ' ' + k.disp);
  }
  console.log('\nDock ' + JSON.stringify(d.bar) + '   球 ' + JSON.stringify(d.orb));
  console.log('\n间距：');
  console.log('  窗口左 → Dock 左   ' + (d.bar.l).toFixed(1));
  console.log('  Dock 右 → 球 左    ' + (d.orb.l - d.bar.r).toFixed(1) + '   ← 需求要调整的就是这个');
  console.log('  球 右 → 窗口右     ' + (d.win - d.orb.r).toFixed(1) + '   ← 需求要求保持不变');
  console.log('  Dock 右 → 外壳右   ' + (d.shell.r - d.bar.r).toFixed(1));
  await browser.close();
})();
