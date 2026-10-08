/* GEO V2 共享导航：品牌切换浮层（无底栏） */
window.GEOV2 = (function(){
  var BAR_H = 52;

  var css = '' +
    '.gv2-bs-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;opacity:0;pointer-events:none;transition:opacity .25s ease;}' +
    '.gv2-bs-mask.show{opacity:1;pointer-events:auto;}' +
    '.gv2-bs-sheet{position:absolute;left:50%;bottom:0;transform:translateX(-50%) translateY(100%);width:360px;max-width:92%;' +
      'background:var(--bg-card);border-radius:20px 20px 0 0;padding:20px 16px 30px;transition:transform .3s cubic-bezier(.4,0,.2,1);' +
      'max-height:70vh;overflow-y:auto;}' +
    '.gv2-bs-mask.show .gv2-bs-sheet{transform:translateX(-50%) translateY(0);}' +
    '.gv2-bs-title{font-size:15px;font-weight:800;color:var(--text-1);margin-bottom:14px;}' +
    '.gv2-bs-row{display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--r-m);cursor:pointer;margin-bottom:4px;}' +
    '.gv2-bs-row:active{background:var(--bg-card-2);}' +
    '.gv2-bs-row.active{background:var(--primary-soft);}' +
    '.gv2-bs-row .gbi{flex:none;width:36px;height:36px;border-radius:var(--r-s);background:var(--primary-soft);color:var(--primary-dim);font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;}' +
    '.gv2-bs-row .gbn{font-size:13px;font-weight:700;color:var(--text-1);}' +
    '.gv2-bs-row .gbm{font-size:10px;color:var(--text-3);margin-top:2px;}' +
    '.gv2-bs-add{width:100%;height:44px;margin-top:10px;border:1.5px dashed var(--line-strong);border-radius:var(--r-m);background:transparent;color:var(--text-2);font-size:13px;font-weight:600;cursor:pointer;}';

  var sheet = null;

  function ensureCss(){
    if (document.getElementById('gv2-css')) return;
    var s = document.createElement('style');
    s.id = 'gv2-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function openBrands(){
    var D = window.GEO_DATA;
    if (!D) return;
    var brands = D.getBrands();
    var cur = D.currentBrand();
    ensureSheet();
    sheet.innerHTML =
      '<div class="gv2-bs-title">切换检测品牌</div>' +
      brands.map(function(b){
        return '<div class="gv2-bs-row'+(cur && cur.id===b.id ? ' active':'')+'" onclick="window.GEOV2.pick(\''+b.id+'\')">'+
          '<div class="gbi">'+b.short.charAt(0)+'</div>'+
          '<div style="flex:1;min-width:0;"><div class="gbn">'+b.name+'</div><div class="gbm">'+b.industry+' · GEO '+b.geoScore+'分</div></div>'+
          (cur && cur.id===b.id ? '<span style="font-size:10px;color:var(--primary-dim);font-weight:800;">当前</span>' : '')+
        '</div>';
      }).join('') +
      '<button class="gv2-bs-add" onclick="window.GEOV2.close();location.href=\'brands.html\'">+ 添加 / 管理品牌</button>';
    sheet.parentElement.classList.add('show');
  }

  function ensureSheet(){
    if (sheet) return;
    var mask = document.createElement('div');
    mask.className = 'gv2-bs-mask';
    mask.innerHTML = '<div class="gv2-bs-sheet"></div>';
    mask.addEventListener('click', function(e){ if (e.target === mask) close(); });
    document.body.appendChild(mask);
    sheet = mask.querySelector('.gv2-bs-sheet');
  }

  function pick(id){
    var D = window.GEO_DATA;
    if (!D) return;
    D.switchBrand(id);
    location.reload();
  }

  function close(){
    var mask = document.querySelector('.gv2-bs-mask');
    if (mask) mask.classList.remove('show');
  }

  /* mount: 无底栏，只注入品牌条 */
  function mount(activeId, opts){
    ensureCss();
    opts = opts || {};

    if (opts.brandBar !== false) {
      var D = window.GEO_DATA;
      if (D) {
        var b = D.currentBrand();
        var host = document.querySelector('.gv2-brand-host');
        if (host) {
          host.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--bg-card);border:1px solid var(--line);border-radius:var(--r-m);cursor:pointer;box-shadow:var(--shadow-xs);" onclick="window.GEOV2.openBrands()">' +
              '<div style="flex:none;width:28px;height:28px;border-radius:var(--r-s);background:var(--primary-soft);color:var(--primary-dim);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;">'+(b ? b.short.charAt(0) : '+')+'</div>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:12px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(b ? b.name : '未选择品牌')+'</div>' +
                '<div style="font-size:9.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">'+(b ? ('GEO '+b.geoScore+' 分 · '+b.industry) : '点击添加品牌')+'</div>' +
              '</div>' +
              '<span style="flex:none;font-size:10.5px;font-weight:700;color:var(--primary-dim);">切换 ›</span>' +
            '</div>';
        }
      }
    }
  }

  return { mount: mount, openBrands: openBrands, pick: pick, close: close };
})();
