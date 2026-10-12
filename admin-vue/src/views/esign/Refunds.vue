<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import ProTable from '@/components/ProTable/index.vue'
import { useLogStore } from '@/store/log.js'
const logStore = useLogStore()

// 共享退款缓存（模块级，审核写回后刷新不还原）
const REFUND_CACHE = [
  { id: 'r1', orderId: 'o-1001', userName: '张工', amount: 5000, reason: '项目终止', status: 'pending', appliedAt: '2026-10-08' },
  { id: 'r2', orderId: 'o-1003', userName: '李总', amount: 12000, reason: '服务未达标', status: 'pending', appliedAt: '2026-10-09' },
  { id: 'r3', orderId: 'o-1005', userName: '王经理', amount: 3500, reason: '重复下单', status: 'approved', appliedAt: '2026-10-07' },
  { id: 'r4', orderId: 'o-1007', userName: '刘总', amount: 8000, reason: '价格争议', status: 'rejected', appliedAt: '2026-10-06' }
]

const columns = [
  { prop: 'id', label: '申请号', width: 100 },
  { prop: 'orderId', label: '关联订单', width: 140 },
  { prop: 'userName', label: '申请人', width: 120 },
  { prop: 'amount', label: '金额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'reason', label: '退款原因', minWidth: 180 },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'appliedAt', label: '申请时间', width: 120 }
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
    await new Promise(resolve => setTimeout(resolve, 300))
    allData.value = REFUND_CACHE // 共享缓存，审核写回后刷新不还原
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
    currentRow.value.status = passed ? 'approved' : 'rejected'
    logStore.addLog({
      action: passed ? '退款同意' : '退款驳回',
      module: '电子签退款',
      target: `${currentRow.value.userName}(${currentRow.value.orderId})`,
      extra: `¥${currentRow.value.amount} ${auditForm.value.note}`
    })
    ElMessage.success(passed ? '已同意退款' : '已驳回')
    auditDialogVisible.value = false
    applyFilter()
  } finally {
    auditLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="refunds-page">
    <div class="page-header">
      <h2>退款审核</h2>
      <p class="page-desc">电子签订单退款申请处理</p>
    </div>

    <ProTable
      :columns="columns"
      :actions="[
        { label: '同意', type: 'success', action: 'approve', if: (row) => row.status === 'pending' },
        { label: '驳回', action: 'reject', danger: true, if: (row) => row.status === 'pending' }
      ]"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @page-change="onPageChange"
      @action-click="({ action, row }) => openAudit(row)"
    >
      <template #status="{ row }">
        <el-tag size="small" :type="row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'danger'">
          {{ row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已同意' : '已驳回' }}
        </el-tag>
      </template>
    </ProTable>

    <!-- 审核弹窗 -->
    <el-dialog v-model="auditDialogVisible" title="退款审核" width="500px">
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="申请号">{{ currentRow.id }}</el-descriptions-item>
          <el-descriptions-item label="关联订单">{{ currentRow.orderId }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ currentRow.userName }}</el-descriptions-item>
          <el-descriptions-item label="退款金额">¥{{ currentRow.amount?.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="退款原因">{{ currentRow.reason }}</el-descriptions-item>
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
        <el-button type="success" :loading="auditLoading" @click="handleAudit(true)">同意退款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.refunds-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
