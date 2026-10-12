<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { usePermissionStore } from '@/store/permission.js'
import { maskCard } from '@/utils/mask.js'
const permStore = usePermissionStore()

// 对公充值申请共享缓存（mock，与提现互不串扰）
const RECHARGE_CACHE = [
  { id: 'rc1', userName: '陈建国', amount: 10000, bankName: '建行成都天府支行', bankAccount: '6217003810012345678', appliedAt: Date.now() - 864e5, status: 'pending' },
  { id: 'rc2', userName: '李雅', amount: 5000, bankName: '招行成都高新支行', bankAccount: '6225880123456789012', appliedAt: Date.now() - 2 * 864e5, status: 'pending' },
  { id: 'rc3', userName: '王强', amount: 20000, bankName: '工行成都春熙支行', bankAccount: '6212264402019876543', appliedAt: Date.now() - 3 * 864e5, status: 'approved' }
]

const columns = [
  { prop: 'id', label: '申请号', width: 100 },
  { prop: 'userName', label: '用户', width: 120 },
  { prop: 'amount', label: '金额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'bankName', label: '收款银行', width: 140 },
  { prop: 'bankAccount', label: '银行账号', width: 180, formatter: (row) => permStore.has('sensitive:view') ? row.bankAccount : maskCard(row.bankAccount) },
  { prop: 'appliedAt', label: '申请时间', width: 160, formatter: (row) => new Date(row.appliedAt).toLocaleString('zh-CN') }
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
    // 真实 mock 对公充值申请（此前误用提现 pending 列表，方向反转）
    allData.value = RECHARGE_CACHE.filter(r => r.status === 'pending')
    applyFilter()
  } finally { loading.value = false }
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
    ElMessage.success(passed ? '已确认到账' : '已驳回')
    auditDialogVisible.value = false
    loadData()
  } finally {
    auditLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="recharge-page">
    <div class="page-header">
      <h2>充值/对公审批</h2>
      <p class="page-desc">用户对公转账充值审批</p>
    </div>

    <ProTable
      :columns="columns"
      :actions="[
        { label: '确认到账', type: 'success', action: 'approve' },
        { label: '驳回', action: 'reject', danger: true }
      ]"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @page-change="onPageChange"
      @action-click="({ action, row }) => openAudit(row)"
    />

    <!-- 审核弹窗 -->
    <el-dialog v-model="auditDialogVisible" title="充值审批" width="500px">
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="用户">{{ currentRow.userName }}</el-descriptions-item>
          <el-descriptions-item label="充值金额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="收款银行">{{ currentRow.bankName }}</el-descriptions-item>
          <el-descriptions-item label="银行账号">{{ currentRow.bankAccount }}</el-descriptions-item>
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
        <el-button type="success" :loading="auditLoading" @click="handleAudit(true)">确认到账</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.recharge-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
