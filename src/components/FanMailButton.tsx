'use client';

import { useState } from 'react';

/**
 * Wires POST /api/profile/[slug]/fan-mail (src/app/api/profile/[slug]/fan-mail/route.ts).
 *
 * That route is a profile-owner broadcast, not a fan-to-artist message: it requires
 * `db.profile.findUnique({ where: { id: slug, ownerId: session.user.id } })`, i.e. the
 * signed-in session must own the profile, and it emails every current follower
 * (`Follow` rows with `notifyShows: true`) with the composed subject/content. Rate
 * limited to once per 7 days via `Profile.fanMailLastSentAt`. Mount this only for the
 * owner (`isOwner`) — a non-owner calling it always gets a 403.
 */
export function FanMailButton({
  profileId,
  triggerClassName,
  label = 'Send fan mail',
}: {
  profileId: string;
  triggerClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  function close() {
    setOpen(false);
    setError(null);
    setSentCount(null);
    setSubject('');
    setContent('');
  }

  async function submit() {
    if (submitting) return;
    const trimmedSubject = subject.trim();
    const trimmedContent = content.trim();
    if (!trimmedSubject || !trimmedContent) {
      setError('Subject and message are both required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/${profileId}/fan-mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: trimmedSubject, content: trimmedContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not send fan mail.');
        return;
      }
      setSentCount(typeof data.sent === 'number' ? data.sent : 0);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button className={triggerClassName ?? 'button small secondary'} onClick={() => setOpen(true)} type="button">
        {label}
      </button>

      {open && (
        <div className="fm-modal-wrap" onClick={close}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal-head">
              <span>{sentCount !== null ? 'Fan mail sent' : 'Message your fans'}</span>
              <button aria-label="Close" className="fm-modal-close" onClick={close} type="button">×</button>
            </div>
            <div className="fm-modal-body">
              {sentCount !== null ? (
                <p className="fm-status fm-status-ok">
                  Sent to {sentCount} {sentCount === 1 ? 'fan' : 'fans'} who follow you with show notifications on.
                </p>
              ) : (
                <>
                  <p className="fm-hint">This emails everyone currently following you (with notifications on). Limited to once every 7 days.</p>
                  <label className="fm-field">
                    <span>Subject</span>
                    <input
                      disabled={submitting}
                      maxLength={100}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What's this about?"
                      type="text"
                      value={subject}
                    />
                  </label>
                  <label className="fm-field">
                    <span>Message</span>
                    <textarea
                      disabled={submitting}
                      maxLength={2000}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Write your update…"
                      rows={6}
                      value={content}
                    />
                  </label>
                  {error && <p className="fm-status fm-status-error">{error}</p>}
                </>
              )}
            </div>
            <div className="fm-modal-foot">
              {sentCount !== null ? (
                <button className="fm-btn fm-btn-primary" onClick={close} type="button">Done</button>
              ) : (
                <>
                  <button className="fm-btn" disabled={submitting} onClick={close} type="button">Cancel</button>
                  <button className="fm-btn fm-btn-primary" disabled={submitting} onClick={submit} type="button">
                    {submitting ? 'Sending…' : 'Send'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fm-modal-wrap { position: fixed; inset: 0; background: rgba(0,0,0,.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .fm-modal { width: 100%; max-width: 420px; background: var(--bg2); border: 1px solid var(--hair-100); border-radius: 16px; overflow: hidden; max-height: 85vh; overflow-y: auto; }
        .fm-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--line); font-family: var(--font-display); font-weight: 800; font-size: 15px; color: var(--ink); }
        .fm-modal-close { background: none; border: none; color: var(--ink-a65); font-size: 20px; line-height: 1; cursor: pointer; padding: 4px; }
        .fm-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
        .fm-hint { font-size: 12px; color: var(--ink-a65); margin: 0; }
        .fm-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: var(--ink-a65); }
        .fm-field input, .fm-field textarea { font: inherit; font-size: 13px; font-weight: 400; color: var(--ink); background: var(--line); border: 1px solid var(--hair-100); border-radius: 9px; padding: 10px 12px; resize: vertical; }
        .fm-field input:focus, .fm-field textarea:focus { outline: 2px solid var(--accent, #ff5029); outline-offset: 1px; }
        .fm-status { font-size: 12px; margin: 0; }
        .fm-status-error { color: var(--accent, #ff5029); }
        .fm-status-ok { color: var(--ink); }
        .fm-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--line); }
        .fm-btn { padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; border: 1px solid var(--hair-100); background: var(--line); color: var(--ink); cursor: pointer; }
        .fm-btn:disabled { opacity: .6; cursor: default; }
        .fm-btn-primary { background: var(--accent, #ff5029); border-color: var(--accent, #ff5029); color: #fff; }
      `}</style>
    </>
  );
}
