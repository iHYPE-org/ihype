CREATE TABLE IF NOT EXISTS "Badge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Badge_userId_type_key" ON "Badge"("userId", "type");
CREATE INDEX IF NOT EXISTS "Badge_userId_idx" ON "Badge"("userId");

ALTER TABLE "Badge" ADD CONSTRAINT "Badge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AvailabilityDate" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilityDate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AvailabilityDate_profileId_idx" ON "AvailabilityDate"("profileId");

ALTER TABLE "AvailabilityDate" ADD CONSTRAINT "AvailabilityDate_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ShowAttendee" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "optedIn" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShowAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShowAttendee_userId_showId_key" ON "ShowAttendee"("userId", "showId");
CREATE INDEX IF NOT EXISTS "ShowAttendee_showId_idx" ON "ShowAttendee"("showId");

ALTER TABLE "ShowAttendee" ADD CONSTRAINT "ShowAttendee_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShowAttendee" ADD CONSTRAINT "ShowAttendee_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
