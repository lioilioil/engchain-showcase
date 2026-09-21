<template>
  <router-view v-if="!error" />
  <div v-else class="error-boundary">
    <h2>页面出错了</h2>
    <p>{{ error.message }}</p>
    <button class="btn btn--primary" @click="reload">刷新页面</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
const error = ref<Error | null>(null);
onErrorCaptured((err) => {
  error.value = err;
  console.error('[App]', err);
  return false;
});
function reload() { window.location.reload(); }
</script>

<style scoped>
.error-boundary {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100vh; gap: 12px; font-family: Inter, sans-serif;
}
.error-boundary h2 { color: #dc2626; }
.error-boundary p { color: #6b7280; }
</style>
