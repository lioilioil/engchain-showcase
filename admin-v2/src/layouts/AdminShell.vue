<template>
  <div class="shell">
    <aside class="nav-drawer" :class="{ collapsed: isCollapsed }">
      <div class="nav-drawer-inner">
        <div class="nav-header">
          <span class="nav-header__logo">E</span>
          <span class="nav-header__name" v-if="!isCollapsed">Engchain</span>
          <button class="icon-btn icon-btn--sm nav-header__collapse" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? '展开' : '收起'">
            <AppIcon name="sidebar-collapse" :size="14" />
          </button>
        </div>

        <nav class="nav-items-container" v-if="!isCollapsed">
          <div v-for="sec in sections" :key="sec.title" class="nav-section">
            <div class="nav-section__title" v-if="sec.title">{{ sec.title }}</div>
            <router-link
              v-for="item in sec.items"
              :key="item.path"
              :to="item.path"
              class="nav-item"
              :class="{ 'is-active': isActive(item.path) }"
            >
              <AppIcon :name="item.icon" :size="16" />
              <span class="nav-item__label">{{ item.label }}</span>
            </router-link>
          </div>
        </nav>

        <div class="nav-footer" v-if="!isCollapsed">
          <span class="avatar avatar--blue nav-footer__avatar">{{ (user?.name || 'U').slice(0, 1).toUpperCase() }}</span>
          <span class="nav-footer__name">{{ user?.name || '未登录' }}</span>
          <button class="icon-btn icon-btn--sm" @click="onLogout" title="退出">
            <AppIcon name="logout" :size="14" />
          </button>
        </div>
      </div>
    </aside>

    <div class="main-container">
      <div class="page">
        <header class="page-header">
          <div class="page-header__left">
            <button class="view-switcher" @click="$emit('open-command')">
              <AppIcon name="search" :size="14" />
              <span class="view-switcher__name">搜索或跳转…</span>
              <span class="hotkey">⌘K</span>
            </button>
          </div>
          <div class="page-header__actions">
            <button class="icon-btn" @click="cycleTheme" :title="isDark ? '切浅色' : '切深色'">
              <AppIcon :name="isDark ? 'moon' : 'sun'" :size="16" />
            </button>
          </div>
        </header>

        <div class="page-body">
          <main class="page-panel">
            <div class="page-panel__scroll">
              <router-view />
            </div>
          </main>
        </div>
      </div>
    </div>

    <CommandPalette v-model:visible="showCommand" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useThemeStore } from '@/stores/theme';
import AppIcon from '@/components/AppIcon.vue';
import CommandPalette from './components/CommandPalette.vue';

defineEmits(['open-command']);

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const theme = useThemeStore();
const user = computed(() => userStore.user);
const isCollapsed = ref(false);
const showCommand = ref(false);
const isDark = computed(() => document.documentElement.getAttribute('data-theme') === 'dark');

const sections = [
  { title: '总览', items: [{ label: '数据总览', path: '/admin/dashboard', icon: 'layout-grid' }] },
  {
    title: '运营中心',
    items: [
      { label: '供需管理', path: '/admin/operations/supply', icon: 'list' },
      { label: '订单管理', path: '/admin/operations/orders', icon: 'file' },
      { label: '消息中心', path: '/admin/operations/messages', icon: 'message' },
    ],
  },
  {
    title: '客户关系',
    items: [
      { label: '公司', path: '/admin/crm/companies', icon: 'building' },
      { label: '联系人', path: '/admin/crm/people', icon: 'user' },
    ],
  },
  {
    title: '资金中心',
    items: [
      { label: '钱包总览', path: '/admin/finance/wallet', icon: 'currency-dollar' },
      { label: '充值管理', path: '/admin/finance/recharge', icon: 'coins' },
      { label: '提现审核', path: '/admin/finance/withdraw', icon: 'coins' },
      { label: '发票管理', path: '/admin/finance/invoice', icon: 'file' },
      { label: '佣金管理', path: '/admin/finance/commission', icon: 'coins' },
      { label: '积分管理', path: '/admin/finance/credits', icon: 'stars' },
      { label: '营收分析', path: '/admin/finance/revenue', icon: 'chart-bar' },
    ],
  },
  {
    title: '分销中心',
    items: [
      { label: '分销总览', path: '/admin/distribution/overview', icon: 'users' },
      { label: '分销结算', path: '/admin/distribution/payout', icon: 'coins' },
      { label: '团队管理', path: '/admin/distribution/team', icon: 'user' },
    ],
  },
  {
    title: '中介中心',
    items: [
      { label: '托管管理', path: '/admin/mediation/escrow', icon: 'shield' },
      { label: '中介订单', path: '/admin/mediation/orders', icon: 'file' },
      { label: '服务商', path: '/admin/mediation/sellers', icon: 'building' },
    ],
  },
  {
    title: '风控合规',
    items: [
      { label: '合规审核', path: '/admin/risk/audit', icon: 'shield-check' },
      { label: '合规台账', path: '/admin/risk/compliance', icon: 'file' },
      { label: '风控监控', path: '/admin/risk/monitor', icon: 'shield' },
      { label: '操作日志', path: '/admin/risk/logs', icon: 'file' },
    ],
  },
  {
    title: '系统',
    items: [
      { label: '阶段开关', path: '/admin/system/phase', icon: 'toggle' },
      { label: '价格配置', path: '/admin/system/pricing', icon: 'currency-dollar' },
      { label: '角色权限', path: '/admin/system/roles', icon: 'settings' },
    ],
  },
];

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/');
}
function cycleTheme() {
  theme.toggle();
}
function onLogout() {
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  position: relative;
  background: var(--bg-primary);
}
.shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}
.nav-drawer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 10;
  flex-shrink: 0;
  width: 236px;
  overflow: hidden;
  transition: width var(--duration-normal) ease, opacity var(--duration-fast) ease;
}
.nav-drawer.collapsed { width: 12px; opacity: 0; pointer-events: none; }
.nav-drawer-inner {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 236px;
  padding: 12px 8px 16px;
}
.nav-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  padding: 4px;
  margin-bottom: 24px;
}
.nav-header__logo {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
  background: var(--color-blue);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-header__name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--font-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-header__collapse {
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}
.nav-drawer-inner:hover .nav-header__collapse { opacity: 1; }
.nav-items-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: auto;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.nav-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-section__title {
  color: var(--font-light);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 4px 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  color: var(--font-secondary);
  white-space: nowrap;
  transition: background var(--duration-fast) ease;
}
.nav-item:hover { background: var(--bg-transparent-light); }
.nav-item.is-active {
  color: var(--font-primary);
  background: var(--bg-transparent-light);
  font-weight: var(--font-weight-medium);
}
.nav-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px 0;
}
.nav-footer__avatar { width: 20px; height: 20px; font-size: 10px; }
.nav-footer__name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--font-primary);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.main-container {
  flex: 0 1 100%;
  overflow: hidden;
  min-width: 0;
  margin-left: 236px;
  position: relative;
  z-index: 1;
  transition: margin-left var(--duration-normal) ease;
}
.nav-drawer.collapsed ~ .main-container { margin-left: 12px; }
.page { display: flex; flex-direction: column; width: 100%; height: 100%; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 8px 12px 8px 8px;
  flex-shrink: 0;
}
.page-header__left { display: flex; align-items: center; gap: 4px; min-width: 0; }
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
  cursor: pointer;
  transition: background var(--duration-fast) ease;
}
.view-switcher:hover { background: var(--bg-tertiary); }
.view-switcher__name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-header__actions { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.page-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  gap: 8px;
  padding-bottom: 12px;
  padding-right: 12px;
  width: 100%;
  min-height: 0;
}
.page-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.page-panel__scroll { flex: 1 1 auto; overflow: auto; min-height: 0; }
</style>
