import { useEffect, useRef } from 'react';

/**
 * Reports to the server that an onboarding wizard reached its finish state,
 * so the "Finish setup" prompt stops appearing for that profile.
 *
 * Shared by all three wizards rather than repeated in each, because the
 * subtleties below are easy to get wrong once and impossible to notice:
 *
 *  - `keepalive` matters here more than usual. Every done screen puts a link
 *    ("Go to my page →", "Build your crate →") directly under the user's
 *    thumb, so the navigation that cancels an in-flight fetch is the most
 *    likely next action. keepalive lets the request outlive the page.
 *
 *  - It fires once per mount. A failure resets the guard so a later state
 *    change can retry, but nothing here retries on a timer: if the call is
 *    lost, the prompt simply reappears and the next run through the wizard
 *    reports again. That is the right failure direction — being asked to
 *    finish something already finished is a much smaller harm than a wizard
 *    that can never be marked done.
 *
 *  - The failure is logged, not swallowed. A silent `.catch(() => {})` here
 *    would make "the prompt won't go away" undiagnosable from the outside.
 */
export function useMarkOnboarded(profileId: string, finished: boolean) {
  const sent = useRef(false);

  useEffect(() => {
    if (!finished || sent.current || !profileId) return;
    sent.current = true;

    fetch('/api/profile/onboarding-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
      keepalive: true,
    })
      .then((res) => {
        if (res.ok) return;
        sent.current = false;
        console.warn('[onboarding] could not record completion', res.status);
      })
      .catch((error: unknown) => {
        sent.current = false;
        console.warn('[onboarding] could not record completion', error);
      });
  }, [finished, profileId]);
}
