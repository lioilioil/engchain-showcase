/* ============================================================
   uni-shared.js · 统一副本独立页共享层（v3 只读复用 + 系统 UI 视觉）
   —— 第三次重构：入口壳 + hash 路由已废除，14 功能页各自独立 HTML。
   本文件职责：
   - boot：syncAppMode（V3_APP 先于 store.load）→ 加载/播种 → ctx → 主题
   - chrome：状态栏（系统 UI.statusBar）、铃铛角标、系统 .app-tabbar 三主入口
   - 系统视觉包装：uni.sheet（.sheet 家族）/ uni.center（.cert-modal 家族）
     / uni.dialog（.dialog）/ uni.toast（.toast）/ uni.emptyHtml（.empty-state）
   - actGuarded 统一守卫；navTo 真实链接（route → 独立页文件，无 hash 路由）
   - 跨页 storage 联动（场景键 / 主题权威值）；URL 演示钩子 ?scenario=&role=&theme=
   公共库只读复用：window.V3.store / V3.scenarios / V3.ui；系统 UI 只读复用：window.UI。
   S1/S2：本文件不含任何身份分支 DOM；身份差异仍由各页 STATE_VARIANTS 驱动。

   T2 统一身份模型（决策4）：三角色 × 两级企业
   - 省代侧：admin（管理员·全部操作）/ legal_rep（法定代表人·只读全量）/ staff（员工·仅本人获客）
   - 二级侧：sub_admin / sub_legal / sub_staff（同构）
   - 旧角色兼容映射：boss→admin、sub_owner→sub_admin；staff/sub_staff 不变；
     页面 STATE_VARIANTS 未定义新身份时，回退 admin/sub_admin 变体并强制只读
     （stateVariantFor），保证三角色在任何页均可正确渲染，不破坏既有页结构。
   ============================================================ */
(function (global) {
  "use strict";

  var STATE_KEY = "engchain-v3-demo-scenario"; // 与 store.js 同源（只读常量）
  var THEME_KEY = "engchain-theme";            // 主题权威值
  var views = {};
  var ctx = null, container = null, pageKey = null;
  var STATUS_TICK = null;

  /* ---------- T2 身份元数据（6 身份权威定义） ---------- */
  var IDENTITY_META = {
    admin:     { mode: "province", label: "省级总代 · 管理员",     readonly: false },
    legal_rep: { mode: "province", label: "省级总代 · 法定代表人", readonly: true },
    staff:     { mode: "province", label: "省级总代 · 员工",       readonly: false },
    sub_admin: { mode: "sub",      label: "二级合作企业 · 管理员", readonly: false },
    sub_legal: { mode: "sub",      label: "二级合作企业 · 法定代表人", readonly: true },
    sub_staff: { mode: "sub",      label: "二级合作企业 · 员工",   readonly: false }
  };
  var IDENTITY_ALIAS = {
    boss: "admin", sub_owner: "sub_admin",
    legalRep: "legal_rep", legal_rep: "legal_rep",
    sub_legalRep: "sub_legal", sub_legal: "sub_legal"
  };
  function normalizeIdentity(role) {
    var r = String(role || "");
    if (IDENTITY_ALIAS[r]) return IDENTITY_ALIAS[r];
    return IDENTITY_META[r] ? r : "admin";
  }
  function identityLabel(id) { var m = IDENTITY_META[normalizeIdentity(id)]; return m ? m.label : "省级总代 · 管理员"; }
  function identityReadonly(id) { var m = IDENTITY_META[normalizeIdentity(id)]; return !!(m && m.readonly); }

  /* ---------- T2 权限矩阵（13 功能域 × 6 身份；页面 V.perms 的权威回退源） ----------
     admin 全部可操作；legal_rep 只读全量（exportAll=查看延伸默认允许）；staff 仅本人获客链；
     二级侧同构（二级不审批二级、不录比例，相应域一律 false）。 */
  var PERMS = {
    admin:     { invite: 1, createSub: 1, genCode: 1, agentManage: 1, review: 1, setRatio: 1, resend: 1, status: 1, act: 1, confirm: 1, dispute: 1, manageTeam: 1, exportAll: 1, settingsWrite: 1 },
    legal_rep: { invite: 0, createSub: 0, genCode: 0, agentManage: 0, review: 0, setRatio: 0, resend: 0, status: 0, act: 0, confirm: 0, dispute: 0, manageTeam: 0, exportAll: 1, settingsWrite: 0 },
    staff:     { invite: 1, createSub: 0, genCode: 1, agentManage: 0, review: 0, setRatio: 0, resend: 0, status: 0, act: 0, confirm: 0, dispute: 0, manageTeam: 0, exportAll: 0, settingsWrite: 0 },
    sub_admin: { invite: 1, createSub: 0, genCode: 1, agentManage: 1, review: 0, setRatio: 0, resend: 1, status: 1, act: 1, confirm: 1, dispute: 1, manageTeam: 1, exportAll: 1, settingsWrite: 1 },
    sub_legal: { invite: 0, createSub: 0, genCode: 0, agentManage: 0, review: 0, setRatio: 0, resend: 0, status: 0, act: 0, confirm: 0, dispute: 0, manageTeam: 0, exportAll: 1, settingsWrite: 0 },
    sub_staff: { invite: 1, createSub: 0, genCode: 1, agentManage: 0, review: 0, setRatio: 0, resend: 0, status: 0, act: 0, confirm: 0, dispute: 0, manageTeam: 0, exportAll: 0, settingsWrite: 0 }
  };
  function permOf(id) { return PERMS[normalizeIdentity(id)] || PERMS.admin; }
  /* 页面 STATE_VARIANTS 回退：新身份无页内变体时复用 admin/sub_admin 变体并强制只读 */
  function stateVariantFor(variants, id) {
    var nid = normalizeIdentity(id);
    if (variants[nid]) return variants[nid];
    var base = (IDENTITY_META[nid] && IDENTITY_META[nid].mode === "sub") ? (variants.sub_admin || variants.sub_owner) : (variants.admin || variants.boss);
    if (!base) return null;
    if (identityReadonly(nid) && !base.readonly) {
      var copy = JSON.parse(JSON.stringify(base));
      copy.readonly = true;
      var p = copy.perms || {};
      Object.keys(p).forEach(function (k) { p[k] = false; });
      copy.perms = p;
      copy.lockedNote = "法定代表人角色为只读视图，可查看全部信息，不执行任何操作";
      return copy;
    }
    return base;
  }

  /* ---------- 路由归一：真实相对路径（无 hash 路由） ----------
     UI 层一律传真实文件名（如 "team.html"）；store 公共库只读，其历史
     数据锚点仍为 "#/xxx" 形式，统一在此收口：剥前缀 + 历史键别名。 */
  function resolveFile(route) {
    if (!route) return "home.html";
    var k = String(route);
    if (k.indexOf("#/") === 0) {
      k = k.slice(2);
      if (k === "payments") k = "reconcile-sub"; /* 历史锚点：二级收款确认 */
    }
    if (/\.html$/.test(k)) k = k.slice(0, -5);
    return /^[a-z0-9-]+$/.test(k) ? k + ".html" : "home.html";
  }

  /* 系统图标路径（与 js/common.js SPRITE 同源，视觉零偏差；仅 chrome 用） */
  var SYMS = {
    "x":      '<path d="M18 6L6 18M6 6l12 12"/>',
    "bell":   '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    "gear":   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "chev-r": '<path d="M9 18l6-6-6-6"/>',
    "chev-l": '<path d="M15 18l-6-6 6-6"/>',
    /* 放大至全屏（Phosphor arrows-out）：待办弹窗右上角入口，点击切换至对应功能页 */
    "arrows-out": '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'
  };
  function injectSprite() {
    if (global.document.getElementById("uni-sprite")) return;
    var ns = '<svg id="uni-sprite" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
      Object.keys(SYMS).map(function (k) {
        return '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + SYMS[k] + "</symbol>";
      }).join("") + '</svg>';
    (global.document.head || global.document.documentElement).insertAdjacentHTML("beforeend", ns);
  }
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? " " + cls : "") + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-' + name + '"/></svg>';
  }

  /* ---------- 模式 / 主题 ---------- */
  function readScenarioKey() { try { return global.localStorage.getItem(STATE_KEY); } catch (e) { return null; } }
  function desiredMode(rawKey) { return rawKey && rawKey.indexOf("sub-") === 0 ? "sub" : "province"; }
  function syncAppMode() {
    var k = readScenarioKey();
    if (desiredMode(k) === "sub") global.V3_APP = "sub";
    else { try { delete global.V3_APP; } catch (e) { global.V3_APP = undefined; } }
  }
  function readTheme() {
    var t = null;
    try { t = global.localStorage.getItem(THEME_KEY); } catch (e) {}
    return t === "dark" ? "dark" : "light";
  }
  function applyTheme(t) { global.document.documentElement.setAttribute("data-theme", t); }
  function syncThemeFromSeed(state) {
    if (state && state.theme === "dark") { try { global.localStorage.setItem(THEME_KEY, "dark"); } catch (e) {} }
  }

  /* ---------- ctx 组装（与 v2 uni-router 同语义；T2 归一化身份） ---------- */
  function buildCtx(state) {
    var id = normalizeIdentity(state.role);
    return {
      mode: state.mode,                        // "province" | "sub"
      role: state.role,                        // 原值（兼容既有判断）
      identity: id,                            // STATE_VARIANTS 键（T2 归一化：admin/legal_rep/staff/sub_admin/sub_legal/sub_staff）
      identityLabel: identityLabel(id),
      readonly: identityReadonly(id) || state.state.profile.status !== "active",
      perms: permOf(id),                       // 权威权限矩阵
      scenarioKey: state.scenarioKey,
      staffName: state.roleStaffName || "王敏",
      s: state.state                           // 域数据短引用
    };
  }

  /* ---------- 渲染 ---------- */
  function renderCurrent() {
    var view = views[pageKey];
    if (!view || !container) return;
    /* 模式禁区（如对账中心仅省代）：保持 v2 语义回落工作台 */
    if (view.modes && ctx && view.modes.indexOf(ctx.mode) < 0) {
      global.location.replace("home.html");
      return;
    }
    container.innerHTML = "";
    view.mount(container, ctx, Uni);
    paintChrome();
  }

  /* ---------- chrome：状态栏 / 铃铛角标 / 系统 tabbar ---------- */
  function paintStatus() {
    var el = global.document.getElementById("uni-status");
    if (el && global.UI && global.UI.statusBar) el.innerHTML = global.UI.statusBar();
  }
  function bellTotal() {
    try { return global.V3.store.todoOf(global.V3.store.getState()).total || 0; } catch (e) { return 0; }
  }
  function msgTotal() {
    try { return (global.V3.store.messagesOf(global.V3.store.getState()) || []).length; } catch (e) { return 0; }
  }
  function badgeText(n) { return n > 99 ? "99+" : String(n); }
  function paintBell() {
    var dot = global.document.getElementById("uni-bell-dot");
    if (!dot) return;
    var n = bellTotal();
    if (n > 0) { dot.hidden = false; dot.textContent = badgeText(n); }
    else dot.hidden = true;
  }
  function tabbarHtml(active) {
    var m = msgTotal();
    var tabs = [
      { key: "home", label: "工作台", href: "home.html",
        ic: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3Z"/>' },
      { key: "messages", label: "消息", href: "messages.html",
        ic: '<path d="M21 12a8 8 0 1 0-3.2 6.4L21 21l-.6-3.2A8 8 0 0 0 21 12Z"/>',
        badge: m },
      { key: "settings", label: "设置", href: "settings.html", ic: SYMS.gear }
    ];
    /* 页面级隐藏入口：页面可在 uni-shared 加载前声明 window.UNI_HIDE_TABS（如
       home/reconcile-sub 右上角已有 icon 入口时隐藏底部重复的「消息/设置」） */
    var hide = global.UNI_HIDE_TABS || [];
    if (hide.length) tabs = tabs.filter(function (t) { return hide.indexOf(t.key) < 0; });
    return '<div class="app-nav-shell"><nav class="app-tabbar" aria-label="主导航">' +
      tabs.map(function (t) {
        return '<a href="' + t.href + '" class="app-tab' + (active === t.key ? " active" : "") + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' + t.ic + "</svg>" +
          '<span class="tab-label">' + t.label + "</span>" +
          (t.badge && t.badge > 0 ? '<span class="badge">' + badgeText(t.badge) + "</span>" : "") +
          "</a>";
      }).join("") + "</nav></div>";
  }
  function paintTabbar() {
    var el = global.document.getElementById("uni-tabbar");
    if (!el) return;
    var active = pageKey === "uni-messages" ? "messages" : (pageKey === "uni-settings" ? "settings" : "home");
    el.innerHTML = tabbarHtml(active);
    var ph = global.document.querySelector(".phone");
    if (ph) ph.classList.add("has-uni-tab");
  }
  function paintChrome() { paintStatus(); paintBell(); paintTabbar(); }

  /* ---------- 动作守卫（守卫单源，失败 toast reason） ---------- */
  function actGuarded(type, payload) {
    var r = global.V3.store.act(type, payload);
    if (!r.ok && global.UI && global.UI.toast) global.UI.toast(r.reason, "err");
    if (r.ok) renderCurrent();
    return r;
  }

  /* ---------- 导航（真实相对路径链接，支持 ?query 透传） ---------- */
  function navTo(route) {
    var r = String(route || ""), q = "";
    var qi = r.indexOf("?");
    if (qi > -1) { q = r.slice(qi); r = r.slice(0, qi); }
    global.location.href = resolveFile(r) + q;
  }
  function hrefOf(route) {
    var r = String(route || ""), q = "";
    var qi = r.indexOf("?");
    if (qi > -1) { q = r.slice(qi); r = r.slice(0, qi); }
    return resolveFile(r) + q;
  }

  /* ---------- 系统视觉：自下而上弹窗（.sheet 家族） ----------
     footer 按钮置于 body 尾部 .btn-block，由系统 UI.sheet 的 boostStickyFoot
     自动提升进 .sheet-foot；视觉与交互全部为系统既有成果。
     expand 选项：在标题栏（关闭按钮左侧）注入「放大至全屏」入口，
     复用系统 .icon-btn 样式（i-arrows-out），点击回调跳转对应功能页。 */
  function sheet(opts) {
    var o = opts || {};
    var ft = o.footer || [];
    var sh = global.UI.sheet();
    sh.setText(o.title || "");
    if (o.expand) {
      var head = sh.querySelector(".sheet-head");
      var closeBtn = sh.querySelector(".sheet-close");
      if (head && closeBtn) {
        var exp = global.document.createElement("button");
        exp.className = "icon-btn sheet-expand";
        exp.setAttribute("aria-label", "放大至全屏，进入功能页");
        exp.title = "放大至全屏";
        exp.style.marginRight = "0";
        exp.innerHTML = '<svg class="ic"><use href="#i-arrows-out"/></svg>';
        head.insertBefore(exp, closeBtn);
        exp.addEventListener("click", function () {
          if (o.expand.onClick) o.expand.onClick();
          else sh.close();
        });
      }
    }
    var btns = ft.map(function (b, i) {
      var kind = { primary: "btn-primary", ghost: "btn-ghost", danger: "btn-danger", blue: "btn-blue" }[b.kind || "ghost"] || "btn-ghost";
      return '<button class="btn ' + kind + (ft.length > 1 ? "" : " btn-block") + '" data-fi="' + i + '"' +
        (ft.length > 1 ? ' style="flex:1"' : "") + ">" + global.V3.ui.esc(b.t) + "</button>";
    }).join("");
    var body = o.body || "";
    if (btns) {
      body += '<div class="btn-block" style="margin-top:var(--sp-5);' +
        (ft.length > 1 ? "display:flex;gap:var(--sp-3);" : "") + '">' + btns + "</div>";
    }
    sh.html(body);
    if (o.closable === false) sh.setClosable(false);
    sh.show();
    if (btns) {
      Array.prototype.forEach.call(sh.querySelectorAll("[data-fi]"), function (btn) {
        btn.addEventListener("click", function () {
          var cb = ft[Number(btn.getAttribute("data-fi"))];
          if (cb && cb.onClick) { var keep = cb.onClick(sh) !== false; if (keep) sh.close(); }
          else sh.close();
        });
      });
    }
    return sh;
  }

  /* ---------- 系统视觉：居中弹窗（.cert-modal 家族） ----------
     footer 按钮置入独立底部区 .cert-modal-foot（滚动区之外），
     悬浮固定于弹窗底部，与 .sheet 底部操作区同语义。 */
  function center(opts) {
    var o = opts || {};
    var ft = o.footer || [];
    var ov = global.document.createElement("div");
    ov.className = "cert-modal-overlay";
    var btns = ft.map(function (b, i) {
      var kind = { primary: "btn-primary", ghost: "btn-ghost", danger: "btn-danger", blue: "btn-blue" }[b.kind || "primary"] || "btn-primary";
      return '<button class="btn ' + kind + (ft.length > 1 ? "" : " btn-block") + '" data-ci="' + i + '"' +
        (ft.length > 1 ? ' style="flex:1"' : "") + ">" + global.V3.ui.esc(b.t) + "</button>";
    }).join("");
    var foot = "";
    if (btns) {
      foot = '<div class="cert-modal-foot">' +
        '<div class="btn-block" style="' + (ft.length > 1 ? "display:flex;gap:var(--sp-3);" : "") + '">' + btns + "</div></div>";
    }
    ov.innerHTML =
      '<div class="cert-modal" role="dialog">' +
      '<div class="cert-modal-head"><span>' + global.V3.ui.esc(o.title || "") + "</span>" +
      '<button type="button" class="cert-modal-close" aria-label="关闭">' + icon("x") + "</button></div>" +
      '<div class="cert-modal-scroll">' + (o.body || "") + "</div>" +
      foot +
      "</div>";
    global.document.body.appendChild(ov);
    function close() {
      ov.classList.remove("show");
      setTimeout(function () { ov.remove(); global.document.body.style.overflow = ""; }, 260);
    }
    ov.close = close;
    requestAnimationFrame(function () { ov.classList.add("show"); global.document.body.style.overflow = "hidden"; });
    ov.querySelector(".cert-modal-close").addEventListener("click", function () { if (o.closable !== false) close(); });
    ov.addEventListener("click", function (e) { if (e.target === ov && o.closable !== false) close(); });
    Array.prototype.forEach.call(ov.querySelectorAll("[data-ci]"), function (btn) {
      btn.addEventListener("click", function () {
        var cb = ft[Number(btn.getAttribute("data-ci"))];
        if (cb && cb.onClick) { var keep = cb.onClick(ov) !== false; if (keep) close(); }
        else close();
      });
    });
    return ov;
  }

  /* ---------- 系统视觉：确认弹窗 / Toast / 空态 ---------- */
  function dialog(opts) { return global.UI.dialog(opts || {}); }
  function toast(text, kind) { global.UI.toast(text, kind); }
  function emptyHtml(title, desc, iconName) {
    return '<div class="empty-state"><div class="e-icon">' + global.V3.ui.icon(iconName || "tray", 44) + "</div>" +
      '<div class="e-title">' + global.V3.ui.esc(title) + "</div>" +
      '<div class="e-desc">' + global.V3.ui.esc(desc || "") + "</div></div>";
  }

  /* ---------- 演示身份切换（全页生效：LS 权威值 + 重渲染当前页） ---------- */
  function switchScenario(key) {
    try { global.localStorage.setItem(STATE_KEY, key); } catch (e) {}
    syncAppMode();
    var state = global.V3.store.reset(global.V3.scenarios.seedByScenario(key), key);
    syncThemeFromSeed(state);
    applyTheme(readTheme());
    ctx = buildCtx(state);
    renderCurrent();
  }
  function switchRole(role) {
    global.V3.store.act("role/set", { role: role });
    ctx = buildCtx(global.V3.store.getState());
    renderCurrent();
  }
  /* ---------- T3 统一口径：两分区财务拆分（与主体系 agent-ledger 规则同源：grossShare=0.5 规则常量） ---------- */
  function financeSplit(s) {
    var fb = (s && s.financeBase) || {};
    var subs = (s && s.subs) || [];
    var G = 0.5; // 规则常量：省代分佣比例 50%
    var subGross = Number(fb.subGross != null ? fb.subGross : fb.gross);
    var selfGross = Number(fb.selfGross != null ? fb.selfGross : 0);
    var pool = Math.round(subGross * G);            // 二级线总盘 = 二级线合格消费 × 50%
    var perSub = [], agreed = 0;
    subs.forEach(function (x) {
      if (x.status !== "active" && x.status !== "approved") return; // 未签约/拒绝的二级不计约定
      var settled = Number(x.subGross || 0);
      if (!settled) return;
      var r = Number(x.ratioToSub != null ? x.ratioToSub : 0);
      var a = Math.round(settled * G * r);          // 逐家约定 = 该二级线盘 × 约定比例
      perSub.push({ id: x.id, name: x.name, settled: settled, ratio: r, agreed: a });
      agreed += a;
    });
    var retained = pool - agreed;                    // 二级线自留
    var selfAmt = Math.round(selfGross * G);         // 自营线全额 = 直营获客合格消费 × 50%
    return {
      sub: { settledGross: subGross, pool: pool, agreed: agreed, retained: retained, perSub: perSub },
      self: { settledGross: selfGross, amount: selfAmt },
      gross: Number(fb.gross != null ? fb.gross : subGross + selfGross),
      total: pool + selfAmt                          // 省代全口径所得（二级线盘 + 自营线全额）
    };
  }

  function switchIdentity(identity) {
    var nid = normalizeIdentity(identity);
    if (nid === "sub_admin" || nid === "sub_legal" || nid === "sub_staff") { switchScenario("sub-active"); return; }
    if (ctx && ctx.mode !== "province") switchScenario("active"); // 回省代域再切角色
    switchRole(nid);                                              // admin | legal_rep | staff
  }
  function toggleTheme() {
    var next = readTheme() === "dark" ? "light" : "dark";
    try { global.localStorage.setItem(THEME_KEY, next); } catch (e) {}
    global.V3.store.act("theme/set", { theme: next });
    applyTheme(next);
  }

  /* ---------- 启动 ---------- */
  function boot(key, opts) {
    pageKey = key;
    container = global.document.getElementById((opts && opts.mount) || "ag-view");
    if (!container) return;
    injectSprite();

    /* URL 演示钩子（G5）：?scenario=&role=&theme= 驱动身份与主题，便于演示与截图 */
    var q = new global.URLSearchParams(global.location.search);
    var sc = q.get("scenario");
    if (sc) { try { global.localStorage.setItem(STATE_KEY, sc); } catch (e) {} }
    var th = q.get("theme");
    if (th === "dark" || th === "light") { try { global.localStorage.setItem(THEME_KEY, th); } catch (e) {} }

    syncAppMode();                                    // 1. 先定模式（先于 store.load）
    var state = global.V3.store.load();               // 2. 命中缓存（act 写入保留）
    if (!state) {
      var k = global.V3.store.currentScenario();      // 3. 无缓存 → 按场景播种
      state = global.V3.store.reset(global.V3.scenarios.seedByScenario(k), k);
      syncThemeFromSeed(state);
    }
    var ro = q.get("role");
    if (ro) {
      /* 演示钩子角色合法性：按场景域限定，非法组合忽略（保持场景默认身份，防渲染崩溃） */
      var legalRoles = desiredMode(sc) === "sub" ? ["sub_admin", "sub_legal", "sub_staff"] : ["admin", "legal_rep", "staff"];
      var norm = normalizeIdentity(ro);
      if (legalRoles.indexOf(norm) > -1) { global.V3.store.act("role/set", { role: norm }); state = global.V3.store.getState(); }
    }
    applyTheme(readTheme());
    ctx = buildCtx(state);

    /* 跨页联动：场景键 / 主题权威值 storage 事件 */
    global.addEventListener("storage", function (e) {
      if (!e || !e.key) return;
      if (e.key === STATE_KEY) {
        var fresh = global.V3.store.load();
        syncAppMode();
        if (fresh && fresh.mode === desiredMode(e.newValue)) ctx = buildCtx(fresh);
        else {
          var k2 = global.V3.store.currentScenario();
          ctx = buildCtx(global.V3.store.reset(global.V3.scenarios.seedByScenario(k2), k2));
        }
        applyTheme(readTheme());
        renderCurrent();
      } else if (e.key === THEME_KEY) {
        applyTheme(e.newValue === "dark" ? "dark" : "light");
      }
    });

    renderCurrent();
    if (STATUS_TICK) clearInterval(STATUS_TICK);
    STATUS_TICK = setInterval(function () { paintStatus(); }, 30000);
  }

  /* ---------- 系统视觉：付款凭证（回单卡 / 图片 / 文件占位） ---------- */
  function voucherCardHtml(m) {
    var esc = global.V3.ui.esc, icon = global.V3.ui.icon;
    var n = Number(m.amount || 0);
    var amt = n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var kv = [
      ["交易流水号", m.bankNo], ["付款方", m.payer], ["付款账号", m.payerAcct],
      ["收款方", m.payee], ["收款账号", m.payeeAcct], ["转账用途", m.purpose],
      ["交易时间", m.at], ["经办人", m.by]
    ];
    var rows = kv.map(function (x) {
      return '<div class="uc-vc__row"><span class="k">' + esc(x[0]) + '</span><span class="v">' + esc(x[1] || "—") + '</span></div>';
    }).join("");
    return '<div class="uc-vc">' +
      '<div class="uc-vc__bank"><span class="uc-vc__dot"></span>' + esc(m.bank || "银行") + ' · 电子转账回单</div>' +
      '<div class="uc-vc__amt"><span class="cur">¥</span>' + esc(amt) + '</div>' +
      '<div class="uc-vc__cn">' + esc(m.amountCn || "") + '</div>' +
      '<div class="uc-vc__rows">' + rows + '</div>' +
      '<div class="uc-vc__foot"><span class="seal">' + icon("shield", 13) + '电子回单专用章</span>' +
      '<span class="no">' + esc(m.bankNo || "") + '</span></div>' +
      '</div>';
  }

  function voucherCenter(v) {
    if (!v) return;
    var body;
    if (v.kind === "receipt" && v.meta) {
      body = voucherCardHtml(v.meta) +
        '<div class="uc-vc__name">' + global.V3.ui.esc(v.name || "") + '</div>';
    } else if (v.thumb) {
      body = '<img src="' + global.V3.ui.esc(v.thumb) + '" alt="付款凭证" style="width:100%;border-radius:var(--r-m);display:block" />';
    } else {
      body = '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 0;color:var(--text-3)">' +
        global.V3.ui.icon("file", 40) +
        '<div style="font-size:var(--fs-sm);color:var(--text-2)">' + global.V3.ui.esc(v.name || "凭证文件") + '</div></div>';
    }
    center({ title: "付款凭证", body: body, footer: [{ t: "关闭", kind: "primary" }] });
  }

  /* ---------- 系统视觉：对账计费范围 + 付费项标签 ---------- */
  /* 金额联动全局定价单一数据源 MOCK.business（js/data.js）：认证费/入驻费/破冰期体验价
     与认证中心(auth-enterprise)、入驻申请(entry-form)同一口径，改价只改数据源
     rules：可选——传入"结算口径与时限说明"条款 HTML 时，与费用计算范围在同一卡片内
     并列两栏展示（对账中心页使用）；不传时保持原单栏卡片（二级收款确认等页不变）。 */
  function scopeCardHtml(rules) {
    var esc = global.V3.ui.esc;
    var B = (window.MOCK && window.MOCK.business) ? window.MOCK.business : {};
    var cert = (B.certification && typeof B.certification.enterprise === "number") ? B.certification.enterprise : 999;
    var et = B.entryTypes || {};
    var cFee = (et.construction && typeof et.construction.fee === "number") ? et.construction.fee : 3999;
    var aFee = (et.agency && typeof et.agency.fee === "number") ? et.agency.fee : 2999;
    var bi = (B.breakin && B.breakin.entry) ? B.breakin.entry : {};
    var breakin = !!(B.breakin && B.breakin.enabled &&
      (!window.ModeStore || !ModeStore.isBreakIn || ModeStore.isBreakIn()));
    var cEnt = (breakin && typeof bi.construction === "number") ? bi.construction : cFee;
    var aEnt = (breakin && typeof bi.agency === "number") ? bi.agency : aFee;
    function money(v) { return v > 0 ? ("¥" + Number(v).toLocaleString()) : "¥0"; }
    var certTxt = cert > 0 ? (money(cert) + "/年") : "¥0 · 免费审核制";
    var entTxt = "建筑 " + money(cEnt) + (cEnt > 0 ? "" : " 限免") + " / 中介 " + money(aEnt) + " 每次" +
      (breakin ? "（破冰期体验价）" : "");
    var scopeHead = '<div class="uh-sechead" style="margin:2px 0 10px"><span class="lbl">费用计算范围</span></div>';
    var scopeBody =
      '<div class="uc-scope__row"><div class="k">计入合格消费</div><ul>' +
      "<li>企业认证费 <b>" + certTxt + "</b> · 按支付时点计入</li>" +
      "<li>企业入驻费 <b>" + entTxt + "</b> · 按支付时点计入</li>" +
      "<li>供需详情解锁 <b>积分消费</b> · 按解锁金额计入</li>" +
      "<li>供需 / 服务成交订单 · 按成交金额计入</li>" +
      "</ul></div>" +
      '<div class="uc-scope__row uc-scope__row--off"><div class="k">不计入合格消费</div><ul>' +
      "<li>余额 / 积分充值</li>" +
      "<li>履约保证金（可退押金）</li>" +
      "<li>退款 / 售后订单（返佣追回）</li>" +
      "<li>免费项：个人实名认证 · 个人合伙人 · 省代入驻（¥0）</li>" +
      "</ul></div>";
    if (rules) {
      return '<section class="uh-sec"><div class="card uc-scope"><div class="uc-scope__cols">' +
        '<div class="uc-scope__col">' + scopeHead + scopeBody + "</div>" +
        '<div class="uc-scope__col">' +
        '<div class="uh-sechead" style="margin:2px 0 10px"><span class="lbl">结算口径与时限说明</span></div>' +
        rules + "</div>" +
        "</div></div></section>";
    }
    return '<section class="uh-sec"><div class="card uc-scope">' + scopeHead + scopeBody + "</div></section>";
  }
  var ITEM_LABEL = { cert: "企业认证", entry: "企业入驻", unlock: "线索解锁", order: "供需订单" };
  function itemTag(it) {
    return '<span class="uc-itchip">' + (ITEM_LABEL[it] || "其他付费") + "</span>";
  }

  /* ---------- 消费记录域（获客转化页）：事项类型映射（与主体系 eligibleTypes/excludedTypes 同源） + 统一脱敏 ---------- */
  var CONSUME_TYPES = {
    order_paid_net:     { label: "订单成交实付净额", eligible: true },
    points_unlock_paid: { label: "积分解锁实付", eligible: true },
    value_added_paid:   { label: "增值服务实付", eligible: true },
    entry_fee:          { label: "企业入驻", eligible: false }
  };
  function consumeTypeOf(type) { return CONSUME_TYPES[type] || { label: type || "其他付费", eligible: false }; }
  function maskName(name) {
    if (!name) return "—";
    var s = String(name);
    if (s.length <= 1) return s;
    var stars = "";
    for (var i = 1; i < s.length; i++) stars += "*";
    return s.charAt(0) + stars;
  }
  function maskPhone(phone) {
    if (!phone) return "—";
    var s = String(phone);
    if (s.length < 7) return s.charAt(0) + "****";
    return s.slice(0, 3) + "****" + s.slice(-4);
  }
  function maskCompany(company) {
    if (!company) return "";
    return company.charAt(0) + "**" + company.slice(-4);
  }

  /* ---------- 获客记录域：渠道码类型映射（口径与获客转化页 CHANNEL_LABEL 对齐） ---------- */
  var CHANNEL_TYPE = {
    province: { key: "province", label: "管理员码 CH-P" },
    staff:    { key: "staff",    label: "员工码 CH-E" },
    agent:    { key: "agent",    label: "招商码 AG-" },
    sub:      { key: "sub",      label: "二级码 CH-S" }
  };
  function leadChannelTypeOf(lead, staffName) {
    if (!lead) return { key: "all", label: "全部" };
    if (lead.channel === "school") return CHANNEL_TYPE.sub;
    if (lead.channel === "direct") return CHANNEL_TYPE.province;
    if (lead.channel === "agent") {
      if (staffName && lead.owner === staffName) return CHANNEL_TYPE.staff;
      return CHANNEL_TYPE.agent;
    }
    return { key: "all", label: "全部" };
  }

  /* ---------- 对外命名空间 ---------- */
  var Uni = {
    resolveFile: resolveFile,
    boot: boot,
    register: function (v) { views[v.view] = v; },
    views: views,
    getCtx: function () { return ctx; },
    actGuarded: actGuarded,
    navTo: navTo,
    hrefOf: hrefOf,
    sheet: sheet,
    center: center,
    dialog: dialog,
    toast: toast,
    emptyHtml: emptyHtml,
    icon: icon,
    catOf: function (t) {
      var m = { danger: { t: "需处理", c: "var(--error)" },
                warn: { t: "待关注", c: "var(--warning, #C77B23)" },
                info: { t: "通知", c: "var(--primary-dim, #B08A3C)" },
                ok: { t: "已完成", c: "var(--success)" } }[t] ||
               { t: "通知", c: "var(--primary-dim, #B08A3C)" };
      return { t: m.t, style: 'style="color:' + m.c + ';background:color-mix(in srgb, ' + m.c + ' 12%, transparent)"' };
    },
    voucherCenter: voucherCenter,
    scopeCard: scopeCardHtml,
    itemTag: itemTag,
    /* 消费记录域（获客转化页） */
    CONSUME_TYPES: CONSUME_TYPES,
    consumeTypeOf: consumeTypeOf,
    maskName: maskName,
    maskPhone: maskPhone,
    maskCompany: maskCompany,
    CHANNEL_TYPE: CHANNEL_TYPE,
    leadChannelTypeOf: leadChannelTypeOf,
    /* T2 统一身份模型 API */
    IDENTITY_META: IDENTITY_META,
    normalizeIdentity: normalizeIdentity,
    identityLabel: identityLabel,
    identityReadonly: identityReadonly,
    permOf: permOf,
    stateVariantFor: stateVariantFor,
    financeSplit: financeSplit,
    switchIdentity: switchIdentity,
    switchScenario: switchScenario,
    switchRole: switchRole,
    toggleTheme: toggleTheme,
    renderCurrent: renderCurrent,
    paintChrome: paintChrome,
    bellTotal: bellTotal,
    msgTotal: msgTotal
  };
  global.Uni = global.Uni || Uni;
})(window);
