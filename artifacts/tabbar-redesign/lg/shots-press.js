/* 出图：亮/暗 × 静置/按下 四张同裁剪的条区特写，外加 Pura 收起态。
   同裁剪才有可比性 —— 之前那组里 rest 和 pressed 用了不同的裁剪和不同的
   选中项，叠看会得出错误结论。

   用法: node shots-press.js      需要 http://127.0.0.1:8765/ */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home.html';
const OUT = path.join(__dirname, '_shots2');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const open = async (w, h, theme, pura) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 3 });
    // 主题必须显式钉死，不能用「不写就是浅色」：同一浏览器里各 page 共享
    // localStorage，前一轮写的 dark 会被后一轮继承 —— 浅色那组就是这样被
    // 染成深色的，出图时看着「也对」，实际整组作废。
    await page.evaluateOnNewDocument((t, p) => {
      try {
        localStorage.setItem('engchain-theme', t || 'light');
        if (p) localStorage.setItem('engchain-pura-sidebar', p);
      } catch (e) {}
    }, theme, pura);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2000);
    // 自证主题真的切了 —— 不然截出来是一张「深色玻璃盖在浅色页面上」的废图
    const st = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      pageBg: getComputedStyle(document.body).backgroundColor,
      lgAlpha: (getComputedStyle(document.querySelector('.lg-base')).backgroundImage.match(/rgba\([^)]*\)/g) || [])
        .map(m => m.split(',')[3]).join(',')
    }));
    return { page, st };
  };

  // 裁剪固定为「条上下各留 48/20px」，并夹进视口 —— 超出视口的部分
  // puppeteer 不会报错，只会给你一张缺角的图
  const shot = async (page, file, pad = 48) => {
    const b = await page.evaluate(() => {
      const r = document.querySelector('.app-tabbar').getBoundingClientRect();
      const o = document.querySelector('.ai-orb-entry').getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, ol: o.left, or: o.right };
    });
    const vp = page.viewport();
    const x = Math.max(0, Math.floor(b.l - pad));
    const y = Math.max(0, Math.floor(b.t - pad));
    const x2 = Math.min(vp.width, Math.ceil(b.or + pad));
    const y2 = Math.min(vp.height, Math.ceil(b.b + 20));
    await page.screenshot({ path: path.join(OUT, file),
      clip: { x, y, width: x2 - x, height: y2 - y } });
    return { w: (x2 - x), h: (y2 - y), barW: +(b.r - b.l).toFixed(1), dock: x + '/' + y };
  };

  for (const [theme, label] of [[null, 'light'], ['dark', 'dark']]) {
    const { page, st } = await open(390, 844, theme);
    console.log('[' + label + '] data-theme=' + st.theme + '  pageBg=' + st.pageBg + '  lgAlpha=' + st.lgAlpha);
    const g1 = await shot(page, 'rest-' + label + '.png');
    const b = await page.evaluate(() => {
      const r = document.querySelector('.app-tabbar').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await sleep(500);
    const g2 = await shot(page, 'press-' + label + '.png');
    await page.mouse.up();
    console.log('  rest  ' + g1.w + 'x' + g1.h + '  barW=' + g1.barW
      + '   press ' + g2.w + 'x' + g2.h);
    await page.close();
  }

  // Pura 收起态（本次的宽度控制）
  for (const [theme, label] of [[null, 'light'], ['dark', 'dark']]) {
    const { page, st } = await open(390, 700, theme, 'collapsed');
    const cls = await page.evaluate(() => document.querySelector('.phone').className);
    const g = await shot(page, 'pura-collapsed-' + label + '.png', 24);
    console.log('[Pura 收起 · ' + label + '] data-theme=' + st.theme + '  pageBg=' + st.pageBg
      + '  ' + cls + '  barW=' + g.barW);
    await page.close();
  }

  await browser.close();
  console.log('\n图在 ' + OUT);
})();
