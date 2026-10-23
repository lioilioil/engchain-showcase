# 过程资料归档说明（阶段B 重构）

## 保留在交付位（正式产物，不归档移动）
- 源码：`js/agent-ui.js`、`js/agent-apply.js`、`css/agent.css` 等
- 冒烟套件：`scripts/smoke-m1~m4.js`；可视化播种/探针脚本：`scripts/refactor/`
- 正式文档：省代体系各方案/评估/复核报告、《视觉对齐质检表-v1.md》
- 构建：`admin-vue/dist`（不纳入本次提交，见提交说明）
- 证据截图：`.shots/refactor/`、`.shots/iter2/`、`.shots/ux-audit/`（质检表 §11 引用）

## 本目录归档
- 早期迭代中间截图与一次性探针的副本按需移入；一次性调试脚本（`_chk.js` 等）已删除，不保留。

## 排除项（不入库）
- `serve_8767.log` / `serve_8767.err.log`（运行日志）
- `golden-hamster-avatars/`（91MB 本地头像缓存）
- `node_modules/`、`admin-vue/dist` 构建散列、`_shots/` 临时输出
- `pages/wallet` 并行改动原样保留，未删改。
