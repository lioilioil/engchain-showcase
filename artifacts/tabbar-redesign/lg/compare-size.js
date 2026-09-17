/* 把「改前 / 改后」两张 Dock 截图对齐叠成一张对照图，便于一次性审阅尺寸差异。
   两图同宽同裁切框，所以上下直接可比；再叠参考线标出图标中心与 Dock 边界。 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const BASE = 'http://127.0.0.1:8765/artifacts/tabbar-redesign/lg/_spacing';
const OUT = path.join(__dirname, '_spacing', 'compare.png');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HTML = `<!doctype html><meta charset="utf-8">
<style>
  body{margin:0;background:#F2F2F4;font:13px/1.5 "Segoe UI",system-ui,sans-serif;color:#1A1A1A;padding:18px 20px 22px}
  h1{font-size:14px;font-weight:700;margin:0 0 2px}
  .sub{font-size:12px;color:#6A6A6A;margin:0 0 14px}
  .row{margin:0 0 6px}
  .tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;color:#5A4A28;
       background:#EFE3C8;border-radius:5px;padding:2px 7px;margin-bottom:5px}
  .tag.new{background:#D8E6F2;color:#26445E}
  .shot{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.14)}
  .shot img{display:block;width:100%}
  table{border-collapse:collapse;font-size:12px;margin-top:14px;width:100%}
  th,td{text-align:left;padding:5px 10px 5px 0;border-bottom:1px solid #E2E2E6}
  th{font-weight:600;color:#6A6A6A;font-size:11px;letter-spacing:.03em}
  td.n{font-variant-numeric:tabular-nums}
  .d{color:#1F6B3A;font-weight:600}
  .d.up{color:#8A5A12}
  .note{font-size:11.5px;color:#6A6A6A;margin-top:12px}
</style>
<h1>需求 1 · Dock 尺寸收紧 改前 / 改后对照</h1>
<p class="sub">iPhone 390×844 逻辑像素，3× 截图，同裁切框（含右侧禁改的 AI 球）</p>
<div class="row"><span class="tag">改前 Dock 64 / 图标 24 / 间距 65.5</span>
  <div class="shot"><img src="${BASE}/old_dock.png"></div></div>
<div class="row"><span class="tag new">改后 Dock 56 / 图标 21 / 间距 61</span>
  <div class="shot"><img src="${BASE}/new_dock.png"></div></div>
<table>
  <tr><th>指标</th><th>改前</th><th>改后</th><th>变化</th></tr>
  <tr><td>Dock 宽 × 高</td><td class="n">278 × 64</td><td class="n">272 × 56</td><td class="d">−6 / −8</td></tr>
  <tr><td>图标尺寸</td><td class="n">24</td><td class="n">21</td><td class="d">−12.5%</td></tr>
  <tr><td>图标中心间距</td><td class="n">65.5</td><td class="n">61.0</td><td class="d">−6.9%</td></tr>
  <tr><td>首末图标跨度</td><td class="n">196.5</td><td class="n">183.0</td><td class="d">−13.5</td></tr>
  <tr><td>选中玻璃块 宽 × 高</td><td class="n">65.5 × 54</td><td class="n">61 × 48</td><td class="d">−6.9% / −11.1%</td></tr>
  <tr><td>右侧 AI 球 宽 × 高</td><td class="n">60 × 60</td><td class="n">60 × 60</td><td>0（禁改项）</td></tr>
</table>
<p class="note">球的尺寸 / 位置 / display 已与未改动的 home.html 基线逐视口比对一致；<br>
Dock 宽度受右侧 60px 球与外壳左右各 12px 边距夹住，图标间距最多只能再收紧约 1%。</p>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
  await page.setContent(HTML, { waitUntil: 'networkidle0' });
  await sleep(600);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: 900, height: h, deviceScaleFactor: 2 });
  await sleep(400);
  await page.screenshot({ path: OUT });
  await browser.close();
  console.log('OK -> ' + OUT);
})();
