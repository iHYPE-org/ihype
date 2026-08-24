# CLAUDE.md — add these lines to the REPO's root CLAUDE.md

Claude Code reads the repo's root `CLAUDE.md` on every session. That file is
the only channel it cannot skip. Paste this block into it, adjusting the
handoff path to wherever you commit this folder (suggested:
`design/handoff-console/`).

---

## Console frontend — binding rules

The console design handoff at `design/handoff-console/` is the frontend
specification. It overrides your judgment on anything visual.

1. **Never restyle. Copy.** Every screen you touch has a pixel reference in
   the handoff (`reference/s1`–`s9` HTML files, `NAV_MAP.md` maps routes to
   screens). Reproduce its structure and values exactly. If you think a
   spacing, color, or layout should differ — it shouldn't. Flag it in the PR
   description instead of changing it.
2. **Values come from `src/app/mmm-console.css` only.** If a color, radius,
   font, or shadow is not defined there as a token, you may not introduce it.
   No new hex values, no Tailwind color classes, no `rgba()` you invented.
3. **Keep every data hook.** When replacing a page's JSX, the fetch/SWR/
   server-action code stays byte-identical. You are changing the `return`,
   not the data flow.
4. **Follow `design/handoff-console/production/IMPLEMENT.md` step order.**
   Do not skip ahead. Each step ships alone.
5. **Do not read `engineering/openapi.yaml` or `engineering/schema.sql`** —
   stale. `src/app/api/` is the API truth; `BACKEND_RECONCILED.md` has the
   HYPE contract (429 window + 409 ledger, four button states).
6. **Frame rule:** the app is ONE 430px console column on every platform;
   wider viewports center it on the walnut cabinet ground - never reflow
   full-bleed. The dock's visual spec is reference/console-dock/ (open the
   .dc.html in a browser); ConsoleDock.tsx is wiring scaffold, not the look.
7. **Dock rules:** 93px constant, safe-area pads beneath it, mounted only in
   `src/app/app/layout.tsx` (pre-auth routes are dockless). `SECTIONS` in
   `ConsoleDock.tsx` mirrors `src/lib/mmm-nav.ts` — change both in one PR or
   neither.
8. **Before opening a PR**, run the adherence check:
   `node design/handoff-console/lint/check-adherence.mjs src/ --max=0`
   plus the repo's own `npm run audit:retro --max=0` and `npm run lint`.
   Zero new findings, or the PR says why each one is justified.

---

# Why this works when pasting the handoff into chat didn't

- **Chat context evaporates; CLAUDE.md persists.** A pasted spec is gone next
  session. The rules file is re-read every session, including ones you start
  weeks later.
- **Rules are checkable, not aspirational.** "Match the design" invites
  re-derivation. "No value outside mmm-console.css" is enforceable by lint,
  and rule 7 makes the lint a gate.
- **The reference is in the repo, not in prose.** Claude Code can open the
  handoff files while it works instead of reconstructing the design from a
  description.

# How to run the implementation

One step per session, in IMPLEMENT.md order. Good prompts are narrow:

- "Do step 1 of design/handoff-console/production/IMPLEMENT.md. Nothing else."
- "Step 5, screen S6 only: replace the JSX return of
  src/app/app/artists/[slug]/page.tsx with the S6 structure from the handoff.
  Keep every hook. Run the adherence lint before finishing."

Then review the diff with one question: *did anything change that isn't in
the step?* If yes, reject with "revert everything outside step N" — don't
hand-fix, or the drift becomes yours.
