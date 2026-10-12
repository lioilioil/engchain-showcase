<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'

const columns = [
  { prop: 'id', label: '发票号', width: 120 },
  { prop: 'title', label: '抬头', width: 160 },
  { prop: 'type', label: '类型', width: 100, slot: 'type' },
  { prop: 'amount', label: '金额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'applyAt', label: '申请时间', width: 120, formatter: (row) => row.applyAt ? new Date(row.applyAt).toLocaleDateString() : '-' }
]

// 状态四态映射（mock: pending/issued/shipped/void）
const STATUS_MAP = {
  pending: { label: '待审核', type: 'warning' },
  issued: { label: '已开具', type: 'success' },
  shipped: { label: '已邮寄', type: 'primary' },
  void: { label: '已作废', type: 'info' }
}
function statusOf(row) {
  return STATUS_MAP[row.status] || { label: row.status || '待审核', type: 'warning' }
}

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref(null)

// 行操作
const actions = [
  { label: '详情', type: 'primary', action: 'detail' }
]

async function loadData() {
  loading.value = true
  try {
    const list = await api.finance.listInvoices()
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

function handleExport() {
  ElMessage.info('导出发票功能开发中')
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
  <div class="invoice-page">
    <div class="page-header">
      <div>
        <h2>发票管理</h2>
        <p class="page-desc">用户发票申请与开具管理</p>
      </div>
      <div class="page-actions">
        <el-button @click="handleExport">导出报表</el-button>
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
    >
      <template #type="{ row }">
        <el-tag size="small" effect="plain">{{ row.type === 'personal' ? '个人' : '企业' }}</el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="statusOf(row).type">{{ statusOf(row).label }}</el-tag>
      </template>
    </ProTable>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="发票详情" width="500px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="发票号">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="抬头">{{ currentRow.title }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ currentRow.type === 'personal' ? '个人' : '企业' }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag size="small" :type="statusOf(currentRow).type">{{ statusOf(currentRow).label }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请时间">
          {{ currentRow.applyAt ? new Date(currentRow.applyAt).toLocaleDateString() : '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.invoice-page {
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
</style>
