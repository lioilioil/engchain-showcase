<script setup>
import { ref, onMounted } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

// 表格列配置
const columns = [
  { prop: 'name', label: '企业名称', minWidth: 220 },
  { prop: 'owner', label: '企业主', width: 120 },
  { prop: 'mobile', label: '联系电话', width: 140 },
  { prop: 'creditCode', label: '统一信用代码', width: 180 },
  { prop: 'status', label: '状态', width: 110, slot: 'status' },
  { prop: 'submittedAt', label: '提交时间', width: 120, formatter: (row) => row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '-' }
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

async function loadData() {
  loading.value = true
  try {
    // 从用户数据中提取企业入驻/变更审核记录
    const users = await api.user.list()
    const companies = users
      .filter(u => u.entry?.co)
      .map(u => ({
        id: u.id,
        name: u.entry.co,
        owner: u.name,
        mobile: u.mobile,
        creditCode: u.entry.creditCode || u.auth?.enterprise?.creditCode || '—',
        status: u.entry.status === 'first_ok' ? 'pending' : 'done',
        submittedAt: u.entry.submittedAt || u.auth?.enterprise?.submittedAt
      }))

    allData.value = companies
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

function openAudit(row) {
  currentRow.value = row
  auditForm.value = { note: '' }
  auditDialogVisible.value = true
}

async function handleAudit(passed) {
  if (!currentRow.value) return

  // 驳回时校验意见必填
  if (!passed && !auditForm.value.note.trim()) {
    ElMessage.warning('驳回时请填写审核意见')
    return
  }

  auditLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    currentRow.value.status = passed ? 'done' : 'rejected'
    ElMessage.success(passed ? '已通过审核' : '已驳回')
    auditDialogVisible.value = false
    applyFilter()
  } finally {
    auditLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="owner-review-page">
    <div class="page-header">
      <div>
        <h2>企业主验证审核</h2>
        <p class="page-desc">企业入驻信息变更与资质核验</p>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :actions="[
        { label: '审核', type: 'primary', action: 'audit', if: (row) => row.status === 'pending' }
      ]"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @page-change="onPageChange"
      @action-click="({ action, row }) => action === 'audit' && openAudit(row)"
    >
      <template #status="{ row }">
        <el-tag
          size="small"
          :type="row.status === 'pending' ? 'warning' : (row.status === 'done' ? 'success' : 'danger')"
        >
          {{ row.status === 'pending' ? '待审核' : row.status === 'done' ? '已通过' : '已驳回' }}
        </el-tag>
      </template>
    </ProTable>

    <!-- 审核弹窗 -->
    <el-dialog
      v-model="auditDialogVisible"
      title="企业审核"
      width="500px"
    >
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="企业名称">{{ currentRow.name }}</el-descriptions-item>
          <el-descriptions-item label="企业主">{{ currentRow.owner }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentRow.mobile }}</el-descriptions-item>
          <el-descriptions-item label="统一信用代码">{{ currentRow.creditCode }}</el-descriptions-item>
        </el-descriptions>

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
.owner-review-page {
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
</style>
