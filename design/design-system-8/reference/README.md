# reference/ — the portable build

**These are the files to copy from.** Plain HTML and CSS. No template language, no
runtime, no compiled bundle, no build step. Open one in a browser and it renders; open
one in an editor and every value is literal.

They exist because the rest of this design system was authored in a hosted environment
and does not all travel:

- `templates/**/*.dc.html` — a template language (`{{ }}`, `<sc-if>`, `<x-import>`) that
  needs a runtime this folder does not carry. **Will not render outside that environment.**
- `_ds_bundle.js` — compiled output. Cannot be regenerated here.
- `components/**/*.jsx` — bundler-only source.

Those files are still the source of truth for *values*. Read them as text and lift exact
paddings, radii, sizes and colors. Just don't expect them to run.

## How to use these

1. Pick the closest page and **copy the whole file**.
2. Delete what you don't need. Copying-and-deleting beats composing from a blank file.
3. Keep the `<link rel="stylesheet" href="../styles.css">` — fix the relative path.
4. Keep every literal value. If the source says 13.5px, write 13.5px.

## Working in the real app instead?

The iHYPE app already exists (`iHYPE-org/ihype`). **Do not copy these files into it** — they
are static teaching artifacts for new work. Read `../PORT_TO_APP.md`, which is a change list
keyed to the repo's real files.

## Pages

| File | Stands in for | Shows |
|---|---|---|
| `app-shell.html` | `templates/simplified-app/` | The Music pane — underline subnav, one-row filters, card grid, hype buttons, floating player, safe-area padding |
| `show-detail.html` | `templates/show-detail/` | Event page — collapsing hero split, the 70/20/10 bar, and the fee block |

## The rules these pages already encode

- **Fees are two lines, always.** iHYPE $0 (charter), Stripe separate. Never merged.
- **Promoter is not an account type.** Four roles: Fan, Artist, Venue, Advertiser.
- **375px floor.** No rigid grids — `repeat(auto-fit,minmax(min(100%,320px),1fr))`.
- **44px touch targets**, grown on the vertical axis, never by shrinking type.
- Cards get a hairline and a radius, not a drop shadow. Shadow means "floats above
  the pane" — sheets and the player only.
