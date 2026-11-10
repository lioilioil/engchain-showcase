// 验证关键新补品名能解析到正确标题（模拟 resolveStaticExample 回退链）
global.window = global;
require('./js/publish-catalog.js');
const fs = require('fs');
const html = fs.readFileSync('pages/publish/editor.html', 'utf8');
const m = html.match(/var SUBCAT_EXAMPLES\s*=\s*(\{[\s\S]*?\n\};)/);
const SUBCAT_EXAMPLES = eval('(' + m[1].replace(/;$/, '') + ')');

function resolve(biz, sub, pname, role) {
  const node = SUBCAT_EXAMPLES[biz] && SUBCAT_EXAMPLES[biz][sub];
  if (!node) return {err: 'no sub node'};
  const branch = node[role];
  if (!branch) return {err: 'no role branch'};
  if (!branch.title) {
    return branch[pname] || branch['_default'] || {err: 'no pname/default'};
  }
  return branch; // 扁平旧结构
}

const cases = [
  ['建企买卖','施工总承包公司','其他总承包公司转让','supply'],
  ['建企买卖','专业承包公司','其他专业承包公司转让','supply'],
  ['服务商','资质代办','资质增项代办','supply'],
  ['服务商','认证信用','ISO9001质量体系认证','supply'],
  ['服务商','工程检测','消防设施检测','supply'],
  ['劳务','特种作业','焊工','supply'],
  ['运输','大件设备运输','超限运输','supply'],
  ['招聘','施工管理岗','测量员','demand'],
  ['求职','注册证书岗','二级建造师','supply'],
  ['设备','起重机械','盘扣架体','supply'],
  ['资质招商','项目合作','单项目合作','supply'],
];
for (const [biz,sub,pname,role] of cases) {
  const r = resolve(biz, sub, pname, role);
  console.log(`${biz}/${sub}/${pname} [${role}] => ${r.title ? 'OK: '+r.title.slice(0,45) : 'MISS: '+r.err}`);
}
