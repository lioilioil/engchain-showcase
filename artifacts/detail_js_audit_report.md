# detail.js 权限/解锁/操作逻辑深度审计报告

**审计对象**：`D:/Engchain3.0/js/detail.js`（2772行，203KB）
**审计日期**：2026-09-07
**审计范围**：5种用户身份状态 × 3种入驻类型 × 9类详情页下的联系方式解锁、底部操作栏、发布权限、价格/佣金展示、认证标签、空状态/锁定态/引导态
**基准文件**：`js/stores.js`（身份系统）、`js/data.js`（收益模式常量第938-1064行）、`js/databus.js`（投递门控）

---

## 一、审计结论摘要

| 维度 | 结论 |
|------|------|
| 权限判断点总数 | 15个（含子函数） |
| 不一致项总数 | **7项**（高1 / 中3 / 低3） |
| 最严重问题 | **个人合伙人(primary='partner')被身份门控错误拦截**，无法使用免费解锁额度，被引导去"实名认证"（实际已实名） |
| 实证验证 | 15张截图（5状态×3详情页），核心问题已100%复现 |
| 代码与实际渲染一致性 | 除个人合伙人异常外，其余状态渲染与代码逻辑一致 |

---

## 二、权限判断点清单（文件:行号 + 当前逻辑）

### 2.1 身份门控 `identityGate()` — detail.js 第1994-2001行

```javascript
function identityGate() {
  var st = window.deriveStatus ? deriveStatus() : 'registered';
  var authed = (st === 'realname' || st === 'pro' || st === 'enterprise' || st === 'resident');
  if (authed) return { pass: true };
  var demo = {}; try { demo = JSON.parse(localStorage.getItem('engchain-state') || '{}'); } catch (e) {}
  var isGuest = demo.status === 'guest';
  return { pass: false, isGuest: isGuest, label: isGuest ? '登录 / 注册后解锁完整信息' : '实名认证后免费解锁' };
}
```

- **调用 `deriveStatus()`**（stores.js第498行），返回 `deriveIdentity().primary` 单值
- **authed 白名单**：`realname / pro / enterprise / resident`
- **isGuest 判断**：直接读 `localStorage.engchain-state.status === 'guest'`，**未使用** `deriveIdentity().isGuest`
- **被调用位置**：attach() 第2147行（gate变量）、第2150行（isMatureGuest）、第2190行（guestFreeAvail）、第2195行（CTA文案）、tryUnlock() 第2531行（gateAct）

### 2.2 免费额度 `freeQuotaInfo()` — detail.js 第1963-1969行

```javascript
function freeQuotaInfo() {
  var st = window.deriveStatus ? deriveStatus() : 'registered';
  var allow = (st === 'realname' || st === 'pro' || st === 'enterprise' || st === 'resident');
  var monthly = (MOCK.business.credits && MOCK.business.credits.freeQuota) ? MOCK.business.credits.freeQuota.monthly : 5;
  if (window.ModeStore && ModeStore.isBreakIn()) monthly += ((MOCK.business.breakin || {}).registerBonus) || 0;
  var used = window.CreditStore ? CreditStore.freeUsed() : 0;
  return { allow: allow, remain: allow ? Math.max(monthly - used, 0) : 0, used: used, monthly: monthly };
}
```

- **allow 白名单**：与 identityGate 完全相同（`realname / pro / enterprise / resident`）
- **月度额度**：5条（`freeQuota.monthly=5`），破冰期额外+3条（`registerBonus=3`）
- **被调用位置**：payGoLabel() 第2025行、openPay() 第2274行、payGo() 第2514行

### 2.3 解锁定价 `unlockPriceOf()` — detail.js 第1946-1961行

| bizKey | 价格 | 模式 | 数据来源 |
|--------|------|------|----------|
| talent | 29积分 | credit | `credits.consume.talent` |
| trade | ¥5,000 | deposit | `credits.tradeDeposit` |
| agency | 0 | free | 硬编码 |
| personnel | 0 | free | 硬编码 |
| franchise | 49/39/29积分（分级） | credit | `credits.consume.franchise.t1/t2/t3` |
| material/equipment/labor/cooperation | 98积分 | credit | `credits.consume[key]` |
| publish | 98积分（回退） | credit | `cons.material` 回退 |

- **franchise分级逻辑** `franchiseTier()` 第1940-1945行：施工总承包/电力/特级→t1(49)；专业承包/加盟/供应链/联盟/其他→t3(29)；其余→t2(39)
- **与收益模式一致性**：✅ 完全一致

### 2.4 解锁持久化 `UnlockStore` — detail.js 第60-84行

```javascript
isFree: function (bizKey) { return bizKey === 'personnel' || bizKey === 'publish'; },
isUnlocked: function (rec) {
  if (!rec) return false;
  if (this.isFree(rec.bizKey)) return true;
  // ... TTL检查
},
_ttlDays: function (bizKey) {
  if (bizKey === 'talent') return 7;
  if (bizKey === 'trade') return 30;
  return -1; // 永久
}
```

- **isFree 白名单**：`personnel / publish`（**不包含 agency**）
- **有效期**：talent=7天，trade=30天，其余永久
- **被调用位置**：attach() 第2105行（unlocked变量）、各sections渲染函数中（locked参数）

### 2.5 门控需求 `needGate` — detail.js 第2148行

```javascript
var needGate = !unlocked && rec.bizKey !== 'personnel' && rec.bizKey !== 'agency';
```

- **排除类别**：personnel（投递替代付费墙）、agency（免费留资咨询）
- **其余7类**：material/equipment/labor/cooperation/franchise/trade/talent 均需身份门控

### 2.6 成熟期游客全打码 `isMatureGuest` — detail.js 第2150行

```javascript
var isMatureGuest = !unlocked && gate.isGuest && !(window.ModeStore && ModeStore.isBreakIn());
```

- **触发条件**：未解锁 + 游客 + 非破冰期
- **行为**：① Hero区价格/位置打码为"登录后查看"；② Body区整体blur(7px)+登录引导遮罩；③ Lock区隐藏（`display:none`）
- **与收益模式一致性**：✅ 一致（成熟期游客不可用任何解锁入口）

### 2.7 CTA文案逻辑 — detail.js 第2191-2197行

```javascript
var ctaText = unlocked
  ? (t.ctaText ? t.ctaText(rec, true) : (t.cta || '联系TA'))
  : (guestFreeAvail
      ? '免费查看（游客福利 ' + (gs.used + 1) + '/' + gs.total + '）'
      : ((needGate && !gate.pass)
          ? gate.label
          : (t.inlineLock ? (t.ctaLocked || payGoLabel(up)) : t.cta)));
```

- **优先级**：已解锁 > 破冰期游客免费样例 > 身份门控引导 > inlineLock解锁按钮 > 默认CTA

### 2.8 解锁执行 `tryUnlock()` — detail.js 第2521-2533行

```javascript
function tryUnlock() {
  if (unlocked) { UI.toast(...); return; }
  if (t.consultMode) { openConsult(rec, c); return; }
  if (gate.isGuest && guestSampleInfo().available) { guestSampleSpend(...); unlock(...); return; }
  if (!gateAct(gate)) return;  // 游客/未实名：引导登录或实名，不进入支付
  openPay();
}
```

- **执行顺序**：已解锁→提示 / consultMode→留资表单 / 破冰期游客→免费解锁 / 未通过门控→引导弹窗 / 通过→支付弹窗

### 2.9 支付执行 `payGo()` — detail.js 第2511-2520行

```javascript
function payGo(rec, up) {
  if (up.mode === 'free') { unlock('已开放联系方式'); return; }
  if (up.mode === 'deposit') { UI.toast('模拟支付保证金...'); UnlockStore.mark(rec); unlock(...); return; }
  var fqG = freeQuotaInfo();
  if (fqG.allow && fqG.remain > 0) { CreditStore.freeSpend(1); unlock(); return; }  // 免费额度优先
  var costG = Math.round(up.price * creditDiscountRate());
  if (CreditStore.read().balance >= costG) { CreditStore.consume(costG, ...); unlock(); return; }  // 扣积分
  UI.toast('积分不足，请先充值'); setTimeout(() => location.href = '../../pages/wallet/credits.html', 700);
}
```

- **扣费优先级**：免费额度 > 积分（含会员折扣）> 充值引导
- **与收益模式一致性**：✅ 一致

### 2.10 CTA点击绑定 — detail.js 第2571-2575行

```javascript
if ($('cta')) $('cta').addEventListener('click', function () {
  if (rec.bizKey === 'personnel') { bindDeliverModalEvents(); checkDeliverPermission(rec, c); }
  else if (t.consultMode) { if (!unlocked) openConsult(rec, c); else UI.toast(...); }
  else if (!unlocked) { tryUnlock(); }
});
```

- **personnel** → 投递门控检查
- **consultMode（仅agency）** → 留资表单
- **其余** → tryUnlock

### 2.11 投递门控 `canDeliverResume()` — databus.js 第1320-1333行

```javascript
function canDeliverResume() {
  var pe = AuthStore.read().personalEntry;
  if (!pe || !pe.ok) return { can: false, reason: '请先完成个人入驻' };
  var ut = pe.userType || 'jobseeker';
  if (ut === 'standard') return { can: false, reason: '标准入驻用户暂不支持简历投递' };
  if (ut === 'jobseeker' && !pe.resumeComplete) return { can: false, reason: '请先完成简历详情编辑' };
  return { can: true };
}
```

- **要求**：个人入驻(personalEntry.ok) + userType='jobseeker' + 简历完成
- **与收益模式一致性**：✅ 一致

### 2.12 积分折扣 `creditDiscount()` — stores.js 第503-514行

```javascript
function creditDiscount() {
  var idy = deriveIdentity();
  if (idy.enterprise !== 'resident') return 1;  // 仅企业入驻有折扣
  var types = idy.entryTypes;
  // 按entryTypes取最高折扣：construction 0.8 / agency 0.7 / partner 0.5
}
```

- **折扣范围**：仅企业入驻用户（`enterprise==='resident'`），按入驻类型取最高
- **个人合伙人**：无折扣（`enterprise!=='resident'` → return 1）

### 2.13 留资表单 `openConsult()` — detail.js 第2424-2509行

- **agency分支**（第2427-2464行）：中介服务需求登记，提交后调用 `unlock()`
- **franchise分支**（第2466-2509行）：加盟意向登记，提交后调用 `unlock()`
- **⚠️ 关键问题**：franchise分支为**死代码**（见不一致项#4）

### 2.14 认证标签渲染

- **Hero区**：`verifiedHint` 来自 `rec.verified`（信息发布者的数据字段），非当前用户身份
- **企业认证卡片**：`UI.certCard(c)` 来自 `MOCK.companyById(rec.companyId)`
- **与当前用户身份的联动**：❌ 无联动（设计合理——认证标签标识信息发布者可信度，非浏览者身份）

### 2.15 价格/佣金展示

- **Hero价格**：`heroPrice(r)` 第45行，简单返回 `r.price || r.budget`
- **佣金费率**：detail.js **未调用** `commissionRate()`（stores.js第517行），详情页不展示平台佣金阶梯
- **trade保证金**：Hero区展示 `¥5,000 保证金可退`，解锁弹窗展示保证金说明

---

## 三、不一致项清单（按严重程度排序）

### 🔴 高严重度（1项）

#### 不一致项 #1：个人合伙人(primary='partner')被身份门控错误拦截

| 项目 | 内容 |
|------|------|
| **位置** | detail.js 第1996行（identityGate）、第1965行（freeQuotaInfo） |
| **当前代码** | `var authed = (st === 'realname' \|\| st === 'pro' \|\| st === 'enterprise' \|\| st === 'resident');` |
| **当前行为** | 个人合伙人的 `deriveIdentity().primary === 'partner'`，不在authed白名单中 → `identityGate().pass === false` → `isGuest === false` → CTA显示"实名认证后免费解锁" → 点击后弹出去实名认证对话框 |
| **期望行为** | 个人合伙人已完成实名认证（`identities` 包含 `realname`），应通过身份门控，享有免费解锁额度和积分解锁权 |
| **根因** | detail.js 使用旧接口 `deriveStatus()`（返回primary单值），白名单基于v2.0六级状态编写，未纳入v3.0新增的 `partner`（个人合伙人）主身份 |
| **影响的用户状态组合** | 个人合伙人（已实名+partner身份，非企业入驻）× 所有7类需门控详情页（material/equipment/labor/cooperation/franchise/trade/talent） |
| **影响范围** | ① 无法使用每月5条免费解锁额度；② 无法通过积分解锁（被gateAct拦截）；③ 被错误引导去实名认证（实际已实名）；④ 个人合伙人作为平台高级用户，体验反而低于普通实名用户 |
| **实证截图** | `04_个人合伙人_材料_1001.png` — CTA清晰显示"实名认证后免费解锁" |
| **修复建议** | 将白名单改为 `(st === 'realname' \|\| st === 'pro' \|\| st === 'enterprise' \|\| st === 'resident' \|\| st === 'partner')`，或更彻底地改用 `deriveIdentity()` 结构化判断：`var idy = deriveIdentity(); var authed = idy.identities.indexOf('realname') >= 0 \|\| idy.identities.indexOf('enterprise') >= 0;` |

---

### 🟡 中严重度（3项）

#### 不一致项 #2：isGuest 判断方式与 deriveIdentity() 不一致

| 项目 | 内容 |
|------|------|
| **位置** | detail.js 第1998-1999行 |
| **当前代码** | `var demo = JSON.parse(localStorage.getItem('engchain-state') \|\| '{}'); var isGuest = demo.status === 'guest';` |
| **基准实现** | stores.js 第455-458行 `deriveIdentity()`：`if (st && st.loggedIn === false) return { isGuest: true, primary: 'guest', ... }` |
| **当前行为** | identityGate 通过 `engchain-state.status === 'guest'` 判断游客；deriveIdentity 通过 `UI.state.get().loggedIn === false` 判断 |
| **风险** | 两套判断逻辑可能产生不一致结果：① 用户登出时若只设置 `loggedIn=false` 而未设置 `status='guest'`，identityGate 会误判为注册未实名；② 若 `status='guest'` 但 `loggedIn` 未设为false，deriveIdentity 会误判为已登录 |
| **影响** | 游客免费样例（guestSample）、成熟期全打码（isMatureGuest）、登录引导文案均依赖 isGuest 判断，不一致会导致这些逻辑在边界状态下行为异常 |
| **修复建议** | identityGate 应改用 `deriveIdentity().isGuest`，与全局身份系统保持单一数据源 |

#### 不一致项 #3：个人合伙人无积分折扣

| 项目 | 内容 |
|------|------|
| **位置** | stores.js 第503-514行 `creditDiscount()` |
| **当前代码** | `if (idy.enterprise !== 'resident') return 1;` — 仅企业入驻用户有折扣 |
| **收益模式基准** | `membership.types`：construction 0.8x / agency 0.7x / partner 0.5x（此处partner指**企业入驻类型**为partner的企业，非个人合伙人身份） |
| **当前行为** | 个人合伙人（非企业入驻）解锁信息时按原价扣积分，无任何折扣 |
| **需确认** | 产品设计上，个人合伙人是否应享有积分折扣？根据 `entryAccess()` 设计，个人合伙人享有二级分销（distTier='full'），但积分折扣仅给企业入驻用户。若此为设计意图，则应在产品文档中明确标注；若个人合伙人应享有折扣，则需扩展 creditDiscount() |
| **影响** | 个人合伙人解锁98积分的材料详情时，扣98积分而非折扣后积分 |
| **修复建议** | 产品确认后决定：① 若个人合伙人应有折扣，扩展 `creditDiscount()` 增加个人合伙人折扣档位（如0.8x）；② 若为设计意图，在代码注释中明确说明 |

#### 不一致项 #4：franchise 加盟意向登记为死代码

| 项目 | 内容 |
|------|------|
| **位置** | detail.js 第2466-2509行（openConsult 中非agency分支） |
| **当前代码** | `openConsult()` 函数包含完整的 franchise 加盟意向登记表单（意向区域/拟经营类型/预计投入/姓名/电话），提交后调用 `unlock()` |
| **触发条件** | `openConsult()` 仅在 `t.consultMode === true` 时被调用（第2523行、第2573行） |
| **实际配置** | `byType.franchise`（第1522-1553行）**未设置** `consultMode: true` |
| **当前行为** | franchise详情页CTA点击走 `tryUnlock()` → `gateAct()` → `openPay()`（积分解锁弹窗），**永远不会**触发 `openConsult()` 中的franchise分支 |
| **风险** | ① 44行死代码增加维护成本；② 后续开发者可能误以为franchise支持免费留资咨询而做出错误判断；③ 若产品意图是franchise应走免费留资，则当前实现错误地走了付费积分 |
| **需确认** | franchise（资质招商）的商业模式应为：① 分级积分解锁（49/39/29积分），还是 ② 免费留资咨询（提交意向后开放联系方式）？当前代码两套逻辑并存，但实际生效的是① |
| **修复建议** | 产品确认后二选一：① 若为积分解锁，删除 openConsult() 中franchise分支的死代码；② 若为免费留资，给 `byType.franchise` 添加 `consultMode: true`，并调整 unlockPriceOf 中 franchise 的 mode 为 'free' |

---

### 🟢 低严重度（3项）

#### 不一致项 #5：UnlockStore.isFree 定义不包含 agency

| 项目 | 内容 |
|------|------|
| **位置** | detail.js 第72行 |
| **当前代码** | `isFree: function (bizKey) { return bizKey === 'personnel' \|\| bizKey === 'publish'; }` |
| **关联逻辑** | `unlockPriceOf()` 第1951行：`if (key === 'agency' \|\| key === 'personnel') return { price: 0, mode: 'free' }` |
| **当前行为** | agency的 `UnlockStore.isUnlocked(rec)` 初始返回false（因为isFree不包含agency），但agency通过consultMode流程（openConsult提交后调用unlock()）正常解锁 |
| **影响** | 实际影响有限，因为agency的解锁不依赖isFree。但定义不一致可能导致：① 后续新增逻辑若依赖isFree判断agency会出错；② 代码可读性差 |
| **修复建议** | 将 `isFree` 改为 `return bizKey === 'personnel' \|\| bizKey === 'agency' \|\| bizKey === 'publish';`，与 unlockPriceOf 的 free 模式保持一致 |

#### 不一致项 #6：详情页缺少平台佣金费率展示

| 项目 | 内容 |
|------|------|
| **位置** | detail.js 全局（未调用 commissionRate） |
| **当前行为** | 详情页仅展示信息价格/预算，不展示平台佣金费率（8%/6%/5%/4%/3%阶梯）和最低佣金¥10,000 |
| **收益模式基准** | `commission.tier`：0-5万8% / 5-20万6% / 20-50万5% / 50-100万4% / 100万+3%，最低¥10,000 |
| **影响** | 用户在cooperation（项目合作）等成交类详情页无法获知平台收费标准，可能在对接后才发现佣金费用，影响转化信任 |
| **修复建议** | 在成交类详情页（cooperation/trade等）的保障区或费用结构区增加平台佣金费率说明 |

#### 不一致项 #7：personnel 详情页无身份门控，游客可直接进入投递流程

| 项目 | 内容 |
|------|------|
| **位置** | detail.js 第2148行（needGate排除personnel）、第2572行（CTA点击直接checkDeliverPermission） |
| **当前行为** | 游客/注册未实名用户访问personnel详情页，CTA显示"立即投递"，点击后触发 `canDeliverResume()` 检查，因无个人入驻被拦截并弹窗引导 |
| **与其他类别对比** | material等类别在未实名时CTA直接显示"实名认证后免费解锁"，点击后引导实名认证；personnel则显示"立即投递"，点击后才拦截 |
| **影响** | 用户体验不一致：personnel详情页给游客/未实名用户"可以投递"的错觉，点击后才被拦截。建议在CTA文案层面提前引导（如未实名时显示"实名认证后投递"） |
| **修复建议** | personnel详情页的CTA文案应根据身份状态动态调整：未实名/未入驻时显示"完成个人入驻后投递"，而非统一显示"立即投递" |

---

## 四、用户状态 × 详情页类型 权限矩阵

### 4.1 矩阵说明

- **用户状态**（5种）：游客 / 注册未实名 / 已实名个人 / 个人合伙人 / 企业入驻（建筑）
- **详情页类型**（9类）：material / equipment / labor / cooperation / franchise / trade / agency / personnel / talent
- **记录内容**：未解锁时CTA文案 + 点击行为 + 联系方式状态

### 4.2 完整权限矩阵

| 详情页类型 | 解锁模式 | 游客 | 注册未实名 | 已实名个人 | 个人合伙人 | 企业入驻(建筑) |
|-----------|---------|------|-----------|-----------|-----------|--------------|
| **material** 材料 | 98积分 inlineLock | CTA:"免费查看(游客福利1/1)"<br>点击→免费解锁(破冰期)<br>联系方式:就近打码 | CTA:"实名认证后免费解锁"<br>点击→实名引导弹窗<br>联系方式:就近打码 | CTA:"免费解锁(本月剩8条)"<br>点击→免费额度/扣积分<br>联系方式:就近打码 | **⚠️ CTA:"实名认证后免费解锁"**<br>**点击→实名引导(错误拦截)**<br>联系方式:就近打码 | CTA:"免费解锁(本月剩8条)"<br>点击→免费额度/扣积分(0.8x)<br>联系方式:就近打码 |
| **equipment** 设备 | 98积分 inlineLock | 同material | 同material | 同material | **⚠️ 同material(错误拦截)** | 同material |
| **labor** 劳务 | 98积分 inlineLock | 同material | 同material | 同material | **⚠️ 同material(错误拦截)** | 同material |
| **cooperation** 项目合作 | 98积分 inlineLock | 同material | 同material | 同material | **⚠️ 同material(错误拦截)** | 同material |
| **franchise** 资质招商 | 分级积分49/39/29 inlineLock | 同material(价格不同) | 同material(价格不同) | 同material(价格不同) | **⚠️ 同material(错误拦截)** | 同material(价格不同,0.8x) |
| **trade** 建企买卖 | ¥5000保证金 inlineLock | CTA:"缴纳保证金查看详情"<br>点击→gateAct拦截(游客)<br>联系方式:就近打码 | CTA:"缴纳保证金查看详情"<br>点击→gateAct拦截(未实名)<br>联系方式:就近打码 | CTA:"缴纳保证金查看详情"<br>点击→保证金支付→解锁<br>联系方式:就近打码 | **⚠️ CTA:"实名认证后免费解锁"**<br>**点击→实名引导(错误拦截)**<br>联系方式:就近打码 | CTA:"缴纳保证金查看详情"<br>点击→保证金支付→解锁<br>联系方式:就近打码 |
| **agency** 中介服务 | 免费留资 consultMode | CTA:"立即咨询"<br>点击→留资表单→解锁<br>联系方式:就近打码 | CTA:"立即咨询"<br>点击→留资表单→解锁<br>联系方式:就近打码 | CTA:"立即咨询"<br>点击→留资表单→解锁<br>联系方式:就近打码 | CTA:"立即咨询"<br>点击→留资表单→解锁<br>联系方式:就近打码 | CTA:"立即咨询"<br>点击→留资表单→解锁<br>联系方式:就近打码 |
| **personnel** 企业招聘 | 免费投递(需个人入驻) | CTA:"立即投递"<br>点击→投递门控拦截→引导入驻<br>#lock:投递引导区 | CTA:"立即投递"<br>点击→投递门控拦截→引导入驻<br>#lock:投递引导区 | CTA:"立即投递"<br>点击→投递门控拦截(无入驻)→引导<br>#lock:投递引导区 | CTA:"立即投递"<br>点击→投递门控拦截(无入驻)→引导<br>#lock:投递引导区 | CTA:"立即投递"<br>点击→投递门控拦截(无入驻)→引导<br>#lock:投递引导区 |
| **talent** 人才求职 | 29积分 inlineLock | 同material(价格29) | 同material(价格29) | 同material(价格29) | **⚠️ 同material(错误拦截)** | 同material(价格29,0.8x) |

### 4.3 矩阵关键发现

1. **agency（中介服务）是唯一对所有用户状态完全一致的类别**：免费留资咨询，无身份门控
2. **personnel（企业招聘）对所有用户状态CTA均为"立即投递"**，但实际只有个人入驻+简历完成的用户能成功投递
3. **个人合伙人在7类需门控详情页中全部被错误拦截**（标⚠️的行），这是本次审计最严重的问题
4. **trade（建企买卖）的CTA文案不受身份门控影响**（始终显示"缴纳保证金查看详情"），但点击时gateAct会拦截游客和未实名用户
5. **企业入驻用户享有0.8x积分折扣**（construction类型），agency类型入驻享有0.7x，partner类型入驻享有0.5x

---

## 五、实证验证结果

### 5.1 验证环境

- **服务器**：`D:/Engchain3.0/_tmp_server.js`，端口8765
- **浏览器**：Chrome（puppeteer-core驱动），视口420×900
- **模拟方式**：通过 localStorage 设置 `engchain-state` / `engchain-auth` / `engchain-entry` / `engchain-credits`
- **截图目录**：`D:/Engchain3.0/_verify_shots/audit2a/`

### 5.2 验证用例与结果（15组）

| # | 用户状态 | 详情页 | CTA实际文案 | deriveIdentity.primary | 预期 | 结果 |
|---|---------|--------|-----------|------------------------|------|------|
| 1 | 游客 | 材料(1001) | 免费查看（游客福利1/1） | guest | 破冰期游客1条免费 | ✅ 一致 |
| 2 | 游客 | 中介(a1) | 立即咨询 | guest | 免费留资 | ✅ 一致 |
| 3 | 游客 | 招聘(p1) | 立即投递 | guest | 投递引导 | ✅ 一致 |
| 4 | 注册未实名 | 材料(1001) | 实名认证后免费解锁 | registered | 实名引导 | ✅ 一致 |
| 5 | 注册未实名 | 中介(a1) | 立即咨询 | registered | 免费留资 | ✅ 一致 |
| 6 | 注册未实名 | 招聘(p1) | 立即投递 | registered | 投递引导 | ✅ 一致 |
| 7 | 已实名个人 | 材料(1001) | 免费解锁（本月剩8条） | realname | 5+3破冰期=8条 | ✅ 一致 |
| 8 | 已实名个人 | 中介(a1) | 立即咨询 | realname | 免费留资 | ✅ 一致 |
| 9 | 已实名个人 | 招聘(p1) | 立即投递 | realname | 投递引导 | ✅ 一致 |
| 10 | **个人合伙人** | **材料(1001)** | **实名认证后免费解锁** | **partner** | **应通过门控，享免费额度** | **❌ 不一致（高）** |
| 11 | 个人合伙人 | 中介(a1) | 立即咨询 | partner | 免费留资 | ✅ 一致 |
| 12 | 个人合伙人 | 招聘(p1) | 立即投递 | partner | 投递引导 | ✅ 一致 |
| 13 | 企业入驻(建筑) | 材料(1001) | 免费解锁（本月剩8条） | resident | 5+3=8条，0.8x折扣 | ✅ 一致 |
| 14 | 企业入驻(建筑) | 中介(a1) | 立即咨询 | resident | 免费留资 | ✅ 一致 |
| 15 | 企业入驻(建筑) | 招聘(p1) | 立即投递 | resident | 投递引导 | ✅ 一致 |

### 5.3 关键截图对比

**个人合伙人（错误行为）vs 已实名个人（正确行为）**：

| 个人合伙人_材料 | 已实名个人_材料 |
|----------------|----------------|
| CTA: "实名认证后免费解锁" | CTA: "免费解锁（本月剩8条）" |
| 截图: `04_个人合伙人_材料_1001.png` | 截图: `03_已实名个人_材料_1001.png` |

个人合伙人的 `identities` 实际包含 `['realname', 'partner']`，已完成实名认证，但因 `primary='partner'` 不在白名单中被错误拦截。

### 5.4 代码逻辑与实际渲染一致性结论

- **14/15组**用例的实际渲染与代码逻辑完全一致
- **1/15组**（个人合伙人×材料）的渲染与代码逻辑一致，但代码逻辑本身与收益模式/身份系统设计不一致
- 即：**detail.js 的渲染层忠实执行了其权限判断逻辑，问题出在权限判断逻辑本身的白名单缺失**

---

## 六、入驻类型 × 发布权限矩阵

> 注：detail.js 本身不处理发布权限（发布入口在 publish-workbench.js 和发布页），以下基于 stores.js `entryAccess()` 和 data.js 常量推导。

| 入驻类型 | 入驻费 | 积分折扣 | 可发布类别 | 分销权限 | 中介服务权限 |
|---------|--------|---------|-----------|---------|------------|
| 未入驻 | — | 无 | 仅实名后限量发布 | 无 | 无 |
| 建筑企业(construction) | ¥3,999 | 0.8x | material/equipment/labor/cooperation | 基础一级分销(distTier=base) | 无 |
| 中介服务(agency) | ¥29,999 | 0.7x | 全部+agency专属 | 受限一级分销6%(distTier=limited) | 有(agency=true) |
| 合伙人企业(partner) | ¥0(需审核) | 0.5x | 全部 | 完整二级分销(distTier=full)+团队管理 | 无(除非多类型并行含agency) |
| 个人合伙人(非企业入驻) | — | 无(见不一致项#3) | 同实名个人 | 完整二级分销(distTier=full)，无团队管理 | 无 |

---

## 七、修复优先级建议

| 优先级 | 不一致项 | 修复工作量 | 影响面 |
|--------|---------|-----------|--------|
| **P0 立即修复** | #1 个人合伙人被身份门控错误拦截 | 极小（2行白名单添加） | 所有个人合伙人用户 × 7类详情页 |
| **P1 本周修复** | #2 isGuest判断方式不一致 | 小（改用deriveIdentity().isGuest） | 游客相关逻辑边界状态 |
| **P1 本周修复** | #4 franchise死代码确认与清理 | 小（产品确认后删除或启用） | 代码可维护性 |
| **P2 迭代修复** | #5 UnlockStore.isFree包含agency | 极小（1行） | 代码一致性 |
| **P2 迭代修复** | #7 personnel CTA文案动态调整 | 小（CTA文案增加身份判断） | 用户体验一致性 |
| **P3 产品确认** | #3 个人合伙人积分折扣 | 需产品决策 | 个人合伙人权益 |
| **P3 产品确认** | #6 详情页佣金费率展示 | 需产品决策 | 信息透明度 |

### P0 修复代码示例

```javascript
// detail.js 第1965行（freeQuotaInfo）和第1996行（identityGate）
// 修改前：
var allow = (st === 'realname' || st === 'pro' || st === 'enterprise' || st === 'resident');
// 修改后：
var allow = (st === 'realname' || st === 'pro' || st === 'enterprise' || st === 'resident' || st === 'partner');
```

或更彻底的结构化判断（推荐）：

```javascript
// 推荐：改用 deriveIdentity() 结构化身份，与全局系统保持单一数据源
function identityGate() {
  var idy = window.deriveIdentity ? deriveIdentity() : { isGuest: true, identities: [] };
  var authed = idy.identities.indexOf('realname') >= 0 || idy.identities.indexOf('enterprise') >= 0;
  if (authed) return { pass: true };
  return { pass: false, isGuest: idy.isGuest, label: idy.isGuest ? '登录 / 注册后解锁完整信息' : '实名认证后免费解锁' };
}
```

---

## 八、审计产出物清单

| 产出物 | 路径 |
|--------|------|
| 审计报告（本文件） | `D:/Engchain3.0/artifacts/detail_js_audit_report.md` |
| 实证截图（15张） | `D:/Engchain3.0/_verify_shots/audit2a/*.png` |
| 实证脚本 | `D:/Engchain3.0/_verify_shots/audit2a/audit2a_verify.js` |

---

**审计完成时间**：2026-09-07
**审计方法**：逐行代码阅读 + grep关键词定位 + 权限矩阵构建 + puppeteer实证截图验证
**结论可信度**：高（所有结论均有代码行号支撑，核心问题有实证截图复现）
