/**
 * 产物自检：部署前跑一遍，任何一项 ✗ 都不该上 W4。
 *
 * 检查的是 `dist/`（必须先在 app/ 下跑 `npm run build`），覆盖：
 *   1. 数据里每个 /icons/ 引用都能在 dist 里找到真实文件
 *   2. CSS 里 url() 引用的资源存在
 *   3. 没有残留的 .png（已全量转 WebP）
 *   4. 数据自洽：角色数、每人 3 个技能、配件索引条数 == 各分包条数之和
 *   5. 部署元文件（_redirects / _headers）已进入产物
 *   6. 打印各页面首次加载的体积估算
 *
 * 用法：node scripts/verify-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const SRC = path.resolve('public');

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const info = (msg) => console.log(`    ${msg}`);

if (!fs.existsSync(DIST)) {
  console.error('dist/ 不存在，先运行 npm run build');
  process.exit(1);
}

/* ---------- 工具 ---------- */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const distFiles = walk(DIST);
const web = (p) => p.replace(/\\/g, '/');
const rel = (p) => web(path.relative(DIST, p));

/**
 * 站点内 URL → dist 内的真实文件。
 * 构建时可能带部署 base（GitHub Pages 项目站的 `/repo/` 前缀），
 * 而 dist 里没有这一层目录，所以比较前先把 base 剥掉。
 */
const BASE = process.env.VITE_BASE || '/';
const stripBase = (url) => (url.startsWith(BASE) ? '/' + url.slice(BASE.length) : url);
const existsInDist = (url) => fs.existsSync(path.join(DIST, stripBase(url).replace(/^\//, '')));

/* ---------- 1. 数据里的 /icons/ 引用 ---------- */
console.log('\n[1] 数据 → 图标引用');
{
  const jsonFiles = distFiles.filter((f) => f.endsWith('.json'));
  const refs = new Map(); // url -> 引用它的文件数
  for (const f of jsonFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/"(\/icons\/[^"]+)"/g)) {
      refs.set(m[1], (refs.get(m[1]) ?? 0) + 1);
    }
  }
  const missing = [...refs.keys()].filter((u) => !existsInDist(u));
  if (missing.length) {
    bad(`${missing.length}/${refs.size} 处图标引用找不到文件`);
    missing.slice(0, 8).forEach((u) => info(u));
  } else {
    ok(`${refs.size} 个不同图标引用全部存在（来自 ${jsonFiles.length} 个 JSON）`);
  }
}

/* ---------- 2. CSS 引用 ---------- */
console.log('\n[2] CSS url() 引用');
{
  const cssFiles = distFiles.filter((f) => f.endsWith('.css'));
  let checked = 0;
  const missing = [];
  for (const f of cssFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const u = m[1];
      // data: / http: / 锚点都不是文件引用。
      // 注意 CSS 压缩器会把 `url(#n)` 写成 `url(%23n)`，所以 %23 也要放过。
      if (/^(data:|https?:|#|%23)/.test(u)) continue;
      checked++;
      if (!existsInDist(u)) missing.push(u);
    }
  }
  if (missing.length) bad(`CSS 里有 ${missing.length} 个资源找不到：${missing.join(', ')}`);
  else ok(`${checked} 处 CSS 资源引用全部存在`);
}

/* ---------- 3. 图片格式 ---------- */
console.log('\n[3] 图片格式');
{
  /**
   * 根目录这几个 PNG 是唯一的例外：Safari 的 apple-touch-icon 和
   * 部分安卓启动器不认 WebP，站点图标必须留 PNG。
   * 由 scripts/gen-icons.mjs 生成，别手改。
   */
  const ICON_PNGS = new Set([
    'favicon-32.png',
    'favicon-192.png',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
  ]);

  const pngs = distFiles.filter((f) => /\.png$/i.test(f));
  const strays = pngs.filter((f) => !ICON_PNGS.has(rel(f)));
  const webps = distFiles.filter((f) => /\.webp$/i.test(f));

  if (strays.length) bad(`有 ${strays.length} 个不该出现的 PNG：${strays.map(rel).slice(0, 5).join(', ')}`);
  else ok(`图标 PNG ${pngs.length} 个（白名单内），其余全是 WebP（${webps.length} 个）`);

  const missingIcons = [...ICON_PNGS].filter((f) => !fs.existsSync(path.join(DIST, f)));
  if (missingIcons.length) bad(`缺站点图标：${missingIcons.join(', ')}（跑 npm run gen:icons）`);
  else ok('站点图标齐全（favicon / apple-touch-icon / manifest 三档）');
}

/* ---------- 4. 数据自洽 ---------- */
console.log('\n[4] 数据一致性');
{
  const owners = JSON.parse(fs.readFileSync(path.join(DIST, 'data/owners.json'), 'utf8'));
  const killer = JSON.parse(fs.readFileSync(path.join(DIST, 'data/perks/killer.json'), 'utf8'));
  const survivor = JSON.parse(fs.readFileSync(path.join(DIST, 'data/perks/survivor.json'), 'utf8'));
  const index = JSON.parse(fs.readFileSync(path.join(DIST, 'data/addons-index.json'), 'utf8'));

  const killerN = owners.owners.filter((o) => o.side === 'killer');
  const survivorN = owners.owners.filter((o) => o.side === 'survivor');
  ok(`角色 ${owners.owners.length}（杀手 ${killerN.length} / 人类 ${survivorN.length}）`);
  ok(`技能 ${killer.length + survivor.length}（杀手 ${killer.length} / 人类 ${survivor.length}）`);

  // 每个非「通用」角色应该正好 3 个技能
  const badPerk = owners.owners.filter((o) => {
    if (o.id === 'universal') return false;
    const n = [...killer, ...survivor].filter((p) => p.ownerId === o.id).length;
    return n !== 3;
  });
  if (badPerk.length) bad(`${badPerk.length} 个角色的技能数 ≠ 3：${badPerk.map((o) => `${o.name}(${o.counts.perk})`).slice(0, 6).join(', ')}`);
  else ok('每个角色都正好 3 个技能');

  // 配件索引条数 == 各分包条数之和，且 id、ownerId 对得上
  const addonFiles = fs.readdirSync(path.join(DIST, 'data/addons')).filter((f) => f.endsWith('.json'));
  let addonTotal = 0;
  const addonIds = new Set();
  for (const f of addonFiles) {
    const arr = JSON.parse(fs.readFileSync(path.join(DIST, 'data/addons', f), 'utf8'));
    addonTotal += arr.length;
    for (const a of arr) addonIds.add(a.id);
  }
  if (addonTotal !== index.length) bad(`分包配件 ${addonTotal} 条 ≠ 索引 ${index.length} 条`);
  else ok(`配件 ${addonTotal} 条，与索引一致（${addonFiles.length} 个分包）`);

  const indexOnly = index.filter((a) => !addonIds.has(a.id)).length;
  if (indexOnly) bad(`索引里有 ${indexOnly} 条 id 对不上任何分包 —— 点搜索结果会找不到条目`);
  else ok('索引 id 与分包条目一一对应');

  const orphanOwner = index.filter((a) => !owners.owners.some((o) => o.id === a.ownerId)).length;
  if (orphanOwner) bad(`索引里有 ${orphanOwner} 条的 ownerId 不存在`);
  else ok('索引 ownerId 全部能在 owners.json 里找到');

  // 检索字段
  const noPy = [...killer, ...survivor, ...index].filter((e) => !e.pinyin || !e.initials).length;
  if (noPy) bad(`${noPy} 个条目缺 pinyin/initials 字段 —— 拼音搜索会漏`);
  else ok('全部条目都有 pinyin / initials');

  // 图标覆盖率
  const perksNoIcon = [...killer, ...survivor].filter((p) => !p.icon).length;
  const addonsNoIcon = [...index].filter((a) => !a.icon).length;
  ok(`图标覆盖：技能缺 ${perksNoIcon} / 配件缺 ${addonsNoIcon}`);

  const avatars = owners.owners.filter((o) => o.avatar).length;
  if (avatars < owners.owners.length - 2) bad(`只有 ${avatars}/${owners.owners.length} 位角色有人像`);
  else ok(`人像 ${avatars}/${owners.owners.length}（「通用」无抠图属正常）`);
}

/* ---------- 5. 部署元文件 ---------- */
console.log('\n[5] 部署元文件');
for (const f of ['index.html', 'manifest.webmanifest']) {
  if (fs.existsSync(path.join(DIST, f))) ok(f);
  else bad(`${f} 没有进入 dist`);
}
/* _headers / _redirects 是 Cloudflare 专用的。
   GitHub Pages 上它们不会被识别，而且会被当成普通文件公开下载，所以默认不产出；
   如果哪天要回 Cloudflare，加回去即可。 */
for (const f of ['_headers', '_redirects']) {
  if (fs.existsSync(path.join(DIST, f))) console.log(`    · 存在 ${f}（Cloudflare 专用，GitHub Pages 会忽略）`);
}

/* ---------- 5b. index.html 里的引用 ---------- */
console.log('\n[5b] index.html 引用');
{
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
  const missing = refs.filter((u) => !existsInDist(u));
  if (missing.length) bad(`index.html 引用了不存在的文件：${missing.join(', ')}`);
  else ok(`${refs.length} 处引用全部存在`);

  // 装了 icon link 之后浏览器就不该再请求 /favicon.ico
  if (/rel="icon"/.test(html) && !/rel="manifest"/.test(html)) bad('有 icon 但没接 manifest');
  else if (/rel="icon"/.test(html) && /rel="manifest"/.test(html)) ok('favicon + manifest 都已接线');

  // PWA 元信息：缺了「添加到主屏」会退化成加书签
  for (const [needle, label] of [
    ['apple-mobile-web-app-capable', 'apple standalone'],
    ['apple-touch-icon', 'apple-touch-icon'],
    ['format-detection', '关闭电话号码识别'],
    ['viewport-fit=cover', '安全区适配'],
  ]) {
    if (html.includes(needle)) ok(label);
    else bad(`index.html 缺 ${label}`);
  }
}

/* ---------- 6. 体积 ---------- */
console.log('\n[6] 体积');
{
  const sum = (files) => files.reduce((s, f) => s + fs.statSync(f).size, 0);
  const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;

  const total = sum(distFiles);
  const js = distFiles.filter((f) => f.endsWith('.js'));
  const css = distFiles.filter((f) => f.endsWith('.css'));
  const chars = distFiles.filter((f) => web(f).includes('/icons/chars/'));
  const iconsOnly = distFiles.filter((f) => web(f).includes('/icons/') && !web(f).includes('/icons/chars/'));
  const data = distFiles.filter((f) => web(f).includes('/data/'));

  console.log(`    产物总计          ${mb(total)}（${distFiles.length} 个文件）`);
  console.log(`    JS                ${kb(sum(js))}`);
  console.log(`    CSS               ${kb(sum(css))}`);
  console.log(`    数据 JSON         ${kb(sum(data))}`);
  console.log(`    人像 ${chars.length} 张        ${kb(sum(chars))}  平均 ${kb(sum(chars) / chars.length)}`);
  console.log(`    条目图标 ${iconsOnly.length} 张   ${kb(sum(iconsOnly))}  平均 ${kb(sum(iconsOnly) / iconsOnly.length)}`);

  const owners = JSON.parse(fs.readFileSync(path.join(DIST, 'data/owners.json'), 'utf8')).owners;
  const avgPortrait = sum(chars) / chars.length;
  const killerN = owners.filter((o) => o.side === 'killer').length;
  const avgIcon = sum(iconsOnly) / iconsOnly.length;
  const perkSide = sum([path.join(DIST, 'data/perks/killer.json')]);
  const avgAddons = 20;
  console.log('\n    首次打开「杀手总览」约 =');
  console.log(`      JS ${kb(sum(js))} + CSS ${kb(sum(css))} + owners.json ${kb(fs.statSync(path.join(DIST, 'data/owners.json')).size)}`);
  console.log(`      + 首屏约 30 张人像 ${kb(avgPortrait * 30)} + 卡片框 35KB  ≈ ${mb(sum(js) + sum(css) + avgPortrait * 30 + 35 * 1024 + 18000)}`);
  console.log(`    首次打开某个杀手页约 =`);
  console.log(`      JS+CSS ${kb(sum(js) + sum(css))} + 技能 ${kb(perkSide)} + 约 ${avgAddons} 个配件图标 ${kb(avgIcon * avgAddons)}  ≈ ${mb(sum(js) + sum(css) + perkSide + avgIcon * avgAddons)}`);
  void killerN;
}

/* ---------- 结论 ---------- */
console.log('');
if (failures) {
  console.log(`✗ ${failures} 项未通过`);
  process.exitCode = 1;
} else {
  console.log('✓ 全部检查通过');
}
void SRC;
void rel;
