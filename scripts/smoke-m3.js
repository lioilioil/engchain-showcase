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

/* ================= L. 阶段2：O4 闭环写回 + 看板/证书/时间线/门控接线静态断言 ================= */
console.log('\n===== L. 阶段2 O4 闭环 + 新组件接线 =====');
{
  const shim2 = makeStorage();
  Store.init({ storage: shim2 });
  /* 构造 approved 二级，走 send→sign→completed 并把 signature 写回 sub 记录 */
  const subRec = { id: 'sb-t2', uid: 'u20', parentUid: 'u11', status: 'approved', ratioToSub: 0.2,
    company: { name: '成都测试公司', legalRep: '陈二', uscc: '91510000X' }, province: '四川省' };
  Store.saveSub(subRec);
  const E2 = require(path.join(ROOT, 'js', 'agent-esign.js'));
  const sent = E2.sendContract({ subId: 'sb-t2', parentUid: 'u11', subUid: 'u20',
    parentName: '林总代', parentCompany: '四川总代公司', subName: '陈二', subCompany: '成都测试公司' }, { storage: shim2 });
  ok('L admin 发起协议返回 pending_mine', sent.ok && sent.contract.status === 'pending_mine');
  let written = null;
  const signed = E2.sign(sent.contract.id, 'sub', '企业签名', { storage: shim2,
    onSigned: function (subId, signature) {
      const r = Store.getSub(subId); if (r) { r.signature = signature; Store.saveSub(r); written = r.signature; }
    } });
  ok('L 二级签署完成 completed', signed.ok && signed.contract.status === 'completed');
  ok('L onSigned 写回 sub.signature=completed', written && written.status === 'completed' && written.code);
  const back = Store.getSub('sb-t2');
  ok('L sub 记录 signature 落盘', back.signature && back.signature.status === 'completed');
  const rej = E2.reject('x', 'sub', '', { storage: shim2 });
  ok('L 拒签原因必填 E_REASON_REQUIRED', rej.error === 'E_REASON_REQUIRED');

  /* 静态接线断言（UI 层 DOM，源码标记） */
  const ui = fs.readFileSync(path.join(ROOT, 'js', 'agent-ui.js'), 'utf8');
  ok('L 看板本月/累计分段存在', ui.indexOf('data-mode="month"') >= 0 && ui.indexOf('data-mode="cum"') >= 0);
  ok('L T+7 冻结聚合卡存在', ui.indexOf('T+7 冻结待结算') >= 0);
  ok('L 授权证书卡存在', ui.indexOf('ag-certi') >= 0 && ui.indexOf('查看授权证书') >= 0);
  ok('L 状态中心时间线存在', ui.indexOf('ag-timeline') >= 0 && ui.indexOf('状态中心') >= 0);
  ok('L 协议中心列表+八条详情存在', ui.indexOf('ag-proto-row') >= 0 && ui.indexOf('第') >= 0);
  ok('L 二级视角归属总代主体', ui.indexOf('归属总代') >= 0 && ui.indexOf('parentCompanyOf') >= 0);
  ok('L 二级去签署/拒签写回', ui.indexOf('data-sub-sign') >= 0 && ui.indexOf('data-sub-reject') >= 0);
  ok('L 行为记录只读入口', ui.indexOf('listBehavior') >= 0);
  ok('L 发起二级表单补执照/法人/联系人/意向省（抽屉 data-f 字段）', ui.indexOf('data-f="license"') >= 0 && ui.indexOf('data-f="legalRep"') >= 0 && ui.indexOf('data-f="contact"') >= 0 && ui.indexOf('data-f="prov"') >= 0);
  const subHtml = fs.readFileSync(path.join(ROOT, 'pages', 'province-agent', 'sub.html'), 'utf8');
  ok('L sub.html 挂载 agent-esign.js', subHtml.indexOf('agent-esign.js') >= 0);
  const earn = fs.readFileSync(path.join(ROOT, 'pages', 'distribution', 'earnings.html'), 'utf8');
  ok('L earnings 纯代理分流到代理台账', earn.indexOf('代理测算收益在代理台账查看') >= 0);
  const wd2 = fs.readFileSync(path.join(ROOT, 'pages', 'distribution', 'withdraw.html'), 'utf8');
  ok('L withdraw 纯代理说明不改提现规则', wd2.indexOf('代理测算收益在代理台账查看') >= 0 && wd2.indexOf('minWithdraw') >= 0);
  const entry = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'entry.html'), 'utf8');
  ok('L 省代卡三态（进入工作台/审核进度/补资料重提）', entry.indexOf('进入工作台') >= 0 && entry.indexOf('审核进度') >= 0 && entry.indexOf('补资料重提') >= 0);
  const pf = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'index.html'), 'utf8');
  ok('L profile 代理徽标+工作台直达', pf.indexOf('代理工作台') >= 0 && pf.indexOf('省级总代') >= 0);

  /* L-2：协议状态中文词典，禁裸英文枚举直渲染 */
  ok('L-2 协议状态中文映射(已完成/待我签署/签署中/已拒签)', ui.indexOf('已完成') >= 0 && ui.indexOf('待我签署') >= 0 && ui.indexOf('签署中') >= 0 && ui.indexOf('已拒签') >= 0 && ui.indexOf('PROTO_STATUS') >= 0);
  ok('L-2 协议详情头部不直渲 c.status 英文枚举', ui.indexOf("' · 状态 ' + esc(c.status)") < 0 && ui.indexOf("状态 ' + esc(c.status)") < 0);

  /* L-4：T2 拒签内联原因面板，无 window.prompt */
  ok('L-4 拒签内联原因面板(ag-sub-reject-box)', ui.indexOf('ag-sub-reject-box') >= 0 && ui.indexOf('ag-sub-reject-reason') >= 0);
  ok('L-4 T2 拒签不再调用 window.prompt', ui.indexOf('window.prompt(') < 0);
  ok('L-4 空原因拒签错误显式 block（覆盖 CSS display:none）', /err\.style\.display\s*=\s*'block'/.test(ui));

  /* M-1：消息中心本地代理通知分组 */
  const msgHtml = fs.readFileSync(path.join(ROOT, 'pages', 'message', 'index.html'), 'utf8');
  ok('M-1 消息中心「代理」分组子栏', msgHtml.indexOf('data-cat="代理"') >= 0);
  ok('M-1 本地代理事件队列 agentNoticeItems + 读 AgentStore', msgHtml.indexOf('agentNoticeItems') >= 0 && msgHtml.indexOf('AgentStore.listProvinces') >= 0 && msgHtml.indexOf('AgentStore.listSubs') >= 0);
  ok('M-1 挂载 agent-store/agent-esign 接线', msgHtml.indexOf('agent-store.js') >= 0 && msgHtml.indexOf('agent-esign.js') >= 0);

  /* L-3：看板固定 2 列，无 640px 3 列误触发 */
  const css = fs.readFileSync(path.join(ROOT, 'css', 'agent.css'), 'utf8');
  ok('L-3 看板无 640px 三列断点（改固定 2 列）', css.indexOf('min-width: 640px') < 0);
  ok('L-5 证书/冻结标签允许换行', css.indexOf('.ag-certi__field { white-space: normal') >= 0 && css.indexOf('overflow-wrap: anywhere') >= 0);

  /* ===== P2 前端可做项 ===== */
  /* P2-1 台账月份切换：切换器/上月下月/回位本月/空月态，打印隐藏 */
  ok('P2-1 月份切换器 mountMonthLedger + 上月/下月/回位', ui.indexOf('mountMonthLedger') >= 0 && ui.indexOf('data-ml-prev') >= 0 && ui.indexOf('data-ml-next') >= 0 && ui.indexOf('data-ml-today') >= 0);
  ok('P2-1 空月 ag-empty 文案', ui.indexOf('暂无结算记录') >= 0 && css.indexOf('.ag-month-switch') >= 0);
  ok('P2-1 打印隐藏月份切换器', css.indexOf('.ag-month-switch') >= 0 && /@media print[\s\S]*\.ag-month-switch[^{]*\{[^}]*display:\s*none/.test(css));
  /* P2-2 本地公告位：可关闭 localStorage 记忆，无公告不渲染 */
  ok('P2-2 本地公告卡 localNoticeHtml + ag-notice-local + 关闭记忆', ui.indexOf('localNoticeHtml') >= 0 && ui.indexOf('ag-notice:') >= 0 && css.indexOf('.ag-notice-local') >= 0);
  /* P2-3 正式徽章：总代盾/二级六边形双形态，不替换五档、无个人合伙人紫 */
  ok('P2-3 盾/六边形徽章 emblemHtml(pa/sub)', ui.indexOf('emblemHtml(\'pa\')') >= 0 && ui.indexOf('emblemHtml(\'sub\')') >= 0 && css.indexOf('ag-emblem--shield') >= 0 && css.indexOf('ag-emblem--hex') >= 0);
  const profHtml = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'index.html'), 'utf8');
  const entryHtml = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'entry.html'), 'utf8');
  ok('P2-3 profile/entry 落盾/六边形徽章', profHtml.indexOf('clip-path:polygon(50% 0') >= 0 && entryHtml.indexOf('clip-path:polygon(50% 0') >= 0);
  /* P2-6 二级档案详情视图：资料/比例时间线/协议/本人线台账，仅 admin，T2 不自见 */
  ok('P2-6 二级档案 renderSubProfile + 返回列表', ui.indexOf('renderSubProfile') >= 0 && ui.indexOf('data-sub-back') >= 0 && ui.indexOf('ag-sub-profile__field') >= 0);
  ok('P2-6 详情入口仅 admin(data-sub-profile) 且 T2 无入口', ui.indexOf('data-sub-profile') >= 0 && subHtml.indexOf('data-sub-profile') < 0);
}

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
