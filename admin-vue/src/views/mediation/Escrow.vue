<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const escrowList = ref([])

const stats = computed(() => {
  const list = escrowList.value
  return {
    totalEscrow: list.reduce((sum, item) => sum + (item.amount || 0), 0),
    pending: list.filter(item => item.status === 'holding').reduce((sum, item) => sum + (item.amount || 0), 0),
    released: list.filter(item => item.status === 'released').reduce((sum, item) => sum + (item.amount || 0), 0)
  }
})

async function loadData() {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    escrowList.value = [
      { id: 'e1', orderId: 'o-1001', buyer: '张工', seller: '李总', amount: 5000, status: 'holding', createdAt: '2026-10-08' },
      { id: 'e2', orderId: 'o-1003', buyer: '王经理', seller: '刘总', amount: 12000, status: 'holding', createdAt: '2026-10-07' },
      { id: 'e3', orderId: 'o-1005', buyer: '陈总', seller: '赵工', amount: 3500, status: 'released', createdAt: '2026-10-05' },
      { id: 'e4', orderId: 'o-1007', buyer: '孙总', seller: '钱工', amount: 8000, status: 'released', createdAt: '2026-10-03' }
    ]
  } finally {
    loading.value = false
  }
}

function handleRelease(row) {
  // 银行托管已于 Phase 0 下线：不再提供任何资金释放操作
}

onMounted(loadData)
</script>

<template>
  <div class="escrow-page" v-loading="loading">
    <div class="page-header">
      <h2>资金托管（历史台账）</h2>
      <p class="page-desc">银行托管已于 Phase 0 下线，本页仅为历史快照，不提供任何资金操作</p>
    </div>
    <el-alert type="warning" :closable="false" show-icon title="银行托管已于 Phase 0 下线：平台不碰交易资金、不抽佣，以下仅为历史累计快照" style="margin-bottom: 8px" />

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.totalEscrow.toLocaleString() }}</div>
        <div class="stat-item__label">托管总金额</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.pending.toLocaleString() }}</div>
        <div class="stat-item__label">托管中</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.released.toLocaleString() }}</div>
        <div class="stat-item__label">已释放</div>
      </div>
    </div>

    <!-- 托管列表 -->
    <el-table :data="escrowList" size="default">
      <el-table-column prop="id" label="托管编号" width="100" />
      <el-table-column prop="orderId" label="关联订单" width="140" />
      <el-table-column prop="buyer" label="付款方" width="120" />
      <el-table-column prop="seller" label="收款方" width="120" />
      <el-table-column label="托管金额" width="120">
        <template #default="{ row }">
          <span style="font-weight: 600">¥{{ row.amount.toLocaleString() }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'holding' ? 'warning' : 'success'">
            {{ row.status === 'holding' ? '托管中' : '已释放' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="120" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <span style="color: #999; font-size: 12px">历史快照</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.escrow-page {
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
