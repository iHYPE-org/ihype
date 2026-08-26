'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayIntent } from '@/components/mmm/MmmPlayIntent';
import { useRegisteredStations } from '@/components/mmm/MmmStations';
import { MMM_NAV, isMmmDetailPath, moduleForPath, stationsForPath } from '@/lib/mmm-nav';

/* Where the nameplate's memory lives across a document load. Session-scoped on
   purpose: "the page you came from" is a property of this visit, and a value
   restored a week later would send someone somewhere they have forgotten. */
const LAST_MAIN_KEY = 'ihype_mmm_last_main';

/** The remembered main-nav path, or null. Validated, never trusted verbatim:
 *  this is client-writable storage, so a poisoned value must not become a
 *  navigation target. It has to be an MMM main-nav path — inside the shell and
 *  not itself a detail path, which would defeat the whole point. */
function readLastMainPath(): string | null {
  try {
    const stored = sessionStorage.getItem(LAST_MAIN_KEY);
    if (!stored || !stored.startsWith('/app/') || isMmmDetailPath(stored)) return null;
    return stored;
  } catch {
    return null;
  }
}

/**
 * The console dock — the whole of the app's navigation, as the design system
 * itself builds it at production scale.
 *
 * Translated from `design/handoff-console/reference/console-dock/Console
 * Dock.dc.html` (2026-08-24, owner: "I want the design console view. Make it
 * work"). That file is the authority on this hardware: it hand-draws the dock
 * at exactly K=74 — walnut cabinet, brushed plate, a bakelite/brass knob that
 * TURNS continuously, a backlit meter dial whose stations ride a rotating
 * compass card past a tapered needle, a thumbstick in a round recessed gate,
 * an iHYPE nameplate straddling the brass lip as HOME, and one pointer-driven
 * light shared by every surface. The specimen-scale JSX components that
 * shipped alongside it do not survive contact with 74px (see
 * `UPSTREAM_FIXES.md`), which is why this file follows the dc.html and not
 * `src/components/ds/`.
 *
 * ## The split the dc.html itself prescribes
 *
 * "The dock is drawn once per scale and then only its live values are
 * written." Everything static is CSS in `mmm.css` (`.mmm-dock-*`,
 * `.mmm-knob-*`, `.mmm-dial-*`, `.mmm-stick-*`); this component owns only the
 * LIVE values — rotation, drum position, tilt, speculars, the lamp's boot
 * strike — and writes them straight to the DOM through refs. Light position is
 * deliberately not React state: it changes on every pointer move, and routing
 * that through a render would rebuild the whole dock at pointer frequency.
 *
 * ## What is wired (all of it pre-existing, none of it changed)
 *
 *  - The knob commits a module at each detent crossing → `navigate()`.
 *  - The dial tunes the REGISTERED stations when a page registered its own
 *    (see MmmStations.tsx), else the module's route set → `select()`.
 *  - The stick: tap = the universal transport (pause → surface intent → radio
 *    on, see MmmPlayIntent.tsx), throws = prev / next / expand / collapse.
 *  - The nameplate is the way back: from a detail page it returns you to the
 *    main-nav page you came from, else it re-seats MAP.
 *  - `playing` lights the pilot bead and the stick's lamp ring.
 *
 * ## Two additions the dc.html does not draw, both deliberate
 *
 * The dial's step affordances ("Previous station" / "Next station") — a
 * drag-only dial is unreachable by keyboard and untestable by Playwright, and
 * the centre station is a real focusable tab for the same reason. And the
 * nameplate's type takes the tracked-mono legend treatment instead of the
 * dc.html's 9px display face, because 9px content fails this codebase's own
 * type floor.
 */

const KNOB_ANGLES = [-50, 0, 50];
/** Thumb travel per knob detent, px — wide enough that a tap never reads as a turn. */
const KNOB_TRAVEL = 32;
/** Thumb travel per dial detent, px. The dc.html's figure is 46 — one major
 *  tick of the card per 46px of finger — but driven on a real screen that
 *  tuned away on incidental drags (owner, 2026-08-24: "Make the subnav
 *  switcher a little less sensitive"). 64 keeps the same card geometry and
 *  just lowers the gearing: more finger per station. */
const DIAL_DETENT = 64;
/** The card the ticks and the station labels both ride: centre 420px below the window. */
const CARD_R = 420;
/** Horizontal pitch between neighbouring station labels at the window, px. */
const LABEL_PITCH = 82;
/** Angular pitch of the major ticks — 46px of tape at R=420 expressed in degrees. */
const STEP_DEG = 6.2762;
/** Stick travel before a throw registers, px. */
const STICK_THROW = 18;

type Spring = { raf: number };

export function MmmDock({
  canTogglePlay,
  layer,
  onCollapse,
  onExpand,
  onNext,
  onPlayFallback,
  onPrev,
  onTogglePlay,
  pathname,
  playing,
}: {
  canTogglePlay: boolean;
  /** The map's own `?layer=`, which is what the dial tunes on MAP. */
  layer: string | null;
  onCollapse: () => void;
  onExpand: () => void;
  onNext: () => void;
  /** Turn the radio on: the last resort when the surface offers nothing. */
  onPlayFallback: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  pathname: string;
  playing: boolean;
}) {
  const router = useRouter();
  const activeModule = moduleForPath(pathname);
  const moduleIdx = Math.max(0, MMM_NAV.findIndex((module) => module.id === activeModule));

  /* A tap always does something, in this order: pause what is playing, start
     what this surface offers, or turn the radio on — the universal transport
     (DESIGN_SYNC row 289; MmmPlayIntent.tsx has the full story). */
  const playIntent = usePlayIntent();
  const togglePlay = canTogglePlay ? onTogglePlay : (playIntent ?? onPlayFallback);
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  const registered = useRegisteredStations();
  const fallback = stationsForPath(pathname, { layer });
  const stations = registered?.stations ?? fallback.stations;
  const active = registered?.active ?? fallback.active;
  const label = registered?.label
    ?? `Sections in ${MMM_NAV.find((module) => module.id === activeModule)!.label}`;
  const activeIdx = Math.max(0, stations.findIndex((station) => station.id === active));

  /* `select` is defined above `navigate` but only CALLS it on a tap, so the
     hop through a ref keeps the declaration order legal. */
  const navigateRef = useRef<(href: string) => void>(() => {});

  const select = useCallback((id: string) => {
    if (registered) {
      registered.onChange(id);
      return;
    }
    /* `push`, not `replace`: these are destinations, and Back should walk them.
       The needle is re-homed from the URL on arrival, so Back moves the dial
       too rather than leaving it lying about where you are. */
    const href = fallback.stations.find((station) => station.id === id)?.href;
    if (href) navigateRef.current(href);
  }, [fallback.stations, registered]);
  const selectRef = useRef(select);
  selectRef.current = select;
  const stationsRef = useRef(stations);
  stationsRef.current = stations;

  /* ── refs to every live-written node ─────────────────────────────────── */
  const barRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const knobAoRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const backlightRef = useRef<HTMLDivElement>(null);
  const spillRef = useRef<HTMLDivElement>(null);
  const wlRef = useRef<HTMLDivElement>(null);
  const stationRef = useRef<HTMLButtonElement>(null);
  const wrRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLButtonElement>(null);
  const stickShadowRef = useRef<HTMLDivElement>(null);
  const stickAoRef = useRef<HTMLDivElement>(null);

  /* ── live state, none of it React state ──────────────────────────────── */
  const knobPos = useRef(moduleIdx);
  const knobDragging = useRef(false);
  const committedMod = useRef(moduleIdx);
  const pos = useRef(activeIdx);
  const dialDragging = useRef(false);
  const committedStation = useRef(activeIdx);
  const tilt = useRef({ x: 0, y: 0 });
  const pressed = useRef(false);
  /* Press state only. The dock carried a shared LIGHT until 2026-08-25 —
     pointer- and tilt-driven speculars on the knob, dial glass and stick cap.
     The owner retired the reflections ("Remove reflective element from
     console"), and with them went the only reader of a light POSITION, so the
     x/y, the pointer tracking and the orientation stream are all gone. What
     remains is occlusion: pressing a control tightens its contact shadow. */
  const light = useRef({ pressed: false, sp: false });
  const springs = useRef<Record<string, Spring>>({});
  const audio = useRef<AudioContext | null>(null);
  const booting = useRef(false);
  const dipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reduced = useRef(false);

  /* ── mechanics: springs, coast, haptics, synthesized clicks ──────────── */
  const cancelSpring = useCallback((id: string) => {
    const s = springs.current[id];
    if (s) cancelAnimationFrame(s.raf);
    delete springs.current[id];
  }, []);

  /* Semi-implicit Euler spring, damped below critical on purpose — the
     overshoot IS the realism. A tween decelerates into place; mass arrives
     with momentum and gets caught by the notch. */
  const springVal = useCallback((
    id: string, x0: number, target: number, v0: number,
    step: (x: number, done: boolean) => void, stiff: number, damp: number,
  ) => {
    cancelSpring(id);
    if (reduced.current) { step(target, true); return; }
    let x = x0, v = v0 || 0, t = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - t) / 1000); t = now;
      v += (-stiff * (x - target) - damp * v) * dt;
      x += v * dt;
      if (Math.abs(x - target) < 0.0015 && Math.abs(v) < 0.01) { delete springs.current[id]; step(target, true); return; }
      step(x, false);
      springs.current[id] = { raf: requestAnimationFrame(tick) };
    };
    springs.current[id] = { raf: requestAnimationFrame(tick) };
  }, [cancelSpring]);

  /* Synthesized mechanics, not samples: a damped sine for the body plus a
     20ms bandpassed noise burst for the metallic edge. Kept very quiet —
     hardware you hear ABOVE the music is broken hardware. */
  const click = useCallback((kind: 'tick' | 'press' | 'gate' | 'seat') => {
    const C = audio.current;
    if (!C || C.state !== 'running') return;
    const t = C.currentTime;
    const o = C.createOscillator(), g = C.createGain();
    o.frequency.value = kind === 'seat' ? 180 : kind === 'gate' ? 250 : kind === 'press' ? 320 : 640;
    g.gain.setValueAtTime(kind === 'tick' ? 0.022 : 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + (kind === 'tick' ? 0.028 : 0.07));
    o.connect(g).connect(C.destination);
    o.start(t); o.stop(t + 0.09);
    const len = Math.floor(C.sampleRate * 0.02);
    const buf = C.createBuffer(1, len, C.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = C.createBufferSource(); n.buffer = buf;
    const bp = C.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = kind === 'tick' ? 3600 : 1700; bp.Q.value = 1.2;
    const ng = C.createGain(); ng.gain.value = kind === 'tick' ? 0.04 : 0.09;
    n.connect(bp).connect(ng).connect(C.destination);
    n.start(t);
  }, []);

  /* Each haptic weight has a voice: 3-4ms detents tick, 6ms presses knock,
     8ms gates clack. The detent click still shares a rail with the lamps, so
     every tick pulls the backlight down ~18% for 70ms — skipped while the
     boot ramp owns the filter. */
  const buzz = useCallback((ms: number) => {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* no haptics */ }
    click(ms <= 4 ? 'tick' : ms <= 6 ? 'press' : 'gate');
    if (!booting.current && !reduced.current) {
      for (const n of [backlightRef.current, spillRef.current]) {
        if (n) n.style.filter = 'brightness(.82)';
      }
      clearTimeout(dipTimer.current);
      dipTimer.current = setTimeout(() => {
        for (const n of [backlightRef.current, spillRef.current]) if (n) n.style.filter = '';
      }, 70);
    }
  }, [click]);

  /* Browsers only allow audio to start inside a user gesture — every gesture
     here begins with a pointerdown, so the context wakes there. */
  const wakeAudio = useCallback(() => {
    try {
      if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext();
      if (audio.current?.state === 'suspended') void audio.current.resume();
    } catch { /* no audio */ }
  }, []);

  /* ── press occlusion ────────────────────────────────────────────────── */
  /**
   * Ambient occlusion is a function of how close two surfaces are, so pressing
   * a control into its seat darkens and TIGHTENS its shadow. That is all this
   * writes now.
   *
   * It used to paint three speculars from a shared light position, driven by
   * `pointermove` (120Hz on ProMotion) and `deviceorientation` (a steady 60Hz
   * whenever the page is open, even lying still). Coalescing it to one paint
   * per frame was what fixed the owner's "map dragging is jerky, same with
   * thumb wheel"; removing the reflections removes the streams themselves, so
   * the dock now paints only when something is actually pressed — a few writes
   * per interaction rather than a continuous load no desktop ever paid.
   */
  const paintLight = useCallback(() => {
    const L = light.current;
    if (knobAoRef.current) {
      knobAoRef.current.style.boxShadow = L.pressed
        ? 'inset 0 1.5px 2.5px rgba(18,10,2,.75), 0 1px 2px rgba(18,10,2,.6)'
        : 'inset 0 0.5px 1px rgba(18,10,2,.3), 0 3px 7px rgba(18,10,2,.38)';
    }
    if (knobRef.current) knobRef.current.style.transform = L.pressed ? 'translateY(0.75px)' : 'none';
    if (stickAoRef.current) {
      stickAoRef.current.style.boxShadow = L.sp ? 'inset 0 1.5px 2.5px rgba(18,10,2,.6)' : 'none';
    }
  }, []);

  /* ── the knob ────────────────────────────────────────────────────────── */
  const paintKnob = useCallback(() => {
    const n = MMM_NAV.length;
    const raw = Math.max(0, Math.min(n - 1, knobPos.current));
    const lo = Math.floor(raw), hi = Math.ceil(raw), t = raw - lo;
    const angle = KNOB_ANGLES[lo] + (KNOB_ANGLES[hi] - KNOB_ANGLES[lo]) * t;
    if (rotorRef.current) {
      rotorRef.current.style.transition = knobDragging.current ? 'none' : 'transform var(--duration-medium) var(--ease-spring)';
      rotorRef.current.style.transform = 'rotate(' + angle + 'deg)';
    }
    const mod = MMM_NAV[committedMod.current];
    if (readoutRef.current && mod) readoutRef.current.textContent = mod.label.toUpperCase();
    if (knobRef.current && mod) {
      knobRef.current.setAttribute('aria-label', 'Module: ' + mod.label + '. Tap for the next, or drag to choose.');
    }
  }, []);

  /**
   * Navigate, and MEAN it.
   *
   * `router.push` is the fast path and stays the normal one. But on every
   * `/app` DETAIL route (`/app/artists/…`, `/app/tracks/…`, a show, a
   * playlist) a soft push does not commit: measured on the production bundle
   * 2026-08-25 — the handler runs, the knob's readout and rotor move, the
   * destination's RSC payload fetches 200, and `history.pushState` is never
   * called, with no error thrown. Root cause is still open (recorded in
   * DESIGN_SYNC row 309); what is NOT acceptable meanwhile is the symptom the
   * owner reported as "Moving between map music me didn't work", because this
   * dock is the app's ONLY navigation — a member on a profile page had no way
   * out of it at all.
   *
   * So the push is given a moment to land and, if the URL has not moved, the
   * dock falls back to a hard navigation. The poll is what keeps this honest
   * on a slow connection: a soft nav that simply takes a while cancels the
   * fallback the instant it commits, so the reload only ever happens when the
   * transition genuinely never arrives.
   */
  const navigate = useCallback((href: string) => {
    router.push(href);
    if (typeof window === 'undefined') return;
    const target = new URL(href, window.location.origin).pathname;
    if (window.location.pathname === target) return;
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (window.location.pathname === target) { window.clearInterval(poll); return; }
      if (Date.now() - started < 1500) return;
      window.clearInterval(poll);
      window.location.assign(href);
    }, 120);
  }, [router]);
  navigateRef.current = navigate;

  const goModule = useCallback((idx: number) => {
    const n = MMM_NAV.length;
    const next = Math.max(0, Math.min(n - 1, idx));
    if (next === committedMod.current) return;
    committedMod.current = next;
    buzz(4);
    paintKnob();
    navigate(MMM_NAV[next].href);
  }, [buzz, navigate, paintKnob]);

  /**
   * The last MAIN-NAV path the member stood on — a module destination, not a
   * detail page. This is what the nameplate returns them to (owner,
   * 2026-08-25: "IHYPE name badge, when pressed, should take you to the last
   * main nav page (MAP · MUSIC · ME) in case you're buried in some sub menu and
   * are lost"). Recorded rather than derived, because a detail path cannot be
   * asked which module it was reached from: `/app/artists/x` reports as MAP
   * whether you arrived from the chart, the map or a search result.
   */
  const lastMainPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || isMmmDetailPath(pathname)) return;
    lastMainPath.current = pathname;
    /* Mirrored into sessionStorage, and this is not belt-and-braces: a REF
       cannot survive a document load, and this dock provokes one. `navigate()`
       gives a soft push 1.5s and then hard-assigns (row 309's open bug), so the
       common path into a detail page is a full reload — which remounts the dock,
       resets the ref to null, and then runs this effect on a path that IS a
       detail path, so nothing is recorded. The nameplate then read null and fell
       through to MAP every single time. Reported as "should take you back to the
       last main nav point … not always map" AFTER the feature shipped: the
       feature was right and its memory was being wiped underneath it. Also fixes
       a cold entry — a shared link or a refresh on a detail page. */
    try { sessionStorage.setItem(LAST_MAIN_KEY, pathname); } catch { /* private mode */ }
  }, [pathname]);

  /**
   * Navigate to an explicit path and re-seat the knob on whatever module owns
   * it. `goModule` cannot do this job for two reasons: it only knows a
   * module's DEFAULT href (so it cannot return you to the MUSIC tab you were
   * actually on), and it early-returns when the target module is already the
   * committed one — which is why the nameplate was DEAD on every detail page.
   * `/app/artists/x` resolves to MAP, so the badge called `goModule(0)` with
   * MAP already committed, hit that guard and navigated nowhere. The one
   * control whose whole purpose is "get me out of here" did nothing precisely
   * when a member was lost.
   */
  const goPath = useCallback((href: string) => {
    const idx = Math.max(0, MMM_NAV.findIndex((module) => module.id === moduleForPath(href)));
    committedMod.current = idx;
    knobPos.current = idx;
    buzz(6);
    paintKnob();
    navigate(href);
  }, [buzz, navigate, paintKnob]);

  /* Buried → back to the main-nav page you came from. Already at main-nav
     level → the plate keeps its documented HOME meaning and re-seats MAP. */
  const goNameplate = useCallback(() => {
    const remembered = lastMainPath.current ?? readLastMainPath();
    if (isMmmDetailPath(pathname) && remembered) {
      goPath(remembered);
      return;
    }
    goPath(MMM_NAV[0].href);
  }, [goPath, pathname]);

  /* ── the dial ────────────────────────────────────────────────────────── */
  /**
   * Shrink a resting label to its window. MUSIC's longest station is guarded
   * by measure:dock, but a PROFILE hands the dial its own section names and
   * "Event Calendar" at the resting 26px is wider than the drum — clipped on
   * a real phone (owner screenshot, 2026-08-24). Measured on a CANVAS, never
   * the DOM: paintDial runs at pointer frequency and reading scrollWidth
   * there would force a layout per frame. Cached per (label, rest, width);
   * the 15px content floor still holds — a name that cannot fit at 15px keeps
   * 15px rather than dropping below what a person can read.
   */
  const fitCanvas = useRef<CanvasRenderingContext2D | null>(null);
  const fitCache = useRef<Map<string, number>>(new Map());
  /* The drum's measured geometry — resting size, window width, type face —
     CACHED here and refreshed on mount and resize, never read inside
     paintDial: getComputedStyle and clientWidth both force style/layout work,
     and paintDial runs once per pointer frame. (The resting size was being
     re-read per frame before this too; the cache fixes both.) */
  const dialGeom = useRef({ rest: 26, maxW: 0, family: '', weight: '400' });
  const measureDialGeom = useCallback(() => {
    const row = stationRef.current?.parentElement;
    if (!row) return;
    dialGeom.current = {
      rest: parseFloat(getComputedStyle(row).getPropertyValue('--mmm-drum-rest')) || 26,
      /* The window the label must fit, with 6px of breathing room each side —
         the same span `measure:dock`'s clip test uses. An earlier version
         subtracted 48 to clear the two step chevrons outright, which shrank a
         name that never actually clipped: the resting "Recommended" came back
         16px at 375 where 24 fits. The chevrons are low-contrast marks at the
         extreme ends; a long name reaching past them is what a real tuner
         looks like, and legibility of the primary readout wins. */
      maxW: row.clientWidth - 12,
      /* The label's REAL face and weight, read off the element. Composing the
         canvas font with an assumed `600` measured Bricolage wider than it
         renders and shrank the readout a step further than needed. */
      family: stationRef.current ? getComputedStyle(stationRef.current).fontFamily : '',
      weight: stationRef.current ? getComputedStyle(stationRef.current).fontWeight || '400' : '400',
    };
    fitCache.current.clear();
  }, []);
  const fittedRest = useCallback((label: string, rest: number, maxW: number, family: string, weight: string) => {
    const key = `${label}|${rest}|${maxW}|${weight}|${family}`;
    const cached = fitCache.current.get(key);
    if (cached !== undefined) return cached;
    if (!fitCanvas.current) fitCanvas.current = document.createElement('canvas').getContext('2d');
    const ctx = fitCanvas.current;
    let fitted = rest;
    if (ctx && maxW > 0) {
      ctx.font = `${weight || '400'} ${rest}px ${family || 'sans-serif'}`;
      const width = ctx.measureText(label).width;
      if (width > maxW) fitted = Math.max(15, Math.floor(rest * (maxW / width)));
    }
    fitCache.current.set(key, fitted);
    return fitted;
  }, []);

  const paintDial = useCallback(() => {
    const secs = stationsRef.current;
    const len = secs.length;
    if (!len) return;
    const p = pos.current;
    const near = Math.round(p);
    const frac = p - near;
    /* The resting type size comes from the stylesheet (`--mmm-drum-rest`), so
       the 375px step-down lives with the rest of the geometry — see the note
       on .mmm-dial-stations. */
    const { rest, maxW, family, weight } = dialGeom.current;
    const slots: [HTMLElement | null, number][] = [
      [wlRef.current, -1],
      [stationRef.current, 0],
      [wrRef.current, 1],
    ];
    for (const [node, slot] of slots) {
      if (!node) continue;
      /* One station has no neighbours to show; the same name on all three
         faces of the drum would read as a stutter. */
      if (slot !== 0 && len < 2) { node.style.opacity = '0'; continue; }
      const d = slot - frac;
      const ad = Math.min(1.5, Math.abs(d));
      const label = secs[((((near + slot) % len) + len) % len)]?.label ?? '';
      node.textContent = label;
      node.style.transition = dialDragging.current
        ? 'none'
        : 'transform var(--duration-medium) var(--ease-spring), opacity var(--duration-medium) var(--ease), font-size var(--duration-medium) var(--ease)';
      /* Size bottoms out at the 15px content floor, never below it: a resting
         neighbour is something you read. rem, so Settings → Text size reaches
         it. The resting size itself first shrinks to fit the window (see
         fittedRest) — a section name a page registered is not measured by any
         gate, and a clipped name is the failure the dial exists to prevent. */
      const restFit = fittedRest(label, rest, maxW, family, weight);
      node.style.fontSize = ((restFit - (restFit - 15) * Math.min(1, ad)) / 16).toFixed(4) + 'rem';
      node.style.opacity = String(Math.max(0, 1 - ad / 1.45));
      /* Compass drop: each label rides the same card as the ticks — sinking by
         the circle's sagitta and rolling tangent to it. */
      const xw = d * LABEL_PITCH;
      const th = xw / CARD_R;
      node.style.transform = 'translate(-50%,-50%) perspective(240px) translateX(' + xw + 'px) translateY('
        + (CARD_R * (1 - Math.cos(th))).toFixed(2) + 'px) rotate(' + ((th * 180) / Math.PI).toFixed(2)
        + 'deg) rotateY(' + d * 44 + 'deg)';
    }
    /* The card ROTATES; the offset is modulo one angular tick period, so the
       rose never runs out of scale. */
    const rot = 'rotate(' + (-((p * STEP_DEG) % STEP_DEG)).toFixed(4) + 'deg)';
    for (const card of [cardRef.current, card2Ref.current]) {
      if (!card) continue;
      card.style.transition = dialDragging.current ? 'none' : 'transform var(--duration-medium) var(--ease-spring)';
      card.style.transform = rot;
    }
  }, [fittedRest]);

  const setDialPos = useCallback((next: number, dragging: boolean) => {
    /* Every detent crossing is a physical event — and a navigation: the dial
       tunes THROUGH stations, so the station commits as the needle passes each
       detent, exactly as the vendored dial and the dc.html both behave. */
    const len = stationsRef.current.length;
    if (len) {
      const idx = ((Math.round(next) % len) + len) % len;
      if (idx !== committedStation.current) {
        committedStation.current = idx;
        buzz(3);
        const station = stationsRef.current[idx];
        if (station) selectRef.current(station.id);
      }
    }
    pos.current = next;
    dialDragging.current = dragging;
    paintDial();
  }, [buzz, paintDial]);

  /* Free coast under exponential friction, handed to the detent spring once a
     notch can catch it. Velocity is clamped — a wheel this size has a top
     speed, and an unbounded flick would spin the band into a blur. */
  const coastDial = useCallback((v0: number) => {
    cancelSpring('dial');
    if (reduced.current) { setDialPos(Math.round(pos.current), false); return; }
    let x = pos.current, v = Math.max(-12, Math.min(12, v0)), t = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - t) / 1000); t = now;
      v *= Math.exp(-2.6 * dt);
      x += v * dt;
      if (Math.abs(v) < 1.2) {
        springVal('dial', x, Math.round(x), v, (nx, done) => setDialPos(nx, !done), 120, 11);
        return;
      }
      setDialPos(x, true);
      springs.current.dial = { raf: requestAnimationFrame(tick) };
    };
    springs.current.dial = { raf: requestAnimationFrame(tick) };
  }, [cancelSpring, setDialPos, springVal]);

  /* A step tap, a wheel notch or an arrow key TURNS the wheel to the next
     detent on the same spring the finger's release uses — never a teleport.
     The teleport looked like no animation at all (owner, 2026-08-24: "Thumb
     wheel doesn't have any animation"), and the reason is geometric: the tick
     card's rotation is modulo one detent, so integer-to-integer is 0° to 0°,
     and the resting label swaps text in place. Only the frames BETWEEN detents
     move anything; the spring is what produces them. */
  const tuneTo = useCallback((target: number) => {
    cancelSpring('dial');
    springVal('dial', pos.current, target, 0, (x, done) => setDialPos(x, !done), 120, 11);
  }, [cancelSpring, setDialPos, springVal]);

  /* ── the stick ───────────────────────────────────────────────────────── */
  const paintStick = useCallback(() => {
    const { x, y } = tilt.current;
    if (stickRef.current) {
      stickRef.current.style.transform =
        'translate(' + x * 9 + 'px,' + -y * 9 + 'px) rotateX(' + -y * 20 + 'deg) rotateZ(' + x * 15 + 'deg) scale(' + (pressed.current ? 0.94 : 1) + ')';
    }
    if (stickShadowRef.current) {
      stickShadowRef.current.style.transform =
        'translate(' + x * 8 + 'px,' + -y * 3 + 'px) scale(' + (pressed.current ? 0.82 : 1) + ')';
      stickShadowRef.current.style.opacity = pressed.current ? '0.55' : '1';
    }
  }, []);

  const fireThrow = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (dir === 'left') onPrev();
    if (dir === 'right') onNext();
    if (dir === 'up') onExpand();
    if (dir === 'down') onCollapse();
  }, [onCollapse, onExpand, onNext, onPrev]);
  const fireRef = useRef(fireThrow);
  fireRef.current = fireThrow;

  /* ── prop → hardware syncing ─────────────────────────────────────────── */

  /* The URL is authoritative: Back moves the knob and the dial too, rather
     than leaving them lying about where you are. Skipped mid-gesture so the
     spring never fights the finger. */
  useEffect(() => {
    committedMod.current = moduleIdx;
    if (!knobDragging.current && !springs.current.knob) {
      knobPos.current = moduleIdx;
    }
    paintKnob();
  }, [moduleIdx, paintKnob]);

  /* A different STATION LIST is a different instrument face (a new page): the
     needle snaps to the arrival station. The same list with a moved `active`
     (an in-page tab change, or Back) springs to it. */
  const stationsKey = useMemo(() => stations.map((station) => station.id).join(' '), [stations]);
  const prevKey = useRef(stationsKey);
  useEffect(() => {
    committedStation.current = activeIdx;
    if (dialDragging.current || springs.current.dial) { prevKey.current = stationsKey; return; }
    if (prevKey.current !== stationsKey) {
      prevKey.current = stationsKey;
      pos.current = activeIdx;
      paintDial();
      return;
    }
    /* Same face: come round the short way to the nearest congruent detent. */
    const len = stations.length || 1;
    const cur = pos.current;
    let target = activeIdx;
    while (target - cur > len / 2) target -= len;
    while (cur - target > len / 2) target += len;
    if (Math.abs(target - cur) < 0.001) { paintDial(); return; }
    springVal('dial', cur, target, 0, (x, done) => {
      pos.current = x;
      dialDragging.current = !done;
      paintDial();
    }, 120, 11);
  }, [activeIdx, paintDial, springVal, stations.length, stationsKey]);

  /* ── mount: light listeners, wheel guards, cold boot ─────────────────── */
  useEffect(() => {
    reduced.current = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bar = barRef.current;
    if (!bar) return undefined;
    measureDialGeom();
    paintLight();
    paintKnob();
    paintDial();
    paintStick();
    const onResize = () => { measureDialGeom(); paintDial(); };
    window.addEventListener('resize', onResize);
    /* Re-measure once the webfont has actually loaded. `fittedRest` measures
       the label on a canvas in the drum's real face, and at mount that face is
       still pending — so measureText falls back to a metrically WIDER system
       font, the fit shrinks a name that would have fitted, and the cache keeps
       that answer for the life of the dock. Caught by `measure:dock`: the
       resting "Recommended" came back 15px at 320 and 17px at 375 where it
       fits at 24. */
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!bar.isConnected) return;
        measureDialGeom();
        paintDial();
      }).catch(() => { /* no font metrics to refine; the mount's fit stands */ });
    }


    /* React attaches wheel listeners passively, so a preventDefault inside
       onWheel does nothing and the page scrolls out from under the gesture —
       the MmmTuner lesson, kept. Native, non-passive, prevent-only. */
    const swallow = (event: WheelEvent) => event.preventDefault();
    const knob = knobRef.current, dial = dialRef.current;
    knob?.addEventListener('wheel', swallow, { passive: false });
    dial?.addEventListener('wheel', swallow, { passive: false });

    /* Cold start. An incandescent lamp doesn't switch on — it STRIKES: dark, a
       flash, a stumble, a second flash, then an exponential warm from deep red
       toward amber as the filament comes up to temperature (~1.4s). */
    let raf = 0;
    if (!reduced.current) {
      booting.current = true;
      const strike: [number, number][] = [[0, 0], [.05, .55], [.09, .1], [.14, .72], [.19, .45], [.26, .55]];
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 1400);
        let b = .55;
        if (t < .26) {
          for (let i = 1; i < strike.length; i++) {
            if (t >= strike[i - 1][0] && t <= strike[i][0]) {
              const f = (t - strike[i - 1][0]) / (strike[i][0] - strike[i - 1][0]);
              b = strike[i - 1][1] + (strike[i][1] - strike[i - 1][1]) * f;
            }
          }
        } else {
          b = 1 - Math.exp(-(t - .26) * 6) * .45;
        }
        const cold = 1 - Math.min(1, b);
        for (const n of [backlightRef.current, spillRef.current]) {
          if (n) n.style.filter = 'brightness(' + b.toFixed(3) + ') saturate(' + (1 + cold * .9).toFixed(3) + ') hue-rotate(' + (-22 * cold).toFixed(1) + 'deg)';
        }
        if (t < 1) { raf = requestAnimationFrame(step); }
        else {
          for (const n of [backlightRef.current, spillRef.current]) if (n) n.style.filter = '';
          booting.current = false;
        }
      };
      raf = requestAnimationFrame(step);
    }

    const currentSprings = springs.current;
    return () => {
      window.removeEventListener('resize', onResize);
      knob?.removeEventListener('wheel', swallow);
      dial?.removeEventListener('wheel', swallow);
      cancelAnimationFrame(raf);
      for (const key of Object.keys(currentSprings)) {
        cancelAnimationFrame(currentSprings[key].raf);
        delete currentSprings[key];
      }
      clearTimeout(dipTimer.current);
      void audio.current?.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only wiring; the paint callbacks are stable
  }, []);

  /* ── gesture state (per-gesture, ref-held) ───────────────────────────── */
  const knobDrag = useRef<{ x: number; from: number; moved: number; t: number; v: number; last: number } | null>(null);
  const dialDrag = useRef<{ x: number; from: number; t: number; v: number; last: number } | null>(null);
  const stickDrag = useRef<{ x: number; y: number; fired: boolean; moved: number } | null>(null);

  return (
    <div className="mmm-dock" ref={barRef}>
      <div aria-hidden="true" className="mmm-dock-grain" />

      {/* The maker's plate is the WAY BACK: from a profile, a track or a
          ticket it returns you to the main-nav page you came from, and from
          main-nav level it re-seats MAP. The dial behind it is a drag surface;
          the badge must not start a tune. */}
      <button
        aria-label="iHYPE — back to the main navigation"
        className="mmm-dock-badge"
        onClick={(event) => { event.stopPropagation(); goNameplate(); }}
        onPointerDown={(event) => { event.stopPropagation(); wakeAudio(); }}
        type="button"
      >
        <span className="mmm-dock-badge-plate">iHYPE</span>
      </button>

      <div className="mmm-dock-plate">
        {/* ── left: the module knob ── */}
        <button
          aria-label={`Module: ${MMM_NAV[moduleIdx].label}. Tap for the next, or drag to choose.`}
          className="mmm-knob"
          ref={knobRef}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); goModule(committedMod.current + 1); }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); goModule(committedMod.current - 1); }
          }}
          onPointerCancel={() => { knobDrag.current = null; knobDragging.current = false; light.current.pressed = false; paintLight(); paintKnob(); }}
          onPointerDown={(event) => {
            wakeAudio();
            cancelSpring('knob');
            knobDrag.current = { x: event.clientX, from: knobPos.current, moved: 0, t: performance.now(), v: 0, last: knobPos.current };
            knobDragging.current = true;
            light.current.pressed = true;
            paintLight();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const kd = knobDrag.current;
            if (!kd) return;
            const dx = event.clientX - kd.x;
            kd.moved = Math.max(kd.moved, Math.abs(dx));
            /* Continuous while turning. Clamped rather than looped: three
               detents on a physical switch have stops, and passing MAP straight
               into ME would jump two modules on one flick. */
            const raw = Math.max(0, Math.min(MMM_NAV.length - 1, kd.from + dx / KNOB_TRAVEL));
            const now = performance.now();
            kd.v = 0.8 * kd.v + 0.2 * ((raw - kd.last) / Math.max(1, now - kd.t) * 1000);
            kd.last = raw; kd.t = now;
            knobPos.current = raw;
            paintKnob();
            /* The module commits at the nearest notch as you cross it. */
            const near = Math.round(raw);
            if (near !== committedMod.current) goModule(near);
          }}
          onPointerUp={() => {
            const kd = knobDrag.current;
            light.current.pressed = false;
            paintLight();
            if (!kd) return;
            /* 10, not 4: a thumb on glass jitters 5-8px during a deliberate
               tap, so at 4px a finger's tap read as a tiny drag that sprang
               back — the knob "didn't work" on a phone while every mouse and
               synthetic tap passed (owner, 2026-08-25: "Moving between map
               music me didn't work"). 10 is still under a third of one detent's
               travel (32px), so a real turn can never be mistaken for a tap. */
            const tap = kd.moved < 10, kv = kd.v;
            knobDrag.current = null;
            if (tap) {
              knobDragging.current = false;
              goModule((committedMod.current + 1) % MMM_NAV.length);
              knobPos.current = committedMod.current;
              paintKnob();
              return;
            }
            /* Settle into the notch on a real damped spring, carrying the
               release velocity: the brass overshoots a couple of degrees and
               wobbles once — metal with momentum, not a tween. */
            springVal('knob', knobPos.current, committedMod.current, kv, (x, done) => {
              knobPos.current = x;
              knobDragging.current = !done;
              if (done) click('seat');
              paintKnob();
            }, 160, 10);
          }}
          onWheel={(event) => goModule(committedMod.current + (event.deltaY > 0 ? 1 : -1))}
          type="button"
        >
          <div className="mmm-knob-rotor" ref={rotorRef}>
            <div className="mmm-knob-flutes" />
            <div className="mmm-knob-skirtlight" />
            <div className="mmm-knob-wear" />
            <div className="mmm-knob-cap" />
            <div className="mmm-knob-lathe" />
            <div className="mmm-knob-env" />
            <div className="mmm-knob-glint" />
            <div className="mmm-knob-pointer" />
          </div>
          <div aria-hidden="true" className="mmm-knob-ao" ref={knobAoRef} />
          <div aria-hidden="true" className="mmm-knob-readout" ref={readoutRef} />
        </button>

        {/* ── centre: the tuner dial ── */}
        <div
          aria-label={label}
          className="mmm-hifi-dial"
          onPointerCancel={() => { dialDrag.current = null; dialDragging.current = false; paintDial(); }}
          ref={dialRef}
          onPointerDown={(event) => {
            wakeAudio();
            cancelSpring('dial');
            dialDrag.current = { x: event.clientX, from: pos.current, t: performance.now(), v: 0, last: pos.current };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.style.cursor = 'grabbing';
          }}
          onPointerMove={(event) => {
            const dd = dialDrag.current;
            if (!dd) return;
            /* One continuous float. No index, no clamp — the wheel simply keeps
               turning for as long as the finger keeps moving; labels and select
               wrap by modulo. */
            const next = dd.from - (event.clientX - dd.x) / DIAL_DETENT;
            const now = performance.now();
            dd.v = 0.8 * dd.v + 0.2 * ((next - dd.last) / Math.max(1, now - dd.t) * 1000);
            dd.last = next; dd.t = now;
            setDialPos(next, true);
          }}
          onPointerUp={(event) => {
            const dd = dialDrag.current;
            if (!dd) return;
            const dv = dd.v;
            dialDrag.current = null;
            event.currentTarget.style.cursor = 'grab';
            /* A flick COASTS: the wheel keeps turning under its own momentum,
               detents ticking past as friction bleeds it off, until a notch
               catches it. A slow release skips the coast and just settles. */
            if (Math.abs(dv) > 1.6) coastDial(dv);
            else springVal('dial', pos.current, Math.round(pos.current), dv, (x, done) => setDialPos(x, !done), 120, 11);
          }}
          onWheel={(event) => tuneTo(Math.round(pos.current) + (event.deltaY > 0 || event.deltaX > 0 ? 1 : -1))}
          /* One stop in the tab order and the arrows tune it — the DIAL takes
             focus, not its tabs (roving focus across a drum whose faces swap
             text under the reader announces nonsense). Same contract as the
             vendored dial, asserted by e2e. */
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') { event.preventDefault(); tuneTo(Math.round(pos.current) + 1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); tuneTo(Math.round(pos.current) - 1); }
          }}
          role="tablist"
          tabIndex={0}
        >
          <div aria-hidden="true" className="mmm-dial-backlight" ref={backlightRef} />
          <div aria-hidden="true" className="mmm-dial-spill" ref={spillRef} />
          <div aria-hidden="true" className="mmm-dial-smudge" />
          <div className="mmm-dial-stations">
            <div aria-hidden="true" className="mmm-dial-station" ref={wlRef} />
            <button
              aria-selected="true"
              className="mmm-dial-station"
              ref={stationRef}
              role="tab"
              tabIndex={-1}
              type="button"
            />
            <div aria-hidden="true" className="mmm-dial-station" ref={wrRef} />
          </div>
          <div aria-hidden="true" className="mmm-dial-scale">
            <div className="mmm-dial-rail" />
            <div className="mmm-dial-card-2" ref={card2Ref} />
            <div className="mmm-dial-card" ref={cardRef} />
          </div>
          <div aria-hidden="true" className="mmm-dial-needle-shadow" />
          <div aria-hidden="true" className="mmm-dial-needle" />
          <div aria-hidden="true" className="mmm-dial-pilot" data-lit={playing} />
          <button
            aria-label="Previous station"
            className="mmm-dial-step"
            data-dir="prev"
            onClick={(event) => { event.stopPropagation(); tuneTo(Math.round(pos.current) - 1); }}
            onPointerDown={(event) => event.stopPropagation()}
            tabIndex={-1}
            type="button"
          >
            {'‹'}
          </button>
          <button
            aria-label="Next station"
            className="mmm-dial-step"
            data-dir="next"
            onClick={(event) => { event.stopPropagation(); tuneTo(Math.round(pos.current) + 1); }}
            onPointerDown={(event) => event.stopPropagation()}
            tabIndex={-1}
            type="button"
          >
            {'›'}
          </button>
          <div aria-hidden="true" className="mmm-dial-glass-1" />
          <div aria-hidden="true" className="mmm-dial-glass-2" />
          <div aria-hidden="true" className="mmm-dial-grain" />
        </div>

        {/* ── right: the transport ── */}
        <div className="mmm-gate">
          <div aria-hidden="true" className="mmm-gate-well" />
          <div aria-hidden="true" className="mmm-gate-notch" data-at="top" />
          <div aria-hidden="true" className="mmm-gate-notch" data-at="right" />
          <div aria-hidden="true" className="mmm-gate-notch" data-at="bottom" />
          <div aria-hidden="true" className="mmm-gate-notch" data-at="left" />
          {/* Dust in the gate recess — a machined well collects it. */}
          <div aria-hidden="true" className="mmm-gate-dust" style={{ left: '30%', top: '72%', background: 'rgba(255,240,210,.13)' }} />
          <div aria-hidden="true" className="mmm-gate-dust" style={{ left: '64%', top: '22%', background: 'rgba(255,240,210,.09)' }} />
          <div aria-hidden="true" className="mmm-gate-dust" style={{ left: '55%', top: '82%', background: 'rgba(255,240,210,.07)' }} />
          <div aria-hidden="true" className="mmm-stick-shadow" ref={stickShadowRef} />
          <button
            aria-label={playing ? 'Pause. Drag for previous, next, or the full player.' : 'Play. Drag for previous, next, or the full player.'}
            aria-pressed={playing}
            className="mmm-stick"
            ref={stickRef}
            data-lit={playing}
            onKeyDown={(event) => {
              const map: Record<string, 'left' | 'right' | 'up' | 'down'> = {
                ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
              };
              const dir = map[event.key];
              if (dir) { event.preventDefault(); fireRef.current(dir); }
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); togglePlayRef.current(); }
            }}
            onPointerCancel={() => {
              stickDrag.current = null;
              pressed.current = false;
              tilt.current = { x: 0, y: 0 };
              light.current.sp = false;
              paintStick();
              paintLight();
            }}
            onPointerDown={(event) => {
              wakeAudio();
              cancelSpring('stick');
              buzz(6);
              stickDrag.current = { x: event.clientX, y: event.clientY, fired: false, moved: 0 };
              /* Pushed IN. The cap sinks and loses its cast shadow, so a press
                 reads as a press before anything has moved — that is the
                 play/pause gesture. */
              pressed.current = true;
              light.current.sp = true;
              if (stickRef.current) stickRef.current.style.transition = 'none';
              paintStick();
              paintLight();
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const sd = stickDrag.current;
              if (!sd) return;
              const dx = event.clientX - sd.x, dy = event.clientY - sd.y;
              sd.moved = Math.max(sd.moved, Math.hypot(dx, dy));
              const ax = Math.abs(dx), ay = Math.abs(dy);
              /* A gated stick only lets one axis win at a time. */
              tilt.current = {
                x: ax >= ay ? Math.max(-1, Math.min(1, dx / 28)) : 0,
                y: ay > ax ? Math.max(-1, Math.min(1, -dy / 28)) : 0,
              };
              paintStick();
              if (!sd.fired && Math.max(ax, ay) > STICK_THROW) {
                sd.fired = true;
                buzz(8);
                fireRef.current(ax >= ay ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'));
              }
            }}
            onPointerUp={() => {
              const sd = stickDrag.current;
              if (!sd) return;
              const { fired, moved } = sd;
              stickDrag.current = null;
              pressed.current = false;
              light.current.sp = false;
              paintLight();
              /* Real spring return: released from deflection, an underdamped
                 spring shoots THROUGH centre — the scale goes briefly negative,
                 so the cap overswings and wobbles the way a gated stick snaps
                 back. */
              const t0 = { ...tilt.current };
              if (t0.x || t0.y) {
                springVal('stick', 1, 0, 0, (s) => {
                  tilt.current = { x: t0.x * s, y: t0.y * s };
                  paintStick();
                }, 260, 9);
              } else {
                tilt.current = { x: 0, y: 0 };
                paintStick();
              }
              /* Same finger-jitter allowance as the knob's tap: a thumb tap
                 wobbles more than 6px on glass, and a "dead" transport was the
                 report. 10 stays well under STICK_THROW (18), so a throw can
                 never read as a tap. */
              if (!fired && moved < 10) togglePlayRef.current();
            }}
            type="button"
          >
            <span aria-hidden="true" className="mmm-stick-ring" />
            <span aria-hidden="true" className="mmm-stick-knurl" />
            <span aria-hidden="true" className="mmm-stick-dish" />
            <span aria-hidden="true" className="mmm-stick-rim" />
            <span aria-hidden="true" className="mmm-stick-lit" />
            <span aria-hidden="true" className="mmm-stick-ao" ref={stickAoRef} />
          </button>
        </div>
      </div>
    </div>
  );
}
