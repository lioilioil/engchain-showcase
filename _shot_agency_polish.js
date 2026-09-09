/* 服务广场深度打磨 · 交付截图（用户视角/服务商视角/下单页/工作台） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = 'D:/Engchain3.0';
const OUT = path.resolve('C:/Users/36434/DoubaoWork/chats/2026-09-09/new-chat');
const PROFILE = path.resolve(ROOT, '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: PROFILE,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 900 }, protocolTimeout: 60000
  });
  const mkPage = async (uid) => {
    const p = await browser.newPage();
    await p.evaluateOnNewDocument((uid) => {
      const now = Date.now();
      localStorage.removeItem('engchain-entry');
      const state = uid === 'u2'
        ? { user: '李雅', company: '四川××工程中介服务有限公司', member: false, account: 'liya@engchain.cn', loggedIn: true, uid: 'u2' }
        : { user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'chenjianguo@engchain.cn', loggedIn: true, uid: 'u1' };
      localStorage.setItem('engchain-state', JSON.stringify(state));
      localStorage.setItem('engchain-auth', JSON.stringify({
        realname: { ok: true, name: uid === 'u2' ? '李雅' : '陈建国' },
        enterprise: { ok: true, expireAt: now + 365 * 864e5 },
        personalEntry: { ok: true, list: [{}], userType: 'jobseeker', resumeComplete: true }
      }));
      if (uid === 'u2') {
        localStorage.setItem('engchain-entry', JSON.stringify({ type: 'agency', types: ['agency'], status: 'active', active: true, orderId: 'EN1', paidAt: now, expireAt: now + 365 * 864e5, depositType: 'engineering', depositPaid: 20000 }));
      }
      localStorage.setItem('engchain-svc-ratings', JSON.stringify({ items: { a1: { count: 12, sum: 58 }, a2: { count: 8, sum: 38 }, a3: { count: 15, sum: 74 } } }));
    }, uid);
    return p;
  };
  const goto = (p, f, opt) => p.goto('file:///' + ROOT + '/' + f, Object.assign({ waitUntil: 'networkidle2', timeout: 60000 }, opt || {}));

  /* 1. 服务广场 · 用户视角（含评价聚合/热门词/机构卡） */
  {
    const p = await mkPage('u1');
    await goto(p, 'pages/agency/index.html');
    await new Promise(r => setTimeout(r, 700));
    await p.screenshot({ path: path.join(OUT, '01_服务广场_用户视角.png') });
    await p.close();
  }
  /* 2. 服务广场 · 服务商视角 */
  {
    const p = await mkPage('u2');
    await goto(p, 'pages/agency/index.html');
    await new Promise(r => setTimeout(r, 700));
    await p.screenshot({ path: path.join(OUT, '02_服务广场_服务商视角.png') });
    await p.close();
  }
  /* 3. 下单页 · 金额心智与保障（滚动到金额区块，露出服务商参考价行） */
  {
    const p = await mkPage('u1');
    await goto(p, 'pages/agency/order.html?svc=0&amount=180000');
    await new Promise(r => setTimeout(r, 700));
    await p.evaluate(() => {
      const ql = document.getElementById('quote-line');
      if (ql) ql.scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 400));
    await p.screenshot({ path: path.join(OUT, '03_下单页_金额心智与保障.png') });
    await p.close();
  }
  /* 4. 服务商工作台（询盘 + 收入明细 + 经营数据） */
  {
    const p = await mkPage('u2');
    await p.evaluateOnNewDocument(() => {
      const leads = [
        { id: 'LD1', svcId: 'a1', svcName: '建筑资质升级代办', sellerId: 'u2', buyerId: 'u1', name: '陈建国', phone: '138****8866', serve: '资质升级', urge: '加急通道', status: 'new', createdAt: Date.now() - 2 * 36e5 },
        { id: 'LD2', svcId: 'a3', svcName: '安许新办加急', sellerId: 'u2', buyerId: 'u3', name: '王磊', phone: '159****2233', serve: '安许新办', urge: '常规办理', status: 'contacted', createdAt: Date.now() - 26 * 36e5 }
      ];
      localStorage.setItem('engchain-agency-leads', JSON.stringify({ items: leads }));
    });
    await goto(p, 'pages/agency/seller-board.html');
    await new Promise(r => setTimeout(r, 700));
    await p.screenshot({ path: path.join(OUT, '04_服务商工作台_询盘经营.png') });
    await p.close();
  }
  /* 5. 详情页 · 免费咨询登记（用户侧 CTA） */
  {
    const p = await mkPage('u1');
    await goto(p, 'pages/supply/detail.html?id=a1', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3200));
    await p.evaluate(() => { const b = document.getElementById('cta'); b && b.click(); });
    await new Promise(r => setTimeout(r, 500));
    await p.screenshot({ path: path.join(OUT, '05_详情页_免费咨询登记.png') });
    await p.close();
  }
  await browser.close();
  console.log('SCREENSHOTS DONE');
})().catch(e => { console.error('ERR', e); process.exit(2); });
