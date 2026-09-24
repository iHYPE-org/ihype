import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Drives `audit:published-urls` in BOTH directions against scratch trees.
 *
 * Every false positive this scanner shipped on its first run is pinned here,
 * because each was found by sampling the output rather than by reading the
 * code, and the next heuristic change must not quietly bring one back.
 */
const SCRIPT = join(process.cwd(), 'scripts', 'audit-published-urls.mjs');
const made: string[] = [];

/** A minimal repo shaped the way the scanner expects to find one. */
function scratchRepo(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'published-urls-'));
  made.push(dir);
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  // The scanner imports the shared masker by relative path.
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true });
  cpSync(join(process.cwd(), 'scripts', 'lib', 'mask-comments.mjs'), join(dir, 'scripts', 'lib', 'mask-comments.mjs'));
  cpSync(SCRIPT, join(dir, 'scripts', 'audit-published-urls.mjs'));
  return dir;
}

function run(dir: string, args: string[] = []) {
  try {
    return { code: 0, out: execFileSync('node', ['scripts/audit-published-urls.mjs', ...args], { cwd: dir, encoding: 'utf8' }) };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

const ROBOTS = `export default function robots() {
  return { rules: [{ userAgent: '*', disallow: ['/app', '/login'] }] };
}`;

const CONFIG = `const config = {
  async redirects() {
    return [
      { source: '/old', destination: '/new', permanent: false },
      { source: '/radio', destination: '/app/music/radio', permanent: false },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.example.org' }],
        destination: 'https://example.org/:path*',
        permanent: true
      },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [] }];
  },
};
export default config;`;

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('audit:published-urls', () => {
  it('reports a published path that no route and no redirect answers', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/new/page.tsx': 'export default function P() { return null; }',
      'src/lib/mail.ts': 'const x = `${getBaseUrl()}/gone`;',
    });
    const { code, out } = run(dir);
    expect(out).toContain('DEAD     /gone');
    expect(code).toBe(1);
  });

  it('accepts a path that only a redirect answers', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/new/page.tsx': 'export default function P() { return null; }',
      'src/lib/mail.ts': 'const x = `${getBaseUrl()}/old`;',
    });
    const { code, out } = run(dir);
    expect(out).not.toContain('DEAD');
    expect(code).toBe(0);
  });

  /* Next runs redirects() BEFORE the filesystem, so a route under a
     redirect's source is shadowed and never answers. The scanner checked
     routes first and called `/artists/verified.rss` resolved while production
     answered 307 away from it (row 513). */
  it('follows a redirect that shadows a file route, as Next does', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      // A real handler at /old — shadowed by the `/old` → `/new` redirect.
      'src/app/old/route.ts': 'export function GET() { return new Response(null); }',
      'src/lib/mail.ts': 'const x = `${getBaseUrl()}/old`;',
    });
    // `/new` has no route, so following the redirect (not the shadowed
    // handler) is what makes this DEAD.
    const { code, out } = run(dir);
    expect(out).toContain('DEAD     /old');
    expect(code).toBe(1);
  });

  /* THE DISTINCTION THE WHOLE SCRIPT TURNS ON. The same URL is right in an
     email, because the member is signed in, and wrong in the sitemap, because
     robots forbids where it lands. */
  it('judges a robots-disallowed destination only when the sitemap submits it', () => {
    const email = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/app/music/radio/page.tsx': 'export default function P() { return null; }',
      'src/lib/mail.ts': 'const x = `${getBaseUrl()}/radio`;',
    });
    expect(run(email).out).not.toContain('BLOCKED');

    const sitemap = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/app/music/radio/page.tsx': 'export default function P() { return null; }',
      'src/app/sitemap.ts': 'const s = [`${base}/radio`];',
    });
    const { code, out } = run(sitemap);
    expect(out).toContain('BLOCKED  /radio');
    expect(code).toBe(1);
  });

  /* A `has:` redirect matches conditionally. The www→apex rule is
     `source: '/:path*'`, so a table that ignores the condition hands it every
     lookup — which reported `/artists` DEAD while production answered 308. */
  it('never resolves through a conditional or absolute redirect', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/new/page.tsx': 'export default function P() { return null; }',
      'src/lib/mail.ts': 'const x = `${getBaseUrl()}/nowhere`;',
    });
    // The catch-all would swallow this if the condition were ignored.
    expect(run(dir).out).toContain('DEAD     /nowhere');
  });

  /* `sitemap.ts` serves `/sitemap.xml`, so robots.ts's own link to it is live. */
  it('knows the metadata conventions are routes', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': `${ROBOTS}\nconst link = \`\${base}/sitemap.xml\`;`,
      'src/app/sitemap.ts': 'export default function s() { return []; }',
      'src/app/new/page.tsx': 'export default function P() { return null; }',
    });
    expect(run(dir).out).not.toContain('DEAD');
  });

  /* The RSS feed writes URLs inside XML; `<` and `>` end a path. */
  it('does not swallow an XML closing tag into the path', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/new/page.tsx': 'export default function P() { return null; }',
      'src/app/feed/route.ts': 'const xml = `<link>${baseUrl}/new</link>`;',
    });
    const { out } = run(dir);
    expect(out).not.toContain('</link>');
    expect(out).not.toContain('DEAD');
  });

  /* A zero is earned, never assumed — the refusal audit:mounts makes. */
  it('exits 2 rather than passing when it collects nothing', () => {
    const dir = scratchRepo({
      'next.config.mjs': CONFIG,
      'src/app/robots.ts': ROBOTS,
      'src/app/new/page.tsx': 'export default function P() { return null; }',
      'src/lib/quiet.ts': 'const nothing = 1;',
    });
    const { code, out } = run(dir);
    expect(out).toContain('collected nothing');
    expect(code).toBe(2);
  });
});
