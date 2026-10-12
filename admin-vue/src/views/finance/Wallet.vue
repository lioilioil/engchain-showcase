<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const walletStats = ref({
  totalBalance: 0,
  totalFrozen: 0,
  totalIn: 0,
  totalOut: 0
})

const recentFlows = ref([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref(null)

async function loadData() {
  loading.value = true
  try {
    const [users, withdrawals, commissionFlows] = await Promise.all([
      api.user.list(),
      api.finance.listWithdrawals(),
      api.finance.listCommissionFlows()
    ])

    // 汇总所有用户钱包
    const totalBalance = users.reduce((sum, u) => sum + (u.balance?.balance || 0), 0)
    const totalFrozen = users.reduce((sum, u) => sum + (u.balance?.frozen || 0), 0)
    const totalIn = users.reduce((sum, u) => sum + (u.balance?.totalIn || 0), 0)
    const totalOut = users.reduce((sum, u) => sum + (u.balance?.totalOut || 0), 0)

    walletStats.value = { totalBalance, totalFrozen, totalIn, totalOut }

    // 近期流水
    recentFlows.value = [
      ...withdrawals.slice(0, 5).map(w => ({
        id: w.id,
        type: '提现',
        userName: w.userName,
        amount: -w.amount,
        status: w.status,
        time: w.appliedAt
      })),
      ...commissionFlows.slice(0, 5).map(c => ({
        id: c.id,
        type: '佣金',
        userName: c.userName,
        amount: c.fee,
        status: 'done',
        time: c.ts
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)
  } finally {
    loading.value = false
  }
}

const statCards = computed(() => [
  { title: '平台总余额', value: walletStats.value.totalBalance, suffix: '元', color: '#1f883d' },
  { title: '冻结金额', value: walletStats.value.totalFrozen, suffix: '元', color: '#d4a72c' },
  { title: '累计入账', value: walletStats.value.totalIn, suffix: '元', color: '#0969da' },
  { title: '累计出账', value: walletStats.value.totalOut, suffix: '元', color: '#cf222e' }
])

function handleExport() {
  ElMessage.info('导出流水功能开发中')
}

function showRowDetail(row) {
  showDetail(row)
}

function showDetail(row) {
  currentRow.value = row
  detailVisible.value = true
}

onMounted(loadData)
</script>

<template>
  <div class="wallet-overview-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>钱包总览</h2>
        <p class="page-desc">平台资金全局统计</p>
      </div>
      <div class="page-actions">
        <el-button @click="handleExport">导出流水</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div v-for="card in statCards" :key="card.title" class="stat-card">
        <div class="stat-card__label">{{ card.title }}</div>
        <div class="stat-card__value" :style="{ color: card.color }">
          ¥{{ card.value?.toLocaleString() }}
        </div>
      </div>
    </div>

    <!-- 近期流水 -->
    <div class="flow-section">
      <h3>近期资金流水</h3>
      <el-table :data="recentFlows" size="small" @row-click="showRowDetail" style="cursor: pointer">
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="userName" label="用户" width="140" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <span :style="{ color: row.amount >= 0 ? '#1f883d' : '#cf222e' }">
              {{ row.amount >= 0 ? '+' : '' }}¥{{ row.amount?.toLocaleString() }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'done' || row.status === 'approved' ? 'success' : 'warning'">
              {{ row.status === 'done' || row.status === 'approved' ? '已完成' : '处理中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">
            {{ new Date(row.time).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 流水详情弹窗 -->
    <el-dialog v-model="detailVisible" title="流水详情" width="500px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="流水编号">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ currentRow.type }}</el-descriptions-item>
        <el-descriptions-item label="用户">{{ currentRow.userName }}</el-descriptions-item>
        <el-descriptions-item label="金额">
          <span :style="{ color: currentRow.amount >= 0 ? '#1f883d' : '#cf222e' }">
            {{ currentRow.amount >= 0 ? '+' : '' }}¥{{ currentRow.amount?.toLocaleString() }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag size="small" :type="currentRow.status === 'done' || currentRow.status === 'approved' ? 'success' : 'warning'">
            {{ currentRow.status === 'done' || currentRow.status === 'approved' ? '已完成' : '处理中' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="时间">
          {{ new Date(currentRow.time).toLocaleString('zh-CN') }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.wallet-overview-page {
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

.page-actions {
  display: flex;
  gap: $spacing-sm;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-md;
}

.stat-card {
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__label {
    font-size: 13px;
    color: $color-text-secondary;
  }

  &__value {
    margin-top: $spacing-sm;
    font-size: 24px;
    font-weight: 700;
  }
}

.flow-section {
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
