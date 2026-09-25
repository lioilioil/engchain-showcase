/* Vendor smoke test: does the vendored Liquid Glass actually run as WebGL2 here?
   Serves the package over HTTP (ES modules need a real origin) and drives system Chrome.
   Runs each surface in isolation to measure its real WebGL2 context cost. */
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8791;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? '_verify/index.html' : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
});

const MODES = ['none', 'card', 'dock', 'switch', 'nav', 'all'];

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 420, height: 620, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--enable-unsafe-swiftshader'],
  });

  const table = [];
  for (const mode of MODES) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/_verify/index.html?only=${mode}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction('window.__lgDone === true', { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, mode === 'all' ? 1800 : 1200));

    const r = await page.evaluate(() => window.__lgResult);
    table.push({
      mode,
      webgl2: r.liveContexts.webgl2,
      canvas2d: r.liveContexts.canvas2d,
      byOwner: r.liveContexts.byOwner,
      canvases: r.canvases,
      cardMode: r.card?.mode ?? null,
      errors: r.errors.concat(errs),
    });

    if (mode === 'all') await page.screenshot({ path: path.join(__dirname, 'smoke.png') });
    if (mode === 'none') {
      console.log('--- V2 contract checks (mode=none) ---');
      console.log('  material is V2 set :', r.isV2, `(${r.materialCount} params)`);
      console.log('  slider count       :', r.sliderCount);
      console.log('  V1 key throws      :', r.v1KeyThrows, '|', r.v1KeyMessage || '');
      console.log('  failed mount leaks :', r.reportHasCanvas ? 'YES (bug)' : 'no');
      console.log('  element attr       :', r.elementAttr);
    }
    await page.close();
  }

  console.log('\n--- WebGL2 context cost per surface (isolated) ---');
  const base = table.find(t => t.mode === 'none').webgl2;
  for (const t of table) {
    const delta = t.webgl2 - base;
    console.log(
      `  ${t.mode.padEnd(7)} total=${String(t.webgl2).padStart(2)}` +
      `  (${delta >= 0 ? '+' : ''}${delta} vs baseline)` +
      `  canvases=${t.canvases}  cardMode=${t.cardMode ?? '-'}`,
    );
  }
  const bad = table.filter(t => t.errors.length);
  console.log('\n--- errors ---');
  console.log(bad.length ? bad.map(t => `${t.mode}: ${t.errors.join('; ')}`).join('\n') : '  none');
  console.log('\nscreenshot: _verify/smoke.png');

  await browser.close();
  server.close();
})().catch(e => { console.error('HARNESS FAILED:', e); server.close(); process.exit(1); });
