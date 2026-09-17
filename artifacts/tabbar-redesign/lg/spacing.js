/* 需求 1 的量化：图标尺寸 / 图标中心间距 / Dock 尺寸 / 选中玻璃块尺寸。
   用 addStyleTag 把旧值打回去当对照组，避免「凭感觉说变小了」。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_spacing');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 需求 1 之前的原值（Dock 64 / 图标 24 / 内边距 8 / 外边距 10 / 透镜内缩 5）
const OLD = `
:root{ --lg-h:64px; --lg-r:32px; --lg-lens-inset:5px; --lg-lens-r:27px; }
.app-tabbar{ margin:0 10px !important; padding:0 8px !important; }
.app-tab svg{ width:24px !important; height:24px !important; }
.app-tab .badge, .app-tab.active .badge{ top:2px !important; }
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const measure = async (label, css) => {
    const page = await browser.newPage();
    // 必须在页面脚本之前注入：common.js 的 positions[]（透镜的 left/width）
    // 只在 initTabbarGlass 里量一次，之后不随 resize 重测。
    // 若等页面加载完再 addStyleTag，Tab 宽度变了但透镜宽度仍是旧值，
    // 「改前」那一列就会量出一个假的 61px。所以这里用 evaluateOnNewDocument
    // 把对照 CSS 塞在 dock.css 之后、common.js 之前。
    if (css) {
      await page.evaluateOnNewDocument(c => {
        const s = document.createElement('style');
        s.textContent = c;
        document.documentElement.appendChild(s);
      }, css);
    }
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2600);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const shell = document.querySelector('.app-nav-shell').getBoundingClientRect();
      const orb = document.querySelector('.ai-orb-entry').getBoundingClientRect();
      const tabs = [...document.querySelectorAll('.app-tab')].map(t => {
        const r = t.getBoundingClientRect();
        return r.left + r.width / 2;
      });
      const icon = document.querySelector('.app-tab svg').getBoundingClientRect();
      const gaps = tabs.slice(1).map((c, i) => c - tabs[i]);
      return {
        barL: bar.left, barR: bar.right, barW: bar.width, barH: bar.height,
        shellTop: shell.top, shellH: shell.height, orbR: orb.right,
        barTopAir: bar.top - shell.top,
        lensW: document.querySelector('.tab-glass').getBoundingClientRect().width,
        lensH: document.querySelector('.tab-glass').getBoundingClientRect().height,
        icon: icon.width,
        tabW: document.querySelector('.app-tab').getBoundingClientRect().width,
        padLeft: tabs[0] - bar.left,
        padRight: bar.right - tabs[tabs.length - 1],
        gaps,
        orbW: orb.width, orbH: orb.height,
        orbOff: orb.top + orb.height / 2 - (shell.top + shell.height / 2)
      };
    });
    // 选中态截图（默认停在 index 0）
    await page.screenshot({
      path: path.join(OUT, label + '_dock.png'),
      clip: { x: m.barL - 14, y: m.shellTop - 6, width: (m.orbR - m.barL) + 28, height: m.shellH + 12 }
    });
    await page.close();
    return m;
  };

  const now = await measure('new', '');
  const old = await measure('old', OLD);

  const f = (v, n = 1) => Number(v).toFixed(n);
  const rows = [
    ['Dock 宽 × 高', `${f(old.barW)} × ${f(old.barH)}`, `${f(now.barW)} × ${f(now.barH)}`],
    ['Dock 上下留白', f(old.barTopAir), f(now.barTopAir)],
    ['图标尺寸', f(old.icon), f(now.icon)],
    ['单个 Tab 宽', f(old.tabW), f(now.tabW)],
    ['图标中心间距', old.gaps.map(g => f(g)).join(' / '), now.gaps.map(g => f(g)).join(' / ')],
    ['首图标到 Dock 左缘', f(old.padLeft), f(now.padLeft)],
    ['末图标到 Dock 右缘', f(old.padRight), f(now.padRight)],
    ['选中玻璃块 宽 × 高', `${f(old.lensW)} × ${f(old.lensH)}`, `${f(now.lensW)} × ${f(now.lensH)}`],
    ['右侧球 宽 × 高', `${f(old.orbW)} × ${f(old.orbH)}`, `${f(now.orbW)} × ${f(now.orbH)}`],
    ['球心相对壳心偏移', f(old.orbOff, 2), f(now.orbOff, 2)]
  ];
  const w = [22, 26, 26];
  console.log('指标'.padEnd(w[0]) + '改前'.padEnd(w[1]) + '改后'.padEnd(w[2]) + '变化');
  console.log('-'.repeat(78));
  for (const [k, o, n] of rows) {
    let d = '';
    const ov = parseFloat(o), nv = parseFloat(n);
    if (!isNaN(ov) && !isNaN(nv) && ov !== 0) d = (nv - ov >= 0 ? '+' : '') + f(nv - ov, 1) + '  (' + f((nv - ov) / ov * 100, 1) + '%)';
    console.log(k.padEnd(w[0]) + o.padEnd(w[1]) + n.padEnd(w[2]) + d);
  }
  const spread = a => (a[a.length - 1] - a[0]);
  console.log('\n首末图标跨度：改前 ' + f(old.gaps.reduce((s, g) => s + g, 0)) + 'px → 改后 ' + f(now.gaps.reduce((s, g) => s + g, 0)) + 'px');
  console.log('截图 -> ' + OUT);
  await browser.close();
})();
