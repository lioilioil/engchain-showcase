(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();
;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/profile/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();

;

/* [Auth 连通] 登录手机号从 realname.mobile 脱敏展示 */
(function(){
  try{
    if(!window.AuthStore||!AuthStore.read) return;
    var rn=(AuthStore.read()||{}).realname||{};
    var m=rn.mobile||'';
    var el=document.getElementById('sec-mobile');
    if(el) el.textContent = (m && m.length>=7) ? (m.slice(0,3)+'****'+m.slice(-4)) : '未绑定';
  }catch(e){}
})();

;
window.__ROOT__='../../';window.logout=function(){if(!window.UI||!UI.dialog){location.href='../auth/login.html';return;}UI.dialog({title:'退出登录',text:'确定要退出当前账号？退出后需重新登录。',ok:'退出',cancel:'取消',danger:true,onOk:function(){try{if(window.DataBus&&DataBus.logout)DataBus.logout();else UI.state.set({loggedIn:false});}catch(e){}location.href='../auth/login.html';}});};