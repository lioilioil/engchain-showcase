'use strict';
/* ============================================================================
   smoke-m7.js —— T6 全量终验冒烟（红线逐项核验 + 六冒烟回归）
   ---------------------------------------------------------------
   J 区（红线 11 项逐条核验，锚点 = 计划 §8）：
     R1 费率零改 / R2 税算零改 / R3 结算不可提现零改 / R4 O4 八条零改
     R5 门控零改 / R6 数据域隔离 / R7 冒烟基线零回退 / R8 文案合规
     R9 结构红线（两层授权） / R10 契约前置（先签后开） / R11 招商绑定隔离
   K 区（回归）：m1–m6 六冒烟复跑全绿，且 m1=96/m2=117/m3=128/m4=156 基线精确值
   ============================================================================ */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var ROOT = path.resolve(__dirname, '..');
var PASS = 0, FAIL = 0;
function ok(cond, name) { if (cond) { PASS++; console.log('PASS  ' + name); } else { FAIL++; console.log('FAIL  ' + name); } }
function section(t) { console.log('\n===== ' + t + ' ====='); }

section('J. 红线 11 项逐条核验（计划 §8）');
var Ledger = require(path.join(ROOT, 'js/agent-ledger.js'));
var Rules = require(path.join(ROOT, 'js/agent-rules.js'));

/* R1 费率零改 */
var D = Ledger.DEFAULTS || {};
ok(D.grossShare === 0.5 && D.selfRate === 0.1 && D.frozenDays === 7, 'R1 费率零改：grossShare=0.5 selfRate=0.1 frozenDays=7（一字未动）');
ok(D.ratioRange.min === 0 && D.ratioRange.max === 0.5, 'R1 费率零改：ratio 0–50%（含两端）');
ok(Array.isArray(D.eligibleTypes) && D.eligibleTypes.length === 3 && D.excludedTypes.length === 4, 'R1 费率零改：合格/排除白名单未增删');

/* R2 税算零改 */
var taxSrc = fs.readFileSync(path.join(ROOT, 'js/agent-tax.js'), 'utf8');
ok(taxSrc.indexOf('threshold: 4000, fixed: 800, pct: 0.2') > -1, 'R2 税算零改：labor ≤4000 减 800 / >4000 减 20%');
ok(taxSrc.indexOf('deemedLevyRate: null') > -1 && taxSrc.indexOf('禁1%') > -1, 'R2 税算零改：deemedLevyRate=null 禁 1%');
ok(taxSrc.indexOf('rate: 0.20, quick: 0') > -1 && taxSrc.indexOf('rate: 0.30, quick: 2000') > -1 && taxSrc.indexOf('rate: 0.40, quick: 7000') > -1, 'R2 税算零改：预扣率表二 20/30/40% 速算 0/2000/7000');

/* R3 结算不可提现零改（诱导式检测：否定/说明式「不可提现/不构成返佣/到账等表述」放行；
   词库/主题注释等代码区（<script>）不参与扫描；「返佣体系/原返佣」等概念性提及放行） */
function induceHits(src) {
  src = src.replace(/<script[\s\S]*?<\/script>/g, ''); /* 剥代码区（BANNED 词库/注释） */
  var hits = [];
  var re = /可提现|返佣|到账|承诺收益|收益保证|稳赚|保底|躺赚|日入|月入|拉人头|入门费/g, m;
  while ((m = re.exec(src))) {
    var pre = src.slice(Math.max(0, m.index - 14), m.index);
    if (/不|无|禁|免|勿|非|未|请|否|拒绝|违规/.test(pre)) continue; /* 否定/警示语境放行 */
    if (m[0] === '返佣' && /返佣(?:体系|佣金体系|数据)|原返佣|分销返佣|个人合伙人返佣|返佣是/.test(src.slice(Math.max(0, m.index - 6), m.index + 8))) continue; /* 概念性/解释性提及放行 */
    hits.push(m[0]);
  }
  return hits;
}
var pages = ['recruit', 'apply', 'network', 'data-center', 'rules'];
var pageText = {};
pages.forEach(function (p) {
  var f = path.join(ROOT, 'pages/province-agent', p + '.html');
  pageText[p] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
});
var induceBad = [];
pages.forEach(function (p) { var h = induceHits(pageText[p]); if (h.length) induceBad.push(p + ':' + h.join('/')); });
ok(induceBad.length === 0, 'R3 结算不可提现零改：新页面无诱导式「可提现/到账/返佣/收益保证」' + (induceBad.length ? ' → ' + induceBad.join('，') : ''));
var uiSrc = fs.readFileSync(path.join(ROOT, 'js/agent-ui.js'), 'utf8');
ok(uiSrc.indexOf('BalanceStore') === -1, 'R3 结算不可提现零改：agent-ui 不写 BalanceStore');

/* R4 O4 八条零改（与基线断言同源，agent-esign.CLAUSES 未被改） */
var Esign = require(path.join(ROOT, 'js/agent-esign.js'));
ok((Esign.CLAUSES || []).length === 8, 'R4 O4 八条零改：CLAUSES 仍为 8 条');
ok((Esign.VERSION || '') === 'v1.0.0', 'R4 O4 八条零改：VERSION=v1.0.0 未变');

/* R5 门控零改 */
var ref = fs.readFileSync(path.join(ROOT, 'js/agent-referral.js'), 'utf8');
ok(ref.indexOf('E_NOT_PROVINCE_AGENT') > -1 && ref.indexOf('status') > -1, 'R5 门控零改：招商仅对在册总代开放（recruit 门控保留）');
ok(ref.indexOf("setItem('engchain-referral-links')") === -1 && ref.indexOf("getItem('engchain-referral-links')") === -1, 'R5 门控零改：agent-referral 无 Referral 键实际读写（隔离声明仅注释）');

/* R6 数据域隔离（实际读写检测，注释声明放行） */
var rwBad = [];
['agent-referral', 'agent-apply', 'agent-insight'].forEach(function (m) {
  var s = fs.readFileSync(path.join(ROOT, 'js', m + '.js'), 'utf8');
  if (/setItem\(["']engchain-referral-links|getItem\(["']engchain-referral-links/.test(s)) rwBad.push(m + ':读写 Referral 键');
});
ok(rwBad.length === 0, 'R6 数据域隔离：新模块零实际读写 Referral 键（engchain-agent-* 独立域）' + (rwBad.length ? ' → ' + rwBad.join('，') : ''));

/* R7 冒烟基线零回退：m1–m4 精确值核验 */
function runSum(s) {
  var out = cp.execSync('node "' + path.join(ROOT, 'scripts', s) + '"', { encoding: 'utf8' });
  var m = null, re = /PASS\s*[:：=]?\s*(\d+)\s+FAIL\s*[:：=]?\s*(\d+)/g, t;
  while ((t = re.exec(out))) m = { pass: +t[1], fail: +t[2] }; /* 取最后一个（脚本可能内嵌回归输出） */
  return m;
}
var base = { 'smoke-m1.js': 96, 'smoke-m2.js': 117, 'smoke-m3.js': 128, 'smoke-m4.js': 158 };
var baseBad = [];
Object.keys(base).forEach(function (s) {
  var r = runSum(s);
  if (!r || r.fail !== 0 || r.pass !== base[s]) baseBad.push(s + ' 期望 ' + base[s] + ' 实际 ' + (r ? r.pass : 'null'));
});
ok(baseBad.length === 0, 'R7 冒烟基线零回退：m1=96 / m2=117 / m3=128 / m4=158 精确值全绿' + (baseBad.length ? ' → ' + baseBad.join('，') : ''));

/* R8 文案合规：禁诱导（诱导式检测）+ 必含测算免责 / 平台零支出声明 */
var pgBad = [];
pages.forEach(function (p) {
  var s = pageText[p];
  if (induceHits(s).length) pgBad.push(p + ':诱导词');
  if (!/(模拟测算|内部测算|非税务意见)/.test(s)) pgBad.push(p + ':缺测算免责');
  if ((p === 'rules' || p === 'data-center' || p === 'network') && !/(平台零支出|平台不付款|不付款、不开票)/.test(s)) pgBad.push(p + ':缺平台零支出/不付款声明');
});
ok(pgBad.length === 0, 'R8 文案合规：新页面无诱导词 + 必含「模拟测算/非税务意见/平台零支出」' + (pgBad.length ? ' → ' + pgBad.join('，') : ''));

/* R9 结构红线：两层授权，无第三层（network 声明「二级不可再发展下级」，语义与 O4 第 2 条一致） */
var netSrc = fs.readFileSync(path.join(ROOT, 'pages/province-agent/network.html'), 'utf8');
ok(netSrc.indexOf('ag-net-root') > -1 && netSrc.indexOf('ag-net-sub') > -1 && netSrc.indexOf('发展下级') > -1, 'R9 结构红线：网络视图两层授权（总代根→二级）+ 明确不得发展下级');
ok(netSrc.indexOf('ag-net-sub') !== -1 && /ag-net-sub[^>]*>\s*<[^>]*ag-net-sub/.test(netSrc) === false, 'R9 结构红线：无第三层渲染结构');

/* R10 契约前置：未签不开通分账展示 */
var ui2 = fs.readFileSync(path.join(ROOT, 'js/agent-ui.js'), 'utf8');
ok(ui2.indexOf('协议待发起') > -1 || ui2.indexOf('未签约') > -1, 'R10 契约前置：未签二级展示「协议待发起」（先签后开）');
var net2 = fs.readFileSync(path.join(ROOT, 'pages/province-agent/network.html'), 'utf8');
ok(net2.indexOf('已签') > -1 && net2.indexOf('待签') > -1, 'R10 契约前置：网络视图协议状态区分已签/待签（未签不开通分账展示）');

/* R11 招商绑定隔离（对照审计新增第 11 条） */
ok(ref.indexOf("'engchain-agent-invites'") > -1 && ref.indexOf("'engchain-agent-invite-logs'") > -1, 'R11 招商绑定隔离：招商码落独立键 engchain-agent-invites（不写 Referral 键）');

section('K. 六冒烟回归（m1–m6）');
['smoke-m1.js', 'smoke-m2.js', 'smoke-m3.js', 'smoke-m4.js', 'smoke-m5.js', 'smoke-m6.js'].forEach(function (s) {
  var r = runSum(s);
  ok(r && r.fail === 0, s + ' 复跑全绿（PASS=' + (r ? r.pass : 'null') + '）');
});

console.log('\n========================================');
console.log('M7(T6 终验) 结果：PASS=' + PASS + '  FAIL=' + FAIL);
process.exit(FAIL ? 1 : 0);
