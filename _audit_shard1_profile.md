# Engchain3.0 · Profile 模块 UI/UX 代码审计报告（分片一：31 页全量）

> 审计对象：`D:\Engchain3.0\pages\profile\*.html`（31 页）
> 审计方式：纯代码静态分析（Read/Grep/Glob），未做浏览器渲染
> 设计基线：`css/app.css :root`（--primary #C9A961 / --error #B3261E / --success #2B6B4F / 圆角 --r-* / .navbar 默认 52px）
> 严重程度：🔴 高（影响功能/明显错误/无法完成操作） · 🟡 中（体验/一致性） · 🟢 低（细节打磨）

---

## 逐页问题清单

【页面路径】pages/profile/index.html
├── 视觉：5个
│   ├── 🔴 在本页 `:root` 自建整套 `--me-*` 设计令牌（L24-82：--me-gold #C9A961、--me-text/--me-bg/--me-radius 等），并自写 `[data-theme=dark]` 全套暗色（L61-82），与 app.css 的 --primary/--ink-*/--r-* 体系完全平行 → 删除本地 :root，统一改用 var(--primary)/var(--ink-*) 等系统令牌
│   ├── 🟡 `.quick-icon` 六套彩虹色（L851-856：#4A8A5E/#4A7AA5/#B5554A/#B58040/#6A5AA5）与"金色主调"品牌冲突，且不映射到系统功能色（--info/--success/--error）
│   ├── 🟡 自造圆角/阴影：--me-radius-lg:22px（系统 --r-2xl=24px）、--me-shadow-1/2/3 三套
│   ├── 🟡 头部无 `.navbar`（沉浸式 v12-header），与其余子页 50/52px 顶栏高度不统一
│   └── 🟢 `.me-tabs` 用 backdrop-filter 玻璃胶囊，在低性能 webview 上有掉帧风险
├── 交互：3个
│   ├── 🟡 tool-item/order-item/kpi-item 均为 `div+onclick`（L3130/L3078/L2635），无 `<a>`，键盘/读屏不可达
│   ├── 🟡 触控目标过小：`.quick-lock` 16px（L820）、`.quick-badge` 16px（L865）、`.me-avatar-edit` 20px（L155），均 <44px
│   └── 🟢 is-locked 仅 `opacity:.5+grayscale(.5)`（L3141），无 disabled/aria 提示
├── 板块：1个
│   └── 🔴 死 CSS 残留：`.id-ticket/.tk-*/.wallet-card/.order-card/.kpi-strip/.quick-grid/.bento`（L375-890）在 V12 改造后 body 已改用 `.v12-*`，约 500 行无效样式
├── 内容：2个
│   ├── 🟡 页脚硬编码 `UID: 10086233`、`Version 3.0.0 (Build 2026.08)`（L2695-2696）
│   └── 🟡 诚信分 fallback 为固定值 80（L3274），未取到数据时无"暂无"空态
└── 元素：3个
    ├── 🟡 图标双轨：`<use href="#i-*">` 与内联 feather path 混用，`i-rotate` 还特判一段内联 SVG（L3137）
    ├── 🟡 登录引导 sheet 用 34px `🔐` emoji 作主视觉（L3163），与 SVG 图标体系不符
    └── 🟡 诚信分等级色硬编码 `#C9A961/#8A8A8A/#B87333`（L3285）

【页面路径】pages/profile/my-applies.html
├── 视觉：2个
│   ├── 🟡 `.rmc-*` 自绘，图标/进度条硬编码金色渐变 `#C9A961→#A98A47`
│   └── 🟡 驳回态用 `rgba(200,60,60,.1)`，与 --error #B3261E(179,38,30) 不一致
├── 交互：1个
│   └── 🟡 `.apply-item` 整卡 `div+onclick` 非 `<a>`，键盘不可达
├── 板块：1个
│   └── 🟡 "简历设置"入口与右侧编辑按钮同跳 `resume-edit.html`，重复入口
├── 内容：0个
└── 元素：1个
    └── 🟡 状态徽标 10px 偏小；内联 SVG 与 #i-* 图标混用

【页面路径】pages/profile/resume-edit.html
├── 视觉：4个
│   ├── 🔴 全页内联 feather 风格 SVG（L223/251/275/...），完全不走 #i-* sprite，与全站图标系统脱节
│   ├── 🟡 金色硬编码数十处（.rpb-fill L24、.save-btn L72、.voice-btn L146、.ai-panel-icon L129 等）
│   ├── 🟡 录音态用 Bootstrap 红 `#e74c3c/#c0392b`（L148），离系统错误色 --error
│   └── 🟡 冗余 fallback：`var(--bg,#F5F3EE)`、`var(--bg-card,#fff)`、`var(--line,#E8E4DC)`（L16/29），变量已存在属多余
├── 交互：4个
│   ├── 🟡 触控过小：.list-item-del 24px（L55）、.resume-file-btn 30px（L109）、.ai-panel-close 30px（L134）
│   ├── 🟡 删除教育/工作/项目条目无二次确认直接 splice（delEdu L824/delWork/delProject）
│   ├── 🟡 同页两套弹窗：自建 .modal-mask/.modal-box（L76-90）与 UI.sheet（L787）并存
│   └── 🟡 预览用 `window.open` + `data:` iframe（L677-683），易被弹窗拦截/CSP 拦截
├── 板块：0个
├── 内容：2个
│   ├── 🔴 AI 生成 project_desc 模板含字面占位 `X万㎡/X亿元/X天/X%`（L1124-1127），生成结果带 X 空格误导用户自行填写
│   └── 🟡 空态文案"点击右上角添加"（L700/713/727），实际添加按钮在分组标题行右侧，位置描述不准
└── 元素：2个
    ├── 🟡 选择值把 `›` 直接拼进文本（L244 f-jobstatus / L268 f-arrival），非 .arrow 组件
    └── 🟢 默认手机号 `138****8866` 占位

【页面路径】pages/profile/privacy.html
├── 视觉：2个
│   ├── 🟡 自建 `.confirm-mask/.confirm-box` 二次确认，未用系统 UI.dialog/.sheet
│   └── 🟡 屏蔽/解除按钮用 `rgba(200,60,60)` 珊瑚红，未走 --error
├── 交互：1个
│   └── 🟡 关闭/操作小钮 24px 触控不足
├── 板块：1个
│   └── 🟡 `.privacy-fixed-header` 实为普通文档流（flex:none），命名为 fixed 却未真正固定，误导
├── 内容：1个
│   └── 🟡 MOCK 公司名直接拼入 innerHTML 未 esc
└── 元素：1个
    └── 🟡 "已屏蔽"为灰底按钮，点击却触发"解除屏蔽"，状态色与动作语义相反

【页面路径】pages/profile/auth-qualification.html
├── 视觉：2个
│   ├── 🟡 `var(--danger)` 裸用（L1654）与带 fallback `#d44c47`（L1674/1680）混用；因 --danger 未定义，裸用处驳回色失效
│   └── 🟡 `.au-pill-done` 硬编码 `#4caf50` 亮绿（L1757），离 --success #2B6B4F
├── 交互：2个
│   ├── 🟡 `.item-action-btn` 编辑/删除 32×32（L1703）<44px；checkbox 16×16（L177/183）
│   └── 🟡 `.aq-del` 删除小钮触控偏小
├── 板块：0个
├── 内容：1个
│   └── 🔴 toast `'已选择学历证书（原型模拟）'`（L966）把"原型模拟"字样泄露给终端用户
└── 元素：1个
    └── 🟢 提示文案含 `📷` emoji（L45），✓ 字符代替对勾图标

【页面路径】pages/profile/auth.html
├── 视觉：3个
│   ├── 🟡 `.au-hero` 深色 `#252C35→#0B0E13`（L468），与 auth-result/entry-* 的金色 hero 风格不统一
│   ├── 🟡 `.au-ring-fg` 描边 `stroke:#C9A961` 硬编码（L499），应 var(--primary)
│   └── 🟡 `.au-bar-blue/.au-rel-dot-blue` 用 `#5B8DB8/#4A7A9E`（L551/570-571），离系统 --info #2563EB
├── 交互：1个
│   └── 🟡 关系图分叉线用 `calc(50vw - 60px)`（L542）定位，宽屏/异形屏易错位
├── 板块：1个
│   └── 🟡 同页"身份关系图+基石卡+双列卡+链式企业卡"信息密度偏高
├── 内容：0个
└── 元素：1个
    └── 🟡 状态点用 `✓/!/↓` 字符（L151/193/123）代替 SVG 图标

【页面路径】pages/profile/auth-prep.html
├── 视觉：1个
│   └── 🟡 AI 语音图标 `#5B8DB8` 硬编码，离系统 --info
├── 交互：2个
│   ├── 🔴 `aiFill()` 仅播放 loading 后 toast"AI已为您准备示例信息"，实际未填入任何字段——虚假成功反馈
│   └── 🟡 语音引导 audio 恒为 `ai-guide-realname.wav`，与当前 type（entry/partner/qual）不匹配
├── 板块：0个
├── 内容：1个
│   └── 🔴 TYPES 仅 realname/qualification/partner/enterprise/entry；settings 与 all-functions 传入 `type=pro/resident/center` 不在表内，会静默回退 realname 个人认证页——路由错误
└── 元素：0个

【页面路径】pages/profile/auth-enterprise.html
├── 视觉：3个
│   ├── 🟡 `var(--danger)` 裸用 L189/191/535/540/586 失效（未定义）
│   ├── 🟡 `.ap-field label` 宽 72px（L560），错误提示 `padding-left:84px`（L586）与 label 错位 12px
│   └── 🟡 `.ae-cta` 覆盖 left/right:14px（L569），离系统 .fixed-cta 16px
├── 交互：3个
│   ├── 🟡 支付 sheet 用 emoji `💳💚💙🏦` 作支付方式图标（L429-432）
│   ├── 🟡 审核进度条 `width:55%` 写死（L578）
│   └── 🟡 pay-btn 通过 `document.addEventListener('click')` 按 id 委托（L495），脆弱
├── 板块：0个
├── 内容：1个
│   └── 🟡 banner"1-3个工作日"与支付 sheet"24小时内人工复核"时效表述不一致
└── 元素：1个
    └── 🟢 对公账号 `6222 **** **** 8888` 样例

【页面路径】pages/profile/auth-personal.html
├── 视觉：3个
│   ├── 🟡 `var(--danger)`（L251 身份证错误色）未定义失效
│   ├── 🟡 `.ap-field label` 宽 64px（与企业页 72px 不一致）
│   └── 🟡 人脸遮罩 `rgba(11,14,19,.92)` 硬编码
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟢 `✓` 字符代替对勾；mock id-front.jpg

【页面路径】pages/profile/auth-partner.html
├── 视觉：3个
│   ├── 🟡 `var(--danger)` L407/465/466 失效，叠加 `rgba(212,76,71)` 珊瑚红
│   ├── 🟡 `.ap-banner-ic` 用金色渐变，与 auth-personal 的 primary-soft 平涂不一致
│   └── 🟡 收益卡深色 `#252C35` 与同流程其它卡片风格割裂
├── 交互：0个
├── 板块：1个
│   └── 🟡 `mode=detail` 死代码分支保留
├── 内容：0个
└── 元素：0个

【页面路径】pages/profile/auth-result.html
├── 视觉：2个
│   ├── 🔴 `var(--danger)`（L116）未定义 → 驳回态图标/时间线红色失效，回落为继承深色
│   └── 🟡 `.ar-reward/.ar-head` 等组件样式写在本页 `<style>`，未沉淀 app.css，与 entry-review/entry-personal-result 重复
├── 交互：0个
├── 板块：1个
│   └── 🟡 代码内含 `[REVOKE]` 类 TODO/注释残留
├── 内容：0个
└── 元素：0个

【页面路径】pages/profile/auth-payment.html
├── 视觉：0个
├── 交互：0个
├── 板块：1个
│   └── 🔴 整页为"该功能已迁移"占位死页（L29），仍可由导航/历史到达，应直接 301 跳转 auth.html 或下线
├── 内容：0个
└── 元素：0个

【页面路径】pages/profile/entry.html
├── 视觉：3个
│   ├── 🟡 `.et-rail` 三色编码：建筑蓝 `#5B8DEF`、合伙人紫 `#8E7CC3/#6B5B95`（与系统 --purple #7C5BBD 不符）
│   ├── 🟡 建筑层"工业奢华"深色大卡与中介/合伙人两层卡片风格割裂
│   └── 🟡 `.et-card-core` 规则 `!important` 泛滥
├── 交互：1个
│   └── 🟡 `.et-cmp-blur` 对中介列模糊成"联系客服"，付费墙式模糊但无明确解锁 CTA
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟡 `✓` 字符、`div[style*="font-size:11px"]` 属性选择器脆弱

【页面路径】pages/profile/entry-form.html
├── 视觉：2个
│   ├── 🟡 `var(--danger)` L627/783/913/916/917/934 失效（必填星、错误色、删除态）
│   └── 🟡 "省10%"优惠标用红底 `#fff0f0`（L627），优惠应金/绿而非红
├── 交互：3个
│   ├── 🟡 步骤指示器圆点 `cursor:pointer` 但无点击跳转处理（L898）——死交互
│   ├── 🟡 触控过小：.ef-card-del 28px、.ef-case-img-del 20px、.ef-att-del 24px
│   └── 🟡 本页支付 sheet 仅"余额支付"一种，auth-enterprise 给 4 种——两个付费墙支付方式不一致
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟡 select 下拉箭头 data-uri 内硬编码 `%23999`（#999，L923）

【页面路径】pages/profile/entry-review.html
├── 视觉：3个
│   ├── 🔴 `var(--danger)` L244/266/267 未定义失效
│   ├── 🟡 `.er-head-*` 配色从 auth-result 复制（#FBF4E4/#F6ECD2/#F3EBD6 等硬编码），跨页重复样式未沉淀
│   └── 🟡 标签宽并存：`.ap-field label` 64px、`.er-kv-k` 72px（一页内两套）
├── 交互：1个
│   └── 🟡 "↻ 刷新审核状态"按钮与提示"自动更新无需重复提交"自相矛盾
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟢 `↻/✓` 字符代替图标

【页面路径】pages/profile/entry-result.html
├── 视觉：3个
│   ├── 🟡 `<title>入驻成功</title>` 与导航栏标题"入驻信息"不一致
│   ├── 🟡 `.es-hero` 深色 `#252C35→#0B0E13`，与 auth-result 金色 hero 不统一
│   └── 🟡 `.ap-field label` 宽 88px（又一值，与 64/72/80 并存）
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟡 `✓` 字符；`.clamp-box` 展开组件自绘未沉淀

【页面路径】pages/profile/entry-personal-result.html
├── 视觉：2个
│   ├── 🟡 `.pr-rc-no` 用 `var(--danger)` 失效 + `#4caf50` 亮绿硬编码
│   └── 🟡 `.ap-field label` 宽 80px（又一值）
├── 交互：0个
├── 板块：0个
├── 内容：1个
│   └── 🟡 "查看简历" toast"简历预览功能开发中"——占位功能仍暴露给用户
└── 元素：1个
    └── 🟡 `.tag-gold` 内联覆盖 `background:rgba(201,169,97,.25);color:#EED697`

【页面路径】pages/profile/edit.html
├── 视觉：1个
│   └── 🟡 头像圆角 `22px`（L?）不在系统 --r-* token（4/7/11/15/19/24）中
├── 交互：3个
│   ├── 🟡 真实姓名 readonly 仅 `opacity:.6`，与可编辑输入框视觉区分弱，易误判可改
│   ├── 🟡 bio 200 字限制无字数统计
│   └── 🟡 save 时 name 为空 fallback 硬编码"陈建国"
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟢 输入框无清除按钮

【页面路径】pages/profile/edit-profile.html
├── 视觉：2个
│   ├── 🔴 自建 `.toast/.save-bar/.avatar-sheet` 组件，未复用 UI.toast/.fixed-cta/.sheet
│   └── 🟡 预设头像六套离系统色（#5B9A6F/#5B8AB5/#D4655A/#8B7BB5/#5BA5B5/#B5805A）
├── 交互：1个
│   └── 🟡 `.save-btn` 46px vs 系统 .btn 50px
├── 板块：1个
│   └── 🔴 与 edit.html 功能重复（均"编辑个人资料"），两套 UI 并存
├── 内容：2个
│   ├── 🔴 城市/手机号/微信号/上传头像均 toast"演示环境暂未开放"——多个假功能占位
│   └── 🟢 `var(--text-3,#999)` 冗余 fallback
└── 元素：0个

【页面路径】pages/profile/settings.html
├── 视觉：1个
│   └── 🟡 `.row-icon` 三语义色混用（accent/success/accent），三个认证与入驻项全金色图标——金色图标滥用
├── 交互：1个
│   └── 🟡 row 为 `div+onclick` 非 `<a>`
├── 板块：1个
│   └── 🟡 "帮助中心"与"意见反馈"同链 `help/index.html`，未区分
├── 内容：0个
└── 元素：0个

【页面路径】pages/profile/general-setting.html
├── 视觉：0个
├── 交互：3个
│   ├── 🟡 "深色模式"checked 与"跟随系统"unchecked 两开关无联动互斥
│   ├── 🟡 "简体中文 ›"箭头拼进 value 文本，非 .arrow 组件
│   └── 🟡 "清理缓存 28.4MB"整行 onclick 才触发，文案未暗示可点
├── 板块：0个
├── 内容：0个
└── 元素：0个

【页面路径】pages/profile/notify.html
├── 视觉：0个
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：0个
（本页实现规范：row-icon 三语义色 accent/success/warning 使用合理，无显著问题）

【页面路径】pages/profile/security.html
├── 视觉：1个
│   └── 🟡 "切换账号"按钮硬编码 `rgba(212,101,90,.35/.06)`（L45）珊瑚红，未走 --error token
├── 交互：0个
├── 板块：0个
├── 内容：1个
│   └── 🟡 客服热线 `400-000-0000`、登录手机 `138****8866` 占位
└── 元素：1个
    └── 🟢 其余结构规范

【页面路径】pages/profile/contact.html
├── 视觉：0个
├── 交互：1个
│   └── 🔴 "联系方式公开"开关 checked=开启，但 note 写"目前为隐藏态"——开关状态与说明文案矛盾
├── 板块：0个
├── 内容：2个
│   ├── 🟡 手机号 `value="138****88 66"` 中间多余空格（L27）
│   └── 🟡 编辑态输入框显示脱敏手机号，逻辑矛盾（脱敏后无法修改）；公司名"四川省××建设有限公司"占位
└── 元素：1个
    └── 🟡 `.green` 类实为金色 --primary-dim（L25"隐藏态"用），类名与颜色语义不符

【页面路径】pages/profile/history.html
├── 视觉：2个
│   ├── 🔴 自建 `--vh-*` 令牌 + `.vh-navbar` 48px，与系统 .navbar 52px、其它页内联 50px 三方不一致
│   └── 🟡 自建 confirm 弹窗，未用 UI.dialog
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟢 深色历史项卡片自绘

【页面路径】pages/profile/delegates.html
├── 视觉：1个
│   └── 🟡 `.navbar` 内联 height:50px，偏离系统 52px
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟢 由 delegates.css/js 驱动，结构较干净

【页面路径】pages/profile/delegate-new.html
├── 视觉：1个
│   └── 🟡 `.navbar` 内联 height:50px，偏离系统 52px
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：0个

【页面路径】pages/profile/delegate-edit.html
├── 视觉：1个
│   └── 🟡 `.navbar` 内联 height:50px，偏离系统 52px
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟡 空态/按钮 svg stroke-width 1.8 与 2 混用

【页面路径】pages/profile/delegate-detail.html
├── 视觉：1个
│   └── 🟡 `.navbar` 内联 height:50px，偏离系统 52px
├── 交互：0个
├── 板块：0个
├── 内容：0个
└── 元素：1个
    └── 🟡 空态/按钮 svg stroke-width 1.8 与 2 混用

【页面路径】pages/profile/all-functions.html
├── 视觉：2个
│   ├── 🟡 自建 `--af-*` 令牌（--af-gold #C9A961 等同系统），又一份平行令牌
│   └── 🟡 `.af-icon` 七套离系统 pastel 色（#4A8A5E/#4A7AA5/#B5554A/#B58040/#6A5AA5/#8A8275）
├── 交互：1个
│   └── 🟡 af-item 为 div+onclick，锁定项无 disabled 语义
├── 板块：1个
│   └── 🔴 分组计数错误："交易服务 6项"实为 7 项、"内容管理 3项"实为 6 项
├── 内容：1个
│   └── 🟡 footer 称"灰色图标为未开通"，但锁定项仍为彩色+锁标，文案与视觉不符
└── 元素：1个
    └── 🟡 图标 #i-* 与内联 SVG 混用；"年度会员"项硬编码 `background:#f5ecd7;color:#b8860b`

---

## 分片汇总

### (a) 各页面问题数量统计

| 页面 | 视觉 | 交互 | 板块 | 内容 | 元素 | 小计 |
|---|---|---|---|---|---|---|
| index.html | 5 | 3 | 1 | 2 | 3 | 14 |
| my-applies.html | 2 | 1 | 1 | 0 | 1 | 5 |
| resume-edit.html | 4 | 4 | 0 | 2 | 2 | 12 |
| privacy.html | 2 | 1 | 1 | 1 | 1 | 6 |
| auth-qualification.html | 2 | 2 | 0 | 1 | 1 | 6 |
| auth.html | 3 | 1 | 1 | 0 | 1 | 6 |
| auth-prep.html | 1 | 2 | 0 | 1 | 0 | 4 |
| auth-enterprise.html | 3 | 3 | 0 | 1 | 1 | 8 |
| auth-personal.html | 3 | 0 | 0 | 0 | 1 | 4 |
| auth-partner.html | 3 | 0 | 1 | 0 | 0 | 4 |
| auth-result.html | 2 | 0 | 1 | 0 | 0 | 3 |
| auth-payment.html | 0 | 0 | 1 | 0 | 0 | 1 |
| entry.html | 3 | 1 | 0 | 0 | 1 | 5 |
| entry-form.html | 2 | 3 | 0 | 0 | 1 | 6 |
| entry-review.html | 3 | 1 | 0 | 0 | 1 | 5 |
| entry-result.html | 3 | 0 | 0 | 0 | 1 | 4 |
| entry-personal-result.html | 2 | 0 | 0 | 1 | 1 | 4 |
| edit.html | 1 | 3 | 0 | 0 | 1 | 5 |
| edit-profile.html | 2 | 1 | 1 | 2 | 0 | 6 |
| settings.html | 1 | 1 | 1 | 0 | 0 | 3 |
| general-setting.html | 0 | 3 | 0 | 0 | 0 | 3 |
| notify.html | 0 | 0 | 0 | 0 | 0 | 0 |
| security.html | 1 | 0 | 0 | 1 | 1 | 3 |
| contact.html | 0 | 1 | 0 | 2 | 1 | 4 |
| history.html | 2 | 0 | 0 | 0 | 1 | 3 |
| delegates.html | 1 | 0 | 0 | 0 | 1 | 2 |
| delegate-new.html | 1 | 0 | 0 | 0 | 0 | 1 |
| delegate-edit.html | 1 | 0 | 0 | 0 | 1 | 2 |
| delegate-detail.html | 1 | 0 | 0 | 0 | 1 | 2 |
| all-functions.html | 2 | 1 | 1 | 1 | 1 | 6 |
| **合计** | **56** | **32** | **11** | **12** | **24** | **135** |

### (b) 本分片 Top 共性问题（跨页系统性问题，合并去重，按严重程度排序）

1. 🔴 **`var(--danger)` 未定义却被广泛引用**：auth-result(L116)、entry-review(L244/266/267)、auth-enterprise(L189/191/535/540/586)、auth-personal(L251)、auth-partner(L407/465/466)、entry-form(L627/783/913/916/917/934)、auth-qualification(裸用处 L1654)。app.css 只定义了 `--error:#B3261E`，没有 `--danger` → 所有驳回/必填/错误提示色静默失效，回落为继承色。**修复：全局把 `var(--danger)` 改为 `var(--error)`。**
2. 🔴 **顶栏高度三方不一致**：app.css `.navbar` 默认 52px，30 个子页内联 `style="height:50px;"`，history.html 又自建 `.vh-navbar:48px`，all-functions.html 则用默认 52px。**修复：去掉各页内联 height，统一改 app.css `.navbar` 一处。**
3. 🔴 **"假成功/死功能"交互泄露给用户**：auth-prep 的 aiFill() 声称已填充实际未填；edit-profile 多个字段 toast"演示环境暂未开放"；auth-qualification toast"（原型模拟）"；entry-personal-result"功能开发中"；auth-payment 整页死链。
4. 🔴 **重复造设计系统/组件**：index.html(`--me-*`)、history.html(`--vh-*`)、all-functions.html(`--af-*`)、edit-profile(自建 toast/save-bar/sheet)、resume-edit(自建 modal + 全页内联 feather 图标) 各自另起炉灶；`.ar-head/.er-head/.es-hero` 等组件样式跨页复制粘贴未沉淀 app.css。
5. 🟡 **功能/路由入口错误**：settings.html 与 all-functions 传 `type=pro/resident/center` 给 auth-prep，而 auth-prep.TYPES 无此键，静默回退"个人认证"页；edit.html 与 edit-profile.html 功能重复；my-applies 双入口同指一页。
6. 🟡 **字段 label 宽度多值并存**：64 / 72 / 80 / 84(--kv-label-w) / 88px 在 auth-*、entry-* 各页随意取值，同一表单流程内都不统一。
7. 🟡 **触控目标 <44px**：删除/编辑小钮普遍 20–32px（resume-edit 24/30、entry-form 20/24/28、auth-qualification 32、index 16/20、privacy 24）。
8. 🟡 **图标体系双轨**：全站 `<use href="#i-*">` sprite 与内联 SVG path 混用，resume-edit 全页内联、index/all-functions 部分内联。
9. 🟡 **功能色硬编码偏离 token**：珊瑚红 `rgba(212,76,71/200,60,60)`、亮绿 `#4caf50`、Bootstrap 红 `#e74c3c`、离系统蓝 `#5B8DB8` 在多页出现，未映射 --error/--success/--info。
10. 🟢 **字符代替图标**：✓ ! ↻ ↓ › 等 Unicode 字符散落 auth-*、entry-* 页。

### (c) 严重程度分布

| 严重程度 | 数量 | 占比 |
|---|---|---|
| 🔴 高 | 16 | 11.9% |
| 🟡 中 | 106 | 78.5% |
| 🟢 低 | 13 | 9.6% |
| **合计** | **135** | **100%** |
