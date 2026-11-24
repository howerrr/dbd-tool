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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
