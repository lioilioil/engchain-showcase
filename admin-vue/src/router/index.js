import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '@/layout/index.vue'
import { useUserStore } from '@/store/user.js'
import { usePermissionStore } from '@/store/permission.js'

// 占位页组件
const PlaceholderView = () => import('@/views/PlaceholderView.vue')

// ============ 已迁移页面映射（第1批核心验证页 + 第2批业务核心页）============
const PAGE_COMPONENTS = {
  '/dashboard': () => import('@/views/dashboard/index.vue'),
  '/todo': () => import('@/views/todo/index.vue'),
  '/users/users': () => import('@/views/users/List.vue'),
  '/users/auth-review': () => import('@/views/auth/Review.vue'),
  '/users/detail/:id': () => import('@/views/users/Detail.vue'),
  '/risk/logs': () => import('@/views/system/Logs.vue'),
  '/risk/reports': () => import('@/views/risk/Reports.vue'),
  '/403': () => import('@/views/error/403.vue'),
  '/mediation/requests': () => import('@/views/mediation/Requests.vue'),
  '/mediation/deals': () => import('@/views/mediation/Deals.vue'),
  '/mediation/matches': () => import('@/views/mediation/Matches.vue'),
  '/operations/orders': () => import('@/views/operations/Orders.vue'),
  '/users/owner-review': () => import('@/views/users/OwnerReview.vue'),
  '/finance/wallet': () => import('@/views/finance/Wallet.vue'),
  '/finance/withdraw': () => import('@/views/finance/Withdraw.vue'),
  '/finance/commission': () => import('@/views/finance/Commission.vue'),
  '/distribution/overview': () => import('@/views/distribution/Overview.vue'),
  '/operations/messages': () => import('@/views/operations/Messages.vue'),
  '/users/entry-review': () => import('@/views/users/EntryReview.vue'),
  '/risk/monitor': () => import('@/views/risk/Monitor.vue'),
  '/settings/phrases': () => import('@/views/settings/Phrases.vue'),
  '/finance/invoice': () => import('@/views/finance/Invoice.vue'),
  '/finance/credits': () => import('@/views/finance/Credits.vue'),
  '/esign/contracts': () => import('@/views/esign/Contracts.vue'),
  '/analytics/operations': () => import('@/views/analytics/Operations.vue'),
  '/analytics/growth': () => import('@/views/analytics/Growth.vue'),
  '/system/roles': () => import('@/views/system/Roles.vue'),
  '/system/pricing': () => import('@/views/system/Pricing.vue'),
  '/system/phase': () => import('@/views/system/Phase.vue'),
  '/membership/renewal': () => import('@/views/membership/Renewal.vue'),
  '/marketing/props': () => import('@/views/marketing/Props.vue'),
  '/users/agent': () => import('@/views/users/Agent.vue'),
  '/users/funnel': () => import('@/views/users/Funnel.vue'),
  '/finance/recharge': () => import('@/views/finance/Recharge.vue'),
  '/distribution/team': () => import('@/views/distribution/Team.vue'),
  '/distribution/payout': () => import('@/views/distribution/Payout.vue'),
  '/esign/orders': () => import('@/views/esign/Orders.vue'),
  '/esign/refunds': () => import('@/views/esign/Refunds.vue'),
  '/risk/audit': () => import('@/views/risk/Audit.vue'),
  '/risk/compliance': () => import('@/views/risk/Compliance.vue'),
  '/risk/credit-score': () => import('@/views/risk/CreditScore.vue'),
  '/operations/supply': () => import('@/views/operations/Supply.vue'),
  '/finance/points-dashboard': () => import('@/views/finance/PointsDashboard.vue'),
  '/finance/revenue': () => import('@/views/finance/Revenue.vue'),
  '/companies/detail/:id': () => import('@/views/companies/Detail.vue'),
  '/mediation/escrow': () => import('@/views/mediation/Escrow.vue'),
  '/mediation/orders': () => import('@/views/mediation/Orders.vue'),
  '/mediation/sellers': () => import('@/views/mediation/Sellers.vue')
}

// ============ 菜单数据（12 组 / 41 项）============
// group: 分组名; title: 菜单标题; path: 路由; roles: 可选，限定可见角色
export const MENU_GROUPS = [
  {
    group: '总览',
    items: [
      { title: '待办中心', path: '/todo' },
      { title: '数据总览', path: '/dashboard' }
    ]
  },
  {
    group: '运营中心',
    items: [
      { title: '供需管理', path: '/operations/supply' },
      { title: '订单管理', path: '/operations/orders' },
      { title: '消息中心', path: '/operations/messages' }
    ]
  },
  {
    group: '营销中心',
    items: [
      { title: '增值道具', path: '/marketing/props' }
    ]
  },
  {
    group: '撮合中心',
    items: [
      { title: '供需信息池', path: '/mediation/requests' },
      { title: '撮合匹配', path: '/mediation/matches' },
      { title: '成交记录', path: '/mediation/deals' }
    ]
  },
  {
    group: '用户与认证',
    items: [
      { title: '用户管理', path: '/users/users' },
      { title: '认证审核', path: '/users/auth-review' },
      { title: '入驻审核', path: '/users/entry-review' },
      { title: '企业主验证审核', path: '/users/owner-review' },
      { title: '委托代理', path: '/users/agent' },
      { title: '转化漏斗', path: '/users/funnel' }
    ]
  },
  {
    group: '会员中心',
    items: [
      { title: '年度续费管理', path: '/membership/renewal' }
    ]
  },
  {
    group: '资金中心',
    items: [
      { title: '钱包总览', path: '/finance/wallet' },
      { title: '充值/对公审批', path: '/finance/recharge' },
      { title: '提现审批', path: '/finance/withdraw' },
      { title: '积分管理', path: '/finance/credits' },
      { title: '积分运营看板', path: '/finance/points-dashboard' },
      { title: '佣金结算', path: '/finance/commission' },
      { title: '发票管理', path: '/finance/invoice' }
    ]
  },
  {
    group: '分销中心',
    items: [
      { title: '分销总览', path: '/distribution/overview' },
      { title: '团队关系树', path: '/distribution/team' },
      { title: '返佣批次发放', path: '/distribution/payout' }
    ]
  },
  {
    group: '电子签',
    items: [
      { title: '电子合同', path: '/esign/contracts', roles: ['super', 'ops', 'risk'] },
      { title: '签署订单', path: '/esign/orders',    roles: ['super', 'finance'] },
      { title: '退款审核', path: '/esign/refunds',   roles: ['super', 'finance'] }
    ]
  },
  {
    group: '风控合规',
    items: [
      { title: '合规审计', path: '/risk/audit' },
      { title: '合规管理', path: '/risk/compliance' },
      { title: '企业监控', path: '/risk/monitor' },
      { title: '诚信分管理', path: '/risk/credit-score' },
      { title: '举报处理', path: '/risk/reports' },
      { title: '操作日志', path: '/risk/logs' }
    ]
  },
  {
    group: '数据分析',
    items: [
      { title: '运营周报', path: '/analytics/operations' },
      { title: '增长分析', path: '/analytics/growth' }
    ]
  },
  {
    group: '系统设置',
    items: [
      { title: '定价配置', path: '/system/pricing' },
      { title: '运营周期', path: '/system/phase' },
      { title: '角色权限', path: '/system/roles' },
      { title: '快捷短语', path: '/settings/phrases' }
    ]
  }
]

// ============ 由菜单数据生成路由 ============
function resolveComponent(path) {
  return PAGE_COMPONENTS[path] || PlaceholderView
}

const menuChildren = []
MENU_GROUPS.forEach(g => {
  g.items.forEach(item => {
    menuChildren.push({
      path: item.path,
      component: resolveComponent(item.path),
      meta: {
        title: item.title,
        group: g.group,
        roles: item.roles || null  // null = 跟随分组权限
      }
    })
  })
})

// ============ 额外页面（不进菜单）============
const extraChildren = [
  { path: '/finance/revenue',        component: resolveComponent('/finance/revenue'), meta: { title: '收入看板', group: '资金中心' } },
  { path: '/users/detail/:id',       component: resolveComponent('/users/detail/:id'), meta: { title: '用户详情', group: '用户与认证' } },
  { path: '/companies/detail/:id',   component: resolveComponent('/companies/detail/:id'), meta: { title: '企业详情', group: '用户与认证' } },
  { path: '/mediation/escrow',       component: resolveComponent('/mediation/escrow'), meta: { title: '资金托管', group: '撮合中心' } },
  { path: '/mediation/orders',       component: resolveComponent('/mediation/orders'), meta: { title: '撮合订单', group: '撮合中心' } },
  { path: '/mediation/sellers',      component: resolveComponent('/mediation/sellers'), meta: { title: '供方库',   group: '撮合中心' } },
  { path: '/403', component: resolveComponent('/403'), meta: { title: '无权访问', group: '' } },
  { path: '/500', component: () => import('@/views/error/500.vue'), meta: { title: '服务异常', group: '' } },
  { path: '/404', component: PlaceholderView, meta: { title: '页面不存在', group: '' } }
]

const routes = [
  {
    path: '/login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [...menuChildren, ...extraChildren]
  },
  {
    path: '/design-system',
    component: () => import('@/views/DesignSystem.vue'),
    meta: { title: '设计系统' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/404' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// ============ 路由守卫：登录态 + 角色权限 ============
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const permStore = usePermissionStore()
  permStore.setRole(userStore.role)

  // 公开页（登录页）直接放行
  if (to.meta.public || to.path === '/login') {
    // 已登录访问登录页 → 直接回 dashboard
    if (to.path === '/login' && userStore.isLogin) {
      next('/dashboard')
      return
    }
    next()
    return
  }

  // 未登录 → 强制跳登录（带 redirect）
  if (!userStore.isLogin) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // 独立页 design-system / 403 / 404 不做分组权限拦截
  if (to.path === '/design-system' || to.path === '/403' || to.path === '/404' || to.path === '/500') {
    next()
    return
  }

  const role = userStore.role

  // super 全通
  if (role === 'super') {
    next()
    return
  }

  // 分组级权限
  const group = to.meta.group
  if (group && !userStore.visibleGroups.includes(group)) {
    next('/403')
    return
  }

  // 单页级权限（如电子签子项）
  if (to.meta.roles && !to.meta.roles.includes(role)) {
    next('/403')
    return
  }

  next()
})

export default router
