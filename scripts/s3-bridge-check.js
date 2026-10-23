/* S3-2 走查辅助：验证 后台种子 → App bridge 事务式应用链路
   场景1：id 匹配（pa-demo-1 pending）→ 应用成功 status 变 active
   场景2：id 不匹配（不存在）→ E_RECORD_NOT_FOUND 整体不落库
   场景3：状态非法（已 active 再 approve）→ E_STATUS_NOT_PENDING 不落库
   红线零改动：不碰费率/税算/门控/数据结构，仅读状态机 */
const path = require('path');
const Store = require(path.join(__dirname, '..', 'js', 'agent-store.js'));
const Bridge = require(path.join(__dirname, '..', 'js', 'agent-bridge.js'));

function mockLocalStorage(init) {
  const mem = Object.assign({}, init);
  const ls = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
    _mem: mem
  };
  global.window = { localStorage: ls };
  global.localStorage = ls;
  return ls;
}

// —— 场景1：id 匹配 pending → approve 成功 ——
const ls1 = mockLocalStorage({
  'engchain-province-agents': JSON.stringify([{
    id: 'pa-demo-1', uid: 'u11', company: { name: '示例四川总代公司' },
    province: '四川省', status: 'pending', branchCompany: { uscc: '91X001' },
    quota: { cap: 21, used: 0 }, orgId: 'org-a11', statusLog: []
  }]),
  'engchain-sub-agents': JSON.stringify([]),
  'engchain-orgs': JSON.stringify([])
});
const S1 = Store;
const seed1 = {
  schema: 'engchain-agent-seed/1',
  exportedAt: Date.now(),
  meta: { source: 'admin-vue' },
  actions: [{ at: Date.now(), op: 'province.approve', id: 'pa-demo-1', operator: 'admin', reason: '审核通过' }]
};
const r1 = Bridge.applySeed(JSON.stringify(seed1), { store: S1, quotaCfg: { provinceCap: 21 } });
const pa1 = S1.getProvince('pa-demo-1');
console.log('[场景1 id匹配]', JSON.stringify({ ok: r1.ok, applied: r1.applied, newStatus: pa1 && pa1.status, source: pa1 && pa1.source, appointedAt: !!pa1.appointedAt, statusLog: (pa1.statusLog || []).length }));

// —— 场景2：id 不存在 → 不落库 ——
const ls2 = mockLocalStorage({
  'engchain-province-agents': JSON.stringify([{ id: 'pa-u11', uid: 'u11', province: '四川省', status: 'pending' }]),
  'engchain-sub-agents': JSON.stringify([])
});
const S2 = Store;
const seed2 = {
  schema: 'engchain-agent-seed/1',
  actions: [{ op: 'province.approve', id: 'pa-DOES-NOT-EXIST', operator: 'admin', reason: '审核通过' }]
};
const r2 = Bridge.applySeed(JSON.stringify(seed2), { store: S2, quotaCfg: { provinceCap: 21 } });
console.log('[场景2 id不存在]', JSON.stringify({ ok: r2.ok, committed: r2.committed, failed: r2.failed, unchanged: S2.getProvince('pa-u11').status }));

// —— 场景3：已 active 再 approve → E_STATUS_NOT_PENDING ——
const ls3 = mockLocalStorage({
  'engchain-province-agents': JSON.stringify([{ id: 'pa-x', uid: 'u9', province: '四川省', status: 'active' }]),
  'engchain-sub-agents': JSON.stringify([])
});
const S3 = Store;
const seed3 = {
  schema: 'engchain-agent-seed/1',
  actions: [{ op: 'province.approve', id: 'pa-x', operator: 'admin', reason: '重复通过' }]
};
const r3 = Bridge.applySeed(JSON.stringify(seed3), { store: S3, quotaCfg: { provinceCap: 21 } });
console.log('[场景3 重复通过]', JSON.stringify({ ok: r3.ok, failed: r3.failed && r3.failed.map(f => f.code), unchanged: S3.getProvince('pa-x').status }));

// —— 场景4：省冲突（同省已有 active 总代）→ 校验拦截不落库 ——
const ls4 = mockLocalStorage({
  'engchain-province-agents': JSON.stringify([
    { id: 'pa-a', uid: 'uA', province: '四川省', status: 'active' },
    { id: 'pa-b', uid: 'uB', province: '四川省', status: 'pending', branchCompany: { uscc: '91X002' } }
  ]),
  'engchain-sub-agents': JSON.stringify([])
});
const S4 = Store;
const seed4 = {
  schema: 'engchain-agent-seed/1',
  actions: [{ op: 'province.approve', id: 'pa-b', operator: 'admin', reason: '审核通过' }]
};
const r4 = Bridge.applySeed(JSON.stringify(seed4), { store: S4, quotaCfg: { provinceCap: 21 } });
console.log('[场景4 省冲突]', JSON.stringify({ ok: r4.ok, failed: r4.failed && r4.failed.map(f => f.code), pendingStill: S4.getProvince('pa-b').status }));

// —— 场景5：直接指定开通（M2-3 directGrant）→ 新建 active 记录 ——
const ls5 = mockLocalStorage({
  'engchain-province-agents': JSON.stringify([]),
  'engchain-sub-agents': JSON.stringify([])
});
const S5 = Store;
const seed5 = {
  schema: 'engchain-agent-seed/1',
  actions: [{ op: 'province.directGrant', operator: 'admin', reason: '后台直接指定',
    record: { uid: 'u-dg', company: { name: '直指省代公司' }, province: '四川省', branchCompany: { uscc: '91X999', legal: '张三' }, quota: { cap: 21, used: 0 } } }]
};
const r5 = Bridge.applySeed(JSON.stringify(seed5), { store: S5, quotaCfg: { provinceCap: 21 } });
const pas5 = S5.listProvinces();
console.log('[场景5 直接指定]', JSON.stringify({ ok: r5.ok, applied: r5.applied, count: pas5.length, newStatus: pas5[0] && pas5[0].status, idPrefix: pas5[0] && pas5[0].id.slice(0, 3) }));

// —— 场景6：终止态操作（M2-7 terminate）→ active → terminated 不可逆 ——
const ls6 = mockLocalStorage({
  'engchain-province-agents': JSON.stringify([{ id: 'pa-t', uid: 'uT', province: '四川省', status: 'active', statusLog: [] }]),
  'engchain-sub-agents': JSON.stringify([])
});
const S6 = Store;
const seed6 = {
  schema: 'engchain-agent-seed/1',
  actions: [{ op: 'province.terminate', id: 'pa-t', operator: 'admin', reason: '违规终止' }]
};
const r6 = Bridge.applySeed(JSON.stringify(seed6), { store: S6, quotaCfg: { provinceCap: 21 } });
const pa6 = S6.getProvince('pa-t');
console.log('[场景6 终止]', JSON.stringify({ ok: r6.ok, newStatus: pa6.status, logLen: (pa6.statusLog || []).length, lastReason: pa6.statusLog[0] && pa6.statusLog[0].reason }));
// 终止后不可逆：再 approve → E_STATUS_NOT_PENDING
const r6b = Bridge.applySeed(JSON.stringify({ schema: 'engchain-agent-seed/1', actions: [{ op: 'province.approve', id: 'pa-t', operator: 'admin', reason: 'x' }] }), { store: S6, quotaCfg: { provinceCap: 21 } });
console.log('[场景6b 终止不可逆]', JSON.stringify({ failed: r6b.failed && r6b.failed.map(f => f.code), status: S6.getProvince('pa-t').status }));
