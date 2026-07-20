// Server-side Sentry init is NOT done here — @sentry/nextjs's Node-oriented
// instrumentation crashes the Cloudflare Worker via an unresolved upstream
// AsyncLocalStorage cross-request bug (getsentry/sentry-javascript#18842).
// worker.js wraps the actual Workers fetch handler with @sentry/cloudflare's
// withSentry() instead, which uses Cloudflare's own request-context
// primitives rather than assuming Node server request-scoping semantics.
export async function register() {}
