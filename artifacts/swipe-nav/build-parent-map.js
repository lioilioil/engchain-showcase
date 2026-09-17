/* 归属表推导（只读，不改任何源文件）。
 *
 * 目的：给「左右滑动切页」的右滑=返回 提供每个子页的父页。
 * 不靠人工拍脑袋，从**实际入站链接**里反推：谁链到这一页，谁就是它的候选父页。
 *
 * 输出三样东西：
 *   1. 每页的 title / data-tab / 目录 index 是否存在 / 入站链接者及次数
 *   2. 按「同目录 index 优先」算出的默认父页
 *   3. 无法自动判定的（孤儿页、跨目录歧义页）单独列出来人工定
 *
 * 用法: node artifacts/swipe-nav/build-parent-map.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- 1. 枚举 app 页 ---------- */
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const APP = [
  path.join(ROOT, 'home.html'),
  ...walk(path.join(ROOT, 'pages'), []),
]
  .map(p => path.relative(ROOT, p).split(path.sep).join('/'))
  // 数据播种页没有 .phone 外壳，不参与
  .filter(p => !p.includes('_seed-credit-data'))
  .sort();

const SET = new Set(APP);

/* ---------- 2. 抽取每页的链接目标 ---------- */
/* 路径解析约定（照这个仓库的写法）：
   - 以 ../ ./ 开头        → 相对当前页目录
   - 以 pages/ 或 home.html 开头 → 仓库根相对（源码里都是 __ROOT__ + 这个字面量）
   - 其它裸文件名          → 相对当前页目录 */
function resolve(fromPage, raw) {
  const clean = raw.split('?')[0].split('#')[0].trim();
  if (!clean.endsWith('.html')) return null;
  const dir = path.posix.dirname(fromPage);
  let out;
  if (clean.startsWith('pages/') || clean === 'home.html') out = clean;
  else out = path.posix.normalize(path.posix.join(dir, clean));
  return out.startsWith('pages/') || out === 'home.html' ? out : null;
}

/* 抓 .html 字面量。故意宽：href= / location.href= / replace( / pageTransition.start( /
   以及模板串里的 ${root} 拼接后剩下的 'pages/...' 片段。宁可多抓再人工过，不要漏。 */
const LITERAL = /['"`]([^'"`\n]*?\.html)(?:\?[^'"`\n]*)?['"`]/g;

const pages = {};
for (const p of APP) {
  const src = fs.readFileSync(path.join(ROOT, p), 'utf8');

  const tab = (src.match(/<body[^>]*\bdata-tab="([a-z-]+)"/) || [])[1] || null;
  const title = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || '';

  const out = new Set();
  let m;
  LITERAL.lastIndex = 0;
  while ((m = LITERAL.exec(src))) {
    const r = resolve(p, m[1]);
    if (r && r !== p && SET.has(r)) out.add(r);
  }

  pages[p] = { title, tab, dir: path.posix.dirname(p), links: [...out].sort() };
}

/* ---------- 3. 反向索引：谁链到我 ---------- */
const inbound = {};
for (const p of APP) inbound[p] = {};
for (const p of APP) {
  for (const t of pages[p].links) inbound[t][p] = (inbound[t][p] || 0) + 1;
}

/* ---------- 4. 默认父页：同目录 index 优先 ---------- */
const dirHasIndex = {};
for (const p of APP) {
  const d = pages[p].dir;
  dirHasIndex[d] = SET.has(d + '/index.html');
}

function defaultParent(p) {
  const d = pages[p].dir;
  const idx = d + '/index.html';
  if (d === '.' || d === 'pages') return 'home.html';   // 顶层页回首页
  if (p === idx) return null;                            // index 自己不再套自己
  if (dirHasIndex[d]) return idx;
  return null;                                           // 目录无 index → 需人工定
}

/* ---------- 5. 输出 ---------- */
const rows = [];
for (const p of APP) {
  const inb = Object.entries(inbound[p]).sort((a, b) => b[1] - a[1]);
  rows.push({
    page: p,
    title: pages[p].title.replace(' · 工程链', ''),
    tab: pages[p].tab,
    dir: pages[p].dir,          // 少这个字段时 D 节会把所有页判成「入站全来自别处」
    def: defaultParent(p),
    inb: inb,
  });
}

console.log('=== A. 每页详情（按路径）===');
for (const r of rows) {
  console.log(
    r.page.padEnd(42),
    '[' + (r.tab || '-').padEnd(9) + ']',
    (r.def || '  ??  ').padEnd(32),
    '| ' + r.title.padEnd(12),
    '| 入站: ' + (r.inb.length ? r.inb.map(([k, v]) => k + '(' + v + ')').join(' ') : '（无）')
  );
}

console.log('\n=== B. 默认规则判不出来的（需人工定）===');
const need = rows.filter(r => !r.def);
if (!need.length) console.log('（无）');
for (const r of need) {
  console.log('  ' + r.page.padEnd(42) + ' 入站: '
    + (r.inb.length ? r.inb.map(([k, v]) => k + '(' + v + ')').join(' ') : '（无入站，孤儿页）'));
}

console.log('\n=== C. 孤儿页（全仓库没有任何页面链到它）===');
for (const r of rows) if (!r.inb.length) console.log('  ' + r.page);

console.log('\n=== D. 同目录 index 已有、但入站链接主要来自别处的页（默认规则可能选错父页）===');
for (const r of rows) {
  if (!r.def || r.page.endsWith('/index.html')) continue;
  const sameDir = r.inb.filter(([k]) => path.posix.dirname(k) === r.dir);
  const cross = r.inb.filter(([k]) => path.posix.dirname(k) !== r.dir);
  if (cross.length && !sameDir.length) {
    console.log('  ' + r.page.padEnd(42) + ' 默认→' + r.def.padEnd(30)
      + ' 但入站全来自别处: ' + cross.map(([k, v]) => k + '(' + v + ')').join(' '));
  }
}

console.log('\n共 ' + APP.length + ' 页');
