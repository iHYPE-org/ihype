# Monitoring

Everything below already runs. The one gap that needs a human — and the only
one that matters if the platform stops entirely — is the external check in
step 1.

## Why an external check is not optional

Every alarm iHYPE has is downstream of the thing it watches:

| Alarm | Runs where |
|---|---|
| `checkCronHealth()` — reports stale jobs | Inside `/api/cron?job=health-check`, a cron job |
| Workbench digest — emails overdue queues | A cron job |
| `report-failure` — tracks consecutive job failures | Authenticated with the same `CRON_SECRET` as the jobs it watches |
| Sentry | Only hears about errors a *running* Worker manages to report |

If the cron Worker stops being scheduled, or the app Worker stops serving,
none of them fire. The result is silence, and silence is indistinguishable
from "nothing is wrong". That is not hypothetical: a sitewide database outage
once ran for a day behind graceful fallbacks, and production shipped nothing
for a day behind a failed migration, both while every dashboard looked calm.

Two independent signals close it. Set up both — they fail differently.

## 1. Uptime check (is the site serving?)

Point any uptime monitor at:

```
https://ihype.org/api/health
```

- Expects **HTTP 200** with `{"status":"ok","scope":"liveness"}`.
- Returns **503** when the database is unreachable. This is a real query, not
  a hardcoded 200 — that distinction is why it catches an outage that a plain
  "did the process respond" check does not.
- Needs no authentication. Callers with the `CRON_SECRET` bearer token get a
  fuller operational snapshot; everyone else gets only ok/degraded, on
  purpose.
- Suggested interval: 5 minutes.

## 2. Dead man's switch (is the scheduler alive?)

The uptime check above cannot tell you the cron Worker died — the site keeps
serving perfectly while every scheduled job silently stops. That is the more
dangerous failure, because payouts, settlement, reminders and the digest all
live there.

`workers/cron.ts` pings an outbound URL only after **every job in the matched
scheduled batch succeeds**. A missing ping therefore detects both a stopped
scheduler and a failed or timed-out cron route.

1. Create a check on any dead-man's-switch service — [Healthchecks.io] has a
   free tier that is more than adequate.
2. Set **period: 10 minutes**, **grace: 10 minutes**. The `*/5` schedule fires
   twice inside the period, so a single missed run does not page you.
3. Store the ping URL:

   ```
   wrangler secret put HEARTBEAT_URL --config wrangler.cron.toml
   ```

4. Deploy the cron Worker: `wrangler deploy --config wrangler.cron.toml`

If `HEARTBEAT_URL` is unset the ping is skipped silently, so this is safe to
leave unconfigured — you simply have no scheduler alarm until you set it.

Individual job outcomes are also sent to `report-failure`, so the admin
health view identifies the failing route while the missing heartbeat provides
the independent external alert.

[Healthchecks.io]: https://healthchecks.io

## 3. Alert recipients

`ADMIN_ALERT_EMAIL` accepts a **comma-separated list**:

```
wrangler secret put ADMIN_ALERT_EMAIL
# e.g. colin@example.com,second-operator@example.com
```

Everything operational routes through `getAdminAlertRecipients()` — payout
failures, backup verification, cron outage alerts, the workbench digest, the
daily ops report. With a single address, one person on a plane means nobody
is watching. An unparseable value falls back to `admin@ihype.org` rather than
to nothing, because alerts going to one place beats alerts going nowhere.

Note this must be a **Worker secret or var**, not a `.env` entry: values that
only exist in `process.env` are invisible inside the Worker runtime, which is
why `getAdminAlertRecipients()` reads through `readRuntimeEnv()`.

## 4. Sentry

Configured and receiving. Two things worth knowing:

- **Server-side reporting depends on `log.error`**, not `console.error`. Only
  the former reaches Sentry; the latter lands in Worker logs that nobody
  tails. All 98 server error sites use `log.error`. The two deliberate
  exceptions are the logger's own stdout emit and `defer-work.ts`, which the
  logger imports.
- **Local development is filtered out.** A `wrangler dev` session loads the
  same `wrangler.toml`, so it has the real DSN and reports itself as
  `environment: production`. `beforeSend` drops events from local hostnames,
  including those with no request URL attached, which is most of what
  `log.error` captures from library code.

Triage matters more than volume here. An untriaged Sentry inbox stops being
read, at which point it is equivalent to having no Sentry.

## What is still missing

- **No second ADMIN account.** `isAdminSession()` is `role === 'ADMIN'`;
  a second address on `ADMIN_ALERT_EMAIL` receives alerts but cannot act on
  them. Promote a second user before relying on the alert routing above.
- **Restore has never been tested.** `backup-verify` runs daily and checks
  that a backup exists; nothing has ever restored one. A backup you have not
  restored is a hypothesis.
