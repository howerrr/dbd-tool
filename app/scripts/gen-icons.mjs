/**
 * 生成站点图标（favicon / apple-touch-icon / PWA manifest 图标）
 *
 * 全部由下面这一份内联 SVG 渲染出来，尺寸、留白、圆角都在代码里，
 * 想改样式改这一处再跑一遍即可 —— 不要在 public/ 里手改 PNG。
 *
 * 图形：**红色杀戮钩子（斜 45°） + 蓝色人形**叠加。
 * 两个形状都直接取自站内组件 `components/Icons.tsx` 的 `IconKiller` / `IconSurvivor`
 * （同一套 24 空间的线性语言），所以图标和页面里的阵营图标是同一个形状。
 * 叠法：钩子在左上、45° 倾斜；人形在右下压在上面。
 * 人形先拿**底色描一圈**（knockout）再描蓝色，两色之间才有一道干净的缝 ——
 * 否则 32px 下红蓝两笔会糊成一团。
 *
 * 三个尺寸的差异（这几个坑不处理，装到主屏会很难看）：
 *   - favicon / 普通图标：留边、圆角
 *   - apple-touch-icon（180）：**必须铺满、不能有圆角和透明**，
 *     iOS 会自己裁圆角并垫黑底，留边会显得图标缩了一圈
 *   - maskable（512）：图形要缩到画布 80% 的安全圆内，
 *     否则安卓启动器裁成圆形时会把图形切掉
 *
 * WebP 不用于这里：Safari 的 apple-touch-icon 和部分安卓启动器不认。
 * 所以 public 根目录下这几个 PNG 是「全站唯一允许存在的 PNG」，
 * scripts/verify-assets.mjs 对它们有白名单。
 *
 * 用法：node scripts/gen-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC = path.resolve('public');

const BG = '#0a0a0c';
const KILLER = '#b32020';
const SURVIVOR = '#2f6ea8';
const INK = '#e8e2d6';

/**
 * 钩子（= IconKiller）：竖杆 + 一个大弯钩 + 顶端的钉头。
 * 24 空间里的包围盒是 x 8..16 / y 1..18（钉头 + 弯钩最低点），中心 ≈ (12, 9.5)。
 * 绕这个中心 rotate(45) 才是「斜着挂」而不是绕着角落甩出去。
 */
const HOOK = `
  <g transform="translate(43 46) rotate(45) scale(2.9) translate(-12 -9.5)"
     fill="none" stroke="${KILLER}" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v7a4 4 0 1 0 4 4" />
    <circle cx="12" cy="2.6" r="1.7" fill="${KILLER}" stroke="none" />
  </g>`;

/**
 * 人形（= IconSurvivor）：头 + 肩膀。24 空间里包围盒 x 4.5..19.5 / y 4..21，中心 ≈ (12, 12.5)。
 * 画两遍：先用底色描粗一圈当 knockout，再用蓝色描细一圈 —— 叠在钩子上也能分得开。
 */
function human(stroke, width) {
  return `
  <g transform="translate(61 61) scale(2.35) translate(-12 -12.5)"
     fill="none" stroke="${stroke}" stroke-width="${width}"
     stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
  </g>`;
}

/** knockout 的粗细：比蓝线多出约 3.2 个「24 空间」单位 ≈ 画面上 3.7/100 的缝 */
const KNOCKOUT = 5.1;
const STROKE = 1.9;

/**
 * @param {object} o
 * @param {number} o.radius   圆角半径（0..50，单位同 0..100 坐标系）
 * @param {number} o.scale    整组图形缩放（maskable 要缩到 0.78）
 * @param {boolean} o.glow    是否加顶部冷光（和站内暗角/光感一致）
 */
function buildSvg({ radius, scale, glow }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="light" cx="50%" cy="0%" r="85%">
      <stop offset="0%" stop-color="${INK}" stop-opacity="0.09" />
      <stop offset="100%" stop-color="${INK}" stop-opacity="0" />
    </radialGradient>
    <clipPath id="round">
      <rect x="0" y="0" width="100" height="100" rx="${radius}" ry="${radius}" />
    </clipPath>
  </defs>
  <g clip-path="url(#round)">
    <rect x="0" y="0" width="100" height="100" fill="${BG}" />
    ${glow ? '<rect x="0" y="0" width="100" height="100" fill="url(#light)" />' : ''}
  </g>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
    ${HOOK}
    ${human(BG, KNOCKOUT)}
    ${human(SURVIVOR, STROKE)}
  </g>
</svg>`;
}

/** 需要生成的位图：[文件名, 尺寸, svg 参数] */
const RASTERS = [
  ['favicon-32.png', 32, { radius: 22, scale: 1, glow: false }],
  ['favicon-192.png', 192, { radius: 22, scale: 1, glow: true }],
  ['icon-192.png', 192, { radius: 22, scale: 1, glow: true }],
  ['icon-512.png', 512, { radius: 22, scale: 1, glow: true }],
  // maskable：铺满 + 图形缩进安全圆
  ['icon-maskable-512.png', 512, { radius: 0, scale: 0.78, glow: true }],
  // iOS 自己裁圆角，所以这里必须是直角满铺
  ['apple-touch-icon.png', 180, { radius: 0, scale: 1, glow: true }],
];

fs.mkdirSync(PUBLIC, { recursive: true });

// 1) 矢量 favicon：现代浏览器优先用它，任意 DPI 都清晰
const svg = buildSvg({ radius: 22, scale: 1, glow: true });
fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), svg.trim() + '\n');
console.log(`  → favicon.svg            ${(svg.length / 1024).toFixed(1)}KB`);

// 2) 位图
for (const [name, size, opts] of RASTERS) {
  const body = buildSvg(opts);
  const dest = path.join(PUBLIC, name);
  await sharp(Buffer.from(body), { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9, palette: false })
    .toFile(dest);
  console.log(`  → ${name.padEnd(24)} ${size}×${size}  ${(fs.statSync(dest).size / 1024).toFixed(1)}KB`);
}

console.log('\n完成。改了图形就重跑这个脚本，别手改 public 里的 PNG。');
