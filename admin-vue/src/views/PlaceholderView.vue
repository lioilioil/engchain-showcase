<template>
  <div class="placeholder-page">
    <el-card shadow="never">
      <h1 class="title">{{ route.meta.title || '页面' }}</h1>
      <p class="subtitle">模块占位 · 待迁移</p>
      <el-divider />
      <p class="meta">路径：<code>{{ route.path }}</code></p>
      <p class="meta">分组：{{ route.meta.group || '—' }}</p>
      <div class="actions">
        <el-button type="primary" @click="router.push('/dashboard')">返回首页</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
</script>

<style lang="scss" scoped>
.placeholder-page {
  padding: 24px;
}
.title {
  margin: 0 0 8px;
  font-size: 22px;
  color: #1f2328;
}
.subtitle {
  color: #6e7781;
  margin: 0;
}
.meta {
  color: #424a53;
  font-size: 13px;
  code {
    background: #f6f8fa;
    padding: 2px 6px;
    border-radius: 4px;
  }
}
.actions {
  margin-top: 20px;
}
</style>
