<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const users = ref([])

const stats = computed(() => {
  const totalBalance = users.value.reduce((s, u) => s + (u.credits?.balance || 0), 0)
  const totalEarned = users.value.reduce((s, u) => s + (u.credits?.totalEarned || 0), 0)
  const totalUsed = users.value.reduce((s, u) => s + (u.credits?.totalUsed || 0), 0)
  return { totalBalance, totalEarned, totalUsed, userCount: users.value.length }
})

async function loadData() {
  loading.value = true
  try {
    users.value = await api.user.list()
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="credits-page" v-loading="loading">
    <div class="page-header">
      <h2>积分管理</h2>
      <p class="page-desc">平台积分全局统计与用户明细</p>
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.userCount }}</div>
        <div class="stat-item__label">积分用户数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.totalBalance?.toLocaleString() }}</div>
        <div class="stat-item__label">总积分余额</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.totalEarned?.toLocaleString() }}</div>
        <div class="stat-item__label">累计发放</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">{{ stats.totalUsed?.toLocaleString() }}</div>
        <div class="stat-item__label">累计消耗</div>
      </div>
    </div>

    <div class="section-block">
      <h3>用户积分明细</h3>
      <el-table :data="users" size="small">
        <el-table-column prop="name" label="用户" width="120" />
        <el-table-column prop="company" label="企业" min-width="200" />
        <el-table-column label="当前余额" width="120">
          <template #default="{ row }">{{ row.credits?.balance || 0 }}</template>
        </el-table-column>
        <el-table-column label="累计获得" width="120">
          <template #default="{ row }">{{ row.credits?.totalEarned || 0 }}</template>
        </el-table-column>
        <el-table-column label="累计消耗" width="120">
          <template #default="{ row }">{{ row.credits?.totalUsed || 0 }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.credits-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.page-desc {
  margin: $spacing-xs 0 0;
  font-size: 13px;
  color: $color-text-secondary;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-md;
}

.stat-item {
  padding: $spacing-md $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  text-align: center;

  &--highlight {
    border-color: $color-primary;
  }

  &__value {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
  }

  &--highlight &__value {
    color: $color-primary;
  }

  &__label {
    margin-top: 2px;
    font-size: 12px;
    color: $color-text-secondary;
  }
}

.section-block {
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  h3 {
    margin: 0 0 $spacing-md;
    font-size: 16px;
    font-weight: 600;
  }
}
</style>
