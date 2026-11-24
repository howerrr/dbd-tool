import type { ReactNode } from 'react';

/**
 * 把描述文本里的「数值 + 单位」包成 <mark> 高亮。
 *
 * 单位表覆盖游戏内实际出现的量词：
 *   米/秒、米、秒、%、％       —— 数值类（用户明确要求）
 *   层、次、个、点              —— 层数/次数/个数
 *   名、处、台、座、段、圈、块、扇、张 —— 游戏文案里高频的计数单位
 *   例如「钩住 3 名逃生者」「点亮 1 处晦暗图腾」「至多 3 台发电机」
 *
 * 刻意要求「必须带单位」：避免把「1 | 你发出尖叫声」这种序号也点亮成一片。
 *
 * 用纯字符串切片 + 数组返回，不拼 innerHTML —— 数据来自外部，不留注入面。
 */
const UNIT_RE =
  /(\d+(?:\.\d+)?(?:\s*[-–~～]\s*\d+(?:\.\d+)?)?\s*(?:米\/秒|米|秒|%|％|层|次|个|点|名|处|台|座|段|圈|块|扇|张))/g;

export function highlightNumbers(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(UNIT_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(<mark key={key++}>{m[0]}</mark>);
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

/** 返回一段文本里被高亮的片段数量，供自检/统计用 */
export function countHighlights(text: string): number {
  return [...text.matchAll(UNIT_RE)].length;
}
