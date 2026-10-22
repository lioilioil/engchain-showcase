/* ============================================================================
   js/agent-ledger.js —— M3-2 台账引擎 / M3-3 两分区 / M3-6 比例校验 / M3-5 CSV
   ----------------------------------------------------------------------------
   规则（v0.5 §3.3 / §3.6 / D9/D10/D12/D21/D26，仅测算，不写 BalanceStore、不可提现）：
   - 计入总盘消费（闭合枚举）：订单成交实付净额 / 积分解锁实付 / 增值服务实付；
     不计入：钱包充值、免费积分面值、入驻认证规费、退款/冲减笔；充值与消费各计一次。
   - T+7 冻结（frozenDays=7 自然日）：消费先入 frozen，满 7 日无退款转 settled；冻结期退款直接剔除。
   - 总盘 = 二级 settled 真实消费实付合计 ×50%（grossShare=0.5）。
   - 拆分：二级约定所得=总盘×约定比例(0–50%)；总代自留=总盘−约定所得；0%=全自留。
   - 退款三层：①冻结期退款剔除；②出冻结正常退款先冲当月红字、不足转次月、部分按比例、无挂账；
     ③后台特殊退款 clawbackRef 等额冲减。两线独立冲减不交叉。
   - 自身收益线（D26 10%）：总代自身 settled 消费 × selfRate(0.10)，独立分区，不与二级线相加。
   - 比例 0–50% 校验，超界拦截不留存；ratioLog 追加留痕；比例不改写总盘。
   浏览器 → window.AgentLedger；node → module.exports（纯函数，可注入 config）。
   ============================================================================ */
(function (root) {
  'use strict';

  var DAY = 864e5;

  var DEFAULTS = {
    frozenDays: 7,
    selfRate: 0.10,
    grossShare: 0.5,
    ratioRange: { min: 0, max: 0.5 },
    eligibleTypes: ['order_paid_net', 'points_unlock_paid', 'value_added_paid'],
    excludedTypes: ['recharge', 'free_points', 'entry_fee', 'refund_reversal']
  };

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function monthKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function resolveCfg(over) {
    var c = JSON.parse(JSON.stringify(DEFAULTS));
    over = over || {};
    ['frozenDays', 'selfRate', 'grossShare'].forEach(function (k) { if (typeof over[k] === 'number') c[k] = over[k]; });
    if (over.ratioRange) c.ratioRange = Object.assign({}, c.ratioRange, over.ratioRange);
    if (Array.isArray(over.eligibleTypes)) c.eligibleTypes = over.eligibleTypes;
    if (Array.isArray(over.excludedTypes)) c.excludedTypes = over.excludedTypes;
    return c;
  }

  /* ---------- M3-2 白名单：是否计入总盘消费 ---------- */
  function isEligibleConsumption(type, cfg) {
    cfg = resolveCfg(cfg);
    return cfg.eligibleTypes.indexOf(type) >= 0;
  }
  function isExcludedType(type, cfg) {
    cfg = resolveCfg(cfg);
    return cfg.excludedTypes.indexOf(type) >= 0;
  }

  /* ---------- T+7 冻结：给定当前时间，frozen 是否可转 settled ---------- */
  function settleDue(entry, now, cfg) {
    cfg = resolveCfg(cfg);
    if (!entry || entry.frozenStatus !== 'frozen') return false;
    var born = Number(entry.at) || 0;
    return now >= born + cfg.frozenDays * DAY;
  }

  /* ---------- M3-2 总盘：仅 settled 合格消费 ×50% ---------- */
  function settledConsumptions(entries, cfg) {
    cfg = resolveCfg(cfg);
    return (entries || []).filter(function (e) {
      return e.frozenStatus === 'settled' && e.line === 'subLedger' &&
        isEligibleConsumption(e.type, cfg) && !e.clawed && !e.refunded;
    });
  }
  function buildPool(entries, cfg) {
    cfg = resolveCfg(cfg);
    var gross = r2(settledConsumptions(entries, cfg).reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0));
    return { gross: gross, pool: r2(gross * cfg.grossShare) };
  }

  /* ---------- M3-2 拆分：总盘 × 约定比例；0% 全自留；比例不改写总盘 ---------- */
  function splitPool(pool, ratio, cfg) {
    cfg = resolveCfg(cfg);
    var v = validateRatio(ratio, cfg);
    if (!v.ok) return v;
    var p = r2(Number(pool) || 0);
    var agreed = r2(p * v.value);
    var retained = r2(p - agreed);
    return { ok: true, ratio: v.value, pool: p, agreed: agreed, retained: retained };
  }

  /* ---------- M3-6 比例校验 0–50%，超界拦截（不留存由调用方保证） ---------- */
  function validateRatio(ratio, cfg) {
    cfg = resolveCfg(cfg);
    if (ratio === '' || ratio === null || ratio === undefined) return { ok: false, code: 'E_RATIO_EMPTY', msg: '比例必填' };
    var r = Number(ratio);
    if (!isFinite(r)) return { ok: false, code: 'E_RATIO_EMPTY', msg: '比例必填' };
    if (r < cfg.ratioRange.min || r > cfg.ratioRange.max) {
      return { ok: false, code: 'E_RATIO_OUT_OF_RANGE', msg: '约定比例须在 0–50% 之间，超界不留存' };
    }
    return { ok: true, value: r };
  }

  /* ---------- M3-3 自身线：自身 settled 消费 × selfRate，独立分区 ---------- */
  function selfLineAmount(entries, cfg) {
    cfg = resolveCfg(cfg);
    var base = (entries || []).filter(function (e) {
      return e.line === 'selfLedger' && e.frozenStatus === 'settled' &&
        isEligibleConsumption(e.type, cfg) && !e.refunded;
    }).reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
    return { base: r2(base), amount: r2(base * cfg.selfRate) };
  }

  /* ---------- M3-3 两分区独立小计（不相加、不互补贴） ---------- */
  function partitionSubtotals(entries, cfg) {
    var ratioIn = (cfg && typeof cfg._ratio === 'number') ? cfg._ratio : 0;
    cfg = resolveCfg(cfg);
    var sub = { line: 'subLedger', settledGross: 0, pool: 0, agreed: 0, retained: 0, count: 0 };
    var self = { line: 'selfLedger', settledBase: 0, amount: 0, count: 0 };
    (entries || []).forEach(function (e) {
      if (e.frozenStatus !== 'settled' || e.refunded) return;
      if (e.line === 'subLedger' && isEligibleConsumption(e.type, cfg)) {
        sub.settledGross = r2(sub.settledGross + (Number(e.amount) || 0));
        sub.count++;
      } else if (e.line === 'selfLedger' && isEligibleConsumption(e.type, cfg)) {
        self.settledBase = r2(self.settledBase + (Number(e.amount) || 0));
        self.count++;
      }
    });
    sub.pool = r2(sub.settledGross * cfg.grossShare);
    var ratio = Number(ratioIn) || 0;
    sub.agreed = r2(sub.pool * ratio);
    sub.retained = r2(sub.pool - sub.agreed);
    self.amount = r2(self.settledBase * cfg.selfRate);
    return { subLedger: sub, selfLedger: self };
  }

  /* ---------- M3-2 退款三层（纯函数：返回新 entries，不原地改） ----------
     ①冻结期退款 → 剔除（标记 refunded，不计入）；
     ②出冻结正常退款 → 先冲当月 settled 红字，不足转次月，部分按比例，无挂账；
     ③clawbackRef 等额冲减指定笔。两线独立冲减不交叉。 */
  function applyRefund(entries, refund, cfg) {
    cfg = resolveCfg(cfg);
    var list = (entries || []).map(function (e) { return JSON.parse(JSON.stringify(e)); });
    var remaining = r2(Number(refund.amount) || 0);
    var rMonth = monthKey(refund.at || Date.now());
    var line = refund.line || 'subLedger';

    /* ③特殊退款：按 clawbackRef 等额冲减指定笔 */
    if (refund.clawbackRef) {
      var target = list.filter(function (e) { return e.serialNo === refund.clawbackRef && e.line === line; })[0];
      if (target) {
        target.clawed = true;
        target.clawbackOf = refund.clawbackRef;
        target.refunded = true;
        target.refundAmount = r2(target.refundAmount || 0) + remaining;
        return { ok: true, entries: list, offset: remaining, hung: 0 };
      }
    }

    /* ①冻结期退款剔除：同线同笔号或冻结笔直接剔除 */
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (remaining <= 0) break;
      if (e.line !== line || e.refunded) continue;
      if (e.frozenStatus === 'frozen' && (!refund.refOf || e.serialNo === refund.refOf)) {
        e.refunded = true; e.refundAmount = r2(e.refundAmount || 0) + (Number(e.amount) || 0);
        remaining = r2(remaining - (Number(e.amount) || 0));
      }
    }

    /* ②出冻结：先冲当月红字，不足转次月，部分按比例，无挂账 */
    var settled = list.filter(function (e) {
      return e.line === line && e.frozenStatus === 'settled' && !e.refunded;
    }).sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    for (var j = 0; j < settled.length && remaining > 0; j++) {
      var s = settled[j];
      var m = monthKey(s.at);
      var take = Math.min(remaining, Number(s.amount) || 0);
      s.redOffset = r2((s.redOffset || 0) + take);
      s.refunded = take >= (Number(s.amount) || 0);
      s.refundAmount = r2(s.refundAmount || 0) + take;
      s.offsetMonth = m === rMonth ? 'current' : 'next';
      remaining = r2(remaining - take);
    }
    return { ok: true, entries: list, offset: r2((Number(refund.amount) || 0) - remaining), hung: remaining };
  }

  /* ---------- M3-5 CSV 字段齐套（当前月两分区；空台账导表头） ---------- */
  var CSV_HEADERS = ['流水号', '时间', '主体', '类型', '金额', '订单号', '冻结状态', '冲减记录', '税项', '余额', '税前', '预扣率', '预扣税额', '税后实发', '税单号'];
  function toCsv(entries, month, opts) {
    opts = opts || {};
    var rows = [CSV_HEADERS.join(',')];
    (entries || []).forEach(function (e) {
      if (month && monthKey(e.at) !== month) return;
      if (opts.line && e.line !== opts.line) return;
      var tax = e.tax || {};
      var cells = [
        e.serialNo || '', isoDate(e.at), e.subject || '', e.type || '',
        num(e.amount), e.orderNo || '', e.frozenStatus || '',
        (e.redOffset ? '红字冲减' + e.redOffset : '') + (e.clawed ? ';clawback:' + e.clawbackOf : ''),
        tax.scheme || '', num(e.balanceAfter),
        num(tax.gross), tax.rate != null ? (tax.rate * 100 + '%') : '',
        num(tax.tax), num(tax.net), tax.certNo || ''
      ];
      rows.push(csvRow(cells));
    });
    return rows.join('\n');
  }
  function isoDate(ts) { var d = new Date(ts || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function num(n) { return (Number(n) || 0).toFixed(2); }
  function csvRow(cells) {
    return cells.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
  }

  var api = {
    DAY: DAY,
    DEFAULTS: DEFAULTS,
    resolveCfg: resolveCfg,
    isEligibleConsumption: isEligibleConsumption,
    isExcludedType: isExcludedType,
    settleDue: settleDue,
    settledConsumptions: settledConsumptions,
    buildPool: buildPool,
    splitPool: splitPool,
    validateRatio: validateRatio,
    selfLineAmount: selfLineAmount,
    partitionSubtotals: partitionSubtotals,
    applyRefund: applyRefund,
    toCsv: toCsv,
    CSV_HEADERS: CSV_HEADERS,
    round2: r2,
    monthKey: monthKey
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentLedger = api;
})(typeof window !== 'undefined' ? window : globalThis);
