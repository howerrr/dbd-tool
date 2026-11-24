import type { CSSProperties } from 'react';
import type { Rarity } from '../types';

/**
 * 稀有度 → CSS 变量。
 *
 * base 变体：详情里的文字与描边（沉稳）
 * glow 变体：深底上的 1px 边框与 2px 色条（亮一档才看得清）
 *
 * 色值全部来自 tokens.css，那里又从迷雾笔记的
 * --detail-rarity-rgb / --detail-rarity-glow-rgb 对齐过。
 */
export const RARITY_BASE: Record<Rarity, string> = {
  common: '--r-common',
  uncommon: '--r-uncommon',
  rare: '--r-rare',
  'very-rare': '--r-vrare',
  ultra: '--r-ultra',
};

export const RARITY_GLOW: Record<Rarity, string> = {
  common: '--r-common-glow',
  uncommon: '--r-uncommon-glow',
  rare: '--r-rare-glow',
  'very-rare': '--r-vrare-glow',
  ultra: '--r-ultra-glow',
};

/** 给元素注入 --rarity 变量，供 CSS 里的 var(--rarity) 使用 */
export function rarityStyle(
  rarity: Rarity | null | undefined,
  variant: 'base' | 'glow' = 'glow',
): CSSProperties | undefined {
  if (!rarity) return undefined;
  const map = variant === 'base' ? RARITY_BASE : RARITY_GLOW;
  return { '--rarity': `var(${map[rarity]})` } as CSSProperties;
}
