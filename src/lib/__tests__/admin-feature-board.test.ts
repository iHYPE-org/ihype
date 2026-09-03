import { describe, expect, it } from 'vitest';

import {
  FEATURE_CATALOGUE,
  buildFeatureBoard,
  buildFeatureRow,
  headlineFor,
  orderByRisk,
  summarizeBoard,
  type FeatureBoardInput,
  type FeatureDefinition,
  type FeatureRow,
} from '../admin-feature-board';
import { JOURNEYS } from '../feature-health';

const ALL_ON: FeatureBoardInput = {
  flags: {
    registrations_enabled: true,
    uploads_enabled: true,
    radio_enabled: true,
    maps_enabled: true,
    tickets_enabled: true,
    payments_enabled: true,
    advertising_enabled: true,
    outbound_email_enabled: true,
  },
  configured: {
    payments: true,
    stripe: true,
    objectStorage: true,
    email: true,
    acrcloud: true,
    ai: true,
  },
  queues: [
    { id: 'access-requests', count: 0, oldestHours: null, overdue: false },
    { id: 'verifications', count: 0, oldestHours: null, overdue: false },
    { id: 'held-tracks', count: 0, oldestHours: null, overdue: false },
    { id: 'moderation', count: 0, oldestHours: null, overdue: false },
    { id: 'ads', count: 0, oldestHours: null, overdue: false },
    { id: 'support', count: 0, oldestHours: null, overdue: false },
    { id: 'payouts', count: 0, oldestHours: null, overdue: false },
    { id: 'feedback', count: 0, oldestHours: null, overdue: false },
  ],
  activity: {
    accounts: 5,
    pages: 5,
    uploads: 5,
    listens: 5,
    shows: 5,
    tickets_sold: 5,
    ad_impressions: 5,
    hypes_given: 5,
  },
};

const feature = (id: string): FeatureDefinition => {
  const found = FEATURE_CATALOGUE.find((f) => f.id === id);
  if (!found) throw new Error(`no such feature: ${id}`);
  return found;
};

const rowFor = (id: string, input: FeatureBoardInput) => buildFeatureRow(feature(id), input);
const withInput = (patch: Partial<FeatureBoardInput>): FeatureBoardInput => ({ ...ALL_ON, ...patch });

describe('the catalogue itself', () => {
  it('has unique ids', () => {
    const ids = FEATURE_CATALOGUE.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * A capability naming a journey that no longer exists claims the nightly
   * proves it when nothing does — the same class of silent false coverage the
   * feature-health mapping guards against in both directions.
   */
  it('every journey it names is a real journey', () => {
    const known = new Set(JOURNEYS.map((j) => j.id));
    const unknown = FEATURE_CATALOGUE.map((f) => f.journey)
      .filter((id): id is string => Boolean(id))
      .filter((id) => !known.has(id));
    expect(unknown).toEqual([]);
  });

  it('every row can be dug into', () => {
    for (const f of FEATURE_CATALOGUE) {
      expect(f.href.startsWith('/admin'), `${f.id} has no admin destination`).toBe(true);
      expect(f.member.length, `${f.id} does not say what a member does`).toBeGreaterThan(10);
    }
  });
});

describe('BLOCKED — offered and cannot work', () => {
  /*
   * The state this board exists for. On 2026-09-03 every ticketed event in the
   * product was unbuyable and every other admin surface read healthy, because
   * nothing was queued and traffic was normal.
   */
  it('a flag on with its dependency missing is BLOCKED', () => {
    const row = rowFor('ticketing', withInput({ configured: { ...ALL_ON.configured, payments: false } }));
    expect(row.state).toBe('BLOCKED');
    expect(row.missing).toEqual(['payments']);
    expect(row.reason).toContain('offered to members');
  });

  /*
   * The inverse, and it is just as load-bearing: a permanently red row for
   * something nobody is being offered is noise, and noise at the top of a
   * board is how a board stops being read.
   */
  it('the same dependency missing behind an OFF flag is OFF, not BLOCKED', () => {
    const row = rowFor('ticketing', withInput({
      flags: { ...ALL_ON.flags, tickets_enabled: false },
      configured: { ...ALL_ON.configured, payments: false },
    }));
    expect(row.state).toBe('OFF');
    expect(row.reason).toContain('tickets_enabled');
  });

  it('names every missing dependency, not just the first', () => {
    const uploads = rowFor('uploads', withInput({ configured: { ...ALL_ON.configured, objectStorage: false } }));
    expect(uploads.state).toBe('BLOCKED');
    expect(uploads.reason).toContain('media storage');
  });
});

describe('the other states', () => {
  it('queued work is ATTENTION, and overdue says so', () => {
    const row = rowFor('moderation', withInput({
      queues: ALL_ON.queues.map((q) =>
        q.id === 'moderation' ? { ...q, count: 3, oldestHours: 80, overdue: true } : q),
    }));
    expect(row.state).toBe('ATTENTION');
    expect(row.issues).toBe(3);
    expect(row.reason).toContain('past the stated turnaround');
  });

  it('on, configured, clear and unused is IDLE', () => {
    const row = rowFor('playback', withInput({ activity: { ...ALL_ON.activity, listens: 0 } }));
    expect(row.state).toBe('IDLE');
  });

  it('on, configured, clear and used is OK', () => {
    expect(rowFor('playback', ALL_ON).state).toBe('OK');
  });
});

describe('null is not zero', () => {
  it('an unreadable flag is UNKNOWN, never OK', () => {
    const row = rowFor('uploads', withInput({ flags: { ...ALL_ON.flags, uploads_enabled: null } }));
    expect(row.state).toBe('UNKNOWN');
  });

  it('an unreadable dependency is UNKNOWN, never BLOCKED and never OK', () => {
    const row = rowFor('ticketing', withInput({ configured: { ...ALL_ON.configured, payments: null } }));
    expect(row.state).toBe('UNKNOWN');
  });

  /* A queue the workbench could not build is absent from its output. Treating
     an absent queue as an empty one would report "nothing waiting" for a read
     that failed — the exact claim the null rule forbids. */
  it('a named queue the reader could not produce is UNKNOWN, not clear', () => {
    const row = rowFor('moderation', withInput({ queues: ALL_ON.queues.filter((q) => q.id !== 'moderation') }));
    expect(row.state).toBe('UNKNOWN');
    expect(row.issues).toBeNull();
  });

  it('an unreadable activity figure is UNKNOWN, not IDLE', () => {
    const row = rowFor('playback', withInput({ activity: { ...ALL_ON.activity, listens: null } }));
    expect(row.state).toBe('UNKNOWN');
  });

  it('a capability with no metric is never IDLE for lack of one', () => {
    expect(feature('payouts').metric).toBeUndefined();
    expect(rowFor('payouts', ALL_ON).state).toBe('OK');
  });
});

describe('orderByRisk', () => {
  const row = (id: string, state: FeatureRow['state'], oldestHours: number | null = null, overdue = false) =>
    ({ ...buildFeatureRow(feature(id), ALL_ON), state, oldestHours, overdue }) as FeatureRow;

  it('puts blocked above everything, and OK last', () => {
    const ordered = orderByRisk([
      row('playback', 'OK'),
      row('community', 'IDLE'),
      row('uploads', 'OFF'),
      row('moderation', 'ATTENTION'),
      row('ticketing', 'BLOCKED'),
      row('support', 'UNKNOWN'),
    ]);
    expect(ordered.map((r) => r.state)).toEqual(['BLOCKED', 'ATTENTION', 'UNKNOWN', 'OFF', 'IDLE', 'OK']);
  });

  it('within a band, longest waiting first — age beats count', () => {
    const ordered = orderByRisk([
      row('moderation', 'ATTENTION', 2),
      row('support', 'ATTENTION', 200),
    ]);
    expect(ordered[0].feature.id).toBe('support');
  });

  it('overdue outranks merely old', () => {
    const ordered = orderByRisk([
      row('moderation', 'ATTENTION', 500, false),
      row('support', 'ATTENTION', 10, true),
    ]);
    expect(ordered[0].feature.id).toBe('support');
  });
});

describe('the headline', () => {
  it('leads with the blocked feature by name when there is one', () => {
    const rows = buildFeatureBoard(withInput({ configured: { ...ALL_ON.configured, payments: false } }));
    /* payments gates ticketing AND advertising, so this is the plural branch. */
    expect(headlineFor(rows)).toContain('cannot work');
  });

  it('names the single blocked feature rather than counting to one', () => {
    const rows = buildFeatureBoard(withInput({ configured: { ...ALL_ON.configured, objectStorage: false } }));
    expect(headlineFor(rows)).toBe('Music uploads is offered to members and cannot work');
  });

  it('falls through to work waiting, then to all clear', () => {
    const busy = buildFeatureBoard(withInput({
      queues: ALL_ON.queues.map((q) => (q.id === 'ads' ? { ...q, count: 2, oldestHours: 5 } : q)),
    }));
    expect(headlineFor(busy)).toBe('1 features have work waiting');

    expect(headlineFor(buildFeatureBoard(ALL_ON))).toBe('Every feature is on, configured and clear');
  });

  it('an all-clear board really is all clear', () => {
    const summary = summarizeBoard(buildFeatureBoard(ALL_ON));
    expect(summary.BLOCKED).toBe(0);
    expect(summary.UNKNOWN).toBe(0);
    expect(summary.OK + summary.IDLE).toBe(FEATURE_CATALOGUE.length);
  });
});
