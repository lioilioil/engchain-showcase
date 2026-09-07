# 修复报告：发现·首页列表点击后"未找到该条目"

## 一、根因分析

### 1.1 问题现象
从 `pages/supply/list.html`（发现·首页）点击列表条目后，部分条目在 `pages/supply/detail.html` 显示"未找到该条目 / 该信息可能已下架，或链接地址有误 / 返回上一页重新浏览"。

### 1.2 数据流向图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        列表页 list.html                              │
│                      mergedList() 合并两个数据源                      │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────┐       │
│  │ MOCK.byFlow('match') │    │ SupplyStore.listActive()     │       │
│  │ (js/data.js catalog) │    │ (localStorage engchain-supply│       │
│  │  静态种子数据 24条    │    │  status=active 的用户发布    │       │
│  │  id: 1001-1013       │    │  /后台审核条目 14条          │       │
│  │  w1-w3, cp1-cp4,a1-a4│    │  id: SU001-SU022            │       │
│  └──────────┬───────────┘    └──────────────┬───────────────┘       │
│             │                               │                       │
│             └───────────┬───────────────────┘                       │
│                         │                                           │
│                    去重合并 38 条                                    │
│                    卡片链接: detail.html?id=<id>                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ 点击
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       详情页 detail.html                             │
│                    id 解析链路（修复前）                              │
│                                                                     │
│  ① MOCK.listingById(id)                                             │
│     └─ 只查 js/data.js 的 catalog 数组                              │
│     └─ SU001-SU022 不在 catalog → 失败 ✗                            │
│                                                                     │
│  ② PublishStore.getRecordById(id)  ← 注意：这是另一个独立 store      │
│     └─ 只查 localStorage engchain-publish（key 不同！）              │
│     └─ SU001-SU022 不在 engchain-publish → 失败 ✗                   │
│     └─ 若有 sourceId 则回退 MOCK.listingById(src)                   │
│                                                                     │
│  ③ 都查不到 → 渲染"未找到该条目"空状态 ❌                            │
│                                                                     │
│  ⚠ 缺失环节：SupplyStore（engchain-supply）查找路径完全不存在        │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 根因结论

**列表页和详情页的数据源不对称：**

| 维度 | 列表页 list.html | 详情页 detail.html（修复前） |
|------|-----------------|---------------------------|
| MOCK catalog | ✅ `MOCK.byFlow('match')` | ✅ `MOCK.listingById(id)` |
| SupplyStore | ✅ `SupplyStore.listActive()` | ❌ **完全缺失** |
| PublishStore | ❌ 不使用 | ✅ `PublishStore.getRecordById(id)` |

`SupplyStore`（localStorage key: `engchain-supply`）与 `PublishStore`（localStorage key: `engchain-publish`）是**两个完全独立的 store**。列表页通过 `SupplyStore.listActive()` 混入了 14 条用户发布/后台审核条目（id 形如 SU001-SU022），但详情页只查 `MOCK.catalog` 和 `engchain-publish`，这 14 条在两个数据源中都不存在，因此必然显示"未找到该条目"。

### 1.4 实证数据（修复前）

- 列表总卡片数：**38 条**
  - MOCK catalog 条目：24 条（1001-1013, w1-w3, cp1-cp4, a1-a4）
  - SupplyStore active 条目：14 条（SU001, SU002, SU004, SU006, SU007, SU009, SU011, SU012, SU013, SU015, SU016, SU019, SU021, SU022）
- SupplyStore 全量：24 条（active:14, pending_review:7, rejected:1, off:2）
- 详情打开失败：**14 条，全部为 SupplyStore active 条目**
- 修复前成功率：**63.2%**（24/38）

---

## 二、后台联动检查

### 2.1 后台审核页面
文件：`admin/operations/supply.html`

后台通过 `DataBus.supplyAudit(id, action, note)` 操作 SupplyStore 状态（`js/databus.js` 第685-702行）：

| 操作 | 状态变更 |
|------|---------|
| approve / on | status → `active` |
| reject | status → `rejected`，记录 note |
| off | status → `off`，记录 note |

### 2.2 列表过滤验证
列表页 `list.html` 第99-101行使用 `SupplyStore.listActive()`，该方法（`stores.js` 第391-393行）只返回 `status === 'active'` 的条目：

```javascript
SupplyStore.listActive = function () {
  return this.read().items.filter(function (i) { return i.status === 'active'; });
};
```

**结论：列表过滤正确。** 已下架（off）、已驳回（rejected）、待审核（pending_review）的条目不会出现在列表中。实测 SupplyStore 中有 2 条 off、1 条 rejected、7 条 pending_review，均未出现在列表的 38 张卡片中。无需额外修复。

### 2.3 localStorage 残留数据检查
SupplyStore 中无 stale 数据问题：
- 7 条 pending_review：正常待审核状态，不应出现在列表
- 1 条 rejected：已驳回，正确过滤
- 2 条 off：已下架，正确过滤
- 14 条 active：全部正确出现在列表中

---

## 三、代码修改

### 3.1 修改文件
**文件：** `D:/Engchain3.0/pages/supply/detail.html`
**修改位置：** 第64行之后、原第65行（PublishStore 回退）之前，插入新的 SupplyStore 查找块（第66-111行）

### 3.2 修改前（原第63-74行）

```javascript
var id = new URLSearchParams(location.search).get('id') || '1001';
var rec = MOCK.listingById(id);
if (!rec && window.PublishStore) {
  /* P2：id 不在目录但存在于发布信息存储 → 解析发布项；若其 sourceId 指向真实目录条目则优先展示目录丰富详情 */
  var stored = PublishStore.getRecordById(id);
  if (stored) {
    var src = stored.sourceId != null ? stored.sourceId : stored.id;
    var cat = MOCK.listingById(src);
    if (cat && String(src) !== String(stored.id)) rec = cat;
    else rec = Object.assign({}, stored, { bizKey: 'publish' });
  }
}
```

### 3.3 修改后（第63-122行）

```javascript
var id = new URLSearchParams(location.search).get('id') || '1001';
var rec = MOCK.listingById(id);

/* P1.5：id 不在 catalog 但存在于 SupplyStore（用户发布/后台审核已上架条目）
   -> 归一化记录结构后直接渲染；SupplyStore 与 PublishStore 是两个独立 store，
     列表页 mergedList() 会混入 SupplyStore.listActive()，详情页必须同步支持 */
if (!rec && window.SupplyStore) {
  var _BIZ_MAP = { '材料':'material','设备':'equipment','劳务':'labor','项目合作':'cooperation','合作':'cooperation','中介服务':'agency','中介':'agency','资质招商':'franchise','建企买卖':'trade','招聘':'personnel','求职':'talent' };
  var sup = SupplyStore.byId(id);
  if (sup) {
    var _isUser = (sup.source === 'user_publish' || sup.source === 'migrated_publish');
    rec = Object.assign({}, sup, {
      bizKey: sup.bizKey || _BIZ_MAP[sup.cat] || 'material',
      dir: sup.dir || sup.type || 'demand',
      title: sup.title || '',
      cat: sup.cat || sup.category || '',
      category: sup.category || sup.cat || '',
      sub: sup.sub || sup.subType || '',
      subType: sup.subType || sup.sub || '',
      city: sup.city || sup.location || '',
      location: sup.location || sup.city || '',
      price: sup.price || sup.budget || '',
      budget: sup.budget || sup.price || '',
      amount: sup.amount || (sup.price ? (sup.price + (sup.unit ? ' ' + sup.unit : '')) : ''),
      unit: sup.unit || '',
      qty: sup.qty || '',
      tags: sup.tags || [],
      company: sup.company || '',
      desc: sup.desc || sup.description || '',
      description: sup.description || sup.desc || '',
      verified: sup.verified !== undefined ? sup.verified : !_isUser,
      match: typeof sup.match === 'number' ? sup.match : (_isUser ? 55 : 70),
      hot: sup.hot || false,
      ts: sup.ts || Date.now(),
      views: typeof sup.views === 'number' ? sup.views : 0,
      /* contact 在 SupplyStore 中可能是对象 {name,phone}，详情模板期望 r.contact 为联系人姓名字符串 */
      contact: (sup.contact && typeof sup.contact === 'object') ? (sup.contact.name || '') : (sup.contact || ''),
      phone: (sup.contact && typeof sup.contact === 'object') ? (sup.contact.phone || '') : (sup.phone || ''),
      wechat: (sup.contact && typeof sup.contact === 'object') ? (sup.contact.wechat || '') : (sup.wechat || ''),
      address: sup.address || '',
      spec: sup.spec || '',
      delivery: sup.delivery || '',
      qualification: sup.qualification || '',
      requirement: sup.requirement || '',
      publisher: sup.publisher || '',
      source: sup.source || ''
    });
  }
}

if (!rec && window.PublishStore) {
  /* P2：id 不在目录但存在于发布信息存储 → 解析发布项；若其 sourceId 指向真实目录条目则优先展示目录丰富详情 */
  var stored = PublishStore.getRecordById(id);
  if (stored) {
    var src = stored.sourceId != null ? stored.sourceId : stored.id;
    var cat = MOCK.listingById(src);
    if (cat && String(src) !== String(stored.id)) rec = cat;
    else rec = Object.assign({}, stored, { bizKey: 'publish' });
  }
}
```

### 3.4 修复要点说明

1. **查找优先级**：MOCK catalog → SupplyStore（新增）→ PublishStore → 空状态。SupplyStore 优先于 PublishStore，因为列表页中 SupplyStore 条目优先级也高于 MOCK（去重时 SupplyStore 先入）。

2. **不破坏现有逻辑**：原有的 MOCK → PublishStore → sourceId 回退链路完全保留，仅在中间插入新的查找路径。

3. **系统性修复**：通过 `SupplyStore.byId(id)` 通用查找 + 结构归一化，支持所有 SupplyStore 条目（包括 `user_publish`、`migrated_publish` 等 source 类型），而非针对特定 id 打补丁。

4. **归一化字段**：参考 `list.html` 第77-98行 `normSupplyItem` 逻辑，确保 `bizKey/dir/title/cat/city/price/tags/verified` 等 DETAIL.attach() 所需字段齐全。额外处理了：
   - `contact` 对象 → 字符串提取（detail.js 第222行期望 `r.contact` 为联系人姓名字符串）
   - `views` 默认 0（detail.js 第56行 `r.views + ' 浏览'`）
   - `phone/wechat` 从 contact 对象提取

5. **未修改 data.js**：MOCK 种子数据完全未动。

---

## 四、验证数据

### 4.1 测试方法
- 启动本地服务器 `node D:/Engchain3.0/_tmp_server.js`（端口 8765）
- 使用 puppeteer-core 连接 Chrome，打开 list.html
- 提取所有卡片链接的 id 参数（共 38 个）
- 逐个访问 `detail.html?id=<id>`，检测页面是否出现"未找到该条目"
- 测试脚本：`D:/Engchain3.0/_verify_click_test.js`

### 4.2 修复前后对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 列表总条目 | 38 | 38 |
| 成功打开详情 | 24 | **38** |
| 失败（未找到该条目） | 14 | **0** |
| 成功率 | 63.2% | **100.0%** |
| SupplyStore 条目成功率 | 0/14 (0%) | **14/14 (100%)** |
| MOCK catalog 条目成功率 | 24/24 (100%) | 24/24 (100%) |

### 4.3 修复后各条目详情验证

| ID | 来源 | 详情页标题 | 状态 |
|----|------|-----------|------|
| SU001 | SupplyStore | 材料采购 | ✅ |
| SU002 | SupplyStore | 材料采购 | ✅ |
| SU004 | SupplyStore | 设备租赁 | ✅ |
| SU006 | SupplyStore | 劳务用工 | ✅ |
| SU007 | SupplyStore | 项目合作 | ✅ |
| SU009 | SupplyStore | 中介服务 | ✅ |
| SU011 | SupplyStore | 招商加盟 | ✅ |
| SU012 | SupplyStore | 招商加盟 | ✅ |
| SU013 | SupplyStore | 企业买卖·资产 | ✅ |
| SU015 | SupplyStore | 企业招聘·需求详情 | ✅ |
| SU016 | SupplyStore | 人才简历详情 | ✅ |
| SU019 | SupplyStore | 劳务用工 | ✅ |
| SU021 | SupplyStore | 中介服务 | ✅ |
| SU022 | SupplyStore | 招商加盟 | ✅ |
| 1001-1013 | MOCK | 各业务场景详情 | ✅ |
| w1-w3 | MOCK | 劳务用工 | ✅ |
| cp1-cp4 | MOCK | 项目合作 | ✅ |
| a1-a4 | MOCK | 中介服务 | ✅ |

**验收标准达成：列表中可点击条目 100% 能正常打开详情（≥95% 目标）。**

---

## 五、截图路径

所有截图保存在 `D:/Engchain3.0/_verify_shots/`：

| 截图文件 | 说明 |
|---------|------|
| `before_list.png` | 修复前：发现·首页列表页（38条卡片） |
| `before_detail_first_SU001.png` | 修复前：SU001 详情页 → "未找到该条目"空状态 |
| `after_list.png` | 修复后：发现·首页列表页（不变） |
| `after_detail_supply_SU001.png` | 修复后：SU001 详情页 → 正常渲染"成都天府新区商业综合体 急需商品混凝土 C30/C40" |

测试报告 JSON：
- `D:/Engchain3.0/_verify_shots/before_report.json`
- `D:/Engchain3.0/_verify_shots/after_report.json`

---

## 六、修改文件清单

| 文件 | 修改类型 | 行号 |
|------|---------|------|
| `D:/Engchain3.0/pages/supply/detail.html` | 插入 SupplyStore 查找块 | 第66-111行（新增） |
| `D:/Engchain3.0/_verify_click_test.js` | 测试脚本（新增，非业务代码） | 全文 |

**未修改的文件：**
- `js/data.js` — MOCK 种子数据未动 ✅
- `js/stores.js` — SupplyStore 实现未动 ✅
- `js/detail.js` — 详情渲染引擎未动 ✅
- `js/publish-workbench.js` — PublishStore 未动 ✅
- `pages/supply/list.html` — 列表页未动 ✅
- `admin/operations/supply.html` — 后台管理页未动 ✅
