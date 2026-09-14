import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Nothing in the product may LINK to a redirect alias.
 *
 * `next.config.mjs`'s `redirects()` exists for URLs already in the wild — sent
 * email, app-store listings, bookmarks, QR codes — so that a route can move
 * without breaking them. A link the product renders itself is not in the wild:
 * it is a hop the member pays on every tap (a 307, and inside the shell a
 * flash as the client router lands on one URL and is sent to another), and it
 * is where a retired route survives longest, because the redirect keeps it
 * working after the page is gone. On 2026-09-14 the scan below found 18 such
 * links (DESIGN_SYNC row 415): three into routes deleted weeks earlier
 * (`/pages`, `/payout/<slug>`, `/me/promote`), the settings link in the
 * header of every public page (`/me/settings` — at the time a PAGE FILE that
 * forwarded to `/settings`, which forwarded again), and the public search bar
 * posting to `/search`, whose redirect drops the query it was carrying.
 *
 * The redirect sources are read from `next.config.mjs` rather than restated,
 * so a route that moves tomorrow is guarded the day its redirect is written.
 * A source with a parameter (`/payout/:id`) is matched as a prefix; a `has:` /
 * `missing:` rule is conditional and skipped, as is an absolute destination.
 * Admin and API trees are out of scope: the console is not member-facing and
 * routes do not render anchors.
 *
 * The second test is the other half of the same defect. A `page.tsx` whose
 * whole body is one `redirect()` call cannot answer a 307 under the root
 * `loading.tsx` boundary — the shell is already streaming, so it answers a 200
 * carrying the document and a one-second `<meta http-equiv="refresh">`
 * (measured on production: `/beta`, 22,766 bytes). Twelve such files were
 * deleted on the same date and their forwards moved into `redirects()`.
 */

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx$/.test(name) ? [path] : [];
  });
}

type RedirectSource = { source: string; destination: string };

function redirectSources(): RedirectSource[] {
  const config = readFileSync('next.config.mjs', 'utf8');
  const start = config.indexOf('redirects()');
  const rest = config.slice(start);
  const end = rest.search(/\n\s*(async\s+)?(headers|rewrites)\s*\(\)/);
  const block = rest.slice(0, end > 0 ? end : undefined);
  const sources: RedirectSource[] = [];
  for (const chunk of block.split(/source:\s*/).slice(1)) {
    const source = /^['"`]([^'"`]+)['"`]/.exec(chunk)?.[1];
    if (!source) continue;
    const destinationAt = chunk.indexOf('destination:');
    const destination = /destination:\s*['"`]([^'"`]+)/.exec(chunk)?.[1] ?? '';
    const conditional = /\b(has|missing):\s*\[/.test(chunk.slice(0, destinationAt > 0 ? destinationAt : undefined));
    if (conditional || /^https?:/.test(destination)) continue;
    sources.push({ source, destination });
  }
  return sources;
}

const MEMBER_FACING = ['src/app', 'src/components'];
const OUT_OF_SCOPE = /src\/(app\/admin|app\/api|components\/admin)\//;

function memberFacingFiles(): string[] {
  return MEMBER_FACING.flatMap(walk).filter((file) => !OUT_OF_SCOPE.test(file));
}

/**
 * The server half: notification `link`s (which `NotificationsList` hands to
 * `router.push`, so an alias there is a hop and a flash inside the shell),
 * email links built on the base URL, Stripe return URLs and server-side
 * `redirect()` calls. 23 were found the same day the component scan cleared
 * (DESIGN_SYNC row 417), one of them on a route nothing called.
 */
const SERVER_SIDE = ['src/lib', 'src/app/api', 'workers'];

function serverFiles(): string[] {
  return SERVER_SIDE.flatMap((dir) => walkAll(dir, /\.(ts|tsx)$/)).filter((file) => !/__tests__|\.test\./.test(file));
}

function walkAll(dir: string, match: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walkAll(path, match) : match.test(name) ? [path] : [];
  });
}

/** Paths a server file hands to a notification, an email, Stripe, or a redirect. */
function serverLinkedPaths(line: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const pattern = /(?:href|url|link|callbackUrl|success_url|cancel_url|return_url|refresh_url|destination|actionUrl)\s*[:=]\s*[`'"](\/[^`'"?#\s]*)|redirect\(\s*[`'"](\/[^`'"?#]*)|\$\{(?:getBaseUrl\(\)|baseUrl|BASE_URL|base|appUrl|origin)\}(\/[^`'"?#\s<]*)|https?:\/\/ihype\.org(\/[^`'"?#\s<]*)/g;
  for (const m of line.matchAll(pattern)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4];
    out.push({ path: raw.replace(/\$\{[^}]*\}/g, SEGMENT), text: m[0].trim() });
  }
  return out;
}

/** Every literal path a line hands to an href, a form action or a router push. */
/**
 * Every literal path a line hands to an href, a form action, a router push or
 * a server `redirect()`. A `${…}` interpolation is one path segment the code
 * fills in at runtime, so it is kept as a marker and matched as `[^/]+` —
 * `/shows/${slug}` is a link to a show, not to `/shows/:slug/cancel`.
 */
function linkedPaths(line: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  for (const m of line.matchAll(/(?:href|action)=\{?\s*[`'"](\/[^`'"?#]*)|(?:push|replace|redirect)\(\s*[`'"](\/[^`'"?#]*)/g)) {
    const raw = m[1] ?? m[2];
    out.push({ path: raw.replace(/\$\{[^}]*\}/g, SEGMENT), text: m[0].trim() });
  }
  return out;
}

const SEGMENT = '\u0000';

/** `/payout/:id` → `^/payout/[^/]+$`; `/artists/:path*` → `^/artists/.+$`. */
function sourcePattern(source: string): RegExp {
  const body = source
    .split('/')
    .map((part) => (part.endsWith('*') && part.startsWith(':') ? '.+' : part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}$`);
}

function matchesAlias(path: string, source: string): boolean {
  const sample = path.replaceAll(SEGMENT, 'x');
  return sourcePattern(source).test(sample);
}

describe('redirect aliases', () => {
  const sources = redirectSources();
  const files = memberFacingFiles();

  it('reads a plausible redirect table and file set — a zero is earned, never assumed', () => {
    expect(sources.length, 'too few redirect sources parsed out of next.config.mjs').toBeGreaterThan(50);
    expect(sources.some((s) => s.source === '/pages'), '/pages is the canonical retired alias and is missing').toBe(true);
    expect(files.length, 'too few member-facing .tsx files collected').toBeGreaterThan(100);
  });

  it('is linked to by nothing the product renders', () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        for (const { path, text } of linkedPaths(line)) {
          for (const { source, destination } of sources) {
            if (matchesAlias(path, source)) {
              hits.push(`${file}:${index + 1}  ${text}  — ${source} redirects to ${destination}; link there directly`);
            }
          }
        }
      });
    }
    expect(hits, `\n${hits.join('\n')}\n`).toEqual([]);
  });

  it('is linked to by nothing the server sends — notifications, email, Stripe returns, redirects', () => {
    const files = serverFiles();
    expect(files.length, 'too few server files collected').toBeGreaterThan(200);
    const hits: string[] = [];
    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        for (const { path, text } of serverLinkedPaths(line)) {
          for (const { source, destination } of sources) {
            if (matchesAlias(path, source)) {
              hits.push(`${file}:${index + 1}  ${text}  — ${source} redirects to ${destination}; link there directly`);
            }
          }
        }
      });
    }
    expect(hits, `\n${hits.join('\n')}\n`).toEqual([]);
  });

  it('is never a page file whose whole body is a redirect()', () => {
    const offenders: string[] = [];
    for (const file of walk('src/app')) {
      if (!/\/page\.tsx$/.test(file) || /^src\/app\/(app|admin)\//.test(file)) continue;
      const body = stripComments(readFileSync(file, 'utf8'));
      /* A page that decides WHERE to send someone at request time — from the
         session, the cookies or the query string — is a page, not an alias;
         only an unconditional forward to a fixed path belongs in the router. */
      const decides = /\b(auth|cookies|headers)\(|searchParams/.test(body);
      const fixed = /redirect\(\s*['"]\//.test(body);
      const renders = /<[A-Za-z]/.test(body);
      if (fixed && !decides && !renders) offenders.push(file);
    }
    expect(offenders, 'a redirect-only page answers 200 + meta refresh under loading.tsx; move the forward into next.config.mjs redirects()').toEqual([]);
  });

  it('refuses the shapes it exists for', () => {
    expect(matchesAlias('/pages', '/pages')).toBe(true);
    expect(matchesAlias('/pages-editor', '/pages')).toBe(false);
    expect(matchesAlias(`/payout/${SEGMENT}`, '/payout/:id')).toBe(true);
    expect(matchesAlias('/payout/abc', '/payout/:id')).toBe(true);
    expect(matchesAlias('/payout/', '/payout/:id')).toBe(false);
    // A show link is not a link to the show's cancel page.
    expect(matchesAlias(`/shows/${SEGMENT}`, '/shows/:slug/cancel')).toBe(false);
    expect(matchesAlias(`/shows/${SEGMENT}/cancel`, '/shows/:slug/cancel')).toBe(true);
    expect(matchesAlias('/artists/a/b', '/artists/:path*')).toBe(true);
    expect(linkedPaths('<Link href={`/payout/${s.slug}`}>')[0]).toMatchObject({ path: `/payout/${SEGMENT}` });
    expect(linkedPaths("redirect('/advertise/dashboard')")[0]).toMatchObject({ path: '/advertise/dashboard' });
    expect(linkedPaths('router.push(`/search?q=${encodeURIComponent(q)}`)')[0]).toMatchObject({ path: '/search' });
    expect(linkedPaths('<form action="/search" method="get">')[0]).toMatchObject({ path: '/search' });
    expect(linkedPaths('const x = "/pages";')).toEqual([]);
    expect(serverLinkedPaths('link: `/shows/${show.slug}/lineup`,')[0]).toMatchObject({ path: `/shows/${SEGMENT}/lineup` });
    expect(serverLinkedPaths('success_url: `${baseUrl}/advertise/dashboard?checkout=success`,')[0]).toMatchObject({ path: '/advertise/dashboard' });
    expect(serverLinkedPaths('<a href="${baseUrl}/artists/${p.slug}">')[0]).toMatchObject({ path: `/artists/${SEGMENT}` });
    expect(serverLinkedPaths("redirect('/payouts?tab=settings');")[0]).toMatchObject({ path: '/payouts' });
    // A hardcoded origin is the same link with the base URL written out.
    expect(serverLinkedPaths('<a href="https://ihype.org/home">')[0]).toMatchObject({ path: '/home' });
  });
});
