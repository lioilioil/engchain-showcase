// 交叉验证：catalog 每个 pname 是否能解析到 SUBCAT_EXAMPLES 的品名级示例
global.window = global;
require('./js/publish-catalog.js');
const fs = require('fs');
const html = fs.readFileSync('pages/publish/editor.html', 'utf8');

// 提取 SUBCAT_EXAMPLES 对象字面量
const m = html.match(/var SUBCAT_EXAMPLES\s*=\s*(\{[\s\S]*?\n\};)/);
if (!m) { console.error('SUBCAT_EXAMPLES not found'); process.exit(1); }
const SUBCAT_EXAMPLES = eval('(' + m[1].replace(/;$/, '') + ')');

const CAT = global.PUBLISH_CATALOG || global.EngchainCatalog;
let total = 0, hit = 0, miss = [];

for (const biz in CAT) {
  const bizNode = CAT[biz];
  const subs = bizNode.subCats || [];
  const namesMap = bizNode.names || {};
  for (const subName of subs) {
    const names = namesMap[subName] || [];
    for (const pname of names) {
      total++;
      const node = (SUBCAT_EXAMPLES[biz] && SUBCAT_EXAMPLES[biz][subName]) || (SUBCAT_EXAMPLES[biz] && SUBCAT_EXAMPLES[biz]['*']);
      let found = false;
      if (node) {
        for (const role of ['supply','demand']) {
          const branch = node[role];
          if (branch && !branch.title && branch[pname]) { found = true; break; }
          if (branch && branch.title) { found = true; break; }
        }
      }
      if (found) hit++; else miss.push(`${biz} / ${subName} / ${pname}`);
    }
  }
}
console.log(`品名总数: ${total}, 命中(有示例): ${hit}, 缺失: ${miss.length}`);
if (miss.length) { console.log('--- 缺失清单 ---'); miss.forEach(x=>console.log(' -', x)); }
