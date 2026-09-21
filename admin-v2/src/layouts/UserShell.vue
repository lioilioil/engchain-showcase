<template>
  <div class="u-shell">
    <aside class="u-nav">
      <div class="u-nav__brand">E</div>
      <nav class="u-nav__list">
        <router-link
          v-for="item in items"
          :key="item.path"
          :to="item.path"
          class="u-nav__item"
          :class="{ 'is-active': isActive(item.path) }"
        >
          <AppIcon :name="item.icon" :size="16" />
        </router-link>
      </nav>
      <div class="u-nav__footer">
        <button class="icon-btn icon-btn--sm" @click="onLogout" title="退出">
          <AppIcon name="logout" :size="14" />
        </button>
      </div>
    </aside>
    <div class="u-main">
      <header class="u-header">
        <button class="view-switcher">
          <AppIcon name="search" :size="14" />
          <span>搜索…</span>
          <span class="hotkey">⌘K</span>
        </button>
      </header>
      <main class="u-body">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import AppIcon from '@/components/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const items = [
  { path: '/u/dashboard', icon: 'layout-grid', label: '工作台' },
  { path: '/u/publish', icon: 'plus', label: '发布' },
  { path: '/u/orders', icon: 'file', label: '订单' },
  { path: '/u/finance', icon: 'currency-dollar', label: '财务' },
  { path: '/u/auth', icon: 'shield-check', label: '认证' },
  { path: '/u/messages', icon: 'message', label: '消息' },
  { path: '/u/profile', icon: 'user', label: '资料' },
];

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/');
}
function onLogout() {
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.u-shell { display: flex; height: 100vh; width: 100%; background: var(--bg-primary); }
.u-nav {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border-right: 1px solid var(--border-medium);
}
.u-nav__brand {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--color-blue);
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}
.u-nav__list { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.u-nav__item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--font-tertiary);
  transition: background var(--duration-fast) ease;
}
.u-nav__item:hover { background: var(--bg-transparent-light); color: var(--font-secondary); }
.u-nav__item.is-active { background: var(--bg-transparent-light); color: var(--font-primary); }
.u-nav__footer { margin-top: auto; }
.u-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.u-header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-medium);
}
.view-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-medium);
  color: var(--font-tertiary);
  font-size: var(--font-size-sm);
}
.u-body { flex: 1; overflow: auto; padding: 24px; }
</style>
