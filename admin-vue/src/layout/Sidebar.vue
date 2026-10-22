<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="logo">
      <div class="logo-icon">E</div>
      <span v-if="!collapsed" class="logo-text">Engchain</span>
    </div>
    
    <el-scrollbar class="menu-scroll">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        unique-opened
        background-color="transparent"
        text-color="var(--color-text-regular)"
        active-text-color="var(--color-primary)"
      >
        <template v-for="g in visibleMenu" :key="g.group">
          <!-- 分组标题（折叠时隐藏） -->
          <div v-if="!collapsed" class="menu-group-title">{{ g.group }}</div>
          
          <el-sub-menu v-if="g.items.length > 1" :index="g.group">
            <template #title>
              <el-icon><Folder /></el-icon>
              <span>{{ g.group }}</span>
            </template>
            <el-menu-item
              v-for="item in g.items"
              :key="item.path"
              :index="item.path"
            >
              <span class="menu-item-indicator"></span>
              {{ item.title }}
            </el-menu-item>
          </el-sub-menu>
          
          <el-menu-item
            v-else
            :index="g.items[0].path"
          >
            <el-icon><Menu /></el-icon>
            <template #title>{{ g.group }} · {{ g.items[0].title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
    
    <div class="collapse-btn" @click="toggleSidebar">
      <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon>
      <span v-if="!collapsed" class="collapse-text">收起菜单</span>
    </div>
  </aside>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { Folder, Menu, Expand, Fold } from '@element-plus/icons-vue'
import { MENU_GROUPS } from '@/router/index.js'
import { useUserStore } from '@/store/user.js'
import { usePermissionStore } from '@/store/permission.js'

const route = useRoute()
const userStore = useUserStore()
const collapsed = inject('sidebarCollapsed')
const toggleSidebar = inject('toggleSidebar')

const activeMenu = computed(() => route.path)
const permStore = usePermissionStore()

const visibleMenu = computed(() => {
  const groups = userStore.visibleGroups
  return MENU_GROUPS
    .filter(g => groups.includes(g.group))
    .map(g => ({
      group: g.group,
      items: g.items.filter(item => {
        if (!permStore.canAccessPath(item.path)) return false
        if (!item.roles) return true
        return item.roles.includes(userStore.role)
      })
    }))
    .filter(g => g.items.length > 0)
})
</script>

<style lang="scss" scoped>
.sidebar {
  width: 240px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  transition: width $duration-base $ease-out;
  overflow: hidden;
  flex-shrink: 0;
  z-index: $z-sidebar;
}

.sidebar.collapsed {
  width: 72px;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: 0 $spacing-lg;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: $radius-md;
  background: linear-gradient(135deg, var(--color-primary-800, #1f2a44), var(--color-primary-700));
  color: #fff;
  font-size: 20px;
  font-weight: $font-weight-bold;
  flex-shrink: 0;
  box-shadow: $shadow-primary-sm;
}

.logo-text {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  white-space: nowrap;
  letter-spacing: -0.02em;
}

.menu-scroll {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-sm 0;
}

.menu-group-title {
  padding: $spacing-md $spacing-lg $spacing-xs;
  font-size: $font-size-2xs;
  font-weight: $font-weight-semibold;
  color: var(--color-text-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.collapse-btn {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  border-top: 1px solid var(--color-border-light);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all $duration-fast;
  
  &:hover {
    color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.collapse-text {
  font-size: $font-size-sm;
}

:deep(.el-menu) {
  border-right: none;
  background: transparent;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 42px;
  line-height: 42px;
  margin: 2px $spacing-sm;
  border-radius: $radius-md;
  transition: all $duration-fast $ease-out;
  position: relative;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background: var(--color-bg-hover) !important;
  color: var(--color-text-primary) !important;
}

:deep(.el-menu-item.is-active) {
  background: var(--color-accent-soft) !important;
  color: var(--color-primary-800, #1f2a44) !important;
  font-weight: $font-weight-medium;
}

.menu-item-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--color-accent);
  border-radius: 0 $radius-full $radius-full 0;
}

:deep(.el-sub-menu .el-menu-item) {
  min-width: auto !important;
  padding-left: 48px !important;
}
</style>
