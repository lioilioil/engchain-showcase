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
  p.on('pageerror', e => console.log('PAGE-ERROR:', e.message));
  await p.goto('file:///D:/Engchain3.0/pages/profile/index.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  /* 模拟登录态，让门票显示注册会员内容 */
  await p.evaluate(() => {
    localStorage.setItem('engchain-state', JSON.stringify({
      user: '陈建国', company: '四川省××建设有限公司', account: 'demo@engchain.cn',
      mobile: '13800138000', loggedIn: true, status: 'enterprise', member: true
    }));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  const info = await p.evaluate(() => {
    const secs = Array.prototype.map.call(document.querySelectorAll('.id-ticket .tk-sec'), el => ({
      cls: el.className,
      text: el.textContent.replace(/\s+/g, ' ').slice(0, 50)
    }));
    const guide = document.querySelector('.tk-sec-guide');
    return {
      sections: secs,
      guideClickable: !!guide && guide.getAttribute('onclick') === 'openMember()',
      ids: ['pf-ring-level','pf-ring-fg','pf-id-status','pf-id-leveltag','pf-id-pills','pf-guide-text'].every(id => !!document.getElementById(id))
    };
  });
  console.log('TICKET:', JSON.stringify(info, null, 2));
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/dg_ticket_3sec.png' });
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
