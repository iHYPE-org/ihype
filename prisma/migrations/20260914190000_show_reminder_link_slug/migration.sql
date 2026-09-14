-- A show reminder's link is the show's SLUG, and the notifications written
-- under its cuid are moved onto it (DESIGN_SYNC row 463).
--
-- `POST /api/shows/[showId]/remind` resolved the show by primary key and stored
-- `link = '/shows/' || id`. `/shows/[slug]` resolves `where: { slug }` and
-- nothing else, so every reminder notification already delivered points at a
-- URL that cannot resolve, and `NotificationsList` pushes that link on a tap —
-- the one control whose whole purpose is bringing a fan back to a show has been
-- sending them to the not-found page. The route stores the slug as of this
-- deploy; this moves what it stored before, so a reminder a member set last
-- week starts working rather than being abandoned.
--
-- DATA migration, no DDL. Scoped to the one notification type that carries this
-- link, so nothing else in the table is touched.
--
-- Idempotent by construction: the join matches only a link of the exact form
-- '/shows/' || "Show"."id", and once a row carries '/shows/' || slug it can
-- match again only if some OTHER show's id is byte-identical to this show's
-- slug. A cuid is 25 lowercase alphanumerics beginning with 'c' and a slug is a
-- kebab-cased title, so that is not reachable in practice; a second run over a
-- migrated database rewrites nothing.
--
-- No uniqueness to guard here, unlike the MediaListen move: `Notification` has
-- no unique constraint over (userId, link), so two rows collapsing onto one key
-- is legal. It is also not possible — the toggle deletes before it creates, and
-- the lookup already matched by the same cuid key.

UPDATE "Notification" n
SET "link" = '/shows/' || s."slug"
FROM "Show" s
WHERE n."type" = 'show_reminder_pending'
  AND n."link" = '/shows/' || s."id";
