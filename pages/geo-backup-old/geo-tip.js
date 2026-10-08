/* ============================================================================
   GEO 品牌雷达 · 术语 Tooltip 统一组件 (geo-tip.js)
   —— 零认知用户友好：专业术语旁显示「?」，点击弹大白话气泡；
      首次进入每页自动弹一次（localStorage engchain-geo-tip-read 去重）
   用法：9 页各引入一行 <script src="geo-tip.js"></script>（放在 geo-data.js 之后）
   挂点：元素加 data-tip="大白话"；组件还会自动扫描页面静态文本中
        GEO_DICT 收录的术语（跳过 script/style/动态容器）。
   ============================================================================ */
window.GEO_TIP = (function () {

  var READ_KEY = 'engchain-geo-tip-read';

  /* 术语词典：自动扫描用（key = 术语，value = 大白话） */
  var DICT = {
    'GEO 综合分': '综合 7 个 AI 引擎的提及、引用与推荐位算出的品牌得分（0-100）',
    'GEO': '让 AI 回答里提到你的品牌',
    '声量份额 SOV': '同行相关提问里，提到你品牌的回答占多少比例',
    'SOV': '声量份额：同行相关提问中，提到你品牌的回答占比',
    '提及率': 'AI 回答中真正提到你品牌的占比',
    '推荐位': 'AI 回答中推荐你品牌的先后位置，越靠前越好',
    '命中率': 'AI 回答中真正提到你品牌的次数占比',
    '引用来源': 'AI 回答内容参考了哪些网站',
    '意图热度': '这个词被用户搜得多不多，热度越高越值得做',
    '实体清晰度': 'AI 能不能清楚识别「你是谁、做什么」',
    '事实覆盖': '关于你品牌的信息全不全',
    '信源权威': '你的信息来源权威不权威',
    '信息一致性': '各平台关于你的说法是否一致',
    '内容新鲜度': '你的信息是不是最新的',
    '六大失语危机': 'AI 没替你说好话的 6 种常见情况',
    '引擎收录': 'AI 引擎是否把你的品牌信息收进知识',
    '知识库': '你的品牌信息档案，AI 回答时主要参考它',
    'schema.org': '一种网页标记规范，让 AI 更容易读懂你的网站',
    'Open Graph': '一种网页标签规范，让链接分享时展示更完整'
  };

  var css = '' +
    '.geo-tip-term{display:inline-flex;align-items:center;margin-left:2px;color:var(--primary-dim);cursor:help;}' +
    '.geo-tip-term svg{width:11px;height:11px;}' +
    '.geo-tip-bubble{position:fixed;z-index:9999;max-width:230px;background:#2b2318;color:#f5efe4;font-size:11px;line-height:1.6;padding:9px 11px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .18s,transform .18s;}' +
    '.geo-tip-bubble.show{opacity:1;transform:translateY(0);}' +
    '.geo-tip-bubble::after{content:"";position:absolute;left:18px;top:-5px;width:10px;height:10px;background:#2b2318;transform:rotate(45deg);border-radius:2px;}';

  var bubble = null;

  /* 样式表在脚本加载时即注入：避免已读记录存在时样式永不注入，
     导致术语「?」图标失去尺寸约束被放大（实测 324px 巨环） */
  function injectCss() {
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.className = 'geo-tip-bubble';
    document.body.appendChild(bubble);
    return bubble;
  }

  function showTip(text, x, y) {
    var b = ensureBubble();
    b.textContent = text;
    b.style.left = Math.max(8, Math.min(x - b.offsetWidth / 2, window.innerWidth - b.offsetWidth - 8)) + 'px';
    b.style.top = Math.max(8, Math.min(y + 14, window.innerHeight - b.offsetHeight - 8)) + 'px';
    requestAnimationFrame(function () { b.classList.add('show'); });
  }
  function hideTip() {
    if (bubble) bubble.classList.remove('show');
  }

  /* 已读去重 */
  function hasRead(key) {
    try {
      var raw = localStorage.getItem(READ_KEY);
      return raw && raw.split(',').indexOf(key) >= 0;
    } catch (e) { return true; }
  }
  function markRead(key) {
    try {
      var raw = localStorage.getItem(READ_KEY) || '';
      var arr = raw ? raw.split(',') : [];
      if (arr.indexOf(key) < 0) { arr.push(key); localStorage.setItem(READ_KEY, arr.join(',')); }
    } catch (e) {}
  }

  /* 事件委托：点击带 data-tip / .geo-tip-term 的元素弹气泡 */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-tip],.geo-tip-term') : null;
    if (!el) return;
    var text = el.getAttribute && el.getAttribute('data-tip');
    if (!text) return;
    var r = el.getBoundingClientRect();
    showTip(text, r.left + r.width / 2, r.bottom);
    markRead(el.getAttribute('data-tip-key') || text);
    setTimeout(hideTip, 3600);
  }, true);

  /* 自动扫描静态文本中的术语，挂可点击「?」 */
  function scanTerms(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('.geo-tip-term')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      if (!text || text.length < 2) return;
      var hit = null, idx = -1;
      Object.keys(DICT).forEach(function (term) {
        var i = text.indexOf(term);
        if (i >= 0 && (idx < 0 || i < idx)) { idx = i; hit = term; }
      });
      if (!hit) return;
      var span = document.createElement('span');
      span.innerHTML = '<span class="geo-tip-term" data-tip-key="' + hit + '" data-tip="' + DICT[hit] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v4M12 7.5h.01"/></svg></span>';
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(text.slice(0, idx + hit.length)));
      frag.appendChild(span);
      frag.appendChild(document.createTextNode(text.slice(idx + hit.length)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* 首次进入自动弹一次（只弹第一个未读术语） */
  function autoFirstTip() {
    var el = document.querySelector('[data-tip]');
    if (!el) return;
    var key = el.getAttribute('data-tip-key') || el.getAttribute('data-tip');
    if (hasRead(key)) return;
    var r = el.getBoundingClientRect();
    showTip(el.getAttribute('data-tip'), r.left + r.width / 2, r.bottom + 6);
    markRead(key);
    setTimeout(hideTip, 5000);
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    injectCss();
    scanTerms(document.body);
    setTimeout(autoFirstTip, 600);
  }
  init();

  return { scanTerms: scanTerms, autoFirstTip: autoFirstTip, showTip: showTip, hideTip: hideTip };
})();
