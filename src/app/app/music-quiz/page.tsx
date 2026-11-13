'use client';

import { useEffect, useState } from 'react';

type Quiz = { id: string; title: string; questions: { id: string; text: string; options: readonly string[] }[] };
type Result = { score: number; total: number; participants: number; percentile: number; breakdown: { question: string; selected: string | null; correct: string; explanation: string }[] };
export default function MusicQuizPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  useEffect(() => {
    fetch('/api/music-quizzes').then(async (res) => {
      if (!res.ok) throw new Error('Quiz unavailable');
      setQuiz(await res.json());
    }).catch(() => setError('Quiz unavailable. Try again later.'));
  }, []);
  useEffect(() => {
    fetch('/api/music-quizzes/preferences').then(async (res) => {
      if (res.ok) setOptedIn((await res.json()).enabled === true);
    }).catch(() => {});
  }, []);
  async function setNotifications(enabled: boolean) {
    setPreferenceBusy(true); setError('');
    try {
      const res = await fetch('/api/music-quizzes/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Sign in to change notifications.');
      setOptedIn(enabled);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save preference.'); }
    finally { setPreferenceBusy(false); }
  }
  async function submit() {
    if (!quiz || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/music-quizzes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id, answers: quiz.questions.map((q) => answers[q.id]) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not submit');
      setResult(body);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit'); }
    finally { setBusy(false); }
  }
  async function share() {
    if (!result || !quiz) return;
    const url = window.location.href;
    const text = `I scored ${result.score}/${result.total} on iHYPE Music Trivia! I ranked at the ${result.percentile}th percentile among ${result.participants} players. Try it: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: quiz.title, text, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); setError('Result copied to clipboard.'); }
      else setError(text);
    } catch (err) { if (!(err instanceof Error && err.name === 'AbortError')) setError('Could not share result.'); }
  }
  return <main style={{ maxWidth: 650, margin: '0 auto', padding: '24px 16px' }}>
    <h1>Music trivia</h1>
    <p>Just for fun. No public player profiles, leaderboards, or follower feeds.</p>
    <label style={{ display: 'block', padding: '12px 0' }}><input type="checkbox" checked={optedIn} disabled={preferenceBusy} onChange={(event) => void setNotifications(event.target.checked)} /> Notify me when new music quizzes arrive (optional)</label>
    {error && <p role="status">{error}</p>}
    {!quiz && !error && <p>Loading quiz…</p>}
    {quiz && <><h2>{quiz.title}</h2>
      {!result ? <>
        {quiz.questions.map((q, i) => <fieldset key={q.id} style={{ margin: '20px 0', padding: 16 }}>
          <legend>{i + 1}. {q.text}</legend>
          {q.options.map((option, index) => <label key={index} style={{ display: 'block', padding: '8px 0' }}>
            <input type="radio" name={q.id} checked={answers[q.id] === index}
              onChange={() => setAnswers((old) => ({ ...old, [q.id]: index }))} /> {option}
          </label>)}
        </fieldset>)}
        <button className="button" type="button" disabled={busy || quiz.questions.some((q) => answers[q.id] === undefined)} onClick={submit}>
          {busy ? 'Checking…' : 'See my results'}
        </button>
      </> : <section aria-live="polite">
        <h2>{result.score} / {result.total} correct</h2>
        <p>{result.participants} participants · {result.percentile}th percentile (including ties).</p>
        <button className="button" type="button" onClick={share}>Share my result</button>
        <h3>Your answers</h3>
        <ol>{result.breakdown.map((item, i) => <li key={i} style={{ marginBottom: 16 }}>
          <strong>{item.question}</strong><p>You answered: {item.selected}</p>
          <p>Correct answer: {item.correct}. {item.explanation}</p>
        </li>)}</ol>
      </section>}
    </>}
  </main>;
}
