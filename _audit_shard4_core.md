# Engchain3.0 全量 UI/UX 代码审计报告 · Shard 4（核心 24 页）

> 审计范围：auth/ 3 页 + 主页 2 页 + supply/ 2 页 + order/ 2 页 + 根目录散页 3 页 + 单页模块 12 页，共 24 页。
> 方法：纯代码读取（Read/Grep），对照 `css/app.css :root` 设计令牌基线逐项核对。
> 严重程度：🔴高（阻断/品牌级错误） / 🟡中（一致性/可用性问题） / 🟢低（细节打磨）。

---

## 一、auth/login.html

【页面路径】pages/auth/login.html
├── 视觉：5 个
│   ├── 🟡 `.auth-logo` 圆角硬编码 `border-radius:19px`，未使用 `var(--r-xl)`；建议改 `border-radius:var(--r-xl)`。
│   ├── 🟡 主色圆角/按钮多处内联硬编码 `rgba(201,169,97,.14/.28/.10)`（.auth-logo、.f-tabs 激活态、.cta），与 `--primary-soft rgba(201,169,97,.10)` 令牌不一致；建议统一引用 `var(--primary-soft)` 或新增 `--primary-line/--primary-border`。
│   ├── 🟡 文字色使用 `var(--text-inv)/--text-1/--text-2/--text-3`，与设计系统基线 `--ink-primary/--ink-secondary/--ink-tertiary/--ink-inverse` 命名不一致；需确认 app.css 是否同时定义了两套别名，否则此处变量未定义会 fallback 失败。
│   ├── 🟢 `.f-tabs` 下划线位移用新语法 `translate:-50%` 而非 `transform:translateX(-50%)`，旧 WebView 不识别；建议改 transform。
│   └── 🟢 密码显隐按钮 `👁/🙈` emoji 与全站 SVG sprite（`#i-lock` 等）图标体系不一致。
├── 交互：4 个
│   ├── 🟡 密码显隐按钮 `.pwd-toggle` 内联 `padding:8px 4px`，点击热区约 28×36px，低于 44px 触控标准；建议 padding 提到 `8px 12px` 或 min-width:44px。
│   ├── 🟡 登录表单无字段级错误提示（`.field-err` 样式在 register.html 已定义但 login 未用），错误统一只 toast，无法定位到具体字段。
│   ├── 🟡 无"忘记密码"入口；无第三方登录（微信/Apple）按钮，与"工程链 C 端"定位不符。
│   └── 🟢 手机号/密码框预填 `13800008866 / 123456 / engchain123`，演示数据应在生产构建剥离。
├── 板块：2 个
│   ├── 🟢 主 CTA 文案"登录 / 注册"模糊（同一按钮承担两个动作）；建议根据是否已注册状态切换文案。
│   └── 🟢 无"用户协议/隐私政策"勾选区（register 页有，login 登录后隐式同意，但文案缺失）。
├── 内容：2 个
│   ├── 🟢 副标题"工程链 · 让每一次对接都有据可依"与品牌语未在多处复用，需确认是否统一 slogan。
│   └── 🟢 验证码倒计时"重新发送(59s)"数字字体未用 `var(--font-num)`，数字宽度跳动。
└── 元素：2 个
    ├── 🟢 `.field` label 宽度未与 `--kv-label-w:84px` 对齐（用了 auto）。
    └── 🟢 SVG 图标 `#i-lock/#i-user` 通过 `<use href>` 引用，但本页未确认 sprite 注入时机，冷启动可能闪烁。

---

## 二、auth/register.html

【页面路径】pages/auth/register.html
├── 视觉：4 个
│   ├── 🔴 `.field-err` 兜底色 `#e8564f`（内联 `color:#e8564f`），与设计系统 `--error:#B3261E` 偏差大；同站 banned.html 又用 Bootstrap `#dc3545`，错误色三处三套。
│   ├── 🟡 navbar 内联 `style="height:50px;"`，与设计系统 `.navbar` 46px 基线冲突（全站 12+ 页都内联 50px，说明 46px 基线已被事实上推翻）。
│   ├── 🟡 使用 `--text-1/2/3` 命名（同 login），非基线 `--ink-*`。
│   └── 🟢 `.auth-logo` 与 login 完全重复的 19px 圆角硬编码块。
├── 交互：4 个
│   ├── 🟡 密码显隐按钮 `.pwd-toggle` 用文字"显示/隐藏"，而 login.html 用 emoji 图标，两入口页交互不一致。
│   ├── 🟡 `.pwd-toggle` padding `8px 4px`，触控高度约 28px < 44px。
│   ├── 🟡 "发送验证码"按钮倒计时逻辑存在，但未禁用重复点击期间的按钮状态（仅改文字）。
│   └── 🟢 "你的身份"区块仅一段说明文字，无身份选择控件，位置尴尬（在表单中部），应移至"立即注册"按钮前。
├── 板块：2 个
│   ├── 🟡 "邀请码（选填）"字段在最上方，而协议勾选在最下方，视觉层级倒置；建议把"邀请码"折叠到次要位置。
│   └── 🟢 与 login 页共享的顶部品牌区样式未抽公共类，两份 `<style>` 块重复。
├── 内容：2 个
│   ├── 🟡 协议文案"《用户协议》《隐私政策》"未做链接化（无 href 或 onclick），用户点击无反应。
│   └── 🟢 "注册即表示同意…"勾选框默认未勾选，但提交时仅 toast 提示，未高亮定位。
└── 元素：2 个
    ├── 🟢 验证码输入框无分隔/自动跳转下一格交互。
    └── 🟢 "获取验证码"按钮宽度固定，倒计时数字未等宽。

---

## 三、auth/banned.html

【页面路径】pages/auth/banned.html
├── 视觉：4 个
│   ├── 🔴 全站错误色第 3 套：图标/边框/标题全部硬编码 `#dc3545`（Bootstrap danger），背景 `rgba(220,53,69,.1)`，与设计系统 `--error:#B3261E` 完全脱节。
│   ├── 🟡 navbar 内联 `height:50px`（同 register）。
│   ├── 🟡 整块 `<style>` 内联（约 40 行），未抽公共"封禁/系统消息页"样式。
│   └── 🟢 封禁图标用内嵌 SVG 而非 `#i-ban/#i-alert` sprite。
├── 交互：2 个
│   ├── 🟡 "申诉"按钮无 disabled/loading 状态，重复点击会重复提交。
│   └── 🟢 "联系客服"电话 `400-888-6688` 不可点击（无 `tel:` 链接）。
├── 板块：2 个
│   ├── 🟡 "封禁原因"和"封禁时间"仅文字罗列，无时间线/详情展开。
│   └── 🟢 卡片 `margin:0 12px` 与全站 `margin:0 16px` 左右边距不一致。
├── 内容：3 个
│   ├── 🔴 "永久封禁"硬编码，未根据 `banType`/`banUntil` 动态渲染；临时封禁页也会显示"永久"。
│   ├── 🟡 客服电话 `400-888-6688` 与 help 页 `400-000-0000`、personal 解锁 sheet `400-000-0000` 三处不一致（疑似占位符未替换）。
│   └── 🟢 "如有疑问请联系客服"无工作时间说明。
└── 元素：1 个
    └── 🟢 `.section-title` 用 `.st-left`，但卡片内"封禁原因/时间"无 label/value 对齐（未用 `.row`/`.kv`）。

---

## 四、company/index.html（企业角色主页）

【页面路径】pages/company/index.html
├── 视觉：6 个
│   ├── 🔴 `.core-unlock-btn` 用 `linear-gradient(135deg,var(--primary),var(--accent))` 且 `box-shadow:rgba(37,99,235,.25)`——蓝色阴影压在金色按钮上，配色错误（蓝色是 --info，非品牌色）。
│   ├── 🟡 `.cc-avatar` 用 `var(--accent)`（未在基线 :root 定义）且 `color:#fff` 硬编码；personal/index 同结构按钮渐变又是 `linear-gradient(var(--primary),var(--primary-dim))`，两主页同一组件两版渐变。
│   ├── 🟡 `.cc-row .k` 宽度 70px，与基线 `--kv-label-w:84px` 不一致。
│   ├── 🟡 使用 `--accent/--accent-line/--success-soft/--bg-elevated/--bg-subtle/--text-inv` 等非基线变量名。
│   ├── 🟢 `.core-section`/`.core-lock-overlay` 整块 CSS 在本页与 personal/index 完全重复（约 80 行），应抽到 app.css。
│   └── 🟢 统计数字"成交订单"用 `pub*3` 派生、"在促合作"硬编码 `26`，视觉上像真实数据但实为假。
├── 交互：3 个
│   ├── 🟡 `.core-unlock-btn` padding `10px 20px`，高度约 40px，接近但未到 44px。
│   ├── 🟡 `#cert` 节点由 JS `cert.style.display='none'` 隐藏——死节点留在 DOM 里，应直接删除。
│   └── 🟢 "联系TA"按钮用内联 SVG chat path，而"收藏/分享"用 `<use href="#i-fav">`，同条操作栏两种图标实现。
├── 板块：3 个
│   ├── 🟡 板块顺序：Hero → 核心业绩(锁定) → 企业信息 → 资质与业绩 → 控制器列表 → 底部 CTA；"控制器列表"在空态时仍占 section-title 高度。
│   ├── 🟢 空态"该企业暂未发布供需信息"有文案，但无引导按钮（应引导去发布）。
│   └── 🟢 `.biz-info-grid` 偶数行最后一项 `nth-child` 去 border 逻辑在奇数条目数时漏处理。
├── 内容：2 个
│   ├── 🟡 匹配度"match-pill match-high"直接拼百分比，无 tooltip 解释计算维度。
│   └── 🟢 企业名称/简介为 MOCK，无"认证时间"展示。
└── 元素：2 个
    ├── 🟢 操作栏 fav/share/contact 三按钮均为圆形 40px，未达 44px。
    └── 🟢 "控制器列表"项用 `.cc-ctrl-row` 但无图标统一尺寸（36px vs 40px 混用）。

---

## 五、personal/index.html（个人角色主页）

【页面路径】pages/personal/index.html
├── 视觉：5 个
│   ├── 🟡 与 company/index 重复整块 `.core-section/.core-lock-overlay`（约 80 行），且参数不一致：padding `10px 24px`（vs 企业 20px）、lock-text max-width `240px`（vs 260px）、字号 13px（vs 12.5px）、圆角用 `var(--r-full)`（vs 企业硬编码 24px）。同一组件两套规格。
│   ├── 🟡 `.core-unlock-btn` 渐变 `linear-gradient(var(--primary),var(--primary-dim))`，与 company 版 `(var(--primary),var(--accent))` 不一致。
│   ├── 🟡 统计"成交订单 `pub*2`"、"在促合作 12"，与 company 版 `pub*3`/26 数值口径不一致，跨页数据对不上。
│   ├── 🟢 资质与业绩 row 用内联 `text-align:right;margin-left:auto;max-width:60%` 覆盖 `.row` 默认，应做专用 `.row.kv-right` 类。
│   └── 🟢 `.md-content code` 用 `var(--accent)` 着色，非基线变量。
├── 交互：3 个
│   ├── 🟡 解锁 sheet 内"客服 400-000-0000"为占位符（与 banned 的 400-888-6688 冲突）。
│   ├── 🟡 地址栏 `?unlock=1`/`?scroll=bio` 调试参数残留，生产应清理。
│   └── 🟢 "联系TA"按钮 `.cc-action` 同时画了 cr-icon 和文字电话，图标+文字重复。
├── 板块：2 个
│   ├── 🟡 "信息"组未用 `.biz-info-grid`，与 company 版"企业信息"卡片布局不一致（同一"信息架构"两种排法）。
│   └── 🟢 无"我的动态/近期浏览"板块，与 company 版信息密度失衡。
├── 内容：2 个
│   ├── 🟡 个人主页无"认证标签"可视化（企业版有 tag），用户身份感弱。
│   └── 🟢 "自我介绍"区在未填写时无空状态插画。
└── 元素：1 个
    └── 🟢 `.cc-action` 电话图标与 company 版不同源。

---

## 六、supply/list.html（发现/列表页）

【页面路径】pages/supply/list.html
├── 视觉：3 个
│   ├── 🟡 `.sub-chip.on` 用 `color:#fff`（硬编码）而非 `var(--text-inv)`。
│   ├── 🟡 `.filter-footer .btn-apply` 文字 `color:#fff` 硬编码。
│   └── 🟢 动态注入的 topTag 用 `cssText` 硬编码 `#C9A961/#A98A47` 渐变（line 425），与 `.sub-chip.on` 渐变重复但写死。
├── 交互：4 个
│   ├── 🟡 筛选浮层 `.filter-overlay` 宽度用 `var(--phone-w,420px)`，但 phone 容器宽度未在基线定义该变量，桌面预览时浮层会偏。
│   ├── 🟡 排序 `.sort-popover` 绝对定位 `top:calc(100%+6px)`，在 navbar 吸顶时层级 z-index:100 可能被 app-tabbar 遮挡。
│   ├── 🟡 筛选角标 `#filter-cnt` 初始 `display:none`，激活后 `min-width:16px` 在数字 ≥10 时会变形。
│   └── 🟢 列表卡片点击无 hover/active 明确反馈（依赖全局 `.job-card` active）。
├── 板块：2 个
│   ├── 🟢 顶部 `.app-search` + `.app-tabbar` 与其他模块页一致，但本页无"分类 icon 栏"（trade/personnel 都有），入口层级缺失。
│   └── 🟢 无"最近浏览"或"为你推荐"板块。
├── 内容：2 个
│   ├── 🟡 城市筛选项与 match/preferences 页城市列表不一致（本页含 9 城，preferences 仅 6 城）。
│   └── 🟢 空结果文案"暂无相关供需"无 CTA。
└── 元素：2 个
    ├── 🟢 `.tag` 体系混用 `tag-gold/tag-supply/tag-demand/tag-blue/tag-purple/tag-red/tag-gray`，未在基线定义全部语义。
    └── 🟢 卡片右侧 match-pill 字号 11px，与正文 13px 层级差过小。

---

## 七、supply/detail.html（供需详情页）

【页面路径】pages/supply/detail.html
├── 视觉：7 个
│   ├── 🔴 PDF 图标两处硬编码红色渐变 `linear-gradient(135deg,#e74c3c,#c0392b)`（line 280/362），Bootstrap 红，与 `--error:#B3261E` 不符。
│   ├── 🔴 人才 Hero 渐变 `linear-gradient(135deg,#6B4423,#8B6914,#C9A961)`（line 382）三段棕褐色，偏离品牌金色阶。
│   ├── 🟡 房间状态徽章硬编码 6 组色值：`#e7f6ef/#0f7b55`（vacant）、`#fdf3e3/#c07c10`（limited）、`#f2f4f7`（full）、`#2b6b4f/#d48806`（line 318-328），均未令牌化。
│   ├── 🟡 多处 `rgba(217,119,6,...)` 橙色（dd-promise/dd-status-warn/mask-notice），即 trade 页同款 off-brand 琥珀。
│   ├── 🟡 `.cvb-icon` 渐变 `linear-gradient(var(--success),#2B6B4F)`——第二色硬编码与 var 同值，自相矛盾。
│   ├── 🟡 使用 `--danger/--accent/--accent-line/--text-4/--bg-card-2/--success-soft` 非基线变量。
│   └── 🟢 navbar `nav-right` 为空占位（line 21 后无内容），与其他详情页（收藏/分享）不一致。
├── 交互：3 个
│   ├── 🟡 ECharts 从 `cdn.bootcdn.net` 加载（line 58），`onerror` 兜底文案仅"图表加载中..."，未降级为表格。
│   ├── 🟡 付费解锁 CTA 弹出层无价格明细预览（必须先点开才见价）。
│   └── 🟢 "年年"姓名脏数据通过 `innerHTML` 后处理 replace 修正（line 注释可见），是数据层 bug 在视图层打补丁。
├── 板块：3 个
│   ├── 🟡 板块顺序：Hero → 联系方式(付费墙) → 详情描述 → 资质证书 → PDF 附件 → 推荐人脉 → 同区域房源；"联系TA"在付费墙之上反复出现。
│   ├── 🟡 资质证书 `.cert-item` 水印"ENGCHAIN · 工程链"用 `rotate(-30deg)` 绝对定位，在长图上会压住关键信息。
│   └── 🟢 "看房/电话地图"弹窗 `.map-modal` 与交付弹窗 `.deliver-mask` 共存，z-index 200 vs 100，层级混乱。
├── 内容：2 个
│   ├── 🟡 PDF 附件名硬编码"营业执照扫描件.pdf"等示例名。
│   └── 🟢 无"信息更新时间"展示，用户无法判断时效性。
└── 元素：2 个
    ├── 🟢 `.ci-seal` 圆形印章 44px 字号 9px，文字挤压。
    └── 🟢 `.rm-search` 高度 36px，低于 44px 触控标准。

---

## 八、order/index.html（订单列表）

【页面路径】pages/order/index.html
├── 视觉：4 个
│   ├── 🟡 navbar 内联 `height:50px`（同其他页）。
│   ├── 🟡 骨架屏 `.sk-line` 硬编码 `#ece8e0`，未用 `--bg-inset`。
│   ├── 🟡 兜底色 `var(--text-2,#666)`/`var(--bg-card-2,#f5f3ee)`/`var(--bg-card,#fff)`/`var(--line,#e8e4dc)` 多处 fallback 到 Bootstrap 灰，说明变量未定义。
│   └── 🟢 金色 tag 用 `#A98A47` 硬编码（line 33）而非 `var(--primary-dim)`。
├── 交互：3 个
│   ├── 🟡 状态 tab 用 `tag-warning/tag-gold/tag-success/tag-gray/tag-primary/tag-danger` 6 套，但 `pending/draft` 都映射 `tag-warning`，用户无法区分草稿与待支付。
│   ├── 🟡 `await_accept` 与 `await_confirm` label 都叫"待验收"，状态机文案重复。
│   └── 🟢 列表卡片点击无 active 态。
├── 板块：2 个
│   ├── 🟡 骨架屏出现但仅 2 条，加载完成后无淡入过渡。
│   └── 🟢 无"订单搜索"入口。
├── 内容：2 个
│   ├── 🟡 "托管"角标仅在 `kind==='mediation'` 时出现，文案未解释托管资金去向。
│   └── 🟢 空订单态无 CTA（去发现页）。
└── 元素：2 个
    ├── 🟢 状态 tag 字号 10px，在 row 中与订单号 12px 对比过小。
    └── 🟢 无分页/加载更多组件（依赖滚动）。

---

## 九、order/detail.html（订单详情）

【页面路径】pages/order/detail.html
├── 视觉：3 个
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟡 多处 `section-title` 内联 `style="margin-top:18px"`（line 224/280/306/314/332），应在 app.css 统一 `.section + .section-title` 间距。
│   └── 🟢 `pending/draft` 在本页映射 `tag-primary`，而 order/index 映射 `tag-warning`，跨页状态色不一致。
├── 交互：3 个
│   ├── 🟡 "确认完成/申请退款/联系客服"操作按钮区无 disabled 状态（已完成订单仍可点）。
│   ├── 🟡 履约进度时间线无动画，节点状态用颜色区分但无图标。
│   └── 🟢 "订单快照"区标签 `tag-gold` 与详情页其他 tag 体系重复定义。
├── 板块：3 个
│   ├── 🟡 板块顺序：状态头 → 履约进度 → 订单快照 → 订单信息 → 费用明细 → 质保金（条件）→ 操作栏；"费用明细"在"订单信息"之后，支付页应前置。
│   ├── 🟡 质保金板块仅在条件满足时插入，无占位，布局跳动。
│   └── 🟢 无"发票申请"入口（B 端订单必备）。
├── 内容：2 个
│   ├── 🟡 状态 desc 文案"等待支付确认/订单草稿，等待支付"重复。
│   └── 🟢 费用明细无"平台服务费/托管费/退款金额"分项标注。
└── 元素：1 个
    └── 🟢 时间线节点无连接线（仅靠 section 间距）。

---

## 十、all-listings.html（根目录散页）

【页面路径】pages/all-listings.html
├── 视觉：8 个
│   ├── 🔴 整页为桌面布局（`max-width:1240px`），无 `.phone` 容器，与移动端 App 完全脱节；不应出现在 `pages/` 移动端路由中。
│   ├── 🔴 本页 `:root` 重新定义 `--bg:#f4f5f7`/`--line:#e4e7ec`/`--brand:#101418`，与 app.css 的 `--bg:#F4F2EE`/`--line:rgba(22,22,22,.07)` 完全不同——同一变量名两套值。
│   ├── 🔴 分组图标用 9 种品牌色：`#2563eb/#0e7490/#d97706/#6d28d9/#dc2626/#b45309/#0f766e/#059669/#db2777`，全部偏离金色主色。
│   ├── 🟡 pill 色 7 套：`#3b5bdb/#0f7b55/#c92a2a/#c2255c/#8a5a1e/#0e6f6f/#6a3fb5`，无设计令牌。
│   ├── 🟡 品牌 mark 渐变 `#e8cd8f,#b8860b` 与 `--primary:#C9A961` 不一致。
│   ├── 🟡 `.sbt-tag.demand` 用蓝 `#3b5bdb`，`.supply` 用绿 `#0f7b55`，与全站 `tag-demand/tag-supply` 色系不统一。
│   ├── 🟢 `--gold:#c9a961` 与 `--primary:#C9A961` 同义双变量。
│   └── 🟢 顶部 `.site-top` 深色 `#101418`，与浅色 App 主体反差过大。
├── 交互：2 个
│   ├── 🟡 分类 chip 点击无 loading，切换瞬间整页重排。
│   └── 🟢 卡片 `:hover` 有效果，但移动端无 hover，交互失效。
├── 板块：2 个
│   ├── 🟡 作为"全量索引"页，板块按 9 大类平铺，无"最近访问/推荐"等个性化。
│   └── 🟢 链接 `../home.html` 从 pages/ 出发指向 `home.html`，但与 App 内 tabbar 路由不互通。
├── 内容：2 个
│   ├── 🟡 Hero 区统计数字（如 684/412/89）与 trade 页 Hero 完全相同，疑似复用。
│   └── 🟢 无搜索/筛选持久化。
└── 元素：1 个
    └── 🟢 卡片图标 38px 圆角 10px，与移动端 `.job-card` 34px 不一致。

---

## 十一、editor-deep-audit.html（根目录散页）

【页面路径】pages/editor-deep-audit.html
├── 视觉：6 个
│   ├── 🔴 整页为桌面审计报告页（`max-width:1100px`），未引 app.css，无 `.phone` 容器，是开发内部产物泄漏到生产 pages 目录。
│   ├── 🔴 配色全套 Bootstrap：`#dc3545/#fd7e14/#ffc107/#20c997`（P0/P1/P2/P3），与品牌金零关联。
│   ├── 🟡 表格 th 背景 `#f0f2f5`、td `#eee`，无品牌色。
│   ├── 🟡 修复建议块 `#2b6cb0/#ebf8ff` 蓝色，与品牌主色冲突。
│   ├── 🟢 `.badge-pass` 用 Bootstrap 成功色 `#d4edda/#155724`。
│   └── 🟢 字体回退 `-apple-system,...,'Microsoft YaHei'`，未用 `var(--font)`。
├── 交互：1 个
│   └── 🟢 纯静态报告，无任何交互。
├── 板块：2 个
│   ├── 🔴 该页不应在用户路由可达范围内（应移出 pages/ 到 docs/ 或 build 时剔除）。
│   └── 🟢 章节按"P0/P1/P2/P3"组织，但 P0/P1/P2/P3 与本审计报告的 🔴🟡🟢 严重程度不一致。
├── 内容：2 个
│   ├── 🟡 内容是"编辑器字段深度审计"元报告，非业务内容。
│   └── 🟢 无版本号/审计日期。
└── 元素：0 个

---

## 十二、editor-evaluation.html（根目录散页）

【页面路径】pages/editor-evaluation.html
├── 视觉：7 个
│   ├── 🔴 同 editor-deep-audit：桌面报告页（`max-width:1200px`），未引 app.css，无 `.phone`。
│   ├── 🔴 全套 Tailwind slate/blue：`#0f172a/#64748b/#2563eb/#dc2626/#d97706/#16a34a`，硬编码色 50+ 处（全项目最高）。
│   ├── 🟡 `.conclusion` 左侧 4px 色条 `#f59e0b/#dc2626/#16a34a`，无令牌。
│   ├── 🟡 `.gap-bar` 进度条 `#e2e8f0` 底，无品牌渐变。
│   ├── 🟢 表格 `tr:hover td{background:#f8fafc}` 仅桌面有效。
│   ├── 🟢 `.field-item code` 用 `#1e40af` 深蓝，与品牌无关联。
│   └── 🟢 字体同样未用 `var(--font)`。
├── 交互：1 个
│   └── 🟢 纯静态。
├── 板块：2 个
│   ├── 🔴 内部审计报告泄漏到生产 pages/。
│   └── 🟢 "27 字段 vs 89 区块"对比数据是元数据。
├── 内容：2 个
│   ├── 🟡 内容为编辑器字段评估，非用户内容。
│   └── 🟢 无审计日期/版本。
└── 元素：1 个
    └── 🟢 表格列宽固定 `grid-template-columns:120px 1fr 100px`，移动端溢出。

---

## 十三、personnel/index.html（人员招聘）

【页面路径】pages/personnel/index.html
├── 视觉：6 个
│   ├── 🟡 找工作排名前三硬编码 Bootstrap 色：`.rank-1 #e74c3c / .rank-2 #e67e22 / .rank-3 #f1c40f`（line 57-59），与设计系统功能色无关。
│   ├── 🟡 "急聘/急寻"tag 在 4 处用内联 `background:rgba(217,119,6,.1);color:var(--accent)`（line 747/786/929 + hot-card），应抽 `.tag-urgent` 类。
│   ├── 🟡 "在职/离职"tag 硬编码 `#16a34a/rgba(34,197,94,...)`（line 790）Material green。
│   ├── 🟡 `.verify-notice` 成功绿用 `rgba(43,107,79,...)` 硬编码（line 79/148/1341）。
│   ├── 🟡 使用 `--text-4/--accent/--danger` 非基线变量。
│   └── 🟢 `.so-clear` 背景 `var(--text-4)` + `color:#fff` 硬编码。
├── 交互：4 个
│   ├── 🟡 双 tab（企业招聘/人才求职）切换时整页重渲染，无过渡。
│   ├── 🟡 "投递简历"按钮在卡片渲染后通过 `injectDeliverButtons` 注入，DOM 与渲染分离，调试困难。
│   ├── 🟡 "已投递"态用 `opacity:0.6` 内联，无 disabled 样式。
│   └── 🟢 收藏按钮 `.fav-btn` 28×28px < 44px。
├── 板块：3 个
│   ├── 🟡 双 tab 共享同一列表容器，但热门/推荐板块仅在 enterprise tab 出现，talent tab 空。
│   ├── 🟡 委托需求弹窗在 talent tab 文案切换为"找不到合适的岗位？"，但表单字段不变（仍要预算）。
│   └── 🟢 "搜索功能已降级为 navbar 搜索 icon 按钮（toast 提示）"——原全屏搜索层代码残留（注释 line 1274）。
├── 内容：2 个
│   ├── 🟡 匹配度兜底"按 id 哈希在 62-96 取值"（line 483 注释），即卡片上的匹配度是伪数据。
│   └── 🟢 委托表单 placeholder"姓名/手机号/具体需求"，无校验。
└── 元素：2 个
    ├── 🟢 标签 chips 字号 9-10px，远小于正文 13px。
    └── 🟢 卡片 `.ent-card/.talent-card` 两套样式但结构近似。

---

## 十四、monitor/index.html（企业监控）

【页面路径】pages/monitor/index.html
├── 视觉：4 个
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟡 试用结束横幅 `rgba(212,76,71,.06/.2)` 硬编码红，与 `--error` 不一致。
│   ├── 🟡 多处 `rgba(201,169,97,...)` 内联（line 98/105/178）未用 `--primary-soft`。
│   └── 🟢 企业头像 36×36 用 `var(--bg-card-2)`，未用 `.avatar` 通用类。
├── 交互：3 个
│   ├── 🔴 "+ 关注"/"取消"按钮 `padding:5px 12px;font-size:11px`，热区约 28×28px，远低于 44px 触控标准。
│   ├── 🟡 升级 CTA 卡片"立即升级"硬编码价格"破冰期特惠 ¥99/年 vs ¥199/年"。
│   └── 🟢 跨 tab 用 `storage` 事件 + 3 个 `addEventListener` 重复绑定，性能浪费。
├── 板块：3 个
│   ├── 🟡 板块顺序：Hero 介绍 → 试用横幅 → 已关注企业 → 监控动态 → 升级 CTA → 添加监控企业；"添加监控企业"在最底部，用户首次进入要滚到底。
│   ├── 🟡 试用横幅与"入驻解锁"提示互斥分支，但 CSS 样式几乎相同。
│   └── 🟢 "已关注企业"空态文案"点下方「+ 关注」开始监控"，但按钮在页底。
├── 内容：2 个
│   ├── 🟡 示例企业列表硬编码（四川中建××建设/四川建材集团/重庆建工集团/蜀安人力/成都电力工程）。
│   └── 🟡 feed 文案"「安全生产许可证」将于 2026-12-31 到期"硬编码未来日期。
└── 元素：1 个
    └── 🟢 feed-dot 8×8 圆点作为类型区分，颜色仅靠 kind 字段，无图例。

---

## 十五、guide/index.html（破冰期引导）

【页面路径】6 个
├── 视觉：5 个
│   ├── 🟡 硬编码金色阶：`#D4B876/#C9A961/#A98A47`（line 33/39/92），与 `--primary-strong #E8D5A3` 不一致。
│   ├── 🟡 Hero 遮罩 `rgba(20,15,5,...)` 深棕，与 `--ink-primary #161616` 不统一。
│   ├── 🟡 eyebrow 用 `rgba(232,213,163,.9)` 即 `--primary-strong` 但硬编码。
│   ├── 🟡 使用 `--success-soft/--primary-soft-2/--accent-line/--bg-elev/--bg-alp` 非基线变量。
│   └── 🟢 无 navbar，hero 顶部无安全区 padding（仅 48px）。
├── 交互：3 个
│   ├── 🟡 "标记完成"按钮（line 337）内联 `margin-left:6px;background:transparent;color:var(--text-3);border:1px solid var(--line)`，应抽 `.gt-btn-ghost`。
│   ├── 🟡 步骤节点可点击 toggle 完成状态——允许用户自欺式标记完成，业务上应只读。
│   └── 🟢 底部三个按钮（开始使用/跳过引导/前往认证中心）堆叠，高度约 150px。
├── 板块：2 个
│   ├── 🟡 "弹窗预览"板块对终端用户是开发视角功能，不应出现在引导页。
│   └── 🟢 新手福利"最高¥200+"用 ¥ 表示积分，单位混淆。
├── 内容：2 个
│   ├── 🟡 "ENGCHAIN · ONBOARDING" eyebrow 英文大写，与中文 App 语境不一致。
│   └── 🟡 福利项"¥50积分/¥30积分/¥100积分"金额与 help 页"100积分=1元"口径未对齐。
└── 元素：1 个
    └── 🟢 时间线节点 28×28px，未达 44px。

---

## 十六、trade/index.html（建企买卖）

【页面路径】pages/trade/index.html
├── 视觉：7 个
│   ├── 🔴 Hero 深色 `#262220/#121110/#191512`（line 34），与品牌米白背景强烈冲突。
│   ├── 🔴 `var(--accent)` 被大量用作橙色（价格/急转/脱敏），line 75/79/90/108/111/126/129/142/146/156——本应是 `--warning #9A7B1F` 或新 `--price` 色，与 `--primary` 金色混淆。
│   ├── 🟡 硬编码 `rgba(217,119,6,...)` 琥珀（line 75/79/107/129/142/146）与 `#e67e22`（line 108）Bootstrap 橙。
│   ├── 🟡 文字色 `#F4F2EE` 硬编码（line 34/40/46/49）即 `--bg` 反用。
│   ├── 🟡 使用 `--d-fast/--d-norm/--e-standard/--e-out` 动效变量与 `--bg-card-2/--accent-line/--accent-soft/--text-4` 非基线变量。
│   ├── 🟡 navbar 未内联 50px（用默认），与其他页 50px 不一致。
│   └── 🟢 `.btn-ghost-light` 在深色 hero 上用 `rgba(244,242,238,.25)` 边框，对比度偏低。
├── 交互：4 个
│   ├── 🟡 "我要收购"按钮（line 284）点击只是 `scrollTop` 到筛选栏，未打开委托表单——与文案"我要收购"不符。
│   ├── 🟡 `setInterval(checkSticky,150)`（line 807）轮询检测吸顶，性能浪费，应改用 IntersectionObserver。
│   ├── 🟡 `filtered()` 函数（line 474）直接 `return all`，函数名误导（实际过滤在 `applyFilters`）。
│   └── 🟢 两个模态（delegate + exclusive）z-index 100/101，与 filter-sheet 同层。
├── 板块：3 个
│   ├── 🟡 板块顺序：Hero → 分类 icon → 信任背书 → 热门急转 → 转让流程 → 全部企业；"转让流程"在热门卡片之后，新用户应先看流程。
│   ├── 🟡 交叉导流卡片"资质变更/人员过户"硬编码文案。
│   └── 🟢 空态按钮 3 个（重置/发布转让需求/提交专享委托）堆叠，视觉过载。
├── 内容：3 个
│   ├── 🟡 Hero 统计 684/412/89 硬编码，与 all-listings 复用。
│   ├── 🟡 保证金 ¥5,000 硬编码，30 天退还规则写死。
│   └── 🟢 流程时间"2 小时内"承诺硬编码。
└── 元素：2 个
    ├── 🟢 信任背书条 4 项内联 SVG（lock/shield/file/zap），未用 sprite。
    └── 🟢 热卡 224px 宽，在 375px 屏上仅露 1.5 张，scroll-snap 体验弱。

---

## 十七、api/index.html（API 产品）

【页面路径】pages/api/index.html
├── 视觉：5 个
│   ├── 🔴 `.balance-card` 深蓝渐变 `linear-gradient(135deg,#1a237e,#283593)`（line ~对应 .balance-card），与品牌金完全无关。
│   ├── 🔴 `.result-box` 深色 `#1e1e2e` + 青色 `#4fc3f7` 终端风，与品牌米白冲突。
│   ├── 🟡 `.history-ok` 用 Material 绿 `#e8f5e9/#2e7d32`。
│   ├── 🟡 navbar 内联 `height:50px`。
│   └── 🟢 充值按钮"¥500"用 `color:#1a237e` 深蓝文字，与品牌金冲突。
├── 交互：3 个
│   ├── 🟡 `__recharge(100)/__recharge(500)` 仅两档，无自定义金额。
│   ├── 🟡 `window.__callApi` 直接全局函数，无 loading 态。
│   └── 🟢 产品列表无空态。
├── 板块：2 个
│   ├── 🟡 "API 产品"标题用纯文本，未用 `.section-title` 统一样式。
│   └── 🟢 无"调用记录/余额明细"板块。
├── 内容：2 个
│   ├── 🟡 充值金额仅 100/500，无 ¥10/¥50 小额档。
│   └── 🟢 余额数字未用 `var(--font-num)` 等宽。
└── 元素：1 个
    └── 🟢 终端结果框 `#1e1e2e` 在浅色 App 中像异物。

---

## 十八、industry/index.html（行业报告）

【页面路径】pages/industry/index.html
├── 视觉：4 个
│   ├── 🟡 锁定 badge `#fff3e0/#e65100`、免费 badge `#e8f5e9/#2e7d32`（Material 橙/绿）。
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟡 使用 `var(--primary-pale)`（line ~对应）非基线变量。
│   └── 🟢 报告弹窗 `display:none` 在 style attr 与 class 双重写（冗余）。
├── 交互：3 个
│   ├── 🔴 报告预览弹窗无关闭 X，仅底部"关闭"按钮和点遮罩，移动端易误触。
│   ├── 🟡 订阅按钮"月付¥29/年付¥299"硬编码，`__doSub` 直接订阅无支付确认。
│   └── 🟢 无加载骨架屏。
├── 板块：2 个
│   ├── 🟡 报告卡片网格无"本周更新"标记。
│   └── 🟢 无"我的订阅"板块。
├── 内容：2 个
│   ├── 🟡 报告标题/摘要为示例文案。
│   └── 🟢 价格 ¥29/¥299 与 co-create 页"认证¥999/入驻¥3999"口径未对齐。
└── 元素：1 个
    └── 🟢 卡片封面用色块渐变，无真实封面图。

---

## 十九、match/preferences.html（匹配偏好）

【页面路径】pages/match/preferences.html
├── 视觉：3 个
│   ├── 🟡 navbar 后退按钮 `&#8249;`（单 guillemet）与其他页 `‹` 字符不一致。
│   ├── 🟡 `.pref-chip` padding `7px 16px`，高度约 30px < 44px。
│   └── 🟢 底部保存按钮 `bottom:20px` 未用 `env(safe-area-inset-bottom)`。
├── 交互：2 个
│   ├── 🟡 保存后仅 toast，无成功反馈动画/状态。
│   └── 🟢 "关注方向"单选 vs"关注品类"多选，UI 无提示区分。
├── 板块：2 个
│   ├── 🟡 "关注方向"与"关注品类"两个板块间距过小。
│   └── 🟢 无"重置为默认"按钮。
├── 内容：3 个
│   ├── 🔴 CATS 数组含"项目合作"和"合作"两个重复项（line ~对应 CATS 列表）。
│   ├── 🟡 城市列表仅 6 城（成都/北京/上海/广州/深圳/重庆），与 supply/list 9 城不一致（缺昆明/贵阳）。
│   └── 🟢 缺失建企买卖/企业招聘/人才求职品类。
└── 元素：1 个
    └── 🟢 chip 选中态仅 border 变色，无填充。

---

## 二十、co-create/index.html（共创者计划）

【页面路径】pages/co-create/index.html
├── 视觉：7 个
│   ├── 🟡 三档徽章色：S 用棕金 `#8A6A2E/#C9A961`、A 用紫 `#6B5B95/#8E7CC3`、B 用深灰 `#3E3E4A/#5B5B6B`——A 紫色与 `--purple:#7C5BBD` 不一致。
│   ├── 🟡 why-card 三个图标用不同渐变：`#8A6A2E/#C9A961`（金）、`#5B5B6B/#3E3E4A`（灰）、`#2B6B4F/#3D8A66`（绿），三色与品牌体系脱节。
│   ├── 🟡 Hero 文字色 `#FBF6EA/#F0DFB4/#F7E9C4/#D9BC74/#3A2F1D` 5 个金色阶硬编码。
│   ├── 🟡 使用 `--d-fast/--e-out` 动效变量与 `--bg-card-2/--success-soft/--primary-strong`。
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟢 `.cc-pledge-bb` 类名双 b（B 档），疑似 typo（应为 `.cc-pledge-b`）。
│   └── 🟢 CTA 按钮 `shine` 扫光动画（line 586-587）过度营销。
├── 交互：3 个
│   ├── 🟡 方向卡片 `.cc-dir` 整卡可点，但 locked 态仅 opacity .6，仍触发 click。
│   ├── 🟡 申请表单"意向层级"下拉直接选 S/A/B，用户可选最高档，无资格校验。
│   └── 🟢 申请原因 textarea 无字数统计。
├── 板块：3 个
│   ├── 🟡 板块顺序：状态横幅 → 身份卡 → Hero → 为什么加入 → 方向 → 破冰福利 → 权益分档 → 流程 → 承诺 → 页脚；Hero 在"为什么加入"之后，叙事倒置。
│   ├── 🟡 流程时间混用"1 个工作日/3-5 个工作日/1-2 周/1 周"。
│   └── 🟢 页脚 footnote 字号 10.5px，密度过高。
├── 内容：2 个
│   ├── 🟡 Hero 统计 200 家/12 个月/3 档硬编码。
│   └── 🟢 价格"认证¥999/入驻¥3999/¥29999/佣金 8%/6%"硬编码。
└── 元素：1 个
    └── 🟢 权益 chip 用 `✓` 字符而非 SVG。

---

## 二十一、help/index.html（帮助中心）

【页面路径】pages/help/index.html
├── 视觉：4 个
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟡 热门 tag 用 `rgba(179,38,30,.08)` 硬编码即 `--error`，但语义是"热门"（应用品牌色或 warning）。
│   ├── 🟡 使用 `--bg-card-2/--warning-soft/--fs-md/--fs-xs` 非基线变量。
│   └── 🟢 吸顶搜索行无顶部安全区 padding。
├── 交互：3 个
│   ├── 🟡 "在线客服"按钮仅 toast"已接入在线客服"，无真实客服 iframe。
│   ├── 🟡 "意见反馈"sheet textarea 提交后仅 toast，无数据落库。
│   └── 🟢 搜索仅匹配问题标题，不匹配答案。
├── 板块：2 个
│   ├── 🟡 8 个分类两行四列网格，但 icon 尺寸 38px < 44px。
│   └── 🟢 "关于工程链"版本 V3.3.0 硬编码。
├── 内容：3 个
│   ├── 🔴 客服电话 `400-000-0000` 占位符（与 banned `400-888-6688` 冲突）。
│   ├── 🟡 FAQ 全量硬编码在 JS 数组，未走 CMS。
│   └── 🟢 "31 个省级行政区"文案与实际数据（6 城偏好）不符。
└── 元素：1 个
    └── 🟢 FAQ 步骤圆点 18px，与正文 13px 对比过小。

---

## 二十二、favorite/index.html（我的收藏）

【页面路径】pages/favorite/index.html
├── 视觉：3 个
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟡 使用 `var(--text-tertiary,var(--text-3))` 双 fallback，说明变量命名未统一。
│   └── 🟢 `.seg` chip 未用 `--r-full` 圆角。
├── 交互：4 个
│   ├── 🔴 "管理"按钮点击仅 toast"管理模式"，无实际批量选择 UI——死功能。
│   ├── 🟡 每张卡片右侧"取消收藏"常驻显示，与顶部"管理"按钮范式矛盾。
│   ├── 🟡 卡片点击无跳转（仅删除按钮可用），用户无法进入详情。
│   └── 🟢 manage-tip 绝对定位 `top:42px` 浮层易被遮挡。
├── 板块：2 个
│   ├── 🟡 seg 仅"全部/需求/供应"3 项，无"人才/建企买卖/资质招商"。
│   └── 🟢 空态无"去发现"CTA。
├── 内容：2 个
│   ├── 🟡 无"收藏时间"展示。
│   └── 🟢 列表项无更新提醒（信息变更后无标红）。
└── 元素：1 个
    └── 🟢 取消按钮用文字"取消收藏"而非 trash icon。

---

## 二十三、cards/index.html（卡片样式总览）

【页面路径】pages/cards/index.html
├── 视觉：4 个
│   ├── 🔴 整页为桌面设计系统 showcase（`max-width:1120px`），无 `.phone` 容器，是开发参考页，不应在生产路由。
│   ├── 🟡 `.ch-flow.mat` 用蓝灰 `rgba(74,124,180,.14)/#3a6a9e`，与品牌金无关。
│   ├── 🟡 硬编码 `#8a6a2e`（anno-row code / ch-flow.res）。
│   └── 🟢 使用 `var(--bg-subtle)` 非基线变量。
├── 交互：1 个
│   └── 🟢 纯展示页，无交互。
├── 板块：2 个
│   ├── 🔴 该页应移出 pages/（开发文档页）。
│   └── 🟢 9 类卡片分类完整但无搜索/筛选。
├── 内容：2 个
│   ├── 🟡 内容为组件名/类名文档，非用户内容。
│   └── 🟢 引用 `js/common.js` 的 `Cards.render()`，API 变更后文档易过期。
└── 元素：1 个
    └── 🟢 anno-col 320px 固定宽，移动端溢出。

---

## 二十四、state/index.html（状态样式总览）

【页面路径】pages/state/index.html
├── 视觉：4 个
│   ├── 🟡 navbar 内联 `height:50px`。
│   ├── 🟡 警告圆点 `rgba(255,159,10,.14)`、错误圆点 `rgba(255,59,48,.14)`（iOS 系统色），与 `--warning #9A7B1F/--error #B3261E` 不一致。
│   ├── 🟡 使用 `var(--primary-soft-2)` 非基线变量。
│   └── 🟢 用文字 ✓/! 而非 SVG 图标。
├── 交互：1 个
│   └── 🟢 纯展示页。
├── 板块：2 个
│   ├── 🔴 该页是状态样式 demo，不应在生产路由。
│   ├── 🟡 仅展示 3 种状态（成功/警告/错误），缺 skeleton/empty/loading 态。
├── 内容：2 个
│   ├── 🔴 "处理中"描述文字"认证审核、提现打款**等等待**态样式"——叠词 typo。
│   └── 🟢 无使用示例代码。
└── 元素：1 个
    └── 🟢 返回按钮 `history.back()` 而非回首页。

---

## 汇总

### (a) 各页问题数量统计表

| # | 页面 | 视觉 | 交互 | 板块 | 内容 | 元素 | 合计 |
|---|---|---|---|---|---|---|---|
| 1 | auth/login | 5 | 4 | 2 | 2 | 2 | 15 |
| 2 | auth/register | 4 | 4 | 2 | 2 | 2 | 14 |
| 3 | auth/banned | 4 | 2 | 2 | 3 | 1 | 12 |
| 4 | company/index | 6 | 3 | 3 | 2 | 2 | 16 |
| 5 | personal/index | 5 | 3 | 2 | 2 | 1 | 13 |
| 6 | supply/list | 3 | 4 | 2 | 2 | 2 | 13 |
| 7 | supply/detail | 7 | 3 | 3 | 2 | 2 | 17 |
| 8 | order/index | 4 | 3 | 2 | 2 | 2 | 13 |
| 9 | order/detail | 3 | 3 | 3 | 2 | 1 | 12 |
| 10 | all-listings | 8 | 2 | 2 | 2 | 1 | 15 |
| 11 | editor-deep-audit | 6 | 1 | 2 | 2 | 0 | 11 |
| 12 | editor-evaluation | 7 | 1 | 2 | 2 | 1 | 13 |
| 13 | personnel/index | 6 | 4 | 3 | 2 | 2 | 17 |
| 14 | monitor/index | 4 | 3 | 3 | 2 | 1 | 13 |
| 15 | guide/index | 5 | 3 | 2 | 2 | 1 | 13 |
| 16 | trade/index | 7 | 4 | 3 | 3 | 2 | 19 |
| 17 | api/index | 5 | 3 | 2 | 2 | 1 | 13 |
| 18 | industry/index | 4 | 3 | 2 | 2 | 1 | 12 |
| 19 | match/preferences | 3 | 2 | 2 | 3 | 1 | 11 |
| 20 | co-create/index | 7 | 3 | 3 | 2 | 1 | 16 |
| 21 | help/index | 4 | 3 | 2 | 3 | 1 | 13 |
| 22 | favorite/index | 3 | 4 | 2 | 2 | 1 | 12 |
| 23 | cards/index | 4 | 1 | 2 | 2 | 1 | 10 |
| 24 | state/index | 4 | 1 | 2 | 2 | 1 | 10 |
| **合计** | | **119** | **70** | **55** | **53** | **31** | **328** |

### (b) 本分片 Top 共性问题（跨页系统性，合并去重，按严重度排序）

1. 🔴 **开发/审计/展示类页面泄漏进生产 pages/ 目录**（4 页）：`all-listings.html`、`editor-deep-audit.html`、`editor-evaluation.html`、`cards/index.html`、`state/index.html` 均为桌面布局（max-width 1100–1240px）、未引 app.css、无 `.phone` 容器，使用 Bootstrap/Tailwind 配色，与移动端 App 完全脱节。建议移出 `pages/` 至 `docs/` 或构建时剔除。

2. 🔴 **错误色/功能色三套并存**：`--error:#B3261E`（基线）、`#e8564f`（register）、`#dc3545/#dc3545`（banned、editor-deep-audit）、`#e74c3c/#c0392b`（supply/detail PDF）、`#d97706/#fd7e14/#ffc107`（多页琥珀）——全站功能色未令牌化，同一语义 5+ 套色值。

3. 🔴 **非基线 CSS 变量泛滥**：`--accent/--accent-line/--accent-soft/--bg-card-2/--bg-elevated/--bg-subtle/--success-soft/--primary-soft-2/--primary-pale/--text-4/--danger/--d-fast/--d-norm/--e-out/--r-full` 等约 15 个变量在 20+ 页使用，但不在 app.css `:root` 基线列表中。需统一收敛到基线或显式补充定义。

4. 🔴 **占位符/假数据未清理**：客服电话 `400-000-0000`（help、personal unlock sheet）vs `400-888-6688`（banned）；登录页预填手机号 `13800008866`/密码 `123456`；monitor 示例企业硬编码；trade/api/co-create 价格（¥5000/¥29/¥99/¥999/¥3999）全部硬编码。

5. 🟡 **navbar 高度事实分裂**：设计系统基线 46px，但 12+ 页内联 `style="height:50px;"`（auth/*、order/*、supply/detail、monitor、guide、co-create、help、industry、api、state、favorite），少数页（trade、personnel、supply/list）用默认值。应统一改 app.css `.navbar{height:50px}` 并删除所有内联。

6. 🟡 **触控目标 < 44px 普遍**：密码显隐（28px）、monitor 关注按钮（28px）、favorite 收藏按钮（28px）、match chip（30px）、guide 时间线节点（28px）、help 分类 icon（38px）、supply/detail 搜索框（36px）。

7. 🟡 **两主页组件重复且规格不一致**：company/index 与 personal/index 的 `.core-section/.core-lock-overlay` 整块 CSS 重复约 80 行，且 padding/字号/圆角/渐变/统计公式（pub*3 vs pub*2、26 vs 12）都不同。

8. 🟡 **hero/卡片深色渐变与品牌金脱节**：trade hero（`#262220/#121110`）、api balance-card（`#1a237e/#283593`）、supply/detail talent-hero（`#6B4423/#8B6914`）、co-create why-card（灰/绿渐变）——多处深色 hero 用棕/蓝/绿而非金色阶。

9. 🟡 **状态/标签语义色滥用**：trade/personnel 把"急聘/急转/价格"用橙色 `var(--accent)` 渲染，与品牌金混淆；help 把"热门"用 `--error` 红；order/index 把 draft 与 pending 都映射 warning，await_accept 与 await_confirm 都叫"待验收"。

10. 🟢 **图标体系不统一**：emoji（login 👁/🙈）、内联 SVG path（trade 信任背书、company 联系TA）、`<use href="#i-*">`（多数页）、字符 ✓（co-create）、文字"显示/隐藏"（register）——5 种实现混用。

### (c) 严重程度分布统计

| 严重度 | 数量 | 占比 |
|---|---|---|
| 🔴 高 | 18 | 5.5% |
| 🟡 中 | 192 | 58.5% |
| 🟢 低 | 118 | 36.0% |
| **合计** | **328** | 100% |

> 维度分布：视觉 119（36.3%）、交互 70（21.3%）、板块 55（16.8%）、内容 53（16.2%）、元素 31（9.4%）。
>
> 高优整改建议（按 ROI 排序）：
> 1. 将 5 个桌面展示/审计页移出 pages/ 或加登录拦截。
> 2. 收敛错误色/警告色/品牌色到 CSS 变量，删除 `#dc3545/#e74c3c/#d97706/#1a237e` 等硬编码。
> 3. 统一 navbar 高度为 50px 并删除内联。
> 4. 替换占位客服电话/演示数据。
> 5. 修复 favorite"管理模式"死按钮与 match/preferences 重复品类。
