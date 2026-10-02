(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/match/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();;

(function () {
  'use strict';
  window.__ROOT__ = '../../';

  /* ============ 数据源 ============ */
  var CATS = [
    { label: '材料', v: '材料' },
    { label: '设备', v: '设备' },
    { label: '劳务', v: '劳务' },
    { label: '项目合作', v: '项目合作' },
    { label: '中介服务', v: '中介服务' },
    { label: '资质招商', v: '资质招商' },
    { label: '建企买卖', v: '建企买卖' },
    { label: '招聘', v: '招聘' },
    { label: '求职', v: '求职' }
  ];
  var pool = [];
  try { pool = (window.MatchStore && MatchStore.pool()) || []; } catch (e) {}

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* 品类 → 活跃条目数 / 细分集合 */
  function catStat() {
    var count = {}, subs = {};
    pool.forEach(function (it) {
      var nc = (window.MatchStore && MatchStore.normCat) ? MatchStore.normCat(it.cat || it.category || '') : (it.cat || '');
      if (!nc) return;
      count[nc] = (count[nc] || 0) + 1;
      var sub = it.sub || it.subType || '';
      if (sub) {
        subs[nc] = subs[nc] || [];
        if (subs[nc].indexOf(sub) < 0) subs[nc].push(sub);
      }
    });
    return { count: count, subs: subs };
  }
  var STAT = catStat();

  /* 地区 → 条目数（动态派生） */
  function locStat() {
    var m = {};
    pool.forEach(function (it) {
      var c = (window.MatchStore && MatchStore.cityOf) ? MatchStore.cityOf(it) : (it.city || String(it.location || '').split('·')[0]);
      if (!c) return;
      m[c] = (m[c] || 0) + 1;
    });
    var arr = Object.keys(m).map(function (k) { return { v: k, n: m[k] }; });
    arr.sort(function (a, b) { return (b.n - a.n) || (a.v.localeCompare(b.v, 'zh')); });
    return arr;
  }
  var LOCS = locStat();

  /* ============ 状态（draft = 未保存的当前表单；saved 存入 store） ============ */
  var saved = { cats: [], subs: [], dir: '', location: '', notify: true, updatedAt: 0 };
  try { saved = Object.assign(saved, (MatchStore.read().preferences || {})); } catch (e) {}
  saved.cats = saved.cats || []; saved.subs = saved.subs || [];
  if (saved.notify === undefined) saved.notify = true;

  var draft = {
    cats: saved.cats.slice(),
    subs: saved.subs.slice(),
    dir: saved.dir || '',
    location: saved.location || '',
    notify: saved.notify !== false
  };

  /* [Auth 连通] 从未保存过地区时，用已认证地域兜底默认选中 */
  (function authRegionFallback() {
    if (draft.location) return;
    try {
      if (window.AuthStore && AuthStore.read) {
        var a = AuthStore.read() || {};
        var en = a.enterprise || {};
        var basic = (a.personalEntry && a.personalEntry.profile && a.personalEntry.profile.basic) || {};
        var region = en.region || basic.location || '';
        if (region) {
          for (var i = 0; i < LOCS.length; i++) {
            if (region.indexOf(LOCS[i].v) >= 0) { draft.location = LOCS[i].v; break; }
          }
        }
      }
    } catch (e) {}
  })();

  /* ============ 渲染 ============ */
  var $ = function (id) { return document.getElementById(id); };

  /* 品类 */
  function renderCats() {
    var box = $('cat-chips');
    box.innerHTML = CATS.map(function (c) {
      var on = draft.cats.indexOf(c.v) >= 0;
      var n = STAT.count[c.v] || 0;
      return '<span class="pref-chip' + (on ? ' on' : '') + '" data-v="' + c.v + '">' + c.label + '<span class="cnt">' + n + '</span></span>';
    }).join('');
  }
  function catCount() {
    var n = draft.cats.length;
    $('cat-count').textContent = '已选 ' + n + ' 项';
  }

  /* 品类细分：按选中品类从活跃数据聚合 */
  function subOptions() {
    var opts = [], seen = {}, parents = {};
    draft.cats.forEach(function (cv) {
      (STAT.subs[cv] || []).forEach(function (s) {
        if (!seen[s]) { seen[s] = 1; opts.push(s); parents[s] = []; }
        if (parents[s].indexOf(cv) < 0) parents[s].push(cv);
      });
    });
    return { opts: opts, parents: parents };
  }
  function renderSubs() {
    var card = $('sub-card');
    var so = subOptions();
    if (!draft.cats.length || !so.opts.length) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    var box = $('sub-chips');
    box.innerHTML = so.opts.map(function (s) {
      var on = draft.subs.indexOf(s) >= 0;
      var parent = so.parents[s].join(' / ');
      return '<span class="pref-chip' + (on ? ' on' : '') + '" data-v="' + s + '"><span class="pv-parent">' + parent + ' · </span>' + s + '</span>';
    }).join('');
    $('sub-count').textContent = '已选 ' + draft.subs.length + ' 项';
  }
  /* 细分 chip 前缀样式（品类名弱化） */
  var subStyle = document.createElement('style');
  subStyle.textContent = '.pv-parent { font-size: 10px; opacity: .6; font-weight: 400; }';
  document.head.appendChild(subStyle);

  /* 方向 */
  function renderDirs() {
    document.querySelectorAll('#dir-chips .pref-chip').forEach(function (c) {
      c.classList.toggle('on', c.dataset.v === draft.dir);
    });
  }

  /* 地区 */
  function renderLocs() {
    var box = $('loc-chips');
    box.innerHTML = '<span class="pref-chip' + (draft.location === '' ? ' on' : '') + '" data-v="">不限</span>' +
      LOCS.map(function (l) {
        var on = draft.location === l.v;
        return '<span class="pref-chip' + (on ? ' on' : '') + '" data-v="' + esc(l.v) + '">' + esc(l.v) + '<span class="cnt">' + l.n + '</span></span>';
      }).join('');
  }

  /* 通知开关 */
  function renderNotify() {
    $('notify-switch').checked = draft.notify;
  }

  /* 状态总览 */
  function renderOverview() {
    var parts = [];
    if (draft.cats.length) parts.push('品类 ' + draft.cats.length + ' 项');
    if (draft.subs.length) parts.push('细分 ' + draft.subs.length + ' 项');
    if (draft.dir) parts.push(draft.dir === 'supply' ? '供应' : '需求');
    if (draft.location) parts.push(draft.location);
    var sumEl = $('ov-sum');
    if (parts.length) {
      sumEl.textContent = parts.join(' · ');
    } else {
      sumEl.innerHTML = '尚未设置，将按平台全部信息推荐';
    }
    $('ov-total').textContent = pool.length;
    /* 未读推荐 + 上次保存时间 */
    var unread = 0, updatedAt = 0;
    try {
      var s = MatchStore.read();
      unread = (s.feed || []).filter(function (f) { return !f.read; }).length;
      updatedAt = (s.preferences && s.preferences.updatedAt) || 0;
    } catch (e) {}
    if (draft.notify === false) unread = 0;
    $('ov-unread').textContent = unread;
    $('ov-saved').textContent = '上次保存：' + (updatedAt ? fmtTime(updatedAt) : '—');
  }
  function fmtTime(t) {
    var d = new Date(t), now = new Date();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
    return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + hm;
  }

  /* ============ 实时匹配预览 ============ */
  function draftPrefs() {
    return { cats: draft.cats, subs: draft.subs, dir: draft.dir, location: draft.location };
  }
  function renderPreview() {
    var list = [];
    var p = draftPrefs();
    var hasPref = !!(p.cats.length || p.subs.length || p.dir || p.location);
    if (hasPref) {
      try {
        list = pool.map(function (it) {
          var r = (window.MatchStore && MatchStore.score) ? MatchStore.score(it, p) : { score: 0, hints: [] };
          return { it: it, score: r.score, hints: r.hints };
        }).sort(function (a, b) { return b.score - a.score; });
      } catch (e) { list = []; }
    }
    var hit = hasPref ? list.filter(function (x) { return x.score > 0; }).length : pool.length;
    $('prev-count').textContent = hasPref ? ('命中 ' + hit + ' 条') : ('全部 ' + pool.length + ' 条');
    var top5 = list.slice(0, 5);
    var box = $('prev-list'), empty = $('prev-empty');
    if (!hasPref) {
      box.innerHTML = '';
      empty.innerHTML = '当前为「不限」偏好：将按平台全部活跃信息推荐<br>选择品类 / 细分 / 方向 / 地区后，此处即时展示 Top 5 匹配结果';
      empty.style.display = '';
      return;
    }
    if (!hit || !top5.length) {
      box.innerHTML = '';
      empty.innerHTML = '按当前偏好暂无命中信息<br>可放宽品类 / 细分 / 地区后重新查看';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    box.innerHTML = top5.map(function (x, i) {
      var it = x.it;
      var ed = (window.MatchStore && MatchStore.effDir) ? MatchStore.effDir(it) : (it.dir === 'supply' ? 'supply' : 'demand');
      var tp = ed === 'supply' ? '供应' : '需求';
      var cat = (window.MatchStore && MatchStore.normCat) ? MatchStore.normCat(it.cat || it.category || '') : (it.cat || '');
      var loc = it.city || String(it.location || '').split('·')[0] || '全国';
      var id = it.id;
      var href = '../supply/detail.html?id=' + encodeURIComponent(id);
      var hints = (x.hints || []).map(function (h) {
        return '<span class="pv-hint" data-h="' + h + '">' + h + '</span>';
      }).join('');
      return '<a class="prev-item" href="' + href + '" style="animation-delay:' + (i * 45) + 'ms">' +
        '<span class="pv-badge ' + ed + '">' + tp + '</span>' +
        '<span class="pv-body">' +
          '<span class="pv-title">' + esc(it.title || '') + '</span>' +
          '<span class="pv-meta">' + esc(cat) + (it.sub ? ' · ' + esc(it.sub) : '') + ' · ' + esc(loc) + hints + '</span>' +
        '</span>' +
        '<span class="pv-score"><span class="pv-num">' + x.score + '%</span><span class="pv-bar"><i style="width:' + x.score + '%"></i></span></span>' +
      '</a>';
    }).join('');
    /* 命中维度小标签样式 */
    if (!document.getElementById('pv-hint-style')) {
      var st = document.createElement('style');
      st.id = 'pv-hint-style';
      st.textContent = '.pv-hint { font-size: 9px; color: var(--primary-dim); background: var(--primary-soft); border-radius: 999px; padding: 1px 6px; margin-left: 2px; }';
      document.head.appendChild(st);
    }
  }

  /* ============ 事件绑定 ============ */
  $('cat-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    var v = chip.dataset.v;
    var i = draft.cats.indexOf(v);
    if (i >= 0) draft.cats.splice(i, 1); else draft.cats.push(v);
    /* 细分联动：父品类取消时清理其下的已选细分 */
    if (draft.cats.indexOf(v) < 0) {
      var so = subOptions();
      draft.subs = draft.subs.filter(function (s) { return so.opts.indexOf(s) >= 0; });
    }
    renderCats(); catCount(); renderSubs(); renderPreview();
  });
  $('cat-clear').addEventListener('click', function () {
    draft.cats = []; draft.subs = [];
    renderCats(); catCount(); renderSubs(); renderPreview();
  });
  $('cat-all').addEventListener('click', function () {
    draft.cats = CATS.map(function (c) { return c.v; });
    renderCats(); catCount(); renderSubs(); renderPreview();
  });
  $('sub-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    var v = chip.dataset.v;
    var i = draft.subs.indexOf(v);
    if (i >= 0) draft.subs.splice(i, 1); else draft.subs.push(v);
    renderSubs(); renderPreview();
  });
  $('dir-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    draft.dir = chip.dataset.v;
    renderDirs(); renderPreview();
  });
  $('loc-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    draft.location = chip.dataset.v;
    renderLocs(); renderPreview();
  });
  $('notify-switch').addEventListener('change', function () {
    draft.notify = this.checked;
    renderOverview();
  });
  $('reset-btn').addEventListener('click', function () {
    draft.cats = []; draft.subs = []; draft.dir = ''; draft.location = ''; draft.notify = true;
    renderCats(); catCount(); renderSubs(); renderDirs(); renderLocs(); renderNotify(); renderPreview(); renderOverview();
  });

  /* ============ 保存并生成推荐 ============ */
  window.savePrefs = function () {
    var btn = $('save-btn');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
    var done = function () {
      if (btn) { btn.disabled = false; btn.textContent = '保存并生成推荐'; }
    };
    try {
      /* 保存时清理失效细分（父品类未选中的） */
      var so = subOptions();
      var validSubs = draft.subs.filter(function (s) { return so.opts.indexOf(s) >= 0; });
      var newPrefs = {
        cats: draft.cats.slice(),
        subs: validSubs,
        dir: draft.dir,
        location: draft.location,
        notify: draft.notify !== false
      };
      MatchStore.setPreferences(newPrefs);
      var feed = MatchStore.generate() || [];
      var summary = (newPrefs.cats.length ? '品类 ' + newPrefs.cats.length + ' 项' : '品类不限') +
        (validSubs.length ? '·细分 ' + validSubs.length + ' 项' : '') +
        ' · ' + (newPrefs.dir === 'supply' ? '供应' : newPrefs.dir === 'demand' ? '需求' : '方向不限') +
        ' · ' + (newPrefs.location || '地区不限');
      draft.cats = newPrefs.cats; draft.subs = validSubs; draft.dir = newPrefs.dir; draft.location = newPrefs.location; draft.notify = newPrefs.notify;
      renderOverview(); renderPreview();
      if (window.UI && UI.toast) UI.toast.ok('偏好已保存：' + summary);
      else if (window.alert) alert('偏好已保存');
      showResultSheet(feed.slice(0, 5), summary);
    } catch (err) {
      done();
      if (window.UI && UI.toast) UI.toast.err('保存失败，请重试');
      return;
    }
    done();
  };

  /* 保存结果半屏弹窗：新推荐卡片 + 去消息中心 */
  function showResultSheet(feed, summary) {
    if (!window.UI || !UI.sheet) return;
    var sh = UI.sheet();
    sh.setText('智能推荐已生成');
    var rows = '<div class="sv-list">' + (feed.length ? feed.map(function (f) {
      var tp = f.type === 'supply' ? '供应' : '需求';
      var href = '../supply/detail.html?id=' + encodeURIComponent(f.sourceId != null ? f.sourceId : f.id);
      return '<a class="sv-card" href="' + href + '">' +
        '<div class="sv-top"><span class="pv-badge ' + (f.type === 'supply' ? 'supply' : 'demand') + '">' + tp + '</span>' +
        '<span class="pref-count"><b>' + (f.matchScore || 0) + '</b>% 匹配</span></div>' +
        '<div class="sv-title">' + esc(f.title || '') + '</div>' +
        '<div class="sv-meta">' + esc(f.cat || '') + (f.location ? ' · ' + esc(f.location) : '') + '</div>' +
      '</a>';
    }).join('') : '<div class="prev-empty">按当前偏好暂无命中信息<br>可放宽品类 / 地区后重新生成</div>') + '</div>';
    var foot = '<div class="sv-foot"><a class="sv-cta" href="../message/index.html">去消息中心查看全部</a><button class="sv-stay" onclick="UI.closeSheet()">留在本页</button></div>';
    sh.html(rows + foot);
    sh.show();
  }

  /* ============ 首屏渲染 ============ */
  renderCats(); catCount(); renderSubs(); renderDirs(); renderLocs(); renderNotify(); renderOverview(); renderPreview();
})();
