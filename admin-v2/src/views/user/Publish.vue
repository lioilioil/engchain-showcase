<template>
  <div class="u-publish">
    <div class="u-publish__head">
      <h1 class="u-publish__title">发布供需</h1>
      <div class="u-publish__sub">填写供需信息，发布后将进入平台审核流程。</div>
    </div>

    <div class="publish-form card">
      <div class="form-row">
        <label class="form-label">类型</label>
        <div class="form-tabs">
          <button class="form-tab" :class="{ 'is-active': form.dir === 'supply' }" @click="form.dir = 'supply'">供应</button>
          <button class="form-tab" :class="{ 'is-active': form.dir === 'demand' }" @click="form.dir = 'demand'">需求</button>
        </div>
      </div>

      <div class="form-row">
        <label class="form-label">标题 *</label>
        <input v-model="form.title" class="text-input" placeholder="一句话描述你的供需" maxlength="60" />
      </div>

      <div class="form-row">
        <label class="form-label">品类</label>
        <select v-model="form.cat" class="text-input">
          <option value="">请选择品类</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div class="form-row">
        <label class="form-label">预算/报价</label>
        <input v-model="form.amount" class="text-input" type="number" placeholder="金额（元）" />
      </div>

      <div class="form-row">
        <label class="form-label">地区</label>
        <input v-model="form.location" class="text-input" placeholder="如：成都" />
      </div>

      <div class="form-row form-row--col">
        <label class="form-label">详细描述（支持 Markdown）</label>
        <div class="md-editor">
          <div class="md-toolbar">
            <button class="icon-btn" @click="insert('**', '**')" title="加粗"><b>B</b></button>
            <button class="icon-btn" @click="insert('*', '*')" title="斜体"><i>I</i></button>
            <button class="icon-btn" @click="insert('## ', '')" title="标题">H2</button>
            <button class="icon-btn" @click="insert('- ', '')" title="列表">•</button>
            <button class="icon-btn" @click="insert('[', '](https://)')" title="链接">🔗</button>
            <button class="icon-btn" @click="insert('```\n', '\n```')" title="代码">&lt;/&gt;</button>
            <div class="md-toolbar__spacer" />
            <button class="btn btn--sm" :class="mode === 'edit' ? 'btn--primary' : 'btn--tertiary'" @click="mode = 'edit'">编辑</button>
            <button class="btn btn--sm" :class="mode === 'preview' ? 'btn--primary' : 'btn--tertiary'" @click="mode = 'preview'">预览</button>
          </div>
          <textarea
            v-if="mode === 'edit'"
            v-model="form.desc"
            class="md-textarea"
            placeholder="支持 Markdown 语法：&#10;# 标题&#10;**加粗**&#10;- 列表项"
          />
          <div v-else class="md-preview" v-html="renderedMarkdown" />
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn--secondary" @click="onReset">重置</button>
        <button class="btn btn--primary" @click="onSubmit" :disabled="!form.title.trim()">发布</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const mode = ref<'edit' | 'preview'>('edit');
const categories = ['设计', '开发', '营销', '咨询', '制造', '采购', '物流', '其他'];

const form = reactive({
  dir: 'supply' as 'supply' | 'demand',
  title: '',
  cat: '',
  amount: '',
  location: '',
  desc: '',
});

function insert(before: string, after: string) {
  // 简单实现：在 textarea 末尾追加
  form.desc += before + after;
}

// 简易 Markdown 渲染（不依赖外部库）
const renderedMarkdown = computed(() => {
  let html = form.desc
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>');
  return html;
});

function onReset() {
  Object.assign(form, { dir: 'supply', title: '', cat: '', amount: '', location: '', desc: '' });
}

function onSubmit() {
  if (!form.title.trim()) return;
  const cur = bus()?.current?.();
  bus()?.publishSupply?.({
    dir: form.dir,
    title: form.title,
    cat: form.cat,
    amount: Number(form.amount) || 0,
    location: form.location,
    desc: form.desc,
    publisher: cur?.name || '匿名',
    ts: Date.now(),
  });
  alert('发布成功，等待审核');
  onReset();
}
</script>

<style scoped>
.u-publish { max-width: 720px; }
.u-publish__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.u-publish__sub { font-size: var(--font-size-md); color: var(--font-tertiary); margin: 4px 0 20px; }
.publish-form { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-row--col { flex-direction: column; align-items: stretch; }
.form-label { width: 100px; font-size: var(--font-size-md); color: var(--font-secondary); flex-shrink: 0; }
.form-tabs { display: flex; gap: 4px; }
.form-tab {
  padding: 6px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-medium); background: var(--bg-primary);
  color: var(--font-secondary); font-size: var(--font-size-md); cursor: pointer;
}
.form-tab.is-active { background: var(--color-blue); color: #fff; border-color: var(--color-blue); }
.text-input {
  flex: 1; height: 32px; padding: 0 10px;
  border: 1px solid var(--border-medium); border-radius: var(--radius-sm);
  background: var(--bg-primary); color: var(--font-primary); font-size: var(--font-size-md);
}
.text-input:focus { outline: none; border-color: var(--color-blue); box-shadow: 0 0 0 3px rgba(25,97,237,0.1); }
.md-editor { border: 1px solid var(--border-medium); border-radius: var(--radius-sm); overflow: hidden; }
.md-toolbar {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px;
  border-bottom: 1px solid var(--border-light); background: var(--bg-secondary);
}
.md-toolbar__spacer { flex: 1; }
.md-textarea {
  width: 100%; min-height: 240px; padding: 12px;
  border: none; background: var(--bg-primary); color: var(--font-primary);
  font-family: monospace; font-size: 13px; resize: vertical;
}
.md-textarea:focus { outline: none; }
.md-preview { min-height: 240px; padding: 12px; line-height: 1.6; }
.md-preview :deep(h1) { font-size: 20px; margin: 12px 0; }
.md-preview :deep(h2) { font-size: 17px; margin: 10px 0; }
.md-preview :deep(h3) { font-size: 15px; margin: 8px 0; }
.md-preview :deep(pre) { background: var(--bg-secondary); padding: 8px; border-radius: 4px; overflow-x: auto; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
</style>
