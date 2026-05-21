type KVPutOptions = {
  ex?: number;
};

type KVRecord = {
  value: string;
  expiresAt?: number;
};

const globalStore = globalThis as unknown as { __cfKvStore?: Map<string, KVRecord> };
globalStore.__cfKvStore ??= new Map();
const memStore = globalStore.__cfKvStore;

function readMemory<T = string>(key: string): T | null {
  const record = memStore.get(key);
  if (!record) return null;
  if (record.expiresAt && Date.now() > record.expiresAt) {
    memStore.delete(key);
    return null;
  }

  try {
    return JSON.parse(record.value) as T;
  } catch {
    return record.value as T;
  }
}

function writeMemory(key: string, value: string | number, opts?: KVPutOptions) {
  memStore.set(key, {
    value: String(value),
    expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined
  });
}

type KVLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
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

export async function kvGet<T = string>(key: string): Promise<T | null> {
  const binding = await getBinding();
  if (!binding) return readMemory<T>(key);

  const raw = await binding.get(key);
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

export async function kvPut(key: string, value: string | number, opts?: KVPutOptions): Promise<void> {
  const binding = await getBinding();
  if (!binding) {
    writeMemory(key, value, opts);
    return;
  }

  await binding.put(key, String(value), opts?.ex ? { expirationTtl: opts.ex } : undefined);
}

export async function kvDel(key: string): Promise<void> {
  const binding = await getBinding();
  if (!binding) {
    memStore.delete(key);
    return;
  }

  await binding.delete(key);
}

export async function kvList(prefix: string): Promise<string[]> {
  const binding = await getBinding();
  if (!binding) {
    const now = Date.now();
    return [...memStore.entries()]
      .filter(([key, value]) => key.startsWith(prefix) && !(value.expiresAt && now > value.expiresAt))
      .map(([key]) => key);
  }

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await binding.list({ prefix, cursor, limit: 250 });
    keys.push(...result.keys.map((key) => key.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return keys;
}

export async function kvIncr(key: string, ttlSeconds?: number): Promise<number> {
  const current = Number((await kvGet<string>(key)) ?? 0);
  const next = current + 1;
  await kvPut(key, next, ttlSeconds ? { ex: ttlSeconds } : undefined);
  return next;
}
