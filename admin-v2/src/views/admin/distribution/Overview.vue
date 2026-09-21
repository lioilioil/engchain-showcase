<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">分销中心</div>
        <h1 class="page-view__title">分销总览</h1>
        <div class="page-view__sub">分销网络规模 · 团队数 · 累计结算</div>
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
    <!-- 渠道排行榜 -->
    <div class="card">
      <div class="card-title">本月渠道业绩 Top 5</div>
      <div v-for="(t, i) in topAgents" :key="t.id" class="rank-row">
        <div class="rank-num" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">{{ i + 1 }}</div>
        <div class="rank-name">{{ t.name }}</div>
        <div class="rank-team">{{ t.team }}</div>
        <div class="rank-amount num">¥{{ t.sales.toLocaleString() }}</div>
        <span class="tag" :class="levelTag(t.level)">{{ t.level }}</span>
      </div>
    </div>

    <div class="card table-card">
      <div class="card-title">分销团队列表</div>
      <el-table :data="teams" v-loading="loading" stripe row-key="id">
        <el-table-column prop="id" label="团队 ID" width="120" />
        <el-table-column prop="name" label="团队名称" min-width="200" />
        <el-table-column prop="leaderName" label="团长" width="140" />
        <el-table-column label="成员数" width="100">
          <template #default="{ row }">{{ row.memberCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="累计佣金" width="140">
          <template #default="{ row }"><b class="num">¥{{ Number(row.totalCommission || 0).toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.active ? 'tag--green' : 'tag--gray'">{{ row.active ? '活跃' : '休眠' }}</span>
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
const teams = ref<any[]>([]);
const topAgents = computed(() => {
  const agents = [
    { id: 'A001', name: '陈建国', team: '成都建筑一队', sales: 450000, level: '金牌' },
    { id: 'A002', name: '李明', team: '重庆中介团队', sales: 320000, level: '银牌' },
    { id: 'A003', name: '王芳', team: '西安服务商组', sales: 680000, level: '金牌' },
    { id: 'A004', name: '张伟', team: '北京渠道部', sales: 180000, level: '铜牌' },
    { id: 'A005', name: '刘洋', team: '深圳拓展组', sales: 95000, level: '铜牌' },
  ];
  return agents.sort((a, b) => b.sales - a.sales).slice(0, 5);
});
function levelTag(level: string) {
  if (level === '金牌') return 'tag--gold';
  if (level === '银牌') return 'tag--gray';
  return 'tag--bronze';
}
function load() {
  teams.value = (window as any).DistStore?.teams?.() || [];
  if (!teams.value.length) {
    teams.value = [
      { id: 'T1', name: '成都建筑一队', leader: '陈建国', members: 12, totalSales: 450000, commission: 22500, status: 'active' },
      { id: 'T2', name: '重庆中介团队', leader: '李明', members: 8, totalSales: 320000, commission: 16000, status: 'active' },
      { id: 'T3', name: '西安服务商组', leader: '王芳', members: 15, totalSales: 680000, commission: 34000, status: 'active' },
    ];
  }
}
const kpis = computed(() => {
  const totalCommission = teams.value.reduce((s, t) => s + Number(t.totalCommission || 0), 0);
  const members = teams.value.reduce((s, t) => s + Number(t.memberCount || 0), 0);
  return [
    { label: '团队总数', value: teams.value.length, hint: '分销团队' },
    { label: '成员总数', value: members, hint: '下级代理' },
    { label: '累计佣金', value: '¥' + totalCommission.toFixed(2), hint: '已结算' },
    { label: '活跃团队', value: teams.value.filter((t) => t.active).length, hint: '近 30 天有产出' },
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
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.rank-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light); }
.rank-row:last-child { border-bottom: none; }
.rank-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: var(--bg-tertiary); color: var(--font-tertiary); }
.rank-num.gold { background: #fbbf24; color: #fff; }
.rank-num.silver { background: #9ca3af; color: #fff; }
.rank-num.bronze { background: #b45309; color: #fff; }
.rank-name { flex: 1; font-weight: 500; }
.rank-team { color: var(--font-tertiary); font-size: 13px; width: 120px; }
.rank-amount { width: 100px; text-align: right; font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
.table-card { padding: 16px; }
.card-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-secondary); margin-bottom: 12px; }
.num { font-variant-numeric: tabular-nums; }
</style>
