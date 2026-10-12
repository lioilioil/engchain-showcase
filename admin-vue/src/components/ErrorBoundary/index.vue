<script setup>
// 局部错误边界：捕获子树渲染错误，只降级该区块，不整页白屏
import { ref, onErrorCaptured } from 'vue'

defineProps({
  title: { type: String, default: '该模块暂时不可用' }
})

const hasError = ref(false)
const errMsg = ref('')

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errMsg.value = (err && err.message) ? err.message : String(err)
  console.error('[ErrorBoundary]', info, err)
  return false // 阻止向上冒泡，实现局部降级
})
</script>

<template>
  <div class="error-boundary">
    <slot v-if="!hasError" />
    <div v-else class="error-boundary__fallback">
      <div class="error-boundary__icon">!</div>
      <div class="error-boundary__title">{{ title }}</div>
      <div class="error-boundary__desc" v-if="errMsg">{{ errMsg }}</div>
      <el-button size="small" @click="hasError = false">重试</el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-boundary__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: $spacing-xl;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  text-align: center;
}
.error-boundary__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.error-boundary__title {
  font-size: 14px;
  font-weight: 600;
  color: $color-text-primary;
}
.error-boundary__desc {
  font-size: 12px;
  color: $color-text-secondary;
  max-width: 360px;
}
</style>
