/**
 * 部署 base 相关的路径拼接。
 *
 * 为什么需要它：`public/data/*.json` 里存的是**绝对路径**（`/icons/chars/k-01.webp`、
 * `/data/owners.json`）。部署到根路径时它们没问题；但 GitHub Pages 的**项目站**
 * 地址是 `https://<user>.github.io/<repo>/`，绝对路径会指到域名根、
 * `howerrr.github.io/icons/...` 直接 404。
 *
 * 数据文件里保持绝对路径（与 wiki 原始命名一致、也方便别的工具复用），
 * 前缀统一在运行时补 —— 这样同一份数据在根路径和子路径两种部署下都能用。
 */
const BASE = import.meta.env.BASE_URL; // '/' 或 '/repo/'

/**
 * 给站内绝对路径补上部署 base。
 * - 已经是完整 URL / data: URI 的原样返回
 * - null / 空字符串原样返回（调用方靠它判断「没有图标」）
 */
export function asset<T extends string | null | undefined>(path: T): T {
  if (!path) return path;
  if (/^(https?:|data:|blob:|\/\/)/.test(path)) return path;
  const prefix = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  return (path.startsWith('/') ? prefix + path : prefix + '/' + path) as T;
}

/**
 * 人像的 srcset：把 `k-01.webp` 展开成 96w / 144w / 180w / 200w 四档。
 *
 * 四档由 scripts/gen-portrait-sizes.mjs 生成。传进来的 `src` 应该已经过 `asset()`，
 * 这里只按后缀派生文件名 —— 所以三种部署 base 下都成立。
 *
 * 之所以值得做：手机上角色卡 6 列，人像实际只显示 ≈69 CSS px，
 * 却在下载 200×200 的图。首屏 40 张原本要 963KB。
 */
export function avatarSrcSet(src: string): string {
  if (!src || !src.endsWith('.webp')) return src;
  const stem = src.slice(0, -'.webp'.length);
  return `${stem}@96.webp 96w, ${stem}@144.webp 144w, ${stem}@180.webp 180w, ${src} 200w`;
}

/**
 * 人像的 sizes：描述图片在布局中的 **CSS 宽度**，浏览器用它乘设备像素比去挑档位。
 *
 * 手机档写 **56px**（比实际显示宽度 ≈69px 略小，是刻意的欠采样余量），
 * 桌面档 125px 是 12 列布局下卡片 101px × 124% 的实测值。
 *
 * 挑档结果（首屏按 40 张、母版 24.1KB/@180 12.6KB/@144 8.1KB/@96 3.9KB 估算）：
 *
 *   DPR1 手机 → 56  → 96w    157KB   采样率 50%→ 75%（相对显示 63px×1）
 *   DPR2 手机 → 112 → 144w   325KB   采样率 76%
 *   DPR3 手机 → 168 → 180w   502KB   采样率 **95%**   ← 这一档是本次新增的
 *   DPR4 手机 → 224 → 200w   963KB   采样率 79%
 *   桌面 DPR1 → 125 → 144w   366KB
 *   桌面 DPR2+ → 250 → 200w  1083KB（满采样母版）
 *
 * 历史：最初 sizes 写 69px（满采样），DPR3 会算成 207 → 落到 200w 母版，
 * iPhone 首屏 963KB，等于没优化；改成 48px 后降到 325KB 但采样率只有 76%；
 * 现在 56px + 新增的 180w 档，iPhone 是 502KB / 95% 采样。
 *
 * 想再省流量：把手机档改回 48px（325KB、76%）；想更锐：把 180w 那档的编码
 * 从 q92 换成 nearLossless（754KB、色差 ≤2）。
 */
export const AVATAR_SIZES = '(min-width: 900px) 125px, 56px';
