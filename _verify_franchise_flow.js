const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
const INDEX = 'file:///D:/Engchain3.0/pages/franchise/index.html';
const EDIT = 'file:///D:/Engchain3.0/pages/franchise/delegate-edit.html';
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
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });

  /* ============ 场景 1：立即找资质 滚动修复 ============ */
  await p.goto(INDEX, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));

  const snap = () => p.evaluate(() => {
    const sc = document.querySelector('.scroll');
    const phone = document.querySelector('.phone');
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    return {
      scrollTop: Math.round(sc.scrollTop),
      phoneScrollTop: Math.round(phone.scrollTop),
      navbar: r(document.querySelector('.navbar')),
      bar: r(document.getElementById('stickyFilterBar')),
      sheet: r(document.getElementById('filterSheet')),
      sheetShow: document.getElementById('filterSheet').classList.contains('show'),
      maskShow: document.getElementById('filterMask').classList.contains('show'),
      winScrollY: Math.round(window.scrollY)
    };
  });

  let s = await snap();
  check('初始：导航栏可见(top=44)', s.navbar && s.navbar.top === 44, JSON.stringify(s.navbar));
  check('初始：phone 未滚动', s.phoneScrollTop === 0);
  check('初始：筛选面板不可见(top>=900)', s.sheet.top >= 900, 'top=' + s.sheet.top);

  await p.click('#heroFind');
  await new Promise(r => setTimeout(r, 1800));
  s = await snap();
  check('heroFind后：phone 未滚动(0)', s.phoneScrollTop === 0, 'phoneScrollTop=' + s.phoneScrollTop);
  check('heroFind后：导航栏仍可见(top=44)', s.navbar && s.navbar.top === 44, JSON.stringify(s.navbar));
  check('heroFind后：筛选面板未弹出(无show且top>=900)', !s.sheetShow && s.sheet.top >= 900, 'top=' + s.sheet.top + ' show=' + s.sheetShow);
  check('heroFind后：吸顶栏置顶固定(top=94=导航栏下)', s.bar && s.bar.top === 94, 'bar.top=' + (s.bar && s.bar.top));
  check('heroFind后：窗口未滚动', s.winScrollY === 0);

  /* viewAll 同样修复 */
  await p.click('#viewAll');
  await new Promise(r => setTimeout(r, 1800));
  s = await snap();
  check('viewAll后：phone 未滚动', s.phoneScrollTop === 0);
  check('viewAll后：导航栏仍可见', s.navbar && s.navbar.top === 44);
  check('viewAll后：筛选面板未弹出', !s.sheetShow && s.sheet.top >= 900);

  /* ============ 场景 2：提交委托 表单弹窗 ============ */
  await p.evaluate(() => localStorage.removeItem('franchise_delegate_v1'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  let btnText = await p.$eval('#heroDelegate', el => el.textContent.trim());
  check('初始按钮文本=提交委托', btnText === '提交委托', btnText);

  await p.click('#heroDelegate');
  await new Promise(r => setTimeout(r, 400));
  let formShow = await p.evaluate(() => document.getElementById('delegateFormModal').classList.contains('show'));
  check('点击提交委托 → 表单弹窗打开', formShow);
  let notes = await p.evaluate(() => document.querySelectorAll('.dfm-notes li').length);
  check('表单含注意事项(≥4条)', notes >= 4, 'li count=' + notes);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_form_modal.png' });

  /* 必填校验 */
  await p.click('#delegateFormSubmit');
  await new Promise(r => setTimeout(r, 300));
  formShow = await p.evaluate(() => document.getElementById('delegateFormModal').classList.contains('show'));
  check('空表单提交被拦截（弹窗仍在）', formShow);

  /* 填表并提交 */
  await p.evaluate(() => {
    document.getElementById('dfRegion').value = '四川成都';
    document.getElementById('dfContact').value = '张三';
    document.getElementById('dfPhone').value = '13800138000';
    document.getElementById('dfNote').value = '需要一级总包，预算 20 万';
  });
  await p.click('#delegateFormSubmit');
  await new Promise(r => setTimeout(r, 500));
  formShow = await p.evaluate(() => document.getElementById('delegateFormModal').classList.contains('show'));
  check('合法提交后表单关闭', !formShow);
  btnText = await p.$eval('#heroDelegate', el => el.textContent.trim());
  check('提交后按钮=已提交委托', btnText.indexOf('已提交委托') > -1, btnText);
  let stored = await p.evaluate(() => JSON.parse(localStorage.getItem('franchise_delegate_v1')));
  check('localStorage 已存委托', !!stored);
  check('状态=等待承接', stored && stored.status === '等待承接', stored && stored.status);
  check('提交时间已记录', !!stored.submitTime);

  /* 再次点击 → 详情弹窗（等待承接 → 修改委托） */
  await p.click('#heroDelegate');
  await new Promise(r => setTimeout(r, 400));
  let detailShow = await p.evaluate(() => document.getElementById('delegateDetailModal').classList.contains('show'));
  check('再次点击 → 详情弹窗打开', detailShow);
  let detail = await p.evaluate(() => {
    const d = document.getElementById('delegateDetailModal');
    return {
      status: d.querySelector('.dd-status') ? d.querySelector('.dd-status').textContent.trim() : '',
      hasEdit: !!d.querySelector('#ddmEdit'),
      hasService: !!d.querySelector('#ddmOnlineService'),
      rows: d.querySelectorAll('.dd-row').length
    };
  });
  check('详情状态=等待承接', detail.status === '等待承接', detail.status);
  check('等待承接 → 显示修改按钮', detail.hasEdit);
  check('等待承接 → 不显示客服按钮', !detail.hasService);
  check('详情字段行≥9', detail.rows >= 9, 'rows=' + detail.rows);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_detail_pending.png' });

  /* 点修改 → 进入修改页 */
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    p.click('#ddmEdit')
  ]);
  await new Promise(r => setTimeout(r, 800));
  check('修改按钮 → 跳转修改页', p.url().indexOf('delegate-edit.html') > -1, p.url());
  const editState = await p.evaluate(() => {
    return {
      region: document.getElementById('dfRegion') ? document.getElementById('dfRegion').value : null,
      contact: document.getElementById('dfContact') ? document.getElementById('dfContact').value : null,
      phone: document.getElementById('dfPhone') ? document.getElementById('dfPhone').value : null,
      qualType: document.getElementById('dfQualType') ? document.getElementById('dfQualType').value : null,
      status: document.querySelector('.dd-status') ? document.querySelector('.dd-status').textContent.trim() : ''
    };
  });
  check('修改页预填地区', editState.region === '四川成都', editState.region);
  check('修改页预填联系人', editState.contact === '张三', editState.contact);
  check('修改页预填电话', editState.phone === '13800138000', editState.phone);
  check('修改页预填资质类型', editState.qualType === '施工总承包', editState.qualType);
  check('修改页显示当前状态', editState.status === '等待承接', editState.status);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_edit_page.png' });

  /* 修改并保存 → 返回首页 */
  await p.evaluate(() => {
    document.getElementById('dfRegion').value = '重庆';
    document.getElementById('dfNote').value = '已修改：需要一级总包，预算 25 万';
  });
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    p.click('#deSaveBtn')
  ]);
  await new Promise(r => setTimeout(r, 1500));
  check('保存后返回首页', p.url().indexOf('index.html') > -1, p.url());
  stored = await p.evaluate(() => JSON.parse(localStorage.getItem('franchise_delegate_v1')));
  check('保存后地区已更新=重庆', stored && stored.region === '重庆', stored && stored.region);
  check('保存后状态回到等待承接', stored && stored.status === '等待承接');
  check('保存后更新时间已记录', !!stored.updateTime);
  btnText = await p.$eval('#heroDelegate', el => el.textContent.trim());
  check('返回后按钮=已提交委托', btnText.indexOf('已提交委托') > -1, btnText);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_after_edit.png' });

  /* ============ 场景 3：已驳回 → 可修改 ============ */
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('franchise_delegate_v1')); d.status = '已驳回'; localStorage.setItem('franchise_delegate_v1', JSON.stringify(d)); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  await p.click('#heroDelegate');
  await new Promise(r => setTimeout(r, 400));
  detail = await p.evaluate(() => {
    const d = document.getElementById('delegateDetailModal');
    return { status: d.querySelector('.dd-status').textContent.trim(), hasEdit: !!d.querySelector('#ddmEdit'), hasService: !!d.querySelector('#ddmOnlineService') };
  });
  check('已驳回 → 状态显示已驳回', detail.status === '已驳回', detail.status);
  check('已驳回 → 可修改', detail.hasEdit && !detail.hasService);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_detail_rejected.png' });

  /* ============ 场景 4：已承接 → 客服入口，不可修改 ============ */
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('franchise_delegate_v1')); d.status = '已承接'; localStorage.setItem('franchise_delegate_v1', JSON.stringify(d)); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  await p.click('#heroDelegate');
  await new Promise(r => setTimeout(r, 400));
  detail = await p.evaluate(() => {
    const d = document.getElementById('delegateDetailModal');
    return { status: d.querySelector('.dd-status').textContent.trim(), hasEdit: !!d.querySelector('#ddmEdit'), hasService: !!d.querySelector('#ddmOnlineService') };
  });
  check('已承接 → 状态显示已承接', detail.status === '已承接', detail.status);
  check('已承接 → 无修改按钮', !detail.hasEdit);
  check('已承接 → 有客服入口', detail.hasService);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_detail_accepted.png' });

  /* 客服入口可点击 */
  await p.click('#ddmOnlineService');
  await new Promise(r => setTimeout(r, 400));
  const sheetOpen = await p.evaluate(() => !!document.querySelector('.sheet.show'));
  check('已承接 → 在线客服面板可打开', sheetOpen);
  await p.screenshot({ path: 'D:/Engchain3.0/_verify_shots/fz_service_sheet.png' });

  /* ============ 场景 5：空状态/页脚入口 ============ */
  await p.evaluate(() => localStorage.removeItem('franchise_delegate_v1'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  await p.evaluate(() => { document.querySelector('.scroll').scrollTop = 3000; });
  await new Promise(r => setTimeout(r, 300));
  const hasFooter = await p.evaluate(() => !!document.querySelector('.list-footer, .lf-actions'));
  if (hasFooter) {
    await p.evaluate(() => { const b = [...document.querySelectorAll('button, a')].find(x => x.textContent.indexOf('发布招商需求') > -1); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 400));
    formShow = await p.evaluate(() => document.getElementById('delegateFormModal').classList.contains('show'));
    check('空态/页脚入口 → 无委托时打开表单', formShow);
  } else {
    console.log('SKIP | 页脚未出现（列表未到底）');
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL PASS' : ('FAILURES: ' + failures));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERR', e); process.exit(2); });
