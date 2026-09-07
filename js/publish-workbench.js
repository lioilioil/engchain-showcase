/* 工程链：发布信息工作台演示状态层 */
/* 完整结构化字段 + 发布信息详情解析(sourceId/id) + 变更事件通知 */
window.PublishStore = (function () {
  var KEY = 'engchain-publish';
  var STATUS = {
    draft: '草稿',
    review: '审核中',
    active: '已发布',
    paused: '已暂停',
    expired: '已过期'
  };
  /* 发布信息条目缺省字段（保证详情渲染器 / 记录卡片永远拿到完整结构，不出现 undefined） */
  function recordDefaults(r) {
    return Object.assign({
      id: '', sourceId: '', role: 'demand', title: '未命名信息', category: '材料',
      subType: '', location: '', unit: '', price: '', qty: '', spec: '',
      delivery: '', qualification: '', description: '', tags: [],
      contact: { name: '', phone: '', wechat: '' },
      company: '', address: '', status: 'review', views: 0, matches: 0, inquiries: 0, match: 0,
      updatedAt: ''
    }, r || {});
  }
  var seed = {
    version: 1,
    drafts: [
      { id: 'd-demo-1', role: 'demand', title: '急需市政道路防撞护栏供应商', category: '材料', completion: 72, updatedAt: '2026-09-02 16:40', missing: '补充交货周期与验收标准' }
    ],
    records: [
      { id: 'p-demo-1', sourceId: 1001, role: 'demand', title: '成都天府新区商业综合体项目 急需商品混凝土C30/C40', category: '材料', subType: '商品混凝土', location: '成都市·天府新区', unit: '方', price: '1350000', status: 'active', views: 342, matches: 8, inquiries: 2, updatedAt: '今天 09:20' },
      { id: 'p-demo-2', sourceId: 1003, role: 'supply', title: '供应盘扣式脚手架/钢管租赁 西南地区自营仓库', category: '设备', subType: '盘扣脚手架', location: '成都市·青白江', unit: '吨/天', price: '0.32', status: 'review', views: 86, matches: 3, inquiries: 0, updatedAt: '昨天 18:05' }
    ]
  };
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function read() {
    try {
      var value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && value.version === 1) {
        value.drafts = (value.drafts || []).filter(function (draft) { return draft && draft.id; });
        value.records = (value.records || []).map(recordDefaults);
        return value;
      }
    } catch (e) {}
    return clone(seed);
  }
  function write(value) {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('publish:change', { detail: value })); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  /* 解析发布信息详情：优先按 id，其次按 sourceId（兼容 seed 目录条目 id） */
  function recordById(idValue) {
    var value = read();
    for (var i = 0; i < value.records.length; i++) {
      var r = value.records[i];
      if (String(r.id) === String(idValue) || String(r.sourceId) === String(idValue)) return r;
    }
    return null;
  }
  function saveDraft(draft) {
    var value = read();
    var next = Object.assign({ id: 'd-' + Date.now(), role: 'demand', category: '材料', title: '', completion: 0, missing: '尚未填写' }, draft, { updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) });
    if (!next.id) next.id = 'd-' + Date.now();
    value.drafts = value.drafts.filter(function (item) { return item.id !== next.id; });
    value.drafts.unshift(next);
    return write(value) ? next : null;
  }
  function addRecord(record) {
    var value = read();
    var id = 'p-' + Date.now();
    var next = recordDefaults(Object.assign({ id: id, sourceId: id, status: 'review', views: 0, matches: 0, inquiries: 0 }, record));
    value.records.unshift(next);
    return write(value) ? next : null;
  }
  function removeDraft(id) {
    if (!id) return;
    var value = read();
    value.drafts = value.drafts.filter(function (item) { return item.id !== id; });
    write(value);
  }
  function updateRecord(id, patch) {
    var value = read();
    value.records = value.records.map(function (item) {
      if (item.id !== id) return item;
      var next = Object.assign({}, item, patch);
      /* 保持 id/sourceId 一致，编辑后详情解析仍可达 */
      if (patch.sourceId == null && item.sourceId == null) next.sourceId = item.id;
      return next;
    });
    return write(value) ? value : null;
  }
  /* 汇总：workbench 计数 / 待处理 / 自定义事件状态 */
  function stats() {
    var value = read();
    var active = value.records.filter(function (r) { return r.status === 'active'; }).length;
    var matches = value.records.reduce(function (s, r) { return s + (r.matches || 0); }, 0);
    var inquiries = value.records.reduce(function (s, r) { return s + (r.inquiries || 0); }, 0);
    var pending = value.records.filter(function (r) { return r.status === 'review' || (r.inquiries || 0) > 0; });
    return {
      records: value.records, drafts: value.drafts,
      active: active, matches: matches, inquiries: inquiries,
      pendingCount: pending.length, pending: pending
    };
  }
  return {
    STATUS: STATUS,
    get: read,
    getRecordById: recordById,
    saveDraft: saveDraft,
    addRecord: addRecord,
    removeDraft: removeDraft,
    save: write,
    updateRecord: updateRecord,
    stats: stats,
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
