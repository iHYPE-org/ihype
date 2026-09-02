import { kvGet } from '@/lib/kv';
import { log } from '@/lib/logger';

/**
 * The upload budgets, and the knob that scales them without a deploy
 * (owner, 2026-09-02: "Make storage expansions quick to scale").
 *
 * Three numbers, each with a default in code and an override in KV under
 * `limits:<name>`, read on every upload the way `flags:*` are:
 *
 *   limits:media_file_mb        per-file cap (default 60, HARD CEILING 60)
 *   limits:media_profile_gb     per-profile storage budget (default 1)
 *   limits:media_profile_tracks per-profile track count (default 100)
 *
 * To scale:  npx wrangler kv key put --remote --namespace-id <KV id in wrangler.toml> limits:media_profile_gb 5
 * Takes effect on the next upload. Deleting the key restores the default.
 *
 * The file cap has a ceiling the override cannot raise, and it is not taste:
 * the upload route reads the whole file into the Worker's 128 MB isolate to
 * sniff, measure and scan it, and `formData()` holds the request too. Past 60
 * MB the fix is streaming the body to R2 and scanning only its head — a
 * different route, not a bigger number. The other two are pure policy and
 * cost, so they scale freely: at R2's $0.015 per GB-month, a profile's whole
 * 1 GB budget full costs 1.5 cents a month.
 */
export const MEDIA_LIMIT_DEFAULTS = { fileMb: 60, profileGb: 1, profileTracks: 100 } as const;
export const MEDIA_FILE_MB_CEILING = 60;

export type MediaLimits = { fileMb: number; profileGb: number; profileTracks: number };

/** Pure: apply an override set to the defaults, clamping each to sane bounds. */
export function resolveMediaLimits(overrides: Partial<Record<keyof MediaLimits, unknown>>): MediaLimits {
  const num = (value: unknown, fallback: number, min: number, max: number) => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    fileMb: num(overrides.fileMb, MEDIA_LIMIT_DEFAULTS.fileMb, 1, MEDIA_FILE_MB_CEILING),
    profileGb: num(overrides.profileGb, MEDIA_LIMIT_DEFAULTS.profileGb, 0.1, 10_000),
    profileTracks: Math.round(num(overrides.profileTracks, MEDIA_LIMIT_DEFAULTS.profileTracks, 1, 100_000)),
  };
}

export async function getMediaLimits(): Promise<MediaLimits> {
  try {
    const [fileMb, profileGb, profileTracks] = await Promise.all([
      kvGet<unknown>('limits:media_file_mb'),
      kvGet<unknown>('limits:media_profile_gb'),
      kvGet<unknown>('limits:media_profile_tracks'),
    ]);
    return resolveMediaLimits({ fileMb, profileGb, profileTracks });
  } catch (error) {
    log.error('[media-limits]', error instanceof Error ? error : { error: String(error) }, 'limit read failed; using defaults');
    return { ...MEDIA_LIMIT_DEFAULTS };
  }
}

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
