# Security policy

iHYPE sells tickets and holds artists' payout details, so a vulnerability here
can cost someone real money. Reports are welcome and are read by a person.

## Reporting a vulnerability

**Email admin@ihype.org.** That is the only address iHYPE uses.

If GitHub's private vulnerability reporting is enabled on this repository, the
**Report a vulnerability** button under the Security tab is preferred, because
it keeps the report and the fix in one place and never touches a mailbox.

Please include what you did, what happened, and what you expected. A short
proof-of-concept is worth more than a scanner's output. If you need to
demonstrate against the live site, use your own account and your own test data.

**What to expect.** iHYPE is a small alpha with no dedicated security staff, so
be told plainly rather than promised something we cannot keep: a first reply
within **five business days**, and an honest answer about whether and when a
fix will land. There is **no bug bounty** — this project has no capital to pay
one, and saying so up front is better than an unanswered invoice.

## Scope

In scope: `ihype.org` and its API, the iOS and Android apps that wrap it, and
the code in this repository.

Out of scope, because they are somebody else's systems: Stripe, Supabase,
Cloudflare, Resend and the other vendors iHYPE depends on. Report those to the
vendor. Also out of scope: findings that are only reachable with an account
credential you were given, denial of service by volume, and reports consisting
solely of a scanner grade with no reachable path.

## What we ask

- Do not access, modify or keep another member's data. If a bug exposes
  someone else's information, stop, and describe it rather than collecting it.
- Do not degrade the service for members. No load testing, no spam through
  the notification or ticketing paths.
- Give a reasonable window before publishing. We will tell you what has been
  fixed and when, and we will not ask you to stay quiet indefinitely.

## Things you do not need to report

These are known and deliberate, and are documented in the repository:

- Dependency advisories in `docs/dependency-advisories.md`. Each entry records
  why the vulnerable path is unreachable here. If you can actually reach one,
  that is very much worth reporting and the document is wrong.
- The absence of a password anywhere in the product. iHYPE authenticates with
  passkeys and single-use email links by design; there is no password to
  strengthen, reset or leak.
