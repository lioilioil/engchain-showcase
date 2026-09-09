/**
 * 定向验证：中介服务 × 分销中心 入口全链路
 * 覆盖：金刚区5文件夹、发现页一级/二级tab、服务市场可达、个人中心服务经营入口（锁定引导/中介解锁）、工作台渲染、all-functions解锁
 * 验证结束自动恢复 localStorage，不污染演示数据。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'D:/Engchain3.0';
const HOME = 'file:///D:/Engchain3.0/home.html';
const LIST = 'file:///D:/Engchain3.0/pages/supply/list.html';
const PROFILE = 'file:///D:/Engchain3.0/pages/profile/index.html';
const ALLFN = 'file:///D:/Engchain3.0/pages/profile/all-functions.html';
const SELLER = 'file:///D:/Engchain3.0/pages/agency/seller-board.html';
const AGENCY = 'file:///D:/Engchain3.0/pages/agency/index.html';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`  [${ok ? '✓' : '✗'}] ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
    userDataDir: path.resolve(ROOT, '.chrome-test-profile-tmp'),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files',
           '--disable-web-security', '--disable-gpu', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
    protocolTimeout: 60000
  });

  const seed = await browser.newPage();
  await seed.goto(HOME, { waitUntil: 'domcontentloaded' });
  const backup = await seed.evaluate(() => {
    const keys = ['engchain-state','engchain-auth','engchain-entry','engchain-users'];
    const snap = {};
    keys.forEach(k => { const v = localStorage.getItem(k); if (v !== null) snap[k] = v; });
    return snap;
  });
  async function loginAs(entry) {
    await seed.evaluate((ent) => {
      localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, account: 'u1', name: '测试用户', phone: '13800000000' }));
      const auth = JSON.parse(localStorage.getItem('engchain-auth') || 'null') || {};
      auth.realname = { ok: true, ts: Date.now(), name: '测试用户', idNo: '510100000000000000', mobile: '13800000000', idMask: '5101**********0000' };
      localStorage.setItem('engchain-auth', JSON.stringify(auth));
      if (ent) localStorage.setItem('engchain-entry', JSON.stringify(ent));
      else localStorage.removeItem('engchain-entry');
      localStorage.removeItem('engchain-autosave-demand');
      localStorage.removeItem('engchain-autosave-supply');
    }, entry);
  }

  // ============ T1 金刚区 5 文件夹 ============
  await loginAs(null); // 预清理残留登录/入驻态
  const page = await browser.newPage();
  page.on('dialog', d => d.dismiss());
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  const folders = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.folder-item'));
    return items.map(it => ({
      label: it.querySelector('.hf-label') ? it.querySelector('.hf-label').childNodes[0].textContent.trim() : '',
      href: it.getAttribute('data-href'),
      title: it.querySelector('.hf-cover-title') ? it.querySelector('.hf-cover-title').textContent : ''
    }));
  });
  check('金刚区共 5 个文件夹', folders.length === 5, folders.map(f => f.label).join('/'));
  check('金刚区顺序：招商/转让/人才/服务/综合', JSON.stringify(folders.map(f => f.label)) === JSON.stringify(['招商', '转让', '人才', '服务', '综合']), folders.map(f => f.label).join('/'));
  const svc = folders.find(f => f.label === '服务');
  check('服务文件夹指向服务市场', !!svc && svc.href === 'pages/agency/index.html' && svc.title === '服务广场', svc ? svc.href + ' · ' + svc.title : 'none');
  const fatal = errors.filter(e => e.indexOf('favicon') < 0 && e.indexOf('net::ERR') < 0);
  check('金刚区无JS错误', fatal.length === 0, fatal.join(';').slice(0, 150));

  // ============ T2 发现页一级/二级 tab ============
  await page.goto(LIST, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  const segInfo = await page.evaluate(() => {
    const segs = Array.from(document.querySelectorAll('.discover-seg .seg-item')).map(s => s.dataset.t);
    return segs;
  });
  check('发现页一级 tab：全部/资源/供应/需求/服务', JSON.stringify(segInfo) === JSON.stringify(['all', 'resource', 'supply', 'demand', 'service']), segInfo.join('/'));

  async function subInfo(type) {
    await page.evaluate((t) => {
      const el = document.querySelector('.discover-seg .seg-item[data-t="' + t + '"]');
      if (el) el.click();
    }, type);
    await sleep(300);
    return page.evaluate(() => {
      const bar = document.getElementById('discover-sub');
      const chips = bar ? Array.from(bar.querySelectorAll('.sub-chip')).map(c => c.textContent) : [];
      const count = document.getElementById('count') ? document.getElementById('count').textContent : '';
      const cards = document.querySelectorAll('#list .job-card').length;
      return { visible: bar ? getComputedStyle(bar).display !== 'none' : false, chips, count, cards };
    });
  }
  const r1 = await subInfo('resource');
  check('资源 tab→二级栏显示（全部/资质招商/建企买卖/企业招聘/人才求职）', r1.visible && JSON.stringify(r1.chips) === JSON.stringify(['全部', '资质招商', '建企买卖', '企业招聘', '人才求职']), r1.chips.join('/'));
  const r2 = await subInfo('supply');
  check('供应 tab→二级栏显示（材料/设备/劳务/项目合作/中介服务）', r2.visible && r2.chips.length === 6 && r2.chips[5] === '中介服务', r2.chips.join('/'));
  const r3 = await subInfo('demand');
  check('需求 tab→二级栏显示 6 项', r3.visible && r3.chips.length === 6, r3.chips.join('/'));
  const r4 = await subInfo('service');
  check('服务 tab→二级栏显示（全部/资质代办/工程担保/造价咨询/企业服务）', r4.visible && JSON.stringify(r4.chips) === JSON.stringify(['全部', '资质代办', '工程担保', '造价咨询', '企业服务']), r4.chips.join('/'));
  check('服务 tab→列表有内容', r4.cards > 0, r4.count + ' · cards=' + r4.cards);

  // 服务二级分类过滤
  await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll('#discover-sub .sub-chip')).find(c => c.textContent === '资质代办');
    if (chip) chip.click();
  });
  await sleep(300);
  const svcFilter = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#list .job-card'));
    return { cards: cards.length, text: (cards[0] ? cards[0].textContent : '').slice(0, 60) };
  });
  check('服务 tab→资质代办过滤生效', svcFilter.cards > 0, svcFilter.text);

  // ============ T3 服务市场直达 ============
  await page.goto(AGENCY, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  const market = await page.evaluate(() => ({
    title: document.querySelector('.nav-title') ? document.querySelector('.nav-title').textContent : '',
    svcCards: document.querySelectorAll('.svc-card').length,
    sellerVisible: document.getElementById('seller-entry') ? getComputedStyle(document.getElementById('seller-entry')).display !== 'none' : false
  }));
  check('服务市场页可达且渲染服务橱窗', market.title === '服务广场' && market.svcCards > 0, market.title + ' · 橱窗=' + market.svcCards);
  check('普通用户（非中介）→ 卖方工作台入口隐藏', market.sellerVisible === false, 'sellerVisible=' + market.sellerVisible);

  // ============ T4 个人中心：普通用户锁定 + 点击引导 ============
  await loginAs(null);
  await page.goto(PROFILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  const quick = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.quick-item'));
    const svc = items.find(it => it.textContent.indexOf('服务经营') >= 0);
    const dist = items.find(it => it.textContent.indexOf('分销中心') >= 0);
    return { svcLocked: svc ? svc.classList.contains('is-locked') : null, distLocked: dist ? dist.classList.contains('is-locked') : null };
  });
  check('个人中心宫格含「服务经营」', quick.svcLocked !== null, 'found=' + (quick.svcLocked !== null));
  check('普通用户→服务经营/分销中心均锁定', quick.svcLocked === true && quick.distLocked === true, JSON.stringify(quick));
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.quick-item'));
    const svc = items.find(it => it.textContent.indexOf('服务经营') >= 0);
    if (svc) svc.click();
  });
  await sleep(400);
  const dl = await page.evaluate(() => {
    const d = document.querySelector('.dialog');
    return d ? { title: d.querySelector('.d-title') ? d.querySelector('.d-title').textContent : '', text: d.querySelector('.d-text') ? d.querySelector('.d-text').textContent.slice(0, 50) : '' } : null;
  });
  check('锁定服务经营点击→弹窗引导开通', !!dl && dl.title.indexOf('未开通') >= 0, dl ? dl.title : 'no dialog');
  await page.evaluate(() => { const ok = document.querySelector('.dialog .d-cancel'); if (ok) ok.click(); });
  await sleep(200);

  // ============ T5 中介入驻：宫格解锁 + 工作台 ============
  const entryAgency = { types: ['agency'], type: 'agency', active: true, status: 'active', expireAt: Date.now() + 31536000000, depositType: 'engineering', depositPaid: 20000 };
  await loginAs(entryAgency);
  await page.goto(PROFILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  const quick2 = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.quick-item'));
    const svc = items.find(it => it.textContent.indexOf('服务经营') >= 0);
    const dist = items.find(it => it.textContent.indexOf('分销中心') >= 0);
    return { svcLocked: svc ? svc.classList.contains('is-locked') : null, distLocked: dist ? dist.classList.contains('is-locked') : null };
  });
  check('中介入驻→服务经营解锁', quick2.svcLocked === false, 'locked=' + quick2.svcLocked);
  check('中介入驻→分销中心解锁（入驻即可分销）', quick2.distLocked === false, 'locked=' + quick2.distLocked);
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.quick-item'));
    const svc = items.find(it => it.textContent.indexOf('服务经营') >= 0);
    if (svc) svc.click();
  });
  await sleep(1200);
  const seller = await page.evaluate(() => ({
    url: location.href,
    kpi: document.getElementById('k-todo') ? document.getElementById('k-todo').textContent : '',
    deposit: document.getElementById('deposit-card') ? document.getElementById('deposit-card').textContent.slice(0, 40) : '',
    title: document.querySelector('.nav-title') ? document.querySelector('.nav-title').textContent : ''
  }));
  check('服务经营→进入工作台 seller-board', seller.url.indexOf('seller-board.html') >= 0, seller.title);
  check('工作台渲染 KPI + 保证金卡', seller.kpi !== '' && seller.deposit.indexOf('履约保证金') >= 0, 'kpi=' + seller.kpi);

  // ============ T6 all-functions：中介解锁 + 文案 ============
  await page.goto(ALLFN, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  const af = await page.evaluate(() => {
    const group = document.querySelector('.af-grid[data-group="partner"]');
    if (!group) return { items: [] };
    const titles = Array.from(document.querySelectorAll('.af-group-title'));
    const distTitle = titles.find(x => x.textContent.indexOf('分销') >= 0);
    return {
      label: distTitle ? distTitle.textContent : '',
      items: Array.from(group.querySelectorAll('.af-item')).map(it => ({ text: it.textContent.replace(/\s+/g, '').slice(0, 12), locked: it.classList.contains('locked') }))
    };
  });
  check('全部功能→分销与中介组文案为认证制', af.label.indexOf('认证制') >= 0, af.label);
  check('全部功能→中介入驻后「中介服务」解锁', af.items.length === 2 && af.items[1].text.indexOf('中介') >= 0 && af.items[1].locked === false, JSON.stringify(af.items));
  check('全部功能→分销中心解锁', af.items[0].locked === false, af.items[0].text);

  // ============ 恢复 ============
  await seed.evaluate((b) => {
    Object.keys(b).forEach(k => { if (b[k] !== undefined) localStorage.setItem(k, b[k]); });
  }, backup);
  await browser.close();
  console.log(`结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
