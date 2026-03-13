-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "fanShareEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "themePreset" TEXT NOT NULL DEFAULT 'midnight-neon';
