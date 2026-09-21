<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">用户中心</div>
        <h1 class="page-view__title">我的财务</h1>
        <div class="page-view__sub">钱包余额 · 充值 · 提现 · 收支明细</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--primary" @click="recharge">充值</button>
        <button class="btn btn--secondary" @click="withdraw">提现</button>
      </div>
    </div>

    <div class="kpis">
      <div class="card kpi">
        <div class="kpi__label">可用余额</div>
        <div class="kpi__value num">¥{{ balance.toFixed(2) }}</div>
        <div class="kpi__hint">可用于支付订单</div>
      </div>
      <div class="card kpi">
        <div class="kpi__label">冻结金额</div>
        <div class="kpi__value num">¥{{ frozen.toFixed(2) }}</div>
        <div class="kpi__hint">托管中订单</div>
      </div>
      <div class="card kpi">
        <div class="kpi__label">累计收入</div>
        <div class="kpi__value num">¥{{ totalIncome.toFixed(2) }}</div>
        <div class="kpi__hint">历史累计</div>
      </div>
      <div class="card kpi">
        <div class="kpi__label">积分</div>
        <div class="kpi__value">{{ credits }}</div>
        <div class="kpi__hint">可兑换优惠券</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tabs__item" :class="{ 'is-active': tab === 'all' }" @click="tab = 'all'">全部</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'recharge' }" @click="tab = 'recharge'">充值</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'withdraw' }" @click="tab = 'withdraw'">提现</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'order' }" @click="tab = 'order'">订单收支</button>
    </div>

    <div class="card table-card">
      <el-table :data="filteredFlows" v-loading="loading" stripe>
        <el-table-column prop="id" label="单号" width="180" />
        <el-table-column prop="desc" label="摘要" min-width="200" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <span class="num" :class="row.amount >= 0 ? 'text-green' : 'text-red'">
              {{ row.amount >= 0 ? '+' : '' }}¥{{ Number(row.amount || 0).toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="flowStatusClass(row.status)">{{ flowStatusLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtDate(row.ts) }}</template>
        </el-table-column>
        <template #empty>
          <EmptyState title="暂无收支记录" desc="充值或完成订单后，明细将展示在这里" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import EmptyState from '@/components/EmptyState.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const loading = ref(false);
const tab = ref('all');
const balance = ref(1286.50);
const frozen = ref(1000.00);
const totalIncome = ref(45800.00);
const credits = ref(320);

const flows = ref([
  { id: 'TXN-001', desc: '订单收入 · 天府新区混凝土供应', amount: 32000, status: 'done', ts: Date.now() - 86400000*2, type: 'order' },
  { id: 'TXN-002', desc: '充值 · 支付宝', amount: 5000, status: 'done', ts: Date.now() - 86400000*5, type: 'recharge' },
  { id: 'TXN-003', desc: '提现 · 招商银行尾号8888', amount: -2000, status: 'done', ts: Date.now() - 86400000*7, type: 'withdraw' },
  { id: 'TXN-004', desc: '订单支出 · 购买防水材料', amount: -8500, status: 'done', ts: Date.now() - 86400000*10, type: 'order' },
]);

const filteredFlows = computed(() => {
  if (tab.value === 'all') return flows.value;
  return flows.value.filter(f => f.type === tab.value);
});

function fmtDate(ts: any) {
  if (!ts) return '';
  return new Date(ts).toISOString().slice(0, 10);
}
function flowStatusLabel(s: string) { return s === 'done' ? '已完成' : s === 'pending' ? '处理中' : s; }
function flowStatusClass(s: string) { return s === 'done' ? 'tag--green' : 'tag--yellow'; }
function recharge() { ElMessage.info('充值功能开发中'); }
function withdraw() { ElMessage.info('提现功能开发中'); }
</script>

<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.num { font-variant-numeric: tabular-nums; }
.text-green { color: var(--tag-text-green); }
.text-red { color: var(--tag-text-red); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.table-card { padding: 0; overflow: hidden; }
</style>
