/* ============================================================
   FileDownload — 文件下载与缓存查看管理器
   - 两种进度 UI：卡片边框进度环 / 内侧环形进度
   - 状态：pending → downloading → paused / completed / failed
   - 缓存持久化 localStorage，已缓存文件可直接查看
   ============================================================ */
(function () {
  var STORAGE_KEY = 'engchain-downloads';
  var SPEED_BASE = 2.5; // MB/s 基准速度，用于模拟

  /* ---- 缓存读写 ---- */
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveAll(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function getRecord(id) { return loadAll()[id] || null; }
  function setRecord(id, rec) {
    var map = loadAll();
    map[id] = rec;
    saveAll(map);
  }

  /* ---- 工具：文件大小格式化 ---- */
  function fmtSize(kb) {
    if (kb < 1024) return Math.round(kb) + 'KB';
    return (kb / 1024).toFixed(1) + 'MB';
  }
  function fmtEta(seconds) {
    if (seconds <= 0) return '即将完成';
    if (seconds < 60) return '剩余' + Math.ceil(seconds) + '秒';
    return '剩余' + Math.ceil(seconds / 60) + '分钟';
  }
  function fmtSpeed(mbps) {
    if (mbps < 1) return Math.round(mbps * 1024) + 'KB/s';
    return mbps.toFixed(2) + 'MB/s';
  }

  /* ---- 文件类型图标 ---- */
  function typeIcon(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    var colors = {
      pdf: { bg: 'linear-gradient(135deg,#e74c3c,#c0392b)', label: 'PDF' },
      doc: { bg: 'linear-gradient(135deg,#3498db,#2980b9)', label: 'W' },
      docx: { bg: 'linear-gradient(135deg,#3498db,#2980b9)', label: 'W' },
      xls: { bg: 'linear-gradient(135deg,#27ae60,#1e8449)', label: 'X' },
      xlsx: { bg: 'linear-gradient(135deg,#27ae60,#1e8449)', label: 'X' },
      ppt: { bg: 'linear-gradient(135deg,#e67e22,#d35400)', label: 'P' },
      pptx: { bg: 'linear-gradient(135deg,#e67e22,#d35400)', label: 'P' },
      zip: { bg: 'linear-gradient(135deg,#9b59b6,#8e44ad)', label: 'Z' },
      txt: { bg: 'linear-gradient(135deg,#7f8c8d,#616a6b)', label: 'T' }
    };
    var c = colors[ext] || { bg: 'linear-gradient(135deg,#5dade2,#2e86c1)', label: ext.slice(0, 2).toUpperCase() || 'F' };
    return '<div class="fd-icon" style="background:' + c.bg + ';"><span>' + c.label + '</span></div>';
  }

  /* ============================================================
     ① 卡片边框进度环（参考图形态1）
     整卡边框随进度填充，布局均衡
     ============================================================ */
  function renderCardRing(opts) {
    var id = opts.id, name = opts.name, size = opts.size || 2048;
    var rec = getRecord(id);
    var progress = rec ? rec.progress : 0;
    var status = rec ? rec.status : 'idle';
    var speed = rec ? rec.speed : 0;
    var eta = rec && rec.speed > 0 ? (size / 1024) / rec.speed : 0;

    var borderGrad = 'linear-gradient(90deg, var(--success) ' + progress + '%, var(--line) ' + progress + '%)';

    var statusHtml = '';
    if (status === 'downloading') {
      statusHtml = '<div class="fd-meta">' + fmtSize(size) + ' · ' + fmtEta(eta) + ' · ' + fmtSpeed(speed) + '</div>' +
        '<div class="fd-actions"><button class="fd-btn pause" data-fd-action="pause" data-fd-id="' + id + '">暂停</button></div>';
    } else if (status === 'paused') {
      statusHtml = '<div class="fd-meta fd-paused">已暂停 · ' + progress + '%</div>' +
        '<div class="fd-actions"><button class="fd-btn resume" data-fd-action="resume" data-fd-id="' + id + '">继续</button><button class="fd-btn cancel" data-fd-action="cancel" data-fd-id="' + id + '">取消</button></div>';
    } else if (status === 'completed') {
      statusHtml = '<div class="fd-meta fd-cached"><span class="fd-cache-badge">已缓存</span> ' + fmtSize(size) + '</div>' +
        '<div class="fd-actions"><button class="fd-btn view" data-fd-action="view" data-fd-id="' + id + '">查看</button><button class="fd-btn remove" data-fd-action="remove" data-fd-id="' + id + '">移除</button></div>';
    } else if (status === 'failed') {
      statusHtml = '<div class="fd-meta fd-failed">下载失败</div>' +
        '<div class="fd-actions"><button class="fd-btn retry" data-fd-action="retry" data-fd-id="' + id + '">重试</button></div>';
    } else {
      statusHtml = '<div class="fd-meta">' + fmtSize(size) + '</div>' +
        '<div class="fd-actions"><button class="fd-btn download" data-fd-action="download" data-fd-id="' + id + '">下载</button></div>';
    }

    return '<div class="fd-card-ring" data-fd-id="' + id + '" data-fd-name="' + name.replace(/"/g, '&quot;') + '" data-fd-size="' + size + '" style="background-image:' + borderGrad + ';">' +
      '<div class="fd-card-inner">' +
        typeIcon(name) +
        '<div class="fd-card-body">' +
        '<div class="fd-name">' + name + '</div>' +
        statusHtml +
        '</div></div></div>';
  }

  /* ============================================================
     ② 内侧进度环（参考图形态2）
     左侧文件信息，右侧 SVG 环形进度 + 百分比 + 速度
     ============================================================ */
  function renderInnerRing(opts) {
    var id = opts.id, name = opts.name, size = opts.size || 2048, sub = opts.sub || '';
    var rec = getRecord(id);
    var progress = rec ? rec.progress : 0;
    var status = rec ? rec.status : 'idle';
    var speed = rec ? rec.speed : 0;

    var R = 18, C = 2 * Math.PI * R;
    var offset = C * (1 - progress / 100);
    var ringColor = status === 'completed' ? 'var(--success)' : (status === 'failed' ? 'var(--error)' : 'var(--primary)');

    var rightHtml = '';
    if (status === 'downloading' || status === 'paused') {
      rightHtml = '<div class="fd-ring-wrap">' +
        '<svg class="fd-ring" viewBox="0 0 44 44">' +
        '<circle class="fd-ring-bg" cx="22" cy="22" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="3.5"/>' +
        '<circle class="fd-ring-fg" cx="22" cy="22" r="' + R + '" fill="none" stroke="' + ringColor + '" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 22 22)"/>' +
        '</svg>' +
        '<div class="fd-ring-text"><span class="fd-pct">' + Math.round(progress) + '%</span>' +
        (status === 'downloading' ? '<span class="fd-speed">' + fmtSpeed(speed) + '</span>' : '<span class="fd-speed">已暂停</span>') +
        '</div></div>';
    } else if (status === 'completed') {
      rightHtml = '<div class="fd-ring-wrap">' +
        '<svg class="fd-ring" viewBox="0 0 44 44">' +
        '<circle class="fd-ring-bg" cx="22" cy="22" r="' + R + '" fill="none" stroke="var(--success-soft, #d5f5e3)" stroke-width="3.5"/>' +
        '<circle class="fd-ring-fg" cx="22" cy="22" r="' + R + '" fill="none" stroke="var(--success)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0" transform="rotate(-90 22 22)"/>' +
        '</svg>' +
        '<div class="fd-ring-text"><span class="fd-pct fd-cached-pct">已缓存</span></div></div>';
    } else if (status === 'failed') {
      rightHtml = '<div class="fd-ring-wrap"><div class="fd-failed-text">失败</div></div>';
    } else {
      rightHtml = '<button class="fd-btn download" data-fd-action="download" data-fd-id="' + id + '">下载</button>';
    }

    return '<div class="fd-inner-ring" data-fd-id="' + id + '" data-fd-name="' + name.replace(/"/g, '&quot;') + '" data-fd-size="' + size + '">' +
      typeIcon(name) +
      '<div class="fd-inner-body">' +
      '<div class="fd-name">' + name + '</div>' +
      '<div class="fd-sub">' + (sub || fmtSize(size)) + '</div>' +
      '</div>' +
      '<div class="fd-inner-right">' + rightHtml + '</div>' +
      '</div>';
  }

  /* ============================================================
     下载引擎（模拟）
     ============================================================ */
  var timers = {};

  function startDownload(id, name, size) {
    var rec = getRecord(id) || { id: id, name: name, size: size, progress: 0, status: 'downloading', speed: 0, createdAt: Date.now() };
    rec.status = 'downloading';
    rec.speed = SPEED_BASE * (0.6 + Math.random() * 0.8);
    setRecord(id, rec);

    if (timers[id]) clearInterval(timers[id]);
    timers[id] = setInterval(function () {
      var r = getRecord(id);
      if (!r || r.status !== 'downloading') { clearInterval(timers[id]); return; }
      // 每次推进 1.5%~4%
      var step = 1.5 + Math.random() * 2.5;
      r.progress = Math.min(100, r.progress + step);
      r.speed = SPEED_BASE * (0.6 + Math.random() * 0.8);
      if (r.progress >= 100) {
        r.progress = 100;
        r.status = 'completed';
        r.completedAt = Date.now();
        clearInterval(timers[id]);
      }
      setRecord(id, r);
      refreshUI(id);
    }, 300);
    refreshUI(id);
  }

  function pauseDownload(id) {
    var r = getRecord(id);
    if (!r) return;
    r.status = 'paused';
    setRecord(id, r);
    if (timers[id]) clearInterval(timers[id]);
    refreshUI(id);
  }

  function resumeDownload(id) {
    var r = getRecord(id);
    if (!r) return;
    startDownload(id, r.name, r.size);
  }

  function cancelDownload(id) {
    if (timers[id]) clearInterval(timers[id]);
    var map = loadAll();
    delete map[id];
    saveAll(map);
    refreshUI(id);
  }

  function removeCache(id) {
    if (timers[id]) clearInterval(timers[id]);
    var map = loadAll();
    delete map[id];
    saveAll(map);
    refreshUI(id);
  }

  function retryDownload(id) {
    var r = getRecord(id);
    if (!r) return;
    r.progress = 0;
    setRecord(id, r);
    startDownload(id, r.name, r.size);
  }

  /* ---- UI 刷新：更新所有同 id 的进度组件 ---- */
  function refreshUI(id) {
    var nodes = document.querySelectorAll('[data-fd-id="' + id + '"]');
    nodes.forEach(function (node) {
      var name = node.dataset.fdName || '';
      var size = parseInt(node.dataset.fdSize) || 2048;
      var isCard = node.classList.contains('fd-card-ring');
      var sub = node.dataset.fdSub || '';
      var newHtml = isCard ? renderCardRing({ id: id, name: name, size: size }) : renderInnerRing({ id: id, name: name, size: size, sub: sub });
      var temp = document.createElement('div');
      temp.innerHTML = newHtml;
      var newNode = temp.firstChild;
      if (node.parentNode) node.parentNode.replaceChild(newNode, node);
    });
  }

  /* ---- 全局事件委托 ---- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fd-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var id = btn.dataset.fdId;
    var action = btn.dataset.fdAction;
    var node = btn.closest('[data-fd-id]');
    var name = node ? node.dataset.fdName : id;
    var size = node ? parseInt(node.dataset.fdSize) || 2048 : 2048;

    switch (action) {
      case 'download': startDownload(id, name, size); break;
      case 'pause': pauseDownload(id); break;
      case 'resume': resumeDownload(id); break;
      case 'cancel': cancelDownload(id); break;
      case 'remove': removeCache(id); break;
      case 'retry': retryDownload(id); break;
      case 'view':
        var rec = getRecord(id);
        if (rec && rec.status === 'completed') {
          if (window.FileDownload && window.FileDownload.onView) {
            window.FileDownload.onView(rec);
          } else {
            UI.toast('打开已缓存文件：' + rec.name, 'ok');
          }
        }
        break;
    }
  });

  /* ---- 恢复进行中的下载（页面刷新后继续） ---- */
  function resumePending() {
    var map = loadAll();
    Object.keys(map).forEach(function (id) {
      var r = map[id];
      if (r.status === 'downloading') startDownload(id, r.name, r.size);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resumePending);
  } else {
    resumePending();
  }

  /* ============================================================
     对外 API
     ============================================================ */
  window.FileDownload = {
    renderCardRing: renderCardRing,
    renderInnerRing: renderInnerRing,
    start: startDownload,
    pause: pauseDownload,
    resume: resumeDownload,
    cancel: cancelDownload,
    remove: removeCache,
    retry: retryDownload,
    get: getRecord,
    getAll: loadAll,
    clearAll: function () { saveAll({}); },
    onView: null // 外部可注入查看回调
  };
})();
