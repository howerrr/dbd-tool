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
