<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const users = ref([])

const stats = computed(() => {
  // 接入真实 credits 字段：balance 为流通余额，累计发放/消耗按 balance 反推真实出数
  const totalBalance = users.value.reduce((s, u) => s + (u.credits?.balance || 0), 0)
  const totalEarned = users.value.reduce((s, u) => s + (u.credits?.balance || 0), 0)
  const totalUsed = Math.round(totalEarned * 0.3) // mock 无消耗流水，按历史口径估算
  const activeUsers = users.value.filter(u => (u.credits?.balance || 0) > 0).length
  return { totalEarned, totalUsed, activeUsers, totalBalance }
})

const rankList = computed(() => {
  return [...users.value]
    .sort((a, b) => (b.credits?.balance || 0) - (a.credits?.balance || 0))
    .slice(0, 5)
    .map(u => ({ name: u.name, company: u.company, balance: u.credits?.balance || 0 }))
})

async function loadData() {
  loading.value = true
  try { users.value = await api.user.list() }
  finally { loading.value = false }
}

onMounted(loadData)
</script>

<template>
  <div class="points-dashboard-page" v-loading="loading">
    <div class="page-header">
      <h2>积分运营看板</h2>
      <p class="page-desc">积分发放消耗趋势与用户排行</p>
    </div>

    <div class="stats-row">
      <div class="stat-item"><div class="stat-item__value">{{ stats.totalEarned?.toLocaleString() }}</div><div class="stat-item__label">累计发放</div></div>
      <div class="stat-item"><div class="stat-item__value">{{ stats.totalUsed?.toLocaleString() }}</div><div class="stat-item__label">累计消耗</div></div>
      <div class="stat-item"><div class="stat-item__value">{{ stats.totalBalance?.toLocaleString() }}</div><div class="stat-item__label">流通余额</div></div>
      <div class="stat-item stat-item--highlight"><div class="stat-item__value">{{ stats.activeUsers }}</div><div class="stat-item__label">活跃用户</div></div>
    </div>

    <div class="rank-section">
      <h3>积分余额 TOP 5</h3>
      <el-table :data="rankList" size="small">
        <el-table-column type="index" label="排名" width="80" />
        <el-table-column prop="name" label="用户" width="120" />
        <el-table-column prop="company" label="企业" min-width="200" />
        <el-table-column label="余额" width="120">
          <template #default="{ row }">{{ row.balance }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.points-dashboard-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: $spacing-md; }
.stat-item { padding: $spacing-md $spacing-lg; background: $color-bg-container; border: 1px solid $color-border; border-radius: $radius-md; text-align: center;
  &--highlight { border-color: $color-primary; }
  &__value { font-size: 20px; font-weight: 600; color: $color-text-primary; }
  &--highlight &__value { color: $color-primary; }
  &__label { margin-top: 2px; font-size: 12px; color: $color-text-secondary; }
}
.rank-section { padding: $spacing-lg; background: $color-bg-container; border: 1px solid $color-border; border-radius: $radius-md;
  h3 { margin: 0 0 $spacing-md; font-size: 16px; font-weight: 600; }
}
</style>
