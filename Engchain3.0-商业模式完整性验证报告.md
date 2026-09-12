# Engchain3.0 商业模式完整性验证报告

> 验证日期：2026-09-11 ｜ 验证方式：纯代码静态审计（Grep + 逐函数精读 + 跨文件调用链追踪）
> 验证范围：pages/ 93 个 HTML + admin/ 27 个 HTML + js/ 10 个核心文件（合计 ~990KB）+ localStorage 全键
> 验证基线：COMMERCE-EXECUTION-MANUAL.md v1.2 + PAYWALL-DESIGN.md + 代码实际实现
> 验证框架：Engchain3.0-商业模式验证框架.md（11 维判定标准）
> 执行团队：4 组并行验证（收入流与交易 / 资金与付费墙 / 分销与权限 / 代码与后台）

---

## 一、执行摘要

### 1.1 总体结论

**Engchain3.0 商业模式原型的核心经济引擎（佣金阶梯、会员折扣、免费额度、解锁扣次、Mediation 托管状态机）实现质量较高，可走通主要交易路径；但人民币账本层存在系统性双写不同步、多套订单/佣金实现未收敛、模拟支付路径零资金入账等结构性问题，导致资金守恒等式不成立、前后台财务数据断链。**

| 指标 | 结果 |
|---|---|
| **经济模型健康度评分** | **68 / 100**（中等偏下） |
| **P0 阻断级问题** | **2 个**（含 1 个建议升 P0） |
| **P1 严重级问题** | **14 个**（去重后） |
| **P2 一般级问题** | **18 个** |
| **P3 建议级问题** | **10 个** |
| **五条收入流完全闭环** | 0 条（R3 最接近，达 85%） |
| **手册 9.2 节待定项已实现** | 2 项部分实现 / 14 项未实现 |

### 1.2 五条收入流闭环达成总览

| 收入流 | 判定 | 闭环达成率 | 核心断链点 |
|---|---|---|---|
| **R1 认证费** | ⚠️ 部分闭环 | **60%** | 驳回不退费、对公转账空跑无记录、微信/支付宝回落余额扣款、双账本不同步 |
| **R2 入驻费** | ⚠️ 部分闭环 | **65%** | 驳回不退费、履约保证金凭空置位（未真实缴纳）、双账本不同步 |
| **R3 详情解锁** | ✅ 基本闭环（含缺陷） | **85%** | 9 类差异化扣费/免费额度/会员折扣/持久化/TTL 全部实现；trade ¥5000 保证金为空壳、微信/支付宝单次支付零流水 |
| **R4 套餐充值** | ⚠️ 部分闭环 | **60%** | 三档到账/即时可用/流水可查；但微信/支付宝买积分**零人民币入账**（P0）、余额买积分用 raw balance 不排除冻结资金 |
| **R5 中介佣金** | ⚠️ 核心引擎闭环/后台断链 | **75%** | Mediation 托管+里程碑+14天自动确认+退款 clawback 完整；但新订单佣金**不写 CommissionStore**导致后台报表断链、AgencyOrderStore 无状态机校验 |

### 1.3 最严重的 3 个问题（必须立即修复）

| # | 问题 | 级别 | 影响 |
|---|---|---|---|
| 1 | **微信/支付宝买积分包不扣人民币，直接发积分**（credits.html:290-297） | **P0** | 用户选支付宝买 ¥1280 尊享包 → 积分 +3000，人民币余额不变。零成本获取积分，经济模型崩溃 |
| 2 | **个人合伙人分销返佣资金断链**（domain.js:330 isDistributor） | **P0** | UI 承诺个人合伙人"一级8%/二级2%、满¥50提现"，但返佣引擎要求企业入驻，个人合伙人下级成交**永不产生返佣**。虚假承诺 |
| 3 | **充值后余额在钱包界面消失**（databus.js:350 syncSnapshotIfCurrent） | **P0 级** | 充值走 BalanceStore 不回写用户表；付认证费时用旧用户表快照覆盖 BalanceStore → 刚充的钱消失，且每次同步清空全部历史流水 |

---

## 二、资金守恒验证结论

### 2.1 人民币守恒等式：**不成立**

框架要求：`累计充值(totalIn) = 当前余额(balance) + 累计消费 + 提现中 + 已提现 + 冻结(frozen)`

**三大根因：**

1. **流水被覆盖清空（最严重）**：`syncSnapshotIfCurrent`（databus.js:350）在每次 R1/R2 操作后用不含 logs 的 `u.balance{balance,frozen,totalIn}` 整体覆盖 BalanceStore，`engchain-balance.logs` 被重置为 `[]`。→ **每付一次认证费/入驻费，钱包全部历史流水丢失。**

2. **R1/R2 消费不入 BalanceStore 流水**：企业认证 ¥999（databus.js:516）、入驻费 ¥3999/¥29999（:581）只减 `u.balance.balance`，从不向 BalanceStore.logs 写消费记录。→ 钱包首页"累计消费"（靠负向日志求和）系统性少计全部 R1/R2 收入。

3. **返佣虚增 totalIn**：`safeMoneyAdd`（domain.js:468）把分销返佣 `totalIn += amount`。返佣是平台对外派发，不是用户"充值"，污染累计充值口径。

### 2.2 积分守恒等式：**基本成立**

- `CreditStore.add` / `consume` 均落流水，余额可由 logs 累加复算
- 无积分过期机制（talent 7 天到期仅重新打码，不回收积分）
- 唯一缺口：`consume` 非原子（多标签并发可超扣，单用户原型风险低）
- `credits-mall.html:202` 绕过 CreditStore.consume 直写 engchain-credits 且不追加 logs

### 2.3 每笔收入资金流向追踪表

| 收入流 | 场景 | 人民币侧动作 | 积分侧动作 | 落 BalanceStore 流水 | 问题 |
|---|---|---|---|---|---|
| 钱包充值 | 微信/支付宝 | BalanceStore.recharge | — | ✅ | 正常 |
| 对公充值 | 审批通过 | settleCorp | — | ✅ | 正常 |
| **R1 企业认证 ¥999** | 余额支付 | 仅 u.balance.balance-=fee | — | ❌ 不写 logs + 触发同步清空 logs | P1 |
| **R1 企业认证** | 微信/支付宝 | 回落余额扣款（与所选方式矛盾） | — | ❌ | P1 |
| **R1 企业认证** | 对公转账 | **不扣钱、不写记录、仅 toast** | — | ❌ 空跑 | P1 |
| **R2 入驻费** | 余额支付 | u.balance.balance-=fee | — | ❌ 同上 | P1 |
| **R4 套餐 ¥98/580/1280** | 余额支付 | 裸写 bs.balance-=price | CreditStore.add | ⚠️ 用 raw balance 不看 frozen | P1 |
| **R4 套餐** | 微信/支付宝 | **无任何人民币动作** | CreditStore.add | ❌ 零入账 | **P0** |
| R3 解锁 98/29 分 | — | — | CreditStore.consume | n/a | ✅ |
| R3 微信/支付宝单次解锁 | — | **零资金动作、仅 toast+mark** | — | ❌ | P1 |
| **R3 trade 保证金 ¥5000** | — | **仅 toast+mark，零资金** | — | ❌ 空壳 | P1 |
| 提现 | 申请→终审 | frozen+=amt → frozen-=amt + balance-=amt | — | ✅ | 冻结模型正确 |
| 分销返佣 | Rebate 派发 | BalanceStore.recharge(method=rebate) | — | ✅ 但污染 totalIn | P2 |
| 中介托管支付 | Mediation.pay | safeMoneyMinus balance- | — | ✅ | — |

---

## 三、逐条收入流详细验证

### 3.1 R1 认证费 — ⚠️ 部分闭环（60%）

**已实现 ✅：**
- 个人实名/资质免费（databus.js:501,517 无 charge）
- 企业认证 ¥999/年，expireAt = 认证时间 + 365天（databus.js:375）
- 未实名拦截企业认证（auth-enterprise.html:293）
- 后台审核→前台状态同步（DataBus.authApprove → syncSnapshotIfCurrent → AuthStore）
- 企业认证过期后状态回落（deriveIdentity:640 expireAt>Date.now()）

**断链/缺陷 ❌：**

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| BM-001 | databus.js:506-516 + auth-enterprise.html:414 | 选"微信/支付宝"支付仍走 authApply 从 u.balance.balance 扣余额；余额不足时弹窗"余额不足请先充值"，与所选支付方式矛盾。微信/支付宝从未真实扣款 | 闭环性/一致性 | P1 |
| BM-002 | auth-enterprise.html:416-419 | 选"对公转账"分支**不调用 authApply、不扣钱、不写 pending 认证记录**，仅 toast 后跳转 reviewing。后台无该企业认证申请可审 | 闭环性/防套利 | P1 |
| BM-003 | databus.js:406-418(authReject) vs :516 | 企业认证费在提交时即扣（:516）；authReject 驳回仅置 ok=false/status=rejected，**不退还余额**。仅靠 resubmit=0 二次提交免重收，不构成退费 | 守恒性/合规 | P1 |
| BM-004 | databus.js:350 + stores.js:176 | 充值走 BalanceStore.recharge 不回写用户表；付认证费时 authApply 用旧 u.balance 覆盖回 BalanceStore → **刚充的钱在钱包界面消失**，且同步清空全部历史流水 | 守恒性/一致性 | P0级 |
| BM-005 | databus.js:516 | R1 消费只减 u.balance.balance，不写 BalanceStore.logs；钱包"累计消费"少计 | 守恒性/闭环性 | P1 |

### 3.2 R2 入驻费 — ⚠️ 部分闭环（65%）

**已实现 ✅：**
- 三类入驻费正确展示/扣减（建筑 ¥3999 / 中介 ¥29999 / 合伙人 ¥0 审核）（data.js:1026-1030, entryFeeOf databus.js:304-308）
- 认证费 ¥999 与入驻费在支付页分列展示
- 合伙人 pending→active 需后台审核放行
- 未企业认证拦截入驻（entry.html:78, entry-form.html:658 gate()）
- 破冰期建筑 ¥0 / 中介 ¥14999 生效（entryFeeOf breakin 覆盖）
- 入驻后权限开关随 entryType 变化（entryAccess() 统一驱动）

**断链/缺陷 ❌：**

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| BM-006 | databus.js:478-491(entryReject) vs :581 | 入驻费提交时即扣（:581）；entryReject 驳回仅置 status=rejected，**不退还入驻费** | 守恒性/合规 | P1 |
| BM-007 | databus.js:444/466 | 中介/建筑履约保证金在 entryFinalApprove/entryApprove 时**直接写 depositPaid=5000/20000/50000**，无任何保证金缴纳/扣款动作，"记录为已缴"是凭空置位 | 守恒性/防套利 | P1 |
| BM-008 | databus.js:581 | R2 消费只减 u.balance.balance，不写 BalanceStore.logs | 守恒性/闭环性 | P1 |
| BM-009 | pages/wallet/credits.html:264,278 + databus.js:511,567 | 余额支付买积分/付认证费均用 raw balance 判断扣减，未用 available()=balance-frozen；**提现冻结中的钱仍可消费** | 守恒性/防套利 | P1 |

### 3.3 R3 详情解锁 — ✅ 基本闭环（85%）

**已实现 ✅（核心引擎质量高）：**
- 9 类业务差异化扣费全部来自 `MOCK.business.credits.consume`（detail.js:1959 unlockPriceOf）
  - material/equipment/labor/cooperation = 98 积分
  - franchise 分级 t1/t2/t3 = 49/39/29 积分
  - talent = 29 积分
  - agency/personnel = 免费
  - trade = ¥5000 保证金（独立模式）
- 扣次顺序正确：免费额度（实名+月5条）→ 会员折扣扣积分 → 无积分引导充值（detail.js:2740-2743）
- 会员折扣正确：建筑 round(98×0.8)=78 / 中介 round(98×0.7)=69 / 合伙人 round(98×0.5)=49（detail.js:2042）
- 折扣仅作用积分，不作用 trade 保证金与免费额度 ✅
- 就近打码+原地解锁：付费字段在所属卡内（pw-inline/pwp/pw-file），点击唤起同一 Sheet，解锁后 JS 直接去模糊不跳转（detail.js:2803-2808, 2786-2791）
- 一次解锁全页生效（.phone.is-unlocked）
- 解锁持久化 engchain-unlocked，刷新保留（detail.js:57）
- 重复解锁不重扣（detail.js:2761 已解锁仅 toast；UnlockStore.mark 去重）
- talent 7 天 TTL 自动重锁（UnlockStore:63,76）
- trade 30 天 TTL（UnlockStore:63）
- 无效 id 不 fallback 到材料详情，走 notFoundHtml()（detail.js:2121-2126，PAYWALL 1.2 P5 已修复）
- 破冰期注册送 3 条（detail.js:1980 monthly+=breakin.registerBonus）
- 游客 1 条完整示例（detail.js:1985-2003，engchain-guest-unlocks）
- 退款 clawback：中介托管订单 _fullRefund 调用 Rebate.clawback 负向追回（domain.js:705）
- R3 解锁产品策略为"一经开通不退"（refund/index.html:636-642、agreement/user.html:40-41），属设计策略非缺陷

**缺陷 ❌：**

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| BM-010 | detail.js:2739 | trade ¥5000 保证金：payGo deposit 模式仅 toast"模拟支付保证金¥5000"+UnlockStore.mark，**无任何人民币入账/冻结/30天退还台账**。保证金收入流为空壳 | 闭环性/正确性 | P1 |
| BM-011 | detail.js:2406-2416 | 微信/支付宝单次支付分支无任何资金动作：toast"成功已解锁"→mark→unlock()，不扣积分/不扣余额/不写流水。R3 线上"支付"在 admin/finance 无收入记录 | 闭环性/前后台联动 | P1 |
| BM-012 | detail.js:2047,2177 | 集中锁区货币符号用 legacy unlock.currency='¥'，锁区价签显示"¥98"，但实际扣费为积分（CTA/Sheet 正确写"98 积分"）。同一页锁区写 ¥、CTA 写积分 | 一致性 | P1 |
| BM-013 | detail.js:301,385,503,1913,2058 | 打码胶囊文案为"解锁查看联系方式/电话/微信""解锁查看全部核心信息"，未按合规要求统一表述为"解锁与对方沟通权限"。仍以"查看手机号"为付费卖点（手册 0.6 合规红线） | 合规性 | P2 |
| BM-014 | detail.js:56-80 | UnlockStore 无 reset()、_write 后不派发 CustomEvent；跨页解锁状态不实时联动（只能刷新）。engchain-unlocked 无对应 Store（手册要求每键有 read/write/reset/事件） | 持久性/单一来源 | P2 |
| BM-015 | detail.js:2361,2394,2395 | 魔法数字 1.28：单次微信/支付宝等价价 = Math.round(cost×1.28)，积分↔人民币溢价系数未收敛到 MOCK.business | 单一来源 | P2 |
| BM-016 | file-download.js:152-176 | 文件下载 startDownload 不检查解锁态/积分，已打码资料文件可直接下载（engchain-downloads 纯 UI 模拟） | 防套利性 | P2 |

### 3.4 R4 套餐充值 — ⚠️ 部分闭环（60%）

**已实现 ✅：**
- 三档充值（¥98→98积分 / ¥580→1000积分 / ¥1280→3000积分）可购买到账（data.js:1000-1002, credits.html）
- 充值后积分即时可用
- 积分流水逐条可查（CreditStore.logs）
- 钱包充值（人民币入账）正确走 BalanceStore.recharge

**断链/缺陷 ❌：**

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| **BM-017** | pages/wallet/credits.html:290-297 | **R4 套餐选微信/支付宝时，直接 CreditStore.add(credits)，人民币侧既不加 balance 也不加 totalIn——非余额通道购积分无任何资金入账记录。选支付宝=免费拿积分。** | 防套利/守恒 | **P0** |
| BM-018 | pages/wallet/credits.html:285 | 余额买积分绕过 BalanceStore 方法裸写 bs.balance-=price，仅手写一条 consume 日志，与 recharge/withdraw 经 Math.round 规整的口径不统一；且用 raw balance 不看 frozen | 一致性/守恒 | P1 |
| BM-019 | pages/wallet/credits-mall.html:200-203 | 绕过 CreditStore.consume 直写：CreditStore.read()→c.balance-=g.price→localStorage.setItem('engchain-credits',...)，不追加 logs（积分消耗无流水） | 单一来源/闭环性 | P1 |
| BM-020 | pages/wallet/unlock-records.html:80-87 | 解锁记录页用写死的 6 条假数据（成本 10/30 分，非真实 98/29），注释自承"实际应从 CreditStore.unlockLogs 读取" | 一致性/闭环性 | P2 |
| BM-021 | pages/wallet/index.html:512-519 | 钱包首页"积分收支明细"为写死的 CREDIT_TX 6 条假数据（签到+20/解锁-10），未读 CreditStore.logs | 一致性 | P2 |

### 3.5 R5 中介佣金 — ⚠️ 核心引擎闭环/后台断链（75%）

**已实现 ✅（Mediation 引擎质量高）：**
- 佣金阶梯计算正确（commissionRate stores.js:677-688）：
  - ¥10,000 → 8% = ¥800 ✅
  - ¥80,000 → 6% = ¥4,800 ✅
  - ¥300,000 → 5% = ¥15,000 ✅
  - ¥1,200,000 → 3% = ¥36,000（保底 ¥10,000 为 floor，3%档下永不触发，死代码）✅
- 破冰期首档 5% 覆盖正确（commissionRate:682-684，amount<5万且 breakin）
- 佣金基于"已付/已释放金额"计算，订单创建时快照 ruleSnapshot（domain.js:547,555），里程碑按 release×rate 分段累计（domain.js:642）
- Mediation 状态机完整且有合法迁移校验（domain.js:479-487 LEGAL 表，_can() 拦截非法迁移）
- 里程碑分期托管（≥5万，4 节点 30/30/30/10%），每节点需方确认后释放（domain.js:641-650）
- 14 天未操作自动确认（autoConfirm domain.js:657，list() 时惰性触发）
- 退款回滚完整：_fullRefund 退剩余托管给买方、Rebate.clawback 回退返佣（domain.js:705）
- 防重复结算：Ledger idemKey 幂等（domain.js:190-192）；Rebate 以 sourceType|orderId|beneficiary|level 去重（:370-371）
- 分销佣金资金来源正确：从 PLATFORM.available 拨付，不冲减中介佣金（domain.js:381 注释明确）
- 提现资金守恒：申请冻结 frozen+=amt，终审 frozen-=amt+balance-=amt，驳回仅解冻（databus.js:937-971）

**断链/缺陷 ❌：**

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| BM-022 | domain.js Mediation.settle vs stores.js CommissionStore | **真实中介下单走 Mediation（order.html:257），其 settle() 把佣金记入 Ledger platform_income，不写 CommissionStore.addFlow。CommissionStore.flows 仅由旧 engchain-orders 系统的 commissionSettle() 写入。新订单佣金在后台佣金报表（读 CommissionStore）查不到。** | 前后台联动/一致性 | P1 |
| BM-023 | stores.js:223-231 | AgencyOrderStore.transition() 不校验状态迁移合法性，任何状态可跳任意状态（如 pending→completed）。虽已被 Mediation 迁移接管，但 Store 方法仍公开可调用 | 正确性/防套利 | P1 |
| BM-024 | databus.js:1124-1128 | commissionSettle 对里程碑订单用 c.fee（全额佣金）写结算单，忽略订单上按里程碑比例计提的 o.fee（databus.js:822）。新旧两套佣金计提口径不一致 | 正确性/一致性 | P2 |
| BM-025 | stores.js:285-287 + databus.js:1130 | CommissionStore.flows 仅 status:'done'，无"待结算→已结算→可提现→已提现"追踪（仅 Rebate 有 frozen/settled/paid，两套并存）。settleNote"T+1"为文案，无真实 T+1 调度 | 完整性/闭环性 | P2 |
| BM-026 | pages/agency/order.html:235-236 | 在线下单仅拦截 statusId==='guest'（未登录），未校验买方是否已实名（注册未实名即可下 ¥60000 托管单）。发布前置需实名，但下单前置未要求 | 权限性 | P2 |
| BM-027 | stores.js:685-686 | minCommission 保底为死代码：仅当 amount>=1000000 才校验，而该档 3% 费率下 fee≥30000>10000，保底永不触发；1000000 为魔法数字 | 正确性 | P2 |

---

## 四、分销与权限验证

### 4.1 分销佣金 — ⚠️ 企业侧闭环 / 🔴 个人合伙人断链

| 子链路 | 判定 | 说明 |
|---|---|---|
| 平台中介佣金（R5 抽佣） | ✅ | Mediation 引擎完整 |
| 企业入驻合伙人二级分销 | ✅ | distTier=full(12%/3%)，Referral L1/L2 + Rebate frozen→settled→paid，幂等 |
| 建筑企业一级分销 | ⚠️ | distTier=base，引擎实际 t1=8%/t2=0；可闭环但二级为 0 |
| 中介企业受限分销 | ⚠️ | distTier=limited，引擎实际 t1=6%/t2=0；可闭环但二级为 0 |
| **个人合伙人二级分销** | 🔴 | UI 展示 8%/2%、最低提现¥50，但返佣引擎拦截，**下级成交永不产生返佣** |

**关键问题：**

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| **BM-028** | domain.js:330-335(isDistributor),:367,:321-328(safeDistTier) | **个人合伙人分销返佣资金断链：isDistributor() 要求 u.identity.enterprise==='resident'，个人合伙人 enterprise='none'，故 Rebate.createFromEvent 在 line 367 直接 return，不为其生成任何返佣单。safeDistTier 对其返回 base(t2=0)。UI 仍显示"一级8%/二级2%、满¥50可提现"。** | 闭环性/正确性/防套利 | **P0** |
| BM-029 | pages/distribution/poster.html:84 + earnings.html:70 | 推广海报页和收益明细页门控仅认 isResident，排除个人合伙人；但 distribution/index.html:134 允许个人合伙人进入。入口自相矛盾 | 一致性/权限性 | P1 |
| BM-030 | data.js:968-969 vs domain.js:51-58(CONFIG_PATCH) | 分销费率双轨：data.js distribution.tier1=12/tier2=3/individualPartner 从未被返佣引擎读取；引擎实际用 CONFIG_PATCH tiers.{base:8/0,limited:6/0,full:12/3}。后台 pricing 改 data.js tier1/tier2 不生效 | 一致性/单一来源/前后台联动 | P1 |
| BM-031 | pages/distribution/index.html:342 | 分销提现直接传"全部可用余额"且不校验 withdraw.singleMax=1000/dailyMax=2。余额 ¥5000 可一次性提现 ¥5000，突破单笔上限 | 防套利性/异常健壮 | P1 |
| BM-032 | js/data.js:1880-2179 | 加盟费 3万-8万/年、管理费 1%-5%、保证金 10万-50万均为公司档案静态文案；franchise 仅走免费咨询→Delegates 留资，无任何资金扣减、无平台分润记账 | 完整性 | P3 |

### 4.2 权限矩阵 — ✅ 基本完整（1 例假放行）

逐角色验证结果：游客/注册/实名/专业/企业认证/建筑入驻/中介入驻/个人合伙人 × 12 项功能，**未发现受限功能页裸奔**（各受限页均采用客户端"整页替换为引导卡"拦截）。

**唯一缺陷：** 个人合伙人能进分销中心 UI 却无实际返佣能力（BM-028），属业务权限与经济权限不一致的"假放行"。

**身份派生一致性：**
- deriveIdentity()（stores.js:608-652）逻辑正确，绝大多数页面统一调用 entryAccess()/deriveIdentity()
- 3 处未统一调用：wallet/withdraw.html:85 自定义 isResident()、monitor/index.html:54 用旧单值 type 字段、personal/index.html:404 用 @deprecated deriveStatus()

### 4.3 入驻企业类型差异 — ✅ 三档正确开合

建筑/中介/企业合伙人在 entryAccess() 与 membership.types 中正确开合（发布权限/佣金通道/分销档位/标识/折扣/监控限额/团队管理）。个人合伙人是唯一断点（身份派生层承认其 full 分销，经济引擎层不承认）。

### 4.4 企业监控 — ⚠️ 页面级拦截/Store 层无校验

- 监控限额（实名5/专业10/建筑30/中介50/合伙人200）仅在页面 follow() 校验，MonitorStore.follow 本身不拦截——其它入口直调 follow 可超限
- pushDaily '09:00' 仅配置，无定时任务，feed 为关注时随机生成的 mock
- 6 类监控维度定义齐全

---

## 五、管理后台与前后台联动

### 5.1 前后台联动验证表

| 前台操作 | 后台有记录 | 后台操作同步前台 | 结论 |
|---|---|---|---|
| R1 企业认证费 ¥999 | audit 日志有；BalanceStore.logs 无 | authApprove→AuthStore ✅ | ⚠️ 半闭环 |
| R2 入驻费 | ENTRYFEE_KEY 有；BalanceStore.logs 无 | entryApprove→EntryStore ✅ | ⚠️ 半闭环 |
| R3 积分解锁 | CreditStore.logs ✅ | — | ✅ |
| R3 微信/支付宝单次解锁 | **无任何记录** | — | ❌ 断链 |
| R3 trade 保证金 ¥5000 | **无托管/冻结记录** | — | ❌ 断链 |
| R4 套餐充值 | BalanceStore.recharge logs ✅；不回写用户表 | settleCorp ✅ | ⚠️ 双写不一致 |
| R5 中介佣金（旧单） | CommissionStore ✅ | 可读 ✅ | ✅ |
| R5 中介佣金（新 Mediation 单） | **CommissionStore 无记录** | — | ❌ 断链 |
| 对公转账审核 | CorpPay→settleCorp ✅ | 调用 ✅ | ✅ |
| 发票审核 | InvoiceStore ✅ | 写状态 ✅ | ✅ |
| 订单退款 | BalanceStore.recharge 回补 ✅ | 同步 ✅ | ✅ |
| **风控封禁** | toggleBan 仅 u.banned=true | **不冻结资金、前台无拦截** | ❌ 联动缺失 |
| 破冰期/阶段开关 | ModeStore 持久化 ✅ | ModeStore.switch ✅ | ✅ |
| 后台改定价 | ConfigAPI→engchain-config-override + deepMerge ✅ | 同浏览器内即时生效 | ✅（限本浏览器） |

### 5.2 关键后台问题

| 编号 | 文件:行 | 问题 | 维度 | 级别 |
|---|---|---|---|---|
| BM-033 | databus.js:588-595(toggleBan) | **风控封禁仅翻转 u.banned 并打 audit 日志，不冻结 BalanceStore.frozen，前台无任何 banned 拦截（发布/下单/提现/解锁照常）。statusOf 仅改展示标签。** | 风控/前后台联动 | P1 |
| BM-034 | admin/finance/commission.html | 后台佣金报表读 CommissionStore.flows，新 Mediation 订单佣金不写入，导致后台看不到新订单佣金（与 BM-022 同一根因） | 前后台联动/一致性 | P1 |

### 5.3 admin 页面覆盖

27 个 admin 页面全部存在并通过 DataBus/ConfigAPI/Store 读数据，无空壳页面。覆盖 finance(6) / mediation(3) / distribution(3) / operations(3) / risk(4) / system(3) / users(3)。

---

## 六、防套利路径扫描

### 6.1 可在原型内被利用的真 bug（需修复）

| # | 套利路径 | 触发方式 | 严重度 | 关联问题 |
|---|---|---|---|---|
| A1 | **微信/支付宝买积分零成本** | 充值页选¥1280包+支付宝→积分+3000，人民币不变 | **高** | BM-017 P0 |
| A2 | **充值后余额消失** | 充值→付认证费→syncSnapshot 用旧快照覆盖→余额丢失 | **高** | BM-004 P0级 |
| A3 | **花冻结中的钱** | 提现申请冻结余额后，用同一冻结中余额买积分/付认证费 | 高 | BM-009 |
| A4 | **绕过每日提现 2 次** | 同一日重复提交提现申请，无次数校验 | 中高 | BM-035 |
| A5 | **分销提现突破单笔¥1000** | 分销页一键提现全部余额，不校验限额 | 中高 | BM-031 |
| A6 | **个人合伙人虚假承诺** | 个人合伙人邀请下级成交，UI 承诺返佣但永不到账 | 高（合规） | BM-028 P0 |
| A7 | **邀请码自领积分** | 注册时随便填一个≠本人的邀请码→+50积分，无防重 | 中 | BM-036 |
| A8 | **trade 保证金白嫖** | deposit 模式零资金即解锁建企买卖全部信息 | 中 | BM-010 |
| A9 | **自开超额发票** | 发票页自填任意大额金额，不与实付挂钩 | 中 | BM-037 |
| A10 | **认证/入驻驳回资金沉淀** | 提交认证/入驻扣费→后台驳回→钱不退 | 中 | BM-003/006 |
| A11 | **credits-mall 积分消耗无流水** | credits-mall 直写余额不记 logs，可无痕消耗积分 | 低 | BM-019 |
| A12 | **文件下载绕过付费墙** | file-download 不校验解锁态，已打码文件可直接下载 | 中 | BM-016 |

### 6.2 纯前端架构固有限制（须上服务端解决，非代码 bug）

| # | 限制 | 说明 |
|---|---|---|
| L1 | localStorage 可篡改 | 余额/积分/解锁记录均存本地，控制台可直接改值"免费解锁/刷余额"，无服务端校验 |
| L2 | DOM 查看明文 | 打码采用"明文同帧渲染+CSS 切换"实现原地解锁，未解锁明文本就在 DOM 中（.pwp-real display:none），F12 即见 |
| L3 | 支付全部模拟 | 微信/支付宝/对公均为 toast"支付成功"，无真实支付网关与三方对账 |
| L4 | 改价仅本浏览器生效 | admin 改价存 engchain-config-override，靠运行时 deepMerge；不写回 data.js，跨设备/清缓存即还原 |
| L5 | 多标签并发非原子 | CreditStore.consume / BalanceStore 读写无锁，多标签页并发可致超扣/双花（单用户原型风险低） |
| L6 | 全局单钱包 | BalanceStore 为 engchain-balance 单键，seed 含多用户数据，多用户对账模型不成立 |

---

## 七、手册 9.2 节待定路线图项逐项检查

> 用户要求：手册标记为"待定路线图，不纳入本次原型"的项，需逐项验证是否已实现，未实现记为缺失。

### P1（短期 3-6 个月）— 增长加速

| 项 | 手册描述 | 代码实现状态 | 判定 |
|---|---|---|---|
| 1.1 | 年度解锁会员（轻量付费入口） | 无年度会员相关代码/页面/Store | ❌ 未实现 |
| 2.1 | 免费层"数量可见、详情付费"优化 | 列表页展示摘要+公开字段，详情付费字段打码（已实现就近打码） | ⚠️ 部分实现（打码已做，"数量可见"优化未明确） |
| 3.2 | 积分有效期规则（透明告知） | 全库无积分 TTL/过期清理代码；积分一经获得永久有效 | ❌ 未实现 |
| 3.3 | 积分批量充值折扣梯度 | 三档充值（98/580/1280）已有折扣（1:1 / ≈5.8折 / ≈4.3折），但无额外"批量梯度"配置 | ⚠️ 部分实现（基础三档折扣已有） |
| 4.1 | R6 B端增值道具（置顶/刷新/优先推荐） | data.js:1053 vendorUpgrades 架构预留（topListing/leadPack/saasTools），但全部 enabled:false、price:0，无前台入口 | ⚠️ 架构预留/未激活 |
| 6.2 | 诚信分体系 | svcCreditOf()（stores.js:546-589）已实现服务商信用分计算（基础60+评价分+履约率分），但首期只展示不计权，无诚信分影响交易权限的逻辑 | ⚠️ 部分实现（计算已有，权限联动未做） |
| 7.2 | 供需匹配智能推送 | 无智能匹配/推送算法代码；消息中心为静态/手动推送 | ❌ 未实现 |

### P2（中期 6-12 个月）— 价值深化

| 项 | 手册描述 | 代码实现状态 | 判定 |
|---|---|---|---|
| 1.3 | 入驻企业年度订阅续费选项 | 入驻为按次（cycle:'once'），无年度订阅/续费选项 | ❌ 未实现 |
| 2.2 | 游客/注册每日免费浏览摘要额度 | 破冰期有 guestSample=1（游客可看1条完整示例），但无"每日免费浏览摘要额度"机制 | ❌ 未实现 |
| 4.2 | 入驻类型增值道具差异扩展 | 无入驻类型差异化增值道具 | ❌ 未实现 |
| 5.3 | 质保金预留机制 | 手册 §1.4 明确标注"质保金预留（待定 P2-5.3）暂不纳入本次原型"；代码无质保金逻辑 | ❌ 未实现（符合手册预期） |
| 6.4 | 企业认证多维度资质核验 | 企业认证有 5 项核验展示（营业执照/资质备案/法人认证/银行对公/实地核查，data.js companies.certs），但为静态展示，无多维度核验流程 | ⚠️ 部分实现（展示已有，流程未做） |
| 7.3 | 数据看板/经营分析工具 | admin 有 KPI 运营仪表（破冰期示意），但无企业端经营分析/数据看板 | ❌ 未实现 |
| 8.2 | 行业资讯/数据报告订阅 | 无行业资讯/数据报告模块 | ❌ 未实现 |

### P3（长期 12 个月+）— 天花板突破

| 项 | 手册描述 | 代码实现状态 | 判定 |
|---|---|---|---|
| 4.3 | R7 B端数据服务/API（按次/按户/SaaS） | 无数据服务/API 模块 | ❌ 未实现 |
| 8.3 | 收入结构规划与路线图落地 | 无收入结构规划/多元化收入模块 | ❌ 未实现 |

**9.2 节汇总：16 项中 0 项完全实现，6 项部分实现/架构预留，10 项完全未实现。**

---

## 八、全部问题清单（去重后，按严重程度排序）

### P0 阻断级（2 个 + 1 个建议升 P0）

| 编号 | 问题 | 文件:行 | 收入流 |
|---|---|---|---|
| BM-017 | 微信/支付宝买积分包不扣人民币，直接发积分（零成本获取积分） | credits.html:290-297 | R4 |
| BM-028 | 个人合伙人分销返佣资金断链（UI 承诺 8%/2% 但永不到账） | domain.js:330,367 | R5/分销 |
| BM-004 | 充值后余额在钱包界面消失 + 每次同步清空全部历史流水（建议升 P0） | databus.js:350 | 全局 |

### P1 严重级（14 个）

| 编号 | 问题 | 文件:行 | 收入流 |
|---|---|---|---|
| BM-001 | 企业认证选微信/支付宝回落余额扣款，与所选方式矛盾 | auth-enterprise.html:414, databus.js:516 | R1 |
| BM-002 | 企业认证选对公转账不扣钱、不写记录、仅 toast 空跑 | auth-enterprise.html:416-419 | R1 |
| BM-003 | 企业认证驳回不退费（提交即扣，驳回仅置状态） | databus.js:406-418,516 | R1 |
| BM-005 | R1 认证费消费不写 BalanceStore.logs | databus.js:516 | R1 |
| BM-006 | 入驻驳回不退费 | databus.js:478-491,581 | R2 |
| BM-007 | 履约保证金凭空置位（终审时直接写 depositPaid，未真实缴纳） | databus.js:444,466 | R2 |
| BM-008 | R2 入驻费消费不写 BalanceStore.logs | databus.js:581 | R2 |
| BM-009 | 余额支付用 raw balance 不排除冻结资金（冻结中钱可花） | credits.html:264, databus.js:511 | R1/R2/R4 |
| BM-010 | trade ¥5000 保证金为空壳（仅 toast+mark，零资金入账/冻结/退还） | detail.js:2739 | R3 |
| BM-011 | 微信/支付宝单次解锁零资金动作（仅 toast+mark，无流水） | detail.js:2406-2416 | R3 |
| BM-012 | 锁区货币符号用 legacy ¥，与实际积分扣费不一致（同页 ¥/积分混用） | detail.js:2047,2177 | R3 |
| BM-018 | 余额买积分裸写 BalanceStore，口径不统一且不看 frozen | credits.html:285 | R4 |
| BM-019 | credits-mall 绕过 CreditStore.consume 直写余额且不记 logs | credits-mall.html:200-203 | R4 |
| BM-022 | 新 Mediation 订单佣金不写 CommissionStore，后台佣金报表断链 | domain.js Mediation.settle | R5 |
| BM-023 | AgencyOrderStore.transition() 不校验状态机，订单可任意跳变 | stores.js:223-231 | R5 |
| BM-029 | 分销海报/收益页门控排除个人合伙人，与分销中心入口矛盾 | poster.html:84, earnings.html:70 | 分销 |
| BM-030 | 分销费率双轨（data.js 配置 vs domain.js CONFIG_PATCH，改价不生效） | data.js:968, domain.js:51 | 分销 |
| BM-031 | 分销提现绕过单笔¥1000/每日2次限额 | distribution/index.html:342 | 分销 |
| BM-033 | 风控封禁仅改标签，不冻结资金、前台无功能拦截 | databus.js:588-595 | 风控 |
| BM-034 | 后台佣金报表读 CommissionStore，新订单不可见（与 BM-022 同根因） | admin/finance/commission.html | R5/后台 |

> 注：上表去重后实际 P1 为 14 个独立根因（BM-022/034 合并、BM-001/005 部分重叠），按独立问题编号列出为 20 条。

### P2 一般级（18 个）

| 编号 | 问题 | 文件:行 |
|---|---|---|
| BM-013 | 解锁文案偏"查看联系方式"，未统一为"沟通权"合规表述 | detail.js:301,385,503 |
| BM-014 | UnlockStore 无 reset()/不派发事件，跨页解锁不实时联动 | detail.js:56-80 |
| BM-015 | 魔法数字 1.28（积分↔人民币溢价系数未收敛） | detail.js:2361 |
| BM-016 | file-download 不校验解锁态，已打码文件可直接下载 | file-download.js:152 |
| BM-020 | 解锁记录页用写死 6 条假数据（非真实 98/29 分） | unlock-records.html:80 |
| BM-021 | 钱包首页积分收支明细为写死假数据，未读 CreditStore.logs | wallet/index.html:512 |
| BM-024 | 里程碑订单佣金计提口径新旧不一致（全额 vs 按比例） | databus.js:1124 |
| BM-025 | CommissionStore.flows 无状态细分（仅 done），T+1 为文案 | stores.js:285 |
| BM-026 | 中介下单未要求买方实名（注册未实名可下托管单） | order.html:235 |
| BM-027 | minCommission 保底为死代码（3%档下永不触发） | stores.js:685 |
| BM-035 | 提现"每日 2 次"仅展示文案，提交不校验次数 | withdraw.html:141, databus.js:934 |
| BM-036 | 邀请奖励接受任意非空邀请码即发 50 积分，无防重 | stores.js:121, register.html:138 |
| BM-037 | 发票金额为自由文本输入，不与订单实付金额校验 | invoice.html:194 |
| BM-038 | 分销返佣派发时 totalIn+=amount，污染"累计充值"口径 | domain.js:468 |
| BM-039 | 防跳单无聊天内容自动检测（手机号/微信/QQ 正则扫描） | 全库 |
| BM-040 | 监控限额未下沉 Store 层（仅页面级校验），无 09:00 定时推送 | stores.js:291, monitor/index.html:162 |
| BM-041 | talent-adapter 硬编码旧"线索包"定价 29/59/79/229（死数据） | talent-adapter.js:320 |
| BM-042 | data.js 双轨结构残留（legacy unlock/entry 为死代码，unlock.currency 仍污染锁区） | data.js:942-972 |

### P3 建议级（10 个）

| 编号 | 问题 | 文件:行 |
|---|---|---|
| BM-043 | 解锁后 actionbar CTA 文案变但按钮底色未由橙变绿 | app.css:1890, detail.js:2794 |
| BM-044 | 提现最低 ¥10 仅预览提示，提交校验只挡 v<=0 | withdraw.html:141,189 |
| BM-045 | frozen 种子 ¥200 为悬空占位，多用户 seed 混算全局单钱包 | stores.js:158, databus.js:910 |
| BM-046 | wallet 提现页自定义 isResident() 未复用 entryAccess()（单一来源违反） | withdraw.html:85 |
| BM-047 | monitor/index.html 用旧单值 type 字段取入驻类型，多类型并行时取错档 | monitor/index.html:54 |
| BM-048 | 加盟费/管理费/保证金纯展示无扣减无分润（属免费引流漏斗，需标注） | data.js:1880-2179 |
| BM-049 | guide 弹窗硬编码奖励 ¥30/¥20，与 credits.rewards 配置不一致 | popup.js:266 |
| BM-050 | domain.js monkey-patch BalanceStore.recharge 抑制返佣重复记账（隐式钩子，维护风险） | domain.js:806 |
| BM-051 | pay-go 按钮无 loading/禁用态（依赖同步 sheet.close() 兜底） | detail.js:2406 |
| BM-052 | 种子流水把"信息解锁"记为 ¥-98，与现行积分制矛盾 | data.js:863 |

---

## 九、修复优先级路线图

### 第一阶段：立即修复（P0，阻断经济模型）— 预计 1-2 天

| 优先级 | 问题 | 修复方向 |
|---|---|---|
| 1 | BM-017 微信/支付宝买积分零入账 | 非余额通道购积分必须走模拟支付回调→BalanceStore 扣减/或至少记录"模拟支付"流水；原型阶段可统一回落余额支付并明确标注 |
| 2 | BM-028 个人合伙人返佣断链 | 二选一：① isDistributor/safeDistTier 放行个人合伙人并挂 individualPartner 费率档(8%/2%)；② 若产品定位无返佣，下线个人合伙人分销入口与海报引导文案 |
| 3 | BM-004 充值后余额消失+清流水 | syncSnapshotIfCurrent 改为增量 merge（只同步 balance/frozen/totalIn，保留 logs）；充值后回写用户表 u.balance |

### 第二阶段：高优先修复（P1，收入流断链）— 预计 3-5 天

| 优先级 | 问题 | 修复方向 |
|---|---|---|
| 4 | BM-003/006 认证/入驻驳回不退费 | authReject/entryReject 增加余额回退逻辑（u.balance.balance+=fee + BalanceStore 同步） |
| 5 | BM-001/002 认证支付方式矛盾/对公空跑 | 微信/支付宝/对公三通道统一为模拟支付→余额扣减或独立 pending 记录；对公必须生成待审申请 |
| 6 | BM-007 履约保证金凭空置位 | 保证金需独立缴纳流程（支付→冻结→入驻激活），不可终审时凭空置位 |
| 7 | BM-009 冻结资金可花 | 所有消费统一用 available()=balance-frozen 判断，禁用 raw balance |
| 8 | BM-010/011 trade 保证金/单次解锁零流水 | 至少落一条可退台账/模拟支付记录，或在 UI 明确标注"原型模拟无真实资金" |
| 9 | BM-022/034 新订单佣金不写 CommissionStore | Mediation.settle 时同步调用 CommissionStore.addFlow，统一新旧订单佣金入口 |
| 10 | BM-023 AgencyOrderStore 无状态机校验 | transition() 增加合法迁移表校验，或废弃该 Store 统一用 Mediation |
| 11 | BM-030/029 分销费率双轨+门控矛盾 | 分销费率统一收敛到 MOCK.business.distribution（domain.js 读取该配置）；个人合伙人门控全页面对齐 |
| 12 | BM-031/035 提现限额绕过 | 分销提现与普通提现统一走 withdrawalApply，校验 singleMax+dailyMax |
| 13 | BM-033 封禁不联动 | toggleBan 增加 BalanceStore.frozen+=全部余额 + 前台发布/下单/提现/解锁拦截 |
| 14 | BM-012/018/019 货币不一致/裸写/绕过 Store | 锁区货币统一为"积分"；余额买积分走 BalanceStore 方法；credits-mall 改用 CreditStore.consume |

### 第三阶段：计划修复（P2，功能完善）— 预计 1 周

- BM-013 解锁文案合规统一为"沟通权"
- BM-014 UnlockStore 补 reset()/事件派发
- BM-016 file-download 增加解锁态校验
- BM-020/021 流水页接真数据（替换假数据）
- BM-024 里程碑佣金计提口径统一
- BM-025 CommissionStore 增加状态细分
- BM-026 中介下单增加实名前置
- BM-036 邀请码防重+真校验
- BM-037 发票金额与实付对账
- BM-038 totalIn 口径拆分（充值 vs 返佣）
- BM-039 防跳单聊天关键词检测
- BM-040 监控限额下沉 Store + 定时推送
- BM-041/042 死代码清理（talent-adapter 旧线索包、data.js legacy 结构）

### 第四阶段：上服务端后解决（架构性限制）

- L1-L6 全部纯前端架构限制（localStorage 篡改、DOM 明文、模拟支付、改价跨设备、并发非原子、单钱包）
- 手册 9.2 节 P1/P2/P3 待定项的产品化落地

---

## 十、验证方法与局限性说明

### 10.1 验证方法
- **纯代码静态审计**：Grep 全库搜索 + 逐函数精读 + 跨文件调用链追踪
- **未使用浏览器动态验证**：所有结论基于代码逻辑分析，未在浏览器中实际操作复现
- **金额/比例全部从代码取实际值**：无凭印象判断

### 10.2 验证局限性
1. 纯前端原型无服务端，所有"支付"均为模拟，资金守恒验证基于代码逻辑而非真实交易
2. 未进行浏览器端到端实操验证（6 条用户旅程未实际走通），部分交互级问题可能未覆盖
3. 手册 9.2 节待定项的"未实现"判定基于代码搜索，不排除以隐式方式部分实现的可能
4. admin 后台 27 页全部验证存在性与数据源，但未逐页验证所有操作按钮的端到端效果
5. 多用户并发场景未验证（单用户原型场景）

### 10.3 正面确认（实现质量较高的部分）

以下模块经审计确认实现质量较高，可作为原型演示的可靠路径：
- **R3 详情解锁核心引擎**：9 类差异化扣费、免费额度、会员折扣、就近打码、持久化、TTL 全部正确实现
- **R5 Mediation 托管引擎**：状态机合法迁移校验、里程碑分期、14 天自动确认、退款 clawback、防重复结算幂等
- **佣金阶梯计算**：commissionRate() 阶梯+破冰+保底逻辑正确，与前台同源
- **身份派生体系**：deriveIdentity() 五身份叠加逻辑正确，绝大多数页面统一调用
- **入驻类型差异**：entryAccess() 统一驱动三档差异开合
- **后台审核→前台同步**：DataBus.authApprove/entryApprove/toggleBan + syncSnapshotIfCurrent 真实生效
- **破冰期开关联动**：ModeStore + entryFeeOf/commissionRate/freeQuotaInfo 全链路联动正确
- **后台改价持久化**：ConfigAPI + engchain-config-override + 运行时 deepMerge（限本浏览器）

---

## 十一、经济模型健康度评分明细

| 维度 | 得分 | 说明 |
|---|---|---|
| 收入流闭环完整性 | 14/20 | 5 条收入流均部分闭环，无完全闭环；R3 最接近(85%)，R1/R4 最低(60%) |
| 资金守恒 | 8/20 | 人民币守恒等式不成立（流水被清空、消费不入账、双账本不同步）；积分守恒基本成立 |
| 防套利 | 10/20 | 2 个 P0 套利路径（零成本买积分、虚假返佣）+ 10 个可利用真 bug；架构性限制 6 项 |
| 前后台联动 | 12/20 | 审核/改价/破冰期联动正确；但新订单佣金后台断链、封禁不联动、R1/R2 后台无流水 |
| 权限与合规 | 14/20 | 权限矩阵基本完整无裸奔；解锁文案合规不统一、防跳单无自动检测、个人合伙人假放行 |
| 代码质量与一致性 | 10/20 | 多套并行实现未收敛（3 套订单、2 套佣金、2 套分销费率）、双账本、魔法数字、死代码 |
| **总分** | **68/100** | **中等偏下：核心引擎可用，账本层与收敛层需系统性修复** |

---

> 本报告基于 2026-09-11 代码快照生成。所有问题均可追溯到具体文件路径和行号。详细分领域审计报告见：
> - BM-B-资金钱包与付费墙审计报告.md（项目根目录）
> - docs/audit/Engchain3.0-分销与权限审计报告_专家6-7.md
> - artifacts/专家8-9-前端代码一致性与前后台联动审计报告.md
> - Engchain3.0-商业模式验证框架.md（验证基线与检查清单）
