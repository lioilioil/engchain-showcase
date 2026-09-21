<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">中介中心</div>
        <h1 class="page-view__title">托管管理</h1>
        <div class="page-view__sub">资金托管池 · 托管订单 · 纠纷处理</div>
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
    <div class="card table-card">
      <el-table :data="list" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="托管单号" width="140" />
        <el-table-column prop="title" label="服务" min-width="200" />
        <el-table-column label="托管金额" width="140">
          <template #default="{ row }"><b class="num">¥{{ Number(row.escrowAmount || row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column prop="buyerName" label="甲方" width="120" />
        <el-table-column prop="sellerName" label="乙方" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="stClass(row.state)">{{ stLabel(row.state) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="row.state === 'disputed'" class="btn btn--primary btn--sm" @click="resolve(row)">仲裁</button>
              <button v-if="row.state === 'escrowed'" class="btn btn--secondary btn--sm" @click="release(row)">放款</button>
            </div>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const list = ref<any[]>([]);
const ST: Record<string, [string, string]> = {
  escrowed: ['已托管', 'tag--blue'], awaiting: ['待确认', 'tag--yellow'], disputed: ['纠纷中', 'tag--red'],
  released: ['已放款', 'tag--green'], refunded: ['已退款', 'tag--gray'],
};
const stLabel = (s: string) => ST[s]?.[0] || s;
const stClass = (s: string) => ST[s]?.[1] || 'tag--gray';
function load() { list.value = (window as any).Mediation?.list?.() || []; }
const kpis = computed(() => {
  let escrowed = 0, disputed = 0, amount = 0;
  list.value.forEach((x: any) => {
    if (x.state === 'escrowed') { escrowed++; amount += Number(x.escrowAmount || x.amount || 0); }
    if (x.state === 'disputed') disputed++;
  });
  return [
    { label: '在管托管', value: escrowed, hint: `池内 ¥${amount.toFixed(2)}` },
    { label: '纠纷中', value: disputed, hint: '需仲裁' },
  ];
});
function resolve(row: any) {
  ElMessageBox.prompt('仲裁结果（放款金额说明）', '纠纷仲裁', { inputPlaceholder: '如：放款乙方 100%' }).then(({ value }) => {
    (window as any).Mediation?.resolveDispute?.(row.id, value);
    ElMessage.success('已仲裁'); load();
  }).catch(() => {});
}
function release(row: any) {
  ElMessageBox.confirm('确认放款给乙方？', '托管放款', { type: 'info' }).then(() => {
    (window as any).Mediation?.releaseEscrow?.(row.id);
    ElMessage.success('已放款'); load();
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
.table-card { padding: 0; overflow: hidden; }
.num { font-variant-numeric: tabular-nums; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
</style>
