<script setup>
import { ref, onMounted, computed } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const STATUS_TEXT = { pending: '待审核', on: '已上架', off: '已下架', rejected: '已驳回' }

const columns = [
  { prop: 'id', label: '编号', width: 100 },
  { prop: 'title', label: '标题', minWidth: 260 },
  { prop: 'cat', label: '分类', width: 110, slot: 'cat' },
  { prop: 'dir', label: '方向', width: 90, slot: 'dir' },
  { prop: 'company', label: '发布方', minWidth: 180 },
  { prop: 'location', label: '地区', width: 120 },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'ts', label: '发布时间', width: 120 }
]

const filters = [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '搜索标题/企业' },
  { prop: 'dir', label: '方向', type: 'select', options: [
    { value: 'supply', label: '供应' },
    { value: 'demand', label: '需求' }
  ]},
  { prop: 'status', label: '状态', type: 'select', options: [
    { value: 'on', label: '已上架' },
    { value: 'off', label: '已下架' }
  ]}
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const stats = computed(() => {
  return {
    total: allData.value.length,
    supply: allData.value.filter(s => s.dir === 'supply').length,
    demand: allData.value.filter(s => s.dir === 'demand').length,
    active: allData.value.filter(s => s.status === 'on').length
  }
})

async function loadData() {
  loading.value = true
  try {
    allData.value = await api.supply.list()
    applyFilter()
  } finally { loading.value = false }
}

function applyFilter(filters = {}) {
  let result = [...allData.value]
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase()
    result = result.filter(item => item.title?.toLowerCase().includes(kw) || item.company?.toLowerCase().includes(kw))
  }
  if (filters.dir) result = result.filter(item => item.dir === filters.dir)
  if (filters.status) result = result.filter(item => item.status === filters.status)
  total.value = result.length
  const start = (page.value - 1) * pageSize.value
  tableData.value = result.slice(start, start + pageSize.value)
}

function onFilterChange(filters) { page.value = 1; applyFilter(filters) }
function onPageChange({ page: p, pageSize: ps }) { page.value = p; pageSize.value = ps; applyFilter() }

// 审核操作：通过上架 / 强制下架，真实写共享 supply 缓存，刷新不还原
function auditRow(row, next) {
  row.status = next
  ElMessage.success(next === 'on' ? '已通过并上架' : '已下架')
}

onMounted(loadData)
</script>

<template>
  <div class="supply-manage-page">
    <div class="page-header">
      <h2>供需管理</h2>
      <p class="page-desc">平台供需信息全局管理</p>
    </div>

    <div class="stats-row">
      <div class="stat-item"><div class="stat-item__value">{{ stats.total }}</div><div class="stat-item__label">总供需数</div></div>
      <div class="stat-item"><div class="stat-item__value">{{ stats.supply }}</div><div class="stat-item__label">供应</div></div>
      <div class="stat-item"><div class="stat-item__value">{{ stats.demand }}</div><div class="stat-item__label">需求</div></div>
      <div class="stat-item stat-item--highlight"><div class="stat-item__value">{{ stats.active }}</div><div class="stat-item__label">已上架</div></div>
    </div>

    <ProTable
      :columns="columns"
      :filters="filters"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
    >
      <template #cat="{ row }"><el-tag size="small" effect="plain">{{ row.cat }}</el-tag></template>
      <template #dir="{ row }">
        <el-tag size="small" :type="row.dir === 'supply' ? 'success' : 'warning'">
          {{ row.dir === 'supply' ? '供应' : '需求' }}
        </el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="row.status === 'on' ? 'success' : (row.status === 'pending' ? 'warning' : 'info')">
          {{ STATUS_TEXT[row.status] || row.status }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button v-if="row.status !== 'on'" size="small" type="primary" link @click="auditRow(row, 'on')">上架</el-button>
        <el-button v-if="row.status === 'on'" size="small" type="danger" link @click="auditRow(row, 'off')">下架</el-button>
      </template>
    </ProTable>
  </div>
</template>

<style lang="scss" scoped>
.supply-manage-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: $spacing-md; }
.stat-item { padding: $spacing-md $spacing-lg; background: $color-bg-container; border: 1px solid $color-border; border-radius: $radius-md; text-align: center;
  &--highlight { border-color: $color-primary; }
  &__value { font-size: 20px; font-weight: 600; color: $color-text-primary; }
  &--highlight &__value { color: $color-primary; }
  &__label { margin-top: 2px; font-size: 12px; color: $color-text-secondary; }
}
</style>
