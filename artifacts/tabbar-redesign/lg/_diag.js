const puppeteer = require('puppeteer-core');
const URL = 'http://127.0.0.1:8765/home-liquidglass.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle']
  });
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.evaluateOnNewDocument(() => {
    window.__probe = { docEl: !!document.documentElement, head: !!document.head };
    try {
      const s = document.createElement('style');
      s.id = 'old-css-probe';
      s.textContent = ':root{ --lg-h: 64px !important; }';
      document.documentElement.appendChild(s);
      window.__probe.appended = true;
    } catch (e) { window.__probe.err = String(e); }
  });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(2000);
  console.log(await page.evaluate(() => ({
    probe: window.__probe,
    hasProbeStyle: !!document.getElementById('old-css-probe'),
    probeParent: document.getElementById('old-css-probe') ? document.getElementById('old-css-probe').parentNode.nodeName : null,
    lgH: getComputedStyle(document.documentElement).getPropertyValue('--lg-h'),
    barH: document.querySelector('.app-tabbar').getBoundingClientRect().height,
    styleOrder: [...document.querySelectorAll('style')].map(s => s.id || '(no id)').slice(-6)
  })));
  await browser.close();
})();
