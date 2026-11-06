# platform-docs

Engchain3.0 平台说明文档。目录内为自包含静态 HTML，浏览器直接打开即可阅读，无需构建。

## 文档清单

| 文件 | 内容 | 版本 |
|---|---|---|
| `engchain-user-system.html` | 用户体系与权限说明：身份、角色、特征、属性、数据结构、逻辑、权限、应用功能；内嵌 4 张交互图解 | v1.1 / 2026-11-06 |
| `engchain-money-model.html` | 金额与收费规则：收入结构、收费科目、资金流转、渠道分账、运营动作、定价与 50 项参数总表 | v2.0 / 2026-11-06 |
| `identity-architecture.html` | 图解：用户身份架构 | — |
| `identity-lifecycle.html` | 图解：身份生命周期状态机 | — |
| `auth-entry-sequence.html` | 图解：认证与入驻时序 | — |
| `data-layer-architecture.html` | 图解：数据层架构 | — |

后 4 个图解文件由 `engchain-user-system.html` 以 iframe 引用，必须同目录存放，否则文档内图示区域为空。

## 口径

- 文档只描述平台规则与逻辑，不描述前端原型的呈现特征。
- 金额、档位、比例均为系统当前配置参数，不是最终执行金额；最终定价与运营数据以公司正式确认为准。

## 更新方式

工作副本位于 `D:\Engchain3.0-archive\engchain-user-system-doc-20261105\`，改稿在此完成后同步到本目录并提交：

```powershell
Copy-Item -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105\engchain-user-system.html" -Destination "D:\Engchain3.0\platform-docs\" -Force
Copy-Item -LiteralPath "D:\Engchain3.0-archive\engchain-user-system-doc-20261105\engchain-money-model.html" -Destination "D:\Engchain3.0\platform-docs\" -Force
git -C D:\Engchain3.0 add platform-docs
git -C D:\Engchain3.0 commit -m "docs: 更新平台说明文档" -- platform-docs
git -C D:\Engchain3.0 push
```

只提交 `platform-docs` 路径，避免把工作区里其它未完成的改动一并提交。
