const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
const INDEX = 'file:///D:/Engchain3.0/pages/franchise/index.html';
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
  if (!cond) failures++;
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: PROFILE, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 900 }, protocolTimeout: 60000
  });
  const p = await browser.newPage();
  p.on('pageerror', e => { console.log('PAGE-ERROR:', e.message); failures++; });

  /* ---- 空状态入口（无委托 → 表单） ---- */
  await p.goto(INDEX, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await p.evaluate(() => localStorage.removeItem('franchise_delegate_v1'));
  // 制造空结果：打开筛选面板选择组合条件
  await p.click('#filterBtn');
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => {
    // 选中 水利公路 + 甲级 + 已认证 + 名额紧张 + 资质联营（大概率无结果）
    const tags = document.querySelectorAll('.fs-tag');
    const pick = (txt) => { for (const t of tags) if (t.textContent === txt) { t.click(); return; } };
    pick('水利公路'); pick('甲级'); pick('已认证'); pick('名额紧张'); pick('资质联营');
  });
  await new Promise(r => setTimeout(r, 300));
  await p.click('#filterConfirm');
  await new Promise(r => setTimeout(r, 600));
  const emptyVisible = await p.evaluate(() => !!document.querySelector('.empty-state'));
  check('无结果时显示空状态', emptyVisible);
  const hasDelegateBtn = await p.evaluate(() => !!document.getElementById('emptyDelegate'));
  check('空状态含「发布招商需求」按钮', hasDelegateBtn);
  await p.click('#emptyDelegate');
  await new Promise(r => setTimeout(r, 400));
  const formShow = await p.evaluate(() => document.getElementById('delegateFormModal').classList.contains('show'));
  check('空状态入口（无委托）→ 表单弹窗', formShow);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_empty_entry_form.png' });
  // 关闭表单
  await p.click('#delegateFormClose');
  await new Promise(r => setTimeout(r, 300));

  /* 有委托时，空状态入口 → 详情弹窗 */
  await p.evaluate(() => {
    localStorage.setItem('franchise_delegate_v1', JSON.stringify({ id: 'W12345678', qualType: '施工总承包', qualLevel: '一级', region: '成都', mode: '分公司加盟', contact: '李四', phone: '13900139000', note: '', status: '等待承接', submitTime: '2026-09-09 10:00' }));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  // 重新制造空结果
  await p.click('#filterBtn');
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => {
    const tags = document.querySelectorAll('.fs-tag');
    const pick = (txt) => { for (const t of tags) if (t.textContent === txt) { t.click(); return; } };
    pick('水利公路'); pick('甲级'); pick('已认证'); pick('名额紧张'); pick('资质联营');
  });
  await new Promise(r => setTimeout(r, 300));
  await p.click('#filterConfirm');
  await new Promise(r => setTimeout(r, 600));
  const emptyVisible2 = await p.evaluate(() => !!document.querySelector('.empty-state'));
  check('（有委托）无结果时仍显示空状态', emptyVisible2);
  await p.click('#emptyDelegate');
  await new Promise(r => setTimeout(r, 400));
  const detailShow = await p.evaluate(() => document.getElementById('delegateDetailModal').classList.contains('show'));
  check('空状态入口（有委托）→ 详情弹窗', detailShow);
  await p.click('#delegateDetailClose');
  await new Promise(r => setTimeout(r, 300));

  /* ---- 页脚入口（加载到底 → 发布招商需求） ---- */
  await p.evaluate(() => { document.getElementById('filterReset').click(); });
  await new Promise(r => setTimeout(r, 300));
  await p.click('#filterConfirm');
  await new Promise(r => setTimeout(r, 500));
  // 循环点击加载更多直到页脚出现
  let footerFound = false;
  for (let i = 0; i < 12; i++) {
    const lm = await p.evaluate(() => {
      const el = document.getElementById('loadMore');
      if (el && el.style.display !== 'none') { el.click(); return 'clicked'; }
      return 'hidden';
    });
    if (lm === 'hidden') { footerFound = true; break; }
    await new Promise(r => setTimeout(r, 300));
  }
  const footerBtn = await p.evaluate(() => {
    const els = [...document.querySelectorAll('button, a')];
    const b = els.find(x => x.textContent.indexOf('发布招商需求') > -1);
    if (b) { b.click(); return true; }
    return false;
  });
  check('页脚「发布招商需求」可点击', footerBtn);
  await new Promise(r => setTimeout(r, 400));
  const detailShow2 = await p.evaluate(() => document.getElementById('delegateDetailModal').classList.contains('show'));
  check('页脚入口（有委托）→ 详情弹窗', detailShow2);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_footer_entry_detail.png' });

  await browser.close();
  console.log(failures === 0 ? 'ALL PASS' : ('FAILURES: ' + failures));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERR', e); process.exit(2); });
