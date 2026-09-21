# P0 阶段复查清单

## 检查项与结果

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | `npm install` 成功 | ✅ | added 113 packages in 5m |
| 2 | `npm run dev` 无 error | ✅ | VITE v5.4.21 ready in 3946ms，仅 Sass legacy 弃用警告（不影响） |
| 3 | HTTP 200 响应 | ✅ | `/admin-v2/` 与 `/src/main.ts` 均 200 |
| 4 | 根字号 13px | ✅ | `src/styles/global.scss` 中 `html { font-size: 13px }` |
| 5 | 明暗双主题切换 | ✅ | `stores/theme.ts` 写 `engchain-console-theme`，顶栏右上角可切 |
| 6 | 侧栏 236px 可折叠 | ✅ | `AdminShell.vue` `.sidenav` 236px，`.collapsed` 12px |
| 7 | ⌘K 命令菜单 | ✅ | `CommandPalette.vue`，顶栏搜索框可唤起 |
| 8 | Element Plus 已覆盖为目标视觉 | ✅ | `element-overrides.scss` 主按钮径向灰渐变、表格行高、色板 |
| 9 | 无第三方参考源留痕 | ✅ | `grep -i twenty` 全工程 0 命中 |
| 10 | localStorage 键前缀规范 | ✅ | `engchain-console-theme` / `engchain-console-user` |
| 11 | 独立 /login 页 | ✅ | `views/Login.vue`，路由守卫未登录自动跳转 |
| 12 | 双壳（管理 + C 端） | ✅ | `AdminShell.vue` + `UserShell.vue` |
| 13 | DataBus 桥接 spike | ⏳ | 待 P0 末尾验证，P1 正式接入 |

## 已知警告
- Sass `legacy-js-api` deprecation warning：Vite 5 默认用旧版 Sass API，不影响功能；后续升级 Vite 6 或切 sass-embedded 时处理。

## 待用户确认
请打开 http://127.0.0.1:5174/admin-v2/ ，走一遍：
1. 登录页任意账号密码登录；
2. 看管理后台侧栏/顶栏/主按钮视觉；
3. 点顶栏太阳/月亮图标切主题；
4. 点顶栏搜索框唤起 ⌘K 菜单；
5. 侧栏点折叠按钮收起；
6. 顶部路径切到 `/u/dashboard` 看 C 端工作台壳。

确认方向 OK 后进入 P1（迁移 27 个管理后台页面）。
