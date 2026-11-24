# 杀机图鉴

《黎明杀机》的**中文速查工具站**。移动端优先，桌面端自适应，部署在 **GitHub Pages**（`dbd.howerlin.top`），个人自用。

> 非官方粉丝作品，与 Behaviour Interactive Inc. 无关联。
> 条目文本整理自 [迷雾笔记](https://dbdwiki.com)（CC BY-NC-SA 4.0），
> 图标与角色图取自 [Dead by Daylight Wiki](https://deadbydaylight.wiki.gg)。
> 本站不设广告、赞助或付费内容。

## 能做什么

- **角色总览**：45 位杀手 / 54 位求生者，卡片外观复刻官方 wiki 名册
- **钻取**：每位角色的技能（菱形）与配件（正方形 + 稀有度四色边框）
- **搜索**：中文名 / 英文名 / 拼音全拼 / 首字母；也能按**效果**搜（「疲劳」「无法侦测」「发电机」）
- **多选筛选**：18 个效果词，多选是 **AND**（同时满足），按命中量排序
- **跨角色搜索**：在总览里直接搜到任意角色的技能与配件，点进去自动打开对应条目

## 目录

```
app/          站点本体（Vite + React + TS），详见 app/README.md
docs/         方案文档（dbd-tool-site-plan.md）
design/       设计稿迭代 v1~v9 + 渲染截图
.github/      GitHub Pages 的 Actions 工作流
```

## 跑起来

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run check      # typecheck + 单测 + 构建 + 产物自检，一条命令全过
```

更多细节（数据管线、踩过的坑、部署步骤、真机清单）都在 **[app/README.md](app/README.md)**。

## 技术要点

- **移动端优先**：`dvh` + `env(safe-area-inset-*)`，默认 6 列角色网格；`≥900px` 才切桌面布局，`≥1280px` 锁 12 列
- **阵营主题色**：杀手血红 / 逃生者雾蓝，一套令牌 + `html[data-side]` 覆盖，组件里不判断阵营
- **首屏加载动画**：内联在 `index.html` 里的「计数划痕」（五条笔画依次划上），零外部请求，
  所以 JS 包还没下载完就已经在屏幕上；至少播完一个循环再由 React 撤掉
- **图源全部 WebP**：20.7MB → 10.2MB，按素材类型分三档编码参数（图标/人像 nearLossless、卡片框无损）
- **构建期烘焙**：阵营色用 headless Chrome 烤成静态图，运行时零 CSS filter（iOS Safari 对极端滤镜链支持有问题）
- **拼音在构建期算好**，运行时只做字符串比较，不引拼音库
- **产物自检**：`scripts/verify-assets.mjs` 检查引用完整性、数据自洽与体积

## 部署

**GitHub Pages + Actions**：推 `main` 后 workflow 自动跑「类型检查 → 单测 → 构建并自检 → 部署」，
自定义域名 `dbd.howerlin.top`（根路径，`base='/'`）。首次配置有三件手动的事（Pages Source 选
GitHub Actions、DNS 记录、`public/CNAME`），步骤见 [app/README.md](app/README.md#部署到-github-pages)。
