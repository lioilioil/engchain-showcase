<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'

const router = useRouter()

// 订单类型映射
const TYPE_MAP = {
  supply: '供应承接',
  need: '需求匹配',
  agency: '中介撮合',
  transfer: '建企买卖',
  qual: '资质招商'
}

// 状态映射
const STATUS_MAP = {
  pending: { label: '待支付', type: 'warning' },
  serving: { label: '服务中', type: 'primary' },
  await_accept: { label: '待验收', type: 'warning' },
  settled: { label: '已结算', type: 'success' },
  cancelled: { label: '已取消', type: 'info' }
}

// 表格列配置
const columns = [
  { prop: 'id', label: '订单号', width: 160 },
  { prop: 'title', label: '标题', minWidth: 240 },
  { prop: 'type', label: '类型', width: 110, slot: 'type' },
  { prop: 'amount', label: '金额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'owner', label: '甲方', width: 140, formatter: (row) => row.counterparty },
  { prop: 'status', label: '状态', width: 110, slot: 'status' },
  { prop: 'fee', label: '佣金', width: 100, formatter: (row) => row.fee ? `¥${row.fee?.toLocaleString()}` : '-' },
  { prop: 'ts', label: '创建时间', width: 120 }
]

// 筛选配置
const filters = [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '搜索订单号/标题' },
  { prop: 'type', label: '类型', type: 'select', options: [
    { value: 'supply', label: '供应承接' },
    { value: 'need', label: '需求匹配' },
    { value: 'agency', label: '中介撮合' },
    { value: 'transfer', label: '建企买卖' },
    { value: 'qual', label: '资质招商' }
  ]},
  { prop: 'status', label: '状态', type: 'select', options: [
    { value: 'pending', label: '待支付' },
    { value: 'serving', label: '服务中' },
    { value: 'await_accept', label: '待验收' },
    { value: 'settled', label: '已结算' },
    { value: 'cancelled', label: '已取消' }
  ]}
]

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
  { label: '查看详情', type: 'primary', action: 'detail' }
]

// 统计数据
const stats = computed(() => {
  const list = allData.value
  return {
    total: list.length,
    pending: list.filter(o => o.status === 'pending').length,
    serving: list.filter(o => o.status === 'serving' || o.status === 'await_accept').length,
    settled: list.filter(o => o.status === 'settled').length,
    totalAmount: list.reduce((sum, o) => sum + (o.amount || 0), 0)
  }
})

async function loadData() {
  loading.value = true
  try {
    const list = await api.order.list()
    allData.value = list
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter(filters = {}) {
  let result = [...allData.value]

  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase()
    result = result.filter(o =>
      o.id?.toLowerCase().includes(kw) ||
      o.title?.toLowerCase().includes(kw)
    )
  }
  if (filters.type) {
    result = result.filter(o => o.type === filters.type)
  }
  if (filters.status) {
    result = result.filter(o => o.status === filters.status)
  }

  total.value = result.length
  const start = (page.value - 1) * pageSize.value
  tableData.value = result.slice(start, start + pageSize.value)
}

function onFilterChange(filters) {
  page.value = 1
  applyFilter(filters)
}

function onPageChange({ page: p, pageSize: ps }) {
  page.value = p
  pageSize.value = ps
  applyFilter()
}

function onRowClick({ row }) {
  showDetail(row)
}

function showDetail(row) {
  currentRow.value = row
  detailVisible.value = true
}

function onActionClick({ action, row }) {
  if (action.action === 'detail') {
    showDetail(row)
  } else if (action.action === 'advance') {
    transitionRow(row)
  }
}

// 状态机流转：pending→serving(接单) → await_accept(完成) → settled(验收)；pending→cancelled(取消)
function nextStatus(row) {
  return { pending: 'serving', serving: 'await_accept', await_accept: 'settled' }[row.status]
}
function transitionRow(row) {
  const ns = nextStatus(row)
  if (ns) {
    row.status = ns // 写共享 order 缓存，刷新不还原
    ElMessage.success(`订单 ${row.id} 已流转为「${STATUS_MAP[ns].label}」`)
  }
}
function cancelRow(row) {
  row.status = 'cancelled'
  ElMessage.success(`订单 ${row.id} 已取消`)
}

function handleExport() {
  ElMessage.info('导出功能开发中')
}

onMounted(loadData)
</script>

<template>
  <div class="orders-list-page">
    <div class="page-header">
      <div>
        <h2>订单管理</h2>
        <p class="page-desc">全平台订单列表，共 {{ total }} 笔</p>
      </div>
      <div class="page-actions">
        <el-button @click="handleExport">导出报表</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.total }}</div>
        <div class="stat-item__label">总订单</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.pending }}</div>
        <div class="stat-item__label">待支付</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.serving }}</div>
        <div class="stat-item__label">服务中</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.settled }}</div>
        <div class="stat-item__label">已结算</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">¥{{ stats.totalAmount?.toLocaleString() }}</div>
        <div class="stat-item__label">总交易额</div>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :filters="filters"
      :actions="actions"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      row-clickable
      @filter-change="onFilterChange"
      @page-change="onPageChange"
      @row-click="onRowClick"
      @action-click="onActionClick"
    >
      <template #type="{ row }">
        <el-tag size="small" effect="plain">{{ TYPE_MAP[row.type] || row.type }}</el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="STATUS_MAP[row.status]?.type || 'info'">
          {{ STATUS_MAP[row.status]?.label || row.status }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button v-if="nextStatus(row)" size="small" type="primary" link @click="transitionRow(row)">
          {{ row.status === 'pending' ? '接单' : row.status === 'serving' ? '完成' : '验收' }}
        </el-button>
        <el-button v-if="row.status === 'pending'" size="small" type="danger" link @click="cancelRow(row)">取消</el-button>
      </template>
    </ProTable>

    <!-- 订单详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="订单详情"
      width="600px"
    >
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="订单号">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag size="small" :type="STATUS_MAP[currentRow.status]?.type || 'info'">
            {{ STATUS_MAP[currentRow.status]?.label || currentRow.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="标题" :span="2">{{ currentRow.title }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ TYPE_MAP[currentRow.type] || currentRow.type }}</el-descriptions-item>
        <el-descriptions-item label="甲方">{{ currentRow.counterparty }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="佣金">{{ currentRow.fee ? `¥${currentRow.fee?.toLocaleString()}` : '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">{{ currentRow.ts }}</el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.orders-list-page {
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
  grid-template-columns: repeat(5, 1fr);
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
