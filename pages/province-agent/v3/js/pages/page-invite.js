/* page-invite.js · 省代 邀请获客（渠道码·海报 / 邀请用户 / 转化分佣）
   内部 seg 切换；员工（王敏）仅见本人渠道码与线索；写操作经 act 守卫。 */
(function () {
  "use strict";
  var P = window.V3PAGES = window.V3PAGES || {};
  var curTab = "codes";
  var curCh = null; /* 首次渲染按角色定：员工渠道码在招商分组 */
  var roleSeen = null;
  function chInit(ctx) {
    if (roleSeen !== ctx.s.role) { roleSeen = ctx.s.role; curCh = ctx.isStaff ? "agent" : "direct"; }
  }
  function chipsHtml(ctx) {
    return '<div class="v3-seg v3-seg--wrap"><button class="' + (curCh === "direct" ? "on" : "") + '" data-ch="direct">直接合作渠道</button><button class="' + (curCh === "agent" ? "on" : "") + '" data-ch="agent">招商渠道</button></div>';
  }

  function visibleChannels(ctx) {
    var d = ctx.d;
    var out = { direct: [], agent: [] };
    ["direct", "agent"].forEach(function (ch) {
      out[ch] = (d.channels[ch] || []).filter(function (c) {
        if (ctx.isStaff) return c.ownerType === "staff" && c.ownerName === ctx.s.roleStaffName;
        return true;
      });
    });
    return out;
  }
  function visibleLeads(ctx, ch) {
    var list = (ctx.d.leads[ch] || []).filter(function (l) {
      return ctx.isStaff ? l.owner === ctx.s.roleStaffName : true;
    });
    return list;
  }
  function copyText(text, ui) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { ui.toast("已复制", "ok"); }, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ui.toast("已复制", "ok"); } catch (e) { ui.toast("复制失败，请手动复制", "err"); }
      document.body.removeChild(ta);
    }
  }

  /* ---------- 段 1：渠道码 · 海报 ---------- */
  function renderCodes(ctx) {
    var ui = ctx.ui, d = ctx.d;
    chInit(ctx);
    var h = chipsHtml(ctx);

    /* 招商码（招二级，仅 boss） */
    if (!ctx.isStaff) {
      var ag = d.agentCodes[curCh];
      h += '<div class="v3-card v3-card--pad"><div class="v3-codehd">' +
        '<span class="v3-codehd__t">招商码（招二级企业）</span>' +
        '<span class="v3-badge ' + (ag.status === "active" ? "v3-badge--active" : "v3-badge--neutral") + '">' +
        (ag.status === "active" ? "生效中" : ag.status === "void" ? "已作废" : "未生成") + "</span></div>";
      if (ag.code) {
        h += '<div class="v3-codenum num">' + ag.code + "</div>";
        h += '<div class="v3-codeactions"><button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="copy" data-code="' + ag.code + '">' + ui.icon("link", 15) + " 复制链接</button>" +
          '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="poster" data-code="' + ag.code + '">' + ui.icon("image", 15) + " 海报</button>";
        if (ag.status === "active" && ctx.canBoss) h += '<button class="v3-btn v3-btn--ghost v3-btn--sm v3-btn--danger" data-act="void-agent" data-code="' + ag.code + '">作废</button>';
        h += "</div>";
      } else if (ctx.canBoss) {
        h += '<div class="v3-placeholder">尚未生成招商码</div>' +
          '<button class="v3-btn v3-btn--primary v3-btn--block" data-act="gen-agent">生成招商码</button>';
      }
      h += "</div>";
    }

    /* 渠道码（招用户） */
    var codes = visibleChannels(ctx)[curCh];
    h += '<div class="v3-sec-title">渠道码（邀请用户）' + (ctx.isStaff ? " · 仅本人" : "") + "</div><div class='v3-stack'>";
    if (!codes.length) {
      h += '<div class="v3-placeholder">暂无' + (ctx.isStaff ? "本人渠道码" : "渠道码") + "</div>";
    }
    codes.forEach(function (c) {
      h += '<div class="v3-card v3-card--pad"><div class="v3-codehd">' +
        '<span class="v3-codenum num">' + c.code + "</span>" +
        '<span class="v3-badge ' + (c.status === "active" ? "v3-badge--active" : "v3-badge--neutral") + '">' +
        (c.status === "active" ? "生效中" : "已作废") + "</span></div>" +
        '<div class="v3-kv"><span class="k">归属</span><span class="v">' + ui.esc(c.ownerName) +
        (c.ownerType === "staff" ? "（员工）" : c.ownerType === "sub" ? "（二级）" : "（老板）") + "</span></div>" +
        '<div class="v3-kv"><span class="k">已注册用户</span><span class="v num">' + c.users + " 人</span></div>" +
        '<div class="v3-kv"><span class="k">有效期至</span><span class="v">' + ui.esc(c.validUntil) + "</span></div>";
      if (c.status === "active") {
        h += '<div class="v3-codeactions"><button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="copy" data-code="' + c.code + '">' + ui.icon("link", 15) + " 复制链接</button>" +
          '<button class="v3-btn v3-btn--ghost v3-btn--sm" data-act="poster" data-code="' + c.code + '">' + ui.icon("image", 15) + " 海报</button>" +
          ((ctx.canBoss || (ctx.isStaff && c.ownerName === ctx.s.roleStaffName)) ? '<button class="v3-btn v3-btn--ghost v3-btn--sm v3-btn--danger" data-act="void-channel" data-code="' + c.code + '">作废</button>' : "") +
          "</div>";
      }
      h += "</div>";
    });
    h += "</div>";
    return h;
  }

  /* ---------- 段 2：邀请用户（线索） ---------- */
  function renderUsers(ctx) {
    var ui = ctx.ui;
    chInit(ctx);
    var leads = visibleLeads(ctx, curCh);
    var h = chipsHtml(ctx);
    h += '<div class="v3-sec-title">邀请用户（' + leads.length + "）</div>";
    if (!leads.length) {
      h += '<div class="v3-empty">' + ui.emptyHtml("暂无邀请用户", "<div>生成渠道码并分享后，注册用户将出现在这里。</div>", "user") + "</div>";
    } else {
      h += '<div class="v3-stack">';
      leads.forEach(function (l) {
        h += '<div class="v3-card v3-card--pad"><button class="v3-sub-row v3-sub-row--plain" data-act="lead" data-id="' + l.id + '">' +
          '<span class="v3-avatar"><span class="v3-avatar__txt">' + ui.esc(l.name.slice(0, 1)) + "</span></span>" +
          '<span class="v3-row__main"><span class="v3-row__t">' + ui.esc(l.name) + " <span class=\"v3-xs\">" + ui.esc(l.phone) + "</span></span>" +
          '<span class="v3-row__s">' + ui.esc(l.boundAt || l.createdAt) + (l.owner === "王敏" ? " · 员工渠道" : "") + "</span></span>" +
          '<span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></button>" +
          (l.amount ? '<div class="v3-kv v3-mt8"><span class="k">合格消费</span><span class="v num">' + ui.money(l.amount) + "</span></div>" : "") +
          (l.stage === "lost" ? '<div class="v3-alert v3-alert--warn v3-mt8">' + ui.icon("clock", 13) + "<span>超过 30 天未活跃，仅作提示（暂不支持回收/换绑）。</span></div>" : "") +
          "</div>";
      });
      h += "</div>";
    }
    return h;
  }

  /* ---------- 段 3：转化分佣 ---------- */
  function renderStats(ctx) {
    var ui = ctx.ui;
    var leads = visibleLeads(ctx, "direct").concat(visibleLeads(ctx, "agent"));
    var c = {
      registered: leads.length,
      onboarded: leads.filter(function (l) { return ["onboarded", "paid", "repaid"].indexOf(l.stage) >= 0; }).length,
      paid: leads.filter(function (l) { return l.stage === "paid" || l.stage === "repaid"; }).length,
      lost: leads.filter(function (l) { return l.stage === "lost"; }).length,
      amount: leads.reduce(function (s, l) { return s + (l.amount || 0); }, 0)
    };
    var h = '<div class="v3-sec-title">转化漏斗</div>' +
      '<div class="v3-card v3-card--pad v3-stack-narrow">' +
      funnelRow("注册用户", c.registered, 1) +
      funnelRow("完成入驻", c.onboarded, c.registered ? c.onboarded / c.registered : 0) +
      funnelRow("产生合格消费", c.paid, c.registered ? c.paid / c.registered : 0) +
      funnelRow("沉寂 / 流失", c.lost, c.registered ? c.lost / c.registered : 0, true) +
      '</div><div class="v3-stat-card"><span class="v3-stat-card__k">已转化合格消费合计</span>' +
      '<span class="v3-stat-card__n num">' + ui.money(c.amount) + "</span></div>";
    h += '<div class="v3-info-card"><div class="v3-info-card__title">' + ui.icon("shield", 15) + "<span>分佣口径说明</span></div>" +
      '<div class="v3-legal-body"><p>1. 省代与二级企业的月度所得按<b>约定比例</b>配置，见「二级合作 → 配置约定比例」。</p>' +
      "<p>2. 本页只展示用户转化数据，不展示可提现金额；不存在钱包与自动提现。</p></div></div>";
    return h;
  }
  function funnelRow(label, n, ratio, muted) {
    var pctN = Math.round(ratio * 100);
    return '<div class="v3-frow"><div class="v3-frow__hd"><span class="v3-frow__t' + (muted ? " v3-frow__t--mute" : "") + '">' + label + "</span>" +
      '<span class="v3-frow__n num">' + n + " 人 · " + pctN + "%</span></div>" +
      '<div class="v3-frow__bar"><i class="' + (muted ? "mute" : "") + '" style="width:' + Math.max(pctN, 4) + '%"></i></div></div>';
  }

  /* ---------- 弹层 ---------- */
  function genChannelSheet(ctx) {
    var ui = ctx.ui;
    if (ctx.isStaff) {
      doGen(ctx, "agent");
      return;
    }
    ui.openSheet({
      title: "生成渠道码",
      body: '<div class="v3-list"><button class="v3-row" data-gch="direct"><span class="v3-row__main"><span class="v3-row__t">直接合作渠道</span>' +
        '<span class="v3-row__s">企业线下合作场景的用户邀请</span></span>' + ui.icon("chev", 16) + "</button>" +
        '<button class="v3-row" data-gch="agent"><span class="v3-row__main"><span class="v3-row__t">招商渠道</span>' +
        '<span class="v3-row__s">通过招商合作发展用户</span></span>' + ui.icon("chev", 16) + "</button></div>",
      footer: [{ t: "取消", kind: "v3-btn--ghost" }],
      onMount: function (wrap) {
        Array.prototype.forEach.call(wrap.querySelectorAll("[data-gch]"), function (b) {
          b.addEventListener("click", function () {
            ui.closeAll();
            doGen(ctx, b.getAttribute("data-gch"));
          });
        });
      }
    });
  }
  function doGen(ctx, ch) {
    var ui = ctx.ui;
    var r = ctx.V3.store.act("channel/gen", { channel: ch });
    if (!r.ok) { ui.toast(r.reason, "err"); return; }
    ui.toast("渠道码已生成", "ok");
    ctx.V3.router.render();
    codeSheet(ctx, r.code, ch);
  }
  function codeSheet(ctx, code, ch) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "我的渠道码",
      body: '<div class="v3-invite-qr"><div class="v3-qr" data-code="' + code + '"></div>' +
        '<div class="v3-invite-qr__code num">' + code + "</div>" +
        '<div class="v3-invite-qr__tip">渠道二维码</div>' +
        '<div class="v3-invite-qr__logo">' + ui.icon("shield", 16) + "</div></div>" +
        '<div class="v3-list v3-mt12">' +
        '<button class="v3-row" data-act="copy" data-code="' + code + '"><span class="v3-row__main">' + ui.icon("link", 18) + " 复制链接</span>" + ui.icon("chev", 14) + "</button>" +
        '<button class="v3-row" data-act="poster" data-code="' + code + '"><span class="v3-row__main">' + ui.icon("image", 18) + " 生成海报</span>" + ui.icon("chev", 14) + "</button>" +
        '<button class="v3-row" data-share="wx"><span class="v3-row__main">' + ui.icon("wechat", 18) + " 微信好友 / 朋友圈</span>" + ui.icon("chev", 14) + "</button>" +
        "</div>" +
        '<div class="v3-readnote">' + ui.icon("info", 13) + "<span>分享请复制链接后转发。</span></div>",
      footer: [{ t: "完成", kind: "v3-btn--primary" }],
      onMount: function (wrap) {
        /* 弹层挂在 body 下，页面级委托覆盖不到，必须在 onMount 内绑定 */
        Array.prototype.forEach.call(wrap.querySelectorAll("[data-act]"), function (b) {
          b.addEventListener("click", function () {
            var act = b.getAttribute("data-act");
            var c = b.getAttribute("data-code");
            if (act === "copy") {
              copyText("https://engchain.com/invite?code=" + c, ui);
            } else if (act === "poster") {
              ui.closeAll();
              setTimeout(function () { posterSheet(ctx, c); }, 120);
            }
          });
        });
        var wx = wrap.querySelector("[data-share]");
        if (wx) wx.addEventListener("click", function () { ui.toast("请复制链接后转发", ""); });
      }
    });
  }
  function posterSheet(ctx, code) {
    var ui = ctx.ui;
    ui.openSheet({
      title: "渠道海报",
      body: '<div class="v3-poster"><div class="v3-poster__hd"><b>工程服务合作平台</b><span>官方合作邀请</span></div>' +
        '<div class="v3-poster__tit">扫码注册 · 享工程服务合作权益</div>' +
        '<div class="v3-poster__qr"><div class="v3-qr" data-code="' + code + '"></div><span class="num">' + code + "</span></div>" +
        '<div class="v3-poster__ft">渠道二维码</div></div>',
      footer: [
        { t: "复制邀请码", kind: "v3-btn--ghost", onClick: function () { copyText(code, ui); return false; } },
        { t: "保存海报", kind: "v3-btn--primary", onClick: function () { ui.toast("海报已保存", "ok"); } }
      ]
    });
  }
  function leadSheet(ctx, l) {
    var ui = ctx.ui;
    var notes = (l.notes || []).map(function (n) {
      return '<div class="v3-note"><div class="v3-note__hd">' + ui.esc(n.by) + " <span>" + ui.esc(n.at) + "</span></div>" +
        '<div class="v3-note__bd">' + ui.esc(n.text) + "</div></div>";
    }).join("") || '<div class="v3-placeholder">暂无跟进记录</div>';
    var stages = [["registered", "标记已注册"], ["onboarded", "标记已入驻"], ["paid", "标记已消费"]];
    ui.openSheet({
      title: "线索详情 · " + l.name,
      body: '<div class="v3-kv"><span class="k">手机</span><span class="v">' + ui.esc(l.phone) + "</span></div>" +
        '<div class="v3-kv"><span class="k">绑定时间</span><span class="v">' + ui.esc(l.boundAt || l.createdAt) + "</span></div>" +
        '<div class="v3-kv"><span class="k">当前阶段</span><span class="v"><span class="v3-badge ' + ui.STAGE_BADGE[l.stage] + '">' + ui.STAGE[l.stage] + "</span></span></div>" +
        (l.amount ? '<div class="v3-kv"><span class="k">合格消费</span><span class="v num">' + ui.money(l.amount) + "</span></div>" : "") +
        '<div class="v3-sec-title v3-mt12">跟进记录</div>' + notes +
        '<div class="v3-field v3-mt12"><textarea class="v3-textarea" id="lf-note" placeholder="新增跟进记录…"></textarea></div>',
      footer: [
        { t: "保存跟进", kind: "v3-btn--ghost", onClick: function (wrap) {
          var note = wrap.querySelector("#lf-note").value.trim();
          if (!note) { ui.toast("请填写跟进内容", "err"); return false; }
          var r = ctx.V3.store.act("lead/follow", { channel: curCh, id: l.id, note: note });
          if (!r.ok) { ui.toast(r.reason, "err"); return false; }
          ui.toast("已保存", "ok");
          ctx.V3.router.render();
        } },
        { t: "更新阶段", kind: "v3-btn--primary", onClick: function (wrap) {
          stageSheet(ctx, l);
          return false;
        } }
      ]
    });
  }
  function stageSheet(ctx, l) {
    var ui = ctx.ui;
    var stages = [["registered", "已注册"], ["onboarded", "已入驻"], ["paid", "已消费"]];
    ui.openSheet({
      title: "更新用户阶段",
      body: '<div class="v3-list">' + stages.map(function (s) {
        return '<button class="v3-row" data-stage="' + s[0] + '"><span class="v3-row__main">' + s[1] + "</span>" +
          (l.stage === s[0] ? ui.icon("check", 16) : ui.icon("chev", 14)) + "</button>";
      }).join("") + "</div>",
      footer: [{ t: "关闭", kind: "v3-btn--ghost" }],
      onMount: function (wrap) {
        Array.prototype.forEach.call(wrap.querySelectorAll("[data-stage]"), function (b) {
          b.addEventListener("click", function () {
            var r = ctx.V3.store.act("lead/stage", { channel: curCh, id: l.id, stage: b.getAttribute("data-stage") });
            if (!r.ok) { ui.toast(r.reason, "err"); return; }
            ui.closeAll();
            ui.toast("阶段已更新", "ok");
            ctx.V3.router.render();
          });
        });
      }
    });
  }

  function render(ctx) {
    var ui = ctx.ui;
    var h = '<div class="v3-page-head"><div class="v3-page-title">邀请获客</div>' +
      '<div class="v3-page-sub">渠道码、注册用户与转化数据（单层绑定，不发展下级分润）</div></div>';
    h += '<div class="v3-seg v3-seg--wrap v3-seg--top">' +
      '<button class="' + (curTab === "codes" ? "on" : "") + '" data-tab="codes">渠道码·海报</button>' +
      '<button class="' + (curTab === "users" ? "on" : "") + '" data-tab="users">邀请用户</button>' +
      '<button class="' + (curTab === "stats" ? "on" : "") + '" data-tab="stats">转化分佣</button></div>';
    h += curTab === "codes" ? renderCodes(ctx) : curTab === "users" ? renderUsers(ctx) : renderStats(ctx);
    return h;
  }

  function mount(el, ctx) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act],[data-tab],[data-ch],[data-share]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (b.hasAttribute("data-tab")) {
        curTab = b.getAttribute("data-tab");
        ctx.V3.router.render();
        return;
      }
      if (b.hasAttribute("data-ch")) {
        curCh = b.getAttribute("data-ch");
        ctx.V3.router.render();
        return;
      }
      if (b.hasAttribute("data-share")) {
        ctx.ui.toast("请复制链接后转发", "");
        return;
      }
      if (act === "gen-agent") {
        if (!ctx.canBoss) return ctx.ui.toast("仅老板可生成招商码", "err");
        var r = ctx.V3.store.act("agent/gen", { channel: curCh });
        if (!r.ok) { ctx.ui.toast(r.reason, "err"); return; }
        ctx.ui.toast("招商码已生成", "ok");
        ctx.V3.router.render();
      } else if (act === "void-agent") {
        confirmVoid(ctx, "agent", b.getAttribute("data-code"));
      } else if (act === "void-channel") {
        confirmVoid(ctx, "channel", b.getAttribute("data-code"));
      } else if (act === "copy") {
        copyText(b.getAttribute("data-code"), ctx.ui);
      } else if (act === "poster") {
        posterSheet(ctx, b.getAttribute("data-code"));
      } else if (act === "lead") {
        var l = visibleLeads(ctx, curCh).filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        if (l) leadSheet(ctx, l);
      }
    });
  }

  function confirmVoid(ctx, type, code) {
    var ui = ctx.ui;
    ui.openModal({
      danger: true, icon: "warn", title: "作废「" + code + "」？",
      body: "作废后旧码立即失效，已绑定用户不受影响，可生成新码继续使用。",
      okText: "确认作废",
      onOk: function () {
        var r = type === "agent"
          ? ctx.V3.store.act("agent/void", { channel: curCh, code: code })
          : ctx.V3.store.act("channel/void", { channel: curCh, code: code });
        if (!r.ok) { ui.toast(r.reason, "err"); return false; }
        ui.toast("已作废", "ok");
        ctx.V3.router.render();
      }
    });
  }

  P.invite = {
    title: "邀请获客",
    render: render,
    mount: mount,
    fab: function (ctx) {
      ctx.fab([{ icon: "qr", label: "生成渠道码", onClick: function (c) { genChannelSheet(c); } }]);
    }
  };
})();
