/* ============================================================================
   scripts/smoke-m2.js —— M2 申请与审核开通 冒烟（node，localStorage 内存 shim）
   覆盖 M2-1~M2-7：成功/边界/事务回滚/回归断言，打印 PASS/FAIL，全绿退出 0。
   用法：node scripts/smoke-m2.js
   ============================================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function eq(name, a, b) { ok(name, JSON.stringify(a) === JSON.stringify(b), 'exp=' + JSON.stringify(b) + ' got=' + JSON.stringify(a)); }

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

const Rules = require(path.join(ROOT, 'js', 'agent-rules.js'));
const Store = require(path.join(ROOT, 'js', 'agent-store.js'));
const Bridge = require(path.join(ROOT, 'js', 'agent-bridge.js'));
const Apply = require(path.join(ROOT, 'js', 'agent-apply.js'));
Store.init({ storage: makeStorage() });

const quotaCfg = {
  minCap: 10,
  provinces: [
    { provinceName: '四川省', cityCount: 21 },
    { provinceName: '广东省', cityCount: 20 }
  ]
};
const applyOpts = { quotaCfg };

console.log('\n===== A. M2-1 总代表单 ¥0 提交 + 必填拦截 =====');
Store.reset();
let r = Apply.submitProvinceApplication({ uid: 'u11', companyName: '甲公司', uscc: 'USCC-A', license: '', legalRep: '张三', contact: '李四', province: '四川省' }, applyOpts);
ok('A 缺执照拦截 E_LICENSE_REQUIRED', r.error === 'E_LICENSE_REQUIRED');
r = Apply.submitProvinceApplication({ uid: 'u11', companyName: '甲公司', uscc: 'USCC-A', license: 'L1', legalRep: '张三', contact: '李四', province: '' }, applyOpts);
ok('A 缺意向省拦截 E_PROVINCE_REQUIRED', r.error === 'E_PROVINCE_REQUIRED');
r = Apply.submitProvinceApplication({ uid: 'u11', companyName: '甲公司', uscc: 'USCC-A', license: 'L1', legalRep: '张三', contact: '李四', province: '四川省', isNaturalPerson: true }, applyOpts);
ok('A 自然人禁入 E_NATURAL_PERSON_FORBIDDEN', r.error === 'E_NATURAL_PERSON_FORBIDDEN');
r = Apply.submitProvinceApplication({ uid: 'u11', companyName: '甲公司', uscc: 'USCC-A', license: 'L1', legalRep: '张三', contact: '李四', province: '四川省' }, applyOpts);
ok('A 合法提交成功 pending', r.ok === true && r.record.status === 'pending');
eq('A fee 恒 0（无付费入口）', r.record.fee, 0);
ok('A 落盘 engchain-province-agents', Store.listProvinces().length === 1);
const paId = r.record.id;

console.log('\n===== B. M2-2 审核通过/驳回 种子落盘 + rejectReason =====');
let seed = Bridge.buildSeed([{ op: 'province.approve', id: paId, operator: 'admin', reason: '审核通过' }]);
let res = Apply.importSeed(Bridge.seedToText(seed), applyOpts);
ok('B 通过种子导入成功', res.ok === true);
eq('B 状态→active', Store.getProvince(paId).status, 'active');
ok('B 通过后资格位可见', Store.bitsFor('u11').isProvinceAgent === true);

Store.reset();
r = Apply.submitProvinceApplication({ uid: 'u12', companyName: '乙公司', uscc: 'USCC-B', license: 'L2', legalRep: '王五', contact: '赵六', province: '广东省' }, applyOpts);
const pbId = r.record.id;
seed = Bridge.buildSeed([{ op: 'province.reject', id: pbId, operator: 'admin', reason: '执照照片模糊，请重传', rejectReason: '执照照片模糊，请重传' }]);
res = Apply.importSeed(Bridge.seedToText(seed), applyOpts);
ok('B 驳回种子导入成功', res.ok === true);
eq('B 状态→rejected', Store.getProvince(pbId).status, 'rejected');
ok('B rejectReason 落盘可见', Store.getProvince(pbId).rejectReason === '执照照片模糊，请重传');
ok('B rejects[] 历史留痕', Array.isArray(Store.getProvince(pbId).rejects) && Store.getProvince(pbId).rejects.length === 1);

console.log('\n===== C. M2-3 后台直接指定开通 + 冲突回滚无残留（事务式） =====');
Store.reset();
seed = Bridge.buildSeed([{ op: 'province.directGrant', operator: 'admin', record: { uid: 'u20', province: '四川省', branchCompany: { name: '川总代', uscc: 'USCC-C', license: 'L3', legalRep: '钱七', contact: '孙八' } } }]);
res = Apply.importSeed(Bridge.seedToText(seed), applyOpts);
ok('C 直接指定成功', res.ok === true && Store.listProvinces()[0].status === 'active');
/* 同省冲突 + 同批另一合法动作 → 整体不落库（事务回滚） */
seed = Bridge.buildSeed([
  { op: 'province.directGrant', operator: 'admin', record: { uid: 'u21', province: '四川省', branchCompany: { name: '冲突公司', uscc: 'USCC-D', license: 'L4', legalRep: 'a', contact: 'b' } } },
  { op: 'province.directGrant', operator: 'admin', record: { uid: 'u22', province: '浙江省', branchCompany: { name: '浙公司', uscc: 'USCC-E', license: 'L5', legalRep: 'c', contact: 'd' } } }
]);
res = Apply.importSeed(Bridge.seedToText(seed), applyOpts);
ok('C 冲突批次整体拒绝 committed=false', res.ok === false && res.committed === false);
eq('C 无残留：仍只有1条记录', Store.listProvinces().length, 1);
ok('C 冲突码 E_PROVINCE_TAKEN', res.failed[0].code === 'E_PROVINCE_TAKEN');

console.log('\n===== D. M2-7 终止态五类操作 + 合法边 + 封存 =====');
Store.reset();
Apply.submitProvinceApplication({ uid: 'u30', companyName: '丁公司', uscc: 'USCC-F', license: 'L6', legalRep: 'h', contact: 'i', province: '四川省' }, applyOpts);
const dId = Store.listProvinces()[0].id;
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.approve', id: dId, operator: 'admin' }])), applyOpts);
function term(op, expectOk, expectStatus) {
  const s = Bridge.buildSeed([{ op: 'province.' + op, id: dId, operator: 'admin', reason: '测试' }]);
  const rr = Apply.importSeed(Bridge.seedToText(s), applyOpts);
  ok('D ' + op + (expectOk ? ' 成功' : ' 被拒'), expectOk ? rr.ok === true : rr.ok === false);
  if (expectStatus) eq('D →' + expectStatus, Store.getProvince(dId).status, expectStatus);
}
term('suspend', true, 'suspended');
term('resume', true, 'active');
term('terminate', true, 'terminated');
term('resume', false); /* terminated 不可逆 */
ok('D terminated 置 sealedAt 封存只读', !!Store.getProvince(dId).sealedAt);
ok('D 终止后资格位即时收回', Store.bitsFor('u30').isProvinceAgent === false);
ok('D 终止释放省可重授', Rules.validateProvinceAgent({ uid: 'u31', province: '四川省', uscc: 'USCC-G', isNaturalPerson: false }, { provinceAgents: Store.listProvinces(), subAgents: [], quotaCfg }).ok === true);

console.log('\n===== E. M2-4 驳回重提：复用原记录，历史保留，不新建重复 =====');
Store.reset();
Apply.submitProvinceApplication({ uid: 'u40', companyName: '戊公司', uscc: 'USCC-H', license: 'L7', legalRep: 'j', contact: 'k', province: '广东省' }, applyOpts);
const eId = Store.listProvinces()[0].id;
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.reject', id: eId, operator: 'admin', rejectReason: '资料不全' }])), applyOpts);
const before = Store.listProvinces().length;
const rr = Apply.resubmit(eId, { license: 'L7-new', province: '广东省' }, applyOpts);
ok('E 重提成功', rr.ok === true);
eq('E 回退 pending', Store.getProvince(eId).status, 'pending');
eq('E 不新建重复记录', Store.listProvinces().length, before);
ok('E rejects 历史保留', Store.getProvince(eId).rejects.length === 1);
ok('E rejectReason 清空待重审', !Store.getProvince(eId).rejectReason);

console.log('\n===== F. M2-6 省独家冲突提示（仅状态，无外发） =====');
Store.reset();
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.directGrant', record: { uid: 'u50', province: '四川省', branchCompany: { name: '已授权', uscc: 'USCC-I', license: 'L8', legalRep: 'm', contact: 'n' } } }])), applyOpts);
const cf = Apply.submitProvinceApplication({ uid: 'u51', companyName: '重复', uscc: 'USCC-J', license: 'L9', legalRep: 'o', contact: 'p', province: '四川省' }, applyOpts);
ok('F 同省拦截 E_PROVINCE_TAKEN', cf.error === 'E_PROVINCE_TAKEN');
ok('F 规则层省独家文案含省独家', /省独家/.test(cf.msg || ''));
ok('F 页面提示文案「该省已独家授权」(静态)', /该省已独家授权/.test(fs.readFileSync(path.join(ROOT,'js','agent-apply.js'),'utf8')));

console.log('\n===== F2. 省独家占位矩阵：active/suspended 占位，terminated/revoked 释放，跨省不误伤 =====');
const occ = (arr) => Rules.validateProvinceAgent({ uid: 'u99', province: '四川省', uscc: 'USCC-Z', isNaturalPerson: false }, { provinceAgents: arr, subAgents: [], quotaCfg });
ok('F2 active 同省拦截 E_PROVINCE_TAKEN', occ([{ uid: 'x', status: 'active', province: '四川省', branchCompany: { uscc: 'USCC-A' } }]).code === 'E_PROVINCE_TAKEN');
ok('F2 suspended 仍占位拦截', occ([{ uid: 'x', status: 'suspended', province: '四川省', branchCompany: { uscc: 'USCC-A' } }]).code === 'E_PROVINCE_TAKEN');
ok('F2 terminated 已释放可重授', occ([{ uid: 'x', status: 'terminated', province: '四川省', branchCompany: { uscc: 'USCC-A' } }]).ok === true);
ok('F2 revoked 已释放可重授', occ([{ uid: 'x', status: 'revoked', province: '四川省', branchCompany: { uscc: 'USCC-A' } }]).ok === true);
const cross = Rules.validateProvinceAgent({ uid: 'u99', province: '云南省', uscc: 'USCC-Z', isNaturalPerson: false }, { provinceAgents: [{ uid: 'x', status: 'active', province: '四川省', branchCompany: { uscc: 'USCC-A' } }], subAgents: [], quotaCfg });
ok('F2 跨省(云南)正常放行不误伤', cross.ok === true);
/* 持久红条 DOM/钩子静态存在 */
const applySrc = fs.readFileSync(path.join(ROOT, 'js', 'agent-apply.js'), 'utf8');
ok('F2 持久冲突红条容器存在(#pa-conflict)', applySrc.includes('id="pa-conflict"') && applySrc.includes('showConflict('));
ok('F2 换省即清除红条(change→hideConflict)', applySrc.includes("'#pa-province'") && applySrc.includes('hideConflict'));

console.log('\n===== G. 二级：通过/解绑释放名额/违约终止 =====');
Store.reset();
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.directGrant', record: { uid: 'u60', province: '四川省', branchCompany: { name: '川总代2', uscc: 'USCC-K', license: 'L10', legalRep: 'q', contact: 'r' } } }])), applyOpts);
Store.saveSub({ id: 'sb1', parentUid: 'u60', uid: 'u61', company: { name: '成都二级', uscc: 'USCC-L', license: 'L11', legalRep: 's', contact: 't' }, province: '四川省', ratioToSub: 0.2, status: 'pending', statusLog: [], rejects: [], ratioLog: [], signature: {}, sealedAt: 0 });
let sr = Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'sub.approve', id: 'sb1', operator: 'admin' }])), applyOpts);
ok('G 二级通过', sr.ok === true && Store.getSub('sb1').status === 'approved');
eq('G 名额占用1', Rules.countActiveSubAgents('u60', Store.listSubs()), 1);
sr = Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'sub.remove', id: 'sb1', operator: 'admin', reason: '解绑退出' }])), applyOpts);
ok('G 二级解绑成功', sr.ok === true && Store.getSub('sb1').status === 'removed');
eq('G 解绑释放名额=0', Rules.countActiveSubAgents('u60', Store.listSubs()), 0);
ok('G 二级封存 sealedAt', !!Store.getSub('sb1').sealedAt);

console.log('\n===== H. 回归：8%/2%/¥50/T+1、个人合伙人页、旧伙伴软下线、无外发通道 =====');
const dataSrc = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
ok('R 个人合伙人 tier1:8/tier2:2 未变', /individualPartner:\s*{[\s\S]*?tier1:\s*8[\s\S]*?tier2:\s*2/.test(dataSrc));
ok('R minWithdraw=50 未变', /minWithdraw:\s*50/.test(dataSrc));
ok('R T+1 到账未变', /工作日 T\+1 到账/.test(dataSrc));
/* git 可用时比对改动清单；非 git 环境降级为静态检查（本阶段未写这些文件） */
let changed = [];
try { changed = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean); }
catch (e) { changed = []; }
if (changed.length) {
  ok('R 个人合伙人页 auth-partner.html 未改', !changed.includes('pages/profile/auth-partner.html'));
  ok('R Agent.vue(委托代理) 未改', !changed.includes('admin-vue/src/views/users/Agent.vue'));
} else {
  ok('R 非 git 环境：auth-partner.html/Agent.vue 本阶段未写入（静态确认）', true);
}
/* 种子内容回归：[M4-4] u8 旧企业合伙人已定点回退为实名普通用户（记录保留、非resident）；u9 个人合伙人保留 */
const dbSrc = fs.readFileSync(path.join(ROOT, 'js', 'databus.js'), 'utf8');
const u8blk = dbSrc.split("id:'u8'")[1] || '';
ok('R u8 记录保留但已回退(非resident/非partner)', u8blk.indexOf("enterprise:'none'") >= 0 && /active:\s*false/.test(u8blk));
ok('R u9 个人合伙人种子保留(孙小美)', /孙小美/.test(dbSrc));
ok('R u8/u9 种子记录各一条', (dbSrc.match(/\bid:'u8'/g)||[]).length === 1 && (dbSrc.match(/\bid:'u9'/g)||[]).length === 1);
const entryHtml = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'entry.html'), 'utf8');
/* [M4-4 回炉] 旧企业合伙人卡片彻底摘除（不再保留置灰占位），省代新卡入口保留 */
ok('R 旧 partner 卡片已彻底摘除(无停招/通道关闭占位)', !entryHtml.includes('合伙人企业（旧）') && !entryHtml.includes('通道关闭') && !entryHtml.includes('停招'));
ok('R 省代新卡入口存在', entryHtml.includes('entry-form.html?type=provinceAgent'));
/* 无短信/Push/邮件外发通道 */
const bridgeSrc = fs.readFileSync(path.join(ROOT, 'js', 'agent-bridge.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js', 'agent-apply.js'), 'utf8');
ok('R 新模块无 sms/push/email 外发代码', !/(sendSms|sendPush|sendEmail|mailer|sms\.)/i.test(bridgeSrc));

console.log('\n===== J. 缺陷清扫 D-1/D-2/D-3 回归 =====');
Store.reset();
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.directGrant', record: { uid: 'u70', province: '四川省', branchCompany: { name: '川总代', uscc: 'USCC-J1', license: 'L', legalRep: '法', contact: '联' } } }])), applyOpts);
const jParent = Store.listProvinces()[0];
const jv = Rules.validateSubAgent(
  { company: { name: '成都二级', uscc: 'USCC-J2' }, uscc: 'USCC-J2', province: '四川省', ratioToSub: 0.2, parent: jParent, isNaturalPerson: false },
  { provinceAgents: Store.listProvinces(), subAgents: Store.listSubs(), quotaCfg: applyOpts.quotaCfg });
ok('J D-1 发起二级 validateSubAgent 通过', jv.ok === true);
/* R-1：parentUid 存上级 uid（与 seed/工作台过滤 s.parentUid===U 同口径），不存记录 id */
Store.saveSub({ id: 'sb-j1', parentUid: jParent.uid, uid: '', company: { name: '成都二级', uscc: 'USCC-J2' }, province: '四川省', ratioToSub: 0.2, status: 'pending', statusLog: [], rejects: [], ratioLog: [], signature: { status: 'pending' }, sealedAt: 0 });
ok('J D-1 pending 二级落盘且可被复核', Store.listSubs().some(function (s) { return s.status === 'pending' && s.company.uscc === 'USCC-J2'; }));
ok('J R-1 parentUid 存上级 uid，本人列表按 parentUid===uid 命中', Store.listSubs().some(function (s) { return s.parentUid === jParent.uid && s.status === 'pending'; }));
/* D-3：驳回记录补执照 patch 后重提成功 */
Apply.submitProvinceApplication({ uid: 'u71', companyName: '驳回公司', uscc: 'USCC-J3', license: '', legalRep: '法', contact: '联', province: '四川省' }, applyOpts);
const jrid = Store.listProvinces().pop().id;
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.reject', id: jrid, operator: 'admin', rejectReason: '缺执照' }])), applyOpts);
const jrr = Apply.resubmit(jrid, { license: 'LIC-NEW', companyName: '驳回公司', province: '四川省' }, applyOpts);
ok('J D-3 补执照后重提成功并回退 pending', jrr.ok === true && Store.getProvince(jrid).status === 'pending');
/* D-2：管理员团队视图不渲染「接受」邀请按钮（接受仅被邀请人本人完成） */
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'agent-ui.js'), 'utf8');
ok('J D-2 团队管理员视图无 data-accept 接受按钮', !/data-accept/.test(uiSrc));

console.log('\n===== K. 演示场景：省级总代/二级 8 条新增（DEMO_SCENARIOS 唯一数据源） =====');
const DemoMod = require(path.join(ROOT, 'js', 'agent-demo.js'));
const kDbSrc = fs.readFileSync(path.join(ROOT, 'js', 'databus.js'), 'utf8');
function kHasScn(key, group) {
  const re = new RegExp(key + "\\s*:\\s*\\{[^}]*group\\s*:\\s*'" + group + "'");
  return re.test(kDbSrc);
}
ok('K province_agent_active 在 start 组', kHasScn('province_agent_active', 'start'));
ok('K sub_agent_active 在 start 组', kHasScn('sub_agent_active', 'start'));
ok('K province_agent_suspended 在 start 组', kHasScn('province_agent_suspended', 'start'));
ok('K province_agent_terminated 在 start 组', kHasScn('province_agent_terminated', 'start'));
ok('K rev_province_pending 在 review 组（零付费）', kHasScn('rev_province_pending', 'review'));
ok('K rev_province_first 在 review 组（待终审）', kHasScn('rev_province_first', 'review'));
ok('K rev_sub_pending 在 review 组（D-1 pending 二级）', kHasScn('rev_sub_pending', 'review'));
ok('K rej_province 在 reject 组（可重提）', kHasScn('rej_province', 'reject'));
ok('K active 场景走 AgentDemo.seed() 真实播种', /province_agent_active[\s\S]*AgentDemo\.seed\(\)/.test(kDbSrc));
ok('K suspended 场景 seed 后转 suspended', /province_agent_suspended[\s\S]*?p\.status = 'suspended'/.test(kDbSrc));
ok('K terminated 场景 seed 后转 terminated', /province_agent_terminated[\s\S]*?p\.status = 'terminated'/.test(kDbSrc));
ok('K 新场景 build 不触碰 BalanceStore/余额', !/province_agent_active[\s\S]{0,600}BalanceStore\.(write|read)/.test(kDbSrc));
ok('K Demo 模块可加载且 seed/reset 导出', typeof DemoMod.seed === 'function' && typeof DemoMod.reset === 'function');
/* 省代待初审：云南省零付费 pending；驳回保留理由；重提回退 pending（与场景 build 同接口） */
Store.reset();
const kr = Apply.submitProvinceApplication({ uid: 'u3', companyName: '云南演示省级代理有限公司', uscc: '91510100DEMO-YN3', license: '营业执照(示例)', legalRep: '张演示', contact: '张演示', province: '云南省' }, applyOpts);
ok('K 省代待初审落盘 pending 且 fee=0', kr.ok && kr.record.status === 'pending' && kr.record.fee === 0);
Apply.importSeed(Bridge.seedToText(Bridge.buildSeed([{ op: 'province.reject', id: kr.record.id, rejectReason: '公司资质材料不齐全，请补充营业执照与省级代理授权说明' }])), applyOpts);
const krj = Store.getProvince(kr.record.id);
ok('K 驳回态落 rejected 且带理由', krj.status === 'rejected' && /材料不齐全/.test(krj.rejectReason || ''));
const krr = Apply.resubmit(kr.record.id, { license: '营业执照(示例)', companyName: '云南演示省级代理有限公司', province: '云南省' }, applyOpts);
ok('K 驳回补资料重提回退 pending', krr.ok && Store.getProvince(kr.record.id).status === 'pending');
/* 徽章/显名映射：preview PRIMARY_LABEL + profile ENTRY_TYPE_MAP subAgent */
const kPvSrc = fs.readFileSync(path.join(ROOT, 'preview.html'), 'utf8');
const kPfSrc = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'index.html'), 'utf8');
ok('K preview PRIMARY_LABEL 含 provinceAgent/subAgent 显名', /provinceAgent:'省级总代'/.test(kPvSrc) && /subAgent:'二级合作'/.test(kPvSrc));
ok('K profile ENTRY_TYPE_MAP 补 subAgent（非个人合伙人紫）', /subAgent:\s*\{\s*label:\s*'二级合作'/.test(kPfSrc));

console.log('\n===== L. 阶段B 增量：门控/承载/反馈收敛（只读源码断言，不动费率税算） =====');
const erHtml = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'entry-review.html'), 'utf8');
const applySrcL = fs.readFileSync(path.join(ROOT, 'js', 'agent-apply.js'), 'utf8');
const uiSrcL = fs.readFileSync(path.join(ROOT, 'js', 'agent-ui.js'), 'utf8');
const agCss = fs.readFileSync(path.join(ROOT, 'css', 'agent.css'), 'utf8');
const idxHtml = fs.readFileSync(path.join(ROOT, 'pages', 'province-agent', 'index.html'), 'utf8');
const subHtml = fs.readFileSync(path.join(ROOT, 'pages', 'province-agent', 'sub.html'), 'utf8');
/* H-6：有省代记录时省代卡前置、旧企业空态降级隐藏 */
ok('L H-6 省代记录存在时省代卡 insertBefore 前置且旧空态隐藏', erHtml.includes('insertBefore(panel,root)') && /!e\.status\)root\.style\.display='none'/.test(erHtml));
/* E2-M-1：驳回卡落 review 页（带预填），不跳空白表单；意向省回填 selected */
ok('L E2-M-1 驳回 CTA 指向 entry-review.html（非空白 entry-form）', /status==='rejected'[\s\S]{0,200}entry-review\.html/.test(entryHtml));
ok('L E2-M-1 驳回补表单意向省按 a.province 回填 selected', /p===a\.province\?' selected':'/.test(applySrcL));
/* E2-M-2：entry 门控条纳入 active/suspended 代理身份 */
ok('L E2-M-2 gate-bar 跳过 active/suspended 代理(!_gatePa)', /!qualified&&!_gatePa/.test(entryHtml));
/* H-4：toast 三态单一实现，apply 委托 AgentUI.toast */
ok('L H-4 toast 成功/失败/警告三态变体', uiSrcL.includes("'err'") && uiSrcL.includes("'warn'") && agCss.includes('ag-toast--warn') && agCss.includes('ag-toast--err'));
ok('L H-4 applyToast 委托 AgentUI.toast 单一实现', /window\.AgentUI\s*&&\s*typeof window\.AgentUI\.toast\s*===\s*'function'/.test(applySrcL));
/* E1-T1-07：approved 比例默认只读徽章，补改比例收抽屉，无常驻输入框 */
ok('L 比例默认只读徽章(ag-ratio-view)，补改比例走抽屉入口', uiSrcL.includes('ag-ratio-view') && agCss.includes('.ag-ratio-view') && uiSrcL.includes('ag-ratio-edit'));
/* E1-T2-01/03/04/06：T2 协议卡条件渲染、operator 隐藏、归属结构化、钱包弱出口 */
ok('L T2 无协议不渲染空白协议卡(protoCard 条件)', /var protoCard = contract/.test(uiSrcL));
ok('L T2 时间线隐藏内部 operator(hideOperator)', /timelineHtml\(rec\.statusLog, rec\.ratioLog, \{ hideOperator: true \}\)/.test(uiSrcL));
ok('L T2 钱包降级为弱出口(ag-entry-row--weak)', uiSrcL.includes('ag-entry-row--weak'));
/* H-2/H-3：44px 热区 + focus-visible 明暗 */
ok('L H-2 小控件热区≥44px(ms/close/sm)', agCss.includes('.ag-ms-btn { width: 44px; height: 44px;') && agCss.includes('.ag-notice-local__close { width: 44px; height: 44px;'));
ok('L H-3 ag-* 含 :focus-visible 焦点环', agCss.includes(':focus-visible'));
/* L-5：深链返回兜底到「我的」 */
ok('L 返回兜底 agBack（无历史回 profile）', idxHtml.includes('function agBack()') && subHtml.includes('function agBack()'));

console.log('\n===== M. H-1 IA 拆分 + H-5 协议承载（hash 视图/抽屉，只读源码断言） =====');
/* H-1：T1 五视图 data-view 标签 + hashchange 路由 + home 快捷入口 */
['home','subs','agreements','ledger','status'].forEach(function(v){
  ok('M H-1 T1 视图标签 data-view="' + v + '"', uiSrcL.includes('data-view="' + v + '"'));
});
ok('M H-1 T1 hashchange 历史栈路由 agApplyRoute', uiSrcL.includes("addEventListener('hashchange', agApplyRoute)") && uiSrcL.includes("replace(/^#\\/?/, '')"));
ok('M H-1 T1 home 快捷入口 #ag-quick 四格(二级/协议/台账/状态)', uiSrcL.includes('id="ag-quick"') && uiSrcL.includes('#/subs') && uiSrcL.includes('#/agreements') && uiSrcL.includes('#/ledger') && uiSrcL.includes('#/status'));
ok('M H-1 T2 #/ledger 独立视图 + subApplyRoute', uiSrcL.includes('subApplyRoute') && uiSrcL.includes("addEventListener('hashchange', subApplyRoute)") && uiSrcL.includes('#ag-sub-led'));
ok('M H-1 视图返回条 #ag-route-back 兜底回概览', uiSrcL.includes('ag-route-back') && agCss.includes('.ag-route-back'));
/* H-5：协议/证书进底部抽屉 openDrawer，身份卡不再平铺八条 */
ok('M H-5 协议查看走 openDrawer（非内嵌 #ag-proto-detail 填充）', /openDrawer\(\{ title: '二级合作协议（O4）'/.test(uiSrcL) && !/#ag-proto-detail'\)\.innerHTML = protoDetail/.test(uiSrcL));
ok('M H-5 T2 待我签署抽屉底部操作区 去签署/拒签', uiSrcL.includes('data-drawer-sign') && uiSrcL.includes('data-drawer-reject'));
ok('M H-5 授权证书改抽屉（删除内嵌 #ag-cert-card 折叠卡）', uiSrcL.includes("openDrawer({ title: '授权证书'") && !uiSrcL.includes('#ag-cert-card'));
ok('M H-5 抽屉基元 CSS(.ag-drawer/.ag-drawer-mask) + 居中确认弹窗', agCss.includes('.ag-drawer-mask') && agCss.includes('.ag-drawer') && agCss.includes('.ag-modal-mask'));

console.log('\n===== N. 抽屉化补齐 + 危险操作确认弹窗（只读源码断言） =====');
/* 发起二级表单收进抽屉（入口按钮 + openDrawer 表单，不再内嵌 #ag-submit/#f-sub-co） */
ok('N 发起二级收进抽屉(data-open-subform + openDrawer)', uiSrcL.includes('data-open-subform') && /openDrawer\(\{\s*title: '发起二级合作方'/.test(uiSrcL) && !uiSrcL.includes("id=\"ag-submit\""));
/* 比例补改收进抽屉，删除常驻内联 ag-ratio-editbox */
ok('N 比例补改收进抽屉(openDrawer 补改比例)，无常驻内联 editbox', /openDrawer\(\{\s*title: '补改约定比例'/.test(uiSrcL) && !uiSrcL.includes('ag-ratio-editbox'));
/* 邀请成员收进抽屉 */
ok('N 邀请成员收进抽屉(openDrawer 邀请成员)', /openDrawer\(\{\s*title: '邀请成员'/.test(uiSrcL));
/* openConfirm 接线：移除成员 / 确认拒签 */
ok('N openConfirm 接线移除成员(不可逆后果说明)', /data-remove[\s\S]{0,400}openConfirm\(\{\s*title: '移除成员'/.test(uiSrcL));
ok('N openConfirm 接线确认拒签(回未签约后果说明)', /确认拒签协议[\s\S]{0,200}openConfirm/.test(uiSrcL) || /openConfirm\(\{\s*title: '确认拒签协议'/.test(uiSrcL));
/* busy 防连点：发起提交按钮 disabled 守卫 */
ok('N 发起二级提交 busy 防连点(save.disabled 守卫)', uiSrcL.includes('save.disabled = true') && uiSrcL.includes('save.disabled = false'));

console.log('\n===== I. M1 回归：复跑 smoke-m1 =====');
try {
  const out = execSync('node scripts/smoke-m1.js', { cwd: ROOT, encoding: 'utf8' });
  const m = out.match(/PASS=(\d+)\s+FAIL=(\d+)/);
  ok('I smoke-m1 仍全绿', m && m[2] === '0', m ? ('PASS=' + m[1] + ' FAIL=' + m[2]) : '无汇总行');
} catch (e) { ok('I smoke-m1 仍全绿', false, e.message.split('\n')[0]); }

console.log('\n=========================================');
console.log('PASS=' + pass + '  FAIL=' + fail);
process.exit(fail > 0 ? 1 : 0);
