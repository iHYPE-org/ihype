-- CreateEnum
CREATE TYPE "NativeDevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "NativeDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "NativeDevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NativeDeviceToken_token_key" ON "NativeDeviceToken"("token");

-- CreateIndex
CREATE INDEX "NativeDeviceToken_userId_idx" ON "NativeDeviceToken"("userId");

-- AddForeignKey
ALTER TABLE "NativeDeviceToken" ADD CONSTRAINT "NativeDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
