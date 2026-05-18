// Lightweight error monitoring — replace with Sentry SDK when SENTRY_DSN is configured
export function captureException(error: unknown, context?: Record<string, unknown>) {
  const msg = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV === 'development') {
    console.error('[monitoring]', msg, context);
    return;
  }
  // Forward to Sentry when configured
  if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
    // Server-side: fire-and-forget to Sentry ingest
    fetch(`${process.env.SENTRY_DSN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, level: 'error', extra: context }),
    }).catch(() => {});
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[monitoring:${level}]`, message);
  }
}
