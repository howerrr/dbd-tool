# DbDle —— 黎明杀机每日猜谜站 · 方案文档 v1

> 目标读者：有 3 年前端经验的开发者（你本人）。
> 文档定位：可直接照着开工，不需要再补需求分析。

---

## 1. 产品定位

| 项 | 内容 |
|---|---|
| 一句话 | 每天一道黎明杀机猜谜，中文玩家的「打开就有理由回来」的小站 |
| 核心价值 | **好玩 + 每日仪式感 + 中文**，不是资料库 |
| 不做什么 | 不做全技能维基、不做战绩统计、不做攻略长篇（NightLight / Fandom / 贴吧已经占住了） |
| 目标用户 | 中文杀鸡玩家（含云玩家、回归玩家），以手机端为主 |
| 成功指标 | D1 日活 > 100、7 日留存 > 25%、平均单次游玩 > 90 秒 |
| 变现 | 第一阶段不做。先攒人，商业化等授权问题明确了再说 |

**为什么是猜谜而不是工具站**：工具站需要长期维护数据才有价值（祭坛每周、版本每季度），一个人扛不住；猜谜是「内容成本恒定、每天自动出一题」的形态，一个人能长期跑。

---

## 2. 核心玩法

### 2.1 模式设计（关键决策）

屠夫和逃生者的可猜维度完全不同，所以**两个模式规则不同**，别硬套一套规则：

| 模式 | 玩法 | 依据 |
|---|---|---|
| **屠夫模式**（主） | 属性推断网格，6 次机会 | 屠夫之间差异大（速度/恐怖半径/能力类型），推断有信息量 |
| **逃生者模式**（副） | 线索揭示 + 猜人，1 次机会或 3 次 | 逃生者属性几乎一样，只能靠剪影/技能图标/章节来猜 |

逃生者模式做成「每天解锁一条线索，越早猜对分越高」，成本低、二次打开率高。

### 2.2 屠夫模式规则

- 6 次机会猜屠夫。
- 每次猜测后，展示该屠夫的属性网格，逐格给出颜色反馈。
- 猜中后展示所有 6 格绿色 + 屠夫立绘/介绍，进入「完成态」。
- 6 次用尽 → 失败，展示答案 +「你猜过的最接近的是哪一条」。

**属性与判定规则**：

| 属性 | 展示形式 | 绿色（完全匹配） | 黄色（接近） | 黑色 |
|---|---|---|---|---|
| 章节年份 | `2016 · 基础游戏` | 年份相同 | 相差 1 年 + ↑/↓ 箭头 | 其余 + ↑/↓ 箭头 |
| 移动速度 | `4.6 m/s` | 数值相同 | 相邻档（4.4↔4.6↔4.8） | 其余 + ↑/↓ |
| 恐怖半径 | `32 m` | 数值相同 | 差值 ≤ 8m + ↑/↓ | 其余 + ↑/↓ |
| 上手难度 | `简单 / 中等 / 困难` | 相同 | 相邻一档 | 其余 |
| 能力类型 | 标签集合，如 `陷阱` `区域控制` | 逐个标签比对，命中的标签变绿 | — | 未命中标签保持灰 |
| 是否免费 | `免费 / DLC` | 相同 | — | 其余 |

设计要点：
- **「接近」必须给方向箭头**，否则玩家推断效率太低、挫败感强。
- **能力标签用多标签集合而不是单选**，这是本游戏最大的信息量来源，也是玩家最爱聊的点（「他其实是潜行型啊」）。
- 难度和免费是「凑维度」用的弱信息，新手模式保留，困难模式隐藏（见 2.4）。

### 2.3 逃生者模式规则

- 每天 1 位逃生者。
- 初始只给：性别 + 章节年份。
- 每猜错一次，解锁下一层线索，顺序固定：
  1. 章节年份
  2. 性别
  3. 一张技能图标剪影（从该角色 3 个专属技能里随机固定一个）
  4. 角色剪影
  5. 名字首字拼音首字母
- 最多 5 次机会。猜对时按剩余次数给星级（5 星 / 4 星 …）。

### 2.4 难度分层

- **新手模式**（默认）：显示全部 6 个维度，速度/恐怖半径的黄色容差放宽。
- **困难模式**（本地开关）：隐藏「是否免费」和「上手难度」，恐怖半径容差收到 4m。
- 两者**共用当日同一个答案**，切换模式只影响展示，不影响公平性和分享结果。

### 2.5 边界态

必须处理的 8 个状态，缺一个就会被玩家骂：

1. 首次进入 · 未开始
2. 进行中（有历史猜测）
3. 胜利
4. 失败
5. **已完成 · 再次进入**（显示结果 + 分享按钮 +「明天再来」，绝不能让他重玩刷成绩）
6. 输入中无匹配项（屠夫别名搜索不到）
7. 网络/数据加载失败
8. 日期切换瞬间（跨过 0 点，若页面开着要有提示）

---

## 3. 数据结构

放在仓库里作为唯一真相源：`data/killers.json`、`data/survivors.json`。

```ts
// data/killers.json 的条目结构
interface Killer {
  id: string;              // 'the-trapper'，稳定不变，作为主键
  nameCn: string;          // '陷阱杀手'
  nameEn: string;          // 'The Trapper'
  aliases: string[];       // ['夹子哥', 'Trapper'] —— 搜索用，务必补民间叫法
  chapterId: string;       // 'base' | 'chapter-01' ...
  chapterNameCn: string;   // '基础游戏'
  releaseDate: string;     // '2016-06-14'
  releaseYear: number;     // 2016（冗余字段，判定时直接用，避免运行时解析）
  speed: 4.4 | 4.6 | 4.8;
  terrorRadius: number;    // 米，无恐怖半径的填 0
  difficulty: 'easy' | 'medium' | 'hard';
  isFree: boolean;         // 基础游戏角色 / 可用血点解锁 = true
  powerTags: PowerTag[];   // ['trap', 'area-control']
  portrait: string;        // '/img/killers/the-trapper.webp'
  silhouette: string;      // '/img/killers/the-trapper-sil.webp'
}
```

```ts
type PowerTag =
  | 'chase'          // 追击强化
  | 'stealth'        // 潜行
  | 'trap'           // 陷阱/布置
  | 'range'          // 远程攻击
  | 'mobility'       // 高机动/传送
  | 'area-control'   // 区域压制
  | 'info'           // 信息获取
  | 'slowdown'       // 拖延节奏
```

**PowerTag 的取值务必少而稳**（8 个以内）。标签一多，判定就失去意义，玩家也记不住。

逃生者条目简化：

```ts
interface Survivor {
  id: string;
  nameCn: string;
  nameEn: string;
  aliases: string[];
  releaseYear: number;
  chapterNameCn: string;
  gender: 'female' | 'male' | 'other';
  perkIcons: [string, string, string]; // 3 个专属技能图标
  silhouette: string;
  pinyinInitial: string;               // 'M' 用于最后一条线索
}
```

**数据录入流程**（这步别偷懒）：

1. 用 Excel/飞书表格维护 `data-src/killers.csv`（人工填，一行一个屠夫）。
2. `scripts/build-data.ts` 把 CSV 转 JSON，同时做校验：
   - `id` 唯一、`speed` 必须在枚举内、`releaseYear` 与 `releaseDate` 一致
   - `portrait` / `silhouette` 文件真实存在
   - `powerTags` 每个屠夫至少 1 个、最多 3 个
3. 校验失败直接 `exit 1`，CI 里跑。**数据错一题，玩家当场就能发现，比代码 bug 掉粉快得多。**

---

## 4. 每日题目算法

要求：**同一日期全球一致、纯前端可算、一年内不重复**。用「年度洗牌 + 按天取牌」：

```ts
// lib/daily.ts
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每年一副定死的牌（同一 pool + salt + 年份 → 同一顺序），按 dayOfYear 取牌 */
export function dailyPick<T>(dateKey: string, pool: T[], salt: string): T {
  const year = dateKey.slice(0, 4);
  const rand = mulberry32(xmur3(`${year}:${salt}:v1`)());
  const deck = pool.map((_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return pool[deck[dayOfYear(dateKey) % pool.length]];
}
```

- 屠夫模式：`salt = 'killer'`；逃生者模式：`salt = 'survivor'`。
- **年份变了牌序会重洗**，这是刻意的（每年 1/1 有新循环感），但要注意 1/1 可能和 12/31 重复——可以在取牌时跳过「上一个答案」做一次修正。
- 时区：统一用 **UTC+8（北京时间 0 点重置）**，因为主要用户是中文玩家。代码里显式写死，不要用 `new Date()` 的本地时区，否则海内外玩家看到的题不一样、分享结果对不上。

---

## 5. 页面与路由

```
/                     今日屠夫（默认入口，直接开玩，不做落地页）
/survivor             今日逃生者
/archive              往期列表（按年月分组）
/archive/[date]       某一天的独立页（同一题，可回玩，SEO 重点）
/stats                个人连击 / 战绩（纯本地数据）
/about                免责声明 + 数据来源 + 反馈入口
```

**首页不要做落地页**。玩家点进来必须立刻能玩，任何「开始游戏」按钮都是流失点。

---

## 6. 状态与本地存储

无账号体系，全部 `localStorage`，单 key 聚合：

```ts
// key: 'dbdle:v1'
interface Store {
  version: 1;
  results: Record<string, {         // key = `${mode}:${dateKey}`
    guesses: string[];              // 猜过的 id 序列
    won: boolean;
    finishedAt: number;
  }>;
  streak: { current: number; best: number; lastWinDate: string | null };
  hardMode: boolean;
  stats: { played: number; won: number; distribution: number[] }; // distribution[0] = 1次猜中
}
```

规则：
- `version` 字段留好，将来加字段直接迁移，不要洗掉玩家数据。
- **连击判定**：`lastWinDate` 是昨天（北京时区）则 `current + 1`，否则重置为 1。
- `finishedAt` 用于判断「今天已完成」，**同时用 `results` 里有没有这个 key 双重判断**，防止跨时区/改系统时间作弊。
- localStorage 不可用时（隐私模式）要有内存降级，至少能玩完当次。

---

## 7. 分享机制

两档，先做第一档：

**第一档（必做）：文字网格**
```
DbDle 屠夫 #127  4/6
🟩⬛🟨⬛🟩🟩
⬛🟨🟩⬛⬛🟨
...
🔗 dbdle.xxx
```
- 用 `navigator.share()`，不支持的降级到 `navigator.clipboard.writeText()`。
- 网格里**绝对不能出现答案信息**，也不能带 url 参数暗示。
- 每格用 `⬛` 而不是颜色 emoji，保证在微信/Discord 里都能正常显示。

**第二档（第二期）：Canvas 生成图片**
渲染成 1080×1350 竖图，带屠夫剪影水印 + 成绩。分享到 B站动态/贴吧效果远好于文字，但要多写 200 行 canvas 逻辑，别放 MVP。

---

## 8. 技术选型与目录结构

给你的建议（3 年前端、单人维护、要长期跑）：

| 选择 | 理由 |
|---|---|
| **Next.js 15 App Router + TypeScript** | 静态生成搞定 `/archive/[date]` 的海量 SEO 页面，一个框架吃下 UI + 路由 + SSG |
| **Tailwind CSS v4** | 猜谜网格是纯样式密集型 UI，手写 CSS 会很痛苦 |
| **shadcn/ui** | 只取 Dialog / Sheet / Toast，别整包引入 |
| **Zustand** | 游戏状态小，Context 也行，但 Zustand 更好测 |
| **Cloudflare Pages** | 静态站免费、国内访问比 Vercel 稳 |
| **Vitest** | 只测 `lib/daily.ts` 和判定函数，这两块是游戏公平性的地基 |

不引入的东西：数据库、账号、后端 API、i18n 框架（先只有中文）。

```
dbdle/
├─ app/
│  ├─ page.tsx                 今日屠夫
│  ├─ survivor/page.tsx
│  ├─ archive/page.tsx
│  ├─ archive/[date]/page.tsx  含 generateStaticParams
│  ├─ stats/page.tsx
│  └─ about/page.tsx
├─ components/
│  ├─ GuessGrid.tsx            主网格
│  ├─ GuessCell.tsx            单格（颜色/箭头/标签）
│  ├─ SearchCombobox.tsx       屠夫搜索（支持别名 + 拼音）
│  ├─ ResultModal.tsx
│  └─ ShareButton.tsx
├─ lib/
│  ├─ daily.ts                 每日取题
│  ├─ compare.ts               属性判定（纯函数，重点单测）
│  ├─ storage.ts               localStorage 封装 + 版本迁移
│  └─ share.ts                 文字网格生成
├─ data/
│  ├─ killers.json
│  └─ survivors.json
├─ data-src/killers.csv        人工维护源
├─ scripts/build-data.ts
└─ public/img/
```

**`lib/compare.ts` 必须是纯函数**：`compare(guess: Killer, answer: Killer) => CellResult[]`。游戏的全部规则都在这里，UI 只负责渲染。这样你能对着测试用例改规则，而不是在组件里试。

---

## 9. 反作弊与数据正确性

坦白说，**纯前端猜谜游戏没法真正防作弊**——答案必然存在于 bundle 里，看源码就能找到。所以策略是「防懒人，不防高手」：

- 答案不要在 HTML 里以明文出现（Next.js SSG 会把它打进 props，用 `dynamic = 'force-static'` 也别指望藏住）。
- 进阶做法：把当日答案放到 Cloudflare Worker / 一个只返回「猜对了没」的接口，`GET /api/check?date=&guess=` 返回布尔值。这样刷源码拿不到答案，成本也就一个 20 行函数。**建议 MVP 后就加这个。**
- 别做排行榜/名次，一旦有排名，作弊就有动机；只做「个人连击」，作弊没收益。

**数据正确性才是真风险**。屠夫的速度、恐怖半径、章节归属，玩家记得比你还准。上线后设一个「报错」入口（`/about` 里的 mailto 或 GitHub Issues 链接），并在数据里加 `source` 字段记录出处。

---

## 10. SEO 与分发

- `/archive/[date]` 每天多一个静态页，一年 365 个页面，这是唯一能吃到自然搜索的部分。标题模板：`黎明杀机猜谜 2025年6月1日 答案与提示 | DbDle`。
- 结构化数据：`VideoGame` + `FAQPage`，别用 `Article`。
- 站点地图 `sitemap.xml` 用 Next 的 `app/sitemap.ts` 自动生成。
- 分发漏斗：**猜谜 → 分享图 → 贴吧/B站/小黑盒/Reddit**。要在 `/about` 放二维码，方便主播引流。

---

## 11. 里程碑

| 周 | 交付 | 验收标准 |
|---|---|---|
| **W1** | 数据建模 + `build-data.ts` + `compare.ts` + 单测 | 30 个屠夫数据录入完成，`compare` 用例全绿 |
| **W2** | 屠夫模式可玩闭环（搜索/网格/结算/本地存储） | 手机上能完整玩一局，刷新后状态正确，跨天能重置 |
| **W3** | 分享文字网格 + `/archive` 静态页 + `/about` 免责声明 | 分享文本在微信里能正常显示；archive 页被构建出来 |
| **W4** | 逃生者模式 + 移动端打磨 + 首次外发 | 上线到 Cloudflare Pages，贴吧/B站各发一次 |

逃生者模式放 W4 而非 W1，是因为它依赖剪影图，**美术资源是最容易拖期的东西，别让它卡住主线**。

---

## 12. 版权红线（不可协商）

1. 全站底部固定声明：**「本网站为非官方粉丝作品，与 Behaviour Interactive Inc. 无关联。」**
2. **不上官方素材做商业用途**：不挂广告、不收会员、不卖周边，直到拿到明确授权。
3. 高风险素材：官方立绘、技能图标原图、Logo、游戏截图。做法是**风格化简笔图标 + 文字描述**，别直接扒图。
4. 角色名、技能名、章节名属于事实性引用，风险低；**图标与立绘是唯一真正的高风险区**，所有取舍都在这里。
5. 若要做大，给 Behaviour 的 fan content 政策发一封邮件问清楚，很多厂商对非营利粉丝站是默许的。留着邮件截图。

---

## 13. 风险与后续扩展

| 风险 | 应对 |
|---|---|
| 数据更新滞后（新章节上线） | 每季度留 2 小时维护窗口；数据里带 `patchVersion` 字段 |
| 剪影图难产 | 用 CSS 滤镜（`brightness(0) contrast(0)`）处理占位图，先上线 |
| 单人维护疲劳 | 每日题目全自动生成，**不需要你每天手动出题**，这是选猜谜形态的关键理由 |
| 玩法单一，玩腻 | 预留扩展：组合模式（屠夫+逃生者同猜）、限时活动题（联动章节专题）、玩家自定义出题 |

---

## 附：开工 checklist

- [ ] 建仓库、初始化 Next.js + Tailwind
- [ ] 建 `data-src/killers.csv`，先录基础游戏的 5 个屠夫跑通链路
- [ ] 写 `compare.ts` 并用「陷阱杀手 vs 女猎手」这种典型对做第一组测试
- [ ] 把 `dailyPick` 的时区写死 UTC+8 并加测试（用固定 dateKey 断言结果）
- [ ] 首页直接是游戏，不放落地页
- [ ] 底部免责声明先写上，别等上线前才想起来
