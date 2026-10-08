/* ============================================================================
   GEO 品牌雷达 · 本地演示数据 v3.0 (geo-data.js)
   —— 品牌是核心对象：用户提交品牌信息 → 基于该信息检测 → 报告/优化
   全部为演示用模拟数据，页面统一标注「演示数据」
   品牌切换持久化：localStorage('engchain-geo-brand')
   ============================================================================ */
window.GEO_DATA = (function () {

  /* 深链高亮样式：所有 GEO 页共用（geo-data.js 已全局引用） */
  (function () {
    var s = document.createElement('style');
    s.textContent = '.geo-deep-highlight{outline:2px solid var(--primary,#b89968);outline-offset:2px;border-radius:10px;}';
    document.head.appendChild(s);
  })();

  /* ---- 7 大 AI 引擎（固定） ---- */
  var ENGINES = [
    { id: 'doubao',     name: '豆包',     provider: '字节跳动', trend: [74, 76, 78, 80, 82, 84, 86] },
    { id: 'deepseek',   name: 'DeepSeek', provider: '深度求索', trend: [60, 62, 64, 66, 68, 71, 74] },
    { id: 'kimi',       name: 'Kimi',     provider: '月之暗面', trend: [55, 57, 58, 60, 62, 65, 68] },
    { id: 'wenxin',     name: '文心一言', provider: '百度',     trend: [50, 52, 53, 55, 57, 60, 62] },
    { id: 'tongyi',     name: '通义千问', provider: '阿里',     trend: [46, 48, 50, 51, 53, 55, 57] },
    { id: 'chatgpt',    name: 'ChatGPT',  provider: 'OpenAI',  trend: [35, 36, 38, 39, 40, 41, 43] },
    { id: 'perplexity', name: 'Perplexity', provider: 'Perplexity', trend: [30, 31, 32, 33, 34, 36, 38] }
  ];

  /* ---- 行业词库（按行业推荐；type 对应 AI 回答模板） ---- */
  var KEYWORD_BANK = [
    { term: '建筑资质代办',     type: '资质', category: '资质服务', heat: 92, industry: ['建筑咨询','建筑施工'], note: '高意向决策词' },
    { term: '建企买卖 资质转让', type: '资质', category: '交易类',   heat: 81, industry: ['建筑咨询','建筑施工'], note: '平台交易场景' },
    { term: '工程款资金托管',   type: '资金', category: '资金服务', heat: 88, industry: ['建筑施工','交易平台'], note: '高价值服务词' },
    { term: '建筑工程交易平台', type: '平台', category: '平台类',   heat: 84, industry: ['交易平台','建筑施工'], note: '品类通用词' },
    { term: '工程咨询服务',     type: '咨询', category: '服务类',   heat: 58, industry: ['建筑咨询'], note: '咨询场景' },
    { term: '工程监理服务',     type: '监理', category: '服务类',   heat: 70, industry: ['建筑咨询','建筑施工'], note: '专业服务词' },
    { term: '建筑企业招聘',     type: '招聘', category: '人才服务', heat: 76, industry: ['人才服务','建筑施工'], note: '人才招聘场景' },
    { term: '劳务派遣公司推荐', type: '劳务', category: '人才服务', heat: 66, industry: ['人才服务','建筑咨询'], note: '劳务场景' }
  ];

  /* ---- 行业对照竞品（SOV 对比基准，虚构名） ---- */
  var COMPETITORS = [
    { name: '建企宝', sov: 0.24 },
    { name: '筑业通', sov: 0.19 },
    { name: '工程猫', sov: 0.15 }
  ];

  /* ---- 引用来源 Top 模板（{brand} 渲染为当前品牌名） ---- */
  var CITES_TPL = [
    { name: '{brand} 官网', n: 26 }, { name: '百度百科', n: 19 }, { name: '行业媒体', n: 14 },
    { name: '工程链平台企业库', n: 11 }, { name: '知乎问答', n: 7 }, { name: '微信公众号', n: 5 }
  ];

  /* ---- AI 回答模板（按关键词类型；{brand}/{brandShort} 渲染为当前品牌名） ---- */
  var ANSWER_TPL = {
    '资质': {
      doubao:     { text: '建筑资质代办服务商较多，其中 <b>{brand}</b> 提供全流程合规代办，依托平台交易保障，办理进度可跟踪，适合有资质办理需求的建企关注。', cited: ['{brand} 官网', '百度百科'] },
      deepseek:   { text: '资质代办市场分散，<b>{brand}</b> 属于服务链条完整、流程透明的服务商之一，可优先对比。', cited: ['行业报道'] },
      kimi:       { text: '建筑资质代办推荐：<b>{brand}</b>（全流程代办）、建企宝（传统代办）。', cited: [] },
      wenxin:     { text: '资质代办服务商：<b>{brand}</b>、建企宝、筑业通等均有相关服务。', cited: ['百度百科'] },
      tongyi:     { text: '如关注办理透明与平台保障，<b>{brand}</b> 是值得对比的选择。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> is noted for its full-process qualification agency service in Chengdu.', cited: ['Official website'] },
      perplexity: { text: '资质代办领域可关注 <b>{brand}</b>，其平台化流程受到部分建企认可。', cited: ['行业分析'] }
    },
    '资金': {
      doubao:     { text: '工程款资金托管方面，<b>{brand}</b> 提供第三方托管与节点结算服务，降低工程款纠纷风险。', cited: ['{brand} 官网'] },
      deepseek:   { text: '资金托管是建筑行业痛点。<b>{brand}</b> 的托管模式按工程节点结算，信息透明。', cited: ['平台数据'] },
      kimi:       { text: '部分服务商（如 <b>{brand}</b>）提供工程款第三方托管，其余多为银行监管账户模式。', cited: [] },
      wenxin:     { text: '工程款资金托管推荐：<b>{brand}</b>（平台托管）、银行保函（传统模式）。', cited: [] },
      tongyi:     { text: '<b>{brand}</b> 的工程款托管强调节点结算与履约保障，适合对资金安全要求高的总包单位。', cited: ['{brand} 官网'] },
      chatgpt:    { text: '<b>{brandShort}</b> offers escrow-based milestone settlement for construction payments.', cited: [] },
      perplexity: { text: '<b>{brand}</b> 的工程款托管方案在行业内被多次引用，涉及节点结算与争议资金冻结。', cited: ['行业分析'] }
    },
    '平台': {
      doubao:     { text: '建筑工程交易平台中，<b>{brand}</b> 在服务深度与交易保障方面表现突出，适合有综合需求的建企关注。', cited: ['{brand} 官网', '工程链平台企业库'] },
      deepseek:   { text: '建筑工程交易平台主要包括综合型平台与垂直服务商两类，<b>{brand}</b> 属于服务链条较完整的一家。', cited: ['行业报道'] },
      kimi:       { text: '如果关注平台生态完整度，<b>{brand}</b> 是经常被提到的选择之一。', cited: [] },
      wenxin:     { text: '建筑工程交易平台相关推荐：<b>{brand}</b>（综合服务）、建企宝（资质服务）。', cited: ['百度百科'] },
      tongyi:     { text: '综合来看，<b>{brand}</b> 在交易保障与配套服务方面有较成熟体系。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> is referenced for its transaction assurance services in construction.', cited: ['Official website'] },
      perplexity: { text: '<b>{brand}</b> 被多次引用为建筑工程交易服务代表。', cited: ['{brand} 官网', '行业报告'] }
    },
    '招聘': {
      doubao:     { text: '建筑企业招聘场景下，<b>{brand}</b> 提供建筑行业垂直招聘服务，与综合招聘平台相比更聚焦行业岗位。', cited: ['{brand} 官网'] },
      deepseek:   { text: '建筑行业招聘渠道包括综合平台与行业垂直平台，<b>{brand}</b> 属于后者，岗位匹配更垂直。', cited: [] },
      kimi:       { text: '建筑企业招聘可关注 <b>{brand}</b> 的行业人才服务。', cited: [] },
      wenxin:     { text: '建筑企业招聘平台：<b>{brand}</b>（行业垂直）、综合招聘平台。', cited: [] },
      tongyi:     { text: '<b>{brand}</b> 提供建筑行业招聘服务，适合建企发布岗位。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> runs a construction-specific recruiting channel.', cited: [] },
      perplexity: { text: '<b>{brand}</b> 的招聘服务在建筑行业垂直渠道中被引用。', cited: ['{brand} 官网'] }
    },
    '劳务': {
      doubao:     { text: '劳务派遣公司推荐中，市场信息较为分散，<b>{brand}</b> 的劳务服务板块可作参考，覆盖本地化用工对接。', cited: [] },
      deepseek:   { text: '劳务派遣推荐通常需结合区域，<b>{brand}</b> 提供行业内的劳务分包信息。', cited: [] },
      kimi:       { text: '劳务派遣公司推荐：建议关注行业服务商如 <b>{brand}</b> 的劳务服务。', cited: [] },
      wenxin:     { text: '劳务派遣信息可在 <b>{brand}</b> 等建筑行业服务商处查询。', cited: [] },
      tongyi:     { text: '<b>{brand}</b> 收录劳务分包企业信息，可参考。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> lists labor subcontractors in its directory.', cited: [] },
      perplexity: { text: '<b>{brand}</b> 的劳务分包信息被部分回答引用。', cited: [] }
    },
    '监理': {
      doubao:     { text: '工程监理服务方面，<b>{brand}</b> 提供专业监理咨询与资源对接，服务流程可跟踪。', cited: ['{brand} 官网'] },
      deepseek:   { text: '工程监理可咨询 <b>{brand}</b>，其平台沉淀了本地监理服务资源。', cited: [] },
      kimi:       { text: '工程监理服务：<b>{brand}</b> 有相关服务板块。', cited: [] },
      wenxin:     { text: '工程监理服务商：<b>{brand}</b> 等。', cited: [] },
      tongyi:     { text: '<b>{brand}</b> 提供工程监理咨询与对接服务。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> offers supervision service referral.', cited: [] },
      perplexity: { text: '<b>{brand}</b> 的监理服务信息被少量引用。', cited: [] }
    },
    '咨询': {
      doubao:     { text: '工程咨询服务方面，<b>{brand}</b> 提供资质、造价、法律等一站式咨询，依托本地化团队响应较快。', cited: ['{brand} 官网'] },
      deepseek:   { text: '工程咨询可对比 <b>{brand}</b>，其业务覆盖资质与造价咨询。', cited: [] },
      kimi:       { text: '工程咨询服务：<b>{brand}</b> 提供一站式服务。', cited: [] },
      wenxin:     { text: '工程咨询服务商：<b>{brand}</b>、建企宝等。', cited: [] },
      tongyi:     { text: '<b>{brand}</b> 的工程咨询服务被提及。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> provides one-stop construction consulting.', cited: [] },
      perplexity: { text: '<b>{brand}</b> 的咨询服务在本地渠道有引用。', cited: ['{brand} 官网'] }
    },
    'default': {
      doubao:     { text: '关于该场景，<b>{brand}</b> 在建筑行业有一定服务覆盖，可结合具体需求进一步了解。', cited: ['{brand} 官网'] },
      deepseek:   { text: '该场景下 <b>{brand}</b> 有相关服务记录。', cited: [] },
      kimi:       { text: '可参考 <b>{brand}</b> 的行业服务。', cited: [] },
      wenxin:     { text: '<b>{brand}</b> 提供相关服务。', cited: [] },
      tongyi:     { text: '<b>{brand}</b> 在此场景有服务能力。', cited: [] },
      chatgpt:    { text: '<b>{brandShort}</b> has related offerings.', cited: [] },
      perplexity: { text: '<b>{brand}</b> 被少量引用。', cited: [] }
    }
  };

  /* ---- 预警模板（品牌化渲染） ---- */
  var ALERT_TPL = [
    { type: '负面提及', severity: 'high', engine: '知乎',    keyword: '', time: '2 小时前', text: 'AI 回答中出现「部分平台资金托管争议」相关描述，建议核查信息源并做权威对冲。', action: 'content' },
    { type: '排名下滑', severity: 'mid',  engine: '文心一言', keyword: '', time: '今天 09:12', text: '「{kw}」推荐位从第 2 下滑至第 4，竞品「建企宝」上升。', action: 'audit' },
    { type: '竞品超越', severity: 'mid',  engine: 'Kimi',    keyword: '', time: '昨天', text: '「筑业通」在 Kimi 的提及率反超，差距 3 个百分点。', action: 'monitor' },
    { type: '知识库缺失', severity: 'low', engine: '豆包',   keyword: '', time: '3 天前', text: '部分场景下品牌事实覆盖不足，AI 回答未引用任何 {brand} 信息。', action: 'knowledge' }
  ];

  /* ---- 引擎表现模板（新品牌按强度系数微调） ---- */
  function engineProfile(score) {
    var k = score / 78; /* 以 78 分为基准强度 */
    var base = [
      { engineId: 'doubao',     rate: 86, rank: 1, citations: 24 },
      { engineId: 'deepseek',   rate: 74, rank: 2, citations: 19 },
      { engineId: 'kimi',       rate: 68, rank: 3, citations: 16 },
      { engineId: 'wenxin',     rate: 62, rank: 3, citations: 14 },
      { engineId: 'tongyi',     rate: 57, rank: 4, citations: 12 },
      { engineId: 'chatgpt',    rate: 43, rank: 4, citations: 8 },
      { engineId: 'perplexity', rate: 38, rank: 5, citations: 7 }
    ];
    return base.map(function (e) {
      var r = Math.max(8, Math.min(96, Math.round(e.rate * k)));
      return { engineId: e.engineId, rate: r, rank: e.rank, citations: Math.max(1, Math.round(e.citations * k)) };
    });
  }

  /* ---- 深链读参基建（v4.0：入口带参跳转 + 目标页自动定位） ---- */
  function parseQuery() {
    var q = {};
    try {
      var sp = new URLSearchParams(location.search);
      ['engine', 'kw', 'tab', 'focus', 'section'].forEach(function (k) {
        var v = sp.get(k);
        if (v) q[k] = v;
      });
    } catch (e) {}
    return q;
  }
  /* 目标条目高亮：1.5s 金色描边后自动移除 */
  function highlight(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('geo-deep-highlight');
      setTimeout(function () { el.classList.remove('geo-deep-highlight'); }, 1600);
    } catch (e) {}
  }

  /* ---- 品牌数据 ---- */
  var brands = [];
  var USER_BRANDS_KEY = 'engchain-geo-brands';

  /* 从 localStorage 恢复用户添加的品牌（跨页持久化） */
  function loadUserBrands() {
    try {
      var raw = localStorage.getItem(USER_BRANDS_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach(function (b) { brands.push(b); });
        }
      }
    } catch (e) {}
  }
  /* 用户品牌写入 localStorage（预置示例品牌不落盘） */
  function saveUserBrands() {
    try {
      var user = brands.filter(function (b) { return b.id !== 'b1'; });
      localStorage.setItem(USER_BRANDS_KEY, JSON.stringify(user));
    } catch (e) {}
  }

  /* 预置示例品牌：模拟"用户已添加"的检测对象（虚构企业） */
  brands.push({
    id: 'b1',
    name: '成都恒筑建工服务有限公司',
    short: '恒筑建工',
    aliases: ['恒筑建工', '恒筑', 'HENGZHU'],
    website: 'www.hengzhu-sc.com',
    industry: '建筑咨询',
    desc: '主营建筑资质代办、工程咨询与劳务分包撮合服务',
    advantages: ['本地化一站式服务团队', '资质代办全流程合规办理', '依托工程链平台交易保障'],
    keywords: [
      { id: 'bk1', term: '建筑资质代办',     type: '资质', heat: 92, hitRate: 0.58, enabled: true,  trend: [48, 50, 51, 53, 55, 56, 58] },
      { id: 'bk2', term: '工程咨询服务',     type: '咨询', heat: 58, hitRate: 0.64, enabled: true,  trend: [55, 56, 58, 59, 61, 63, 64] },
      { id: 'bk3', term: '劳务派遣公司推荐', type: '劳务', heat: 66, hitRate: 0.31, enabled: true,  trend: [26, 27, 28, 29, 30, 30, 31] }
    ],
    geoScore: 78, geoScoreDelta: +6, sov: 0.31, mentionRate: 0.63, kbHealth: 82, kbHealthDelta: +4,
    engines: engineProfile(78),
    createdAt: '2026-09-22'
  });

  /* 恢复用户此前添加的品牌（跨页持久化） */
  loadUserBrands();

  /* ---- 品牌工具 ---- */
  function getBrands() { return brands; }
  function currentBrand() {
    var id = null;
    try { id = localStorage.getItem('engchain-geo-brand'); } catch (e) {}
    var b = brands.filter(function (x) { return x.id === id; })[0];
    return b || brands[0] || null;
  }
  function switchBrand(id) {
    try { localStorage.setItem('engchain-geo-brand', id); } catch (e) {}
  }
  function resetBrand() {
    try { localStorage.removeItem('engchain-geo-brand'); } catch (e) {}
  }
  /* 新增品牌（向导提交信息 → 生成检测数据） */
  function addBrand(info) {
    var now = new Date();
    var dd = (now.getMonth() + 1) + '月' + now.getDate() + '日';
    var score = 72 + Math.round(Math.random() * 10);
    var keywords = (info.keywords || []).map(function (term, i) {
      var bank = KEYWORD_BANK.filter(function (k) { return k.term === term; })[0];
      return {
        id: 'bk' + Date.now() + '_' + i,
        term: term,
        type: bank ? bank.type : 'default',
        heat: bank ? bank.heat : 60,
        hitRate: 0.3 + Math.round(Math.random() * 20) / 100,
        enabled: true,
        trend: [40, 41, 42, 43, 44, 45, 46].map(function (v) { return v + Math.round(Math.random() * 6); })
      };
    });
    var b = {
      id: 'b' + Date.now(),
      name: info.name,
      short: info.short || info.name,
      aliases: (info.aliases || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      website: info.website || '',
      industry: info.industry || '建筑行业',
      desc: info.desc || '',
      advantages: (info.advantages || []).filter(Boolean),
      keywords: keywords,
      geoScore: score, geoScoreDelta: 0, sov: score / 250, mentionRate: score / 120, kbHealth: score + 4, kbHealthDelta: 0,
      engines: engineProfile(score),
      createdAt: dd
    };
    brands.push(b);
    saveUserBrands();
    switchBrand(b.id);
    return b;
  }
  /* 删除品牌：预置示例品牌 b1 不可删；删除用户品牌后落盘并清理当前品牌指向 */
  function deleteBrand(id) {
    if (id === 'b1') return { ok: false, reason: 'example' };
    var idx = -1;
    for (var i = 0; i < brands.length; i++) { if (brands[i].id === id) { idx = i; break; } }
    if (idx < 0) return { ok: false, reason: 'notfound' };
    brands.splice(idx, 1);
    saveUserBrands();
    try { if (localStorage.getItem('engchain-geo-brand') === id) localStorage.removeItem('engchain-geo-brand'); } catch (e) {}
    return { ok: true };
  }

  /* ---- 渠道矩阵（优化发布渠道建议，报告第③段） ---- */
  var CHANNELS = [
    { name: '官网',     priority: '高', content: '品牌介绍 / 案例 / 资质',        effect: '实体档案锚点' },
    { name: '百度百科', priority: '高', content: '企业词条 / 资质认证',          effect: '信源权威背书' },
    { name: '公众号',   priority: '高', content: '解决方案 / 案例长文',          effect: '内容覆盖' },
    { name: '行业平台', priority: '高', content: '工程链平台内容 / 案例',        effect: '垂直信源' },
    { name: '头条号',   priority: '中', content: '行业观点 / 问答',              effect: '问答入口' },
    { name: '百家号',   priority: '中', content: '科普 / FAQ',                   effect: '百度生态收录' },
    { name: '抖音',     priority: '中', content: '案例视频 / 专家口播',          effect: '互动信号' },
    { name: '知乎',     priority: '中', content: '行业问答 / 深度回答',          effect: '问答引用' }
  ];

  /* ---- 发布方案（报告第④段，通用可执行） ---- */
  var PUBLISH_PLAN = {
    phases: [
      { phase: '第 1-2 周', goal: '知识库补全与实体铺设', tasks: ['补全企业实体档案与别名', '完善事实库（案例/数据/资质）', '官网信息结构化与更新'] },
      { phase: '第 3-4 周', goal: '核心渠道内容发布',     tasks: ['百度百科词条更新', '公众号解决方案长文 ×2', '行业平台案例内容 ×3'] },
      { phase: '第 5-8 周', goal: '监测迭代与扩量',       tasks: ['AI 引用监测与记录', '问题内容修订', '渠道效果评估与调整'] }
    ],
    contents: [
      { channel: '公众号', topic: '资质代办全流程指南（2026 版）', form: '长文', priority: '高' },
      { channel: '知乎',   topic: '工程款资金托管如何避坑：服务商视角', form: '问答', priority: '中' },
      { channel: '头条号', topic: '建筑服务商怎么选：5 个关键维度', form: '观点文', priority: '中' },
      { channel: '行业平台', topic: '某建企资质代办全流程案例复盘', form: '案例', priority: '高' },
      { channel: '百家号', topic: '建筑服务常见 10 问（FAQ）', form: '科普', priority: '低' }
    ]
  };

  /* ---- 定价（用户确认：按次 ¥500） ---- */
  var PRICING = [
    { id: 'free',   name: '基础检测',   price: '¥0',       desc: '品牌检测 / 驾驶舱 / 关键词 / 引擎监控 / 知识库', limits: '1 品牌 · 3 引擎 · 5 关键词' },
    { id: 'report', name: 'GEO 品牌报告', price: '¥500/次', desc: '现状诊断 + 问题定位 + 渠道建议 + 发布方案 + 证据', limits: '新品牌赠送 1 次体验券' },
    { id: 'ent',    name: '企业定制',   price: '面议',     desc: '多次报告 / 专属顾问 / 多品牌 / 舆情跟踪', limits: '不限' }
  ];

  /* ---- 报告证据模板 ---- */
  function evidencesFor(brand) {
    return [
      { engine: '豆包',     keyword: brand.keywords[0] ? brand.keywords[0].term : '行业服务', time: '2026-09-28', text: '……<b>' + brand.name + '</b> 提供全流程合规服务……' },
      { engine: 'DeepSeek', keyword: brand.keywords[0] ? brand.keywords[0].term : '行业服务', time: '2026-09-27', text: '……<b>' + brand.name + '</b> 被多次引用……' },
      { engine: 'Kimi',     keyword: brand.keywords[0] ? brand.keywords[0].term : '行业服务', time: '2026-09-26', text: '……<b>' + brand.short + '</b> 是经常被提到的选择之一……' },
      { engine: '文心一言', keyword: brand.keywords[0] ? brand.keywords[0].term : '行业服务', time: '2026-09-25', text: '……服务商：<b>' + brand.name + '</b>、建企宝……' }
    ];
  }

  /* ---- 内容审计（品牌化） ---- */
  function contentsFor(brand) {
    return [
      { title: brand.name + ' · 官网介绍页', source: '官网', platform: '官网', score: 86, dims: { citable: 90, structured: 88, authority: 85, consistency: 80, freshness: 72 }, issues: ['信息更新停留在 3 个月前', '缺少可直接引用的数据点'] },
      { title: brand.short + ' · 工程链平台企业页', source: '平台发布', platform: '工程链', score: 78, dims: { citable: 80, structured: 74, authority: 82, consistency: 76, freshness: 70 }, issues: ['缺少 FAQ 结构化问答', '资质信息未结构化'] },
      { title: brand.short + ' · 百度百科词条', source: '百科', platform: '百度百科', score: 64, dims: { citable: 58, structured: 66, authority: 72, consistency: 60, freshness: 45 }, issues: ['词条内容过旧', '无权威信源引用', '信息与官网不一致'] },
      { title: brand.short + ' · 行业媒体报道', source: '新闻', platform: '头条号', score: 71, dims: { citable: 74, structured: 60, authority: 78, consistency: 70, freshness: 66 }, issues: ['未被 AI 收录', '缺少可引用结论句'] },
      { title: brand.short + ' · 公众号解决方案长文', source: '内容', platform: '公众号', score: 82, dims: { citable: 85, structured: 78, authority: 80, consistency: 84, freshness: 75 }, issues: ['未配置 JSON-LD 结构化数据'] }
    ];
  }

  /* ---- 知识库（基于用户提交信息自动生成） ---- */
  function factsFor(brand) {
    return [
      { type: '品牌介绍', text: brand.name + '，' + brand.desc + '。', status: '收录', source: '用户提交' },
      { type: '核心优势', text: brand.advantages.length ? brand.advantages.join('；') + '。' : '依托工程链平台生态提供一站式服务。', status: '收录', source: '用户提交' },
      { type: '官网',     text: '官网 ' + brand.website + '，为品牌主要信源。', status: '收录', source: '用户提交' },
      { type: '资质',     text: '已完成企业实名认证，平台交易保障体系内服务商。', status: '待完善', source: '平台认证' },
      { type: '数据',     text: '近 90 天 AI 引用 ' + brand.engines.reduce(function (s, e) { return s + e.citations; }, 0) + ' 次，SOV ' + Math.round(brand.sov * 100) + '%。', status: '待完善', source: '检测数据' }
    ];
  }

  return {
    ENGINES: ENGINES,
    KEYWORD_BANK: KEYWORD_BANK,
    COMPETITORS: COMPETITORS,
    CITES_TPL: CITES_TPL,
    ANSWER_TPL: ANSWER_TPL,
    ALERT_TPL: ALERT_TPL,
    CHANNELS: CHANNELS,
    PUBLISH_PLAN: PUBLISH_PLAN,
    PRICING: PRICING,
    getBrands: getBrands,
    currentBrand: currentBrand,
    switchBrand: switchBrand,
    resetBrand: resetBrand,
    addBrand: addBrand,
    deleteBrand: deleteBrand,
    saveUserBrands: saveUserBrands,
    engineProfile: engineProfile,
    evidencesFor: evidencesFor,
    contentsFor: contentsFor,
    factsFor: factsFor,
    parseQuery: parseQuery,
    highlight: highlight
  };
})();
