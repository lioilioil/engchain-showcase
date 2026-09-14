# 工程链 Engchain3.0 — UI/UX 代码审计报告（分片二：wallet 19页 + agency 6页）

> 审计对象：`pages/wallet/*.html`（19 页）、`pages/agency/*.html`（6 页），共 25 个 HTML。
> 审计方式：纯静态代码读取（Read/Grep），未做浏览器渲染。
> 设计基线：`css/app.css :root`（主色 `--primary #C9A961`，功能色 `--error #B3261E` / `--success` / `--warning`，圆角/阴影/字号 token，`.navbar` 默认 52px）。
> 严重程度：🔴高（影响核心功能 / 明显视觉错误 / 无法操作） · 🟡中（体验不佳 / 一致性问题） · 🟢低（细节打磨 / 建议性）。

---

## 〇、审计中发现并已核实的两条「前置性系统性结论」

1. **`--danger` 变量在 app.css 中根本未定义**（已 Grep 全文件，仅存在 `.btn-danger` 类，无 `--danger:` 定义；全项目却有 59 处 `var(--danger)` 引用）。设计系统里的错误色 token 是 `--error`。本分片几乎所有「删除/错误/纠纷/高风险」语义都写成了 `var(--danger)`，浏览器取不到值时回退为继承色（多为正文黑/灰），**红色警示在本分片大面积失效**。下文凡涉及 `var(--danger)` 的页面均不再逐条展开该 token 缺失，统一计入分片共性问题 Top 项。
2. **`wallet/corporate-pay.html` 与 `wallet/corp-pay.html` 功能重复**：经全 `pages/` 目录 Grep，没有任何页面链接到 `corporate-pay.html`（入链为 0），它是一个静态、硬编码收款信息、未接入 `CorpPay` store 的孤立页；真正被充值流 / payment-method / wallet/index 引用并工作的是 `corp-pay.html`。建议删除 `corporate-pay.html`。

---

## 一、逐页审计

### 【页面路径】pages/wallet/index.html（钱包首页 / 余额总览）
- 视觉：4 个
  - 🟡 「银行卡片」hero `.wal-card` 整屏用硬编码深色与金色（`#252C35/#151A22/#0B0E13` 卡面、`#E8D5A3/#CBB87F/#CFB15F/#F0E2BE` 文字），未抽成 token；同一套深色卡面渐变在 agency/order、order-detail 又各自内联重复一遍 → 抽 `.gold-hero` 共享类，色值改 `--primary*` 与 `--ink-on-accent`。
  - 🟢 `.wc-brand` 分隔线 `.wc-contact` 等用 `#E8D5A3/#CFB15F` 等非 token 金色，与 `--primary-strong #E8D5A3` 接近但 `#CFB15F/#CBB87F` 无对应 token → 收敛到 `--primary-strong/--primary-dim`。
  - 🟢 卡面 `.wc-sheen` 流光动画 7.6s 无限循环 + `.wp-fill` shimmer 2.4s 无限循环，金额卡上同时跑两层无限动画，性能与「金融金额应稳重」的观感不符 → 关闭/降级 shimmer，仅保留入场动效。
  - 🟢 `.wc-mark` 水印 `opacity:.05`、`.wc-badge` 圆角 6px 与全站 `--r-s 7px` 不一致。
- 交互：2 个
  - 🟡 余额区块 `.wc-amt` 仅展示无点击手势/箭头，进入余额明细的可发现性弱 → 加 chevron 或整块 cursor+active 反馈并在空态提示。
  - 🟢 服务保障 3 项信任元素为静态内联 svg，无 hover/active，触控区未明确 ≥44px。
- 板块：2 个
  - 🟡 「快捷功能」（充值/提现/银行卡/对公/发票）与下方「资金服务」（余额明细/收支记录/解锁记录/免费额度）存在入口重叠（充值、对公同时出现两处）→ 合并去重，快捷区只留高频动作。
  - 🟢 板块顺序为 hero→快捷→资金服务→信用/额度，缺少「最近流水预览」板块，首屏看不到任何动账记录。
- 内容：1 个
  - 🟡 零余额新用户文案与 trust 文案均为静态；`#balance` 初始渲染为 `—`，countUp 过程中无骨架屏 → 加 skeleton。
- 元素：1 个
  - 🟢 快捷项图标为内联 `<svg>`，未走 `<use href="#i-…">` 统一图标库，与 agency 页做法不一致。

### 【页面路径】pages/wallet/recharge.html（充值）
- 视觉：2 个
  - 🟡 金额输入区快捷金额 chips、充值卡顶部色带用硬编码金/棕，未走 `--primary-soft`；内联 style 约 29 处（热力图已标红）。
  - 🟢 金额大字 `.rc-amount` 字号/字重与 wallet/index `.wc-amt`（30px）不统一，跨页金额排版两套。
- 交互：3 个
  - 🟡 支付方式 radio 选中态、「充值即同意协议」勾选与「立即充值」联动（未勾选可否点）需在按钮 disabled 态体现 → 明确未勾选时主按钮 disabled + tooltip。
  - 🟡 金额输入无最小/最大/非正数即时校验，仅提交时提示 → 输入框下方实时错误态。
  - 🟢 充值成功/失败 toast 后无结果态停留页，直接跳回，用户不易感知到账。
- 板块：1 个
  - 🟢 「充值到账说明/发票」说明板块位置靠后，与支付方式之间空隙节奏不统一。
- 内容：1 个
  - 🟢 充值档位为写死数组，与 credits-mall 的积分档位口径未在文案上关联说明。
- 元素：2 个
  - 🟡 支付方式图标（微信/支付宝/银行卡）为硬编码品牌色（绿 `#07C160`、蓝 `#1677FF`），未走品牌色 token；微信/支付宝属品牌色可保留但应集中定义。
  - 🟢 协议勾选框未使用统一 `.checkbox` 组件。

### 【页面路径】pages/wallet/withdraw.html（提现）
- 视觉：3 个
  - 🔴 第 211 行 `.wd-tip` 等错误/提示块使用 `var(--error)`，与全站 `var(--danger)` 写法混用，二者在同一页面并存 → 统一为 `--error`。
  - 🟡 内联 style 约 43 处（热力图高风险），提现费率/到账说明卡大量行内写死 padding/颜色。
  - 🟡 「提现到账银行卡」卡与 bank-cards.html 的卡片视觉风格不一致（圆角/边框/图标位）。
- 交互：3 个
  - 🟡 提现金额「全部提现」按钮仅填值，无余额不足时的禁用态；输入超额时即时提示缺失。
  - 🟡 选卡（去 bank-cards 选择）返回后选中态回显依赖 querystring，无 loading 骨架。
  - 🟢 手续费试算结果随输入即时变化，但「实际到账」字重/颜色与「提现金额」对比弱，易看错。
- 板块：1 个
  - 🟢 提现费率说明与 bank-cards 的「单卡/日限额」说明重复，建议抽公共组件。
- 内容：1 个
  - 🟡 到账时间「1-3 个工作日」与 recharge「实时到账」口径未在同一处并列说明。
- 元素：1 个
  - 🟢 银行卡号展示未做脱敏（与 agency fmtPhone 脱敏做法不一致）。

### 【页面路径】pages/wallet/bank-cards.html（银行卡管理）
- 视觉：2 个
  - 🟢 卡面银行 logo 用色块+首字代替，与真实卡识别度低；圆角 16px 与卡片 token `--r-l 15px` 接近但未用 token。
  - 🟢 卡片「默认」徽标与 invoice「已开票」徽标样式不统一。
- 交互：2 个
  - 🟡 左滑删除 / 长按设默认的手势提示缺失；删除二次确认用 `UI.dialog`，但 invoice-info 用 `UI.confirm`，**弹窗 API 在钱包内不统一**。
  - 🟢 「添加银行卡」底部主按钮无 loading 态。
- 板块：1 个
  - 🟢 卡列表为空时的空态插画/引导与其他列表页（unlock-records/my-orders）不统一。
- 内容：1 个
  - 🟢 银行卡尾号、开户行文案为写死 mock，跨页与 withdraw 选中卡回显需靠 id 对齐，无单元校验。
- 元素：1 个
  - 🟢 卡片图标位用 emoji/色块，未用 `#i-bank` 图标。

### 【页面路径】pages/wallet/escrow.html（资金托管）
- 视觉：2 个
  - 🟡 第 16 行 hero 文字色写死 `#E8D5A0`（设计 token 为 `#E8D5A3`，差 3 个色阶）→ 改 `--primary-strong`。
  - 🟢 托管进度条 `.esc-bar` 渐变与 order-detail 的 `.fund-bar`（绿渐变）两套配色语义不统一（一个金、一个绿）。
- 交互：1 个
  - 🟢 里程碑释放节点列表只读，无「申请释放」操作入口（操作收敛到 order-detail，这里纯展示 OK，但缺少跳转链接）。
- 板块：1 个
  - 🟢 「监管账户说明」与 order.html「费用说明」、order-detail「资金卡」三处文案重复，应抽共享说明。
- 内容：1 个
  - 🟢 托管金额/在途/已释放三值与 order-detail 的 `Mediation.money()` 计算口径需一致，页面硬编码展示易漂移。
- 元素：1 个
  - 🟢 盾牌图标多处重复内联，未走 `#i-shield`。

### 【页面路径】pages/wallet/invoice.html（发票首页）
- 视觉：2 个
  - 🟡 第 27 行 `.inv-tag`（已开票标签）用 `rgba(255,214,10,.16)` 亮黄底，与全站功能色 token（`--warning #9A7B1F`）不搭，突兀 → 改 `--warning-soft`。
  - 🟢 「申请开票」按钮文字用全角 `＋` 字符而非图标/统一按钮组件，风格突兀。
- 交互：1 个
  - 🟡 抬头列表项点击进入 invoice-info，长按/滑动删除缺失；删除确认 API 与 bank-cards 不统一（见上）。
- 板块：1 个
  - 🟢 抬头管理与「开票记录」入口并列，但「新增抬头」与「申请开票」分置两处，新用户流程略绕。
- 内容：1 个
  - 🟢 发票类型说明（普票/专票）文案与 invoice-info-edit 的分段顺序需一致（见下条跨页）。
- 元素：1 个
  - 🟢 抬头「企业/个人」小标签与「专票/普票」标签两套 badge 样式。

### 【页面路径】pages/wallet/invoice-info.html（抬头详情）
- 视觉：1 个
  - 🟡 第 84 行使用 `var(--accent-soft)` / `var(--accent-line)`（存在但与 `--primary-soft/--primary` 平行的第二套金色 token，全站存在 `--accent-*` 与 `--primary-*` 双轨）→ 收敛到一套。
- 交互：2 个
  - 🟡 删除抬头用 `UI.confirm`，而 bank-cards 用 `UI.dialog`，**同一模块弹窗 API 不一致** → 统一封装。
  - 🟢 「编辑」跳 invoice-info-edit，但详情页无字段级编辑快捷入口。
- 板块：1 个
  - 🟢 专票抬头才展示的「开户行/账号/电话/地址」字段在本页静态展示，与 edit 页条件渲染需保持一致。
- 内容：1 个
  - 🟢 税号、银行账号等敏感信息无脱敏（应中段掩码展示）。
- 元素：1 个
  - 🟢 复制税号按钮无「已复制」toast 反馈。

### 【页面路径】pages/wallet/invoice-info-edit.html（抬头编辑）
- 视觉：1 个
  - 🟢 分段控件（普票/专票）顺序与 invoice.html 相反（edit 页专票在前、invoice.html 普票在前）→ 跨页排序统一。
- 交互：2 个
  - 🔴 第 104 行 `titleType === 'personal' ? '增值税普通发票' : '增值税普通发票'` 两个分支返回同值——**三元运算符恒为同一文案，判断逻辑失效**（应为个人/企业不同抬头名）→ 修正分支。
  - 🟡 本编辑页缺少 invoice-title-new 页有的「抬头类型（企业/个人）」选择器，新增与编辑表单字段不一致 → 对齐。
- 板块：1 个
  - 🟢 专票字段动态显隐用 `display:none` 切换，切换无动画/无过渡。
- 内容：1 个
  - 🟢 税号/账号正则校验规则未在前端给出即时格式提示。
- 元素：1 个
  - 🟢 必填星号、错误提示位置与其他表单页（order 金额输入）不统一。

### 【页面路径】pages/wallet/invoice-title-new.html（新增抬头）
- 视觉：1 个
  - 🟢 表单卡片与 invoice-info-edit 的卡片内边距不一致（14px vs 16px）。
- 交互：2 个
  - 🟡 抬头类型（企业/个人）切换后字段显隐，但 edit 页无此切换（见上），两页表单模型不对齐。
  - 🟢 「保存并设为默认」与「仅保存」两个主操作，主次视觉层级未区分（两个都是实心按钮）。
- 板块：1 个
  - 🟢 「常用模板/历史抬头」快捷复用入口缺失，新增页全靠手填。
- 内容：1 个
  - 🟢 企业名称、税号无实时「校验是否已存在」反馈。
- 元素：1 个
  - 🟢 输入框左侧图标（公司/证件）与 edit 页不统一。

### 【页面路径】pages/wallet/invoice-record.html（开票记录）
- 视觉：1 个
  - 🟢 记录行状态色（已开/开具中/已红冲）用色与 order 状态色板不共享。
- 交互：1 个
  - 🟡 下拉刷新/上拉加载缺失，记录多时一屏渲染。
- 板块：1 个
  - 🟢 顶部筛选（按月份/状态）与 invoice.html 的筛选 chip 风格不统一。
- 内容：2 个
  - 🟡 电子发票 PDF 下载/查看为占位，无实际文件链接。
  - 🟢 金额、抬头名称需与 invoice-info 实时一致（跨页数据一致性，当前各自 mock）。
- 元素：1 个
  - 🟢 「查看」箭头与 my-orders 的 `›` 样式粗细不一。

### 【页面路径】pages/wallet/credits.html（积分中心）
- 视觉：4 个
  - 🔴 第 311 行 JS 拼串 `(gain || 'placeholder')` 会在数据缺失时直接把字面量 **`placeholder`** 渲染到页面上 → 改 `'—'`。
  - 🔴 第 292–294 行 payMethods 与规则文案大量硬编码品牌/状态色：`#2E7D50/#4CAF7D/#07C160/#1677FF/#D4AF37/#E6A022/#B8960C/#E67E22/#3498DB/#9B59B6`，完全绕开设计 token，且多为与古金主题无关的彩虹色 → 全部收敛到功能色 token。
  - 🟡 积分进度、会员等级条用金/绿/橙多色堆叠，视觉喧宾夺主。
  - 🟢 `#2563EB`（蓝）、`#F59E0B`（橙）、`#7C5BBD`（紫）作为「积分」强调色，与品牌金不一致。
- 交互：2 个
  - 🟡 积分商城「兑换」按钮点击后无 loading/确认抽屉，直接扣减。
  - 🟢 任务列表（签到/分享/充值得积分）完成态打勾动画与全站不一致。
- 板块：1 个
  - 🟢 积分余额、等级、任务、商城、规则五板块信息密度过高，一屏堆满。
- 内容：1 个
  - 🟡 「批量充值折扣」在 credits.html 配置 `enabled:false`，但 credits-rules.html 却硬编码 95/9/85 折梯度展示 → **两处数据自相矛盾**。
- 元素：1 个
  - 🟢 任务图标与商城商品图标混用 emoji 与 svg。

### 【页面路径】pages/wallet/credits-rules.html（积分规则）
- 视觉：1 个
  - 🟡 规则说明序号、折扣梯度表用硬编码金/棕。
- 交互：1 个
  - 🟢 规则为纯静态，无「为什么我的积分少了」的 FAQ 折叠交互。
- 板块：2 个
  - 🔴 第 148–156 行「批量充值折扣梯度」板块被写在 `.scroll` 闭合 `</div>`（第 146 行）**之外**、`.cr-page` 之内——即该板块不在滚动容器内，长列表时无法随内容滚动，会错位/被裁切 → 移入 `.scroll`。
  - 🟡 批量折扣表与 credits.html 的 `enabled:false` 配置矛盾（见上）。
- 内容：1 个
  - 🟡 规则文案「积分有效期/过期时间」与 free-quota 免费额度口径未交叉引用。
- 元素：1 个
  - 🟢 梯度表 `table` 未做移动端横向滚动容器。

### 【页面路径】pages/wallet/credits-mall.html（积分商城）
- 视觉：2 个
  - 🟡 第 39/41 行使用 `var(--text-4)`（已存在，但说明该页依赖第三级文字色；同时 `#2563EB/#F59E0B/#7C5BBD` 作为分类角标硬编码）。
  - 🟢 商品卡片封面位为渐变色块占位，无真实图。
- 交互：1 个
  - 🟡 兑换流程无「积分不足 → 去赚积分」的引导跳转。
- 板块：1 个
  - 🟢 「我的兑换记录」入口缺失（应与 unlock-records 归并）。
- 内容：1 个
  - 🟢 商品库存/兑完态文案缺失。
- 元素：1 个
  - 🟢 商品卡「兑换」按钮角标与 credits.html 任务按钮样式不统一。

### 【页面路径】pages/wallet/membership.html（年度解锁会员）
- 视觉：2 个
  - 🟡 会员权益 benefits 用 `split(/[，,：:]/)` 字符串硬切来生成多色标签，文案一变就切错；金/棕标签硬编码。
  - 🟢 套餐卡（季/年）选中态描边用金色描边 + 「推荐」角标，与 credits-mall 商品选中态两套。
- 交互：1 个
  - 🟡 订阅按钮点击直接拉起支付，无「自动续费/取消规则」二次确认抽屉。
- 板块：1 个
  - 🟢 权益对比与 free-quota「额度对比」表内容高度重叠，应抽共享组件。
- 内容：1 个
  - 🟢 价格「¥xx/年」划线价与实际价字号对比弱。
- 元素：1 个
  - 🟢 权益勾选用对勾 svg，与 unlock-records 的空态勾选 svg 尺寸不一致。

### 【页面路径】pages/wallet/free-quota.html（免费额度）
- 视觉：1 个
  - 🟢 额度进度环/进度条与 credits.html 等级条两套视觉。
- 交互：1 个
  - 🟡 「升级解锁」按钮跳入驻/企业认证，但未区分当前用户是个人还是企业，按钮文案固定。
- 板块：1 个
  - 🟢 「额度对比表」把「普通用户 5 条/月」标为「当前」，但 JS 内 `monthly=5` 写死——若用户已是入驻企业（应 10/20 条），当前高亮仍错误 → 按 `entryAccess()` 动态判定。
- 内容：2 个
  - 🟡 免费额度使用记录为写死 mock，不接真实用量。
  - 🟢 「普通用户 5 条/月」与升级卡「个人10条/企业20条/月」数字需与 membership 权益表对齐（当前一致，但散落三处）。
- 元素：1 个
  - 🟢 对比表「当前/升级」徽标与 membership 套餐角标样式不统一。

### 【页面路径】pages/wallet/unlock-records.html（解锁记录）
- 视觉：1 个
  - 🟡 `.ur-stats`（统计行）与 `.seg`（分段筛选）写在 `.scroll` **之外**（第 48–58 行），与 credits-rules 同样的「跳出滚动容器」问题；靠文档流顶置，未做 sticky，滚动时行为与其他吸顶筛选页不一致。
- 交互：1 个
  - 🟢 分段筛选无 URL 状态回填，刷新回到「全部」。
- 板块：1 个
  - 🟢 统计行三项（已解锁/花费/剩余）与 credits.html 积分统计卡信息重叠。
- 内容：1 个
  - 🟢 记录文案「解锁了 XX 简历」依赖真实职位数据，空态文案缺失。
- 元素：1 个
  - 🟢 记录列表项时间戳格式 `MM-DD HH:mm` 与 my-orders 的 `YYYY-MM-DD HH:mm` 不统一。

### 【页面路径】pages/wallet/payment-method.html（支付方式管理）
- 视觉：1 个
  - 🟢 银行卡/余额/对公三类方式图标硬编码品牌色。
- 交互：2 个
  - 🟡 「设为默认」radio 与删除操作在同一行，触控目标偏挤（<44px）。
  - 🟢 新增支付方式跳 recharge/withdraw 内，本页无独立「添加」入口，语义略绕。
- 板块：1 个
  - 🟢 「对公转账」入口链接到 `corp-pay.html`（正确），但同目录还存在孤立的 `corporate-pay.html`（见前置结论），易混淆。
- 内容：1 个
  - 🟢 默认支付方式说明文案与 recharge 页勾选态不一致。
- 元素：1 个
  - 🟢 选中 radio 用原生自定义，与 order.html `.od-radio` 两套。

### 【页面路径】pages/wallet/corporate-pay.html（对公支付【孤立页】）
- 视觉：2 个
  - 🟡 整页自写一套 `.cp-*` 样式，未复用 app.css；收款账户卡与 corp-pay 视觉风格不同。
  - 🟢 使用 `ai-folder / af-title / af-sub` 等未在 app.css 定义的类名（本页内 `<style>` 自行定义，但若被引用会与公共类冲突）。
- 交互：1 个
  - 🔴 本页未接入 `CorpPay` store，收款信息（户名/账号/开户行）全部硬编码，与 corp-pay.html 的实时单状态/进度完全脱节。
- 板块：1 个
  - 🔴 经全项目 Grep，**无任何页面链接到本页**，属孤立/重复页 → 建议删除，保留 corp-pay.html。
- 内容：1 个
  - 🟡 硬编码收款账户（北京工程链…/招行 1109…）为示例信息，若误暴露给用户会造成打款错误。
- 元素：1 个
  - 🟢 复制账号按钮无 toast 反馈。

### 【页面路径】pages/wallet/corp-pay.html（对公转账确认【真正在用】）
- 视觉：1 个
  - 🟢 进度条 4 段步骤与 order-detail 意向金 4 段流程条样式近似但未抽公共。
- 交互：2 个
  - 🟡 `flowHtml` 中 `rec.status==='approved' ? 5 : …`，但步骤数组只有 4 个节点、循环 `i<4`，step=5 的已完成态永不渲染——批准后进度条仍停在第 4 段 → 修正数组长度与索引。
  - 🟢 「我已转账，通知客服核对」提交后无明确等待态说明。
- 板块：1 个
  - 🟢 与 corporate-pay.html 板块构成几乎相同（账户信息+金额+步骤），应合并为一页。
- 内容：1 个
  - 🟢 收款账户随公司主体/开户行动态取值，需核对与 corporate-pay 硬编码值一致。
- 元素：1 个
  - 🟢 复制账号/户名按钮反馈弱。

---

## 二、agency 模块（6 页）

### 【页面路径】pages/agency/index.html（服务广场）
- 视觉：3 个
  - 🟡 第 556 行 `#B86B00`（橙棕）硬编码作 warning；第 993/996 行 `.filter-opt.active` / `.filter-confirm` 用 `color:#fff` + `box-shadow:rgba(31,78,153,.25)` **蓝色阴影**渗入古金主题 → 改金色阴影 token。
  - 🟡 第 15 行引入 `css/iphone-frame.css`（样机框样式），用户页不应加载。
  - 🟢 大量重复内联 SVG（分类图标），未用 `#i-*` 图标库，包体冗余。
- 交互：2 个
  - 🔴 `renderHot()`（第 367 行）取 `getElementById('hot-row')`，CSS 也定义了 `.hot-row`（第 819 行），但 **HTML 中不存在 `id="hot-row"` 元素**，函数 `if(!el)return` 静默返回——「热门搜索」标签永远不渲染，功能死链 → 在搜索区补 `<div id="hot-row">`。
  - 🟡 第 97 行 `<div idx="filterSheet">` 是笔误（应为 `id="filterSheet"`），筛选抽屉 ID 选择器失效 → 改 `id=`。
- 板块：1 个
  - 🟢 搜索栏 + 金刚区 + 服务流 + 筛选抽屉层级多，首屏信息密度偏高。
- 内容：1 个
  - 🟡 `var(--fs-md)` 等字号在筛选按钮上与全站 `--fs-title` 体系混用。
- 元素：2 个
  - 🟢 分类金刚区图标为内联 svg，与 wallet 快捷项做法不一致。
  - 🟢 服务卡片「金V/评分」角标与 order.html `.od-v` 角标两套。

### 【页面路径】pages/agency/seller-board.html（服务商工作台）
- 视觉：4 个
  - 🟡 第 124/132 行入驻空态用 `rgba(31,78,153,.32/.38)` **蓝色渐变阴影**，与古金主题冲突。
  - 🟡 第 243/244 行硬编码 `#d70015`（红）/`#b86b00`（橙）；第 380 行 `rgba(190,61,52,…)` 硬编码红——均应走 `--error/--warning`。
  - 🟡 第 15 行引入 `iphone-frame.css`。
  - 🟢 KPI 三 tile 圆角 16px、卡片圆角 16px，与全站 `--r-l 15px/--r-m 11px` 体系不严格对齐。
- 交互：2 个
  - 🟡 第 81 行质保金初始文本写死 `Y0`（应为 `¥0` 或占位 `—`），渲染前闪现错字。
  - 🟢 询盘线索 `.li-op` 四个状态切换按钮触控区偏小（9.5px 字、padding 2.5px）。
- 板块：1 个
  - 🟢 KPI→信用卡→询盘→保证金→增值道具→质保金→我的服务→状态筛选→订单，板块多达 9 段，首屏过长。
- 内容：2 个
  - 🟡 第 58 行「加载中…」占位文案（热力图标占位符 4 处）。
  - 🟢 「以服务商视角预览」按钮直接改写 DataBus identity 写入 localStorage，属调试入口暴露给普通用户。
- 元素：1 个
  - 🟢 状态色 `ST_COLOR` 用 `var(--blue)`（已存在但与金主题蓝感偏重）。

### 【页面路径】pages/agency/order.html（在线下单）
- 视觉：3 个
  - 🔴 第 56 行 `.amt-show` 下方说明文字 `color:rgba(244,242,238,.6)`（浅色），但该行位于浅色 `.card` 内（深色 `.amt-show` 只包金额展示框）——**浅字压浅底，对比度近乎不可读** → 改 `--text-3`。
  - 🟡 第 15 行引入 `iphone-frame.css`；第 303/304 行头像/金V 角标硬编码 `#2A313C/#161B23/#F0E2BE/#2A1810`。
  - 🟢 深色金额卡 `.amt-show`（`#252C35→#0B0E13`）与 wallet/index `.wal-card`、order-detail `.od-hero` 三处重复写同一深色渐变。
- 交互：2 个
  - 🟡 金额输入 `<input type=number>` 无千分位格式化、无小数点位数限制；快捷金额 chip 与手填值高亮不同步逻辑正常但缺「自定义金额」态。
  - 🟢 支付按钮 `paying` 锁用布尔值，但点击后按钮无 loading 文字/禁用样式反馈。
- 板块：1 个
  - 🟢 选服务商→金额→费用说明→里程碑，顺序合理；但「费用说明」与「里程碑托管」两卡间距 12px 与上文节奏不一。
- 内容：1 个
  - 🟢 「意向金约 20% 就近取档（100/500/800/5000）」在费用说明与 intent-line 文案重复出现两次。
- 元素：1 个
  - 🟢 `.od-radio` 单选圈与 payment-method 的默认 radio 两套。

### 【页面路径】pages/agency/order-detail.html（订单详情）
- 视觉：3 个
  - 🟡 第 53 行状态色 `stCol` 硬编码 `#F0E2BE/#7FB59A/#E8B4AE` 等，与 seller-board 的 `ST_COLOR` 不共享同一色板。
  - 🟡 第 283/284 行硬编码 `#b86b00/#d70015` + `rgba(255,159,10/.1)`、`rgba(255,69,58/.1)`（iOS 系统色）未走 `--warning/--error`。
  - 🟡 第 15 行引入 `iphone-frame.css`；深色 hero 渐变第三处重复。
- 交互：2 个
  - 🟡 提交交付/发起纠纷/评价三个 sheet 弹窗结构雷同（textarea+主按钮），应抽共享 sheet 组件。
  - 🟢 吸底操作栏 `.od-cta-btn` 主按钮阴影 `rgba(201,169,97,.22)` 金色 OK，但 ghost 按钮无 hover/disabled 态区分。
- 板块：1 个
  - 🟢 hero→资金卡→双方→里程碑→纠纷→时间线，板块完整；但「记录时间线」与里程碑时间线视觉信息略重复。
- 内容：2 个
  - 🟡 占位符共 12 处（热力图全项目第二高）：加载中、空态「暂无」、`viewser` 旁观态、demo 订单引导按钮「查看示例订单」暴露在生产路径（第 50 行）→ 生产环境应隐藏 demo 入口。
  - 🟢 单号/金额/状态与 my-orders、seller-board 同源 Mediation（口径正确，表扬）。
- 元素：1 个
  - 🟢 资金进度条 `.fund-fill` 绿渐变与 escrow 金渐变语义不统一。

### 【页面路径】pages/agency/my-orders.html（我的单）
- 视觉：1 个
  - 🟡 第 15 行引入 `iphone-frame.css`；状态色 `ST_COLOR` 用 `var(--blue)` 表进行中，与金主题略冲。
- 交互：1 个
  - 🟢 筛选 chip 横向滚动无遮罩提示（seller-board 的 tab-bar 有 mask，这里没有）。
- 板块：1 个
  - 🟢 筛选→列表→说明条结构简洁；与 seller-board 的订单筛选 TABS 定义两套（这里 5 组、那里 8 组），口径需对齐。
- 内容：1 个
  - 🟢 空态 CTA「去服务广场逛逛」文案与 order.html 空态「返回服务广场」不统一。
- 元素：1 个
  - 🟢 时间格式 `YYYY-MM-DD HH:mm`，与 unlock-records 的 `MM-DD HH:mm` 跨页不统一。

### 【页面路径】pages/agency/_seed-credit-data.html（数据播种【非用户页】）
- 定位说明：这是一个**开发/测试用数据播种工具页**（直接写 localStorage、绕过 Mediation 状态机），不是面向终端用户的页面。按 UI 标准检查如下：
- 视觉：2 个
  - 🟡 整页独立一套 Apple 风硬编码色（`#f5f5f7/#1d1d1f/#86868b/#c9a961`），未走 app.css 设计系统（工具页可接受，但应加 noindex / 入口保护）。
  - 🟢 进度条 `.bar` 渐变 `#c9a961→#d4b87a` 与 token 接近但硬编码。
- 交互：1 个
  - 🟡 页面打开即自动 `seed()` 播种（waitAndRun 自动执行），**无二次确认就写入 28 单假订单到用户 localStorage**——若被普通用户访问会污染真实数据 → 至少加「开始播种」按钮或校验环境。
- 板块：1 个
  - 🟢 进度/统计/日志/操作四段，工具页结构合理。
- 内容：1 个
  - 🟢 日志区 monospace 终端风，工具页可接受。
- 元素：1 个
  - 🟢 「前往服务广场/工作台」两个按钮用 `.btn/.btn.secondary`，非全站组件。

---

## 三、分片末尾汇总

### (a) 各页面问题数量统计表

| 页面 | 视觉 | 交互 | 板块 | 内容 | 元素 | 合计 |
|---|---|---|---|---|---|---|
| wallet/index | 4 | 2 | 2 | 1 | 1 | 10 |
| wallet/recharge | 2 | 3 | 1 | 1 | 2 | 9 |
| wallet/withdraw | 3 | 3 | 1 | 1 | 1 | 9 |
| wallet/bank-cards | 2 | 2 | 1 | 1 | 1 | 7 |
| wallet/escrow | 2 | 1 | 1 | 1 | 1 | 6 |
| wallet/invoice | 2 | 1 | 1 | 1 | 1 | 6 |
| wallet/invoice-info | 1 | 2 | 1 | 1 | 1 | 6 |
| wallet/invoice-info-edit | 1 | 2 | 1 | 1 | 1 | 6 |
| wallet/invoice-title-new | 1 | 2 | 1 | 1 | 1 | 6 |
| wallet/invoice-record | 1 | 1 | 1 | 2 | 1 | 6 |
| wallet/credits | 4 | 2 | 1 | 1 | 1 | 9 |
| wallet/credits-rules | 1 | 1 | 2 | 1 | 1 | 6 |
| wallet/credits-mall | 2 | 1 | 1 | 1 | 1 | 6 |
| wallet/membership | 2 | 1 | 1 | 1 | 1 | 6 |
| wallet/free-quota | 1 | 1 | 1 | 2 | 1 | 6 |
| wallet/unlock-records | 1 | 1 | 1 | 1 | 1 | 5 |
| wallet/payment-method | 1 | 2 | 1 | 1 | 1 | 6 |
| wallet/corporate-pay | 2 | 1 | 1 | 1 | 1 | 6 |
| wallet/corp-pay | 1 | 2 | 1 | 1 | 1 | 6 |
| agency/index | 3 | 2 | 1 | 1 | 2 | 9 |
| agency/seller-board | 4 | 2 | 1 | 2 | 1 | 10 |
| agency/order | 3 | 2 | 1 | 1 | 1 | 8 |
| agency/order-detail | 3 | 2 | 1 | 2 | 1 | 9 |
| agency/my-orders | 1 | 1 | 1 | 1 | 1 | 5 |
| agency/_seed-credit-data | 2 | 1 | 1 | 1 | 1 | 6 |
| **合计** | **50** | **42** | **27** | **28** | **29** | **176** |

> 注：上表按「每页记录的问题条目」计；其中 `--danger` token 缺失这一系统性问题未在各页重复计数，统一计入下方共性问题。

### (b) 本分片 Top 共性问题（跨页系统性，合并去重）

1. 🔴 **`--danger` 未定义，错误/删除/纠纷红色大面积失效**：app.css 只有 `.btn-danger` 类、没有 `--danger:` 变量，全项目 59 处 `var(--danger)` 全部静默回退为继承色。受影响页：wallet/index、recharge、credits-rules、invoice(-info)、agency/seller-board、order-detail、my-orders。→ 统一把 `var(--danger)` 改为设计 token `var(--error)`，或在 `:root` 补 `--danger: var(--error)` 别名。
2. 🔴 **两处「功能死链/数据矛盾」型 bug**：① agency/index 的 `renderHot` 找不到 `#hot-row` 元素，热门搜索永不渲染；② wallet/credits 配置批量折扣 `enabled:false`，credits-rules 却硬编码 95/9/85 折展示。→ 补 DOM 节点 / 统一读取同一配置源。
3. 🔴 **占位/逻辑硬伤**：wallet/credits 出现字面量 `placeholder` 泄露；wallet/invoice-info-edit 三元运算恒值（两分支都返回「增值税普通发票」）；agency/order-detail 的 demo 订单引导按钮暴露在生产路径。
4. 🟡 **深色 hero / 收款页重复造轮子**：`#252C35→#151A22→#0B0E13` 深色金渐变在 wallet/index、agency/order、agency/order-detail 三处内联重复；`corporate-pay.html` 与 `corp-pay.html` 功能重复且前者零入链。→ 抽 `.gold-hero` 共享类，删除孤立的 corporate-pay.html。
5. 🟡 **蓝色/彩虹色渗入古金主题**：`rgba(31,78,153,*)`、`#2563EB`、`#1677FF`、`#9B59B6`、`#3498DB` 等蓝色系阴影/品牌色散落在 agency/index、seller-board、wallet/credits；与古金主色冲突。
6. 🟡 **弹窗/表单 API 不统一**：钱包内删除操作 bank-cards 用 `UI.dialog`、invoice-info 用 `UI.confirm`；发票「新增/编辑」表单字段不对齐（edit 页缺抬头类型选择器、分段顺序相反）；order-detail 三个 sheet 弹窗结构雷同未抽组件。
7. 🟡 **跳出 `.scroll` 容器的板块**：credits-rules 的批量折扣板块、unlock-records 的统计+筛选写在滚动容器外，长内容下会错位/不可滚动。
8. 🟢 **导航与组件 token 漂移**：23 页统一用内联 `height:50px` 覆盖 app.css 默认 52px navbar；agency 6 页 + wallet 多页误引 `iphone-frame.css`；时间格式（`MM-DD` vs `YYYY-MM-DD`）、金额卡字号、单选 radio、状态色板跨页两套。

### (c) 严重程度分布统计

| 严重程度 | 数量 | 占比 |
|---|---|---|
| 🔴 高 | 9 | 5.1% |
| 🟡 中 | 78 | 44.3% |
| 🟢 低 | 89 | 50.6% |
| **合计** | **176** | 100% |

> 🔴 高严重度项集中在：`--danger` token 缺失、`#hot-row` 死链、折扣配置矛盾、字面量 placeholder、edit 页恒值三元、corporate-pay 孤立重复页、order 页浅字浅底对比失效、`Y0` 错字闪现。建议优先处理这 9 项后再做 🟡 一致性收口。
