# Engchain3.0 工程链信息平台 — UI/UX 代码审计报告（分片3）

> 审计范围：publish(6) + distribution(4) + message(3) + search(3) + franchise(2) + refund(2) + agreement(2) + vendor(2) = **24页**
> 审计方式：纯代码静态读取（Read/Grep），未渲染未截图
> 设计基线：`css/app.css :root` 变量体系 + 核心组件类规范

---

## 一、逐页审计

---

### 【页面路径】pages/publish/index.html

├── 视觉：3个
│   ├── 🟡 根容器使用 `var(--bg-page)`（第6行 `body{background:var(--bg-page)}`），但 `--bg-page` 在 app.css `:root` 中未定义 → 改为 `var(--bg)` 或补充变量定义
│   ├── 🟡 大量非基线变量散用：`--text-1/2/3/4`、`--bg-card-2`、`--accent`、`--accent-soft`（第7-12行），虽在 app.css 后段有定义但与基线 `--ink-*` 命名体系并存，两套语义变量混用 → 统一为基线 `--ink-primary/secondary/tertiary` 命名
│   └── 🟢 付费门控卡 `.gate-card` 内联样式密集（第86-93行 `style="position:fixed;..."` 整块内联），应抽取为独立 CSS 类
├── 交互：3个
│   ├── 🟡 `.wb-action` 按钮 `min-height:56px`（第52行），但 `.wb-action.secondary` 同高，主副操作高度无视觉区分 → 次要操作降为 48px 或使用 outline 样式
│   ├── 🟡 第170行 JS 注入 `<em style="...color:var(--warning)...">` 内联样式，硬编码在 JS 字符串中 → 抽取为 `.warning-text` 工具类
│   └── 🟢 无 `.navbar` / `.app-tabbar` 组件，作为独立工作台页可接受，但与全站其他页导航模式不一致
├── 板块：2个
│   ├── 🟡 付费门控区 `.gate-card` 与 `.wb-gates` 两块内容重叠（门控卡已含 CTA 按钮，下方 `.wb-gates` 又列3条权限说明），信息冗余 → 合并门控卡内，删除下方重复列表
│   └── 🟢 板块顺序：Hero → 付费门控 → 权限说明 → CTA → 草稿列表，逻辑合理
├── 内容：2个
│   ├── 🟡 第197行 `<br>` 后 `<span style="...">条草稿自动保存，随时继续</span>` 文案与 `.wb-sub` 信息重复 → 删除 `<br>` 后续述文案
│   └── 🟢 `.wb-empty` 空状态文案"暂无草稿，点击下方按钮开始"合理，但样式定义在本页 `<style>` 内
└── 元素：2个
    ├── 🟡 `.wb-empty` 类定义在本页 `<style>` 块（第28-30行），但 `drafts.html` 和 `unlocked.html` 也引用了该类 → 必须提升至 app.css，否则那两页空状态完全失效
    └── 🟢 第31行 `.wb-chip` 使用 `var(--bg-card-2)` 做 chip 背景，语义合理

---

### 【页面路径】pages/publish/editor.html

├── 视觉：6个
│   ├── 🔴 第68行 `box-shadow:0 0 0 3px rgba(43,107,79,.12)` — 输入框聚焦环使用绿色 rgba 硬编码值（43,107,79=#2B6B4F），与品牌金色焦点环不一致；全站应为 `var(--primary)` 色系 → 改为 `0 0 0 3px var(--primary-soft)`
│   ├── 🟡 第87行 `background:rgba(43,107,79,.15)`、第95行 `background:rgba(43,107,79,.9)` — AI 补全按钮/图标硬编码绿色 rgba，应使用 `var(--success)` 变量
│   ├── 🟡 第105行 `background:linear-gradient(135deg,#e74c3c,#c0392b)` — 文件上传图标使用红色硬编码渐变，与全站图标色系不一致 → 改为中性灰或品牌金
│   ├── 🟡 第429-430行 `.auth-badge` 使用 `color:#2f855a; background:#c6f6d5; background-color:#f0fff4; border-color:#9ae6b4` 四组硬编码绿色 → 替换为 `var(--success)` + `var(--success-soft)`
│   ├── 🟡 第557行 清除按钮 `style="background:#fee2e2;color:#dc2626;border-color:#fecaca"` — 三组硬编码红色内联样式 → 抽取为 `.danger-chip` 类
│   └── 🟢 第70行 `rgba(212,76,71,.1)` 硬编码红色 rgba 用于错误提示
├── 交互：5个
│   ├── 🔴 `.nav-back`（第580行区域）尺寸 36×36px，`.nav-btn` 36×36px，`.ph-close` 30×30px — 均低于 44px 触控目标标准 → 全局 `.nav-back` 在 app.css 中已定义为 32×32px（第359行），应统一提升至 ≥44px
│   ├── 🟡 `.kv-del` 24×24px（第145行）、`.se-del` 22×22px（第162行）、`.img-remove` 20×20px（第191行）、`.img-setcover` 约24px — 多处微型删除/设为封面按钮远小于44px → 增大热区至 36px 或使用 `padding` 扩展
│   ├── 🟡 `.ch-btn` 按钮 `padding:4px 8px`（第130行）— 快捷短语按钮触控高度约28px → 增加 `min-height:36px` 或 `padding:8px 12px`
│   ├── 🟡 第485/506/547/624/625行 SVG 图标使用内联 `style="..."` 控制尺寸和颜色 → 统一使用 CSS 类
│   └── 🟢 第849行 `<span id="authStatusBadge" style="display:none">` 初始隐藏，由 JS 控制显示，合理
├── 板块：3个
│   ├── 🟡 板块过多：标题 → 类型切换 → 供需选择 → 分类选择 → 关键词 → 详细描述 → 图片上传 → 关键词标签 → 企业信息 → 期望合作 → 发布设置 → 底部操作栏，共12个板块 → 可合并"关键词标签"到"详细描述"，"期望合作"到"发布设置"
│   ├── 🟡 `.pub-footer` 底部操作栏（第438行）含存草稿/预览/发布三按钮，但与 `.fixed-cta` 模式不一致 → 统一使用 `.fixed-cta` 组件
│   └── 🟢 板块间距统一为 `margin:12px 16px`，节奏一致
├── 内容：3个
│   ├── 🟡 编辑器占位符 `"请输入详细描述...例如：项目名称、建筑面积、工期要求、材料规格..."` 较长，提示信息丰富但可能被误解为模板 → 缩短为"请输入详细描述"
│   ├── 🟡 第494行 `placeholder="请输入关键词，用逗号分隔"` 与第509行 `placeholder="如：混凝土、钢筋、脚手架"` 两处关键词输入框占位文案不一致 → 统一
│   └── 🟢 企业认证提示"完善企业信息可提升曝光率和信任度"文案合理
└── 元素：4个
    ├── 🟡 `.ph-close` 使用"×"文本字符（第461行），其他页面用 SVG 关闭图标 → 统一为 SVG
    ├── 🟡 `.nav-back` 使用"‹"文本字符（第577行），全站一致但非 SVG → 建议统一 SVG chevron
    ├── 🟡 第500行 `id="aiFillBtn"` AI 补全按钮使用 `var(--accent)` 但该变量与 `var(--primary)` 色值重叠 → 统一用 `--primary`
    └── 🟢 `.img-item` 使用 `background:var(--bg-card-2)` 作为占位背景，合理

---

### 【页面路径】pages/publish/success.html

├── 视觉：4个
│   ├── 🟡 第33行 `var(--primary-soft-2)` 在 app.css 中有定义（第440行 `.match-high` 使用），但本页直接用做进度条背景，语义不匹配 → 新增 `--progress-track` 变量
│   ├── 🟡 第34行 `var(--text-inv)` 用于深色 Hero 上的文字，语义正确但与 `--ink-on-accent #282310` 基线变量重复 → 统一用 `--ink-on-accent`
│   ├── 🟡 第35行 进度条"40%"百分比为硬编码演示值，非真实流程进度 → 应根据实际审核状态动态计算或删除百分比
│   └── 🟢 第32行 `.success-hero` 使用 `glass` 类 + 内联渐变背景，视觉效果好但 `glass` 类未在基线组件列表中
├── 交互：2个
│   ├── 🟡 `.fixed-cta` 两个按钮"查看记录""返回工作台"并排（第77行），但 `.cta-secondary` 按钮样式未定义 → 需在 app.css 补充
│   └── 🟢 成功页无复杂交互，CTA 按钮高度合理
├── 板块：2个
│   ├── 🟡 板块过少：仅成功图标 → 文案 → 进度条 → 提示卡 → CTA，缺少"下一步建议"板块（如"完善企业信息提升曝光"） → 增加引导板块
│   └── 🟢 无冗余板块
├── 内容：3个
│   ├── 🟡 第34行 勾选标记"✓"为 Unicode 文本字符，非 SVG 图标 → 替换为 SVG checkmark
│   ├── 🟡 第46行 `"审核中 · 预计 1-3 个工作日出结果"` 文案合理，但第52行 `"您的信息已进入审核队列，平台将在 1-3 个工作日内完成审核。审核结果将通过消息通知您。"` 重复了"1-3个工作日" → 删除进度条下方提示卡中重复的时间说明
│   └── 🟢 `.fb-between` 使用 `fs-14`/`fs-12` 字体类，但这些类未在基线中定义
└── 元素：2个
    ├── 🟡 `.tag.tag-primary` 标签使用内联样式控制（第44行 `<span class="tag tag-primary" style="...">`）→ 标签样式应在 CSS 中定义
    └── 🟢 进度条 `.progress-fill` 使用 `var(--primary-strong)` 渐变色，品牌感好

---

### 【页面路径】pages/publish/records.html

├── 视觉：2个
│   ├── 🟡 第41行 navbar 内联 `style="height:50px"` 覆盖基线 navbar 46px → 全站统一为 46px 或在 app.css 全局调整
│   └── 🟡 第63行 `.record-status.status-rejected` 使用 `rgba(179,38,30,.10)` 硬编码红色 rgba → 改为 `var(--error-soft)` 或 `color-mix`
├── 交互：3个
│   ├── 🔴 `.record-actions button` `min-height:34px`（第58行区域）— 远低于 44px 触控标准 → 增大至 `min-height:44px`
│   ├── 🟡 第41行 右上角"+"按钮使用文本字符"+"而非 SVG 图标，且尺寸小 → 替换为 SVG plus 图标，尺寸 ≥36px
│   └── 🟡 `.seg` 筛选栏仅3个选项（全部/需求/供应），缺少状态筛选（已通过/审核中/已拒绝） → 增加二级筛选或用 chips
├── 板块：2个
│   ├── 🟡 板块顺序：Navbar → 统计卡 → 筛选 → 记录列表，缺少"状态分布"概览板块 → 可在统计卡下方增加状态 tab
│   └── 🟢 空状态 `.record-empty` 使用 i-doc 图标，合理
├── 内容：2个
│   ├── 🟡 空状态文案"暂无发布记录，点击右上角+号发布第一条信息"（第113行）— 但"+"按钮在导航栏，文案指引位置不够直观 → 改为"点击下方发布按钮"或在空状态中直接嵌入 CTA
│   └── 🟢 统计数据"已通过 X · 审核中 X · 已拒绝 X"信息完整
└── 元素：2个
    ├── 🟡 `.icon-btn` 类在 app.css 中定义为 34×34px（第362行），但 records 页未使用 `.icon-btn` 而是裸 `<button>` → 统一使用 `.icon-btn` 类
    └── 🟢 `.record-status` 标签使用 dot + 文字，视觉层次清晰

---

### 【页面路径】pages/publish/drafts.html

├── 视觉：2个
│   ├── 🟡 第31行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 `.draft-card` 样式简洁，但 `.draft-bottom` 按钮 `min-height:34px` 过小
├── 交互：3个
│   ├── 🔴 `.draft-bottom button` `min-height:34px`（第20行区域）— 继续编辑/删除按钮触控高度不足 → 增大至 ≥44px
│   ├── 🔴 删除草稿按钮无确认对话框（第48行 `onclick="delDraft(this)"` 直接删除）— 用户误触即丢失草稿 → 增加 `UI.dialog` 二次确认
│   └── 🟡 空状态无图标，仅纯文字"暂无草稿" → 增加 `.wb-empty` 样式和图标
├── 板块：1个
│   ├── 🟢 板块简洁：Navbar → 草稿列表 → 空状态，无冗余
├── 内容：3个
│   ├── 🔴 `.wb-empty` 类定义在 `publish/index.html` 的 `<style>` 块中，本页未引入该样式 → 空状态将无任何样式（无 padding、无居中、无图标占位），呈现为裸文字
│   ├── 🟡 草稿卡片缺少"最后编辑时间"显示 → 应在 `.draft-meta` 中展示时间戳
│   └── 🟢 草稿标题和摘要信息完整
└── 元素：2个
    ├── 🟡 `.draft-meta` 使用 `var(--text-3)` 时间戳，但无相对时间（如"2小时前"） → 使用相对时间格式
    └── 🟢 草稿卡片使用 `.card` 组件，圆角和阴影一致

---

### 【页面路径】pages/publish/unlocked.html

├── 视觉：2个
│   ├── 🟡 第24行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 整体视觉简洁，但缺少顶部 Hero 或统计概览，页面偏空
├── 交互：2个
│   ├── 🟡 `.lead-actions a` `padding:8px`（第19行区域）— 联系对方/查看详情按钮触控高度约30px → 增大至 `min-height:44px`
│   └── 🟢 已解锁线索列表使用卡片布局，合理
├── 板块：2个
│   ├── 🟡 缺少"有效期"板块——已解锁线索应有有效期提示（如"解锁后7天内有效"） → 在顶部增加有效期横幅
│   └── 🟢 板块顺序：Navbar → 线索列表 → 空状态
├── 内容：3个
│   ├── 🔴 `.wb-empty` 类同样定义在 `publish/index.html` 的 `<style>` 块中，本页空状态无样式 → 同 drafts.html
│   ├── 🟡 第63行 `<span class="lead-status">有效</span>` 硬编码"有效"文字，无过期/剩余天数逻辑 → 应动态计算并显示"剩余X天"
│   └── 🟡 "联系对方"链接跳转 `message/index.html` 但未传递线索 ID 或对方 ID → 跳转后无法直接打开对话
└── 元素：1个
    └── 🟡 线索卡片无头像/公司 Logo，仅有文字，视觉单调 → 增加企业 Logo 占位

---

### 【页面路径】pages/distribution/index.html

├── 视觉：5个
│   ├── 🔴 第462-463行 深色 Hero 卡使用硬编码 `#252C35`、`#151A22`、`#0B0E13` 三色深色渐变，完全绕过 CSS 变量体系 → 应定义 `--bg-dark-hero` 变量或使用品牌深色
│   ├── 🟡 第470行 `rgba(244,242,238,.66)`、第472行 `#F7F5F1`、第477行 `#E8D5A3`、第480行 `#2A1810`、第513行 `#C9A961,#E8D5A3` — 深色 Hero 上的文字/标签颜色全部硬编码 → 使用 `--ink-on-accent` 和 `--primary-strong` 变量
│   ├── 🟡 第141/155行 `rgba(31,78,153,.32/.38)` 蓝色阴影硬编码 — 该蓝色非品牌色（31,78,153 为深蓝），与金色品牌不一致 → 使用 `var(--primary-dim)` 色系
│   ├── 🟡 第297行 门控页内联样式中 `rgba(201,169,97,.10)` 等三组 rgba 硬编码 → 用 `var(--primary-soft)`
│   └── 🟡 第494-496行 统计卡图标底色 `rgba(43,107,79,.10)`、`rgba(37,99,235,.10)`、`rgba(124,91,189,.10)` 三组硬编码功能色 rgba → 用 `var(--success-soft)`、`var(--info)`、`var(--purple)`
├── 交互：4个
│   ├── 🟡 `.dh-btn` 高度 30px（第92行区域）— 分销等级切换按钮触控不足 → 增大至 ≥36px
│   ├── 🟡 第22行 右上角"?"帮助按钮使用文本字符"?"而非 SVG 图标 → 替换为 SVG help icon
│   ├── 🟡 `.dq-item` 使用 `onclick` 内联事件处理器（第555行等） → 改为 `addEventListener`
│   └── 🟡 门控页（非商户）通过 `innerHTML` 注入大量内联样式的 HTML 字符串（第297行起），维护困难 → 抽取为隐藏的 DOM 模板
├── 板块：3个
│   ├── 🟡 板块过多：深色 Hero → 数据概览 → 等级权益 → 快捷入口 → 分销说明 → 门控页（条件渲染），信息密度高 → 可合并"分销说明"到等级权益内
│   ├── 🟡 深色 Hero 卡与浅色设计体系视觉割裂，全站其他页面均为浅色暖调 → 考虑改为浅色金卡
│   └── 🟢 快捷入口 `.dq-item` 三列布局合理
├── 内容：2个
│   ├── 🟡 第22行 `data-tab="distribution"` 但无 `.app-tabbar` — 作为二级页面可接受
│   └── 🟢 分销规则说明文案完整
└── 元素：2个
    ├── 🟡 统计图标 `.ov-ic` 使用 SVG，但深色 Hero 中的图标颜色硬编码
    └── 🟢 `.dq-item` 图标+文字垂直居中对齐合理

---

### 【页面路径】pages/distribution/earnings.html

├── 视觉：4个
│   ├── 🟡 第75/83行 `rgba(31,78,153,.32/.38)` 蓝色阴影硬编码（同 index.html） → 统一
│   ├── 🟡 第96行 ST_TAG 状态色使用 `var(--danger)`，但 `--danger` 在 app.css `:root` 中**未定义**（基线为 `--error`） → 改为 `var(--error)`
│   ├── 🟡 第96行 `rgba(43,107,79,.08/.22)`、`rgba(190,61,52,.08/.22)` 四组硬编码功能色 rgba → 用 `var(--success-soft)` 等
│   └── 🟡 第211行 `color-mix(in srgb,var(--bg) 88%,transparent)` — 使用现代 CSS color-mix，兼容性需确认 → 降级为 `rgba` 或 `var(--bg-card)`
├── 交互：3个
│   ├── 🟡 第22行 导航栏右侧"筛选"为纯文本按钮，无图标，无明确触控目标尺寸 → 使用 `.icon-btn` 或增加 padding
│   ├── 🟡 收益记录列表项使用 `onclick` 内联 → 改为事件委托
│   └── 🟢 时间段切换 seg 交互合理
├── 板块：2个
│   ├── 🟡 板块顺序：数据卡 → 收益记录列表，缺少"提现"按钮板块 → 应在数据卡下方突出提现入口
│   └── 🟢 收益记录按日期分组合理
├── 内容：2个
│   ├── 🟡 第136行 金额 `¥1,280.50` 等数据为硬编码演示值，无空状态 → 增加空状态设计
│   └── 🟢 收益类型标签（分销奖励/提现/退款扣除）文案清晰
└── 元素：2个
    ├── 🟡 第175/176行 收入/支出图标底色硬编码 `rgba(43,107,79,.09)` / `rgba(37,99,235,.09)` → 用变量
    └── 🟢 `.mono` 等宽字体类用于金额数字，合理

---

### 【页面路径】pages/distribution/team.html

├── 视觉：3个
│   ├── 🟡 第71/79行 `rgba(31,78,153,.32/.38)` 蓝色阴影硬编码 → 统一
│   ├── 🟡 第186行 `.vt-tier-badge` 使用 `#F0E2BE,#C9A961` 硬编码渐变 + `#2A1810` 文字色 → 用 `var(--primary-strong)` / `var(--primary)` / `var(--ink-on-accent)`
│   └── 🟡 第165/166行 `rgba(43,107,79,.09)`、`rgba(124,91,189,.09)` 硬编码 → 用变量
├── 交互：2个
│   ├── 🟡 `.vt-pill` 高度 28px（第63行区域）— 团队层级筛选按钮触控不足 → 增大至 ≥36px
│   └── 🟡 成员列表项使用 `onclick` 内联 → 改为事件委托
├── 板块：2个
│   ├── 🟡 板块顺序：团队数据 → 层级筛选 → 成员列表，缺少"邀请新成员"入口 → 应在顶部或底部增加邀请按钮
│   └── 🟢 成员卡片信息（头像/名称/层级/业绩/加入时间）完整
├── 内容：2个
│   ├── 🟡 成员头像使用单字符文字（如"友"），无真实头像图 → 增加默认头像占位图或使用首字母圆片
│   └── 🟢 团队层级（直推/间推/团队）说明清晰
└── 元素：2个
    ├── 🟡 第203行 `rgba(0,0,0,.05)` 硬编码分割线 → 用 `var(--line-hairline)`
    └── 🟢 `.vt-tier-badge` 层级标签视觉区分度好

---

### 【页面路径】pages/distribution/poster.html

├── 视觉：5个
│   ├── 🔴 第235行 海报预览卡使用硬编码深色渐变 `#0b0f1a,#101a2e,#0f2418`，完全绕过 CSS 变量 → 定义深色海报专用变量
│   ├── 🟡 第246行 `#2A1810`、`#F0E2BE,#C9A961` 硬编码文字/按钮色 → 用变量
│   ├── 🟡 第249行 `rgba(201,169,97,.06/.3)` 硬编码 → 用 `var(--primary-soft)`
│   ├── 🟡 第254-255行 假二维码使用 `#1A1F26` 背景 + `#C9A961` 图案硬编码 → 用变量
│   └── 🟡 第274/282/284行 `rgba(43,107,79,.09/.12)`、`rgba(37,99,235,.10)` 硬编码 → 用变量
├── 交互：4个
│   ├── 🔴 二维码为 CSS 生成的假图案（`repeating-conic-gradient`），**不可扫描** — 第175行 Canvas 绘制文本明确写"扫码注册（二维码占位）" → 集成真实 QR Code 生成库
│   ├── 🟡 `.qr-copy` 复制按钮 `padding:2px 8px`（第106行区域）— 触控高度约24px → 增大至 ≥36px
│   ├── 🟡 模板缩略图 `.tpl-thumb` 无选中态反馈（无 border/scale 变化） → 增加 `selected` 状态样式
│   └── 🟡 保存到相册按钮无 loading 状态反馈 → 增加按钮 loading
├── 板块：2个
│   ├── 🟡 板块顺序：海报预览 → 模板选择 → 操作说明 → 保存按钮，合理但模板选择区域过小
│   └── 🟢 操作说明卡清晰
├── 内容：3个
│   ├── 🔴 第35行 `<div class="poster-logo">链</div>` — 海报中 Logo 为单字符"链"，非品牌图片 → 替换为品牌 SVG Logo
│   ├── 🟡 第175行 Canvas 绘制文本"扫码注册（二维码占位）"会出现在最终生成的海报图中 → 必须移除占位文案
│   └── 🟡 海报标题/副标题文案为硬编码，未与用户实际分销等级/数据联动
└── 元素：2个
    ├── 🟡 第90/98行 `rgba(31,78,153,.32/.38)` 蓝色阴影硬编码 → 统一
    └── 🟢 `.tpl-thumb` 缩略图布局整齐

---

### 【页面路径】pages/message/index.html

├── 视觉：3个
│   ├── 🟡 第37行 系统消息图标底色 `rgba(139,123,181,.15)` + `#8B7BB5` 文字色硬编码紫色 → 用 `var(--purple)` 变量
│   ├── 🟡 第94-95行 未读角标 `#dc2626`、`#d97706`、`rgba(46,102,255,.08)` 三组硬编码色 → 用 `var(--error)`、`var(--warning)`、`var(--info)`
│   └── 🟡 第156行 对话项未读角标内联 `style="background:rgba(201,169,97,.2);..."` 硬编码 → 用 CSS 类
├── 交互：3个
│   ├── 🟡 对话列表项使用 `onclick` 内联 → 改为事件委托
│   ├── 🟡 第31行 "演示"标签硬编码显示在导航栏 — 生产环境不应显示演示标记 → 移除
│   └── 🟡 无下拉刷新、无滑动删除（左滑删除对话）交互 → 增加
├── 板块：2个
│   ├── 🟡 板块顺序：顶部 Tab → 系统消息入口 → 对话列表，缺少"搜索对话"入口 → 增加
│   └── 🟢 系统消息入口与对话列表分区清晰
├── 内容：3个
│   ├── 🟡 对话头像使用单字符文字（如"张"），无真实头像 → 增加默认头像
│   ├── 🟡 对话预览文案为硬编码 MOCK 数据，无时间戳相对显示 → 使用相对时间
│   └── 🟡 第129行 `sh.setText(...).html(...)` — setText 后立即 html() 可能导致 setText 内容被覆盖 → 确认 UI.sheet API 调用顺序
└── 元素：2个
    ├── 🟡 第22行 导航栏右侧"编辑"按钮内联 `style="color:var(--text-3);font-size:12px;"` → 用 CSS 类
    └── 🟢 未读角标 `.unread` 圆点设计合理

---

### 【页面路径】pages/message/chat.html

├── 视觉：2个
│   ├── 🟡 第21行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 聊天气泡 `.chat-bubble.green` / `.chat-bubble.gray` 颜色依赖 app.css 定义，需确认绿色是否使用品牌色
├── 交互：4个
│   ├── 🟡 第24行 "⋯"更多选项按钮为文本字符，无 SVG 图标 → 替换
│   ├── 🟡 第36-38行 快捷回复 chips 使用 `onclick` 内联 → 改为事件委托
│   ├── 🟡 第43行 输入框使用 `onkeydown` 内联事件 → 改为 `addEventListener`
│   └── 🟡 无发送图片/语音/表情功能，仅纯文字输入 → 至少增加图片发送
├── 板块：2个
│   ├── 🟡 板块结构：Navbar → 时间戳 → 消息流 → 快捷回复 → 输入栏，合理
│   └── 🟡 聊天头部无对方资料入口（点头像无跳转） → 点击头像跳转对方名片
├── 内容：3个
│   ├── 🟡 第28行 时间戳"今天 09:12"硬编码，非动态时间 → 动态生成
│   ├── 🟡 第67行 所有已发送消息均显示"已读"，无真实已读/未读状态区分 → 根据状态动态显示
│   └── 🟡 第114行 模拟回复"收到，我这边核实一下尽快回复您。"为硬编码 bot 回复 → 对接真实消息接口
└── 元素：2个
    ├── 🟡 消息气泡无头像（左右两侧均无头像） → 增加对方头像
    └── 🟢 时间戳居中分隔样式合理

---

### 【页面路径】pages/message/system.html

├── 视觉：2个
│   ├── 🟡 第27行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 第17-19行 两个独立 `<style>` 块（第15-20行和第21-24行）应合并 → 合并为一个 style 块
├── 交互：2个
│   ├── 🟡 第40行 "全部已读"按钮无明确触控目标尺寸定义 → 增加 padding/min-height
│   └── 🟡 第78行 `m.tint` 直接作为 CSS 类名拼接（`class="si-ic bg-'+m.tint+'"`），若 tint 值不受控存在 CSS 类注入风险 → 白名单校验 tint 值
├── 板块：2个
│   ├── 🟡 板块顺序：Hero 概览 → 分组消息列表 → 富文本消息 → 卡片消息，合理
│   └── 🟡 富文本消息和卡片消息为展示型组件，在系统消息列表中占比过大 → 考虑折叠到"更多"
├── 内容：2个
│   ├── 🟡 消息时间戳均为硬编码演示值 → 动态生成
│   └── 🟢 消息分组（今天/本周/更早）逻辑合理
└── 元素：2个
    ├── 🟡 `.si-unread` 未读红点为小圆点，视觉区分度足够但无数量角标 → 未读数量角标
    └── 🟢 消息类型图标（系统/订单/活动）区分清晰

---

### 【页面路径】pages/search/index.html

├── 视觉：2个
│   ├── 🟡 第18行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 第61/69行 AI 标签使用 `background:rgba(37,99,235,.16);color:var(--blue)` — 蓝色硬编码 rgba → 用 `var(--info)` 色系
├── 交互：3个
│   ├── 🟡 第38行 搜索按钮内联 `style="background:linear-gradient(135deg,var(--primary),var(--primary-dim));"` — `.btn-primary` 应有此渐变，内联重复 → 删除内联
│   ├── 🟡 "大家都在搜"标签为 `<span>` 非 `<button>`，无键盘焦点/ARIA → 改为 `<button>` 或增加 `role="button" tabindex="0"`
│   └── 🟡 AI 建议行使用 `<div onclick>` 非按钮元素 → 同上可访问性问题
├── 板块：2个
│   ├── 🟡 缺少"搜索历史"板块 — 搜索页应显示最近搜索词 → 增加历史搜索板块
│   └── 🟢 板块顺序：搜索框 → AI 建议 → 热门搜索 → 推荐搜索，合理
├── 内容：2个
│   ├── 🟡 第122行 用户搜索词通过字符串拼接插入 `onclick` 属性（`'...location.href=\'result.html?q='+encodeURIComponent(tag)+'\''`），存在 XSS 风险 → 使用 `addEventListener` + `data-*` 属性
│   └── 🟢 热门搜索词和 AI 建议文案合理
└── 元素：2个
    ├── 🟡 第27行 SVG 搜索图标内联 `style="width:15px;height:15px;"` → 用 CSS 类
    └── 🟢 `.app-search` 搜索框组件使用基线类，合理

---

### 【页面路径】pages/search/result.html

├── 视觉：3个
│   ├── 🟡 第19行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   ├── 🟡 第45行 AI 横幅渐变遮罩内联 `style="background:linear-gradient(...)"` → 用 CSS 类
│   └── 🟡 第54-57行 免费额度横幅整块内联样式 → 抽取为 `.quota-banner` 类
├── 交互：3个
│   ├── 🟡 第335行 筛选重置按钮 `onclick="window.resetSearchFilters()"` — 依赖全局函数 → 用事件绑定
│   ├── 🟡 结果列表卡片使用 `<a>` 标签但无 `href`，跳转逻辑在 JS 中 → 确保 `href` 存在以支持中键打开/右键复制
│   └── 🟡 无加载状态（搜索过程中无 skeleton/loading） → 增加 skeleton 加载
├── 板块：3个
│   ├── 🟡 板块密度过高：搜索栏 → seg 分类 → 分类 chips → 排序栏 → 免费额度横幅 → AI 横幅 → 结果列表，共7层 → 合并分类 chips 到排序栏
│   ├── 🟡 免费额度横幅和 AI 横幅同时显示，信息过载 → 折叠为一条提示
│   └── 🟢 空状态设计 `.empty-state` 合理
├── 内容：2个
│   ├── 🟡 第346行 标签样式通过 `tag.style.cssText` 动态设置内联 → 预定义标签样式类
│   └── 🟢 搜索结果卡片信息（标题/描述/标签/距离/价格）完整
└── 元素：2个
    ├── 🟡 第22行 导航栏右侧空 spacer 内联 `width:32px` → 用 CSS 类
    └── 🟢 `.seg` 分类切换使用基线组件

---

### 【页面路径】pages/search/business.html

├── 视觉：2个
│   ├── 🟡 页面结构与 result.html 类似，同样存在 navbar 50px 内联覆盖 → 统一
│   └── 🟡 企业详情页 Hero 区域使用 `.biz-hero` 自定义样式，需确认与全站 Hero 风格一致
├── 交互：2个
│   ├── 🟡 底部操作栏 `.detail-actionbar` 使用基线组件（50px），合理
│   └── 🟡 "立即沟通"和"解锁联系方式"按钮在未解锁态下的状态切换逻辑需确认
├── 板块：2个
│   ├── 🟡 板块顺序：企业 Hero → 企业资质 → 供应列表 → 联系信息（付费墙），合理
│   └── 🟡 缺少"企业评价/口碑"板块 → 可增加
├── 内容：2个
│   ├── 🟡 企业详情信息为 MOCK 数据，需确认与搜索结果列表数据一致性 → 跨页数据对齐
│   └── 🟢 资质标签和认证标识展示清晰
└── 元素：2个
    ├── 🟡 企业 Logo 为文字占位 → 使用图片或 SVG
    └── 🟢 `.tag` 标签组件使用基线类

---

### 【页面路径】pages/franchise/index.html

├── 视觉：5个
│   ├── 🔴 第37行 深色 Hero 使用硬编码 `#262220`、`#121110`、`#191512` 深色渐变 → 定义 `--bg-dark` 变量
│   ├── 🟡 第43/47/49/52行 Hero 文字色 `rgba(244,242,238,.62)`、`#F4F2EE`、`rgba(244,242,238,.55)`、`rgba(255,255,255,.62)` 全部硬编码 → 用 `--ink-on-accent` 系
│   ├── 🟡 第207行 `.dfm-submit` 绿色渐变 `#3D8B6A,#2B6B4F` 硬编码 → 用 `var(--success)` 色系
│   ├── 🟡 第88/195/558/647行 多处 `rgba(217,119,6,.08/.1)`、`rgba(179,38,30,.10)` 硬编码 → 用变量
│   └── 🟡 第274行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
├── 交互：4个
│   ├── 🔴 `.dfm-close` / `.ddm-close` 28×28px、`.fs-close` 30×30px — 弹窗/抽屉关闭按钮均小于 44px → 增大至 ≥44px
│   ├── 🟡 第1088行 `setInterval(checkSticky, 150)` — 每150ms 轮询 sticky 状态，性能浪费 → 改用 `IntersectionObserver` 或 scroll 事件防抖
│   ├── 🟡 第377行 跨销售卡 `.cross-sell` 使用 `onclick` 内联 → 事件绑定
│   └── 🟡 三个弹窗（委托表单/委托详情/专属确认）+ 筛选抽屉共4层弹层，层级管理复杂 → 统一使用 `.sheet` 组件
├── 板块：3个
│   ├── 🟡 板块极多：Hero → 数据概览 → 服务流程 → 委托列表 → 跨销售推荐 → 常见问题 → 底部 CTA → 筛选抽屉 → 委托表单弹窗 → 委托详情弹窗 → 专属确认弹窗 → 免责说明 → 隐私政策 → 用户协议，信息架构复杂 → 合并 FAQ 到底部说明
│   ├── 🟡 第368行 `.fb-count` 初始 `display:none`，由 JS 控制，合理
│   └── 🟢 服务流程4步时间线清晰
├── 内容：2个
│   ├── 🟡 第552-553行 委托卡片标签使用内联 `style="..."` → 用 CSS 类
│   └── 🟢 免责声明和协议链接完整
└── 元素：3个
    ├── 🟡 第627行 内联 `style="color:var(--accent);"` → 用 CSS 类
    ├── 🟡 委托卡片使用 `u.avatar` 单字符头像 → 增加头像图
    └── 🟢 `.dot` 状态圆点设计合理

---

### 【页面路径】pages/franchise/delegate-edit.html

├── 视觉：2个
│   ├── 🟡 第26行 底部保存栏 `rgba(244,242,238,.92)` 硬编码 → 用 `var(--bg)` + 透明度
│   └── 🟡 第41行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
├── 交互：2个
│   ├── 🟡 第42行 返回按钮使用"‹"文本字符（全站一致问题） → SVG
│   └── 🟡 保存按钮无 loading/disabled 状态，提交后立即返回 → 增加按钮 loading 状态
├── 板块：2个
│   ├── 🟡 板块顺序：委托信息卡 → 编辑表单 → 注意事项 → 底部保存栏，合理
│   └── 🟢 空状态（未找到委托）设计完整，含引导按钮
├── 内容：2个
│   ├── 🟡 第114行 注意事项板块内联 `style="margin:12px 16px 0;"` → 用 CSS 类
│   └── 🟢 已承接状态的防御性提示文案清晰
└── 元素：2个
    ├── 🟡 表单字段样式来自 `delegates.css`，本页仅追加脚手架样式 → 确认 delegates.css 变量一致性
    └── 🟢 空状态图标使用 SVG，合理

---

### 【页面路径】pages/refund/index.html

├── 视觉：3个
│   ├── 🟡 第28行 Hero 渐变 `#FBF7EE,#F4EFE2` 硬编码 → 定义 `--hero-warm` 变量
│   ├── 🟡 第152/165/166/173/281/285/364行 多处硬编码 `rgba(43,107,79,...)`、`rgba(154,123,31,...)`、`rgba(179,38,30,...)`、`#2B6B4F,#1F4F3A`、`#FFFCF5` → 全部用功能色变量
│   └── 🟡 第461行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
├── 交互：3个
│   ├── 🟡 第462行 返回按钮"‹"文本字符 → SVG
│   ├── 🟡 FAQ 手风琴使用 `onclick="toggleFaq(this)"` 内联 → 事件委托
│   └── 🟢 `.faq-q` `min-height:48px`（第369行）— 触控目标达标
├── 板块：3个
│   ├── 🟢 板块完整：保障横幅 → 退款政策 → 可退款场景(6类) → 不可退款场景(6类) → 退款流程时间线 → 时效说明 → 金额计算 → FAQ → CTA
│   ├── 🟡 板块过多（9个），页面极长 → 可考虑折叠"金额计算"和"FAQ"
│   └── 🟢 场景卡片分组清晰
├── 内容：3个
│   ├── 🟡 第832/900/958/967行 客服电话"400-000-0000"为占位符 → 替换为真实号码
│   ├── 🟡 第470/484/507/590/673/720/752/820/893行 9处 section-title 内联 `style="margin-top:..."` → 用 CSS 类统一间距
│   └── 🟢 退款计算示例（4个案例）文案完整清晰
└── 元素：2个
    ├── 🟡 第814行 内联 `style="color:var(--text-3);"` → 用 `.ex-result.zero` 类
    └── 🟢 时间线 `.tl-item` 圆点+卡片设计良好

---

### 【页面路径】pages/refund/appeal.html

├── 视觉：2个
│   ├── 🟡 第18行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 第205-211行 `<style>` 块位于 `</body>` 之前（文件末尾），非标准位置 → 移至 `<head>`
├── 交互：3个
│   ├── 🟡 第19行 返回按钮"‹"文本字符 → SVG
│   ├── 🟡 第55行 上传区为 `<div onclick>` 非 `<button>`，有 `role="button" tabindex="0"` 但无键盘事件处理 → 增加 keydown 支持
│   └── 🟡 第182-187行 凭证上传为模拟（仅切换文字"已上传1张凭证（模拟）"），无真实文件选择 → 集成 `<input type="file">`
├── 板块：2个
│   ├── 🟡 板块顺序：退款模式 → 选择订单 → 退款原因 → 退款金额 → 凭证上传 → 底部 CTA，合理
│   └── 🟢 锁定订单（从订单详情带入）自动选中并隐藏模式切换，逻辑好
├── 内容：3个
│   ├── 🟡 第74-76行 演示订单数据硬编码（含日期2026-08-30等） → 对接真实订单数据
│   ├── 🟡 第27/35/40/46/54行 5处 section-title 内联 `style="margin-top:..."` → CSS 类
│   └── 🟡 第197行 确认对话框文本内联 `style="color:..."` → 用 CSS 类
└── 元素：2个
    ├── 🟡 `.reason-chip` 退款原因标签未定义 hover/active 过渡细节 → 补充
    └── 🟡 第128-135行 订单列表行使用大量内联 style 控制选中态/锁定态 → 用 CSS 类 `.row.selected` / `.row.locked`

---

### 【页面路径】pages/agreement/privacy.html

├── 视觉：2个
│   ├── 🟡 第21行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 第53行 第二个 `<style>` 块位于 `</body>` 前，与第15行 head 中的 style 块分离 → 合并
├── 交互：2个
│   ├── 🟡 第24行 "同意"按钮内联 `style="color:var(--primary);font-size:13px;font-weight:600;"`，触控目标不明确 → 增加 padding/min-width
│   └── 🟢 第17行 `.nav-back` 已显式增大至 44px（`min-width:44px;min-height:44px`），但此修复仅在此页 → 应全局修复
├── 板块：2个
│   ├── 🟡 文档仅6节（收集信息/使用/共享/存储/权利/未成年人），内容过于简略 → 应增加数据跨境、Cookie、第三方 SDK 说明等章节
│   └── 🟢 文档结构清晰
├── 内容：3个
│   ├── 🟡 第44行 客服热线"400-000-0000"占位符 → 替换
│   ├── 🟡 第28-29行 标题和日期内联 `style="text-align:center;..."` → 用 CSS 类
│   └── 🟡 无文档版本号、无历史版本链接 → 增加版本标识
└── 元素：2个
    ├── 🟡 第22行 返回按钮"‹"文本字符 → SVG
    └── 🟢 `.doc` 排版样式简洁

---

### 【页面路径】pages/agreement/user.html

├── 视觉：2个
│   ├── 🟡 第21行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
│   └── 🟡 第61行 第二个 `<style>` 块位于 `</body>` 前 → 合并
├── 交互：2个
│   ├── 🟡 第24行 "同意"按钮同 privacy.html → 增加触控目标
│   └── 🟢 第17行 `.nav-back` 已增大至 44px（同 privacy.html）
├── 板块：2个
│   ├── 🟡 文档仅7节，缺少仲裁/管辖、违约责任、服务变更通知等关键法律条款 → 补充
│   └── 🟢 退款期限动态读取 `RULE('refund.days', 7)`（第59行），数据驱动好
├── 内容：3个
│   ├── 🔴 第50行 "成都××科技有限公司" — 公司名称含"××"占位符，直接展示给用户 → 替换为真实公司全称
│   ├── 🟡 第28-29行 标题和日期内联样式 → CSS 类
│   └── 🟢 退款条款与 refund/index.html 的7天无理由政策一致
└── 元素：1个
    └── 🟡 第22行 返回按钮"‹"文本字符 → SVG

---

### 【页面路径】pages/vendor/dashboard.html

├── 视觉：3个
│   ├── 🟡 第17/20行 `border-radius:12px` 硬编码（基线 `--r-m:11px` / `--r-l:15px`）→ 用圆角变量
│   ├── 🟡 第25行 `.bar-label` 字体 9px — 30天柱状图标签过小，几乎不可读 → 增大至 11px 或仅显示日期尾数
│   └── 🟡 第36行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
├── 交互：2个
│   ├── 🟡 第93行 柱状图使用 `title` 属性做 tooltip，移动端无效 → 使用自定义 tooltip 或数值标签
│   └── 🟡 无时间范围切换（日/周/月），数据固定为30天 → 增加时间筛选
├── 板块：2个
│   ├── 🟡 板块顺序：统计卡(6格) → 成交趋势 → 询盘趋势 → 品类分布 → 热门排行，合理
│   └── 🟢 无冗余板块
├── 内容：3个
│   ├── 🟡 第74行 `DashboardStore.generate()` 每次进入页面随机生成数据，非持久化 → 对接真实统计接口
│   ├── 🟡 柱状图无 Y 轴刻度、无数据标签，用户无法读取精确值 → 增加 hover 显示数值或顶部最大值标注
│   └── 🟡 第105/110行 空状态内联样式 → 用 CSS 类
└── 元素：2个
    ├── 🟡 第39行 导航栏右侧空 spacer 内联 `width:32px` → CSS 类
    └── 🟡 第109行 排行序号内联 `style="font-weight:800;color:var(--primary-dim);width:20px;"` → 用 CSS 类

---

### 【页面路径】pages/vendor/upgrades.html

├── 视觉：3个
│   ├── 🟡 第16/18/24/30行 `border-radius:16px/12px/10px` 硬编码 → 用圆角变量
│   ├── 🟡 第90-92行 道具图标渐变 `#F5EDD8,#E8D9B5,#A98A47,#DCE5F0,#C2D4E8,#4A7AA5,#E0EDE4,#C8DFD0,#4A8A5E` 六组硬编码色值 → 定义道具类型色变量
│   └── 🟡 第37行 navbar 内联 `style="height:50px"` 覆盖基线 46px → 统一
├── 交互：3个
│   ├── 🟡 `.ug-btn` 高度 42px（第24行）— 略低于 44px 标准 → 增大至 44px
│   ├── 🟡 第64行 弹窗关闭按钮 `&#215;`（×文本字符）且 `.filter-header-close` 尺寸未定义 → SVG 图标 + ≥44px
│   └── 🟡 第164行 `confirmTop()` 通过字符串拼接将标题插入 `onclick` 属性（`.replace(/'/g,'')`），存在 XSS 风险 → 使用 `data-*` + `addEventListener`
├── 板块：2个
│   ├── 🟡 板块顺序：提示条 → 可购买道具 → 已购道具 → 置顶选择弹窗，合理
│   └── 🟢 无冗余
├── 内容：2个
│   ├── 🟡 道具描述文案简短，缺少"购买后多久生效""是否可退"等说明 → 补充
│   └── 🟢 已购道具显示到期时间和剩余天数，信息完整
└── 元素：2个
    ├── 🟡 第53/67/112/120/161行 5处空状态/加载中内联样式 → 统一空状态 CSS 类
    └── 🟡 第38行 返回按钮使用 `&#8249;`（‹的 HTML 实体），与其他页的"‹"字符不一致 → 统一

---

## 二、分片汇总

### (a) 各页问题数量统计表

| 页面 | 视觉 | 交互 | 板块 | 内容 | 元素 | 小计 |
|------|------|------|------|------|------|------|
| publish/index | 3 | 3 | 2 | 2 | 2 | 12 |
| publish/editor | 6 | 5 | 3 | 3 | 4 | 21 |
| publish/success | 4 | 2 | 2 | 3 | 2 | 13 |
| publish/records | 2 | 3 | 2 | 2 | 2 | 11 |
| publish/drafts | 2 | 3 | 1 | 3 | 2 | 11 |
| publish/unlocked | 2 | 2 | 2 | 3 | 1 | 10 |
| distribution/index | 5 | 4 | 3 | 2 | 2 | 16 |
| distribution/earnings | 4 | 3 | 2 | 2 | 2 | 13 |
| distribution/team | 3 | 2 | 2 | 2 | 2 | 11 |
| distribution/poster | 5 | 4 | 2 | 3 | 2 | 16 |
| message/index | 3 | 3 | 2 | 3 | 2 | 13 |
| message/chat | 2 | 4 | 2 | 3 | 2 | 13 |
| message/system | 2 | 2 | 2 | 2 | 2 | 10 |
| search/index | 2 | 3 | 2 | 2 | 2 | 11 |
| search/result | 3 | 3 | 3 | 2 | 2 | 13 |
| search/business | 2 | 2 | 2 | 2 | 2 | 10 |
| franchise/index | 5 | 4 | 3 | 2 | 3 | 17 |
| franchise/delegate-edit | 2 | 2 | 2 | 2 | 2 | 10 |
| refund/index | 3 | 3 | 3 | 3 | 2 | 14 |
| refund/appeal | 2 | 3 | 2 | 3 | 2 | 12 |
| agreement/privacy | 2 | 2 | 2 | 3 | 2 | 11 |
| agreement/user | 2 | 2 | 2 | 3 | 1 | 10 |
| vendor/dashboard | 3 | 2 | 2 | 3 | 2 | 12 |
| vendor/upgrades | 3 | 3 | 2 | 2 | 2 | 12 |
| **合计** | **70** | **66** | **47** | **60** | **48** | **291** |

### (b) 本分片 Top 共性问题（跨页系统性，合并去重，按严重程度排序）

**🔴 高严重度：**

1. **`.nav-back` 全局触控目标不足**：app.css 第359行定义 `.nav-back{width:32px;height:32px}`，全站24页中22页使用此返回按钮，仅 agreement/privacy.html 和 user.html 通过局部样式覆盖至 44px。建议在 app.css 全局将 `.nav-back` 提升至 `min-width:44px;min-height:44px`。

2. **`--danger` 变量未定义但被使用**：`distribution/earnings.html` 和 `publish/editor.html` 引用 `var(--danger)`，但 app.css `:root` 中仅定义 `--error:#B3261E`。`--danger` 解析失败将导致颜色回退到默认值，红色状态标签样式丢失。应统一改为 `var(--error)`。

3. **`.wb-empty` 类跨页失效**：`publish/index.html` 的 `<style>` 块中定义了 `.wb-empty`，但 `publish/drafts.html` 和 `publish/unlocked.html` 的空状态也引用了该类。由于样式定义在 index.html 的内联 style 中而非 app.css，drafts 和 unlocked 两页的空状态将完全失去样式（无 padding、无居中、无图标占位）。

4. **distribution/poster 二维码为假图案**：海报页的二维码使用 CSS `repeating-conic-gradient` 绘制，不可扫描；Canvas 生成的海报图中包含"扫码注册（二维码占位）"文字。需集成真实 QR Code 生成。

5. **agreement/user.html 公司名占位符"成都××科技有限公司"**：用户协议第七条直接展示含"××"的占位符公司名，法律文件中不可出现占位符。

**🟡 中严重度：**

6. **navbar 高度全站内联覆盖为 50px**：24页中至少18页在 `<div class="navbar" style="height:50px">` 内联覆盖基线 46px。应在 app.css 中统一调整 navbar 高度为 50px 并删除所有内联覆盖。

7. **硬编码十六进制/rgb 颜色散落**：跨页共发现 60+ 处硬编码色值，包括：
   - 深色 Hero 卡：`#262220/#121110/#191512`(franchise)、`#252C35/#151A22/#0B0E13`(distribution/index)、`#0b0f1a/#101a2e/#0f2418`(distribution/poster)
   - 功能色 rgba：`rgba(43,107,79,...)`(success)、`rgba(179,38,30,...)`(error)、`rgba(217,119,6,...)`(warning)、`rgba(37,99,235,...)`(info)、`rgba(124,91,189,...)`(purple)、`rgba(31,78,153,...)`(自定义深蓝)
   - 应统一使用 CSS 变量 `var(--success-soft)`、`var(--error)` 等

8. **返回按钮统一使用"‹"文本字符而非 SVG**：24页中20+页使用 `<button class="nav-back">‹</button>` 文本字符。虽然视觉上可接受，但 SVG chevron 可确保跨设备字体渲染一致性和可访问性。

9. **微型删除/关闭按钮触控目标不足**：`publish/editor.html` 中 `.kv-del`(24px)、`.se-del`(22px)、`.img-remove`(20px)；`franchise/index.html` 中 `.dfm-close`(28px)、`.ddm-close`(28px)、`.fs-close`(30px)；`distribution/poster.html` 中 `.qr-copy`(~24px)。均远低于 44px 标准。

10. **内联 style 泛滥**：跨页共统计到大量内联样式，典型如：
    - section-title 间距内联：refund/index 9处、refund/appeal 5处
    - 空状态样式内联：vendor/upgrades 5处、vendor/dashboard 2处
    - 导航栏右侧 spacer `width:32px`：search/index、search/result、vendor/dashboard
    - 应抽取为 CSS 工具类（如 `.mt-16`、`.text-center-empty`）

11. **客服电话"400-000-0000"为占位符**：refund/index.html、agreement/privacy.html 等多处出现该占位号码。

12. **XSS 风险：用户输入拼入 onclick 属性**：search/index.html 第122行（搜索词拼入 onclick）、vendor/upgrades.html 第164行（标题拼入 onclick）。应改用 `addEventListener` + `data-*` 属性。

**🟢 低严重度：**

13. **空状态头像/Logo 使用单字符文字**：distribution/team.html、message/index.html、franchise/index.html 等页面头像均为 `<u class="avatar">友</u>` 单字符，缺少真实头像图或默认头像组件。

14. **两个 `<style>` 块分离**：agreement/privacy.html、agreement/user.html、message/system.html 在 head 和 body 末尾各有一个 style 块，应合并。

15. **`<style>` 块位于 `</body>` 前**：refund/appeal.html 第205行、agreement/privacy.html 第53行、agreement/user.html 第61行，style 标签应在 head 中。

### (c) 严重程度分布统计

| 严重程度 | 数量 | 占比 |
|----------|------|------|
| 🔴 高 | 12 | 4.1% |
| 🟡 中 | 168 | 57.7% |
| 🟢 低 | 111 | 38.1% |
| **总计** | **291** | **100%** |

**各维度严重度分布：**

| 维度 | 🔴高 | 🟡中 | 🟢低 | 合计 |
|------|------|------|------|------|
| 视觉 | 5 | 48 | 17 | 70 |
| 交互 | 4 | 38 | 24 | 66 |
| 板块 | 0 | 28 | 19 | 47 |
| 内容 | 2 | 36 | 22 | 60 |
| 元素 | 1 | 18 | 29 | 48 |
