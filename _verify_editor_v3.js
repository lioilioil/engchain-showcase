const puppeteer = require('puppeteer-core');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new',
    userDataDir: path.resolve('D:/Engchain3.0', '.chrome-test-profile-tmp'),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--disable-web-security', '--disable-gpu'],
    defaultViewport: { width: 1280, height: 900 }, protocolTimeout: 60000
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  let fails = 0;
  const chk = (name, ok, extra) => { console.log(name, ok ? 'PASS' : 'FAIL', extra || ''); if (!ok) fails++; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 登录态 + 清草稿 + 注入一条当前用户历史发布（供复制上次发布）
  await page.goto('file:///D:/Engchain3.0/home.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('engchain-state', JSON.stringify({ loggedIn: true, account: 'u1', name: '陈建国', phone: '13800000000' }));
    const auth = JSON.parse(localStorage.getItem('engchain-auth') || 'null') || {};
    auth.realname = { ok: true, ts: Date.now() };
    auth.enterprise = { ok: true, name: '四川省××建设有限公司', address: '成都·武侯' };
    localStorage.setItem('engchain-auth', JSON.stringify(auth));
    localStorage.setItem('engchain-balance', JSON.stringify({ balance: 500000, frozen: 0, totalIn: 500000, logs: [] }));
    localStorage.removeItem('engchain-autosave-demand');
    localStorage.removeItem('engchain-autosave-supply');
    // 注入历史发布记录
    const supply = JSON.parse(localStorage.getItem('engchain-supply') || 'null') || { items: [] };
    supply.items.unshift({
      id: 'p-v3-1', publisher: 'u1', role: 'demand', title: '上次发布：急需盘扣脚手架', category: '设备',
      subType: '盘扣脚手架', location: '成都市·青白江', unit: '吨', price: '0.32', qty: '500',
      spec: '盘扣Q355 镀锌', delivery: '30天内', qualification: '资质齐全', description: '上次发布的描述',
      tags: ['租赁', '现货'], contact: { name: '陈建国', phone: '13800000000', wechat: '' },
      company: '四川省××建设有限公司', address: '成都·武侯', status: 'active', updatedAt: Date.now(),
      images: [], files: [], expireDays: 30, privacyContact: true, negotiable: false, tradeInfo: null
    });
    localStorage.setItem('engchain-supply', JSON.stringify(supply));
  });

  // ===== A. 布局骨架 =====
  await page.goto('file:///D:/Engchain3.0/pages/publish/editor.html?role=demand', { waitUntil: 'domcontentloaded' });
  await sleep(900);
  let s = await page.evaluate(() => ({
    progressPanel: !!document.querySelector('.progress-panel'),
    inScroll: document.querySelector('.editor-scroll') && !!document.querySelector('.editor-scroll .progress-panel'),
    sticky: getComputedStyle(document.querySelector('.progress-panel')).position,
    stepHeadCount: document.querySelectorAll('.step-head').length,
    stepNos: Array.from(document.querySelectorAll('.sh-no')).map(e => e.textContent),
    toggleCount: document.querySelectorAll('.optional-toggle').length,
    opt2Collapsed: document.getElementById('opt-group-2').classList.contains('collapsed'),
    opt3Collapsed: document.getElementById('opt-group-3').classList.contains('collapsed'),
    reuseShown: document.getElementById('reuse-bar').classList.contains('show'),
    reuseTitle: document.getElementById('reuse-title').textContent.slice(0, 20),
    aiCardExpanded: document.getElementById('ai-card').classList.contains('expanded'),
    btnPrevHidden: getComputedStyle(document.getElementById('btn-prev')).visibility,
    btnPrevDisplay: getComputedStyle(document.getElementById('btn-prev')).display
  }));
  chk('合成进度头存在且位于滚动区', s.progressPanel && s.inScroll, JSON.stringify({ p: s.progressPanel, i: s.inScroll }));
  chk('进度头 sticky 置顶', s.sticky === 'sticky', s.sticky);
  chk('章节头 3 个(01/02/03)', s.stepHeadCount === 3 && s.stepNos.join(',') === '01,02,03', s.stepNos.join(','));
  chk('选填折叠组 2 个且默认收起', s.toggleCount === 2 && s.opt2Collapsed && s.opt3Collapsed, JSON.stringify({ t: s.toggleCount, o2: s.opt2Collapsed, o3: s.opt3Collapsed }));
  chk('复制上次发布条显示', s.reuseShown && s.reuseTitle.indexOf('上次发布') > -1, s.reuseTitle);
  chk('AI 默认胶囊态(未展开)', !s.aiCardExpanded);
  chk('Step1 上一步占位隐藏', s.btnPrevHidden === 'hidden' && s.btnPrevDisplay !== 'none', JSON.stringify({ v: s.btnPrevHidden, d: s.btnPrevDisplay }));

  // ===== B. 交互摩擦 =====
  // B1 折叠组展开
  await page.evaluate(() => document.querySelector('.optional-toggle[data-target="opt-group-2"]').click());
  let s2 = await page.evaluate(() => ({
    opt2Open: !document.getElementById('opt-group-2').classList.contains('collapsed'),
    tgOpen: document.querySelector('.optional-toggle[data-target="opt-group-2"]').classList.contains('open')
  }));
  chk('折叠组点击展开', s2.opt2Open && s2.tgOpen, JSON.stringify(s2));

  // B2 AI 胶囊展开 + 生成 + 撤销
  await page.evaluate(() => document.getElementById('ai-expand').click());
  let s3 = await page.evaluate(() => ({
    cardExp: document.getElementById('ai-card').classList.contains('expanded'),
    panelShow: document.getElementById('ai-panel').classList.contains('show')
  }));
  chk('AI 胶囊点击展开', s3.cardExp && s3.panelShow, JSON.stringify(s3));
  await page.evaluate(() => {
    document.getElementById('ai-input').value = '我要在成都天府新区收购二级水利水电公司，带安许，负债可控';
    document.getElementById('ai-generate').click();
  });
  await sleep(200);
  let s4 = await page.evaluate(() => ({
    undoShow: document.getElementById('ai-undo').classList.contains('show'),
    title: document.getElementById('f-title').value.slice(0, 10),
    cat: document.getElementById('f-category').value
  }));
  chk('AI 填入后撤销条显示', s4.undoShow && s4.cat === '建企买卖', JSON.stringify(s4));
  await page.evaluate(() => document.getElementById('ai-undo-btn').click());
  let s5 = await page.evaluate(() => ({
    undoGone: !document.getElementById('ai-undo').classList.contains('show'),
    titleBack: document.getElementById('f-title').value === '',
    catBack: document.getElementById('f-category').value === '材料'
  }));
  chk('撤销恢复原值', s5.undoGone && s5.titleBack && s5.catBack, JSON.stringify(s5));

  // B3 手机号失焦即时校验
  await page.evaluate(() => {
    const p = document.getElementById('f-contact-phone');
    p.value = '12345'; p.dispatchEvent(new Event('blur'));
  });
  let s6 = await page.evaluate(() => ({
    err: document.getElementById('err-contact-phone').classList.contains('show'),
    fieldErr: document.getElementById('f-contact-phone').classList.contains('error')
  }));
  chk('手机号失焦即时报错', s6.err && s6.fieldErr, JSON.stringify(s6));

  // B4 图片封面切换
  await page.evaluate(() => document.getElementById('image-add').click());
  await page.evaluate(() => document.getElementById('image-add').click());
  await sleep(200);
  let s7 = await page.evaluate(() => ({
    count: document.querySelectorAll('.image-upload-item').length,
    coverIdx0: document.querySelector('.image-upload-item').querySelector('.img-cover') ? 'cover' : 'none',
    setBtn: !!document.querySelector('.img-setcover')
  }));
  chk('图片封面闭环(角标+设为封面)', s7.count === 2 && s7.coverIdx0 === 'cover' && s7.setBtn, JSON.stringify(s7));
  await page.evaluate(() => document.querySelector('.img-setcover').click());
  let s8 = await page.evaluate(() => ({
    newFirst: document.querySelector('.image-upload-item').querySelector('.img-cover') ? 'cover' : 'none'
  }));
  chk('设为封面后首图带封面角标', s8.newFirst === 'cover', s8.newFirst);

  // B5 品类切换反馈 cat-flash
  await page.evaluate(() => {
    const cat = document.getElementById('f-category');
    cat.value = '建企买卖'; cat.dispatchEvent(new Event('change'));
  });
  let s9 = await page.evaluate(() => ({
    flash: document.querySelector('.form-step[data-step="2"] .form-card').classList.contains('cat-flash'),
    tradeShown: document.getElementById('trade-detail-card').style.display !== 'none'
  }));
  chk('品类切换受影响字段高亮', s9.flash, JSON.stringify(s9));
  chk('切建企买卖四要素卡显示', s9.tradeShown);

  // B6 操作栏三槽恒定：Step2 上一步可见
  await page.evaluate(() => {
    document.getElementById('f-title').value = '测试标题';
    document.getElementById('f-location').value = '四川省·成都市·天府新区';
    document.getElementById('f-desc').value = '测试描述内容，用于验证步骤切换与操作栏。';
    document.getElementById('f-title').dispatchEvent(new Event('input'));
    document.getElementById('f-location').dispatchEvent(new Event('input'));
    document.getElementById('f-desc').dispatchEvent(new Event('input'));
  });
  await sleep(200);
  await page.evaluate(() => document.getElementById('btn-next').click());
  await sleep(300);
  let s10 = await page.evaluate(() => ({
    prevVisible: getComputedStyle(document.getElementById('btn-prev')).visibility === 'visible',
    prevWidth: getComputedStyle(document.getElementById('btn-prev')).width,
    slideNext: document.querySelector('.form-step.active').classList.contains('slide-next'),
    step2Active: document.querySelector('.form-step[data-step="2"]').classList.contains('active')
  }));
  chk('Step2 上一步可见(占位恒定)', s10.prevVisible && s10.prevWidth !== '0px', JSON.stringify(s10));
  chk('步骤切换前进方向动效', s10.slideNext && s10.step2Active, JSON.stringify(s10));

  // B7 草稿离开保护
  await page.evaluate(() => document.getElementById('f-spec').value = '盘扣Q355');
  await page.evaluate(() => document.getElementById('f-spec').dispatchEvent(new Event('input')));
  await sleep(100);
  await page.evaluate(() => document.getElementById('nav-back').click());
  await sleep(200);
  let s11 = await page.evaluate(() => ({
    dialog: document.getElementById('leave-dialog').classList.contains('show'),
    mask: document.getElementById('leave-mask').classList.contains('show')
  }));
  chk('有改动时返回触发离开保护', s11.dialog && s11.mask, JSON.stringify(s11));
  await page.evaluate(() => document.getElementById('ld-cancel').click());
  let s12 = await page.evaluate(() => !document.getElementById('leave-dialog').classList.contains('show'));
  chk('取消留在页面', s12);
  await page.evaluate(() => document.getElementById('nav-back').click());
  await page.evaluate(() => document.getElementById('ld-save').click());
  await sleep(300);
  let s13 = await page.evaluate(() => localStorage.getItem('engchain-autosave-demand'));
  chk('保存草稿并离开(autosave 有值)', !!s13 && s13.indexOf('盘扣Q355') > -1, s13 ? s13.slice(0, 40) : 'null');

  // B8 复制上次发布回填
  await page.goto('file:///D:/Engchain3.0/pages/publish/editor.html?role=demand', { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await page.evaluate(() => document.getElementById('reuse-fill').click());
  await sleep(200);
  let s14 = await page.evaluate(() => ({
    title: document.getElementById('f-title').value,
    cat: document.getElementById('f-category').value,
    sub: document.getElementById('f-sub').value
  }));
  chk('复制上次发布回填字段', s14.title.indexOf('盘扣脚手架') > -1 && s14.cat === '设备' && s14.sub === '盘扣脚手架', JSON.stringify(s14));

  console.log(fails === 0 ? '=== EDITOR V3 ALL PASS ===' : ('=== FAILS: ' + fails + ' ==='));
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
