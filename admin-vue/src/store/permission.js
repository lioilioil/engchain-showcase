import { defineStore } from 'pinia'

// 角色 → 权限码清单（'*' 表示全部）
export const ROLE_PERMISSIONS = {
  super: ['*'],
  ops:    ['dashboard:view', 'todo:view', 'user:view', 'user:edit', 'user:export', 'ops:view'],
  finance:['dashboard:view', 'todo:view', 'finance:view', 'finance:withdraw', 'finance:export'],
  risk:   ['dashboard:view', 'todo:view', 'risk:view', 'risk:audit'],
  viewer: ['dashboard:view', 'todo:view', 'user:view']
}

// 菜单路径 → 所需权限码（无映射则仅按分组角色控制，超管全通）
export const PATH_PERMISSION = {
  '/users/users': 'user:view',
  '/users/auth-review': 'user:view',
  '/finance/withdraw': 'finance:withdraw',
  '/finance/wallet': 'finance:view',
  '/risk/audit': 'risk:audit'
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    codes: []
  }),
  getters: {
    hasAll: (state) => state.codes.includes('*')
  },
  actions: {
    setRole(role) {
      this.codes = ROLE_PERMISSIONS[role] || []
    },
    has(code) {
      if (!code) return true
      if (this.codes.includes('*')) return true
      return this.codes.includes(code)
    },
    // 路由/菜单是否可见：该 path 需要的权限码当前角色是否持有
    canAccessPath(path) {
      if (this.codes.includes('*')) return true
      const need = PATH_PERMISSION[path]
      if (!need) return true
      return this.codes.includes(need)
    }
  }
})
