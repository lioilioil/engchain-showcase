<template>
  <teleport to="body">
    <Transition name="drawer">
      <div v-if="modelValue" class="right-drawer">
        <header class="right-drawer__header">
          <slot name="title">
            <span class="right-drawer__title">{{ title }}</span>
          </slot>
          <div class="right-drawer__actions">
            <slot name="actions" />
            <button class="icon-btn icon-btn--sm" @click="close" title="关闭">
              <AppIcon name="x" :size="14" />
            </button>
          </div>
        </header>
        <div class="right-drawer__body">
          <slot />
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';

defineProps<{ modelValue: boolean; title?: string }>();
const emit = defineEmits(['update:modelValue']);
function close() {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.right-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--right-drawer-width);
  max-width: 100%;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-medium);
  box-shadow: var(--shadow-strong);
}
.right-drawer__header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-light);
}
.right-drawer__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--font-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.right-drawer__actions { display: inline-flex; align-items: center; gap: 4px; }
.right-drawer__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 抽屉滑入动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform var(--duration-normal) ease, opacity var(--duration-normal) ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
  opacity: 0.5;
}
</style>
