/* ============================================================
   uni-invite-code.js · 渠道码·海报（获客域 3 页之一）
   模板节奏（三身份同构，数据驱动填充）：
     暂停封条/说明入口 → 权限说明条 → 招商码卡段(boss)
     → 渠道筛选 seg → 渠道码卡列表 → 空态 → FAB(生成渠道码)
   组件视觉全部为系统类（.card/.btn/.seg/.empty-state/.uh-* 基元）；
   弹窗/Toast 一律经 Uni.sheet / Uni.center / Uni.dialog / Uni.toast。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var OWNER_LABEL = { province: "管理员 · 王建国", staff: "员工 · 王敏", sub: "本企业渠道码" };
  var CH_STATUS = { active: ["生效中", "ok"], void: ["已作废", "bad"] };
  var AG_STATUS = { active: ["生效中", "ok"], void: ["已作废", "bad"], inactive: ["未生成", "mute"] };

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var s = ctx.s;
        /* 招商码（招二级）：逐条数据行，boss 可见 */
        var agRows = ["direct", "agent"].map(function (ch) {
          var a = s.agentCodes[ch] || {};
          return { channel: ch, code: a.code || "", status: a.status || "inactive", validUntil: a.validUntil || "", createdAt: a.createdAt || "" };
        });
        return {
          chips: [{ key: "direct", label: "直接合作" }, { key: "agent", label: "招商渠道" }],
          defaultChip: "direct",
          groups: { direct: s.channels.direct || [], agent: s.channels.agent || [] },
          agRows: agRows,
          genMode: "pick-channel",
          note: "",
          lockedTitle: "合作权限已暂停",
          helpClauses: [
            { no: "渠道分组", c: "直接合作码（CH-P/CH-E）推广终端用户；招商码（AG-）用于招二级企业合作。" },
            { no: "员工码", c: "员工渠道码为 CH-E 前缀，仅本人可见、仅本人可作废；已注册用户数自动累计。" },
            { no: "作废规则", c: "作废后旧码立即失效，已绑定用户不受影响。分享请复制链接或码后转发。" }
          ]
        };
      },
      entries: [],
      perms: { genCode: true, agentManage: true },
      badges: {},
      empty: { channels: { title: "暂无渠道码", desc: "点击右下角「生成渠道码」，创建你的推广渠道码" } },
      lockedNote: "发码、复制与作废均已锁定，仅可查看"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var s = ctx.s, my = ctx.staffName;
        /* 员工仅见本人渠道码（owner 隔离，数据层过滤） */
        var mine = {};
        ["direct", "agent"].forEach(function (ch) {
          mine[ch] = (s.channels[ch] || []).filter(function (c) { return c.ownerName === my; });
        });
        return {
          chips: [{ key: "direct", label: "直接合作" }, { key: "agent", label: "招商渠道" }],
          defaultChip: "agent", /* E037：员工首看落到招商渠道（员工码在 agent 分组） */
          groups: mine,
          agRows: null, /* E038：招商码卡员工整卡不渲染 */
          genMode: "staff-agent",
          note: "员工权限：仅管理本人渠道码与本人线索；招商码与合作配置仅管理员可操作。",
          lockedTitle: "合作权限已暂停",
          helpClauses: [
            { no: "我的渠道码", c: "员工渠道码为 CH-E 前缀，仅本人可见、仅本人可作废；已注册用户数自动累计。" },
            { no: "作废规则", c: "作废后旧码立即失效，已绑定用户不受影响。分享请复制链接或码后转发。" }
          ]
        };
      },
      entries: [],
      perms: { genCode: true, agentManage: false },
      badges: {},
      empty: { channels: { title: "暂无本人渠道码", desc: "生成你的专属渠道码（CH-E）后，开始推广获客" } },
      lockedNote: "发码与作废均已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        return {
          chips: [], /* 二级仅 school 一组渠道，无筛选器（数据级差异） */
          defaultChip: "school",
          groups: { school: ctx.s.channels.school || [] },
          agRows: null, /* 二级无招商码（E087：无招商码不能发展下级） */
          genMode: "school",
          note: "",
          lockedTitle: "合作已暂停",
          helpClauses: [
            { no: "单层绑定", c: "CH-S 渠道码仅可直接邀请终端用户注册；注册后用户即永久归属本企业。" },
            { no: "无招商码", c: "本端没有招商码，不能发展下级（两级封顶）；用户再邀请不归属、不分佣、不传递。" },
            { no: "只读口径", c: "渠道规模、范围与费率由上级省代配置，本端只读。分享请复制链接或码后转发。" }
          ]
        };
      },
      entries: [],
      perms: { genCode: true, agentManage: false },
      badges: {},
      empty: { channels: { title: "暂无渠道码", desc: "生成你的专属渠道码（CH-S）后，开始邀请终端用户" } },
      lockedNote: "邀请发码已锁定，仅可查看"
    }
  };

  /* ---------- 渠道码卡（同一渲染器，三身份复用；系统 card + uh-* 基元） ---------- */
  function chCardHtml(c, V, ctx) {
    var st = CH_STATUS[c.status] || ["—", "mute"];
    var owner = OWNER_LABEL[c.ownerType] || "本企业渠道码";
    var acts = "";
    if (c.status === "active" && !ctx.readonly && V.perms.genCode) {
      acts = '<div class="btn-row uc-cardacts">' +
        '<button class="btn btn-ghost btn-sm" data-act="copy" data-code="' + ui.esc(c.code) + '" style="flex:1">复制链接</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="poster" data-code="' + ui.esc(c.code) + '" style="flex:1">生成海报</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="void" data-channel="' + ui.esc(c.channel) + '" data-code="' + ui.esc(c.code) + '" style="flex:1">作废</button>' +
        "</div>";
    }
    return '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">渠道码</span>' +
      '<span class="uh-badge uh-badge--' + st[1] + '">' + st[0] + "</span></div>" +
      '<div class="uc-ch__body">' +
        '<div class="uc-qr">' + ui.icon("qr", 22) + "</div>" +
        '<div class="uc-ch__main"><div class="uc-ch__code">' + ui.esc(c.code) + "</div>" +
        '<div class="uc-ch__meta">' + ui.esc(owner) + " · 已注册 " + (c.users || 0) + " 人</div>" +
        '<div class="uc-ch__meta">有效期至 ' + ui.esc(c.validUntil || "—") + "</div></div>" +
      "</div>" + acts + "</section>";
  }

  /* ---------- 招商码卡段（boss 专属数据行，同一卡模板） ---------- */
  function agSectionHtml(vm, V, ctx) {
    if (!vm.agRows) return "";
    var rows = vm.agRows.map(function (a) {
      var st = AG_STATUS[a.status] || ["未生成", "mute"];
      var acts = "";
      if (!a.code) {
        if (!ctx.readonly && V.perms.agentManage) {
          acts = '<div class="btn-row uc-cardacts"><button class="btn btn-primary btn-sm" data-act="ag-gen" data-channel="' + ui.esc(a.channel) + '" style="flex:1">生成招商码</button></div>';
        }
      } else if (a.status === "active" && !ctx.readonly && V.perms.agentManage) {
        acts = '<div class="btn-row uc-cardacts">' +
          '<button class="btn btn-ghost btn-sm" data-act="copy" data-code="' + ui.esc(a.code) + '" style="flex:1">复制链接</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="poster" data-code="' + ui.esc(a.code) + '" style="flex:1">海报</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="ag-void" data-channel="' + ui.esc(a.channel) + '" style="flex:1">作废</button>' +
          "</div>";
      }
      return '<section class="card uh-sec">' +
        '<div class="uh-finhead"><span class="uh-eyebrow">招商码 · 招二级</span>' +
        '<span class="uh-badge uh-badge--' + st[1] + '">' + st[0] + "</span></div>" +
        '<div class="uc-ch__body">' +
          '<div class="uc-qr">' + ui.icon("qr", 22) + "</div>" +
          '<div class="uc-ch__main"><div class="uc-ch__code">' + (a.code ? ui.esc(a.code) : "尚未生成") + "</div>" +
          '<div class="uc-ch__meta">' + (a.channel === "direct" ? "直接合作 · 招二级" : "招商渠道 · 招二级") + " · 有效期至 " + ui.esc(a.validUntil || "—") + "</div></div>" +
        "</div>" + acts + "</section>";
    }).join("");
    return '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">招商码 · 招二级</span></div></section>' + rows;
  }

  /* ---------- 复制工具（clipboard + 降级） ---------- */
  function copyText(t) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); Uni.toast("链接已复制", "ok"); }
      catch (e) { Uni.toast("复制失败，请手动复制"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { Uni.toast("链接已复制", "ok"); }, fallback);
    } else fallback();
  }
  function inviteUrl(code) { return "https://engchain.com/invite?code=" + code; }
  /* 招商码（AG-）指向二级合作申请页；终端渠道码走用户注册链 */
  function applyUrl(code) { return "../../../apply/index.html?invite=" + encodeURIComponent(code); }
  function shareUrl(code) { return String(code).indexOf("AG-") === 0 ? applyUrl(code) : inviteUrl(code); }

  /* ---------- 我的渠道码 sheet（E042） ---------- */
  function codeSheet(code, ctx) {
    var c = null;
    ["direct", "agent", "school"].forEach(function (ch) {
      (ctx.s.channels[ch] || []).forEach(function (x) { if (x.code === code) c = x; });
    });
    var users = c ? (c.users || 0) : 0, validUntil = c ? c.validUntil : "2026-12-31";
    Uni.sheet({
      title: "我的渠道码",
      body:
        '<div class="uc-qrwrap"><div class="uc-qr uc-qr--lg">' + ui.icon("qr", 30) + "</div>" +
        '<div class="uc-codebig">' + ui.esc(code) + "</div></div>" +
        '<div class="uh-sheetkv"><span class="k">已注册用户</span><span class="v">' + users + " 人</span></div>" +
        '<div class="uh-sheetkv"><span class="k">有效期至</span><span class="v">' + ui.esc(validUntil) + "</span></div>" +
        '<div class="uh-note">分享请复制链接后转发；用户通过链接注册后自动绑定该渠道码。</div>',
      footer: [
        { t: "复制链接", kind: "ghost", onClick: function () { copyText(shareUrl(code)); } },
        { t: "生成海报", kind: "primary", onClick: function () { posterSheet(code); return false; } }
      ]
    });
  }

  /* ---------- 海报 sheet（E043/E089；招商码走二级申请话术） ---------- */
  function posterSheet(code) {
    var isAgent = String(code).indexOf("AG-") === 0;
    Uni.sheet({
      title: isAgent ? "招商海报" : "渠道海报",
      body:
        '<div class="uc-poster">' +
        '<div class="uc-poster__t">' + (isAgent ? "诚邀成为二级合作企业" : "邀请你一起入驻") + '</div>' +
        '<div class="uc-poster__s">' + (isAgent ? "扫码或复制招商码提交合作申请，审核通过后签约合作" : "扫码或复制邀请码注册，即与我建立合作绑定") + '</div>' +
        '<div class="uc-qr uc-qr--xl">' + ui.icon("qr", 40) + "</div>" +
        '<div class="uc-poster__c">' + ui.esc(code) + "</div>" +
        "</div>",
      footer: [
        { t: isAgent ? "复制申请链接" : "复制邀请码", kind: "ghost", onClick: function () { copyText(isAgent ? applyUrl(code) : code); } },
        { t: "保存海报", kind: "primary", onClick: function () { Uni.toast("海报已保存，可在相册分享", "ok"); } }
      ]
    });
  }

  /* ---------- 说明 center（E087：二级授权范围；内容由 data() 换源） ---------- */
  function helpSheet(vm) {
    Uni.center({
      title: "渠道码与授权说明",
      body: vm.helpClauses.map(function (c) {
        return '<div class="uh-clause"><div class="no">' + ui.esc(c.no) + '</div><div class="c">' + ui.esc(c.c) + "</div></div>";
      }).join(""),
      footer: [{ t: "我知道了", kind: "primary" }]
    });
  }

  /* ---------- 生成渠道码 sheet（E040/E041/E088） ---------- */
  function genSheet(ctx, Uni, vm, V) {
    if (vm.genMode === "staff-agent") {
      var r = Uni.actGuarded("channel/gen", { channel: "agent" });
      if (r.ok && r.code) { Uni.toast("已生成渠道码 " + r.code, "ok"); codeSheet(r.code, ctx); }
      return;
    }
    if (vm.genMode === "pick-channel") {
      Uni.sheet({
        title: "生成渠道码",
        body: '<div class="field"><label class="field-label">选择投放渠道</label>' +
          '<div class="seg" data-pick>' +
          '<button class="seg-item active" data-v="direct">直接合作</button>' +
          '<button class="seg-item" data-v="agent">招商渠道</button></div></div>' +
          '<div class="uh-note">新码生成后可复制链接或生成海报；旧码作废不影响已绑定用户。</div>',
        footer: [{ t: "取消", kind: "ghost" },
        { t: "生成", kind: "primary", onClick: function (sh) {
          var it = sh.querySelector("[data-pick] .seg-item.active");
          var ch = it ? it.getAttribute("data-v") : "direct";
          var rr = Uni.actGuarded("channel/gen", { channel: ch });
          if (rr.ok && rr.code) { Uni.toast("已生成渠道码 " + rr.code, "ok"); codeSheet(rr.code, ctx); }
        } }]
      });
      return;
    }
    /* school：二级投放场景选择（E088） */
    Uni.sheet({
      title: "生成渠道码",
      body: '<div class="field"><label class="field-label">投放场景</label>' +
        '<div class="seg" data-pick>' +
        '<button class="seg-item active" data-v="online">微信 / 线上</button>' +
        '<button class="seg-item" data-v="offline">线下 / 名片</button></div></div>' +
        '<div class="uh-note">生成后可生成海报分享；旧码作废后已绑定用户不受影响。</div>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "生成渠道码", kind: "primary", onClick: function (sh) {
        var it = sh.querySelector("[data-pick] .seg-item.active");
        var sc = it ? it.getAttribute("data-v") : "online";
        var rr = Uni.actGuarded("channel/gen", { channel: "school", scene: sc });
        if (rr.ok && rr.code) { Uni.toast("已生成渠道码 " + rr.code, "ok"); posterSheet(rr.code); }
      } }]
    });
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);
    var curCh = vm.defaultChip;

    /* 当前分组渠道列表（数据层已在 data() 换源/owner 过滤，这里纯读 vm） */
    function listOf() {
      return vm.groups[curCh] || [];
    }

    /* chips 行（同一系统 seg；二级 chips 为空则不渲染） */
    var chipsHtml = vm.chips.length
      ? '<section class="uh-sec"><div class="seg" data-chips>' + vm.chips.map(function (c) {
          return '<button class="seg-item' + (c.key === curCh ? " active" : "") + '" data-chip="' + c.key + '">' + ui.esc(c.label) + "</button>";
        }).join("") + "</div></section>"
      : "";

    function listHtml() {
      var rows = listOf();
      if (!rows.length) {
        return '<div data-channellist><section class="uh-sec">' +
          Uni.emptyHtml(V.empty.channels.title, V.empty.channels.desc, "qr") + "</section></div>";
      }
      return '<div data-channellist>' + rows.map(function (c) { return chCardHtml(c, V, ctx); }).join("") + "</div>";
    }

    var html = "";
    if (ctx.readonly) {
      html += '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">' + ui.esc(V.lockedTitle) + "（仅可查看）</span>" +
        '<span class="lb-s">' + ui.esc(V.lockedNote || "") + "</span></div></div></section>";
    } else {
      html += '<section class="uh-sec" style="display:flex;justify-content:flex-end">' +
        '<button class="btn btn-ghost btn-sm" data-act="help">' + ui.icon("info", 14) + "渠道码与授权说明</button></section>";
    }
    if (vm.note) {
      html += '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) + "<span>" + ui.esc(vm.note) + "</span></div></section>";
    }
    html += agSectionHtml(vm, V, ctx);
    html += chipsHtml;
    html += listHtml();

    el.innerHTML = html;

    /* chips 切换（纯列表局部刷新） */
    var chipsBox = el.querySelector("[data-chips]");
    if (chipsBox) {
      chipsBox.addEventListener("click", function (e) {
        var b = e.target.closest("[data-chip]"); if (!b) return;
        curCh = b.getAttribute("data-chip");
        chipsBox.querySelectorAll(".seg-item").forEach(function (x) {
          x.classList.toggle("active", x.getAttribute("data-chip") === curCh);
        });
        el.querySelectorAll("[data-channellist]").forEach(function (n) { n.outerHTML = listHtml(); });
        bindCardActs();
      });
    }

    function bindCardActs() {
      el.querySelectorAll("[data-act]").forEach(function (n) {
        if (n._bound) return; n._bound = true;
        var act = n.getAttribute("data-act");
        n.addEventListener("click", function () {
          var code = n.getAttribute("data-code");
          var channel = n.getAttribute("data-channel");
          if (act === "help") return helpSheet(vm);
          if (act === "copy") return copyText(shareUrl(code));
          if (act === "poster") return posterSheet(code);
          if (act === "void") {
            return Uni.dialog({
              title: "作废该渠道码？", text: "作废后旧码立即失效，已绑定用户不受影响。",
              ok: "确认作废", cancel: "取消", danger: true,
              onOk: function () { Uni.actGuarded("channel/void", { channel: channel, code: code }); }
            });
          }
          if (act === "ag-gen") {
            var r = Uni.actGuarded("agent/gen", { channel: channel });
            if (r.ok && r.code) { Uni.toast("已生成招商码 " + r.code, "ok"); posterSheet(r.code); }
            return;
          }
          if (act === "ag-void") {
            return Uni.dialog({
              title: "作废该招商码？", text: "作废后该招商码立即失效，已招二级合作不受影响。",
              ok: "确认作废", cancel: "取消", danger: true,
              onOk: function () { Uni.actGuarded("agent/void", { channel: channel }); }
            });
          }
        });
      });
    }
    bindCardActs();

    /* FAB：生成渠道码（E045/E090；暂停/只读不渲染） */
    if (!ctx.readonly && V.perms.genCode) {
      var fab = document.createElement("button");
      fab.className = "uh-fab";
      fab.setAttribute("aria-label", "生成渠道码");
      fab.innerHTML = ui.icon("plus", 22);
      fab.addEventListener("click", function () { genSheet(ctx, Uni, vm, V); });
      el.appendChild(fab);
    }
  }

  window.Uni.register({
    view: "uni-invite-code",
    route: "invite-code.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
