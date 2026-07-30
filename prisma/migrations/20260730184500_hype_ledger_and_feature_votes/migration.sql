-- Durable HYPE accounting and one-account/one-vote Community governance.
ALTER TABLE "User"
  ADD COLUMN "hypeBalance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "HypeLedgerEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HypeLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HypeLedgerEntry_idempotencyKey_key"
  ON "HypeLedgerEntry"("idempotencyKey");
CREATE INDEX "HypeLedgerEntry_userId_createdAt_idx"
  ON "HypeLedgerEntry"("userId", "createdAt");
CREATE INDEX "HypeLedgerEntry_source_createdAt_idx"
  ON "HypeLedgerEntry"("source", "createdAt");
CREATE INDEX "HypeLedgerEntry_targetType_targetId_idx"
  ON "HypeLedgerEntry"("targetType", "targetId");
ALTER TABLE "HypeLedgerEntry"
  ADD CONSTRAINT "HypeLedgerEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeatureRequest"
  ADD COLUMN "votingOpensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "votingClosesAt" TIMESTAMP(3),
  ADD COLUMN "quorumRequired" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resultPublishedAt" TIMESTAMP(3),
  ADD COLUMN "securityException" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "securityExceptionNote" TEXT;

CREATE INDEX "FeatureRequest_status_votingClosesAt_idx"
  ON "FeatureRequest"("status", "votingClosesAt");

CREATE TABLE "FeatureVote" (
  "id" TEXT NOT NULL,
  "featureRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureVote_featureRequestId_userId_key"
  ON "FeatureVote"("featureRequestId", "userId");
CREATE INDEX "FeatureVote_userId_createdAt_idx"
  ON "FeatureVote"("userId", "createdAt");
CREATE INDEX "FeatureVote_featureRequestId_createdAt_idx"
  ON "FeatureVote"("featureRequestId", "createdAt");
ALTER TABLE "FeatureVote"
  ADD CONSTRAINT "FeatureVote_featureRequestId_fkey"
  FOREIGN KEY ("featureRequestId") REFERENCES "FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureVote"
  ADD CONSTRAINT "FeatureVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
