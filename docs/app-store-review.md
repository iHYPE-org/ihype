# App Store / Play review pack

Everything a reviewer asks for, in the order the forms ask for it. Ported from
Design System 8's `templates/app-store-kit/` (`kind="review"`), with every claim
checked against this repository rather than copied.

**Read the note at the bottom before submitting: three items still need a human.**

---

## 1 · Why ticket sales use Stripe and not In-App Purchase

This is the most likely review question, so it goes first.

Tickets are admission to **real, in-person events** — a service consumed outside
the app. Under App Store Review Guideline **3.1.3(e)** ("Goods and Services
Outside of the App") and Google Play's payments policy, these are not digital
content, so In-App Purchase does not apply and Stripe is the correct processor.

Supporting facts a reviewer can verify in the app:

- **iHYPE takes $0 from the ticket price.** The split is 70% artist / 20% venue /
  10% promoter pool, published at `/info?tab=charter` and shown per event at
  `/payout/<id>`.
- The only amount added at checkout is **Stripe's processing fee**, disclosed as
  its own line before payment (`src/lib/stripe-fees.ts`). iHYPE is a nonprofit
  and absorbs no fee: the fee is grossed up so that Stripe's cut leaves face
  value and taxes intact, it is excluded from the 70/20/10 split, and it is
  retained on refunds because Stripe keeps it.
- There is **no digital-only content, subscription, or unlockable feature**
  anywhere in the app. Nothing is sold that is consumed inside it.

## 2 · Demo account

App Review Information (Apple) and Play Console → App content.

| Field | Value |
|---|---|
| Email | `admin@ihype.org` — **see the note below; this is not a reviewer inbox** |
| Password | Supplied in App Review Information, never in this file or the repo |
| Role | Fan. Artist/Venue are reachable via **Me → Profiles** |

The account must stay seeded with **one upcoming show and one purchased ticket**,
or the reviewer cannot see the wallet, the QR code, or the payout breakdown —
the three things most likely to be questioned.

> The design system's kit uses `review@ihype.app` as the demo address. That is a
> placeholder **and it contradicts a brand constant**: `admin@ihype.org` is the
> only email address and `ihype.org` the only domain this project uses. Create a
> real reviewer account on the live domain before submitting; do not ship the
> `.app` address.

## 3 · Permission strings, verbatim

These are what the OS shows. They must match what the in-app primer promises —
if the primer says "coarse, city-level" and the OS string implies precise
tracking, the reviewer sees a contradiction. The primer copy lives in
`src/lib/permission-primers.ts`.

| Key | String |
|---|---|
| `NSLocationWhenInUseUsageDescription` | iHYPE uses your location to show gigs happening near you. Skip it and we'll use your home city instead. |
| `NSCameraUsageDescription` | iHYPE uses the camera to scan ticket codes at the door. Only used when you tap Scan. |
| `NSPhotoLibraryAddUsageDescription` | Save a ticket code to your photos so it works with no signal. |

Android equivalents: `ACCESS_COARSE_LOCATION` (not `ACCESS_FINE_LOCATION` — the
app asks for and uses coarse only), `CAMERA`, and `POST_NOTIFICATIONS`.

**Every one of these can be refused and the app still sells and shows a ticket.**
That is enforced, not aspirational: `src/lib/__tests__/permission-primers.test.ts`
fails if a ticket surface reaches a native API directly.

## 4 · Privacy labels · Data Safety

- **Linked to you:** contact info (email), purchase history, user content
  (profile, hypes), identifiers (account ID).
- **Not linked to you:** coarse location, diagnostics.
- **Used for tracking: nothing.** No third-party ad SDK, no advertising
  identifier, no cross-app tracking, and therefore **no ATT prompt**. The
  advertising product on this platform is audio spots sold to advertisers; it
  does not profile listeners and has no access to personal data.
- **Deletion:** in-app at **Me → Settings → Account → Delete**
  (`POST /api/settings/delete-account`, typed confirmation required), plus a web
  route for the one Play requires — see the note below.

## 5 · Age rating

**Apple 12+ · IARC Teen.** Infrequent mild profanity in user-supplied artist
names and track titles; user-generated content with reporting and blocking;
references to venues that serve alcohol, with no sale of alcohol in the app. No
gambling and no loot mechanics. An account is required and free to create. Some
listings are 21+ at the venue's door and are labelled as such.

Moderation evidence, if asked: `/info?tab=trust` publishes aggregate report and
enforcement counts, and every upload runs the four-layer scan in
`src/lib/media-vetting.ts` before it can be published.

## 6 · What the native shell actually is

Worth stating plainly, because it affects what review covers.
`capacitor.config.ts` points a WebView at `https://ihype.org`. The store binary
is a thin shell; the product is the site. A web deploy reaches both apps in
about two minutes with no review, and review only re-enters for shell changes —
icon, splash, a new native plugin.

---

## Still needs a human before submitting

1. **A real reviewer account.** `admin@ihype.org` is the platform's admin
   address, not a demo login — submitting it would hand a reviewer administrator
   access. Create a fan account on `ihype.org`, seed it with one upcoming show
   and one purchased ticket, and put its credentials in App Review Information.
2. **The web deletion URL.** Play requires an account-deletion route reachable
   without installing the app. The in-app path exists; confirm the public URL
   and put it here. The design system's `ihype.app/delete` is a placeholder on
   the wrong domain.
3. **The location fallback city.** The kit assumes Portland, ME. Confirm that is
   what the app falls back to when location is refused, and that Settings lets a
   member change it — the denied-state copy promises exactly that.

---

## Blocked on credentials nobody in a code session has (2026-08-22)

Everything above is written; these four cannot be, because each needs a value
that lives in an account rather than in this repository. Ordered by what they
break.

### 1 · Push cannot deliver — no APNs key, no FCM configs

`@capacitor/push-notifications` is installed, `NativePushRegistration.tsx` calls
it, and Android 13+'s `POST_NOTIFICATIONS` is declared in the manifest. What is
absent:

| File / value | Where it comes from | Consequence while absent |
|---|---|---|
| `ios/App/App/GoogleService-Info.plist` | Firebase console → iOS app | iOS registration fails silently |
| `android/app/google-services.json` | Firebase console → Android app | Android build has no FCM sender |
| APNs auth key (`.p8`) + key id + team id | Apple Developer → Keys, uploaded to Firebase | APNs cannot sign a push |

This is not only a feature gap. **Push and location are the defence against
Apple guideline 4.2** ("minimum functionality" / "just a website") — `server.url`
points the WebView at production, which is the property that makes a web deploy
reach both stores in two minutes and also the shape Apple rejects. Both should
work before the first submission, not after the first rejection.

### 2 · Universal links are unverified — no Team ID, no signing fingerprint

`assetlinks.json` and `apple-app-site-association` are **deliberately not in the
repository**. Both are verified by the OS against values that are not knowable
from source: Apple's needs the 10-character Team ID, Android's needs the SHA-256
of the certificate Play actually signs with.

A placeholder would be worse than nothing: with no file, verification does not
happen and links open in the browser — degraded but honest. With a malformed file
present, both platforms cache the failure and the app looks broken for days.

So they are generated, and the generator refuses anything it cannot verify the
shape of (a SHA-1 fingerprint pasted from the same Play Console screen is the
commonest mistake and is rejected by length):

```bash
npm run app-links:write -- --team-id ABCDE12345 --sha256 AA:BB:…:FF
npm run check:app-links      # verifies what is on disk
```

Then commit both files, deploy, and confirm they serve from
`https://ihype.org/.well-known/` with a 200 and no redirect.

### 3 · The signed-release jobs have never run

`.github/workflows/native-build.yml` skips with a notice until its 12 secrets are
set (names documented inline in the workflow). The iOS build number is injected
from `github.run_number` — App Store Connect rejects a duplicate, so the second
TestFlight upload would have failed without it. Nothing here needs code; it needs
the certificates and profiles.

### 4 · The privacy manifest declares the binary, not the app

`ios/App/App/PrivacyInfo.xcprivacy` is wired into `project.pbxproj` in four
places including the Resources build phase — without that last one it ships in no
`.ipa` and is rejected exactly as if it had never been written. **The App Privacy
questionnaire in App Store Connect is separate, filled in by hand, and must not
contradict it.** §4 above is the source for both.
