# 静态 UI/UX 审计报告 · Group C
**范围**：个人中心 / 认证 / 分销 / 其他页面组（15 页）
**方法**：纯静态代码审计（未运行、未修改任何源码）
**日期**：2026-09-11
**基线**：DESIGN-SYSTEM.md V3.3；js/stores.js（AuthStore L40-89 / EntryStore L98-130 / deriveIdentity L884-928）；js/data.js（statuses L885-899、entryTypes L1064-1080、monitor.limits L1117、breakin L1131-1138）

---

## 1. 总体概述

本组覆盖 15 个页面，横跨"个人中心 + 认证 + 入驻 + 分销 + 消息 + 监控 + 中介/招商/招聘 + 状态/引导"。整体设计系统一致性较好（统一调用 `var(--primary)`/`--line`/`--bg-card`、复用 `card`/`chip`/`tag`/`btn` 原子类），**认证中心 auth.html 与入驻 entry.html 的状态机与事件监听是本组的标杆**；但**个人中心 profile/index.html 作为"状态感知核心页"反而缺失最关键的事件监听与双线身份渲染**，形成全组最大短板。

### 1.1 10 维平均分（每维 1–5）

| 维度 | 平均分 | 说明 |
|---|---|---|
| 1 视觉一致性 | 4.1 | 全部沿用 V3.3 token 与原子类，仅 message 页用原生 alert 破坏一致 |
| 2 信息架构 | 3.9 | 主链路清晰；agency 目录命名与实际内容不符（见 C-11） |
| 3 交互流畅度 | 3.7 | 多数页有 toast/sheet/空态；message 用 alert、auth-enterprise 进度条初渲染缺失 |
| 4 状态感知 | 3.0 | **本组最弱项**：profile/index 不监听身份事件、不渲染双线身份/入驻徽标 |
| 5 交易钩子 | 3.9 | 入驻/分销/监控 CTA 明确；state 演示页无钩子（合理） |
| 6 付费墙体验 | 3.4 | 监控额度墙、分销门控到位；订阅价/保证金透明度不足 |
| 7 权限引导 | 3.6 | 投递门控、入驻门控好；profile 受限入口置灰但缺少"升级后获得什么" |
| 8 空态引导 | 3.6 | 分销收益/监控/招商/招聘空态优秀；消息会话无空态 |
| 9 信任构建 | 3.7 | 金V/托管/核验标识齐全；保证金与返佣规则透明度一般 |
| 10 复购留存 | 3.4 | 监控续费提示、分销海报/团队入口在；消息推送引导弱 |

### 1.2 问题统计

| 级别 | 数量 | 含义 |
|---|---|---|
| E0 体验阻断 | 0 | 无完全阻断流程的硬伤 |
| E1 严重影响转化 | 4 | 状态感知核心页不刷新、双线身份不可见、弹窗 CTA 错位等 |
| E2 一般体验问题 | 9 | 进度条初渲染缺失、alert 替代弹层、广告位 hardcode、空态缺失 |
| E3 优化建议 | 7 | 对比表/保证金说明/价格预警维度等 |

---

## 2. 按页面分组审计

### 2.1 `pages/profile/index.html` — 个人中心 ★状态感知核心

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 3 | **2** | 4 | 3 | 3 | 2 | 3 | 3 |

**问题清单**

- **[C-P1-01 / E1] 状态感知核心页不监听任何身份事件，UI 不随状态刷新**
  - 文件：`pages/profile/index.html`；依据：全文件唯一事件绑定为 L1783 `document.addEventListener('DOMContentLoaded', init)`，**无 `engchain:auth` / `engchain:entry` / `engchain:store-change` / `storage` 监听**（对照 auth.html L427-432 四事件监听、distribution/index.html L409-414）。
  - 影响：在子页（auth/entry）完成认证后若通过返回键/同页 store-change 回到本页，KPI、功能入口可见性、升级条均不会重算；多 Tab 同步也缺失。
  - 修复：`init` 外增加 `window.addEventListener('engchain:auth', init)`、`'engchain:entry'`、`'storage'`（仅 key 为 engchain-auth/engchain-entry 时重渲染）。

- **[C-P1-02 / E1] 只渲染 `idy.primary`，双线身份（个人线/企业线）与入驻类型徽标完全不可见**
  - 依据：L1442-1444 `currentIdentity()` 只取 `idy.primary`；L1471 `cfg = ID_CFG[idy.primary]`。`idy.personal / idy.enterprise / idy.entryTypes / idy.identities`（deriveIdentity L905-928 已计算并返回）在本页**从未被读取或渲染**。
  - 影响：用户同时是"已实名个人 + 建筑入驻企业"时，页面只显示一个 primary 徽标；data.js 定义的 `蓝V/金V/专属` 入驻徽标（data.js L1065/1067/1069）在个人中心主头部**无任何展示位**，与 auth.html 五卡、entry.html 徽标设计脱节。
  - 修复：在头部身份卡下增加一行"双线身份"区，展示 `个人线：{personalLabel}` 与 `企业线：{enterpriseLabel}` 及 `entryTypes.map(t=>t.badge)` 徽标。

- **[C-P1-03 / E1] 无特殊状态展示位（审核中/封禁/提现中）**
  - 依据：全站 HTML 无 `审核中`/`封禁`/`提现中` 相关节点（grep 仅命中注释）。ID_CFG L1432-1434 只覆盖 7 个 primary 终态。
  - 影响：企业认证审核中、提现打款中、账号受限等过程态在个人中心无任何常驻提示位，用户需主动进子页才知。
  - 修复：头部增加一行"进行中"横幅槽位，由 AuthStore.lite.enterprise.status / EntryStore / 提现单驱动。

- **[C-P1-04 / E2] 关注 KPI 硬编码为 0**
  - 依据：L1525 `follow:0`（contacts/collect 真实读取，follow 写死）。
  - 修复：接 MonitorStore.follows.length 或收藏数。

- **[C-P1-05 / E2] 诚信分卡片对游客/注册用户也常驻展示**
  - 依据：L1240 `credit-score-section` 无身份条件包裹，guest 也渲染空分 "--"。
  - 修复：guest/registered 态隐藏或替换为"完成认证解锁诚信分"引导。

- **[C-P1-06 / E3] 破冰期福利在个人中心无感知入口**
  - 依据：data.js breakin（L1131-1138）配置了 construction ¥0 / agency ¥14999 / monitor 7 天试用，但个人中心头部与升级区均未引用 `MOCK.business.breakin`。
  - 修复：破冰期在升级条下方插入"建筑入驻限时 0 元"金色横幅。

---

### 2.2 `pages/profile/auth.html` — 认证中心（五身份叠加）

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | **5** | 4 | 4 | 4 | 3 | 4 | 3 |

**评价**：本组状态感知标杆。L427-432 同时监听 `engchain:auth`/`engchain:entry`/`engchain:store-change`/`storage`；五张身份卡（实名/专业/个人合伙人/企业认证/企业入驻）各自渲染 todo / review / done / reject / locked 五态，与 AuthStore（L40-89）五身份叠加模型对齐。

**问题清单**

- **[C-P2-01 / E3] 企业认证卡"年费 ¥999"与入驻 entry 费 ¥29999 同屏未解释关系**
  - 依据：L378/L388 企业认证卡文案"年费 ¥999"（对应 data.js membershipAnnual L1083）；而 entry.html 企业入驻 agency 为 ¥29999（破冰 ¥14999）。两者分属"认证 R1 / 入驻 R2"，但卡片未区分，用户易混淆。
  - 修复：企业认证卡标注"认证年费（不含入驻费）"，并加跳转"查看入驻费 ›"。

- **[C-P2-02 / E3] 五卡全部并排展示，未按 primary 高亮"当前主身份"**
  - 依据：卡片仅按 done/review 着色，未调用 deriveIdentity().primary 标记当前主身份。
  - 修复：primary 对应卡片加金色描边/对勾。

---

### 2.3 `pages/profile/auth-enterprise.html` — 企业认证（多维资质）

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 3 |

**问题清单**

- **[C-P3-01 / E2] 维度进度条与等级徽标首次进入 done 态时为空**
  - 依据：`renderDimProgress()` 仅在 L463 `submitDim` 后调用；`render()`→`fillDone(a)`（L445 附近）只回填文本，**未调用 renderDimProgress**。初始 `dim-progress-done` 容器（done 态）与 `dim-level-badge` 保持 "--"。
  - 影响：已认证用户二次进入企业认证页，看不到"已完成 X/5 项 · 高级"进度，信任信息丢失。
  - 修复：在 `fillDone` 末尾补一次 `renderDimProgress()`。

- **[C-P3-02 / E2] UI 维度数与 stores.js 配置的 5 项不一致**
  - 依据：AuthStore.dimensions 配置为 business/legal/qualification/bank/office 共 5 项；本页表单实际只上传 营业执照(business) + 可选 资质/银行/办公（4 个上传位），**法人(legal)维度无独立提交位**（隐式依赖个人实名）。
  - 影响：进度条分母与用户可见项对不上，legal 项"自动完成"无说明。
  - 修复：补一行"法人已随个人实名核验 ✓"只读项，或在说明里写明。

- **[C-P3-03 / E3] 审核中态（review box L169）不展示各维度提交状态**
  - 影响：用户提交后只看到"审核中"，看不到哪项已过/待核。
  - 修复：review box 内复用维度列表展示逐项状态。

---

### 2.4 `pages/profile/entry.html` — 入驻引导（R2 转化）

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | **5** | 4 | 4 | 4 | 3 | 3 |

**评价**：三张类型卡（建筑 ¥3999 蓝V / 中介 ¥29999 金V / 合伙人 ¥0 审核 专属），破冰价正确展示（建筑 ¥0 限免 L72、中介 5 折 L99，与 data.js breakin L1133 一致）；门控 L86-89 要求企业已认证或个人专业。

**问题清单**

- **[C-P4-01 / E2] 权益对比仅用 feature chips，无并排对比表**
  - 依据：L64-133 三卡各自列 chip，缺少横向权益矩阵（名额/返佣/监控额度/徽标同屏对比）。任务要求"入驻类型对比表"。
  - 修复：卡区下方加一张 3 列 × N 行对比表。

- **[C-P4-02 / E3] 保证金只在 footnote 笼统提及"履约保证金"，无金额/退还规则**
  - 依据：L49-52 注释与 agency 卡 chip"履约保证金机制"均无金额与退还条件。
  - 修复：footnote 补"保证金 ¥X，退出时全额退还"。

---

### 2.5 `pages/profile/entry-form.html` — 入驻表单

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 4 | 3 |

**问题清单**

- **[C-P5-01 / E2] 支付/保证金金额汇总依赖类型参数，但无"订单摘要确认"三态反馈**
  - 依据：表单按 type 渲染字段 + 支付按钮，支付成功后无显式"待审核/已提交"落态页（依赖跳转）。
  - 修复：提交后进入"已提交·审核中"结果态而非直接跳走。

- **[C-P5-02 / E3] 破冰价与原价划同行，但未标注"恢复原价时间"**
  - 修复：限免标签补倒计时/截止日。

---

### 2.6 `pages/distribution/index.html` — 分销中心

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 |

**评价**：门控屏（L134-148）正确区分"个人合伙人 完整二级 8%/2%"与"企业合伙人 12%/3%"，与 deriveIdentity L916-924（`idy.partner` 个人 vs entryTypes 企业并行）一致；收益概览/团队/海报入口齐全。

**问题清单**

- **[C-D1-01 / E2] 未监听 `engchain:entry` 事件**
  - 依据：L409-414 监听 balance/state/auth/store-change/rebate，**漏 `engchain:entry`**。若用户在他页完成企业入驻（成为企业合伙人）回到本页，档位文案不更新。
  - 修复：补 `window.addEventListener('engchain:entry', render)`。

- **[C-D1-02 / E2] 页面加载即 `seedDemoData()` 写入 localStorage（L183）**
  - 依据：每次进入分销中心都可能改写 `engchain-users` 演示数据，属副作用，可能污染真实账号数据。
  - 修复：仅在 key 不存在时 seed。

- **[C-D1-03 / E3] 零团队新用户空态无"邀请好友第一步"引导卡**
  - 依据：hero 区恒显 ¥0.00，团队区无数据时仅 0 计数，无破冰引导。
  - 修复：团队为空时插一张"生成海报→邀请首位好友"引导卡。

---

### 2.7 `pages/distribution/poster.html` — 分销海报

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 4 |

**评价**：经 `entryAccess().dist` 门控后生成/分享流程干净。**问题清单**：

- **[C-D2-01 / E3] 未监听身份事件**（一次性门控页，可接受，但与 auth.html 标杆不一致）。
- **[C-D2-02 / E3] 分享渠道仅 toast，无系统分享/保存图实装**（静态预期内）。

---

### 2.8 `pages/distribution/earnings.html` — 分销收益

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 4 | 4 | 4 | **5** | 4 | 4 |

**评价**：空态质量高——L52-56 空收益时给出"去分享海报 ›"行动召唤；返佣/提现/明细结构清晰。**问题清单**：

- **[C-D3-01 / E3] 提现中（打款中）状态无专属徽/进度说明位**（任务要求特殊状态展示）。
- **[C-D3-02 / E3] 返佣规则透明度**：8%/2%、12%/3% 仅在中心页说明，明细页未内联"本笔来源=一级/二级"。

---

### 2.9 `pages/message/index.html` — 消息中心

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 3 | 3 | **2** | 3 | 3 | 3 | 3 | **2** | 3 | 4 |

**问题清单**

- **[C-M1-01 / E2] "智能推荐"用原生 `alert()` 而非设计系统弹层**
  - 依据：L125、L129 两处 `alert("暂无推荐…")` / `alert("智能推荐（前5条）…")`。全站其他页统一用 `UI.dialog`/sheet/`UI.toast`（如 agency/index.html L314、personnel deliver modal）。
  - 影响：视觉与 V3.3 割裂，且 alert 无法滚动/长文本截断。
  - 修复：改用 `UI.dialog` 或底部 sheet。

- **[C-M1-02 / E2] 会话列表恒为硬编码 MOCK.conversations，无空态**
  - 依据：L131 `document.getElementById('list').innerHTML = MOCK.conversations.map(...)`，无 `if(!MOCK.conversations.length)` 分支。新用户无会话时也看到假数据。
  - 修复：空会话渲染"暂无消息 · 去发现页找商机"引导卡。

- **[C-M1-03 / E3] 未监听 `engchain:auth`（未读红点与身份无关，但系统通知分类未随认证状态变化）**。

---

### 2.10 `pages/monitor/index.html` — 监控中心（付费增值）

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 |

**评价**：本组付费墙实现最完整。破冰期 7 天试用横幅（L73-85，monitorTrialDays=7 与 data.js L1136 一致）、试用结束横幅（L97）、成熟期 limit=0 入驻解锁横幅（L101-107）、关注/动态双空态（L133/L151）、limit 拦截 toast（L177-180）；监听 auth/state/store-change/storage。

**问题清单**

- **[C-MO-01 / E3] 任务要求的"价格预警"维度缺失**
  - 依据：dims 来自 data.js L1115 = 资质到期/项目更新/中标/司法/经营异常/工商变更，**无"价格/行情预警"**。
  - 修复：若商业模式含价格预警，补该维度；否则在文案中明确"暂不含价格预警"。

- **[C-MO-02 / E3] 无订阅价格/续费 CTA**（当前为免费额度递增制，非订阅制；任务预期"订阅价格"未兑现）。

---

### 2.11 `pages/agency/index.html` — 实为"服务广场"（非中介后台）

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 4 | 4 |

**关键发现（命名/角色错配）**

- **[C-A1-01 / E1] 目录 `agency/index.html` 实际是买方"服务广场"，而非任务预期的"中介专属后台"**
  - 依据：本页标题 L13"服务广场"、L26 注释"本页为交易引导页；服务商经营入口仅在 个人中心·服务经营"；真正的中介卖家后台是 `agency/seller-board.html`（由 profile/index.html L1612 以 lock key `agency` 链接）。
  - 影响：任务书"仅中介类型可访问的后台/卖家看板/佣金 6%"在 `agency/index.html` 上**无对应实现**——本页对所有身份开放浏览，无中介专属门控，页面内也无 6% 佣金展示。审计预期落空。
  - 修复建议（非本次修改）：在审计报告中明确"中介后台=agency/seller-board.html"，或将本页改名 marketplace；佣金 6% 应在 seller-board 校验。

**问题清单**

- **[C-A1-02 / E2] 未监听 `engchain:auth`/`engchain:entry`**（仅 mode/store-change/lead，L645-647）。
- **[C-A1-03 / E3] 顺手办材料核验/到期提醒用 localStorage 本地状态，与全局 identity 不联动**（如已入驻企业仍提示"营业执照副本"材料）。

---

### 2.12 `pages/franchise/index.html` — 资质招商

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | **2** | 4 | 3 | 3 | 4 | 4 | 3 |

**评价**：列表/筛选/空态（L712-740，含重置筛选 + 发布需求 + 专享委托三 CTA）完整；L340 footnote"未登录将先引导登录与认证"。

**问题清单**

- **[C-F1-01 / E2] 无任何身份事件监听，招商委托状态不随认证刷新**（grep 无 `engchain:auth/entry`）。
- **[C-F1-02 / E3] 已提交委托后 hero 按钮态（renderDelegateBtn L832）依赖 localStorage 委托库，未与认证状态联动**。

---

### 2.13 `pages/personnel/index.html` — 招聘中心（免费策略）

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3 |

**评价**：免费策略落实——L339"人才免费发布 · 企业付费查看"；投递门控 `DataBus.canDeliverResume()`（L1300-1303）+ 引导弹窗（L448-460）+ 已投递态置灰（L1410-1414），权限引导质量高。

**问题清单**

- **[C-PE1-01 / E2] 无权限引导弹窗 CTA 恒为"去完善简历"，对未注册用户是错误引导**
  - 依据：L458 按钮文案写死"去完善简历"，跳编辑简历；但 `canDeliverResume` 返回的 reason 可能是"请先注册/实名"（L1298 兜底文案"请先完成个人入驻"）。未注册用户点"去完善简历"无处可去。
  - 修复：按 reason 动态切换 CTA 文案与跳转（未注册→登录/注册；已注册未实名→实名；其余→完善简历）。

- **[C-PE1-02 / E3] 未监听 `engchain:auth`，完成实名后投递按钮不即时解锁**（需刷新页面）。

---

### 2.14 `pages/state/index.html` — 状态演示页

**10 维评分**（演示页，业务维度按 N/A 低分）

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

**评价**：3 张静态卡（成功/处理中/失败）演示 toast 样式，仅引 common.js。**问题清单**：

- **[C-S1-01 / E3] 演示页未接真实状态**（如"处理中"演示仅 toast，不演示审核中卡片实样）；作为状态规范参考页价值有限。

---

### 2.15 `pages/guide/index.html` — 新用户引导

**10 维评分**

| 视觉 | IA | 交互 | 状态感知 | 交易钩子 | 付费墙 | 权限 | 空态 | 信任 | 留存 |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 4 |

**评价**：5 步成长时间线 + 游客/已注册身份切换 + 新手福利卡（¥50/¥30/¥20/¥100）+ 弹窗预览，破冰期引导完整。

**问题清单**

- **[C-G1-01 / E2] 成长步骤 3/4/5 用独立 localStorage 标志判断，真实业务流不写这些 key，步骤永不自动完成**
  - 依据：L250 `localStorage.getItem('engchain-published')==='1'`、L256 `'engchain-deal'`、L262 `'engchain-partner'`。发布/成交/分销流并未统一写入这三个 key（对比步骤 2 实名 L243 正确读 `engchain-auth.realname.ok`）。
  - 影响：用户已发布/已成交后，引导页仍显示"去完成"，进度长期停在 1/5，误导。
  - 修复：步骤 3 读 PublishStore、步骤 4 读订单/DealStore、步骤 5 读 AuthStore.partner。

- **[C-G1-02 / E3] 福利金额"¥50积分"单位混用（积分 vs 元）**（L191-203 "¥50积分"语义模糊）。

---

## 3. 状态感知专项分析

### 3.1 6 级状态在各页面的展示一致性

deriveIdentity 产出 7 个 primary（guest/registered/realname/pro/partner/enterprise/resident，对应 data.js 6 级 + partner 拆分）。各页使用情况：

| 页面 | 是否读 primary | 是否读双线 personal/enterprise | 是否读 entryTypes | 是否监听身份事件 |
|---|---|---|---|---|
| profile/index | ✅ 仅 primary | ❌ 全丢弃 | ❌ | ❌ **无任何监听** |
| profile/auth | ✅ 五卡独立 | ✅ 五身份叠加 | ✅ | ✅ 4 事件 |
| auth-enterprise | ✅ | 部分 | ✅ 企业 | ✅ auth |
| entry | ✅ 门控 | ✅ | ✅ 三类型 | ✅ 4 事件 |
| entry-form | ✅ | — | ✅ 类型参数 | 部分 |
| distribution/index | ✅ tier | ✅ partner 个人/企业分离 | ✅ | ⚠️ 漏 entry |
| monitor | ✅ tier 档 | ✅ | ✅ | ✅ auth/state |
| agency/index | 只读 entryAccess().statusId | ❌ | ❌ | ⚠️ 漏 auth/entry |
| franchise | ❌ 无身份感知 | ❌ | ❌ | ❌ |
| personnel | ✅ 经 DataBus | ❌ | ❌ | ❌ |
| guide | ✅ detectRole | ❌ | ❌ | ❌（一次性） |

### 3.2 特殊状态缺口

- **审核中**：auth.html / auth-enterprise.html / entry.html 有 review 态；但 **profile/index 无"审核中"常驻位**，**monitor/agency/franchise 无**。
- **封禁/风控**：15 页中**无任何封禁/受限展示位**（任务书风控模块预期）。
- **提现中**：distribution/earnings 无打款中进度展示。
- **入驻到期/续费**：entry.html 未渲染 EntryStore 的到期日与 subscription.remindDays（data.js L1073）。

### 3.3 入驻类型徽标（蓝V/金V/专属）

- 定义齐全：data.js L1065/1067/1069。
- 正确使用：entry.html 卡片（t.badge）、auth.html 企业卡、agency 服务卡 svc-org 金V。
- **缺口：profile/index 个人中心头部完全不展示 entryTypes 徽标**（C-P1-02），导致用户在"我的"主界面看不到自己的蓝V/金V身份。

---

## 4. 权限引导专项分析

### 4.1 受限功能拦截方式分布

| 拦截方式 | 页面 | 评价 |
|---|---|---|
| 整页 gate 屏（列权益+CTA） | distribution/index、poster、monitor 试用横幅 | 最佳，"升级后获得什么"清楚 |
| 弹窗引导（reason+CTA） | personnel 投递（canDeliverResume）、auth-enterprise reject | 良好；但 personnel CTA 文案不随 reason 变（C-PE1-01） |
| toast 提示 | monitor 超限、distribution | 够用，缺"去升级"跳转 |
| 置灰+锁标 | profile 功能列表 lock | 良好 |
| 无拦截（对所有人开放） | agency/index（服务广场，合理）、franchise 浏览（合理） | — |

### 4.2 升级引导文案质量

- 优秀样例：monitor 横幅"入驻企业解锁完整监控（建筑 30 / 中介 50 / 合伙人 200）"（L97）——**明确"升级后获得什么"**；distribution gate 屏列 8%/2% vs 12%/3%。
- 不足：profile/index 的 lock 项仅锁标，**未说明解锁后权益**（如"专业版解锁简历库"无下文）；agency/index 无中介专属功能权限拦截展示。

---

## 5. 空态引导专项分析

| 页面 | 空态 | 是否有 CTA | 评级 |
|---|---|---|---|
| distribution/earnings | ✅ 无收益卡 + "去分享海报" | ✅ | 优 |
| monitor 关注/动态 | ✅ 文案引导 | 部分（关注列表内有"添加企业"区） | 优 |
| franchise | ✅ 重置筛选+发布需求+专享委托 | ✅ | 优 |
| personnel | ✅ 重置+委托+专享 | ✅ | 优 |
| agency 搜索无结果 | ✅ 换词建议+推荐+联系顾问 | ✅ | 优 |
| message 会话 | ❌ 恒显 MOCK 数据，无空态 | ❌ | 缺 |
| profile 新用户首屏 | ❌ 无 guide 弹窗触发（guide 为独立路由） | 部分 | 缺 |
| distribution 团队 | ⚠️ 仅 0 计数 | ❌ | 中 |

**新用户引导**：guide/index.html 本身完整（5 步+福利），但它是**独立路由页**，profile/index 与首页无"首访自动弹 guide 弹窗"的触发逻辑在本组页面内；guide 内步骤完成判定又用了不联动的 localStorage key（C-G1-01），破冰期"0 元入驻/免费解锁"感知在个人中心缺失（C-P1-06）。

---

## 6. Top 5 最严重问题

| 排名 | 编号 | 级别 | 问题 | 代码依据 |
|---|---|---|---|---|
| 1 | C-P1-01 | E1 | **个人中心（状态感知核心页）不监听 engchain:auth/entry/storage，身份变化后 UI 不刷新** | profile/index.html 仅 L1783 DOMContentLoaded |
| 2 | C-P1-02 | E1 | **个人中心只渲染 primary，双线身份 personal/enterprise 与蓝V/金V/专属入驻徽标完全不可见** | L1442-1471 未读 idy.personal/enterprise/entryTypes |
| 3 | C-A1-01 | E1 | **agency/index.html 实为买方"服务广场"，任务预期的"中介专属后台/卖家看板/佣金6%"在该文件不存在**（真后台=agency/seller-board.html） | L13/L26 注释、L36 跳 my-orders.html |
| 4 | C-G1-01 | E2 | **新用户引导 5 步中后 3 步用无人写入的 localStorage 标志判断，步骤永不自动完成，进度长期 1/5** | guide/index.html L250/L256/L262 |
| 5 | C-M1-01 + C-P3-01 | E2 | **体验一致性双缺口**：消息中心用原生 alert() 替代 V3.3 弹层；企业认证 done 态首次进入维度进度条/等级徽标为空 | message/index.html L125/L129；auth-enterprise.html renderDimProgress 仅 submitDim 调用 |

---

### 附：审计覆盖确认
- 已逐页阅读全部 15 个页面源码；状态/Store 依据核对 stores.js L40-130、L860-950 与 data.js L885-899、L1064-1144。
- 未修改任何源代码。
- 待补充（未在本组 15 页内）：agency/seller-board.html（真正的中介后台，含 6% 佣金与卖家看板）建议纳入 Group 后续审计。
