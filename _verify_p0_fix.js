const puppeteer = require('D:/Engchain3.0/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT_DIR = 'D:/Engchain3.0/_verify_shots/p0_fix_verify';
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function setIdentity(page, type, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.clear();
    if (t === 'partner') {
      localStorage.setItem('engchain-auth', JSON.stringify({
        realname: { ok: true, name: '陈建国' },
        partner: { ok: true }
      }));
      localStorage.setItem('engchain-state', JSON.stringify({ status: 'partner', loggedIn: true }));
    } else if (t === 'realname') {
      localStorage.setItem('engchain-auth', JSON.stringify({
        realname: { ok: true, name: '陈建国' }
      }));
      localStorage.setItem('engchain-state', JSON.stringify({ status: 'realname', loggedIn: true }));
    } else if (t === 'guest') {
      localStorage.setItem('engchain-state', JSON.stringify({ status: 'guest', loggedIn: false }));
    }
  }, type);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=420,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  const results = [];

  // Test 1: Personal partner on material detail (id=1001)
  await setIdentity(page, 'partner', 'http://localhost:8765/pages/supply/detail.html?id=1001');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const ctaPartner = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  await page.screenshot({ path: path.join(SHOT_DIR, '01_partner_material_1001.png'), fullPage: false });
  results.push({ test: '个人合伙人_材料详情', cta: ctaPartner, expect: '免费解锁', pass: ctaPartner.indexOf('免费') >= 0 || ctaPartner.indexOf('积分') >= 0 });

  // Test 2: Personal partner on talent detail (find a talent id)
  await setIdentity(page, 'partner', 'http://localhost:8765/pages/supply/detail.html?id=talent1');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const ctaPartnerTalent = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  await page.screenshot({ path: path.join(SHOT_DIR, '02_partner_talent_talent1.png'), fullPage: false });
  results.push({ test: '个人合伙人_人才详情', cta: ctaPartnerTalent, expect: '免费解锁/动态积分', pass: ctaPartnerTalent.indexOf('免费') >= 0 || ctaPartnerTalent.indexOf('积分') >= 0 });

  // Test 3: Realname user on talent detail - should show free quota
  await setIdentity(page, 'realname', 'http://localhost:8765/pages/supply/detail.html?id=talent1');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const ctaRealnameTalent = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  await page.screenshot({ path: path.join(SHOT_DIR, '03_realname_talent_talent1.png'), fullPage: false });
  results.push({ test: '已实名_人才详情', cta: ctaRealnameTalent, expect: '免费解锁（本月剩X条）', pass: ctaRealnameTalent.indexOf('免费') >= 0 });

  // Test 4: Guest on material - breakin period free sample
  await setIdentity(page, 'guest', 'http://localhost:8765/pages/supply/detail.html?id=1001');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const ctaGuest = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  await page.screenshot({ path: path.join(SHOT_DIR, '04_guest_material_1001.png'), fullPage: false });
  results.push({ test: '游客_材料详情', cta: ctaGuest, expect: '免费查看（游客福利）', pass: ctaGuest.indexOf('免费') >= 0 || ctaGuest.indexOf('登录') >= 0 });

  console.log('\n=== P0 Fix Verification Results ===');
  results.forEach(r => {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.test}`);
    console.log(`  CTA: "${r.cta}" (expected: ${r.expect})`);
  });
  const allPass = results.every(r => r.pass);
  console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);
  console.log(`Screenshots saved to: ${SHOT_DIR}`);

  await browser.close();
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
