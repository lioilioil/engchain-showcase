/* 归属表生成器（只读，不改任何源文件）。
 *
 * 把 parent-map.md 里已确认的规则 + 显式条目，算成可粘贴进 js/swipe-nav.js 的数据。
 * 和 build-parent-map.js 的区别：那个是「推导 + 让人看」，这个是「落地 + 自证覆盖」。
 *
 * 用法: node artifacts/swipe-nav/gen-parent-map.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- 1. 枚举 app 页（与 build-parent-map.js 同口径） ---------- */
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}
const APP = [path.join(ROOT, 'home.html'), ...walk(path.join(ROOT, 'pages'), [])]
  .map(p => path.relative(ROOT, p).split(path.sep).join('/'))
  .filter(p => !p.includes('_seed-credit-data'))
  .sort();
const SET = new Set(APP);

/* ---------- 2. 5 个主站页（站序环游，无父页） ---------- */
const STATIONS = [
  'home.html',
  'pages/supply/list.html',
  'pages/message/index.html',
  'pages/profile/index.html',
  'pages/publish/index.html',
];

/* ---------- 3. 有 index.html 的目录（R1 默认规则的作用域） ---------- */
const INDEX_DIRS = [...new Set(
  APP.filter(p => p.endsWith('/index.html')).map(p => path.posix.dirname(p))
)].sort();

/* ---------- 4. 显式条目（parent-map.md 已确认） ---------- */
const OVERRIDE = {
  /* R2 区段首页（目录 index 自身） */
  'pages/wallet/index.html': 'pages/profile/index.html',
  'pages/order/index.html': 'pages/profile/index.html',
  'pages/distribution/index.html': 'pages/profile/index.html',
  'pages/agency/index.html': 'home.html',
  'pages/franchise/index.html': 'home.html',
  'pages/search/index.html': 'home.html',

  /* R3 目录无 index / 顶层区段 */
  'pages/trade/index.html': 'pages/supply/list.html',
  'pages/personnel/index.html': 'pages/supply/list.html',
  'pages/refund/index.html': 'pages/profile/index.html',
  'pages/refund/appeal.html': 'pages/refund/index.html',
  'pages/agreement/privacy.html': 'pages/profile/settings.html',
  'pages/agreement/user.html': 'pages/profile/settings.html',
  'pages/auth/register.html': 'pages/auth/login.html',
  'pages/auth/banned.html': 'pages/auth/login.html',
  'pages/match/preferences.html': 'pages/profile/all-functions.html',
  'pages/platform/dashboard.html': 'pages/profile/index.html',
  'pages/vendor/dashboard.html': 'pages/profile/all-functions.html',
  'pages/vendor/upgrades.html': 'pages/profile/all-functions.html',
  'pages/api/index.html': 'pages/profile/all-functions.html',
  'pages/industry/index.html': 'pages/profile/all-functions.html',
  'pages/personal/index.html': 'pages/publish/index.html',
  'pages/favorite/index.html': 'pages/profile/index.html',
  'pages/help/index.html': 'pages/profile/index.html',
  'pages/co-create/index.html': 'home.html',
  'pages/guide/index.html': 'home.html',
  'pages/monitor/index.html': 'home.html',

  /* 例外：R1 默认规则判错的页 */
  'pages/agency/demo-reset.html': 'pages/profile/index.html',
  'pages/supply/detail.html': 'pages/supply/list.html',
};

/* ---------- 5. 多入口页：固定父页必然回错地方 → 改走 UI.back() ---------- */
const USE_HISTORY = [
  'pages/supply/detail.html',
  'pages/auth/login.html',
  'pages/company/index.html',
  'pages/search/business.html',
];
/* company/index 与 search/business 不在 OVERRIDE 里（它们改走历史了），
   auth/login 的显式父页（home.html）保留 —— register/banned 右滑落到 login 时用得上。 */
OVERRIDE['pages/auth/login.html'] = 'home.html';
OVERRIDE['pages/company/index.html'] = 'pages/supply/list.html';
OVERRIDE['pages/search/business.html'] = 'pages/search/index.html';

/* ---------- 6. 解析每一页的父页 ---------- */
function resolveParent(p) {
  if (STATIONS.includes(p)) return null;            // 站序页由站序环游决定
  if (OVERRIDE[p]) return OVERRIDE[p];
  const dir = path.posix.dirname(p);
  if (dir === '.' || dir === 'pages') return 'home.html';
  if (p === dir + '/index.html') return null;        // 不该发生：index 页都有显式条目
  if (INDEX_DIRS.includes(dir)) return dir + '/index.html';   // R1
  return null;                                       // 无父页 → 右滑橡皮筋
}

const resolved = {};
const orphans = [];
for (const p of APP) {
  const par = resolveParent(p);
  resolved[p] = par;
  if (par === null && !STATIONS.includes(p)) orphans.push(p);
}

/* ---------- 7. 自证 ---------- */
const badTarget = Object.entries(resolved)
  .filter(([, v]) => v && !SET.has(v))
  .map(([k, v]) => k + ' → ' + v);
if (badTarget.length) {
  console.log('!!! 父页指向了不存在的页面：\n  ' + badTarget.join('\n  '));
  process.exit(1);
}

console.log('=== 统计 ===');
console.log('总页数            ' + APP.length);
console.log('站序页            ' + STATIONS.length);
console.log('有父页（固定）    ' + Object.values(resolved).filter(Boolean).length);
console.log('其中走 UI.back()  ' + USE_HISTORY.length);
console.log('索引目录 R1 覆盖  ' + Object.entries(resolved).filter(([k, v]) =>
  v && !OVERRIDE[k] && !STATIONS.includes(k)).length);
console.log('显式条目          ' + Object.keys(OVERRIDE).length);
console.log('无父页（右滑橡皮筋）' + (orphans.length ? orphans.length + ' → ' + orphans.join(', ') : ' 0'));

console.log('\n=== INDEX_DIRS（' + INDEX_DIRS.length + '）===');
console.log(JSON.stringify(INDEX_DIRS, null, 0));

console.log('\n=== USE_HISTORY（' + USE_HISTORY.length + '）===');
console.log(JSON.stringify(USE_HISTORY, null, 0));

console.log('\n=== 全量解析（对照 parent-map.md）===');
for (const p of APP) {
  const tag = STATIONS.includes(p) ? '站序'
    : USE_HISTORY.includes(p) ? 'back()'
    : OVERRIDE[p] ? '显式'
    : '  R1  ';
  console.log('  ' + tag + '  ' + p.padEnd(40) + ' → ' + (resolved[p] || '—'));
}

console.log('\n=== 供粘贴的 OVERRIDE（不含纯 R1 页）===');
const paste = {};
for (const p of Object.keys(OVERRIDE).sort()) {
  if (USE_HISTORY.includes(p)) continue;   // 这几个改走历史，运行时不需要固定父页
  paste[p] = OVERRIDE[p];
}
console.log(JSON.stringify(paste, null, 2));
