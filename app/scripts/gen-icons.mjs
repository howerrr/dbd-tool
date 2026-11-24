/**
 * 生成站点图标（favicon / apple-touch-icon / PWA manifest 图标）
 *
 * 全部由下面这一份内联 SVG 渲染出来，尺寸、留白、圆角都在代码里，
 * 想改样式改这一处再跑一遍即可 —— 不要在 public/ 里手改 PNG。
 *
 * 图形选择：一把**钩子**。它是《黎明杀机》最标志性的形状，
 * 在 32px 下依然能认出轮廓；配色沿用站内的血红 + 近黑底。
 *
 * 三个尺寸的差异（这几个坑不处理，装到主屏会很难看）：
 *   - favicon / 普通图标：留 8% 边距、圆角 22%
 *   - apple-touch-icon（180）：**必须铺满、不能有圆角和透明**，
 *     iOS 会自己裁圆角并垫黑底，留边会显得图标缩了一圈
 *   - maskable（512）：图形要缩到画布 80% 的安全圆内，
 *     否则安卓启动器裁成圆形时会把钩子切掉
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
const ACCENT = '#b32020';
const INK = '#e8e2d6';

/** 钩子本体，坐标系是 0..100 */
const HOOK = `
  <path d="M50 18 V 54 C 50 78 79 78 79 61" fill="none"
        stroke="${ACCENT}" stroke-width="9"
        stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="50" cy="13.5" r="5" fill="${ACCENT}" />
`;

/**
 * 上面那个钩子的笔画包围盒中心并不在 (50,50)：
 * 横轴上钩尾甩到 x≈83、竖轴在 x≈45.5，重心偏右约 14.5；
 * 纵轴下缘只到 ≈76.5、上缘 8.5，偏上约 7.5。
 * 图标必须视觉居中，所以整块平移回来。改路径时这个偏移要跟着重算。
 */
const CENTER = 'translate(-14.5 7.5)';

/**
 * @param {object} o
 * @param {number} o.radius   圆角半径（0..50，单位同 0..100 坐标系）
 * @param {number} o.scale    钩子缩放（maskable 要缩到 0.78）
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
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50) ${CENTER}">${HOOK}</g>
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
