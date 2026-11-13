# iHYPE release readiness gate

A feature is **not released** merely because its pull request merged. Use this gate for every public deployment.

## Required checks

- [ ] Branch is current with main; no unresolved migrations or conflicting edits.
- [ ] CI typecheck, lint, unit tests, build and browser smoke pass on the *integrated* commit.
- [ ] CodeQL and dependency/security checks pass; no known critical/high finding left untriaged.
- [ ] Database migrations are backward compatible, reviewed and applied in a staging environment before production.
- [ ] Staging walkthrough passes for fan, artist, venue, advertiser and admin (permissions differ).
- [ ] Test onboarding from fresh account to first successful action; verify back/cancel, session expiry, refresh, duplicate submission and network recovery.
- [ ] Unverified and rejected artist track uploads show an actionable verification link and a working exit to My Pages; verified uploads complete or provide a clear scan verdict.
- [ ] Settings persist after refresh, including quiz notifications default **off**, immediate opt-out, appearance reset, accessibility and hidden navigation.
- [ ] Music Trivia works without opting into notifications; sharing does not expose a public listener profile; quiz responses are deleted on account erasure.
- [ ] Payments: Stripe webhook signature verification, idempotent retries, refund and failed-payment states checked with test-mode events; no real charge in QA.
- [ ] Communications: email delivery, opt-out and push subscription/revocation tested; no push without consent.
- [ ] Accessibility: keyboard navigation, labels, visible focus, reduced motion, contrast, screen reader status messages and 320px viewport.
- [ ] Performance: iPhone Safari, Android Chrome, desktop and throttled mobile connection; no blocked navigation or unexpectedly large bundles.
- [ ] Privacy: export, deletion, audit redaction, access control and cross-account isolation verified.
- [ ] Production deployment SHA confirmed against intended merged commit, migrations healthy, and smoke checks pass.
- [ ] Post-deploy Sentry, Stripe webhook delivery, email delivery, upload errors, auth failures and API latency monitored; rollback path recorded.

## Rollback and incident handling

Before release record: release SHA, migration names, environment, deployment identifier, operator, timestamp and rollback instructions. If a database migration is not reversible, use a forward-fix plan rather than assuming code rollback reverses data. Pause rollout on elevated errors or payment failures, retain diagnostic logs without personal information, and notify operators.

## Scope and evidence

Keep test evidence (run links, screenshots or traces, staging deployment ID and observed results) in the release PR. Mark a check complete only after executing it. **Do not substitute a green feature-branch CI run for integration testing.**

## Current workstream

- Music HYPE #1119 merged.
- Music Trivia #1120, Creator Page Studio #1121 and My iHYPE #1122 require current-base integrated validation before claiming release.
- Existing E2E coverage includes creation flows and verification navigation; expand with rejected-verification recovery, opt-in notification persistence, account-erasure proof, Stripe replay tests and mobile regressions.
