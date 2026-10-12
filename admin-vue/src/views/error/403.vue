<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <div class="error-page__code">403</div>
    <div class="error-page__title">无权访问</div>
    <div class="error-page__desc">您当前的角色没有权限访问此页面，请联系管理员</div>
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
    color: $color-primary;
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
