'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { VerificationProfile } from '@/lib/types/admin';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

function formatDate(value: Date | string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(value));
}

function profileTypePath(type: string, slug: string) {
  if (type === 'ARTIST') return `/artists/${slug}`;
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  return `/fans/${slug}`;
}

function VerificationCard({ profile }: { profile: VerificationProfile }) {
  const router = useRouter();
  const { t } = useI18n();
  const [adminNote, setAdminNote] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [decided, setDecided] = useState(false);
  const [reauthDecision, setReauthDecision] = useState<'VERIFIED' | 'REJECTED' | null>(null);

  async function decide(decision: 'VERIFIED' | 'REJECTED') {
    setPending(true);
    setMessage(null);
    setReauthDecision(null);
    const res = await fetch(`/api/admin/verifications/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, adminNote: adminNote || undefined })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.requiresReauth) {
        setReauthDecision(decision);
        setPending(false);
        return;
      }
      setMessage(data.error ?? 'Something went wrong.');
      setPending(false);
      return;
    }
    setDecided(true);
    setMessage(decision === 'VERIFIED' ? t('adminVerificationsAdminVerificationQueue.verified', 'Verified ✓') : t('adminVerificationsAdminVerificationQueue.rejected', 'Rejected.'));
    setPending(false);
    router.refresh();
  }

  const location = [profile.city, profile.stateRegion, profile.country].filter(Boolean).join(', ');
  const publicPath = profileTypePath(profile.type, profile.slug);

  return (
    <article
      className="panel"
      style={{
        padding: '1.25rem',
        opacity: decided ? 0.5 : 1,
        transition: 'opacity 0.3s'
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <span
              className="badge"
              style={profile.verificationStatus === 'REJECTED'
                ? { borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)', color: '#fca5a5' }
                : {}}
            >
              {profile.verificationStatus}
            </span>
            <span className="badge" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--muted)' }}>
              {profile.type}
            </span>
          </div>

          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>
            <Link href={publicPath} target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
              {profile.name}
            </Link>
          </h2>

          {location && <p className="meta" style={{ margin: 0 }}>{location}</p>}
        </div>

        <div style={{ textAlign: 'right' }}>
          <p className="meta" style={{ margin: '0 0 0.15rem' }}>{t('adminVerificationsAdminVerificationQueue.hype', 'Hype')}: <strong>{profile.hypeCount}</strong></p>
          <p className="meta" style={{ margin: 0 }}>{t('adminVerificationsAdminVerificationQueue.submitted', 'Submitted')} {formatDate(profile.verificationSubmittedAt)}</p>
        </div>
      </div>

      <div
        className="panel"
        style={{ margin: '0.85rem 0', padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}
      >
        <p className="meta" style={{ margin: '0 0 0.5rem' }}>
          <strong>{t('adminVerificationsAdminVerificationQueue.owner', 'Owner')}:</strong> {profile.owner.username} ({profile.owner.email})
          {' · '}{t('adminVerificationsAdminVerificationQueue.joined', 'Joined')} {formatDate(profile.owner.createdAt)}
        </p>
        {profile.contactInfo && (
          <p className="meta" style={{ margin: '0 0 0.4rem' }}>
            <strong>{t('adminVerificationsAdminVerificationQueue.contact', 'Contact')}:</strong> {profile.contactInfo}
          </p>
        )}
        {profile.verificationNotes && (
          <p className="meta" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            <strong>{t('adminVerificationsAdminVerificationQueue.notes', 'Notes')}:</strong> {profile.verificationNotes}
          </p>
        )}
      </div>

      {!decided && (
        <>
          <div className="field" style={{ marginBottom: '0.75rem' }}>
            <label className="field-label" htmlFor={`note-${profile.id}`}>{t('adminVerificationsAdminVerificationQueue.adminNoteLabel', 'Admin note (optional)')}</label>
            <div className="field-input">
              <textarea
                id={`note-${profile.id}`}
                rows={2}
                placeholder={t('adminVerificationsAdminVerificationQueue.adminNotePlaceholder', 'Reason for decision, instructions for resubmission, etc.')}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={pending}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="cta-row">
            <button
              className="button"
              disabled={pending}
              onClick={() => decide('VERIFIED')}
              style={{ background: 'rgba(35,208,216,0.15)', borderColor: 'rgba(35,208,216,0.4)', color: '#d8f8ff' }}
            >
              {t('adminVerificationsAdminVerificationQueue.verifyButton', 'Verify')}
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => decide('REJECTED')}
              style={{ borderColor: 'rgba(248,113,113,0.4)', color: '#fca5a5' }}
            >
              {t('adminVerificationsAdminVerificationQueue.rejectButton', 'Reject')}
            </button>
            <Link className="button secondary" href={publicPath} target="_blank">
              {t('adminVerificationsAdminVerificationQueue.viewPublicPage', 'View public page ↗')}
            </Link>
          </div>

          {reauthDecision && (
            <div style={{ marginTop: '0.75rem' }}>
              <AdminReauthPrompt
                onCancel={() => setReauthDecision(null)}
                onSuccess={() => {
                  const decision = reauthDecision;
                  setReauthDecision(null);
                  void decide(decision);
                }}
              />
            </div>
          )}
        </>
      )}

      {message && (
        <p className="meta" style={{ marginTop: '0.5rem', color: decided && message.includes('✓') ? '#34d399' : '#fca5a5' }}>
          {message}
        </p>
      )}
    </article>
  );
}

export function AdminVerificationQueue({ profiles }: { profiles: VerificationProfile[] }) {
  const { t } = useI18n();

  if (profiles.length === 0) {
    return (
      <div className="panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p className="meta">{t('adminVerificationsAdminVerificationQueue.noProfiles', 'No profiles are waiting for verification review.')}</p>
      </div>
    );
  }

  const pending = profiles.filter(p => p.verificationStatus === 'PENDING');
  const rejected = profiles.filter(p => p.verificationStatus === 'REJECTED');

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {pending.length > 0 && (
        <>
          <h2 style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('adminVerificationsAdminVerificationQueue.pendingHeading', 'Pending')} ({pending.length})
          </h2>
          {pending.map(p => <VerificationCard key={p.id} profile={p} />)}
        </>
      )}

      {rejected.length > 0 && (
        <>
          <h2 style={{ margin: '1rem 0 0', fontSize: '1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('adminVerificationsAdminVerificationQueue.rejectedHeading', 'Rejected — awaiting resubmission')} ({rejected.length})
          </h2>
          {rejected.map(p => <VerificationCard key={p.id} profile={p} />)}
        </>
      )}
    </div>
  );
}
