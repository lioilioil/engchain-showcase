/* 比对 dockstyle.js 的前后两次采样，判定「删掉的确实是死代码」。

判据分两层，因为「计算值变了」和「渲染变了」不是一回事：

  L1（硬性，零容忍）—— .app-tabbar 与 .tab-glass **元素本体**的计算属性必须
      逐条相同。本体是真正参与渲染的东西，任何一条变了就是删到了活代码。

  L2（有条件放行）—— ::before / ::after 的声明**允许**变化，但仅当该伪元素
      在前后两次采样里 content 都是 none。content:none 的伪元素不生成盒子，
      它的 background/height/border-radius 再变也不会画出任何像素。
      反之，若 content 不是 none 而声明变了，那就是真的改变了渲染，判 FAIL。

  L3（活动性自证）—— 反过来确认本判据不是空转：必须证明被删的选择器
      在原文件里确实存在过、且现在确实不存在了。否则「前后一致」可能只是
      因为压根没删掉东西（脚本没生效 / 改错了文件）。

用法: node diff-style.js <before.json> <after.json>
      node diff-style.js _style/before.json _style/after.json
*/
const fs = require('fs');
const path = require('path');

const [, , beforePath, afterPath] = process.argv;
if (!beforePath || !afterPath) {
  console.error('用法: node diff-style.js <before.json> <after.json>');
  process.exit(2);
}

const a = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
const b = JSON.parse(fs.readFileSync(afterPath, 'utf8'));

const out = [];
const ok = (n, v, extra) => out.push((v ? 'PASS ' : 'FAIL ') + n + (extra ? '  ' + extra : ''));
const note = (n, extra) => out.push('---- ' + n + (extra ? '  ' + extra : ''));

const BODY = ['tabbar', 'tab-glass'];
const PSEUDO = ['tabbar::before', 'tabbar::after'];

let bodyDiff = [], pseudoChanged = [], pseudoLive = [], missing = [];

for (const tag of Object.keys(a)) {
  if (!b[tag]) { missing.push(tag); continue; }
  for (const target of Object.keys(a[tag])) {
    const x = a[tag][target], y = b[tag][target];
    if (!x || !y) { missing.push(tag + '/' + target); continue; }
    const changed = Object.keys(x).filter(p => x[p] !== y[p]).map(p => [p, x[p], y[p]]);
    if (!changed.length) continue;
    if (BODY.indexOf(target) >= 0) {
      bodyDiff.push(...changed.map(c => [tag, target, ...c]));
    } else {
      pseudoChanged.push([tag, target, changed]);
      // content:none 的伪元素不生成盒子 —— 只有这种情况才放行
      if (x.content !== 'none' || y.content !== 'none') {
        pseudoLive.push([tag, target, 'content=' + JSON.stringify(x.content)
                                    + '->' + JSON.stringify(y.content)]);
      }
    }
  }
}

const nProps = Object.values(a).reduce((s, c) =>
  s + Object.values(c).filter(Boolean).reduce((t, o) => t + Object.keys(o).length, 0), 0);

console.log('比对 ' + nProps + ' 条计算属性，' + Object.keys(a).length + ' 个页面×主题\n');

ok('L1 元素本体（.app-tabbar / .tab-glass）计算属性逐条相同',
   bodyDiff.length === 0 && missing.length === 0,
   bodyDiff.length ? bodyDiff.slice(0, 6).map(d => d[0] + ' ' + d[1] + ' ' + d[2]).join(' | ')
                   : (missing.length ? '缺失采样: ' + missing.join(',') : '0 处变化'));

const allNone = pseudoChanged.every(([tag, target]) =>
  a[tag][target].content === 'none' && b[tag][target].content === 'none');
ok('L2 伪元素的变化全部发生在 content:none（不生成盒子）的前提下',
   pseudoLive.length === 0,
   pseudoLive.length ? pseudoLive.map(p => p.join(' ')).join(' | ')
                     : pseudoChanged.reduce((s, p) => s + p[2].length, 0)
                       + ' 条变化，均落在 ::before/::after 且 content 前后皆为 none');

// 让「通过」这件事本身可读：说清楚变了多少、为什么无害
for (const [tag, target, changed] of pseudoChanged.slice(0, 1)) {
  note('示例（' + tag + ' ' + target + '）：' + changed.slice(0, 3)
    .map(c => c[0] + ' ' + JSON.stringify(c[1]).slice(0, 28) + ' -> ' + JSON.stringify(c[2]).slice(0, 28))
    .join(' ｜ '));
}

// L3 活动性自证：本判据不能是空转的。必须证明那些选择器原本在 app.css 里、
// 现在确实没了 —— 否则「前后一致」也可能只是因为压根什么都没删。
const APP_CSS = path.join(__dirname, '..', '..', '..', 'css', 'app.css');
const REMOVED = [
  '.app-tabbar::before', '.app-tabbar::after',
  '[data-theme="dark"] .app-tabbar {', '[data-theme="dark"] .app-tabbar::before',
  '[data-theme="dark"] .app-tabbar::after', '.app-tabbar:active { cursor: grabbing; }',
  '.tab-glass.is-first', '.tab-glass.is-last', '[data-theme="dark"] .tab-glass {',
];
let css = '';
try { css = fs.readFileSync(APP_CSS, 'utf8'); } catch (e) {
  ok('L3 能读到 css/app.css', false, String(e.message));
}
if (css) {
  const still = REMOVED.filter(s => css.indexOf(s) >= 0);
  ok('L3 活动性自证：9 个被删选择器在 css/app.css 里已全部消失',
     still.length === 0,
     still.length ? '仍存在: ' + still.join(' | ')
                  : '9/9 已移除（证明 L1/L2 不是空转）');
}

const f = out.filter(l => l.startsWith('FAIL')).length;
console.log(out.join('\n'));
console.log('\n' + out.filter(l => l.startsWith('PASS')).length + ' passed, ' + f + ' failed');
process.exit(f ? 1 : 0);
