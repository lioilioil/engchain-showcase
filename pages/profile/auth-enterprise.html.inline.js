(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();
;

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/profile/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();

;

(function(){window.__ROOT__='../../';
var fee=MOCK.business.certification.enterprise||999;
document.getElementById('fee-txt').textContent='¥'+fee;
document.getElementById('pay-btn').textContent='支付 ¥'+fee+' 提交审核';
var st=UI.state.get();
function fmtD(t){if(!t)return '—';var d=new Date(t);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function cur(){return AuthStore.read();}
var licenseUploaded=false;
var currentBasis='tradeName';
var proofUploaded={trademark:false,brand:false};

function basisLabel(v){
  if(v==='tradeName')return '工商字号';
  if(v==='trademark')return '商标';
  if(v==='brand')return '品牌/产品/App/网站';
  return '—';
}
window.setBasis=function(val){
  currentBasis=val;
  var opts=document.querySelectorAll('#basis-opts .ae-basis-opt');
  for(var i=0;i<opts.length;i++){opts[i].classList.toggle('on',opts[i].dataset.val===val);}
  document.getElementById('cond-trademark').classList.toggle('open',val==='trademark');
  document.getElementById('cond-brand').classList.toggle('open',val==='brand');
};
window.toggleRule=function(){
  var d=document.getElementById('rule-detail');
  var btn=document.getElementById('rule-toggle');
  var open=d.classList.toggle('open');
  btn.textContent=open?'收起 ▲':'查看规则详情 ▼';
};
var _proofInitial={
  trademark:{ic:'<svg class="ic" style="width:18px;height:18px;"><use href="#i-upload"/></svg>',txt:'<div class="fw-600 fs-13">上传商标注册证书或商标使用授权材料</div><div class="text-3 fs-11" style="margin-top:2px;">支持 JPG/PNG/PDF，需清晰可辨</div>'},
  brand:{ic:'<svg class="ic" style="width:18px;height:18px;"><use href="#i-upload"/></svg>',txt:'<div class="fw-600 fs-13">上传名称证明材料</div><div class="text-3 fs-11" style="margin-top:2px;">品牌官网截图、App Store 截图、产品包装照片等</div>'}
};
var _licInitial={ic:'<svg class="ic" style="width:18px;height:18px;"><use href="#i-upload"/></svg>',txt:'<div class="fw-600 fs-13">上传营业执照彩色扫描件</div><div class="text-3 fs-11" style="margin-top:2px;">支持 JPG/PNG，需清晰加盖公章或原件照片</div>'};
function _startUpload(box){
  if(box.classList.contains('up-loading'))return false;
  box.classList.add('up-loading');
  box.innerHTML='<div class="up-loading"><svg class="up-spinner" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity=".25"/><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><span>上传中...</span></div>';
  return true;
}
function _showPreview(box,img,alt,resetFn){
  box.classList.remove('up-loading');
  box.classList.add('on');
  box.innerHTML='<img src="'+img+'" class="up-preview" alt="'+alt+'"><button class="up-reupload" onclick="event.stopPropagation();'+resetFn+'">重新上传</button>';
}
window.mockProof=function(type){
  var up=document.getElementById(type==='trademark'?'up-trademark':'up-brand');
  if(!_startUpload(up))return;
  setTimeout(function(){
    proofUploaded[type]=true;
    var img=type==='trademark'?'../../assets/mock-certs/trademark-cert.jpg':'../../assets/mock-certs/generic-proof.jpg';
    var alt=type==='trademark'?'商标注册证':'名称证明';
    _showPreview(up,img,alt,'resetProof(\''+type+'\')');
  },800);
};
window.resetProof=function(type){
  proofUploaded[type]=false;
  var up=document.getElementById(type==='trademark'?'up-trademark':'up-brand');
  up.classList.remove('on');
  var init=_proofInitial[type];
  up.innerHTML='<div class="ap-up-ic" id="'+(type==='trademark'?'tm-ic':'br-ic')+'">'+init.ic+'</div><div id="'+(type==='trademark'?'tm-txt':'br-txt')+'">'+init.txt+'</div>';
};
window.mockLicense=function(){
  var up=document.getElementById('up-license');
  if(!_startUpload(up))return;
  setTimeout(function(){
    licenseUploaded=true;
    _showPreview(up,'../../assets/mock-certs/business-license.jpg','营业执照','resetLicense()');
  },800);
};
window.resetLicense=function(){
  licenseUploaded=false;
  var up=document.getElementById('up-license');
  up.classList.remove('on');
  up.innerHTML='<div class="ap-up-ic" id="lic-ic">'+_licInitial.ic+'</div><div id="lic-txt">'+_licInitial.txt+'</div>';
};
window.fillExample=function(){
  var d=window.mockFormData&&window.mockFormData.enterprise;
  if(!d){UI.toast('示例数据未加载','warn');return;}
  document.getElementById('in-co').value=d.co||'';
  document.getElementById('in-short').value=d.shortName||'';
  document.getElementById('in-code').value=d.code||'';
  document.getElementById('in-legal').value=d.legal||'';
  document.getElementById('err-short').classList.remove('show');
  var basis=(d.nameBasis&&d.nameBasis.indexOf('品牌')>=0)?'brand':'tradeName';
  setBasis(basis);
  UI.toast('已填充示例信息，请核对后提交','ok');
};

function render(){
  var a=cur(),now=Date.now(),box;
  document.querySelectorAll('#real-gate,#form-box,#review-box,#reject-box,#done-box').forEach(function(el){el.style.display='none';});
  if(a.enterprise.ok&&a.enterprise.expireAt>now){box='done-box';fillDone(a);}
  /* E1-18：审核中态统一识别 submitted/review/pending，避免落到空白表单+支付按钮 */
  else if(a.enterprise.status==='pending'||a.enterprise.status==='submitted'||a.enterprise.status==='review'){box='review-box';fillReview(a);}
  else if(!a.enterprise.ok&&a.enterprise.note){box='reject-box';document.getElementById('rj-note').textContent=a.enterprise.note;fillReject(a);}
  else if(!a.realname.ok){box='real-gate';}
  else{box='form-box';initForm(a);}
  document.getElementById(box).style.display='block';
  document.querySelector('.ae-scroll').style.paddingBottom=(box==='form-box')?'96px':'28px';
}
function initForm(a){
  document.getElementById('in-co').value=a.enterprise.co||st.company||'';
  document.getElementById('in-short').value=a.enterprise.shortName||'';
  document.getElementById('in-code').value=a.enterprise.code||'';
  document.getElementById('in-legal').value=a.enterprise.legal||a.realname.name||st.user||'';
  setBasis(a.enterprise.nameBasis||'tradeName');
  document.getElementById('err-short').classList.remove('show');
  resetLicense();
  resetProof('trademark');
  resetProof('brand');
}
function fillReview(a){
  document.getElementById('rv-info').innerHTML=
    rvRow('企业名称',a.enterprise.co||'—')+rvRow('企业简称',a.enterprise.shortName||'—')+
    rvRow('命名依据',basisLabel(a.enterprise.nameBasis))+rvRow('信用代码',a.enterprise.code||'—')+
    rvRow('提交时间',fmtD(a.enterprise.submittedAt))+rvRow('预计完成','3 个工作日内')+
    rvRow('认证费','¥'+(a.enterprise.fee||fee));
  /* E1-18：渲染各认证维度审核状态（已提交/审核中/已通过） */
  try{
    var dd=AuthStore.dimensionStatus(), box=document.getElementById('rv-dims');
    if(box&&dd&&dd.list&&dd.list.length){
      box.style.display='';
      box.innerHTML='<div class="group-title">认证维度进度</div>'+dd.list.map(function(d){
        /* 法人身份维度：隐式依赖个人实名，只读展示 */
        if(d.id==='legal'){
          var rn=(a.realname)||{};
          if(rn.ok){
            return '<div class="ap-field ap-field-ro"><label>法人身份</label><b class="fs-13" style="color:var(--success);">已随个人实名核验 ✓</b></div>';
          }
          return '<div class="ap-field ap-field-ro"><label>法人身份</label><b class="fs-13" style="color:var(--warning);"><a href="auth-personal.html" style="text-decoration:underline;color:var(--warning);">需先完成个人实名认证 ›</a></b></div>';
        }
        var st=d.done?'已通过':(d.status==='pending_review'||d.status==='submitted'?'审核中':'已提交');
        var col=d.done?'var(--success)':'var(--warning)';
        return '<div class="ap-field ap-field-ro"><label>'+d.label+'</label><b class="fs-13" style="color:'+col+';">'+st+'</b></div>';
      }).join('');
    }
  }catch(e){}
}
function rvRow(k,v){return '<div class="ap-field ap-field-ro"><label>'+k+'</label><b class="fs-13 text-2">'+v+'</b></div>';}
function fillReject(a){
  document.getElementById('rj-info').innerHTML=
    rvRow('企业名称',a.enterprise.co||'—')+rvRow('企业简称',a.enterprise.shortName||'—')+
    rvRow('命名依据',basisLabel(a.enterprise.nameBasis))+rvRow('信用代码',a.enterprise.code||'—');
}
function fillDone(a){
  document.getElementById('d-co').textContent=a.enterprise.co||st.company||'—';
  document.getElementById('d-short').textContent=a.enterprise.shortName||'—';
  document.getElementById('d-basis').textContent=basisLabel(a.enterprise.nameBasis);
  document.getElementById('d-code').textContent=a.enterprise.code||'—';
  document.getElementById('d-legal').textContent=a.enterprise.legal||st.user||'—';
  document.getElementById('d-address').textContent=a.enterprise.address||'—';
  document.getElementById('d-regaddr').textContent=a.enterprise.registeredAddress||'—';
  document.getElementById('d-expire').textContent=fmtD(a.enterprise.expireAt);
  var days=Math.ceil((a.enterprise.expireAt-Date.now())/864e5);
  document.getElementById('expire-note').textContent='当前认证有效期至 '+fmtD(a.enterprise.expireAt)+'（剩余 '+days+' 天），到期后续费即可保持认证企业权益。';
  /* E2-13：已认证用户进入页面需渲染维度进度条与等级徽标 */
  renderDimProgress();
  /* [FEAT 留档审核] 渲染变更留档信息区块（申请/审核中/驳回） */
  renderEntChange(a);
  /* [FEAT 年度复核] 渲染年检状态条 */
  renderAnnualReview(a);
}
window.toForm=function(){var a=cur();a.enterprise.note='';AuthStore.write(a);render();};

/* [FEAT 留档审核] 变更留档信息：申请/审核中/驳回/撤回 UI */
function entChangeFormHtml(en, pc){
  var p = pc || {};
  var h = '<div class="group ap-group">';
  h += '<div class="ap-field"><label>新企业名称</label><input id="ec-co" class="ap-input" placeholder="与营业执照一致" value="'+(p.co||en.co||'')+'"></div>';
  h += '<div class="ap-field"><label>新信用代码</label><input id="ec-code" class="ap-input mono" placeholder="18位统一社会信用代码" maxlength="18" value="'+(p.code||en.code||'')+'"></div>';
  h += '<div class="ap-field"><label>新法定代表人</label><input id="ec-legal" class="ap-input" placeholder="法人姓名（变更需材料）" value="'+(p.legal||en.legal||'')+'" oninput="toggleEcLegalTip()"></div>';
  h += '<div class="ap-field"><label>新注册地址</label><input id="ec-regaddr" class="ap-input" placeholder="营业执照注册地址" value="'+(p.registeredAddress||en.registeredAddress||'')+'"></div>';
  h += '<div id="ec-legal-tip" style="display:none;padding:8px 12px;margin:6px 0;background:rgba(212,76,71,.06);border:1px solid var(--danger);border-radius:8px;font-size:12px;color:var(--danger);line-height:1.6;">法人变更需上传<b>变更核准通知书或股东会决议</b>等佐证材料，并填写变更原因。</div>';
  h += '<div class="ap-field" style="align-items:flex-start;flex-direction:column;gap:6px;"><label style="width:auto;">佐证材料 <span id="ec-files-req" style="color:var(--danger);display:none;">*必填</span></label><div id="ec-upload" onclick="uploadEcFile()" style="width:100%;border:1.5px dashed var(--line);border-radius:10px;padding:12px;cursor:pointer;text-align:center;font-size:12px;color:var(--text-3);">点击上传佐证材料（PDF/JPG）</div><div id="ec-file-list" style="font-size:12px;color:var(--text-2);line-height:1.8;"></div></div>';
  h += '<div class="ap-field" style="align-items:flex-start;flex-direction:column;gap:6px;border-bottom:none;"><label style="width:auto;">变更原因 *</label><textarea id="ec-reason" class="ap-input" style="text-align:left;min-height:60px;resize:vertical;" placeholder="请说明变更原因，如：公司更名/法人变更等">'+(p.reason||'')+'</textarea></div>';
  h += '</div>';
  return h;
}
function renderEntChange(a){
  var box = document.getElementById('ent-change-box');
  if(!box) return;
  var en = a.enterprise || {};
  var pc;
  try { pc = AuthStore.getPendingEnterpriseChange(); } catch(e) { pc = {status:'none'}; }
  var html = '';
  if(pc.status === 'pending'){
    html += '<div class="group-title">留档信息变更 · 审核中</div>';
    html += '<div class="card" style="padding:14px;margin-bottom:12px;border:1px solid var(--warning);background:rgba(214,158,46,.06);">';
    html += '<div class="fs-13" style="line-height:1.8;">已提交变更申请，预计 <b>1-3 个工作日</b> 完成审核，审核期间当前留档信息保持不变。</div></div>';
    html += '<div class="group ap-group">';
    html += '<div class="ap-field ap-field-ro"><label>当前企业名称</label><b class="fs-13 text-2">'+(en.co||'—')+'</b></div>';
    html += '<div class="ap-field ap-field-ro"><label>待审核名称</label><b class="fs-13" style="color:var(--primary);">'+(pc.co||'—')+'</b></div>';
    if(pc.code) html += '<div class="ap-field ap-field-ro"><label>待审核税号</label><b class="fs-13 mono" style="color:var(--primary);">'+pc.code+'</b></div>';
    if(pc.legal) html += '<div class="ap-field ap-field-ro"><label>待审核法人</label><b class="fs-13" style="color:var(--primary);">'+pc.legal+'</b></div>';
    if(pc.registeredAddress) html += '<div class="ap-field ap-field-ro"><label>待审核注册地址</label><b class="fs-13" style="color:var(--primary);">'+pc.registeredAddress+'</b></div>';
    html += '<div class="ap-field ap-field-ro"><label>变更原因</label><b class="fs-13 text-2">'+(pc.reason||'—')+'</b></div>';
    html += '<div class="ap-field ap-field-ro" style="border:none;"><label>提交时间</label><b class="fs-13 text-2">'+fmtD(pc.submittedAt)+'</b></div>';
    html += '</div>';
    html += '<button class="btn btn-ghost btn-block" onclick="withdrawEntChange()">撤回申请</button>';
  } else if(pc.status === 'rejected'){
    html += '<div class="group-title">留档信息变更 · 已驳回</div>';
    html += '<div class="card" style="padding:12px 14px;margin-bottom:12px;border:1px solid var(--danger);background:rgba(212,76,71,.06);">';
    html += '<div class="fs-13" style="color:var(--danger);line-height:1.7;"><b>驳回原因：</b>'+(pc.rejectReason||'资料不齐，请修改后重新提交')+'</div></div>';
    html += '<div class="group-title">重新提交变更</div>';
    html += entChangeFormHtml(en, pc);
    html += '<button class="btn btn-primary btn-block" onclick="submitEntChange()">重新提交变更申请</button>';
  } else {
    html += '<div class="group-title">留档信息变更</div>';
    html += '<div class="text-3 fs-12" style="padding:0 4px 10px;line-height:1.6;">企业名称、信用代码、法人等留档信息变更需提交审核，通过后全站生效。</div>';
    html += '<div id="ent-change-form" style="display:none;">' + entChangeFormHtml(en, null) + '</div>';
    html += '<button class="btn btn-ghost btn-block" id="ent-change-open" onclick="showEntChangeForm()">申请变更留档信息</button>';
    html += '<button class="btn btn-primary btn-block" id="ent-change-submit" style="display:none;margin-top:10px;" onclick="submitEntChange()">提交变更申请</button>';
  }
  box.innerHTML = html;
}
window.showEntChangeForm = function(){
  var f = document.getElementById('ent-change-form');
  if(f) f.style.display = '';
  var o = document.getElementById('ent-change-open');
  if(o) o.style.display = 'none';
  var s = document.getElementById('ent-change-submit');
  if(s) s.style.display = '';
};
window.__ecFiles = window.__ecFiles || [];
window.uploadEcFile = function(){
  var name = '佐证材料_' + (window.__ecFiles.length + 1) + '.jpg';
  window.__ecFiles.push({name: name, type: 'support'});
  var list = document.getElementById('ec-file-list');
  if(list) list.textContent = '已上传：' + window.__ecFiles.map(function(f){return f.name;}).join('、');
  UI.toast('已上传 1 份佐证材料','ok');
};
window.toggleEcLegalTip = function(){
  var legal = ((document.getElementById('ec-legal')||{}).value||'').trim();
  var cur = (AuthStore.read().enterprise||{}).legal || '';
  var changed = legal && legal !== cur;
  var tip = document.getElementById('ec-legal-tip');
  var req = document.getElementById('ec-files-req');
  if(tip) tip.style.display = changed ? '' : 'none';
  if(req) req.style.display = changed ? '' : 'none';
};
window.submitEntChange = function(){
  var co = (document.getElementById('ec-co')||{}).value || ''; co = co.trim();
  var code = ((document.getElementById('ec-code')||{}).value || '').trim().toUpperCase();
  var legal = ((document.getElementById('ec-legal')||{}).value || '').trim();
  var reason = ((document.getElementById('ec-reason')||{}).value || '').trim();
  if(!co){UI.toast('请填写新企业名称','warn');return;}
  if(code && !/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(code)){UI.toast('信用代码应为18位','warn');return;}
  if(!reason){UI.toast('请填写变更原因','warn');return;}
  var regaddr = ((document.getElementById('ec-regaddr')||{}).value||'').trim();
  /* [法人变更校验] 新法人与当前不同时，强制材料+原因 */
  var curLegal = (AuthStore.read().enterprise||{}).legal || '';
  var legalChanged = legal && legal !== curLegal;
  if(legalChanged && (!window.__ecFiles || window.__ecFiles.length < 1)){
    UI.toast('法人变更需上传佐证材料（如变更核准通知书/股东会决议）','warn'); return;
  }
  if(legalChanged && !reason){
    UI.toast('法人变更需填写变更原因','warn'); return;
  }
  var r;
  try { r = AuthStore.submitEnterpriseChange({co:co, code:code, legal:legal, shortName:'', registeredAddress:regaddr, reason:reason, files:(window.__ecFiles||[])}); }
  catch(e) { UI.toast('提交失败：'+e.message,'warn'); return; }
  if(r && r.ok === false){ UI.toast(r.msg||'变更提交失败','warn'); return; }
  window.__ecFiles = [];
  UI.toast('变更申请已提交，待审核','ok');
  render();
};
window.withdrawEntChange = function(){
  UI.dialog({title:'撤回确认',text:'撤回后当前企业留档信息不变，可随时重新发起变更。',ok:'确认撤回',cancel:'取消',onOk:function(){
    AuthStore.withdrawEnterpriseChange();
    UI.toast('已撤回变更申请','ok');
    render();
  }});
};

/* [FEAT 年度复核] 年检状态条 + 发起/复核中/撤回 */
function annualReviewFormHtml(en){
  var h = '<div class="group ap-group">';
  h += '<div class="ap-field"><label>企业名称</label><input id="ar-co" class="ap-input" value="'+(en.co||'')+'"></div>';
  h += '<div class="ap-field"><label>信用代码</label><input id="ar-code" class="ap-input mono" value="'+(en.code||'')+'"></div>';
  h += '<div class="ap-field"><label>法定代表人</label><input id="ar-legal" class="ap-input" value="'+(en.legal||'')+'"></div>';
  h += '<div class="ap-field"><label>注册地址</label><input id="ar-regaddr" class="ap-input" value="'+(en.registeredAddress||'')+'"></div>';
  h += '<div class="ap-field" style="align-items:flex-start;flex-direction:column;gap:6px;"><label style="width:auto;">说明 / 变更原因</label><textarea id="ar-reason" class="ap-input" style="text-align:left;min-height:50px;resize:vertical;" placeholder="年度复核说明（选填）"></textarea></div>';
  h += '<div class="ap-field" style="align-items:flex-start;flex-direction:column;gap:6px;border-bottom:none;"><label style="width:auto;">佐证材料 <span style="color:var(--danger);">*必填</span></label><div id="ar-upload" onclick="uploadArFile()" style="width:100%;border:1.5px dashed var(--line);border-radius:10px;padding:12px;cursor:pointer;text-align:center;font-size:12px;color:var(--text-3);">点击上传营业执照等（PDF/JPG）</div><div id="ar-file-list" style="font-size:12px;color:var(--text-2);line-height:1.8;"></div></div>';
  h += '</div>';
  return h;
}
function renderAnnualReview(a){
  var box = document.getElementById('annual-review-box');
  if(!box) return;
  var en = a.enterprise || {};
  var ar;
  try { ar = AuthStore.checkAnnualStatus(); } catch(e) { ar = 'ok'; }
  /* checkAnnualStatus 返回字符串状态（'ok'|'due'|'under_review'|'rejected'），兼容对象形式 */
  var status = (typeof ar === 'string') ? ar : (ar.status || 'ok');
  var html = '';
  /* 已有日常待审核变更时，不允许发起年度复核 */
  var pc;
  try { pc = AuthStore.getPendingEnterpriseChange(); } catch(e) { pc = {status:'none', reviewType:'daily'}; }
  var hasDailyPending = pc.status === 'pending' && pc.reviewType !== 'annual';

  if(status === 'under_review'){
    html += '<div class="group-title">企业信息年度复核</div>';
    html += '<div class="card" style="padding:14px;margin-bottom:12px;border:1px solid var(--primary);background:var(--primary-soft);">';
    html += '<div class="fw-700 fs-14" style="color:var(--primary-dim);margin-bottom:6px;">年度复核审核中</div>';
    html += '<div class="fs-12" style="color:var(--text-2);line-height:1.7;">提交时间：'+fmtD(pc.submittedAt||en.lastReviewAt)+' · 预计 1-3 个工作日完成审核</div>';
    html += '</div>';
    html += '<div class="group ap-group">';
    html += '<div class="ap-field ap-field-ro"><label>企业名称</label><b class="fs-13 text-2">'+(pc.co||en.co||'—')+'</b></div>';
    html += '<div class="ap-field ap-field-ro"><label>信用代码</label><b class="fs-13 mono text-2">'+(pc.code||en.code||'—')+'</b></div>';
    html += '<div class="ap-field ap-field-ro"><label>法定代表人</label><b class="fs-13 text-2">'+(pc.legal||en.legal||'—')+'</b></div>';
    html += '<div class="ap-field ap-field-ro" style="border:none;"><label>注册地址</label><b class="fs-13 text-2">'+(pc.registeredAddress||en.registeredAddress||'—')+'</b></div>';
    html += '</div>';
    html += '<button class="btn btn-ghost btn-block" onclick="withdrawEntChange()">撤回复核申请</button>';
  } else if(status === 'rejected'){
    html += '<div class="group-title">企业信息年度复核</div>';
    html += '<div class="card" style="padding:12px 14px;margin-bottom:12px;border:1px solid var(--danger);background:rgba(212,76,71,.06);">';
    html += '<div class="fs-13" style="color:var(--danger);line-height:1.7;"><b>年度复核未通过：</b>'+(en.annualNote||pc.rejectReason||'资料不齐')+'</div></div>';
    html += annualReviewFormHtml(en);
    html += '<button class="btn btn-primary btn-block" onclick="submitAnnualReview()">重新提交年度复核</button>';
  } else if(status === 'due'){
    html += '<div class="group-title">企业信息年度复核</div>';
    html += '<div class="card" style="padding:12px 14px;margin-bottom:12px;border:1px solid var(--warning);background:rgba(214,158,46,.06);">';
    html += '<div class="fs-13" style="color:var(--warning);line-height:1.6;">企业信息年度复核已到期，请及时发起复核以保持企业认证有效。</div></div>';
    if(hasDailyPending){
      html += '<div class="card" style="padding:12px 14px;font-size:12px;color:var(--text-2);line-height:1.6;">存在待审核的日常变更，请先处理完毕后再发起年度复核。</div>';
    } else {
      html += '<button class="btn btn-primary btn-block" onclick="showAnnualReviewForm()">发起年度复核</button>';
      html += '<div id="annual-review-form" style="display:none;margin-top:10px;">' + annualReviewFormHtml(en) + '</div>';
      html += '<button class="btn btn-primary btn-block" id="annual-review-submit" style="display:none;margin-top:10px;" onclick="submitAnnualReview()">提交年度复核</button>';
    }
  } else {
    /* ok */
    var due = en.reviewDueAt ? fmtD(en.reviewDueAt) : '—';
    html += '<div class="group-title">企业信息年度复核</div>';
    html += '<div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:10px;">';
    html += '<span style="width:32px;height:32px;border-radius:50%;background:rgba(46,164,79,.12);color:var(--success);display:flex;align-items:center;justify-content:center;flex:none;font-weight:700;">✓</span>';
    html += '<div class="fs-13" style="color:var(--text-2);line-height:1.6;">年检正常，下次复核：<b style="color:var(--text-1);">'+due+'</b></div>';
    html += '</div>';
  }
  box.innerHTML = html;
}
window.showAnnualReviewForm = function(){
  var f = document.getElementById('annual-review-form');
  if(f) f.style.display = '';
  var s = document.getElementById('annual-review-submit');
  if(s) s.style.display = '';
  /* 隐藏同卡片内的"发起年度复核"按钮（兄弟按钮） */
  var box = document.getElementById('annual-review-box');
  if(box){
    var btns = box.querySelectorAll('button');
    for(var i=0;i<btns.length;i++){
      if(btns[i].textContent.indexOf('发起年度复核')>=0) btns[i].style.display='none';
    }
  }
};
window.__arFiles = window.__arFiles || [];
window.uploadArFile = function(){
  var name = '营业执照_' + (window.__arFiles.length + 1) + '.jpg';
  window.__arFiles.push({name: name, type: 'license'});
  var list = document.getElementById('ar-file-list');
  if(list) list.textContent = '已上传：' + window.__arFiles.map(function(f){return f.name;}).join('、');
  UI.toast('已上传营业执照','ok');
};
window.submitAnnualReview = function(){
  var co = ((document.getElementById('ar-co')||{}).value||'').trim();
  var code = ((document.getElementById('ar-code')||{}).value||'').trim().toUpperCase();
  var legal = ((document.getElementById('ar-legal')||{}).value||'').trim();
  var regaddr = ((document.getElementById('ar-regaddr')||{}).value||'').trim();
  var reason = ((document.getElementById('ar-reason')||{}).value||'').trim();
  if(!co||!code||!legal||!regaddr){UI.toast('请填写完整的企业名称、税号、法人、注册地址','warn');return;}
  /* [年度复核] 始终强制材料（legal 变化不额外叠加要求，年度基线已覆盖） */
  if(!window.__arFiles || window.__arFiles.length < 1){
    UI.toast('年度复核需上传佐证材料（营业执照等）','warn'); return;
  }
  var r;
  try { r = AuthStore.submitAnnualReview({co:co, code:code, legal:legal, registeredAddress:regaddr, shortName:'', reason:reason||'年度复核', files:window.__arFiles}); }
  catch(e) { UI.toast('提交失败：'+e.message,'warn'); return; }
  if(r && r.ok === false){ UI.toast(r.msg||'年度复核提交失败','warn'); return; }
  window.__arFiles = [];
  UI.toast('年度复核已提交，等待审核','ok');
  render();
};
function validUscc(c){return /^[0-9A-HJ-NPQRTUWXY]{18}$/.test(c.toUpperCase());}

window.payEnterprise=function(){
  var co=document.getElementById('in-co').value.trim();
  var shortName=document.getElementById('in-short').value.trim();
  var code=document.getElementById('in-code').value.trim().toUpperCase();
  var legal=document.getElementById('in-legal').value.trim();
  var errEl=document.getElementById('err-short');
  if(!shortName){errEl.classList.add('show');document.getElementById('in-short').focus();return;}
  errEl.classList.remove('show');
  if(!/^[\u4e00-\u9fa5()（）·]{4,40}$/.test(co)){UI.toast('请输入与执照一致的企业名称','warn');return;}
  if(!validUscc(code)){UI.toast('统一社会信用代码应为 18 位','warn');return;}
  if(!legal){UI.toast('请填写法定代表人','warn');return;}
  if(!licenseUploaded&&!cur().enterprise.co){UI.toast('请上传营业执照','warn');return;}
  var nameProof=[];
  if(currentBasis==='trademark'&&proofUploaded.trademark){nameProof.push({type:'trademark',name:'商标注册证书.pdf'});}
  else if(currentBasis==='brand'&&proofUploaded.brand){nameProof.push({type:'brand',name:'名称证明材料.jpg'});}
  var payload={co:co,code:code,legal:legal,shortName:shortName,nameBasis:currentBasis,nameProof:nameProof};
  var prev=cur().enterprise;
  var resubmit=prev&&prev.fee&&!prev.ok;
  function doSubmit(){
    var r=DataBus.authApply('enterprise',payload,fee);
    if(r&&r.error){UI.toast(r.error,'warn');return;}
    UI.toast(resubmit?'已重新提交审核':'支付成功，已进入平台审核','ok');
    setTimeout(function(){location.href='auth-result.html?type=enterprise&state=reviewing';},800);
  }
  if(resubmit){doSubmit();return;}
  var avail=window.BalanceStore?BalanceStore.available():0;
  var payMethod='balance';
  function paySheetHtml(){
    var balanceOk=avail>=fee;
    var methods=[
      {key:'balance',name:'余额支付',desc:'账户余额 ¥'+avail.toLocaleString()+(balanceOk?'':'（余额不足）'),icon:'💳',disabled:!balanceOk},
      {key:'wechat',name:'微信支付',desc:'推荐使用微信扫码支付',icon:'💚',disabled:false},
      {key:'alipay',name:'支付宝',desc:'支持支付宝快捷支付',icon:'💙',disabled:false},
      {key:'corp',name:'对公转账',desc:'企业对公账户转账，1-3工作日到账',icon:'🏦',disabled:false}
    ];
    var html='<div style="padding:6px 2px 14px;">';
    html+='<div class="fw-700 fs-16" style="margin-bottom:14px;">企业认证 · 支付确认</div>';
    /* 订单信息 */
    html+='<div style="background:var(--bg-card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:14px;">';
    html+='<div class="fb-between" style="font-size:13px;padding:5px 0;"><span class="text-2">认证服务费（年费）</span><b style="font-family:var(--font-num);">¥'+fee+'</b></div>';
    html+='<div class="fb-between" style="font-size:13px;padding:5px 0;"><span class="text-2">审核时效</span><b>24 小时内人工复核</b></div>';
    html+='<div class="fb-between" style="font-size:13px;padding:5px 0 0;"><span class="text-2">服务内容</span><b>企业认证标识 + 详情页优先展示</b></div>';
    html+='</div>';
    /* 支付方式选择 */
    html+='<div style="font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:10px;">选择支付方式</div>';
    methods.forEach(function(m){
      var active=payMethod===m.key;
      html+='<div class="pay-method-item'+(active?' active':'')+(m.disabled?' disabled':'')+'" data-method="'+m.key+'" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid '+(active?'var(--primary)':'var(--line)')+';border-radius:10px;margin-bottom:8px;cursor:'+(m.disabled?'not-allowed':'pointer')+';opacity:'+(m.disabled?'.5':'1')+';background:'+(active?'var(--primary-soft)':'var(--bg-card)')+';transition:all .15s;">';
      html+='<span style="font-size:18px;flex:none;">'+m.icon+'</span>';
      html+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--text-1);">'+m.name+'</div><div style="font-size:10.5px;color:var(--text-3);margin-top:1px;">'+m.desc+'</div></div>';
      html+='<span style="width:18px;height:18px;border-radius:50%;border:2px solid '+(active?'var(--primary)':'var(--line)')+';display:flex;align-items:center;justify-content:center;flex:none;">'+(active?'<span style="width:8px;height:8px;border-radius:50%;background:var(--primary);"></span>':'')+'</span>';
      html+='</div>';
    });
    /* 对公转账提示 */
    if(payMethod==='corp'){
      html+='<div style="background:rgba(201,169,97,.08);border:1px solid rgba(201,169,97,.2);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:var(--text-2);line-height:1.6;">';
      html+='<b style="color:var(--primary-dim);">转账信息：</b>开户名：工程链科技有限公司<br>开户行：中国工商银行成都分行<br>账号：6222 **** **** 8888<br>转账时请备注：企业认证+企业名称';
      html+='</div>';
    }
    /* [PayBar] 协议勾选 */
    html+='<label class="pay-agree" id="sheetAgree" style="margin:2px 0 10px;"><span class="pa-box"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span><span>我已阅读并同意<a href="auth.html">《企业认证服务协议》</a></span></label>';
    /* 支付按钮 */
    var btnText=payMethod==='balance'?'确认支付 ¥'+fee:payMethod==='corp'?'提交审核（转账后上传凭证）':'立即支付 ¥'+fee;
    html+='<button class="btn btn-primary btn-block" id="cfm-pay" style="margin-top:6px;">'+btnText+'</button>';
    html+='<button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="UI.closeSheet()">取消</button>';
    html+='</div>';
    return html;
  }
  function refreshPaySheet(){
    var sheet=document.querySelector('.ui-sheet-body, [class*="sheet"]');
    var container=document.querySelector('.ui-sheet-body') || document.querySelector('[class*="sheet-body"]');
    if(container){container.innerHTML=paySheetHtml();bindPayEvents();}
  }
  function bindPayEvents(){
    document.querySelectorAll('.pay-method-item').forEach(function(el){
      if(el.classList.contains('disabled'))return;
      el.addEventListener('click',function(){
        payMethod=el.dataset.method;
        refreshPaySheet();
      });
    });
    var ag=document.getElementById('sheetAgree');if(ag)ag.addEventListener('click',function(e){if(e.target.tagName==='A')return;this.classList.toggle('on');});
    var payBtn=document.getElementById('cfm-pay');
    if(payBtn)payBtn.onclick=function(){
      var ag=document.getElementById('sheetAgree');
      if(ag&&!ag.classList.contains('on')){
        UI.dialog({title:'确认协议',text:'请确认您已阅读并同意<a href="auth.html">《企业认证服务协议》</a>',ok:'确认并继续支付',cancel:'取消',onOk:function(){
          ag.classList.add('on'); payBtn.click();
        }});
        return;
      }
      UI.closeSheet();
      if(payMethod==='corp'){
        UI.toast('已提交审核，请转账后上传凭证','ok');
        setTimeout(function(){location.href='auth-result.html?type=enterprise&state=reviewing';},800);
        return;
      }
      var r=DataBus.authApply('enterprise',payload,fee);
      if(r&&r.error){UI.toast(r.error,'warn');return;}
      UI.toast(payMethod==='wechat'?'微信支付成功，已进入平台审核':payMethod==='alipay'?'支付宝支付成功，已进入平台审核':'支付成功，已进入平台审核','ok');
      setTimeout(function(){location.href='auth-result.html?type=enterprise&state=reviewing';},800);
    };
  }
  UI.sheet().html(paySheetHtml()).show();
  setTimeout(bindPayEvents,60);
};
document.addEventListener('click',function(e){if(e.target&&e.target.id==='pay-btn')payEnterprise();});
document.getElementById('in-short').addEventListener('input',function(){
  if(this.value.trim()){document.getElementById('err-short').classList.remove('show');}
});

window.renew=function(){
  var avail=window.BalanceStore?BalanceStore.available():0;
  UI.dialog({title:'续费确认',text:'续费一年费用 <b style="color:var(--primary)">¥'+fee+'</b>，当前余额 ¥'+avail.toLocaleString()+'，续费后有效期顺延 365 天。',ok:'确认续费',cancel:'取消',onOk:function(){
    var r=DataBus.authRenew(fee);
    if(r&&r.error){UI.toast(r.error,'warn');return;}
    UI.toast('续费成功，有效期已延长','ok');render();
  }});
};
  /* [FEAT 9.2-3] 提交某一维核验材料 */
  window.submitDim = function(type) {
    AuthStore.submitDimension(type, { files: ['mock_' + type + '.jpg'] });
    var labels = { qualification: '企业资质', bank: '对公账户', office: '办公场地' };
    UI.toast(labels[type] + '已提交，等待审核', 'ok');
    renderDimProgress();
  };
  function renderDimProgress() {
    try {
      var ds = AuthStore.dimensionStatus();
      var el = document.getElementById('dim-progress');
      if (el) {
        el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<div style="flex:1;height:6px;border-radius:3px;background:var(--line);overflow:hidden;">' +
          '<div style="height:100%;width:' + Math.round(ds.doneCount/ds.total*100) + '%;background:var(--primary);border-radius:3px;"></div></div>' +
          '<span style="font-size:12px;font-weight:600;color:var(--primary-dim);">' + ds.doneCount + '/' + ds.total + '</span></div>';
      }
      var lv = document.getElementById('dim-level-badge');
      if (lv) lv.textContent = ds.levelLabel;
      var el2 = document.getElementById('dim-progress-done');
      if (el2) {
        el2.innerHTML = ds.list.map(function(d) {
          /* 法人身份维度：隐式依赖个人实名，只读展示 */
          if(d.id==='legal'){
            var ra=AuthStore.read();var rnOk=!!(ra.realname&&ra.realname.ok);
            return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;">' +
              (rnOk ? '<svg class="ic" style="width:14px;height:14px;color:var(--success);"><use href="#i-check"/></svg>' : '<span style="width:14px;height:14px;border:1.5px solid var(--line);border-radius:50%;display:inline-block;"></span>') +
              '<span>' + d.label + ' <span style="color:var(--danger);font-size:10px;">必选</span></span>' +
              '<span style="margin-left:auto;font-size:11px;color:' + (rnOk ? 'var(--success)' : 'var(--warning)') + ';">' + (rnOk ? '已随个人实名核验 ✓' : '<a href="auth-personal.html" style="text-decoration:underline;color:var(--warning);">需先实名认证 ›</a>') + '</span></div>';
          }
          return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;">' +
            (d.done ? '<svg class="ic" style="width:14px;height:14px;color:var(--success);"><use href="#i-check"/></svg>' : '<span style="width:14px;height:14px;border:1.5px solid var(--line);border-radius:50%;display:inline-block;"></span>') +
            '<span>' + d.label + (d.required ? ' <span style="color:var(--danger);font-size:10px;">必选</span>' : ' <span style="color:var(--text-3);font-size:10px;">可选</span>') + '</span>' +
            '<span style="margin-left:auto;font-size:11px;color:' + (d.done ? 'var(--success)' : 'var(--text-3)') + ';">' + (d.done ? '已完成' : d.status === 'pending_review' ? '审核中' : '待提交') + '</span></div>';
        }).join('');
      }
    } catch(e) {}
  }
render();
window.addEventListener('storage',function(ev){if(['engchain-users','engchain-auth'].indexOf(ev.key)>=0)render();});
window.addEventListener('engchain:auth',render);
})();
