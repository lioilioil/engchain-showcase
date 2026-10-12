<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref({
  users: [],
  supply: [],
  orders: []
})

const funnelData = computed(() => {
  const { users, supply, orders } = data.value
  return [
    { stage: '注册用户', count: users.length, rate: 100 },
    { stage: '完成认证', count: users.filter(u => u.auth?.realname?.ok).length, rate: 0 },
    { stage: '发布供需', count: supply.length, rate: 0 },
    { stage: '产生订单', count: orders.length, rate: 0 },
    { stage: '完成成交', count: orders.filter(o => o.status === 'settled').length, rate: 0 }
  ].map(item => ({
    ...item,
    rate: Math.round((item.count / (data.value.users.length || 1)) * 100)
  }))
})

async function loadData() {
  loading.value = true
  try {
    const [users, supply, orders] = await Promise.all([
      api.user.list(),
      api.supply.list(),
      api.order.list()
    ])
    data.value = { users, supply, orders }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="growth-page" v-loading="loading">
    <div class="page-header">
      <h2>增长分析</h2>
      <p class="page-desc">用户转化漏斗与关键增长指标</p>
    </div>

    <div class="section-block">
      <h3>用户转化漏斗</h3>
      <div class="funnel-list">
        <div v-for="(item, index) in funnelData" :key="item.stage" class="funnel-item">
          <div class="funnel-item__label">{{ item.stage }}</div>
          <div class="funnel-item__bar-wrap">
            <div
              class="funnel-item__bar"
              :style="{ width: item.rate + '%', backgroundColor: index === 0 ? '#1f883d' : '' }"
            />
          </div>
          <div class="funnel-item__value">{{ item.count }} 人 · {{ item.rate }}%</div>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ data.value.users?.length || 0 }}</div>
        <div class="stat-item__label">总用户数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ data.value.supply?.length || 0 }}</div>
        <div class="stat-item__label">供需信息数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ data.value.orders?.length || 0 }}</div>
        <div class="stat-item__label">总订单数</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">
          {{ funnelData[4] ? funnelData[4].rate + '%' : '-' }}
        </div>
        <div class="stat-item__label">最终转化率</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.growth-page {
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

.funnel-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.funnel-item {
  display: flex;
  align-items: center;
  gap: $spacing-md;

  &__label {
    width: 100px;
    font-size: 13px;
    color: $color-text-regular;
    text-align: right;
  }

  &__bar-wrap {
    flex: 1;
    height: 28px;
    background: $color-bg-page;
    border-radius: $radius-sm;
    overflow: hidden;
  }

  &__bar {
    height: 100%;
    background: linear-gradient(90deg, #1f883d, #2ea043);
    border-radius: $radius-sm;
    transition: width 0.3s;
  }

  &__value {
    width: 140px;
    font-size: 13px;
    font-weight: 500;
    color: $color-text-primary;
  }
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
</style>
