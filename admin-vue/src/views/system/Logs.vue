<script setup>
import { ref, onMounted, computed } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import { useLogStore } from '@/store/log.js'

const logStore = useLogStore()

// 表格列配置
const columns = [
  { prop: 'ts', label: '时间', width: 180, formatter: (row) => formatTime(row.ts) },
  { prop: 'operator', label: '操作人', width: 120 },
  { prop: 'action', label: '操作', width: 140 },
  { prop: 'module', label: '模块', width: 120 },
  { prop: 'target', label: '对象' },
  { prop: 'extra', label: '备注' }
]

// 筛选配置
const filters = [
  { prop: 'module', label: '模块', type: 'select', options: [
    { value: '认证审核', label: '认证审核' },
    { value: '入驻审核', label: '入驻审核' },
    { value: '提现审批', label: '提现审批' },
    { value: '运营中心', label: '运营中心' },
    { value: '风控合规', label: '风控合规' },
    { value: '佣金结算', label: '佣金结算' },
    { value: '发票管理', label: '发票管理' },
    { value: '系统', label: '系统' }
  ]},
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '搜索操作人/对象/备注' }
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadData() {
  loading.value = true
  try {
    allData.value = logStore.getLogs()
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter(filters = {}) {
  let result = [...allData.value]
  if (filters.module) {
    result = result.filter(item => item.module === filters.module)
  }
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase()
    result = result.filter(item =>
      item.operator?.toLowerCase().includes(kw) ||
      item.target?.toLowerCase().includes(kw) ||
      item.extra?.toLowerCase().includes(kw)
    )
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

onMounted(loadData)
</script>

<template>
  <div class="logs-page">
    <div class="page-header">
      <h2>操作日志</h2>
      <p class="page-desc">平台所有操作的审计留痕，最多保留 200 条</p>
    </div>

    <ProTable
      :columns="columns"
      :filters="filters"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="ts"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.logs-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
  }
}

.page-desc {
  margin: $spacing-xs 0 0;
  font-size: 13px;
  color: $color-text-secondary;
}
</style>
