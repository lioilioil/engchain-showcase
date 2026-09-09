/* 服务广场 v3.2 深度打磨 · 专项验证（Lead/评分回流/卡片信任信号/下单心智/空态/身份感知） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = 'D:/Engchain3.0';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.resolve(ROOT, '.chrome-test-profile-tmp');
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    userDataDir: PROFILE,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'],
    defaultViewport: { width: 420, height: 880 }, protocolTimeout: 60000
  });
  async function page() {
    const p = await browser.newPage();
    p.on('pageerror', e => console.log('  [pageerror]', String(e.message).slice(0, 160)));
    return p;
  }
  async function seed(p, uid) {
    await p.evaluateOnNewDocument((uid) => {
      const now = Date.now();
      const state = uid === 'u2'
        ? { user: '李雅', company: '四川××工程中介服务有限公司', member: false, account: 'liya@engchain.cn', loggedIn: true, uid: 'u2' }
        : { user: '陈建国', company: '四川省××建设有限公司', member: false, account: 'chenjianguo@engchain.cn', loggedIn: true, uid: 'u1' };
      localStorage.removeItem('engchain-entry');
      localStorage.setItem('engchain-state', JSON.stringify(state));
      localStorage.setItem('engchain-auth', JSON.stringify({
        realname: { ok: true, name: uid === 'u2' ? '李雅' : '陈建国' },
        enterprise: { ok: true, expireAt: now + 365 * 864e5 },
        personalEntry: { ok: true, list: [{}], userType: 'jobseeker', resumeComplete: true }
      }));
      if (uid === 'u2') {
        localStorage.setItem('engchain-entry', JSON.stringify({ type: 'agency', types: ['agency'], status: 'active', active: true, orderId: 'EN1', paidAt: now, expireAt: now + 365 * 864e5, depositType: 'engineering', depositPaid: 20000 }));
      }
    }, uid);
  }
  /* 给买方注资（Ledger 台账直写，绕开当前登录账号是卖方的问题） */
  const fundBuyer = (p, amt) => p.evaluate((amt) => {
    Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: 'u1', toAcct: 'available', amount: amt, allowNegative: true, idemKey: 'seed_u1_' + Date.now(), remark: '测试注资' });
  }, amt);
  const goto = (p, f, opt) => p.goto('file:///' + ROOT + '/' + f, Object.assign({ waitUntil: 'networkidle2', timeout: 60000 }, opt || {}));
  const txt = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; }, sel);
  const count = (p, sel) => p.evaluate(s => document.querySelectorAll(s).length, sel);

  /* ========== 1. stores.js 数据层 ========== */
  console.log('\n[1] LeadStore / SvcRatingStore 数据层');
  {
    const p = await page(); await goto(p, 'pages/agency/index.html');
    const r = await p.evaluate(() => {
      localStorage.removeItem('engchain-svc-ratings');
      localStorage.removeItem('engchain-agency-leads');
      const out = {};
      LeadStore.create({ svcId: 'a1', svcName: '测试服务', sellerId: 'u2', buyerId: 'u1', name: '张三', phone: '13800000000', serve: '资质升级', urge: '加急通道' });
      out.total = LeadStore.list({ sellerId: 'u2' }).length;
      const l = LeadStore.list({ sellerId: 'u2' })[0];
      out.status0 = l.status;
      LeadStore.setStatus(l.id, 'dealt');
      out.status1 = LeadStore.byId(l.id).status;
      out.stats = LeadStore.stats('u2').total;
      SvcRatingStore.add('a1', 5); SvcRatingStore.add('a1', 4);
      const g = SvcRatingStore.get('a1');
      out.rating = g.count + '/' + g.avg;
      return out;
    });
    ok('LeadStore 创建+过滤', r.total >= 1);
    ok('LeadStore 状态流转 new→dealt', r.status0 === 'new' && r.status1 === 'dealt');
    ok('LeadStore.stats 汇总', r.stats >= 1);
    ok('SvcRatingStore 聚合 2条/avg4.5', r.rating === '2/4.5');
    await p.close();
  }

  /* ========== 2. 服务广场 · 用户视角 ========== */
  console.log('\n[2] 服务广场用户视角（u1）');
  {
    const p = await page(); await seed(p, 'u1'); await goto(p, 'pages/agency/index.html');
    await new Promise(r => setTimeout(r, 600));
    const roleHint = await txt(p, '#role-hint');
    ok('身份感知：买家引导「找服务三步走」', !!roleHint && roleHint.indexOf('找服务三步走') >= 0, roleHint);
    ok('服务卡片渲染', (await count(p, '.svc-card')) > 0);
    const first = await p.evaluate(() => {
      const c = document.querySelector('.svc-card');
      if (!c) return null;
      return {
        co: !!c.querySelector('.svc-co'),
        cy: !!c.querySelector('.svc-cy'),
        cta: c.querySelector('.svc-cta') ? c.querySelector('.svc-cta').textContent.trim() : null,
        org: c.classList.contains('svc-org'),
        score: c.querySelector('.svc-score') ? c.querySelector('.svc-score').textContent : '',
        vTitle: c.querySelector('.svc-v') ? c.querySelector('.svc-v').getAttribute('title') : ''
      };
    });
    ok('信任信号：机构名 .svc-co', !!(first && first.co));
    ok('信任信号：周期 .svc-cy', !!(first && first.cy));
    ok('信任信号：评分含成功率', !!(first && first.score.indexOf('成功率') >= 0));
    ok('金V 认证说明 title', !!(first && first.vTitle && first.vTitle.indexOf('已核验') >= 0));
    ok('CTA 语义：机构=在线下单 + org 卡样式', !!(first && first.cta === '在线下单' && first.org), first && first.cta);
    ok('热门词渲染', (await count(p, '.hot-chip')) > 0);
    /* 搜索空态 */
    await p.type('#mkt-q', '不存在的服务xyz');
    await new Promise(r => setTimeout(r, 300));
    ok('空态兜底 .empty-card + 推荐', (await count(p, '.empty-card')) === 1 && (await count(p, '.e-rec-item')) > 0);
    ok('空态平台顾问入口', (await count(p, '.e-help')) === 1);
    /* 评价聚合显示（清空搜索，触发 input 事件重渲染） */
    await p.evaluate(() => {
      SvcRatingStore.add('a1', 5);
      const q = document.getElementById('mkt-q');
      q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 300));
    ok('评价回流 .svc-agg 出现', (await count(p, '.svc-agg')) > 0);
    await p.close();
  }

  /* ========== 3. 服务广场 · 统一买方视角（u2 入驻中介亦无卖方入口） ========== */
  console.log('\n[3] 服务广场统一买方视角（u2）');
  {
    const p = await page(); await seed(p, 'u2'); await goto(p, 'pages/agency/index.html');
    await new Promise(r => setTimeout(r, 600));
    const roleHint = await txt(p, '#role-hint');
    ok('u2 亦为买方引导「找服务三步走」', !!roleHint && roleHint.indexOf('找服务三步走') >= 0, roleHint);
    ok('卖方工作台入口已移除', (await count(p, '#seller-entry')) === 0);
    ok('顶部仅「我的单」一个入口', (await count(p, '.my-entry')) === 1 && (await txt(p, '.me-label')) === '我的单', 'my-entry=' + (await count(p, '.my-entry')));
    const bodyTxt = await p.evaluate(() => document.body.textContent);
    ok('页面无卖方经营文案残留', bodyTxt.indexOf('卖方工作台') === -1 && bodyTxt.indexOf('服务商身份经营') === -1);
    await p.close();
  }

  /* ========== 4. 下单页金额心智 ========== */
  console.log('\n[4] 下单页（order.html）金额心智 + 保障前置');
  {
    const p = await page(); await seed(p, 'u1');
    await goto(p, 'pages/agency/order.html?svc=0&amount=180000');
    await new Promise(r => setTimeout(r, 600));
    ok('A4 履约保障条 .order-guard', (await count(p, '.order-guard')) === 1);
    const ql = await p.evaluate(() => {
      const el = document.getElementById('quote-line');
      return el && el.style.display !== 'none' ? el.textContent.trim() : null;
    });
    ok('A3 服务商参考价行（报价带入 18万）', !!ql && ql.indexOf('服务商参考价') >= 0 && ql.indexOf('180,000') >= 0, ql);
    const qh = await txt(p, '#quote-hint');
    ok('A3 参考价位标签', !!qh && qh.indexOf('参考价位') >= 0, qh);
    await p.close();
  }

  /* ========== 5. 详情页免费咨询 → 询盘落库（真实交互） ========== */
  console.log('\n[5] 详情页免费咨询 → LeadStore 落库');
  {
    const p = await page(); await seed(p, 'u1');
    await p.evaluateOnNewDocument(() => { localStorage.removeItem('engchain-agency-leads'); });
    await goto(p, 'pages/supply/detail.html?id=a1', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3500));
    const btn = await p.evaluate(() => {
      const b = document.getElementById('cta');
      return b ? b.textContent.trim() : null;
    });
    ok('agency 详情 CTA=立即咨询', !!btn && btn.indexOf('立即咨询') >= 0, btn);
    if (btn && btn.indexOf('立即咨询') >= 0) {
      await p.evaluate(() => { const b = document.getElementById('cta'); b && b.click(); });
      await new Promise(r => setTimeout(r, 500));
      ok('咨询登记 sheet 打开', (await count(p, '.sheet')) === 1);
      /* 真实交互：点选「资质升级」+「加急通道」，再提交 */
      await p.evaluate(() => {
        const s1 = document.querySelector('#ag-serve .cs-tag[data-val="资质升级"]');
        if (s1) s1.click();
        const s2 = document.querySelector('#ag-urge .cs-tag[data-val="加急通道"]');
        if (s2) s2.click();
        const s = document.querySelector('#ag-submit'); s && s.click();
      });
      await new Promise(r => setTimeout(r, 500));
      const leads = await p.evaluate(() => (window.LeadStore ? LeadStore.read().items : []));
      ok('提交后 LeadStore 落库 1 条', leads.length === 1, 'len=' + leads.length);
      ok('询盘字段完整（svcId=a1/serve=资质升级/urge）', leads[0] && leads[0].svcId === 'a1' && leads[0].serve === '资质升级' && leads[0].urge === '加急通道', leads[0] && (leads[0].svcId + '|' + leads[0].serve + '|' + leads[0].urge));
    }
    await p.close();
  }

  /* ========== 6. 服务商工作台（u2）：询盘/经营数据/收入明细/引导 ========== */
  console.log('\n[6] seller-board 服务商工作台（u2）');
  {
    const p = await page(); await seed(p, 'u2');
    await p.evaluateOnNewDocument(() => {
      localStorage.removeItem('engchain-agency-leads');
      const lead = { id: 'LD1', svcId: 'a1', svcName: '建筑资质升级代办', sellerId: 'u2', buyerId: 'u1', name: '陈建国', phone: '13800008866', serve: '资质升级', urge: '加急通道', status: 'new', createdAt: Date.now() };
      localStorage.setItem('engchain-agency-leads', JSON.stringify({ items: [lead] }));
      localStorage.setItem('engchain-svc-ratings', JSON.stringify({ items: { a1: { count: 2, sum: 9 } } }));
    });
    await goto(p, 'pages/agency/seller-board.html');
    await new Promise(r => setTimeout(r, 700));
    ok('询盘卡渲染', (await count(p, '.lead-card')) === 1);
    ok('询盘列表 1 条 + 咨询人信息', (await count(p, '.lead-item')) === 1 && (await txt(p, '.li-v')) && (await txt(p, '.li-v')).indexOf('陈建国') >= 0);
    ok('询盘状态 chips 4 个', (await count(p, '.li-op')) === 4);
    /* 状态切换：点击第二个 op（已联系）——第一个是当前状态自身 */
    await p.evaluate(() => { const ops = document.querySelectorAll('.li-op'); ops[1] && ops[1].click(); });
    await new Promise(r => setTimeout(r, 300));
    const st = await p.evaluate(() => { const l = LeadStore.read().items[0]; return l.status; });
    ok('询盘状态点击切换生效', st === 'contacted', st);
    /* 收入明细：先给买方注资（Ledger 台账直写），走完整 创建→托管→接单→节点释放 链路 */
    await p.evaluate(() => {
      Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: 'u1', toAcct: 'available', amount: 200000, allowNegative: true, idemKey: 'seed_u1_' + Date.now(), remark: '测试注资' });
      Mediation.create({ buyerId: 'u1', sellerId: 'u2', svcId: 'a1', svcName: '测试订单', amount: 60000 });
      const o = Mediation.list({ uid: 'u2', role: 'seller' })[0];
      Mediation.pay(o.id, 'balance'); Mediation.accept(o.id, 'u2');
      Mediation.confirmMilestone(o.id, 0, false);
    });
    await p.evaluate(() => { const t = document.getElementById('k-income-tile'); t && t.click(); });
    await new Promise(r => setTimeout(r, 400));
    ok('收入明细 sheet 打开', (await count(p, '.sheet')) === 1);
    const inc = await txt(p, '.inc-total');
    ok('收入明细含合计与佣金', !!inc && inc.indexOf('佣金') >= 0, inc);
    await p.evaluate(() => { const c = document.querySelector('.sheet-close'); c && c.click(); });
    await new Promise(r => setTimeout(r, 350));
    /* 我的服务经营数据（先注入一条该服务商的 supply） */
    await p.evaluate(() => {
      SupplyStore.add({ publisher: 'u2', cat: '中介服务', bizKey: 'agency', title: '我的服务A', sub: '资质升级', status: 'active' });
    });
    await new Promise(r => setTimeout(r, 400));
    const msb = await txt(p, '.ms-biz');
    ok('我的服务经营数据（咨询/订单）', !!msb && msb.indexOf('咨询') >= 0, msb);
    await p.close();
  }

  /* ========== 7. 评价回流（domain.js review → SvcRatingStore） ========== */
  console.log('\n[7] 评价回流数据链路');
  {
    const p = await page(); await seed(p, 'u1');
    await goto(p, 'pages/agency/order.html?svc=0');
    await new Promise(r => setTimeout(r, 600));
    const r = await p.evaluate(() => {
      localStorage.removeItem('engchain-svc-ratings');
      Ledger.transfer({ fromUid: Ledger.PLATFORM, fromAcct: 'available', toUid: 'u1', toAcct: 'available', amount: 200000, allowNegative: true, idemKey: 'seed_u1_2_' + Date.now(), remark: '测试注资' });
      const o = Mediation.create({ buyerId: 'u1', sellerId: 'u2', svcId: 'a3', svcName: '安许代办', amount: 68000 });
      Mediation.pay(o.id, 'balance'); Mediation.accept(o.id, 'u2');
      o.milestones.forEach((m, i) => { Mediation.confirmMilestone(o.id, i, false); });
      Mediation.settle(o.id);
      Mediation.review(o.id, 5, '很好');
      const g = SvcRatingStore.get('a3');
      return g ? g.count + '/' + g.avg : null;
    });
    ok('订单评价聚合到服务卡片（a3: 1条/5分）', r === '1/5', r);
    await p.close();
  }

  console.log('\n==== 结果：PASS ' + pass + ' / FAIL ' + fail + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(2); });
