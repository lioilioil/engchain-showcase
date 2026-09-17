# Liquid Glass 主 tabbar · 工作区

iOS 26「Liquid Glass」折射风格的主 tabbar（Dock）+ 右侧 AI 球的成簇布局。
方案挂在 app demo 中**确实渲染主 tabbar 的 8 个页面**上。

## 为什么是 8 页而不是 12 页

`js/common.js:986` 是 `if (tab && phone && !phone.querySelector('.app-tabbar'))` ——
**只有 `<body data-tab="...">` 存在时才注入主导航**。其中 4 个页面是裸 `<body>`：

| 页面 | data-tab | 主 tabbar | 本方案 |
|---|---|---|---|
| home / message / personnel / profile / publish / refund / supply-list / trade | 有 | 有 | **挂载** |
| order / profile-privacy / profile-resume-edit / wallet-credits-mall | 无 | 没有 | **不挂载** |

这 4 页压根没有主 tabbar，挂上去纯属惰性 —— CSS 会加载但没有任何 `.app-tabbar`
可作用，`dock.js` 也找不到目标而自行返回（不建 `.lg-base`）。既然无处生效，
就不该留在页面上，现已全部卸下。

`verify-pages.js` 对这 4 页断言三件事：没有主 tabbar、没有 `liquid-dock` 的
link/script、`dock.css` 没加载（`--lg-h` 取不到值）；`eol-audit.py` 再断言整份文件
与索引 blob 逐字节相等（卸下后无残留）。少任何一条，「只挂了 8 页」就只是句口号。

> 早先那份「12 页都有主 tabbar」的清单是错的：它是用
> `grep -o 'data-tab="[a-z]*"' | head -1` 扫出来的，而那个正则会命中页面里的
> **筛选按钮**（`data-tab="all" / "search" / "voice" / "goods"`），不是 `<body>` 上的属性。
> 判据只能是逐页看 `<body>`，或直接读 `common.js:986`。

## 唯一来源与产物

```
dock.css / dock.js                     ← 唯一来源。改这里，别改产物
   └─ python sync.py                   → css/liquid-dock.css、js/liquid-dock.js
        └─ python apply-demo.py        → 8 个页面各插 1 行 <link> + 1 行 <script>
```

demo 侧的 `css/liquid-dock.css`、`js/liquid-dock.js` 是**生成物**，首行带
`@generated` 横幅。`verify.js` 会「去掉横幅后逐字节比对」源与产物 —— 只改了源
却忘了跑 `sync.py`，验证会直接失败。这个坑真踩过：产物里已有 `--lg-w:220px`，
而源文件与 git index 都已回到改动前，两边各自漂移且无人察觉。

## 为什么是「独立层」而不是改 app.css

旧 tabbar 的视觉（背景 / 边框 / 阴影 / backdrop-filter）由 `liquid-dock.css`
完整接管（全部置空后重建），页面上只多一行 `<link>` + 一行 `<script>`。
这样每一步都能独立回退，且回退点是明确的：改坏了删掉那两行即可，不必回滚 app.css。

`css/app.css` 在 2026-09-17 做过一次**只删纯死规则**的清理，见下节。

`js/common.js` 也**不再是零改动**了，共两处（2026-09-17，需求 1 与 press 形变）：

- 两个「发现」图标的 SVG（`UI.tabbar` 的 `TABS` 与 `SIDEBAR_TABS` 各一处，
  `common.js:200` / `:1002`）换成三条横杠的汉堡形。
- `initTabbarGlass()` 的 `measure()` 由 `getBoundingClientRect()` 改为
  `offsetLeft` / `offsetWidth`，理由见下面「测量陷阱」一节。

除此之外 common.js 没动过。

## app.css 死代码清理（2026-09-17）

独立层跑通后，app.css 里那批被 `liquid-dock.css` 完整覆盖的旧规则就没用了。
按用户确认的范围「只删纯死规则」，删了 **90 行**（`git diff --numstat` =
`0  90  css/app.css`），涉及 9 个选择器：

```
.app-tabbar::before / ::after                     顶部高光条、底部反光
[data-theme="dark"] .app-tabbar                   暗色背景
[data-theme="dark"] .app-tabbar::before / ::after
.app-tabbar:active { cursor: grabbing; }
.tab-glass.is-first / .is-last                    首尾不对称圆角
[data-theme="dark"] .tab-glass                    暗色玻璃块
```

**刻意没删**（它们还活着）：

- `.app-tabbar` 本体 —— dock.css 的重建**没有**设 `justify-content` 和
  `user-select`，这两条仍由 app.css 提供，整块删不得。
- `.app-tab` 的 `:active{transform:scale(.92)}`、选中态 `filter`、
  badge 的 `background` / `z-index`，以及整个 `prefers-reduced-motion` 块。
- 全部 `.phone.has-pura-sidebar` 规则 —— 短屏进 Pura 侧边栏模式时
  `margin:0;width:100%` 与球的 `display:none` 是**活布局**。
  我一开始把它们当成死代码，查过之后反过来了。

> `.app-tab:active{scale(.92)}` 后来**没有从 app.css 里删**，而是在 dock.css 里
> 用同特异度的 `.app-tab:active{transform:none}` 压掉（dock.css 后加载，后者胜）。
> 理由：删 app.css 影响的是「卸下本方案的 8 页之外」的处境，压掉只在挂载时生效，
> 回退粒度更干净。见下面「按下形变」一节。

### 怎么证明「删掉的确实是死的」

判据是**计算样式**，不是像素：

```bash
node  artifacts/tabbar-redesign/lg/dockstyle.js before     # 改前采样
#   ... 改 css/app.css ...
node  artifacts/tabbar-redesign/lg/dockstyle.js after      # 改后采样
node  artifacts/tabbar-redesign/lg/diff-style.js _style/before.json _style/after.json
```

`dockstyle.js` 采样 4 个组合（home / supply × 浅 / 深）下 `.app-tabbar`、
其 `::before` / `::after`、`.tab-glass` 的**全部**计算属性，共 9280 条。
`diff-style.js` 分三层判：

| 层 | 断言 |
| --- | --- |
| L1 | `.app-tabbar` 与 `.tab-glass` **元素本体**逐条相同（零容忍；差一条就是删到了活代码） |
| L2 | 伪元素的变化**仅当**前后 `content` 都是 `none` 才放行 —— 不生成盒子就画不出像素 |
| L3 | 活动性自证：9 个被删选择器必须已在 app.css 中消失，否则「前后一致」可能只是压根没删 |

结果：**3 passed, 0 failed**（L2 的 128 条变化全落在 `::before`/`::after`
且 `content` 前后皆为 `none`）。像素旁证（`dockpix.js`）4 个用例
**0 差异像素、最大通道差 0**。

> 为什么主判据不是像素：同一份 CSS 连拍，Dock 区域仍有最大 3/255 的抖动
> （合成层面，预热压不掉）。拿它当判据，「前后相同」会被这 3/255 直接证伪，
> 只能退化成「差异够小」。计算样式是确定的 —— 实测连跑两次 9280 条零变化
> （JS 运行时写入的 `--lg-sq` / `--lg-sqy` / `--lg-so` 已排除，那是运行时
> 状态不是级联结果）。像素只作旁证。

回退：`git checkout -- css/app.css`（改前该文件与 HEAD 一致，
HEAD blob `15002c50d9e5263a58600e71ba3e1dcecd634fef`）。

## 需求 2/3/4 与两条新任务（2026-09-17）

四条明确的取舍：**玻璃更透只针对底层 bar 大背景**（不动选中项那块小玻璃）、
**按下整体形变做**、**图标配色不做**、**回退是有意为之**。另加两件：
发现图标换汉堡、Pura 收起态下 Dock 宽度失控。

### 更透：只改 `.lg-base`

`--lg-a` 的四个 alpha 全部 ×0.7（浅色 `.09/.04/.035/.07`，深色
`.28/.20/.18/.25`）。**只改 `.lg-base`** —— `.tab-glass` / `.tg-*` 一行没碰，
所以「选中项的小玻璃块」保持原样，这正是需求里划的那条线。

### 按下形变：`@property` 是必需的，不是装饰

```css
@property --lg-press{ syntax:'<number>'; inherits:true; initial-value:0; }
.app-tabbar{ transition: transform .18s cubic-bezier(.34,1.4,.64,1),
                         --lg-press .22s cubic-bezier(.4,0,.2,1); }
.app-tabbar:active{ transform: scale(var(--lg-press-scale)); --lg-press: 1; }
```

三个必须记住的点：

1. **没注册 `@property` 的自定义属性是离散的**，`transition` 对它无效 —— 值会
   从 0 直接跳到 1，形变变成一帧闪现而不是过渡。`syntax:'<number>'` 是让
   `--lg-press` 可插值的前提。
2. **`var()` 是在「声明它的元素」上代入的。** 所以
   `--lg-a: calc(1 + var(--lg-press-boost) * var(--lg-press))` 必须声明在
   `.lg-base` 上（它从 `.app-tabbar` 继承到动画中的 `--lg-press`）；
   写进 `:root` 会把 `--lg-press` 固化成 0，增量永远传不进来。
3. **`transition` 不能写 `all`** —— `dock.js` 每帧都在写 `--lg-sq` / `--lg-sqy` /
   `--lg-so`，`all` 会把它们也拖进过渡。

alpha 反馈是**颜色不是动效**，所以 `prefers-reduced-motion` 下只把
`transform` 关掉、alpha 照涨。

### 边缘水滴折射：把 bar 的折射带从 lens 里拆出来

`CFG.barBand`（原与 lens 共用 `band: 8`）独立成 13，`CFG.barScale` 6 → 9。
`makeDisplacementMap` 的位移上限是 `scale/2`，所以「增强边缘」是
**加带宽 + 加位移上限**两件事一起，只调一个看不出差别。

### 发现图标换汉堡

同一段 `<circle cx="11" cy="11" r="7"/><path d="m20 2-3.2-3.2"/>`（放大镜）在
`js/common.js` 里出现**恰好两处**：`UI.tabbar` 的 `TABS`（主 tabbar）与
`SIDEBAR_TABS`（Pura 侧边栏），都换成 `<path d="M4 7h16M4 12h16M4 17h16"/>`。
`home.html:89` 那个放大镜是搜索框，不是导航项 —— 别顺手改了。

### Pura 收起态：Dock 被 `flex:1` 拉满

短屏（≤720px 高）进 Pura 模式后，app.css 给 `.app-tabbar` 的是 `margin:0;width:100%`，
Dock 于是从 220 被拉到整条外壳宽（390×700 收起态实测 306）。补一条
`.phone.has-pura-sidebar.sidebar-collapsed` 下的定宽 + `margin-left:auto`，
与常规态同一条 220 规则。

`verify.js` 量的是**真实的两种 Pura 状态**（靠 localStorage 驱动），不是合成态：

| 状态 | 断言 |
| --- | --- |
| 展开 | 外壳仍是 `display:none`、`barW=0` —— 本方案不制造无中生有的 Dock |
| 收起 390×700 | Dock 220、间距 8、球 326–378 **与基线逐项一致** |
| 收起 900×700 | Dock 220、簇右缘贴壳右缘 |

> 旧版这条断言是反的：它给 ≤720px 的两条视口统一注入
> `.phone.has-pura-sidebar .app-nav-shell{ display:flex !important }`，
> 量到的是「侧边栏展开、外壳却被强行显示」这个**现实中不存在**的 310px 状态，
> 然后断言「Dock 仍铺满内容区」。那等于把「Pura 下 Dock 被拉开」这个 bug
> 锁进了测试里 —— 改完还是 PASS。

## 测量陷阱（这一轮踩到的）

### 1. 采样太慢会伪装成「离散跳变」

`page.evaluate` / `page.screenshot` 一次往返几十到几百毫秒，比 220ms 的过渡还长，
于是每帧读到的都是终值，看着像离散跳变。**采样循环要放进页面里用 rAF 连采**，
往返延迟才归零。另外有个不依赖计时的判据：注册过 `@property` 的属性按下时会生成
`CSSTransition`，`document.getAnimations()` 直接能读到
`{prop:'--lg-press', dur:220, play:'running'}`；没注册的压根不建，值直接跳。

实测逐帧：`--lg-press` `0.01 0.19 0.71 0.81 0.93 0.96 0.98 0.99 1.00`；
`transform` `1.0069 1.0161 1.0209 1.0210 1.0204 … 1.0200` —— 冲到 1.0209 再回落，
正是 `cubic-bezier(.34,1.4,.64,1)` 里 1.4 那个回弹控制点。

### 2. localStorage 会跨 page 串味

同一个浏览器里各 `page` 共享 localStorage。先跑一轮深色，后面的「浅色」组就全继承
成深色 —— 出图时看着「也对」，实际整组作废；A/B 更阴：两边一起错，差异照样为零，
断言全绿而结论全错。现在 `verify.js` 的 `read()` 与 `shots-press.js` 都**显式写死**
`engchain-theme`，并且断言八次取样确实都在 `light`。

### 3. `getBoundingClientRect()` 会被 transform 污染

按下缩放 1.02 之后，`getBoundingClientRect()` 比布局值大 2%。两处必须先换成
布局值，否则都在算错的数上做正确的事：

- `dock.js` 的 `refreshFilters()` + `ResizeObserver` 的 key —— 用 rect 的话，
  每次按下/松手都会改变 key，于是每次按下都重建两张位移图（含
  `canvas.toDataURL()`）。
- `common.js` 的 `measure()` —— 它算出的值会被写进 `translateX` / `width`，
  而那是**已经缩放**的元素内部的坐标，透镜会偏最多约 3px。

`offsetLeft` / `offsetWidth` / `offsetHeight` 是纯布局值，不受 transform 影响。

> 顺带纠正一条旧的错误注释：dock.css 里曾写「祖先元素带 transform 会切断
> backdrop 采样」。实测不成立 —— 基线 93.9% 像素变化，scale 加在 `.app-tabbar`
> 上 94.5%，加在子层上 94.8%，采样都是活的。（`.app-tabbar` 本就是
> `position:relative`，加 transform 也不改变包含块。）

## 回退

```bash
python artifacts/tabbar-redesign/lg/apply-demo.py --revert   # 删掉那 2 行，不留痕
```

（`--revert` 作用于 `PAGES` 里的 8 页；`--check` 只报告状态不写盘。）

**不要用 `git checkout -- <页面>` 回退**：`pages/profile/index.html` 本来就有一处
与本次无关的已暂存改动（KPI 四格改为按身份动态渲染），checkout 会把它一起冲掉。

## 验证

```bash
python artifacts/tabbar-redesign/lg/sync.py         # 先同步
node   artifacts/tabbar-redesign/lg/verify.js       # 功能 / 降级 / 球禁改回归（34 项）
node   artifacts/tabbar-redesign/lg/verify-pages.js # 8 页生效 + 4 页确认未挂（37 项）
node   artifacts/tabbar-redesign/lg/shot-demo.js    # 真页面实拍（浅/深/滚动），出对照页
python artifacts/tabbar-redesign/lg/eol-audit.py    # 插入有没有夹带其它字节改动

# 按下 / 更透 / Pura 宽度（见「需求 2/3/4」一节）
node   artifacts/tabbar-redesign/lg/probe-press3.js # 插值轨迹 + alpha + 减少动效，出图
node   artifacts/tabbar-redesign/lg/shots-press.js  # 亮/暗 × 静置/按下 同裁剪四连图
node   artifacts/tabbar-redesign/lg/probe-pura.js   # Pura 两种状态的真实几何

# app.css 死代码清理的前后比对（见上节）
node   artifacts/tabbar-redesign/lg/dockstyle.js before|after
node   artifacts/tabbar-redesign/lg/diff-style.js _style/before.json _style/after.json
node   artifacts/tabbar-redesign/lg/dockpix.js   before|after   # 像素旁证
```

跑之前需要一个静态服务器：`http://127.0.0.1:8765/` 指向仓库根。

### 「球没被动过」是怎么被证明的

右侧 AI 球是禁改项。它的位置锚点是 `app.css` 给 `.app-nav-shell` 的
`height:60px` + `right:12px`，所以本方案一个字节都不碰外壳的定位与尺寸。

但「没碰外壳」只是设计意图，验证不靠这个说法：

- **A/B 基线不再依赖一份未改动副本。** 测试页已废弃，改为同一个 URL 跑两遍，
  一遍放行 `liquid-dock.*`，一遍用请求拦截掐掉 —— 掐掉那次就是改动前的页面。
  两边逐项比对球的宽/高/左/右/圆心偏移/display。
- **基线会自证。** 拦截若没生效，「改前」列会等于「改后」列，看起来像「尺寸没变」。
  所以断言基线里必须**没有** `.lg-base`、**没有** `--lg-h`，否则直接判 FAIL。
- 另外还有一条可证明的几何约束：Dock 定宽 + `margin-left:auto`
  ⇒ 球的左边缘恒为「外壳右 − 60」，与 `--lg-orb-gap` 取几像素无关。
  所以调间距只可能移动 Dock，物理上带不动球。

## 行尾那件事（重要）

`core.autocrlf=true` 让 git 把 CRLF 与 LF 当成同一个东西，所以「整份文件的行尾
被换掉」在 `git diff` / `git status` 里**完全不可见**，看着永远只是干净的两行插入。

`apply-demo.py` 第一版就栽在这里：用 `io.open(..., "r")` 读（通用换行把 `\r\n`
折成 `\n`）再配 `newline=""` 写回，12 页里有 5 页原本是 CRLF 为主，被静默拍成 LF。
现在全程按 **bytes** 处理、插入用的换行从文件自己身上取，并且写盘前会先自证
「摘掉插入的两行后必须与原始字节逐字节相等」，不相等就拒绝写盘。

`eol-audit.py` 是事后取证工具，原理：`.git/index` 为每个文件缓存了上次写入时的
**工作区字节数**；若内容没变（A 检查能证明），那么「缓存字节数 − blob 字节数」
只可能来自行尾 —— 全 CRLF 等于行数，全 LF 为 0，中间值就是混合行尾里 CRLF 的行数。
这是唯一能在事后判断「原来是什么行尾」的手段，**必须在跑 `git status` / `git diff`
之前跑**（它们可能刷新这份缓存）。

## 目录里的其它脚本

`metrics.js`、`layers.js`、`look.js`、`shoot.js`、`flicker.js`、`trans.js`、
`glcheck.js`、`idle.js`、`compare.js`、`spacing.js`、`preview-gap.js`、
`shot-final.js`、`probe.js`、`probe2.js`、`probe-cluster.js`、`probe-press.js`、
`probe-press2.js`、`compare-size.js`、`_diag.js` 是**更早期**的过程性测量工具，
**都还指向已废弃的 `home-liquidglass.html`**，直接用会打不开页面。

较新的这几个已经指向 `home.html`，可以直接跑：`probe-press3.js`、
`shots-press.js`、`probe-pura.js`、`probe-backdrop.js`。按用途挑：

| 要量什么 | 用哪个 |
| --- | --- |
| 按下的插值轨迹 / alpha / 减少动效 | `probe-press3.js` |
| 亮暗 × 静置按下的同裁剪对照图 | `shots-press.js` |
| Pura 展开/收起 / 侧栏左右的真实几何 | `probe-pura.js` |
| `backdrop-filter` 采样有没有被切断 | `probe-backdrop.js` |

`build.py` 已停用（打印说明并退出）。`home-liquidglass.html`（旧的独立测试页）已于
2026-09-17 删除 —— 它是 `AM` 状态、**从未提交**，所以 `git log` / `git checkout` 都找不回。
删前已把当时的工作区内容存成 blob `717ee370730f44cbabaec941b59301c9903a0f96`，
在 git gc 之前可以这样取回：`git cat-file -p 717ee37 > home-liquidglass.html`。
