// iHYPE mock data — no backend; swap for real API calls at launch

export type Show = {
  id: string; title: string; artist: string; venue: string;
  city: string; date: string; price: number;
  status: 'LIVE' | 'SCHEDULED' | 'SOLD_OUT';
  hype: number; tint: string; demand?: number; genre?: string; ageReq?: boolean;
};

export type FanReceipt = {
  id: string; artist: string; event: string; date: string;
  qty: number; price: number; tint: string;
};

export type Track = { t: string; a: string; len: string; tint: string; };
export type Playlist = { id: string; name: string; count: number; mins: number; tint: string; by: string; auto?: boolean; };
export type Artist = { name: string; handle: string; city: string; bio: string; hype: number; monthly: string; tags: string[]; tracks: { t: string; len: string; plays: string; }[]; verified?: boolean; };
export type ChartEntry = { rank: number; prev: number; artist: string; track: string; hype: number; trend: number[]; tint: string; };
export type RadioShow = { id: string; name: string; host: string; day: string; listeners: string; status: string; genre: string; tint: string; };
export type FreeUseTrack = { id: string; t: string; a: string; genre: string; len: string; bpm: number; tint: string; license: string; };
export type UserPrefs = { role: 'fan' | 'dj' | 'artist' | 'venue'; city: string; genres: string[]; };

export const IHYPE_DATA = {
  stats: { artists: '1.2K', fans: '18.4K', hypes: '92.1K', shows: '37' },
  shows: [
    { id: 's1', title: 'Midnight Echo — Live at The Echo', artist: 'Midnight Echo', venue: 'The Echo', city: 'Los Angeles', date: 'Fri Jun 20 · 9:00 PM', price: 18, status: 'LIVE', hype: 1284, tint: '#ff5029', demand: 38 },
    { id: 's2', title: 'Wax Tropic + Slow Mover', artist: 'Wax Tropic', venue: 'Zebulon', city: 'Los Angeles', date: 'Sat Jun 21 · 8:30 PM', price: 22, status: 'SCHEDULED', hype: 642, tint: '#b983ff', demand: 12 },
    { id: 's3', title: 'Basement Tapes: Late Set', artist: 'Nyla', venue: 'The Lash', city: 'Los Angeles', date: 'Sat Jun 21 · 11:00 PM', price: 15, status: 'SCHEDULED', hype: 318, tint: '#22e5d4', demand: 8 },
    { id: 's4', title: 'Sunroom — Album Release', artist: 'Sunroom', venue: 'Gold-Diggers', city: 'Los Angeles', date: 'Sun Jun 22 · 7:00 PM', price: 20, status: 'SCHEDULED', hype: 877, tint: '#ffb84a', demand: 22 },
  ] as Show[],
  artist: {
    name: 'Midnight Echo', handle: '@midnightecho', city: 'Los Angeles, CA',
    bio: 'Four-piece dream-pop outfit. Reverb, tape loops, and a drum machine named Carl. Booking direct — no agents, no fees.',
    hype: 4821, monthly: '12.4K', tags: ['dream-pop', 'shoegaze', 'lo-fi'], verified: true,
    tracks: [
      { t: 'Carousel', len: '3:42', plays: '48.1K' },
      { t: 'Slow Static', len: '4:05', plays: '31.7K' },
      { t: 'Paper Walls', len: '2:58', plays: '22.3K' },
      { t: 'Halogen', len: '5:12', plays: '18.9K' },
    ],
  } as Artist,
  seeds: [
    { artist: 'Nyla', track: 'Goldenrod', tag: 'NEW NEAR YOU', tint: '#22e5d4' },
    { artist: 'Wax Tropic', track: 'Heatwave', tag: 'RISING', tint: '#b983ff' },
    { artist: 'Midnight Echo', track: 'Carousel', tag: 'HYPE MOMENT', tint: '#ff5029' },
    { artist: 'Sunroom', track: 'Paper Cup', tag: 'TRENDING', tint: '#ffb84a' },
    { artist: 'Cold Harbor', track: 'Tidewater', tag: 'AMBIENT PICK', tint: '#5b8cff' },
  ],
  playlists: [
    { id: 'pl1', name: 'Late Night LA', count: 42, mins: 168, tint: '#ff5029', by: 'You' },
    { id: 'pl2', name: 'Tape Loops', count: 28, mins: 112, tint: '#b983ff', by: 'You' },
    { id: 'pl3', name: 'Pre-show warmup', count: 18, mins: 71, tint: '#22e5d4', by: 'You' },
    { id: 'pl4', name: 'Hyped this month', count: 36, mins: 142, tint: '#ffb84a', by: 'iHYPE', auto: true },
    { id: 'pl5', name: 'Basement Tapes radio', count: 24, mins: 96, tint: '#5b8cff', by: 'Nyla' },
  ] as Playlist[],
  library: [
    { t: 'Carousel', a: 'Midnight Echo', len: '3:42', tint: '#ff5029' },
    { t: 'Goldenrod', a: 'Nyla', len: '3:18', tint: '#22e5d4' },
    { t: 'Heatwave', a: 'Wax Tropic', len: '3:48', tint: '#b983ff' },
    { t: 'Paper Cup', a: 'Sunroom', len: '2:58', tint: '#ffb84a' },
    { t: 'Slow Static', a: 'Midnight Echo', len: '4:05', tint: '#ff5029' },
    { t: 'Tidewater', a: 'Cold Harbor', len: '4:11', tint: '#5b8cff' },
  ] as Track[],
  charts: [
    { rank: 1, prev: 2, artist: 'Midnight Echo', track: 'Carousel', hype: 4821, trend: [40,52,48,61,70,88,96], tint: '#ff5029' },
    { rank: 2, prev: 4, artist: 'Sunroom', track: 'Paper Cup', hype: 2960, trend: [22,30,26,34,40,38,45], tint: '#ffb84a' },
    { rank: 3, prev: 1, artist: 'Wax Tropic', track: 'Heatwave', hype: 2740, trend: [30,28,33,31,36,40,42], tint: '#b983ff' },
    { rank: 4, prev: 9, artist: 'Nyla', track: 'Goldenrod', hype: 1320, trend: [10,14,20,26,30,44,58], tint: '#22e5d4' },
    { rank: 5, prev: 5, artist: 'Cold Harbor', track: 'Tidewater', hype: 1104, trend: [18,20,19,24,22,26,28], tint: '#5b8cff' },
    { rank: 6, prev: 3, artist: 'Slow Mover', track: 'Driftwood', hype: 980, trend: [44,40,38,34,30,29,27], tint: '#ff3e9a' },
  ] as ChartEntry[],
  radioShows: [
    { id: 'rs1', name: 'Late Set', host: 'Robin Vega', day: 'Fri · 11 PM', listeners: '1.3K', status: 'LIVE', genre: 'lo-fi · after hours', tint: '#5b8cff' },
    { id: 'rs2', name: 'Basement Tapes', host: 'The Lash', day: 'Sat · 10 PM', listeners: '880', status: 'SCHEDULED', genre: 'garage · live sets', tint: '#22e5d4' },
    { id: 'rs3', name: 'Golden Hour', host: 'Sunroom', day: 'Sun · 6 PM', listeners: '640', status: 'SCHEDULED', genre: 'dream-pop · sunset', tint: '#ffb84a' },
    { id: 'rs4', name: 'After Dark', host: 'Midnight Echo', day: 'Sat · 1 AM', listeners: '1.1K', status: 'LIVE', genre: 'shoegaze · late night', tint: '#ff5029' },
  ] as RadioShow[],
  recommended: [
    { id: 'rec1', artist: 'Cold Harbor', event: 'Tidewater — Live at Zebulon', date: 'Thu Jun 26 · 8:00 PM', price: 16, reason: 'Because you hyped Midnight Echo', tint: '#5b8cff' },
    { id: 'rec2', artist: 'Slow Mover', event: 'Driftwood Release Show', date: 'Fri Jun 27 · 9:30 PM', price: 14, reason: 'Rising in your Charts', tint: '#ff3e9a' },
    { id: 'rec3', artist: 'Nyla', event: 'Basement Tapes: Late Set', date: 'Sat Jun 21 · 11:00 PM', price: 15, reason: 'On a station you follow', tint: '#22e5d4' },
  ],
  dj: {
    name: 'Robin Vega', handle: '@robinv', city: 'Los Angeles, CA', listeners: '3.2K', onAir: true,
    shows: [
      { name: 'Late Set', day: 'Fri · 11 PM', listeners: '1.3K', tint: '#5b8cff' },
      { name: 'Tape Loops', day: 'Wed · 9 PM', listeners: '420', tint: '#ff3e9a' },
    ],
    earnings: { cleared: '$284.40', pending: '$62.80', rate: '8.4%' },
    crate: [
      { id:'fu1', t:'Carousel', a:'Midnight Echo', genre:'Dream-Pop', len:'3:42', tint:'#ff5029' },
      { id:'fu3', t:'Heatwave', a:'Wax Tropic', genre:'Electronic', len:'4:10', tint:'#b983ff' },
      { id:'fu7', t:'Neon Drift', a:'DJ Caro', genre:'Electronic', len:'6:12', tint:'#b983ff' },
    ],
  },
  freeUseLibrary: [
    { id:'fu1', t:'Carousel', a:'Midnight Echo', genre:'Dream-Pop', len:'3:42', bpm:92, tint:'#ff5029', license:'free-use' },
    { id:'fu2', t:'Goldenrod', a:'Nyla', genre:'R&B', len:'3:21', bpm:88, tint:'#22e5d4', license:'free-use' },
    { id:'fu3', t:'Heatwave', a:'Wax Tropic', genre:'Electronic', len:'4:10', bpm:124, tint:'#b983ff', license:'free-use' },
    { id:'fu4', t:'Paper Walls', a:'Midnight Echo', genre:'Dream-Pop', len:'2:58', bpm:84, tint:'#ff5029', license:'free-use' },
    { id:'fu5', t:'Tidewater', a:'Cold Harbor', genre:'Ambient', len:'5:30', bpm:70, tint:'#5b8cff', license:'free-use' },
    { id:'fu6', t:'Slow Static', a:'Midnight Echo', genre:'Shoegaze', len:'4:05', bpm:78, tint:'#ff5029', license:'free-use' },
    { id:'fu7', t:'Neon Drift', a:'DJ Caro', genre:'Electronic', len:'6:12', bpm:128, tint:'#b983ff', license:'free-use' },
    { id:'fu8', t:'Copper Sky', a:'Sunroom', genre:'Indie', len:'3:44', bpm:110, tint:'#ffb84a', license:'free-use' },
    { id:'fu9', t:'Late Tape', a:'Robin Vega', genre:'Lo-Fi', len:'2:48', bpm:76, tint:'#5b8cff', license:'free-use' },
    { id:'fu10', t:'Halogen', a:'Midnight Echo', genre:'Dream-Pop', len:'5:12', bpm:86, tint:'#ff5029', license:'free-use' },
    { id:'fu11', t:'Basement Tape #3', a:'Nyla', genre:'Hip-Hop', len:'3:55', bpm:93, tint:'#22e5d4', license:'free-use' },
    { id:'fu12', t:'Glass Room', a:'Cold Harbor', genre:'Ambient', len:'7:01', bpm:60, tint:'#5b8cff', license:'free-use' },
  ] as FreeUseTrack[],
  fanReceipts: [
    { id: 'r1', artist: 'Midnight Echo', event: 'The Echo', date: 'Fri May 30 · 9:00 PM', qty: 2, price: 36, tint: '#ff5029' },
  ] as FanReceipt[],
  searchRecents: ['midnight echo', 'late set', 'shoegaze LA', 'the echo'],
  following: [
    { name: 'Midnight Echo', role: 'Artist', tint: '#ff5029', verified: true },
    { name: 'Nyla', role: 'Artist', tint: '#22e5d4', verified: true },
    { name: 'DJ Caro', role: 'DJ', tint: '#b983ff', verified: true },
    { name: 'Wax Tropic', role: 'Artist', tint: '#b983ff' },
    { name: 'Robin Vega', role: 'DJ', tint: '#5b8cff' },
  ],
  notifications: [
    { id: 'n1', type: 'hype', title: 'Your HYPE fired', body: 'Carousel by Midnight Echo — 3:38 moment reached charts.', time: '2m ago', tint: '#ff5029' },
    { id: 'n2', type: 'ticket', title: 'Ticket confirmed', body: 'Midnight Echo @ The Echo — Jun 20, 9 PM', time: '1h ago', tint: '#22e5d4' },
    { id: 'n3', type: 'referral', title: 'Referral earned', body: 'Someone used your link. +$4.20 pending.', time: '3h ago', tint: '#b983ff' },
    { id: 'n4', type: 'show', title: 'Show announced', body: 'Nyla added a show at The Lash — Jun 28.', time: 'Yesterday', tint: '#22e5d4' },
  ],
};

export function lookupArtist(name: string): Artist {
  if (name === IHYPE_DATA.artist.name) return IHYPE_DATA.artist;
  const show = IHYPE_DATA.shows.find(s => s.artist === name);
  const chart = IHYPE_DATA.charts.find(c => c.artist === name);
  return {
    name,
    handle: `@${name.toLowerCase().replace(/\s+/g, '')}`,
    city: 'Los Angeles, CA',
    bio: `Independent artist on iHYPE. Booking direct — no agents, no fees.`,
    hype: chart?.hype ?? Math.floor(Math.random() * 2000) + 200,
    monthly: `${(Math.floor(Math.random() * 10) + 1)}.${Math.floor(Math.random() * 9)}K`,
    tags: ['indie', 'live', 'lo-fi'],
    tracks: [{ t: chart?.track ?? 'Untitled', len: '3:30', plays: `${(chart?.hype ?? 500) / 10}` }],
    verified: ['Midnight Echo', 'Nyla', 'DJ Caro', 'Wax Tropic'].includes(name),
  };
}
