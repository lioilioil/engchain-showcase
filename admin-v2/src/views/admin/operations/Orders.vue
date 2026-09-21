<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">运营中心</div>
        <h1 class="page-view__title">订单管理</h1>
        <div class="page-view__sub">订单全生命周期（待支付→服务中→待验收→已结算）+ 里程碑验收 + 佣金试算</div>
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
      <button class="tabs__item" :class="{ 'is-active': kind === 'all' }" @click="setKind('all')">全部订单</button>
      <button class="tabs__item" :class="{ 'is-active': kind === 'normal' }" @click="setKind('normal')">普通订单</button>
      <button class="tabs__item" :class="{ 'is-active': kind === 'mediation' }" @click="setKind('mediation')">中介托管</button>
    </div>

    <div class="filter-bar card">
      <el-select v-model="filter.type" placeholder="订单类型" clearable size="small" style="width:140px" @change="onFilter">
        <el-option label="供方承接" value="supply" />
        <el-option label="需求匹配" value="need" />
        <el-option label="中介撮合" value="agency" />
        <el-option label="建企买卖" value="transfer" />
        <el-option label="资质招商" value="qual" />
      </el-select>
      <el-select v-model="filter.status" placeholder="订单状态" clearable size="small" style="width:130px" @change="onFilter">
        <el-option label="待支付" value="pending" />
        <el-option label="服务中" value="serving" />
        <el-option label="待验收" value="await_accept" />
        <el-option label="已结算" value="settled" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-date-picker v-model="filter.dateRange" type="daterange" size="small" range-separator="至"
        start-placeholder="开始日期" end-placeholder="结束日期" style="width:240px" @change="onFilter" />
      <el-input v-model="filter.q" placeholder="搜索订单号 / 标题 / 公司" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id" @row-click="openDetail">
        <el-table-column prop="id" label="订单号" width="140" />
        <el-table-column label="订单内容" min-width="260">
          <template #default="{ row }">
            <div class="cell-main">
              {{ row.title }}
              <span v-if="row._isMediation" class="tag tag--gold">托管</span>
            </div>
            <div class="cell-sub">对方：<a class="crm-link" @click="goCrm(row)">{{ row.counterparty }}</a></div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ row._isMediation ? '中介托管' : (TYPE[row.type] || row.type) }}</template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }"><span class="num">{{ money(row.amount) }}</span></template>
        </el-table-column>
        <el-table-column label="佣金" width="110">
          <template #default="{ row }">
            <span v-if="row.fee" class="num">{{ money(row.fee) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="里程碑" width="140">
          <template #default="{ row }">
            <div class="ms-bar">
              <div v-for="(m, i) in (row.milestones || [])" :key="i" class="ms-seg"
                :class="{ done: m.status === 'done', cur: m.status !== 'done' && i === doneCount(row) }" />
            </div>
            <div class="row-sub">{{ doneCount(row) }}/{{ (row.milestones || []).length }} 节点达成</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="100">
          <template #default="{ row }">{{ fmtDate(row.ts) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <template v-if="!row._isMediation">
                <button v-if="row.status === 'pending'" class="btn btn--primary btn--sm" @click.stop="confirmTransition(row, 'serving', '确认支付后进入服务中？')">确认支付</button>
                <button v-if="row.status === 'serving'" class="btn btn--primary btn--sm" @click.stop="openMs(row)">推进里程碑</button>
                <button v-if="row.status === 'await_accept'" class="btn btn--primary btn--sm" @click.stop="confirmTransition(row, 'settled', '结算后按里程碑比例计提佣金，不可撤销。')">确认结算</button>
                <button v-if="['pending','serving','await_accept'].includes(row.status)" class="btn btn--danger btn--sm" @click.stop="confirmTransition(row, 'cancelled', '取消后订单终止，不产生佣金。', true)">取消</button>
              </template>
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

    <RightDrawer v-model="drawerVisible" :title="`订单详情 · ${current?.id || ''}`">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">基本信息</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">订单号</span><span class="ds-v">{{ current.id }}</span></div>
            <div class="ds-item"><span class="ds-k">订单类型</span><span class="ds-v">{{ current._isMediation ? '中介托管' : (TYPE[current.type] || current.type) }}</span></div>
            <div class="ds-item"><span class="ds-k">订单状态</span><span class="ds-v"><span class="tag" :class="statusClass(current.status)">{{ statusLabel(current.status) }}</span></span></div>
            <div class="ds-item"><span class="ds-k">创建时间</span><span class="ds-v">{{ fmtDate(current.ts) }}</span></div>
            <div class="ds-item ds-full"><span class="ds-k">订单标题</span><span class="ds-v">{{ current.title }}</span></div>
          </div>
        </div>
        <div class="ds-section">
          <div class="ds-title">双方信息</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">甲方（发布方）</span><span class="ds-v">{{ current.owner || '平台' }}</span></div>
            <div class="ds-item"><span class="ds-k">乙方（承接方）</span><span class="ds-v">{{ current.counterparty || '—' }}</span></div>
          </div>
        </div>
        <div class="ds-section">
          <div class="ds-title">金额与佣金</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">订单金额</span><span class="ds-v num">{{ money(current.amount) }}</span></div>
            <div class="ds-item"><span class="ds-k">适用费率</span><span class="ds-v num">{{ (calc.rate * 100).toFixed(1) }}%</span></div>
            <div class="ds-item"><span class="ds-k">应计佣金</span><span class="ds-v num">{{ money(calc.fee) }}</span></div>
            <div class="ds-item"><span class="ds-k">已计提佣金</span><span class="ds-v num">{{ current.fee ? money(current.fee) : '¥0.00' }}</span></div>
          </div>
          <div v-if="calc.items && calc.items.length" class="calc-detail">
            <div v-for="(it, i) in calc.items" :key="i" class="calc-row">
              <span class="ck">{{ it.label }}（{{ Math.round(it.pct * 100) }}%）</span>
              <span class="cv num">{{ money(it.fee) }}</span>
            </div>
          </div>
          <div class="calc-tip">{{ calc.milestone ? '里程碑分账：订单金额 ≥5 万，佣金按 30/30/30/10 四节点分期；结算时按已达成节点比例计提。' : '整单结算：订单金额 <5 万，不启用里程碑分账，结算时一次性计提全额佣金。' }}</div>
        </div>
        <div class="ds-section">
          <div class="ds-title">里程碑进度（{{ doneCount(current) }}/{{ (current.milestones || []).length }}）</div>
          <div v-if="(current.milestones || []).length" class="ms-timeline">
            <div v-for="(m, i) in current.milestones" :key="i" class="ms-tl-item" :class="{ done: m.status === 'done' }">
              <div class="ms-tl-dot">{{ m.status === 'done' ? '✓' : (i + 1) }}</div>
              <div class="ms-tl-body">
                <div class="ms-tl-label">{{ m.label }}</div>
                <div class="ms-tl-meta">{{ Math.round(m.pct * 100) }}% · 佣金 {{ money(Math.round(calc.fee * m.pct * 100) / 100) }}
                  <span v-if="m.status === 'done' && m.doneAt"> · 达成于 {{ fmtDate(m.doneAt) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-muted">无里程碑节点</div>
        </div>
        <div class="ds-actions">
          <button v-if="!current._isMediation && current.status === 'pending'" class="btn btn--primary" @click="confirmTransition(current, 'serving', '确认支付后进入服务中？')">确认支付</button>
          <button v-if="!current._isMediation && current.status === 'serving'" class="btn btn--primary" @click="openMs(current)">推进里程碑</button>
          <button v-if="!current._isMediation && current.status === 'await_accept'" class="btn btn--primary" @click="confirmTransition(current, 'settled', '结算后按里程碑比例计提佣金，不可撤销。')">确认结算</button>
          <button v-if="!current._isMediation && ['pending','serving','await_accept'].includes(current.status)" class="btn btn--danger" @click="confirmTransition(current, 'cancelled', '取消后订单终止，不产生佣金。', true)">取消订单</button>
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
const TYPE: Record<string, string> = { supply: '供方承接', need: '需求匹配', agency: '中介撮合', transfer: '建企买卖', qual: '资质招商' };
const ST_LABEL: Record<string, string> = {
  pending: '待支付', serving: '服务中', await_accept: '待验收', settled: '已结算', cancelled: '已取消',
  escrowed: '已托管', await_confirm: '待验收', disputed: '纠纷中', refunded: '已退款', partial_refund: '部分退款', draft: '待支付',
};
const ST_CLASS: Record<string, string> = {
  settled: 'tag--green', serving: 'tag--blue', await_accept: 'tag--yellow', await_confirm: 'tag--yellow',
  pending: 'tag--yellow', draft: 'tag--yellow', cancelled: 'tag--gray', escrowed: 'tag--blue',
  disputed: 'tag--red', refunded: 'tag--gray', partial_refund: 'tag--gray',
};

const loading = ref(false);
const list = ref<any[]>([]);
const kind = ref<'all' | 'normal' | 'mediation'>('all');
const page = ref(1);
const pageSize = ref(10);
const filter = reactive({ type: '', status: '', q: '', dateRange: null as [string, string] | null });
const drawerVisible = ref(false);
const current = ref<any>(null);

const statusLabel = (s: string) => ST_LABEL[s] || s;
const statusClass = (s: string) => ST_CLASS[s] || 'tag--gray';
function money(n: any) { return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}
function doneCount(row: any) {
  return (row.milestones || []).filter((m: any) => m.status === 'done').length;
}

function listNormal() { return bus()?.orders ? bus().orders() : []; }
function listMediation() {
  if (!window.Mediation) return [];
  return window.Mediation.list().map((o: any) => {
    let sellerName = '';
    try { const su = bus()?.byId?.(o.sellerId); if (su) sellerName = su.name || su.company || o.sellerId; } catch {}
    return { id: o.id, kind: 'mediation', title: o.title || o.svcName || '中介托管订单', type: 'mediation',
      counterparty: sellerName || o.svcName || '', amount: o.amount, fee: o.fee || 0, status: o.state,
      milestones: o.milestones || [], ts: o.createdAt || 0, _isMediation: true, _raw: o };
  });
}

function load() {
  const n = listNormal().map((o: any) => ({ ...o, kind: 'normal', _isMediation: false }));
  const m = listMediation();
  list.value = kind.value === 'normal' ? n : kind.value === 'mediation' ? m : [...n, ...m].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((x: any) => {
    if (filter.type && x.type !== filter.type) return false;
    if (filter.status && x.status !== filter.status) return false;
    if (filter.dateRange && filter.dateRange[0] && fmtDate(x.ts) < filter.dateRange[0]) return false;
    if (filter.dateRange && filter.dateRange[1] && fmtDate(x.ts) > filter.dateRange[1]) return false;
    if (q && `${x.id}${x.title}${x.counterparty}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

const kpis = computed(() => {
  const c: Record<string, number> = { total: list.value.length, serving: 0, await_accept: 0, settled: 0, cancelled: 0 };
  let monthAmount = 0;
  const ym = new Date().toISOString().slice(0, 7);
  list.value.forEach((x: any) => {
    if (c[x.status] !== undefined) c[x.status]++;
    if (x.status === 'settled' && fmtDate(x.ts).slice(0, 7) === ym) monthAmount += Number(x.amount || 0);
  });
  return [
    { label: '总订单', value: c.total, hint: '全部类型合计' },
    { label: '进行中', value: c.serving, hint: '履约推进中' },
    { label: '待验收', value: c.await_accept, hint: '里程碑待确认' },
    { label: '已结算', value: c.settled, hint: '佣金已计提' },
    { label: '本月成交额', value: '¥' + monthAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), hint: '已结算订单金额' },
  ];
});

const calc = computed(() => {
  if (!current.value || !bus()?.orderCalc) return { rate: 0, fee: 0, items: [] as any[], milestone: false };
  return bus().orderCalc(current.value.amount) || { rate: 0, fee: 0, items: [], milestone: false };
});

function setKind(k: 'all' | 'normal' | 'mediation') { kind.value = k; page.value = 1; load(); }
function onFilter() { page.value = 1; }
function onReset() {
  filter.type = ''; filter.status = ''; filter.q = ''; filter.dateRange = null;
  page.value = 1;
}
function openDetail(row: any) {
  current.value = row;
  drawerVisible.value = true;
}
function confirmTransition(row: any, next: string, msg: string, danger = false) {
  ElMessageBox.confirm(msg, `确认操作 · ${row.id}`, {
    confirmButtonText: '确认', cancelButtonText: '取消', type: danger ? 'warning' : 'info',
  }).then(() => {
    const r = bus()?.orderTransition?.(row.id, next);
    if (!r) { ElMessage.error('未找到订单'); return; }
    if (r.error) { ElMessage.error(r.error); return; }
    ElMessage.success(`[${row.id}] 操作成功`);
    drawerVisible.value = false;
    load();
  }).catch(() => {});
}
function openMs(row: any) {
  const x = list.value.find((o: any) => o.id === row.id);
  if (!x) return;
  const c = bus()?.orderCalc?.(x.amount) || { rate: 0, fee: 0 };
  const ms = x.milestones || [];
  ElMessageBox({
    title: `里程碑验收 · ${x.id}`,
    message: () => (
      `<div class="ms-list">` + ms.map((m: any, i: number) => {
        const done = m.status === 'done';
        return `<div class="ms-node ${done ? 'done' : ''}">
          <span class="idx">${done ? '✓' : i + 1}</span>
          <span class="info"><div class="lbl">${m.label}</div><div class="amt">${Math.round(m.pct * 100)}% · 佣金 ¥${(c.fee * m.pct || 0).toFixed(2)}</div></span>
          <span class="st">${done ? '<span class="tag tag--green">已达成</span>' : `<button class="btn btn--primary btn--sm" data-ms="${i}" data-id="${x.id}">达成</button>`}</span>
        </div>`;
      }).join('') + `</div>`
    ),
  });
  setTimeout(() => {
    document.querySelectorAll('button[data-ms]').forEach((btn) => {
      (btn as HTMLElement).onclick = (e: Event) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).getAttribute('data-ms') || '0', 10);
        const r = bus()?.orderAdvanceMilestone?.(x.id, idx);
        if (!r) return;
        if (r.error) { ElMessage.error(r.error); return; }
        ElMessage.success('里程碑节点已达成');
        load();
      };
    });
  }, 100);
}
function onExport() {
  const rows = filtered.value.map((o: any) => [
    o.id, o._isMediation ? '中介托管' : (TYPE[o.type] || o.type), o.title || '',
    o.amount ?? '', o.status || '', fmtDate(o.ts), o.counterparty || '',
  ]);
  const header = ['订单号', '类型', '标题', '金额', '状态', '创建时间', '对方'];
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '订单列表.csv';
  a.click();
  ElMessage.success(`已导出 ${rows.length} 条`);
}
function onBusChange() { load(); }
function goCrm(row: any) { window.open('/admin-v2/admin/crm/companies?userId=' + (row.owner || row.buyer || row.seller || ''), '_self'); }
onMounted(() => {
  load();
  window.addEventListener('engchain:orders', onBusChange);
  window.addEventListener('engchain:mediation', onBusChange);
});
onUnmounted(() => {
  window.removeEventListener('engchain:orders', onBusChange);
  window.removeEventListener('engchain:mediation', onBusChange);
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
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item:hover { color: var(--font-secondary); }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
:deep(.el-table) { font-size: var(--font-size-md); }
.cell-main { color: var(--font-primary); line-height: 1.3; display: flex; gap: 6px; align-items: center; }
.cell-sub { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.num { font-variant-numeric: tabular-nums; font-weight: var(--font-weight-medium); }
.text-muted { color: var(--font-light); }
.ms-bar { display: flex; gap: 2px; align-items: center; }
.ms-seg { width: 16px; height: 6px; border-radius: 1px; background: var(--bg-tertiary); }
.ms-seg.done { background: var(--tag-bg-green); }
.ms-seg.cur { background: var(--color-blue); }
.row-sub { font-size: var(--font-size-xs); color: var(--font-light); margin-top: 2px; }
.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
.calc-detail { padding: 8px; background: var(--bg-secondary); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.calc-row { display: flex; justify-content: space-between; font-size: var(--font-size-sm); }
.calc-tip { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 8px; padding: 8px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
.ms-timeline { display: flex; flex-direction: column; gap: 12px; }
.ms-tl-item { display: flex; gap: 10px; }
.ms-tl-dot { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; background: var(--bg-tertiary); color: var(--font-tertiary); font-size: 11px; display: flex; align-items: center; justify-content: center; }
.ms-tl-item.done .ms-tl-dot { background: var(--tag-bg-green); color: var(--tag-text-green); }
.ms-tl-label { font-size: var(--font-size-md); color: var(--font-primary); font-weight: var(--font-weight-medium); }
.ms-tl-meta { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.ds-actions { display: flex; gap: 8px; margin-top: 8px; }
.crm-link { color: var(--color-blue); cursor: pointer; text-decoration: underline; }
</style>
