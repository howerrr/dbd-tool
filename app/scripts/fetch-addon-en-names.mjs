/**
 * 从 wiki.gg 补齐所有附加品的英文名（titleEn）
 *
 * 背景：文本源（迷雾笔记）只给中文名，所以 881 条附加品的 titleEn 一直是 null。
 * 英文名只能从 wiki 取，而 wiki 的批量数据表（Module:Datatable/Loadout）里
 * **没有图标文件名**，没法直接对上。可靠做法是解析每个杀手页的 "Add-ons for <Power>"
 * 表格 —— 每一行同时有图标文件名和英文名，用图标当主键一一对应。
 *
 * 匹配方式：站内 icon 是 `/icons/IconAddon_iridescentKing.webp`，
 * wiki 的 img alt 是 `T UI iconAddon iridescentKing.png`，把空格换成下划线即可对上。
 * 不能用「英文名 → 文件名」推导：`Brooke's Pustule` 的图标叫 `BrooksPustule`（wiki 自身不一致）。
 *
 * 副作用：顺便把英文名写进 addons-index.json，让总览也能用英文搜配件。
 *
 * 用法：node scripts/fetch-addon-en-names.mjs
 *       node scripts/fetch-addon-en-names.mjs --dry   # 只报告覆盖率，不写盘
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://deadbydaylight.wiki.gg/api.php';
const UA = { 'User-Agent': 'dbd-tool/0.1 (personal non-commercial archive)' };
const DATA = path.resolve('public/data');
const DRY = process.argv.includes('--dry');
/* wiki 对频繁请求会返回 429，所以并发压到 2、每次请求之间歇 500ms */
const CONCURRENCY = 2;

const read = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
const write = (rel, obj) => fs.writeFileSync(path.join(DATA, rel), JSON.stringify(obj) + '\n');
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (r.status === 429) {
        /* 限流：指数退避 */
        await sleep(2000 * attempt);
        continue;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (attempt === 5) throw e;
      await sleep(1500 * attempt);
    }
  }
  throw new Error('重试耗尽');
}

const htmlToText = (s) =>
  s
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 解析一个杀手 → [{ stem, name }]
 *
 * 两段式：先 query 解析重定向，再解析目标整页 HTML。
 *   `The Trapper` / `The Cenobite` / `The Terrifier` 这类名字都是**重定向**，
 *   真正的角色页叫 `Evan MacMillan` / `Elliot Spencer` / `Art The Clown`。
 *   直接 parse 原名只会拿到 1KB 的重定向空壳。
 *
 * 图标文件名两套命名都要认：
 *   老杀手：alt="IconAddon_iridescentKing.png"
 *   新杀手：alt="T UI iconAddon AlliesScalp.png"
 * 把空格换成下划线后，正好等于站内落盘的文件名。
 *
 * 取名字用「同一行里第一个指向 wiki 页面的链接」，不限定 <th> ——
 * 不同年份的页面模板结构不一样，限定太死会整页解析不出来。
 */
async function addonsOfKiller(nameEn) {
  const q = await api({ action: 'query', titles: nameEn, redirects: '1' });
  const resolved = q.query?.redirects?.[0]?.to ?? q.query?.pages?.[0]?.title ?? nameEn;

  const t = await api({ action: 'parse', page: resolved, prop: 'text' });
  if (!t.parse) return { resolved, rows: [], note: '页面取不到' };

  const html = t.parse.text;
  const rows = [];
  const seen = new Set();
  /* ⚠️ 必须用 /<tr[^>]*>/ 切，不能 split('<tr>')：
     老杀手页的行是 <tr class="...">，裸标签切分会一行都切不出来
     （Evan MacMillan 页明明有 98 个 IconAddon_ 却解析出 0 条，就是这个原因）。 */
  for (const row of html.split(/<tr[^>]*>/).slice(1)) {
    /* alt 有三种写法，都认：
         T UI iconAddon AlliesScalp.png   （最新一批）
         IconAddon tarBottle.png          （较早，注意是空格不是下划线）
         IconAddon_tarBottle.png
       统一把空格换成下划线后，正好等于站内落盘的文件名。 */
    const alt = row.match(/alt="([^"]*[Ii]conAddon[^"]*)\.png"/)?.[1];
    if (!alt) continue;
    const name = row.match(/<a href="\/wiki\/[^"]+" title="([^"]+)">/) ?.[1];
    if (!name) continue;
    const stem = alt.replace(/ /g, '_');
    if (seen.has(stem)) continue;
    seen.add(stem);
    rows.push({ stem, name: htmlToText(name) });
  }
  return { resolved, rows, note: rows.length ? undefined : '页面里没有附加品表' };
}

/* ---------- 1. 遍历杀手 ---------- */
/* ONLY=k-01,k-28 可只跑指定角色，方便先验证解析是否正确 */
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((s) => s.trim())) : null;
const owners = read('owners.json').owners.filter(
  (o) => o.side === 'killer' && o.counts.addon > 0 && o.id !== 'universal' && (!ONLY || ONLY.has(o.id)),
);
const iconToName = new Map();
const reports = [];

console.log(`扫描 ${owners.length} 个杀手页（并发 ${CONCURRENCY}）…\n`);

let idx = 0;
async function worker() {
  while (idx < owners.length) {
    const o = owners[idx++];
    try {
      const { resolved, rows, note } = await addonsOfKiller(o.nameEn);
      for (const r of rows) iconToName.set(r.stem, r.name);
      reports.push({ id: o.id, nameEn: o.nameEn, resolved, got: rows.length, note });
      process.stdout.write(`\r  已处理 ${reports.length}/${owners.length}  映射 ${iconToName.size} 条`);
    } catch (e) {
      reports.push({ id: o.id, nameEn: o.nameEn, got: 0, note: '失败: ' + e.message });
    }
    await sleep(600);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log('\n');

for (const r of reports.filter((x) => x.got === 0 || x.note)) {
  console.log(`  ⚠ ${r.id} ${r.nameEn} → ${r.resolved}：${r.note ?? '0 条'}`);
}
console.log(`\n杀手页共取到 ${iconToName.size} 条「图标 → 英文名」\n`);

/* ---------- 2. 写回附加品 ---------- */
const addonFiles = fs.readdirSync(path.join(DATA, 'addons')).filter((f) => f.endsWith('.json'));
let total = 0;
let filled = 0;
let already = 0;
const unmatched = [];

for (const f of addonFiles) {
  const rel = 'addons/' + f;
  const list = read(rel);
  let changed = false;
  for (const a of list) {
    total++;
    const stem = (a.icon ?? '').replace(/^\/icons\//, '').replace(/\.webp$/, '');
    const en = iconToName.get(stem);
    if (a.titleEn) {
      already++;
      continue;
    }
    if (en) {
      a.titleEn = en;
      filled++;
      changed = true;
    } else {
      unmatched.push(`${a.ownerId}/${a.title}`);
    }
  }
  if (changed && !DRY) write(rel, list);
}

console.log(`附加品 ${total} 条：新填 ${filled}，原本已有 ${already}，未匹配 ${unmatched.length}`);
if (unmatched.length) {
  console.log('  未匹配样例：' + unmatched.slice(0, 10).join('、') + (unmatched.length > 10 ? ' …' : ''));
}

/* ---------- 3. 索引也带上英文名（让总览能搜英文配件） ---------- */
const index = read('addons-index.json');
let indexFilled = 0;
for (const a of index) {
  if (a.titleEn) continue;
  const stem = (a.icon ?? '').replace(/^\/icons\//, '').replace(/\.webp$/, '');
  const en = iconToName.get(stem);
  if (en) {
    a.titleEn = en;
    indexFilled++;
  }
}
if (!DRY) write('addons-index.json', index);
console.log(`索引 ${index.length} 条：新填英文名 ${indexFilled}`);

if (DRY) console.log('\n（--dry 模式，未写盘）');
