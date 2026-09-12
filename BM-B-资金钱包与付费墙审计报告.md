# Engchain3.0 资金与钱包审计 + 付费墙解锁经济审计报告

> 审计角色：资金与钱包审计专家 + 付费墙与解锁经济专家
> 审计对象：D:\Engchain3.0（纯前端 B2B 交易平台原型）
> 审计方式：纯代码静态审计（未使用浏览器），Grep + 逐函数精读
> 审计日期：2026-09-11 ｜ 基线：COMMERCE-EXECUTION-MANUAL v1.2 + PAYWALL-DESIGN.md + 框架第四章 4.2/4.3、第五章
> 关键文件：js/stores.js、js/databus.js、js/domain.js、js/data.js、js/detail.js、pages/wallet/*、pages/profile/auth-enterprise.html、pages/profile/entry-form.html

---

## 〇、执行摘要（先读结论）

| 结论项 | 判定 | 严重度 |
|---|---|---|
| 人民币守恒等式 | **形式上不成立 / 实质上不可验证**（流水被覆盖、消费不入账、返佣虚增入账） | P1 |
| 积分守恒等式 | **基本成立**（add/consume 均记流水，无过期机制） | — |
| 付费墙 9 类打码+解锁 | **7/9 类正确**；trade 保证金为纯模拟、agency/personnel 免费逻辑正确 | P1（trade） |
| 提现限额"每日 2 次" | **仅展示未强制** | P1 |
| 防绕付费 | 解锁判断纯 localStorage，明文在 DOM，无服务端校验 | 架构性限制 |
| 整体健康度 | **中等偏下**：核心扣次逻辑可用，但人民币账本双写模型脆弱、多处流水为假数据 | — |

**一句话结论**：积分侧（R3/R4 扣次、免费额度、奖励防重、TTL）实现较扎实；人民币侧（R1/R2 扣减、流水持久化、冻结保护、提现限额）存在多处真实 bug，且受纯前端 localStorage 架构固有制约，**不能直接用于真实资金场景**。

---

## 一、资金守恒验证结论

### 1.1 人民币守恒等式

框架要求：`累计充值(totalIn) = 当前余额(balance) + 累计消费 + 提现中 + 已提现 + 冻结(frozen)`。

**实际实现模型**（js/databus.js + js/stores.js）：

- `totalIn`：仅在 `BalanceStore.recharge`（stores.js:178）与 `settleCorp`（:200）与 `safeMoneyAdd`（domain.js:468 返佣）时增加。
- `frozen`：种子 200（stores.js:158）+ 提现申请冻结（databus.js:939 `frozen += amt`），终审打款时解冻再 `BalanceStore.withdraw` 扣 balance（databus.js:969-971）。
- "提现中"= 状态为 pending/first_ok 的提现单占用的 frozen 额（databus.js:917 withdrawalFrozen）。
- "已提现" = BalanceStore.logs 中 type=withdraw 的负向条目之和。
- "累计消费" = 钱包首页自己用 `logs 中 amount<0 的绝对值之和` 推导（wallet/index.html:438）。

**等式为何不成立 / 不可验证：**

1. **R1/R2 消费不入 BalanceStore 流水**：企业认证 ¥999（databus.js:516 `u.balance.balance -= charge`）、认证续费（:554）、入驻费 ¥3999/¥29999（:581）只减 `users[].balance.balance`，**从不向 BalanceStore.logs 写一条消费记录**。→ 钱包首页"累计消费"（靠负向日志求和）**系统性少计 R1/R2 收入**。
2. **同步覆盖会清空流水（最严重）**：`syncSnapshotIfCurrent`（databus.js:350）在每次 R1/R2 操作后执行 `BalanceStore.write(JSON.parse(JSON.stringify(u.balance)))`，而 `u.balance` 只有 `{balance, frozen, totalIn}` 三字段、**不含 logs**（见 databus.js:254）。`BalanceStore.write` 整体覆盖 `engchain-balance`，下次 `load()` 经 `Object.assign({}, def, parsed)` 把 logs 还原为 `[]`。→ **每付一次认证费/入驻费，钱包全部历史流水被清空**。守恒等式依赖的流水基础被摧毁。
3. **返佣虚增"累计充值"**：`safeMoneyAdd`（domain.js:468）把分销返佣 `totalIn += amount`。返佣是平台对外派发，不是用户"充值"，却计入 totalIn → `累计充值` 口径被污染。
4. **frozen 种子 ¥200 是悬空占位**：无任何一笔真实资金对应这 200 元冻结，纯属 seed；trade 保证金 ¥5000 又从未真实冻结（见 1.4）。
5. **R4 微信/支付宝买积分零人民币入账**：见 1.3。

**结论**：人民币守恒等式在当前实现下**不成立**——`totalIn` 被返佣虚增、`累计消费` 少计 R1/R2、`logs` 还会被同步清空，三方对账（前台/后台/LS）无法对齐。

### 1.2 积分守恒等式

框架要求：`累计获得 = 当前余额 + 累计消耗 + 过期`。

- `CreditStore.add`（stores.js:78）：`balance += credits` 且 `logs.unshift` 一条正向记录。
- `CreditStore.consume`（:84）：先判 `balance < cost return null`，再 `balance -= cost` 且记负向日志。
- **无积分过期机制**：全库无 TTL/过期清理代码；talent 解锁 7 天到期只是"重新打码"，**不回收已扣积分**。→ 等式中"过期"项恒为 0。
- 流水三态分明：recharge / unlock / 免费额度消耗（freeSpend 不计入积分 logs，仅计 quota.used）。

**结论**：积分守恒**基本成立**（每一次加/减都落 logs，余额可由 logs 累加复算）。缺口仅是 consume 非原子（见套利），以及积分商城/签到等展示页用假数据（不影响账本本身）。

### 1.3 每笔收入资金流向追踪表

| 收入流 | 场景 | 人民币侧动作 | 积分侧动作 | 是否落 BalanceStore 流水 | 问题 |
|---|---|---|---|---|---|
| 钱包充值 | wechat/alipay 充余额 | `BalanceStore.recharge` balance+/totalIn+ | — | ✅ 记 recharge | 正常 |
| 钱包充值 | 积分抵现 | 同上全额入账 | `CreditStore.consume(抵现额)` | ✅ | 抵现不抵减入账面额（促销设计，见 P3） |
| 对公充值 | CorpPay 提交→后台审批 | `settleCorp` balance+/totalIn+ | — | ✅ 记 method=corp | 正常 |
| **R1 企业认证 ¥999** | authApply enterprise | **仅 `u.balance.balance -= fee`** | — | ❌ 不写 logs，且触发同步清空 logs | **P1** |
| R1 认证续费 | authRenew | `u.balance.balance -= fee` | — | ❌ 同上 | P1 |
| R2 入驻费 ¥3999/¥29999 | entryApply | `u.balance.balance -= fee` | — | ❌ 同上 | P1 |
| **R4 套餐 ¥98/580/1280** | 余额支付买积分 | 直接 `bs.balance -= price`（裸写） | `CreditStore.add(p.credits)` | ⚠️ 手写一条 consume，但用 raw balance 不看 frozen | **P1 冻结可花** |
| **R4 套餐** | 微信/支付宝买积分 | **无任何人民币动作** | `CreditStore.add(p.credits)` | ❌ 零入账 | **P1 收入无账** |
| R3 解锁 98/29 分 | detail payGo | — | `CreditStore.consume(cost)` | n/a（积分侧） | ✅ 记 unlock |
| R3 免费额度 | 实名月 5 条+破冰 3 条 | — | `freeSpend(1)`（只加 quota.used） | n/a | ✅ |
| 提现 | 申请 | `frozen += amt`（钱未出账） | — | ⏳ pending 占用 frozen | ✅ 冻结模型正确 |
| 提现 | 终审打款 | `frozen -= amt` 再 `BalanceStore.withdraw` balance- | — | ✅ 记 withdraw | ✅ |
| 提现 | 驳回 | `frozen -= amt`（解冻，balance 不变） | — | — | ✅ |
| 分销返佣 | Rebate 派发 | `BalanceStore.recharge(method='rebate')` balance+/**totalIn+** | — | ✅ 但污染 totalIn | P2 口径 |
| 中介托管支付 | Mediation.pay | `safeMoneyMinus` balance- | — | ✅ 记 mediation | — |
| trade 建企买卖 ¥5000 | payGo deposit 模式 | **仅 toast + UnlockStore.mark，零资金动作** | — | ❌ 无 | **P1 空保证金** |

### 1.4 冻结与负余额防护

- ✅ 提现：`withdrawalApply`（databus.js:937）先查 `BalanceStore.available() >= amt`，申请即冻结，不会超提。
- ✅ BalanceStore.withdraw（stores.js:188）自身再判 `balance - frozen < amt return null`。
- ❌ **但 R1/R2 与 R4(余额支付) 三处消费都用 raw balance、不看 frozen**（databus.js:511/567、credits.html:264/278）：处于"提现冻结中"的钱仍可用来付认证费/买积分。
- ✅ 积分 consume 余额不足返回 null；detail.js:2743、editor.html:1927、personal/index.html:438 均先判 `balance >= cost` 再调用，null 实际不会触发（单线程下安全）。

---

## 二、付费墙 9 类验证表

| 业务 | 定价(代码实值) | 打码方式 | 解锁/持久化 | 过期 | 防绕付费 | 结论 |
|---|---|---|---|---|---|---|
| material | 98 积分 | Lock.full/partial/price/file 卡内就近打码 | 一次解锁全页 `.phone.is-unlocked` 驱动 | 永久 | 本地 unlocked | ✅ |
| equipment | 98 积分 | 同上 | 同上 | 永久 | 同上 | ✅ |
| labor | 98 积分 | 同上 | 同上 | 永久 | 同上 | ✅ |
| cooperation | 98 积分 | 同上 | 同上 | 永久 | 同上 | ✅ |
| franchise | 分级 49/39/29 | 留资 Sheet 先收集线索，咨询后弹付费 Sheet | mark 持久化 | 永久 | 本地 | ✅（咨询免费、联系方式付费，与 data.js:1006 一致） |
| **trade** | **¥5000 保证金** | 司法/股权/账户等字段打码 | **payGo deposit 模式仅 toast + mark，零资金** | 30 天 TTL | 本地 | **❌ P1 保证金未真实收取/托管/退还** |
| agency | 免费 | 列表打码、详情登录可见；tryUnlock 跳下单页 | 直接解锁 | — | — | ✅ |
| personnel | 免费 | 不打码，投递流程替代 | 投递后 CTA 变"查看投递状态" | — | — | ✅ |
| talent | 29 积分 | 姓名/手机/证书等就近打码 | mark 持久化 | **7 天 TTL 自动重锁**（UnlockStore:63,76） | 本地 | ✅ |

**就近打码 + 原地解锁**：✅ 付费字段在所属卡内（`pw-inline`/`pwp`/`pw-file`），点击 `[data-pw]` 唤起同一 Sheet（detail.js:2803-2808），解锁后 JS 直接去模糊（:2786-2791），不跳转。一次解锁全页生效（`.phone.is-unlocked`）。

**CTA 变化**：⚠️ 文案正确切换（detail.js:2794 未解锁"立即解锁"→已解锁"联系TA/立即咨询"），但**按钮底色未由橙变绿**——`.dab-cta` 恒为 `var(--accent)` 金橙（app.css:1890），无 `.is-unlocked` 绿态。P3。

**无效 id**：✅ 已修复——`byType[rec.bizKey]` 不存在时直接 `notFoundHtml()`，不再错误回退材料详情（detail.js:2121-2126 注释自证历史 P0 已修）。

**破冰期**：
- 注册送 3 条：detail.js:1980 `monthly += breakin.registerBonus`（叠加在月 5 条上）✅
- 游客 1 条完整示例：guestSampleInfo/guestSampleSpend（detail.js:1985-2003，存 `engchain-guest-unlocks`）✅
- 监控试用 7 天：配置存在（data.js:1067）✅
- 切换正式期：ModeStore.switch 后 `monthly` 不再加 registerBonus、guestSample=0（detail.js:1987）✅；但已发出的 unlocked 记录不清退（单期内可接受）。

---

## 三、问题清单（BM-B-XXX）

> 严重度：P0 阻断 / P1 严重 / P2 一般 / P3 建议。违反维度对应框架 11 维。

| 编号 | 文件:行 | 问题 | 违反维度 | 严重度 |
|---|---|---|---|---|
| **BM-B-001** | js/databus.js:350（syncSnapshotIfCurrent） | R1/R2 支付后用不含 logs 的 `u.balance{balance,frozen,totalIn}` 整体覆盖 BalanceStore，导致 `engchain-balance.logs` 被重置为空，钱包全部历史流水丢失 | 守恒性/闭环性/一致性 | **P1** |
| **BM-B-002** | js/databus.js:516,554,581 | R1 ¥999 / R1 续费 / R2 ¥3999·¥29999 只减 `u.balance.balance`，从不写 BalanceStore 消费流水；钱包首页"累计消费"（负日志求和，wallet/index.html:438）少计全部 R1/R2 收入 | 守恒性/闭环性 | **P1** |
| **BM-B-003** | pages/wallet/credits.html:264,278,285；js/databus.js:511,567 | 三处"余额支付"均用 raw `balance` 判断/扣减，未用 `available()=balance-frozen`；提现冻结中（含 pending 提现）的钱仍可买积分/付认证费 | 守恒性/防套利性 | **P1** |
| **BM-B-004** | js/detail.js:2739 | trade 建企买卖 ¥5000 保证金：payGo deposit 模式只弹 toast"模拟支付保证金"后 `UnlockStore.mark`，**无任何人民币入账/冻结/30 天退还台账**，保证金收入流为空壳 | 闭环性/正确性 | **P1** |
| **BM-B-005** | pages/wallet/withdraw.html:141-145；js/databus.js:934-949 | 提现"每日 2 次 dailyMax"仅在 `w-limit` 文案展示（:79），提交与 `withdrawalApply` 均不统计当日已提次数；只强制单笔 singleMax=1000。可无限次提现申请 | 异常健壮性/防套利性 | **P1** |
| **BM-B-006** | pages/wallet/credits.html:290-297 | R4 套餐选微信/支付宝时，直接 `CreditStore.add(credits)`，人民币侧既不加 balance 也不加 totalIn——非余额通道购积分无任何资金入账记录 | 闭环性/一致性 | **P1**（模拟支付原型固有限制叠加） |
| **BM-B-007** | js/domain.js:468（safeMoneyAdd） | 分销返佣派发时 `totalIn += amount`，把平台对外派发误计入"累计充值"，污染人民币守恒口径 | 正确性/一致性 | P2 |
| **BM-B-008** | js/stores.js:121-130（inviteReward）；pages/auth/register.html:138 | 邀请奖励接受**任意 ≠ 本人的非空邀请码**即发 50 积分，且无 `engchain-credits-rewards` 防重键；新用户随便填码即多得 50 积分 | 防套利性 | P2 |
| **BM-B-009** | pages/wallet/unlock-records.html:80-87 | 解锁记录页用写死的 6 条假数据（成本 10/30 分，非真实 98/29），注释自承"实际应从 CreditStore.unlockLogs 读取"，与真实解锁流水完全脱节 | 一致性/闭环性 | P2 |
| **BM-B-010** | pages/wallet/index.html:512-519 | 钱包首页"积分收支明细"为写死的 CREDIT_TX 6 条假数据（签到+20/解锁-10），未读 CreditStore.logs | 一致性 | P2 |
| **BM-B-011** | pages/wallet/invoice.html:194 | 开票金额为自由文本 `parseFloat(input)`，仅校验 >0，**不与所选订单实付金额/已充金额做一致性校验**，可自开任意金额发票 | 合规性/正确性 | P2 |
| **BM-B-012** | pages/wallet/withdraw.html:141-145 vs :189 | 最低提现 ¥10（MIN_WD）仅在实时预览红字提示，提交校验只挡 `v<=0` 与单笔上限，¥5 也能提交成功 | 异常健壮性 | P3 |
| **BM-B-013** | css/app.css:1890；js/detail.js:2794 | 解锁后 actionbar CTA 文案变"联系TA"但按钮底色恒为金橙 `--accent`，未按手册要求切绿色 | 完整性/一致性 | P3 |
| **BM-B-014** | js/stores.js:158；js/databus.js:910-911 | frozen 种子 ¥200 为悬空占位（无对应真实冻结资金）；seed pending 提现把 u1/u5 的 ¥800 冻结进**全局单一** BalanceStore（单钱包多用户 seed 混算） | 正确性 | P3 |
| **BM-B-015** | pages/wallet/credits.html:285 | 余额买积分绕过 BalanceStore 方法裸写 `bs.balance -= price`，仅手写一条 consume 日志，与 recharge/withdraw 经 Math.round 规整的口径不统一 | 一致性 | P3 |

---

## 四、套利路径清单

| # | 套利路径 | 触发方式 | 严重度 | 性质 |
|---|---|---|---|---|
| A1 | **花冻结中的钱** | 提现申请冻结余额后，用同一"冻结中余额"去买积分/付 R1/R2（因判断用 raw balance） | **高** | 真 bug（BM-B-003） |
| A2 | **绕过每日提现 2 次** | 同一日重复提交提现申请，后台两级审批无次数校验 | **中高** | 真 bug（BM-B-005） |
| A3 | **邀请码自领积分** | 注册时随便填一个 ≠ 本人的邀请码 → +50 积分，且无防重 | 中 | 真 bug（BM-B-008） |
| A4 | **localStorage 改余额/积分** | 控制台改 `engchain-balance.balance` / `engchain-credits.balance` → 立即生效，钱包页/解锁页同步 | 高 | **纯前端架构限制** |
| A5 | **localStorage 加解锁** | 手动向 `engchain-unlocked` 写 `{"material_xxx":{t:Date.now()}}` → 任意付费字段免费看 | 高 | **纯前端架构限制** |
| A6 | **DOM 查看明文** | Lock.partial/price 把明文同时渲染在 `.pwp-real`（app.css:1908 仅 display:none），F12 即见未打码联系方式 | 高 | **纯前端架构限制（设计如此：同帧原地解锁）** |
| A7 | **清空游客免费示例计数** | 删 `engchain-guest-unlocks` → 游客可重复领"1 条完整示例" | 低 | **纯前端架构限制** |
| A8 | **多标签并发超扣** | 两个标签页同时点解锁，consume/freeSpend 检查与扣减非原子（无锁），理论上可在余额临界时各扣一次导致负积分 | 低 | 架构性（单用户原型场景概率低） |
| A9 | **trade 保证金白嫖** | deposit 模式零资金即解锁，无 30 天监管/退还台账 | 中 | 空壳功能（BM-B-004） |
| A10 | **自开超额发票** | 发票页自填任意大额金额、不与实付挂钩 | 中 | 缺校验（BM-B-011，真产品需后端兜底） |

> 说明：A4–A7 为纯前端 localStorage 原型的**固有架构限制**（无服务端、无签名校验），非代码 bug；A1/A2/A3/A9/A10 为**可在原型内被利用的真 bug/功能缺失**。

---

## 五、纯前端架构性限制声明（与代码 bug 严格区分）

**属架构固有限制（无法在纯前端内根除，必须上服务端）：**
1. 钱包余额、积分、解锁记录全部存 `localStorage`，用户可在控制台任意改写（A4/A5）。无任何服务端余额/订单校验。
2. 打码采用"明文同帧渲染 + CSS 切换"以实现原地解锁（PAYWALL-DESIGN 要求），导致未解锁明文本就在 DOM 中（A6）。真实产品必须由服务端按付费状态下发脱敏/明文两版。
3. 微信/支付宝/对公均为模拟支付，无真实支付网关回调；R4 非余额通道购积分无真实资金流水（BM-B-006 的根因）。
4. 并发解锁/并发消费非原子（A8），无分布式锁。
5. BalanceStore 为**全局单钱包**（`engchain-balance` 单键），seed 却含 u1/u5/u6 多用户数据，多用户对账模型在原型层不成立。

**属代码 bug（架构不变也应修）：**
- BM-B-001（同步覆盖清流水）、BM-B-002（R1/R2 不记消费流水）、BM-B-003（冻结资金可花）、BM-B-005（每日提现次数未校验）、BM-B-008（邀请码任意领）、BM-B-009/010（流水页假数据）、BM-B-011（发票金额不校验）。

---

## 六、合规与流程补充确认

- **解锁文案合规**：paywall 文案为"解锁查看全部核心信息 / 解锁与对方沟通权限"（detail.js:2058），无"解锁查看手机号/联系方式"字样，符合手册 0.6 合规红线。✅
- **佣金退款回退**：中介托管订单 `_fullRefund` 调用 `Rebate.clawback(orderId, ratio)` 生成负向 clawback 单（domain.js:705, 416-431），退款页亦公示"订单退款→佣金回退、余额不足记负"（refund/index.html:652,854）。✅
- **R3 解锁退款**：产品策略为**一经开通不退**（refund/index.html:636-642、agreement/user.html:40-41），故无"退款回退积分/重新打码"代码——属设计策略，非缺陷。
- **发票链路**：InvoiceStore apply→approve/reject 状态机完整（stores.js:261-282），前后台经 `engchain:invoice` 事件同步；唯一缺口为金额未与实付对账（BM-B-011）。

---

## 七、修复优先级建议

1. **P1 立即修**：BM-B-001（停止用无 logs 的 u.balance 覆盖 BalanceStore，改为增量 merge 或单独持久化）、BM-B-003（所有消费统一走 `available()`）、BM-B-005（提现按当日 uid 计数校验 dailyMax）。
2. **P1 功能补全**：BM-B-004（trade 保证金至少落一条可退台账）、BM-B-002（R1/R2 消费补写 BalanceStore logs）。
3. **P2 计划修**：流水页接真数据（BM-B-009/010）、邀请码防重与真校验（BM-B-008）、发票金额对账（BM-B-011）、totalIn 口径拆分（BM-B-007）。
4. **上服务端后解决**：A4–A7 全部架构性限制 + R4 真实支付回调。
