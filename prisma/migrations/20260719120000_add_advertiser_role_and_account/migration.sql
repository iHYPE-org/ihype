-- Advertiser Profile (separate from the main 4 account types) — lets
-- non-"app users" (music stores, merch printers, live-production companies —
-- the "3rd-Party Accounts" path already described in Advertise.dc.html but
-- never actually buildable) sign up and manage ad campaigns without needing
-- a Fan/Artist/DJ/Venue account or a public profile page.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADVERTISER';

-- CreateTable
CREATE TABLE "AdvertiserAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertiserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserAccount_userId_key" ON "AdvertiserAccount"("userId");

-- AddForeignKey
ALTER TABLE "AdvertiserAccount" ADD CONSTRAINT "AdvertiserAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
