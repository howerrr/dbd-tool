/**
 * PNG → WebP 批量转码 + 数据路径改写
 *
 * 为什么需要这一步：
 *   wiki 只提供 PNG，1298 张 128~200px 的透明图合计 ~20MB。
 *   角色抠图平均 48.9KB/张，杀手总览一次要加载 45 张 ≈ 2.2MB —— 手机上很贵。
 *   WebP 在同等肉眼观感下体积约为 PNG 的 1/4~1/5。
 *
 * 这个脚本做三件事：
 *   1. public/icons/**\/*.png → 同目录同名 .webp（transparent 通道单独给高 alphaQuality）
 *   2. 校验转码后的尺寸与透明通道没丢
 *   3. 把 public/data 下所有 `.png` 引用改成 `.webp`（只改 /icons/ 前缀的路径）
 * 转码成功后删掉原 PNG，避免 dist 里带两份。
 *
 * ⚠️ 编码参数必须和 scripts/import-dbd.mjs、scripts/import-portraits.mjs 里的一致，
 *    否则「重新导入」和「存量转换」产出的质量会不一样。
 *
 * 用法：
 *   node scripts/to-webp.mjs            # 转换 + 改写数据 + 删原图
 *   node scripts/to-webp.mjs --dry      # 只报告，不写盘
 *   node scripts/to-webp.mjs --keep     # 保留原 PNG（不推荐，dist 会翻倍）
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC = path.resolve('public');
const ICONS = path.join(PUBLIC, 'icons');
const DATA = path.join(PUBLIC, 'data');

const DRY = process.argv.includes('--dry');
const KEEP_PNG = process.argv.includes('--keep');

/* ---------- 编码参数：按素材类型分档 ---------- */

/**
 * 条目图标（128×128，平面色块 + 硬边）。
 *
 * 用 nearLossless 而不是普通有损：实测 8 个真实图标（技能 + 配件）上，
 * nearLossless 最大色差只有 **2**，体积反而比 q92 更小
 * （bloodyCoil 8.0KB vs 11.7KB、tensionSpring 3.5KB vs 5.1KB）——
 * 平面色块经不起色度采样，有损档白丢了质量还没换来体积。
 *
 * ⚠️ 统计质量时必须排除 alpha<16 的透明像素：那里的 RGB 是未定义值，
 *    直接比会算出「最大色差 255」这种假报警。
 */
export const ICON_WEBP = {
  nearLossless: true,
  quality: 60,
  effort: 6,
};

/**
 * 角色抠图（200×200，照片级纹理 + 柔和边缘）。
 * 这档**不能**用普通有损：实测 3 张真实人像 q92 平均色差 5.6、最大 117，
 * 换 4:4:4 不采样也只能到 5.5，q95 还有 5.0 —— 都有可见的糊边。
 * nearLossless 把最大色差错压到 **2**（等于无损），仍省 48% 体积。
 */
export const PORTRAIT_WEBP = {
  nearLossless: true,
  quality: 60,
  effort: 6,
};

/**
 * 卡片框（198×241，大面积平滑渐变）。
 * 有损编码会在暗底上出色带（q92 最大色差 15，渐变台阶肉眼可见），
 * 所以走无损：34.8KB，相对原 PNG 58.7KB 仍省 41%，且解码后逐字节一致。
 */
const LOSSLESS = /[\\/]icons[\\/]card[\\/]frame-.*\.png$/i;
const IS_PORTRAIT = /[\\/]icons[\\/]chars[\\/]/i;

/** 按 PNG 路径挑编码档位 */
function pickOptions(pngPath) {
  if (LOSSLESS.test(pngPath)) return { lossless: true, effort: 6 };
  if (IS_PORTRAIT.test(pngPath)) return PORTRAIT_WEBP;
  return ICON_WEBP;
}

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

/* ---------- 1. 收集 PNG ---------- */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.png$/i.test(e.name)) out.push(p);
  }
  return out;
}

const pngs = walk(ICONS);
console.log(`=== 1. 找到 ${pngs.length} 张 PNG ===`);

/* ---------- 2. 逐张转码 ---------- */
let beforeBytes = 0;
let afterBytes = 0;
let converted = 0;
let skipped = 0;
const problems = [];

for (const src of pngs) {
  const dest = src.replace(/\.png$/i, '.webp');
  const srcSize = fs.statSync(src).size;
  beforeBytes += srcSize;

  // 已经转过的跳过（幂等：webp 比 png 新就不重做）。
  // 注意：跳过时仍然要执行「清理原 PNG」—— 这样 `--keep` 先转一遍、
  // 确认没问题上再跑一次（不带 --keep）就能安全地只删 PNG。
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs) {
    afterBytes += fs.statSync(dest).size;
    skipped++;
    if (!KEEP_PNG && !DRY) fs.rmSync(src);
    continue;
  }

  if (DRY) {
    afterBytes += srcSize / 4; // 粗估
    converted++;
    continue;
  }

  const img = sharp(src, { failOn: 'none' });
  const meta = await img.metadata();
  const buf = await img.webp(pickOptions(src)).toBuffer();
  const out = await sharp(buf).metadata();

  // 尺寸和透明通道都不能丢
  if (out.width !== meta.width || out.height !== meta.height) {
    problems.push(`${path.relative(PUBLIC, src)}: 尺寸变了 ${meta.width}×${meta.height} → ${out.width}×${out.height}`);
    continue;
  }
  if (meta.hasAlpha && !out.hasAlpha) {
    problems.push(`${path.relative(PUBLIC, src)}: 透明通道丢了`);
    continue;
  }

  fs.writeFileSync(dest, buf);
  afterBytes += buf.length;
  converted++;

  if (!KEEP_PNG) fs.rmSync(src);
  if (converted % 100 === 0) process.stdout.write(`\r  转码 ${converted}/${pngs.length}`);
}

console.log(
  `\r  转码 ${converted} 张，跳过 ${skipped} 张（已转过）` +
    `\n  ${kb(beforeBytes)} → ${kb(afterBytes)}（省 ${((1 - afterBytes / beforeBytes) * 100).toFixed(1)}%）`,
);
if (problems.length) {
  console.log(`  ⚠ ${problems.length} 张有问题，已保留原 PNG：`);
  for (const p of problems.slice(0, 10)) console.log(`    - ${p}`);
}

/* ---------- 3. 改写数据里的引用 ---------- */
function rewrite(value) {
  // 只动 /icons/ 下的 .png，别误伤别的字符串
  return typeof value === 'string' ? value.replace(/^(\/icons\/.+?)\.png$/i, '$1.webp') : value;
}

function rewriteDeep(node) {
  if (Array.isArray(node)) {
    let n = 0;
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === 'string') {
        const v = rewrite(node[i]);
        if (v !== node[i]) { node[i] = v; n++; }
      } else n += rewriteDeep(node[i]);
    }
    return n;
  }
  if (node && typeof node === 'object') {
    let n = 0;
    for (const k of Object.keys(node)) {
      if (typeof node[k] === 'string') {
        const v = rewrite(node[k]);
        if (v !== node[k]) { node[k] = v; n++; }
      } else n += rewriteDeep(node[k]);
    }
    return n;
  }
  return 0;
}

function walkJSON(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJSON(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

console.log('\n=== 3. 改写数据引用 ===');
let totalRefs = 0;
let touchedFiles = 0;
for (const f of walkJSON(DATA)) {
  const raw = fs.readFileSync(f, 'utf8');
  const obj = JSON.parse(raw);
  const n = rewriteDeep(obj);
  if (n) {
    totalRefs += n;
    touchedFiles++;
    if (!DRY) fs.writeFileSync(f, JSON.stringify(obj) + '\n');
    console.log(`  ${path.relative(PUBLIC, f).padEnd(32)} ${n} 处`);
  }
}
console.log(`  共改写 ${totalRefs} 处引用（${touchedFiles} 个文件）`);

/* ---------- 4. 校验：数据里引用的图标是否都存在 ---------- */
console.log('\n=== 4. 校验引用完整性 ===');
const missing = new Set();
let checked = 0;
for (const f of walkJSON(DATA)) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/"(\/icons\/[^"]+)"/g)) {
    checked++;
    const rel = m[1].replace(/^\//, '');
    if (!fs.existsSync(path.join(PUBLIC, rel))) missing.add(m[1]);
  }
}
console.log(`  检查了 ${checked} 处图标引用`);
if (missing.size) {
  console.log(`  ⚠ ${missing.size} 处引用找不到文件：`);
  for (const m of [...missing].slice(0, 10)) console.log(`    - ${m}`);
} else {
  console.log('  ✓ 全部存在');
}

/* ---------- 5. 汇总 ---------- */
const iconFiles = walk(ICONS).length;
const webpFiles = (() => {
  let n = 0;
  const w = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (/\.webp$/i.test(e.name)) n++;
    }
  };
  w(ICONS);
  return n;
})();
console.log(`\n=== 完成 ===\n  icons 目录：.webp ${webpFiles} 个，.png 剩 ${iconFiles} 个`);
if (DRY) console.log('  （--dry 模式，未写盘）');
if (missing.size || problems.length) process.exitCode = 1;
