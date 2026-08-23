/* iHYPE shared types — the contract between the API and the component library.
   Generated 2026-08-22 from engineering/openapi.yaml + the components' declared
   prop signatures.

   TWO LAYERS ON PURPOSE:
   - `Api*` types are the wire format: snake_case, cents, ISO 8601 strings.
   - the rest are what components receive: camelCase, formatted at the leaf.

   The hydrate layer is the only place that knows both. A component that imports
   an `Api*` type is a bug — it means snake_case reached the view. */

// ─── Wire format ───────────────────────────────────────────────────────────

export type AccountType = 'fan' | 'artist' | 'venue' | 'advertiser';
/* NOT 'dj' (deleted 2026-08-06) and NOT 'promoter' — the 10% promoter slice is
   money, not an account type. openapi.yaml still lists 'dj' in three enums. */

export interface ApiUser {
  id: string;
  handle: string;
  display_name: string;
  city: string;
  genres: string[];
  roles: AccountType[];
  verified: boolean;
}

export type EventStatus = 'draft' | 'published' | 'live' | 'ended' | 'cancelled';

export interface ApiEvent {
  id: string;
  title: string;
  artist_id: string;
  venue_id: string | null;
  starts_at: string;      // ISO 8601 UTC
  price_cents: number;    // integer, never a float
  status: EventStatus;
  split: ApiSplit;        // frozen at publish
}

/** The charter. Frozen at publish, settled per event. Always sums to 100. */
export interface ApiSplit {
  artist_pct: 70;
  venue_pct: 20;
  promoter_pool_pct: 10;
  platform_pct: 0;        // iHYPE takes nothing. Typed as 0 so it cannot drift.
  frozen_at: string;
}

/** The only charge above face value, passed through at cost. Its own line —
 *  never folded into a total. */
export interface ApiFees {
  face_value_cents: number;
  processing_cents: number;
  processing_basis: '2.9%+30' | '3.5%+30';  // AMEX is the second
  total_cents: number;
}

/** Per-target HYPE state. This is the shape openapi.yaml is missing — the
 *  current /hype/budget returns a global weekly counter, which cannot tell the
 *  UI whether THIS artist is on cooldown. */
export interface ApiHypeState {
  hyped: boolean;
  next_at: string | null;   // ISO 8601; null = hypeable now
}

export type HypeTargetType = 'artist' | 'track' | 'show';

export interface ApiTicket {
  serialized_id: string;   // goes in URLs and support tickets
  code: string;            // the signed wallet payload — MUST differ from the id
  event_id: string;
  holder_id: string;
  order_id: string;
  status: 'valid' | 'transferred' | 'scanned' | 'refunded' | 'void';
  scans: number;
}

// ─── What components receive ───────────────────────────────────────────────

export interface Track {
  title: string;
  artist: string;
  album?: string;
  initial: string;         // the plate glyph
  seconds?: number;        // authoritative duration; the bar and full player
                           // must agree, so this travels with the track
}

/** Derived from ApiHypeState in the hydrate layer, never in a component.
 *  `label` is coarse to the minute on purpose: a second-by-second countdown
 *  turns a fairness rule into a game to be timed. */
export interface HypeAffordance {
  hyped: boolean;
  locked: boolean;
  label?: string;          // e.g. "17h 40m"
  count?: number;
  trend?: string;
  /** False when there is no linked profile, the target is not discoverable, or
   *  it is your own — resolved upstream so the control is never one whose every
   *  press is refused. */
  canHype: boolean;
}

export interface SeedItem {
  artist: string;
  song: string;
  album: string;
  initial: string;
  c1: string;              // the artist's own palette — never a stock image
  c2: string;
  why: string;             // why this surfaced, in the member's terms
}

export interface MapPin {
  id: string;
  kind: 'venue' | 'artist';
  title: string;
  meta?: string;
  body?: string;
  /** Venues sit on a street address; artists on a city centroid. */
  lat: number;
  lng: number;
  rows?: { label: string; value: string; accent?: boolean }[];
  lines?: { time: string; title: string; meta?: string; value?: string }[];
  /** The ONE outbound link, and only a domain the account owns. Validate
   *  server-side: no streaming, social or link-in-bio hosts. */
  action?: { label: string; href: string };
}

export type Tone = 'ok' | 'pending' | 'warn' | 'neutral';
export type ToastVariant = 'success' | 'warn' | 'error' | 'info';

/** Mapped from server status in the hydrate layer, not in the view. */
export type StatusMap = Record<string, Tone>;

// ─── Fixed client-side, never server-driven ────────────────────────────────

/** A nav that can change shape cannot be designed. These are constants. */
export const MUSIC_TABS = ['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists'] as const;
export const MODULES = ['map', 'music', 'me'] as const;
