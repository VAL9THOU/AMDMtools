import type { ArmaModEntry, ModSizeMap } from "../packages/core/src";

const PROXY_URL =
  import.meta.env.VITE_PROXY_URL ?? "http://localhost:8787";
const LOCAL_STORAGE_KEY = "arma-mod-sizes-v1";
const LOCAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

interface CachedEntry {
  size: number | null;
  timestamp: number;
}
type LocalCache = Record<string, CachedEntry>;

function loadLocalCache(): LocalCache {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalCache;
  } catch {
    return {};
  }
}

function saveLocalCache(cache: LocalCache): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

function isExpired(entry: CachedEntry): boolean {
  return Date.now() - entry.timestamp > LOCAL_CACHE_TTL_MS;
}

export interface FetchSizesResult {
  sizes: ModSizeMap;
  unknownIds: string[];
  partial: boolean;
}

export async function fetchModSizes(
  mods: ArmaModEntry[]
): Promise<FetchSizesResult> {
  const steamIds = new Set<string>();
  for (const mod of mods) {
    if (mod.steamId) {
      steamIds.add(mod.steamId);
    }
  }

  const sizes: ModSizeMap = {};
  const unknownIds: string[] = [];
  let partial = false;

  const localCache = loadLocalCache();
  const uncachedIds: string[] = [];

  for (const id of steamIds) {
    const entry = localCache[id];
    if (entry && !isExpired(entry)) {
      if (entry.size !== null) {
        sizes[id] = entry.size;
      } else {
        unknownIds.push(id);
      }
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length > 0) {
    const batches: string[][] = [];
    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
      batches.push(uncachedIds.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      try {
        const response = await fetch(PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steamIds: batch })
        });

        if (!response.ok && response.status !== 207) {
          partial = true;
          continue;
        }

        const data = (await response.json()) as {
          sizes: Record<string, number | null>;
          partial: boolean;
        };

        if (data.partial) {
          partial = true;
        }

        const now = Date.now();
        for (const [id, fileSize] of Object.entries(data.sizes)) {
          if (fileSize !== null) {
            sizes[id] = fileSize;
          } else {
            unknownIds.push(id);
          }
          localCache[id] = { size: fileSize, timestamp: now };
        }

        for (const id of batch) {
          if (!(id in data.sizes)) {
            localCache[id] = { size: null, timestamp: now };
            unknownIds.push(id);
          }
        }
      } catch {
        partial = true;
      }
    }

    saveLocalCache(localCache);
  }

  return { sizes, unknownIds, partial };
}

export function computeModlistTotal(
  mods: ArmaModEntry[],
  sizes: ModSizeMap
): number {
  let total = 0;
  for (const mod of mods) {
    if (mod.steamId && mod.steamId in sizes) {
      total += sizes[mod.steamId];
    }
  }
  return total;
}
