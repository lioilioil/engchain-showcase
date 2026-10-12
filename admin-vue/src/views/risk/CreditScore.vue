<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const users = ref([])

const creditUsers = computed(() => {
  return users.value.map(u => ({
    id: u.id,
    name: u.name,
    company: u.company || '-',
    score: u.credits?.balance || 60 + Math.floor(Math.random() * 40),
    level: u.credits?.balance > 800 ? 'A' : u.credits?.balance > 500 ? 'B' : 'C'
  }))
})

async function loadData() {
  loading.value = true
  try {
    users.value = await api.user.list()
  } finally { loading.value = false }
}

function handleAdjustScore(row) {
  ElMessage.info(`调整 ${row.name} 的诚信分`)
}

onMounted(loadData)
</script>

<template>
  <div class="credit-score-page" v-loading="loading">
    <div class="page-header">
      <h2>诚信分管理</h2>
      <p class="page-desc">用户诚信评分与等级管理</p>
    </div>
    <el-table :data="creditUsers" size="default">
      <el-table-column prop="name" label="用户" width="120" />
      <el-table-column prop="company" label="企业" min-width="200" />
      <el-table-column label="诚信分" width="120">
        <template #default="{ row }">
          <span :style="{ color: row.score > 800 ? '#1f883d' : row.score > 500 ? '#d4a72c' : '#cf222e', fontWeight: 600 }">
            {{ row.score }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="等级" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.level === 'A' ? 'success' : row.level === 'B' ? 'warning' : 'danger'">
            {{ row.level }}级
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleAdjustScore(row)">调整分数</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.credit-score-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
