# Frontend gotchas — read before implementing

These are bugs that were **already found and fixed** in the prototype. Most are subtle, all cost real debugging time, and several will silently reappear if you rebuild without knowing about them. Two of the four categories are framework-agnostic and will bite in React just as hard as they did here.

---

## 1. Map pin collision — the "one blob" bug

**Symptom.** At county zoom (the default), six Portland events rendered as an unreadable overlapping stack. Only the topmost was tappable.

**Cause.** Pins were projected to lat/lng and placed with no awareness of each other.

**Fix.** Place pins in screen space, then de-collide: any pin landing within 46×26px of an already-placed pin fans outward on a widening arc — `ring * 30px` radius, 6 slots per ring, y-axis multiplied by 0.72 so the spread reads as elliptical rather than circular — retrying up to 24 times. Offset pins get a 12px leader line instead of 7px so the real location stays legible.

**Also cull first.** Drop anything more than 80px outside the frame *before* placing, and exclude it from the hit-test array. An earlier version culled visually but still padded the hit array, so taps in empty space opened sheets for offscreen events.

---

## 2. Viewport culling and hit-testing must agree

If you render pins from one array and hit-test against another, they will drift apart. Build one array of placed pins and derive both the DOM and the hit test from it. The prototype learned this the hard way.

---

## 3. Repaint re-entrancy — the ResizeObserver loop

**Symptom.** Console error: `ResizeObserver loop completed with undelivered notifications`.

**Cause.** The map's repaint changes layout, which re-triggers the observer that called it.

**Fix.** Guard the paint function with a re-entrancy flag released in `finally`:

```js
paint() {
  if (this._painting) return;
  this._painting = true;
  try { this.paintInner(); }
  catch (err) { console.error('map paint failed', err); }
  finally { this._painting = false; }
}
```

**Always wrap the paint in try/catch.** An early version threw on the first update and *silently disabled the map for the rest of the session* — no error surfaced, the map simply never repainted again. Degrade one frame, not the whole feature.

---

## 4. Overflow clips transform-based animations

**Symptom.** Submenu items appeared cut off on their left edge; three of seven were completely unreachable.

**Cause.** Three compounding issues worth understanding separately:

1. The nav overlay was constrained to a 260×260 box, so `left:16px; right:16px` produced a 228px-wide wrapper, forcing 7 items into 4 rows.
2. `max-height: calc(100% - 120px)` resolved against that 260px parent — 140px — scrolling 78px of content out of sight with no scrollbar affordance.
3. `overflow-y: auto` causes `overflow-x` to compute to `auto` too (per spec, `visible` becomes `auto` when the other axis isn't `visible`). The items' rest transform put them 14px outside the wrapper's left edge, where they were clipped.

**Fix.** The overlay fills the frame (`inset: 0`), and the submenu wrapper has no `overflow` at all.

**General rule:** if an element animates via `transform` and its rest position sits even slightly outside its parent's box, any `overflow` on an ancestor will clip it. Check the whole ancestor chain, not just the immediate parent.

---

## 5. Custom properties must actually be declared

**Symptom.** All submenu items animated simultaneously instead of fanning.

**Cause.** Items used `animation-delay: var(--fd)` where `--fd: var(--nd)`, but `--nd` was never declared anywhere. An undefined custom property makes the whole declaration invalid, and it fails **silently** — no console warning.

**Fix.** Declare a base value on the item selector, then override per index.

In React, don't do any of this — just compute the delay directly: `style={{ animationDelay: `${i * 70}ms` }}`. The CSS-variable indirection existed only because the prototype runtime forbids computed values in style attributes.

---

## 6. Locale chunk paths can't rely on script tag order

**Symptom.** Non-English locales silently failed to load in some templates. The English fallback rendered, so it looked like missing translations rather than a loading failure.

**Cause.** The loader resolved its base path by scanning for its own `<script src>` tag. But i18n is compiled into a bundle in some contexts, so no such tag exists; and when it does, tag *order* determines whether it's found.

**Fix.** Build a candidate URL list at call time and try each until one loads, with `onerror` advancing to the next: explicit override → real i18n script tag → bundle root + `lib/` → bundle root → recorded base → relative fallbacks.

**In production this whole problem disappears** — use your bundler's asset resolution or dynamic `import()`. Just don't reintroduce path-sniffing.

---

## 7. Things that look like bugs but aren't

Don't "fix" these:

- **Device mockups and internal artifacts are English-only by decision.** Android/iOS mockups, workbench screens, audit views, launch decks, product briefs, social assets, sitemap, and email templates are deliberately not localized. This was an explicit call, recorded as a decision.
- **The promoter color token is named for promoters, not DJs.** `--role-promoter` (`#ff3e9a`) colors the 10% slice in split bars. It was renamed from `--role-dj`. There is no DJ role — if you see the old name anywhere, it's stale.
- **`page-creator` still exists as a template.** Artists and Venues still use it. Only the *fan* page creator was removed.
- **Legal translations carry an "English is binding" notice on purpose.** Keep it.

---

## 8. Prototype-runtime artifacts to ignore

These exist only because of the prototyping tool and should not be carried into production:

- `<sc-if>` / `<sc-for>` / `{{ hole }}` template syntax
- The `renderVals()` pattern returning a flat bag of values and handlers
- `dc-import` / `x-import` component mounting
- The rule that style attributes cannot contain computed values (which is why animation delays route through CSS variables)
- `componentDidUpdate()` receiving no `prevState` — the prototype compares a manually-maintained signature string instead. **In React, use real `prevProps`/`prevState` or `useEffect` dependencies.** A signature-comparison approach here caused the silent map freeze described in §3.

---

## 9. Verification checklist

Before calling the rebuild done:

- [ ] Six Portland events at county zoom are individually readable and tappable
- [ ] Panning offscreen and back re-renders pins correctly
- [ ] Pinch and scroll zoom both work; no console errors during rapid zoom
- [ ] Nav opens, dims **everything including the player**, closes on scrim tap and on logo tap
- [ ] All 5 MUSIC items and all 7 ME items are visible and reachable, no clipping
- [ ] Items fan out with a visible stagger, not all at once
- [ ] Player shows track, artist, hype toggle, play/pause; equalizer syncs to playback
- [ ] Switching locale to Arabic sets `dir="rtl"` and mirrors chevrons
- [ ] Switching to any of the 11 locales actually loads that chunk (watch the network tab — a silent fallback to English is the failure mode)
- [ ] Auth accepts one email and sends one link for both new and returning users
- [ ] Add-roles view shows Fan as locked/always-on, and offers Artist, Venue, Advertiser
- [ ] No reference to a DJ role anywhere in the UI
