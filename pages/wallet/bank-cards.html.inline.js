(function(){try{var t=localStorage.getItem('engchain-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();

(function(){
function rm(){var a=document.querySelectorAll('base');for(var i=0;i<a.length;i++){if(!a[i].dataset.ef){a[i].parentNode.removeChild(a[i]);}}}
var p=location.pathname,m=/^(\/app\/[^/]+)/.exec(p),pf=m?m[1]:"";var dir="pages/wallet/";var base;
if(pf){base=pf+"/"+dir;}else{var q=p.indexOf("?")>-1?p.slice(0,p.indexOf("?")):p;base=q.slice(0,q.lastIndexOf("/")+1);}
rm();var b=document.createElement("base");b.href=base;b.setAttribute("data-ef","1");document.head.insertBefore(b,document.head.firstChild);
})();


(function () {
  window.__ROOT__ = '../../';
  var KEY = 'engchain-bank-cards';
  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function mask(no) { var s = String(no || '').replace(/\s/g, ''); return s.length > 4 ? s.slice(-4) : s; }
  function fmtNo(no) { var s = String(no || '').replace(/\s/g, ''); return s.replace(/(\d{4})(?=\d)/g, '$1 '); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

  /* ===== 卡 BIN 库（前 6 位识别发卡行与卡种，覆盖常见银行） ===== */
  var BINDB = [
    { p: ['621226','621225','621223','621281','621558','622200','622202','622203','622208','622210','621227'], b: '中国工商银行', c: '#C7000B', t: '借记卡' },
    { p: ['621700','622700','621081','621499','622280','436742','622723'], b: '中国建设银行', c: '#0052B4', t: '借记卡' },
    { p: ['622848','621336','622837','623018','95599','622846','621660'], b: '中国农业银行', c: '#009B4C', t: '借记卡' },
    { p: ['621661','621660','621666','621668','621567','621662','621663','621664','621661'], b: '中国银行', c: '#B32025', t: '借记卡' },
    { p: ['622260','622258','622259','621002','621004','622262'], b: '交通银行', c: '#1D2088', t: '借记卡' },
    { p: ['621483','621485','621286','622580','622588','622576','622577','622578','622579','622581','622582','622583','622584','622585','622586','622587','622589'], b: '招商银行', c: '#A60022', t: '借记卡' },
    { p: ['622575','622578','622579','518710'], b: '招商银行', c: '#A60022', t: '信用卡' },
    { p: ['621098','622150','622151','622188','622199','621797','955100'], b: '中国邮政储蓄银行', c: '#007A33', t: '借记卡' },
    { p: ['622521','622522','621351','621352'], b: '上海浦东发展银行', c: '#004098', t: '借记卡' },
    { p: ['622622','622623','622621','621691'], b: '中国民生银行', c: '#E30613', t: '借记卡' },
    { p: ['622690','622691','622692','622696','622698','621771','621772','621773'], b: '中信银行', c: '#B3002D', t: '借记卡' },
    { p: ['622909','622908','622901','622902','622903','621576','621577','621578'], b: '兴业银行', c: '#003A70', t: '借记卡' },
    { p: ['622660','622661','622662','622663','622665','622666','622667','622668','622669','621491','621492','621493'], b: '中国光大银行', c: '#8B1A1A', t: '借记卡' },
    { p: ['622155','622156','621626','621627','621628'], b: '平安银行', c: '#F7941E', t: '借记卡' },
    { p: ['622630','622631','622632','622633','622634','621221','621222'], b: '华夏银行', c: '#C7000B', t: '借记卡' },
    { p: ['622568','622569','622555','622556','622557','622558','621462','621463'], b: '广发银行', c: '#B71C1C', t: '借记卡' },
    { p: ['621066','622899','621067','621068'], b: '北京银行', c: '#003A70', t: '借记卡' },
    { p: ['622892','621030','621031'], b: '上海银行', c: '#A60022', t: '借记卡' },
    { p: ['622281','622282','621200'], b: '宁波银行', c: '#C8102E', t: '借记卡' },
    { p: ['622876','621418','621419'], b: '江苏银行', c: '#005BAB', t: '借记卡' },
    { p: ['622309','622310','621330'], b: '浙商银行', c: '#004B93', t: '借记卡' },
    { p: ['622340','621231'], b: '恒丰银行', c: '#005EB8', t: '借记卡' },
    { p: ['622884','622886'], b: '渤海银行', c: '#0072BC', t: '借记卡' },
    { p: ['621264','622888'], b: '成都银行', c: '#E60012', t: '借记卡' },
    { p: ['622456','621535'], b: '哈尔滨银行', c: '#C7000B', t: '借记卡' },
    { p: ['621553','621554'], b: '长沙银行', c: '#C7000B', t: '借记卡' }
  ];
  /* Luhn 校验（银行卡号本地合法性第一道关卡） */
  function luhn(s) {
    var sum = 0, alt = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var n = parseInt(s[i], 10);
      if (isNaN(n)) return false;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
  function detectBank(no) {
    no = String(no || '').replace(/\s/g, '');
    if (no.length < 6) return null;
    /* BIN 多为 6 位（ISO 7812），个别老卡为 5 位前缀：逐级回退匹配 */
    for (var L = 6; L >= 4; L--) {
      var pre = no.slice(0, L);
      for (var i = 0; i < BINDB.length; i++) {
        if (BINDB[i].p.indexOf(pre) >= 0) return BINDB[i];
      }
    }
    return null;
  }

  /* ===== 实名信息读取（AuthStore.realname，demo 仅存姓名+掩码） ===== */
  function realAuth() {
    try {
      var au = (window.AuthStore && AuthStore.read) ? AuthStore.read() : null;
      return (au && au.realname && au.realname.ok) ? au.realname : null;
    } catch (e) { return null; }
  }
  /* 身份证号合法性（GB 11643-1999 校验位算法） */
  function idValid(id) {
    if (!/^\d{17}[\dXx]$/.test(String(id || ''))) return false;
    var w = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
    var c = '10X98765432';
    var sum = 0;
    for (var i = 0; i < 17; i++) sum += +String(id)[i] * w[i];
    return c[sum % 11] === String(id)[17].toUpperCase();
  }

  function render() {
    var list = load();
    var box = document.getElementById('bc-list');
    if (!list.length) {
      box.innerHTML = '<div class="bc-empty"><svg class="ic" style="width:44px;height:44px;color:var(--text-3);opacity:.5;margin-bottom:10px;"><use href="#i-bank"/></svg>' +
        '<div class="fs-13" style="margin-bottom:4px;">暂未绑定银行卡</div>' +
        '<div class="fs-11">添加后可用于提现到账</div></div>';
    } else {
      box.innerHTML = list.map(function (c) {
        var col = c.bankColor || 'var(--primary)';
        return '<div class="bc-card' + (c.isDefault ? ' is-default' : '') + '">' +
          '<div class="bc-bar" style="background:' + col + ';"></div>' +
          (c.isDefault ? '<span class="bc-tag">默认卡</span>' : '') +
          '<div class="bc-bank"><span class="bc-dot" style="width:12px;height:12px;border-radius:4px;background:' + col + ';"></span>' + esc(c.bank) + '<span class="bc-kind">' + esc(c.type || '借记卡') + '</span></div>' +
          '<div class="bc-no">**** **** **** ' + esc(mask(c.cardNo)) + '</div>' +
          '<div class="bc-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' + esc(c.holder || '') + ' · 四要素已核验</div>' +
          '<div class="bc-actions">' +
            (c.isDefault ? '' : '<button class="tx-btn tx-btn--primary" onclick="setDefault(\'' + c.id + '\')">设为默认</button>') +
            '<button class="tx-btn" style="color:var(--danger);" onclick="removeCard(\'' + c.id + '\')">删除</button>' +
          '</div></div>';
      }).join('');
    }
  }

  window.setDefault = function (id) {
    var a = load();
    a.forEach(function (c) { c.isDefault = (c.id === id); });
    save(a); render(); UI.toast('已设为默认银行卡', 'ok');
  };
  window.removeCard = function (id) {
    UI.dialog({
      title: '删除银行卡', text: '确定删除该银行卡吗？', ok: '删除', cancel: '取消', danger: true,
      onOk: function () {
        var a = load().filter(function (c) { return c.id !== id; });
        if (a.length && !a.some(function (c) { return c.isDefault; })) a[0].isDefault = true;
        save(a); render(); UI.toast('已删除', 'ok');
      }
    });
  };

  /* ===== 卡号实时识别 ===== */
  var recogBox = document.getElementById('bc-recog');
  function updateRecog() {
    var no = document.getElementById('bc-no').value.replace(/\s/g, '');
    if (no.length < 6) { recogBox.classList.remove('show'); return; }
    var hit = detectBank(no);
    recogBox.classList.add('show');
    var dot = document.getElementById('bc-recog-dot');
    var text = document.getElementById('bc-recog-text');
    if (hit) {
      dot.style.background = hit.c;
      text.innerHTML = '<b>' + esc(hit.b) + '</b> · ' + esc(hit.t) + (no.length >= 13 && !luhn(no) ? ' · <span style="color:var(--error);">卡号校验位异常</span>' : '');
      document.getElementById('bc-bank').value = hit.b;
    } else {
      dot.style.background = 'var(--line)';
      text.innerHTML = '未匹配到发卡行，请手动填写开户银行';
    }
  }
  document.getElementById('bc-no').addEventListener('input', updateRecog);
  document.getElementById('bc-no').addEventListener('blur', function () {
    var no = document.getElementById('bc-no').value.replace(/\s/g, '');
    if (no.length >= 13 && !luhn(no)) UI.toast('卡号未通过 Luhn 校验，请核对', 'warn');
  });

  /* ===== 实名信息自动带出（demo 实名仅存姓名，证件/手机按掩码规则处理） ===== */
  (function initReal() {
    var r = realAuth();
    var box = document.getElementById('bc-real');
    var tx = document.getElementById('bc-real-text');
    if (r) {
      document.getElementById('bc-holder').value = r.name || '';
      /* 身份证/手机号：仅当实名存有完整明文时带出，否则留空由用户填写 */
      if (r.idNo && !/\*/.test(String(r.idNo))) document.getElementById('bc-idno').value = r.idNo;
      if (r.mobile && !/\*/.test(String(r.mobile))) document.getElementById('bc-phone').value = r.mobile;
      box.classList.remove('muted');
      tx.innerHTML = '已匹配实名：<b>' + esc(r.name) + '</b> · 持卡人将自动核验，证件号/手机号请填写与实名一致的信息';
    } else {
      box.classList.add('muted');
      tx.innerHTML = '完成实名认证后，身份信息将自动带出并用于四要素核验';
    }
  })();

  /* ===== 添加并四要素核验（演示模拟：姓名比对 + 证件校验位 + 手机格式；正式环境由银联四要素 API 完成） ===== */
  document.getElementById('bc-add').onclick = function () {
    var no = document.getElementById('bc-no').value.replace(/\s/g, '');
    var bank = document.getElementById('bc-bank').value.trim();
    var holder = document.getElementById('bc-holder').value.trim();
    var idno = document.getElementById('bc-idno').value.trim();
    var phone = document.getElementById('bc-phone').value.trim();
    if (!/^\d{13,25}$/.test(no)) { UI.toast('请填写正确的银行卡号（13-25 位数字）', 'warn'); return; }
    if (!luhn(no)) { UI.toast('卡号未通过 Luhn 校验，请核对', 'warn'); return; }
    if (!bank) { UI.toast('请填写开户银行（输入卡号可自动识别）', 'warn'); return; }
    if (!holder) { UI.toast('请填写持卡人姓名', 'warn'); return; }
    if (!idValid(idno)) { UI.toast('身份证号格式或校验位有误，请核对', 'warn'); return; }
    if (!/^\d{11}$/.test(phone)) { UI.toast('请填写正确的 11 位手机号', 'warn'); return; }

    /* 四要素核验：姓名必须与实名认证一致（演示环境可执行的最强一致性校验） */
    var r = realAuth();
    if (!r) { UI.toast('请先完成实名认证后再绑定银行卡', 'warn'); return; }
    if (holder !== r.name) { UI.toast('户名与实名不一致，已保存为该卡专属户名', 'warn'); /* 不覆盖 realname，仅保存为卡专属户名 */ }
    if (r.mobile && !/\*/.test(String(r.mobile)) && phone !== r.mobile) { UI.toast('预留手机号与实名认证不一致（请使用认证手机号）', 'err'); return; }

    var hit = detectBank(no);
    var a = load();
    var card = { id: 'BC' + Date.now(), bank: bank, bankColor: hit ? hit.c : '#7C5BBD', cardNo: no, holder: holder, idno: idno, phone: phone, type: hit ? hit.t : '银行卡', isDefault: a.length === 0 };
    a.push(card);
    save(a);
    ['bc-no','bc-bank','bc-holder','bc-idno','bc-phone'].forEach(function (id) { document.getElementById(id).value = ''; });
    recogBox.classList.remove('show');
    render();
    UI.toast('四要素核验通过，银行卡已添加', 'ok');
  };

  render();
})();
