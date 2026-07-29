import { describe, expect, it } from 'vitest';
import { decideDigest, renderDigestHtml, renderDigestText } from '@/lib/workbench-digest';
import type { WorkbenchQueue } from '@/lib/admin-workbench';

function q(over: Partial<WorkbenchQueue> & { id: string }): WorkbenchQueue {
  return {
    label: over.id,
    detail: '',
    href: '/admin',
    count: 0,
    oldestHours: null,
    slaHours: null,
    overdue: false,
    ...over,
  };
}

const late = q({ id: 'verifications', label: 'Identity verifications', count: 2, oldestHours: 90, slaHours: 48, overdue: true });
const busy = q({ id: 'moderation', label: 'Moderation reports', count: 5, oldestHours: 3, slaHours: 72 });
const clear = q({ id: 'ads', label: 'Ad campaigns' });

describe('decideDigest', () => {
  it('sends nothing when every queue is inside its window', () => {
    // The rule this exists to protect: a mail that arrives every morning
    // saying "all on time" gets archived unread, and then so does the one
    // that matters.
    expect(decideDigest([busy, clear])).toEqual({ send: false, reason: 'nothing-overdue' });
  });

  it('stays quiet on an entirely empty platform', () => {
    expect(decideDigest([clear]).send).toBe(false);
  });

  it('sends as soon as one queue is overdue', () => {
    const d = decideDigest([busy, late, clear]);
    expect(d.send).toBe(true);
  });

  it('separates overdue from merely waiting, and drops empty queues', () => {
    const d = decideDigest([clear, busy, late]);
    if (!d.send) throw new Error('expected a send');
    expect(d.overdue.map((x) => x.id)).toEqual(['verifications']);
    expect(d.alsoWaiting.map((x) => x.id)).toEqual(['moderation']);
  });
});

describe('digest rendering', () => {
  it('names the queue, the count and the age in the text body', () => {
    const d = decideDigest([late]);
    if (!d.send) throw new Error('expected a send');
    const text = renderDigestText(d, 'https://ihype.org');
    expect(text).toContain('Identity verifications: 2 waiting, oldest 3d (promised 2d)');
    expect(text).toContain('https://ihype.org/admin');
  });

  it('omits the "also waiting" block when there is nothing else', () => {
    const d = decideDigest([late]);
    if (!d.send) throw new Error('expected a send');
    expect(renderDigestText(d, 'https://ihype.org')).not.toContain('Also waiting');
    expect(renderDigestHtml(d, 'https://ihype.org')).not.toContain('Also waiting');
  });

  it('links each queue at its absolute URL so the mail works outside the app', () => {
    const d = decideDigest([q({ id: 'x', label: 'X', href: '/admin/moderation', count: 1, oldestHours: 100, slaHours: 48, overdue: true })]);
    if (!d.send) throw new Error('expected a send');
    expect(renderDigestHtml(d, 'https://ihype.org')).toContain('href="https://ihype.org/admin/moderation"');
  });

  it('escapes a label rather than letting it become markup', () => {
    const d = decideDigest([q({ id: 'x', label: '<img src=x onerror=alert(1)>', count: 1, oldestHours: 100, slaHours: 48, overdue: true })]);
    if (!d.send) throw new Error('expected a send');
    const html = renderDigestHtml(d, 'https://ihype.org');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });
});
