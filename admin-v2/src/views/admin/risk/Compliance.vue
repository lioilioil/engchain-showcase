<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">风控中心</div>
        <h1 class="page-view__title">合规台账</h1>
        <div class="page-view__sub">已通过 / 已驳回资质全量记录</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
      </div>
    </div>
    <div class="filter-bar card">
      <el-select v-model="filter.status" placeholder="状态" clearable size="small" style="width:120px" @change="page = 1">
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-input v-model="q" placeholder="搜索名称" size="small" clearable style="width:200px" />
    </div>
    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="申请 ID" width="120" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="materialType" label="材料" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="row.status === 'approved' ? 'tag--green' : 'tag--red'">{{ row.status === 'approved' ? '已通过' : '已驳回' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reviewer" label="审核人" width="120" />
        <el-table-column label="审核时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.reviewedAt) }}</template>
        </el-table-column>
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
import { ref, reactive, computed, onMounted } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const filter = reactive({ status: '' });
const q = ref('');
function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function load() {
  list.value = (window as any).DataBus?.complianceAudits?.() || [];
  if (!list.value.length) {
    list.value = [
      { id: 'CA001', user: '陈建国', type: '营业执照', status: 'approved', ts: Date.now() - 86400000*5 },
      { id: 'CA002', user: '李明', type: '资质证书', status: 'pending', ts: Date.now() - 86400000*2 },
      { id: 'CA003', user: '王芳', type: '实名认证', status: 'rejected', ts: Date.now() - 86400000*7 },
    ];
  }
}
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return list.value.filter((x: any) => {
    if (filter.status && x.status !== filter.status) return false;
    if (s && `${x.name}${x.id}`.toLowerCase().indexOf(s) < 0) return false;
    return true;
  });
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
