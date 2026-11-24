export type Side = 'killer' | 'survivor';

export type Kind = 'perk' | 'addon';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'ultra';

export interface Owner {
  /** 'universal' | 'k-01' … —— 阶段 B 换成正式 slug */
  id: string;
  side: Side;
  name: string;
  nameEn: string | null;
  /** 头像图片路径；为 null 时用名字首字做占位 */
  avatar: string | null;
  counts: { perk: number; addon: number };
  /** 构建期算好的检索字段，运行时零成本 */
  pinyin?: string;
  initials?: string;
}

export interface Entry {
  id: string;
  kind: Kind;
  ownerId: string;
  title: string;
  titleEn?: string | null;
  /** 仅 addon 有；技能没有稀有度概念 */
  rarity?: Rarity;
  description: string[];
  flavor?: string;
  icon: string | null;
  /** 占位图标序号（真实图标到位后由 icon 取代） */
  glyph: number;
  confidence?: number;
  /** 构建期算好的检索字段 */
  pinyin?: string;
  initials?: string;
}

export interface OwnersFile {
  version: string;
  generatedAt: string;
  owners: Owner[];
}

/**
 * 配件的跨角色搜索索引条目。
 * 配件本身按角色分包（`data/addons/{ownerId}.json`），为了搜索不去下载 44 个分包，
 * 构建期额外产出一份只含检索与展示字段的轻量索引。
 */
export interface AddonIndexEntry {
  id: string;
  ownerId: string;
  title: string;
  /** 英文名（从 wiki 补齐；「通用」的枯萎血清没有对应杀手页，可能为 null） */
  titleEn?: string | null;
  rarity: Rarity | null;
  icon: string | null;
  pinyin: string;
  initials: string;
  /** 已是「只留中文/字母/数字 + 小写」的描述正文，用于按效果搜索 */
  text: string;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  'very-rare': '非常稀有',
  ultra: '非凡',
};

export const SIDE_LABEL: Record<Side, { cn: string; en: string }> = {
  killer: { cn: '杀手', en: 'Killer' },
  survivor: { cn: '人类', en: 'Survivor' },
};

export const isSide = (v: string | undefined): v is Side => v === 'killer' || v === 'survivor';
