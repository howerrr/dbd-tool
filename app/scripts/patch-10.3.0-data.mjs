/**
 * 一次性脚本：把 10.3.0（Terrifier 章节）的文本数据补进 public/data
 *
 * 为什么手工补：文本来源是迷雾笔记，而它的 perks.site.json 还停在 2026-10-17，
 * 既没有新章节、被改技能的数值也是旧的（见 README 的「数据缺口」）。
 * 这些文本取自**官方 10.3.0 更新日志**（B 站「黎明杀机官方」专栏 cv54070627）。
 * 等迷雾笔记跟上之后跑 `npm run import` 会覆盖本脚本的结果 —— 属于正常。
 *
 * 做的事：
 *   1. owners.json 插入 断魂小丑(k-45) / 西耶娜·肖(s-54)
 *   2. perks/killer.json 新增 3 条、更新 4 条
 *   3. perks/survivor.json 新增 3 条、更新 3 条
 *
 * 幂等：已存在的技能不会被重复插入，但描述会被刷新成这里的文本。
 *
 * 用法：node scripts/patch-10.3.0-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';

const DATA = path.resolve('public/data');

/* ---------- 字段工具（与 import-dbd.mjs 保持一致） ---------- */
const clean = (s) => s.toLowerCase().replace(/ü/g, 'v').replace(/[^a-z0-9]/g, '');
function keys(text) {
  const full = pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  const first = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return { pinyin: clean(full.join('')), initials: clean(first.join('')) };
}
/** 稳定小整数，用于无图标时的占位形状 */
function hashGlyph(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 8;
}

const read = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
const write = (rel, obj) => fs.writeFileSync(path.join(DATA, rel), JSON.stringify(obj) + '\n');

/* ---------- 1. 新角色 ---------- */
const NEW_OWNERS = [
  {
    id: 'k-45',
    side: 'killer',
    nameEn: 'The Terrifier',
    name: '断魂小丑',
    avatar: '/icons/chars/k-45.webp',
    counts: { perk: 3, addon: 0 }, // 附加品等迷雾笔记收录后再补
  },
  {
    id: 's-54',
    side: 'survivor',
    nameEn: 'Sienna Shaw',
    name: '西耶娜·肖',
    avatar: '/icons/chars/s-54.webp',
    counts: { perk: 3, addon: 0 },
  },
];

/* ---------- 2. 新技能（正文取自官方 10.3.0 更新日志） ---------- */
const NEW_PERKS = [
  {
    file: 'perks/killer.json',
    id: 'perk:killer-laughingstock',
    ownerId: 'k-45',
    title: '笑料',
    titleEn: 'Laughingstock',
    icon: '/icons/T_UI_iconsPerks_Laughingstock.webp',
    page: 'Laughingstock',
    description: [
      '如果逃生者在修理完成的发电机附近12米范围内：',
      '·受到疲劳状态影响。',
      '·受到浑然不觉状态影响。',
      '离开范围后效果维持3/4/5秒。',
      '你能看到完成修理发电机的气场。',
    ],
  },
  {
    file: 'perks/killer.json',
    id: 'perk:killer-killspree',
    ownerId: 'k-45',
    title: '大开杀戒',
    titleEn: 'Kill Spree',
    icon: '/icons/T_UI_iconsPerks_KillSpree.webp',
    page: 'Kill Spree',
    description: [
      '如果所有剩余逃生者都达到2次上钩状态并且所有发电机修理完成，你可以击杀逃生者。',
      '击杀一名逃生者期间，两个出口大门开关会被封锁。',
      '击杀完成12/16/20秒后，此效果结束。',
    ],
  },
  {
    file: 'perks/killer.json',
    id: 'perk:killer-funnybusiness',
    ownerId: 'k-45',
    title: '恶作剧',
    titleEn: 'Funny Business',
    icon: '/icons/T_UI_iconsPerks_FunnyBusiness.webp',
    page: 'Funny Business',
    description: [
      '每当你破坏一台发电机时，你将获得10%急速状态，持续10秒，且随机出现以下效果之一：',
      '·10%急速状态延长5秒。',
      '·被击晕2秒。',
      '·受影响的发电机被封锁30秒。',
      '·出现彩色纸屑，但无事发生。',
      '冷却时间60/50/40秒。同一效果不会连续出现两次。',
    ],
  },
  {
    file: 'perks/survivor.json',
    id: 'perk:survivor-valkyriesrage',
    ownerId: 's-54',
    title: '女武神之怒',
    titleEn: "Valkyrie's Rage",
    icon: '/icons/T_UI_iconsPerks_ValkyriesRage.webp',
    page: "Valkyrie's Rage",
    description: ['被追逐40/35/30秒后，下一次用木板击晕杀手，眩晕持续时间延长75%。'],
  },
  {
    file: 'perks/survivor.json',
    id: 'perk:survivor-sharedtrauma',
    ownerId: 's-54',
    title: '共同创伤',
    titleEn: 'Shared Trauma',
    icon: '/icons/T_UI_iconsPerks_SharedTrauma.webp',
    page: 'Shared Trauma',
    description: [
      '当你承受保护攻击时，12米范围内所有逃生者在接下来的30/35/40秒内即使奔跑也能从疲劳状态中恢复。',
      '你能看见32米范围内处于疲劳状态逃生者的气场。',
    ],
  },
  {
    file: 'perks/survivor.json',
    id: 'perk:survivor-bestgiftever',
    ownerId: 's-54',
    title: '最佳礼物',
    titleEn: 'Best Gift Ever',
    icon: '/icons/T_UI_iconsPerks_BestGiftEver.webp',
    page: 'Best Gift Ever',
    description: [
      '对局开始时，拥有4/5/6层印记。',
      '每当你首次扔下某一种类的道具时，消耗1层印记，该道具被消耗。随后，根据道具种类分别出现以下效果：',
      '·手电筒：每当你击晕杀手时，该杀手还会被致盲2秒。',
      '·迷雾瓶：每当你快速翻越时，5秒内，你的血丝划痕消失速度加快50%。',
      '·钥匙：每个箱子可以多翻找1次。',
      '·地图：气场对你可见持续时间延长1秒。',
      '·医疗箱：治疗另一名逃生者期间，你也以25%速度获得治疗进度。',
      '·工具箱：相距最近的3台发电机气场对你可见。',
    ],
  },
];

/* ---------- 3. 被调整的技能（覆盖成 10.3.0 正式版数值） ---------- */
const UPDATED_PERKS = [
  {
    title: '暗黑感知',
    description: [
      '对局开始时，以及每当一台发电机修理完成后，你获得1层印记，至多5层。',
      '当杀手进入你附近20米范围内时，消耗1层印记，随后，在接下来的13/14/15秒内：',
      '·32米范围内木板和窗户的气场对你可见。',
      '·其他逃生者气场对你可见。',
      '·杀手气场对你可见。',
    ],
  },
  {
    title: '安抚生灵',
    description: [
      '你不会惊扰乌鸦或发出尖叫声。',
      '你祝福和净化图腾时、解锁箱子时不会发出声响，并且速度加快23/24/25%。',
    ],
  },
  {
    title: '逃之夭夭',
    description: [
      '其他逃生者解救你的速度加快65/70/75%。',
      '每当你被解救，额外获得7%急速状态。',
    ],
  },
  {
    title: '心暗气傲',
    description: [
      '普通翻越窗户速度加快15%。',
      '普通攻击成功后冷却时间缩短13/14/15%。',
      '被致盲或被木板击晕时，持续时间延长15%。',
    ],
  },
  {
    title: '天灾钩子：鬼魔神龛',
    description: [
      '对局开始时：',
      '·随机4处钩子变为天灾钩子。',
      '·地下室钩子变为天灾钩子。',
      '当你与被天灾钩子钩住的逃生者相距至少24米时，所有无人修理的发电机将以200%的速度回退。',
      '逃生者不再处于上钩状态后，此效果仍将持续20/25/30秒。',
    ],
  },
  {
    title: '贪食',
    description: [
      '每名逃生者首次被钩住时，你获得1层印记。每层印记：',
      '·搬运逃生者期间获得4%急速状态。',
      '·钩住逃生者的速度加快4%。',
      '拥有4层印记时，所有逃生者：',
      '·发出尖叫声。',
      '·受到危险状态影响，持续60/65/70秒。',
    ],
  },
  {
    title: '恶灵低语',
    description: [
      '距离逃生者28/26/24米范围内时，你偶尔会听到恶灵的低语。',
      '距离逃生者28/26/24米以上时，获得7%急速状态。',
    ],
  },
];

/* ---------- 执行 ---------- */
let addedOwners = 0;
let addedPerks = 0;
let updatedPerks = 0;

const ownersFile = read('owners.json');
for (const o of NEW_OWNERS) {
  if (ownersFile.owners.some((x) => x.id === o.id)) continue;
  ownersFile.owners.push({ ...o, ...keys(o.name) });
  addedOwners++;
}
/* 保持同阵营相邻：把新条目移到该阵营最后一位 */
for (const side of ['killer', 'survivor']) {
  const mine = ownersFile.owners.filter((o) => o.side === side);
  const others = ownersFile.owners.filter((o) => o.side !== side);
  const sorted = [...mine].sort((a, b) => {
    const rank = (id) => (id === 'universal' ? -1 : Number(id.slice(2)));
    return rank(a.id) - rank(b.id);
  });
  ownersFile.owners = side === 'killer' ? [...sorted, ...others] : [...others, ...sorted];
}
if (addedOwners) {
  ownersFile.version = ownersFile.version.includes('patch-10.3.0')
    ? ownersFile.version
    : ownersFile.version + '+patch-10.3.0';
  write('owners.json', ownersFile);
}

for (const p of NEW_PERKS) {
  const list = read(p.file);
  if (list.some((x) => x.id === p.id)) continue;
  list.push({
    id: p.id,
    kind: 'perk',
    ownerId: p.ownerId,
    title: p.title,
    titleEn: p.titleEn,
    description: p.description,
    flavor: '',
    icon: p.icon,
    glyph: hashGlyph(p.id),
    confidence: 1,
    source: `https://deadbydaylight.wiki.gg/wiki/${encodeURIComponent(p.page.replace(/ /g, '_'))}`,
    ...keys(p.title),
  });
  write(p.file, list);
  addedPerks++;
}

for (const u of UPDATED_PERKS) {
  let touched = false;
  for (const file of ['perks/killer.json', 'perks/survivor.json']) {
    const list = read(file);
    const perk = list.find((x) => x.title === u.title);
    if (!perk) continue;
    perk.description = u.description;
    write(file, list);
    touched = true;
    updatedPerks++;
    break;
  }
  if (!touched) console.log(`  ⚠ 找不到要更新的技能：${u.title}`);
}

console.log('=== 完成 ===');
console.log(`  新角色 ${addedOwners} 个`);
console.log(`  新技能 ${addedPerks} 条`);
console.log(`  更新技能 ${updatedPerks} 条`);
console.log(`  owners.json version: ${read('owners.json').version}`);
