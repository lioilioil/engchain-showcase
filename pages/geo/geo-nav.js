/* ============================================================================
   GEO 品牌雷达 · 全局导航统一组件 (geo-nav.js)
   —— ① 底部 4 Tab 工作流导航（驾驶舱/监控/优化/我的）
      ② 品牌上下文条统一组件（替换各页五套不一致实现）
   用法：页面在 <script src="geo-tip.js"> 之后引入本文件，
        末尾调用 GEO_NAV.mount('当前TabID', {active:true/false})
        TabID: index | monitor | optimize | mine
        report 不显示底部 Tab：GEO_NAV.mount(null, {brandBar:false})
   ============================================================================ */
window.GEO_NAV = (function () {

  var BAR_H = 58;

  /* ---- 底部 4 Tab ---- */
  var TABS = [
    { id: 'index',    name: '驾驶舱', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>', href: 'index.html' },
    { id: 'monitor',  name: '监控',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l3-8 4 16 3-10 2 4h4"/></svg>', href: 'monitor.html' },
    { id: 'optimize', name: '优化',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>', href: 'optimize.html' },
    { id: 'mine',     name: '我的',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>', href: 'brands.html' }
  ];

  var css = '' +
    '.geo-navbar{position:fixed;left:0;right:0;bottom:0;z-index:100;height:'+BAR_H+'px;display:flex;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line);box-shadow:0 -4px 18px rgba(0,0,0,.05);}' +
    '.geo-nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--text-3);text-decoration:none;font-size:9.5px;font-weight:600;-webkit-tap-highlight-color:transparent;}' +
    '.geo-nav-item svg{width:20px;height:20px;}' +
    '.geo-nav-item.active{color:var(--primary-dim);}' +
    '.geo-nav-item.active svg{stroke-width:2.4;}' +
    '.geo-nav-tip{position:absolute;top:-3px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:var(--error);}' +
    /* 品牌上下文条（统一组件） */
    '.geo-brandbar{display:flex;align-items:center;gap:8px;margin:8px 0 0;padding:0;}' +
    '.geo-brandbar-chip{flex:1;min-width:0;display:flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--line);border-radius:var(--r-m);padding:9px 11px;cursor:pointer;box-shadow:var(--shadow-xs);}' +
    '.geo-brandbar-ico{flex:none;width:26px;height:26px;border-radius:var(--r-s);background:var(--primary-soft);color:var(--primary-dim);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;}' +
    '.geo-brandbar-name{flex:1;min-width:0;font-size:11.5px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.geo-brandbar-meta{font-size:9.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.geo-brandbar-sw{flex:none;font-size:10.5px;font-weight:700;color:var(--primary-dim);display:flex;align-items:center;gap:2px;}' +
    /* 品牌切换浮层 */
    '.geo-bs-mask{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.4);backdrop-filter:blur(3px);display:none;align-items:flex-end;justify-content:center;}' +
    '.geo-bs-mask.show{display:flex;}' +
    '.geo-bs-sheet{width:100%;max-width:460px;background:var(--bg);border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.12);}' +
    '.geo-bs-title{font-size:13.5px;font-weight:800;color:var(--text-1);margin-bottom:12px;}' +
    '.geo-bs-row{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:var(--r-m);cursor:pointer;margin-bottom:6px;background:var(--bg-card);border:1px solid var(--line);}' +
    '.geo-bs-row.active{border-color:var(--accent-line);box-shadow:0 0 0 1px var(--accent-line) inset;}' +
    '.geo-bs-row .gbi{flex:none;width:30px;height:30px;border-radius:var(--r-s);background:var(--primary-soft);color:var(--primary-dim);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;}' +
    '.geo-bs-row .gbn{flex:1;min-width:0;font-size:12px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.geo-bs-row .gbm{font-size:9.5px;color:var(--text-3);}' +
    '.geo-bs-add{width:100%;height:40px;margin-top:6px;border:none;border-radius:var(--r-m);background:var(--primary-soft);color:var(--primary-dim);font-size:12px;font-weight:700;cursor:pointer;}' +
    '.geo-bs-del{flex:none;font-size:10px;color:var(--error);cursor:pointer;padding:4px;}';

  var sheet = null;

  function ensureCss(){
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---- 品牌上下文条 + 切换浮层 ---- */
  function mountBrandBar(container) {
    var D = window.GEO_DATA;
    if (!D) return;
    var b = D.currentBrand();
    var wrap = document.createElement('div');
    wrap.className = 'geo-brandbar';
    wrap.innerHTML =
      '<div class="geo-brandbar-chip" onclick="window.GEO_NAV.openBrands()">'+
        '<div class="geo-brandbar-ico">'+(b ? b.short.charAt(0) : '+')+'</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div class="geo-brandbar-name">'+(b ? b.name : '未选择品牌')+'</div>'+
          '<div class="geo-brandbar-meta">'+(b ? (b.industry + ' · ' + b.website) : '点击添加品牌')+'</div>'+
        '</div>'+
        '<span class="geo-brandbar-sw">切换 ›</span>'+
      '</div>';
    container.appendChild(wrap);
  }

  function openBrands(){
    var D = window.GEO_DATA;
    if (!D) return;
    var brands = D.getBrands();
    var cur = D.currentBrand();
    ensureSheet();
    sheet.innerHTML =
      '<div class="geo-bs-title">切换检测品牌</div>'+
      brands.map(function(b){
        return '<div class="geo-bs-row'+(cur && cur.id===b.id ? ' active':'')+'" onclick="window.GEO_NAV.pick(\''+b.id+'\')">'+
          '<div class="gbi">'+b.short.charAt(0)+'</div>'+
          '<div style="flex:1;min-width:0;"><div class="gbn">'+b.name+'</div><div class="gbm">'+b.industry+' · GEO 综合分 '+b.geoScore+'</div></div>'+
          (cur && cur.id===b.id ? '<span style="font-size:10px;color:var(--primary-dim);font-weight:800;">当前</span>' : '')+
          (b.id !== 'b1' ? '<span class="geo-bs-del" onclick="event.stopPropagation();window.GEO_NAV.del(\''+b.id+'\')">删除</span>' : '')+
        '</div>';
      }).join('')+
      '<button class="geo-bs-add" onclick="window.GEO_NAV.close();location.href=\'brands.html\'">+ 添加 / 管理品牌</button>';
    sheet.parentElement.classList.add('show');
  }
  function ensureSheet(){
    if (sheet) return;
    var mask = document.createElement('div');
    mask.className = 'geo-bs-mask';
    mask.addEventListener('click', function(e){ if (e.target === mask) mask.classList.remove('show'); });
    sheet = document.createElement('div');
    sheet.className = 'geo-bs-sheet';
    mask.appendChild(sheet);
    document.body.appendChild(mask);
  }
  function pick(id){
    var D = window.GEO_DATA;
    if (!D) return;
    D.switchBrand(id);
    location.reload();
  }
  function del(id){
    var D = window.GEO_DATA;
    if (!D) return;
    var r = D.deleteBrand(id);
    if (r.ok) { location.reload(); }
  }
  function close(){
    var mask = document.querySelector('.geo-bs-mask');
    if (mask) mask.classList.remove('show');
  }

  /* ---- 底部 Tab ---- */
  function mount(activeId) {
    ensureCss();
    if (activeId) {
      var bar = document.createElement('div');
      bar.className = 'geo-navbar';
      bar.innerHTML = TABS.map(function(t){
        return '<a class="geo-nav-item'+(t.id===activeId?' active':'')+'" href="'+t.href+'">'+t.icon+'<span>'+t.name+'</span></a>';
      }).join('');
      document.body.appendChild(bar);
      document.body.style.paddingBottom = BAR_H + 'px';
      /* 已有 fixed 底部 CTA 上移，避免遮挡 */
      var fixed = document.querySelectorAll('*');
      for (var i = 0; i < fixed.length; i++) {
        var el = fixed[i];
        if (el.getAttribute('class') && /cta/.test(el.getAttribute('class')) && getComputedStyle(el).position === 'fixed') {
          el.style.bottom = BAR_H + 'px';
        }
      }
    }
  }

  return {
    mount: mount,
    mountBrandBar: mountBrandBar,
    openBrands: openBrands,
    pick: pick,
    del: del,
    close: close
  };
})();
