<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">分销中心</div>
        <h1 class="page-view__title">团队管理</h1>
        <div class="page-view__sub">分销代理 / 团长 / 成员层级管理</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
      </div>
    </div>
    <div class="filter-bar card">
      <el-input v-model="q" placeholder="搜索代理 / 团长" size="small" clearable style="width:240px" />
      <button class="btn btn--tertiary btn--sm" @click="q = ''">重置</button>
    </div>
    <div class="card table-card">
      <el-table :data="filtered" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="代理 ID" width="120" />
        <el-table-column prop="name" label="姓名" width="140" />
        <el-table-column prop="parentName" label="上级" width="140" />
        <el-table-column label="层级" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.level === 1 ? 'tag--gold' : row.level === 2 ? 'tag--blue' : 'tag--gray'">
              L{{ row.level }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="下级数" width="90">
          <template #default="{ row }">{{ row.subCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="累计佣金" width="140">
          <template #default="{ row }"><b class="num">¥{{ Number(row.totalCommission || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.active ? 'tag--green' : 'tag--gray'">{{ row.active ? '活跃' : '休眠' }}</span>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const list = ref<any[]>([]);
const q = ref('');
function load() {
  list.value = (window as any).DistStore?.agents?.() || [];
  if (!list.value.length) {
    list.value = [
      { id: 'A001', name: '陈建国', level: '金牌', team: '成都建筑一队', sales: 450000, commission: 22500, status: 'active' },
      { id: 'A002', name: '李明', level: '银牌', team: '重庆中介团队', sales: 320000, commission: 16000, status: 'active' },
      { id: 'A003', name: '王芳', level: '金牌', team: '西安服务商组', sales: 680000, commission: 34000, status: 'active' },
    ];
  }
}
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return list.value;
  return list.value.filter((x: any) => `${x.name}${x.parentName}${x.id}`.toLowerCase().indexOf(s) >= 0);
});
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
.num { font-variant-numeric: tabular-nums; }
</style>
