import { defineStore } from 'pinia'

// 角色 → 可见分组 映射
export const ROLE_GROUP_MAP = {
  super:  ['总览', '运营中心', '营销中心', '撮合中心', '用户与认证', '会员中心',
           '资金中心', '分销中心', '电子签', '风控合规', '数据分析', '系统设置'],
  ops:    ['总览', '运营中心', '营销中心', '分销中心', '电子签'],
  finance:['总览', '资金中心', '分销中心', '电子签'],
  risk:   ['总览', '风控合规', '电子签'],
  viewer: ['总览', '用户与认证']
}

export const ROLE_LABELS = {
  super: '超管',
  ops: '运营',
  finance: '财务',
  risk: '风控',
  viewer: '只读'
}

// 演示账号（Mock）
const MOCK_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'super', name: 'Admin' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', name: 'Viewer' }
]

const TOKEN_KEY = 'engchain_mock_token'
const ROLE_KEY = 'engchain_mock_role'
const NAME_KEY = 'engchain_mock_name'

function read(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: read(TOKEN_KEY),
    role: read(ROLE_KEY),
    name: read(NAME_KEY),
    groupOverride: null
  }),
  getters: {
    isLogin: (state) => !!state.token,
    visibleGroups: (state) => state.groupOverride || ROLE_GROUP_MAP[state.role] || []
  },
  actions: {
    login(username, password) {
      const acc = MOCK_ACCOUNTS.find(a => a.username === username && a.password === password)
      if (!acc) {
        return { ok: false, message: '用户名或密码错误' }
      }
      const token = 'mock-token-' + acc.role + '-' + Date.now()
      this.token = token
      this.role = acc.role
      this.name = acc.name
      try {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(ROLE_KEY, acc.role)
        localStorage.setItem(NAME_KEY, acc.name)
      } catch { /* ignore */ }
      return { ok: true }
    },
    logout() {
      this.token = ''
      this.role = ''
      this.name = ''
      try {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(ROLE_KEY)
        localStorage.removeItem(NAME_KEY)
      } catch { /* ignore */ }
    },
    setRole(role) {
      if (ROLE_GROUP_MAP[role]) {
        this.role = role
      }
    }
  }
})
