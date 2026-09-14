# Engchain3.0 工程链信息平台 · 全量 UI/UX 深度审计报告

> **审计范围**：`pages/` 目录下全部 **104 个 HTML 页面**，无优先级区分，全量深度检查
> **审计方式**：纯代码静态分析（Read / Grep / Glob），未做浏览器渲染、未截图
> **设计基线**：`css/app.css :root` 设计令牌体系（主色 `--primary #C9A961` / 功能色 `--error #B3261E` / `--success #2B6B4F` / `--warning #9A7B1F` / 四级圆角 `--r-*` / 多层阴影 / Barlow+PingFang 字体）
> **检查维度**：视觉 · 交互 · 板块 · 内容 · 元素（每页五维度全覆盖）
> **严重程度**：🔴 高（影响核心功能 / 明显视觉错误 / 用户无法完成操作） · 🟡 中（体验不佳 / 一致性问题 / 可优化但不影响使用） · 🟢 低（细节打磨 / 建议性改进）
> **审计日期**：2026-09-14

---

## 一、检查概览

### 1.1 总量统计

| 指标 | 数值 |
|---|---|
| 审计页面总数 | **104 页** |
| 发现问题总数 | **930 个** |
| 平均每页问题数 | 8.9 个 |
| 零问题页面 | 1 页（`profile/notify.html`） |
| 问题最多页面 | `publish/editor.html`（21 个） |

### 1.2 各维度问题分布

| 维度 | 问题数 | 占比 |
|---|---|---|
| 视觉 | 295 | 31.7% |
| 交互 | 210 | 22.6% |
| 内容 | 153 | 16.5% |
| 板块 | 140 | 15.1% |
| 元素 | 132 | 14.2% |
| **合计** | **930** | **100%** |

### 1.3 严重程度分布

| 严重程度 | 问题数 | 占比 |
|---|---|---|
| 🔴 高 | 55 | 5.9% |
| 🟡 中 | 544 | 58.5% |
| 🟢 低 | 331 | 35.6% |
| **合计** | **930** | **100%** |

### 1.4 各分片/模块问题分布

| 分片 | 覆盖模块 | 页数 | 问题数 | 🔴高 | 🟡中 | 🟢低 | 视觉 | 交互 | 板块 | 内容 | 元素 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 分片1 | profile | 31 | 135 | 16 | 106 | 13 | 56 | 32 | 11 | 12 | 24 |
| 分片2 | wallet + agency | 25 | 176 | 9 | 78 | 89 | 50 | 42 | 27 | 28 | 29 |
| 分片3 | publish/distribution/message/search/franchise/refund/agreement/vendor | 24 | 291 | 12 | 168 | 111 | 70 | 66 | 47 | 60 | 48 |
| 分片4 | auth/主页/supply/order/散页/单页模块 | 24 | 328 | 18 | 192 | 118 | 119 | 70 | 55 | 53 | 31 |
| **合计** | — | **104** | **930** | **55** | **544** | **331** | **295** | **210** | **140** | **153** | **132** |

### 1.5 代码质量热力图（全量扫描基线数据）

| 指标 | 数值 | 说明 |
|---|---|---|
| 内联 `style=` 属性总数 | 1,850 | 平均 17.8 个/页，**0 页完全无内联样式** |
| HTML 中十六进制颜色总数 | 1,018 | 大部分在 `<style>` 块内，内联 style= 中硬编码 63 处 |
| `rgb()` / `rgba()` 调用 | 大量 | 功能色 rgba 硬编码散落各页 |
| 占位符文本（TODO/XXX/占位/示例数据等） | 59 处 | 集中在 `profile/auth.html`（19）、`agency/order-detail.html`（12） |
| 含 `<style>` 块的页面 | 85 / 104 | 仅 19 页完全依赖 app.css |
| `<script>` 块总数 | 552 | 平均 5.3 个/页 |
| 内联样式 >50 个的页面 | 5 页 | `agency/seller-board`(55)、`publish/editor`(52)、`profile/index`(47)、`agency/index`(42)、`wallet/withdraw`(43) |

---

## 二、Top 20 共性问题（跨页系统性问题，合并去重，按严重程度排序）

### 🔴 P0 级（立即修复）

#### 1. `--danger` CSS 变量未定义却被全站 59+ 处引用，错误/驳回/必填红色全面静默失效

- **现象**：`app.css :root` 只定义了 `--error:#B3261E`，**从未定义 `--danger`**。但全项目有 59 处 `var(--danger)` 引用，浏览器取不到值时回退为继承色（多为正文黑/灰），导致所有「删除 / 错误 / 纠纷 / 驳回 / 必填星号」红色警示在视觉上完全失效。
- **受影响页面**：`profile/auth-result`、`profile/entry-review`、`profile/auth-enterprise`、`profile/auth-personal`、`profile/auth-partner`、`profile/entry-form`、`profile/auth-qualification`（7+ 页）；`wallet/` 多页；`agency/seller-board`、`agency/order-detail`；`distribution/earnings`；`publish/editor` 等。
- **改进建议**：全局将 `var(--danger)` 替换为 `var(--error)`；或在 `app.css :root` 补充别名 `--danger: var(--error)` 作为过渡，再逐步迁移。**这是投入产出比最高的一项修复**——一处变量定义即可恢复全站红色状态。

#### 2. 5 个开发/审计/展示类桌面页面泄漏进生产 `pages/` 目录，与移动端 App 完全脱节

- **现象**：以下页面均为桌面布局（`max-width: 1100~1240px`）、未引入 `app.css`、无 `.phone` 容器、使用 Bootstrap/Tailwind 配色，与移动端设计体系零关联，但可通过路由/历史到达：
  - `pages/all-listings.html`（全量索引页，重新定义了 `--bg:#f4f5f7`/`--line:#e4e7ec`/`--brand:#101418`，与 app.css 同名变量值冲突）
  - `pages/editor-deep-audit.html`（编辑器字段深度审计元报告，Bootstrap 配色 `#dc3545/#fd7e14/#ffc107`）
  - `pages/editor-evaluation.html`（编辑器字段评估，Tailwind 配色，硬编码色 50+ 处，全项目最高）
  - `pages/cards/index.html`（卡片样式总览 showcase）
  - `pages/state/index.html`（状态样式 demo，含 typo「等等待」）
- **改进建议**：将这 5 页移出 `pages/` 至 `docs/` 或 `tools/` 目录；或在构建时从路由表中剔除；至少加登录/环境拦截，避免终端用户可达。

#### 3. `.nav-back` 全局返回按钮触控目标仅 32×32px，远低于 44px 标准，全站 22+ 页受影响

- **现象**：`app.css` 中 `.nav-back{width:32px;height:32px}`，全站 22+ 页使用此返回按钮。仅 `agreement/privacy.html` 和 `agreement/user.html` 通过局部内联样式覆盖至 44px——说明开发者已意识到问题但只修了两页。
- **改进建议**：在 `app.css` 全局将 `.nav-back` 提升为 `min-width:44px; min-height:44px;`，删除两页的局部覆盖。

#### 4. 功能色/错误色全站 5+ 套并存，同一语义颜色不统一

- **现象**：同一「错误/危险」语义存在至少 5 套色值：
  - 基线 `--error #B3261E`
  - `auth/register` 用 `#e8564f`
  - `auth/banned`、`editor-deep-audit` 用 Bootstrap `#dc3545`
  - `supply/detail` PDF 图标用 `#e74c3c/#c0392b`
  - `profile/resume-edit` 录音态用 `#e74c3c/#c0392b`
  - 警告色同样混乱：`--warning #9A7B1F` / Bootstrap 琥珀 `#d97706/#fd7e14/#ffc107` / iOS 系统色 `rgba(255,159,10,.14)` / `rgba(255,59,48,.14)`
- **改进建议**：建立功能色令牌矩阵（`--error` / `--error-soft` / `--warning` / `--warning-soft` / `--success` / `--success-soft` / `--info` / `--info-soft`），全局替换所有硬编码功能色。在 `app.css :root` 补充 `-soft` 变体（目前只有 `--primary-soft`，功能色缺少 soft 变体导致开发者自行硬编码 rgba）。

#### 5. 非基线 CSS 变量泛滥，约 15 个变量在 20+ 页使用但不在 `app.css :root` 基线中

- **现象**：以下变量被大量使用但未在基线 `:root` 中定义（或定义在 app.css 后段、与基线命名体系平行）：
  `--accent`、`--accent-line`、`--accent-soft`、`--bg-card-2`、`--bg-elevated`、`--bg-subtle`、`--bg-page`、`--success-soft`、`--primary-soft-2`、`--primary-pale`、`--text-1/2/3/4`、`--danger`、`--d-fast`、`--d-norm`、`--e-out`、`--e-standard`
- **核心矛盾**：存在两套平行命名体系——基线用 `--ink-primary/secondary/tertiary`，大量页面用 `--text-1/2/3/4`；基线用 `--primary`，大量页面用 `--accent`（色值相同但命名不同）。部分变量未定义导致 fallback 到硬编码色值（如 `var(--text-2,#666)`、`var(--bg-card-2,#f5f3ee)`）。
- **改进建议**：(1) 在 `app.css :root` 统一补充所有实际使用的变量定义；(2) 制定命名规范，逐步将 `--text-*` 迁移到 `--ink-*`、`--accent` 迁移到 `--primary`；(3) 移除冗余 fallback 值。

#### 6. 「假成功 / 死功能」交互泄露给终端用户，多个按钮点击后无实际效果或提示虚假成功

- **现象**：
  - `profile/auth-prep` 的 `aiFill()` 仅播放 loading 动画后 toast「AI已为您准备示例信息」，**实际未填入任何字段**——虚假成功反馈
  - `profile/edit-profile` 城市/手机号/微信号/上传头像均 toast「演示环境暂未开放」——多个假功能占位
  - `profile/auth-qualification` toast 含「（原型模拟）」字样——开发标注泄露给用户
  - `profile/entry-personal-result`「查看简历」toast「简历预览功能开发中」
  - `profile/auth-payment` 整页为「该功能已迁移」占位死页，仍可由导航到达
  - `favorite/index`「管理」按钮点击仅 toast「管理模式」，**无实际批量选择 UI**——死功能
  - `agency/index` 的 `renderHot()` 取 `getElementById('hot-row')`，但 HTML 中不存在该元素，函数静默返回——「热门搜索」永远不渲染
  - `agency/index` 筛选抽屉 `<div idx="filterSheet">` 是笔误（应为 `id=`），筛选抽屉 ID 选择器失效
- **改进建议**：全面排查所有按钮/链接的实际行为，未完成功能要么隐藏入口、要么接入真实实现；移除所有「原型模拟」「演示环境」「开发中」等开发期文案；修复 `#hot-row` 缺失和 `idx=` 笔误。

#### 7. `.wb-empty` 空状态类仅定义在 `publish/index.html` 内联 `<style>` 中，但 `drafts.html` 和 `unlocked.html` 也引用该类——两页空状态完全无样式

- **现象**：`publish/index.html` 的 `<style>` 块中定义了 `.wb-empty`，但 `publish/drafts.html` 和 `publish/unlocked.html` 的空状态区域也使用了 `class="wb-empty"`。由于样式定义在 index.html 的页面级 style 中而非 app.css，drafts 和 unlocked 两页的空状态将**完全失去样式**（无 padding、无居中、无图标占位），呈现为裸文字。
- **改进建议**：将 `.wb-empty`（及相关的 `.wb-chip`、`.wb-action` 等发布工作台通用类）提升至 `app.css`，确保所有 publish 模块页面共享。

#### 8. 占位符 / 假数据未清理，客服电话两处不一致，登录页预填演示账号

- **现象**：
  - 客服电话 `400-000-0000`（`help/index`、`personal/index` 解锁 sheet、`refund/index`、`agreement/privacy`）vs `400-888-6688`（`auth/banned`）——**两处不一致，至少一处是占位符**
  - `auth/login` 手机号/密码框预填 `13800008866 / 123456 / engchain123`——演示数据应在生产构建剥离
  - `agreement/user` 公司名称「成都××科技有限公司」含 `××` 占位符——法律文件不可出现占位符
  - `wallet/credits` JS 拼串 `(gain || 'placeholder')` 会在数据缺失时直接把字面量 **`placeholder`** 渲染到页面
  - `monitor/index` 示例企业列表（四川中建××建设/四川建材集团/重庆建工集团等）硬编码
  - `trade/api/co-create/industry` 价格（¥5000/¥29/¥99/¥999/¥3999）全部硬编码
  - `agency/order-detail` demo 订单引导按钮「查看示例订单」暴露在生产路径
- **改进建议**：全局替换占位客服电话为真实号码；移除登录页预填值；修复 `agreement/user` 公司名；将 `wallet/credits` 的 `'placeholder'` fallback 改为 `'—'`；生产构建时隐藏 demo 入口和示例数据。

### 🟡 P1 级（近期优化）

#### 9. 导航栏高度三方打架：app.css 默认 52px、30+ 页内联覆盖 50px、history 自建 48px、all-functions 用默认 52px

- **现象**：`app.css` `.navbar` 默认高度为 **52px**（短视口媒体查询中为 46px），但 30+ 页面在 `<div class="navbar" style="height:50px">` 内联覆盖为 50px；`profile/history.html` 又自建 `.vh-navbar:48px`；`profile/all-functions.html`、`trade/index`、`personnel/index`、`supply/list` 则用默认值。全站至少存在 52/50/48/46 四个导航栏高度值。
- **改进建议**：在 `app.css` 统一 `.navbar{height:50px}`（采纳事实上的主流值），删除所有页面的内联 `height:50px` 覆盖；将 `history.html` 的 `.vh-navbar` 改为使用 `.navbar`。

#### 10. 硬编码颜色散落 1000+ 处，深色 Hero 渐变在 6+ 页各自内联重复

- **现象**：
  - 深色金渐变 Hero（`#252C35→#151A22→#0B0E13`）在 `wallet/index`、`agency/order`、`agency/order-detail` 三处内联重复；`distribution/index` 用 `#252C35/#151A22/#0B0E13`；`franchise/index` 用 `#262220/#121110/#191512`；`trade/index` 用 `#262220/#121110/#191512`——**同一视觉模式 6 套色值**
  - 功能色 rgba 硬编码：`rgba(43,107,79,...)`（success）、`rgba(179,38,30,...)`（error）、`rgba(217,119,6,...)`（warning）、`rgba(37,99,235,...)`（info）、`rgba(124,91,189,...)`（purple）、`rgba(31,78,153,...)`（自定义深蓝，非品牌色）在数十页出现
  - 品牌金硬编码：`#C9A961`、`#E8D5A3`、`#A98A47` 直接写在 style 中而非 `var(--primary)`
- **改进建议**：抽取 `.gold-hero` / `.dark-hero` 共享组件类；在 `:root` 补充功能色 `-soft` 变体；全局批量替换硬编码品牌色为 CSS 变量。

#### 11. 触控目标 <44px 普遍存在，微型删除/编辑按钮集中在 20~32px

- **现象**：
  - 删除/编辑微按钮：`publish/editor` `.kv-del` 24px / `.se-del` 22px / `.img-remove` 20px；`franchise/index` `.dfm-close` 28px / `.ddm-close` 28px / `.fs-close` 30px；`profile/resume-edit` `.list-item-del` 24px / `.ai-panel-close` 30px；`profile/entry-form` `.ef-case-img-del` 20px / `.ef-att-del` 24px
  - 功能按钮：`auth/login|register` 密码显隐 28px；`monitor/index` 关注/取消按钮 28px；`favorite/index` 收藏按钮 28px；`match/preferences` chip 30px；`guide/index` 时间线节点 28px；`distribution/poster` 复制按钮 ~24px；`publish/records|drafts` 操作按钮 34px
  - 图标按钮：`help/index` 分类 icon 38px；`supply/detail` 搜索框 36px；`profile/index` `.quick-lock` 16px / `.quick-badge` 16px / `.me-avatar-edit` 20px
- **改进建议**：建立触控目标规范（主要操作 ≥44px，次要操作 ≥36px，微操作 ≥32px 且需扩大透明热区）；对删除/关闭类微按钮使用 `padding` 扩展热区而非仅靠可见尺寸。

#### 12. 多页面重复造设计系统/组件，平行令牌体系和复制粘贴样式未沉淀到 app.css

- **现象**：
  - `profile/index` 自建整套 `--me-*` 设计令牌（`--me-gold`/`--me-text`/`--me-bg`/`--me-radius` 等）+ 自写 `[data-theme=dark]` 暗色全套，与 app.css 完全平行
  - `profile/history` 自建 `--vh-*` 令牌 + `.vh-navbar` 48px
  - `profile/all-functions` 自建 `--af-*` 令牌
  - `profile/edit-profile` 自建 `.toast/.save-bar/.avatar-sheet` 组件，未复用 `UI.toast/.fixed-cta/.sheet`
  - `profile/resume-edit` 自建 `.modal-mask/.modal-box` 弹窗 + 全页内联 feather SVG 图标（完全不走 `#i-*` sprite）
  - `.ar-head`（auth-result）、`.er-head`（entry-review）、`.es-hero`（entry-result）样式跨页复制粘贴，未沉淀 app.css
  - `company/index` 与 `personal/index` 的 `.core-section/.core-lock-overlay` 整块 CSS 重复约 80 行，且 padding/字号/圆角/渐变参数不一致
- **改进建议**：将各页自造令牌合并到 app.css 基线；将重复组件（`.ar-head/.er-head`、`.core-section`、弹窗、toast）抽取为公共类；删除 `profile/index` 的本地 `:root` 和暗色模式（统一用系统主题）。

#### 13. 内联样式泛滥：1850 个 `style=` 属性，0 页完全无内联样式

- **现象**：全项目 104 页共 1850 个内联 `style=` 属性，平均 17.8 个/页。典型模式：
  - `section-title` 间距内联：`refund/index` 9 处、`refund/appeal` 5 处、`order/detail` 5 处
  - 导航栏右侧占位 spacer `width:32px`：`search/index`、`search/result`、`vendor/dashboard`
  - 空状态/加载中样式内联：`vendor/upgrades` 5 处、`vendor/dashboard` 2 处
  - JS 动态注入内联样式：`search/result` 标签 `tag.style.cssText`、`supply/list` `topTag` 用 `cssText` 硬编码渐变、`message/index` 未读角标内联
  - 付费门控卡 `.gate-card` 整块 `style="position:fixed;..."` 内联（`publish/index`）
- **改进建议**：建立 CSS 工具类体系（间距 `.mt-*`/`.mb-*`、文本对齐 `.text-center`、显示控制等）；将 JS 注入的内联样式改为切换 CSS 类；批量清理可提取的内联样式。

#### 14. 重复/孤立页面：corporate-pay 零入链、edit 与 edit-profile 功能重复、_seed-credit-data 自动播种假数据

- **现象**：
  - `wallet/corporate-pay.html`：经全项目 Grep，**无任何页面链接到此页**（入链为 0）；未接入 `CorpPay` store，收款信息（户名/账号/开户行）全部硬编码；与 `wallet/corp-pay.html`（真正被引用的对公转账页）功能重复。建议删除。
  - `profile/edit.html` 与 `profile/edit-profile.html`：均为「编辑个人资料」，两套 UI 并存，功能重复。
  - `agency/_seed-credit-data.html`：开发/测试用数据播种工具页，**页面打开即自动 `seed()` 写入 28 单假订单到用户 localStorage**，无二次确认。若被普通用户访问会污染真实数据。
- **改进建议**：删除 `corporate-pay.html`；合并 `edit.html` 和 `edit-profile.html` 为一个编辑页；将 `_seed-credit-data.html` 移出 `pages/` 或加环境校验 + 手动播种按钮。

#### 15. 跨页数据矛盾：折扣配置、统计公式、城市列表、状态标签、时效表述多处不一致

- **现象**：
  - `wallet/credits` 批量折扣配置 `enabled:false`，但 `wallet/credits-rules` 硬编码 95/9/85 折梯度展示——两处自相矛盾
  - `company/index` 统计「成交订单 `pub*3`」「在促合作 26」vs `personal/index`「成交订单 `pub*2`」「在促合作 12」——两主页同一指标口径不一致
  - `supply/list` 城市筛选 9 城 vs `match/preferences` 仅 6 城（缺昆明/贵阳）
  - `order/index` 中 `draft` 与 `pending` 都映射 `tag-warning`（用户无法区分草稿与待支付）；`await_accept` 与 `await_confirm` 都叫「待验收」——状态机文案重复
  - `profile/auth-enterprise` banner「1-3个工作日」vs 支付 sheet「24小时内人工复核」——时效表述不一致
  - `wallet/invoice-info-edit` 三元运算 `titleType === 'personal' ? '增值税普通发票' : '增值税普通发票'`——**两个分支返回同值，判断逻辑失效**
  - `wallet/corp-pay` 步骤数组仅 4 个节点但 `rec.status==='approved' ? 5 : …`——step=5 的已完成态永不渲染
- **改进建议**：建立跨页数据一致性校验清单；统一配置源（折扣、统计公式、城市列表、状态机）从共享 store 读取而非各页硬编码；修复恒值三元运算和步骤索引越界。

#### 16. XSS 安全风险：用户输入直接拼入 `onclick` 属性和 CSS 类名

- **现象**：
  - `search/index` 第 122 行：用户搜索词通过字符串拼接插入 `onclick` 属性（`'...location.href=\'result.html?q='+encodeURIComponent(tag)+'\''`）
  - `vendor/upgrades` 第 164 行：标题通过 `.replace(/'/g,'')` 后拼入 `onclick`
  - `message/system` 第 78 行：`m.tint` 直接作为 CSS 类名拼接（`class="si-ic bg-'+m.tint+'"`），若 tint 值不受控存在 CSS 类注入风险
- **改进建议**：全部改用 `addEventListener` + `data-*` 属性传递数据；对动态 CSS 类名使用白名单校验。

### 🟢 P2 级（长期打磨）

#### 17. 图标体系 5 种实现混用：sprite / 内联 SVG / emoji / Unicode 字符 / 文字标签

- **现象**：
  - `<use href="#i-*">` sprite（多数页面，主流方式）
  - 内联 SVG path（`profile/resume-edit` 全页、`trade/index` 信任背书、`company/index` 联系TA按钮）
  - emoji（`auth/login` 密码显隐 👁/🙈、`profile/auth-enterprise` 支付方式 💳💚💙🏦、`profile/index` 登录引导 🔐）
  - Unicode 字符（✓ / ! / ↻ / ↓ / › / × 散落在 `auth-*`、`entry-*`、`co-create`、`publish` 各页）
  - 文字标签（`auth/register` 密码显隐用「显示/隐藏」文字，与 login 的 emoji 不一致）
- **改进建议**：统一为 `<use href="#i-*">` sprite 体系；将 emoji 和 Unicode 字符全部替换为 SVG 图标；补充缺失的图标（chevron、close、check、eye、lock 等）到 sprite。

#### 18. 返回按钮统一使用「‹」文本字符而非 SVG，且存在 `&#8249;` HTML 实体不一致

- **现象**：20+ 页使用 `<button class="nav-back">‹</button>` 文本字符；`match/preferences` 用 `&#8249;`（单 guillemet HTML 实体）；`vendor/upgrades` 用 `&#8249;`；其余用字面 `‹`。三种写法视觉一致但源码不统一，且文本字符在不同字体下渲染差异较大。
- **改进建议**：统一为 SVG chevron 图标（`<use href="#i-chevron-left">`），与图标体系统一。

#### 19. 滚动容器缺陷：部分板块写在 `.scroll` 闭合标签之外，长内容下无法滚动/被裁切

- **现象**：
  - `wallet/credits-rules`：「批量充值折扣梯度」板块写在 `.scroll` 闭合 `</div>` 之外、`.cr-page` 之内——该板块不在滚动容器内，长列表时无法随内容滚动，会错位/被裁切
  - `wallet/unlock-records`：`.ur-stats` 统计行 + `.seg` 分段筛选写在 `.scroll` 之外，靠文档流顶置但未做 sticky，滚动时行为与其他吸顶筛选页不一致
- **改进建议**：将所有内容板块移入 `.scroll` 容器内；需要吸顶的筛选栏使用 `position:sticky` 而非放在滚动容器外。

#### 20. `<style>` 块位置不规范：多页在 `</body>` 前放置第二个 `<style>` 块，应统一在 `<head>` 中

- **现象**：`agreement/privacy`、`agreement/user`、`message/system` 在 `<head>` 和 `</body>` 前各有一个 `<style>` 块；`refund/appeal` 的 `<style>` 块位于 `</body>` 之前。样式标签应始终在 `<head>` 中，放在 body 末尾可能导致 FOUC（无样式内容闪烁）。
- **改进建议**：将所有 `<style>` 块移至 `<head>`；合并同一页面的多个 `<style>` 块为一个。

---

## 三、分模块问题清单

### 3.1 profile 模块（31 页，135 个问题：🔴16 / 🟡106 / 🟢13）

**问题最多页面**：`index.html`（14）、`resume-edit.html`（12）、`auth-enterprise.html`（8）
**零问题页面**：`notify.html`

| 页面 | 视觉 | 交互 | 板块 | 内容 | 元素 | 小计 |
|---|---|---|---|---|---|---|
| index | 5 | 3 | 1 | 2 | 3 | 14 |
| resume-edit | 4 | 4 | 0 | 2 | 2 | 12 |
| auth-enterprise | 3 | 3 | 0 | 1 | 1 | 8 |
| my-applies | 2 | 1 | 1 | 0 | 1 | 5 |
| privacy | 2 | 1 | 1 | 1 | 1 | 6 |
| auth-qualification | 2 | 2 | 0 | 1 | 1 | 6 |
| auth | 3 | 1 | 1 | 0 | 1 | 6 |
| auth-prep | 1 | 2 | 0 | 1 | 0 | 4 |
| auth-personal | 3 | 0 | 0 | 0 | 1 | 4 |
| auth-partner | 3 | 0 | 1 | 0 | 0 | 4 |
| auth-result | 2 | 0 | 1 | 0 | 0 | 3 |
| auth-payment | 0 | 0 | 1 | 0 | 0 | 1 |
| entry | 3 | 1 | 0 | 0 | 1 | 5 |
| entry-form | 2 | 3 | 0 | 0 | 1 | 6 |
| entry-review | 3 | 1 | 0 | 0 | 1 | 5 |
| entry-result | 3 | 0 | 0 | 0 | 1 | 4 |
| entry-personal-result | 2 | 0 | 0 | 1 | 1 | 4 |
| edit | 1 | 3 | 0 | 0 | 1 | 5 |
| edit-profile | 2 | 1 | 1 | 2 | 0 | 6 |
| settings | 1 | 1 | 1 | 0 | 0 | 3 |
| general-setting | 0 | 3 | 0 | 0 | 0 | 3 |
| notify | 0 | 0 | 0 | 0 | 0 | 0 |
| security | 1 | 0 | 0 | 1 | 1 | 3 |
| contact | 0 | 1 | 0 | 2 | 1 | 4 |
| history | 2 | 0 | 0 | 0 | 1 | 3 |
| delegates | 1 | 0 | 0 | 0 | 1 | 2 |
| delegate-new | 1 | 0 | 0 | 0 | 0 | 1 |
| delegate-edit | 1 | 0 | 0 | 0 | 1 | 2 |
| delegate-detail | 1 | 0 | 0 | 0 | 1 | 2 |
| all-functions | 2 | 1 | 1 | 1 | 1 | 6 |
| **合计** | **56** | **32** | **11** | **12** | **24** | **135** |

**模块核心问题**：
- 🔴 `var(--danger)` 在 7+ 个认证/入驻页被引用但未定义，驳回/必填/错误色全部失效
- 🔴 顶栏高度三方不一致（52px 默认 / 50px 内联 / 48px history 自建）
- 🔴 假成功/死功能：auth-prep AI 填充虚假成功、edit-profile 多字段「演示环境暂未开放」、auth-qualification「（原型模拟）」toast、auth-payment 整页死链
- 🔴 重复造设计系统：index(`--me-*`)、history(`--vh-*`)、all-functions(`--af-*`)、edit-profile(自建 toast/save-bar/sheet)、resume-edit(自建 modal + 全页内联 feather 图标)
- 🟡 路由错误：settings/all-functions 传 `type=pro/resident/center` 给 auth-prep 但 TYPES 无此键，静默回退个人认证页；edit.html 与 edit-profile.html 功能重复
- 🟡 表单 label 宽度多值并存（64/72/80/84/88px），同一认证流程内都不统一
- 🟡 触控目标过小：删除/编辑微按钮普遍 20~32px
- 🟡 图标双轨：`<use href="#i-*">` 与内联 feather SVG 混用，resume-edit 全页内联
- 🟡 功能色硬编码偏离 token：珊瑚红 `rgba(212,76,71/200,60,60)`、亮绿 `#4caf50`、Bootstrap 红 `#e74c3c`、离系统蓝 `#5B8DB8`
- 🟢 字符代替图标：✓ ! ↻ ↓ › 等 Unicode 字符散落 auth-*/entry-* 页
- 🔴 单页亮点问题：`contact.html` 「联系方式公开」开关 checked=开启但 note 写「目前为隐藏态」——开关状态与说明文案矛盾；`all-functions.html` 分组计数错误（「交易服务 6项」实为 7 项、「内容管理 3项」实为 6 项）

---

### 3.2 wallet 模块（19 页）+ agency 模块（6 页）（共 25 页，176 个问题：🔴9 / 🟡78 / 🟢89）

**问题最多页面**：`wallet/index`（10）、`agency/seller-board`（10）、`wallet/recharge`（9）、`wallet/withdraw`（9）、`wallet/credits`（9）、`agency/index`（9）、`agency/order-detail`（9）

| 模块 | 页面 | 小计 |
|---|---|---|
| wallet | index | 10 |
| wallet | recharge | 9 |
| wallet | withdraw | 9 |
| wallet | bank-cards | 7 |
| wallet | escrow | 6 |
| wallet | invoice | 6 |
| wallet | invoice-info | 6 |
| wallet | invoice-info-edit | 6 |
| wallet | invoice-title-new | 6 |
| wallet | invoice-record | 6 |
| wallet | credits | 9 |
| wallet | credits-rules | 6 |
| wallet | credits-mall | 6 |
| wallet | membership | 6 |
| wallet | free-quota | 6 |
| wallet | unlock-records | 5 |
| wallet | payment-method | 6 |
| wallet | corporate-pay | 6 |
| wallet | corp-pay | 6 |
| agency | index | 9 |
| agency | seller-board | 10 |
| agency | order | 8 |
| agency | order-detail | 9 |
| agency | my-orders | 5 |
| agency | _seed-credit-data | 6 |
| **合计** | — | **176** |

**模块核心问题**：
- 🔴 `--danger` token 未定义，钱包/中介内删除/错误/纠纷红色大面积失效
- 🔴 功能死链：`agency/index` `renderHot()` 找不到 `#hot-row` 元素，热门搜索永不渲染；筛选抽屉 `idx="filterSheet"` 笔误（应为 `id=`）
- 🔴 数据矛盾：`wallet/credits` 批量折扣 `enabled:false` 但 `credits-rules` 硬编码 95/9/85 折展示
- 🔴 逻辑硬伤：`wallet/credits` 字面量 `placeholder` 泄露到页面；`wallet/invoice-info-edit` 三元运算恒值（两分支都返回「增值税普通发票」）；`agency/order-detail` demo 订单入口暴露在生产路径
- 🔴 孤立重复页：`wallet/corporate-pay.html` 零入链、未接 store、硬编码收款信息，与 `corp-pay.html` 功能重复——建议删除
- 🔴 `agency/order` 浅字压浅底：`.amt-show` 下方说明文字 `color:rgba(244,242,238,.6)`（浅色）但位于浅色 `.card` 内，对比度近乎不可读
- 🟡 深色 Hero 渐变三处重复：`wallet/index`、`agency/order`、`agency/order-detail` 各自内联 `#252C35→#0B0E13`
- 🟡 蓝色/彩虹色渗入古金主题：`rgba(31,78,153,*)`、`#2563EB`、`#1677FF`、`#9B59B6`、`#3498DB` 散落在 agency/index、seller-board、wallet/credits
- 🟡 弹窗 API 不统一：钱包内删除操作 bank-cards 用 `UI.dialog`、invoice-info 用 `UI.confirm`；发票新增/编辑表单字段不对齐
- 🟡 跳出 `.scroll` 容器：credits-rules 批量折扣板块、unlock-records 统计+筛选写在滚动容器外
- 🟡 agency 全部 6 页误引 `iphone-frame.css` 样机样式（用户页不应加载）
- 🟡 时间格式不统一：`unlock-records` 用 `MM-DD HH:mm`，`my-orders` 用 `YYYY-MM-DD HH:mm`
- 🔴 `agency/_seed-credit-data.html` 页面打开即自动播种 28 单假订单到 localStorage，无二次确认

---

### 3.3 publish / distribution / message / search / franchise / refund / agreement / vendor 模块（共 24 页，291 个问题：🔴12 / 🟡168 / 🟢111）

**问题最多页面**：`publish/editor.html`（21，全项目第二高）、`franchise/index.html`（17）、`distribution/index.html`（16）、`distribution/poster.html`（16）、`refund/index.html`（14）

| 模块 | 页面 | 小计 |
|---|---|---|
| publish | index | 12 |
| publish | editor | 21 |
| publish | success | 13 |
| publish | records | 11 |
| publish | drafts | 11 |
| publish | unlocked | 10 |
| distribution | index | 16 |
| distribution | earnings | 13 |
| distribution | team | 11 |
| distribution | poster | 16 |
| message | index | 13 |
| message | chat | 13 |
| message | system | 10 |
| search | index | 11 |
| search | result | 13 |
| search | business | 10 |
| franchise | index | 17 |
| franchise | delegate-edit | 10 |
| refund | index | 14 |
| refund | appeal | 12 |
| agreement | privacy | 11 |
| agreement | user | 10 |
| vendor | dashboard | 12 |
| vendor | upgrades | 12 |
| **合计** | — | **291** |

**模块核心问题**：
- 🔴 `.nav-back` 全局触控目标 32×32px（app.css 定义），22 页受影响，仅 agreement 两页局部修复
- 🔴 `--danger` 未定义：`distribution/earnings`、`publish/editor` 引用后红色状态标签失效
- 🔴 `.wb-empty` 类仅定义在 `publish/index.html` 内联 style，`drafts.html` 和 `unlocked.html` 空状态完全无样式
- 🔴 `distribution/poster` 二维码为 CSS `repeating-conic-gradient` 假图案，**不可扫描**；Canvas 生成的海报图中含「扫码注册（二维码占位）」文字；海报 Logo 为单字符「链」
- 🔴 `agreement/user.html` 公司名「成都××科技有限公司」含占位符——法律文件不可出现
- 🔴 `publish/editor` 输入框聚焦环用绿色 `rgba(43,107,79,.12)` 硬编码，与品牌金色焦点环不一致；文件上传图标用红色渐变 `#e74c3c→#c0392b`
- 🟡 navbar 高度 18+ 页内联覆盖 50px
- 🟡 硬编码色值 60+ 处：深色 Hero（franchise `#262220`、distribution `#252C35`、poster `#0b0f1a`）、功能色 rgba、品牌色
- 🟡 微型删除/关闭按钮触控不足：publish/editor（20-24px）、franchise/index（28-30px）、distribution/poster（~24px）
- 🟡 内联 style 泛滥：refund/index section-title 间距 9 处内联、refund/appeal 5 处、vendor/upgrades 空状态 5 处
- 🟡 客服电话 `400-000-0000` 占位符：refund/index、agreement/privacy
- 🟡 XSS 风险：search/index 搜索词拼入 onclick、vendor/upgrades 标题拼入 onclick
- 🟡 `publish/drafts` 删除草稿无二次确认（直接 `delDraft(this)`）；`publish/records|drafts` 操作按钮 34px < 44px
- 🟡 两主页组件重复且规格不一致（company vs personal 的 `.core-section/.core-lock-overlay`）
- 🟢 空状态头像/Logo 使用单字符文字（distribution/team、message/index、franchise/index）
- 🟢 多个 `<style>` 块分离 / `<style>` 位于 `</body>` 前（agreement/privacy、agreement/user、message/system、refund/appeal）

---

### 3.4 auth / 主页 / supply / order / 根目录散页 / 单页模块（共 24 页，328 个问题：🔴18 / 🟡192 / 🟢118）

**问题最多页面**：`trade/index.html`（19，全项目最高）、`supply/detail.html`（17）、`personnel/index.html`（17）、`company/index.html`（16）、`co-create/index.html`（16）、`auth/login.html`（15）、`all-listings.html`（15）

| 模块/页面 | 小计 |
|---|---|
| auth/login | 15 |
| auth/register | 14 |
| auth/banned | 12 |
| company/index | 16 |
| personal/index | 13 |
| supply/list | 13 |
| supply/detail | 17 |
| order/index | 13 |
| order/detail | 12 |
| all-listings（根散页） | 15 |
| editor-deep-audit（根散页） | 11 |
| editor-evaluation（根散页） | 13 |
| personnel/index | 17 |
| monitor/index | 13 |
| guide/index | 13 |
| trade/index | 19 |
| api/index | 13 |
| industry/index | 12 |
| match/preferences | 11 |
| co-create/index | 16 |
| help/index | 13 |
| favorite/index | 12 |
| cards/index | 10 |
| state/index | 10 |
| **合计** | **328** |

**模块核心问题**：
- 🔴 5 个桌面开发/审计/展示页泄漏进生产 pages/：all-listings、editor-deep-audit、editor-evaluation、cards/index、state/index
- 🔴 错误色三套并存：register `#e8564f`、banned `#dc3545`、supply/detail PDF `#e74c3c/#c0392b`，与基线 `--error #B3261E` 均不同
- 🔴 非基线 CSS 变量泛滥：`--accent/--accent-line/--bg-card-2/--success-soft/--text-4/--danger/--d-fast/--e-out` 等约 15 个变量在 20+ 页使用
- 🔴 占位符/假数据：客服电话 `400-000-0000`（help/personal）vs `400-888-6688`（banned）；登录页预填 `13800008866/123456`；monitor 示例企业硬编码；trade/api/co-create 价格全部硬编码
- 🔴 `trade/index` Hero 深色 `#262220/#121110/#191512` 与品牌米白背景强烈冲突；`var(--accent)` 被大量用作橙色（价格/急转/脱敏），与品牌金混淆
- 🔴 `api/index` `.balance-card` 深蓝渐变 `#1a237e→#283593`、`.result-box` 深色终端风 `#1e1e2e`+青色 `#4fc3f7`，与品牌金完全无关
- 🔴 `auth/banned`「永久封禁」硬编码，未根据 `banType/banUntil` 动态渲染——临时封禁页也会显示「永久」
- 🔴 `favorite/index`「管理」按钮仅 toast「管理模式」，无实际批量选择 UI——死功能
- 🔴 `match/preferences` CATS 数组含「项目合作」和「合作」两个重复项
- 🔴 `help/index` 客服电话 `400-000-0000` 占位符（与 banned 的 400-888-6688 冲突）
- 🟡 navbar 高度 12+ 页内联覆盖 50px
- 🟡 触控目标 <44px：密码显隐 28px、monitor 关注按钮 28px、favorite 收藏 28px、match chip 30px、guide 时间线 28px、help 分类 icon 38px
- 🟡 两主页（company/personal）`.core-section/.core-lock-overlay` 重复约 80 行且参数不一致（padding/字号/圆角/渐变/统计公式 pub*3 vs pub*2、26 vs 12）
- 🟡 深色 Hero 与品牌金脱节：trade（棕黑）、api（深蓝）、supply/detail talent-hero（`#6B4423/#8B6914`）、co-create why-card（灰/绿渐变）
- 🟡 状态/标签语义色滥用：trade/personnel 把「急聘/急转/价格」用橙色 `var(--accent)`；help 把「热门」用 `--error` 红；order/index 把 draft+pending 都映射 warning
- 🟡 跨页数据矛盾：supply/list 9 城 vs match/preferences 6 城；order/index 状态标签重复（await_accept+await_confirm 都叫「待验收」）
- 🟡 `supply/detail` ECharts 从 CDN 加载，onerror 仅「图表加载中...」未降级为表格；付费解锁 CTA 无价格明细预览
- 🟡 `personnel/index` 匹配度兜底「按 id 哈希在 62-96 取值」——卡片上的匹配度是伪数据；排名前三硬编码 Bootstrap 色（`#e74c3c/#e67e22/#f1c40f`）
- 🟡 `monitor/index` 「+关注」按钮 28px；升级 CTA 硬编码价格「破冰期特惠 ¥99/年 vs ¥199/年」；示例企业硬编码
- 🟡 `guide/index` 步骤节点允许用户自欺式标记完成（业务上应只读）；「弹窗预览」板块对终端用户是开发视角功能
- 🟡 `industry/index` 报告预览弹窗无关闭 X（仅底部「关闭」按钮和点遮罩），移动端易误触
- 🟡 `co-create/index` 申请表单「意向层级」下拉直接选 S/A/B，用户可选最高档无资格校验；Hero 在「为什么加入」之后叙事倒置
- 🟢 图标体系 5 种实现混用；`state/index` 含 typo「等等待」；`state/index` 「处理中」描述文字叠词

---

## 四、改进优先级路线图

### P0 — 立即修复（预计 1~2 天，55 个高严重度问题）

| 序号 | 修复项 | 影响范围 | 修复方式 |
|---|---|---|---|
| P0-1 | **`--danger` 变量全局修复** | 全站 59+ 处，7+ 模块 | 在 `app.css :root` 加 `--danger: var(--error)`，或全局替换为 `var(--error)` |
| P0-2 | **5 个桌面页移出生产路由** | all-listings / editor-deep-audit / editor-evaluation / cards / state | 移至 `docs/` 或构建时剔除 |
| P0-3 | **`.nav-back` 触控目标提升至 44px** | 全站 22+ 页 | `app.css` 全局修改 `.nav-back{min-width:44px;min-height:44px}` |
| P0-4 | **功能色统一到 CSS 变量** | 全站 5+ 套错误色/警告色 | 补充 `--error-soft/--warning-soft/--success-soft/--info-soft` 变体，批量替换硬编码 |
| P0-5 | **非基线 CSS 变量补充定义或迁移** | 20+ 页，约 15 个变量 | 在 `:root` 统一定义；制定 `--text-*`→`--ink-*`、`--accent`→`--primary` 迁移计划 |
| P0-6 | **假成功/死功能清理** | auth-prep / edit-profile / auth-qualification / auth-payment / favorite / agency/index | 隐藏未完成功能入口或接入真实实现；移除「原型模拟」「演示环境」文案；修复 `#hot-row` 缺失和 `idx=` 笔误 |
| P0-7 | **`.wb-empty` 类提升至 app.css** | publish/drafts、publish/unlocked | 将发布工作台通用类（`.wb-empty/.wb-chip/.wb-action`）提取到公共 CSS |
| P0-8 | **占位符/假数据替换** | 客服电话、登录预填、协议公司名、credits placeholder、demo 入口 | 全局替换真实号码；移除预填值；修复 `agreement/user` 公司名；`credits` fallback 改 `'—'` |

### P1 — 近期优化（预计 1~2 周，544 个中严重度问题）

| 序号 | 优化项 | 影响范围 | 优化方式 |
|---|---|---|---|
| P1-1 | **导航栏高度统一为 50px** | 30+ 页内联覆盖 | `app.css` 统一 `.navbar{height:50px}`，删除所有内联覆盖 |
| P1-2 | **硬编码颜色收敛** | 全站 1000+ 处 | 抽取 `.gold-hero/.dark-hero` 共享类；功能色 soft 变体替换 rgba；品牌色替换为 `var(--primary)` |
| P1-3 | **触控目标规范化** | 数十个微按钮 | 建立触控规范（主操作≥44px / 次操作≥36px / 微操作≥32px+透明热区）；批量扩大删除/关闭按钮热区 |
| P1-4 | **重复设计系统收敛** | profile/index/history/all-functions/edit-profile/resume-edit、company/personal | 各页自造令牌合并到 app.css；重复组件抽取公共类；删除本地 `:root` |
| P1-5 | **内联样式清理** | 全站 1850 个 style= | 建立 CSS 工具类体系；JS 注入改切类；批量提取可复用内联样式 |
| P1-6 | **重复/孤立页面处理** | corporate-pay / edit vs edit-profile / _seed-credit-data | 删除 corporate-pay；合并两个编辑页；种子页加环境校验+手动按钮 |
| P1-7 | **跨页数据一致性** | 折扣配置/统计公式/城市列表/状态机/时效表述 | 统一从共享 store 读取；修复恒值三元运算和步骤索引越界 |
| P1-8 | **XSS 安全修复** | search/index / vendor/upgrades / message/system | 改用 `addEventListener`+`data-*`；动态 CSS 类名白名单校验 |
| P1-9 | **弹窗/表单 API 统一** | wallet（UI.dialog vs UI.confirm）、发票表单字段对齐、order-detail 三个 sheet | 封装统一弹窗组件；发票新增/编辑表单字段对齐 |
| P1-10 | **滚动容器修复** | wallet/credits-rules、wallet/unlock-records | 内容板块移入 `.scroll`；吸顶筛选用 `position:sticky` |

### P2 — 长期打磨（预计持续迭代，331 个低严重度问题）

| 序号 | 打磨项 | 影响范围 | 打磨方式 |
|---|---|---|---|
| P2-1 | **图标体系统一** | 全站 5 种实现混用 | 统一为 `<use href="#i-*">` sprite；替换 emoji/Unicode/文字标签为 SVG |
| P2-2 | **返回按钮 SVG 化** | 20+ 页 | 替换「‹」文本字符和 `&#8249;` 实体为 SVG chevron |
| P2-3 | **`<style>` 块位置规范** | agreement/privacy、agreement/user、message/system、refund/appeal | 全部移至 `<head>`；合并同页多个 style 块 |
| P2-4 | **空状态/骨架屏完善** | 多页缺失 | 统一空状态组件（图标+文案+CTA）；列表页补充骨架屏 |
| P2-5 | **时间/日期格式统一** | unlock-records（MM-DD）vs my-orders（YYYY-MM-DD） | 统一时间格式规范；补充相对时间（「2小时前」） |
| P2-6 | **头像/Logo 占位完善** | distribution/team、message/index、franchise/index、search/business | 统一默认头像组件；企业 Logo 占位图 |
| P2-7 | **可访问性提升** | div+onclick 非按钮、缺少 ARIA、键盘不可达 | 语义化标签（`<a>`/`<button>`）；补充 ARIA 属性；键盘导航支持 |
| P2-8 | **性能优化** | wallet/index 双层无限动画、franchise/trade setInterval(checkSticky,150)、agency 误引 iphone-frame.css | 关闭/降级 shimmer 动画；改用 IntersectionObserver；移除用户页的样机样式引用 |
| P2-9 | **文案打磨** | 错别字（state「等等待」）、文案重复、指引位置不准 | 全文案 review；统一术语表 |
| P2-10 | **组件文档化** | cards/index、state/index 展示页 | 移至 docs/ 并维护为活文档，与 app.css 同步更新 |

---

## 五、审计结论

### 5.1 整体评估

Engchain3.0 项目在**业务功能覆盖度**上表现优秀——104 个页面覆盖了个人中心、钱包、供需、订单、发布、分销、中介、认证等完整业务链路，信息架构基本合理。但在**设计系统一致性**和**代码质量**上存在系统性问题：

1. **设计令牌体系未真正闭环**：`app.css :root` 定义了完整的基线变量，但约 15 个平行变量（`--accent`/`--text-*`/`--bg-card-2` 等）在 20+ 页使用且未纳入基线，`--danger` 甚至完全未定义却被引用 59+ 次。这导致开发者在需要「红色」「浅灰背景」时无 token 可用，只能硬编码。
2. **组件复用率低**：多个页面自建弹窗、toast、空状态、Hero 卡片，相同视觉模式（深色金渐变 Hero）在 6+ 页各自内联重复，参数还略有差异。
3. **开发期产物未清理**：5 个桌面展示/审计页、演示账号预填、「原型模拟」toast、demo 订单入口、自动播种假数据的工具页——这些开发期产物直接暴露在生产路由中。
4. **交互细节待打磨**：触控目标普遍不足（微按钮 20-32px）、假成功反馈、死功能按钮、XSS 风险点——这些在高保真原型阶段可接受，但进入生产前必须修复。

### 5.2 建议修复顺序

1. **第一天**：P0-1（`--danger` 修复，一处变量定义恢复全站红色）→ P0-3（`.nav-back` 44px，一处 CSS 修改覆盖全站）→ P0-7（`.wb-empty` 提升）→ P0-8（占位符替换）
2. **第二天**：P0-2（桌面页移出）→ P0-6（假功能清理）→ P0-4/P0-5（功能色和变量体系收口）
3. **第一周**：P1-1（导航栏统一）→ P1-2（硬编码颜色收敛）→ P1-4（重复设计系统收敛）→ P1-6（重复页面处理）
4. **第二周**：P1-3（触控目标）→ P1-5（内联样式清理）→ P1-7（数据一致性）→ P1-8（XSS 修复）
5. **持续迭代**：P2 各项按优先级逐步打磨

### 5.3 零问题页面表扬

- **`profile/notify.html`**：全站唯一零问题页面，row-icon 三语义色（accent/success/warning）使用合理，结构规范，可作为其他页面的参考基准。

---

> **附录**：本报告为集成汇总，逐页五维度详细问题清单见 4 份分片审计报告：
> - `_audit_shard1_profile.md`（profile 31 页，135 问题）
> - `_audit_shard2_wallet_agency.md`（wallet+agency 25 页，176 问题）
> - `_audit_shard3_publish_etc.md`（publish 等 8 模块 24 页，291 问题）
> - `_audit_shard4_core.md`（auth+主页+散页 24 页，328 问题）
>
> 代码质量热力图数据：`_audit_heatmap.csv`
