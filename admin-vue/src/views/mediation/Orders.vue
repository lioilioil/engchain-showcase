<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const matchOrders = ref([])

const stats = computed(() => {
  const list = matchOrders.value
  return {
    total: list.length,
    pending: list.filter(item => item.status === 'pending').length,
    matched: list.filter(item => item.status === 'matched').length,
    success: list.filter(item => item.status === 'success').length
  }
})

async function loadData() {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    matchOrders.value = [
      { id: 'm1', title: '求购螺纹钢 HRB400', type: 'demand', company: '张工建筑', amount: '100吨', status: 'pending', createdAt: '2026-10-08' },
      { id: 'm2', title: '供应水泥 P.O 42.5', type: 'supply', company: '李总建材', amount: '500吨', status: 'pending', createdAt: '2026-10-07' },
      { id: 'm3', title: '求购挖掘机租赁', type: 'demand', company: '王经理工程', amount: '3个月', status: 'matched', createdAt: '2026-10-06' },
      { id: 'm4', title: '供应劳务分包', type: 'supply', company: '刘总劳务', amount: '20人', status: 'matched', createdAt: '2026-10-05' },
      { id: 'm5', title: '求购模板脚手架', type: 'demand', company: '陈总建设', amount: '1000㎡', status: 'success', createdAt: '2026-10-03' }
    ]
  } finally {
    loading.value = false
  }
}

function handleMatch(row) {
  ElMessage.success(`已为 ${row.title} 匹配供方`)
  row.status = 'matched'
}

onMounted(loadData)
</script>

<template>
  <div class="match-orders-page" v-loading="loading">
    <div class="page-header">
      <h2>撮合订单</h2>
      <p class="page-desc">供需匹配与撮合订单管理</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.total }}</div>
        <div class="stat-item__label">总匹配数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.pending }}</div>
        <div class="stat-item__label">待匹配</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.matched }}</div>
        <div class="stat-item__label">已匹配</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.success }}</div>
        <div class="stat-item__label">已成交</div>
      </div>
    </div>

    <!-- 撮合列表 -->
    <el-table :data="matchOrders" size="default">
      <el-table-column prop="id" label="编号" width="80" />
      <el-table-column prop="title" label="供需标题" min-width="240" />
      <el-table-column label="方向" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.type === 'supply' ? 'success' : 'warning'">
            {{ row.type === 'supply' ? '供应' : '需求' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="company" label="发布方" width="140" />
      <el-table-column prop="amount" label="数量" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'pending' ? 'warning' : row.status === 'matched' ? 'primary' : 'success'">
            {{ row.status === 'pending' ? '待匹配' : row.status === 'matched' ? '已匹配' : '已成交' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="120" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'pending'"
            size="small"
            type="primary"
            link
            @click="handleMatch(row)"
          >
            立即匹配
          </el-button>
          <span v-else-if="row.status === 'matched'" style="color: #999; font-size: 12px">匹配中</span>
          <span v-else style="color: #1f883d; font-size: 12px">已成交</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.match-orders-page {
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
