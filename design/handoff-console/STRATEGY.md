> **WITHDRAWN — read `DESIGN_GAP.md` instead.**
>
> This document assumed production carries three contradictory design
> generations and needs a clean `(console)` route tree. Having read
> `src/app/mmm.css` and the repo's own drift audit, that is wrong: production
> is already token-disciplined, and is AHEAD of the design system on the dock,
> the map date picker and the tuner. The real gap is structural (ArcNav's
> second level, four unbuilt components), not stylistic.
>
> The reasoning about why Code drifts in a multi-generation codebase still
> holds in general. It just is not this codebase's problem.

# Should you start over?

Partly yes. **Rewrite the view layer. Keep the backend.**

---

## Why Claude Code keeps getting it wrong

It is not a prompting failure and it is mostly not a discipline failure. It is
a context failure.

Claude Code — like any competent developer dropped into an unfamiliar
codebase — infers intent from surrounding code. It reads the neighbouring
component, matches its patterns, and stays consistent with what it finds. That
is correct behaviour and it is normally what you want.

Your codebase has at least three visual generations layered on top of each
other:

1. **Pre-v8** — the original dark direction
2. **Bulletin (v8, Aug 2026)** — ink navy `#0b1220`, Bricolage Grotesque,
   18px card radius, radial arc nav
3. **Console (v9, Aug 2026)** — cream `#f0dfb8`, Instrument Serif, 3px panel
   radius, walnut/brass chrome, tuner dial

Two of those three are wrong, and **they outnumber the right one.** So when
Code looks around for guidance, the majority vote is always the old design. It
then does exactly what a good engineer does — matches the prevailing pattern —
and you get navy-era decisions in new work.

A rules file helps at the margin. It does not win, because *nearby code is a
stronger signal than a document*. The only reliable fix is to remove the wrong
examples from what it can see.

---

## What NOT to rewrite

The backend is the most valuable thing you have and the least implicated in
any of this:

- Live Stripe Checkout and **real Connect transfers** — actual money moving
- Webhook-verified payouts on a cron (`src/lib/show-payouts.ts`)
- 501(c)(3) certified, Stripe account on the nonprofit bank account
- The 70/20/10 settlement logic, frozen-at-publish per event
- `openapi.yaml` / `schema.sql` / the API seam

None of your drift originates here. Payment infrastructure is where rewrites
go to die: the edge cases are legal and financial, they were paid for in
production incidents, and they are invisible until they cost you a payout. A
two-person team should touch this only to extend it.

**If "start over with the backend" meant rebuilding that — don't.** If it meant
"start over on the frontend, with the backend as-is" — that is exactly right,
and the rest of this document is how.

---

## The shape: a clean route tree beside the old one

Not a big-bang rewrite. A new tree that grows while the old one shrinks, with
both live. The old routes keep serving real traffic and real money the entire
time.

```
src/app/
  (legacy)/           ← everything today. Untouched. Still serving.
    listen/
    shows/
    me/
    globals.css       ← the three-generation pileup. Stays here. Quarantined.

  (console)/          ← the new tree. Console direction only.
    layout.tsx        ← imports ihype-console.css. NOT globals.css.
    listen/
    shows/
    me/

  layout.tsx          ← root: html/body shell only. No visual CSS at all.
```

Both trees call the same API, the same `lib/`, the same database. **Zero
backend change.** The seam is entirely in the view.

### The critical detail: actually stop the cascade

This is where this approach usually fails. If `globals.css` still reaches the
new tree, the old generations leak in through the cascade and you have
recreated the original problem with extra steps.

- Move all visual CSS out of the **root** layout. Root becomes `<html><body>`
  and nothing else.
- `(legacy)/layout.tsx` imports `globals.css`. Only it does.
- `(console)/layout.tsx` imports `ihype-console.css`. Only it does.
- Verify with devtools: inspect an element in the new tree and confirm **no**
  rule from `globals.css` appears in the cascade. Do this before writing a
  single new screen.

If the repo uses Tailwind, the new tree needs the token-only theme from
`TAILWIND.md`, and the default palette must not survive.

---

## Why this fixes the Code problem specifically

Inside `(console)/` there is nothing wrong to imitate. Every file Code can see
is either token-correct or a file it just wrote. The prior flips from "the old
design" to "the console design", and it starts pulling in the right direction
instead of against you.

That is the whole point of the isolation. It is cheaper than winning an
argument with the model on every task, and it does not decay.

Then instruct it by scope, not by prohibition:

> Build `(console)/shows/[slug]`. Read only `(console)/`, `RULES.md`, and
> `styles/ihype-console.css` for visual reference. Do **not** read or copy from
> `(legacy)/` — it is a superseded design generation. Reuse the data-fetching
> from `(legacy)/shows/[slug]` unchanged; rebuild only the view.

"Reuse the data layer, rebuild only the view" is the sentence that keeps this
from becoming a real rewrite.

---

## Order

Traffic-weighted, cheapest-risk first. Each screen ships behind a flag or a
path, and you can stop at any point with a working product.

1. **Shell + chrome.** Walnut cabinet, tuner dial, rotary nav, player dock,
   joystick transport. Nothing works until the frame is right, and it is the
   thing most visible to you.
2. **Read-only screens.** Discover, profiles, show detail, charter, about. No
   writes, so no financial risk. This is where you learn the patterns.
3. **Me / settings / tickets.** Real state, still low blast radius.
4. **Checkout and payouts, last.** Same backend calls, verbatim — only the
   view changes. Test with real card flows in Stripe test mode before flipping.
5. **Flip the default.** `(console)/` becomes the served tree; `(legacy)/`
   routes become redirects. You have done this before with `/studio` and
   `/home` → `/listen`.
6. **Delete `(legacy)/` and `globals.css`.** Do not skip this. An
   indefinitely-retained old tree is how you get a *fourth* generation.

---

## What this costs, honestly

The shell (step 1) is the real work — the tuner dial, the joystick transport
and the walnut chrome are genuinely intricate, and `console.css` gives you the
materials but not the interaction. Budget a couple of weeks for step 1 and
expect steps 2–3 to go several times faster than they have been going,
because each screen stops being an argument.

Steps 4–6 are mechanical.

The thing you are buying is not speed on the first screen. It is that screen
twenty looks like screen one.

---

## The one thing to do before any of it

Get the design system to where you actually want it — you said this yourself
and you are right. Every hour spent implementing a direction you are still
unsure about becomes rework across every screen.

Two specific items first, both cheap:

- **Resolve `CONTRADICTIONS.md`** at the source. Four places the system
  disagrees with itself. Each one is a decision the implementer will otherwise
  make for you, differently each time.
- **Freeze the token file.** Once `ihype-console.css` stops changing, the
  linter becomes meaningful. While it still moves, every adherence number is
  noise.

Then start step 1.
