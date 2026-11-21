import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { findMusicQuiz } from '@/lib/music-quizzes';
import { consumeRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? 'music-trivia-001';
  const quiz = findMusicQuiz(id);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  return NextResponse.json({
    id: quiz.id, title: quiz.title,
    questions: quiz.questions.map(({ id, text, options }) => ({ id, text, options })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to save your result' }, { status: 401 });
  const rl = await consumeRateLimit(`music-quiz:${session.user.id}`, { limit: 12, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Try again shortly' }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
  const { quizId, answers } = body as { quizId?: unknown; answers?: unknown };
  const quiz = typeof quizId === 'string' ? findMusicQuiz(quizId) : undefined;
  if (!quiz || !Array.isArray(answers) || answers.length !== quiz.questions.length ||
      answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) {
    return NextResponse.json({ error: 'Invalid quiz answers' }, { status: 400 });
  }
  const score = quiz.questions.filter((question, index) => question.correct === answers[index]).length;
  try {
    // First completed attempt is immutable; retries cannot improve a published score.
    const result = await db.musicQuizResponse.upsert({
      where: { userId_quizId: { userId: session.user.id, quizId: quiz.id } },
      create: { userId: session.user.id, quizId: quiz.id, answers, score },
      update: {},
      select: { score: true, answers: true },
    });
    const [participants, below, tied] = await Promise.all([
      db.musicQuizResponse.count({ where: { quizId: quiz.id } }),
      db.musicQuizResponse.count({ where: { quizId: quiz.id, score: { lt: result.score } } }),
      db.musicQuizResponse.count({ where: { quizId: quiz.id, score: result.score } }),
    ]);
    const savedAnswers = Array.isArray(result.answers) ? result.answers : answers;
    return NextResponse.json({
      quizId: quiz.id, score: result.score, total: quiz.questions.length,
      participants,
      // Midrank percentile, rather than claiming a precise rank for tied scores.
      percentile: participants ? Math.round(100 * (below + tied / 2) / participants) : 50,
      breakdown: quiz.questions.map((q, i) => ({
        question: q.text, selected: q.options[Number(savedAnswers[i])] ?? null,
        correct: q.options[q.correct], explanation: q.explanation,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not save quiz result' }, { status: 503 });
  }
}
