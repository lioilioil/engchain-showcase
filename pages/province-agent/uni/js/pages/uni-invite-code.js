/* ============================================================
   uni-invite-code.js · 经营与渠道（获客域 3 页之一；20261030 全面重构 v7）
   重构（20261030uni7）：
   - 页面语义：渠道码·海报 → 经营与渠道；删除全部招商码/招商渠道/AG- 逻辑与话术
   - 按成员组织：六身份统一成员卡模型（每成员一张卡，自己置顶 + （我）标记）
   - 成员卡：头像 / 姓名 / 身份标签（法定代表人·管理员·企业成员）/ 主码 / 状态 / 已注册人数
   - 点击成员卡 → 自下而上详情弹窗：该成员全部码与详情（编码/链接/状态/注册数/创建/有效期）
   - 作废/恢复：对成员名下码执行，仅 admin/sub_admin（行内操作，底部操作区常驻）
   - 复制链接弹窗（居中）：话术库（内置 3 条省代/二级口径 + 换一换 + 自定义持久化）
     + 推广渠道选项（微信好友/朋友圈/短信，链接带 ch 参数）
   - 海报弹窗（自下而上）：商用级省代/二级获客海报卡 + canvas 保存（750×1334）
   模板节奏：
     暂停封条（readonly）/ 权限说明条 → 帮助入口（说明 sheet）→ 成员卡列表 → FAB(生成渠道码)
   组件视觉全部为系统类（.card/.btn/.uh-* 基元）；弹窗/Toast 一律经 Uni.sheet / Uni.center / Uni.dialog / Uni.toast。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var CH_STATUS = { active: ["生效中", "ok"], void: ["已作废", "bad"] };
  var SCRIPTS_KEY = "engchain-uni-invite-scripts-v1";
  var CH_OPTS = [
    { key: "wechat", label: "微信好友", ic: "wechat" },
    { key: "moments", label: "朋友圈", ic: "image" },
    { key: "sms", label: "短信", ic: "send" }
  ];
  var PROOF = [["12,000+", "入驻企业"], ["86,000+", "认证工程师"], ["4,200+", "撮合项目"]];

  /* ---------- 身份标签（法定代表人 / 管理员 / 企业成员，按团队数据） ---------- */
  function roleLabelOf(m) {
    if (m.role === "boss") return m.isLegal ? "法定代表人" : "管理员";
    return "企业成员";
  }

  /* ---------- 成员名下渠道码（省代=direct 桶 / 二级=school 桶；agent 已合并删除） ---------- */
  function codesOfMember(s, name) {
    var out = [];
    ["direct", "school"].forEach(function (ch) {
      (s.channels[ch] || []).forEach(function (c) { if (c.ownerName === name) out.push(c); });
    });
    return out;
  }
  function mainCodeOf(codes) {
    var act = null, any = null;
    (codes || []).forEach(function (c) {
      if (!any) any = c;
      if (c.status === "active" && !act) act = c;
    });
    return act || any || null;
  }
  function totalUsers(codes) {
    return (codes || []).reduce(function (s, c) { return s + (c.users || 0); }, 0);
  }

  /* ---------- 我：员工视角取 staffName，其余取企业联系人（法定代表人/管理员） ---------- */
  function myNameOf(ctx) {
    return (ctx.identity === "staff" || ctx.identity === "sub_staff")
      ? ctx.staffName : (ctx.s.profile.contact || "");
  }
  /* 可分享（复制/海报）：分享属非写操作，暂停态锁定，角色只读（法代）保留 */
  function canShare(ctx) { return ctx.s.profile.status === "active"; }
  /* 可作废/恢复：仅 admin/sub_admin，且非暂停态 */
  function canVoidOf(ctx) {
    return (ctx.identity === "admin" || ctx.identity === "sub_admin") && ctx.s.profile.status === "active";
  }
  /* 可生成渠道码：权限矩阵 genCode 且非暂停态 */
  function canGenOf(ctx) {
    return ctx.s.profile.status === "active" && !!(ctx.perms && ctx.perms.genCode);
  }

  /* ---------- 短链接（演示：eng.cc 短链 + 渠道参数；真实接入替换为平台生成的短链） ---------- */
  function shortCode(code) {
    var m = String(code || "").match(/[A-Z0-9]{6}$/);
    return m ? m[0] : String(code || "").slice(-6) || "DEMO01";
  }
  function inviteUrl(code, ch) {
    return "https://eng.cc/" + shortCode(code) + "?ch=" + encodeURIComponent(ch || "wechat");
  }
  function copyText(t, okText) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); Uni.toast(okText || "链接已复制", "ok"); }
      catch (e) { Uni.toast("复制失败，请手动复制"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { Uni.toast(okText || "链接已复制", "ok"); }, fallback);
    } else fallback();
  }

  /* ---------- 推广话术库（内置 3 条省代/二级口径 + 用户自定义持久化） ---------- */
  function scriptsOf(ctx) {
    var my = myNameOf(ctx);
    var isSub = ctx.mode === "sub";
    var builtin = isSub ? [
      { label: "朋友圈 · 专业版", body: "我是工程链「二级合作企业」的渠道伙伴" + my + "。平台做工程供需精准匹配，认证企业、防跳单。扫码或填码注册即绑定本企业归属，之后认证、入驻、成交都计入本企业。邀请码 {{CODE}}，工程同行可以试试。" },
      { label: "微信群 · 简洁版", body: "推荐工程链平台：认证企业、供需精准匹配、中介服务不跳单。扫码或填码注册即绑定本企业归属。找项目/找施工队/找建材都能用，平台注册免费。邀请码 {{CODE}}。——" + my },
      { label: "线下 · 名片版", body: "这是我的工程链渠道码 {{CODE}}。扫码或填码注册即归属本企业；平台上有企业认证、供需解锁、撮合成交。工程同行需要可以联系我。" }
    ] : [
      { label: "朋友圈 · 专业版", body: "我是工程链「省级总代」的渠道合作伙伴" + my + "。平台做工程供需精准匹配，认证企业、防跳单。扫码或填码注册即绑定合作渠道，之后认证、入驻、成交都计入咱们的合作。邀请码 {{CODE}}，工程同行可以试试。" },
      { label: "微信群 · 简洁版", body: "推荐工程链平台：认证企业、供需精准匹配、中介服务不跳单。扫码或填码注册即绑定合作渠道。找项目/找施工队/找建材都能用，平台注册免费。邀请码 {{CODE}}。——" + my },
      { label: "线下 · 名片版", body: "这是我的工程链合作渠道码 {{CODE}}。扫码或填码注册即绑定合作渠道；平台上有企业认证、供需解锁、撮合成交。工程同行需要可以联系我。" }
    ];
    return builtin.map(function (s, i) { return { id: "b" + i, label: s.label, body: s.body, custom: false }; })
      .concat(loadUserScripts().map(function (s) { return { id: s.id, label: s.label || "我的话术", body: s.body, custom: true }; }));
  }
  function loadUserScripts() {
    try { var raw = localStorage.getItem(SCRIPTS_KEY); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
    catch (e) { return []; }
  }
  function saveUserScripts(list) {
    try { localStorage.setItem(SCRIPTS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ---------- 六身份视图：data 仅构建当前身份可见成员（员工/二级员工仅本人） ---------- */
  function baseVm(ctx, scope) {
    var s = ctx.s, my = myNameOf(ctx);
    var members = (s.team || []).map(function (m) {
      var codes = codesOfMember(s, m.name);
      var main = mainCodeOf(codes);
      return {
        m: m,
        codes: codes,
        main: main,
        mainSt: main ? (CH_STATUS[main.status] || ["—", "mute"]) : ["未生成", "mute"],
        users: totalUsers(codes),
        isMe: m.name === my,
        roleLabel: roleLabelOf(m)
      };
    }).filter(function (x) { return scope === "mine" ? x.isMe : true; })
      .sort(function (a, b) {
        if (a.isMe && !b.isMe) return -1;
        if (!a.isMe && b.isMe) return 1;
        return 0;
      });
    return {
      members: members,
      myName: my,
      lockedTitle: ctx.mode === "sub" ? "合作权限已暂停" : "合作权限已暂停"
    };
  }

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) { return baseVm(ctx, "all"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "发码、复制与作废均已锁定，仅可查看"
    },
    legal_rep: {
      label: "省级总代 · 法定代表人",
      data: function (ctx) { return baseVm(ctx, "all"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) { return baseVm(ctx, "mine"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "发码与作废均已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) { return baseVm(ctx, "all"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "发码、复制与作废均已锁定，仅可查看"
    },
    sub_legal: {
      label: "二级合作企业 · 法定代表人",
      data: function (ctx) { return baseVm(ctx, "all"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "法定代表人角色为只读视图，可查看全部信息，不执行任何操作"
    },
    sub_staff: {
      label: "二级合作企业 · 员工",
      data: function (ctx) { return baseVm(ctx, "mine"); },
      entries: [], perms: {}, badges: {}, empty: {},
      lockedNote: "发码与作废均已锁定，仅可查看"
    }
  };

  /* ---------- 成员卡 ---------- */
  function memberCardHtml(x, ctx) {
    var m = x.m;
    var meTag = x.isMe ? '<span class="uc-me">（我）</span>' : "";
    var shareable = canShare(ctx) && x.main && x.main.status === "active";
    var acts = "";
    if (shareable) {
      acts = '<div class="btn-row uc-cardacts">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="copy" data-code="' + ui.esc(x.main.code) + '" style="flex:1">复制链接</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="poster" data-code="' + ui.esc(x.main.code) + '" style="flex:1">生成海报</button>' +
        "</div>";
    }
    var avatar = m.avatar
      ? '<img class="uc-mavatar" src="' + ui.esc(m.avatar) + '" alt="" loading="lazy">'
      : '<div class="uc-mavatar uc-mavatar--ph">' + ui.esc((m.name || "链").slice(0, 1)) + "</div>";
    return '<section class="card uc-mcard' + (x.isMe ? " is-me" : "") + '" data-member="' + ui.esc(m.name) + '">' +
      '<div class="uc-mhead">' +
        avatar +
        '<div class="uc-mmain">' +
          '<div class="uc-mname">' + ui.esc(m.name) + meTag +
            '<span class="uh-badge uh-badge--gold uc-mrole">' + ui.esc(x.roleLabel) + "</span></div>" +
          '<div class="uc-msub">' + ui.esc(m.title || "") + (x.isMe ? " · 当前账号" : "") + "</div>" +
        "</div>" +
        '<span class="uh-badge uh-badge--' + x.mainSt[1] + ' uc-mst">' + x.mainSt[0] + "</span>" +
      "</div>" +
      '<div class="uc-mbody">' +
        (x.main
          ? '<div class="uc-qricon">' + ui.icon("qr", 22) + "</div>"
          : '<div class="uc-qricon uc-qricon--off">' + ui.icon("qr", 22) + "</div>") +
        '<div class="uc-mmain">' +
          (x.main && x.main.name ? '<div class="uc-ch__name">' + ui.esc(x.main.name) + "</div>" : "") +
          '<div class="uc-ch__code">' + (x.main ? ui.esc(x.main.code) : "暂无渠道码") + "</div>" +
          '<div class="uc-ch__meta">已注册 ' + x.users + ' 人 · 名下 ' + x.codes.length + ' 张渠道码</div>' +
        "</div>" +
        '<span class="uc-mchev">' + ui.icon("chev", 16) + "</span>" +
      "</div>" +
      acts + "</section>";
  }

  /* ---------- 帮助/说明 sheet ---------- */
  function helpSheet(vm, ctx) {
    var clauses = ctx.mode === "sub" ? [
      { no: "成员归属", c: "本企业成员按各自渠道码（CH-S）获客；注册用户永久归属本企业。" },
      { no: "单层绑定", c: "CH-S 渠道码仅可直接邀请终端用户注册；注册后用户即归属本企业，用户再邀请不归属、不分佣、不传递。" },
      { no: "作废规则", c: "作废后旧码立即失效，已绑定用户不受影响；恢复后重新生效。" }
    ] : [
      { no: "成员渠道码", c: "每位成员名下渠道码独立计注册；管理员/法定代表人可查看全部成员，员工仅见本人。" },
      { no: "作废与恢复", c: "管理员可作废/恢复成员名下渠道码；作废后旧码立即失效，已绑定用户不受影响。" },
      { no: "分享口径", c: "分享请复制链接或码后转发；用户通过链接注册即自动绑定该渠道码。" }
    ];
    Uni.sheet({
      title: "渠道码与授权说明",
      body: '<div class="uh-clause-list">' + clauses.map(function (c) {
        return '<div class="uh-clause"><div class="no">' + ui.esc(c.no) + '</div><div class="c">' + ui.esc(c.c) + "</div></div>";
      }).join("") + '<div style="height:8px"></div><div class="uh-note">渠道码注册关系由平台留存，可追溯、可审计。演示口径。</div></div>'
    });
  }

  /* ---------- 详情 sheet：成员全部码与详情 + 行内作废/恢复 ---------- */
  function detailSheet(x, ctx) {
    var m = x.m;
    var canVoid = canVoidOf(ctx);
    var shareable = canShare(ctx);
    var codeRows = x.codes.length ? x.codes.map(function (c) {
      var st = CH_STATUS[c.status] || ["—", "mute"];
      var rowActs = "";
      if (shareable && c.status === "active") {
        rowActs = '<div class="btn-row uc-codeacts">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cact="copy" data-code="' + ui.esc(c.code) + '" style="flex:1">复制链接</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cact="poster" data-code="' + ui.esc(c.code) + '" style="flex:1">生成海报</button>' +
          (canVoid ? '<button type="button" class="btn btn-ghost btn-sm" data-cact="void" data-channel="' + ui.esc(c.channel) + '" data-code="' + ui.esc(c.code) + '" style="flex:1">作废</button>' : "") +
          "</div>";
      } else if (canVoid && c.status === "void") {
        rowActs = '<div class="btn-row uc-codeacts">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cact="restore" data-channel="' + ui.esc(c.channel) + '" data-code="' + ui.esc(c.code) + '" style="flex:1">恢复</button>' +
          "</div>";
      }
      return '<div class="uc-codeitem">' +
        '<div class="uc-codeitem__hd">' +
          '<div class="uc-codeitem__name">' + ui.esc(c.name || "通用推广") + "</div>" +
          '<span class="uh-badge uh-badge--' + st[1] + '">' + st[0] + "</span></div>" +
        '<div class="uc-codeitem__code">' + ui.esc(c.code) + "</div>" +
        '<div class="uc-codeitem__meta">注册 ' + (c.users || 0) + ' 人 · 创建于 ' + ui.esc(c.createdAt || "—") + ' · 有效期至 ' + ui.esc(c.validUntil || "—") + "</div>" +
        rowActs + "</div>";
    }).join("") : '<div class="uh-note">该成员暂无渠道码。</div>';

    var footer = [];
    var sh = null;
    if (x.isMe && canGenOf(ctx)) {
      footer.push({ t: "生成新渠道码", kind: "primary", onClick: function () {
        if (sh) sh.close();
        genNew(ctx);
      } });
    }
    sh = Uni.sheet({
      title: m.name + " · 渠道码",
      body: '<div class="uc-dhead">' +
        (m.avatar ? '<img class="uc-mavatar" src="' + ui.esc(m.avatar) + '" alt="">' : '<div class="uc-mavatar uc-mavatar--ph">' + ui.esc((m.name || "链").slice(0, 1)) + "</div>") +
        '<div class="uc-dinfo"><div class="uc-dname">' + ui.esc(m.name) + (x.isMe ? '<span class="uc-me">（我）</span>' : "") +
        '<span class="uh-badge uh-badge--gold">' + ui.esc(x.roleLabel) + "</span></div>" +
        '<div class="uc-dmeta">名下渠道码 ' + x.codes.length + ' 张 · 已注册 ' + x.users + ' 人</div></div></div>' +
        '<div class="uc-dcodes">' + codeRows + "</div>",
      footer: footer
    });

    sh.querySelector(".uc-dcodes").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cact]");
      if (!b) return;
      var act = b.getAttribute("data-cact");
      var code = b.getAttribute("data-code");
      var ch = b.getAttribute("data-channel");
      if (act === "copy") { openCopy(code, ctx); return; }
      if (act === "poster") { posterSheet(code, ctx); return; }
      if (act === "void") {
        Uni.dialog({ title: "作废渠道码 " + code + "？", text: "作废后该码立即失效，已绑定用户不受影响。",
          ok: "作废", danger: true, onOk: function () {
            Uni.actGuarded("channel/void", { channel: ch, code: code });
            if (sh) sh.close(); /* actGuarded 已重渲染页面；关闭详情 sheet 以呈现最新状态 */
          } });
        return;
      }
      if (act === "restore") {
        Uni.dialog({ title: "恢复渠道码 " + code + "？", text: "恢复后该码重新生效，可继续用于获客。",
          ok: "恢复", onOk: function () {
            Uni.actGuarded("channel/restore", { channel: ch, code: code });
            if (sh) sh.close();
          } });
        return;
      }
    });
  }

  /* ---------- 复制推广链接弹窗（居中）
     层级：推广渠道（第一级选项，决定文案内链接与推广链接地址）
           推荐推广文案（文案 + 可点击小程序链接 + 换一换/自定义内联编辑 + 单独复制）
           推广链接（地址链接，可点击跳转，单独复制）
     关闭：右上角 X（不再设底部取消/复制按钮） ---------- */
  function openCopy(code, ctx) {
    var scripts = scriptsOf(ctx);
    var idx = 0, ch = "wechat", editing = false;
    function link() { return inviteUrl(code, ch); }
    function scriptText(s) { return s.body.split("{{CODE}}").join(code); }

    function scriptHtml() {
      var s = scripts[idx];
      if (editing) {
        return '<div class="uc-script is-edit">' +
          '<textarea class="textarea uc-script__edit" maxlength="300" rows="4" placeholder="写下要复制的推广文案；链接将自动追加在文案末尾">' + ui.esc(scriptText(s)) + "</textarea>" +
          '<div class="uc-script__foot">' +
            '<span class="uc-script__label">编辑自定义文案</span>' +
            '<span class="uc-script__btns">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-act="edit-cancel">取消</button>' +
              '<button type="button" class="btn btn-primary btn-sm" data-act="edit-save">保存</button>' +
            "</span></div></div>";
      }
      return '<div class="uc-script">' +
        '<div class="uc-script__body">' + ui.esc(scriptText(s)) + "</div>" +
        '<div class="uc-script__link">' +
          '<span class="uc-script__linktag">小程序链接</span>' +
          '<a class="uc-script__linka" href="' + ui.esc(link()) + '" target="_blank" rel="noopener">' + ui.esc(link()) + "</a>" +
        "</div>" +
        '<div class="uc-script__foot">' +
          '<span class="uc-script__label">' + ui.esc(s.label) + (s.custom ? " · 自定义" : "") + "</span>" +
          '<span class="uc-script__btns">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="shuffle">换一换</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="edit">自定义</button>' +
          "</span></div></div>";
    }
    function bodyHtml() {
      return '<div class="uc-copybox">' +
        '<div class="field"><label class="field-label">推广渠道</label>' +
          '<div class="uc-chops">' + CH_OPTS.map(function (o) {
            return '<button type="button" class="uc-chop' + (o.key === ch ? " is-on" : "") + '" data-ch="' + o.key + '">' +
              ui.icon(o.ic, 16) + "<span>" + o.label + "</span></button>";
          }).join("") + "</div></div>" +
        '<div class="field" style="margin-top:14px"><label class="field-label">推荐推广文案</label>' +
          scriptHtml() +
          (editing ? "" : '<button type="button" class="btn btn-ghost btn-sm uc-scriptcopy" data-act="copy-script">复制文案与链接</button>') +
        "</div>" +
        '<div class="field" style="margin-top:14px"><label class="field-label">推广链接<span class="uc-hint">点击跳转平台小程序</span></label>' +
          '<div class="uc-linkrow">' +
            '<a class="uc-linkrow__url" data-role="link" href="' + ui.esc(link()) + '" target="_blank" rel="noopener">' + ui.esc(link()) + "</a>" +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="copylink">复制链接</button>' +
          "</div></div>" +
      "</div>";
    }
    var ov = Uni.center({ title: "复制推广链接", body: bodyHtml(), footer: [] });
    function refresh() {
      var box = ov.querySelector(".uc-copybox");
      if (box) box.outerHTML = bodyHtml();
    }
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=shuffle]")) { idx = (idx + 1) % scripts.length; refresh(); return; }
      if (e.target.closest("[data-act=edit]")) { editing = true; refresh(); return; }
      if (e.target.closest("[data-act=edit-cancel]")) { editing = false; refresh(); return; }
      if (e.target.closest("[data-act=edit-save]")) {
        var ta = ov.querySelector(".uc-script__edit");
        var text = ta ? ta.value.trim() : "";
        if (!text) { Uni.toast("请填写文案内容"); return; }
        var list = loadUserScripts();
        list.push({ id: "c" + Date.now(), label: "我的自定义文案", body: text });
        saveUserScripts(list);
        scripts = scriptsOf(ctx);
        idx = scripts.length - 1;
        editing = false;
        Uni.toast("自定义文案已保存", "ok");
        refresh();
        return;
      }
      var c = e.target.closest("[data-ch]");
      if (c) { ch = c.getAttribute("data-ch"); refresh(); return; }
      if (e.target.closest("[data-act=copy-script]")) {
        var sc = scripts[idx];
        copyText(scriptText(sc) + "\n" + link(), "文案与链接已复制");
        return;
      }
      if (e.target.closest("[data-act=copylink]")) {
        var el = ov.querySelector("[data-role=link]");
        copyText(el ? el.getAttribute("href") || el.textContent : link(), "链接已复制");
        return;
      }
    });
  }

  /* ---------- 海报弹窗（自下而上）：商用级获客海报卡 ---------- */
  function posterSheet(code, ctx) {
    var my = myNameOf(ctx);
    var isSub = ctx.mode === "sub";
    var slogan = isSub ? "扫码注册，<br>绑定本企业归属" : "扫码注册，<br>绑定合作渠道";
    var hint = isSub ? "注册即归属本企业 · 认证入驻成交计入本企业" : "注册即绑定合作渠道 · 认证入驻成交计入合作";
    var sh = Uni.sheet({
      title: "渠道海报",
      body: '<div class="uc-pcard" id="uc-poster">' +
        '<div class="uc-pbrand">' +
          '<div class="uc-plogo">链</div>' +
          '<div class="uc-pbrandt"><div class="uc-ptitle">工程链 ENGCHAIN</div><div class="uc-psub">供需匹配 · 精准撮合</div></div>' +
          '<span class="uc-ptag">渠道合作</span>' +
        "</div>" +
        '<div class="uc-pref">' +
          '<div class="uc-pavatar">' + ui.esc((my || "链").slice(0, 1)) + "</div>" +
          '<div class="uc-pmeta"><span class="uc-pby">由</span><span class="uc-pname">' + ui.esc(my) + "</span></div>" +
          '<span class="uc-pbadge">专属推荐</span>' +
        "</div>" +
        '<div class="uc-pslogan">' + slogan + "</div>" +
        '<div class="uc-pproof">' + PROOF.map(function (p, i) {
          return (i ? '<span class="uc-ppsep"></span>' : "") + '<div class="uc-ppcell"><b>' + p[0] + "</b><span>" + p[1] + "</span></div>";
        }).join("") + "</div>" +
        '<div class="uc-pbenefits">' +
          '<span class="uc-pb">' + ui.icon("check", 13) + "企业认证</span>" +
          '<span class="uc-pb">' + ui.icon("check", 13) + "供需解锁</span>" +
          '<span class="uc-pb">' + ui.icon("check", 13) + "撮合成交</span>" +
          '<span class="uc-pb">' + ui.icon("check", 13) + "合作绑定</span>" +
        "</div>" +
        '<div class="uc-pqr">' +
          '<div class="uc-pqrwrap">' +
            '<div class="uc-qrfake"></div>' +
            '<span class="uc-qc uc-qc1"></span><span class="uc-qc uc-qc2"></span><span class="uc-qc uc-qc3"></span><span class="uc-qc uc-qc4"></span>' +
          "</div>" +
          '<div class="uc-pqrcode">我的专属邀请码 <b>' + ui.esc(code) + "</b></div>" +
          '<div class="uc-pqrhint">' + ui.esc(hint) + "</div>" +
        "</div>" +
        '<div class="uc-pfoot">扫码 / 填码 · 立即注册绑定</div>' +
      "</div>",
      footer: [
        { t: "复制链接", kind: "ghost", onClick: function () { copyText(inviteUrl(code, "poster")); } },
        { t: "保存海报", kind: "primary", onClick: function () { savePosterCanvas(code, ctx); } }
      ]
    });
  }

  /* ---------- 海报 canvas 保存（750×1334 竖版，dark 墨金风） ---------- */
  function savePosterCanvas(code, ctx) {
    var my = myNameOf(ctx);
    var isSub = ctx.mode === "sub";
    var hint = isSub ? "注册即归属本企业 · 认证入驻成交计入本企业" : "注册即绑定合作渠道 · 认证入驻成交计入合作";
    var TH = {
      bg: ["#0b0f1a", "#101a2e", "#0f2418"],
      glow: "rgba(238,214,151,.35)",
      accent: "#E3C88E", accentDeep: "#B08A3C",
      text: "#F7F5F1", sub: "rgba(244,242,238,.6)",
      chipBd: "rgba(176,138,60,.35)",
      qrFrame: "#B08A3C", proof: "#E3C88E"
    };
    var W = 750, H = 1334;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var x = cv.getContext("2d");
    function rr(xx, y, w, h, r) {
      x.beginPath();
      x.moveTo(xx + r, y); x.arcTo(xx + w, y, xx + w, y + h, r); x.arcTo(xx + w, y + h, xx, y + h, r);
      x.arcTo(xx, y + h, xx, y, r); x.arcTo(xx, y, xx + w, y, r); x.closePath();
    }
    var bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, TH.bg[0]); bg.addColorStop(.55, TH.bg[1]); bg.addColorStop(1, TH.bg[2]);
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    var glow = x.createRadialGradient(W - 80, 80, 0, W - 80, 80, 520);
    glow.addColorStop(0, TH.glow); glow.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    /* 品牌行 */
    x.fillStyle = TH.accent; rr(48, 64, 76, 76, 18); x.fill();
    x.fillStyle = "#fff"; x.font = "bold 40px sans-serif"; x.textBaseline = "middle";
    x.fillText("链", 74, 104);
    x.fillStyle = TH.text; x.font = "bold 26px sans-serif";
    x.fillText("工程链 ENGCHAIN", 140, 92);
    x.fillStyle = TH.sub; x.font = "15px sans-serif";
    x.fillText("供需匹配 · 精准撮合", 140, 120);
    var lblW = x.measureText("渠道合作").width + 28;
    x.fillStyle = TH.accent; rr(W - 48 - lblW, 76, lblW, 30, 15); x.fill();
    x.fillStyle = "#2A1810"; x.font = "bold 13px sans-serif"; x.textAlign = "center";
    x.fillText("渠道合作", W - 48 - lblW / 2, 92);
    x.textAlign = "left";
    /* 推荐人 */
    x.fillStyle = TH.accent; x.beginPath(); x.arc(86, 220, 26, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fff"; x.font = "bold 22px sans-serif"; x.textAlign = "center";
    x.fillText((my || "链").slice(0, 1), 86, 222);
    x.textAlign = "left";
    x.fillStyle = TH.sub; x.font = "14px sans-serif"; x.fillText("由", 128, 208);
    x.fillStyle = TH.text; x.font = "bold 22px sans-serif"; x.fillText(my, 152, 210);
    x.fillStyle = TH.accent; x.font = "13px sans-serif"; x.fillText("· 专属推荐", 128, 232);
    /* Slogan */
    x.fillStyle = TH.text; x.font = "bold 46px sans-serif";
    (isSub ? "扫码注册，\n绑定本企业归属" : "扫码注册，\n绑定合作渠道").split("\n").forEach(function (L, i) { x.fillText(L, 48, 320 + i * 60); });
    /* 信任状 */
    var pw = (W - 96) / 3;
    PROOF.forEach(function (p, i) {
      var px = 48 + i * pw;
      x.fillStyle = TH.proof; x.font = "bold 24px sans-serif"; x.textAlign = "center";
      x.fillText(p[0], px + pw / 2, 470);
      x.fillStyle = TH.sub; x.font = "13px sans-serif"; x.fillText(p[1], px + pw / 2, 494);
      if (i < 2) { x.strokeStyle = TH.sub; x.lineWidth = 1; x.beginPath(); x.moveTo(px + pw, 455); x.lineTo(px + pw, 495); x.stroke(); }
    });
    x.textAlign = "left";
    /* 利益点 chips */
    var chipY = 548, cx = 48;
    x.font = "bold 15px sans-serif";
    ["企业认证", "供需解锁", "撮合成交", "合作绑定"].forEach(function (b) {
      var w = x.measureText(b).width + 40;
      if (cx + w > W - 48) { cx = 48; chipY += 46; }
      x.strokeStyle = TH.chipBd; x.lineWidth = 1.5; rr(cx, chipY, w, 34, 17); x.stroke();
      x.fillStyle = TH.accent; x.font = "bold 15px sans-serif";
      x.fillText("✓ " + b, cx + 20, chipY + 18);
      cx += w + 10;
    });
    /* 二维码区 */
    var qrY = 780, qw = 240;
    x.fillStyle = "#F7F5F1"; rr((W - qw) / 2, qrY, qw, qw, 14); x.fill();
    x.strokeStyle = TH.qrFrame; x.lineWidth = 5; rr((W - qw) / 2, qrY, qw, qw, 14); x.stroke();
    /* 伪二维码 */
    x.fillStyle = "#3a3f47";
    var gs = 26;
    for (var g = 0; g < 3; g++) {
      var ox = (W - qw) / 2 + (g === 1 ? qw - 74 : g === 2 ? 14 : 14);
      var oy = qrY + (g === 0 ? 14 : g === 1 ? qw - 74 : 14);
      x.fillRect(ox, oy, 60, 60);
      x.fillStyle = "#F7F5F1"; x.fillRect(ox + 8, oy + 8, 44, 44);
      x.fillStyle = "#3a3f47"; x.fillRect(ox + 20, oy + 20, 20, 20);
      x.fillStyle = "#3a3f47";
    }
    x.fillStyle = "#3a3f47";
    for (var qy = qrY + 90; qy < qrY + qw - 90; qy += 26) {
      for (var qx = (W - qw) / 2 + 90; qx < (W - qw) / 2 + qw - 90; qx += 26) {
        if ((qx + qy) % 52 < 26) x.fillRect(qx, qy, 24, 24);
      }
    }
    x.fillStyle = TH.accent; x.font = "bold 30px monospace"; x.textAlign = "center";
    x.fillText("邀请码  " + code, W / 2, qrY + qw + 44);
    x.fillStyle = TH.sub; x.font = "14px sans-serif";
    x.fillText(hint, W / 2, qrY + qw + 74);
    /* 底部 */
    x.fillStyle = TH.text; x.font = "bold 18px sans-serif";
    x.fillText("扫码 / 填码 · 立即注册绑定", W / 2, H - 96);
    x.fillStyle = TH.sub; x.font = "12px sans-serif";
    x.fillText("工程链 ENGCHAIN · 渠道合作 · 绑定关系平台可追溯", W / 2, H - 66);
    x.textAlign = "left";
    var a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = "engchain-channel-poster.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    Uni.toast("海报已保存，可在相册分享", "ok");
  }

  /* ---------- 生成新渠道码（填写码名称/应用发布场景后创建） ---------- */
  function genNew(ctx) {
    var ch = ctx.mode === "sub" ? "school" : "direct";
    var ov = Uni.center({
      title: "生成新渠道码",
      body: '<div class="uc-genbox">' +
        '<label class="field-label">码名称（应用发布场景）</label>' +
        '<input class="input" id="uc-gen-name" maxlength="16" placeholder="如：成都建筑协会 / 朋友圈推广">' +
        '<div class="uh-dim" style="margin-top:8px;font-size:12px">用于标识该渠道码的应用发布场景，便于区分各渠道来源。</div></div>',
      footer: [
        { t: "取消", kind: "ghost" },
        { t: "生成渠道码", kind: "primary", onClick: function (o) {
          var name = o.querySelector("#uc-gen-name").value.trim();
          if (!name) { Uni.toast("请填写码名称"); return false; }
          var r = Uni.actGuarded("channel/gen", { channel: ch, name: name });
          if (r.ok && r.code) {
            Uni.toast("已生成渠道码 " + r.code, "ok");
            setTimeout(function () { openCopy(r.code, ctx); }, 320);
          }
          return true;
        } }
      ]
    });
  }

  /* ---------- 页面挂载 ---------- */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    function memberHtml() {
      if (!vm.members.length) {
        return '<section class="uh-sec">' + Uni.emptyHtml("暂无团队成员", "团队成员数据待接入", "users") + "</section>";
      }
      return '<section class="uh-sec uc-mlist">' + vm.members.map(function (x) { return memberCardHtml(x, ctx); }).join("") + "</section>";
    }

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(V.lockedTitle) + "（仅可查看）</span>" +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
    }
    html += memberHtml();
    /* 底部固定悬浮：渠道码与授权说明（文字链接） */
    html += '<div class="uc-helplink" data-act="help">' + ui.icon("info", 13) + "渠道码与授权说明</div>";
    el.innerHTML = html;

    el.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=help]")) { helpSheet(vm, ctx); return; }
      var ca = e.target.closest("[data-act]");
      if (ca) {
        var act = ca.getAttribute("data-act");
        var code = ca.getAttribute("data-code");
        if (act === "copy") { e.stopPropagation(); openCopy(code, ctx); return; }
        if (act === "poster") { e.stopPropagation(); posterSheet(code, ctx); return; }
      }
      var card = e.target.closest("[data-member]");
      if (card) {
        var name = card.getAttribute("data-member");
        for (var i = 0; i < vm.members.length; i++) {
          if (vm.members[i].m.name === name) { detailSheet(vm.members[i], ctx); break; }
        }
      }
    });
  }

  window.Uni.register({
    view: "uni-invite-code",
    route: "invite-code.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
