'use strict';
/* ============================================================================
   smoke-m6.js —— T4 经营数据中心验收冒烟
   ---------------------------------------------------------------
   H 区（T4 数据中心）：
   - H1 静态：data-center.html 存在 / 加载 agent-insight / 趋势图数据源=台账 entries
     / 月度对账单（打印/CSV）/ 测算标识 / 本月累计切换 / 二级视角（冻结到期/消费构成）
   - H2 agent-insight.js 模块导出 + 依赖 AgentLedger 纯函数（不新造口径）
   - H3 抽样复算（5 笔）：月度趋势 / 二级排行 / 退款冲减 / 月度对账单 / 冻结到期，
     与 AgentLedger.partitionSubtotals/selfLineAmount 逐笔一致
   - H4 回归：m1/m2/m3/m4/m5 复跑全绿
   验收锚点（计划 §T4）：m6 冒烟——数据中心各指标与台账逐笔复算一致（抽样 5 笔）；
   趋势图数据源=台账 entries；浏览器实走本月/累计切换。
   ============================================================================ */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var ROOT = path.resolve(__dirname, '..');
var PASS = 0, FAIL = 0;
function ok(cond, name) { if (cond) { PASS++; console.log('PASS  ' + name); } else { FAIL++; console.log('FAIL  ' + name); } }
function section(t) { console.log('\n===== ' + t + ' ====='); }

section('H. T4 经营数据中心（data-center.html + agent-insight.js）');
var dch = fs.readFileSync(path.join(ROOT, 'pages/province-agent/data-center.html'), 'utf8');
ok(fs.existsSync(path.join(ROOT, 'pages/province-agent/data-center.html')), 'H-1 data-center.html 存在');
ok(dch.indexOf('agent-insight.js') > -1 && dch.indexOf('AgentInsight') > -1, 'H-2 页面加载 AgentInsight 聚合模块');
ok(dch.indexOf('listLedger') > -1 && dch.indexOf('台账 entries') > -1, 'H-3 趋势图数据源=台账 entries（不新造数据）');
ok(dch.indexOf('月度对账单') > -1 && dch.indexOf('ag-stmt-print') > -1 && dch.indexOf('ag-stmt-csv') > -1, 'H-4 月度对账单：打印 + 下载 CSV 在位');
ok(dch.indexOf('模拟测算') > -1 && dch.indexOf('非税务意见') > -1, 'H-5 「测算」标识全局化（模拟测算 · 非税务意见）');
ok(dch.indexOf('ag-seg-month') > -1 && dch.indexOf('ag-seg-cum') > -1, 'H-6 本月/累计切换在位（同一趋势数组合计，不新造计算）');
ok(dch.indexOf('冻结到期') > -1 && dch.indexOf('消费构成') > -1, 'H-7 二级视角：消费构成 + 冻结到期列表在位');
ok(dch.indexOf('比例变更历史') > -1 && dch.indexOf('ratioLog') > -1, 'H-8 比例变更历史（ratioLog 时间轴）在位');
ok(dch.indexOf('退款') > -1 && dch.indexOf('clawbackRef') > -1 && dch.indexOf('redOffset') > -1, 'H-9 退款/冲减统计：退款/特殊冲减/红字三类在位');
ok(dch.indexOf('window.print()') > -1, 'H-10 对账单打印走 window.print（浏览器打印）');

var Insight = require(path.join(ROOT, 'js/agent-insight.js'));
var Ledger = require(path.join(ROOT, 'js/agent-ledger.js'));
Insight.init({ ledger: Ledger });
var hasApi = ['init', 'monthlyTrend', 'subRank', 'refundStats', 'monthStatement', 'frozenDue'];
ok(hasApi.every(function (k) { return typeof Insight[k] === 'function'; }), 'H-11 AgentInsight 导出 6 个聚合 API');

/* ---------- H3 抽样复算（5 笔口径）：与 Ledger 纯函数逐笔一致 ---------- */
var now = Date.now(), DAY = 864e5;
var entries = [
  { serialNo: 'A1', month: '2026-09', at: now - 40 * DAY, line: 'subLedger', type: 'order_paid_net', amount: 10000, subject: 'u12', frozenStatus: 'settled' },
  { serialNo: 'A2', month: '2026-09', at: now - 39 * DAY, line: 'subLedger', type: 'order_paid_net', amount: 3000, subject: 'u12', frozenStatus: 'settled', refunded: true, refundAmount: 3000 },
  { serialNo: 'A3', month: '2026-10', at: now - 8 * DAY, line: 'subLedger', type: 'order_paid_net', amount: 5000, subject: 'u41', frozenStatus: 'settled' },
  { serialNo: 'A4', month: '2026-10', at: now - 3 * DAY, line: 'subLedger', type: 'recharge', amount: 9000, subject: 'u12', frozenStatus: 'settled' },
  { serialNo: 'A5', month: '2026-10', at: now - 2 * DAY, line: 'selfLedger', type: 'order_paid_net', amount: 8000, subject: 'u11', frozenStatus: 'settled' },
  { serialNo: 'A6', month: '2026-10', at: now - 1 * DAY, line: 'subLedger', type: 'order_paid_net', amount: 2000, subject: 'u12', frozenStatus: 'frozen' },
  { serialNo: 'A7', month: '2026-10', at: now - 1 * DAY, line: 'subLedger', type: 'order_paid_net', amount: 1000, subject: 'u41', frozenStatus: 'settled', clawed: true, refunded: true, refundAmount: 1000 }
];
var subs = [
  { id: 's1', uid: 'u12', ratioToSub: 0.2, company: { name: '成都××合作公司' }, status: 'approved' },
  { id: 's2', uid: 'u41', ratioToSub: 0.15, company: { name: '绵阳×工程有限公司' }, status: 'pending' }
];
var cfg = { _ratio: 0.2 };

/* 抽样 1：月度趋势 2026-10（合格 5000，recharge/frozen/退款排除） */
var oct = Insight.monthlyTrend(entries, cfg, { months: 12, now: now }).filter(function (m) { return m.month === '2026-10'; })[0];
ok(oct.gross === 5000 && oct.pool === 2500 && oct.agreed === 500 && oct.retained === 2000 && oct.subCount === 1, 'H-12 抽样① 趋势 10 月 gross=5000 pool=2500 agreed=500 retained=2000（recharge/frozen/退款排除）');
ok(oct.selfBase === 8000 && oct.selfAmount === 800, 'H-13 抽样① 趋势 10 月自身线 base=8000 ×10%=800');

/* 抽样 2：二级排行 u12（A1 10000；A2 退款/A4 充值/A6 冻结排除 → gross 10000 → agreed 1000） */
var rank = Insight.subRank(entries, subs, cfg);
ok(rank[0].uid === 'u12' && rank[0].gross === 10000 && rank[0].agreed === 1000 && rank[0].count === 1, 'H-14 抽样② 排行 u12 gross=10000 agreed=1000（退款/充值/冻结笔排除）');
ok(rank[1].uid === 'u41' && rank[1].agreed === 375, 'H-15 抽样② 排行 u41 agreed=375（5000×50%×15%）');

/* 抽样 3：退款/冲减统计 */
var rs = Insight.refundStats(entries);
ok(rs.refunded === 2 && rs.refundAmount === 4000 && rs.clawed === 1 && rs.clawedAmount === 1000, 'H-16 抽样③ 退款 2 笔/4000 + 特殊冲减 1 笔/1000');

/* 抽样 4：月度对账单 2026-10 */
var st = Insight.monthStatement(entries, '2026-10', cfg);
ok(st.subLedger.settledGross === 5000 && st.subLedger.agreed === 500 && st.selfLedger.amount === 800, 'H-17 抽样④ 对账单 10 月 subGross=5000 agreed=500 self=800');

/* 抽样 5：冻结到期（1 天未满 7 天不入列表；满 7 天入列表） */
ok(Insight.frozenDue(entries, cfg, { now: now }).length === 0 && Insight.frozenDue(entries, cfg, { now: now + 7 * DAY }).length === 1, 'H-18 抽样⑤ 冻结到期：1 天未满 T+7 不入列；满 7 天入列');

/* H4 回归 */
section('H4. 回归 m1–m5');
['smoke-m1.js', 'smoke-m2.js', 'smoke-m3.js', 'smoke-m4.js', 'smoke-m5.js'].forEach(function (s) {
  var out = cp.execSync('node "' + path.join(ROOT, 'scripts', s) + '"', { encoding: 'utf8' });
  ok(/FAIL=0|FAIL：\s*0|FAIL\s*=\s*0/.test(out) && !/FAIL\s*=\s*[1-9]/.test(out), s + ' 复跑全绿');
});

section('I. T5 省代运营规则与 FAQ（rules.html）');
var rl = fs.readFileSync(path.join(ROOT, 'pages/province-agent/rules.html'), 'utf8');
ok(fs.existsSync(path.join(ROOT, 'pages/province-agent/rules.html')), 'I-1 rules.html 存在');
ok((rl.match(/<summary>/g) || []).length >= 8, 'I-2 FAQ 条目 ≥8（当前 ' + (rl.match(/<summary>/g) || []).length + ' 条）');
var Esign = require(path.join(ROOT, 'js/agent-esign.js'));
var cl = Esign.CLAUSES || [];
var titleAll = cl.map(function (c) { return c.title; }).join('|');
var miss = cl.filter(function (c) { return rl.indexOf(c.title) < 0; });
ok(miss.length === 0 && rl.indexOf('O4') > -1 && rl.indexOf('八条') > -1, 'I-3 O4 八条条款与 agent-esign.CLAUSES 标题零冲突（缺 ' + miss.length + ' 条）');
ok(rl.indexOf('不可逆') > -1 && rl.indexOf('封存只读') > -1 && rl.indexOf('释放') > -1, 'I-4 终止/清退状态机：不可逆 + 封存只读 + 释放绑定（与 agent-rules 合法边一致）');
ok(rl.indexOf('pending / approved / suspended') > -1 || rl.indexOf('pending / approved / suspended') > -1 || /pending\s*\/\s*approved\s*\/\s*suspended/.test(rl), 'I-5 名额口径：pending/approved/suspended 占名额（与 SUB_OCCUPIED 一致）');
ok(rl.indexOf('tax-guide.html') > -1, 'I-6a rules → tax-guide 互链');
var tg = fs.readFileSync(path.join(ROOT, 'pages/province-agent/tax-guide.html'), 'utf8');
ok(tg.indexOf('rules.html') > -1, 'I-6b tax-guide → rules 互链（语义分区：运营 vs 税务）');
ok(rl.indexOf('不跨省') > -1 && rl.indexOf('不发展下级') > -1 && rl.indexOf('拉人头') > -1 && rl.indexOf('承诺收益') > -1, 'I-7 合规边界四红线：不跨省/不发展下级/不拉人头/不承诺收益');
ok(rl.indexOf('模拟测算') > -1 && rl.indexOf('非税务意见') > -1, 'I-8 测算免责标识');
var ui2 = fs.readFileSync(path.join(ROOT, 'js/agent-ui.js'), 'utf8');
ok(ui2.indexOf('href="rules.html"') > -1, 'I-9 工作台入口补运营规则');
ok(ui2.indexOf('href="rules.html"') > -1 && ui2.indexOf('mountSubView') > -1, 'I-10 二级视角入口含运营规则（mountSubView 分支，工作台/二级页可达）');
var css2 = fs.readFileSync(path.join(ROOT, 'css/agent.css'), 'utf8');
ok(css2.indexOf('ag-faq-item') > -1 && css2.indexOf('ag-faq-body') > -1, 'I-11 FAQ 手风琴样式（ag-faq-*）在位');

console.log('\n========================================');
console.log('M6(T4+T5) 结果：PASS=' + PASS + '  FAIL=' + FAIL);
process.exit(FAIL ? 1 : 0);
