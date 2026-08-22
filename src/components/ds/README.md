# `src/components/ds/` — the design system's components, vendored

Everything in this directory except `_ds-runtime.ts` and this file is
**generated** by `npm run vendor:ds` from
`design/handoff-console-2026-08-21/component-source/`. `npm run guard:ds` runs in
CI and fails if a generated file no longer matches what that source produces, so
**an edit made here is reverted by the next run.** That is the point.

## Why generate rather than write

The handoff's `README.md` is explicit about the failure mode:

> Almost all visual drift in a handoff comes from one habit: reading a spec,
> then writing a fresh `Button` or `Card` that approximates it. Every
> approximation is a small divergence, and they compound. … **Do not port the
> components by hand.**

This repository is the proof. `src/components/TunerDial.tsx` and the design
system's `TunerDial` are now two different controls — three stations on the face
versus one, step keys inside the lit face versus flanking hardware — because both
were written from the same description at different times, months apart, each
correct on the day.

## Why not just load `_ds_bundle.js`

The handoff's fastest path is a `<script src="_ds_bundle.js">` tag, and for a
plain React page that really is the whole integration. It does not fit this app,
for three reasons that are all properties of the app:

1. The bundle is an IIFE reading `React`/`ReactDOM` off `window`. This is
   Next.js with server components rendering inside a Cloudflare Worker: there is
   no global React, and on the server no `window` at all.
2. It **executes** its UI kits on load — the tail mounts an `ops` kit into
   `#root` — so importing it for one knob runs several demo apps.
3. It is 731KB against a budgeted Worker bundle.

`component-source/` is the same code before compilation, and the handoff names
those files the truth ("this README is only a summary of them"). Generating from
them keeps the values literal — which is what the instruction is actually for —
without shipping a second React runtime.

## What the generator changes, and nothing else

Per component: a header, `'use client'`, `import * as React from 'react'`, and a
typed re-export carrying the props interface from the matching `.d.ts` so call
sites stay type-checked. Then one substantive transformation:

**Inline px type sizes become rem.** `--ihype-text-scale` (Settings →
Accessibility → Text size) is applied to the root font size, so `rem` follows the
reader's setting and `px` cannot — which is why `scripts/lint-source.mjs` fails
the build on an inline px `fontSize`. Values below the design system's **own**
floor (ADHERENCE.md rule 3: 15px content, 11px tracked-mono eyebrow) are raised
to it, and every raise is listed in
`design/handoff-console-2026-08-21/VENDOR_REPORT.md`. The fix belongs upstream in
Claude Design; a silent raise here is a fix nobody upstream ever hears about.

## Read the file header before mounting one

Three carry warnings that are not style opinions:

- **`TicketQR` must never render a real ticket.** Its own docstring says it draws
  a QR-*shaped* matrix from the code string and is "a representation of the door
  credential, not an encoder". On a ticket it produces a block no scanner can
  read.
- **`RotaryNav` is not adoptable as it stands.** Its cap readout is 8.5px, which
  the design system's own content floor forbids, and at 15px the word `MUSIC`
  does not fit the cap of a 74px knob. That is a design decision upstream, not a
  workaround here. The handoff also disagrees with itself about the nav model:
  `README.md` replaces the arc nav with this knob, while `ADHERENCE.md` rule 6
  still describes the logo trigger and arc as the shell's only chrome.
- **`HypeButton` paints its active state as `#ff5029` copy**, 2.48:1 on the cream
  board — the design system's own rule 2 ("`--accent` is a fill, never text").
  It was drawn on walnut, where it is legible. Pass `roleColor` with an
  accent-as-copy value on any board surface.

## Adopting one

Wrap, do not fork. The shipped `TunerDial` carries three behaviours that were
found by driving the built page rather than by reading — a non-passive `wheel`
listener (React's synthetic one is passive, so the design system's own
`preventDefault` cannot fire and the page scrolls away under the gesture),
roving-tabindex focus restored after the re-render, and a caller-supplied
`aria-label`. When those matter, add them in a thin wrapper around the vendored
component; do not copy the vendored body into a new file to change three lines.
