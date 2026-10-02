# ENGCHAIN App Demo · 底部操作按钮「非固定悬浮、可改造为底部固定悬浮」深度审计报告

> 审计对象：D:\Engchain3.0（工程链 ENGCHAIN 静态 HTML 移动端 App 原型，`.phone` 手机壳 390×844px，`.scroll` 内层滚动）
> 审计范围：`_manifest.json` 中全部 App Demo 具名页面（`home.html`、`index.html` + `pages/**`），共 **168 个具名页面**（132 个唯一 HTML 文件，同文件多 query 变体各算一个具名页面）
> 排除项（不在审计范围）：`admin/**`（桌面后台）、`docs/**`、`visual-system.html`、`folder-cards/**`、`pages/**/_backup`、`pages/**/_shots`、`pages/publish/style-exploration/**`、`*.bak`、`*.glass.html`
> 审计方法：只读静态代码分析（HTML 内联 `<style>` + 共享 `css/app.css`/`css/liquid-cta.css`/`pages/esign/esign.common.css` 等 + JS 渲染分支核对）+ 移动端视口（390×844）浏览器渲染实测（分片抽查 3-4 页/片 + 汇总阶段对全部 C 类页面独立复核）
> 报告日期：2026-10-03

---

## 一、结论摘要

| 分类 | 数量 | 说明 |
|---|---|---|
| **C = 有底部操作按钮、当前未固定、可改造为底部固定悬浮** | **4** | 本次核心交付，见第二节详细列项 |
| **B = 已有底部固定/悬浮**（`position:fixed` / `sticky bottom` / `absolute` 锚定手机壳底） | **69** | 无需改造 |
| **A = 无底部操作按钮**（短页/行内按钮/仅吸顶导航/弹层内按钮） | **95** | — |
| **合计** | **168** | 覆盖 168/168，未覆盖 0 |

### 按模块（group）分布

| group | 条目 | C | B | A |
|---|---|---|---|---|
| 工作台 | 2 | 0 | 0 | 2 |
| 共创计划 | 1 | 0 | 1 | 0 |
| 认证卡 | 2 | 0 | 2 | 0 |
| 个人中心 | 36 | 0 | 17 | 19 |
| 钱包 | 18 | **3** | 7 | 8 |
| 中介服务 | 12 | 0 | 0 | 12 |
| 订单 | 2 | 0 | 1 | 1 |
| 服务商 | 2 | 0 | 0 | 2 |
| 平台运营 | 1 | 0 | 0 | 1 |
| 企业监控 | 1 | 0 | 1 | 0 |
| 行业 | 1 | 0 | 0 | 1 |
| 收藏 | 1 | 0 | 0 | 1 |
| 分销 | 6 | 0 | 1 | 5 |
| 电子签 | 15 | 0 | 11 | 4 |
| 协议中心 | 13 | 0 | 0 | 13 |
| 注册登录 | 3 | 0 | 0 | 3 |
| 其他 | 6 | 0 | 3 | 3 |
| 消息 | 5 | **1** | 1 | 3 |
| GEO 品牌雷达 | 9 | 0 | 5 | 4 |
| 搜索中心 | 8 | 0 | 0 | 8 |
| 资源·机会 | 8 | 0 | 8 | 0 |
| 发布 | 8 | 0 | 4 | 4 |
| 供需·匹配 | 7 | 0 | 6 | 1 |
| 匹配 | 1 | 0 | 1 | 0 |
| **合计** | **168** | **4** | **69** | **95** |

### 关键架构事实（决定判定口径，全工程一致）

- 手机壳 `.phone{position:relative;width:390px;height:844px;overflow:hidden;display:flex;flex-direction:column}`（css/app.css:251-263）；页面内部滚动发生在 `.scroll{flex:1;overflow-y:auto}`（app.css:417）等内层容器。
- 因此，凡按钮位于 `.scroll` **之外**（`.phone` flex 列的兄弟节点）或用 `position:fixed` / `position:sticky;bottom:0` / `position:absolute;bottom:0` 锚定 `.phone`（唯一定位祖先），内容滚动都不影响其位置 → 统一判为 **B（已固定/悬浮）**。
- 共享固定栏类：`.us-footer`/`.us-footer-compact`（sticky bottom，app.css:2197/2291）、`.paybar`（fixed bottom，app.css:4192）、`.fixed-cta`（absolute 锚壳底，app.css:858，配合 `.fixed-cta + .scroll{padding-bottom}`）。
- 结论：本工程高频转化页（充值/提现/下单/发布/认证/签约）的底部主操作**绝大多数已固定到位**；真正可改造的是 **4 个表单提交页**。

---

## 二、C 类详细列项（本次核心交付：可改造为底部固定悬浮）

> 排序：先 P0/P1 高频转化页，后 P2。全部 4 条均已独立渲染复核（见第五节）。

| # | group | 页面名 | 链接 | 按钮文案 | 当前状态 | 代码证据（事实） | 建议优先级 |
|---|---|---|---|---|---|---|---|
| 1 | 钱包 | 银行卡 | pages/wallet/bank-cards.html | **添加并核验** | 按钮在表单流末尾，随 `.scroll` 滚动滚出视口；首屏不可见，滚动到底（scrollTop=327）才完整出现；页面无任何固定底栏 | 按钮 `bank-cards.html:85` `<button class="btn btn-primary btn-block btn-lg" id="bc-add">`，无 fixed/sticky 包裹；`.scroll` 容器 `:49` 留 `padding-bottom:96px` 却无对应固定栏（疑似预留位未落地）；实测 `.scroll` clientH=750/scrollH=1077（溢出 327px），按钮首屏 top=942 > 壳底 | **P1**（绑卡表单提交，高频操作；`.scroll` 已预留 96px 底距，落地成本最低，参照 `.paybar`/`.fixed-cta` 抽出即可） |
| 2 | 消息 | 投诉与举报 | pages/message/complaint.html | **提交投诉 / 举报** | 按钮在「表单卡片+提示条」之后、随内容滚动滚出视口：实测壳顶 scrollTop=0 时按钮 bottom=880 > 壳底 844（仅露顶部约 10px）；`.scroll` clientH=750/scrollH=966（溢出 216px）；滚到底（scrollTop=217）才完整出现 | `complaint.html:95` `<button class="cmp-submit" id="cmp-submit">提交投诉 / 举报</button>`；样式 `:32` `.cmp-submit{width:100%;height:46px;...}`（static 无定位）；容器 `:59` 为通用 `.scroll` | **P1**（投诉提交类表单；同域 refund/index.html 已有 `.refund-bottom{position:fixed;bottom:0}` 同款，可直接参照改造） |
| 3 | 钱包 | 新增抬头 | pages/wallet/invoice-title-new.html | **保存抬头** | 表单内容高 964px > 视口 750px，底部按钮首屏不可见（top=984）、滚动后才可见；无固定底栏 | `invoice-title-new.html:56` `<button class="btn btn-primary btn-block" onclick="save()">保存抬头</button>`（无定位包裹）；实测 scrollH=964/clientH=750 | **P2**（导航栏右上已有常驻「保存」兜底（:22），改造收益较低；仍建议改造以保持与"新增"一致体验） |
| 4 | 钱包 | 编辑开票信息 | pages/wallet/invoice-info-edit.html | **保存开票信息** | 表单末尾 btn-block 随内容流滚动，无固定底栏；实测（注入本地存储渲染）scrollH=870/clientH=750，按钮首屏 top=890 不可见、滚动后可见 | `invoice-info-edit.html:46` `<button class="btn btn-primary btn-block" onclick="save()">保存开票信息</button>`（无定位包裹）；导航栏右上「保存」`:22` 兜底（结构与"新增抬头"同构） | **P2**（同上，顶栏保存兜底） |

**改造建议（推断）**：4 页均参照全站既有模式——把按钮从内容流抽出为 `.paybar`（`css/app.css:4192`，`position:fixed;bottom:0`，含安全区 padding）或 `.fixed-cta`（`app.css:858`，absolute 锚壳底）的固定悬浮条，同时保留 `.scroll` 底部 padding 防止内容被遮挡。其中 bank-cards 已预留 96px 底距，落地成本最低。

---

## 三、B 类简表（已有底部固定/悬浮，69 条，无需改造）

| group | 页面名 | 链接 | 按钮文案 | 已固定证据 |
|---|---|---|---|---|
| 共创计划 | 共创者计划 | pages/co-create/index.html | 立即申请 / 先去认证 / 登录后申请 | `.cc-ctabar{position:fixed;left:50%;bottom:12px}`（co-create/index.html:577） |
| 认证卡 | 企业认证主页 | pages/company/index.html?id=c-znzjs | 联系TA（+解锁） | `.fixed-cta`（app.css:858，absolute 锚壳底）；company/index.html:75 |
| 认证卡 | 个人认证主页 | pages/personal/index.html?id=p-jzs1 | 联系TA | 同上 `.fixed-cta`（personal/index.html:192） |
| 个人中心 | 简历编辑 | pages/profile/resume-edit.html | 保存简历 | `.save-bar{position:fixed;bottom:0}`（resume-edit.html:72，已渲染验证） |
| 个人中心 | 编辑资料 | pages/profile/edit-profile.html | 保存 | `.save-bar{position:fixed;bottom:0}`（edit-profile.html:203-211） |
| 个人中心 | 我的委托 | pages/profile/delegates.html | 新增委托 | `.dl-add-bar{position:fixed;bottom:0}`（delegates.css:110） |
| 个人中心 | 新建委托 | pages/profile/delegate-new.html | 提交委托 | `.dn-save-bar{position:fixed;bottom:0}`（delegates.css:142） |
| 个人中心 | 修改委托 | pages/profile/delegate-edit.html | 保存（编辑态） | `.dn-save-bar`（delegates.css:142；delegate-edit.html:30，条件显示） |
| 个人中心 | 分享 | pages/profile/share.html | 生成海报/分享 | `.share-bottom-bar{position:fixed;bottom:0}`（share.html:57） |
| 个人中心 | 认证中心 | pages/profile/auth.html | 去认证/立即认证 | `.at-dock`（auth.html:362）+ liquid-cta 液态底栏（absolute bottom） |
| 个人中心 | 企业工商认证 | pages/profile/auth-enterprise.html | 支付 ¥999 提交审核 | `.fixed-cta.ae-cta`（auth-enterprise.html:167） |
| 个人中心 | 个人入驻·申请 | pages/profile/auth-qualification.html | 下一步 / 确认提交 | `.fixed-cta.aq-cta`（auth-qualification.html:335） |
| 个人中心 | 认证结果·成功 | pages/profile/auth-result.html | 返回认证中心 / 去逛逛供需大厅 | `.fixed-cta.ar-cta`（auth-result.html:76，已渲染验证钉底） |
| 个人中心 | 认证结果·审核中 | pages/profile/auth-result.html?state=reviewing | 查看申请详情 / 返回认证中心 | 同上 `.ar-cta`（auth-result.html:94） |
| 个人中心 | 个人合伙人申请 | pages/profile/auth-partner.html | 提交申请 | `.fixed-cta.ap-cta`（auth-partner.html:70） |
| 个人中心 | 认证资料准备 | pages/profile/auth-prep.html | 我已准备好，开始填写 | `.ap-bottom-bar{position:fixed;bottom:0}`（auth-prep.html:427） |
| 个人中心 | 入驻申请·建筑 | pages/profile/entry-form.html?type=construction | 上一步 / 下一步 | `.fixed-cta.ef-cta`（entry-form.html:54） |
| 个人中心 | 入驻审核·合伙人 | pages/profile/entry-review.html | 查看入驻权益 / 补充资料重新入驻 | `.fixed-cta.er-cta`（entry-review.html:63,75） |
| 个人中心 | 入驻成功 | pages/profile/entry-result.html | 开始经营 / 编辑资料 / 认证中心 | `.fixed-cta.es-cta`（entry-result.html:163） |
| 个人中心 | 个人入驻·结果 | pages/profile/entry-personal-result.html | 去入驻 / 投递简历 | `.fixed-cta.pr-cta`（entry-personal-result.html:193） |
| 钱包 | 积分账户·充值解锁 | pages/wallet/credits.html | 立即充值 | `.paybar`（app.css:4192 fixed bottom;0）；credits.html:258 |
| 钱包 | 积分商城 | pages/wallet/credits-mall.html | 去充值 | `.cm-paybar{position:fixed;bottom:0}`（credits-mall.html:145） |
| 钱包 | 积分规则 | pages/wallet/credits-rules.html | 充值积分 / 去商城兑换 | `.cr-cta{position:fixed;bottom:0}`（credits-rules.html:114） |
| 钱包 | 会员中心 | pages/wallet/membership.html | 立即开通 / 续费 | `.fixed-cta[data-lg-cta=bar]`（membership.html:199） |
| 钱包 | 余额充值 | pages/wallet/recharge.html | 确认充值 | `.paybar`（recharge.html:136，fixed bottom:0） |
| 钱包 | 提现 | pages/wallet/withdraw.html | 提交提现申请 | `.fixed-cta[data-lg-cta=bar]`（withdraw.html:106） |
| 钱包 | 对公转账 | pages/wallet/corp-pay.html | 提交凭证 / 重新提交 | `.fixed-cta[data-lg-cta=bar]`（corp-pay.html:84） |
| 分销 | 提现 | pages/distribution/withdraw.html | 提交佣金提现申请 | `.fixed-cta[data-lg-cta=bar]`（distribution/withdraw.html:113） |
| 订单 | 订单详情 | pages/order/detail.html | 去支付 / 确认验收 / 再次购买（按状态动态渲染） | `.fixed-cta#cta-bar[data-lg-cta=bar]`（order/detail.html:30） |
| 企业监控 | 企业监控·风险雷达 | pages/monitor/index.html | （雷达底部操作栏） | `.radar-bottom-bar{position:fixed;bottom:0}`（monitor/index.html:316） |
| 电子签 | 电子签·首页 | pages/esign/index.html | 发起签署（右下角 FAB，滚动后浮现） | `.es-fab{position:absolute;right:16px;bottom:20px}`（esign.common.css:330，锚壳底） |
| 电子签 | 填写合同信息 | pages/esign/template-fill.html | 上一步 / 下一步 | `.es-foot-bar` 内联 absolute bottom（template-fill.html:28） |
| 电子签 | 上传 PDF 发起 | pages/esign/upload.html | 上一步 / 下一步：签署方 | 同上（upload.html:28） |
| 电子签 | 添加签署方 | pages/esign/parties.html | 上一步 / 下一步 | 同上（parties.html:28） |
| 电子签 | 设置签章位置 | pages/esign/fields.html | 上一步 / 下一步：确认发送 | 同上（fields.html:28-31） |
| 电子签 | 预览发送 | pages/esign/preview.html | 返回修改 / 确认无误并发送 | 同上（preview.html:28-32） |
| 电子签 | 合同详情 | pages/esign/detail.html | 立即签署 / 催对方签署 / 撤回合同 | `.es-foot-bar#foot`（detail.html:28） |
| 电子签 | 我要签署 | pages/esign/sign.html | 实名认证并签署 | `.es-foot-bar`（sign.html:27） |
| 电子签 | H5 签署·对方端 | pages/esign/h5-sign.html | 实名认证并签署 | `.h5-bottom{position:sticky;bottom:0}`（esign.common.css:344） |
| 电子签 | 购买次数 | pages/esign/packages.html | 余额支付 ¥X | `.es-foot-bar#foot`（packages.html:28） |
| 电子签 | 申请退款 | pages/esign/refund.html | 取消 / 提交退款申请 | `.es-foot-bar#foot`（refund.html:28） |
| 其他 | 退款规则 | pages/refund/index.html | 联系客服 / 申请退款 | `.refund-bottom{position:fixed;bottom:0}`（refund/index.html:411-418） |
| 其他 | 申请退款 | pages/refund/appeal.html | 提交退款申请 | `.fixed-cta`（refund/appeal.html:63） |
| 其他 | 破冰期引导 | pages/guide/index.html | 立即开始 / 开始使用 | `.guide-bottom{position:fixed;bottom:0}`（guide/index.html:97） |
| 消息 | 聊天窗口 | pages/message/chat.html | 发送输入条（含名片/报价单/预约面板按钮） | `.mc-input` flex 列钉底（chat.html:145）+ `.mc-scroll` 内部滚动 |
| 供需·匹配 | 详情·材料采购 | pages/supply/detail.html?id=1001 | 动态 CTA：今日免费解锁 / 联系采购方（+收藏/分享） | `.detail-actionbar` 为 `.phone` flex 兄弟节点（detail.html:39，在 `.scroll` 之外），JS 注入（detail.js:2520） |
| 供需·匹配 | 详情·材料供应 | pages/supply/detail.html?id=1009 | 解锁联系方式 / 联系供应商 | 同上 `.detail-actionbar` |
| 供需·匹配 | 详情·劳务用工 | pages/supply/detail.html?id=1004 | 解锁联系方式 / 联系用工方 | 同上 |
| 供需·匹配 | 详情·设备租赁 | pages/supply/detail.html?id=1005 | 解锁联系方式 / 联系出租方 | 同上 |
| 供需·匹配 | 详情·建筑合作 | pages/supply/detail.html?id=cp1 | 解锁联系方式·查看招标文件 / 联系项目方 | 同上 |
| 供需·匹配 | 详情·中介服务 | pages/supply/detail.html?id=a1 | 解锁联系方式·查看报价单 / 在线下单 | 同上 |
| 资源·机会 | 资质招商·企业详情 | pages/supply/detail.html?id=fc1 | 免费咨询 / 电话咨询招商顾问 | 同上 |
| 资源·机会 | 企业买卖·M&A | pages/supply/detail.html?id=t1 | 缴纳保证金查看详情 / 联系转让方 | 同上 |
| 资源·机会 | 企业招聘·需求详情 | pages/supply/detail.html?id=p1 | 联系/沟通企业方 | 同上 |
| 资源·机会 | 人才详情·一级建造师 | pages/supply/detail.html?id=talent1 | 积分解锁沟通权限 / 沟通权限已开通 | 同上 |
| 资源·机会 | 资质招商·首页 | pages/franchise/index.html | 底部悬浮组「招商 / 加盟 / 委托」 | `.app-float-cta{position:absolute;bottom:14px}`（franchise/index.html:293,504） |
| 资源·机会 | 建企买卖·首页 | pages/trade/index.html | 底部悬浮组「发布 / 委托」 | `.app-float-cta`（trade/index.html:285,498） |
| 资源·机会 | 人员招聘·首页 | pages/personnel/index.html | 底部悬浮组「发布需求 / 委托」 | `.app-float-cta`（personnel/index.html:279,511） |
| 资源·机会 | 修改委托 | pages/franchise/delegate-edit.html | 保存修改 | `.de-save-bar{position:fixed;bottom:0}`（delegate-edit.html:27,53） |
| 发布 | 信息工作台 | pages/publish/index.html | 发布供需信息（悬浮钮） | `.wb-dock{position:fixed;left:50%;bottom:14px}`（publish/index.html:299,458） |
| 发布 | 发布需求·编辑 | pages/publish/editor.html?role=demand | 存草稿 / 上一步 / 下一步 / 提交发布 | `.fixed-actionbar{position:absolute;bottom:0}`（editor.html:221,1146，在 `.editor-scroll` 之外；`.pro-footer` 为弹层内按钮已排除） |
| 发布 | 发布供应·编辑 | pages/publish/editor.html?role=supply | 同上 | 同上（同一文件，role 仅改字段） |
| 发布 | 发布成功 | pages/publish/success.html | 查看信息详情 / 查看我的发布 / 返回信息工作台 | `.fixed-cta`（success.html:55） |
| 匹配 | 匹配偏好设置 | pages/match/preferences.html | 重置 / 保存并生成推荐 | `.pref-actions{position:fixed;bottom:0}`（preferences.html:77,188，已渲染验证） |
| GEO 品牌雷达 | 品牌管理 | pages/geo/brands.html | ＋ 添加品牌 | `.br-cta{position:fixed;bottom:0}`（brands.html:58,146） |
| GEO 品牌雷达 | 内容审计 | pages/geo/audit.html | 查看优化方案 | `.ad-cta{position:fixed;bottom:0}`（audit.html:89,114） |
| GEO 品牌雷达 | GEO 报告·¥500/次 | pages/geo/report.html | 按方案执行 / 生成报告 ¥500 | `.rp-cta{position:fixed;bottom:0}`（report.html:164,188） |
| GEO 品牌雷达 | 优化工作台 | pages/geo/optimize.html | 回到报告·查看发布方案 | `.op-cta{position:fixed;bottom:0}`（optimize.html:105,131） |
| GEO 品牌雷达 | 权益说明 | pages/geo/pricing.html | 返回驾驶舱 / 生成报告 ¥500 | `.pr-cta{position:fixed;bottom:0}`（pricing.html:63,162） |

> 说明：B 类中 `.fixed-cta`（absolute 锚壳底）页除 auth-result 外未逐页渲染；其定位机制同一（`.fixed-cta` → `.phone`），结论一致，属高置信（见第五节与「限制说明」）。

---

## 四、A 类清单（无底部操作按钮，95 条）

> 说明列区分：无底部按钮 / 仅吸顶导航 / 短页一屏可见无需固定 / 按钮在弹层(sheet/modal)内 / 按钮在顶部导航或行内。

| group | 页面名 | 链接 | 说明 |
|---|---|---|---|
| 工作台 | App首页 | home.html | 底部仅悬浮导航胶囊 `.app-tabbar`（导航非操作按钮）；页内 CTA 为卡片内跳转 |
| 工作台 | 认证引导 | index.html | 广告门/自动跳转页；按钮在广告弹层内 |
| 个人中心 | 我的·个人中心 | pages/profile/index.html | 导航 hub + 底部 tabbar；"充值"为钱包卡片内联按钮 |
| 个人中心 | 我的投递 | pages/profile/my-applies.html | 列表页；按钮在空态/弹层 sheet 内 |
| 个人中心 | 隐私设置 | pages/profile/privacy.html | 开关列表；"确认屏蔽"在确认弹窗内 |
| 个人中心 | 联系方式 | pages/profile/contact.html | "保存"在顶部导航栏 nav-right，非底部按钮 |
| 个人中心 | 浏览历史 | pages/profile/history.html | 已移除底部主 bar；"清除历史"在导航按钮+确认弹窗内 |
| 个人中心 | 我的招聘 | pages/profile/my-jobs.html | 列表页；按钮在空态/弹层 sheet 内 |
| 个人中心 | 个人资料 | pages/profile/edit.html | "保存"在顶部导航栏 nav-right，非底部按钮 |
| 个人中心 | 委托详情 | pages/profile/delegate-detail.html | 详情展示页，无底部操作按钮 |
| 个人中心 | 全部功能 | pages/profile/all-functions.html | 功能宫格页，无底部操作按钮 |
| 个人中心 | 企业成员管理 | pages/profile/org-members.html | 按钮均在弹层 sheet 内动态渲染 |
| 个人中心 | 历史文件 | pages/profile/history-files.html | 文件列表页，无底部操作按钮 |
| 个人中心 | 个人实名认证 | pages/profile/auth-personal.html | 边缘项：主提交"免费提交并人脸核验"无固定底栏，但实测首屏已可见（溢出仅 67px），按判定归 A；建议在更矮机型复核 |
| 个人中心 | 资金账户认证·已迁移 | pages/profile/auth-payment.html | 自动跳转迁移提示短页，一屏内可见 |
| 个人中心 | 企业入驻·三类 | pages/profile/entry.html | 各类型卡片内联"去入驻"，非页面底栏 |
| 个人中心 | 设置 | pages/profile/settings.html | 设置列表页，无底部操作按钮 |
| 个人中心 | 通用设置 | pages/profile/general-setting.html | 开关列表页，无底部操作按钮 |
| 个人中心 | 账号与安全 | pages/profile/security.html | 底部"切换账号/退出登录"为列表内 ghost 行按钮（低频危险操作，不适合固定） |
| 个人中心 | 送达方式 | pages/profile/notify.html | 开关列表页，无底部操作按钮 |
| 个人中心 | 关于我们·合规资质 | pages/profile/about.html | 静态关于页，无底部操作按钮 |
| 钱包 | 钱包·首页 | pages/wallet/index.html | 主操作"充余额/提现"在余额卡下方中部 hero 区，非内容底部栏 |
| 钱包 | 支付方式 | pages/wallet/payment-method.html | 仅 radio 列表，无提交按钮 |
| 钱包 | 托管资金 | pages/wallet/escrow.html | 纯说明页，无操作按钮 |
| 钱包 | 免费额度 | pages/wallet/free-quota.html | "去入驻"为行内小按钮 |
| 钱包 | 解锁记录 | pages/wallet/unlock-records.html | 列表页，空态小按钮 |
| 钱包 | 发票管理 | pages/wallet/invoice.html | "提交申请"在可折叠展开表单内（短且默认隐藏） |
| 钱包 | 发票记录 | pages/wallet/invoice-record.html | 列表页，行内 ghost 按钮 |
| 钱包 | 开票信息管理 | pages/wallet/invoice-info.html | 管理列表；"＋新增抬头"仅在空态卡片内 |
| 中介服务 | 服务广场 | pages/agency/index.html | CTA 在卡片行内与弹层内（"智能匹配合作机构"在 `.ns-sheet` 内，排除）；`.mkt-sticky` 为吸顶搜索 |
| 中介服务 | 在线下单·资质升级 | pages/agency/order.html?svcId=a1 | 中转提示页，单按钮不足一屏、2.5s 自动跳转，始终可见 |
| 中介服务 | 在线下单·工商注册 | pages/agency/order.html?svcId=a2 | 同上（同文件，CTA 与 a1 一致） |
| 中介服务 | 在线下单·安许代办 | pages/agency/order.html?svcId=a3 | 同上 |
| 中介服务 | 在线下单·资质分立 | pages/agency/order.html?svcId=a4 | 同上 |
| 中介服务 | 在线下单·工程担保 | pages/agency/order.html?svcId=a5 | 同上 |
| 中介服务 | 在线下单·造价咨询 | pages/agency/order.html?svcId=a6 | 同上 |
| 中介服务 | 在线下单·劳务派遣 | pages/agency/order.html?svcId=a7 | 同上 |
| 中介服务 | 我的单（买方订单） | pages/agency/my-orders.html | 列表页；"去下单"在顶栏、"去解锁联系"行内 |
| 中介服务 | 订单详情 | pages/agency/order-detail.html | 历史托管单存档页，短卡片 |
| 中介服务 | 服务商工作台 | pages/agency/seller-board.html | dashboard；"提交报价"在报价 sheet 弹层内 |
| 中介服务 | 演示重置 | pages/agency/demo-reset.html | 短工具页，"执行重置"不足一屏 |
| 订单 | 我的订单 | pages/order/index.html | 列表页（筛选 chips + 订单列表），空态按钮行内 |
| 服务商 | 经营数据看板 | pages/vendor/dashboard.html | dashboard；"开通经营工具"在行内 gate 卡片 |
| 服务商 | 服务商升级 | pages/vendor/upgrades.html | 道具市场；购买走 UI.dialog 弹层，无底部栏 |
| 平台运营 | 平台运营台 | pages/platform/dashboard.html | 运营台 dashboard；操作在弹层与行内 |
| 行业 | 行业总览 | pages/industry/index.html | "立即订阅"在订阅弹窗 sheet 与报告卡片内 |
| 收藏 | 我的收藏 | pages/favorite/index.html | 列表页，空态"去发现"小按钮 |
| 分销 | 分销中心 | pages/distribution/index.html | dashboard；hero 卡内"提现"行内按钮 |
| 分销 | 收益 | pages/distribution/earnings.html | 列表 + 空态按钮；`.chip-bar` 为吸顶(top) |
| 分销 | 我的团队 | pages/distribution/team.html | 列表 + 空态按钮 |
| 分销 | 推广海报 | pages/distribution/poster.html | 游客门控短页；登录后 `.poster-actions`（static）紧贴海报预览，页面短 |
| 分销 | 分销规则 | pages/distribution/rules.html | 纯规则说明页 |
| 电子签 | 发起签署 | pages/esign/choose-type.html | 类型宫格导航（从模板发起/上传 PDF 发起），主操作为卡片入口，无底部操作条 |
| 电子签 | 合同模板 | pages/esign/template-list.html | 模板列表，点卡片进入下一步；无底部按钮 |
| 电子签 | 购买记录 | pages/esign/records.html | 订单列表；空态/行内按钮在内容流中 |
| 电子签 | 服务协议与免责声明 | pages/esign/agreement.html | 纯长协议阅读页 |
| 协议中心 | 协议中心（目录） | pages/agreement/user.html | 长协议合集；顶部 `.ag-tabs`（sticky top）为吸顶分类导航（非操作按钮）；底部 `.ag-footer` 仅为运营主体/备案/客服热线公示信息 |
| 协议中心 | 用户服务协议 | pages/agreement/user.html#service | 长文阅读型条目，无底部操作按钮 |
| 协议中心 | 隐私政策 | pages/agreement/user.html#privacy | 同上 |
| 协议中心 | 认证与授权服务协议 | pages/agreement/user.html#auth | 同上 |
| 协议中心 | 余额充值与提现协议 | pages/agreement/user.html#recharge | 同上 |
| 协议中心 | 积分与会员服务协议 | pages/agreement/user.html#credits | 同上 |
| 协议中心 | 交易与资金托管协议 | pages/agreement/user.html#trade | 同上 |
| 协议中心 | 加盟与分销协议 | pages/agreement/user.html#franchise | 同上 |
| 协议中心 | 信息发布规范 | pages/agreement/user.html#publish | 同上 |
| 协议中心 | 沟通与交易秩序规则 | pages/agreement/user.html#communication | 同上 |
| 协议中心 | 平台活动规则 | pages/agreement/user.html#activity | 同上 |
| 协议中心 | 失信主体公示规则 | pages/agreement/user.html#credit | 同上 |
| 协议中心 | 免责声明 | pages/agreement/user.html#disclaimer | 同上 |
| 注册登录 | 登录 | pages/auth/login.html | 居中登录卡，一屏内短表单，按钮始终可见 |
| 注册登录 | 注册 | pages/auth/register.html | 实测零溢出（scrollH=750=clientH），"注册"按钮在壳内 |
| 注册登录 | 账号已封禁 | pages/auth/banned.html | 申诉/联系客服为卡片内行内按钮，约一屏 |
| 其他 | 帮助中心 | pages/help/index.html | 仅 `.help-sticky-top` 吸顶搜索栏，无底部操作按钮 |
| 其他 | 意见反馈 | pages/help/feedback.html | 实测溢出仅 43px，"提交反馈"按钮默认完整可见（短页无需固定） |
| 其他 | 数据服务 API | pages/api/index.html | 行内"充值"与"调用"按钮，无底部条 |
| 消息 | 会话列表 | pages/message/index.html | 筛选弹窗内"确定"（弹层）、空态行内 CTA；无底部条 |
| 消息 | 常用话术 | pages/message/phrases.html | "新增常用语"仅筛选后出现且实测在屏内；弹层内按钮不计 |
| 消息 | 系统消息 | pages/message/system.html | "全部已读"为头部操作，消息行内按钮在流中 |
| GEO 品牌雷达 | 驾驶舱 | pages/geo/index.html | 数据概览页；空态引导按钮在内容流内 |
| GEO 品牌雷达 | 引擎监控 | pages/geo/monitor.html | 监控数据展示页，无底部操作按钮 |
| GEO 品牌雷达 | 品牌知识库 | pages/geo/knowledge.html | 知识库展示页，无底部操作按钮 |
| GEO 品牌雷达 | 关键词管理 | pages/geo/keywords.html | 行内开关/词库点选，无底部主操作 |
| 搜索中心 | 搜索中心首页 | pages/search/index.html | 搜索首页，主交互为顶部搜索栏 |
| 搜索中心 | 全局搜索 | pages/search/index.html?v=global | 搜索框 + 结果浏览，无底部按钮 |
| 搜索中心 | 搜索结果·分类展示 | pages/search/index.html?v=global&q=混凝土 | 结果列表，顶部 sticky 搜索栏 |
| 搜索中心 | 资质招商搜索 | pages/search/index.html?v=business&b=franchise | 结果列表浏览 |
| 搜索中心 | 建企买卖搜索 | pages/search/index.html?v=business&b=trade | 结果列表浏览 |
| 搜索中心 | 人员招聘搜索 | pages/search/index.html?v=business&b=personnel | 结果列表浏览 |
| 搜索中心 | 企业查询·双模式 | pages/search/index.html?v=enterprise | 双模式 tab + 列表；"查询"在顶部搜索栏（已渲染确认） |
| 搜索中心 | 服务广场搜索 | pages/search/index.html?v=agency | 结果列表浏览 |
| 发布 | 选择发布类型 | pages/publish/choose.html | 纯类型宫格导航，无提交按钮 |
| 发布 | 我的发布 | pages/publish/records.html | 列表管理页；发布入口在右上角，操作在弹层内 |
| 发布 | 草稿箱 | pages/publish/drafts.html | 草稿卡片列表，"继续编辑/删除"在行内 |
| 发布 | 已解锁线索 | pages/publish/unlocked.html | 线索卡片列表，行内操作 |
| 供需·匹配 | 发现·首页 | pages/supply/list.html | 发现列表页；`.scroll` 底部 100px padding 预留给全局底部 tabbar（推断），无页面级主操作按钮 |

---

## 五、渲染复核证据（静态分析 + 浏览器实测双确认）

### 5.1 C 类 4 页独立复核（汇总阶段，playwright-core + 本机 Chrome，390×844 视口）

| 页面 | 实测数据（事实） | 结论 |
|---|---|---|
| pages/wallet/bank-cards.html | `.scroll` clientH=750/scrollH=1077（溢出 327px）；按钮「添加并核验」首屏 top=942/bottom=996（完全不可见）；滚到底（scrollTop=327）后按钮 fullyVisible=true；页面无固定底栏 | **C 确认** |
| pages/message/complaint.html | `.scroll` clientH=750/scrollH=966（溢出 216px）；按钮「提交投诉 / 举报」首屏 top=836/bottom=882（仅露顶部约 8px，被壳底裁切）；滚到底（scrollTop=218）后 fullyVisible=true | **C 确认** |
| pages/wallet/invoice-title-new.html | `.scroll` clientH=750/scrollH=964（溢出 214px）；按钮「保存抬头」首屏 top=984（不可见）；滚到底（scrollTop=214）后 fullyVisible=true | **C 确认** |
| pages/wallet/invoice-info-edit.html | 需注入本地存储（无已存抬头时页面执行 `history.back()` 回退，属运行时守卫非渲染故障）；注入后实测 scrollH=870/clientH=750（溢出 120px），按钮「保存开票信息」首屏 top=890 不可见、滚动后 fullyVisible=true；导航栏右上「保存」常驻 | **C 确认** |

### 5.2 抽样复核（分片阶段，各分片渲染 3-4 页/片）

- B 类抽样：auth-result（`.fixed-cta` 钉壳底，scrollTop=0 即可见）、resume-edit（`.save-bar` fixed 钉底）、match/preferences（`.pref-actions` fixed 钉底）、supply/detail.html?id=1001（内容在顶部时金色 CTA「今日免费解锁」已钉壳底）、publish/editor.html?role=demand（壳底「存草稿/下一步」钉底）→ 均与静态分析一致，B 成立。
- A 类抽样：search/index.html?v=enterprise（底部无任何操作按钮）、supply/list.html（无底部主操作，列表可滚）、distribution/poster.html（游客短门控页）→ 均与静态分析一致。
- 从 C 候选实测剔除的页面（短页无需固定）：help/feedback.html（溢出 43px，按钮默认可见）、auth/register.html（零溢出）、message/phrases.html（按钮筛选后出现且在屏内）、profile/auth-personal.html（溢出 67px，按钮首屏可见，标注为边缘项）。

---

## 六、事实与推断区分

- **事实（代码证据）**：各底栏/按钮的 CSS 类名与 `position` 值、所在文件与行号、按钮原文文案、DOM 嵌套关系（按钮是否在 `.scroll` 之外）、渲染实测的 scrollH/clientH 与按钮矩形坐标。
- **推断**：① C 类「建议优先级」（基于页面功能形态判断高频/低频）；② 「页面极短、无需固定」「某页为列表/概览页无需底部按钮」「`.scroll` 底部 padding 为全局 tabbar 预留」等产品形态判断；③ 改造方式建议。以上推断均不影响 C/B/A 定位判定——定位判定由 CSS position 与 DOM 嵌套这一代码事实决定。

## 七、覆盖声明与限制

- **覆盖：168/168 全部具名页面均有结论，未覆盖清单为空**。分片覆盖核对：个人中心域 41/41、钱包服务域 44/44、签署协议域 42/42、供需搜索域 41/41。
- 多变体文件已按要求：分析按文件去重一次、结论按 manifest 条目逐条输出，并核对 JS 按 query/id/role 的渲染分支（supply/detail.html 10 变体、search/index.html 8 变体、agency/order.html 7 变体、publish/editor.html 2 变体、auth-result.html 2 变体、agreement/user.html 13 锚点变体）。
- 限制/未验证部分（如实说明）：
  1. 电子签发起流表单页（upload/template-fill/parties/fields/preview/sign/detail/packages/refund）匿名渲染下被登录门禁拦截，登录态表单壳未逐页视觉复核；其 B 判定依据静态 HTML 中 `.es-foot-bar` 内联 `position:absolute;bottom:0` 与共享壳 CSS（es-view/es-scroll/es-foot-bar 结构），证据闭合。
  2. B 类中 `.fixed-cta`（absolute 锚壳底）页除 auth-result 外未逐页渲染；定位机制同一（`.fixed-cta`→`.phone`），结论一致，属高置信。
  3. `pages/profile/auth-personal.html` 为唯一边缘判断（按钮无固定栏但首屏可见），已在 A 表标注，建议真实机型复核。
- 审计全程只读，未修改 D:\Engchain3.0 内任何文件。
