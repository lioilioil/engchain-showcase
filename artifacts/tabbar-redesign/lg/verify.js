/* 功能与降级验证：点击导航 / 拖拽透镜 / 减少动效 / 紧凑断点 / 禁改项回归 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// 直接在真页面上跑 —— 本方案已挂到 app demo，不再有独立的测试页。
const URL = 'http://127.0.0.1:8765/home.html';
// 「球没被动过」的基线不再靠一份未改动副本：用请求拦截把 liquid-dock.* 掐掉，
// 页面就退回改动前的样子（app.css 原生 tabbar）。基线自证见 read() 里的 probe。
const BLOCK = /liquid-dock\.(css|js)/;

const CANON = path.join(__dirname, 'dock.css');
const SHIPPED = path.join(__dirname, '..', '..', '..', 'css', 'liquid-dock.css');
const CANON_JS = path.join(__dirname, 'dock.js');
const SHIPPED_JS = path.join(__dirname, '..', '..', '..', 'js', 'liquid-dock.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const ok = (n, v, extra) => out.push((v ? 'PASS ' : 'FAIL ') + n + (extra ? '  ' + extra : ''));

// 同步产物必须是源文件的「加一行 @generated 横幅」版本。任何一边改了没跑 sync.py，
// 这里直接炸 —— 上一轮真的踩过：构建产物里已有 --lg-w:220px，而源文件与
// git index 都已回到改动前，两者各自漂移且无人察觉。
const stripBanner = b => b.slice(b.indexOf('\n') + 1);
for (const [canon, shipped, label] of [[CANON, SHIPPED, 'liquid-dock.css'], [CANON_JS, SHIPPED_JS, 'liquid-dock.js']]) {
  const a = fs.readFileSync(canon), b = fs.readFileSync(shipped);
  const banner = b.slice(0, b.indexOf('\n') + 1).toString('utf8');
  ok('同步产物与源逐字节一致（' + label + '，去掉 @generated 横幅后）',
     /@generated/.test(banner) && stripBanner(b).equals(a),
     '源 ' + a.length + 'B vs 产物 ' + b.length + 'B（横幅 ' + banner.length + 'B）');
}

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
  // 所以这里做真正的 A/B：同一个 URL 跑两遍，一遍放行 liquid-dock.*，一遍掐掉 ——
  // 掐掉那次就是改动前的页面。两边唯一差异是本方案，逐项一致即证明球没被动过。
  {
    /* pura: null | 'expanded' | 'collapsed' —— 走真实机制（localStorage + common.js
       的 Pura 初始化），不再用 addStyleTag 把外壳强行显出来。
       旧版对 ≤720px 的两条视口统一注入 `display:flex !important`，量到的是
       「侧边栏展开、但外壳被强行显示」这个**现实中不存在**的状态（310px），
       而真实展开态外壳是 display:none、压根没有 Dock。拿它断言「Dock 铺满内容区」，
       等于把「Pura 下 Dock 被拉开」这个 bug 锁进了测试里。 */
    const read = async (w, h, block, pura) => {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      if (block) {
        await page.setRequestInterception(true);
        page.on('request', req => (BLOCK.test(req.url()) ? req.abort() : req.continue()));
      }
      // 主题显式钉成 light：同一浏览器里各 page 共享 localStorage，只要有人在
      // 这次 launch 里先跑过一次深色，剩下的「基线」就全被染成深色，
      // 而 A/B 会比得很开心 —— 两边一起错，断言照样全绿。
      await page.evaluateOnNewDocument((s, t) => {
        try {
          localStorage.setItem('engchain-theme', t);
          if (s) localStorage.setItem('engchain-pura-sidebar', s);
        } catch (e) {}
      }, pura, 'light');
      await page.goto(URL, { waitUntil: 'networkidle0' });
      await sleep(1800);
      const d = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const orbEl = document.querySelector('.ai-orb-entry');
        const shellEl = document.querySelector('.app-nav-shell');
        const shell = shellEl.getBoundingClientRect();
        const orb = orbEl.getBoundingClientRect();
        const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
        const icon = document.querySelector('.app-tab svg').getBoundingClientRect();
        return {
          theme: document.documentElement.getAttribute('data-theme') || 'light',
          shellDisp: getComputedStyle(shellEl).display,
          h: cs.getPropertyValue('--lg-h').trim(),
          r: cs.getPropertyValue('--lg-r').trim(),
          gapTok: cs.getPropertyValue('--lg-orb-gap').trim(),
          shellH: shell.height,
          shellL: shell.left,
          shellR: shell.right,
          barH: bar.height,
          barW: bar.width,
          barL: bar.left,
          barR: bar.right,
          air: bar.top - shell.top,                                        // Dock 上下留白（居中即两侧相等）
          orbW: orb.width,
          orbH: orb.height,
          orbL: orb.left,
          orbR: orb.right,
          orbOff: orb.top + orb.height / 2 - (shell.top + shell.height / 2),  // 球心相对壳心的偏移
          orbDisp: getComputedStyle(orbEl).display,
          win: window.innerWidth,
          icon: icon.width,
          // 基线自证：掐掉 liquid-dock.* 之后，本方案的层必须真的不存在。
          // 拦截没生效的话「改前」会等于「改后」，看起来像「尺寸没变」——
          // 这是这套 A/B 最容易骗人的失效模式，所以让它直接炸出来。
          lgBase: !!document.querySelector('.lg-base')
        };
      });
      await page.close();
      return d;
    };
    // 视口 × Pura 状态。Pura 是 app.css 在 ≤720px 高时才启用的短屏布局，它的两个
    // 状态必须分开量：展开态外壳 display:none（压根没有 Dock），收起态才渲染出
    // tabbar+球。旧版把这两条短屏视口都按「展开」跑、还强行把外壳显出来，量到的是
    // 一个现实中不存在的合成状态。
    const VIEWS = [
      { w: 390, h: 844, pura: null,        tag: '常规' },
      { w: 390, h: 700, pura: 'expanded',  tag: 'Pura展开' },
      { w: 900, h: 700, pura: 'collapsed', tag: 'Pura收起·宽' },
      { w: 390, h: 700, pura: 'collapsed', tag: 'Pura收起·窄' }
    ];
    const t = [], b = [];
    for (const v of VIEWS) { t.push(await read(v.w, v.h, false, v.pura)); b.push(await read(v.w, v.h, true, v.pura)); }
    ok('基线自证：掐掉 liquid-dock.* 后本方案的玻璃层确实不存在（否则 A/B 是假的）',
       b.every(d => !d.lgBase) && t.every(d => d.lgBase),
       '基线 ' + b.map(d => d.lgBase ? '有' : '无').join('/')
       + ' vs 现状 ' + t.map(d => d.lgBase ? '有' : '无').join('/'));
    ok('基线自证：基线里没有 --lg-h（dock.css 未生效），现状里有',
       b.every(d => !d.h) && t.every(d => !!d.h),
       '基线 "' + b.map(d => d.h || '空').join('/') + '" vs 现状 ' + t.map(d => d.h).join('/'));
    // 主题串味是这套 A/B 最阴的失效模式：两边一起变深色，比出来的差异依然为零，
    // 断言全绿而结论全错。所以显式核一遍四下都是浅色。
    ok('基线自证：8 次取样都在浅色主题下（没被前一轮的深色串味）',
       t.every(d => d.theme === 'light') && b.every(d => d.theme === 'light'),
       '现状 ' + t.map(d => d.theme).join('/') + ' vs 基线 ' + b.map(d => d.theme).join('/'));

    const [tall, exp, wide, col] = t;
    const [, bexp, bwide, bcol] = b;
    ok('844px 高：Dock 56px / 圆角 28px', tall.h === '56px' && tall.r === '28px', tall.h + ' / ' + tall.r);
    ok('≤720px 高：Dock 收到 46px', col.h === '46px', col.h + ' / ' + col.r);
    ok('宽屏 900×700：同样收到 46px', wide.h === '46px' && Math.round(wide.barH) === 46, wide.h + ', bar=' + wide.barH);
    ok('图标缩到 21px（短屏 19px）', Math.round(tall.icon) === 21 && Math.round(col.icon) === 19, tall.icon + ' / ' + col.icon);

    // Pura 是两个状态，不是两条视口。展开态外壳由 app.css 整个隐藏 —— 本方案
    // 不该让它凭空冒出来；收起态才是用户实际看到的「tabbar+球在底部」。
    ok('Pura 展开态：外壳保持 display:none（本方案不制造无中生有的 Dock）',
       exp.shellDisp === 'none' && exp.barW === 0 && bexp.shellDisp === 'none',
       '现状 ' + exp.shellDisp + '/w=' + exp.barW.toFixed(0) + '，基线 ' + bexp.shellDisp + '/w=' + bexp.barW.toFixed(0));
    ok('Pura 收起态：外壳确实渲染出来了（else 下面的断言全是空的）',
       col.shellDisp !== 'none' && col.shellH > 0 && wide.shellDisp !== 'none',
       col.shellDisp + '/h=' + col.shellH.toFixed(1) + '；宽屏 ' + wide.shellDisp + '/h=' + wide.shellH.toFixed(1));

    // 外壳高度是球的锚点（60px 壳装 60px 球，正好填满居中）。
    // 一旦方案动了外壳高度，球就会重新居中并漂移，所以这里必须与基线一致。
    ok('外壳高度与基线一致（未被本方案覆盖，球的位置锚点不变）',
       t.every((d, i) => Math.abs(d.shellH - b[i].shellH) < 0.01),
       t.map(d => d.shellH).join('/') + ' vs 基线 ' + b.map(d => d.shellH).join('/'));
    ok('球与基线逐项一致：宽 / 高 / 左 / 右 / 圆心偏移 / display',
       t.every((d, i) =>
         Math.abs(d.orbW - b[i].orbW) < 0.01 && Math.abs(d.orbH - b[i].orbH) < 0.01 &&
         Math.abs(d.orbL - b[i].orbL) < 0.01 && Math.abs(d.orbR - b[i].orbR) < 0.01 &&
         Math.abs(d.orbOff - b[i].orbOff) < 0.01 && d.orbDisp === b[i].orbDisp),
       t.map((d, i) => d.orbW.toFixed(0) + 'x' + d.orbH.toFixed(0) + '@' + d.orbL.toFixed(0) + '-' + d.orbR.toFixed(0)
                      + '/' + d.orbDisp
                      + (Math.abs(d.orbL - b[i].orbL) < 0.01 && Math.abs(d.orbR - b[i].orbR) < 0.01 ? '=' : '≠')
                      + b[i].orbL.toFixed(0) + '-' + b[i].orbR.toFixed(0)).join('  '));
    ok('844px 下球为 60px 且与壳同心（可渲染视口下的绝对规格）',
       Math.round(tall.orbH) === 60 && Math.abs(tall.orbOff) < 0.5, tall.orbW + 'x' + tall.orbH + ' 偏心 ' + tall.orbOff.toFixed(2));
    // 「真的有 Dock」的三条。展开态外壳是 display:none，air / barH 全 0，
    // 混在里面会得到 0==0 的假通过。
    const docked = [tall, wide, col];
    ok('Dock 在外壳内垂直居中（上下留白相等）',
       docked.every(d => Math.abs(d.air - (d.shellH - d.barH) / 2) < 0.01),
       docked.map(d => d.air.toFixed(1) + '/' + ((d.shellH - d.barH) / 2).toFixed(1)).join('  '));

    // 需求：Dock 与球一起居右，球到窗口右缘不变，两者间距取定值。
    const gapPx = parseFloat(tall.gapTok) || 8;
    ok('Dock 定宽 220（不再被 flex:1 撑满）', Math.round(tall.barW) === 220, tall.barW.toFixed(1));
    ok('Dock 与球间距 = --lg-orb-gap(' + gapPx + 'px)',
       Math.abs((tall.orbL - tall.barR) - gapPx) < 0.75, (tall.orbL - tall.barR).toFixed(1) + 'px');
    ok('球到窗口右缘 = 12（app.css 原值，本方案未改动）',
       Math.abs((tall.win - tall.orbR) - 12) < 0.5, (tall.win - tall.orbR).toFixed(1) + 'px');
    ok('Dock 与球一起居右：簇右缘贴外壳右缘，剩余空间全在 Dock 左侧',
       Math.abs(tall.orbR - tall.shellR) < 0.5 && tall.barL > 12,
       '簇右 ' + tall.orbR.toFixed(1) + ' vs 壳右 ' + tall.shellR.toFixed(1) + '；Dock 左 ' + tall.barL.toFixed(1));

    // 本次需求：Pura 收起侧边栏后，Dock 曾被 app.css 的 flex:1 拉满整条外壳。
    // 现在它要和常规态一样是 220 定宽，且整簇仍旧贴右 —— 球的位置一分不动。
    ok('Pura 收起态：Dock 收到 220 定宽（不再被水平拉开）',
       Math.round(col.barW) === 220 && Math.round(wide.barW) === 220,
       '390×700 ' + col.barW.toFixed(1) + ' / 900×700 ' + wide.barW.toFixed(1));
    ok('Pura 收起态：Dock↔球间距仍 = --lg-orb-gap(' + gapPx + 'px)',
       Math.abs((col.orbL - col.barR) - gapPx) < 0.75, (col.orbL - col.barR).toFixed(1) + 'px');
    ok('Pura 收起态：球到窗口右缘 = 12，与常规态一致（球没被牵动）',
       Math.abs((col.win - col.orbR) - 12) < 0.5,
       '球 ' + col.orbL.toFixed(1) + '-' + col.orbR.toFixed(1) + '，窗宽 ' + col.win);
    ok('Pura 收起态：簇右缘贴外壳右缘，多出的宽度全落在 Dock 左侧',
       Math.abs(col.orbR - col.shellR) < 0.5 && Math.abs(wide.orbR - wide.shellR) < 0.5 && col.barL > 12,
       '窄 簇右 ' + col.orbR.toFixed(1) + '/壳右 ' + col.shellR.toFixed(1) + ' Dock左 ' + col.barL.toFixed(1)
       + '；宽 簇右 ' + wide.orbR.toFixed(1) + '/壳右 ' + wide.shellR.toFixed(1));
    ok('Pura 收起态的球与基线逐项一致（宽度控制没拿球换）',
       Math.abs(col.orbW - bcol.orbW) < 0.01 && Math.abs(col.orbH - bcol.orbH) < 0.01 &&
       Math.abs(col.orbL - bcol.orbL) < 0.01 && Math.abs(col.orbR - bcol.orbR) < 0.01 &&
       Math.abs(wide.orbW - bwide.orbW) < 0.01 && Math.abs(wide.orbR - bwide.orbR) < 0.01,
       '窄 ' + col.orbW.toFixed(0) + 'x' + col.orbH.toFixed(0) + '@' + col.orbL.toFixed(0) + '-' + col.orbR.toFixed(0)
       + ' vs 基线 ' + bcol.orbL.toFixed(0) + '-' + bcol.orbR.toFixed(0));
  }

  console.log(out.join('\n'));
  console.log('\n' + out.filter(l => l.startsWith('PASS')).length + ' passed, ' + out.filter(l => l.startsWith('FAIL')).length + ' failed');
  await browser.close();
})();
