'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

/**
 * The one place an organiser can correct a show after it exists.
 *
 * `PATCH /api/shows/[showId]` has accepted a title, a description and a start
 * time since the show model was written, and until 2026-09-14 nothing called
 * it: the event creator has no edit mode, and no dashboard, pane or page drew
 * an Edit link, so a mistyped date on a ticketed show could be fixed only by
 * cancelling it — which refunds every buyer — and creating it again
 * (DESIGN_SYNC row 446). This form sends exactly the fields that route
 * accepts, and only the ones that changed.
 *
 * The fields wear the event creator's own `.field` class and the shell's two
 * button classes, because there is no design for an edit form and the creator
 * IS the design for these three inputs.
 */
export type EditableShow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** ISO instant. */
  startsAt: string;
  ticketsSoldCount: number;
};

/** A `datetime-local` value is wall-clock in the browser's zone, no offset. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShowEditForm({ show }: { show: EditableShow }) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState(show.title);
  const [description, setDescription] = useState(show.description);
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(show.startsAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateChanged = new Date(startsAt).getTime() !== new Date(show.startsAt).getTime();
  const changed = title.trim() !== show.title || description.trim() !== show.description || dateChanged;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    const body: Record<string, string> = {};
    if (title.trim() !== show.title) body.title = title.trim();
    if (description.trim() !== show.description) body.description = description.trim();
    if (dateChanged) body.startsAt = new Date(startsAt).toISOString();
    try {
      const res = await fetch(`/api/shows/${show.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string; issues?: string[] } | null;
        setError(data?.issues?.[0] ?? data?.error ?? t('showEdit.saveFailed', 'The changes could not be saved.'));
        setSaving(false);
        return;
      }
      router.push(`/app/shows/${show.slug}`);
      router.refresh();
    } catch {
      setError(t('showEdit.saveFailed', 'The changes could not be saved.'));
      setSaving(false);
    }
  }

  return (
    <form className="show-edit-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="show-edit-title">{t('showEdit.titleLabel', 'Event title')}</label>
        <input id="show-edit-title" maxLength={200} minLength={3} onChange={(e) => setTitle(e.target.value)} required type="text" value={title} />
      </div>
      <div className="field">
        <label htmlFor="show-edit-starts">{t('showEdit.startsLabel', 'Starts')}</label>
        <input id="show-edit-starts" onChange={(e) => setStartsAt(e.target.value)} required type="datetime-local" value={startsAt} />
        {dateChanged && show.ticketsSoldCount > 0 ? (
          <p className="show-edit-note" role="status">
            {t('showEdit.holdersToldNote', 'Everyone holding a ticket will be told the new time when you save.')}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="show-edit-description">{t('showEdit.descriptionLabel', 'Description')}</label>
        <textarea id="show-edit-description" maxLength={2000} onChange={(e) => setDescription(e.target.value)} rows={6} value={description} />
      </div>
      {error ? <p className="show-edit-error" role="alert">{error}</p> : null}
      <div className="show-edit-actions">
        <Link className="mmm-btn-ghost" href={`/app/shows/${show.slug}`}>{t('showEdit.cancelLink', 'Back without saving')}</Link>
        <button className="mmm-btn-primary" disabled={!changed || saving} type="submit">
          {saving ? t('showEdit.saving', 'Saving…') : t('showEdit.save', 'Save changes')}
        </button>
      </div>
    </form>
  );
}
