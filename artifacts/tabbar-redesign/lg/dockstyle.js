/* 死代码清理的主判据：计算样式比对。

为什么不用像素做判据：实测同一份 CSS 连拍，Dock 区域仍会有最大 3/255 的全局抖动
（合成层面的细微差别，不是随机噪声也不是首帧问题，预热也压不掉）。
拿它当判据，"前后相同"会被这 3/255 直接证伪，只能退化成"差异够小"，那就没劲了。

计算样式没有这个问题 —— 它是确定的。而且它测的正是要害：
app.css 里那些被删的规则如果真的死了（被 liquid-dock.css 完整覆盖），
那么删掉之后 .app-tabbar / ::before / ::after / .tab-glass 的**全部**计算属性
都不该有任何变化。任何一条变了，就说明删到了活代码。

用法: node dockstyle.js <before|after>
      两次输出 _style/<阶段>.json，再用 diff-style.js 比对。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const stage = process.argv[2];
if (stage !== 'before' && stage !== 'after') {
  console.error('用法: node dockstyle.js <before|after>');
  process.exit(2);
}

const BASE = 'http://127.0.0.1:8765/';
const CASES = [
  ['home.html', 'light', 'home-light'],
  ['home.html', 'dark', 'home-dark'],
  ['pages/supply/list.html', 'light', 'supply-light'],
  ['pages/supply/list.html', 'dark', 'supply-dark'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '_style');

// 排除由 JS 在运行时写入的自定义属性（dock.css 里自己标注了「由 JS 写入」）。
// 它们是运行时状态而非级联结果：实测连跑两次，9328 条里唯一变化的就是
// --lg-so（50% ↔ 0%，取决于透镜定位的时机）。留着会把噪声引进判据。
const JS_WRITTEN = ['--lg-sq', '--lg-sqy', '--lg-so'];

// 把 CSSStyleDeclaration 摊平成 {属性: 值}。用索引遍历而不是 for...of，
// 因为 Chrome 对伪元素返回的声明对象不保证可迭代。
const DUMP = `(function(){
  const SKIP = ${JSON.stringify(JS_WRITTEN)};
  const el = document.querySelector('.app-tabbar');
  const glass = document.querySelector('.tab-glass');
  const out = {};
  for (const [name, node, pseudo] of [
      ['tabbar', el, null], ['tabbar::before', el, '::before'],
      ['tabbar::after', el, '::after'], ['tab-glass', glass, null]]) {
    if (!node) { out[name] = null; continue; }
    const cs = getComputedStyle(node, pseudo);
    const o = {};
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      if (SKIP.indexOf(p) >= 0) continue;
      o[p] = cs.getPropertyValue(p);
    }
    out[name] = o;
  }
  return out;
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const result = {};
  for (const [rel, theme, tag] of CASES) {
    const page = await browser.newPage();
    await page.goto(BASE + rel, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('engchain-theme', t); } catch (e) {}
    }, theme);
    await sleep(1200);
    result[tag] = await page.evaluate(DUMP);
    await page.close();
    process.stdout.write('.');
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, stage + '.json'), JSON.stringify(result, null, 1));
  const n = Object.values(result).reduce((s, c) =>
    s + Object.values(c).filter(Boolean).reduce((t, o) => t + Object.keys(o).length, 0), 0);
  console.log('\n' + stage + ': ' + CASES.length + ' 个页面 × 4 个目标，共 ' + n + ' 条计算属性');
})();
