/**
 * 首屏加载态（`index.html` 里内联的 `#splash`）的淡出。
 *
 * 为什么不用 React 组件：这段动画必须在 **JS 包下载之前** 就已经在屏幕上，
 * 否则它自己也要等 JS —— 那就失去意义了。所以它写死在 index.html 里，
 * React 只负责在数据到齐时把它撤掉。
 *
 * 调用一次即可，重复调用是空操作（数据竞争、StrictMode 双跑都不会出事）。
 */

/** 一个完整的「划痕」循环 = CSS 里 `.sp-tally` 的 2.4s */
const CYCLE_MS = 2400;

declare global {
  interface Window {
    /** index.html 的内联脚本记下的加载态起始时间（performance.now() 基准） */
    __splashT0?: number;
  }
}

export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el || el.dataset.hiding === '1') return;
  el.dataset.hiding = '1';

  /**
   * 数据回得快时（本地或命中缓存，通常一两百毫秒）动画会被拦腰截断，
   * 看上去像是「闪了一下」而不是一段加载。所以这里卡一个最短展示时长：
   * 从加载态出现算起，不满一个循环就等满再退。
   *
   * ⚠️ 代价是每次首屏至少 2.4s。想缩短就改 CYCLE_MS（并同步改 index.html
   * 里 `.sp-tally` 的时长），想完全去掉就设成 0。
   */
  const t0 = window.__splashT0 ?? performance.now();
  const remain = Math.max(0, CYCLE_MS - (performance.now() - t0));

  window.setTimeout(() => {
    el.classList.add('is-gone');

    const drop = () => el.remove();
    // transitionend 不一定会来：标签页在后台、或系统开了「减少动效」时都可能不触发，
    // 所以再加一个定时兜底，保证它最终一定从 DOM 里消失（否则会一直挡着点击）。
    el.addEventListener('transitionend', drop, { once: true });
    window.setTimeout(drop, 700);
  }, remain);
}
