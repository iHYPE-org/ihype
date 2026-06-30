// Pure, DB-free helpers shared by the growth-feature libs. Kept separate from
// the lib modules (which import src/lib/db → the Prisma client) so the logic
// can be unit-tested in isolation.

/** Start (Friday 00:00) and end (Sunday 23:59:59) of the coming weekend, UTC. */
export function weekendWindow(now: Date): { start: Date; end: Date; label: string } {
  const day = now.getUTCDay(); // 0 Sun … 6 Sat
  const daysToSunday = (7 - day) % 7; // 0 if today is Sunday
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToSunday, 23, 59, 59));
  const friday = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate() - 2, 0, 0, 0));
  const start = now > friday ? now : friday; // already inside the weekend → start now
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { start, end: sunday, label: `${fmt(friday)} – ${fmt(sunday)}` };
}

/**
 * Given the per-track durations of a looping rotation and the current time in
 * whole seconds, returns which track index is playing and the offset into it.
 * Deterministic — the same nowSecs always yields the same position, which keeps
 * every listener synced to the shared always-on station.
 */
export function stationPositionAt(durations: number[], nowSecs: number): { index: number; offset: number } {
  const loopTotal = durations.reduce((sum, d) => sum + d, 0);
  if (loopTotal <= 0) return { index: 0, offset: 0 };
  let cursor = ((nowSecs % loopTotal) + loopTotal) % loopTotal; // handle negative nowSecs
  for (let i = 0; i < durations.length; i++) {
    if (cursor < durations[i]) return { index: i, offset: cursor };
    cursor -= durations[i];
  }
  return { index: 0, offset: 0 };
}

/** Returns the most frequent string in a list, or null if empty. */
export function tallyTop(items: string[]): string | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [item, count] of counts) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

export function firstName(name: string | null, username: string): string {
  const n = (name ?? '').trim();
  if (n) return n.split(/\s+/)[0];
  return username;
}

export function initialsOf(name: string | null, username: string): string {
  const src = (name ?? username).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return letters.toUpperCase();
}

/** Genre overlap in [0,1] between a venue's booked genres and an artist's. */
export function bookingTasteScore(venueGenres: string[], artistGenres: string[]): number {
  if (venueGenres.length === 0 || artistGenres.length === 0) return 0;
  const set = new Set(venueGenres.map((g) => g.toLowerCase()));
  const overlap = artistGenres.filter((g) => set.has(g.toLowerCase())).length;
  return Math.min(1, overlap / Math.min(venueGenres.length, artistGenres.length));
}

/** Geo proximity tier in [0,1]: same city strongest, then state, then neither. */
export function bookingGeoScore(
  vCity: string | null, vState: string | null,
  aCity: string | null, aState: string | null,
): number {
  if (vCity && aCity && vCity.toLowerCase() === aCity.toLowerCase()) return 1;
  if (vState && aState && vState.toLowerCase() === aState.toLowerCase()) return 0.6;
  return 0.1;
}
