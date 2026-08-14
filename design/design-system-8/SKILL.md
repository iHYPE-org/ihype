---
name: ihype-design
description: Use this skill to generate well-branded interfaces and assets for iHYPE, the music fan engagement platform. Contains design guidelines, color/type/spacing tokens, fonts, UI kit components, and real-page reference screens for marketing, product, and mobile surfaces.
user-invocable: true
---

# iHYPE design

## READ THIS BEFORE YOU OPEN ANY OTHER FILE

This folder was authored in a hosted design environment. **Some of it does not run
outside that environment.** If you skip this section you will produce something that
uses iHYPE's colors and none of its design, which is the single most common failure
mode with this skill.

### What you CAN use directly

| Path | Status | How to use it |
|---|---|---|
| `styles.css` + `tokens/*.css` | ✅ Plain CSS | Link `styles.css`. It `@import`s every token file and the `@font-face` rules. This is the source of truth for every value. |
| `reference/*.html` | ✅ Static HTML | **START HERE.** Self-contained, fully rendered pages. Copy one and edit it. |
| `guidelines/*.card.html` | ✅ Static HTML | Real rendered specimens — swatches, type, spacing, mobile rules. |
| `assets/**` | ✅ Real files | Logos, icons. Copy them out; never redraw them. |
| `readme.md`, `MOBILE.md`, `ADHERENCE.md` | ✅ Prose | Rules and rationale. Read *after* you have a reference page open. |
| `PORT_TO_APP.md` | ✅ Prose | **If you are working in the real repo, start here** — change list keyed to actual files, not a rebuild. |
| `engineering/**` | ✅ Specs | `BACKEND_SPEC.md`, `openapi.yaml`, `schema.sql`, `seed_data.json`. |

### What you CANNOT use directly

| Path | Why |
|---|---|
| `templates/**/*.dc.html` | **Not HTML.** A template language — `{{ holes }}`, `<sc-if>`, `<sc-for>`, `<x-import>`, plus a separate logic class — that needs a runtime this folder does not carry. Opening one in a browser gives a broken page. |
| `_ds_bundle.js` | Compiled output from a compiler that is not in this folder. You cannot regenerate it, so editing a component source does nothing. |
| `components/**/*.jsx` | Bundler-only source. Read them to lift exact values; do not `<script src>` them. |
| `_ds_manifest.json`, `_adherence.oxlintrc.json`, `support.js` | Environment plumbing. Ignore. |

**`.dc.html` files are still worth reading as text.** They contain the real markup with
real inline style values — the exact paddings, radii, font sizes and colors of every
shipped surface. Lift literal values out of them. Just never expect one to render.

## How to actually build something

1. **Open a `reference/*.html` page first.** Pick the closest surface to what you're
   building and read the whole file. This is what iHYPE looks like. Do not start from
   a blank file and a color palette.
2. **Copy it.** Duplicate the reference, then change content and remove what you don't
   need. Copying and deleting beats composing from scratch, every time.
3. **Link `styles.css`** and build only from its custom properties. Do not invent
   colors, type scales, radii or shadows. Do not fall back to a generic dark theme.
4. **Check against `guidelines/`** for anything the reference didn't cover.

If a value you need has no token, take the nearest one from `guidelines/*.card.html`
or from the closest `.dc.html`. Never round a value to a 4/8px grid — if the source
says 9px, write 9px.

## The visual system in one paragraph

Every surface is ink navy `--bg-base` (#0b1220; light theme #f4f6fa) with a single
`--accent` orange-red (#ff5029). Display type is **Bricolage Grotesque 800** (variable,
with an optical-size axis — set `font-variation-settings`, never scale one instance),
body is **Work Sans**, eyebrows and metadata are **JetBrains Mono** at 9–12px tracked
0.14–0.22em uppercase, and editorial pull-quotes are **Instrument Serif**. Role colors:
Fan `#b983ff`, Artist `var(--accent)`, Venue `#22e5d4`, Advertiser `#ffb84a` — those
four account types and no others. `--role-promoter` (#ff3e9a) colors the 10% pool slice
only; it is not an account type.

## Product rules that override anything you infer

**Payments: Stripe only.** Card-processing fees (2.9% + $0.30; AMEX 3.5% + $0.30) are
charged by Stripe, never by iHYPE. iHYPE's own fee is **$0**, locked in the charter's
70/20/10 split. Never merge these into one number and never imply iHYPE charges a
processing fee. Zeffy is fully retired.

**Promoter is not a role.** Any Fan, Artist, Venue or DJ can promote by sharing a HYPE
Link / referral code; when someone buys through it the referrer earns a share of the 10%
promoter pool. There is no Promoter signup, verification, or account type — never add one
to a role picker.

**There is no DJ role** (deleted 2026-08-06). Four account types: Fan, Artist, Venue,
Advertiser.

**Tickets are nonrefundable** except via organizer-initiated Event Cancellation (full
charter refund to all buyers). Never build a buyer-facing "request a refund" flow.

## Mobile

375px is the design floor, one breakpoint at 620px, 44px minimum touch targets, `dvh`
never `vh`. Full rules in `MOBILE.md`. Never write a rigid multi-column grid — use
`repeat(auto-fit,minmax(min(100%,320px),1fr))`.

## If invoked with no other guidance

Ask what the user wants to build, ask a few questions, then act as an expert designer
who outputs either static HTML artifacts or production code depending on the need —
always starting from a `reference/` page rather than a blank file.
