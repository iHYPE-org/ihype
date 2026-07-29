-- Records when a creator finished their onboarding wizard.
--
-- Until now nothing anywhere persisted that fact. The three wizards
-- (/artists/[slug]/onboarding, /promoters/…, /venues/…) ended on a purely
-- client-side "You're set up." screen — the artist one's final action is
-- literally setStep(3) — so reloading put you back at step 0 with no record
-- you had ever been through it. That made a "Finish setup" prompt impossible
-- to build: nothing could tell who still needed one, or when to stop asking.
--
-- Nullable and additive, so every existing row stays valid and the deploy
-- order is safe either way: nothing reads the column until the code that
-- writes it ships in the same commit.
--
-- The backfill is the important half. Without it, every profile that already
-- exists reads as un-onboarded the moment this applies, and the entire current
-- userbase gets prompted into a wizard none of them were ever shown. Stamping
-- createdAt says "this account predates onboarding tracking", which is true,
-- and is what stops the prompt firing at them. New rows created after this
-- point are genuinely NULL until their wizard reports in.

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Backfill: existing accounts were never offered the wizard, so treat them as
-- already past it rather than prompting retroactively.
UPDATE "Profile" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
