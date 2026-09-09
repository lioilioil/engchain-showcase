const puppeteer = require('puppeteer-core');
const path = require('path');
const RULE = /佣金|防跳单|保证金|平台服务费|抽成|分成比例/;
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
  });

  const pages = [
    ['home', 'file:///D:/Engchain3.0/home.html'],
    ['supply-list', 'file:///D:/Engchain3.0/pages/supply/list.html'],
    ['service-market', 'file:///D:/Engchain3.0/pages/agency/index.html'],
    ['detail-market', 'file:///D:/Engchain3.0/pages/supply/detail.html?id=a5&from=market'],
    ['order', 'file:///D:/Engchain3.0/pages/agency/order.html?svcId=a5&amount=8000'],
    ['profile', 'file:///D:/Engchain3.0/pages/profile/index.html']
  ];
  let fail = 0;
  for (const [name, url] of pages) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 700));
    const r = await page.evaluate(src => {
      const t = document.body ? document.body.innerText : '';
      const hits = [];
      let m;
      const re = new RegExp(src, 'g');
      while ((m = re.exec(t))) hits.push(m[0]);
      return { len: t.length, hits: hits.filter((v, i, a) => a.indexOf(v) === i) };
    }, RULE.source);
    const ok = r.hits.length === 0;
    if (!ok) fail++;
    console.log(name, ok ? 'PASS' : 'FAIL', JSON.stringify(r.hits));
  }

  // 下单提交 → 订单详情页
  await page.goto('file:///D:/Engchain3.0/pages/agency/order.html?svcId=a5&amount=8000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 700));
  const subBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => /提交|确认支付/.test(x.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    return '';
  });
  console.log('submit clicked:', subBtn);
  await new Promise(r => setTimeout(r, 1500));
  const succ = await page.evaluate(src => {
    const t = document.body ? document.body.innerText : '';
    const hits = [];
    let m;
    const re = new RegExp(src, 'g');
    while ((m = re.exec(t))) hits.push(m[0]);
    return { url: location.href, hits: hits.filter((v, i, a) => a.indexOf(v) === i), toast: (document.querySelector('.toast') || {}).textContent || '' };
  }, RULE.source);
  console.log('after-submit', succ.hits.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(succ));
  if (succ.hits.length) fail++;

  // 订单详情页（若已创建订单）
  if (succ.url.indexOf('order-detail') >= 0) {
    await new Promise(r => setTimeout(r, 600));
    const od = await page.evaluate(src => {
      const t = document.body ? document.body.innerText : '';
      const hits = [];
      let m;
      const re = new RegExp(src, 'g');
      while ((m = re.exec(t))) hits.push(m[0]);
      return { url: location.href, hits: hits.filter((v, i, a) => a.indexOf(v) === i) };
    }, RULE.source);
    console.log('order-detail', od.hits.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(od));
    if (od.hits.length) fail++;
  }

  console.log(fail === 0 ? '=== P3 ALL PASS ===' : '=== P3 FAILS=' + fail + ' ===');
  await browser.close();
})();
