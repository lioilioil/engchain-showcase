/* 需求：Dock 与球一起居右，球到窗口右缘不变，Dock↔球 的间距取一个确定值。
   产出 4 个间距候选的同框对照图 + 实测表，供决策。

   关键不变量（本方案能让「球不动」变成可证明的事）：
   Dock 定宽 220 + margin-left:auto ⇒ 左侧 auto 外边距吃掉全部剩余空间，
   于是 球左 = 外壳右 - 60 恒成立，与 gap 取值完全无关。
   所以调间距只移动 Dock，球的位置在数学上就不可能变。 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const OUT = path.join(__dirname, '_gap');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CAND = [
  ['现状', null],
  ['A 6px', 6],
  ['B 8px（外壳原生 gap）', 8],
  ['C 10px', 10],
  ['D 12px（= 外边距）', 12]
];

const rightAlign = g => `
.phone:not(.has-pura-sidebar) .app-tabbar{
  margin-left: auto !important; margin-right: 0 !important;
}
.phone:not(.has-pura-sidebar) .app-nav-shell{ gap: ${g}px !important; }
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });

  const rows = [];
  for (const [label, g] of CAND) {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(2400);
    if (g !== null) await page.addStyleTag({ content: rightAlign(g) });
    await sleep(500);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.app-tabbar').getBoundingClientRect();
      const orb = document.querySelector('.ai-orb-entry').getBoundingClientRect();
      const shell = document.querySelector('.app-nav-shell').getBoundingClientRect();
      const lens = document.querySelector('.tab-glass').getBoundingClientRect();
      return {
        barL: bar.left, barR: bar.right, barW: bar.width,
        orbL: orb.left, orbR: orb.right, orbW: orb.width,
        shellTop: shell.top, shellH: shell.height,
        lensL: lens.left, lensW: lens.width,
        win: window.innerWidth
      };
    });
    const file = 'gap_' + (g === null ? 'now' : g) + '.png';
    await page.screenshot({
      path: path.join(OUT, file),
      clip: { x: 0, y: m.shellTop - 12, width: m.win, height: m.shellH + 24 }
    });
    await page.close();
    rows.push({ label, g, file, ...m, mid: m.orbL - m.barR, right: m.win - m.orbR, airL: m.barL });
    process.stdout.write('.');
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows, null, 2));

  // 合成对照页
  fs.writeFileSync(path.join(OUT, 'compare.html'), `<!doctype html><meta charset="utf-8">
<style>
 body{margin:0;background:#F2F2F4;font:13px/1.55 "Segoe UI",system-ui,sans-serif;color:#1A1A1A;padding:18px 20px 24px}
 h1{font-size:14px;font-weight:700;margin:0 0 2px}
 .sub{font-size:12px;color:#6A6A6A;margin:0 0 16px}
 .row{margin:0 0 14px}
 .tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.03em;color:#5A4A28;background:#EFE3C8;border-radius:5px;padding:2px 7px;margin-bottom:5px;margin-right:6px}
 .tag.pick{background:#D8E6F2;color:#26445E}
 .tag.now{background:#E4E4E8;color:#55555F}
 .shot{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.16)}
 .shot img{display:block;width:100%}
 table{border-collapse:collapse;font-size:12px;margin-top:6px;width:100%}
 th,td{text-align:left;padding:5px 12px 5px 0;border-bottom:1px solid #E2E2E6;font-variant-numeric:tabular-nums}
 th{font-weight:600;color:#6A6A6A;font-size:11px}
 .hi{color:#1F6B3A;font-weight:600}
 .note{font-size:11.5px;color:#6A6A6A;margin-top:12px;line-height:1.6}
</style>
<h1>Dock 与球 · 居右 + 间距候选</h1>
<p class="sub">iPhone 390×844 · 3× · 同一裁切框（整条底栏全宽，含窗口左右边缘）</p>
${rows.map(r => `<div class="row">
  <span class="tag ${r.g === null ? 'now' : (r.g === 8 ? 'pick' : '')}">${r.label}</span>
  <span class="tag">Dock↔球 ${r.mid.toFixed(1)} · 球→右缘 ${r.right.toFixed(1)} · 左侧留白 ${r.airL.toFixed(1)}</span>
  <div class="shot"><img src="${r.file}"></div>
</div>`).join('')}
<table>
 <tr><th>方案</th><th>Dock 左</th><th>Dock↔球</th><th>球右→窗口右</th><th>球 左/右</th><th>Dock 宽</th></tr>
 ${rows.map(r => `<tr><td>${r.label}</td><td>${r.airL.toFixed(1)}</td><td class="hi">${r.mid.toFixed(1)}</td><td class="hi">${r.right.toFixed(1)}</td><td>${r.orbL.toFixed(1)} / ${r.orbR.toFixed(1)}</td><td>${r.barW.toFixed(1)}</td></tr>`).join('')}
</table>
<p class="note">球到窗口右缘 12px 是 app.css 给外壳的 <code>right:12px</code>，本方案不碰外壳定位，所以每一行都恒为 12.0。<br>
球的左/右边缘在 5 个方案里逐像素相同 —— 调间距只移动 Dock，球在数学上不可能被带动。</p>`);

  const f = v => v.toFixed(1);
  console.log('\n方案'.padEnd(24) + 'Dock左'.padStart(9) + 'Dock↔球'.padStart(10) + '球→右缘'.padStart(10) + '球左/右'.padStart(16) + 'Dock宽'.padStart(9));
  console.log('-'.repeat(80));
  for (const r of rows) {
    console.log(r.label.padEnd(24) + f(r.airL).padStart(9) + f(r.mid).padStart(10) + f(r.right).padStart(10)
      + (f(r.orbL) + '/' + f(r.orbR)).padStart(16) + f(r.barW).padStart(9));
  }
  const widths = new Set(rows.map(r => r.barW.toFixed(2)));
  const orbPos = new Set(rows.map(r => r.orbL.toFixed(2) + '/' + r.orbR.toFixed(2)));
  console.log('\n自检：Dock 宽度取值集合 ' + [...widths].join(',') + (widths.size === 1 ? '  ✓ 定宽未被 gap 影响' : '  ✗ 宽度随 gap 变了，透镜会失准'));
  console.log('自检：球位置集合 ' + [...orbPos].join(',') + (orbPos.size === 1 ? '  ✓ 球纹丝不动' : '  ✗ 球被带动了'));
  console.log('对照页 -> ' + path.join(OUT, 'compare.html'));
})();
