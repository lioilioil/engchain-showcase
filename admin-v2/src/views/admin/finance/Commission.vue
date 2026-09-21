<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">佣金管理</h1>
        <div class="page-view__sub">待结算佣金 / 已计提流水 / 违规扣罚（规则与订单管理同源）</div>
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

    <div class="tabs">
      <button class="tabs__item" :class="{ 'is-active': tab === 'pending' }" @click="setTab('pending')">待结算 <span v-if="pendingList.length" class="tag tag--yellow tabs__badge">{{ pendingList.length }}</span></button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'done' }" @click="setTab('done')">已计提流水</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'violations' }" @click="setTab('violations')">违规扣罚</button>
    </div>

    <div class="card table-card" v-if="tab === 'pending'">
      <el-table :data="pendingList" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="订单号" width="140" />
        <el-table-column prop="title" label="订单内容" min-width="240" />
        <el-table-column label="订单金额" width="130">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="应计佣金" width="130">
          <template #default="{ row }"><b class="num" style="color:var(--tag-text-blue)">¥{{ (calcFee(row)).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ row.milestone ? '里程碑分账' : '整单结算' }}</template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
    </div>

    <div class="card table-card" v-else-if="tab === 'done'">
      <el-table :data="doneList" v-loading="loading" stripe row-key="id">
        <el-table-column prop="orderId" label="订单号" width="140" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column label="佣金" width="130">
          <template #default="{ row }"><b class="num">¥{{ Number(row.fee || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column prop="agentName" label="归属代理" width="140" />
        <el-table-column label="计提时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
    </div>

    <div class="card table-card" v-else>
      <el-table :data="vioList" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="reason" label="违规原因" min-width="240" />
        <el-table-column label="扣罚金额" width="130">
          <template #default="{ row }"><b class="num" style="color:var(--tag-text-red)">-¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column prop="userName" label="责任人" width="140" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
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
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const loading = ref(false);
const pendingList = ref<any[]>([]);
const doneList = ref<any[]>([]);
const vioList = ref<any[]>([]);
const tab = ref<'pending' | 'done' | 'violations'>('pending');

function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function calcFee(row: any) { return bus()?.orderCalc ? bus().orderCalc(row.amount).fee : 0; }
function load() {
  pendingList.value = bus()?.settledPending ? bus().settledPending() : [];
  doneList.value = bus()?.commissionFlows ? bus().commissionFlows() : [];
  vioList.value = bus()?.violations ? bus().violations() : [];
  // Mock fallback
  if (!doneList.value.length) {
    doneList.value = [
      { id: 'CF-001', orderId: 'ORD-2024-001', userName: '张三', amount: 12000, fee: 600, ts: Date.now() - 86400000*3 },
      { id: 'CF-002', orderId: 'ORD-2024-002', userName: '李四', amount: 8500, fee: 425, ts: Date.now() - 86400000*5 },
      { id: 'CF-003', orderId: 'ORD-2024-003', userName: '王五', amount: 23000, fee: 1150, ts: Date.now() - 86400000*7 },
    ];
  }
  if (!vioList.value.length) {
    vioList.value = [
      { id: 'VIO-001', reason: '发布虚假供需信息', amount: 200, userName: '赵六', ts: Date.now() - 86400000*2 },
      { id: 'VIO-002', reason: '恶意竞价', amount: 500, userName: '钱七', ts: Date.now() - 86400000*4 },
    ];
  }
}
const kpis = computed(() => {
  const pendFee = pendingList.value.reduce((s, o) => s + calcFee(o), 0);
  const doneFee = doneList.value.reduce((s, o) => s + Number(o.fee || 0), 0);
  const vioAmt = vioList.value.reduce((s, o) => s + Number(o.amount || 0), 0);
  return [
    { label: '待结算订单', value: pendingList.value.length, hint: `应计佣金 ¥${pendFee.toFixed(2)}` },
    { label: '已计提佣金', value: `¥${doneFee.toFixed(2)}`, hint: `共 ${doneList.value.length} 笔` },
    { label: '违规扣罚', value: `¥${vioAmt.toFixed(2)}`, hint: `共 ${vioList.value.length} 笔` },
  ];
});
function setTab(t: 'pending' | 'done' | 'violations') { tab.value = t; }
onMounted(() => { load(); });
</script>

<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.table-card { padding: 0; overflow: hidden; }
.num { font-variant-numeric: tabular-nums; }
</style>
