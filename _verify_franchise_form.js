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
  await p.evaluate(() => localStorage.removeItem('franchise_delegate_v1'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await p.click('#heroDelegate');
  await new Promise(r => setTimeout(r, 500));
  const info = await p.evaluate(() => {
    const modal = document.getElementById('delegateFormModal');
    const body = modal.querySelector('.dfm-body');
    const notes = modal.querySelector('.dfm-notes');
    const btn = modal.querySelector('.dfm-submit');
    const notesRect = notes.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      bodyScrollTop: body.scrollTop,
      bodyScrollH: body.scrollHeight,
      bodyClientH: body.clientHeight,
      notesVisible: notesRect.top >= 0 && notesRect.bottom <= window.innerHeight,
      notesTop: Math.round(notesRect.top), notesBottom: Math.round(notesRect.bottom),
      btnTop: Math.round(btnRect.top),
      modalH: Math.round(modal.getBoundingClientRect().height)
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_form_modal2.png' });
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(2); });
