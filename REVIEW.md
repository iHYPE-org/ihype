# Review instructions

iHYPE runs an unusually large automated gate: 18 audits, ~1,730 unit tests and a
nightly acceptance walk that drives the product end to end. Those catch naming,
tokens, dead paths, dead components, untranslated strings and retired copy on
every push. Spend the review on what they structurally cannot see.

## What Important means here

Reserve 🔴 Important for findings that would take money, lose access, or lie to
a member:

- Money: a payout, refund, settlement or Stripe branch that moves the wrong
  amount, to the wrong account, twice, or not at all.
- Access: anything on the passkey or magic-link path, session revocation, an
  admin gate, or an ownership check. This product has no password, so a control
  on the way in must fail towards letting the member in.
- A claim the product cannot keep: an empty state rendered over a read that
  failed, a control whose success message describes something no code does, a
  figure derived from a column that never moves.
- Tickets at the door: the offline wallet, the scanner, and anything that
  decides whether a fan gets in.

Style, naming, structure and refactoring suggestions are 🟡 Nit at most.

## Cap the nits

At most five Nits per review. If there are more, give a count in the summary
instead of posting them. If everything found is a Nit, open the summary with
"No blocking issues."

## Do not report

Every one of these already fails the build, so a comment about it costs the
author a round trip and tells them nothing new:

- Raw colour literals on member-facing routes (`audit:retro`), duplicate CSS
  selectors (`audit:css`), unstyled classes (`audit:unstyled`), spacing
  near-misses (`audit:spacing`), theme contrast (`audit:contrast`).
- A component no route mounts (`audit:mounts`), an API method with no caller
  (`api-method-callers.test.ts`), a model with no writer (`model-writers`), a
  column no code reads (`column-readers`).
- A hardcoded member-facing string (`audit:untranslated`), a dictionary key
  nothing calls (`i18n-parity`), a hardcoded `en-US` or bare `toLocaleString`
  (`locale-formatting`).
- A dead path in CLAUDE.md (`audit:doc-paths`), a published URL that resolves to
  nothing (`audit:published-urls`), a link to a redirect alias (`alias-links`),
  copy selling a removed capability (`audit:retired-claims`).
- Formatting, import order, and type errors: `tsc`, `lint-source.mjs` and
  `audit:shell --strict` run on every push.

Also skip: `src/components/ds/` (generated from the design system by
`vendor:ds`; an edit there is reverted by the next run), `prisma/migrations/`
(applied history), and `DESIGN_SYNC.md` (append-only record).

## Always check

These are the defect classes this repository has actually shipped, each more
than once. They are invisible to every gate above.

- **An empty state over a failed read.** `.catch(() => [])` or `?? []` on the
  primary read of a list, then "Nothing here yet". An empty state is a CLAIM
  about the member; it may only render over a read that succeeded. A failure is
  `null` and draws its own sentence.
- **A control that promises something nothing delivers.** A preference no sender
  reads, a button whose success text describes an unbuilt feature, a receipt
  line for a capability with no code. Ask who READS the thing.
- **Optimistic UI that never reads the response.** A save, vote or reaction that
  updates local state and ignores `res.ok`. Optimistic is fine; unverified is
  the defect.
- **A guard that is named but absent.** A comment, commit message or doc saying
  a rule is enforced, with no test enforcing it. A comment is not coverage —
  verify a named guard by finding it.
- **A gate on profile TYPE rather than ownership.** Inboxes, dashboards and
  controls belong to whoever owns the profile or receives the thing, never to
  `type === 'VENUE'`.
- **One column, two names.** A field several surfaces write (a track's `hexId`
  vs its row id) must be named by one convention, and every writer held to it.
- **A show time formatted without its zone.** `Show.startsAt` is an instant;
  the door time is the venue's wall clock. Only `formatDoorTime`/`formatShowTime`
  may render it.
- **A lib returning an English sentence.** A lib returns data or an English key;
  the component that draws it translates.

## Verification bar

A behaviour claim needs a `file:line` citation in the source, not an inference
from a name or a comment. If the surrounding code was not read, do not post it.

## Re-review convergence

After the first review of a PR, post 🔴 Important findings only. Do not raise
new nits on a later push.
