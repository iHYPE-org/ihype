# Store submission pack — App Store and Google Play

Everything to paste into the two consoles, with the privacy answers derived
from the schema and the code rather than from what an app like this usually
collects. Where a field is a judgement call, the reasoning is next to it.

**Keep this file the source of truth.** If you change an answer in a console,
change it here too — the two privacy questionnaires are separately submitted
and separately auditable, and the fastest way to fail a review is to have them
disagree with each other or with `/info?tab=privacy`.

Last checked against the code: 2026-09-09 — and against the live production
endpoints and the workflow run history, which is how several of the steps below
turned out to be already done. **Re-check before quoting any status line here.**
Three of them had gone stale within two days of being written, and a submission
pack that overstates what is left is the same problem as one that understates
it: on 09-07 this file asked for a Play icon that was already in the repository,
and told Apple that ticketing was switched off when it had been live since
08-31.

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

CREATING A NEW ACCOUNT
iHYPE is in closed alpha, so public signup is invite-only: "Request access" on
the landing page files a request an administrator approves by hand. That is
deliberate, not a fault. If you want to walk the signup flow yourself, use one
of these single-use invite codes — each admits one account, so please use a
fresh one per attempt:

  <PASTE INVITE CODE 1>
  <PASTE INVITE CODE 2>
  <PASTE INVITE CODE 3>

Enter one at https://ihype.org/register. Signup opens to everyone at public
beta; nothing about the app changes when it does.

TICKET PURCHASES
Ticket sales are for real-world admission to live events, so In-App Purchase
does not apply (App Store Review Guideline 3.1.3(e) / 3.1.5(a)). Checkout is
Stripe-hosted and is live: a ticket bought in review is a real purchase against
a real card. If you would rather not complete one, tell us at admin@ihype.org
and we will stand up a free-entry event for your account so you can walk the
whole flow end to end without a charge.

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

**Screenshots CAN be generated from this repository — that is new as of
2026-09-07 and this section said the opposite.** `npm run store:screenshots`
drives the real signed-in product against a built worker at both stores' exact
frame sizes, using the same session fixture and proxy handling `measure:layout`
has used since 2026-08-25. The claim below that "none of them can be generated
here" was never tested; the machinery was already in the repository.

The exact sequence, because two of these steps are not optional and were both
learned by producing unusable frames (2026-09-09):

```
npm run seed:preview                     # 13 profiles, 26 tracks, 8 shows
node scripts/e2e-workerd.mjs --serve     # in another shell
npm run store:screenshots -- --out=store-shots \
  --artist=preview-the-brine --venue=preview-state-theatre
```

**Without `--artist=` and `--venue=` the script photographs the signed-in
user's OWN profile**, which renders the owner view — an upload form, every
counter at zero — and sails through the emptiness guard, because a form is
plenty of text. The script now warns loudly when it falls back; the flags are
what you actually want.

**The map frame cannot be produced from a sandboxed environment.** Chromium's
connection to `basemaps.cartocdn.com` is reset by the agent proxy (Node's is
not — see the `maplibre` row in CLAUDE.md), so `/app/map` captures as bare
parchment with "The map could not load". The map works in production; shoot
that frame from a machine with unrestricted egress, or from a device.

And **look at every frame before uploading**: the script refuses an obviously
empty one, but it cannot judge a page that is merely thin — nor tell an error
message from content, which is how the failed map frame counted as "0 flagged
thin". A store listing is the one place where an empty fixture is
indistinguishable from an empty product.

**The icon is NOT outside this repository, and this line used to say it was
(corrected 2026-09-09).** Only the Play feature graphic is genuinely missing.
What already exists, measured rather than assumed:

| Asset | Where | Measured |
|---|---|---|
| Play icon 512×512 | `public/icons/icon-512.png` | 512×512, colour type 2 — 24-bit RGB, no transparency. Play documents a **32-bit** PNG and refuses a transparent icon (it applies its own mask), so the no-transparency half is satisfied and the bit depth is the uncertain half. If the upload bounces, re-encode rather than redesign: `scripts/store-icon-32bit.mts` writes an identical 512×512 in colour type 6 with every alpha byte opaque |
| iOS app icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 1024×1024, no alpha. Ships inside the binary; Apple takes no separate upload |
| Android launcher | `mipmap-*/ic_launcher_foreground.png` at all five densities, over `ic_launcher_background` `#ffffff` | a real adaptive icon, not Capacitor's default |
| **Play feature graphic 1024×500** | — | **missing. Artwork, and the one asset nothing here can produce.** |

The white launcher background is the brand ground (2026-09-05, the Apple Music
skin), not a placeholder — do not "fix" it to something darker without checking
`--bg` first. What no check here can tell you is whether the mark reads at 48dp
on a home screen; look at the debug APK on a real device before you ship it.

**Invite codes for the review notes** — not an asset, but the same kind of
thing: mint them in `/admin/users` → Access requests, or `POST
/api/admin/invite-codes`, and paste them into the block above. **Mint three,
not one.** They are single-use and consumed on signup, so one fumbled attempt
strands a reviewer at the wall and costs a review cycle. See
`docs/runbooks/alpha-to-beta.md` for what the gate is and the one key that
opens it for beta.

**Google Play**
- ~~App icon 512×512 PNG, 32-bit, no alpha~~ — in the repository, see the table above
- Feature graphic 1024×500 PNG or JPEG — **still needed**
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

0. **Push should work before you submit, and it is the only remaining item that
   is about the product rather than paperwork.** The standing approval risk is
   Apple guideline 4.2: `server.url` points the WebView at production, which is
   what makes a web deploy reach both stores in two minutes and also the shape
   Apple rejects as "just a website". Push and location are the defence, and a
   reviewer can check both. Two operator legs remain — the APNs `.p8` uploaded
   in Firebase, and the `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY`
   Worker secrets. `docs/runbooks/push-setup.md` has the sequence and explains
   why the second leg is the one that bites: without it, devices register
   tokens, the console reads healthy, and nothing is ever delivered. **Read the
   live answer at `/admin` → System (`integrations.nativePush`) rather than
   inferring it** — `/api/health` gives an unauthenticated caller liveness only.
1. **Play — creating the app and the first upload are DONE.** The evidence is
   step 2: Play only exposes an app-signing certificate once a bundle has been
   uploaded and Play App Signing is on, and those fingerprints are live in
   `assetlinks.json` today. What is left here is the listing, Data Safety,
   content rating and the ads declaration.
2. **DONE 2026-09-08.** Take the SHA-256s from **Protected with Play → App
   signing** (the `/keymanagement` page — NOT "Test and release → Setup → App
   signing", which no longer exists, nor "App integrity", which now only says
   the settings moved) and set them comma-separated as the Worker secret
   `ANDROID_CERT_SHA256_FINGERPRINTS`. Set **both** the App signing key
   certificate and the Upload key certificate — with only the Play one, store
   installs verify and your own local installs do not, which reads as
   flakiness. A quantum-ready key adds a third; extra correct entries are
   harmless because Android matches against any of them. Never the SHA-1 rows.
   `https://ihype.org/.well-known/assetlinks.json` now answers 200 with three
   fingerprints, and `npm run check:app-links` verifies the live origin.
3. **Apple — steps 1 and 2 of this are DONE (verified 2026-09-07).**
   `APPLE_TEAM_ID` is set: `/.well-known/apple-app-site-association` answers
   **200** in production with `662XY74534.com.ihype.app`. And a build was
   **already uploaded to TestFlight** on 2026-09-05 (run `33977825909`, step
   "Upload to TestFlight — success"). What is left on the Apple side is App
   Privacy, screenshots and the submission itself.
4. Mint the review link from `/admin` → System **and three single-use invite
   codes** from `/admin/users` → Access requests, paste both into the review
   notes above, and submit. The link is few-use by design (12 redemptions, 60
   days — `src/lib/review-access.ts`); the invite codes are single-use, which is
   why three.

**What is NOT left, so nobody re-does it:** every signing secret works. Native
build run 307 (2026-09-09, off `main`) produced a signed `.ipa` and a signed
`.aab`; both upload steps were skipped only because the dispatch had
`publish=false`. `npm run check:app-links` passes against production for both
platforms. A build has been on TestFlight since 2026-09-05. To publish, dispatch
the workflow with `publish=true` — iOS goes to TestFlight and Android to Play
from the one run. `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is still unset and only
automates the Play half; a hand upload needs no secret at all.
