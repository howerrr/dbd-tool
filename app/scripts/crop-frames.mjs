/**
 * 裁剪已烘焙的卡片边框
 *
 * 卡片框的来历：把 wiki 的三张背景 webp（shadow / bg / roleBg）按首页名册的图层顺序
 * 叠起来、用 wiki 自己的 `hue-rotate` 参数染成杀手红 / 求生者蓝，在 headless Chrome 里
 * 截出 250×250 的方块 —— 这一步是**手工**的，脚本不负责烘焙。
 *
 * 烘焙结果四周有透明留白，实体卡片只占约 x 25~222 / y 5~244（198×241，比例 0.8216）。
 * 这个脚本负责把留白裁掉，输出 public/icons/card/frame-{side}.webp。
 *
 * 输入：scripts/assets/card-source/frame-{side}.raw.png（250×250 的烘焙原图）
 * 输出：public/icons/card/frame-{side}.webp（无损，渐变用有损会出色带）
 *
 * 用法：node scripts/crop-frames.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = path.resolve('scripts/assets/card-source');
const OUT_DIR = path.resolve('public/icons/card');
const ALPHA_THRESHOLD = 128;

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const side of ['killer', 'survivor']) {
  const srcCandidates = [
    path.join(SRC_DIR, `frame-${side}.raw.png`),
    path.join(SRC_DIR, `frame-${side}.png`),
  ];
  const src = srcCandidates.find((p) => fs.existsSync(p));
  if (!src) {
    console.log(`${side}: 找不到烘焙原图，跳过（需要 ${path.relative('.', srcCandidates[0])}）`);
    continue;
  }

  const img = sharp(src, { failOn: 'none' });
  const { width: w, height: h } = await img.metadata();

  // 扫描 alpha 通道，算出实体卡片的包围盒（四周是透明留白）
  const raw = await sharp(src, { failOn: 'none' }).ensureAlpha().raw().toBuffer();
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (raw[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    console.log(`${side}: 整张图全透明，跳过`);
    continue;
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const dest = path.join(OUT_DIR, `frame-${side}.webp`);

  await sharp(src, { failOn: 'none' })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .webp({ lossless: true, effort: 6 })
    .toFile(dest);

  console.log(
    `${side}: ${w}×${h} → 裁到 ${cw}×${ch}（比例 ${(cw / ch).toFixed(4)}）  ` +
      `${(fs.statSync(dest).size / 1024).toFixed(1)}KB  → ${path.relative('.', dest)}`,
  );
}
