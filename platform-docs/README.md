# platform-docs

Engchain3.0 平台说明文档。目录内为自包含静态 HTML，浏览器直接打开即可阅读，无需构建。

## 文档清单

| 文件 | 内容 | 版本 |
|---|---|---|
| `engchain-user-system.html` | 用户体系与权限说明：身份、角色、特征、属性、数据结构、逻辑、权限、应用功能；内嵌 4 张交互图解 | v1.3 / 2026-11-07 |
| `engchain-money-model.html` | 金额与收费规则：线上/线下两层业务与资金边界、认证与入驻的两期定价、平台内收费科目、线下场景（委托·服务广场·招商·转让）、资金流转与渠道分账、运营与定价、46 项参数总表；内嵌 2 张图解（图 2-1 两期定价与阶段切换、图 2-2 认证与入驻的资金路径） | v2.5 / 2026-11-07 |
| `identity-architecture.html` | 图解：用户身份架构 | — |
| `identity-lifecycle.html` | 图解：身份生命周期状态机 | — |
| `auth-entry-sequence.html` | 图解：认证与入驻时序 | — |
| `data-layer-architecture.html` | 图解：数据层架构 | — |
| `cert-phase-pricing.html` | 图解：两期定价与阶段切换（第二章 图 2-1） | — |
| `cert-money-path.html` | 图解：认证与入驻的资金路径（第二章 图 2-2） | — |
| `fig-*.png` | 6 张图解的打印版位图（2400px 宽），供文档打印使用，屏幕上不显示 | — |

前 4 个图解文件由 `engchain-user-system.html` 以 iframe 引用，后 2 个由 `engchain-money-model.html` 引用；6 张 `fig-*-print.png` 与对应图解同名配对（如 `fig-cert-phase-pricing-print.png` ↔ `cert-phase-pricing.html`）。均须同目录存放：缺图解 HTML，屏幕上的图解区为空；缺 PNG，打印时的图页为空。

## 口径

- 文档只描述平台规则与逻辑，不描述前端原型的呈现特征。
- 平台业务分两层：线上信息撮合（不介入交易资金、不抽佣、不托管），线下委托与服务广场、招商加盟、建企转让（合同款在平台外结算，平台只收信息与顾问费用）。阅读金额文档时，凡"不碰交易资金"均指线上这一层。
- 金额、档位、比例均为系统当前配置参数，不是最终执行金额；最终定价与运营数据以公司正式确认为准。
- 定价分**破冰期**与**成熟期**两个阶段（开关 `engchain-mode`，默认破冰期）：破冰期建筑入驻 ¥0、服务商入驻 ¥1,499、企业认证与年度年审 ¥0；成熟期建筑入驻 ¥3,999、服务商入驻 ¥2,999、企业认证 ¥999 首次核验、年度年审 ¥599/年。文档中任何"免费"都指当期减免，不是定价为 0；认证与入驻的标准价始终并列展示，期后按标准价续费。首年认证费已含当年年审，次年起年审单独收取、单独列账、单独退。认证费按阶段取价由 `ModeStore.certFee()` 单一出口给出（`breakin.certification` = 0 / `certification.enterprise` = 999），年审费由 `ModeStore.reviewFee()` 给出（`certification.annualReview` = 599），页面不直接读配置值。省代工作台的渠道对账页脚本链不加载 `stores.js`，由 `uni-shared.js` 按同一 `engchain-mode` 键与 `breakin.endAt` 自读阶段，口径同源。

## 版式、屏幕与打印

两份主文档共用同一套版式与交互层（暖白纸面、墨黑正文、衬线标题、直角细框），没有渐变胶囊与彩色标签。

- **A4 打印**：正文 `@page` 设为 A4、页边距 17/15/16mm；标题与表头不落在页尾，表格允许跨页但单行不劈开，`§12` 参数总表用固定列宽避免配置项被逐字符折断。打印时侧栏、工具栏、进度条、横滑提示全部隐藏。
- **图解打印**：6 张 archify 图解全部进打印版，每张独占一页横向 A4（命名页 `@page figpage{size:A4 landscape}` 配 `.fig{page:figpage;break-before:page;break-after:page}`）。图页只保留画布、图例与图注，阅读器的顶栏、搜索框、标题区与节点索引侧栏不出现；图注沿用正文原有的图号与说明。打印版用同目录 `fig-*-print.png`，屏幕仍显示 iframe 交互版（`.fig-print` 只在打印态显示）。位图由 `?embed=1&theme=light` 离屏 2 倍渲染、按内容裁边导出，2400px 宽，铺满页宽约合 220dpi。页数不设上限：金额文档 23 页（2 张图页）、用户文档 22 页（4 张图页）。
- **屏幕**：≥1280px 为侧栏目录 + 正文双栏；1024–1279px 侧栏收窄；≤1023px 侧栏收为抽屉（含章节筛选与关闭按钮）；≤767px 单栏，宽表横向滚动并显示滑动提示。
- **交互**：顶部阅读进度条、目录滚动高亮、章节锚点复制、正文字号 A−/A＋（记忆在同浏览器 `localStorage`）、PDF/打印按钮、回到顶部。

## 更新方式

工作副本位于 `D:\Engchain3.0-archive\engchain-user-system-doc-20261105\`，改稿在此完成后同步到本目录并提交：

```powershell
Copy-Item -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105\engchain-user-system.html" -Destination "D:\Engchain3.0\platform-docs\" -Force
Copy-Item -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105\engchain-money-model.html" -Destination "D:\Engchain3.0\platform-docs\" -Force
Copy-Item -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105\cert-phase-pricing.html" -Destination "D:\Engchain3.0\platform-docs\" -Force
Copy-Item -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105\cert-money-path.html" -Destination "D:\Engchain3.0\platform-docs\" -Force
Get-ChildItem -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105" -Filter "fig-*-print.png" | Copy-Item -Destination "D:\Engchain3.0\platform-docs\" -Force
git -C D:\Engchain3.0 add platform-docs
git -C D:\Engchain3.0 commit -m "docs: 更新平台说明文档" -- platform-docs
git -C D:\Engchain3.0 push
```

只提交 `platform-docs` 路径，避免把工作区里其它未完成的改动一并提交。
