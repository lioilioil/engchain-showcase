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
  p.on('pageerror', e => console.log('PAGE-ERROR:', e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const SHOTS = 'D:/Engchain3.0/_verify_shots';
  try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) {}

  /* franchise 表单弹窗（首屏完整性） */
  await p.goto('file:///D:/Engchain3.0/pages/franchise/index.html', { waitUntil: 'domcontentloaded' });
  await wait(1000);
  await p.evaluate(() => localStorage.removeItem('engchain_delegates'));
  await p.evaluate(() => { document.getElementById('heroDelegate').click(); });
  await wait(600);
  const modalBox = await p.evaluate(() => {
    const m = document.getElementById('delegateFormModal');
    const b = m.getBoundingClientRect();
    const sc = m.querySelector('.dfm-body');
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), bodyScroll: sc ? sc.scrollHeight + ' / ' + sc.clientHeight : 'n/a', submitVisible: (() => { const el = document.getElementById('delegateFormSubmit'); const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= 900; })() };
  });
  console.log('FORM-MODAL:', JSON.stringify(modalBox));
  await p.screenshot({ path: path.join(SHOTS, 'dg_f_form.png') });

  /* 无数据空态（我的委托） */
  await p.evaluate(() => { document.getElementById('delegateFormClose').click(); });
  await wait(300);
  await p.goto('file:///D:/Engchain3.0/pages/profile/delegates.html', { waitUntil: 'domcontentloaded' });
  await wait(900);
  await p.screenshot({ path: path.join(SHOTS, 'dg_list_empty.png') });
  const empty = await p.evaluate(() => document.getElementById('dlList').textContent.replace(/\s+/g, ' ').slice(0, 60));
  console.log('EMPTY:', empty);

  /* 新增委托表单页 */
  await p.goto('file:///D:/Engchain3.0/pages/profile/delegate-new.html', { waitUntil: 'domcontentloaded' });
  await wait(900);
  await p.screenshot({ path: path.join(SHOTS, 'dg_new.png') });
  const newPage = await p.evaluate(() => ({
    chips: document.querySelectorAll('#dnFormRoot .dg-chip').length,
    regionBtn: !!document.querySelector('#dnFormRoot .dg-region-pick'),
    notePlaceholder: (document.getElementById('dfNote') || {}).placeholder || ''
  }));
  console.log('NEW:', JSON.stringify(newPage));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
