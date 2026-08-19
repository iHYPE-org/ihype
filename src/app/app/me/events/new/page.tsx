'use client';

import type { CSSProperties } from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import { useFormDraft } from '@/lib/use-form-draft';

type Step = 0 | 1 | 2 | 3 | 4;
type TicketType = 'ga' | 'vip';

function fmt$(dollars: number) {
  return `$${Math.round(dollars).toLocaleString()}`;
}

function fmtCents(dollars: number) {
  return `$${dollars.toFixed(2)}`;
}

type ProfileHit = { id: string; name: string; slug: string; type: string };

function ProfilePicker({
  label,
  types,
  value,
  onChange,
}: {
  label: string;
  types: string[];
  value: ProfileHit | null;
  onChange: (p: ProfileHit | null) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = `profile-picker-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json() as { results?: Array<{ id: string; name: string; slug: string; type: string }> };
        const filtered = (data.results ?? []).filter(p => types.includes(p.type.toUpperCase()))
          .map(p => ({ id: p.id, name: p.name, slug: p.slug, type: p.type }));
        setResults(filtered.slice(0, 6));
        setOpen(true);
      } catch { /* ignore */ }
    }, 280);
  }, [query, types]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (value) {
    return (
      <div className="field">
        <label>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(var(--accent-rgb),.07)', border: '1px solid rgba(var(--accent-rgb),.2)', borderRadius: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{value.name}</div>
            <div style={{ fontSize: '0.7813rem', color: 'var(--ink-a65)', fontFamily: 'var(--font-mono)' }}>{value.type}</div>
          </div>
          <button onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-a65)', fontSize: '1.125rem', lineHeight: 1, padding: '0 4px' }} type="button">×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="field" ref={containerRef} style={{ position: 'relative' }}>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={`${t('eventsNewPage.searchPlaceholderPrefix', 'Search')} ${label.toLowerCase()}…`}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: -10,
          background: 'var(--bg-3)', border: '1px solid var(--hair-100)', borderRadius: 8,
          overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
        }}>
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p); setQuery(''); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '10px 14px', background: 'none',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderBottom: '1px solid var(--hair-50)',
              }}
              type="button"
            >
              <div style={{ fontSize: '0.8125rem', color: 'var(--ink)', fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: '0.7813rem', color: 'var(--ink-a65)', fontFamily: 'var(--font-mono)' }}>{p.type}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const wrapStyle: CSSProperties = { width: '100%', maxWidth: 520, margin: '0 auto' };

export default function EventsNewPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);

  // Basics
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venueProfile, setVenueProfile] = useState<ProfileHit | null>(null);
  const [headliner, setHeadliner] = useState<ProfileHit | null>(null);

  // Ticketing
  const [price, setPrice] = useState('18');
  const [capacity, setCapacity] = useState('300');
  const [ticketType, setTicketType] = useState<TicketType>('ga');

  // Details
  const [description, setDescription] = useState('');
  const [ageRequirement, setAgeRequirement] = useState('All ages');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  const draft = useMemo(() => ({
    step, title, date, time, venueProfile, headliner, price, capacity,
    ticketType, description, ageRequirement, notes,
  }), [ageRequirement, capacity, date, description, headliner, notes, price, step, ticketType, time, title, venueProfile]);
  const draftDirty = Boolean(title.trim() || date || venueProfile || headliner || description.trim() || notes.trim() || step > 0);
  const clearDraft = useFormDraft({
    dirty: draftDirty && !publishedSlug,
    key: 'ihype-draft-event',
    onRestore: (saved: typeof draft) => {
      setStep(saved.step >= 0 && saved.step <= 3 ? saved.step : 0);
      setTitle(saved.title ?? '');
      setDate(saved.date ?? '');
      setTime(saved.time ?? '');
      setVenueProfile(saved.venueProfile ?? null);
      setHeadliner(saved.headliner ?? null);
      setPrice(saved.price ?? '18');
      setCapacity(saved.capacity ?? '300');
      setTicketType(saved.ticketType === 'vip' ? 'vip' : 'ga');
      setDescription(saved.description ?? '');
      setAgeRequirement(saved.ageRequirement ?? 'All ages');
      setNotes(saved.notes ?? '');
    },
    value: draft,
  });

  const priceDollars = parseFloat(price || '0');
  const cap = parseInt(capacity, 10) || 0;
  const gross = priceDollars * cap;

  const s0Valid = Boolean(title.trim() && date && venueProfile);

  useEffect(() => {
    const venueId = new URLSearchParams(window.location.search).get('venue');
    if (!venueId) return;
    let cancelled = false;
    fetch('/api/pages/home')
      .then((response) => response.ok ? response.json() : null)
      .then((data: { myProfiles?: ProfileHit[] } | null) => {
        if (cancelled) return;
        const ownedVenue = data?.myProfiles?.find((profile) => profile.id === venueId && profile.type === 'VENUE');
        if (ownedVenue) setVenueProfile(ownedVenue);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const datetime = date ? `${date}T${time || '21:00'}` : undefined;
      const res = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled Event',
          description: description.trim() || undefined,
          status: 'SCHEDULED',
          startsAt: datetime ? new Date(datetime).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
          isTicketed: priceDollars > 0,
          ticketPriceCents: Math.round(priceDollars * 100),
          ticketCapacity: cap || undefined,
          venuePayoutPercent: 20,
          artistPayoutPercent: 70,
          promoterPayoutPercent: 10,
          tags: ticketType === 'vip' ? ['vip'] : undefined,
          headlinerProfileId: headliner?.id ?? undefined,
          venueProfileId: venueProfile?.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create show');
        setSubmitting(false);
        return;
      }
      clearDraft();
      setPublishedSlug(data.slug);
      setStep(4);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = [25, 50, 75, 100][step] ?? 0;

  return (
    <div style={{ display: 'grid', placeItems: 'start center', padding: '32px 16px 80px' }}>
      <div style={wrapStyle}>

        {step < 4 && (
          <>
            <div className="label" style={{ marginBottom: 10 }}>
              {[
                t('eventsNewPage.stepLabelBasics', 'Step 1 of 4 · Basics'),
                t('eventsNewPage.stepLabelTickets', 'Step 2 of 4 · Tickets'),
                t('eventsNewPage.stepLabelDetails', 'Step 3 of 4 · Details'),
                t('eventsNewPage.stepLabelReview', 'Step 4 of 4 · Review'),
              ][step]}
            </div>
            <div className="progress-wrap"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
          </>
        )}

        {/* Step 0: Basics */}
        {step === 0 && (
          <>
            <div className="cover-slot">{t('eventsNewPage.coverArtSlot', 'Event cover art')}</div>
            <h1>{t('eventsNewPage.basicsTitle', 'Create an event.')}</h1>
            <p className="sub">{t('eventsNewPage.basicsSubtitle', 'Fill in the details. The 70/20/10 split is automatic — no configuration needed.')}</p>
            <div className="field">
              <label htmlFor="event-title">{t('eventsNewPage.eventTitleLabel', 'Event title')}</label>
              <input id="event-title" onChange={(e) => setTitle(e.target.value)} placeholder={t('eventsNewPage.eventTitlePlaceholder', 'e.g. Midnight Echo — Live at The Echo')} value={title} />
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="event-date">{t('eventsNewPage.dateLabel', 'Date')}</label>
                <input id="event-date" onChange={(e) => setDate(e.target.value)} type="date" value={date} />
              </div>
              <div className="field">
                <label htmlFor="event-time">{t('eventsNewPage.doorsTimeLabel', 'Doors time')}</label>
                <input id="event-time" onChange={(e) => setTime(e.target.value)} type="time" value={time} />
              </div>
            </div>
            <ProfilePicker label={t('eventsNewPage.venueLabel', 'Venue')} onChange={setVenueProfile} types={['VENUE']} value={venueProfile} />
            <ProfilePicker label={t('eventsNewPage.artistsLabel', 'Artist(s)')} onChange={setHeadliner} types={['ARTIST']} value={headliner} />
            <button className="btn-primary" disabled={!s0Valid} onClick={() => setStep(1)} type="button">{t('eventsNewPage.continueCta', 'Continue →')}</button>
          </>
        )}

        {/* Step 1: Ticketing */}
        {step === 1 && (
          <>
            <h1>{t('eventsNewPage.ticketingTitle', 'Ticketing.')}</h1>
            <p className="sub">{t('eventsNewPage.ticketingSubtitle', 'Set face value and capacity. The split is fixed: 70% artist · 20% venue · 10% promoters · $0 iHYPE.')}</p>
            <div className="grid2">
              <div className="field">
                <label htmlFor="event-price">{t('eventsNewPage.faceValueLabel', 'Face value ($)')}</label>
                <input id="event-price" max={500} min={5} onChange={(e) => setPrice(e.target.value)} type="number" value={price} />
              </div>
              <div className="field">
                <label htmlFor="event-capacity">{t('eventsNewPage.capacityLabel', 'Capacity')}</label>
                <input id="event-capacity" max={5000} min={10} onChange={(e) => setCapacity(e.target.value)} type="number" value={capacity} />
              </div>
            </div>
            <div className="card">
              <div className="label" style={{ marginBottom: 10 }}>{t('eventsNewPage.ifSellsOut', 'If it sells out')}</div>
              <div className="split-bar" style={{ marginBottom: 14 }}>
                <div style={{ flex: 70, background: 'var(--accent)', borderRadius: '999px 0 0 999px' }} />
                <div style={{ flex: 20, background: 'var(--role-venue)' }} />
                <div style={{ flex: 10, background: 'var(--role-fan)', borderRadius: '0 999px 999px 0' }} />
              </div>
              <div style={{ display: 'flex', gap: 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-text)' }}>{fmt$(gross * .7)}</div>
                  <div className="label" style={{ marginTop: 3 }}>{t('eventsNewPage.splitArtist', '70% Artist')}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--role-venue)' }}>{fmt$(gross * .2)}</div>
                  <div className="label" style={{ marginTop: 3 }}>{t('eventsNewPage.splitVenue', '20% Venue')}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--role-fan)' }}>{fmt$(gross * .1)}</div>
                  <div className="label" style={{ marginTop: 3 }}>{t('eventsNewPage.splitPromoters', '10% Promoters')}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink-3)' }}>$0</div>
                  <div className="label" style={{ marginTop: 3 }}>{t('eventsNewPage.splitIhype', 'iHYPE')}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="label" style={{ marginBottom: 12 }}>{t('eventsNewPage.payoutPreviewLabel', 'Payout preview · per ticket')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', padding: '6px 0' }}>
                <span style={{ color: 'var(--accent-text)' }}>{t('eventsNewPage.payoutArtist', 'Artist · 70%')}</span><b>{fmtCents(priceDollars * .7)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', padding: '6px 0' }}>
                <span style={{ color: 'var(--role-venue)' }}>{t('eventsNewPage.payoutVenue', 'Venue · 20%')}</span><b>{fmtCents(priceDollars * .2)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', padding: '6px 0' }}>
                <span style={{ color: 'var(--role-fan)' }}>{t('eventsNewPage.payoutPromoterPool', 'Promoter pool · 10%')}</span><b>{fmtCents(priceDollars * .1)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', padding: '6px 0', borderTop: '1px solid var(--hair-50)', marginTop: 4 }}>
                <span style={{ color: 'var(--ink-3)' }}>{t('eventsNewPage.payoutIhype', 'iHYPE · 0%')}</span><b style={{ color: 'var(--ink-3)' }}>$0.00</b>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7813rem', color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.6 }}>
                {t('eventsNewPage.payoutFinePrint', 'Buyer pays face value + card processing at cost (2.9% + $0.30; AMEX 3.5% + $0.30). Tax estimate shown at checkout. Sell-out gross:')} {fmt$(gross)}.
              </div>
            </div>
            <div className="field"><label>{t('eventsNewPage.ticketTypesLabel', 'Ticket types')}</label></div>
            <button
              aria-pressed={ticketType === 'ga'}
              className={`ticket-type-btn${ticketType === 'ga' ? ' selected' : ''}`}
              onClick={() => setTicketType('ga')}
              type="button"
            >
              <span style={{ fontSize: '1.25rem' }}>◇</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem' }}>{t('eventsNewPage.gaTitle', 'General Admission')}</div>
                <div style={{ fontSize: '0.7813rem', color: 'var(--ink-3)' }}>{t('eventsNewPage.gaSubtitle', 'Single entry, face value')}</div>
              </div>
            </button>
            <button
              aria-pressed={ticketType === 'vip'}
              className={`ticket-type-btn${ticketType === 'vip' ? ' selected' : ''}`}
              onClick={() => setTicketType('vip')}
              type="button"
            >
              <span style={{ fontSize: '1.25rem' }}>★</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem' }}>{t('eventsNewPage.vipTitle', 'VIP')}</div>
                <div style={{ fontSize: '0.7813rem', color: 'var(--ink-3)' }}>{t('eventsNewPage.vipSubtitle', 'Early entry + extras (custom price)')}</div>
              </div>
            </button>
            <button className="btn-primary" onClick={() => setStep(2)} style={{ marginTop: 12 }} type="button">{t('eventsNewPage.continueCta', 'Continue →')}</button>
            <button className="btn-ghost" onClick={() => setStep(0)} type="button">{t('eventsNewPage.backCta', 'Back')}</button>
          </>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <>
            <h1>{t('eventsNewPage.detailsTitle', 'Details.')}</h1>
            <p className="sub">{t('eventsNewPage.detailsSubtitle', 'Add a description and any requirements. This appears on the public event page.')}</p>
            <div className="field">
              <label htmlFor="event-description">{t('eventsNewPage.descriptionLabel', 'Description')}</label>
              <textarea id="event-description" onChange={(e) => setDescription(e.target.value)} placeholder={t('eventsNewPage.descriptionPlaceholder', 'Tell fans what to expect…')} value={description} />
            </div>
            <div className="field">
              <label htmlFor="event-age-requirement">{t('eventsNewPage.ageRequirementLabel', 'Age requirement')}</label>
              <select id="event-age-requirement" onChange={(e) => setAgeRequirement(e.target.value)} value={ageRequirement}>
                <option value="All ages">{t('eventsNewPage.ageAllAges', 'All ages')}</option>
                <option value="18+">18+</option>
                <option value="21+">21+</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="event-notes">{t('eventsNewPage.notesLabel', 'Dress code / notes (optional)')}</label>
              <input id="event-notes" onChange={(e) => setNotes(e.target.value)} placeholder={t('eventsNewPage.notesPlaceholder', 'e.g. Smart casual, no photography')} type="text" value={notes} />
            </div>
            <button className="btn-primary" onClick={() => setStep(3)} type="button">{t('eventsNewPage.continueCta', 'Continue →')}</button>
            <button className="btn-ghost" onClick={() => setStep(1)} type="button">{t('eventsNewPage.backCta', 'Back')}</button>
          </>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <>
            <h1>{t('eventsNewPage.reviewTitle', 'Review & publish.')}</h1>
            <p className="sub">{t('eventsNewPage.reviewSubtitle', 'Once published, your event goes live and tickets are available immediately.')}</p>
            <div className="card">
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>{title || t('eventsNewPage.untitledEvent', 'Untitled Event')}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7813rem', color: 'var(--ink-3)', marginBottom: 14 }}>
                {date || t('eventsNewPage.tbd', 'TBD')} · {venueProfile?.name ?? t('eventsNewPage.tbd', 'TBD')} · ${priceDollars || 0} · {cap || 0} {t('eventsNewPage.capAbbrev', 'cap')}
              </div>
              <div className="split-bar" style={{ marginBottom: 12 }}>
                <div style={{ flex: 70, background: 'var(--accent)', borderRadius: '999px 0 0 999px' }} />
                <div style={{ flex: 20, background: 'var(--role-venue)' }} />
                <div style={{ flex: 10, background: 'var(--role-fan)', borderRadius: '0 999px 999px 0' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7813rem', color: 'var(--ink-3)' }}>
                {fmt$(gross * .7)} {t('eventsNewPage.artistWord', 'artist')} · {fmt$(gross * .2)} {t('eventsNewPage.venueWord', 'venue')} · {fmt$(gross * .1)} {t('eventsNewPage.promotersWord', 'promoters')} · $0 iHYPE
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(var(--warning-rgb),.25)', background: 'rgba(var(--warning-rgb),.06)', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7813rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 8 }}>
                ⚠ {t('eventsNewPage.reviewWarningTitle', 'Review before you lock')}
              </div>
              <div style={{ fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {t('eventsNewPage.reviewWarningLead', 'Publishing freezes the charter:')} <b style={{ color: 'var(--ink)' }}>{t('eventsNewPage.chartersSplit', '70% artist · 20% venue · 10% promoters · 0% iHYPE')}</b> {t('eventsNewPage.reviewWarningAt', 'at')} <b style={{ color: 'var(--ink)' }}>${priceDollars || 0}</b> {t('eventsNewPage.reviewWarningFaceValue', 'face value,')} {cap || 0} {t('eventsNewPage.reviewWarningTickets', 'serialized QR tickets. The split can never change after the first sale. Resale is limited to face value — see the')} <Link href="/ticket-policy" style={{ color: 'var(--accent-text)' }}>{t('eventsNewPage.ticketPolicyLink', 'ticket policy')}</Link> {t('eventsNewPage.reviewWarningTerms', 'for refund and transfer terms.')}
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(var(--role-venue-rgb),.2)', background: 'rgba(var(--role-venue-rgb),.04)', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7813rem', color: 'var(--role-venue)', lineHeight: 1.5 }}>
                {t('eventsNewPage.ihypeChip', 'iHYPE takes $0 · 70/20/10 split locked in charter · tickets go on sale immediately')}
              </div>
            </div>
            <div aria-atomic="true" aria-live="polite">
              {error && <p style={{ color: 'var(--accent-text)', fontSize: '0.8125rem', marginBottom: 12 }}>{error}</p>}
            </div>
            <button className="btn-primary" disabled={submitting} onClick={publish} type="button">
              {submitting ? t('eventsNewPage.publishing', 'Publishing…') : t('eventsNewPage.publishCta', 'Publish event & lock charter')}
            </button>
            <button className="btn-ghost" onClick={() => setStep(2)} type="button">{t('eventsNewPage.backCta', 'Back')}</button>
          </>
        )}

        {/* Done */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(var(--role-venue-rgb),.12)', border: '2px solid var(--role-venue)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <svg fill="none" height="28" stroke="var(--role-venue)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="28"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" /><path d="M13 5v2M13 11v2M13 17v2" /></svg>
            </div>
            <h1 style={{ marginBottom: '.5rem' }}>{t('eventsNewPage.publishedTitle', 'Event published.')}</h1>
            <p className="sub" style={{ textAlign: 'center', maxWidth: '34ch', margin: '0 auto 1.5rem' }}>
              {t('eventsNewPage.publishedSubtitle', 'Your event is live. Tickets are on sale. Fans who hyped the artist will get notified first.')}
            </p>
            {publishedSlug && (
              <Link className="btn-primary" href={`/app/shows/${publishedSlug}`} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 10 }}>
                {t('eventsNewPage.viewEventPage', 'View event page →')}
              </Link>
            )}
            <Link className="btn-ghost" href="/app/music/discover" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              {t('eventsNewPage.backToDashboard', 'Back to dashboard')}
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .label { font-family: var(--font-mono); font-size: .65rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
        h1 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 800; letter-spacing: -.03em; line-height: .95; margin-bottom: .5rem; color: var(--ink); }
        .sub { font-size: .88rem; color: var(--ink-2); line-height: 1.65; margin-bottom: 1.5rem; }
        .progress-wrap { height: 3px; background: var(--bg3, var(--bg)); border-radius: 999px; margin-bottom: 28px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width .4s ease; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-family: var(--font-mono); font-size: 0.7813rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 6px; }
        .field input, .field select, .field textarea { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--hair-80); background: var(--bg3, var(--bg)); color: var(--ink); font-size: .9rem; outline: none; transition: border-color .15s; box-sizing: border-box; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(var(--accent-rgb),.4); }
        .field textarea { resize: vertical; min-height: 70px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }
        .btn-primary { width: 100%; padding: 13px; border-radius: 999px; background: var(--accent); color: var(--ink-on-accent); border: none; font-family: var(--font-display); font-weight: 800; font-size: .95rem; cursor: pointer; box-shadow: 0 4px 20px rgba(var(--accent-rgb),.25); margin-top: 4px; text-align: center; text-decoration: none; display: block; }
        .btn-primary:disabled { background: var(--bg3); color: var(--ink-3); box-shadow: none; cursor: default; }
        .btn-ghost { width: 100%; padding: 11px; border-radius: 999px; background: transparent; color: var(--ink-2); border: none; font-family: var(--font-display); font-weight: 700; font-size: .88rem; cursor: pointer; margin-top: 8px; text-align: center; text-decoration: none; display: block; }
        .card { background: var(--bg2, #0e0b08); border: 1px solid var(--line, var(--hair-80)); border-radius: 16px; padding: 1.25rem; margin-bottom: 12px; }
        .split-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; gap: 2px; }
        .ticket-type-btn { display: flex; width: 100%; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line, var(--hair-80)); color: var(--ink); text-align: left; cursor: pointer; margin-bottom: 8px; transition: all .15s; background: var(--bg2, #0e0b08); }
        .ticket-type-btn:hover { border-color: rgba(var(--accent-rgb),.3); }
        .ticket-type-btn.selected { border-color: var(--accent); background: rgba(var(--accent-rgb),.06); }
        .cover-slot { width: 100%; height: 140px; margin-bottom: 20px; border-radius: 12px; background: var(--bg2, #0e0b08); border: 1px dashed var(--hair-100); display: flex; align-items: center; justify-content: center; color: var(--ink-3); font-family: var(--font-mono); font-size: 0.7813rem; letter-spacing: .1em; text-transform: uppercase; }
      `}</style>
    </div>
  );
}
