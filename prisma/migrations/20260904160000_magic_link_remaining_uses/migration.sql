-- Store-review sign-in links (2026-09-04). A magic link is single-use and
-- lives 15 minutes, which is correct for a member and useless for an App
-- Store or Play reviewer: they cannot receive email at an ihype.org address,
-- and a review can span days while the session JWT lasts 12 hours.
--
-- `remainingUses` NULL keeps the existing behaviour exactly — one use, via the
-- `used` flag that every current row and every member link relies on. A number
-- means "this link may be redeemed this many more times", decremented
-- atomically on each redemption, and `used` is set when it reaches zero so the
-- expiry sweep and every existing query still see a spent token.
--
-- Additive and nullable: every row written before this is unaffected, and the
-- consume path treats NULL as the single-use case it always was.
ALTER TABLE "MagicLinkToken" ADD COLUMN "remainingUses" INTEGER;

-- Names the link in the admin console so a reviewer link is distinguishable
-- from the 15-minute one a member just requested. NULL for member links.
ALTER TABLE "MagicLinkToken" ADD COLUMN "label" TEXT;
