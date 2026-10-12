<template>
  <div class="empty-state">
    <!-- 空状态图标 -->
    <div class="empty-state__icon">
      <svg v-if="type === 'inbox'" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="20" width="48" height="32" rx="4" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path d="M8 32 L20 32 L24 40 L40 40 L44 32 L56 32" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      </svg>
      <svg v-else-if="type === 'search'" viewBox="0 0 64 64" fill="none">
        <circle cx="28" cy="28" r="16" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path d="M40 40 L52 52" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
      </svg>
      <svg v-else-if="type === 'error'" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path d="M20 20 L44 44 M44 20 L20 44" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
      </svg>
      <svg v-else viewBox="0 0 64 64" fill="none">
        <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path d="M8 24 L56 24" stroke="currentColor" stroke-width="2" opacity="0.2"/>
        <path d="M16 36 L32 36 M16 44 L40 44" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.2"/>
      </svg>
    </div>

    <!-- 空状态文案 -->
    <div class="empty-state__title">{{ title }}</div>
    <div v-if="description" class="empty-state__description">{{ description }}</div>

    <!-- 行动按钮 -->
    <div v-if="actionText" class="empty-state__action">
      <el-button type="primary" size="small" @click="handleAction">
        {{ actionText }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  // 空状态类型：inbox / search / error / default
  type: { type: String, default: 'default' },
  // 主标题
  title: { type: String, default: '暂无数据' },
  // 描述文案
  description: { type: String, default: '' },
  // 行动按钮文案
  actionText: { type: String, default: '' }
})

const emit = defineEmits(['action'])

function handleAction() {
  emit('action')
}
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-secondary);

  &__icon {
    width: 80px;
    height: 80px;
    margin-bottom: $spacing-md;
    color: var(--color-text-placeholder);
    opacity: 0.6;
  }

  &__title {
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: var(--color-text-primary);
    margin-bottom: $spacing-xs;
  }

  &__description {
    font-size: $font-size-sm;
    color: var(--color-text-secondary);
    margin-bottom: $spacing-md;
    max-width: 320px;
    line-height: 1.6;
  }

  &__action {
    margin-top: $spacing-sm;
  }
}
</style>
