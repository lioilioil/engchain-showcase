/* ============================================================
   uni-doc.js · 对账卷宗唯一真源（共享模块，无 DOM 副作用）
   原属 uni-reconcile-history.js，2026-11-01 抽离：
     历史对账记录页（openSheet 弹窗 + 下载）与对账中心明细页
     （对账单行 → 单据弹窗 + 下载）共用同一套卷宗模板，
     禁止各自维护第二份 HTML 模板（两份模板必然漂移成两个真值）。
   暴露 window.UniDoc：
     resolve(ctx, h)        历史月 → {calcId, detail, eligibleBase, regs, stmt}
     build(h, ctx, d)       拼接自包含单文件 HTML 卷宗
     fileCard(h, ctx)       → { html, blob, fname, kb } 文件卡 + 下载物料
     bindDownload(el, doc, Uni)  绑定 [data-dl-file] 下载
     fileName / typeLabel / billLine / HIST_LB / HIST_CLS / HIST_NOTE / fmt
   ============================================================ */
(function () {
  "use strict";
  var ui = window.V3.ui;

  var METHOD = { bank: "对公转账", wechat: "微信/支付宝", cash: "现金", other: "其他" };
  var REG_CLS = { pending_confirm: "wait", confirmed: "ok", disputed: "bad", void: "mute" };
  var ITEM_LABEL = { cert: "企业认证", entry: "企业入驻", unlock: "线索解锁", order: "供需订单" };

  var HIST_LB = { pending: "对账中", settled: "已平账", overdue: "逾期锁定" };
  var HIST_CLS = { pending: "wait", settled: "ok", overdue: "bad" };
  var HIST_NOTE = {
    pending: "该月账单处于 5 天对账窗口内，请完成逐笔核对与到账确认；超期将锁定该月对账。",
    settled: "该月已完成对账并平账留痕，无未闭环差异。",
    overdue: "该月账单已超过对账期限（出账后 5 天），对账状态已锁定，仅可查看凭证与明细，不可手动对账。"
  };

  /* ---------- 文案与小工具 ---------- */
  function typeLabel(h) {
    if (h.type === "platform") return "平台→省代";
    if (h.type === "sub") return "省代→二级";
    return "合作分润账单"; /* 兜底 F：sub 域 hist 无 type 字段 */
  }
  function billLine(h) {
    if (h.type === "platform") return "平台分润账单";
    if (h.type === "sub") return "二级分润账单";
    return "合作分润账单";
  }
  function fileName(h) {
    return "对账明细_" + h.month + "_" + billLine(h) + "_" + (HIST_LB[h.state] || "") + ".html";
  }
  function fmt(n) {
    return "¥" + Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtNow() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function itemLb(it) { return ITEM_LABEL[it] || "其他付费"; }
  function sumReg(regs, status) {
    var t = 0;
    regs.forEach(function (r) { if (!status || r.status === status) t += Number(r.amount || 0); });
    return t;
  }
  function stNoOf(regs) {
    for (var i = 0; i < regs.length; i++) {
      var v = regs[i].vouchers && regs[i].vouchers[0] && regs[i].vouchers[0].meta;
      if (v && v.purpose) { var m = /(ST-[0-9A-Za-z-]+)/.exec(v.purpose); if (m) return m[1]; }
    }
    return null;
  }

  /* ---------- 数据映射（产品方案 4.5；按种子数据形态自动适配双域，无身份分支） ----------
     付款登记池：province 域 payRegs1+payRegs2 / sub 域 payRegs。
     历史月 → calcId 固定对应：当月(2026-10)直接取 calc 对象；
     2026-09 省代无 calc → 固定 c0-l1/c0-l2（detail 缺失走兜底 A）；sub 取 calc[1]。
     2026-08 无任何登记/明细/平账数据 → 逾期空态。 */
  function resolve(ctx, h) {
    var s = ctx.s;
    var pool = Array.isArray(s.payRegs1) ? s.payRegs1.concat(s.payRegs2 || []) : (s.payRegs || []);
    var calcId = null, detail = null, eligibleBase = null;
    if (h.month === "2026-10") {
      if (h.type === "sub" && s.calc2) {
        calcId = s.calc2.id; detail = s.calc2.detail; eligibleBase = s.calc2.eligibleBase;
      } else if (s.calc1 && (!h.type || h.type === "platform")) {
        calcId = s.calc1.id; detail = s.calc1.detail; eligibleBase = s.calc1.eligibleBase;
      } else if (Array.isArray(s.calc)) {
        var c = s.calc.filter(function (x) { return x.month === h.month; })[0];
        if (c) { calcId = c.id; detail = c.detail; eligibleBase = c.eligibleBase; }
      }
    } else if (h.month === "2026-09") {
      if (h.type === "platform") calcId = "c0-l1";
      else if (h.type === "sub") calcId = "c0-l2";
      else if (Array.isArray(s.calc)) {
        var c0 = s.calc.filter(function (x) { return x.month === h.month; })[0];
        if (c0) { calcId = c0.id; detail = c0.detail; eligibleBase = c0.eligibleBase; }
      }
    }
    var regs = calcId ? pool.filter(function (r) { return r.calcId === calcId && r.status !== "void"; }) : [];
    var stmt = calcId ? (s.statements || []).filter(function (x) { return x.calcId === calcId; })[0] || null : null;
    return { calcId: calcId, detail: detail, eligibleBase: eligibleBase, regs: regs, stmt: stmt };
  }

  /* ---------- 下载卷宗：内联样式（UI 规范 4.2 色板硬编码 light + dark 两套，唯一例外） ---------- */
  var DOC_CSS = [
    ":root{",
    "--bg:#F4F2EE;--bg-card:#FFFFFF;--bg-subtle:#EDEAE3;--bg-inset:#E4E1DA;",
    "--text-1:#161616;--text-2:#4A4A4A;--text-3:#7A7A7A;",
    "--line:rgba(22,22,22,.07);--line-strong:rgba(22,22,22,.12);",
    "--primary:#B08A3C;--primary-dim:#7A5C1E;--primary-soft:rgba(176,138,60,.12);",
    "--success:#2B6B4F;--success-soft:rgba(43,107,79,.12);",
    "--warning:#C0442A;--warning-ink:#A8321C;--warning-soft:rgba(192,68,42,.14);",
    "--danger:#B3261E;--error-soft:rgba(179,38,30,.10);",
    "--histnote-ok-bg:rgba(45,164,121,.10);--histnote-bad-bg:rgba(236,72,92,.08);",
    "}",
    "@media (prefers-color-scheme: dark){:root{",
    "--bg:#0E0E0E;--bg-card:#1C1C1E;--bg-subtle:#2A2A2C;--bg-inset:#2A2A2C;",
    "--text-1:#F2F0EC;--text-2:#B9B5AD;--text-3:#7A7A7A;",
    "--line:rgba(255,255,255,.10);--line-strong:rgba(255,255,255,.16);",
    "--primary:#C9A45C;--primary-dim:#E0BE80;--primary-soft:rgba(201,164,92,.14);",
    "--success:#52B788;--success-soft:rgba(82,183,136,.16);",
    "--warning:#F0907A;--warning-ink:#F0907A;--warning-soft:rgba(240,144,122,.18);",
    "--danger:#F28B82;--error-soft:rgba(242,139,130,.16);",
    "}}",
    "body{font-family:'PingFang SC','Barlow','Hiragino Sans GB','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text-1);margin:0;-webkit-font-smoothing:antialiased;}",
    ".doc{max-width:640px;margin:0 auto;padding:32px 20px 48px;}",
    ".doc-eyebrow{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--text-3);}",
    ".doc-head h1{font-size:24px;font-weight:700;letter-spacing:-.01em;margin:8px 0 10px;}",
    ".doc-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;color:var(--text-3);margin-top:10px;}",
    ".doc-bignum{font-size:32px;font-weight:800;margin-top:14px;font-variant-numeric:tabular-nums;}",
    ".sec{margin-top:26px;}",
    ".sec-t{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;margin:0 0 10px;}",
    ".sec-t::before{content:'';width:3px;height:13px;background:var(--primary);border-radius:1px;}",
    ".badge{display:inline-block;height:22px;line-height:20px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:600;margin-top:10px;border:1px solid var(--line);}",
    ".badge--wait{background:var(--warning-soft);color:var(--warning-ink);}",
    ".badge--ok{background:var(--success-soft);color:var(--success);}",
    ".badge--bad{background:var(--error-soft);color:var(--danger);}",
    ".sum{padding:12px 14px;background:var(--bg-subtle);border:1px solid var(--line);border-radius:11px;}",
    ".sum-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;color:var(--text-3);}",
    ".sum-row b{font-size:15px;font-weight:800;color:var(--text-1);font-variant-numeric:tabular-nums;}",
    ".t-ok{color:var(--success);}",
    ".t-no{color:var(--warning-ink);}",
    ".dl-item{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);}",
    ".dl-item:last-child{border-bottom:0;}",
    ".dl-item .amt{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;flex:none;}",
    ".dl-info{flex:1;min-width:0;}",
    ".dl-nm{font-size:14px;font-weight:600;}",
    ".dl-od{font-size:11px;color:var(--text-3);margin-top:2px;}",
    ".dl-tag{display:inline-block;font-size:10px;color:var(--primary-dim);background:var(--primary-soft);border-radius:6px;padding:1px 6px;margin-right:4px;}",
    ".dl-total{display:flex;justify-content:space-between;padding:8px 0;font-size:12px;color:var(--text-3);border-top:1px solid var(--line-strong);}",
    ".dl-total b{color:var(--text-1);font-weight:700;}",
    ".note{font-size:12px;color:var(--text-3);line-height:1.6;padding:10px 12px;background:var(--bg-subtle);border:1px solid var(--line);border-radius:11px;}",
    ".dl-reg{padding:11px 0;border-bottom:1px solid var(--line);}",
    ".dl-reg:last-child{border-bottom:0;}",
    ".dl-reg__hd{display:flex;align-items:center;gap:8px;}",
    ".dl-reg__amt{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}",
    ".dl-reg__meta{font-size:12px;color:var(--text-3);margin-top:3px;}",
    ".dl-reg__rsn{font-size:12px;color:var(--warning-ink);line-height:1.6;margin-top:4px;}",
    ".dl-vc{margin-top:8px;border-top:1px dashed var(--line-strong);padding-top:8px;}",
    ".dl-vc__bank{font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;}",
    ".dl-vc__row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px;border-bottom:1px solid var(--line);}",
    ".dl-vc__row:last-child{border-bottom:0;}",
    ".dl-vc__row .k{color:var(--text-3);flex:none;}",
    ".dl-vc__row .v{color:var(--text-1);font-weight:600;text-align:right;}",
    ".openbox{background:var(--warning-soft);border:1px solid var(--line);border-radius:11px;padding:11px 14px;}",
    ".open-item{padding:8px 0;border-bottom:1px solid var(--line);}",
    ".open-item:last-child{border-bottom:0;}",
    ".oi-t{font-size:13px;font-weight:700;}",
    ".oi-d{font-size:12px;color:var(--text-2);line-height:1.6;margin-top:2px;}",
    ".oi-m{font-size:11px;color:var(--text-3);margin-top:2px;}",
    ".balbox{background:var(--success-soft);border:1px solid var(--line);border-radius:11px;padding:12px 14px;}",
    ".bal-st{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}",
    ".bal-kv{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:var(--text-2);}",
    ".bal-kv b{color:var(--text-1);}",
    ".lockbox{display:flex;gap:10px;padding:11px 14px;border-radius:11px;background:var(--warning-soft);border:1px solid var(--line);color:var(--warning);}",
    ".lb-t{font-size:15px;font-weight:700;color:var(--warning-ink);}",
    ".lb-s{font-size:12px;color:var(--text-2);line-height:1.5;margin-top:2px;}",
    ".concl{font-size:13px;line-height:1.8;color:var(--text-2);}",
    ".doc-foot{font-size:11px;color:var(--text-3);text-align:center;margin-top:40px;}",
    "@media print{body{background:#fff;color:#000;}.doc{max-width:none;padding:0;}.sec{break-inside:avoid;}}"
  ].join("");

  function vcRow(k, v) {
    return '<div class="dl-vc__row"><span class="k">' + k + '</span><span class="v">' + ui.esc(v || "—") + '</span></div>';
  }

  /* ---------- 结论段（按状态生成，数字如实计算） ---------- */
  function conclText(h, d, now) {
    var line = billLine(h);
    if (h.state === "overdue") {
      return h.month + " " + line + " " + fmt(h.amount) + " 已逾期锁定：该月无付款登记、无确认到账、无平账留痕记录。如需核对，请联系平台结算（平台结算户对公转账回单渠道）线下处理后补留痕。";
    }
    if (h.state === "settled") {
      var p = [h.month + " " + line + " 已完成对账并平账留痕：确认到账合计 " + fmt(sumReg(d.regs, "confirmed")) +
        "，与账单金额一致，差异 " + fmt(0) + "；无未闭环异议、无待确认登记。"];
      if (d.stmt && d.stmt.status === "balanced") {
        p.push("平账时间 " + (d.stmt.balancedAt || "—") + "，平账人 " + (d.stmt.balancedBy || "—") +
          "，结算单 " + (stNoOf(d.regs) || "—") + "。");
      } else {
        p.push("该月尚无平账留痕记录。");
      }
      p.push("本卷宗即为该月平账凭证留痕。");
      return p.join("");
    }
    /* pending */
    var disp = d.regs.filter(function (r) { return r.status === "disputed"; });
    var pend = d.regs.filter(function (r) { return r.status === "pending_confirm"; });
    var diff = h.amount - sumReg(d.regs);
    var p2 = ["截至 " + now + "，" + h.month + " " + line + " " + fmt(h.amount) + " 处于对账窗口内："];
    if (disp.length) {
      p2.push("存在 " + disp.length + " 笔未闭环异议（" + disp.map(function (r) {
        return fmt(r.amount) + "——『" + (r.reason || "") + "』";
      }).join("；") + "）");
    } else {
      p2.push("无未闭环异议");
    }
    if (pend.length) {
      p2.push((disp.length ? "，" : "") + pend.length + " 笔待确认到账登记（" + pend.map(function (r) {
        return fmt(r.amount) + "，" + (r.date || "") + " 登记";
      }).join("；") + "）");
    }
    p2.push("。当前差异 " + fmt(diff) + "。");
    if (diff < 0) p2.push("登记金额超出账单 " + fmt(-diff) + "，待线下核实。");
    p2.push("请完成逐笔核对与到账确认、闭环异议后，方可进行月度平账；逾期未完成将锁定该月对账。");
    return p2.join("");
  }

  /* ---------- 明细对账卷宗 HTML（自包含单文件，区块按状态显隐） ---------- */
  function build(h, ctx, d) {
    var s = ctx.s;
    var st = h.state;
    var line = billLine(h);
    var cls = HIST_CLS[st];
    var lb = HIST_LB[st];
    var now = fmtNow();
    var entity = (s.profile && s.profile.name) || "";

    var regs = d.regs;
    /* settled 月登记区块仅展示 confirmed 行（回单要素全量）；pending 展示全部有效登记 */
    var showRegs = st === "settled" ? regs.filter(function (r) { return r.status === "confirmed"; }) : regs;
    var regSum = sumReg(regs), confSum = sumReg(regs, "confirmed"),
      pendSum = sumReg(regs, "pending_confirm"), dispSum = sumReg(regs, "disputed");
    var diff = h.amount - regSum;

    function srow(k, v, c) {
      return '<div class="sum-row"><span>' + k + '</span><b' + (c ? ' class="' + c + '"' : "") + '>' + v + '</b></div>';
    }
    var sumHtml = '<div class="sum">' +
      srow("账单金额", fmt(h.amount)) +
      srow("已登记合计", regs.length ? fmt(regSum) : "—") +
      srow("已确认到账", regs.length ? fmt(confSum) : "—") +
      srow("待确认", regs.length ? fmt(pendSum) : "—") +
      srow("异议中", regs.length ? fmt(dispSum) : "—") +
      srow("当前差异", st === "settled" ? fmt(0) : (st === "pending" ? fmt(diff) : "—"),
        st === "settled" ? "t-ok" : (st === "pending" ? "t-no" : "")) +
      '</div>';

    /* 逐笔消费明细（有 detail 展示；province 2026-09 无 → 兜底 A 提示条；overdue 不渲染） */
    var detailSec = "";
    if (d.detail && d.detail.length) {
      var rows = d.detail.map(function (it) {
        return '<div class="dl-item"><span class="amt">' + fmt(it.amount) + '</span>' +
          '<span class="dl-info"><span class="dl-nm">' + ui.esc(it.user) + '</span>' +
          '<span class="dl-od"><span class="dl-tag">' + itemLb(it.item) + '</span>' +
          ui.esc(it.order) + ' · ' + ui.esc(it.date) + '</span></span></div>';
      }).join("");
      var detSum = d.detail.reduce(function (a, it) { return a + Number(it.amount || 0); }, 0);
      detailSec = '<section class="sec"><h2 class="sec-t">逐笔消费明细</h2>' + rows +
        '<div class="dl-total"><span>逐笔合计（' + d.detail.length + ' 笔）</span><b>' + fmt(detSum) + '</b></div>' +
        (d.eligibleBase ? '<div class="dl-total"><span>合格消费基数</span><b>' + fmt(d.eligibleBase) + '</b></div>' : "") +
        '</section>';
    } else if (st !== "overdue") {
      detailSec = '<section class="sec"><h2 class="sec-t">逐笔消费明细</h2>' +
        '<div class="note">该月逐笔消费明细未留存；本卷宗以付款登记与银行电子回单为对账依据。</div></section>';
    }

    /* 付款登记与凭证留痕（overdue 不渲染；无登记 → 兜底 B） */
    var regSec = "";
    if (st !== "overdue") {
      if (!showRegs.length) {
        regSec = '<section class="sec"><h2 class="sec-t">付款登记与凭证留痕</h2>' +
          '<div class="note">该月无付款登记记录</div></section>';
      } else {
        var rr = showRegs.map(function (r) {
          var g = '<div class="dl-reg"><div class="dl-reg__hd">' +
            '<span class="dl-reg__amt">' + fmt(r.amount) + '</span>' +
            '<span class="badge badge--' + (REG_CLS[r.status] || "mute") + '">' + (ui.REG[r.status] || r.status) + '</span></div>' +
            '<div class="dl-reg__meta">' + (METHOD[r.method] || r.method) + " · " + ui.esc(r.date) +
            ' · 登记人 ' + ui.esc(r.registeredBy || "") + '</div>';
          if (r.reason) g += '<div class="dl-reg__rsn">异议：' + ui.esc(r.reason) +
            (r.disputedAt ? '（' + ui.esc(r.disputedAt) + ' 提出）' : '') + '</div>';
          /* 兜底 D：有 vouchers.meta 才展开回单要素，不虚构流水号 */
          if (r.vouchers && r.vouchers[0] && r.vouchers[0].meta) {
            var m = r.vouchers[0].meta;
            g += '<div class="dl-vc"><div class="dl-vc__bank">' + ui.esc(m.bank || "银行") + ' · 电子转账回单</div>' +
              vcRow("银行", m.bank) + vcRow("交易流水号", m.bankNo) + vcRow("付款方", m.payer) +
              vcRow("收款方", m.payee) + vcRow("转账用途", m.purpose) + vcRow("交易时间", m.at) +
              vcRow("经办人", m.by) + vcRow("金额大写", m.amountCn) + '</div>';
          }
          return g + '</div>';
        }).join("");
        regSec = '<section class="sec"><h2 class="sec-t">付款登记与凭证留痕</h2>' + rr + '</section>';
      }
    }

    /* 平账留痕（仅 settled 且存在 balanced statement；兜底 C 不渲染） */
    var balSec = "";
    if (st === "settled" && d.stmt && d.stmt.status === "balanced") {
      var stNo = stNoOf(showRegs) || stNoOf(regs) || "—";
      var signTxt = "电子签留痕";
      for (var i = 0; i < showRegs.length; i++) {
        if (showRegs[i].signMethod === "esign") {
          signTxt = "电子签留痕（" + (showRegs[i].confirmedAt || "") + "）";
          break;
        }
      }
      balSec = '<section class="sec"><h2 class="sec-t">平账留痕</h2><div class="balbox">' +
        '<div class="bal-st">' + ui.esc(stNo) + '</div>' +
        '<div class="bal-kv"><span>平账时间</span><b>' + ui.esc(d.stmt.balancedAt || "—") + '</b></div>' +
        '<div class="bal-kv"><span>平账人</span><b>' + ui.esc(d.stmt.balancedBy || "—") + '</b></div>' +
        '<div class="bal-kv"><span>确认方式</span><b>' + signTxt + '</b></div>' +
        '</div></section>';
    }

    /* 未闭环事项（pending 独有） */
    var openSec = "";
    if (st === "pending") {
      var items = "";
      regs.filter(function (r) { return r.status === "disputed"; }).forEach(function (r) {
        items += '<div class="open-item"><div class="oi-t">异议项 · ' + fmt(r.amount) + '</div>' +
          '<div class="oi-d">' + ui.esc(r.reason || "") + '</div>' +
          '<div class="oi-m">' + ui.esc(r.disputedAt || r.date || "") + ' 提出 · 待双方核实</div></div>';
      });
      regs.filter(function (r) { return r.status === "pending_confirm"; }).forEach(function (r) {
        items += '<div class="open-item"><div class="oi-t">待确认登记 · ' + fmt(r.amount) + '</div>' +
          '<div class="oi-m">' + ui.esc(r.date || "") + ' 登记 · 待确认到账</div></div>';
      });
      if (items) openSec = '<section class="sec"><h2 class="sec-t">未闭环事项</h2><div class="openbox">' + items + '</div></section>';
    }

    /* 锁定说明条（overdue 独有） */
    var lockSec = "";
    if (st === "overdue") {
      lockSec = '<section class="sec"><div class="lockbox">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex:none;margin-top:2px"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>' +
        '<div><div class="lb-t">对账已逾期 · 状态已锁定</div>' +
        '<div class="lb-s">该月账单出账后 5 天对账窗口已过，对账状态已锁定，仅可查看，不可手动对账、不可补登记。</div></div>' +
        '</div></section>';
    }

    var concl = conclText(h, d, now);

    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + ui.esc(h.month + " " + line + " · 对账明细") + '</title>\n' +
      '<style>' + DOC_CSS + '</style>\n</head>\n<body>\n<div class="doc">\n' +
      '<header class="doc-head">' +
      '<div class="doc-eyebrow">ENGCHAIN 合作工作台 · 对账明细卷宗</div>' +
      '<h1>' + ui.esc(h.month + " " + line) + '</h1>' +
      '<span class="badge badge--' + cls + '">' + lb + '</span>' +
      '<div class="doc-meta">' +
      '<span>出账日：' + ui.esc(h.issueAt || "—") + '</span>' +
      '<span>对账截止：' + ui.esc(h.dueAt || "—") + '</span>' +
      '<span>出具时间：' + ui.esc(now) + '</span>' +
      '<span>企业主体：' + ui.esc(entity) + '</span>' +
      '</div>' +
      '<div class="doc-bignum">' + fmt(h.amount) + '</div>' +
      '</header>' +
      '<section class="sec"><h2 class="sec-t">对账概要</h2>' + sumHtml + '</section>' +
      detailSec + regSec + balSec + openSec + lockSec +
      '<section class="sec"><h2 class="sec-t">结论</h2><p class="concl">' + ui.esc(concl) + '</p></section>' +
      '<footer class="doc-foot">本文件由合作工作台于 ' + ui.esc(now) + ' 自动生成，仅作对账留痕参考；数据口径以平台月度合格消费账单为准。</footer>' +
      '</div>\n</body>\n</html>';
  }

  /* ---------- 文件卡（生成文件 → Blob 真实大小 → 渲染 meta，不编造固定值） ---------- */
  function fileCard(h, ctx) {
    var data = resolve(ctx, h);
    var html = build(h, ctx, data);
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    var fname = fileName(h);
    return {
      data: data, blob: blob, fname: fname, kb: (blob.size / 1024).toFixed(1),
      html: '<div class="dl-file">' +
        '<div class="dl-file__row">' +
        '<span class="dl-file__ic">' + ui.icon("file", 22) + '</span>' +
        '<div class="dl-file__info">' +
        '<div class="dl-file__nm">' + ui.esc(fname) + '</div>' +
        '<div class="dl-file__meta">HTML 网页 · 约 ' + (blob.size / 1024).toFixed(1) + ' KB</div>' +
        '</div></div>' +
        '<button type="button" class="btn btn-primary btn-sm btn-block" data-dl-file>' +
        ui.icon("download", 15) + ' 下载明细对账文件</button>' +
        '</div>'
    };
  }

  function bindDownload(el, doc, Uni) {
    var btn = el.querySelector("[data-dl-file]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var url = URL.createObjectURL(doc.blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = doc.fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      if (Uni && Uni.toast) Uni.toast("已开始下载明细对账文件", "ok");
    });
  }

  /* ---------- 单据弹窗（对账中心明细 / 经营台账 / 对账历史共用） ----------
     opt.more = { t: "全部账期", on: function () {} } → 右下角附加跳转按钮 */
  function openSheet(ctx, h, Uni, opt) {
    opt = opt || {};
    var cls = HIST_CLS[h.state] || "mute";
    var d = resolve(ctx, h);
    var doc = fileCard(h, ctx);
    var conf = sumReg(d.regs, "confirmed"), pend = sumReg(d.regs, "pending_confirm"),
      disp = sumReg(d.regs, "disputed");
    function row(k, v) {
      return '<div class="uh-kv"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
    }
    /* 口径与对账中心一致：差异 = 账单 − 已确认到账（不是账单 − 已登记）；
       二者混用会让同一页出现两个"差异" */
    var body =
      '<div class="uh-finhead" style="margin:2px 0 0"><span class="uh-eyebrow">' +
      ui.esc(typeLabel(h) + " · " + h.month) + '</span>' +
      '<span class="uh-badge uh-badge--' + cls + '">' + (HIST_LB[h.state] || "") + "</span></div>" +
      '<div class="uh-bignum">' + ui.moneyD(h.amount) + "</div>" +
      '<div class="uh-note" style="margin-top:12px">' + ui.esc(HIST_NOTE[h.state] || "") + "</div>" +
      '<div class="uh-sechead" style="margin:18px 0 2px"><span class="lbl">账单信息</span></div>' +
      row("出账日", ui.esc(h.issueAt || "—")) +
      row("对账截止", ui.esc(h.dueAt || "—")) +
      (h.settledAt ? row("平账时间", ui.esc(h.settledAt)) : "") +
      '<div class="uh-sechead" style="margin:18px 0 2px"><span class="lbl">对账单摘要</span></div>' +
      row("账单金额", ui.money(h.amount)) +
      row("已确认到账", d.regs.length ? ui.money(conf) : "—") +
      row("待确认", d.regs.length ? ui.money(pend) : "—") +
      row("异议中", d.regs.length ? ui.money(disp) : "—") +
      row("未到账（账单 − 已确认）", d.regs.length ? ui.money(h.amount - conf) : "—") +
      '<div class="uh-sechead" style="margin:18px 0 2px"><span class="lbl">对账文件</span></div>' +
      doc.html;
    var foot = [{ t: "关闭", kind: "ghost" }];
    if (opt.more) foot.push({ t: opt.more.t, kind: "primary", onClick: opt.more.on });
    var ov = Uni.center({ title: "对账单 · " + h.month, body: body, footer: foot });
    bindDownload(ov, doc, Uni);
    return ov;
  }

  window.UniDoc = {
    METHOD: METHOD, REG_CLS: REG_CLS, ITEM_LABEL: ITEM_LABEL,
    HIST_LB: HIST_LB, HIST_CLS: HIST_CLS, HIST_NOTE: HIST_NOTE,
    typeLabel: typeLabel, billLine: billLine, fileName: fileName, fmt: fmt, sumReg: sumReg,
    resolve: resolve, build: build, fileCard: fileCard, bindDownload: bindDownload,
    openSheet: openSheet
  };
})();
