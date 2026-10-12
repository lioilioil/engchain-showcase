import { defineStore } from 'pinia'
import api from '@/api'

/**
 * 全局共享数据 Store
 * 缓存跨页面共享的数据（用户列表、企业列表等）
 * 避免每个页面都重复请求
 */
export const useDataStore = defineStore('data', {
  state: () => ({
    // 用户列表缓存
    users: [],
    usersLoaded: false,
    // 企业列表缓存（从用户中筛选出企业类型的）
    companies: [],
    companiesLoaded: false,
    // 平台统计
    platformStats: null,
    statsLoaded: false
  }),

  getters: {
    // 按 ID 快速查找用户
    userById: (state) => (id) => {
      return state.users.find(u => u.id === id) || null
    },
    // 企业用户列表
    enterpriseUsers: (state) => {
      return state.users.filter(u => u.company && u.company.trim() !== '')
    }
  },

  actions: {
    /**
     * 加载用户列表（带缓存）
     */
    async loadUsers(force = false) {
      if (this.usersLoaded && !force) return this.users
      try {
        const list = await api.user.list()
        this.users = list
        this.usersLoaded = true
        return list
      } catch (err) {
        console.error('加载用户列表失败:', err)
        return []
      }
    },

    /**
     * 加载企业列表
     */
    async loadCompanies(force = false) {
      if (this.companiesLoaded && !force) return this.companies
      const users = await this.loadUsers()
      this.companies = users.filter(u => u.company && u.company.trim() !== '')
      this.companiesLoaded = true
      return this.companies
    },

    /**
     * 加载平台统计
     */
    async loadPlatformStats(force = false) {
      if (this.statsLoaded && !force) return this.platformStats
      try {
        const stats = await api.user.stats()
        this.platformStats = stats
        this.statsLoaded = true
        return stats
      } catch (err) {
        console.error('加载平台统计失败:', err)
        return null
      }
    },

    /**
     * 刷新所有缓存
     */
    async refreshAll() {
      this.usersLoaded = false
      this.companiesLoaded = false
      this.statsLoaded = false
      await Promise.all([
        this.loadUsers(true),
        this.loadPlatformStats(true)
      ])
    }
  }
})
