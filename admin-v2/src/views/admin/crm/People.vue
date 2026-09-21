<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">客户管理</div>
        <h1 class="page-view__title">联系人</h1>
        <div class="page-view__sub">个人用户 / 企业主联系人（吞并原用户管理 · 个人身份视图）</div>
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
      <button class="tabs__item" :class="{ 'is-active': tab === 'all' }" @click="setTab('all')">全部联系人</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'verify' }" @click="setTab('verify')">待认证 <span v-if="pendingVerify" class="tag tag--yellow tabs__badge">{{ pendingVerify }}</span></button>
    </div>

    <div class="filter-bar card">
      <el-select v-model="filter.status" placeholder="认证状态" clearable size="small" style="width:140px" @change="onFilter">
        <el-option label="个人认证" value="realname" />
        <el-option label="专业入驻" value="pro" />
        <el-option label="注册会员" value="registered" />
      </el-select>
      <el-input v-model="filter.q" placeholder="搜索姓名 / 手机 / 公司" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id" @row-click="openDetail">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="联系人" min-width="220">
          <template #default="{ row }">
            <div class="cell-main">
              <span class="avatar-sm">{{ (row.name || '?').charAt(0) }}</span>
              <div>
                <div>{{ row.name }}</div>
                <div class="cell-sub">{{ row.company || row.account || '—' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="身份" width="120">
          <template #default="{ row }">
            <span class="tag" :class="stClass(row)">{{ stLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实名状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="row.auth?.realname?.ok ? 'tag--green' : 'tag--yellow'">
              {{ row.auth?.realname?.ok ? '已认证' : '待认证' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机" width="130" />
        <el-table-column label="注册时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="!row.auth?.realname?.ok" class="btn btn--primary btn--sm" @click.stop="approveVerify(row)">通过认证</button>
              <button class="btn btn--tertiary btn--sm" @click.stop="openDetail(row)">详情</button>
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

    <RightDrawer v-model="drawerVisible" :title="`联系人详情 · ${current?.name || ''}`">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">基本信息</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">姓名</span><span class="ds-v">{{ current.name }}</span></div>
            <div class="ds-item"><span class="ds-k">手机</span><span class="ds-v">{{ current.phone || '—' }}</span></div>
            <div class="ds-item"><span class="ds-k">身份</span><span class="ds-v"><span class="tag" :class="stClass(current)">{{ stLabel(current) }}</span></span></div>
            <div class="ds-item"><span class="ds-k">公司</span><span class="ds-v">{{ current.company || '—' }}</span></div>
            <div class="ds-item ds-full"><span class="ds-k">注册时间</span><span class="ds-v">{{ fmtDate(current.createdAt) }}</span></div>
          </div>
        </div>
        <div class="ds-section">
          <div class="ds-title">认证材料</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">实名</span><span class="ds-v">{{ current.auth?.realname?.ok ? '✓ 已认证' : '待认证' }}</span></div>
            <div class="ds-item"><span class="ds-k">资质</span><span class="ds-v">{{ current.auth?.qual?.ok ? '✓ 已认证' : '待认证' }}</span></div>
          </div>
        </div>
        <div class="ds-actions">
          <button v-if="!current.auth?.realname?.ok" class="btn btn--primary" @click="approveVerify(current)">通过实名认证</button>
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
const ST_LABEL: Record<string, string> = {
  resident: '企业入驻', enterprise: '企业认证', pro: '专业入驻', realname: '个人认证',
  registered: '注册会员', guest: '游客', banned: '已封禁',
};
const ST_CLASS: Record<string, string> = {
  resident: 'tag--gold', enterprise: 'tag--blue', pro: 'tag--sky', realname: 'tag--green',
  registered: 'tag--gray', guest: 'tag--gray', banned: 'tag--red',
};

const loading = ref(false);
const list = ref<any[]>([]);
const tab = ref<'all' | 'verify'>('all');
const page = ref(1);
const pageSize = ref(10);
const filter = reactive({ status: '', q: '' });
const drawerVisible = ref(false);
const current = ref<any>(null);

function fmtDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}
function stOf(u: any) { return bus()?.statusOf ? bus().statusOf(u) : (u.status || 'registered'); }
function stLabel(u: any) { return ST_LABEL[stOf(u)] || stOf(u); }
function stClass(u: any) { return ST_CLASS[stOf(u)] || 'tag--gray'; }
function load() { list.value = bus()?.users ? bus().users() : []; }
const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((u: any) => {
    const s = stOf(u);
    if (tab.value === 'verify' && u.auth?.realname?.ok) return false;
    if (filter.status && s !== filter.status) return false;
    if (q && `${u.name}${u.company}${u.account}${u.phone}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const pendingVerify = computed(() => list.value.filter((u: any) => !u.auth?.realname?.ok && stOf(u) !== 'guest').length);
const kpis = computed(() => {
  const all = list.value;
  let realname = 0, pro = 0;
  all.forEach((u: any) => {
    const s = stOf(u);
    if (s === 'realname') realname++;
    else if (s === 'pro') pro++;
  });
  return [
    { label: '总联系人', value: all.length, hint: '全部用户' },
    { label: '个人认证', value: realname, hint: '已完成实名' },
    { label: '专业入驻', value: pro, hint: '专业身份' },
    { label: '待认证', value: pendingVerify.value, hint: '需审核' },
  ];
});
function setTab(t: 'all' | 'verify') { tab.value = t; page.value = 1; }
function onFilter() { page.value = 1; }
function onReset() { filter.status = ''; filter.q = ''; page.value = 1; }
function openDetail(row: any) { current.value = row; drawerVisible.value = true; }
function approveVerify(row: any) {
  ElMessageBox.confirm('通过该用户实名认证？', '认证审核', { type: 'info' }).then(() => {
    bus()?.authApprove?.(row.id);
    ElMessage.success('已通过认证');
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
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
.cell-main { display: flex; gap: 10px; align-items: center; }
.avatar-sm { width: 32px; height: 32px; border-radius: 4px; background: var(--bg-tertiary); color: var(--font-secondary); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: var(--font-weight-medium); flex-shrink: 0; }
.cell-sub { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
.ds-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
