'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mints single-use invite codes from the admin console.
 *
 * `POST /api/admin/invite-codes` has existed all along and nothing called it —
 * the page offered a "View all via API" link and told the operator, in the
 * empty state, to POST to the endpoint themselves. That was survivable while a
 * shared beta code and every member's HYPE link also opened the door. It is
 * not survivable now: with `invite_code_sharing` off, a code minted here is the
 * ONLY way anyone gets in, so an admin who cannot mint one cannot admit the
 * people whose requests are sitting in the workbench queue.
 *
 * Codes are shown once, here, on the assumption they are copied into a reply.
 * They are not secret afterwards — they live in the list below and are burned
 * on first use inside the signup transaction — but having them on screen at
 * the moment of minting is the difference between a two-step job and a hunt.
 */
export function MintInviteCodes() {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [pending, setPending] = useState(false);
  const [minted, setMinted] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function mint() {
    setPending(true);
    setError('');
    setMinted([]);
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not mint codes.');
      const codes: string[] = Array.isArray(payload.codes)
        ? payload.codes.map((entry: unknown) =>
            typeof entry === 'string' ? entry : String((entry as { code?: unknown })?.code ?? ''),
          ).filter(Boolean)
        : [];
      setMinted(codes);
      // The list below this component is server-rendered, so it is stale the
      // moment a code is minted.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mint codes.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9375rem' }}>
        <span className="meta">How many</span>
        <input
          aria-label="Number of invite codes to mint"
          className="input"
          max={100}
          min={1}
          onChange={(event) => setCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
          style={{ width: 80 }}
          type="number"
          value={count}
        />
      </label>
      <button className="button" disabled={pending} onClick={mint} type="button" style={{ fontSize: '0.9375rem' }}>
        {pending ? 'Minting…' : `Mint ${count === 1 ? 'a code' : `${count} codes`}`}
      </button>
      {minted.length > 0 && (
        <div style={{ flexBasis: '100%' }}>
          <p className="meta" style={{ marginBottom: 6 }}>
            Minted — copy these into your reply. Each admits exactly one account.
          </p>
          <div className="admin-list">
            {minted.map((code) => (
              <div className="admin-list-row" key={code}>
                <code style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{code}</code>
              </div>
            ))}
          </div>
        </div>
      )}
      {error ? <p className="status-note status-note-error" style={{ flexBasis: '100%' }}>{error}</p> : null}
    </div>
  );
}
