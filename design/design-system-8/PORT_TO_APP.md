# Porting this design system into `iHYPE-org/ihype`

**Do not copy `reference/*.html` into the app.** Those are static teaching artifacts for
building *new* things. The app already exists and is further along than the design system
in places — this document is a change list, not a rebuild.

Repo: `iHYPE-org/ihype`, branch `main`, read at tree `986458737528` (2026-08-12).
Route ↔ template mapping lives in `ROUTE_TEMPLATE_MAP.md`.

---

## What NOT to change

Verified by reading the repo, not assumed:

- **`MmmMusic.tsx` is already correct structurally.** The music subnav is already
  `<nav className="mmm-tabs">` containing `<Link className="mmm-tab">` — tabs are routes
  (`/app/music/radio`), not local state, so middle-click and back work. The design system's
  link-bar change is **CSS only**. Do not touch the component.
- **Radio is station-based** and reads `/api/stations`; the five chips are station *kinds*.
  The design system's Radio pane is a simplification — the repo is authoritative.
- **`mobile-fit.css` already sets the 44px floor** across `.mmm-tab`, `.mmm-chip`, map
  controls, form fields and link rows, gated on `(pointer: coarse)` rather than width. Do
  not add a second touch-target layer; extend that file if something is missing.

---

## 1 · Music subnav: pills → link bar

**File: `src/app/mmm.css`, lines ~337–366.**

Current: `.mmm-tabs { display:flex; gap:var(--tab-gap,8px); padding:2px 0 14px }` with
`.mmm-tab` as a filled pill, plus a narrow-width override at line 362 setting
`--tab-gap:5px; --tab-fs:0.72rem; --tab-pad:8px 9px`.

Replace with a link bar. Rationale: five capsules cannot fit 375px without dropping type
to 0.72rem (≈11.5px), and a short word in a filled pill reads as a balloon. Constant 14px
text that scrolls horizontally fits at every width and needs no responsive table.

```css
.mmm-tabs {
  display: flex; gap: 18px; align-items: stretch; flex-wrap: nowrap;
  overflow-x: auto; padding: 2px 0 14px;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.mmm-tabs::-webkit-scrollbar { display: none; }

.mmm-tab {
  position: relative; flex: 0 0 auto; white-space: nowrap;
  /* display MUST stay non-inline — see the mobile-fit note below. */
  display: inline-flex; align-items: center;
  background: none; border: 0; padding: 11px 2px 12px;
  font-family: var(--font-display); font-weight: 600; font-size: 14px;
  letter-spacing: -0.015em; color: var(--ink-3); cursor: pointer;
  transition: color 160ms cubic-bezier(.2,.7,.3,1),
              transform 110ms cubic-bezier(.2,.7,.3,1);
  transform-origin: 50% 100%;
}
.mmm-tab:hover { color: var(--ink); }
.mmm-tab:active { transform: scale(.94); color: var(--ink); }

.mmm-tab[aria-current='page'] { font-weight: 800; color: var(--ink); }
.mmm-tab[aria-current='page']::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 4px;
  height: 2.5px; border-radius: 9999px; background: var(--accent);
  box-shadow: 0 0 12px rgba(255,80,41,.55);
  animation: mmmUnderline 260ms cubic-bezier(.2,.7,.3,1) both;
}
@keyframes mmmUnderline {
  from { transform: scaleX(.3); opacity: 0 }
  to   { transform: scaleX(1);  opacity: 1 }
}
```

Then **delete the narrow override at line ~362** (`--tab-gap`, `--tab-fs`, `--tab-pad`) and
any remaining references to those three custom properties — the link bar makes them dead.

### The trap, and it is load-bearing

`src/app/mobile-fit.css` line 46 lists `.mmm-tab` in the `min-height: 44px` group under
`@media (pointer: coarse)`. That file's own comment documents the failure mode: **`min-height`
does nothing on an inline element.** `.mmm-tab` is an `<a>` (Next `<Link>`), so if the restyle
leaves it inline, the 44px floor silently stops applying and the tabs measure ~37px on a
phone with no visible error.

Keep `display: inline-flex; align-items: center` in the rule above. Verify after the change
by measuring a tab's `getBoundingClientRect().height` in a coarse-pointer emulation — it must
be ≥44.

`prefers-reduced-motion` is already handled globally; confirm `mmmUnderline` is suppressed by
the existing rule rather than adding another.

---

## 2 · ME: one section open at a time

**File: `src/components/mmm/MmmMe.tsx`** (not read during this pass — read it first).

Target behaviour, as settled in the design system:

- Every section is a drawer at **every** width, not only on phones.
- **Profiles is open on arrival**; the others are shut.
- Opening any section closes the others, **and** closes any open settings panel — one thing
  open at a time, page-wide.
- Section order: Profiles · My Tickets · About Me · Settings.

Reference implementation is the `meSection(id, first)` helper in
`templates/simplified-app/SimplifiedApp.dc.html` — a single `meGroup` state holding the open
section's id, where `undefined` means "nobody has chosen yet, show the one marked first".

---

## 3 · Map: search on the Artists layer

**Files: `src/components/mmm/MmmMap.tsx` and whatever `map.html` it embeds** (not read this
pass).

The search bar must belong to **whichever layer is showing** and match only what that layer
draws — artists by name / genre / city on the artists layer, venues by name / street / city
on the venues layer. Matching an artist while venues are drawn sends the user to a pin that
does not exist.

Placeholder swaps with the layer (`Search artists, genres, cities` /
`Search venues, streets, cities`). Selecting an artist result flies to that artist's city and
opens the artist sheet. Working implementation: `templates/simplified-app/map.html`.

---

## 4 · PWA manifest

The repo serves the native apps from `https://ihype.org` through a Capacitor WebView, so the
manifest is also what makes the site installable. `manifest.webmanifest` in this design system
is ready to copy to the app's public root; wire the head block from `index.html`
(`viewport-fit=cover`, both `theme-color` variants, the `apple-mobile-web-app-*` trio).

Check whether one already exists before adding — I did not verify this in the repo.

---

## 5 · Permission primers — new work

`templates/permissions/Permissions.dc.html` designs all six capabilities as
primer → OS prompt → denied fallback. None of this exists in the repo as far as this pass
went. It is genuinely new UI, not a port.

The rule that outranks the rest: **buying and opening a ticket must work with all six
refused.**

---

## 6 · Store submission

`templates/app-store-kit/` with `kind="review"` carries reviewer notes, the demo account,
verbatim iOS/Android permission strings, privacy labels and the age rating. The lead item —
tickets are admission to real events, so Guideline 3.1.3(e) puts them outside IAP and Stripe
is correct — is the most likely review question.

Placeholders to replace before submitting: `review@ihype.app`, the deletion URL, and the
Portland location fallback.

---

## Not verified in this pass

Called out so nobody trusts them by omission:

- Whether the DJ role is fully gone from every repo role picker (the design system's was
  removed; SKILL.md says the role was deleted 2026-08-06).
- Whether any marketing route still carries a rigid `1fr <fixed>px` grid. The design system's
  four (artist/fan/venue kits, show detail) are fixed; the repo's `src/app/*` pages were not
  audited.
- `MmmMe.tsx`, `MmmMap.tsx`, `MmmShell.tsx`, `MmmPlayer.tsx`, `MmmSheet.tsx`, `MmmNav.tsx`
  and `MmmSearch.tsx` were not read. Sections 2 and 3 are specs, not diffs.
