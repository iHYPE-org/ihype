'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthCardShell } from '@/components/AuthShared';
import { useI18n } from '@/components/I18nProvider';

/**
 * The second half of a magic-link sign-in.
 *
 * `GET /api/auth/magic` no longer spends the token — a mail-security scanner
 * following the link would spend it before the member ever saw the message,
 * and on a product with no password that locks them out for good. GET forwards
 * here instead, and this posts the token back, which is the request that
 * actually signs in. See the route's header for the full reasoning.
 *
 * It is a REAL form, submitted from an effect rather than by a script tag:
 *
 *  - a scanner does not run our JavaScript, so it never submits;
 *  - a member with JavaScript sees the same one-beat "signing you in" they
 *    always did — the form goes the moment the component mounts;
 *  - a member WITHOUT JavaScript still has a button, so the only auth path
 *    that does not need a password also does not need a script to work.
 *
 * The submit is fired once. React's development strict mode mounts twice, and
 * two submissions of a single-use token would race: the first spends it and
 * the second lands on "expired".
 */
export function MagicLinkConfirm({ token, callbackUrl }: { token: string; callbackUrl?: string }) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  /* Starts false so the SERVER-rendered button reads as an action. Someone
     with JavaScript off never runs the effect below, and "Signing you in…"
     over a button that will not press itself is a dead end. */
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    setAutoSubmitting(true);
    formRef.current?.requestSubmit();
  }, []);

  return (
    <AuthCardShell
      mode="signin"
      eyebrow={t('auth.confirm.eyebrow', 'Sign in')}
      title={t('auth.confirm.title', 'Almost there')}
      subtitle={t('auth.confirm.subtitle', 'One last step to finish signing in.')}
    >
      <form ref={formRef} method="POST" action="/api/auth/magic" onSubmit={() => setAutoSubmitting(true)}>
        <input type="hidden" name="token" value={token} />
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        <button type="submit" className="authcard-btn-primary" style={{ width: '100%' }}>
          {autoSubmitting
            ? t('auth.confirm.working', 'Signing you in…')
            : t('auth.confirm.action', 'Continue')}
        </button>
      </form>
    </AuthCardShell>
  );
}
