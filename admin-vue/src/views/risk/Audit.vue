<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const logs = ref([])
const loadError = ref(false)

async function loadData() {
  loading.value = true
  loadError.value = false
  try {
    logs.value = await api.system.listAuditLogs()
  } catch (e) {
    loadError.value = true
    logs.value = []
  } finally { loading.value = false }
}

onMounted(loadData)
</script>

<template>
  <div class="audit-page" v-loading="loading">
    <div class="page-header">
      <h2>合规审计</h2>
      <p class="page-desc">平台操作审计与合规记录</p>
    </div>
    <el-table :data="logs" size="default">
      <el-table-column prop="module" label="模块" width="120" />
      <el-table-column prop="action" label="操作" width="140" />
      <el-table-column prop="operator" label="操作人" width="120" />
      <el-table-column prop="target" label="操作对象" min-width="180" />
      <el-table-column label="时间" width="160">
        <template #default="{ row }">{{ row.time || row.ts }}</template>
      </el-table-column>
      <template #empty>
        <el-empty :description="loadError ? '审计日志加载失败，请稍后重试' : '暂无审计记录'" />
      </template>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.audit-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
</style>
