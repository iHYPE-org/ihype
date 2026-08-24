# SHIP_LIST — exactly what goes to the repo

## Commit into design/handoff-console/ (12 items)

| Item | Purpose |
|---|---|
| production/mmm-console.css | the skin — ALSO copy to src/app/mmm-console.css (step 1) |
| production/ConsoleDock.tsx | the dock — ALSO copy to src/components/mmm/ConsoleDock.tsx (step 2) |
| production/IMPLEMENT.md | the 6-step order Claude Code follows |
| css/ihype-console.css | full token bundle (reference) |
| components/ (all 37 .jsx) | markup reference per screen |
| lint/check-adherence.mjs | the PR gate (rule 7) — dependency-free Node script |
| reference/ (s1–s9 .html) | per-screen pixel references, self-contained |
| reference/map-treasure.html | the MAP surface — working Leaflet page, translate verbatim (step 3) |
| reference/console-dock/ | THE dock + 430px frame, live and self-contained — the visual spec for step 2 |
| NAV_MAP.md | route ↔ screen ↔ endpoint map |
| V10_SIMPLIFICATION.md | the 5 paper rules |
| BACKEND_RECONCILED.md | HYPE contract: 429 window, 409 ledger, 4 button states |
| DS_GAPS.md + PR_DS_GAPS.md | token fixes to apply upstream |
| VERIFICATION.md | what "correct" measures as |
| README.md | package index |

(reference/ is now part of the bundle — no separate export needed.)

NOT shipped (working notes, superseded, or wrong-turn records): APPLY.md,
BACKEND.md, CONTRADICTIONS.md, DESIGN_GAP.md, PHASES.md, RULES.md,
STRATEGY.md, TAILWIND.md, api/RECONCILIATION.md, types.d.ts,
components/REANCHOR.md, console-controls.keyframes.css.

## Paste into repo root CLAUDE.md

The block between the two `---` markers in production/CLAUDE_CODE_SETUP.md,
verbatim (rules 1–7). Adjust the handoff path if you commit it elsewhere.

## First prompts, in order

1. "Do step 1 of design/handoff-console/production/IMPLEMENT.md. Nothing else."
2. "Do step 2. Nothing else."
3. "Step 5, screen S6 only: replace the JSX return of
   src/app/app/artists/[slug]/page.tsx with the S6 structure from
   design/handoff-console. Keep every hook. Run the adherence lint before
   finishing."

Review each diff with one question: did anything change outside the step?
If yes: "revert everything outside step N." Never hand-fix drift.
