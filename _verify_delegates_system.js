const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const PROFILE = path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
const SHOTS = 'D:/Engchain3.0/_verify_shots';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) {}

const F_INDEX = 'file:///D:/Engchain3.0/pages/franchise/index.html';
const F_EDIT = 'file:///D:/Engchain3.0/pages/franchise/delegate-edit.html';
const P_INDEX = 'file:///D:/Engchain3.0/pages/profile/index.html';
const P_LIST = 'file:///D:/Engchain3.0/pages/profile/delegates.html';
const P_NEW = 'file:///D:/Engchain3.0/pages/profile/delegate-new.html';
const P_DETAIL = 'file:///D:/Engchain3.0/pages/profile/delegate-detail.html';
const P_EDIT = 'file:///D:/Engchain3.0/pages/profile/delegate-edit.html';
const T_INDEX = 'file:///D:/Engchain3.0/pages/trade/index.html';
const PE_INDEX = 'file:///D:/Engchain3.0/pages/personnel/index.html';

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
  if (!cond) failures++;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: PROFILE, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 900 }, protocolTimeout: 60000
  });
  const p = await browser.newPage();
  p.on('pageerror', e => { console.log('PAGE-ERROR:', e.message); failures++; });
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });

  /* 登录态（模拟已登录账号：陈建国 / 13800138000） */
  async function seedLogin() {
    await p.evaluate(() => {
      localStorage.setItem('engchain-state', JSON.stringify({
        user: '陈建国', company: '四川省××建设有限公司', account: 'demo@engchain.cn',
        mobile: '13800138000', loggedIn: true, status: 'enterprise', member: true
      }));
    });
  }
  async function clearDelegates() {
    await p.evaluate(() => {
      localStorage.removeItem('engchain_delegates');
      localStorage.removeItem('franchise_delegate_v1');
    });
  }
  async function delegates() {
    return p.evaluate(() => JSON.parse(localStorage.getItem('engchain_delegates') || '[]'));
  }
  async function shot(name) { try { await p.screenshot({ path: path.join(SHOTS, name) }); } catch (e) {} }

  /* ==================== A. franchise 首页：滚动回归 ==================== */
  await p.goto(F_INDEX, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1000);
  const snap = () => p.evaluate(() => {
    const sc = document.querySelector('.scroll');
    const phone = document.querySelector('.phone');
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top) }; };
    return {
      scrollTop: Math.round(sc.scrollTop),
      phoneScrollTop: Math.round(phone.scrollTop),
      navbar: r(document.querySelector('.navbar')),
      bar: r(document.getElementById('stickyFilterBar')),
      sheetTop: r(document.getElementById('filterSheet')).top,
      sheetShow: document.getElementById('filterSheet').classList.contains('show')
    };
  });
  let s = await snap();
  check('F-滚动-初始导航栏可见', s.navbar && s.navbar.top === 44, JSON.stringify(s.navbar));
  await p.click('#heroFind');
  await wait(1800);
  s = await snap();
  check('F-滚动-heroFind后 phone未滚动', s.phoneScrollTop === 0, 'scroll=' + s.phoneScrollTop);
  check('F-滚动-heroFind后 导航栏仍在', s.navbar && s.navbar.top === 44, JSON.stringify(s.navbar));
  check('F-滚动-heroFind后 筛选面板未弹出', !s.sheetShow && s.sheetTop >= 900, 'top=' + s.sheetTop);
  check('F-滚动-heroFind后 吸顶栏 top=94', s.bar && s.bar.top === 94, 'top=' + (s.bar && s.bar.top));

  /* ==================== B. franchise 委托：表单/预填/地区修正/提交/详情/三态 ==================== */
  await clearDelegates();
  await p.evaluate(() => localStorage.removeItem('engchain-state'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(1000);
  let btn = await p.$eval('#heroDelegate', el => el.textContent.trim());
  check('F-表单-初始按钮=提交委托', btn === '提交委托', btn);

  await p.click('#heroDelegate');
  await wait(800);
  check('F-表单-弹窗已打开', await p.$eval('#delegateFormModal', el => el.classList.contains('show')));
  check('F-表单-共享表单已渲染(chips)', (await p.$$('#delegateFormRoot .dg-chip')).length >= 8, 'chips=' + (await p.$$('#delegateFormRoot .dg-chip')).length);
  check('F-表单-认证联系人预填', await p.$eval('#delegateFormRoot #dfContact', el => el.value) === '陈建国');
  check('F-表单-认证电话预填', await p.$eval('#delegateFormRoot #dfPhone', el => el.value) === '13800138000');

  /* 地区自动修正：输入「成都」失焦 → 四川 · 成都 */
  await p.evaluate(() => {
    const el = document.getElementById('dfRegion');
    el.value = '成都';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  await wait(200);
  const regionVal = await p.$eval('#delegateFormRoot #dfRegion', el => el.value);
  check('F-表单-地区自动修正(成都→四川·成都)', regionVal === '四川 · 成都', regionVal);
  const regionHint = await p.$eval('#delegateFormRoot #dfRegionHint', el => el.className + '|' + el.textContent);
  check('F-表单-地区提示=已识别', /dg-region-hint ok/.test(regionHint), regionHint);

  /* 未选类型提交 → 拦截 */
  await p.click('#delegateFormSubmit');
  await wait(300);
  check('F-表单-未选类型被拦截(无记录)', (await delegates()).length === 0);

  /* 选择类型 + 备用联系人 + 预算，提交 */
  await p.evaluate(() => {
    const box = document.querySelector('#delegateFormRoot .dg-chips[data-name="type"]');
    box.querySelector('.dg-chip[data-val="施工总承包"]').click();
    const lv = document.querySelector('#delegateFormRoot .dg-chips[data-name="qualLevel"]');
    lv.querySelector('.dg-chip[data-val="二级"]').click();
    const bd = document.querySelector('#delegateFormRoot .dg-chips[data-name="budget"]');
    bd.querySelector('.dg-chip[data-val="10-30万"]').click();
    document.getElementById('dfBackName').value = '李秘书';
    document.getElementById('dfBackPhone').value = '13912345678';
    document.getElementById('dfNote').value = '需在四川成都落地，期待名额与预算';
  });
  await p.click('#delegateFormSubmit');
  await wait(500);
  let list = await delegates();
  check('F-表单-提交成功(入库1条)', list.length === 1, 'n=' + list.length);
  check('F-表单-记录字段完整', !!list[0].id && list[0].biz === 'franchise' && list[0].type === '施工总承包' && list[0].qualLevel === '二级' && list[0].budget === '10-30万', JSON.stringify(list[0]));
  check('F-表单-地区为结构化对象', typeof list[0].region === 'object' && list[0].region.province === '四川' && list[0].region.city === '成都', JSON.stringify(list[0].region));
  check('F-表单-备用联系人已存', list[0].backup && list[0].backup.name === '李秘书' && list[0].backup.phone === '13912345678');
  btn = await p.$eval('#heroDelegate', el => el.textContent.trim());
  check('F-表单-按钮变=已提交委托', btn.indexOf('已提交委托') > -1, btn);

  /* 再次点击 → 详情弹窗 */
  await p.click('#heroDelegate');
  await wait(600);
  await shot('dg_f_detail_pending.png');
  const dStatus = await p.$eval('#delegateDetailBody', el => el.textContent);
  check('F-详情-等待承接态', dStatus.indexOf('等待承接') > -1 && dStatus.indexOf('修改委托') > -1 && dStatus.indexOf('备用联系人') > -1 && dStatus.indexOf('预算区间') > -1);

  /* 修改页：预填 + 保存回跳 */
  await p.evaluate(() => { document.getElementById('ddmEdit').click(); });
  await p.waitForFunction(() => location.pathname.indexOf('delegate-edit.html') > -1, { timeout: 8000 }).catch(() => {});
  await wait(800);
  check('F-修改-进入修改页', p.url().indexOf('delegate-edit.html') > -1, p.url());
  const editPrefill = await p.evaluate(() => ({
    type: document.querySelector('#deFormRoot .dg-chips[data-name="type"] .dg-chip.active') ? document.querySelector('#deFormRoot .dg-chips[data-name="type"] .dg-chip.active').dataset.val : '',
    region: document.getElementById('dfRegion').value,
    contact: document.getElementById('dfContact').value,
    backName: document.getElementById('dfBackName').value
  }));
  check('F-修改-预填正确', editPrefill.type === '施工总承包' && editPrefill.region === '四川 · 成都' && editPrefill.contact === '陈建国' && editPrefill.backName === '李秘书', JSON.stringify(editPrefill));
  await p.evaluate(() => { document.getElementById('deSaveBtn').click(); });
  await wait(1000);
  list = await delegates();
  check('F-修改-保存后状态=等待承接', list[0].status === '等待承接' && !!list[0].updateTime);

  /* 已承接态：详情无修改、有客服 */
  await p.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('engchain_delegates'));
    a[0].status = '已承接';
    localStorage.setItem('engchain_delegates', JSON.stringify(a));
  });
  await p.goto(F_INDEX, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await p.click('#heroDelegate');
  await wait(600);
  const acc = await p.$eval('#delegateDetailBody', el => el.textContent);
  check('F-详情-已承接态(客服入口/无修改)', acc.indexOf('已承接') > -1 && acc.indexOf('在线客服') > -1 && acc.indexOf('修改委托') === -1, acc.slice(0, 120));
  await p.evaluate(() => { document.getElementById('ddmOnlineService').click(); });
  await wait(600);
  check('F-详情-在线客服面板打开', await p.evaluate(() => !!document.querySelector('.sheet.show, .ui-sheet.show')));
  await p.evaluate(() => { try { UI.closeSheet(); } catch (e) {} });
  await wait(300);

  /* 已驳回态：可修改 */
  await p.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('engchain_delegates'));
    a[0].status = '已驳回';
    localStorage.setItem('engchain_delegates', JSON.stringify(a));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  await p.click('#heroDelegate');
  await wait(600);
  const rej = await p.$eval('#delegateDetailBody', el => el.textContent);
  check('F-详情-已驳回态(可修改)', rej.indexOf('已驳回') > -1 && rej.indexOf('修改委托') > -1, rej.slice(0, 100));

  /* 专享委托确认 → 入库 */
  await p.evaluate(() => { document.getElementById('exclusiveOk').click(); });
  await wait(400);
  list = await delegates();
  check('F-专享委托-入库(biz=franchise,type=专享委托)', list.length === 2 && list[0].type === '专享委托' && list[0].biz === 'franchise', 'n=' + list.length);

  /* 迁移：旧 franchise_delegate_v1 → 统一库 */
  await p.evaluate(() => {
    localStorage.removeItem('engchain_delegates');
    localStorage.setItem('franchise_delegate_v1', JSON.stringify({
      id: 'W88886666', type: '工程设计', qualLevel: '甲级', mode: '资质联营',
      region: { province: '广东', city: '深圳', text: '广东 · 深圳' },
      contact: '旧数据', phone: '13700001111', backup: '', note: '迁移测试',
      status: '待承接', submitTime: '2026-09-01 10:00', updateTime: '2026-09-01 10:00'
    }));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  list = await delegates();
  const legacyGone = await p.evaluate(() => localStorage.getItem('franchise_delegate_v1') === null);
  check('F-迁移-旧数据入库且状态归一', list.length === 1 && list[0].status === '等待承接' && list[0].biz === 'franchise' && list[0].id === 'W88886666', JSON.stringify(list[0]));
  check('F-迁移-旧key已清理', legacyGone);

  /* ==================== C. 地区解析边界 ==================== */
  const regionCases = await p.evaluate(() => {
    return [
      Delegates.parseRegion('江苏省南京市').text,
      Delegates.parseRegion('北京').text,
      Delegates.parseRegion('全国').text,
      Delegates.parseRegion('成都市').text,
      Delegates.parseRegion('火星基地').ok,
      Delegates.parseRegion('四川省').text
    ];
  });
  check('C-地区-江苏省南京市→江苏·南京', regionCases[0] === '江苏 · 南京', regionCases[0]);
  check('C-地区-北京→北京', regionCases[1] === '北京', regionCases[1]);
  check('C-地区-全国→全国', regionCases[2] === '全国', regionCases[2]);
  check('C-地区-成都市→四川·成都', regionCases[3] === '四川 · 成都', regionCases[3]);
  check('C-地区-未知→不通过', regionCases[4] === false);
  check('C-地区-四川省→四川·全省', regionCases[5] === '四川 · 全省', regionCases[5]);

  /* ==================== D. profile 首页：我的委托入口 + 门票效果 ==================== */
  /* 预置 3 条不同来源/状态的委托，验证聚合与角标 */
  await p.evaluate(() => {
    localStorage.setItem('engchain_delegates', JSON.stringify([
      { id: 'W1', biz: 'franchise', bizLabel: '资质招商', source: 'franchise', type: '施工总承包', qualLevel: '二级', mode: '分公司加盟', budget: '10-30万', region: { province: '四川', city: '成都', text: '四川 · 成都' }, contact: '陈建国', phone: '13800138000', backup: { name: '李秘书', phone: '13912345678' }, note: '种子数据', status: '等待承接', submitTime: '2026-09-08 09:00', updateTime: '2026-09-08 09:00' },
      { id: 'W2', biz: 'trade', bizLabel: '建企买卖', source: 'trade', type: '企业转让', qualLevel: '', mode: '', budget: '500-1000万', region: { province: '江苏', city: '南京', text: '江苏 · 南京' }, contact: '陈建国', phone: '13800138000', backup: '', note: '', status: '已承接', submitTime: '2026-09-07 15:30', updateTime: '2026-09-08 10:00' },
      { id: 'W3', biz: 'personnel', bizLabel: '人才服务', source: 'personnel', type: '招聘需求', qualLevel: '', mode: '', budget: '', region: { province: '', city: '', text: '全国' }, contact: '陈建国', phone: '13800138000', backup: '', note: '需持证项目经理', status: '已驳回', submitTime: '2026-09-06 11:20', updateTime: '2026-09-07 09:40' }
    ]));
  });
  await p.goto(P_INDEX, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await seedLogin();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  const quick = await p.evaluate(() => {
    const items = Array.prototype.map.call(document.querySelectorAll('#pf-quick-scroll .quick-item'), el => ({
      label: el.querySelector('.quick-label') ? el.querySelector('.quick-label').textContent : '',
      badge: el.querySelector('.quick-badge') ? el.querySelector('.quick-badge').textContent : ''
    }));
    return { items: items, ticket: !!document.querySelector('.id-ticket'), stub: !!document.querySelector('.tk-stub'), notch: !!document.querySelector('.tk-notch'), oldGuide: !!document.querySelector('.id-guide'), oldCard: !!document.querySelector('.id-card') };
  });
  const delItem = quick.items.find(x => x.label === '我的委托');
  check('D-profile-常用功能含我的委托', !!delItem, JSON.stringify(quick.items.map(x => x.label).slice(0, 6)));
  check('D-profile-我的委托角标=3(汇总全系统)', !!delItem && delItem.badge === '3', delItem ? delItem.badge : '无');
  check('D-profile-门票效果已呈现(id-ticket/tk-stub/tk-notch)', quick.ticket && quick.stub && quick.notch);
  check('D-profile-旧堆叠结构已移除', !quick.oldGuide && !quick.oldCard);
  const guideTxt = await p.$eval('#pf-guide-text', el => el.textContent.trim());
  check('D-profile-副券引导文案渲染', guideTxt.length > 0, guideTxt);
  await shot('dg_profile_ticket.png');

  /* ==================== E. 我的委托列表页（汇总全系统） ==================== */
  await p.goto(P_LIST, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await seedLogin();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  const listState = await p.evaluate(() => ({
    stats: document.getElementById('dlStats').textContent.replace(/\s+/g, ' '),
    cards: Array.prototype.map.call(document.querySelectorAll('#dlList .dl-card'), el => ({
      title: el.querySelector('.dl-title').textContent,
      biz: el.querySelector('.dl-biz').textContent,
      status: el.querySelector('.dd-status').textContent.trim(),
      region: el.querySelector('.dl-meta b').textContent
    })),
    filterChips: Array.prototype.map.call(document.querySelectorAll('#dlFilters .dl-fchip'), el => el.textContent.trim())
  }));
  check('E-列表-统计汇总(全部3=等待1/已承接1/已驳回1)', /3/.test(listState.stats) && /1等待承接/.test(listState.stats.replace(/\s/g, '')) && /1已承接/.test(listState.stats.replace(/\s/g, '')) && /1已驳回/.test(listState.stats.replace(/\s/g, '')), listState.stats.replace(/\s/g, ' '));
  check('E-列表-聚合三种来源', listState.cards.length === 3 && listState.cards.some(c => c.biz === '资质招商') && listState.cards.some(c => c.biz === '建企买卖') && listState.cards.some(c => c.biz === '人才服务'), 'n=' + listState.cards.length);
  check('E-列表-状态徽标正确', listState.cards.some(c => c.status === '已承接') && listState.cards.some(c => c.status === '已驳回'), JSON.stringify(listState.cards.map(c => c.status)));
  check('E-列表-地区显示省·市', listState.cards.some(c => c.region.indexOf('·') > -1) && listState.cards.some(c => c.region === '全国'), JSON.stringify(listState.cards.map(c => c.region)));
  check('E-列表-筛选chips=4', listState.filterChips.length === 4, JSON.stringify(listState.filterChips));
  await shot('dg_list.png');

  /* 筛选：已承接 → 1 条 */
  await p.evaluate(() => { Array.prototype.find.call(document.querySelectorAll('#dlFilters .dl-fchip'), b => b.dataset.key === 'accepted').click(); });
  await wait(300);
  const acceptedCards = await p.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#dlList .dl-card'), el => el.querySelector('.dd-status').textContent.trim()));
  check('E-列表-已承接筛选=1条且状态正确', acceptedCards.length === 1 && acceptedCards[0] === '已承接', JSON.stringify(acceptedCards));

  /* 点击已承接卡片 → 详情页（已承接分支：客服入口、无修改） */
  await p.evaluate(() => { document.querySelector('#dlList .dl-card').click(); });
  await p.waitForFunction(() => location.pathname.indexOf('delegate-detail.html') > -1, { timeout: 8000 }).catch(() => {});
  await wait(800);
  check('E-列表-点击进入详情页', p.url().indexOf('delegate-detail.html') > -1, p.url());
  const detAccepted = await p.evaluate(() => ({
    status: document.querySelector('.dg-head .dd-status').textContent.trim(),
    hasEdit: !!document.getElementById('dgEdit'),
    hasOnline: !!document.getElementById('dgOnline')
  }));
  check('E-详情-已承接态(客服入口/无修改)', detAccepted.status === '已承接' && detAccepted.hasOnline && !detAccepted.hasEdit, JSON.stringify(detAccepted));
  await p.evaluate(() => { document.getElementById('dgOnline').click(); });
  await wait(600);
  check('E-详情-已承接在线客服面板', await p.evaluate(() => !!document.querySelector('.sheet.show, .ui-sheet.show')));
  await p.evaluate(() => { try { UI.closeSheet(); } catch (e) {} });
  await wait(300);
  await shot('dg_detail_accepted.png');

  /* 返回列表 → 等待承接卡片 → 通用修改页 */
  await p.goto(P_LIST, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await p.evaluate(() => { Array.prototype.find.call(document.querySelectorAll('#dlFilters .dl-fchip'), b => b.dataset.key === 'pending').click(); });
  await wait(300);
  await p.evaluate(() => { document.querySelector('#dlList .dl-card').click(); });
  await p.waitForFunction(() => location.pathname.indexOf('delegate-detail.html') > -1, { timeout: 8000 }).catch(() => {});
  await wait(800);
  const det = await p.evaluate(() => ({
    status: document.querySelector('.dg-head .dd-status').textContent.trim(),
    rows: Array.prototype.map.call(document.querySelectorAll('.dg-row'), r => r.querySelector('.k').textContent + '=' + r.querySelector('.v').textContent),
    hasEdit: !!document.getElementById('dgEdit')
  }));
  check('E-详情-等待承接字段展示', det.status === '等待承接' && det.rows.some(r => r.indexOf('委托编号') > -1) && det.rows.some(r => r.indexOf('备用联系人') > -1), det.status);
  check('E-详情-可修改', det.hasEdit);
  await shot('dg_detail.png');
  await p.evaluate(() => { document.getElementById('dgEdit').click(); });
  await p.waitForFunction(() => location.pathname.indexOf('delegate-edit.html') > -1, { timeout: 8000 }).catch(() => {});
  await wait(800);
  const pEdit = await p.evaluate(() => ({
    region: document.getElementById('dfRegion').value,
    contact: document.getElementById('dfContact').value,
    statusBadge: document.querySelector('.dn-info .dd-status') ? document.querySelector('.dn-info .dd-status').textContent.trim() : ''
  }));
  check('E-修改-通用修改页预填', pEdit.region === '四川 · 成都' && pEdit.contact === '陈建国', JSON.stringify(pEdit));
  await p.evaluate(() => { document.getElementById('deSaveBtn').click(); });
  await wait(1000);
  list = await delegates();
  check('E-修改-保存回写统一库', list.some(x => x.status === '等待承接' && x.updateTime));

  /* ==================== F. 新增委托（profile 通用委托） ==================== */
  await p.goto(P_NEW, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await seedLogin();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  const newPrefill = await p.evaluate(() => ({ contact: document.getElementById('dfContact').value, phone: document.getElementById('dfPhone').value }));
  check('F-新增-认证信息预填', newPrefill.contact === '陈建国' && newPrefill.phone === '13800138000', JSON.stringify(newPrefill));
  await p.evaluate(() => {
    document.querySelector('#dnFormRoot .dg-chips[data-name="type"] .dg-chip[data-val="项目合作"]').click();
    const el = document.getElementById('dfRegion');
    el.value = '四川省成都市';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  await wait(200);
  check('F-新增-地区自动修正', await p.$eval('#dnFormRoot #dfRegion', el => el.value) === '四川 · 成都');
  await p.click('#dnSubmitBtn');
  await p.waitForFunction(() => location.pathname.indexOf('delegate-detail.html') > -1, { timeout: 8000 }).catch(() => {});
  await wait(900);
  list = await delegates();
  const newRec = list[0];
  check('F-新增-入库(biz=general/type=项目合作)', newRec.biz === 'general' && newRec.type === '项目合作', JSON.stringify(newRec));
  check('F-新增-跳转详情页', p.url().indexOf('delegate-detail.html?id=' + newRec.id) > -1, p.url());
  await shot('dg_new_submitted.png');

  /* ==================== G. trade 弹窗补全 + 入库 ==================== */
  await p.goto(T_INDEX, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await seedLogin();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  await p.evaluate(() => { openDelegatePanel(); });
  await wait(500);
  check('G-trade-弹窗含共享表单', (await p.$$('#ddFormRoot .dg-chip')).length >= 4, 'chips=' + (await p.$$('#ddFormRoot .dg-chip')).length);
  check('G-trade-认证预填', await p.$eval('#ddFormRoot #dfContact', el => el.value) === '陈建国');
  await p.evaluate(() => {
    document.querySelector('#ddFormRoot .dg-chips[data-name="type"] .dg-chip[data-val="企业收购"]').click();
    const el = document.getElementById('dfRegion');
    el.value = '重庆';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  await wait(200);
  check('G-trade-地区修正(重庆)', await p.$eval('#ddFormRoot #dfRegion', el => el.value) === '重庆');
  await p.evaluate(() => { document.getElementById('ddSubmitBtn').click(); });
  await wait(400);
  list = await delegates();
  check('G-trade-委托需求入库(biz=trade)', list.some(x => x.biz === 'trade' && x.type === '企业收购' && x.region.city === '重庆'), 'n=' + list.length);
  await shot('dg_trade.png');

  /* trade 专享委托 → 入库 */
  await p.evaluate(() => { openExclusiveConfirm(); });
  await wait(300);
  await p.evaluate(() => { document.getElementById('exclusiveOk').click(); });
  await wait(400);
  list = await delegates();
  check('G-trade-专享委托入库', list.some(x => x.biz === 'trade' && x.type === '专享委托'));

  /* ==================== H. personnel 提交入库 ==================== */
  await p.goto(PE_INDEX, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await seedLogin();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  /* 专享委托 */
  await p.evaluate(() => { openExclusiveConfirm(); });
  await wait(300);
  await p.evaluate(() => { document.getElementById('exclusiveOk').click(); });
  await wait(400);
  list = await delegates();
  check('H-personnel-专享委托入库(biz=personnel)', list.some(x => x.biz === 'personnel' && x.type === '专享委托'));
  /* 招聘需求表单提交 */
  await p.evaluate(() => { openDelegate(); });
  await wait(400);
  await p.evaluate(() => {
    document.getElementById('dmName').value = '陈建国';
    document.getElementById('dmPhone').value = '13800138000';
    document.querySelector('#dmCertTags .dm-tag[data-val="建造师"]').click();
    document.querySelector('#dmSalaryTags .dm-tag[data-val="20-30万"]').click();
    document.getElementById('dmRemark').value = '需持证项目经理';
  });
  await p.evaluate(() => { document.getElementById('dmSubmit').click(); });
  await wait(800);
  list = await delegates();
  const pmRec = list.find(x => x.biz === 'personnel' && x.type === '招聘需求');
  check('H-personnel-招聘需求入库(含证书/薪资)', !!pmRec && pmRec.certTypes.indexOf('建造师') > -1 && pmRec.salary === '20-30万', JSON.stringify(pmRec));
  await shot('dg_personnel.png');

  /* 汇总验证：我的委托列表应聚合 8 类记录 */
  await p.goto(P_LIST, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await seedLogin();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  const allCount = await p.evaluate(() => document.querySelectorAll('#dlList .dl-card').length);
  check('I-汇总-我的委托聚合全部来源', allCount >= 6, 'cards=' + allCount);
  await shot('dg_aggregated.png');

  console.log('\n========== RESULT: ' + (failures === 0 ? 'ALL PASS' : failures + ' FAILURES') + ' ==========');
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
