'use client';

import { useState } from 'react';

export function VenueRequestForm({ venueProfileId }: { venueProfileId: string }) {
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
      date ? `Proposed date: ${date}` : null,
      genre ? `Genre / type of show: ${genre}` : null,
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
      setMessage('Request submitted!');
    } else {
      setMessage(data.error ?? 'Could not send this request.');
    }
    setPending(false);
  }

  return (
    <form className="venue-request-form" onSubmit={submit}>
      <div className="venue-form-group">
        <label htmlFor="venue-request-artist">Artist name or iHYPE handle</label>
        <input id="venue-request-artist" onChange={(e) => setArtistName(e.target.value)} placeholder="@artisthandle or Artist Name" type="text" value={artistName} />
      </div>
      <div className="venue-form-group">
        <label htmlFor="venue-request-date">Proposed date</label>
        <input id="venue-request-date" onChange={(e) => setDate(e.target.value)} type="date" value={date} />
      </div>
      <div className="venue-form-group">
        <label htmlFor="venue-request-genre">Genre / type of show</label>
        <input id="venue-request-genre" onChange={(e) => setGenre(e.target.value)} placeholder="e.g. Deep House, Indie, DJ Night" type="text" value={genre} />
      </div>
      <div className="venue-form-group">
        <label htmlFor="venue-request-notes">Notes</label>
        <textarea id="venue-request-notes" onChange={(e) => setNotes(e.target.value)} placeholder="Anything else we should know…" value={notes} />
      </div>
      <button className="venue-submit-btn" disabled={pending} type="submit">
        {pending ? 'Submitting…' : 'Submit Request'}
      </button>
      {message && <p style={{ marginTop: 12, fontSize: 13, color: '#22e5d4' }}>{message}</p>}

      <style>{`
        .venue-request-form { border: 1px solid var(--line); border-radius: 10px; padding: 28px; background: var(--bg2); }
        .venue-form-group { margin-bottom: 20px; }
        .venue-form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--ink); }
        .venue-form-group input, .venue-form-group textarea { width: 100%; padding: 10px 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: var(--bg); color: var(--ink); font-size: 14px; font-family: var(--font-body); box-sizing: border-box; }
        .venue-form-group textarea { min-height: 100px; resize: vertical; }
        .venue-submit-btn { padding: 13px 28px; background: var(--role-venue, #22e5d4); color: #0a0805; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
        .venue-submit-btn:disabled { opacity: .6; cursor: default; }
      `}</style>
    </form>
  );
}
