const puppeteer = require('D:/Engchain3.0/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT = 'D:/Engchain3.0/_verify_shots/round2_fix';
if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:8765/pages/supply/detail.html?id=';

async function setup(page, state) {
  await page.goto(BASE + '1001', { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.clear();
    if (s.guest) {
      localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: false }));
    } else if (s.realname) {
      localStorage.setItem('engchain-auth', JSON.stringify({ realname: { ok: true, name: '陈建国' } }));
      localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, status: 'realname' }));
    } else if (s.partner) {
      localStorage.setItem('engchain-auth', JSON.stringify({ realname: { ok: true }, partner: { ok: true } }));
      localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, status: 'partner' }));
    } else if (s.registered) {
      localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, status: 'registered' }));
    }
    if (s.credits != null) {
      localStorage.setItem('engchain-credits', JSON.stringify({
        balance: s.credits,
        logs: [],
        quota: { month: '2026-9', used: s.freeUsed || 8 }
      }));
    }
  }, state);
}

async function shot(page, name) {
  await sleep(1200);
  await page.screenshot({ path: path.join(SHOT, name + '.png'), fullPage: false });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--window-size=420,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });
  const results = [];

  // === P1-1: isGuest unified ===
  await setup(page, { guest: true });
  await page.goto(BASE + '1001', { waitUntil: 'domcontentloaded' });
  const cta1 = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  await shot(page, 'P1-1_guest_material');
  results.push({ test: 'P1-1 isGuest统一', cta: cta1, pass: cta1.indexOf('免费查看') >= 0 || cta1.indexOf('登录') >= 0 });

  // === P1-2: franchise free consult ===
  await setup(page, { realname: true });
  await page.goto(BASE + 'f1', { waitUntil: 'domcontentloaded' });
  const cta2 = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  await shot(page, 'P1-2_franchise_CTA');
  results.push({ test: 'P1-2 franchise免费咨询CTA', cta: cta2, pass: cta2.indexOf('免费咨询') >= 0 });

  // === P1-3: personnel CTA dynamic ===
  await setup(page, { guest: true });
  await page.goto(BASE + 'p1', { waitUntil: 'domcontentloaded' });
  const cta3g = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  await shot(page, 'P1-3_personnel_guest');
  await setup(page, { registered: true });
  await page.goto(BASE + 'p1', { waitUntil: 'domcontentloaded' });
  const cta3r = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  await shot(page, 'P1-3_personnel_registered');
  results.push({ test: 'P1-3 personnel游客CTA', cta: cta3g, pass: cta3g.indexOf('登录') >= 0 });
  results.push({ test: 'P1-3 personnel未入驻CTA', cta: cta3r, pass: cta3r.indexOf('入驻') >= 0 || cta3r.indexOf('简历') >= 0 });

  // === P2-5: agency free visual ===
  await setup(page, { realname: true });
  await page.goto(BASE + 'a1', { waitUntil: 'domcontentloaded' });
  const cta4 = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  const agencyHtml = await page.evaluate(() => document.body.innerHTML).catch(() => '');
  const hasGreenBanner = agencyHtml.indexOf('success-soft') >= 0;
  const hasFreeText = agencyHtml.indexOf('免费咨询后可见') >= 0;
  await shot(page, 'P2-5_agency_visual');
  results.push({ test: 'P2-5 agency免费视觉', cta: cta4, greenBanner: hasGreenBanner, freeText: hasFreeText, pass: hasGreenBanner && hasFreeText });

  // === P2-6: credit insufficient dialog ===
  await setup(page, { realname: true, credits: 10, freeUsed: 8 });
  await page.goto(BASE + '1001', { waitUntil: 'domcontentloaded' });
  const cta5 = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  await shot(page, 'P2-6_creditInsufficient_CTA');
  await page.click('#cta');
  await sleep(1000);
  const dialogVisible = await page.evaluate(() => {
    return document.body.innerHTML.indexOf('积分不足') >= 0 && document.body.innerHTML.indexOf('98') >= 0;
  }).catch(() => false);
  await shot(page, 'P2-6_creditInsufficient_dialog');
  results.push({ test: 'P2-6 积分不足弹窗', cta: cta5, dialog: dialogVisible, pass: dialogVisible });

  // === P3-7: personal partner discount (98*0.8=78) ===
  await setup(page, { partner: true, credits: 100, freeUsed: 8 });
  await page.goto(BASE + '1001', { waitUntil: 'domcontentloaded' });
  const cta6 = await page.$eval('#cta', el => el.textContent.trim()).catch(() => 'ERR');
  await shot(page, 'P3-7_partner_discount');
  results.push({ test: 'P3-7 合伙人折扣(98*0.8=78)', cta: cta6, pass: cta6.indexOf('78') >= 0 });

  // === P3-8: commission display ===
  await setup(page, { realname: true });
  await page.goto(BASE + '1001', { waitUntil: 'domcontentloaded' });
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(500);
  const hasComm = await page.evaluate(() => document.body.innerHTML.indexOf('平台服务费') >= 0).catch(() => false);
  await shot(page, 'P3-8_material_commission');
  results.push({ test: 'P3-8 材料佣金展示', hasCommission: hasComm, pass: hasComm });

  // === Summary ===
  console.log('\n========== Round 2 Fix Verification (v2) ==========');
  let pass = 0, total = 0;
  results.forEach(r => {
    total++;
    if (r.pass) pass++;
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.test}`);
    console.log(`       ${JSON.stringify(r).substring(0, 150)}`);
  });
  console.log(`\nTotal: ${pass}/${total} passed`);
  console.log(`Screenshots: ${SHOT}`);

  await browser.close();
  process.exit(pass === total ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
