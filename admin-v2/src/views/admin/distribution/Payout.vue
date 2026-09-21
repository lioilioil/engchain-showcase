<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">分销中心</div>
        <h1 class="page-view__title">分销结算</h1>
        <div class="page-view__sub">分销佣金结算单审核与打款</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
      </div>
    </div>
    <div class="kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__value">{{ k.value }}</div>
        <div class="kpi__hint">{{ k.hint }}</div>
      </div>
    </div>
    <div class="filter-bar card">
      <el-select v-model="filter.status" placeholder="状态" clearable size="small" style="width:120px" @change="onFilter">
        <el-option label="待结算" value="pending" />
        <el-option label="已打款" value="paid" />
      </el-select>
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>
    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="结算单号" width="140" />
        <el-table-column prop="agentName" label="代理" min-width="160" />
        <el-table-column label="佣金金额" width="140">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="周期" width="120">
          <template #default="{ row }">{{ row.period || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.status === 'paid' ? 'tag--green' : 'tag--yellow'">{{ row.status === 'paid' ? '已打款' : '待结算' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="row.status !== 'paid'" class="btn btn--primary btn--sm" @click="doPay(row)">打款</button>
            </div>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filtered.length"
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next" @size-change="onFilter" @current-change="onFilter" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(15);
const filter = reactive({ status: '' });
function load() {
  list.value = (window as any).DistStore?.payouts?.() || [];
  if (!list.value.length) {
    list.value = [
      { id: 'P001', agent: '陈建国', period: '2024-08', amount: 22500, status: 'paid', ts: Date.now() - 86400000*10 },
      { id: 'P002', agent: '李明', period: '2024-08', amount: 16000, status: 'pending', ts: Date.now() - 86400000*3 },
      { id: 'P003', agent: '王芳', period: '2024-08', amount: 34000, status: 'paid', ts: Date.now() - 86400000*12 },
    ];
  }
}
const filtered = computed(() => list.value.filter((x: any) => !filter.status || x.status === filter.status));
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const kpis = computed(() => {
  let pending = 0, paid = 0, pendingAmt = 0;
  list.value.forEach((x: any) => {
    if (x.status === 'paid') paid++; else { pending++; pendingAmt += Number(x.amount || 0); }
  });
  return [
    { label: '待结算', value: pending, hint: `¥${pendingAmt.toFixed(2)}` },
    { label: '已打款', value: paid, hint: '完成' },
  ];
});
function onFilter() { page.value = 1; }
function onReset() { filter.status = ''; page.value = 1; }
function doPay(row: any) {
  ElMessageBox.confirm('确认已打款？', '结算打款', { type: 'info' }).then(() => {
    (window as any).DistStore?.payPayout?.(row.id);
    ElMessage.success('已打款');
    load();
  }).catch(() => {});
}
onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.num { font-variant-numeric: tabular-nums; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
</style>
