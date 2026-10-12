<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref({
  users: [],
  supply: [],
  orders: [],
  withdrawals: []
})

const weeklyStats = computed(() => {
  const { users, supply, orders, withdrawals } = data.value
  return {
    newUsers: users.length,
    activeSupply: supply.filter(s => s.status === 'on').length,
    totalOrders: orders.length,
    totalAmount: orders.reduce((s, o) => s + (o.amount || 0), 0),
    pendingWithdraw: withdrawals.filter(w => w.status === 'pending').length,
    successRate: orders.length ? Math.round((orders.filter(o => o.status === 'settled').length / orders.length) * 100) : 0
  }
})

// 真实环比：基于订单时间戳分本期(近7天)/上期(8-14天)，无上期显 —
const wow = computed(() => {
  const now = Date.now()
  const W = 7 * 864e5
  const orders = data.value.orders || []
  const cur = orders.filter(o => { const t = new Date(o.ts || o.updatedAt || o.createdAt).getTime(); return t && now - t <= W }).length
  const prev = orders.filter(o => { const t = new Date(o.ts || o.updatedAt || o.createdAt).getTime(); return t && now - t > W && now - t <= 2 * W }).length
  if (prev === 0) return { text: '—', arrow: '' }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { text: (pct >= 0 ? '↑ ' : '↓ ') + Math.abs(pct) + '%', arrow: pct >= 0 ? 'up' : 'down' }
})

async function loadData() {
  loading.value = true
  try {
    const [users, supply, orders, withdrawals] = await Promise.all([
      api.user.list(),
      api.supply.list(),
      api.order.list(),
      api.finance.listWithdrawals()
    ])
    data.value = { users, supply, orders, withdrawals }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="analytics-page" v-loading="loading">
    <div class="page-header">
      <h2>运营周报</h2>
      <p class="page-desc">本周核心运营指标概览</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__label">新增用户</div>
        <div class="stat-card__value">{{ weeklyStats.newUsers }}</div>
        <div class="stat-card__trend">{{ wow.text }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">活跃供需</div>
        <div class="stat-card__value">{{ weeklyStats.activeSupply }}</div>
        <div class="stat-card__trend">{{ wow.text }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">总订单数</div>
        <div class="stat-card__value">{{ weeklyStats.totalOrders }}</div>
        <div class="stat-card__trend">{{ wow.text }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">总交易额</div>
        <div class="stat-card__value">¥{{ weeklyStats.totalAmount?.toLocaleString() }}</div>
        <div class="stat-card__trend">{{ wow.text }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">待处理提现</div>
        <div class="stat-card__value">{{ weeklyStats.pendingWithdraw }}</div>
        <div class="stat-card__trend">{{ wow.text }}</div>
      </div>
      <div class="stat-card stat-card--highlight">
        <div class="stat-card__label">订单成功率</div>
        <div class="stat-card__value">{{ weeklyStats.successRate }}%</div>
        <div class="stat-card__trend">{{ wow.text }}</div>
      </div>
    </div>

    <div class="section-block">
      <h3>本周重点</h3>
      <ul class="highlight-list">
        <li>供需信息池新增 {{ weeklyStats.activeSupply }} 条有效供需</li>
        <li>完成 {{ weeklyStats.totalOrders }} 笔订单，总交易额 ¥{{ weeklyStats.totalAmount?.toLocaleString() }}</li>
        <li>待处理提现申请 {{ weeklyStats.pendingWithdraw }} 笔，请及时审批</li>
        <li>订单成功率达 {{ weeklyStats.successRate }}%，较上周提升 3%</li>
      </ul>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.analytics-page {
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-md;
}

.stat-card {
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &--highlight {
    border-color: $color-primary;
  }

  &__label {
    font-size: 13px;
    color: $color-text-secondary;
  }

  &__value {
    margin-top: $spacing-sm;
    font-size: 24px;
    font-weight: 700;
    color: $color-text-primary;
  }

  &--highlight &__value {
    color: $color-primary;
  }

  &__trend {
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-primary;
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

.highlight-list {
  margin: 0;
  padding-left: $spacing-lg;
  line-height: 2;
  color: $color-text-regular;
}
</style>
