/* ============================================================================
   js/agent-apply.js —— M2-1 总代申请提交 / M2-4 驳回重提 / M2-2 App 导入种子
   ----------------------------------------------------------------------------
   - ¥0 确认提交，无任何付费入口/金额按钮；不调用 DataBus.entryApply，不写旧 entry 队列；
   - 缺执照/意向省拦截；提交 → pending 落 engchain-province-agents；
   - 一公司一记录：rejected 复用原记录回退 pending，rejects[] 保留历史，不新建重复；
   - 个人合伙人(u9)申请链路完全不经本模块。
   浏览器 → window.AgentApply；node → module.exports（smoke-m2 注入 store）。
   ============================================================================ */
(function (root) {
  'use strict';

  function deps() {
    var R = (typeof window !== 'undefined' && window.AgentRules) || (typeof require === 'function' ? require('./agent-rules.js') : null);
    var S = (typeof window !== 'undefined' && window.AgentStore) || (typeof require === 'function' ? require('./agent-store.js') : null);
    var B = (typeof window !== 'undefined' && window.AgentBridge) || (typeof require === 'function' ? require('./agent-bridge.js') : null);
    return { R: R, S: S, B: B };
  }

  function currentUid() {
    try {
      if (typeof window !== 'undefined' && window.DataBus && typeof DataBus.current === 'function') {
        var u = DataBus.current(); return u ? u.id : '';
      }
    } catch (e) {}
    return '';
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* M2-1 提交省级总代申请（fee 恒 0，无付费） */
  function submitProvinceApplication(payload, opts) {
    opts = opts || {};
    var d = deps(), R = d.R, S = opts.store || d.S;
    if (!R || !S) return { error: 'E_DEPS_MISSING', msg: 'AgentRules/AgentStore 未加载' };
    payload = payload || {};

    /* 必填拦截：执照 / 意向省 / 公司名 / uscc / 法人 / 联系人 */
    if (!String(payload.companyName || '').trim()) return { error: 'E_COMPANY_EMPTY', msg: '请填写分公司名称' };
    if (!String(payload.uscc || '').trim()) return { error: 'E_USCC_EMPTY', msg: '请填写统一社会信用代码' };
    if (!String(payload.license || '').trim()) return { error: 'E_LICENSE_REQUIRED', msg: '请上传/填写营业执照（缺执照拦截）' };
    if (!String(payload.province || '').trim()) return { error: 'E_PROVINCE_REQUIRED', msg: '请选择意向授权省（缺意向省拦截）' };
    if (!String(payload.legalRep || '').trim()) return { error: 'E_LEGALREP_EMPTY', msg: '请填写法定代表人' };
    if (!String(payload.contact || '').trim()) return { error: 'E_CONTACT_EMPTY', msg: '请填写联系人' };

    var uid = payload.uid || currentUid();
    var uscc = R.normalizeUscc(payload.uscc);
    var province = R.normalizeProvince(payload.province, opts.quotaCfg && opts.quotaCfg.aliases);

    /* 四道校验（M1-3）：省独家 / uscc 唯一 / 一人一省 / 自然人禁入 */
    var ctx = { provinceAgents: S.listProvinces(), subAgents: S.listSubs(), quotaCfg: opts.quotaCfg || {} };
    var v = R.validateProvinceAgent({ uid: uid, province: province, uscc: uscc, isNaturalPerson: !!payload.isNaturalPerson }, ctx);

    /* M2-4 一公司一记录：已存在同 uscc 记录 → 复用（rejected/terminated 释放态回退 pending；
       active/suspended/pending 直接冲突拦截，不新建重复记录） */
    var existing = ctx.provinceAgents.find(function (a) {
      return R.normalizeUscc(a.branchCompany && a.branchCompany.uscc) === uscc;
    });
    if (existing) {
      if (existing.status === 'active' || existing.status === 'suspended' || existing.status === 'pending') {
        return { error: v.code === 'E_PROVINCE_TAKEN' ? 'E_PROVINCE_TAKEN' : 'E_USCC_DUPLICATE',
          msg: v.ok ? '该公司已有在审/在册总代记录，不可重复提交' : v.msg };
      }
      /* 释放态（rejected/terminated/revoked）：复用原记录回退 pending，保留 rejects 历史 */
      existing.status = 'pending';
      existing.rejectReason = '';
      existing.branchCompany = {
        name: payload.companyName, uscc: uscc, license: payload.license,
        legalRep: payload.legalRep, contact: payload.contact, phone: payload.phone || ''
      };
      existing.province = province;
      existing.materials = payload.materials || [];
      existing.statusLog = existing.statusLog || [];
      existing.statusLog.push({ operator: uid || 'self', at: Date.now(), reason: '补资料重新提交', fromStatus: existing.status, toStatus: 'pending' });
      var saved = S.saveProvince(existing);
      if (saved.error) return saved;
      return { ok: true, reused: true, record: existing };
    }

    if (!v.ok) return { error: v.code, msg: v.msg };

    var rec = {
      id: 'pa-' + Date.now().toString(36),
      uid: uid,
      province: province,
      provinceCode: '',
      branchCompany: { name: payload.companyName, uscc: uscc, license: payload.license, legalRep: payload.legalRep, contact: payload.contact, phone: payload.phone || '' },
      status: 'pending',
      appointedAt: 0, appointedBy: '', source: 'apply',
      rejects: [], statusLog: [{ operator: uid || 'self', at: Date.now(), reason: '提交申请', fromStatus: '', toStatus: 'pending' }],
      provinceHistory: [], sealedAt: 0, orgId: '', legalRep: payload.legalRep, admins: [],
      materials: payload.materials || [], fee: 0 /* M2-1：fee 恒 0，无付费入口 */
    };
    var r = S.saveProvince(rec);
    if (r.error) return r;
    return { ok: true, reused: false, record: rec };
  }

  /* 列出当前用户总代申请（含 rejected，供重提） */
  function listMyApplications(uid, opts) {
    var S = (opts && opts.store) || deps().S;
    uid = uid || currentUid();
    return S.listProvinces().filter(function (a) { return a.uid === uid; });
  }

  /* M2-4 驳回重提：rejected → pending，rejects[] 保留、rejectReason 落盘可见 */
  function resubmit(recordId, payload, opts) {
    opts = opts || {};
    var d = deps(), S = opts.store || d.S;
    var rec = S.getProvince(recordId);
    if (!rec) return { error: 'E_RECORD_NOT_FOUND', msg: '记录不存在' };
    if (rec.status !== 'rejected') return { error: 'E_STATUS_NOT_REJECTED', msg: '仅驳回态可重提' };
    payload = payload || {};
    if (!String(payload.license || rec.license || '').trim()) return { error: 'E_LICENSE_REQUIRED', msg: '请补全营业执照' };
    if (!String(payload.province || rec.province || '').trim()) return { error: 'E_PROVINCE_REQUIRED', msg: '请选择意向授权省' };
    rec.status = 'pending';
    rec.rejectReason = '';
    rec.branchCompany = {
      name: payload.companyName || rec.branchCompany.name,
      uscc: rec.branchCompany.uscc,
      license: payload.license || rec.branchCompany.license,
      legalRep: payload.legalRep || rec.branchCompany.legalRep,
      contact: payload.contact || rec.branchCompany.contact,
      phone: payload.phone || rec.branchCompany.phone || ''
    };
    rec.province = payload.province ? d.R.normalizeProvince(payload.province, opts.quotaCfg && opts.quotaCfg.aliases) : rec.province;
    rec.materials = payload.materials || rec.materials || [];
    rec.statusLog = rec.statusLog || [];
    rec.statusLog.push({ operator: currentUid() || 'self', at: Date.now(), reason: '驳回后补资料重提', fromStatus: 'rejected', toStatus: 'pending' });
    return S.saveProvince(rec);
  }

  /* M2-2 App 侧导入审核种子（落盘 + 重算/刷新由调用方触发） */
  function importSeed(seedText, opts) {
    var d = deps(), B = d.B;
    if (!B) return { ok: false, error: 'E_DEPS_MISSING', msg: 'AgentBridge 未加载' };
    return B.applySeed(seedText, opts || {});
  }

  /* 34 省清单（与 editor.html:700 对齐；港澳台本期不纳入代理体系） */
  var PROVINCE_LIST = ['北京市','天津市','上海市','重庆市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区'];

  function el(html) { var d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; }
  function val(id){ var e=document.getElementById(id); return e?e.value.trim():''; }

  /* 轻量 toast（与 AgentUI 同视觉，不引入依赖；M-02/M-11 替代裸 alert/黑字） */
  function applyToast(msg, ok) {
    if (typeof document === 'undefined') return;
    var t = document.getElementById('ag-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ag-toast';
      t.className = 'ag-toast';
      document.body.appendChild(t);
    }
    t.className = 'ag-toast ag-toast--show' + (ok ? ' ag-toast--ok' : '');
    t.textContent = msg || '';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'ag-toast'; }, 2200);
  }

  /* M2-1 省级总代表单（¥0，无付费入口）；浏览器专用（M-11：内联红框校验） */
  function mountProvinceForm(container, opts) {
    if (typeof document === 'undefined' || !container) return;
    opts = opts || {};
    var provinceOpts = PROVINCE_LIST.map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('');
    container.innerHTML =
      '<section class="ag-card">'+
        '<div class="ag-meta" style="margin-bottom:12px;">¥0 · 平台人工审核，不收取线上入驻费；一省独家授权，审核通过后开通。</div>'+
        '<div id="pa-conflict" class="ag-banner-err" hidden>'+
          '<svg class="ag-banner-err__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'+
          '<span id="pa-conflict-tx"></span>'+
        '</div>'+
        fieldRow('pa-co','分公司名称','请填写分公司/授权主体全称','text',true)+
        fieldRow('pa-uscc','统一社会信用代码','18 位统一社会信用代码','text',true)+
        fieldRow('pa-license','营业执照编号/上传凭证','缺此项将被拦截','text',true)+
        fieldRow('pa-legal','法定代表人','执照登记法人姓名','text',true)+
        fieldRow('pa-contact','联系人','必填','text',true)+
        fieldRow('pa-phone','联系电话','选填','tel',false)+
        '<div class="ag-field" id="f-pa-province"><label>意向授权省<span class="ag-req">*</span></label>'+
        '<select id="pa-province" class="ag-input"><option value="">请选择省份</option>'+provinceOpts+'</select>'+
        '<div class="ag-field-err"></div></div>'+
        '<div class="ag-field"><label>公司资料（选填）</label>'+
        '<textarea id="pa-materials" class="ag-input" rows="3" placeholder="补充说明资质/渠道/团队等，选填"></textarea></div>'+
      '</section>'+
      '<div id="pa-msg"></div>'+
      '<div class="ag-actions"><button class="ag-btn ag-btn--primary btn-block" id="pa-submit">¥0 确认提交 · 等待审核</button></div>';

    function fieldRow(id,label,ph,type,required){
      return '<div class="ag-field" id="f-'+id+'"><label>'+label+(required?'<span class="ag-req">*</span>':'')+'</label>'+
        '<input id="'+id+'" type="'+(type||'text')+'" class="ag-input" placeholder="'+ph+'">'+
        '<div class="ag-field-err"></div></div>';
    }
    function fieldError(id, show, msg) {
      var wrap = container.querySelector('#f-' + id);
      if (!wrap) return;
      wrap.classList.toggle('ag-field--error', show);
      var e = wrap.querySelector('.ag-field-err');
      if (e) e.textContent = show ? (msg || '此项必填') : '';
    }
    /* M2-6 持久冲突红条：同省已有在册独家总代时留在表单上方，不随 toast 消失 */
    function showConflict(msg) {
      var box = container.querySelector('#pa-conflict');
      var tx = container.querySelector('#pa-conflict-tx');
      if (!box) return;
      if (tx) tx.textContent = msg;
      box.hidden = false;
    }
    function hideConflict() {
      var box = container.querySelector('#pa-conflict');
      if (box) box.hidden = true;
    }
    /* 输入即清除该项红框（保留原校验逻辑，错误码不变） */
    ['pa-co','pa-uscc','pa-license','pa-legal','pa-contact','pa-phone','pa-province','pa-materials'].forEach(function(id){
      var el=container.querySelector('#'+id);
      if(!el) return;
      var ev=(el.tagName==='SELECT')?'change':'input';
      el.addEventListener(ev,function(){ fieldError(id,false); });
    });
    /* 重新选择省份即清除同省冲突持久红条（不再重复报错旧省） */
    var provSel=container.querySelector('#pa-province');
    if(provSel) provSel.addEventListener('change', hideConflict);
    container.querySelector('#pa-submit').onclick=function(){
      var payload = {
        companyName:val('pa-co'), uscc:val('pa-uscc'), license:val('pa-license'),
        legalRep:val('pa-legal'), contact:val('pa-contact'), phone:val('pa-phone'),
        province:val('pa-province'), materials:[val('pa-materials')].filter(Boolean)
      };
      /* 前端先按必填项标红（显式字段→负载键，避免 undefined 误判），提交仍以错误码为准 */
      var need = [
        ['pa-co', 'companyName', '请填写分公司名称'],
        ['pa-uscc', 'uscc', '请填写统一社会信用代码'],
        ['pa-license', 'license', '请填写营业执照（缺执照拦截）'],
        ['pa-legal', 'legalRep', '请填写法定代表人'],
        ['pa-contact', 'contact', '请填写联系人'],
        ['pa-province', 'province', '请选择意向授权省']
      ];
      need.forEach(function(n){ fieldError(n[0], false); });
      need.forEach(function(n){ if (!String(payload[n[1]] || '').trim()) fieldError(n[0], true, n[2]); });
      hideConflict();
      var r=submitProvinceApplication(payload, { quotaCfg: opts.quotaCfg });
      if(r.ok){
        container.innerHTML='<div class="ag-card" style="text-align:center;padding:30px 16px;">'+
          '<div class="ag-prov" style="margin-bottom:8px;">申请已提交 · 等待平台审核</div>'+
          '<div class="ag-meta" style="line-height:1.8;">¥0 免费审核制 · 审核结果将在消息中心同步；省代为一省独家，通过后开通本省权益。</div>'+
          '<div class="ag-actions" style="justify-content:center;margin-top:18px;"><button class="ag-btn ag-btn--primary" onclick="location.href=\'entry.html\'">返回类型选择</button></div></div>';
      } else {
        /* M2-6 省独家冲突提示：仅页面提示，无短信/Push/邮件外发；失败结果走 error 字段，兼容 code */
        var code = r.error || r.code;
        var txt = code==='E_PROVINCE_TAKEN' ? '该省已独家授权，不可重复开通' : (r.msg||'提交失败');
        applyToast(txt, false);
        if (code === 'E_PROVINCE_TAKEN') {
          showConflict('该省已有在册省级总代（省独家），不可重复开通；请更换意向授权省。');
        }
        /* 把后端返回的必填错误落到对应红框 */
        var map = { E_COMPANY_EMPTY:'pa-co', E_USCC_EMPTY:'pa-uscc', E_LICENSE_REQUIRED:'pa-license',
          E_LEGALREP_EMPTY:'pa-legal', E_CONTACT_EMPTY:'pa-contact', E_PROVINCE_REQUIRED:'pa-province' };
        if (map[code]) fieldError(map[code], true, txt);
      }
    };
  }

  /* M2-2 App 侧「导入审核种子」面板（方案A：粘贴 admin 导出的审核种子 JSON） */
  function mountSeedImport(container, opts) {
    if (typeof document === 'undefined' || !container) return;
    opts = opts || {};
    container.innerHTML =
      '<section class="ag-card">'+
        '<h3>后台导入审核记录</h3>'+
        '<div class="ag-meta" style="line-height:1.7;">将后台导出的审核记录内容粘贴到此处完成登记落盘；仅平台内部使用。</div>'+
        '<textarea id="si-text" rows="5" class="ag-input" placeholder=\'{"schema":"engchain-agent-seed/1","actions":[...]}\' style="margin-top:10px;"></textarea>'+
        '<div id="si-msg" class="ag-meta" style="margin-top:10px;"></div>'+
        '<div class="ag-actions" style="margin-top:10px;"><button class="ag-btn ag-btn--primary" id="si-btn">导入并落盘</button></div>'+
      '</section>';
    container.querySelector('#si-btn').onclick=function(){
      var r=importSeed(container.querySelector('#si-text').value, { quotaCfg: opts.quotaCfg });
      var box=container.querySelector('#si-msg');
      if(r.ok){ applyToast('导入成功：'+r.applied.length+' 个动作已落盘，可刷新查看身份/省/名额。', true); box.textContent=''; }
      else { applyToast('导入失败：'+(r.failed&&r.failed[0]?r.failed[0].msg:(r.error||'未知错误'))+'（未写入任何记录）', false); box.textContent=''; }
    };
  }

  /* M2-4 我的省代申请列表：pending/rejected 可见，驳回原因落盘，驳回可重提 */
  function mountMyApplications(container, opts) {
    if (typeof document === 'undefined' || !container) return;
    opts = opts || {};
    function draw() {
      var mine = listMyApplications(opts.uid, opts);
      if (!mine.length) { container.innerHTML = '<div class="ag-empty"><div class="ag-empty__title">暂无省级总代申请</div>'
        + '<div class="ag-empty__sub">提交省级总代（省代）申请后，进度将在此展示。</div></div>'; return; }
      var statusMap = { pending: ['待审核', 'ag-st-pending'], active: ['已生效', 'ag-st-active'], suspended: ['已暂停', 'ag-st-suspended'], rejected: ['已驳回', 'ag-st-terminated'], terminated: ['已终止', 'ag-st-terminated'], revoked: ['已清退', 'ag-st-revoked'], approved: ['已通过', 'ag-st-active'] };
      var provOpts = PROVINCE_LIST.map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('');
      container.innerHTML = '<section class="ag-card"><h3>我的省级总代申请</h3>' +
        mine.map(function (a) {
          var st = statusMap[a.status] || [a.status, ''];
          var rj = a.status === 'rejected' ? '<div class="ag-field-err" style="display:block;margin-top:6px;">驳回原因：' + (a.rejectReason || '—') + '</div>' : '';
          /* D-3：驳回态补资料小表单（执照号/公司名/意向省），patch 合并后再重提；缺执照不再按钮失效 */
          var patchForm = a.status === 'rejected'
            ? '<div class="ag-field" style="margin-top:10px;"><label>营业执照编号（必填）</label>'
              + '<input id="rl-' + a.id + '" class="ag-input" placeholder="补填营业执照编号" value="' + escAttr(a.branchCompany && a.branchCompany.license || '') + '">'
              + '<div class="ag-field-err"></div></div>'
              + '<div class="ag-field"><label>公司名称</label>'
              + '<input id="rc-' + a.id + '" class="ag-input" placeholder="补填公司名称" value="' + escAttr(a.branchCompany && a.branchCompany.name || '') + '"></div>'
              + '<div class="ag-field"><label>意向授权省</label>'
              + '<select id="rp-' + a.id + '" class="ag-input"><option value="">请选择省份</option>' + provOpts + '</select>'
              + '<div class="ag-field-err"></div></div>'
              + '<div class="ag-actions" style="margin-top:8px;"><button class="ag-btn ag-btn--primary ag-btn--sm" onclick="AgentApply._resubmitForm(\'' + a.id + '\')">补资料并重新提交</button></div>'
            : '';
          return '<div class="ag-member" style="align-items:flex-start;flex-direction:column;gap:6px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">' +
            '<div class="ag-member__main"><div class="ag-member__name">' + (a.branchCompany && a.branchCompany.name || '—') + '</div>' +
            '<div class="ag-member__sub">授权省：' + (a.province || '—') + '</div>' + rj + '</div>' +
            '<span class="ag-badge ' + (st[1] || '') + '">' + st[0] + '</span></div>' +
            patchForm + '</div>';
        }).join('') + '</section>';
    }
    AgentApply._resubmit = function (id) {
      var r = resubmit(id, {}, opts);
      if (r.ok) { draw(); applyToast('已补资料重新提交', true); if (opts.onChange) opts.onChange(); }
      else applyToast(r.msg || r.error || '重提失败', false);
    };
    /* D-3：读取补资料小表单，patch 合并后重提；缺执照内联提示 */
    AgentApply._resubmitForm = function (id) {
      var license = (container.querySelector('#rl-' + id) || {}).value || '';
      var companyName = (container.querySelector('#rc-' + id) || {}).value || '';
      var province = (container.querySelector('#rp-' + id) || {}).value || '';
      license = license.trim(); companyName = companyName.trim(); province = province.trim();
      if (!license) { applyToast('请先补填营业执照编号', false); return; }
      var r = resubmit(id, { license: license, companyName: companyName, province: province }, opts);
      if (r.ok) { draw(); applyToast('已补资料重新提交', true); if (opts.onChange) opts.onChange(); }
      else applyToast(r.msg || r.error || '重提失败', false);
    };
    draw();
  }

  var api = {
    submitProvinceApplication: submitProvinceApplication,
    listMyApplications: listMyApplications,
    resubmit: resubmit,
    importSeed: importSeed,
    mountProvinceForm: mountProvinceForm,
    mountSeedImport: mountSeedImport,
    mountMyApplications: mountMyApplications,
    PROVINCE_LIST: PROVINCE_LIST
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentApply = api;
})(typeof window !== 'undefined' ? window : globalThis);
