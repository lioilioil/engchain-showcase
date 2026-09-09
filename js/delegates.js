/* ═══════════════════════════════════════════════════════════════
   ENGCHAIN · 统一委托模块 v1.0
   ────────────────────────────────────────────────────────────────
   覆盖全系统「委托」事件（资质招商 / 建企买卖 / 人才服务 / 通用委托）：
   · 统一存储 engchain_delegates（数组），自动迁移旧 franchise_delegate_v1
   · 三态流转：等待承接 / 已承接 / 已驳回（兼容历史「待承接」）
   · 认证账号信息回填（联系人姓名 / 电话）
   · 地区：选择器 + 文字填写 + 自动验证修正（省/市）
   · 共享表单渲染 / 绑定 / 取值 / 回填（chips 便捷输入，避免全填写项）
   依赖：common.js（UI.state / UI.cityPicker / UI.cityData / UI.cityLookup）
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'engchain_delegates';
  var LEGACY_KEY = 'franchise_delegate_v1';

  /* ---------- 基础工具 ---------- */
  function fmtNow() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function normStatus(s) { return (s === '待承接' ? '等待承接' : (s || '等待承接')); }
  function read() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

  /* ---------- 旧数据迁移（归属上一任务序列） ---------- */
  var migrated = false;
  function migrate() {
    if (migrated) return;
    migrated = true;
    try {
      var legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (!legacy || !legacy.id) return;
      var all = read();
      var hit = all.some(function (x) { return x.id === legacy.id; });
      if (!hit) {
        legacy.biz = legacy.biz || 'franchise';
        legacy.bizLabel = legacy.bizLabel || '资质招商';
        legacy.status = normStatus(legacy.status);
        all.unshift(legacy);
        write(all);
      }
      try { localStorage.removeItem(LEGACY_KEY); } catch (e2) {}
    } catch (e) {}
  }

  /* ---------- 存储 API ---------- */
  function list() { migrate(); return read(); }
  function get(id) { migrate(); var a = read(); for (var i = 0; i < a.length; i++) { if (a[i].id === id) return a[i]; } return null; }
  function byBiz(biz) { return list().filter(function (x) { return x.biz === biz; }); }
  function franchiseCurrent() { var a = byBiz('franchise'); return a.length ? a[0] : null; }
  function add(rec) {
    migrate();
    rec = rec || {};
    if (!rec.id) rec.id = 'W' + Date.now().toString().slice(-8);
    rec.status = normStatus(rec.status);
    rec.submitTime = rec.submitTime || fmtNow();
    rec.updateTime = fmtNow();
    var all = read();
    all.unshift(rec);
    write(all);
    return rec;
  }
  function upsert(rec) {
    migrate();
    rec = rec || {};
    var all = read();
    var i = -1;
    for (var k = 0; k < all.length; k++) { if (all[k].id && rec.id && all[k].id === rec.id) { i = k; break; } }
    rec.status = normStatus(rec.status);
    if (i >= 0) {
      var prev = all[i];
      /* 已承接不可被普通提交覆盖状态 */
      if (normStatus(prev.status) === '已承接') rec.status = '已承接';
      rec.submitTime = prev.submitTime || rec.submitTime || fmtNow();
      all[i] = Object.assign({}, prev, rec);
      all[i].updateTime = fmtNow();
    } else {
      rec.submitTime = rec.submitTime || fmtNow();
      all.unshift(rec);
    }
    write(all);
    return rec;
  }
  function remove(id) { migrate(); write(read().filter(function (x) { return x.id !== id; })); }
  function counts() {
    var a = list(), c = { all: a.length, pending: 0, accepted: 0, rejected: 0 };
    for (var i = 0; i < a.length; i++) {
      var s = normStatus(a[i].status);
      if (s === '已承接') c.accepted++;
      else if (s === '已驳回') c.rejected++;
      else c.pending++;
    }
    return c;
  }

  /* ---------- 状态元信息 ---------- */
  function statusMeta(s) {
    var st = normStatus(s);
    if (st === '已承接') return { cls: 'st-accepted', label: '已承接', tip: '您的委托已被承接，专属顾问正在为您服务，如需调整请直接联系客服。' };
    if (st === '已驳回') return { cls: 'st-rejected', label: '已驳回', tip: '您的委托未通过审核，可修改后重新提交。' };
    return { cls: 'st-pending', label: '等待承接', tip: '委托已提交，顾问将在 2 小时内与您联系，请保持电话畅通。' };
  }

  /* ---------- 认证账号信息（姓名 / 电话） ---------- */
  function authContact() {
    var st = {}; try { st = window.UI ? UI.state.get() : {}; } catch (e) {}
    var a = {}; try { if (window.AuthStore) a = AuthStore.read(); } catch (e) {}
    var name = (a.realname && a.realname.name) || st.user || '';
    var phone = '';
    var masked = '';
    if (a.realname && a.realname.mobile) {
      masked = a.realname.mobile;
      if (/^1[3-9]\d{9}$/.test(masked)) phone = masked;
    }
    if (!phone && /^1[3-9]\d{9}$/.test(st.mobile || '')) phone = st.mobile;
    if (!phone && a.profile && a.profile.basic && /^1[3-9]\d{9}$/.test(a.profile.basic.mobile || '')) phone = a.profile.basic.mobile;
    return { name: name, phone: phone, masked: masked };
  }

  /* ---------- 地区解析 / 自动验证修正 ---------- */
  var PROVINCES = null, CITY_OF = null;
  function ensureGeo() {
    if (PROVINCES) return;
    if (window.UI && UI.cityData) {
      PROVINCES = UI.cityData.map(function (g) { return g[0]; });
      CITY_OF = UI.cityLookup || {};
    } else {
      PROVINCES = []; CITY_OF = {};
    }
  }
  function cleanStr(s) { return (s || '').replace(/[\s·,，。、]+/g, ''); }
  function parseRegion(text) {
    ensureGeo();
    var raw = (text || '').trim();
    if (!raw) return { province: '', city: '', text: '', ok: false, empty: true };
    if (raw === '全国') return { province: '全国', city: '', text: '全国', ok: true };
    var t = cleanStr(raw);
    /* 直辖市直接命中 */
    var muni = ['北京', '上海', '天津', '重庆'];
    for (var m = 0; m < muni.length; m++) { if (t.indexOf(muni[m]) > -1) return { province: muni[m], city: muni[m], text: muni[m], ok: true }; }
    /* 匹配省份（输入含省名，或省名含输入） */
    var prov = '';
    for (var i = 0; i < PROVINCES.length; i++) {
      var p = PROVINCES[i];
      if (t.indexOf(p) > -1) { prov = p; break; }
    }
    if (!prov) {
      var m2 = /^([\u4e00-\u9fa5]{2,4})(?:省|自治区|特别行政区)/.exec(t);
      if (m2) {
        var guess = m2[1].replace(/壮族|回族|维吾尔/g, '');
        for (var j = 0; j < PROVINCES.length; j++) {
          if (PROVINCES[j].indexOf(guess) > -1 || guess.indexOf(PROVINCES[j]) > -1) { prov = PROVINCES[j]; break; }
        }
      }
    }
    /* 匹配城市（长名优先，跳过与省同名的城市键，避免「吉林」省/市混淆） */
    var city = '';
    var keys = Object.keys(CITY_OF).slice().sort(function (a, b) { return b.length - a.length; });
    for (var k = 0; k < keys.length; k++) {
      var c = keys[k];
      if (c === prov) continue;
      if (t.indexOf(c) > -1) { city = c; break; }
    }
    if (prov && !city) {
      var pText = prov + ' · 全省';
      return { province: prov, city: '', text: pText, ok: true, partial: true };
    }
    if (city) {
      var p2 = prov || CITY_OF[city] || '';
      return { province: p2, city: city, text: p2 ? p2 + ' · ' + city : city, ok: true, corrected: !prov };
    }
    return { province: '', city: '', text: raw, ok: false, unknown: true };
  }
  function regionText(region) {
    if (!region) return '—';
    if (typeof region === 'string') return region || '—';
    if (region.text) return region.text;
    if (region.province && region.city) return region.province === region.city ? region.city : region.province + ' · ' + region.city;
    if (region.province) return region.province;
    return '—';
  }

  /* ---------- 表单模板（便捷输入：chips 点选） ---------- */
  var FORM_TEMPLATES = {
    franchise: {
      typeLabel: '资质需求类型',
      typeOptions: ['施工总承包', '专业承包', '工程设计', '监理造价', '电力机电', '水利公路', '市政公用', '其他'],
      sub: [
        { name: 'qualLevel', label: '期望资质等级', options: ['不限', '一级', '二级', '三级', '甲级'] },
        { name: 'mode', label: '合作模式', options: ['分公司加盟', '资质联营', '居间介绍', '项目合作', '其他'] },
        { name: 'budget', label: '预算区间', options: ['面议', '10万以内', '10-30万', '30-50万', '50万以上'] }
      ]
    },
    trade: {
      typeLabel: '需求类型',
      typeOptions: ['企业转让', '企业收购', '股权转让', '资产转让', '项目合作', '其他'],
      sub: [
        { name: 'budget', label: '预算区间', options: ['面议', '100万以内', '100-500万', '500-1000万', '1000万以上'] }
      ]
    },
    general: {
      typeLabel: '委托方向',
      typeOptions: ['资质招商', '建企买卖', '人才招聘', '项目合作', '劳务设备', '其他'],
      sub: [
        { name: 'budget', label: '预算区间', options: ['面议', '10万以内', '10-30万', '30-50万', '50万以上'] }
      ]
    }
  };

  function chipsHtml(name, options) {
    return '<div class="dg-chips" data-name="' + name + '">' + (options || []).map(function (o) {
      return '<button type="button" class="dg-chip" data-val="' + UI.esc(o) + '">' + UI.esc(o) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- 共享表单：渲染 ---------- */
  function formHtml(opts) {
    opts = opts || {};
    var tpl = FORM_TEMPLATES[opts.mode] || FORM_TEMPLATES.general;
    var h = '';
    h += '<div class="df-field">' +
      '<label class="df-label">' + tpl.typeLabel + '<span class="req">*</span></label>' +
      chipsHtml('type', tpl.typeOptions) + '</div>';
    (tpl.sub || []).forEach(function (s) {
      h += '<div class="df-field"><label class="df-label">' + s.label + '</label>' + chipsHtml(s.name, s.options) + '</div>';
    });
    h += '<div class="df-field">' +
      '<label class="df-label">期望合作地区<span class="req">*</span></label>' +
      '<div class="dg-region">' +
        '<input class="df-control dg-region-input" id="dfRegion" placeholder="如：四川省 成都 / 全国" maxlength="40" autocomplete="off">' +
        '<button type="button" class="dg-region-pick" id="dfRegionPick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>选择</button>' +
      '</div>' +
      '<div class="dg-region-hint" id="dfRegionHint">支持文字填写，自动识别并修正为「省 · 市」</div>' +
    '</div>';
    h += '<div class="df-field">' +
      '<label class="df-label">联系人<span class="req">*</span><span class="df-tip">已自动填入认证账号信息，可修改</span></label>' +
      '<input class="df-control" id="dfContact" placeholder="认证账号姓名" maxlength="20" autocomplete="off">' +
    '</div>';
    h += '<div class="df-field">' +
      '<label class="df-label">联系电话<span class="req">*</span></label>' +
      '<input class="df-control" id="dfPhone" type="tel" placeholder="认证账号手机号" maxlength="11" autocomplete="off">' +
    '</div>';
    h += '<div class="df-field">' +
      '<label class="df-label">备用联系人<span class="opt">选填</span><span class="df-tip">便于顾问多渠道联系您</span></label>' +
      '<div class="dg-row2">' +
        '<input class="df-control" id="dfBackName" placeholder="备用联系人姓名" maxlength="20" autocomplete="off">' +
        '<input class="df-control" id="dfBackPhone" type="tel" placeholder="备用联系电话" maxlength="11" autocomplete="off">' +
      '</div>' +
    '</div>';
    h += '<div class="df-field">' +
      '<label class="df-label">需求说明<span class="opt">选填</span></label>' +
      '<textarea class="df-control df-textarea" id="dfNote" placeholder="补充预算、区域名额、交付周期等细节，便于精准匹配" maxlength="200"></textarea>' +
    '</div>';
    return h;
  }

  /* ---------- 共享表单：绑定（chips 单选 + 地区联动） ---------- */
  function bindForm(root) {
    if (!root) return;
    root.querySelectorAll('.dg-chips').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var chip = e.target.closest('.dg-chip');
        if (!chip) return;
        var active = chip.classList.contains('active');
        box.querySelectorAll('.dg-chip').forEach(function (c) { c.classList.remove('active'); });
        if (!active) chip.classList.add('active');
      });
    });
    var pick = root.querySelector('#dfRegionPick');
    var regionInput = root.querySelector('#dfRegion');
    var regionHint = root.querySelector('#dfRegionHint');
    function hintUpdate(text) {
      if (!regionHint) return;
      var v = (text == null ? regionInput.value : text).trim();
      if (!v) {
        regionHint.className = 'dg-region-hint';
        regionHint.textContent = '支持文字填写，自动识别并修正为「省 · 市」';
        return;
      }
      var r = parseRegion(v);
      if (r.ok) {
        regionHint.className = 'dg-region-hint ok';
        regionHint.innerHTML = r.partial
          ? '已识别省份：<b>' + UI.esc(r.province) + '</b>（城市待细化，可继续输入或点击选择）'
          : '已识别为：<b>' + UI.esc(r.text) + '</b>' + (r.corrected ? '（已自动补全省份）' : '');
      } else {
        regionHint.className = 'dg-region-hint warn';
        regionHint.innerHTML = '未识别到标准省/市，请点击「选择」或输入如「四川省 成都」';
      }
    }
    function applyCorrection() {
      var v = regionInput.value.trim();
      if (!v) return;
      var r = parseRegion(v);
      if (r.ok) { regionInput.value = r.text; hintUpdate(r.text); }
      else hintUpdate(v);
    }
    if (regionInput) {
      regionInput.addEventListener('input', function () { hintUpdate(); });
      regionInput.addEventListener('blur', applyCorrection);
    }
    if (pick) {
      pick.addEventListener('click', function () {
        if (!window.UI || !UI.cityPicker) return;
        UI.cityPicker({
          current: regionInput ? regionInput.value : '',
          onSelect: function (city) {
            var r = parseRegion(city);
            if (regionInput) { regionInput.value = r.ok ? r.text : city; hintUpdate(r.ok ? r.text : city); }
          }
        });
      });
    }
    return root;
  }

  /* ---------- 共享表单：回填 ---------- */
  function setInput(root, id, v) { var el = root.querySelector('#' + id); if (el) el.value = v || ''; }
  function fillForm(root, rec) {
    if (!root || !rec) return;
    function setChips(name, val) {
      if (!val) return;
      var box = root.querySelector('.dg-chips[data-name="' + name + '"]');
      if (!box) return;
      box.querySelectorAll('.dg-chip').forEach(function (c) {
        if (c.dataset.val === val) c.classList.add('active');
      });
    }
    setChips('type', rec.type);
    setChips('qualLevel', rec.qualLevel);
    setChips('mode', rec.mode);
    setChips('budget', rec.budget);
    var rt = regionText(rec.region);
    setInput(root, 'dfRegion', rt === '—' ? '' : rt);
    setInput(root, 'dfContact', rec.contact);
    setInput(root, 'dfPhone', rec.phone);
    setInput(root, 'dfBackName', rec.backup ? rec.backup.name : '');
    setInput(root, 'dfBackPhone', rec.backup ? rec.backup.phone : '');
    setInput(root, 'dfNote', rec.note);
    var hint = root.querySelector('#dfRegionHint');
    if (hint && rt !== '—') {
      var rr = parseRegion(rt);
      hint.className = 'dg-region-hint' + (rr.ok ? ' ok' : ' warn');
      hint.innerHTML = rr.ok ? '已识别为：<b>' + UI.esc(rr.text) + '</b>' : '未识别到标准省/市，请点击「选择」';
    }
  }

  /* ---------- 共享表单：认证信息回填（仅填空） ---------- */
  function prefillAuth(root) {
    var ac = authContact();
    if (!ac.name) { setInput(root, 'dfContact', ''); } else { var n = root.querySelector('#dfContact'); if (n && !n.value.trim()) n.value = ac.name; }
    var p = root.querySelector('#dfPhone'); if (p && !p.value.trim()) p.value = ac.phone;
    return ac;
  }

  /* ---------- 共享表单：取值校验 ---------- */
  function chipVal(root, name) {
    var box = root.querySelector('.dg-chips[data-name="' + name + '"]');
    if (!box) return '';
    var act = box.querySelector('.dg-chip.active');
    return act ? act.dataset.val : '';
  }
  function inputVal(root, id) { var el = root.querySelector('#' + id); return el ? el.value.trim() : ''; }
  function collectForm(root) {
    var type = chipVal(root, 'type');
    if (!type) {
      var box = root.querySelector('.dg-chips[data-name="type"]');
      var label = box ? (box.parentNode.querySelector('.df-label') || {}).textContent || '需求类型' : '需求类型';
      if (window.UI && UI.toast) UI.toast('请选择' + label.replace('*', ''), 'warn');
      return null;
    }
    var qualLevel = chipVal(root, 'qualLevel') || '不限';
    var mode = chipVal(root, 'mode') || '';
    var budget = chipVal(root, 'budget') || '';
    var regionRaw = inputVal(root, 'dfRegion');
    var r = parseRegion(regionRaw);
    if (!r.ok) { if (window.UI && UI.toast) UI.toast('请选择或填写正确的省/市（如：四川省 成都）', 'warn'); return null; }
    var contact = inputVal(root, 'dfContact');
    if (!contact) { if (window.UI && UI.toast) UI.toast('请填写联系人', 'warn'); return null; }
    var phone = inputVal(root, 'dfPhone');
    if (!phone) { if (window.UI && UI.toast) UI.toast('请填写联系电话', 'warn'); return null; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { if (window.UI && UI.toast) UI.toast('请输入正确的 11 位手机号', 'warn'); return null; }
    var backName = inputVal(root, 'dfBackName');
    var backPhone = inputVal(root, 'dfBackPhone');
    var backup = '';
    if (backName || backPhone) {
      if (backPhone && !/^1[3-9]\d{9}$/.test(backPhone)) { if (window.UI && UI.toast) UI.toast('备用联系电话格式不正确', 'warn'); return null; }
      backup = { name: backName, phone: backPhone };
    }
    var note = inputVal(root, 'dfNote');
    return {
      type: type, qualLevel: qualLevel, mode: mode, budget: budget,
      region: { province: r.province, city: r.city, text: r.text },
      contact: contact, phone: phone, backup: backup, note: note
    };
  }

  /* ---------- 客服入口（已承接态共用） ---------- */
  function openServiceSheet() {
    var s = UI.sheet();
    s.setText('在线客服');
    s.html(
      '<div style="padding:10px 0 20px;text-align:center;">' +
        '<div style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;color:var(--primary-dim);">' +
          '<svg class="ic" style="width:28px;height:28px;" viewBox="0 0 24 24"><use href="#i-headset"/></svg>' +
        '</div>' +
        '<div style="font-size:16px;font-weight:700;color:var(--text-1);">ENGCHAIN 在线客服</div>' +
        '<div style="font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.6;">工作时间：周一至周日 9:00 - 21:00<br>平均响应时间：3 分钟</div>' +
        '<button class="btn btn-primary btn-block" style="margin-top:18px;height:46px;" onclick="UI.toast(\'正在接入客服...\',\'ok\');UI.closeSheet();">' +
          '<svg class="ic" style="width:18px;height:18px;" viewBox="0 0 24 24"><use href="#i-chat"/></svg>开始对话' +
        '</button>' +
        '<div style="font-size:11px;color:var(--text-3);margin-top:12px;">也可拨打热线 400-000-0000</div>' +
      '</div>'
    );
    s.show();
  }
  function openCallDialog() {
    UI.dialog({
      title: '联系客服',
      text: '客服热线：<b style="color:var(--primary);font-size:16px;">400-000-0000</b><br><br>工作时间：周一至周日 9:00 - 21:00',
      ok: '拨打',
      cancel: '取消',
      onOk: function () { UI.toast('正在拨打 400-000-0000', 'ok'); }
    });
  }

  window.Delegates = {
    KEY: KEY, LEGACY_KEY: LEGACY_KEY,
    list: list, get: get, byBiz: byBiz, franchiseCurrent: franchiseCurrent,
    add: add, upsert: upsert, remove: remove, counts: counts,
    normStatus: normStatus, statusMeta: statusMeta,
    authContact: authContact,
    parseRegion: parseRegion, regionText: regionText,
    formHtml: formHtml, bindForm: bindForm, fillForm: fillForm,
    prefillAuth: prefillAuth, collectForm: collectForm,
    openServiceSheet: openServiceSheet, openCallDialog: openCallDialog,
    FORM_TEMPLATES: FORM_TEMPLATES
  };
})();
