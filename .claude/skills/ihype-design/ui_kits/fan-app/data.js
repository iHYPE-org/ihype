// iHYPE mock data — no backend; visual recreation only

// Lightweight analytics stub (logs + persists; swap for real provider at launch)
window.track = function(event, props) {
  try {
    const entry = { event, props: props || {}, ts: Date.now(), plat: localStorage.getItem('ihype_platform') || 'ios' };
    const log = JSON.parse(localStorage.getItem('ihype_events') || '[]');
    log.push(entry); if (log.length > 200) log.shift();
    localStorage.setItem('ihype_events', JSON.stringify(log));
    console.log('[track]', event, props || '');
  } catch(e) {}
};

window.IHYPE_DATA = {
  stats: { artists: '1.2K', fans: '18.4K', hypes: '92.1K', shows: '37' },
  shows: [
    { id: 's1', title: 'Midnight Echo — Live at The Echo', artist: 'Midnight Echo', venue: 'The Echo', city: 'Los Angeles', date: 'Fri Jun 20 · 9:00 PM', price: 18, status: 'LIVE', hype: 1284, tint: '#ff5029' },
    { id: 's2', title: 'Wax Tropic + Slow Mover', artist: 'Wax Tropic', venue: 'Zebulon', city: 'Los Angeles', date: 'Sat Jun 21 · 8:30 PM', price: 22, status: 'SCHEDULED', hype: 642, tint: '#b983ff' },
    { id: 's3', title: 'Basement Tapes: Late Set', artist: 'Nyla', venue: 'The Lash', city: 'Los Angeles', date: 'Sat Jun 21 · 11:00 PM', price: 15, status: 'SCHEDULED', hype: 318, tint: '#22e5d4' },
    { id: 's4', title: 'Sunroom — Album Release', artist: 'Sunroom', venue: 'Gold-Diggers', city: 'Los Angeles', date: 'Sun Jun 22 · 7:00 PM', price: 20, status: 'SCHEDULED', hype: 877, tint: '#ffb84a' },
  ],
  artist: {
    name: 'Midnight Echo', handle: '@midnightecho', city: 'Los Angeles, CA',
    bio: 'Four-piece dream-pop outfit. Reverb, tape loops, and a drum machine named Carl. Booking direct — no agents, no fees.',
    hype: 4821, monthly: '12.4K', tags: ['dream-pop', 'shoegaze', 'lo-fi'],
    tracks: [
      { t: 'Carousel', len: '3:42', plays: '48.1K' },
      { t: 'Slow Static', len: '4:05', plays: '31.7K' },
      { t: 'Paper Walls', len: '2:58', plays: '22.3K' },
      { t: 'Halogen', len: '5:12', plays: '18.9K' },
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
    { id:'fu13', t:'After Hours', a:'DJ Caro', genre:'Electronic', len:'5:44', bpm:132, tint:'#b983ff', license:'free-use' },
    { id:'fu14', t:'Gold Teeth', a:'Wax Tropic', genre:'Hip-Hop', len:'3:28', bpm:96, tint:'#b983ff', license:'free-use' },
    { id:'fu15', t:'Sundowner', a:'Sunroom', genre:'Indie', len:'4:20', bpm:102, tint:'#ffb84a', license:'free-use' },
    { id:'fu16', t:'Slow Mover', a:'Wax Tropic', genre:'Electronic', len:'4:55', bpm:118, tint:'#b983ff', license:'free-use' },
    { id:'fu17', t:'Open Road', a:'Robin Vega', genre:'Lo-Fi', len:'3:10', bpm:80, tint:'#5b8cff', license:'free-use' },
    { id:'fu18', t:'Resonance', a:'Cold Harbor', genre:'Ambient', len:'6:30', bpm:65, tint:'#5b8cff', license:'free-use' },
  ],
  seeds: [
    { artist: 'Nyla', track: 'Goldenrod', tag: 'NEW NEAR YOU', tint: '#22e5d4' },
    { artist: 'Wax Tropic', track: 'Heatwave', tag: 'RISING', tint: '#b983ff' },
  ],
  playlists: [
    { id: 'pl1', name: 'Late Night LA', count: 42, mins: 168, tint: '#ff5029', by: 'You' },
    { id: 'pl2', name: 'Tape Loops', count: 28, mins: 112, tint: '#b983ff', by: 'You' },
    { id: 'pl3', name: 'Pre-show warmup', count: 18, mins: 71, tint: '#22e5d4', by: 'You' },
    { id: 'pl4', name: 'Hyped this month', count: 36, mins: 142, tint: '#ffb84a', by: 'iHYPE', auto: true },
    { id: 'pl5', name: 'Basement Tapes radio', count: 24, mins: 96, tint: '#5b8cff', by: 'Nyla' },
  ],
  library: [
    { t: 'Carousel', a: 'Midnight Echo', len: '3:42', tint: '#ff5029' },
    { t: 'Goldenrod', a: 'Nyla', len: '3:18', tint: '#22e5d4' },
    { t: 'Heatwave', a: 'Wax Tropic', len: '3:48', tint: '#b983ff' },
    { t: 'Paper Cup', a: 'Sunroom', len: '2:58', tint: '#ffb84a' },
    { t: 'Slow Static', a: 'Midnight Echo', len: '4:05', tint: '#ff5029' },
    { t: 'Tidewater', a: 'Cold Harbor', len: '4:11', tint: '#5b8cff' },
  ],
  searchRecents: ['midnight echo', 'late set', 'shoegaze LA', 'the echo'],
  charts: [
    { rank: 1, prev: 2, artist: 'Midnight Echo', track: 'Carousel', hype: 4821, trend: [40,52,48,61,70,88,96], tint: '#ff5029' },
    { rank: 2, prev: 4, artist: 'Sunroom', track: 'Paper Cup', hype: 2960, trend: [22,30,26,34,40,38,45], tint: '#ffb84a' },
    { rank: 3, prev: 1, artist: 'Wax Tropic', track: 'Heatwave', hype: 2740, trend: [30,28,33,31,36,40,42], tint: '#b983ff' },
    { rank: 4, prev: 9, artist: 'Nyla', track: 'Goldenrod', hype: 1320, trend: [10,14,20,26,30,44,58], tint: '#22e5d4' },
    { rank: 5, prev: 5, artist: 'Cold Harbor', track: 'Tidewater', hype: 1104, trend: [18,20,19,24,22,26,28], tint: '#5b8cff' },
    { rank: 6, prev: 3, artist: 'Slow Mover', track: 'Driftwood', hype: 980, trend: [44,40,38,34,30,29,27], tint: '#ff3e9a' },
  ],
  favoriteLocations: [
    { id: 'fl1', name: 'The Echo', kind: 'Venue', city: 'Echo Park, LA', upcoming: 4, dist: '0.4 mi', tint: '#22e5d4' },
    { id: 'fl2', name: 'Zebulon', kind: 'Venue', city: 'Frogtown, LA', upcoming: 2, dist: '1.2 mi', tint: '#b983ff' },
    { id: 'fl3', name: 'Gold-Diggers', kind: 'Venue', city: 'East Hollywood, LA', upcoming: 3, dist: '2.1 mi', tint: '#ffb84a' },
    { id: 'fl4', name: 'Los Angeles', kind: 'City', city: 'Your home scene', upcoming: 37, dist: '—', tint: '#ff5029' },
  ],
  radioShows: [
    { id: 'rs1', name: 'Late Set', host: 'Robin Vega', day: 'Fri · 11 PM', listeners: '1.3K', status: 'LIVE', genre: 'lo-fi · after hours', tint: '#5b8cff' },
    { id: 'rs2', name: 'Basement Tapes', host: 'The Lash', day: 'Sat · 10 PM', listeners: '880', status: 'SCHEDULED', genre: 'garage · live sets', tint: '#22e5d4' },
    { id: 'rs3', name: 'Golden Hour', host: 'Sunroom', day: 'Sun · 6 PM', listeners: '640', status: 'SCHEDULED', genre: 'dream-pop · sunset', tint: '#ffb84a' },
    { id: 'rs4', name: 'After Dark', host: 'Midnight Echo', day: 'Sat · 1 AM', listeners: '1.1K', status: 'LIVE', genre: 'shoegaze · late night', tint: '#ff5029' },
    { id: 'rs5', name: 'Tape Loops', host: 'Robin V', day: 'Wed · 9 PM', listeners: '420', status: 'SCHEDULED', genre: 'ambient · experiments', tint: '#ff3e9a' },
  ],
  recommended: [
    { id: 'rec1', artist: 'Cold Harbor', event: 'Tidewater — Live at Zebulon', date: 'Thu Jun 26 · 8:00 PM', price: 16, reason: 'Because you hyped Midnight Echo', tint: '#5b8cff' },
    { id: 'rec2', artist: 'Slow Mover', event: 'Driftwood Release Show', date: 'Fri Jun 27 · 9:30 PM', price: 14, reason: 'Rising in your Charts', tint: '#ff3e9a' },
    { id: 'rec3', artist: 'Nyla', event: 'Basement Tapes: Late Set', date: 'Sat Jun 21 · 11:00 PM', price: 15, reason: 'On a station you follow', tint: '#22e5d4' },
  ],
  dj: {
    name: 'Robin Vega', handle: '@robinv', city: 'Los Angeles, CA', listeners: '3.2K', onAir: true,
    shows: [
      { id: 'dj1', name: 'Late Set', day: 'Fri · 11 PM', listeners: 1320, status: 'LIVE', tint: '#5b8cff' },
      { id: 'dj2', name: 'Golden Hour', day: 'Sun · 6 PM', listeners: 840, status: 'SCHEDULED', tint: '#ffb84a' },
      { id: 'dj3', name: 'After Dark', day: 'Sat · 1 AM', listeners: 610, status: 'DRAFT', tint: '#ff3e9a' },
    ],
  },
  fan: {
    name: 'Robin Vega', handle: '@robinv', city: 'Los Angeles, CA',
    hypesLeft: 3, hypesThisWeek: 2, referralEarned: 24.30,
    perks: [
      { icon: 'ticket', label: 'Early ticket access', sub: 'Hyped artists drop to you first' },
      { icon: 'dollar', label: '10% on referrals', sub: 'Share a show, earn the promoter cut' },
      { icon: 'radio', label: 'Shapes your radio', sub: 'Hypes tune your stations' },
    ],
  },
  hypedFeed: [
    { id: 'h1', artist: 'Midnight Echo', track: 'Carousel', tint: '#ff5029', event: 'Live at The Echo', date: 'Fri Jun 20 · 9:00 PM', price: 18, status: 'JUST DROPPED', earlyAccess: true, left: 4 },
    { id: 'h2', artist: 'Nyla', track: 'Goldenrod', tint: '#22e5d4', event: 'Basement Tapes: Late Set', date: 'Sat Jun 21 · 11:00 PM', price: 15, status: 'PRESALE', earlyAccess: true, left: 12 },
    { id: 'h3', artist: 'Sunroom', track: 'Paper Cup', tint: '#ffb84a', event: 'Album Release', date: 'Sun Jun 22 · 7:00 PM', price: 20, status: 'ON SALE', earlyAccess: false, left: 28 },
  ],
  demand: [
    { artist: 'Midnight Echo', local: 2140, trend: [40,52,48,61,70,88,96], up: '+38%', tint: '#ff5029' },
    { artist: 'Nyla', local: 1320, trend: [10,14,20,26,30,44,58], up: '+61%', tint: '#22e5d4' },
    { artist: 'Wax Tropic', local: 980, trend: [30,28,33,31,36,40,42], up: '+12%', tint: '#b983ff' },
    { artist: 'Sunroom', local: 760, trend: [22,30,26,34,40,38,45], up: '+19%', tint: '#ffb84a' },
  ],
  receipt: { show: 'Midnight Echo — Live at The Echo', date: 'Fri Jun 20, 2026', tickets: 218, face: 18, gross: 3924 },
  offers: [
    { id: 'o1', venue: 'The Echo', city: 'Los Angeles', date: 'Fri Jun 27', cap: 300, price: 18, note: 'Saw your 2,140 local hypes — want you headlining a Friday. Backline provided.', tint: '#22e5d4', when: '2h ago' },
    { id: 'o2', venue: 'Zebulon', city: 'Los Angeles', date: 'Sat Jul 12', cap: 220, price: 20, note: 'Late slot, killer room. We handle promo.', tint: '#b983ff', when: '1d ago' },
  ],
  fanReceipts: [
    { id: 'r1', artist: 'Midnight Echo', event: 'Live at The Echo', date: 'May 30, 2026', price: 18, qty: 2, tint: '#ff5029' },
    { id: 'r2', artist: 'Sunroom', event: 'Album Release', date: 'May 12, 2026', price: 20, qty: 1, tint: '#ffb84a' },
  ],
  promoter: {
    name: 'Robin Vega', handle: '@robinv', earnedAllTime: 412.80, pending: 86.40, clicks: 1840, conversion: '7.2%',
    links: [
      { show: 'Midnight Echo — The Echo', code: 'robinv-echo', clicks: 612, sold: 44, earned: 79.20, tint: '#ff5029' },
      { show: 'Nyla — Basement Tapes', code: 'robinv-nyla', clicks: 488, sold: 31, earned: 46.50, tint: '#22e5d4' },
      { show: 'Sunroom — Album Release', code: 'robinv-sun', clicks: 740, sold: 58, earned: 116.00, tint: '#ffb84a' },
    ],
  },
  friends: [
    { name: 'Dev R', tint: '#b983ff' }, { name: 'Mara K', tint: '#22e5d4' },
    { name: 'Theo P', tint: '#ffb84a' }, { name: 'Sun L', tint: '#ff5029' },
  ],
  notifications: {
    fan: [
      { id: 'nf1', icon: 'ticket', tone: 'var(--accent)', title: 'Tickets dropped', body: 'Midnight Echo — Live at The Echo. You get first access.', when: '12m', unread: true },
      { id: 'nf2', icon: 'dollar', tone: '#22e5d4', title: 'You earned $3.60', body: 'A friend bought a ticket through your link.', when: '2h', unread: true },
      { id: 'nf3', icon: 'sprout', tone: '#b983ff', title: '2 rising artists near you', body: 'New Seeds matched to your taste.', when: '1d', unread: false },
      { id: 'nf4', icon: 'radio', tone: '#5b8cff', title: 'Nyla is on air', body: 'Late Set radio just went live.', when: '2d', unread: false },
    ],
    artist: [
      { id: 'na1', icon: 'ticket', tone: '#22e5d4', title: 'New booking offer', body: 'The Echo wants you Fri Jun 27 — 300 cap, $18.', when: '2h', unread: true },
      { id: 'na2', icon: 'flame', tone: 'var(--accent)', title: '+214 hypes this week', body: "You're trending #1 on the LA demand radar.", when: '1d', unread: true },
      { id: 'na3', icon: 'dollar', tone: '#22e5d4', title: 'Payout sent · $1,872', body: 'Your 45% from The Echo cleared.', when: '3d', unread: false },
    ],
    venue: [
      { id: 'nv1', icon: 'check', tone: '#22e5d4', title: 'Midnight Echo accepted', body: 'Fri Jun 27 is confirmed — now on sale.', when: '1h', unread: true },
      { id: 'nv2', icon: 'arrowUp', tone: '#5b8cff', title: 'Nyla +61% locally', body: 'Trending in your area — book the room early.', when: '1d', unread: true },
      { id: 'nv3', icon: 'dollar', tone: '#22e5d4', title: 'Payout sent · $1,872', body: 'Your 45% from the Jun 20 show cleared.', when: '3d', unread: false },
    ],
    promoter: [
      { id: 'np1', icon: 'dollar', tone: '#22e5d4', title: 'You earned $116.00', body: '58 tickets sold through your Sunroom link.', when: '4h', unread: true },
      { id: 'np2', icon: 'flame', tone: 'var(--accent)', title: 'Your link is hot', body: '740 clicks on the Sunroom show this week.', when: '1d', unread: true },
      { id: 'np3', icon: 'ticket', tone: '#b983ff', title: 'New show to push', body: 'Wax Tropic added a date near you.', when: '2d', unread: false },
    ],
    dj: [
      { id: 'nd1', icon: 'radio', tone: '#5b8cff', title: 'Late Set hit 1.3K live', body: 'Your Friday station is your biggest yet.', when: '20m', unread: true },
      { id: 'nd2', icon: 'flame', tone: 'var(--accent)', title: 'Heatwave got 84 hypes', body: 'A track you spun is climbing the charts.', when: '3h', unread: true },
      { id: 'nd3', icon: 'user', tone: '#b983ff', title: '+212 followers this week', body: 'Listeners are subscribing to your stations.', when: '1d', unread: false },
    ],
  },
};

// Helper: look up artist data by name, with fallback
window.lookupArtist = function(name, tint) {
  const D = window.IHYPE_DATA;
  if (D.artist && D.artist.name === name) return Object.assign({}, D.artist, { tint: tint || D.artist.tint || '#ff5029' });
  const show = (D.shows || []).find(function(s) { return s.artist === name; });
  const seed = (D.seeds || []).find(function(s) { return s.artist === name; });
  return {
    name: name,
    handle: '@' + name.toLowerCase().replace(/\s+/g, ''),
    city: (show && show.city) || 'Los Angeles, CA',
    tint: tint || (show && show.tint) || '#ff5029',
    tags: (seed && seed.tags) || [],
    bio: 'Independent artist on iHYPE.',
    tracks: (D.library || []).filter(function(t) { return t.a === name; }).map(function(t, i) {
      return { t: t.t, len: t.len, plays: ['48.1K','31.7K','22.3K','18.9K','14.2K'][i] || '10.1K' };
    }),
  };
};
