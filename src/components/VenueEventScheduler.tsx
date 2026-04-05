'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_PROMOTER_AFFILIATE_PERCENT,
  MAX_PROMOTER_AFFILIATE_PERCENT,
  calculateTicketOrderFinancials,
  formatCurrencyFromCents,
  formatPercent,
  getRemainingPayoutPercent
} from '@/lib/ticketing';

export type BookedAct = {
  id: string;
  name: string;
  type: 'ARTIST' | 'DJ';
  contactInfo?: string | null;
  hometown?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  verified?: boolean;
  requestCount?: number;
  availabilitySummary?: string;
  nextShowAtLabel?: string | null;
  rationale?: string;
  suggestedSlots?: Array<{
    value: string;
    label: string;
  }>;
};

type PromoterOption = {
  id: string;
  name: string;
};

type ScheduledEvent = {
  id: string;
  title: string;
  slug: string;
  startsAtLabel: string;
  status: string;
  headlinerName: string | null;
  isTicketed: boolean;
  ticketingOpenedAtLabel?: string | null;
  ticketPriceCents?: number | null;
  ticketCapacity?: number | null;
  ticketsSoldCount?: number;
};

type VenueEventSchedulerProps = {
  venueProfileId: string;
  bookedActs: BookedAct[];
  promoterOptions: PromoterOption[];
  preferredActId?: string;
  recommendedActs?: BookedAct[];
  scheduledEvents?: ScheduledEvent[];
  venueLocation?: {
    postalCode?: string | null;
    stateRegion?: string | null;
    country?: string | null;
  } | null;
};

function buildBookingLegalSummary(act: BookedAct | null) {
  if (!act) {
    return 'Select an artist to load the legal booking summary.';
  }

  const lines = [
    `Act: ${act.name}`,
    `Type: ${act.type === 'DJ' ? 'Promoter / DJ' : 'Artist'}`,
    act.contactInfo ? `Contact: ${act.contactInfo}` : null,
    act.hometown || act.city || act.stateRegion || act.country
      ? `Home market: ${[act.hometown, act.city, act.stateRegion, act.country].filter(Boolean).join(', ')}`
      : null,
    act.verified ? 'Verification: Verified profile ownership' : 'Verification: Pending or not verified',
    act.availabilitySummary ? `Availability: ${act.availabilitySummary}` : null,
    act.rationale ? `Demand signal: ${act.rationale}` : null
  ].filter(Boolean);

  return lines.join('\n');
}

export function VenueEventScheduler({
  venueProfileId,
  bookedActs,
  promoterOptions,
  preferredActId,
  recommendedActs = [],
  scheduledEvents = [],
  venueLocation
}: VenueEventSchedulerProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [headlinerProfileId, setHeadlinerProfileId] = useState(
    preferredActId && bookedActs.some((act) => act.id === preferredActId) ? preferredActId : bookedActs[0]?.id ?? ''
  );
  const [promoterProfileId, setPromoterProfileId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [ticketPrice, setTicketPrice] = useState('25');
  const [ticketCapacity, setTicketCapacity] = useState('200');
  const [promoterPayoutPercent, setPromoterPayoutPercent] = useState(String(DEFAULT_PROMOTER_AFFILIATE_PERCENT));
  const [venuePayoutPercent, setVenuePayoutPercent] = useState('50');
  const [ticketingOpensAt, setTicketingOpensAt] = useState('');
  const [bookingLegalNotes, setBookingLegalNotes] = useState('');
  const [tags, setTags] = useState('ticketed, booked');
  const [pending, setPending] = useState(false);
  const [openingEventId, setOpeningEventId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedAct = useMemo(
    () => bookedActs.find((act) => act.id === headlinerProfileId) ?? null,
    [bookedActs, headlinerProfileId]
  );
  const promoterAffiliateShare = Number(promoterPayoutPercent || 0);
  const remainingForVenueAndArtist = getRemainingPayoutPercent(promoterAffiliateShare);
  const venueShare = Number(venuePayoutPercent || 0);
  const artistShare = remainingForVenueAndArtist - venueShare;
  const potentialGrossCents = Math.max(
    0,
    Math.round(Number(ticketPrice || 0) * 100) * Math.max(1, Number(ticketCapacity || 0))
  );
  const preview = useMemo(
    () =>
      calculateTicketOrderFinancials({
        ticketPriceCents: Math.max(100, Math.round(Number(ticketPrice || 0) * 100)),
        quantity: 1,
        venuePayoutPercent: Math.max(0, venueShare),
        artistPayoutPercent: Math.max(0, artistShare),
        promoterPayoutPercent: Math.max(0, promoterAffiliateShare),
        buyerLocation: venueLocation,
        venueLocation
      }),
    [artistShare, promoterAffiliateShare, ticketPrice, venueLocation, venueShare]
  );
  const legalBookingPreview = bookingLegalNotes.trim() || buildBookingLegalSummary(selectedAct);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startsAt) {
      setMessage('Choose a start time for the event.');
      return;
    }

    if (artistShare < 0) {
      setMessage(
        `Venue share must leave ${formatPercent(remainingForVenueAndArtist)} combined for the venue and artist.`
      );
      return;
    }

    setPending(true);
    setMessage(null);

    const response = await fetch('/api/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        venueProfileId,
        headlinerProfileId,
        promoterProfileId: promoterProfileId || undefined,
        isTicketed: true,
        ticketingOpensAt: ticketingOpensAt ? new Date(ticketingOpensAt).toISOString() : undefined,
        bookingLegalNotes: legalBookingPreview,
        ticketPriceCents: Math.round(Number(ticketPrice || 0) * 100),
        ticketCapacity: Number(ticketCapacity || 0),
        venuePayoutPercent: venueShare,
        artistPayoutPercent: artistShare,
        promoterPayoutPercent: promoterAffiliateShare,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      })
    });

    const data = await response.json();

    if (response.ok) {
      setTitle('');
      setDescription('');
      setStartsAt('');
      setEndsAt('');
      setTicketPrice('25');
      setTicketCapacity('200');
      setPromoterPayoutPercent(String(DEFAULT_PROMOTER_AFFILIATE_PERCENT));
      setVenuePayoutPercent('50');
      setTicketingOpensAt('');
      setBookingLegalNotes('');
      setTags('ticketed, booked');
      setMessage(`Event scheduled. ${data.title} is now in the venue calendar.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not schedule this event.');
    }

    setPending(false);
  }

  async function handleOpenEvent(eventId: string) {
    setOpeningEventId(eventId);
    setMessage(null);

    const response = await fetch(`/api/shows/${eventId}/ticketing/open`, {
      method: 'POST'
    });

    const data = await response.json();
    setOpeningEventId(null);

    if (response.ok) {
      setMessage(data.message ?? 'Event opened.');
      router.refresh();
      return;
    }

    setMessage(data.error ?? 'Could not open this event.');
  }

  return (
    <div className="panel ticketing-panel">
      <div className="ticketing-panel-header">
        <div>
          <div className="badge">Event ticketing engine</div>
          <h3>Create, price, and open new events</h3>
          <p className="kicker">
            Pick artists manually or from recommendation signals, lock the legal booking snapshot, set ticket splits,
            and only charge fan payment tokens when the venue officially opens the event.
          </p>
        </div>
      </div>

      {bookedActs.length ? (
        <form className="form" onSubmit={handleSubmit}>
          <div className="grid grid-2">
            <label className="field">
              <span>Event title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Lakefront Frequency x South Loop Signal"
                required
              />
            </label>

            <label className="field">
              <span>Artist or act</span>
              <select value={headlinerProfileId} onChange={(event) => setHeadlinerProfileId(event.target.value)} required>
                {bookedActs.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.name} ({act.type === 'DJ' ? 'PROMOTER / DJ' : 'ARTIST'})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {recommendedActs.length || scheduledEvents.length ? (
            <div className="ticketing-engine-grid">
              {recommendedActs.length ? (
                <div className="ticketing-engine-column">
                  <div className="badge">Recommended artists</div>
                  <div className="ticketing-engine-act-list">
                    {recommendedActs.map((act) => (
                      <article className="ticketing-engine-act-card" key={act.id}>
                        <div className="ticketing-engine-act-head">
                          <strong>{act.name}</strong>
                          <span>
                            {act.requestCount ?? 0} request{act.requestCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        {act.rationale ? <p>{act.rationale}</p> : null}
                        {act.availabilitySummary ? <p>{act.availabilitySummary}</p> : null}
                        {act.nextShowAtLabel ? <span>Next show: {act.nextShowAtLabel}</span> : null}
                        <div className="ticketing-engine-slot-row">
                          <button className="button small secondary" onClick={() => setHeadlinerProfileId(act.id)} type="button">
                            Use act
                          </button>
                          {act.suggestedSlots?.slice(0, 2).map((slot) => (
                            <button
                              className="ticketing-slot-pill"
                              key={slot.value}
                              onClick={() => {
                                setHeadlinerProfileId(act.id);
                                setStartsAt(slot.value);
                              }}
                              type="button"
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {scheduledEvents.length ? (
                <aside className="ticketing-engine-column ticketing-engine-column-calendar">
                  <div className="badge">Venue calendar</div>
                  <div className="ticketing-engine-calendar-list">
                    {scheduledEvents.map((event) => (
                      <article className="ticketing-engine-calendar-item" key={event.id}>
                        <strong>{event.title}</strong>
                        <span>{event.startsAtLabel}</span>
                        {event.headlinerName ? <span>{event.headlinerName}</span> : null}
                        <span>{event.status}</span>
                        {event.isTicketed ? (
                          <span>
                            {event.ticketPriceCents ? formatCurrencyFromCents(event.ticketPriceCents) : 'Ticketed'}
                            {event.ticketCapacity ? ` | ${event.ticketsSoldCount ?? 0}/${event.ticketCapacity}` : ''}
                          </span>
                        ) : null}
                        <div className="ticketing-engine-slot-row">
                          {event.ticketingOpenedAtLabel ? (
                            <span className="ticketing-slot-pill">{event.ticketingOpenedAtLabel}</span>
                          ) : (
                            <button
                              className="button small secondary"
                              disabled={openingEventId === event.id || !event.isTicketed}
                              onClick={() => handleOpenEvent(event.id)}
                              type="button"
                            >
                              {openingEventId === event.id ? 'Opening...' : 'Open event'}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </aside>
              ) : null}
            </div>
          ) : null}

          <label className="field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the room, lineup, admission policy, and what the ticket includes."
            />
          </label>

          <div className="grid grid-2">
            <label className="field">
              <span>Start time</span>
              <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
            </label>

            <label className="field">
              <span>End time (optional)</span>
              <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
            </label>
          </div>

          {selectedAct?.suggestedSlots?.length ? (
            <div className="ticketing-engine-slot-picker">
              <span>Suggested open dates for {selectedAct.name}</span>
              <div className="ticketing-engine-slot-row">
                {selectedAct.suggestedSlots.map((slot) => (
                  <button className="ticketing-slot-pill" key={slot.value} onClick={() => setStartsAt(slot.value)} type="button">
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-3">
            <label className="field">
              <span>Ticket price (USD)</span>
              <input
                inputMode="decimal"
                min="1"
                step="0.01"
                type="number"
                value={ticketPrice}
                onChange={(event) => setTicketPrice(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Total potential tickets</span>
              <input
                inputMode="numeric"
                min="1"
                step="1"
                type="number"
                value={ticketCapacity}
                onChange={(event) => setTicketCapacity(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Affiliate promoter (optional)</span>
              <select value={promoterProfileId} onChange={(event) => setPromoterProfileId(event.target.value)}>
                <option value="">Unassigned promoter affiliate</option>
                {promoterOptions.map((promoter) => (
                  <option key={promoter.id} value={promoter.id}>
                    {promoter.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-3">
            <label className="field">
              <span>Venue payout share (%)</span>
              <input
                inputMode="numeric"
                max={remainingForVenueAndArtist}
                min="0"
                step="1"
                type="number"
                value={venuePayoutPercent}
                onChange={(event) => setVenuePayoutPercent(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Affiliate promoter share (%)</span>
              <input
                inputMode="numeric"
                max={MAX_PROMOTER_AFFILIATE_PERCENT}
                min="0"
                step="1"
                type="number"
                value={promoterPayoutPercent}
                onChange={(event) => setPromoterPayoutPercent(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Charge fan tokens when event opens</span>
              <input
                type="datetime-local"
                value={ticketingOpensAt}
                onChange={(event) => setTicketingOpensAt(event.target.value)}
              />
            </label>
          </div>

          <div className="ticketing-split-preview">
            <div className="meta">Ticket breakdown</div>
            <div className="signal-grid compact">
              <div className="signal-card">
                <strong>Potential gross</strong>
                <span>{formatCurrencyFromCents(potentialGrossCents)}</span>
              </div>
              <div className="signal-card">
                <strong>Venue / ticket</strong>
                <span>{formatCurrencyFromCents(preview.venuePayoutCents)}</span>
              </div>
              <div className="signal-card">
                <strong>Artist / ticket</strong>
                <span>{formatCurrencyFromCents(preview.artistPayoutCents)}</span>
              </div>
              <div className="signal-card">
                <strong>Affiliate / ticket</strong>
                <span>{formatCurrencyFromCents(preview.promoterPayoutCents)}</span>
              </div>
              <div className="signal-card">
                <strong>Tax / ticket</strong>
                <span>{formatCurrencyFromCents(preview.totalTaxCents)}</span>
              </div>
              <div className="signal-card">
                <strong>Total fan charge</strong>
                <span>{formatCurrencyFromCents(preview.totalChargeCents)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="empty">
              <strong>Legal booking snapshot</strong>
              <pre className="ticketing-legal-preview">{legalBookingPreview}</pre>
            </div>
            <label className="field">
              <span>Booking notes override (optional)</span>
              <textarea
                rows={8}
                value={bookingLegalNotes}
                onChange={(event) => setBookingLegalNotes(event.target.value)}
                placeholder="Add contract, rider, and legal booking notes for this event."
              />
            </label>
          </div>

          <label className="field">
            <span>Tags</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ticketed, chicago, house" />
          </label>

          <div className="empty">
            {selectedAct ? (
              <>
                Scheduling with <strong>{selectedAct.name}</strong>. {selectedAct.availabilitySummary ?? 'Availability is open.'}
              </>
            ) : (
              <>Fans reserve tickets with stored payment tokens.</>
            )}{' '}
            Charges are captured only when this event reaches the official open time, and each issued ticket is emailed as a
            single-use QR code. Resales must be venue-managed and reissued at face value.
            {venueLocation
              ? ` Venue tax region: ${[venueLocation.postalCode, venueLocation.stateRegion ?? venueLocation.country].filter(Boolean).join(' | ')}.`
              : ''}
          </div>

          <div className="cta-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? 'Scheduling...' : 'Create ticketed event'}
            </button>
            {message ? <span className="meta">{message}</span> : null}
          </div>
        </form>
      ) : (
        <div className="empty">
          No artists are available to book yet. Once artists enter the recommendation lane or manual pool, this event creator
          will unlock.
        </div>
      )}
    </div>
  );
}
