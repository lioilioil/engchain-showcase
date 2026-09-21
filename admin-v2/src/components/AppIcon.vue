<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="path"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ICON_PATHS } from '@/utils/icons';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number;
    strokeWidth?: number;
  }>(),
  { size: 16, strokeWidth: 2 }
);

const path = computed(() => ICON_PATHS[props.name] || '');
</script>

<style scoped>
.app-icon {
  flex-shrink: 0;
  display: block;
}
</style>
