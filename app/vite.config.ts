import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `base` 说明
 *
 * - Cloudflare Workers / Pages、自定义域名：站点在**根路径**，base = '/'（默认）。
 * - GitHub Pages 项目站：地址是 `https://<user>.github.io/<repo>/`，
 *   站点在**子路径**下，base 必须是 '/<repo>/'。
 *
 * 所以这里不写死，由环境变量 VITE_BASE 决定：
 *   - 本地 dev / Cloudflare：不设，走 '/'
 *   - GitHub Actions：workflow 里从 GITHUB_REPOSITORY 算出 '/<repo>/' 并注入
 *
 * ⚠️ 光设 base 还不够：数据 JSON 里存的是 `/icons/...` 这类绝对路径，
 *    它们不会自动带上前缀。运行时统一由 src/lib/base.ts 的 asset() 拼接。
 */
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    host: true, // 允许手机在同一局域网访问，方便真机调试
    port: 5173,
  },
});
