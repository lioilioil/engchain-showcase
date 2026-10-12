<template>
  <div class="tabs-bar">
    <div class="tabs-scroll">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ active: tab.path === route.path }"
        @click="goTo(tab.path)"
        @contextmenu.prevent="openMenu(tab, $event)"
      >
        <span class="tab-title">{{ tab.title }}</span>
        <el-icon
          v-if="tab.path !== '/dashboard'"
          class="tab-close"
          @click.stop="closeTab(tab.path)"
        >
          <Close />
        </el-icon>
      </div>
    </div>

    <!-- 右键菜单 -->
    <ul
      v-show="menu.visible"
      class="tab-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
    >
      <li @click="refreshTab">刷新</li>
      <li @click="closeCurrent(menu.tab)">关闭当前</li>
      <li @click="closeOthers(menu.tab)">关闭其他</li>
      <li @click="closeLeft(menu.tab)">关闭左侧</li>
      <li @click="closeRight(menu.tab)">关闭右侧</li>
      <li @click="closeAll">关闭所有</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Close } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const STORAGE_KEY = 'engchain_tabs'
const DEFAULT_TAB = { path: '/dashboard', title: '数据总览' }

// 从 localStorage 恢复已打开标签
let initial = [DEFAULT_TAB]
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  if (Array.isArray(saved) && saved.length) initial = saved
} catch (e) {}
const tabs = ref(initial)

// 持久化
watch(tabs, (val) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
}, { deep: true })

const menu = ref({
  visible: false,
  x: 0,
  y: 0,
  tab: null
})

// 监听路由变化，自动添加 tab
watch(() => route.path, (newPath) => {
  if (!newPath) return
  const exists = tabs.value.find(t => t.path === newPath)
  if (!exists && route.meta.title) {
    tabs.value.push({
      path: newPath,
      title: route.meta.title
    })
  }
}, { immediate: true })

function goTo(path) {
  router.push(path)
}

function closeTab(path) {
  const index = tabs.value.findIndex(t => t.path === path)
  if (index === -1) return

  tabs.value.splice(index, 1)

  // 如果关闭的是当前页，跳转到最后一个 tab
  if (path === route.path) {
    const nextTab = tabs.value[index] || tabs.value[index - 1] || tabs.value[0]
    if (nextTab) {
      router.push(nextTab.path)
    }
  }
}

function openMenu(tab, event) {
  menu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    tab
  }

  // 点击其他地方关闭菜单
  const closeMenu = () => {
    menu.value.visible = false
    document.removeEventListener('click', closeMenu)
  }
  nextTick(() => {
    document.addEventListener('click', closeMenu)
  })
}

function closeCurrent(tab) {
  closeTab(tab.path)
  menu.value.visible = false
}

function closeOthers(tab) {
  tabs.value = tabs.value.filter(t => t.path === tab.path || t.path === '/dashboard')
  if (tab.path !== route.path) {
    router.push(tab.path)
  }
  menu.value.visible = false
}

function closeAll() {
  tabs.value = [DEFAULT_TAB]
  router.push('/dashboard')
  menu.value.visible = false
}

function refreshTab() {
  window.location.reload()
}

function closeLeft(tab) {
  const idx = tabs.value.findIndex(t => t.path === tab.path)
  tabs.value = tabs.value.filter((t, i) => i >= idx || t.path === '/dashboard')
  menu.value.visible = false
}

function closeRight(tab) {
  const idx = tabs.value.findIndex(t => t.path === tab.path)
  tabs.value = tabs.value.filter((t, i) => i <= idx || t.path === '/dashboard')
  if (route.path !== tab.path) router.push(tab.path)
  menu.value.visible = false
}
</script>

<style lang="scss" scoped>
.tabs-bar {
  height: 40px;
  background: var(--color-bg-container);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  padding: 0 $spacing-md;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.tabs-scroll {
  display: flex;
  gap: $spacing-xs;
  overflow-x: auto;
  flex: 1;

  &::-webkit-scrollbar {
    height: 0;
  }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 6px 12px;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all $duration-fast;
  border: 1px solid transparent;

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  &.active {
    background: var(--color-primary-50);
    color: var(--color-primary);
    border-color: var(--color-primary-200);
    font-weight: $font-weight-medium;
  }
}

.tab-close {
  font-size: 12px;
  border-radius: $radius-sm;
  padding: 1px;

  &:hover {
    background: var(--color-primary);
    color: #fff;
  }
}

.tab-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: $radius-md;
  box-shadow: var(--shadow-lg);
  padding: $spacing-xs 0;
  min-width: 120px;
  list-style: none;
  margin: 0;

  li {
    padding: 8px 16px;
    font-size: $font-size-sm;
    cursor: pointer;
    color: var(--color-text-regular);

    &:hover {
      background: var(--color-bg-hover);
      color: var(--color-primary);
    }
  }
}
</style>
