/**
 * 一次性脚本：补断魂小丑（The Terrifier / Art The Clown）的 20 件附加品
 *
 * 为什么手工：文本源（迷雾笔记）还没有这个章节，wiki.gg 只有英文，
 * 所以图标从 wiki 取、**文本由英文翻译成中文**（术语对齐官方 10.3.0 更新日志：
 * Bag of Toys=百宝袋、Toy=玩具、Torture=折磨、Terrified=恐惧、Deadliness=致命性、Taunting=嘲讽）。
 *
 * 做的事：
 *   1. 从 wiki 解析附加品表（名称/图标/稀有度/风味文本/描述）
 *   2. 下载 20 个图标 → WebP nearLossless
 *   3. 写 public/data/addons/k-45.json
 *   4. 追加到 addons-index.json（供「按效果搜索」用）
 *   5. 把 owners.json 里 k-45 的 counts.addon 改成 20
 *
 * 幂等：图标已存在则跳过；数据文件整体重写。
 *
 * 用法：node scripts/patch-10.3.0-addons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';
import sharp from 'sharp';

const API = 'https://deadbydaylight.wiki.gg/api.php';
const UA = { 'User-Agent': 'dbd-tool/0.1 (personal non-commercial archive)' };
const ICON_DIR = path.resolve('public/icons');
const DATA = path.resolve('public/data');
const OWNER_ID = 'k-45';

/* ---------- 稀有度映射（站内枚举只有 common|uncommon|rare|very-rare|ultra） ---------- */
const RARITY = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  'very-rare': 'very-rare',
  'ultra-rare': 'ultra',
  visceral: 'ultra',
};

/* ---------- 中文文本 ----------
   来源：用户从**游戏内**截取的中文原文（权威）。之前按 wiki 英文翻译的版本已作废 ——
   游戏内文本和 wiki 英文有几处实质差异，例如：
     · 爆炸礼物：wiki 说 20%，游戏内是 12%
     · 布鲁克的脓包：wiki 说加快破坏板/墙 25%，游戏内是按酸液洒落距离放大酸液池范围（最多 +100%）
     · 乔纳森的头骨：wiki 说 8 米 + 每层 2 米，游戏内是 10 米 + 每层 5 米；印记上限 wiki 10、游戏内 5
     · 死负鼠：游戏内限定「健康逃生者」
     · 闪亮三轮：游戏内是「显示气场 5 秒」，wiki 是「揭露位置 8 秒」
   标点统一成中文全角，其余措辞照抄游戏内文本。 */
const ZH = {
  'The Ninth Circle': {
    title: '第九圈',
    rarity: 'ultra',
    flavor: '虐待倾向，惊悚血腥，令人震惊。究竟什么样的人会对这种东西感兴趣？',
    description: [
      '每当你首次嘲讽一名处于恐惧状态的逃生者时，获得1层印记，至多4层。',
      '当大门通电时，如果拥有4层印记，百宝袋的冷却时间将缩短至1秒。',
    ],
  },
  'Duct Tape': {
    title: '布胶带',
    rarity: 'ultra',
    flavor: '用来限制受害者的行为，或许也能用来固定物品。',
    description: ['在打开百宝袋0.5秒内装配玩具，其冷却时间会缩短4秒。'],
  },
  "Jonathan's Skull": {
    title: '乔纳森的头骨',
    rarity: 'very-rare',
    flavor: '西耶娜弟弟的头骨，还戴着眼镜，太搞笑了！',
    description: [
      '使用玩具伤害或折磨一名逃生者，获得1层印记，至多5层。',
      '嘲讽会消耗所有印记，随后，如果至少消耗了1层印记，显示10米范围内所有逃生者气场6秒，在此基础上，每层印记使显示范围扩大5米。',
    ],
  },
  'Art Crispies': {
    title: '亚特脆饼',
    rarity: 'very-rare',
    flavor: '每个盒子里都藏着惊喜。',
    description: ['每当你折磨逃生者时，双方随机获得急速状态，其数值在5%至15%之间，持续5秒。'],
  },
  'Explosive Gift': {
    title: '爆炸礼物',
    rarity: 'very-rare',
    flavor: '让人放下戒心的礼物，绝对能“炸”场。',
    description: ['每有一个玩具达到最高致命性，你的恐惧范围就缩小12%。'],
  },
  'Wacky Jacks': {
    title: '疯狂杰克',
    rarity: 'very-rare',
    flavor: '摄入糖分达到每日推荐摄入量的110%。',
    description: ['玩具达到最高致命性所需点数不会超过5。'],
  },
  'Thornton Salt': {
    title: '桑顿盐',
    rarity: 'rare',
    flavor: '一小撮可不够。',
    description: ['遭受折磨的受伤逃生者会受到出血与重伤状态影响。此效果在移除折磨后仍会持续40秒。'],
  },
  'Dead Opossum': {
    title: '死负鼠',
    rarity: 'rare',
    flavor: '已无生命迹象，但仍有娱乐价值的尸体。',
    description: [
      '使用手枪或链枷命中健康逃生者会使24米范围内的所有其他逃生者发出尖叫声，并显示其位置，持续3秒。',
    ],
  },
  'Candy Head Bowl': {
    title: '糖果头碗',
    rarity: 'rare',
    flavor: '深入母亲的头颅，抓取糖果。',
    description: ['如果使用自行车喇叭探测到逃生者，重置百宝袋的冷却时间。'],
  },
  "Victoria's Eye": {
    title: '维多利亚的眼睛',
    rarity: 'rare',
    flavor: '虽然残破，但依旧能用。',
    description: ['直接使用火焰或酸液命中逃生者会显示其气场，持续5秒。'],
  },
  Emily: {
    title: '艾米丽',
    rarity: 'rare',
    flavor: '一个精致的小瓷娃娃，想必正在纳闷妈妈去哪儿了。',
    description: ['在百宝袋中可获取的玩具按固定顺序出现：自行车喇叭、手枪、喷火器、链枷、酸液瓶。'],
  },
  "Brooke's Pustule": {
    title: '布鲁克的脓包',
    rarity: 'uncommon',
    flavor: '酸液正在腐蚀布鲁克的脸，水泡不断冒出。',
    description: [
      '根据酸液洒落的距离，酸液池的范围最多可扩大100%，洒落6米后达到最大范围。',
      '如果对逃生者施加折磨，下一次搜寻百宝袋时一定能找到酸液瓶。',
    ],
  },
  'Burnt Wings': {
    title: '燃尽翅膀',
    rarity: 'uncommon',
    flavor: '西耶娜珍视的一切都化为了灰烬。',
    description: [
      '火焰的持续时间延长5秒。',
      '如果对逃生者施加折磨，下一次搜寻百宝袋时一定能找到喷火器。',
    ],
  },
  'Bloodstained Bullet': {
    title: '血迹斑斑的子弹',
    rarity: 'uncommon',
    flavor: '一颗沾血的子弹，曾嵌入塔拉的尸体中。',
    description: [
      '使用手枪，从16米以外射击逃生者，可获得10%急速状态，持续10秒。',
      '如果对逃生者施加折磨，下一次搜寻百宝袋时一定能找到手枪。',
    ],
  },
  "Sienna's Flesh": {
    title: '西耶娜的血肉',
    rarity: 'uncommon',
    flavor: '在一次残忍的殴打中从西耶娜身上撕下的皮肤。',
    description: [
      '链枷最大攻击距离增加20%。',
      '如果对逃生者施加折磨，下一次搜寻百宝袋时一定能找到链枷。',
    ],
  },
  'Shiny Tricycle': {
    title: '闪亮三轮',
    rarity: 'uncommon',
    flavor: '三轮设计确保你在血迹斑斑的地面上也能保持平衡。',
    description: [
      '当自行车喇叭探测到多名逃生者时，显示所有其他逃生者的气场，持续5秒。',
      '如果对逃生者施加折磨，下一次搜寻百宝袋时一定能找到自行车喇叭。',
    ],
  },
  'Bottle of Bleach': {
    title: '漂白水',
    rarity: 'common',
    flavor: '涂抹于伤口上会引起剧烈疼痛。还能杀死99.9%的家庭细菌！',
    description: ['折磨的衰减速度降低15%。'],
  },
  "Allie's Scalp": {
    title: '艾莉的头皮',
    rarity: 'common',
    flavor: '最恐怖的时刻从最简单的切割开始。',
    description: ['每场对局生效一次，普通攻击击倒遭受折磨的逃生者将使其陷入恐惧。'],
  },
  "Mike's Phone": {
    title: '麦克的手机',
    rarity: 'common',
    flavor: '已经稀巴烂，就像麦克的头一样。',
    description: ['使用玩具命中未在回退的发电机会将其特殊破坏。'],
  },
  'Blackened Heart': {
    title: '黑化心脏',
    rarity: 'common',
    flavor: '一颗仍在跳动的心脏，黑暗，爬满了蠕虫。',
    description: ['嘲讽一名恐惧逃生者后，下次使用玩具击倒一名逃生者时，该玩具将额外获得1点致命性。'],
  },
};

/**
 * 显示顺序 = 游戏内附加品列表的顺序（用户按游戏截图给出）。
 * 同一稀有度内的次序也照它，不再另行字母排序。
 */
const ORDER = [
  'The Ninth Circle',
  'Duct Tape',
  "Jonathan's Skull",
  'Art Crispies',
  'Explosive Gift',
  'Wacky Jacks',
  'Thornton Salt',
  'Dead Opossum',
  'Candy Head Bowl',
  "Victoria's Eye",
  'Emily',
  "Brooke's Pustule",
  'Burnt Wings',
  'Bloodstained Bullet',
  "Sienna's Flesh",
  'Shiny Tricycle',
  'Bottle of Bleach',
  "Allie's Scalp",
  "Mike's Phone",
  'Blackened Heart',
];

/* ---------- 工具 ---------- */
const clean = (s) => s.toLowerCase().replace(/ü/g, 'v').replace(/[^a-z0-9]/g, '');
function keys(text) {
  const full = pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  const first = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return { pinyin: clean(full.join('')), initials: clean(first.join('')) };
}
function hashGlyph(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 8;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const htmlToText = (s) =>
  s
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/* ---------- 1. 拉取并解析 wiki 表格 ---------- */
const usp = new URL(API);
usp.searchParams.set('action', 'parse');
usp.searchParams.set('page', 'Art The Clown');
usp.searchParams.set('prop', 'text');
usp.searchParams.set('section', '9');
usp.searchParams.set('format', 'json');
usp.searchParams.set('formatversion', '2');
const pageRes = await fetch(usp, { headers: UA, signal: AbortSignal.timeout(60000) });
const pageHtml = (await pageRes.json()).parse.text;

const rows = pageHtml.split('<tr>').slice(1);
const parsed = [];
for (const row of rows) {
  const iconStem = row.match(/alt="T UI iconAddon ([^"]+)\.png"/)?.[1];
  const name = row.match(/<th><a href="\/wiki\/[^"]+" title="([^"]+)">/)?.[1];
  if (!name || !iconStem) continue;
  /* 不能用 includes('rare-item-element')：'very-rare-item-element' 含该子串 */
  const rarityToken = row.match(/([a-z-]+)-item-element/)?.[1];
  parsed.push({
    name: htmlToText(name),
    iconStem,
    rarity: RARITY[rarityToken] ?? null,
    rawRarity: rarityToken,
  });
}

console.log(`wiki 解析到 ${parsed.length} 件附加品`);

/* ---------- 2. 下载图标 ---------- */
let downloaded = 0;
let skipped = 0;
for (const a of parsed) {
  const localName = `T_UI_iconAddon_${a.iconStem}.webp`;
  const dest = path.join(ICON_DIR, localName);
  a.icon = '/icons/' + localName;
  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  const q = new URL(API);
  q.searchParams.set('action', 'query');
  q.searchParams.set('titles', 'File:T UI iconAddon ' + a.iconStem + '.png');
  q.searchParams.set('prop', 'imageinfo');
  q.searchParams.set('iiprop', 'url');
  q.searchParams.set('iiurlwidth', '128');
  q.searchParams.set('format', 'json');
  q.searchParams.set('formatversion', '2');
  const info = await (await fetch(q, { headers: UA, signal: AbortSignal.timeout(60000) })).json();
  const page = info.query?.pages?.[0];
  const url = page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url;
  if (!url) {
    console.error(`  ✗ 找不到图标 ${a.iconStem}`);
    process.exitCode = 1;
    continue;
  }
  const bin = Buffer.from(
    await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) })).arrayBuffer(),
  );
  const webp = await sharp(bin, { failOn: 'none' })
    .webp({ nearLossless: true, quality: 60, effort: 6 })
    .toBuffer();
  fs.writeFileSync(dest, webp);
  console.log(`  ✓ ${localName.padEnd(40)} ${(webp.length / 1024).toFixed(1)}KB`);
  downloaded++;
}
console.log(`图标：下载 ${downloaded}，已存在 ${skipped}\n`);

/* ---------- 3. 组装数据 ---------- */
const entries = [];
const indexEntries = [];
const missing = [];

for (const a of parsed) {
  const zh = ZH[a.name];
  if (!zh) {
    missing.push(a.name);
    continue;
  }
  /* 稀有度以游戏内文本为准；和 wiki 表格不一致时告警，避免图标/稀有度错配 */
  if (zh.rarity !== a.rarity) {
    console.warn(`  ⚠ 稀有度不一致 ${a.name}：游戏内 ${zh.rarity} / wiki ${a.rarity}，采用游戏内`);
  }
  const id = `addon:bag_of_toys:${slug(a.name)}`;
  entries.push({
    id,
    kind: 'addon',
    ownerId: OWNER_ID,
    title: zh.title,
    titleEn: a.name,
    rarity: zh.rarity,
    description: zh.description,
    flavor: `“${zh.flavor}”`,
    icon: a.icon,
    glyph: hashGlyph(id),
    confidence: 1,
    source: `https://deadbydaylight.wiki.gg/wiki/${encodeURIComponent(a.name.replace(/ /g, '_'))}`,
    ...keys(zh.title),
  });
}

/* 双向校验：ORDER 与 ZH 必须完全一一对应，否则说明漏写/重名 */
const zhKeys = Object.keys(ZH).sort();
const orderKeys = [...ORDER].sort();
if (JSON.stringify(zhKeys) !== JSON.stringify(orderKeys)) {
  console.error('✗ ORDER 与文本表不一致');
  console.error('  只在文本表: ' + zhKeys.filter((k) => !orderKeys.includes(k)).join(', '));
  console.error('  只在 ORDER: ' + orderKeys.filter((k) => !zhKeys.includes(k)).join(', '));
  process.exit(1);
}

if (missing.length) {
  console.error('✗ 以下附加品缺中文翻译：' + missing.join(', '));
  process.exit(1);
}

/* 显示顺序 = 游戏内附加品列表的顺序（ORDER 常量）。
   之前按「稀有度降序 + 字母」排，虽然稀有度对了，但同档内的次序和游戏里不一样。 */
const rank = (en) => {
  const i = ORDER.indexOf(en);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
};
entries.sort((x, y) => rank(x.titleEn) - rank(y.titleEn));

/* 索引顺序跟 entries 一致，直接派生，避免两处排序逻辑漂移 */
indexEntries.length = 0;
for (const e of entries) {
  indexEntries.push({
    id: e.id,
    ownerId: e.ownerId,
    title: e.title,
    rarity: e.rarity,
    icon: e.icon,
    pinyin: e.pinyin,
    initials: e.initials,
    /* 与 import-dbd.mjs 的 normalizeForSearch 同一规则 */
    text: e.description.join('').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase(),
  });
}

fs.writeFileSync(path.join(DATA, 'addons', `${OWNER_ID}.json`), JSON.stringify(entries) + '\n');

/* ---------- 4. 重建索引里属于 k-45 的部分 ---------- */
const indexPath = path.join(DATA, 'addons-index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')).filter((x) => x.ownerId !== OWNER_ID);
index.push(...indexEntries);
fs.writeFileSync(indexPath, JSON.stringify(index) + '\n');

/* ---------- 5. 更新 owners.json 的配件数 ---------- */
const ownersPath = path.join(DATA, 'owners.json');
const ownersFile = JSON.parse(fs.readFileSync(ownersPath, 'utf8'));
const owner = ownersFile.owners.find((o) => o.id === OWNER_ID);
if (owner) owner.counts.addon = entries.length;
fs.writeFileSync(ownersPath, JSON.stringify(ownersFile) + '\n');

console.log('=== 完成 ===');
console.log(`  附加品 ${entries.length} 件 → public/data/addons/${OWNER_ID}.json`);
console.log(`  索引总条数 ${index.length}`);
console.log(`  owners.json 里 ${OWNER_ID} 的 counts.addon = ${owner?.counts.addon}`);
const dist = {};
for (const e of entries) dist[e.rarity] = (dist[e.rarity] ?? 0) + 1;
console.log('  稀有度分布 ' + JSON.stringify(dist));
