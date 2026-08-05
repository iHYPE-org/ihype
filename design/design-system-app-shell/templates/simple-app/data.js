/* iHYPE — simplified app dataset. Mock shape mirrors openapi.yaml; lib/api.js reads window.IHYPE_DATA in mock mode. */
window.IHYPE_SIMPLE_DATA = {
  radio: {
    genre: [
      { id:'g1', name:'Dream-Pop', meta:'412 stations · 18 live now', sub:'Reverb, tape loops, slow drums', tint:'#ff5029', live:true },
      { id:'g2', name:'Garage & Post-Punk', meta:'260 stations · 6 live now', sub:'Loud rooms, short songs', tint:'#b983ff', live:true },
      { id:'g3', name:'Ambient', meta:'188 stations', sub:'Long form, no vocals', tint:'#5b8cff', live:false },
      { id:'g4', name:'R&B / Soul', meta:'304 stations · 11 live now', sub:'Warm, low end, live band', tint:'#22e5d4', live:true }
    ],
    new: [
      { id:'n1', name:'Goldenrod — Nyla', meta:'Added 2h ago', sub:'First release in 14 months', tint:'#22e5d4', live:false },
      { id:'n2', name:'Paper Cup — Sunroom', meta:'Added today', sub:'Album out Sunday', tint:'#ffb84a', live:false },
      { id:'n3', name:'Driftwood — Slow Mover', meta:'Added yesterday', sub:'Recorded live at Zebulon', tint:'#ff3e9a', live:false }
    ],
    local: [
      { id:'l1', name:'Los Angeles · Tonight', meta:'37 shows · 9 rooms live', sub:'Everything playing within 12 mi', tint:'#ff5029', live:true },
      { id:'l2', name:'Echo Park Rooms', meta:'12 stations', sub:'The Echo · Zebulon · Gold-Diggers', tint:'#22e5d4', live:false },
      { id:'l3', name:'Unsigned in LA', meta:'96 artists', sub:'No label, no agent, direct', tint:'#b983ff', live:false }
    ],
    recommended: [
      { id:'r1', name:'Late Set', meta:'Shared by Dev R', sub:'Because you both hyped Carousel', tint:'#5b8cff', live:true },
      { id:'r2', name:'Basement Tapes', meta:'Shared by Mara K', sub:'Garage · live sets', tint:'#22e5d4', live:false },
      { id:'r3', name:'Tape Loops', meta:'Shared by Theo P', sub:'Ambient · experiments', tint:'#ff3e9a', live:false }
    ],
    history: [
      { id:'h1', name:'More like Midnight Echo', meta:'Built from 84 plays', sub:'Your algorithm · on device', tint:'#ff5029', live:false },
      { id:'h2', name:'Late-night listening', meta:'Built from 41 plays', sub:'Weeknights after 11 PM', tint:'#b983ff', live:false },
      { id:'h3', name:'Repeat offenders', meta:'Built from 22 plays', sub:'Tracks you replay most', tint:'#ffb84a', live:false }
    ]
  },
  nowPlaying: { track:'Carousel', artist:'Midnight Echo', station:'More like Midnight Echo', at:'1:24', len:'3:42', pct:38, tint:'#ff5029' },
  shows: [
    { id:'s1', title:'Midnight Echo', venue:'The Echo', when:'Tonight · 9:00 PM', dist:'0.4 mi', price:18, hype:1284, tint:'#ff5029', live:true },
    { id:'s2', title:'Wax Tropic + Slow Mover', venue:'Zebulon', when:'Sat · 8:30 PM', dist:'1.2 mi', price:22, hype:642, tint:'#b983ff', live:false },
    { id:'s3', title:'Nyla', venue:'Gold-Diggers', when:'Sat · 11:00 PM', dist:'2.6 mi', price:15, hype:903, tint:'#22e5d4', live:false },
    { id:'s4', title:'Sunroom — Album Release', venue:'Lodge Room', when:'Sun · 7:00 PM', dist:'4.1 mi', price:20, hype:877, tint:'#ffb84a', live:false }
  ],
  fan: {
    name:'Robin Vega', handle:'@robinv', city:'Los Angeles, CA',
    hypeLink:'ihype.org/r/robinv',
    stats:[
      { k:'Hypes left', v:'3', d:'resets Monday' },
      { k:'Shows attended', v:'14', d:'since Jan' },
      { k:'Promoter earned', v:'$24.30', d:'10% pool share' },
      { k:'Connections', v:'38', d:'via your link' }
    ],
    tickets:[
      { id:'t1', title:'Midnight Echo', venue:'The Echo', when:'Tonight · 9:00 PM', seat:'GA', tint:'#ff5029' },
      { id:'t2', title:'Nyla', venue:'Gold-Diggers', when:'Sat · 11:00 PM', seat:'GA', tint:'#22e5d4' }
    ],
    recs:[
      { id:'rc1', title:'Cold Harbor at Zebulon', why:'Because you hyped Midnight Echo', when:'Thu · 8:00 PM', price:16 },
      { id:'rc2', title:'Slow Mover release show', why:'Rising in your listening', when:'Fri · 9:30 PM', price:14 }
    ],
    history:[
      { id:'p1', title:'Sunroom — Album Release', when:'May 12, 2026', paid:'$20.00' },
      { id:'p2', title:'Midnight Echo at The Echo', when:'Apr 28, 2026', paid:'$36.00' },
      { id:'p3', title:'Wax Tropic at Zebulon', when:'Mar 19, 2026', paid:'$22.00' }
    ]
  },
  artist: {
    name:'Midnight Echo', handle:'@midnightecho',
    stats:[
      { k:'Tickets sold', v:'218', d:'this month' },
      { k:'Your 70%', v:'$2,746', d:'settled' },
      { k:'Local demand', v:'2,140', d:'+38% this week' },
      { k:'Next payout', v:'Jun 24', d:'Stripe Connect' }
    ]
  },
  venue: {
    name:'The Echo', handle:'@theecho',
    stats:[
      { k:'Rooms booked', v:'12', d:'next 30 days' },
      { k:'Your 20%', v:'$784', d:'settled' },
      { k:'Sell-through', v:'86%', d:'avg this month' },
      { k:'Booking inbox', v:'4', d:'new offers' }
    ]
  },
  advertiser: {
    name:'Tone Arm Records', handle:'@tonearm',
    stats:[
      { k:'Active campaigns', v:'3', d:'2 pending review' },
      { k:'Impressions', v:'184K', d:'last 7 days' },
      { k:'Spend', v:'$1,240', d:'of $2,000 budget' },
      { k:'Music-related', v:'Verified', d:'required to run' }
    ],
    campaigns:[
      { id:'c1', name:'Nyla — Goldenrod release', status:'LIVE', spend:'$620 / $900', imp:'96K', ctr:'2.4%' },
      { id:'c2', name:'Tone Arm summer sampler', status:'REVIEW', spend:'$0 / $600', imp:'—', ctr:'—' },
      { id:'c3', name:'Vinyl subscription', status:'LIVE', spend:'$310 / $500', imp:'88K', ctr:'1.8%' }
    ]
  }
};

window.IHYPE_SIMPLE_DATA.venues = [
  { id:'v1', name:'The Echo', city:'Echo Park, Los Angeles', region:'Los Angeles', lat:34.0782, lng:-118.2606, cap:350, page:'ihype.org/v/theecho', today:[
    { time:'9:00 PM', artist:'Midnight Echo', price:18, status:'LIVE' },
    { time:'11:15 PM', artist:'Slow Mover', price:14, status:'ON SALE' } ] },
  { id:'v2', name:'Zebulon', city:'Frogtown, Los Angeles', region:'Los Angeles', lat:34.0908, lng:-118.2265, cap:220, page:'ihype.org/v/zebulon', today:[
    { time:'8:30 PM', artist:'Wax Tropic', price:22, status:'ON SALE' } ] },
  { id:'v3', name:'Gold-Diggers', city:'East Hollywood, Los Angeles', region:'Los Angeles', lat:34.0902, lng:-118.2935, cap:180, page:'ihype.org/v/golddiggers', today:[
    { time:'11:00 PM', artist:'Nyla', price:15, status:'ON SALE' },
    { time:'1:00 AM', artist:'Late Set · radio hour', price:0, status:'FREE' } ] },
  { id:'v4', name:'Lodge Room', city:'Highland Park, Los Angeles', region:'Los Angeles', lat:34.1119, lng:-118.1927, cap:400, page:'ihype.org/v/lodgeroom', today:[
    { time:'7:00 PM', artist:'Sunroom', price:20, status:'ON SALE' } ] },
  { id:'v5', name:'The Casbah', city:'San Diego', region:'Southern California', lat:32.7267, lng:-117.1919, cap:200, page:'ihype.org/v/casbah', today:[
    { time:'8:00 PM', artist:'Cold Harbor', price:16, status:'ON SALE' } ] },
  { id:'v6', name:'SOhO', city:'Santa Barbara', region:'Southern California', lat:34.4208, lng:-119.6982, cap:260, page:'ihype.org/v/soho', today:[
    { time:'9:00 PM', artist:'Paper Cup', price:15, status:'ON SALE' } ] },
  { id:'v7', name:'Pappy & Harriet\u2019s', city:'Pioneertown', region:'Southern California', lat:34.1614, lng:-116.5514, cap:300, page:'ihype.org/v/pappyandharriets', today:[
    { time:'8:30 PM', artist:'Tape Loops', price:24, status:'LOW' } ] },
  { id:'v8', name:'The Chapel', city:'San Francisco', region:'West Coast', lat:37.7565, lng:-122.4212, cap:500, page:'ihype.org/v/thechapel', today:[
    { time:'9:00 PM', artist:'Nyla', price:19, status:'ON SALE' } ] },
  { id:'v9', name:'Mississippi Studios', city:'Portland, OR', region:'West Coast', lat:45.5533, lng:-122.6752, cap:300, page:'ihype.org/v/mississippi', today:[
    { time:'8:00 PM', artist:'Slow Mover', price:17, status:'ON SALE' } ] },
  { id:'v10', name:'The Crocodile', city:'Seattle', region:'West Coast', lat:47.6131, lng:-122.3425, cap:560, page:'ihype.org/v/crocodile', today:[
    { time:'9:30 PM', artist:'Midnight Echo', price:21, status:'LOW' } ] }
];
window.IHYPE_SIMPLE_DATA.seeds = [
  { id:'sd1', artist:'Nyla', track:'Goldenrod', tag:'NEW NEAR YOU', why:'Playing Gold-Diggers on Saturday', len:'3:21', preview:22, genre:'R&B' },
  { id:'sd2', artist:'Wax Tropic', track:'Heatwave', tag:'RISING', why:'Up 61% in your city this week', len:'4:02', preview:30, genre:'Dream-Pop' },
  { id:'sd3', artist:'Cold Harbor', track:'Tidewater', tag:'FROM YOUR HISTORY', why:'Because you replay Carousel', len:'4:11', preview:18, genre:'Ambient' },
  { id:'sd4', artist:'Sunroom', track:'Paper Cup', tag:'UNSIGNED', why:'Uploaded 2 days ago · no label', len:'3:12', preview:15, genre:'Garage' },
  { id:'sd5', artist:'Tape Loops', track:'Kilnwork', tag:'DEEP CUT', why:'Long form · played after midnight', len:'6:30', preview:28, genre:'Ambient' },
  { id:'sd6', artist:'Slow Mover', track:'Driftwood', tag:'NEW NEAR YOU', why:'Release show at Zebulon on Friday', len:'3:48', preview:24, genre:'Garage' }
];
window.IHYPE_SIMPLE_DATA.charts = [
  { rank:1, artist:'Midnight Echo', track:'Carousel', hype:'4.8k', move:'+1' },
  { rank:2, artist:'Sunroom', track:'Paper Cup', hype:'2.9k', move:'+2' },
  { rank:3, artist:'Nyla', track:'Goldenrod', hype:'2.1k', move:'NEW' },
  { rank:4, artist:'Wax Tropic', track:'Heatwave', hype:'1.6k', move:'−1' },
  { rank:5, artist:'Cold Harbor', track:'Tidewater', hype:'1.2k', move:'+3' },
  { rank:6, artist:'Slow Mover', track:'Driftwood', hype:'980', move:'−3' }
];
window.IHYPE_SIMPLE_DATA.recommendedTracks = [
  { id:'rt1', artist:'Cold Harbor', track:'Tidewater', why:'Because you hyped Midnight Echo', len:'4:11' },
  { id:'rt2', artist:'Slow Mover', track:'Driftwood', why:'Rising in your listening', len:'3:48' },
  { id:'rt3', artist:'Paper Cup', track:'Sunroom', why:'Shared by Mara K', len:'3:12' },
  { id:'rt4', artist:'Tape Loops', track:'Kilnwork', why:'From a station you finished twice', len:'6:30' }
];
window.IHYPE_SIMPLE_DATA.playlists = [
  { id:'pl0', name:'Discover saves', count:9, mins:34, by:'You', auto:true },
  { id:'pl1', name:'Late Night LA', count:42, mins:168, by:'You' },
  { id:'pl2', name:'Tape Loops', count:28, mins:112, by:'You' },
  { id:'pl3', name:'Shoegaze Revival', count:64, mins:246, by:'Dev R' },
  { id:'pl4', name:'Basement Tapes', count:24, mins:96, by:'Mara K' }
];
window.IHYPE_SIMPLE_DATA.chartGenres = ['All','Dream-Pop','Garage','Ambient','R&B'];
window.IHYPE_SIMPLE_DATA.chartsByScope = {
  local: [
    { rank:1, artist:'Midnight Echo', track:'Carousel', genre:'Dream-Pop', hype:'4.8k', move:'+1', seeds:52, shows:31, radio:17, top:'Echo Park' },
    { rank:2, artist:'Sunroom', track:'Paper Cup', genre:'Garage', hype:'2.9k', move:'+2', seeds:44, shows:38, radio:18, top:'Highland Park' },
    { rank:3, artist:'Nyla', track:'Goldenrod', genre:'R&B', hype:'2.1k', move:'NEW', seeds:66, shows:14, radio:20, top:'East Hollywood' },
    { rank:4, artist:'Wax Tropic', track:'Heatwave', genre:'Dream-Pop', hype:'1.6k', move:'−1', seeds:40, shows:42, radio:18, top:'Frogtown' },
    { rank:5, artist:'Cold Harbor', track:'Tidewater', genre:'Ambient', hype:'1.2k', move:'+3', seeds:58, shows:12, radio:30, top:'Silver Lake' },
    { rank:6, artist:'Slow Mover', track:'Driftwood', genre:'Garage', hype:'980', move:'−3', seeds:36, shows:46, radio:18, top:'Echo Park' }
  ],
  regional: [
    { rank:1, artist:'Nyla', track:'Goldenrod', genre:'R&B', hype:'12.4k', move:'+3', seeds:61, shows:19, radio:20, top:'Los Angeles' },
    { rank:2, artist:'Midnight Echo', track:'Carousel', genre:'Dream-Pop', hype:'11.8k', move:'−1', seeds:49, shows:33, radio:18, top:'Los Angeles' },
    { rank:3, artist:'Pale Harbor', track:'Saltflat', genre:'Ambient', hype:'8.2k', move:'NEW', seeds:70, shows:9, radio:21, top:'San Diego' },
    { rank:4, artist:'Sunroom', track:'Paper Cup', genre:'Garage', hype:'6.6k', move:'+1', seeds:42, shows:36, radio:22, top:'Santa Barbara' },
    { rank:5, artist:'Wax Tropic', track:'Heatwave', genre:'Dream-Pop', hype:'5.1k', move:'−2', seeds:38, shows:41, radio:21, top:'Pioneertown' },
    { rank:6, artist:'Cold Harbor', track:'Tidewater', genre:'Ambient', hype:'4.4k', move:'+2', seeds:55, shows:15, radio:30, top:'San Diego' }
  ],
  national: [
    { rank:1, artist:'Nyla', track:'Goldenrod', genre:'R&B', hype:'96k', move:'+2', seeds:58, shows:20, radio:22, top:'Los Angeles' },
    { rank:2, artist:'Vane', track:'Cold Open', genre:'Garage', hype:'88k', move:'+5', seeds:47, shows:31, radio:22, top:'Chicago' },
    { rank:3, artist:'Midnight Echo', track:'Carousel', genre:'Dream-Pop', hype:'74k', move:'−2', seeds:51, shows:29, radio:20, top:'Portland' },
    { rank:4, artist:'Halberd', track:'Nightwork', genre:'Ambient', hype:'61k', move:'NEW', seeds:64, shows:11, radio:25, top:'Brooklyn' },
    { rank:5, artist:'Sunroom', track:'Paper Cup', genre:'Garage', hype:'54k', move:'−1', seeds:41, shows:37, radio:22, top:'Austin' },
    { rank:6, artist:'Pale Harbor', track:'Saltflat', genre:'Ambient', hype:'42k', move:'+4', seeds:66, shows:10, radio:24, top:'Seattle' }
  ],
  global: [
    { rank:1, artist:'Vane', track:'Cold Open', genre:'Garage', hype:'410k', move:'+1', seeds:45, shows:30, radio:25, top:'London' },
    { rank:2, artist:'Nyla', track:'Goldenrod', genre:'R&B', hype:'388k', move:'−1', seeds:56, shows:21, radio:23, top:'Los Angeles' },
    { rank:3, artist:'Kiyo Mono', track:'Neon Rain', genre:'Dream-Pop', hype:'305k', move:'+6', seeds:60, shows:16, radio:24, top:'Tokyo' },
    { rank:4, artist:'Halberd', track:'Nightwork', genre:'Ambient', hype:'264k', move:'+2', seeds:62, shows:12, radio:26, top:'Berlin' },
    { rank:5, artist:'Midnight Echo', track:'Carousel', genre:'Dream-Pop', hype:'221k', move:'−3', seeds:50, shows:28, radio:22, top:'Portland' },
    { rank:6, artist:'Serra', track:'Bright Field', genre:'R&B', hype:'196k', move:'NEW', seeds:68, shows:9, radio:23, top:'São Paulo' }
  ]
};
window.IHYPE_SIMPLE_DATA.artists = {
  'Midnight Echo': { genre:'Dream-Pop', city:'Echo Park, Los Angeles', hypes:'4.8k', followers:'12.1k', since:'2023', page:'ihype.org/a/midnightecho',
    bio:'Four-piece built around tape delay and a Rhodes. Records live to half-inch in a Frogtown garage; has never played a show outside a 200-cap room.',
    tracks:[{track:'Carousel',len:'4:20'},{track:'Slow Static',len:'3:36'},{track:'Blue Hour',len:'5:02'}],
    shows:[{when:'Tonight · 9:00 PM',venue:'The Echo',price:18},{when:'Sat Aug 15 · 9:30 PM',venue:'Lodge Room',price:21}] },
  'Nyla': { genre:'R&B', city:'East Hollywood, Los Angeles', hypes:'2.1k', followers:'8.4k', since:'2024', page:'ihype.org/a/nyla',
    bio:'Solo writer-producer. Records vocals into the same SM7 she bought at seventeen. Unsigned by choice — every release has gone out through iHYPE first.',
    tracks:[{track:'Goldenrod',len:'3:21'},{track:'Paper Weight',len:'3:58'},{track:'Nine Lives',len:'4:12'}],
    shows:[{when:'Sat Aug 8 · 8:00 PM',venue:'Gold-Diggers',price:22}] },
  'Wax Tropic': { genre:'Dream-Pop', city:'Frogtown, Los Angeles', hypes:'1.6k', followers:'5.2k', since:'2022', page:'ihype.org/a/waxtropic',
    bio:'Duo trading guitar and modular. Up 61% in Los Angeles this week off a single unreleased seed.',
    tracks:[{track:'Heatwave',len:'4:02'},{track:'Fenceline',len:'3:29'}],
    shows:[{when:'Fri Aug 14 · 10:00 PM',venue:'Zebulon',price:20}] },
  'Cold Harbor': { genre:'Ambient', city:'Silver Lake, Los Angeles', hypes:'1.2k', followers:'3.9k', since:'2021', page:'ihype.org/a/coldharbor',
    bio:'Long-form ambient project. Sets run ninety minutes without a break and are usually booked after midnight.',
    tracks:[{track:'Tidewater',len:'4:11'},{track:'Nightwatch',len:'8:40'}],
    shows:[{when:'Thu Aug 20 · 11:30 PM',venue:'Zebulon',price:15}] },
  'Sunroom': { genre:'Garage', city:'Highland Park, Los Angeles', hypes:'2.9k', followers:'7.6k', since:'2023', page:'ihype.org/a/sunroom',
    bio:'Three-piece, no pedals, one amp each. Every song written in the room it was recorded in.',
    tracks:[{track:'Paper Cup',len:'3:12'},{track:'Kitchen Floor',len:'2:48'}],
    shows:[{when:'Tonight · 10:30 PM',venue:'Gold-Diggers',price:15}] },
  'Slow Mover': { genre:'Garage', city:'Echo Park, Los Angeles', hypes:'980', followers:'2.8k', since:'2024', page:'ihype.org/a/slowmover',
    bio:'Started as a solo four-track project, now a live quartet. Release show is the first ticketed date.',
    tracks:[{track:'Driftwood',len:'3:48'},{track:'Backlot',len:'3:05'}],
    shows:[{when:'Fri Aug 14 · 8:30 PM',venue:'Zebulon',price:14}] },
  'Tape Loops': { genre:'Ambient', city:'Glassell Park, Los Angeles', hypes:'620', followers:'1.9k', since:'2020', page:'ihype.org/a/tapeloops',
    bio:'One person, eight cassette decks. Pieces are built in a single pass and never edited afterward.',
    tracks:[{track:'Kilnwork',len:'6:30'},{track:'Dry Season',len:'7:14'}], shows:[] },
  'Pale Harbor': { genre:'Ambient', city:'San Diego', hypes:'8.2k', followers:'18.3k', since:'2022', page:'ihype.org/a/paleharbor',
    bio:'Regional breakout out of San Diego. Charted nationally off seeds alone before booking a single room.',
    tracks:[{track:'Saltflat',len:'5:20'}], shows:[] },
  'Vane': { genre:'Garage', city:'Chicago', hypes:'410k', followers:'96k', since:'2019', page:'ihype.org/a/vane',
    bio:'Chicago four-piece, currently the global #1 on iHYPE. Still splits every door 70/20/10.',
    tracks:[{track:'Cold Open',len:'3:02'}], shows:[] },
  'Halberd': { genre:'Ambient', city:'Brooklyn', hypes:'264k', followers:'54k', since:'2021', page:'ihype.org/a/halberd',
    bio:'Brooklyn ambient trio. Plays seated rooms and churches, never clubs.',
    tracks:[{track:'Nightwork',len:'9:12'}], shows:[] },
  'Kiyo Mono': { genre:'Dream-Pop', city:'Tokyo', hypes:'305k', followers:'71k', since:'2020', page:'ihype.org/a/kiyomono',
    bio:'Tokyo solo project. Fastest global climb on iHYPE this quarter.',
    tracks:[{track:'Neon Rain',len:'4:04'}], shows:[] },
  'Serra': { genre:'R&B', city:'São Paulo', hypes:'196k', followers:'42k', since:'2023', page:'ihype.org/a/serra',
    bio:'São Paulo writer and arranger. Debut entered the global chart at #6.',
    tracks:[{track:'Bright Field',len:'3:44'}], shows:[] }
};
window.IHYPE_SIMPLE_DATA.venueBios = {
  v1: 'Echo Park mainstay since 2001. Low stage, no barricade, notoriously good monitors.',
  v2: 'Converted Frogtown warehouse with a courtyard. Books late ambient and jazz sets after 11.',
  v3: 'Hotel bar and recording studio in one. Artists tracking upstairs usually play downstairs.',
  v4: 'Highland Park masonic hall, balcony seating, hard 11:30 curfew.'
};
window.IHYPE_SIMPLE_DATA.friends = [
  { id:'f1', name:'Dev R', handle:'@devr', via:'HYPE link · Mar 2026' },
  { id:'f2', name:'Mara K', handle:'@marak', via:'HYPE link · Jan 2026' },
  { id:'f3', name:'Theo P', handle:'@theop', via:'HYPE link · Jun 2026' },
  { id:'f4', name:'Sun L', handle:'@sunl', via:'HYPE link · Feb 2026' }
];
window.IHYPE_DATA = Object.assign({}, window.IHYPE_DATA, window.IHYPE_SIMPLE_DATA);
