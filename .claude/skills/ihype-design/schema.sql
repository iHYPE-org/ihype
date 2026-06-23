-- iHYPE — Postgres schema (beta)
-- Maps BACKEND_SPEC.md → DDL. Test-mode ready; payout tables inert until banking.
-- Run order matters (FK deps). Requires: citext, pgcrypto, uuid-ossp.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── enums ──────────────────────────────────────────────────────────
CREATE TYPE role            AS ENUM ('fan','artist','dj','venue');
CREATE TYPE track_license   AS ENUM ('all_rights','free_use_limited');
CREATE TYPE event_status    AS ENUM ('draft','published','live','ended','cancelled');
CREATE TYPE ticket_status   AS ENUM ('valid','used','refunded','waitlist');
CREATE TYPE referral_status AS ENUM ('accruing','locked','paid');
CREATE TYPE show_status     AS ENUM ('draft','published');
CREATE TYPE payout_status   AS ENUM ('pending','verified','restricted');
CREATE TYPE hype_target     AS ENUM ('artist','track','show');

-- ── users ──────────────────────────────────────────────────────────
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle       citext UNIQUE NOT NULL,
  display_name text NOT NULL,
  email        citext UNIQUE NOT NULL,
  phone        text,
  avatar_url   text,
  city         text,
  genres       text[] NOT NULL DEFAULT '{}',
  roles        role[] NOT NULL DEFAULT '{fan}',
  verified     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_city ON users (city);

-- ── venues ─────────────────────────────────────────────────────────
CREATE TABLE venues (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id  uuid REFERENCES users(id),
  name      text NOT NULL,
  city      text NOT NULL,
  capacity  int  NOT NULL CHECK (capacity > 0)
);

-- ── artists (1:1 profile extension) ────────────────────────────────
CREATE TABLE artists (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio               text,
  hype_total        bigint NOT NULL DEFAULT 0,   -- denormalized; reconciled from hypes
  monthly_listeners int    NOT NULL DEFAULT 0,
  payout_account_id uuid                          -- FK added after payout_accounts; null until banking
);

-- ── tracks ─────────────────────────────────────────────────────────
CREATE TABLE tracks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   uuid NOT NULL REFERENCES artists(user_id) ON DELETE CASCADE,
  title       text NOT NULL,
  audio_url   text NOT NULL,
  artwork_url text,
  license     track_license NOT NULL DEFAULT 'all_rights',
  free_use    boolean GENERATED ALWAYS AS (license = 'free_use_limited') STORED,
  duration_s  int NOT NULL CHECK (duration_s > 0)
);
CREATE INDEX idx_tracks_artist ON tracks (artist_id);
CREATE INDEX idx_tracks_freeuse ON tracks (free_use) WHERE free_use;

-- ── events (split frozen at publish) ───────────────────────────────
CREATE TABLE events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id         uuid NOT NULL REFERENCES artists(user_id),
  venue_id          uuid REFERENCES venues(id),     -- null = livestream-only
  title             text NOT NULL,
  starts_at         timestamptz NOT NULL,
  city              text NOT NULL,
  capacity          int NOT NULL CHECK (capacity > 0),
  price_cents       int NOT NULL CHECK (price_cents >= 0),
  status            event_status NOT NULL DEFAULT 'draft',
  split             jsonb,   -- frozen charter: {artist,venue,platform,promoter_max}; NULL until publish
  total_gross_cents bigint NOT NULL DEFAULT 0
);
CREATE INDEX idx_events_city_time ON events (city, starts_at);
CREATE INDEX idx_events_status ON events (status);

-- ── tickets ────────────────────────────────────────────────────────
CREATE TABLE tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id),
  buyer_id      uuid NOT NULL REFERENCES users(id),
  referral_code text,                              -- FK added after referrals
  price_cents   int NOT NULL CHECK (price_cents >= 0),
  status        ticket_status NOT NULL DEFAULT 'valid',
  qr_token      text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_event ON tickets (event_id);
CREATE INDEX idx_tickets_buyer ON tickets (buyer_id);

-- ── referrals (promoter mechanic) ──────────────────────────────────
CREATE TABLE referrals (
  code               text PRIMARY KEY,
  event_id           uuid NOT NULL REFERENCES events(id),
  promoter_id        uuid NOT NULL REFERENCES users(id),   -- DJ or Fan
  gross_driven_cents bigint NOT NULL DEFAULT 0,
  earned_cents       bigint NOT NULL DEFAULT 0,
  status             referral_status NOT NULL DEFAULT 'accruing',
  UNIQUE (event_id, promoter_id)
);
ALTER TABLE tickets ADD CONSTRAINT fk_ticket_referral
  FOREIGN KEY (referral_code) REFERENCES referrals(code);

-- ── DJ radio studio ────────────────────────────────────────────────
CREATE TABLE radio_shows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_id      uuid NOT NULL REFERENCES users(id),
  title      text NOT NULL,
  segments   jsonb NOT NULL DEFAULT '[]',   -- [{type:'track'|'voice'|'sfx', ...}]
  duration_s int NOT NULL DEFAULT 0,
  status     show_status NOT NULL DEFAULT 'draft'
);

CREATE TABLE crate_items (
  dj_id    uuid NOT NULL REFERENCES users(id),
  track_id uuid NOT NULL REFERENCES tracks(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dj_id, track_id)
);
-- Enforce DJs only crate free-use tracks:
CREATE OR REPLACE FUNCTION assert_free_use() RETURNS trigger AS $$
BEGIN
  IF NOT (SELECT free_use FROM tracks WHERE id = NEW.track_id) THEN
    RAISE EXCEPTION 'track % is not free_use_limited', NEW.track_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_crate_freeuse BEFORE INSERT ON crate_items
  FOR EACH ROW EXECUTE FUNCTION assert_free_use();

CREATE TABLE sfx_library (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  url            text NOT NULL,
  license_source text NOT NULL,
  duration_s     int NOT NULL
);

-- ── hypes (event log; counter reconciled from here) ────────────────
CREATE TABLE hypes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  target_type hype_target NOT NULL,
  target_id   uuid NOT NULL,
  week        text NOT NULL,            -- ISO week key for budget cap
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hypes_target ON hypes (target_type, target_id);
CREATE INDEX idx_hypes_budget ON hypes (user_id, week);

-- ── ledger (double-entry; source of truth for balances) ────────────
CREATE TABLE ledger (
  id              bigserial PRIMARY KEY,
  debit_account   text NOT NULL,        -- e.g. 'platform', 'artist:<uuid>'
  credit_account  text NOT NULL,
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  event_id        uuid REFERENCES events(id),
  idempotency_key text UNIQUE NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── payout_accounts ⛔ banking-gated (table exists; inert until live) ─
CREATE TABLE payout_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  provider    text NOT NULL DEFAULT 'stripe_connect',
  external_id text,
  status      payout_status NOT NULL DEFAULT 'pending'
);
ALTER TABLE artists ADD CONSTRAINT fk_artist_payout
  FOREIGN KEY (payout_account_id) REFERENCES payout_accounts(id);

-- ── telemetry (replaces localStorage track() stub) ─────────────────
CREATE TABLE track_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id),
  event      text NOT NULL,
  props      jsonb NOT NULL DEFAULT '{}',
  platform   text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_track_events_name ON track_events (event, created_at);

-- ── reports (moderation) ───────────────────────────────────────────
CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL,
  target_id   uuid NOT NULL,
  reason      text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
