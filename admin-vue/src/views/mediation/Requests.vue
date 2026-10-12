<script setup>
import { ref, onMounted } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

// 表格列配置
const columns = [
  { prop: 'id', label: '编号', width: 100 },
  { prop: 'title', label: '标题', minWidth: 280, slot: 'title' },
  { prop: 'cat', label: '分类', width: 110, slot: 'cat' },
  { prop: 'dir', label: '方向', width: 90, slot: 'dir' },
  { prop: 'company', label: '发布方', minWidth: 180 },
  { prop: 'location', label: '地区', width: 120 },
  { prop: 'amount', label: '金额', width: 120 },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'ts', label: '发布时间', width: 120 }
]

// 筛选配置
const filters = [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '搜索标题/企业' },
  { prop: 'cat', label: '分类', type: 'select', options: [
    { value: '材料', label: '材料' },
    { value: '设备', label: '设备' },
    { value: '劳务', label: '劳务' },
    { value: '中介服务', label: '中介服务' },
    { value: '资质招商', label: '资质招商' },
    { value: '建企买卖', label: '建企买卖' },
    { value: '招聘', label: '招聘' },
    { value: '求职', label: '求职' }
  ]},
  { prop: 'dir', label: '方向', type: 'select', options: [
    { value: 'supply', label: '供应' },
    { value: 'demand', label: '需求' }
  ]},
  { prop: 'status', label: '状态', type: 'select', options: [
    { value: 'on', label: '已上架' },
    { value: 'pending', label: '待审核' },
    { value: 'off', label: '已下架' },
    { value: 'rejected', label: '已驳回' }
  ]}
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 审核弹窗
const auditDialogVisible = ref(false)
const currentRow = ref(null)
const auditForm = ref({ note: '' })
const auditLoading = ref(false)

// 新增/编辑弹窗
const editDialogVisible = ref(false)
const isEdit = ref(false)
const editForm = ref({ title: '', cat: '材料', dir: 'supply', company: '', location: '', amount: '', note: '' })

async function loadData() {
  loading.value = true
  try {
    const list = await api.supply.list()
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
    result = result.filter(item =>
      item.title?.toLowerCase().includes(kw) ||
      item.company?.toLowerCase().includes(kw)
    )
  }
  if (filters.cat) {
    result = result.filter(item => item.cat === filters.cat)
  }
  if (filters.dir) {
    result = result.filter(item => item.dir === filters.dir)
  }
  if (filters.status) {
    result = result.filter(item => item.status === filters.status)
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
  auditForm.value = { note: row.note || '' }
  auditDialogVisible.value = true
}

async function handleAudit(action) {
  if (!currentRow.value) return

  // 驳回时校验意见必填
  if (action === 'reject' && !auditForm.value.note.trim()) {
    ElMessage.warning('驳回时请填写审核意见')
    return
  }

  auditLoading.value = true
  try {
    await api.supply.audit(currentRow.value.id, action, auditForm.value.note)
    ElMessage.success(action === 'approve' ? '已通过' : action === 'reject' ? '已驳回' : '已下架')
    auditDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    auditLoading.value = false
  }
}

function handlePublish() {
  isEdit.value = false
  editForm.value = { title: '', cat: '材料', dir: 'supply', company: '', location: '', amount: '', note: '' }
  editDialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true
  editForm.value = {
    title: row.title,
    cat: row.cat,
    dir: row.dir,
    company: row.company,
    location: row.location,
    amount: row.amount,
    note: row.note || ''
  }
  editDialogVisible.value = true
}

function handleSaveEdit() {
  if (!editForm.value.title) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!editForm.value.company) {
    ElMessage.warning('请输入发布方')
    return
  }

  if (isEdit.value && currentRow.value) {
    Object.assign(currentRow.value, editForm.value)
    ElMessage.success('已保存修改')
  } else {
    const newItem = {
      id: 's' + Date.now(),
      ...editForm.value,
      status: 'pending',
      ts: new Date().toLocaleDateString()
    }
    allData.value.unshift(newItem)
    ElMessage.success('已发布供需')
  }

  editDialogVisible.value = false
  applyFilter()
}

onMounted(loadData)
</script>

<template>
  <div class="supply-list-page">
    <div class="page-header">
      <div>
        <h2>供需信息池</h2>
        <p class="page-desc">全平台供需信息管理，共 {{ total }} 条</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="handlePublish">发布供需</el-button>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :filters="filters"
      :actions="[
        { label: '审核', type: 'primary', action: 'view' },
        { label: '编辑', action: 'edit' },
        { label: '通过', type: 'success', action: 'approve', if: (row) => row.status === 'pending' },
        { label: '驳回', action: 'reject', danger: true, if: (row) => row.status === 'pending' },
        { label: '下架', action: 'off', if: (row) => row.status === 'on' }
      ]"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
      @action-click="({ action, row }) => {
        if (action.action === 'edit') {
          handleEdit(row)
        } else {
          openAudit(row, action)
        }
      }"
    >
      <template #title="{ row }">
        <div class="title-cell">
          <span>{{ row.title }}</span>
          <el-tag v-if="row.note" size="small" type="warning" style="margin-left: 8px">{{ row.note }}</el-tag>
        </div>
      </template>
      <template #cat="{ row }">
        <el-tag size="small" effect="plain">{{ row.cat }}</el-tag>
      </template>
      <template #dir="{ row }">
        <el-tag size="small" :type="row.dir === 'supply' ? 'success' : 'warning'">
          {{ row.dir === 'supply' ? '供应' : '需求' }}
        </el-tag>
      </template>
      <template #status="{ row }">
        <el-tag
          size="small"
          :type="row.status === 'on' ? 'success' : (row.status === 'pending' ? 'warning' : (row.status === 'rejected' ? 'danger' : 'info'))"
        >
          {{ row.status === 'on' ? '已上架' : row.status === 'pending' ? '待审核' : row.status === 'rejected' ? '已驳回' : '已下架' }}
        </el-tag>
      </template>
    </ProTable>

    <!-- 审核弹窗 -->
    <el-dialog
      v-model="auditDialogVisible"
      title="供需审核"
      width="600px"
    >
      <template v-if="currentRow">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="编号">{{ currentRow.id }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ currentRow.cat }}</el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ currentRow.title }}</el-descriptions-item>
          <el-descriptions-item label="发布方">{{ currentRow.company }}</el-descriptions-item>
          <el-descriptions-item label="地区">{{ currentRow.location }}</el-descriptions-item>
          <el-descriptions-item label="金额">{{ currentRow.amount }}</el-descriptions-item>
          <el-descriptions-item label="发布时间">{{ currentRow.ts }}</el-descriptions-item>
        </el-descriptions>

        <el-input
          v-model="auditForm.note"
          type="textarea"
          :rows="3"
          placeholder="审核意见（驳回/下架时填写）"
          style="margin-top: 16px"
        />
      </template>

      <template #footer>
        <el-button @click="auditDialogVisible = false" :disabled="auditLoading">取消</el-button>
        <el-button v-if="currentRow?.status === 'on'" type="warning" :loading="auditLoading" @click="handleAudit('off')">下架</el-button>
        <el-button v-if="currentRow?.status === 'pending'" type="danger" :loading="auditLoading" @click="handleAudit('reject')">驳回</el-button>
        <el-button v-if="currentRow?.status === 'pending'" type="primary" :loading="auditLoading" @click="handleAudit('approve')">通过</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="isEdit ? '编辑供需' : '发布供需'"
      width="600px"
    >
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" placeholder="请输入供需标题" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.cat" style="width: 100%">
            <el-option label="材料" value="材料" />
            <el-option label="设备" value="设备" />
            <el-option label="劳务" value="劳务" />
            <el-option label="中介服务" value="中介服务" />
            <el-option label="资质招商" value="资质招商" />
            <el-option label="建企买卖" value="建企买卖" />
            <el-option label="招聘" value="招聘" />
            <el-option label="求职" value="求职" />
          </el-select>
        </el-form-item>
        <el-form-item label="方向">
          <el-radio-group v-model="editForm.dir">
            <el-radio value="supply">供应</el-radio>
            <el-radio value="demand">需求</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="发布方" required>
          <el-input v-model="editForm.company" placeholder="请输入发布企业" />
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="editForm.location" placeholder="请输入地区" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input v-model="editForm.amount" placeholder="请输入金额" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.note" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.supply-list-page {
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

.title-cell {
  display: flex;
  align-items: center;
}
</style>
