import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every merge that changes the native shell publishes both binaries (owner,
 * 2026-09-25: "I want all updates to push to the associated download path
 * automatically"), and both stores show package.json's version.
 */
const source = readFileSync(join(process.cwd(), '.github/workflows/native-build.yml'), 'utf8');

function pathsUnder(trigger: string) {
  const start = source.indexOf(`\n  ${trigger}:\n`);
  expect(start, trigger).toBeGreaterThan(-1);
  const rest = source.slice(start + trigger.length + 5);
  const end = rest.search(/\n {2}[a-z_]+:\n/);
  return (end === -1 ? rest : rest.slice(0, end))
    .split('\n')
    .map((line) => line.match(/^ {6}- '(.+)'$/)?.[1])
    .filter(Boolean);
}

function jobBody(name: string) {
  const start = source.indexOf(`\n  ${name}:\n`);
  expect(start, name).toBeGreaterThan(-1);
  const rest = source.slice(start + 1);
  const end = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

describe('native release automation', () => {
  it('publishes on a push to main over the same paths a pull request builds', () => {
    const push = pathsUnder('push');
    expect(push.length).toBeGreaterThan(3);
    expect(push).toEqual(pathsUnder('pull_request'));
    expect(source).toMatch(/\n {2}push:\n {4}branches:\n {6}- main\n/);
  });

  it('runs both signed jobs on push and gates every upload on the resolved publish flag', () => {
    for (const job of ['ios-release-build', 'android-release-build']) {
      const body = jobBody(job);
      expect(body, job).toContain("github.event_name == 'push'");
      expect(body, job).toContain("steps.check.outputs.publish == 'true'");
      expect(body, job).toContain('echo "publish=$PUBLISH"');
    }
  });

  it('stamps package.json version onto both stores', () => {
    const ios = jobBody('ios-release-build');
    expect(ios).toContain("require('../../package.json').version");
    expect(ios).toContain('MARKETING_VERSION="$MARKETING_VERSION"');
    expect(jobBody('android-release-build')).toContain('-PihypeVersionName="$VERSION_NAME"');
  });
});
