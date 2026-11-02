const { chromium } = require('playwright');
const EXE = 'C:/Users/36434/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const ROOT = 'file:///D:/Engchain3.0/';
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(ROOT + 'home.html'); await p.waitForTimeout(1400);
  await p.click('#app-location'); await p.waitForTimeout(700);
  const target = await p.evaluate(() => {
    const body = document.querySelector('.sheet.city-sheet .sheet-body');
    const grp = document.querySelector('.cs-alpha-group[data-l="T"]');
    return { want: Math.round(body.scrollTop + grp.getBoundingClientRect().top - body.getBoundingClientRect().top), max: body.scrollHeight - body.clientHeight };
  });
  console.log('TARGET:', JSON.stringify(target));
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.cs-alpha-bar button')].find(x => x.textContent.trim() === 'T');
    window.__btn = btn; btn.focus();
  });
  await p.keyboard.press('Enter');
  for (let i = 0; i < 10; i++) {
    console.log(i * 150 + 'ms', await p.evaluate(() => Math.round(document.querySelector('.sheet.city-sheet .sheet-body').scrollTop)));
    await p.waitForTimeout(150);
  }
  await b.close();
})();
