/* 按下形变 + 底玻透明度（本次两项改动）的测量与出图。
   只读不改源文件。

   要证的几件事，按「最容易骗人」排序：
     1. --lg-press 真的在**插值**。没注册 @property 的自定义属性是离散的，
        mousedown 瞬间从 0 跳到 1，中间采不到任何 (0,1) 的值 —— 看起来
        「也在动」，但形变是一帧闪现而不是过渡。所以断言必须采到中间值。
     2. .lg-base 的 alpha 随按下上升。background-image 是渐变，得把 rgba()
        抠出来比对，不能只看字符串变没变（--lg-a 变了但没进 calc 也会变字符串）。
     3. app.css 的 .app-tab:active{scale(.92)} 是否真被压掉。
     4. 减少动效下：不许缩放，但 alpha 反馈要留（那是颜色，不是动效）。

   用法: node probe-press3.js        需要 http://127.0.0.1:8765/ */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home.html';
const OUT = path.join(__dirname, '_press3');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const READ = `(function(){
  const bar = document.querySelector('.app-tabbar');
  const base = document.querySelector('.lg-base');
  const tab = document.querySelector('.app-tab');
  const svg = tab && tab.querySelector('svg');
  const cs = getComputedStyle(bar);
  return {
    press: parseFloat(cs.getPropertyValue('--lg-press')) || 0,
    barTf: cs.transform,
    tabTf: tab ? getComputedStyle(tab).transform : null,
    svgTf: svg ? getComputedStyle(svg).transform : null,
    bg: base ? getComputedStyle(base).backgroundImage : null
  };
})()`;

// 从 background-image 里抠出所有 rgba 的 alpha。渐变里 calc() 会被算成数字。
const alphas = s => (s || '').match(/rgba\([^)]*\)/g)?.map(m => parseFloat(m.split(',')[3])) ?? [];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const open = async (opts = {}) => {
    const page = await browser.newPage();
    if (opts.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (opts.theme) await page.evaluateOnNewDocument(t => {
      try { localStorage.setItem('engchain-theme', t); } catch (e) {}
    }, opts.theme);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(1800);
    if (opts.theme) { await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), opts.theme); await sleep(400); }
    return page;
  };
  const box = page => page.evaluate(() => {
    const b = document.querySelector('.app-tabbar').getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });

  // ---------- 1/2/3. 常规态：按下 ----------
  {
    console.log('=== 1. 按下：--lg-press 插值 / 整体缩放 / 底玻 alpha / 子块不缩 ===');
    const page = await open();
    const b = await box(page);
    const rest = await page.evaluate(READ);
    console.log('  静止  --lg-press=' + rest.press.toFixed(3) + '  bar=' + rest.barTf
      + '  tab=' + rest.tabTf + '  alpha=' + JSON.stringify(alphas(rest.bg)));

    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);

    // 采样本身有个陷阱：每次 page.evaluate / screenshot 的往返要几十上百毫秒，
    // 比 220ms 的过渡还长，于是每次读到的都是同一个终值 —— 看起来像离散跳变，
    // 其实只是我采样太慢。改成把采样循环放进页面里用 rAF 连采，往返延迟归零。
    const trajP = page.evaluate(() => new Promise(resolve => {
      const bar = document.querySelector('.app-tabbar');
      const out = []; let armed = false;
      const t0 = performance.now();
      function tick() {
        const v = parseFloat(getComputedStyle(bar).getPropertyValue('--lg-press')) || 0;
        const m = (getComputedStyle(bar).transform.match(/matrix\(([\d.]+)/) || [])[1];
        if (v > 0) armed = true;
        if (armed) out.push([+v.toFixed(3), m ? +(+m).toFixed(4) : 0]);
        if (out.length >= 14 || performance.now() - t0 > 2000) resolve(out);
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
    await sleep(80);                 // 等 rAF 循环起来
    await page.mouse.down();

    // 另一个独立判据：注册过 @property 的属性按下时会生成 CSSTransition；
    // 没注册的压根不建，值直接跳。getAnimations() 会强制一次样式更新，随按随读。
    const anims = await page.evaluate(() => document.getAnimations().map(a => ({
      prop: a.transitionProperty,
      dur: a.effect && a.effect.getTiming ? a.effect.getTiming().duration : null,
      play: a.playState
    })));
    console.log('  按下瞬间的动画对象: ' + (anims.length ? JSON.stringify(anims) : '（无）'));

    const snap = await trajP;
    console.log('  --lg-press 逐帧 ' + snap.map(s => s[0].toFixed(2)).join(' '));
    console.log('  transform  逐帧 ' + snap.map(s => s[1].toFixed(4)).join(' '));
    const mid = snap.filter(s => s[0] > 0.02 && s[0] < 0.98);
    console.log('  中间值 ' + mid.length + '/' + snap.length + ' 帧落在 (0,1) 内'
      + (mid.length ? '，如 ' + mid.slice(0, 5).map(s => s[0].toFixed(3)).join(' ') : '  <-- 离散跳变！'));

    const held = await page.evaluate(READ);
    console.log('  按下  --lg-press=' + held.press.toFixed(3) + '  bar=' + held.barTf
      + '  tab=' + held.tabTf + '  svg=' + held.svgTf + '  alpha=' + JSON.stringify(alphas(held.bg)));

    // 按住时的整屏图（含窗外内容，才看得出「穿透」）
    await page.screenshot({ path: path.join(OUT, 'pressed-light.png') });
    await page.mouse.up();
    await sleep(700);
    const back = await page.evaluate(READ);
    console.log('  松手  --lg-press=' + back.press.toFixed(3) + '  bar=' + back.barTf
      + '  alpha=' + JSON.stringify(alphas(back.bg)));

    // 裁剪条区大图，方便肉眼看边缘折射
    const clip = { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10), width: b.w + 20, height: b.h + 20 };
    await page.screenshot({ path: path.join(OUT, 'rest-light.png'), clip });
    await page.close();
  }

  // ---------- 4. 减少动效 ----------
  {
    console.log('\n=== 2. prefers-reduced-motion: reduce：不缩放，但 alpha 反馈保留 ===');
    const page = await open({ reduced: true });
    const b = await box(page);
    const rest = await page.evaluate(READ);
    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await page.mouse.down();
    await sleep(400);
    const held = await page.evaluate(READ);
    await page.mouse.up();
    console.log('  静止  bar=' + rest.barTf + '  alpha=' + JSON.stringify(alphas(rest.bg)));
    console.log('  按下  bar=' + held.barTf + '  --lg-press=' + held.press.toFixed(3)
      + '  alpha=' + JSON.stringify(alphas(held.bg)));
    await page.close();
  }

  // ---------- 5. 深色底玻 ----------
  {
    console.log('\n=== 3. 深色主题底玻 ===');
    const page = await open({ theme: 'dark' });
    const b = await box(page);
    const rest = await page.evaluate(READ);
    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await page.mouse.down();
    await sleep(400);
    const held = await page.evaluate(READ);
    await page.screenshot({ path: path.join(OUT, 'pressed-dark.png') });
    await page.mouse.up();
    await sleep(600);
    const clip = { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10), width: b.w + 20, height: b.h + 20 };
    await page.screenshot({ path: path.join(OUT, 'rest-dark.png'), clip });
    console.log('  静止  alpha=' + JSON.stringify(alphas(rest.bg)));
    console.log('  按下  alpha=' + JSON.stringify(alphas(held.bg)));
    await page.close();
  }

  await browser.close();
  console.log('\n图在 ' + OUT);
})();
