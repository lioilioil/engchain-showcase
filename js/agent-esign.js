/* ============================================================================
   js/agent-esign.js —— M3-8 O4《二级合作协议》在线签署闭环（t-subagent）
   ----------------------------------------------------------------------------
   - 独立于既有 EsignStore（engchain-esign）：不消耗既有次数包、不改既有合同/状态机（R-12）；
     本模块使用独立键 engchain-agent-esign，模板 t-subagent 独立，八条条款内置。
   - 状态机：sendContract → pending_mine / signing → completed / rejected（拒签带原因）。
   - 完成后把 version/code/sentAt/completedAt/签署人/存证写回 sub-agents.signature。
   - 存证为模拟标注（demo 不接真实 CA）。浏览器 → window.AgentEsign；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';
  var KEY = 'engchain-agent-esign';
  /* S4-2 商用化：对外展示版本号 v1.0.0（不含内部模板模块名 t-subagent）；templateId 保留内部键 */
  var VERSION = 'v1.0.0';

  /* O4《二级合作协议》八条条款（demo 文本，生产由律师定稿；仅书面展示） */
  var CLAUSES = [
    { no: 1, title: '合作主体与授权', body: '甲方为省级独家总代，乙方为本省二级合作分代理商；双方主体信息以营业执照与本协议载明为准。' },
    { no: 2, title: '授权范围与独家边界', body: '乙方在甲方授权省内开展二级合作，不跨省、不发展下级、不以甲方名义对外承诺独家权益。' },
    { no: 3, title: '分账测算口径', body: '二级约定所得=二级自身真实消费实付×50%总盘×约定比例（0–50%），仅为内部测算，平台不付款、不开票。' },
    { no: 4, title: '冻结与退款', body: '消费 T+7 冻结，冻结期退款剔除；出冻结退款先冲当月红字、不足转次月；特殊退款按指定流水号等额冲减对应笔。' },
    { no: 5, title: '双方权利义务', body: '甲方提供本省渠道支持与台账；乙方真实履约、如实申报消费，不得刷单、拉人头或收取入门费。' },
    { no: 6, title: '保密条款', body: '双方对商业数据、分账测算与用户信息保密，协议终止后保密义务延续。' },
    { no: 7, title: '解除与终止', body: '乙方违约经通知未改正可解除；解除后名额与绑定释放，台账封存只读，已发生测算不追溯付款。' },
    { no: 8, title: '争议解决与生效', body: '争议协商不成提交甲方所在地有管辖权法院；双方签署完成后生效，电子存证与纸质签署具同等展示效力。' }
  ];

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function codeGen() { var d = new Date(); return 'SUB-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + Math.floor(1000 + Math.random() * 9000); }
  function hash() { var s = '0123456789abcdef', h = '0x'; for (var i = 0; i < 40; i++) h += s.charAt(Math.floor(Math.random() * 16)); return h; }
  function certNo() { var d = new Date(); return 'EC-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + Math.floor(1000 + Math.random() * 9000); }

  function storage(opts) {
    if (opts && opts.store) return opts.store;
    if (opts && opts.storage) return opts.storage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }
  function readAll(opts) {
    var s = storage(opts); if (!s) return { contracts: [] };
    try { var v = JSON.parse(s.getItem(KEY) || '{"contracts":[]}'); return v && Array.isArray(v.contracts) ? v : { contracts: [] }; }
    catch (e) { return { contracts: [] }; }
  }
  function writeAll(opts, data) {
    var s = storage(opts); if (s) { try { s.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
    return data;
  }

  /* 发起：parent(总代) 发起给 sub(二级)；parent 视为已签，待二级签 → pending_mine */
  function sendContract(input, opts) {
    opts = opts || {};
    input = input || {};
    if (!input.subId) return { error: 'E_SUB_REQUIRED', msg: '缺少二级记录 id' };
    var now = Date.now();
    var doc = {
      id: 'es' + String(now).slice(-9),
      code: codeGen(),
      templateId: 't-subagent',
      version: VERSION,
      title: '二级合作协议（O4）',
      subId: input.subId,
      parentUid: input.parentUid || '',
      subUid: input.subUid || '',
      clauses: CLAUSES,
      parties: [
        { key: 'parent', name: input.parentName || '', company: input.parentCompany || '', role: '甲方', status: 'signed', signedAt: now, signMethod: '企业公章' },
        { key: 'sub', name: input.subName || '', company: input.subCompany || '', role: '乙方', status: 'pending', signedAt: 0, signMethod: '', rejectReason: '' }
      ],
      status: 'pending_mine',
      sentAt: now, completedAt: 0, rejectReason: '',
      evidence: null
    };
    var data = readAll(opts);
    data.contracts.push(doc);
    writeAll(opts, data);
    return { ok: true, contract: doc };
  }

  function find(data, id) {
    for (var i = 0; i < data.contracts.length; i++) if (data.contracts[i].id === id || data.contracts[i].code === id) return { idx: i, c: data.contracts[i] };
    return null;
  }

  /* 二级签署：全部签完 → completed，写回 signature（由 onSigned 回调落 sub-agents） */
  function sign(contractId, partyKey, signMethod, opts) {
    opts = opts || {};
    var data = readAll(opts);
    var f = find(data, contractId);
    if (!f) return { error: 'E_NOT_FOUND', msg: '协议不存在' };
    var c = f.c;
    if (c.status === 'completed') return { error: 'E_ALREADY_DONE', msg: '协议已完成' };
    if (c.status === 'rejected') return { error: 'E_REJECTED', msg: '协议已被拒签' };
    var me = (c.parties || []).filter(function (p) { return p.key === partyKey; })[0];
    if (!me) return { error: 'E_PARTY_NOT_FOUND', msg: '签署方不存在' };
    me.status = 'signed'; me.signedAt = Date.now(); me.signMethod = signMethod || '个人/企业签名';
    var pending = c.parties.filter(function (p) { return p.status !== 'signed'; });
    if (!pending.length) {
      c.status = 'completed';
      c.completedAt = Date.now();
      c.evidence = { provider: 'e签宝(模拟)', certNo: certNo(), hash: hash(), timestamp: c.completedAt, note: '本平台演示环境存证，正式存证以第三方电子签服务为准' };
      writeAll(opts, data);
      var signature = {
        code: c.code, version: c.version, sentAt: c.sentAt, completedAt: c.completedAt,
        signer: me.name, signMethod: me.signMethod, evidence: c.evidence, status: 'completed'
      };
      if (typeof opts.onSigned === 'function') opts.onSigned(c.subId, signature, c);
      return { ok: true, contract: c, signature: signature };
    }
    c.status = 'signing';
    writeAll(opts, data);
    return { ok: true, contract: c };
  }

  /* 拒签：带原因，状态 rejected，不写完成存证 */
  function reject(contractId, partyKey, reason, opts) {
    opts = opts || {};
    if (!reason || !String(reason).trim()) return { error: 'E_REASON_REQUIRED', msg: '拒签原因必填' };
    var data = readAll(opts);
    var f = find(data, contractId);
    if (!f) return { error: 'E_NOT_FOUND', msg: '协议不存在' };
    var c = f.c;
    var me = (c.parties || []).filter(function (p) { return p.key === partyKey; })[0];
    if (me) { me.status = 'rejected'; me.rejectReason = reason; me.rejectedAt = Date.now(); }
    c.status = 'rejected'; c.rejectReason = reason;
    writeAll(opts, data);
    if (typeof opts.onRejected === 'function') opts.onRejected(c.subId, reason, c);
    return { ok: true, contract: c };
  }

  function listBySub(subId, opts) {
    var data = readAll(opts);
    return data.contracts.filter(function (c) { return c.subId === subId; });
  }
  function contractById(id, opts) {
    var f = find(readAll(opts), id);
    return f ? f.c : null;
  }

  var api = {
    KEY: KEY, VERSION: VERSION, CLAUSES: CLAUSES,
    sendContract: sendContract, sign: sign, reject: reject,
    listBySub: listBySub, contractById: contractById
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentEsign = api;
})(typeof window !== 'undefined' ? window : globalThis);
