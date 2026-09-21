<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">提现审核</h1>
        <div class="page-view__sub">用户提现申请审核 · 打款 · 驳回（与 App 钱包提现同源）</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
        <button class="btn btn--secondary" @click="onExport"><AppIcon name="download" :size="14" />导出 CSV</button>
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
      <button class="tabs__item" :class="{ 'is-active': tab === 'all' }" @click="setTab('all')">全部</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'pending' }" @click="setTab('pending')">待审核 <span v-if="pendingCount" class="tag tag--yellow tabs__badge">{{ pendingCount }}</span></button>
    </div>

    <div class="filter-bar card">
      <el-select v-model="filter.status" placeholder="状态" clearable size="small" style="width:130px" @change="onFilter">
        <el-option label="待审核" value="pending" />
        <el-option label="已打款" value="paid" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-input v-model="filter.q" placeholder="搜索单号 / 用户 / 银行卡" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id" @row-click="openDetail">
        <el-table-column prop="id" label="单号" width="140" />
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div class="cell-main">{{ row.userName || row.userId }}</div>
            <div class="cell-sub">{{ row.bankCard || row.method || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</b></template>
        </el-table-column>
        <el-table-column label="手续费" width="100">
          <template #default="{ row }">¥{{ Number(row.fee || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="stClass(row.status)">{{ stLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.appliedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="row.status === 'pending'" class="btn btn--primary btn--sm" @click.stop="doApprove(row)">打款</button>
              <button v-if="row.status === 'pending'" class="btn btn--danger btn--sm" @click.stop="doReject(row)">驳回</button>
              <button class="btn btn--tertiary btn--sm" @click.stop="openDetail(row)">查看</button>
            </div>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filtered.length"
          :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @size-change="onFilter" @current-change="onFilter" />
      </div>
    </div>

    <RightDrawer v-model="drawerVisible" :title="`提现详情 · ${current?.id || ''}`">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">申请信息</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">用户</span><span class="ds-v">{{ current.userName || current.userId }}</span></div>
            <div class="ds-item"><span class="ds-k">状态</span><span class="ds-v"><span class="tag" :class="stClass(current.status)">{{ stLabel(current.status) }}</span></span></div>
            <div class="ds-item"><span class="ds-k">金额</span><span class="ds-v num">¥{{ Number(current.amount || 0).toFixed(2) }}</span></div>
            <div class="ds-item"><span class="ds-k">手续费</span><span class="ds-v num">¥{{ Number(current.fee || 0).toFixed(2) }}</span></div>
            <div class="ds-item"><span class="ds-k">通道</span><span class="ds-v">{{ current.method || '—' }}</span></div>
            <div class="ds-item"><span class="ds-k">申请时间</span><span class="ds-v">{{ fmtTs(current.appliedAt) }}</span></div>
            <div class="ds-item ds-full"><span class="ds-k">收款账户</span><span class="ds-v">{{ current.bankCard || '—' }}</span></div>
          </div>
        </div>
        <div class="ds-actions">
          <button v-if="current.status === 'pending'" class="btn btn--primary" @click="doApprove(current)">确认打款</button>
          <button v-if="current.status === 'pending'" class="btn btn--danger" @click="doReject(current)">驳回</button>
        </div>
      </template>
    </RightDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import RightDrawer from '@/components/RightDrawer.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const ST: Record<string, [string, string]> = { pending: ['待审核', 'tag--yellow'], paid: ['已打款', 'tag--green'], rejected: ['已驳回', 'tag--red'] };
const stLabel = (s: string) => ST[s]?.[0] || s;
const stClass = (s: string) => ST[s]?.[1] || 'tag--gray';

const loading = ref(false);
const list = ref<any[]>([]);
const tab = ref<'all' | 'pending'>('all');
const page = ref(1);
const pageSize = ref(10);
const filter = reactive({ status: '', q: '' });
const drawerVisible = ref(false);
const current = ref<any>(null);

function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function load() { list.value = bus()?.withdrawals ? bus().withdrawals() : []; }
const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((x: any) => {
    if (tab.value === 'pending' && x.status !== 'pending') return false;
    if (filter.status && x.status !== filter.status) return false;
    if (q && `${x.id}${x.userName}${x.userId}${x.bankCard}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const pendingCount = computed(() => list.value.filter((x: any) => x.status === 'pending').length);
const kpis = computed(() => {
  let pending = 0, paid = 0, rejected = 0, pendingAmt = 0;
  list.value.forEach((x: any) => {
    if (x.status === 'pending') { pending++; pendingAmt += Number(x.amount || 0); }
    else if (x.status === 'paid') paid++;
    else if (x.status === 'rejected') rejected++;
  });
  return [
    { label: '待审核', value: pending, hint: `合计 ¥${pendingAmt.toFixed(2)}` },
    { label: '已打款', value: paid, hint: '本轮完成' },
    { label: '已驳回', value: rejected, hint: '未打款' },
  ];
});
function setTab(t: 'all' | 'pending') { tab.value = t; page.value = 1; }
function onFilter() { page.value = 1; }
function onReset() { filter.status = ''; filter.q = ''; page.value = 1; }
function openDetail(row: any) { current.value = row; drawerVisible.value = true; }
function doApprove(row: any) {
  ElMessageBox.confirm('确认已打款到用户收款账户？', '确认打款', { type: 'info' }).then(() => {
    const r = bus()?.withdrawApprove?.(row.id);
    if (r && r.error) ElMessage.error(r.error); else ElMessage.success('已打款');
    drawerVisible.value = false; load();
  }).catch(() => {});
}
function doReject(row: any) {
  ElMessageBox.prompt('驳回原因', '驳回提现', { inputPlaceholder: '原因…', inputValidator: (v) => !!v?.trim() || '请填写原因' }).then(({ value }) => {
    const r = bus()?.withdrawReject?.(row.id, value.trim());
    if (r && r.error) ElMessage.error(r.error); else ElMessage.success('已驳回');
    drawerVisible.value = false; load();
  }).catch(() => {});
}
function onExport() {
  const rows = filtered.value.map((x: any) => [x.id, x.userName || x.userId, x.amount, x.status, fmtTs(x.appliedAt)]);
  const header = ['单号', '用户', '金额', '状态', '申请时间'];
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '提现审核.csv'; a.click();
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
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
.cell-main { color: var(--font-primary); line-height: 1.3; }
.cell-sub { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.num { font-variant-numeric: tabular-nums; }
.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
.ds-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
