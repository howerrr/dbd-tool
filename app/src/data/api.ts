import type { AddonIndexEntry, Entry, OwnersFile, Side } from '../types';
import { asset } from '../lib/base';

/**
 * 数据加载层。
 *
 * 分包策略（见方案文档 §3.2）：
 *   /data/owners.json            角色总览唯一需要的文件
 *   /data/perks/{side}.json      该阵营全部技能
 *   /data/addons/{ownerId}.json  单个屠夫的配件（没有配件的角色没有此文件）
 *
 * ⚠️ 关键坑：静态站（Vite dev 与 Cloudflare Pages 的 _redirects）会把
 * 不存在的文件回退成 index.html 并返回 200。所以不能只看 res.ok，
 * 必须先确认 content-type 是 JSON，否则会把 HTML 当 JSON 解析然后炸掉。
 */

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

async function getJSON<T>(url: string): Promise<T | null> {
  if (cache.has(url)) return cache.get(url) as T;
  if (inflight.has(url)) return (await inflight.get(url)) as T;

  const p = (async () => {
    const res = await fetch(url, { cache: 'no-cache' });

    // 真·404
    if (res.status === 404) return null;

    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.includes('json')) {
      // SPA 回退兜底：拿到了 index.html，说明这个分包根本不存在
      return null;
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text) as T;
      cache.set(url, data);
      return data;
    } catch {
      return null;
    }
  })().finally(() => inflight.delete(url));

  inflight.set(url, p);
  return p as Promise<T | null>;
}

export async function loadOwners(): Promise<OwnersFile> {
  const data = await getJSON<OwnersFile>(asset('/data/owners.json'));
  if (!data) throw new Error('角色总览数据缺失');
  /* 头像路径在 JSON 里是绝对的（/icons/chars/...），这里补上部署 base。
     统一在数据层的出入口做一次，组件里就不用到处关心部署路径。 */
  return {
    ...data,
    owners: data.owners.map((o) =>
      o.avatar ? { ...o, avatar: asset(o.avatar) } : o,
    ),
  };
}

/** 给一批条目的图标路径补上部署 base */
const withIcons = (entries: Entry[]): Entry[] =>
  entries.map((e) => (e.icon ? { ...e, icon: asset(e.icon) } : e));

export async function loadPerks(side: Side): Promise<Entry[]> {
  return withIcons((await getJSON<Entry[]>(asset(`/data/perks/${side}.json`))) ?? []);
}

/** 没有配件文件时返回空数组（多数角色尚未录入） */
export async function loadAddons(ownerId: string): Promise<Entry[]> {
  const raw = await getJSON<Entry[]>(asset(`/data/addons/${encodeURIComponent(ownerId)}.json`));
  return withIcons(raw ?? []);
}

/**
 * 配件的跨角色搜索索引（881 条，约 160KB，gzip 后 ~25KB）。
 * 只在角色总览打开搜索时按需加载一次，之后走内存缓存。
 */
export async function loadAddonIndex(): Promise<AddonIndexEntry[]> {
  const raw = (await getJSON<AddonIndexEntry[]>(asset('/data/addons-index.json'))) ?? [];
  return raw.map((a) => (a.icon ? { ...a, icon: asset(a.icon) } : a));
}
