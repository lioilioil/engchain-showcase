/**
 * 定向验证：editor.html 四类需求发布流程（资质招商/建企买卖/招聘/求职）
 * 覆盖：品类×角色联动、四要素表单、费用卡、AI识别、必填校验、押金冻结、成功页差异化、match计算
 * 验证结束自动恢复 localStorage，不污染演示数据。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'D:/Engchain3.0';
const EDITOR = 'file:///D:/Engchain3.0/pages/publish/editor.html';

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

  // ---- 备份 & 注入登录态 ----
  const seed = await browser.newPage();
  await seed.goto('file:///D:/Engchain3.0/home.html', { waitUntil: 'domcontentloaded' });
  const backup = await seed.evaluate(() => {
    const keys = ['engchain-state','engchain-auth','engchain-balance','engchain-credits','engchain-supply'];
    const snap = {};
    keys.forEach(k => { const v = localStorage.getItem(k); if (v !== null) snap[k] = v; });
    return snap;
  });
  await seed.evaluate(() => {
    localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, account: 'u1', name: '测试用户', phone: '13800000000' }));
    const auth = JSON.parse(localStorage.getItem('engchain-auth') || 'null') || {};
    auth.realname = { ok: true, ts: Date.now(), name: '测试用户', idNo: '510100000000000000', mobile: '13800000000', idMask: '5101**********0000' };
    localStorage.setItem('engchain-auth', JSON.stringify(auth));
    // 清理可能残留的自动保存草稿（避免加载时 confirm 阻塞）
    localStorage.removeItem('engchain-autosave-demand');
    localStorage.removeItem('engchain-autosave-supply');
  });

  const page = await browser.newPage();
  page.on('dialog', d => { console.log('  [dbg] dialog dismissed:', d.message().slice(0, 50)); d.dismiss(); });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ============ T1 加载 ============
  await page.goto(EDITOR + '?role=demand', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  const fatal = errors.filter(e => e.indexOf('favicon') < 0 && e.indexOf('net::ERR') < 0);
  check('页面加载无JS错误', fatal.length === 0, fatal.join(';').slice(0, 200));
  const gateVisible = await page.evaluate(() => {
    const g1 = document.getElementById('pub-gate-login'), g2 = document.getElementById('pub-gate-realname');
    const c = document.getElementById('pub-content');
    return { login: g1 && getComputedStyle(g1).display !== 'none', real: g2 && getComputedStyle(g2).display !== 'none', content: c && getComputedStyle(c).display !== 'none' };
  });
  check('登录+实名门控通过，进入编辑器', gateVisible.content && !gateVisible.login && !gateVisible.real, JSON.stringify(gateVisible));

  // ============ T2 品类 × 角色 ============
  const catInfo = await page.evaluate(() => {
    const sel = document.getElementById('f-category');
    const opts = Array.from(sel.options).map(o => ({ v: o.value, disp: o.style.display }));
    const chips = Array.from(document.querySelectorAll('#chips-category .chip')).map(c => ({ v: c.dataset.val, disp: c.style.display }));
    return { opts, chips };
  });
  check('需求侧品类共 9 项', catInfo.opts.length === 9, catInfo.opts.map(o => o.v).join('/'));
  const demandOpts = catInfo.opts.filter(o => o.disp !== 'none').map(o => o.v);
  check('需求侧：招聘/建企买卖/资质招商可见，求职隐藏', demandOpts.includes('招聘') && demandOpts.includes('建企买卖') && demandOpts.includes('资质招商') && !demandOpts.includes('求职'), demandOpts.join('/'));

  // ============ T3 建企买卖：四要素 + 费用卡 + 价格标签 ============
  await page.select('#f-category', '建企买卖');
  await sleep(400);
  const tradeState = await page.evaluate(() => {
    const card = document.getElementById('trade-detail-card');
    const fee = document.getElementById('fee-rows').textContent;
    return { cardShown: card && card.style.display !== 'none', fee, label: document.getElementById('price-label').textContent };
  });
  check('建企买卖→四要素卡显示', tradeState.cardShown);
  check('建企买卖→费用卡含押金5000', tradeState.fee.indexOf('5000') > -1 && tradeState.fee.indexOf('诚意保证金') > -1, tradeState.fee.slice(0, 80));
  check('建企买卖→价格标签=意向预算', tradeState.label.indexOf('意向预算') > -1, tradeState.label);

  // ============ T4 招聘：四要素隐藏 + 免费额度 ============
  await page.select('#f-category', '招聘');
  await sleep(400);
  const hireState = await page.evaluate(() => ({
    cardHidden: document.getElementById('trade-detail-card').style.display === 'none',
    fee: document.getElementById('fee-rows').textContent,
    label: document.getElementById('price-label').textContent
  }));
  check('招聘→四要素卡隐藏', hireState.cardHidden);
  check('招聘→费用卡免费额度', hireState.fee.indexOf('免费') > -1, hireState.fee.slice(0, 60));
  check('招聘→价格标签=薪资范围', hireState.label.indexOf('薪资范围') > -1, hireState.label);

  // ============ T5 资质招商：免费 ============
  await page.select('#f-category', '资质招商');
  await sleep(300);
  const feeFr = await page.evaluate(() => document.getElementById('fee-rows').textContent);
  check('资质招商→费用卡免费', feeFr.indexOf('免费') > -1, feeFr.slice(0, 50));

  // ============ T6 AI 识别 ============
  await page.evaluate(() => {
    document.getElementById('ai-input').value = '我要在成都收购一家带安许的水利水电三级公司，要求无负债，带2名一级建造师';
    document.getElementById('ai-generate').click();
  });
  await sleep(600);
  const aiState = await page.evaluate(() => ({
    cat: document.getElementById('f-category').value,
    title: document.getElementById('f-title').value
  }));
  check('AI识别收购→建企买卖', aiState.cat === '建企买卖', aiState.cat + ' / ' + aiState.title.slice(0, 30));
  const tradeShownAfterAi = await page.evaluate(() => document.getElementById('trade-detail-card').style.display !== 'none');
  check('AI后四要素卡自动显示', tradeShownAfterAi);

  // ============ T7 必填校验 ============
  await page.evaluate(() => { document.getElementById('f-trade-qual-cat').value = ''; });
  const btnDisabled = await page.evaluate(() => {
    document.getElementById('btn-next').click();
    return document.getElementById('btn-next').disabled;
  });
  check('建企买卖未选资质类别→下一步禁用', btnDisabled === true, 'disabled=' + btnDisabled);

  // ============ T8 建企买卖完整发布：押金冻结 + 成功页 + match ============
  await page.evaluate(() => {
    // 注入充足余额（BalanceStore）
    const bs = window.BalanceStore.read();
    bs.balance = 20000; bs.frozen = 0;
    window.BalanceStore.write(bs);
    document.getElementById('f-trade-qual-cat').value = '施工总承包';
    document.getElementById('f-trade-level').value = '三级';
    document.getElementById('f-trade-anxu').value = '带安许';
    document.getElementById('f-trade-region').value = '成都';
    document.getElementById('f-trade-debt').value = '无负债';
    document.getElementById('f-trade-staff').value = '带2名一级建造师';
    document.getElementById('f-trade-tax').value = '纳税信用B级及以上';
    document.getElementById('f-title').value = '收购 水利水电施工总承包三级 带安许 成都';
    document.getElementById('f-location').value = '成都市·成华区';
    document.getElementById('f-price').value = '30';
    document.getElementById('f-company').value = '成都测试投资有限公司';
    document.getElementById('f-contact-name').value = '测试';
    document.getElementById('f-contact-phone').value = '13800000000';
    document.getElementById('f-desc').value = '诚意收购水利水电施工总承包三级公司，要求带安许、无负债、可尽调，成都优先。';
    document.getElementById('agree').checked = true;
    document.getElementById('btn-submit').click();
  });
  await sleep(900);
  const tradeResult = await page.evaluate(() => {
    const sp = document.getElementById('success-page');
    const shown = sp && sp.classList.contains('show');
    const desc = document.getElementById('success-desc') ? document.getElementById('success-desc').textContent : '';
    const channel = document.getElementById('success-channel');
    const chHref = channel ? (channel.style.display !== 'none' ? channel.getAttribute('onclick') || 'visible' : 'hidden') : 'missing';
    const bs = window.BalanceStore.read();
    const s = window.SupplyStore.read();
    const mine = s.items.filter(x => x.publisher === 'u1' && x.source === 'user_publish');
    const last = mine[0] || {};
    return { shown, desc, chHref, frozen: bs.frozen, match: last.match, cat: last.cat, feeNote: last.feeNote, title: last.title, tradeInfo: last.tradeInfo, id: last.id };
  });
  check('建企买卖→成功页显示', tradeResult.shown);
  check('建企买卖→成功文案含押金', tradeResult.desc.indexOf('诚意保证金') > -1, tradeResult.desc.slice(0, 60));
  check('建企买卖→成功按钮跳转trade频道', tradeResult.chHref !== 'hidden' && tradeResult.chHref !== 'missing', String(tradeResult.chHref));
  check('建企买卖→押金冻结5000', tradeResult.frozen >= 5000, 'frozen=' + tradeResult.frozen);
  check('建企买卖→条目已入库', tradeResult.cat === '建企买卖', tradeResult.title);
  check('建企买卖→match已计算(>55)', typeof tradeResult.match === 'number' && tradeResult.match > 55, 'match=' + tradeResult.match);
  check('建企买卖→tradeInfo四要素完整', tradeResult.tradeInfo && tradeResult.tradeInfo.qualCat === '施工总承包' && tradeResult.tradeInfo.debt === '无负债' && tradeResult.tradeInfo.staff.indexOf('建造师') > -1, JSON.stringify(tradeResult.tradeInfo));
  check('建企买卖→feeNote=押金冻结', tradeResult.feeNote === '押金冻结', String(tradeResult.feeNote));

  // ============ T9 招聘免费发布 ============
  await page.goto(EDITOR + '?role=demand', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);
  const t9ready = await page.evaluate(() => ({
    ready: document.readyState,
    cat: document.getElementById('f-category').value,
    optHire: !!Array.from(document.getElementById('f-category').options).find(o => o.value === '招聘' && o.style.display !== 'none')
  }));
  console.log('  [dbg] T9 ready:', JSON.stringify(t9ready));
  await page.evaluate(() => {
    document.getElementById('f-category').value = '招聘';
    document.getElementById('f-category').dispatchEvent(new Event('change'));
  });
  await sleep(300);
  await page.evaluate(() => {
    document.getElementById('f-title').value = '招聘 一级建造师（房建） 成都 全职 15-20K';
    document.getElementById('f-location').value = '成都市·高新区';
    document.getElementById('f-price').value = '15-20K';
    document.getElementById('f-company').value = '四川测试建设有限公司';
    document.getElementById('f-contact-name').value = '测试';
    document.getElementById('f-contact-phone').value = '13800000000';
    document.getElementById('f-desc').value = '招聘一级建造师（房建方向），持证上岗，社保可转，能驻场，薪资15-20K。';
    document.getElementById('agree').checked = true;
  });
  console.log('  [dbg] T9 form filled');
  await page.evaluate(() => { document.getElementById('btn-submit').click(); });
  console.log('  [dbg] T9 submit clicked');
  await sleep(1200);
  const hireResult = await page.evaluate(() => {
    const sp = document.getElementById('success-page');
    const desc = document.getElementById('success-desc') ? document.getElementById('success-desc').textContent : '';
    const ch = document.getElementById('success-channel');
    const used = window.CreditStore.freeUsed();
    const s = window.SupplyStore.read();
    const mine = s.items.filter(x => x.source === 'user_publish' && x.publisher === 'u1');
    const last = mine[0] || {};
    return { shown: sp && sp.classList.contains('show'), desc, chHref: ch && ch.style.display !== 'none', used, cat: last.cat, match: last.match, feeNote: last.feeNote };
  });
  check('招聘→成功页显示', hireResult.shown);
  check('招聘→成功文案含人才库', hireResult.desc.indexOf('人才库') > -1, hireResult.desc.slice(0, 60));
  check('招聘→免费额度已扣1', hireResult.used === 1, 'used=' + hireResult.used);
  check('招聘→条目入库且match计算', hireResult.cat === '招聘' && hireResult.match > 55, 'match=' + hireResult.match);
  check('招聘→feeNote=免费额度-1', hireResult.feeNote === '免费额度 -1', String(hireResult.feeNote));

  // ============ T10 供应侧角色：求职可见、招聘隐藏 ============
  await page.goto(EDITOR + '?role=supply', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(700);
  const supplyOpts = await page.evaluate(() => Array.from(document.getElementById('f-category').options).filter(o => o.style.display !== 'none').map(o => o.value));
  check('供应侧：求职/建企买卖/资质招商可见，招聘隐藏', supplyOpts.includes('求职') && supplyOpts.includes('建企买卖') && supplyOpts.includes('资质招商') && !supplyOpts.includes('招聘'), supplyOpts.join('/'));

  // ============ T11 详情页闭环：发布条目 → 通用发布渲染器 + 四要素 ============
  if (tradeResult.id) {
    const detailErrors = [];
    const dpage = await browser.newPage();
    dpage.on('pageerror', e => detailErrors.push('PAGEERROR: ' + e.message));
    dpage.on('console', m => { if (m.type() === 'error') detailErrors.push(m.text()); });
    dpage.on('dialog', d => d.dismiss());
    await dpage.goto('file:///D:/Engchain3.0/pages/supply/detail.html?id=' + tradeResult.id, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1200);
    const det = await dpage.evaluate(() => ({
      title: document.getElementById('nav-title') ? document.getElementById('nav-title').textContent : '',
      heroText: document.querySelector('#hero') ? document.querySelector('#hero').textContent : '',
      bodyText: document.getElementById('body') ? document.getElementById('body').textContent : '',
      hasErrState: !!(document.querySelector('.e-title'))
    }));
    const body = det.heroText + det.bodyText;
    check('详情页→渲染为通用发布详情（非空态）', !det.hasErrState && body.length > 100, 'nav=' + det.title);
    check('详情页→标题与品类展示', body.indexOf('收购') > -1 && (body.indexOf('建企买卖') > -1 || body.indexOf('品类') > -1), det.title);
    check('详情页→四要素完整展示', body.indexOf('目标资质') > -1 && body.indexOf('负债要求') > -1 && body.indexOf('人员要求') > -1 && body.indexOf('税务要求') > -1);
    check('详情页→AI匹配展示', body.indexOf('AI匹配') > -1, '');
    check('详情页→无JS错误', detailErrors.filter(e => e.indexOf('favicon') < 0 && e.indexOf('bootcdn') < 0 && e.indexOf('404') < 0).length === 0, detailErrors.join(';').slice(0, 150));
    await dpage.close();
  } else {
    check('详情页→有可验证条目', false, 'no id');
  }

  // ============ 清理：恢复 localStorage ============
  await seed.evaluate((b) => {
    const keys = ['engchain-state','engchain-auth','engchain-balance','engchain-credits','engchain-supply'];
    keys.forEach(k => { if (b[k] !== undefined) localStorage.setItem(k, b[k]); else localStorage.removeItem(k); });
  }, backup);

  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
