<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

/* M2-2：省级总代审核/终止走独立桥接视图（方案A 种子导出），本队列仅处理旧入驻 */
const router = useRouter()

const columns = [
  { prop: 'id', label: '编号', width: 100 },
  { prop: 'name', label: '申请人', width: 120 },
  { prop: 'company', label: '企业/机构', minWidth: 200 },
  { prop: 'entryType', label: '入驻类型', width: 130, slot: 'entryType' },
  { prop: 'mobile', label: '联系电话', width: 130 },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'submittedAt', label: '提交时间', width: 120, formatter: (row) => row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '-' }
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const auditDialogVisible = ref(false)
const currentRow = ref(null)
const auditForm = ref({ note: '' })
const auditLoading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const users = await api.user.list()
    const entries = users
      .filter(u => u.entry && (u.entry.status === 'pending' || u.entry.status === 'first_ok'))
      .map(u => ({
        id: u.id,
        name: u.name,
        company: u.entry.co || u.company || '-',
        entryType: u.entry.type || '企业入驻',
        mobile: u.mobile,
        status: u.entry.status === 'first_ok' ? 'pending' : u.entry.status,
        submittedAt: u.entry.submittedAt || u.auth?.enterprise?.submittedAt
      }))

    allData.value = entries
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
    currentRow.value.status = passed ? 'approved' : 'rejected'
    ElMessage.success(passed ? '已通过入驻审核' : '已驳回')
    auditDialogVisible.value = false
    applyFilter()
  } finally {
    auditLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="entry-review-page">
    <div class="page-header">
      <div>
        <h2>入驻审核</h2>
        <p class="page-desc">建筑/中介入驻申请审核（省级总代审核/终止见独立桥接视图；个人合伙人走独立认证审核）</p>
      </div>
      <el-button size="small" type="primary" plain @click="router.push('/agents/province')">省代开通/审核/终止（桥接）</el-button>
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
      <template #entryType="{ row }">
        <el-tag size="small" effect="plain">{{ row.entryType }}</el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="row.status === 'pending' ? 'warning' : (row.status === 'approved' ? 'success' : 'danger')">
          {{ row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已通过' : '已驳回' }}
        </el-tag>
      </template>
    </ProTable>

    <el-dialog v-model="auditDialogVisible" title="入驻审核" width="500px">
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="申请人">{{ currentRow.name }}</el-descriptions-item>
          <el-descriptions-item label="入驻类型">{{ currentRow.entryType }}</el-descriptions-item>
          <el-descriptions-item label="企业名称">{{ currentRow.company }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentRow.mobile }}</el-descriptions-item>
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
.entry-review-page {
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
