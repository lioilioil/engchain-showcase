import { defineStore } from 'pinia'

/**
 * 应用全局状态
 * 包含：侧边栏折叠、主题模式、面包屑等
 * 状态持久化到 localStorage
 */
export const useAppStore = defineStore('app', {
  state: () => ({
    // 侧边栏折叠状态
    sidebarCollapsed: localStorage.getItem('engchain-sidenav') === 'collapsed',
    // 主题模式：light / dark
    theme: localStorage.getItem('engchain-theme') || 'light',
    // 面包屑
    breadcrumbs: []
  }),

  getters: {
    isDark: (state) => state.theme === 'dark',
    sidebarWidth: (state) => state.sidebarCollapsed ? '64px' : '220px'
  },

  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      localStorage.setItem('engchain-sidenav', this.sidebarCollapsed ? 'collapsed' : 'expanded')
    },
    setTheme(theme) {
      this.theme = theme
      localStorage.setItem('engchain-theme', theme)
      // 切换 html 类名
      document.documentElement.classList.toggle('dark', theme === 'dark')
    },
    toggleTheme() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    setBreadcrumbs(list) {
      this.breadcrumbs = list
    }
  }
})
