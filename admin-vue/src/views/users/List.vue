<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import Skeleton from '@/components/Skeleton/index.vue'
import VirtualUserTable from '@/components/VirtualUserTable/index.vue'
import api from '@/api'
import { useDataStore } from '@/store/data'
import { usePermissionStore } from '@/store/permission.js'
import { maskPhone } from '@/utils/mask.js'
import { createRequestGuard } from '@/utils/race.js'
import { trackEvent } from '@/utils/analytics.js'
import { broadcastUserMutation, onUserMutation, broadcastLock } from '@/utils/sync.js'
import { useUserStore } from '@/store/user.js'
const userStore = useUserStore()
import { isOnline, enqueue } from '@/utils/offlineQueue.js'

const router = useRouter()
const route = useRoute()
const dataStore = useDataStore()
const permStore = usePermissionStore()
// 敏感字段（手机号/银行卡）查看权限；无权限角色一律脱敏，明文不入 DOM
const canSeeSensitive = computed(() => permStore.has('sensitive:view'))
// 是否处于筛选态（决定空态类型：搜索无结果 vs 数据为空）
const hasFilter = computed(() => !!(activeFilters.value.keyword || activeFilters.value.status))

// 表格列配置
const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', width: 100, slot: 'name' },
  { prop: 'company', label: '企业', minWidth: 200 },
  { prop: 'mobile', label: '手机号', width: 130, formatter: (row) => canSeeSensitive.value ? row.mobile : maskPhone(row.mobile) },
  { prop: 'tag', label: '身份标签', width: 140, slot: 'tag' },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'balance', label: '余额', width: 100, formatter: (row) => `¥${row.balance?.balance?.toFixed(2) || '0.00'}` },
  { prop: 'credits', label: '积分', width: 90, formatter: (row) => row.credits?.balance || 0 }
]

// 筛选配置
const filters = [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '搜索姓名/企业/手机号' },
  { prop: 'status', label: '身份类型', type: 'select', options: [
    { value: 'resident', label: '入驻企业' },
    { value: 'enterprise', label: '企业认证' },
    { value: 'pro', label: '个人入驻' },
    { value: 'partner', label: '个人合伙人' },
    { value: 'realname', label: '个人认证' },
    { value: 'registered', label: '注册会员' },
    { value: 'guest', label: '游客' }
  ]}
]

// 行操作
const actions = [
  { label: '详情', type: 'primary', action: 'detail' },
  { label: '编辑', action: 'edit' },
  { label: '封禁', action: 'ban', danger: true, if: (row) => !row.banned && row.status !== 'guest' },
  { label: '解封', action: 'unban', if: (row) => row.banned }
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const selectedRows = ref([])
// 当前筛选条件（URL 即状态：与 query string 双向同步）
const activeFilters = ref({})
// 竞态防护：快速切换筛选/重查时旧请求不得覆盖新数据
const loadGuard = createRequestGuard()

// 从路由 query 还原列表状态（刷新可恢复、链接可分享）
function initFromQuery() {
  const q = route.query
  if (q.page) page.value = parseInt(q.page) || 1
  if (q.pageSize) pageSize.value = parseInt(q.pageSize) || 10
  activeFilters.value = {
    ...(q.keyword ? { keyword: q.keyword } : {}),
    ...(q.status ? { status: q.status } : {})
  }
}

// 同步状态到 URL（replace，不污染历史栈）
function syncToQuery() {
  const query = {}
  if (activeFilters.value.keyword) query.keyword = activeFilters.value.keyword
  if (activeFilters.value.status) query.status = activeFilters.value.status
  if (page.value && page.value !== 1) query.page = String(page.value)
  if (pageSize.value && pageSize.value !== 10) query.pageSize = String(pageSize.value)
  router.replace({ query })
}

// 新增/编辑弹窗
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentRow = ref(null)
const form = ref({ name: '', company: '', mobile: '', tag: '' })
const formRef = ref(null)
const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
}

async function loadData() {
  const token = loadGuard.next()
  loading.value = true
  try {
    const list = await dataStore.loadUsers()
    if (!loadGuard.isCurrent(token)) return // 已有更新请求，丢弃旧结果
    allData.value = list.filter(u => u.id !== 'u7') // 排除游客
    applyFilter()
  } finally {
    if (loadGuard.isCurrent(token)) loading.value = false
  }
}

function applyFilter(filters = activeFilters.value) {
  let result = [...allData.value]

  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase()
    result = result.filter(u =>
      u.name?.toLowerCase().includes(kw) ||
      u.company?.toLowerCase().includes(kw) ||
      u.mobile?.includes(kw)
    )
  }

  if (filters.status) {
    result = result.filter(u => dataStore.userById(u.id)?.status === filters.status || u.status === filters.status)
  }

  total.value = result.length
  const start = (page.value - 1) * pageSize.value
  tableData.value = result.slice(start, start + pageSize.value)
}

function onFilterChange(filters) {
  activeFilters.value = { ...filters }
  page.value = 1
  applyFilter()
  syncToQuery()
}

function onPageChange({ page: p, pageSize: ps }) {
  page.value = p
  pageSize.value = ps
  applyFilter()
  syncToQuery()
}

function onRowClick({ row }) {
  router.push(`/users/detail/${row.id}`)
}

function onActionClick({ action, row }) {
  if (action.action === 'detail') {
    broadcastLock('lock', row.id, userStore.name || '我')
    router.push(`/users/detail/${row.id}`)
  } else if (action.action === 'edit') {
    handleEdit(row)
  } else if (action.action === 'ban' || action.action === 'unban') {
    handleBan(row)
  }
}

async function handleBan(row) {
  const action = row.banned ? '解封' : '封禁'
  try {
    await ElMessageBox.confirm(
      `确定要${action}用户 ${row.name} 吗？`,
      `${action}用户`,
      { type: 'warning' }
    )
  } catch (e) {
    return // 用户取消
  }
  // 乐观更新：先本地生效
  const prevBanned = row.banned
  row.banned = !row.banned
  applyFilter()
  try {
    await mockToggleBan(row) // Mock 后台；指定记录必失败用于验证
    ElMessage.success(`已${action}用户: ${row.name}`)
  } catch (err) {
    // 失败回滚快照并报错
    row.banned = prevBanned
    applyFilter()
    ElMessage.error(`操作失败，已回滚：${err.message || '服务异常'}`)
  }
}

// Mock 后台接口：正常成功；指定记录（id=u1）模拟失败用于验证回滚路径
function mockToggleBan(row) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (row.id === 'u1') reject(new Error('模拟后台拒绝操作（u1 为保护账号）'))
      else resolve({ ok: true })
    }, 300)
  })
}

function onSelectionChange({ rows }) {
  selectedRows.value = rows
}

function handleExport() {
  ElMessage.info('导出功能开发中')
}

function handleBatchExport(rows) {
  trackEvent('user:export', { count: rows.length })
  ElMessage.success(`已导出 ${rows.length} 个用户`)
}

function handleBatchBan(rows) {
  trackEvent('user:ban', { count: rows.length })
  if (!isOnline()) {
    enqueue({ type: 'user:ban', ids: rows.map(r => r.id) })
    ElMessage.warning('当前离线，操作已入队，恢复联网后自动提交')
  }
  broadcastUserMutation('user:ban', rows.map(r => r.id))
  // 记录封禁前状态，便于撤销窗口内回滚
  const snapshot = rows.map(r => ({ row: r, banned: r.banned }))
  rows.forEach(r => { r.banned = true })
  applyFilter()
  let undone = false
  const n = ElNotification({
    title: '已批量封禁',
    message: `已封禁 ${rows.length} 个用户，8 秒内可撤销`,
    type: 'warning',
    duration: 8000,
    showClose: true,
  })
  // 撤销按钮
  const el = document.createElement('button')
  el.textContent = '撤销'
  el.style.cssText = 'margin-left:12px;padding:2px 10px;border:1px solid var(--el-border-color);border-radius:4px;background:transparent;cursor:pointer'
  el.onclick = () => {
    if (undone) return
    undone = true
    trackEvent('user:undo', { count: snapshot.length })
    snapshot.forEach(({ row, banned }) => { row.banned = banned })
    applyFilter()
    n.close()
    ElMessage.success('已撤销封禁')
  }
  // 追加到通知 message 容器
  setTimeout(() => {
    const msg = document.querySelector('.el-notification__content')
    if (msg && !msg.querySelector('button')) msg.appendChild(el)
  }, 0)
}

function handleEmptyAction() {
  if (hasFilter.value) {
    // 搜索无结果 → 清除筛选
    activeFilters.value = {}
    page.value = 1
    applyFilter()
    syncToQuery()
  } else {
    // 数据为空 → 填入示例数据（教育价值，可再清除）
    const samples = [
      { id: 'demo1', name: '示例建筑公司', company: '示例建设有限公司', mobile: '13800000001', tag: 'resident', status: 'active', banned: false, balance: { balance: 0 }, credits: { balance: 0 } },
      { id: 'demo2', name: '示例中介', company: '示例工程中介', mobile: '13800000002', tag: 'realname', status: 'active', banned: false, balance: { balance: 0 }, credits: { balance: 0 } }
    ]
    allData.value = [...allData.value, ...samples]
    applyFilter()
    ElMessage.success('已填入示例数据，可编辑后清除')
  }
}

function handleAdd() {
  isEdit.value = false
  currentRow.value = null
  form.value = { name: '', company: '', mobile: '', tag: 'registered' }
  dialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true
  currentRow.value = row
  form.value = {
    name: row.name,
    company: row.company || '',
    mobile: row.mobile || '',
    tag: row.tag || 'registered'
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return // 校验未过，字段已高亮
  }

  if (isEdit.value && currentRow.value) {
    // 编辑
    Object.assign(currentRow.value, form.value)
    ElMessage.success('已保存修改')
  } else {
    // 新增
    const newUser = {
      id: 'u' + Date.now(),
      ...form.value,
      status: 'active',
      balance: { balance: 0 },
      credits: { balance: 0 }
    }
    allData.value.unshift(newUser)
    ElMessage.success('已新增用户')
  }

  dialogVisible.value = false
  applyFilter()
}

onMounted(() => {
  initFromQuery(); loadData()
  // 跨 Tab：收到其他 Tab 的封禁/删除，本地实时更新
  onUserMutation(({ type, ids }) => {
    if (type === 'user:ban') {
      ids.forEach(id => { const r = allData.value.find(u => u.id === id); if (r) r.banned = true })
      applyFilter()
      ElMessage.info('其他标签页更新了用户状态')
    }
  })
})
</script>

<template>
  <div class="users-list-page">
    <div class="page-header">
      <div>
        <h2>用户管理</h2>
        <p class="page-desc">全平台用户列表，共 {{ total }} 人（不含游客）</p>
      </div>
      <div class="page-actions">
        <el-button v-permission="'user:export'" @click="handleExport">批量导出</el-button>
        <el-button v-permission="'user:edit'" type="primary" @click="handleAdd">新增用户</el-button>
      </div>
    </div>

    <VirtualUserTable :data="allData" :sensitive="canSeeSensitive">
    <Skeleton v-if="loading" variant="table" :rows="6" />

    <ProTable
      v-else
      :columns="columns"
      :filters="filters"
      :actions="actions"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      selection
      row-clickable
      :empty-type="hasFilter ? 'search' : 'default'"
      :empty-description="hasFilter ? '未找到匹配用户，试试更换关键词或身份类型' : '平台还没有用户，立即创建第一个用户'"
      empty-action-text="查看示例"
      @empty-action="handleEmptyAction"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
      @row-click="onRowClick"
      @action-click="onActionClick"
      @selection-change="onSelectionChange"
    >
      <!-- 批量操作栏按钮 -->
      <template #batch-actions="{ rows }">
        <el-button size="small" v-permission="'user:export'" @click="handleBatchExport(rows)">批量导出</el-button>
        <el-button size="small" type="danger" v-permission="'user:edit'" @click="handleBatchBan(rows)">批量封禁</el-button>
      </template>
      <!-- 姓名列：带头像 -->
      <template #name="{ row }">
        <div class="user-cell">
          <div class="user-cell__avatar">{{ row.avatar }}</div>
          <span>{{ row.name }}</span>
        </div>
      </template>

      <!-- 标签列 -->
      <template #tag="{ row }">
        <el-tag size="small">{{ row.tag }}</el-tag>
      </template>

      <!-- 状态列 -->
      <template #status="{ row }">
        <el-tag
          size="small"
          :type="row.banned ? 'danger' : (row.status === 'active' ? 'success' : 'info')"
        >
          {{ row.banned ? '已封禁' : '正常' }}
        </el-tag>
      </template>
    </ProTable>
    </VirtualUserTable>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="企业" prop="company">
          <el-input v-model="form.company" placeholder="请输入企业名称" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="form.mobile" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="身份标签" prop="tag">
          <el-select v-model="form.tag" style="width: 100%">
            <el-option label="注册会员" value="registered" />
            <el-option label="个人认证" value="realname" />
            <el-option label="个人入驻" value="pro" />
            <el-option label="企业认证" value="enterprise" />
            <el-option label="入驻企业" value="resident" />
            <el-option label="个人合伙人" value="partner" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.users-list-page {
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
    color: $color-text-primary;
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

.user-cell {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: $color-primary;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
  }
}
</style>
