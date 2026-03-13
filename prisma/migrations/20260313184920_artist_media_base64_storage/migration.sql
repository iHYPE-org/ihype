/*
  Warnings:

  - You are about to drop the column `fileData` on the `ArtistMediaAsset` table. All the data in the column will be lost.
  - Added the required column `fileDataBase64` to the `ArtistMediaAsset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ArtistMediaAsset" DROP COLUMN "fileData",
ADD COLUMN     "fileDataBase64" TEXT NOT NULL;
