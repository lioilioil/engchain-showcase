<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useLogStore } from '@/store/log.js'
const logStore = useLogStore()

const loading = ref(false)
const users = ref([])
const selectedRows = ref([])

const renewalList = computed(() => {
  return users.value
    .filter(u => u.entry && u.entry.type && u.entry.expireAt)
    .map(u => ({
      id: u.id,
      company: u.entry.co || u.company || '-',
      owner: u.name,
      type: u.entry.type,
      expireAt: u.entry.expireAt,
      fee: u.entry.fee || 0,
      daysLeft: Math.ceil((new Date(u.entry.expireAt) - new Date()) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
})

async function loadData() {
  loading.value = true
  try {
    users.value = await api.user.list()
  } finally {
    loading.value = false
  }
}

function handleRemind(row) {
  ElMessage.success(`已发送续费提醒给 ${row.company}`)
}

async function handleRenew(row) {
  // 真实更新 mock 用户会员到期：延长 1 年，写共享缓存刷新不还原
  const u = users.value.find(x => x.id === row.id)
  if (u && u.entry) {
    const cur = new Date(u.entry.expireAt)
    u.entry.expireAt = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate()).toISOString()
    row.expireAt = u.entry.expireAt
    row.daysLeft = Math.ceil((new Date(u.entry.expireAt) - new Date()) / 864e5)
  }
  logStore.addLog({
    action: '确认续费',
    module: '会员续费',
    target: `${row.company}(${row.type})`,
    extra: `延长1年，费用 ¥${row.fee}`
  })
  ElMessage.success(`已确认 ${row.company} 续费，到期日延长 1 年`)
}

function onSelectionChange({ rows }) {
  selectedRows.value = rows
}

function batchRemind() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要批量提醒的企业')
    return
  }
  ElMessage.success(`已向 ${selectedRows.value.length} 家企业发送续费提醒`)
  selectedRows.value = []
}

onMounted(loadData)
</script>

<template>
  <div class="renewal-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>年度续费管理</h2>
        <p class="page-desc">企业/会员年度到期与续费提醒</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="batchRemind">批量发送提醒</el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedRows.length > 0" class="batch-bar">
      <span>已选择 {{ selectedRows.length }} 家企业</span>
      <el-button size="small" type="primary" @click="batchRemind">批量发送提醒</el-button>
    </div>

    <el-table :data="renewalList" size="default" @selection-change="onSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column prop="company" label="企业名称" min-width="200" />
      <el-table-column prop="owner" label="企业主" width="120" />
      <el-table-column prop="type" label="入驻类型" width="130" />
      <el-table-column label="年费" width="120">
        <template #default="{ row }">¥{{ row.fee?.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="到期日期" width="120">
        <template #default="{ row }">{{ new Date(row.expireAt).toLocaleDateString() }}</template>
      </el-table-column>
      <el-table-column label="剩余天数" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.daysLeft < 30 ? 'danger' : row.daysLeft < 90 ? 'warning' : 'success'">
            {{ row.daysLeft }} 天
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleRemind(row)">发送提醒</el-button>
          <el-button size="small" type="success" link @click="handleRenew(row)">确认续费</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && renewalList.length === 0" description="暂无到期续费的会员" />
  </div>
</template>

<style lang="scss" scoped>
.renewal-page {
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

.page-actions {
  display: flex;
  gap: $spacing-sm;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-md;
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: $radius-md;
}
</style>
