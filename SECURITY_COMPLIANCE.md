# iHYPE — Security & Compliance Review

**Reviewed:** 2026-07-11 (full-codebase verification pass on branch `claude/security-compliance-review-c9n0x0`)
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
| Scheduled ops jobs: anomaly detection, daily backup liveness check (emails admin, warns on zero counts), capacity alerts, DMCA enforcement, health endpoint | `src/app/api/cron/*`, `src/lib/anomaly-detect.ts`, `src/lib/health.ts` |
| Rate-limit abuse metrics retained for review | `src/lib/rate-limit.ts` (`rate-limit-hits:*`) |

### Change management & secure SDLC
| Control | Evidence |
|---|---|
| CI on every PR to `main`: typecheck, source-policy lint, design guard, unit tests (240+), build, browser smoke against a scratch Postgres | `.github/workflows/ci.yml` |
| Actions pinned to commit SHAs; workflow `permissions: contents: read` | `.github/workflows/ci.yml` |
| Dependabot enabled; CodeQL scanning active at the GitHub level (alerts triaged — e.g. #32 SSRF dismissed as by-design with an in-code guard) | `.github/dependabot.yml`, DESIGN_SYNC row 189 |
| Fail-closed migration deploy pipeline (deploy verified against `_prisma_migrations`) | DESIGN_SYNC rows 188–189, `DEPLOY.md` |
| Production dependency audit: **0 vulnerabilities** (`npm audit --omit=dev`, 2026-07-11) | see Gap G-5 for dev-only advisories |

### Privacy (GDPR / ISO 27701 technical measures)
| Control | Evidence |
|---|---|
| Data subject rights UX: deletion, early identity detachment, hype-history wipe — each files a staff-reviewed, audit-logged, rate-limited request; 30-day response commitment published | `src/app/api/privacy/request/route.ts`, `/legal?tab=privacy` (`src/app/legal/page.tsx`) |
| Data portability: self-serve full JSON export, authenticated, rate-limited, audit-logged | `src/app/api/privacy/export/route.ts` |
| Consent: analytics beacon loads **only after** explicit "Accept all" (opt-in, default off; essential-only honored) | `src/components/AnalyticsBeacon.tsx`, NavShell consent banner |
| Published privacy notice: GDPR + CCPA rights, lawful bases (contract, legitimate interest), cookie policy, no data sale, no AI training on user data | `src/app/legal/page.tsx:47-54` |
| Age gates: 13+ attestation at signup; 18+ one-way attestation (audit-logged) required for ticket purchase, resale, and referral earnings | `src/app/api/register/route.ts`, `src/app/api/me/route.ts`, `src/app/api/shows/[showId]/tickets/route.ts` |
| Email unsubscribe + granular notification preferences | `src/lib/unsubscribe.ts`, `src/app/api/notification-preferences` |
| Permissive anonymous-insert RLS policy on newsletter table removed (Supabase advisor finding) | `prisma/migrations/20260710230000_drop_permissive_newsletter_policy` |
| Data minimization: passwordless (no password hashes at rest for new accounts); Stripe holds payment/KYC data; export deny-list doubles as an inventory of sensitive fields | see above |

---

## 2. Framework-by-framework assessment

Legend: ✅ technical controls in place · 🟡 partial / gap noted · 🏢 requires organizational process, cannot be closed in code.

### ISO/IEC 27002:2022 (control catalogue)
- ✅ 5.15–5.18 access control, 8.2 privileged access (RBAC, admin device binding, bootstrap secrets)
- ✅ 8.24 cryptography in transit/at rest, 8.20 network security (TLS, HSTS, CSP)
- ✅ 8.28 secure coding (CI gates, lint policy, CodeQL, SSRF/input validation, zod schemas)
- ✅ 8.15/8.16 logging & monitoring (audit log, Sentry, anomaly cron)
- ✅ 8.8 technical vulnerability management (Dependabot, CodeQL, clean prod `npm audit`) — 🟡 see G-5
- ✅ 5.25/vulnerability disclosure — `/.well-known/security.txt` (RFC 9116) added in this review
- 🏢 5.1 policies, 5.9 asset inventory, 5.19–5.23 supplier management, 6.x people controls, 5.24–5.28 incident management *process*, 5.29–5.30 continuity: require written policies and an owner — see §3

### SOC 2 (Trust Services Criteria)
- ✅ CC6 logical access (auth, RBAC, session revocation, fail-closed secrets)
- ✅ CC7.1–7.2 monitoring (Sentry, anomaly detection, audit trail, admin login alerts)
- ✅ CC8 change management *tooling* (PR-gated CI, pinned actions, protected main via PR flow)
- 🟡 A1 availability: rate-limit fail-degraded design, health checks, capacity alerts exist; backup verification is a liveness count, not a restore test (G-2)
- 🏢 SOC 2 is an *attestation of an org over an audit period*: needs written policies, risk assessment, vendor reviews, access-review cadence, incident-response runbook, and a CPA audit. The code provides evidence; it cannot provide the attestation.

### NIST CSF 2.0
- ✅ PROTECT and DETECT functions are the strongest: see IAM, network, logging tables above
- 🟡 IDENTIFY: this document + export deny-list serve as a de-facto data inventory; no formal asset/risk register (🏢)
- 🟡 RESPOND/RECOVER: alerts and backup-liveness exist; no written incident-response or recovery plan (G-2, G-6)
- 🏢 GOVERN (new in 2.0): explicitly organizational — roles, policy, supply-chain risk strategy

### PCI DSS v4
- ✅ Architecture is **SAQ A shaped**: card data is entered only into Stripe.js iframes; iHYPE stores only opaque Stripe IDs (customer/payment-intent/connect-account), which the data export additionally refuses to emit; webhooks verified; test-mode keys blocked in prod
- ✅ Requirement 4 (encrypt in transit), 6 (secure SLDC), 8 (auth), 10 (logging) technical portions
- 🏢 G-7: the actual SAQ A self-assessment questionnaire + attestation of compliance must be completed in the Stripe dashboard annually; confirm no card PANs can appear in logs (none found — the server never receives them)

### CIS Controls v8
- ✅ 3 data protection, 4 secure configuration (headers, fail-closed defaults), 6 access control, 8 audit logs, 13 network monitoring (partial), 16 application software security
- 🟡 7 continuous vulnerability management: Dependabot + CodeQL cover code; no scheduled external pentest (🏢 G-8)
- 🏢 1–2 inventories, 14 security awareness training, 17 incident response

### GDPR
- ✅ Art. 12–23 rights plumbing: access/portability (export), erasure/restriction (request flow), published 30-day SLA, no-cost exercise
- ✅ Art. 25 data protection by design: minimization (passwordless, Stripe-held payment data), opt-in analytics consent, audit logging
- ✅ Art. 32 security of processing: see technical tables
- ✅ Art. 8 children: 13+ gate; 18+ gate for financial features
- 🟡 **G-1 (real gap):** product copy promises a "default 30-day window" after which identity is detached from activity logs, but no code implements automated detachment — the only path is the manual support request. Either build the automated job or fix the copy; as written it is an unkept processing promise (Art. 5(1)(a) fairness/transparency risk).
- 🟡 G-3: erasure/detachment execution is fully manual with no admin tooling or SLA tracking — workable at current scale, but the 30-day clock is only as reliable as the inbox
- 🏢 Art. 30 records of processing, Art. 28 DPAs with processors (Supabase, Cloudflare, Stripe, Resend, Sentry), breach-notification procedure (Art. 33: 72 h), DPO/representative decision — see §3

### ISO/IEC 27701 (privacy information management)
- ✅ Technical PII controls map from the GDPR row above (minimization, consent, rights, export deny-list as PII inventory)
- 🏢 27701 is an extension of ISO 27001 — it requires a certified ISMS first, plus a PIMS: privacy policies, PII processor/controller role documentation, and audit. Entirely organizational at this stage. Recommendation unchanged from the original review: pursue only if a partner contractually requires it.

---

## 3. Gap register

| # | Gap | Severity | Owner | Status |
|---|---|---|---|---|
| G-1 | **Promised 30-day identity detachment is not implemented** — legal copy and the "detach early" support flow both reference a default 30-day detach window; no cron/job performs it. Implement an automated detach job or amend the copy. | High (policy/implementation mismatch) | code | Open |
| G-2 | Backup verification (`api/cron/backup-verify`) checks row-count liveness only — it never exercises a restore. Schedule a periodic real restore drill (Supabase PITR restore to a branch, verify counts/checksums). | Medium | code + process | Open |
| G-3 | No admin tooling to execute privacy requests (deletion cascade / detachment / hype-wipe with aggregate-counter handling); execution is ad-hoc manual SQL. Build an admin "execute privacy request" action with audit trail + SLA countdown. | Medium | code | Open |
| G-4 | CSP allows `style-src 'unsafe-inline'` (Next.js inline styles) and broad `img-src https:` (user-supplied avatar URLs, documented in-code). Accepted risk; revisit if Next.js style-nonce support matures. | Low | code | Accepted |
| G-5 | 17 moderate `npm audit` advisories, all **dev-only** (`@opentelemetry/core <2.8.0` transitively under `@sentry/nextjs` instrumentation and `lighthouse`); production audit (`--omit=dev`) is clean. Clears when Sentry bumps its pins — do not `audit fix --force`. | Low | code | Watching |
| G-6 | No written incident-response / breach-notification runbook (GDPR Art. 33 72-hour clock; SOC 2 CC7.3–7.5; CIS 17). One page is enough at this scale: who is notified, where evidence lives (AuditLog + Sentry), Supabase/Cloudflare/Stripe support contacts, user-notification template. | Medium | process | Open |
| G-7 | PCI SAQ A self-assessment + attestation not on record — complete annually in the Stripe dashboard. | Medium | process | Open |
| G-8 | Organizational program for any certification path (SOC 2 / ISO 27001 / 27701): written policies, risk register, DPAs & subprocessor list, access-review cadence, external pentest. Sequencing recommendation stands: PCI SAQ (G-7) → GDPR gaps (G-1, G-3, G-6) → unified SOC2/NIST/CIS program → ISO certification only if contractually required. | — | organization | Open |

### Closed in this review
- ✅ Added `/.well-known/security.txt` (RFC 9116 vulnerability-disclosure contact, `admin@ihype.org`, expires 2027-07-01) — ISO 27002 5.25 / CIS 7 / NIST CSF RS.MA channel.
- ✅ Corrected a misleading `sentry.client.config.ts` comment claiming payment routes are traced "at full rate" (code samples auth/register/shows at 50%; payment routes were never in the list).
- ✅ This document (the framework map referenced by DESIGN_SYNC row 93 was never committed to this repo).

---

## 4. Standing rules for future changes

1. New API routes must ship with: session/role check, zod input validation, rate limit, and audit-log call where the action is security-relevant. Copy the pattern in `src/app/api/privacy/request/route.ts`.
2. Never store card numbers, bank details, or government IDs — Stripe holds them. If a new field could contain a secret or third-party PII, add it to `OMITTED_EXPORT_KEYS` in the privacy export in the same PR.
3. Outbound fetches to user-supplied URLs must go through `validatePublicHttpUrl` (`src/lib/safe-external-url.ts`).
4. Bearer-token-gated endpoints must use `verifyBearerToken` (constant-time, fails closed on missing secret).
5. Any change to the promises on `/legal` (rights, SLAs, retention windows) requires a matching implementation, and vice versa — G-1 is what happens otherwise.
6. Keep `security.txt` `Expires:` current (annual refresh).
