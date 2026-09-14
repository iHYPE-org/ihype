import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { showReminderLink, showReminderLinkKeys } from '@/lib/show-reminder';

describe('show reminder links', () => {
  it('points at the slug, because /shows/[slug] resolves nothing else', () => {
    expect(showReminderLink('null-harbor-at-the-armory')).toBe('/shows/null-harbor-at-the-armory');
  });

  it('looks a reminder up by the slug first and the legacy cuid second', () => {
    expect(showReminderLinkKeys('null-harbor', 'cku8s9x2v0000abcdefghijkl')).toEqual([
      '/shows/null-harbor',
      '/shows/cku8s9x2v0000abcdefghijkl',
    ]);
  });

  /* The defect was that the write and both reads agreed with each other and
     not with the router, so each of the three has to name this module rather
     than build the path again. A template literal here is how it comes back. */
  const sources = [
    'src/app/api/shows/[showId]/remind/route.ts',
    'src/app/shows/[slug]/page.tsx',
  ];

  it.each(sources)('%s builds no show-reminder link of its own', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toContain('showReminderLink');
    // eslint-disable-next-line no-template-curly-in-string
    expect(source).not.toContain('`/shows/${id}`');
    // eslint-disable-next-line no-template-curly-in-string
    expect(source).not.toContain('`/shows/${show.id}`');
  });

  it('the route asks for the slug it now stores', () => {
    const route = readFileSync('src/app/api/shows/[showId]/remind/route.ts', 'utf8');
    expect(route).toMatch(/select: \{[^}]*slug: true/);
  });
});
