/*!
 * Engchain3.0 在线编辑引擎统一封装层（契约 §3 Adapter 接口 / §4 信封格式）
 *
 * 三后端：
 *  - ONLYOFFICE（http 本地回环场景）：docx/doc → word 编辑器，xlsx/xls → cell 编辑器，
 *    iframe 嵌入 onlyoffice.html，postMessage 协议（onlyoffice-config / onlyoffice-save /
 *    onlyoffice-saved），保存取回二进制 ArrayBuffer → base64 入信封。
 *  - Univer 1.1.0（file:// 场景，需联网 esm.sh）：仅 sheet，snapshot JSON 持久化。
 *  - 轻量兜底（contenteditable / 现有 HTML 表格）由 file-editor.html 原生 DOM 承担，不经本层。
 *
 * 信封（契约 §4.3）：
 *   { v:1, engine:'onlyoffice'|'univer', kind:'doc'|'sheet',
 *     data:<base64 二进制 | snapshot JSON 字符串>, snapshot:'<HTML 只读快照>',
 *     meta:{ updatedAt, engineVersion } }
 *
 * 接口（契约 §3.1）：
 *   EcEditor.create(kind:'doc'|'sheet', container) → adapter
 *   adapter.load(data, opts):Promise<void>
 *   adapter.export():Promise<envelope>      // 异步引擎导出（保存流使用）
 *   adapter.getContent():envelope|null     // 同步返回最近一次 export 缓存，未就绪为 null
 *   adapter.focus() / adapter.scrollToTop() / adapter.destroy() / adapter.getType()
 */
(function (root) {
  'use strict';

  /* ===================== 通用工具 ===================== */

  function abToB64(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000, out = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      var slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
      out += String.fromCharCode.apply(null, slice);
    }
    return btoa(out);
  }

  function b64ToAb(b64) {
    var bin = atob(String(b64 || ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function abToText(buffer) {
    try { return new TextDecoder('utf-8').decode(buffer); }
    catch (e) {
      var bytes = new Uint8Array(buffer), s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 只读 HTML 快照长度上限（契约 §4.3-4，避免快照撑爆 localStorage） */
  var SNAPSHOT_LIMIT = 20000;
  /* 信封 data（base64）大小预检阈值：1.5MB（契约 §4.3-4 / 规划 §3.3） */
  var B64_LIMIT = 1500000;

  /* ===================== ONLYOFFICE 运行时定位 ===================== */

  function ooBase() {
    if (root.__OO_RUNTIME_URL) {
      return root.__OO_RUNTIME_URL.replace(/onlyoffice\.html.*$/, '');
    }
    var origin = location.origin;
    if (origin && origin !== 'null') {
      return origin + '/Engchain3.0-archive/onlyoffice-runtime/';
    }
    return 'http://127.0.0.1:8765/Engchain3.0-archive/onlyoffice-runtime/';
  }

  function ooFrameSrc() { return ooBase() + 'onlyoffice.html'; }

  function isHttp() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  /* ---- 离线快照库懒加载（mammoth docx→HTML；SheetJS xlsx→HTML 表），绕开离线 x2t 导出 ---- */
  var _vendorCache = {};
  function loadVendor(name, path) {
    if (_vendorCache[name]) return _vendorCache[name];
    _vendorCache[name] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ooBase() + path;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('离线库加载失败: ' + path)); };
      document.head.appendChild(s);
    });
    return _vendorCache[name];
  }

  /* 剔脚本/事件属性/内联危险样式，保留基本排版（HF sanitizeSnapshot 还会再滤一道） */
  function sanitizeSnapshotHtml(html) {
    var src = String(html || '');
    src = src.replace(/<script[\s\S]*?<\/script>/gi, '');
    src = src.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    src = src.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
    src = src.replace(/javascript:\s*/gi, '');
    if (src.length > SNAPSHOT_LIMIT) src = src.slice(0, SNAPSHOT_LIMIT);
    return src;
  }

  /* ===================== 快照构建：doc html / sheet csv ===================== */

  /* OO 导出的 html 是完整文档；取 body 内容，剔脚本/样式标签（HF sanitizeSnapshot 还会再滤一道） */
  function htmlDocToSnapshot(html) {
    var src = String(html || '');
    var body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(src);
    var inner = body ? body[1] : src;
    inner = inner.replace(/<script[\s\S]*?<\/script>/gi, '');
    inner = inner.replace(/<style[\s\S]*?<\/style>/gi, '');
    if (inner.length > SNAPSHOT_LIMIT) inner = inner.slice(0, SNAPSHOT_LIMIT);
    return inner;
  }

  /* 最小 CSV 解析（支持引号 / 转义双引号 / CRLF），输出静态表格 HTML（首行 th） */
  function csvToTableHtml(text) {
    var rows = [], row = [], cell = '', inQ = false;
    var src = String(text || '').replace(/\r\n?/g, '\n');
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (inQ) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else inQ = false;
        } else cell += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    var html = '<table class="hf-pv-xls-table">';
    rows.forEach(function (r, ri) {
      html += '<tr>';
      r.forEach(function (c) {
        html += ri === 0 ? '<th>' + escapeHtml(c) + '</th>' : '<td>' + escapeHtml(c) + '</td>';
      });
      html += '</tr>';
    });
    return (html + '</table>').slice(0, SNAPSHOT_LIMIT);
  }

  /* ===================== ONLYOFFICE 后端 ===================== */

  function OoBackend(kind, container) {
    this.kind = kind;
    this.container = container;
    this.iframe = null;
    this.docReady = false;
    this.pending = {};
    this.saveSeq = 0;
    this.cached = null;
    this.destroyed = false;
    this._lastData = null;
    this._lastOpts = null;
    this._readyWaiters = [];
    this._onMsg = this._onMsg.bind(this);
  }

  OoBackend.prototype.getType = function () { return this.kind; };

  OoBackend.prototype._onMsg = function (e) {
    var d = e.data;
    if (!d || !this.iframe) return;
    /* 重建后新旧 frame 交替，严格 source 过滤会丢弃旧 frame 的 ready；
       ready/open-error 按类型接受，saved 由 requestId 精确匹配（硬约束1） */

    if (d.type === 'onlyoffice-document-ready') {
      this.docReady = true;
      if (this._readyResolve) { var r = this._readyResolve; this._readyResolve = null; r(); }
      var ws = this._readyWaiters.splice(0);
      ws.forEach(function (w) { w.resolve(); });
      return;
    }
    if (d.type === 'onlyoffice-open-error') {
      this._diagFail('open-error', new Error(d.error || '编辑器打开失败'));
      if (this._readyReject) { var rj = this._readyReject; this._readyReject = null; rj(new Error(d.error || '编辑器打开失败')); }
      return;
    }
    if (d.type === 'onlyoffice-saved') {
      var p = this.pending[d.requestId];
      if (!p) return; /* 无 requestId 的自动保存流，忽略 */
      delete this.pending[d.requestId];
      clearTimeout(p.timer);
      if (d.ok && d.buffer) p.resolve(d.buffer);
      else p.reject(new Error(d.error || '导出失败'));
    }
  };

  OoBackend.prototype._post = function (msg, transfer) {
    if (!this.iframe || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage(msg, '*', transfer || []);
  };

  /* 等 wrapper onlyoffice-ready（handleMessage 已注册、DocsAPI 就绪）再发 config；
     ready 仅 init 发一次且可能早于本监听器，故 1.5s 兜底直发，消除 cell 冷启动竞态 */
  OoBackend.prototype._postConfigWhenReady = function (built) {
    var self = this;
    var readyHit = false;
    var rk = function (e) {
      if (e.data && e.data.type === 'onlyoffice-ready') {
        readyHit = true;
        window.removeEventListener('message', rk);
        self._post({ type: 'onlyoffice-config', docConfig: built.docConfig });
      }
    };
    window.addEventListener('message', rk);
    setTimeout(function () {
      if (!readyHit) {
        window.removeEventListener('message', rk);
        self._post({ type: 'onlyoffice-config', docConfig: built.docConfig });
      }
    }, 1500);
  };

  /* 文档打开等待：首启放宽到 120s（冷首启 x2t 预热实测 ~66s，60s 会误杀首帧预热）；
     超时销毁重建一次，不在同实例盲重试（硬约束 4） */
  var LOAD_MAX_ATTEMPTS = 2;
  var LOAD_TIMEOUT_MS = 120000;

  OoBackend.prototype.load = function (data, opts) {
    var self = this;
    opts = opts || {};
    this._lastData = data;
    this._lastOpts = opts;
    var attempt = 0;

    function attemptOnce() {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          self._diagFail('load-timeout', new Error('编辑器加载超时'));
          reject(new Error('编辑器加载超时'));
        }, LOAD_TIMEOUT_MS);

        /* document-ready 才 resolve；监听器保留供后续 export() 的 onlyoffice-saved 复用 */
        self._readyResolve = function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        self._readyReject = function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        };

        self.container.innerHTML = '';
        var frame = document.createElement('iframe');
        frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#fff;';
        /* 先挂 onload 再设 src，避免 iframe 已加载完成后赋值 onload 永不触发（config 漏发） */
        frame.onload = function () {
          self._buildConfig(data, opts).then(function (built) {
            self._postConfigWhenReady(built);
          }).catch(function (err) { self._readyReject(err); });
        };
        frame.src = ooFrameSrc();
        self.iframe = frame;
        self.container.appendChild(frame);
        /* 先移除旧监听器，避免重试累积重复 message 监听 */
        window.removeEventListener('message', self._onMsg);
        window.addEventListener('message', self._onMsg);
        /* 契约 §2.3-5：容器尺寸变化时保持引擎面 100% 填满（全屏/窗口缩放联动） */
        if (typeof ResizeObserver !== 'undefined') {
          self._ro = new ResizeObserver(function () {
            frame.style.width = '100%';
            frame.style.height = '100%';
          });
          self._ro.observe(self.container);
        }
      });
    }

    return attemptOnce().catch(function (err) {
      attempt++;
      /* 冷启动 x2t 偶发转换失败/超时：退避后重试（重建 iframe 与配置，key 换新） */
      if (attempt < LOAD_MAX_ATTEMPTS) {
        console.warn('[EcEditor] OO 第 ' + attempt + ' 次加载失败，重试：', err);
        return new Promise(function (r) { setTimeout(r, 1200 * attempt); }).then(attemptOnce);
      }
      throw err;
    });
  };

  function blobUrl(ab, mime) {
    return URL.createObjectURL(new Blob([ab], { type: mime || 'application/octet-stream' }));
  }

  OoBackend.prototype._buildConfig = function (data, opts) {
    var isDoc = this.kind === 'doc';
    var targetFormat = isDoc ? 'docx' : 'xlsx';
    var mime = isDoc
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    var docConfig = {
      document: {
        title: opts.title || (isDoc ? '文档.docx' : '表格.xlsx'),
        fileType: targetFormat,
        key: 'ec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        permissions: { edit: true, download: true, print: true }
      },
      documentType: isDoc ? 'word' : 'cell',
      /* 对齐已实测成功的 rt_harness 配置：只保留 mode/lang；
         本离线构建传 editorConfig.user/theme 会触发 forEach 转换错误、卡在「文件加载中」、不发 document-ready */
      editorConfig: {
        mode: 'edit',
        lang: 'zh-CN'
      }
    };

    /* 1) 已有信封：data 为 base64 二进制 → 解码为 blob URL（openBuffer/localOpenFromBinary
       在本离线版仅支持 pdf，word/cell 一律走 document.url，与 office.html 实测一致） */
    if (data && typeof data === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(data)) {
      try {
        docConfig.document.url = blobUrl(b64ToAb(data), mime);
        return Promise.resolve({ docConfig: docConfig });
      } catch (e) { /* 落到新建 */ }
    }

    /* 2) 旧 doc HTML：尝试 html blob URL 由 x2t 转换打开；失败由 load 的 open-error 拒绝，FE 降级轻量编辑器 */
    if (opts.legacy && opts.legacy.isLegacy && isDoc) {
      docConfig.document.url = URL.createObjectURL(new Blob([String(opts.legacy.raw || '')], { type: 'text/html' }));
      docConfig.document.fileType = 'html';
      return Promise.resolve({ docConfig: docConfig });
    }

    /* 3) 旧 sheet 二维数组 → CSV blob URL（cell 编辑器原生可开 csv） */
    if (opts.legacy && opts.legacy.isLegacy && !isDoc) {
      var arr;
      try { arr = JSON.parse(opts.legacy.raw); } catch (e) { arr = []; }
      var csv = (arr || []).map(function (r) {
        return (r || []).map(function (c) {
          var v = String(c == null ? '' : c);
          return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        }).join(',');
      }).join('\n');
      docConfig.document.url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      docConfig.document.fileType = 'csv';
      return Promise.resolve({ docConfig: docConfig });
    }

    /* 4) 新建：blank 模板走同源 http 直链（blob URL 在 OO 内部 worker 不可取；冷启动抖动 load 内多轮重试） */
    docConfig.document.url = ooBase() + 'blank/blank.' + targetFormat;
    return Promise.resolve({ docConfig: docConfig });
  };

  /* 保存超时 20s（暖态实测 1~3s）；超时销毁旧 iframe 重建，不在同实例盲重试（硬约束 4） */
  OoBackend.prototype._save = function (format) {
    var self = this;
    var requestId = 'save-' + (++this.saveSeq);
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete self.pending[requestId];
        /* 销毁旧实例并重建，供下一次保存使用；本次 Promise 直接 reject */
        self._selfHealRebuild();
        reject(new Error('导出超时（已重建编辑器）'));
      }, 20000);
      /* 硬约束 1：先登记 pending[requestId]，再发 onlyoffice-save；回传按 requestId 匹配 */
      self.pending[requestId] = { resolve: resolve, reject: reject, timer: timer };
      self._post({ type: 'onlyoffice-save', requestId: requestId, format: format });
    });
  };

  /* 一次性等待 onlyoffice-ready 握手（wrapper 完成 api 初始化后发出），作为发 config 前置 */
  OoBackend.prototype._whenReadyMessage = function () {
    var self = this;
    return new Promise(function (resolve) {
      var h = function (e) {
        if (e.data && e.data.type === 'onlyoffice-ready') {
          window.removeEventListener('message', h);
          resolve();
        }
      };
      window.addEventListener('message', h);
    });
  };

  /* 失败诊断（修复3）：打印 ready/document-ready/open-error 状态与 config 摘要，便于定位 */
  OoBackend.prototype._diagFail = function (stage, err) {
    console.warn('[EcEditor] [' + stage + '] 失败诊断 ready=' + this.docReady +
      ' openError=' + (err && err.message) + ' config=',
      this._lastOpts && { title: this._lastOpts.title, theme: this._lastOpts.theme });
    /* 校验 blank 模板在当前 origin 可达（非 D 根服务可能 404 卡加载） */
    fetch(ooBase() + 'blank/blank.docx', { method: 'HEAD' }).then(function (r) {
      if (!r.ok) console.warn('[EcEditor] blank.docx HTTP ' + r.status + '（runtime 路径可能 404）');
    }).catch(function () {});
  };

  /* 等待 document-ready（保存前置条件，硬约束 3）；未就绪最多等 20s */
  OoBackend.prototype._ensureReady = function () {
    var self = this;
    if (this.docReady) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('文档尚未就绪，暂不能保存'));
      }, 20000);
      self._readyWaiters.push({
        resolve: function () { clearTimeout(timer); resolve(); },
        reject: reject
      });
    });
  };

  /* 销毁旧 iframe 并按已存 data/opts 重建（切文件/超时自愈，硬约束 2：在途不重发 config，切文件重建） */
  OoBackend.prototype._selfHealRebuild = function () {
    var self = this;
    /* 清掉在途 pending，避免迟到回传悬挂 */
    Object.keys(this.pending).forEach(function (k) { clearTimeout(self.pending[k].timer); });
    this.pending = {};
    if (this._ro) { try { this._ro.disconnect(); } catch (e) {} this._ro = null; }
    if (this.iframe && this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    this.docReady = false;
    if (this.destroyed) return;
    this._buildConfig(this._lastData, this._lastOpts).then(function (built) {
      var frame = document.createElement('iframe');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#fff;';
      frame.onload = function () {
        self._postConfigWhenReady(built);
      };
      frame.src = ooFrameSrc();
      self.iframe = frame;
      self.container.appendChild(frame);
    }).catch(function () {});
  };

  /* 离线构建快照：doc→mammoth.convertToHtml；sheet→SheetJS sheet_to_html。
     绕开离线 x2t 的 html/csv 导出（code 80/88）；失败沿用最近一次成功快照，不阻断主二进制保存。 */
  OoBackend.prototype._offlineSnapshot = function (binBuf) {
    var self = this;
    if (this.kind === 'doc') {
      return loadVendor('mammoth', 'vendor/mammoth.min.js').then(function () {
        if (!window.mammoth || !window.mammoth.convertToHtml) throw new Error('mammoth 不可用');
        return window.mammoth.convertToHtml({ arrayBuffer: binBuf });
      }).then(function (res) {
        return sanitizeSnapshotHtml((res && res.value) || '');
      });
    }
    return loadVendor('xlsx', 'vendor/xlsx.full.min.js').then(function () {
      if (!window.XLSX) throw new Error('SheetJS 不可用');
      var wb = window.XLSX.read(binBuf, { type: 'array' });
      var name = wb.SheetNames && wb.SheetNames[0];
      if (!name) return '';
      var html = window.XLSX.utils.sheet_to_html(wb.Sheets[name]);
      return sanitizeSnapshotHtml(html);
    });
  };

  /* 异步导出：等 document-ready → 取主二进制（docx/xlsx）→ 离线库构建真实快照 → 信封 */
  OoBackend.prototype.export = function () {
    var self = this;
    var binFormat = this.kind === 'doc' ? 'docx' : 'xlsx';
    var snapshot = (this.cached && this.cached.snapshot) || ''; /* 替代：沿用旧快照 */
    return this._ensureReady().then(function () {
      return self._save(binFormat);
    }).then(function (binBuf) {
      return self._offlineSnapshot(binBuf).then(function (snap) {
        if (snap) snapshot = snap;
        return binBuf;
      }).catch(function (e) {
        console.warn('[EcEditor] 离线快照构建失败，沿用旧快照：', e);
        return binBuf;
      });
    }).then(function (binBuf) {
      var b64 = abToB64(binBuf);
      if (b64.length > B64_LIMIT) throw new Error('内容过大，请精简后保存');
      var env = {
        v: 1,
        engine: 'onlyoffice',
        kind: self.kind,
        data: b64,
        snapshot: snapshot,
        meta: { updatedAt: Date.now(), engineVersion: '9.3.0.133' }
      };
      self.cached = env;
      return env;
    });
  };

  OoBackend.prototype.getContent = function () { return this.cached; };

  OoBackend.prototype.focus = function () {
    try { if (this.iframe && this.iframe.contentWindow) this.iframe.contentWindow.focus(); } catch (e) {}
  };

  OoBackend.prototype.scrollToTop = function () { /* OO 内部画布自管滚动，无公开滚动接口 */ };

  OoBackend.prototype.destroy = function () {
    this.destroyed = true;
    window.removeEventListener('message', this._onMsg);
    if (this._ro) { try { this._ro.disconnect(); } catch (e) {} this._ro = null; }
    if (this.iframe && this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    this.pending = {};
  };

  /* ===================== Univer 后端（file:// sheet 兜底，需联网） ===================== */

  function arrayToSnapshot(matrix) {
    var cellData = {};
    var rows = Array.isArray(matrix) ? matrix : [];
    var maxCols = 0;
    rows.forEach(function (row, r) {
      cellData[r] = {};
      (row || []).forEach(function (val, c) {
        maxCols = Math.max(maxCols, c + 1);
        var num = typeof val === 'number';
        cellData[r][c] = num ? { v: val, t: 2 } : { v: val == null ? '' : String(val), t: 1 };
      });
    });
    return {
      id: 'wb', name: '工作簿', sheetOrder: ['s1'],
      sheets: { s1: { id: 's1', name: 'Sheet1', rowCount: rows.length || 30, columnCount: maxCols || 15, cellData: cellData } }
    };
  }

  function univerSnapshotToTableHtml(snap) {
    if (!snap || !snap.sheets || !snap.sheetOrder || !snap.sheetOrder.length) return '';
    var sh = snap.sheets[snap.sheetOrder[0]];
    var cellData = sh.cellData || {};
    var rows = Object.keys(cellData).map(Number).sort(function (a, b) { return a - b; });
    var maxC = 0;
    rows.forEach(function (r) { maxC = Math.max(maxC, Object.keys(cellData[r]).length); });
    var html = '<table class="hf-pv-xls-table">';
    rows.forEach(function (r, ri) {
      html += '<tr>';
      for (var c = 0; c < maxC; c++) {
        var cell = cellData[r][c];
        var v = cell ? (cell.v != null ? cell.v : (cell.f || '')) : '';
        html += ri === 0 ? '<th>' + escapeHtml(v) + '</th>' : '<td>' + escapeHtml(v) + '</td>';
      }
      html += '</tr>';
    });
    return (html + '</table>').slice(0, SNAPSHOT_LIMIT);
  }

  function UniverBackend(kind, container) {
    this.kind = kind;
    this.container = container;
    this.univerAPI = null;
    this.cached = null;
    this._cssLink = null;
  }

  UniverBackend.prototype.getType = function () { return 'sheet'; };

  UniverBackend.prototype.load = function (data, opts) {
    var self = this;
    opts = opts || {};
    var cssUrl = 'https://cdn.jsdelivr.net/npm/@univerjs/preset-sheets-core@1.1.0/lib/index.css';
    return Promise.resolve().then(function () {
      /* 注入 Univer CSS（幂等） */
      if (!document.querySelector('link[data-univer-css]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        link.setAttribute('data-univer-css', '1');
        document.head.appendChild(link);
        self._cssLink = link;
      }
      return Promise.all([
        import('https://esm.sh/@univerjs/presets@1.1.0'),
        import('https://esm.sh/@univerjs/preset-sheets-core@1.1.0'),
        import('https://esm.sh/@univerjs/preset-sheets-core@1.1.0/locales/zh-CN')
      ]);
    }).then(function (mods) {
      var presets = mods[0], core = mods[1], zh = mods[2];
      var createUniver = presets.createUniver, LocaleType = presets.LocaleType, mergeLocales = presets.mergeLocales;
      var UniverSheetsCorePreset = core.UniverSheetsCorePreset;
      var created = createUniver({
        locale: LocaleType.ZH_CN,
        locales: { [LocaleType.ZH_CN]: mergeLocales(zh.default) },
        presets: [UniverSheetsCorePreset({ container: self.container })]
      });
      /* createUniver 返回 { univerAPI }（1.1.0），需解构；兼容直接返回 API 的形态 */
      self.univerAPI = created && created.univerAPI ? created.univerAPI : created;
      var wbData = null;
      if (data && typeof data === 'string') {
        try { wbData = JSON.parse(data); } catch (e) { wbData = null; }
      } else if (opts.legacy && opts.legacy.isLegacy) {
        try { wbData = arrayToSnapshot(JSON.parse(opts.legacy.raw)); } catch (e) { wbData = null; }
      }
      self.univerAPI.createWorkbook(wbData || {});
    });
  };

  UniverBackend.prototype.export = function () {
    var self = this;
    return Promise.resolve().then(function () {
      var wb = self.univerAPI.getActiveWorkbook();
      var snap = wb.getSnapshot ? wb.getSnapshot() : wb.getWorkbook().getSnapshot();
      var dataStr = JSON.stringify(snap);
      if (dataStr.length > B64_LIMIT) throw new Error('内容过大，请精简后保存');
      var env = {
        v: 1,
        engine: 'univer',
        kind: 'sheet',
        data: dataStr,
        snapshot: univerSnapshotToTableHtml(snap),
        meta: { updatedAt: Date.now(), engineVersion: '1.1.0' }
      };
      self.cached = env;
      return env;
    });
  };

  UniverBackend.prototype.getContent = function () { return this.cached; };

  UniverBackend.prototype.focus = function () {
    try { var cv = this.container.querySelector('canvas'); if (cv) cv.focus(); } catch (e) {}
  };

  UniverBackend.prototype.scrollToTop = function () {
    try { this.container.scrollTop = 0; } catch (e) {}
  };

  UniverBackend.prototype.destroy = function () {
    try { if (this.univerAPI && this.univerAPI.dispose) this.univerAPI.dispose(); } catch (e) {}
    if (this._cssLink && this._cssLink.parentNode) this._cssLink.parentNode.removeChild(this._cssLink);
    this.univerAPI = null;
    this.cached = null;
  };

  /* ===================== 工厂 ===================== */

  function create(kind, container) {
    if (isHttp()) return new OoBackend(kind, container);
    /* file://：doc 不走引擎（FE 保留轻量编辑器）；sheet 走 Univer，失败由 FE 降级轻量表格 */
    return new UniverBackend(kind, container);
  }

  root.EcEditor = {
    create: create,
    createOo: function (kind, container) { return new OoBackend(kind, container); },
    createUniver: function (kind, container) { return new UniverBackend(kind, container); },
    isHttp: isHttp,
    ooBase: ooBase,
    utils: { abToB64: abToB64, b64ToAb: b64ToAb, escapeHtml: escapeHtml, arrayToSnapshot: arrayToSnapshot }
  };
})(window);
