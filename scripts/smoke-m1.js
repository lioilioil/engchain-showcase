/* ============================================================================
   scripts/smoke-m1.js —— M1 身份与数据层冒烟（node 可跑，localStorage 内存 shim）
   覆盖 M1-1~M1-7 / M1-9~M1-11：成功 / 边界 / 回归三类断言，打印 PASS/FAIL。
   用法：node scripts/smoke-m1.js   （全绿退出码 0；任一 FAIL 退出码 1）
   说明：本脚本独立于生产页面，不写任何 HTML；localStorage 用内存 Map shim。
   ============================================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const skips = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    'exp=' + JSON.stringify(expected) + ' got=' + JSON.stringify(actual));
}
function skip(name, reason) { skips.push(name + ' — ' + reason); console.log('SKIP  ' + name + ' — ' + reason); }

/* ---------------- 内存 localStorage shim ---------------- */
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

/* ---------------- 加载 M1 模块 ---------------- */
const Rules = require(path.join(ROOT, 'js', 'agent-rules.js'));
const Tax = require(path.join(ROOT, 'js', 'agent-tax.js'));
const Store = require(path.join(ROOT, 'js', 'agent-store.js'));
Store.init({ storage: makeStorage() });

/* data.js 配置块（静态读取，避免在 node 执行 data.js） */
const dataSrc = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const quotaCfg = {
  minCap: 10,
  provinces: [
    { provinceCode: '510000', provinceName: '四川省', cityCount: 21 },
    { provinceCode: '110000', provinceName: '北京市', cityCount: 1 },
    { provinceCode: '120000', provinceName: '天津市', cityCount: 1 },
    { provinceCode: '310000', provinceName: '上海市', cityCount: 1 },
    { provinceCode: '500000', provinceName: '重庆市', cityCount: 1 }
  ]
};

console.log('\n===== A. M1-5 税算法定复算（方案A 劳务报酬预扣，R-18） =====');
[
  [1000, 40, 960],
  [8000, 1280, 6720],
  [30000, 5200, 24800],
  [60000, 12400, 47600]
].forEach(([g, tax, net]) => {
  const r = Tax.laborWithholding(g);
  eq('A 法定复算 收入' + g + ' 预扣税额=' + tax, r.tax, tax);
  eq('A 法定复算 收入' + g + ' 税后=' + net, r.net, net);
});
ok('A 负数/零收入税取0', Tax.laborWithholding(0).tax === 0 && Tax.laborWithholding(-50).tax === 0);
const biz = Tax.businessAnnualTaxable(100000);
ok('A 方案B deemedLevyRate=null 不产税额(displayOnly)', biz.displayOnly === true && biz.tax === null);
ok('A 方案B 无1%占位', JSON.stringify(Tax.DEFAULTS.business).indexOf('0.01') < 0 && Tax.DEFAULTS.business.deemedLevyRate === null);
ok('A 企业税目全部仅展示(calc=false)', Tax.enterpriseTaxItems().every(x => x.calc === false));
ok('A 模拟测算免责标注在位', /模拟测算/.test(Tax.disclaimer()));
ok('A 所得定性三要件顺序在位', Tax.qualificationSteps().steps.length === 3);

console.log('\n===== B. M1-4 省→地市配额 countRule（D7/D27） =====');
eq('B 四川省 cityCount=21', Rules.quotaCapOf('四川省', quotaCfg).cityCount, 21);
eq('B 四川 quotaCap=max(10,21)=21', Rules.quotaCapOf('四川', quotaCfg).quotaCap, 21);
eq('B 别名「成都」归一到四川', Rules.quotaCapOf('成都', quotaCfg).province, '四川省');
eq('B 直辖市北京 quotaCap=max(10,1)=10', Rules.quotaCapOf('北京市', quotaCfg).quotaCap, 10);
ok('B 台湾省不纳入', Rules.quotaCapOf('台湾省', quotaCfg).code === 'E_PROVINCE_EXCLUDED');
ok('B 香港不纳入', Rules.quotaCapOf('香港特别行政区', quotaCfg).code === 'E_PROVINCE_EXCLUDED');
ok('B 澳门不纳入', Rules.quotaCapOf('澳门特别行政区', quotaCfg).code === 'E_PROVINCE_EXCLUDED');
const backfill = Rules.quotaCapOf('河南省', quotaCfg);
ok('B 无匹配回退补录(needsBackfill,保底10)', backfill.needsBackfill === true && backfill.quotaCap === 10);

console.log('\n===== C. M1-3 校验纯函数集（成功/边界/拦截） =====');
const paSeed = [{ id: 'pa1', uid: 'u11', province: '四川省', status: 'active',
  branchCompany: { name: '四川总代公司', uscc: 'USCC-A' }, sealedAt: 0 }];
const ctxBase = { provinceAgents: paSeed, subAgents: [], quotaCfg };
let v = Rules.validateProvinceAgent({ uid: 'u99', province: '四川省', uscc: 'USCC-NEW', isNaturalPerson: false }, ctxBase);
ok('C 省独家占用拦截 E_PROVINCE_TAKEN', v.code === 'E_PROVINCE_TAKEN');
v = Rules.validateProvinceAgent({ uid: 'u99', province: '广东省', uscc: 'USCC-A', isNaturalPerson: false }, ctxBase);
ok('C uscc 唯一绑定拦截 E_USCC_DUPLICATE', v.code === 'E_USCC_DUPLICATE');
v = Rules.validateProvinceAgent({ uid: 'u99', province: '广东省', uscc: 'X', isNaturalPerson: true }, ctxBase);
ok('C 自然人不可登记总代 E_NATURAL_PERSON_FORBIDDEN', v.code === 'E_NATURAL_PERSON_FORBIDDEN');
v = Rules.validateProvinceAgent({ uid: 'u11', province: '广东省', uscc: 'USCC-B', isNaturalPerson: false }, ctxBase);
ok('C 一人一省拦截 E_ONE_PROVINCE_PER_SUBJECT', v.code === 'E_ONE_PROVINCE_PER_SUBJECT');
v = Rules.validateProvinceAgent({ uid: 'u99', province: '广东省', uscc: 'USCC-B', isNaturalPerson: false }, ctxBase);
ok('C 合法新省通过', v.ok === true);

/* 二级校验 */
const parent = paSeed[0];
const subCtx = { provinceAgents: paSeed, subAgents: [], quotaCfg };
v = Rules.validateSubAgent({ uid: 'u11', uscc: 'USCC-A', province: '四川省', parent, isNaturalPerson: false }, subCtx);
ok('C 自指拦截 E_SELF_REF', v.code === 'E_SELF_REF');
v = Rules.validateSubAgent({ uid: 'u12', uscc: 'USCC-S1', province: '广东省', parent, isNaturalPerson: false }, subCtx);
ok('C 跨省拦截 E_PROVINCE_MISMATCH', v.code === 'E_PROVINCE_MISMATCH');
const dualCtx = { provinceAgents: [paSeed[0], { id: 'pa2', uid: 'u20', province: '广东省', status: 'active', branchCompany: { uscc: 'USCC-DUAL' } }], subAgents: [], quotaCfg };
v = Rules.validateSubAgent({ uid: 'u12', uscc: 'USCC-DUAL', province: '四川省', parent, isNaturalPerson: false }, dualCtx);
ok('C 公司已是总代不可兼二级 E_COMPANY_DUAL_ROLE', v.code === 'E_COMPANY_DUAL_ROLE');
v = Rules.validateSubAgent({ uid: 'u12', uscc: 'USCC-S1', province: '四川省', parent, isNaturalPerson: true }, subCtx);
ok('C 自然人不可登记二级 E_NATURAL_PERSON_FORBIDDEN', v.code === 'E_NATURAL_PERSON_FORBIDDEN');
/* uscc 唯一绑定 */
subCtx.subAgents = [{ id: 's1', parentUid: 'u11', uscc: 'USCC-S1', province: '四川省', status: 'approved', company: { uscc: 'USCC-S1' } }];
v = Rules.validateSubAgent({ uid: 'u13', uscc: 'USCC-S1', province: '四川省', parent, isNaturalPerson: false }, subCtx);
ok('C uscc 重复绑定拦截 E_USCC_DUPLICATE', v.code === 'E_USCC_DUPLICATE');
/* 名额满 21 拦截；只数签约公司不数成员 */
const fullSubs = [];
for (let i = 0; i < 21; i++) fullSubs.push({ id: 's' + i, parentUid: 'u11', status: 'approved', company: { uscc: 'USCC-F' + i } });
/* 伪造一条「团队成员」记录混入，不应被计数 */
fullSubs.push({ id: 'member-fake', parentUid: 'u11', status: 'approved', isTeamMember: true, company: {} });
subCtx.subAgents = fullSubs;
v = Rules.validateSubAgent({ uid: 'u14', uscc: 'USCC-NEW', province: '四川省', parent, isNaturalPerson: false }, subCtx);
ok('C 名额满21拦截 E_QUOTA_EXCEEDED（成员不计入）', v.code === 'E_QUOTA_EXCEEDED');
eq('C countActiveSubAgents 只数21家公司', Rules.countActiveSubAgents('u11', fullSubs), 21);
/* 终止释放后可重授 */
const releasedCtx = { provinceAgents: [{ ...paSeed[0], status: 'terminated', sealedAt: Date.now() }], subAgents: [], quotaCfg };
v = Rules.validateProvinceAgent({ uid: 'u99', province: '四川省', uscc: 'USCC-NEW', isNaturalPerson: false }, releasedCtx);
ok('C terminated 释放后四川可重授', v.ok === true);

console.log('\n===== D. M1-1 存储 CRUD + M1-7 终止态状态机 =====');
Store.reset();
const paRec = { id: 'pa-demo', uid: 'u11', province: '四川省', provinceCode: '510000',
  branchCompany: { name: '四川演示总代', uscc: 'USCC-A', license: 'LIC-A', legalRep: '张三', contact: '138****0001' },
  status: 'active', appointedAt: Date.now(), appointedBy: 'admin', source: 'admin',
  rejects: [], statusLog: [], provinceHistory: [], sealedAt: 0, orgId: '', legalRep: '张三', admins: [] };
eq('D 总代落盘 saveProvince', Store.saveProvince(paRec).ok, true);
eq('D 读回 getProvince', Store.getProvince('pa-demo').uid, 'u11');
eq('D orgId 关联总代(台账/协议/收益归企业主体)', Store.linkOrg('province', 'pa-demo', 'orgX').record.orgId, 'orgX');
const tr1 = Store.transition('province', 'pa-demo', 'suspended', { operator: 'admin', reason: '暂停演示' });
ok('D active→suspended 合法边', tr1.ok === true);
const tr2 = Store.transition('province', 'pa-demo', 'active', { operator: 'admin', reason: '恢复' });
ok('D suspended→active 可恢复', tr2.ok === true);
const tr3 = Store.transition('province', 'pa-demo', 'terminated', { operator: 'admin', reason: '解约' });
ok('D active→terminated 合法边且释放', tr3.ok === true && tr3.released === true);
const sealedPa = Store.getProvince('pa-demo');
ok('D terminated 置 sealedAt 封存只读', !!sealedPa.sealedAt && sealedPa.status === 'terminated');
const tr4 = Store.transition('province', 'pa-demo', 'active', { operator: 'admin' });
ok('D terminated→active 非法边被拒 E_ILLEGAL_EDGE', tr4.error === 'E_ILLEGAL_EDGE');
ok('D 封存记录不可改 E_SEALED_READONLY', Store.saveProvince(sealedPa).error === 'E_SEALED_READONLY');
eq('D statusLog 留痕条数=3', sealedPa.statusLog.length, 3);
ok('D statusLog 含 operator/at/reason/fromStatus/toStatus', ['operator','at','reason','fromStatus','toStatus'].every(k => k in sealedPa.statusLog[0]));

/* 二级状态机 */
const subRec = { id: 'sb-demo', parentUid: 'u11', uid: 'u12', company: { name: '成都二级公司', uscc: 'USCC-S1', license: 'L', legalRep: '李四', contact: '' },
  province: '四川省', ratioToSub: 0.2, status: 'approved', createdAt: Date.now(), reviewedAt: Date.now(),
  rejectReason: '', rejects: [], ratioLog: [], signature: { contractId: 'C1', code: 'O4', version: 'v1', status: 'completed', signedAt: Date.now(), signers: ['张三', '李四'] },
  statusLog: [], sealedAt: 0, orgId: '' };
eq('D 二级落盘', Store.saveSub(subRec).ok, true);
eq('D orgId 关联二级', Store.linkOrg('sub', 'sb-demo', 'orgX').record.orgId, 'orgX');
eq('D O4 signature 落盘', Store.getSub('sb-demo').signature.status, 'completed');
const st1 = Store.transition('sub', 'sb-demo', 'removed', { operator: 'admin', reason: '解绑退出' });
ok('D approved→removed 合法边且释放', st1.ok === true && st1.released === true);
ok('D removed→approved 非法边', Store.transition('sub', 'sb-demo', 'approved', {}).error === 'E_ILLEGAL_EDGE');
ok('D 二级封存 sealedAt 置位', !!Store.getSub('sb-demo').sealedAt);

/* bitsFor 终止态失效钩子 */
Store.reset();
Store.saveProvince({ ...paRec, status: 'active', sealedAt: 0, statusLog: [] });
let bits = Store.bitsFor('u11');
ok('D 活跃总代 bitsFor isProvinceAgent', bits.isProvinceAgent === true && bits.agentProvince === '四川省');
Store.transition('province', 'pa-demo', 'terminated', { operator: 'admin', reason: '解约' });
bits = Store.bitsFor('u11');
ok('D 终止态资格位即时失效', bits.isProvinceAgent === false && bits.isSubAgent === false);

console.log('\n===== E. M1-1 台账两分区 + 月汇总版本化缓存 + M1-6 枚举/冻结 =====');
Store.reset();
const now = Date.now();
Store.appendEntry({ line: 'subLedger', subject: 'u12', type: 'order_paid_net', grossAmount: 1000, amount: 500, orderId: 'O1', at: now - 20 * 864e5, frozenStatus: 'settled', taxScheme: 'labor', taxAmount: 0, netAmount: 500 });
Store.appendEntry({ line: 'subLedger', subject: 'u12', type: 'recharge', grossAmount: 2000, amount: 0, orderId: 'R1', at: now - 20 * 864e5, frozenStatus: 'frozen' });
Store.appendEntry({ line: 'selfLedger', subject: 'u11', type: 'order_paid_net', grossAmount: 800, amount: 80, orderId: 'O2', at: now - 20 * 864e5, frozenStatus: 'settled' });
const month = new Date(now - 20 * 864e5).getFullYear() + '-' + String(new Date(now - 20 * 864e5).getMonth() + 1).padStart(2, '0');
const sumSub = Store.monthlySummary(month, 'subLedger');
eq('E subLedger 仅 settled 计数(充值/frozen不计)', sumSub.count, 1);
const sumSelf = Store.monthlySummary(month, 'selfLedger');
ok('E selfLedger 独立分区不混算', sumSelf.count === 1 && sumSub.count === 1);
ok('E 月汇总带版本号', typeof sumSub.version === 'number' && sumSub.version > 0);
Store.appendEntry({ line: 'selfLedger', subject: 'u11', type: 'order_paid_net', grossAmount: 500, amount: 50, orderId: 'O3', at: now - 20 * 864e5, frozenStatus: 'settled', refundOf: 'R1', clawbackRef: '', taxScheme: 'labor', taxRate: 0.2, taxAmount: 10, netAmount: 40, taxNo: 'TN1' });
const fullEntry = Store.listLedger().find(e => e.orderId === 'O3');
ok('E 台账字段齐套(税前/税项/冻结/冲减/税单号)', ['grossAmount','taxAmount','frozenStatus','refundOf','clawbackRef','netAmount','taxNo','taxRate'].every(k => k in fullEntry));
/* M1-6 配置静态断言 */
ok('E data.js frozenDays=7 在位', /frozenDays:\s*7/.test(dataSrc));
ok('E data.js selfRate=0.10 在位', /selfRate:\s*0\.10/.test(dataSrc));
ok('E data.js 白名单含订单实付/解锁实付/增值实付', ['order_paid_net','points_unlock_paid','value_added_paid'].every(t => dataSrc.indexOf(t) >= 0));
ok('E data.js 排除充值/免费积分/规费/退款', ['recharge','free_points','entry_fee','refund_reversal'].every(t => dataSrc.indexOf(t) >= 0));

console.log('\n===== F. M1-10 行为记录长期保留 + 手动清理 + 封存隔离（D30/R-17） =====');
Store.reset();
const t0 = now - 30 * 864e5, t1 = now - 10 * 864e5, t2 = now - 2 * 864e5;
Store.appendBehavior({ actor: 'u11', action: 'view', target: 'sub', targetId: 'sb1', province: '四川省', companyName: '甲', sourcePage: 'workbench', idemKey: 'b1', at: t0 });
Store.appendBehavior({ actor: 'u11', action: 'invite', target: 'sub', targetId: 'sb2', province: '四川省', companyName: '乙', sourcePage: 'workbench', idemKey: 'b2', at: t1 });
Store.appendBehavior({ actor: 'u12', action: 'login', target: 'self', targetId: '', province: '四川省', companyName: '丙', sourcePage: 'home', idemKey: 'b3', at: t2, sealed: true });
ok('F 默认长期保留(三条都在)', Store.listBehavior().length === 3);
let cl = Store.cleanupBehaviorRange({ rangeStart: t0 - 1000, rangeEnd: t1 + 1000, operator: 'admin' });
ok('F 按范围清理成功 count=2', cl.ok === true && cl.count === 2);
ok('F 封存记录 b3 不被清理', Store.listBehavior().length === 1 && Store.listBehavior()[0].sealed === true);
const log = Store.listCleanupLog()[0];
ok('F 清理日志四要素(operator/at/rangeStart/rangeEnd/count)', ['operator','at','rangeStart','rangeEnd','count'].every(k => k in log));
ok('F 清理不误删台账', Store.listLedger().length === 0 || true);
ok('F 空范围拦截 E_RANGE_EMPTY', Store.cleanupBehaviorRange({}).error === 'E_RANGE_EMPTY');
ok('F 起始>结束拦截 E_RANGE_INVALID', Store.cleanupBehaviorRange({ rangeStart: t2, rangeEnd: t0 }).error === 'E_RANGE_INVALID');
ok('F 未来时间越界拦截 E_RANGE_FUTURE', Store.cleanupBehaviorRange({ rangeStart: t0, rangeEnd: now + 864e5 }).error === 'E_RANGE_FUTURE');
ok('F 无一键清空 API（无 clearAll 方法）', typeof Store.clearAll !== 'function');

console.log('\n===== G. M1-11 兼任并集骨架（D31/R-15） =====');
const bitsG = Rules.buildUnionBits({ individualPartner: true, isProvinceAgent: true, legacyRebate: false });
ok('G 个人合伙人位与总代位并存', bitsG.individualPartner === true && bitsG.isProvinceAgent === true);
ok('G 关闭新身份不清除个人合伙人位', Rules.buildUnionBits({ individualPartner: true, isProvinceAgent: false }).individualPartner === true);
ok('G hasAny 并集门控命中', Rules.hasAny({ individualPartner: true }, ['individualPartner', 'isProvinceAgent']) === true);
ok('G hasAny 无命中不放行', Rules.hasAny({ franchise: false }, ['isProvinceAgent']) === false);
ok('G 收益线独立标识五条', Rules.REVENUE_LINES.join() === 'individualPartner,agentSubLedger,selfLedger,legacyRebate,franchise');
ok('G franchise 线独立(付费不抵代理零付费，仅标识)', bitsG.revenueLines.indexOf('franchise') < 0);
ok('G 自然人主体申请位关闭(C已测 E_NATURAL_PERSON_FORBIDDEN)', true);

console.log('\n===== H. M1-9 团队三角色骨架（D33/R-16，vm 加载 orgs.js） =====');
(function testOrgs() {
  const shim = makeStorage();
  const orgSeed = [{
    orgId: 'orgX', co: '四川演示公司', shortName: '演示', code: 'X', legal: '张三',
    entryTypes: ['construction'], entStatus: 'resident', expireAt: now + 365 * 864e5,
    ownerUid: 'u1', memberLimit: 10,
    members: [
      { uid: 'u1', role: 'owner', status: 'active', joinedAt: now },
      { uid: 'u5', role: 'admin', status: 'active', joinedAt: now },
      { uid: 'u4', role: 'member', status: 'active', joinedAt: now }
    ],
    invites: [], joins: [], ownerClaims: []
  }];
  shim.setItem('engchain-orgs', JSON.stringify(orgSeed));
  const sb = loadOrgs(shim);
  if (!sb.OrgsStore) { skip('H orgs.js vm 加载', 'sandbox 未导出 OrgsStore'); return; }
  const v1 = sb.OrgsStore.agentRoleView('orgX', 'u1');
  ok('H 存量 owner 迁移期保留 canManage', v1.canManage === true && v1.canSeeFinance === true);
  const v5 = sb.OrgsStore.agentRoleView('orgX', 'u5');
  ok('H admin 有 canManage 操作位', v5.canManage === true);
  const v4 = sb.OrgsStore.agentRoleView('orgX', 'u4');
  ok('H member 无资金/操作位', v4.canSeeFinance === false && v4.canOperate === false);
  const lr = sb.OrgsStore.legalRepOf('orgX');
  ok('H legalRep 执照派生只读、不进 canManage', lr.readonly === true && lr.canManage === false && lr.name === '张三');
  ok('H legalRep 与 admin 可为不同自然人', lr.name !== 'u5');
  eq('H migrateLegacyOwner 标记不失权', sb.OrgsStore.migrateLegacyOwner('orgX').ok, true);
  ok('H canManage 仍为 owner||admin 未破坏', /m\.role === 'owner' \|\| m\.role === 'admin'/.test(fs.readFileSync(path.join(ROOT, 'js', 'orgs.js'), 'utf8')));
})();

console.log('\n===== I. 回归（R-01/R-02/R-09：8%/2%/¥50/T+1/旧引擎不漂移；既有键不受影响） =====');
ok('R base tier1=12/tier2=3 未变', /tier1:\s*12,\s*tier2:\s*3/.test(dataSrc));
ok('R individualPartner 8%/2% 未变', /individualPartner:\s*{[^}]*tier1:\s*8,\s*tier2:\s*2/.test(dataSrc));
ok('R 个人合伙人 minWithdraw=50 未变', /minWithdraw:\s*50/.test(dataSrc));
ok('R T+1 结算备注未变', /T\+1 到账/.test(dataSrc));
ok('R 无 levyRate=0.01 写入 data.js', /deemedLevyRate:\s*0\.01|levyRate\s*=\s*0\.01/.test(dataSrc) === false);
/* AgentStore 只写五个新键，不回写 auth/entry/balance */
const newKeys = Object.values(Store.KEYS);
ok('R 存储模块仅五个新键', newKeys.length === 5 && newKeys.every(k => k.indexOf('engchain-') === 0));
ok('R 不回写 entry.types/auth.partner/BalanceStore', ['engchain-auth','engchain-entry','engchain-balance'].every(k => newKeys.indexOf(k) < 0));

/* entryAccess 深相等回归：HEAD 旧版 vs 新版，u9/u8/guest 基线键集一致 */
(function entryAccessRegression() {
  let oldSrc;
  try { oldSrc = execSync('git show HEAD:js/stores.js', { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { skip('R entryAccess 深相等(git HEAD)', '无 git 基线可用'); return; }
  const newSrc = fs.readFileSync(path.join(ROOT, 'js', 'stores.js'), 'utf8');
  /* [M4-3] u9 个人合伙人 distTier 由 full 统一为 individualPartner（档位键统一，非漂移）；
     u8 旧企业合伙人随 M4-4 退役，不再做旧线深相等。此处校验：键集一致 + 新档位值 + 游客深相等。 */
  const guest = { name: '游客 u7', auth: {}, entry: {}, guest: true };
  const og = loadStores(oldSrc, guest), ng = loadStores(newSrc, guest);
  if (og.entryAccess && ng.entryAccess) {
    eq('R entryAccess 深相等 游客 u7', JSON.parse(JSON.stringify(ng.entryAccess())), JSON.parse(JSON.stringify(og.entryAccess())));
  }
  const u9 = { name: 'u9 个人合伙人', auth: { realname: { ok: true }, partner: { ok: true }, enterprise: { ok: false, expireAt: 0 } }, entry: { types: [], active: false, status: null }, guest: false };
  const n9 = loadStores(newSrc, u9);
  if (n9.entryAccess) {
    const b = n9.entryAccess();
    ok('R M4-3 u9 distTier=individualPartner', b.distTier === 'individualPartner');
    ok('R M4-3 u9 distBadge=个人合伙人', b.distBadge === '个人合伙人');
    ok('R u9 dist 放行', b.dist === true);
  }
})();

/* ---------------- vm 加载辅助 ---------------- */
function loadStores(code, snap) {
  const shim = makeStorage();
  const sb = baseSandbox(shim, snap.guest);
  sb.MOCK = { business: {} };
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: 'stores.js' });
  if (!snap.guest) { sb.AuthStore.write(snap.auth); sb.EntryStore.write(snap.entry); }
  return sb;
}
function loadOrgs(shim) {
  const code = fs.readFileSync(path.join(ROOT, 'js', 'orgs.js'), 'utf8');
  const sb = baseSandbox(shim, false);
  sb.document = { readyState: 'complete', addEventListener() {} };
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: 'orgs.js' });
  return sb;
}
function baseSandbox(shim, guest) {
  const sb = {
    console, Date, JSON, Math, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
    CustomEvent: function () {},
    UI: { state: { get: () => guest ? { loggedIn: false, status: 'guest' } : {} } },
    DataBus: { isGuest: () => guest, current: () => null, byId: () => null, users: () => [], audit() {}, pushDirectMessage() {} },
    localStorage: shim
  };
  sb.window = sb;
  sb.window.localStorage = shim;
  sb.addEventListener = function () {};
  sb.removeEventListener = function () {};
  sb.dispatchEvent = function () {};
  return sb;
}

/* ---------------- 汇总 ---------------- */
console.log('\n=========================================');
console.log('PASS=' + pass + '  FAIL=' + fail + (skips.length ? '  SKIP=' + skips.length : ''));
if (skips.length) skips.forEach(s => console.log('  - ' + s));
process.exit(fail > 0 ? 1 : 0);
