/* 透光率与阴影的客观 A/B。
   同一页面、同一时刻，用 addStyleTag 把「改动前的取值」覆盖回去再测一次，
   排除环境差异，得到的是纯粹的改动前后对比。

   透光率：在 Dock 正后方铺一块左白右黑的高对比测试底，比较玻璃内外的黑白落差。
           1.0 = 完全透明（背景原样穿过），0.0 = 完全不透。
   阴影  ：量 Dock 下缘外侧一条带的亮度，再关掉 box-shadow 量一次；
           两次之差就是投影真正压暗了多少。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_metrics');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 改动前的取值（A/B 对照用）
const OLD = `
.lg-base{background:linear-gradient(180deg,rgba(255,255,255,.36) 0%,rgba(255,255,255,.17) 42%,rgba(255,255,255,.13) 64%,rgba(255,255,255,.28) 100%) !important;
  -webkit-backdrop-filter:blur(26px) saturate(190%) brightness(1.02) !important; backdrop-filter:blur(26px) saturate(190%) brightness(1.02) !important;}
.lg-spec{box-shadow: inset 0 1.5px 1px rgba(255,255,255,.78), inset 0 -1px 2px rgba(255,255,255,.22),
  inset 0 0 0 1px rgba(255,255,255,.34), 0 16px 44px rgba(22,22,22,.20), 0 5px 16px rgba(22,22,22,.10) !important;}
.tg-spec{background:linear-gradient(180deg,rgba(255,255,255,.36) 0%,rgba(255,255,255,.04) 48%,rgba(255,255,255,.05) 76%,rgba(255,255,255,.15) 100%) !important;
  box-shadow: inset 0 1.5px 1.5px rgba(255,255,255,.96), inset 0 -4px 7px -3px rgba(138,126,102,.22),
  inset 0 0 0 1px rgba(255,255,255,.62), 0 7px 20px rgba(22,22,22,.15), 0 1px 2px rgba(22,22,22,.07) !important;}
`;
const NO_SHADOW = `.lg-spec,.tg-spec{box-shadow:none !important}`;

const STAGE = 80;   // 测试底向上超出 Dock 的高度，用于取「玻璃外」参照

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  async function open(css) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(3000);
    if (css) { await page.addStyleTag({ content: css }); await sleep(900); }
    return page;
  }

  // ---------- 透光率 ----------
  async function transmission(label, css) {
    const page = await open(css);
    // 测试底必须是 .app-nav-shell 的兄弟节点：只有同一层叠上下文里 z-index 才可比。
    // 挂到 body 上会被 .phone 的层叠上下文整体压下去或整个翻上来。
    const pos = await page.evaluate((stage) => {
      const shell = document.querySelector('.app-nav-shell');
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;z-index:49;pointer-events:none;'
        + 'height:' + Math.round(bar.height + stage) + 'px;'
        + 'background:linear-gradient(90deg,#fff 0 50%,#000 50% 100%);';
      shell.parentNode.insertBefore(d, shell);
      const r = bar;
      return { top: r.top, h: r.height, left: r.left, w: r.width };
    }, STAGE);
    await sleep(700);
    const yIn = pos.top + pos.h / 2;
    const yOut = pos.top - 40;
    const clip = (y) => ({ x: pos.left + 30, y: y - 1, width: pos.w - 60, height: 3 });
    await page.screenshot({ path: path.join(OUT, 'trans_' + label + '_in.png'), clip: clip(yIn) });
    await page.screenshot({ path: path.join(OUT, 'trans_' + label + '_out.png'), clip: clip(yOut) });
    await page.close();
  }

  // ---------- 阴影 ----------
  async function shadow(label, css) {
    const page = await open(css);
    const r = await page.evaluate(() => {
      const q = document.querySelector('.app-tabbar').getBoundingClientRect();
      return { x: q.left, y: q.top, w: q.width, h: q.height };
    });
    const clip = { x: r.x + 10, y: r.y + r.h, width: r.w - 20, height: 30 };
    await page.screenshot({ path: path.join(OUT, 'shadow_' + label + '.png'), clip });
    await page.close();
  }

  for (const [label, css] of [['new', null], ['old', OLD]]) {
    await transmission(label, css);
    await shadow(label + '-shadow', css);
    await shadow(label + '-noshadow', (css || '') + NO_SHADOW);
  }

  await browser.close();
  console.log('done -> ' + OUT);
})();
