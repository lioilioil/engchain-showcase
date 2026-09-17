/* 通用：把本地对照页拍成一张整页 PNG。
   用法： node shot.js <对照页.html 绝对路径> <输出.png> [宽度]
   走 file:// 而不是 setContent —— setContent 没有 base URL，页内相对 src 会解析失败，
   之前就是栽在这里（图片全白）。 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const [, , html, out, w] = process.argv;
if (!html || !out) {
  console.error('用法: node shot.js <html> <png> [width]');
  process.exit(1);
}
const W = Number(w) || 860;
const toUrl = p => 'file:///' + path.resolve(p).split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 900, deviceScaleFactor: 2 });
  await page.goto(toUrl(html), { waitUntil: 'networkidle0' });
  await sleep(700);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: W, height: h, deviceScaleFactor: 2 });
  await sleep(400);
  await page.screenshot({ path: path.resolve(out) });
  await browser.close();
  console.log('OK -> ' + path.resolve(out) + '  (' + h + 'px tall)');
})();
