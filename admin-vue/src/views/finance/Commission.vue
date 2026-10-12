<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { toCsv } from '@/utils/export.js'

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref(null)

const stats = computed(() => {
  return {
    total: allData.value.length,
    totalFee: allData.value.reduce((s, f) => s + (f.fee || 0), 0),
    totalAmount: allData.value.reduce((s, f) => s + (f.amount || 0), 0)
  }
})

async function loadData() {
  loading.value = true
  try {
    const list = await api.finance.listCommissionFlows()
    allData.value = list
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  total.value = allData.value.length
  const start = (page.value - 1) * pageSize.value
  tableData.value = allData.value.slice(start, start + pageSize.value)
}

function onPageChange({ page: p, pageSize: ps }) {
  page.value = p
  pageSize.value = ps
  applyFilter()
}

const columns = [
  { prop: 'id', label: '流水号', width: 100 },
  { prop: 'orderId', label: '关联订单', width: 160 },
  { prop: 'userName', label: '用户', width: 120 },
  { prop: 'amount', label: '交易额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'rate', label: '费率', width: 80, formatter: (row) => `${(row.rate * 100).toFixed(1)}%` },
  { prop: 'fee', label: '佣金', width: 120, formatter: (row) => `¥${row.fee?.toLocaleString()}` },
  { prop: 'ts', label: '结算时间', width: 160, formatter: (row) => row.ts }
]

// 行操作
const actions = [
  { label: '详情', type: 'primary', action: 'detail' }
]

function handleExport() {
  toCsv(allData.value, '佣金流水', columns)
  ElMessage.success('已导出 CSV')
}

function showDetail(row) {
  currentRow.value = row
  detailVisible.value = true
}

function onActionClick({ action, row }) {
  if (action.action === 'detail') {
    showDetail(row)
  }
}

onMounted(loadData)
</script>

<template>
  <div class="commission-page">
    <div class="page-header">
      <div>
        <h2>佣金结算</h2>
        <p class="page-desc">平台佣金流水明细</p>
      </div>
      <div class="page-actions">
        <el-button @click="handleExport">导出报表</el-button>
      </div>
    </div>
    <el-alert type="info" :closable="false" style="margin-bottom:12px" title="Phase 0 不抽佣：以下为历史快照流水，当前平台不再产生新的撮合佣金。" />

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.total }}</div>
        <div class="stat-item__label">结算笔数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.totalAmount?.toLocaleString() }}</div>
        <div class="stat-item__label">总交易额</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">¥{{ stats.totalFee?.toLocaleString() }}</div>
        <div class="stat-item__label">平台总佣金</div>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :actions="actions"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @page-change="onPageChange"
      @action-click="onActionClick"
    />

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="佣金详情" width="500px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="流水号">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="关联订单">{{ currentRow.orderId }}</el-descriptions-item>
        <el-descriptions-item label="用户">{{ currentRow.userName }}</el-descriptions-item>
        <el-descriptions-item label="交易额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="费率">{{ (currentRow.rate * 100).toFixed(1) }}%</el-descriptions-item>
        <el-descriptions-item label="佣金">¥{{ currentRow.fee?.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="结算时间">{{ currentRow.ts }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.commission-page {
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
</style>
