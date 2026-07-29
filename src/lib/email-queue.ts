// Enqueues email jobs to Cloudflare Queues for async delivery with retries.
// Falls back to immediate send if queue binding unavailable.

import { log } from '@/lib/logger';

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
  type: 'ticket',
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
    log.error('[email-queue]', err instanceof Error ? err : { error: String(err), type }, 'failed to enqueue email');
    return false;
  }
}
