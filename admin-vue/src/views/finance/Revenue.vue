<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const revenueData = ref([])

const stats = computed(() => {
  const list = revenueData.value
  return {
    totalRevenue: list.reduce((sum, item) => sum + (item.amount || 0), 0),
    thisMonth: list.filter(item => {
      const d = new Date(item.date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((sum, item) => sum + (item.amount || 0), 0),
    orders: list.length
  }
})

async function loadData() {
  loading.value = true
  try {
    // mock 收入数据
    await new Promise(resolve => setTimeout(resolve, 300))
    revenueData.value = [
      { id: 'r1', type: '入驻费', amount: 2980, date: '2026-10-08', source: '企业入驻' },
      { id: 'r2', type: '入驻费', amount: 1980, date: '2026-10-07', source: '中介入驻' },
      { id: 'r3', type: '撮合佣金', amount: 2500, date: '2026-10-06', source: '订单 #1001' },
      { id: 'r4', type: '增值道具', amount: 99, date: '2026-10-05', source: '供需置顶' },
      { id: 'r5', type: '撮合佣金', amount: 4800, date: '2026-10-04', source: '订单 #1003' },
      { id: 'r6', type: '入驻费', amount: 2980, date: '2026-10-03', source: '企业入驻' },
      { id: 'r7', type: '增值道具', amount: 199, date: '2026-10-02', source: '认证徽章' }
    ]
  } finally {
    loading.value = false
  }
}

function handleExport() {
  ElMessage.info('导出功能开发中')
}

onMounted(loadData)
</script>

<template>
  <div class="revenue-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>收入看板</h2>
        <p class="page-desc">平台各项收入统计与明细</p>
      </div>
      <el-button @click="handleExport">导出报表</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.totalRevenue.toLocaleString() }}</div>
        <div class="stat-item__label">累计总收入</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.thisMonth.toLocaleString() }}</div>
        <div class="stat-item__label">本月收入</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.orders }}</div>
        <div class="stat-item__label">收入笔数</div>
      </div>
    </div>

    <!-- 收入明细表格 -->
    <el-table :data="revenueData" size="default">
      <el-table-column prop="id" label="流水号" width="100" />
      <el-table-column prop="type" label="收入类型" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="amount" label="金额" width="120">
        <template #default="{ row }">
          <span style="color: #1f883d; font-weight: 600">+¥{{ row.amount.toLocaleString() }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="source" label="来源" min-width="200" />
      <el-table-column prop="date" label="日期" width="120" />
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.revenue-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

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
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__value {
    font-size: 24px;
    font-weight: 700;
    color: $color-text-primary;
    margin-bottom: $spacing-xs;
  }

  &__label {
    font-size: 13px;
    color: $color-text-secondary;
  }
}
</style>
