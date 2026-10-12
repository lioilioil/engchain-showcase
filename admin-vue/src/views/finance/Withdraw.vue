<script setup>
import { ref, onMounted, computed } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { usePermissionStore } from '@/store/permission.js'
import { maskPhone, maskCard } from '@/utils/mask.js'

const permStore = usePermissionStore()
const canSeeSensitive = computed(() => permStore.has('sensitive:view'))

// 表格列
const columns = [
  { prop: 'id', label: '申请号', width: 100 },
  { prop: 'userName', label: '申请人', width: 120 },
  { prop: 'mobile', label: '手机号', width: 130, formatter: (row) => canSeeSensitive.value ? row.mobile : maskPhone(row.mobile) },
  { prop: 'amount', label: '金额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'bankName', label: '银行', width: 140 },
  { prop: 'bankAccount', label: '银行卡号', width: 180, formatter: (row) => canSeeSensitive.value ? row.bankAccount : maskCard(row.bankAccount) },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'appliedAt', label: '申请时间', width: 160, formatter: (row) => new Date(row.appliedAt).toLocaleString('zh-CN') }
]

const filters = [
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

// 弹窗
const auditDialogVisible = ref(false)
const currentRow = ref(null)
const auditForm = ref({ note: '' })
const auditLoading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const list = await api.finance.listWithdrawals()
    allData.value = list
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter(filters = {}) {
  let result = [...allData.value]
  if (filters.status) {
    result = result.filter(w => w.status === filters.status)
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

function openAudit(row) {
  currentRow.value = row
  auditForm.value = { note: '' }
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
    const apiFn = action === 'approve' ? api.finance.withdrawApprove : api.finance.withdrawReject
    await apiFn(currentRow.value.id, auditForm.value.note)
    ElMessage.success(action === 'approve' ? '已通过，打款中' : '已驳回')
    auditDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    auditLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="withdraw-page">
    <div class="page-header">
      <div>
        <h2>提现审批</h2>
        <p class="page-desc">用户提现申请审核与打款</p>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :filters="filters"
      :actions="[
        { label: '审核', type: 'primary', action: 'audit', if: (row) => row.status === 'pending' }
      ]"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
      @action-click="({ action, row }) => action === 'audit' && openAudit(row)"
    >
      <template #status="{ row }">
        <el-tag
          size="small"
          :type="row.status === 'pending' ? 'warning' : (row.status === 'approved' ? 'success' : 'danger')"
        >
          {{ row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已通过' : '已驳回' }}
        </el-tag>
      </template>
    </ProTable>

    <!-- 审核弹窗 -->
    <el-dialog v-model="auditDialogVisible" title="提现审核" width="500px">
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="申请人">{{ currentRow.userName }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ canSeeSensitive ? currentRow.mobile : maskPhone(currentRow.mobile) }}</el-descriptions-item>
          <el-descriptions-item label="提现金额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="开户银行">{{ currentRow.bankName }}</el-descriptions-item>
          <el-descriptions-item label="银行卡号">{{ canSeeSensitive ? currentRow.bankAccount : maskCard(currentRow.bankAccount) }}</el-descriptions-item>
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
        <el-button type="danger" :loading="auditLoading" @click="handleAudit('reject')">驳回</el-button>
        <el-button type="primary" :loading="auditLoading" @click="handleAudit('approve')">通过并打款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.withdraw-page {
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
