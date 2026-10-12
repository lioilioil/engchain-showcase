<script setup>
import { ref, reactive, computed } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDrawer from '@/components/ProDrawer/index.vue'
import KpiCard from '@/components/KpiCard/index.vue'
import { toast, confirm, loading } from '@/utils/feedback'

/* ============================================================
 * 1. KPI 卡片区
 * ============================================================ */
const kpiList = [
  {
    title: '今日用户数',
    value: 12856,
    change: 12.5,
    trend: 'up',
    theme: 'primary',
    trendData: [120, 132, 101, 134, 160, 148, 185],
    clickable: false
  },
  {
    title: '待审核认证',
    value: 5,
    change: 2,
    trend: 'up',
    theme: 'warning',
    trendData: [3, 4, 2, 5, 4, 6, 5],
    clickable: false
  },
  {
    title: '营收 (¥)',
    value: '86,400',
    change: -3.2,
    trend: 'down',
    theme: 'danger',
    trendData: [200, 185, 160, 170, 150, 140, 130],
    clickable: false
  },
  {
    title: '异常订单',
    value: 3,
    change: 0,
    trend: 'flat',
    theme: 'success',
    trendData: [5, 4, 3, 4, 3, 3, 3],
    clickable: true
  }
]

function onKpiClick() {
  toast.info('跳转到列表页')
}

/* ============================================================
 * 2. ProTable 列表区 — mock 数据
 * ============================================================ */
const ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '运营', value: 'ops' },
  { label: '财务', value: 'finance' }
]

const STATUS_MAP = { 1: '启用', 0: '禁用' }

// 生成 23 条假数据
function generateMockUsers() {
  const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴']
  const given = ['伟', '芳', '娜', '敏', '静', '磊', '洋', '勇', '艳', '杰']
  const roles = ['admin', 'ops', 'finance']
  const list = []
  for (let i = 1; i <= 23; i++) {
    const name = surnames[i % surnames.length] + given[(i * 3) % given.length]
    const phone = '138' + String(10000000 + i * 137).slice(0, 8)
    list.push({
      id: i,
      name,
      phone,
      status: i % 4 === 0 ? 0 : 1,
      role: roles[i % roles.length],
      createdAt: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')} 10:30`
    })
  }
  return list
}

const allUsers = ref(generateMockUsers())

// 表格状态
const tableLoading = ref(false)
const tablePage = ref(1)
const tablePageSize = ref(10)
const selectedRows = ref([])
const currentFilters = ref({})

// filters 配置
const tableFilters = [
  { prop: 'name', label: '姓名', type: 'input' },
  {
    prop: 'role',
    label: '角色',
    type: 'select',
    options: ROLE_OPTIONS
  },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 }
    ]
  }
]

// columns 配置
const tableColumns = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'phone', label: '手机号', width: 130 },
  { prop: 'status', label: '状态', width: 90, slot: 'status' },
  { prop: 'role', label: '角色', width: 90, formatter: (row) => {
    const opt = ROLE_OPTIONS.find(o => o.value === row.role)
    return opt ? opt.label : row.role
  }},
  { prop: 'createdAt', label: '创建时间' }
]

// actions 配置
const tableActions = [
  { label: '查看', type: 'primary' },
  { label: '编辑', type: 'warning' },
  { label: '删除', danger: true, if: (row) => row.status === 1 }
]

// 过滤 + 分页后的数据
const pagedUsers = computed(() => {
  const f = currentFilters.value
  let list = allUsers.value
  if (f.name) list = list.filter(u => u.name.includes(f.name))
  if (f.role) list = list.filter(u => u.role === f.role)
  if (f.status !== '' && f.status !== undefined && f.status !== null) {
    list = list.filter(u => u.status === f.status)
  }
  const start = (tablePage.value - 1) * tablePageSize.value
  return list.slice(start, start + tablePageSize.value)
})

const filteredTotal = computed(() => {
  const f = currentFilters.value
  let list = allUsers.value
  if (f.name) list = list.filter(u => u.name.includes(f.name))
  if (f.role) list = list.filter(u => u.role === f.role)
  if (f.status !== '' && f.status !== undefined && f.status !== null) {
    list = list.filter(u => u.status === f.status)
  }
  return list.length
})

// 模拟 loading
function mockLoading(cb) {
  tableLoading.value = true
  setTimeout(() => {
    tableLoading.value = false
    cb && cb()
  }, 400)
}

function onFilterChange(filters) {
  currentFilters.value = { ...filters }
  tablePage.value = 1
  mockLoading()
}

function onPageChange({ page, pageSize }) {
  tablePage.value = page
  tablePageSize.value = pageSize
  mockLoading()
}

function onSelectionChange({ rows }) {
  selectedRows.value = rows
}

function onRowClick({ row }) {
  toast.info(`点击了行：${row.name} (ID: ${row.id})`)
}

/* ---------- 抽屉：查看 detail ---------- */
const detailDrawer = reactive({
  visible: false,
  data: {}
})

const detailFields = [
  { label: '用户 ID', prop: 'id' },
  { label: '姓名', prop: 'name' },
  { label: '手机号', prop: 'phone' },
  {
    label: '状态',
    prop: 'status',
    formatter: (data) => STATUS_MAP[data.status] || '-'
  },
  {
    label: '角色',
    prop: 'role',
    formatter: (data) => {
      const opt = ROLE_OPTIONS.find(o => o.value === data.role)
      return opt ? opt.label : data.role
    }
  },
  { label: '创建时间', prop: 'createdAt', span: 2 }
]

/* ---------- 抽屉：编辑 form ---------- */
const editDrawer = reactive({
  visible: false,
  loading: false
})
const editFormData = reactive({
  id: null,
  name: '',
  phone: '',
  status: 1,
  role: 'ops'
})

const editFormItems = [
  { prop: 'name', label: '姓名', type: 'input', required: true },
  { prop: 'phone', label: '手机号', type: 'input', required: true },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 }
    ]
  },
  {
    prop: 'role',
    label: '角色',
    type: 'select',
    options: ROLE_OPTIONS
  }
]

/* ---------- 行操作点击 ---------- */
async function onActionClick({ action, row }) {
  if (action.label === '查看') {
    detailDrawer.data = { ...row }
    detailDrawer.visible = true
  } else if (action.label === '编辑') {
    Object.assign(editFormData, {
      id: row.id,
      name: row.name,
      phone: row.phone,
      status: row.status,
      role: row.role
    })
    editDrawer.visible = true
  } else if (action.label === '删除') {
    const ok = await confirm({
      title: '删除确认',
      message: `确定要删除用户「${row.name}」吗？此操作不可恢复。`,
      confirmText: '确定删除',
      cancelText: '取消',
      danger: true
    })
    if (ok) {
      allUsers.value = allUsers.value.filter(u => u.id !== row.id)
      toast.success(`已删除用户「${row.name}」`)
      mockLoading()
    }
  }
}

function onEditSubmit(formData) {
  // 更新本地 mock 数据
  const idx = allUsers.value.findIndex(u => u.id === formData.id)
  if (idx !== -1) {
    allUsers.value[idx] = { ...allUsers.value[idx], ...formData }
  }
  editDrawer.visible = false
  toast.success('保存成功')
  mockLoading()
}

/* ============================================================
 * 3. 全局反馈区
 * ============================================================ */
function testToastSuccess() { toast.success('这是一条成功提示') }
function testToastError() { toast.error('这是一条错误提示') }
function testToastWarning() { toast.warning('这是一条警告提示') }
function testToastInfo() { toast.info('这是一条信息提示') }

async function testDangerConfirm() {
  const ok = await confirm({
    title: '危险操作',
    message: '确定要执行这个不可逆的危险操作吗？',
    confirmText: '确认执行',
    cancelText: '再想想',
    danger: true
  })
  if (ok) {
    toast.success('危险操作已执行')
  } else {
    toast.info('已取消操作')
  }
}

function testLoading() {
  loading.show('加载中...')
  setTimeout(() => {
    loading.hide()
    toast.success('加载完成')
  }, 800)
}
</script>

<template>
  <div class="design-system-page">
    <!-- 1. KPI 卡片区 -->
    <section class="ds-section">
      <h3 class="ds-section__title">KPI 卡片 (KpiCard)</h3>
      <div class="ds-kpi-grid">
        <KpiCard
          v-for="kpi in kpiList"
          :key="kpi.title"
          :title="kpi.title"
          :value="kpi.value"
          :change="kpi.change"
          :trend="kpi.trend"
          :theme="kpi.theme"
          :trend-data="kpi.trendData"
          :clickable="kpi.clickable"
          @click="onKpiClick"
        />
      </div>
    </section>

    <!-- 2. ProTable 列表区 -->
    <section class="ds-section">
      <h3 class="ds-section__title">用户列表 (ProTable + ProDrawer)</h3>
      <ProTable
        v-model:page="tablePage"
        v-model:page-size="tablePageSize"
        :columns="tableColumns"
        :filters="tableFilters"
        :actions="tableActions"
        :data="pagedUsers"
        :total="filteredTotal"
        :loading="tableLoading"
        selection
        row-clickable
        row-key="id"
        @filter-change="onFilterChange"
        @page-change="onPageChange"
        @row-click="onRowClick"
        @selection-change="onSelectionChange"
        @action-click="onActionClick"
      >
        <template #status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </ProTable>

      <!-- detail 抽屉 -->
      <ProDrawer
        v-model="detailDrawer.visible"
        title="用户详情"
        mode="detail"
        size="md"
        :data="detailDrawer.data"
        :fields="detailFields"
      />

      <!-- form 抽屉 -->
      <ProDrawer
        v-model="editDrawer.visible"
        title="编辑用户"
        mode="form"
        size="md"
        :form-items="editFormItems"
        :form-data="editFormData"
        submit-text="保存"
        @submit="onEditSubmit"
      />
    </section>

    <!-- 3. 全局反馈区 -->
    <section class="ds-section">
      <h3 class="ds-section__title">全局反馈 (feedback)</h3>
      <div class="ds-feedback-group">
        <el-button type="success" @click="testToastSuccess">成功 Toast</el-button>
        <el-button type="danger" @click="testToastError">错误 Toast</el-button>
        <el-button type="warning" @click="testToastWarning">警告 Toast</el-button>
        <el-button type="info" @click="testToastInfo">信息 Toast</el-button>
        <el-button type="danger" plain @click="testDangerConfirm">危险操作确认</el-button>
        <el-button @click="testLoading">模拟加载</el-button>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.design-system-page {
  padding: 24px;
}

.ds-section {
  margin-bottom: 32px;

  &__title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: $color-text-primary;
  }
}

.ds-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-lg;
}

.ds-feedback-group {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
}
</style>
