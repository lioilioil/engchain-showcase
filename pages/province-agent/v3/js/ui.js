/* ============================================================
   ui.js · 图标 / Toast / Sheet / Modal / 工具（内联 SVG，无外链）
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function money(n) {
    var v = Math.round(Number(n) || 0);
    var neg = v < 0;
    var s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-¥" : "¥") + s;
  }
  function moneyPlain(n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  /* 展示级大数字：¥ 符号弱化（小号 + 降透明度），对齐 App demo 数字排版口径 */
  function moneyD(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? "-" : "") + '<span class="cur">¥</span>' + moneyPlain(v);
  }

  var P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
    invite: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.7-3.2 2.9-4.8 5.5-4.8s4.8 1.6 5.5 4.8"/><path d="M18 8v6M15 11h6"/>',
    reconcile: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8h8M8 12h5M8 16h3.5"/><path d="M15.5 15l2 2 3.2-3.4"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c.9-3.8 3.9-5.6 7.5-5.6s6.6 1.8 7.5 5.6"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    qr: '<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><path d="M13 13h3v3M20 16v4h-4M16 20h1"/>',
    share: '<circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="5.5" r="2.6"/><circle cx="17.5" cy="18.5" r="2.6"/><path d="M8.3 10.7l7-3.9M8.3 13.3l7 3.9"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    camera: '<rect x="3.5" y="7" width="17" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7 10 4h4l1.5 3"/>',
    check: '<path d="M4.5 12.5l5 5L20 7"/>',
    warn: '<path d="M12 3.5 22 20H2L12 3.5Z"/><path d="M12 9.5v5.5M12 17.8v.3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    file: '<path d="M6 3.5h8L20 9.5V20.5H6z"/><path d="M13.5 3.5V10H20"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L4 8"/><path d="M4 3.5V8h4.5"/><path d="M12 8v4.4l3 1.8"/>',
    edit: '<path d="M4 16.5 15.5 5l3.5 3.5L7.5 20H4z"/><path d="M13.5 7 17 10.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    bank: '<path d="M4 9.5 12 4l8 5.5"/><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7"/><path d="M3.5 20h17"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
    filter: '<path d="M4 6h16l-6 7v5l-4 2v-7z"/>',
    crown: '<path d="M3.5 8 8 11.5 12 5l4 6.5L20.5 8 19 18H5z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 20c1-3.7 3.8-5.5 7-5.5s6 1.8 7 5.5"/>',
    link: '<path d="M9.5 14.5l5-5"/><path d="M8 11 6.5 12.5a3.5 3.5 0 0 0 5 5L13 16"/><path d="M16 8l1.5-1.5a3.5 3.5 0 0 0-5-5L11 3"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    doc: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 7.8-7.5 9.5C7.7 19.3 4.5 16.1 4.5 11.5V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.4"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M12.5 16V8M17 16v-7"/>',
    receipt: '<path d="M5 3.5h14v17l-2.5-1.5L14 20.5l-2-1.5-2 1.5L7.5 19 5 20.5z"/><path d="M9 8h6M9 12h6M9 16h3"/>'
  };
  function icon(name, size) {
    var body = P[name] || P.doc;
    var s = size || 22;
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }

  /* Toast */
  var toastEl = null;
  var toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "v3-toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = "v3-toast show" + (kind ? " v3-toast--" + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "v3-toast"; }, 2100);
  }

  /* 通用 overlay */
  function ensureOverlay(cls) {
    var ov = document.querySelector(".v3-overlay." + cls);
    if (ov) return ov;
    ov = document.createElement("div");
    ov.className = "v3-overlay " + cls;
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeOverlay(ov); });
    return ov;
  }
  function closeOverlay(ov) { ov.classList.remove("show"); }
  function closeAll() { document.querySelectorAll(".v3-overlay.show").forEach(function (o) { o.classList.remove("show"); }); }

  function openSheet(opt) {
    var ov = ensureOverlay("v3-sheet-wrap");
    var ft = (opt.footer || []).map(function (b, i) {
      return '<button class="v3-btn ' + (b.kind || "v3-btn--ghost") + (b.block ? " v3-btn--block" : "") + '" data-fi="' + i + '">' + esc(b.t) + "</button>";
    }).join("");
    ov.innerHTML =
      '<div class="v3-sheet" role="dialog" aria-modal="true">' +
      '<div class="v3-sheet__handle"></div>' +
      '<div class="v3-sheet__hd"><div class="t">' + esc(opt.title || "") + '</div>' +
      '<button class="x" data-close>×</button></div>' +
      '<div class="v3-sheet__bd">' + (opt.body || "") + '</div>' +
      (ft ? '<div class="v3-sheet__ft">' + ft + "</div>" : "") +
      "</div>";
    ov.querySelector('[data-close]').addEventListener("click", function () { closeOverlay(ov); });
    Array.prototype.forEach.call(ov.querySelectorAll("[data-fi]"), function (btn) {
      btn.addEventListener("click", function () {
        var b = opt.footer[Number(btn.getAttribute("data-fi"))];
        if (b && b.onClick) { var ret = b.onClick(ov); if (ret !== false) closeOverlay(ov); }
      });
    });
    requestAnimationFrame(function () { ov.classList.add("show"); });
    if (opt.onMount) opt.onMount(ov);
    return ov;
  }
  function openModal(opt) {
    var ov = ensureOverlay("v3-modal-wrap");
    ov.innerHTML =
      '<div class="v3-modal" role="alertdialog">' +
      '<div class="ic">' + (opt.icon ? icon(opt.icon, 24) : "!") + "</div>" +
      '<div class="t">' + esc(opt.title || "") + "</div>" +
      '<div class="d">' + (opt.body || "") + "</div>" +
      '<div class="v3-modal__ft">' +
      (opt.cancel !== false ? '<button class="v3-btn v3-btn--ghost" data-cancel>' + esc(opt.cancelText || "取消") + "</button>" : "") +
      '<button class="v3-btn ' + (opt.danger ? "v3-btn--danger" : "v3-btn--primary") + '" data-ok>' + esc(opt.okText || "确定") + "</button>" +
      "</div></div>";
    var cb = ov.querySelector("[data-cancel]");
    if (cb) cb.addEventListener("click", function () { closeOverlay(ov); });
    ov.querySelector("[data-ok]").addEventListener("click", function () {
      if (!opt.onOk || opt.onOk(ov) !== false) closeOverlay(ov);
    });
    requestAnimationFrame(function () { ov.classList.add("show"); });
    return ov;
  }

  /* 凭证：真实读取文件；图片压缩为缩略 dataURL，其余仅留名（原型） */
  function fileToVoucher(file) {
    return new Promise(function (resolve) {
      var v = { name: file.name, kind: file.type.indexOf("image") >= 0 ? "image" : "file" };
      if (v.kind === "image" && file.size <= 1.6e6) {
        var rd = new FileReader();
        rd.onload = function () { v.thumb = String(rd.result); resolve(v); };
        rd.onerror = function () { resolve(v); };
        rd.readAsDataURL(file);
      } else { resolve(v); }
    });
  }

  /* 文案映射 */
  var STAGE = { registered: "已注册", onboarded: "已入驻", paid: "已消费", repaid: "已复购", lost: "已流失" };
  var STAGE_BADGE = { registered: "v3-badge--pending", onboarded: "v3-badge--active", paid: "v3-badge--gold", repaid: "v3-badge--active", lost: "v3-badge--neutral" };
  var ACCT = { active: "生效中", suspended: "已暂停", terminated: "已终止", revoked: "已撤销", sealed: "已封存", pending: "待生效" };
  var ACCT_BADGE = { active: "v3-badge--active", suspended: "v3-badge--suspended", terminated: "v3-badge--terminated", revoked: "v3-badge--revoked", sealed: "v3-badge--sealed", pending: "v3-badge--pending" };
  var REG = { pending_confirm: "待确认", confirmed: "已确认", disputed: "有异议", void: "已作废" };
  var REG_BADGE = { pending_confirm: "v3-badge--pending", confirmed: "v3-badge--active", disputed: "v3-badge--suspended", void: "v3-badge--neutral" };

  function emptySvg(theme) {
    var base = '<circle cx="32" cy="32" r="28" class="bg-s" stroke-width=".8" fill="none"/>' +
      '<circle cx="32" cy="32" r="20" class="bg-f" stroke="none"/>';
    var inner = {
      tray: '<path d="M22 30h20M24 35h16M27 40h10" class="ln" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
        '<circle cx="42" cy="25" r="2.5" class="acf" opacity=".5"/>',
      doc: '<rect x="24" y="21" width="16" height="22" rx="2.5" class="ac" stroke-width="1.3" fill="none"/>' +
        '<path d="M28 28h8M28 33h6M28 38h3" class="ln" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
      chart: '<path d="M22 42V22M22 42h20" class="ln" stroke-width="1.3" stroke-linecap="round" fill="none"/>' +
        '<rect x="26" y="33" width="4" height="9" rx="1" class="acf" opacity=".35"/>' +
        '<rect x="32" y="27" width="4" height="15" rx="1" class="acf" opacity=".55"/>' +
        '<rect x="38" y="30" width="4" height="12" rx="1" class="acf" opacity=".25"/>',
      user: '<circle cx="32" cy="27" r="5.5" class="ac" stroke-width="1.3" fill="none"/>' +
        '<path d="M22 43c1.5-5 5.5-7.5 10-7.5s8.5 2.5 10 7.5" class="ln" stroke-width="1.3" stroke-linecap="round" fill="none"/>',
      crown: '<path d="M22 37l5-10 5 6 5-6 5 10z" class="ac" stroke-width="1.3" stroke-linejoin="round" fill="none"/>' +
        '<path d="M22 37h24" class="ac" stroke-width="1.3" stroke-linecap="round" fill="none"/>' +
        '<circle cx="32" cy="28" r="1.5" class="acf" opacity=".4"/>'
    };
    return '<svg class="v3-empty-svg" viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">' +
      base + (inner[theme] || inner.tray) + "</svg>";
  }
  function emptyHtml(title, desc, theme) {
    return '<div class="t">' + emptySvg(theme) + "</div>" +
      '<div class="t">' + esc(title) + "</div>" +
      (desc ? '<div class="d">' + desc + "</div>" : "");
  }

  window.V3 = window.V3 || {};
  window.V3.ui = {
    esc: esc, money: money, moneyD: moneyD, moneyPlain: moneyPlain, icon: icon,
    toast: toast, openSheet: openSheet, openModal: openModal, closeAll: closeAll,
    fileToVoucher: fileToVoucher,
    emptySvg: emptySvg, emptyHtml: emptyHtml,
    STAGE: STAGE, STAGE_BADGE: STAGE_BADGE, ACCT: ACCT, ACCT_BADGE: ACCT_BADGE, REG: REG, REG_BADGE: REG_BADGE
  };
})();
