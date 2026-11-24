import type { ReactNode } from 'react';

/**
 * 占位图标。
 * 真实图标到位后由 Entry.icon（图片地址）取代，这里只负责在没图时
 * 给出可辨识的形状，避免整屏空白方块。
 */
const GLYPHS: ReactNode[] = [
  <>
    <path d="M12 4v8" />
    <path d="M12 12a4 4 0 1 0 4 4" />
  </>,
  <>
    <path d="M5 5l14 14M19 5L5 19" />
  </>,
  <>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.4" />
  </>,
  <>
    <path d="M4 9h16M4 15h16M7 9v6M17 9v6" />
  </>,
  <>
    <path d="M12 3l3 6 6 1-4.5 4.4 1 6.6-5.5-3-5.5 3 1-6.6L3 10l6-1z" />
  </>,
  <>
    <path d="M6 4v7a6 6 0 0 0 12 0V4" />
    <path d="M12 17v4" />
  </>,
  <>
    <path d="M4 12h5l2-5 2 10 2-5h5" />
  </>,
  <>
    <path d="M9 3v6L5 20h14L15 9V3" />
    <path d="M8 3h8" />
  </>,
];

export function Glyph({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {GLYPHS[index % GLYPHS.length]}
    </svg>
  );
}

export function IconBack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

export function IconKiller() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v7a4 4 0 1 0 4 4" />
      <circle cx="12" cy="2.6" r="1" />
    </svg>
  );
}

export function IconSurvivor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function IconEmpty() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
      <path d="M9 13h6" />
    </svg>
  );
}

/** 哔哩哔哩：简笔「小电视」，和站内其他图标的线性风格一致 */
export function IconBilibili() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.4 3.6 10.2 6.4" />
      <path d="M16.6 3.6 13.8 6.4" />
      <rect x="3.2" y="6.4" width="17.6" height="14.2" rx="4.8" />
      <path d="M9.2 11.2v3.4" />
      <path d="M14.8 11.2v3.4" />
    </svg>
  );
}

/**
 * 「通用」角色卡的标记，替代原来直接显示汉字「通」的做法。
 * 杀手用钩子、人类用逃生者剪影，和底部 Tab 的语义一致；
 * 卡片本身还有虚线边框，所以不会被误认成某个具体角色。
 */
export function UniversalMark({ side }: { side: 'killer' | 'survivor' }) {
  return (
    <span className="char__mark" aria-hidden="true">
      {side === 'killer' ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 4v9a4.5 4.5 0 1 0 4.5 4.5" />
          <circle cx="12" cy="2.8" r="1.3" />
          <path d="M8.4 7.2 12 4l3.6 3.2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="7.4" r="3.6" />
          <path d="M5 20.6a7 7 0 0 1 14 0" />
          <path d="M8.2 12.6 12 15.4l3.8-2.8" />
        </svg>
      )}
    </span>
  );
}
