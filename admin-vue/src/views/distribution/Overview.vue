<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const teamList = ref([])
const flowList = ref([])

const stats = computed(() => {
  const totalTeam = teamList.value.length
  const totalChildren = teamList.value.reduce((s, t) => s + (t.children?.length || 0), 0)
  const totalFlow = flowList.value.reduce((s, f) => s + (f.amount || 0), 0)
  return { totalTeam, totalChildren, totalFlow }
})

async function loadData() {
  loading.value = true
  try {
    const [teams, flows] = await Promise.all([
      api.distribution.listTeams(),
      api.distribution.listFlows()
    ])
    teamList.value = teams
    flowList.value = flows
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="distribution-overview-page" v-loading="loading">
    <div class="page-header">
      <h2>分销总览</h2>
      <p class="page-desc">分销团队与返佣流水</p>
    </div>

    <!-- 统计 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.totalTeam }}</div>
        <div class="stat-item__label">团队数量</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.totalChildren }}</div>
        <div class="stat-item__label">下级成员</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">¥{{ stats.totalFlow?.toLocaleString() }}</div>
        <div class="stat-item__label">累计返佣</div>
      </div>
    </div>

    <!-- 团队列表 -->
    <div class="section-block">
      <h3>团队列表</h3>
      <div class="team-list">
        <div v-for="team in teamList" :key="team.id" class="team-card">
          <div class="team-card__info">
            <div class="team-card__name">{{ team.name }}</div>
            <div class="team-card__meta">
              <span>{{ team.level }}级</span>
              <span>下级 {{ team.children?.length || 0 }} 人</span>
            </div>
          </div>
          <div class="team-card__commission">
            返佣率 {{ (team.rate * 100).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- 返佣流水 -->
    <div class="section-block">
      <h3>近期返佣流水</h3>
      <el-table :data="flowList" size="small">
        <el-table-column prop="id" label="流水号" width="100" />
        <el-table-column prop="userName" label="用户" width="120" />
        <el-table-column prop="orderId" label="关联订单" width="160" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <span style="color: #1f883d">+¥{{ row.amount?.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="ts" label="时间" width="160" />
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.distribution-overview-page {
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
  grid-template-columns: repeat(3, 1fr);
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

.team-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-md;
}

.team-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md;
  border: 1px solid $color-border;
  border-radius: $radius-sm;

  &__name {
    font-weight: 500;
  }

  &__meta {
    display: flex;
    gap: $spacing-md;
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-text-secondary;
  }

  &__commission {
    font-size: 13px;
    color: $color-primary;
    font-weight: 500;
  }
}
</style>
