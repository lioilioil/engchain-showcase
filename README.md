# Engchain3.0 · 工程链 B2B 平台 Demo

> 建筑行业供需匹配平台 · 纯前端静态 Demo（HTML + JS Mock 数据层）

---

## 快速开始

```bash
# 起本地服务（带缓存）
python serve_cached.py 8767

# 或起无缓存版（改代码后实时生效）
python serve_nocache.py 8766
```

打开浏览器访问：
- **前端 App**：`http://127.0.0.1:8767/home.html`
- **管理后台**：`http://127.0.0.1:8767/admin/index.html`

---

## 演示账号

| 账号 | 角色 | 用途 |
|---|---|---|
| u1 / 13800000001 | 建筑企业（已入驻） | 主演示账号，有订单/钱包/分销数据 |
| u2 / 13800000002 | 中介服务商 | 演示中介撮合流程 |
| u3 / 13800000003 | 建筑企业（待入驻） | 演示入驻审核流程 |
| u5 / 13800000005 | 需求方 | 演示需求匹配 |

后台管理员：右上角用户菜单 → 切换身份 → 选对应角色

---

## 目录结构

```
Engchain3.0/
├── home.html              # 前端 App 首页
├── preview.html           # 原型总览入口
├── serve_cached.py        # 本地服务（带缓存）
├── serve_nocache.py       # 本地服务（无缓存）
│
├── admin/                 # 管理后台（32 页）
│   ├── index.html         # 数据总览
│   ├── css/admin.css      # GitHub 风格设计系统
│   ├── js/admin.js        # 导航/权限/组件库（Table/Paginator/Drawer/Cmdk）
│   ├── users/             # 用户与认证（4 页）
│   ├── operations/        # 运营中心（3 页）
│   ├── finance/           # 资金中心（7 页）
│   ├── distribution/      # 分销中心（3 页）
│   ├── esign/             # 电子签（3 页）
│   ├── risk/              # 风控合规（4 页）
│   ├── system/            # 系统设置（3 页）
│   └── mediation/         # 中介托管（已下线，保留空态）
│
├── pages/                 # 前端 App（149 页）
│   ├── auth/              # 登录/注册
│   ├── profile/           # 个人中心/认证/入驻
│   ├── supply/            # 供需发布/详情
│   ├── order/             # 订单列表/详情
│   ├── wallet/            # 钱包/充值/提现/积分
│   ├── distribution/      # 分销中心
│   ├── esign/             # 电子签
│   └── ...
│
└── js/                    # 数据层（核心）
    ├── data.js            # MOCK 种子数据（用户/企业/供需/定价）
    ├── stores.js          # Store 层（BalanceStore/AuthStore/EntryStore/RevenueStore...）
    ├── databus.js         # DataBus 总线（用户表/订单/审批状态机/storage 事件联动）
    ├── domain.js          # 业务域（Rebate 返佣引擎/Mediation 托管）
    ├── delegates.js       # 委托服务（L1/L2/L3 流程 + ¥29.9 收银台）
    ├── detail.js          # 供需/建企买卖详情/解锁/保证金
    └── common.js          # 通用工具（UI/格式化/事件）
```

---

## 数据层架构

```
data.js（种子数据）
    ↓
stores.js（Store 层：业务规则）
    ↓
databus.js（DataBus 总线：跨页通信 + storage 事件）
    ↓
domain.js / delegates.js / detail.js（业务域逻辑）
    ↓
各页面（渲染 + 交互）
```

### 核心 Store

| Store | 职责 | 存储 Key |
|---|---|---|
| BalanceStore | 钱包余额/冻结/流水 | engchain-balance |
| AuthStore | 实名认证状态 | engchain-auth |
| EntryStore | 入驻申请状态 | engchain-entry |
| CreditStore | 积分余额/流水 | engchain-credits |
| RevenueStore | 平台收入统计 | engchain-revenue |
| Rebate | 分销返佣引擎 | engchain-rebate-orders |

### DataBus 核心方法

```js
DataBus.users()           // 全部用户
DataBus.current()         // 当前登录用户
DataBus.orders()          // 全部订单
DataBus.supply()          // 全部供需单
DataBus.withdrawals()     // 全部提现申请
DataBus.messages()        // 全部平台消息
DataBus.stats()           // 平台统计（用户数/入驻数/佣金总额）
DataBus.orderCalc(amt)    // 订单费用计算（费率/服务费）
```

---

## Phase 0 口径（重要）

本 Demo 处于 **Phase 0 · 纯信息撮合** 阶段：

- ✅ 平台只做信息匹配，**不碰交易资金**
- ✅ **不抽佣**（commission._phase0.tradingEnabled = false）
- ✅ **银行托管已下线**（mediation 模块已清理）
- ✅ 收入来源：入驻费 + 信息解锁（¥29.9）+ 增值服务

---

## 已知限制

1. **后台审批 App 联动**：后台点"通过"后，App 标签页需整页刷新才翻状态（storage 事件读旧快照）
2. **G004/G006/G007/G008 积分商城 SKU**：只扣积分不发权益（发票额度/专属客服/资料包/认证加急）
3. **后台分销结算/发放**：按钮操作 DataBus 列表，与 Rebate.settleOne/pay 未完全同步
4. **浏览器缓存**：改代码后需硬刷新（Ctrl+Shift+R）或用 serve_nocache.py

---

## 技术栈

- 纯 HTML/CSS/JS（无框架、无构建）
- localStorage 持久化
- storage 事件跨标签页联动
- GitHub 风格设计系统（CSS Variables）
- 响应式布局（侧边栏 + 主内容区）

---

*最后更新：2026-10-08*
