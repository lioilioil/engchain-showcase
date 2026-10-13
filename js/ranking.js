/* ============================================================================
   ranking.js — Engchain 动态排序引擎（v0.2）
   三层模型：硬过滤 → 商业置地位(3坑位) → 自然分
   自然分 = 相关性0.30 + 地域0.20 + 新鲜度0.15 + 信任0.20 + 热度0.10 - 负向降权
   配置：MOCK.business.ranking（data.js 可覆盖默认值）
   ============================================================================ */
window.Ranking = (function () {
  var HOUR = 36e5, DAY = 864e5;

  var DEFAULT_CFG = {
    enabled: true,
    weights: { relevance: 0.30, geo: 0.20, freshness: 0.15, trust: 0.20, popularity: 0.10 },
    sponsored: { maxSlots: 3, slotPositions: [0, 2, 4] }, /* 0-based：前10条的第1、3、5位 */
    freshnessTiers: [
      { maxH: 6,   score: 1.0  },
      { maxH: 24,  score: 0.85 },
      { maxH: 72,  score: 0.65 },
      { maxH: 168, score: 0.4  },
      { maxH: 720, score: 0.2  },
      { maxH: Infinity, score: 0.05 }
    ],
    demandExpireDays: 7,
    /* 城市→省映射（Phase 1 文本档，Phase 2 地理编码后废弃） */
    provinceMap: {
      '成都':'四川','绵阳':'四川','德阳':'四川','泸州':'四川','南充':'四川','宜宾':'四川',
      '重庆':'重庆','江津':'重庆',
      '贵阳':'贵州','观山湖':'贵州','乌当':'贵州',
      '昆明':'云南','官渡':'云南',
      '西安':'陕西','浐灞':'陕西','泾河新城':'陕西','咸阳':'陕西',
      '长沙':'湖南','岳麓':'湖南',
      '北京':'北京','上海':'上海','广州':'广东','深圳':'广东','东莞':'广东','佛山':'广东',
      '南京':'江苏','苏州':'江苏','无锡':'江苏','杭州':'浙江','宁波':'浙江','合肥':'安徽'
    }
  };

  function cfg() {
    var b = (window.MOCK && MOCK.business) || {};
    return Object.assign({}, DEFAULT_CFG, b.ranking || {});
  }

  /* ---------- 工具 ---------- */
  function hashStr(s) {
    var h = 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  /* mock 数据大多只有 time 字符串没有 ts，用 id 哈希反推一个确定性的发布时间（过去 0-720h） */
  function inferTs(item) {
    if (item.ts) return item.ts;
    var h = hashStr(item.id || item.title);
    return Date.now() - (h % 720) * HOUR;
  }
  function cityOf(item) {
    return (item.city || item.location || '').toString().split('·')[0].split(' ')[0].trim();
  }
  function districtOf(item) {
    var loc = (item.location || '').toString();
    var parts = loc.split('·');
    return parts.length > 1 ? parts[1].trim() : '';
  }
  function provinceOf(city) {
    return (cfg().provinceMap || {})[city] || '';
  }

  /* ---------- 第1层：硬过滤 ---------- */
  function hardFilter(list, opts) {
    var c = cfg(), out = [], expired = [];
    opts = opts || {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      /* 审核状态 */
      if (it.status && ['rejected', 'off', 'pending_review'].indexOf(it.status) >= 0) continue;
      /* 需求单过期沉底（不删除） */
      if (it.dir === 'demand' || it.type === 'demand') {
        var ageH = (Date.now() - inferTs(it)) / HOUR;
        if (ageH > c.demandExpireDays * 24) { expired.push(it); continue; }
      }
      out.push(it);
    }
    return out.concat(expired); /* 过期的排最后 */
  }

  /* ---------- 第3层：自然分各分量 ---------- */
  function relevanceScore(item, ctx) {
    var s = 0.2; /* 兜底 */
    var prefs = ctx.prefs || {};
    /* 偏好品类命中 */
    if (prefs.cats && prefs.cats.length) {
      var catHit = prefs.cats.indexOf(item.cat) >= 0 || prefs.cats.indexOf(item.bizKey) >= 0;
      if (catHit) s += 0.5;
    }
    /* 偏好细分命中 */
    if (prefs.subs && prefs.subs.length && prefs.subs.indexOf(item.sub) >= 0) s += 0.2;
    /* 偏好地区命中 */
    if (prefs.location && item.city && item.city.indexOf(prefs.location) >= 0) s += 0.2;
    /* 当前 tab 类目一致 */
    if (ctx.bizKey && item.bizKey === ctx.bizKey) s += 0.3;
    /* 方向互补（需求方看供应、供应方看需求） */
    if (ctx.viewerDir && item.dir && ctx.viewerDir !== item.dir) s += 0.2;
    /* 标签重合 */
    if (ctx.userTags && item.tags) {
      for (var i = 0; i < item.tags.length; i++) {
        if (ctx.userTags[item.tags[i]]) { s += 0.05; if (s > 0.9) break; }
      }
    }
    return Math.min(1, s);
  }

  function geoScore(item, ctx) {
    var c = cfg();
    var vCity = ctx.city || '';
    if (!vCity) return c.geoTiers ? (c.geoTiers.unknown || 0.5) : 0.5;
    var iCity = cityOf(item);
    var iDist = districtOf(item);
    if (iCity === vCity) {
      /* 同区（浏览者区也能拿到时） */
      if (ctx.district && iDist === ctx.district) return 1.0;
      return 0.7;
    }
    var vProv = provinceOf(vCity), iProv = provinceOf(iCity);
    if (vProv && iProv && vProv === iProv) return 0.4;
    return 0.15;
  }

  function freshnessScore(item) {
    var c = cfg();
    var ageH = (Date.now() - inferTs(item)) / HOUR;
    var tiers = c.freshnessTiers;
    for (var i = 0; i < tiers.length; i++) {
      if (ageH <= tiers[i].maxH) return tiers[i].score;
    }
    return 0.05;
  }

  function trustScore(item, ctx) {
    var s = 0;
    /* 已认证 */
    if (item.verified) s += 0.3;
    /* 入驻类型（蓝V/金V/专属） */
    if (item._entryTypes && item._entryTypes.length) s += 0.2;
    /* 认证完成度 */
    if (item._authLevel === 'full') s += 0.15;
    else if (item._authLevel === 'advanced') s += 0.08;
    /* 企业评分 */
    if (item._companyGrade === 'AAA') s += 0.2;
    else if (item._companyGrade === 'AA') s += 0.1;
    else if (item._companyGrade === 'A') s += 0.05;
    /* 诚信分 */
    if (item._creditLevel === '金') s += 0.2;
    else if (item._creditLevel === '银') s += 0.1;
    else if (item._creditLevel === '铜') s += 0.05;
    /* 个人专业入驻 */
    if (item._userStatus === 'pro') s += 0.15;
    /* 年卡 */
    if (item._hasAnnualMembership) s += 0.05;
    /* 有成交记录 */
    if (item._hasDeal) s += 0.1;
    return Math.min(1, s);
  }

  function popularityScore(item, ctx) {
    var s = 0.2; /* 新内容中性 */
    /* views 分位由调用方在批量预处理时注入 */
    if (item._viewsTier === 'top') s += 0.5;
    if (item._favCount) s += Math.min(0.3, item._favCount * 0.1);
    if (item._leadCount) s += Math.min(0.2, item._leadCount * 0.05);
    return Math.min(1, s);
  }

  /* 负向降权（独立扣分） */
  function negativePenalty(item) {
    var p = 0;
    if (item._punished) p += 0.5;
    if (item._creditLevel === '观察') p += 0.3;
    if (item._riskFlag === 'judicial' || item._riskFlag === 'abnormal') p += 0.4;
    if (item._riskFlag === 'license_expiring') p += 0.2;
    if (item._invalidLeadRatio > 0.5) p += 0.2;
    return p;
  }

  /* ---------- 主入口 ---------- */
  function sort(list, opts) {
    var c = cfg();
    if (!c.enabled) return list; /* 总开关：回退旧逻辑 */
    opts = opts || {};

    /* 1. 硬过滤 */
    var filtered = hardFilter(list, opts);

    /* 2. 批量预处理（views分位、用户上下文合并到item） */
    attachContext(filtered, opts);

    /* 3. 计算自然分 */
    var ctx = buildCtx(opts);
    var w = c.weights;
    for (var i = 0; i < filtered.length; i++) {
      var it = filtered[i];
      var rel = relevanceScore(it, ctx);
      var geo = geoScore(it, ctx);
      var fre = freshnessScore(it);
      var tru = trustScore(it, ctx);
      var pop = popularityScore(it, ctx);
      var pen = negativePenalty(it);
      it._score = (rel * w.relevance + geo * w.geo + fre * w.freshness + tru * w.trust + pop * w.popularity) * 100 - pen * 100;
      it._sponsored = !!(window.UpgradeStore && UpgradeStore.isActive('topListing', it.id));
    }

    /* 4. 分离付费置顶和自然结果 */
    var sponsored = [], organic = [];
    filtered.forEach(function (it) {
      (it._sponsored ? sponsored : organic).push(it);
    });
    /* 各自按分数排 */
    sponsored.sort(function (a, b) { return b._score - a._score; });
    organic.sort(function (a, b) { return b._score - a._score; });

    /* 5. 穿插置地位：前10条的指定位置放付费置顶 */
    var slotPos = c.sponsored.slotPositions.slice(0, c.sponsored.maxSlots);
    var result = [], si = 0, oi = 0;
    var slotSet = {};
    slotPos.forEach(function (p) { slotSet[p] = true; });
    for (var pos = 0; pos < Math.max(10, organic.length + sponsored.length); pos++) {
      if (slotSet[pos] && si < sponsored.length) {
        result.push(sponsored[si++]);
      } else if (oi < organic.length) {
        result.push(organic[oi++]);
      } else if (si < sponsored.length) {
        result.push(sponsored[si++]);
      } else {
        break;
      }
    }
    return result;
  }

  /* ---------- 上下文构建 ---------- */
  function buildCtx(opts) {
    var ctx = {
      city: opts.city || '',
      district: opts.district || '',
      bizKey: opts.bizKey || '',
      viewerDir: opts.viewerDir || '',
      prefs: opts.prefs || {},
      userTags: {}
    };
    /* 从当前用户推断默认城市 */
    if (!ctx.city && window.DataBus) {
      var u = null;
      try { u = DataBus.current(); } catch (e) {}
      if (u) {
        if (u.entry && u.entry.address && u.entry.address.city) ctx.city = u.entry.address.city;
        else if (u.auth && u.auth.realname && u.auth.realname.location) ctx.city = u.auth.realname.location;
      }
    }
    /* 偏好覆盖城市 */
    if (ctx.prefs.location) ctx.city = ctx.prefs.location;
    /* 浏览者标签（发布过的 tags） */
    if (window.SupplyStore) {
      try {
        SupplyStore.listActive().forEach(function (s) {
          (s.tags || []).forEach(function (t) { ctx.userTags[t] = true; });
        });
      } catch (e) {}
    }
    return ctx;
  }

  /* 把用户/企业上下文合并到每个 item（_entryTypes/_authLevel/_companyGrade 等） */
  function attachContext(list, opts) {
    /* 简单实现：Demo 阶段从 seed 用户/企业映射表查 */
    var companyMap = opts.companyMap || {};
    var userMap = opts.userMap || {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var co = companyMap[it.company] || companyMap[it.companyName];
      if (co) {
        it._companyGrade = co.grade;
        it._riskFlag = co.riskFlag;
      }
      /* 通过 publisher 字段反查用户 */
      var pub = userMap[it.publisher] || userMap[it.userId];
      if (pub) {
        it._entryTypes = pub.entryTypes;
        it._authLevel = pub.authLevel;
        it._userStatus = pub.status;
        it._hasAnnualMembership = pub.hasAnnual;
        it._hasDeal = pub.hasDeal;
        it._punished = pub.punished;
        it._creditLevel = pub.creditLevel;
      }
    }
    /* views 分位 */
    var views = list.map(function (x) { return x.views || 0; }).sort(function (a, b) { return b - a; });
    var threshold = views[Math.floor(views.length * 0.2)] || 0;
    list.forEach(function (x) { if ((x.views || 0) >= threshold && threshold > 0) x._viewsTier = 'top'; });
  }

  return { sort: sort, enabled: function () { return cfg().enabled; }, cfg: cfg };
})();
