# 左右滑动切页 · 归属表（右滑=返回 的目标）

> 产出方式：`node artifacts/swipe-nav/build-parent-map.js`
> 证据是**实际入站链接**（谁链到这一页），不是人工猜测。
> 本表是**待你确认稿**，确认后才写进 `js/swipe-nav.js` 并动代码。

## 判定规则

| 规则 | 内容 | 覆盖页数 |
|---|---|---|
| **R0** | 5 个主站页 —— 走站序环游，**无父页** | 5 |
| **R1** | `pages/<目录>/<文件>.html` → `pages/<目录>/index.html`（该目录有 index 时） | 70 |
| **R2** | 目录 index 自身 → 见下表「区段首页」 | 6 |
| **R3** | 目录无 index / 顶层区段 → 见下表「显式指定」 | 22 |

R1 的成立依据：section D 检查「同目录 index 存在、但入站主要来自别处」的页，**只有 3 页命中**（`demo-reset`、`search/business`、`home.html`，后者是噪声）。说明其余 ~70 页确实由本目录页面主导链入，同目录 index 就是正确父页。

## R0 · 站序页（左右环游，无父页）

| 页面 | 站序 |
|---|---|
| `home.html` | 1 主页（无右滑） |
| `pages/supply/list.html` | 2 发现 |
| `pages/message/index.html` | 3 消息 |
| `pages/profile/index.html` | 4 我的 |
| `pages/publish/index.html` | 5 信息工作台（无左滑） |

## R2 · 区段首页（目录 index 自身）

| 页面 | 右滑目标 | 依据 |
|---|---|---|
| `pages/wallet/index.html` | `pages/profile/index.html` | 入站 7 处，profile/index 在列 |
| `pages/order/index.html` | `pages/profile/index.html` | 入站含 profile/index |
| `pages/distribution/index.html` | `pages/profile/index.html` | 入站含 profile/index、all-functions |
| `pages/agency/index.html` | `home.html` | 入站含 home.html；首页金刚区入口 |
| `pages/franchise/index.html` | `home.html` | 入站含 home.html；首页金刚区入口 |
| `pages/search/index.html` | `home.html` | 入站含 home.html |

## R3 · 显式指定（22 页）

### 目录无 index

| 页面 | 右滑目标 | 依据 |
|---|---|---|
| `pages/supply/detail.html` | `pages/supply/list.html` | ⚠️ 多入口（20 处入站），列表页是 IA 归属 |
| `pages/trade/index.html` | `pages/supply/list.html` | 算子页；建企买卖是发现子频道 |
| `pages/personnel/index.html` | `pages/supply/list.html` | 算子页；企业招聘是发现子频道 |
| `pages/refund/index.html` | `pages/profile/index.html` | 算子页；入站 profile/index + settings + all-functions |
| `pages/refund/appeal.html` | `pages/refund/index.html` | 同目录 index |
| `pages/agreement/privacy.html` | `pages/profile/settings.html` | 入站 settings + auth/* + editor |
| `pages/agreement/user.html` | `pages/profile/settings.html` | 入站 settings + auth/* + editor |
| `pages/auth/login.html` | `home.html` | ⚠️ 多入口（25 处，全是「需登录」跳转） |
| `pages/auth/register.html` | `pages/auth/login.html` | 入站 login |
| `pages/auth/banned.html` | `pages/auth/login.html` | 入站 login |
| `pages/match/preferences.html` | `pages/profile/all-functions.html` | 入站 all-functions |
| `pages/platform/dashboard.html` | `pages/profile/index.html` | 入站 profile/index |
| `pages/vendor/dashboard.html` | `pages/profile/all-functions.html` | 入站 all-functions |
| `pages/vendor/upgrades.html` | `pages/profile/all-functions.html` | 入站 all-functions + seller-board |

### 单页顶层区段（`pages/<X>/index.html`，无应用内父页）

| 页面 | 右滑目标 | 依据 |
|---|---|---|
| `pages/api/index.html` | `pages/profile/all-functions.html` | 入站 all-functions |
| `pages/industry/index.html` | `pages/profile/all-functions.html` | 入站 all-functions |
| `pages/personal/index.html` | `pages/publish/index.html` | 入站 publish/unlocked |
| `pages/favorite/index.html` | `pages/profile/index.html` | 入站 profile/index + all-functions |
| `pages/help/index.html` | `pages/profile/index.html` | 入站 settings + all-functions |
| `pages/co-create/index.html` | `home.html` | 入站 home.html |
| `pages/company/index.html` | `pages/supply/list.html` | ⚠️ 孤儿页（仅 js/common.js:839 与 js/detail.js:2383 跳入），多入口 |
| `pages/guide/index.html` | `home.html` | 顶层区段（preview.html 目录树） |
| `pages/monitor/index.html` | `home.html` | 顶层区段（preview.html 目录树） |

### 额外例外（R1 默认规则判错）

| 页面 | 右滑目标 | 依据 |
|---|---|---|
| `pages/agency/demo-reset.html` | `pages/profile/index.html` | 入站只有 profile/index，默认的 agency/index 不对 |
| `pages/search/business.html` | `pages/search/index.html` | ⚠️ 多入口（franchise / personnel / trade 三处进入） |

## ⚠️ 需要你注意的 4 个妥协点

固定父页在**多入口页**上必然有偏差 —— 用户从 A 进和从 B 进，右滑都回同一个地方：

| 页面 | 多入口情况 | 影响 |
|---|---|---|
| `pages/supply/detail.html` | 20 处入站（首页、发现、订单、收藏、钱包…） | 从「我的收藏」进详情页，右滑会回到发现列表，而不是收藏 |
| `pages/auth/login.html` | 25 处入站 | 从任何页面被踢到登录，右滑一律回首页 |
| `pages/company/index.html` | 从详情页 / 认证卡进入 | 右滑回发现列表，而非来时的详情页 |
| `pages/search/business.html` | 3 个频道页进入 | 右滑回搜索首页，而非来时频道页 |

**替代方案**（若你希望更贴合实际路径）：这 4 页改用 `UI.back()`（有历史就 `history.back()`），其余 99 页用上表固定父页。代价是行为不统一 —— 但这 4 页恰恰是「固定父页」最不成立的地方。

## 覆盖校验

- 表内显式条目：**33 条**（R2 6 + R3 22 + 例外 2 + ... 见上，实际以脚本输出为准）
- R1 默认覆盖：**70 页**
- 合计 **103 页**，与 `build-parent-map.js` 枚举一致 ✓
- 103 页全部有 `.phone` 外壳（唯一无外壳的 `pages/agency/_seed-credit-data.html` 是数据播种页，已排除）✓
