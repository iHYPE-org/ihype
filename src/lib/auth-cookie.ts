export const AUTH_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
export const AUTH_TRANSIENT_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export function useSecureAuthCookies() {
  return process.env.NODE_ENV === 'production';
}

export function getAuthSessionCookieName() {
  return useSecureAuthCookies()
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

export function getAuthSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: useSecureAuthCookies(),
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  };
}
