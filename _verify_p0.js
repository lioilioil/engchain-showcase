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
  });
  await page.goto('file:///D:/Engchain3.0/pages/agency/index.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 700));
  const base = await page.evaluate(() => ({
    cards: document.querySelectorAll('.svc-card').length,
    chips: Array.from(document.querySelectorAll('.sub-chip .chip')).map(c => c.textContent),
    count: document.getElementById('mkt-count').textContent,
    fold: !!document.querySelector('.guard-fold'),
    hasCommission: /佣金|防跳单|保证金分级/.test(document.body.innerText),
    titles: Array.from(document.querySelectorAll('.svc-name')).map(x => x.textContent.slice(0, 14))
  }));
  console.log('BASE', JSON.stringify(base));
  const catTest = async (id) => {
    await page.evaluate(c => window.pickCat(c), id);
    await new Promise(r => setTimeout(r, 180));
    const n = await page.evaluate(() => document.querySelectorAll('.svc-card').length);
    console.log('cat ' + id + ':', n);
  };
  for (const c of ['qual', 'guarantee', 'cost', 'labor', 'corp']) await catTest(c);
  // 搜索
  await page.evaluate(() => window.pickCat('all'));
  await page.type('#mkt-q', '担保');
  await new Promise(r => setTimeout(r, 180));
  console.log('search 担保:', await page.evaluate(() => document.querySelectorAll('.svc-card').length));
  await page.evaluate(() => { document.getElementById('mkt-q').value = ''; window.renderList(); });
  // 点击卡片 -> 详情（MOCK a5 工程担保）
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.svc-card');
    for (const c of cards) { if (c.innerText.indexOf('工程担保') >= 0) { c.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 900));
  console.log('url:', page.url());
  const det = await page.evaluate(() => ({
    nav: document.getElementById('nav-title') ? document.getElementById('nav-title').textContent : '',
    hasQuote: /报价明细/.test(document.body.innerText),
    hasCases: /成功案例/.test(document.body.innerText),
    hasRefund: /不过退款|退款/.test(document.body.innerText),
    hasCycle: /办理周期/.test(document.body.innerText),
    bodyText: document.body.innerText.slice(0, 200)
  }));
  console.log('DETAIL', JSON.stringify(det, null, 1));
  await browser.close();
})();
