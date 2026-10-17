/* ================================================================
 * pickx.js — 自绘「子类 / 品名」下拉组件库（editor / search 共用）
 *
 * 背景：详细类提交页原有「子类」为浏览器原生 <select>、「品名」为 <datalist>，
 *       外观与交互无法定制，且与页面自绘组件割裂。本组件库提供两套自绘控件：
 *   - PickX.Select：受控选择下拉（子类）——搜索过滤（>searchThreshold 才显示搜索框）、
 *     键盘导航、选中打勾、空态引导、申请新增入口；
 *   - PickX.Combo：可输可选组合下拉（品名）——分组（最近使用 / 当前子类标准名 /
 *     其他子类相近名 / 自定义）、本地记忆（最近 5 条）、相似名引导、标准/自定义徽标。
 *
 * 设计口径：
 *   - 兼容性优先：镜像 value 到原 DOM 控件（select / input），collectData、必填校验、
 *     品类联动、续编回填全部零改动；
 *   - 面板质感：优先 Liquid Glass 真折射（window.LiquidGlass 可用且 WebGL2 支持时，
 *     1 个 context，一次只开一个面板），自动降级 backdrop-filter 毛玻璃；
 *   - 视觉语言：跟随宿主页面 CSS 变量（--bg-card/--line/--primary/--text-*），
 *     与单位弹窗等自绘组件同一套语言。
 *
 * 引入方式（宿主页）：
 *   <script src="../../js/pickx.js"></script>   （普通 script，先于业务脚本）
 *   <script type="module"> import { LiquidGlass } from '../../vendor/liquid-glass-webgl/src/index.js';
 *     window.LiquidGlass = LiquidGlass; </script>（可选，用于真折射）
 * ================================================================ */
(function (global) {
  'use strict';
  if (global.PickX) return;

  var doc = global.document;

  /* ============ 样式（注入一次，跟随宿主主题变量） ============ */
  var CSS = [
    '.pickx-wrap{position:relative;}',
    /* 触发框 */
    '.pickx-trigger{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line,#e3e4e6);border-radius:8px;background:var(--bg-card,#fff);color:var(--text-1,#1c1c1e);font-size:12.5px;line-height:1.5;cursor:pointer;outline:none;transition:border-color .2s,box-shadow .2s;text-align:left;}',
    '.pickx-trigger:hover{border-color:var(--primary-dim,#4d8de0);}',
    '.pickx-trigger:focus,.pickx-trigger.open{border-color:var(--primary-dim,#4d8de0);box-shadow:0 0 0 3px var(--primary-soft,rgba(77,141,224,.14));}',
    '.pickx-trigger .pickx-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.pickx-trigger .pickx-placeholder{color:var(--text-3,#9a9ba1);}',
    '.pickx-trigger .pickx-caret{flex:none;width:14px;height:14px;color:var(--text-3,#9a9ba1);transition:transform .18s;}',
    '.pickx-trigger.open .pickx-caret{transform:rotate(180deg);}',
    '.pickx-trigger.error{border-color:var(--danger,#d44c47);box-shadow:0 0 0 3px rgba(212,76,71,.1);}',
    /* 原生镜像（不可见但可聚焦，保留 value/校验/focus 兼容） */
    '.pickx-native{position:absolute !important;left:0;top:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:1;margin:0;padding:0;border:0;}',
    /* 面板（fixed 定位，脱离滚动容器避免裁剪；滚动即关闭） */
    '.pickx-panel{position:fixed;z-index:9990;min-width:200px;max-width:min(360px,calc(100vw - 24px));max-height:min(340px,calc(100vh - 24px));overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--line,#e3e4e6);border-radius:12px;box-shadow:0 12px 32px rgba(20,24,36,.16);background:rgba(255,255,255,.68);backdrop-filter:blur(18px) saturate(1.25);-webkit-backdrop-filter:blur(18px) saturate(1.25);opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .16s,transform .16s,visibility .16s;}',
    '[data-theme="dark"] .pickx-panel{background:rgba(30,32,38,.72);}',
    '.pickx-panel.open{opacity:1;visibility:visible;transform:translateY(0);}',
    '.pickx-panel.glass-webgl{background:rgba(255,255,255,.42);}',
    '[data-theme="dark"] .pickx-panel.glass-webgl{background:rgba(24,26,32,.5);}',
    /* 搜索框 */
    '.pickx-search{padding:8px;border-bottom:1px solid var(--line,#e3e4e6);flex:none;}',
    '.pickx-search input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--line,#e3e4e6);border-radius:8px;background:var(--bg-card,#fff);color:var(--text-1,#1c1c1e);font-size:12px;outline:none;}',
    '.pickx-search input:focus{border-color:var(--primary-dim,#4d8de0);box-shadow:0 0 0 2px var(--primary-soft,rgba(77,141,224,.14));}',
    /* 列表 */
    '.pickx-list{flex:1;overflow-y:auto;padding:4px;overscroll-behavior:contain;}',
    '.pickx-list::-webkit-scrollbar{width:5px;}',
    '.pickx-list::-webkit-scrollbar-thumb{background:var(--line,#e3e4e6);border-radius:3px;}',
    '.pickx-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;font-size:12.5px;color:var(--text-1,#1c1c1e);cursor:pointer;user-select:none;line-height:1.4;}',
    '.pickx-item:hover{background:var(--primary-soft,rgba(77,141,224,.1));}',
    '.pickx-item.active{background:var(--primary-soft,rgba(77,141,224,.14));}',
    '.pickx-item.selected .pickx-item-text{color:var(--primary-dim,#4d8de0);font-weight:600;}',
    '.pickx-item .pickx-check{flex:none;width:14px;height:14px;color:var(--primary,#2f6fd0);opacity:0;}',
    '.pickx-item.selected .pickx-check{opacity:1;}',
    '.pickx-item-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.pickx-badge{flex:none;font-size:9.5px;line-height:1;padding:3px 6px;border-radius:999px;background:var(--bg-card-2,#f2f3f5);color:var(--text-3,#9a9ba1);}',
    '.pickx-badge.recent{background:var(--primary-soft,rgba(77,141,224,.12));color:var(--primary-dim,#4d8de0);}',
    '.pickx-badge.standard{background:rgba(46,160,67,.1);color:#2ea043;}',
    '.pickx-badge.similar{background:rgba(255,153,0,.12);color:#e07b00;}',
    '.pickx-badge.custom{background:rgba(134,88,255,.1);color:#8658ff;}',
    /* 分组标题 */
    '.pickx-group-label{display:flex;align-items:center;gap:6px;padding:6px 10px 4px;font-size:10px;color:var(--text-3,#9a9ba1);font-weight:600;}',
    '.pickx-group-label::after{content:"";flex:1;height:1px;background:var(--line,#e3e4e6);}',
    /* 空态 / 申请 / 自定义 / 相似条 */
    '.pickx-empty{padding:14px 10px;text-align:center;font-size:11.5px;color:var(--text-3,#9a9ba1);line-height:1.6;}',
    '.pickx-footer{padding:6px 8px;border-top:1px solid var(--line,#e3e4e6);flex:none;font-size:11px;}',
    '.pickx-footer a{color:var(--primary-dim,#4d8de0);text-decoration:none;cursor:pointer;display:block;padding:6px 8px;border-radius:8px;font-size:11.5px;}',
    '.pickx-footer a:hover{background:var(--primary-soft,rgba(77,141,224,.1));}',
    '.pickx-simbar{padding:7px 10px;margin:0;border-bottom:1px dashed var(--line,#e3e4e6);font-size:11.5px;color:var(--primary-dim,#4d8de0);cursor:pointer;flex:none;}',
    '.pickx-simbar:hover{background:var(--primary-soft,rgba(77,141,224,.1));}',
    /* 组合框（品名）：input 即触发框 */
    '.pickx-combo-wrap{position:relative;}',
    '.pickx-combo-wrap .pickx-combo-caret{position:absolute;right:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--text-3,#9a9ba1);pointer-events:none;}',
    '.pickx-combo-wrap.open .pickx-combo-caret{transform:translateY(-50%) rotate(180deg);}'
  ].join('\n');
  var _style = doc.createElement('style');
  _style.textContent = CSS;
  (doc.head || doc.documentElement).appendChild(_style);

  /* ============ 工具 ============ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/\s+/g, '').toLowerCase();
  }
  function contains(hay, q) { return norm(hay).indexOf(norm(q)) !== -1; }
  function makeEl(tag, cls, html) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var CARET_SVG = '<svg class="pickx-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>';
  var CHECK_SVG = '<svg class="pickx-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';

  /* ============ 玻璃面板管理（单实例，1 个 WebGL context） ============ */
  var _activeGlass = null;
  function glassify(panel) {
    /* 面板文字可读性优先：真折射仅当 LiquidGlass 可用且 WebGL2 支持 */
    if (global.LiquidGlass && typeof LiquidGlass.isSupported === 'function' && LiquidGlass.isSupported()) {
      try {
        /* C-006（B 样式注入微调）：tintTone 仅补暗态 dark，明色保持 light；
           材质 4 键保持 §9（refraction:56 / rim:0.16 / edgeReach:0.08 / absorption:0.1）不变。 */
        var _darkTone = document.documentElement.getAttribute('data-theme') === 'dark'
          || document.documentElement.dataset.theme === 'dark';
        var g = new global.LiquidGlass(panel, {
          frost: 0.32, tint: 0.62, tintTone: _darkTone ? 'dark' : 'light',
          material: { refraction: 56, rim: 0.16, edgeReach: 0.08, absorption: 0.1 }
        });
        _activeGlass = g;
        panel.classList.add('glass-webgl');
        return true;
      } catch (e) { /* 降级毛玻璃 */ }
    }
    return false;
  }
  function unglass() {
    if (_activeGlass) { try { _activeGlass.destroy(); } catch (e) {} _activeGlass = null; }
    var p = doc.querySelectorAll('.pickx-panel.glass-webgl');
    for (var i = 0; i < p.length; i++) p[i].classList.remove('glass-webgl');
  }

  /* 全局唯一当前打开的面板（一次只开一个） */
  var _openPanel = null;
  function closeAll(except) {
    if (_openPanel && _openPanel !== except) {
      try { _openPanel.close(); } catch (e) {}
    }
  }

  /* ============ PickX.Select —— 受控选择下拉（子类） ============ */
  function PickXSelect(opts) {
    opts = opts || {};
    var self = this;
    this.opts = opts;
    this.el = opts.native;              /* 原 <select>（镜像 value + focus 校验） */
    this.host = opts.host || (this.el ? this.el.parentElement : null);
    this.dataFn = opts.data || function () { return []; };
    this.searchThreshold = opts.searchThreshold == null ? 12 : opts.searchThreshold;
    this.value = '';
    this.list = [];
    this.filtered = [];
    this.highlight = 0;
    this.query = '';
    this.open = false;

    /* ---- DOM ---- */
    this.trigger = null; this.panel = null; this.searchEl = null; this.listEl = null;
    if (this.host) {
      this.host.classList.add('pickx-wrap');
      this.trigger = makeEl('button', 'pickx-trigger',
        '<span class="pickx-value pickx-placeholder">' + esc(opts.placeholder || '请选择') + '</span>' + CARET_SVG);
      this.trigger.type = 'button';
      this.host.insertBefore(this.trigger, this.el);
      if (this.el) {
        this.el.className = 'pickx-native';
        /* 供 focusField 等外部逻辑把动效落到可见触发框 */
        this.el.__pickxTrigger = this.trigger;
      }
      this._buildPanel();
      this._bind();
      /* 首次同步选中态 */
      this.setValue(this.el ? this.el.value : '');
    }
  }
  PickXSelect.prototype._buildPanel = function () {
    var panel = makeEl('div', 'pickx-panel');
    if (this.opts.searchable !== false && this.dataFn().length > this.searchThreshold) {
      var sw = makeEl('div', 'pickx-search');
      var inp = doc.createElement('input');
      inp.type = 'text'; inp.placeholder = '搜索…';
      sw.appendChild(inp);
      panel.appendChild(sw);
      this.searchEl = inp;
    }
    var list = makeEl('div', 'pickx-list');
    panel.appendChild(list);
    this.listEl = list;
    /* 空态容器（动态） */
    var footer = makeEl('div', 'pickx-footer');
    if (optsHas(this, 'requestLink')) {
      var a = makeEl('a', '', '没有合适的子类？申请新增');
      a.href = 'javascript:void(0)';
      a.addEventListener('click', function (e) {
        e.stopPropagation();
        self.close();
        if (self.opts.onRequest) self.opts.onRequest();
      });
      footer.appendChild(a);
    }
    this.footerEl = footer;
    panel.appendChild(footer);
    (doc.body).appendChild(panel);
    this.panel = panel;
    this._panelReady = true;
  };
  function optsHas(self, k) { return !!(self.opts && self.opts[k]); }
  PickXSelect.prototype._bind = function () {
    var self = this;
    this.trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      self.open ? self.close() : self._open();
    });
    /* 原生 select focus（必填校验失败时 focusField 触发）→ 打开面板 */
    if (this.el) this.el.addEventListener('focus', function () { self._open(); });
    this.trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!self.open) { self._open(); return; }
        var n = self.filtered.length; if (!n) return;
        self.highlight = e.key === 'ArrowDown' ? (self.highlight + 1) % n : (self.highlight - 1 + n) % n;
        self._markHighlight();
      }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.open ? self._pickHighlight() : self._open(); }
      else if (e.key === 'Escape') { self.close(); self.trigger.focus(); }
    });
    if (this.searchEl) this.searchEl.addEventListener('input', function () { self.query = this.value; self._render(); });
    this.listEl.addEventListener('mousedown', function (e) { e.preventDefault(); });
    this.listEl.addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('.pickx-item') : null;
      if (it) self._pick(it.dataset.v);
    });
    this.panel.addEventListener('keydown', function (e) {
      var n = self.filtered.length;
      if (!n) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); self.highlight = (self.highlight + 1) % n; self._markHighlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); self.highlight = (self.highlight - 1 + n) % n; self._markHighlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); self._pickHighlight(); }
      else if (e.key === 'Escape') { self.close(); self.trigger.focus(); }
    });
    /* 点击外部关闭；滚动（滚动容器内）即关闭 */
    doc.addEventListener('mousedown', function (e) {
      if (self.open && !self.panel.contains(e.target) && e.target !== self.trigger && !self.trigger.contains(e.target)) self.close();
    });
    if (optsHas(this, 'closeOnScroll')) {
      doc.addEventListener('scroll', function () { if (self.open) self.close(); }, true);
    }
  };
  PickXSelect.prototype._open = function () {
    if (!this._panelReady) return;
    closeAll(this);
    var rect = this.trigger.getBoundingClientRect();
    var ph = Math.min(340, global.innerHeight - 24);
    var up = (rect.bottom + ph > global.innerHeight - 8) && (rect.top > ph + 8);
    this.panel.style.left = Math.max(8, Math.min(rect.left, global.innerWidth - 220)) + 'px';
    this.panel.style.top = (up ? rect.top - 8 : rect.bottom + 4) + 'px';
    this.panel.style.width = Math.max(rect.width, 200) + 'px';
    this.panel.style.maxHeight = (up ? rect.top - 8 : global.innerHeight - rect.bottom - 8) + 'px';
    this.panel.style.maxHeight = Math.min(340, parseFloat(this.panel.style.maxHeight)) + 'px';
    this.query = '';
    if (this.searchEl) { this.searchEl.value = ''; }
    this._render();
    this.panel.classList.add('open');
    this.trigger.classList.add('open');
    this.open = true;
    _openPanel = this;
    glassify(this.panel);
    var sel = this.value;
    var idx = -1;
    for (var i = 0; i < this.filtered.length; i++) if (this.filtered[i] === sel) { idx = i; break; }
    this.highlight = idx >= 0 ? idx : 0;
    this._markHighlight();
    if (this.searchEl) { var self = this; setTimeout(function () { self.searchEl.focus(); }, 60); }
    else { this.trigger.focus(); }
  };
  PickXSelect.prototype._render = function () {
    var self = this;
    var items = this.dataFn();
    this.list = items.slice();
    if (this.query) this.filtered = items.filter(function (v) { return contains(v, self.query); });
    else this.filtered = items.slice();
    if (!this.filtered.length) {
      this.listEl.innerHTML = '<div class="pickx-empty">' + esc(this.query ? '未找到匹配项，可输入更少关键词' : '暂无可用选项') + '</div>';
      return;
    }
    this.listEl.innerHTML = '';
    this.filtered.forEach(function (v) {
      var it = makeEl('div', 'pickx-item' + (v === self.value ? ' selected' : ''));
      it.dataset.v = v;
      it.innerHTML = CHECK_SVG + '<span class="pickx-item-text">' + esc(v) + '</span>';
      self.listEl.appendChild(it);
    });
    this.highlight = Math.min(this.highlight, this.filtered.length - 1);
  };
  PickXSelect.prototype._markHighlight = function () {
    var els = this.listEl.querySelectorAll('.pickx-item');
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('active', i === this.highlight);
    var act = this.listEl.querySelector('.pickx-item.active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
  };
  PickXSelect.prototype._pickHighlight = function () {
    var v = this.filtered[this.highlight];
    if (v != null) this._pick(v);
  };
  PickXSelect.prototype._pick = function (v) {
    this.setValue(v);
    if (this.el) {
      this.el.value = v;
      this.el.dispatchEvent(new global.Event('change', { bubbles: true }));
    }
    if (this.opts.onSelect) this.opts.onSelect(v);
    this.close();
  };
  PickXSelect.prototype.setValue = function (v) {
    this.value = v == null ? '' : String(v);
    if (this.trigger) {
      this.trigger.querySelector('.pickx-value').textContent = this.value || (this.opts.placeholder || '请选择');
      this.trigger.querySelector('.pickx-value').classList.toggle('pickx-placeholder', !this.value);
    }
    if (this.listEl) this._render();
  };
  PickXSelect.prototype.setData = function (items) {
    /* 词表重建（品类切换/子类申请通过后）时刷新列表与搜索框显隐 */
    if (this.searchEl && this.opts.searchable !== false) {
      var need = items.length > this.searchThreshold;
      var has = this.searchEl.parentElement ? true : false;
      if (need && !has) {
        var sw = makeEl('div', 'pickx-search');
        var inp = doc.createElement('input');
        inp.type = 'text'; inp.placeholder = '搜索…';
        sw.appendChild(inp);
        this.panel.insertBefore(sw, this.panel.firstChild);
        this.searchEl = inp;
        var self = this;
        inp.addEventListener('input', function () { self.query = this.value; self._render(); });
      } else if (!need && has) {
        this.searchEl.parentElement.removeChild(this.searchEl.parentElement);
        this.searchEl = null;
        this.query = '';
      }
    }
    this._render();
  };
  PickXSelect.prototype.close = function () {
    if (!this.open) return;
    this.panel.classList.remove('open');
    this.trigger.classList.remove('open');
    this.open = false;
    if (_openPanel === this) _openPanel = null;
    unglass();
  };
  PickXSelect.prototype.focus = function () {
    if (this.trigger) { this.trigger.focus(); this._open(); }
  };

  /* ============ PickX.Combo —— 可输可选组合下拉（品名） ============ */
  function PickXCombo(opts) {
    opts = opts || {};
    var self = this;
    this.opts = opts;
    this.input = opts.input;            /* 原 <input>（即触发框，value 天然镜像） */
    this.host = opts.host || (this.input ? this.input.parentElement : null);
    this.groupsFn = opts.groups || function () { return []; };   /* [{label,badge,items:[str]}] */
    this.memoryKeyFn = opts.memoryKey || function () { return null; };
    this.similarFn = opts.similar || null;
    this.open = false;
    this.filtered = [];                 /* [{g, idx, v}] 拍平后的可见项 */
    this.highlight = 0;
    this.query = '';
    this._simCache = null;

    if (this.host && this.input) {
      this.host.classList.add('pickx-combo-wrap');
      var caret = makeEl('span', 'pickx-combo-caret', CARET_SVG);
      this.host.appendChild(caret);
      this._buildPanel();
      this._bind();
    }
  }
  PickXCombo.prototype._buildPanel = function () {
    var panel = makeEl('div', 'pickx-panel');
    this.simBar = null;
    var list = makeEl('div', 'pickx-list');
    panel.appendChild(list);
    this.listEl = list;
    var footer = makeEl('div', 'pickx-footer');
    this.footerEl = footer;
    panel.appendChild(footer);
    doc.body.appendChild(panel);
    this.panel = panel;
    this._panelReady = true;
  };
  PickXCombo.prototype._bind = function () {
    var self = this;
    this.input.addEventListener('focus', function () { self._open(); });
    this.input.addEventListener('click', function (e) { e.stopPropagation(); if (!self.open) self._open(); });
    this.input.addEventListener('input', function () {
      if (!self.open) self._open();
      self.query = this.value;
      self._render();
    });
    this.input.addEventListener('keydown', function (e) {
      var n = self.filtered.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); self._open(); if (n) { self.highlight = (self.highlight + 1) % n; self._markHighlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); self._open(); if (n) { self.highlight = (self.highlight - 1 + n) % n; self._markHighlight(); } }
      else if (e.key === 'Enter') {
        if (!self.open) { self._open(); e.preventDefault(); return; }
        if (n) { e.preventDefault(); self._pickItem(self.filtered[self.highlight]); }
        /* 无候选时 Enter = 自定义品名确认（用户主权：未命中可自定义） */
        else { e.preventDefault(); self._confirmCustom(); }
      }
      else if (e.key === 'Escape') { self.close(); }
    });
    this.listEl.addEventListener('mousedown', function (e) { e.preventDefault(); });
    this.listEl.addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('.pickx-item') : null;
      if (it) self._pickItem({ g: Number(it.dataset.g), v: it.dataset.v });
      var sim = e.target.closest ? e.target.closest('.pickx-simbar') : null;
      if (sim && self._simCache && self._simCache.name) { self._applySimilar(self._simCache.name); }
    });
    this.footerEl.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('.pickx-use-custom') : null;
      if (a) { self._confirmCustom(); }
    });
    doc.addEventListener('mousedown', function (e) {
      if (self.open && !self.panel.contains(e.target) && e.target !== self.input && !self.host.contains(e.target)) self.close();
    });
    if (optsHas(this, 'closeOnScroll')) {
      doc.addEventListener('scroll', function () { if (self.open) self.close(); }, true);
    }
  };
  PickXCombo.prototype._open = function () {
    if (!this._panelReady) return;
    closeAll(this);
    var rect = this.input.getBoundingClientRect();
    var ph = Math.min(300, global.innerHeight - 24);
    var up = (rect.bottom + ph > global.innerHeight - 8) && (rect.top > ph + 8);
    this.panel.style.left = Math.max(8, Math.min(rect.left, global.innerWidth - 240)) + 'px';
    this.panel.style.top = (up ? rect.top - 8 : rect.bottom + 4) + 'px';
    this.panel.style.width = Math.max(rect.width, 240) + 'px';
    this.panel.style.maxHeight = (up ? rect.top - 8 : global.innerHeight - rect.bottom - 8) + 'px';
    this.panel.style.maxHeight = Math.min(320, parseFloat(this.panel.style.maxHeight)) + 'px';
    this._render();
    this.panel.classList.add('open');
    this.host.classList.add('open');
    this.open = true;
    _openPanel = this;
    glassify(this.panel);
  };
  PickXCombo.prototype._render = function () {
    var groups = this.groupsFn();
    var q = this.query;
    var flat = [];
    groups.forEach(function (g, gi) {
      if (!g.items || !g.items.length) return;
      g.items.forEach(function (v) {
        if (!q || contains(v, q)) flat.push({ g: gi, v: v });
      });
    });
    this.filtered = flat;
    var self = this;
    this.listEl.innerHTML = '';
    /* 相似名引导条（输入时） */
    this.simBar = null;
    if (this.similarFn && q && q.trim()) {
      try {
        var r = this.similarFn(q);
        if (r && r.hit && r.name && r.name !== q.trim()) {
          this._simCache = r;
          var sb = makeEl('div', 'pickx-simbar', '是否指「' + esc(r.name) + '」？');
          this.simBar = sb;
          this.listEl.appendChild(sb);
        } else this._simCache = null;
      } catch (e) { this._simCache = null; }
    } else this._simCache = null;
    if (!flat.length) {
      /* 有输入 → 提示可自定义；无输入 → 空态 */
      this.listEl.appendChild(makeEl('div', 'pickx-empty',
        q ? '词库暂无匹配，可直接输入你的品名' : '暂无品名联想，可直接输入'));
      this.footerEl.innerHTML = q && q.trim() ? '<a class="pickx-use-custom" href="javascript:void(0)">使用「' + esc(q.trim()) + '」作为品名（自定义）</a>' : '';
      return;
    }
    var lastGi = -1;
    flat.forEach(function (f) {
      var g = groups[f.g];
      if (f.g !== lastGi) {
        lastGi = f.g;
        self.listEl.appendChild(makeEl('div', 'pickx-group-label', esc(g.label || '')));
      }
      var it = makeEl('div', 'pickx-item');
      it.dataset.g = f.g; it.dataset.v = f.v;
      it.innerHTML = CHECK_SVG + '<span class="pickx-item-text">' + esc(f.v) + '</span>' +
        (g.badge ? '<span class="pickx-badge ' + esc(g.badgeCls || '') + '">' + esc(g.badge) + '</span>' : '');
      self.listEl.appendChild(it);
    });
    this.footerEl.innerHTML = '';
    this.highlight = Math.min(this.highlight, flat.length - 1);
  };
  PickXCombo.prototype._markHighlight = function () {
    var els = this.listEl.querySelectorAll('.pickx-item');
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('active', i === this.highlight);
    var act = this.listEl.querySelector('.pickx-item.active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
  };
  PickXCombo.prototype._pickItem = function (f) {
    if (!f) return;
    var groups = this.groupsFn();
    var g = groups[f.g] || {};
    this._applyValue(f.v, g);
  };
  PickXCombo.prototype._applySimilar = function (name) {
    this._applyValue(name, { standard: true });
  };
  PickXCombo.prototype._applyValue = function (v, g) {
    this.input.value = v;
    this.input.dispatchEvent(new global.Event('input', { bubbles: true }));
    /* 记忆写入（最近使用，去重置顶） */
    var key = this.memoryKeyFn();
    if (key) remember(key, v, !!g.standard);
    if (this.opts.onPick) this.opts.onPick(v, !!g.standard);
    this.close();
  };
  PickXCombo.prototype._confirmCustom = function () {
    var v = this.input.value.trim();
    if (!v) return;
    this._applyValue(v, { standard: false });
  };
  PickXCombo.prototype.close = function () {
    if (!this.open) return;
    this.panel.classList.remove('open');
    this.host.classList.remove('open');
    this.open = false;
    if (_openPanel === this) _openPanel = null;
    unglass();
  };
  PickXCombo.prototype.focus = function () {
    if (this.input) { this.input.focus(); this._open(); }
  };

  /* ============ 本地记忆（最近使用品名，按 品类|子类 分桶，最近 5 条） ============ */
  function memoryKeyOf(key) { return 'pickx:subname:' + encodeURIComponent(key); }
  function readMemory(key) {
    try { var v = JSON.parse(localStorage.getItem(memoryKeyOf(key)) || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function remember(key, name, standard) {
    try {
      var arr = readMemory(key);
      arr = arr.filter(function (x) { return x.name !== name; });
      arr.unshift({ name: name, standard: !!standard, t: Date.now() });
      arr = arr.slice(0, 5);
      localStorage.setItem(memoryKeyOf(key), JSON.stringify(arr));
    } catch (e) {}
  }

  global.PickX = {
    Select: PickXSelect,
    Combo: PickXCombo,
    helpers: { remember: remember, readMemory: readMemory, memoryKeyOf: memoryKeyOf }
  };
})(window);
