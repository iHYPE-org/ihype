# Runbook — native push (APNs + FCM)

**Push has three legs, and only one of them is code.** The code half is done
and has been for a while: `NativeDeviceToken` in the schema,
`POST /api/push/register-device`, and `sendPushToAllDevices` in
`src/lib/notify.ts` reaching `src/lib/native-push.ts`, which sends over the
FCM v1 HTTP API. Nothing there needs writing.

Last verified against the code: 2026-09-09.

| Leg | What | Where it lives | Status |
|---|---|---|---|
| 1 | `google-services.json`, `GoogleService-Info.plist` | in this repository | **done** (2026-09-09) |
| 2 | APNs `.p8` auth key | uploaded in the Firebase console | operator |
| 3 | `FCM_PROJECT_ID` · `FCM_CLIENT_EMAIL` · `FCM_PRIVATE_KEY` | Cloudflare Worker secrets | operator |

Firebase project **`ihype-d2083`** (project number `707299188578`). Bundle id
and package name are both **`com.ihype.app`**.

---

## Why leg 3 is the one that bites

Legs 1 and 2 are the half everyone thinks of, and together they are enough to
make a device produce a token and store it. **They are not enough to deliver
anything.** `native-push.ts` reads three Worker secrets and, when any is
missing, logs and returns:

```
[native-push] FCM service account not configured — skipping native push for user <id>
```

So the failure mode is an app that registers device tokens perfectly, an admin
console that looks healthy, and not one notification ever arriving. Set leg 3
at the same time as leg 2, not later.

**Read them through `readRuntimeEnv`, never `process.env`.** These are Worker
*secrets*, and on workerd a secret never appears on `process.env` — it is only
reachable through the Cloudflare env binding. Read the old way, all three are
`undefined` in production and the guard above no-ops push permanently no
matter how correctly the secrets are set. That is the same latent fault that
had transactional email dead for 36 days; `native-push.ts` already does this
correctly and must keep doing it.

## Leg 2 — the APNs auth key

1. developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → **+**
2. Tick **Apple Push Notifications service (APNs)** → Continue → Register
3. **Download the `.p8`. Apple allows this once.** Store it somewhere durable —
   losing it means revoking the key and issuing another. Note the **Key ID**
   (10 characters); the Team ID is `662XY74534`.
4. Firebase console → Project settings → **Cloud Messaging** → the iOS app →
   **APNs Authentication Key** → Upload: the `.p8`, the Key ID, the Team ID.

An auth key is preferred over an APNs certificate: one key serves every app on
the team and does not expire, where a certificate is per-app and expires
annually — an expiry that presents as push silently stopping.

## Leg 3 — the service-account secrets

1. Firebase console → Project settings → **Service accounts** →
   **Generate new private key**. A JSON downloads.
2. **That JSON is a credential.** It never enters this repository, a chat, or a
   file in the working tree. Only three of its fields are needed:

```
npx wrangler secret put FCM_PROJECT_ID     # the JSON's project_id
npx wrangler secret put FCM_CLIENT_EMAIL   # its client_email
npx wrangler secret put FCM_PRIVATE_KEY    # its private_key
```

The dashboard is equivalent: Workers & Pages → ihype → Settings → Variables
and Secrets. A dashboard secret survives deploys exactly as a
`wrangler secret put` one does.

**On `FCM_PRIVATE_KEY`:** it is a multi-line PEM. `wrangler secret put` prompts
and accepts a paste containing real newlines. `native-push.ts` also applies
`.replace(/\\n/g, '\n')`, so a single-line form with escaped `\n` works too.
**Use one or the other.** Pasting real newlines into an already-escaped string
produces a key that parses as neither.

## Reading whether legs 1 and 3 are set

`GET /api/health` reports **`integrations.nativePush`** — true when all three
secrets are readable by the Worker. The detail is admin-scoped; the public
payload is only `{status, scope}`, so read it signed in as an administrator.

**It reports CONFIGURATION, not delivery**, and the distinction is the whole
point: FCM proxies to APNs for iOS solely once the auth key of leg 2 is
uploaded, and that is Apple-side state nothing here can see. A green reading
with no APNs key means Android works and iOS silently does not.

## Proving it works

Configured is not delivered, and every layer here fails quietly, so walk it:

1. Install the build on a **real device** — the simulator cannot receive APNs.
2. Sign in, open a ticket at `/app/me/tickets/<id>`. `PushPrimerOnTicket`
   renders our own sheet; accept it, then accept the OS prompt behind it.
3. Confirm a `NativeDeviceToken` row exists for that user. No row means the
   client never registered — leg 1, or the permission was declined.
4. Trigger something that calls `sendPushToAllDevices`.
5. Nothing arrives → read the Worker log. `FCM service account not configured`
   is leg 3. An FCM `404` for the token means the token is stale and
   `native-push.ts` prunes it. Anything else on iOS specifically points at
   leg 2, since FCM only proxies to APNs once the key is uploaded.

## What is already handled, so nobody re-does it

- **`aps-environment`** is claimed in `ios/App/App/App.entitlements` as
  `development`, which is correct for debug *and* TestFlight — Apple promotes
  the token when the build reaches the App Store, and a build claiming
  `production` cannot receive a development push.
- **`UIBackgroundModes: remote-notification`** is in `Info.plist`.
- **The App ID carries Push Notifications**, registered 2026-09-04. An
  entitlement the App ID lacks fails `xcodebuild -exportArchive` outright.
- **`POST_NOTIFICATIONS`** is declared in the Android manifest; without it
  Android 13+ never shows the prompt at all.
- **`GoogleService-Info.plist` is in the Xcode Resources build phase**, not
  merely on disk. Only that phase puts a file in the `.ipa`;
  `PrivacyInfo.xcprivacy` shipped in nothing once for exactly this reason.
  `wiring-guards.test.ts` now asserts membership for both files.
