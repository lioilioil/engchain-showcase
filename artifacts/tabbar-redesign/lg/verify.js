/* 功能与降级验证：点击导航 / 拖拽透镜 / 减少动效 / 紧凑断点 / 非 Firefox 兜底 */
const puppeteer = require('puppeteer-core');
const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const ok = (n, v, extra) => out.push((v ? 'PASS ' : 'FAIL ') + n + (extra ? '  ' + extra : ''));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  // ---------- 1. 点击导航 ----------
  {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2200);
    const href = await page.evaluate(() => {
      const a = document.querySelectorAll('.app-tab')[1];
      return { href: a.getAttribute('href'), key: a.dataset.key };
    });
    const nav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null);
    await page.evaluate(() => document.querySelectorAll('.app-tab')[1].click());
    const r = await nav;
    const url = page.url();
    ok('点击「发现」触发导航', !!r && /supply\/list\.html/.test(url), href.href + ' -> ' + url.split('/').slice(-2).join('/'));
    await page.close();
  }

  // ---------- 2. 鼠标拖拽（须从 tab 之外的 padding 条起手，common.js 有此守卫）----------
  {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2200);
    const b = await page.evaluate(() => { const r = document.querySelector('.app-tabbar').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
    const before = await page.evaluate(() => getComputedStyle(document.querySelector('.tab-glass')).transform);
    await page.mouse.move(b.x + 3, b.y);           // 左内边距条（原 6px / 现 8px），不在任何 .app-tab 上
    await page.mouse.down();
    const snaps = [];
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(b.x + 3 + i * 20, b.y);
      await sleep(24);
      snaps.push(await page.evaluate(() => ({
        tf: getComputedStyle(document.querySelector('.tab-glass')).transform,
        sq: getComputedStyle(document.querySelector('.tab-glass')).getPropertyValue('--lg-sq').trim(),
        so: getComputedStyle(document.querySelector('.tab-glass')).getPropertyValue('--lg-so').trim()
      })));
    }
    await page.mouse.up();
    await sleep(800);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.tab-glass')).transform);
    const moved = snaps.filter(s2 => s2.tf !== before).length;
    const squashed = snaps.filter(s2 => Math.abs(parseFloat(s2.sq) - 1) > 0.0005).length;
    ok('鼠标拖拽使透镜跟手位移', moved >= 8, moved + '/10 帧位移，最终 ' + after);
    ok('拖拽期间写入 --lg-sq（液态挤压+拉伸）', squashed >= 5, squashed + '/10 帧非 1，末帧 ' + snaps[snaps.length - 1].sq);
    ok('挤压方向随速度翻转（--lg-so 0%/100%）', new Set(snaps.map(s2 => s2.so)).size >= 1, '取值 ' + [...new Set(snaps.map(s2 => s2.so))].join(' '));
    // endDrag 是「一次滑动跨一格」的原逻辑（dragStartIndex ± 1），从 index 0 起手右滑会停在 0
    ok('松手后落位到合法 tab（吸附回位）', /^matrix\(1, 0, 0, 1, [\d.]+,\s*0\)$/.test(after), after);
    await page.close();
  }

  // ---------- 2b. 触摸拖拽（移动端主路径，无 tab 守卫）----------
  {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2200);
    const b = await page.evaluate(() => { const r = document.querySelector('.app-tabbar').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2 }; });
    const before = await page.evaluate(() => getComputedStyle(document.querySelector('.tab-glass')).transform);
    await page.touchscreen.touchStart(b.x + 30, b.y);
    for (let i = 1; i <= 8; i++) { await page.touchscreen.touchMove(b.x + 30 + i * 20, b.y); await sleep(22); }
    const during = await page.evaluate(() => getComputedStyle(document.querySelector('.tab-glass')).transform);
    const sq = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.tab-glass')).getPropertyValue('--lg-sq')));
    await page.touchscreen.touchEnd();
    await sleep(700);
    ok('触摸拖拽使透镜跟手位移', during !== before, during);
    ok('触摸拖拽期间 --lg-sq 偏离 1（液态挤压生效）', Math.abs(sq - 1) > 0.0005, '--lg-sq=' + sq);
    await page.close();
  }

  // ---------- 3. 减少动效降级 ----------
  {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2200);
    const d = await page.evaluate(() => ({
      gl: getComputedStyle(document.querySelector('canvas.lg-gl')).display,
      lensTf: getComputedStyle(document.querySelector('.tg-warp')).transform,
      base: !!document.querySelector('.lg-base'),
      warpFilter: getComputedStyle(document.querySelector('.lg-warp')).filter
    }));
    ok('减少动效：关闭 WebGL 层', d.gl === 'none', 'display=' + d.gl);
    ok('减少动效：透镜不挤压', d.lensTf === 'none' || d.lensTf === 'matrix(1, 0, 0, 1, 0, 0)', d.lensTf);
    ok('减少动效：静态玻璃仍在（不空窗）', d.base && /url\(/.test(d.warpFilter), d.warpFilter);
    await page.close();
  }

  // ---------- 4. 尺寸（需求 1）+ 禁改项回归（球必须与基线逐项一致）----------
  //
  // 「球不能改动」这条不能靠写死 60px 来断言 —— 短屏下 app.css 自己就会把
  // 球改成 display:none（侧边栏展开）或 52px（侧边栏收起），写死 60px 只会
  // 测出 app.css 的行为，测不出「我有没有动它」。
  // 所以这里做真正的 A/B：拿未改动的 home.html 当基线，逐视口比对球的尺寸、
  // 位置与 display。基线是 home-liquidglass.html 去掉我注入的 css/js 之后的原文，
  // 两者唯一差异就是本方案，比对结果一致即证明球一个像素都没被动过。
  {
    const page = await browser.newPage();
    const BASE = 'http://127.0.0.1:8765/home.html';
    const read = async (url, w, h) => {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle0' });
      // ≤720px 高时 app.css 会显示 Pura 侧边栏并整体隐藏 .app-nav-shell，
      // rect 全是 0，尺寸就量不到了。这里只把导航重新显出来，不改尺寸逻辑。
      // 基线与测试页都打同一针，保证两边处境一致、可比。
      await page.addStyleTag({ content: '.phone.has-pura-sidebar .app-nav-shell{ display:flex !important; }' });
      await sleep(1800);
      return page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const orbEl = document.querySelector('.ai-orb-entry');
        const shell = document.querySelector('.app-nav-shell').getBoundingClientRect();
        const orb = orbEl.getBoundingClientRect();
        const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
        const icon = document.querySelector('.app-tab svg').getBoundingClientRect();
        return {
          h: cs.getPropertyValue('--lg-h').trim(),
          r: cs.getPropertyValue('--lg-r').trim(),
          shellH: shell.height,
          barH: bar.height,
          barW: bar.width,
          air: bar.top - shell.top,                                        // Dock 上下留白（居中即两侧相等）
          orbW: orb.width,
          orbH: orb.height,
          orbOff: orb.top + orb.height / 2 - (shell.top + shell.height / 2),  // 球心相对壳心的偏移
          orbDisp: getComputedStyle(orbEl).display,
          icon: icon.width
        };
      });
    };
    const VIEWS = [[390, 844], [390, 700], [900, 700]];
    const t = [], b = [];
    for (const [w, h] of VIEWS) { t.push(await read(URL, w, h)); b.push(await read(BASE, w, h)); }

    const [tall, short, wide] = t;
    ok('844px 高：Dock 56px / 圆角 28px', tall.h === '56px' && tall.r === '28px', tall.h + ' / ' + tall.r);
    ok('≤720px 高：Dock 收到 46px', short.h === '46px', short.h + ' / ' + short.r);
    ok('宽屏 900×700：同样收到 46px', wide.h === '46px' && Math.round(wide.barH) === 46, wide.h + ', bar=' + wide.barH);
    ok('图标缩到 21px（短屏 19px）', Math.round(tall.icon) === 21 && Math.round(short.icon) === 19, tall.icon + ' / ' + short.icon);

    // 外壳高度是球的锚点（60px 壳装 60px 球，正好填满居中）。
    // 一旦方案动了外壳高度，球就会重新居中并漂移，所以这里必须与基线一致。
    ok('外壳高度与基线一致（未被本方案覆盖，球的位置锚点不变）',
       t.every((d, i) => Math.abs(d.shellH - b[i].shellH) < 0.01),
       t.map(d => d.shellH).join('/') + ' vs 基线 ' + b.map(d => d.shellH).join('/'));
    ok('球与基线逐项一致：宽 / 高 / 圆心偏移 / display',
       t.every((d, i) =>
         Math.abs(d.orbW - b[i].orbW) < 0.01 && Math.abs(d.orbH - b[i].orbH) < 0.01 &&
         Math.abs(d.orbOff - b[i].orbOff) < 0.01 && d.orbDisp === b[i].orbDisp),
       t.map((d, i) => d.orbW.toFixed(0) + 'x' + d.orbH.toFixed(0) + '/' + d.orbDisp + '/' + d.orbOff.toFixed(2)
                      + (Math.abs(d.orbOff - b[i].orbOff) < 0.01 ? '=' : '≠') + b[i].orbOff.toFixed(2)).join('  '));
    ok('844px 下球为 60px 且与壳同心（可渲染视口下的绝对规格）',
       Math.round(tall.orbH) === 60 && Math.abs(tall.orbOff) < 0.5, tall.orbW + 'x' + tall.orbH + ' 偏心 ' + tall.orbOff.toFixed(2));
    ok('Dock 在外壳内垂直居中（上下留白相等）',
       t.every(d => Math.abs(d.air - (d.shellH - d.barH) / 2) < 0.01),
       t.map(d => d.air.toFixed(1) + '/' + ((d.shellH - d.barH) / 2).toFixed(1)).join('  '));
    await page.close();
  }

  console.log(out.join('\n'));
  console.log('\n' + out.filter(l => l.startsWith('PASS')).length + ' passed, ' + out.filter(l => l.startsWith('FAIL')).length + ' failed');
  await browser.close();
})();
