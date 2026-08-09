import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `_config.yml` keeps GitHub Pages from publishing this repository.
 *
 * Pages is enabled in the repository settings, so GitHub runs
 * `actions/jekyll-build-pages` on every push whether or not this project wants
 * a website. A SUCCESSFUL build is the bad outcome: it would put `CLAUDE.md`
 * (Supabase host, Hyperdrive id, KV namespace id, R2 bucket), `DEPLOY.md`,
 * `SECURITY_COMPLIANCE.md` and the vendored design system on a public
 * github.io address.
 *
 * The protection is a list of paths, and a list of paths rots. Add a top-level
 * directory, forget the list, and the next Pages build publishes it — with no
 * error, because the whole point of the change was to stop the build erroring.
 * There is no other signal. So the list is asserted rather than trusted.
 *
 * Parsed with a deliberately small YAML reader instead of adding a dependency:
 * the file is a fixed shape this repo controls, and pulling in `js-yaml` to
 * guard 45 strings is the worse trade.
 */
function excludedPaths(): Set<string> {
  const lines = readFileSync('_config.yml', 'utf8').split('\n');
  const start = lines.findIndex((line) => line.trim() === 'exclude:');
  expect(start, '_config.yml must have an `exclude:` block').toBeGreaterThanOrEqual(0);

  const out = new Set<string>();
  for (const line of lines.slice(start + 1)) {
    const match = /^\s+-\s+(.+?)\s*$/.exec(line);
    if (!match) break; // First non-item line ends the block.
    out.add(match[1].replace(/\/$/, ''));
  }
  return out;
}

function trackedTopLevel(): string[] {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  return [...new Set(files.map((path) => path.split('/')[0]))].sort();
}

describe('GitHub Pages exclusion', () => {
  it('excludes every tracked top-level path', () => {
    const excluded = excludedPaths();
    // Jekyll skips dotfiles on its own, and `_config.yml` is its own config.
    const unprotected = trackedTopLevel().filter(
      (entry) => !entry.startsWith('.') && entry !== '_config.yml' && !excluded.has(entry),
    );
    expect(
      unprotected,
      `Not excluded in _config.yml, so a GitHub Pages build would publish them: ${unprotected.join(', ')}`,
    ).toEqual([]);
  });

  it('names the files that would be most damaging to publish', () => {
    // Spelled out so deleting one from the list fails here rather than in a
    // security review six months later.
    const excluded = excludedPaths();
    for (const path of ['CLAUDE.md', 'DEPLOY.md', 'SECURITY_COMPLIANCE.md', 'DESIGN_SYNC.md', 'design']) {
      expect(excluded.has(path), `${path} must stay excluded from GitHub Pages`).toBe(true);
    }
  });

  it('publishes nothing by default even if a path escapes the exclude list', () => {
    const config = readFileSync('_config.yml', 'utf8');
    expect(config).toMatch(/^include:\s*\[\]\s*$/m);
    expect(config).toMatch(/published:\s*false/);
  });
});
