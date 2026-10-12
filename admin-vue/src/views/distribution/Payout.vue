<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useLogStore } from '@/store/log.js'
const logStore = useLogStore()

const STATUS_TEXT = { pending: '待结算', settled: '已结算', paid: '已发放' }

const loading = ref(false)
const flows = ref([])

async function loadData() {
  loading.value = true
  try {
    flows.value = await api.distribution.listFlows()
  } finally { loading.value = false }
}

function handleCreateBatch() {
  ElMessage.info('创建发放批次功能开发中')
}

// 三态机：pending→settled(结算) → paid(打款)
function advance(row) {
  if (row.status === 'pending') row.status = 'settled'
  else if (row.status === 'settled') row.status = 'paid'
  logStore.addLog({
    action: row.status === 'settled' ? '分销结算' : '分销打款',
    module: '返佣批次',
    target: `${row.userName}(${row.orderId})`,
    extra: `¥${row.amount}`
  })
  ElMessage.success(`已流转：${STATUS_TEXT[row.status]}`)
}

onMounted(loadData)
</script>

<template>
  <div class="payout-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>返佣批次发放</h2>
        <p class="page-desc">分销返佣批量发放管理</p>
      </div>
      <el-button type="primary" @click="handleCreateBatch">创建发放批次</el-button>
    </div>
    <el-table :data="flows" size="default">
      <el-table-column prop="id" label="流水号" width="100" />
      <el-table-column prop="userName" label="用户" width="120" />
      <el-table-column prop="orderId" label="关联订单" width="160" />
      <el-table-column label="金额" width="120">
        <template #default="{ row }">
          <span style="color: #1f883d">+¥{{ row.amount?.toLocaleString() }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="ts" label="时间" width="160" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'paid' ? 'success' : (row.status === 'settled' ? 'warning' : 'info')">
            {{ STATUS_TEXT[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'paid'" size="small" type="primary" link @click="advance(row)">
            {{ row.status === 'pending' ? '结算' : '打款' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.payout-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header { display: flex; align-items: center; justify-content: space-between;
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
}
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
