<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <slot name="icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </slot>
    </div>
    <div class="empty-state__title">{{ title }}</div>
    <div v-if="desc" class="empty-state__desc">{{ desc }}</div>
    <div v-if="actionText" class="empty-state__action">
      <button class="btn btn--primary" @click="$emit('action')">{{ actionText }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  desc?: string;
  actionText?: string;
}>();
defineEmits(['action']);
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}
.empty-state__icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--bg-tertiary);
  color: var(--font-light);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.empty-state__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--font-primary);
  margin-bottom: 4px;
}
.empty-state__desc {
  font-size: var(--font-size-md);
  color: var(--font-tertiary);
  max-width: 320px;
  line-height: 1.5;
}
.empty-state__action { margin-top: 16px; }
</style>
