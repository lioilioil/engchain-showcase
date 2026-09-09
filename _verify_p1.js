const puppeteer = require('puppeteer-core');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp'),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--disable-web-security', '--disable-gpu'],
    defaultViewport: { width: 1280, height: 900 }, protocolTimeout: 60000
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await page.goto('file:///D:/Engchain3.0/home.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, account: 'u1', name: '测试用户', phone: '13800000000' }));
    const auth = JSON.parse(localStorage.getItem('engchain-auth') || 'null') || {};
    auth.realname = { ok: true, ts: Date.now() };
    localStorage.setItem('engchain-auth', JSON.stringify(auth));
    localStorage.removeItem('engchain-entry');
    localStorage.setItem('engchain-balance', JSON.stringify({ balance: 500000 }));
    localStorage.removeItem('engchain-autosave-demand');
    localStorage.removeItem('engchain-autosave-supply');
    localStorage.removeItem('engchain-agency-order-draft');
  });

  // 1) market 详情 CTA
  await page.goto('file:///D:/Engchain3.0/pages/supply/detail.html?id=a5&from=market', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 900));
  const det = await page.evaluate(() => ({
    cta: (document.getElementById('cta') || {}).innerText || '',
    flag: window.__AGENCY_MARKET__
  }));
  console.log('DETAIL-MARKET', JSON.stringify(det));

  // 2) 点击 CTA -> 下单预填
  await page.evaluate(() => { document.getElementById('cta').click(); });
  await new Promise(r => setTimeout(r, 900));
  const ord = await page.evaluate(() => ({
    url: location.href,
    amt: document.getElementById('amt-input').value,
    selName: (document.querySelector('.od-card.on .od-name') || {}).textContent || '',
    hasCommission: /佣金|费率/.test(document.body.innerText)
  }));
  console.log('ORDER', JSON.stringify(ord));

  // 3) 供需原路径（无 from=market）：CTA 仍为咨询
  await page.goto('file:///D:/Engchain3.0/pages/supply/detail.html?id=a5', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 900));
  const det0 = await page.evaluate(() => ({
    cta: (document.getElementById('cta') || {}).innerText || '',
    flag: window.__AGENCY_MARKET__
  }));
  console.log('DETAIL-PLAIN', JSON.stringify(det0));

  // 4) 服务市场卡片区分：机构服务带 from=market，企业条目不带
  await page.goto('file:///D:/Engchain3.0/pages/agency/index.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 700));
  const mkt = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.svc-card')).map(c => ({
      name: (c.querySelector('.svc-name') || {}).textContent || '',
      foot: (c.querySelector('.svc-foot') || {}).innerText || '',
      href: c.getAttribute('onclick') || ''
    }));
    return { n: cards.length, cards: cards.slice(0, 9) };
  });
  console.log('MARKET-CARDS', JSON.stringify(mkt, null, 1));
  await browser.close();
})();
