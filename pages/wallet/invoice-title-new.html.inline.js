(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();
;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/wallet/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();

;

(function () {
  window.__ROOT__ = '../../';
  var TITLE_KEY = 'engchain-invoice-titles';
  var titleType = 'enterprise';

  function loadTitles() {
    try { return JSON.parse(localStorage.getItem(TITLE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveTitles(arr) {
    try { localStorage.setItem(TITLE_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function setType(t) {
    titleType = t;
    document.getElementById('label-name').innerHTML = (t === 'personal' ? '姓名' : '抬头名称') + ' <span class="req">*</span>';
    document.getElementById('in-name').placeholder = t === 'personal' ? '请输入姓名' : '请输入抬头名称';
    document.getElementById('label-tax').innerHTML = (t === 'personal' ? '身份证号' : '纳税人识别号') + ' <span class="req">*</span>';
    document.getElementById('in-tax').placeholder = t === 'personal' ? '请输入身份证号' : '请输入统一社会信用代码';
    document.getElementById('enterprise-only').style.display = t === 'personal' ? 'none' : '';
  }

  document.querySelectorAll('#seg-title-type .seg-item').forEach(function (el) {
    el.onclick = function () {
      document.querySelectorAll('#seg-title-type .seg-item').forEach(function (x) { x.classList.remove('active', 'is-on'); });
      el.classList.add('active', 'is-on');
      setType(el.getAttribute('data-t') === 'personal' ? 'personal' : 'enterprise');
    };
  });

  window.save = function () {
    var name = document.getElementById('in-name').value.trim();
    if (!name) { UI.toast('请填写抬头名称 / 姓名', 'warn'); document.getElementById('in-name').focus(); return; }
    var tax = document.getElementById('in-tax').value.trim();
    if (!tax) { UI.toast(titleType === 'personal' ? '请填写身份证号' : '请填写纳税人识别号', 'warn'); document.getElementById('in-tax').focus(); return; }
    var titles = loadTitles();
    var isDef = document.getElementById('in-default').checked;
    if (isDef || !titles.length) titles.forEach(function (t) { t.isDefault = false; });
    var item = {
      name: name,
      tax: tax,
      titleType: titleType,
      invoiceType: titleType === 'personal' ? '增值税普通发票' : '增值税专用发票',
      address: titleType === 'enterprise' ? document.getElementById('in-regaddr').value.trim() : '',
      phone: titleType === 'enterprise' ? document.getElementById('in-phone').value.trim() : '',
      bank: titleType === 'enterprise' ? document.getElementById('in-bank').value.trim() : '',
      bankAccount: titleType === 'enterprise' ? document.getElementById('in-acct').value.trim() : '',
      email: document.getElementById('in-mail').value.trim(),
      isDefault: isDef || !titles.length
    };
    titles.push(item);
    saveTitles(titles);
    /* [Auth 连通] 企业抬头保存时，co/code 走 B 类审核守卫 */
    var authToast = '已新增抬头并同步至企业认证信息';
    try {
      if (titleType === 'enterprise' && window.AuthStore && AuthStore.read) {
        var auth = AuthStore.read() || {};
        var isOk = !!(auth.enterprise && auth.enterprise.ok);
        var regAddr = titleType === 'enterprise' ? (document.getElementById('in-regaddr').value.trim() || '') : '';
        AuthStore.submitEnterpriseChange({co: name, code: tax, registeredAddress: regAddr, reason: '发票抬头同步企业信息', files: []});
        if (isOk) authToast = '企业信息变更申请已提交，预计1-3个工作日审核';
      }
    } catch (e) {}
    UI.toast(authToast, 'ok');
    setTimeout(function () { history.back(); }, 700);
  };

  /* [Auth 连通] 新建抬头时从企业认证预填抬头名称/税号（仅空时） */
  (function prefillFromAuth() {
    try {
      if (!window.AuthStore || !AuthStore.read) return;
      var en = (AuthStore.read() || {}).enterprise || {};
      if (en.co && !document.getElementById('in-name').value) {
        document.getElementById('in-name').value = en.co;
      }
      if (en.code && !document.getElementById('in-tax').value) {
        document.getElementById('in-tax').value = en.code;
      }
      if (en.registeredAddress) {
        var ra = document.getElementById('in-regaddr');
        if (ra && !ra.value) ra.value = en.registeredAddress;
      }
      /* [B类守卫] 已认证企业：抬头名称/税号旁显示"修改需审核"徽标 */
      if (en.ok) {
        var badgeHtml = ' <span style="font-size:10px;color:var(--primary-dim);background:var(--primary-soft);padding:1px 6px;border-radius:3px;margin-left:6px;">已认证·修改需审核</span>';
        var ln = document.getElementById('label-name');
        var lt = document.getElementById('label-tax');
        if (ln && ln.querySelector('.auth-audit-badge') === null) {
          var b1 = document.createElement('span');
          b1.className = 'auth-audit-badge';
          b1.style.cssText = 'font-size:10px;color:var(--primary-dim);background:var(--primary-soft);padding:1px 6px;border-radius:3px;margin-left:6px;';
          b1.textContent = '已认证·修改需审核';
          ln.appendChild(b1);
        }
        if (lt && lt.querySelector('.auth-audit-badge') === null) {
          var b2 = document.createElement('span');
          b2.className = 'auth-audit-badge';
          b2.style.cssText = 'font-size:10px;color:var(--primary-dim);background:var(--primary-soft);padding:1px 6px;border-radius:3px;margin-left:6px;';
          b2.textContent = '已认证·修改需审核';
          lt.appendChild(b2);
        }
        var lr = document.querySelector('label[for="in-regaddr"]') || document.querySelector('#enterprise-only .field:nth-child(1) .field-label');
        /* 注册地址输入框所在 field 的 label */
        var regField = document.getElementById('in-regaddr');
        if (regField) {
          var lab = regField.closest('.field') && regField.closest('.field').querySelector('.field-label');
          if (lab && lab.querySelector('.auth-audit-badge') === null) {
            var b3 = document.createElement('span');
            b3.className = 'auth-audit-badge';
            b3.style.cssText = 'font-size:10px;color:var(--primary-dim);background:var(--primary-soft);padding:1px 6px;border-radius:3px;margin-left:6px;';
            b3.textContent = '已认证·修改需审核';
            lab.appendChild(b3);
          }
        }
      }
    } catch (e) {}
  })();
})();
