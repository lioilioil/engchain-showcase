<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const orders = ref([])

async function loadData() {
  loading.value = true
  try {
    const list = await api.order.list()
    orders.value = list.filter(o => o.status === 'serving' || o.status === 'await_accept')
  } finally { loading.value = false }
}

onMounted(loadData)
</script>

<template>
  <div class="esign-orders-page" v-loading="loading">
    <div class="page-header">
      <h2>签署订单</h2>
      <p class="page-desc">待签署/进行中的电子合同订单</p>
    </div>
    <el-table :data="orders" size="default">
      <el-table-column prop="id" label="订单号" width="160" />
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="counterparty" label="甲方" width="140" />
      <el-table-column label="金额" width="120">
        <template #default="{ row }">¥{{ row.amount?.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'serving' ? 'primary' : 'warning'">
            {{ row.status === 'serving' ? '服务中' : '待验收' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && orders.length === 0" description="暂无待签署订单" />
  </div>
</template>

<style lang="scss" scoped>
.esign-orders-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
