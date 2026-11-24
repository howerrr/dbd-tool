# 迷雾工具箱 · 项目方案 v2

> 定位：**自用的《黎明杀机》中文数据库工具站**，移动端优先，部署于 GitHub Pages。
> 本文档取代 v1（v1 的四个板块 + 收藏功能已废弃，见 §10 变更表）。
> 设计稿：`design/ui-draft-v4.html`（可交互，已定稿令牌与形态）

---

## 0. 三条前提

**① 自用 → 不需要 SEO → 不需要 SSG。**
Vite + React 纯 SPA 就够，不引 Next.js。

**② 自用 ≠ 可以粗糙。**
你就是唯一用户，触控、白屏、卡顿会每天恶心你一次。移动端体验是唯一不能妥协的部分。

**③ 真正的工作量在数据，不在代码。**
UI 一周能写完，880 个配件录不完。所以架构必须「按角色分包、按需补齐」。

---

## 1. 信息架构（已收敛）

底部 **2 个 Tab**，每个 Tab 是**两级结构**：

```
① 角色总览（默认）        ② 钻取到某角色
┌─────────────────┐      ┌─────────────────┐
│ [通用] [设陷者]  │ 点   │ ← 设陷者         │
│ [幽灵] [农场主]  │ ──→  │ 技能 · 3 ────── │
│ [护士]  [女猎手] │      │ ◇  ◇  ◇         │
│   …45 张卡片     │ ←──  │ 配件 · 15 ───── │
└─────────────────┘  返回 └─────────────────┘
```

| Tab | 角色总览 | 钻取后的分区 |
|---|---|---|
| **杀手** `/#/killer` | 通用 + 44 位屠夫 = **45 个头像** | 技能 · 3 + **配件 · N** |
| **人类** `/#/survivor` | 通用 + 53 位逃生者 = **54 个头像** | 技能 · 3 |

**关键交互约定**：

- **默认不预选「通用」**，进站即看到全部角色。
- 「通用」作为总览里的**一张卡片**（虚线边框区分），点击后才看通用条目。
- 选中角色 → **其他角色全部隐藏**，只显示该角色的技能/配件。
- 左上角 ← 返回角色总览。
- **未录入数据的角色头像降透明度（0.38）+ 右上角空心点**，一眼看出录入进度。

**角色总览的排版规格（实测数据）**：

| 项 | 值 |
|---|---|
| 列数 | **5 列** |
| 头像 | **68px 正方形**，圆角 3px，全部等大 |
| 内容 | **只有头像，不显示名字** |
| 行列间距 | 行 11px / 列 6px |
| 杀手 45 个 | 9 行 → 732px ≈ **1.03 屏**（基本一屏） |
| 人类 54 个 | 11 行 → 890px ≈ **1.26 屏**（轻微滚动） |

**为什么去掉名字**：名字是纵向高度最大的占用项（两行 26px，占卡片高度 25%）。去掉后头像从 56px 长到 68px，且两个 Tab 都能压在 1~1.3 屏内。

**代价与兜底**（三个不占空间的补偿）：
1. **点进去看顶栏标题** —— 点错一次就知道是谁，反悔成本极低
2. **搜索仍支持名字**（中文 / 拼音 / 首字母），想精确定位走搜索
3. **`aria-label` + `title`** —— 无障碍朗读与桌面端悬停仍有名字

**为什么不用横向角色条**：44 个屠夫塞进一条横向滚动条，找人是灾难（要滑 20 屏）。5 列头像墙 + 搜索才是对的。

**已删除**：横向角色条、人类物品、祭品图鉴、收藏/备注、关于/致谢/日志、导出长图。

**杀手页是核心**：一个屠夫的全部可用内容在一屏内看全，这是这个站唯一的存在理由。

---

## 2. 已定稿的设计规范

### 2.1 令牌

```css
--bg:#0a0a0c;        /* 背景 */
--elev1:#101014;     /* 抽屉 */
--elev2:#16161b;     /* 图标底 */
--ink:#e8e2d6;       /* 骨白（不用纯白，纯白在暗底上刺眼） */
--ink-dim:#8f897d;
--accent:#b32020;    /* 血 · 全局唯一强调色 */

--r-common:#8b6b45;  --r-uncommon:#b8a03c;  --r-rare:#3f8f5f;
--r-vrare:#7a4fa8;   --r-ultra:#c2397a;
```

**颗粒压到 5.5% 透明度**：只在潜意识层面提供"脏、暗、有雾"的信号，不破坏简约。

**光感：顶部冷光 + 对称暗角**（暗角必须上下对称，这条踩过坑）

```css
.app::before {
  background:
    /* ① 顶部一层极淡骨白冷光：用「加亮顶部」做光线变化，不压暗底部 */
    radial-gradient(ellipse 130% 38% at 50% -6%, rgba(232, 226, 214, 0.05), transparent 70%),
    /* ② 四周轻暗角：中心对称，正文区域不受影响 */
    radial-gradient(ellipse 135% 80% at 50% 50%, transparent 62%, rgba(0, 0, 0, 0.26) 100%);
}
```

❌ **不要写成** `radial-gradient(130% 75% at 50% -10%, transparent 35%, rgba(0,0,0,.6) 100%)`——
中心和垂直半径都在屏幕上方之外，中部就 42% 黑、底部 60% 黑，
手机上表现为「顶光、下半屏发暗」。

手机上实测（内容区平均亮度）：错的那版下半屏只有上半屏的 **51%**（明显偏暗）；
改成对称暗角后是 93%，加上顶部冷光后仍保持 93%，且亮度曲线不再是单调下降。

### 2.2 形态规则

| 内容 | 形态 | 稀有度表现 |
|---|---|---|
| 技能（perk） | 菱形 ◆，1px 边框 `#612770` | **无**——技能没有稀有度，只有 I/II/III 等级 |
| 配件（addon） | 正方形 ▪，1px 边框按稀有度着色 | 四边框上色（粗细与技能框一致） |
| 角色头像 | 正方形 68×68，圆角 3px，5 列 | — |

### 2.3 排版

- 标题：**系统衬线**（`Noto Serif SC / Songti SC`）+ 全大写英文副标（9px，letter-spacing .3em）
- 正文：系统无衬线
- **绝不 web 加载中文字体**（3-5MB）

### 2.4 关键组件

| 组件 | 规格 |
|---|---|
| 角色总览 | **5 列网格**，68px 方形头像，只有头像无名字，未录入项 `opacity .38` + 右上角空心点 |
| 技能网格 | **自适应铺满**：`repeat(auto-fit, minmax(68px, 1fr))`，3 条时自动放大撑满整行 |
| 配件网格 | 固定 5 列 `repeat(5, 1fr)` |
| 分区标题 | 衬线小标题 + 数字徽章 + 一条细线（`技能 · 3 ────`） |
| 详情 | **底部抽屉**：初始 40dvh / 展开 85dvh / 下滑超 90px 关闭 / 手势只挂把手 |
| 顶栏 | 钻取后显示 ← 返回；副标带总数（`KILLER · 45`） |

---

## 3. 数据层

### 3.1 schema

```ts
export type Kind = 'perk' | 'addon';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'ultra';

export interface Entry {
  id: string;              // 'addon:IconAddon_iridescentStone'（用资源名，改翻译不断链）
  kind: Kind;
  ownerId: string;         // 'the-trapper' | 'universal'
  owner: string;           // '设陷者'
  ownerEn: string;         // 'The Trapper'
  title: string;
  titleEn?: string;
  rarity?: Rarity;         // 仅 addon
  description: string[];   // 段落数组，保留原始 • 列表
  flavor?: string;
  icon: string;            // 雪碧图 iconKey
  // 检索（构建期生成，运行时零成本）
  pinyin?: string;         // 'caihongshi'
  initials?: string;       // 'chs'
  aliases?: string[];
  // 溯源
  source?: string;
  confidence?: number;     // < 0.8 的条目 UI 上标小黄点
}
```

**`pinyin` / `initials` 必须在构建期算好**，运行时不要引 pinyin 库（gzip 后 100KB+）。

### 3.2 分包（两级结构天然契合）

```
data/
├─ owners.json              ~8KB    角色总览唯一需要的数据
├─ perks/killer.json        ~110KB  钻取到杀手时载（一次性）
├─ perks/survivor.json      ~130KB
└─ addons/{ownerId}.json    ~25KB   钻取到具体屠夫时才载
```

| 时刻 | 需要加载 |
|---|---|
| 打开站点 · 角色总览 | **8KB**（owners.json） |
| 点「设陷者」 | + 25KB（他的配件）+ 110KB（杀手技能，首次） |
| 点另一个屠夫 | + 25KB |
| 打开「人类」Tab | + 130KB |

`owners.json` 只需要名字 + 计数：

```jsonc
{ "owners": [
  { "id": "the-trapper", "side": "killer", "name": "设陷者", "nameEn": "The Trapper",
    "avatar": "trapper", "counts": { "perk": 3, "addon": 20 } }
] }
```

**两级结构 + 分包是同一个解**：角色总览不需要内容，钻取才需要，正好按需加载。

**副作用收益**：单视图只有 20 条 → **完全不需要虚拟滚动**，省掉安卓上最爱出 bug 的依赖。

**搜索范围跟着层级走**：
- 角色总览下搜索 → 只搜**角色名**（47/54 条，纯前端过滤）
- 钻取后搜索 → 只搜**该角色的条目**（约 20 条）
- 不做「全站跨角色搜条目」，否则必须全量加载，分包就白做了

### 3.3 错误处理

迷雾笔记的启动是裸调 `Promise.all([...9 个请求])`，**没有任何 catch——任一失败整站永久白屏**。

```ts
const results = await Promise.allSettled(tasks);
const failed = results.filter(r => r.status === 'rejected');
if (failed.length) showToast(`部分数据加载失败（${failed.length}）`);
```

自用站尤其要这样：**没有第二个用户来告诉你"挂了"**。

---

## 4. 图片素材方案

### 4.1 关于「用 Steam 成就图标」

已核实，结论是**不建议作为主素材源**：

| 项 | 实情 |
|---|---|
| 来源 | Steam Web API `ISteamUserStats/GetSchemaForGame/v2/?appid=381210&key=…` 返回每个成就的 `icon` / `icongray` |
| 尺寸 | **64×64**（Steam 只给这么大） |
| 覆盖范围 | 约 200+ 个成就。其中 **`Adept X` 系列每个角色一个**，图标即该角色头像 |
| 缺什么 | **没有 per-perk、per-addon 的成就** → 技能图标、配件图标**完全拿不到** |

换算一下：40px 头像在 3 倍屏需要 120px 素材，64×64 会明显发糊；技能/配件图标则是干脆没有。**所以 Steam 只能当角色头像的最后兜底。**

### 4.2 推荐方案：wiki.gg

`deadbydaylight.wiki.gg` 上技能/配件/角色图标都是 **128px 左右**，够用。

参考实现：**[Techial/DBD-Database](https://github.com/Techial/DBD-Database)** —— 每小时从 fandom wiki 自动抓取，输出结构里直接带 `iconURL`：

```json
{
  "name": "Barbecue & Chilli",
  "URIName": "Barbecue_&_Chilli",
  "iconURL": "…/perk_icon.png",
  "characterName": "The Cannibal",
  "contentText": "…"
}
```

它就是「怎么从 wiki 抓结构化数据 + 图标 URL」的现成答案，你的 `scripts/import-wiki.ts` 可以直接照它的思路写。

### 4.3 图标落地方式：按角色拆小雪碧图

```
icons/perks/killer@2x.webp     145 个 → 24×7 格 ≈ 3072×896  (2.75M 像素，安全)
icons/addons/the-trapper@2x.webp  20 个×128px → 5×4 格 = 640×512
```

**单张雪碧图必须 < 4M 像素。** 迷雾笔记的 `killer-loadout@2x.png` 是 3072×5376 = **16,515,072 像素**，这个数字不是巧合——它卡在 iOS Safari 约 **16.7M** 的解码上限下面，再大一点 iPhone 上直接渲染失败。别踩这个边界。

自用的话更省事：**不用雪碧图，直接单个 WebP 文件**（20 个配件 = 20 个小请求，同域并发完全没问题，还省掉 `background-position` 的心智负担）。缓存交给 Service Worker。

---

## 5. 技术选型与 Cloudflare Pages 部署

| 项 | 选择 |
|---|---|
| 构建 | Vite 6 |
| 框架 | React 19 + TypeScript |
| 路由 | `react-router` 的 **`createHashRouter`** |
| 状态 | Zustand |
| 样式 | Tailwind CSS v4 |
| 数据 | 静态 JSON + 构建期脚本 |
| 部署 | **Cloudflare Pages** |

**明确不引入**：Next.js / SSR / SSG / sitemap / 数据库 / 账号 / i18n / 虚拟滚动。

### 5.1 为什么 Cloudflare Pages 比 GitHub Pages 更合适

| | GitHub Pages | **Cloudflare Pages** |
|---|---|---|
| 私有仓库 | 免费账号**不支持**（要 GitHub Pro） | **免费支持** |
| `base` 路径 | 必须设成仓库名，忘了就全白 | **不需要**，直接从根路径服务 |
| 带宽 | 软限制，仓库大了有顾虑 | 静态资源**无限带宽**（免费） |
| 国内访问 | 时好时坏 | 明显更稳 |
| 自定义域名 + HTTPS | 可以 | 可以，自动签发 |
| 国内合规 | — | **境外托管，`*.pages.dev` 免 ICP 备案** |

**"合法合规"的具体落点**：

1. **不需要 ICP 备案** —— Cloudflare 是境外托管，用 `*.pages.dev` 子域名或境外解析的自有域名都不触发备案要求。（这是相对国内托管最省事的一点）
2. **仓库私有** —— 数据和素材不公开，只是站点可访问。
3. **站点底部固定一行免责声明**：

   > 本网站为非官方粉丝作品，与 Behaviour Interactive Inc. 无关联。游戏中出现的名称、图标与文本权利归其各自权利人所有。本站仅供个人学习与资料检索，不设广告、赞助或付费内容。

4. **不挂广告、不收赞助、不做会员** —— 自用站没有任何商业动机，这是最干净的位置。
5. **不接第三方统计**（GA 等），需要看访问量就用 Cloudflare 自带的隐私友好分析，不用 cookie 弹窗。

### 5.2 三个配置项

**① 不需要 `base`**

```ts
// vite.config.ts
export default defineConfig({ plugins: [react()] });  // 就这样
```

**② 加一个 `_redirects`（可选但建议）**

`public/_redirects`：
```
/*    /index.html   200
```
用 hash 路由其实不需要它，但加上之后**以后想换 path 路由也不用改部署**，且直接访问 `/killer` 不会 404。

**③ 部署方式：Dashboard 连 GitHub（最省事）**

Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → 选仓库
- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- 环境变量：`NODE_VERSION = 22`

之后每次 `git push` 自动构建部署。也可以本地 `npx wrangler pages deploy dist` 手动传。

### 5.3 如果想要「真正的私密」

`*.pages.dev` 虽是不公开的链接，但拿到 URL 就能进。想彻底锁死：

**Cloudflare Access（Zero Trust 免费版，50 用户以内免费）** 可以给整个站点加一层邮箱验证——只有你邮箱收到的一次性验证码能进。配置大约 10 分钟，配完之后：

- 站点完全私有，只有你能访问
- **版权风险降到最低**（不构成公开传播）
- 不需要再纠结免责声明写得好不好

**推荐做这一步**，尤其如果你打算放真图标素材。

### 5.4 部署后的自检清单

- [ ] `https://<项目>.pages.dev` 能打开，样式正常
- [ ] 手机浏览器打开，安全区/底部 Tab 正常
- [ ] 深链接 `/#/killer` 刷新不 404
- [ ] 数据 JSON 200（Network 面板确认路径不带多余的 base 前缀）
- [ ] 底部免责声明可见
- [ ] （可选）Access 已开启，未登录访问被拦

---

## 6. 数据录入路线

### 阶段 A：最小可用（1 天）
手打 **3 个你最常玩的屠夫**（每人 3 技能 + 20 配件），CSV 维护。目标：**打通从数据到 UI 的整条链路**。做完就有能用的东西。

CSV 列固定：
```
id,kind,ownerId,owner,ownerEn,title,titleEn,rarity,description,flavor,icon,source,confidence
```
多段落用 `\n` 分隔。

### 阶段 B：脚本补齐（2-3 天）
参考 DBD-Database 的思路写 `scripts/import-wiki.ts`，从 wiki.gg 抓。**抓完必须校对**，每条打 `confidence`：

| 情况 | confidence |
|---|---|
| 自动抓取且字段齐全 | 0.9 |
| 描述为空 / 稀有度缺失 | 0.6 |
| 人工核对过 | 1.0 |

UI 上 `confidence < 0.8` 标小黄点 —— **这比"我以后会记得校对"可靠一百倍**。

### 阶段 C：按新章节追更（持续）
只补新角色。这是唯一可持续的节奏。

---

## 7. 性能预算

| 指标 | 目标 |
|---|---|
| 首屏 JS（gzip） | < 150KB |
| 首屏数据 | < 10KB |
| 首屏可交互（中端安卓 / 4G） | < 2s |
| 切换角色 | < 300ms（已缓存则 0ms） |
| 滚动帧率 | 60fps |
| 单个图标文件 | < 30KB |

---

## 8. 里程碑

| 周 | 交付 | 真机验收标准 |
|---|---|---|
| **W1** | 骨架 + 3 个屠夫数据 + 网格 + 抽屉 | 能选角色、点图标、看详情、滑关抽屉不卡 |
| **W2** | 角色条记忆 + 拼音搜索 + 分包加载 | 输入 `xjc` 出结果；切角色 < 300ms |
| **W3** | 补齐剩余屠夫 + 人类侧数据 + confidence 标记 | 2 个 Tab 数据可用 |
| **W4** | GH Pages 部署 + 真机打磨 + SW 离线缓存 | 手机上打开正常，已访问过的数据断网可看 |

**每周都必须在真机上跑**，不要等最后。安全区、地址栏跳动、滚动穿透、输入放大——**这些在桌面浏览器里 100% 看不出来**。

---

## 9. 注意事项清单

### 必坑
- [ ] `100dvh` 而非 `100vh`，且带兜底
- [ ] `env(safe-area-inset-*)` + `viewport-fit=cover`
- [ ] 输入框 `font-size: 16px`（iOS 聚焦放大）
- [ ] 抽屉 `overscroll-behavior: contain`（滚动穿透）
- [ ] 锁背景滚动时**记录并恢复 `scrollTop`**
- [ ] 抽屉手势只挂把手
- [ ] `Promise.allSettled` + 失败提示
- [ ] 中文不引 web 字体
- [ ] 从角色总览钻取后**滚动位置归零**，返回后**恢复到原位置**
- [ ] 底部 Tab 切换时**重置到角色总览**（别停留在上一个角色的钻取页）
- [ ] 安卓实体返回键 → 先关抽屉，再退出钻取

### 性能
- [ ] 雪碧图（若用）单张 < 4M 像素
- [ ] `backdrop-filter` 加 `@supports`，低端安卓关掉
- [ ] 图标 `loading="lazy"` + `decoding="async"`
- [ ] 不要给整个列表加 `will-change`
- [ ] 搜索 debounce 150ms

### 数据
- [ ] 拼音索引构建期生成
- [ ] 描述用**文本节点**渲染，禁止 `innerHTML`
- [ ] `id` 用游戏资源名，不用中文名
- [ ] 每条带 `confidence`

### 法律
- [ ] 自用（不公开宣传）风险最低
- [ ] 若公开部署到国内主机 → 需 ICP 备案
- [ ] 用了迷雾笔记/wiki.gg 的整理 → 署名（CC BY-NC-SA 4.0）
- [ ] 不挂广告、不收赞助

---

## 10. v1 → v2 变更表

| 项 | v1（已废弃） | v2（当前） |
|---|---|---|
| 底部 Tab | 4 个（杀手技能 / 杀手配件 / 人类技能 / 人类物品） | **2 个（杀手 / 人类）** |
| 导航 | 横向角色条 | **角色总览 → 钻取 → 返回** |
| 默认选中 | 通用 | **不预选，展示全部角色** |
| 技能与配件 | 分页 | **杀手页同页两分区** |
| 人类物品 | 做 | **删除** |
| 祭品图鉴 | 删除 | 删除 |
| 收藏 / 备注 | P0 / P1 | **删除** |
| 技能网格 | 固定 4 列 | **自适应铺满** |
| 技能图标框 | 菱形 | 菱形（确认不变） |
| 角色头像 | 圆形 | **正方形 68px，5 列，无名字** |
| 角色总览高度 | — | **杀手 1.03 屏 / 人类 1.26 屏** |
| 导出长图 | P2 | 删除 |
| 部署 | Cloudflare Pages | **Cloudflare Pages**（确认，免备案 + 私有仓库免费） |
| 路由 | hash | hash（不变） |
| 首屏数据 | — | **8KB**（只有 owners.json） |
