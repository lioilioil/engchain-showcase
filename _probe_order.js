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
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('engchain-state', JSON.stringify({ user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'chenjianguo@engchain.cn', loggedIn: true, uid: 'u1' }));
  });
  await p.goto('file:///D:/Engchain3.0/pages/agency/order.html?svc=0&amount=180000', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 800));
  const info = await p.evaluate(() => {
    const ql = document.getElementById('quote-line');
    const qh = document.getElementById('quote-hint');
    const amt = document.getElementById('amt-input');
    return {
      scrollY: window.scrollY,
      qlDisplay: ql ? getComputedStyle(ql).display : null,
      qlHtml: ql && ql.style.display !== 'none' ? ql.innerHTML.slice(0, 120) : null,
      qh: qh ? (qh.style.display + '|' + qh.textContent) : null,
      amt: amt ? amt.value : null,
      url: location.href
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(2); });
