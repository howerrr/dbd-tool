/**
 * 一次性脚本：补 10.3.0「Terrifier」章节的图标与人像
 *
 * 为什么需要手工脚本：文本数据来自迷雾笔记，而它**还没更新到 10.3.0**
 * （源站 perks.site.json 的 generated_at 仍是 2026-10-17），所以这批素材只能直接从
 * wiki.gg 取。等迷雾笔记跟上之后，重新跑 `npm run import` 会覆盖掉这里的结果 —— 属于正常。
 *
 * 取的东西：
 *   6 个新技能图标（128px 缩略图）→ public/icons/T_UI_iconsPerks_<Name>.webp
 *   2 张新角色立绘（200px 缩略图）→ public/icons/chars/{k-45,s-54}.webp
 *
 * 命名约定：wiki 上这批图叫 `T UI iconsPerks <Name>.png`（带空格），
 * 落盘统一把空格换成下划线，和站内已有的 `T_UI_iconPerks_*` 保持一致。
 *
 * 用法：node scripts/fetch-chapter-terrifier.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const API = 'https://deadbydaylight.wiki.gg/api.php';
const UA = { 'User-Agent': 'dbd-tool/0.1 (personal non-commercial archive)' };
const ICON_DIR = path.resolve('public/icons');
const CHAR_DIR = path.resolve('public/icons/chars');

/** 与原导入脚本一致的编码参数（nearLossless，透明通道不外扩） */
const WEBP_OPTIONS = { nearLossless: true, quality: 60, effort: 6 };

/** [wiki 文件名, 落盘文件名, 缩略宽度, 目标目录] */
const TARGETS = [
  ['T UI iconsPerks Laughingstock.png', 'T_UI_iconsPerks_Laughingstock.webp', 128, ICON_DIR],
  ['T UI iconsPerks KillSpree.png', 'T_UI_iconsPerks_KillSpree.webp', 128, ICON_DIR],
  ['T UI iconsPerks FunnyBusiness.png', 'T_UI_iconsPerks_FunnyBusiness.webp', 128, ICON_DIR],
  ['T UI iconsPerks ValkyriesRage.png', 'T_UI_iconsPerks_ValkyriesRage.webp', 128, ICON_DIR],
  ['T UI iconsPerks SharedTrauma.png', 'T_UI_iconsPerks_SharedTrauma.webp', 128, ICON_DIR],
  ['T UI iconsPerks BestGiftEver.png', 'T_UI_iconsPerks_BestGiftEver.webp', 128, ICON_DIR],
  ['K45 TheTerrifier Portrait.png', 'k-45.webp', 200, CHAR_DIR],
  ['S55 SiennaShaw Portrait.png', 's-54.webp', 200, CHAR_DIR],
];

async function thumbUrl(fileName, width) {
  const u = new URL(API);
  u.searchParams.set('action', 'query');
  u.searchParams.set('titles', 'File:' + fileName);
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'url');
  u.searchParams.set('iiurlwidth', String(width));
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) });
  const j = await r.json();
  const page = j.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url ?? null;
}

let ok = 0;
let skipped = 0;
let failed = 0;

for (const [wikiName, localName, width, dir] of TARGETS) {
  const dest = path.join(dir, localName);
  if (fs.existsSync(dest)) {
    console.log(`  (已存在) ${localName}  ${(fs.statSync(dest).size / 1024).toFixed(1)}KB`);
    skipped++;
    continue;
  }
  try {
    const url = await thumbUrl(wikiName, width);
    if (!url) throw new Error('wiki 上找不到该文件');
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('下载失败 ' + r.status);
    const png = Buffer.from(await r.arrayBuffer());
    const meta = await sharp(png).metadata();
    const webp = await sharp(png, { failOn: 'none' }).webp(WEBP_OPTIONS).toBuffer();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, webp);
    console.log(
      `  ✓ ${localName.padEnd(38)} ${meta.width}x${meta.height} → ${(webp.length / 1024).toFixed(1)}KB` +
        (meta.hasAlpha ? '' : '  ⚠ 源图无 alpha'),
    );
    ok++;
  } catch (e) {
    console.error(`  ✗ ${localName}  ${e.message}`);
    failed++;
  }
}

console.log(`\n完成：下载 ${ok}，跳过 ${skipped}，失败 ${failed}`);
if (failed) process.exitCode = 1;
