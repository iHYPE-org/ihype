'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import Link from 'next/link';

type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: string;
  createdAt: string;
  votingClosesAt: string | null;
  quorumRequired: number;
  quorumMet: boolean;
  hasVoted: boolean;
  votingOpen: boolean;
  securityException: boolean;
  securityExceptionNote: string | null;
};

const rowStyle: React.CSSProperties = {
  display: 'flex', gap: 14, alignItems: 'flex-start',
  padding: '16px 0', borderBottom: '1px solid var(--line)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-body, Work Sans, sans-serif)', fontSize: '0.9375rem',
  color: 'var(--ink)', background: 'var(--bg-3)', border: '1px solid var(--line-2)',
  borderRadius: 9, padding: '11px 13px', outline: 'none',
};

const STATUS_COLOR: Record<string, string> = {
  planned: 'var(--role-venue)',
  in_progress: 'var(--role-fan)',
  shipped: 'var(--role-venue)',
  declined: 'var(--ink-a40)',
};

/**
 * The real, counted vote-and-suggest mechanism behind Community's "you get a
 * vote" charter promise — moved here from the standalone (and old-themed)
 * /feedback page so Community itself is the actual conduit, not just a link
 * out to one. Backed by the same GET/POST /api/feedback (FeatureRequest
 * model) that page always used.
 */
export function CommunityVoteBoard() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [pendingVote, setPendingVote] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/feedback')
      .then((r) => r.json())
      .then((d) => {
        setRequests(d.requests ?? []);
        setEligible(Boolean(d.eligible));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function vote(id: string) {
    setMessage('');
    setPendingVote(id);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', id }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests((prev) => prev.map((r) => (
          r.id === id
            ? { ...r, votes: data.votes, hasVoted: true, quorumMet: data.quorumMet }
            : r
        )).sort((a, b) => b.votes - a.votes));
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? t('communityVoteBoard.voteError', 'Could not register that vote.'));
      }
    } catch {
      setMessage(t('communityVoteBoard.voteError', 'Could not register that vote.'));
    } finally {
      setPendingVote(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequests((prev) => [data.request, ...prev]);
      setTitle('');
      setDescription('');
      setMessage(t('communityVoteBoard.submitSuccess', 'Submitted — thanks for the idea.'));
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? t('communityVoteBoard.submitError', 'Could not submit that idea.'));
    }
  }

  return (
    <div>
      <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', lineHeight: 1.55 }}>
        {t('communityVoteBoard.governanceNote', 'One fan account gets one vote per proposal. Results, quorum, voting windows, and any emergency security exception remain public. Security fixes may ship immediately when disclosure or delay would put people or the platform at risk.')}
      </p>
      {eligible ? <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <input
          style={inputStyle}
          placeholder={t('communityVoteBoard.titlePlaceholder', 'Short title for your idea')}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
        />
        <textarea
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder={t('communityVoteBoard.descriptionPlaceholder', "Describe what you'd want built.")}
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        {message && <p style={{ fontSize: '0.9375rem', color: 'var(--accent-text)', margin: 0 }}>{message}</p>}
        <button className="ihype-btn-primary" type="submit" style={{ alignSelf: 'flex-start', padding: '11px 22px' }}>
          {t('communityVoteBoard.submitButton', 'Submit idea')}
        </button>
      </form> : (
        <p style={{ marginBottom: 24, fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>
          <Link href="/login?callbackUrl=/community">{t('communityVoteBoard.signIn', 'Sign in with a fan account')}</Link>{' '}
          {t('communityVoteBoard.signInSuffix', 'to propose changes and vote.')}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>{t('communityVoteBoard.loading', 'Loading…')}</p>
      ) : requests.length === 0 ? (
        <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>{t('communityVoteBoard.emptyState', 'No feature requests yet — be the first to suggest one.')}</p>
      ) : (
        <div>
          {requests.map((fr) => (
            <div key={fr.id} style={rowStyle}>
              <button
                aria-label={fr.hasVoted ? `Voted for ${fr.title}` : `Vote for ${fr.title}`}
                disabled={!eligible || !fr.votingOpen || fr.hasVoted || pendingVote === fr.id}
                onClick={() => vote(fr.id)}
                type="button"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minWidth: 48, padding: '8px 6px', borderRadius: 9, flexShrink: 0,
                  border: '1px solid var(--hair-100)', background: 'var(--hair-40)',
                  color: fr.hasVoted ? 'var(--success)' : 'var(--ink)',
                  cursor: fr.hasVoted || !fr.votingOpen ? 'default' : 'pointer',
                  fontFamily: 'var(--font-mono)',
                  opacity: !eligible || !fr.votingOpen ? 0.55 : 1,
                }}
              >
                <span style={{ fontSize: '0.9375rem', lineHeight: 1 }}>{fr.hasVoted ? '✓' : '▲'}</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: 4 }}>{fr.votes}</span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink)' }}>{fr.title}</div>
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '4px 0 0', lineHeight: 1.5 }}>{fr.description}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '7px 0 0' }}>
                  {fr.quorumMet ? 'Quorum met' : `${fr.quorumRequired - fr.votes} more vote${fr.quorumRequired - fr.votes === 1 ? '' : 's'} for quorum`}
                  {fr.votingClosesAt ? ` · voting closes ${new Date(fr.votingClosesAt).toLocaleDateString()}` : ''}
                </p>
                {fr.securityException && (
                  <p style={{ fontSize: '0.9375rem', color: 'var(--warning)', margin: '7px 0 0' }}>
                    Security exception: {fr.securityExceptionNote ?? 'Emergency protection applied; details will be published when safe.'}
                  </p>
                )}
              </div>
              {fr.status !== 'open' && (
                <span
                  style={{
                    flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', textTransform: 'uppercase',
                    letterSpacing: '.08em', padding: '4px 9px', borderRadius: 999,
                    border: `1px solid ${STATUS_COLOR[fr.status] ?? 'var(--line-2)'}`,
                    color: STATUS_COLOR[fr.status] ?? 'var(--ink-a65)',
                  }}
                >
                  {fr.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
