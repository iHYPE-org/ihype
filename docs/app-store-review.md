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
