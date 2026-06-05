'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShellV2';

/* ──────────────────────────────────────────────────────────────────────────
   iHYPE AI Page Studio — React port of the prototype.
   Describe a vibe → generate 3 themed page directions → inline-edit + refine.
   No AI network call here: uses the curated fallback + heuristic refine.
   ────────────────────────────────────────────────────────────────────────── */

type Role = 'artist' | 'venue' | 'promoter' | 'fan';
type Device = 'desktop' | 'mobile';
type FontKey = 'editorial' | 'grotesk' | 'serif' | 'mono';
type LayoutKey = 'spotlight' | 'zine' | 'poster' | 'gallery';
type MoodKey = 'dark' | 'light';

interface Palette {
  bg: string;
  surface: string;
  line: string;
  ink: string;
  ink2: string;
  accent: string;
  accent2: string;
}
interface Theme {
  name: string;
  mood: MoodKey;
  font: FontKey;
  layout: LayoutKey;
  palette: Palette;
  tagline: string | null;
  bio: string | null;
  radius: number;
  heroUrl?: string;
}
interface FontDef {
  name: string;
  display: string;
  body: string;
  label: string;
  accent: string;
  dWeight: number;
  tight: string;
}
interface SectionItem {
  t: string;
  m: string;
}
interface Section {
  kind: 'tracks' | 'shows' | 'about';
  title: string;
  items: SectionItem[];
}
interface RoleHero {
  kicker: string;
  stat: string;
  statLabel: string;
  cta: string;
}
interface RoleDef {
  label: string;
  defaultName: string;
  defaultVibe: string;
  hero: RoleHero;
  tagline: string;
  bio: string;
  sections: Section[];
}
interface Content {
  name: string;
  tagline: string;
  bio: string;
  hero: RoleHero;
  sections: Section[];
  defaultVibe: string;
}
interface Look {
  id: string;
  name: string;
  mood: MoodKey;
  font: FontKey;
  layout: LayoutKey;
  kw: string[];
  palette: Palette;
}

/* ── font pairings ── */
const FONTS: Record<FontKey, FontDef> = {
  editorial: { name: 'Editorial', display: "'Syne', sans-serif", body: "'DM Sans', sans-serif", label: "'JetBrains Mono', monospace", accent: "'Instrument Serif', serif", dWeight: 800, tight: '-.03em' },
  grotesk: { name: 'Grotesk', display: "'Bricolage Grotesque', sans-serif", body: "'Space Grotesk', sans-serif", label: "'Space Grotesk', sans-serif", accent: "'Bricolage Grotesque', sans-serif", dWeight: 800, tight: '-.04em' },
  serif: { name: 'Serif', display: "'Instrument Serif', serif", body: "'DM Sans', sans-serif", label: "'JetBrains Mono', monospace", accent: "'Instrument Serif', serif", dWeight: 400, tight: '-.01em' },
  mono: { name: 'Mono', display: "'Space Grotesk', sans-serif", body: "'DM Sans', sans-serif", label: "'JetBrains Mono', monospace", accent: "'JetBrains Mono', monospace", dWeight: 700, tight: '-.02em' },
};

const LAYOUTS: LayoutKey[] = ['spotlight', 'zine', 'poster', 'gallery'];

const LOOKS: Look[] = [
  { id: 'velvet', name: 'Midnight Velvet', mood: 'dark', font: 'editorial', layout: 'spotlight', kw: ['moody', 'night', 'r&b', 'soul', 'smooth', 'dark', 'sultry', 'velvet', 'jazz', 'slow'], palette: { bg: '#0b0712', surface: '#171022', line: '#2a2036', ink: '#f4eefc', ink2: '#bda9da', accent: '#b983ff', accent2: '#ff3e9a' } },
  { id: 'ember', name: 'Ember Heat', mood: 'dark', font: 'grotesk', layout: 'poster', kw: ['energy', 'hot', 'loud', 'rock', 'punk', 'bold', 'fire', 'aggressive', 'hard', 'rap', 'hype'], palette: { bg: '#0c0805', surface: '#1a120b', line: '#2e2114', ink: '#fdf3ea', ink2: '#d6a98a', accent: '#ff5029', accent2: '#ffb84a' } },
  { id: 'paper', name: 'Sun-Faded Paper', mood: 'light', font: 'serif', layout: 'zine', kw: ['americana', 'folk', 'warm', 'acoustic', 'vintage', 'indie', 'soft', 'country', 'intimate', 'singer'], palette: { bg: '#f4ece0', surface: '#fbf6ee', line: '#e0d3c0', ink: '#211a12', ink2: '#6f5f4a', accent: '#c2451f', accent2: '#3b6b4a' } },
  { id: 'neon', name: 'Neon Hyperpop', mood: 'dark', font: 'mono', layout: 'gallery', kw: ['neon', 'hyperpop', 'electronic', 'pop', 'club', 'glitch', 'future', 'rave', 'synth', 'bright', 'dance'], palette: { bg: '#07060f', surface: '#120f24', line: '#241f3e', ink: '#f0fbff', ink2: '#8fd0e6', accent: '#22e5d4', accent2: '#ff3e9a' } },
  { id: 'mint', name: 'Cool Mint', mood: 'light', font: 'grotesk', layout: 'gallery', kw: ['fresh', 'clean', 'minimal', 'airy', 'calm', 'ambient', 'chill', 'lo-fi', 'modern', 'bright'], palette: { bg: '#eef4f0', surface: '#ffffff', line: '#d6e2da', ink: '#0e1a14', ink2: '#5a7065', accent: '#1f8a5b', accent2: '#2a6fdb' } },
  { id: 'cobalt', name: 'Cobalt Midnight', mood: 'dark', font: 'editorial', layout: 'spotlight', kw: ['blue', 'cool', 'dreamy', 'shoegaze', 'synth', 'melancholy', 'wave', 'deep', 'ocean', 'night'], palette: { bg: '#070a14', surface: '#0f1626', line: '#1d2940', ink: '#eef3fb', ink2: '#9db4d6', accent: '#5b8dff', accent2: '#22e5d4' } },
  { id: 'bubblegum', name: 'Bubblegum', mood: 'light', font: 'grotesk', layout: 'poster', kw: ['fun', 'playful', 'pop', 'cute', 'bubbly', 'bright', 'happy', 'colorful', 'teen', 'sweet'], palette: { bg: '#fff0f6', surface: '#ffffff', line: '#ffd0e4', ink: '#2a0a1c', ink2: '#a04f72', accent: '#ff3e9a', accent2: '#b983ff' } },
  { id: 'noir', name: 'Concrete Noir', mood: 'dark', font: 'mono', layout: 'zine', kw: ['industrial', 'techno', 'minimal', 'brutal', 'grey', 'underground', 'warehouse', 'raw', 'noir', 'experimental'], palette: { bg: '#0a0a0b', surface: '#141416', line: '#262629', ink: '#f2f2f3', ink2: '#9a9a9e', accent: '#e8e8ea', accent2: '#ff5029' } },
  { id: 'punk', name: 'Punk Zine', mood: 'dark', font: 'mono', layout: 'zine', kw: ['punk', 'hardcore', 'diy', 'raw', 'zine', 'grunge', 'riot'], palette: { bg: '#0a0a08', surface: '#141410', line: '#2c2c24', ink: '#f5f5e8', ink2: '#b0b09a', accent: '#e8ff00', accent2: '#ff2222' } },
  { id: 'space', name: 'Deep Space', mood: 'dark', font: 'editorial', layout: 'spotlight', kw: ['space', 'cosmic', 'galaxy', 'ethereal', 'celestial', 'astro', 'sci-fi'], palette: { bg: '#030408', surface: '#080c18', line: '#141c38', ink: '#e8f0ff', ink2: '#8099cc', accent: '#7060ff', accent2: '#22e5d4' } },
  { id: 'girly', name: 'Girly Pop', mood: 'light', font: 'grotesk', layout: 'gallery', kw: ['girly', 'feminine', 'cute', 'pink', 'soft', 'pastel', 'kawaii', 'dreamy', 'pop'], palette: { bg: '#fff4f9', surface: '#ffffff', line: '#ffd8ec', ink: '#2a0a1c', ink2: '#a04f72', accent: '#ff69b4', accent2: '#b983ff' } },
  { id: 'country', name: 'Golden Hour', mood: 'light', font: 'serif', layout: 'poster', kw: ['country', 'western', 'americana', 'twang', 'golden', 'rustic', 'sunset'], palette: { bg: '#fdf4e3', surface: '#fff8ec', line: '#e8d5b0', ink: '#2a1a00', ink2: '#7a5a2a', accent: '#c07a00', accent2: '#8b3a00' } },
  { id: 'lofi', name: 'Lo-Fi Bedroom', mood: 'dark', font: 'mono', layout: 'zine', kw: ['lofi', 'bedroom', 'cassette', 'tape', 'chill', 'hazy', 'vintage', 'lo-fi'], palette: { bg: '#1a1610', surface: '#231e18', line: '#352e24', ink: '#f0e8d0', ink2: '#a89070', accent: '#d4a060', accent2: '#8090a0' } },
  { id: 'metal', name: 'Iron Gate', mood: 'dark', font: 'mono', layout: 'poster', kw: ['metal', 'heavy', 'death', 'black metal', 'doom', 'sludge', 'gothic', 'dark'], palette: { bg: '#060606', surface: '#0e0e0e', line: '#1e1e1e', ink: '#cccccc', ink2: '#888888', accent: '#cc0000', accent2: '#666666' } },
  { id: 'jazz', name: 'Blue Note', mood: 'dark', font: 'serif', layout: 'spotlight', kw: ['jazz', 'soul', 'blues', 'smooth', 'bebop', 'classic', 'vinyl'], palette: { bg: '#08080f', surface: '#12121e', line: '#20203a', ink: '#f0ece4', ink2: '#9090a8', accent: '#4060ff', accent2: '#d4b060' } },
  { id: 'rave', name: 'Warehouse Rave', mood: 'dark', font: 'mono', layout: 'gallery', kw: ['rave', 'techno', 'warehouse', 'underground', 'acid', 'trance', 'bass'], palette: { bg: '#040408', surface: '#0a0a14', line: '#16163a', ink: '#f0f0ff', ink2: '#8080cc', accent: '#ff00ff', accent2: '#00ffff' } },
];

const ROLES: Record<Role, RoleDef> = {
  artist: {
    label: 'Artist', defaultName: 'Jordan Nore', defaultVibe: 'moody late-night alt-R&B, smooth and a little mysterious',
    hero: { kicker: 'ARTIST · CHICAGO', stat: '2,140', statLabel: 'HYPE this month', cta: '▶ Listen' },
    tagline: 'Slow songs for late trains home.',
    bio: "Alt-R&B out of Logan Square. I write at night and record into whatever's closest. Three EPs, one band, zero rush.",
    sections: [
      { kind: 'tracks', title: 'Top tracks', items: [{ t: 'Velvet Hours', m: '2:58 · 540 HYPE' }, { t: 'Carmine', m: '3:24 · 412 HYPE' }, { t: 'Northbound', m: '4:01 · 388 HYPE' }, { t: 'Slow Combust', m: '3:12 · 301 HYPE' }] },
      { kind: 'shows', title: 'Next shows', items: [{ t: 'Empty Bottle', m: 'Fri Jun 6 · Ukrainian Village' }, { t: 'Sleeping Village', m: 'Sat Jun 21 · Avondale' }] },
    ],
  },
  venue: {
    label: 'Venue', defaultName: 'Empty Bottle', defaultVibe: 'gritty, beloved 400-cap room — indie, punk, electronic',
    hero: { kicker: 'VENUE · UKRAINIAN VILLAGE', stat: '400', statLabel: 'capacity', cta: 'Book this room' },
    tagline: "Chicago's living room for loud music.",
    bio: "400 capacity, open since '92. Indie, punk, and electronic seven nights a week. If it's about to break, it played here first.",
    sections: [
      { kind: 'shows', title: 'This month', items: [{ t: 'Mau Lwin', m: 'Thu Jun 5 · bedroom pop' }, { t: 'The Veldt Kids', m: 'Sat Jun 14 · post-punk' }, { t: 'Dossier', m: 'Fri Jun 27 · house / electronic' }] },
      { kind: 'about', title: 'The room', items: [{ t: 'Capacity 400', m: 'Standing · two bars · green room' }, { t: 'Load-in', m: 'Alley access · house backline available' }] },
    ],
  },
  promoter: {
    label: 'Promoter', defaultName: 'Late Hour Collective', defaultVibe: 'tastemaker club nights — house, techno, after-dark energy',
    hero: { kicker: 'PROMOTER · CHICAGO', stat: '128', statLabel: 'shows presented', cta: 'Pitch me a date' },
    tagline: 'We throw the nights you hear about Monday.',
    bio: 'Independent promoters since 2019. House, techno, and the occasional left turn. 81% average sell-through across 128 shows.',
    sections: [
      { kind: 'shows', title: 'Recent nights', items: [{ t: 'Basement Heat · Vol 9', m: 'Sold out · 480 cap' }, { t: 'After Dark w/ Dossier', m: '92% paid · Pilsen' }, { t: 'Warehouse Series 04', m: 'Sold out · secret location' }] },
      { kind: 'about', title: 'What we book', items: [{ t: 'House · techno · club', m: '300–800 cap rooms' }, { t: 'Late slots', m: '10pm–4am · weekends' }] },
    ],
  },
  fan: {
    label: 'Fan', defaultName: 'Riley', defaultVibe: 'a music-obsessed regular who lives for live shows',
    hero: { kicker: 'FAN · CHICAGO', stat: '1,204', statLabel: 'HYPE given', cta: '+ Follow' },
    tagline: 'I was into them before, obviously.',
    bio: "Show-goer, seed-swiper, certified early adopter. I've HYPEd 1,204 times and been to 38 shows this year. Ask me who's next.",
    sections: [
      { kind: 'tracks', title: 'My top 5 this week', items: [{ t: 'Jordan Nore', m: 'Alt-R&B · 12 HYPE' }, { t: 'Mau Lwin', m: 'Bedroom pop · 9 HYPE' }, { t: 'The Veldt Kids', m: 'Post-punk · 7 HYPE' }, { t: 'Sasha Quill', m: 'Hyperpop · 6 HYPE' }] },
      { kind: 'shows', title: "Shows I've been to", items: [{ t: '38 shows', m: 'this year · 6 cities' }, { t: 'Front row certified', m: 'Empty Bottle regular' }] },
    ],
  },
};

const PALETTES: [string, string][] = [
  ['#ff5029', '#ffb84a'], ['#ff3e9a', '#b983ff'], ['#22e5d4', '#5b8dff'],
  ['#b983ff', '#ff3e9a'], ['#1f8a5b', '#2a6fdb'], ['#e8e8ea', '#ff5029'],
];

const CHIPS: Record<Role, string[]> = {
  artist: ['moody late-night R&B', 'sun-faded indie folk', 'neon hyperpop', 'DIY punk zine', 'dreamy blue shoegaze', 'bold rap energy'],
  venue: ['gritty beloved dive', 'sleek modern club', 'warm listening room', 'industrial warehouse', 'vintage theater', 'rooftop summer vibe'],
  promoter: ['after-dark techno', 'tastemaker indie nights', 'big festival energy', 'underground warehouse', 'glossy pop spectacle', 'cozy DIY booker'],
  fan: ['certified early adopter', 'vinyl-obsessed purist', 'front-row regular', 'chill bedroom listener', 'hyperpop stan', 'jazz & soul head'],
};

/* ── helpers ── */
function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
function makeContent(r: Role): Content {
  const def = ROLES[r];
  return { name: def.defaultName, tagline: def.tagline, bio: def.bio, hero: clone(def.hero), sections: clone(def.sections), defaultVibe: def.defaultVibe };
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── color helpers ── */
function hx(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}
function parseHex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function darken(h: string, f: number): string {
  const [r, g, b] = parseHex(h);
  return '#' + hx(r * (1 - f)) + hx(g * (1 - f)) + hx(b * (1 - f));
}
function saturate(h: string): string {
  const [r, g, b] = parseHex(h);
  const mx = Math.max(r, g, b);
  return '#' + [r, g, b].map((v) => hx(v + (v === mx ? 40 : -15))).join('');
}

/* ── fallback / refine ── */
function fallbackDirections(vibe: string, role: Role): Theme[] {
  const v = (vibe || '').toLowerCase();
  const scored = LOOKS.map((l) => ({ l, s: l.kw.reduce((a, k) => a + (v.includes(k) ? 1 : 0), 0) + Math.random() * 0.4 }));
  scored.sort((a, b) => b.s - a.s);
  const picks: Look[] = [];
  for (const { l } of scored) {
    if (picks.length >= 3) break;
    if (picks.some((p) => p.mood === l.mood && p.layout === l.layout)) continue;
    picks.push(l);
  }
  while (picks.length < 3) {
    const l = scored[picks.length].l;
    if (!picks.includes(l)) picks.push(l);
  }
  return picks.slice(0, 3).map((l) => ({
    name: l.name, mood: l.mood, font: l.font, layout: l.layout, palette: { ...l.palette },
    tagline: ROLES[role].tagline, bio: ROLES[role].bio, radius: 16,
  }));
}

function heuristicRefine(ins: string, theme: Theme, content: Content): Theme {
  const t = clone(theme);
  const s = ins.toLowerCase();
  const P = t.palette;
  if (/dark|moody|night|black/.test(s)) { t.mood = 'dark'; P.bg = darken(P.bg, 0.5); P.surface = darken(P.surface, 0.4); P.ink = '#f3eefb'; P.ink2 = '#b9a9d6'; }
  if (/light|bright|white|clean/.test(s)) { t.mood = 'light'; P.bg = '#f4ece0'; P.surface = '#fff'; P.line = '#e0d3c0'; P.ink = '#1c160f'; P.ink2 = '#6f5f4a'; }
  if (/bold|loud|punch|pop|vivid/.test(s)) { P.accent = saturate(P.accent); P.accent2 = saturate(P.accent2); }
  if (/minimal|simple|calm|subtle|quiet/.test(s)) { t.layout = 'zine'; P.accent2 = P.ink2; }
  if (/serif|elegant|classy|editorial/.test(s)) t.font = 'serif';
  if (/mono|techy|digital|terminal/.test(s)) t.font = 'mono';
  if (/poster|big|huge/.test(s)) t.layout = 'poster';
  if (/grid|gallery|photos/.test(s)) t.layout = 'gallery';
  const colorMap: Record<string, string> = { red: '#ff5029', orange: '#ff7a29', pink: '#ff3e9a', purple: '#b983ff', blue: '#5b8dff', teal: '#22e5d4', green: '#1f8a5b', amber: '#ffb84a', gold: '#ffb84a' };
  for (const k in colorMap) if (s.includes(k)) { P.accent = colorMap[k]; break; }
  t.bio = theme.bio || content.bio;
  return t;
}

/* ── preview HTML ── */
function sectionHTML(s: Section): string {
  if (s.kind === 'tracks') {
    return `<section class="pg-sec"><h2 class="pg-sec-t">${escapeHtml(s.title)}</h2><div class="pg-rows">${s.items
      .map((it, i) => `<div class="pg-row"><span class="pg-row-n">${String(i + 1).padStart(2, '0')}</span><span class="pg-play">▶</span><span class="pg-row-main"><b>${escapeHtml(it.t)}</b><small>${escapeHtml(it.m)}</small></span><button class="pg-hype">♥ HYPE</button></div>`)
      .join('')}</div></section>`;
  }
  if (s.kind === 'shows') {
    return `<section class="pg-sec"><h2 class="pg-sec-t">${escapeHtml(s.title)}</h2><div class="pg-cards">${s.items
      .map((it) => `<div class="pg-card"><div class="pg-card-b"><b>${escapeHtml(it.t)}</b><small>${escapeHtml(it.m)}</small></div><span class="pg-chip">tickets</span></div>`)
      .join('')}</div></section>`;
  }
  return `<section class="pg-sec"><h2 class="pg-sec-t">${escapeHtml(s.title)}</h2><div class="pg-cards">${s.items
    .map((it) => `<div class="pg-card plain"><div class="pg-card-b"><b>${escapeHtml(it.t)}</b><small>${escapeHtml(it.m)}</small></div></div>`)
    .join('')}</div></section>`;
}

function renderPreviewHTML(content: Content, theme: Theme): string {
  const c = content;
  const h = c.hero;
  const initials = c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `
    <div class="pg-hero">
      <div class="pg-hero-scrim"></div>
      <div class="pg-hero-inner">
        <div class="pg-avatar-wrap"><span class="pg-avatar-fallback">${escapeHtml(initials)}</span></div>
        <div class="pg-kicker">${escapeHtml(h.kicker)}</div>
        <h1 class="pg-name" contenteditable="true" spellcheck="false" data-edit="name">${escapeHtml(c.name)}</h1>
        <p class="pg-tagline" contenteditable="true" spellcheck="false" data-edit="tagline">${escapeHtml(c.tagline)}</p>
        <div class="pg-hero-row">
          <button class="pg-cta">${escapeHtml(h.cta)}</button>
          <div class="pg-stat"><b>${escapeHtml(h.stat)}</b><span>${escapeHtml(h.statLabel)}</span></div>
        </div>
      </div>
    </div>
    <div class="pg-body">
      <section class="pg-sec pg-about">
        <h2 class="pg-sec-t">About</h2>
        <p class="pg-bio" contenteditable="true" spellcheck="false" data-edit="bio">${escapeHtml(c.bio)}</p>
      </section>
      ${c.sections.map(sectionHTML).join('')}
      <div class="pg-foot">Made with <b>iHYPE</b> · ${escapeHtml(FONTS[theme.font].name)} type · ${escapeHtml(theme.name)}</div>
    </div>`;
}

/* ── stylesheet ── */
const STYLES = `
.ps-app { display:grid; grid-template-columns:392px 1fr; height:100%; overflow:hidden; background:var(--bg2); color:var(--ink); }
.ps-app *,.ps-app *::before,.ps-app *::after { box-sizing:border-box; }
.ps-app button { font:inherit; color:inherit; background:none; border:none; cursor:pointer; }
.ps-app button:focus-visible { outline:1px solid var(--pink,#ff3e9a); outline-offset:2px; }

.ps-panel { background:var(--bg2); border-right:1px solid var(--line); overflow-y:auto; display:flex; flex-direction:column; }
.ps-panel::-webkit-scrollbar { width:9px; }
.ps-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:5px; border:2px solid var(--bg); }
.ps-pn { padding:18px; border-bottom:1px solid var(--line); }
.ps-eyebrow { font-family:var(--fm); font-size:9px; color:var(--ink3); letter-spacing:.18em; font-weight:700; margin-bottom:9px; display:flex; align-items:center; gap:8px; }
.ps-eyebrow .ps-num { width:16px; height:16px; border-radius:5px; background:var(--bg4); color:var(--accent); display:flex; align-items:center; justify-content:center; font-size:9px; }

.ps-role-seg { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; background:var(--bg3); border:1px solid var(--line); border-radius:9px; padding:4px; }
.ps-role-seg .ps-seg { padding:8px 4px; border-radius:6px; font-family:var(--fm); font-size:10px; font-weight:600; letter-spacing:.04em; color:var(--ink3); text-align:center; }
.ps-role-seg .ps-seg.on { background:var(--accent); color:var(--bg); }

.ps-hero-prompt h2 { font-family:var(--fd); font-weight:800; font-size:21px; letter-spacing:-.02em; line-height:1.1; margin-bottom:6px; }
.ps-hero-prompt h2 .ps-grad { background:linear-gradient(110deg,var(--accent),var(--pink,#ff3e9a),var(--purple,#b983ff)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.ps-hero-prompt p { font-family:var(--fb); font-size:12.5px; color:var(--ink2); line-height:1.5; margin-bottom:14px; }
.ps-vibe-box textarea { width:100%; min-height:78px; resize:none; background:var(--bg); border:1px solid var(--line2); border-radius:11px; padding:13px 14px; font-family:var(--fb); font-size:13.5px; color:var(--ink); line-height:1.5; }
.ps-vibe-box textarea::placeholder { color:var(--ink3); }
.ps-vibe-box textarea:focus { outline:none; border-color:var(--accent); }
.ps-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:11px; }
.ps-chip { padding:6px 11px; border-radius:99px; background:var(--bg3); border:1px solid var(--line); font-family:var(--fm); font-size:10.5px; font-weight:500; color:var(--ink2); letter-spacing:.02em; }
.ps-chip:hover { color:var(--ink); border-color:var(--line2); background:var(--bg4); }
.ps-gen-row { display:flex; gap:8px; margin-top:14px; }
.ps-gen-btn { flex:1; min-height:46px; border-radius:11px; background:linear-gradient(110deg,var(--accent),#ff6a40); color:var(--bg); font-family:var(--fm); font-size:13px; font-weight:700; letter-spacing:.03em; display:flex; align-items:center; justify-content:center; gap:7px; transition:filter .15s; }
.ps-gen-btn:hover { filter:brightness(1.07); }
.ps-gen-btn.busy { opacity:.8; pointer-events:none; }
.ps-gen-btn.busy::after { content:''; width:13px; height:13px; border-radius:99px; border:2px solid rgba(0,0,0,.35); border-top-color:var(--bg); margin-left:4px; animation:ps-spin .7s linear infinite; }
@keyframes ps-spin { to { transform:rotate(360deg); } }
.ps-surprise { width:46px; flex-shrink:0; border-radius:11px; border:1px solid var(--line2); background:var(--bg3); color:var(--ink2); font-size:17px; display:flex; align-items:center; justify-content:center; }
.ps-surprise:hover { color:var(--ink); border-color:var(--line2); background:var(--bg4); }

.ps-title { font-family:var(--fd); font-weight:700; font-size:13px; letter-spacing:-.01em; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.ps-title span { font-family:var(--fm); font-size:9px; color:var(--ink3); letter-spacing:.08em; font-weight:600; }
.ps-dirs { display:flex; flex-direction:column; gap:8px; }
.ps-dir { display:flex; align-items:center; gap:11px; padding:9px; border-radius:11px; border:1px solid var(--line); background:var(--bg3); position:relative; transition:border-color .15s; width:100%; }
.ps-dir:hover { border-color:var(--line2); }
.ps-dir.on { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
.ps-dir-prev { width:64px; height:48px; border-radius:8px; flex-shrink:0; position:relative; overflow:hidden; border:1px solid rgba(255,255,255,.08); }
.ps-dir-bar { position:absolute; left:8px; top:9px; width:30px; height:7px; border-radius:99px; }
.ps-dir-dot { position:absolute; right:8px; top:8px; width:9px; height:9px; border-radius:99px; }
.ps-dir-lines { position:absolute; left:8px; bottom:9px; right:8px; display:flex; flex-direction:column; gap:4px; }
.ps-dir-lines i { height:3px; border-radius:99px; display:block; opacity:.85; }
.ps-dir-lines i:nth-child(2) { width:60%; opacity:.5; }
.ps-dir-meta { flex:1; min-width:0; text-align:left; }
.ps-dir-meta b { font-family:var(--fd); font-weight:700; font-size:13px; display:block; color:var(--ink); }
.ps-dir-meta span { font-family:var(--fm); font-size:9.5px; color:var(--ink3); letter-spacing:.04em; text-transform:capitalize; }
.ps-dir-on { font-family:var(--fm); font-size:8px; font-weight:700; letter-spacing:.1em; color:var(--accent); }

.ps-refine-box { display:flex; gap:7px; }
.ps-refine-box input { flex:1; min-width:0; background:var(--bg); border:1px solid var(--line2); border-radius:10px; padding:11px 13px; font-family:var(--fb); font-size:12.5px; color:var(--ink); }
.ps-refine-box input::placeholder { color:var(--ink3); }
.ps-refine-box input:focus { outline:none; border-color:var(--purple,#b983ff); }
.ps-refine-btn { width:42px; flex-shrink:0; border-radius:10px; background:var(--purple,#b983ff); color:var(--bg); display:flex; align-items:center; justify-content:center; }
.ps-refine-hint { font-family:var(--fm); font-size:9.5px; color:var(--ink3); letter-spacing:.02em; margin-top:9px; line-height:1.5; }
.ps-refine-hint b { color:var(--ink2); font-weight:600; }

.ps-ctl { margin-bottom:14px; }
.ps-ctl-l { font-family:var(--fm); font-size:9px; color:var(--ink3); letter-spacing:.14em; font-weight:700; margin-bottom:7px; }
.ps-pal-row { display:flex; gap:7px; }
.ps-pal { width:38px; height:26px; border-radius:7px; border:1px solid var(--line2); overflow:hidden; display:flex; }
.ps-pal span { flex:1; display:block; }
.ps-pal:hover { border-color:var(--ink2); }
.ps-seg2-row { display:flex; gap:5px; flex-wrap:wrap; }
.ps-seg2 { padding:7px 11px; border-radius:7px; background:var(--bg3); border:1px solid var(--line); font-family:var(--fm); font-size:10.5px; font-weight:600; color:var(--ink2); letter-spacing:.03em; text-transform:capitalize; }
.ps-seg2:hover { color:var(--ink); border-color:var(--line2); }
.ps-seg2.on { background:var(--bg); color:var(--ink); border-color:var(--accent); }

.ps-foot { margin-top:auto; padding:16px 18px; border-top:1px solid var(--line); }
.ps-publish-btn { width:100%; min-height:44px; border-radius:11px; background:var(--ink); color:var(--bg); font-family:var(--fm); font-size:12px; font-weight:700; letter-spacing:.05em; display:flex; align-items:center; justify-content:center; gap:7px; }
.ps-publish-btn:hover { filter:brightness(1.05); }
.ps-foot small { display:block; text-align:center; font-family:var(--fm); font-size:9px; color:var(--ink3); letter-spacing:.04em; margin-top:9px; }

.ps-stage { position:relative; overflow:hidden; background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,80,41,.06), transparent 60%),
    repeating-linear-gradient(45deg, transparent 0 11px, rgba(255,255,255,.012) 11px 12px),
    #0c0a08; display:flex; align-items:center; justify-content:center; padding:34px; }
.ps-stage-bar { position:absolute; top:0; left:0; right:0; height:42px; display:flex; align-items:center; gap:10px; padding:0 18px; z-index:6; }
.ps-url { display:flex; align-items:center; gap:8px; background:rgba(16,13,9,.7); backdrop-filter:blur(8px); border:1px solid var(--line); border-radius:99px; padding:6px 13px; font-family:var(--fm); font-size:11px; color:var(--ink2); letter-spacing:.02em; }
.ps-url .ps-lock { color:var(--ink3); }
.ps-url b { color:var(--ink); font-weight:600; }
.ps-device-seg { display:flex; background:var(--bg3); border:1px solid var(--line); border-radius:8px; padding:3px; gap:2px; }
.ps-device-seg .ps-seg { padding:5px 10px; border-radius:6px; font-family:var(--fm); font-size:10px; font-weight:600; letter-spacing:.06em; color:var(--ink3); display:flex; align-items:center; gap:5px; }
.ps-device-seg .ps-seg.on { background:var(--bg); color:var(--ink); }
.ps-vibe-name { margin-left:auto; font-family:var(--fm); font-size:10px; color:var(--ink3); letter-spacing:.08em; display:flex; align-items:center; gap:12px; }
.ps-vibe-name b { color:var(--ink); font-weight:600; }

.ps-thinking { position:absolute; bottom:22px; left:50%; transform:translateX(-50%) translateY(12px); z-index:8; background:var(--bg3); border:1px solid var(--purple,#b983ff); color:var(--ink); padding:10px 18px; border-radius:99px; font-family:var(--fm); font-size:11.5px; font-weight:500; letter-spacing:.02em; opacity:0; transition:opacity .25s, transform .25s; box-shadow:0 12px 36px rgba(0,0,0,.5); max-width:70%; text-align:center; pointer-events:none; }
.ps-thinking.show { opacity:1; transform:translateX(-50%) translateY(0); }

.ps-viewport { position:relative; background:var(--p-bg,#111); border-radius:16px; overflow:hidden; box-shadow:0 40px 90px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05); transition:box-shadow .3s ease, border-radius .35s cubic-bezier(.4,0,.2,1); }
.ps-stage[data-device="desktop"] .ps-viewport { width:980px; max-width:100%; height:min(78vh, 760px); }
.ps-stage[data-device="mobile"] .ps-viewport { width:380px; height:min(78vh, 760px); border-radius:34px; border:9px solid #1a1612; box-shadow:0 40px 90px -30px rgba(0,0,0,.7); }
.ps-stage.generating .ps-viewport { animation:ps-pulseGlow 1.1s ease-in-out infinite; }
@keyframes ps-pulseGlow { 0%,100%{ box-shadow:0 40px 90px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05);} 50%{ box-shadow:0 40px 90px -30px rgba(0,0,0,.7), 0 0 0 2px var(--purple,#b983ff);} }

#ps-pageRoot { position:absolute; inset:0; overflow:hidden; background:var(--p-bg); color:var(--p-ink); }
.ps-pageScroll { height:100%; overflow-y:auto; }

.ps-empty { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px; background:var(--bg2); }
.ps-empty .ps-spark { width:62px; height:62px; border-radius:18px; background:linear-gradient(135deg,var(--accent),var(--pink,#ff3e9a)); display:flex; align-items:center; justify-content:center; font-size:30px; margin-bottom:20px; box-shadow:0 14px 40px -8px rgba(255,80,41,.5); }
.ps-empty h3 { font-family:var(--fd); font-weight:800; font-size:24px; letter-spacing:-.02em; margin-bottom:10px; }
.ps-empty p { font-family:var(--fb); font-size:13.5px; color:var(--ink2); line-height:1.6; max-width:380px; }
.ps-empty .ps-hintline { margin-top:18px; font-family:var(--fm); font-size:10px; color:var(--ink3); letter-spacing:.08em; display:flex; align-items:center; gap:8px; }
.ps-empty .ps-hintline::before, .ps-empty .ps-hintline::after { content:''; height:1px; width:30px; background:var(--line2); }

#ps-pageRoot .pg-hero { position:relative; padding:0; }
#ps-pageRoot .pg-hero-scrim { position:absolute; inset:0; background:linear-gradient(180deg, color-mix(in srgb, var(--p-bg) 30%, transparent), var(--p-bg) 92%); }
#ps-pageRoot .pg-hero-inner { position:relative; padding:54px 44px 40px; display:flex; flex-direction:column; align-items:flex-start; gap:15px; }
#ps-pageRoot[data-layout="spotlight"] .pg-hero-inner { align-items:center; text-align:center; padding-top:64px; }
#ps-pageRoot[data-layout="spotlight"] .pg-tagline { margin-left:auto; margin-right:auto; }
#ps-pageRoot[data-layout="poster"] .pg-hero-inner { padding-top:80px; padding-bottom:50px; }
#ps-pageRoot .pg-avatar-wrap { position:relative; width:96px; height:96px; }
#ps-pageRoot[data-layout="poster"] .pg-avatar-wrap { width:74px; height:74px; }
#ps-pageRoot .pg-avatar-fallback { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:var(--p-display); font-weight:800; font-size:30px; color:var(--p-bg); background:linear-gradient(135deg,var(--p-accent),var(--p-accent2)); border-radius:50%; }
#ps-pageRoot .pg-kicker { font-family:var(--p-label); font-size:11px; font-weight:600; letter-spacing:.2em; color:var(--p-accent); text-transform:uppercase; }
#ps-pageRoot .pg-name { font-family:var(--p-display); font-weight:var(--p-dweight); font-size:60px; line-height:1.02; letter-spacing:var(--p-tight); color:var(--p-ink); outline:none; width:100%; }
#ps-pageRoot[data-layout="poster"] .pg-name { font-size:82px; }
#ps-pageRoot[data-layout="zine"] .pg-name { font-size:52px; }
#ps-pageRoot .pg-tagline { font-family:var(--p-serif); font-size:21px; line-height:1.35; color:var(--p-ink2); font-style:italic; max-width:520px; width:100%; outline:none; }
#ps-pageRoot .pg-hero-row { display:flex; align-items:center; gap:18px; margin-top:8px; flex-wrap:wrap; }
#ps-pageRoot[data-layout="spotlight"] .pg-hero-row { justify-content:center; }
#ps-pageRoot .pg-cta { font-family:var(--p-label); font-size:13px; font-weight:700; letter-spacing:.04em; color:var(--p-bg); background:var(--p-accent); padding:13px 24px; border-radius:var(--p-radius); }
#ps-pageRoot .pg-stat { display:flex; flex-direction:column; }
#ps-pageRoot .pg-stat b { font-family:var(--p-display); font-weight:800; font-size:26px; letter-spacing:-.02em; color:var(--p-ink); line-height:1; }
#ps-pageRoot .pg-stat span { font-family:var(--p-label); font-size:9px; letter-spacing:.14em; color:var(--p-ink2); text-transform:uppercase; margin-top:4px; }
#ps-pageRoot .pg-body { padding:8px 44px 44px; display:flex; flex-direction:column; gap:30px; }
#ps-pageRoot .pg-sec-t { font-family:var(--p-label); font-size:11px; font-weight:700; letter-spacing:.18em; color:var(--p-ink2); text-transform:uppercase; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid var(--p-line); }
#ps-pageRoot .pg-bio { font-family:var(--p-body); font-size:16px; line-height:1.65; color:var(--p-ink); max-width:620px; outline:none; }
#ps-pageRoot[data-layout="poster"] .pg-bio { font-size:19px; }
#ps-pageRoot .pg-rows { display:flex; flex-direction:column; gap:2px; }
#ps-pageRoot .pg-row { display:flex; align-items:center; gap:15px; padding:13px 14px; border-radius:var(--p-radius); transition:background .15s; }
#ps-pageRoot .pg-row:hover { background:var(--p-surface); }
#ps-pageRoot .pg-row-n { font-family:var(--p-label); font-size:12px; color:var(--p-ink2); width:18px; }
#ps-pageRoot .pg-play { color:var(--p-accent); font-size:12px; }
#ps-pageRoot .pg-row-main { flex:1; display:flex; flex-direction:column; gap:3px; }
#ps-pageRoot .pg-row-main b { font-family:var(--p-display); font-weight:600; font-size:16px; color:var(--p-ink); letter-spacing:-.01em; }
#ps-pageRoot .pg-row-main small { font-family:var(--p-label); font-size:10px; color:var(--p-ink2); letter-spacing:.04em; }
#ps-pageRoot .pg-hype { font-family:var(--p-label); font-size:10px; font-weight:700; letter-spacing:.06em; color:var(--p-accent2); border:1px solid color-mix(in srgb, var(--p-accent2) 40%, transparent); padding:6px 11px; border-radius:99px; }
#ps-pageRoot .pg-cards { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
#ps-pageRoot[data-layout="gallery"] .pg-cards { grid-template-columns:repeat(3,1fr); }
#ps-pageRoot[data-layout="poster"] .pg-cards { grid-template-columns:1fr; }
#ps-pageRoot .pg-card { background:var(--p-surface); border:1px solid var(--p-line); border-radius:var(--p-radius); padding:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
#ps-pageRoot .pg-card.plain { background:transparent; }
#ps-pageRoot .pg-card-b b { font-family:var(--p-display); font-weight:700; font-size:16px; color:var(--p-ink); letter-spacing:-.01em; display:block; }
#ps-pageRoot .pg-card-b small { font-family:var(--p-label); font-size:10px; color:var(--p-ink2); letter-spacing:.03em; margin-top:4px; display:block; }
#ps-pageRoot .pg-chip { font-family:var(--p-label); font-size:9px; font-weight:700; letter-spacing:.1em; color:var(--p-bg); background:var(--p-accent); padding:5px 10px; border-radius:99px; text-transform:uppercase; flex-shrink:0; }
#ps-pageRoot .pg-foot { font-family:var(--p-label); font-size:10px; color:var(--p-ink2); letter-spacing:.08em; padding-top:18px; border-top:1px solid var(--p-line); text-align:center; }
#ps-pageRoot .pg-foot b { color:var(--p-accent); }
.ps-stage[data-device="mobile"] #ps-pageRoot .pg-hero-inner { padding:48px 22px 30px; }
.ps-stage[data-device="mobile"] #ps-pageRoot .pg-name { font-size:42px !important; }
.ps-stage[data-device="mobile"] #ps-pageRoot .pg-tagline { font-size:17px; }
.ps-stage[data-device="mobile"] #ps-pageRoot .pg-body { padding:8px 22px 34px; }
.ps-stage[data-device="mobile"] #ps-pageRoot .pg-cards { grid-template-columns:1fr !important; }
`;

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&display=swap';

export default function ViewPageStudio({ data }: { data?: WorkbenchData } = {}) {
  const [role, setRole] = useState<Role>(() => {
    if (data?.activeProfileTypes?.includes('ARTIST')) return 'artist';
    if (data?.activeProfileTypes?.includes('VENUE')) return 'venue';
    return 'fan';
  });
  const [device, setDevice] = useState<Device>('desktop');
  const [theme, setTheme] = useState<Theme | null>(null);
  const [directions, setDirections] = useState<Theme[]>([]);
  const [vibe, setVibe] = useState('');
  const [refineText, setRefineText] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState('');
  const [urlName, setUrlName] = useState('you');
  const [publishLabel, setPublishLabel] = useState('Publish page');
  const [heroImageUrl, setHeroImageUrl] = useState('');

  const contentRef = useRef<Content>(makeContent('artist'));
  const pageRootRef = useRef<HTMLDivElement>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* inject styles + fonts once */
  useEffect(() => {
    if (!document.getElementById('ps-styles')) {
      const s = document.createElement('style');
      s.id = 'ps-styles';
      s.textContent = STYLES;
      document.head.appendChild(s);
    }
    if (!document.getElementById('ps-fonts')) {
      const l = document.createElement('link');
      l.id = 'ps-fonts';
      l.rel = 'stylesheet';
      l.href = FONT_HREF;
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
  }, []);

  const flashThinking = useCallback((msg: string) => {
    setThinking(msg);
    if (thinkTimer.current) clearTimeout(thinkTimer.current);
    thinkTimer.current = setTimeout(() => setThinking(''), 3400);
  }, []);

  /* apply a theme: set CSS vars, render preview HTML, wire inline edits */
  const applyTheme = useCallback((t: Theme) => {
    const content = contentRef.current;
    if (t.tagline) content.tagline = t.tagline;
    if (t.bio) content.bio = t.bio;
    setTheme(t);

    const root = pageRootRef.current;
    const scroll = pageScrollRef.current;
    if (!root || !scroll) return;
    const p = t.palette;
    const f = FONTS[t.font] || FONTS.editorial;
    // heroUrl is always a blob: URL from URL.createObjectURL — applied via CSS var, never innerHTML
    const safeHeroUrl = t.heroUrl?.startsWith('blob:') ? t.heroUrl : '';
    const map: Record<string, string> = {
      '--p-bg': p.bg, '--p-surface': p.surface, '--p-line': p.line, '--p-ink': p.ink,
      '--p-ink2': p.ink2, '--p-accent': p.accent, '--p-accent2': p.accent2,
      '--p-display': f.display, '--p-body': f.body, '--p-label': f.label, '--p-serif': f.accent,
      '--p-dweight': String(f.dWeight), '--p-tight': f.tight,
      '--p-radius': (t.radius != null ? t.radius : 16) + 'px',
      '--p-hero-url': safeHeroUrl ? `url(${safeHeroUrl})` : 'none',
    };
    for (const k in map) root.style.setProperty(k, map[k]);
    root.dataset.mood = t.mood || 'dark';
    root.dataset.layout = t.layout || 'spotlight';

    scroll.innerHTML = renderPreviewHTML(content, t);
    setUrlName(content.name.trim().toLowerCase().replace(/\s+/g, '') || 'you');

    scroll.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
      const single = el.dataset.edit !== 'bio';
      el.addEventListener('blur', () => {
        const k = el.dataset.edit;
        const v = (el.textContent || '').trim();
        if (k === 'name') {
          content.name = v;
          setUrlName(v.toLowerCase().replace(/\s+/g, '') || 'you');
        } else if (k === 'tagline') content.tagline = v;
        else if (k === 'bio') content.bio = v;
      });
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && single) {
          e.preventDefault();
          el.blur();
        }
      });
    });
  }, []);

  const generate = useCallback(
    (promptText?: string) => {
      if (busy) return;
      const content = contentRef.current;
      const v = (promptText || vibe || content.defaultVibe).trim();
      setBusy(true);
      const dirs = fallbackDirections(v, role).slice(0, 3);
      setDirections(dirs);
      applyTheme(dirs[0]);
      setBusy(false);
      flashThinking(`Built 3 directions from "${v.length > 38 ? v.slice(0, 38) + '…' : v}". Tap to compare.`);
    },
    [busy, vibe, role, applyTheme, flashThinking],
  );

  const refine = useCallback(
    (instruction: string) => {
      if (busy || !theme) return;
      setBusy(true);
      const next = heuristicRefine(instruction, theme, contentRef.current);
      applyTheme(next);
      setBusy(false);
      flashThinking(`Updated: "${instruction}".`);
    },
    [busy, theme, applyTheme, flashThinking],
  );

  const changeRole = useCallback(
    (r: Role) => {
      if (r === role) return;
      setRole(r);
      contentRef.current = makeContent(r);
      setVibe('');
      setTheme(null);
      setDirections([]);
      setUrlName('you');
      if (pageScrollRef.current) pageScrollRef.current.innerHTML = '';
    },
    [role],
  );

  const onPublish = useCallback(() => {
    if (!theme) return;
    flashThinking('Page published to ihype.fm/' + contentRef.current.name.toLowerCase().replace(/\s+/g, '') + ' ✓');
    setPublishLabel('✓ Published');
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(() => setPublishLabel('Publish page'), 2600);
  }, [theme, flashThinking]);

  const applyPalette = (pr: [string, string]) => {
    if (!theme) return;
    const t = clone(theme);
    t.palette.accent = pr[0];
    t.palette.accent2 = pr[1];
    t.name = 'Custom';
    applyTheme(t);
  };
  const applyFont = (f: FontKey) => {
    if (!theme) return;
    const t = clone(theme);
    t.font = f;
    applyTheme(t);
  };
  const applyLayout = (l: LayoutKey) => {
    if (!theme) return;
    const t = clone(theme);
    t.layout = l;
    applyTheme(t);
  };
  const applyMood = (m: MoodKey) => {
    if (!theme) return;
    applyTheme(heuristicRefine(m === 'light' ? 'light' : 'dark', theme, contentRef.current));
  };

  const applyLook = useCallback((lk: Look) => {
    if (!theme) return;
    applyTheme({ ...theme, palette: lk.palette, mood: lk.mood, font: lk.font, layout: lk.layout, name: lk.name });
  }, [theme, applyTheme]);

  const CHAT_SUGGESTIONS: Record<Role, string[]> = {
    artist: ['Make it punk', 'Darker & moodier', 'Purple accent', 'Add cosmic space vibes', 'More lo-fi bedroom', 'Bold & aggressive'],
    venue: ['Industrial warehouse feel', 'Warmer & intimate', 'Add neon nightclub energy', 'More minimal & clean', 'Gritty & underground', 'Elegant & upscale'],
    promoter: ['Underground techno', 'Darker & edgier', 'Neon club energy', 'Bold & loud', 'Minimal & sleek', 'Warm & intimate'],
    fan: ['Make it more personal', 'Add girly pop energy', 'Darker & moody', 'Bright & colorful', 'Vintage & retro', 'Minimalist'],
  };

  const ROLE_KEYS: Role[] = ['artist', 'venue', 'promoter', 'fan'];

  return (
    <div className="ps-app">
      {/* LEFT PANEL */}
      <aside className="ps-panel">
        <div className="ps-pn ps-hero-prompt">
          <div className="ps-eyebrow"><span className="ps-num">1</span>DESCRIBE YOUR VIBE</div>
          <h2>No design skills? <span className="ps-grad">Good.</span></h2>
          <p>Just tell us the feeling in plain words. The AI builds the whole page — colors, type, layout, even your bio. Tweak after.</p>
          <div className="ps-vibe-box">
            <textarea
              value={vibe}
              placeholder={`e.g. "${ROLES[role].defaultVibe}"`}
              onChange={(e) => setVibe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  generate();
                }
              }}
            />
          </div>
          <div className="ps-chips">
            {CHIPS[role].map((c) => (
              <button key={c} className="ps-chip" onClick={() => { setVibe(c); generate(c); }}>
                {c}
              </button>
            ))}
          </div>
          <div className="ps-gen-row">
            <button className={'ps-gen-btn' + (busy ? ' busy' : '')} onClick={() => generate()}>
              {busy ? 'Generating…' : '✨ Generate my page'}
            </button>
            <button className="ps-surprise" title="Surprise me" onClick={() => { const picks = CHIPS[role]; const p = picks[Math.floor(Math.random() * picks.length)]; setVibe(p); generate(p); }}>
              {'🎲'}
            </button>
          </div>
        </div>

        {directions.length > 0 && (
          <div className="ps-pn">
            <div className="ps-title">Pick a direction <span>AI · 3 OPTIONS</span></div>
            <div className="ps-dirs">
              {directions.map((d, i) => {
                const p = d.palette;
                const active = theme != null && theme.name === d.name;
                return (
                  <button key={d.name + i} className={'ps-dir' + (active ? ' on' : '')} onClick={() => applyTheme(directions[i])}>
                    <div className="ps-dir-prev" style={{ background: p.bg }}>
                      <div className="ps-dir-bar" style={{ background: p.accent }} />
                      <div className="ps-dir-dot" style={{ background: p.accent2 }} />
                      <div className="ps-dir-lines">
                        <i style={{ background: p.ink }} />
                        <i style={{ background: p.ink2 }} />
                      </div>
                    </div>
                    <div className="ps-dir-meta">
                      <b>{d.name}</b>
                      <span>{FONTS[d.font].name} · {d.layout}</span>
                    </div>
                    {active && <span className="ps-dir-on">● LIVE</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="ps-pn">
          <div className="ps-eyebrow"><span className="ps-num">2</span>MAKE IT YOURS · JUST ASK</div>
          <div className="ps-refine-box">
            <input
              value={refineText}
              placeholder={'"make it darker and bolder"'}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && refineText.trim()) {
                  refine(refineText.trim());
                  setRefineText('');
                }
              }}
            />
            <button className="ps-refine-btn" title="Apply" onClick={() => { const v = refineText.trim(); if (v) { refine(v); setRefineText(''); } }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div className="ps-chips" style={{ marginTop: 9 }}>
            {CHAT_SUGGESTIONS[role].map((s) => (
              <button key={s} className="ps-chip" onClick={() => { refine(s); }}>
                {s}
              </button>
            ))}
          </div>
          <div className="ps-refine-hint" style={{ marginTop: 7 }}>
            You can also edit the name, tagline, and bio right on the page.
          </div>
        </div>

        <div className="ps-pn">
          <div className="ps-eyebrow">FINE-TUNE <span style={{ color: 'var(--ink4)' }}>· OPTIONAL</span></div>
          <div className="ps-ctl">
            <div className="ps-ctl-l">ACCENT PALETTE</div>
            <div className="ps-pal-row">
              {PALETTES.map((pr, i) => (
                <button key={i} className="ps-pal" title="palette" onClick={() => applyPalette(pr)}>
                  <span style={{ background: pr[0] }} /><span style={{ background: pr[1] }} />
                </button>
              ))}
            </div>
          </div>
          <div className="ps-ctl">
            <div className="ps-ctl-l">TYPEFACE</div>
            <div className="ps-seg2-row">
              {(Object.keys(FONTS) as FontKey[]).map((k) => (
                <button key={k} className={'ps-seg2' + (theme && theme.font === k ? ' on' : '')} onClick={() => applyFont(k)}>
                  {FONTS[k].name}
                </button>
              ))}
            </div>
          </div>
          <div className="ps-ctl">
            <div className="ps-ctl-l">LAYOUT</div>
            <div className="ps-seg2-row">
              {LAYOUTS.map((k) => (
                <button key={k} className={'ps-seg2' + (theme && theme.layout === k ? ' on' : '')} onClick={() => applyLayout(k)}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="ps-ctl">
            <div className="ps-ctl-l">SCHEMA</div>
            <div className="ps-seg2-row" style={{ flexWrap: 'wrap', gap: 4 }}>
              {LOOKS.map((lk) => (
                <button key={lk.id} className={'ps-seg2' + (theme && theme.name === lk.name ? ' on' : '')}
                  onClick={() => {
                    if (theme) applyLook(lk);
                    else { setVibe(lk.kw[0]); generate(lk.kw[0]); }
                  }}
                  title={lk.kw.slice(0, 3).join(', ')}
                >
                  {lk.name}
                </button>
              ))}
            </div>
          </div>
          <div className="ps-ctl">
            <div className="ps-ctl-l">HERO IMAGE <span style={{ color: 'var(--ink4)', fontSize: 10 }}> · no copyright use</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px dashed var(--line2)', borderRadius: 8, padding: '10px',
                cursor: 'pointer', fontSize: 12, color: 'var(--ink3)', fontFamily: 'var(--f-label)',
                letterSpacing: '.1em', gap: 6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                UPLOAD IMAGE
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = URL.createObjectURL(f);
                  setHeroImageUrl(url);
                  if (theme) applyTheme({ ...theme, heroUrl: url });
                }} />
              </label>
              {heroImageUrl && (
                <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', height: 60 }}>
                  <img src={heroImageUrl} alt="hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => { setHeroImageUrl(''); if (theme) applyTheme({ ...theme, heroUrl: undefined }); }}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', color: '#fff', borderRadius: 99, width: 20, height: 20, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--ink4)', fontFamily: 'var(--f-label)', letterSpacing: '.08em' }}>Only upload images you own or have rights to use.</div>
            </div>
          </div>
          <div className="ps-ctl" style={{ marginBottom: 0 }}>
            <div className="ps-ctl-l">MOOD</div>
            <div className="ps-seg2-row">
              {([['dark', 'Dark'], ['light', 'Light']] as [MoodKey, string][]).map(([k, l]) => (
                <button key={k} className={'ps-seg2' + (theme && theme.mood === k ? ' on' : '')} onClick={() => applyMood(k)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ps-foot">
          <button className="ps-publish-btn" onClick={onPublish}>{publishLabel}</button>
          <small>Free on every iHYPE account · ihype.fm/you</small>
        </div>
      </aside>

      {/* RIGHT STAGE */}
      <main className={'ps-stage' + (busy ? ' generating' : '')} data-device={device}>
        <div className="ps-stage-bar">
          <div className="ps-url"><span className="ps-lock">{'🔒'}</span> ihype.fm/<b>{urlName}</b></div>
          <div className="ps-vibe-name">
            <div className="ps-device-seg">
              <button className={'ps-seg' + (device === 'desktop' ? ' on' : '')} onClick={() => setDevice('desktop')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>Desktop
              </button>
              <button className={'ps-seg' + (device === 'mobile' ? ' on' : '')} onClick={() => setDevice('mobile')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M11 18h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>Mobile
              </button>
            </div>
            THEME · <b>{theme ? theme.name : '—'}</b>
          </div>
        </div>

        <div className="ps-viewport">
          <div id="ps-pageRoot" ref={pageRootRef} data-mood="dark" data-layout="spotlight">
            <div className="ps-pageScroll" ref={pageScrollRef} style={{ display: theme ? 'block' : 'none' }} />
            {!theme && (
              <div className="ps-empty">
                <div className="ps-spark">{'✦'}</div>
                <h3>Let&apos;s build your page</h3>
                <p>You&apos;re a <b>{ROLES[role].label.toLowerCase()}</b> with great taste and zero interest in fiddling with fonts. Describe a vibe on the left and watch a cool page appear here in seconds.</p>
                <div className="ps-hintline">START WITH A VIBE</div>
              </div>
            )}
          </div>
        </div>

        <div className={'ps-thinking' + (thinking ? ' show' : '')}>{thinking}</div>
      </main>
    </div>
  );
}
