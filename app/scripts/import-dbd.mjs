/**
 * 真实数据导入（W3）
 *
 * 数据来源与合规（务必保留）：
 *   文本数据：迷雾笔记 dbdwiki.com 的公开 JSON
 *            原创整理部分为 CC BY-NC-SA 4.0 —— 仅非商业使用，必须署名，衍生需同协议共享。
 *   图标：   deadbydaylight.wiki.gg 的 128px 缩略图（图标与语言无关）
 *
 * 为什么不用 wiki.gg 的英文数据表：
 *   wiki.gg 只有 de/es/fr/it/pl，没有中文；Module:Datatable 全英文。
 *
 * 用法：
 *   node scripts/import-dbd.mjs              # 全量（含图标下载）
 *   node scripts/import-dbd.mjs --no-icons   # 只导文本，不下载图标
 *   node scripts/import-dbd.mjs --icons-only # 只补图标
 */
import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';
import sharp from 'sharp';

/* ============ 配置 ============ */
const DBD = 'https://dbdwiki.com';
const ICON_API = 'https://deadbydaylight.wiki.gg/api.php';
const ICON_UA = 'dbd-tool/0.1 (personal non-commercial archive)';

const OUT = path.resolve('public/data');
const ICON_DIR = path.resolve('public/icons');
const CACHE = path.resolve('.cache');

/**
 * 图标统一落盘成 WebP。
 *
 * 用 **nearLossless** 而不是普通有损：实测 8 个真实图标（技能 + 配件）上，
 * nearLossless 不但把最大色差压到 **2**（肉眼等同无损），
 * 体积还比 q92 更小（例如 bloodyCoil 8.0KB vs 11.7KB）——
 * 平面色块 + 硬边的游戏图标经不起色度采样，有损档反而更浪费。
 *
 * ⚠️ 参数必须和 scripts/to-webp.mjs 的 ICON_WEBP 一致，
 *    否则「重新导入」和「存量转换」的产物质量会不一样。
 */
const WEBP_OPTIONS = { nearLossless: true, quality: 60, effort: 6 };
/** wiki 的 PNG 文件名 → 本地落盘的 WebP 文件名 */
const toWebpName = (pngName) => pngName.replace(/\.png$/i, '.webp');
/** 数据里的图标路径（与落盘扩展名保持一致，否则全是 404） */
const iconPath = (pngName) => `/icons/${toWebpName(pngName)}`;

const argv = process.argv.slice(2);
const NO_ICONS = argv.includes('--no-icons');
const ICONS_ONLY = argv.includes('--icons-only');

/* ============ 工具 ============ */
const clean = (s) => s.toLowerCase().replace(/ü/g, 'v').replace(/[^a-z0-9]/g, '');
function keys(text) {
  const full = pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  const first = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return { pinyin: clean(full.join('')), initials: clean(first.join('')) };
}

/**
 * 供「按效果搜索」用的描述正文：只保留中文、字母、数字。
 * 客户端拿到后直接 includes() 比较，不需要每次按键都跑正则。
 */
const normalizeForSearch = (s) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();

/** 稳定的小整数，用于没有真实图标时的占位形状 */
function hashGlyph(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 8;
}

async function fetchJSON(url, cacheName) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, cacheName);
  if (fs.existsSync(f)) {
    const age = Date.now() - fs.statSync(f).mtimeMs;
    if (age < 12 * 3600 * 1000) {
      console.log(`  (缓存) ${cacheName}`);
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const t = await r.text();
  fs.writeFileSync(f, t);
  console.log(`  (下载) ${cacheName} ${(t.length / 1024).toFixed(0)}KB`);
  return JSON.parse(t);
}

function writeJSON(rel, obj, label) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const body = JSON.stringify(obj);
  fs.writeFileSync(p, body + '\n');
  console.log(`  → ${rel.padEnd(30)} ${(body.length / 1024).toFixed(1)}KB  ${label ?? ''}`);
}

const RARITY_BY_LABEL = {
  普通: 'common',
  精良: 'uncommon',
  稀有: 'rare',
  非常稀有: 'very-rare',
  非凡: 'ultra',
};

/**
 * 版权到期后转为「通用」的角色专属技能。
 *
 * 迈克尔·迈尔斯（Halloween 联动到期）的三个技能在源数据里被归到了「通用」，
 * 导致他的技能分区是空的。这里把这三条同时复制一份挂回他身上，
 * 既保留它们在通用里的存在（现在确实所有杀手都能用），也让迈尔斯的页面完整。
 *
 * 依据用户确认：留到最后 / 玩弄掌间 / 优胜劣汰
 */
const OWNER_PERK_ALIASES = {
  'k-05': ['留到最后', '玩弄掌间', '优胜劣汰'],
};

/**
 * 源的图标文件名有的是预先百分号编码过的（IconPerks_coupDeGr%C3%A2ce.png），
 * 既查不到 wiki 也对不上磁盘。统一解码成真实字符。
 */
function normalizeIconName(raw) {
  if (!raw) return null;
  if (!raw.includes('%')) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/* ============ 主流程 ============ */
console.log('\n=== 1. 拉取源数据 ===');
const perkSrc = await fetchJSON(`${DBD}/data/dbd/perks.site.json`, 'perks.site.json');
const addonSrc = await fetchJSON(`${DBD}/data/dbd/killer-addons.site.json`, 'killer-addons.site.json');
const killerOrder = await fetchJSON(`${DBD}/data/dbd/killer-owner-order.json`, 'killer-owner-order.json');
const survivorOrder = await fetchJSON(`${DBD}/data/dbd/survivor-owner-order.json`, 'survivor-owner-order.json');

console.log(`  技能 ${perkSrc.perks.length} 条 | 配件模块 ${addonSrc.modules.length} 个`);

/* ---------- 2. 角色 ---------- */
console.log('\n=== 2. 重建角色列表 ===');
const orderMap = new Map();
killerOrder.owners.forEach((n, i) => orderMap.set(`killer:${n}`, i));
survivorOrder.owners.forEach((n, i) => orderMap.set(`survivor:${n}`, i));

const ownerMap = new Map(); // `${side}:${name}` -> owner
const ensureOwner = (side, name, nameEn) => {
  const k = `${side}:${name}`;
  let o = ownerMap.get(k);
  if (!o) {
    o = {
      id: name === '通用' ? 'universal' : null,
      side,
      // 源的 character_en 对「通用」给的是垃圾值 ". All"，直接覆盖
      nameEn: name === '通用' ? 'Universal' : (nameEn ?? null),
      name,
      avatar: null,
      counts: { perk: 0, addon: 0 },
    };
    ownerMap.set(k, o);
  }
  if (!o.nameEn && nameEn && name !== '通用') o.nameEn = nameEn;
  return o;
};

/* 技能：按 owner 归组 */
for (const p of perkSrc.perks) {
  const side = p.side === 'killer' ? 'killer' : 'survivor';
  const o = ensureOwner(side, p.owner, p.icon?.character_en);
  o.counts.perk++;
}

/* 配件：模块里带 owner_en */
for (const m of addonSrc.modules) {
  const o = ensureOwner('killer', m.owner, m.owner_en);
  o.counts.addon += m.addons?.length ?? 0;
}

/* 排序：通用在最前，其余按官方顺序；顺序表里没有的排在最后并告警 */
const unknown = [];
function sortOwners(list, side) {
  return list.sort((a, b) => {
    const ia = orderMap.get(`${side}:${a.name}`);
    const ib = orderMap.get(`${side}:${b.name}`);
    if (a.name === '通用') return -1;
    if (b.name === '通用') return 1;
    if (ia === undefined || ib === undefined) {
      if (ia === undefined) unknown.push(`${side}:${a.name}`);
      if (ib === undefined) unknown.push(`${side}:${b.name}`);
      return (ia ?? 999) - (ib ?? 999);
    }
    return ia - ib;
  });
}

const killers = sortOwners([...ownerMap.values()].filter((o) => o.side === 'killer'), 'killer');
const survivors = sortOwners([...ownerMap.values()].filter((o) => o.side === 'survivor'), 'survivor');

/* 生成 id 与检索字段 */
for (const [side, list] of [['killer', killers], ['survivor', survivors]]) {
  const prefix = side === 'killer' ? 'k' : 's';
  let n = 0;
  for (const o of list) {
    if (o.name !== '通用') o.id = `${prefix}-${String(++n).padStart(2, '0')}`;
    Object.assign(o, keys(o.name));
  }
}

console.log(`  杀手 ${killers.length} 位 | 逃生者 ${survivors.length} 位`);
if (unknown.length) console.log(`  ⚠ 官方顺序表里没有: ${[...new Set(unknown)].join(', ')}`);

/* 统计有多少角色真的有内容 */
const filledK = killers.filter((o) => o.counts.perk + o.counts.addon).length;
const filledS = survivors.filter((o) => o.counts.perk).length;
console.log(`  有内容：杀手 ${filledK}/${killers.length}、逃生者 ${filledS}/${survivors.length}`);
const emptyOnes = [...killers, ...survivors].filter((o) => !o.counts.perk && !o.counts.addon);
if (emptyOnes.length) console.log(`  ⚠ 完全没有条目的角色: ${emptyOnes.map((o) => o.name).join(', ')}`);

/* ---------- 3. 图标清单 ---------- */
console.log('\n=== 3. 解析图标文件名 ===');
/** filename -> 本地路径 */
const iconFileSet = new Set();
const perkIconFile = new Map(); // perk.id -> filename
const addonIconFile = new Map(); // addon.id -> filename

for (const p of perkSrc.perks) {
  const f = normalizeIconName(p.icon?.iconFilename ?? p.icon?.key ?? null);
  if (f) {
    perkIconFile.set(p.id, f);
    iconFileSet.add(f);
  }
}
for (const m of addonSrc.modules) {
  for (const a of m.addons ?? []) {
    const f = normalizeIconName(a.iconFilename ?? null);
    if (f) {
      addonIconFile.set(a.id, f);
      iconFileSet.add(f);
    }
  }
}
console.log(`  唯一图标文件 ${iconFileSet.size} 个（技能 ${perkIconFile.size} / 配件 ${addonIconFile.size}）`);

/* ---------- 4. 写文本数据 ---------- */
if (!ICONS_ONLY) {
  console.log('\n=== 4. 写入文本数据 ===');

  const ownerLookup = new Map();
  for (const o of [...killers, ...survivors]) ownerLookup.set(`${o.side}:${o.name}`, o);

  for (const side of ['killer', 'survivor']) {
    const entries = perkSrc.perks
      .filter((p) => (p.side === 'killer' ? 'killer' : 'survivor') === side)
      .map((p) => {
        const owner = ownerLookup.get(`${side}:${p.owner}`);
        const iconFile = perkIconFile.get(p.id);
        return {
          id: `perk:${p.id}`,
          kind: 'perk',
          ownerId: owner?.id ?? null,
          title: p.title,
          titleEn: p.icon?.name_en ?? null,
          // 技能没有稀有度（只有 I/II/III 等级），刻意不写 rarity
          description: Array.isArray(p.description) ? p.description : [],
          flavor: p.flavor ?? '',
          icon: iconFile ? iconPath(iconFile) : null,
          glyph: hashGlyph(p.id),
          confidence: p.icon?.needs_review ? 0.6 : 1,
          // dbdwiki 是 SPA，没有单条目 URL；指向 wiki.gg 的英文页更有用
          source: p.icon?.name_en
            ? `https://deadbydaylight.wiki.gg/wiki/${encodeURIComponent(p.icon.name_en.replace(/ /g, '_'))}`
            : null,
          ...keys(p.title),
        };
      });

    /* 把「转通用」的专属技能复制回原角色 */
    const byId = new Map([...ownerLookup.values()].map((o) => [o.id, o]));
    for (const [ownerId, titles] of Object.entries(OWNER_PERK_ALIASES)) {
      const owner = byId.get(ownerId);
      if (!owner || owner.side !== side) continue;
      for (const title of titles) {
        const src = entries.find((e) => e.ownerId === 'universal' && e.title === title);
        if (!src) {
          console.log(`  ⚠ 别名技能未找到: ${title}（${owner.name}）`);
          continue;
        }
        entries.push({ ...src, id: `${src.id}@${ownerId}`, ownerId });
        console.log(`  ↪ 复制「${title}」→ ${owner.name}`);
      }
      owner.counts.perk = entries.filter((e) => e.ownerId === ownerId).length;
    }

    writeJSON(`perks/${side}.json`, entries, `${entries.length} 条技能`);
  }

  /* owners.json 必须在这里写：
     上面的别名逻辑会改动 counts.perk，提前写会导致计数为 0。 */
  // 保留上一轮已经导好的角色头像，避免每次重新导入都要重下 97 张图
  const prevAvatars = new Map();
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'owners.json'), 'utf8'));
    for (const o of prev.owners ?? []) if (o.avatar) prevAvatars.set(o.id, o.avatar);
  } catch {
    /* 首次导入没有旧文件 */
  }
  for (const o of [...killers, ...survivors]) {
    const kept = prevAvatars.get(o.id);
    if (kept && fs.existsSync(path.join('public', kept))) o.avatar = kept;
  }

  writeJSON(
    'owners.json',
    {
      version: 'dbdwiki-' + (perkSrc.generated_at ?? '').slice(0, 10),
      generatedAt: new Date().toISOString(),
      owners: [...killers, ...survivors],
    },
    `${killers.length + survivors.length} 位角色`,
  );

  /* 配件：一个屠夫一个文件 */
  let files = 0;
  /** 跨角色搜索用的轻量索引（只留检索与展示字段，不含描述） */
  const addonIndex = [];
  for (const m of addonSrc.modules) {
    const owner = ownerLookup.get(`killer:${m.owner}`);
    if (!owner || !m.addons?.length) continue;
    const entries = m.addons.map((a) => ({
      // 源 id 已经是 `addon:xxx` 形式，不要再加一次前缀（之前会产生 addon:addon:xxx）
      id: a.id.startsWith('addon:') ? a.id : `addon:${a.id}`,
      kind: 'addon',
      ownerId: owner.id,
      title: a.title,
      titleEn: null,
      rarity: RARITY_BY_LABEL[a.rarity] ?? null,
      description: Array.isArray(a.description) ? a.description : [],
      flavor: a.flavor ?? '',
      icon: addonIconFile.get(a.id) ? iconPath(addonIconFile.get(a.id)) : null,
      glyph: hashGlyph(a.id),
      confidence: a.review?.confidence ?? 1,
      source: a.source?.url ?? null,
      ...keys(a.title),
    }));
    writeJSON(`addons/${owner.id}.json`, entries);
    files++;

    for (const a of entries) {
      addonIndex.push({
        id: a.id,
        ownerId: a.ownerId,
        title: a.title,
        rarity: a.rarity,
        icon: a.icon,
        pinyin: a.pinyin,
        initials: a.initials,
        // 描述正文（已去标点空白），供「按效果搜索」用，例如搜「疲劳」
        text: normalizeForSearch(a.description.join('')),
      });
    }
  }
  console.log(`  → addons/*.json 共 ${files} 个文件`);
  writeJSON('addons-index.json', addonIndex, `${addonIndex.length} 条（跨角色 + 效果搜索）`);

  /* 清掉旧的 seed 文件里已不存在的 */
  const validIds = new Set(addonSrc.modules.map((m) => ownerLookup.get(`killer:${m.owner}`)?.id).filter(Boolean));
  for (const f of fs.readdirSync(path.join(OUT, 'addons'))) {
    const id = f.replace(/\.json$/, '');
    if (!validIds.has(id)) {
      fs.rmSync(path.join(OUT, 'addons', f));
      console.log(`  🗑 清理过期分包 ${f}`);
    }
  }
}

/* ---------- 5. 图标下载 ---------- */
if (!NO_ICONS) {
  console.log('\n=== 5. 下载图标 ===');
  fs.mkdirSync(ICON_DIR, { recursive: true });

  const all = [...iconFileSet];
  const missingLocally = all.filter((f) => !fs.existsSync(path.join(ICON_DIR, toWebpName(f))));
  console.log(`  需要 ${all.length} 个，本地已有 ${all.length - missingLocally.length} 个，待下载 ${missingLocally.length} 个`);

  const missingSet = new Set(missingLocally);
  const todo = [...missingSet];

  // 1) 批量解析 URL（每批 50）
  const urlMap = new Map();
  const BATCH = 50;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const u = new URL(ICON_API);
    u.searchParams.set('action', 'query');
    u.searchParams.set('titles', batch.map((f) => `File:${f}`).join('|'));
    u.searchParams.set('prop', 'imageinfo');
    u.searchParams.set('iiprop', 'url');
    u.searchParams.set('iiurlwidth', '128');
    u.searchParams.set('format', 'json');
    u.searchParams.set('formatversion', '2');
    const j = await (await fetch(u, { headers: { 'User-Agent': ICON_UA }, signal: AbortSignal.timeout(60000) })).json();
    for (const p of j.query?.pages ?? []) {
      // MediaWiki 会把标题里的下划线显示成空格（File:IconAddon_foo.png → File:IconAddon foo.png），
      // 但落盘文件名必须还原成下划线，才能和 manifest 里的 iconFilename 对上
      const name = p.title.replace(/^File:/, '').replace(/ /g, '_');
      const url = p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url;
      if (url && !p.missing) urlMap.set(name, url);
    }
    process.stdout.write(`\r  解析 URL ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  console.log(`\n  解析到 ${urlMap.size} 个可用 URL，${todo.length - urlMap.size} 个在 wiki 上找不到`);

  // 2) 并发下载
  const list = [...urlMap.entries()];
  let done = 0, failed = 0;
  const CONCURRENCY = 8;
  async function worker() {
    while (list.length) {
      const [name, url] = list.shift();
      try {
        const r = await fetch(url, { headers: { 'User-Agent': ICON_UA }, signal: AbortSignal.timeout(45000) });
        if (!r.ok) throw new Error(String(r.status));
        const png = Buffer.from(await r.arrayBuffer());
        // 下载即转码，落盘只留 WebP（PNG 不落盘，省一半体积）
        const webp = await sharp(png, { failOn: 'none' }).webp(WEBP_OPTIONS).toBuffer();
        fs.writeFileSync(path.join(ICON_DIR, toWebpName(name)), webp);
      } catch {
        failed++;
      }
      done++;
      if (done % 25 === 0) process.stdout.write(`\r  下载 ${done}/${urlMap.size}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\r  下载完成 ${done - failed}/${urlMap.size}（失败 ${failed}）`);

  // 3) 报告缺图
  const stillMissing = all.filter((f) => !fs.existsSync(path.join(ICON_DIR, toWebpName(f))));
  if (stillMissing.length) {
    console.log(`  ⚠ ${stillMissing.length} 个图标最终缺失，这些条目会回落到占位形状`);
    console.log(`    样例: ${stillMissing.slice(0, 6).join(', ')}`);
  }
  const totalBytes = fs.readdirSync(ICON_DIR).reduce((s, f) => s + fs.statSync(path.join(ICON_DIR, f)).size, 0);
  console.log(`  图标目录合计 ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
}

console.log('\n=== 完成 ===');
