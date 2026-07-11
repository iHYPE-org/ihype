# iHYPE — Security & Compliance Review

**Reviewed:** 2026-07-11, updated 2026-07-11 (remediation pass closing G-1, G-2, G-3, G-5, G-6, G-7), updated again 2026-07-11 (hardening follow-ups: newsletter double opt-in, subprocessor disclosure, CI dependency gate, admin-secret rotation guidance, Stripe Connect deauthorization on erasure) on branch `claude/security-compliance-review-c9n0x0`
**Frameworks assessed:** ISO/IEC 27002:2022, SOC 2 (Trust Services Criteria), NIST CSF 2.0, PCI DSS v4, CIS Controls v8, GDPR, ISO/IEC 27701

Every "Implemented" claim below was verified against the code on this date, with file
references. This document is the compliance map for the repo; update it when controls
change. **Honest scope note:** ISO 27002, SOC 2, NIST CSF, and ISO 27701 are properties
of an *organization* (policies, people, evidence over time), not of a codebase.
This document distinguishes what the code demonstrably does from what only
organizational process can provide. iHYPE is **not certified** against any of these
frameworks and must not claim to be; what it can truthfully say is that the technical
controls below are in place.

---

## 1. Verified technical controls inventory

### Identity & access management
| Control | Evidence |
|---|---|
| Passwordless authentication only — passkeys (WebAuthn) + emailed magic links; no password login path exists | `src/lib/auth.ts` (providers intentionally empty), `src/lib/passkey.ts`, `src/lib/magic-link-token.ts` |
| Session cookies: `httpOnly`, `SameSite=Lax`, `Secure` + `__Secure-` prefix in prod, 12-hour max age | `src/lib/auth-cookie.ts` |
| Server-side session revocation — `userSecurityVersion` checked against the DB on every `auth()` call, so suspensions/credential changes invalidate live JWTs | `src/lib/auth.ts:35-48` |
| RBAC — `ADMIN` role via `isAdminSession()`; admin API routes gated by `requireAdminApi()`; ownership checks via `canManageOwnedResource()` | `src/lib/permissions.ts`, `src/lib/admin-api.ts` |
| Admin bootstrap endpoints require a bearer secret and **fail closed** when unset | `src/app/api/admin/setup/route.ts`, `src/app/api/admin/device-setup/route.ts` |
| Admin device binding (registered-device token for admin access) | `src/lib/admin-device.ts` |
| Every admin sign-in emails an audit alert (who/when/country/IP); all users get new-country login alerts; last-login country/timestamp recorded | `src/lib/login-security.ts` |
| Route-level auth gates for `/home`, `/dashboard`, `/admin` in middleware | `src/middleware.ts:81-88` |

### Network & application security
| Control | Evidence |
|---|---|
| HTTPS enforced — 308 redirect on non-HTTPS `x-forwarded-proto` in prod | `src/middleware.ts:70-79` |
| HSTS: `max-age=63072000; includeSubDomains; preload` on all routes | `next.config.mjs` |
| Nonce-based CSP (per-request nonce, `object-src 'none'`, `frame-ancestors 'none'` outside `/embed/`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP/Origin-Agent-Cluster | `src/middleware.ts:29-62`, `next.config.mjs` (API/static routes mirror) |
| SSRF guard on all user-supplied outbound URLs: https/http only, no credentials/ports/IP literals/localhost/internal names, re-validated on every redirect hop, 512 KB / 10 s caps | `src/lib/safe-external-url.ts`, used by `src/app/api/page-builder/import-website/route.ts` |
| `/_next/image` optimizer restricted to `ihype.org` hosts (not an open proxy) | `next.config.mjs` `remotePatterns` |
| Constant-time secret comparison for all bearer-token checks | `src/lib/secret-compare.ts` |
| Cron endpoints require `CRON_SECRET` bearer auth, fail closed when unset | `src/lib/cron-auth.ts` |
| Turnstile bot verification on registration | `src/app/api/register/route.ts:111` |
| Rate limiting: atomic Durable Object counters; on DO outage falls back to KV at **half** limit; if KV also fails, **denies** (fail closed) | `src/lib/rate-limit.ts:181-208` |
| Upload/media validation and vetting pipelines | `src/lib/validate-upload.ts`, `src/lib/media-validation.ts`, `src/lib/media-vetting.ts`, `src/lib/asset-safety.ts` |

### Data protection & payments (PCI scope)
| Control | Evidence |
|---|---|
| **Cardholder data never touches iHYPE servers** — Stripe PaymentIntents with tokenized `payment_method` IDs; card entry happens in Stripe.js (`js.stripe.com` in CSP `script-src`/`frame-src`) | `src/lib/stripe.ts` |
| Stripe webhook signature verification (`constructWebhookEvent` with `STRIPE_WEBHOOK_SECRET`) | `src/lib/stripe.ts:137-142`, `src/app/api/stripe/webhook/route.ts` |
| Idempotency keys on payment create/capture/cancel | `src/lib/stripe.ts` |
| Production refuses to run paid ticketing on `sk_test_` keys (enforced in code **and** by a source-policy lint rule) | `src/lib/payments.ts`, `src/app/api/stripe/webhook/route.ts:18`, `scripts/lint-source.mjs:54` |
| Payouts through Stripe Connect Express (Stripe holds KYC/bank data, not iHYPE) | `src/lib/stripe.ts:40-76` |
| TLS in transit everywhere (HSTS + forced redirect); Supabase Postgres and R2 encrypt at rest; R2 media only served through server-side proxy routes | `src/middleware.ts`, `src/lib/r2.ts`, CSP `media-src 'self'` |
| Data export omits credential secrets, session tokens, payment identifiers, push credentials, and third-party PII (deny-list applied recursively) | `src/app/api/privacy/export/route.ts:9-61` |
| Sentry: `sendDefaultPii` never enabled (defaults off — no IPs/cookies/headers in events); traces sampled, not full-capture | `sentry.server.config.ts`, `sentry.client.config.ts` |
| No secrets committed — env-var based config with zod validation; only public keys in `wrangler.toml`; repo grep for `sk_live`/`AKIA`/private keys is clean | `src/lib/env.ts`, `wrangler.toml` |

### Logging, monitoring & operations
| Control | Evidence |
|---|---|
| Persistent audit log (actor, action, entity, IP, metadata) for security-relevant events: privacy requests/exports, age attestation, admin actions, failed admin-setup attempts | `src/lib/audit.ts`, `AuditLog` model, call sites across `src/app/api` |
| Email delivery log with status/provider/error | `src/lib/audit.ts:45-65` |
| Error monitoring via Sentry (server + client), with DO/rate-limit failures explicitly routed there | `sentry.*.config.ts`, `src/lib/rate-limit.ts` |
| Scheduled ops jobs: anomaly detection, daily backup check (row counts, migration parity, write-freshness, monthly restore-drill reminder), capacity alerts, DMCA enforcement, health endpoint | `src/app/api/cron/*`, `src/lib/anomaly-detect.ts`, `src/lib/health.ts` |
| Rate-limit abuse metrics retained for review | `src/lib/rate-limit.ts` (`rate-limit-hits:*`) |
| Written incident-response runbook (detect/contain/72h GDPR clock/evidence sources/vendor contacts/user-notification template/`ADMIN_SETUP_SECRET` rotation cadence) | `docs/runbooks/incident-response.md` |
| Written monthly restore-drill runbook (Supabase PITR restore to a fork, verify, teardown, record) | `docs/runbooks/backup-restore-drill.md` |
| Written annual PCI SAQ A attestation checklist | `docs/runbooks/pci-saq-a.md` |

### Change management & secure SDLC
| Control | Evidence |
|---|---|
| CI on every PR to `main`: typecheck, source-policy lint, design guard, unit tests (240+), build, browser smoke against a scratch Postgres | `.github/workflows/ci.yml` |
| Actions pinned to commit SHAs; workflow `permissions: contents: read` | `.github/workflows/ci.yml` |
| Dependabot enabled; CodeQL scanning active at the GitHub level (alerts triaged — e.g. #32 SSRF dismissed as by-design with an in-code guard) | `.github/dependabot.yml`, DESIGN_SYNC row 189 |
| Fail-closed migration deploy pipeline (deploy verified against `_prisma_migrations`) | DESIGN_SYNC rows 188–189, `DEPLOY.md` |
| Production dependency audit: **0 vulnerabilities** (`npm audit --omit=dev`, 2026-07-11); 17 moderate advisories remain but are transitively pinned by dev-only `@sentry/nextjs`/`lighthouse` packages with no non-breaking fix available (`npm audit fix --dry-run` confirmed) | `package.json` |
| **CI dependency gate**: `npm audit --omit=dev --audit-level=high` now runs on every PR and fails the build on a high/critical production vulnerability, instead of relying on someone remembering to check | `.github/workflows/ci.yml` |

### Privacy (GDPR / ISO 27701 technical measures)
| Control | Evidence |
|---|---|
| **Automated 30-day identity detachment**: daily cron strips IP addresses from audit-log entries older than the published 30-day default, sitewide; matches the copy on `/legal` and Settings exactly | `src/lib/privacy-actions.ts` (`scrubAgedAuditLogIps`), `identity-detach` cron job in `src/app/api/cron/route.ts`, scheduled in `workers/cron.ts`/`wrangler.cron.toml` |
| **Instant self-serve detach/hype-wipe**: "detach now" and "wipe hype history" execute immediately (not just a ticket) — IP/location scrubbed or hype events deleted with aggregate `hypeCount` decremented by the exact amount removed, audit-logged | `src/lib/privacy-actions.ts` (`executeIdentityDetach`, `executeHypeWipe`), `src/app/api/privacy/request/route.ts` |
| **Admin-executable account erasure**: staff-reviewed deletion requests are executed from the admin console (anonymization-based — deletes personal rows, scrubs embedded PII in retained financial/ticket records, anonymizes owned profiles in place, reduces the User row to a shell, kills all sessions) rather than ad-hoc manual SQL; requires a fresh admin passkey re-auth | `src/lib/privacy-actions.ts` (`executeAccountErasure`), `src/app/api/admin/privacy-requests/[id]/route.ts`, `src/components/AdminPrivacyRequestActions.tsx`, admin dashboard support-requests panel |
| Data subject rights UX: deletion, early identity detachment, hype-history wipe — each files an audit-logged, rate-limited request (detach/hype-wipe execute instantly; deletion stays staff-reviewed); 30-day response commitment published and now backed by the automated cron above | `src/app/api/privacy/request/route.ts`, `/legal?tab=privacy` (`src/app/legal/page.tsx`) |
| Data portability: self-serve full JSON export, authenticated, rate-limited, audit-logged | `src/app/api/privacy/export/route.ts` |
| Consent: analytics beacon loads **only after** explicit "Accept all" (opt-in, default off; essential-only honored) | `src/components/AnalyticsBeacon.tsx`, NavShell consent banner |
| Published privacy notice: GDPR + CCPA rights, lawful bases (contract, legitimate interest), cookie policy, no data sale, no AI training on user data | `src/app/legal/page.tsx:47-54` |
| Age gates: 13+ attestation at signup; 18+ one-way attestation (audit-logged) required for ticket purchase, resale, and referral earnings | `src/app/api/register/route.ts`, `src/app/api/me/route.ts`, `src/app/api/shows/[showId]/tickets/route.ts` |
| Email unsubscribe + granular notification preferences | `src/lib/unsubscribe.ts`, `src/app/api/notification-preferences` |
| Permissive anonymous-insert RLS policy on newsletter table removed (Supabase advisor finding) | `prisma/migrations/20260710230000_drop_permissive_newsletter_policy` |
| **Newsletter double opt-in**: a subscribe request writes an unconfirmed row and emails a time-boxed confirm link; the subscription is not treated as consented (`confirmedAt` stays null) until the recipient clicks it — evidence of freely-given consent, not just a captured address | `prisma/migrations/20260711050000_newsletter_double_optin`, `src/app/api/newsletter/subscribe/route.ts`, `src/app/api/newsletter/confirm/route.ts` |
| **Published subprocessor list**: names every vendor that touches user data (Stripe, Supabase, Cloudflare, Resend, Sentry) and what each holds | `src/app/legal/page.tsx` ("Subprocessors" section) |
| **Stripe Connect deauthorization on account erasure**: `executeAccountErasure` now actively deletes a creator's Stripe Connect account (not just the local reference) so an erased identity can't keep collecting future payouts; if Stripe refuses (pending balance), the account is left intact and flagged `stripeConnectNeedsManualReview` in the audit trail and surfaced to the executing admin, rather than silently failing | `src/lib/stripe.ts` (`deauthorizeStripeConnectAccount`), `src/lib/privacy-actions.ts`, `src/components/AdminPrivacyRequestActions.tsx` |
| Data minimization: passwordless (no password hashes at rest for new accounts); Stripe holds payment/KYC data; export deny-list doubles as an inventory of sensitive fields | see above |

---

## 2. Framework-by-framework assessment

Legend: ✅ technical controls in place · 🟡 partial / gap noted · 🏢 requires organizational process, cannot be closed in code.

### ISO/IEC 27002:2022 (control catalogue)
- ✅ 5.15–5.18 access control, 8.2 privileged access (RBAC, admin device binding, bootstrap secrets)
- ✅ 8.24 cryptography in transit/at rest, 8.20 network security (TLS, HSTS, CSP)
- ✅ 8.28 secure coding (CI gates, lint policy, CodeQL, SSRF/input validation, zod schemas)
- ✅ 8.15/8.16 logging & monitoring (audit log, Sentry, anomaly cron)
- ✅ 8.8 technical vulnerability management (Dependabot, CodeQL, clean prod `npm audit`; remaining moderate advisories are dev-only, see closed G-5)
- ✅ 5.25/vulnerability disclosure — `/.well-known/security.txt` (RFC 9116) added in this review
- ✅ 5.24 incident management planning — `docs/runbooks/incident-response.md` (closed G-6)
- ✅ 5.29–5.30 continuity — `docs/runbooks/backup-restore-drill.md` (closed G-2)
- 🏢 5.1 policies, 5.9 asset inventory, 5.19–5.23 supplier management, 6.x people controls: still require an owner beyond code — see §3 (G-8)

### SOC 2 (Trust Services Criteria)
- ✅ CC6 logical access (auth, RBAC, session revocation, fail-closed secrets)
- ✅ CC7.1–7.2 monitoring (Sentry, anomaly detection, audit trail, admin login alerts)
- ✅ CC8 change management *tooling* (PR-gated CI, pinned actions, protected main via PR flow)
- ✅ A1 availability: rate-limit fail-degraded design, health checks, capacity alerts, backup check now verifies migration parity + write-freshness and reminds on the monthly restore drill (closed G-2); the drill itself is a process action (§3)
- ✅ CC7.3–7.5 incident response — written runbook with the 72h GDPR clock, evidence sources, vendor contacts, notification template (closed G-6)
- 🏢 SOC 2 is an *attestation of an org over an audit period*: needs written policies, risk assessment, vendor reviews, access-review cadence, and a CPA audit. The code and runbooks now provide the evidence trail; they cannot provide the attestation itself.

### NIST CSF 2.0
- ✅ PROTECT and DETECT functions are the strongest: see IAM, network, logging tables above
- ✅ RESPOND/RECOVER: written incident-response runbook and a restore-drill runbook with a monthly cron reminder now exist (closed G-2, G-6)
- 🟡 IDENTIFY: this document + export deny-list serve as a de-facto data inventory; no formal asset/risk register (🏢)
- 🏢 GOVERN (new in 2.0): explicitly organizational — roles, policy, supply-chain risk strategy

### PCI DSS v4
- ✅ Architecture is **SAQ A shaped**: card data is entered only into Stripe.js iframes; iHYPE stores only opaque Stripe IDs (customer/payment-intent/connect-account), which the data export additionally refuses to emit; webhooks verified; test-mode keys blocked in prod
- ✅ Requirement 4 (encrypt in transit), 6 (secure SLDC), 8 (auth), 10 (logging) technical portions
- ✅ Annual attestation checklist written — `docs/runbooks/pci-saq-a.md` (closed G-7's code side)
- 🏢 G-7: the actual SAQ A self-assessment questionnaire + attestation of compliance must still be *completed* in the Stripe dashboard annually (a process action the runbook cannot do on your behalf); confirm no card PANs can appear in logs (none found — the server never receives them)

### CIS Controls v8
- ✅ 3 data protection, 4 secure configuration (headers, fail-closed defaults), 6 access control, 8 audit logs, 13 network monitoring (partial), 16 application software security
- ✅ 17 incident response — written runbook (closed G-6)
- 🟡 7 continuous vulnerability management: Dependabot + CodeQL cover code; no scheduled external pentest (🏢 G-8)
- 🏢 1–2 inventories, 14 security awareness training

### GDPR
- ✅ Art. 12–23 rights plumbing: access/portability (export), erasure/restriction (request flow), published 30-day SLA, no-cost exercise
- ✅ Art. 25 data protection by design: minimization (passwordless, Stripe-held payment data), opt-in analytics consent, audit logging
- ✅ Art. 32 security of processing: see technical tables
- ✅ Art. 8 children: 13+ gate; 18+ gate for financial features
- ✅ **G-1 closed:** the published "default 30-day window" for identity detachment is now implemented by a daily cron (`identity-detach`), and self-serve "detach now" executes instantly instead of only filing a ticket. Copy in Settings and Support → Privacy corrected to describe the real mechanism (IP/location scrub, not "verification link deletion").
- ✅ **G-3 closed:** erasure/detachment/hype-wipe are now admin-executable from the console with a passkey-reauth gate and full audit trail, instead of ad-hoc manual SQL.
- ✅ Art. 33 breach-notification procedure — `docs/runbooks/incident-response.md` §3 (closed G-6)
- 🏢 Art. 30 records of processing, Art. 28 DPAs with processors (Supabase, Cloudflare, Stripe, Resend, Sentry), DPO/representative decision — organizational, see §3 (G-8)

### ISO/IEC 27701 (privacy information management)
- ✅ Technical PII controls map from the GDPR row above (minimization, consent, rights, export deny-list as PII inventory)
- 🏢 27701 is an extension of ISO 27001 — it requires a certified ISMS first, plus a PIMS: privacy policies, PII processor/controller role documentation, and audit. Entirely organizational at this stage. Recommendation unchanged from the original review: pursue only if a partner contractually requires it.

---

## 3. Gap register

| # | Gap | Severity | Owner | Status |
|---|---|---|---|---|
| G-4 | CSP allows `style-src 'unsafe-inline'` (Next.js inline styles) and broad `img-src https:` (user-supplied avatar URLs, documented in-code). Accepted risk; revisit if Next.js style-nonce support matures. | Low | code | Accepted |
| G-7 (process half) | PCI SAQ A self-assessment must still be **completed and submitted** in the Stripe dashboard annually — the checklist (`docs/runbooks/pci-saq-a.md`) cannot do this step for you. | Medium | process | Open — action required outside this repo |
| G-8 | Organizational program for any certification path (SOC 2 / ISO 27001 / 27701): written policies, risk register, DPAs & subprocessor list, access-review cadence, external pentest. Sequencing recommendation stands: PCI SAQ (G-7) → unified SOC2/NIST/CIS program → ISO certification only if contractually required. | — | organization | Open |

### Hardening follow-ups (2026-07-11, second pass — not gap-register items, proactive suggestions)
- ✅ **Newsletter double opt-in.** `NewsletterSubscription` gained `confirmedAt`/`confirmToken`/`confirmTokenExpiresAt` (`prisma/migrations/20260711050000_newsletter_double_optin`). Subscribing now emails a 24h confirm link instead of writing an immediately-active row; `GET /api/newsletter/confirm` marks it consented. Single opt-in was legally workable but weak evidence of "freely given" consent under GDPR Recital 32 — this closes that gap before it became one.
- ✅ **Subprocessor disclosure.** `/legal` now names Stripe, Supabase, Cloudflare, Resend, and Sentry with what each holds, addressing GDPR Art. 13(1)(e)/28 transparency expectations that the prior privacy notice described in the abstract ("systems and staff that need it") without naming vendors.
- ✅ **CI dependency gate.** `npm audit --omit=dev --audit-level=high` is now a required CI step — a future high/critical production vulnerability fails the build automatically instead of depending on someone rerunning `npm audit` manually.
- ✅ **`ADMIN_SETUP_SECRET` rotation guidance.** This bearer secret (gates admin bootstrap/device-setup) has no built-in expiry, unlike the 20-minute bootstrap tokens it issues. `docs/runbooks/incident-response.md` now has a "Standing secret hygiene" section: rotate after every use, rotate quarterly regardless, and confirm `ALLOW_ADMIN_SETUP` stays off between bootstraps.
- ✅ **Stripe Connect deauthorization on erasure.** Previously `executeAccountErasure` left a creator's `stripeConnectAccountId` untouched "for financial audit" — correct for `AccountsPayableEntry` history, but it meant an erased identity's Connect account stayed live and could in principle keep receiving transfers. Erasure now calls `stripe.accounts.del()` on it; on success the local reference is cleared, on failure (Stripe blocks deletion with a pending balance) the account is left alone, flagged in `stripeConnectNeedsManualReview`, and surfaced as a browser alert to the admin who ran the erasure so it doesn't silently fall through. 5 new unit tests.
- All five verified: 250/250 tests passing (10 in `privacy-actions.test.ts`), tsc/lint/design-guard clean.

### Closed in this review (2026-07-11, remediation pass)
- ✅ **G-1 — identity detachment.** Added `scrubAgedAuditLogIps()` + the `identity-detach` daily cron (`src/lib/privacy-actions.ts`, `src/app/api/cron/route.ts`, scheduled in `workers/cron.ts` and `wrangler.cron.toml`) so the published 30-day default is real. `executeIdentityDetach()` makes self-serve "detach now" run immediately instead of only filing a ticket. Corrected copy in `src/app/settings/page.tsx` and `src/components/SupportPrivacyPanel.tsx` that falsely claimed the mechanism was "deleting your email verification link" — it's an IP/location scrub of the activity log.
- ✅ **G-3 — admin execution tooling.** `src/lib/privacy-actions.ts` adds `executeHypeWipe()` (deletes hype events, decrements the exact matching `hypeCount` on each affected show/profile, clamps against drift) and `executeAccountErasure()` (anonymization-based: deletes purely-personal rows, scrubs PII embedded in retained financial/ticket records, anonymizes owned profiles in place rather than cascading their deletion — which would have destroyed other people's ticket/payout history — reduces the User row to an inert shell, kills all sessions via `userSecurityVersion`; refuses to run on ADMIN accounts). Wired to a new admin-only route (`src/app/api/admin/privacy-requests/[id]/route.ts`, passkey-reauth gated) and a console action (`src/components/AdminPrivacyRequestActions.tsx`) surfaced on the existing support-requests panel. detach/hype-wipe requests now auto-execute at submission and land in the queue already `DONE`; only deletion stays `OPEN` for a human to trigger. 6 unit tests added (`src/lib/__tests__/privacy-actions.test.ts`) covering the ADMIN-account refusal, counter-decrement math, embedded-PII scrubbing, and in-place profile anonymization.
- ✅ **G-2 — backup verification.** `src/app/api/cron/backup-verify/route.ts` now also checks `_prisma_migrations` parity and audit-log write-freshness (catches silent write failures a pure row-count can't), and flags the 1st of each month as "restore drill due." Added `docs/runbooks/backup-restore-drill.md` — the actual monthly restore-to-a-fork procedure, which no cron can execute for you.
- ✅ **G-5 — dependency advisories investigated.** `npm audit fix --dry-run` confirmed the 17 moderate advisories have no non-breaking fix available (they're transitively pinned by `@sentry/nextjs` and `lighthouse`, both dev-only); left as-is per the original recommendation rather than force-upgrading and risking breakage.
- ✅ **G-6 — incident response.** `docs/runbooks/incident-response.md`: detection signals, containment steps (session kill via `userSecurityVersion`, secret rotation), the GDPR Art. 33 72-hour clock, an evidence-source list (AuditLog/Sentry/Supabase/Cloudflare/Stripe/Resend/GitHub) with retention caveats, vendor support contacts, and a user-notification template.
- ✅ **G-7 (code half) — PCI SAQ A.** `docs/runbooks/pci-saq-a.md`: annual checklist confirming the SAQ A architecture still holds, plus the Stripe-dashboard completion steps. The attestation submission itself remains a process action (see table above).
- ✅ Added `/.well-known/security.txt` (RFC 9116 vulnerability-disclosure contact, `admin@ihype.org`, expires 2027-07-01) — ISO 27002 5.25 / CIS 7 / NIST CSF RS.MA channel.
- ✅ Corrected a misleading `sentry.client.config.ts` comment claiming payment routes are traced "at full rate" (code samples auth/register/shows at 50%; payment routes were never in the list).
- ✅ This document (the framework map referenced by DESIGN_SYNC row 93 was never committed to this repo).

---

## 4. Standing rules for future changes

1. New API routes must ship with: session/role check, zod input validation, rate limit, and audit-log call where the action is security-relevant. Copy the pattern in `src/app/api/privacy/request/route.ts`.
2. Never store card numbers, bank details, or government IDs — Stripe holds them. If a new field could contain a secret or third-party PII, add it to `OMITTED_EXPORT_KEYS` in the privacy export in the same PR.
3. Outbound fetches to user-supplied URLs must go through `validatePublicHttpUrl` (`src/lib/safe-external-url.ts`).
4. Bearer-token-gated endpoints must use `verifyBearerToken` (constant-time, fails closed on missing secret).
5. Any change to the promises on `/legal` (rights, SLAs, retention windows) requires a matching implementation in `src/lib/privacy-actions.ts` and vice versa — a copy/code mismatch here is a GDPR Art. 5(1)(a) fairness risk, not just a bug.
6. Keep `security.txt` `Expires:` current (annual refresh).
7. Account/profile deletion must always go through `executeAccountErasure()` (anonymize in place) — never add a `db.user.delete()` or `db.profile.delete()` path; cascades would destroy other people's ticket, payout, and show history.
8. Run the monthly restore drill (`docs/runbooks/backup-restore-drill.md`) and the annual PCI SAQ A checklist (`docs/runbooks/pci-saq-a.md`) on schedule — the crons remind you, but the actions themselves are manual.
9. New third-party vendors that touch user data (even indirectly, e.g. a new analytics or email tool) must be added to the "Subprocessors" list on `/legal` in the same PR that wires them in.
10. Any new "own money/identity/resource in a third-party system" pattern (like Stripe Connect accounts) needs an explicit deauthorization step in `executeAccountErasure()`, mirroring `deauthorizeStripeConnectAccount()` — don't let erasure leave live external resources attached to a "deleted" identity.
11. If `npm audit --omit=dev --audit-level=high` starts failing CI, do not add `--force` or downgrade `audit-level` to make it pass — fix or pin the actual vulnerable dependency.
