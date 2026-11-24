/**
 * 角色头像导入 v4 —— 复刻 wiki 首页名册的角色卡
 *
 * wiki 首页 `<div class="dbd-main-character-roster">` 里每张卡的图层顺序：
 *   charPortraitShadowBG  → 外层阴影
 *   charPortraitBg        → 卡片底
 *   charPortraitRoleBg    → 阵营色（同一张 webp，用 filter: hue-rotate 染色）
 *   charPortraitImage img → 透明抠图，宽 80%，居中，带投影
 *
 * 卡片是正方形 250×250。所以下载三张背景 webp + 每个角色的透明抠图，
 * 在组件里用同样的图层顺序和滤镜复刻 —— 所有角色外观完全统一，
 * 杀手红底、求生者蓝底。
 *
 * 角色清单取自首页名册的 charPortraitWrapper[data-character-display-name] + img[alt]，
 * 共 110 条，覆盖全部角色（含最新），比 Category:Character Selection Icons 更全。
 *
 * 用法：node scripts/import-portraits.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * 人像统一落盘 WebP。
 *
 * 这档**不能**用普通有损：实测 3 张真实人像 q92 平均色差 5.6、最大 117，
 * 换成 4:4:4 不采样也只到 5.5，q95 仍有 5.0 —— 放大看是糊边。
 * nearLossless 把最大色差错压到 2（肉眼等同无损），体积仍只有 PNG 的一半。
 *
 * ⚠️ 参数必须和 scripts/to-webp.mjs 的 PORTRAIT_WEBP 保持一致。
 */
const WEBP_OPTIONS = { nearLossless: true, quality: 60, effort: 6 };

const API = 'https://deadbydaylight.wiki.gg/api.php';
const UA = 'dbd-tool/0.1 (personal non-commercial archive)';
const OUT = path.resolve('public/icons/chars');
/** 运行时真正要用的卡片框（crop-frames.mjs 的产物） */
const CARD = path.resolve('public/icons/card');
/**
 * 构建期的**素材**（三张 wiki 背景 webp）。
 * 它们只用来烘焙 frame-*.png，运行时不引用 —— 所以绝对不能放 public/，
 * 否则会被一起部署，白白多带 460KB。 */
const CARD_SRC = path.resolve('scripts/assets/card-source');
const OWNERS_PATH = path.resolve('public/data/owners.json');
const FORCE = process.argv.includes('--force');

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
    }
  }
}

async function download(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const png = Buffer.from(await r.arrayBuffer());
  // 下载即转码成 WebP：200×200 的透明 PNG 平均 48.9KB，
  // 45 张人像一次要拉 2.2MB —— 这是首屏最大的一笔开销。
  const webp = await sharp(png, { failOn: 'none' }).webp(WEBP_OPTIONS).toBuffer();
  fs.writeFileSync(dest, webp);
  return webp.length;
}

const norm = (s) => (s ?? '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

/* ---------- 1. 三张角色卡背景材料 ---------- */
console.log('=== 1. 角色卡背景 ===');
fs.mkdirSync(CARD_SRC, { recursive: true });
const CARD_FILES = {
  'shadow-bg.webp': 'https://deadbydaylight.wiki.gg/images/c/cb/CharPortrait_shadowBG.webp',
  'card-bg.webp': 'https://deadbydaylight.wiki.gg/images/4/42/CharPortrait_bg.webp',
  'role-bg.webp': 'https://deadbydaylight.wiki.gg/images/1/18/CharPortrait_roleBG.webp',
};
for (const [name, url] of Object.entries(CARD_FILES)) {
  const dest = path.join(CARD_SRC, name);
  if (!FORCE && fs.existsSync(dest)) {
    console.log(`  (已存在) ${name} ${(fs.statSync(dest).size / 1024).toFixed(1)}KB`);
    continue;
  }
  const size = await download(url, dest);
  console.log(`  (下载) ${name} ${(size / 1024).toFixed(1)}KB`);
}

/* ---------- 2. 首页名册 → 完整角色/图片映射 ---------- */
console.log('\n=== 2. 解析首页角色名册 ===');
const parsed = await api({ action: 'parse', page: 'Dead by Daylight Wiki', prop: 'text' });
const html = parsed.parse?.text ?? '';
const blocks = html.split('charPortraitWrapper').slice(1);
const roster = [];
for (const b of blocks) {
  const display = b.match(/data-character-display-name="([^"]+)"/)?.[1];
  const img = b.match(/<img alt="([^"]+)" src="\/images\//)?.[1];
  const role = b.match(/charPortraitRoleBg (killer|survivor)/)?.[1];
  if (display && img && role) roster.push({ display, img, role });
}
console.log(
  `  名册 ${roster.length} 条（${roster.filter((r) => r.role === 'killer').length} 杀手 / ` +
    `${roster.filter((r) => r.role === 'survivor').length} 求生者）`,
);

const byNorm = new Map();
for (const r of roster) {
  const k = norm(r.display);
  if (!byNorm.has(k)) byNorm.set(k, r);
}

function findRoster(nameEn) {
  const n = norm(nameEn);
  if (!n) return null;
  if (byNorm.has(n)) return byNorm.get(n);
  for (const [k, v] of byNorm) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  return null;
}

/* ---------- 3. 匹配 ---------- */
const ownersFile = JSON.parse(fs.readFileSync(OWNERS_PATH, 'utf8'));
const targets = ownersFile.owners.filter((o) => o.name !== '通用');

const matched = [];
const unmatched = [];
for (const o of targets) {
  const r = findRoster(o.nameEn);
  if (r) matched.push({ o, r });
  else unmatched.push(o);
}
console.log(`  匹配成功 ${matched.length}/${targets.length}`);
if (unmatched.length) console.log(`  ⚠ 未匹配: ${unmatched.map((o) => `${o.name}(${o.nameEn})`).join(', ')}`);

/* ---------- 4. 解析抠图 URL ---------- */
console.log('\n=== 3. 解析抠图 URL ===');
const files = [...new Set(matched.map((m) => m.r.img))];
const urlMap = new Map();
const BATCH = 50;
for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  const j = await api({
    action: 'query',
    titles: batch.map((f) => `File:${f}`).join('|'),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '200',
  });
  for (const p of j.query?.pages ?? []) {
    if (p.missing) continue;
    const name = p.title.replace(/^File:/, '');
    const url = p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url;
    if (url) urlMap.set(name, url);
  }
  process.stdout.write(`\r  解析 ${Math.min(i + BATCH, files.length)}/${files.length}`);
}
console.log(`\n  可用 URL ${urlMap.size}/${files.length}`);
const noUrl = files.filter((f) => !urlMap.has(f));
if (noUrl.length) console.log(`  ⚠ 解析失败: ${noUrl.join(', ')}`);

/* ---------- 5. 下载 ---------- */
console.log('\n=== 4. 下载抠图 ===');
fs.mkdirSync(OUT, { recursive: true });
const queue = [];
for (const { o, r } of matched) {
  const url = urlMap.get(r.img);
  if (!url) continue;
  const dest = path.join(OUT, `${o.id}.webp`);
  if (!FORCE && fs.existsSync(dest) && o.avatar) continue;
  queue.push({ o, url, dest });
}
console.log(`  待下载 ${queue.length} 位`);

let done = 0;
let failed = 0;
async function worker() {
  while (queue.length) {
    const { o, url, dest } = queue.shift();
    try {
      await download(url, dest);
      o.avatar = `/icons/chars/${o.id}.webp`;
    } catch {
      failed++;
    }
    done++;
    if (done % 20 === 0) process.stdout.write(`\r  下载 ${done}/${done + queue.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`\r  下载完成 ${done - failed}/${done}${failed ? `（失败 ${failed}）` : ''}`);

/* 清理不在名册里的旧头像 */
const valid = new Set(matched.map((m) => `${m.o.id}.webp`));
let removed = 0;
for (const f of fs.readdirSync(OUT)) {
  if (!valid.has(f)) {
    fs.rmSync(path.join(OUT, f));
    removed++;
  }
}
if (removed) console.log(`  🧹 清理 ${removed} 个失效头像`);

/* ---------- 6. 落盘 ---------- */
if (!ownersFile.version.includes('portraits4')) ownersFile.version += '+portraits4';
ownersFile.generatedAt = new Date().toISOString();
fs.writeFileSync(OWNERS_PATH, JSON.stringify(ownersFile) + '\n');
console.log(`\nowners.json：${ownersFile.owners.filter((o) => o.avatar).length}/${ownersFile.owners.length} 位有头像`);
