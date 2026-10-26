/* page-invite.js · 邀请获客 #/invite（B 渠道码获客 / A 招商码招二级） */
(function () {
  "use strict";

  function render(ctx) {
    var ui = ctx.ui, d = ctx.d, V3 = ctx.V3;
    var fn = V3.store.funnelOf(d.leads);
    var h = "";

    /* 双轨切换 */
    h += '<div class="iv-track"><button class="on" data-t="B">B 轨 · 邀终端用户</button>' +
      '<button data-t="A">A 轨 · 招商码招二级</button></div>';

    /* ============ B 轨 ============ */
    h += '<div id="track-B">' +
      '<details class="v3-note-fold v3-my12"><summary>' + ui.icon("shield", 15) +
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

    /* 转化漏斗 + D4 */
    h += '<div class="v3-sec-title">转化漏斗 · 邀请已产生付费金额</div><section class="v3-card iv-funnel">' +
      fRow("直接邀请", fn.direct, fn.direct, 0) +
      fRow("已注册", fn.registered, fn.direct, 1) +
      fRow("已入驻", fn.onboarded, fn.direct, 2) +
      fRow("已消费", fn.paid, fn.direct, 3) +
      fRow("已复购", fn.repaid, fn.direct, 4) +
      '<div class="v3-stat-money v3-mt12" ><div class="v3-xs" style="opacity:.85">邀请已产生付费金额（D4）</div>' +
      '<div class="amt num v3-mt3" >' + ui.moneyD(fn.paidAmount) + '</div>' +
      '<div class="v3-xs v3-mt3" >只统计 · 不发起任何资金动作</div></div>" +
      (fn.lost ? '<div class="v3-xs v3-muted v3-mt8" >已流失 ' + fn.lost + " 人；沉寂超 30 天线索建议回收（【假设】参数）。</div>" : "") +
      "</section>";

    /* 我的邀请用户 */
    h += '<div class="section-head-row"><span class="t">我的邀请用户（单层绑定）</span></div>';
    h += '<div class="v3-chips" id="lead-chips"><button class="v3-chip on" data-f="all">全部</button>' +
      '<button class="v3-chip" data-f="registered">已注册</button><button class="v3-chip" data-f="onboarded">已入驻</button>' +
      '<button class="v3-chip" data-f="paid">已消费</button><button class="v3-chip" data-f="lost">已流失</button></div>';
    h += '<div id="lead-list" class="v3-sub-list" style="border-radius:17px"></div>';
    h += '<div id="lead-reinvite"></div>';
    h += "</div>"; // /track-B

    /* ============ A 轨 ============ */
    var quotaFull = d.profile.used >= d.profile.cap;
    h += '<div id="track-A" class="v3-track-panel">' +
      '<details class="v3-note-fold v3-my12"><summary>' + ui.icon("crown", 15) +
      '<span class="sum">招商轨说明</span><span class="chev">' + ui.icon("chev", 14) + "</span></summary>" +
      '<div class="fold-body"><b>仅省级总代可用</b>：招商码只用于招募二级企业；二级永久封顶、不可再发展下级。渠道码（B）与招商码（A）两表两菜单硬隔离。</div></details>' +
      '<div class="v3-sec-title">招商码（AG）</div><section class="v3-sub-list" style="border-radius:17px" id="ag-list"></section>' +
      '<div class="v3-sec-title">发起二级合作</div><section class="v3-card">' +
      '<div class="v3-flex v3-between v3-mb8" ><span class="v3-sm v3-muted">名额（已入驻 / 上限）</span>' +
      '<span class="v3-strong num">' + d.profile.used + " / " + d.profile.cap + "</span></div>" +
      '<div class="v3-progress v3-mb12" ><i style="width:' + Math.round(d.profile.used / d.profile.cap * 100) + '%"></i></div>';
    if (ctx.readonly) {
      h += '<button class="v3-btn v3-btn--block is-disabled">账号暂停中，不可发起</button>';
    } else if (!ctx.canBoss) {
      h += '<button class="v3-btn v3-btn--block is-disabled">仅法人 / 管理员可发起二级（D5）</button>';
    } else if (quotaFull) {
      h += '<button class="v3-btn v3-btn--block is-disabled">名额已满</button>' +
        '<div class="v3-alert v3-alert--warn v3-mt10" >名额已满，仍可继续邀请终端用户入驻（B 轨不受名额限制）。</div>';
    } else {
      h += '<button class="v3-btn v3-btn--navy v3-btn--block" data-act="new-app">+ 发起新的二级合作</button>';
    }
    h += "</section>";

    /* 待初审 */
    var pend = (d.subApps || []).filter(function (a) { return a.status === "pending"; });
    h += '<div class="v3-sec-title">二级申请 · 待初审 ' + pend.length + "</div>";
    h += '<div class="v3-sub-list" style="border-radius:17px" id="app-list"></div>';
    var rejected = (d.subApps || []).filter(function (a) { return a.status === "rejected" });
    if (rejected.length) {
      h += '<div class="v3-xs v3-faint v3-mh10" >已驳回 ' + rejected.length +
        " 家（补齐资料可重新申请走审批流）。</div>";
    }
    h += "</div>";

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
  function agListHtml(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var codes = d.agentCodes || [];
    if (!codes.length) return '<div class="v3-empty v3-ep26" >' + ui.emptyHtml("暂无招商码",
      ctx.canBoss ? '<button class="v3-btn v3-btn--navy v3-btn--sm" data-act="gen-ag">生成招商码</button>' : "",
      "crown") + "</div>";
    return codes.map(function (c) {
      return '<div class="v3-sub-row"><span class="v3-avatar v3-avatar--sub">' + ui.icon("crown", 19) + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(c.code) +
        (c.status === "active" ? ' <span class="v3-badge v3-badge--active">生效</span>' : ' <span class="v3-badge v3-badge--void">已作废</span>') +
        "</span><span class='v3-row__s'>招商专用 · 创建 " + ui.esc(c.createdAt) + "</span></span>" +
        (c.status === "active" && ctx.canBoss ? '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="void-ag" data-id="' + c.id + '">作废</button>' : "") +
        (c.status === "active" && ctx.canBoss ? '<button class="v3-btn v3-btn--navy v3-btn--sm" data-act="ag-share" data-id="' + c.id + '">分享</button>' : "") +
        "</div>";
    }).join("") + (ctx.canBoss && !codes.some(function (c) { return c.status === "active"; })
      ? '<button class="v3-sub-row" data-act="gen-ag"><span class="v3-row__main"><span class="v3-row__t v3-goldtext">+ 生成新招商码</span></span>' + ui.icon("chev", 17) + "</button>" : "");
  }
  function appListHtml(ctx) {
    var ui = ctx.ui, d = ctx.d;
    var pend = (d.subApps || []).filter(function (a) { return a.status === "pending"; });
    if (!pend.length) return '<div class="v3-empty v3-ep24" >' + ui.emptyHtml("暂无待初审申请", "", "doc") + "</div>";
    return pend.map(function (a) {
      return '<button class="v3-sub-row" data-act="app" data-id="' + a.id + '"><span class="v3-avatar v3-avatar--sub">' + ui.esc(a.entName.slice(0, 1)) + "</span>" +
        '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(a.entName) +
        ' <span class="v3-badge v3-badge--pending">待初审</span></span>' +
        '<span class="v3-row__s">' + ui.esc(a.contact) + " " + ui.esc(a.phone) + " · 申请比例 " + Math.round(a.ratioToSub * 100) + "%</span></span>" +
        ui.icon("chev", 17) + "</button>";
    }).join("");
  }

  function mount(el, ctx) {
    var V3 = ctx.V3, ui = ctx.ui, d = ctx.d;
    var curFilter = "all";
    function refreshLeads() {
      el.querySelector("#lead-list").innerHTML = leadRows(ctx, curFilter);
      el.querySelector("#lead-reinvite").innerHTML = reinviteBlock(ctx);
    }
    function refreshAg() { el.querySelector("#ag-list").innerHTML = agListHtml(ctx); el.querySelector("#app-list").innerHTML = appListHtml(ctx); }
    refreshLeads(); refreshAg();

    /* 轨道切换 */
    el.querySelectorAll(".iv-track button").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-t");
        el.querySelectorAll(".iv-track button").forEach(function (x) { x.classList.toggle("on", x === b); });
        var trackB = el.querySelector("#track-B"), trackA = el.querySelector("#track-A");
        if (t === "B") {
          trackA.style.visibility = "hidden"; trackA.style.opacity = "0"; trackA.style.pointerEvents = "none";
          trackB.style.visibility = "visible"; trackB.style.opacity = "1"; trackB.style.pointerEvents = "";
        } else {
          trackB.style.visibility = "hidden"; trackB.style.opacity = "0"; trackB.style.pointerEvents = "none";
          trackA.style.visibility = "visible"; trackA.style.opacity = "1"; trackA.style.pointerEvents = "";
        }
      });
    });
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
      else if (act === "gen-ag") {
        if (!ctx.canBoss) return ui.toast("仅管理员可生成招商码", "err");
        V3.store.act("agent/gen", {}); ui.toast("招商码已生成", "ok"); refreshAg();
      } else if (act === "ag-share") {
        posterSheet(ctx, { code: (d.agentCodes.filter(function (c) { return c.id === id; })[0] || {}).code, ownerName: "招商专用码", src: "wechat" }, true);
      } else if (act === "void-ag") voidCodeSheet(ctx, id, "agent/void", refreshAg);
      else if (act === "new-app") newAppSheet(ctx, refreshAg);
      else if (act === "app") appSheet(ctx, (d.subApps || []).filter(function (x) { return x.id === id; })[0], refreshAg);
    });
  }

  /* ---- 生成渠道码 ---- */
  function genChannelSheet(ctx, done) {
    var ui = ctx.ui, isStaff = ctx.role === "staff";
    var ov = ui.openSheet({
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
  function posterSheet(ctx, c, isAg) {
    var ui = ctx.ui, code = (c && c.code) || "——";
    ui.openSheet({
      title: isAg ? "招商码海报" : "渠道码海报 · 分享",
      body:
        '<div class="v3-poster"><div class="pt">入驻润锦工程链<br/>工程信息 · 一站直达</div>' +
        '<div class="ps">' + (isAg ? "诚邀优质工程服务企业成为区域合作伙伴" : "省级总代直接邀请 · 服务与权益有保障") + "</div>" +
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
    var ov = ui.openSheet({
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
            ui.openModal({ title: "确认改绑？", icon: "edit", body: "每个用户仅允许 <b>1 次</b>归属改绑（【假设】规则，以正式合规为准）。", okText: "确认改绑", onOk: function () { V3.store.act("lead/rebind", { id: l.id }); ui.toast("已提交改绑", "ok"); ui.closeAll(); after(); } });
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
        body: '<div class="v3-field"><label>本笔合格消费金额（元）</label><input class="v3-input inputmode" id="p-amt" type="number" inputmode="decimal" placeholder="如 2800" /><div class="v3-hint">将计入「邀请已产生付费金额」，仅统计、不发钱（D4）。</div></div>',
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

  /* ---- 作废确认 ---- */
  function voidCodeSheet(ctx, id, act, done) {
    ctx.ui.openModal({
      title: "作废该招商码？", icon: "warn", danger: true,
      body: "作废后该码立即失效且不可恢复（仅留痕）。已通过该码进入审批流的申请不受影响。", okText: "确认作废",
      onOk: function () { ctx.V3.store.act(act, { id: id, reason: "主动作废" }); ctx.ui.toast("已作废", "ok"); done(); }
    });
  }

  /* ---- 发起二级 ---- */
  function newAppSheet(ctx, done) {
    var ui = ctx.ui, d = ctx.d;
    ui.openSheet({
      title: "发起二级合作（A 轨）",
      body:
        '<div class="v3-field"><label>企业名称</label><input class="v3-input" id="a-name" placeholder="营业执照全称" /></div>' +
        '<div class="v3-field"><label>统一社会信用代码</label><input class="v3-input" id="a-uscc" placeholder="18 位" /></div>' +
        '<div class="v3-field"><label>联系人</label><input class="v3-input" id="a-contact" placeholder="姓名" /></div>' +
        '<div class="v3-field"><label>联系手机</label><input class="v3-input" id="a-phone" type="tel" placeholder="11 位手机号" /></div>' +
        '<div class="v3-field"><label>约定所得比例（0–50%，平台配置 + 协议内）</label>' +
        '<div class="v3-stepper"><input type="range" id="a-ratio" min="0" max="50" step="1" value="20" /><span class="val" id="a-ratio-v">20%</span></div>' +
        '<div class="v3-hint">无自助改费率入口；该比例经平台配置并写入 O4 协议后生效。</div></div>' +
        '<div class="v3-xs v3-muted">提交后进入待初审，名额占用将在审核通过后 +1（当前 ' + d.profile.used + "/" + d.profile.cap + "）。</div>",
      footer: [
        { t: "取消", kind: "v3-btn--ghost" },
        { t: "提交申请", kind: "v3-btn--navy", onClick: function (wrap) {
          var name = wrap.querySelector("#a-name").value.trim(), uscc = wrap.querySelector("#a-uscc").value.trim(),
              contact = wrap.querySelector("#a-contact").value.trim(), phone = wrap.querySelector("#a-phone").value.trim(),
              ratio = Number(wrap.querySelector("#a-ratio").value) / 100;
          if (!name || !uscc || !contact || !/^1\d{10}$/.test(phone)) { ui.toast("请完整填写企业与联系人信息", "err"); return false; }
          if (d.profile.used >= d.profile.cap) { ui.toast("名额已满，不可再招二级", "err"); return false; }
          ctx.V3.store.act("app/create", { entName: name, uscc: uscc, contact: contact, phone: phone, ratioToSub: ratio });
          ui.toast("已提交，待初审", "ok"); done();
        } }
      ],
      onMount: function (wrap) {
        var r = wrap.querySelector("#a-ratio"), rv = wrap.querySelector("#a-ratio-v");
        r.addEventListener("input", function () { rv.textContent = r.value + "%"; });
      }
    });
  }

  /* ---- 初审 ---- */
  function appSheet(ctx, a, done) {
    if (!a) return;
    var ui = ctx.ui;
    if (!ctx.canBoss) {
      ui.openSheet({ title: a.entName, body: "<div class='dl'>" +
        '<span class="k">联系人</span><span class="v">' + ui.esc(a.contact) + " " + ui.esc(a.phone) + "</span>" +
        '<span class="k">申请比例</span><span class="v">' + Math.round(a.ratioToSub * 100) + "%</span>" +
        '<span class="k">状态</span><span class="v">待管理员初审</span></div>' +
        '<div class="v3-readnote v3-mt12" >员工仅有查看权限，不能审批、不能配置比例（D5）。</div>',
        footer: [{ t: "关闭", kind: "v3-btn--ghost" }] });
      return;
    }
    ui.openSheet({
      title: "二级申请 · 初审",
      body:
        '<div class="dl">' +
        '<span class="k">企业名称</span><span class="v">' + ui.esc(a.entName) + "</span>" +
        '<span class="k">信用代码</span><span class="v">' + ui.esc(a.uscc) + "</span>" +
        '<span class="k">联系人</span><span class="v">' + ui.esc(a.contact) + " " + ui.esc(a.phone) + "</span>" +
        '<span class="k">申请比例</span><span class="v v3-goldtext">' + Math.round(a.ratioToSub * 100) + "%（可调，需在 0–50% 与平台配置内）</span></span>" +
        "</div>" +
        '<div class="sh-sec">审批结论</div>' +
        '<div class="v3-field v3-reveal" id="rej-box"><label>驳回原因（必填）</label>' +
        '<textarea class="v3-textarea" id="a-reason" placeholder="如：资质材料不完整，请补充建筑业相关资质"></textarea></div>' +
        '<div class="v3-xs v3-muted">通过后名额 +1，系统生成二级账号与 O4 协议；二级可直接邀终端用户，但不能再发展下级。</div>',
      footer: [
        { t: "驳回", kind: "v3-btn--danger", onClick: function (wrap) {
          var box = wrap.querySelector("#rej-box");
          box.style.gridTemplateRows = "1fr"; box.style.opacity = "1"; box.style.marginTop = "";
          var reason = wrap.querySelector("#a-reason").value.trim();
          if (!reason) { ui.toast("请填写驳回原因", "err"); return false; }
          ctx.V3.store.act("app/review", { id: a.id, pass: false, reason: reason }); ui.toast("已驳回", "ok"); done();
        } },
        { t: "通过并生成协议", kind: "v3-btn--primary", onClick: function () {
          ctx.V3.store.act("app/review", { id: a.id, pass: true }); ui.toast("已通过，名额 +1", "ok"); done();
        } }
      ]
    });
  }

  window.V3PAGES.invite = { title: "邀请获客", render: render, mount: mount };
})();
