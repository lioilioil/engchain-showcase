/* 工程链 · 单一供需详情引擎 (按业务场景分发，复用统一 shell) */
window.DETAIL = (function () {
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-' + name + '"/></svg>'; }
  function mt(iconName, txt) { return icon(iconName) + txt; }
  /* ---- Markdown 轻量渲染（标题/段落/列表/引用/加粗/链接） ---- */
  function inlineMd(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    text = text.replace(/`(.+?)`/g, '<code>$1</code>');
    return text;
  }
  function renderMarkdown(md) {
    if (!md) return '';
    var lines = md.split('\n');
    var html = '', inList = false, listType = '';
    function closeList() { if (inList) { html += '</' + listType + '>'; inList = false; } }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) { closeList(); continue; }
      if (t.match(/^###\s+/)) { closeList(); html += '<h3>' + inlineMd(t.replace(/^###\s+/, '')) + '</h3>'; continue; }
      if (t.match(/^##\s+/)) { closeList(); html += '<h2>' + inlineMd(t.replace(/^##\s+/, '')) + '</h2>'; continue; }
      if (t.match(/^#\s+/)) { closeList(); html += '<h1>' + inlineMd(t.replace(/^#\s+/, '')) + '</h1>'; continue; }
      if (t.match(/^>\s?/)) { closeList(); html += '<blockquote>' + inlineMd(t.replace(/^>\s?/, '')) + '</blockquote>'; continue; }
      if (t.match(/^[-*]\s+/)) {
        if (!inList || listType !== 'ul') { closeList(); html += '<ul>'; inList = true; listType = 'ul'; }
        html += '<li>' + inlineMd(t.replace(/^[-*]\s+/, '')) + '</li>'; continue;
      }
      if (t.match(/^\d+\.\s+/)) {
        if (!inList || listType !== 'ol') { closeList(); html += '<ol>'; inList = true; listType = 'ol'; }
        html += '<li>' + inlineMd(t.replace(/^\d+\.\s+/, '')) + '</li>'; continue;
      }
      closeList();
      html += '<p>' + inlineMd(t) + '</p>';
    }
    closeList();
    return html;
  }
  function dirTag(dir) {
    if (dir === 'demand') return { cls: 'tag-blue', txt: '需求' };
    if (dir === 'supply') return { cls: 'tag-primary', txt: '供应' };
    return { cls: 'tag-gold', txt: '机会' };
  }
  function heroPrice(r) { if (r.price) return r.price; return r.budget || ''; }
  function cfgText(s) { return (s == null ? '' : String(s)); }
  function dHero(o) {
    return '<div class="detail-hero ' + (o.dark ? 'detail-hero--dark' : '') + '" style="padding:22px 24px 18px;">' +
      '<div class="dh-tag">' + cfgText(o.tag) + (o.verifiedHint ? ' · ' + o.verifiedHint : '') + '</div>' +
      '<div class="dh-title">' + cfgText(o.title) + '</div>' +
      (o.price ? '<div class="dh-price-row"><span class="dh-price">' + o.price + '</span><span class="dh-price-unit">' + cfgText(o.unit) + '</span></div>' : '') +
      (o.meta && o.meta.length ? '<div class="dh-meta">' + o.meta.map(function (m) { return '<span class="dh-meta-item">' + m + '</span>'; }).join('') + '</div>' : '') +
      '</div>';
  }
  function matchMeta(r) { return [mt('pin', r.location), mt('check', 'AI匹配 ' + r.match + '%'), mt('eye', r.views + ' 浏览')]; }
  function oppMeta(r) { return [mt('pin', r.location), mt('check', 'AI匹配 ' + r.match + '%'), mt('eye', r.views + ' 浏览')]; }
  /* ---- 解锁状态持久化（P0）：localStorage 快速渲染 + 分类有效期（原型无服务端，仅本地模拟持久化） ---- */
  var UnlockStore = {
    KEY: 'engchain-unlocked',
    _read: function () { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
    /* [FIX BM-014] _write 后派发 engchain-unlock-changed 事件，其他监听页面/组件可实时联动刷新解锁态 */
    _write: function (o) {
      try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('engchain-unlock-changed', { detail: o })); } catch (e) { }
    },
    _key: function (rec) { return (rec.bizKey || 'unknown') + '_' + rec.id; },
    /* 有效期（天）：普通供需/合作永久；人才单条 7 天；建企转让保证金 30 天；-1 表示永久 */
    _ttlDays: function (bizKey) {
      if (bizKey === 'talent') return 7;
      if (bizKey === 'trade') return 30;
      return -1;
    },
    /* 免费/不设锁类别：企业招聘 personnel（投递流程替代付费墙）、中介服务 agency（免费留资咨询）；资质招商 franchise 走分级积分解锁（inlineLock），留资/解锁前联系方式先模糊 */
    isFree: function (bizKey) { return bizKey === 'personnel' || bizKey === 'publish'; },
    isUnlocked: function (rec) {
      if (!rec) return false;
      if (this.isFree(rec.bizKey)) return true;
      var rec0 = this._read()[this._key(rec)];
      if (!rec0) return false;
      var days = this._ttlDays(rec.bizKey);
      if (days < 0) return true;
      return (Date.now() - (rec0.t || 0)) < days * 864e5;
    },
    mark: function (rec) { var o = this._read(); o[this._key(rec)] = { t: Date.now() }; this._write(o); },
    clear: function (rec) { var o = this._read(); delete o[this._key(rec)]; this._write(o); },
    /* [FIX BM-014] reset：清除全部解锁记录并恢复默认空状态，同时派发事件通知监听方 */
    reset: function () {
      try { localStorage.removeItem(this.KEY); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('engchain-unlock-changed', { detail: {} })); } catch (e) { }
    }
  };
  /* ---- 就近打码 helper（P0）：locked 时按粒度输出打码 HTML，解锁后输出明文；配合 app.css .pw-* 组件 ---- */
  /* [E3-9] 付费墙类名与设计文档对应关系（仅注释对齐，不修改 CSS 类名）：
     .pw-blur   -> Lock.full()   整值模糊（文案/描述段落整段遮罩）
     .pwp/.pw-val/.pwp-mask/.pwp-real -> Lock.partial()/Lock.price()  部分掩码（手机号/价格，明文同帧渲染原地解锁）
     .pw-file/.pw-file-veil -> Lock.file()  文件卡磨砂锁层 */
  var Lock = {
    lockIc: '<span class="pw-lock-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-lock"/></svg></span>',
    partialPhone: function (s) { s = String(s == null ? '' : s); if (s.length < 7) return '****'; return s.slice(0, 3) + '****' + s.slice(-4); },
    /* ① 整值模糊：未解锁整段模糊，点击唤起解锁 */
    full: function (plain, locked) {
      plain = cfgText(plain);
      return locked ? '<span class="pw-blur" data-pw>' + plain + '</span>' : plain;
    },
    /* ② 部分掩码：未解锁显示掩码文本（默认手机号规则）+ 小锁标；明文同帧渲染、由 .is-unlocked 切换显隐，保证原地解锁 */
    partial: function (plain, locked, masked) {
      plain = cfgText(plain);
      if (!locked) return plain;
      var mask = cfgText(masked || this.partialPhone(plain));
      return '<span class="pwp"><span class="pw-val pwp-mask">' + mask + this.lockIc + '</span><span class="pwp-real">' + plain + '</span></span>';
    },
    /* ③ 价格/数值区间：未解锁显示占位 + 小锁标，解锁原地展开精确值（明文同帧渲染） */
    price: function (plain, locked, placeholder) {
      plain = cfgText(plain);
      if (!locked) return plain;
      return '<span class="pwp"><span class="pw-val pwp-mask">' + cfgText(placeholder || '价格待解锁') + this.lockIc + '</span><span class="pwp-real">' + plain + '</span></span>';
    },
    /* ④ 文件：未解锁在文件卡上覆盖磨砂锁层 */
    file: function (innerHtml, locked, label) {
      if (!locked) return innerHtml;
      return '<div class="pw-file">' + innerHtml + '<div class="pw-file-veil" data-pw><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-lock"/></svg><span>' + cfgText(label || '解锁查看文件') + '</span></div></div>';
    },
    /* 信息卡内就近解锁胶囊（与底部全局 CTA 唤起同一个解锁 Sheet）；已解锁返回空串 */
    inline: function (locked, title, sub, priceText) {
      if (!locked) return '';
      return '<div class="pw-inline" data-pw-unlock><div class="pw-inline-l"><div class="pw-inline-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-lock"/></svg></div><div><div class="pw-inline-t">' + cfgText(title || '解锁查看完整信息') + '</div>' +
        (sub ? '<div class="pw-inline-s">' + cfgText(sub) + '</div>' : '') + '</div></div>' +
        (priceText ? '<div class="pw-inline-price">' + cfgText(priceText) + '</div>' : '') + '</div>';
    }
  };
  /* [FIX BM-010] trade 保证金台账（localStorage）：记录冻结/释放状态，30 天 TTL 到期自动解冻退还 */
  var TRADE_DEP_KEY = 'engchain-trade-deposits';
  function _tradeDepositRead() { try { return JSON.parse(localStorage.getItem(TRADE_DEP_KEY) || '[]'); } catch (e) { return []; } }
  function _tradeDepositWrite(arr) { try { localStorage.setItem(TRADE_DEP_KEY, JSON.stringify(arr)); } catch (e) { } }
  function sweepTradeDeposits() {
    if (!window.BalanceStore) return;
    var arr = _tradeDepositRead(); var now = Date.now(); var changed = false;
    arr.forEach(function (d) {
      if (d.status !== 'frozen' || !d.releaseAt || d.releaseAt > now) return;
      var s = BalanceStore.read();
      s.frozen = Math.max(0, Math.round((s.frozen - d.amount) * 100) / 100);
      s.logs.unshift({ type: 'trade_deposit_released', amount: d.amount, method: 'refund', reason: '保证金 30 天到期解冻退还', ts: now, ref: d.ref });
      BalanceStore.write(s);
      d.status = 'released'; d.releasedAt = now; changed = true;
    });
    if (changed) _tradeDepositWrite(arr);
  }
  /* [FIX BM-012] 锁区价签统一从 MOCK.business.credits.consume 读取，文案为「N 积分 / 次」；trade 保证金保留人民币；免费类显示「免费咨询」 */
  function unlockCreditText(rec) {
    try {
      var up = unlockPriceOf(rec);
      if (up.mode === 'deposit') return '¥' + Number(up.price).toLocaleString() + ' 可退保证金';
      if (up.mode === 'free') return '免费咨询';
      return up.price + ' 积分 / 次';
    } catch (e) { return '98 积分 / 次'; }
  }
  /* 键值信息表（方案B）：与 matKVTable 同构，统一为 spec-table 卡片样式（标签固定列宽 + 值左对齐自适应） */
  function dList(fields) {
    return '<div class="spec-table">' + fields.map(function (f) { return '<div class="spt-row"><span class="spt-k">' + cfgText(f.k) + '</span><span class="spt-v">' + cfgText(f.v) + '</span></div>'; }).join('') + '</div>';
  }
  function sec(label, inner) { return '<div class="detail-section"><div class="ds-label">' + label + '</div>' + inner + '</div>'; }
  /* ---- 供需匹配 4 类：共用结构，仅字段标签/文案不同 ---- */
  var MATCH = {
    material:    { label: '材料采购',          contactLabel: '采购方', addrLabel: '交货地址',   fileLabel: '招标采购文件', fileDefault: '招标清单（联系获取）', cta: '联系采购方', secTitle: '采购说明', supplyTitle: '供应说明', fieldsTitle: '关键参数', qualTitle: '供应商要求' },
    labor:       { label: '劳务用工',          contactLabel: '用工方', addrLabel: '项目地址',   fileLabel: '上岗材料',    fileDefault: '上岗清单（联系获取）', cta: '联系用工方', secTitle: '用工说明', supplyTitle: '班组介绍', fieldsTitle: '用工需求', qualTitle: '用工要求' },
    equipment:   { label: '设备租赁',          contactLabel: '出租方', addrLabel: '设备/仓库地址', fileLabel: '设备清单',   fileDefault: '设备清单（联系获取）', cta: '联系出租方', secTitle: '设备说明', supplyTitle: '设备说明', fieldsTitle: '设备参数与租赁条款', qualTitle: '设备与服务要求' },
    cooperation: { label: '建筑合作·分包',      contactLabel: '合作方', addrLabel: '项目地址',   fileLabel: '合同模板',    fileDefault: '合同模板（联系获取）', cta: '洽谈合作', secTitle: '合作说明', supplyTitle: '合作说明', fieldsTitle: '项目与合作信息', qualTitle: '合作要求' }
  };
  function matchBody(r, cfg) {
    var h = '';
    var introTitle = r.dir === 'demand' ? cfg.secTitle : (cfg.supplyTitle || cfg.secTitle);
    if (r.desc || r.detail) h += sec(introTitle, '<div class="ds-text">' + (r.desc || r.detail) + '</div>');
    if (r.fields && r.fields.length) h += sec(cfg.fieldsTitle || '关键信息', dList(r.fields));
    if (r.qual) h += sec(cfg.qualTitle, '<div class="ds-text">' + r.qual + '</div>');
    return h;
  }
  /* ---- 通用：扶持/权益卡网格（条目格式「标题：描述」） ---- */
  function benefitGrid(benefits) {
    var icons = ['shield', 'doc', 'user', 'wallet', 'tool', 'star'];
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      benefits.map(function (b, i) {
        var parts = b.split('：');
        var title = parts[0] || b;
        var desc = parts[1] || '';
        return '<div style="padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--line);">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">' +
          '<div style="width:22px;height:22px;border-radius:6px;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;flex:none;color:var(--primary-dim);">' + icon(icons[i % icons.length]) + '</div>' +
          '<span style="font-size:12px;font-weight:700;color:var(--text-1);">' + title + '</span></div>' +
          (desc ? '<div style="font-size:10.5px;color:var(--text-3);line-height:1.5;padding-left:28px;">' + desc + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }
  /* ---- 通用：Zigzag之字形时间线（中间竖线+左右交替，经典流畅蛇形布局） ---- */
  function stepTimeline(steps) {
    var html = '<div class="zz-flow">';
    steps.forEach(function (p, i) {
      var isLeft = (i % 2 === 0);
      var side = isLeft ? 'left' : 'right';
      html += '<div class="zz-step zz-' + side + '">' +
        '<div class="zz-dot">' + p.step + '</div>' +
        '<div class="zz-content">' +
          '<div class="zz-title">' + p.title + '</div>' +
          (p.desc ? '<div class="zz-desc">' + p.desc + '</div>' : '') +
        '</div></div>';
    });
    return html + '</div>';
  }
  /* ---- 通用：平台保障（按业务类型差异化，人才/招聘自带保障则跳过） ---- */
  var GUARANTEE = {
    material: ['平台质检先行样，到货验收合格再结算', '货款第三方资金监管，按节点放款', '不合格材料无条件退换', '违约逾期，平台先行赔付'],
    equipment: ['设备进场联合验收，状态留痕', '押金平台监管，到期原路退回', '故障 48 小时内换机，误工可协商减免', '租金担保结算，纠纷平台介入调解'],
    labor: ['工人实名制核验，三级安全教育留档', '工资专户代发，按月足额到账', '全员工伤意外险覆盖', '完工结算担保，欠薪平台先行垫付'],
    cooperation: ['标准分包/合作合同模板，法务在线审', '节点资金第三方监管，按进度付款', '合作方资质联网核验', '合作纠纷平台调解与维权协助'],
    franchise: ['总部资质与授权真实性平台核验', '加盟/代理资金分阶段担保', '合同模板与区域保护条款备案', '经营纠纷平台介入，违规可投诉赔付'],
    trade: ['交易资金第三方监管，变更完成再放款', '股权/资质变更全程代办指引', '标准买卖合同模板与法务咨询', '交接纠纷平台调解，欺诈先行赔付'],
    agency: ['服务不过按约退款，条款写入合同', '企业材料加密保密，办结即销毁', '服务进度线上可视，节点主动通知', '投诉 24 小时响应，违规机构下架'],
    personnel: ['企业资质与招聘信息平台核验，四库一平台可查', '人才免费投递，企业付费查看，不向求职者收费', '投递后企业 24 小时内反馈，超时平台提醒', '虚假招聘可举报，核实后下架并协助维权'],
    talent: ['证书经四库一平台编号比对核验，状态真实可查', '人才实名认证，简历信息平台审核', '解锁后 7 天内可查看并联系，失效可退', '虚假简历可举报，核实后全额退款', '人才免费发布，企业付费查看'],
    publish: ['信息真实性平台核验，违规下架并协助维权', '沟通与交易全程留痕，纠纷平台介入调解', '认证主体实名核验，杜绝虚假信息', '对接信息加密存储，杜绝泄露']
  };
  var GUARANTEE_TITLE = { agency: '服务承诺' };
  function guaranteeSec(rec) {
    var items = GUARANTEE[rec.bizKey];
    if (!items || !items.length) return '';
    /* P3-8：成交类详情页增加平台佣金费率说明，提升成交信任 */
    var dealTypes = ['cooperation', 'material', 'equipment', 'labor'];
    var commHtml = '';
    if (dealTypes.indexOf(rec.bizKey) >= 0) {
      var cm = (MOCK.business && MOCK.business.commission) || {};
      var tiers = cm.tier || [];
      var isBreakin = !!(window.ModeStore && ModeStore.isBreakIn());
      var firstRate = isBreakin ? ((MOCK.business.breakin || {}).commissionFirstTier || 0.05) : (tiers[0] ? tiers[0].rate : 0.08);
      var tierText = tiers.map(function(t) { return (t.min / 10000) + '万以上 ' + (t.rate * 100) + '%'; }).join(' / ');
      commHtml = '<div style="margin-top:10px;padding:8px 12px;background:var(--primary-soft);border:1px solid var(--accent-line);border-radius:8px;"><div style="font-size:11px;font-weight:600;color:var(--primary-dim);margin-bottom:3px;">平台服务费（成交后收取）</div><div style="font-size:10.5px;color:var(--text-2);line-height:1.5;">阶梯费率：' + tierText + '%，最低 ' + (cm.minCommission || 10000).toLocaleString() + ' 元' + (isBreakin ? '；<b style="color:var(--accent);">破冰期首档优惠至 ' + (firstRate * 100) + '%（5万以下成交）</b>' : '') + '</div></div>';
    }
    var gtIcons = ['shield', 'wallet', 'doc', 'check'];
    var rows = items.map(function (x, i) {
      return '<div class="gt-card"><div class="gt-ic">' + icon(gtIcons[i % gtIcons.length]) + '</div><div class="gt-tx">' + x + '</div></div>';
    }).join('');
    var gtTitle = GUARANTEE_TITLE[rec.bizKey] || '平台保障';
    return sec(gtTitle, '<div class="gt-wrap">' +
      '<div class="gt-head">' + icon('shield') + '<div><div class="gt-head-t">' + gtTitle + ' · 交易全流程安心护航</div><div class="gt-head-s">工程链平台为每笔交易提供全链路保障</div></div></div>' +
      '<div class="gt-grid">' + rows + '</div>' +
      (commHtml ? '<div class="gt-comm">' + commHtml + '</div>' : '') +
      '</div>');
  }
  /* ---- 通用：相关推荐（同业务类型，同子类/同城优先，人才/招聘各自有推荐则跳过） ---- */
  var RELATED_LABEL = { material: '材料', equipment: '设备', labor: '劳务', cooperation: '合作', franchise: '招商', trade: '转让', agency: '服务', personnel: '招聘' };
  function relatedSec(rec) {
    if (!MOCK.byBizType) return '';
    if (rec.bizKey === 'talent') return '';
    var mockPool = MOCK.byBizType(rec.bizKey).filter(function (x) { return String(x.id) !== String(rec.id); });
    var pool = mockPool.slice();
    /* mergedList 同源：混入 SupplyStore 中同 bizKey 的用户发布条目 */
    try {
      if (window.SupplyStore) {
        SupplyStore.listActive().forEach(function (x) {
          if (x.bizKey === rec.bizKey && String(x.id) !== String(rec.id) && !pool.some(function (y) { return String(y.id) === String(x.id); })) {
            pool.push(x);
          }
        });
      }
    } catch (e) {}
    if (!pool.length) return '';
    pool.sort(function (a, b) {
      var sa = (a.sub === rec.sub ? 2 : 0) + (a.city === rec.city ? 1 : 0) + ((a.match || 0) / 100);
      var sb = (b.sub === rec.sub ? 2 : 0) + (b.city === rec.city ? 1 : 0) + ((b.match || 0) / 100);
      return sb - sa;
    });
    var rel = pool.slice(0, 3);
    var label = RELATED_LABEL[rec.bizKey] || '相关';
    var relHtml = window.Cards ? Cards.render(rel, 'detail.html?id=') : rel.map(function (x) { return '<a class="job-card" href="detail.html?id=' + x.id + '">' + (x.title || x.name) + '</a>'; }).join('');
    return sec('同类' + label + '推荐', relHtml);
  }
  function matchLock(r, c, cfg) {
    return [
      { k: cfg.contactLabel, v: c.name },
      { k: '联系人', v: r.contact || c.contact.name },
      { k: '联系电话', v: r.phone || c.contact.phone },
      { k: '微信号', v: r.wechat || (c.short + '· 对接') },
      { k: cfg.addrLabel, v: r.address || r.location },
      { k: cfg.fileLabel, v: r.file || cfg.fileDefault }
    ];
  }
  /* ================= 材料采购/供应（material）：真实市场信息结构 + 就近打码 ================= */
  function matIsDemand(r) { return (r.type || r.dir) === 'demand'; }
  /* 核心参数 / 交易结算 两列键值表（行级就近打码） */
  function matKVTable(rows, locked) {
    return '<div class="spec-table">' + rows.map(function (x) {
      var v = x.lock ? Lock.full(x.v, locked) : cfgText(x.v);
      return '<div class="spt-row"><span class="spt-k">' + cfgText(x.k) + '</span><span class="spt-v">' + v + '</span></div>';
    }).join('') + '</div>';
  }
  /* 核心等级 chip 行（强度等级/牌号/防火等级等，免费） */
  function matGrade(g) {
    if (!g || !g.chips || !g.chips.length) return '';
    return '<div class="grade-chips"><span class="gc-label">' + cfgText(g.label) + '</span><div class="gc-list">' +
      g.chips.map(function (x) { return '<span class="tag tag-gold">' + cfgText(x) + '</span>'; }).join('') + '</div></div>';
  }
  /* 价格区间条：区间免费，精确成交价/计价依据付费 */
  function matPriceBar(p, locked) {
    if (!p) return '';
    var real = '<b>' + cfgText(p.exact) + '</b><span class="pb-basis">' + cfgText(p.basis) + '</span>';
    var exact = Lock.price(real, locked, '精确成交价 · 计价依据待解锁');
    return '<div class="price-bar">' +
      '<div class="pb-top"><span class="pb-range">' + cfgText(p.range) + '</span><span class="pb-free">市场区间 · 免费可见</span></div>' +
      '<div class="pb-track"><div class="pb-fill"></div><div class="pb-dot"></div></div>' +
      '<div class="pb-exact' + (locked ? ' is-locked' : '') + '">' + exact + '</div></div>';
  }
  /* 配送/供应能力卡（左半径示意 + 右键值，配送费用行可打码） */
  function matDelivery(d, locked) {
    if (!d) return '';
    var cost = d.costLock ? Lock.full(d.cost, locked) : cfgText(d.cost);
    function line(k, v) { return '<div class="ds-line"><span class="k">' + k + '</span><b>' + v + '</b></div>'; }
    return '<div class="delivery-scope">' +
      '<div class="ds-visual"><div class="ds-ring"></div><div class="ds-ring ds-ring--in"></div><div class="ds-core">' + icon('pin') + '</div></div>' +
      '<div class="ds-info">' +
        line('覆盖半径', cfgText(d.radius)) +
        line('供应能力', cfgText(d.capacity)) +
        line('交货时效', cfgText(d.eta)) +
        line('配送费用', cost) +
      '</div></div>';
  }
  /* 资质与检测文件：编号可打码，文件可预览、全文/下载加锁层 */
  function matDocs(docs, locked) {
    if (!docs || !docs.length) return '';
    return '<div class="mat-docs">' + docs.map(function (d) {
      var inner = '<div class="md-ic">' + icon('doc') + '</div>' +
        '<div class="md-body"><div class="md-name">' + cfgText(d.n) + '</div>' +
        '<div class="md-sub">' + (d.file ? '附件 · 可预览首页，全文需解锁' : (d.lock && locked ? '完整信息待解锁' : cfgText(d.v || '已核验'))) + '</div></div>' +
        (d.file ? '<div class="md-go">' + icon('doc') + '</div>' : '');
      if (d.file) return Lock.file('<div class="mat-doc is-file">' + inner + '</div>', locked, '解锁查看 / 下载文件');
      var sub = d.lock ? Lock.partial(d.v || '完整编号待解锁', locked, '编号待解锁') : cfgText(d.v);
      return '<div class="mat-doc"><div class="md-ic">' + icon('doc') + '</div><div class="md-body"><div class="md-name">' + cfgText(d.n) + '</div><div class="md-sub">' + sub + '</div></div></div>';
    }).join('') + '</div>';
  }
  /* 联系与对接卡：主体免费，电话/微信/门牌就近打码 + 卡内就近解锁胶囊 */
  function matContact(r, c, m, locked) {
    var demand = matIsDemand(r);
    var mc = m.contact || {};
    var role = demand ? '采购方' : '供应方';
    var avatar = (c.name || r.company || '企').charAt(0);
    function row(k, v) { return '<div class="cc-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    var phoneFull = mc.phone || r.phone || '';
    var wechatFull = mc.wechat || r.wechat || '';
    var addrFull = mc.addr || r.address || r.location || '';
    return '<div class="contact-card">' +
      '<div class="cc-head"><div class="cc-avatar">' + avatar + '</div>' +
        '<div class="cc-id"><div class="cc-name">' + cfgText(c.name || r.company) + '</div><div class="cc-sub">' + role + '主体 · 平台已核验</div></div>' +
        '<span class="cc-badge">' + icon('check') + '已认证</span></div>' +
      '<div class="cc-list">' +
        row('联系人', cfgText(mc.name || r.contact)) +
        row('联系电话', Lock.partial(phoneFull, locked)) +
        row('微信号', Lock.full(wechatFull, locked)) +
        row(demand ? '项目/交货地址' : '发货/仓库地址', Lock.partial(addrFull, locked, cfgText(r.location) + ' · 精确门牌付费可见')) +
      '</div>' +
      Lock.inline(locked, '解锁与对方沟通权限', '电话 · 微信 · 精确单价 · 资质文件', unlockCreditText(r)) + /* [FIX BM-012/BM-013] 价签改积分，文案改「沟通权限」 */
      '</div>';
  }
  function materialBody(r, c) {
    var m = r.mat || {};
    var locked = !UnlockStore.isUnlocked(r);
    var demand = matIsDemand(r);
    var h = '';
    if (r.detail || r.desc) h += sec(demand ? '采购说明' : '供应说明', '<div class="ds-text">' + (r.detail || r.desc) + '</div>');
    /* 等级 chips 已在 Hero 速览条展示，核心参数区直接从参数表开始，避免重复 */
    var specInner = (m.spec && m.spec.length) ? matKVTable(m.spec, locked) : (r.fields && r.fields.length ? dList(r.fields) : '');
    if (specInner) h += sec('核心参数', specInner);
    if (m.price) h += sec('价格与计价', matPriceBar(m.price, locked));
    if (m.trade && m.trade.length) h += sec('交易 · 结算 · 交付', matKVTable(m.trade, locked));
    if (m.delivery) h += sec(demand ? '交付与供应要求' : '供应与配送能力', matDelivery(m.delivery, locked));
    var qualInner = (m.quals && m.quals.length
      ? '<div class="qual-chips">' + m.quals.map(function (q) { return '<span class="tag tag-primary">' + cfgText(q) + '</span>'; }).join('') + '</div>'
      : '') + (m.docs && m.docs.length ? matDocs(m.docs, locked) : '');
    if (qualInner) h += sec('资质与合规', qualInner);
    if (m.warranty) h += sec('质量与售后承诺', '<div class="warranty-text">' + icon('shield') + '<span>' + cfgText(m.warranty) + '</span></div>');
    h += sec(demand ? '采购方联系方式' : '供应商联系方式', matContact(r, c, m, locked));
    if (m.flow && m.flow.length) h += sec('交易流程（' + m.flow.length + ' 步）', stepTimeline(m.flow));
    return h;
  }
  /* ================= 设备租赁（equipment）：真实市场信息结构 + 3 个新组件 + 就近打码 ================= */
  function equipIsDemand(r) { return (r.type || r.dir) === 'demand'; }
  /* ① 设备参数卡：核心技术参数 2 列网格，关键参数强调 */
  function equipSpecCard(specs) {
    if (!specs || !specs.length) return '';
    return '<div class="equip-spec-card"><div class="esc-grid">' + specs.map(function (x) {
      return '<div class="esc-item' + (x.strong ? ' is-strong' : '') + '"><div class="esc-k">' + cfgText(x.k) + '</div><div class="esc-v">' + cfgText(x.v) + '</div></div>';
    }).join('') + '</div></div>';
  }
  /* ② 费用明细表：区间免费，各费用项明细付费（原地展开），合计行强调 */
  function equipFee(fee, locked) {
    if (!fee) return '';
    var rows = fee.rows.map(function (x) {
      var v = x.lock ? Lock.price(x.v, locked, '费用明细待解锁') : cfgText(x.v);
      return '<div class="fb-row"><span class="fb-k">' + cfgText(x.k) + '</span><span class="fb-v">' + v + '</span></div>';
    }).join('');
    return '<div class="fee-breakdown">' +
      '<div class="fb-range"><span class="fb-range-v">' + cfgText(fee.range) + '</span><span class="fb-free">费用区间 · 免费可见</span></div>' +
      '<div class="fb-rows">' + rows + '</div>' +
      (fee.total ? '<div class="fb-total"><span>合计参考</span><b>' + cfgText(fee.total) + '</b></div>' : '') +
      '</div>';
  }
  /* 风险与服务承诺（免费） */
  function equipPromise(list) {
    if (!list || !list.length) return '';
    return '<div class="equip-promise">' + list.map(function (x) {
      return '<div class="ep-row"><div class="ep-k">' + icon('shield') + '<span>' + cfgText(x.k) + '</span></div><div class="ep-v">' + cfgText(x.v) + '</div></div>';
    }).join('') + '</div>';
  }
  /* ③ 设备履历时间线：已完成实心、计划空心，侧重设备生命周期 */
  function equipHistory(history) {
    if (!history || !history.length) return '';
    return '<div class="timeline-equip">' + history.map(function (x, i) {
      var last = i === history.length - 1;
      return '<div class="te-item te-' + (x.state || 'done') + '">' +
        '<div class="te-rail"><span class="te-dot"></span>' + (last ? '' : '<span class="te-line"></span>') + '</div>' +
        '<div class="te-body"><div class="te-head"><span class="te-date">' + cfgText(x.date) + '</span><span class="te-title">' + cfgText(x.title) + '</span></div>' +
        (x.desc ? '<div class="te-desc">' + cfgText(x.desc) + '</div>' : '') + '</div></div>';
    }).join('') + '</div>';
  }
  /* 出租方/承租方联系卡：主体免费，电话/微信/精确场地就近打码 */
  function equipContact(r, c, e, locked) {
    var demand = equipIsDemand(r);
    var ec = (e && e.contact) || {};
    var role = demand ? '承租方' : '出租方';
    var avatar = (c.name || r.company || '企').charAt(0);
    function row(k, v) { return '<div class="cc-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    var phoneFull = ec.phone || r.phone || '';
    var wechatFull = ec.wechat || r.wechat || '';
    var addrFull = ec.addr || r.address || r.location || '';
    return '<div class="contact-card">' +
      '<div class="cc-head"><div class="cc-avatar">' + avatar + '</div>' +
        '<div class="cc-id"><div class="cc-name">' + cfgText(c.name || r.company) + '</div><div class="cc-sub">' + role + '主体 · 平台已核验</div></div>' +
        '<span class="cc-badge">' + icon('check') + '已认证</span></div>' +
      '<div class="cc-list">' +
        row('联系人', cfgText(ec.name || r.contact)) +
        row('联系电话', Lock.partial(phoneFull, locked)) +
        row('微信号', Lock.full(wechatFull, locked)) +
        row(demand ? '项目/工地地址' : '设备/仓库地址', Lock.partial(addrFull, locked, cfgText(r.location) + ' · 精确场地付费可见')) +
      '</div>' +
      Lock.inline(locked, '解锁与对方沟通权限', '电话 · 微信 · 费用明细 · 资质文件', unlockCreditText(r)) + /* [FIX BM-012/BM-013] 价签改积分，文案改「沟通权限」 */
      '</div>';
  }
  function equipHero(r, c) {
    var d = dirTag(r.type || r.dir);
    var base = dHero({ tag: d.txt + ' · ' + r.sub, verifiedHint: (r.verified ? '已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: matchMeta(r) });
    var o = r.equip && r.equip.overview;
    var chips = o ? [o.brand, o.equipType, o.yearBuilt, o.workHours, o.condition].filter(function (x) { return !!x; }) : [];
    var quick = chips.length ? '<div class="hero-grade"><span class="hg-label">设备速览</span><div class="hg-list">' +
      chips.map(function (x) { return '<span class="tag tag-gold">' + cfgText(x) + '</span>'; }).join('') +
      '</div></div>' : '';
    return base + quick;
  }
  function equipmentBody(r, c) {
    var e = r.equip || {};
    var locked = !UnlockStore.isUnlocked(r);
    var demand = equipIsDemand(r);
    var h = '';
    if (r.detail || r.desc) h += sec(demand ? '求租说明' : '设备说明', '<div class="ds-text">' + (r.detail || r.desc) + '</div>');
    if (e.specs && e.specs.length) h += sec('核心技术参数', equipSpecCard(e.specs));
    if (e.fee) h += sec('费用与计价', equipFee(e.fee, locked));
    if (e.trade && e.trade.length) h += sec('交易 · 结算 · 租期', matKVTable(e.trade, locked));
    var qualInner = (e.quals && e.quals.length
      ? '<div class="qual-chips">' + e.quals.map(function (q) { return '<span class="tag tag-primary">' + cfgText(q) + '</span>'; }).join('') + '</div>'
      : '') + (e.docs && e.docs.length ? matDocs(e.docs, locked) : '');
    if (qualInner) h += sec('资质与合规', qualInner);
    if (e.promise && e.promise.length) h += sec('风险与服务承诺', equipPromise(e.promise));
    if (e.history && e.history.length) h += sec('设备履历', equipHistory(e.history));
    h += sec(demand ? '承租方联系方式' : '出租方联系方式', equipContact(r, c, e, locked));
    if (e.flow && e.flow.length) h += sec('租赁流程（' + e.flow.length + ' 步）', stepTimeline(e.flow));
    return h;
  }
  /* ================= 劳务用工（labor）：真实市场信息结构 + 4 个新组件 + 就近打码 ================= */
  function laborIsDemand(r) { return (r.type || r.dir) === 'demand'; }
  /* ① 工种人数矩阵：每工种一卡，含总人数 + 高/中/初级技能分布条 */
  function laborWorkforce(wf) {
    if (!wf || !wf.length) return '';
    return '<div class="workforce-grid">' + wf.map(function (w) {
      var total = (w.lv || []).reduce(function (a, x) { return a + x.v; }, 0);
      var levels = (w.lv || []).map(function (x) {
        var pct = total ? Math.round(x.v / total * 100) : 0;
        return '<div class="wf-lv lv-' + x.c + '"><span class="wfl-name">' + cfgText(x.n) + '</span>' +
          '<div class="wfl-track"><div class="wfl-fill" style="width:' + pct + '%"></div></div><span class="wfl-n">' + x.v + '</span></div>';
      }).join('');
      return '<div class="wf-card"><div class="wf-head"><span class="wf-name">' + cfgText(w.work) + '</span>' +
        '<span class="wf-count"><b>' + cfgText(w.count) + '</b><i>人</i></span></div><div class="wf-levels">' + levels + '</div></div>';
    }).join('') + '</div>';
  }
  /* ② 工资结构卡：计价方式 + 区间免费 + 精确工资付费 + 结算/工资专户 */
  function laborWage(wage, locked) {
    if (!wage) return '';
    var types = (wage.types || []).map(function (t) { return '<span class="tag tag-gold">' + cfgText(t) + '</span>'; }).join('');
    var rows = (wage.rows || []).map(function (x) {
      return '<div class="ws-row"><span class="ws-k">' + cfgText(x.k) + '</span><span class="ws-v">' + Lock.price(x.v, locked, '精确工资待解锁') + '</span></div>';
    }).join('');
    return '<div class="wage-structure">' +
      (types ? '<div class="ws-types">' + types + '</div>' : '') +
      '<div class="ws-range"><b>' + cfgText(wage.range) + '</b><span>工资区间 · 免费可见</span></div>' +
      '<div class="ws-rows">' + rows + '</div>' +
      '<div class="ws-foot"><span class="ws-settle">结算：' + cfgText(wage.settle) + '</span>' +
      '<span class="ws-account">' + icon('check') + cfgText(wage.account) + '</span></div></div>';
  }
  /* ③ 合规徽章行：实名制/工伤/教育/工资专户/资质，完成绿勾、缺失灰问号 */
  function laborCompliance(comp) {
    if (!comp || !comp.length) return '';
    return '<div class="compliance-badge-row">' + comp.map(function (x) {
      return '<div class="cb-badge ' + (x.ok ? 'is-ok' : 'is-no') + '"><span class="cb-ic">' + (x.ok ? icon('check') : '?') + '</span>' +
        '<span class="cb-text"><b>' + cfgText(x.label) + '</b><small>' + cfgText(x.desc) + '</small></span></div>';
    }).join('') + '</div>';
  }
  /* ④ 班组长 / 用工对接人履历卡：头像 + 姓名(供应锁/需求公开) + 擅长 + 履历 + 历史项目时间线 */
  function laborForeman(f, locked, demand) {
    if (!f) return '';
    var name = f.lockName ? Lock.partial(f.fullName, locked, f.freeName) : cfgText(f.freeName);
    var goodAt = (f.goodAt || []).map(function (g) { return '<span class="tag tag-primary">' + cfgText(g) + '</span>'; }).join('');
    var exp = '<div class="fp-exp">' + cfgText(f.expFree);
    if (f.expFull) exp += ' ' + Lock.full(f.expFull, demand ? false : locked);
    exp += '</div>';
    var projects = (f.projects && f.projects.length)
      ? '<div class="fp-projects"><div class="fpp-label">' + (demand ? '用工方同类业绩' : '带班历史项目') + '</div><div class="timeline-equip">' + f.projects.map(function (x, i) {
        var last = i === f.projects.length - 1;
        var desc = x.desc ? (x.lockDesc ? Lock.full(x.desc, locked) : cfgText(x.desc)) : '';
        return '<div class="te-item te-' + (x.state || 'done') + '"><div class="te-rail"><span class="te-dot"></span>' + (last ? '' : '<span class="te-line"></span>') + '</div>' +
          '<div class="te-body"><div class="te-head"><span class="te-date">' + cfgText(x.date) + '</span><span class="te-title">' + cfgText(x.title) + '</span></div>' +
          (desc ? '<div class="te-desc">' + desc + '</div>' : '') + '</div></div>';
      }).join('') + '</div></div>' : '';
    var stab = f.stability ? '<div class="fp-stability"><span class="fps-k">人员稳定性</span><span class="fps-v">' + Lock.full(f.stability, demand ? false : locked) + '</span></div>' : '';
    return '<div class="foreman-profile">' +
      '<div class="fp-head"><div class="fp-avatar">' + cfgText(f.surname) + '</div><div class="fp-id">' +
        '<div class="fp-name">' + name + '</div><div class="fp-years">' + cfgText(f.years) + '</div>' +
        (goodAt ? '<div class="fp-tags">' + goodAt + '</div>' : '') + '</div></div>' +
      exp + projects + stab + '</div>';
  }
  /* 班组 / 用工方联系卡：需求侧联系信息从企业档案兜底；供应侧未解锁时联系人与班组长一致只显示「X 师傅」 */
  function laborContact(r, c, l, locked, demand) {
    var lc = (l && l.contact) || {};
    var cc = c.contact || {};
    var role = demand ? '用工方' : '班组 / 劳务公司';
    var avatar = (c.name || r.company || '劳').charAt(0);
    function row(k, v) { return '<div class="cc-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    var rawName = lc.name || cc.name || r.contact || '';
    /* 供应侧联系人即班组长：未解锁显示「X 师傅」占位，解锁原地展开全名（须用 Lock.partial 双份以随 is-unlocked 切换） */
    var name = (!demand && l.foreman && l.foreman.freeName)
      ? Lock.partial(rawName, locked, l.foreman.freeName + ' · 劳务负责人')
      : cfgText(rawName);
    var phone = lc.phone || cc.phone || r.phone || '';
    var wechat = lc.wechat || r.wechat || '';
    var addr = lc.addr || r.address || r.location || '';
    return '<div class="contact-card">' +
      '<div class="cc-head"><div class="cc-avatar">' + avatar + '</div><div class="cc-id">' +
        '<div class="cc-name">' + cfgText(c.name || r.company) + '</div><div class="cc-sub">' + role + ' · 平台已核验</div></div>' +
        '<span class="cc-badge">' + icon('check') + '已认证</span></div>' +
      '<div class="cc-list">' +
        row('联系人', cfgText(name)) +
        row('联系电话', Lock.partial(phone, locked)) +
        (wechat ? row('微信号', Lock.full(wechat, locked)) : '') +
        row(demand ? '项目部地址' : '班组驻地', Lock.partial(addr, locked, cfgText(r.location) + ' · 精确地址付费可见')) +
      '</div>' +
      Lock.inline(locked, '解锁与对方沟通权限', '电话 · 微信 · 精确工资 · 证书业绩', unlockCreditText(r)) + /* [FIX BM-012/BM-013] 价签改积分，文案改「沟通权限」 */
      '</div>';
  }
  function laborHero(r, c) {
    var d = dirTag(r.type || r.dir);
    var base = dHero({ tag: d.txt + ' · ' + r.sub, verifiedHint: (r.verified ? '已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: matchMeta(r) });
    var o = r.labor && r.labor.overview;
    var chips = o ? [o.total, o.available, o.area].filter(function (x) { return !!x; }) : [];
    var quick = chips.length ? '<div class="hero-grade"><span class="hg-label">' + (laborIsDemand(r) ? '用工速览' : '班组速览') + '</span><div class="hg-list">' +
      chips.map(function (x) { return '<span class="tag tag-gold">' + cfgText(x) + '</span>'; }).join('') + '</div></div>' : '';
    return base + quick;
  }
  function laborBody(r, c) {
    var l = r.labor || {};
    var locked = !UnlockStore.isUnlocked(r);
    var demand = laborIsDemand(r);
    var h = '';
    if (r.detail || r.desc) h += sec(demand ? '用工需求说明' : '班组介绍', '<div class="ds-text">' + (r.detail || r.desc) + '</div>');
    if (l.workforce && l.workforce.length) h += sec(demand ? '工种需求明细' : '班组工种与人数', laborWorkforce(l.workforce));
    if (l.wage) h += sec('工资与计价', laborWage(l.wage, locked));
    if (l.trade && l.trade.length) h += sec('合同 · 结算 · 考勤', matKVTable(l.trade, locked));
    var compInner = (l.compliance && l.compliance.length ? laborCompliance(l.compliance) : '') +
      (l.quals && l.quals.length ? '<div class="qual-chips">' + l.quals.map(function (q) { return '<span class="tag tag-primary">' + cfgText(q) + '</span>'; }).join('') + '</div>' : '') +
      (l.docs && l.docs.length ? matDocs(l.docs, locked) : '');
    if (compInner) h += sec('合规与资质保障', compInner);
    if (l.foreman) h += sec(demand ? '项目用工对接人' : '班组长履历', laborForeman(l.foreman, locked, demand));
    if (l.promise && l.promise.length) h += sec(demand ? '用工方承诺' : '质量 · 工期 · 安全承诺', equipPromise(l.promise));
    h += sec(demand ? '用工方联系方式' : '班组联系方式', laborContact(r, c, l, locked, demand));
    if (l.flow && l.flow.length) h += sec((demand ? '用工流程（' : '劳务流程（') + l.flow.length + ' 步）', stepTimeline(l.flow));
    return h;
  }
  /* ---- 资质招商：深化组件（资质包卡 / 费用结构卡 / 人员配置 / 留资联系卡） ---- */
  function franchLevelCls(lv) {
    if (/特级|一级|甲级/.test(lv || '')) return 'lv1';
    if (/二级|乙级/.test(lv || '')) return 'lv2';
    return 'lv3';
  }
  function franchParseLv(q) { if (typeof q === 'string') { var mm = q.match(/特级|一级|二级|三级|甲级|乙级|丙级/); return mm ? mm[0] : ''; } return ''; }
  function franchMonthsLeft(expiry) {
    if (!expiry || expiry.indexOf('长期') >= 0) return null;
    var end = new Date(String(expiry).replace(/\./g, '-'));
    if (isNaN(end.getTime())) return null;
    return Math.round((end.getTime() - Date.now()) / 2592e6);
  }
  /* ① 资质包卡：等级徽章 + 有效期进度（剩余≤6个月警示，已到期标红） */
  function franchQualPack(fc, fallback) {
    var list = (fc && fc.qualPack) || fallback || [];
    if (!list.length) return '';
    var rows = list.map(function (q) {
      var name = (typeof q === 'string') ? q.replace(/特级|一级|二级|三级|甲级|乙级|丙级$/, '') : q.name;
      var lv = (typeof q === 'string') ? franchParseLv(q) : q.level;
      var expiry = (typeof q === 'string') ? '' : q.expiry;
      var m = franchMonthsLeft(expiry);
      var pct = 100, remainTxt = '长期有效', flag = '', fillCls = 'bar-ok';
      if (m !== null) {
        if (m < 0) { pct = 4; remainTxt = '已到期'; flag = '<span class="qpc-flag is-exp">已到期</span>'; fillCls = 'bar-exp'; }
        else {
          pct = Math.max(8, Math.min(100, Math.round(m / 60 * 100)));
          remainTxt = '剩余约 ' + (m >= 12 ? Math.floor(m / 12) + ' 年' + (m % 12 ? (m % 12) + ' 个月' : '') : m + ' 个月');
          if (m <= 6) { flag = '<span class="qpc-flag is-warn">即将到期</span>'; fillCls = 'bar-warn'; }
        }
      }
      return '<div class="qpc-item">' +
        '<div class="qpc-top"><span class="qpc-name">' + cfgText(name) + '</span>' + (lv ? '<span class="qpc-lv ' + franchLevelCls(lv) + '">' + lv + '</span>' : '') + '</div>' +
        (expiry ? '<div class="qpc-exp"><span class="qpc-date">有效期至 ' + expiry + '</span>' + flag + '</div>' : '<div class="qpc-exp"><span class="qpc-date">长期有效</span></div>') +
        '<div class="qpc-track"><div class="qpc-fill ' + fillCls + '" style="width:' + pct + '%"></div></div>' +
        '<div class="qpc-remain">' + remainTxt + '</div>' +
      '</div>';
    }).join('');
    return '<div class="qual-pack-card">' + rows + '</div>';
  }
  /* ② 费用结构卡：加盟费 / 管理费 / 保证金 三段式（招商透明展示，全部免费可见） */
  function franchFee(fc) {
    var f = fc && fc.fee;
    if (!f) return '';
    function col(label, main, sub) {
      return '<div class="fsc-col"><div class="fsc-label">' + label + '</div><div class="fsc-main">' + cfgText(main || '—') + '</div>' + (sub ? '<div class="fsc-sub">' + cfgText(sub) + '</div>' : '') + '</div>';
    }
    var html = '<div class="fee-structure-card">' +
      col('加盟费 / 开办费', f.join, f.cycle || '') +
      col('管理费 / 分成', f.mgmt, f.bill || '') +
      col('保证金 / 履约金', f.deposit, '') +
      '</div>';
    if (f.depositTerm) html += '<div class="fsc-term"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>退还约定：' + cfgText(f.depositTerm) + '</span></div>';
    return html;
  }
  /* ③ 注册人员配置数量网格（数量免费可见，具体人员名册留资后由顾问提供） */
  function franchStaff(fc) {
    var st = fc && fc.staff;
    if (!st || !st.length) return '';
    return '<div class="franch-staff">' + st.map(function (s) {
      return '<div class="fs-cell"><div class="fs-n">' + cfgText(s.v) + '</div><div class="fs-k">' + cfgText(s.k) + '</div></div>';
    }).join('') + '<div class="fs-note">注册人员满足资质维护与投标需要，具体人员名册与证书编号留资后由招商顾问提供</div></div>';
  }
  /* ④ 招商联系卡：经营信息全免费，仅联系方式在「免费提交加盟意向」后原地开放 */
  function franchContact(r, c, locked) {
    var fc = r.fc || {};
    var lc = fc.contact || {};
    var cc = c.contact || {};
    var avatar = (c.name || '企').charAt(0);
    var rawName = lc.name || cc.name || '';
    var title = lc.title || cc.title || '招商顾问';
    var phone = lc.phone || cc.phone || '';
    var wx = lc.wechat || '';
    var addr = lc.addr || r.location || '';
    var freeName = rawName.charAt(0) + '顾问';
    function row(k, v) { return '<div class="cc-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return '<div class="contact-card">' +
      '<div class="cc-head"><div class="cc-avatar">' + avatar + '</div><div class="cc-id">' +
        '<div class="cc-name">' + cfgText(c.name) + '</div><div class="cc-sub">招商方 · 平台已核验</div></div>' +
        '<span class="cc-badge">' + icon('check') + '已认证</span></div>' +
      '<div class="cc-list">' +
        row('招商顾问', Lock.partial(rawName + ' · ' + title, locked, freeName + ' · ' + title)) +
        row('联系电话', Lock.partial(phone, locked)) +
        (wx ? row('微信号', Lock.full(wx, locked)) : '') +
        row('总部 / 对接地址', Lock.partial(addr, locked, cfgText(r.location) + ' · 详细地址留资可见')) +
      '</div>' +
      Lock.inline(locked, '免费提交加盟意向后查看联系方式', '招商顾问 1 对 1 · 电话 / 微信 / 详细地址', '免费咨询') +
      '</div>';
  }
  /* ---- 招商加盟 ---- */
  function qualFranchiseBody(r, c) {
    var locked = !UnlockStore.isUnlocked(r);
    var fc = r.fc || {};
    var h = '';
    /* 企业基本信息：关键数据卡片 + 详细信息 */
    var keyStats = [
      { label: '成立年限', value: r.years ? r.years + '年' : '—', sub: r.founded || '' },
      { label: '注册资本', value: r.capital || '—', sub: '实缴资本' },
      { label: '年中标项目', value: r.annualProjects ? r.annualProjects + '个' : '—', sub: '近3年平均' },
      { label: '已加盟分公司', value: r.branchCount ? r.branchCount + '家' : '—', sub: '全国分布' }
    ];
    var basicHtml = '<div class="fbi-grid">' +
      keyStats.map(function (s) {
        return '<div class="fbi-card">' +
          '<div class="fbi-l"><div class="fbi-label">' + s.label + '</div>' + (s.sub ? '<div class="fbi-sub">' + s.sub + '</div>' : '') + '</div>' +
          '<div class="fbi-value">' + s.value + '</div>' +
          '</div>';
      }).join('') + '</div>';
    var detailInfo = [
      { k: '企业名称', v: r.name || '' },
      { k: '注册地区', v: r.registeredArea || '' }
    ];
    basicHtml += dList(detailInfo);
    h += sec('企业基本信息', basicHtml);
    var qualList = (fc && fc.qualPack) || r.qualPack || [];
    if (qualList.length) {
      var qualRows = [];
      if (fc.safety) qualRows.push({ k: '安全生产许可 / 管理体系', v: cfgText(fc.safety.no) + ' · 有效期至 ' + cfgText(fc.safety.expiry) });
      if (fc.safety && fc.safety.note) qualRows.push({ k: '备注说明', v: cfgText(fc.safety.note) });
      h += sec('资质与证照', tradeQualPack(qualList) + (qualRows.length ? '<div class="qual-extra-table">' + dList(qualRows) + '</div>' : ''));
    }
    if (r.qual) h += sec('核验状态', '<div class="cert-verify-bar"><div class="cvb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="cvb-body"><div class="cvb-title">资质与证照已核验</div><div class="cvb-desc">' + r.qual + '</div></div><span class="cvb-badge">✓ 平台核验</span></div>');
    /* 资质证照图（带水印） */
    if (r.certImages && r.certImages.length) {
      var certHtml = '<div class="cert-gallery">';
      r.certImages.forEach(function (c) {
        var cname = c.name.replace(/'/g, "\\'");
        certHtml += '<div class="cert-item" onclick="DETAIL.viewCert(\'' + cname + '\',\'' + c.no + '\',\'' + c.date + '\',\'' + c.expire + '\')">';
        certHtml += '<div class="ci-expire">有效至 ' + c.expire + '</div>';
        certHtml += '<div class="ci-img"><div class="ci-seal">资质<br>证书</div><div class="ci-title-sm">' + c.name + '</div></div>';
        certHtml += '<div class="ci-info"><div class="ci-name">' + c.name + '</div><div class="ci-no">编号：' + c.no + '</div></div>';
        certHtml += '</div>';
      });
      certHtml += '</div>';
      h += sec('资质证照', certHtml);
    }
    /* 合作模式与核心条件 */
    var coreRows = [];
    if (fc.mode || r.mode) coreRows.push({ k: '合作模式', v: fc.mode || r.mode });
    if (fc.term || r.contractTerm) coreRows.push({ k: '合同期限', v: fc.term || r.contractTerm });
    if (fc.protect) coreRows.push({ k: '区域保护', v: fc.protect });
    if (fc.account) coreRows.push({ k: '独立银行账户', v: fc.account });
    if (fc.share) coreRows.push({ k: '业绩共享', v: fc.share });
    if (coreRows.length) h += sec('合作模式与核心条件', dList(coreRows));
    /* 费用结构：加盟费 / 管理费 / 保证金 三段式（招商透明公开） */
    var feeBlock = franchFee(fc);
    if (feeBlock) h += sec('费用结构（透明公开）', feeBlock);
    /* 注册人员配置数量 */
    var staffBlock = franchStaff(fc);
    if (staffBlock) h += sec('注册人员配置', staffBlock);
    if (r.benefits && r.benefits.length) h += sec('扶持权益', benefitGrid(r.benefits));
    if (r.regions && r.regions.length) {
      var rh = '<div class="section"><div class="section-title"><div class="st-left">区域名额状态</div>';
      if (r.nationalRegions && r.nationalRegions.length) {
        rh += '<div class="region-view-all" onclick="DETAIL.openRegionMap()">查看全部<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:12px;height:12px;"><path d="M9 18l6-6-6-6"/></svg></div>';
      }
      rh += '</div>';
      rh += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      r.regions.forEach(function (rg) {
        var color, label;
        if (rg.status === 'full') { color = 'var(--text-3)'; label = '已满'; }
        else if (rg.status === 'limited') { color = 'var(--accent)'; label = '仅剩' + (rg.seats || 1) + '席'; }
        else { color = 'var(--success)'; label = '空缺'; }
        rh += '<div style="padding:10px 12px;border-radius:8px;background:var(--bg-card-2);display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:12.5px;font-weight:600;color:var(--text-1);">' + rg.city + '</span>' +
          '<span style="font-size:11px;font-weight:600;color:' + color + ';">' + label + '</span></div>';
      });
      rh += '</div></div>';
      h += rh;
    }
    if (r.branches && r.branches.length) {
      h += sec('已有分公司案例',
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
        r.branches.map(function (b) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--line);">' +
            '<div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--primary),var(--primary-dim));display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex:none;box-shadow:0 2px 6px -1px var(--primary-dim);">' + b.area.charAt(0) + '</div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:12.5px;font-weight:600;color:var(--text-1);">' + b.area + '</div>' +
            '<div style="font-size:10px;color:var(--text-3);margin-top:1px;">' + b.year + '年加盟 · 运营中</div>' +
            '</div>' +
            '<div style="text-align:right;flex:none;">' +
            '<div style="font-size:15px;font-weight:700;color:var(--primary-dim);font-family:var(--font-num);line-height:1.1;">' + b.projects + '</div>' +
            '<div style="font-size:9px;color:var(--text-3);margin-top:1px;">年中标/个</div>' +
            '</div></div>';
        }).join('') + '</div>');
    }
    if (r.descMd || r.desc) {
      var introHtml = r.descMd ? '<div class="md-content">' + renderMarkdown(r.descMd) + '</div>' : '<div class="ds-text">' + r.desc + '</div>';
      h += sec('企业介绍', introHtml);
    }
    /* 企业宣传文件（PDF 上传/浏览/下载）— 内侧环形进度 */
    if (r.pdfFiles && r.pdfFiles.length) {
      var pdfHtml = '<div class="fd-list">';
      r.pdfFiles.forEach(function (p, idx) {
        var fid = 'pdf_' + (r.id || 'rec') + '_' + idx;
        var fsize = p.sizeKb || (2048 + idx * 1024);
        pdfHtml += window.FileDownload.renderInnerRing({
          id: fid, name: p.name, size: fsize,
          sub: (p.pages || '12') + '页 · ' + (p.uploadTime || '2026-09')
        });
      });
      pdfHtml += '</div>';
      /* 上传入口已移除（信息浏览页不提供上传） */
      h += sec('企业宣传文件', pdfHtml);
    }
    /* 招商联系方式（免费留资后开放）+ 加盟流程 */
    h += sec('招商联系方式', franchContact(r, c, locked));
    if (fc.flow && fc.flow.length) h += sec('加盟流程（' + fc.flow.length + ' 步）', stepTimeline(fc.flow));
    return h;
  }
  function franchiseLock(r, c) {
    if (r.type === 'qualification') {
      return [
        { k: '企业名称', v: r.name || c.name },
        { k: '招商负责人', v: c.contact.name + ' · ' + c.contact.title },
        { k: '联系电话', v: c.contact.phone },
        { k: '微信号', v: c.short + '· 加盟咨询' },
        { k: '开放区域', v: r.region || r.location },
        { k: '加盟模式', v: r.mode || '' }
      ];
    }
    return [
      { k: '品牌方', v: c.name },
      { k: '招商经理', v: c.contact.name + ' · ' + c.contact.title },
      { k: '联系电话', v: c.contact.phone },
      { k: '微信号', v: c.short + '· 加盟咨询' },
      { k: '开放区域', v: r.location },
      { k: '加盟政策', v: '品牌授权 + 区域保护' }
    ];
  }
  /* ================= 中介服务（agency）：15 字段 + 4 组件 + 全免费咨询转化 ================= */
  /* ① 报价明细卡 */
  function agencyQuoteCard(q) {
    if (!q) return '';
    var items = (q.items || []).map(function (x) {
      return '<div class="aq-row"><div class="aq-k">' + cfgText(x.k) + (x.note ? '<span class="aq-note">' + cfgText(x.note) + '</span>' : '') + '</div>' +
        '<div class="aq-v">' + cfgText(x.v) + '</div></div>';
    }).join('');
    var stages = (q.payStages || []).map(function (x) {
      return '<div class="aq-stage"><span class="aq-stage-p">' + cfgText(x.pct) + '</span>' +
        '<div class="aq-stage-b"><b>' + cfgText(x.stage) + '</b><span>' + cfgText(x.when) + '</span></div></div>';
    }).join('');
    function col(title, arr, cls) {
      return '<div class="aq-col"><div class="aq-col-t ' + cls + '">' + title + '</div>' +
        (arr || []).map(function (x) { return '<div class="aq-col-i">' + (cls === 'is-in' ? icon('check') : icon('x')) + '<span>' + cfgText(x) + '</span></div>'; }).join('') + '</div>';
    }
    return '<div class="ag-quote">' +
      '<div class="aq-head"><div class="aq-total">' + cfgText(q.total) + '</div>' +
        '<div class="aq-range">' + cfgText(q.range) + '</div></div>' +
      (items ? '<div class="aq-items">' + items + '</div>' : '') +
      (q.govFee ? '<div class="aq-gov">' + icon('info') + '<span>' + cfgText(q.govFee) + '</span></div>' : '') +
      (stages ? '<div class="aq-stages-t">付款节点</div><div class="aq-stages">' + stages + '</div>' : '') +
      '<div class="aq-inc">' + col('费用包含', q.include, 'is-in') + col('费用不含', q.exclude, 'is-ex') + '</div>' +
    '</div>';
  }
  /* ② 成功案例卡 */
  function agencyCaseCard(cases) {
    if (!cases || !cases.length) return '';
    return '<div class="ag-cases">' + cases.map(function (x) {
      return '<div class="ag-case">' +
        '<div class="ac-head"><span class="ac-company">' + icon('briefcase') + cfgText(x.caseCompany) + '</span>' +
          '<span class="ac-level">' + cfgText(x.caseLevel) + '</span></div>' +
        '<div class="ac-grid">' +
          '<div class="ac-gi"><span>资质事项</span><b>' + cfgText(x.caseQual) + '</b></div>' +
          '<div class="ac-gi"><span>办理周期</span><b>' + cfgText(x.caseCycle) + '</b></div>' +
          '<div class="ac-gi"><span>办结时间</span><b>' + cfgText(x.caseDate) + '</b></div>' +
        '</div>' +
        '<div class="ac-result">' + icon('check') + cfgText(x.caseResult) + '</div>' +
        (x.verifyUrl ? '<div class="ac-verify">' + icon('shield') + '可核验：' + cfgText(x.verifyUrl) + '</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }
  /* ③ 所需材料清单 */
  function agencyMaterials(mats) {
    if (!mats || !mats.length) return '';
    return '<div class="ag-materials">' + mats.map(function (x) {
      var must = cfgText(x.required) === '必须';
      return '<div class="amt-row">' +
        '<div class="amt-name">' + icon('doc') + '<span>' + cfgText(x.name) + '</span>' +
          '<span class="amt-req ' + (must ? 'is-must' : 'is-opt') + '">' + cfgText(x.required) + '</span></div>' +
        '<div class="amt-meta"><span class="amt-who">' + cfgText(x.who) + '</span>' +
          (x.note ? '<span class="amt-note">' + cfgText(x.note) + '</span>' : '') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }
  /* ④ 退款承诺徽章（成功率/评分/退款/超期） */
  function agencyRefundBadge(r) {
    var stats = '';
    if (r.successRate != null) stats += '<div class="arf-stat"><b>' + r.successRate + '%</b><span>办理成功率</span></div>';
    if (r.rating != null) stats += '<div class="arf-stat"><b>' + Number(r.rating).toFixed(1) + '</b><span>用户评分</span></div>';
    return '<div class="ag-refund">' +
      '<div class="arf-top">' + stats +
        '<div class="arf-badge">' + icon('shield') + '不过退款</div></div>' +
      (r.refundPolicy ? '<div class="arf-line"><span class="arf-k">退款政策</span><span class="arf-v">' + cfgText(r.refundPolicy) + '</span></div>' : '') +
      (r.overdueClause ? '<div class="arf-line"><span class="arf-k">超期条款</span><span class="arf-v">' + cfgText(r.overdueClause) + '</span></div>' : '') +
    '</div>';
  }
  /* 服务流程（含周期 + 客户配合动作） */
  function agencyProcess(steps) {
    if (!steps || !steps.length) return '';
    return '<div class="ag-process">' + steps.map(function (p, i) {
      var last = i === steps.length - 1;
      return '<div class="ap-item"><div class="ap-rail"><div class="ap-num">' + p.step + '</div>' + (last ? '' : '<div class="ap-line"></div>') + '</div>' +
        '<div class="ap-body"><div class="ap-head"><b>' + cfgText(p.title) + '</b>' + (p.duration ? '<span class="ap-dur">' + cfgText(p.duration) + '</span>' : '') + '</div>' +
          (p.desc ? '<div class="ap-desc">' + cfgText(p.desc) + '</div>' : '') +
          (p.customerAction ? '<div class="ap-action">' + icon('user') + '<span>您需配合：' + cfgText(p.customerAction) + '</span></div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }
  /* 机构联系卡：信息全免费，仅联系方式在「免费提交咨询需求」后原地开放 */
  function agencyContact(r, c, locked) {
    var ac = r.contact || {};
    var avatar = (c.name || '机').charAt(0);
    function row(k, v) { return '<div class="cc-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return '<div class="contact-card">' +
      '<div class="cc-head"><div class="cc-avatar">' + avatar + '</div>' +
        '<div class="cc-id"><div class="cc-name">' + cfgText(c.name) + '</div><div class="cc-sub">服务机构 · 平台已认证</div></div>' +
        '<span class="cc-badge">' + icon('check') + '已认证</span></div>' +
      '<div class="cc-list">' +
        row('服务顾问', cfgText(ac.name || '专属顾问')) +
        row('咨询电话', locked ? (Lock.partialPhone(ac.phone || '') + ' <span style="font-size:10px;color:var(--text-4)">免费咨询后可见完整号码</span>') : ac.phone) +
        row('微信号', locked ? '<span style="color:var(--text-3)">扫码或免费咨询后获取</span>' : ac.wechat) +
        row('机构地址', locked ? (cfgText(r.location) + ' · <span style="font-size:10px;color:var(--text-4)">免费咨询后可见详细地址</span>') : (ac.addr || r.location)) +
      '</div>' +
      '<div class="pw-inline" data-pw-unlock style="background:var(--success-soft);border:1px solid rgba(43,107,79,.2);"><div class="pw-inline-l"><div class="pw-inline-ic" style="background:rgba(43,107,79,.12);color:var(--success);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><div class="pw-inline-t" style="color:var(--success);">免费提交咨询需求后查看联系方式</div><div class="pw-inline-s">专属顾问 1 对 1 · 电话 / 微信 · 全程不收取信息费</div></div></div><div class="pw-inline-price" style="color:var(--success);">免费咨询</div></div>' +
      '</div>';
  }
  function agencyBody(r, c) {
    var locked = !UnlockStore.isUnlocked(r);
    var h = '';
    if (r.desc) h += sec('服务介绍', '<div class="ds-text">' + r.desc + '</div>' + agencyRefundBadge(r));
    h += sec('服务类型与办理目标', dList([
      { k: '服务类型', v: r.serveType },
      { k: '目标资质等级', v: r.targetQualLevel },
      { k: '目标资质专业', v: r.targetQualMajor }
    ]));
    if (r.quote) h += sec('报价明细（透明公开）', agencyQuoteCard(r.quote) + dList([
      { k: '报价包含', v: r.priceInclude },
      { k: '官方费用说明', v: r.govFeeNote },
      { k: '发票类型', v: r.invoiceType },
      { k: '付款方式', v: r.paymentTerms }
    ]));
    if (r.serveProcess && r.serveProcess.length) h += sec('办理周期与流程（' + r.serveProcess.length + ' 步）',
      (r.handleCycle ? '<div class="ag-cycle">' + icon('clock') + '<span>预计办理周期：<b>' + cfgText(r.handleCycle) + '</b></span></div>' : '') +
      agencyProcess(r.serveProcess));
    if (r.requiredMaterials && r.requiredMaterials.length) h += sec('所需材料清单', agencyMaterials(r.requiredMaterials));
    h += sec('人员配置与政策依据', dList([
      { k: '人员配置要求', v: r.personnelReq },
      { k: '政策依据', v: r.policyBasis }
    ]));
    if (r.cases && r.cases.length) h += sec('真实成功案例（' + r.cases.length + '）', agencyCaseCard(r.cases));
    if (r.qual) h += sec('机构资质', '<div class="ds-text">' + r.qual + '</div>');
    if (r.refundPolicy) h += sec('退款保障', '<div class="ds-text">' + r.refundPolicy + '</div>');
    if (r.overdueClause) h += sec('超期赔付', '<div class="ds-text">' + r.overdueClause + '</div>');
    h += sec('机构联系方式', agencyContact(r, c, locked));
    return h;
  }
  /* ---- 企业买卖·资产 (高保真：GEO 卡 / 风险 / 营收 / 尽调) ---- */
  function geoCard(sc, gr, bars) {
    return '<div style="margin-top:12px;padding:14px;border-radius:12px;background:var(--bg-elevated);box-shadow:0 0 0 0.5px rgba(22,22,22,0.035),0 1px 2px rgba(22,22,22,0.04),0 2px 8px rgba(22,22,22,0.04);">' +
      '<div style="display:flex;align-items:center;gap:16px;">' +
        '<div style="text-align:center;flex:none;">' +
          '<div style="display:inline-flex;align-items:baseline;gap:2px;"><span style="font-family:var(--font-num);font-size:32px;font-weight:700;color:var(--accent);line-height:1;">' + sc.toFixed(1) + '</span><span style="font-size:12px;color:var(--ink-tertiary);">/10</span></div>' +
          '<div style="font-size:10px;color:var(--ink-tertiary);margin-top:2px;">GEO综合评分</div>' +
          '<div style="display:inline-flex;align-items:center;gap:3px;margin-top:6px;padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,var(--accent),var(--accent-light));"><svg viewBox="0 0 24 24" fill="currentColor" style="width:8px;height:8px;color:var(--text-inv,#fff);"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span style="font-size:9px;font-weight:700;color:var(--text-inv,#fff);">' + gr + '</span></div>' +
        '</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">' + bars.map(function (b) {
          return '<div><div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="font-size:9px;color:var(--ink-secondary);">' + b.k + '</span><span style="font-size:9px;font-weight:600;font-family:var(--font-num);">' + b.v + '</span></div><div style="height:3px;border-radius:2px;background:rgba(22,22,22,0.06);"><div style="height:3px;border-radius:2px;background:' + b.c + ';width:' + b.w + '%;"></div></div></div>';
        }).join('') + '</div>' +
      '</div></div>';
  }
  function riskCard(risk) {
    return '<div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:rgba(43,107,79,0.04);border:0.5px solid rgba(43,107,79,0.15);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
        '<span style="font-size:12px;font-weight:600;color:var(--ink-primary);">风险概览</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--success);"><span style="width:6px;height:6px;border-radius:50%;background:var(--success);"></span>低风险</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + risk.map(function (x) {
        var good = /无|0条|清晰|有效|核验/.test(x.v);
        return '<div style="padding:8px 10px;border-radius:8px;background:var(--bg-elevated);"><div style="font-size:9px;color:var(--ink-tertiary);margin-bottom:3px;">' + x.k + '</div><div style="font-size:11px;font-weight:600;color:' + (good ? 'var(--success)' : 'var(--warning)') + ';">' + x.v + '</div></div>';
      }).join('') + '</div></div>';
  }
  function revenueSection(revenue) {
    if (!revenue || !revenue.length) return sec('近3年营收', '<div class="ds-text">暂无营收数据。</div>');
    var max = Math.max.apply(null, revenue.map(function (x) { return x.v; })) || 1;
    return sec('近3年营收（万元）',
      '<div style="display:flex;align-items:flex-end;gap:16px;height:100px;padding:0 8px;margin-top:8px;">' + revenue.map(function (b, i) {
        var h = Math.round(b.v / max * 90);
        var isLast = i === revenue.length - 1;
        var col = isLast ? 'var(--success)' : 'var(--accent)';
        var top = isLast ? '<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-family:var(--font-num);font-size:9px;font-weight:600;color:var(--success);">' + b.v.toLocaleString() + '</div>' : '';
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;"><div style="width:100%;height:' + h + 'px;border-radius:4px 4px 0 0;background:' + col + ';position:relative;">' + top + '</div><span style="font-family:var(--font-num);font-size:10px;font-weight:600;color:var(--ink-primary);">' + b.v.toLocaleString() + '</span><span style="font-size:9px;color:var(--ink-tertiary);">' + b.year + '</span></div>';
      }).join('') + '</div>');
  }
  function reportCard(exam) {
    return '<div style="margin:0 0 14px;padding:14px;border-radius:12px;background:linear-gradient(135deg,var(--ink-primary),var(--ink-primary));position:relative;overflow:hidden;margin-top:2px;">' +
      '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(201,169,97,0.2),transparent);"></div>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;position:relative;z-index:1;">' + icon('doc') + '<span style="font-size:13px;font-weight:700;color:var(--accent-light);">深度尽调报告</span></div>' +
      '<div style="font-size:10px;color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:12px;position:relative;z-index:1;">工商信息、司法风险、经营风险、知识产权、财务数据全维度分析，AI+人工双重审核</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">' +
        '<div><span style="font-family:var(--font-num);font-size:20px;font-weight:700;color:var(--accent-light);">¥' + exam.price + '</span><span style="font-size:10px;color:rgba(255,255,255,0.4);text-decoration:line-through;margin-left:6px;">¥' + exam.orig + '</span></div>' +
        '<button onclick="UI.toast(\'已购买深度尽调报告\',\'ok\')" style="padding:7px 16px;border-radius:16px;background:linear-gradient(135deg,var(--accent),var(--accent-light));border:none;font-size:11px;font-weight:600;color:var(--text-inv,#fff);cursor:pointer;">立即购买</button>' +
      '</div></div>';
  }
  /* ---- 背调文件模块（结构化尽调报告 · 脱敏） ---- */
  function dueDiligenceSection(dd, pdfFile) {
    var sections = [
      { key: 'business', label: '工商信息', icon: 'building' },
      { key: 'tax', label: '税务信息', icon: 'wallet' },
      { key: 'litigation', label: '诉讼信息', icon: 'file-text' },
      { key: 'qualification', label: '资质信息', icon: 'shield' },
      { key: 'risk', label: '风险提示', icon: 'alert' }
    ];
    var html = '<div class="dd-section">';
    html += '<div class="dd-header">' +
      '<div class="dd-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-clip"/></svg>出售方背调文件（脱敏版）</div>' +
      '<div class="dd-promise">出售方承诺：本文件信息真实有效，如有虚假愿承担法律责任</div>' +
      '</div>';
    sections.forEach(function (s) {
      var data = dd[s.key];
      if (!data) return;
      var statusBadge = data.status ? '<span class="dd-status dd-status-' + (data.status === '正常' || data.status === '无' || data.status === '有效' ? 'ok' : 'warn') + '">' + data.status + '</span>' : '';
      html += '<div class="dd-block">' +
        '<div class="dd-block-title">' + icon(s.icon) + s.label + statusBadge + '</div>' +
        '<div class="dd-block-body">' + dList(data.items) + '</div>' +
        '</div>';
    });
    if (pdfFile) {
      html += '<div class="dd-pdf" onclick="UI.toast(\'下载中...\',\'ok\')">' +
        '<div class="dd-pdf-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
        '<div class="dd-pdf-body"><div class="dd-pdf-name">' + pdfFile.name + '</div>' +
        '<div class="dd-pdf-meta">' + pdfFile.size + ' · ' + pdfFile.pages + '页 · 上传于' + pdfFile.uploadTime + '</div></div>' +
        '<div class="dd-pdf-download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>' +
        '</div>';
    }
    html += '</div>';
    return sec('背调文件', html);
  }
  /* ---- 转让流程模块（线上4步） ---- */
  function transferProcessSection(process) {
    var html = '<div class="tp-section">';
    process.forEach(function (p, i) {
      var isLast = i === process.length - 1;
      html += '<div class="tp-step">' +
        '<div class="tp-step-left">' +
        '<div class="tp-num">' + p.step + '</div>' +
        (!isLast ? '<div class="tp-line"></div>' : '') +
        '</div>' +
        '<div class="tp-step-body">' +
        '<div class="tp-title">' + p.title + '</div>' +
        '<div class="tp-desc">' + p.desc + '</div>' +
        '</div>' +
        '</div>';
    });
    html += '<div class="tp-notice">线上流程结束后，后续签约、工商变更、资质变更、交接等由买卖双方自行协商，平台接收双方反馈并协助调解。</div>';
    html += '</div>';
    return sec('转让流程（线上）', html);
  }

  /* ================= 第5类 建企买卖：风险雷达 / 尽调摘要卡 / 涉诉时间线 / 资质包 / 付款 / 保证金 ================= */
  /* 六维风险雷达（SVG，0-100 分，分数越低风险越小；叠加行业安全基线虚线） */
  function riskRadarChart(radar) {
    if (!radar || !radar.scores) return '';
    var dims = [
      { k: '司法涉诉', key: 'litigation' },
      { k: '对外担保', key: 'guarantee' },
      { k: '股权质押', key: 'pledge' },
      { k: '税务欠缴', key: 'tax' },
      { k: '社保欠缴', key: 'socialSecurity' },
      { k: '在建工程', key: 'project' }
    ];
    var N = dims.length, W = 300, H = 250, cx = W / 2, cy = H / 2 - 5, R = 88;
    var scores = radar.scores || {};
    var lv = radar.level || '低';
    var lvColor = lv === '高' ? '#B3261E' : (lv === '中' ? '#D97706' : 'var(--success)');
    function pt(i, frac) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return [cx + R * frac * Math.cos(a), cy + R * frac * Math.sin(a)];
    }
    function poly(p, style) {
      return '<polygon points="' + p.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '" style="' + style + '"/>';
    }
    var h = '<div class="risk-radar">';
    /* 综合评级条（上移，避免与雷达网格重叠） */
    var avgScore = 0;
    dims.forEach(function (d) { avgScore += Number(scores[d.key]) || 0; });
    avgScore = Math.round(avgScore / N);
    h += '<div class="rr-summary">' +
      '<div class="rrs-col"><span class="rrs-label">综合风险等级</span><span class="rrs-level" style="color:' + lvColor + '">' + lv + '风险</span></div>' +
      '<div class="rrs-col rrs-right"><span class="rrs-label">六维均分</span><span class="rrs-score">' + avgScore + '<span>/100</span></span></div>' +
      '</div>';
    h += '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rr-svg">';
    /* 网格环 25/50/75/100 */
    [100, 75, 50, 25].forEach(function (pct) {
      var pts = [];
      for (var i = 0; i < N; i++) pts.push(pt(i, pct / 100));
      h += poly(pts, 'fill:none;stroke:var(--line-strong);stroke-width:1');
    });
    /* 轴辐线 */
    for (var i = 0; i < N; i++) {
      var p = pt(i, 1);
      h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" style="stroke:var(--line);stroke-width:1"/>';
    }
    /* 行业安全基线（30 分虚线） */
    var base = [];
    for (var i = 0; i < N; i++) base.push(pt(i, 0.30));
    h += poly(base, 'fill:rgba(217,119,6,.05);stroke:var(--warning);stroke-width:1.2;stroke-dasharray:4 3');
    /* 公司得分多边形 */
    var cp = [];
    for (var i = 0; i < N; i++) {
      var sc = Math.max(0, Math.min(100, Number(scores[dims[i].key]) || 0));
      cp.push([pt(i, sc / 100), sc]);
    }
    h += poly(cp.map(function (x) { return x[0]; }), 'fill:var(--success-soft);stroke:var(--success);stroke-width:2;stroke-linejoin:round');
    /* 顶点：高风险(>70) 橙色描点 + 分值 */
    cp.forEach(function (q) {
      var hi = q[1] > 70;
      h += '<circle cx="' + q[0][0].toFixed(1) + '" cy="' + q[0][1].toFixed(1) + '" r="' + (hi ? 4 : 3) + '" style="fill:' + (hi ? 'var(--warning)' : 'var(--success)') + ';stroke:#fff;stroke-width:1"/>';
      if (hi) h += '<text x="' + q[0][0].toFixed(1) + '" y="' + (q[0][1].toFixed(1) - 7) + '" text-anchor="middle" style="font-size:9px;font-weight:700;fill:var(--warning)">' + q[1] + '</text>';
    });
    /* 轴标签 */
    for (var i = 0; i < N; i++) {
      var lp = pt(i, 1.22);
      var ang = -Math.PI / 2 + i * 2 * Math.PI / N;
      var anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
      h += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1].toFixed(1) + 3) + '" text-anchor="' + anchor + '" style="font-size:10px;fill:var(--ink-secondary)">' + dims[i].k + '</text>';
    }
    /* 圆心留空：综合评级已上移至顶部评级条，避免与网格/多边形重叠 */
    h += '</svg>';
    /* 六维计数（免费可见） */
    var counts = radar.counts || {};
    h += '<div class="rr-dims">' + dims.map(function (d) {
      return '<div class="rrd-item"><div class="rrd-k">' + d.k + '</div><div class="rrd-v">' + (counts[d.key] || '—') + '</div></div>';
    }).join('') + '</div>';
    h += '<div class="rr-note">评分 0-100，分数越低风险越小；虚线为行业安全基线（30 分）。缴纳保证金后可查看完整风险明细。</div>';
    h += '</div>';
    return h;
  }
  /* 尽调摘要卡：法律 / 财务 / 资质 / 工程 四维度状态徽章 + 关键发现 + 报告入口（付费锁定） */
  function ddSummaryCard(dd, locked) {
    if (!dd) return '';
    var blocks = [
      { key: 'legal', label: '法律尽调', ic: 'shield' },
      { key: 'finance', label: '财务尽调', ic: 'wallet' },
      { key: 'qualification', label: '资质尽调', ic: 'doc' },
      { key: 'engineering', label: '工程尽调', ic: 'tool' }
    ];
    var h = '<div class="dd-summary-card">';
    h += '<div class="dds-head">' +
      '<div class="dds-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-clip"/></svg>尽调结论摘要</div>' +
      '<div class="dds-meta">' + (dd.agency || '') + (dd.date ? '<span class="dds-date">' + dd.date + '</span>' : '') + '</div></div>';
    blocks.forEach(function (b) {
      var blk = dd[b.key];
      if (!blk) return;
      var st = blk.status || '—';
      var stCls = st === '通过' ? 'ok' : (st === '关注' ? 'warn' : 'risk');
      h += '<div class="dds-block">' +
        '<div class="dds-block-head"><span class="dds-block-label">' + icon(b.ic) + b.label + '</span><span class="dds-badge dds-badge-' + stCls + '">' + st + '</span></div>' +
        '<div class="dds-findings">' + (blk.findings || []).slice(0, 2).map(function (f) {
          return '<div class="ddsf-item">' + icon('check') + '<span>' + f + '</span></div>';
        }).join('') + '</div></div>';
    });
    h += '<div class="dds-foot" data-pw>' + icon('doc') + '<span>查看完整报告（尽调报告 · 审计报告 · 评估报告）</span>' +
      '<span class="dds-lock">' + Lock.lockIc + '保证金解锁</span></div>';
    h += '</div>';
    return h;
  }
  /* 涉诉时间线：倒序案件列表，被告/被执行橙点、原告/胜诉绿点；判决结果付费锁定 */
  function litigationTimeline(lit, locked) {
    if (!lit) return '';
    var list = (lit.list || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!list.length) {
      return '<div class="litigation-timeline"><div class="lt-empty">' + icon('shield') + '<span>近三年无司法涉诉记录，风险状态良好</span></div></div>';
    }
    var h = '<div class="litigation-timeline">';
    h += '<div class="lt-summary">累计 <b>' + (lit.count || list.length) + '</b> 件 · 被告/被执行 <b>' + (lit.asDefendant || 0) + '</b> 件 · 原告/胜诉 <b>' + (lit.asPlaintiff || 0) + '</b> 件</div>';
    list.forEach(function (x, i) {
      var last = i === list.length - 1;
      var isD = /被告|被执行/.test(x.type || '');
      var dotColor = isD ? 'var(--warning)' : 'var(--success)';
      var stCls = x.status === '已结案' ? 'ok' : (x.status === '执行中' ? 'warn' : 'risk');
      h += '<div class="lt-item">' +
        '<div class="lt-rail"><span class="lt-dot" style="background:' + dotColor + ';"></span>' + (last ? '' : '<span class="lt-line"></span>') + '</div>' +
        '<div class="lt-body">' +
          '<div class="lt-head"><span class="lt-date">' + x.date + '</span><span class="lt-type" style="color:' + dotColor + ';">' + x.type + '</span><span class="lt-status lt-status-' + stCls + '">' + x.status + '</span></div>' +
          '<div class="lt-cause">' + x.cause + '</div>' +
          '<div class="lt-amount">标的额：<b>' + x.amount + '</b></div>' +
          (x.result ? '<div class="lt-result">' + Lock.full(x.result, locked) + '</div>' : '') +
        '</div></div>';
    });
    h += '<div class="lt-note">数据来源：中国裁判文书网 / 中国执行信息公开网；缴纳保证金后解锁完整判决结果与案件文书。</div>';
    h += '</div>';
    return h;
  }
  /* 资质包（结构化：名称 / 等级 / 有效期 / 证书编号，进度条复用 qpc 样式） */
  function tradeQualPack(qp) {
    if (!qp || !qp.length) return '';
    return '<div class="qual-pack-card">' + qp.map(function (q) {
      var name = (typeof q === 'string') ? q : q.name;
      var lv = (typeof q === 'string') ? franchParseLv(q) : q.level;
      var expiry = (typeof q === 'string') ? '' : q.expiry;
      var certNo = (typeof q === 'string') ? '' : q.certNo;
      var m = franchMonthsLeft(expiry);
      var pct = 100, remain = '长期有效', flag = '', fillCls = 'bar-ok';
      if (m !== null) {
        if (m < 0) { pct = 6; remain = '已到期，需延续'; flag = '<span class="qpc-flag is-exp">已到期</span>'; fillCls = 'bar-exp'; }
        else {
          pct = Math.max(8, Math.min(100, Math.round(m / 60 * 100)));
          remain = '剩余约 ' + (m >= 12 ? (Math.floor(m / 12) + ' 年' + (m % 12 ? (m % 12) + ' 个月' : '')) : m + ' 个月');
          if (m <= 6) { flag = '<span class="qpc-flag is-warn">即将到期</span>'; fillCls = 'bar-warn'; }
        }
      }
      var metaHtml = '<div class="qpc-meta">';
      if (certNo) metaHtml += '<span class="qpc-meta-item">证书编号 <b>' + cfgText(certNo) + '</b></span><span class="qpc-sep">·</span>';
      if (expiry) metaHtml += '<span class="qpc-meta-item">有效期至 ' + expiry + '</span><span class="qpc-sep">·</span>';
      else metaHtml += '<span class="qpc-meta-item">长期有效</span><span class="qpc-sep">·</span>';
      metaHtml += '<span class="qpc-meta-item qpc-remain">' + remain + '</span>';
      if (flag) metaHtml += flag;
      metaHtml += '</div>';
      return '<div class="qpc-item">' +
        '<div class="qpc-top"><span class="qpc-name">' + cfgText(name) + '</span>' + (lv ? '<span class="qpc-lv ' + franchLevelCls(lv) + '">' + lv + '</span>' : '') + '</div>' +
        metaHtml +
        '<div class="qpc-track"><div class="qpc-fill ' + fillCls + '" style="width:' + pct + '%;"></div></div>' +
      '</div>';
    }).join('') + '</div>';
  }
  /* ¥5000 可退保证金机制卡片 */
  function depositCard(rec) {
    var amt = (rec && rec.deposit) ? '¥' + Number(rec.deposit).toLocaleString() : '¥5,000';
    return '<div class="deposit-card">' +
      '<div class="dc-head"><div class="dc-ic">' + icon('shield') + '</div>' +
      '<div class="dc-t"><div class="dc-title">' + amt + ' 可退保证金 · 筛选真实买家</div>' +
      '<div class="dc-sub">缴纳保证金后解锁完整信息与转让方联系方式</div></div></div>' +
      '<div class="dc-steps">' +
        '<div class="dc-step"><div class="dc-n">1</div><div class="dc-tx"><b>缴纳保证金</b><span>' + amt + ' 解锁全部信息</span></div></div>' +
        '<div class="dc-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>' +
        '<div class="dc-step"><div class="dc-n">2</div><div class="dc-tx"><b>联系转让方</b><span>查看完整尽调与案件明细</span></div></div>' +
        '<div class="dc-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>' +
        '<div class="dc-step"><div class="dc-n">3</div><div class="dc-tx"><b>成交或退还</b><span>30 天内未成交全额退还</span></div></div>' +
      '</div>' +
      '<div class="dc-note">' + icon('check') + '<span>达成交易可抵扣交易服务费；30 天内未达成交易全额无息退还。</span></div>' +
    '</div>';
  }
  /* 付款方式分期（分期比例免费可见，精确金额付费锁定） */
  function tradePayment(pt, locked) {
    if (!pt || !pt.length) return '';
    var h = '<div class="pay-terms">';
    h += '<div class="pt-bar">' + pt.map(function (x) {
      return '<div class="ptb-seg" style="flex:' + (parseInt(x.ratio) || 1) + ';"><span>' + x.ratio + '</span></div>';
    }).join('') + '</div>';
    h += '<div class="pt-rows">' + pt.map(function (x) {
      var amt = x.amount ? Lock.price(x.amount, locked, '精确金额待解锁') : '';
      return '<div class="pt-row"><div class="pt-stage"><span class="pts-n">' + x.stage + '</span><span class="pts-ratio">' + x.ratio + '</span></div>' +
        '<div class="pt-amt">' + amt + (x.note ? '<span class="pt-note">' + x.note + '</span>' : '') + '</div></div>';
    }).join('') + '</div>';
    h += '<div class="pt-free">分期比例免费可见，精确金额缴纳保证金后解锁</div>';
    h += '</div>';
    return h;
  }
  /* 注册人员配置 */
  function tradeStaff(st) {
    if (!st || !st.list || !st.list.length) return '';
    return '<div class="franch-staff">' + st.list.map(function (x) {
      return '<div class="fs-cell"><div class="fs-n">' + x.v + '</div><div class="fs-k">' + x.k + '</div></div>';
    }).join('') + (st.note ? '<div class="fs-note">' + st.note + '</div>' : '') + '</div>';
  }
  /* 尽调报告 PDF 文件列表（含类型标签；未解锁整卡磨砂锁定） */
  function ddPdfList(files, locked) {
    if (!files || !files.length) return '';
    var h = '<div class="dd-pdf-list">';
    files.forEach(function (p) {
      var pname = String(p.name).replace(/'/g, "\\'");
      var body = '<div class="dpf-item" onclick="DETAIL.viewPdf(\'' + pname + '\')">' +
        '<div class="dpf-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
        '<div class="dpf-body"><div class="dpf-name">' + p.name + '</div>' +
        '<div class="dpf-meta"><span class="dpf-type">' + (p.type || 'PDF') + '</span><span>' + p.size + '</span><span>' + p.pages + '页</span><span>' + p.uploadTime + '</span></div></div>' +
        '<div class="dpf-dl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div></div>';
      h += locked ? Lock.file(body, true, '解锁查看 / 下载文件') : body;
    });
    h += '</div>';
    return h;
  }
  /* 隐性债务承诺卡 */
  function commitmentCard(txt, locked) {
    return '<div class="commit-card">' + icon('shield') +
      '<div class="cm-tx"><div class="cm-title">隐性债务承诺</div>' +
      '<div class="cm-desc">' + (locked ? Lock.full(txt, true) : txt) + '</div></div>' +
      '<div class="cm-tag">原股东连带责任</div></div>';
  }
  function tradeBody(r, c) {
    var locked = !UnlockStore.isUnlocked(r);
    var sc = c.score ? c.score.value : 9.0;
    var gr = c.score ? c.score.grade : 'AAA级';
    var bars = [
      { k: '信息真实性', v: (sc + 0.2).toFixed(1), w: Math.min(100, Math.round((sc + 0.2) * 10)), c: 'var(--accent)' },
      { k: '财务健康', v: (sc - 0.1).toFixed(1), w: Math.min(100, Math.round((sc - 0.1) * 10)), c: 'var(--success)' },
      { k: '综合评分', v: sc.toFixed(1), w: Math.min(100, Math.round(sc * 10)), c: 'var(--info)' }
    ];
    var radar = r.riskRadar || {};
    var h = geoCard(sc, gr, bars);
    /* 风险等级速览（联动雷达） */
    if (radar.level) {
      var lvCls = radar.level === '高' ? 'high' : (radar.level === '中' ? 'mid' : 'low');
      var dimsQuick = [
        { k: '司法涉诉', key: 'litigation' }, { k: '对外担保', key: 'guarantee' }, { k: '股权质押', key: 'pledge' },
        { k: '税务', key: 'tax' }, { k: '社保', key: 'socialSecurity' }, { k: '在建', key: 'project' }
      ];
      h += '<div class="trade-risk-sum">' +
        '<div class="trs-lv"><span class="risk-level risk-level-' + lvCls + '">' + radar.level + '风险</span><span class="trs-lv-label">综合风险等级</span></div>' +
        '<div class="trs-dims">' + dimsQuick.map(function (d) {
          return '<span class="trs-chip"><b>' + d.k + '</b>' + ((radar.counts || {})[d.key] || '—') + '</span>';
        }).join('') + '</div></div>';
    }
    h = sec('交易概况', h);
    /* 风险雷达（六维体检） */
    if (radar.scores) h += sec('风险雷达 · 六维体检', riskRadarChart(radar, locked));
    /* 企业概况 */
    var baseRows = [];
    if (r.registeredCapital) baseRows.push({ k: '注册资本', v: r.registeredCapital });
    if (r.establishmentDate) baseRows.push({ k: '成立日期', v: r.establishmentDate });
    if (r.equityStructure) baseRows.push({ k: '股权结构', v: r.equityStructure });
    if (r.equityPledge) baseRows.push({ k: '股权质押 / 冻结', v: r.equityPledge });
    if (r.info && r.info.length) baseRows = baseRows.concat(r.info);
    h += sec('企业概况', dList(baseRows));
    if (r.staffConfig && r.staffConfig.list) h += sec('注册人员配置', tradeStaff(r.staffConfig));
    /* 资质与证照 */
    if (r.qualPack && r.qualPack.length) {
      var qualRows = [];
      if (r.safetyLicense) qualRows.push({ k: '安全生产许可证', v: r.safetyLicense.no + ' · 有效期至 ' + r.safetyLicense.expiry });
      if (r.qualExpiry) qualRows.push({ k: '主资质有效期', v: r.qualExpiry });
      if (r.businessAbnormal) qualRows.push({ k: '经营合规', v: r.businessAbnormal });
      h += sec('资质与证照', tradeQualPack(r.qualPack) + (qualRows.length ? '<div class="qual-extra-table">' + dList(qualRows) + '</div>' : ''));
    }
    /* 交易 · 结算 · 交付 */
    var dealRows = [];
    if (r.transferMethod) dealRows.push({ k: '转让方式', v: r.transferMethod });
    if (r.changeCycle) dealRows.push({ k: '变更周期', v: r.changeCycle });
    if (r.urgentReason) dealRows.push({ k: '转让原因', v: r.urgentReason });
    if (r.priceDrop) dealRows.push({ k: '降价幅度', v: r.priceDrop });
    if (dealRows.length) h += sec('交易 · 结算 · 交付', dList(dealRows) + tradePayment(r.paymentTerms, locked) + depositCard(r));
    /* 股权 · 税务 · 社保 · 账户 */
    var finRows = [];
    if (r.taxStatus) finRows.push({ k: '税务清缴', v: r.taxStatus });
    if (r.socialSecurity) finRows.push({ k: '社保缴纳', v: r.socialSecurity });
    if (r.bankAccount) {
      var ba = r.bankAccount;
      finRows.push({ k: '银行账户', v: (typeof ba === 'object') ? ((ba.status ? ba.status + ' · ' : '') + (ba.detail || '')) : ba });
    }
    if (r.externalGuarantee) {
      var eg = r.externalGuarantee;
      finRows.push({ k: '对外担保', v: (typeof eg === 'object') ? (eg.detail + '（' + eg.amount + '）') : eg });
    }
    if (r.ongoingProjects && r.ongoingProjects.length) {
      finRows.push({ k: '在建工程', v: r.ongoingProjects.map(function (p) { return p.name + '（' + p.amount + ' · ' + p.progress + ' · ' + p.payment + '）'; }).join('；') });
    }
    if (finRows.length) h += sec('股权 · 税务 · 社保 · 账户', dList(finRows));
    /* 司法涉诉 */
    if (r.litigation) h += sec('司法涉诉', litigationTimeline(r.litigation, locked));
    /* 尽调档案 */
    var ddHtml = '';
    if (r.ddSummary) ddHtml += ddSummaryCard(r.ddSummary, locked);
    if (r.pdfFiles && r.pdfFiles.length) ddHtml += ddPdfList(r.pdfFiles, locked);
    if (ddHtml) h += sec('尽调档案', ddHtml);
    /* 风险与承诺 */
    if (r.hiddenDebtCommitment) h += sec('风险与承诺', commitmentCard(r.hiddenDebtCommitment, locked));
    /* 近3年营收 */
    if (r.revenue && r.revenue.length) h += revenueSection(r.revenue);
    /* 转让流程 */
    if (r.transferProcess && r.transferProcess.length) h += transferProcessSection(r.transferProcess);
    h += Lock.inline(locked, '缴纳保证金查看完整信息', '完整尽调 · 风险明细 · 转让方联系方式', '¥5,000 可退保证金');
    return h;
  }
  function tradeLock(r, c) {
    return [
      { k: '完整公司名称', v: c.name },
      { k: '统一社会信用代码', v: r.creditCode || '—' },
      { k: '详细注册地址', v: r.fullAddress || '—' },
      { k: '法定代表人', v: r.legalRep || '—' },
      { k: '股东身份信息', v: r.shareholders || '—' },
      { k: '银行账户（开户行/账号）', v: (r.bankAccount && typeof r.bankAccount === 'object' && r.bankAccount.detail) ? r.bankAccount.detail : (r.bankAccount || '—') },
      { k: '精确可谈底价', v: (r.price || '—') + '（议价空间待解锁）' },
      { k: '风险案件明细', v: '诉讼 / 担保 / 在建工程完整清单' },
      { k: '注册人员名册', v: '全部注册人员名单及社保状态' },
      { k: '尽调报告 PDF', v: '尽调报告 · 审计报告 · 评估报告' },
      { k: '隐性债务承诺条款', v: '完整条款与担保函' },
      { k: '转让方联系人', v: c.contact.name + ' · ' + c.contact.phone }
    ];
  }
  var byType = {};
  Object.keys(MATCH).forEach(function (k) {
    var cfg = MATCH[k];
    byType[k] = {
      label: cfg.label, cta: '立即咨询', verified: '已认证',
      hero: function (r, c) { var d = dirTag(r.dir); return dHero({ tag: d.txt + ' · ' + r.sub, verifiedHint: (r.verified ? '已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: matchMeta(r) }); },
      sections: function (r, c) { return matchBody(r, cfg); },
      lockRows: function (r, c) { return matchLock(r, c, cfg); }
    };
  });
  /* ================= 项目合作/分包联营（cooperation）：16 字段 + 模式对比卡 + 资金到位条 + 就近打码 ================= */
  /* ① 合作模式对比卡：多模式横向对比，推荐模式高亮 */
  function coopModeCompare(modes) {
    if (!modes || !modes.length) return '';
    return '<div class="coop-mode-compare">' + modes.map(function (m) {
      var pros = (m.pros || []).map(function (x) { return '<div class="cmc-line is-pro"><span class="cmc-mark">+</span><span>' + cfgText(x) + '</span></div>'; }).join('');
      var cons = (m.cons || []).map(function (x) { return '<div class="cmc-line is-con"><span class="cmc-mark">−</span><span>' + cfgText(x) + '</span></div>'; }).join('');
      return '<div class="cmc-card' + (m.recommend ? ' is-rec' : '') + '">' +
        '<div class="cmc-top"><span class="cmc-mode">' + icon('briefcase') + cfgText(m.mode) + '</span>' +
        (m.recommend ? '<span class="cmc-rec">推荐</span>' : '') + '</div>' +
        '<div class="cmc-desc">' + cfgText(m.desc) + '</div>' +
        (pros ? '<div class="cmc-block">' + pros + '</div>' : '') +
        (cons ? '<div class="cmc-block">' + cons + '</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }
  /* ② 资金到位状态条：到位率进度 + 分期清单 + 状态分级 */
  function fundStatusBar(f) {
    if (!f) return '';
    var pct = Number(f.arrivedPct || 0);
    var lvl = pct >= 90 ? 'safe' : (pct >= 60 ? 'mid' : 'low');
    var stateMap = { arrived: ['已到位', 'is-ok'], partial: ['拨付中', 'is-mid'], pending: ['待落实', 'is-pend'] };
    var stages = (f.stages || []).map(function (g) {
      var sm = stateMap[g.status] || stateMap.pending;
      return '<div class="fsb-stage ' + sm[1] + '"><span class="fsb-dot"></span>' +
        '<div class="fsb-info"><div class="fsb-name">' + cfgText(g.name) + ' <b class="fsb-amt">' + cfgText(g.amount) + '</b></div>' +
        '<div class="fsb-date">' + cfgText(g.date) + '</div></div>' +
        '<span class="fsb-state">' + sm[0] + '</span></div>';
    }).join('');
    return '<div class="fund-status-bar fsb-' + lvl + '">' +
      '<div class="fsb-top"><div class="fsb-stat"><span class="k">项目总投资</span><b>' + cfgText(f.totalAmount) + '</b></div>' +
      '<div class="fsb-stat"><span class="k">已到位资金</span><b>' + cfgText(f.arrivedAmount) + '</b></div>' +
      '<div class="fsb-pct"><b>' + pct + '%</b><span>资金到位率</span></div></div>' +
      '<div class="fsb-track"><div class="fsb-fill" style="width:' + pct + '%"></div></div>' +
      (stages ? '<div class="fsb-stages">' + stages + '</div>' : '') +
      (f.note ? '<div class="fsb-note">' + icon('shield') + '<span>' + cfgText(f.note) + '</span></div>' : '') +
    '</div>';
  }
  /* ③ 招标文件：未解锁覆盖磨砂锁层 */
  function coopFiles(files, locked) {
    if (!files || !files.length) return '';
    return '<div class="coop-files">' + files.map(function (f) {
      var inner = '<div class="coop-file"><div class="cf-ic">' + icon('doc') + '</div>' +
        '<div class="cf-body"><div class="cf-name">' + cfgText(f.n) + '</div>' +
        '<div class="cf-meta">' + cfgText(f.size) + (f.pages && f.pages !== '—' ? ' · ' + cfgText(f.pages) + ' 页' : '') + '</div></div>' +
        '<div class="cf-go">' + icon('chev-r') + '</div></div>';
      return Lock.file(inner, locked, '解锁查看 / 下载招标文件');
    }).join('') + '</div>';
  }
  /* ④ 合作时间线（日期 + 节点） */
  function coopSchedule(items) {
    if (!items || !items.length) return '';
    return '<div class="coop-schedule">' + items.map(function (x, i) {
      var last = i === items.length - 1;
      return '<div class="cs-item cs-' + (x.state || 'plan') + '"><div class="cs-rail"><span class="cs-dot"></span>' + (last ? '' : '<span class="cs-line"></span>') + '</div>' +
        '<div class="cs-body"><span class="cs-date">' + cfgText(x.date) + '</span><span class="cs-title">' + cfgText(x.title) + '</span></div></div>';
    }).join('') + '</div>';
  }
  /* ⑤ 合作方联系卡：主体免费，电话/微信/门牌就近打码 */
  function coopContact(r, c, locked) {
    var cc = r.contact || {};
    var avatar = (c.name || '企').charAt(0);
    function row(k, v) { return '<div class="cc-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return '<div class="contact-card">' +
      '<div class="cc-head"><div class="cc-avatar">' + avatar + '</div>' +
        '<div class="cc-id"><div class="cc-name">' + cfgText(c.name || '项目方') + '</div><div class="cc-sub">合作主体 · 平台已核验</div></div>' +
        '<span class="cc-badge">' + icon('check') + '已认证</span></div>' +
      '<div class="cc-list">' +
        row('对接人', cfgText(cc.name || '项目商务')) +
        row('联系电话', Lock.partial(cc.phone || '', locked)) +
        row('微信号', Lock.full(cc.wechat || '', locked)) +
        row('项目/办公地址', Lock.partial(cc.addr || r.location || '', locked, cfgText(r.location) + ' · 精确地址付费可见')) +
      '</div>' +
      Lock.inline(locked, '解锁沟通权限 · 查看招标文件', '电话 · 微信 · 精确地址 · 全套招标资料', unlockCreditText(r)) + /* [FIX BM-012/BM-013] 价签改积分，文案改「沟通权限」 */
      '</div>';
  }
  function coopHero(r, c) {
    var d = dirTag(r.dir || 'opportunity');
    var base = dHero({ tag: d.txt + ' · ' + r.sub, verifiedHint: (r.verified ? '已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: oppMeta(r) });
    var fs = r.fundStatus || {};
    var chips = [];
    if (r.cooperationMode) chips.push(r.cooperationMode);
    if (typeof fs.arrivedPct === 'number') chips.push('资金到位 ' + fs.arrivedPct + '%');
    if (r.bidDeadline) chips.push('截止 ' + r.bidDeadline.split('（')[0]);
    return base + '<div class="hero-grade"><span class="hg-label">合作速览</span><div class="hg-list">' +
      chips.map(function (x) { return '<span class="tag tag-gold">' + x + '</span>'; }).join('') + '</div></div>';
  }
  function coopBody(r, c) {
    var locked = !UnlockStore.isUnlocked(r);
    var h = '';
    if (r.desc) h += sec('项目说明', '<div class="ds-text">' + r.desc + '</div>');
    h += sec('项目基本信息', dList([
      { k: '项目类型', v: r.projectType },
      { k: '项目规模', v: r.projectScale },
      { k: '总投资', v: r.investmentAmount },
      { k: '招标编号', v: r.tenderNo },
      { k: '投标/合作截止', v: r.bidDeadline }
    ]));
    if (r.coopModes && r.coopModes.length) {
      var modeHead = dList([{ k: '拟定合作方式', v: r.cooperationMode }]);
      h += sec('合作模式对比', modeHead + coopModeCompare(r.coopModes));
    }
    if (r.partnerQualReq) h += sec('合作方资质要求', '<div class="ds-text"><div class="coop-req">' + icon('shield') + '<span>' + cfgText(r.partnerQualReq) + '</span></div></div>');
    if (r.fundStatus) {
      h += sec('资金到位情况', fundStatusBar(r.fundStatus) +
        (r.fundSource ? dList([{ k: '资金来源', v: r.fundSource }]) : ''));
    }
    h += sec('合同 · 结算 · 付款', dList([
      { k: '签约主体', v: r.contractEntity },
      { k: '分成/收益', v: r.profitShare },
      { k: '结算方式', v: r.settlementTerms },
      { k: '付款条件', v: r.paymentTerms }
    ]));
    h += sec('风险分担与退出', dList([
      { k: '风险分担', v: r.riskAllocation },
      { k: '退出/清算条款', v: r.exitClause }
    ]));
    h += sec('招标文件与资料', coopFiles(r.tenderFiles, locked) +
      '<div class="coop-files-tip">' + icon('lock') + '<span>招标文件、图纸与资金证明仅对解锁用户开放下载</span></div>');
    if (r.coopProcess && r.coopProcess.length) {
      var proc = r.coopProcess.map(function (p) { return { step: p.step, title: p.title + (p.duration ? '（' + p.duration + '）' : ''), desc: p.desc }; });
      h += sec('合作流程（线上' + r.coopProcess.length + '步）', stepTimeline(proc));
    }
    if (r.coopTimeline && r.coopTimeline.length) h += sec('关键时间节点', coopSchedule(r.coopTimeline));
    h += sec('合作方联系方式', coopContact(r, c, locked));
    return h;
  }
  byType.cooperation = {
    label: '项目合作', verified: '已认证', inlineLock: true,
    ctaText: function (r, unlocked) { return unlocked ? '联系项目方 · 信息已解锁' : '解锁联系方式 · 查看招标文件'; },
    ctaLocked: '解锁联系方式 · 查看招标文件',
    hero: function (r, c) { return coopHero(r, c); },
    sections: function (r, c) { return coopBody(r, c); },
    lockRows: function () { return []; },
    unlockItems: function () { return ['项目方完整联系电话', '对接人微信号', '精确项目/办公地址', '招标文件正文与工程量清单', '施工图纸/方案资料', '资金到位证明与立项批复', '联合体/分包合同模板'] }
  };
  /* 材料类：单独覆盖为「真实市场信息结构 + 就近打码」，不再使用底部集中锁定区 */
  byType.material = {
    label: '材料采购', verified: '已认证', inlineLock: true,
    ctaText: function (r) { return matIsDemand(r) ? '联系采购方' : '联系供应商'; },
    hero: function (r, c) {
      var d = dirTag(r.type || r.dir);
      var base = dHero({ tag: d.txt + ' · ' + r.sub, verifiedHint: (r.verified ? '已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: matchMeta(r) });
      var g = r.mat && r.mat.grade;
      var quick = g ? '<div class="hero-grade"><span class="hg-label">' + cfgText(g.label) + '</span><div class="hg-list">' +
        g.chips.map(function (x) { return '<span class="tag tag-gold">' + cfgText(x) + '</span>'; }).join('') + '</div></div>' : '';
      return base + quick;
    },
    sections: function (r, c) { return materialBody(r, c); },
    lockRows: function () { return []; },
    unlockItems: function () { return ['完整联系电话', '微信号', '精确成交价 / 计价依据', '详细结算账期', '精确门牌地址', '资质与检测文件']; }
  };
  /* 设备类：单独覆盖为「真实市场信息结构 + 3 新组件 + 就近打码」，不再使用底部集中锁定区 */
  byType.equipment = {
    label: '设备租赁', verified: '已认证', inlineLock: true,
    ctaText: function (r) { return equipIsDemand(r) ? '联系承租方' : '联系出租方'; },
    hero: function (r, c) { return equipHero(r, c); },
    sections: function (r, c) { return equipmentBody(r, c); },
    lockRows: function () { return []; },
    unlockItems: function () { return ['完整联系电话', '微信号', '精确租金 / 台班与费用明细', '进出场 / 安拆 / 检测费', '押金与闲置计费规则', '设备资质与检测文件', '精确停放场地']; }
  };
  /* 劳务类：单独覆盖为「真实市场信息结构 + 4 新组件 + 就近打码」，不再使用底部集中锁定区 */
  byType.labor = {
    label: '劳务用工', verified: '已认证', inlineLock: true,
    ctaText: function (r) { return laborIsDemand(r) ? '联系用工方' : '联系班组长'; },
    hero: function (r, c) { return laborHero(r, c); },
    sections: function (r, c) { return laborBody(r, c); },
    lockRows: function () { return []; },
    unlockItems: function () { return ['班组长完整姓名与带班履历', '精确计件 / 日工 / 月工资', '详细结算与节点条款', '生活费预支与工资专户信息', '完整联系电话 / 微信', '资质证书与项目业绩全文', '班组精确驻地']; }
  };
  byType.franchise = {
    label: '招商加盟', inlineLock: true, verified: '企业已认证', consultMode: true, ctaLocked: '免费咨询',
    hero: function (r, c) {
      var tag = r.type === 'qualification' ? ('资质招商 · ' + (r.qualLevel || '') + '·' + (r.qualType || '')) : ('机会 · ' + r.sub);
      var vh = r.type === 'qualification' ? (r.verified ? '企业已认证' : '') : (r.verified ? '品牌已认证' : '');
      return dHero({ tag: tag, verifiedHint: vh, title: r.title, price: heroPrice(r), unit: r.unit, meta: oppMeta(r) });
    },
    sections: function (r, c) {
      if (r.type === 'qualification') return qualFranchiseBody(r, c);
      var locked = !UnlockStore.isUnlocked(r);
      var fc = r.fc || {};
      var h = '';
      if (r.desc) h += sec('项目介绍', '<div class="ds-text">' + r.desc + '</div>');
      var coreRows = [];
      if (fc.mode) coreRows.push({ k: '合作模式', v: fc.mode });
      if (fc.term) coreRows.push({ k: '合作期限', v: fc.term });
      if (fc.protect) coreRows.push({ k: '区域保护', v: fc.protect });
      if (fc.account) coreRows.push({ k: '结算方式', v: fc.account });
      if (coreRows.length) h += sec('合作方式', dList(coreRows));
      var fb = franchFee(fc);
      if (fb) h += sec('费用结构（透明公开）', fb);
      if (r.fields && r.fields.length) h += sec('加盟信息', dList(r.fields));
      if (r.benefits && r.benefits.length) h += sec('扶持权益', benefitGrid(r.benefits));
      if (r.qual) h += sec('品牌实力', '<div class="ds-text">' + r.qual + '</div>');
      h += sec('招商联系方式', franchContact(r, c, locked));
      if (r.joinProcess && r.joinProcess.length) h += sec('加盟流程（' + r.joinProcess.length + '步）', stepTimeline(r.joinProcess));
      return h;
    },
    ctaText: function (r, unlocked) { return unlocked ? '电话咨询招商顾问' : '免费咨询'; },
    unlockItems: function () { return ['招商顾问完整电话与微信', '总部 / 对接详细地址', '一对一加盟方案与费用测算', '加盟手册与合同模板']; },
    lockRows: function () { return []; }
  };
  byType.trade = {
    label: '企业买卖·资产', cta: '缴纳保证金查看详情', ctaLocked: '缴纳保证金查看详情', verified: '已认证',
    inlineLock: true,
    ctaText: function (r, unlocked) { return unlocked ? '联系转让方 · 信息已解锁' : '缴纳保证金查看详情'; },
    hero: function (r, c) {
      var base = dHero({ tag: '机会 · ' + r.sub, verifiedHint: (r.verified ? '已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: oppMeta(r) });
      var radar = r.riskRadar || {};
      var chips = [];
      if (radar.level) chips.push(radar.level + '风险');
      if (r.transferMethod) chips.push(r.transferMethod);
      chips.push('¥' + (r.deposit ? Number(r.deposit).toLocaleString() : '5,000') + ' 保证金可退');
      return base + '<div class="hero-grade"><span class="hg-label">转让速览</span><div class="hg-list">' +
        chips.map(function (x) { return '<span class="tag tag-gold">' + x + '</span>'; }).join('') + '</div></div>';
    },
    sections: function (r, c) { return tradeBody(r, c); },
    lockRows: function (r, c) { return tradeLock(r, c); },
    unlockItems: function () { return ['完整公司名称', '统一社会信用代码', '详细注册地址', '法定代表人', '股东身份信息', '银行账户（开户行/账号）', '精确可谈底价', '风险案件明细', '注册人员名册', '尽调报告 PDF', '隐性债务承诺条款', '转让方联系人']; }
  };
  /* 服务广场来源（from=market）：从报价解析可下单金额（一价全包/预算），供 CTA 文本与跳转 */
  function agencyOrderAmount(rec) {
    var q = rec && rec.quote && rec.quote.total;
    var m = q ? /([\d.]+)\s*(万)?/.exec(String(q)) : null;
    if (m) return Math.round(parseFloat(m[1]) * (m[2] ? 10000 : 1));
    var p = rec ? (rec.price || rec.budget) : null;
    var m2 = p ? /([\d.]+)\s*(万)?/.exec(String(p)) : null;
    if (m2) return Math.round(parseFloat(m2[1]) * (m2[2] ? 10000 : 1));
    return 0;
  }
  function agencyOrderAmountText(rec) {
    var v = agencyOrderAmount(rec);
    if (v <= 0) return '';
    return v >= 10000 ? (' ¥' + (v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) + '万') : (' ¥' + v.toLocaleString());
  }
  byType.agency = {
    label: '中介服务', cta: '立即咨询', ctaLocked: '立即咨询', consultMode: true, inlineLock: true, verified: '机构已认证',
    hero: function (r, c) {
      var d = dirTag(r.dir);
      var base = dHero({ tag: d.txt + ' · ' + r.sub, verifiedHint: (r.verified ? '机构已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: oppMeta(r) });
      var chips = [];
      /* WP4 服务商信用分：详情页服务速览展示 */
      try {
        if (window.svcCreditOf && (r.uid || r.sellerId)) {
          var cr = svcCreditOf(r.uid || r.sellerId, r.id);
          if (cr) chips.push('信用 ' + cr.score + ' · ' + cr.level);
        }
      } catch (e) {}
      if (r.successRate != null) chips.push('成功率 ' + r.successRate + '%');
      if (r.rating != null) chips.push('评分 ' + Number(r.rating).toFixed(1));
      chips.push('不过退款');
      return base + '<div class="hero-grade"><span class="hg-label">服务速览</span><div class="hg-list">' +
        chips.map(function (x) { return '<span class="tag tag-gold">' + x + '</span>'; }).join('') + '</div></div>';
    },
    sections: function (r, c) { return agencyBody(r, c); },
    ctaText: function (r, unlocked) { if (window.__AGENCY_MARKET__) return '在线下单' + agencyOrderAmountText(r); return unlocked ? '电话咨询服务顾问' : '立即咨询'; },
    unlockItems: function () { return ['服务顾问完整电话与微信', '机构详细地址', '一对一办理方案与报价单', '材料模板与合同范本']; },
    lockRows: function () { return []; }
  };
  /* ===== 第二批·第8类 personnel 组件渲染器 ===== */
  /* 组件1：证书要求条 cert-req-bar */
  function personCertBar(r) {
    var cq = r.certReq; if (!cq) return '';
    var h = '<div class="p-certbar">';
    (cq.main || []).forEach(function (m) {
      h += '<div class="pcb-main">' +
        '<div class="pcb-cert"><span class="pcb-name">' + cfgText(m.name) + '</span>' +
          (m.major ? '<span class="pcb-major">' + cfgText(m.major) + '</span>' : '') + '</div>' +
        '<span class="pcb-must">' + (m.required || '必须') + '</span></div>';
    });
    var chips = [];
    if (cq.title) chips.push('<span class="pcb-chip is-title">' + icon('star') + cfgText(cq.title) + '</span>');
    if (cq.bCert) chips.push('<span class="pcb-chip is-b">' + icon('shield') + cfgText(cq.bCert) + '</span>');
    (cq.others || []).forEach(function (o) { chips.push('<span class="pcb-chip">' + icon('check') + cfgText(o) + '</span>'); });
    if (chips.length) h += '<div class="pcb-chips">' + chips.join('') + '</div>';
    h += '</div>';
    return h;
  }
  /* 组件2：薪资结构卡 salary-breakdown-card */
  function personSalaryCard(r) {
    var ss = r.salaryStructure; if (!ss) return '';
    var rows = [
      { k: '基本工资', v: ss.base, w: 58, c: 'var(--primary-dim)' },
      { k: '证书补贴', v: ss.certSubsidy, w: 24, c: 'var(--success)' },
      { k: '项目奖金', v: ss.projectBonus, w: 12, c: 'var(--warning)' },
      { k: '年终绩效', v: ss.annualBonus, w: 6, c: 'var(--info, #2563EB)' }
    ];
    var h = '<div class="p-salary">' +
      '<div class="ps-head"><div><div class="ps-total">' + cfgText(ss.total) + '</div><div class="ps-sub">综合年薪构成（全职）</div></div>' +
      '<span class="ps-free">' + icon('check') + '投递免费</span></div>';
    rows.forEach(function (rw) {
      if (!rw.v) return;
      h += '<div class="ps-row"><div class="ps-row-t"><span>' + rw.k + '</span><b>' + cfgText(rw.v) + '</b></div>' +
        '<div class="ps-track"><div class="ps-fill" style="width:' + rw.w + '%;background:' + rw.c + ';"></div></div></div>';
    });
    if (ss.note) h += '<div class="ps-note">' + icon('info') + '<span>' + cfgText(ss.note) + '</span></div>';
    h += '</div>';
    return h;
  }
  /* 组件3：项目信息卡 project-info-card */
  function personProjectCard(pi) {
    if (!pi) return '';
    var cells = [
      { k: '项目类型', v: pi.projectType }, { k: '担任角色', v: pi.projectRole },
      { k: '项目规模', v: pi.scale }, { k: '项目地点', v: pi.projectLocation || pi.site },
      { k: '项目周期', v: pi.period }
    ];
    var h = '<div class="p-proj">' +
      '<div class="ppj-head">' + icon('scaffold') + '<div><div class="ppj-name">' + cfgText(pi.name) + '</div>' +
      (pi.projectPhase ? '<div class="ppj-phase">' + cfgText(pi.projectPhase) + '</div>' : '') + '</div></div>' +
      '<div class="ppj-grid">';
    cells.forEach(function (c) { if (c.v) h += '<div class="ppj-gi"><span>' + c.k + '</span><b>' + cfgText(c.v) + '</b></div>'; });
    h += '</div></div>';
    return h;
  }
  /* 组件4：投递流程时间线 apply-timeline */
  function personApplyTimeline(steps, applyCount) {
    if (!steps || !steps.length) return '';
    var h = '<div class="p-apply">';
    if (typeof applyCount === 'number') h += '<div class="pa-count">' + icon('recruit') + '<span>已有 <b>' + applyCount + '</b> 人投递 · 招聘进行中</span></div>';
    h += '<div class="pa-track">';
    steps.forEach(function (p, i) {
      var last = i === steps.length - 1;
      h += '<div class="pa-item"><div class="pa-rail"><div class="pa-num">' + p.step + '</div>' +
        (last ? '' : '<div class="pa-line"></div>') + '</div>' +
        '<div class="pa-body' + (last ? ' is-last' : '') + '"><div class="pa-head"><b>' + p.title + '</b>' +
        (p.duration ? '<span class="pa-dur">' + p.duration + '</span>' : '') + '</div>' +
        '<div class="pa-desc">' + p.desc + '</div></div></div>';
    });
    h += '</div></div>';
    return h;
  }
  /* 福利 chips */
  function personBenefits(arr) {
    if (!arr || !arr.length) return '';
    return '<div class="p-benefits">' + arr.map(function (b) {
      return '<span class="pbn">' + icon('check') + cfgText(b) + '</span>';
    }).join('') + '</div>';
  }
  byType.personnel = {
    label: '企业招聘·需求详情', cta: '立即投递', verified: '已认证',
    hero: function (r, c) { return dHero({ tag: '需求 · ' + r.sub, verifiedHint: (r.verified ? '企业已认证' : ''), title: r.title, price: heroPrice(r), unit: r.unit, meta: matchMeta(r) }); },
    sections: function (r, c) {
      var h = '';
      /* 岗位说明 + 证书要求条 */
      var intro = (r.desc ? '<div class="ds-text">' + r.desc + '</div>' : '') + personCertBar(r);
      h += sec('岗位说明与证书要求', intro);
      /* 薪资结构卡 */
      if (r.salaryStructure) h += sec('薪资结构（透明拆解）', personSalaryCard(r));
      /* 岗位与任职要求 */
      h += sec('岗位与任职要求', dList([
        { k: '岗位类型', v: r.jobType },
        { k: '招聘人数', v: r.hireCount },
        { k: '到岗时间', v: r.arrivalTime },
        { k: '学历要求', v: r.educationReq },
        { k: '经验要求', v: r.experienceReq },
        { k: '注册状态要求', v: r.registerStatusReq },
        { k: '社保要求', v: r.socialSecurityReq }
      ]));
      /* 项目信息卡 */
      if (r.projectInfo) h += sec('入职项目信息', personProjectCard(r.projectInfo));
      /* 注册与继续教育 */
      h += sec('注册办理与继续教育', dList([
        { k: '注册协办', v: r.registerHandler },
        { k: '注册周期', v: r.registerCycle },
        { k: '继续教育', v: r.continuingEdu }
      ]));
      /* 企业实力与福利 */
      var comp = dList([
        { k: '企业资质', v: r.companyQual },
        { k: '企业规模', v: r.companyScale }
      ]) + personBenefits(r.benefits);
      h += sec('企业实力与福利待遇', comp);
      /* 招聘流程时间线（免费） */
      if (r.hireProcess && r.hireProcess.length) h += sec('投递与招聘流程', personApplyTimeline(r.hireProcess, r.applyCount));
      /* 该企业在招职位 */
      if (r.companyId && MOCK.personnelsByCompany) {
        var otherJobs = MOCK.personnelsByCompany(r.companyId).filter(function (x) { return x.id !== r.id; });
        if (otherJobs.length) {
          var jobsHtml = '<div class="p-otherjobs">';
          otherJobs.forEach(function (jb) {
            jobsHtml += '<a class="poj" href="detail.html?id=' + jb.id + '"><div class="poj-t">' + jb.title + '</div>' +
              '<div class="poj-m">' + jb.location + ' · ' + (jb.budget || '面议') + ' · ' + (jb.registerStatus || '可转注册') + '</div></a>';
          });
          jobsHtml += '</div>';
          h += sec('该企业在招职位（' + otherJobs.length + '）', jobsHtml);
        }
      }
      /* 平台保障由主流程 guaranteeSec 统一追加，此处不重复渲染 */
      /* 投递说明 */
      if (r.applyHtml) h += sec('投递说明', '<div class="p-applynote">' + icon('shield') + '<span>' + r.applyHtml + '</span></div>');
      return h;
    },
    lockRows: function (r, c) { return []; }
  };
  /* ===== 第二批·第9类 talent 组件渲染器 ===== */
  /* 打码对：明文 + 免费掩码（未解锁显示掩码，解锁原地揭示明文） */
  function tPair(plain, locked, masked) { return Lock.partial(plain, locked, masked); }
  /* 组件1：证书包网格 cert-pack-grid */
  function talentCertGrid(r, locked) {
    var list = r.certPack || [];
    if (!list.length) return '';
    var h = '<div class="t-certs">';
    list.forEach(function (c) {
      var pending = /初始|待注册|资格证/.test(c.registerStatus);
      var regCls = pending ? 'is-pending' : 'is-reg';
      var fullNo = (r.certNo || '').replace(/\*+/, '2019');
      h += '<div class="t-cert">' +
        '<div class="tc-top"><span class="tc-level">' + cfgText(c.certLevel) + '</span>' +
        (c.hasBCert ? '<span class="tc-b" title="带安全生产考核B证">B</span>' : '') +
        '<span class="tc-reg ' + regCls + '">' + cfgText(c.registerStatus) + '</span></div>' +
        '<div class="tc-name">' + cfgText(c.certType) + '</div>' +
        (c.certMajor && c.certMajor !== '—' ? '<div class="tc-major">专业：' + cfgText(c.certMajor) + '</div>' : '') +
        '<div class="tc-foot"><span>' + icon('doc') + '取得 ' + c.issueDate + '</span>' +
        '<span class="tc-no">编号 ' + tPair(fullNo || ('证书' + c.certNoSuffix), locked, '尾号 ' + c.certNoSuffix) + '</span></div>' +
        '</div>';
    });
    h += '</div>';
    return h;
  }
  /* 组件2：注册状态卡 register-status-card */
  function talentRegCard(r, locked) {
    var rs = r.registerStatus; if (!rs) return '';
    var ok = /已注册/.test(rs.status);
    var rem = 3, m = /(\d{4})-/.exec(rs.expireDate);
    if (m) rem = Math.max(0, Math.min(3, parseInt(m[1], 10) - 2026 + 1));
    var w = Math.round(rem / 3 * 100);
    return '<div class="t-reg ' + (ok ? 'is-ok' : 'is-pend') + '">' +
      '<div class="trs-status">' + icon(ok ? 'shield' : 'clock') + '<b>' + cfgText(rs.status) + '</b>' +
      '<span class="trs-major">' + cfgText(rs.registerMajor) + '</span></div>' +
      dList([
        { k: '注册单位', v: tPair(rs.registerUnit, locked, rs.registerUnitMasked) },
        { k: '注册日期', v: rs.registerDate },
        { k: '有效期至', v: rs.expireDate + '（剩余约 ' + rem + ' 年）' },
        { k: '注册专业', v: rs.registerMajor }
      ]) +
      '<div class="trs-bar"><div class="trs-fill" style="width:' + w + '%"></div></div>' +
      '<div class="trs-link">' + icon('external') + '四库一平台可查 · 证书编号比对一致</div>' +
      '</div>';
  }
  /* 组件3：社保情况卡 social-security-card */
  function talentSsCard(r, locked) {
    var ss = r.socialSecurity; if (!ss) return '';
    return '<div class="t-ss">' +
      '<div class="tss-head"><b>' + icon('shield') + cfgText(ss.status) + '</b><span>最近缴纳 ' + ss.lastPayMonth + '</span></div>' +
      dList([
        { k: '缴纳单位', v: tPair(ss.payUnit, locked, ss.payUnitMasked) },
        { k: '社保转移', v: ss.canTransfer ? '可转出，配合转入单位办理' : '暂不可转' },
        { k: '唯一社保', v: ss.uniqueSocial ? '承诺唯一社保，无多头参保' : '需进一步核实' }
      ]) +
      '<div class="tss-badges">' +
        (ss.uniqueSocial ? '<span class="is-uq">' + icon('check') + '唯一社保</span>' : '') +
        (ss.canTransfer ? '<span class="is-tr">' + icon('chev-r') + '可转社保</span>' : '') +
      '</div></div>';
  }
  /* 组件4：解锁价格面板 unlock-price-panel */
  function talentPricePanel(r) {
    var up = r.unlockPrice; if (!up) return '';
    var content = (up.unlockContent || []).map(function (x) { return '<li>' + icon('check') + x + '</li>'; }).join('');
    var packs = (up.packOptions || []).map(function (p) {
      return '<div class="tup-pack" data-pw-unlock><div class="tp-count">' + p.count + ' 条线索包</div>' +
        '<div class="tp-price">¥' + p.price + '</div><div class="tp-unit">折合 ¥' + p.unit.toFixed(2) + '/条</div></div>';
    }).join('');
    return '<div class="t-unlock">' +
      '<div class="tup-top"><div class="tup-price"><span class="cur">¥</span><span class="amt">' + up.singlePrice + '</span>' +
      '<span class="orig">¥' + up.originalPrice + '</span></div>' +
      '<span class="tup-tag">单条解锁 · 7天有效</span></div>' +
      '<div class="tup-packs">' + packs + '</div>' +
      '<div class="tup-content"><div class="tup-ct">' + icon('lock') + '解锁后可见 7 项</div><ul>' + content + '</ul></div>' +
      '<button class="tup-btn" data-pw-unlock>' + icon('lock') + '立即解锁 · 查看完整简历与联系方式</button>' +
      '<div class="tup-foot">安全支付 · 未对接可退 · 企业端付费，人才免费发布</div>' +
      '</div>';
  }
  /* 组件5：工作履历时间线 work-history-timeline */
  function talentWorkTimeline(r, locked) {
    var list = r.workHistory || [];
    if (!list.length) return '';
    var h = '<div class="t-work">';
    list.forEach(function (w, i) {
      var last = i === list.length - 1;
      h += '<div class="tw-item"><div class="tw-rail"><div class="tw-dot"></div>' + (last ? '' : '<div class="tw-line"></div>') + '</div>' +
        '<div class="tw-body' + (last ? ' is-last' : '') + '">' +
          '<div class="tw-top"><b>' + tPair(w.company, locked, w.companyMasked) + '</b><span class="tw-pos">' + cfgText(w.position) + '</span></div>' +
          '<div class="tw-time">' + w.startDate + ' — ' + w.endDate + ' · ' + cfgText(w.industry) + '</div>' +
          '<div class="tw-sum">' + cfgText(w.summary) + '</div>' +
          '<div class="tw-detail">' + Lock.full(w.detail, locked) + '</div>' +
        '</div></div>';
    });
    return h + '</div>';
  }
  /* 项目经验（项目名/详情打码） */
  function talentProjects(r, locked) {
    var list = r.projectExperience || [];
    if (!list.length) return '';
    var h = '<div class="t-projexp">';
    list.forEach(function (x) {
      h += '<div class="tpe-item">' +
        '<div class="tpe-head"><b>' + tPair(x.projectName, locked, x.projectNameMasked) + '</b><span class="tpe-role">' + cfgText(x.role) + '</span></div>' +
        '<div class="tpe-meta">' + cfgText(x.projectType) + ' · ' + cfgText(x.projectScale) + ' · ' + x.startDate + '—' + x.endDate + '</div>' +
        '<div class="tpe-free">' + cfgText(x.description) + '</div>' +
        '<div class="tpe-detail">' + Lock.full(x.detail, locked) + '</div>' +
      '</div>';
    });
    return h + '</div>';
  }
    function talentHero(r) {
    var tags = '';
    if (r.verified) tags += '<span class="th-tag is-verified"><svg class="ic"><use href="#i-check"/></svg>证书已核验</span>';
    tags += '<span class="th-tag is-gold">' + cfgText((r.certLevel || '') + r.certType) + '</span>';
    if (r.currentStatus) tags += '<span class="th-tag ' + (r.currentStatus.indexOf('离职') > -1 ? 'is-left' : 'is-active') + '">' + r.currentStatus + '</span>';
    var es = r.expectedSalary || {};
    var metrics = [];
    if (r.workYears || r.experience) metrics.push({ label: '工作年限', value: (r.workYears || r.experience) + '年' });
    if (r.location) metrics.push({ label: '所在城市', value: r.location });
    if (es.salaryRange) metrics.push({ label: '期望薪资', value: es.salaryRange });
    if (r.resumeActive) metrics.push({ label: '求职状态', value: r.resumeActive });
    var metricsHtml = metrics.map(function (m) {
      return '<div class="th-metric"><div class="thm-val">' + m.value + '</div><div class="thm-label">' + m.label + '</div></div>';
    }).join('');
    return '<div class="talent-hero">' +
      '<div class="th-bg"></div>' +
      '<div class="th-content">' +
        '<div class="th-top">' +
          '<div class="th-avatar">' + (r.avatar || '') + '</div>' +
          '<div class="th-info">' +
            '<div class="th-name">' + r.nameMasked + '<span class="th-note">完整姓名付费可见</span></div>' +
            '<div class="th-title">' + r.title + '</div>' +
            '<div class="th-tags">' + tags + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="th-metrics">' + metricsHtml + '</div>' +
      '</div>' +
    '</div>';
  }
  function talentBody(r, c) {
    var locked = !UnlockStore.isUnlocked(r);
    var h = '';
    /* 求职意向与自我评价 */
    var intent = '<div class="ds-text">' + r.desc + '</div>' +
      dList([
        { k: '求职状态', v: r.currentStatus }, { k: '期望岗位', v: r.expectedPosition },
        { k: '到岗时间', v: (r.expectedSalary || {}).arrivalTime || r.arrivalTime },
        { k: '可工作地区', v: r.workArea }, { k: '语言能力', v: r.languageSkill }
      ]) +
      (r.selfEvaluation ? '<div class="t-self">' + icon('info') + '<span>' + r.selfEvaluation + '</span></div>' : '');
    h += sec('求职意向与自我评价', intent);
    /* 证书包 */
    h += sec('持有证书（' + (r.certPack || []).length + ' 本）', talentCertGrid(r, locked));
    /* 期望薪资 */
    var es = r.expectedSalary || {};
    h += sec('期望薪资', dList([
      { k: '期望范围', v: es.salaryRange, highlight: true },
      { k: '最低可接受', v: Lock.price(es.minAcceptable, locked, '解锁查看底价') },
      { k: '证书补贴期望', v: es.certSubsidyExpect },
      { k: '到岗时间', v: es.arrivalTime }
    ]));
    /* 注册状态 */
    h += sec('注册状态', talentRegCard(r, locked));
    /* 社保情况 */
    h += sec('社保情况', talentSsCard(r, locked));
    /* 工作履历 */
    h += sec('工作履历（概要免费）', talentWorkTimeline(r, locked));
    /* 项目经验 */
    h += sec('项目经验（概要免费）', talentProjects(r, locked));
    /* 教育背景 */
    var edu = r.education || {};
    h += sec('教育背景', dList([
      { k: '学历层次', v: edu.level },
      { k: '毕业院校', v: tPair(edu.school + ' ' + edu.major, locked, edu.schoolMasked) },
      { k: '所学专业', v: edu.major }, { k: '毕业年份', v: edu.graduateYear }
    ]));
    /* 联系方式（核心付费区） */
    var ct = r.contact || {};
    h += sec('联系方式（付费解锁）', '<div class="t-contact">' +
      dList([
        { k: '姓名', v: tPair(r.name, locked, r.nameMasked) },
        { k: '联系电话', v: tPair(ct.phone, locked, ct.phoneMasked) },
        { k: '微信号', v: tPair(ct.wechat, locked, ct.wechatMasked) },
        { k: '居住区域', v: cfgText(r.address) },
        { k: '详细地址', v: Lock.price(r.addressDetail, locked, '解锁查看详细地址') }
      ]) + Lock.inline(locked, '解锁与对方沟通权限', '单条 29 积分 · 7天有效 · 未对接可退', '29 积分') + '</div>'); /* [FIX BM-012/BM-013] ¥29 改 29 积分，清除「查看姓名/手机/微信」表述 */
    /* 基本信息 */
    h += sec('基本信息与核验', dList([
      { k: '工作年限', v: r.workYears }, { k: '年龄范围', v: r.ageRange }, { k: '性别', v: r.gender },
      { k: '所在地区', v: r.location }, { k: '简历活跃', v: r.resumeActive },
      { k: '证书核验', v: r.certVerified, highlight: true }
    ]));
    /* 解锁价格面板 */
    h += sec('解锁完整简历', talentPricePanel(r));
    /* 相似人才推荐 */
    if (MOCK.byBizType) {
      var similar = MOCK.byBizType('talent').filter(function (x) { return x.id !== r.id && x.certType === r.certType; }).slice(0, 2);
      if (!similar.length) similar = MOCK.byBizType('talent').filter(function (x) { return x.id !== r.id; }).slice(0, 2);
      if (similar.length) {
        var simHtml = '<div class="t-similar">';
        similar.forEach(function (x) {
          var xp = x.expectedSalary || {};
          simHtml += '<a class="tsim" href="detail.html?id=' + x.id + '">' +
            '<div class="tsim-av">' + (x.avatar || '') + '</div>' +
            '<div class="tsim-b"><div class="tsim-t">' + (x.nameMasked || x.name) + ' · ' + x.title + '</div>' +
            '<div class="tsim-m">' + x.location + ' · ' + (x.workYears || x.experience) + '经验 · ' + (xp.salaryRange || '面议') + '</div></div>' +
            '<div class="tsim-p">¥' + ((x.unlockPrice || {}).singlePrice || 29) + '</div></a>';
        });
        simHtml += '</div>';
        h += sec('相似人才推荐', simHtml);
      }
    }
    return h;
  }
  byType.talent = {
    label: '人才简历详情', cta: '立即解锁', verified: '证书已核验', inlineLock: true,
    ctaText: function (r, unlocked) { return unlocked ? '沟通权限已开通' : payGoLabel(unlockPriceOf(r)); }, /* [FIX BM-013] 已解锁 CTA 不再说「查看联系方式」 */
    hero: talentHero,
    sections: function (r, c) { return talentBody(r, c); },
    unlockItems: function () { return ['真实姓名', '手机号', '微信号', '注册单位全称', '完整工作履历', '项目详情', '学历院校']; },
    lockRows: function () { return []; }
  };
  /* ---- 联系方式锁定区 (统一 · 单次价格解锁) ---- */
  /* M3：积分体系单条成本（R3/R4）。trade=保证金不走积分；agency/personnel=免费留资/投递；
     franchise=资质招商分级积分（t1 49/t2 39/t3 29，按招商子类映射）；其余按 credits.consume 扣积分 */
  function franchiseTier(rec) {
    var sub = (rec && (rec.sub || rec.cat)) || '';
    if (/施工总承包|电力|特级/.test(sub)) return 't1';
    if (/专业承包|加盟|供应链|联盟|其他/.test(sub)) return 't3';
    return 't2'; /* 水利/公路、工程设计、监理/造价、市政公用等 */
  }
  function unlockPriceOf(rec) {
    var cons = (MOCK.business.credits || {}).consume || {};
    var key = rec && rec.bizKey;
    if (key === 'talent') return { price: cons.talent || 29, original: null, tiered: false, mode: 'credit' };
    if (key === 'trade') return { price: (MOCK.business.credits || {}).tradeDeposit || 5000, original: null, tiered: false, mode: 'deposit' };
    if (key === 'agency' || key === 'personnel') return { price: 0, original: null, tiered: false, mode: 'free' };
    if (key === 'franchise') {
      var ft = cons.franchise || { t1: { price: 49, original: 99 }, t2: { price: 39, original: 79 }, t3: { price: 29, original: 59 } };
      var tk = franchiseTier(rec); var tier = ft[tk] || ft.t1;
      var pr = (typeof tier === 'object') ? tier.price : tier;
      var orig = (typeof tier === 'object') ? tier.original : null;
      return { price: pr, original: orig, tiered: !!orig, tierKey: tk, mode: 'credit' };
    }
    var cost = (cons[key] && typeof cons[key] === 'object') ? (cons[key].t1 && cons[key].t1.price) || 49 : (cons[key] || cons.material || 98);
    return { price: cost, original: null, tiered: false, mode: 'credit' };
  }
  /* M3：本用户可用免费解锁额度（实名及以上每月 freeQuota.monthly 条；破冰期注册赠 registerBonus 计入当月） */
  function freeQuotaInfo() {
    var st = window.deriveStatus ? deriveStatus() : 'registered';
    var allow = (st === 'realname' || st === 'pro' || st === 'enterprise' || st === 'resident' || st === 'partner');
    var monthly = (MOCK.business.credits && MOCK.business.credits.freeQuota) ? MOCK.business.credits.freeQuota.monthly : 5;
    if (window.ModeStore && ModeStore.isBreakIn()) monthly += ((MOCK.business.breakin || {}).registerBonus) || 0;
    var used = window.CreditStore ? CreditStore.freeUsed() : 0;
    return { allow: allow, remain: allow ? Math.max(monthly - used, 0) : 0, used: used, monthly: monthly };
  }
  /* G2：破冰期游客免费完整示例条数（guestSample），localStorage 持久化已用计数 */
  function guestSampleInfo() {
    var breakin = (window.ModeStore && ModeStore.isBreakIn());
    var total = breakin ? (((MOCK.business.breakin || {}).guestSample) || 0) : 0;
    if (!total) return { available: false, used: 0, total: 0, items: [] };
    var KEY = 'engchain-guest-unlocks';
    var rec = null;
    try { rec = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!rec || typeof rec !== 'object') rec = { count: 0, items: [] };
    var used = rec.count || 0;
    return { available: used < total, used: used, total: total, items: rec.items || [], key: KEY, rec: rec };
  }
  function guestSampleSpend(recId) {
    var info = guestSampleInfo();
    if (!info.available) return false;
    var rec = info.rec || { count: 0, items: [] };
    rec.count = (rec.count || 0) + 1;
    if (recId && rec.items.indexOf(recId) < 0) rec.items.push(recId);
    try { localStorage.setItem(info.key, JSON.stringify(rec)); } catch (e) {}
    return true;
  }
  function creditDiscountRate() { return window.creditDiscount ? creditDiscount() : 1; }
  /* [FIX BM-015] 积分↔人民币溢价系数，收敛到 MOCK.business.credits.cnyToCreditRate；data.js 未配置时默认 1.28 */
  function creditToCnyRate() {
    var r = (MOCK.business.credits || {}).cnyToCreditRate;
    return (typeof r === 'number' && r > 0) ? r : 1.28;
  }
  /* 转化漏斗前置门（手册§8.2）：游客→登录/注册；注册未实名→免费实名认证；实名及以上直接放行 */
  function identityGate() {
    var st = window.deriveStatus ? deriveStatus() : 'registered';
    var authed = (st === 'realname' || st === 'pro' || st === 'enterprise' || st === 'resident' || st === 'partner');
    if (authed) return { pass: true };
    /* P1-1：统一以 deriveIdentity().isGuest 为权威来源，localStorage.status 仅作回退 */
    var isGuest = false;
    try { if (window.deriveIdentity) { isGuest = !!deriveIdentity().isGuest; } else { var _d = JSON.parse(localStorage.getItem('engchain-state') || '{}'); isGuest = _d.status === 'guest'; } } catch (e) { try { var _d2 = JSON.parse(localStorage.getItem('engchain-state') || '{}'); isGuest = _d2.status === 'guest'; } catch (e2) {} }
    return { pass: false, isGuest: isGuest, label: isGuest ? '登录 / 注册后解锁完整信息' : '实名认证后免费解锁' };
  }
  function gateAct(g) {
    if (g.pass) return true;
    var freeN = ((MOCK.business.credits || {}).freeQuota || {}).monthly || 5;
    if (g.isGuest) {
      UI.dialog({
        title: '登录后查看完整信息',
        text: '注册登录后可浏览公开详情、收藏与限量发布；完成<b>免费实名认证</b>后，每月还可享 ' + freeN + ' 条免费解锁额度。',
        ok: '去登录 / 注册', cancel: '再看看',
        onOk: function () { location.href = '../../pages/auth/login.html'; }
      });
    } else {
      UI.dialog({
        title: '完成实名认证后解锁',
        text: '<b>实名认证免费</b>，完成后每月享 ' + freeN + ' 条免费解锁额度，也可使用积分解锁更多信息。',
        ok: '去实名认证', cancel: '再看看',
        onOk: function () { location.href = '../../pages/profile/auth.html'; }
      });
    }
    return false;
  }
  function payGoLabel(up) {
    if (up.mode === 'free') return '免费解锁';
    if (up.mode === 'deposit') return '支付保证金 ¥' + Number(up.price).toLocaleString();
    /* [FEAT 9.2-1] 年度会员：详情免费解锁，不消耗积分 */
    if (window.MemberStore && MemberStore.isActive() && up.mode === 'credit') return '年度会员免费解锁';
    /* [FEAT 9.2-4] 每日免费浏览摘要额度提示 */
    var dqRemain = (window.FreeQuotaStore) ? FreeQuotaStore.remaining() : 0;
    if (dqRemain > 0 && up.mode === 'credit') return '今日免费解锁（剩 ' + dqRemain + ' 条）';
    var fq = freeQuotaInfo();
    if (fq.allow && fq.remain > 0) return '免费解锁（本月剩 ' + fq.remain + ' 条）';
    var bal = window.CreditStore ? CreditStore.read().balance : 0;
    var cost = Math.round(up.price * creditDiscountRate());
    if (bal >= cost) return '扣 ' + cost + ' 积分解锁（余额 ' + bal + '）';
    return '积分不足 · 去充值';
  }
  function lockHtml(rows, rec) {
    var cur = (MOCK.business.credits && MOCK.business.credits.currency) || '积分'; /* [FIX BM-012] 不再读 unlock.currency(¥)，统一用 credits.currency=积分 */
    var up = unlockPriceOf(rec);
    var price = up.price.toLocaleString();
    var badge = '<span class="la-badge">' + rows.length + ' 项</span>';
    var label = '<div class="la-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-lock"/></svg>核心信息<span class="unlocked-badge">· 已解锁</span></div>';
    var rowsHtml = rows.map(function (x) { return '<div class="la-row"><span class="k">' + x.k + '</span><span class="v masked">' + x.v + '</span></div>'; }).join('');
    var origHtml = up.tiered ? '<span style="font-size:12px;color:var(--text-3);text-decoration:line-through;margin-left:6px;">' + up.original + ' 积分</span>' : ''; /* [FIX BM-012] 划线原价与现价同为积分单位 */
    /* [FIX E1-16/E2-20/E3-8] 锁区价格体现入驻折扣/年度会员/破冰恢复原价；[FIX E2-07] 取消伪造人数 */
    var _disc = creditDiscountRate();
    var _discNum = Math.round(_disc * 100) / 10;
    var _isAnnualLock = !!(window.MemberStore && MemberStore.isActive() && up.mode === 'credit');
    var _priceShow = Math.round(up.price * (_disc < 1 ? _disc : 1));
    var price = _priceShow.toLocaleString();
    var priceBadge = _isAnnualLock ? '<span style="font-size:11px;color:var(--success);font-weight:600;margin-left:6px;">会员免费解锁</span>' : (_disc < 1 ? '<span style="font-size:11px;color:var(--primary-dim);font-weight:600;margin-left:6px;">入驻' + _discNum + '折</span>' : '');
    var calcLine = (_disc < 1 && up.price) ? '<div style="font-size:10px;color:var(--text-3);margin-top:2px;">原价 ' + up.price + ' 积分 × ' + _disc + ' = ' + _priceShow + ' 积分</div>' : '';
    var breakNote = (window.ModeStore && ModeStore.isBreakIn() && (up.original || up.price)) ? '<div style="font-size:10px;color:var(--accent);margin-top:2px;">限时优惠 · 正式期恢复原价 ' + (up.original || up.price) + ' 积分</div>' : '';
    var _uc = 0; try { _uc = Object.keys(UnlockStore._read()).length; } catch (e) {}
    var socialText = _uc > 0 ? ('已有 ' + _uc + ' 位同行解锁') : '已有多位同行解锁';
    return '<div class="lock-area" id="lock-area">' +
      '<div class="la-head">' + label + badge + '</div>' +
      '<div class="la-body">' + rowsHtml + '</div>' +
      '<div class="la-paywall" id="paywall">' +
        '<div class="lp-head"><div class="lp-head-left"><div class="lp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-lock"/></svg></div><div class="lp-text"><div class="lp-title">解锁查看全部核心信息</div><div class="lp-subtitle">已隐藏 ' + rows.length + ' 项核心信息 · 解锁后完全公开</div></div></div>' +
        '<div class="lp-price"><span class="lp-currency">' + cur + '</span><span class="lp-amount">' + price + '</span>' + origHtml + priceBadge + '</div>' + calcLine + breakNote + '</div></div>' +
        '<div class="lp-benefits"><span class="lp-benefit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-check"/></svg>即时解锁</span><span class="lp-benefit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-check"/></svg>安全支付</span><span class="lp-benefit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-check"/></svg>未对接可退</span></div>' +
        '<div class="lp-foot"><div class="lp-social">' + socialText + '</div><div class="lp-trust"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-shield"/></svg>安全加密</div></div>' +
      '</div></div>';
  }
  /* ---- 投递引导区 (企业招聘详情 · 替代付费墙) ---- */
  function applyHtml(rec) {
    return '<div class="apply-area" id="apply-area">' +
      '<div class="aa-head">' +
        '<div class="aa-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></div>' +
        '<div class="aa-text"><div class="aa-title">投递简历后可查看联系方式</div><div class="aa-subtitle">为保护双方隐私，企业确认感兴趣后由平台对接</div></div>' +
      '</div>' +
      '<div class="aa-steps">' +
        '<div class="aa-step"><div class="aa-step-num">1</div><div class="aa-step-text">填写基本信息与证书情况</div></div>' +
        '<div class="aa-step-arrow"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>' +
        '<div class="aa-step"><div class="aa-step-num">2</div><div class="aa-step-text">企业24小时内查看并反馈</div></div>' +
        '<div class="aa-step-arrow"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>' +
        '<div class="aa-step"><div class="aa-step-num">3</div><div class="aa-step-text">双方感兴趣后平台对接</div></div>' +
      '</div>' +
      '<div class="aa-trust"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>平台担保</span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>隐私保护</span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>免费投递</span></div>' +
    '</div>';
  }
  function actionbarHtml(cta) {
    var bookmark = '<button class="dab-icon" data-act="fav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-fav"/></svg></button>';
    var share = '<button class="dab-icon" data-act="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><use href="#i-share"/></svg></button>';
    var ctaBtn = '<button class="dab-cta" id="cta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' + cta + '</button>';
    return bookmark + share + ctaBtn;
  }
  function notFoundHtml() {
    return '<div class="empty-state">' +
      '<div class="e-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>' +
      '<div class="e-title">未找到该条目</div>' +
      '<div class="e-desc">该信息可能已下架，或类型与链接不匹配<br>返回上一页重新浏览</div>' +
      '<button onclick="history.back()" style="margin-top:18px;padding:10px 28px;border-radius:var(--r-full);border:none;background:linear-gradient(135deg,var(--primary),var(--primary-dim));color:var(--text-inv);font-size:13px;font-weight:600;cursor:pointer;">返回上一页</button>' +
      '</div>';
  }
  /* ---- 组装 + 交互 ---- */
  /* UX-FIX：企业认证卡按本条发布方解析，避免张冠李戴到示例企业 c-znzjs。
     - franchise(资质招商)/trade(建企买卖)：本条即标的企业本体，用本条自报企业名覆盖代发机构；
     - talent(个人求职)：由 talentCertHtml 渲染个人卡，不复用企业 GEO 模板。 */
  function resolveCertCompany(rec) {
    var base = MOCK.companyById(rec.companyId) || {};
    if (rec.bizKey === 'franchise' && rec.name) {
      return Object.assign({}, base, { name: rec.name, short: rec.short || rec.name, industry: rec.qualCategory || rec.qualType || '建筑施工', regCapital: rec.capital || base.regCapital, founded: rec.founded || base.founded });
    }
    if (rec.bizKey === 'trade' && (rec.maskedName || rec.title)) {
      var nm = rec.maskedName || rec.title;
      return Object.assign({}, base, { name: nm, short: nm.slice(0, 6), industry: rec.sub || '股权转让' });
    }
    return base;
  }
  function talentCertHtml(rec) {
    var nm = rec.nameMasked || rec.name || '持证人才';
    var meta = [rec.certLevel, rec.certMajor].filter(Boolean).join(' · ');
    return '<div class="cert-card cert-card--compact"><div class="cert-header">' +
      '<div class="cert-badge-wrap"><div class="cert-seal">' + UI.icon('award', '') + '</div>' +
      '<div class="cert-badge-text"><div class="cert-badge-title">' + UI.esc(nm) + '</div>' +
      '<div class="cert-badge-sub">个人持证人才 · 简历信息已核验</div>' +
      '<div class="cert-badge-meta">' + UI.esc(meta || rec.title || '') + '</div></div></div></div>';
  }
  function attach(rec) {
    sweepTradeDeposits(); /* [FIX BM-010] 每次进入详情页清扫已过 30 天 TTL 的保证金并解冻退还 */
    var t = byType[rec.bizKey];
    if (!t) {
      /* P0：bizKey 异常时不张冠李戴到其他类别（历史上会错误回退到材料详情），直接空状态 */
      var ntNf = document.getElementById('nav-title'); if (ntNf) ntNf.textContent = '内容不存在';
      var abNf = document.getElementById('actionbar'); if (abNf) abNf.style.display = 'none';
      var bxNf = document.querySelector('.scroll'); if (bxNf) bxNf.innerHTML = notFoundHtml();
      return;
    }
    /* 人才详情：派生求职状态（数据层未定义时按索引/到岗时间推断） */
    if (rec.bizKey === 'talent' && !rec.jobStatus) {
      var talentIdx = (MOCK.talents || []).findIndex(function (x) { return x.id === rec.id; });
      var statuses = ['在职·考虑机会', '离职·立即到岗', '在职·考虑机会', '在职·暂不考虑', '离职·立即到岗', '在职·考虑机会'];
      rec.jobStatus = talentIdx >= 0 ? statuses[talentIdx % statuses.length] : '在职·考虑机会';
    }
    var c = resolveCertCompany(rec);
    var $ = function (id) { return document.getElementById(id); };
    DETAIL._currentRec = rec;
    /* P0：从持久化恢复解锁态，并由 .phone.is-unlocked 驱动全页就近打码去码 */
    var unlocked = UnlockStore.isUnlocked(rec);
    var phoneEl = document.querySelector('.phone');
    if (phoneEl) phoneEl.classList.toggle('is-unlocked', !!unlocked);
    if ($('nav-title')) $('nav-title').textContent = t.label;
    if ($('hero')) $('hero').innerHTML = t.hero(rec, c);
    if ($('cert')) {
      var home = (rec.bizKey === 'talent' || rec.bizKey === 'franchise' || rec.bizKey === 'trade') ? null : ('../company/index.html?id=' + c.id);
      $('cert').innerHTML = rec.bizKey === 'talent' ? talentCertHtml(rec) : UI.certCard(c, { home: home, compact: true });
      var cc = $('cert').querySelector('.cert-card--compact');
      if (cc && rec.bizKey !== 'talent') {
        var openCert = function () { UI.certModal(c, { home: home }); };
        cc.addEventListener('click', function (e) { if (e.target.closest('.cert-home')) return; openCert(); });
        cc.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCert(); } });
      }
    }
    var __bodyHtml = t.sections(rec, c) + guaranteeSec(rec) + relatedSec(rec);
    if ($('body')) $('body').innerHTML = __bodyHtml;
    if ($('lock')) {
      /* [FIX E1-06] applyHtml 仅招聘类(personnel/talent)渲染，其余 7 类不渲染，避免遮挡解锁 CTA */
      var _RECRUIT_BIZ = { personnel: 1, talent: 1 };
      if (_RECRUIT_BIZ[rec.bizKey]) {
        $('lock').innerHTML = applyHtml(rec);
      } else if (t.inlineLock) {
        /* 就近打码类：联系方式已嵌入信息卡，页面不再出现底部集中锁定区 */
        $('lock').innerHTML = '';
      } else {
        $('lock').innerHTML = lockHtml(t.lockRows(rec, c), rec);
      }
    }
    /* P0：已解锁（含刷新后从持久化恢复）时，初始化即展开集中锁定区，保证已解锁用户看到明文 */
    if (unlocked) {
      var __la = $('lock-area');
      if (__la) {
        __la.classList.add('unlocked');
        var __lb = __la.querySelector('.la-body');
        if (__lb) { __lb.style.transition = 'none'; __lb.style.maxHeight = Math.max(__lb.scrollHeight, 200) + 'px'; __lb.style.opacity = '1'; __lb.style.overflow = 'visible'; }
      }
    }
    var payw = MOCK.business.unlock;
    var up = unlockPriceOf(rec);
    var price = up.price.toLocaleString();
    var cur = (MOCK.business.credits && MOCK.business.credits.currency) || '积分'; /* [FIX BM-012] 不再读 unlock.currency(¥)，统一积分 */
    /* 底部主按钮文案：付费/积分类对游客与未实名用户先做登录/实名引导；就近打码类未解锁显示「立即解锁 ¥XX」，解锁后切换为对接动作；免费留资/投递类沿用原 CTA */
    var gate = identityGate();
    var needGate = !unlocked && rec.bizKey !== 'personnel' && rec.bizKey !== 'agency' && rec.bizKey !== 'franchise';
    /* P1-1：成熟期（非破冰期）游客主体全打码 —— 标题可见，主体参数/描述/联系方式全部遮罩 + 登录引导 CTA */
    var isMatureGuest = !unlocked && gate.isGuest && !(window.ModeStore && ModeStore.isBreakIn());
    if (isMatureGuest) {
      /* ① Hero 区：标题保留可见，预算/价格、位置/城市打码为"登录后查看" */
      if ($('hero')) {
        var priceRow = $('hero').querySelector('.dh-price-row');
        if (priceRow) priceRow.innerHTML = '<span class="dh-price" style="color:var(--text-3);">登录后查看</span>';
        var metaEl = $('hero').querySelector('.dh-meta');
        if (metaEl) {
          var metaItems = metaEl.querySelectorAll('.dh-meta-item');
          metaItems.forEach(function (mi) {
            if (mi.textContent.indexOf('浏览') < 0 && mi.textContent.indexOf('匹配') < 0) {
              mi.innerHTML = '<span style="color:var(--text-3);">登录后查看</span>';
            }
          });
        }
      }
      /* ② Body 区：整体模糊遮罩 + 登录引导 */
      if ($('body')) {
        var __mgBody = $('body');
        var __mgOrig = __mgBody.innerHTML;
        var __mgRegBonus = (((MOCK.business.credits || {}).rewards) || {}).register || 50;
        __mgBody.innerHTML =
          '<div style="position:relative;overflow:hidden;border-radius:12px;">' +
            '<div style="filter:blur(7px);-webkit-filter:blur(7px);pointer-events:none;user-select:none;-webkit-user-select:none;opacity:.5;transform:scale(1.02);">' + __mgOrig + '</div>' +
            '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:36px 24px;text-align:center;background:linear-gradient(180deg,rgba(20,24,30,.35) 0%,rgba(20,24,30,.55) 100%);border-radius:12px;">' +
              '<div style="width:54px;height:54px;border-radius:15px;background:rgba(201,169,97,.15);border:1px solid rgba(201,169,97,.3);display:flex;align-items:center;justify-content:center;">' +
                '<svg class="ic" style="width:24px;height:24px;color:var(--primary);"><use href="#i-lock"/></svg>' +
              '</div>' +
              '<div class="fw-700 fs-16" style="color:#F5F1E8;">登录后查看完整信息</div>' +
              '<div class="fs-12" style="color:rgba(245,241,232,.7);line-height:1.8;">预算 · 位置 · 联系方式 · 详细描述<br>等主体信息需登录后查看</div>' +
              '<button class="btn btn-primary" style="padding:10px 36px;font-size:14px;" onclick="location.href=\'../../pages/auth/login.html\'">登录 / 注册</button>' +
              '<div class="fs-11" style="color:rgba(245,241,232,.5);">注册即送 ' + __mgRegBonus + ' 积分 · 实名认证每月享免费解锁</div>' +
            '</div>' +
          '</div>';
      }
      /* ③ Lock 区：隐藏底部解锁区（成熟期游客不可用任何解锁入口） */
      if ($('lock')) $('lock').style.display = 'none';
    }
    /* G2：破冰期游客免费示例条数 */
    var gs = guestSampleInfo();
    var guestFreeAvail = needGate && gate.isGuest && gs.available;
    /* P1-3：personnel CTA 按身份状态前置提示，避免点击后才拦截 */
    function personnelCta() {
      try {
        if (gate.isGuest) return '登录后投递';
        if (window.DataBus && DataBus.canDeliverResume) {
          var r = DataBus.canDeliverResume();
          if (r.can) return '立即投递';
          if (r.reason && r.reason.indexOf('简历') >= 0) return '完善简历后投递';
          return '完成入驻后投递';
        }
      } catch (e) {}
      return '立即投递';
    }
    /* P1-3：personnel 始终走动态 CTA（isFree已解锁不等于可投递，需单独检查投递权限） */
    var ctaText = (rec.bizKey === 'personnel')
      ? personnelCta()
      : (window.__AGENCY_MARKET__ && rec.bizKey === 'agency'
          ? ('在线下单' + agencyOrderAmountText(rec))
          : (unlocked
          ? (t.ctaText ? t.ctaText(rec, true) : (t.cta || '联系TA'))
          : (guestFreeAvail
              ? '免费查看（游客福利 ' + (gs.used + 1) + '/' + gs.total + '）'
              : ((needGate && !gate.pass)
                  ? gate.label
                  : (t.inlineLock ? (t.ctaLocked || payGoLabel(up)) : t.cta)))));
    if ($('actionbar')) $('actionbar').innerHTML = actionbarHtml(ctaText);
    /* [FIX BM-043] 已解锁（含刷新恢复）时 CTA 立即变绿；并监听解锁事件实时切换底色 */
    var __ctaEl = $('cta'); if (__ctaEl && unlocked) __ctaEl.classList.add('is-unlocked');
    window.addEventListener('engchain-unlock-changed', function () {
      var c = $('cta'); if (c) c.classList.toggle('is-unlocked', UnlockStore.isUnlocked(rec));
    });
    /* [FIX BM-016] 向 FileDownload 注入解锁态校验：未解锁的打码文件禁止直接下载，唤起付费 Sheet */
    if (window.FileDownload) {
      window.FileDownload.checkUnlock = function () { return UnlockStore.isFree(rec.bizKey) || UnlockStore.isUnlocked(rec); };
      window.FileDownload.onUnlockRequired = function () { tryUnlock(); };
      window.FileDownload.onView = function (rec) { if (rec && rec.name) DETAIL.viewPdf(rec.name); };
    }
    var origLine = up.tiered ? '<span style="font-size:13px;color:var(--text-3);text-decoration:line-through;margin-left:8px;">' + up.original + ' 积分</span>' : ''; /* [FIX BM-012] 划线原价改积分单位 */
    function openPay() {
      var lockRows = t.lockRows(rec, c);
      /* 就近打码类 lockRows 为空，改用该类声明的「将解锁内容」清单；其余类沿用集中锁定行 */
      var itemNames = (t.inlineLock && t.unlockItems) ? t.unlockItems(rec) : lockRows.map(function (x) { return x.k; });
      var chips = itemNames.map(function (x) { return '<span class="chip">' + x + '</span>'; }).join('');
      /* 仅招商加盟类详情页：解锁弹窗中加入加盟流程 */
      var processHtml = '';
      if (rec.bizKey === 'franchise') {
        var process = (MOCK.business.unlock && MOCK.business.unlock.process) || [];
        if (process.length) {
          processHtml = '<div style="margin-top:16px;text-align:left;">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:8px;display:flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-dim)" style="width:13px;height:13px;"><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4"/><path d="M9 11V5a3 3 0 0 1 6 0v6"/></svg>加盟流程（' + process.length + '步）</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
            process.map(function (p) {
              return '<div style="background:var(--bg-card-2);border-radius:8px;padding:8px 6px;text-align:center;">' +
                '<div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dim));color:var(--text-inv);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;font-family:var(--font-num);box-shadow:0 1px 4px -1px var(--primary-dim);">' + p.step + '</div>' +
                '<div style="font-size:10.5px;font-weight:600;color:var(--text-1);line-height:1.3;">' + p.title + '</div>' +
                '<div style="font-size:9px;color:var(--text-3);line-height:1.3;margin-top:2px;">' + (p.desc || '') + '</div>' +
              '</div>';
            }).join('') +
            '</div></div>';
        }
      }
      /* 仅建企买卖类详情页：解锁弹窗中加入转让流程和保证金说明 */
      var tradeProcessHtml = '';
      var depositHtml = '';
      if (rec.bizKey === 'trade') {
        if (rec.transferProcess && rec.transferProcess.length) {
          tradeProcessHtml = '<div style="margin-top:16px;text-align:left;">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:8px;display:flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-dim)" style="width:13px;height:13px;"><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4"/><path d="M9 11V5a3 3 0 0 1 6 0v6"/></svg>转让流程（线上' + rec.transferProcess.length + '步）</div>' +
            '<div style="display:flex;flex-direction:column;gap:0;">' +
            rec.transferProcess.map(function (p, i) {
              var isLast = i === rec.transferProcess.length - 1;
              return '<div style="display:flex;gap:8px;align-items:flex-start;">' +
                '<div style="display:flex;flex-direction:column;align-items:center;">' +
                '<div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dim));color:var(--text-inv);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;font-family:var(--font-num);box-shadow:0 1px 4px -1px var(--primary-dim);">' + p.step + '</div>' +
                (!isLast ? '<div style="width:1.5px;flex:1;background:var(--line);min-height:12px;margin:2px 0;"></div>' : '') +
                '</div>' +
                '<div style="flex:1;padding-bottom:' + (isLast ? '0' : '8px') + ';">' +
                '<div style="font-size:11px;font-weight:600;color:var(--text-1);line-height:1.3;">' + p.title + '</div>' +
                '<div style="font-size:9.5px;color:var(--text-3);line-height:1.3;margin-top:2px;">' + p.desc + '</div>' +
                '</div></div>';
            }).join('') +
            '</div></div>';
        }
        depositHtml = '<div style="margin-top:12px;padding:8px 10px;background:var(--success-soft);border:1px solid rgba(43,107,79,.15);border-radius:8px;text-align:left;">' +
          '<div style="font-size:10.5px;color:var(--text-2);line-height:1.5;"><b style="color:var(--success);">可退保证金：</b>支付 ¥5,000 保证金后解锁完整信息并联系出售方；30 天内未达成交易可全额无息退还，达成交易可抵扣交易服务费。</div>' +
          '</div>';
      }
      /* M3：持证人才单条积分解锁（Q3 统一积分体系，去掉旧线索包）；企业招聘免费投递 */
      var personnelPayHtml = '';
      if (rec.bizKey === 'talent') {
        var _discT = creditDiscountRate();
        var _costT = Math.round((up ? up.price : 29) * _discT);
        personnelPayHtml = '<div style="margin-top:14px;text-align:left;">' +
          '<div style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:8px;">解锁方式</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div style="padding:10px 12px;background:var(--primary-soft);border:1.5px solid var(--primary);border-radius:10px;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                '<span style="font-size:12px;font-weight:700;color:var(--primary-dim);">单条解锁</span>' +
                '<span style="font-family:var(--font-num);font-size:15px;font-weight:700;color:var(--primary-dim);">' + _costT + ' 积分' + (_discT < 1 ? '<span style="font-size:10px;color:var(--text-3);font-weight:400;margin-left:4px;">会员' + Math.round(_discT * 10) + '折</span>' : '') + '</span>' +
              '</div>' +
              '<div style="font-size:10px;color:var(--text-3);margin-top:3px;">解锁该人才完整联系方式（手机+微信），7 天内可查看；实名用户本月免费额度可抵扣</div>' +
            '</div>' +
            '<div style="padding:10px 12px;background:var(--bg-card);border:1px solid var(--line);border-radius:10px;">' +
              '<div style="font-size:10.5px;color:var(--text-2);line-height:1.5;"><b style="color:var(--success);">企业免费发布：</b>企业认证后可免费发布招聘需求，平台精准匹配持证人才，不向求职者收费</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
      var sheet = UI.sheet();
      sheet.setText(rec.bizKey === 'trade' ? '支付保证金 · 查看完整信息' : '解锁与对方沟通权限'); /* [FIX BM-013] 付费 Sheet 标题统一为「沟通权限」 */
      var fqM3 = freeQuotaInfo();
      var discM3 = creditDiscountRate();
      var costM3 = Math.round(up.price * (up.mode === 'credit' ? discM3 : 1));
      var balM3 = window.CreditStore ? CreditStore.read().balance : 0;
      var creditEnough = balM3 >= costM3;
      var isDeposit = up.mode === 'deposit';
      var isFree = up.mode === 'free';
      /* 价格显示 */
      var priceHtml = '';
      if (isDeposit) {
        priceHtml = '<div class="unlock-price deposit"><span class="up-cur">¥</span><span class="up-amt">' + Number(up.price).toLocaleString() + '</span><div class="up-sub">可退保证金 · 30 天未成交全额退还</div></div>';
      } else if (isFree) {
        priceHtml = '<div class="unlock-price free"><span class="up-amt">免费</span><div class="up-sub">免费咨询 · 留资即开放联系方式</div></div>';
      } else {
        /* [FIX E1-16/E2-20] 解锁 Sheet 价格区：折扣价 + 计算过程 + 年度会员标识 + 免费额度期入驻折扣提示 */
        var _isAnnual = !!(window.MemberStore && MemberStore.isActive() && up.mode === 'credit');
        var _discNum = Math.round(discM3 * 100) / 10; /* 0.8 -> 8 折 */
        var _origShow = up.original || (discM3 < 1 ? up.price : null);
        var _discBadge = _isAnnual ? '<span class="up-disc">会员免费解锁</span>' : (discM3 < 1 ? '<span class="up-disc">入驻' + _discNum + ' 折</span>' : '');
        var _calcLine = (discM3 < 1 && up.price) ? '<div style="font-size:10px;color:var(--text-3);margin-top:2px;">' + up.price + ' 积分 × ' + discM3 + ' = ' + costM3 + ' 积分</div>' : '';
        var _todayRemain = (window.FreeQuotaStore) ? FreeQuotaStore.remaining() : 0;
        var _freeHint = '';
        if (_todayRemain > 0) {
          _freeHint = '今日免费解锁剩 ' + _todayRemain + ' 条';
          if (discM3 < 1) _freeHint += '（入驻后解锁享' + _discNum + ' 折）';
        } else if (fqM3.allow && fqM3.remain > 0) {
          _freeHint = '本月免费额度剩 ' + fqM3.remain + ' 条，可先免费解锁';
          if (discM3 < 1) _freeHint += '（入驻后解锁享' + _discNum + ' 折）';
        } else {
          _freeHint = '账户余额 ' + balM3 + ' 积分' + (creditEnough ? '' : '，积分不足');
        }
        /* [FIX E3-8] 破冰/限时价旁标注正式期恢复原价 */
        var _breakNote = (window.ModeStore && ModeStore.isBreakIn() && _origShow) ? '<div style="font-size:10px;color:var(--accent);margin-top:2px;">限时优惠 · 正式期恢复原价 ' + _origShow + ' 积分</div>' : '';
        priceHtml = '<div class="unlock-price credit"><span class="up-amt">' + costM3 + '</span><span class="up-unit">积分</span>' +
          (_origShow ? '<span class="up-orig">' + _origShow + '</span>' : '') +
          _discBadge +
          '<div class="up-sub">' + _freeHint + '</div>' + _calcLine + _breakNote + '</div>';
      }
      /* 积分套餐引导（积分不足时展示） */
      var pkgs = (MOCK.business.credits && MOCK.business.credits.packages) || [];
      var pkgHtml = '';
      if (!isDeposit && !isFree && !creditEnough && pkgs.length) {
        pkgHtml = '<div class="unlock-pkg"><div class="up-label">积分不足？选购套餐更优惠</div><div class="up-grid">' +
          pkgs.map(function (p, i) {
            var gain = p.price >= 580 ? '多送' + Math.round((p.credits - p.price) / p.price * 100) + '%' : '';
            return '<div class="up-card' + (i === 1 ? ' selected' : '') + '" data-pkg="' + i + '">' +
              '<div class="up-price">¥' + p.price + '</div>' +
              '<div class="up-credits">' + p.credits + ' 积分</div>' +
              (gain ? '<div class="up-gain">' + gain + '</div>' : '<div class="up-gain empty"></div>') +
              '<div class="up-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>' +
            '</div>';
          }).join('') + '</div></div>';
      }
      /* 支付方式选择 */
      var payMethodHtml = '';
      if (!isFree) {
        var methods = isDeposit
          ? [{ id:'wechat', name:'微信支付', icon:'i-chat', color:'#07C160' }, { id:'alipay', name:'支付宝', icon:'i-box', color:'#1677FF' }]
          : [{ id:'credit', name:'积分支付', icon:'i-star', color:'#D4AF37', desc:'余额 ' + balM3 + ' 积分' }, { id:'wechat', name:'微信支付', icon:'i-chat', color:'#07C160', desc:'单次 ¥' + Math.round(costM3 * creditToCnyRate()) /* [FIX BM-015] 1.28 收敛到 creditToCnyRate() */ }, { id:'alipay', name:'支付宝', icon:'i-box', color:'#1677FF', desc:'单次 ¥' + Math.round(costM3 * creditToCnyRate()) /* [FIX BM-015] 1.28 收敛到 creditToCnyRate() */ }];
        payMethodHtml = '<div class="unlock-paymethods"><div class="pm-label">选择支付方式</div>' +
          methods.map(function (pm, i) {
            return '<div class="pm-item' + (i === 0 ? ' selected' : '') + '" data-pay="' + pm.id + '">' +
              '<div class="pm-icon" style="background:' + pm.color + '15;color:' + pm.color + ';"><svg class="ic"><use href="#' + pm.icon + '"/></svg></div>' +
              '<div class="pm-body"><div class="pm-name">' + pm.name + '</div>' + (pm.desc ? '<div class="pm-desc">' + pm.desc + '</div>' : '') + '</div>' +
              '<div class="pm-radio"></div>' +
            '</div>';
          }).join('') + '</div>';
      }
      var payTitle = isDeposit ? '支付保证金后可获取以下完整信息，直接联系出售方' : '解锁后可获取以下核心信息，直接对接';
      sheet.body().innerHTML =
        '<div class="unlock-sheet">' +
          '<div class="us-header">' +
            '<div class="us-title">' + payTitle + '</div>' +
            '<div class="us-chips">' + chips + '</div>' +
          '</div>' +
          processHtml + tradeProcessHtml + depositHtml + personnelPayHtml +
          priceHtml + pkgHtml + payMethodHtml +
          '<div class="us-footer">' +
            '<button class="btn btn-primary btn-block btn-lg" id="pay-go">' + (isFree ? '免费解锁' : (isDeposit ? '确认支付 ¥' + Number(up.price).toLocaleString() : '确认解锁')) + '</button>' +
            '<div class="us-secure"><svg class="ic"><use href="#i-shield"/></svg>安全支付 · 平台担保 · 未对接可退</div>' +
          '</div>' +
        '</div>';
      /* 支付方式切换 */
      var currentPay = isFree ? 'free' : (isDeposit ? 'wechat' : 'credit');
      sheet.body().querySelectorAll('.pm-item').forEach(function (item) {
        item.addEventListener('click', function () {
          sheet.body().querySelectorAll('.pm-item').forEach(function (i) { i.classList.remove('selected'); });
          item.classList.add('selected');
          currentPay = item.dataset.pay;
          var btn = sheet.body().querySelector('#pay-go');
          if (currentPay === 'credit') btn.textContent = '确认解锁 · ' + costM3 + '积分';
          else if (currentPay === 'wechat') btn.textContent = isDeposit ? '微信支付 ¥' + Number(up.price).toLocaleString() : '微信支付 ¥' + Math.round(costM3 * creditToCnyRate()) /* [FIX BM-015] 1.28 收敛到 creditToCnyRate() */;
          else if (currentPay === 'alipay') btn.textContent = isDeposit ? '支付宝 ¥' + Number(up.price).toLocaleString() : '支付宝 ¥' + Math.round(costM3 * creditToCnyRate()) /* [FIX BM-015] 1.28 收敛到 creditToCnyRate() */;
        });
      });
      /* 积分套餐选择 */
      sheet.body().querySelectorAll('.up-card').forEach(function (card) {
        card.addEventListener('click', function () {
          sheet.body().querySelectorAll('.up-card').forEach(function (c) { c.classList.remove('selected'); });
          card.classList.add('selected');
        });
      });
      /* 确认支付 */
      var payBtn = sheet.body().querySelector('#pay-go');
      /* [FIX BM-051] 点击后置灰「支付中...」防重复提交；[FIX BM-010/BM-011] 微信/支付宝/保证金走真实资金动作，不再仅 toast+mark */
      payBtn.addEventListener('click', function () {
        if (payBtn.disabled) return;
        var _origBtnText = payBtn.textContent;
        payBtn.disabled = true;
        payBtn.textContent = '支付中...';
        var method = currentPay;
        setTimeout(function () {
          payBtn.disabled = false;
          payBtn.textContent = _origBtnText;
          sheet.close();
          if (method === 'credit' || method === 'free') {
            payGo(rec, up);
          } else if (isDeposit) {
            payGoDeposit(rec, up, method);
          } else {
            simulatePayUnlock(rec, up, method);
          }
        }, 600);
      });
      sheet.show();
    }
    /* v3.1: 简历投递门控（动态文案+按钮+跳转） */
    /* 根据 canDeliverResume 返回的 reason 判断拦截类型，返回完整的弹窗配置 */
    function resolveDeliverBlocked(reason, userType) {
      var r = (reason || '').toString();
      /* 类型1：未完成个人入驻 */
      if (r.indexOf('个人入驻') >= 0 || r.indexOf('入驻') >= 0 && r.indexOf('标准') < 0 && r.indexOf('简历') < 0) {
        return {
          type: 'entry',
          title: '需要个人入驻',
          desc: '完成求职者个人入驻后，即可向企业投递简历。入驻流程约2分钟，认证后享受优先推荐。',
          btnText: '去入驻',
          btnHref: '../profile/auth.html?tab=personal',
          iconColor: 'var(--primary)'
        };
      }
      /* 类型2：标准入驻用户（不支持投递） */
      if (r.indexOf('标准') >= 0 || userType === 'standard') {
        return {
          type: 'standard',
          title: '升级为求职者入驻',
          desc: '您当前为标准入驻用户，暂不支持简历投递。升级为求职者入驻后，可完善简历并向企业投递。',
          btnText: '了解升级',
          btnHref: '../profile/auth-qualification.html?mode=edit&upgrade=1',
          iconColor: 'var(--warning)'
        };
      }
      /* 类型3：求职者但简历未完成 */
      if (r.indexOf('简历') >= 0) {
        return {
          type: 'resume',
          title: '完善简历信息',
          desc: '请先完成简历详情编辑（基本信息、工作经历、持有证书等），完善后即可向企业投递。',
          btnText: '去完善简历',
          btnHref: '../profile/auth-qualification.html?mode=edit',
          iconColor: 'var(--primary)'
        };
      }
      /* 兜底：未知原因 */
      return {
        type: 'unknown',
        title: '暂不支持简历投递',
        desc: r || '请先完成个人入驻并完善简历信息',
        btnText: '去完善',
        btnHref: '../profile/auth-qualification.html?mode=edit',
        iconColor: 'var(--danger)'
      };
    }
    /* 当前弹窗配置（用于按钮跳转） */
    var _currentDeliverConfig = null;
    function openDeliverBlocked(reason, userType) {
      var cfg = resolveDeliverBlocked(reason, userType);
      _currentDeliverConfig = cfg;
      /* 动态设置标题 */
      var titleEl = document.getElementById('deliverModalTitle');
      if (titleEl) titleEl.textContent = cfg.title;
      /* 动态设置描述 */
      var descEl = document.getElementById('deliverModalDesc');
      if (descEl) descEl.textContent = cfg.desc;
      /* 动态设置按钮文案 */
      var goBtn = document.getElementById('deliverGoEdit');
      if (goBtn) goBtn.textContent = cfg.btnText;
      /* 动态设置图标颜色 */
      var iconEl = document.getElementById('deliverModalIcon');
      if (iconEl) {
        iconEl.style.color = cfg.iconColor;
        if (cfg.type === 'entry' || cfg.type === 'resume') {
          iconEl.style.background = 'linear-gradient(135deg,rgba(43,107,79,.15),rgba(43,107,79,.05))';
        } else if (cfg.type === 'standard') {
          iconEl.style.background = 'linear-gradient(135deg,rgba(214,158,46,.15),rgba(214,158,46,.05))';
        } else {
          iconEl.style.background = 'linear-gradient(135deg,rgba(212,76,71,.15),rgba(212,76,71,.05))';
        }
      }
      var mask = document.getElementById('deliverMask');
      var modal = document.getElementById('deliverModal');
      if (mask) mask.classList.add('show');
      if (modal) modal.classList.add('show');
    }
    function closeDeliverBlocked() {
      var mask = document.getElementById('deliverMask');
      var modal = document.getElementById('deliverModal');
      if (mask) mask.classList.remove('show');
      if (modal) modal.classList.remove('show');
    }
    function checkDeliverPermission(rec, c) {
      var can = true, reason = '', userType = '';
      try {
        if (window.DataBus && DataBus.canDeliverResume) {
          var r = DataBus.canDeliverResume();
          can = r.can; reason = r.reason; userType = r.userType;
        }
      } catch (e) { console.warn('canDeliverResume error', e); }
      if (can) {
        openApply(rec, c);
      } else {
        openDeliverBlocked(reason, userType);
      }
    }
    /* 绑定弹窗关闭事件（只绑定一次） */
    var _deliverEventsBound = false;
    function bindDeliverModalEvents() {
      if (_deliverEventsBound) return;
      _deliverEventsBound = true;
      var mask = document.getElementById('deliverMask');
      var cancelBtn = document.getElementById('deliverCancel');
      var goBtn = document.getElementById('deliverGoEdit');
      if (mask) mask.addEventListener('click', closeDeliverBlocked);
      if (cancelBtn) cancelBtn.addEventListener('click', closeDeliverBlocked);
      if (goBtn) goBtn.addEventListener('click', function () {
        var cfg = _currentDeliverConfig;
        closeDeliverBlocked();
        if (cfg && cfg.btnHref) {
          location.href = cfg.btnHref;
        } else {
          location.href = '../profile/auth-qualification.html?mode=edit';
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          var modal = document.getElementById('deliverModal');
          if (modal && modal.classList.contains('show')) closeDeliverBlocked();
        }
      });
    }
    function openApply(rec, c) {
      var sheet = UI.sheet();
      sheet.setText('投递简历 · ' + rec.title.substring(0, 20));
      var certOptions = ['一级建造师', '二级建造师', '造价工程师', '监理工程师', '安全工程师', '消防工程师', '结构工程师'];
      var expOptions = ['1年以下', '1-3年', '3-5年', '5-10年', '10年以上'];
      sheet.body().innerHTML =
        '<div style="padding:4px 0 2px;">' +
          '<div style="font-size:12px;color:var(--text-2);margin-bottom:12px;">投递后企业将在24小时内查看，感兴趣后平台为您对接联系方式</div>' +
          '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">姓名 <span style="color:var(--accent);">*</span></label><input type="text" id="ap-name" placeholder="请输入您的姓名" value="陈建国" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:13px;background:var(--bg-card);box-sizing:border-box;outline:none;"></div>' +
          '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">联系电话 <span style="color:var(--accent);">*</span></label><input type="tel" id="ap-phone" placeholder="请输入您的手机号" value="13800008866" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:13px;background:var(--bg-card);box-sizing:border-box;outline:none;"></div>' +
          '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">持有证书（可多选）</label><div id="ap-certs" style="display:flex;flex-wrap:wrap;gap:6px;">' + certOptions.map(function(co) { return '<span class="ap-tag" data-val="' + co + '" style="padding:5px 10px;border:1px solid var(--line);border-radius:var(--r-full);font-size:11px;color:var(--text-2);cursor:pointer;transition:all .15s;">' + co + '</span>'; }).join('') + '</div></div>' +
          '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">工作年限</label><div id="ap-exps" style="display:flex;flex-wrap:wrap;gap:6px;">' + expOptions.map(function(eo) { return '<span class="ap-tag-single" data-val="' + eo + '" style="padding:5px 10px;border:1px solid var(--line);border-radius:var(--r-full);font-size:11px;color:var(--text-2);cursor:pointer;transition:all .15s;">' + eo + '</span>'; }).join('') + '</div></div>' +
          '<div style="margin-bottom:14px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">自我介绍（选填）</label><textarea id="ap-msg" rows="3" placeholder="简要介绍您的工作经历、项目经验和求职意向" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:12.5px;background:var(--bg-card);box-sizing:border-box;outline:none;resize:none;font-family:inherit;"></textarea></div>' +
          '<div style="padding:8px 10px;background:rgba(43,107,79,.06);border:1px solid rgba(43,107,79,.15);border-radius:8px;margin-bottom:12px;"><div style="font-size:10.5px;color:var(--text-2);line-height:1.5;"><b style="color:var(--success);">隐私保护：</b>您的联系方式仅在企业确认感兴趣后由平台对接，企业无法直接查看。</div></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-block btn-lg" id="ap-submit" style="margin-top:4px;">提交投递</button>';
      /* 证书多选 */
      sheet.body().querySelectorAll('#ap-certs .ap-tag').forEach(function(tag) {
        tag.addEventListener('click', function() {
          tag.classList.toggle('selected');
          if (tag.classList.contains('selected')) {
            tag.style.background = 'var(--primary-soft)';
            tag.style.borderColor = 'var(--primary)';
            tag.style.color = 'var(--primary-dim)';
            tag.style.fontWeight = '600';
          } else {
            tag.style.background = '';
            tag.style.borderColor = 'var(--line)';
            tag.style.color = 'var(--text-2)';
            tag.style.fontWeight = '';
          }
        });
      });
      /* 工作年限单选 */
      sheet.body().querySelectorAll('#ap-exps .ap-tag-single').forEach(function(tag) {
        tag.addEventListener('click', function() {
          sheet.body().querySelectorAll('#ap-exps .ap-tag-single').forEach(function(t) {
            t.style.background = '';
            t.style.borderColor = 'var(--line)';
            t.style.color = 'var(--text-2)';
            t.style.fontWeight = '';
          });
          tag.style.background = 'var(--primary-soft)';
          tag.style.borderColor = 'var(--primary)';
          tag.style.color = 'var(--primary-dim)';
          tag.style.fontWeight = '600';
        });
      });
      sheet.body().querySelector('#ap-submit').addEventListener('click', function() {
        var name = sheet.body().querySelector('#ap-name').value.trim();
        var phone = sheet.body().querySelector('#ap-phone').value.trim();
        if (!name) { UI.toast('请输入您的姓名', 'warn'); return; }
        if (!phone || !/^1\d{10}$/.test(phone)) { UI.toast('请输入正确的手机号', 'warn'); return; }
        var _apCerts = [];
        sheet.body().querySelectorAll('#ap-certs .ap-tag.selected').forEach(function(t) { _apCerts.push(t.getAttribute('data-val')); });
        var _apExp = '';
        var _apExpTag = sheet.body().querySelector('#ap-exps .ap-tag-single[style*="background"]');
        if (_apExpTag) _apExp = _apExpTag.getAttribute('data-val');
        var _apMsg = sheet.body().querySelector('#ap-msg').value.trim();
        sheet.close();
        try {
          if (window.ApplyStore) {
            ApplyStore.add({ jobId: rec.id, jobTitle: rec.title || '', company: rec.company || '',
              resumeSnapshot: { name: name, phone: phone, certs: _apCerts, experience: _apExp },
              applyMsg: _apMsg, certsSelected: _apCerts, expSelected: _apExp, status: 'pending' });
          }
        } catch (eApply) { console.warn('apply store error', eApply); }
        /* 更新投递状态 */
        var applyArea = document.getElementById('apply-area');
        if (applyArea) {
          applyArea.innerHTML = '<div class="aa-applied">' +
            '<div class="aa-applied-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>' +
            '<div class="aa-applied-text"><div class="aa-applied-title">投递成功，等待企业回复</div><div class="aa-applied-desc">企业将在24小时内查看您的投递，感兴趣后平台将为您对接联系方式</div></div>' +
            '<div class="aa-applied-status"><span class="aas-dot"></span>待回复</div>' +
          '</div>';
        }
        var ctaBtn = document.getElementById('cta');
        if (ctaBtn) {
          ctaBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>查看投递状态';
        }
        UI.toast('投递成功，企业将尽快与您联系', 'ok');
      });
      sheet.show();
    }
    /* ---- 资质招商：免费加盟意向登记（留资转化，提交即原地开放联系方式，不收取信息费） ---- */
    function openConsult(rec, c) {
      var sheet = UI.sheet();
      /* —— 中介服务：免费咨询需求登记（提交即原地开放联系方式，不收信息费） —— */
      if (rec.bizKey === 'agency') {
        var agServeOpts = ['资质升级', '工商注册', '安许代办', '资质分立', '其他'];
        var agUrgeOpts = ['常规办理', '加急通道', '仅先咨询'];
        function agChips(id, opts) {
          return '<div id="' + id + '" style="display:flex;flex-wrap:wrap;gap:6px;">' + opts.map(function (o) {
            return '<span class="cs-tag" data-val="' + o + '" style="padding:5px 11px;border:1px solid var(--line);border-radius:var(--r-full);font-size:11px;color:var(--text-2);cursor:pointer;transition:all .15s;">' + o + '</span>';
          }).join('') + '</div>';
        }
        sheet.setText('免费咨询 · 需求登记');
        sheet.body().innerHTML =
          '<div style="padding:4px 0 2px;">' +
            '<div style="font-size:12px;color:var(--text-2);margin-bottom:12px;line-height:1.6;">提交咨询需求后即可查看服务顾问电话与微信，顾问将在 1 个工作日内联系您，<b style="color:var(--success);">全程不收取信息费</b></div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">办理事项</label>' + agChips('ag-serve', agServeOpts) + '</div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">紧急程度</label>' + agChips('ag-urge', agUrgeOpts) + '</div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">您的姓名 <span style="color:var(--accent);">*</span></label><input type="text" id="ag-name" placeholder="请输入您的姓名" value="陈建国" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:13px;background:var(--bg-card);box-sizing:border-box;outline:none;"></div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">联系电话 <span style="color:var(--accent);">*</span></label><input type="tel" id="ag-phone" placeholder="请输入您的手机号" value="13800008866" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:13px;background:var(--bg-card);box-sizing:border-box;outline:none;"></div>' +
            '<div style="padding:8px 10px;background:var(--success-soft);border-radius:8px;margin-bottom:12px;"><div style="font-size:10.5px;color:var(--text-2);line-height:1.5;"><b style="color:var(--success);">免费咨询保障：</b>报价、材料与案例已全部公开，留资仅用于顾问对接；服务不过按约退款，平台不代收代办费，款项均对公签约。</div></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-block btn-lg" id="ag-submit">免费提交并解锁沟通权限</button>'; /* [FIX BM-013] 清除「查看联系方式」表述 */
        function agBind(gid) {
          sheet.body().querySelectorAll('#' + gid + ' .cs-tag').forEach(function (tag) {
            tag.addEventListener('click', function () {
              sheet.body().querySelectorAll('#' + gid + ' .cs-tag').forEach(function (t) { t.style.background = ''; t.style.borderColor = 'var(--line)'; t.style.color = 'var(--text-2)'; t.style.fontWeight = ''; });
              tag.style.background = 'var(--primary-soft)'; tag.style.borderColor = 'var(--primary)'; tag.style.color = 'var(--primary-dim)'; tag.style.fontWeight = '600';
            });
          });
        }
        agBind('ag-serve'); agBind('ag-urge');
        /* 读取选中 chips（选中项以 primary-soft 背景标记） */
        function agSel(gid) {
          var out = [];
          var nodes = sheet.body().querySelectorAll('#' + gid + ' .cs-tag');
          for (var i = 0; i < nodes.length; i++) if (nodes[i].style.background) out.push(nodes[i].getAttribute('data-val'));
          return out.join(' / ');
        }
        sheet.body().querySelector('#ag-submit').addEventListener('click', function () {
          var name = sheet.body().querySelector('#ag-name').value.trim();
          var phone = sheet.body().querySelector('#ag-phone').value.trim();
          if (!name) { UI.toast('请输入您的姓名', 'warn'); return; }
          if (!phone || !/^1\d{10}$/.test(phone)) { UI.toast('请输入正确的手机号', 'warn'); return; }
          /* 生成询盘线索：服务商工作台可见（v3.2） */
          try {
            if (window.LeadStore) {
              var me = (window.DataBus && DataBus.current) ? DataBus.current() : null;
              LeadStore.create({
                svcId: String(rec.id || ''),
                svcName: String(rec.title || rec.name || '中介服务'),
                sellerId: rec.sellerId || rec.publisher || (rec.companyId ? 'u2' : 'u2'),
                buyerId: me ? me.id : '',
                name: name, phone: phone,
                serve: agSel('ag-serve'), urge: agSel('ag-urge')
              });
            }
          } catch (e) {}
          sheet.close();
          unlock('咨询需求已提交，联系方式已开放');
        });
        sheet.show();
        return;
      }
      sheet.setText('免费咨询 · 加盟意向登记');
      var areaOpts = ['本市', '本省', '西南地区', '全国其他'];
      var typeOpts = ['房建总包', '市政公用', '机电/电力', '工程设计', '监理造价', '专业承包', '其他'];
      var budgetOpts = ['5万以内', '5-20万', '20-50万', '50万以上'];
      function chipGroup(id, opts) {
        return '<div id="' + id + '" style="display:flex;flex-wrap:wrap;gap:6px;">' + opts.map(function (o) {
          return '<span class="cs-tag" data-val="' + o + '" style="padding:5px 11px;border:1px solid var(--line);border-radius:var(--r-full);font-size:11px;color:var(--text-2);cursor:pointer;transition:all .15s;">' + o + '</span>';
        }).join('') + '</div>';
      }
      function field(label, req, inner) {
        return '<div style="margin-bottom:12px;"><label style="font-size:11.5px;font-weight:600;color:var(--text-1);display:block;margin-bottom:6px;">' + label + (req ? ' <span style="color:var(--accent);">*</span>' : '') + '</label>' + inner + '</div>';
      }
      sheet.body().innerHTML =
        '<div style="padding:4px 0 2px;">' +
          '<div style="font-size:12px;color:var(--text-2);margin-bottom:12px;line-height:1.6;">提交加盟意向后，需付费查看招商顾问电话与微信；顾问将在 1 个工作日内与您联系，<b style="color:var(--primary-dim);">付费解锁后 7 天内可查看</b></div>' +
          field('意向区域', false, chipGroup('cs-area', areaOpts)) +
          field('拟经营 / 投标类型', false, chipGroup('cs-type', typeOpts)) +
          field('预计投入', false, chipGroup('cs-budget', budgetOpts)) +
          field('您的姓名', true, '<input type="text" id="cs-name" placeholder="请输入您的姓名" value="陈建国" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:13px;background:var(--bg-card);box-sizing:border-box;outline:none;">') +
          field('联系电话', true, '<input type="tel" id="cs-phone" placeholder="请输入您的手机号" value="13800008866" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-m);font-size:13px;background:var(--bg-card);box-sizing:border-box;outline:none;">') +
          '<div style="padding:8px 10px;background:var(--success-soft);border-radius:8px;margin-bottom:12px;"><div style="font-size:10.5px;color:var(--text-2);line-height:1.5;"><b style="color:var(--success);">免费咨询保障：</b>资质与费用信息已全部公开，留资仅用于招商顾问对接，平台不代收加盟费，款项均对公签约。</div></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-block btn-lg" id="cs-submit">提交咨询意向</button>';
      function bindGroup(gid, single) {
        sheet.body().querySelectorAll('#' + gid + ' .cs-tag').forEach(function (tag) {
          tag.addEventListener('click', function () {
            if (single) sheet.body().querySelectorAll('#' + gid + ' .cs-tag').forEach(function (t) { t.style.background = ''; t.style.borderColor = 'var(--line)'; t.style.color = 'var(--text-2)'; t.style.fontWeight = ''; });
            var on = tag.style.background === 'var(--primary-soft)';
            if (on) { tag.style.background = ''; tag.style.borderColor = 'var(--line)'; tag.style.color = 'var(--text-2)'; tag.style.fontWeight = ''; }
            else { tag.style.background = 'var(--primary-soft)'; tag.style.borderColor = 'var(--primary)'; tag.style.color = 'var(--primary-dim)'; tag.style.fontWeight = '600'; }
          });
        });
      }
      bindGroup('cs-area', true); bindGroup('cs-type', false); bindGroup('cs-budget', true);
      sheet.body().querySelector('#cs-submit').addEventListener('click', function () {
        var name = sheet.body().querySelector('#cs-name').value.trim();
        var phone = sheet.body().querySelector('#cs-phone').value.trim();
        if (!name) { UI.toast('请输入您的姓名', 'warn'); return; }
        if (!phone || !/^1\d{10}$/.test(phone)) { UI.toast('请输入正确的手机号', 'warn'); return; }
        sheet.close();
        UI.toast('咨询意向已提交，请付费解锁沟通权限', 'ok'); /* [FIX BM-013] 清除「查看联系方式」表述 */
        setTimeout(function () {
          /* [FIX] franchise 付费分支身份门控：留资后、openPay 前补 gateAct，与普通类一致（游客→登录，未实名→实名） */
          var _g2 = identityGate();
          if (!gateAct(_g2)) return;
          openPay();
        }, 300);
      });
      sheet.show();
    }
    /* M3：积分/免费额度/保证金 三种解锁执行（免费额度优先 → 扣积分 → 不足去充值） */
    function payGo(rec, up) {
      if (up.mode === 'free') { unlock('已开放沟通权限'); return; } /* [FIX BM-013] 文案统一沟通权限 */
      /* [FIX BM-010] trade 保证金不再在此空壳 toast+mark，统一走 payGoDeposit 真实冻结/解冻 */
      /* [FEAT 9.2-1] 年度会员：积分类详情免费解锁，不消耗月度免费额度与积分；保证金类仍走保证金流程 */
      if (window.MemberStore && MemberStore.isActive() && up.mode === 'credit') {
        UI.toast('年度会员免费解锁 · 已开放完整信息', 'ok'); unlock(); return;
      }
      /* [FEAT 9.2-4] 每日免费浏览摘要额度（游客3/注册5/实名10，跨天重置），优先于月度免费额度 */
      if (window.FreeQuotaStore && up.mode === 'credit' && FreeQuotaStore.use(1)) {
        UI.toast('已使用今日免费浏览额度 1 条 · 今日剩 ' + FreeQuotaStore.remaining() + ' 条', 'ok'); unlock(); return;
      }
      var fqG = freeQuotaInfo();
      if (fqG.allow && fqG.remain > 0) { CreditStore.freeSpend(1); UI.toast('已使用免费解锁额度 1 条 · 本月剩 ' + (fqG.remain - 1), 'ok'); unlock(); return; }
      var costG = Math.round(up.price * creditDiscountRate());
      if (window.CreditStore && CreditStore.read().balance >= costG) { CreditStore.consume(costG, '解锁' + ((rec.title || rec.name || '') + '').slice(0, 12)); UI.toast('已扣 ' + costG + ' 积分解锁', 'ok'); unlock(); return; }
      /* P2-6：积分不足时先展示积分包选项，再引导充值 */
      var pkgs = (MOCK.business.credits && MOCK.business.credits.packages) || [];
      var pkgHtml = pkgs.map(function(p) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-card-2);border-radius:8px;margin-bottom:6px;"><span style="font-size:12.5px;font-weight:600;color:var(--text-1);">' + p.credits + ' 积分</span><span style="font-size:13px;font-weight:700;color:var(--primary-dim);font-family:var(--font-num);">¥' + p.price + '</span></div>';
      }).join('');
      UI.dialog({
        title: '积分不足',
        text: '当前余额 <b>' + (window.CreditStore ? CreditStore.read().balance : 0) + '</b> 积分，本次解锁需 <b>' + costG + '</b> 积分。充值后立即可用：<br><br>' + pkgHtml,
        ok: '去充值', cancel: '再看看',
        onOk: function () { location.href = '../../pages/wallet/credits.html'; }
      });
    }
    /* [FIX BM-010] trade 保证金：校验可用余额 → 真实冻结 BalanceStore.frozen → 30 天 TTL 台账到期解冻退还（写 trade_deposit_frozen / trade_deposit_released 流水） */
    function payGoDeposit(rec, up, method) {
      var deposit = Math.round(((MOCK.business.credits || {}).tradeDeposit || 5000) * 100) / 100;
      if (!window.BalanceStore) { UI.toast('余额账本不可用', 'err'); return; }
      if (BalanceStore.available() < deposit) {
        UI.dialog({
          title: '保证金余额不足',
          text: '支付保证金需 <b>¥' + deposit.toLocaleString() + '</b>，当前可用余额 <b>¥' + BalanceStore.available().toLocaleString() + '</b>。充值后可继续支付。',
          ok: '去充值', cancel: '再看看',
          onOk: function () { location.href = '../../pages/wallet/credits.html'; }
        });
        return;
      }
      var s = BalanceStore.read();
      s.frozen = Math.round((s.frozen + deposit) * 100) / 100;
      s.logs.unshift({ type: 'trade_deposit_frozen', amount: -deposit, method: method || 'wechat', reason: '建企买卖保证金冻结 · ' + ((rec.title || rec.name || '') + '').slice(0, 16), ts: Date.now(), ref: rec.id });
      BalanceStore.write(s);
      /* 解锁台账：30 天 TTL 到期自动解冻退还（见模块级 sweepTradeDeposits） */
      var arr = _tradeDepositRead();
      arr.push({ ref: rec.id, amount: deposit, status: 'frozen', ts: Date.now(), releaseAt: Date.now() + 30 * 864e5 });
      _tradeDepositWrite(arr);
      UnlockStore.mark(rec);
      unlock('保证金 ¥' + deposit.toLocaleString() + ' 已冻结 · 信息已解锁（30 天未成交可全额退还）');
    }
    /* [FIX BM-011 / E1-09] 单次解锁：微信/支付宝只走人民币流水(unlock_sim_pay/unlock_cny_pay)→平台收入台账，不再双扣积分；积分支付走上面 credit 分支只扣积分 */
    function simulatePayUnlock(rec, up, method) {
      var rate = creditToCnyRate();
      var costCredit = Math.round(up.price * (up.mode === 'credit' ? creditDiscountRate() : 1));
      var rmb = Math.round(costCredit * rate);
      var payName = method === 'alipay' ? '支付宝' : (method === 'credit' ? '积分支付' : '微信支付');
      /* [FIX E1-09] 支付方式二选一，严禁双扣费：微信/支付宝只扣人民币余额，绝不调 CreditStore.consume；积分支付只扣积分，绝不碰 BalanceStore */
      if (method === 'credit') {
        if (window.CreditStore) CreditStore.consume(costCredit, '解锁沟通权限 · ' + ((rec.title || rec.name || '') + '').slice(0, 12), { method: method });
        UnlockStore.mark(rec);
        UI.toast('已扣 ' + costCredit + ' 积分', 'ok');
        unlock();
        return;
      }
      if (window.BalanceStore) {
        var s = BalanceStore.read();
        s.logs.unshift({ type: 'unlock_sim_pay', amount: -rmb, method: method, reason: payName + ' · 单次解锁模拟支付', ts: Date.now(), ref: rec.id });
        if (BalanceStore.available() >= rmb) {
          s.balance = Math.round((s.balance - rmb) * 100) / 100;
          s.logs.unshift({ type: 'unlock_cny_pay', amount: -rmb, method: method, reason: payName + '扣款 · 单次解锁', ts: Date.now(), ref: rec.id });
        }
        s.logs.unshift({ type: 'platform_income', amount: rmb, method: method, reason: '单次解锁平台收入（模拟）', ts: Date.now(), ref: rec.id });
        BalanceStore.write(s);
      }
      UnlockStore.mark(rec);
      UI.toast(payName + '成功，已扣 ¥' + rmb, 'ok');
      unlock();
    }
    function tryUnlock() {
      if (window.__AGENCY_MARKET__ && rec.bizKey === 'agency') {
        location.href = '../agency/order.html?svcId=' + encodeURIComponent(rec.id) + '&amount=' + (agencyOrderAmount(rec) || 0);
        return;
      }
      if (unlocked) { UI.toast(t.consultMode ? '已提交意向，可直接联系招商顾问' : '信息已解锁，可直接对接', 'ok'); return; }
      if (t.consultMode) { openConsult(rec, c); return; }
      /* G2：破冰期游客免费示例 —— 直接解锁当前条，计数 +1，不进入登录引导 */
      if (gate.isGuest && guestSampleInfo().available) {
        if (guestSampleSpend(rec && rec.id)) {
          unlock('破冰期游客福利：已免费查看完整信息');
          return;
        }
      }
      if (!gateAct(gate)) return; /* 游客/未实名：引导登录或实名，不进入支付 */
      openPay();
    }
    function unlock(okMsg) {
      var lockArea = $('lock-area');
      if (lockArea) {
        lockArea.classList.add('unlocked');
        var laBody = lockArea.querySelector('.la-body');
        if (laBody) {
          /* 禁用 CSS transition（部分环境 transition 不生效），用 JS 直接设置最终值 */
          laBody.style.transition = 'none';
          laBody.style.webkitTransition = 'none';
          laBody.style.maxHeight = Math.max(laBody.scrollHeight, 200) + 'px';
          laBody.style.opacity = '1';
          laBody.style.overflow = 'visible';
          /* 移除联系方式的模糊效果 */
          laBody.querySelectorAll('.v.masked').forEach(function (v) {
            v.style.transition = 'none';
            v.style.webkitTransition = 'none';
            v.style.filter = 'none';
            v.style.webkitFilter = 'none';
          });
        }
      }
      if ($('cta')) { $('cta').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' + (t.ctaText ? t.ctaText(rec, true) : '联系TA'); $('cta').classList.add('is-unlocked'); } /* [FIX BM-043] 解锁后 CTA 由橙变绿 */
      unlocked = true;
      UnlockStore.mark(rec);
      if (phoneEl) phoneEl.classList.add('is-unlocked');
      UI.toast(okMsg || '解锁成功', 'ok');
    }
    if ($('lock') && rec.bizKey !== 'personnel') $('lock').addEventListener('click', function (e) { if (e.target.closest('.la-paywall')) tryUnlock(); });
    /* P0：信息卡内就近打码元素（模糊值/文件锁层/就近解锁胶囊）点击 → 唤起同一个解锁 Sheet */
    var scrollEl = document.querySelector('.scroll');
    if (scrollEl && rec.bizKey !== 'personnel') {
      scrollEl.addEventListener('click', function (e) {
        if (unlocked) return;
        var hit = e.target.closest && e.target.closest('[data-pw],[data-pw-unlock]');
        if (hit) { e.preventDefault(); tryUnlock(); }
      });
    }
    /* 阶段三：personnel 回显投递状态 */
    if (rec.bizKey === 'personnel' && window.ApplyStore && ApplyStore.hasApplied(rec.id)) {
      var _aa = document.getElementById('apply-area');
      if (_aa) _aa.innerHTML = '<div class="aa-applied"><div class="aa-applied-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="aa-applied-text"><div class="aa-applied-title">投递成功，等待企业回复</div><div class="aa-applied-desc">企业将在24小时内查看您的投递</div></div><div class="aa-applied-status"><span class="aas-dot"></span>待回复</div></div>';
      var _cb = $('cta');
      if (_cb) _cb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>查看投递状态';
    }
    if ($('cta')) $('cta').addEventListener('click', function () {
      if (rec.bizKey === 'personnel') { if (window.ApplyStore && ApplyStore.hasApplied(rec.id)) { location.href = '../profile/my-applies.html'; return; } bindDeliverModalEvents(); checkDeliverPermission(rec, c); }
      else if (window.__AGENCY_MARKET__ && rec.bizKey === 'agency') {
        location.href = '../agency/order.html?svcId=' + encodeURIComponent(rec.id) + '&amount=' + (agencyOrderAmount(rec) || 0);
      }
      else if (t.consultMode) { if (!unlocked) openConsult(rec, c); else UI.toast('联系方式已开放，可直接拨打招商顾问电话', 'ok'); }
      else if (!unlocked) { tryUnlock(); }
    });
    if ($('actionbar')) $('actionbar').addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'fav') {
        var favItem = { id: rec.id, bizKey: rec.bizKey || 'supply', title: rec.title || rec.name || '收藏条目', type: rec.type || '', dir: rec.dir || '', location: rec.city || rec.location || '', amount: rec.price || rec.budget || '' };
        var isFav = window.FavoriteStore ? FavoriteStore.toggle(favItem) : false;
        el.classList.toggle('active', isFav);
        UI.toast(isFav ? '已收藏' : '已取消收藏', 'ok');
      }
      else if (el.dataset.act === 'share') {
        /* [FIX E2-07] 真实写入剪贴板，不再假复制；降级用 execCommand 兜底 */
        var shareUrl = location.href;
        var fallbackCopy = function (txt) {
          try {
            var ta = document.createElement('textarea');
            ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            var okCopy = document.execCommand('copy');
            document.body.removeChild(ta);
            UI.toast(okCopy ? '链接已复制' : '复制失败，请手动复制地址', okCopy ? 'ok' : 'warn');
          } catch (e) { UI.toast('复制失败，请手动复制地址', 'warn'); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () { UI.toast('链接已复制', 'ok'); }).catch(function () { fallbackCopy(shareUrl); });
        } else { fallbackCopy(shareUrl); }
      }
    });
    /* 初始化收藏按钮状态：从 FavoriteStore 读取当前条是否已收藏 */
    if ($('actionbar') && window.FavoriteStore) {
      var favBtn = $('actionbar').querySelector('[data-act="fav"]');
      if (favBtn && FavoriteStore.has(rec.id)) favBtn.classList.add('active');
    }
  }
  /* ---- 资质证照大图查看（带水印） ---- */
  function viewCert(name, no, date, expire) {
    var html = '<div style="padding:16px;">' +
      '<div style="text-align:center;margin-bottom:12px;"><div style="font-size:14px;font-weight:700;color:var(--text-1);">' + name + '</div>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px;">证书编号：' + no + ' · 发证：' + date + ' · 有效期至：' + expire + '</div></div>' +
      '<div style="position:relative;width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,var(--bg-card),var(--bg-alp));border-radius:12px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-30deg);font-size:20px;font-weight:700;color:rgba(201,169,97,.15);letter-spacing:.15em;white-space:nowrap;pointer-events:none;">ENGCHAIN · 工程链 · 仅供核验</div>' +
      '<div style="width:66px;height:66px;border-radius:50%;border:3px solid rgba(201,169,97,.4);display:flex;align-items:center;justify-content:center;color:rgba(201,169,97,.6);font-size:13px;font-weight:700;text-align:center;line-height:1.3;margin-bottom:10px;z-index:1;">资质<br>证书</div>' +
      '<div style="font-size:14px;font-weight:700;color:var(--text-1);z-index:1;padding:0 20px;text-align:center;">' + name + '</div>' +
      '<div style="font-size:10.5px;color:var(--text-3);margin-top:6px;z-index:1;">证书编号：' + no + '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:12px;font-size:10.5px;color:var(--text-3);">本证书图片仅供参考，实际以四库一平台查询为准</div>' +
      '</div>';
    UI.sheet({ title: '资质证照', body: html, cta: '关闭' });
  }
  /* ---- PDF 浏览 ---- */
  function viewPdf(name) {
    var fid = 'pdf_' + name.replace(/[^a-zA-Z0-9]/g, '_');
    if (window.FileDownload) {
      var rec = window.FileDownload.get(fid);
      if (rec && rec.status === 'completed') {
        /* 已缓存：直接打开预览 */
      } else if (rec && rec.status === 'downloading') {
        UI.toast('文件下载中，请稍候', 'info');
        return;
      } else {
        /* 未下载：先开始下载再预览 */
        window.FileDownload.start(fid, name, 2048);
      }
    }

    var html = '<div style="padding:16px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
      '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#e74c3c,#c0392b);display:flex;align-items:center;justify-content:center;color:#fff;flex:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:20px;height:20px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
      '<div style="min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
      '<div style="font-size:10.5px;color:var(--text-3);margin-top:2px;">PDF 在线预览 · 工程链</div></div></div>' +
      '<div style="width:100%;aspect-ratio:3/4;background:var(--bg-card);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" style="width:40px;height:40px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '<div style="font-size:12px;color:var(--text-3);">PDF 预览区域</div>' +
      '<div style="font-size:10px;color:var(--text-4);">（原型演示 · 实际环境嵌入 PDF.js 渲染）</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;">' +
      '<button onclick="UI.toast(\'下载中...\',\'ok\')" style="flex:1;padding:11px;border-radius:10px;border:none;background:var(--primary);color:var(--text-inv);font-size:13px;font-weight:600;cursor:pointer;">下载 PDF</button>' +
      '<button onclick="UI.closeSheet()" style="flex:1;padding:11px;border-radius:10px;border:1px solid var(--line);background:var(--bg-card);color:var(--text-2);font-size:13px;font-weight:600;cursor:pointer;">关闭</button>' +
      '</div></div>';
    UI.sheet({ title: '文件预览', body: html });
  }
  /* ---- PDF 下载 / 上传 ---- */
  function downloadPdf(name) {
    var id = 'pdf_' + name.replace(/[^a-zA-Z0-9]/g, '_');
    if (window.FileDownload) {
      var rec = window.FileDownload.get(id);
      if (rec && rec.status === 'completed') {
        UI.toast('文件已缓存，直接查看', 'ok');
        return;
      }
      window.FileDownload.start(id, name, 2048);
      UI.toast('开始下载：' + name, 'ok');
    } else {
      UI.toast('正在下载：' + name, 'ok');
    }
  }
  /* uploadPdf 已移除（信息浏览页不提供上传入口） */
  /* ---- 全国招商区域地图弹窗 ---- */
  var _mapRec = null;
  /* 原全国地图城市坐标已移除（弹窗改为区域明细列表） */
  function openRegionMap() {
    _mapRec = DETAIL._currentRec;
    if (!_mapRec || !_mapRec.nationalRegions) { UI.toast('暂无全国区域数据', 'err'); return; }
    var nr = _mapRec.nationalRegions;
    var vacant = 0, limited = 0, full = 0;
    nr.forEach(function (r) { if (r.status === 'full') full++; else if (r.status === 'limited') limited++; else vacant++; });
    var modalId = 'regionMapModal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'map-modal';
    function badge(r) {
      if (r.status === 'full') return '<span class="rm-badge is-full">已满</span>';
      if (r.status === 'limited') return '<span class="rm-badge is-limited">仅剩' + (r.count || 1) + '席</span>';
      return '<span class="rm-badge is-vacant">空缺</span>';
    }
    function cityStatus(c) {
      if (c.status === 'full') return 'is-full';
      if (c.status === 'limited') return 'is-limited';
      return 'is-vacant';
    }
    function cityLabel(c) {
      if (c.status === 'full') return '已满';
      if (c.status === 'limited') return '仅剩' + (c.seats || 1) + '席';
      return '空缺';
    }
    /* 城市明细列表行（关键样式内联，规避样式表缓存错配导致文字不可见） */
    function cityRows(r) {
      if (!r.cities || !r.cities.length) {
        return '<div class="rm-city-empty" style="padding:8px 10px;font-size:10.5px;color:var(--text-3);text-align:center;">暂无城市明细，可直接咨询总部</div>';
      }
      return r.cities.map(function (c) {
        var s = cityStatus(c);
        var dotC = s === 'is-vacant' ? '#2b6b4f' : (s === 'is-limited' ? '#d48806' : '#c4cad4');
        var stC = s === 'is-vacant' ? '#0f7b55' : (s === 'is-limited' ? '#c07c10' : 'var(--text-3)');
        return '<div class="rm-city-row" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg-card-2);">' +
          '<span class="rc-dot ' + s + '" style="width:6px;height:6px;border-radius:50%;flex:none;background:' + dotC + ';"></span>' +
          '<span class="rc-name" style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--text-1);">' + c.name + '</span>' +
          '<span class="rc-status ' + s + '" style="flex:none;font-size:11px;font-weight:600;color:' + stC + ';">' + cityLabel(c) + '</span>' +
          '</div>';
      }).join('');
    }
    /* 搜索关键词：省份名 + 全部城市名 */
    function provKey(r) {
      var keys = [r.province].concat((r.cities || []).map(function (c) { return c.name; }));
      return keys.join(' ');
    }
    modal.innerHTML = '<div class="mm-panel">' +
      '<div class="mm-head"><div class="mm-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:16px;height:16px;color:var(--primary-dim);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>全国招商区域明细</div>' +
      '<button class="mm-close" onclick="DETAIL.closeRegionMap()">×</button></div>' +
      '<div class="mm-stats">' +
      '<div class="ms-item"><div class="ms-num">' + nr.length + '</div><div class="ms-label">覆盖省份</div></div>' +
      '<div class="ms-item"><div class="ms-num green">' + vacant + '</div><div class="ms-label">空缺可加盟</div></div>' +
      '<div class="ms-item"><div class="ms-num orange">' + limited + '</div><div class="ms-label">仅剩席位</div></div>' +
      '</div>' +
      '<div class="rm-search">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input class="rm-search-input" type="text" placeholder="搜索省份 / 城市" autocomplete="off" />' +
      '<button class="rm-search-clear" type="button">×</button>' +
      '</div>' +
      '<div class="rm-list" id="rmList">' + nr.map(function (r) {
        return '<div class="rm-group" data-k="' + provKey(r).replace(/"/g, '&quot;') + '">' +
          '<div class="rm-group-head">' +
          '<span class="rm-prov-name">' + r.province + '</span>' +
          (r.count ? '<span class="rm-count">可开放 ' + r.count + ' 席</span>' : '') +
          badge(r) + '</div>' +
          '<div class="rm-group-city">' + cityRows(r) + '</div>' +
          '</div>';
      }).join('') +
      '<div class="rm-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><b>未找到匹配的区域</b><span>换个省份或城市关键词试试</span></div>' +
      '</div>' +
      '<div class="rm-foot">区域数据由总部招商中心维护 · 实时更新</div></div>';
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('open'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) DETAIL.closeRegionMap(); });
    /* 搜索：模糊匹配省份/城市，输入即过滤，空结果显示占位 */
    var input = modal.querySelector('.rm-search-input');
    var clearBtn = modal.querySelector('.rm-search-clear');
    var emptyEl = modal.querySelector('.rm-empty');
    var groupEls = modal.querySelectorAll('.rm-group');
    function applyFilter() {
      var q = (input.value || '').trim().toLowerCase();
      var hit = 0;
      groupEls.forEach(function (el) {
        var ok = !q || (el.getAttribute('data-k') || '').toLowerCase().indexOf(q) !== -1;
        el.style.display = ok ? '' : 'none';
        if (ok) hit++;
      });
      clearBtn.classList.toggle('show', !!q);
      emptyEl.classList.toggle('show', !!q && hit === 0);
    }
    input.addEventListener('input', applyFilter);
    clearBtn.addEventListener('click', function () { input.value = ''; applyFilter(); input.focus(); });
  }

  function closeRegionMap() {
    var modal = document.getElementById('regionMapModal');
    if (modal) { modal.classList.remove('open'); setTimeout(function () { if (modal.parentNode) modal.remove(); }, 300); }
  }
  /* _mapZoom 已随地图组件移除 */
  /* ================= 发布信息（publish）：信息工作台发布项的通用详情渲染器 ================= */
  /* 发布者自持信息（isFree 已放行），完整结构化字段 → 关键参数/描述/联系/发布主体/流程/保障 */
  function publishMeta(r) {
    var meta = [];
    if (r.location) meta.push(mt('pin', r.location));
    if (typeof r.matches === 'number' && r.matches > 0) meta.push(mt('check', r.matches + ' 匹配'));
    else if (typeof r.match === 'number') meta.push(mt('check', 'AI匹配 ' + r.match + '%'));
    if (typeof r.views === 'number') meta.push(mt('eye', r.views + ' 浏览'));
    return meta;
  }
  function publishHero(r, c) {
    var d = dirTag(r.role || r.dir);
    var price = r.price ? (r.price + (r.unit ? ' ' + r.unit : '')) : '';
    return dHero({ tag: d.txt + ' · ' + (r.category || '发布'), verifiedHint: (r.company ? '已认证 · ' + r.company : '已认证'), title: r.title, price: price, unit: '', meta: publishMeta(r) });
  }
  function publishBody(r, c) {
    var locked = !UnlockStore.isUnlocked(r);
    var h = '';
    var params = [];
    if (r.category) params.push({ k: '品类', v: r.category });
    if (r.subType) params.push({ k: '子类 / 品名', v: r.subType });
    if (r.qty) params.push({ k: '数量 / 规模', v: r.qty });
    if (r.spec) params.push({ k: '规格 / 参数', v: r.spec });
    var _pl = { '招聘': '薪资范围', '求职': '期望薪资', '建企买卖': '意向预算', '资质招商': '意向费用' }[r.category];
    if (r.price) params.push({ k: _pl || (r.role === 'supply' ? '报价单价' : '预算区间'), v: r.price + (r.unit ? ' ' + r.unit : '') });
    if (r.delivery) params.push({ k: '交付 / 工期', v: r.delivery });
    if (r.qualification) params.push({ k: '资质要求', v: r.qualification });
    /* 建企买卖收购需求：标的四要素（标的/负债/人员/税务） */
    if (r.tradeInfo) {
      var _ti = r.tradeInfo;
      if (_ti.qualCat) params.push({ k: '目标资质', v: _ti.qualCat + (_ti.level ? ' · ' + _ti.level : '') + (_ti.anxu ? ' · ' + _ti.anxu : '') });
      if (_ti.region) params.push({ k: '目标区域', v: _ti.region });
      if (_ti.debt) params.push({ k: '负债要求', v: _ti.debt });
      if (_ti.staff) params.push({ k: '人员要求', v: _ti.staff });
      if (_ti.tax) params.push({ k: '税务要求', v: _ti.tax });
    }
    if (r.tags && r.tags.length) params.push({ k: '标签', v: r.tags.join(' · ') });
    if (params.length) h += sec('关键参数', dList(params));
    if (r.description) h += sec('详细描述', '<div class="ds-text">' + renderMarkdown(r.description) + '</div>');
    var cc = r.contact || {};
    var contactRows = [];
    if (cc.name) contactRows.push({ k: '联系人', v: cc.name });
    if (cc.phone) contactRows.push({ k: '联系电话', v: Lock.partial(cc.phone, locked) });
    if (cc.wechat) contactRows.push({ k: '微信号', v: Lock.full(cc.wechat, locked) });
    if (r.address) contactRows.push({ k: '联系地址', v: Lock.full(r.address, locked) });
    if (contactRows.length) h += sec('联系方式', dList(contactRows));
    var subject = [];
    if (r.company) subject.push({ k: '发布主体', v: r.company });
    if (r.address) subject.push({ k: '主体地址', v: r.address });
    if (subject.length) h += sec('发布主体', dList(subject));
    h += sec('对接流程', '<div class="ds-text"><div style="display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-2);line-height:1.6;">' +
      '<div style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary-dim);font-family:var(--font-num);font-weight:700;">1</span>平台核验信息真实性，双方实名认证</div>' +
      '<div style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary-dim);font-family:var(--font-num);font-weight:700;">2</span>线上沟通留痕，确认需求 / 报价与交付细节</div>' +
      '<div style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary-dim);font-family:var(--font-num);font-weight:700;">3</span>签订标准合同，节点资金第三方监管</div>' +
      '<div style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary-dim);font-family:var(--font-num);font-weight:700;">4</span>验收结算，纠纷平台介入调解</div></div></div>');
    h += Lock.inline(locked, '解锁联系方式，直接对接发布方', '完整电话 · 微信 · 成交确认', '¥0 · 免费解锁');
    return h;
  }
  byType.publish = {
    label: '发布信息', verified: '已认证', inlineLock: true,
    ctaText: function (r, unlocked) { return unlocked ? '联系发布方 · 信息已解锁' : '解锁联系方式'; },
    ctaLocked: '解锁联系方式',
    hero: function (r, c) { return publishHero(r, c); },
    sections: function (r, c) { return publishBody(r, c); },
    lockRows: function () { return []; },
    unlockItems: function () { return ['发布方完整联系电话', '微信号', '精确联系地址', '成交 / 报价明细', '资质与证明文件']; }
  };
  /* 跨 tab 自动重渲染：收藏状态变更后同步按钮 */
  function syncFavBtn() {
    try {
      if (!_currentRec) return;
      var favBtn = document.querySelector('[data-act="fav"], .action-fav, [data-action="fav"], .fav-btn');
      if (!favBtn) {
        var btns = document.querySelectorAll('.actionbar button, .bar-actions button, .detail-actionbar button');
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].dataset && (btns[i].dataset.act === 'fav' || btns[i].dataset.action === 'fav')) { favBtn = btns[i]; break; }
          if (btns[i].querySelector && btns[i].querySelector('use[href="#i-fav"]')) { favBtn = btns[i]; break; }
        }
      }
      if (favBtn && window.FavoriteStore) {
        if (FavoriteStore.has(_currentRec.id)) favBtn.classList.add('active');
        else favBtn.classList.remove('active');
      }
    } catch (e) { console.warn('syncFavBtn failed:', e); }
  }
  var _detailRerender = null;
  function _detailRefresh() { if (_detailRerender) clearTimeout(_detailRerender); _detailRerender = setTimeout(syncFavBtn, 100); }
  window.addEventListener('storage', function (e) { if (e.key === 'engchain-favorites') _detailRefresh(); });
  window.addEventListener('engchain:favorite', _detailRefresh);
  window.addEventListener('engchain:store-change', function (e) { if (e && e.detail && e.detail.key === 'engchain-favorites') _detailRefresh(); });
  return { byType: byType, attach: attach, viewCert: viewCert, viewPdf: viewPdf, downloadPdf: downloadPdf, openRegionMap: openRegionMap, closeRegionMap: closeRegionMap, _currentRec: null, syncFavBtn: syncFavBtn, UnlockStore: UnlockStore }; /* [FIX BM-014/BM-016] 对外暴露 UnlockStore 供跨页/跨脚本访问 */
})();
