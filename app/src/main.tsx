import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
import Browse from './pages/Browse';
import './styles/tokens.css';
import './styles/app.css';

/**
 * 用 hash 路由：
 * Cloudflare Pages 没有 SPA fallback，hash 路由零配置即可深链刷新不 404。
 * 以后想换 path 路由，只要在 public/_redirects 里加 /* → /index.html 200 即可。
 */
const router = createHashRouter([
  { path: '/', element: <Navigate to="/killer" replace /> },
  { path: '/:side', element: <Browse /> },
  { path: '/:side/:ownerId', element: <Browse /> },
  { path: '*', element: <Navigate to="/killer" replace /> },
]);

/**
 * 阵营主题色（`html[data-side]`）要在**首帧之前**定好。
 * Browse 里也有一个 effect 负责同步，但那是首帧之后才跑 ——
 * 直接深链到人类页（`#/survivor/...`）时会先闪一下杀手的红色。
 * 这里按 hash 猜一次，浏览器或用户直接刷新深链也能立刻是雾蓝。
 */
document.documentElement.dataset.side = /^#\/survivor(\/|$)/.test(window.location.hash)
  ? 'survivor'
  : 'killer';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
