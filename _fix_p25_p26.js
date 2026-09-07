// P2-5 + P2-6 fixes for detail.js (CRLF-aware)
const fs = require('fs');
const path = 'D:/Engchain3.0/js/detail.js';
let c = fs.readFileSync(path, 'utf8');
const NL = '\r\n';

// ===== P2-5: agencyContact visual optimization =====
const oldAgency = "        row('咨询电话', Lock.partial(ac.phone || '', locked)) +" + NL +
  "        row('微信号', Lock.full(ac.wechat || '', locked)) +" + NL +
  "        row('机构地址', Lock.partial(ac.addr || r.location || '', locked, cfgText(r.location) + ' · 详细地址免费咨询后可见')) +" + NL +
  "      '</div>' +" + NL +
  "      Lock.inline(locked, '免费提交咨询需求后查看联系方式', '专属顾问 1 对 1 · 电话 / 微信 · 全程不收取信息费', '免费咨询') +";

const newAgency = "        row('咨询电话', locked ? (Lock.partialPhone(ac.phone || '') + ' <span style=\"font-size:10px;color:var(--text-4)\">免费咨询后可见完整号码</span>') : ac.phone) +" + NL +
  "        row('微信号', locked ? '<span style=\"color:var(--text-3)\">扫码或免费咨询后获取</span>' : ac.wechat) +" + NL +
  "        row('机构地址', locked ? (cfgText(r.location) + ' · <span style=\"font-size:10px;color:var(--text-4)\">免费咨询后可见详细地址</span>') : (ac.addr || r.location)) +" + NL +
  "      '</div>' +" + NL +
  "      '<div class=\"pw-inline\" data-pw-unlock style=\"background:var(--success-soft);border:1px solid rgba(43,107,79,.2);\"><div class=\"pw-inline-l\"><div class=\"pw-inline-ic\" style=\"background:rgba(43,107,79,.12);color:var(--success);\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\"><path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/><polyline points=\"22 4 12 14.01 9 11.01\"/></svg></div><div><div class=\"pw-inline-t\" style=\"color:var(--success);\">免费提交咨询需求后查看联系方式</div><div class=\"pw-inline-s\">专属顾问 1 对 1 · 电话 / 微信 · 全程不收取信息费</div></div></div><div class=\"pw-inline-price\" style=\"color:var(--success);\">免费咨询</div></div>' +";

if (c.includes(oldAgency)) {
  c = c.replace(oldAgency, newAgency);
  console.log('P2-5 agencyContact: replaced');
} else {
  console.log('P2-5 agencyContact: NOT FOUND');
}

// ===== P2-6: credit insufficient - show packages dialog before redirect =====
const oldPay = "      UI.toast('积分不足，请先充值', 'warn');" + NL +
  "      setTimeout(function () { location.href = '../../pages/wallet/credits.html'; }, 700);";

const newPay = "      /* P2-6：积分不足时先展示积分包选项，再引导充值 */" + NL +
  "      var pkgs = (MOCK.business.credits && MOCK.business.credits.packages) || [];" + NL +
  "      var pkgHtml = pkgs.map(function(p) {" + NL +
  "        return '<div style=\"display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-card-2);border-radius:8px;margin-bottom:6px;\"><span style=\"font-size:12.5px;font-weight:600;color:var(--text-1);\">' + p.credits + ' 积分</span><span style=\"font-size:13px;font-weight:700;color:var(--primary-dim);font-family:var(--font-num);\">¥' + p.price + '</span></div>';" + NL +
  "      }).join('');" + NL +
  "      UI.dialog({" + NL +
  "        title: '积分不足'," + NL +
  "        text: '当前余额 <b>' + (window.CreditStore ? CreditStore.read().balance : 0) + '</b> 积分，本次解锁需 <b>' + costG + '</b> 积分。充值后立即可用：<br><br>' + pkgHtml," + NL +
  "        ok: '去充值', cancel: '再看看'," + NL +
  "        onOk: function () { location.href = '../../pages/wallet/credits.html'; }" + NL +
  "      });";

if (c.includes(oldPay)) {
  c = c.replace(oldPay, newPay);
  console.log('P2-6 payGo: replaced');
} else {
  console.log('P2-6 payGo: NOT FOUND');
}

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
