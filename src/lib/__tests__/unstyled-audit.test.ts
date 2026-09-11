import { describe, expect, it, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Guards the decisions that make `audit:unstyled` worth reading.
 *
 * It is a GATE at zero now, so a false positive no longer just wastes a
 * reader's attention — it fails the build and the cheapest way out is to
 * delete a class something depends on. Both false-positive classes below were
 * real: `tab` was reported as a class `/admin` renders and nothing defines,
 * and it is a VARIABLE inside a template interpolation.
 *
 * The probe lives in a scratch directory, never in `src/`: every other scanner
 * in this repository walks that tree, and a test that writes a fixture there
 * passes in isolation and fails under parallel execution. That is why the
 * script takes `--roots=`.
 */
const dir = mkdtempSync(join(tmpdir(), 'unstyled-audit-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/* Every probe carries a BASELINE element on its own line. The script exits 1
   when it collects nothing — a directory rename must break it rather than
   report a triumphant zero — and several cases below deliberately leave the
   scanner with no class at all, which would trip that check instead of
   testing what they are about. */
const BASELINE = 'export const Baseline = () => <div className="real-class" />;\n';

function probe(tsx: string, css = '.real-class { color: red }'): string {
  const root = mkdtempSync(join(dir, 'case-'));
  mkdirSync(join(root, 'app'), { recursive: true });
  writeFileSync(join(root, 'app', 'probe.css'), css);
  writeFileSync(join(root, 'app', 'probe.tsx'), BASELINE + tsx);
  return execFileSync('node', ['scripts/audit-unstyled-classes.mjs', `--roots=${root}`, '--list'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

describe('the unstyled-class audit reports classes, not source', () => {
  it('still reports a class no stylesheet defines', () => {
    /* The whole point. If this ever stops firing the gate is green over a
       scanner that reads nothing, which is the failure the script's own
       zero-collection check exists to prevent. */
    expect(probe('export const A = () => <div className="real-class ghost-class" />;')).toContain('ghost-class');
  });

  it('never reports a variable from inside a template interpolation', () => {
    /* `button small${entry.id === tab ? '' : ' secondary'}` in
       src/app/admin/page.tsx yielded `tab`, a React state variable, which read
       as a genuine finding for as long as the list was advisory. */
    const out = probe(
      'export const A = ({ id, tab }: { id: string; tab: string }) =>\n' +
        '  <div className={`real-class${id === tab ? \'\' : \' secondary\'}`} />;',
    );
    expect(out).not.toMatch(/^\s*tab\s/m);
    expect(out).not.toMatch(/^\s*id\s/m);
  });

  it('never reports a quoted comparison operand either', () => {
    /* The obvious refinement — keep the quoted strings inside an
       interpolation, since `${on ? 'is-on' : ''}` really does render `is-on` —
       is wrong in the mirror-image way, and inventing nine findings named
       after tab ids is how it was caught. A regex cannot tell a ternary's
       branches from its condition, so neither is collected. */
    const out = probe('export const A = ({ tab }: { tab: string }) =>\n' +
      '  <div className={`real-class${tab === \'reports\' ? \'\' : \' secondary\'}`} />;');
    expect(out).not.toMatch(/reports/);
  });

  it('never reports the fragment beside an interpolation as a class', () => {
    /* `mmm-${kind}-row` is a class assembled at runtime, which this scan was
       never able to see. `mmm-` passes the CSS ident grammar and is not a
       class at all. */
    const out = probe('export const A = ({ kind }: { kind: string }) =>\n' +
      '  <div className={`real-class mmm-${kind}-row`} />;');
    expect(out).not.toMatch(/^\s*mmm-\s/m);
  });

  it('honours an unstyled-exempt marker that states a reason', () => {
    /* The escape the gate needs: a class read only by JavaScript or a test
       selector is intentional and will never have a rule. The marker must
       carry a reason or it is a silence rather than a record — and writing
       this negative case is what showed that the documented `\S` is satisfied
       by the `*` of a block comment's own terminator, so an empty
       `unstyled-exempt:` read as justified. The scanner's regex refuses that
       explicitly now. */
    const withMarker = probe(
      'export const A = () => (\n' +
        '  /* unstyled-exempt: read by the door scanner, never painted. */\n' +
        '  <div className="real-class js-only-hook" />\n' +
        ');',
    );
    expect(withMarker).not.toContain('js-only-hook');

    const bareMarker = probe(
      'export const A = () => (\n' +
        '  /* unstyled-exempt: */\n' +
        '  <div className="real-class js-only-hook" />\n' +
        ');',
    );
    expect(bareMarker, 'a marker with no reason must not excuse anything').toContain('js-only-hook');
  });
});
