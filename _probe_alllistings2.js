const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', userDataDir: PROFILE, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'], defaultViewport: { width: 420, height: 900 }, protocolTimeout: 60000 });
  const p = await browser.newPage();
  await p.goto('file:///D:/Engchain3.0/pages/all-listings.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  const info = await p.evaluate(() => {
    const sec = document.getElementById('sec-agency');
    if (!sec) return { err: 'no sec-agency' };
    const cards = Array.from(sec.querySelectorAll('.card'));
    return { total: cards.length, cards: cards.slice(0, 3).map(c => ({
      title: (c.querySelector('.card-title') || {}).textContent || '',
      meta: (c.querySelector('.card-meta') || {}).textContent || '',
      price: (c.querySelector('.card-price') || {}).textContent || '',
      chips: (c.querySelector('.card-chips') || {}).textContent || '',
      company: (c.querySelector('.card-company') || {}).textContent || '',
      hasCta: !!c.querySelector('.svc-cta'),
      hasGuard: (c.textContent || '').indexOf('资金托管') >= 0,
      href: c.getAttribute('href') || ''
    })) };
  });
  console.log(JSON.stringify(info, null, 2));
  await p.evaluate(() => { const s = document.getElementById('sec-agency'); if (s) s.scrollIntoView({ block: 'start' }); });
  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: 'C:/Users/36434/DoubaoWork/chats/2026-09-09/new-chat/07_all-listings_中介服务卡片.png' });
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(2); });
