/* 意向金两段式 + 需求先行入口 · 交付截图 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = 'D:/Engchain3.0';
const OUT = 'C:/Users/36434/DoubaoWork/chats/2026-09-09/new-chat';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.resolve(ROOT, '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: PROFILE,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 880 }, protocolTimeout: 60000
  });
  async function page() { const p = await browser.newPage(); p.on('pageerror', e => console.log('[pageerror]', String(e.message).slice(0, 120))); return p; }
  async function seed(p, uid) {
    await p.evaluateOnNewDocument((uid) => {
      const now = Date.now();
      const state = uid === 'u2'
        ? { user: '李雅', company: '四川××工程中介服务有限公司', member: false, account: 'liya@engchain.cn', loggedIn: true, uid: 'u2' }
        : { user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'chenjianguo@engchain.cn', loggedIn: true, uid: 'u1' };
      localStorage.removeItem('engchain-entry');
      localStorage.setItem('engchain-state', JSON.stringify(state));
      localStorage.setItem('engchain-auth', JSON.stringify({
        realname: { ok: true, name: uid === 'u2' ? '李雅' : '陈建国' },
        enterprise: { ok: true, expireAt: now + 365 * 864e5 },
        personalEntry: { ok: true, list: [{}], userType: 'jobseeker', resumeComplete: true }
      }));
      if (uid === 'u2') {
        localStorage.setItem('engchain-entry', JSON.stringify({ type: 'agency', types: ['agency'], status: 'active', active: true, orderId: 'EN1', paidAt: now, expireAt: now + 365 * 864e5, depositType: 'engineering', depositPaid: 20000 }));
      }
    }, uid);
  }
  const goto = (p, f) => p.goto('file:///' + ROOT + '/' + f, { waitUntil: 'networkidle2', timeout: 60000 });
  const shot = async (p, name) => { await p.screenshot({ path: path.join(OUT, name) }); console.log('saved', name); };

  /* 1 服务广场 · 需求先行入口（顶部） */
  { const p = await page(); await seed(p, 'u1'); await goto(p, 'pages/agency/index.html'); await new Promise(r => setTimeout(r, 700));
    await shot(p, '10_服务广场_需求先行入口.png'); await p.close(); }

  /* 2 服务广场 · AI 匹配推荐结果 */
  { const p = await page(); await seed(p, 'u1'); await goto(p, 'pages/agency/index.html'); await new Promise(r => setTimeout(r, 700));
    await p.evaluate(() => {
      const g = document.getElementById('nf-goal'); g.value = '资质升级';
      const st = document.getElementById('nf-state'); st.value = '现有三级资质';
      const bd = document.getElementById('nf-budget'); bd.value = '30';
      window.toggleNeed(); window.doMatch();
    });
    await new Promise(r => setTimeout(r, 700)); await shot(p, '11_服务广场_AI匹配推荐.png'); await p.close(); }

  /* 3 下单页 · 意向金两段式（滚动到金额区） */
  { const p = await page(); await seed(p, 'u1'); await goto(p, 'pages/agency/order.html?svc=0&amount=180000'); await new Promise(r => setTimeout(r, 700));
    await p.evaluate(() => { const el = document.getElementById('amt-input'); if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' }); });
    await new Promise(r => setTimeout(r, 400)); await shot(p, '12_下单页_意向金两段式.png'); await p.close(); }

  /* 4 订单详情 · 意向金已付（启动/取消） */
  { const p = await page(); await seed(p, 'u1'); await goto(p, 'pages/agency/order.html?svc=0'); await new Promise(r => setTimeout(r, 700));
    const id = await p.evaluate(() => {
      Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: 'u1', toAcct: 'available', amount: 200000, allowNegative: true, idemKey: 'seed_shot_' + Date.now(), remark: '注资' });
      const o = Mediation.create({ buyerId: 'u1', sellerId: 'u2', svcId: 'a1', svcName: '资质升级', category: 'agency', amount: 180000 });
      Mediation.payIntent(o.id, 'balance');
      return o.id;
    });
    await p.goto('file:///' + ROOT + '/pages/agency/order-detail.html?id=' + id, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 700)); await shot(p, '13_订单详情_意向金已付.png'); await p.close(); }

  /* 5 服务商工作台 · 意向金单（tab） */
  { const p = await page(); await seed(p, 'u2'); await goto(p, 'pages/agency/seller-board.html'); await new Promise(r => setTimeout(r, 700));
    await p.evaluate(() => {
      Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: 'u1', toAcct: 'available', amount: 200000, allowNegative: true, idemKey: 'seed_shot2_' + Date.now(), remark: '注资' });
      const o = Mediation.create({ buyerId: 'u1', sellerId: 'u2', svcId: 'a1', svcName: '资质升级', category: 'agency', amount: 180000 });
      Mediation.payIntent(o.id, 'balance');
      window.setTab('intent');
      const el = document.getElementById('list'); if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 600)); await shot(p, '14_服务商工作台_意向金单.png'); await p.close(); }

  await browser.close();
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
