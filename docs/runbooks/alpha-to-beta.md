# Runbook — closed alpha now, open beta later

**The app can be public on both stores while signup stays shut.** Downloading
and signing up are different doors, controlled in different places: the store
track decides who can install, and a runtime flag decides who can create an
account. Nothing needs building for this — it is how the product already works.

Last verified against the code: 2026-09-08.

---

## Where it stands today

| | Setting | Where |
|---|---|---|
| Who can install | whatever Play/App Store track you publish to | store consoles |
| Who can sign up | **invite only** | `invite_only_signup`, default **true** |
| Which invites work | **admin-issued single-use codes only** | `invite_code_sharing`, default **false** |

`POST /api/register` has three invite channels and only one is live:

1. a shared `BETA_INVITE_CODES` string — one code, a whole channel of people
2. an **admin-minted `InviteCode` row** — single-use, claimed inside the signup
   transaction so it can never admit two accounts
3. a member's own HYPE code / `/invite/[hexId]` link — never consumed, so one
   member admits unlimited friends

**1 and 3 are sharing; 2 is issuance.** While `invite_code_sharing` is off,
only 2 is accepted, which makes the landing page's request form the single way
in. Neither default needs setting — both are the code's own fallback.

## Admitting someone during alpha

They press **Request access** on the landing page. You go to
`/admin/users` → **Access requests** → **Approve**. That mints the single-use
code and emails it in one transaction, so a request can never read approved
with no code; the code is also shown on screen if you would rather send it
yourself.

## Opening the doors for beta

**One key, no deploy.** The flag is read per request:

```
npx wrangler kv key put --namespace-id b6330641874a4420b240d3a82760a9aa \
  invite_only_signup false
```

To go back, delete the key (the code's `true` default returns) or set it
`true`.

**Eight surfaces self-correct the moment it flips** — they all read
`isInviteCodeRequiredRuntime()` rather than carrying their own copy of the
answer: the root layout's header links, the landing page and its CTA, `/join`,
`/register`, `/api/register`, `/api/referral/validate`, `/admin`, and
`/api/health`. There is no marketing copy to chase.

### Do NOT flip `invite_code_sharing` to open beta

It looks like the right switch and it is not. It re-opens channels **1 and 3**
— shared codes and unlimited personal invite links — while the door is still
nominally shut. That is a *middle* state (anyone a member invites can join),
not open signup, and it is much harder to reason about than either end. If you
want open signup, flip `invite_only_signup`. Leave sharing off unless you
specifically want members inviting members.

### The separate kill switch

`registrations_enabled` (default **true**) closes signup entirely, invite or
not. That is the emergency brake, not the alpha/beta control.

## Before you submit to either store

**A reviewer who cannot get in will reject the app as broken.** The review
notes in `docs/store-submission.md` carry a pre-minted sign-in link for this,
which is the better path — it drops them straight into a working account.

**Mint two or three invite codes as well, not one.** They are single-use and
consumed on signup, so one fumbled attempt or a second reviewer picking up the
task strands them and costs a review cycle. Put them in the notes beside the
sign-in link, and say plainly that public signup is invite-only during alpha —
otherwise a reviewer testing registration hits the wall and reports it as a
defect.
