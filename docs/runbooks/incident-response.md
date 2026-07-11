# Runbook — Security Incident Response

**Owner / Incident Commander:** admin@ihype.org (sole operator — you are IC by default) · **Scope:** ihype.org production (Cloudflare Worker + Supabase Postgres + R2 + Stripe + Resend)

This is the one-page plan required by GDPR Art. 33 (72-hour authority notification clock), SOC 2 CC7.3–7.5, CIS Control 17, and NIST CSF RESPOND. Read it *before* an incident; during one, work top to bottom.

## 1. Detect & triage (first hour)
Signals that open an incident: Sentry error spike, `anomaly-check`/`health-check` cron alert email, admin-login alert you don't recognize, new-country login alert from your own account, Supabase advisor/security email, CodeQL/Dependabot critical alert, Stripe fraud email, a user report to admin@ihype.org, or a `backup-verify` WARNING.

Severity:
- **P1 — active compromise or data breach:** unauthorized admin access, credential/secret leak, evidence of data exfiltration, payment tampering. Work the clock (§3).
- **P2 — vulnerability exposed but no evidence of abuse:** exploitable bug in production, secret committed but not provably used.
- **P3 — hardening finding:** everything else; fix via normal PRs.

## 2. Contain (same day)
In rough order of blast-radius reduction; do only what the incident needs:
- **Kill sessions for affected users:** bump `userSecurityVersion` (admin console → Users → Suspend, or SQL `UPDATE "User" SET "userSecurityVersion" = "userSecurityVersion" + 1 WHERE id = '…'`). All JWTs for that user die on next request.
- **Rotate secrets:** `wrangler secret put <NAME>` for CRON_SECRET / AUTH_SECRET / STRIPE_SECRET_KEY / RESEND_API_KEY / ADMIN_SETUP_SECRET etc. (AUTH_SECRET rotation signs out everyone — acceptable in a P1). Rotate Supabase DB password from its dashboard; update DATABASE_URL secret.
- **Stripe:** roll the API key in the Stripe dashboard; check Payments → Disputes/Radar for anomalies.
- **Admin account:** remove unknown passkeys (Settings), re-run device binding (`/admin/device-register` flow), verify `role='ADMIN'` rows: `SELECT id,email FROM "User" WHERE role='ADMIN'`.
- **Cloudflare:** check Worker deployment history for deploys you didn't make; roll back via the dashboard if needed.

## 3. The 72-hour GDPR clock (P1 with personal data involved)
Starts when you become *aware* of a personal-data breach.
1. **Hour 0:** note the discovery time in writing (email yourself — timestamps matter).
2. **Within 24 h:** establish scope from evidence (§4): whose data, which fields, what window.
3. **Within 72 h:** if the breach risks people's rights/freedoms, notify the supervisory authority. iHYPE is US-based (Portland, ME) serving EU users without an establishment there: notify the authority of an affected member state; keep the submission + reference number.
4. **Without undue delay:** if high risk to individuals (credentials, financial data, location history), email affected users plainly: what leaked, when, what we did, what they should do. BCC nobody — individual sends via Resend.
5. If you conclude no notification is required, write down *why* — Art. 33(5) requires documenting breaches you didn't report.

## 4. Evidence — where to look
- **AuditLog table:** actor, action, entity, IP (IPs older than 30 days are scrubbed by design — move fast), `SELECT * FROM "AuditLog" WHERE "createdAt" > now() - interval '7 days' ORDER BY "createdAt" DESC`.
- **Sentry:** error events around the window.
- **Supabase:** Dashboard → Logs (Postgres + PgBouncer); Auth logs are N/A (custom auth).
- **Cloudflare:** Worker logs/analytics, WAF events, deployment history.
- **Stripe:** Dashboard → Developers → Events + Logs (full API call history).
- **Resend:** delivery dashboard + `EmailDeliveryLog` table (what got sent to whom).
- **GitHub:** audit log, Actions history, Deploy keys, collaborator list.
Preserve before it ages out: AuditLog rotates at 90 days, IP scrub at 30 — export relevant rows to a private file immediately.

## 5. Eradicate, recover, learn
- Fix root cause via a normal PR (CI + CodeQL gate it) — do not hot-patch the Worker outside git.
- Confirm recovery: `backup-verify` clean, Sentry quiet, health endpoint ok.
- Within a week, append a short post-mortem to this file's directory (`incidents/YYYY-MM-DD.md`): timeline, root cause, blast radius, notifications sent, control changes. These write-ups are the SOC 2 / ISO evidence trail.

## Standing secret hygiene (not incident-triggered)
Most secrets here (`CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `AUTH_SECRET`, `RESEND_API_KEY`) are long-lived by design and only need rotation *after* an incident (§2). One is different: **`ADMIN_SETUP_SECRET`** gates `/api/admin/setup` and `/api/admin/device-setup`, the bootstrap flow for granting the first admin account and registering new admin devices. The bootstrap tokens it issues expire in 20 minutes, but the shared bearer secret itself never expires or rotates on its own — it's as durable as any static credential sitting in Cloudflare's secret store.
- **Rotate it** (`wrangler secret put ADMIN_SETUP_SECRET`) after every use — treat it as single-use in practice even though the code doesn't enforce that.
- **Rotate it** on a standing cadence regardless of use (quarterly is reasonable at this scale) — put a reminder wherever you track the monthly restore drill and annual PCI check.
- Confirm `ALLOW_ADMIN_SETUP` is unset/false in production between bootstraps — the endpoints check it in addition to the secret, so leaving it off is a second fail-closed layer for a secret that otherwise doesn't expire.

## Vendor contacts
- Supabase support: dashboard → Support (project `bjkabtzvgfshsrmjhrkx`)
- Cloudflare: dash.cloudflare.com support (Worker `ihype`)
- Stripe: dashboard → Help (has live chat for fraud)
- Resend: resend.com support
- GitHub: github.com/support (compromised-account flow)

## User notification template
> Subject: Security notice about your iHYPE account
>
> Hi [name],
> On [date] we discovered [what happened, one sentence]. The information involved was [fields]. We have [contained: rotated keys / signed out sessions / fixed the bug]. We recommend you [action: remove unrecognized passkeys in Settings / watch for phishing emails claiming to be iHYPE]. We're sorry this happened. Questions: reply to this email or admin@ihype.org.
> — iHYPE
