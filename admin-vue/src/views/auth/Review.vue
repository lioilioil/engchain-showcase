<script setup>
import { ref, onMounted } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { useLogStore } from '@/store/log.js'
import { usePermissionStore } from '@/store/permission.js'
import { maskPhone } from '@/utils/mask.js'

const logStore = useLogStore()
const permStore = usePermissionStore()

// 表格列配置
const columns = [
  { prop: 'name', label: '用户', width: 120, slot: 'user' },
  { prop: 'company', label: '企业', minWidth: 180 },
  { prop: 'mobile', label: '手机号', width: 130, formatter: (row) => permStore.has('sensitive:view') ? row.mobile : maskPhone(row.mobile) },
  { prop: 'authType', label: '认证类型', width: 120, slot: 'authType' },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'submittedAt', label: '提交时间', width: 150, formatter: (row) => row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '-' },
  { prop: 'reviewedAt', label: '审核时间', width: 150, formatter: (row) => row.reviewedAt ? new Date(row.reviewedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' }
]

// 筛选配置
const filters = [
  { prop: 'authType', label: '认证类型', type: 'select', options: [
    { value: 'realname', label: '实名认证' },
    { value: 'enterprise', label: '企业认证' },
    { value: 'qual', label: '个人资质' },
    { value: 'partner', label: '个人合伙人' }
  ]},
  { prop: 'status', label: '状态', type: 'select', options: [
    { value: 'pending', label: '待审核' },
    { value: 'approved', label: '已通过' },
    { value: 'rejected', label: '已驳回' }
  ]}
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const selectedRows = ref([])

// 审核弹窗
const auditDialogVisible = ref(false)
const currentRow = ref(null)
const auditForm = ref({ note: '' })
const auditLoading = ref(false)

// 从用户数据中提取待审核的认证记录
function extractAuthRecords(users) {
  const records = []
  users.forEach(u => {
    if (u.id === 'u7') return // 跳过游客

    // 企业认证待审
    if (u.auth?.enterprise?.status === 'pending') {
      records.push({
        id: u.id + '-enterprise',
        userId: u.id,
        name: u.name,
        company: u.auth.enterprise.co || u.company || '-',
        mobile: u.mobile,
        authType: 'enterprise',
        authTypeLabel: '企业认证',
        status: 'pending',
        submittedAt: u.auth.enterprise.submittedAt,
        detail: u.auth.enterprise
      })
    }

    // 个人资质待审
    if (u.auth?.qual?.status === 'pending' || u.auth?.personalEntry?.status === 'pending') {
      records.push({
        id: u.id + '-qual',
        userId: u.id,
        name: u.name,
        company: u.company || '-',
        mobile: u.mobile,
        authType: 'qual',
        authTypeLabel: '个人资质',
        status: 'pending',
        submittedAt: u.auth.qual?.submittedAt || u.auth.personalEntry?.submittedAt,
        detail: u.auth.qual || u.auth.personalEntry
      })
    }

    // 个人合伙人待审
    if (u.auth?.partner?.status === 'pending') {
      records.push({
        id: u.id + '-partner',
        userId: u.id,
        name: u.name,
        company: u.company || '-',
        mobile: u.mobile,
        authType: 'partner',
        authTypeLabel: '个人合伙人',
        status: 'pending',
        submittedAt: u.auth.partner.submittedAt,
        detail: u.auth.partner
      })
    }
  })
  return records
}

async function loadData() {
  loading.value = true
  try {
    const users = await api.user.list()
    allData.value = extractAuthRecords(users)
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter(filters = {}) {
  let result = [...allData.value]

  if (filters.authType) {
    result = result.filter(r => r.authType === filters.authType)
  }
  if (filters.status) {
    result = result.filter(r => r.status === filters.status)
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

function openAudit(row, action) {
  currentRow.value = row
  auditForm.value = { note: '' }
  auditDialogVisible.value = true
}

// 命名依据中文展示（前端 setBasis：tradeName / trademark / brand）
function basisLabel(v) {
  const map = { tradeName: '基于字号/商号命名', trademark: '基于商标命名', brand: '基于品牌/产品命名' }
  return map[v] || v || '-'
}

// 聚合可展示材料：命名证明 nameProof + 各核验维度 files + 个人资质 list，去重
function collectMaterials(detail) {
  const out = []
  if (!detail) return out
  if (detail.businessLicense) out.push(detail.businessLicense)
  ;(detail.nameProof || []).forEach(p => { if (p && p.name) out.push(p.name) })
  const dims = detail.dimensions
  if (dims && typeof dims === 'object') {
    Object.keys(dims).forEach(k => {
      const d = dims[k]
      ;(d && d.files || []).forEach(f => { if (f && f.name) out.push(f.name) })
    })
  }
  ;(detail.list || []).forEach(x => {
    const n = typeof x === 'string' ? x : (x && x.name)
    if (n) out.push(n)
  })
  return [...new Set(out)]
}

async function handleAudit(passed) {
  // 驳回时校验意见必填
  if (!passed && !auditForm.value.note.trim()) {
    ElMessage.warning('驳回时请填写审核意见')
    return
  }

  auditLoading.value = true
  try {
    // mock 审核操作
    await new Promise(resolve => setTimeout(resolve, 300))

    const row = currentRow.value
    row.status = passed ? 'approved' : 'rejected'
    if (auditForm.value.note) row.note = auditForm.value.note

    // 真实回写共享用户数据层（mock users 缓存 + localStorage engchain-users），刷新不还原、前端可见
    const users = await api.user.list()
    const u = users.find(x => x.id === row.userId)
    if (u && u.auth && u.auth[row.authType]) {
      u.auth[row.authType].ok = passed
      u.auth[row.authType].status = passed ? 'approved' : 'rejected'
      u.auth[row.authType].reviewedAt = new Date().toISOString()
      if (auditForm.value.note) u.auth[row.authType].note = auditForm.value.note
      /* 企业认证通过：即时授予一年有效期（与前端 authApprove 口径一致） */
      if (row.authType === 'enterprise' && passed) {
        u.auth.enterprise.expireAt = Date.now() + 365 * 864e5
      }
    }
    await api.user.save()
    logStore.addLog({
      action: passed ? '认证审核通过' : '认证审核驳回',
      module: '认证审核',
      target: `${row.name}(${row.authTypeLabel})`,
      extra: auditForm.value.note
    })

    ElMessage.success(passed ? '已通过审核' : '已驳回')
    auditDialogVisible.value = false
    applyFilter()
  } finally {
    auditLoading.value = false
  }
}

function onSelectionChange({ rows }) {
  selectedRows.value = rows
}

async function batchApprove() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要批量通过的记录')
    return
  }

  auditLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    const users = await api.user.list()
    selectedRows.value.forEach(row => {
      row.status = 'approved'
      const u = users.find(x => x.id === row.userId)
      if (u && u.auth && u.auth[row.authType]) {
        u.auth[row.authType].ok = true
        u.auth[row.authType].status = 'approved'
        u.auth[row.authType].reviewedAt = new Date().toISOString()
        if (row.authType === 'enterprise') u.auth.enterprise.expireAt = Date.now() + 365 * 864e5
      }
    })
    await api.user.save()
    logStore.addLog({
      action: '批量审核通过',
      module: '认证审核',
      target: `${selectedRows.value.length} 条记录`,
      extra: `通过用户: ${selectedRows.value.map(r => r.name).join(', ')}`
    })
    ElMessage.success(`已批量通过 ${selectedRows.value.length} 条审核`)
    selectedRows.value = []
    applyFilter()
  } finally {
    auditLoading.value = false
  }
}

async function batchReject() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要批量驳回的记录')
    return
  }

  auditLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    const users = await api.user.list()
    selectedRows.value.forEach(row => {
      row.status = 'rejected'
      const u = users.find(x => x.id === row.userId)
      if (u && u.auth && u.auth[row.authType]) {
        u.auth[row.authType].ok = false
        u.auth[row.authType].status = 'rejected'
        u.auth[row.authType].reviewedAt = new Date().toISOString()
      }
    })
    await api.user.save()
    logStore.addLog({
      action: '批量审核驳回',
      module: '认证审核',
      target: `${selectedRows.value.length} 条记录`,
      extra: `驳回用户: ${selectedRows.value.map(r => r.name).join(', ')}`
    })
    ElMessage.success(`已批量驳回 ${selectedRows.value.length} 条审核`)
    selectedRows.value = []
    applyFilter()
  } finally {
    auditLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="auth-review-page">
    <div class="page-header">
      <h2>认证审核</h2>
      <p class="page-desc">用户提交的实名认证、企业认证、资质认证等申请</p>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedRows.length > 0" class="batch-bar">
      <span>已选择 {{ selectedRows.length }} 条记录</span>
      <div class="batch-bar__actions">
        <el-button type="success" size="small" :loading="auditLoading" @click="batchApprove">批量通过</el-button>
        <el-button type="danger" size="small" :loading="auditLoading" @click="batchReject">批量驳回</el-button>
      </div>
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
      :selection="true"
      :actions="[
        { label: '通过', type: 'success', action: 'approve' },
        { label: '驳回', action: 'reject', danger: true }
      ]"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
      @selection-change="onSelectionChange"
      @action-click="({ action, row }) => openAudit(row, action.action)"
    >
      <template #user="{ row }">
        <div class="user-cell">
          <div class="user-cell__avatar">{{ row.name?.[0] || '?' }}</div>
          <span>{{ row.name }}</span>
        </div>
      </template>
      <template #authType="{ row }">
        <el-tag size="small">{{ row.authTypeLabel }}</el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="row.status === 'pending' ? 'warning' : (row.status === 'approved' ? 'success' : 'danger')">
          {{ row.status === 'pending' ? '待审核' : (row.status === 'approved' ? '已通过' : '已驳回') }}
        </el-tag>
      </template>
    </ProTable>

    <!-- 审核弹窗 -->
    <el-dialog
      v-model="auditDialogVisible"
      title="审核认证申请"
      width="500px"
    >
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="用户">{{ currentRow.name }}</el-descriptions-item>
          <el-descriptions-item label="认证类型">{{ currentRow.authTypeLabel }}</el-descriptions-item>
          <el-descriptions-item label="企业">{{ currentRow.company }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ currentRow.mobile }}</el-descriptions-item>
        </el-descriptions>

        <!-- 企业认证：工商信息与联系人 -->
        <el-descriptions
          v-if="currentRow.authType === 'enterprise' && currentRow.detail"
          :column="1"
          border
          size="small"
          style="margin-top: 12px"
        >
          <el-descriptions-item v-if="currentRow.detail.code" label="统一社会信用代码">
            {{ currentRow.detail.code }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.legal" label="法定代表人">
            {{ currentRow.detail.legal }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.shortName" label="企业简称">
            {{ currentRow.detail.shortName }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.nameBasis" label="命名依据">
            {{ basisLabel(currentRow.detail.nameBasis) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.contactName" label="联系人">
            {{ currentRow.detail.contactName }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.contactPhone" label="联系电话">
            {{ currentRow.detail.contactPhone }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.registeredAddress" label="注册地址">
            {{ currentRow.detail.registeredAddress }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRow.detail.address" label="办公地址">
            {{ currentRow.detail.address }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 证明材料预览：命名证明 + 维度材料 + 资质清单 -->
        <div class="materials" style="margin-top: 12px">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px">证明材料</div>
          <div v-if="collectMaterials(currentRow.detail).length" class="material-list">
            <div v-for="(m, i) in collectMaterials(currentRow.detail)" :key="i" class="material-item">📄 {{ m }}</div>
          </div>
          <div v-else class="material-empty" style="font-size: 12px; color: #999">无提交材料</div>
        </div>

        <el-input
          v-model="auditForm.note"
          type="textarea"
          :rows="3"
          placeholder="审核意见（驳回时必填）"
          style="margin-top: 16px"
        />
      </template>

      <template #footer>
        <el-button @click="auditDialogVisible = false" :disabled="auditLoading">取消</el-button>
        <el-button type="danger" :loading="auditLoading" @click="handleAudit(false)">驳回</el-button>
        <el-button type="primary" :loading="auditLoading" @click="handleAudit(true)">通过</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.auth-review-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
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

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-md;
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: $radius-md;

  &__actions {
    display: flex;
    gap: $spacing-sm;
  }
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
  }
}
</style>
