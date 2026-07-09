CREATE TABLE "PasskeyBootstrapToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challenge" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasskeyBootstrapToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasskeyBootstrapToken_tokenHash_key"
    ON "PasskeyBootstrapToken"("tokenHash");

CREATE INDEX "PasskeyBootstrapToken_userId_expiresAt_idx"
    ON "PasskeyBootstrapToken"("userId", "expiresAt");

CREATE INDEX "PasskeyBootstrapToken_expiresAt_idx"
    ON "PasskeyBootstrapToken"("expiresAt");

ALTER TABLE "PasskeyBootstrapToken"
    ADD CONSTRAINT "PasskeyBootstrapToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
