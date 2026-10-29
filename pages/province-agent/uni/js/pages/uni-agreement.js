/* ============================================================
   uni-agreement.js · 合作协议（E075/E076/E080/E081）
   同一模板协议区块 ×N：协议信息 KV + 状态徽章 + 拒签原因条 + 动作区。
   二级：本企业协议（签署/拒签/查看）；省代：各生效二级协议档案（重新发起）。
   身份差异全部落在 V.data()（blocks 换源）与 V.perms。
   组件视觉全部为系统类（.card/.btn/.dialog…）；内容基元（uh-）来自 uni-layout.css。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var AG_BADGE = { signed: ["已签署", "ok"], pending_mine: ["待我签署", "info"], rejected: ["已拒签", "bad"] };

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        var blocks = ctx.s.subs.filter(function (p) { return p.status === "active"; }).map(function (p) {
          return {
            kind: "prov",
            id: p.id,
            subName: p.name,
            badge: ["协议已生成", "mute"],
            kv: [
              { k: "乙方（二级企业）", v: p.name },
              { k: "约定比例", v: Math.round(p.ratioToSub * 100) + "%" },
              { k: "合作自", v: p.since }
            ],
            rejectStrip: null,
            acts: ["resend"],
            agree: null
          };
        });
        return { blocks: blocks, note: null };
      },
      entries: [],
      perms: { resend: true },
      badges: {},
      empty: { blocks: { title: "暂无合作协议", desc: "合作审批通过后将自动生成合作协议" } },
      lockedNote: "协议发起与重新发起均已锁定"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        var blocks = ctx.s.subs.filter(function (p) { return p.status === "active"; }).map(function (p) {
          return {
            kind: "prov", id: p.id, subName: p.name,
            badge: ["协议已生成", "mute"],
            kv: [
              { k: "乙方（二级企业）", v: p.name },
              { k: "约定比例", v: Math.round(p.ratioToSub * 100) + "%" },
              { k: "合作自", v: p.since }
            ],
            rejectStrip: null, acts: [], agree: null
          };
        });
        return { blocks: blocks, note: "协议签署、拒签与重新发起仅管理员/法定代表人可操作，协议档案仅可查看。" };
      },
      entries: [],
      perms: { resend: false },
      badges: {},
      empty: { blocks: { title: "暂无合作协议", desc: "合作审批通过后将自动生成合作协议" } },
      lockedNote: "协议档案已锁定，仅可查看"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        var ag = ctx.s.agreement || null;
        if (!ag) return { blocks: [], note: null };
        var st = AG_BADGE[ag.state] || ["—", "mute"];
        var acts = [];
        if (ag.state === "pending_mine") acts.push("reject", "sign");
        else acts.push("view");
        var kv = [
          { k: "协议编号", v: ag.id },
          { k: "版本", v: ag.version },
          { k: "甲方", v: ag.province.name },
          { k: "合作期限", v: (ag.sentAt || "—") + " 起 · 至 " + (ag.expireAt || "—") }
        ];
        if (ag.state === "signed") {
          kv.push({ k: "签署时间", v: ag.signedAt || "—" });
          kv.push({ k: "签署人", v: ag.signerName || "—" });
        }
        return {
          blocks: [{
            kind: "sub", id: ag.id, subName: ag.sub.name,
            badge: st, kv: kv,
            rejectStrip: ag.state === "rejected"
              ? "拒签原因：" + (ag.rejectReason || "—") + (ag.rejectedAt ? "（" + ag.rejectedAt + "）" : "") + "。省代修订后可重新发起协议。"
              : null,
            acts: acts,
            agree: ag
          }],
          note: null
        };
      },
      entries: [],
      perms: { resend: false },
      badges: {},
      empty: { blocks: { title: "暂无合作协议", desc: "上级省代发起合作后，协议将出现在这里" } },
      lockedNote: "合作已暂停，协议仍可查阅"
    }
  };

  /* 输入框页内样式（仅引用系统令牌；与 share-config 页一致） */
  var FIELD_STYLE = "width:100%;box-sizing:border-box;min-height:88px;padding:10px 12px;border-radius:var(--r-m);" +
    "border:1px solid var(--line);background:var(--bg-card);color:var(--text-1);" +
    "font-size:var(--fs-base);font-family:inherit;resize:none";

  /* ---------- 协议签署/阅读弹窗（E080，系统 .sheet） ---------- */
  function agreeSheet(ag, mode, Uni) {
    function partyRows(p) {
      return [
        ["名称", p.name], ["USCC", p.uscc], ["法定代表人", p.legalPerson || "—"],
        ["联系人 · 电话", (p.contact || "—") + (p.phone ? " · " + p.phone : "")],
        ["地址", p.address || "—"]
      ].map(function (r) {
        return '<div class="uh-sheetkv"><span class="k">' + ui.esc(r[0]) + '</span><span class="v">' + ui.esc(r[1]) + '</span></div>';
      }).join("");
    }
    var terms = (ag.terms || []).map(function (t) {
      return '<div class="uh-clause"><div class="no">' + ui.esc(t.no + " · " + t.t) + '</div><div class="c">' + ui.esc(t.c) + '</div></div>';
    }).join("");
    var foot;
    if (mode === "sign") {
      foot = [
        { t: "拒签", kind: "ghost", onClick: function () { openRejectSheet(Uni); return false; } },
        { t: "我已阅读并签署", kind: "primary", onClick: function (ov) {
          var ck = ov.querySelector("#ag-ck");
          if (!ck || !ck.checked) { Uni.toast("请先完整阅读并勾选确认"); return false; }
          var r = Uni.actGuarded("agree/sign", { confirmed: true });
          if (r.ok) Uni.toast("已完成签署", "ok");
        } }
      ];
    } else {
      foot = [{ t: "关闭", kind: "primary" }];
    }
    Uni.sheet({
      title: "合作协议 " + ag.id,
      body:
        '<div class="uh-sheetkv"><span class="k">协议模板</span><span class="v">O4 · 版 ' + ui.esc(ag.version || "") + '</span></div>' +
        '<div style="height:12px"></div>' +
        '<div class="uh-clause"><div class="no">甲方（省级总代）</div><div class="c" style="padding:0">' + partyRows(ag.province) + '</div></div>' +
        '<div class="uh-clause"><div class="no">乙方（二级合作企业）</div><div class="c" style="padding:0">' + partyRows(ag.sub) + '</div></div>' +
        '<div class="uh-clause"><div class="no">合作期限</div><div class="c">' + ui.esc(ag.sentAt) + " 起，至 " + ui.esc(ag.expireAt) +
        "；有效期一年，到期前 30 日双方无异议则按届时规则续签。</div></div>" +
        '<div class="uh-finhead" style="margin:4px 0 10px"><span class="uh-eyebrow">协议条款（十条）</span></div>' +
        terms +
        (mode === "sign"
          ? '<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);color:var(--text-2);margin-top:6px;min-height:32px">' +
            '<input type="checkbox" id="ag-ck"> 我已完整阅读并知悉全部条款</label>'
          : '<div class="uh-note">协议经电子签签署后生效。</div>'),
      footer: foot
    });
  }

  /* ---------- 拒签弹窗（E081，系统 .sheet） ---------- */
  function openRejectSheet(Uni) {
    Uni.sheet({
      title: "拒签合作协议",
      body:
        '<div class="uh-readnote" style="margin-bottom:10px">' + ui.icon("info", 15) +
        '<span>拒签原因将同步给上级省代，可据此修订后重新发起协议。</span></div>' +
        '<div style="font-size:var(--fs-sm);color:var(--text-3);margin-bottom:6px">拒签原因（必填）</div>' +
        '<textarea id="ag-reason" placeholder="例如：合作期限条款需进一步沟通" style="' + FIELD_STYLE + '"></textarea>',
      footer: [{ t: "取消", kind: "ghost" },
      { t: "确认拒签", kind: "danger", onClick: function (ov) {
        var v = ov.querySelector("#ag-reason").value.trim();
        if (!v) { Uni.toast("请填写拒签原因"); return false; }
        Uni.actGuarded("agree/reject", { reason: v });
      } }]
    });
  }

  /* ---------- 协议区块卡（系统 .card + uh- 基元；按钮按 acts/perms/readonly 渲染） ---------- */
  function blockHtml(b, V, ro) {
    var btns = [];
    if (b.acts.indexOf("reject") >= 0 && !ro) btns.push('<button class="btn btn-ghost btn-sm" data-act="ag-reject">拒签</button>');
    if (b.acts.indexOf("sign") >= 0 && !ro) btns.push('<button class="btn btn-primary btn-sm" data-act="ag-sign">阅读并签署</button>');
    if (b.acts.indexOf("view") >= 0) btns.push('<button class="btn btn-ghost btn-sm" data-act="ag-view">查看协议</button>');
    if (b.acts.indexOf("resend") >= 0 && V.perms.resend && !ro) btns.push('<button class="btn btn-ghost btn-sm" data-act="ag-resend">重新发起协议</button>');
    var acts = btns.length
      ? '<div class="btn-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">' + btns.join("") + '</div>'
      : "";
    var kv = b.kv.map(function (r) {
      return '<div class="uh-kv"><span class="k">' + ui.esc(r.k) + '</span><span class="v">' + ui.esc(r.v) + '</span></div>';
    }).join("");
    return '<section class="card uh-sec">' +
      '<div class="uh-finhead"><span class="uh-eyebrow">合作协议档案</span>' +
      '<span class="uh-badge uh-badge--' + b.badge[1] + '">' + ui.esc(b.badge[0]) + '</span></div>' +
      '<div style="margin-top:8px">' + kv + '</div>' +
      (b.rejectStrip
        ? '<div class="uh-readnote" style="margin-top:10px">' + ui.icon("warn", 15) +
          '<span>' + ui.esc(b.rejectStrip) + '</span></div>'
        : "") +
      acts + '</section>';
  }

  /* 唯一渲染路径：全页仅这一个身份取值行 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var blocksHtml = vm.blocks.length
      ? vm.blocks.map(function (b) { return blockHtml(b, V, ctx.readonly); }).join("")
      : '<section class="uh-sec">' + Uni.emptyHtml(V.empty.blocks.title, V.empty.blocks.desc, "doc") + '</section>';

    el.innerHTML =
      (ctx.readonly
        ? '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
          '<div><span class="lb-t">' + (ctx.mode === "sub" ? "合作已暂停" : "合作权限已暂停") + '（仅可查看）</span>' +
          '<span class="lb-s">' + ui.esc(V.lockedNote) + '</span></div></div></section>'
        : "") +
      (vm.note
        ? '<section class="uh-sec"><div class="uh-readnote">' + ui.icon("info", 15) +
          '<span>' + ui.esc(vm.note) + '</span></div></section>'
        : "") +
      '<section class="uh-sec"><div class="uh-sechead"><span class="lbl">协议档案</span>' +
      (vm.blocks.length ? '<span class="uh-badge uh-badge--mute">' + vm.blocks.length + " 份</span>" : "") +
      '</div>' + blocksHtml + '</section>';

    var ag = ctx.s.agreement;
    var agSign = el.querySelector('[data-act="ag-sign"]');
    if (agSign) agSign.addEventListener("click", function () { if (ag) agreeSheet(ag, "sign", Uni); });
    var agView = el.querySelector('[data-act="ag-view"]');
    if (agView) agView.addEventListener("click", function () { if (ag) agreeSheet(ag, "view", Uni); });
    var agReject = el.querySelector('[data-act="ag-reject"]');
    if (agReject) agReject.addEventListener("click", function () { openRejectSheet(Uni); });
    var agResend = el.querySelector('[data-act="ag-resend"]');
    if (agResend) agResend.addEventListener("click", function () {
      Uni.dialog({
        title: "重新发起合作协议？", danger: true,
        text: "用于二级企业拒签或协议修订后重新发起；重新发起后将通知二级企业重新查阅并签署。",
        ok: "确认重新发起",
        onOk: function () {
          var r = Uni.actGuarded("agree/resend", {});
          if (r.ok) Uni.toast("协议已重新发起", "ok");
        }
      });
    });
  }

  window.Uni.register({
    view: "uni-agreement",
    route: "agreement.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
