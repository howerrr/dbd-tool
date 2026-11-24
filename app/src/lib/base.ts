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
 * 之所以值得做：手机上角色卡 6 列，人像实际只显示 ≈69 CSS px，
 * 却在下载 200×200 的图。首屏 40 张原本要 965KB。
 */
export function avatarSrcSet(src: string): string {
  if (!src || !src.endsWith('.webp')) return src;
  const stem = src.slice(0, -'.webp'.length);
  return `${stem}@96.webp 96w, ${stem}@144.webp 144w, ${src} 200w`;
}

/**
 * 人像的 sizes：描述图片在布局中的 **CSS 宽度**，浏览器用它乘设备像素比去挑档位。
 *
 * 手机档刻意写 **48px**，比实际显示宽度（≈69px）小 —— 这是有意的欠采样：
 *
 *   DPR1 → 需要 48  → 选 96w   (3.9KB/张)
 *   DPR2 → 需要 96  → 选 96w   (3.9KB)   ← 原来 144w
 *   DPR3 → 需要 144 → 选 144w  (8.2KB)   ← 原来选 200w 母版 24.2KB
 *
 * 首屏 40 张：DPR2 327KB → 157KB，**DPR3 965KB → 327KB（−66%）**。
 * 代价是 DPR2/DPR3 的采样率都降到约 76%（144/189），但卡片人像只有 63px 宽，
 * 浏览器本来还要再降采样一次，真机上看不出差别。
 *
 * 想要更保守的话有两个方向：
 *   · sizes 改回 69px → 恢复满采样，iPhone 首屏回到 965KB
 *   · 多出一档 @180（≈12KB/张）并把 sizes 设成 56px → DPR3 约 480KB、采样率 89%
 *
 * 桌面档 125px 是 12 列布局下卡片 101px × 124% 的实测值，DPR1 选 144w、DPR2 选 200w。
 */
export const AVATAR_SIZES = '(min-width: 900px) 125px, 48px';
