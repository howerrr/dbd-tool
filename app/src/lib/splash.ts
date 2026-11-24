/**
 * 首屏加载态（`index.html` 里内联的 `#splash`）的淡出。
 *
 * 为什么不用 React 组件：这段动画必须在 **JS 包下载之前** 就已经在屏幕上，
 * 否则它自己也要等 JS —— 那就失去意义了。所以它写死在 index.html 里，
 * React 只负责在数据到齐时把它撤掉。
 *
 * 调用一次即可，重复调用是空操作（数据竞争、StrictMode 双跑都不会出事）。
 */
export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el || el.classList.contains('is-gone')) return;

  el.classList.add('is-gone');

  const drop = () => el.remove();
  // transitionend 不一定会来：标签页在后台、或系统开了「减少动效」时都可能不触发，
  // 所以再加一个定时兜底，保证它最终一定从 DOM 里消失（否则会一直挡着点击）。
  el.addEventListener('transitionend', drop, { once: true });
  window.setTimeout(drop, 700);
}
