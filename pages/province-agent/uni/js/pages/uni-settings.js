/* ============================================================
   uni-settings.js · 专用设置（tabbar 三主入口之一 · settings.html）
   规则与说明四项同一列表模板，内容按身份换源（E005）。
   组件视觉全部为系统类与 uh 基元；说明弹窗经 Uni.center（.cert-modal）。
   S1 铁律：全页仅 `var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);` 一行身份分支。
   ============================================================ */
(function () {
  "use strict";
  var store = window.V3.store, ui = window.V3.ui;

  var META = {
    cert:    { icon: "badge",    t: "资质证书",     s: "省级总代授权书" },
    perm:    { icon: "users",   t: "角色与权限说明", s: "当前视角可操作与不可操作范围" },
    tax:     { icon: "receipt",  t: "税务说明",     s: "发票与税费口径" },
    settle:  { icon: "history", t: "结算口径",     s: "分佣比例与对账规则" },
    agree:   { icon: "file",     t: "合作协议",     s: "O4 模板条款全文（只读）" },
    auth:    { icon: "shield",   t: "授权范围",     s: "可开展与禁止事项" },
    info:    { icon: "building", t: "合作信息",     s: "与上级省代的合作档案" }
  };

  var STATE_VARIANTS = {
    admin: {
      label: "省级总代 · 管理员",
      data: function (ctx) {
        return { entries: ["cert", "perm", "tax", "settle"] };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "设置项均为只读说明"
    },
    staff: {
      label: "省级总代 · 员工",
      data: function (ctx) {
        return { entries: ["cert", "perm", "tax", "settle"] };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "设置项均为只读说明"
    },
    sub_admin: {
      label: "二级合作企业 · 管理员",
      data: function (ctx) {
        return { entries: ["agree", "auth", "info", "tax"] };
      },
      entries: [],
      perms: {},
      badges: {},
      empty: {},
      lockedNote: "合作已暂停，联系上级省代处理"
    }
  };

  /* ---------- 说明内容构建（按 key 换源） ---------- */
  function bodyOf(key, ctx) {
    var s = ctx.s;
    if (key === "cert") {
      return '<div class="uh-sheetkv"><span class="k">授权对象</span><span class="v">' + ui.esc(s.profile.name) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">统一社会信用代码</span><span class="v">' + ui.esc(s.profile.uscc) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">授权编号</span><span class="v">' + ui.esc(s.profile.authNo) + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">合作起始</span><span class="v">' + ui.esc(s.profile.since) + '</span></div>' +
        '<div style="height:10px"></div><div class="uh-note">以平台盖章签发版本为准。</div>';
    }
    if (key === "perm") {
      var me = ctx.identity === "staff" ? "员工 · " + ctx.staffName : "管理员 · 法定代表人";
      var can = ctx.identity === "staff"
        ? ["管理本人渠道码（CH-E）与本人线索", "查看经营对账与台账数据"]
        : ["全部经营数据与二级合作审批", "生成/作废招商码与渠道码", "登记、确认、异议、冲销与月度平账", "协议发起与团队管理"];
      var cannot = ctx.identity === "staff"
        ? ["登记付款、合作审批、比例配置", "平账、协议签署、查看他人渠道数据"]
        : ["—"];
      return '<div class="uh-sheetkv"><span class="k">当前视角</span><span class="v">' + ui.esc(me) + '</span></div>' +
        '<div style="height:12px"></div>' +
        '<div class="uh-clause"><div class="no">可操作</div><div class="c">' + can.map(function (x) { return "· " + ui.esc(x); }).join("<br>") + '</div></div>' +
        '<div class="uh-clause"><div class="no">不可操作</div><div class="c">' + cannot.map(function (x) { return "· " + ui.esc(x); }).join("<br>") + '</div></div>';
    }
    if (key === "tax") {
      var fifth = ctx.mode === "sub"
        ? "向省代开票的类型与时点，以合作协议约定为准。"
        : "对平台开票规则，以平台协议为准。";
      return '<div class="uh-clause"><div class="no">税费承担</div><div class="c">各方依法各自承担税费。</div></div>' +
        '<div class="uh-clause"><div class="no">发票</div><div class="c">如需开票，按实际结算金额与发票管理规则另行办理。</div></div>' +
        '<div class="uh-clause"><div class="no">余额口径</div><div class="c">合作所得为只读台账口径，不构成可提现余额。</div></div>' +
        '<div class="uh-clause"><div class="no">退款</div><div class="c">退货、退款、取消订单不计入合格消费。</div></div>' +
        '<div class="uh-clause"><div class="no">开票方向</div><div class="c">' + ui.esc(fifth) + '</div></div>' +
        '<div class="uh-note">正式发票与税务规则以平台财务中心上线后公示为准。</div>';
    }
    if (key === "settle") {
      return '<div class="uh-clause"><div class="no">总盘口径</div><div class="c">省代总盘 = 平台合格消费 × 50%。</div></div>' +
        '<div class="uh-clause"><div class="no">约定比例</div><div class="c">二级合作比例 0–50%，逐二级单独配置。</div></div>' +
        '<div class="uh-clause"><div class="no">对账时限</div><div class="c">第一层（与平台）T+5 工作日异议窗口；第二层（与二级）出账后 15 天仅提醒，不自动确认。</div></div>' +
        '<div class="uh-clause"><div class="no">提现与钱包</div><div class="c">本端没有钱包、没有自动提现；线下付款凭凭证登记留痕。</div></div>' +
        '<div class="uh-clause"><div class="no">计入口径</div><div class="c">退货、退款、取消订单不计入合格消费。</div></div>';
    }
    if (key === "agree") {
      var ag = s.agreement || { province: {}, sub: {}, terms: [] };
      var terms = (ag.terms || []).map(function (t) {
        return '<div class="uh-clause"><div class="no">' + ui.esc(t.no + " · " + t.t) + '</div><div class="c">' + ui.esc(t.c) + '</div></div>';
      }).join("");
      return '<div class="uh-sheetkv"><span class="k">甲方</span><span class="v">' + ui.esc((ag.province || {}).name || "") + '</span></div>' +
        '<div class="uh-sheetkv"><span class="k">乙方</span><span class="v">' + ui.esc((ag.sub || {}).name || "") + '</span></div>' +
        '<div style="height:12px"></div>' + terms +
        '<div class="uh-note">协议经电子签签署后生效。</div>';
    }
    if (key === "auth") {
      return '<div class="uh-clause"><div class="no">可开展</div><div class="c">· 直接邀请终端用户<br>· 按约定比例取得经营所得（只读口径）<br>· 跟进自有渠道线索</div></div>' +
        '<div class="uh-clause"><div class="no">禁止</div><div class="c">· 不得发展下级（两级封顶）<br>· 不得自行调整费率与比例<br>· 不得跨区域经营</div></div>' +
        '<div class="uh-note">规模、范围与费率由省代配置，本端只读。</div>';
    }
    /* info */
    return '<div class="uh-sheetkv"><span class="k">上级总代</span><span class="v">' + ui.esc(s.parent.name) + '</span></div>' +
      '<div class="uh-sheetkv"><span class="k">合作起始</span><span class="v">' + ui.esc(s.parent.since) + '</span></div>' +
      '<div class="uh-sheetkv"><span class="k">约定比例</span><span class="v">' + Math.round(s.parent.ratioToSub * 100) + '%（只读）</span></div>' +
      '<div class="uh-sheetkv"><span class="k">发展下级</span><span class="v">永久禁止</span></div>';
  }

  /* 唯一渲染路径 */
  function mount(el, ctx, Uni) {
    var V = Uni.stateVariantFor(STATE_VARIANTS, ctx.identity);
    var vm = V.data(ctx);

    var rows = vm.entries.map(function (key) {
      var m = META[key];
      return '<button class="uh-row" data-key="' + key + '">' +
        '<span class="uh-row__ic">' + ui.icon(m.icon, 18) + '</span>' +
        '<span class="uh-row__main"><span class="uh-row__t">' + ui.esc(m.t) + '</span>' +
        '<span class="uh-row__s">' + ui.esc(m.s) + '</span></span>' +
        '<span class="uh-chev">' + ui.icon("chev", 16) + '</span></button>';
    }).join("");

    el.innerHTML =
      (ctx.readonly ? '<section class="uh-sec"><div class="uh-lockbar">' + ui.icon("lock", 18) +
        '<div><span class="lb-t">合作权限已暂停（仅可查看）</span>' +
        '<span class="lb-s">' + ui.esc(V.lockedNote) + '</span></div></div></section>' : "") +
      '<section class="uh-sec"><div class="uh-list">' + rows + '</div></section>';

    el.querySelectorAll("[data-key]").forEach(function (n) {
      n.addEventListener("click", function () {
        var key = n.getAttribute("data-key");
        Uni.center({
          title: META[key].t,
          body: bodyOf(key, ctx),
          footer: [{ t: "关闭", kind: "primary" }]
        });
      });
    });
  }

  window.Uni.register({
    view: "uni-settings",
    route: "settings.html",
    modes: ["province", "sub"],
    STATE_VARIANTS: STATE_VARIANTS,
    mount: mount
  });
})();
