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
- **管理后台（新版 Vue3）**：进入 `admin-vue/` 执行 `npm run dev`，访问终端输出地址（默认 `http://127.0.0.1:5173/`），演示账号 `admin/admin123`（超管）、`viewer/viewer123`（只读）
- 旧版静态管理后台（`admin-20261009/`）已于 2026-10-12 随非 demo 文件一并归档至 `D:\Engchain3.0-archive\engchain-cleanup-20261012\archive\admin-20261009\`，仅作历史参考

---

## 演示账号

| 账号 | 角色 | 用途 |
|---|---|---|
| u1 / 13800000001 | 建筑企业（base，已入驻） | 主演示账号，有订单/钱包/旧返佣数据（base 12%/3% 保留） |
| u2 / 13800000002 | 中介服务商（limited） | 演示中介撮合流程（limited 6% 保留） |
| u3 / 13800000003 | 建筑企业（待入驻） | 演示入驻审核流程 |
| u4 / 13900005678 | 认证个人人才（pro） | 个人专业认证（realname+personal-entry 已点亮） |
| u5 / 13800000005 | 需求方 | 演示需求匹配 |
| u6 / 13400005678 | 注册会员 | 已注册未认证（演示注册态） |
| u8 / 13300008901 | 实名普通用户（M4-4 已回退） | 旧企业合伙人已定点清零，无旧返佣资格 |
| u9 / 13200009012 | 个人合伙人（孙小美） | 8%/2%、最低提现 ¥50、T+1；返佣中心/提现正常 |
| u10 / 13000000000 | 平台内部运营 | 全量审核/治理视角 |
| u11（代理演示场景，非独立登录） | 四川省级总代（active，n/21） | 两分区台账、充值不进、frozen/settled/冲减、法定税、自身余额、O4 已签、团队 admin+member、叠加个人合伙人示例、清理日志样例；由 agent-demo 播种/重置 |
| u12（代理演示场景，非独立登录） | 成都二级（approved，约定20%） | 本人约定所得、冻结退款、冲减、法定税、已签、自身余额、团队；由 agent-demo 播种/重置 |

> 代理演示场景（u11/u12）通过页面「演示场景播种/重置」写入 `engchain-province-agents`/`engchain-sub-agents` 等代理键，硬刷新可还原；不覆盖 u9/u10 等既有种子。

### 省级总代体系 · 完整旅程导览（9 节点）

> 在 `preview.html` 左侧「完整旅程导览 · 省级总代体系」分组同步呈现；演示切换器按播种键选择场景后沿路径走查。

| # | 旅程节点 | 目标路径 | 播种键（演示切换器） | 预期落点 |
|---|---|---|---|---|
| 1 | 游客 → 注册 | `index.html`（App 首页游客态） | `guest` | 游客未登录态 → 注册 → 登录态+账号建立（u6） |
| 2 | 注册 → 个人实名认证 | `pages/profile/auth-personal.html` | `registered` | realname 轨道点亮 |
| 3 | 实名 → 企业工商认证 | `pages/profile/auth-enterprise.html` | `realname` | enterprise 轨道点亮 |
| 4 | 企业认证 → 入驻申请（省代 ¥0） | `pages/profile/entry-form.html?type=provinceAgent` | `enterprise` | 入驻资料·省代提交 → rev_province_pending 待初审 |
| 5 | 后台审核开通 | `pages/province-agent/index.html` | `rev_province_pending` → 后台省代开通/审核通过 | province_agent_active（身份卡已生效） |
| 6 | 总代工作台（身份/省/名额/看板） | `pages/province-agent/index.html` | `province_agent_active`（u11 四川总代） | 授权省四川省/名额 n·cap/约定所得 hero/二级列表 |
| 7 | 发起二级合作（待平台审核） | `pages/province-agent/index.html` | `rev_sub_pending`（u11 发起） | 二级卡片待审核/协议未签约 |
| 8 | 二级签署（总代→二级→签回） | `pages/province-agent/sub.html` | `sub_agent_active`（u12 陈二级） | 约定 20%·已签·本人约定所得/自身余额 |
| 9 | 台账 / 税务 / 打印（商用闭环） | `pages/province-agent/tax-guide.html` | `province_agent_active` | 两分区台账（T+7 冻结/结算/冲减/税列）→ 税说明法定预扣 → 打印 A4 |

> 红线说明：个人合伙人返佣/提现、base/limited、franchise ¥29,800、自身钱包等红线页仅作对照演示，不在本旅程主路径内操作。

后台管理员：右上角用户菜单 → 切换身份 → 选对应角色

---

## 目录结构

> 目录精简约定（2026-10-12）：本目录仅留存 **app demo** 与 **后台 demo** 的项目文件；
> 其余文件（报告 / 图表 / 截图 / 工具配置 / 旧版后台等）一律归档至
> `D:\Engchain3.0-archive\engchain-cleanup-20261012\`，后续更新 demo 时遵循同样规则。

```
Engchain3.0/
├── home.html              # 前端 App 首页
├── preview.html           # 原型总览入口
├── index.html             # 认证引导入口
├── engchain-showcase/     # 全屏展示模式（preview 的“无边框”入口）
├── serve_cached.py        # 本地服务（带缓存）
├── serve_nocache.py       # 本地服务（无缓存）
│
├── admin-vue/             # 管理后台（Vue3 新版，12 组 41 项功能，npm run dev 启动）
│   ├── src/               # 源码（views/components/store/router 分层）
│   └── ...                # 详见 engchain-vue3-admin Skill
│
├── pages/                 # 前端 App（136 个页面文件）
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

*最后更新：2026-10-12*
