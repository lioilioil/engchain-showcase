const { chromium } = require('playwright');
const EXE = 'C:/Users/36434/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const ROOT = 'file:///D:/Engchain3.0/';
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(ROOT + 'home.html'); await p.waitForTimeout(1400);
  await p.click('#app-location'); await p.waitForTimeout(700);
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.cs-alpha-bar button')].find(x => x.textContent.trim() === 'T');
    window.__btn = btn; btn.focus();
  });
  console.log('FOCUSED:', await p.evaluate(() => document.activeElement.textContent.trim()));
  await p.keyboard.press('Enter');
  await p.waitForTimeout(900);
  console.log('ENTER:', JSON.stringify(await p.evaluate(() => {
    const body = document.querySelector('.sheet.city-sheet .sheet-body');
    const grp = document.querySelector('.cs-alpha-group[data-l="T"]');
    return { offset: Math.round(grp.getBoundingClientRect().top - body.getBoundingClientRect().top), active: window.__btn.classList.contains('active'), bubble: document.querySelector('.cs-alpha-bubble').classList.contains('show') };
  })));
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
