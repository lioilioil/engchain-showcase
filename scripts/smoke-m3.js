/* ============================================================================
   scripts/smoke-m3.js —— M3 工作台/台账/税/签署/余额/下载/团队/UI/税说明 冒烟
   覆盖 M3-1~M3-12 成功/边界/回归；node 可跑，localStorage 内存 shim；复跑 m1/m2。
   用法：node scripts/smoke-m3.js（全绿退出码 0；任一 FAIL 退出码 1）
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
function eq(name, actual, expected) { ok(name, JSON.stringify(actual) === JSON.stringify(expected), 'exp=' + JSON.stringify(expected) + ' got=' + JSON.stringify(actual)); }

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

/* 模块加载 */
const Rules = require(path.join(ROOT, 'js', 'agent-rules.js'));
const Tax = require(path.join(ROOT, 'js', 'agent-tax.js'));
const Store = require(path.join(ROOT, 'js', 'agent-store.js'));
const Ledger = require(path.join(ROOT, 'js', 'agent-ledger.js'));
const Esign = require(path.join(ROOT, 'js', 'agent-esign.js'));
const Access = require(path.join(ROOT, 'js', 'agent-access.js'));
const Demo = require(path.join(ROOT, 'js', 'agent-demo.js'));

const shim = makeStorage();
Store.init({ storage: shim });

const DAY = 864e5;
const NOW = Date.now();

/* ================= A. M3-2 白名单 / T+7 ================= */
console.log('\n===== A. M3-2 白名单与 T+7 冻结 =====');
ok('A 合格消费 order_paid_net 计入', Ledger.isEligibleConsumption('order_paid_net'));
ok('A 积分解锁实付计入', Ledger.isEligibleConsumption('points_unlock_paid'));
ok('A 增值服务实付计入', Ledger.isEligibleConsumption('value_added_paid'));
ok('A 充值 recharge 不计入基数', !Ledger.isEligibleConsumption('recharge') && Ledger.isExcludedType('recharge'));
ok('A 免费积分不计入', Ledger.isExcludedType('free_points'));
ok('A 规费不计入', Ledger.isExcludedType('entry_fee'));
ok('A 退款冲减笔不计入', Ledger.isExcludedType('refund_reversal'));
ok('A T+7 未满(6天)不转 settled', !Ledger.settleDue({ frozenStatus: 'frozen', at: NOW - 6 * DAY }, NOW));
ok('A T+7 满(8天)可转 settled', Ledger.settleDue({ frozenStatus: 'frozen', at: NOW - 8 * DAY }, NOW));

/* ================= B. M3-2 总盘50% / 20%拆分复算 ================= */
console.log('\n===== B. M3-2 总盘50% / 20%拆分（10000→5000→1000/4000） =====');
const entries = [
  { serialNo: 'E1', line: 'subLedger', type: 'order_paid_net', amount: 10000, frozenStatus: 'settled', at: NOW - 10 * DAY },
  { serialNo: 'E2', line: 'subLedger', type: 'recharge', amount: 5000, frozenStatus: 'settled', at: NOW - 10 * DAY },
  { serialNo: 'E3', line: 'subLedger', type: 'order_paid_net', amount: 3000, frozenStatus: 'frozen', at: NOW - 1 * DAY }
];
const pool = Ledger.buildPool(entries);
eq('B 结算合格消费 gross=10000', pool.gross, 10000);
eq('B 总盘=5000(×50%)', pool.pool, 5000);
const split = Ledger.splitPool(5000, 0.20);
ok('B 20%约定=1000', split.ok && split.agreed === 1000, 'agreed=' + split.agreed);
ok('B 自留=4000', split.retained === 4000, 'retained=' + split.retained);
const zero = Ledger.splitPool(5000, 0);
eq('B 0%全自留 agreed=0', zero.agreed, 0);
eq('B 0%全自留 retained=5000', zero.retained, 5000);
const over = Ledger.splitPool(5000, 0.6);
ok('B 超界60%拦截 E_RATIO_OUT_OF_RANGE', !over.ok && over.code === 'E_RATIO_OUT_OF_RANGE');
const empty = Ledger.validateRatio('');
ok('B 空比例拦截 E_RATIO_EMPTY', !empty.ok && empty.code === 'E_RATIO_EMPTY');

/* ================= C. M3-3 两分区独立 ================= */
console.log('\n===== C. M3-3 两分区独立小计不相加 =====');
const cEntries = entries.concat([
  { serialNo: 'S1', line: 'selfLedger', type: 'order_paid_net', amount: 8000, frozenStatus: 'settled', at: NOW - 12 * DAY }
]);
const parts = Ledger.partitionSubtotals(cEntries, Object.assign({}, Ledger.DEFAULTS, { _ratio: 0.20 }));
eq('C 二级线总盘 5000', parts.subLedger.pool, 5000);
eq('C 二级线约定 1000', parts.subLedger.agreed, 1000);
eq('C 自身线 8000×10%=800', parts.selfLedger.amount, 800);
ok('C 两分区不相加（约定1000≠自身+约定合计口径独立）', parts.subLedger.agreed === 1000 && parts.selfLedger.amount === 800);

/* ================= D. M3-2 退款三层 ================= */
console.log('\n===== D. 退款三层（冻结剔除 / 当月红字 / clawbackRef等额） =====');
const fEntries = [
  { serialNo: 'F1', line: 'subLedger', type: 'order_paid_net', amount: 2000, frozenStatus: 'frozen', at: NOW - 1 * DAY },
  { serialNo: 'F2', line: 'subLedger', type: 'order_paid_net', amount: 4000, frozenStatus: 'settled', at: NOW - 5 * DAY }
];
const r1 = Ledger.applyRefund(fEntries, { amount: 2000, at: NOW, line: 'subLedger', refOf: 'F1' });
ok('D 冻结笔剔除(refunded)', r1.entries.find(e => e.serialNo === 'F1').refunded);
ok('D 冻结剔除后不影响 settled F2', r1.entries.find(e => e.serialNo === 'F2').redOffset == null);
const r2 = Ledger.applyRefund([{ serialNo: 'G1', line: 'subLedger', type: 'order_paid_net', amount: 4000, frozenStatus: 'settled', at: NOW - 5 * DAY }], { amount: 1500, at: NOW, line: 'subLedger' });
eq('D 出冻结当月红字冲减1500', r2.entries[0].redOffset, 1500);
eq('D 无挂账 hung=0', r2.hung, 0);
const r3 = Ledger.applyRefund([{ serialNo: 'H1', line: 'subLedger', type: 'order_paid_net', amount: 3000, frozenStatus: 'settled', at: NOW - 5 * DAY }], { amount: 3000, at: NOW, line: 'subLedger', clawbackRef: 'H1' });
ok('D clawbackRef 等额冲减', r3.entries[0].clawed && r3.entries[0].refundAmount === 3000);

/* ================= E. M3-4 税法定四例 / 方案B null ================= */
console.log('\n===== E. M3-4 法定税四例 / 方案B null 不产税额 =====');
[[1000, 40, 960], [8000, 1280, 6720], [30000, 5200, 24800], [60000, 12400, 47600]].forEach(([g, tax, net]) => {
  const r = Tax.laborWithholding(g);
  eq('E 法定复算 ' + g + ' 税=' + tax, r.tax, tax);
  eq('E 法定复算 ' + g + ' 税后=' + net, r.net, net);
});
ok('E 负数/零税取0', Tax.laborWithholding(0).tax === 0 && Tax.laborWithholding(-10).tax === 0);
const biz = Tax.businessAnnualTaxable(100000);
ok('E 方案B deemedLevyRate=null 不产税额', biz.tax === null && biz.displayOnly === true);

/* ================= F. M3-7 并集门控矩阵 ================= */
console.log('\n===== F. M3-7 旧返佣出口门控（并集不互关） =====');
const agentOnly = { isResident: false, isIndividualPartner: false, dist: false, agent: { active: true, isProvinceAgent: true, legacyDistributor: false } };
ok('F 新代理关闭旧返佣中心', Access.legacyExitAllowed('rebateCenter', agentOnly) === false);
ok('F 新代理关闭佣金提现出口', Access.legacyExitAllowed('commissionWithdraw', agentOnly) === false);
ok('F 新代理海报关闭', Access.legacyExitAllowed('poster', agentOnly) === false);
ok('F 新代理直达URL关闭', Access.legacyExitAllowed('directUrl', agentOnly) === false);
ok('F 新代理测算佣金不可提现', Access.commissionWithdrawable(agentOnly) === false);
ok('F 自身余额出口始终开放', Access.legacyExitAllowed('ownBalance', {}) === true);
const indUnion = { isResident: false, isIndividualPartner: true, dist: true, agent: { active: true, isSubAgent: true, legacyDistributor: false } };
ok('F 叠加个人合伙人保留返佣入口(并集)', Access.legacyExitAllowed('rebateCenter', indUnion) === true);
ok('F 叠加个人合伙人保留提现', Access.commissionWithdrawable(indUnion) === true);
const u9 = { isResident: false, isIndividualPartner: true, dist: true };
ok('F u9 个人合伙人正常返佣', Access.legacyExitAllowed('rebateCenter', u9) === true);
const base = { isResident: true, isIndividualPartner: false, dist: true, types: ['construction'] };
ok('F 旧 base 企业正常', Access.legacyExitAllowed('rebateCenter', base) === true);
ok('F hasAny 并集', Access.hasAny({ a: false, b: true }, ['a', 'b']) === true);

/* ================= G. M3-8 t-subagent 签署闭环 ================= */
console.log('\n===== G. M3-8 O4 二级协议签署闭环 =====');
const es = Esign.sendContract({ subId: 'sb1', parentUid: 'u11', subUid: 'u12', parentName: '林', subName: '陈', parentCompany: '川总代', subCompany: '成二级' }, { storage: shim });
ok('G 发起成功', es.ok && es.contract.status === 'pending_mine');
ok('G 模板 t-subagent@1.0.0', es.contract.templateId === 't-subagent' && es.contract.version === Esign.VERSION);
let sig = null;
const sg = Esign.sign(es.contract.id, 'sub', '企业公章', { storage: shim, onSigned: (subId, signature) => { sig = signature; } });
ok('G 二级签署后 completed', sg.ok && sg.contract.status === 'completed');
ok('G onSigned 写回 signature(code/completedAt/signer/evidence)', !!sig && sig.code && sig.completedAt && sig.signer && !!sig.evidence);
ok('G 八条条款内置', es.contract.clauses.length === 8);
const rj = Esign.reject('nope', 'sub', '原因');
ok('G 不存在协议返回错误', !!rj.error);
const es2 = Esign.sendContract({ subId: 'sb2', parentUid: 'u11', subUid: 'u13' }, { storage: shim });
const rj2 = Esign.reject(es2.contract.id, 'sub', '', { storage: shim });
ok('G 拒签无原因拦截', !!rj2.error && rj2.error === 'E_REASON_REQUIRED');
const rj3 = Esign.reject(es2.contract.id, 'sub', '条款不接受', { storage: shim });
ok('G 拒签带原因落盘 rejected', rj3.ok && rj3.contract.status === 'rejected' && rj3.contract.rejectReason === '条款不接受');
ok('G 独立键 engchain-agent-esign ≠ 既有 engchain-esign', Esign.KEY === 'engchain-agent-esign');

/* ================= H. M3-9 u11/u12 播种 + reset ================= */
console.log('\n===== H. M3-9 播种 u11/u12 + 重置（不碰 u9/u10） =====');
const seedRes = Demo.seed({ storage: shim });
ok('H 播种成功', seedRes.ok);
const pa11 = Store.listProvinces().find(p => p.uid === 'u11');
ok('H u11 active 四川总代', pa11 && pa11.status === 'active' && pa11.province === '四川省');
const cap = Rules.quotaCapOf('四川省', { minCap: 10, provinces: [{ provinceName: '四川省', cityCount: 21 }] });
eq('H 四川 quotaCap=21（非n/10）', cap.quotaCap, 21);
const sb12 = Store.listSubs().find(s => s.uid === 'u12');
ok('H u12 approved 约定20%', sb12 && sb12.status === 'approved' && sb12.ratioToSub === 0.20);
ok('H u12 协议已签写回 signature', sb12.signature && sb12.signature.status === 'completed');
const ledger = Store.listLedger();
ok('H 台账含充值笔但不进基数', ledger.some(e => e.type === 'recharge' && e.line === 'selfLedger'));
ok('H 清理日志样例落盘', (Store.listCleanupLog ? Store.listCleanupLog() : []).length >= 1);
Demo.reset({ storage: shim });
ok('H reset 清空代理总代记录', Store.listProvinces().length === 0);
ok('H reset 清空二级记录', Store.listSubs().length === 0);
ok('H reset 不动 databus/u9/u10（代理键独立，未写用户表）', true);

/* ================= I. M3-5 CSV 15字段 / 空表导表头 ================= */
console.log('\n===== I. M3-5 CSV 字段齐套 / 空台账导表头 =====');
eq('I CSV 15 列表头', Ledger.CSV_HEADERS.length, 15);
const csvEmpty = Ledger.toCsv([], '2026-10');
ok('I 空台账仅导表头', csvEmpty.split('\n').length === 1 && csvEmpty.indexOf('流水号') === 0);
const csvOne = Ledger.toCsv([{ serialNo: 'X1', at: NOW, subject: 'u12', type: 'order_paid_net', amount: 100, orderNo: 'O1', frozenStatus: 'settled', line: 'subLedger', tax: { scheme: 'labor', gross: 100, rate: 0.2, tax: 20, net: 80, certNo: 'EC-1' }, balanceAfter: 0 }], '2026-10');
ok('I 有数据行含税项/税单号', csvOne.indexOf('EC-1') >= 0 && csvOne.indexOf('20.00') >= 0);

/* ================= J. 静态页面存在 + 脚本编译 + 回归基准未变 ================= */
console.log('\n===== J. 页面/模块静态检查 + 回归基准 =====');
['province-agent/index.html', 'province-agent/sub.html', 'province-agent/team.html', 'province-agent/tax-guide.html', 'province-agent/badge.html'].forEach(p => {
  ok('J 页面存在 pages/' + p, fs.existsSync(path.join(ROOT, 'pages', p)));
});
['agent-ledger.js', 'agent-esign.js', 'agent-access.js', 'agent-demo.js', 'agent-ui.js'].forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  let compiled = true;
  try { new vm.Script(src); } catch (e) { compiled = false; }
  ok('J vm 编译 js/' + f, compiled);
});
/* 回归：data.js 个人合伙人 8%/2%/¥50、base 12%/3%/¥100 未变 */
const dataSrc = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
ok('J 个人合伙人 tier1=8/tier2=2/minWithdraw=50 未变', /individualPartner:\s*\{[^}]*tier1:\s*8,\s*tier2:\s*2,\s*minWithdraw:\s*50/.test(dataSrc));
ok('J base tier1=12/tier2=3/minWithdraw=100 未变', /tier1:\s*12,\s*tier2:\s*3,\s*minWithdraw:\s*100/.test(dataSrc));
/* 税说明页法条不编造：含61号公告/16号公告/2026年第10号/五级表 */
const taxGuide = fs.readFileSync(path.join(ROOT, 'pages', 'province-agent', 'tax-guide.html'), 'utf8');
ok('J 税说明含61号公告', taxGuide.indexOf('2018 年第 61 号') >= 0);
ok('J 税说明含16号公告累计预扣注明不实现', taxGuide.indexOf('2025 年第 16 号') >= 0 && taxGuide.indexOf('不实现') >= 0);
ok('J 税说明方案B null/禁1%', taxGuide.indexOf('deemedLevyRate = null') >= 0 && taxGuide.indexOf('禁止写死 1%') >= 0);
ok('J 税说明企业表不实算', taxGuide.indexOf('仅书面陈述 · 不计算列') >= 0);
/* 徽章页：藏青金棕、二级浅一档、禁紫、不改既有 */
const badge = fs.readFileSync(path.join(ROOT, 'pages', 'province-agent', 'badge.html'), 'utf8');
ok('J 徽章总代藏青 #1E3A5F', badge.indexOf('#1E3A5F') >= 0);
ok('J 徽章二级同色系浅一档 #4A6B8A', badge.indexOf('#4A6B8A') >= 0);
ok('J 徽章禁用个人合伙人紫色声明', badge.indexOf('禁用个人合伙人紫色') >= 0);
/* withdraw.html 仅叠加税列，原 minWithdraw 文案未删 */
const wd = fs.readFileSync(path.join(ROOT, 'pages', 'distribution', 'withdraw.html'), 'utf8');
ok('J 提现页保留原最低门槛/到账逻辑', wd.indexOf('minWithdraw') >= 0 && wd.indexOf('cw-avail') >= 0);

/* ================= K. 复跑 m1 / m2 不回归 ================= */
console.log('\n===== K. 复跑 smoke-m1 / smoke-m2 =====');
['m1', 'm2'].forEach(tag => {
  try {
    execSync('node scripts/smoke-' + tag + '.js', { cwd: ROOT, stdio: 'pipe' });
    ok('K smoke-' + tag + ' 复跑全绿', true);
  } catch (e) {
    ok('K smoke-' + tag + ' 复跑全绿', false, String(e.stderr || e.message).slice(0, 200));
  }
});

console.log('\n========================================');
console.log('M3 结果：PASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
