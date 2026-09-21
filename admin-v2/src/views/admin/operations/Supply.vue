<template>
  <div class="page-view">
    <!-- 头部 -->
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">运营中心</div>
        <h1 class="page-view__title">供需管理</h1>
        <div class="page-view__sub">9 类供需内容发布审核与上架管理（审核动作写回 DataBus，与 App 供需列表联动）</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="onRefresh"><AppIcon name="refresh" :size="14" />刷新</button>
        <button class="btn btn--secondary" @click="onExport"><AppIcon name="download" :size="14" />导出 CSV</button>
      </div>
    </div>

    <!-- KPI -->
    <div class="kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__value">{{ k.value }}</div>
        <div class="kpi__hint">{{ k.hint }}</div>
      </div>
    </div>

    <!-- Tab -->
    <div class="tabs">
      <button class="tabs__item" :class="{ 'is-active': tab === 'all' }" @click="setTab('all')">全部供需</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'pending' }" @click="setTab('pending')">
        待审核
        <span v-if="pendingCount" class="tag tag--yellow tabs__badge">{{ pendingCount }}</span>
      </button>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar card">
      <el-select v-model="filter.cat" placeholder="品类" clearable size="small" style="width:130px" @change="onFilter">
        <el-option v-for="c in cats" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filter.dir" placeholder="方向" clearable size="small" style="width:110px" @change="onFilter">
        <el-option label="需求" value="demand" />
        <el-option label="供应" value="supply" />
      </el-select>
      <el-select v-model="filter.status" placeholder="状态" clearable size="small" style="width:130px" @change="onFilter">
        <el-option label="待审核" value="pending_review" />
        <el-option label="已上架" value="active" />
        <el-option label="已下架" value="off" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-date-picker v-model="filter.dateRange" type="daterange" size="small" range-separator="至"
        start-placeholder="开始日期" end-placeholder="结束日期" style="width:240px" @change="onFilter" />
      <el-input v-model="filter.q" placeholder="搜索标题 / 公司 / 地区" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <!-- 表格 -->
    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe @row-click="openDetail" row-key="id" class="supply-table">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="内容" min-width="280">
          <template #default="{ row }">
            <div class="cell-main">{{ row.title }}</div>
            <div class="cell-sub">{{ row.company }} · {{ row.location }}
              <span v-if="row.note" class="cell-note">· {{ row.note }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="cat" label="品类" width="90" />
        <el-table-column label="方向" width="80">
          <template #default="{ row }">
            <span class="tag" :class="row.dir === 'demand' ? 'tag--sky' : 'tag--blue'">
              {{ row.dir === 'demand' ? '需求' : '供应' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="预算/报价" width="120" />
        <el-table-column prop="publisher" label="发布者" width="110" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.ts) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="row.status === 'pending_review'" class="btn btn--primary btn--sm" @click.stop="doAudit(row.id, 'approve')">通过</button>
              <button v-if="row.status === 'pending_review'" class="btn btn--danger btn--sm" @click.stop="rejectDialog(row.id)">驳回</button>
              <button v-if="row.status === 'active'" class="btn btn--secondary btn--sm" @click.stop="doAudit(row.id, 'off')">下架</button>
              <button v-if="row.status === 'off'" class="btn btn--primary btn--sm" @click.stop="doAudit(row.id, 'on')">上架</button>
              <button class="btn btn--tertiary btn--sm" @click.stop="openDetail(row.id)">查看</button>
            </div>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title="暂无供需信息" desc="当前筛选条件下没有匹配的供需内容" />
      </template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filtered.length"
          :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @size-change="onFilter" @current-change="onFilter" />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <RightDrawer v-model="drawerVisible" :title="`供需详情 · ${current?.id || ''}`">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">基本信息</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">品类</span><span class="ds-v">{{ current.cat }}</span></div>
            <div class="ds-item"><span class="ds-k">方向</span><span class="ds-v">
              <span class="tag" :class="current.dir === 'demand' ? 'tag--sky' : 'tag--blue'">{{ current.dir === 'demand' ? '需求' : '供应' }}</span>
            </span></div>
            <div class="ds-item"><span class="ds-k">状态</span><span class="ds-v">
              <span class="tag" :class="statusClass(current.status)">{{ statusLabel(current.status) }}</span>
            </span></div>
            <div class="ds-item"><span class="ds-k">发布时间</span><span class="ds-v">{{ fmtDate(current.ts) }}</span></div>
            <div class="ds-item ds-full"><span class="ds-k">标题</span><span class="ds-v">{{ current.title }}</span></div>
            <div class="ds-item ds-full"><span class="ds-k">预算/报价</span><span class="ds-v">{{ current.amount }}</span></div>
          </div>
        </div>
        <div class="ds-section">
          <div class="ds-title">发布方</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">公司/个人</span><span class="ds-v">{{ current.company }}</span></div>
            <div class="ds-item"><span class="ds-k">地区</span><span class="ds-v">{{ current.location }}</span></div>
            <div class="ds-item"><span class="ds-k">发布者ID</span><span class="ds-v">{{ current.publisher }}</span></div>
          </div>
        </div>
        <div class="ds-section">
          <div class="ds-title">详细描述</div>
          <div class="ds-desc">{{ current.desc || current.title || '暂无' }}</div>
        </div>
        <div class="ds-section">
          <div class="ds-title">审核记录</div>
          <div class="timeline">
            <div class="tl-item">
              <div class="tl-dot done">✓</div>
              <div class="tl-body">
                <div class="tl-title">内容发布</div>
                <div class="tl-meta">{{ fmtDate(current.ts) }} · {{ current.publisher }}</div>
              </div>
            </div>
            <div v-if="current.status === 'pending_review'" class="tl-item">
              <div class="tl-dot">2</div>
              <div class="tl-body">
                <div class="tl-title">待运营审核</div>
                <div class="tl-meta">等待通过或驳回</div>
              </div>
            </div>
            <div v-if="current.status === 'active' || current.status === 'off'" class="tl-item">
              <div class="tl-dot done">✓</div>
              <div class="tl-body">
                <div class="tl-title">审核通过 · 已上架</div>
                <div class="tl-meta">{{ current.auditTs ? fmtDate(current.auditTs) : '运营审核通过' }}</div>
              </div>
            </div>
            <div v-if="current.status === 'rejected'" class="tl-item">
              <div class="tl-dot err">✕</div>
              <div class="tl-body">
                <div class="tl-title">审核驳回</div>
                <div class="tl-meta warn">{{ current.note || '不符合发布规范' }}</div>
              </div>
            </div>
            <div v-if="current.status === 'off'" class="tl-item">
              <div class="tl-dot err">✕</div>
              <div class="tl-body">
                <div class="tl-title">已下架</div>
                <div class="tl-meta warn">{{ current.note || '主动下架' }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="ds-actions">
          <button v-if="current.status === 'pending_review'" class="btn btn--primary" @click="doAudit(current.id, 'approve')">通过上架</button>
          <button v-if="current.status === 'pending_review'" class="btn btn--danger" @click="rejectDialog(current.id)">驳回</button>
          <button v-if="current.status === 'active'" class="btn btn--secondary" @click="doAudit(current.id, 'off')">下架</button>
          <button v-if="current.status === 'off'" class="btn btn--primary" @click="doAudit(current.id, 'on')">上架</button>
        </div>
      </template>
    </RightDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import RightDrawer from '@/components/RightDrawer.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const cats = ['材料', '设备', '劳务', '合作', '中介', '资质招商', '建企买卖', '招聘', '求职'];
const ST_LABEL: Record<string, string> = { pending_review: '待审核', active: '已上架', off: '已下架', rejected: '已驳回' };
const ST_CLASS: Record<string, string> = {
  pending_review: 'tag--yellow',
  active: 'tag--green',
  off: 'tag--gray',
  rejected: 'tag--red',
};

const loading = ref(false);
const list = ref<any[]>([]);
const tab = ref<'all' | 'pending'>('all');
const page = ref(1);
const pageSize = ref(10);
const filter = reactive({ cat: '', dir: '', status: '', q: '', dateRange: null as [string, string] | null });
const drawerVisible = ref(false);
const current = ref<any>(null);

const statusLabel = (s: string) => ST_LABEL[s] || s;
const statusClass = (s: string) => ST_CLASS[s] || 'tag--gray';
function fmtDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}

function load() {
  const raw = bus()?.supply ? bus().supply() : [];
  list.value = Array.isArray(raw) ? raw : [];
}

const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((x: any) => {
    if (tab.value === 'pending' && x.status !== 'pending_review') return false;
    if (filter.cat && x.cat !== filter.cat) return false;
    if (filter.dir && x.dir !== filter.dir) return false;
    if (filter.status && x.status !== filter.status) return false;
    if (filter.dateRange && filter.dateRange[0] && fmtDate(x.ts) < filter.dateRange[0]) return false;
    if (filter.dateRange && filter.dateRange[1] && fmtDate(x.ts) > filter.dateRange[1]) return false;
    if (q && `${x.title}${x.company}${x.location}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});

const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

const pendingCount = computed(() => list.value.filter((x: any) => x.status === 'pending_review').length);

const kpis = computed(() => {
  const c: Record<string, number> = { pending_review: 0, active: 0, off: 0, rejected: 0 };
  let weekNew = 0;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  list.value.forEach((x: any) => {
    if (c[x.status] !== undefined) c[x.status]++;
    if (fmtDate(x.ts) >= weekAgo) weekNew++;
  });
  return [
    { label: '待审核', value: c.pending_review, hint: '需运营审核' },
    { label: '已上架', value: c.active, hint: 'App 正在展示' },
    { label: '已驳回', value: c.rejected, hint: '含驳回原因' },
    { label: '已下架', value: c.off, hint: '暂不对用户可见' },
    { label: '本周新增', value: weekNew, hint: '近 7 天发布' },
  ];
});

function setTab(t: 'all' | 'pending') {
  tab.value = t;
  page.value = 1;
}
function onFilter() { page.value = 1; }
function onReset() {
  filter.cat = ''; filter.dir = ''; filter.status = ''; filter.q = ''; filter.dateRange = null;
  page.value = 1;
}
function onRefresh() { load(); ElMessage.success('已刷新'); }

function openDetail(row: any) {
  current.value = row;
  drawerVisible.value = true;
}

function doAudit(id: string, action: 'approve' | 'reject' | 'on' | 'off', note?: string) {
  const it = bus()?.supplyAudit?.(id, action, note);
  if (!it) { ElMessage.error('未找到该条内容'); return; }
  const msg = { approve: '已通过并上架', reject: '已驳回', on: '已上架', off: '已下架' }[action];
  ElMessage.success(`[${it.id}] ${msg}`);
  drawerVisible.value = false;
  load();
}

function rejectDialog(id: string) {
  ElMessageBox.prompt('请填写驳回原因（必填）', '驳回供需内容', {
    confirmButtonText: '确认驳回',
    cancelButtonText: '取消',
    inputPlaceholder: '驳回原因…',
    inputValidator: (v) => !!v?.trim() || '请填写驳回原因',
    type: 'warning',
  }).then(({ value }) => {
    doAudit(id, 'reject', value.trim());
  }).catch(() => {});
}

function onExport() {
  const rows = filtered.value.map((x: any) => [
    x.id, x.cat || '', x.dir || '', x.title || '', x.company || '', x.location || '',
    x.amount ?? '', x.status || '', fmtDate(x.ts),
  ]);
  const header = ['ID', '品类', '方向', '标题', '公司', '地区', '金额', '状态', '发布时间'];
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '供需管理.csv';
  a.click();
  ElMessage.success(`已导出 ${rows.length} 条`);
}

function onBusChange() { load(); }

onMounted(() => {
  load();
  window.addEventListener('engchain:supply', onBusChange);
});
onUnmounted(() => {
  window.removeEventListener('engchain:supply', onBusChange);
});
</script>

<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }

.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item {
  height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px;
  border: none; background: transparent; color: var(--font-tertiary);
  font-size: var(--font-size-md); cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tabs__item:hover { color: var(--font-secondary); }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.tabs__badge { margin-left: 2px; }

.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }

.table-card { padding: 0; overflow: hidden; }
:deep(.el-table) { font-size: var(--font-size-md); }
:deep(.el-table th.el-table__cell) { font-weight: var(--font-weight-medium); font-size: var(--font-size-sm); }
.cell-main { color: var(--font-primary); line-height: 1.3; }
.cell-sub { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.cell-note { color: var(--color-orange); }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }

.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }

.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
.ds-desc { font-size: var(--font-size-md); color: var(--font-secondary); line-height: 1.5; padding: 8px 12px; background: var(--bg-secondary); border-radius: var(--radius-sm); }

.timeline { display: flex; flex-direction: column; gap: 12px; }
.tl-item { display: flex; gap: 10px; }
.tl-dot {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-tertiary); color: var(--font-tertiary);
  font-size: 11px; display: flex; align-items: center; justify-content: center;
}
.tl-dot.done { background: var(--tag-bg-green); color: var(--tag-text-green); }
.tl-dot.err { background: var(--tag-bg-red); color: var(--tag-text-red); }
.tl-body { flex: 1; }
.tl-title { font-size: var(--font-size-md); color: var(--font-primary); font-weight: var(--font-weight-medium); }
.tl-meta { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.tl-meta.warn { color: var(--color-orange); }

.ds-actions { display: flex; gap: 8px; margin-top: 8px; }

@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
}
</style>
