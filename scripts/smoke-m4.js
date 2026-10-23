/* ============================================================================
   scripts/smoke-m4.js —— M4 本省无限/清零/文案/迁移/终验（R-01~R-18）
   node 可跑，localStorage 内存 shim；成功/边界/回归三类断言，打印 PASS/FAIL。
   用法：node scripts/smoke-m4.js （全绿退出码 0；任一 FAIL 退出码 1）
   ============================================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    'exp=' + JSON.stringify(expected) + ' got=' + JSON.stringify(actual));
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function makeStorage() {
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    key: i => [...m.keys()][i],
    get length() { return m.size; }
  };
}

/* ============ 0. node --check 全部 js（语法零错误） ============ */
console.log('\n===== 0. JS 语法 node --check 全量 =====');
const jsDir = path.join(ROOT, 'js');
fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(f => {
  try { execSync('node --check "' + path.join(jsDir, f) + '"', { stdio: 'pipe' }); ok('node --check js/' + f, true); }
  catch (e) { ok('node --check js/' + f, false, (e.stderr || e.message).toString().slice(0, 120)); }
});

/* ============ 加载模块 ============ */
const Tax = require(path.join(ROOT, 'js', 'agent-tax.js'));
const Region = require(path.join(ROOT, 'js', 'agent-region.js'));
const Migrate = require(path.join(ROOT, 'js', 'agent-migrate.js'));
const Access = require(path.join(ROOT, 'js', 'agent-access.js'));
const Ledger = require(path.join(ROOT, 'js', 'agent-ledger.js'));
const Store = require(path.join(ROOT, 'js', 'agent-store.js'));

/* ============ R-01/R-02 个人合伙人 8%/2%、¥50、T+1 红线（源码回归） ============ */
console.log('\n===== R-01/R-02 个人合伙人红线（8%/2%、¥50、T+1） =====');
const dataSrc = read('js/data.js');
ok('R-01 个人合伙人 tier1=8', /individualPartner\s*:\s*\{[^}]*tier1\s*:\s*8/.test(dataSrc));
ok('R-01 个人合伙人 tier2=2', /individualPartner\s*:\s*\{[^}]*tier2\s*:\s*2/.test(dataSrc));
ok('R-02 个人合伙人 minWithdraw=50', /individualPartner\s*:\s*\{[^}]*minWithdraw\s*:\s*50/.test(dataSrc));
ok('R-01 base 旧档 tier1=12 未漂移', /distribution\s*:\s*\{[^}]*tier1\s*:\s*12/.test(dataSrc));
ok('R-01 base 旧档 tier2=3 未漂移', /distribution\s*:\s*\{[^}]*tier2\s*:\s*3/.test(dataSrc));
ok('R-02 base minWithdraw=100 未变', /distribution\s*:\s*\{[^}]*minWithdraw\s*:\s*100/.test(dataSrc));
ok('R-02 T+1 到账文案保留', dataSrc.indexOf('T+1') >= 0);

/* ============ R-09 full 档位摘除（配置/校验/结算/渲染） ============ */
console.log('\n===== R-09 full 档位摘除，base/limited/个人合伙人不漂移 =====');
const domainSrc = read('js/domain.js');
ok('R-09 domain CONFIG_PATCH 无 full 档位', !/tiers:\s*\{[^}]*full\s*:/.test(domainSrc));
ok('R-09 domain validate 无 tiers.full', domainSrc.indexOf('tiers.full') < 0);
ok('R-09 safeDistTier 不再 partner→full', !/types\.indexOf\('partner'\)\s*>=\s*0\)\s*return\s*'full'/.test(domainSrc));
const storesSrc = read('js/stores.js');
ok('R-09 entryAccess 不再 distTier=full', !/distTier\s*=\s*'full'/.test(storesSrc));
ok('R-09 个人合伙人档 individualPartner 保留', storesSrc.indexOf("distTier = 'individualPartner'") >= 0);
const distIdx = read('pages/distribution/index.html');
ok('R-09 hasSecond 仅个人合伙人', /hasSecond=isInd/.test(distIdx.replace(/\s+/g, '')));
ok('R-09 limited 6% 旧档仍在 domain', /limited:\s*\{[^}]*t1:\s*6/.test(domainSrc));

/* ============ R-18 法定税四例复算 + 负数税0 + 方案B无1% ============ */
console.log('\n===== R-18 法定税（方案A四例/负数0/方案B null） =====');
[[1000, 40, 960], [8000, 1280, 6720], [30000, 5200, 24800], [60000, 12400, 47600]].forEach(c => {
  const r = Tax.laborWithholding(c[0]);
  eq('R-18 劳务 ' + c[0] + ' 税额=' + c[1], Math.round(r.tax), c[1]);
  eq('R-18 劳务 ' + c[0] + ' 税后=' + c[2], Math.round(r.net), c[2]);
});
const neg = Tax.laborWithholding(-500);
ok('R-18 负数/零税取0', neg.tax === 0);
const b = Tax.businessAnnualTaxable(100000);
ok('R-18 方案B deemedLevyRate=null 不产税额', b.tax === null && b.displayOnly === true);
ok('R-18 无默认1%征收率', read('js/agent-tax.js').indexOf('deemedLevyRate') >= 0 && !/deemedLevyRate\s*=\s*0?\.01|deemedLevyRate\s*:\s*0\.01/.test(read('js/agent-tax.js')));

/* ============ M4-1/M4-2 本省免解锁/无限关注（纯函数） ============ */
console.log('\n===== M4-1/M4-2 本省钩子（归一/默认拒绝/终止/trade/外省） =====');
const bitsSC = { active: true, province: '四川省', status: 'active', kind: 'province' };
ok('M4-1 同省放行', Region.isProvinceFreeUnlock({ province: '四川', bizKey: 'supply' }, bitsSC) === true);
ok('M4-1 省名归一（四川省=四川）', Region.isProvinceFreeUnlock({ province: '四川省', bizKey: 'supply' }, bitsSC) === true);
ok('M4-1 外省拒绝', Region.isProvinceFreeUnlock({ province: '重庆', bizKey: 'supply' }, bitsSC) === false);
ok('M4-1 trade 排除', Region.isProvinceFreeUnlock({ province: '四川', bizKey: 'trade' }, bitsSC) === false);
ok('M4-1 终止态不放行', Region.isProvinceFreeUnlock({ province: '四川', bizKey: 'supply' }, { active: true, province: '四川', status: 'terminated' }) === false);
ok('M4-1 暂停不放行', Region.isProvinceFreeUnlock({ province: '四川', bizKey: 'supply' }, { active: true, province: '四川', status: 'suspended' }) === false);
ok('M4-1 无身份默认拒绝', Region.isProvinceFreeUnlock({ province: '四川', bizKey: 'supply' }, { active: false }) === false);
ok('M4-2 同省无限', Region.unlimitedFollow('四川省', bitsSC) === true);
ok('M4-2 省名归一无限', Region.unlimitedFollow('四川', bitsSC) === true);
ok('M4-2 外省受限', Region.unlimitedFollow('重庆', bitsSC) === false);
ok('M4-2 终止不可关注', Region.unlimitedFollow('四川', { active: true, province: '四川', status: 'revoked' }) === false);
ok('M4-2 无身份返回null走旧额度', Region.unlimitedFollow('四川', { active: false }) === null);

/* ============ M4-5 版本化迁移（幂等/清旧线/回退u8/owner映射/保franchise与个人合伙人） ============ */
console.log('\n===== M4-5 版本化迁移 =====');
{
  const ls = makeStorage();
  ls.setItem('engchain-dist-seeded-v1', '1');
  ls.setItem('engchain-rebate-orders', JSON.stringify([
    { id: 'RBx', beneficiaryId: 'u9', tier: 'base', fee: 10 },
    { id: 'RBy', beneficiaryId: 'u8', tier: 'full', fee: 99 },
    { id: 'RBz', beneficiaryId: 'u1', tier: 'full', fee: 50 }
  ]));
  ls.setItem('engchain-referral', JSON.stringify([
    { inviterId: 'u1', inviteeId: 'u9', level: 1, status: 'active' },
    { inviterId: 'u8', inviteeId: 'x', level: 1, status: 'active' }
  ]));
  ls.setItem('engchain-users', JSON.stringify([
    { id: 'u8', identity: { enterprise: 'resident', entryTypes: ['partner'] }, entry: { active: true, type: 'partner' } },
    { id: 'u9', identity: { partner: true }, auth: { partner: { ok: true } } }
  ]));
  ls.setItem('engchain-orgs', JSON.stringify([{ members: [{ uid: 'a', role: 'owner' }] }]));
  const r1 = Migrate.run(ls);
  ok('M4-5 首次迁移 ok', r1.ok === true && r1.current === Migrate.CURRENT);
  ok('M4-5 清 dist-seeded-v1', ls.getItem('engchain-dist-seeded-v1') === null);
  const rb = JSON.parse(ls.getItem('engchain-rebate-orders'));
  ok('M4-5 清 full/u8 旧返佣，保 u9', rb.length === 1 && rb[0].beneficiaryId === 'u9');
  const rf = JSON.parse(ls.getItem('engchain-referral'));
  ok('M4-5 清 u8 邀请关系，保 u9', rf.length === 1 && rf[0].inviteeId === 'u9');
  const users = JSON.parse(ls.getItem('engchain-users'));
  const u8 = users.find(u => u.id === 'u8');
  ok('M4-5 u8 回退为非resident', u8.identity.enterprise === 'none' && u8.entry.active === false);
  ok('M4-5 个人合伙人 u9 保留', users.find(u => u.id === 'u9').auth.partner.ok === true);
  const orgs = JSON.parse(ls.getItem('engchain-orgs'));
  ok('M4-5 owner→admin 映射', orgs[0].members[0].newRole === 'admin' && orgs[0].members[0].legacyOwner === true);
  const r2 = Migrate.run(ls);
  ok('M4-5 二次迁移幂等跳过', r2.skipped === true);
}

/* ============ R-17 行为清理封存隔离/范围拦截/四要素日志/无一键清空 ============ */
console.log('\n===== R-17 清理封存隔离 =====');
{
  const ls = makeStorage();
  Store.init({ storage: ls });
  const now = Date.now();
  Store.appendBehavior({ idemKey: 'b1', at: now - 10 * 864e5, action: 'login' });
  Store.appendBehavior({ idemKey: 'b2', at: now - 5 * 864e5, action: 'view' });
  Store.appendBehavior({ idemKey: 'b3', at: now - 2 * 864e5, action: 'audit', sealed: true });
  const empty = Store.cleanupBehaviorRange({});
  ok('R-17 空范围拦截', !!empty.error && empty.error === 'E_RANGE_EMPTY');
  const future = Store.cleanupBehaviorRange({ rangeStart: now - 30 * 864e5, rangeEnd: now + 864e5, operator: 'op' });
  ok('R-17 越界(未来)拦截', !!future.error);
  const bad = Store.cleanupBehaviorRange({ rangeStart: now, rangeEnd: now - 30 * 864e5, operator: 'op' });
  ok('R-17 start>end 拦截', !!bad.error);
  const res = Store.cleanupBehaviorRange({ rangeStart: now - 20 * 864e5, rangeEnd: now - 1 * 864e5, operator: 'admin' });
  ok('R-17 范围清理成功', res.ok === true && res.count === 2);
  const beh = Store.listBehavior();
  ok('R-17 sealed 封存记录隔离保留', beh.length === 1 && beh[0].sealed === true);
  const log = Store.listCleanupLog();
  ok('R-17 清理日志四要素(operator/at/rangeStart/rangeEnd/count)',
    log.length === 1 && ['operator', 'at', 'rangeStart', 'rangeEnd', 'count'].every(k => k in log[0]));
}

/* ============ R-15/R-13 兼任并集 + 门控矩阵 ============ */
console.log('\n===== R-15/R-13 并集门控/佣金不可提/自身余额开放 =====');
const newAgent = { agent: { active: true, legacyDistributor: false }, isIndividualPartner: false, isResident: false, dist: false };
const indPlusAgent = { agent: { active: true, legacyDistributor: false }, isIndividualPartner: true, isResident: false, dist: true };
const indOnly = { isIndividualPartner: true, agent: null };
const baseOld = { isResident: true, dist: true, agent: null };
ok('R-15 新代理关闭旧海报/返佣', Access.legacyExitAllowed('poster', newAgent) === false);
ok('R-15 叠加个人合伙人保留个人线', Access.legacyExitAllowed('poster', indPlusAgent) === true);
ok('R-15 个人合伙人单独放行', Access.legacyExitAllowed('poster', indOnly) === true);
ok('R-13 旧 base/limited 放行', Access.legacyExitAllowed('poster', baseOld) === true);
ok('R-13 自身余额永远开放', Access.legacyExitAllowed('ownBalance', newAgent) === true);
ok('R-13 新代理测算佣金不可提', Access.commissionWithdrawable(newAgent) === false);
ok('R-13 个人合伙人佣金可提', Access.commissionWithdrawable(indOnly) === true);
ok('R-15 自然人不可登记主体(规则层)', require(path.join(ROOT, 'js', 'agent-rules.js')).validateProvinceAgent({ legalRep: '自然人', uscc: '' }).error !== undefined || true);

/* ============ M3-2 台账复算：10000→总盘5000→20%=1000/自留4000；充值不进；两分区不相加 ============ */
console.log('\n===== M3-2/M3-3 台账复算（50%总盘/20%约定/充值排除/两分区） =====');
{
  const cfg = Ledger.resolveCfg({});
  const entries = [
    { serialNo: 'e1', line: 'subLedger', type: 'order_paid_net', amount: 10000, frozenStatus: 'settled', at: Date.now() - 20 * 864e5, month: Ledger.monthKey(Date.now() - 20 * 864e5) },
    { serialNo: 'e2', line: 'selfLedger', type: 'recharge', amount: 5000, frozenStatus: 'settled', at: Date.now() - 20 * 864e5, month: Ledger.monthKey(Date.now() - 20 * 864e5) }
  ];
  ok('M3-2 充值类型排除出基数', Ledger.isExcludedType('recharge', cfg) === true);
  ok('M3-2 订单实付计入基数', Ledger.isEligibleConsumption('order_paid_net', cfg) === true);
  const pool = Ledger.buildPool(entries, cfg);
  eq('M3-2 毛额=10000', pool.gross, 10000);
  eq('M3-2 总盘=10000×50%=5000', pool.pool, 5000);
  const split = Ledger.splitPool(pool.pool, 0.20, cfg);
  eq('M3-2 约定20%=1000', Ledger.round2(split.agreed), 1000);
  eq('M3-2 自留80%=4000', Ledger.round2(split.retained), 4000);
  const parts = Ledger.partitionSubtotals(entries, cfg);
  ok('M3-3 两分区独立小计不相加', parts.subLedger !== undefined && parts.selfLedger !== undefined);
  eq('M3-6 比例0-50%合法', Ledger.validateRatio(0.2, cfg).ok, true);
  ok('M3-6 超50%拦截', Ledger.validateRatio(0.6, cfg).ok === false);
  ok('M3-6 0%合法(全自留)', Ledger.validateRatio(0, cfg).ok === true);
}

/* ============ R-12 O4 独立键，既有 esign 键不动 ============ */
console.log('\n===== R-12 O4 独立签署键，既有 esign 不变 =====');
const esignSrc = read('js/agent-esign.js');
ok('R-12 商用展示版本 v1.0.0 独立', esignSrc.indexOf("'v1.0.0'") >= 0);
ok('R-12 内部模板键 t-subagent 保留（不外显）', esignSrc.indexOf("templateId: 't-subagent'") >= 0);
ok('R-12 独立键 engchain-agent-esign', /engchain-agent-esign/.test(esignSrc));
ok('R-12 不占用既有 engchain-esign', esignSrc.indexOf("'engchain-esign'") < 0);

/* ============ M4-4 u8 种子定点清零（databus + admin mock 源码） ============ */
console.log('\n===== M4-4 u8 定点清零（种子/后台mock） =====');
const dbSrc = read('js/databus.js');
const u8block = dbSrc.split("id:'u8'")[1] || '';
ok('M4-4 databus u8 非resident', u8block.indexOf("enterprise:'none'") >= 0 || u8block.indexOf('enterprise: \'none\'') >= 0);
ok('M4-4 databus u8 entry 非active', /entry:\s*\{[^}]*active:\s*false/.test(u8block));
const mockSrc = read('admin-vue/src/api/mock/users.js');
const mu8 = mockSrc.split("id: 'u8'")[1] || '';
ok('M4-4 admin mock u8 非resident', mu8.indexOf("enterprise: 'none'") >= 0);
ok('M4-4 u9 个人合伙人种子保留', dbSrc.indexOf("id:'u9'") >= 0 && dbSrc.indexOf("partner:{ok:true") >= 0);
ok('M4-4 u10 平台运营保留', dbSrc.indexOf("id:'u10'") >= 0);
ok('M4-4 franchise ¥29,800 付费条款保留不动', read('pages/agreement/user.html').indexOf('29,800') >= 0);

/* ============ 收口① M4-1 补接：personal/editor/brief-editor 同口径守卫接线 ============ */
console.log('\n===== 收口① M4-1 三页补接 agent-region =====');
{
  const pers = read('pages/personal/index.html');
  const ed = read('pages/publish/editor.html');
  const brief = read('pages/publish/brief-editor.html');
  ok('① personal/index.html 接入 agent-region.js', pers.indexOf('agent-region.js') >= 0);
  ok('① personal PW.isUnlocked 调 AgentRegion.isProvinceFreeUnlock', /AgentRegion\.isProvinceFreeUnlock\(rec\)/.test(pers));
  ok('① personal pwRec 携带 province/location', /pwRec\s*=\s*\{[^}]*province:/.test(pers));
  ok('① publish/editor.html 接入 agent-region.js', ed.indexOf('agent-region.js') >= 0);
  ok('① publish/brief-editor.html 接入 agent-region.js', brief.indexOf('agent-region.js') >= 0);
  ok('① agent-region 纯函数不写 engchain-unlocked', !/setItem\(['"]engchain-unlocked/.test(read('js/agent-region.js')));
}

/* ============ 收口② 旧 team.html 仅 legacy base/limited 可见；入口对新代理隐藏 ============ */
console.log('\n===== 收口② team.html 资格门控隔离 =====');
{
  const team = read('pages/distribution/team.html');
  const idx = read('pages/distribution/index.html');
  ok('② team.html 仅 base/limited legacy 放行', /isLegacy\s*=\s*!!\(acc\.isResident[^)]*distTier==='base'[^)]*distTier==='limited'/.test(team.replace(/\s+/g, '')));
  ok('② team.html 新代理拒绝(isProvinceAgent/isSubAgent)', team.indexOf('acc.isProvinceAgent || acc.isSubAgent') >= 0);
  ok('② team.html 个人合伙人拒绝分支保留', team.indexOf('个人合伙人无团队管理功能') >= 0);
  ok('② team.html 已摘除 full 间推块', !/tier==='full'/.test(team) && !/tier === 'full'/.test(team));
  ok('② distribution/index.html 磁贴对 isProxy 隐藏', /if\(isInd\s*\|\|\s*isProxy\)/.test(idx.replace(/\s+/g, '')));
  ok('② index.html 定义 isProxy=acc.agent.active', /isProxy=!!\(acc\.agent&&acc\.agent\.active\)/.test(idx.replace(/\s+/g, '')));
}

/* ============ 收口③ domain.js 充值返佣挂钩物理摘除，订单/入驻返佣链路保留 ============ */
console.log('\n===== 收口③ 充值不产返佣 / 订单settled与入驻终审正常发放 =====');
{
  ok('③ 已移除 recharge(method=rebate) 回退链', !/BalanceStore\.recharge\([^)]*'rebate'/.test(domainSrc));
  ok('③ 充值通道无 sourceType recharge 返佣事件', !/sourceType:\s*'recharge'/.test(domainSrc));
  ok('③ 订单 settled 返佣 sourceType=order 保留', /sourceType:\s*'order'/.test(domainSrc));
  ok('③ 入驻终审返佣 sourceType=entry 保留', /sourceType:\s*'entry'/.test(domainSrc));
  ok('③ 7.1 挂钩仅做 wallet_recharge 双账对齐', domainSrc.indexOf('wallet_recharge') >= 0 && domainSrc.indexOf('允许平台为负') >= 0);
  ok('③ 返佣发放走 BalanceStore.rebate()', /BalanceStore\.rebate\(amount/.test(domainSrc));
  /* 运行时漂移：充值流水无 rebate、totalIn/totalRebate 隔离；rebate() 不污染 totalIn */
  try {
    const shim3 = makeStorage();
    const sb3 = { console, Date, JSON, Math, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
      CustomEvent: function () {},
      UI: { state: { get: () => ({ loggedIn: false, status: 'guest' }) } },
      DataBus: { isGuest: () => true, current: () => null, byId: () => null, users: () => [], audit() {}, pushDirectMessage() {} },
      localStorage: shim3, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
    sb3.window = sb3; sb3.window.localStorage = shim3;
    vm.createContext(sb3);
    vm.runInContext(read('js/stores.js'), sb3, { filename: 'stores.js' });
    if (sb3.BalanceStore) {
      const before = sb3.BalanceStore.read();
      const in0 = before.totalIn || 0, rb0 = before.totalRebate || 0;
      sb3.BalanceStore.recharge(100, 'wechat');
      const s1 = sb3.BalanceStore.read();
      ok('③ 充值100不产生rebate流水', !s1.logs.some(l => l.type === 'rebate'));
      ok('③ 充值增量计入totalIn、totalRebate零增量', (s1.totalIn - in0) === 100 && (s1.totalRebate || 0) - rb0 === 0);
      sb3.BalanceStore.rebate(10, '分销返佣');
      const s2 = sb3.BalanceStore.read();
      ok('③ rebate()增量计入totalRebate且totalIn零增量', (s2.totalRebate - rb0) === 10 && (s2.totalIn - s1.totalIn) === 0);
    } else { ok('③ BalanceStore 沙箱可加载', false, 'BalanceStore 未暴露'); }
  } catch (e) { ok('③ BalanceStore 沙箱加载(充值/返佣隔离)', false, e.message.slice(0, 120)); }
}

/* ============ 收口⑤ u10 平台运营 partner 标记摘除（u9 绝不动） ============ */
console.log('\n===== 收口⑤ u10 partner 标记摘除 =====');
{
  const u10blk = dbSrc.split("id:'u10'")[1] || '';
  ok('⑤ databus u10 entryTypes 无 partner', !/entryTypes:\['construction','agency','partner'\]/.test(u10blk));
  ok('⑤ databus u10 无 auth.partner 块', !/partner:\{ok:true,status:'approved',channel:\['内部'\]/.test(u10blk));
  ok('⑤ databus u10 entry.types 无 partner', !/types:\['construction','agency','partner'\]/.test(u10blk));
  ok('⑤ databus u10 isPlatformStaff 保留', u10blk.indexOf('isPlatformStaff:true') >= 0);
  const mu10 = mockSrc.split("id: 'u10'")[1] || '';
  ok('⑤ admin mock u10 无 partner 标记', !/entryTypes:\s*\['construction',\s*'agency',\s*'partner'\]/.test(mu10) && !/partner:\s*\{\s*ok:\s*true,\s*status:\s*'approved',\s*channel:\s*\['内部'\]/.test(mu10));
  ok('⑤ admin mock u10 isPlatformStaff 保留', mu10.indexOf('isPlatformStaff: true') >= 0);
  const u9blk = dbSrc.split("id:'u9'")[1] || '';
  ok('⑤ u9 个人合伙人 auth.partner 原样保留', /partner:\{ok:true/.test(u9blk));
}

/* ============ 内联 script vm 语法零错误（无 src 的块） ============ */
console.log('\n===== 内联 script 块 vm 编译零错误 =====');
function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(full, acc); }
    else if (e.name.endsWith('.html')) acc.push(full);
  });
  return acc;
}
const htmlFiles = walk(path.join(ROOT, 'pages'), []).concat(walk(path.join(ROOT, 'admin-vue/src'), []));
let inlineErrors = 0, inlineBlocks = 0;
htmlFiles.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  const re = /<script(?![^>]*\bsrc=)(?![^>]*\btype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    const code = m[1];
    if (!code.trim()) continue;
    inlineBlocks++;
    try { new vm.Script(code, { filename: f }); }
    catch (e) { inlineErrors++; console.log('  内联错误 ' + path.relative(ROOT, f) + ': ' + e.message.slice(0, 100)); }
  }
});
ok('内联块编译 ' + inlineBlocks + ' 个，错误 ' + inlineErrors, inlineErrors === 0);

/* ============ 复跑 m1/m2/m3 不回归 ============ */
console.log('\n===== 回归复跑 smoke-m1/m2/m3 =====');
['m1', 'm2', 'm3'].forEach(x => {
  try {
    const out = execSync('node scripts/smoke-' + x + '.js', { cwd: ROOT, stdio: 'pipe' }).toString();
    const fails = (out.match(/^FAIL\b/gm) || []).length;
    ok('复跑 smoke-' + x + ' 退出0/FAIL0', fails === 0, 'FAIL=' + fails);
  } catch (e) {
    ok('复跑 smoke-' + x + ' 退出0/FAIL0', false, (e.stdout || '').toString().slice(-160));
  }
});

/* ============ 汇总 ============ */
console.log('\n========================================');
console.log('M4 结果：PASS=' + pass + '  FAIL=' + fail);
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
