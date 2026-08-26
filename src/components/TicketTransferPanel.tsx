'use client';

import { useState } from 'react';

/**
 * Hands a ticket to another account by showing a code to read out.
 *
 * This is the control the ticket page deliberately did NOT draw. Its comment
 * said the reference's Transfer button was "not reproduced" because "nothing on
 * this page backs them, and a control with no wiring is a promise the page
 * cannot keep" — but the wiring existed: `/api/tickets/[id]/transfer` has been
 * real since the double-use fix. Meanwhile the tickets list advertised
 * "Transfer this ticket" and linked HERE, so a member tapping it arrived on a
 * page where transferring was impossible (owner, 2026-08-25: "Tickets need view
 * and transfer options").
 *
 * A code rather than the recipient's email address, because the email path does
 * not actually move the ticket: it rewrites holderEmail and leaves
 * buyerUserId, and every ticket list is scoped by buyerUserId, so an emailed
 * transfer stays in the sender's account forever. Claiming a code moves it.
 */
export function TicketTransferPanel({ orderId }: { orderId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const mint = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${orderId}/transfer-code`, { method: 'POST' });
      const payload = await response.json().catch(() => ({})) as { code?: string; expiresAt?: string; error?: string };
      if (!response.ok) {
        /* The server's own sentence, when it sent one. These are the cases a
           member can act on — an already-scanned ticket, an unpaid order — and
           replacing them with a generic failure would hide the reason. */
        setError(payload.error ?? 'That code could not be created right now.');
        return;
      }
      setCode(payload.code ?? null);
      setExpiresAt(payload.expiresAt ?? null);
      setConfirming(false);
    } catch {
      setError('That code could not be created right now.');
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard access is refused in plenty of contexts and the code is on
         screen regardless, so a failure here is not worth an error message. */
    }
  };

  if (code) {
    return (
      <div>
        <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', margin: '0 0 10px' }}>
          Give this code to whoever is taking the ticket. When they enter it, the ticket moves to
          their account and your copy stops working.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.5rem',
            letterSpacing: '.12em',
            margin: '0 0 10px',
            color: 'var(--ink)',
          }}
        >
          {code}
        </p>
        {expiresAt && (
          <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', margin: '0 0 12px' }}>
            Expires {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(expiresAt))}.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="button secondary" onClick={() => void copy()} type="button">
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button className="button secondary" disabled={pending} onClick={() => void mint()} type="button">
            Replace this code
          </button>
        </div>
        {/* Stated because it is not obvious: minting again retires the code
            above, which is the whole reason the button is offered. */}
        <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', margin: '10px 0 0' }}>
          Replacing it stops the code above from working.
        </p>
        {error && <p role="status" style={{ fontSize: '0.9375rem', color: 'var(--danger-text)', margin: '10px 0 0' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', margin: '0 0 12px' }}>
        Transferring gives this ticket to another account. Your QR stops working the moment they
        claim it — that is what stops two people arriving with the same ticket.
      </p>
      {confirming ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="button" disabled={pending} onClick={() => void mint()} type="button">
            {pending ? 'Creating…' : 'Create the code'}
          </button>
          <button className="button secondary" disabled={pending} onClick={() => setConfirming(false)} type="button">
            Keep my ticket
          </button>
        </div>
      ) : (
        /* Two steps, because the ticket is paid for and the first tap sits on a
           page a member opens just to show their QR at a door. */
        <button className="button secondary" onClick={() => setConfirming(true)} type="button">
          Transfer this ticket
        </button>
      )}
      {error && <p role="status" style={{ fontSize: '0.9375rem', color: 'var(--danger-text)', margin: '10px 0 0' }}>{error}</p>}
    </div>
  );
}

/** Redeems a code. Lives wherever a member without the ticket can reach it —
 *  the tickets list, not the ticket page, which they cannot open yet. */
export function TicketClaimForm() {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setNote(null);
    setFailed(false);
    try {
      const response = await fetch('/api/tickets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; showTitle?: string; ticketCount?: number };
      if (!response.ok) {
        setFailed(true);
        setNote(payload.error ?? 'That code could not be claimed.');
        return;
      }
      const count = payload.ticketCount ?? 1;
      setNote(`${count} ticket${count === 1 ? '' : 's'} for ${payload.showTitle ?? 'that show'} are yours.`);
      setValue('');
      /* A full reload rather than a client refresh: the ticket list is server
         rendered from `buyerUserId`, which this request just changed, and the
         claimed tickets have brand-new serialized ids. Anything short of
         re-fetching the page would show the old list. */
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setFailed(true);
      setNote('That code could not be claimed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <label className="mmm-eyebrow" htmlFor="ticket-claim-code" style={{ width: '100%' }}>
        Have a transfer code?
      </label>
      <input
        autoCapitalize="characters"
        autoComplete="off"
        className="mmm-row-title"
        disabled={pending}
        id="ticket-claim-code"
        onChange={(event) => setValue(event.target.value)}
        placeholder="ABCD-2345"
        spellCheck={false}
        style={{
          flex: '1 1 160px',
          minWidth: 0,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '.08em',
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-panel)',
          color: 'var(--ink)',
          padding: '10px 12px',
        }}
        value={value}
      />
      <button className="button secondary" disabled={pending || value.trim().length === 0} type="submit">
        {pending ? 'Claiming…' : 'Claim'}
      </button>
      {note && (
        <p
          role="status"
          style={{ width: '100%', fontSize: '0.9375rem', margin: '4px 0 0', color: failed ? 'var(--danger-text)' : 'var(--accent-text)' }}
        >
          {note}
        </p>
      )}
    </form>
  );
}
