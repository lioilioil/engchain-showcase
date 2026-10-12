<template>
  <main id="main-content" class="app-main" tabindex="-1">
    <router-view v-slot="{ Component }">
      <transition name="fade-slide" mode="out-in">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </transition>
    </router-view>
  </main>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.app-main {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-lg;
  background: var(--color-bg-page);
}

// 页面切换动效（快速、轻盈）
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
