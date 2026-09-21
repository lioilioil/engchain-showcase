<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">充值管理</h1>
        <div class="page-view__sub">线上充值 + 对公转账审核（与 App 钱包充值同源）</div>
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
      <button class="tabs__item" :class="{ 'is-active': tab === 'corp' }" @click="setTab('corp')">对公转账 <span v-if="pendingCorp" class="tag tag--yellow tabs__badge">{{ pendingCorp }}</span></button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'online' }" @click="setTab('online')">线上充值</button>
    </div>

    <div class="card table-card" v-if="tab === 'corp'">
      <el-table :data="corpList" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="单号" width="140" />
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">{{ row.userName || row.userId }}</template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.status === 'approved' ? 'tag--green' : row.status === 'rejected' ? 'tag--red' : 'tag--yellow'">
              {{ row.status === 'approved' ? '已入账' : row.status === 'rejected' ? '已驳回' : '待审核' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="row.status !== 'approved' && row.status !== 'rejected'" class="btn btn--primary btn--sm" @click="approveCorp(row)">入账</button>
              <button v-if="row.status !== 'approved' && row.status !== 'rejected'" class="btn btn--danger btn--sm" @click="rejectCorp(row)">驳回</button>
            </div>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
    </div>

    <div class="card table-card" v-else>
      <el-table :data="onlineList" v-loading="loading" stripe row-key="ts">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="说明" min-width="240" />
        <el-table-column prop="method" label="通道" width="100" />
        <el-table-column label="金额" width="130">
          <template #default="{ row }"><b class="num" style="color:var(--tag-text-green)">+¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
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
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const loading = ref(false);
const corpList = ref<any[]>([]);
const onlineList = ref<any[]>([]);
const tab = ref<'corp' | 'online'>('corp');

function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function load() {
  corpList.value = (window as any).CorpPay?.list?.() || [];
  const bs = (window as any).BalanceStore;
  if (bs) {
    bs.seedLogs?.();
    onlineList.value = (bs.read().logs || []).filter((l: any) => l.type === 'recharge' && l.method !== 'corp')
      .sort((a: any, b: any) => (b.ts || 0) - (a.ts || 0));
  }
}
const pendingCorp = computed(() => corpList.value.filter((x: any) => x.status !== 'approved' && x.status !== 'rejected').length);
const kpis = computed(() => {
  const c = corpList.value.filter((x: any) => x.status === 'approved');
  const cAmt = c.reduce((s, x) => s + Number(x.amount || 0), 0);
  const oAmt = onlineList.value.reduce((s, x) => s + Number(x.amount || 0), 0);
  return [
    { label: '对公已入账', value: `${c.length} 笔`, hint: `合计 ¥${cAmt.toFixed(2)}` },
    { label: '线上充值', value: `${onlineList.value.length} 笔`, hint: `合计 ¥${oAmt.toFixed(2)}` },
    { label: '待审核对公', value: pendingCorp.value, hint: '需运营入账' },
  ];
});
function setTab(t: 'corp' | 'online') { tab.value = t; }
function approveCorp(row: any) {
  ElMessageBox.confirm('确认对公款项已到账并入账？', '确认入账', { type: 'info' }).then(() => {
    const r = (window as any).CorpPay?.approve?.(row.id);
    if (r && r.error) ElMessage.error(r.error); else ElMessage.success('已入账');
    load();
  }).catch(() => {});
}
function rejectCorp(row: any) {
  ElMessageBox.prompt('驳回原因', '驳回对公转账', { inputPlaceholder: '原因…' }).then(({ value }) => {
    (window as any).CorpPay?.reject?.(row.id, value);
    ElMessage.success('已驳回');
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
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.table-card { padding: 0; overflow: hidden; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.num { font-variant-numeric: tabular-nums; }
</style>
