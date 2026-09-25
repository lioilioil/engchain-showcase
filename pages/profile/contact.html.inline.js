(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();
;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/profile/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();

;

(function(){
  window.__ROOT__='../../';
  /* [Auth 连通] 页面加载从 AuthStore 预填联系信息（仅空时） */
  function prefill(){
    try{
      if(!window.AuthStore||!AuthStore.read) return;
      var a=AuthStore.read()||{};
      var rn=a.realname||{}, en=a.enterprise||{};
      var basic=(a.personalEntry&&a.personalEntry.profile&&a.personalEntry.profile.basic)||{};
      if(!document.getElementById('c-mobile').value) document.getElementById('c-mobile').value = rn.mobile||'';
      if(!document.getElementById('c-wechat').value) document.getElementById('c-wechat').value = basic.wechat||'';
      if(!document.getElementById('c-company').value) document.getElementById('c-company').value = en.co||'';
      if(!document.getElementById('c-addr').value) document.getElementById('c-addr').value = en.address||'';
    }catch(e){}
  }
  prefill();
  /* [Auth 连通] 跨标签页认证信息更新时无条件同步4个认证字段（认证值以最新 AuthStore 为准） */
  function syncAuth() {
    try{
      if(!window.AuthStore||!AuthStore.read) return;
      var a=AuthStore.read()||{};
      var rn=a.realname||{}, en=a.enterprise||{};
      var basic=(a.personalEntry&&a.personalEntry.profile&&a.personalEntry.profile.basic)||{};
      document.getElementById('c-mobile').value = rn.mobile||'';
      document.getElementById('c-wechat').value = basic.wechat||'';
      document.getElementById('c-company').value = en.co||'';
      document.getElementById('c-addr').value = en.address||'';
    }catch(e){}
  }
  window.addEventListener('storage', function(e){ if(e.key==='engchain-auth') syncAuth(); });
  /* [Auth 连通] 保存写回 AuthStore 并广播 engchain:auth */
  window.save=function(){
    var toastMsg='已保存并同步至认证信息';
    try{
      if(window.AuthStore&&AuthStore.read){
        var a=AuthStore.read()||{};
        if(!a.realname) a.realname={};
        if(!a.enterprise) a.enterprise={};
        if(!a.personalEntry) a.personalEntry={};
        if(!a.personalEntry.profile) a.personalEntry.profile={};
        if(!a.personalEntry.profile.basic) a.personalEntry.profile.basic={};
        /* A类字段（手机/微信/地址）直接写，即时生效 */
        a.realname.mobile=document.getElementById('c-mobile').value.trim();
        a.personalEntry.profile.basic.wechat=document.getElementById('c-wechat').value.trim();
        a.enterprise.address=document.getElementById('c-addr').value.trim();
        AuthStore.write(a);
        /* B类字段（企业名称 co）走审核守卫 */
        var newCo=document.getElementById('c-company').value.trim();
        var oldCo=(a.enterprise.co||'');
        if(newCo && newCo!==oldCo){
          AuthStore.submitEnterpriseChange({co:newCo, reason:'联系方式页更新企业名称', files:[]});
          if(a.enterprise.ok){ toastMsg='企业名称变更申请已提交，待审核'; }
        }
      }
    }catch(e){}
    UI.toast(toastMsg,'ok');
    setTimeout(function(){history.back()},700);
  };
})();
