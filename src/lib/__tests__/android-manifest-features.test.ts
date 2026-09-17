import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * A PERMISSION CAN SILENTLY NARROW WHO MAY INSTALL THE APP.
 *
 * Android implies a `uses-feature` from certain permissions and defaults it to
 * required="true". Nothing in the manifest says so, nothing in a diff shows it,
 * and no build fails — the only symptom is a line in the Play Console days
 * later. On 2026-09-17 that line read "This release no longer supports 19,174
 * devices that were supported in your previous release": the door scanner's
 * CAMERA permission (2026-09-10) had implied a required camera, and the
 * release before it had none.
 *
 * So every permission that implies a feature must declare that feature
 * explicitly. required="false" is the honest value wherever the product has a
 * working fallback — it has one for all of these — and a deliberate
 * required="true" is allowed but has to be written down, because then a member
 * without the hardware is refused the install rather than shown a broken
 * screen.
 */
const MANIFEST = readFileSync(
  join(process.cwd(), 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);

/** Permission → the features Android implies from it. */
const IMPLIED_FEATURES: Record<string, string[]> = {
  'android.permission.CAMERA': ['android.hardware.camera', 'android.hardware.camera.autofocus'],
  'android.permission.ACCESS_FINE_LOCATION': ['android.hardware.location.gps'],
  'android.permission.ACCESS_COARSE_LOCATION': ['android.hardware.location.network'],
};

function declaredPermissions(): string[] {
  return [...MANIFEST.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);
}

function declaredFeatures(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of MANIFEST.matchAll(
    /<uses-feature\s+android:name="([^"]+)"\s+android:required="(true|false)"\s*\/>/g,
  )) {
    out.set(m[1], m[2]);
  }
  return out;
}

describe('the Android manifest never narrows device reach by accident', () => {
  it('declares every feature its permissions imply', () => {
    const features = declaredFeatures();
    const missing: string[] = [];
    for (const permission of declaredPermissions()) {
      for (const feature of IMPLIED_FEATURES[permission] ?? []) {
        if (!features.has(feature)) missing.push(`${permission} implies ${feature}`);
      }
    }
    expect(missing, `Undeclared implied feature(s) default to required="true":\n${missing.join('\n')}`)
      .toEqual([]);
  });

  it('keeps those features optional, because the product works without them', () => {
    // The door scanner's manual code field and the map's seeded camera are the
    // fallbacks. If one of these ever becomes genuinely required, change it
    // here deliberately and say why in the manifest.
    const required = [...declaredFeatures()].filter(([, value]) => value === 'true').map(([name]) => name);
    expect(required).toEqual([]);
  });

  it('reads a manifest at all — an empty parse must not pass', () => {
    expect(declaredPermissions().length).toBeGreaterThan(3);
    expect(declaredFeatures().size).toBeGreaterThan(0);
  });
});
