import {
  buildFeatureBoard,
  type FeatureBoardInput,
  type FeatureDependency,
  type FeatureRow,
} from '@/lib/admin-feature-board';
import { getWorkbenchQueues } from '@/lib/admin-workbench';
import { getAnalytics } from '@/lib/analytics-metrics';
import type { AnalyticsRange } from '@/lib/analytics-engine';
import { isAcrCloudConfigured } from '@/lib/acrcloud';
import { isEmailDeliveryConfigured } from '@/lib/mailer';
import { isObjectStorageConfigured } from '@/lib/object-storage';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { isStripeConfigured } from '@/lib/stripe';
import { readRuntimeBinding } from '@/lib/runtime-env';
import {
  areMapsEnabledRuntime,
  arePaymentsEnabledRuntime,
  areRegistrationsEnabledRuntime,
  areUploadsEnabledRuntime,
  isAdvertisingEnabledRuntime,
  isOutboundEmailEnabledRuntime,
  isRadioEnabledRuntime,
  isTicketingEnabledRuntime,
} from '@/lib/runtime-flags';

/**
 * The reads behind the feature board.
 *
 * Split from `admin-feature-board.ts` for the same reason `analytics-metrics`
 * is split from `analytics-engine`: the catalogue and the roll-up must stay
 * loadable by the unit suite and by a client component, and a `@/lib/db`
 * import anywhere in that graph ends both.
 *
 * Every read here is independently caught and degrades to `null`, which the
 * board turns into UNKNOWN and the UI into an em dash. One unreachable table
 * costs one row its certainty, never the board.
 */

/** Resolves a flag to true/false, or to `null` when the read itself failed. */
async function flag(read: () => Promise<boolean>): Promise<boolean | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** Same for a synchronous predicate that can throw on a missing binding. */
function configured(read: () => boolean): boolean | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export type FeatureBoard = {
  rows: FeatureRow[];
  /** The window the activity figures were measured over. */
  range: AnalyticsRange;
};

export async function getFeatureBoard(range: AnalyticsRange = '7d'): Promise<FeatureBoard> {
  const [
    registrations,
    uploads,
    radio,
    maps,
    tickets,
    payments,
    advertising,
    email,
    queues,
    analytics,
  ] = await Promise.all([
    flag(areRegistrationsEnabledRuntime),
    flag(areUploadsEnabledRuntime),
    flag(isRadioEnabledRuntime),
    flag(areMapsEnabledRuntime),
    flag(isTicketingEnabledRuntime),
    flag(arePaymentsEnabledRuntime),
    flag(isAdvertisingEnabledRuntime),
    flag(isOutboundEmailEnabledRuntime),
    /* The workbench owns "waiting on a human" and already catches per queue.
       A total failure yields no queues, which every capability naming one
       reports as UNKNOWN rather than as clear. */
    getWorkbenchQueues().catch(() => []),
    getAnalytics('platform', { kind: 'platform' }, range).catch(() => null),
  ]);

  const activity: Record<string, number | null> = {};
  for (const metric of analytics?.metrics ?? []) activity[metric.id] = metric.value;

  const deps: Partial<Record<FeatureDependency, boolean | null>> = {
    payments: configured(isPaymentProcessingConfigured),
    stripe: configured(isStripeConfigured),
    objectStorage: configured(isObjectStorageConfigured),
    email: configured(isEmailDeliveryConfigured),
    acrcloud: configured(isAcrCloudConfigured),
    /* There is no `isAiConfigured()`: the binding is only observable by
       reaching for it, and every AI call site already degrades on its absence.
       Presence of the binding is the honest question to ask here. */
    ai: configured(() => Boolean(readRuntimeBinding('AI'))),
  };

  const input: FeatureBoardInput = {
    flags: {
      registrations_enabled: registrations,
      uploads_enabled: uploads,
      radio_enabled: radio,
      maps_enabled: maps,
      tickets_enabled: tickets,
      payments_enabled: payments,
      advertising_enabled: advertising,
      outbound_email_enabled: email,
    },
    configured: deps,
    queues: queues.map((q) => ({
      id: q.id,
      count: q.count,
      oldestHours: q.oldestHours,
      overdue: q.overdue,
    })),
    activity,
  };

  return { rows: buildFeatureBoard(input), range };
}
