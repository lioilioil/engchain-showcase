const puppeteer = require('puppeteer-core');
const path = require('path');
const RULE = /佣金|防跳单|保证金|平台服务费|抽成/;
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp'),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--disable-web-security', '--disable-gpu'],
    defaultViewport: { width: 1280, height: 900 }, protocolTimeout: 60000
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  let fails = 0;
  const chk = (name, ok, extra) => { console.log(name, ok ? 'PASS' : 'FAIL', extra || ''); if (!ok) fails++; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ============ 用户线：u1 购买 ============ */
  await page.goto('file:///D:/Engchain3.0/home.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, account: 'u1', name: '陈建国', phone: '13800000000' }));
    const auth = JSON.parse(localStorage.getItem('engchain-auth') || 'null') || {};
    auth.realname = { ok: true, ts: Date.now() };
    localStorage.setItem('engchain-auth', JSON.stringify(auth));
    localStorage.removeItem('engchain-entry');
    localStorage.setItem('engchain-balance', JSON.stringify({ balance: 500000, frozen: 0, totalIn: 500000, logs: [] }));
    localStorage.removeItem('engchain-autosave-demand');
    localStorage.removeItem('engchain-autosave-supply');
    localStorage.removeItem('engchain-agency-order-draft');
    // ledger 直接写入：PLATFORM.available -50万 → u1.available +50万（复式平衡）
    let led = null;
    try { led = JSON.parse(localStorage.getItem('engchain-ledger') || 'null'); } catch (e) {}
    if (!led) led = { accounts: {}, txns: [] };
    led.accounts['u1'] = led.accounts['u1'] || {};
    led.accounts['u1'].available = (led.accounts['u1'].available || 0) + 500000;
    led.accounts['PLATFORM'] = led.accounts['PLATFORM'] || { available: 0 };
    led.accounts['PLATFORM'].available = (led.accounts['PLATFORM'].available || 0) - 500000;
    led.txns.unshift({ id: 'LX' + Date.now(), ts: Date.now(), fromUid: 'PLATFORM', fromAcct: 'available', toUid: 'u1', toAcct: 'available', amount: 500000, bizType: 'wallet_recharge', remark: 'P4测试充值' });
    localStorage.setItem('engchain-ledger', JSON.stringify(led));
  });
  await sleep(400);
  const ledgerOk = await page.evaluate(() => {
    try {
      const led = JSON.parse(localStorage.getItem('engchain-ledger') || 'null');
      return led && led.accounts && led.accounts['u1'] && led.accounts['u1'].available >= 500000;
    } catch (e) { return false; }
  });
  chk('U1 ledger available >= 50万', ledgerOk);

  // 服务市场
  await page.goto('file:///D:/Engchain3.0/pages/agency/index.html', { waitUntil: 'domcontentloaded' });
  await sleep(700);
  const mkt = await page.evaluate(() => ({
    cards: document.querySelectorAll('.svc-card').length,
    cats: document.querySelectorAll('#mkt-cats .sub-chip-item').length || Array.from(document.querySelectorAll('#mkt-cats .tag, #mkt-cats span')).length
  }));
  chk('市场渲染卡片>=9', mkt.cards >= 9, 'cards=' + mkt.cards);
  // 搜索
  await page.evaluate(() => {
    const q = document.getElementById('mkt-q');
    q.value = '担保';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(400);
  const searched = await page.evaluate(() => ({
    n: document.querySelectorAll('.svc-card').length,
    first: (document.querySelector('.svc-card .svc-name') || {}).textContent || ''
  }));
  chk('搜索“担保”→1卡', searched.n === 1, JSON.stringify(searched));
  // 点卡进详情（等待 CTA 渲染）
  await page.evaluate(() => document.querySelector('.svc-card').click());
  try { await page.waitForFunction(() => { const c = document.getElementById('cta'); return c && c.innerText && c.innerText.indexOf('在线下单') >= 0; }, { timeout: 6000 }); } catch (e) {}
  await sleep(300);
  const det = await page.evaluate(() => ({
    url: location.href, cta: (document.getElementById('cta') || {}).innerText || ''
  }));
  chk('详情页 from=market CTA', det.url.indexOf('from=market') >= 0 && det.cta.indexOf('在线下单') >= 0, JSON.stringify(det));
  // 下单
  await page.evaluate(() => document.getElementById('cta').click());
  await sleep(900);
  const ord = await page.evaluate(() => ({ url: location.href, amt: document.getElementById('amt-input') ? document.getElementById('amt-input').value : '' }));
  chk('下单页金额预填', ord.url.indexOf('order.html') >= 0 && ord.amt === '8000', JSON.stringify(ord));
  // 提交
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /确认支付/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(1800);
  const afterPay = await page.evaluate(src => {
    const t = document.body ? document.body.innerText : '';
    const hits = [];
    let m;
    const re = new RegExp(src, 'g');
    while ((m = re.exec(t))) hits.push(m[0]);
    return { url: location.href, toast: (document.querySelector('.toast') || {}).textContent || '', hits: hits.filter((v, i, a) => a.indexOf(v) === i), state: (document.querySelector('.od-state') || {}).textContent || '' };
  }, RULE.source);
  chk('托管成功跳订单详情', afterPay.url.indexOf('order-detail') >= 0 && afterPay.state.indexOf('托管') >= 0, JSON.stringify(afterPay));
  chk('订单详情无规则词', afterPay.hits.length === 0, JSON.stringify(afterPay.hits));
  const orderId = afterPay.url.split('id=')[1] || '';

  /* ============ 合作方线：u2 中介工作台 ============ */
  await page.goto('file:///D:/Engchain3.0/pages/agency/seller-board.html', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => {
    // 用登录 API 完整切换账号（seller-board 加载了 databus/domain/stores）
    if (window.DataBus && DataBus.login) DataBus.login('u2');
  });
  await sleep(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(900);
  const who = await page.evaluate(() => {
    const me = DataBus.current();
    return me ? { id: me.id, name: me.name } : null;
  });
  console.log('coop logged in as:', JSON.stringify(who));
  await page.goto('file:///D:/Engchain3.0/pages/agency/seller-board.html', { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const sb = await page.evaluate(() => ({
    ms: document.getElementById('ms-count') ? document.getElementById('ms-count').textContent : '',
    msItems: Array.from(document.querySelectorAll('#ms-list .ms-item .od-name')).map(x => x.textContent),
    todo: document.getElementById('k-todo') ? document.getElementById('k-todo').textContent : '',
    orderNames: Array.from(document.querySelectorAll('#list .od-name')).map(x => x.textContent)
  }));
  chk('我的服务=u2发布条目', sb.msItems.length >= 2, JSON.stringify(sb.msItems));
  chk('待接单出现新订单', sb.todo !== '0' && sb.orderNames.some(x => x.indexOf('工程担保') >= 0), JSON.stringify(sb.orderNames));

  // 接单：进订单详情（seller 视角）→ 接单
  await page.evaluate(() => {
    const od = Array.from(document.querySelectorAll('#list .od')).find(x => x.textContent.indexOf('工程担保') >= 0);
    if (od) od.click();
  });
  await sleep(900);
  const sd = await page.evaluate(() => ({
    url: location.href, role: (document.querySelector('.od-role') || {}).textContent || '',
    btns: Array.from(document.querySelectorAll('button')).map(x => x.textContent.trim()).filter(x => /接单|交付|确认/.test(x))
  }));
  chk('卖家视角订单详情', sd.url.indexOf('order-detail') >= 0 && sd.role.indexOf('服务商') >= 0, JSON.stringify(sd));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.indexOf('接单') >= 0);
    if (b) b.click();
  });
  await sleep(1000);
  const accepted = await page.evaluate(() => ({ state: (document.querySelector('.od-state') || {}).textContent || '', toast: (document.querySelector('.toast') || {}).textContent || '' }));
  chk('接单成功→履约中', accepted.state.indexOf('履约') >= 0, JSON.stringify(accepted));

  // 回工作台：履约中 +1、我的服务仍在
  await page.goto('file:///D:/Engchain3.0/pages/agency/seller-board.html', { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const sb2 = await page.evaluate(() => ({
    doing: document.getElementById('k-doing') ? document.getElementById('k-doing').textContent : '',
    ms: document.getElementById('ms-count') ? document.getElementById('ms-count').textContent : ''
  }));
  chk('履约中>=1', Number(sb2.doing) >= 1, JSON.stringify(sb2));

  console.log(fails === 0 ? '=== P4 ALL PASS ===' : '=== P4 FAILS=' + fails + ' ===');
  await browser.close();
})();
