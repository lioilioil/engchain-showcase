/* ============================================================
   uni-settings.js · 设置（tabbar 三主入口之一 · settings.html）
   2026-11-02 重构：由「7 条只读说明」改为「身份卡 + 4 组 12 条」。
   · 结构：身份卡 → 企业与合作 / 规则与口径 / 经营规范 / 外观与提醒 → 关于
   · 六身份各自独立变体（法人与员工不再复用管理员列表）
   · 权限说明改为从 Uni.permOf 生成，杜绝文案与权限矩阵脱节
   · 新增：税务与开票、经营红线、法定代表人职责、深色模式、通知提醒
   · 可写项只有两个（深色模式 / 通知提醒），其余为只读说明 + 跳转
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var THEME_KEY = "engchain-theme";
  var NOTIFY_KEY = "engchain-settings-notify";

  /* ---------- 条目元数据 ---------- */
  var META = {
    cert:   { icon: "badge",   t: "资质与授权",     s: "" },
    info:   { icon: "building", t: "合作信息",       s: "" },
    agree:  { icon: "file",    t: "合作协议",       s: "" },
    auth:   { icon: "shield",  t: "授权范围",       s: "" },
    perm:   { icon: "users",   t: "角色与权限",     s: "" },
    settle: { icon: "chart",   t: "结算口径",       s: "" },
    tax:    { icon: "receipt", t: "税务与开票",     s: "" },
    duty:   { icon: "edit",    t: "法定代表人职责", s: "" },
    norm:   { icon: "warn",    t: "经营红线",       s: "" },
    theme:  { icon: "moon",    t: "深色模式",       s: "" },
    notify: { icon: "bell",    t: "通知提醒",       s: "" },
    about:  { icon: "info",    t: "关于与版本",     s: "" }
  };

  /* 页内补充字形（ui.icon 的内置表没有 sun/moon，避免改动共享文件） */
  var LOCAL_IC = {
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
  };
  function ic(name, size) {
    var s = size || 18;
    if (!LOCAL_IC[name]) return ui.icon(name, s);
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + LOCAL_IC[name] + '</svg>';
  }

  /* ---------- 身份变体（6 身份 6 套，不再回退复用管理员列表） ---------- */
  function G(t, keys) { return { t: t, keys: keys }; }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function () {
        return {
          groups: [
            G("企业与合作", ["cert", "info", "auth"]),
            G("规则与口径", ["perm", "settle", "tax"]),
            G("经营规范", ["norm"]),
            G("外观与提醒", ["theme", "notify"])
          ]
        };
      }
    },
    legal_rep: {
      label: "省级总代 · 法定代表人",
      data: function () {
        return {
          groups: [
            G("企业与合作", ["cert", "info", "auth"]),
            G("规则与口径", ["perm", "settle", "tax", "duty"]),
            G("经营规范", ["norm"]),
            G("外观与提醒", ["theme", "notify"])
          ]
        };
      }
    },
    staff: {
      label: "省级总代 · 员工",
      data: function () {
        return {
          groups: [
            G("企业与合作", ["cert", "info"]),
            G("规则与口径", ["perm", "settle"]),
            G("经营规范", ["norm"]),
            G("外观与提醒", ["theme", "notify"])
          ]
        };
      }
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function () {
        return {
          groups: [
            G("企业与合作", ["agree", "info", "auth"]),
            G("规则与口径", ["perm", "settle", "tax"]),
            G("经营规范", ["norm"]),
            G("外观与提醒", ["theme", "notify"])
          ]
        };
      }
    },
    sub_legal: {
      label: "二级合作企业 · 法定代表人",
      data: function () {
        return {
          groups: [
            G("企业与合作", ["agree", "info", "auth"]),
            G("规则与口径", ["perm", "settle", "tax", "duty"]),
            G("经营规范", ["norm"]),
            G("外观与提醒", ["theme", "notify"])
          ]
        };
      }
    },
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: function () {
        return {
          groups: [
            G("企业与合作", ["agree", "info"]),
            G("规则与口径", ["perm", "settle"]),
            G("经营规范", ["norm"]),
            G("外观与提醒", ["theme", "notify"])
          ]
        };
      }
    }
  };

  /* ══════════ 通用基元 ══════════ */

  /* 空值统一落成「—」，避免弹窗里出现 undefined */
  function txt(v) { return (v === undefined || v === null || v === "") ? "—" : String(v); }

  function kv(k, v, copyable) {
    var val = txt(v);
    var btn = copyable ? '<button type="button" class="uh-copy" data-copy="' + ui.esc(val) +
      '" aria-label="复制">' + ui.icon("clipboard", 14) + '</button>' : "";
    return '<div class="uh-sheetkv"><span class="k">' + ui.esc(k) + '</span>' +
      '<span class="uh-sheetkv__r"><span class="v">' + ui.esc(val) + '</span>' + btn + '</span></div>';
  }

  function secHead(t) {
    return '<div class="uh-sechead" style="margin:16px 0 0"><span class="lbl">' + ui.esc(t) + '</span></div>';
  }

  function clauses(list) {
    return list.map(function (c) {
      return '<div class="uh-clause"><div class="no">' + ui.esc(c.t) + '</div>' +
        '<div class="c">' + c.c + '</div></div>';
    }).join("");
  }

  function bullets(list) {
    return list.map(function (x) { return "· " + ui.esc(x); }).join("<br>");
  }

  function note(t) { return '<div class="uh-note">' + ui.esc(t) + '</div>'; }

  function goBtn(label, route) {
    return '<button type="button" class="btn btn-ghost btn-sm btn-block uh-gobtn" data-go="' +
      ui.esc(route) + '">' + ui.esc(label) + ui.icon("chev", 14) + '</button>';
  }

  function pct(v) { return Math.round((Number(v) || 0) * 100) + "%"; }

  /* 剩余天数：协议/授权到期提醒的唯一数据源，不臆造"即将到期" */
  function daysLeft(dateStr) {
    if (!dateStr) return null;
    var t = Date.parse(String(dateStr) + "T00:00:00");
    if (isNaN(t)) return null;
    return Math.round((t - Date.now()) / 86400000);
  }

  function expiryText(dateStr) {
    var d = daysLeft(dateStr);
    if (d === null) return "—";
    if (d < 0) return "已到期 " + (-d) + " 天";
    if (d === 0) return "今日到期";
    return "剩余 " + d + " 天";
  }

  function partyRows(p) {
    p = p || {};
    return [["企业名称", p.name], ["统一社会信用代码", p.uscc], ["法定代表人", p.legalPerson],
      ["联系人", p.contact], ["联系电话", p.phone], ["注册地址", p.address]];
  }

  /* 弹窗内的双方主体块（带复制） */
  function partyBlock(title, p) {
    p = p || {};
    return secHead(title) + kv("企业名称", p.name) + kv("统一社会信用代码", p.uscc, p.uscc) +
      kv("法定代表人", p.legalPerson) + kv("联系人", p.contact) +
      kv("联系电话", p.phone, p.phone) + kv("注册地址", p.address);
  }

  function shortName(n) { return String(n || "").replace(/（[^）]*）/g, ""); }

  /* ---------- 主题 / 通知偏好 ---------- */
  function curTheme() {
    try { return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
    catch (e) { return "light"; }
  }
  function themeIcon() { return curTheme() === "dark" ? "sun" : "moon"; }

  var NOTIFY_ITEMS = [
    { k: "settle", t: "对账与结算", s: "月度出账、异议窗口到期、到账凭证待确认" },
    { k: "agree", t: "协议与授权", s: "协议发起、待签署、临近到期与授权状态变更" },
    { k: "ratio", t: "比例与成员", s: "分润比例调整、成员权限变更" }
  ];
  function readNotify() {
    var d = { settle: 1, agree: 1, ratio: 1 };
    try {
      var o = JSON.parse(window.localStorage.getItem(NOTIFY_KEY) || "");
      if (o && typeof o === "object") {
        NOTIFY_ITEMS.forEach(function (it) { if (it.k in o) d[it.k] = o[it.k] ? 1 : 0; });
      }
    } catch (e) { /* 首次访问或存储不可用：落回默认全开 */ }
    return d;
  }
  function writeNotify(o) {
    try { window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(o)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function notifyOnCount() {
    var n = readNotify(), c = 0;
    NOTIFY_ITEMS.forEach(function (it) { if (n[it.k]) c++; });
    return c;
  }

  /* ---------- 下载文件：自包含 HTML（与对账卷宗同一做法，Blob 真实大小） ---------- */
  var DOC_CSS = '*{box-sizing:border-box}' +
    'body{margin:0;background:#f5f6f5;color:#1d211f;font:14px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}' +
    '.doc{max-width:720px;margin:0 auto;background:#fff;padding:40px 44px 56px;box-shadow:0 1px 3px rgba(0,0,0,.08)}' +
    '.eyebrow{font-size:11px;letter-spacing:.14em;color:#6b7671}' +
    'h1{font-size:22px;line-height:1.45;margin:10px 0 12px;font-weight:700}' +
    '.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#eef2ef;color:#3c5a49}' +
    '.meta{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:10px;font-size:12px;color:#6b7671}' +
    '.sec{margin-top:24px}' +
    '.sec-t{font-size:13px;font-weight:700;margin:0 0 6px;padding-left:9px;border-left:3px solid #5b8c6e}' +
    '.kv{display:flex;gap:18px;padding:7px 0;border-top:1px solid #edecea;font-size:13.5px}' +
    '.kv span{color:#6b7671;flex:none;width:132px}' +
    '.kv b{font-weight:600;flex:1;min-width:0;word-break:break-word}' +
    '.clause{padding:9px 0;border-top:1px solid #edecea}' +
    '.clause .no{font-size:13px;font-weight:700;margin-bottom:4px}' +
    '.clause .c{font-size:13px;color:#3b423e}' +
    '.p{margin:6px 0 0;font-size:13px;color:#3b423e}' +
    '.foot{margin-top:28px;padding-top:12px;border-top:1px solid #edecea;font-size:11.5px;color:#8a938e}' +
    /* 协议正文排版：与 uni-layout.css 的 .uh-doc 一一对应，
       导出文件是自包含的（不加载系统样式表），所以这里用固定色值复刻一份 */
    '.uh-doc{font-size:13.5px;line-height:1.9;color:#3b423e;word-break:break-word;overflow-wrap:anywhere}' +
    '.uh-doc>:first-child{margin-top:0}.uh-doc>:last-child{margin-bottom:0}' +
    '.uh-doc p{margin:0 0 10px;text-indent:2em;text-align:left}' +
    '.uh-doc h1{margin:0 0 12px;text-indent:0;text-align:center;font-size:18px;font-weight:700;color:#1d211f;line-height:1.5}' +
    '.uh-doc h2{margin:20px 0 6px;text-indent:0;font-size:16px;font-weight:700;color:#1d211f;line-height:1.5}' +
    '.uh-doc h3,.uh-doc h4{margin:18px 0 6px;text-indent:0;font-size:13.5px;font-weight:700;color:#1d211f}' +
    '.uh-doc .uh-doc__h{margin:18px 0 6px;text-indent:0;text-align:left;font-size:13.5px;font-weight:700;color:#1d211f;line-height:1.6}' +
    '.uh-doc .uh-doc--c{text-indent:0;text-align:center}.uh-doc .uh-doc--r{text-indent:0;text-align:right}' +
    '.uh-doc .uh-doc--j{text-align:justify}' +
    '.uh-doc ul,.uh-doc ol{margin:0 0 10px;padding-left:22px;text-indent:0}' +
    '.uh-doc ul{list-style:disc outside}.uh-doc ol{list-style:decimal outside}' +
    '.uh-doc li{margin:3px 0;text-indent:0}' +
    '.uh-doc li::marker{color:#6b7671}' +
    '.uh-doc__tw{margin:12px 0;overflow-x:auto;border:1px solid #edecea;border-radius:4px}' +
    '.uh-doc table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12.5px}' +
    '.uh-doc th,.uh-doc td{padding:7px 10px;text-indent:0;text-align:left;vertical-align:top;border-bottom:1px solid #edecea;line-height:1.6}' +
    '.uh-doc tr:last-child th,.uh-doc tr:last-child td{border-bottom:0}' +
    '.uh-doc th{background:#f7f8f7;font-weight:600;color:#1d211f}' +
    '.uh-doc td+td,.uh-doc th+th{border-left:1px solid #edecea}' +
    '.uh-doc blockquote{margin:12px 0;padding:8px 12px;text-indent:0;border-left:2px solid #d5d9d6;color:#3b423e}' +
    '.uh-doc strong,.uh-doc b{font-weight:700;color:#1d211f}.uh-doc em,.uh-doc i{font-style:italic}' +
    '.uh-doc a{color:#3c5a49;text-decoration:underline;text-underline-offset:2px}' +
    '.uh-doc hr{margin:16px 0;border:0;border-top:1px solid #edecea}' +
    '.uh-doc img{display:block;max-width:100%;height:auto;margin:10px auto}' +
    '@media print{body{background:#fff}.doc{box-shadow:none;padding:0}}';

  function docRow(k, v) {
    return '<div class="kv"><span>' + ui.esc(k) + '</span><b>' + ui.esc(txt(v)) + '</b></div>';
  }

  /* 文档外壳：协议与授权书共用（sections: {t, rows|clauses|text|html}）
     html 是后台富文本正文，已经过 Uni.richDoc() 清洗，这里不再转义 */
  function docShell(o) {
    var meta = (o.meta || []).map(function (m) {
      return '<span>' + ui.esc(m[0]) + '：' + ui.esc(txt(m[1])) + '</span>';
    }).join("");
    var secs = (o.sections || []).map(function (s) {
      var body = "";
      if (s.rows) body += s.rows.map(function (r) { return docRow(r[0], r[1]); }).join("");
      if (s.clauses) body += s.clauses.map(function (c) {
        return '<div class="clause"><div class="no">' + ui.esc(c.no) + '</div>' +
          '<div class="c">' + ui.esc(c.c) + '</div></div>';
      }).join("");
      if (s.text) body += '<p class="p">' + ui.esc(s.text) + '</p>';
      if (s.html) body += s.html;
      return '<section class="sec">' +
        (s.t ? '<h2 class="sec-t">' + ui.esc(s.t) + '</h2>' : "") + body + '</section>';
    }).join("");
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + ui.esc(o.title) + '</title>\n<style>' + DOC_CSS + '</style>\n</head>\n<body>\n<div class="doc">' +
      '<div class="eyebrow">' + ui.esc(o.eyebrow) + '</div>' +
      '<h1>' + ui.esc(o.title) + '</h1>' +
      (o.badge ? '<span class="badge">' + ui.esc(o.badge) + '</span>' : "") +
      '<div class="meta">' + meta + '</div>' + secs +
      '<div class="foot">' + ui.esc(o.foot) + '</div>' +
      '</div>\n</body>\n</html>';
  }

  function nowStamp() {
    var d = new Date();
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) +
      " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }

  /* 文件卡：生成 → Blob 真实大小 → 卡片（协议 / 授权书共用） */
  function fileCard(fname, html, btnLabel) {
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    return {
      blob: blob,
      fname: fname,
      card: '<div class="dl-file">' +
        '<div class="dl-file__row">' +
        '<span class="dl-file__ic">' + ui.icon("file", 22) + '</span>' +
        '<div class="dl-file__info">' +
        '<div class="dl-file__nm">' + ui.esc(fname) + '</div>' +
        '<div class="dl-file__meta">HTML 网页 · 约 ' + (blob.size / 1024).toFixed(1) + ' KB</div>' +
        '</div></div>' +
        '<button type="button" class="btn btn-primary btn-sm btn-block" data-dl>' +
        ui.icon("download", 15) + ' ' + ui.esc(btnLabel) + '</button>' +
        '</div>'
    };
  }

  function bindDownload(el, doc, Uni) {
    var btn = el.querySelector("[data-dl]");
    if (!btn || !doc) return;
    btn.addEventListener("click", function () {
      var url = URL.createObjectURL(doc.blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = doc.fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      Uni.toast("已开始下载文件", "ok");
    });
  }

  function copyText(t, Uni) {
    function done() { Uni.toast("已复制", "ok"); }
    function legacy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) {
        Uni.toast("复制失败，请长按选择", "warn");
      }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(done, legacy);
      } else legacy();
    } catch (e) { legacy(); }
  }

  /* ══════════ 协议档案（设置 → 合作协议） ══════════
     O4 协议：状态 / 双方主体 / 签署信息 / 条款全文 / 可下载文件。
     字段一律取 ctx.s.agreement（scenarios.js 唯一源），本页不虚构任何签署信息。 */
  var AG_STATE = {
    signed: { t: "已签署", cls: "ok", file: "已签署" },
    pending_mine: { t: "待我签署", cls: "wait", file: "待签署" },
    rejected: { t: "已拒签", cls: "bad", file: "已拒签" }
  };
  function agStateOf(ag) { return (ag && AG_STATE[ag.state]) || { t: "暂无记录", cls: "mute", file: "未生效" }; }

  /* 2026-11-01 审计修复：协议状态文案按身份归一。
     「待我签署」只对签署侧企业管理员（admin / sub_admin）成立；法定代表人（只读）与
     员工没有签署职责，统一显示「待签署」，否则会把这批身份误当成签署责任人。 */
  function agCanSign(ctx) {
    var id = ctx && ctx.identity;
    return id === "admin" || id === "sub_admin";
  }
  function agStateOfFor(ag, ctx) {
    var st = agStateOf(ag);
    if (st.t === "待我签署" && !agCanSign(ctx)) return { t: "待签署", cls: st.cls, file: st.file };
    return st;
  }

  /* 协议正文：后台富文本存档（ag.bodyHtml）优先，没有就按本份协议要素回填模板。
     省代侧协议对象不带 sub / province，Uni.agreementBody 会自己取 ag.province / ag.sub。 */
  function agBody(ag) {
    return Uni.agreementBody(ag);
  }

  /* 导出文件专用：外壳已经有文件标题，去掉正文自带的那个标题，避免同一页出现两遍 */
  function agBodyHtml(ag) {
    return Uni.richDoc(agBody(ag))
      .replace(/^(<div class="uh-doc">)\s*<h1>[\s\S]*?<\/h1>/, "$1");
  }

  function agDocHtml(ag, ctx) {
    var signed = ag.state === "signed";
    var rows = [["甲方发起", ag.sentAt], ["签署时间", signed ? ag.signedAt : "—"],
      ["签署人", signed ? ag.signerName : "—"], ["有效期至", ag.expireAt]];
    if (ag.state === "rejected") rows.push(["拒签时间", ag.rejectedAt], ["拒签原因", ag.rejectReason]);
    return docShell({
      eyebrow: "ENGCHAIN 合作工作台 · O4 合作协议",
      title: "平台省级总代与二级合作企业合作协议",
      badge: agStateOfFor(ag, ctx).t,
      meta: [["协议编号", ag.id], ["模板版本", ag.version], ["生成时间", nowStamp()]],
      sections: [
        { t: "甲方 · 省级总代", rows: partyRows(ag.province) },
        { t: "乙方 · 二级合作企业", rows: partyRows(ag.sub) },
        { t: "签署信息", rows: rows },
        { t: "协议正文", html: agBodyHtml(ag) ||
          '<p class="p">正文由省代在后台编辑生成，当前版本暂无可展示的正文。</p>' }
      ],
      foot: "本文件由合作工作台于 " + nowStamp() + " 自动生成，仅作协议留痕参考；" +
        "协议效力以双方电子签存证版本为准。"
    });
  }

  function agFileCard(ag, ctx) {
    return fileCard("合作协议_" + (ag.id || "O4") + "_" + agStateOfFor(ag, ctx).file + ".html",
      agDocHtml(ag, ctx), "下载协议文件");
  }

  /* 列表行副标题：协议档案的实时状态（不与静态文案脱节） */
  function agreeSub(ag, ctx) {
    if (!ag) return "暂无协议记录";
    var st = agStateOfFor(ag, ctx);
    return st.t + " · " + (ag.id || "—") + (ag.signedAt ? " · " + ag.signedAt : "");
  }

  /* ══════════ 授权书（设置 → 资质与授权） ══════════ */
  function certDocHtml(ctx) {
    var p = ctx.s.profile || {};
    var ok = p.status === "active";
    var isSub = ctx.mode === "sub";
    var rate = isSub
      ? "按上级配置比例 " + pct(ctx.s.parent && ctx.s.parent.ratioToSub) + " 核算"
      : "总盘 = 平台合格消费 × " + pct((ctx.s.financeBase || {}).selfRate) + "，二级比例逐家单独配置";
    return docShell({
      eyebrow: "ENGCHAIN 合作工作台 · 授权证明",
      title: isSub ? "二级合作企业合作授权书" : "平台省级总代授权书",
      badge: ok ? "授权有效" : "授权已暂停",
      meta: [["授权编号", p.authNo], ["授权起始", p.since], ["生成时间", nowStamp()]],
      sections: [
        { t: "被授权主体", rows: partyRows(p) },
        {
          t: "授权事项", rows: [
            ["授权区域", isSub ? "注册经营地址所在行政区域" : "四川省（全境）"],
            ["业务范围", isSub ? "平台注册 / 认证服务推广、终端用户获客"
              : "平台注册 / 认证服务推广、工程供应链撮合、二级合作企业管理"],
            ["合作层级", isSub ? "二级合作企业（不得发展下级）" : "省级总代（下级为二级合作企业）"],
            ["收益口径", rate],
            ["授权状态", ok ? "正常" : "已暂停"],
            ["有效期", (ctx.s.agreement && ctx.s.agreement.expireAt) || "以《合作协议》约定为准"]
          ]
        },
        {
          t: "说明",
          text: "本授权书由合作工作台按平台授权记录生成，仅作授权留痕使用；" +
            "对外出示与法律效力以平台签发的盖章版本为准。"
        }
      ],
      foot: "本文件由合作工作台于 " + nowStamp() + " 自动生成。"
    });
  }

  function certFileCard(ctx) {
    var p = ctx.s.profile || {};
    return fileCard("授权书_" + (p.authNo || "AUTH") + (p.status === "active" ? "_有效" : "_已暂停") + ".html",
      certDocHtml(ctx), "下载授权书");
  }

  /* ══════════ 权限标签（与 Uni.permOf 的 14 个功能域一一对应） ══════════ */
  var PERM_LABEL = {
    invite: "邀请终端用户",
    createSub: "新建二级合作企业",
    genCode: "生成 / 作废渠道码",
    agentManage: "渠道与获客线索管理",
    review: "二级合作审批",
    setRatio: "配置二级分润比例",
    resend: "协议重发 / 撤回",
    status: "变更合作状态（暂停 / 恢复）",
    act: "对账确认与异议",
    confirm: "确认到账凭证",
    dispute: "发起结算异议",
    manageTeam: "成员与权限管理",
    exportAll: "导出经营数据",
    settingsWrite: "修改本企业设置"
  };
  var PERM_KEYS = ["invite", "createSub", "genCode", "agentManage", "review", "setRatio",
    "resend", "status", "act", "confirm", "dispute", "manageTeam", "exportAll", "settingsWrite"];

  function permCount(ctx) {
    var P = ctx.perms || {}, on = 0;
    PERM_KEYS.forEach(function (k) { if (P[k]) on++; });
    return { on: on, off: PERM_KEYS.length - on };
  }

  /* ══════════ 列表行副标题（全部取当前值，不写静态教科书文案） ══════════ */
  function subOf(key, ctx) {
    var s = ctx.s, p = s.profile || {};
    switch (key) {
      case "cert":
        return (p.status === "active" ? "授权编号 " : "已暂停 · ") + txt(p.authNo);
      case "info":
        return ctx.mode === "sub"
          ? "上级 · " + shortName(s.parent && s.parent.name)
          : "本部主体信息与联系方式";
      case "agree":
        return agreeSub(s.agreement, ctx);
      case "auth":
        return ctx.mode === "sub" ? "可开展事项与禁止事项" : "全省区域 · 两级封顶 · 费率由平台配置";
      case "perm": {
        var c = permCount(ctx);
        return "可操作 " + c.on + " 项 · 不可操作 " + c.off + " 项";
      }
      case "settle":
        return ctx.mode === "sub"
          ? "约定比例 " + pct(s.parent && s.parent.ratioToSub) + " · 异议窗口 T+5"
          : "总盘 " + pct((s.financeBase || {}).selfRate) + " · 二级 0–50%";
      case "tax":
        return "开票链路 · 销方信息 · 税费承担";
      case "duty":
        return "只读边界 · 用印与合同对接";
      case "norm":
        return "区域 · 层级 · 价格 · 资质使用";
      case "theme":
        return curTheme() === "dark" ? "已开启 · 深色界面" : "已关闭 · 浅色界面";
      case "notify":
        return notifyOnCount() + " / " + NOTIFY_ITEMS.length + " 类提醒已开启";
      case "about": {
        var v = (window.V3.scenarios && window.V3.scenarios.dataVersion) ? window.V3.scenarios.dataVersion() : "—";
        return "模板 v2026.10 · 数据 v" + v;
      }
      default:
        return "";
    }
  }

  /* ══════════ 弹窗正文 ══════════ */
  function bodyOf(key, ctx, Uni) {
    var s = ctx.s, p = s.profile || {};

    /* —— 资质与授权 —— */
    if (key === "cert") {
      var ok = p.status === "active";
      var doc = certFileCard(ctx);
      return {
        doc: doc,
        html: '<div class="uh-finhead" style="margin:10px 0 0">' +
          '<span class="uh-eyebrow">' + (ctx.mode === "sub" ? "二级合作授权" : "省级总代授权") + '</span>' +
          '<span class="uh-badge uh-badge--' + (ok ? "ok" : "bad") + '">' +
          (ok ? "授权有效" : "授权已暂停") + '</span></div>' +
          partyBlock("被授权主体", p) +
          secHead("授权信息") +
          kv("授权编号", p.authNo, p.authNo) + kv("授权起始", p.since) +
          kv("授权状态", ok ? "正常" : "已暂停") +
          kv("授权区域", ctx.mode === "sub" ? "注册经营地址所在行政区域" : "四川省（全境）") +
          kv("授权期限", (s.agreement && s.agreement.expireAt)
            ? s.agreement.expireAt + "（" + expiryText(s.agreement.expireAt) + "）"
            : "以《合作协议》约定为准") +
          secHead("授权文件") + doc.card +
          note("授权书由合作工作台按平台授权记录生成；对外出示以平台签发的盖章版本为准。")
      };
    }

    /* —— 合作信息 —— */
    if (key === "info") {
      if (ctx.mode === "sub") {
        var pt = s.parent || {};
        return {
          html: '<div class="uh-finhead" style="margin:10px 0 0">' +
            '<span class="uh-eyebrow">上级 · 省级总代</span>' +
            '<span class="uh-badge uh-badge--gold">' + pct(pt.ratioToSub) + ' 约定</span></div>' +
            partyBlock("主体信息", pt) +
            secHead("合作信息") + kv("合作起始", pt.since) +
            kv("约定比例", pct(pt.ratioToSub) + "（只读）") + kv("发展下级", "永久禁止") +
            note("约定比例由上级省代配置，本端只读；调整需在合作协议框架内由上级发起。")
        };
      }
      return {
        html: '<div class="uh-finhead" style="margin:10px 0 0">' +
          '<span class="uh-eyebrow">本部 · 省级总代</span>' +
          '<span class="uh-badge uh-badge--' + (p.status === "active" ? "ok" : "bad") + '">' +
          (p.status === "active" ? "合作正常" : "已暂停") + '</span></div>' +
          partyBlock("主体信息", p) +
          secHead("合作关系") + kv("合作起始", p.since) +
          kv("合作层级", "省级总代（下级为二级合作企业）") +
          kv("授权编号", p.authNo, p.authNo) +
          note("本部为合作发起方；二级合作企业主体信息见「二级合作」页。")
      };
    }

    /* —— 合作协议 —— */
    if (key === "agree") {
      var ag = s.agreement || null;
      if (!ag) {
        return { html: note("暂无合作协议记录，请联系上级省代发起。") };
      }
      var st = agStateOfFor(ag, ctx);
      var signed = ag.state === "signed";
      var doc2 = agFileCard(ag, ctx);
      var mine = agCanSign(ctx);
      var n = signed
        ? "协议经双方电子签确认后生效" + (ag.expireAt
          ? "，有效期至 " + ag.expireAt + "（" + expiryText(ag.expireAt) + "）" +
          (daysLeft(ag.expireAt) !== null && daysLeft(ag.expireAt) <= 60 ? "，请及时联系上级省代安排续签" : "")
          : "") + "。"
        : ag.state === "rejected"
          ? (mine
            ? "你已拒签该协议" + (ag.rejectedAt ? "（" + ag.rejectedAt + "）" : "") + "，如需继续合作请联系上级省代重新发起。"
            : "该协议已被拒签" + (ag.rejectedAt ? "（" + ag.rejectedAt + "）" : "") + "，如需继续合作请联系企业管理员。")
          : (mine
            ? "协议已由甲方于 " + txt(ag.sentAt) + " 发起，待你签署后生效；请在工作台「待办事项」中处理。"
            : "协议已由甲方于 " + txt(ag.sentAt) + " 发起，待企业管理员签署后生效；本身份仅可查看档案。");
      return {
        doc: doc2,
        html: '<div class="uh-finhead" style="margin:10px 0 0">' +
          '<span class="uh-eyebrow">O4 模板 · ' + ui.esc(txt(ag.version)) + '</span>' +
          '<span class="uh-badge uh-badge--' + st.cls + '">' + ui.esc(st.t) + '</span></div>' +
          kv("协议编号", ag.id) +
          partyBlock("甲方 · 省级总代", ag.province) +
          partyBlock("乙方 · 二级合作企业", ag.sub) +
          secHead("签署信息") + kv("甲方发起", ag.sentAt) +
          kv("签署时间", signed ? ag.signedAt : "—") +
          kv("签署人", signed ? ag.signerName : "—") +
          kv("有效期至", ag.expireAt) +
          (ag.state === "rejected" ? kv("拒签时间", ag.rejectedAt) + kv("拒签原因", ag.rejectReason) : "") +
          secHead("协议正文") +
          (Uni.richDoc(agBody(ag)) ||
            '<div class="uh-plain">正文由省代在后台编辑生成，当前版本暂无可展示的正文。</div>') +
          secHead("协议文件") + doc2.card +
          note(n)
      };
    }

    /* —— 授权范围 —— */
    if (key === "auth") {
      var isSub = ctx.mode === "sub";
      var region = isSub ? "以注册经营地址所在行政区域为限" : "四川省（全境）";
      var rows = isSub ? [
        { t: "可开展", c: bullets(["直接邀请并服务终端用户", "按约定比例取得经营所得（只读口径）",
          "跟进自有渠道线索与已绑定用户"]) },
        { t: "禁止", c: bullets(["发展下级合作企业（两级封顶）", "自行调整费率与分润比例",
          "跨注册区域开展业务"]) }
      ] : [
        { t: "可开展", c: bullets(["平台注册 / 认证服务推广", "工程供应链撮合与终端用户服务",
          "拓展与管理二级合作企业"]) },
        { t: "禁止", c: bullets(["再发展下级代理（两级封顶）", "自行变更总盘费率",
          "超出四川省域范围开展业务"]) }
      ];
      return {
        html: secHead("区域与期限") + kv("授权区域", region) +
          kv("合作起始", p.since) +
          kv("期限", (s.agreement && s.agreement.expireAt)
            ? s.agreement.expireAt + "（" + expiryText(s.agreement.expireAt) + "）"
            : "以《合作协议》约定为准") +
          secHead("授权内容") + clauses(rows) +
          note("规模、范围与费率由" + (isSub ? "上级省代" : "平台") + "配置，本端只读；具体以《合作协议》条款为准。") +
          (isSub ? goBtn("查看合作协议", "agreement.html") : "")
      };
    }

    /* —— 角色与权限 —— */
    if (key === "perm") {
      var P = ctx.perms || Uni.permOf(ctx.identity) || {};
      var on = [], off = [];
      PERM_KEYS.forEach(function (k) { (P[k] ? on : off).push(PERM_LABEL[k]); });
      var extra = "";
      if (ctx.identity === "staff" || ctx.identity === "sub_staff") {
        var me = (s.team || []).filter(function (m) { return m.role === "staff" && m.name === ctx.staffName; })[0];
        extra = secHead("我的归属") +
          kv("员工姓名", ctx.staffName) +
          kv("本人渠道码", (me && me.channel) || "由企业管理员分配", me && me.channel) +
          kv("线索归属", "以平台「绑定」记录为准，线下约定不改变归属");
      }
      return {
        html: '<div class="uh-sheetkv"><span class="k">当前视角</span>' +
          '<span class="uh-sheetkv__r"><span class="v">' + ui.esc(ctx.identityLabel || "") + '</span></span></div>' +
          clauses([
            { t: "可操作（" + on.length + "）", c: on.length ? bullets(on) : "· 无（仅可查看）" },
            { t: "不可操作（" + off.length + "）", c: off.length ? bullets(off) : "· 无" }
          ]) + extra +
          note("权限与身份一一对应；身份变更请在「团队」中由企业管理员操作。") +
          /* 暂停态（ctx.readonly）不再给出管理入口：跳到做不了事的页面只会制造挫败 */
          (P.manageTeam && !ctx.readonly ? goBtn("前往团队管理", "team.html") : "")
      };
    }

    /* —— 结算口径 —— */
    if (key === "settle") {
      if (ctx.mode === "sub") {
        var pt2 = s.parent || {};
        var c0 = (s.calc || [])[0] || {};
        return {
          html: secHead("核算口径") +
            kv("约定比例", pct(pt2.ratioToSub) + "（只读）") +
            kv("核算基数", "平台合格消费（本企业获客用户）") +
            kv("本期账期", (c0.month || "—") + " · 出账 " + txt(c0.issueAt)) +
            clauses([
              { t: "异议窗口", c: "出账后 15 天内可发起异议；超期仅提醒，不自动确认。" },
              { t: "款项登记", c: "款项由上级省代线下支付，到账凭证在「对账中心」登记留痕。" },
              { t: "钱包与提现", c: "本端没有钱包、没有自动提现；台账余额仅为只读口径。" },
              { t: "计入口径", c: "退货、退款、取消订单不计入合格消费。" }
            ]) +
            note("比例调整需在合作协议框架内由上级发起，调整记录可向上级索取。") +
            goBtn("前往对账中心", "reconcile-sub.html")
        };
      }
      var rate = (s.financeBase || {}).selfRate;
      var logs = s.ratioLog || [];
      var logHtml = logs.length ? secHead("比例变更留痕") + logs.map(function (l) {
        return '<div class="uh-clause"><div class="no">' + ui.esc(l.sub || "—") + '　' +
          pct(l.from) + ' → ' + pct(l.to) + '</div><div class="c">' +
          ui.esc((l.at || "") + " · " + (l.by || "")) + (l.note ? "　" + ui.esc(l.note) : "") + '</div></div>';
      }).join("") : secHead("比例变更留痕") + '<div class="uh-clause"><div class="c">暂无比例调整记录。</div></div>';
      return {
        html: secHead("核算口径") +
          kv("总盘口径", "平台合格消费 × " + pct(rate)) +
          kv("二级比例", "0–50%，逐家单独配置") +
          clauses([
            { t: "对账时限", c: "第一层（与平台）T+5 工作日异议窗口；第二层（与二级）出账后 15 天仅提醒，不自动确认。" },
            { t: "款项登记", c: "本端没有钱包、没有自动提现；线下付款凭凭证登记留痕。" },
            { t: "计入口径", c: "退货、退款、取消订单不计入合格消费。" }
          ]) + logHtml +
          note("比例变更需留痕可追溯，作为结算纠纷的举证依据。") +
          goBtn("前往对账中心", "reconcile.html")
      };
    }

    /* —— 税务与开票 —— */
    if (key === "tax") {
      var isSub2 = ctx.mode === "sub";
      var direction = isSub2
        ? [{ t: "开票方向", c: "二级合作企业 → 上级省代：按《合作协议》约定的类型与时点开具。" },
           { t: "平台侧", c: "平台向终端用户开具其实际购买服务的发票。" }]
        : [{ t: "开票方向", c: "省代 → 平台：按平台服务协议约定开具；平台 → 终端用户：由平台开具。" },
           { t: "二级侧", c: "二级合作企业向省代开具合作服务发票，具体以 O4 协议条款为准。" }];
      return {
        html: secHead("销方信息（开票抬头）") +
          kv("开票抬头", p.name, p.name) +
          kv("纳税人识别号", p.uscc, p.uscc) +
          kv("注册地址", p.address) +
          secHead("开票方向") + clauses(direction) +
          secHead("税费与口径") + clauses([
            { t: "税费承担", c: "各方依法各自承担税费，平台不代扣代缴。" },
            { t: "计入口径", c: "退货、退款、取消订单不计入合格消费，已开票部分按税务规则处理。" },
            { t: "余额口径", c: "合作所得为只读台账口径，不构成可提现余额。" }
          ]) +
          note("银行账户信息由平台财务系统在首次结算前采集，本端不存储账户信息。")
      };
    }

    /* —— 法定代表人职责 —— */
    if (key === "duty") {
      return {
        html: '<div class="uh-finhead" style="margin:10px 0 0">' +
          '<span class="uh-eyebrow">法定代表人 · 只读视角</span>' +
          '<span class="uh-badge uh-badge--info">监督角色</span></div>' +
          clauses([
            { t: "可查看", c: bullets(["全部经营数据、对账与结算口径", "协议与授权档案（含下载）",
              "团队成员、渠道与获客线索", "税务与开票信息"]) },
            { t: "不执行", c: bullets(["登记、确认、异议、平账等账务操作", "合作审批、比例配置、协议签署",
              "成员增删与权限变更"]) }
          ]) +
          secHead("事项对接") +
          kv("用印与合同", p.contact || "—") +
          kv("联系电话", p.phone || "—", p.phone) +
          kv("授权撤回", "由企业管理员或平台客户经理发起，撤回后本视角即时失效") +
          note("本视角用于查看与监督；对外签署与用印以平台电子签及盖章流程为准。")
      };
    }

    /* —— 经营红线 —— */
    if (key === "norm") {
      var isSub3 = ctx.mode === "sub";
      return {
        html: clauses([
          { t: "区域保护", c: (isSub3 ? "以注册经营地址所在行政区域为限" : "四川省（全境）") +
            "，不得跨区域开展业务或截取他区线索。" },
          { t: "层级限制", c: "两级封顶：平台 → 省级总代 → 二级合作企业。任何一方不得发展下级。" },
          { t: "价格与返点", c: "不得自行定价，不得向终端用户承诺返点、补贴或保收益。" },
          { t: "资质使用", c: "不得转授权、转租资质，不得冒用平台或上级名义对外签署与承诺。" },
          { t: "线索归属", c: "以平台「绑定」记录为准；线下约定不改变平台归属与分润归属。" },
          { t: "数据处理", c: "用户信息仅用于约定业务，不得转售、导出或用于第三方推广。" },
          { t: "违规处理", c: "核实后暂停合作（页面转为只读）→ 限期整改 → 未整改终止合作。" }
        ]) + note("红线条款以《合作协议》与平台规则为准；本页为摘要，不替代协议原文。")
      };
    }

    /* —— 通知提醒 —— */
    if (key === "notify") {
      var n = readNotify();
      return {
        html: NOTIFY_ITEMS.map(function (it) {
          return '<button type="button" class="uh-sheetkv uh-notirow" data-nk="' + it.k + '">' +
            '<span class="uh-notirow__m"><span class="uh-notirow__t">' + ui.esc(it.t) + '</span>' +
            '<span class="uh-notirow__s">' + ui.esc(it.s) + '</span></span>' +
            '<span class="uh-switch' + (n[it.k] ? " uh-switch--on" : "") + '"></span></button>';
        }).join("") +
          note("提醒通过「消息」页与站内通知送达。本期仅记录偏好，消息中心暂按全量推送。")
      };
    }

    /* —— 关于与版本 —— */
    var ver = (window.V3.scenarios && window.V3.scenarios.dataVersion)
      ? window.V3.scenarios.dataVersion() : "—";
    return {
      html: kv("平台名称", "ENGCHAIN 合作工作台") +
        kv("界面版本", "uni v2026.11") +
        kv("合作协议模板", "O4 · v2026.10") +
        kv("数据版本", "v" + ver) +
        kv("当前场景", ctx.scenarioKey || "—") +
        kv("适用范围", ctx.mode === "sub" ? "二级合作企业" : "四川省 · 省级总代") +
        kv("协助与反馈", "请联系上级省代或平台客户经理") +
        note("本工作台展示的数据为业务口径留痕，不构成财务凭证或可提现余额。")
    };
  }

  /* ══════════ 弹窗交互绑定 ══════════ */
  function bindCopy(el, Uni) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-copy]"), function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        b.classList.add("uh-copy--done");
        setTimeout(function () { b.classList.remove("uh-copy--done"); }, 1200);
        copyText(b.getAttribute("data-copy"), Uni);
      });
    });
  }

  function bindGo(el, Uni) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-go]"), function (b) {
      b.addEventListener("click", function () {
        var route = b.getAttribute("data-go");
        if (el.close) el.close();
        setTimeout(function () { Uni.navTo(route); }, 140);
      });
    });
  }

  function bindNotifySwitch(el, Uni) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-nk]"), function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-nk");
        var n = readNotify();
        n[k] = n[k] ? 0 : 1;
        writeNotify(n);
        var sw = b.querySelector(".uh-switch");
        if (sw) sw.classList.toggle("uh-switch--on", !!n[k]);
        Uni.toast(n[k] ? "已开启提醒" : "已关闭提醒", "ok");
      });
    });
  }

  /* ══════════ 身份卡 ══════════ */
  function idCardHtml(ctx) {
    var p = ctx.s.profile || {};
    var paused = p.status !== "active";
    var legal = ctx.identity === "legal_rep" || ctx.identity === "sub_legal";
    var staff = ctx.identity === "staff" || ctx.identity === "sub_staff";
    /* 徽标必须与身份一致：员工既非「可管理」也非「只读」，是受限视角 */
    var badge = paused ? { t: "已暂停", cls: "bad" }
      : legal ? { t: "只读", cls: "mute" }
        : staff ? { t: "员工视角", cls: "info" }
          : { t: "可管理", cls: "gold" };
    var ch = String(p.name || "企").slice(0, 1);
    /* 徽标放在身份行内：企业名常在 12–16 字，与徽标同行会把名字挤到第二行断在词中 */
    /* 身份卡即演示身份切换入口（此前为纯静态，全站无任何身份切换 UI）。
       键盘可达：role=button + tabindex=0，回车/空格触发，与点击同路。 */
    return '<section class="uh-sec"><div class="uh-idcard uh-idcard--static" data-act="switch-identity"' +
      ' role="button" tabindex="0" aria-label="切换演示身份，当前 ' + ui.esc(ctx.identityLabel || "") + '">' +
      '<div class="uh-idcard__row">' +
      '<span class="uh-avatar">' + ui.esc(ch) + '</span>' +
      '<span class="mn"><span class="nm">' + ui.esc(txt(p.name)) + '</span>' +
      '<span class="rl"><span class="uh-badge uh-badge--' + badge.cls + '">' + ui.esc(badge.t) +
      '</span>' + ui.esc(ctx.identityLabel || "") + '</span></span>' +
      '<span class="uh-chev">' + ui.icon("chev", 16) + '</span>' +
      '</div>' +
      '<div class="meta"><span>统一社会信用代码 ' + ui.esc(txt(p.uscc)) + '</span>' +
      '<span>自 ' + ui.esc(txt(p.since)) + '</span></div>' +
      '</div></section>';
  }

  /* ══════════ 演示身份切换（全域 6 个身份，按当前域只列 3 个） ══════════
     工作台是场景/身份的权威：切换后写回声键（engchain-workbench-echo，带 uid），
     preview 侧栏与「我的」身份胶囊随之更新；跨域切换另留意图键供账号层补应用。 */
  var IDENTITY_ORDER = [
    ["admin", "省级总代 · 管理员"],
    ["legal_rep", "省级总代 · 法定代表人"],
    ["staff", "省级总代 · 员工"],
    ["sub_admin", "二级合作企业 · 管理员"],
    ["sub_legal", "二级合作企业 · 法定代表人"],
    ["sub_staff", "二级合作企业 · 员工"]
  ];
  function identitySheet(ctx, Uni) {
    var cur = ctx.identity, curMode = ctx.mode;
    /* 只列本域 3 个身份（2026-11-02 决策 1A）：工作台不再提供跨域切换，
       层级由演示场景决定；跨域切换既会让账号与场景分叉，也是越权的入口。 */
    var list = IDENTITY_ORDER.filter(function (p) {
      return (p[0].indexOf("sub_") === 0 ? "sub" : "province") === curMode;
    });
    var body = '<div class="uh-padx"><div class="uh-list">' +
      list.map(function (p) {
        var on = p[0] === cur;
        var sub = on ? "当前身份" : "同域切换，保留当前演示数据";
        return '<button type="button" class="uh-row" data-id="' + p[0] + '"' +
          (on ? ' aria-current="true"' : '') + '>' +
          '<span class="uh-row__main"><span class="uh-row__t">' + ui.esc(p[1]) + '</span>' +
          '<span class="uh-row__s">' + ui.esc(sub) + '</span></span>' +
          (on ? '<span class="uh-badge uh-badge--gold">当前</span>'
            : '<span class="uh-chev">' + ui.icon("chev", 16) + '</span>') +
          '</button>';
      }).join('') + '</div>' +
      '<div class="uh-footnote">演示用身份切换，不产生真实业务操作记录。<br>' +
      '切换省级总代 / 二级合作层级，请到演示场景选择对应账号。</div></div>';
    var sh = Uni.sheet({ title: "切换演示身份", body: body, footer: [{ t: "关闭", kind: "ghost" }] });
    Array.prototype.forEach.call(sh.querySelectorAll("[data-id]"), function (n) {
      n.addEventListener("click", function () {
        var id = n.getAttribute("data-id");
        sh.close();
        if (id === cur) return;
        var r = Uni.switchIdentity(id);
        if (r && r.ok === false) Uni.toast(r.reason || "身份切换失败", "err");
      });
    });
  }

  /* ══════════ 只读锁条（按原因四态化） ══════════ */
  function lockOf(ctx) {
    if (!ctx.readonly) return null;
    var paused = ((ctx.s.profile || {}).status || "active") !== "active";
    var legal = ctx.identity === "legal_rep" || ctx.identity === "sub_legal";
    if (legal) {
      return {
        t: "法定代表人视角（只读）",
        s: "可查看全部经营信息与口径，不执行任何操作。" +
          (paused ? "当前合作状态为「已暂停」，请联系上级省代。" : "用印与合同事项请联系企业管理员。")
      };
    }
    if (ctx.identity === "staff" || ctx.identity === "sub_staff") {
      return {
        t: "员工视角（受限）",
        s: "仅可查看本人渠道码与本人线索；邀请审批、比例配置、对账确认与协议事项由企业管理员执行。"
      };
    }
    return {
      t: "合作已暂停（仅可查看）",
      s: "暂停期间不可新增业务、签署协议或修改设置；请联系上级省代处理恢复。"
    };
  }

  /* ══════════ 唯一渲染路径 ══════════ */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var lock = lockOf(ctx);
    var html = idCardHtml(ctx);

    if (lock) {
      html += '<section class="uh-sec" style="margin-top:12px"><div class="uh-lockbar">' +
        ui.icon("lock", 18) + '<div><span class="lb-t">' + ui.esc(lock.t) + '</span>' +
        '<span class="lb-s">' + ui.esc(lock.s) + '</span></div></div></section>';
    }

    (vm.groups || []).forEach(function (g) {
      html += '<div class="uh-grp"><div class="uh-grp__t">' + ui.esc(g.t) + '</div>' +
        '<div class="uh-list">' + g.keys.map(function (k) { return rowHtml(k, ctx); }).join("") +
        '</div></div>';
    });

    var ver = (window.V3.scenarios && window.V3.scenarios.dataVersion)
      ? window.V3.scenarios.dataVersion() : "—";
    html += '<section class="uh-sec"><div class="uh-list">' + rowHtml("about", ctx) + '</div>' +
      '<div class="uh-footnote">ENGCHAIN 合作工作台 · 数据版本 v' + ui.esc(ver) +
      ' · 本页信息为只读说明，操作请前往对应功能页</div></section>';

    el.innerHTML = html;

    /* 身份卡 → 演示身份切换。回车/空格与点击同路（role=button 需自带键盘语义）。 */
    var idcard = el.querySelector('[data-act="switch-identity"]');
    if (idcard) {
      idcard.addEventListener("click", function () { identitySheet(ctx, Uni); });
      idcard.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          identitySheet(ctx, Uni);
        }
      });
    }

    Array.prototype.forEach.call(el.querySelectorAll("[data-key]"), function (n) {
      n.addEventListener("click", function () {
        var key = n.getAttribute("data-key");
        if (key === "theme") { toggleThemeRow(n, Uni); return; }
        var body = bodyOf(key, ctx, Uni);
        var ov = Uni.center({
          title: META[key].t,
          /* .cert-modal-scroll 为通栏容器，正文必须自带左右留白 */
          body: '<div class="uh-padx">' + body.html + '</div>',
          footer: [{ t: "关闭", kind: "primary" }]
        });
        if (body.doc) bindDownload(ov, body.doc, Uni);
        bindCopy(ov, Uni);
        bindGo(ov, Uni);
        bindNotifySwitch(ov, Uni);
      });
    });
  }

  function rowHtml(key, ctx) {
    var m = META[key];
    var isTheme = key === "theme";
    var dark = curTheme() === "dark";
    var right = isTheme
      ? '<span class="uh-switch' + (dark ? " uh-switch--on" : "") + '" aria-hidden="true"></span>'
      : '<span class="uh-chev">' + ui.icon("chev", 16) + '</span>';
    return '<button type="button" class="uh-row" data-key="' + key + '"' +
      (isTheme ? ' aria-pressed="' + (dark ? "true" : "false") + '"' : "") + '>' +
      '<span class="uh-row__ic">' + ic(isTheme ? themeIcon() : m.icon, 18) + '</span>' +
      '<span class="uh-row__main"><span class="uh-row__t">' + ui.esc(m.t) + '</span>' +
      '<span class="uh-row__s">' + ui.esc(subOf(key, ctx)) + '</span></span>' + right + '</button>';
  }

  function toggleThemeRow(node, Uni) {
    Uni.toggleTheme();
    var dark = curTheme() === "dark";
    var sw = node.querySelector(".uh-switch");
    if (sw) sw.classList.toggle("uh-switch--on", dark);
    node.setAttribute("aria-pressed", dark ? "true" : "false");
    var sEl = node.querySelector(".uh-row__s");
    if (sEl) sEl.textContent = dark ? "已开启 · 深色界面" : "已关闭 · 浅色界面";
    var icEl = node.querySelector(".uh-row__ic");
    if (icEl) icEl.innerHTML = ic(themeIcon(), 18);
    Uni.toast(dark ? "已切换为深色模式" : "已切换为浅色模式", "ok");
  }

  window.Uni.register({
    view: "uni-settings",
    route: "settings.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
