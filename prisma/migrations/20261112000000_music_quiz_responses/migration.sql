CREATE TABLE "MusicQuizResponse" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "score" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MusicQuizResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MusicQuizResponse_userId_quizId_key" ON "MusicQuizResponse"("userId", "quizId");
CREATE INDEX "MusicQuizResponse_quizId_score_idx" ON "MusicQuizResponse"("quizId", "score");
ALTER TABLE "MusicQuizResponse" ADD CONSTRAINT "MusicQuizResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
