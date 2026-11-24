import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cloudflare Pages 从站点根路径服务，不需要 base。
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 允许手机在同一局域网访问，方便真机调试
    port: 5173,
  },
});
