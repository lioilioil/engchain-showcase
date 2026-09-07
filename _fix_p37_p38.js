// P3-7 (stores.js) + P3-8 (detail.js) fixes
const fs = require('fs');

// ===== P3-7: personal partner credit discount in stores.js (LF) =====
const sp = 'D:/Engchain3.0/js/stores.js';
let sc = fs.readFileSync(sp, 'utf8');
const oldDisc = "function creditDiscount() {\n    var idy = deriveIdentity();\n    if (idy.enterprise !== 'resident') return 1;";
const newDisc = "function creditDiscount() {\n    var idy = deriveIdentity();\n    /* P3-7：个人合伙人享有 0.8x 积分折扣（假设：与建筑企业同档，作为推广者激励；产品决策可调整） */\n    if (idy.partner && idy.enterprise !== 'resident') return 0.8;\n    if (idy.enterprise !== 'resident') return 1;";
if (sc.includes(oldDisc)) {
  sc = sc.replace(oldDisc, newDisc);
  fs.writeFileSync(sp, sc, 'utf8');
  console.log('P3-7 stores.js: replaced');
} else {
  console.log('P3-7 stores.js: NOT FOUND');
}

// ===== P3-8: commission rate display in detail.js guaranteeSec (CRLF) =====
const dp = 'D:/Engchain3.0/js/detail.js';
let dc = fs.readFileSync(dp, 'utf8');
const NL = '\r\n';

// Add commission info to guaranteeSec for deal types
const oldGuar = "  function guaranteeSec(rec) {" + NL +
  "    var items = GUARANTEE[rec.bizKey];" + NL +
  "    if (!items || !items.length) return '';";

const newGuar = "  function guaranteeSec(rec) {" + NL +
  "    var items = GUARANTEE[rec.bizKey];" + NL +
  "    if (!items || !items.length) return '';" + NL +
  "    /* P3-8：成交类详情页增加平台佣金费率说明，提升成交信任 */" + NL +
  "    var dealTypes = ['cooperation', 'material', 'equipment', 'labor'];" + NL +
  "    var commHtml = '';" + NL +
  "    if (dealTypes.indexOf(rec.bizKey) >= 0) {" + NL +
  "      var cm = (MOCK.business && MOCK.business.commission) || {};" + NL +
  "      var tiers = cm.tier || [];" + NL +
  "      var isBreakin = !!(window.ModeStore && ModeStore.isBreakIn());" + NL +
  "      var firstRate = isBreakin ? ((MOCK.business.breakin || {}).commissionFirstTier || 0.05) : (tiers[0] ? tiers[0].rate : 0.08);" + NL +
  "      var tierText = tiers.map(function(t) { return (t.min / 10000) + '万以上 ' + (t.rate * 100) + '%'; }).join(' / ');" + NL +
  "      commHtml = '<div style=\"margin-top:10px;padding:8px 12px;background:var(--primary-soft);border:1px solid var(--accent-line);border-radius:8px;\"><div style=\"font-size:11px;font-weight:600;color:var(--primary-dim);margin-bottom:3px;\">平台服务费（成交后收取）</div><div style=\"font-size:10.5px;color:var(--text-2);line-height:1.5;\">阶梯费率：' + tierText + '%，最低 ' + (cm.minCommission || 10000).toLocaleString() + ' 元' + (isBreakin ? '；<b style=\"color:var(--accent);\">破冰期首档优惠至 ' + (firstRate * 100) + '%（5万以下成交）</b>' : '') + '</div></div>';" + NL +
  "    }";

if (dc.includes(oldGuar)) {
  dc = dc.replace(oldGuar, newGuar);
  console.log('P3-8 detail.js guaranteeSec: replaced');
} else {
  console.log('P3-8 detail.js guaranteeSec: NOT FOUND');
}

// Also need to append commHtml to the guarantee section output
const oldRet = "    return sec(GUARANTEE_TITLE[rec.bizKey] || '平台保障', '<div class=\"ds-text\"><div style=\"display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-2);line-height:1.6;\">' + rows + '</div></div>');";
const newRet = "    return sec(GUARANTEE_TITLE[rec.bizKey] || '平台保障', '<div class=\"ds-text\"><div style=\"display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-2);line-height:1.6;\">' + rows + '</div>' + commHtml + '</div>');";
if (dc.includes(oldRet)) {
  dc = dc.replace(oldRet, newRet);
  console.log('P3-8 return statement: replaced');
} else {
  console.log('P3-8 return statement: NOT FOUND');
}

fs.writeFileSync(dp, dc, 'utf8');
console.log('Done');
