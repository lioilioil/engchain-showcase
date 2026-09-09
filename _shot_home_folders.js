const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: PROFILE, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 900 }, protocolTimeout: 60000
  });
  const p = await browser.newPage();
  await p.goto('file:///D:/Engchain3.0/home.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  /* 定位金刚区并滚动到可见 */
  await p.evaluate(() => {
    const item = document.querySelector('.folder-item[data-href="pages/agency/index.html"]');
    if (item) item.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: 'C:/Users/36434/DoubaoWork/chats/2026-09-09/new-chat/06_金刚区_服务广场命名.png' });
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(2); });
