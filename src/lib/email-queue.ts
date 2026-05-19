// Enqueues email jobs to Cloudflare Queues for async delivery with retries.
// Falls back to immediate send if queue binding unavailable.

type CFQueue = { send(body: unknown): Promise<void> };

async function getEmailQueue(): Promise<CFQueue | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const queue = (getCloudflareContext().env as Record<string, unknown>).EMAIL_QUEUE as CFQueue | null;
    return queue ?? null;
  } catch {
    return null;
  }
}

export async function enqueueEmail(
  type: 'login-otp' | 'password-reset' | 'ticket',
  payload: Record<string, unknown>
): Promise<boolean> {
  const queue = await getEmailQueue();
  if (!queue) {
    return false;
  }

  try {
    await queue.send({ type, payload, enqueuedAt: Date.now() });
    return true;
  } catch (err) {
    console.error('[email-queue] Failed to enqueue email', { type, err });
    return false;
  }
}
