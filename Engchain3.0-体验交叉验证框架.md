# Engchain3.0 · 商业模式体验可行性交叉验证框架

> **验证目标**：从用户体验视角（UI/UX/交互/交易钩子）验证商业模式是否可行——一个真实用户（处于某种状态、某种入驻类型、某种模式），能否被顺畅引导到付费转化？交易钩子是否有效？UI/UX 是否支撑而非阻碍商业模式？
>
> **验证范围**：纯前端 HTML/CSS/JS + localStorage，无后端。双轨验证法 = 静态代码审计 + 浏览器动态实操截图。
>
> **项目根目录**：`D:\Engchain3.0`
> **首页**：`home.html` ｜ **预览入口**：`preview.html`
> **截图存证目录**：`artifacts/ux-audit/`

---

## 一、验证基线（从代码确认的事实）

### 1.1 用户状态轴（6级，代码确认）

来源：`js/data.js` L885-899 `statuses[]`，`js/stores.js` `deriveIdentity()`

| 状态 | level | 代码 primary 值 | 商业模式意义 | 转化目标 |
|------|-------|----------------|------------|---------|
| guest 游客 | 0 | `guest` | 获客顶端，未登录 | 注册 |
| registered 注册 | 1 | `registered` | 基础账号 | 实名+充值 |
| realname 实名 | 2 | `realname` | 个人实名认证 | 企业认证+充值 |
| pro 专业 | 3 | `pro` | 实名+个人建筑资质 | 企业入驻+高阶解锁 |
| enterprise 企业认证 | 4 | `enterprise` | R1已转化 | 入驻(R2)+交易(R5) |
| resident 入驻 | 5 | `resident` | R2已转化 | 持续交易+佣金+增值道具 |

**身份推导机制**：`deriveIdentity()`（stores.js L884-928）为全局唯一身份推导函数，返回双线并行结构：
- `personal`：none / verified / professional / partner / full
- `enterprise`：none / verified / resident
- `primary`：优先级 企业入驻 > 企业认证 > 个人合伙人 > 个人入驻 > 个人认证 > 游客
- `entryTypes[]`：入驻类型数组（支持并行）

### 1.2 入驻类型轴（4类，代码确认）

来源：`js/data.js` L1064-1080 `entryTypes`，L974 `individualPartner`

| 类型 | 代码 id | 正式期入驻费 | 破冰期入驻费 | 核心差异 |
|------|---------|------------|------------|---------|
| 建筑企业 | `construction` | ¥3,999 | ¥0（破冰） | 发布供需、交易托管、解锁8折、佣金8%、蓝V |
| 中介服务 | `agency` | ¥29,999 | ¥14,999（5折） | 中介后台、卖家看板、解锁7折、佣金6%、金V、线索包 |
| 企业合伙人 | `partner` | ¥0（审核） | ¥0（审核） | 全功能、解锁5折、佣金5%、full分销12%/3%、专属 |
| 个人合伙人 | `individualPartner` | 免费（审核） | 免费（审核） | 分销返佣8%/2%、轻量功能、无企业后台 |

> **注意**：个人合伙人（`individualPartner`）通过 `AuthStore.partner` 实现，与企业入驻 `partner` 类型是分离的两个概念。preview.html 入驻类型下拉仅含 construction/agency/partner 三类，个人合伙人需通过 AuthStore 单独设置。

### 1.3 模式轴（2种，代码确认）

来源：`js/stores.js` L867-873 `ModeStore`，localStorage key `engchain-mode`

| 模式 | 代码 phase 值 | 关键差异 |
|------|-------------|---------|
| 破冰期 | `breakin` | 建筑¥0入驻、中介¥14999（5折）、首档佣金5%、注册送3条免费解锁、实名免费解锁5+3=8条、监控试用7天、游客可看1条样例 |
| 正式期（成熟期） | `normal` | 标准定价（建筑¥3999/中介¥29999）、首档佣金8%、实名免费解锁5条、监控按认证等级额度、游客仅看公开摘要 |

**切换方式**：`ModeStore.switch('breakin'|'normal')` 或 preview.html 运营周期切换按钮。

### 1.4 特殊过程状态轴（4种，代码现状确认）

> **关键发现**：以下4种特殊状态**均未实现为一等公民状态**，需通过 localStorage 直接操作模拟。验证时需记录"代码未原生支持"的体验缺口。

| 特殊状态 | 模拟方式 | 体验验证重点 |
|---------|---------|------------|
| banned 已封禁 | 无原生实现；需检查 `admin/risk/` 模块是否有封禁标记写入，或手动设置 localStorage 风险标记 | 全站拦截体验、资金冻结展示、申诉入口、状态标识 |
| auth-pending 认证审核中 | `AuthStore.enterprise.dimensions[type].status = 'pending_review'`，或 `AuthStore.enterprise.ok=false` 但有 submittedAt | 审核中状态展示、功能临时限制、预计时间、审核结果通知 |
| entry-pending 入驻审核中 | `EntryStore.status = 'pending'`, `EntryStore.active = false`，有 submittedAt | 入驻权益临时状态、保证金冻结展示、审核进度 |
| withdraw-pending 提现中 | `BalanceStore.logs` 中插入 `{type:'withdraw', status:'pending'}` 记录 | 余额冻结展示、提现进度、预计到账、撤销入口 |

### 1.5 9类详情页付费墙（代码确认）

来源：`PAYWALL-DESIGN.md` L225-240，`js/data.js` `business.detailPaywall`

| 类别 | 代码 bizKey | 付费策略 | 打码字段数 |
|------|-----------|---------|----------|
| 材料供需 | `material` | 付费解锁 | 12+（价格/联系人/电话/微信/地址/资质等） |
| 设备租赁 | `equipment` | 付费解锁 | 10+（月租/台班/进出场费/押金/地址等） |
| 劳务班组 | `labor` | 付费解锁 | 8+（班组长/单价/联系方式/地址/保险等） |
| 合作项目 | `cooperation` | 付费解锁 | 8+ |
| 招商加盟 | `franchise` | 付费解锁 | 8+ |
| 二手交易 | `trade` | 付费解锁 | 8+ |
| 中介服务 | `agency` | 全免费展示 | 0（联系方式列表页打码、详情页登录可见） |
| 企业招聘 | `personnel` | 全免费+投递 | 0（走 applyHtml 投递流程，无付费墙） |
| 人才寻猎 | `talent` | 付费解锁 | 8+ |

**打码样式**（4种）：整行打码 `.masked-full`、部分打码 `.masked-partial`（手机号中间4位）、区间打码 `.masked-range`（价格范围）、文件预览打码 `.masked`（证照首页可见）。

**解锁持久化**：localStorage key `engchain-unlocked`，切换身份后清空。

### 1.6 核心页面清单（29个高频页，代码确认）

| # | 页面 | 路径 | 商业功能 |
|---|------|------|---------|
| 1 | 首页 | `home.html` | 获客/导流/金刚区/AI推荐 |
| 2 | 搜索首页 | `pages/search/index.html` | 搜索入口/品类导航 |
| 3 | 搜索结果 | `pages/search/result.html` | 列表/筛选/排序 |
| 4 | 供需列表 | `pages/supply/list.html` | 列表浏览/付费墙预览 |
| 5 | 供需详情 | `pages/supply/detail.html` | **核心付费转化页**/9类打码/解锁 |
| 6 | 交易大厅 | `pages/trade/index.html` | 二手交易/撮合 |
| 7 | 发布工作台 | `pages/publish/index.html` | AI发布入口/草稿/记录 |
| 8 | 发布编辑器 | `pages/publish/editor.html` | 表单/发布摩擦点 |
| 9 | 订单列表 | `pages/order/index.html` | 交易管理/状态追踪 |
| 10 | 订单详情 | `pages/order/detail.html` | 托管/里程碑/确认 |
| 11 | 钱包首页 | `pages/wallet/index.html` | 余额/积分/收支 |
| 12 | 充值页 | `pages/wallet/recharge.html` | **充值转化**/套餐选择 |
| 13 | 积分页 | `pages/wallet/credits.html` | 积分余额/免费额度/商城 |
| 14 | 提现页 | `pages/wallet/withdraw.html` | 提现申请/进度 |
| 15 | 发票页 | `pages/wallet/invoice.html` | 发票申请/记录 |
| 16 | 个人中心 | `pages/profile/index.html` | 状态展示/功能入口/升级引导 |
| 17 | 认证中心 | `pages/profile/auth.html` | 认证入口/五身份叠加 |
| 18 | 企业认证 | `pages/profile/auth-enterprise.html` | R1转化/多维资质 |
| 19 | 入驻引导 | `pages/profile/entry.html` | R2转化/类型选择 |
| 20 | 入驻表单 | `pages/profile/entry-form.html` | 入驻费支付/保证金 |
| 21 | 分销中心 | `pages/distribution/index.html` | 分销概览/数据 |
| 22 | 分销海报 | `pages/distribution/poster.html` | 海报生成/分享 |
| 23 | 分销收益 | `pages/distribution/earnings.html` | 返佣/提现 |
| 24 | 消息中心 | `pages/message/index.html` | 留存触达/通知 |
| 25 | 监控中心 | `pages/monitor/index.html` | 付费增值/关注监控 |
| 26 | 中介后台 | `pages/agency/index.html` | 中介专属/卖家看板 |
| 27 | 招商加盟 | `pages/franchise/index.html` | 加盟列表/详情 |
| 28 | 招聘中心 | `pages/personnel/index.html` | 招聘/投递（免费策略） |
| 29 | 状态演示页 | `pages/state/index.html` | 状态切换测试页 |

---

## 二、交叉验证矩阵

### 2.1 有效组合计算

- 6基础状态 × 4入驻类型 × 2模式 = 48种
- 剔除无效组合（guest/registered/pro 无入驻类型；enterprise 仅有类型选择未入驻）后约 **32种基础组合**
- 4种特殊状态在 relevant 基础状态上叠加 = 约 **8个特殊状态场景**
- **总计约40个验证场景**

### 2.2 代表性场景（浏览器动态验证必覆盖10种）

| 场景ID | 基础状态 | 入驻类型 | 模式 | 验证重点 |
|--------|---------|---------|------|---------|
| S01 | guest 游客 | 无 | 破冰期 | 获客体验、注册引导、1条样例、付费墙拦截 |
| S02 | registered 注册 | 无 | 破冰期 | 实名引导、限量发布、充值引导、3条免费解锁 |
| S03 | realname 实名 | 无 | 破冰期 | 发布能力、5+3免费解锁、企业认证引导、充值引导 |
| S04 | enterprise 企业认证 | 无（未入驻） | 正式期 | 入驻引导(R2)、订单管理、资金账户、发票能力 |
| S05 | resident 入驻 | construction 建筑 | 破冰期 | ¥0入驻权益感知、8折解锁、交易托管、佣金8% |
| S06 | resident 入驻 | agency 中介 | 正式期 | 中介后台、卖家看板、7折解锁、佣金6%、线索包 |
| S07 | resident 入驻 | partner 合伙人 | 正式期 | 全功能、5折解锁、佣金5%、full分销12%/3% |
| S08 | pro 专业（个人合伙人叠加） | individualPartner | 破冰期 | 分销中心、8%/2%返佣、轻量功能边界、海报分享 |
| S09 | resident 入驻 | construction 建筑 | 正式期 | 标准定价¥3999、全价解锁、与破冰期S05对比 |
| S10 | realname 实名 | 无 | 正式期 | 与破冰期S03对比：免费额度差异(5条vs8条)、游客样例差异 |

### 2.3 特殊状态场景（独立浏览器动态验证）

| 场景ID | 特殊状态 | 叠加基础状态 | 验证重点 |
|--------|---------|------------|---------|
| SP1 | banned 已封禁 | resident | 全站拦截、资金冻结、申诉入口、状态标识 |
| SP2 | auth-pending 认证审核中 | enterprise(提交未过) | 审核中展示、功能临时限制、预计时间、结果通知 |
| SP3 | entry-pending 入驻审核中 | enterprise(入驻提交) | 入驻权益临时状态、保证金冻结、审核进度 |
| SP4 | withdraw-pending 提现中 | resident(有余额) | 余额冻结、提现进度、预计到账、撤销入口 |

---

## 三、10维体验评分标准

每维 1-5 分，5分=优秀无摩擦，1分=体验阻断。

| 维度 | 权重 | 评分要点 |
|------|------|---------|
| 1.视觉一致性 | 10% | V3.3设计系统遵循度（色彩令牌/字体/间距/圆角/阴影/玻璃拟态）、组件规范统一、品牌感 |
| 2.信息架构 | 10% | 页面层级清晰、导航可达性、跳转深度≤3、关键功能入口可见性、面包屑/返回 |
| 3.交互流畅度 | 12% | 跳转无白屏/死链、表单摩擦低、toast/sheet/dialog反馈及时、loading/empty/error三态、操作可逆 |
| 4.状态感知 | 10% | 当前状态标识清晰、状态切换后UI刷新、特殊状态可见、身份双线展示 |
| 5.交易钩子 | 12% | CTA位置/文案/视觉权重、决策点付费引导、关注/监控/消息留存触达、复购引导 |
| 6.付费墙体验 | 12% | 9类打码样式正确、解锁Sheet信息结构、CTA文案变化、价格展示清晰、支付流畅、解锁后反馈、持久化 |
| 7.权限引导 | 10% | 受限功能拦截方式、升级引导文案、"升级后获得什么"传达、权限与UI一致性 |
| 8.空态引导 | 8% | 新用户首屏引导、空页面占位与行动召唤、破冰期福利感知、guide弹窗有效性 |
| 9.信任构建 | 8% | 认证标识展示、托管流程透明度、保证金说明、防跳单提示、交易安全感知 |
| 10.复购留存 | 8% | 关注/监控/消息推送有效性、再次解锁/交易引导、会员订阅、增值道具推荐 |

---

## 四、E0-E3 问题分级

| 级别 | 定义 | 示例 | 处理要求 |
|------|------|------|---------|
| **E0 体验阻断** | 页面白屏/死链/功能完全不可用/转化路径断裂/JS报错导致页面不可用 | 详情页点击解锁无反应、充值页白屏、支付后未到账 | 必须截图+复现路径+文件路径，立即修复 |
| **E1 严重影响转化** | 核心交互摩擦大/CTA缺失/付费墙体验差/权限引导缺失/状态不刷新 | 详情页无解锁CTA、升级引导文案缺失、状态切换后付费墙不更新 | 必须截图+复现路径，优先修复 |
| **E2 一般体验问题** | 视觉偏差/反馈不及时/空态无引导/状态标识不清/间距异常 | 空态页无行动按钮、toast延迟>2s、颜色令牌使用不一致 | 记录问题，计划修复 |
| **E3 优化建议** | 文案优化/间距微调/动效提升/视觉增强/交互锦上添花 | CTA文案可更精准、卡片圆角不一致、可加微交互动效 | 记录建议，择机优化 |

---

## 五、8条转化漏斗检查点

每条漏斗检查：每步CTA可见性、摩擦点、掉点分析、转化率评估（1-5分）。

| 漏斗ID | 漏斗名称 | 步骤序列 | 核心检查点 |
|--------|---------|---------|-----------|
| F1 | 注册转化 | 游客浏览→注册引导→注册→实名引导 | 游客能否看到注册入口？注册流程摩擦？注册后是否立即引导实名？ |
| F2 | 实名转化 | 注册→实名引导→实名→充值/解锁引导 | 实名入口可见性？实名表单摩擦？实名后是否引导充值/首次解锁？ |
| F3 | 充值转化 | 实名→积分不足→充值页→选套餐→支付→到账 | 积分不足时是否自动引导充值？套餐选择清晰度？支付流程？到账反馈？ |
| F4 | 解锁转化 | 详情→打码→点击解锁→Sheet→支付→解锁成功→内容展示 | 打码是否激发付费欲？解锁CTA位置/文案？Sheet价格结构？支付后反馈？持久化？ |
| F5 | 入驻转化 | 企业认证→入驻引导→选类型→支付入驻费+保证金→入驻成功→权益感知 | 入驻引导时机？类型对比清晰度？费用透明度？支付后权益感知？ |
| F6 | 交易转化 | 入驻→发布供需→询盘→下单→托管支付→里程碑确认→成交→佣金 | 发布流程摩擦？询盘可达性？托管信任？里程碑清晰度？佣金感知？ |
| F7 | 分销转化 | 个人合伙人→分销中心→生成海报→分享→下级注册→下级成交→返佣→提现 | 分销入口可达性？海报生成质量？返佣规则清晰度？提现流畅度？ |
| F8 | 复购留存 | 已付费→关注/监控→消息推送→再次解锁/交易 | 关注/监控入口？消息触达有效性？再次解锁引导？会员订阅推荐？ |

---

## 六、6阶段执行计划

### Phase 0 验证框架建立（已完成）
- ✅ 从代码确认完整状态枚举、入驻类型、模式开关、特殊状态现状
- ✅ 梳理29个核心页面清单
- ✅ 建立 40场景 × 29页面 × 10维 验证矩阵
- ✅ 设计8条转化漏斗检查点
- ✅ 确认特殊状态未原生实现（需模拟）
- **产出**：本文档

### Phase 1 静态UI/UX全量审计（3组并行）
不依赖浏览器，通过代码阅读+设计系统比对。
- **A组·核心商业页**：home/search/supply/trade/publish（9页）—— UI一致性/信息架构/交互/CTA/付费墙静态结构
- **B组·交易钱包页**：order/wallet（7页）—— 交易流程/支付体验/信任元素/钱包UX/三态
- **C组·个人分销页**：profile/auth/entry/distribution/message/monitor/agency/franchise/personnel/state（13页）—— 状态感知/权限引导/认证流程/分销UX/空态/信任

### Phase 2 浏览器动态交互验证（2组并行）
必须使用 browser-use-automation skill，通过 computer_use_tool plane="bu" 操作浏览器。
- **D组·核心旅程+漏斗**：S01-S10 代表性场景完整用户旅程 + F1-F8 转化漏斗实操
- **E组·状态差异+特殊状态**：横向对比（6状态×4类型×2模式）+ SP1-SP4 特殊状态独立验证

### Phase 3 转化漏斗与交易钩子专项（D组深化）
8条转化漏斗深度验证，每步记录CTA可见性/摩擦点/掉点。

### Phase 4 差异化体验与状态感知验证（E组深化）
横向对比同一页面在不同状态/类型/模式下的UI差异，特殊状态体验。

### Phase 5 汇总与最终报告
- 合并去重所有E0-E3问题
- 按转化漏斗组织（哪个漏斗哪一步问题最多最严重）
- 按状态×类型矩阵组织（哪种组合体验最差/最好）
- 每个转化漏斗的体验转化率评分和主要掉点
- 商业模式可行性的体验视角结论
- 修复优先级路线图
- **产出**：`Engchain3.0-商业模式体验可行性验证报告.md`

---

## 七、验证环境与工具

### 7.1 状态切换方法

**方法1：preview.html 演示控制台**（推荐用于常规状态切换）
- 打开 `preview.html`
- 左侧"演示状态"面板：用户状态下拉（guest/registered/realname/pro/enterprise/resident）
- 入驻类型下拉（construction/agency/partner，仅 enterprise/resident 可用）
- 运营周期切换（破冰期/成熟期）
- 切换后自动同步到 AuthStore/EntryStore/ModeStore 并刷新 iframe

**方法2：直接操作 localStorage**（用于特殊状态模拟）
```javascript
// 设置用户状态
localStorage.setItem('engchain-state', JSON.stringify({
  user:'陈建国', company:'四川省××建设有限公司',
  status:'resident', member:true, loggedIn:true
}));
// 设置认证状态
AuthStore.write({ realname:{ok:true,ts:Date.now()}, enterprise:{ok:true,expireAt:Date.now()+365*864e5}, qual:{ok:true,list:['建筑业企业资质']} });
// 设置入驻状态
EntryStore.write({ type:'construction', status:'active', active:true, paidAt:Date.now(), expireAt:Date.now()+365*864e5 });
// 设置模式
ModeStore.switch('breakin'); // or 'normal'
```

**方法3：个人合伙人设置**（需单独操作）
```javascript
var a = AuthStore.read();
a.partner = { ok:true, status:'approved', approvedAt:Date.now(), channel:['朋友圈'], intent:'建筑材料推广', profitConfig:{} };
AuthStore.write(a);
```

### 7.2 特殊状态模拟脚本

**auth-pending（认证审核中）**：
```javascript
var a = AuthStore.read();
a.enterprise.ok = false;
a.enterprise.status = 'pending_review';
a.enterprise.submittedAt = Date.now() - 86400000;
a.enterprise.dimensions.business.status = 'pending_review';
a.enterprise.dimensions.legal.status = 'pending_review';
AuthStore.write(a);
```

**entry-pending（入驻审核中）**：
```javascript
EntryStore.write({ type:'construction', status:'pending', active:false, submittedAt:Date.now()-86400000, depositPaid:10000, fee:0 });
```

**withdraw-pending（提现中）**：
```javascript
var b = BalanceStore.read();
b.logs.unshift({ id:'WD'+Date.now(), type:'withdraw', amount:-5000, method:'bank', ts:Date.now()-3600000, status:'pending', remark:'提现到尾号1234' });
BalanceStore.write(b);
```

**banned（已封禁）**：代码无原生实现，验证时记录为"功能缺失"，并检查 admin/risk 模块是否有封禁能力。

### 7.3 浏览器自动化

- 使用 `browser-use-automation` skill（先 Read 其 SKILL.md）
- 通过 `computer_use_tool` plane="bu" 操作浏览器
- 本地文件访问：`file:///D:/Engchain3.0/preview.html` 或启动本地 HTTP 服务
- 截图保存到 `D:\Engchain3.0\artifacts\ux-audit\`，命名规范：`{场景ID}_{页面}_{动作}.png`

### 7.4 截图命名规范

```
{S01-S10/SP1-SP4}_{页面简称}_{动作描述}.png
示例：
S01_home_guest-view.png          —— 场景S01 首页 游客视角
S05_detail_unlock-sheet.png       —— 场景S05 详情页 解锁Sheet
S06_wallet_recharge-select.png    —— 场景S06 钱包 充值套餐选择
SP1_profile_banned-banner.png     —— 场景SP1 个人中心 封禁横幅
```

---

## 八、关键文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 设计系统V3.3 | `DESIGN-SYSTEM.md` | UI审计基准（色彩/字体/间距/组件） |
| 商业模式手册 | `COMMERCE-EXECUTION-MANUAL.md` | 状态矩阵/收入流/合规红线 |
| 付费墙设计 | `PAYWALL-DESIGN.md` | 9类付费字段/Sheet结构/打码样式 |
| 前次验证框架 | `Engchain3.0-商业模式验证框架.md` | 参考 |
| 前次验证报告 | `Engchain3.0-商业模式完整性验证报告.md` | 已知问题参考 |
| 全量修复报告 | `Engchain3.0-全量修复报告.md` | 当前代码状态参考 |
| 状态Store | `js/stores.js` | AuthStore/EntryStore/BalanceStore/ModeStore/CreditStore |
| 身份推导 | `js/stores.js` L884-928 | deriveIdentity() 全局唯一身份推导 |
| 状态枚举 | `js/data.js` L885-899 | statuses[] 6级状态 |
| 入驻类型 | `js/data.js` L1064-1080 | entryTypes 定价/折扣/佣金 |
| 通用UI | `js/common.js` | stateStore/tabbar/toast/sheet/dialog |
| 详情页逻辑 | `js/detail.js` | 9类详情页渲染/付费墙/解锁 |
| 预览控制台 | `preview.html` | 状态切换/模式切换/iframe演示 |

---

## 九、已知代码问题（前次验证发现，体验影响需记录）

> 以下为前次"代码逻辑正确性"验证已发现的问题，本次体验验证中如在体验层面有表现，需记录但标注"已知代码问题，体验影响为XX"。

1. 部分页面跳转路径不一致（相对路径/绝对路径混用）
2. localStorage 键名不统一（engchain-前缀覆盖率不全）
3. 详情页解锁持久化在部分场景下失效
4. 状态切换后部分页面UI不自动刷新
5. 个人合伙人与企业合伙人类型概念在部分页面混淆
6. 破冰期/正式期价格切换在部分硬编码页面不生效

---

## 十、交付物清单

| # | 交付物 | 路径 | 阶段 |
|---|--------|------|------|
| 1 | 体验交叉验证框架 | `D:\Engchain3.0\Engchain3.0-体验交叉验证框架.md` | Phase 0 |
| 2 | 商业模式体验可行性验证报告 | `D:\Engchain3.0\Engchain3.0-商业模式体验可行性验证报告.md` | Phase 5 |
| 3 | 截图证据（E0/E1必含） | `D:\Engchain3.0\artifacts\ux-audit\*.png` | Phase 2-4 |

---

*框架版本：v1.0 ｜ 建立时间：2026-09-11 ｜ 基于代码实际状态确认*
