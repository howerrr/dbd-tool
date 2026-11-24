import type { AddonIndexEntry, Entry, OwnersFile, Side } from '../types';

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
  const data = await getJSON<OwnersFile>('/data/owners.json');
  if (!data) throw new Error('角色总览数据缺失');
  return data;
}

export async function loadPerks(side: Side): Promise<Entry[]> {
  return (await getJSON<Entry[]>(`/data/perks/${side}.json`)) ?? [];
}

/** 没有配件文件时返回空数组（多数角色尚未录入） */
export async function loadAddons(ownerId: string): Promise<Entry[]> {
  return (await getJSON<Entry[]>(`/data/addons/${encodeURIComponent(ownerId)}.json`)) ?? [];
}

/**
 * 配件的跨角色搜索索引（881 条，约 160KB，gzip 后 ~25KB）。
 * 只在角色总览打开搜索时按需加载一次，之后走内存缓存。
 */
export async function loadAddonIndex(): Promise<AddonIndexEntry[]> {
  return (await getJSON<AddonIndexEntry[]>('/data/addons-index.json')) ?? [];
}
