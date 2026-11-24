/**
 * 上线后核查：对着真实部署地址验证「该生效的东西都生效了」。
 *
 * 本地 `npm run verify` 检查的是 dist/ 里的字节；这个脚本检查的是**线上行为**，
 * 尤其是 Cloudflare 对 `public/_headers` / `public/_redirects` 的实际处理结果 ——
 * 这两份配置在本地是无法验证的，只有部署后才知道有没有被认。
 *
 * 用法（注意：若所在网络访问 workers.dev 需要代理，Node 要显式开代理支持）：
 *   node scripts/verify-deploy.mjs https://dbd-tool.xxx.workers.dev
 *
 *   PowerShell 示例：
 *     $env:NODE_USE_ENV_PROXY="1"; $env:HTTPS_PROXY="http://127.0.0.1:7897"
 *     node scripts/verify-deploy.mjs https://dbd-tool.xxx.workers.dev
 *
 * 退出码 1 表示有硬性检查失败。
 */
const BASE = (process.argv[2] ?? process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('用法: node scripts/verify-deploy.mjs <https://your-site>');
  process.exit(2);
}

let failures = 0;
let warnings = 0;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const warn = (msg) => {
  warnings++;
  console.log(`  ! ${msg}`);
};

/** 取一个 URL 的响应（默认只读头，需要正文时传 true） */
async function probe(path) {
  const res = await fetch(BASE + path, {
    headers: { 'User-Agent': 'dbd-tool-verify/1.0', 'Accept-Encoding': 'gzip, br' },
    signal: AbortSignal.timeout(30000),
  });
  return res;
}

/** 断言某响应头里包含期望片段 */
function expectHeader(res, name, needle, label) {
  const v = res.headers.get(name) ?? '';
  if (!v) return bad(`${label}：缺少响应头 ${name}`);
  if (needle && !v.includes(needle)) return bad(`${label}：${name} 是「${v}」，期望包含「${needle}」`);
  return ok(`${label}：${name} = ${v}`);
}

console.log(`\n核查目标: ${BASE}\n`);

/* ---------- 1. 首页 ---------- */
console.log('[1] 首页');
let html = '';
try {
  const res = await probe('/');
  if (res.status !== 200) bad(`首页返回 ${res.status}`);
  else {
    ok(`首页 200，content-type ${res.headers.get('content-type')}`);
    html = await res.text();
  }
  expectHeader(res, 'x-robots-tag', 'noindex', '安全头');
  expectHeader(res, 'x-content-type-options', 'nosniff', '安全头');
} catch (e) {
  bad(`首页取不到：${e.cause?.code ?? e.message}（若网络需要代理，见文件头注释）`);
}

if (html) {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  title ? ok(`标题：${title}`) : bad('首页没有 <title>');
  for (const [needle, label] of [
    ['rel="manifest"', 'manifest 已接线'],
    ['apple-touch-icon', 'apple-touch-icon'],
    ['apple-mobile-web-app-capable', 'PWA standalone'],
    ['viewport-fit=cover', '安全区适配'],
  ]) {
    html.includes(needle) ? ok(label) : bad(`首页缺 ${label}`);
  }
}

/* ---------- 2. 缓存策略（验证 _headers 是否被认） ---------- */
console.log('\n[2] 缓存策略（_headers 是否生效）');
for (const [path, needle, label] of [
  ['/data/owners.json', 'max-age=600', '数据 JSON'],
  ['/data/addons-index.json', 'max-age=600', '配件索引'],
  ['/icons/chars/k-01.webp', 'max-age=604800', '角色抠图'],
  ['/icons/IconAddon_bloodyCoil.webp', 'max-age=604800', '条目图标'],
  ['/icons/card/frame-killer.webp', 'max-age=604800', '卡片框'],
  ['/favicon.svg', 'max-age=2592000', 'favicon'],
  ['/apple-touch-icon.png', 'max-age=2592000', 'apple-touch-icon'],
  ['/manifest.webmanifest', 'max-age=86400', 'manifest'],
]) {
  try {
    const res = await probe(path);
    if (res.status !== 200) bad(`${label} ${path} 返回 ${res.status}`);
    else expectHeader(res, 'cache-control', needle, label);
  } catch (e) {
    bad(`${label} 取不到：${e.cause?.code ?? e.message}`);
  }
}

/* ---------- 3. 入口资源 ---------- */
console.log('\n[3] 入口资源（Vite 产物）');
if (html) {
  const js = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  const css = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
  if (!js) bad('首页里找不到入口 JS');
  if (!css) bad('首页里找不到入口 CSS');
  for (const [p, label] of [
    [js, '入口 JS'],
    [css, '入口 CSS'],
  ]) {
    if (!p) continue;
    try {
      const res = await probe(p);
      if (res.status !== 200) bad(`${label} 返回 ${res.status}`);
      else expectHeader(res, 'cache-control', 'immutable', label);
    } catch (e) {
      bad(`${label} 取不到：${e.cause?.code ?? e.message}`);
    }
  }
}

/* ---------- 4. manifest 内容 ---------- */
console.log('\n[4] manifest');
try {
  const res = await probe('/manifest.webmanifest');
  const m = JSON.parse(await res.text());
  ok(`name「${m.name}」 display=${m.display} start_url=${m.start_url}`);
  const maskable = m.icons?.some((i) => String(i.purpose ?? '').includes('maskable'));
  maskable ? ok(`图标 ${m.icons.length} 个，含 maskable`) : bad('缺少 maskable 图标');
  if (!String(res.headers.get('content-type') ?? '').includes('manifest')) {
    warn(`manifest 的 content-type 是 ${res.headers.get('content-type')}（部分浏览器要求 application/manifest+json）`);
  }
} catch (e) {
  bad(`manifest 解析失败：${e.message}`);
}

/* ---------- 5. SPA 回退行为 ---------- */
console.log('\n[5] 不存在的 JSON（决定 src/data/api.ts 的兜底是否必要）');
try {
  const res = await probe('/data/addons/__not_exist__.json');
  const ct = res.headers.get('content-type') ?? '';
  const body = (await res.text()).slice(0, 40);
  if (res.status !== 200) ok(`返回 ${res.status}，是干净的 404`);
  else if (ct.includes('json')) bad('不存在的 JSON 返回了 200 + JSON，这不可能，检查一下地址');
  else
    ok(
      `返回 200 + ${ct}，内容是 ${JSON.stringify(body)} —— ` +
        '这正是 api.ts 必须校验 content-type 的原因',
    );
} catch (e) {
  warn(`回退探测失败：${e.cause?.code ?? e.message}`);
}

/* ---------- 6. 部署元文件不该被公开 ---------- */
console.log('\n[6] _headers / _redirects 是否被当作普通文件暴露');
for (const f of ['/_headers', '/_redirects']) {
  try {
    const res = await probe(f);
    if (res.status === 200) warn(`${f} 可以被公开下载（Cloudflare 通常会拦截，这里拿到了 200）`);
    else ok(`${f} 返回 ${res.status}，没有被暴露`);
  } catch (e) {
    warn(`${f} 探测失败：${e.cause?.code ?? e.message}`);
  }
}

/* ---------- 7. 抽样图标 ---------- */
console.log('\n[7] 抽样 6 张图片能否正常取到');
const samples = [
  '/icons/chars/k-18.webp',
  '/icons/chars/s-55.webp',
  '/icons/IconPerks_hexRuin.webp',
  '/icons/IconsPerks_SecretProject.webp',
  '/favicon-32.png',
  '/icon-maskable-512.png',
];
for (const p of samples) {
  try {
    const res = await probe(p);
    const size = Number(res.headers.get('content-length') || 0);
    if (res.status !== 200) bad(`${p} 返回 ${res.status}`);
    else ok(`${p} 200  ${size ? (size / 1024).toFixed(1) + 'KB' : ''}`);
  } catch (e) {
    bad(`${p} 取不到：${e.cause?.code ?? e.message}`);
  }
}

/* ---------- 结论 ---------- */
console.log('');
if (failures) {
  console.log(`✗ ${failures} 项失败${warnings ? `，${warnings} 项提醒` : ''}`);
  process.exitCode = 1;
} else {
  console.log(`✓ 全部通过${warnings ? `（${warnings} 项提醒，非致命）` : ''}`);
}
