/* ============================================================
 * ChatSheet v1.0 — 半屏聊天弹窗组件
 * 自下向上展开，高度上限为视口 80vh；上滑触发展开（仍不超 80vh），下拉收起
 * 用法：ChatSheet.open({ name, role, cert, convId, ctx })
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 注入样式 ---------- */
  var CSS = `
  /* ═══ ChatSheet 半屏聊天弹窗 ═══ */
  .cs-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s ease;}
  .cs-mask.show{opacity:1;visibility:visible;}
  .cs-sheet{
    position:fixed;left:0;right:0;bottom:0;z-index:901;
    background:var(--bg,#f5f3ef);
    border-radius:20px 20px 0 0;
    box-shadow:0 -8px 40px rgba(0,0,0,.2);
    display:flex;flex-direction:column;
    height:80vh;max-height:80vh;
    transform:translateY(105%);
    transition:transform .38s cubic-bezier(.22,1,.36,1);
    overflow:hidden;
  }
  .cs-sheet.show{transform:translateY(0);}
  .cs-sheet.dragging{transition:none;}
  .cs-sheet.full{height:80vh;max-height:80vh;border-radius:20px 20px 0 0;}

  /* 顶部拖拽手柄区 */
  .cs-handle{flex:none;padding:6px 16px 0;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;}
  .cs-handle:active{cursor:grabbing;}
  .cs-handle-bar{width:42px;height:4px;border-radius:2px;background:var(--text-3,#ccc);margin:0 auto 6px;opacity:.6;}
  .cs-sheet:not(.full) .cs-handle-bar{margin-bottom:2px;}

  /* 导航栏 */
  .cs-nav{flex:none;display:flex;align-items:center;gap:8px;padding:4px 12px 10px;border-bottom:1px solid var(--line,#e5e0d8);cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;}
  .cs-nav:active{cursor:grabbing;}
  .cs-nav-back{width:34px;height:34px;border-radius:50%;border:none;background:var(--bg-card-2,#eee);color:var(--text-2,#666);font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;}
  .cs-nav-back:active{transform:scale(.92);}
  .cs-nav-title{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;line-height:1.25;}
  .cs-nav-name{display:flex;align-items:center;gap:5px;font-size:15px;font-weight:700;color:var(--text-1,#222);}
  .cs-cert-mini{display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:999px;background:var(--primary-soft,rgba(201,169,97,.12));color:var(--primary-dim,#b89968);font-size:9px;font-weight:600;}
  .cs-cert-mini svg{width:9px;height:9px;}
  .cs-nav-role{font-size:10px;color:var(--text-3,#999);font-weight:400;margin-top:1px;}
  .cs-nav-more{width:34px;height:34px;border-radius:50%;border:none;background:transparent;color:var(--text-2,#666);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;}
  .cs-nav-more svg{width:18px;height:18px;}

  /* 上下文条 */
  .cs-ctx{flex:none;margin:8px 16px 0;padding:9px 11px;border-radius:12px;background:var(--bg-card,#fff);border:1px solid var(--line,#e5e0d8);display:flex;align-items:center;gap:9px;cursor:pointer;}
  .cs-ctx:active{background:var(--bg-card-2,#f5f5f5);}
  .cs-ctx-ic{flex:none;width:30px;height:30px;border-radius:9px;background:var(--primary-soft,rgba(201,169,97,.12));display:flex;align-items:center;justify-content:center;color:var(--primary-dim,#b89968);}
  .cs-ctx-ic svg{width:15px;height:15px;}
  .cs-ctx-body{flex:1;min-width:0;}
  .cs-ctx-title{font-size:11.5px;font-weight:700;color:var(--text-1,#222);}
  .cs-ctx-sub{font-size:10px;color:var(--text-3,#999);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .cs-ctx-go{flex:none;color:var(--text-3,#999);}
  .cs-ctx-go svg{width:13px;height:13px;}

  /* 消息滚动区 */
  .cs-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:0;}
  .cs-timeline{display:flex;flex-direction:column;gap:14px;padding:12px 16px 18px;}
  .cs-day{display:flex;justify-content:center;}
  .cs-day span{padding:4px 12px;border-radius:999px;background:rgba(120,120,120,.08);color:var(--text-3,#999);font-size:10px;}

  /* 气泡 */
  .cs-row{display:flex;gap:8px;align-items:flex-start;max-width:100%;}
  .cs-row.mine{flex-direction:row-reverse;}
  .cs-avatar{flex:none;width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#8a7a5c,#6b5d44);}
  .cs-row.mine .cs-avatar{background:linear-gradient(135deg,#c9a961,#a8884a);color:#fff;}
  .cs-body{max-width:76%;display:flex;flex-direction:column;}
  .cs-row.mine .cs-body{align-items:flex-end;}
  .cs-bubble{padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.55;word-break:break-word;}
  .cs-bubble.text{background:var(--bg-card-2,#f0eee9);color:var(--text-1,#222);border-bottom-left-radius:4px;}
  .cs-row.mine .cs-bubble.text{background:var(--primary,#c9a961);color:#fff;border-bottom-right-radius:4px;}
  .cs-meta{font-size:9.5px;color:var(--text-3,#999);margin-top:4px;}

  /* 系统提示 */
  .cs-sys{display:flex;justify-content:center;}
  .cs-sys span{display:inline-flex;padding:4px 12px;border-radius:999px;background:var(--primary-soft,rgba(201,169,97,.12));color:var(--primary-dim,#b89968);font-size:10px;}

  /* 卡片消息 */
  .cs-card{width:min(260px,78%);background:var(--bg-card,#fff);border:1px solid var(--line,#e5e0d8);border-radius:14px;overflow:hidden;}
  .cs-card-head{display:flex;align-items:center;gap:8px;padding:10px 12px 0;}
  .cs-card-ic{flex:none;width:28px;height:28px;border-radius:8px;background:var(--primary-soft,rgba(201,169,97,.12));display:flex;align-items:center;justify-content:center;color:var(--primary-dim,#b89968);}
  .cs-card-ic svg{width:14px;height:14px;}
  .cs-card-title{font-size:12px;font-weight:700;color:var(--text-1,#222);line-height:1.3;}
  .cs-card-sub{font-size:9px;color:var(--text-3,#999);margin-top:1px;}
  .cs-card-desc{padding:7px 12px 0;font-size:11px;color:var(--text-2,#555);line-height:1.5;}
  .cs-card-fields{margin:7px 12px 0;border-top:1px dashed var(--line,#e5e0d8);padding-top:7px;display:flex;flex-direction:column;gap:4px;}
  .cs-field{display:flex;align-items:baseline;gap:8px;font-size:10.5px;}
  .cs-field b{flex:none;width:50px;color:var(--text-3,#999);font-weight:500;font-size:10px;}
  .cs-field span{flex:1;color:var(--text-1,#222);font-weight:600;}
  .cs-card-actions{display:flex;gap:8px;padding:10px 12px 11px;}
  .cs-card-btn{flex:1;height:30px;border-radius:9px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;}
  .cs-card-btn.primary{background:linear-gradient(135deg,#c9a961,#a8884a);color:#fff;}
  .cs-card-btn.ghost{background:var(--bg-card-2,#f0eee9);color:var(--text-2,#666);}
  .cs-card-btn:active{transform:scale(.96);}

  /* 输入区 */
  .cs-input{flex:none;position:relative;z-index:2;padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px));background:var(--bg,#f5f3ef);border-top:1px solid var(--line,#e5e0d8);}
  .cs-quick{display:flex;align-items:center;gap:6px;padding:0 0 8px;overflow-x:auto;scrollbar-width:none;}
  .cs-quick::-webkit-scrollbar{display:none;}
  .cs-quick-label{flex:none;font-size:10px;font-weight:600;color:var(--primary-dim,#b89968);}
  .cs-quick-chip{flex:none;padding:5px 10px;border-radius:999px;background:var(--bg-card,#fff);border:1px solid var(--line,#e5e0d8);font-size:11px;color:var(--text-2,#555);white-space:nowrap;cursor:pointer;}
  .cs-quick-chip:active{background:var(--primary-soft,rgba(201,169,97,.12));}
  .cs-composer{display:flex;align-items:flex-end;gap:8px;}
  .cs-attach{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-2,#666);background:var(--bg-card,#fff);border:1px solid var(--line,#e5e0d8);cursor:pointer;}
  .cs-attach svg{width:17px;height:17px;}
  .cs-attach.open{background:var(--primary-soft,rgba(201,169,97,.12));color:var(--primary-dim,#b89968);}
  .cs-field{flex:1;display:flex;align-items:center;gap:6px;background:var(--bg-card,#fff);border:1px solid var(--line,#e5e0d8);border-radius:19px;padding:3px 3px 3px 14px;}
  .cs-field input{flex:1;height:30px;border:0;outline:0;background:transparent;font-size:14px;color:var(--text-1,#222);min-width:0;}
  .cs-send{flex:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#c9a961,#a8884a);color:#fff;cursor:pointer;border:none;}
  .cs-send svg{width:15px;height:15px;}
  .cs-send.disabled{opacity:.4;pointer-events:none;}

  /* 扩展面板 */
  .cs-panel{display:none;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 4px 4px;border-top:1px solid var(--line,#e5e0d8);margin-top:8px;}
  .cs-panel.show{display:grid;}
  .cs-panel-item{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0;cursor:pointer;}
  .cs-panel-item .p-ic{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;}
  .cs-panel-item .p-ic svg{width:18px;height:18px;}
  .cs-panel-item span{font-size:9px;color:var(--text-2,#555);}
  .cs-tint-a{background:var(--primary-soft,rgba(201,169,97,.12));color:var(--primary-dim,#b89968);}
  .cs-tint-b{background:rgba(46,102,255,.1);color:#2e66ff;}
  .cs-tint-c{background:rgba(139,123,181,.13);color:#8B7BB5;}
  .cs-tint-d{background:rgba(217,119,6,.1);color:#d97706;}
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ---------- 2. 构建 DOM ---------- */
  var mask = document.createElement('div');
  mask.className = 'cs-mask';
  document.body.appendChild(mask);

  var sheet = document.createElement('div');
  sheet.className = 'cs-sheet';
  sheet.innerHTML = `
    <div class="cs-handle" id="cs-handle">
      <div class="cs-handle-bar"></div>
    </div>
    <div class="cs-nav" id="cs-nav">
      <button class="cs-nav-back" id="cs-back" aria-label="关闭">‹</button>
      <div class="cs-nav-title">
        <span class="cs-nav-name" id="cs-name">对方
          <span class="cs-cert-mini" id="cs-cert"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span id="cs-cert-text">平台认证</span></span>
        </span>
        <div class="cs-nav-role" id="cs-role">—</div>
      </div>
      <button class="cs-nav-more" id="cs-more" aria-label="更多">
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
      </button>
    </div>
    <div class="cs-ctx" id="cs-ctx" style="display:none;">
      <div class="cs-ctx-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
      <div class="cs-ctx-body">
        <div class="cs-ctx-title" id="cs-ctx-title">正在对接</div>
        <div class="cs-ctx-sub" id="cs-ctx-sub">—</div>
      </div>
      <div class="cs-ctx-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
    </div>
    <div class="cs-scroll" id="cs-scroll">
      <div class="cs-timeline" id="cs-timeline"></div>
    </div>
    <div class="cs-input">
      <div class="cs-quick" id="cs-quick"></div>
      <div class="cs-composer">
        <button type="button" class="cs-attach" id="cs-attach" aria-label="更多"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
        <div class="cs-field">
          <input id="cs-msg" placeholder="输入消息…" maxlength="500">
          <button type="button" class="cs-send disabled" id="cs-send" aria-label="发送"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>
      </div>
      <div class="cs-panel" id="cs-panel">
        <div class="cs-panel-item" data-kind="contact"><div class="p-ic cs-tint-a"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><span>发名片</span></div>
        <div class="cs-panel-item" data-kind="quote"><div class="p-ic cs-tint-b"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div><span>发报价</span></div>
        <div class="cs-panel-item" data-kind="appoint"><div class="p-ic cs-tint-c"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div><span>约对接</span></div>
        <div class="cs-panel-item" data-kind="file"><div class="p-ic cs-tint-d"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div><span>发文件</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(sheet);

  /* ---------- 3. DOM 引用 ---------- */
  var $ = function (id) { return sheet.querySelector('#' + id); };
  var elName = $('cs-name'), elCertText = $('cs-cert-text'), elRole = $('cs-role');
  var elCtx = $('cs-ctx'), elCtxTitle = $('cs-ctx-title'), elCtxSub = $('cs-ctx-sub');
  var elTimeline = $('cs-timeline'), elScroll = $('cs-scroll');
  var elQuick = $('cs-quick'), elPanel = $('cs-panel'), elAttach = $('cs-attach');
  var elInput = $('cs-msg'), elSend = $('cs-send');

  /* ---------- 4. 模拟聊天数据 ---------- */
  var MOCK_MSGS = [
    { me: false, type: 'text', text: '您好，收到您的咨询，很高兴为您服务！', t: '刚刚' },
    { me: false, type: 'text', text: '请问您想了解哪方面的合作？我可以为您详细介绍。', t: '刚刚' }
  ];
  var MOCK_QUICK = ['您好，想了解合作', '请问资质等级是？', '可以发一份资料吗？', '约个时间细聊'];

  var messages = [];
  var currentConv = { name: '对方', role: '', cert: '平台认证' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- 5. 渲染 ---------- */
  function render() {
    var html = '';
    messages.forEach(function (m) {
      if (m.type === 'system') {
        html += '<div class="cs-sys"><span>' + esc(m.text) + '</span></div>';
        return;
      }
      var cls = m.me ? 'cs-row mine' : 'cs-row';
      var bubble;
      if (m.type === 'card') {
        var c = m.card || {};
        var fields = (c.fields || []).map(function (f) {
          return '<div class="cs-field"><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>';
        }).join('');
        bubble = '<div class="cs-card">' +
          '<div class="cs-card-head"><div class="cs-card-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
          '<div><div class="cs-card-title">' + esc(c.title) + '</div><div class="cs-card-sub">' + esc(c.sub || '') + '</div></div></div>' +
          '<div class="cs-card-desc">' + esc(c.desc || '') + '</div>' +
          '<div class="cs-card-fields">' + fields + '</div>' +
        '</div>';
      } else {
        bubble = '<div class="cs-bubble text">' + esc(m.text) + '</div>';
      }
      var avatar = '<div class="cs-avatar">' + (m.me ? '我' : esc((currentConv.name || '?').slice(0, 1))) + '</div>';
      var meta = '<div class="cs-meta">' + esc(m.t || '') + '</div>';
      html += '<div class="' + cls + '">' + avatar + '<div class="cs-body">' + bubble + meta + '</div></div>';
    });
    elTimeline.innerHTML = html;
    elScroll.scrollTop = elScroll.scrollHeight;
  }

  /* ---------- 6. 发送消息 ---------- */
  function nowTime() {
    var d = new Date();
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function doSend(text) {
    var v = (text || elInput.value).trim();
    if (!v) return;
    messages.push({ me: true, type: 'text', text: v, t: nowTime() });
    elInput.value = '';
    elSend.classList.add('disabled');
    render();
    /* 模拟自动回复 */
    setTimeout(function () {
      var replies = [
        '收到，我这边核实一下尽快回复您。',
        '好的，相关信息已同步给业务负责人。',
        '了解，稍后给您详细答复。',
        '感谢咨询，资料整理后发您。'
      ];
      messages.push({ me: false, type: 'text', text: replies[Math.floor(Math.random() * replies.length)], t: nowTime() });
      render();
    }, 1000);
  }

  elInput.addEventListener('input', function () {
    elSend.classList.toggle('disabled', !this.value.trim());
  });
  elInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSend();
  });
  elSend.addEventListener('click', function () { doSend(); });

  /* 快捷回复 */
  elQuick.addEventListener('click', function (e) {
    var chip = e.target.closest('.cs-quick-chip');
    if (chip) doSend(chip.textContent);
  });

  /* 扩展面板 */
  elAttach.addEventListener('click', function () {
    elPanel.classList.toggle('show');
    elAttach.classList.toggle('open');
  });
  elPanel.addEventListener('click', function (e) {
    var item = e.target.closest('.cs-panel-item');
    if (!item) return;
    var kind = item.dataset.kind;
    elPanel.classList.remove('show');
    elAttach.classList.remove('open');
    if (kind === 'file') {
      if (window.UI) UI.toast('演示环境暂不支持上传文件', 'info');
      return;
    }
    var cardData = {
      contact: { title: '我的企业名片', sub: '个人认证 · 供方', desc: '欢迎交流合作。', fields: [['资质', '总承包一级'], ['区域', '四川/重庆']] },
      quote: { title: '报价单', sub: '供方 → 需方', desc: '详细报价请见。', fields: [['单价', '面议'], ['账期', '月结']] },
      appoint: { title: '预约现场对接', sub: '双方确认', desc: '建议时间。', fields: [['时间', '今天 14:00'], ['地点', '项目现场']] }
    };
    messages.push({ me: true, type: 'card', t: nowTime(), card: cardData[kind] });
    render();
    setTimeout(function () {
      messages.push({ me: false, type: 'text', text: '收到，稍后回复您。', t: nowTime() });
      render();
    }, 1000);
  });

  /* ---------- 7. 拖拽手势（半屏/全屏切换） ---------- */
  var isFull = false;
  var dragStartY = 0;
  var dragCurrentY = 0;
  var dragging = false;
  var VIEW_H = window.innerHeight;

  var handleZone = sheet.querySelector('#cs-handle');
  var navZone = sheet.querySelector('#cs-nav');

  function onTouchStart(e) {
    var touch = e.touches[0];
    dragStartY = touch.clientY;
    dragCurrentY = touch.clientY;
    dragging = true;
    sheet.classList.add('dragging');
  }
  function onTouchMove(e) {
    if (!dragging) return;
    var touch = e.touches[0];
    dragCurrentY = touch.clientY;
    var dy = dragCurrentY - dragStartY; /* 正=向下拖，负=向上拖 */
    if (isFull) {
      /* 全屏状态：不响应向下拖动（保持全屏），但允许正常滚动消息区 */
      return;
    }
    /* 半屏状态：
       - 向上拖（dy<0）：临时上移，但最多到全屏位置
       - 向下拖（dy>0）：临时下移
    */
    var halfOffset = VIEW_H * 0.2; /* 半屏时底部留白 20vh */
    var targetTranslate = 0; /* 0 = 完全显示 */
    if (dy > 0) {
      /* 向下拖：从半屏位置向下移动 dy */
      targetTranslate = dy;
    } else {
      /* 向上拖：半屏位置已经是 0（显示80%），不能再向上移动了
         因为全屏就是 translateY(0) + height:100vh
         所以向上拖只触发"是否全屏"判断，不临时移动
      */
      targetTranslate = 0;
    }
    sheet.style.transform = 'translateY(' + Math.max(0, targetTranslate) + 'px)';
  }
  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';

    var dy = dragCurrentY - dragStartY;
    if (isFull) return; /* 全屏状态不处理 */

    /* 半屏状态下判断：
       - 向上拖动超过屏幕高度 12% → 全屏
       - 向下拖动超过屏幕高度 12% → 关闭
    */
    var threshold = VIEW_H * 0.12;
    if (dy < -threshold) {
      /* 向上 → 全屏 */
      setFull(true);
    } else if (dy > threshold) {
      /* 向下 → 关闭 */
      close();
    }
  }

  handleZone.addEventListener('touchstart', onTouchStart, { passive: true });
  navZone.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);

  function setFull(full) {
    isFull = full;
    sheet.classList.toggle('full', full);
  }

  /* ---------- 8. 打开/关闭 ---------- */
  function open(options) {
    options = options || {};
    currentConv = {
      name: options.name || '对方',
      role: options.role || '',
      cert: options.cert || '平台认证'
    };
    elName.firstChild.textContent = currentConv.name + ' ';
    elCertText.textContent = currentConv.cert;
    elRole.textContent = currentConv.role || '—';

    /* 上下文条 */
    if (options.ctx) {
      elCtx.style.display = '';
      elCtxTitle.textContent = options.ctx.title || '正在对接';
      elCtxSub.textContent = options.ctx.sub || '—';
    } else {
      elCtx.style.display = 'none';
    }

    /* 重置状态 */
    setFull(false);
    messages = (MOCK_MSGS || []).slice();
    elQuick.innerHTML = '<span class="cs-quick-label">快捷</span>' +
      MOCK_QUICK.map(function (q) { return '<span class="cs-quick-chip">' + esc(q) + '</span>'; }).join('');

    render();

    /* 显示 */
    document.body.style.overflow = 'hidden';
    mask.classList.add('show');
    sheet.classList.add('show');
  }

  function close() {
    mask.classList.remove('show');
    sheet.classList.remove('show');
    document.body.style.overflow = '';
    setFull(false);
  }

  /* 关闭按钮 & 遮罩点击 */
  sheet.querySelector('#cs-back').addEventListener('click', close);
  mask.addEventListener('click', close);
  sheet.querySelector('#cs-more').addEventListener('click', function () {
    if (window.UI && UI.toast) UI.toast('更多操作（演示）', 'info');
  });

  /* ---------- 9. 暴露 API ---------- */
  window.ChatSheet = {
    open: open,
    close: close,
    isFull: function () { return isFull; }
  };
})();

