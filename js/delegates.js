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
    /* v2.0：默认锁定实名认证信息（联系人/电话只读，仅可补充备用手机号）；编辑页可传 authLocked:false 保持可编辑 */
    var locked = opts.authLocked !== false;
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
    if (locked) {
      h += '<div class="df-field">' +
        '<label class="df-label">联系人<span class="req">*</span><span class="dg-auth-tag">实名认证信息</span></label>' +
        '<div class="dg-locked">' +
          '<svg class="dg-lock-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4.5" y="11" width="15" height="9.5" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><circle cx="12" cy="15.5" r="1.1"/></svg>' +
          '<input class="df-control" id="dfContact" readonly placeholder="实名认证姓名" maxlength="20" autocomplete="off">' +
        '</div>' +
        '<div class="dg-lock-note">默认使用实名认证信息，仅可补充下方备用手机号</div>' +
      '</div>';
      h += '<div class="df-field">' +
        '<label class="df-label">联系电话<span class="req">*</span><span class="dg-auth-tag">实名认证信息</span></label>' +
        '<div class="dg-locked">' +
          '<svg class="dg-lock-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4.5" y="11" width="15" height="9.5" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><circle cx="12" cy="15.5" r="1.1"/></svg>' +
          '<input class="df-control" id="dfPhone" type="tel" readonly placeholder="实名认证手机号" maxlength="11" autocomplete="off">' +
        '</div>' +
        '<div class="dg-lock-note">默认使用实名认证信息，仅可补充下方备用手机号</div>' +
      '</div>';
    } else {
      h += '<div class="df-field">' +
        '<label class="df-label">联系人<span class="req">*</span><span class="df-tip">已自动填入认证账号信息，可修改</span></label>' +
        '<input class="df-control" id="dfContact" placeholder="认证账号姓名" maxlength="20" autocomplete="off">' +
      '</div>';
      h += '<div class="df-field">' +
        '<label class="df-label">联系电话<span class="req">*</span></label>' +
        '<input class="df-control" id="dfPhone" type="tel" placeholder="认证账号手机号" maxlength="11" autocomplete="off">' +
      '</div>';
    }
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

  /* ---------- 共享表单：认证信息回填（v2.0：锁定态无条件回填实名信息；可编辑态仅填空） ---------- */
  function prefillAuth(root) {
    var ac = authContact();
    var n = root.querySelector('#dfContact'); if (n && (n.readOnly || !n.value.trim())) n.value = ac.name;
    var p = root.querySelector('#dfPhone'); if (p && (p.readOnly || !p.value.trim())) p.value = ac.phone;
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
    /* v2.0：锁定态（实名认证信息只读）直接取认证姓名/电话；可编辑态（编辑页）走原输入校验 */
    var contactInput = root.querySelector('#dfContact');
    var phoneInput = root.querySelector('#dfPhone');
    var locked = !!(contactInput && contactInput.readOnly);
    var ac = authContact();
    var contact, phone;
    if (locked) {
      contact = ac.name || (contactInput ? contactInput.value.trim() : '');
      phone = ac.phone || (phoneInput ? phoneInput.value.trim() : '');
      if (!contact) { if (window.UI && UI.toast) UI.toast('实名认证缺少联系人，请先前往完善实名信息', 'warn'); return null; }
      if (!phone) { if (window.UI && UI.toast) UI.toast('实名认证缺少手机号，请先前往完善实名信息', 'warn'); return null; }
    } else {
      contact = inputVal(root, 'dfContact');
      if (!contact) { if (window.UI && UI.toast) UI.toast('请填写联系人', 'warn'); return null; }
      phone = inputVal(root, 'dfPhone');
      if (!phone) { if (window.UI && UI.toast) UI.toast('请填写联系电话', 'warn'); return null; }
      if (!/^1[3-9]\d{9}$/.test(phone)) { if (window.UI && UI.toast) UI.toast('请输入正确的 11 位手机号', 'warn'); return null; }
    }
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
        '<div style="font-size:11px;color:var(--text-3);margin-top:12px;">也可拨打热线 400-888-6688</div>' +
      '</div>'
    );
    s.show();
  }
  function openCallDialog() {
    UI.dialog({
      title: '联系客服',
      text: '客服热线：<b style="color:var(--primary);font-size:16px;">400-888-6688</b><br><br>工作时间：周一至周日 9:00 - 21:00',
      ok: '拨打',
      cancel: '取消',
      onOk: function () { UI.toast('正在拨打 400-888-6688', 'ok'); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     v2.0 委托服务 · 商业化与服务流程增强
     ────────────────────────────────────────────────────────────────
     · 实名门控：委托入口统一 gateRealname()，未实名 → 实名引导 bottom sheet
     · 认证信息锁定：表单联系人/电话只读取自实名认证，仅可补充备用手机号
     · 提交成功 → 对接信息页（顾问热线电话 + 企业微信二维码）
     · 付费渠道：提交委托后【模拟后台推送】「信息详情页解锁浏览」待付款订单；
       用户进入首页时弹窗提醒 → 收银台支付 → 支付成功解锁浏览顾问匹配信息
     全部"后台"行为均为纯前端 localStorage 模拟（无真实后端），
     真实接口实现见各函数内 [模拟] 占位注释，交付说明见 docs/委托服务-方案交付说明.html。
     ═══════════════════════════════════════════════════════════════ */
  var ORDER_KEY = 'engchain_delegate_orders';
  var UNLOCK_KEY = 'engchain_delegate_unlocks';
  var UNLOCK_AMOUNT = 29.9;              /* 演示定价：信息详情解锁浏览 ¥29.90 */
  var SERVICE_HOTLINE = '400-888-6688';
  var WECOM_LINK = 'https://work.weixin.qq.com/kf/0000-demo-delegate'; /* [模拟] 企业微信加好友链接占位 */

  /* ---------- 实名 / 游客判定（口径与 stores.js deriveIdentity 一致） ---------- */
  function realnameOk() {
    try {
      var a = (window.AuthStore && AuthStore.read) ? AuthStore.read() : {};
      return !!(a.realname && a.realname.ok);
    } catch (e) { return false; }
  }
  function guestState() {
    try { if (window.DataBus && typeof DataBus.isGuest === 'function') return !!DataBus.isGuest(); } catch (e) {}
    try {
      var st = window.UI ? UI.state.get() : {};
      return !!(st.loggedIn === false || st.status === 'guest');
    } catch (e) { return false; }
  }

  /* ---------- 实名认证引导（未实名 → bottom sheet） ---------- */
  function showRealnameGuide(opts) {
    var guest = guestState();
    var authHref = (opts && opts.authHref) || '../profile/auth-personal.html';
    var loginHref = (opts && opts.loginHref) || '../auth/login.html';
    var s = UI.sheet();
    s.setText('实名认证');
    s.setClosable(false);
    s.html(
      '<div class="dg-guide">' +
        '<div class="dg-guide-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 2.5v5.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V5.5L12 3z"/><path d="M9.3 12l2 2 3.4-3.6"/></svg></div>' +
        '<div class="dg-guide-title">委托服务仅面向实名用户</div>' +
        '<div class="dg-guide-desc">' + (guest
          ? '请先登录并完成实名认证，即可提交委托，享受平台专属顾问 1 对 1 服务。'
          : '完成实名认证后即可提交委托，平台将通过<b>电话联系</b>与<b>企业微信私聊</b>为您提供专属顾问服务。') + '</div>' +
        '<div class="dg-guide-note"><b>为什么需要实名？</b><br>核实您的真实身份，保护企业信息隐私，确保对接过程可追溯。</div>' +
        '<div class="dg-guide-btns">' +
          '<button type="button" class="btn btn-primary btn-block" style="height:46px;" onclick="location.href=\'' + (guest ? loginHref : authHref) + '\'">' + (guest ? '去登录' : '去实名认证') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-block" style="height:46px;margin-top:10px;" onclick="UI.closeSheet()">暂不</button>' +
        '</div>' +
        '<div class="dg-guide-foot">完成认证后返回本页，即可继续提交委托</div>' +
      '</div>'
    );
    s.show();
  }
  function gateRealname(opts) {
    if (realnameOk()) { if (opts && opts.onPass) opts.onPass(); return true; }
    showRealnameGuide(opts);
    return false;
  }

  /* ---------- 企业微信演示二维码（canvas 伪 QR，无外部依赖） ---------- */
  function paintDemoQr(canvas, seed) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var size = canvas.width || 120;
    var n = 25, cell = size / n;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    var h = 0; seed = String(seed == null ? 'delegate' : seed);
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    function rnd() { h = (h * 1103515245 + 12345) >>> 0; return h / 4294967296; }
    ctx.fillStyle = '#20232a';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var inFinder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
        if (inFinder) continue;
        if (rnd() > 0.52) ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      }
    }
    function finder(x, y) {
      ctx.fillStyle = '#20232a';
      ctx.fillRect(x * cell, y * cell, cell * 7, cell * 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x * cell + cell, y * cell + cell, cell * 5, cell * 5);
      ctx.fillStyle = '#20232a';
      ctx.fillRect(x * cell + cell * 2, y * cell + cell * 2, cell * 3, cell * 3);
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  }

  /* ---------- 提交成功 · 对接信息页（电话 + 企业微信） ---------- */
  function openHandoffSheet(rec) {
    var s = UI.sheet();
    s.setText('委托提交成功');
    s.html(
      '<div class="dg-handoff">' +
        '<div class="dg-handoff-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>' +
        '<div class="dg-handoff-title">委托已提交</div>' +
        '<div class="dg-handoff-desc">平台专属顾问将在 <b>2 小时内</b> 电话联系您，请保持电话畅通。<br>默认对接方式：<b>电话联系 + 企业微信私聊</b>，您也可主动联系我们：</div>' +
        '<div class="dg-handoff-card">' +
          '<div class="dg-handoff-card-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg></div>' +
          '<div class="dg-handoff-card-body">' +
            '<div class="dg-handoff-card-label">专属顾问热线</div>' +
            '<div class="dg-handoff-card-val">' + SERVICE_HOTLINE + '</div>' +
          '</div>' +
          '<button type="button" class="dg-handoff-btn" onclick="Delegates.dialService()">点击拨打</button>' +
        '</div>' +
        '<div class="dg-handoff-card dg-handoff-wecom">' +
          '<div class="dg-handoff-card-head">' +
            '<div class="dg-handoff-card-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.4-.25-3.4-.7L4 20l1-4.2A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 10.5h.01M12.5 10.5h.01M16.5 10.5h.01"/></svg></div>' +
            '<div class="dg-handoff-card-body">' +
              '<div class="dg-handoff-card-label">企业微信顾问</div>' +
              '<div class="dg-handoff-card-val">添加顾问好友 · 微信私聊对接</div>' +
            '</div>' +
          '</div>' +
          '<div class="dg-wecom-main">' +
            '<div class="dg-qr-box"><canvas id="dgWecomQr" width="120" height="120"></canvas><div class="dg-qr-tip">长按识别二维码添加好友</div></div>' +
            '<div class="dg-wecom-side">' +
              '<div class="dg-wecom-tip">扫码添加企业微信顾问，随时私聊沟通委托进展与匹配结果</div>' +
              '<button type="button" class="dg-handoff-btn" onclick="Delegates.addWecom()">添加企业微信好友</button>' +
              '<button type="button" class="dg-handoff-btn ghost" onclick="Delegates.copyWecomLink()">复制链接</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dg-handoff-note">如不便接听电话，请添加企业微信留言，顾问将优先处理。</div>' +
        '<button type="button" class="btn btn-primary btn-block" style="height:46px;" onclick="UI.closeSheet()">完成</button>' +
      '</div>'
    );
    s.show();
    var qr = document.getElementById('dgWecomQr');
    if (qr) paintDemoQr(qr, rec ? rec.id : 'delegate');
  }
  function dialService() { /* [模拟] 真实环境跳转系统拨号：location.href = 'tel:' + SERVICE_HOTLINE */ UI.toast('正在拨打 ' + SERVICE_HOTLINE, 'ok'); }
  function addWecom() { /* [模拟] 真实环境唤起企业微信加好友页（WECOM_LINK / 长按识别） */ UI.toast('已唤起企业微信添加好友（演示）', 'ok'); }
  function copyWecomLink() { /* [模拟] 真实环境为企业微信加好友链接，可复制分享 */ try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(WECOM_LINK); } catch (e) {} UI.toast('企业微信链接已复制', 'ok'); }

  /* ---------- 待付款订单（信息详情页解锁浏览）· 模拟后台推送 ---------- */
  function readOrders() { try { var a = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeOrders(list) { try { localStorage.setItem(ORDER_KEY, JSON.stringify(list)); } catch (e) {} }
  function readUnlocks() { try { var a = JSON.parse(localStorage.getItem(UNLOCK_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeUnlocks(list) { try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(list)); } catch (e) {} }

  function pushUnlockOrder(rec) {
    /* [模拟] 真实环境由后台在顾问承接/匹配完成后，向指定用户推送待付款订单：
       1) 后台生成「信息详情页解锁浏览」订单（type:'unlock-browse'）；
       2) 接口：POST /api/delegate/orders { delegateId, biz, bizLabel, amount, type }
       3) 前端进入首页时经 GET /api/orders/pending 拉取并弹窗提醒。
       纯前端演示：提交委托后本地写入订单，home.html 进入时检查弹窗。 */
    if (!rec || !rec.id) return null;
    var list = readOrders();
    var dup = list.some(function (o) { return o.delegateId === rec.id && o.status === 'pending'; });
    if (dup) return null;
    var order = {
      orderNo: 'UL' + Date.now().toString().slice(-10),
      delegateId: rec.id,
      biz: rec.biz || '',
      bizLabel: rec.bizLabel || '委托服务',
      type: 'unlock-browse',
      title: '委托信息详情 · 解锁浏览',
      desc: '顾问为您匹配的信息详情解锁浏览费用（含联系方式与完整资料）',
      amount: UNLOCK_AMOUNT,
      status: 'pending',
      createdAt: fmtNow(),
      paidAt: ''
    };
    list.unshift(order);
    writeOrders(list);
    return order;
  }
  function pendingOrders() { return readOrders().filter(function (o) { return o.status === 'pending'; }); }
  function getOrder(orderNo) {
    var list = readOrders();
    for (var i = 0; i < list.length; i++) if (list[i].orderNo === orderNo) return list[i];
    return null;
  }
  function markPaid(orderNo) {
    /* [模拟] 真实环境 → POST /api/orders/{id}/pay，支付网关回调确认后置 paid，并写入解锁权益 */
    var list = readOrders(), hit = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].orderNo === orderNo) {
        list[i].status = 'paid'; list[i].paidAt = fmtNow();
        hit = list[i]; break;
      }
    }
    writeOrders(list);
    if (hit) {
      var ul = readUnlocks();
      ul.unshift({ id: hit.orderNo, title: hit.title, biz: hit.biz, bizLabel: hit.bizLabel, amount: hit.amount, time: hit.paidAt });
      writeUnlocks(ul);
      try { window.dispatchEvent(new CustomEvent('engchain:delegate-order', { detail: hit })); } catch (e) {}
    }
    return hit;
  }

  /* ---------- 首页进入：待付款订单弹窗提醒 ---------- */
  var _remindShown = '';  /* 页面级标记：同一次进入仅提醒一次；刷新/重新进入（内存重置）仍会提醒 */
  function maybeShowOrderPopup() {
    if (!realnameOk()) return;           /* 仅实名用户享受委托服务与订单推送 */
    var pend = pendingOrders();
    if (!pend.length) return;
    var order = pend[0];
    if (_remindShown === order.orderNo) return;
    _remindShown = order.orderNo;
    showOrderRemind(order);
  }
  function showOrderRemind(order) {
    /* v2.1：升级为「用户待执行信息提醒」顶部下拉液态玻璃横幅（PendingAlerts 组件）；
       组件不可用时回退为原底部弹窗（UI.sheet），保证任何页面形态下提醒可用。 */
    if (window.PendingAlerts && typeof PendingAlerts.add === 'function') {
      var aid = 'pay-' + order.orderNo;
      PendingAlerts.add({
        id: aid,
        type: 'pay-order',
        icon: 'pay',
        title: '待付款订单',
        subtitle: order.title,
        desc: '该订单为委托服务 · 信息详情页解锁浏览费用，支付后即可查看顾问为您匹配的信息详情。',
        meta: order.bizLabel + ' · 订单号 ' + order.orderNo + ' · ' + order.createdAt,
        amount: '¥' + Number(order.amount).toFixed(2),
        primary: {
          label: '立即支付',
          onClick: function () { if (window.PendingAlerts) PendingAlerts.remove(aid); openCheckout(order); }
        },
        secondary: {
          label: '稍后再说',
          onClick: function () { if (window.PendingAlerts) PendingAlerts.remove(aid); }
        }
      });
      return;
    }
    var s = UI.sheet();
    s.setText('待付款订单');
    s.html(
      '<div class="dg-order">' +
        '<div class="dg-order-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 10h18"/><path d="M8 15h8"/></svg></div>' +
        '<div class="dg-order-title">您有 1 笔待付款订单</div>' +
        '<div class="dg-order-desc">该订单为委托服务 · 信息详情页解锁浏览费用，支付后即可查看顾问为您匹配的信息详情。</div>' +
        '<div class="dg-order-card">' +
          '<div class="dg-order-card-top"><span class="dl-biz">' + UI.esc(order.bizLabel) + '</span><span class="dg-order-type">解锁浏览</span></div>' +
          '<div class="dg-order-card-title">' + UI.esc(order.title) + '</div>' +
          '<div class="dg-order-card-meta">订单号 ' + UI.esc(order.orderNo) + ' · ' + UI.esc(order.createdAt) + '</div>' +
          '<div class="dg-order-card-foot"><span class="dg-order-amt">¥' + Number(order.amount).toFixed(2) + '</span></div>' +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-block" style="height:46px;" data-order-no="' + order.orderNo + '" onclick="Delegates.goPay(event)">立即支付</button>' +
        '<button type="button" class="btn btn-ghost btn-block" style="height:46px;" onclick="UI.closeSheet()">稍后再说</button>' +
        '<div class="dg-order-foot">支付后即可解锁浏览「委托信息详情」，查看顾问为您匹配的完整信息</div>' +
      '</div>'
    );
    s.show();
  }
  function goPay(ev) {
    var btn = ev && ev.currentTarget;
    var no = btn && btn.getAttribute('data-order-no');
    var o = getOrder(no); if (!o) return;
    UI.closeSheet();
    setTimeout(function () { openCheckout(o); }, 260);
  }

  /* ---------- 收银台（模拟支付） ---------- */
  function openCheckout(order) {
    var s = UI.sheet();
    s.setText('确认支付');
    s.html(
      '<div class="dg-pay">' +
        '<div class="dg-pay-goods">' +
          '<div class="dg-pay-goods-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg></div>' +
          '<div class="dg-pay-goods-body"><div class="dg-pay-goods-title">' + UI.esc(order.title) + '</div><div class="dg-pay-goods-desc">' + UI.esc(order.desc) + '</div></div>' +
          '<div class="dg-pay-amt">¥' + Number(order.amount).toFixed(2) + '</div>' +
        '</div>' +
        '<div class="dg-pay-row"><span class="dg-pay-row-label">订单号</span><span class="dg-pay-row-val">' + UI.esc(order.orderNo) + '</span></div>' +
        '<div class="dg-pay-row"><span class="dg-pay-row-label">服务来源</span><span class="dg-pay-row-val">' + UI.esc(order.bizLabel) + ' · 委托服务</span></div>' +
        '<div class="dg-pay-methods-label">支付方式</div>' +
        '<div class="dg-chips dg-pay-methods">' +
          '<button type="button" class="dg-chip active" data-val="微信支付">微信支付</button>' +
          '<button type="button" class="dg-chip" data-val="支付宝">支付宝</button>' +
          '<button type="button" class="dg-chip" data-val="银联">银联</button>' +
        '</div>' +
        '<div class="dg-pay-agree">支付即视为同意《委托服务协议》与《退款规则》</div>' +
        '<button type="button" class="btn btn-primary btn-block" style="height:48px;font-size:15px;font-weight:700;" data-order-no="' + order.orderNo + '" onclick="Delegates.confirmPay(event)">确认支付 ¥' + Number(order.amount).toFixed(2) + '</button>' +
        '<div class="dg-pay-foot">支付由平台资金托管保障 · 未对接成功可申请退款</div>' +
      '</div>'
    );
    s.show();
    var body = s.body();
    var m = body ? body.querySelector('.dg-pay-methods') : null;
    if (m) m.addEventListener('click', function (e) {
      var chip = e.target.closest('.dg-chip'); if (!chip) return;
      m.querySelectorAll('.dg-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
    });
  }
  function confirmPay(ev) {
    var btn = ev && ev.currentTarget;
    var no = btn && btn.getAttribute('data-order-no');
    var o = getOrder(no); if (!o) return;
    if (btn._paying) return;
    btn._paying = true;
    btn.textContent = '支付中…'; btn.style.opacity = '.7';
    /* [模拟] 真实环境调用收银台 SDK，支付网关异步回调后确认订单 */
    setTimeout(function () {
      markPaid(o.orderNo);
      btn._paying = false;
      var s = document.querySelector('.sheet.show');
      if (!s) return;
      var head = s.querySelector('.sheet-head .fs-17'); if (head) head.textContent = '支付成功';
      var body = s.querySelector('.sheet-body'); if (body) body.innerHTML = paySuccessHtml(o);
    }, 1000);
  }
  function paySuccessHtml(order) {
    return '<div class="dg-pay-ok">' +
      '<div class="dg-pay-ok-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '<div class="dg-pay-ok-title">支付成功 · 信息已解锁</div>' +
      '<div class="dg-pay-ok-desc">「' + UI.esc(order.title) + '」已解锁，顾问为您匹配的信息详情现已可见</div>' +
      '<button type="button" class="btn btn-primary btn-block" style="height:46px;" data-order-no="' + order.orderNo + '" onclick="Delegates.viewUnlock(event)">查看解锁信息</button>' +
      '<button type="button" class="btn btn-ghost btn-block" style="height:46px;" onclick="UI.closeSheet()">完成</button>' +
      '<div class="dg-pay-ok-foot">如需更多匹配信息，可在企业微信中继续与顾问沟通</div>' +
    '</div>';
  }
  function viewUnlock(ev) {
    var btn = ev && ev.currentTarget;
    var no = btn && btn.getAttribute('data-order-no');
    var o = getOrder(no); if (!o) return;
    UI.closeSheet();
    setTimeout(function () { openUnlockInfoSheet(o); }, 260);
  }

  /* ---------- 解锁信息详情（顾问匹配结果 · 信息详情页演示） ---------- */
  function openUnlockInfoSheet(order) {
    var s = UI.sheet();
    s.setText('解锁信息详情');
    s.html(
      '<div class="dg-unlock">' +
        '<div class="dg-unlock-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>已解锁</div>' +
        '<div class="dg-unlock-title">' + UI.esc(order.bizLabel || '委托服务') + ' · 顾问匹配信息</div>' +
        '<div class="dg-unlock-desc">以下为顾问为您筛选的信息详情，可点击电话直接对接。</div>' +
        '<div class="dg-unlock-list">' + unlockItemsHTML(order) + '</div>' +
        '<div class="dg-unlock-note">信息已解锁，可通过上方联系方式对接；如需更多信息，请在企业微信中联系顾问。</div>' +
        '<button type="button" class="btn btn-primary btn-block" style="height:46px;" onclick="UI.closeSheet()">完成</button>' +
      '</div>'
    );
    s.show();
  }
  function unlockItemsHTML(order) {
    /* [模拟] 真实环境 → GET /api/delegate/unlock-info?delegateId=xxx，返回顾问匹配结果（含联系方式） */
    var biz = order.biz || '';
    var items;
    if (biz === 'franchise') {
      items = [
        { name: '四川××建设工程有限公司', tags: ['建筑工程施工总承包 二级', '市政公用工程施工总承包 二级'], region: '四川省 · 成都', contact: '刘经理 138****2211' },
        { name: '成都××建筑劳务有限公司', tags: ['施工劳务资质', '安全生产许可证 有效'], region: '四川省 · 成都', contact: '王经理 139****3322' }
      ];
    } else if (biz === 'trade') {
      items = [
        { name: '成都××建筑工程有限公司 · 整体转让', tags: ['建筑工程施工总承包 二级', '含在建项目 2 个'], region: '四川省 · 成都', contact: '张总 137****8899', price: '报价 ¥128 万' },
        { name: '四川××市政工程有限公司 · 股权转让', tags: ['市政公用 二级', '无负债 账目干净'], region: '四川省 · 绵阳', contact: '李总 136****7788', price: '报价 ¥86 万' }
      ];
    } else if (biz === 'personnel') {
      items = [
        { name: '张敏', tags: ['一级建造师（建筑工程）', '注册安全工程师'], region: '四川省 · 成都 · 求职：工程项目经理', contact: '139****5678' },
        { name: '某大型施工企业 · 项目经理岗', tags: ['建筑工程总包 一级', '月薪 25-35K'], region: '四川省 · 成都', contact: 'HR 138****1234' }
      ];
    } else {
      items = [
        { name: '匹配信息一', tags: ['平台核验', '真实有效'], region: '四川省 · 成都', contact: '顾问 400-888-6688' },
        { name: '匹配信息二', tags: ['平台核验', '真实有效'], region: '全国', contact: '顾问 400-888-6688' }
      ];
    }
    return items.map(function (it) {
      return '<div class="dg-unlock-item">' +
        '<div class="dg-unlock-item-name">' + UI.esc(it.name) + (it.price ? '<span class="dg-unlock-item-price">' + UI.esc(it.price) + '</span>' : '') + '</div>' +
        '<div class="dg-unlock-item-tags">' + (it.tags || []).map(function (t) { return '<span>' + UI.esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="dg-unlock-item-meta"><span class="dg-unlock-item-region">' + UI.esc(it.region || '') + '</span>' +
        '<button type="button" class="dg-unlock-item-call" onclick="Delegates.dialContact(\'' + String(it.contact).replace(/'/g, '') + '\')">' + UI.esc(it.contact || '') + '</button></div>' +
      '</div>';
    }).join('');
  }
  function dialContact(phone) { /* [模拟] 真实环境 location.href = 'tel:' + phone */ UI.toast('正在拨打 ' + phone, 'ok'); }

  window.Delegates = {
    KEY: KEY, LEGACY_KEY: LEGACY_KEY, ORDER_KEY: ORDER_KEY, UNLOCK_KEY: UNLOCK_KEY,
    list: list, get: get, byBiz: byBiz, franchiseCurrent: franchiseCurrent,
    add: add, upsert: upsert, remove: remove, counts: counts,
    normStatus: normStatus, statusMeta: statusMeta,
    authContact: authContact,
    parseRegion: parseRegion, regionText: regionText,
    formHtml: formHtml, bindForm: bindForm, fillForm: fillForm,
    prefillAuth: prefillAuth, collectForm: collectForm,
    openServiceSheet: openServiceSheet, openCallDialog: openCallDialog,
    /* v2.0 商业化增强 */
    realnameOk: realnameOk, guestState: guestState, gateRealname: gateRealname,
    openHandoffSheet: openHandoffSheet, dialService: dialService,
    addWecom: addWecom, copyWecomLink: copyWecomLink,
    pushUnlockOrder: pushUnlockOrder, pendingOrders: pendingOrders,
    getOrder: getOrder, markPaid: markPaid,
    maybeShowOrderPopup: maybeShowOrderPopup, goPay: goPay,
    openCheckout: openCheckout, confirmPay: confirmPay,
    viewUnlock: viewUnlock, openUnlockInfoSheet: openUnlockInfoSheet,
    dialContact: dialContact,
    FORM_TEMPLATES: FORM_TEMPLATES
  };
})();
