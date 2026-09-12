# 静态 UI/UX 审计报告 · 核心商业页面组（Group A，9 页）

> 审计方式：纯静态代码审计（阅读 HTML/CSS/JS 源码 + 对照 DESIGN-SYSTEM.md / PAYWALL-DESIGN.md / 验证框架），未打开浏览器。
> 审计时间：2026-09-11　审计基线：设计系统 V3.3、付费墙设计、`js/common.js`（tabbar/toast/sheet/sprite 注入）、`js/detail.js`（九类详情/付费墙）。
> 约束：未修改任何源代码；所有问题均标注文件路径 + 行号/类名/函数名。

---

## 一、总体概述

### 1.1 范围
| # | 页面 | 文件 | 角色 |
|---|---|---|---|
| 1 | 首页 | `home.html` | 获客/导流/金刚区/AI 推荐 |
| 2 | 搜索首页 | `pages/search/index.html` | 搜索入口 |
| 3 | 搜索结果 | `pages/search/result.html` | 结果/筛选 |
| 4 | 供需列表 | `pages/supply/list.html` | 通用供需发现 |
| 5 | 供需详情 | `pages/supply/detail.html` + `js/detail.js` | **核心付费转化页（9 类打码/解锁）** |
| 6 | 交易大厅 | `pages/trade/index.html` | 建企买卖 |
| 7 | 发布工作台 | `pages/publish/index.html` | 发布管理 |
| 8 | 发布编辑器 | `pages/publish/editor.html` | 发布表单 |

### 1.2 10 维评分（每维 1–5）
> 付费墙维度对无付费墙的浏览/发布页记 N/A 并按「该页是否影响付费转化」给中性分（4）。

| 页面 | 1视觉一致 | 2信息架构 | 3交互流畅 | 4状态感知 | 5交易钩子 | 6付费墙体验 | 7权限引导 | 8空态引导 | 9信任构建 | 10复购留存 | 均分 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| home.html | 5 | 4 | 4 | 3 | 4 | 4(N/A) | 3 | 4 | 4 | 4 | **3.9** |
| search/index | 5 | 4 | 4 | 3 | 3 | 4(N/A) | 4 | 4 | 4 | 3 | **3.8** |
| search/result | 5 | 4 | 4 | 4 | 3 | 4(N/A) | 4 | 2 | 4 | 3 | **3.7** |
| supply/list | 5 | 4 | 4 | 4 | 3 | 4(N/A) | 4 | 3 | 4 | 4 | **3.9** |
| **supply/detail** | 5 | 4 | 4 | 4 | 4 | **3** | 4 | 4 | 4 | 4 | **4.0** |
| trade/index | 5 | 3 | 4 | 4 | 3 | 3 | 4 | 5 | 4 | 4 | **3.9** |
| publish/index | 5 | 4 | 4 | 4 | 4 | 4(N/A) | 5 | 4 | 4 | 4 | **4.2** |
| publish/editor | 5 | 4 | 4 | 4 | 4 | 4(N/A) | 5 | 4 | 4 | 4 | **4.3** |

**9 页综合均分 ≈ 4.0 / 5。** 整体视觉一致性高（统一走 CSS 令牌、`.glass/.card`、圆角/阴影规范），表单与权限门控成熟；主要失分集中在 **交易钩子死链、空态缺行动按钮、保证金退款口径矛盾、分享/社交证明为假动作**。

### 1.3 问题分级统计
| 级别 | 数量 | 含义 |
|---|---|---|
| **E0 体验阻断** | **0** | 未发现白屏/死链/功能完全不可用/转化路径断裂 |
| **E1 严重影响转化** | **3** | 死 CTA、退款口径矛盾、双扣费（已知代码问题） |
| **E2 一般体验** | **8** | 空态无动作、假复制、假社交证明、导航不一致等 |
| **E3 优化建议** | **8** | 静态角标、历史返回兜底、CDN 依赖、文档/实现漂移等 |

> 说明：前次「全量修复报告」所述 P0 白屏/空态/解锁恢复/路径错乱等代码 bug，在本次静态审计中**未复现为新的体验阻断**——9 类详情分发、`localStorage engchain-unlocked` 持久化、`notFoundHtml` 返回按钮、`__ROOT__` 自动补全等均已落地。本报告仅记录其在体验层面的残留表现。

---

## 二、按页面分组

### 1) 首页　`home.html`

**总体评价**：视觉完成度高，金刚区 5 入口全部可达，破冰期共创卡按身份条件渲染；缺一个显性的「登录/注册」导流位，首屏轮播 slide 不可点。

**10 维评分**：视觉 5 / 架构 4 / 交互 4 / 状态感知 3 / 交易钩子 4 / 付费墙 4(N/A) / 权限 3 / 空态 4 / 信任 4 / 留存 4 = **3.9**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| H-01 | E2 | 首页无任何显性「注册/登录」入口，游客只能靠底部「我的」Tab 反查登录 | 获客漏斗第一跳缺引导，游客流失不可见 | `home.html` 顶部仅 `app-eyebrow`(L75) 与定位(L80)，无登录按钮；登录入口仅在 tabbar「我的」`common.js:192` | 顶栏右侧加「登录/注册」胶囊，或在破冰共创卡旁加游客 CTA |
| H-02 | E2 | 信息流轮播 3 张 slide 含「AI 智能匹配/直达高匹配供需」卖点，但整张 slide 无 `<a>`/无点击事件 | 高点击率视觉钩子不可点，交易钩子落空 | `home.html:192-198` 生成 `.ac-slide` 无 href/onclick | 给 `.ac-slide` 加 `onclick` 跳 `pages/search/index.html?mode=ai` |
| H-03 | E3 | 定位写死「成都」，未接入定位/城市选择 | 非成都用户内容地域偏差 | `home.html:80` `<span class="loc">成都` | 接 `city-mask` 或读本地城市态 |
| H-04 | E3 | 「破冰期福利」仅在 breakin 模式渲染一张共创卡，无常驻「注册送 N 积分/实名免费解锁」价值主张 | 游客看不到激励，转化动机弱 | `home.html:235` `if(!ModeStore.isBreakIn()) return;` | 破冰卡文案下补一行常驻福利条 |

> 校验通过项：`window.__ROOT__=''`(L183) 正确；`<body data-tab="home">`(L70) 触发 tabbar 注入；5 金刚区 `franchise/trade/personnel/agency/supply-list` 链接全部存在；hero CTA `pages/supply/detail.html?id=1001`(L94) 相对路径正确。

---

### 2) 搜索首页　`pages/search/index.html`

**总体评价**：轻量搜索入口，热门词/AI 建议齐全，无 tabbar（子页带 nav-back，合理）。

**10 维评分**：5/4/4/3/3/4/4/4/4/3 = **3.8**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| S1-01 | E3 | 返回键 `history.back()`，无历史栈为空的兜底 | 直接被外部链接打开时返回无效 | `search/index.html:19` | 改 `history.length>1?history.back():location.href='../../home.html'` |
| S1-02 | E3 | AI 搜索 Sheet「查看智能推荐」按钮把 `raw` 拼进内联 onclick 字符串 | 长文本/特殊字符易破坏 onclick 字符串 | `search/index.html:122` `location.href='result.html?mode=ai&q='+...` | 改用 addEventListener + encodeURIComponent |

> 校验通过项：`__ROOT__='../../'`(L80)、CSS/JS 相对路径正确；空关键词默认「混凝土」(L132)；AI Sheet 后跳 `result.html?mode=ai` 相对路径正确。

---

### 3) 搜索结果　`pages/search/result.html`

**总体评价**：免费摘要额度条、AI/手动切换、排序计数齐全；**空态缺行动按钮**。

**10 维评分**：5/4/4/4/3/4/4/**2**/4/3 = **3.7**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| SR-01 | E2 | 空态只有「换个关键词/试试」纯文案，无「清空筛选/浏览全部」按钮 | 筛空后用户无下一步，流失 | `result.html:330-334` `.empty-state` 仅 e-icon/e-title/e-desc | 空态补「重置筛选」主按钮 +「浏览全部」次按钮 |

> 校验通过项：`__ROOT__='../../'`；`dq-banner` 今日免费额度(L54-57)；结果计数/排序切换/手动开关逻辑完整。

---

### 4) 供需列表　`pages/supply/list.html`

**总体评价**：唯一带 tabbar 的子列表页（`data-tab="discover"`），筛选 Sheet 完整；空态同样缺重置动作。

**10 维评分**：5/4/4/4/3/4/4/3/4/4 = **3.9**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| SL-01 | E2 | 空态「暂无匹配」无「重置筛选」按钮 | 筛选过窄后无逃生路径 | `list.html:391` `.empty-state` 仅图标+标题+文案 | 加「重置筛选」主按钮（参照 trade 空态做法） |
| SL-02 | E3 | 筛选遮罩 `.filter-overlay` 挂在 body 下 `position:fixed;inset:0` | 在 390px 居中手机框演示时会盖住整窗而非手机区 | `list.html:37,100-113` | 遮罩改为相对 `.phone` 定位或限制宽度 |

> 校验通过项：`__ROOT__='../../'`(L?)、`data-tab="discover"`；`Cards.render(list,'detail.html?id=')`(L390) 详情前缀正确；搜索跳 `../search/index.html`(L62) 正确；筛选重置/确定齐全。

---

### 5) 供需详情（核心付费转化）　`pages/supply/detail.html` + `js/detail.js`

**总体评价**：9 类 bizKey 分发齐全（material/equipment/labor/cooperation/franchise/trade/agency/personnel/talent），就近打码（`.pw-blur/.pwp/.pw-file`）+ 底部解锁 Sheet 结构完整，身份门控（游客→登录、未实名→实名）分级清晰，`localStorage engchain-unlocked` 按类别 TTL（人才 7 天/转让 30 天/普通永久）持久化，解锁后 `.phone.is-unlocked` 原地去模糊、CTA 由橙变绿。**核心残留问题：保证金退款口径跨页矛盾、微信/支付宝单次解锁双扣费、分享/社交证明为假动作。**

**10 维评分**：5/4/4/4/4/**3**/4/4/4/4 = **4.0**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| D-01 | E1 | **保证金退款口径跨页矛盾**：列表/流程页说「扣除解锁信息费用后，其余保证金可退」（部分退），详情付费 Sheet 说「30 天未成交全额退还」（全退） | 用户在掏钱前看到两种承诺，信任受损、决策犹豫，直接影响 ¥5,000 保证金转化 | trade 列表 `trade/index.html:349-350`「扣除解锁信息费用后，其余保证金可申请退还」；详情 `detail.js:2363`「30 天内未达成交易可全额无息退还」 | 统一为单一退款规则（建议全退口径），列表与 Sheet 共用同一句文案常量 |
| D-02 | E1（已知代码问题） | **微信/支付宝单次解锁同时扣「人民币余额」和「积分」**：`simulatePayUnlock` 既 `s.balance-=rmb` 又 `CreditStore.consume(costCredit)`，toast「已扣 ¥X（Y 积分）」 | 用户看到重复扣费，对账困惑，付费后信任崩塌 | `detail.js:2871-2883`（BalanceStore 扣款 + 2881 `CreditStore.consume`） | 单次人民币支付路径只扣人民币，不再消耗积分（已知代码问题，体验影响=双扣费误导） |
| D-03 | E2 | 「分享」按钮仅 toast「已复制链接」，未真正写入剪贴板 | 留存/裂变钩子名不副实 | `detail.js:2964` `UI.toast('已复制链接')` | 接 `navigator.clipboard.writeText(location.href)` 后再 toast |
| D-04 | E2 | 解锁区社交证明「已有 N 人解锁」= `rows*214+236` 硬编码伪造 | 伪造从众数据，知情用户降低信任 | `detail.js:2117` `(rows.length*214+236).toLocaleString()` | 接真实解锁计数或改为中性文案「已有多位同行解锁」 |
| D-05 | E2 | 资质招商 franchise 走 `consultMode`，`openConsult` 提交留资后 `openPay`，但**未先过 `identityGate/gateAct`**，游客可直接到支付 Sheet | 游客绕过实名门进入付费，与其它类「先实名后解锁」策略不一致 | `detail.js:2892`（consultMode 直接 openConsult）、`2807-2810`（留资后直接 openPay，无 gateAct） | 招商付费分支补 gateAct，与普通类门控一致 |
| D-06 | E3 | 设计文档定义的打码类名 `.masked-full/.masked-partial/.masked-range` 在 CSS 中不存在，实际用 `.pw-blur/.pwp/.pw-file` | 文档与实现漂移，后续维护对照成本 | PAYWALL-DESIGN.md 2.2 vs `app.css:1900-1913` | 以实现为准回写设计文档类名 |
| D-07 | E3 | 详情页 ECharts 走 bootcdn 外链 | 离线/内网环境图表区不渲染（有兜底，不白屏） | `detail.html:58` `<script src="https://cdn.bootcdn.../echarts>` | 图表库本地打包或加 onload 兜底占位 |

> 校验通过项：
> - `__ROOT__='../../'`、无 tabbar（深层页合理）；
> - 九类价格正确：material/equipment/labor/cooperation 默认 98 积分、talent 29 积分(7 天 TTL)、trade 保证金 ¥5,000(30 天)、franchise 分级 49/39/29 + 划线原价 99/79/59、agency/personnel 免费（`detail.js:2005-2020`）；
> - CTA 按身份/解锁态动态文案（游客「登录后解锁」、未实名「实名认证后免费解锁」、会员「年度会员免费解锁」、免费额度「今日免费解锁剩 N 条」）`detail.js:2087-2101, 2294-2304`；
> - 解锁持久化 `UnlockStore` localStorage `engchain-unlocked` + TTL + 事件广播 `detail.js:56-89`；
> - 异常 bizKey 不张冠李戴、直接空态 + 返回按钮 `detail.js:2178-2183 / 2143-2149`；
> - 员工招聘 personnel 用投递流程替代付费墙（applyHtml + 三步引导），CTA 按投递权限动态文案 `detail.js:2281-2296`。

---

### 6) 交易大厅　`pages/trade/index.html`

**总体评价**：首屏 Hero/信任条/热门急转/转让流程/筛选/空态/交叉导流齐全，**空态全组最佳**；但 Hero 主 CTA「我要转让」是死 toast，且无底部 tabbar（与供需列表不一致）。

**10 维评分**：5/**3**/4/4/**3**/3/4/**5**/4/4 = **3.9**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| T-01 | E1 | Hero 主按钮「我要转让」仅 `UI.toast('即将进入转让发布流程')`，不跳任何页面 | 首屏最强转化 CTA 断头，发布供给路径断裂 | `trade/index.html:283` | 改为 `location.href='../publish/editor.html?role=supply&biz=trade'` |
| T-02 | E2 | 本页无 `<body data-tab>` 也无显式 `__ROOT__`，不注入底部 tabbar；而同层级 `supply/list.html` 有 tabbar | 同为频道页，导航可达性不一致，缺一键回首页 | `trade/index.html:260` `<body>` 无 data-tab；对照 `list.html` data-tab="discover" | 视信息架构策略，统一频道页是否带 tabbar |
| T-03 | E1 | 退款口径矛盾（同 D-01）：流程卡说「扣除解锁信息费用后其余可退」 | 同 D-01 | `trade/index.html:349-350` | 与详情 Sheet 统一文案 |

> 校验通过项：basefix 脚本自动补 `<base>`；卡片跳 `../supply/detail.html?id=`(L527/559) 正确；搜索跳 `../search/business.html?type=trade`(L267)；交叉导流 `../agency/index.html?scene=trade`(L355) 存在；空态含「重置筛选/发布需求/提交专享委托」三按钮(L666-668)；加载更多 + ListFooter 完整。

---

### 7) 发布工作台　`pages/publish/index.html`

**总体评价**：身份门控（未登录/未实名两段式）文案清晰、带行动按钮与「先看看示例」旁路；发布需求/供应双入口、统计四宫格、信息管理四入口、待处理列表完整。`data-tab="workbench"` 正确点亮中央 AI 球。

**10 维评分**：5/4/4/4/4/4/**5**/4/4/4 = **4.2**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| PUB-01 | E3 | 「发布供应」防呆提示仅改副标题文字，非中介企业仍可点进编辑器再被拦 | 防呆弱，多一步返回成本 | `publish/index.html:163-171`（仅替换 sub 文案） | 非中介点「发布供应」时直接弹入驻引导，不进编辑器 |

> 校验通过项：`__ROOT__='../../'`(L140) 早于 DOMContentLoaded；`data-tab="workbench"`(L83) 由 `common.js:203` 点亮 orb；登录/实名门控 `checkPublishAuth`(L142-160)；`../auth/login.html`、`../profile/auth-personal.html`、`editor.html?role=*`、`records/drafts/unlocked.html`、`../favorite/index.html` 链接均相对正确。

---

### 8) 发布编辑器　`pages/publish/editor.html`

**总体评价**：本组完成度最高。3 步向导 + 实时完整度进度条、AI 智能补全（可撤销）、复制上次发布、存草稿常驻、发布前预览、协议勾选、离开保护弹窗、按品类动态业务字段。必填项（标题/品类/城市/预算/协议）分步校验 + 字段抖动 + 错误文案。身份门控同工作台。

**10 维评分**：5/4/4/4/4/4/**5**/4/4/4 = **4.3**

**问题清单**
| 编号 | 级别 | 描述 | 体验影响 | 代码依据 | 修复建议 |
|---|---|---|---|---|---|
| ED-01 | E3 | 「演示数据：材料/设备/…/清空」一键填充条直接暴露在正式表单里 | 像开发调试工具外露，专业度下降 | `editor.html:546-557` `.quick-fill-bar` | 仅在 query `?demo=1` 或开发模式下显示 |
| ED-02 | E3 | 返回键依赖 JS 离开保护，无 history 兜底分支不完整 | 首次进入直接退出场景需走弹窗确认，可接受 | `editor.html:2146` `history.back()`，否则 `../../home.html` | 现状已含 home 兜底，仅建议保留 |

> 校验通过项：无 `data-tab`（全屏编辑器，不注入 tabbar，合理）；`__ROOT__` 由 `common.js:771` 按路径深度自动补；必填标记 `<span class="req">*</span>`(L518/523/566/597)；分步 `validateStep`(L1069) + 字段错误 `err-*`；固定操作栏「存草稿/上一步/下一步/提交发布」(L820-823)；AI 补全 + 撤销(L490-509)；协议勾选 `../agreement/user.html`(L812)；提交成功页双出口（发布记录/回首页）(L2047-2049)。

---

## 三、跨页面共性问题

1. **空态普遍缺「行动按钮」**（E2）：`search/result.html`、`supply/list.html` 空态仅文案；唯独 `trade/index.html` 空态做到「重置/发布/委托」三按钮——应把 trade 空态模式推广到 result/list。
2. **`history.back()` 无兜底**（E3）：search/index、各 nav-back 直接 `history.back()`，外链深开时无效。
3. **底部 tabbar 注入策略不统一**（E2）：`supply/list` 带 tabbar，`trade/index` 不带；`detail/editor/search` 作为深层/全屏页不带——需明确「频道级列表带 tabbar、详情/表单/搜索不带」的规则并落到 trade。
4. **假动作组件**（E2）：detail「分享=toast 假复制」、lockHtml「N 人解锁=公式伪造」——付费转化页的信任组件不宜用占位假数据。
5. **跨页文案口径需单一来源**（E1）：保证金退款规则在列表/详情两处各写各的，应收敛为同一常量。
6. **付费墙类名文档漂移**（E3）：PAYWALL-DESIGN 的 `.masked-full/partial/range` 与实现 `.pw-blur/.pwp/.pw-file` 不一致。
7. **静态角标**（E3）：tabbar 消息 `badge:3` 硬编码（`common.js:191`），不随真实未读数变化。

---

## 四、最严重 Top 5（E0/E1 优先）

| 排序 | 编号 | 级别 | 问题 | 影响 |
|---|---|---|---|---|
| 1 | T-01 / D-03 | **E1** | 交易大厅 Hero「我要转让」是死 toast，不跳发布页 | 首屏最强供给转化 CTA 断头，发布路径断裂 |
| 2 | D-01 / T-03 | **E1** | 建企买卖保证金「部分退 vs 全额退」跨页矛盾 | 用户付 ¥5,000 前看到两种承诺，信任与转化双损 |
| 3 | D-02 | **E1（已知代码）** | 微信/支付宝单次解锁同时扣人民币余额 + 积分 | 付费后双扣费误解，复购留存受损 |
| 4 | SR-01 / SL-01 | **E2** | 搜索结果/供需列表空态无「重置/浏览」按钮 | 筛选过空后无逃生路径，直接流失 |
| 5 | D-03 / D-04 | **E2** | 详情分享假复制、「N 人解锁」伪造 | 核心付费页信任组件名不副实 |

> 本次审计 **E0 = 0**：9 页无白屏、无死链、无转化路径硬断；九类付费墙、解锁持久化、身份门控、空态与返回路径均已落地。优先修复上述 3 项 E1 即可显著提升付费转化。

---

*审计方法：静态源码阅读 + 设计系统/付费墙设计/验证框架对照；未运行浏览器、未修改任何源代码。*
