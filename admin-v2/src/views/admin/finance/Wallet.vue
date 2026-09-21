<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">钱包总览</h1>
        <div class="page-view__sub">平台账户余额 + 7 日资金趋势 + 全量流水明细</div>
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

    <div class="card chart-card">
      <div class="chart-title">近 7 日资金趋势</div>
      <div v-if="hasChart" class="chart-bars">
        <div v-for="d in days" :key="d.key" class="bar-col">
          <div class="bar-values"><span class="bar-in">{{ d.in.toFixed(0) }}</span><span class="bar-out">{{ d.out.toFixed(0) }}</span></div>
          <div class="bar-track">
            <div class="bar bar-in" :style="{ height: Math.max(2, Math.round(d.in / max * 120)) + 'px' }" />
            <div class="bar bar-out" :style="{ height: Math.max(2, Math.round(d.out / max * 120)) + 'px' }" />
          </div>
          <div class="bar-label">{{ d.label }}</div>
        </div>
      </div>
      <div v-else class="chart-empty">近 7 日暂无资金流水</div>
    </div>

    <div class="filter-bar card">
      <el-select v-model="filter.type" placeholder="流水类型" clearable size="small" style="width:140px" @change="onFilter">
        <el-option label="线上充值" value="recharge" />
        <el-option label="对公入账" value="corp" />
        <el-option label="提现" value="withdraw" />
        <el-option label="订单收款" value="in" />
        <el-option label="解锁支出" value="pay" />
      </el-select>
      <el-date-picker v-model="filter.dateRange" type="daterange" size="small" range-separator="至"
        start-placeholder="开始日期" end-placeholder="结束日期" style="width:240px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="ts" @row-click="openDetail">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <span class="tag" :class="typeTag(logType(row))">{{ typeMeta(logType(row)).k }}</span>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="240">
          <template #default="{ row }">
            {{ row.reason || '—' }}
            <span v-if="row.corpId" class="ref-tag">[{{ row.corpId }}]</span>
            <span v-if="row.withdrawId" class="ref-tag">[{{ row.withdrawId }}]</span>
          </template>
        </el-table-column>
        <el-table-column prop="method" label="通道" width="100" />
        <el-table-column label="金额" width="140">
          <template #default="{ row }">
            <b :style="{ color: row.amount > 0 ? 'var(--tag-text-green)' : 'var(--tag-text-red)' }">
              {{ row.amount > 0 ? '+' : '' }}{{ money(row.amount) }}
            </b>
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

    <RightDrawer v-model="drawerVisible" title="流水详情">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">流水详情</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">时间</span><span class="ds-v">{{ fmtTs(current.ts) }}</span></div>
            <div class="ds-item"><span class="ds-k">类型</span><span class="ds-v">{{ typeMeta(logType(current)).k }}</span></div>
            <div class="ds-item"><span class="ds-k">通道</span><span class="ds-v">{{ current.method || '—' }}</span></div>
            <div class="ds-item"><span class="ds-k">金额</span><span class="ds-v"><b :style="{ color: current.amount > 0 ? 'var(--tag-text-green)' : 'var(--tag-text-red)' }">{{ current.amount > 0 ? '+' : '' }}{{ money(current.amount) }}</b></span></div>
            <div class="ds-item ds-full"><span class="ds-k">说明</span><span class="ds-v">{{ current.reason || '—' }}</span></div>
            <div v-if="current.corpId" class="ds-item"><span class="ds-k">关联对公</span><span class="ds-v">{{ current.corpId }}</span></div>
            <div v-if="current.withdrawId" class="ds-item"><span class="ds-k">关联提现</span><span class="ds-v">{{ current.withdrawId }}</span></div>
          </div>
        </div>
      </template>
    </RightDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import RightDrawer from '@/components/RightDrawer.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const TYPE_META: Record<string, { k: string; c: string; in: boolean }> = {
  recharge: { k: '线上充值', c: 'var(--tag-bg-green)', in: true },
  corp: { k: '对公入账', c: 'var(--color-gold)', in: true },
  withdraw: { k: '提现', c: 'var(--tag-bg-yellow)', in: false },
  in: { k: '订单收款', c: 'var(--tag-bg-blue)', in: true },
  pay: { k: '解锁支出', c: 'var(--tag-bg-red)', in: false },
};

const loading = ref(false);
const logs = ref<any[]>([]);
const balance = ref({ balance: 0, frozen: 0 });
const page = ref(1);
const pageSize = ref(15);
const filter = reactive({ type: '', dateRange: null as [string, string] | null });
const drawerVisible = ref(false);
const current = ref<any>(null);

function money(n: any) { return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dayKey(ts: any) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function typeMeta(t: string) { return TYPE_META[t] || { k: t, c: 'var(--bg-tertiary)', in: false }; }
function typeTag(t: string) {
  if (t === 'recharge') return 'tag--green';
  if (t === 'corp') return 'tag--gold';
  if (t === 'withdraw') return 'tag--yellow';
  if (t === 'in') return 'tag--blue';
  if (t === 'pay') return 'tag--red';
  return 'tag--gray';
}
function logType(l: any) {
  if (l.type === 'recharge' && l.method === 'corp') return 'corp';
  return l.type;
}

function load() {
  const bs = (window as any).BalanceStore;
  if (bs) {
    bs.seedLogs?.();
    balance.value = bs.read() || { balance: 0, frozen: 0 };
  }
  const list: any[] = bs ? (bs.read().logs || []).slice() : [];
  if ((window as any).CorpPay) {
    (window as any).CorpPay.list().filter((r: any) => r.status === 'approved').forEach((r: any) => {
      if (!list.some((l) => l.corpId === r.id)) {
        list.unshift({ type: 'recharge', method: 'corp', amount: r.amount, reason: '对公转账 · ' + (r.remark || ''), corpId: r.id, ts: r.approvedAt || r.createdAt });
      }
    });
  }
  bus()?.withdrawals?.().filter((w: any) => w.status === 'paid').forEach((w: any) => {
    if (!list.some((l) => l.withdrawId === w.id)) {
      list.unshift({ type: 'withdraw', method: w.method, amount: -w.amount, reason: '提现 · ' + (w.userName || ''), withdrawId: w.id, ts: w.paidAt || w.appliedAt });
    }
  });
  list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  logs.value = list;
}

const filtered = computed(() => {
  return logs.value.filter((l) => {
    const t = logType(l);
    if (filter.type && t !== filter.type) return false;
    if (filter.dateRange && filter.dateRange[0] && dayKey(l.ts) < filter.dateRange[0]) return false;
    if (filter.dateRange && filter.dateRange[1] && dayKey(l.ts) > filter.dateRange[1]) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

const days = computed(() => {
  const arr: any[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    arr.push({ key: dayKey(d.getTime()), label: `${d.getMonth() + 1}/${d.getDate()}`, in: 0, out: 0 });
  }
  logs.value.forEach((l) => {
    const k = dayKey(l.ts);
    const it = arr.find((a) => a.key === k);
    if (it) { if (l.amount > 0) it.in += l.amount; else it.out += Math.abs(l.amount); }
  });
  return arr;
});
const max = computed(() => Math.max(1, ...days.value.map((d) => Math.max(d.in, d.out))));
const hasChart = computed(() => days.value.some((d) => d.in > 0 || d.out > 0));

const kpis = computed(() => {
  const ts = new Date(); ts.setHours(0, 0, 0, 0);
  let todayIn = 0, todayOut = 0;
  logs.value.forEach((l) => {
    if ((l.ts || 0) >= ts.getTime()) {
      if (l.amount > 0) todayIn += l.amount;
      else todayOut += Math.abs(l.amount);
    }
  });
  return [
    { label: '账户总余额', value: money(balance.value.balance), hint: `含冻结 ${money(balance.value.frozen)}` },
    { label: '冻结金额', value: money(balance.value.frozen), hint: '提现申请 / 保证金占用' },
    { label: '今日充值', value: money(todayIn), hint: '当日资金流入' },
    { label: '今日提现', value: money(todayOut), hint: '当日资金流出' },
  ];
});

function onFilter() { page.value = 1; }
function onReset() { filter.type = ''; filter.dateRange = null; page.value = 1; }
function openDetail(row: any) { current.value = row; drawerVisible.value = true; }

onMounted(() => { load(); });
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
.chart-card { padding: 16px; }
.chart-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-secondary); margin-bottom: 12px; }
.chart-bars { display: flex; gap: 12px; align-items: flex-end; height: 180px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.bar-values { display: flex; gap: 8px; font-size: 11px; }
.bar-in { color: var(--tag-text-green); }
.bar-out { color: var(--tag-text-red); }
.bar-track { display: flex; gap: 4px; align-items: flex-end; height: 120px; }
.bar { width: 12px; border-radius: 2px; }
.bar-in { background: var(--tag-bg-green); }
.bar-out { background: var(--tag-bg-red); }
.bar-label { font-size: 11px; color: var(--font-tertiary); }
.chart-empty { text-align: center; padding: 40px; color: var(--font-tertiary); font-size: var(--font-size-md); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
.ref-tag { font-size: var(--font-size-xs); color: var(--font-light); background: var(--bg-secondary); padding: 1px 4px; border-radius: 2px; margin-left: 4px; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
</style>
