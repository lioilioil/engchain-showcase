<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">风控中心</div>
        <h1 class="page-view__title">操作日志</h1>
        <div class="page-view__sub">后台关键操作审计日志</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
      </div>
    </div>
    <div class="filter-bar card">
      <el-input v-model="q" placeholder="搜索模块 / 操作人 / 内容" size="small" clearable style="width:260px" />
      <button class="btn btn--tertiary btn--sm" @click="q = ''">重置</button>
    </div>
    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="action" label="操作" width="140" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="detail" label="详情" min-width="240" />
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filtered.length"
          :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const q = ref('');
function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
function load() {
  list.value = (window as any).Admin?.logs?.() || [];
  if (!list.value.length) {
    list.value = [
      { id: 'LOG001', user: 'admin', action: '登录系统', ip: '192.168.1.100', ts: Date.now() - 86400000*1 },
      { id: 'LOG002', user: 'admin', action: '审核通过 订单 ORD-001', ip: '192.168.1.100', ts: Date.now() - 86400000*2 },
      { id: 'LOG003', user: 'operator01', action: '发放积分 100', ip: '192.168.1.105', ts: Date.now() - 86400000*3 },
    ];
  }
}
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return list.value;
  return list.value.filter((x: any) => `${x.module}${x.action}${x.operator}${x.detail}`.toLowerCase().indexOf(s) >= 0);
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
</style>
