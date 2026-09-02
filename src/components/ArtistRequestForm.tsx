'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type VenueOption = { id: string; slug: string; name: string; city: string | null; stateRegion: string | null; distanceKm?: number | null };
type VenueLists = { loved: VenueOption[]; nearby: VenueOption[]; matches: VenueOption[]; location: { city: string | null } };

/**
 * A fan asking an artist to come to a venue — near the fan, or one they
 * follow (owner, 2026-09-01: "Fans can also request artists come to venues
 * near them or that they love"). It files the SAME `VenueConnectionRequest`
 * the venue page's form files, just entered from the artist's side, so one
 * request feeds the venue's demand radar and the artist's analytics alike.
 *
 * The venue lists come from /api/venue-requests/venues (follows, nearby by
 * the fan's location, and a name search); the submit is /api/venue-requests.
 */
export function ArtistRequestForm({ artistProfileId, artistName }: { artistProfileId: string; artistName: string }) {
  const { t } = useI18n();
  const [lists, setLists] = useState<VenueLists | null>(null);
  const [query, setQuery] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [notifyOnBooking, setNotifyOnBooking] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ artistProfileId });
      if (query.trim().length >= 2) params.set('q', query.trim());
      fetch(`/api/venue-requests/venues?${params}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setLists(d); })
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(handle); controller.abort(); };
  }, [artistProfileId, query]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!venueId) return;
    setPending(true);
    setMessage(null);
    setFailed(false);
    const res = await fetch('/api/venue-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueProfileId: venueId, requesterType: 'LISTENER', artistProfileId, note: note.trim() || undefined, notifyOnBooking }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNote('');
      setVenueId(null);
      setMessage(t('artistRequestForm.sent', 'Sent. The venue sees it on their demand radar, and the artist sees where fans want them.'));
    } else {
      setFailed(true);
      setMessage(data.error ?? t('artistRequestForm.errorCouldNotSend', 'Could not send this request.'));
    }
    setPending(false);
  }

  const groups: { id: string; label: string; venues: VenueOption[] }[] = lists
    ? [
        { id: 'loved', label: t('artistRequestForm.lovedLabel', 'Venues you follow'), venues: lists.loved },
        { id: 'nearby', label: lists.location.city ? `${t('artistRequestForm.nearLabel', 'Near')} ${lists.location.city}` : t('artistRequestForm.nearYouLabel', 'Near you'), venues: lists.nearby },
        { id: 'matches', label: t('artistRequestForm.matchesLabel', 'Matches'), venues: lists.matches },
      ].filter((group) => group.venues.length > 0)
    : [];
  const nothing = lists !== null && groups.length === 0;

  return (
    <form className="arf-form" onSubmit={submit}>
      <label className="arf-label" htmlFor="arf-search">{t('artistRequestForm.searchLabel', 'Which venue?')}</label>
      <input
        id="arf-search"
        className="arf-search"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('artistRequestForm.searchPlaceholder', 'Search venues by name, or pick one below')}
        type="search"
        value={query}
      />
      {lists === null ? (
        <p className="arf-hint">{t('artistRequestForm.loading', 'Finding venues near you…')}</p>
      ) : nothing ? (
        <p className="arf-hint">{t('artistRequestForm.noVenues', 'No venues found yet. Follow a venue, or search for one by name.')}</p>
      ) : (
        groups.map((group) => (
          <div className="arf-group" key={group.id}>
            <span className="arf-group-label">{group.label}</span>
            <div className="arf-options">
              {group.venues.map((venue) => (
                <button
                  key={`${group.id}:${venue.id}`}
                  aria-pressed={venueId === venue.id}
                  className={venueId === venue.id ? 'arf-option arf-option-on' : 'arf-option'}
                  onClick={() => setVenueId(venue.id)}
                  type="button"
                >
                  <span className="arf-option-name">{venue.name}</span>
                  <span className="arf-option-meta">
                    {[venue.city, venue.distanceKm != null ? `${venue.distanceKm} km` : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      <label className="arf-label" htmlFor="arf-note">{t('artistRequestForm.noteLabel', 'Anything to add? (optional)')}</label>
      <textarea
        id="arf-note"
        className="arf-note"
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`${t('artistRequestForm.notePlaceholder', 'Why here, why now — the venue reads this.')}`}
        value={note}
      />
      <label className="arf-check">
        <input checked={notifyOnBooking} onChange={(e) => setNotifyOnBooking(e.target.checked)} type="checkbox" />
        {t('artistRequestForm.notifyOnBooking', 'Tell me if they book them')}
      </label>
      <button className="arf-submit" disabled={pending || !venueId} type="submit">
        {pending
          ? t('artistRequestForm.sending', 'Sending…')
          : `${t('artistRequestForm.submit', 'Ask them to book')} ${artistName}`}
      </button>
      {message && <p className="arf-msg" style={{ color: failed ? 'var(--accent-text)' : 'var(--role-venue)' }}>{message}</p>}

      <style>{`
        .arf-form { display: flex; flex-direction: column; gap: 10px; }
        .arf-label { font-size: 0.9375rem; font-weight: 600; color: var(--ink); }
        .arf-search, .arf-note { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--bg-surface); color: var(--ink); font-family: var(--font-body); font-size: max(16px, 1em); }
        .arf-note { min-height: 80px; resize: vertical; }
        .arf-hint { font-size: 0.9375rem; color: var(--ink-3); margin: 0; }
        .arf-group { display: flex; flex-direction: column; gap: 6px; }
        .arf-group-label { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); }
        .arf-options { display: flex; flex-wrap: wrap; gap: 8px; }
        .arf-option { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--bg-surface); color: var(--ink); cursor: pointer; text-align: left; font-family: var(--font-body); }
        .arf-option-on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
        .arf-option-name { font-size: 0.9375rem; font-weight: 600; }
        .arf-option-meta { font-size: 0.9375rem; color: var(--ink-3); }
        .arf-check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 0.9375rem; color: var(--ink); cursor: pointer; }
        .arf-check input { width: 18px; height: 18px; }
        .arf-submit { min-height: 44px; padding: 12px 20px; border: none; border-radius: var(--radius-pill); background: var(--accent); color: var(--ink-on-accent); font-weight: 600; font-size: 0.9375rem; cursor: pointer; }
        .arf-submit:disabled { opacity: .55; cursor: default; }
        .arf-msg { font-size: 0.9375rem; margin: 0; }
      `}</style>
    </form>
  );
}
