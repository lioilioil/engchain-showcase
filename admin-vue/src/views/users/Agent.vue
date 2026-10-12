<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const users = ref([])

async function loadData() {
  loading.value = true
  try {
    const list = await api.user.list()
    users.value = list.filter(u => u.agent)
  } finally {
    loading.value = false
  }
}

function handleViewDetail(row) {
  ElMessage.info(`查看 ${row.name} 的代理详情`)
}

onMounted(loadData)
</script>

<template>
  <div class="agent-page" v-loading="loading">
    <div class="page-header">
      <h2>委托代理</h2>
      <p class="page-desc">用户委托代理管理</p>
    </div>

    <el-table :data="users" size="default">
      <el-table-column prop="name" label="委托人" width="120" />
      <el-table-column prop="company" label="企业" min-width="200" />
      <el-table-column label="代理人" width="120">
        <template #default="{ row }">{{ row.agent?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="权限范围" min-width="200">
        <template #default="{ row }">
          <el-tag v-for="p in (row.agent?.permissions || [])" :key="p" size="small" style="margin-right: 4px">{{ p }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleViewDetail(row)">查看详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && users.length === 0" description="暂无委托代理记录" />
  </div>
</template>

<style lang="scss" scoped>
.agent-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
