'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/components/I18nProvider';

type Attendee = { name: string | null; avatar: string | null };

export function ShowEngagement({
  showId,
  canRsvp,
  initialCount,
  initialGoing,
  canRemind,
  initialReminded,
  showEnded
}: {
  showId: string;
  canRsvp: boolean;
  initialCount: number;
  initialGoing: boolean;
  canRemind: boolean;
  initialReminded: boolean;
  showEnded: boolean;
}) {
  const { t } = useI18n();
  const [count, setCount] = useState(initialCount);
  const [going, setGoing] = useState(initialGoing);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const [reminded, setReminded] = useState(initialReminded);
  const [remindLoading, setRemindLoading] = useState(false);

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [attendeeLoading, setAttendeeLoading] = useState(false);

  useEffect(() => {
    // Sync RSVP state
    fetch(`/api/shows/${showId}/rsvp`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        if (typeof j.count === 'number') setCount(j.count);
        if (typeof j.going === 'boolean') setGoing(j.going);
      })
      .catch(() => {});

    // Load who's going
    fetch(`/api/shows/${showId}/attendees`)
      .then((r) => r.json())
      .then((data) => {
        setAttendees(data.attendees ?? []);
        setAttendeeCount(data.count ?? 0);
      })
      .catch(() => {});
  }, [showId]);

  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [remindError, setRemindError] = useState<string | null>(null);
  const [attendeeError, setAttendeeError] = useState<string | null>(null);

  async function toggleRsvp() {
    if (!canRsvp || rsvpBusy) return;
    setRsvpBusy(true);
    setRsvpError(null);
    const prevGoing = going;
    const prevCount = count;
    // Optimistic update
    setGoing(!prevGoing);
    setCount(prevGoing ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      const res = await fetch(`/api/shows/${showId}/rsvp`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { going?: boolean; count?: number; error?: string };
      if (res.ok) {
        if (typeof json.count === 'number') setCount(json.count);
        if (typeof json.going === 'boolean') setGoing(json.going);
      } else {
        setGoing(prevGoing);
        setCount(prevCount);
        setRsvpError(json.error ?? t('showEngagement.rsvpErrorGeneric', 'Could not update RSVP'));
      }
    } catch {
      setGoing(prevGoing);
      setCount(prevCount);
      setRsvpError(t('showEngagement.rsvpErrorNetwork', 'Could not update RSVP (network error)'));
    } finally {
      setRsvpBusy(false);
    }
  }

  async function toggleRemind() {
    if (!canRemind || showEnded) return;
    setRemindLoading(true);
    setRemindError(null);
    const prevReminded = reminded;
    // Optimistic update
    setReminded(!prevReminded);
    try {
      const res = await fetch(`/api/shows/${showId}/remind`, { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { reminded?: boolean };
        setReminded(Boolean(data.reminded));
      } else {
        setReminded(prevReminded);
        setRemindError(t('showEngagement.remindErrorGeneric', 'Could not update reminder'));
      }
    } catch {
      setReminded(prevReminded);
      setRemindError(t('showEngagement.remindErrorNetwork', 'Could not update reminder (network error)'));
    } finally {
      setRemindLoading(false);
    }
  }

  async function toggleAttendee() {
    setAttendeeLoading(true);
    setAttendeeError(null);
    const prevOptedIn = optedIn;
    const prevAttendees = attendees;
    const prevAttendeeCount = attendeeCount;
    // Optimistic update
    const nextOptedIn = !prevOptedIn;
    setOptedIn(nextOptedIn);
    setAttendeeCount(nextOptedIn ? prevAttendeeCount + 1 : Math.max(0, prevAttendeeCount - 1));
    try {
      const res = await fetch(`/api/shows/${showId}/attendees`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOptedIn(data.optedIn);
        // Refresh the attendee list in the background
        fetch(`/api/shows/${showId}/attendees`)
          .then((r) => r.json())
          .then((refreshData) => {
            setAttendees(refreshData.attendees ?? []);
            setAttendeeCount(refreshData.count ?? 0);
          })
          .catch(() => {});
      } else {
        setOptedIn(prevOptedIn);
        setAttendees(prevAttendees);
        setAttendeeCount(prevAttendeeCount);
        setAttendeeError(t('showEngagement.attendanceErrorGeneric', 'Could not update attendance'));
      }
    } catch {
      setOptedIn(prevOptedIn);
      setAttendees(prevAttendees);
      setAttendeeCount(prevAttendeeCount);
      setAttendeeError(t('showEngagement.attendanceErrorNetwork', 'Could not update attendance (network error)'));
    } finally {
      setAttendeeLoading(false);
    }
  }

  const visible = attendees.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* RSVP + Remind row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={toggleRsvp}
          disabled={!canRsvp || rsvpBusy}
          className={`button small ${going ? '' : 'secondary'}`}
          aria-pressed={going}
          aria-label={going ? t('showEngagement.cancelRsvpAria', 'Cancel RSVP') : t('showEngagement.rsvpAria', 'RSVP to this show')}
          title={canRsvp ? t('showEngagement.toggleRsvpTitle', 'Toggle RSVP') : t('showEngagement.signInToRsvpTitle', 'Sign in to RSVP')}
        >
          {going ? t('showEngagement.goingConfirmed', '✓ Going') : t('showEngagement.goingPrompt', 'Going?')} ({count})
        </button>

        {canRemind && !showEnded && (
          <button
            className={`button small ${reminded ? '' : 'secondary'}`}
            onClick={toggleRemind}
            disabled={remindLoading}
            type="button"
            aria-pressed={reminded}
            aria-label={reminded ? t('showEngagement.removeReminderAria', 'Remove reminder for this show') : t('showEngagement.setReminderAria', 'Set reminder for this show')}
          >
            {reminded ? t('showEngagement.reminderSet', 'Reminder set ✓') : t('showEngagement.remindMe', 'Remind me')}
          </button>
        )}
      </div>
      {rsvpError ? <span className="meta">{rsvpError}</span> : null}
      {remindError ? <span className="meta">{remindError}</span> : null}

      {/* Who's going */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          {visible.map((a, i) => (
            <div
              key={i}
              title={a.name ?? t('showEngagement.fanFallbackName', 'Fan')}
              style={{
                width: 32, height: 32, borderRadius: '50%', position: 'relative',
                background: 'var(--accent, var(--accent-2))', border: '2px solid var(--bg, #0a0a14)',
                marginLeft: i > 0 ? -10 : 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink-on-accent)', flexShrink: 0,
              }}
            >
              {a.avatar ? (
                <Image alt={a.name ?? t('showEngagement.fanFallbackName', 'Fan')} src={a.avatar} fill sizes="32px" style={{ objectFit: 'cover' }} />
              ) : (
                (a.name?.[0] ?? '?').toUpperCase()
              )}
            </div>
          ))}
        </div>
        {attendeeCount > 0 && (
          <span className="meta">
            {attendeeCount} {attendeeCount !== 1 ? t('showEngagement.fansGoingPlural', 'fans going') : t('showEngagement.fansGoingSingular', 'fan going')}{attendeeCount > 8 ? ` (+${attendeeCount - 8} ${t('showEngagement.more', 'more')})` : ''}
          </span>
        )}
        <button
          className={`button small ${optedIn ? '' : 'secondary'}`}
          disabled={attendeeLoading}
          onClick={toggleAttendee}
          type="button"
          aria-pressed={optedIn ?? false}
          aria-label={optedIn ? t('showEngagement.removeAttendeeAria', 'Remove yourself from attendee list') : t('showEngagement.addAttendeeAria', 'Add yourself to attendee list')}
          style={{ marginLeft: 4 }}
        >
          {optedIn === true ? t('showEngagement.imGoingConfirmed', "I'm going ✓") : optedIn === false ? t('showEngagement.notGoing', 'Not going') : t('showEngagement.imGoing', "I'm going!")}
        </button>
      </div>
      {attendeeError ? <span className="meta">{attendeeError}</span> : null}
    </div>
  );
}
