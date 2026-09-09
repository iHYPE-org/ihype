'use client';

import { useState } from 'react';

/**
 * Push a notification to your own devices, so push is checkable in one tap.
 *
 * `src/app/api/admin/push-test/route.ts` carries why the endpoint exists —
 * every real sender notifies somebody else, and the nearest one skips
 * self-hype. What this component adds is that the answer is READABLE: the
 * endpoint distinguishes "no registered device", "secrets unset" and "handed
 * to FCM", and those are three different fixes, so the panel prints which one
 * happened rather than a tick.
 *
 * It never claims delivery. FCM accepts a send and delivers asynchronously,
 * and iOS depends on the APNs key — Apple-side state nothing here can read. A
 * component that said "sent ✓" would be the false green this whole area keeps
 * producing, so the last line always tells you to look at the phone.
 */

type Result = {
  nativePushConfigured: boolean;
  blockers: string[];
  devices: number;
  platforms: string[];
  note: string;
};

export function AdminPushTest() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setPending(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/admin/push-test', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Could not send a test push.');
        return;
      }
      setResult(data as Result);
    } catch {
      setError('Could not send a test push.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel admin-console-panel">
      <div className="admin-console-panel-head">
        <div>
          <h2>Native push test</h2>
          <p className="meta">
            Sends one notification to your own registered phones — nobody else&apos;s. Push is the one subsystem
            where every layer fails silently, so this is the only cheap way to know it still works.
          </p>
        </div>
        <button className="button small" disabled={pending} onClick={send} type="button">
          {pending ? 'Sending…' : 'Send me one'}
        </button>
      </div>

      {/* `--warning-text`, not `--warning`: the amber fill measures 2.63:1 as
          copy. Same treatment the two panels above use. */}
      {error && <p className="meta" style={{ color: 'var(--warning-text)' }}>{error}</p>}

      {result && (
        <>
          <p className="meta">
            <strong>
              {result.devices === 0
                ? 'No registered device'
                : `${result.devices} registered ${result.devices === 1 ? 'device' : 'devices'}`}
            </strong>
            {result.platforms.length > 0 && ` · ${result.platforms.join(', ')}`}
            {' · '}
            {result.nativePushConfigured ? 'FCM secrets set' : 'FCM secrets missing'}
          </p>
          <p className="meta">{result.note}</p>
          {result.blockers.length > 0 && (
            <ul className="meta">
              {result.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
