/* page-invite.js · 邀请获客 #/invite
   【S4-B·F4 职责拆分】本页 = 省代自身获客：邀请终端用户 / 渠道码 / 线索 / 转化与交易跟踪。
   「发展二级企业 / 招商码 / 发起二级 / 初审 / 二级管理与分成配置」已迁至 #/subs 与 #/share-config。 */
(function () {
  "use strict";

  function render(ctx) {
    var ui = ctx.ui, d = ctx.d, V3 = ctx.V3;
    var fn = V3.store.funnelOf(d.leads);
    var h = "";

    h += '<div class="iv-note">仅展示自身获客数据：渠道码、线索、转化与交易跟踪；发展二级企业请到「二级管理」。</div>';

    /* 单层绑定说明 */
    h += '<details class="v3-note-fold v3-my12"><summary>' + ui.icon("shield", 15) +
      '<span class="sum">单层绑定说明</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body"><b>单层扁平绑定：</b>仅「企业 → 你直接邀请的用户」归属计佣；用户再邀请<b>不归属、不分佣、不传递</b>。终端用户无分佣码、无下线。</div></details>';

    /* 渠道码 */
    h += '<div class="section-head-row"><span class="t">我的渠道码</span>' +
      '<span class="act" data-act="gen-channel">+ 生成渠道码</span></div>';
    var chans = (d.channels || []).filter(function (c) { return c.status === "active"; });
    if (chans.length) {
      h += '<div class="v3-stack">';
      chans.forEach(function (c, ci) {
        h += '<div class="v3-codecard' + (ci > 0 ? " v3-codecard--plain" : "") + '"><div class="v3-qr"></div><div style="flex:1;min-width:0">' +
          '<div class="v3-codebig v3-ellipsis">' + ui.esc(c.code) + '</div>' +
          '<div class="v3-xs v3-muted v3-mt3" >' + ui.esc(c.ownerName) + " · " +
          (c.src === "offline" ? "线下场景" : "微信场景") + '<br><span class="v3-nowrap">' + ui.esc(c.createdAt) + "</span></div></div>" +
          '<button class="v3-btn v3-btn--primary v3-btn--sm" data-act="poster" data-id="' + c.id + '">海报/分享</button></div>';
      });
      h += "</div>";
    } else {
      h += '<div class="v3-placeholder">暂无生效渠道码，点击右上角生成（员工可生成挂在本人名下的 CH-E 子码）。</div>';
    }
    var voidChans = (d.channels || []).filter(function (c) { return c.status === "void"; });
    if (voidChans.length) {
      h += '<div class="v3-xs v3-faint v3-mh10" >已作废 ' + voidChans.length + " 个（仅留痕不可用）：" +
        voidChans.map(function (c) { return ui.esc(c.code); }).join("、") + "</div>";
    }

    /* 转化漏斗 */
    h += '<div class="v3-sec-title">转化漏斗 · 邀请已产生付费金额</div><section class="v3-card iv-funnel">' +
      fRow("直接邀请", fn.direct, fn.direct, 0) +
      fRow("已注册", fn.registered, fn.direct, 1) +
      fRow("已入驻", fn.onboarded, fn.direct, 2) +
      fRow("已消费", fn.paid, fn.direct, 3) +
      fRow("已复购", fn.repaid, fn.direct, 4) +
      '<div class="v3-stat-money v3-mt12" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额 · 仅统计不发钱</div>' +
      '<div class="amt num v3-mt3" >' + ui.moneyD(fn.paidAmount) + '</div>' +
      '<div class="v3-xs v3-mt3" >只统计 · 不发起任何资金动作</div></div>' +
      (fn.lost ? '<div class="v3-xs v3-muted v3-mt8" >已流失 ' + fn.lost + " 人；沉寂超 30 天线索建议回收。</div>" : "") +
      "</section>";

    /* 我的邀请用户 */
    h += '<div class="section-head-row"><span class="t">我的邀请用户（单层绑定）</span></div>';
    h += '<div class="v3-chips" id="lead-chips"><button class="v3-chip on" data-f="all">全部</button>' +
      '<button class="v3-chip" data-f="registered">已注册</button><button class="v3-chip" data-f="onboarded">已入驻</button>' +
      '<button class="v3-chip" data-f="paid">已消费</button><button class="v3-chip" data-f="lost">已流失</button></div>';
    h += '<div id="lead-list" class="v3-sub-list" style="border-radius:17px"></div>';
    h += '<div id="lead-reinvite"></div>';

    return h;
  }

  function fRow(lab, n, max, idx) {
    var w = max ? Math.max(6, Math.round(n / max * 100)) : 0;
    return '<div class="iv-funnel-row"><span class="iv-step">' + (idx + 1) + '</span>' +
      '<span class="lab">' + lab + '</span>' +
      '<span class="track"><i style="width:' + w + '%"></i></span><span class="val num">' + n + "</span></div>";
  }

  function leadRows(ctx, filter) {
    var ui = ctx.ui, d = ctx.d;
    var list = (d.leads || []).filter(function (l) { return !l.viaUserReinvite; });
    if (filter && filter !== "all") list = list.filter(function (l) { return l.stage === filter; });
    if (!list.length) return '<div class="v3-empty v3-ep28" >' + ui.emptyHtml("该状态暂无用户", "", "user") + "</div>";
    return list.map(function (l) {
      return '<button class="v3-sub-row" data-act="lead" data-id="' + l.id + '">' +
        '<span class="v3-avatar">' + ui.esc(l.name.slice(0, 1)) + '</span>' +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(l.name) +
        ' <span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span>" +
        '<span class="v3-row__s">' + ui.esc(l.phone) +
        (l.paidAmount ? " · 已产生 " + ui.money(l.paidAmount) : (" · 来自 " + l.channelCode)) + "</span></span>" +
        (l.idleDays >= 30 ? '<span class="v3-due v3-due--warn">沉寂' + l.idleDays + "天</span>" : "") +
        ui.icon("chev", 17) + "</button>";
    }).join("");
  }
  function reinviteBlock(ctx) {
    var ui = ctx.ui;
    var xs = (ctx.d.leads || []).filter(function (l) { return l.viaUserReinvite; });
    if (!xs.length) return "";
    return '<div class="v3-sec-title">用户再邀请（不归属）</div><div class="v3-sub-list iv-reinvite" style="border-radius:17px">' +
      xs.map(function (l) {
        return '<div class="v3-sub-row" style="opacity:.85"><span class="v3-avatar">' + ui.esc(l.name.slice(-1)) + "</span>" +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(l.name) +
          ' <span class="v3-badge v3-badge--neutral">不归属</span></span>' +
          '<span class="v3-row__s">再邀请用户 · 不归属不计佣</span></span></div>';
      }).join("") + "</div>";
  }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    var curFilter = "all";
    function refreshLeads() {
      el.querySelector("#lead-list").innerHTML = leadRows(ctx, curFilter);
      el.querySelector("#lead-reinvite").innerHTML = reinviteBlock(ctx);
    }
    refreshLeads();

    /* 线索筛选 */
    el.querySelector("#lead-chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-f]"); if (!b) return;
      curFilter = b.getAttribute("data-f");
      el.querySelectorAll("#lead-chips .v3-chip").forEach(function (x) { x.classList.toggle("on", x === b); });
      refreshLeads();
    });

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
      if (act === "gen-channel") genChannelSheet(ctx, function () { V3.router.render(); });
      else if (act === "poster") posterSheet(ctx, (d.channels || []).filter(function (c) { return c.id === id; })[0]);
      else if (act === "lead") leadSheet(ctx, (d.leads || []).filter(function (x) { return x.id === id; })[0], refreshLeads);
    });
  }

  /* ---- 生成渠道码 ---- */
  function genChannelSheet(ctx, done) {
    var ui = ctx.ui, isStaff = ctx.role === "staff";
    ui.openSheet({
      title: "生成 B 轨渠道码",
      body:
        '<div class="sh-sec">归属</div>' +
        '<div class="iv-lead-flat">' + ui.icon("user", 16) +
        "<span>" + (isStaff ? "员工子码（CH-E）· 挂在你本人名下，线索计入你的名下" : "企业总码（" + (ctx.mode === "sub" ? "CH-S" : "CH-P") + "）") + "</span></div>" +
        '<div class="sh-sec">海报模板</div><div class="v3-radio" id="tpl-sel">' +
        tplOpt("tpl1", "工程服务蓝金版", true) + tplOpt("tpl2", "线下合作版", false) + "</div>" +
        '<div class="sh-sec">主要投放场景</div><div class="v3-radio" id="src-sel">' +
        tplOpt("wechat", "微信 / 线上", true) + tplOpt("offline", "线下展会 / 名片", false) + "</div>" +
        '<p class="v3-legal v3-mt12" >渠道码仅用于邀请终端用户；终端用户无分佣码，分享不计佣。</p>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "生成并查看海报", kind: "v3-btn--primary", onClick: function (wrap) {
          var tpl = wrap.querySelector('#tpl-sel .on input').value;
          var src = wrap.querySelector('#src-sel .on input').value;
          ctx.V3.store.act("channel/gen", { tpl: tpl, src: src, ownerType: isStaff ? "staff" : (ctx.mode === "sub" ? "sub" : "province") });
          ui.toast("渠道码已生成", "ok"); ui.closeAll();
          setTimeout(function () { var nd = ctx.V3.store.domain().channels[0]; posterSheet(ctx, nd); }, 60);
          done && done();
        } }
      ],
      onMount: function (wrap) {
        wireRadio(wrap, "#tpl-sel"); wireRadio(wrap, "#src-sel");
      }
    });
  }
  function tplOpt(v, label, on) {
    return '<label class="' + (on ? "on" : "") + '"><input type="radio" name="g" value="' + v + '" ' + (on ? "checked" : "") + '><span>' + label + "</span></label>";
  }
  function wireRadio(wrap, sel) {
    wrap.querySelectorAll(sel + " label").forEach(function (lb) {
      lb.addEventListener("click", function () {
        wrap.querySelectorAll(sel + " label").forEach(function (x) { x.classList.remove("on"); });
        lb.classList.add("on"); lb.querySelector("input").checked = true;
      });
    });
  }

  /* ---- 海报 / 分享 ---- */
  function posterSheet(ctx, c) {
    var ui = ctx.ui, code = (c && c.code) || "——";
    ui.openSheet({
      title: "渠道码海报 · 分享",
      body:
        '<div class="v3-poster"><div class="pt">入驻润锦工程链<br/>工程信息 · 一站直达</div>' +
        '<div class="ps">省级总代直接邀请 · 服务与权益有保障</div>' +
        '<div class="pq"><div class="v3-qr"></div></div>' +
        '<div class="pc">' + ui.esc(code) + "</div></div>" +
        '<div class="iv-codeline v3-mt12" >' + ui.esc(code) + "</div>" +
        '<div class="iv-sharegrid">' +
        shareBtn("share", "微信好友") + shareBtn("link", "复制链接") + shareBtn("qr", "保存图片") +
        "</div>" +
        '<p class="v3-legal v3-mt12" style="text-align:center">二维码为原型占位；分享 / 复制为 Mock 演示。</p>',
      footer: [{ t: "完成", kind: "v3-btn--primary", onClick: function () { ctx.ui.closeAll(); } }],
      onMount: function (wrap) {
        wrap.querySelectorAll(".iv-sharegrid button").forEach(function (bt) {
          bt.addEventListener("click", function () { ui.toast("已触发分享（Mock）", "ok"); });
        });
      }
    });
  }
  function shareBtn(ic, t) {
    return '<button>' + window.V3.ui.icon(ic, 22) + "<span>" + t + "</span></button>";
  }

  /* ---- 线索详情 ---- */
  var NEXT = { registered: "onboarded", onboarded: "paid", paid: "repaid" };
  function leadSheet(ctx, l, done) {
    if (!l) return;
    var ui = ctx.ui, V3 = ctx.V3;
    if (l.viaUserReinvite) {
      ui.openModal({ title: "该用户不归属你", icon: "eye", body: "此为终端用户再邀请进入：<b>不归属 · 不分佣 · 不向下传递</b>，不进入你的线索与分佣统计。", cancel: false, okText: "我知道了" });
      return;
    }
    var stages = ["registered", "onboarded", "paid", "repaid"];
    ui.openSheet({
      title: l.name + " · 线索详情",
      body:
        '<div class="iv-lead-flat v3-mb10" >' + ui.icon("link", 16) +
        "<span><b>直接邀请 · 单层绑定 · 无下线</b>（来源 " + ui.esc(l.channelCode) + "）</span></div>" +
        '<div class="dtl-stages">' + stages.map(function (s) {
          var idx = stages.indexOf(l.stage) >= stages.indexOf(s) || l.stage === "repaid";
          return '<div class="s ' + (idx ? "on" : "") + '">' + ui.STAGE[s] + "</div>";
        }).join("") + "</div>" +
        '<div class="dl">' +
        '<span class="k">联系方式</span><span class="v">' + ui.esc(l.phone) + "</span>" +
        '<span class="k">当前阶段</span><span class="v"><span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span>" +
        (l.paidAmount ? '<span class="k">已产生付费</span><span class="v v3-goldtext num">' + ui.money(l.paidAmount) + "</span>" : "") +
        '<span class="k">沉寂天数</span><span class="v">' + l.idleDays + " 天</span>" +
        '<span class="k">改绑机会</span><span class="v">' + (l.rebound ? "已使用（仅 1 次）" : "未使用") + "</span>" +
        "</div>" +
        '<div class="sh-sec">跟进记录</div><div class="v3-timeline" id="follow-tl">' +
        ((l.follows && l.follows.length) ? l.follows.map(function (f) {
          return '<div class="v3-tl"><div class="t">' + ui.esc(f.text) + '</div><div class="time">' + ui.esc(f.at) + " · " + (f.by === "staff" ? "员工" : "管理员") + "</div></div>";
        }).join("") : '<div class="v3-xs v3-faint">暂无跟进记录</div>') + "</div>" +
        (l.stage === "lost" ? '<div class="v3-alert v3-alert--warn v3-mt8" >该线索已标记流失。</div>' : ""),
      footer: [
        { t: "新增跟进", kind: "v3-btn--ghost", onClick: function () { followSheet(ctx, l, function () { ui.closeAll(); done(); after(); }); } },
        { t: NEXT[l.stage] ? "推进到「" + ui.STAGE[NEXT[l.stage]] + "」" : "已复购", kind: "v3-btn--primary",
          onClick: function () {
            if (ctx.readonly) { ui.toast("账号暂停中", "err"); return false; }
            if (NEXT[l.stage]) advanceSheet(ctx, l, done, function () { ui.closeAll(); after(); });
            else { ui.toast("已是最终阶段"); }
            return false;
          } }
      ],
      onMount: function (wrap) {
        if (ctx.canBoss && !l.rebound && l.stage !== "lost") {
          var rb = document.createElement("button");
          rb.className = "v3-btn v3-btn--link v3-btn--sm v3-mt10";
          rb.textContent = "申诉改绑（每用户仅 1 次）";
          rb.addEventListener("click", function () {
            ui.openModal({ title: "确认改绑？", icon: "edit", body: "每个用户仅允许 <b>1 次</b>归属改绑（以正式合规规则为准）。", okText: "确认改绑", onOk: function () { V3.store.act("lead/rebind", { id: l.id }); ui.toast("已提交改绑", "ok"); ui.closeAll(); after(); } });
          });
          wrap.querySelector(".v3-sheet__bd").appendChild(rb);
        }
      }
    });
    function after() {
      var fresh = ctx.V3.store.domain().leads.filter(function (x) { return x.id === l.id; })[0];
      if (fresh) leadSheet(ctx, fresh, done);
    }
  }
  function followSheet(ctx, l, done) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "新增跟进记录",
      body: '<div class="v3-field"><label>跟进内容</label><textarea class="v3-textarea" id="f-text" placeholder="如：已电话沟通，意向开通增值包，下周三再联系"></textarea></div>',
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "保存", kind: "v3-btn--primary", onClick: function (wrap) {
          var txt = wrap.querySelector("#f-text").value.trim();
          if (!txt) { ui.toast("请填写跟进内容", "err"); return false; }
          ctx.V3.store.act("lead/follow", { id: l.id, text: txt }); ui.toast("跟进已保存", "ok"); done();
        } }
      ]
    });
  }
  function advanceSheet(ctx, l, doneList, done) {
    var ui = ctx.ui, target = NEXT[l.stage];
    if (target === "paid") {
      ui.openSheet({
        title: "标记为「已消费」",
        body: '<div class="v3-field"><label>本笔合格消费金额（元）</label><input class="v3-input inputmode" id="p-amt" type="number" inputmode="decimal" placeholder="如 2800" /><div class="v3-hint">将计入「邀请已产生付费金额」，仅统计、不发钱。</div></div>',
        footer: [
          { t: "取消", kind: "v3-btn--ghost" },
          { t: "确认已消费", kind: "v3-btn--primary", onClick: function (wrap) {
            var amt = Number(wrap.querySelector("#p-amt").value);
            if (!(amt > 0)) { ui.toast("请输入有效金额", "err"); return false; }
            ctx.V3.store.act("lead/stage", { id: l.id, stage: "paid", paidAmount: amt }); ui.toast("阶段已更新", "ok"); done();
          } }
        ]
      });
    } else {
      ctx.V3.store.act("lead/stage", { id: l.id, stage: target }); ui.toast("已推进到「" + ui.STAGE[target] + "」", "ok"); done();
    }
  }

  window.V3PAGES.invite = { title: "邀请获客", render: render, mount: mount };
})();
