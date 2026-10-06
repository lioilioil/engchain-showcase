/* 桩环境：验证 orgs.js 移交/移出逻辑（不依赖浏览器） */
const fs = require('fs');
const path = require('path');

/* ---- 全局桩 ---- */
const LS = new Map();
global.localStorage = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => LS.set(k, String(v)),
  removeItem: k => LS.delete(k)
};
global.window = global;
if (typeof CustomEvent === 'undefined') {
  global.CustomEvent = class { constructor(type, opts){ this.type = type; this.detail = (opts&&opts.detail)||{}; } };
}
global.document = { readyState: 'complete', addEventListener(){} };
const UI = { toast: Object.assign((t,k)=>console.log('  [toast]', k||'', t), {ok:()=>{},warn:()=>{},err:()=>{}}), state: { get: () => ({}), set: () => {} } };
global.UI = UI;

/* 用户池（仿 databus seed） */
const users = {
  u1: { id:'u1', name:'陈建国', mobile:'13800000001', auth:{ realname:{ ok:true } } },
  u3: { id:'u3', name:'王强',   mobile:'13800000003', auth:{ realname:{ ok:true } } },
  u4: { id:'u4', name:'张敏',   mobile:'13800000004', auth:{ realname:{ ok:true } } },
  u5: { id:'u5', name:'李娜',   mobile:'13800000005', auth:{ realname:{ ok:true } } }
};
let cur = null;
const messages = [];
global.DataBus = {
  current: () => cur,
  byId: id => users[id] || null,
  byMobile: m => Object.values(users).find(u => u.mobile === m) || null,
  isGuest: () => !cur,
  audit: (...a) => console.log('  [audit]', a.join(' | ')),
  pushDirectMessage: (uid, title, body) => { messages.push({ uid, title, body }); console.log('  [msg->' + uid + ']', title + '：' + body); },
  pushNotify(){}, dispatchEvent(){}
};
global.addEventListener = () => {};
global.dispatchEvent = () => {};

/* 加载 orgs.js */
eval(fs.readFileSync(path.join(__dirname, 'js', 'orgs.js'), 'utf8'));
const S = window.OrgsStore;
console.log('=== 桩环境就绪，OrgsStore 已加载 ===');

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }

/* ── 场景 1：owner 发起移交 → 接收人验证 → 后台审核通过 ── */
console.log('\n── 场景1：owner 发起移交全流程 ──');
cur = users.u3; /* org2 owner=u3, member=u5 */
let r = S.requestTransfer('org2', 'u5');
ok(r && !r.error, 'u3 发起移交到 u5：' + JSON.stringify(r));
let org = S.get('org2');
let t = (org.transfers || [])[0];
ok(t && t.status === 'verify-pending', 'owner 发起后状态为 verify-pending');
ok(S.transfersOf('org2').length === 1, 'transfersOf 返回 1 条');

/* 重复发起应被拦截 */
r = S.requestTransfer('org2', 'u5');
ok(r && r.error && r.error.indexOf('待处理') > -1, '重复发起被拦截：' + r.error);

/* 移交期间成员卡可见状态（页面用） */
ok(t.fromUid === 'u3' && t.toUid === 'u5', 'transfer 字段 from/to 正确');

/* 接收人 u5 提交法人验证 */
cur = users.u5;
r = S.submitOwnerVerify('org2', 'legal', { name: '王强', idNo: '510101199001011234', declaration: false });
ok(r && !r.error, 'u5 提交法人验证：' + JSON.stringify(r));
/* 法人姓名须与 org.legal 一致（org2 legal=王强，故 u5 填 王强 通过；但 u5 自己名字是李娜，法人通道只看姓名一致性） */

/* 后台审核通过 */
r = S.reviewOwnerVerify(t.id, true);
ok(r && !r.error, '后台审核通过：' + JSON.stringify(r));
org = S.get('org2');
let ownerNow = org.members.find(m => m.role === 'owner' && m.status === 'active');
let u5m = org.members.find(m => m.uid === 'u5');
let u3m = org.members.find(m => m.uid === 'u3');
ok(ownerNow && ownerNow.uid === 'u5', '移交后 u5 成为企业主');
ok(u3m && u3m.role === 'admin', '原企业主 u3 降为 admin');
ok(org.ownerUid === 'u5', 'ownerUid 指向 u5');
t = org.transfers.find(x => x.id === t.id);
ok(t.status === 'done' && t.verify.status === 'approved', '移交单终态 done/approved');

/* 已生效的移交不可撤回 */
cur = users.u5;
r = S.cancelTransfer(t.id);
ok(r && r.error, 'done 后撤回被拒绝：' + (r.error || ''));

/* ── 场景 2：撤回待验证移交 ── */
console.log('\n── 场景2：发起人撤回待验证移交 ──');
LS.delete(S.KEY);
S.load(); /* 重新 seed */
cur = users.u3;
r = S.requestTransfer('org2', 'u5');
t = S.transfersOf('org2')[0];
ok(t.status === 'verify-pending', '重新发起后 verify-pending');
/* 非发起人（u5）撤回被拒 */
cur = users.u5;
r = S.cancelTransfer(t.id);
ok(r && r.error && r.error.indexOf('发起人') > -1, '非发起人撤回被拒：' + r.error);
/* 发起人 u3 撤回成功 */
cur = users.u3;
r = S.cancelTransfer(t.id);
ok(r && !r.error, '发起人撤回成功');
ok(S.transfersOf('org2')[0].status === 'cancelled', '状态为 cancelled');
/* 撤回后可再次发起 */
r = S.requestTransfer('org2', 'u5');
ok(r && !r.error, '撤回后可重新发起');

/* ── 场景 3：admin 发起 → owner 确认 → 撤回 ── */
console.log('\n── 场景3：admin 发起移交 + owner 确认 + 撤回 ──');
LS.delete(S.KEY);
S.load();
/* org2：把 u5 升为 admin，并注入 u4 为 member（直接持久化） */
var arr = S.list();
arr.find(o => o.orgId === 'org2').members.find(m => m.uid === 'u5').role = 'admin';
arr.find(o => o.orgId === 'org2').members.push({ uid: 'u4', role: 'member', status: 'active', joinedAt: Date.now() });
LS.set(S.KEY, JSON.stringify(arr));
org = S.get('org2');
cur = users.u5; /* u5 admin 发起 */
r = S.requestTransfer('org2', 'u4');
t = S.transfersOf('org2')[0];
ok(t.status === 'owner-confirm', 'admin 发起后状态为 owner-confirm（待企业主确认）');
/* owner u3 确认 */
cur = users.u3;
r = S.confirmTransfer(t.id);
ok(r && !r.error, 'owner 确认：' + JSON.stringify(r));
ok(S.transfersOf('org2')[0].status === 'verify-pending', '确认后进入 verify-pending');
/* admin 发起人 u5 撤回 */
cur = users.u5;
r = S.cancelTransfer(t.id);
ok(r && !r.error, 'admin 发起人可撤回');
ok(S.transfersOf('org2')[0].status === 'cancelled', '撤回成功');

/* ── 场景 4：移出成员联动清理 ── */
console.log('\n── 场景4：移出成员 + 单据联动失效 ──');
LS.delete(S.KEY);
S.load();
/* 预置 u5 名下的待处理单据：邀请 / 加入申请 / 移交 / 自认领 / 变更目标（直接持久化） */
var arr4 = S.list();
var org4 = arr4.find(o => o.orgId === 'org2');
org4.invites.push({ inviteId: 'inv-x-u5', targetUid: 'u5', role: 'admin', status: 'pending', inviterUid: 'u3', createdAt: Date.now() });
org4.joins.push({ joinId: 'join-org2-u5', uid: 'u5', name: '李娜', status: 'pending', createdAt: Date.now() });
(org4.transfers = org4.transfers || []).push({ id: 'tr-x-u5', fromUid: 'u3', toUid: 'u5', status: 'verify-pending', verify: { mode: 'legal', status: 'pending' }, createdAt: Date.now() });
(org4.ownerClaims = org4.ownerClaims || []).push({ id: 'cl-x-u5', uid: 'u5', name: '李娜', mode: 'controller', status: 'pending', createdAt: Date.now() });
(org4.ownerChanges = org4.ownerChanges || []).push({ id: 'oc-x-u5', name: '李娜', mobile: '138****0005', mobileRaw: '13800000005', reason: '测试', status: 'pending', targetUid: 'u5', targetVerified: true, createdBy: 'u3', createdByName: '王强', createdAt: Date.now() });
LS.set(S.KEY, JSON.stringify(arr4));
/* 非 owner（u5）尝试移出 u4 被拒 */
cur = users.u5;
r = S.removeMember('org2', 'u4');
ok(r && r.error, '非 owner 移出被拒：' + r.error);
/* owner u3 移出 u5 */
cur = users.u3;
r = S.removeMember('org2', 'u5');
ok(r && !r.error, 'owner 移出 u5：' + JSON.stringify(r));
org = S.get('org2');
ok(!org.members.some(m => m.uid === 'u5'), 'u5 已不在成员列表');
ok(org.invites.find(x => x.inviteId === 'inv-x-u5').status === 'revoked', '待接受邀请已 revoke');
ok(org.joins.find(x => x.joinId === 'join-org2-u5').status === 'rejected', '加入申请已 reject');
let tx = org.transfers.find(x => x.id === 'tr-x-u5');
ok(tx.status === 'rejected' && tx.verify.status === 'rejected', '移交单已失效（含 verify）');
ok(org.ownerClaims.find(x => x.id === 'cl-x-u5').status === 'rejected', '自认领已失效');
ok(org.ownerChanges.find(x => x.id === 'oc-x-u5').status === 'rejected', '企业主变更目标已失效');
/* 移出企业主被拒 */
r = S.removeMember('org2', 'u3');
ok(r && r.error, '企业主不可被移出：' + r.error);

/* ── 场景 5：页面侧依赖的导出完整性 ── */
console.log('\n── 场景5：导出与页面依赖 ──');
ok(typeof S.cancelTransfer === 'function', 'cancelTransfer 已导出');
ok(typeof S.transfersOf === 'function', 'transfersOf 可用');
ok(typeof S.ownerConfirmingTransfers === 'function', 'ownerConfirmingTransfers 保留兼容');

console.log('\n════ 结果：PASS=' + pass + ' FAIL=' + fail + ' ════');
process.exit(fail ? 1 : 0);
