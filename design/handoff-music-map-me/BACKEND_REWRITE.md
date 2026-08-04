# Backend rewrite — migration spec

> Authoritative spec for the backend changes required by the Music/Map/Me simplification.
> Supersedes the DJ-related sections of `BACKEND_SPEC.md`, `schema.sql`, and `openapi.yaml`.

The charter math is **unchanged**: 70% artist / 20% venue / 10% promoter pool / 0% iHYPE, snapshotted at door-close. Do not touch the settlement job's arithmetic. Everything below is about roles, radio, and auth.

---

## 1. Roles: drop DJ, add Advertiser

### Enum change

```sql
-- was: ('fan','artist','dj','venue')
CREATE TYPE role AS ENUM ('fan','artist','venue','advertiser');
```

Postgres can't remove an enum value in place. Migrate:

```sql
ALTER TYPE role RENAME TO role_old;
CREATE TYPE role AS ENUM ('fan','artist','venue','advertiser');

-- Reassign every DJ to fan+artist before the cast.
-- DJs were creators with a promoter mechanic; 'artist' preserves upload rights,
-- and the promoter mechanic is role-independent now (see §3).
UPDATE user_roles SET role = 'artist' WHERE role = 'dj';

ALTER TABLE user_roles
  ALTER COLUMN role TYPE role USING role::text::role;
DROP TYPE role_old;
```

**Audit first.** Count affected accounts and confirm the reassignment with the operator before running — a DJ who never uploaded a track shouldn't silently gain artist verification standing. Consider `artist_verified = false` for reassigned accounts so they re-verify.

### Fan is implicit and permanent

Every account holds `fan` from creation. It cannot be removed. Enforce in the DB, not just the API:

```sql
-- Fan row is created with the user and can never be deleted
CREATE OR REPLACE FUNCTION protect_fan_role() RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'fan' THEN
    RAISE EXCEPTION 'fan role cannot be removed';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER no_fan_removal BEFORE DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION protect_fan_role();
```

### Advertiser role

New profile extension:

```sql
CREATE TABLE advertisers (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name     text NOT NULL,
  category         text NOT NULL,   -- label|venue_promoter|gear|ticketing|merch|tour_support
  contact_email    text NOT NULL,
  industry_checked boolean NOT NULL DEFAULT false,
  approved_at      timestamptz,
  rejected_reason  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

Advertisers are **music-industry only** — this is a hard product constraint, not a guideline. The existing three-gate ad screening (buyer vetting → music relevance → copyright firewall) stays as specified; the role just gives an account standing to submit campaigns.

---

## 2. Radio: stations replace DJ shows

### Drop

```sql
DROP TABLE crate_items;      -- DJ working sets
DROP TABLE radio_shows;      -- DJ-hosted show records
DROP TABLE sfx_library;      -- only existed for DJ voice/SFX segments
DROP FUNCTION assert_free_use();  -- crate-only constraint
```

**Preserve before dropping** if any shows were ever published — archived shows were promised as permanent, and artists opted tracks in on that basis. Export `radio_shows` to cold storage and keep the `tracks.radio_eligible` flag meaningful (see below). If nothing was ever published in production, drop cleanly.

### Add

```sql
CREATE TYPE station_kind AS ENUM ('for_you','local','new','friends','genre');

CREATE TABLE stations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        station_kind NOT NULL,
  slug        text UNIQUE NOT NULL,     -- 'for-you','local','new','friends','dream-pop',...
  title       text NOT NULL,
  subtitle    text NOT NULL,
  genre       text,                     -- non-null only when kind='genre'
  sort_order  int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);
```

Stations are **computed, not curated playlists.** There is no join table of station→track. Each kind resolves at request time:

| Kind | Resolution |
|---|---|
| `for_you` | Tracks matching the user's hype history and replay counts, taste-weighted |
| `local` | Tracks by artists within 40 miles of the user's city |
| `new` | Tracks with `published_at` inside the last 7 days |
| `friends` | Tracks hyped or shared by accounts the user follows |
| `genre` | Tracks matching `stations.genre` |

All resolutions filter on `tracks.radio_eligible = true`.

### Track eligibility

The artist opt-out is **preserved and still matters** — it was a deliberate protection for emerging artists, who can decline inclusion so their work doesn't end up in permanent archives.

```sql
-- Keep this column. Rename from free_use if that was the old name.
ALTER TABLE tracks RENAME COLUMN free_use TO radio_eligible;
```

Semantics: `radio_eligible = false` excludes the track from every station. Set at upload, editable afterward, but **already-archived inclusions are immutable** — flipping the flag off affects future station resolution only. Surface that clearly in the UI (the prototype copy already does).

---

## 3. Promoting is role-independent

This was already true in spirit but the schema hinted otherwise. `referrals.promoter_id` had a comment reading `-- DJ or Fan`. Correct it:

```sql
COMMENT ON COLUMN referrals.promoter_id IS
  'Any user. Promoting requires no role — every account can share a HYPE link.';
```

No signup, no verification, no account type. Any Fan, Artist, or Venue earns from the 10% pool by sharing a link. Do not add a promoter role, and do not gate referral creation on role.

**HYPE link.** Every account gets a permanent handle-based link (`ihype.org/h/<handle>`) in addition to per-event referral codes. Fans use this as their primary social surface now that the fan page creator is gone:

```sql
ALTER TABLE users ADD COLUMN handle text UNIQUE;
-- Backfill from display_name, slugified, with numeric disambiguation
```

Attribution: a visit through `/h/<handle>` sets a first-party attribution cookie; a subsequent ticket purchase within the attribution window credits that handle's owner from the 10% pool using the existing referral math.

---

## 4. Auth: one endpoint, not two

The frontend collapsed to a single email field. The backend mostly supports this already, but make it explicit.

```
POST /v1/auth/link      { email, invite_code? }   → 204
POST /v1/auth/verify    { token }                 → { jwt, user, is_new }
```

- **Remove any separate register endpoint.** `POST /v1/auth/link` handles both cases — create the user if the email is unknown, otherwise send a sign-in link. Response is `204` either way.
- **Never leak account existence.** Same status, same body, same timing. Add a constant-time delay if the create path is measurably slower.
- `is_new` on verify tells the client whether to route into onboarding. This is the *only* place the distinction surfaces, and only after the link is proven.
- Display name is collected in onboarding, not at auth. Don't require it on the link request.
- Tokens: single-use, 15-minute expiry, invalidated on use.

---

## 5. API surface changes

### Remove

```
GET  /v1/library?free_use=true       -- crateable tracks
POST /v1/crate                       -- add to crate
DEL  /v1/crate/:track_id
POST /v1/radio-shows                 -- create DJ show
PUT  /v1/radio-shows/:id
POST /v1/radio-shows/:id/publish
GET  /v1/sfx
POST /v1/auth/register               -- folded into /auth/link
```

### Add

```
GET  /v1/stations                              → active stations, ordered
GET  /v1/stations/:slug/tracks    ?limit&cursor → resolved track list
POST /v1/roles                    { role }     → request role (artist|venue|advertiser)
GET  /v1/roles                                 → held roles + verification status
POST /v1/advertisers/apply        { company_name, category, contact_email }
GET  /v1/h/:handle                             → public HYPE-link landing + attribution set
```

### Map endpoints

The map is now a first-class module. It needs bounded queries, not a full-table scan per pan:

```
GET /v1/map/events   ?bbox=w,s,e,n&zoom&genre&from&to   → events with lat/lng
GET /v1/map/venues   ?bbox=w,s,e,n&zoom                 → venues with lat/lng
GET /v1/map/artists  ?bbox=w,s,e,n&zoom&genre           → artists aggregated by city
```

- `bbox` is required. Reject unbounded requests.
- Add a PostGIS index (or a composite lat/lng btree if PostGIS is off the table) — this is the highest-frequency read path in the app.
- **Server-side clustering above county zoom.** At state/country/global zoom, return aggregate counts per cell rather than individual rows; the client's collision de-clustering is for county zoom only and will not save you from 10,000 pins.
- Cap results per request and paginate. A global-zoom query must not attempt to return every event.

---

## 6. Migration order

1. Audit and export DJ data; get operator sign-off on the reassignment plan.
2. Add `advertisers`, `stations`, `users.handle`; backfill handles.
3. Seed stations (the 8 in the README).
4. Rename `tracks.free_use` → `radio_eligible`.
5. Migrate the `role` enum; reassign DJs.
6. Add the fan-role protection trigger.
7. Ship new endpoints alongside old ones.
8. Cut the frontend over.
9. Remove old endpoints and drop `crate_items` / `radio_shows` / `sfx_library`.

Steps 1–6 are backward-compatible if 7–9 lag. Do not drop tables before the frontend cutover is confirmed in production.

---

## 7. Unchanged — do not touch

- The 70/20/10 split and the settlement job's arithmetic
- Door-close snapshot semantics for `total_gross_cents`
- Cancellation, chargeback, waitlist, and partial-refund handling
- Stripe as sole processor; fees passed through at cost (2.9% + $0.30; Amex 3.5% + $0.30) and **never** described as an iHYPE fee
- The three-gate ad screening pipeline
- Hype as an event-sourced append-only log with Redis counters
- Charter immutability guarantees
