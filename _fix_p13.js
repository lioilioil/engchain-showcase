// Fix P1-3: personnel CTA should always use personnelCta()
const fs = require('fs');
const path = 'D:/Engchain3.0/js/detail.js';
let c = fs.readFileSync(path, 'utf8');
const NL = '\r\n';

// Restructure ctaText to check personnel FIRST (before unlocked check)
const old = "    var ctaText = unlocked" + NL +
  "      ? (t.ctaText ? t.ctaText(rec, true) : (t.cta || '联系TA'))" + NL +
  "      : (guestFreeAvail" + NL +
  "          ? '免费查看（游客福利 ' + (gs.used + 1) + '/' + gs.total + '）'" + NL +
  "          : ((needGate && !gate.pass)" + NL +
  "              ? gate.label" + NL +
  "              : (rec.bizKey === 'personnel' ? personnelCta() : (t.inlineLock ? (t.ctaLocked || payGoLabel(up)) : t.cta))));";

const newCta = "    /* P1-3：personnel 始终走动态 CTA（isFree已解锁不等于可投递，需单独检查投递权限） */" + NL +
  "    var ctaText = (rec.bizKey === 'personnel')" + NL +
  "      ? personnelCta()" + NL +
  "      : (unlocked" + NL +
  "          ? (t.ctaText ? t.ctaText(rec, true) : (t.cta || '联系TA'))" + NL +
  "          : (guestFreeAvail" + NL +
  "              ? '免费查看（游客福利 ' + (gs.used + 1) + '/' + gs.total + '）'" + NL +
  "              : ((needGate && !gate.pass)" + NL +
  "                  ? gate.label" + NL +
  "                  : (t.inlineLock ? (t.ctaLocked || payGoLabel(up)) : t.cta))));";

if (c.includes(old)) {
  c = c.replace(old, newCta);
  fs.writeFileSync(path, c, 'utf8');
  console.log('P1-3 personnel CTA: fixed');
} else {
  console.log('P1-3 personnel CTA: NOT FOUND');
  // Debug: find the actual text
  const idx = c.indexOf('var ctaText');
  console.log('Actual:', JSON.stringify(c.substring(idx, idx + 400)));
}
