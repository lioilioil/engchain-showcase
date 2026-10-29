/* ============================================================================
   js/agent-demo.js —— M3-9 u11/u12 播种 + 硬刷新重置（DEMO_SCENARIOS）
   ----------------------------------------------------------------------------
   - u11 四川总代（n/21、两分区：二级线+自营线、充值不进、frozen/settled/冲减、法定税、自营线全额、
     待签/已签、团队 admin+member、叠加个人合伙人示例、清理日志样例）；
   - u12 成都二级（约定20%、本人所得、冻结退款、冲减、税、已签、团队）；
   - reset 仅清代理四键+代理签署键+清理日志，绝不覆盖 u9/u10/u1-u8 种子；
   - 示例数字均为「模拟测算」。浏览器 → window.AgentDemo；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';
  var DAY = 864e5;

  function deps() {
    var S = (typeof window !== 'undefined' && window.AgentStore) || (typeof require === 'function' ? require('./agent-store.js') : null);
    var L = (typeof window !== 'undefined' && window.AgentLedger) || (typeof require === 'function' ? require('./agent-ledger.js') : null);
    var E = (typeof window !== 'undefined' && window.AgentEsign) || (typeof require === 'function' ? require('./agent-esign.js') : null);
    var T = (typeof window !== 'undefined' && window.AgentTax) || (typeof require === 'function' ? require('./agent-tax.js') : null);
    var A = (typeof window !== 'undefined' && window.AuthStore) || null;
    var R = (typeof window !== 'undefined' && window.AgentReferral) || (typeof require === 'function' ? require('./agent-referral.js') : null);
    return { S: S, L: L, E: E, T: T, A: A, R: R };
  }

  var AUTH_BACKUP_KEY = 'engchain-agent-auth-backup';

  /* 重置：仅清代理体系键，不动 databus 用户种子 / BalanceStore / 既有 esign 合同 */
  function reset(opts) {
    opts = opts || {};
    var S = deps().S;
    if (S && typeof S.reset === 'function') S.reset();
    var st = opts.store || (typeof window !== 'undefined' && window.localStorage);
    if (st) {
      ['engchain-agent-esign', 'engchain-agent-invites', 'engchain-agent-invite-logs'].forEach(function (k) { try { st.removeItem(k); } catch (e) {} });
      /* 恢复 seed 前的 auth 备份（u11 兼任个人合伙人标记还原，不覆盖 databus u9/u1 等种子） */
      try {
        var backup = st.getItem(AUTH_BACKUP_KEY);
        if (backup) { st.setItem('engchain-auth', backup); st.removeItem(AUTH_BACKUP_KEY); }
      } catch (e) {}
      /* 仅移除本阶段播种的演示组织，保留 M1/M2 既有 org1/org2/org3 与用户种子 */
      try {
        var orgs = JSON.parse(st.getItem('engchain-orgs') || '[]');
        if (Array.isArray(orgs)) {
          var kept = orgs.filter(function (o) { return o.orgId !== 'org-a11' && o.orgId !== 'org-a12'; });
          st.setItem('engchain-orgs', JSON.stringify(kept));
        }
      } catch (e) {}
    }
    return { ok: true, cleared: ['province-agents', 'sub-agents', 'agent-ledger', 'agent-behavior', 'behavior-cleanup-log', 'agent-esign', 'agent-invites', 'agent-invite-logs', 'org-a11', 'org-a12', AUTH_BACKUP_KEY] };
  }

  function seed(opts) {
    opts = opts || {};
    var d = deps(), S = d.S, L = d.L, E = d.E, T = d.T, A = d.A;
    if (!S) return { error: 'E_DEPS_MISSING' };
    reset(opts);
    var now = Date.now();

    /* ---- R-15 兼任并集播种：u11 总代叠加个人合伙人身份（备份原 auth，reset 还原） ----
       仅浏览器环境有 AuthStore/localStorage；node 测试跳过。 */
    if (A && typeof window !== 'undefined' && window.localStorage) {
      try {
        if (!window.localStorage.getItem(AUTH_BACKUP_KEY)) {
          window.localStorage.setItem(AUTH_BACKUP_KEY, window.localStorage.getItem('engchain-auth') || '');
        }
        var auth = A.read ? A.read() : {};
        auth = JSON.parse(JSON.stringify(auth || {}));
        auth.realname = auth.realname || { ok: true, name: '林振华' };
        auth.partner = { ok: true, status: 'approved', approvedAt: now - 30 * DAY, profitConfig: {} };
        A.write(auth);
      } catch (e) {}
    }

    /* ---- u11 四川总代（active，n/21） ---- */
    var pa = {
      id: 'pa-u11', uid: 'u11', province: '四川省', provinceCode: '510000',
      branchCompany: { name: '四川华建工程管理有限公司', uscc: '91510000DEMO11X', license: '营业执照(示例)', legalRep: '林振华', contact: '林振华', phone: '139****0011' },
      status: 'active', appointedAt: now - 30 * DAY, appointedBy: 'admin', source: 'seed',
      rejects: [], statusLog: [{ operator: 'admin', at: now - 30 * DAY, reason: '播种开通', fromStatus: '', toStatus: 'active' }],
      provinceHistory: [], sealedAt: 0, orgId: 'org-a11', legalRep: '林振华',
      admins: ['u11'], materials: ['示例资质材料'], fee: 0,
      /* 叠加个人合伙人示例（并集，独立布尔，不合并身份） */
      union: { individualPartner: true }
    };
    S.saveProvince(pa);

    /* ---- u12 成都二级（approved，约定20%，已签） ---- */
    var sub = {
      id: 'sb-u12', parentUid: 'u11', uid: 'u12',
      company: { name: '成都成达建设工程有限公司', uscc: '91510100DEMO12Y', license: '营业执照(示例)', legalRep: '陈志远', contact: '陈志远' },
      province: '四川省', ratioToSub: 0.20, status: 'approved',
      statusLog: [{ operator: 'admin', at: now - 20 * DAY, reason: '播种通过', fromStatus: 'pending', toStatus: 'approved' }],
      rejects: [], ratioLog: [{ ratio: 0.20, at: now - 20 * DAY, operator: 'admin', reason: '初始约定20%' }],
      signature: null, sealedAt: 0, orgId: 'org-a12'
    };
    S.saveSub(sub);

    /* ---- T1 招商码播种：u11 生成招商码（独立键 engchain-agent-invites，与 Referral 隔离） ---- */
    if (d.R && typeof d.R.createCode === 'function') {
      try { d.R.createCode('u11'); } catch (e) {}
    }

    /* ---- 台账样例：二级线 消费10000→总盘5000→20%→约定1000/自留4000；自营线 直营消费8000→全额4000 ---- */
    function entry(partial) { return Object.assign({ at: now - 10 * DAY, month: L.monthKey(now - 10 * DAY), line: 'subLedger', frozenStatus: 'settled', at: now - 10 * DAY }, partial); }
    S.appendEntry(entry({ serialNo: 'ALG-DEMO-01', line: 'subLedger', type: 'order_paid_net', amount: 10000, orderNo: 'DEMO-ORD-01', subject: 'u12', channelOwner: 'u12', parentSub: 'sb-u12', balanceAfter: 0 }));
    /* 一笔冻结中（T+7 未到期） */
    S.appendEntry({ serialNo: 'ALG-DEMO-02', line: 'subLedger', type: 'order_paid_net', amount: 3000, orderNo: 'DEMO-ORD-02', subject: 'u12', channelOwner: 'u12', parentSub: 'sb-u12', frozenStatus: 'frozen', at: now - 1 * DAY, month: L.monthKey(now - 1 * DAY), balanceAfter: 0 });
    /* 自营线：省代直营获客用户（u21，不归属任何二级企业）settled 消费 ×50% 全额归省代 */
    S.appendEntry({ serialNo: 'ALG-DEMO-03', line: 'selfLine', type: 'order_paid_net', amount: 8000, orderNo: 'DEMO-ORD-03', subject: 'u21', channelOwner: 'u11', parentSub: '', frozenStatus: 'settled', at: now - 12 * DAY, month: L.monthKey(now - 12 * DAY), balanceAfter: 0 });
    /* 充值笔：明确不计入自营线基数 */
    S.appendEntry({ serialNo: 'ALG-DEMO-04', line: 'selfLine', type: 'recharge', amount: 5000, orderNo: 'DEMO-RC-01', subject: 'u21', channelOwner: 'u11', parentSub: '', frozenStatus: 'settled', at: now - 9 * DAY, month: L.monthKey(now - 9 * DAY), balanceAfter: 0 });

    /* ---- 法定税列（方案A 示例：约定所得1000 → 预扣40/税后960） ---- */
    if (T) {
      var tax = T.laborWithholding(1000);
      S.appendEntry({ serialNo: 'ALG-DEMO-TAX', line: 'subLedger', type: 'tax_note', amount: 0, subject: 'u12', frozenStatus: 'settled', at: now - 10 * DAY, month: L.monthKey(now - 10 * DAY), tax: { scheme: 'labor', gross: tax.gross, rate: tax.rate, tax: tax.tax, net: tax.net, certNo: 'EC-DEMO-001' }, balanceAfter: 0 });
    }

    /* ---- O4 签署：u12 已签（写回 signature） ---- */
    if (E) {
      var sc = E.sendContract({ subId: 'sb-u12', parentUid: 'u11', subUid: 'u12', parentName: '林振华', parentCompany: '四川华建工程管理有限公司', subName: '陈志远', subCompany: '成都成达建设工程有限公司' }, opts);
      if (sc.ok) {
        E.sign(sc.contract.id, 'sub', '企业公章', Object.assign({}, opts, {
          onSigned: function (subId, signature) {
            var rec = S.getSub(subId); if (rec) { rec.signature = signature; S.saveSub(rec); }
          }
        }));
      }
    }

    /* ---- 行为清理日志样例（M1-10） ---- */
    S.appendCleanupLog({ operator: 'admin', at: now - 5 * DAY, rangeStart: now - 90 * DAY, rangeEnd: now - 30 * DAY, count: 3 });

    /* ---- M3-10 团队：在 OrgsStore 建 u11/u12 公司组织（复用既有团队树，不另造） ----
       legalRep 由执照法定代表人派生只读；admin 可操作；member 日常；成员不计省名额。
       仅浏览器环境有 OrgsStore/localStorage；node 测试跳过。 */
    if (typeof window !== 'undefined' && window.OrgsStore) {
      try {
        var raw = JSON.parse(window.localStorage.getItem('engchain-orgs') || '[]');
        if (!Array.isArray(raw)) raw = [];
        var exists = {}; raw.forEach(function (o) { exists[o.orgId] = true; });
        if (!exists['org-a11']) raw.push({
          orgId: 'org-a11', co: '四川华建工程管理有限公司', shortName: '华建管理',
          code: pa.branchCompany.uscc, legal: '林振华', entryTypes: ['province_agent'],
          entStatus: 'active', expireAt: now + 365 * DAY, ownerUid: 'u11', memberLimit: 10,
          members: [
            { uid: 'u11', role: 'owner', status: 'active', joinedAt: now - 30 * DAY },
            { uid: 'u11a', role: 'admin', status: 'active', joinedAt: now - 25 * DAY }
          ],
          invites: [], joins: [], ownerClaims: []
        });
        if (!exists['org-a12']) raw.push({
          orgId: 'org-a12', co: '成都成达建设工程有限公司', shortName: '成达建设',
          code: sub.company.uscc, legal: '陈志远', entryTypes: ['sub_agent'],
          entStatus: 'active', expireAt: now + 365 * DAY, ownerUid: 'u12', memberLimit: 10,
          members: [
            { uid: 'u12', role: 'owner', status: 'active', joinedAt: now - 20 * DAY },
            { uid: 'u12m', role: 'member', status: 'active', joinedAt: now - 15 * DAY }
          ],
          invites: [], joins: [], ownerClaims: []
        });
        window.localStorage.setItem('engchain-orgs', JSON.stringify(raw));
      } catch (e) {}
    }

    return { ok: true, seeded: ['pa-u11', 'sb-u12'], note: '示例数字均为模拟测算，非税务意见，非实际代扣金额' };
  }

  var api = { seed: seed, reset: reset, DEMO_SCENARIOS: { seed: seed, reset: reset } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentDemo = api;
})(typeof window !== 'undefined' ? window : globalThis);
