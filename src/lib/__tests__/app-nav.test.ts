import { describe, expect, it } from 'vitest';
import {
  badgeToneVar, buildShellNav, findShellRoute, hrefTab, isShellRoute,
  passesGate, resolveActiveItemId, resolveSection, sectionRows, sectionTabs,
  type ShellAccount,
} from '@/lib/app-nav';

const FAN: ShellAccount = {
  name: 'Jayla Reign',
  isAdvertiser: false,
  canPromote: false,
};

const EVERYTHING: ShellAccount = {
  name: 'Jayla Reign',
  artistProfileId: 'artist-1',
  djProfileSlug: 'dj-ora',
  venueProfileId: 'venue-1',
  isAdvertiser: true,
  canPromote: true,
  upcomingTicketCount: 2,
};

describe('role gating', () => {
  it('gives a plain fan no creator entries', () => {
    const ids = buildShellNav(FAN).map((item) => item.id);
    expect(ids).not.toContain('showcreator');
    expect(ids).not.toContain('tourcreator');
    expect(ids).not.toContain('eventcreator');
    expect(ids).not.toContain('adcreator');
    expect(ids).not.toContain('promote');
    // …but every ungated destination is still there.
    expect(ids).toEqual(expect.arrayContaining(['discover', 'radio', 'charts', 'playlists', 'nearme', 'dashboard', 'account', 'a11y']));
  });

  it('gives a member holding every type all four creators', () => {
    const ids = buildShellNav(EVERYTHING).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(['showcreator', 'tourcreator', 'eventcreator', 'adcreator', 'promote']));
  });

  it('gates each creator on its own account type only', () => {
    const artistOnly: ShellAccount = { ...FAN, artistProfileId: 'a1' };
    const ids = buildShellNav(artistOnly).map((item) => item.id);
    expect(ids).toContain('tourcreator');
    expect(ids).not.toContain('showcreator');
    expect(ids).not.toContain('eventcreator');
  });

  it('passesGate is explicit about each gate', () => {
    expect(passesGate(undefined, FAN)).toBe(true);
    expect(passesGate('ADVERTISER', FAN)).toBe(false);
    expect(passesGate('ADVERTISER', EVERYTHING)).toBe(true);
    expect(passesGate('PROMOTER', { ...FAN, canPromote: true })).toBe(true);
  });
});

describe('badges', () => {
  it('carries a real ticket count and hides the badge at zero', () => {
    const withTickets = buildShellNav(EVERYTHING).find((item) => item.id === 'tickets');
    expect(withTickets?.badge).toEqual({ text: '2', tone: 'venue' });

    const none = buildShellNav({ ...EVERYTHING, upcomingTicketCount: 0 }).find((item) => item.id === 'tickets');
    expect(none?.badge).toBeUndefined();
  });

  it('hides the badge when the count could not be read, rather than claiming zero', () => {
    const unknown = buildShellNav({ ...EVERYTHING, upcomingTicketCount: undefined })
      .find((item) => item.id === 'tickets');
    expect(unknown?.badge).toBeUndefined();
  });

  it('maps every tone to a token, never a hex literal', () => {
    for (const tone of ['muted', 'venue', 'dj', 'artist', 'advertiser'] as const) {
      expect(badgeToneVar(tone)).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
    // Backlog item 3: advertiser has its own token now, not --warn.
    expect(badgeToneVar('advertiser')).toBe('var(--role-advertiser)');
  });
});

describe('creator hrefs resolve against the owned profile', () => {
  it('points Tour Creator at the artist profile and Event Creator at the venue', () => {
    const items = buildShellNav(EVERYTHING);
    expect(items.find((item) => item.id === 'tourcreator')?.href).toContain('profile=artist-1');
    expect(items.find((item) => item.id === 'eventcreator')?.href).toContain('venue=venue-1');
  });

  it('url-encodes ids so a slug with reserved characters cannot break the href', () => {
    const items = buildShellNav({ ...EVERYTHING, venueProfileId: 'a&b=c' });
    expect(items.find((item) => item.id === 'eventcreator')?.href).toBe('/events/new?venue=a%26b%3Dc');
  });
});

describe('route registry', () => {
  it('claims the signed-in surfaces and leaves marketing alone', () => {
    expect(isShellRoute('/listen')).toBe(true);
    expect(isShellRoute('/shows')).toBe(true);
    expect(isShellRoute('/shows/echo-park-night')).toBe(true);
    expect(isShellRoute('/me/dashboard')).toBe(true);
    expect(isShellRoute('/settings')).toBe(true);

    expect(isShellRoute('/')).toBe(false);
    expect(isShellRoute('/login')).toBe(false);
    expect(isShellRoute('/register')).toBe(false);
    expect(isShellRoute('/join')).toBe(false);
    expect(isShellRoute('/for-artists')).toBe(false);
  });

  it('does not let a prefix entry swallow a longer unrelated path', () => {
    // /for-you is EVENTS; /for-artists is a marketing kit page and must not
    // match it. Prefix matching is segment-aware for exactly this reason.
    expect(isShellRoute('/for-artists')).toBe(false);
    expect(resolveSection('/for-you')).toBe('EVENTS');
    // /community-rules has its own entry; without one it would still resolve
    // via /community's prefix, which is the right section either way.
    expect(resolveSection('/community-rules')).toBe('SETTINGS');
  });

  it('resolves /settings and /settings/accessibility to different sections', () => {
    expect(resolveSection('/settings')).toBe('PAGES');
    expect(resolveSection('/settings/accessibility')).toBe('SETTINGS');
    expect(findShellRoute('/settings/accessibility')?.itemId).toBe('a11y');
  });

  it('puts detail pages in the section that owns them', () => {
    expect(resolveSection('/shows/some-show')).toBe('EVENTS');
    expect(resolveSection('/artists/jayla-reign')).toBe('PAGES');
    expect(resolveSection('/radio')).toBe('LISTEN');
  });
});

describe('active item resolution', () => {
  const items = buildShellNav(EVERYTHING);

  it('matches a tabbed hub on its ?tab= value', () => {
    expect(resolveActiveItemId(items, '/listen', 'charts')).toBe('charts');
    expect(resolveActiveItemId(items, '/shows', 'tickets')).toBe('tickets');
    expect(resolveActiveItemId(items, '/pages', 'creator')).toBe('pagecreator');
  });

  it('falls back to the section default when a hub carries no tab', () => {
    expect(resolveActiveItemId(items, '/listen', null)).toBe('discover');
    expect(resolveActiveItemId(items, '/shows', null)).toBe('nearme');
  });

  it('falls back to the default for an unknown tab rather than lighting nothing', () => {
    expect(resolveActiveItemId(items, '/listen', 'nonsense')).toBe('discover');
  });

  it('matches routes the registry names directly', () => {
    expect(resolveActiveItemId(items, '/me/promote', null)).toBe('promote');
    expect(resolveActiveItemId(items, '/settings/accessibility', null)).toBe('a11y');
    expect(resolveActiveItemId(items, '/settings', null)).toBe('account');
  });

  it('lights nothing on a detail page that is not itself a nav destination', () => {
    expect(resolveActiveItemId(items, '/shows/some-show', null)).toBeNull();
    expect(resolveActiveItemId(items, '/artists/jayla-reign', null)).toBeNull();
  });

  it('returns null off shell routes entirely', () => {
    expect(resolveActiveItemId(items, '/', null)).toBeNull();
  });
});

describe('one manifest feeds both the drawer and the strip', () => {
  const items = buildShellNav(EVERYTHING);

  it('gives every section the same items in both surfaces, bar Account', () => {
    for (const section of ['LISTEN', 'EVENTS', 'SETTINGS'] as const) {
      expect(sectionRows(items, section).map((i) => i.id))
        .toEqual(sectionTabs(items, section).map((i) => i.id));
    }
    // PAGES is the one asymmetry the design specifies: the member's own name
    // ends the tab row and routes to Account, but is not a drawer row.
    expect(sectionTabs(items, 'PAGES').map((i) => i.id)).toContain('account');
    expect(sectionRows(items, 'PAGES').map((i) => i.id)).not.toContain('account');
  });

  it('matches the handoff’s exact drawer menu structure for a full account', () => {
    expect(sectionRows(items, 'LISTEN').map((i) => i.id)).toEqual(['discover', 'radio', 'charts', 'playlists']);
    expect(sectionRows(items, 'EVENTS').map((i) => i.id)).toEqual(['nearme', 'recommended', 'tickets', 'promote']);
    expect(sectionRows(items, 'PAGES').map((i) => i.id))
      .toEqual(['dashboard', 'pagecreator', 'showcreator', 'tourcreator', 'eventcreator', 'adcreator']);
    expect(sectionRows(items, 'SETTINGS').map((i) => i.id)).toEqual(['community', 'a11y', 'info', 'legal']);
  });

  it('never emits an item into a section it does not belong to', () => {
    for (const item of items) {
      expect(sectionRows(items, item.section).concat(sectionTabs(items, item.section)))
        .toContainEqual(item);
    }
  });
});

describe('hrefTab', () => {
  it('reads the tab param, and nothing else', () => {
    expect(hrefTab('/listen?tab=radio')).toBe('radio');
    expect(hrefTab('/pages?tab=mypage&profile=x&tool=tour')).toBe('mypage');
    expect(hrefTab('/me/promote')).toBeNull();
    expect(hrefTab('/events/new?venue=v1')).toBeNull();
  });
});
