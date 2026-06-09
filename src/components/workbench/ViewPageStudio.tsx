'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShellV2';
import { sanitizeChatHtml, sanitizePreviewHtml } from '@/lib/sanitize-html';

// ── TYPES ──────────────────────────────────────────────────────────────────
type Role = 'artist' | 'venue' | 'promoter' | 'fan';
type Device = 'desktop' | 'mobile';
type FontKey = 'editorial' | 'grotesk' | 'serif' | 'mono';
type LayoutKey = 'spotlight' | 'zine' | 'poster' | 'gallery';
type MoodKey = 'dark' | 'light';
type ApTab = 'sections' | 'photos' | 'music' | 'links' | 'library';

interface LibItem { id: string; label: string; kw: string[]; bg: string; }
interface PhotoItem { id: string; name: string; url: string; hero: boolean; }
interface TrackItem { id: string; name: string; dur: string; }
interface SectionDef { id: string; label: string; icon: string; on: boolean; }
interface PressQuote { q: string; pub: string; yr: string; }
interface PressData { quotes: PressQuote[]; mentions: string; }
interface ReleaseData { title: string; type: string; date: string; artSrc: string; streams: Record<string, string>; }
interface BookingData { genres: string[]; market: string; contact: string; cap: string; note: string; }
interface NewsletterData { headline: string; cta: string; }

interface Palette { bg: string; surface: string; line: string; ink: string; ink2: string; accent: string; accent2: string; }
interface Theme { name: string; mood: MoodKey; font: FontKey; layout: LayoutKey; palette: Palette; tagline: string | null; bio: string | null; radius: number; heroUrl?: string; }
interface FontDef { name: string; display: string; body: string; label: string; accent: string; dWeight: number; tight: string; }
interface SectionItem { t: string; m: string; }
interface Section { kind: 'tracks' | 'shows' | 'about'; title: string; items: SectionItem[]; }
interface RoleHero { kicker: string; stat: string; statLabel: string; cta: string; }
interface RoleDef { label: string; defaultName: string; defaultVibe: string; hero: RoleHero; tagline: string; bio: string; sections: Section[]; }
interface Content { name: string; tagline: string; bio: string; hero: RoleHero; sections: Section[]; defaultVibe: string; }
interface Look { id: string; name: string; mood: MoodKey; font: FontKey; layout: LayoutKey; kw: string[]; palette: Palette; }

type ChatMsg =
  | { id: string; type: 'ai'; html: string }
  | { id: string; type: 'user'; text: string }
  | { id: string; type: 'sys'; text: string }
  | { id: string; type: 'chips'; kind: 'role' | 'genre' | 'stage' | 'vibe'; chips: { value: string; label: string }[]; answered?: string }
  | { id: string; type: 'dirs' };

// ── DATA ───────────────────────────────────────────────────────────────────
const FONTS: Record<FontKey, FontDef> = {
  editorial: { name: 'Editorial',  display: "'Syne', sans-serif",                body: "'DM Sans', sans-serif",      label: "'JetBrains Mono', monospace", accent: "'Instrument Serif', serif",          dWeight: 800, tight: '-.03em' },
  grotesk:   { name: 'Grotesk',    display: "'Bricolage Grotesque', sans-serif", body: "'Space Grotesk', sans-serif",label: "'Space Grotesk', sans-serif",  accent: "'Bricolage Grotesque', sans-serif",  dWeight: 800, tight: '-.04em' },
  serif:     { name: 'Serif',      display: "'Instrument Serif', serif",         body: "'DM Sans', sans-serif",      label: "'JetBrains Mono', monospace", accent: "'Instrument Serif', serif",          dWeight: 400, tight: '-.01em' },
  mono:      { name: 'Mono',       display: "'Space Grotesk', sans-serif",       body: "'DM Sans', sans-serif",      label: "'JetBrains Mono', monospace", accent: "'JetBrains Mono', monospace",        dWeight: 700, tight: '-.02em' },
};

const LAYOUTS: LayoutKey[] = ['spotlight', 'zine', 'poster', 'gallery'];

const LOOKS: Look[] = [
  { id:'velvet',    name:'Midnight Velvet',    mood:'dark',  font:'editorial', layout:'spotlight', kw:['moody','night','r&b','soul','smooth','dark','sultry','velvet','jazz','slow'],          palette:{bg:'#0b0712',surface:'#171022',line:'#2a2036',ink:'#f4eefc',ink2:'#bda9da',accent:'#b983ff',accent2:'#ff3e9a'} },
  { id:'ember',     name:'Ember Heat',         mood:'dark',  font:'grotesk',   layout:'poster',    kw:['energy','hot','loud','rock','punk','bold','fire','aggressive','hard','rap','hype'],    palette:{bg:'#0c0805',surface:'#1a120b',line:'#2e2114',ink:'#fdf3ea',ink2:'#d6a98a',accent:'#ff5029',accent2:'#ffb84a'} },
  { id:'paper',     name:'Sun-Faded Paper',    mood:'light', font:'serif',     layout:'zine',      kw:['americana','folk','warm','acoustic','vintage','indie','soft','country','intimate'],   palette:{bg:'#f4ece0',surface:'#fbf6ee',line:'#e0d3c0',ink:'#211a12',ink2:'#6f5f4a',accent:'#c2451f',accent2:'#3b6b4a'} },
  { id:'neon',      name:'Neon Hyperpop',      mood:'dark',  font:'mono',      layout:'gallery',   kw:['neon','hyperpop','electronic','pop','club','glitch','future','rave','synth','dance'],  palette:{bg:'#07060f',surface:'#120f24',line:'#241f3e',ink:'#f0fbff',ink2:'#8fd0e6',accent:'#22e5d4',accent2:'#ff3e9a'} },
  { id:'mint',      name:'Cool Mint',          mood:'light', font:'grotesk',   layout:'gallery',   kw:['fresh','clean','minimal','airy','calm','ambient','chill','lo-fi','modern','bright'],   palette:{bg:'#eef4f0',surface:'#ffffff',line:'#d6e2da',ink:'#0e1a14',ink2:'#5a7065',accent:'#1f8a5b',accent2:'#2a6fdb'} },
  { id:'cobalt',    name:'Cobalt Midnight',    mood:'dark',  font:'editorial', layout:'spotlight', kw:['blue','cool','dreamy','shoegaze','synth','melancholy','wave','deep','ocean','night'],  palette:{bg:'#070a14',surface:'#0f1626',line:'#1d2940',ink:'#eef3fb',ink2:'#9db4d6',accent:'#5b8dff',accent2:'#22e5d4'} },
  { id:'bubblegum', name:'Bubblegum',          mood:'light', font:'grotesk',   layout:'poster',    kw:['fun','playful','pop','cute','bubbly','bright','happy','colorful','teen','sweet'],      palette:{bg:'#fff0f6',surface:'#ffffff',line:'#ffd0e4',ink:'#2a0a1c',ink2:'#a04f72',accent:'#ff3e9a',accent2:'#b983ff'} },
  { id:'noir',      name:'Concrete Noir',      mood:'dark',  font:'mono',      layout:'zine',      kw:['industrial','techno','minimal','brutal','grey','underground','warehouse','noir'],      palette:{bg:'#0a0a0b',surface:'#141416',line:'#262629',ink:'#f2f2f3',ink2:'#9a9a9e',accent:'#e8e8ea',accent2:'#ff5029'} },
  { id:'jazz',      name:'Blue Note',          mood:'dark',  font:'serif',     layout:'spotlight', kw:['jazz','soul','blues','smooth','bebop','classic','vinyl'],                              palette:{bg:'#08080f',surface:'#12121e',line:'#20203a',ink:'#f0ece4',ink2:'#9090a8',accent:'#4060ff',accent2:'#d4b060'} },
  { id:'lofi',      name:'Lo-Fi Bedroom',      mood:'dark',  font:'mono',      layout:'zine',      kw:['lofi','bedroom','cassette','tape','chill','hazy','vintage'],                           palette:{bg:'#1a1610',surface:'#231e18',line:'#352e24',ink:'#f0e8d0',ink2:'#a89070',accent:'#d4a060',accent2:'#8090a0'} },
];

const LIBRARY: LibItem[] = [
  {id:'l01',label:'Late night stage', kw:['dark','moody','stage','night','r&b','soul'],          bg:'linear-gradient(160deg,#0b0712 0%,#231040 55%,#0e0818 100%)'},
  {id:'l02',label:'Crowd energy',     kw:['concert','energy','crowd','show','live','rock'],      bg:'linear-gradient(145deg,#0c0805 0%,#3a0c02 55%,#c03010 100%)'},
  {id:'l03',label:'Neon club',        kw:['neon','electronic','club','rave','synth','hyperpop'], bg:'linear-gradient(145deg,#07060f 0%,#0c1f2e 55%,#1ab5a8 100%)'},
  {id:'l04',label:'Sun-faded paper',  kw:['folk','indie','warm','acoustic','vintage'],           bg:'linear-gradient(160deg,#e8dcc8 0%,#c4a878 55%,#9a7040 100%)'},
  {id:'l05',label:'Pink dawn',        kw:['dream','pop','soft','pastel','shoegaze','ethereal'],  bg:'linear-gradient(160deg,#180824 0%,#5a1040 55%,#e03088 100%)'},
  {id:'l06',label:'Concrete noir',    kw:['industrial','minimal','dark','raw','techno'],         bg:'linear-gradient(145deg,#0a0a0b 0%,#1c1c1e 50%,#2e2e32 100%)'},
  {id:'l07',label:'Cobalt midnight',  kw:['blue','cool','deep','shoegaze','wave'],               bg:'linear-gradient(160deg,#070a14 0%,#0f2040 55%,#3060cc 100%)'},
  {id:'l08',label:'Forest ambient',   kw:['ambient','green','calm','organic','peaceful'],        bg:'linear-gradient(160deg,#081408 0%,#142814 55%,#187044 100%)'},
  {id:'l09',label:'Amber festival',   kw:['summer','festival','warm','outdoor','golden'],        bg:'linear-gradient(145deg,#0c0805 0%,#3a2205 55%,#d09020 100%)'},
  {id:'l10',label:'Purple haze',      kw:['psychedelic','purple','dream','trip','soul'],         bg:'linear-gradient(160deg,#0d0816 0%,#2a1040 55%,#9060e0 100%)'},
  {id:'l11',label:'Bright minimal',   kw:['minimal','clean','bright','modern','fresh'],          bg:'linear-gradient(160deg,#f2f2f4 0%,#dde0e8 55%,#c8ccda 100%)'},
  {id:'l12',label:'Red heat',         kw:['rock','punk','hard','aggressive','metal','fire'],     bg:'linear-gradient(145deg,#0a0000 0%,#2a0808 55%,#a81010 100%)'},
  {id:'l13',label:'Jazz smoke',       kw:['jazz','blues','moody','smooth','late night'],         bg:'linear-gradient(160deg,#080608 0%,#201020 55%,#504060 100%)'},
  {id:'l14',label:'Tropical',         kw:['tropical','dancehall','afrobeats','summer','bright'], bg:'linear-gradient(160deg,#060e08 0%,#0a2818 55%,#20a840 100%)'},
  {id:'l15',label:'Ice arena',        kw:['edm','rave','trance','bright','electronic','festival'],bg:'linear-gradient(160deg,#080c14 0%,#102030 55%,#20c8f0 100%)'},
  {id:'l16',label:'Warm R&B',         kw:['r&b','soul','warm','smooth','sultry','evening'],      bg:'linear-gradient(145deg,#100806 0%,#2e1408 55%,#c84820 100%)'},
];

const DEFAULT_SECTIONS: SectionDef[] = [
  { id:'bio',        label:'Bio & About',       icon:'📝', on:true  },
  { id:'music',      label:'Music',             icon:'🎵', on:true  },
  { id:'release',    label:'Release Spotlight', icon:'💿', on:false },
  { id:'shows',      label:'Shows & Tour',      icon:'📅', on:true  },
  { id:'press',      label:'Press',             icon:'📰', on:false },
  { id:'booking',    label:'Booking Info',      icon:'🤝', on:false },
  { id:'newsletter', label:'Newsletter',        icon:'✉️', on:false },
];

const LK_PLATFORMS = [
  { key:'spotify',    label:'Spotify',      icon:'♫', ph:'spotify.com/artist/…' },
  { key:'apple',      label:'Apple Music',  icon:'♪', ph:'music.apple.com/…'    },
  { key:'instagram',  label:'Instagram',    icon:'📸', ph:'instagram.com/…'       },
  { key:'tiktok',     label:'TikTok',       icon:'♬', ph:'tiktok.com/@…'         },
  { key:'website',    label:'Website',      icon:'🌐', ph:'yoursite.com'          },
  { key:'soundcloud', label:'SoundCloud',   icon:'☁️', ph:'soundcloud.com/…'     },
  { key:'bandcamp',   label:'Bandcamp',     icon:'♩', ph:'you.bandcamp.com'       },
];

const BOOKING_GENRES = ['R&B','Hip-Hop','Pop','Rock','Indie','Electronic','Folk','Jazz','Other'];

const ROLES: Record<Role, RoleDef> = {
  artist: {
    label:'Artist', defaultName:'Jordan Nore', defaultVibe:'moody late-night alt-R&B, smooth and a little mysterious',
    hero:{ kicker:'ARTIST · CHICAGO', stat:'2,140', statLabel:'HYPE this month', cta:'▶ Listen' },
    tagline:'Slow songs for late trains home.',
    bio:"Alt-R&B out of Logan Square. I write at night and record into whatever's closest. Three EPs, one band, zero rush.",
    sections:[
      { kind:'tracks', title:'Top tracks', items:[{t:'Velvet Hours',m:'2:58 · 540 HYPE'},{t:'Carmine',m:'3:24 · 412 HYPE'},{t:'Northbound',m:'4:01 · 388 HYPE'},{t:'Slow Combust',m:'3:12 · 301 HYPE'}] },
      { kind:'shows',  title:'Next shows', items:[{t:'Empty Bottle',m:'Fri Jun 6 · Ukrainian Village'},{t:'Sleeping Village',m:'Sat Jun 21 · Avondale'}] },
    ],
  },
  venue: {
    label:'Venue', defaultName:'Empty Bottle', defaultVibe:'gritty, beloved 400-cap room — indie, punk, electronic',
    hero:{ kicker:'VENUE · UKRAINIAN VILLAGE', stat:'400', statLabel:'capacity', cta:'Book this room' },
    tagline:"Chicago's living room for loud music.",
    bio:"400 capacity, open since '92. Indie, punk, and electronic seven nights a week. If it's about to break, it played here first.",
    sections:[
      { kind:'shows', title:'This month', items:[{t:'Mau Lwin',m:'Thu Jun 5 · bedroom pop'},{t:'The Veldt Kids',m:'Sat Jun 14 · post-punk'},{t:'Dossier',m:'Fri Jun 27 · house / electronic'}] },
      { kind:'about', title:'The room',   items:[{t:'Capacity 400',m:'Standing · two bars · green room'},{t:'Load-in',m:'Alley access · house backline available'}] },
    ],
  },
  promoter: {
    label:'Promoter', defaultName:'Late Hour Collective', defaultVibe:'tastemaker club nights — house, techno, after-dark energy',
    hero:{ kicker:'PROMOTER · CHICAGO', stat:'128', statLabel:'shows presented', cta:'Pitch me a date' },
    tagline:'We throw the nights you hear about Monday.',
    bio:'Independent promoters since 2019. House, techno, and the occasional left turn. 81% average sell-through across 128 shows.',
    sections:[
      { kind:'shows', title:'Recent nights', items:[{t:'Basement Heat · Vol 9',m:'Sold out · 480 cap'},{t:'After Dark w/ Dossier',m:'92% paid · Pilsen'},{t:'Warehouse Series 04',m:'Sold out · secret location'}] },
      { kind:'about', title:'What we book', items:[{t:'House · techno · club',m:'300–800 cap rooms'},{t:'Late slots',m:'10pm–4am · weekends'}] },
    ],
  },
  fan: {
    label:'Fan', defaultName:'Riley', defaultVibe:'a music-obsessed regular who lives for live shows',
    hero:{ kicker:'FAN · CHICAGO', stat:'1,204', statLabel:'HYPE given', cta:'+ Follow' },
    tagline:'I was into them before, obviously.',
    bio:"Show-goer, seed-swiper, certified early adopter. I've HYPEd 1,204 times and been to 38 shows this year. Ask me who's next.",
    sections:[
      { kind:'tracks', title:'My top 5 this week', items:[{t:'Jordan Nore',m:'Alt-R&B · 12 HYPE'},{t:'Mau Lwin',m:'Bedroom pop · 9 HYPE'},{t:'The Veldt Kids',m:'Post-punk · 7 HYPE'},{t:'Sasha Quill',m:'Hyperpop · 6 HYPE'}] },
      { kind:'shows',  title:"Shows I've been to", items:[{t:'38 shows',m:'this year · 6 cities'},{t:'Front row certified',m:'Empty Bottle regular'}] },
    ],
  },
};

const VIBE_CHIPS: Record<Role, string[]> = {
  artist:   ['moody late-night R&B','sun-faded indie folk','neon hyperpop','DIY punk zine','dreamy shoegaze','bold rap energy'],
  venue:    ['gritty beloved dive','sleek modern club','warm listening room','industrial warehouse'],
  promoter: ['after-dark techno','tastemaker indie nights','big festival energy','underground warehouse'],
  fan:      ['certified early adopter','vinyl-obsessed purist','front-row regular','hyperpop stan'],
};

const IMAGE_RE = /\b(background|image|photo|picture|graphic|cartoon|illustrat|artwork|texture|scene|wallpaper|mural|monster|anime|manga|drawing|painting|landscape|skyline|city|forest|concert|stage|crowd|godzilla|dinosaur|fire|neon sign|graffiti|abstract)\b/i;

// ── HELPERS ────────────────────────────────────────────────────────────────
function clone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }
function makeContent(r: Role): Content {
  const d = ROLES[r];
  return { name: d.defaultName, tagline: d.tagline, bio: d.bio, hero: clone(d.hero), sections: clone(d.sections), defaultVibe: d.defaultVibe };
}
function esc(s: string): string {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function hx(n: number): string { return Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0'); }
function parseHex(h: string): [number,number,number] { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
function darken(h: string, f: number): string { const [r,g,b]=parseHex(h); return '#'+hx(r*(1-f))+hx(g*(1-f))+hx(b*(1-f)); }
function saturate(h: string): string { const [r,g,b]=parseHex(h); const mx=Math.max(r,g,b); return '#'+[r,g,b].map(v=>hx(v+(v===mx?40:-15))).join(''); }
function makeId(): string { return Math.random().toString(36).slice(2); }
function toSlug(s: string): string { return s.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'') || 'you'; }

// ── FALLBACK DIRECTIONS ────────────────────────────────────────────────────
function fallbackDirections(vibe: string, role: Role): Theme[] {
  const v = vibe.toLowerCase();
  const scored = LOOKS.map(l => ({ l, s: l.kw.reduce((a,k) => a+(v.includes(k)?1:0), 0) + Math.random()*0.4 }));
  scored.sort((a,b) => b.s - a.s);
  const picks: Look[] = [];
  for (const {l} of scored) {
    if (picks.length >= 3) break;
    if (picks.some(p => p.mood===l.mood && p.layout===l.layout)) continue;
    picks.push(l);
  }
  while (picks.length < 3) { const l = scored[picks.length].l; if (!picks.includes(l)) picks.push(l); }
  return picks.slice(0,3).map(l => ({ name:l.name, mood:l.mood, font:l.font, layout:l.layout, palette:{...l.palette}, tagline:ROLES[role].tagline, bio:ROLES[role].bio, radius:14 }));
}

// ── HEURISTIC REFINE ──────────────────────────────────────────────────────
function heuristicRefine(ins: string, theme: Theme, content: Content): Theme {
  const t = clone(theme); const s = ins.toLowerCase(); const P = t.palette;
  if (/dark|moody|night|black/.test(s)) { t.mood='dark'; P.bg=darken(P.bg,.5); P.surface=darken(P.surface,.4); P.ink='#f3eefb'; P.ink2='#b9a9d6'; }
  if (/light|bright|white|clean/.test(s)) { t.mood='light'; P.bg='#f4ece0'; P.surface='#fff'; P.line='#e0d3c0'; P.ink='#1c160f'; P.ink2='#6f5f4a'; }
  if (/bold|loud|pop|vivid/.test(s)) { P.accent=saturate(P.accent); P.accent2=saturate(P.accent2); }
  if (/minimal|quiet|calm/.test(s)) t.layout='zine';
  if (/serif|elegant/.test(s)) t.font='serif';
  if (/mono|tech|digital/.test(s)) t.font='mono';
  if (/poster|big/.test(s)) t.layout='poster';
  if (/gallery|grid/.test(s)) t.layout='gallery';
  if (/spotlight|center/.test(s)) t.layout='spotlight';
  const cm: Record<string,string> = { red:'#ff5029', orange:'#ff7a29', pink:'#ff3e9a', purple:'#b983ff', blue:'#5b8dff', teal:'#22e5d4', green:'#1f8a5b', amber:'#ffb84a' };
  for (const k in cm) if (s.includes(k)) { P.accent=cm[k]; break; }
  t.bio = content.bio;
  return t;
}

// ── SECTION RENDERERS ──────────────────────────────────────────────────────
function pressHTML(data: PressData): string {
  const quotes = data.quotes.filter(q => q.q || q.pub);
  const mentions = (data.mentions || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!quotes.length && !mentions.length) {
    return `<section class="pg-sec"><h2 class="pg-sec-t">Press</h2><p style="font-size:13px;color:var(--p-ink2);padding:10px 0;font-family:var(--p-body)">Add press quotes in <b>📋 Sections</b></p></section>`;
  }
  const qHtml = quotes.map(q => `<div class="pg-pq"><div class="pg-pq-text">"${esc(q.q)}"</div><div class="pg-pq-src">— ${esc(q.pub)}${q.yr ? ' · ' + esc(q.yr) : ''}</div></div>`).join('');
  const mHtml = mentions.length ? `<div class="pg-mentions"><span>As seen in</span>${mentions.map(m => `<b>${esc(m)}</b>`).join('<span style="opacity:.35;padding:0 2px">·</span>')}</div>` : '';
  return `<section class="pg-sec"><h2 class="pg-sec-t">Press</h2>${qHtml}${mHtml}</section>`;
}

function releaseHTML(data: ReleaseData): string {
  const streams = Object.entries(data.streams).filter(([, v]) => v);
  const artHtml = data.artSrc
    ? `<img src="${esc(data.artSrc)}" alt="" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="font-size:32px">💿</span>`;
  return `<section class="pg-sec pg-release-sec"><h2 class="pg-sec-t">Release</h2><div class="pg-rel-inner"><div class="pg-rel-art">${artHtml}</div><div class="pg-rel-info"><span class="pg-chip" style="display:inline-block;margin-bottom:10px">${esc(data.date || 'Out Now')}</span><div class="pg-rel-title">${esc(data.title || 'Untitled Release')}</div><div style="font-size:11px;color:var(--p-ink2);margin:4px 0 12px;font-family:var(--p-label)">${esc(data.type)}</div>${streams.length ? `<div class="pg-streams">${streams.map(([p, u]) => `<a class="pg-stream-btn" href="${esc(u)}" target="_blank">${esc(p)}</a>`).join('')}</div>` : ''}</div></div></section>`;
}

function bookingHTML(data: BookingData): string {
  if (!data.contact && !data.market && !data.genres.length) {
    return `<section class="pg-sec"><h2 class="pg-sec-t">Booking</h2><p style="font-size:13px;color:var(--p-ink2);padding:10px 0;font-family:var(--p-body)">Fill in booking details in <b>📋 Sections</b></p></section>`;
  }
  const tagsHtml = data.genres.length ? `<div class="pg-gtags">${data.genres.map(g => `<span class="pg-gtag">${esc(g)}</span>`).join('')}</div>` : '';
  return `<section class="pg-sec"><h2 class="pg-sec-t">Booking</h2><div class="pg-card" style="flex-direction:column;align-items:flex-start;gap:10px">${tagsHtml}${data.market ? `<div style="font-size:13px;color:var(--p-ink)">📍 ${esc(data.market)}</div>` : ''}${data.cap ? `<div style="font-size:13px;color:var(--p-ink)">🎪 ${esc(data.cap)}</div>` : ''}${data.note ? `<div style="font-size:12px;color:var(--p-ink2);line-height:1.5">${esc(data.note)}</div>` : ''}${data.contact ? `<a href="mailto:${esc(data.contact)}" class="pg-cta" style="text-decoration:none;display:inline-block;margin-top:4px">✉ Book me</a>` : ''}</div></section>`;
}

function newsletterHTML(data: NewsletterData): string {
  return `<section class="pg-sec"><h2 class="pg-sec-t">Stay Connected</h2><div class="pg-news"><p>${esc(data.headline)}</p><div class="pg-news-form"><input placeholder="your@email.com" style="flex:1;background:var(--p-surface);border:1px solid var(--p-line);border-radius:14px;padding:10px 14px;font-size:13px;color:var(--p-ink);font-family:var(--p-body)"><button class="pg-cta">${esc(data.cta)}</button></div></div></section>`;
}

// ── PREVIEW HTML ───────────────────────────────────────────────────────────
function sectionHTML(s: Section): string {
  if (s.kind === 'tracks') {
    return `<section class="pg-sec"><h2 class="pg-sec-t">${esc(s.title)}</h2><div class="pg-rows">${s.items.map((it,i)=>`<div class="pg-row"><span class="pg-rn">${String(i+1).padStart(2,'0')}</span><span class="pg-pl">▶</span><span class="pg-rm"><b>${esc(it.t)}</b><small>${esc(it.m)}</small></span><button class="pg-hype">♥ HYPE</button></div>`).join('')}</div></section>`;
  }
  if (s.kind === 'shows') {
    return `<section class="pg-sec"><h2 class="pg-sec-t">${esc(s.title)}</h2><div class="pg-cards">${s.items.map(it=>`<div class="pg-card"><div class="pg-card-b"><b>${esc(it.t)}</b><small>${esc(it.m)}</small></div><span class="pg-chip">tickets</span></div>`).join('')}</div></section>`;
  }
  return `<section class="pg-sec"><h2 class="pg-sec-t">${esc(s.title)}</h2><div class="pg-cards">${s.items.map(it=>`<div class="pg-card plain"><div class="pg-card-b"><b>${esc(it.t)}</b><small>${esc(it.m)}</small></div></div>`).join('')}</div></section>`;
}

interface PreviewExtras {
  heroBgCss?: string;
  heroPhotoUrl?: string;
  avatarUrl?: string;
  tracks?: TrackItem[];
  links?: Record<string, string>;
  sections?: SectionDef[];
  press?: PressData;
  release?: ReleaseData;
  booking?: BookingData;
  newsletter?: NewsletterData;
}

function renderPreviewHTML(content: Content, theme: Theme, extras: PreviewExtras = {}): string {
  const c = content; const h = c.hero;
  const ini = c.name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const heroUrl = extras.heroPhotoUrl || '';
  const heroPart = heroUrl
    ? `<img src="${heroUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="">`
    : extras.heroBgCss
      ? `<div style="width:100%;height:100%;${extras.heroBgCss}"></div>`
      : `<div style="width:100%;height:100%;background:${theme.palette.surface}"></div>`;
  const avPart = extras.avatarUrl
    ? `<img src="${extras.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="">`
    : `<div class="pg-av-fb">${esc(ini)}</div>`;

  const activeSecs = extras.sections ? extras.sections.filter(s => s.on) : null;

  function buildSections(): string {
    if (!activeSecs) {
      return `<section class="pg-sec"><h2 class="pg-sec-t">About</h2><p class="pg-bio" contenteditable="true" spellcheck="false" data-edit="bio">${esc(c.bio)}</p></section>${c.sections.map(sectionHTML).join('')}`;
    }
    return activeSecs.map(sec => {
      if (sec.id === 'bio') return `<section class="pg-sec"><h2 class="pg-sec-t">About</h2><p class="pg-bio" contenteditable="true" spellcheck="false" data-edit="bio">${esc(c.bio)}</p></section>`;
      if (sec.id === 'music') {
        const ts = c.sections.find(s => s.kind === 'tracks');
        return ts ? sectionHTML(ts) : '';
      }
      if (sec.id === 'shows') {
        const ss = c.sections.find(s => s.kind === 'shows');
        return ss ? sectionHTML(ss) : '';
      }
      if (sec.id === 'press' && extras.press) return pressHTML(extras.press);
      if (sec.id === 'release' && extras.release) return releaseHTML(extras.release);
      if (sec.id === 'booking' && extras.booking) return bookingHTML(extras.booking);
      if (sec.id === 'newsletter' && extras.newsletter) return newsletterHTML(extras.newsletter);
      return '';
    }).join('');
  }

  const uploadedTracks = extras.tracks && extras.tracks.length
    ? `<section class="pg-sec"><h2 class="pg-sec-t">My Music</h2><div class="pg-rows">${extras.tracks.map((t, i) => `<div class="pg-row"><span class="pg-rn">${String(i+1).padStart(2,'0')}</span><span class="pg-pl">▶</span><span class="pg-rm"><b>${esc(t.name)}</b><small>${t.dur}</small></span><button class="pg-hype">♥ HYPE</button></div>`).join('')}</div></section>`
    : '';

  const lkEntries = extras.links ? Object.entries(extras.links).filter(([, v]) => v) : [];
  const linksSection = lkEntries.length
    ? `<section class="pg-sec"><h2 class="pg-sec-t">Find Me</h2><div class="pg-cards">${lkEntries.map(([p, u]) => `<div class="pg-card plain"><div class="pg-card-b"><b>${esc(p)}</b><small>${esc(u)}</small></div></div>`).join('')}</div></section>`
    : '';

  return `
    <div class="pg-hero" style="min-height:${theme.layout==='poster'?'360px':'270px'}">
      <div class="pg-hbg">${heroPart}</div>
      <div class="pg-scrim"></div>
      <div class="pg-in">
        <div class="pg-av-wrap">${avPart}</div>
        <div class="pg-kicker">${esc(h.kicker)}</div>
        <h1 class="pg-name" contenteditable="true" spellcheck="false" data-edit="name">${esc(c.name)}</h1>
        <p class="pg-tag" contenteditable="true" spellcheck="false" data-edit="tagline">${esc(c.tagline)}</p>
        <div class="pg-hero-row">
          <button class="pg-cta">${esc(h.cta)}</button>
          <div class="pg-stat"><b>${esc(h.stat)}</b><span>${esc(h.statLabel)}</span></div>
        </div>
      </div>
    </div>
    <div class="pg-body">
      ${buildSections()}
      ${uploadedTracks}
      ${linksSection}
      <div class="pg-foot">Made with <b>iHYPE</b> · ihype.fm/${toSlug(c.name)}</div>
    </div>`;
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const STYLES = `
/* ── APP GRID ── */
.ps2-app { display:grid; grid-template-columns:370px 1fr; height:100%; overflow:hidden; background:#0a0805; color:#f0ebe5; font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }
.ps2-app *,.ps2-app *::before,.ps2-app *::after { box-sizing:border-box; margin:0; padding:0; }
.ps2-app button { font:inherit; color:inherit; background:none; border:none; cursor:pointer; }
.ps2-app input,.ps2-app textarea { font:inherit; color:inherit; }
.ps2-app ::-webkit-scrollbar { width:5px; }
.ps2-app ::-webkit-scrollbar-thumb { background:#3a342e; border-radius:5px; }

/* ── CHAT PANEL ── */
.ps2-chat { background:#100d09; border-right:1px solid rgba(255,255,255,.07); display:flex; flex-direction:column; overflow:hidden; }

.ps2-chat-hd { display:flex; align-items:center; gap:11px; padding:13px 16px 12px; border-bottom:1px solid rgba(255,255,255,.07); flex-shrink:0; }
.ps2-chat-icon { width:30px; height:30px; border-radius:10px; background:linear-gradient(135deg,#ff5029,#ff3e9a); display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; box-shadow:0 4px 16px -4px rgba(255,80,41,.5); }
.ps2-chat-title { font-family:'Syne',sans-serif; font-size:14px; font-weight:700; letter-spacing:-.01em; }
.ps2-chat-sub { margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.12em; }
.ps2-new-btn { padding:5px 10px; border-radius:7px; border:1px solid rgba(255,255,255,.07); background:#1a1612; font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600; letter-spacing:.06em; color:#5a5048; }
.ps2-new-btn:hover { color:#f0ebe5; border-color:rgba(255,255,255,.15); }

/* ── MESSAGES ── */
.ps2-msgs { flex:1; overflow-y:auto; padding:14px 14px 8px; display:flex; flex-direction:column; gap:12px; scroll-behavior:smooth; }
.ps2-msg { display:flex; gap:8px; }
.ps2-msg.ai { align-items:flex-start; }
.ps2-msg.user { flex-direction:row-reverse; }
.ps2-av { width:24px; height:24px; border-radius:8px; background:linear-gradient(135deg,#ff5029,#ff3e9a); display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; margin-top:2px; }
.ps2-bub { padding:10px 13px; border-radius:14px; font-size:13px; line-height:1.55; word-break:break-word; }
.ps2-msg.ai .ps2-bub { background:#3a342e; border:1px solid rgba(255,255,255,.15); border-left:2px solid #ff5029; color:#f0ebe5; border-top-left-radius:4px; max-width:300px; }
.ps2-msg.user .ps2-bub { background:#ff5029; color:#0a0805; font-weight:500; border-top-right-radius:4px; max-width:260px; }

/* ── CHIPS ── */
.ps2-chips-wrap { display:flex; gap:8px; align-items:flex-start; }
.ps2-chips-wrap .ps2-av { opacity:0; pointer-events:none; }
.ps2-chips-row { display:flex; flex-wrap:wrap; gap:6px; max-width:310px; }
.ps2-chip { padding:7px 13px; border-radius:99px; border:1px solid rgba(255,255,255,.15); background:#1a1612; font-family:'JetBrains Mono',monospace; font-size:10.5px; font-weight:600; letter-spacing:.03em; color:#9e9080; transition:all .13s; }
.ps2-chip:hover:not(:disabled) { color:#f0ebe5; border-color:#ff5029; }
.ps2-chip.picked { background:#ff5029; color:#0a0805; border-color:#ff5029; pointer-events:none; }
.ps2-chip:disabled:not(.picked) { opacity:.35; cursor:default; }

/* ── DIRECTION CARDS ── */
.ps2-dirs-wrap { display:flex; gap:8px; align-items:flex-start; }
.ps2-dirs-wrap .ps2-av { opacity:0; pointer-events:none; }
.ps2-dirs-row { display:flex; gap:7px; max-width:316px; }
.ps2-dcard { flex:1; border-radius:11px; border:1px solid rgba(255,255,255,.07); background:#1a1612; overflow:hidden; cursor:pointer; transition:border-color .14s,transform .14s; }
.ps2-dcard:hover { border-color:rgba(255,255,255,.15); transform:translateY(-2px); }
.ps2-dcard.on { border-color:#ff5029; box-shadow:0 0 0 1px #ff5029; }
.ps2-dp { height:42px; position:relative; overflow:hidden; }
.ps2-dp-bar { position:absolute; left:7px; top:7px; width:22px; height:5px; border-radius:99px; }
.ps2-dp-dot { position:absolute; right:6px; top:6px; width:7px; height:7px; border-radius:99px; }
.ps2-dp-lines { position:absolute; bottom:7px; left:7px; right:7px; display:flex; flex-direction:column; gap:3px; }
.ps2-dp-lines i { height:2px; border-radius:99px; display:block; }
.ps2-dp-lines i:last-child { width:60%; opacity:.5; }
.ps2-dm { padding:6px 8px 8px; }
.ps2-dm b { font-family:'Syne',sans-serif; font-size:11px; font-weight:700; color:#f0ebe5; display:block; }
.ps2-dm span { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.04em; }

/* ── TYPING ── */
.ps2-typing-wrap { display:flex; gap:8px; align-items:flex-start; }
.ps2-dots { display:flex; gap:4px; align-items:center; padding:11px 14px; background:#1a1612; border:1px solid rgba(255,255,255,.07); border-radius:14px; border-top-left-radius:4px; }
.ps2-dots span { width:6px; height:6px; border-radius:99px; background:#5a5048; animation:ps2-db .9s infinite; }
.ps2-dots span:nth-child(2) { animation-delay:.15s; }
.ps2-dots span:nth-child(3) { animation-delay:.3s; }
@keyframes ps2-db { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

/* ── CHAT FOOTER ── */
.ps2-chat-ft { border-top:1px solid rgba(255,255,255,.07); flex-shrink:0; }
.ps2-in-row { display:flex; gap:7px; align-items:center; padding:11px 12px 8px; }
.ps2-in { flex:1; background:#1a1612; border:1px solid rgba(255,255,255,.15); border-radius:10px; padding:10px 12px; font-size:13px; resize:none; outline:none; }
.ps2-in::placeholder { color:#5a5048; }
.ps2-in:focus { border-color:#ff5029; }
.ps2-in:disabled { opacity:.38; }
.ps2-send-btn { width:36px; height:36px; border-radius:9px; background:#ff5029; color:#0a0805; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:filter .12s; }
.ps2-send-btn:hover:not(:disabled) { filter:brightness(1.1); }
.ps2-send-btn:disabled { opacity:.35; }

/* ── ASSET STRIP ── */
.ps2-ast-strip { display:flex; gap:5px; padding:0 12px 11px; flex-wrap:wrap; }
.ps2-ab { display:flex; align-items:center; gap:5px; padding:5px 9px; border-radius:7px; border:1px solid rgba(255,255,255,.07); background:#1a1612; font-family:'JetBrains Mono',monospace; font-size:9.5px; font-weight:600; letter-spacing:.04em; color:#5a5048; transition:all .13s; }
.ps2-ab:hover { color:#f0ebe5; border-color:rgba(255,255,255,.15); }
.ps2-ab.on { color:#ff5029; border-color:rgba(255,80,41,.4); background:rgba(255,80,41,.07); }
.ps2-ab-prime { color:#f0ebe5; border-color:rgba(255,255,255,.15); }

/* ── STAGE ── */
.ps2-stage { position:relative; overflow:hidden; background:radial-gradient(ellipse 70% 50% at 50% 0%,rgba(255,80,41,.06),transparent 60%),repeating-linear-gradient(45deg,transparent 0 11px,rgba(255,255,255,.012) 11px 12px),#0c0a08; display:flex; align-items:center; justify-content:center; padding:38px 34px 34px; }
.ps2-stbar { position:absolute; top:0; left:0; right:0; height:42px; display:flex; align-items:center; gap:10px; padding:0 18px; z-index:6; }
.ps2-url-pill { display:flex; align-items:center; gap:7px; background:rgba(16,13,9,.75); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,.07); border-radius:99px; padding:6px 13px; font-family:'JetBrains Mono',monospace; font-size:11px; color:#9e9080; }
.ps2-url-pill b { color:#f0ebe5; font-weight:600; }
.ps2-stage-r { margin-left:auto; display:flex; align-items:center; gap:8px; }
.ps2-dev-seg { display:flex; background:#1a1612; border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:3px; gap:2px; }
.ps2-dev-seg button { padding:5px 10px; border-radius:6px; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; letter-spacing:.06em; color:#5a5048; display:flex; align-items:center; gap:5px; transition:all .12s; }
.ps2-dev-seg button.on { background:#0a0805; color:#f0ebe5; }
.ps2-theme-tag { font-family:'JetBrains Mono',monospace; font-size:10px; color:#5a5048; letter-spacing:.08em; }
.ps2-theme-tag b { color:#f0ebe5; }
.ps2-epk-btn { padding:7px 13px; border-radius:7px; background:#1a1612; border:1px solid rgba(255,255,255,.15); font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; letter-spacing:.04em; display:inline-flex; align-items:center; gap:6px; color:#f0ebe5; }
.ps2-epk-btn:hover { border-color:#ff5029; color:#ff5029; }
.ps2-pub-btn { padding:7px 15px; border-radius:7px; background:#ff5029; color:#0a0805; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; letter-spacing:.05em; display:inline-flex; align-items:center; gap:6px; }
.ps2-pub-btn:hover { filter:brightness(1.08); }

/* ── VIEWPORT ── */
.ps2-vp { position:relative; border-radius:16px; overflow:hidden; background:#111; box-shadow:0 40px 90px -30px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05); transition:box-shadow .3s; }
.ps2-stage[data-d="desktop"] .ps2-vp { width:min(870px,100%); height:min(78vh,740px); }
.ps2-stage[data-d="mobile"]  .ps2-vp { width:375px; height:min(78vh,760px); border-radius:34px; border:9px solid #1a1612; }
.ps2-stage.gen .ps2-vp { animation:ps2-pg 1.1s ease-in-out infinite; }
@keyframes ps2-pg { 0%,100%{box-shadow:0 40px 90px -30px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05)} 50%{box-shadow:0 40px 90px -30px rgba(0,0,0,.7),0 0 0 2px #b983ff} }

#ps2-pr { position:absolute; inset:0; overflow:hidden; }
#ps2-ps { height:100%; overflow-y:auto; }

/* ── EMPTY STATE ── */
.ps2-empty { position:absolute; inset:0; background:#100d09; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px; }
.ps2-spark { width:58px; height:58px; border-radius:18px; background:linear-gradient(135deg,#ff5029,#ff3e9a); display:flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:18px; box-shadow:0 12px 40px -8px rgba(255,80,41,.45); }
.ps2-empty h3 { font-family:'Syne',sans-serif; font-weight:800; font-size:22px; letter-spacing:-.02em; margin-bottom:8px; }
.ps2-empty p { font-size:13px; color:#9e9080; line-height:1.6; max-width:320px; }
.ps2-hint { margin-top:18px; font-family:'JetBrains Mono',monospace; font-size:9.5px; color:#5a5048; letter-spacing:.1em; display:flex; align-items:center; gap:8px; }
.ps2-hint::before,.ps2-hint::after { content:''; height:1px; width:24px; background:rgba(255,255,255,.15); }

/* ── TOAST ── */
.ps2-toast { position:absolute; bottom:22px; left:50%; transform:translateX(-50%) translateY(10px); z-index:8; background:#1a1612; border:1px solid #b983ff; color:#f0ebe5; padding:9px 18px; border-radius:99px; font-family:'JetBrains Mono',monospace; font-size:11px; opacity:0; transition:opacity .22s,transform .22s; pointer-events:none; white-space:nowrap; max-width:90%; }
.ps2-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }

/* ── PAGE PREVIEW ── */
#ps2-pr .pg-hero { position:relative; }
#ps2-pr .pg-hbg { position:absolute; inset:0; background-size:cover; background-position:center; }
#ps2-pr .pg-scrim { position:absolute; inset:0; background:linear-gradient(180deg,color-mix(in srgb,var(--p-bg) 18%,transparent),var(--p-bg) 90%); }
#ps2-pr .pg-in { position:relative; padding:54px 42px 40px; display:flex; flex-direction:column; align-items:flex-start; gap:14px; }
#ps2-pr[data-layout="spotlight"] .pg-in { align-items:center; text-align:center; padding-top:66px; }
#ps2-pr[data-layout="poster"] .pg-in { padding-top:82px; padding-bottom:52px; }
#ps2-pr .pg-av-wrap { position:relative; width:88px; height:88px; }
#ps2-pr .pg-av-fb { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:var(--p-display,'Syne'),sans-serif; font-weight:800; font-size:28px; color:var(--p-bg); background:linear-gradient(135deg,var(--p-accent),var(--p-accent2)); border-radius:50%; }
#ps2-pr .pg-kicker { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:11px; font-weight:600; letter-spacing:.2em; color:var(--p-accent); text-transform:uppercase; }
#ps2-pr .pg-name { font-family:var(--p-display,'Syne'),sans-serif; font-weight:var(--p-dweight,800); font-size:58px; line-height:1.02; letter-spacing:var(--p-tight,-.03em); color:var(--p-ink); outline:none; width:100%; }
#ps2-pr[data-layout="poster"] .pg-name { font-size:80px; }
#ps2-pr[data-layout="zine"] .pg-name { font-size:50px; }
#ps2-pr .pg-tag { font-family:var(--p-serif,'Instrument Serif'),serif; font-size:20px; line-height:1.35; color:var(--p-ink2); font-style:italic; max-width:520px; outline:none; }
#ps2-pr .pg-hero-row { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
#ps2-pr[data-layout="spotlight"] .pg-hero-row { justify-content:center; }
#ps2-pr .pg-cta { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:12px; font-weight:700; letter-spacing:.04em; color:var(--p-bg); background:var(--p-accent); padding:12px 22px; border-radius:14px; border:none; cursor:pointer; }
#ps2-pr .pg-stat { display:flex; flex-direction:column; }
#ps2-pr .pg-stat b { font-family:var(--p-display,'Syne'),sans-serif; font-weight:800; font-size:24px; letter-spacing:-.02em; color:var(--p-ink); line-height:1; }
#ps2-pr .pg-stat span { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9px; letter-spacing:.14em; color:var(--p-ink2); text-transform:uppercase; margin-top:4px; }
#ps2-pr .pg-body { padding:8px 42px 44px; display:flex; flex-direction:column; gap:28px; }
#ps2-pr .pg-sec-t { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:10px; font-weight:700; letter-spacing:.18em; color:var(--p-ink2); text-transform:uppercase; margin-bottom:14px; padding-bottom:9px; border-bottom:1px solid var(--p-line); }
#ps2-pr .pg-bio { font-family:var(--p-body,'DM Sans'),sans-serif; font-size:15px; line-height:1.65; color:var(--p-ink); max-width:580px; outline:none; }
#ps2-pr .pg-rows { display:flex; flex-direction:column; gap:2px; }
#ps2-pr .pg-row { display:flex; align-items:center; gap:13px; padding:11px 12px; border-radius:14px; transition:background .14s; }
#ps2-pr .pg-row:hover { background:var(--p-surface); }
#ps2-pr .pg-rn { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:11px; color:var(--p-ink2); width:18px; }
#ps2-pr .pg-pl { color:var(--p-accent); font-size:10px; }
#ps2-pr .pg-rm { flex:1; display:flex; flex-direction:column; gap:3px; }
#ps2-pr .pg-rm b { font-family:var(--p-display,'Syne'),sans-serif; font-weight:600; font-size:15px; color:var(--p-ink); letter-spacing:-.01em; }
#ps2-pr .pg-rm small { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9.5px; color:var(--p-ink2); letter-spacing:.04em; }
#ps2-pr .pg-hype { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9px; font-weight:700; letter-spacing:.06em; color:var(--p-accent2); border:1px solid color-mix(in srgb,var(--p-accent2) 40%,transparent); padding:5px 10px; border-radius:99px; background:none; cursor:pointer; }
#ps2-pr .pg-cards { display:grid; grid-template-columns:repeat(2,1fr); gap:9px; }
#ps2-pr[data-layout="gallery"] .pg-cards { grid-template-columns:repeat(3,1fr); }
#ps2-pr .pg-card { background:var(--p-surface); border:1px solid var(--p-line); border-radius:14px; padding:14px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
#ps2-pr .pg-card.plain { background:transparent; }
#ps2-pr .pg-card-b b { font-family:var(--p-display,'Syne'),sans-serif; font-weight:700; font-size:14px; color:var(--p-ink); letter-spacing:-.01em; display:block; }
#ps2-pr .pg-card-b small { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9px; color:var(--p-ink2); letter-spacing:.03em; margin-top:4px; display:block; }
#ps2-pr .pg-chip { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:8px; font-weight:700; letter-spacing:.1em; color:var(--p-bg); background:var(--p-accent); padding:5px 9px; border-radius:99px; text-transform:uppercase; flex-shrink:0; }
#ps2-pr .pg-foot { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9px; color:var(--p-ink2); letter-spacing:.08em; padding-top:16px; border-top:1px solid var(--p-line); text-align:center; }
#ps2-pr .pg-foot b { color:var(--p-accent); }
.ps2-stage[data-d="mobile"] #ps2-pr .pg-in { padding:46px 20px 28px; }
.ps2-stage[data-d="mobile"] #ps2-pr .pg-name { font-size:38px !important; }
.ps2-stage[data-d="mobile"] #ps2-pr .pg-tag { font-size:16px; }
.ps2-stage[data-d="mobile"] #ps2-pr .pg-body { padding:8px 20px 32px; }
.ps2-stage[data-d="mobile"] #ps2-pr .pg-cards { grid-template-columns:1fr !important; }

/* ── AP-OPEN GRID ── */
.ps2-app.ap-open { grid-template-columns:370px 1fr 300px; }

/* ── ASSET PANEL ── */
.ps2-ap { background:#100d09; border-left:1px solid rgba(255,255,255,.07); display:flex; flex-direction:column; overflow:hidden; }
.ps2-ap-hd { display:flex; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,.07); gap:3px; flex-shrink:0; }
.ps2-ap-tab { width:30px; height:28px; border-radius:7px; font-size:14px; color:#5a5048; transition:all .13s; display:flex; align-items:center; justify-content:center; }
.ps2-ap-tab:hover { background:#1a1612; }
.ps2-ap-tab.on { background:#1a1612; border:1px solid rgba(255,255,255,.15); }
.ps2-ap-x { margin-left:auto; width:26px; height:26px; border-radius:7px; background:#1a1612; border:1px solid rgba(255,255,255,.07); color:#5a5048; display:flex; align-items:center; justify-content:center; font-size:16px; line-height:1; }
.ps2-ap-x:hover { color:#f0ebe5; }
.ps2-ap-body { flex:1; overflow-y:auto; padding:12px; }
.ps2-ap-body::-webkit-scrollbar { width:5px; }
.ps2-ap-body::-webkit-scrollbar-thumb { background:#3a342e; border-radius:5px; }
.ps2-ap-label { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.14em; font-weight:700; margin-bottom:10px; margin-top:4px; }
.ps2-ap-hint { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.04em; margin-bottom:12px; line-height:1.5; }

/* ── LIBRARY ── */
.ps2-lib-bar { display:flex; gap:6px; margin-bottom:8px; }
.ps2-lib-bar input { flex:1; background:#1a1612; border:1px solid rgba(255,255,255,.15); border-radius:9px; padding:9px 11px; font-size:12px; color:#f0ebe5; outline:none; font-family:'JetBrains Mono',monospace; }
.ps2-lib-bar input::placeholder { color:#5a5048; }
.ps2-lib-bar input:focus { border-color:#ff5029; }
.ps2-lib-cc { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.04em; margin-bottom:10px; display:flex; align-items:center; gap:5px; line-height:1.4; }
.ps2-lib-cc::before { content:''; width:6px; height:6px; border-radius:99px; background:#22e5d4; flex-shrink:0; }
.ps2-lib-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.ps2-li { border-radius:8px; overflow:hidden; cursor:pointer; border:2px solid transparent; transition:border-color .14s; position:relative; }
.ps2-li:hover { border-color:rgba(255,255,255,.15); }
.ps2-li.on { border-color:#ff5029; }
.ps2-li-img { width:100%; aspect-ratio:4/3; display:block; }
.ps2-li-cap { position:absolute; bottom:0; left:0; right:0; padding:5px 7px 6px; background:linear-gradient(transparent,rgba(0,0,0,.88)); font-family:'JetBrains Mono',monospace; font-size:8.5px; letter-spacing:.04em; color:rgba(255,255,255,.82); pointer-events:none; }

/* ── UPLOAD ZONE ── */
.ps2-upz { border:2px dashed rgba(255,255,255,.12); border-radius:11px; padding:20px 14px; text-align:center; cursor:pointer; transition:border-color .14s,background .14s; position:relative; margin-bottom:12px; }
.ps2-upz:hover,.ps2-upz.over { border-color:#ff5029; background:rgba(255,80,41,.04); }
.ps2-upz input[type="file"] { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
.ps2-upz-ico { font-size:24px; margin-bottom:6px; }
.ps2-upz h4 { font-family:'Syne',sans-serif; font-size:12px; font-weight:700; color:#f0ebe5; margin-bottom:3px; }
.ps2-upz p { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.06em; }

/* ── AVATAR ZONE ── */
.ps2-avz { display:flex; align-items:center; gap:11px; padding:10px 12px; background:#1a1612; border:1px solid rgba(255,255,255,.07); border-radius:10px; cursor:pointer; margin-bottom:14px; position:relative; overflow:hidden; }
.ps2-avz input[type="file"] { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
.ps2-avz-prev { width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.07); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; overflow:hidden; }
.ps2-avz-prev img { width:100%; height:100%; object-fit:cover; }
.ps2-avz-text h4 { font-family:'Syne',sans-serif; font-size:12px; font-weight:700; color:#f0ebe5; margin-bottom:2px; }
.ps2-avz-text p { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.04em; }

/* ── PHOTO GRID ── */
.ps2-ph-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:10px; }
.ps2-ph-th { border-radius:8px; overflow:hidden; cursor:pointer; position:relative; border:2px solid transparent; transition:border-color .14s; aspect-ratio:4/3; }
.ps2-ph-th:hover { border-color:rgba(255,255,255,.2); }
.ps2-ph-th.hero { border-color:#ff5029; }
.ps2-ph-th img { width:100%; height:100%; object-fit:cover; display:block; }
.ps2-ph-badge { position:absolute; top:4px; right:4px; font-family:'JetBrains Mono',monospace; font-size:8px; font-weight:700; letter-spacing:.06em; background:rgba(0,0,0,.7); color:#f0ebe5; padding:3px 7px; border-radius:99px; }
.ps2-ph-th.hero .ps2-ph-badge { background:#ff5029; color:#0a0805; }
.ps2-ph-hint { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.04em; margin-top:8px; text-align:center; }

/* ── TRACK LIST ── */
.ps2-tr-list { display:flex; flex-direction:column; gap:4px; margin-top:4px; }
.ps2-tr { display:flex; align-items:center; gap:9px; padding:9px 10px; background:#1a1612; border:1px solid rgba(255,255,255,.07); border-radius:9px; }
.ps2-tr-play { color:#ff5029; font-size:10px; flex-shrink:0; }
.ps2-tr-inf { flex:1; display:flex; flex-direction:column; gap:2px; overflow:hidden; }
.ps2-tr-inf b { font-size:12px; font-weight:600; color:#f0ebe5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ps2-tr-inf small { font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5048; letter-spacing:.04em; }
.ps2-tr-del { width:22px; height:22px; border-radius:5px; background:rgba(255,255,255,.07); color:#5a5048; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; }
.ps2-tr-del:hover { background:rgba(255,80,41,.2); color:#ff5029; }

/* ── LINK ROWS ── */
.ps2-lk-row { display:flex; align-items:center; gap:7px; margin-bottom:7px; }
.ps2-lk-ic { width:26px; height:26px; border-radius:7px; background:#1a1612; border:1px solid rgba(255,255,255,.07); display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
.ps2-lk-in { flex:1; background:#1a1612; border:1px solid rgba(255,255,255,.15); border-radius:8px; padding:7px 10px; font-size:11px; color:#f0ebe5; outline:none; font-family:'JetBrains Mono',monospace; }
.ps2-lk-in::placeholder { color:#5a5048; }
.ps2-lk-in:focus { border-color:#ff5029; }
.ps2-lk-add { width:26px; height:26px; border-radius:7px; background:#ff5029; color:#0a0805; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; flex-shrink:0; }
.ps2-lk-add:hover { filter:brightness(1.1); }

/* ── SECTION COMPOSER ── */
.ps2-sec-list { display:flex; flex-direction:column; gap:4px; }
.ps2-sec-row { display:flex; align-items:center; gap:8px; padding:9px 10px; background:#1a1612; border:1px solid rgba(255,255,255,.07); border-radius:9px; }
.ps2-sec-lft { flex:1; display:flex; align-items:center; gap:7px; min-width:0; }
.ps2-sec-handle { color:#3a342e; font-size:14px; cursor:grab; flex-shrink:0; }
.ps2-sec-ico { font-size:13px; flex-shrink:0; }
.ps2-sec-lbl { font-size:11.5px; font-weight:500; color:#f0ebe5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ps2-sec-rgt { display:flex; align-items:center; gap:5px; flex-shrink:0; }
.ps2-sec-edit { font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600; color:#ff5029; letter-spacing:.04em; padding:4px 8px; border-radius:6px; border:1px solid rgba(255,80,41,.3); background:rgba(255,80,41,.07); }
.ps2-sec-edit:hover { background:rgba(255,80,41,.14); }
.ps2-sec-ord { display:flex; flex-direction:column; gap:1px; }
.ps2-sec-arr { width:18px; height:15px; border-radius:4px; background:rgba(255,255,255,.05); color:#5a5048; font-size:9px; display:flex; align-items:center; justify-content:center; }
.ps2-sec-arr:hover { color:#f0ebe5; background:rgba(255,255,255,.1); }
.ps2-sec-toggle { font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700; letter-spacing:.06em; padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,.1); color:#5a5048; background:rgba(255,255,255,.04); min-width:36px; text-align:center; }
.ps2-sec-toggle:hover { border-color:rgba(255,255,255,.2); color:#f0ebe5; }
.ps2-sec-toggle.on { background:rgba(255,80,41,.12); border-color:rgba(255,80,41,.4); color:#ff5029; }

/* ── SECTION FORM ── */
.ps2-sec-back-btn { display:flex; align-items:center; gap:5px; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; letter-spacing:.04em; color:#9e9080; padding:6px 0; margin-bottom:10px; }
.ps2-sec-back-btn:hover { color:#f0ebe5; }
.ps2-press-card { background:#1a1612; border:1px solid rgba(255,255,255,.07); border-radius:9px; padding:10px; margin-bottom:8px; }
.ps2-press-ta { width:100%; background:transparent; border:none; outline:none; font-size:12px; color:#f0ebe5; line-height:1.55; resize:none; font-family:'DM Sans',sans-serif; }
.ps2-press-ta::placeholder { color:#5a5048; }
.ps2-press-row2 { display:flex; gap:6px; margin-top:6px; border-top:1px solid rgba(255,255,255,.07); padding-top:6px; }
.ps2-press-in { flex:1; background:rgba(255,255,255,.05); border:none; outline:none; border-radius:6px; padding:5px 8px; font-size:11px; color:#f0ebe5; font-family:'JetBrains Mono',monospace; }
.ps2-press-in::placeholder { color:#5a5048; }
.ps2-add-quote-btn { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; letter-spacing:.04em; color:#ff5029; padding:8px 0; display:flex; align-items:center; gap:5px; }
.ps2-genre-tags { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
.ps2-gtag-btn { font-family:'JetBrains Mono',monospace; font-size:9.5px; font-weight:600; letter-spacing:.04em; padding:5px 10px; border-radius:99px; border:1px solid rgba(255,255,255,.12); color:#9e9080; }
.ps2-gtag-btn:hover { border-color:rgba(255,255,255,.25); color:#f0ebe5; }
.ps2-gtag-btn.on { background:rgba(255,80,41,.12); border-color:rgba(255,80,41,.5); color:#ff5029; }

/* ── PAGE SECTIONS (press/release/booking/newsletter) ── */
#ps2-pr .pg-pq { padding:14px 0; border-bottom:1px solid var(--p-line); }
#ps2-pr .pg-pq:last-of-type { border-bottom:none; }
#ps2-pr .pg-pq-text { font-family:var(--p-serif,'Instrument Serif'),serif; font-style:italic; font-size:17px; color:var(--p-ink); line-height:1.5; margin-bottom:6px; }
#ps2-pr .pg-pq-src { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:10px; color:var(--p-ink2); letter-spacing:.08em; }
#ps2-pr .pg-mentions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:14px; font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:10px; color:var(--p-ink2); letter-spacing:.08em; }
#ps2-pr .pg-mentions b { color:var(--p-ink); }
#ps2-pr .pg-rel-inner { display:flex; gap:16px; align-items:flex-start; }
#ps2-pr .pg-rel-art { width:80px; height:80px; border-radius:10px; background:var(--p-surface); border:1px solid var(--p-line); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; font-size:28px; }
#ps2-pr .pg-rel-art img { width:100%; height:100%; object-fit:cover; }
#ps2-pr .pg-rel-title { font-family:var(--p-display,'Syne'),sans-serif; font-weight:700; font-size:17px; color:var(--p-ink); letter-spacing:-.01em; line-height:1.2; }
#ps2-pr .pg-streams { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
#ps2-pr .pg-stream-btn { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9px; font-weight:700; letter-spacing:.06em; color:var(--p-bg); background:var(--p-accent); padding:5px 10px; border-radius:99px; text-decoration:none; display:inline-block; }
#ps2-pr .pg-gtags { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
#ps2-pr .pg-gtag { font-family:var(--p-label,'JetBrains Mono'),monospace; font-size:9px; font-weight:600; letter-spacing:.06em; color:var(--p-accent); border:1px solid color-mix(in srgb,var(--p-accent) 40%,transparent); padding:4px 9px; border-radius:99px; }
#ps2-pr .pg-news { background:var(--p-surface); border:1px solid var(--p-line); border-radius:14px; padding:20px; }
#ps2-pr .pg-news p { font-family:var(--p-serif,'Instrument Serif'),serif; font-style:italic; font-size:17px; color:var(--p-ink); line-height:1.4; margin-bottom:14px; }
#ps2-pr .pg-news-form { display:flex; gap:8px; }
#ps2-pr .pg-news-form input { flex:1; background:var(--p-bg); border:1px solid var(--p-line); border-radius:8px; padding:10px 14px; font-size:13px; color:var(--p-ink); font-family:var(--p-body,'DM Sans'),sans-serif; }
`;

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&display=swap';

// ── COMPONENT ──────────────────────────────────────────────────────────────
export default function ViewPageStudio({ data }: { data?: WorkbenchData } = {}) {
  const initRole: Role = data?.activeProfileTypes?.includes('ARTIST') ? 'artist'
    : data?.activeProfileTypes?.includes('VENUE') ? 'venue' : 'fan';

  const [role, setRole] = useState<Role>(initRole);
  const [device, setDevice] = useState<Device>('desktop');
  const [theme, setTheme] = useState<Theme | null>(null);
  const [directions, setDirections] = useState<Theme[]>([]);
  const [generating, setGenerating] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [inputEnabled, setInputEnabled] = useState(false);
  const [inputPlaceholder, setInputPlaceholder] = useState('Choose a role above…');
  const [flowStep, setFlowStep] = useState(0);
  const [urlName, setUrlName] = useState('you');
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const [pubLabel, setPubLabel] = useState('↗ Publish page');
  const [showTyping, setShowTyping] = useState(false);
  const [heroBg, setHeroBg] = useState('');
  const [apOpen, setApOpen] = useState(false);
  const [apTab, setApTab] = useState<ApTab>('library');
  const [libQ, setLibQ] = useState('');
  const [panelVersion, setPanelVersion] = useState(0);
  const [editingSecId, setEditingSecId] = useState<string | null>(null);

  // artist-specific
  const [artistGenre, setArtistGenre] = useState('');
  const [artistStage, setArtistStage] = useState('');

  const contentRef = useRef<Content>(makeContent(initRole));
  const roleRef = useRef<Role>(initRole);
  const pageRootRef = useRef<HTMLDivElement>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveKeyRef = useRef('ps2_' + (data?.profileId || data?.profileHexId || 'anon'));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(0);
  const themeRef = useRef<Theme | null>(null);
  const directionsRef = useRef<Theme[]>([]);
  const artistGenreRef = useRef('');
  const artistStageRef = useRef('');
  const heroBgRef = useRef('');
  const photosRef = useRef<PhotoItem[]>([]);
  const tracksRef = useRef<TrackItem[]>([]);
  const linksRef = useRef<Record<string, string>>({});
  const heroPhotoRef = useRef('');
  const avatarRef = useRef('');
  const sectionsRef = useRef<SectionDef[]>(clone(DEFAULT_SECTIONS));
  const pressRef = useRef<PressData>({ quotes: [{ q:'', pub:'', yr:'' }], mentions: '' });
  const releaseRef = useRef<ReleaseData>({ title:'', type:'Single', date:'Out Now', artSrc:'', streams: { spotify:'', apple:'', youtube:'', soundcloud:'' } });
  const bookingRef = useRef<BookingData>({ genres: [], market:'', contact:'', cap:'', note:'' });
  const newsletterRef = useRef<NewsletterData>({ headline:'Stay in the loop', cta:'Subscribe' });

  const forcePanel = () => setPanelVersion(v => v + 1);

  /* inject styles + fonts once */
  useEffect(() => {
    if (!document.getElementById('ps2-styles')) {
      const s = document.createElement('style'); s.id = 'ps2-styles'; s.textContent = STYLES; document.head.appendChild(s);
    }
    if (!document.getElementById('ps2-fonts')) {
      const l = document.createElement('link'); l.id = 'ps2-fonts'; l.rel = 'stylesheet'; l.href = FONT_HREF; document.head.appendChild(l);
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (pubTimer.current) clearTimeout(pubTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /* start flow on mount */
  useEffect(() => { startFlow(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* scroll chat to bottom */
  const scrollChat = useCallback(() => {
    setTimeout(() => { if (msgsRef.current) msgsRef.current.scrollTop = 9999; }, 40);
  }, []);

  function addMsg(msg: ChatMsg) {
    setChatMsgs((prev: ChatMsg[]) => [...prev, msg]);
  }

  function toast(msg: string) {
    setToastMsg(msg); setToastOn(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOn(false), 3000);
  }

  /* answer a chips message — mark which chip was picked */
  function answerChips(msgId: string, value: string) {
    setChatMsgs((prev: ChatMsg[]) => prev.map((m: ChatMsg) =>
      m.id === msgId && m.type === 'chips' ? { ...m, answered: value } : m
    ));
  }

  /* ── FLOW ── */
  function startFlow(fresh = false) {
    stepRef.current = 0;
    setChatMsgs([]);
    setFlowStep(0);
    setInputEnabled(false);
    setInputPlaceholder('Choose a role above…');
    setTheme(null); themeRef.current = null;
    setDirections([]); directionsRef.current = [];
    setArtistGenre(''); artistGenreRef.current = '';
    setArtistStage(''); artistStageRef.current = '';
    setHeroBg(''); heroBgRef.current = '';
    setApOpen(false);
    setEditingSecId(null);
    photosRef.current = [];
    tracksRef.current = [];
    linksRef.current = {};
    heroPhotoRef.current = '';
    avatarRef.current = '';
    sectionsRef.current = clone(DEFAULT_SECTIONS);
    pressRef.current = { quotes: [{ q:'', pub:'', yr:'' }], mentions: '' };
    releaseRef.current = { title:'', type:'Single', date:'Out Now', artSrc:'', streams: { spotify:'', apple:'', youtube:'', soundcloud:'' } };
    bookingRef.current = { genres: [], market:'', contact:'', cap:'', note:'' };
    newsletterRef.current = { headline:'Stay in the loop', cta:'Subscribe' };
    contentRef.current = makeContent(roleRef.current);
    if (pageScrollRef.current) pageScrollRef.current.innerHTML = '';

    // Restore from localStorage
    const savedRaw = typeof window !== 'undefined' ? localStorage.getItem(saveKeyRef.current) : null;
    if (!fresh && savedRaw) {
      try {
        const saved = JSON.parse(savedRaw) as { role: Role; theme: Theme; content: { name: string; tagline: string; bio: string }; sections: SectionDef[]; heroBg: string; tracks: TrackItem[]; links: Record<string, string> };
        roleRef.current = saved.role;
        setRole(saved.role);
        contentRef.current = { ...makeContent(saved.role), ...saved.content };
        sectionsRef.current = saved.sections || clone(DEFAULT_SECTIONS);
        heroBgRef.current = saved.heroBg || '';
        setHeroBg(saved.heroBg || '');
        tracksRef.current = saved.tracks || [];
        linksRef.current = saved.links || {};
        themeRef.current = saved.theme;
        setTheme(saved.theme);
        stepRef.current = 7;
        setFlowStep(7);
        setUrlName(toSlug(saved.content.name));
        setTimeout(() => {
          applyTheme(saved.theme);
          addMsg({ id: makeId(), type: 'ai', html: `Welcome back! Your page for <b>${esc(saved.content.name)}</b> is live. Keep refining or hit ↗ Publish.` });
          const r = saved.role;
          setInputPlaceholder(
            r === 'artist' ? '"darker", "add shows section", "punk energy"…'
            : r === 'venue' ? '"darker", "add booking section", "industrial vibe"…'
            : '"darker", "purple accent", "serif font"…'
          );
          setInputEnabled(true);
          scrollChat();
        }, 200);
        return;
      } catch { /* ignore corrupt save */ }
    }

    // Pre-populate from linked profile on first open
    const pe = data?.pageEditor;
    if (!fresh && pe?.name) {
      roleRef.current = initRole;
      setRole(initRole);
      contentRef.current = makeContent(initRole);
      contentRef.current.name = pe.name;
      if (pe.bio) contentRef.current.bio = pe.bio;
      if (pe.headline) contentRef.current.tagline = pe.headline;
      if (pe.songs?.length) {
        tracksRef.current = pe.songs.slice(0, 8).map((s: { hexId: string; title: string }) => ({ id: s.hexId, name: s.title, dur: '' }));
      }
      stepRef.current = 4;
      setFlowStep(4);
      setTimeout(() => {
        addMsg({ id: makeId(), type: 'ai', html: `Found your profile — let's style your page, <b>${esc(pe.name)}</b>. <b>Describe your vibe</b>:` });
        const vMsgId = makeId();
        addMsg({
          id: vMsgId, type: 'chips', kind: 'vibe',
          chips: (VIBE_CHIPS[initRole] as string[]).map((v: string) => ({ value: v, label: v })),
        });
        setInputPlaceholder(`e.g. "${ROLES[initRole].defaultVibe}"`);
        setInputEnabled(true);
        scrollChat();
      }, 300);
      return;
    }

    setTimeout(() => {
      addMsg({ id: makeId(), type: 'ai', html: "Hey! I'm your <b>AI page builder</b>. Let's create a page that truly represents your brand. <b>What kind of page are you making?</b>" });
      setTimeout(() => {
        const chipsMsgId = makeId();
        addMsg({
          id: chipsMsgId, type: 'chips', kind: 'role',
          chips: [{ value: 'artist', label: '🎵 Artist' }, { value: 'venue', label: '🏟 Venue' }, { value: 'promoter', label: '📣 Promoter' }, { value: 'fan', label: '🎧 Fan' }],
        });
        scrollChat();
      }, 350);
    }, 280);
  }

  function handleRoleChip(msgId: string, val: Role) {
    answerChips(msgId, val);
    roleRef.current = val;
    setRole(val);
    contentRef.current = makeContent(val);
    addMsg({ id: makeId(), type: 'user', text: { artist: 'Artist 🎵', venue: 'Venue 🏟', promoter: 'Promoter 📣', fan: 'Fan 🎧' }[val] });
    stepRef.current = 1;
    setFlowStep(1);
    setTimeout(() => {
      addMsg({ id: makeId(), type: 'ai', html: `What's your name — or your act's name?` });
      setInputPlaceholder(`e.g. "${ROLES[val].defaultName}"`);
      setInputEnabled(true);
      scrollChat();
    }, 380);
  }

  function handleGenreChip(msgId: string, genre: string) {
    answerChips(msgId, genre);
    artistGenreRef.current = genre;
    setArtistGenre(genre);
    addMsg({ id: makeId(), type: 'user', text: genre });
    stepRef.current = 3;
    setFlowStep(3);
    setTimeout(() => {
      addMsg({ id: makeId(), type: 'ai', html: 'Where are you at right now as an artist?' });
      const stageMsgId = makeId();
      addMsg({
        id: stageMsgId, type: 'chips', kind: 'stage',
        chips: [
          { value: 'starting',  label: 'Just starting out' },
          { value: 'releasing', label: 'Releasing music' },
          { value: 'touring',   label: 'Actively touring' },
          { value: 'booking',   label: 'Looking for gigs' },
        ],
      });
      setInputPlaceholder('Select above…');
      setInputEnabled(false);
      scrollChat();
    }, 380);
  }

  function handleStageChip(msgId: string, stage: string) {
    answerChips(msgId, stage);
    artistStageRef.current = stage;
    setArtistStage(stage);
    addMsg({ id: makeId(), type: 'user', text: { starting: 'Just starting out', releasing: 'Releasing music', touring: 'Actively touring', booking: 'Looking for gigs' }[stage] || stage });
    // Auto-enable relevant sections based on career stage
    if (stage === 'releasing') { const s = sectionsRef.current.find(x => x.id === 'release'); if (s) s.on = true; }
    if (stage === 'touring' || stage === 'booking') { const s = sectionsRef.current.find(x => x.id === 'booking'); if (s) s.on = true; }
    if (stage === 'starting') { const s = sectionsRef.current.find(x => x.id === 'newsletter'); if (s) s.on = true; }
    stepRef.current = 4;
    setFlowStep(4);
    setTimeout(() => {
      addMsg({ id: makeId(), type: 'ai', html: 'Last one — <b>describe your sound or aesthetic</b> in a few words:' });
      const chipsMsgId = makeId();
      addMsg({
        id: chipsMsgId, type: 'chips', kind: 'vibe',
        chips: (VIBE_CHIPS[roleRef.current as Role] as string[]).map((v: string) => ({ value: v, label: v })),
      });
      setInputPlaceholder(`e.g. "${(ROLES[roleRef.current as Role] as RoleDef).defaultVibe}"`);
      setInputEnabled(true);
      scrollChat();
    }, 380);
  }

  function handleVibeChip(msgId: string, vibe: string) {
    answerChips(msgId, vibe);
    addMsg({ id: makeId(), type: 'user', text: vibe });
    doGenerate(vibe);
  }

  async function doGenerate(vibeText: string) {
    setInputEnabled(false);
    setInputPlaceholder('Building your page…');
    setGenerating(true);
    setShowTyping(true);
    scrollChat();

    await new Promise(r => setTimeout(r, 1300));
    setShowTyping(false);
    setGenerating(false);

    const dirs = fallbackDirections(vibeText, roleRef.current);
    directionsRef.current = dirs;
    setDirections(dirs);
    applyTheme(dirs[0]);

    stepRef.current = 6;
    setFlowStep(6);
    addMsg({ id: makeId(), type: 'ai', html: `Here are <b>3 directions</b> for <b>${esc(contentRef.current.name)}</b>:` });
    addMsg({ id: makeId(), type: 'dirs' });

    setTimeout(() => {
      addMsg({ id: makeId(), type: 'ai', html: `Live in preview ✦ Tap a direction to compare, or type a change below.` });
      stepRef.current = 7;
      setFlowStep(7);
      const r = roleRef.current;
      setInputPlaceholder(
        r === 'artist' ? '"darker", "add shows section", "punk energy"…'
        : r === 'venue' ? '"darker", "add booking section", "industrial vibe"…'
        : '"darker", "purple accent", "serif font"…'
      );
      setInputEnabled(true);
      scrollChat();
    }, 700);
  }

  function handleSend() {
    const val = chatInput.trim();
    if (!val || !inputEnabled) return;
    setChatInput('');

    if (stepRef.current === 1) {
      // name
      contentRef.current.name = val;
      addMsg({ id: makeId(), type: 'user', text: val });
      if (roleRef.current === 'artist') {
        stepRef.current = 2;
        setFlowStep(2);
        setTimeout(() => {
          addMsg({ id: makeId(), type: 'ai', html: 'What genre best describes your sound?' });
          const gMsgId = makeId();
          addMsg({
            id: gMsgId, type: 'chips', kind: 'genre',
            chips: ['R&B / Soul', 'Hip-Hop', 'Pop', 'Rock / Indie', 'Electronic', 'Jazz / Blues', 'Folk / Acoustic', 'Other'].map(g => ({ value: g, label: g })),
          });
          setInputPlaceholder('Select a genre above…');
          setInputEnabled(false);
          scrollChat();
        }, 380);
      } else {
        stepRef.current = 4;
        setFlowStep(4);
        setTimeout(() => {
          addMsg({ id: makeId(), type: 'ai', html: 'Describe your vibe in a few words:' });
          const vMsgId = makeId();
          addMsg({
            id: vMsgId, type: 'chips', kind: 'vibe',
            chips: (VIBE_CHIPS[roleRef.current as Role] as string[]).map((v: string) => ({ value: v, label: v })),
          });
          setInputPlaceholder(`e.g. "${(ROLES[roleRef.current as Role] as RoleDef).defaultVibe}"`);
          setInputEnabled(true);
          scrollChat();
        }, 380);
      }
    } else if (stepRef.current === 4) {
      addMsg({ id: makeId(), type: 'user', text: val });
      doGenerate(val);
    } else if (stepRef.current === 7) {
      addMsg({ id: makeId(), type: 'user', text: val });
      doRefine(val);
    }
  }

  function doRefine(ins: string) {
    if (!themeRef.current) return;
    if (IMAGE_RE.test(ins)) {
      addMsg({ id: makeId(), type: 'ai', html: "I can't generate images — upload your own in <b>📷 Photos</b>, or browse free backgrounds in <b>🖼 Library</b>." });
      setInputPlaceholder('"make it darker", "purple accent", "serif font"…');
      setInputEnabled(true);
      scrollChat();
      return;
    }
    const next = heuristicRefine(ins, themeRef.current, contentRef.current);
    applyTheme(next);
    addMsg({ id: makeId(), type: 'ai', html: `Done — updated: <b>${esc(ins)}</b>` });
    setInputPlaceholder('"make it darker", "purple accent", "serif font"…');
    setInputEnabled(true);
    scrollChat();
  }

  /* ── APPLY THEME ── */
  const applyTheme = useCallback((t: Theme) => {
    const content = contentRef.current;
    if (t.tagline) content.tagline = t.tagline;
    if (t.bio) content.bio = t.bio;
    themeRef.current = t;
    setTheme(t);
    setUrlName(toSlug(content.name));

    const root = pageRootRef.current;
    const scroll = pageScrollRef.current;
    if (!root || !scroll) return;

    const p = t.palette; const f = FONTS[t.font] || FONTS.editorial;
    const safeHeroUrl = t.heroUrl?.startsWith('blob:') ? t.heroUrl : '';
    const map: Record<string, string> = {
      '--p-bg': p.bg, '--p-surface': p.surface, '--p-line': p.line, '--p-ink': p.ink,
      '--p-ink2': p.ink2, '--p-accent': p.accent, '--p-accent2': p.accent2,
      '--p-display': f.display, '--p-body': f.body, '--p-label': f.label, '--p-serif': f.accent,
      '--p-dweight': String(f.dWeight), '--p-tight': f.tight, '--p-radius': '14px',
      '--p-hero-url': safeHeroUrl ? `url(${safeHeroUrl})` : 'none',
    };
    for (const k in map) root.style.setProperty(k, map[k]);
    root.dataset.mood = t.mood;
    root.dataset.layout = t.layout;

    const heroBgItem = LIBRARY.find(l => l.id === heroBgRef.current);
    scroll.innerHTML = sanitizePreviewHtml(renderPreviewHTML(content, t, {
      heroBgCss: heroBgItem?.bg,
      heroPhotoUrl: heroPhotoRef.current,
      avatarUrl: avatarRef.current,
      tracks: tracksRef.current,
      links: linksRef.current,
      sections: sectionsRef.current,
      press: pressRef.current,
      release: releaseRef.current,
      booking: bookingRef.current,
      newsletter: newsletterRef.current,
    }));

    scroll.querySelectorAll<HTMLElement>('[data-edit]').forEach((el: HTMLElement) => {
      const field = el.dataset.edit;
      const single = field !== 'bio';
      el.addEventListener('blur', () => {
        const v = (el.textContent || '').trim();
        if (field === 'name') { content.name = v; setUrlName(toSlug(v)); }
        else if (field === 'tagline') content.tagline = v;
        else if (field === 'bio') content.bio = v;
      });
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && single) { e.preventDefault(); el.blur(); }
      });
    });

    // Debounce save to localStorage once a full page has been built
    if (stepRef.current >= 7) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(saveKeyRef.current, JSON.stringify({
            role: roleRef.current,
            theme: t,
            content: { name: content.name, tagline: content.tagline, bio: content.bio },
            sections: sectionsRef.current,
            heroBg: heroBgRef.current,
            tracks: tracksRef.current,
            links: linksRef.current,
          }));
        } catch { /* ignore quota errors */ }
      }, 800);
    }
  }, []);

  function toggleAP(tab: ApTab) {
    if (apOpen && apTab === tab) { setApOpen(false); return; }
    setApTab(tab); setApOpen(true);
  }

  function applyHeroBg(id: string) {
    const next = heroBg === id ? '' : id;
    setHeroBg(next);
    heroBgRef.current = next;
    if (themeRef.current) applyTheme(themeRef.current);
  }

  /* ── PHOTOS ── */
  function addPhoto(file: File) {
    const url = URL.createObjectURL(file);
    const isFirst = photosRef.current.length === 0;
    const item: PhotoItem = { id: makeId(), name: file.name, url, hero: isFirst };
    photosRef.current.push(item);
    if (isFirst) {
      heroPhotoRef.current = url;
      heroBgRef.current = '';
      setHeroBg('');
    }
    if (themeRef.current) applyTheme(themeRef.current);
    forcePanel();
    toast(isFirst ? 'Hero background set' : 'Photo added');
  }
  function setHeroPhoto(idx: number) {
    photosRef.current.forEach((p, i) => { p.hero = i === idx; });
    heroPhotoRef.current = photosRef.current[idx].url;
    heroBgRef.current = '';
    setHeroBg('');
    if (themeRef.current) applyTheme(themeRef.current);
    forcePanel();
    toast('Hero updated');
  }
  function setAvatar(file: File) {
    avatarRef.current = URL.createObjectURL(file);
    if (themeRef.current) applyTheme(themeRef.current);
    forcePanel();
    toast('Profile photo set');
  }

  /* ── MUSIC ── */
  function addTrack(file: File) {
    const name = file.name.replace(/\.[^.]+$/, '');
    const track: TrackItem = { id: makeId(), name, dur: '—' };
    tracksRef.current.push(track);
    const au = new Audio(URL.createObjectURL(file));
    const idx = tracksRef.current.length - 1;
    au.addEventListener('loadedmetadata', () => {
      const s = Math.round(au.duration);
      tracksRef.current[idx].dur = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (themeRef.current) applyTheme(themeRef.current);
      forcePanel();
    });
    if (themeRef.current) applyTheme(themeRef.current);
    forcePanel();
    toast(`Added: ${name}`);
  }
  function removeTrack(idx: number) {
    tracksRef.current.splice(idx, 1);
    if (themeRef.current) applyTheme(themeRef.current);
    forcePanel();
  }

  /* ── LINKS ── */
  function saveLink(key: string, val: string) {
    linksRef.current[key] = val;
    if (themeRef.current) applyTheme(themeRef.current);
    toast('Link saved');
  }

  /* ── EPK EXPORT ── */
  function exportEPK() {
    if (!themeRef.current || !contentRef.current) return toast('Generate your page first!');
    const c = contentRef.current; const p = themeRef.current.palette;
    const ini = (c.name || '').split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
    const avHTML = avatarRef.current
      ? `<img src="${avatarRef.current}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${p.accent},${p.accent2});border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:32px;color:#fff">${ini}</div>`;
    const trackList = c.sections.find(s => s.kind === 'tracks')?.items || [];
    const showList = c.sections.find(s => s.kind === 'shows')?.items || [];
    const quotes = pressRef.current.quotes.filter(q => q.q);
    const links = Object.entries(linksRef.current).filter(([, v]) => v);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.name)} · EPK</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#fff;color:#111;max-width:760px;margin:0 auto;padding:52px 44px;-webkit-font-smoothing:antialiased}@media print{@page{margin:1in}body{padding:0}}.hd{display:flex;gap:28px;align-items:flex-start;margin-bottom:44px;padding-bottom:36px;border-bottom:3px solid ${p.accent}}.av{width:100px;height:100px;flex-shrink:0;overflow:hidden}.name{font-family:'Syne',sans-serif;font-weight:800;font-size:40px;letter-spacing:-.03em;line-height:1;color:#111;margin-bottom:8px}.kicker{font-size:11px;color:#888;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}.tagline{font-family:'Instrument Serif',serif;font-style:italic;font-size:19px;color:#555;margin-top:10px;line-height:1.4}h2{font-family:'Syne',sans-serif;font-weight:700;font-size:10px;letter-spacing:.2em;color:${p.accent};text-transform:uppercase;margin:32px 0 14px;padding-bottom:9px;border-bottom:1px solid #e0e0e0}.bio{font-size:16px;line-height:1.75;color:#333;max-width:580px}.tracks{list-style:none}.tracks li{display:flex;gap:14px;align-items:center;padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222}.tracks li span{color:#bbb;font-size:12px;width:22px;text-align:right;flex-shrink:0}.shows{display:grid;grid-template-columns:1fr 1fr;gap:10px}.show{padding:12px 14px;border:1px solid #eee;border-radius:8px}.show b{display:block;font-size:14px;font-weight:600;color:#111;margin-bottom:3px}.show small{font-size:12px;color:#888}.pq{padding:16px 0;border-bottom:1px solid #f0f0f0}.pq blockquote{font-family:'Instrument Serif',serif;font-style:italic;font-size:18px;color:#222;line-height:1.5;margin-bottom:7px}.pq cite{font-size:11px;color:#999;letter-spacing:.08em;text-transform:uppercase}.book{background:#f9f9f9;border-radius:8px;padding:20px 22px;margin-top:14px}.book p{font-size:14px;color:#444;line-height:1.6;margin-bottom:6px}.links{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ltag{padding:6px 14px;border:1px solid #ddd;border-radius:99px;font-size:12px;color:#555;text-decoration:none}.foot{margin-top:52px;padding-top:20px;border-top:2px solid ${p.accent};display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#aaa}.foot b{color:${p.accent};font-size:13px}.print-btn{position:fixed;top:20px;right:20px;padding:10px 18px;background:${p.accent};color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:.06em;cursor:pointer}@media print{.print-btn{display:none}}</style>
</head><body>
<button class="print-btn" onclick="window.print()">Save as PDF</button>
<div class="hd"><div class="av">${avHTML}</div><div><div class="kicker">${esc(c.hero.kicker)}</div><div class="name">${esc(c.name)}</div><div class="tagline">${esc(c.tagline)}</div></div></div>
<h2>Bio</h2><p class="bio">${esc(c.bio)}</p>
${trackList.length || tracksRef.current.length ? `<h2>Music</h2><ul class="tracks">${[...trackList.map(t => ({ n: t.t })), ...tracksRef.current].map((t, i) => `<li><span>${String(i+1).padStart(2,'0')}</span>${esc((t as {n?:string;name?:string}).n || (t as {name?:string}).name || '')}</li>`).join('')}</ul>` : ''}
${showList.length ? `<h2>Shows</h2><div class="shows">${showList.map(s => `<div class="show"><b>${esc(s.t)}</b><small>${esc(s.m)}</small></div>`).join('')}</div>` : ''}
${quotes.length ? `<h2>Press</h2>${quotes.map(q => `<div class="pq"><blockquote>"${esc(q.q)}"</blockquote><cite>— ${esc(q.pub)}${q.yr ? ' · ' + esc(q.yr) : ''}</cite></div>`).join('')}` : ''}
${pressRef.current.mentions ? `<p style="margin-top:14px;font-size:13px;color:#666"><b style="color:#111">As seen in:</b> ${esc(pressRef.current.mentions)}</p>` : ''}
${bookingRef.current.contact || bookingRef.current.market ? `<h2>Booking</h2><div class="book">${bookingRef.current.genres.length ? `<p><b>Genres:</b> ${bookingRef.current.genres.join(', ')}</p>` : ''}${bookingRef.current.market ? `<p><b>Market:</b> ${esc(bookingRef.current.market)}</p>` : ''}${bookingRef.current.cap ? `<p><b>Stage size:</b> ${esc(bookingRef.current.cap)}</p>` : ''}${bookingRef.current.note ? `<p>${esc(bookingRef.current.note)}</p>` : ''}${bookingRef.current.contact ? `<p style="margin-top:10px"><b>Booking contact:</b> <a href="mailto:${esc(bookingRef.current.contact)}">${esc(bookingRef.current.contact)}</a></p>` : ''}</div>` : ''}
${links.length ? `<h2>Links</h2><div class="links">${links.map(([pl, u]) => `<a class="ltag" href="${esc(u)}">${esc(pl)}</a>`).join('')}</div>` : ''}
<div class="foot"><div>Electronic Press Kit · ${new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}</div><b>ihype.fm/${toSlug(c.name)}</b></div>
</body></html>`;
    const w = window.open('', '_blank', 'width=860,height=740,scrollbars=yes');
    if (w) { w.document.write(html); w.document.close(); } else toast('Allow popups to open the EPK');
    toast('EPK ready — click "Save as PDF" in the new window');
  }

  function resetAll() {
    if (typeof window !== 'undefined') localStorage.removeItem(saveKeyRef.current);
    startFlow(true);
    if (pageScrollRef.current) pageScrollRef.current.innerHTML = '';
    if (pageRootRef.current) {
      pageRootRef.current.dataset.mood = 'dark';
      pageRootRef.current.dataset.layout = 'spotlight';
    }
    setUrlName('you');
    setPubLabel('↗ Publish page');
  }

  function onPublish() {
    if (!themeRef.current) return toast('Generate your page first!');
    toast(`✓ Published to ihype.fm/${toSlug(contentRef.current.name)}`);
    setPubLabel('✓ Published');
    if (pubTimer.current) clearTimeout(pubTimer.current);
    pubTimer.current = setTimeout(() => setPubLabel('↗ Publish page'), 2800);
  }

  /* ── RENDER CHIP ROW ── */
  function ChatChipRow({ msg }: { msg: Extract<ChatMsg, { type: 'chips' }> }) {
    return (
      <div className="ps2-chips-wrap">
        <div className="ps2-av">✦</div>
        <div className="ps2-chips-row">
          {msg.chips.map(c => (
            <button
              key={c.value}
              className={'ps2-chip' + (msg.answered === c.value ? ' picked' : '')}
              disabled={!!msg.answered}
              onClick={() => {
                if (msg.answered) return;
                if (msg.kind === 'role') handleRoleChip(msg.id, c.value as Role);
                else if (msg.kind === 'genre') handleGenreChip(msg.id, c.value);
                else if (msg.kind === 'stage') handleStageChip(msg.id, c.value);
                else if (msg.kind === 'vibe') handleVibeChip(msg.id, c.value);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── RENDER DIRECTION CARDS ── */
  function DirCards() {
    return (
      <div className="ps2-dirs-wrap">
        <div className="ps2-av">✦</div>
        <div className="ps2-dirs-row">
          {directions.map((d: Theme, i: number) => {
            const p = d.palette;
            const active = themeRef.current?.name === d.name;
            return (
              <button
                key={d.name + i}
                className={'ps2-dcard' + (active ? ' on' : '')}
                onClick={() => { applyTheme(directions[i]); toast(`Applied: ${d.name}`); }}
              >
                <div className="ps2-dp" style={{ background: p.bg }}>
                  <div className="ps2-dp-bar" style={{ background: p.accent }} />
                  <div className="ps2-dp-dot" style={{ background: p.accent2 }} />
                  <div className="ps2-dp-lines">
                    <i style={{ background: p.ink }} />
                    <i style={{ background: p.ink2 }} />
                  </div>
                </div>
                <div className="ps2-dm">
                  <b>{d.name}</b>
                  <span>{FONTS[d.font].name} · {d.layout}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── MAIN RENDER ── */
  return (
    <div className={'ps2-app' + (apOpen ? ' ap-open' : '')}>
      {/* ── CHAT PANEL ── */}
      <div className="ps2-chat">
        <div className="ps2-chat-hd">
          <div className="ps2-chat-icon">✦</div>
          <div>
            <div className="ps2-chat-title">AI Page Builder</div>
          </div>
          <div className="ps2-chat-sub">POWERED BY CLAUDE</div>
          <button className="ps2-new-btn" onClick={resetAll}>↺ New</button>
        </div>

        <div className="ps2-msgs" ref={msgsRef}>
          {chatMsgs.map((msg: ChatMsg) => {
            if (msg.type === 'ai') return (
              <div key={msg.id} className="ps2-msg ai">
                <div className="ps2-av">✦</div>
                <div className="ps2-bub" dangerouslySetInnerHTML={{ __html: sanitizeChatHtml(msg.html) }} />
              </div>
            );
            if (msg.type === 'user') return (
              <div key={msg.id} className="ps2-msg user">
                <div className="ps2-bub">{msg.text}</div>
              </div>
            );
            if (msg.type === 'chips') return <ChatChipRow key={msg.id} msg={msg as Extract<ChatMsg, { type: 'chips' }>} />;
            if (msg.type === 'dirs' && directions.length > 0) return <DirCards key={msg.id} />;
            return null;
          })}
          {showTyping && (
            <div className="ps2-typing-wrap">
              <div className="ps2-av">✦</div>
              <div className="ps2-dots"><span /><span /><span /></div>
            </div>
          )}
        </div>

        <div className="ps2-chat-ft">
          <div className="ps2-in-row">
            <input
              className="ps2-in"
              value={chatInput}
              placeholder={inputPlaceholder}
              disabled={!inputEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
            />
            <button
              className="ps2-send-btn"
              disabled={!inputEnabled || !chatInput.trim()}
              onClick={handleSend}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="ps2-ast-strip">
            <button className={'ps2-ab ps2-ab-prime' + (apOpen && apTab === 'sections' ? ' on' : '')} onClick={() => toggleAP('sections')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="4" y="10" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="4" y="16" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="1.7"/></svg>
              Sections
            </button>
            <button className={'ps2-ab' + (apOpen && apTab === 'photos' ? ' on' : '')} onClick={() => toggleAP('photos')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M3 16l5-5 4 4 3-3 6 5" stroke="currentColor" strokeWidth="1.7"/></svg>
              Photos
            </button>
            <button className={'ps2-ab' + (apOpen && apTab === 'music' ? ' on' : '')} onClick={() => toggleAP('music')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.7"/><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.7"/><circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.7"/></svg>
              Music
            </button>
            <button className={'ps2-ab' + (apOpen && apTab === 'links' ? ' on' : '')} onClick={() => toggleAP('links')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              Links
            </button>
            <button className={'ps2-ab' + (apOpen && apTab === 'library' ? ' on' : '')} onClick={() => toggleAP('library')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/></svg>
              Library
            </button>
          </div>
        </div>
      </div>

      {/* ── STAGE ── */}
      <main className={'ps2-stage' + (generating ? ' gen' : '')} data-d={device}>
        <div className="ps2-stbar">
          <div className="ps2-url-pill">🔒 ihype.fm/<b>{urlName}</b></div>
          <div className="ps2-stage-r">
            <div className="ps2-dev-seg">
              <button className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Desktop
              </button>
              <button className={device === 'mobile' ? 'on' : ''} onClick={() => setDevice('mobile')}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M11 18h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Mobile
              </button>
            </div>
            <div className="ps2-theme-tag">THEME · <b>{theme?.name ?? '—'}</b></div>
            <button className="ps2-epk-btn" onClick={exportEPK}>⎘ Export EPK</button>
            <button className="ps2-pub-btn" onClick={onPublish}>{pubLabel}</button>
          </div>
        </div>

        <div className="ps2-vp">
          <div id="ps2-pr" ref={pageRootRef} data-mood="dark" data-layout="spotlight">
            <div id="ps2-ps" ref={pageScrollRef} style={{ display: theme ? 'block' : 'none' }} />
            {!theme && (
              <div className="ps2-empty">
                <div className="ps2-spark">✦</div>
                <h3>Your page lives here</h3>
                <p>Chat with the AI to describe your vibe — a full page appears in seconds, no design skills needed.</p>
                <div className="ps2-hint">START IN THE CHAT ←</div>
              </div>
            )}
          </div>
        </div>

        <div className={'ps2-toast' + (toastOn ? ' show' : '')}>{toastMsg}</div>
      </main>

      {/* ── ASSET PANEL ── */}
      {apOpen && (
        <aside className="ps2-ap">
          <div className="ps2-ap-hd">
            {(['sections', 'photos', 'music', 'links', 'library'] as ApTab[]).map(tab => {
              const icons: Record<ApTab, React.ReactNode> = {
                sections: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="4" y="10" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="4" y="16" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="1.7"/></svg>,
                photos:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M3 16l5-5 4 4 3-3 6 5" stroke="currentColor" strokeWidth="1.7"/></svg>,
                music:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.7"/><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.7"/><circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.7"/></svg>,
                links:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
                library:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/></svg>,
              };
              return (
                <button
                  key={tab}
                  title={tab.charAt(0).toUpperCase() + tab.slice(1)}
                  className={'ps2-ap-tab' + (apTab === tab ? ' on' : '')}
                  onClick={() => setApTab(tab)}
                >
                  {icons[tab]}
                </button>
              );
            })}
            <button className="ps2-ap-x" onClick={() => setApOpen(false)} title="Close">×</button>
          </div>

          <div className="ps2-ap-body" key={panelVersion}>
            {apTab === 'library' && (() => {
              const q = libQ.trim().toLowerCase();
              const items = q
                ? LIBRARY.filter(l => l.label.toLowerCase().includes(q) || l.kw.some(k => k.includes(q)))
                : LIBRARY;
              return (
                <>
                  <div className="ps2-ap-label">BACKGROUND LIBRARY</div>
                  <div className="ps2-lib-bar">
                    <input
                      placeholder="Search…"
                      value={libQ}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLibQ(e.target.value)}
                    />
                  </div>
                  <div className="ps2-lib-cc">CC0 · royalty-free · no attribution needed</div>
                  <div className="ps2-lib-grid">
                    {items.map(l => (
                      <div
                        key={l.id}
                        className={'ps2-li' + (heroBg === l.id ? ' on' : '')}
                        onClick={() => applyHeroBg(l.id)}
                      >
                        <div className="ps2-li-img" style={{ background: l.bg }} />
                        <div className="ps2-li-cap">{l.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {apTab === 'photos' && (() => {
              const photos = photosRef.current;
              return (
                <>
                  <div className="ps2-ap-label">PROFILE PHOTO</div>
                  <div className="ps2-avz">
                    <input type="file" accept="image/*" onChange={(e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setAvatar(e.target.files[0]); }} />
                    <div className="ps2-avz-prev">
                      {avatarRef.current ? <img src={avatarRef.current} alt="" /> : '👤'}
                    </div>
                    <div className="ps2-avz-text">
                      <h4>Profile photo</h4>
                      <p>{avatarRef.current ? 'Click to replace' : 'Upload your avatar'}</p>
                    </div>
                  </div>
                  <div className="ps2-ap-label">HERO BACKGROUND</div>
                  <div
                    className="ps2-upz"
                    onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('over'); }}
                    onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('over'); }}
                    onDrop={(e: React.DragEvent) => {
                      e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove('over');
                      Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('image/')) addPhoto(f); });
                    }}
                  >
                    <input type="file" accept="image/*" multiple onChange={(e: React.ChangeEvent<HTMLInputElement>) => { Array.from(e.target.files || []).forEach(addPhoto); }} />
                    <div className="ps2-upz-ico">🖼️</div>
                    <h4>Drop photos here</h4>
                    <p>JPG · PNG · WEBP</p>
                  </div>
                  {photos.length > 0 && (
                    <>
                      <div className="ps2-ph-grid">
                        {photos.map((ph, i) => (
                          <div key={ph.id} className={'ps2-ph-th' + (ph.hero ? ' hero' : '')} onClick={() => setHeroPhoto(i)}>
                            <img src={ph.url} alt={ph.name} />
                            <div className="ps2-ph-badge">{ph.hero ? 'HERO' : '✓'}</div>
                          </div>
                        ))}
                      </div>
                      <p className="ps2-ph-hint">Tap to set as hero background</p>
                    </>
                  )}
                </>
              );
            })()}

            {apTab === 'music' && (() => {
              const tracks = tracksRef.current;
              return (
                <>
                  <div className="ps2-ap-label">TRACKS</div>
                  <div
                    className="ps2-upz"
                    onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('over'); }}
                    onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('over'); }}
                    onDrop={(e: React.DragEvent) => {
                      e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove('over');
                      Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('audio/')) addTrack(f); });
                    }}
                  >
                    <input type="file" accept="audio/*" multiple onChange={(e: React.ChangeEvent<HTMLInputElement>) => { Array.from(e.target.files || []).forEach(addTrack); }} />
                    <div className="ps2-upz-ico">🎵</div>
                    <h4>Drop tracks here</h4>
                    <p>MP3 · WAV · FLAC</p>
                  </div>
                  {tracks.length > 0 && (
                    <div className="ps2-tr-list">
                      {tracks.map((t, i) => (
                        <div key={t.id} className="ps2-tr">
                          <span className="ps2-tr-play">▶</span>
                          <div className="ps2-tr-inf">
                            <b>{t.name}</b>
                            <small>{t.dur}</small>
                          </div>
                          <button className="ps2-tr-del" onClick={() => removeTrack(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {apTab === 'links' && (
              <>
                <div className="ps2-ap-label">LINKS</div>
                <div className="ps2-ap-hint">Links appear on your published page</div>
                {LK_PLATFORMS.map(pl => {
                  const inputRef = React.createRef<HTMLInputElement>();
                  return (
                    <div key={pl.key} className="ps2-lk-row">
                      <div className="ps2-lk-ic">{pl.icon}</div>
                      <input
                        ref={inputRef}
                        className="ps2-lk-in"
                        placeholder={pl.ph}
                        defaultValue={linksRef.current[pl.key] || ''}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { saveLink(pl.key, (e.currentTarget as HTMLInputElement).value.trim()); (e.currentTarget as HTMLInputElement).blur(); } }}
                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => saveLink(pl.key, e.currentTarget.value.trim())}
                      />
                      <button className="ps2-lk-add" onClick={() => { if (inputRef.current) saveLink(pl.key, inputRef.current.value.trim()); }}>+</button>
                    </div>
                  );
                })}
              </>
            )}

            {apTab === 'sections' && (() => {
              if (editingSecId) {
                const sec = sectionsRef.current.find(s => s.id === editingSecId);
                return (
                  <>
                    <button className="ps2-sec-back-btn" onClick={() => setEditingSecId(null)}>← Back to sections</button>
                    <div className="ps2-ap-label">{sec?.icon} {sec?.label?.toUpperCase()}</div>

                    {editingSecId === 'press' && (() => {
                      const pr = pressRef.current;
                      return (
                        <>
                          <div className="ps2-ap-hint">Press quotes appear as pull quotes on your page</div>
                          {pr.quotes.map((q, i) => (
                            <div key={i} className="ps2-press-card">
                              <textarea
                                className="ps2-press-ta"
                                rows={2}
                                placeholder='"Best new artist in the city"'
                                defaultValue={q.q}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { pr.quotes[i].q = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }}
                              />
                              <div className="ps2-press-row2">
                                <input className="ps2-press-in" placeholder="Publication" defaultValue={q.pub} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { pr.quotes[i].pub = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                                <input className="ps2-press-in" placeholder="Year" defaultValue={q.yr} style={{ maxWidth:'64px' }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { pr.quotes[i].yr = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                              </div>
                            </div>
                          ))}
                          <button className="ps2-add-quote-btn" onClick={() => { pr.quotes.push({ q:'', pub:'', yr:'' }); forcePanel(); }}>+ Add another quote</button>
                          <div className="ps2-ap-label" style={{ marginTop:'14px' }}>AS SEEN IN</div>
                          <input className="ps2-lk-in" style={{ width:'100%', marginBottom:'4px' }} placeholder="Pitchfork, Rolling Stone, Resident Advisor…" defaultValue={pr.mentions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { pr.mentions = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                          <div className="ps2-ap-hint">Comma-separated — shows as "As seen in" row</div>
                        </>
                      );
                    })()}

                    {editingSecId === 'release' && (() => {
                      const rd = releaseRef.current;
                      return (
                        <>
                          {[
                            { key:'title', label:'RELEASE TITLE', ph:'Album / EP / Single name' },
                            { key:'date',  label:'STATUS',         ph:'Out Now · or release date' },
                            { key:'type',  label:'FORMAT',         ph:'Single, EP, Album, Mixtape' },
                          ].map(f => (
                            <React.Fragment key={f.key}>
                              <div className="ps2-ap-label">{f.label}</div>
                              <input className="ps2-lk-in" style={{ width:'100%', marginBottom:'10px' }} placeholder={f.ph} defaultValue={(rd as unknown as Record<string,string>)[f.key] || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { (rd as unknown as Record<string,string>)[f.key] = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                            </React.Fragment>
                          ))}
                          <div className="ps2-ap-label">ALBUM ART</div>
                          <div className="ps2-upz" style={{ marginBottom:'12px' }}>
                            <input type="file" accept="image/*" onChange={(e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { rd.artSrc = URL.createObjectURL(e.target.files[0]); if (themeRef.current) applyTheme(themeRef.current); forcePanel(); } }} />
                            <div className="ps2-upz-ico">{rd.artSrc ? '✓' : '💿'}</div>
                            <h4>{rd.artSrc ? 'Art uploaded' : 'Upload album art'}</h4>
                            <p>Square 1:1 works best</p>
                          </div>
                          <div className="ps2-ap-label">STREAMING LINKS</div>
                          {['spotify','apple','youtube','soundcloud'].map(s => (
                            <input key={s} className="ps2-lk-in" style={{ width:'100%', marginBottom:'7px' }} placeholder={`${s.charAt(0).toUpperCase()+s.slice(1)} URL`} defaultValue={rd.streams[s] || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { rd.streams[s] = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                          ))}
                        </>
                      );
                    })()}

                    {editingSecId === 'booking' && (() => {
                      const bd = bookingRef.current;
                      return (
                        <>
                          <div className="ps2-ap-label">GENRES</div>
                          <div className="ps2-genre-tags">
                            {BOOKING_GENRES.map(g => (
                              <button
                                key={g}
                                className={'ps2-gtag-btn' + (bd.genres.includes(g) ? ' on' : '')}
                                onClick={() => {
                                  const idx = bd.genres.indexOf(g);
                                  if (idx > -1) bd.genres.splice(idx, 1); else bd.genres.push(g);
                                  if (themeRef.current) applyTheme(themeRef.current);
                                  forcePanel();
                                }}
                              >{g}</button>
                            ))}
                          </div>
                          {[
                            { key:'market',  label:'MARKET / CITY',    ph:'Chicago, IL · Midwest' },
                            { key:'cap',     label:'STAGE SIZE',       ph:'300–800 cap'            },
                            { key:'contact', label:'BOOKING CONTACT',  ph:'booking@email.com'       },
                            { key:'note',    label:'NOTE',             ph:'Available weekends, touring summer 2025' },
                          ].map(f => (
                            <React.Fragment key={f.key}>
                              <div className="ps2-ap-label">{f.label}</div>
                              <input className="ps2-lk-in" style={{ width:'100%', marginBottom:'10px' }} placeholder={f.ph} defaultValue={(bd as unknown as Record<string,string>)[f.key] || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { (bd as unknown as Record<string,string>)[f.key] = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                            </React.Fragment>
                          ))}
                        </>
                      );
                    })()}

                    {editingSecId === 'newsletter' && (() => {
                      const nd = newsletterRef.current;
                      return (
                        <>
                          {[
                            { key:'headline', label:'HEADLINE',    ph:'Stay in the loop' },
                            { key:'cta',      label:'BUTTON TEXT', ph:'Subscribe'         },
                          ].map(f => (
                            <React.Fragment key={f.key}>
                              <div className="ps2-ap-label">{f.label}</div>
                              <input className="ps2-lk-in" style={{ width:'100%', marginBottom:'10px' }} placeholder={f.ph} defaultValue={(nd as unknown as Record<string,string>)[f.key] || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { (nd as unknown as Record<string,string>)[f.key] = e.target.value; if (themeRef.current) applyTheme(themeRef.current); }} />
                            </React.Fragment>
                          ))}
                        </>
                      );
                    })()}
                  </>
                );
              }

              // Section list
              const secs = sectionsRef.current;
              return (
                <>
                  <div className="ps2-ap-label">PAGE SECTIONS</div>
                  <div className="ps2-ap-hint">Toggle on/off · ▲▼ to reorder · tap Edit to fill content</div>
                  <div className="ps2-sec-list">
                    {secs.map((sec, i) => (
                      <div key={sec.id} className="ps2-sec-row">
                        <div className="ps2-sec-lft">
                          <span className="ps2-sec-handle">≡</span>
                          <span className="ps2-sec-ico">{sec.icon}</span>
                          <span className="ps2-sec-lbl">{sec.label}</span>
                        </div>
                        <div className="ps2-sec-rgt">
                          {sec.on && ['press','release','booking','newsletter'].includes(sec.id) && (
                            <button className="ps2-sec-edit" onClick={() => setEditingSecId(sec.id)}>Edit →</button>
                          )}
                          <div className="ps2-sec-ord">
                            {i > 0 && <button className="ps2-sec-arr" onClick={() => { secs.splice(i, 1); secs.splice(i-1, 0, sec); if (themeRef.current) applyTheme(themeRef.current); forcePanel(); }}>▲</button>}
                            {i < secs.length - 1 && <button className="ps2-sec-arr" onClick={() => { secs.splice(i, 1); secs.splice(i+1, 0, sec); if (themeRef.current) applyTheme(themeRef.current); forcePanel(); }}>▼</button>}
                          </div>
                          <button
                            className={'ps2-sec-toggle' + (sec.on ? ' on' : '')}
                            onClick={() => { sec.on = !sec.on; if (themeRef.current) applyTheme(themeRef.current); forcePanel(); toast(`${sec.label} ${sec.on ? 'enabled' : 'hidden'}`); }}
                          >{sec.on ? 'ON' : 'OFF'}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </aside>
      )}
    </div>
  );
}
