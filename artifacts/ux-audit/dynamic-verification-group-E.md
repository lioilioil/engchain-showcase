# Phase 4 · 差异化体验对比 + 特殊状态验证（E组）

> **验证目标**：同一页面在不同状态 / 入驻类型 / 模式下的 UI 差异横向对比，以及 4 种特殊状态独立验证。
> **方法**：`computer_use_tool` plane=`bu` 实际操作内置浏览器，逐页面逐状态截图 + 提取可见文本 + 身份推导核验。
> **约束遵守**：未修改任何源代码；所有结论均来自实际浏览器操作；特殊状态验证后已恢复 resident-construction 默认态。

---

## 1. 验证环境说明

| 项 | 值 |
|---|---|
| 项目根 | `D:\Engchain3.0` |
| 本地服务 | `python -m http.server 8766`（后台，与 D 组 8766 端口隔离） |
| 访问基址 | `http://localhost:8766/...` |
| 浏览器 | 内置产品浏览器（plane=bu），直接打开各 App 页（非 preview iframe） |
| 状态注入 | 在已加载 stores 的页面用 `bu.js()` 写 `AuthStore/EntryStore/ModeStore/UI.state`，再导航到目标页（同 origin localStorage 持久化） |
| 身份核验 | 每页加载后回读 `deriveIdentity().primary/personal/enterprise/entryTypes`，确认状态生效 |
| 截图目录 | `D:\Engchain3.0\artifacts\ux-audit\` |
| 截图命名 | `CMP2_*`=6级状态对比；`CMP3_*`=入驻类型对比；`CMP4_*`=破冰/正式期对比；`SP1-4_*`=特殊状态 |

**关键环境注记（非产品 bug）**：内置后台浏览器对 CSS 入场动画 `.anim-in`（opacity:0→1, translateY）节流不自动播放，导致初次截图正文为空白。本组截图前统一用 `e.style.animation='none'; opacity=1` 强制到终态以捕获设计态。**前台真实浏览器会自动播放，此现象不计入产品问题**；但 profile/monitor 等页依赖 JS 触发入场动画，若触发条件不满足会留下"白屏正文"隐患，见 §6。

**身份注入要点（代码事实）**：`deriveIdentity()` 中 `pe = a.personalEntry || a.personalQual || a.qual`。因 store 默认值含 `personalEntry:{ok:false}`（真值对象），仅写 `qual` 会被遮蔽——pro 态必须同时写 `personalEntry.ok=true` 才推导为 `pro/professional`。preview 控制台 `syncBusinessState()` 只写 `qual` 不写 `personalEntry`，这意味着 preview 下拉切到"专业"在真机数据下可能仍推导为 realname，见 §7（疑似代码问题）。

---

## 2. 6 级状态横向对比（5 页面 × 6 状态）

状态轴：guest(0) → registered(1) → realname(2) → pro(3) → enterprise(4) → resident(5/construction)。
每页加载后均回读 `deriveIdentity()` 确认身份正确（6 状态身份全部推导正确）。

### 2.1 对比总表

| 页面 | guest | registered | realname | pro | enterprise | resident | 状态递进质量 |
|---|---|---|---|---|---|---|---|
| home.html | 同 resident | 同 resident | 同 resident | 同 resident | 同 resident | 同 resident | **极差：6态完全一致** |
| supply/detail.html?id=1001 | 免费查看(游客福利1/1) | 实名认证后免费解锁 | 今日免费解锁(剩10条) | 同 realname | 同 realname | 同 realname | 低端好、高端无差 |
| publish/index.html | 登录后使用·立即登录 | 实名认证后可发布·前往实名 | 全功能工作台 | 同 realname | 同 realname | 同 realname | **好**：低端逐级拦截 |
| wallet/index.html | 登录后查看钱包(锁图标) | 全钱包·金V徽标 | 全钱包·金V | 全钱包·金V | 全钱包·金V | 全钱包·金V+建筑8折 | 金V徽标错误 |
| profile/index.html | 游客Lv.0·锁定发布 | 注册会员Lv.1·引导实名 | 个人认证Lv.2·引导入驻 | 专业工程师Lv.3·引导企业 | 企业认证Lv.4 | 入驻企业Lv.5 | **最好**：Lv.0→Lv.5 |

截图证据：`CMP2_home_{guest,registered,realname,pro,enterprise,resident}.png`（6）、`CMP2_detail_*.png`（6）、`CMP2_publish_*.png`（6）、`CMP2_wallet_*.png`（6）、`CMP2_profile_*.png`（6），共 30 张。

### 2.2 逐页差异分析

**① home.html —— 零状态区分（E1）**
6 种状态下 `document.body.innerText` 长度全部为 **4998**，截图逐张比对完全一致：同一重点项目 banner、同一金刚区、同一资源列表。guest 与 resident 看到同一首页，无"登录后解锁更多"横幅、无注册 CTA、无升级引导。破冰期"共创者计划"卡片在两模式下都存在，不构成状态/模式差异。
- 复现：依次注入 6 态 → `home.html`，文本长度恒 4998。证据 `CMP2_home_guest.png` vs `CMP2_home_resident.png`（视觉无差）。

**② detail.html（材料·材料采购 id=1001）—— 低端好、高端无差**
- guest：底部 CTA「免费查看（游客福利 1/1）」，并自动弹出入驻引导 dialog（"暂不投递"）。
- registered：CTA「实名认证后免费解锁」。
- realname/pro/enterprise/resident：CTA 全部为「今日免费解锁（剩 10 条）」，文本与布局完全一致。
- 解锁价展示「98 积分/次」，平台服务费阶梯「破冰期首档优惠至 5%」。
- **E1**：realname→resident（已付费入驻）在解锁 CTA 上零差异——用户感知不到"升级了但解锁入口没变化"，8 折权益在详情页无任何体现。证据 `CMP2_detail_realname.png` vs `CMP2_detail_resident.png`（CTA 同文案）。

**③ publish/index.html —— 低端拦截优秀**
- guest：空态「登录后使用信息工作台」+「立即登录」。
- registered：空态「实名认证后可发布信息」+「前往实名认证」+「先看平台发布示例」。
- realname 及以上：完整信息工作台。
- 这是 5 页中低端权限引导最好的：逐级"为什么受限 + 下一步做什么"清晰。证据 `CMP2_publish_guest.png`/`_registered.png`/`_realname.png`。

**④ wallet/index.html —— 金 V 徽标错误（E1）**
- guest：正确拦截（锁图标「登录后查看钱包」）。
- registered/realname/pro/enterprise：余额卡统一显示 **「金 V」** 徽章——这些身份都未入驻，按设计金 V 仅属中介；且 registered 未实名即见完整余额/提现。
- resident(construction)：积分卡副标题正确变为「建筑企业 · 解锁 8 折」，但余额卡仍为「金 V」（应为蓝 V）。
- 证据：`CMP2_wallet_registered.png`（未实名却金 V）vs `CMP3_wallet_construction.png`（建筑却金 V）。

**⑤ profile/index.html —— 状态递进标杆页**
Lv.0→Lv.5 身份等级环逐档点亮，每档一句"下一步"：
- guest Lv.0：发布/简历标签灰色锁定，「登录后解锁全部功能」。
- registered Lv.1 注册会员：「完成个人认证，解锁发布供需与联系洽谈权益」。
- realname Lv.2 个人认证（✓已认证）：发布/联系绿、简历灰，「下一步开通个人入驻，解锁人才展示与简历投递」。
- pro Lv.3 专业工程师：三项全绿，「已解锁全部个人权益，可申请企业入驻拓展业务」。
- enterprise Lv.4 企业认证：「企业权益已全部开通」。
- resident Lv.5 入驻企业：「入驻企业全部权益已开通」。
- 证据：`CMP2_profile_guest/registered/realname/pro/enterprise/resident.png`。
- **E2**：enterprise(Lv.4) 与 resident(Lv.5) 视觉几乎相同（仅等级名+一行提示文案差），resident 的"已付费入驻"成就感弱。

### 2.3 状态递进感知结论
- **递进链条最完整的是 profile 页**（等级环 + 权益点亮 + 下一步文案），可作为全站范式。
- **home 页完全不参与状态递进**，是最大短板。
- 高状态（realname 起）在 detail/publish/wallet 上趋同，"升级收益"仅靠 profile 等级数和钱包积分卡一行字传达，单薄。

---

## 3. 4 种入驻类型横向对比

基础态 resident（enterprise 认证齐全 + entry active），切换 EntryStore.type / AuthStore.partner。身份回读：construction/agency/partner 均 `primary=resident, entryTypes=[...]`；individualPartner 为 `primary=partner, personal=partner`。

### 3.1 对比总表

| 维度 | construction 建筑 | agency 中介 | partner 企业合伙人 | individualPartner 个人合伙人 |
|---|---|---|---|---|
| profile 类型名 | 入驻企业 Lv.5 | 入驻企业 Lv.5 | 入驻企业 Lv.5 | （pro 线） |
| profile V 徽标 | **无蓝V** | **无金V** | **无专属** | — |
| 钱包积分卡 | 建筑企业·解锁8折 | 中介·解锁7折 | 合伙人·解锁5折 | （见分销） |
| 余额卡 V 徽标 | **金V（错）** | 金V | 金V | — |
| creditDiscount() | 0.8 ✓ | 0.7 ✓ | 0.5 ✓ | 0.8 ✓ |
| 详情页显示解锁价 | 98积分/次 | 98积分/次 | 98积分/次 | — |
| 分销中心返佣 | （一级基础） | 分销受限 | 一级12%/二级3% | 一级8%/二级2% |
| 分销专属徽章 | — | — | 无"个人合伙人专属" | **有「个人合伙人专属」** ✓ |

证据：`CMP3_profile_{construction,agency,partner}.png`、`CMP3_wallet_{construction,agency,partner}.png`、`CMP3_distribution_partner.png`、`CMP3_distribution_individualPartner.png`。

### 3.2 差异分析
- **profile 不区分入驻类型（E1）**：construction/agency/partner 三型截图均为「入驻企业 Lv.5」，无蓝 V/金 V/专属任何差异。设计上应在头部或身份卡展示类型徽标，实际缺失。
- **钱包折扣卡正确（好）**：建筑8折/中介7折/合伙人5折随类型切换，与 `creditDiscount()` 计算一致。
- **余额卡金 V 硬编码（E1，与 §2.2④同源）**：无论何种类型都显示金 V，建筑应为蓝 V、合伙人应为专属。
- **详情页解锁价不随折扣变（E2）**：`creditDiscount()` 正确返回 0.8/0.7/0.5，但详情页在破冰期免费额度内显示基础价「98 积分/次」，三型一致；折扣仅在积分扣费后才生效，用户在免费额度期看不到折扣收益。
- **分销返佣区分正确（好）**：企业合伙人 12%/3%，个人合伙人 8%/2% 且带「个人合伙人专属」徽章；二者边界清晰。证据 `CMP3_distribution_partner.png` vs `CMP3_distribution_individualPartner.png`。
- **agency/index.html 实为公开"服务广场"**：construction 用户访问正常渲染、无拦截——该页并非"中介专属后台"，而是面向所有登录用户的服务市场，故无权限拦截属预期（与任务假设的"中介后台仅中介可访问"不符，记录为页面定位澄清，非 bug）。证据 `CMP3_agencypage_as-construction.png`。

---

## 4. 破冰期 vs 正式期横向对比

### 4.1 对比总表

| 页面 | 破冰期 breakin | 正式期 normal | 切换是否生效 |
|---|---|---|---|
| profile/entry.html 入驻费 | 建筑 ¥0·限免 / 中介 ¥14,999(5折) / 合伙人 ¥0审核 | 建筑 ¥3,999 / 中介 ¥29,999 / 合伙人 ¥0审核 | **正确** ✓ |
| wallet/credits.html 免费解锁 | 本月免费解锁 **8 条** | 本月免费解锁 **5 条** | **正确** ✓ |
| monitor/index.html | 可关注 30 家 | 可关注 30 家 | **未切换** ✗ |
| home.html | 重点项目+共创卡片 | 重点项目+共创卡片 | **无显著差异** ✗ |

证据：`CMP4_entry_{breakin,normal}.png`、`CMP4_credits_{breakin,normal}.png`、`CMP4_monitor_{breakin,normal}.png`、`CMP4_home_{breakin,normal}.png`。

### 4.2 差异分析
- **入驻费切换精准（好）**：建筑 ¥0·免费（破冰期限免标签）→ ¥3,999；中介 ¥14,999（破冰期 5 折标签）→ ¥29,999；V 徽标（蓝/金/专属）在此页正确展示。无硬编码不更新。
- **积分额度切换精准（好）**：8 条 vs 5 条，与框架"破冰 5+3=8 / 正式 5"一致。
- **监控中心无模式差异（E2）**：两期均显示「可关注 30 家」+「免费额度按认证等级递增」，**无破冰期"7 天试用"提示，也无正式期"按等级额度"区分**——框架预期的"破冰 7 天试用 vs 正式付费"未在 UI 体现。
- **首页破冰福利感知弱（E2）**：两模式首页主视觉一致，无醒目"当前为破冰期/限时优惠"横幅；破冰优惠仅在 entry/credits 内页体现，首页获客漏斗顶端感知不足。

---

## 5. 4 种特殊状态独立验证

### SP1 · banned 已封禁
- **模拟方法**：代码无前台一等公民状态。封禁标记在 `DataBus` 用户记录 `u.banned`（`databus.js` statusOf 翻为 'banned'，`toggleBan` 冻结资金）。admin/users 有封禁/解封印钮。前台演示身份走 AuthStore/EntryStore，DataBus 用户表为空，无法经前台直接命中。
- **代码现状（已 grep）**：仅 `withdraw.html:156`、credits 购买/下单/分销提现等单点有 `if(_u0.banned){ toast('账号已被封禁') }` 拦截（BM-033 修复）。
- **页面表现**：home/profile 在模拟/常态下均**无任何封禁横幅、无全站拦截页、无申诉入口**。消息页仅有"风控·防跳单治理规则提醒"（泛风控文案，非针对已封禁账号）。
- **结论：E0 功能缺口**——封禁非前台一等公民状态。无：①全站登录拦截/封禁落地页；②钱包资金冻结专项展示（封禁后）；③申诉入口；④状态徽标（"已封禁"）。仅单点 toast 拦截。
- 证据：`SP1_home_banned.png`、`SP1_profile_banned.png`。

### SP2 · auth-pending 认证审核中
- **模拟方法**：`AuthStore.enterprise.ok=false; status='pending_review'; submittedAt=now-86400000`，5 个 dimensions 均 `pending_review`。
- **页面表现**：
  - profile：仍显示「个人认证 Lv.2 ✓已认证」+「下一步开通个人入驻」，**无"企业认证审核中"标识、无预计时间**。
  - auth-enterprise：**E1**——渲染为空白认证表单 + 底部「支付 ¥999 提交审核」，**未识别已提交**，无审核进度/各维度状态/预计时间，用户会误以为没提交成功而重复付款。
  - wallet/publish：功能照常开放，无"审核中"提示（个人认证已完成，企业审核不阻断基础功能属合理，但缺提示）。
- 证据：`SP2_profile_auth-pending.png`、`SP2_auth-enterprise_pending.png`、`SP2_wallet_auth-pending.png`、`SP2_publish_auth-pending.png`。

### SP3 · entry-pending 入驻审核中
- **模拟方法**：`EntryStore.status='pending', active=false, depositPaid=10000, submittedAt=now-86400000, type='construction'`。
- **页面表现**：
  - entry.html：**正确**——顶部黄色横幅「建筑企业入驻申请审核中 / 资料已提交·等待平台初审 / 查看进度」。但横幅下方类型选择列表为空白（仅标题），体验略突兀。
  - profile：**E1 误导**——显示「企业认证 Lv.4」+「企业权益已全部开通」，**未体现"入驻审核中"**，与真实"已付费待审"状态不符。
  - wallet：仅泛「冻结 ¥200」，**未单列"入驻保证金冻结 ¥10,000"**。
- 证据：`SP3_profile_entry-pending.png`、`SP3_entry_entry-pending.png`、`SP3_wallet_entry-pending.png`。

### SP4 · withdraw-pending 提现中
- **模拟方法**：`BalanceStore.logs.unshift({type:'withdraw', amount:-5000, status:'pending', remark:'提现到尾号1234'})`。
- **页面表现**：
  - wallet：流水出现「银行卡提现 ¥5,000」，但顶部「可用余额 ¥1,086.5 / 冻结 ¥200」**未拆分"在途"**——待提金额未从可用余额划出，也无"在途"科目。
  - withdraw.html：因当前态非 resident，显示「入驻企业后可提现/前往企业入驻」门槛页，**无提现进度/预计到账/撤销入口**（pending 记录不在此页呈现）。
  - message：**无"提现进度"通知**（仅有系统公告/会话消息）。
- 证据：`SP4_wallet_withdraw-pending.png`、`SP4_withdraw_withdraw-pending.png`、`SP4_message_withdraw-pending.png`。

---

## 6. 状态感知专项分析

**① 状态标识一致性**
- 身份等级在 profile 页一致且递进清晰（Lv.0-5）。
- **但跨页不一致**：wallet 余额卡固定"金 V"，与真实入驻类型无关；profile 头部不显示入驻类型徽标；detail 页 CTA 不随状态。状态徽标缺乏单一可信来源。
- 风险：guest/未实名用户在 wallet 看到"金 V"，存在**状态标识错误**（把未入驻/未认证用户展示为金 V 会员）。

**② 权限引导质量**
- 低端（guest/registered→realname→pro）引导优秀：publish、profile 的空态都写清"当前缺什么 + 下一步去哪 + 解锁后得到什么"。
- 高端引导弱：enterprise→resident 之间几乎无感知差异；realname→resident 解锁 CTA 不变。

**③ 升级收益传达**
- 传达载体单薄：主要靠 profile 一行"下一步"文案 + 钱包积分卡一行折扣。
- 高状态用户（resident）在核心付费页 detail 上**感受不到"我付了钱所以更便宜"**——折扣未落在解锁价格上。
- 破冰优惠仅在内页（entry/credits），首页无横幅，获客端感知弱。

**④ 动画白屏隐患（观察项）**
profile/monitor 等页正文依赖 `.anim-in` 入场动画（opacity:0 起）。本组在后台浏览器中动画不自动播放，正文一度空白；若真实环境动画触发（IntersectionObserver/滚动）未覆盖"首屏即在视口内"的元素，存在首屏正文留白风险。建议加 `prefers-reduced-motion` 兜底或动画 `0.5s` 后强制可见。

---

## 7. E0-E3 问题汇总表

| # | 级别 | 页面 | 问题 | 复现路径 | 证据截图 |
|---|---|---|---|---|---|
| E-01 | E0 | 全站 | banned 无前台一等公民状态：无全站拦截页/资金冻结展示/申诉入口，仅单点 toast | 模拟 u.banned=true 访问各页 | SP1_home_banned.png, SP1_profile_banned.png |
| E-02 | E1 | home.html | 6 级状态下首页零区分（文本恒 4998，guest=resident），无登录/升级引导 | 注入 6 态对比 home | CMP2_home_guest.png, CMP2_home_resident.png |
| E-03 | E1 | wallet | 余额卡固定"金 V"，registered/未实名/建筑合伙人均显示金 V | 各态对比钱包 | CMP2_wallet_registered.png, CMP3_wallet_construction.png |
| E-04 | E1 | profile | 不区分入驻类型：建筑/中介/合伙人同显"入驻企业 Lv.5"，无蓝/金/专属徽标 | 3 型切换对比 profile | CMP3_profile_construction/agency/partner.png |
| E-05 | E1 | detail | realname→resident 解锁 CTA 完全相同，8 折权益在详情页无感知 | 对比 6 态详情 CTA | CMP2_detail_realname.png, CMP2_detail_resident.png |
| E-06 | E1 | auth-enterprise | 认证审核中仍渲染空白表单+"支付¥999提交审核"，无审核进度，可能重复付款 | SP2 访问该页 | SP2_auth-enterprise_pending.png |
| E-07 | E1 | profile | 入驻审核中(SP3)却显示"企业认证Lv.4·权益已全部开通"，状态误导 | SP3 访问 profile | SP3_profile_entry-pending.png |
| E-08 | E2 | monitor | 破冰/正式期监控页无差异，无"7天试用"提示 | CMP4_monitor 两态对比 | CMP4_monitor_breakin.png, CMP4_monitor_normal.png |
| E-09 | E2 | home | 破冰期首页无醒目优惠横幅，模式差异弱 | CMP4_home 两态对比 | CMP4_home_breakin.png, CMP4_home_normal.png |
| E-10 | E2 | detail | 免费额度期显示基础解锁价 98 积分，三入驻类型折扣不落到显示价 | 3 型对比解锁价 | CMP3_detail_sheet_construction.png |
| E-11 | E2 | profile | enterprise(Lv.4)与resident(Lv.5)视觉几乎相同，付费入驻成就感弱 | 对比两态 | CMP2_profile_enterprise.png, CMP2_profile_resident.png |
| E-12 | E2 | wallet(SP4) | 待提现未拆分"在途/冻结"科目，余额不反映在途 | SP4 访问钱包 | SP4_wallet_withdraw-pending.png |
| E-13 | E2 | withdraw/message(SP4) | 无提现进度/预计到账/撤销入口；无提现进度通知 | SP4 访问两页 | SP4_withdraw_withdraw-pending.png, SP4_message_withdraw-pending.png |
| E-14 | E2 | profile(SP3) | 钱包未单列"入驻保证金冻结 ¥10,000" | SP3 访问钱包 | SP3_wallet_entry-pending.png |
| E-15 | E3 | profile/monitor | 正文依赖 .anim-in 入场动画，触发失败时首屏留白（建议 reduced-motion 兜底） | 后台浏览器复现白屏 | （环境复现） |
| E-16 | E3(已知代码) | preview/身份推导 | preview syncBusinessState 只写 qual 不写 personalEntry，被默认 personalEntry 遮蔽，"专业"下拉可能仍推导 realname | 代码审查 stores.js deriveIdentity | （代码事实） |

---

## 8. Top 10 最严重问题（按优先级）

1. **E0 封禁非前台一等状态（E-01）**——已封禁用户无全站拦截/资金冻结展示/申诉入口，风控闭环断裂。
2. **E1 首页零状态区分（E-02）**——guest 与 resident 首页一模一样，获客转化路径顶端无身份感知。
3. **E1 钱包"金 V"徽标错标（E-03）**——未实名/未入驻/建筑合伙人都显示金 V，信任与状态感知双重错误。
4. **E1 认证审核中无进度且可重复付款（E-06）**——auth-enterprise 显示空白表单，用户不知在审核、可能重复付费。
5. **E1 入驻审核中 profile 误导（E-07）**——待审却显示"权益已全部开通"。
6. **E1 profile 不区分入驻类型（E-04）**——蓝/金/专属徽标在身份页完全缺失，类型付费差异无感知。
7. **E1 高状态解锁权益无感知（E-05）**——realname→resident 详情 CTA 不变，8 折不落在用户可见处。
8. **E2 监控/首页破冰期感知缺失（E-08/E-09）**——7 天试用、限时优惠不在用户能看到的地方。
9. **E2 提现在途不透明（E-12/E-13）**——余额不分在途、无进度/撤销/通知。
10. **E2 动画白屏隐患（E-15）**——首屏正文依赖入场动画，触发失败即留白。

---

## 9. 特殊状态功能缺口清单（完全无 UI 支持的状态）

| 特殊状态 | 前台 UI 支持度 | 缺口 |
|---|---|---|
| **banned 已封禁** | **几乎为零** | 无封禁落地/全站拦截页、无封禁徽标、无资金冻结专项展示、无申诉入口；仅 withdraw/credits/order 单点 toast |
| auth-pending 认证审核中 | 弱 | 审核进度页缺失（auth-enterprise 仍出空白表单）、profile 无审核中标识、无预计时间/结果通知 |
| entry-pending 入驻审核中 | 中 | 仅 entry 页有审核横幅；profile 状态误导、钱包无保证金冻结展示、无预计时间 |
| withdraw-pending 提现中 | 弱 | 无"在途"科目、无提现进度/预计到账/撤销入口、无进度通知 |

> 结论：4 种特殊状态均**未做成一等公民状态页**。其中 **banned 完全无前台闭环**（E0），auth-pending 的"重复付款风险"最需要优先补。entry-pending 的 entry 横幅是唯一做得好的参考范式。

---

## 附：本组截图清单（62 张，均存 `artifacts/ux-audit/`）
- 6 级状态：`CMP2_{home,detail,publish,wallet,profile}_{guest,registered,realname,pro,enterprise,resident}.png`（30）
- 入驻类型：`CMP3_profile_{construction,agency,partner}.png`、`CMP3_wallet_{construction,agency,partner}.png`、`CMP3_distribution_{partner,individualPartner}.png`、`CMP3_detail_sheet_construction.png`、`CMP3_agencypage_as-construction.png`（10）
- 破冰/正式：`CMP4_{entry,credits,monitor,home}_{breakin,normal}.png`（8）
- 特殊状态：`SP1_{home,profile}_banned.png`、`SP2_{profile,auth-enterprise,wallet,publish}_auth-pending.png`、`SP3_{profile,entry,wallet}_entry-pending.png`、`SP4_{wallet,withdraw,message}_withdraw-pending.png`（12）
