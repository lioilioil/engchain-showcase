<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">营收分析</h1>
        <div class="page-view__sub">平台营收总览 · 收入构成 · 月度趋势</div>
      </div>
    </div>

    <div class="kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__value">{{ k.value }}</div>
        <div class="kpi__hint">{{ k.hint }}</div>
      </div>
    </div>

    <div class="card chart-card">
      <div class="chart-title">近 12 个月营收趋势</div>
      <div v-if="trend.length" class="chart-bars">
        <div v-for="(t, i) in trend" :key="i" class="bar-col">
          <div class="bar-values"><span>{{ Number(t.amount || 0).toFixed(0) }}</span></div>
          <div class="bar-track">
            <div class="bar" :style="{ height: Math.max(2, Math.round(Number(t.amount || 0) / max * 140)) + 'px' }" />
          </div>
          <div class="bar-label">{{ t.month }}</div>
        </div>
      </div>
      <div v-else class="chart-empty">暂无数据</div>
    </div>

    <div class="card table-card">
      <div class="card-title">收入构成</div>
      <el-table :data="streams" v-loading="loading" stripe>
        <el-table-column prop="name" label="收入项" min-width="180" />
        <el-table-column label="金额" width="160">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="占比" width="120">
          <template #default="{ row }">
            <el-progress :percentage="totalAmount ? Math.round(row.amount / totalAmount * 100) : 0" :stroke-width="6" />
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
import EmptyState from '@/components/EmptyState.vue';

const loading = ref(false);
const summary = ref<any>({});
const streams = ref<any[]>([]);
const trend = ref<any[]>([]);

function fmtMoney(n: any) { return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function load() {
  const rs = (window as any).RevenueStore;
  if (false) {
    summary.value = rs.generate() || {};
    streams.value = rs.byStream() || [];
    trend.value = rs.trend() || [];
  }
  // Mock fallback
  if (!trend.value.length) {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: (d.getMonth()+1) + '月', amount: Math.round(50000 + Math.random() * 150000) });
    }
    trend.value = months;
  }
  if (!streams.value.length) {
    streams.value = [
      { name: '订单佣金', amount: 320000 },
      { name: '服务费', amount: 180000 },
      { name: '认证费', amount: 95000 },
      { name: '增值服务', amount: 68000 },
      { name: '其他', amount: 22000 },
    ];
  }
  if (!summary.value.total) {
    summary.value = { total: 685000, month: 86500, commission: 320000, serviceFee: 180000 };
  }
}
const totalAmount = computed(() => streams.value.reduce((s, x) => s + Number(x.amount || 0), 0));
const max = computed(() => Math.max(1, ...trend.value.map((t) => t.amount)));
const kpis = computed(() => [
  { label: '累计营收', value: fmtMoney(summary.value.total), hint: '平台总收入' },
  { label: '本月营收', value: fmtMoney(summary.value.month), hint: '自然月' },
  { label: '订单佣金', value: fmtMoney(summary.value.commission), hint: '抽成收入' },
  { label: '服务费', value: fmtMoney(summary.value.serviceFee), hint: '增值服务' },
]);
onMounted(() => { load(); });
</script>

<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.chart-card { padding: 16px; }
.chart-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-secondary); margin-bottom: 12px; }
.chart-bars { display: flex; gap: 8px; align-items: flex-end; height: 200px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.bar-values { font-size: 11px; color: var(--font-tertiary); }
.bar-track { display: flex; align-items: flex-end; height: 140px; }
.bar { width: 20px; border-radius: 2px; background: var(--tag-bg-blue); }
.bar-label { font-size: 11px; color: var(--font-tertiary); }
.chart-empty { text-align: center; padding: 40px; color: var(--font-tertiary); }
.table-card { padding: 16px; }
.card-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-secondary); margin-bottom: 12px; }
.num { font-variant-numeric: tabular-nums; }
</style>
