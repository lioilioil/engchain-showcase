# LEGACY_API.md — 旧数据层 API 基线（S0 盘点成果）

> 生成时间：2026-09-21
> 用途：admin-v2 新工程桥接旧 DataBus 时，所有调用必须对照本文件，禁止凭印象写方法名。

## 1. 加载顺序（index.html）

```html
<script src="/_legacy/js/data.js" defer></script>
<script src="/_legacy/js/common.js" defer></script>
<script src="/_legacy/js/stores.js" defer></script>
<script src="/_legacy/js/databus.js" defer></script>
<script src="/_legacy/admin/js/finance-credits.js" defer"></script>  <!-- AdminCredits -->
```

vite.config.ts 的 `legacyStatic()` middleware 把 `D:\Engchain3.0\` 下的文件通过 `/_legacy/` 暴露。

## 2. DataBus 真实方法清单

### 2.1 用户与认证
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.users()` | `() => User[]` | 全部用户（含游客 u7） |
| `DataBus.byId(id)` | `(id: string) => User` | 按 ID 查用户 |
| `DataBus.byMobile(m)` | `(mobile: string) => User?` | 按手机查 |
| `DataBus.current()` | `() => User` | 当前登录用户 |
| `DataBus.history()` | `() => User[]` | 历史登录 |
| `DataBus.login(id)` | `(id: string) => User` | 切换登录用户 |
| `DataBus.logout()` | `()` | 退出 |
| `DataBus.resetAll()` | `()` | 重置全部数据 |
| `DataBus.audit(action, module, target, extra)` | `()` | 写审计日志 |
| `DataBus.syncUser(u)` | `(u: User) => void` | 同步用户快照到各 Store |
| `DataBus.ensureCurrentSynced()` | `()` | 确保当前用户与各 Store 对齐 |
| `DataBus.stats()` | `() => {users, realname, enterprise, resident, ...}` | 全局统计 |
| `DataBus.statusOf(u)` | `(u: User) => string` | 派生身份：resident/enterprise/pro/realname/registered/guest/banned |
| `DataBus.tagOf(u)` | `(u: User) => string` | 派生标签文案 |
| `DataBus.entryFeeOf(type)` | `(type: string) => number` | 入驻费 |

### 2.2 供需（运营中心）
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.supply()` | `() => Supply[]` | 供需列表 |
| `DataBus.supplyAudit(id, action, note)` | `(id, action, note) => void` | 审核（on/off/rejected） |
| `DataBus.publishSupply(item)` | `(item) => void` | 发布供需 |
| `DataBus.supplyApprove(id)` / `supplyReject(id, note)` | | 审核 |
| `DataBus.supplyList(filter)` | | 筛选列表 |

### 2.3 订单
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.orders()` | `() => Order[]` | 订单列表 |
| `DataBus.orderCalc(amount)` | `(amount) => object` | 计算订单费用 |
| `DataBus.orderTransition(id, next)` | `(id, next) => void` | 状态流转 |
| `DataBus.orderAdvanceMilestone(id, idx)` | `(id, idx) => void` | 推进里程碑 |

### 2.4 消息
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.messages()` | `() => Message[]` | 消息列表 |
| `DataBus.publishMessage(msg)` | `(msg) => void` | 发系统消息 |
| `DataBus.pushDirectMessage(from, to, text)` | | 点对点消息 |

### 2.5 认证与入驻（CRM 核心）
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.authApprove(id)` / `authReject(id, reason)` | | 实名认证审核 |
| `DataBus.authApply(id, data)` / `authRenew(id)` | | 用户侧申请/续期 |
| `DataBus.entryApply(id, data)` | | 入驻申请 |
| `DataBus.entryApprove(id)` / `entryReject(id, reason)` | | 入驻审核 |
| `DataBus.entryFirstApprove(id)` / `entryFinalApprove(id)` | | 两级入驻审核 |
| `DataBus.toggleBan(id)` / `isBanned(id)` | | 封禁/解封 |
| `DataBus.entryFees()` | `() => object` | 入驻费配置 |

### 2.6 资金中心
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.withdrawals()` | `() => Withdraw[]` | 提现列表 |
| `DataBus.withdrawalFrozen(uid)` | | 冻结金额 |
| `DataBus.withdrawalApply(...)` | | 用户申请提现 |
| `DataBus.withdrawalApprove(id)` / `withdrawalReject(id, reason)` | | 提现审核 |
| `DataBus.withdrawalFirstApprove(id)` / `withdrawalFinalApprove(id)` | | 两级提现审核 |
| `DataBus.invoices()` / `invoiceList()` | | 发票列表 |
| `DataBus.invoiceUpdate(id, data)` / `invoiceApply(...)` / `invoiceApprove(id)` / `invoiceReject(id, reason)` | | 发票流程 |
| `DataBus.commissionFlows()` / `settledPending()` / `commissionSettle(id)` | | 佣金 |
| `DataBus.violations()` / `violationPunish(id, action)` | | 违规处罚 |

### 2.7 分销
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.distTeam()` / `distFlows()` / `distStat()` | | 分销团队/流水/统计 |
| `DataBus.distSettle(id)` / `distPay(id)` | | 分销结算/打款 |

### 2.8 风控
| 方法 | 签名 | 说明 |
|---|---|---|
| `DataBus.qualifications()` | | 资质列表 |
| `DataBus.loadMonitorFeed()` / `monitorStat()` | | 监控流/统计 |

### 2.9 其他
| 方法 | 说明 |
|---|---|
| `DataBus.canDeliverResume(uid)` | 简历投递门控 |
| `DataBus.invalidateCache(key?)` | 清内存缓存 |

## 3. 其他全局对象

### 3.1 stores.js 暴露的 Store
`AuthStore, EntryStore, CreditStore, CheckinStore, BalanceStore, AgencyOrderStore, InvoiceStore, CommissionStore, MonitorStore, FavoriteStore, SupplyStore, ApplyStore, LeadStore, DemandStore, SvcRatingStore, ModeStore, MemberStore, FreeQuotaStore, UpgradeStore, MatchStore, DashboardStore, ReportStore, ApiStore, RevenueStore`

### 3.2 common.js / domain.js
- `window.CorpPay`（common.js:1180）：对公支付 `list()/approve(id)/reject(id, reason)`
- `window.Mediation`（domain.js:1245）：中介 `list()/orderCalc(...)`

### 3.3 AdminCredits（admin/js/finance-credits.js）
```
AdminCredits.load()           // 积分发放记录
AdminCredits.add({uid, amount, type, reason})  // 发放/扣减
AdminCredits.userBalance(uid) // 用户积分余额
AdminCredits.userLogs(uid)    // 用户积分流水
AdminCredits.stats()          // {totalIssued, totalConsumed, currentCirculation, userCount}
AdminCredits.users            // 用户列表引用
AdminCredits.types            // 类型枚举
AdminCredits.reset()          // 重置种子数据
```

## 4. 登录态结构

```js
// 登录 = DataBus.login(userId)
// 当前用户 = DataBus.current()
// localStorage key: 'engchain-users'（用户表）, 'engchain-login-history'（历史）
// 用户对象字段:
{
  id, name, company, account, pwd, mobile, avatar, tag,
  status: 'resident'|'enterprise'|'pro'|'realname'|'registered'|'guest'|'banned',
  identity: { personal, enterprise, entryTypes: [] },
  auth: { realname, enterprise, personalQual, enterpriseQual, qual, payment },
  entry: { type, types, status, active, expireAt, ... },
  balance: { balance, frozen, totalIn },
  credits: { balance, quota },
  banned: bool
}
```

**没有显式 role 字段。** admin 端和 C 端共用同一个 DataBus.current()，通过 URL 路径（/admin/* vs /u/*）区分端。

## 5. 旧 admin 页面迁移对照

| 旧页面 | 新路由 | 状态 |
|---|---|---|
| index.html | /admin/dashboard | ✅ |
| operations/supply.html | /admin/operations/supply | ✅ |
| operations/orders.html | /admin/operations/orders | ✅ |
| operations/messages.html | /admin/operations/messages | ✅ |
| finance/wallet.html | /admin/finance/wallet | ✅ |
| finance/recharge.html | /admin/finance/recharge | ✅ |
| finance/withdraw.html | /admin/finance/withdraw | ✅ |
| finance/credits.html | /admin/finance/credits | ✅ |
| finance/invoice.html | /admin/finance/invoice | ✅ |
| finance/commission.html | /admin/finance/commission | ✅ |
| finance/revenue.html | /admin/finance/revenue | ✅ |
| distribution/overview.html | /admin/distribution/overview | ✅ |
| distribution/payout.html | /admin/distribution/payout | ✅ |
| distribution/team.html | /admin/distribution/team | ✅ |
| mediation/escrow.html | /admin/mediation/escrow | ✅ |
| mediation/orders.html | /admin/mediation/orders | ✅ |
| mediation/sellers.html | /admin/mediation/sellers | ✅ |
| risk/audit.html | /admin/risk/audit | ✅ |
| risk/compliance.html | /admin/risk/compliance | ✅ |
| risk/logs.html | /admin/risk/logs | ✅ |
| risk/monitor.html | /admin/risk/monitor | ✅ |
| system/phase.html | /admin/system/phase | ✅ |
| system/pricing.html | /admin/system/pricing | ✅ |
| system/roles.html | /admin/system/roles | ✅ |
| users/users.html | /admin/crm/companies | ✅ 吞并 |
| users/auth-review.html | /admin/crm/people | ✅ 吞并 |
| users/entry-review.html | /admin/crm/companies（Tab） | ✅ 吞并 |
| users/owner-review.html | /admin/crm/companies | ✅ 吞并 |
| design-system.html | 不迁 | — |

**迁移完整性：28/28（100%）**

## 6. 待修正的方法名错误（S1 任务）

| 错误调用 | 正确调用 | 影响文件 |
|---|---|---|
| `bus().realnameApprove(id)` | `DataBus.authApprove(id)` | People.vue |
| `AdminCredits.grant(...)` | `AdminCredits.add({uid, amount, type, reason})` | Credits.vue |
| `AdminCredits.load()` | ✅ 正确 | Credits.vue |
| `AdminCredits.stats()` | ✅ 正确 | Credits.vue |
| `SystemConfig.phases()` | 直接读 localStorage `engchain-phase-registry` | Phase.vue |
| `SystemConfig.pricing()` | 直接读 localStorage 或 DataBus.entryFees() | Pricing.vue |
| `SystemConfig.savePricing(form)` | 写 localStorage + dispatch `engchain:phase` 事件 | Pricing.vue |
