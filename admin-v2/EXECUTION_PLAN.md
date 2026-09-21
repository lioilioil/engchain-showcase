# Engchain 多端后台整体重构执行计划（admin-v2 + user-web）

> 版本：v0.2（待批准）
> 状态：**等待用户确认后启动**
> 更新：纳入 C 端 web 端；清除第三方参考源留痕；明确专家团组织
> 日期：2026-09-21

---

## 一、专家团组织与分工

本次任务由"虚拟专家团"协同执行，每个角色在不同阶段由同一执行者切换视角承担，但职责、交付物、验收门独立成立。**关键决策点必须有业务负责人（你）签字才推进。**

| 角色 | 职责 | 交付物 | 在本计划中的体现 |
|---|---|---|---|
| **产品经理（PM）** | 需求边界、模块清单、优先级、验收标准、范围变更管控 | 模块映射表、Roadmap、验收门 | 第二、三、六章 |
| **UI 设计专家** | 视觉系统落地、Token 映射、组件规范、设计走查 | tokens.css、element-overrides、组件库、视觉走查清单 | 第四章 |
| **UX / 交互专家** | 信息架构、导航分组、流程闭环、空/异常/加载态、快捷键与键盘流 | 导航结构、交互规范、可用性检查清单 | 第三章、第七章 |
| **前端重构工程师** | Vue3 工程脚手架、DataBus 桥接、页面迁移、性能 | 可运行工程、构建产物、技术文档 | 第五章、第六章 |
| **视觉与数据走查员（QA）** | 逐页截图对比、数据一致性核对、状态覆盖度检查 | REVIEW.md、截图对比集、数据核对表 | 第七章 |
| **业务负责人（你）** | 方向决策、阶段验收、范围变更、最终切换 | 每阶段"同意/打回"签字 | 各阶段检查点 |

**决策机制：**
- 每个阶段结束，产出自查清单 + 截图证据，交给你；
- 你说"通过"才进下一阶段；
- 你说"打回"，列明问题，回到该阶段修复；
- 中途想加需求/砍范围，走"范围变更"——更新本文档版本号，不直接改代码。

---

## 二、目标与范围

### 2.1 三个产物
1. **管理后台新工程** `D:\Engchain3.0\admin-v2\`：重构现有 27 页 + 并入客户关系模块 + 吞并原 users 审核流；
2. **C 端用户 web 工作台**（与管理后台同一工程，路由 `/u/*`）：为 App 端用户提供大屏操作增强；
3. **共享视觉系统**：一套设计 token + 组件库，两端共用。

### 2.2 本轮做什么
- 管理后台全部 27 页迁移 + CRM 5 对象并入 + users 吞并；
- C 端 web 工作台第一梯队模块（见 §3.3）；
- 视觉系统统一为目标视觉风格（参考行业领先 CRM 的视觉语言）。

### 2.3 本轮不做
- ❌ 后端 API 重写，数据仍来自现有 DataBus；
- ❌ 真实登录服务端改造，保留现有登录态；
- ❌ App 端（移动端）任何改动；
- ❌ 第二梯队 C 端增强模块（列入 Roadmap 后置，见 §3.4）。

### 2.4 命名与留痕规范（硬要求）
- **工程内不出现第三方参考源名称**：所有注释、变量名、文档、localStorage 键、包名均使用本项目自有命名；
- 文档中提及参考对象时统一称"**目标视觉系统**"或"**参考视觉**"，不写第三方品牌名；
- localStorage 键统一前缀 `engchain-console-*`（管理后台）/ `engchain-app-*`（C 端）；
- 已有目录 `D:\Engchain3.0\CRM\` 是你的资产，不动它；新工程内不再使用 `crm` 作为一级目录名，改用 `customer`（客户关系）。

---

## 三、模块清单与导航结构

### 3.1 管理后台路由（`/admin/*`）

| 分区 | 路由 | 来源 |
|---|---|---|
| 总览 | `/admin/dashboard` | 旧 `admin/index.html` |
| 运营中心 | `/admin/operations/supply` `/operations/orders` `/operations/messages` | 旧 operations/ 3 页 |
| **客户关系**（原 users 吞并） | `/admin/customer/companies` `/customer/people` `/customer/opportunities` `/customer/tasks` `/customer/notes` `/customer/approvals/entry` `/customer/approvals/owner` | 参考视觉复刻的 5 对象 + 原 users 4 页改造 |
| 资金中心 | `/admin/finance/wallet` `/recharge` `/withdraw` `/credits` `/commission` `/invoice` `/revenue` | 旧 finance/ 7 页 |
| 分销中心 | `/admin/distribution/overview` `/team` `/payout` | 旧 distribution/ 3 页 |
| 中介服务 | `/admin/mediation/orders` `/sellers` `/escrow` | 旧 mediation/ 3 页 |
| 风控合规 | `/admin/risk/audit` `/compliance` `/monitor` `/logs` | 旧 risk/ 4 页 |
| 系统设置 | `/admin/system/pricing` `/phase` `/roles` | 旧 system/ 3 页 |
| 个人设置 | `/admin/settings/profile` `/appearance` `/members` | 参考视觉的设置壳 |

> 共约 33 条路由。

### 3.2 客户关系吞并原 users 的字段映射
| 旧页面 | 新落地 |
|---|---|
| `users/users.html` | Companies 视图，`type=enterprise` 筛选 |
| `users/auth-review.html` | People 详情页"实名认证"属性行 + 通过/驳回 |
| `users/entry-review.html` | Companies"待入驻"自定义视图 + 行内审批 |
| `users/owner-review.html` | People"企业主身份"属性行 + 动作 |

### 3.3 C 端 web 工作台路由（`/u/*`）—— 本轮做

设计原则：**只做 App 端小屏体验差、大屏明显更高效的模块**。移动端已够用的（如简单浏览、查看通知）不搬。

| 模块 | 路由 | 为什么 web 端更好 | 对应 App 现有页 |
|---|---|---|---|
| **工作台首页** | `/u/dashboard` | 把 App 里分散的待办/订单/钱包/消息聚合到大屏一屏总览 | 聚合 personal/ + message/ + order/ |
| **发布中心** | `/u/publish` `/u/publish/editor` `/u/publish/drafts` `/u/publish/records` | 富文本长文编辑、粘贴图片、多字段表单，大屏键盘+鼠标效率高一个量级 | `pages/publish/*` |
| **供需/人才筛选台** | `/u/supply` `/u/talent` | 多列筛选、并排对比、批量操作，小屏要来回切 | `pages/supply/`、`pages/personnel/`、`pages/agency/seller-board.html` |
| **订单管理台** | `/u/orders` `/u/orders/:id` | 多订单列表 + 详情抽屉 + 状态时间线 | `pages/order/`、`pages/agency/my-orders.html` |
| **财务中心** | `/u/wallet` `/u/wallet/bills` `/u/wallet/invoice` `/u/wallet/bank-cards` `/u/wallet/recharge` `/u/wallet/withdraw` | 账单大屏表格、发票抬头管理、银行卡批量 | `pages/wallet/*` |
| **消息中心** | `/u/messages` `/u/messages/:id` | 多会话列表 + 右侧聊天窗，类似微信 web | `pages/message/*` |
| **认证与入驻** | `/u/auth` `/u/auth/enterprise` `/u/auth/qualification` | 长分步表单、证件上传预览、进度保存 | `pages/profile/auth-*.html`、`entry-form.html` |
| **我的资料** | `/u/profile` `/u/profile/edit` `/u/profile/resume` | 简历/资料编辑长表单 | `pages/profile/index.html`、`edit-profile.html`、`resume-edit.html` |
| **搜索** | `/u/search` `/u/search/result` | 多条件筛选器 + 结果表格 | `pages/search/*` |

> 共约 25 条 C 端路由。

### 3.4 第二梯队（本轮不做，列入 Roadmap 后置）
- 分销收益看板、团队树（`pages/distribution/*`）
- 交易监控大屏（`pages/monitor/`、`platform/dashboard.html`）
- 退款/申诉流程（`pages/refund/*`）
- 企业主页装修（`pages/company/*`、`pages/franchise/*`）
- 协议/帮助/指南等静态页（直接沿用现有页）

> 这些在 P3 结束后由你决定是否启动二期。

---

## 四、视觉系统迁移

### 4.1 硬约束
- 根字号 **13px**（参考视觉的关键锚点）；
- 间距单位 **4px**；
- 明暗双主题，localStorage 键 `engchain-console-theme`；
- 主按钮径向渐变（`#505050 → #333`）不跟随主题；
- 全局零 emoji，图标走 SVG sprite。

### 4.2 Token 映射
把参考视觉的 `tokens.css` 移植为 `src/styles/tokens.css`，变量名保持语义化（`--bg-primary`、`--gray60` 等），不出现第三方命名。同时写 `element-overrides.scss` 把 Element Plus 默认变量覆盖到这套色板（映射表见 v0.1，不再重复）。

### 4.3 组件对齐
- 按钮 md 32px / sm 24px，主按钮圆角 8px；
- 表格行高 32px，单元格内距 8/4px；
- 右侧抽屉 500px；
- 设置页双栏（正文 512px + 侧栏 536px）；
- ⌘K 命令菜单（自定义组件）。

---

## 五、技术架构

### 5.1 技术栈
Vue 3 + Vite + TypeScript + Element Plus + Pinia + Vue Router 4 + ECharts 5 + Axios。

### 5.2 目录结构
```
admin-v2/
├── index.html
├── package.json / vite.config.ts / tsconfig.json
├── EXECUTION_PLAN.md
└── src/
    ├── main.ts / App.vue
    ├── styles/           # tokens.css / element-overrides.scss / global.scss
    ├── router/           # 管理后台路由 + C 端路由分两个 children
    ├── stores/           # user / theme / databus
    ├── api/              # DataBus 桥接适配
    ├── layouts/
    │   ├── AdminShell.vue    # /admin/* 壳
    │   ├── UserShell.vue     # /u/* 壳（侧栏 + 顶栏，更轻量）
    │   └── components/       # SideNav / TopBar / CommandPalette / RightDrawer
    ├── components/          # ProTable / PageContainer / StatusTag / Money / ApprovalDialog
    ├── modules/
    │   ├── admin/          # 管理后台各分区
    │   └── user/           # C 端工作台各模块
    └── utils/
```

### 5.3 与旧数据层对接
- 旧 `D:\Engchain3.0\js/*.js` 作为静态脚本引入新工程 `index.html`；
- Pinia store 通过 `window.DataBus`、`window.AppStores` 桥接；
- 组件只从 Pinia 取数，不直接碰 window；
- 审批留痕写回同一 DataBus，保证 `/admin/risk/logs` 能看到新工程记录。

### 5.4 与 C 端现有页的关系
- 本轮**不删**旧 `pages/` 下任何文件；
- 新 C 端 web 工作台在 `/u/*` 路径并行，验收通过后再决定入口切换；
- 旧 C 端页面保留作对照基线和回滚。

---

## 六、分阶段 Roadmap

### P0 · 工程骨架与视觉底座
**交付：** Vite 工程可跑 + tokens 移植 + AdminShell/UserShell 双壳 + ⌘K + 明暗主题 + 两个空示例页（`/admin/dashboard`、`/u/dashboard`）。

**门：**
- [ ] `npm run dev` 无 error/warning；
- [ ] 根字号 13px、表格行高 32px（DevTools 量得）；
- [ ] 明暗切换整站跟随；
- [ ] 主按钮呈径向灰渐变；
- [ ] 工程内 grep 不到第三方参考源名称（代码、注释、localStorage 键、包名）。

### P1 · 管理后台 27 页迁移 + 客户关系并入
**交付：** §3.1 全部路由可用，原 users 4 页改造完成，审批留痕写回 DataBus。

**门：**
- [ ] 33 条路由全部可访问无白屏；
- [ ] 抽样 5 页数据与旧 admin 一致；
- [ ] 审批动作后 `/admin/risk/logs` 可见新记录；
- [ ] 空/加载/异常三态齐全。

### P2 · C 端 web 工作台第一梯队
**交付：** §3.3 全部 25 条路由可用，发布中心富文本可用，消息中心双栏对话可用。

**门：**
- [ ] C 端 25 路由全部可访问；
- [ ] 发布器能粘贴图文、保存草稿、发布成功；
- [ ] 消息中心能收发（接现有 DataBus 消息层）；
- [ ] 财务中心账单/发票/银行卡与旧 `pages/wallet/` 数据一致（抽样 3 页）。

### P3 · 完善与切换
**交付：** 全量走查 + 数据核对 + 权限路由守卫 + 构建产物 + 切换方案。

**门：**
- [ ] 管理后台 33 页 + C 端 25 页全部通过视觉走查（light/dark 各一截图）；
- [ ] 与旧站同名页面数据一致（抽样 ≥10 页）；
- [ ] 控制台无 error、无未处理 Promise rejection；
- [ ] `npm run build` gzip 后首屏 < 500KB；
- [ ] 你实际走一遍：登录 → 管理后台审一单 → C 端发一条供需 → 切主题，全链路无阻断。

---

## 七、复查机制

### 7.1 每阶段强制门
阶段结束产出 `admin-v2/REVIEW.md`，逐条打勾；任何一条未过不进下一阶段。

### 7.2 视觉走查
- 每页 light/dark 各截图；
- 与参考视觉复刻并排对比，查：字阶断崖、间距 4 的倍数、token 用对、主按钮灰色渐变、无 Element 默认蓝泄漏。

### 7.3 数据一致性
- 每页迁移后与旧同名页对比 KPI/列表/操作结果；
- P1 抽样 ≥5 页，P3 抽样 ≥10 页。

### 7.4 代码门禁
- Composition API + `<script setup>`；
- 无 `any`；
- 表单 rules + validate 完整；
- 样式 scoped；
- 无 `console.log`；
- 全局状态用 Pinia。

### 7.5 你参与的检查点
- P0 后：看一眼双壳方向；
- P1 后：点 3 个高频管理页（总览/提现/订单）；
- P2 后：走一遍 C 端发供需 + 聊消息；
- P3：终验逐项过。

---

## 八、风险与回滚

| 风险 | 缓解 |
|---|---|
| Vite 与旧静态站数据层不兼容 | P0 先做 DataBus 桥接 spike，跑通再继续 |
| Element 主题覆盖不到位 | P0 门强制 DevTools 量化字阶/行高/色值 |
| 工作量大（33+25=58 页） | 严格门控，每阶段你可叫停/砍范围 |
| 旧 admin / 旧 pages 被误改 | 全程只读，新代码只在 admin-v2/ |
| 切换入口出问题 | 新产物先挂 `/admin-v2/` 和 `/u-v2/` 并行运行 1 周，旧目录改名保留 30 天 |
| 本地 Node 未装 | P0 第一步检查 `node -v`，未装先指导安装（Node 18+） |
| C 端功能边界蔓延 | 严格按 §3.3 清单做，第二梯队不擅自启动 |

---

## 九、待你确认

1. **C 端模块清单**：§3.3 的 9 个模块（工作台/发布/筛选/订单/财务/消息/认证/资料/搜索）是否符合你的预期？有要加/砍的吗？
2. **第二梯队后置**：§3.4 列出的模块（分销看板/监控大屏/退款/企业主页）本轮不做，同意吗？
3. **Node 环境**：本地是否已装 Node 18+？
4. **登录**：新工程是否需要独立 `/login` 页，还是复用现有登录态？
5. **路径**：管理后台挂 `/admin/`、C 端挂 `/u/`，还是用别的路径？
6. **节奏**：P0→P1→P2→P3 串行，每阶段你验收。是否同意？

---

## 十、批准后启动顺序

你回复同意或修改意见后：
1. 检查 Node 环境；
2. 执行 P0（双壳 + 视觉底座 + DataBus spike）；
3. P0 完成停下来请你看方向，确认后进 P1。

**未获批准前不动代码。**
