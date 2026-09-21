# 后台前端组件视觉走查清单 v1.0

> 用途：P0 视觉底座验收基准 + P1/P2 迁移时的组件对齐表。
> 用法：逐项核对，状态列只填 ✅ / ⚠️ / ❌，发现不一致直接在 "待修" 列记问题。
> 参考源：
>
> `D:\Engchain3.0\CRM\css\{tokens,base,components,views}.css`



***

## 0. 全局基础



| #   | 项目   | 规格                                              | 应用场景            | 动效          | 交互规则                                      | 当前状态 | 待修            |
| --- | ---- | ----------------------------------------------- | --------------- | ----------- | ----------------------------------------- | ---- | ------------- |
| 0.1 | 根字号  | `html { font-size: 13px }`（非 16px）              | 全站              | 无           | 所有 rem 单位按此换算                             | ✅    | —             |
| 0.2 | 间距单位 | 4px 基准，相邻元素间隙 2px                               | 全站 padding/gap  | 无           | 不出现 3px/5px/7px                           | ✅    | —             |
| 0.3 | 噪点纹理 | SVG feTurbulence，opacity 0.025，`app::before` 全屏 | 全站背景            | 无           | pointer-events:none，z-index 0             | ✅    | —             |
| 0.4 | 主题切换 | `data-theme="dark/light"` 挂 `:root`             | 右上角 sun/moon    | 0.3s normal | localStorage `engchain-console-theme` 持久化 | ✅    | —             |
| 0.5 | 圆角三档 | xs=2px / sm=4px / md=8px / rounded=999px        | 头像 / 按钮 / 卡片    | 无           | 仅 "可点的东西" 用 md 圆角                         | ✅    | —             |
| 0.6 | 动效两档 | fast=0.15s / normal=0.3s，ease                   | hover / 弹层 / 抽屉 | —           | 不用 cubic-bezier 复杂曲线                      | ⚠️   | 抽屉 / 命令菜单动画未加 |



***

## 1. 布局骨架



| #   | 项目          | 规格                                          | 应用场景       | 动效         | 交互规则                                   | 当前状态 | 待修     |
| --- | ----------- | ------------------------------------------- | ---------- | ---------- | -------------------------------------- | ---- | ------ |
| 1.1 | 左侧导航        | 宽 236px（收起 12px），transparent 背景             | 管理后台 / C 端 | width 0.3s | hover 导航 item 显 `bg-transparent-light` | ✅    | —      |
| 1.2 | page-header | 高 40px，padding 8px 12px 8px 8px             | 所有页面顶部     | 无          | 左搜索触发区，右操作区                            | ✅    | —      |
| 1.3 | page-body   | 右 / 下 padding 12px，gap 8px                  | 内容区        | 无          | 主面板圆角 8px + border                     | ✅    | —      |
| 1.4 | 页面卡片 panel  | border 1px `border-medium`，圆角 md，bg-primary | 所有路由页      | 无          | 内部 `.page-panel__scroll` 滚动            | ✅    | —      |
| 1.5 | C 端侧栏       | 宽 56px 图标条                                  | /u/\*      | 无          | 图标按钮，激活态浅底                             | ✅    | —      |
| 1.6 | 响应式断点       | ≤1024px 记录详情转上下；≤768px 抽屉全宽                 | 窄屏         | —          | P1 迁移时逐步启用                             | ❌    | 未加媒体查询 |



***

## 2. 导航与菜单



| #   | 项目         | 规格                                                        | 应用场景    | 动效                 | 交互规则                                            | 当前状态 | 待修          |
| --- | ---------- | --------------------------------------------------------- | ------- | ------------------ | ----------------------------------------------- | ---- | ----------- |
| 2.1 | section 标题 | 10px，uppercase，letter-spacing 0.05em，color `font-light`   | 侧栏分组    | 无                  | padding 0 4px 4px                               | ✅    | —           |
| 2.2 | 导航 item    | 高 32px，padding 5px 8px，圆角 sm，gap 8px                      | 侧栏      | bg 0.15s           | hover 浅底；active 浅底 + medium 字重 + `font-primary` | ✅    | —           |
| 2.3 | 导航 icon    | 16px，stroke 2                                             | 侧栏 item | 无                  | 颜色随 item                                        | ✅    | —           |
| 2.4 | 收起按钮       | 14px icon，opacity 0→1 hover 侧栏时                           | 侧栏      | opacity 0.15s      | 鼠标移开侧栏隐藏                                        | ✅    | —           |
| 2.5 | 面包屑        | `font-tertiary` md，separator `font-light`                 | 记录详情页   | 无                  | hover 变 secondary                               | ❌    | P2 并入记录详情时加 |
| 2.6 | Tabs（记录页）  | 高 32px，active 下边框 1px `font-primary`                      | 详情页右侧   | border-color 0.15s | hover 变 secondary                               | ❌    | P2 做记录详情时加  |
| 2.7 | View Chip  | 高 24px，border `accent-tertiary`，bg `accent-quaternary`，蓝字 | 筛选条件胶囊  | 无                  | 右侧 × 移除，opacity 0.6→1                           | ❌    | P1 列表页加筛选时加 |



***

## 3. 按钮体系



| #    | 项目               | 规格                                                  | 应用场景          | 动效                  | 交互规则                                                | 当前状态 | 待修       |
| ---- | ---------------- | --------------------------------------------------- | ------------- | ------------------- | --------------------------------------------------- | ---- | -------- |
| 3.1  | .btn 基类          | 高 32px，padding 0 12px，圆角 sm，md 字号                   | 全站按钮          | bg 0.15s            | focus 3px `accent-tertiary` 光晕；disabled opacity 0.4 | ✅    | —        |
| 3.2  | .btn--sm         | 高 24px，padding 0 8px，sm 字号                          | 表格内 / 小操作     | 同上                  | 同上                                                  | ✅    | —        |
| 3.3  | .btn--primary    | bg `bg-secondary`，字 `font-secondary`                | 默认主操作         | hover→`bg-tertiary` | 普通 primary 不是蓝色                                     | ✅    | —        |
| 3.4  | .btn--blue       | bg `#1961ed`，白字                                     | 强调动作（新建 / 保存） | hover→#184bad       | 蓝色仅用于主 CTA                                          | ✅    | —        |
| 3.5  | .btn--danger     | bg `--color-red`，白字                                 | 删除 / 驳回       | hover→#b43232       | 危险操作确认弹窗                                            | ✅    | —        |
| 3.6  | .btn--secondary  | 透明底 + border `border-medium`                        | 次操作           | hover 浅底            | 描边按钮                                                | ✅    | —        |
| 3.7  | .btn--tertiary   | 纯文字，无 bg                                            | 三级操作          | hover 浅底            | 无 border                                            | ✅    | —        |
| 3.8  | .btn-main        | 100% 宽，padding 10px 12px，圆角 md，径向灰渐变 `#505050→#333` | 登录 / 提交表单     | hover 微亮            | 明暗通用不跟随主题                                           | ✅    | —        |
| 3.9  | .icon-btn        | 32×32（sm 24×24），圆角 sm                               | 工具栏           | bg/color 0.15s      | hover 浅底；active 浅底 + primary；danger hover 红字        | ✅    | —        |
| 3.10 | table-add-button | 高 32px，padding 0 8px，`font-tertiary`                | 表格底部 "新增行"    | hover 浅底            | hover 字变 secondary                                  | ❌    | P1 列表页加  |
| 3.11 | board\_\_add     | padding 4px，sm 字号                                   | 看板列底部         | hover→`bg-tertiary` | 虚线 / 灰色                                             | ❌    | P2 看板视图加 |



***

## 4. 标签 Tag



| #   | 项目                   | 规格                                                          | 应用场景    | 动效 | 交互规则                                | 当前状态 | 待修     |
| --- | -------------------- | ----------------------------------------------------------- | ------- | -- | ----------------------------------- | ---- | ------ |
| 4.1 | .tag 基类              | 高 20px，padding 0 8px，圆角 sm，sm 字号，medium 字重                  | 状态 / 分类 | 无  | ellipsis 截断                         | ✅    | —      |
| 4.2 | 10 色                 | green/turquoise/sky/blue/purple/pink/red/orange/yellow/gray | 业务状态    | 无  | 配色来自 tokens `tag-bg-*`/`tag-text-*` | ✅    | —      |
| 4.3 | board\_\_count badge | 高 20px，min-width 16px，rounded，bg `bg-tertiary`              | 看板列计数   | 无  | hover 列时隐藏，显示菜单按钮                   | ❌    | P2 看板加 |



***

## 5. 头像 Avatar



| #   | 项目               | 规格                      | 应用场景    | 动效 | 交互规则               | 当前状态 | 待修 |
| --- | ---------------- | ----------------------- | ------- | -- | ------------------ | ---- | -- |
| 5.1 | .avatar          | 圆角 xs (2px)，首字母大写，8 色背景 | 用户 / 公司 | 无  | 20/24/28/32/40 多尺寸 | ✅    | —  |
| 5.2 | .avatar--rounded | 圆角 rounded (999px)      | 圆形头像场景  | 无  | 用于联系人              | ✅    | —  |



***

## 6. 输入控件



| #   | 项目                    | 规格                                                                   | 应用场景        | 动效                         | 交互规则                                                                         | 当前状态 | 待修                              |
| --- | --------------------- | -------------------------------------------------------------------- | ----------- | -------------------------- | ---------------------------------------------------------------------------- | ---- | ------------------------------- |
| 6.1 | .text-input           | padding 8px，border `border-medium`，圆角 sm，bg `bg-transparent-lighter` | 所有文本输入      | border/bg/box-shadow 0.15s | hover border 变 strong；focus border `--color-blue` + 3px `accent-tertiary` 光晕 | ✅    | —                               |
| 6.2 | .field-editor--inline | padding 4px 8px 的紧凑输入                                                | 表格 / 详情就地编辑 | 无                          | 点击单元格切换输入态                                                                   | ❌    | P2 详情页加                         |
| 6.3 | 登录页输入变体               | bg `rgba(255,255,255,0.08)`，border rgba 0.16                         | 认证弹窗        | 同上                         | focus 无光晕                                                                    | ❌    | 登录页目前用普通浅色弹窗，未做毛玻璃 auth-modal   |
| 6.4 | .image-input          | 66×66，圆角 sm，bg `bg-tertiary`                                         | 头像 / 封面上传   | hover bg 变                 | 点击触发 file picker                                                             | ❌    | P2 资料页加                         |
| 6.5 | toggle 开关             | 自定义或 el-switch 覆盖                                                    | 设置页         | 0.15s                      | 开 = 蓝，关 = 灰                                                                  | ⚠️   | element-overrides 里覆盖了变量，未见实际使用 |



***

## 7. 数据表格（P1 核心）



| #   | 项目                        | 规格                            | 应用场景    | 动效            | 交互规则                          | 当前状态                   | 待修 |
| --- | ------------------------- | ----------------------------- | ------- | ------------- | ----------------------------- | ---------------------- | -- |
| 7.1 | 行高 32px，单元格 padding 0 8px | 所有列表                          | —       | —             | ✅ 已写进 tokens                  | P1 建 .record-table 全局类 |    |
| 7.2 | thead sticky              | top:0，bg-primary，sm 字号 medium | 长表滚动    | 无             | border-light                  | ❌                      | P1 |
| 7.3 | 行 hover                   | `bg-transparent-lighter`      | 鼠标悬停行   | bg 0.15s      | cursor pointer                | ❌                      | P1 |
| 7.4 | 行选中                       | `accent-quaternary` 浅蓝底       | 复选 / 多选 | bg 0.15s      | 复选框列宽 30px                    | ❌                      | P1 |
| 7.5 | 悬停浮出 "打开" 按钮              | 单元格右上角 absolute，hover 行才显示    | 行级快捷操作  | display 0.15s | position right 5px top 4px    | ❌                      | P1 |
| 7.6 | 排序指示                      | 列头右侧，`color-blue`             | 可排序列    | 无             | 箭头方向随排序                       | ❌                      | P1 |
| 7.7 | 首末列外边框透明                  | 表格与卡片边缘齐平                     | 视觉对齐    | 无             | border-left/right transparent | ❌                      | P1 |
| 7.8 | 空态单元格                     | `font-light` 色                | 无值字段    | 无             | 显示 "—" 或留空                    | ❌                      | P1 |



***

## 8. 看板视图（P2）



| #   | 项目                  | 规格                                                    | 应用场景  | 动效                 | 交互规则                                | 当前状态 | 待修 |
| --- | ------------------- | ----------------------------------------------------- | ----- | ------------------ | ----------------------------------- | ---- | -- |
| 8.1 | 列宽 200px，bg-primary | 商机 pipeline                                           | —     | —                  | ❌                                   | P2   |    |
| 8.2 | 卡片                  | bg-secondary，border-medium，圆角 sm，shadow-light，grab 光标 | 商机卡   | border-color 0.15s | hover border strong                 | ❌    | P2 |
| 8.3 | 拖动态                 | opacity 0.5，grabbing 光标                               | 拖拽    | —                  | 列 drop-target 显 `accent-quaternary` | ❌    | P2 |
| 8.4 | 卡片内容                | 2px gap，sm 字号，icon `font-light`                       | 卡片元信息 | 无                  | ellipsis                            | ❌    | P2 |



***

## 9. 记录详情页（P2）



| #   | 项目             | 规格                                   | 应用场景 | 动效       | 交互规则             | 当前状态 | 待修 |
| --- | -------------- | ------------------------------------ | ---- | -------- | ---------------- | ---- | -- |
| 9.1 | 左栏 320px，右栏自适应 | 公司 / 联系人详情                           | 横向布局 | 无        | ≤1024px 转上下堆叠    | ❌    | P2 |
| 9.2 | summary-card   | 居中，24px 顶 padding，xl 标题 + sm meta    | 顶部概要 | 无        | —                | ❌    | P2 |
| 9.3 | property-box   | bg-secondary，border，padding 12，gap 8 | 属性面板 | 无        | margin-bottom 24 | ❌    | P2 |
| 9.4 | property-row   | 高 24px，label 100px 固定，hover 浅底       | 属性行  | bg 0.15s | 空值显 `font-light` | ❌    | P2 |
| 9.5 | 时间线            | 竖线贯穿，gutter 26px，note 卡 / 任务卡        | 活动流  | 无        | 任务完成划线 + 变 light | ❌    | P2 |



***

## 10. 弹层与抽屉



| #    | 项目       | 规格                               | 应用场景      | 动效                        | 交互规则                       | 当前状态 | 待修                                 |
| ---- | -------- | -------------------------------- | --------- | ------------------------- | -------------------------- | ---- | ---------------------------------- |
| 10.1 | 右侧抽屉     | 宽 500px，header 56px，border-left  | 记录编辑 / 审批 | `translateX(100%→0)` 0.3s | z-index 100，shadow-strong  | ⚠️   | 样式参考已读，组件未建（RightDrawer 被我误删了，需重建） |
| 10.2 | Modal 弹窗 | 居中，圆角 md，毛玻璃 overlay `blur(6px)` | 确认 / 表单   | scale-in 0.15s            | z-index 1000，点击 overlay 关闭 | ❌    | 用 el-dialog 覆盖样式                   |
| 10.3 | Toast    | 顶部居中，圆角 md，shadow                | 操作反馈      | 上下滑入 0.15s                | 3s 自动消失                    | ❌    | 用 el-message 覆盖样式                  |
| 10.4 | Tooltip  | 小三角，深色 bg                        | 图标悬停      | fade 0.15s                | —                          | ❌    | el-tooltip 覆盖样式                    |



***

## 11. 命令菜单 ⌘K



| #    | 项目           | 规格                                       | 应用场景  | 动效             | 交互规则              | 当前状态 | 待修                 |
| ---- | ------------ | ---------------------------------------- | ----- | -------------- | ----------------- | ---- | ------------------ |
| 11.1 | Backdrop     | 全屏，`bg-transparent-strong`，`blur(light)` | 触发时遮罩 | fade-in 0.15s  | z-index 1500，点击关闭 | ⚠️   | 已有，缺 backdrop blur |
| 11.2 | 面板           | 宽 640px，top 30%，圆角 md，shadow-super-heavy | 命令列表  | scale-in 0.15s | z-index 1501      | ⚠️   | 已有，缺 scale-in 动画   |
| 11.3 | 输入行          | lg 字号，padding 8 12，下边框                   | 顶部搜索  | 无              | 自动 focus          | ✅    | —                  |
| 11.4 | 列表项          | sm 字号，padding 8，active 浅底                | 条目    | bg 0.15s       | ↑↓ 导航，Enter 确认    | ✅    | —                  |
| 11.5 | Section 标题   | xs，uppercase，`font-light`                | 分组    | 无              | —                 | ❌    | 当前列表未分组            |
| 11.6 | Footer 快捷键说明 | xs，`font-light`，border-top               | 底部提示  | 无              | ⌘↑↓ 导航 / Esc 关闭   | ❌    | 未加 footer          |



***

## 12. 设置区（P2）



| #    | 项目                 | 规格                                            | 应用场景     | 动效               | 交互规则            | 当前状态 | 待修 |
| ---- | ------------------ | --------------------------------------------- | -------- | ---------------- | --------------- | ---- | -- |
| 12.1 | 内容宽 512px（窄 382px） | 设置页居中                                         | —        | —                | ❌               | P2   |    |
| 12.2 | section 结构         | title(lg semibold) + description(sm tertiary) | 分组       | 无                | gap 8           | ❌    | P2 |
| 12.3 | settings-row       | 高 32px，space-between                          | 开关 / 输入行 | 无                | label sm medium | ❌    | P2 |
| 12.4 | 主题选择器              | 120×80 预览卡，hover 高度 56→61，选中蓝边                | 外观设置     | height/font 0.3s | 浅 / 深 / 跟随系统三选  | ❌    | P2 |
| 12.5 | 成员卡                | flex 行，avatar + name + email + 操作             | 成员管理     | 无                | margin-top 16   | ❌    | P2 |
| 12.6 | 数据模型表              | th/sm tertiary，td/md primary，border-light 行线  | 设置列表     | 无                | —               | ❌    | P2 |



***

## 13. 认证页



| #    | 项目        | 规格                                                   | 应用场景    | 动效      | 交互规则                | 当前状态 | 待修                        |
| ---- | --------- | ---------------------------------------------------- | ------- | ------- | ------------------- | ---- | ------------------------- |
| 13.1 | 背景模糊板     | 模拟 CRM 界面 blur (2px)，opacity 0.9                     | 登录 / 注册 | 无       | pointer-events none | ⚠️   | 当前用径向渐变 blur，未做 "模拟界面" 背景 |
| 13.2 | 毛玻璃 modal | 400px，padding 40，`bg-overlay` + `blur(strong)`，圆角 md | 认证卡片    | fade-in | 居中                  | ❌    | 当前是浅色不透明卡，未做毛玻璃           |
| 13.3 | 暗色输入变体    | 半透明白底，无光晕                                            | modal 内 | 无       | —                   | ❌    | —                         |
| 13.4 | 分隔线       | `or` 两侧 1px 线，rgba 白 0.2                             | 第三方登录分隔 | 无       | —                   | ❌    | —                         |



***

## 14. 图标系统



| #    | 项目              | 规格                                      | 应用场景  | 动效 | 交互规则            | 当前状态 | 待修            |
| ---- | --------------- | --------------------------------------- | ----- | -- | --------------- | ---- | ------------- |
| 14.1 | AppIcon 组件      | 统一 props: name/size/strokeWidth，默认 16/2 | 全站    | 无  | stroke 风格 24 网格 | ✅    | —             |
| 14.2 | icons.ts        | Tabler v2.30 path，集中管理                  | 图标数据源 | 无  | 禁止散落手写 SVG      | ✅    | grep 已验证 0 残留 |
| 14.3 | stroke-width 分级 | 2 (默认) / 1.6 (细) / 2.5 (粗)              | 按场景   | 无  | 当前全用 2，后续按场景细分  | ⚠️   | 暂不影响          |
| 14.4 | 禁止 emoji        | 任何图标不用 emoji                            | 全站    | —  | —               | ✅    | —             |



***

## 15. 文字与排版



| #    | 项目       | 规格                                          | 应用场景       | 动效 | 交互规则        | 当前状态 | 待修 |
| ---- | -------- | ------------------------------------------- | ---------- | -- | ----------- | ---- | -- |
| 15.1 | h1       | `--font-size-h1`，semibold，primary           | 页面标题       | 无  | —           | ✅    | —  |
| 15.2 | h2/xl    | `--font-size-xl`，semibold                   | 弹窗标题 / 概要  | 无  | —           | ✅    | —  |
| 15.3 | body md  | 13px，primary                                | 正文         | 无  | —           | ✅    | —  |
| 15.4 | sm       | 12px，secondary/tertiary                     | 辅助文字       | 无  | —           | ✅    | —  |
| 15.5 | xs       | 10px，light，uppercase                        | section 标题 | 无  | —           | ✅    | —  |
| 15.6 | ellipsis | `text-overflow:ellipsis;white-space:nowrap` | 所有单元格 / 导航 | 无  | min-width 0 | ✅    | —  |



***

## 16. 卡片与面板



| #    | 项目           | 规格                                          | 应用场景   | 动效                 | 交互规则 | 当前状态 | 待修 |
| ---- | ------------ | ------------------------------------------- | ------ | ------------------ | ---- | ---- | -- |
| 16.1 | .card        | bg-secondary，border-medium，圆角 sm，padding 16 | 通用卡片   | 无                  | —    | ✅    | —  |
| 16.2 | .card--plain | bg-primary                                  | 嵌入场景   | 无                  | —    | ✅    | —  |
| 16.3 | board-card   | shadow-light，grab 光标                        | 看板卡片   | border-color 0.15s | P2 建 | ❌    | P2 |
| 16.4 | property-box | padding 12，gap 8，mb 24                      | 详情属性面板 | 无                  | P2   | ❌    | P2 |
| 16.5 | member-card  | flex 行，avatar + content + action            | 成员列表   | 无                  | P2   | ❌    | P2 |



***

## 当前未闭环项汇总

按优先级：

**P0 收尾（视觉底座必须补）**



1. 10.1 右侧抽屉组件重建（被我误删），加 `translateX` 0.3s 动画

2. 10.2 Modal 用 el-dialog 覆盖成圆角 md + 毛玻璃 overlay

3. 10.3 Toast 用 el-message 覆盖样式

4. 11.1/11.2 命令菜单补 backdrop blur + scale-in 动画

5. 13.1/13.2 登录页改毛玻璃 auth-modal（背景模糊板 + 半透明 modal）

6. 0.6 动效两档统一（0.15/0.3s）

**P1 迁移时同步建**

7\. 7.1–7.8 表格全局类 `.record-table`（行高 32/sticky/hover/ 选中 / 浮出按钮 / 排序）

8\. 2.5/2.6/2.7 breadcrumb/tabs/view-chip

9\. 3.10 table-add-button

10\. 6.2/6.3 inline 编辑 + 暗色输入变体

**P2 并入 CRM 时建**

11\. 8.x 看板视图

12\. 9.x 记录详情页 + 时间线

13\. 12.x 设置区（含主题选择器）

14\. 6.4/6.5 image-input/toggle

15\. 1.6 响应式断点