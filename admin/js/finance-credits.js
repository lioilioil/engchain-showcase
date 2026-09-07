/**
 * 后台资金模块 Mock 数据（多用户积分流水）
 * 与 App 端 CreditStore（单用户）互补，提供管理员视角的全量积分流水
 * 存储键：engchain-admin-credits
 */
(function () {
  'use strict';
  var KEY = 'engchain-admin-credits';
  var LS = window.localStorage;

  var USERS = [
    { uid: 'u1', name: '陈建国' },
    { uid: 'u2', name: '李雅' },
    { uid: 'u3', name: '王强' },
    { uid: 'u5', name: '赵磊' },
    { uid: 'u6', name: '刘洋' },
    { uid: 'u8', name: '周敏' }
  ];

  var TYPES = [
    { type: 'recharge', label: '积分充值', pos: true },
    { type: 'unlock', label: '信息解锁', pos: false },
    { type: 'signin', label: '签到奖励', pos: true },
    { type: 'invite', label: '邀请奖励', pos: true },
    { type: 'order_refund', label: '订单退款返还', pos: true },
    { type: 'admin_adjust', label: '管理员调整', pos: null },
    { type: 'expire', label: '积分过期', pos: false }
  ];

  function seed() {
    var now = Date.now();
    var logs = [];
    var id = 1;
    USERS.forEach(function (u) {
      var balance = 500 + Math.floor(Math.random() * 2000);
      /* 每个用户 5-8 条流水 */
      var count = 5 + Math.floor(Math.random() * 4);
      for (var i = 0; i < count; i++) {
        var t = TYPES[Math.floor(Math.random() * (TYPES.length - 1))]; /* 排除 admin_adjust */
        var credits = t.pos ? (50 + Math.floor(Math.random() * 500)) : -(10 + Math.floor(Math.random() * 200));
        if (t.type === 'signin') credits = 5 + Math.floor(Math.random() * 20);
        if (t.type === 'invite') credits = 50;
        balance += credits;
        if (balance < 0) balance = 0;
        logs.unshift({
          id: 'CR' + String(100000 + id++),
          uid: u.uid,
          userName: u.name,
          type: t.type,
          typeLabel: t.label,
          credits: credits,
          balance: balance,
          reason: t.label + (t.type === 'unlock' ? ' · ' + ['材料信息', '设备信息', '劳务信息', '合作机会'][Math.floor(Math.random() * 4)] : ''),
          remark: '',
          ts: now - (i * 86400000 + Math.floor(Math.random() * 43200000)),
          operator: t.type === 'admin_adjust' ? 'admin' : ''
        });
      }
    });
    logs.sort(function (a, b) { return b.ts - a.ts; });
    try { LS.setItem(KEY, JSON.stringify(logs)); } catch (e) {}
    return logs;
  }

  function load() {
    var a = [];
    try { a = JSON.parse(LS.getItem(KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) a = seed();
    return a;
  }

  function save(a) {
    try { LS.setItem(KEY, JSON.stringify(a)); } catch (e) {}
    return a;
  }

  function add(log) {
    var a = load();
    var newLog = Object.assign({
      id: 'CR' + String(100000 + a.length + Math.floor(Math.random() * 1000)),
      ts: Date.now(),
      operator: 'admin'
    }, log);
    /* 更新该用户后续余额 */
    a.unshift(newLog);
    a.sort(function (x, y) { return y.ts - x.ts; });
    save(a);
    window.dispatchEvent(new CustomEvent('engchain:admin-credits', { detail: newLog }));
    return newLog;
  }

  function userBalance(uid) {
    var a = load();
    for (var i = 0; i < a.length; i++) {
      if (a[i].uid === uid) return a[i].balance;
    }
    return 0;
  }

  function userLogs(uid) {
    return load().filter(function (l) { return l.uid === uid; });
  }

  function stats() {
    var a = load();
    var totalIssued = 0, totalConsumed = 0, currentCirculation = 0;
    var seen = {};
    a.forEach(function (l) {
      if (l.credits > 0) totalIssued += l.credits;
      else totalConsumed += Math.abs(l.credits);
      if (!seen[l.uid]) { seen[l.uid] = l.balance; currentCirculation += l.balance; }
    });
    return { totalIssued: totalIssued, totalConsumed: totalConsumed, currentCirculation: currentCirculation, userCount: Object.keys(seen).length };
  }

  window.AdminCredits = {
    load: load,
    add: add,
    userBalance: userBalance,
    userLogs: userLogs,
    stats: stats,
    users: USERS,
    types: TYPES,
    reset: seed
  };
})();
