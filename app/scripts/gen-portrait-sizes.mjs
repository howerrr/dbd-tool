/**
 * 生成角色人像的响应式尺寸变体
 *
 * 背景：手机上角色卡 6 列，人像实际只有 **69 CSS px** 宽，
 * 却在下载 200×200、平均 24KB 的图。40 张进视口 = 965KB，
 * 是国内 4G 下「第一次加载特别慢」的主要原因。
 *
 * 做法：以现有的 200px nearLossless 母版为准，另出两档小图；
 * 页面用 `srcset` + `sizes` 让浏览器按「显示宽度 × 设备像素比」自己挑：
 *
 *   DPR1 手机 → 69px  → 96w  (q82，约 3.9KB)
 *   DPR2 手机 → 138px → 144w (q88，约 8.1KB)
 *   DPR3 手机 → 207px → 200w (nearLossless 母版，质量不变)
 *   DPR1 桌面 → 125px → 144w
 *   DPR2 桌面 → 250px → 200w
 *
 * 小图用有损编码是安全的：它们最终被缩到 69~125 CSS px 显示，
 * 缩放本身就会把高频误差摊平。200w 母版保持 nearLossless 不动 ——
 * 那一档是给 DPR≥3 的屏幕用的，会按接近 1:1 渲染。
 *
 * 用法：node scripts/gen-portrait-sizes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve('public/icons/chars');

/** [后缀, 边长, 编码参数] */
const VARIANTS = [
  ['@144', 144, { quality: 88, alphaQuality: 100, effort: 6 }],
  ['@96', 96, { quality: 82, alphaQuality: 100, effort: 6 }],
];

const sources = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.webp') && !/@\d+\.webp$/.test(f));

if (!sources.length) {
  console.error('public/icons/chars 下没有找到 200px 母版（*.webp，不含 @尺寸 后缀）');
  process.exit(1);
}

console.log(`母版 ${sources.length} 张\n`);

let baseBytes = 0;
const outBytes = new Map(VARIANTS.map(([suffix]) => [suffix, 0]));
let made = 0;
let skipped = 0;

for (const f of sources) {
  const src = path.join(DIR, f);
  const stat = fs.statSync(src);
  baseBytes += stat.size;

  for (const [suffix, size, opts] of VARIANTS) {
    const dest = path.join(DIR, f.replace(/\.webp$/, `${suffix}.webp`));
    // 幂等：变体比母版新就跳过
    if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= stat.mtimeMs) {
      outBytes.set(suffix, outBytes.get(suffix) + fs.statSync(dest).size);
      skipped++;
      continue;
    }
    const buf = await sharp(src)
      .resize(size, size, { fit: 'inside', kernel: 'lanczos3' })
      .webp(opts)
      .toBuffer();
    fs.writeFileSync(dest, buf);
    outBytes.set(suffix, outBytes.get(suffix) + buf.length);
    made++;
  }
  if (made % 40 === 0 && made > 0) process.stdout.write(`\r  已生成 ${made} 个`);
}

console.log(`\r  生成 ${made} 个，跳过 ${skipped} 个（已是最新）\n`);

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`  200w 母版（nearLossless）  ${kb(baseBytes)}   平均 ${(baseBytes / sources.length / 1024).toFixed(1)}KB/张`);
for (const [suffix] of VARIANTS) {
  const b = outBytes.get(suffix);
  console.log(`  ${suffix}w（有损）`.padEnd(28) + `${kb(b)}   平均 ${(b / sources.length / 1024).toFixed(1)}KB/张`);
}

console.log('\n首屏约 40 张人像的传输量：');
console.log(`  DPR1 全用 96w   ≈ ${((outBytes.get('@96') / sources.length) * 40 / 1024).toFixed(0)}KB`);
console.log(`  DPR2 全用 144w  ≈ ${((outBytes.get('@144') / sources.length) * 40 / 1024).toFixed(0)}KB`);
console.log(`  DPR3 仍用母版   ≈ ${((baseBytes / sources.length) * 40 / 1024).toFixed(0)}KB（质量不变，没法更小）`);
