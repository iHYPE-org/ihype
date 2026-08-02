import { afterEach, describe, expect, it } from 'vitest';
import { kvDel, kvPut } from '@/lib/kv';
import { areMapsEnabledRuntime, arePaymentsEnabledRuntime, isRadioEnabledRuntime, isTicketingEnabledRuntime } from '@/lib/runtime-flags';

const original = {
  FEATURE_ENABLE_MAPS: process.env.FEATURE_ENABLE_MAPS,
  FEATURE_ENABLE_PAYMENTS: process.env.FEATURE_ENABLE_PAYMENTS,
  FEATURE_ENABLE_RADIO: process.env.FEATURE_ENABLE_RADIO,
  FEATURE_ENABLE_TICKETING: process.env.FEATURE_ENABLE_TICKETING,
  FEATURE_ENABLE_TICKET_PAYMENTS: process.env.FEATURE_ENABLE_TICKET_PAYMENTS,
};

afterEach(async () => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await Promise.all(['maps_enabled', 'payments_enabled', 'radio_enabled', 'tickets_enabled'].map((key) => kvDel(`flags:${key}`)));
});

describe('alpha runtime kill switches', () => {
  it('keeps the emergency payment brake independent from payment readiness', async () => {
    delete process.env.FEATURE_ENABLE_PAYMENTS;
    process.env.FEATURE_ENABLE_TICKET_PAYMENTS = 'false';

    expect(await arePaymentsEnabledRuntime()).toBe(true);
  });

  it('uses safe environment fallbacks', async () => {
    process.env.FEATURE_ENABLE_PAYMENTS = 'false';
    process.env.FEATURE_ENABLE_TICKETING = 'true';
    process.env.FEATURE_ENABLE_RADIO = 'true';
    process.env.FEATURE_ENABLE_MAPS = 'true';
    expect(await arePaymentsEnabledRuntime()).toBe(false);
    expect(await isTicketingEnabledRuntime()).toBe(true);
    expect(await isRadioEnabledRuntime()).toBe(true);
    expect(await areMapsEnabledRuntime()).toBe(true);
  });

  it('lets an audited KV override take effect without a deploy', async () => {
    process.env.FEATURE_ENABLE_RADIO = 'true';
    await kvPut('flags:radio_enabled', '0');
    expect(await isRadioEnabledRuntime()).toBe(false);
    await kvPut('flags:radio_enabled', '1');
    expect(await isRadioEnabledRuntime()).toBe(true);
  });
});
