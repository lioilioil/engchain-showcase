import { createRouter, createWebHistory } from 'vue-router';

const AdminShell = () => import('@/layouts/AdminShell.vue');
const UserShell = () => import('@/layouts/UserShell.vue');
const Login = () => import('@/views/Login.vue');
const AdminDashboard = () => import('@/views/admin/Dashboard.vue');
const UserDashboard = () => import('@/views/user/Dashboard.vue');
const UserPublish = () => import('@/views/user/Publish.vue');
const UserOrders = () => import('@/views/user/Orders.vue');
const UserMessages = () => import('@/views/user/Messages.vue');
const UserAuth = () => import('@/views/user/Auth.vue');
const UserFinance = () => import('@/views/user/Finance.vue');

// operations
const Supply = () => import('@/views/admin/operations/Supply.vue');
const Orders = () => import('@/views/admin/operations/Orders.vue');
const Messages = () => import('@/views/admin/operations/Messages.vue');
// finance
const Wallet = () => import('@/views/admin/finance/Wallet.vue');
const Withdraw = () => import('@/views/admin/finance/Withdraw.vue');
const Recharge = () => import('@/views/admin/finance/Recharge.vue');
const Credits = () => import('@/views/admin/finance/Credits.vue');
const Invoice = () => import('@/views/admin/finance/Invoice.vue');
const Commission = () => import('@/views/admin/finance/Commission.vue');
const Revenue = () => import('@/views/admin/finance/Revenue.vue');
// distribution
const DistOverview = () => import('@/views/admin/distribution/Overview.vue');
const DistPayout = () => import('@/views/admin/distribution/Payout.vue');
const DistTeam = () => import('@/views/admin/distribution/Team.vue');
// mediation
const MedEscrow = () => import('@/views/admin/mediation/Escrow.vue');
const MedOrders = () => import('@/views/admin/mediation/Orders.vue');
const MedSellers = () => import('@/views/admin/mediation/Sellers.vue');
// risk
const RiskAudit = () => import('@/views/admin/risk/Audit.vue');
const RiskCompliance = () => import('@/views/admin/risk/Compliance.vue');
const RiskLogs = () => import('@/views/admin/risk/Logs.vue');
const RiskMonitor = () => import('@/views/admin/risk/Monitor.vue');
// system
const SysPhase = () => import('@/views/admin/system/Phase.vue');
const SysPricing = () => import('@/views/admin/system/Pricing.vue');
const SysRoles = () => import('@/views/admin/system/Roles.vue');
const CrmCompanies = () => import('@/views/admin/crm/Companies.vue');
const CrmPeople = () => import('@/views/admin/crm/People.vue');

const router = createRouter({
  history: createWebHistory('/admin-v2/'),
  routes: [
    { path: '/login', name: 'login', component: Login },
    {
      path: '/admin',
      component: AdminShell,
      children: [
        { path: '', redirect: '/admin/dashboard' },
        { path: 'dashboard', name: 'admin-dashboard', component: AdminDashboard, meta: { title: '数据总览' } },
        // operations
        { path: 'operations/supply', name: 'admin-supply', component: Supply, meta: { title: '供需管理' } },
        { path: 'operations/orders', name: 'admin-orders', component: Orders, meta: { title: '订单管理' } },
        { path: 'operations/messages', name: 'admin-messages', component: Messages, meta: { title: '消息中心' } },
        // finance
        { path: 'finance/wallet', name: 'admin-wallet', component: Wallet, meta: { title: '钱包总览' } },
        { path: 'finance/withdraw', name: 'admin-withdraw', component: Withdraw, meta: { title: '提现审核' } },
        { path: 'finance/recharge', name: 'admin-recharge', component: Recharge, meta: { title: '充值管理' } },
        { path: 'finance/credits', name: 'admin-credits', component: Credits, meta: { title: '积分管理' } },
        { path: 'finance/invoice', name: 'admin-invoice', component: Invoice, meta: { title: '发票管理' } },
        { path: 'finance/commission', name: 'admin-commission', component: Commission, meta: { title: '佣金管理' } },
        { path: 'finance/revenue', name: 'admin-revenue', component: Revenue, meta: { title: '营收分析' } },
        // distribution
        { path: 'distribution/overview', name: 'admin-dist-overview', component: DistOverview, meta: { title: '分销总览' } },
        { path: 'distribution/payout', name: 'admin-dist-payout', component: DistPayout, meta: { title: '分销结算' } },
        { path: 'distribution/team', name: 'admin-dist-team', component: DistTeam, meta: { title: '团队管理' } },
        // mediation
        { path: 'mediation/escrow', name: 'admin-med-escrow', component: MedEscrow, meta: { title: '托管管理' } },
        { path: 'mediation/orders', name: 'admin-med-orders', component: MedOrders, meta: { title: '中介订单' } },
        { path: 'mediation/sellers', name: 'admin-med-sellers', component: MedSellers, meta: { title: '服务商' } },
        // risk
        { path: 'risk/audit', name: 'admin-risk-audit', component: RiskAudit, meta: { title: '合规审核' } },
        { path: 'risk/compliance', name: 'admin-risk-compliance', component: RiskCompliance, meta: { title: '合规台账' } },
        { path: 'risk/logs', name: 'admin-risk-logs', component: RiskLogs, meta: { title: '操作日志' } },
        { path: 'risk/monitor', name: 'admin-risk-monitor', component: RiskMonitor, meta: { title: '风控监控' } },
        // system
        { path: 'system/phase', name: 'admin-sys-phase', component: SysPhase, meta: { title: '阶段开关' } },
        { path: 'system/pricing', name: 'admin-sys-pricing', component: SysPricing, meta: { title: '价格配置' } },
        { path: 'system/roles', name: 'admin-sys-roles', component: SysRoles, meta: { title: '角色权限' } },
        // CRM
        { path: 'crm/companies', name: 'admin-crm-companies', component: CrmCompanies, meta: { title: '公司' } },
        { path: 'crm/people', name: 'admin-crm-people', component: CrmPeople, meta: { title: '联系人' } },
      ],
    },
    {
      path: '/u',
      component: UserShell,
      children: [
        { path: '', redirect: '/u/dashboard' },
        { path: 'dashboard', name: 'user-dashboard', component: UserDashboard, meta: { title: '工作台' } },
        { path: 'publish', name: 'user-publish', component: UserPublish, meta: { title: '发布' } },
        { path: 'orders', name: 'user-orders', component: UserOrders, meta: { title: '我的订单' } },
        { path: 'messages', name: 'user-messages', component: UserMessages, meta: { title: '消息' } },
        { path: 'auth', name: 'user-auth', component: UserAuth, meta: { title: '我的认证' } },
        { path: 'finance', name: 'user-finance', component: UserFinance, meta: { title: '我的财务' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/admin/dashboard' },
  ],
});

router.beforeEach((to) => {
  const isLogin = to.name === 'login';
  const raw = localStorage.getItem('engchain-console-user');
  if (!isLogin && !raw) return { name: 'login' };
  if (isLogin && raw) return { name: 'admin-dashboard' };
  // 角色区分：/admin/* 需要 admin 角色，/u/* 允许任意登录用户
  if (to.path.startsWith('/admin')) {
    try {
      const u = JSON.parse(raw || '{}');
      if (u.role && u.role !== 'admin') return { name: 'user-dashboard' };
    } catch { /* ignore */ }
  }
});

export default router;
