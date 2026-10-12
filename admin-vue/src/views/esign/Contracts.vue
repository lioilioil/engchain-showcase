<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const contracts = ref([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref(null)

const stats = computed(() => {
  return {
    total: contracts.value.length,
    signing: contracts.value.filter(c => c.status === 'signing').length,
    done: contracts.value.filter(c => c.status === 'done').length
  }
})

async function loadData() {
  loading.value = true
  try {
    // 从订单数据生成电子合同 mock
    const orders = await api.order.list()
    contracts.value = orders
      .filter(o => o.status === 'serving' || o.status === 'await_accept' || o.status === 'settled')
      .map(o => ({
        id: `contract-${o.id}`,
        orderId: o.id,
        title: o.title,
        partyA: o.counterparty,
        partyB: o.supplier || '平台供方',
        amount: o.amount,
        status: o.status === 'settled' ? 'done' : 'signing',
        signedAt: o.status === 'settled' ? o.updatedAt : null
      }))
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function handleViewContract(row) {
  currentRow.value = row
  detailVisible.value = true
}

function handleExport() {
  ElMessage.info('导出合同功能开发中')
}
</script>

<template>
  <div class="contracts-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>电子合同</h2>
        <p class="page-desc">平台电子合同签署与管理</p>
      </div>
      <div class="page-actions">
        <el-button @click="handleExport">导出合同</el-button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.total }}</div>
        <div class="stat-item__label">总合同数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.signing }}</div>
        <div class="stat-item__label">签署中</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">{{ stats.done }}</div>
        <div class="stat-item__label">已签署</div>
      </div>
    </div>

    <div class="section-block">
      <el-table :data="contracts" size="small">
        <el-table-column prop="id" label="合同编号" width="160" />
        <el-table-column prop="title" label="合同标题" min-width="200" />
        <el-table-column prop="partyA" label="甲方" width="140" />
        <el-table-column prop="partyB" label="乙方" width="140" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">¥{{ row.amount?.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'done' ? 'success' : 'warning'">
              {{ row.status === 'done' ? '已签署' : '签署中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleViewContract(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 合同详情弹窗 -->
    <el-dialog v-model="detailVisible" title="合同详情" width="600px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="合同编号">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="关联订单">{{ currentRow.orderId }}</el-descriptions-item>
        <el-descriptions-item label="合同标题">{{ currentRow.title }}</el-descriptions-item>
        <el-descriptions-item label="甲方">{{ currentRow.partyA }}</el-descriptions-item>
        <el-descriptions-item label="乙方">{{ currentRow.partyB }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag size="small" :type="currentRow.status === 'done' ? 'success' : 'warning'">
            {{ currentRow.status === 'done' ? '已签署' : '签署中' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="签署时间">
          {{ currentRow.signedAt ? new Date(currentRow.signedAt).toLocaleDateString() : '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.contracts-page {
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
}
</style>
