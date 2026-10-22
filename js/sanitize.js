/* ============================================================================
 * Engchain 正文脱敏 Sanitize（详情页渲染侧）
 *
 * 口径（产品确认）：
 *  - 解锁前内联打码、解锁后随 .phone.is-unlocked 原地还原（复用 Lock.partial 的
 *    .pwp/.pwp-mask/.pwp-real 双份渲染机制）；
 *  - 公司名仅打码完整工商名称（XX有限公司/股份/集团）与发布主体自身名称，品牌简称保留；
 *  - 违规词为可配置数组，命中替换为 ***（永久遮蔽，解锁不还原）。
 *
 * 适用：通用详情页（supply/detail.html 经 detail.js 渲染）的发布正文
 * （desc / detail / descMd / description）。
 * 不适用：结构化联系行（contact.phone/wechat 走 Lock.partial/Lock.full）、
 * 流程步骤、子项描述、证书、附件、企业主页、后台管理。
 * ============================================================================ */
(function () {
  'use strict';

  /* 可配置违规词表（短语，不区分大小写）。运营/合规可直接扩充，命中即替换为 ***。
     注意：避开平台合法板块词（如「建企买卖/公司转让」），避免误杀。 */
  var BANNED_PHRASES = [
    '买证', '卖证', '伪造资质', '假证',
    '包过', '包注册', '包成功', '包拿证', '包挂靠',
    '免考', '代考', '代办学历',
    '私加微信', '私聊联系', '扫码加', '加我微信', '站外联系',
    '绕过平台', '私下交易', '买卖资质', '资质买卖', '证书挂靠收费'
  ];

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* 手机号掩码：保留前 3 后 4，中间 4 位 * */
  function maskMobile(digits) {
    var d = String(digits).replace(/\D/g, '');
    if (d.length < 7) return '****';
    return d.slice(0, 3) + '****' + d.slice(-4);
  }

  /* 违规词永久替换为 ***（解锁不还原） */
  function stripBanned(text) {
    var out = text;
    BANNED_PHRASES.forEach(function (ph) {
      if (!ph) return;
      out = out.replace(new RegExp(escapeRegExp(ph), 'gi'), '***');
    });
    return out;
  }

  /* 完整工商名称：保留后缀，专名前缀打码 */
  function companyMask(name) {
    var m = name.match(/(股份有限公司|有限责任公司|集团有限公司|有限公司|集团)$/);
    return m ? '***' + m[1] : '***';
  }

  /* 主匹配正则（捕获组顺序固定）：
     g1 纯11位手机 | g2 分段手机 | g3 微信标签 g4 微信账号 |
     g5 QQ标签 g6 QQ号 | g7 完整工商名 | g8 发布主体自身名 */
  function buildMaster(selfName) {
    var parts = [
      '(?<!\\d)(1[3-9]\\d{9})(?!\\d)',                                  /* g1 */
      '(1[3-9]\\d{1}[\\s-]\\d{4}[\\s-]\\d{4})',                        /* g2 分段手机 137-8286-6702 */
      '((?:微信|加微|薇信|威信|微信号|WeChat|wechat|VX|vx|WX|wx)[号:：\\s＃#]*)([A-Za-z][A-Za-z0-9_-]{5,19})', /* g3 g4 */
      '((?:QQ|qq|QQ群|qq群)[号:：\\s#]*)(\\d{5,11})(?!\\d)',            /* g5 g6 */
      '([一-龥A-Za-z0-9·（）()]{2,30}?(?:股份有限公司|有限责任公司|集团有限公司|有限公司|集团))' /* g7 */
    ];
    if (selfName) parts.push('(' + escapeRegExp(selfName) + ')');       /* g8 */
    return new RegExp(parts.join('|'), 'g');
  }

  /* pwp 双份渲染：未解锁显示掩码+小锁标，.phone.is-unlocked 下原地还原明文 */
  function pwp(maskText, realText) {
    return '<span class="pwp">' +
      '<span class="pw-val pwp-mask">' + escHtml(maskText) +
      '<span class="pw-lock-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-lock"/></svg></span></span>' +
      '<span class="pwp-real">' + escHtml(realText) + '</span>' +
      '</span>';
  }

  /* 按命中类型返回掩码段（HTML 模式）；未命中返回原串 */
  function htmlSegment(m, g1, g2, g3, g4, g5, g6, g7, g8) {
    if (g1) return pwp(maskMobile(g1), m);
    if (g2) return pwp(maskMobile(g2), m);
    if (g3 && g4) return escHtml(g3) + pwp('****', g4);
    if (g5 && g6) return escHtml(g5) + pwp('****', g6);
    if (g7) return pwp(companyMask(g7), g7);
    if (g8) return pwp('***', g8);
    return m;
  }

  /* 按命中类型返回掩码段（纯文本模式）；未命中返回原串 */
  function textSegment(m, g1, g2, g3, g4, g5, g6, g7, g8) {
    if (g1 || g2) return maskMobile(m);
    if (g3 && g4) return g3 + '****';
    if (g5 && g6) return g5 + '****';
    if (g7) return companyMask(g7);
    if (g8) return '***';
    return m;
  }

  /* 纯文本版脱敏（无 HTML，供单测/非渲染场景）：返回打码后的纯文本 */
  function maskText(text, opts) {
    opts = opts || {};
    var out = stripBanned(String(text == null ? '' : text));
    return out.replace(buildMaster(opts.selfName), function () {
      return textSegment.apply(null, arguments);
    });
  }

  /* 纯文本渲染入口：未解锁输出内联打码 HTML；已解锁输出转义明文。
     opts: { selfName } 发布主体全称（可选） */
  function inline(text, locked, opts) {
    opts = opts || {};
    var raw = String(text == null ? '' : text);
    if (!locked) return escHtml(raw);
    var out = stripBanned(raw);
    /* 先按主匹配切分：命中段由 pwp() 自行转义，未命中段统一转义 */
    var re = buildMaster(opts.selfName), last = 0, html = '';
    out.replace(re, function () {
      var args = Array.prototype.slice.call(arguments);
      var idx = args[args.length - 2];
      html += escHtml(out.slice(last, idx)) + htmlSegment.apply(null, args);
      last = idx + args[0].length;
      return args[0];
    });
    html += escHtml(out.slice(last));
    return html;
  }

  /* Markdown 渲染入口：对原始 md 打码后再交给 renderMarkdown；
     pwp 内联 span 会被轻量 markdown 渲染原样保留。 */
  function sanitizeMd(md, locked, opts) {
    opts = opts || {};
    var raw = String(md == null ? '' : md);
    if (!locked) return raw;
    var out = stripBanned(raw);
    return out.replace(buildMaster(opts.selfName), function () {
      return htmlSegment.apply(null, arguments);
    });
  }

  window.Sanitize = {
    inline: inline,
    sanitizeMd: sanitizeMd,
    maskText: maskText,
    BANNED_PHRASES: BANNED_PHRASES
  };
})();
