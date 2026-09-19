/* ============================================================================
   HomepageEditor · 企业/个人主页内容编辑公共组件
   能力：
   - 主页内容持久化（localStorage 'engchain-homepage'）：{ [entityId]: { bio, tags } }
   - 轻量 Markdown 渲染器（标题/粗体/斜体/列表/引用/链接/代码/分割线）
   - 底部弹层编辑器：Markdown 工具栏 + 编辑/预览切换 + 标签 chips 输入
   - 展示端帮助：渲染 bio + 标签 + 「编辑主页」入口（仅所有者，?edit=1 可调试）
   依赖：UI.sheet（common.js）、window.UI
   ============================================================================ */
window.HomepageEditor = (function () {
  var KEY = 'engchain-homepage';

  /* ---- 持久化 ---- */
  function readAll() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function read(entityId) { return readAll()[entityId] || null; }
  function write(entityId, data) {
    var all = readAll();
    all[entityId] = data;
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }

  /* ---- 轻量 Markdown 渲染器（离线内联） ---- */
  function renderMarkdown(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var html = '';
    var i = 0;
    function inline(str) {
      str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      str = str.replace(/`([^`]+)`/g, '<code>$1</code>');
      str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return str;
    }
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^---+$/.test(line.trim())) { html += '<hr>'; i++; continue; }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { var lv = h[1].length; html += '<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'; i++; continue; }
      if (/^>\s?/.test(line)) {
        var q = '';
        while (i < lines.length && /^>\s?/.test(lines[i])) { q += (q ? ' ' : '') + lines[i].replace(/^>\s?/, ''); i++; }
        html += '<blockquote>' + inline(q) + '</blockquote>'; continue;
      }
      if (/^[-*]\s+/.test(line)) {
        html += '<ul>';
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) { html += '<li>' + inline(lines[i].replace(/^[-*]\s+/, '')) + '</li>'; i++; }
        html += '</ul>'; continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        html += '<ol>';
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { html += '<li>' + inline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>'; i++; }
        html += '</ol>'; continue;
      }
      var para = '';
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|[-*]\s|\d+\.\s|---+$)/.test(lines[i])) { para += (para ? ' ' : '') + lines[i]; i++; }
      html += '<p>' + inline(para) + '</p>';
    }
    return html;
  }

  /* ---- 标签渲染 ---- */
  function renderTags(tags) {
    tags = tags || [];
    if (!tags.length) return '';
    return '<div class="he-tags">' + tags.map(function (t) {
      return '<span class="he-tag">' + (typeof t === 'string' ? t : (t.t || t)) + '</span>';
    }).join('') + '</div>';
  }

  /* ---- 展示端：渲染 bio + 标签 + 编辑入口 ---- */
  function render(entityId, opts) {
    opts = opts || {};
    var data = read(entityId) || {};
    var bio = data.bio || opts.defaultBio || '';
    var tags = data.tags || opts.defaultTags || [];
    var canEdit = (opts.forceEdit) || (window.UI && UI.isOwner && UI.isOwner(entityId)) ||
      (opts.alwaysEdit) || /[?&]edit=1/.test(location.search);
    var html = '';
    if (opts.label) {
      html += '<div class="he-head">' +
        '<div class="he-title">' + (opts.icon || '') + opts.label + '</div>' +
        (canEdit ? '<button class="he-edit-btn" data-he-edit="' + entityId + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>编辑</button>' : '') +
      '</div>';
    }
    html += '<div class="md-content he-bio">' + (renderMarkdown(bio) || '<div class="he-empty">暂无内容' + (canEdit ? '，点击右上角「编辑」开始创作' : '') + '</div>') + '</div>';
    html += renderTags(tags);
    return html;
  }

  /* 页面级事件委托：编辑按钮 + 标签（由页面在 DOMContentLoaded 后调用一次） */
  function bind() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-he-edit]');
      if (btn) { open(btn.getAttribute('data-he-edit'), { forceEdit: true }); return; }
    });
  }

  /* ---- 编辑器：底部弹层 ---- */
  var mdStyle = null;
  function ensureStyle() {
    if (mdStyle) return;
    mdStyle = document.createElement('style');
    mdStyle.textContent = [
      '.he-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}',
      '.he-title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--text-1);}',
      '.he-title svg{width:14px;height:14px;color:var(--primary);}',
      '.he-edit-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border:1px solid var(--line);border-radius:var(--r-full);background:var(--bg-card);color:var(--text-2);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s ease;}',
      '.he-edit-btn svg{width:13px;height:13px;}',
      '.he-edit-btn:active{transform:scale(.95);}',
      '.he-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;}',
      '.he-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 11px;border-radius:var(--r-full);background:var(--primary-soft);color:var(--primary-dim);font-size:11px;font-weight:600;}',
      '.he-bio{margin-bottom:2px;}',
      '.he-empty{padding:20px 0;text-align:center;font-size:12px;color:var(--text-4);}',
      '/* 编辑器 */',
      '.he-ed-tabs{display:flex;gap:6px;margin-bottom:10px;}',
      '.he-ed-tab{padding:5px 16px;border-radius:var(--r-full);font-size:12px;font-weight:600;color:var(--text-3);background:var(--bg-card-2);border:1px solid transparent;cursor:pointer;transition:all .15s ease;}',
      '.he-ed-tab.on{background:var(--primary-soft);color:var(--primary-dim);border-color:var(--accent-line);}',
      '.he-ed-toolbar{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;}',
      '.he-ed-tb{min-width:34px;height:30px;padding:0 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg-card);color:var(--text-2);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s ease;}',
      '.he-ed-tb:active{transform:scale(.93);background:var(--primary-soft);color:var(--primary-dim);}',
      '.he-ed-area{width:100%;min-height:150px;max-height:280px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);font-size:13px;line-height:1.7;color:var(--text-1);outline:none;resize:vertical;font-family:inherit;box-sizing:border-box;}',
      '.he-ed-area:focus{border-color:var(--primary);box-shadow:var(--shadow-focus);}',
      '.he-ed-preview{min-height:150px;padding:4px 2px;}',
      '/* 标签输入 */',
      '.he-tag-input{display:flex;flex-wrap:wrap;gap:5px;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--bg);min-height:42px;align-items:center;transition:border-color .2s,box-shadow .2s;}',
      '.he-tag-input:focus-within{border-color:var(--primary);box-shadow:var(--shadow-focus);}',
      '.he-tag-input .he-ti-item{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--primary-soft);color:var(--primary-dim);border-radius:8px;font-size:11px;font-weight:500;}',
      '.he-tag-input .he-ti-item .x{width:18px;height:18px;min-width:18px;border-radius:50%;background:rgba(43,107,79,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;line-height:1;}',
      '.he-tag-input .he-ti-input{flex:1;min-width:80px;border:none;outline:none;background:transparent;font-size:12px;color:var(--text-1);padding:2px 0;}',
      '.he-tag-input .he-ti-input::placeholder{color:var(--text-4);}',
      '.he-ed-tip{font-size:10.5px;color:var(--text-4);margin-top:6px;line-height:1.6;}'
    ].join('\n');
    document.head.appendChild(mdStyle);
  }

  function open(entityId, opts) {
    opts = opts || {};
    ensureStyle();
    if (!window.UI || !UI.sheet) { return; }
    var data = read(entityId) || {};
    var bio = data.bio || opts.defaultBio || '';
    var tags = data.tags || opts.defaultTags || [];
    var sh = UI.sheet();
    sh.setText(opts.title || '编辑主页内容');
    var _curMode = 'edit';
    var _ta = null;
    var _pre = null;
    var _tagWrap = null;
    var _tagInput = null;

    /* Markdown 工具栏动作：在光标处插入语法 */
    var TOOLS = [
      { label: 'H2', ins: '## ' },
      { label: 'H3', ins: '### ' },
      { label: 'B', ins: ['**', '**'] },
      { label: 'I', ins: ['*', '*'] },
      { label: '·', ins: '- ' },
      { label: '1.', ins: '1. ' },
      { label: '❝', ins: '> ' },
      { label: '🔗', ins: ['[文字](https://)', ''] },
      { label: '`', ins: ['`', '`'] },
      { label: '—', ins: '\n---\n' }
    ];

    function build() {
      sh.html(
        '<div style="padding:2px 4px 14px;">' +
          '<div class="he-ed-tabs">' +
            '<button class="he-ed-tab on" data-he-tab="edit">✏️ 编辑</button>' +
            '<button class="he-ed-tab" data-he-tab="preview">👁 预览</button>' +
          '</div>' +
          '<div class="he-ed-toolbar">' + TOOLS.map(function (t, i) {
            return '<button class="he-ed-tb" data-he-tool="' + i + '">' + t.label + '</button>';
          }).join('') + '</div>' +
          '<textarea class="he-ed-area" id="he-ta" placeholder="支持 Markdown：## 标题、**加粗**、- 列表、> 引用、[链接](https://)、`代码`…">' + bio.replace(/</g, '&lt;') + '</textarea>' +
          '<div class="he-ed-preview" id="he-preview" style="display:none;"></div>' +
          '<div class="fs-11 fw-600" style="color:var(--text-3);margin:14px 0 8px;">标签（回车添加，最多 8 个）</div>' +
          '<div class="he-tag-input" id="he-tags"></div>' +
          '<div class="he-ed-tip">内容将公开显示在主页 · 支持 Markdown 富文本格式</div>' +
          '<button class="btn btn-primary btn-block btn-lg" id="he-save" style="margin-top:14px;">保存主页内容</button>' +
        '</div>'
      );
      _ta = sh.body().querySelector('#he-ta');
      _pre = sh.body().querySelector('#he-preview');
      _tagWrap = sh.body().querySelector('#he-tags');

      /* 标签 chips 渲染 */
      function renderTagChips() {
        _tagWrap.innerHTML = tags.map(function (t, i) {
          return '<span class="he-ti-item">' + (typeof t === 'string' ? t : (t.t || t)) + '<span class="x" data-he-tagx="' + i + '">×</span></span>';
        }).join('') + '<input class="he-ti-input" id="he-tag-input" placeholder="输入标签后回车" maxlength="8">';
        _tagInput = _tagWrap.querySelector('#he-tag-input');
        _tagInput.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ',') {
            ev.preventDefault();
            var v = _tagInput.value.trim();
            if (v && tags.length < 8) { tags.push(v); renderTagChips(); }
            _tagInput.focus();
          } else if (ev.key === 'Backspace' && !_tagInput.value && tags.length) {
            tags.pop(); renderTagChips(); _tagInput.focus();
          }
        });
      }
      renderTagChips();
      _tagWrap.addEventListener('click', function (e) {
        var x = e.target.closest && e.target.closest('[data-he-tagx]');
        if (x) { tags.splice(+x.getAttribute('data-he-tagx'), 1); renderTagChips(); }
      });

      /* 工具栏插入 */
      sh.body().querySelectorAll('[data-he-tool]').forEach(function (b) {
        b.addEventListener('click', function () {
          var tool = TOOLS[+b.getAttribute('data-he-tool')];
          var s = _ta.selectionStart || _ta.value.length;
          var e = _ta.selectionEnd || s;
          var val = _ta.value;
          var before = val.slice(0, s), after = val.slice(e);
          if (Array.isArray(tool.ins)) {
            var sel = val.slice(s, e) || tool.ins[1];
            _ta.value = before + tool.ins[0] + sel + tool.ins[1] + after;
            _ta.focus();
            _ta.selectionStart = s + tool.ins[0].length + sel.length;
            _ta.selectionEnd = _ta.selectionStart;
          } else {
            _ta.value = before + tool.ins + after;
            _ta.focus();
            _ta.selectionStart = _ta.selectionEnd = s + tool.ins.length;
          }
          refreshPreview();
        });
      });

      /* Tab 切换 */
      sh.body().querySelectorAll('[data-he-tab]').forEach(function (t) {
        t.addEventListener('click', function () {
          _curMode = t.getAttribute('data-he-tab');
          sh.body().querySelectorAll('[data-he-tab]').forEach(function (x) { x.classList.toggle('on', x === t); });
          _ta.style.display = _curMode === 'edit' ? '' : 'none';
          _pre.style.display = _curMode === 'preview' ? '' : 'none';
          refreshPreview();
        });
      });
      _ta.addEventListener('input', refreshPreview);

      function refreshPreview() {
        _pre.innerHTML = renderMarkdown(_ta.value) || '<div class="he-empty">输入内容后即可预览效果</div>';
      }

      /* 保存 */
      sh.body().querySelector('#he-save').addEventListener('click', function () {
        var bio2 = _ta.value;
        if (!bio2.trim() && !tags.length) { UI.toast('内容为空，未保存', 'warn'); return; }
        write(entityId, { bio: bio2, tags: tags.slice() });
        sh.close();
        UI.toast('主页内容已保存', 'ok');
        var evt = new CustomEvent('engchain:homepage', { detail: { id: entityId } });
        window.dispatchEvent(evt);
      });
    }
    build();
    sh.show();
  }

  return { read: read, write: write, renderMarkdown: renderMarkdown, renderTags: renderTags, render: render, bind: bind, open: open };
})();
