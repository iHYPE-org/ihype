'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { instantFromWallClock, wallClockInZone } from '@/lib/zoned-time';

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
 *
 * The start field reads and writes the VENUE'S clock, not the editor's. A
 * `datetime-local` input is wall clock with no offset, so the obvious
 * implementation — `new Date(iso)` in, `new Date(value)` out — silently uses
 * whatever zone the editing browser is set to: an organiser in Berlin opening a
 * Portland show would be shown 3:00 AM for a 9 PM door, and "correcting" it
 * would move the show by six hours. `Show.timeZone` is the clock the time was
 * entered on, and the conversions live in `zoned-time.ts`. A show created
 * before that column has none, and then this falls back to the editor's own
 * browser zone — the old behaviour — and sends it, so the next edit has a
 * clock to work on.
 */
export type EditableShow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** ISO instant. */
  startsAt: string;
  /** The IANA zone the door time was entered on, or null for a show that predates the column. */
  timeZone: string | null;
  ticketsSoldCount: number;
};

/**
 * The first-paint value for a show with no stored zone: the instant read in
 * whatever zone this runtime is set to. It exists only so the server and the
 * client agree on the HTML; the effect below replaces it with the browser's own
 * reading as soon as one is available.
 */
function toServerWallClock(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShowEditForm({ show }: { show: EditableShow }) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState(show.title);
  const [description, setDescription] = useState(show.description);
  /* The clock this field speaks: the show's own where it has one, otherwise
     this browser's — which is what the field used to speak unconditionally.
     The browser's is read in an EFFECT, never during render: this form is
     server-rendered, the server's zone is UTC, and a zone read in render puts
     one wall clock in the HTML and a different one in the hydrated input. */
  const [browserZone, setBrowserZone] = useState<string | null>(null);
  const zone = show.timeZone || browserZone;
  const [startsAt, setStartsAt] = useState(() => (
    show.timeZone ? wallClockInZone(new Date(show.startsAt), show.timeZone) : toServerWallClock(show.startsAt)
  ));
  const edited = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show.timeZone) return;
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    setBrowserZone(here);
    /* Re-render the untouched field on the zone we just learned. A field the
       organiser has already typed into is theirs and is left alone. */
    if (here && !edited.current) setStartsAt(wallClockInZone(new Date(show.startsAt), here));
  }, [show.timeZone, show.startsAt]);

  const enteredInstant = (zone ? instantFromWallClock(startsAt, zone) : null) ?? new Date(startsAt);
  const dateChanged = enteredInstant.getTime() !== new Date(show.startsAt).getTime();
  const changed = title.trim() !== show.title || description.trim() !== show.description || dateChanged;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    const body: Record<string, string> = {};
    if (title.trim() !== show.title) body.title = title.trim();
    if (description.trim() !== show.description) body.description = description.trim();
    if (dateChanged) {
      body.startsAt = enteredInstant.toISOString();
      /* Only where the show had no clock of its own: an edit records the zone
         it was typed on, it never REASSIGNS a zone the venue already stated. */
      if (!show.timeZone && zone) body.timeZone = zone;
    }
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
        <input
          id="show-edit-starts"
          onChange={(e) => { edited.current = true; setStartsAt(e.target.value); }}
          required
          type="datetime-local"
          value={startsAt}
        />
        {zone ? <p className="show-edit-note">{t('showEdit.zoneNote', "Times are on the venue's clock:")} {zone}</p> : null}
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
