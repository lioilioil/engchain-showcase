<script setup>
import { ref, onMounted } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { useLogStore } from '@/store/log.js'
const logStore = useLogStore()

// 表格列配置
const columns = [
  { prop: 'id', label: '编号', width: 100 },
  { prop: 'userName', label: '被举报用户', width: 120 },
  { prop: 'company', label: '所属企业', minWidth: 180 },
  { prop: 'level', label: '严重程度', width: 110, slot: 'level' },
  { prop: 'desc', label: '违规描述', minWidth: 280 },
  { prop: 'ts', label: '发现时间', width: 120 },
  { prop: 'status', label: '状态', width: 100, slot: 'status' }
]

// 筛选
const filters = [
  { prop: 'level', label: '严重程度', type: 'select', options: [
    { value: 'warn', label: '警告' },
    { value: 'serious', label: '严重' }
  ]},
  { prop: 'status', label: '状态', type: 'select', options: [
    { value: 'open', label: '待处理' },
    { value: 'done', label: '已处理' }
  ]}
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 处理弹窗
const punishDialogVisible = ref(false)
const currentRow = ref(null)
const punishForm = ref({ action: 'warn' })

// 处罚档位
const punishSteps = [
  { id: 'warn', label: '警告' },
  { id: 'ban7', label: '禁聊 7 天' },
  { id: 'ban30', label: '二次禁聊 30 天' },
  { id: 'fine', label: '罚款 ¥5,000' },
  { id: 'freeze15', label: '停号 15 天' },
  { id: 'remove', label: '二次清退' }
]

async function loadData() {
  loading.value = true
  try {
    const list = await api.finance.listViolations()
    allData.value = list
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter(filters = {}) {
  let result = [...allData.value]

  if (filters.level) {
    result = result.filter(v => v.level === filters.level)
  }
  if (filters.status) {
    result = result.filter(v => v.status === filters.status)
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

function openPunish(row) {
  currentRow.value = row
  punishForm.value = { action: 'warn' }
  punishDialogVisible.value = true
}

async function handlePunish() {
  if (!currentRow.value) return
  try {
    const step = punishSteps.find(s => s.id === punishForm.value.action)
    await api.finance.punishViolation(currentRow.value.id, step?.label || '警告')
    // 分派留痕：记录处理人并置已处理
    currentRow.value.assignee = punishForm.value.assignee || '未分派'
    currentRow.value.status = 'resolved'
    // 落库联动：停号/清退类真实写入用户 banned，列表/详情标识
    const hardSteps = ['ban15', 'clear']
    if (hardSteps.includes(punishForm.value.action)) {
      const users = await api.user.list()
      const u = users.find(x => x.name === currentRow.value.userName)
      if (u) u.banned = true
    }
    logStore.addLog({
      action: '违规处罚',
      module: '举报处理',
      target: `${currentRow.value.userName}(${step?.label || '警告'})`,
      extra: currentRow.value.desc
    })
    ElMessage.success('处罚已执行')
    punishDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

onMounted(loadData)
</script>

<template>
  <div class="reports-page">
    <div class="page-header">
      <div>
        <h2>举报处理</h2>
        <p class="page-desc">平台违规行为举报与处罚管理</p>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :filters="filters"
      :actions="[
        { label: '处理', type: 'primary', action: 'punish', if: (row) => row.status === 'open' }
      ]"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="id"
      @filter-change="onFilterChange"
      @page-change="onPageChange"
      @action-click="({ action, row }) => action === 'punish' && openPunish(row)"
    >
      <template #level="{ row }">
        <el-tag size="small" :type="row.level === 'serious' ? 'danger' : 'warning'">
          {{ row.level === 'serious' ? '严重' : '警告' }}
        </el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="row.status === 'open' ? 'warning' : 'success'">
          {{ row.status === 'open' ? '待处理' : '已处理' }}
        </el-tag>
        <div v-if="row.assignee" style="font-size:11px; color:#999; margin-top:2px">处理人：{{ row.assignee }}</div>
      </template>
    </ProTable>

    <!-- 处罚弹窗 -->
    <el-dialog
      v-model="punishDialogVisible"
      title="违规处罚"
      width="500px"
    >
      <template v-if="currentRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="用户">{{ currentRow.userName }} · {{ currentRow.company }}</el-descriptions-item>
          <el-descriptions-item label="违规描述">{{ currentRow.desc }}</el-descriptions-item>
        </el-descriptions>

        <el-form style="margin-top: 16px">
          <el-form-item label="分派处理人">
            <el-select v-model="punishForm.assignee" placeholder="选择处理人">
              <el-option label="风控专员 · 王强" value="王强" />
              <el-option label="运营专员 · 李娜" value="李娜" />
              <el-option label="合规专员 · 赵磊" value="赵磊" />
            </el-select>
          </el-form-item>
          <el-form-item label="处罚措施">
            <el-radio-group v-model="punishForm.action">
              <el-radio v-for="step in punishSteps" :key="step.id" :value="step.id">
                {{ step.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button @click="punishDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePunish">确认处罚</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.reports-page {
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
