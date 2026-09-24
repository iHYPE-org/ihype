/**
 * The native push token THIS device registered, so sign-out can take it back
 * (2026-09-24, DESIGN_SYNC row 513).
 *
 * A token is the physical phone. It used to stay bound to the first account
 * that registered it: signing out left that account's pushes arriving on the
 * phone, and the next account to sign in was refused 409 and got none. The
 * register route now re-homes a token to whoever is signed in on the device,
 * and sign-out removes it here — best-effort and time-boxed, because signing
 * out of a shared device must never wait on a network call.
 */
const KEY = 'ihype-native-push-token';

export function rememberNativePushToken(token: string): void {
  try { window.localStorage.setItem(KEY, token); } catch { /* storage blocked: sign-out cannot unbind, the next account re-homes it */ }
}

export async function unregisterNativePushDevice(): Promise<void> {
  let token: string | null = null;
  try { token = window.localStorage.getItem(KEY); } catch { return; }
  if (!token) return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  await Promise.race([
    fetch('/api/push/register-device', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}
