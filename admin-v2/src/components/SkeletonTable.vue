<template>
  <div class="skeleton" v-if="loading">
    <div class="sk-line" :style="{ width: width }" v-for="i in rows" :key="i" />
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
defineProps<{ loading: boolean; rows?: number; width?: string }>();
</script>

<style scoped>
.skeleton { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; }
.sk-line { height: 16px; border-radius: 4px; background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
