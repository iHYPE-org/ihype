'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function VenueRequestForm({ venueProfileId }: { venueProfileId: string }) {
  const { t } = useI18n();
  const [artistName, setArtistName] = useState('');
  const [date, setDate] = useState('');
  const [genre, setGenre] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const noteParts = [
      date ? `${t('venueRequestForm.proposedDate', 'Proposed date')}: ${date}` : null,
      genre ? `${t('venueRequestForm.genreType', 'Genre / type of show')}: ${genre}` : null,
      notes.trim() || null,
    ].filter(Boolean);

    const res = await fetch('/api/venue-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueProfileId,
        requesterType: 'LISTENER',
        artistName: artistName.trim() || undefined,
        note: noteParts.join('\n') || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setArtistName('');
      setDate('');
      setGenre('');
      setNotes('');
      setMessage(t('venueRequestForm.requestSubmitted', 'Request submitted!'));
    } else {
      setMessage(data.error ?? t('venueRequestForm.errorCouldNotSend', 'Could not send this request.'));
    }
    setPending(false);
  }

  return (
    <form className="venue-request-form" onSubmit={submit}>
      <div className="venue-form-group">
        <label htmlFor="venue-request-artist">{t('venueRequestForm.artistNameLabel', 'Artist name or iHYPE handle')}</label>
        <input id="venue-request-artist" onChange={(e) => setArtistName(e.target.value)} placeholder={t('venueRequestForm.artistNamePlaceholder', '@artisthandle or Artist Name')} type="text" value={artistName} />
      </div>
      <div className="venue-form-group">
        <label htmlFor="venue-request-date">{t('venueRequestForm.proposedDateLabel', 'Proposed date')}</label>
        <input id="venue-request-date" onChange={(e) => setDate(e.target.value)} type="date" value={date} />
      </div>
      <div className="venue-form-group">
        <label htmlFor="venue-request-genre">{t('venueRequestForm.genreLabel', 'Genre / type of show')}</label>
        <input id="venue-request-genre" onChange={(e) => setGenre(e.target.value)} placeholder={t('venueRequestForm.genrePlaceholder', 'e.g. Deep House, Indie, DJ Night')} type="text" value={genre} />
      </div>
      <div className="venue-form-group">
        <label htmlFor="venue-request-notes">{t('venueRequestForm.notesLabel', 'Notes')}</label>
        <textarea id="venue-request-notes" onChange={(e) => setNotes(e.target.value)} placeholder={t('venueRequestForm.notesPlaceholder', 'Anything else we should know…')} value={notes} />
      </div>
      <button className="venue-submit-btn" disabled={pending} type="submit">
        {pending ? t('venueRequestForm.submitting', 'Submitting…') : t('venueRequestForm.submitRequest', 'Submit Request')}
      </button>
      {message && <p style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--role-venue)' }}>{message}</p>}

      <style>{`
        .venue-request-form { border: 1px solid var(--line); border-radius: 10px; padding: 28px; background: var(--bg2); }
        .venue-form-group { margin-bottom: 20px; }
        .venue-form-group label { display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 8px; color: var(--ink); }
        .venue-form-group input, .venue-form-group textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--hair-100); border-radius: 8px; background: var(--bg); color: var(--ink); font-size: 0.875rem; font-family: var(--font-body); box-sizing: border-box; }
        .venue-form-group textarea { min-height: 100px; resize: vertical; }
        .venue-submit-btn { padding: 13px 28px; background: var(--role-venue); color: var(--bg); border: none; border-radius: 8px; font-weight: 700; font-size: 0.875rem; cursor: pointer; }
        .venue-submit-btn:disabled { opacity: .6; cursor: default; }
      `}</style>
    </form>
  );
}
