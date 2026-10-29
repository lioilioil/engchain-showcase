/* ============================================================================
   js/agent-insight.js —— T4 省代经营数据中心聚合模块（总代 / 二级双视角）
   ----------------------------------------------------------------------------
   口径铁律（执行计划 §0.3/T4-3）：全部聚合复用 AgentLedger 纯函数
   （partitionSubtotals / selfLineAmount / monthKey / isEligibleConsumption），
   不新造任何计算口径；本模块只做「切片 + 编排 + 排序 + 统计」，计算全交给 Ledger。

   依赖注入：浏览器 window.AgentLedger；node 测试用 init({ledger}) 注入；
   合格消费白名单等一切口径以 AgentLedger.DEFAULTS / isEligibleConsumption 为权威。

   浏览器 → window.AgentInsight；node → module.exports。
   ============================================================================ */
(function (root) {
  'use strict';

  var _ledger = null;
  function L() {
    if (_ledger) return _ledger;
    if (typeof window !== 'undefined' && window.AgentLedger) return window.AgentLedger;
    if (typeof require === 'function') { try { return require('./agent-ledger.js'); } catch (e) {} }
    return null;
  }
  function init(opts) { _ledger = (opts && opts.ledger) || null; return api; }

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  /* 口径解析：以 AgentLedger 权威为准；缺省回退内置常量（与 Ledger.DEFAULTS 对齐，防单测缺依赖） */
  function cfgOf(over) {
    var d = L() ? (L().DEFAULTS || {}) : {};
    return Object.assign({
      grossShare: 0.5, frozenDays: 7,
      eligibleTypes: ['order_paid_net', 'points_unlock_paid', 'value_added_paid']
    }, d, over || {});
  }

  /* ---------- T4-1 月度趋势：近 N 月两分区聚合（按月切片 → 复用 partitionSubtotals） ---------- */
  function monthlyTrend(entries, cfg, opts) {
    opts = opts || {};
    var months = opts.months || 12;
    var now = opts.now || Date.now();
    var c = cfgOf(cfg);
    var list = [];
    for (var i = months - 1; i >= 0; i--) {
      var d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - i);
      list.push({ month: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') });
    }
    var monthSlice = {};
    (entries || []).forEach(function (e) {
      if (!e || !e.month) return;
      (monthSlice[e.month] = monthSlice[e.month] || []).push(e);
    });
    var ratio = (c && typeof c._ratio === 'number') ? c._ratio : 0;
    return list.map(function (m) {
      var slice = monthSlice[m.month] || [];
      var pt = L() && L().partitionSubtotals
        ? L().partitionSubtotals(slice, Object.assign({}, c, { _ratio: ratio }))
        : { subLedger: { settledGross: 0, pool: 0, agreed: 0, retained: 0, count: 0 }, selfLine: { settledBase: 0, amount: 0, count: 0 } };
      var self = L() && L().selfLineAmount ? L().selfLineAmount(slice, c) : { base: 0, amount: 0 };
      return {
        month: m.month,
        gross: r2(pt.subLedger.settledGross),
        pool: r2(pt.subLedger.pool),
        agreed: r2(pt.subLedger.agreed),
        retained: r2(pt.subLedger.retained),
        subCount: pt.subLedger.count,
        selfBase: r2(pt.selfLine.settledBase || self.base),
        selfAmount: r2(pt.selfLine.amount || self.amount)
      };
    });
  }

  /* ---------- T4-1 二级贡献排行：按累计约定所得降序（每二级切片复用 partitionSubtotals） ---------- */
  function subRank(entries, subs, cfg) {
    var c = cfgOf(cfg);
    return (subs || []).map(function (s) {
      var mine = (entries || []).filter(function (e) {
        return e && e.subject === s.uid && e.line === 'subLedger';
      });
      var pt = L() && L().partitionSubtotals
        ? L().partitionSubtotals(mine, Object.assign({}, c, { _ratio: Number(s.ratioToSub) || 0 }))
        : { subLedger: { settledGross: 0, pool: 0, agreed: 0, retained: 0, count: 0 } };
      var lastAt = mine.reduce(function (mx, e) { return Math.max(mx, Number(e.at) || 0); }, 0);
      return {
        uid: s.uid, name: (s.company && s.company.name) || s.id, status: s.status,
        ratioToSub: Number(s.ratioToSub) || 0,
        gross: r2(pt.subLedger.settledGross), pool: r2(pt.subLedger.pool),
        agreed: r2(pt.subLedger.agreed), retained: r2(pt.subLedger.retained),
        count: pt.subLedger.count, lastAt: lastAt
      };
    }).sort(function (a, b) { return b.agreed - a.agreed || b.gross - a.gross; });
  }

  /* ---------- T4-1 退款 / 冲减统计（冻结期剔除 / 红字 / 特殊冲减） ---------- */
  function refundStats(entries) {
    var out = { refunded: 0, refundAmount: 0, clawed: 0, clawedAmount: 0, redOffset: 0, redOffsetAmount: 0 };
    (entries || []).forEach(function (e) {
      if (!e) return;
      if (e.refunded) { out.refunded++; out.refundAmount = r2(out.refundAmount + (Number(e.refundAmount) || 0)); }
      if (e.clawed) { out.clawed++; out.clawedAmount = r2(out.clawedAmount + (Number(e.refundAmount) || 0)); }
      if (e.redOffset) { out.redOffset++; out.redOffsetAmount = r2(out.redOffsetAmount + (Number(e.redOffset) || 0)); }
    });
    return out;
  }

  /* ---------- T4-1 月度对账单：两分区 + 税列 + 汇总（复用 partitionSubtotals/selfLineAmount） ---------- */
  function monthStatement(entries, month, cfg) {
    var c = cfgOf(cfg);
    var slice = (entries || []).filter(function (e) { return e && e.month === month; });
    var ratio = (c && typeof c._ratio === 'number') ? c._ratio : 0;
    var pt = L() && L().partitionSubtotals
      ? L().partitionSubtotals(slice, Object.assign({}, c, { _ratio: ratio }))
      : { subLedger: { settledGross: 0, pool: 0, agreed: 0, retained: 0, count: 0 }, selfLine: { settledBase: 0, amount: 0, count: 0 } };
    var self = L() && L().selfLineAmount ? L().selfLineAmount(slice, c) : { base: 0, amount: 0 };
    var taxes = slice.filter(function (e) { return e.tax; }).map(function (e) { return e.tax; });
    var taxTotal = taxes.reduce(function (s, t) { return s + (Number(t && t.tax) || 0); }, 0);
    return {
      month: month,
      subLedger: { settledGross: r2(pt.subLedger.settledGross), pool: r2(pt.subLedger.pool), agreed: r2(pt.subLedger.agreed), retained: r2(pt.subLedger.retained), count: pt.subLedger.count },
      selfLine: { settledBase: r2(pt.selfLine.settledBase || self.base), amount: r2(pt.selfLine.amount || self.amount), count: pt.selfLine.count },
      taxes: taxes, taxTotal: r2(taxTotal)
    };
  }

  /* ---------- T4-2 二级本人：冻结到期列表（frozen 且冻结期满将结算） ---------- */
  function frozenDue(entries, cfg, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var c = cfgOf(cfg);
    var days = (typeof c.frozenDays === 'number') ? c.frozenDays : 7;
    return (entries || []).filter(function (e) {
      return e && e.frozenStatus === 'frozen' && !e.refunded
        && (now - (Number(e.at) || 0)) >= days * 864e5;
    }).map(function (e) { return Object.assign({}, e, { dueIn: 0 }); });
  }

  var api = {
    init: init,
    monthlyTrend: monthlyTrend,
    subRank: subRank,
    refundStats: refundStats,
    monthStatement: monthStatement,
    frozenDue: frozenDue
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentInsight = api;
})(typeof window !== 'undefined' ? window : globalThis);
