/* 静止时到底还在不在画？
   直接数 WebGL drawArrays 调用次数：静置 2 秒前后各取一次计数。
   事件驱动的循环应当计数完全不变（= 真的停了）。 */
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
  await page.evaluateOnNewDocument(() => {
    window.__draws = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = orig.call(this, type, ...rest);
      if (ctx && /webgl/i.test(type) && ctx.drawArrays && !ctx.__wrapped) {
        ctx.__wrapped = true;
        const d = ctx.drawArrays.bind(ctx);
        ctx.drawArrays = (...a) => { window.__draws++; return d(...a); };
      }
      return ctx;
    };
  });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(3000);                       // 等入场动画结束，进入静止

  const a = await page.evaluate(() => window.__draws);
  await sleep(2000);
  const b = await page.evaluate(() => window.__draws);
  console.log('静置 2s 内 drawArrays 次数: ' + (b - a) + '   (累计 ' + b + ')');
  console.log((b - a) === 0 ? 'PASS 静止时不重绘（循环已自停）' : 'FAIL 静止时仍在重绘');

  // 指针移动 → 应当醒来重绘
  const r = await page.evaluate(() => { const q = document.querySelector('.app-tabbar').getBoundingClientRect(); return { x: q.left + 20, y: q.top + q.height / 2 }; });
  await page.mouse.move(r.x, r.y);
  await page.mouse.move(r.x + 40, r.y);
  await sleep(400);
  const c = await page.evaluate(() => window.__draws);
  console.log('指针移动后: +' + (c - b) + ' 次');
  console.log((c - b) > 0 ? 'PASS 指针移动唤醒重绘' : 'FAIL 指针移动未唤醒');

  // 指针移出并静置 → 再次停下
  await page.mouse.move(5, 5);
  await sleep(600);
  const d = await page.evaluate(() => window.__draws);
  await sleep(1500);
  const e = await page.evaluate(() => window.__draws);
  console.log('再次静置 1.5s: +' + (e - d) + ' 次');
  console.log((e - d) === 0 ? 'PASS 事件结束后重新自停' : 'FAIL 仍在持续重绘');

  await browser.close();
})();
