<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">财务中心</div>
        <h1 class="page-view__title">积分管理</h1>
        <div class="page-view__sub">积分发放 / 消耗 / 流通量（与 App 积分系统同源）</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--primary" @click="openGrant"><AppIcon name="plus" :size="14" />发放积分</button>
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
      <el-select v-model="filter.type" placeholder="类型" clearable size="small" style="width:120px" @change="onFilter">
        <el-option label="发放" value="grant" />
        <el-option label="消耗" value="consume" />
      </el-select>
      <el-input v-model="filter.q" placeholder="搜索用户 / 备注" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="用户" min-width="140">
          <template #default="{ row }">{{ row.userName || row.userId }}</template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.type === 'grant' ? 'tag--green' : 'tag--red'">{{ row.type === 'grant' ? '发放' : '消耗' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="100">
          <template #default="{ row }">
            <b :style="{ color: row.type === 'grant' ? 'var(--tag-text-green)' : 'var(--tag-text-red)' }">
              {{ row.type === 'grant' ? '+' : '-' }}{{ row.amount }}
            </b>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="备注" min-width="200" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
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

    <el-dialog v-model="grantVisible" title="发放积分" width="480px">
      <el-form :model="grantForm" label-width="80px">
        <el-form-item label="用户 ID"><el-input v-model="grantForm.userId" /></el-form-item>
        <el-form-item label="数量"><el-input-number v-model="grantForm.amount" :min="1" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="grantForm.reason" placeholder="发放原因" /></el-form-item>
      </el-form>
      <template #footer>
        <button class="btn btn--tertiary" @click="grantVisible = false">取消</button>
        <button class="btn btn--primary" @click="doGrant">确认发放</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';

const loading = ref(false);
const list = ref<any[]>([]);
const stats = ref<any>({ totalIssued: 0, totalConsumed: 0, currentCirculation: 0, userCount: 0 });
const page = ref(1);
const pageSize = ref(15);
const filter = reactive({ type: '', q: '' });
const grantVisible = ref(false);
const grantForm = reactive({ userId: '', amount: 100, reason: '' });

function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function load() {
  list.value = (window as any).AdminCredits?.load?.() || [];
  stats.value = (window as any).AdminCredits?.stats?.() || { totalIssued: 0, totalConsumed: 0, currentCirculation: 0, userCount: 0 };
}
const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((x: any) => {
    if (filter.type && x.type !== filter.type) return false;
    if (q && `${x.userName}${x.userId}${x.reason}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const kpis = computed(() => [
  { label: '累计发放', value: stats.value.totalIssued || 0, hint: '历史总量' },
  { label: '累计消耗', value: stats.value.totalConsumed || 0, hint: '已核销' },
  { label: '当前流通', value: stats.value.currentCirculation || 0, hint: '用户持有' },
  { label: '活跃用户', value: stats.value.userCount || 0, hint: '持有积分用户' },
]);
function onFilter() { page.value = 1; }
function onReset() { filter.type = ''; filter.q = ''; page.value = 1; }
function openGrant() { grantForm.userId = ''; grantForm.amount = 100; grantForm.reason = ''; grantVisible.value = true; }
function doGrant() {
  (window as any).AdminCredits?.add?.({ uid: grantForm.userId, amount: grantForm.amount, type: 'grant', reason: grantForm.reason });
  ElMessage.success('已发放');
  grantVisible.value = false;
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
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
</style>
