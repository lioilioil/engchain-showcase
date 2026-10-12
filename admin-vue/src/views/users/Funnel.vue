<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref({ users: [], supply: [], orders: [] })

const funnel = computed(() => {
  const total = data.value.users.length || 1
  const stages = [
    { name: '注册', count: data.value.users.length },
    { name: '完成认证', count: data.value.users.filter(u => u.auth?.realname?.ok).length },
    { name: '发布供需', count: data.value.supply.length },
    { name: '产生订单', count: data.value.orders.length },
    { name: '完成成交', count: data.value.orders.filter(o => o.status === 'settled').length }
  ]
  return stages.map(s => ({ ...s, rate: Math.round((s.count / total) * 100) }))
})

async function loadData() {
  loading.value = true
  try {
    const [users, supply, orders] = await Promise.all([api.user.list(), api.supply.list(), api.order.list()])
    data.value = { users, supply, orders }
  } finally { loading.value = false }
}

onMounted(loadData)
</script>

<template>
  <div class="funnel-page" v-loading="loading">
    <div class="page-header">
      <h2>转化漏斗</h2>
      <p class="page-desc">用户从注册到成交的转化分析</p>
    </div>
    <div class="funnel-list">
      <div v-for="(item, i) in funnel" :key="item.name" class="funnel-item">
        <div class="funnel-item__label">{{ item.name }}</div>
        <div class="funnel-item__bar-wrap">
          <div class="funnel-item__bar" :style="{ width: item.rate + '%' }" />
        </div>
        <div class="funnel-item__value">{{ item.count }} · {{ item.rate }}%</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.funnel-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.funnel-list { display: flex; flex-direction: column; gap: $spacing-md; }
.funnel-item { display: flex; align-items: center; gap: $spacing-md;
  &__label { width: 100px; text-align: right; font-size: 13px; }
  &__bar-wrap { flex: 1; height: 28px; background: $color-bg-page; border-radius: $radius-sm; overflow: hidden; }
  &__bar { height: 100%; background: linear-gradient(90deg, #1f883d, #2ea043); border-radius: $radius-sm; }
  &__value { width: 140px; font-size: 13px; font-weight: 500; }
}
</style>
