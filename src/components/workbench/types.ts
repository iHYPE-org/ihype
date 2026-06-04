'use client';

// ── View type (v2 simplified) ─────────────────────────────────
export type View = 'me' | 'seeds' | 'radio' | 'studio' | 'tickets' | 'settings' | 'matchmaker' | 'pagestudio' | 'artistpage' | 'venuepage';

// ── Prefs ─────────────────────────────────────────────────────
export const PREFS_VERSION = 2; // bump when DEFAULT_PREFS schema changes

export const DEFAULT_PREFS = {
  _v: PREFS_VERSION,
  accent: '#ff5029',
  density: 'cozy' as 'compact' | 'cozy' | 'comfy',
  queueRail: true,
  stickyDock: true,
  pinned: ['library', 'radio', 'tickets', 'discover', 'studio'] as string[],
  panel_stats: true,
  panel_tonight: true,
  panel_activity: true,
  panel_hyped: true,
  panel_roles: true,
  city: 'Chicago, IL',
  greeting: 'warm' as 'warm' | 'minimal' | 'data',
};

export function loadPrefs() {
  try {
    const s = localStorage.getItem('ihype-prefs-v2');
    if (!s) return DEFAULT_PREFS;
    const stored = JSON.parse(s);
    // If version mismatch, merge stored values with new defaults
    // (keeps user's accent/density choices, adds any new fields)
    if (stored._v !== PREFS_VERSION) {
      const merged = { ...DEFAULT_PREFS, ...stored, _v: PREFS_VERSION };
      return merged;
    }
    return { ...DEFAULT_PREFS, ...stored };
  } catch { return DEFAULT_PREFS; }
}

// ── Accent-2 shift ────────────────────────────────────────────
export function shiftAccent(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = 30 / 360;
  const nr = Math.round(r * (1 - t) + b * t);
  const ng = Math.round(g * (1 - t) + r * t);
  const nb = Math.round(b * (1 - t) + g * t);
  return '#' + [nr, ng, nb].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── fmtTime ───────────────────────────────────────────────────
export function fmtTime(s: number): string {
  const n = Math.floor(s);
  const m = Math.floor(n / 60);
  const sec = String(n % 60).padStart(2, '0');
  return `${m}:${sec}`;
}
