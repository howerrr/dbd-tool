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
 * 人像的 srcset：把 `k-01.webp` 展开成 96w / 144w / 200w 三档。
 *
 * 三档由 scripts/gen-portrait-sizes.mjs 生成。传进来的 `src` 应该已经过 `asset()`，
 * 这里只按后缀派生文件名 —— 所以三种部署 base 下都成立。
 *
 * 之所以值得做：手机上角色卡 6 列，人像只显示 69 CSS px，却在下载 200×200 的图。
 * 首屏 40 张从 965KB 降到 DPR2 的约 327KB。
 */
export function avatarSrcSet(src: string): string {
  if (!src || !src.endsWith('.webp')) return src;
  const stem = src.slice(0, -'.webp'.length);
  return `${stem}@96.webp 96w, ${stem}@144.webp 144w, ${src} 200w`;
}

/**
 * 人像的 sizes：描述图片在布局中的**CSS 宽度**，浏览器拿它乘设备像素比去挑档位。
 * - 手机 6 列：卡片约 56px，人像按 124% 显示 ≈ 69px
 * - 桌面 12 列（≥900px）：卡片约 101px，人像 ≈ 125px
 */
export const AVATAR_SIZES = '(min-width: 900px) 125px, 69px';
