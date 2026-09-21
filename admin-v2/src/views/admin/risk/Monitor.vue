<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">风控中心</div>
        <h1 class="page-view__title">风控监控</h1>
        <div class="page-view__sub">实时风险指标 · 告警 · 异常行为</div>
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
      <div class="card-title">实时告警</div>
      <el-table :data="alerts" v-loading="loading" stripe row-key="id">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTs(row.ts) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.level === 'high' ? 'tag--red' : row.level === 'mid' ? 'tag--yellow' : 'tag--blue'">
              {{ row.level === 'high' ? '高' : row.level === 'mid' ? '中' : '低' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="140" />
        <el-table-column prop="desc" label="描述" min-width="240" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.handled ? 'tag--gray' : 'tag--yellow'">{{ row.handled ? '已处理' : '待处理' }}</span>
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
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const loading = ref(false);
const alerts = ref<any[]>([]);
function fmtTs(ts: any) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function load() {
  alerts.value = (window as any).RiskMonitor?.alerts?.() || [];
  if (!alerts.value.length) {
    alerts.value = [
      { id: 'AL001', level: 'high', title: '异常登录检测', desc: '账号 admin 从非常用 IP 登录', ts: Date.now() - 86400000*1 },
      { id: 'AL002', level: 'medium', title: '高频提现', desc: '用户 张三 24 小时内发起 5 次提现', ts: Date.now() - 86400000*2 },
      { id: 'AL003', level: 'low', title: '新用户注册', desc: '今日新增注册用户 3 人', ts: Date.now() - 86400000*4 },
    ];
  }
}
const kpis = computed(() => {
  const high = alerts.value.filter((a: any) => a.level === 'high' && !a.handled).length;
  const pending = alerts.value.filter((a: any) => !a.handled).length;
  return [
    { label: '待处理告警', value: pending, hint: '全部级别' },
    { label: '高危告警', value: high, hint: '需立即处理' },
  ];
});
onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.table-card { padding: 16px; }
.card-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-secondary); margin-bottom: 12px; }
</style>
