// ── Workbench shared types ─────────────────────────────────────
// Single source of truth for all WorkbenchShellV2 data types.

export type WbTrack = {
  id: string;
  title: string;
  artistName: string;
  duration: string;
  durationSec: number;
  hypeCount: number;
  color: string;
  album: string;
  mediaUrl: string;
  artistSlug?: string | null;
};

export type WbShow = {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  hype: number;
  sold: number;
  capacity: number;
  price: number;
  status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' | 'NEAR SOLD' | 'ENDED';
};

export type WbStat = {
  label: string;
  value: string;
  delta: string;
  color: string;
};

export type WbTicket = {
  id: string;
  showId?: string;
  showName: string;
  date: string;
  seat: string;
  price: number;
  status: string;
  code: string;
};

export type WbActivity = {
  text: string;
  time: string;
  kind: 'hype' | 'show' | 'radio' | 'payout' | 'request' | 'security';
};

// View is defined in workbench/types.ts for V2 (smaller set).
// This View type mirrors the legacy full set used in WorkbenchShell.
export type View = 'home' | 'discover' | 'seeds' | 'tickets' | 'studio' | 'artist' | 'venue' | 'settings' | 'inbox' | 'hype-map' | 'scene-graph' | 'money-flow' | 'governance' | 'setlist' | 'news' | 'admin';

export type WbNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: WbActivity['kind'];
  actionLabel?: string;
  view?: View;
  href?: string;
  unread?: boolean;
};

type WbProfileLocation = {
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type WbTrendingProfile = {
  id: string;
  name: string;
  slug: string;
  type: string;
  city: string;
  genre: string;
  hypeCount: number;
  avatarImage: string;
};

export type WbRadioShow = {
  id: string;
  name: string;
  host: string;
  hostProfileId?: string;
  time: string;
  next: string;
  live: boolean;
  listeners: number;
  color: string;
  desc: string;
};

export type WbVenueRequest = {
  id: string;
  artistName: string;
  note: string | null;
  requesterType: string;
  createdAt: string;
  artistProfileSlug?: string | null;
  status: 'PENDING' | 'BOOKED' | 'DISMISSED';
};

export type WbBadge = {
  type: string;
  awardedAt: string;
};

export type WbCollabPost = {
  id: string;
  type: string;
  role: string;
  body: string;
  contact: string | null;
  createdAt: string;
  isOwn: boolean;
};

export type WbAvailabilityDate = {
  id: string;
  date: string;
  note: string | null;
};

export type WbPageEditor = {
  profileId: string;
  slug: string;
  type: string;
  name: string;
  headline: string;
  bio: string;
  aboutContent: string;
  topFiveContent: string;
  mediaContent: string;
  nowPlaying: string;
  links: string;
  merchUrl: string;
  merchContent: string;
  tourContent: string;
  requestContent: string;
  upcomingContent: string;
  previousShowHighlights: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  hoursText: string;
  parkingDetails: string;
  stayRecommendations: string;
  heroImage: string;
  avatarImage: string;
  logoImage: string;
  galleryImage: string;
  featureVideoUrl: string;
  themePreset: string;
  themeAccentTone: string;
  themeBackdropTone: string;
  fanShareEnabled: boolean;
  songs: Array<{ hexId: string; title: string; notes: string | null; freeUseEnabled: boolean }>;
  upcomingShows: WbShow[];
  previousShows: WbShow[];
};

export type WorkbenchData = {
  userName: string;
  userInitials: string;
  city: string;
  greeting: string;
  stats: WbStat[];
  tracks: WbTrack[];
  shows: WbShow[];
  tickets: WbTicket[];
  activity: WbActivity[];
  radioShows: WbRadioShow[];
  /** Profile types the logged-in user has: 'ARTIST' | 'VENUE' | 'LISTENER' | 'DJ' */
  activeProfileTypes: string[];
  hasPublishedPage?: boolean;
  profileType?: string;
  profileId?: string;
  profileHexId?: string;
  profilePath?: string;
  profileLocation?: WbProfileLocation;
  pendingVenueRequestCount?: number;
  followerCount?: number;
  availabilityDates?: WbAvailabilityDate[];
  profileCompletion?: { percent: number; missing: string[]; checks?: Array<{ label: string; ok: boolean }> };
  notifications?: WbNotification[];
  venueRequests?: WbVenueRequest[];
  badges?: WbBadge[];
  collabPosts?: WbCollabPost[];
  referralStats?: { clicks: number; buyers: number; grossCents: number; payoutCents: number };
  listeningNow: number;
  hypedToday: number;
  hypeCount7d?: number;
  showsTonight: number;
  isVerified?: boolean;
  verificationRequested?: boolean;
  lifeStats?: { totalHype: number; totalHypeGiven?: number; totalEarnings: number; songsPlayed: number; eventsAttended: number };
  joinedAt?: string;
  weeklyListens?: number;
  isAdmin?: boolean;
  uploadStreak?: number;
  hypeStreak?: number;
  needsGenreQuiz?: boolean;
  degraded?: boolean;
  stripeConnectOnboarded?: boolean;
  trending?: WbTrendingProfile[];
  pageEditor?: WbPageEditor;
};

export const DEFAULT_PREFS = {
  accent: '#ff5029',
  density: 'cozy' as 'compact' | 'cozy' | 'comfy',
  queueRail: true,
  stickyDock: true,
  pinned: ['library', 'radio', 'tickets', 'studio'] as string[],
  panel_stats: true,
  panel_tonight: true,
  panel_activity: true,
  panel_hyped: true,
  city: 'Chicago, IL',
  greeting: 'warm' as 'warm' | 'minimal' | 'data',
};
export type Prefs = typeof DEFAULT_PREFS;

export type StarterPackItem = {
  id: string;
  name: string;
  slug: string;
  hypeCount: number;
  city: string | null;
  genre: string | null;
};
