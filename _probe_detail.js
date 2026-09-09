const puppeteer = require('puppeteer-core');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp'),
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 880 }, protocolTimeout: 60000
  });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('PAGEERROR:', String(e.message).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
  await p.evaluateOnNewDocument(() => {
    const now = Date.now();
    localStorage.removeItem('engchain-entry');
    localStorage.setItem('engchain-state', JSON.stringify({ user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'chenjianguo@engchain.cn', loggedIn: true, uid: 'u1' }));
    localStorage.setItem('engchain-auth', JSON.stringify({ realname: { ok: true, name: '陈建国' }, enterprise: { ok: true, expireAt: now + 365 * 864e5 }, personalEntry: { ok: true, list: [{}], userType: 'jobseeker', resumeComplete: true } }));
  });
  await p.goto('file:///D:/Engchain3.0/pages/supply/detail.html?id=a1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const info = await p.evaluate(() => {
    const cta = document.getElementById('cta');
    const ab = document.getElementById('actionbar');
    const nt = document.getElementById('nav-title');
    const body = document.querySelector('.scroll');
    return {
      cta: cta ? cta.textContent.trim() : null,
      abHtml: ab ? ab.innerHTML.slice(0, 120) : null,
      nav: nt ? nt.textContent : null,
      bodyLen: body ? body.innerHTML.length : -1,
      bodyHead: body ? body.innerHTML.slice(0, 80) : null
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(2); });
