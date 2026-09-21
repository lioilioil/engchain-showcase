<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">中介中心</div>
        <h1 class="page-view__title">服务商</h1>
        <div class="page-view__sub">入驻中介服务商审核 / 等级 / 评价</div>
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
    <div class="card table-card">
      <el-table :data="list" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="name" label="服务商" min-width="180" />
        <el-table-column prop="contact" label="联系人" width="120" />
        <el-table-column label="等级" width="100">
          <template #default="{ row }">
            <span class="tag" :class="row.level === 'gold' ? 'tag--gold' : row.level === 'silver' ? 'tag--gray' : 'tag--blue'">{{ row.level || '普通' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="完成单数" width="100">
          <template #default="{ row }">{{ row.doneCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="评分" width="90">
          <template #default="{ row }">⭐ {{ (row.rating || 0).toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.approved ? 'tag--green' : 'tag--yellow'">{{ row.approved ? '已认证' : '待审核' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="!row.approved" class="btn btn--primary btn--sm" @click="approve(row)">通过</button>
              <button v-if="!row.approved" class="btn btn--danger btn--sm" @click="reject(row)">驳回</button>
            </div>
          </template>
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
const loading = ref(false);
const list = ref<any[]>([]);
function load() { list.value = (window as any).Mediation?.sellers?.() || (window as any).Mediation?.listSellers?.() || []; }
const kpis = computed(() => ({
  value: list.value.length,
}));
function approve(row: any) {
  ElMessageBox.confirm('通过该服务商认证？', '认证审核', { type: 'info' }).then(() => {
    (window as any).Mediation?.approveSeller?.(row.id);
    ElMessage.success('已通过'); load();
  }).catch(() => {});
}
function reject(row: any) {
  ElMessageBox.prompt('驳回原因', '驳回认证', { inputPlaceholder: '原因…' }).then(({ value }) => {
    (window as any).Mediation?.rejectSeller?.(row.id, value);
    ElMessage.success('已驳回'); load();
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
.kpis { display: grid; grid-template-columns: repeat(1, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.table-card { padding: 0; overflow: hidden; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
</style>
