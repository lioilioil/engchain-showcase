const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: PROFILE, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 900 }, protocolTimeout: 60000
  });
  const p = await browser.newPage();
  p.on('console', m => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
  await p.goto('file:///D:/Engchain3.0/pages/franchise/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));

  const state = async (tag) => {
    const s = await p.evaluate(() => {
      const scroll = document.querySelector('.scroll');
      const bar = document.getElementById('stickyFilterBar');
      const sheet = document.getElementById('filterSheet');
      const mask = document.getElementById('filterMask');
      const navbar = document.querySelector('.navbar');
      const hero = document.querySelector('.fz-hero');
      const fullList = document.getElementById('fullList');
      const rr = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; };
      return {
        scrollTop: Math.round(scroll.scrollTop),
        scrollH: scroll.scrollHeight,
        clientH: scroll.clientHeight,
        navbar: rr(navbar),
        hero: rr(hero),
        bar: rr(bar),
        fullList: rr(fullList),
        sheet: rr(sheet),
        sheetShow: sheet.classList.contains('show'),
        maskShow: mask.classList.contains('show'),
        sheetTransform: getComputedStyle(sheet).transform,
        winScrollY: Math.round(window.scrollY)
      };
    });
    console.log('=== ' + tag + ' ===');
    console.log(JSON.stringify(s, null, 1));
    await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_' + tag + '.png' });
  };

  await state('before');

  await p.click('#heroFind');
  await new Promise(r => setTimeout(r, 1600));
  await state('after-click-heroFind');

  // 再点一次看是否二次触发
  await p.click('#heroFind');
  await new Promise(r => setTimeout(r, 1600));
  await state('after-second-click');

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(2); });
