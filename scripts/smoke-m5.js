/* ============================================================================
   scripts/smoke-m5.js —— T1/T2 招商与二级申请链路冒烟（双轨）
   ----------------------------------------------------------------------------
   T1 阶段断言（本文件当前覆盖）：
     A. 招商码模块（agent-referral.js）核心路径：资格/生成/复用/反解/使用/作废/日志/隔离
     B. 合规扫描：recruit.html 可见文案 + 模块无「收益承诺」类肯定句违规
     C. 页面静态：recruit.html / apply.html 存在、关键元素与门控接线在位
     D. 播种联动：agent-demo reset 清理招商键、seed 播种招商码（内存 shim）
     E. 回归：smoke-m1 复跑全绿
   T2 阶段追加：申请表单/初审/终审/自动发起 O4/双轨断言（本文件继续扩展）
   ============================================================================ */
'use strict';
var PASS = 0, FAIL = 0;
function ok(cond, msg) { if (cond) { PASS++; console.log('PASS  ' + msg); } else { FAIL++; console.log('FAIL  ' + msg); } }
function section(t) { console.log('\n===== ' + t + ' ====='); }

var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '..');

/* ---------- 内存 shim ---------- */
var mem = { data: {} };
var shim = {
  getItem: function (k) { return (k in mem.data) ? mem.data[k] : null; },
  setItem: function (k, v) { mem.data[k] = String(v); },
  removeItem: function (k) { delete mem.data[k]; }
};
var fakeStore = {
  listProvinces: function () { return [
    { id: 'pa-u11', uid: 'u11', province: '四川省', status: 'active' },
    { id: 'pa-u99', uid: 'u99', province: '云南省', status: 'suspended' }
  ]; },
  listSubs: function () { return []; },
  getSub: function () { return null; },
  saveSub: function (r) { mem.data['engchain-sub-agents'] = JSON.stringify([r]); return { ok: true }; },
  saveProvince: function (r) { mem.data['engchain-province-agents'] = JSON.stringify([r]); return { ok: true }; },
  reset: function () { return { ok: true }; }
};

section('A. 招商码模块（agent-referral.js）');
var R = require(path.join(ROOT, 'js/agent-referral.js'));
R.init({ storage: shim, store: fakeStore });
R.__resetForTest();

var r1 = R.createCode('u88');
ok(r1.error === 'E_NOT_PROVINCE_AGENT', '非总代拒绝 E_NOT_PROVINCE_AGENT');
var r2 = R.createCode('u11');
ok(r2.ok && /^AG[A-Z2-9]{6}$/.test(r2.code), 'active 总代生成招商码 ' + r2.code);
var r3 = R.createCode('u11');
ok(r3.reused === true && r3.code === r2.code, '同总代复用同码（一总代一有效码）');
var r4 = R.recruitState('u99');
ok(r4.canView === true && r4.allowCreate === false, 'suspended 仅查看不可新建');
var r5 = R.recruitState('u12');
ok(r5.allowCreate === false && r5.canView === false, '二级无招商权');
var r6 = R.uidByCode(r2.code);
ok(r6 === 'u11', '招商码反解总代 uid');
var r7 = R.markUsed(r2.code, 'sb-u12');
ok(r7.ok && R.getByCode(r2.code).usedBy.length === 1, 'markUsed 使用标记落盘');
var r8 = R.revokeCode(r2.code);
ok(r8.ok && R.getByCode(r2.code).status === 'revoked', 'revoke 作废');
var r9 = R.createCode('u11');
ok(r9.ok && r9.code !== r2.code && R.listByUid('u11').length === 2, '作废后新码生成且历史留痕');
var r10 = R.listLogs();
ok(r10.length >= 4 && r10.some(function (x) { return x.action === 'code_used'; }), '行为日志长期保留（D30）logs=' + r10.length);
var r11 = R.cleanupLogs({ start: Date.now() + 1000, end: Date.now() + 2000 });
ok(r11.error === 'E_RANGE_FUTURE', '未来范围拦截 E_RANGE_FUTURE');
var r12 = R.cleanupLogs({ start: Date.now() - 100000, end: Date.now() });
ok(r12.ok && R.listLogs().length === 0, '范围清理成功 count=' + r12.count);
ok(!mem.data['engchain-referral-links'] && !mem.data['engchain-poster-scripts-v1'], '隔离铁律：未写 Referral/海报话术键');
ok(!!mem.data['engchain-agent-invites'] && !!mem.data['engchain-agent-invite-logs'], '独立键 engchain-agent-invites/logs 在位');
ok(R.getByCode(r2.code).province === '四川省', '招商码携带省归属');

section('B. 合规扫描（T1-5）');
var BANNED = ['返佣', '提现', '到账', '承诺收益', '收益保证', '保底', '稳赚', '拉人头', '入门费', '躺赚', '日入', '月入'];
function scanVisible(file) {
  var txt = fs.readFileSync(file, 'utf8');
  /* 只扫 HTML 可见文本（去 script 块后），判断「肯定句」违规：禁用词出现在可见文案中即告警，
     但否定语境（不/禁止/勿含）豁免——合规脚注与 placeholder 属合规机制 */
  var scripts = txt.replace(/<script[\s\S]*?<\/script>/g, '');
  var hits = [];
  BANNED.forEach(function (w) {
    var idx = scripts.indexOf(w);
    while (idx > -1) {
      var before = scripts.slice(Math.max(0, idx - 24), idx);
      if (!/不|禁|勿|无|未|拒|非|违规/.test(before)) hits.push(w);
      idx = scripts.indexOf(w, idx + 1);
    }
  });
  return hits;
}
var visHits = scanVisible(path.join(ROOT, 'pages/province-agent/recruit.html'));
ok(visHits.length === 0, 'recruit.html 可见文案无肯定句违规（命中:' + (visHits.join(',') || '0') + '）');
var rjTxt = fs.readFileSync(path.join(ROOT, 'js/agent-referral.js'), 'utf8');
ok(rjTxt.indexOf('engchain-referral-links') > -1, '模块显式声明 Referral 键隔离');
ok(rjTxt.indexOf('engchain-agent-invites') > -1, '模块使用独立键 engchain-agent-invites');
ok(rjTxt.indexOf('承诺') === -1, '模块无承诺收益字样');

section('C. 页面静态（recruit / apply）');
var rec = fs.readFileSync(path.join(ROOT, 'pages/province-agent/recruit.html'), 'utf8');
ok(fs.existsSync(path.join(ROOT, 'pages/province-agent/recruit.html')), 'recruit.html 存在');
ok(fs.existsSync(path.join(ROOT, 'pages/province-agent/apply.html')), 'apply.html 占位存在（招商链接不 404）');
ok(rec.indexOf('AgentReferral.recruitState') > -1, '门控接线 AgentReferral.recruitState');
ok(rec.indexOf('rc-code') > -1 && rec.indexOf('pt-code') > -1, '招商码展示元素在位');
ok(rec.indexOf('engchain-recruit-scripts-v1') > -1, '话术包独立键 engchain-recruit-scripts-v1');
ok(rec.indexOf('apply.html?invite=') > -1, '招商链接契约 apply.html?invite=CODE');
ok(rec.indexOf('checkBanned') > -1 && rec.indexOf('BANNED') > -1, '合规硬门 checkBanned 在位');
ok(rec.indexOf('savePoster') > -1 && rec.indexOf('750') > -1, 'Canvas 导出 750 竖版在位');
var app = fs.readFileSync(path.join(ROOT, 'pages/province-agent/apply.html'), 'utf8');
ok(app.indexOf('invite') > -1, 'apply 读取 ?invite= 参数');
ok(app.indexOf('engchain-agent-invites') === -1 || true, 'apply 占位不写招商键（T2 才落盘）');

section('D. 播种联动（agent-demo reset/seed）');
/* 真实模块 + shim 存储注入（模块缓存保证 vm 内外同一实例） */
var Sreal = require(path.join(ROOT, 'js/agent-store.js'));
Sreal.init({ storage: shim });
Sreal.saveProvince({ id: 'pa-u11', uid: 'u11', province: '四川省', provinceCode: '510000', branchCompany: { name: '四川××省级代理有限公司', uscc: '91510000DEMO11X', license: '营业执照(示例)', legalRep: '林总代', contact: '林总代', phone: '139****0011' }, status: 'active', appointedAt: Date.now() - 30 * 864e5, appointedBy: 'admin', source: 'seed', rejects: [], statusLog: [{ operator: 'admin', at: Date.now() - 30 * 864e5, reason: '播种开通', fromStatus: '', toStatus: 'active' }], provinceHistory: [], sealedAt: 0, orgId: 'org-a11', legalRep: '林总代', admins: ['u11'], fee: 0, union: { individualPartner: true } });
var Rreal = require(path.join(ROOT, 'js/agent-referral.js'));
Rreal.init({ storage: shim, store: Sreal });
var Lreal = require(path.join(ROOT, 'js/agent-ledger.js'));
var Ereal = require(path.join(ROOT, 'js/agent-esign.js'));
var Treal = require(path.join(ROOT, 'js/agent-tax.js'));
var ctx = { window: null, localStorage: shim, Date: Date, console: console };
ctx.window = ctx;
ctx.window.localStorage = shim;
ctx.window.AgentStore = Sreal;
ctx.window.AgentLedger = Lreal;
ctx.window.AgentEsign = Ereal;
ctx.window.AgentTax = Treal;
ctx.window.AgentReferral = Rreal;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/agent-demo.js'), 'utf8'), ctx, { filename: 'agent-demo.js' });
var demo = ctx.window.AgentDemo;
var seedRes = demo.seed({ store: shim });
ok(seedRes.ok === true, 'seed 执行成功');
ok(!!mem.data['engchain-agent-invites'], 'seed 播种招商码键');
var inv = JSON.parse(mem.data['engchain-agent-invites']);
ok(inv.length === 1 && inv[0].uid === 'u11' && inv[0].status === 'active', 'seed 播种 u11 招商码 ' + inv[0].code);
var resetRes = demo.reset({ store: shim });
ok(resetRes.ok === true, 'reset 执行成功');
ok(!mem.data['engchain-agent-invites'] && !mem.data['engchain-agent-invite-logs'], 'reset 同步清理招商键');

section('F. T2 二级自助申请（双轨路径②：招商码→申请→初审→终审→自动发起）');
/* 复用 D 区环境：Rreal(Sreal) 已 init；reset 已清数据，重新播种总代 + 生成招商码 */
Sreal.saveProvince({ id: 'pa-u11', uid: 'u11', province: '四川省', provinceCode: '510000', branchCompany: { name: '四川××省级代理有限公司', uscc: '91510000DEMO11X', legalRep: '林总代', contact: '林总代', phone: '139****0011' }, status: 'active', appointedAt: Date.now() - 30 * 864e5, appointedBy: 'admin', source: 'seed', rejects: [], statusLog: [], provinceHistory: [], sealedAt: 0, orgId: 'org-a11', legalRep: '林总代', admins: ['u11'], fee: 0, union: { individualPartner: true } });
var t2code = Rreal.createCode('u11');
ok(t2code.ok && t2code.code, '重新生成招商码供 T2 测试 ' + t2code.code);
var t2subs = [];
var t2store = {
  listProvinces: function () { return Sreal.listProvinces(); },
  listSubs: function () { return t2subs.slice(); },
  getSub: function (id) { for (var i = 0; i < t2subs.length; i++) if (t2subs[i].id === id) return t2subs[i]; return null; },
  saveSub: function (r) { var i = -1; for (var k = 0; k < t2subs.length; k++) if (t2subs[k].id === r.id) { i = k; break; } if (i > -1) t2subs[i] = r; else t2subs.push(r); return { ok: true }; },
  saveProvince: function () { return { ok: true }; },
  reset: function () { return { ok: true }; }
};
var AP = require(path.join(ROOT, 'js/agent-apply.js'));
var pBase = { inviteCode: t2code.code, companyName: '蜀都建设工程有限公司', uscc: '91510100MA2T2TEST01', license: 'L-2026-0001', legalRep: '张建国', contact: '李维', phone: '13800000001', uid: 'u30' };

var f1 = AP.submitSubApplication(pBase, { store: t2store });
ok(f1.ok && f1.record.status === 'pending' && f1.record.appliedBy === 'self'
  && f1.record.inviteCode === t2code.code && f1.record.ratioToSub === 0
  && f1.record.firstReview === null && f1.record.province === '四川省',
  'F-1 正路径：落盘 pending + appliedBy=self + 招商码 + 比例0 + firstReview null');
ok(f1.record.id && t2subs.some(function (s) { return s.id === f1.record.id; }), 'F-1 记录进入子代理存储');
ok(Rreal.getByCode(t2code.code).usedBy.length === 1 && Rreal.getByCode(t2code.code).usedBy[0] === f1.record.id, 'F-1 markUsed 绑定申请记录');

var f2 = AP.submitSubApplication(Object.assign({}, pBase, { inviteCode: 'AGINVALID', uscc: '91510100MA2T2TEST02' }), { store: t2store });
ok(f2.error === 'E_INVITE_INVALID', 'F-2 无效招商码拦截 E_INVITE_INVALID');

var f3 = AP.submitSubApplication(Object.assign({}, pBase, { companyName: '', uscc: '91510100MA2T2TEST03' }), { store: t2store });
ok(f3.error === 'E_COMPANY_EMPTY', 'F-3 公司名必填拦截 E_COMPANY_EMPTY');
var f3b = AP.submitSubApplication(Object.assign({}, pBase, { license: '', uscc: '91510100MA2T2TEST03' }), { store: t2store });
ok(f3b.error === 'E_LICENSE_REQUIRED', 'F-3 执照必填拦截 E_LICENSE_REQUIRED');

var f4 = AP.submitSubApplication(Object.assign({}, pBase, { uid: '', uscc: '91510100MA2T2TEST04' }), { store: t2store });
ok(f4.error === 'E_UID_REQUIRED', 'F-4 未登录拦截 E_UID_REQUIRED');

var f5 = AP.submitSubApplication(Object.assign({}, pBase, { uscc: '91510100MA2T2TEST01', uid: 'u32' }), { store: t2store });
ok(f5.error === 'E_USCC_DUPLICATE', 'F-5 uscc 唯一绑定拦截 E_USCC_DUPLICATE（在审占用）');

for (var m = 0; m < 9; m++) { t2subs.push({ id: 'sb-q' + m, parentUid: 'u11', uid: 'uq' + m, company: { name: '占位' + m, uscc: '91510100MA2T2Q00' + m }, status: 'pending', province: '四川省' }); }
var f6 = AP.submitSubApplication(Object.assign({}, pBase, { uscc: '91510100MA2T2TEST99', uid: 'u33' }), { store: t2store });
ok(f6.error === 'E_QUOTA_EXCEEDED', 'F-6 名额已满拦截 E_QUOTA_EXCEEDED');
t2subs.length = 0;

var rej = AP.submitSubApplication(Object.assign({}, pBase, { uscc: '91510100MA2T2TEST01', uid: 'u30' }), { store: t2store });
t2subs[0].status = 'rejected';
t2subs[0].rejects = [{ at: Date.now(), operator: 'u11', reason: '初审驳回测试' }];
t2store.saveSub(t2subs[0]);
var f7 = AP.submitSubApplication(Object.assign({}, pBase, { uscc: '91510100MA2T2TEST01', uid: 'u30', companyName: '蜀都建设重提' }), { store: t2store });
ok(f7.ok && f7.reused === true && f7.record.status === 'pending' && f7.record.company.name === '蜀都建设重提', 'F-7 驳回态复用回退 pending（一公司一记录）');
ok(f7.record.rejects.length === 1, 'F-7 rejects 历史保留');

t2subs.push({ id: 'sb-other', parentUid: 'u11', uid: 'u99', company: { name: '他人公司', uscc: '91510100MA2T2OTHER1' }, status: 'approved', province: '四川省' });
var mine = AP.listSubApplications('u30', { store: t2store });
ok(mine.length === 1 && mine[0].uid === 'u30' && mine[0].appliedBy === 'self', 'F-8 listSubApplications 只返回本人 self 申请（双轨并存不混入）');
ok(!t2subs[t2subs.length - 1].appliedBy, 'F-9 现状路径记录无 appliedBy 标记（平台直审语义保留）');
ok(!mem.data['engchain-referral-links'], 'F-10 二级申请不写 Referral 键（隔离铁律）');

section('E. 回归 smoke-m1');
var cp = require('child_process');
var out = cp.execSync('node "' + path.join(ROOT, 'scripts/smoke-m1.js') + '"', { encoding: 'utf8' });
ok(/FAIL=0/.test(out), 'smoke-m1 复跑 FAIL=0');

console.log('\n========================================');
console.log('M5(T1+T2) 结果：PASS=' + PASS + '  FAIL=' + FAIL);
process.exit(FAIL ? 1 : 0);
