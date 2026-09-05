# Store submission pack — App Store and Google Play

Everything to paste into the two consoles, with the privacy answers derived
from the schema and the code rather than from what an app like this usually
collects. Where a field is a judgement call, the reasoning is next to it.

**Keep this file the source of truth.** If you change an answer in a console,
change it here too — the two privacy questionnaires are separately submitted
and separately auditable, and the fastest way to fail a review is to have them
disagree with each other or with `/info?tab=privacy`.

Last checked against the code: 2026-09-05.

---

## Identity

| | |
|---|---|
| App name | iHYPE |
| Bundle / package id | `com.ihype.app` |
| Apple Team ID | `662XY74534` (Organization, fee waived) |
| Play developer account | `5245611846667919029` (Organization, iHYPE) |
| Owner / support address | admin@ihype.org |
| Marketing URL | https://ihype.org |
| Privacy policy | https://ihype.org/info?tab=privacy |
| Terms | https://ihype.org/info?tab=terms |
| **Account deletion (Play requires this)** | https://ihype.org/delete-account |
| Support | https://ihype.org/support |

---

## Google Play — store listing

**App name** (30 max)

```
iHYPE
```

**Short description** (80 max — currently 79)

```
Local live music: hear artists near you, hype them, and get tickets to the show
```

**Full description** (4000 max)

```
iHYPE is where local live music gets heard, hyped and booked.

Listen to artists near you on an always-on station, follow the ones you like,
and hype the acts you want to see play. When enough people want the same act at
the same venue, the venue sees it — and books the show.

FOR FANS
· An always-on station of local music, plus a map of what is on near you
· Hype an artist or a show to add your voice to who gets booked next
· Ask a venue to bring an artist you love — venues see that demand ranked
· Buy tickets, hold them in the app, and open them at the door with no signal
· Transfer a ticket to a friend if your plans change

FOR ARTISTS AND VENUES
· A profile page with your music, dates and press kit
· Upload tracks and albums, release now or schedule a date
· See who is listening, who is hyping, and which venues fans want you at
· Sell tickets with the split agreed before the show

THE SPLIT
70% artist, 20% venue, 10% promoters, 0% iHYPE. That is in our charter, not our
pricing page. iHYPE is a nonprofit and takes nothing from a ticket.

Founded in Portland, Maine.
```

**Category** Music & Audio · **Tags** live music, local, tickets, radio
**Contact** admin@ihype.org · https://ihype.org

---

## Google Play — Data Safety

Answers taken from `prisma/schema.prisma`, `src/app/api/privacy/export/route.ts`
and `src/lib/privacy-actions.ts`. "Collected" means it leaves the device and is
stored; "shared" means it goes to a third party for their own use.

| Data type | Collected | Shared | Required | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Optional | Account, public profile. Fans are not asked for one at signup |
| Email address | Yes | No | Optional | Sign-in link delivery, receipts. A passkey-only account has none |
| User IDs | Yes | No | Required | Account |
| Purchase history | Yes | No | Optional | Ticket orders and payouts |
| Payment info | **No** | — | — | **Card details never reach iHYPE.** Stripe Checkout is hosted by Stripe; we store only Stripe's identifiers |
| Approximate location | Yes | No | Optional | Show a map of shows near you, and rank fan demand by distance |
| Precise location | **No** | — | — | The map asks the OS for a position to centre on and does not store it; what is stored is a city/region |
| Photos | Yes | No | Optional | Profile and artwork images uploaded by the member |
| Audio files | Yes | No | Optional | Tracks uploaded by artists |
| App activity (in-app search, other actions) | Yes | No | Optional | Listening history, hypes, follows, recommendations |
| App interactions / analytics | Yes | No | Optional | Product analytics |
| Crash logs and diagnostics | Yes | Yes | Optional | Sentry, for error reporting |
| Device or other IDs | Yes | No | Optional | Push notification tokens |
| Contacts, calendar, SMS, call logs, health, financial account info | **No** | — | — | Never requested |

**Security practices** — data is encrypted in transit; members can request
deletion at https://ihype.org/delete-account; the app has been independently
reviewed against Play's Families policy: not applicable (13+).

**Deletion URL** https://ihype.org/delete-account

**Ads declaration — YES, the app contains ads.** iHYPE runs paid audio spots in
the station. They are first-party (bought through `/advertise`, screened by us)
and there is no third-party ad SDK, but "contains ads" is about what a listener
hears, not who sold it.

**Content rating** Answer the questionnaire honestly and expect Teen / PEGI 12:
there is user-generated content (profiles, comments, uploaded audio), it is
moderated, users can interact, and location is shared with other users only as
a city.

**Target audience** 13+. The app collects a 13-or-older attestation at signup
(`User.isThirteenOrOlder`) and an 18-or-older one where money is involved.

---

## App Store — listing

**Name** (30 max)

```
iHYPE
```

**Subtitle** (30 max — currently 28)

```
Local live music and tickets
```

**Promotional text** (170 max, editable without a new build)

```
Hear artists playing near you, hype the ones you want on a stage, and get tickets when the show gets booked. 70% of every ticket goes to the artist.
```

**Keywords** (100 max, comma separated, no spaces — currently 97)

```
live,music,local,concerts,gigs,tickets,shows,venue,artist,band,radio,indie,discover,nearby,events
```

**Description** — reuse the Play full description above; it is within 4000 and
carries no Android-specific wording.

**Support URL** https://ihype.org/support · **Marketing URL** https://ihype.org

---

## App Store — App Privacy

Apple's questionnaire is separate from the binary's `PrivacyInfo.xcprivacy` and
**must not contradict it**. Apple splits each type by whether it is *linked to
identity*, and the honest answer differs by type here — do not declare them all
the same way.

**Linked to the user**

- **Contact Info** — name, email address
- **User Content** — photos, audio, other user content (profiles, comments)
- **Identifiers** — user ID, device ID (push token)
- **Purchases** — purchase history
- **Location** — coarse location
- **Diagnostics** — crash data, performance data (Sentry can carry request
  context, so declare it linked rather than argue the point in review)

**NOT linked to the user**

- **Usage Data** — product interaction. Verified in `src/lib/analytics.ts`:
  `trackEvent` writes only the event name and sanitised props to Cloudflare
  Analytics Engine, with no user id and no IP address, and the ingest route is
  unauthenticated by design so pre-login events are counted too. There is
  nothing in the record to link.

**None of it is used for tracking.**

**"Do you or your third-party partners use data for tracking?" — No.** There is
no ad network SDK, no IDFA request, and no cross-app or cross-site profile. The
audio ads are sold and served by iHYPE itself.

---

## Review notes — paste into both consoles

```
iHYPE is a nonprofit platform for local live music. Fans discover artists
playing near them, "hype" the acts they want to see, and buy tickets. Artists
and venues publish profiles and sell tickets under a fixed 70/20/10 split.

SIGN-IN FOR REVIEW
The app has no passwords by design — members sign in with a passkey or a
one-time link sent to their email. Neither reaches a reviewer, so we have
issued a pre-minted sign-in link for you:

  <PASTE THE MINTED REVIEW LINK HERE>

Open it in the app (or in a browser on the review device) and you will be
signed in as a normal member account. The link works several times and expires
on its own.

TICKET PURCHASES
Ticket sales are for real-world admission to live events, so In-App Purchase
does not apply (App Store Review Guideline 3.1.3(e) / 3.1.5(a)). Checkout is
Stripe-hosted. Ticketing is disabled in the review environment unless you ask
us to enable it — email admin@ihype.org and we will turn it on for your test
account.

PERMISSIONS
· Location — used to centre the map on where you are. Declining leaves the map
  on a default region and everything else works.
· Notifications — asked only after a first ticket, never at launch. Declining
  costs nothing; every notice is also in the in-app centre.

ACCOUNT DELETION
Settings → Delete account, or https://ihype.org/delete-account.

Questions: admin@ihype.org
```

---

## Assets still needed

Neither store accepts a submission without these, and none of them can be
generated from this repository.

**Google Play**
- App icon 512×512 PNG, 32-bit, no alpha
- Feature graphic 1024×500 PNG or JPEG
- At least 2 phone screenshots (16:9 or 9:16, 320–3840px on the short side)
- Optional but recommended: 7-inch and 10-inch tablet screenshots

**App Store**
- 6.7-inch iPhone screenshots (1290×2796) — at least 3
- 13-inch iPad screenshots if iPad is supported in the build
- App icon comes from the binary, not uploaded separately

The screens worth showing, in order: the map with pins, an artist profile with
the play control, the station playing, a ticket with its QR, and the demand
radar on a venue dashboard. That sequence tells the whole product story without
a word of marketing copy.

---

## Order of operations

1. **Play** — create the app, upload the first `.aab` by hand to Internal
   testing (the API refuses an app with no release), then fill the listing,
   Data Safety, content rating and ads declaration.
2. Take the **App signing** SHA-256 from Test and release → Setup → App signing
   and set it as the Worker secret `ANDROID_CERT_SHA256_FINGERPRINTS`. Not the
   upload key's fingerprint — Google re-signs, and the wrong one fails silently.
3. **Apple** — set `APPLE_TEAM_ID` (`662XY74534`) as a Worker secret so
   `/.well-known/apple-app-site-association` stops answering 404, then push a
   build to TestFlight and fill App Privacy.
4. Mint the review link from `/admin` → System, paste it into both sets of
   review notes, and submit.
