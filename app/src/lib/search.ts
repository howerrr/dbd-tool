/**
 * 检索匹配。
 *
 * 支持四种输入：
 *   中文名（含「·」等标点忽略） / 英文名 / 拼音全拼 / 拼音首字母
 *
 * 拼音字段在构建期就由 scripts/gen-seed-data.mjs 算好写进 JSON，
 * 运行时只做字符串比较，不引任何拼音库。
 */

interface Searchable {
  pinyin?: string;
  initials?: string;
}

/** 归一化：小写、ü→v、去掉空白与常见标点 */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ü/g, 'v')
    .replace(/[\s·.'’`\-_:：,，]/g, '');

/**
 * 描述正文的检索归一化：只留中文/字母/数字。
 * 构建期（配件索引）与运行期（技能描述）都用这一份规则，保证可比较。
 */
export const normText = (s: string): string =>
  s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();

/**
 * 多选筛选词（**AND 语义**）：所有筛选词都出现在正文里才算命中。
 * 例如同时选「无法侦测」+「图腾」，只留下两个词都提到的条目
 * （厄咒：毁灭序曲 —— 点亮晦暗图腾 + 获得无法侦测）。
 *
 * `normTerms` 必须是已经用 `normText` 归一化过的词，`text` 同理；
 * 调用方在渲染前把词表归一化一次即可，避免每条目都重算。
 */
export function matchesAllTerms(text: string, normTerms: readonly string[]): boolean {
  for (const t of normTerms) {
    if (!text.includes(t)) return false;
  }
  return true;
}

export function matchesQuery(
  query: string,
  name: string,
  nameEn: string | null | undefined,
  keys: Searchable,
  /** 已归一化的描述正文，用于「按效果搜索」（如搜「疲劳」） */
  extraText?: string,
): boolean {
  const q = norm(query);
  if (!q) return true;

  if (norm(name).includes(q)) return true;
  if (nameEn && norm(nameEn).includes(q)) return true;

  const py = keys.pinyin ?? '';
  const ini = keys.initials ?? '';
  // 首字母只认前缀（输入 sxz 命中 设陷者，但不该被随便一段字母命中）
  if (ini.startsWith(q)) return true;
  // 全拼允许前缀和包含（she → 设陷者；xianzhe → 设陷者）
  if (py.startsWith(q) || py.includes(q)) return true;

  // 最后才查描述正文
  if (extraText && extraText.includes(q)) return true;

  return false;
}
