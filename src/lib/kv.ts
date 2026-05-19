// Cloudflare Workers KV adapter.
// Replaces @vercel/kv throughout the codebase.
// In production (CF Workers): uses the KV binding from getCloudflareContext().
// In local dev (no CF context): falls back to an in-memory Map.

type KVPutOptions = {
  ex?: number;  // TTL in seconds
};

type KVRecord = {
  value: string;
  expiresAt?: number;  // ms timestamp
};

// ---- In-memory fallback (local dev) ----------------------------------------

const globalStore = (globalThis as unknown as { __cfKvStore?: Map<string, KVRecord> });
if (!globalStore.__cfKvStore) globalStore.__cfKvStore = new Map();
const memStore = globalStore.__cfKvStore!;

function memGet<T = string>(key: string): T | null {
  const rec = memStore.get(key);
  if (!rec) return null;
  if (rec.expiresAt && Date.now() > rec.expiresAt) { memStore.delete(key); return null; }
  try { return JSON.parse(rec.value) as T; } catch { return rec.value as unknown as T; }
}

function memPut(key: string, value: string | number, opts?: KVPutOptions): void {
  memStore.set(key, {
    value: String(value),
    expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
  });
}

function memDel(key: string): void { memStore.delete(key); }

function memList(prefix: string): string[] {
  const now = Date.now();
  const keys: string[] = [];
  for (const [k, v] of memStore) {
    if (k.startsWith(prefix) && !(v.expiresAt && now > v.expiresAt)) keys.push(k);
  }
  return keys;
}

// ---- CF KV binding ----------------------------------------------------------

type KVLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix?: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor: string }>;
};

async function getBinding(): Promise<KVLike | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    return ((ctx.env as Record<string, unknown>).KV as KVLike) ?? null;
  } catch {
    return null;
  }
}

// ---- Public API -------------------------------------------------------------

export async function kvGet<T = string>(key: string): Promise<T | null> {
  const binding = await getBinding();
  if (!binding) return memGet<T>(key);
  const raw = await binding.get(key);
  if (raw === null) return null;
  try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
}

export async function kvPut(key: string, value: string | number, opts?: KVPutOptions): Promise<void> {
  const binding = await getBinding();
  if (!binding) { memPut(key, value, opts); return; }
  await binding.put(key, String(value), opts?.ex ? { expirationTtl: opts.ex } : undefined);
}

export async function kvDel(key: string): Promise<void> {
  const binding = await getBinding();
  if (!binding) { memDel(key); return; }
  await binding.delete(key);
}

export async function kvList(prefix: string): Promise<string[]> {
  const binding = await getBinding();
  if (!binding) return memList(prefix);
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await binding.list({ prefix, cursor, limit: 250 });
    for (const k of result.keys) keys.push(k.name);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}

// incr: get current numeric value, increment, put back with same TTL.
// Not atomic — acceptable for rate limiting at this scale.
export async function kvIncr(key: string, ttlSeconds?: number): Promise<number> {
  const binding = await getBinding();
  if (!binding) {
    const cur = memGet<string>(key);
    const next = (Number(cur) || 0) + 1;
    memPut(key, next, ttlSeconds ? { ex: ttlSeconds } : undefined);
    return next;
  }
  const raw = await binding.get(key);
  const next = (Number(raw) || 0) + 1;
  await binding.put(key, String(next), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
  return next;
}
