'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/components/I18nProvider';
import {
  GUIDE_OPEN_PARAM,
  GUIDE_SEEN_THIS_SESSION_KEY,
  guideHiddenKey,
  guideProgress,
  type Guide,
  type GuideStepId,
} from '@/lib/getting-started';

type T = ReturnType<typeof useI18n>['t'];

/** Every step's words, as literal t() calls so the extractor can see them. */
function stepCopy(t: T, id: GuideStepId): { title: string; body: string } {
  switch (id) {
    case 'artist-about': return {
      title: t('gettingStarted.artistAboutTitle', 'Add a photo and a short bio'),
      body: t('gettingStarted.artistAboutBody', 'Fans and venues see this first. Two sentences about who you are and where you play is plenty.'),
    };
    case 'artist-track': return {
      title: t('gettingStarted.artistTrackTitle', 'Upload a track'),
      body: t('gettingStarted.artistTrackBody', 'MP3, AAC, WAV or FLAC. Release it now or pick a date. Every upload is checked for copyright.'),
    };
    case 'artist-payouts': return {
      title: t('gettingStarted.artistPayoutMethodTitle', 'Add where you get paid'),
      body: t('gettingStarted.artistPayoutMethodBody', 'Venues pay you directly after each show, under the split you sign. Tell them how — bank transfer, check or a payment app. No Stripe needed.'),
    };
    case 'artist-show': return {
      title: t('gettingStarted.artistShowTitle', 'Add a show'),
      body: t('gettingStarted.artistShowBody', 'Pick the venue and the date. If you do not run the room, it goes to the venue as a draft to confirm.'),
    };
    case 'venue-about': return {
      title: t('gettingStarted.venueAboutTitle', 'Add your logo and a short description'),
      body: t('gettingStarted.venueAboutBody', 'What kind of room it is and what nights you run. This is what fans and artists read first.'),
    };
    case 'venue-details': return {
      title: t('gettingStarted.venueDetailsTitle', 'Add your address and capacity'),
      body: t('gettingStarted.venueDetailsBody', 'Your address puts you on the map. Capacity and your ticket tax rate live in the same section.'),
    };
    case 'venue-payouts': return {
      title: t('gettingStarted.venuePayoutsTitle', 'Set up Stripe'),
      body: t('gettingStarted.venuePayoutsBody', 'Required before you can sell a ticket: you are the seller on every sale. Read the money terms first.'),
    };
    case 'venue-event': return {
      title: t('gettingStarted.venueEventTitle', 'Publish your first event'),
      body: t('gettingStarted.venueEventBodyAgreement', 'Date, lineup and ticket price. Send each act a split to sign; tickets go on sale once every act has signed.'),
    };
    case 'venue-demand': return {
      title: t('gettingStarted.venueDemandTitle', 'See who fans want you to book'),
      body: t('gettingStarted.venueDemandBody', 'Fans ask venues for acts. Your booking page ranks them by how many asked and how close they are.'),
    };
    case 'fan-listen': return {
      title: t('gettingStarted.fanListenTitle', 'Find music'),
      body: t('gettingStarted.fanListenBody', 'Listen has discovery, radio, charts and your playlists. Search is at the top.'),
    };
    case 'fan-map': return {
      title: t('gettingStarted.fanMapTitle', 'Find shows near you'),
      body: t('gettingStarted.fanMapBody', 'The map starts where you are. Tap a pin to see a venue or an event.'),
    };
    case 'fan-hype': return {
      title: t('gettingStarted.fanHypeTitle', 'HYPE the artists you back'),
      body: t('gettingStarted.fanHypeBody', 'A HYPE tells venues who their city wants to see. You can also ask a venue to book an act.'),
    };
    case 'fan-tickets': return {
      title: t('gettingStarted.fanTicketsTitle', 'Keep your tickets here'),
      body: t('gettingStarted.fanTicketsBody', 'Tickets show a QR code at the door and still open with no signal.'),
    };
  }
}

function readStorage(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(store: 'local' | 'session', key: string, value: string | null) {
  try {
    const target = store === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the guide simply shows again.
  }
}

/**
 * The quick-start popup (the owner asked for "a how-to use this app basic
 * step-by-step for new users … with a don't show this next time thing,
 * especially for artists/venues who we need to be quick to add their info").
 *
 * Shows once per browser session until "Don't show this again" is ticked, and
 * reopens from ME → Info → "How to use iHYPE" (`?guide=1`). Each creator step
 * links straight into the editor section where that information is entered,
 * and ticks itself off from the database, so the list doubles as a to-do.
 *
 * It fetches only when it is about to open, never in front of a pane.
 */
export function MmmGettingStarted() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const forced = searchParams.get(GUIDE_OPEN_PARAM) === '1';

  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [failed, setFailed] = useState(false);
  const [hideNextTime, setHideNextTime] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) return;
    const hidden = readStorage('local', guideHiddenKey(userId)) === '1';
    if (!forced) {
      if (hidden || readStorage('session', GUIDE_SEEN_THIS_SESSION_KEY) === '1') return;
      // An automated browser is not a new member. Every browser spec and both
      // layout instruments (measure:layout, the tap census) start as a fresh
      // account, and a dialog over the pane would have them all testing and
      // measuring the guide. `?guide=1` still opens it, which is how its own
      // e2e reaches it.
      if (navigator.webdriver) return;
    }
    setHideNextTime(hidden);
    writeStorage('session', GUIDE_SEEN_THIS_SESSION_KEY, '1');

    let cancelled = false;
    setFailed(false);
    fetch('/api/me/getting-started', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { guide?: Guide };
        if (!body.guide) throw new Error('no guide');
        if (!cancelled) { setGuide(body.guide); setOpen(true); }
      })
      .catch(() => {
        // Opened on request: say it failed. Opened automatically: stay quiet,
        // and let the next session try again.
        if (cancelled) return;
        if (forced) { setFailed(true); setOpen(true); }
        else writeStorage('session', GUIDE_SEEN_THIS_SESSION_KEY, null);
      });
    return () => { cancelled = true; };
  }, [userId, forced]);

  const close = useCallback(() => {
    if (userId) writeStorage('local', guideHiddenKey(userId), hideNextTime ? '1' : null);
    setOpen(false);
    if (forced) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete(GUIDE_OPEN_PARAM);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [userId, hideNextTime, forced, searchParams, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    // Focus the dialog itself, not its first control: a ring on the close
    // button is the first thing a new member would see. Tab reaches the steps.
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restore?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const progress = guide ? guideProgress(guide) : null;
  const heading = guide?.role === 'VENUE'
    ? t('gettingStarted.headingVenue', 'Get your venue ready')
    : guide?.role === 'ARTIST'
      ? t('gettingStarted.headingArtist', 'Get your artist page ready')
      : t('gettingStarted.headingFan', 'How iHYPE works');
  const lede = guide?.role === 'VENUE' || guide?.role === 'ARTIST'
    ? t('gettingStarted.ledeCreator', 'A few minutes each. Tap a step to go straight to it. Steps tick off as you finish them.')
    : t('gettingStarted.ledeFan', 'Four things to know. The links at the top of every screen take you to each one.');

  // Portalled to <body>: `.mmm-frame` is its own stacking context, so a dialog
  // rendered inside it sits under the site header whatever its z-index.
  return createPortal(
    <>
      <button
        aria-label={t('gettingStarted.close', 'Close the guide')}
        className="mmm-guide-scrim"
        onClick={close}
        tabIndex={-1}
        type="button"
      />
      <div aria-labelledby="mmm-guide-title" aria-modal="true" className="mmm-guide" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="mmm-guide-head">
          <h2 className="mmm-guide-title" id="mmm-guide-title">{heading}</h2>
          <button aria-label={t('gettingStarted.close', 'Close the guide')} className="mmm-guide-x" onClick={close} type="button">✕</button>
        </div>

        {failed || !guide ? (
          <p className="mmm-guide-lede">{t('gettingStarted.failed', 'The guide could not be loaded. Try again in a moment.')}</p>
        ) : (
          <>
            <p className="mmm-guide-lede">{lede}</p>
            {progress && progress.total > 0 && (
              <p className="mmm-guide-progress">
                {t('gettingStarted.progress', '{done} of {total} done')
                  .replace('{done}', String(progress.done))
                  .replace('{total}', String(progress.total))}
              </p>
            )}
            <ol className="mmm-guide-steps">
              {guide.steps.map((step, index) => {
                const copy = stepCopy(t, step.id);
                return (
                  <li key={step.id}>
                    <Link className="mmm-guide-step" data-done={step.done ? 'true' : undefined} href={step.href} onClick={close}>
                      <span aria-hidden="true" className="mmm-guide-mark">{step.done ? '✓' : index + 1}</span>
                      <span className="mmm-guide-text">
                        <span className="mmm-guide-step-title">
                          {copy.title}
                          {step.done && <span className="mmm-guide-sr">{t('gettingStarted.doneSuffix', ' (done)')}</span>}
                        </span>
                        <span className="mmm-guide-step-body">{copy.body}</span>
                      </span>
                      <span aria-hidden="true" className="mmm-guide-chevron">›</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {guide.wizardHref && (
              <Link className="mmm-btn-primary mmm-guide-wizard" href={guide.wizardHref} onClick={close}>
                {t('gettingStarted.wizard', 'Or do it all in the guided setup')}
              </Link>
            )}
          </>
        )}

        <p className="mmm-guide-reopen">{t('gettingStarted.reopen', 'You can open this again from Me → Info → How to use iHYPE.')}</p>
        <div className="mmm-guide-foot">
          <label className="mmm-guide-hide">
            <input checked={hideNextTime} onChange={(event) => setHideNextTime(event.target.checked)} type="checkbox" />
            <span>{t('gettingStarted.dontShow', "Don't show this again")}</span>
          </label>
          <button className="mmm-btn-ghost" onClick={close} type="button">{t('gettingStarted.gotIt', 'Got it')}</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
