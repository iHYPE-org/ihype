-- Drop tables with zero rows and zero application-code usage, confirmed via
-- repo-wide grep (src/) before this migration was written.
-- MfaChallenge is leftover from the OTP/2FA flow removed when auth was
-- simplified to passkey + magic link only. UserMediaQueue was superseded by
-- AuxQueue/AuxItem (the shared aux-queue feature actually wired into the app).
DROP TABLE "MfaChallenge";
DROP TABLE "UserMediaQueue";
