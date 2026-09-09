/* 只读审计：服务广场首卡布局量化 + 角色条现状（不改任何代码） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: PROFILE, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 900, deviceScaleFactor: 2 }, protocolTimeout: 60000
  });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => {
    const now = Date.now();
    localStorage.removeItem('engchain-entry');
    localStorage.setItem('engchain-state', JSON.stringify({ user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'chenjianguo@engchain.cn', loggedIn: true, uid: 'u1' }));
    localStorage.setItem('engchain-auth', JSON.stringify({ realname: { ok: true, name: '陈建国' }, enterprise: { ok: true, expireAt: now + 365 * 864e5 }, personalEntry: { ok: true, list: [{}], userType: 'jobseeker', resumeComplete: true } }));
    localStorage.setItem('engchain-svc-ratings', JSON.stringify({ items: { a1: { count: 12, sum: 58 } } }));
  });
  await p.goto('file:///D:/Engchain3.0/pages/agency/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 700));
  /* 布局量化：第一张卡 + 角色条 + 统计卡 */
  const audit = await p.evaluate(() => {
    function box(el) { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
    const card = document.querySelector('.svc-card');
    const out = { card: box(card) };
    if (card) {
      out.name = box(card.querySelector('.svc-name'));
      out.score = box(card.querySelector('.svc-score'));
      out.price = box(card.querySelector('.svc-price'));
      out.agg = box(card.querySelector('.svc-agg'));
      out.trust = box(card.querySelector('.svc-trust'));
      out.co = box(card.querySelector('.svc-co'));
      out.cy = box(card.querySelector('.svc-cy'));
      out.tags = box(card.querySelector('.svc-tags'));
      out.foot = box(card.querySelector('.svc-foot'));
      out.dep = box(card.querySelector('.svc-dep'));
      out.cta = box(card.querySelector('.svc-cta'));
      const cs = getComputedStyle(card.querySelector('.svc-name'));
      out.nameStyle = { fs: cs.fontSize, lh: cs.lineHeight, clamp: cs.webkitLineClamp || cs.lineClamp };
      const cs2 = getComputedStyle(card.querySelector('.svc-cta'));
      out.ctaStyle = { fs: cs2.fontSize, pad: cs2.padding, radius: cs2.borderRadius };
    }
    out.roleHint = box(document.getElementById('role-hint'));
    out.roleHintText = (document.getElementById('role-hint') || {}).textContent || '';
    out.statCards = Array.from(document.querySelectorAll('.stat-card, .rc-card, [class*="stat"]')).slice(0, 6).map(box);
    out.sellerEntry = (document.getElementById('seller-entry') || { style: {} }).style.display;
    return out;
  });
  console.log(JSON.stringify(audit, null, 2));
  /* 首卡特写截图 */
  const clip = await p.evaluate(() => {
    const card = document.querySelector('.svc-card');
    const r = card.getBoundingClientRect();
    return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 };
  });
  await p.screenshot({ path: 'C:/Users/36434/DoubaoWork/chats/2026-09-09/new-chat/08_审计_服务广场首卡.png', clip });
  /* 顶部角色区截图 */
  await p.evaluate(() => { window.scrollTo(0, 0); });
  await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: 'C:/Users/36434/DoubaoWork/chats/2026-09-09/new-chat/09_审计_角色条顶部.png', clip: { x: 0, y: 0, width: 420, height: 620 } });
  await browser.close();
  console.log('AUDIT DONE');
})().catch(e => { console.error('ERR', e); process.exit(2); });
