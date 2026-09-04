'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Mint, see and revoke the store-review sign-in link.
 *
 * `src/lib/review-access.ts` carries why this exists rather than a password.
 * What this component adds is the part that makes it operable: a link nobody
 * can list is a link nobody can revoke, and one nobody can revoke is a
 * standing credential. So the panel does all three or it does not do its job.
 *
 * The URL is shown ONCE, on the response that creates it — only its SHA-256
 * hash is stored, so it cannot be fetched back afterwards. That is deliberate
 * and the copy says so plainly, because an operator who assumes otherwise
 * closes the tab and quietly loses it.
 */

type ReviewLink = {
  id: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  remainingUses: number | null;
};

type Minted = { url: string; expiresAt: string; uses: number; label: string };

function describe(link: ReviewLink, now: number): string {
  if (link.used) return 'Spent';
  if (new Date(link.expiresAt).getTime() <= now) return 'Expired';
  /* A review link always carries a count; a null here would be a member's
     15-minute link, which this list never shows. Say "unlimited" rather than
     a dash if one ever appears — an unlimited link is the thing an operator
     most needs to notice. */
  if (link.remainingUses === null) return 'Unlimited — revoke this';
  return `${link.remainingUses} ${link.remainingUses === 1 ? 'use' : 'uses'} left`;
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { timeZone: 'UTC' });

export function AdminReviewLink() {
  const [links, setLinks] = useState<ReviewLink[] | null>(null);
  const [minted, setMinted] = useState<Minted | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/review-link');
      if (!response.ok) throw new Error('read failed');
      const data = (await response.json()) as { links: ReviewLink[] };
      setLinks(data.links);
    } catch {
      /* An em dash, never a zero. A list that could not be read looks exactly
         like a list with nothing in it, and here the difference is "no
         standing credentials" versus "we cannot tell". */
      setLinks(null);
      setError('Could not read the existing links.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mint() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/admin/review-link', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as Partial<Minted> & { error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? 'Could not mint a link.');
        return;
      }
      setMinted(data as Minted);
      await load();
    } catch {
      setError('Could not mint a link.');
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setError('');
    try {
      const response = await fetch(`/api/admin/review-link?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('revoke failed');
      /* Clear the shown URL if it was the one just revoked — leaving a dead
         link on screen beside "revoked" is how somebody pastes it into review
         notes. There is no id on the minted payload, so any revoke clears it;
         the operator can mint again, which costs nothing. */
      setMinted(null);
      await load();
    } catch {
      setError('Could not revoke that link.');
    }
  }

  const now = Date.now();

  return (
    <section className="panel admin-console-panel">
      <div className="admin-console-panel-head">
        <div>
          <h2>Store review sign-in</h2>
          <p className="meta">
            A reviewer has no mailbox here and no passkey, so they cannot use either of our sign-ins. This mints
            one long-lived magic link for a FAN-only review account — paste it into the App Review notes.
            iHYPE has no passwords and this does not add one.
          </p>
        </div>
        <button className="button small" disabled={pending} onClick={mint} type="button">
          {pending ? 'Minting…' : 'Mint a link'}
        </button>
      </div>

      {minted && (
        <div className="admin-review-minted">
          <p className="meta">
            <strong>Copy this now — it is shown once.</strong> Only its hash is stored, so it cannot be read back.
            Good for {minted.uses} sign-ins until {day(minted.expiresAt)}.
          </p>
          <textarea className="admin-review-url" readOnly rows={2} value={minted.url} />
        </div>
      )}

      {/* `--warning-text` rather than `--warning`: the amber fill measures
          2.63:1 as copy. Same treatment AdminDevices uses two panels up. */}
      {error && <p className="meta" style={{ color: 'var(--warning-text)' }}>{error}</p>}

      {links === null ? (
        <p className="meta">—</p>
      ) : links.length === 0 ? (
        <p className="meta">No review links exist. Nothing can sign in as the review account.</p>
      ) : (
        <ul className="admin-review-list">
          {links.map((link) => (
            <li key={link.id}>
              <div>
                <strong>{link.label ?? 'Store review'}</strong>
                <small>
                  {describe(link, now)} · minted {day(link.createdAt)} · expires {day(link.expiresAt)}
                </small>
              </div>
              <button className="button small" onClick={() => revoke(link.id)} type="button">
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
