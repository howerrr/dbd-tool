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

/* ---------- 中文翻译（键 = wiki 上的英文名） ---------- */
const ZH = {
  "Allie's Scalp": {
    title: '艾莉的头皮',
    flavor: '最恐怖的时刻，往往始于一个简单的伤口。',
    description: ['每场对局一次，用普通攻击击倒处于折磨效果的逃生者时，对其施加恐惧状态。'],
  },
  'Blackened Heart': {
    title: '发黑的心脏',
    flavor: '一颗仍在跳动的心脏，乌黑，爬满了蛆虫。',
    description: ['嘲讽逃生者后，用玩具击倒逃生者时，该玩具额外获得1点致命性。'],
  },
  'Bottle of Bleach': {
    title: '漂白剂瓶',
    flavor: '涂在伤口上会带来剧烈的疼痛。还能杀灭99.9%的家用细菌！',
    description: ['折磨效果的衰减速度降低15%。'],
  },
  "Mike's Phone": {
    title: '迈克的手机',
    flavor: '它坏了，就像迈克的脑袋一样。',
    description: ['用玩具命中未处于回退状态的发电机时，该发电机损失5%进度并开始回退。'],
  },
  'Bloodstained Bullet': {
    title: '染血弹头',
    flavor: '一颗卡在塔拉尸体里的带血子弹。',
    description: [
      '射击16米以外的逃生者时，获得10%急速状态，持续10秒。',
      '当你施加折磨效果时，下一次开启百宝袋必定出现手枪。',
    ],
  },
  "Brooke's Pustule": {
    title: '布鲁克的脓疱',
    flavor: '一个不断渗液的水泡，酸液腐蚀布鲁克脸部时还在冒泡。',
    description: [
      '站在酸液池中期间，以及离开酸液池后的5秒内，破坏木板和可破坏墙壁的速度提高25%。',
      '当你施加折磨效果时，下一次开启百宝袋必定出现酸液瓶。',
    ],
  },
  'Burnt Wings': {
    title: '烧焦的翅膀',
    flavor: '西耶娜珍视的一切都在烈火中化为灰烬。',
    description: [
      '火焰的持续时间延长5秒。',
      '当你施加折磨效果时，下一次开启百宝袋必定出现喷火器。',
    ],
  },
  'Shiny Tricycle': {
    title: '闪亮的三轮车',
    flavor: '三个轮子意味着，即使在血流成河的地面上你也能保持平衡。',
    description: [
      '当自行车喇叭侦测到超过1名逃生者时，揭露其他未被侦测到的逃生者的位置，持续8秒。',
      '当你施加折磨效果时，下一次开启百宝袋必定出现自行车喇叭。',
    ],
  },
  "Sienna's Flesh": {
    title: '西耶娜的血肉',
    flavor: '一块在残酷殴打中从西耶娜身上撕下的皮肉。',
    description: [
      '链枷的攻击范围扩大20%。',
      '当你施加折磨效果时，下一次开启百宝袋必定出现链枷。',
    ],
  },
  'Candy Head Bowl': {
    title: '糖果头骨碗',
    flavor: '把手伸进妈妈的头骨里，抓点糖吃。',
    description: ['用自行车喇叭侦测到逃生者时，重置百宝袋的冷却时间。'],
  },
  'Dead Opossum': {
    title: '死负鼠',
    flavor: '一具了无生气的尸体，却依然颇具娱乐价值。',
    description: ['用手枪或链枷命中逃生者时，揭露24米范围内所有其他逃生者的位置，持续3秒。'],
  },
  Emily: {
    title: '艾米莉',
    flavor: '一个瓷娃娃，它一定在想妈妈去哪儿了。',
    description: [
      '百宝袋中可用的玩具将以固定顺序出现：',
      '·自行车喇叭。',
      '·手枪。',
      '·喷火器。',
      '·链枷。',
      '·酸液瓶。',
    ],
  },
  'Thornton Salt': {
    title: '桑顿的盐',
    flavor: '有点消化过头了，不过除此之外还能用。',
    description: ['处于折磨效果的逃生者会受到重伤和出血状态影响。折磨效果结束后，这些状态仍将持续40秒。'],
  },
  "Victoria's Eye": {
    title: '维多利亚的眼睛',
    flavor: '有点消化过头了，不过除此之外还能用。',
    description: ['用酸液瓶或喷火器命中逃生者时，揭露其气场，持续5秒。'],
  },
  'Art Crispies': {
    title: '阿特脆片',
    flavor: '每盒都有惊喜！',
    description: ['当你施加折磨效果时，你与该逃生者都获得5%~15%的急速状态，持续5秒。'],
  },
  'Explosive Gift': {
    title: '爆炸礼物',
    flavor: '一份让人放下戒备的欢乐礼物，绝对会引爆全场。',
    description: ['每有一件达到最高致命性的玩具，你的恐惧范围缩小20%。'],
  },
  "Jonathan's Skull": {
    title: '乔纳森的头骨',
    flavor: '西耶娜哥哥那颗戴着眼镜的头骨。太搞笑了！',
    description: [
      '用玩具对逃生者造成伤害或施加折磨效果时获得1层印记，至多10层。',
      '手动嘲讽会消耗所有印记，若至少消耗了1层，则在6秒内揭露8米范围内所有逃生者的气场，每层印记额外增加2米。',
    ],
  },
  'Wacky Jacks': {
    title: '疯狂抓子',
    flavor: '达到每日推荐糖摄入量的110%。',
    description: ['致命性上限降低1点，至5点。'],
  },
  'Duct Tape': {
    title: '强力胶带',
    flavor: '本是为了束缚受害者而造，但大概也能用来把东西固定住。',
    description: ['在开启百宝袋后0.5秒内装备玩具时，该玩具的冷却时间缩短5秒。'],
  },
  'The Ninth Circle': {
    title: '第九圈',
    flavor: '残忍、诡异，血腥得令人震惊。什么样的人会对此感兴趣？',
    description: [
      '首次嘲讽逃生者时获得1层印记。',
      '当出口大门通电且第九圈拥有4层印记时，百宝袋的冷却时间缩短至1秒。',
    ],
  },
};

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
  const id = `addon:bag_of_toys:${slug(a.name)}`;
  entries.push({
    id,
    kind: 'addon',
    ownerId: OWNER_ID,
    title: zh.title,
    titleEn: a.name,
    rarity: a.rarity,
    description: zh.description,
    flavor: `“${zh.flavor}”`,
    icon: a.icon,
    glyph: hashGlyph(id),
    confidence: 1,
    source: `https://deadbydaylight.wiki.gg/wiki/${encodeURIComponent(a.name.replace(/ /g, '_'))}`,
    ...keys(zh.title),
  });
  indexEntries.push({
    id,
    ownerId: OWNER_ID,
    title: zh.title,
    rarity: a.rarity,
    icon: a.icon,
    ...keys(zh.title),
    /* 与 import-dbd.mjs 的 normalizeForSearch 同一规则 */
    text: zh.description.join('').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase(),
  });
}

if (missing.length) {
  console.error('✗ 以下附加品缺中文翻译：' + missing.join(', '));
  process.exit(1);
}

/* 按稀有度→名称排序，和 wiki 表格一致的观感 */
const order = { common: 0, uncommon: 1, rare: 2, 'very-rare': 3, ultra: 4 };
entries.sort((x, y) => order[x.rarity] - order[y.rarity] || x.titleEn.localeCompare(y.titleEn));
indexEntries.sort((x, y) => order[x.rarity] - order[y.rarity] || x.title.localeCompare(y.title));

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
