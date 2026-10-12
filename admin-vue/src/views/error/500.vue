<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <div class="error-page__code">500</div>
    <div class="error-page__title">服务异常</div>
    <div class="error-page__desc">页面加载或渲染时发生错误，可返回首页重试，或联系技术支持</div>
    <el-button type="primary" @click="router.push('/dashboard')">返回首页</el-button>
  </div>
</template>

<style lang="scss" scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: $spacing-md;

  &__code {
    font-size: 72px;
    font-weight: 700;
    color: $color-danger;
    line-height: 1;
  }

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
  }

  &__desc {
    font-size: 14px;
    color: $color-text-secondary;
    margin-bottom: $spacing-md;
  }
}
</style>
