export const WORKBENCH_PATH = '/home';
// Generic (no-specific-destination) sign-ins land on Welcome first, which then
// routes on to WORKBENCH_PATH — matches the Auth → Welcome → Home flow used
// for sign-up. A real deep-link callbackUrl (e.g. a show or ticket page the
// user was trying to reach) is preserved as-is and skips Welcome.
export const WELCOME_PATH = '/welcome';

export function isSafeLocalRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  if (path.includes('\n') || path.includes('\r')) return false;
  return true;
}

export function resolvePostAuthRedirect(path: string | null | undefined): string {
  if (!isSafeLocalRedirect(path)) return WELCOME_PATH;
  if (path === '/login' || path.startsWith('/login?')) return WELCOME_PATH;
  if (path.startsWith('/auth/')) return WELCOME_PATH;
  if (path === '/workbench' || path.startsWith('/workbench?')) return WELCOME_PATH;
  if (path === '/dashboard' || path.startsWith('/dashboard?')) return WELCOME_PATH;
  return path;
}
