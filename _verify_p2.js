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
    localStorage.setItem('engchain-entry', JSON.stringify({ types: ['agency'], type: 'agency', active: true, status: 'active', expireAt: Date.now() + 31536000000 }));
  });

  // 1) 工作台渲染我的服务区块（空态）
  await page.goto('file:///D:/Engchain3.0/pages/agency/seller-board.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));
  let b = await page.evaluate(() => ({
    head: !!document.querySelector('.ms-head'),
    emptyVisible: document.getElementById('ms-empty').style.display !== 'none',
    publishBtn: !!document.querySelector('.ms-head .btn-primary'),
    count: document.getElementById('ms-count').textContent
  }));
  console.log('BOARD-EMPTY', JSON.stringify(b));

  // 2) 发布一个中介服务（模拟 SupplyStore.add + approve）
  await page.evaluate(() => {
    SupplyStore.add({ title: '测试中介服务：资质代办加急', cat: '中介服务', subType: '资质代办', price: '5', unit: '万元/件', dir: 'supply', bizKey: 'agency', publisher: 'u1', source: 'user_publish', company: '测试中介企业', desc: '测试用服务' });
  });
  await new Promise(r => setTimeout(r, 300));
  const addedId = await page.evaluate(() => {
    const items = SupplyStore.read().items;
    const it = items.find(x => x.title.indexOf('测试中介服务') >= 0);
    SupplyStore.approve(it.id);
    return it.id;
  });
  console.log('added id:', addedId);
  await new Promise(r => setTimeout(r, 300));
  b = await page.evaluate(() => ({
    count: document.getElementById('ms-count').textContent,
    items: Array.from(document.querySelectorAll('#ms-list .ms-item')).map(x => x.innerText.replace(/\s+/g, ' ')),
    emptyHidden: document.getElementById('ms-empty').style.display === 'none'
  }));
  console.log('BOARD-LISTED', JSON.stringify(b, null, 1));

  // 3) 服务市场可见该服务
  await page.goto('file:///D:/Engchain3.0/pages/agency/index.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 700));
  const mkt = await page.evaluate(() => ({
    has: Array.from(document.querySelectorAll('.svc-name')).some(x => x.textContent.indexOf('测试中介服务') >= 0),
    total: document.querySelectorAll('.svc-card').length
  }));
  console.log('MARKET-HAS-NEW', JSON.stringify(mkt));

  // 4) 下架
  await page.goto('file:///D:/Engchain3.0/pages/agency/seller-board.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => { window.takeDown(document.querySelector('#ms-list .btn-ghost:last-child').getAttribute('onclick').match(/'([^']+)'/)[1]); });
  await new Promise(r => setTimeout(r, 300));
  // 点击弹窗确定（限定 .dialog 内按钮）
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.dialog button'));
    const ok = btns.find(x => x.textContent.indexOf('下架') >= 0);
    if (ok) ok.click();
  });
  await new Promise(r => setTimeout(r, 500));
  b = await page.evaluate(() => ({
    count: document.getElementById('ms-count').textContent,
    emptyVisible: document.getElementById('ms-empty').style.display !== 'none'
  }));
  console.log('AFTER-DOWN', JSON.stringify(b));

  // 5) 市场已移除
  await page.goto('file:///D:/Engchain3.0/pages/agency/index.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 700));
  const mkt2 = await page.evaluate(() => ({
    has: Array.from(document.querySelectorAll('.svc-name')).some(x => x.textContent.indexOf('测试中介服务') >= 0),
    total: document.querySelectorAll('.svc-card').length
  }));
  console.log('MARKET-AFTER-DOWN', JSON.stringify(mkt2));
  await browser.close();
})();
