# 阶段B重构复核报告-v1（只读复核，未改任何代码/未提交）

- 复核时间：2026-10-23
- 服务：http://127.0.0.1:8767（破缓存 `?v=10`）
- 播种：DataBus.applyDemoScenario（province_agent_active=u11 四川总代 active 1/21；sub_agent_active=u12 成都二级 20% 已签；partner=u9；resident_construction=u1）
- 依据：《省级总代工作台·商业应用深度分析与迭代方案-v1.md》P0/P1、《省级总代工作台·UI重构方案-v1.md》C1~C11、阶段B任务清单（H-1 hash 视图 / H-5 协议抽屉 / 抽屉·弹窗 / H-2~H-6 / 红线）
- 截图目录：`.shots/refactor/verify/`
- 说明：本环境 bu 后台 tab 的 requestAnimationFrame 被节流，抽屉/弹窗 `is-open` 类不自动追加；验证时以补类名方式确认内容/布局与关闭通道，真实前台环境 rAF 正常，此为环境观察项，不计缺陷。

## 一、逐项核验结果

### 1. H-1 hash 视图路由 —— 通过

| 检查点 | 结果 | 证据 |
|---|---|---|
| T1 #/home 只留身份卡/公告/看板/快捷入口 | 通过 | h1-t1-home.png、h1-t1-quick.png |
| #/subs 仅二级列表+发起入口卡 | 通过 | h1-t1-subs.png |
| #/agreements 协议中心独立 | 通过 | h1-t1-agreements.png |
| #/ledger 双分区台账（二级线/自身线，月份切换保留） | 通过 | h1-t1-ledger.png |
| #/status 状态中心+行为记录只读 | 通过 | h1-t1-status.png |
| 非 home 视图有「‹ 返回工作台概览」 | 通过 | h1-t1-subs/agreements/ledger/status.png 顶部 |
| 浏览器前进/后退随 hash 栈切换（#/status → history.back() → #/ledger） | 通过 | h1-back-nav.png；URL hash 随之为 #/ledger |
| 视图隔离：非当前视图 section display:none（#/status 时看板/台账均隐藏） | 通过 | DOM 实测 ledgerDisplay/homeDisplay=none |
| 深链直达不落空（直接打开 #/status、#/ledger、#/agreements） | 通过 | 各视图截图；路由 agApplyRoute 合法值 home/subs/agreements/ledger/status（agent-ui.js:909-930） |
| T2 #/home / #/ledger 同理，钱包降为底部弱出口 | 通过 | h1-t2-home.png、h1-t2-ledger.png、h1-t2-bottom.png |
| 切视图 scrollTop 归零、hashchange 历史栈 | 通过 | subApplyRoute 1189-1207；实走切换无整页刷新 |

### 2. H-5 协议抽屉 —— 通过

| 检查点 | 结果 | 证据 |
|---|---|---|
| O4 八条在抽屉 body 内滚动，签署/查看聚焦抽屉，身份卡只留摘要 | 通过 | h5-proto-drawer.png（T1 admin，8 条条款内滚，无 foot）；h5-t2-proto-drawer.png（T2 已签，8 条，无 foot） |
| × / 遮罩点击 / Esc 三通道关闭 | 通过 | 实测三通道均移除 is-open，body 滚动锁恢复（agent-ui.js:91-96） |
| 锁背景滚动 body overflow=hidden | 通过 | 实测；关闭后复原 |
| T2 pending_mine 时 foot 放「去签署/拒签」，已签无 foot | 通过（待签走源码留证） | 1107-1131：pending_mine 才渲染 foot；本次受引擎持久化限制未能在内存构造待签态，源码链完整：签署写回 signature（onSigned）、拒签必填原因 + openConfirm |
| 抽屉固定操作区、busy 防连点、内联红框（发起二级抽屉） | 通过 | h-subform-invalid.png：空提交公司名内联红字「请填写二级公司名称」+ warn toast「请检查标红项」；保存按钮 busy disabled（852-905） |

### 3. 抽屉 / 弹窗承载 —— 通过（2 项低残留见 §三）

| 检查点 | 结果 | 证据 |
|---|---|---|
| 发起二级收抽屉（底部固定操作区、busy、内联红框） | 通过 | h-subform-invalid.png |
| 比例补改收抽屉（只读徽章「约定20.00%」+编辑框） | 通过 | h-ratio-drawer.png；637-650 |
| 邀请成员收抽屉（内联 uid 错误「请填写对方 uid」） | 通过 | h-invite-drawer.png；1316 段 |
| 移除成员走居中确认弹窗，遮罩不可点关，写清后果 | 通过 | h-remove-modal.png：文案「将把「u11a」移出本公司团队，不删除其历史订单与台账；此操作需要管理员确认」；遮罩 click 不关闭（openConfirm 无 mask.onclick，114-120） |
| 拒签确认弹窗「确认拒签协议」后果说明、遮罩不可点关 | 通过（源码） | 1170-1185：说明「拒签后本协议将回到未签约状态，需由总代重新发起；已填原因：…」 |
| 证书进抽屉（替代内嵌折叠卡） | 通过 | h1-cert-drawer.png；748-751 |

### 4. H-2 / H-3 / H-4 / H-6 —— 通过

| 检查点 | 结果 | 证据 |
|---|---|---|
| H-2 可点元素 ≥44px 热区（sm 按钮/ms 按钮/链接/关闭钮/返回链） | 通过 | agent.css:361-368；.ag-btn 基线 min-height:44（:84） |
| H-3 Tab 焦点环明/暗可见（仅 :focus-visible，鼠标不出环） | 通过 | agent.css:344-359：明金 --ag-province-gold，暗 #C9A45C，输入框同环 |
| H-4 toast 成功/失败/警告三态 | 通过 | agent.css:371-374（warn ! / err × / ok 圆点）；warn 实走见 h-subform-invalid.png；ok/err 类齐备 |
| H-6 entry-review 有省代记录时省代卡首屏，旧企业空态不置顶 | 通过 | h6-entry-review-active.png：首屏「我的省级总代申请·四川××省级代理有限公司·已生效·进入工作台」 |

### 5. 暗色模式 / 页面错误

| 检查点 | 结果 | 证据 |
|---|---|---|
| 暗色抽看 T1/T2 | 通过 | h1-t1-home.png、h1-t2-home.png（暗底藏青身份卡/金棕文字正常） |
| 0 JS pageerror | 通过 | 刷新 T1/T2 后 console 无 uncaught/error 级 JS 异常，仅 3 条 404 静态资源（favicon 类，非脚本） |

## 二、红线零回退核对

| 红线 | 结果 | 证据 |
|---|---|---|
| u9 个人合伙人 8% / 2% / ¥50 / T+1 | 通过 | red-u9.png；页面文案「一级 8% / 二级 2%」、个人合伙人徽标 |
| u1 base 12% / 3% / ¥100 | 通过 | red-u1.png；页面文案 12% / 3% |
| limited 6%、franchise ¥29,800 | 通过 | `git diff 44ec059 HEAD -- js/data.js pages/franchise/ js/agent-rules.js js/agent-tax.js` 为空；franchise 页 29,800 原样 |
| wallet/提现规则口径 | 通过 | HEAD~1 wallet/withdraw 仅加按钮 busy 状态机与庆祝动画，「2 小时内到账/单号/提交」逻辑未动；distribution/withdraw 仅增纯代理引导文案「代理测算收益在代理台账查看·不可提现」，提现规则零改动；recharge 仅按钮状态机，入账口径未动（均为并行非本轮改动，与代理无关） |
| data.js / agent-rules.js / agent-tax.js 零 diff | 通过 | git 基线 44ec059 → HEAD 无改动 |

## 三、残留清单（低，均不阻断本期）

| 编号 | 位置 | 分级 | 问题 | 建议（供实施方，本轮未改） |
|---|---|---|---|---|
| R-1 | js/agent-ui.js:1014-1017（T2 protoCard） | 低 | protoCard 未标 `data-view`，在 #/ledger 视图仍透出「协议详情 / 点查看协议」提示卡（h1-t2-ledger.png 可见） | 给该 section 加 `data-view="home"`，或并入 home 身份卡摘要行 |
| R-2 | js/agent-ui.js:1274-1281（团队邀请框） | 低 | 页面内联邀请字段（uid 输入/角色下拉/发送按钮）常驻，#ag-invite-btn 实际打开抽屉，内联输入为冗余残留（team-admin.png 页面字段与抽屉并存） | 删除内联字段块，仅保留抽屉入口按钮 |
| R-3 | js/agent-ui.js:66-70、85-86（openDrawer/closeDrawer） | 低 | closeDrawer 仅移除 is-open 类，旧 mask/drawer 节点不摘除，重复开关累积隐藏 DOM 与重复 Esc 监听；无可见影响 | closeDrawer 时把旧节点 remove() 并移除对应 Esc 监听 |

### 观察项（非本轮已做项，不判残留、不计入偏差）
- 协议中心列表/详情仍显示内部版本串 `t-subagent@1.0.0`、「存证模拟（非真实 CA）」「演示静态展示」字样（766-771、782），属既定 demo 口径，留待后续文案轮处理。
- pending_mine 待签态因引擎把合同持久化到存储、内存改写不生效，未能在浏览器实走签署/拒签；源码链（1107-1185）完整，建议实施方在可持久化构造的测试环境补一次实走。

## 四、结论

- 通过：18 项；残留：3 项（均为低，不阻断）；阻断/高：0。
- 红线：零回退。
- 已知未达项（单笔台账抽屉/横滑渐隐/profile 徽标组件化/tax-guide 收编/seg 并轨/通知去重）按任务约定不重复挑，本轮未发现其引发回归。

## 附：截图清单（.shots/refactor/verify/）

| 文件 | 对应核验点 |
|---|---|
| h1-t1-home.png / h1-t1-quick.png | T1 home 概览、看板、快捷入口 |
| h1-t1-subs.png | #/subs 二级列表视图 |
| h1-t1-agreements.png | #/agreements 协议中心 |
| h1-t1-ledger.png | #/ledger 双分区台账 |
| h1-t1-status.png | #/status 状态中心 |
| h1-back-nav.png | history.back() 退回 #/ledger |
| h5-proto-drawer.png | T1 协议抽屉 8 条款内滚 |
| h5-t2-proto-drawer.png | T2 已签协议抽屉无 foot |
| h-subform-invalid.png | 发起二级抽屉内联红框+warn toast |
| h-ratio-drawer.png | 比例补改抽屉 |
| h1-cert-drawer.png | 授权证书抽屉 |
| h1-t2-home.png / h1-t2-ledger.png / h1-t2-bottom.png | T2 home/台账/钱包弱出口 |
| h-remove-modal.png | 移除成员确认弹窗（遮罩不可点关） |
| h-invite-drawer.png | 邀请抽屉内联错误 |
| team-admin.png | 团队 admin 视图（法人只读 chip/移除按钮） |
| h6-entry-review-active.png | entry-review 省代 active 卡首屏 |
| red-u9.png / red-u1.png | 红线 u9/u1 口径 |
