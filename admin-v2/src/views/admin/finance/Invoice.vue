<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">发票管理</h1>
        <div class="page-view__sub">用户开票申请审核 / 开具 / 邮寄</div>
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
        <el-option label="待审核" value="pending" />
        <el-option label="已开具" value="issued" />
        <el-option label="已邮寄" value="mailed" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-input v-model="filter.q" placeholder="搜索发票号 / 抬头 / 用户" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id" @row-click="openDetail">
        <el-table-column prop="id" label="申请号" width="140" />
        <el-table-column label="抬头" min-width="200">
          <template #default="{ row }">
            <div class="cell-main">{{ row.title }}</div>
            <div class="cell-sub">{{ row.taxNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }"><b class="num">¥{{ Number(row.amount || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ row.type === 'special' ? '专票' : '普票' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="stClass(row.status)">{{ stLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="row.status === 'pending'" class="btn btn--primary btn--sm" @click.stop="doIssue(row)">开具</button>
              <button v-if="row.status === 'pending'" class="btn btn--danger btn--sm" @click.stop="doReject(row)">驳回</button>
              <button v-if="row.status === 'issued'" class="btn btn--secondary btn--sm" @click.stop="doMail(row)">标记邮寄</button>
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
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next" @size-change="onFilter" @current-change="onFilter" />
      </div>
    </div>

    <RightDrawer v-model="drawerVisible" :title="`发票详情 · ${current?.id || ''}`">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">开票信息</div>
          <div class="ds-grid">
            <div class="ds-item ds-full"><span class="ds-k">抬头</span><span class="ds-v">{{ current.title }}</span></div>
            <div class="ds-item"><span class="ds-k">税号</span><span class="ds-v">{{ current.taxNo }}</span></div>
            <div class="ds-item"><span class="ds-k">类型</span><span class="ds-v">{{ current.type === 'special' ? '增值税专用发票' : '增值税普通发票' }}</span></div>
            <div class="ds-item"><span class="ds-k">金额</span><span class="ds-v num">¥{{ Number(current.amount || 0).toFixed(2) }}</span></div>
            <div class="ds-item"><span class="ds-k">状态</span><span class="ds-v"><span class="tag" :class="stClass(current.status)">{{ stLabel(current.status) }}</span></span></div>
            <div class="ds-item ds-full"><span class="ds-k">邮箱</span><span class="ds-v">{{ current.email || '—' }}</span></div>
            <div v-if="current.mailAddress" class="ds-item ds-full"><span class="ds-k">邮寄地址</span><span class="ds-v">{{ current.mailAddress }}</span></div>
          </div>
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
const ST: Record<string, [string, string]> = { pending: ['待审核', 'tag--yellow'], issued: ['已开具', 'tag--blue'], mailed: ['已邮寄', 'tag--green'], rejected: ['已驳回', 'tag--red'] };
const stLabel = (s: string) => ST[s]?.[0] || s;
const stClass = (s: string) => ST[s]?.[1] || 'tag--gray';

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(15);
const filter = reactive({ status: '', q: '' });
const drawerVisible = ref(false);
const current = ref<any>(null);

function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function load() { list.value = bus()?.invoices ? bus().invoices() : []; }
const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((x: any) => {
    if (filter.status && x.status !== filter.status) return false;
    if (q && `${x.id}${x.title}${x.taxNo}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const kpis = computed(() => {
  let pending = 0, issued = 0, mailed = 0, amt = 0;
  list.value.forEach((x: any) => {
    if (x.status === 'pending') pending++;
    else if (x.status === 'issued') issued++;
    else if (x.status === 'mailed') mailed++;
    amt += Number(x.amount || 0);
  });
  return [
    { label: '待审核', value: pending, hint: '需开具' },
    { label: '已开具', value: issued, hint: '待邮寄' },
    { label: '已邮寄', value: mailed, hint: '完成' },
    { label: '累计开票额', value: `¥${amt.toFixed(2)}`, hint: '全部申请' },
  ];
});
function onFilter() { page.value = 1; }
function onReset() { filter.status = ''; filter.q = ''; page.value = 1; }
function openDetail(row: any) { current.value = row; drawerVisible.value = true; }
function doIssue(row: any) {
  ElMessageBox.prompt('发票号码', '开具发票', { inputPlaceholder: '请输入发票号码…' }).then(({ value }) => {
    bus()?.invoiceApprove?.(row.id, { invoiceNo: value.trim() });
    ElMessage.success('已开具');
    load();
  }).catch(() => {});
}
function doReject(row: any) {
  ElMessageBox.prompt('驳回原因', '驳回开票申请', { inputPlaceholder: '原因…' }).then(({ value }) => {
    bus()?.invoiceReject?.(row.id, value.trim());
    ElMessage.success('已驳回');
    load();
  }).catch(() => {});
}
function doMail(row: any) {
  bus()?.invoiceUpdate?.(row.id, { status: 'mailed' });
  ElMessage.success('已标记邮寄');
  load();
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
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
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
</style>
