# 阶段A UX 评估 · 分工 E2：入口闭环与流程路径（只读评估）

- 评估日期：2026-10-23 · 服务 127.0.0.1:8767 · 视口 390×844 · 0 页面 JS 错误
- 角色播种：u11 四川总代 active / u12 成都二级 approved 20% 已签 / u9 个人合伙人 / u1 建筑入驻 / u2 中介 / guest；另复现 rev_province_pending、rej_province。
- 红线复核（无回退）：u9 个人合伙人旧返佣中心/收益明细/可提现金额正常；u1 base 分销中心正常；钱包/提现税列未改；费率/税算/门控规则/数据结构零改动。
- 截图目录：`.shots/ux-audit/e2-*.png`。

## 一、分级 Findings

### H-1（高）审核进度页双队列堆叠，旧空态置顶误导
- **现象**：`entry-review.html` 先渲染旧 EntryStore 企业入驻队列（`#root`，:25），其下才是省代申请面板（`#agent-panel`，:27）。当本人只有省代记录、无旧企业入驻时，页面顶部先出现旧队列空态「暂无入驻申请 / 去选择企业类型」，真正的省代状态与 CTA 被压在下方折叠区。active/pending/rejected 三态均复现。
- **证据**：`pages/profile/entry-review.html:25,27,57-59,244-245`；截图 `e2-u11-review.png`（已生效在下方）、`e2-pending-review.png`（待审核在下方）、`e2-rejected-review.png`（驳回+补表单在下方）。
- **改造目标**：按身份单队列呈现——有省代记录时旧企业队列空态不置顶（折叠或隐藏），省代申请卡作为首屏主体；仅当存在旧入驻记录时才展示旧队列。
- **验收点**：active 首屏直接见「已生效·进入工作台」；pending 首屏见「待审核」；rejected 首屏见驳回理由+补资料表单；无任何记录时才显示统一空态。

### M-1（中）驳回卡 CTA 跳空白表单，绕过已预填的补资料小表单
- **现象**：`entry.html` rejected 卡「补资料重提」直接跳 `entry-form.html?type=provinceAgent`（:130），而该页 `mountProvinceForm` 是空白表单；带驳回理由、执照/公司预填的补资料小表单在 `entry-review.html` 的 agent-panel（`agent-apply.js:301-311`）。用户从驳回卡进入会丢失驳回理由上下文，需重填全部字段。
- **证据**：`pages/profile/entry.html:128-130`；`js/agent-apply.js:301-311`；截图 `e2-rejected-entry.png`、`e2-rejected-review.png`。
- **改造目标**：rejected 卡 CTA 落 `entry-review.html`（定位到本人驳回记录卡），由 review 页预填小表单完成重提；空白总代表单只留给"无记录首次申请"。
- **验收点**：驳回态点「补资料重提」→ 直达带驳回理由与已填执照/公司名的卡片，不出现空白长表单。

### M-2（中）entry 页顶部认证门控条不识别代理身份
- **现象**：active 省代（u11）进入 `entry.html`，顶部 gate-bar 仍显示「入驻需先完成企业工商认证或个人专业资质，当前身份：已实名 · 去认证」（:109-111），与同页下方「省级总代·已开通·进入工作台」矛盾，给已开通用户制造"未达标"错觉。
- **证据**：`pages/profile/entry.html:108-112`；截图 `e2-u11-entry.png`（顶部去认证条 vs 底部已开通）。
- **改造目标**：gate-bar 判定纳入 `entryAccess().agent.active`；已是 active/suspended 代理时不展示认证拦截条。
- **验收点**：u11/u12 进入 entry 页不出现"去认证"拦截条；未认证普通用户仍正常看到引导。

### M-3（中）单页堆叠：内联视图切换无历史栈，浏览器后退不回列表、编辑后整页重挂丢滚动
- **现象**：T1 把看板/两分区台账/发起二级表单/协议中心/证书/状态时间线/行为记录全部堆在 `#ag-root` 一页；二级档案详情（P2-6）、协议详情、比例补改均用 `innerHTML` 就地替换，不产生路由/历史条目：
  - 档案详情 `renderSubProfile` 替换列表，仅靠页内「‹ 返回列表」（`agent-ui.js:600,619`），浏览器后退不回列表；
  - 协议「查看」把八条长文填进内联 `#ag-proto-detail`（`agent-ui.js:720-725`），无独立阅读位；
  - 发起二级是嵌在看板长页底部的长表单（`agent-ui.js:461`）；
  - 比例补改就地取输入后 `mountWorkbench(el)` 整页重挂（`agent-ui.js:575`），滚动位置与展开态丢失。
- **证据**：`js/agent-ui.js:461,575,588-619,720-725`；截图 `e2-u11-t1.png`、`e2-u12-t2.png`。
- **改造目标**：见第二节承载形态建议；至少为档案详情/协议详情补历史栈或抽屉关闭态，比例补改后局部刷新而非整页 remount。
- **验收点**：进入档案/协议后浏览器后退可回列表；比例补改后页面停留原滚动位置；发起二级不与看板同屏滚动竞争。

### L-1（低）分销中心代理门控缺次链，replace 后只能前进
- **现象**：`distribution/index.html` 代理门控（:145-150）只给主按钮「前往代理工作台」，无 alt 次链；而 `earnings.html`（:81）、`poster.html`（:155）都有「返回分销中心 / 返回」次链。replace 清空 .phone 后，用户若想留在原页无入口。
- **证据**：`pages/distribution/index.html:141-151`；截图 `e2-u11-dist-gate.png`（仅一个按钮）对照 `e2-u11-earnings-gate.png`（含返回分销中心）。
- **改造目标**：补 `altText:'留在分销中心 ›'` 或「返回」次链，与 earnings/poster 对齐。
- **验收点**：代理门控屏同时提供"去工作台"与"返回"两个去向。

### L-2（低）门控屏 footer「信息加密传输·安全登录」文案错位
- **现象**：GuestGate 底部信任行固定渲染「信息加密传输 · 安全登录」（`guest-gate.js:63`），代理通道/代理身份门控非登录场景也显示，语义错位。
- **证据**：`js/guest-gate.js:63`；截图 `e2-u11-dist-gate.png`、`e2-u11-poster-gate.png`、`e2-u11-earnings-gate.png`。
- **改造目标**：footer 信任行按场景可关闭/替换（代理门控改为中性说明）。
- **验收点**：非登录门控不出现"安全登录"字样。

### L-3（低）profile 宫格「代理工作台」图标无区分且与顶部徽标双入口重复
- **现象**：active 代理在 profile 同时有顶部徽标链接（:724）与宫格「代理工作台」（:1045-1048）两个入口；宫格项用通用 `i-grid` 图标，与末尾「全部」（:1077）同图标，无可识别性。
- **证据**：`pages/profile/index.html:713-725,1041-1050,1077`；截图 `e2-u11-profile.png`、`e2-u12-profile.png`。
- **改造目标**：宫格项换代理专属图标（盾/六边形剪影）；评估徽标与宫格是否保留其一为主入口。
- **验收点**：宫格代理项图标与其他项可区分；入口不重复跳转同一目标造成困惑。

### L-4（低）驳回补资料小表单「意向授权省」未回填
- **现象**：review 页驳回补表单预填了执照号、公司名（`agent-apply.js:303,306`），但意向省 select 未回填已有 `province`（:307-308），用户需重选省份。
- **证据**：`js/agent-apply.js:301-310`；截图 `e2-rejected-review.png`（意向省显示"请选择省份"）。
- **改造目标**：select 回填 `rec.province`，允许改选。
- **验收点**：驳回卡打开时意向省已选中原省。

### L-5（低）T1/T2 顶栏返回仅 history.back()，无兜底首页/我的
- **现象**：两页 nav-back 均为 `onclick="history.back()"`（index.html:21、sub.html:21），深链直达/消息预览新开窗时无历史可退，按钮无效；页内无"回我的/首页"兜底链接。
- **证据**：`pages/province-agent/index.html:21`、`pages/province-agent/sub.html:21`。
- **改造目标**：history 为空时回退到 profile 或首页；nav-right 补一个主页/我的直达。
- **验收点**：无历史直达 T1/T2 时返回按钮落到"我的"而非失效。

### L-6（低·备注）消息代理通知点开走预览 sheet 而非直进
- **现象**：`openNotice('agent')` 先 agentMarkRead 再 `openNoticePreview(href)` 以 iframe 预览 sheet 打开 T1/T2（`message/index.html:412-424`），已读记忆与角标正常；适合轻预览，但"进入工作台"主操作在 sheet 内，用户需再点展开。
- **证据**：`pages/message/index.html:236-282,412-424`；截图 `e2-u11-message-agent-filter.png`、`e2-u11-message-agent-open.png`。
- **改造目标/验收**：可保留预览；建议主按钮在 sheet 内提供"全屏进入"。

## 二、入口→承载形态→返回落点建议（针对"功能堆积单页"）

| 动作 | 当前承载 | 建议形态 | 返回闭环 |
|---|---|---|---|
| 发起二级（长表单+校验） | 嵌在 T1 看板长页底部内联 | **底部抽屉/弹窗**（不跳走，写完关闭回到看板原位置） | 抽屉关闭即回看板，无需历史 |
| 比例补改（0–50% 小输入+留痕） | 卡片内输入+整页 remount | **小弹窗/popover**，局部保存局部刷新 | 关闭停留原卡，不丢滚动 |
| 拒签原因（必填一句话） | T2 内联 textarea 面板（L-4 已修） | 维持内联或底部小窗均可 | 收起回协议区 |
| 单条台账查看（冲减/冻结/税列明细） | 静态表，无行详情 | **行展开/底部抽屉**展示单笔构成 | 展开收起，不跳页 |
| 协议八条长文查看 | 内联填进协议中心面板 | **独立只读页或全屏 sheet**（长文需连续阅读+打印） | 关闭/后退回协议列表 |
| 二级档案详情（资料+ratioLog+协议+聚合台账） | innerHTML 替换二级列表 | **独立路由页**（信息量大、可直达/可分享），或带历史栈的抽屉 | 浏览器后退回列表 |
| 状态中心时间线（statusLog/ratioLog） | 同页内联 section | 可维持 section；若信息增长则独立页 | 锚点定位即可 |
| 团队管理/邀请/角色调整 | 已独立 `team.html` ✓ | 维持独立页 | 页内返回 T1 |

当前主要路径问题：T1 单页同时承载"看板+台账+发起表单+协议+证书+状态+行为"，内联切换无历史栈，导致浏览器后退失效、整页 remount 丢位置（M-3）。

## 三、已闭环/保持项（无需改）
- 门控分流落点正确：u11→T1 index.html、u12→T2 sub.html（`distribution/index.html:143-144`、`poster.html:149-150`、`earnings.html:74`、`withdraw.html:311`）；实测点击门控按钮落 T1（`e2-u11-dist-landing.png`）。
- 叠加个人合伙人并集保留：u9 正常进旧返佣中心/收益明细，可提现金额未受影响（`e2-u9-dist.png`、`e2-u9-earnings.png`）；u1 base 分销中心正常（`e2-u1-dist.png`）；guest 登录引导正常（`e2-guest-dist.png`）。
- 省代表单空提交内联红框+逐字段错误（`e2-form-blank.png`）；省独家持久冲突红条既有。
- 消息代理分组筛选/未读点/已读记忆/角标合并正常（`e2-u11-message-agent-filter.png`）。
- T2 归属总代/约定比例/已签/本人台账/钱包出口齐全（`e2-u12-t2.png`）。
- 全量页面 0 JS 运行错误。
