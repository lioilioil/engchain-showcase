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
  await p.goto('file:///D:/Engchain3.0/pages/franchise/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_fixed_before.png' });
  await p.click('#heroFind');
  await new Promise(r => setTimeout(r, 1800));
  const s = await p.evaluate(() => {
    const sc = document.querySelector('.scroll');
    const phone = document.querySelector('.phone');
    const rr = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    return {
      phoneScrollTop: Math.round(phone.scrollTop),
      navbar: rr(document.querySelector('.navbar')),
      bar: rr(document.getElementById('stickyFilterBar')),
      sheetTop: Math.round(document.getElementById('filterSheet').getBoundingClientRect().top),
      isStuck: document.getElementById('stickyFilterBar').classList.contains('is-stuck')
    };
  });
  console.log(JSON.stringify(s));
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_fixed_after_herofind.png' });
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(2); });
