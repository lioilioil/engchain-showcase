(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();
;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/match/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();

;

(function () {
  window.__ROOT__ = '../../';

  var CATS = [
    { label: '材料', v: '材料' },
    { label: '设备', v: '设备' },
    { label: '劳务', v: '劳务' },
    { label: '项目合作', v: '合作' },
    { label: '中介服务', v: '中介' },
    { label: '资质招商', v: '资质招商' },
    { label: '建企买卖', v: '建企买卖' },
    { label: '招聘', v: '招聘' },
    { label: '求职', v: '求职' }
  ];
  var prefs = MatchStore.read().preferences || { cats: [], dir: '', location: '' };

  /* render cat chips */
  var catBox = document.getElementById('cat-chips');
  catBox.innerHTML = CATS.map(function (c) {
    var on = prefs.cats.indexOf(c.v) >= 0;
    return '<span class="pref-chip' + (on ? ' on' : '') + '" data-cat="' + c.v + '">' + c.label + '</span>';
  }).join('');
  function updateCatCount() {
    var n = document.querySelectorAll('#cat-chips .pref-chip.on').length;
    var el = document.getElementById('cat-count');
    if (el) el.textContent = '已选 ' + n + ' 项';
  }
  catBox.addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    chip.classList.toggle('on');
    updateCatCount();
  });
  var catClear = document.getElementById('cat-clear');
  if (catClear) catClear.addEventListener('click', function () {
    document.querySelectorAll('#cat-chips .pref-chip').forEach(function (c) { c.classList.remove('on'); });
    updateCatCount();
  });
  updateCatCount();

  /* dir chips */
  document.getElementById('dir-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    this.querySelectorAll('.pref-chip').forEach(function (c) { c.classList.remove('on'); });
    chip.classList.add('on');
  });
  /* set initial dir */
  document.querySelectorAll('#dir-chips .pref-chip').forEach(function (c) {
    if (c.dataset.v === (prefs.dir || '')) c.classList.add('on');
  });

  /* loc chips */
  document.getElementById('loc-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.pref-chip');
    if (!chip) return;
    this.querySelectorAll('.pref-chip').forEach(function (c) { c.classList.remove('on'); });
    chip.classList.add('on');
  });
  document.querySelectorAll('#loc-chips .pref-chip').forEach(function (c) {
    if (c.dataset.v === (prefs.location || '')) c.classList.add('on');
  });

  /* [Auth 连通] 用户未手动设置地区时，用已认证地域兜底默认选中 */
  try {
    if (!prefs.location && window.AuthStore && AuthStore.read) {
      var a = AuthStore.read() || {};
      var en = a.enterprise || {};
      var basic = (a.personalEntry && a.personalEntry.profile && a.personalEntry.profile.basic) || {};
      var region = en.region || basic.location || '';
      if (region) {
        var matched = null;
        document.querySelectorAll('#loc-chips .pref-chip').forEach(function (c) {
          var v = c.dataset.v;
          if (v && region.indexOf(v) >= 0) matched = c;
        });
        if (matched) {
          document.querySelectorAll('#loc-chips .pref-chip').forEach(function (c) { c.classList.remove('on'); });
          matched.classList.add('on');
        }
      }
    }
  } catch (e) {}

  window.savePrefs = function () {
    var btn = document.querySelector('.pref-save');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    var cats = [];
    document.querySelectorAll('#cat-chips .pref-chip.on').forEach(function (c) { cats.push(c.dataset.cat); });
    var dirEl = document.querySelector('#dir-chips .pref-chip.on');
    var locEl = document.querySelector('#loc-chips .pref-chip.on');
    var newPrefs = {
      cats: cats,
      dir: dirEl ? dirEl.dataset.v : '',
      location: locEl ? locEl.dataset.v : ''
    };
    MatchStore.setPreferences(newPrefs);
    MatchStore.generate();
    var summary = (cats.length ? '品类 ' + cats.length + ' 项' : '品类不限') + ' · ' + (newPrefs.dir || '方向不限') + ' · ' + (newPrefs.location || '地区不限');
    if (window.UI && UI.toast) UI.toast('偏好已保存：' + summary, 'ok');
    else alert('偏好已保存');
    setTimeout(function () { history.back(); }, 1200);
  };
})();
