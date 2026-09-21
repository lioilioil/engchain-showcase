<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">中介中心</div>
        <h1 class="page-view__title">中介订单</h1>
        <div class="page-view__sub">中介撮合订单全量列表（与订单管理联动）</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
      </div>
    </div>
    <div class="card table-card">
      <el-table :data="list" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="订单号" width="140" />
        <el-table-column prop="title" label="服务内容" min-width="220" />
        <el-table-column prop="agencyName" label="中介" width="140" />
        <el-table-column label="金额" width="130">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="中介费" width="120">
          <template #default="{ row }"><b class="num">¥{{ Number(row.fee || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="row.state === 'done' ? 'tag--green' : row.state === 'disputed' ? 'tag--red' : 'tag--yellow'">
              {{ row.state === 'done' ? '完成' : row.state === 'disputed' ? '纠纷' : '进行中' }}
            </span>
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
import { ref, onMounted } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const list = ref<any[]>([]);
function load() { list.value = (window as any).Mediation?.orders?.() || (window as any).Mediation?.list?.() || []; }
onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.table-card { padding: 0; overflow: hidden; }
.num { font-variant-numeric: tabular-nums; }
</style>
