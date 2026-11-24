# 迷雾工具箱 · app

自用的《黎明杀机》中文工具站。移动端优先，部署 Cloudflare Pages。

方案文档：`../docs/dbd-tool-site-plan.md`
设计稿：`../design/ui-draft-v9-final.html`
渲染截图：`../design/renders/`

## 跑起来

```bash
npm install
npm run dev         # http://localhost:5173
```

Vite 配了 `host: true`，手机连同一局域网可用 `http://<电脑IP>:5173` 真机调试。

```bash
npm run typecheck   # tsc --noEmit
npm test            # 检索逻辑单测（13 个用例，含全部 99 个角色自检 + 多选筛选 AND）
npm run build       # 产物在 dist/
npm run preview     # 预览构建产物
npm run verify      # 产物自检（引用完整性 / 数据自洽 / 体积），build 之后跑

npm run import      # 重新导入全量数据 + 图标（图标自动转 WebP）
npm run import:no-icons   # 只导文本
npm run import:portraits  # 只导角色头像
npm run to:webp     # 存量 PNG → WebP 迁移（一次性，可重复跑）
```

> 本机三个坑：`npm.ps1` 被执行策略拦，要用 `npm.cmd`；
> npm 默认缓存目录在工作区外会被沙箱拒绝，需 `$env:npm_config_cache = "$PWD\.npm-cache"`；
> Node 测试跑器 spawn 子进程会 EPERM，必须带 `--test-isolation=none`。

## 数据从哪来（重要）

| 内容 | 来源 | 授权 |
|---|---|---|
| 技能 / 配件的**中文文本、稀有度、归属** | [迷雾笔记 dbdwiki.com](https://dbdwiki.com) 的公开 JSON | **CC BY-NC-SA 4.0** |
| **图标**（1201 个）与**角色头像**（97 个） | [deadbydaylight.wiki.gg](https://deadbydaylight.wiki.gg) | 游戏素材，权利归 Behaviour |

**为什么不用 wiki.gg 的数据表**：wiki.gg 只有 de/es/fr/it/pl，**没有中文**，
`Module:Datatable` 全英文。中文内容只能另找来源。

**CC BY-NC-SA 4.0 的约束（必须遵守）**：
- **NC 非商业** —— 不挂广告、不收赞助、不做付费内容
- **BY 署名** —— 站点底部信息区已固定署名 + 协议链接，别删
- **SA 相同方式共享** —— 衍生整理也要用同样协议

## 结构

```
scripts/
├─ import-dbd.mjs        主导入：文本数据 + 图标下载（下载即转 WebP）
├─ import-portraits.mjs  角色头像（走英文名 + wiki 重定向），同样直接产出 WebP
├─ crop-frames.mjs       裁掉卡片框的透明留白，输出无损 WebP
├─ to-webp.mjs           存量 PNG → WebP 迁移 + 数据路径改写（一次性/可重复）
├─ verify-assets.mjs     产物自检（引用完整性 / 数据自洽 / 体积）
└─ assets/card-source/   **构建期素材**（3 张 wiki 背景 webp），不参与部署

src/
├─ main.tsx            路由（hash）+ 挂载
├─ types.ts            Entry / Owner 类型与展示常量
├─ data/api.ts          数据加载（内存缓存 + SPA 回退兜底）
├─ lib/search.ts        中文名 / 英文名 / 全拼 / 首字母匹配 + 多选筛选 AND
├─ pages/Browse.tsx     角色总览 / 钻取 / 搜索 三种状态
├─ components/
│  ├─ TopBar.tsx        顶栏（含返回与搜索）+ 底部 2 Tab
│  ├─ CharacterGrid.tsx 6 列角色卡（复刻 wiki 名册的四层结构），无名字
│  ├─ Section.tsx       一个分区（技能 / 配件）
│  ├─ DetailSheet.tsx   可拖拽底部抽屉
│  ├─ SearchBar.tsx     搜索态顶栏
│  └─ Icons.tsx         UI 图标 + 无图时的占位形状
└─ styles/
   ├─ tokens.css        设计令牌（颜色/尺寸唯一来源）
   └─ app.css           组件样式

public/
├─ _redirects           Cloudflare Pages：SPA 回退
├─ _headers             三档缓存策略（见「部署」一节）
├─ data/                导入产物（owners / perks / addons / addons-index）
├─ icons/               1201 个条目图标（128px，WebP）
├─ icons/chars/         97 个角色抠图（200×200，WebP）
└─ icons/card/          卡片框（198×241，无损 WebP）
```

> `scripts/assets/card-source/` 里的三张背景 webp 只用来烘焙卡片框。
> 它们曾经躺在 `public/icons/card/` 里，导致每次部署都白带 460KB —— 别再放回去。

## 数据形态

```
public/data/
├─ owners.json                    99 位角色，含 counts / pinyin / initials / avatar
├─ perks/{killer,survivor}.json   该阵营全部技能
├─ addons/{ownerId}.json          单个屠夫的配件（45 个文件）
└─ addons-index.json              881 条配件的轻量检索索引（不含描述）
```

分包实测：`owners.json` 17.7KB、`perks/killer` 82.3KB、`perks/survivor` 98KB、
单个屠夫配件约 10KB。角色总览只需 owners.json。

### 跨角色搜索为什么要有 `addons-index.json`

配件按角色分包，总览里跨角色搜配件时不可能去下载 44 个分包（合计 **471KB**）。
所以构建期额外产出一份轻量索引（881 条，**316KB → gzip 97.4KB**），
在总览**第一次打开搜索**时按需加载一次。

索引字段：`id / ownerId / title / rarity / icon / pinyin / initials / text`。
其中 `text` 是该条目描述正文去掉标点后的纯文本，用来支持**按效果搜索**
（输入「疲劳」「无法侦测」「发电机」等能命中提到该效果的条目）。

技能不需要索引 —— 它们本来就按阵营整份加载（`perks/{side}.json`），
描述正文在客户端用 `normText()` 现算一次并缓存（`perkTextById`）。

**体积取舍**：曾对比过「只在索引里存 34 个效果词的倒排」（gzip 仅 7.6KB），
但它只能搜固定词表；选了体积大 90KB 的全文方案，换来「任意效果词都能搜」。

**结果截断**：搜「逃生者」这类泛词会命中几百条，跨角色结果一次最多渲染 60 条，
超出时在底部提示「还有 N 条未显示」。

### 快捷筛选 chip（`FILTER_TERMS`）

搜索框下方一排 **18 个效果词**，**可多选**：点一下选中，再点一下取消。

- **多选是 AND（同时满足）**，不是「或」。例：同时选 `无法侦测` + `图腾`
  → 只剩 2 条：厄咒：毁灭序曲、秘密项目。
- chip 与输入框关键词也是 AND：关键词还管名字/拼音，chip 只管效果正文。
- 一旦选了 chip，结果区**只列条目（技能/配件）、不列角色** ——
  角色没有效果正文，硬筛会把 44 个杀手全铺在前面，真正想找的技能被挤到几屏之后。
- chip 已选中的状态用 `aria-pressed` + 高亮描边/底色表示，不额外加计数。
  **选中态刻意不加粗**：加粗会让 chip 自身变宽，换行布局下会把刚点的那个词挤到下一行。

词表按**实测命中量从高到低**排序（构建期用真实数据统计的技能+配件命中总数）：

| 词 | 命中 | 词 | 命中 | 词 | 命中 |
|---|---|---|---|---|---|
| 气场 | 276 | 急速 | 57 | 血祭品 | 23 |
| 发电机 | 127 | 图腾 | 46 | 出口大门 | 22 |
| 治疗 | 99 | 翻越 | 45 | 致盲 | 13 |
| 恐惧范围 | 98 | 疲劳 | 43 | 恩赐 | 8 |
| 受伤 | 76 | 无法侦测 | 43 | | |
| 破坏 | 63 | 钩住 | 42 | | |
| | | 钩子 | 29 | | |
| | | 厄咒 | 24 | | |

杀手/人类分侧命中数（`killer / survivor / addons`）差异很大，例如：
`气场 48/71/157`、`图腾 25/21/0`、`无法侦测 11/0/32`、`厄咒 22/2/0`、`恩赐 2/6/0`。
配件那一列就是「人类页为什么没有 `无法侦测`」的原因 —— 那个词只在杀手侧有正文命中。

`钩子` 是 `天灾钩子` 的**上位词**：6 条天灾钩子技能的标题里都带「钩子」，
所以用 `钩子` 一次覆盖天灾钩子系列 + 普通钩子相关（29 条 vs 7 条）。
它和 `钩住` 也不冗余 —— 杀手侧 `钩住` 28 条、`钩子` 10 条，重合只有 4 条。

**人类页会自动隐藏 0 命中的词**（目前只有「无法侦测」：人类技能 0 条）。
判定用的是当前阵营已加载的技能描述，不依赖配件索引，所以不会出现「先隐藏后突然出现」。
切阵营时已选中但新阵营不可用的词会被自动剔除（词表为空 = 还在加载 → 不剪，避免误清空）。

**刻意没放进词表的**：

- `修理`、`冷却` —— 支配它们的其实是别的东西：修理基本被 `发电机` 覆盖，
  冷却 121 条里绝大多数是配件且语义太窄，收益低于占位成本。
- `柜子`、`一触即死`、`加速`、`献祭`、`地道`、`坚忍` —— 实测各只命中 0~3 条，放进去点了基本是空结果，只会误导。

chip 行是**自适应换行**（`flex-wrap: wrap`），不用横向滚动：18 个词在 360px 宽下
一排约放 5 个，排成 **5 + 5 + 5 + 3 四行**，整块高约 **131px**。
行距 6px 比列距 7px 略小，看起来更像一整块词云而不是散开的行。
索引里的 `id` 必须和分包条目一致，否则「点搜索结果 → 落地后自动打开抽屉」
的 focus 查找会失败。构建脚本里对 `addon:` 前缀做了幂等处理（源 id 已带前缀）。

### 滚动位置的复位规则

`.main` 是唯一的滚动容器，总览/钻取/搜索结果都在它里面滚，所以三件事必须分开管：

| 场景 | 行为 |
|---|---|
| 打开搜索 | 主区**回到顶部**（先把当前位置存进 `beforeSearchScroll`） |
| 关闭搜索 | 回到打开搜索之前的位置，不丢浏览进度 |
| 切换阵营 | 回到顶部，并清掉该阵营记住的位置 |
| 进入角色（钻取） | 回到顶部 |
| 返回总览 | 恢复该阵营上次的位置 |

两个坑：

- 搜索态滚动的是**结果列表**，所以 `handleScroll` 在 `searchOpen` 时直接 return，
  否则会把结果列表的滚动位置写进「总览记住的位置」，返回总览时落到奇怪的地方。
- 路由变化时要把 `beforeSearchScroll` 清零。否则「关闭搜索后还原」会和
  「进入角色回到顶部 / 返回总览恢复位置」抢同一帧，把滚动位置设回上一个搜索会话的值。

### 从搜索页点进角色，返回时要回到搜索页

路由一变就会清空搜索态（`setQuery('')` / `setActiveChips([])` / `setSearchOpen(false)`），
所以「搜了内容 → 点进某个角色 → 返回」原本会落到一个空的总览。现在用一个 ref 记住：

| 场景 | 行为 |
|---|---|
| 搜索（有关键词或筛选词）→ 点角色 → 返回 | **回到搜索页**，关键词与筛选词都在 |
| 搜索（空）→ 点角色 → 返回 | 普通总览（没有内容可还原） |
| 总览 → 点角色 → 返回 | 普通总览，滚动位置还原 |
| 搜索 → 切换阵营 | 搜索态与记忆一起清空（搜索词是按阵营算的） |
| 深链 / 刷新到角色页 → 返回 | 退回该阵营总览 |

三个实现要点：

- **记忆只还原一次**（还原后立刻置 null）。否则之后任何一次「从角色页返回」
  都会莫名其妙回到上一次的搜索结果。
- **还原时不自动聚焦输入框**。`SearchBar` 的 `autoFocus` 由 `searchAutoFocus`
  控制：还原时为 `false`，用户主动点搜索按钮时为 `true` ——
  否则一返回手机就弹起键盘，直接挡住半屏结果。
- **返回键走 `history.back()` 而不是重新 `navigate`**（`arrivedFromOverview` ref 判定）。
  否则「搜索 → 角色 → 返回」会压进一条新历史，再按一次系统返回又回到刚才那个角色页。
  直接深链进来（没得 back）才退回总览。

## 图片资源：全部转 WebP，分三档参数

wiki 只提供 PNG，1300 张透明图合计 **20.7MB**。杀手总览一次要拉 45 张人像
（PNG 平均 48.9KB → 单页 **2.2MB**），这是首屏最贵的一笔开销。

现在全部落盘 WebP，合计 **12.5MB**；但**三档素材用的编码参数不同**，
因为踩过的坑完全不同 —— 随便统一成一个档位就会出问题：

| 素材 | 数量 | 参数 | 相对 PNG | 实测差异（只统计 alpha≥16 的可见像素） |
|---|---|---|---|---|
| 条目图标 128px | 1201 | `nearLossless` | −28% | 最大色差 **2** |
| 角色抠图 200px | 97 | `nearLossless` | −63% | 最大色差 **2** |
| 卡片框 198×241 | 2 | `lossless` | −41% | **0**（解码后逐字节一致） |

**为什么都不用普通有损（q92）**：实测过，两个独立的原因 ——

- **角色抠图**：q92 平均色差 5.6、最大 117；换 4:4:4 不采样只到 5.5，提到 q95 还有 5.0。
  都是能看出来的糊边。nearLossless 直接把最大色差压到 2。
- **条目图标**：q92 最大色差 10（比 nearLossless 差 5 倍），体积反而**更大** ——
  `bloodyCoil` q92 11.7KB vs nearLossless 8.0KB。平面色块 + 硬边的游戏图标经不起色度采样，
  有损档白丢质量还没换来体积。
- **卡片框**：大面积平滑渐变，q92 在暗底上能看出色带，所以走无损。

**两个测量陷阱**（写在这里免得下次再踩）：

1. **必须排除 alpha<16 的透明像素**。透明区的 RGB 是未定义值，
   直接逐像素比会得到「最大色差 255」这种假报警，把结论带偏。
2. **在原始尺寸上比，比在显示尺寸上比更可靠**。缩放插值会把差异重新摊开，
   算出「92% 的像素都不同」这种没有指导意义的数字。

编码参数这三个地方必须一致，否则「重新导入」和「存量转换」的产物质量会不一样：

- `scripts/import-dbd.mjs` 的 `WEBP_OPTIONS`（条目图标）
- `scripts/import-portraits.mjs` 的 `WEBP_OPTIONS`（角色抠图）
- `scripts/to-webp.mjs` 的 `ICON_WEBP` / `PORTRAIT_WEBP` / `LOSSLESS`（按路径分档）

`npm run to:webp` 是存量迁移脚本：转码 → 校验尺寸与透明通道没丢 → 改写 `public/data`
里的 `.png` 引用 → 核对每个引用都能找到文件 → 删掉原 PNG。
先跑 `--keep` 留一份 PNG 对照，确认没问题再跑一次（不带 `--keep`）只删 PNG。

## 当前进度

**W1 + W2 + W3 完成**

- [x] 项目骨架（Vite 8 + React 19 + TS 5.9）
- [x] 设计令牌 + 移动端基线（dvh / 安全区 / 颗粒 / 对称暗角）
- [x] 角色总览：**6 列竖长方形角色卡**（127:150），wiki 名册的四层结构（阴影/底/阵营色/抠图）
- [x] 头像保留原始正方形画布，固定宽度等比缩放（与 wiki 观感一致、大小统一、不裁切）
- [x] **iOS 安全**：阵营色在构建期烘焙成静态图，运行时零 CSS filter
- [x] 阵营色：杀手红底、求生者蓝底（与 wiki 同一套 `hue-rotate` 参数）
- [x] 钻取：技能（**菱形 + 1px `#612770` 边框**）+ 配件（**正方形 + 四边框稀有度色**），两者描边粗细一致
- [x] 图标尺寸：技能裁菱形顶满整框、配件 84%（与详情头部一致）
- [x] 搜索结果的图标全部换成真图（角色复用卡片图层、条目用 icon + 稀有度边框）
- [x] 「通用」用专属标记区分杀手（钩子）/ 人类（逃生者剪影），不再显示汉字
- [x] 稀有度配色对齐迷雾笔记（普通/精良/稀有/非常稀有/非凡）
- [x] 底部抽屉：Pointer Events 拖拽、下滑 90px 关闭、滚动锁定
- [x] 滚动位置：打开搜索回顶部、关闭搜索还原、切阵营回顶部、返回总览恢复位置
- [x] 搜索：中文名 / 英文名 / 拼音全拼 / 首字母
- [x] **总览可跨角色搜技能/配件**：结果带归属角色，点击直达并自动打开该条目的抽屉
- [x] **支持按效果搜索**：输入「疲劳」「无法侦测」「发电机」等，命中描述正文里提到该效果的技能与配件
- [x] **搜索框下方 18 个快捷筛选chip，可多选（AND 同时满足）**，按命中量排序，按当前阵营自动隐藏 0 命中的词
- [x] 角色卡按下只做轻微收缩（`scale .95`，0.16s）；**没有红色高亮**（长按时红框会一直挂着，与选中态混淆，已移除）
- [x] **真实数据**：324 条技能（含迈尔斯补齐的 3 条 = 148 + 176）+ 881 个配件 + 99 位角色
- [x] **真实图标**：1201 个条目图标 + **97 个角色抠图（100% 来自首页名册，无一降级）**
- [x] 构建：JS gzip **104.7KB**（预算 150KB）

**优化轮（W3 之后、W4 之前）**

- [x] **图片全部转 WebP**：20.69MB → **10.25MB**，且分三档参数（图标/人像 nearLossless、卡片框无损）
- [x] 卡片框三张构建期源图移出 `public/`，部署不再白带 467KB
- [x] 新增 `public/_headers`：`/assets` 长缓存 immutable、`/icons` 7 天、`/data` 10 分钟
- [x] 删掉 `gen-seed-data.mjs` —— 它会往 `public/data` 写同路径的种子数据，一条命令就能覆盖真实数据
- [x] 搜索：去掉每次按键对 881 条正文重复跑 `normText`（构建期已归一化）
- [x] 搜索：`crossHits` 与 `crossHitTotal` 合并成一次遍历
- [x] 导入脚本：下载即转 WebP，路径与落盘扩展名统一由 `iconPath()` 决定，不会翻回 `.png`
- [x] 新增 `npm run verify`：引用完整性 / 数据自洽 / 体积自检
- [x] 产物 **21.96MB → 11.54MB**；首次打开杀手总览 ≈ **1.1MB**（原 ~2.9MB），杀手详情页 ≈ 0.54MB

## 已知数据缺口

**迈克尔·迈尔斯的 3 个技能已补齐（版权到期转为通用）**。
源数据把他这三个技能归到了「通用」，导致他的技能分区是空的。
现在 `scripts/import-dbd.mjs` 里的 `OWNER_PERK_ALIASES` 会把
**留到最后 / 玩弄掌间 / 优胜劣汰** 复制一份挂回他身上：
既保留它们在通用里的存在（现在所有杀手都能用），也让迈尔斯页面完整。
杀手技能总数因此是 **148**（16 通用 + 43×3 + 迈尔斯 3）。

**「通用」有 1 个配件**（枯萎血清，黎明鬼祟活动期间所有杀手可用）。
源数据确实有这一条，和早期「通用无配件」的假设不同，保留。

## 网页端适配（≥900px）

移动端是基准，**所有桌面规则都锁在 `@media (min-width: 900px)` 和
`@media (hover: hover) and (pointer: fine)` 里**，手机上的表现一个像素都不变。
断点选 900px 的理由：iPhone 横屏 844px、iPad 竖屏 820px 都还走移动端布局，
iPad 横屏 1180px 才切桌面。

| 项目 | 移动端 | 桌面端 |
|---|---|---|
| 容器 | 满宽 | `max-width: min(1360px, 100% - 64px)` 居中，两侧至少留 32px |
| 两侧 gutter | — | 两层血色光晕 + 1px 骨白「发光接缝」，见下 |
| 角色网格 | 固定 6 列 | 900~1279px 自适应（7~11 列）；**≥1280px 锁定 12 列** |
| 技能网格 | `auto-fit minmax(68px)`，3 条自动撑满一行 | 固定 104px 列宽 + 左对齐 |
| 配件网格 | 固定 5 列 | `auto-fill minmax(96px, 1fr)` |
| 结果列表 | 满宽 | `max-width: 760px` 居中 |
| 底部 Tab | 两个 Tab 各占一半 | 收成居中一组（`min-width: 128px`） |
| 抽屉 | 满宽贴底 | `max-width: 640px` 居中卡片，仍从底部滑入 |
| 底部信息 | 跟在角色网格后面 | 内容不满一屏时用 `margin-top: auto` **贴到容器下沿** |
| 字号 | 13.5px 正文 | 14.5px 正文 / 19px 顶栏标题 |
| 焦点 | — | `:focus-visible` 红色描边（触摸不会触发，对手机无影响） |
| 悬停 | — | 卡片描边、图标格上浮 2px、行底色、链接变亮 |

**两侧 gutter 的处理**（大屏上不想要两条纯黑）：

1. `body` 叠两层极淡的 `radial-gradient`（顶部冷色天光 + 中栏血色反光），
   `background-attachment: fixed`。中栏背景不透明，所以这两层只在中栏**之外**可见。
2. `.app` 加四层 `box-shadow`：两圈血色模糊（120px / 36px）贴着栏边往外散，
   外加 `1px 0` / `-1px 0` 两圈零模糊的骨白，形成一条「被打亮的接缝」。
   偏移阴影的好处是**与视口宽度无关**，任何屏幕上都正好贴着栏边。

实测（1920px 视口，模拟叠加结果）：紧贴栏边约 `rgb(40,14,15)`，
向外 96px 处已衰减到 `rgb(15,7,9)`，160px 外基本回到底色 `rgb(6,6,8)`。
觉得光太强/太弱就调 `.app` 的 box-shadow 两个 alpha（0.14 / 0.09）。

**列数换算**（`min(1360px, 100% - 64px)` 容器，10px 列间距）：

| 视口 | 列数 | 栏宽 | 卡片 | 单侧 gutter |
|---|---|---|---|---|
| 1024 | 8 自适应 | 960 | 107px | 32px |
| 1180 | 10 自适应 | 1116 | 99px | 32px |
| 1280 | **12 锁定** | 1216 | 89px | 32px |
| 1440 | **12 锁定** | 1360 | 101px | 40px |
| 1920 | **12 锁定** | 1360 | 101px | 280px |
| 2560 | **12 锁定** | 1360 | 101px | 600px |

**踩过的五个点**：

- **技能网格不能用 `auto-fit`**。`auto-fit` 会折叠空轨道，3 条技能在桌面会被拉成
  各占 1/3 屏宽的巨幅菱形。桌面改用 `repeat(auto-fill, 104px)` 固定列宽。
- **12 列要单独钉死**。`auto-fill` 只能保证「至少 N 列」，具体几列随宽度浮动
  （同一台机器拉宽窗口会从 11 列跳成 12 列）。要「永远 12 列」得在 ≥1280px 用
  `repeat(12, minmax(0, 1fr))`，让宽度只影响格子大小。
- **`.sheet` 的桌面居中只能改 `max-width` / `margin-inline`**。
  拖拽关闭时 JS 会直接写 `style.transform`，在媒体查询里加 `transform`
  会在手指一动就被覆盖掉，抽屉会跳回满宽。
- 悬停用了 `:not(:active)`：否则鼠标按下时 hover 的上浮会盖掉 `.cell:active` 的缩放。
- **底部信息要贴底，必须给 `.main` 的每个子项写 `flex: none`**。
  只在 `.foot` 上写 `margin-top: auto` 而忘了这条，`.main` 变成 flex 容器后
  其余子项会被 flex 压缩（`.chargrid` 的行高会被挤扁）。

**已知取舍**：角色卡在被图源卡住 —— 人像源图只有 200×200，卡片头像按 124% 显示。
12 列下面卡片约 101px、头像约 125 CSS px，DPR1 桌面是缩小（很清晰），
DPR2 的 Retina 上会被放大 1.25 倍（略软）。要在 Retina 上更锐，
把 `scripts/import-portraits.mjs` 的 `iiurlwidth` 从 200 提到 300 重跑一遍即可
（人像总量会从 2.3MB 涨到约 4MB）。

## 角色卡片：单层烘焙底 + 竖长方形外框

wiki 首页 `<div class="dbd-main-character-roster">` 里每张卡原本是三张底图叠出来的
（`charPortraitShadowBG` + `charPortraitBg` + `charPortraitRoleBg`），底图本身是 250×250，
**实体卡片只占 x 25\~222 / y 5\~244（约 198×241，比例 0.822）**，四周全是透明留白。

所以做了两步：

1. **构建期把三层合成并染色**成静态图（`frame-killer.webp` / `frame-survivor.webp`）
2. **裁掉透明留白**（`scripts/crop-frames.mjs`）→ 198×241，卡片正好填满格子

> `crop-frames.mjs` 的输入必须是 **headless Chrome 直接烘焙出来的原图**，
> 而且只做一次 `extract`。别用「合成到新画布」的方式重建原图来测试 ——
> 合成会做 alpha 预乘，半透明的柔和阴影被舍入一次就回不来了（实测文件从 34.8KB 掉到 17.7KB，
> 掉的那一半正是阴影渐变）。

结果运行时只有**一个背景图层** `.char__frame`，`background-size: 100% 100%`，
`--char-ratio: 198 / 241`。

- **外框是竖长方形**（56×68px），6 列
- **头像保留 wiki 原始 512×512 正方形画布（不裁边）**，按固定宽度等比缩放，底部对齐：

```css
.char__av img {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 124%;
  height: auto;
  display: block;
}
```

**为什么用原始画布而不是裁到内容**：
裁边后各角色的内容宽高比从 0.67 到 1.03 不等，无论按固定宽还是固定高都必然导致大小不一；
而**保留统一的正方形画布 = 所有角色共享同一尺度**，这正是 wiki 名册看起来一致的原因。

**为什么 width 是 124%**：画布四周是透明留白（实测内容只占 **72.5% 宽 × 88% 高**），
所以可以让画布溢出格子、由 `.char__av` 的 `overflow: hidden` 裁掉，角色内容随之放大。
124% 是实测的安全上限（格子 56×68px）：

| width | 内容占卡片 | 最小余量(左/上/下) | 裁切 |
|---|---|---|---|
| 110% | 78% / 79% | 4.9 / 8.9 / 2.8 | 无 |
| **124%** | **88% / 90%** | **2.0 / 1.3 / 3.1** | **无** |
| 126% | 89% / 91% | 1.5 / 0.3 / 3.2 | 无（但头部只剩 0.3px 余量）|
| 128% | 91% / 93% | 1.1 / −0.8 / 3.2 | **16 个角色头部被切** |

- **杀手红底、求生者蓝底**（颜色已烘焙进图里）

### ⚠️ iOS Safari：运行时不能用 CSS 滤镜

wiki 的染色参数是 `sepia(1) saturate(30) hue-rotate(289.1deg) saturate(7) brightness(0.47)`
这种极端滤镜链，**iOS Safari 上会渲染异常** —— wiki 自己的 CSS 里就写着 `/* doesnt work :( */`。

所以全部改成**构建期烘焙**（用无头 Chrome 渲染成静态 PNG），运行时零 `filter`。
角色图的 `drop-shadow` 也去掉了。全站只剩 3 处 `backdrop-filter: blur()`（顶栏/底栏毛玻璃）。

两个烘焙用的临时页面在 `public/bake*.html`（用完即删），
底图源文件在 `scripts/assets/card-source/`（**不在 public 里**，避免被部署）。
重新烘焙的流程：三张底图叠加 → headless Chrome 截 250×250 → `npm run crop-frames` 裁成 198×241 无损 WebP。

**角色清单来自首页名册**，不是 `Category:Character Selection Icons`：
名册有 110 条（50 杀手 / 60 求生者）、100 个唯一图片，**覆盖全部角色包括最新的**
（`K41 TheKrasue` … `K45 TheTerrifier`、`S43 LaraCroft` … `S55 SiennaShaw`）。
分类里只有 76 个，最新那批完全没有 —— 这就是之前 21 位对不上的真正原因。

匹配结果：**97/97 全部命中**，无一位走降级。

## 稀有度配色：取自迷雾笔记

原来用的色是我按印象定的，和迷雾笔记差别很大（尤其精良、稀有）。
现在直接用他们的 `--detail-rarity-rgb` / `--detail-rarity-glow-rgb`：

| 稀有度 | rarityKey | base（文字/描边） | glow（2px 色条） |
|---|---|---|---|
| 普通 | `common` | `#69452C` | `#AE7C50` |
| 精良 | `uncommon` | `#3EB127` | `#88E65C` |
| 稀有 | `rare` | `#2E66B8` | `#699EEE` |
| 非常稀有 | `very-rare` | `#71228B` | `#C65DE0` |
| 非凡 | `visceral` | `#D11143` | `#FF4E75` |
| （活动） | `event` | `#D57C1F` | `#FFB843` |

深底上 2px 细线用 base 太暗，所以**色条用 glow 变体，详情里的文字/描边用 base**。

## 部署到 Cloudflare Pages

两条路，**自用推荐 A**（不需要建 Git 仓库，改完一条命令就上线）。

### A. 直接上传（wrangler）

**wrangler 不是项目依赖**（会让 `npm install` 多下 ~50MB，而云端 Git 构建根本不需要它），
所以走 `npx --yes wrangler@4` 按需拉取。三步，在 `app/` 目录下执行：

```powershell
npx wrangler login                 # 一次性：弹出浏览器，授权自己的 Cloudflare 账号
npm run build && npm run verify     # 门禁：verify 不通过就别传
npm run deploy                      # = npx --yes wrangler@4 pages deploy dist --project-name=dbd-tool
```

首次 `deploy` 会问要不要创建名为 `dbd-tool` 的项目（选 y），之后每次都是覆盖生产环境。
不想交互式授权就用 API Token：Dashboard 建一个带 *Cloudflare Pages:Edit* 权限的 token，
设好 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 两个环境变量即可免登录。

> ⚠️ 这三步**必须在普通终端里跑**。wrangler 依赖 esbuild，
> esbuild 需要 spawn 子进程，被受限沙箱（pipe stdio）挡住时会报 `spawn EPERM`。
> 同理 `wrangler dev` / `pages dev` 也跑不了 —— 本地验证请用 `npm run preview`。

### B. 连接 Git 仓库（想 push 自动部署再走这条）

- Framework preset: **Vite**
- Build command: `npm run build && npm run verify`
- Build output directory: `dist`
- Root directory: `app`（仓库根就是 app/ 则留空）
- 环境变量：`NODE_VERSION = 22`

> 注意：这个项目目前**不是 git 仓库**，走 B 之前得先 `git init` + 推到 GitHub。

### 私有化（强烈建议）

Dashboard → Zero Trust → Access → Applications → Add an application → Self-hosted，
域名填你 Pages 的地址，策略用 **One-time PIN + 只允许自己的邮箱**。
免费版 50 人以内够用。站点变成「只有我能打开」，素材版权暴露面直接归零。

### 两个元文件

`public/_redirects` —— SPA 回退：

```
/*    /index.html   200
```

注意它会把**不存在的 JSON 也回退成 index.html 并返回 200**。
所以 `src/data/api.ts` 不能只看 `res.ok`，必须先确认 `content-type` 含 `json`，
否则会把 HTML 当 JSON 解析然后炸掉。这个坑在 Vite dev 下同样存在。

`public/_headers` —— 三档缓存，按「内容变不变」分：

| 路径 | 缓存 | 依据 |
|---|---|---|
| `/assets/*` | `max-age=31536000, immutable` | Vite 产物，文件名带内容 hash |
| `/icons/*` | `max-age=604800` + `stale-while-revalidate` | 文件名来自 wiki（无 hash），只在重新导入时变 |
| `/data/*` | `max-age=600` + `stale-while-revalidate` | 重新导入会变，太短则每次打开都重下，太长则看不到新条目 |
| `/index.html` | `max-age=0, must-revalidate` | 避免部署后拿到旧壳配新 assets |

另外整站加了 `X-Robots-Tag: noindex`（个人自用，不需要被搜到）。

### 上线前自检

```bash
npm run build && npm run verify
```

`verify-assets.mjs` 会检查：每个 `/icons/` 引用都能在 dist 里找到真实文件、
CSS 里的 `url()` 都存在、没有 PNG 残留、配件索引条数与分包一致、
每个角色正好 3 个技能、部署元文件都在产物里，并打印各页面的首次加载体积。

### 上线后核查

```bash
npm run verify:deploy https://<你的域名>
```

`verify-deploy.mjs` 检查的是**线上行为**（本地 verify 无法覆盖的部分）：
`_headers` 里的四档缓存是否真的生效、manifest 是否可解析、不存在的 JSON 返回什么、
`_headers`/`_redirects` 有没有被公开暴露、抽样图片能否取到。

> 若网络访问 `*.workers.dev` 需要代理，Node 要显式开代理支持：
> `$env:NODE_USE_ENV_PROXY="1"; $env:HTTPS_PROXY="http://127.0.0.1:7897"`

### ⚠️ 部署成 Worker 时的一个大坑

本项目部署为 **Worker**（域名形如 `xxx.workers.dev`），不是 Pages。
`wrangler.toml` 里必须用 **`[assets] directory`** 声明静态资源目录：

```toml
[assets]
directory = "./dist"
```

如果误写成 Pages 专用的 `pages_build_output_dir = "dist"`，Worker 的 `wrangler deploy`
不认这个键、又没有 `main`，就会**把项目目录整个当静态资源传上去**。后果：

- 线上可以下载到 `/src/main.tsx`、`/package.json`、`/wrangler.toml`
- 首页返回的是**未构建的源码 `index.html`**（引用 `/src/main.tsx`），浏览器白屏
- 所有 `/assets/*`、`/data/*`、`/icons/*` 全部 404

`verify-deploy.mjs` 的第 [3] 项（入口 JS/CSS 是否存在）就是为了第一时间抓到这个。

### 真机打磨清单（W4，需要在手机上逐条过）

| # | 检查项 | 期望 |
|---|---|---|
| 1 | 首次冷启动（清缓存）开杀手总览 | ≈1.1MB，4G 下 2 秒内出图 |
| 2 | 从列表点进某个杀手 | 抽屉不闪、图标全部加载 |
| 3 | 搜索里连打 3~4 个字 | 无卡顿（重点验「气场」这种大词） |
| 4 | 多选 2 个筛选词（如 图腾 + 无法侦测） | 结果收敛到 2 条，点进去能自动打开抽屉 |
| 5 | 打开搜索 / 关闭搜索 | 主区先回顶部，关掉后回到原来的滚动位置 |
| 6 | 角色卡长按 | **没有红框**、不弹「存储图像」动作单 |
| 7 | 抽屉下滑 90px | 关闭；上滑不关 |
| 8 | 切到人类 Tab 再切回 | 回到顶部，已选的 `无法侦测` 被自动剔除 |
| 9 | iPhone 刘海屏 / 灵动岛 | 顶栏不压状态栏，底部 Tab 不压 Home 指示条 |
| 10 | 搜索框聚焦 | 页面**不放大**（`font-size: 16px` 保证的） |
| 11 | 系统开「减弱动态效果」 | 所有过渡基本消失 |
| 12 | 断网后重开 | 有 HTTP 缓存的页面仍能显示（`/icons` 7 天、`/data` 10 分钟） |

窄屏（≤375px）下 6 列卡片约 54px 宽。如果真机上觉得挤，
把 `tokens.css` 的 `--cols-char` 降到 5 即可（一改全站跟着变）。

**合规**：底部信息区（`src/components/Footer.tsx`）必须保留 ——
它承担 CC BY-NC-SA 的 **BY 署名**（含指向协议文本的链接）和「非官方、非商业」声明，
不挂广告、不接第三方统计。落款行右侧另有「联系作者」入口指向作者 B 站主页。
为控制行数，说明已合并成一段（约 2~3 行）+ 一行落款；
落款行是 `更新于 2026-11-24 · [icon] 联系作者`，**与说明段一样靠左**，别再拆成多组小节。
建议再开 Cloudflare Access（免费版）给整站加邮箱验证 —— 站点私有能显著降低素材版权风险。
