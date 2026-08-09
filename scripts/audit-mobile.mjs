#!/usr/bin/env node
/**
 * Measures how the app actually fits a phone.
 *
 * WHY A BROWSER AND NOT A GREP. `audit:shell` checks that a class is named
 * right; `audit:css` checks that a selector is not silently overridden.
 * Neither can see the thing a phone user actually complains about — a control
 * too small to hit, type too small to read, a page that rubber-bands sideways.
 * Those are properties of the RENDERED box, and the only instrument that knows
 * a box's size is a layout engine.
 *
 * WHY IT CAN POINT AT PRODUCTION. iOS and Android are a Capacitor WebView
 * pointed at https://ihype.org (capacitor.config.ts), so measuring the live
 * site at a phone viewport is not an approximation of the native apps — it is
 * the native apps.
 *
 *   node scripts/audit-mobile.mjs                     # against production
 *   node scripts/audit-mobile.mjs --base=http://…     # against a local build
 *   node scripts/audit-mobile.mjs --strict            # non-zero on regression
 *
 * The three budgets below are RATCHETS, in the same spirit as audit:css's
 * `--max=145`: they record the debt that already exists so a NEW offender
 * fails while the standing set does not block every merge. Lower them as the
 * type-ramp work lands. Never raise one to make a build green.
 *
 * Known limit: this measures signed-OUT pages. The signed-in shells (AppShell,
 * MmmShell) carry the fixed chrome where the safe-area insets matter most, and
 * reaching them needs the e2e session fixture — see e2e/fixtures/session.ts.
 * Those are covered by the geometry assertions in e2e/app-shell.spec.ts
 * instead.
 */

import { chromium, devices } from 'playwright';

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const STRICT = process.argv.includes('--strict');
const BASE = arg('base', 'https://ihype.org');

// The budgets. Measured 2026-08-06 at 393x852, AFTER src/app/mobile-fit.css
// landed. The pre-fix baseline was smallTaps 158 / tinyText 282, so the touch
// floor removed 60 of the 158.
//
// `tinyText` carries a little slack because /discover and /shows render live
// rows: the same code measures 283-285 depending on what is in the database
// that minute. The other two are exact.
//
// `overflowingPages: 1` is /launch, and it is NOT understood. Its layout
// viewport opens to 488px (window.innerWidth 488 against a clientWidth of 393)
// with no content element wider than the viewport — the only 488px box is the
// fixed decorative background, which is sizing to the widened viewport rather
// than causing it. Reproduced in Chromium mobile emulation; not yet confirmed
// on a real device, which is the next step before spending more on it.
const BUDGET = {
  smallTaps: 98,
  tinyText: 285,
  overflowingPages: 1,
};

const PAGES = [
  '/', '/info', '/login', '/register', '/join', '/discover', '/shows',
  '/for-artists', '/for-venues', '/advertise', '/walkthrough', '/community',
  '/journal', '/status', '/launch', '/this-weekend',
];

// iPhone 15-class logical viewport. Chosen because it is the narrowest of the
// current iPhones once the Dynamic Island is accounted for, so a layout that
// fits here fits the rest.
const VIEWPORT = { width: 393, height: 852 };
const TAP_MIN = 44; // Apple HIG minimum. Material asks 48dp.
const TEXT_MIN = 12;

function probe([tapMin, textMin]) {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const out = { scrollW: doc.scrollWidth, clientW: vw, offenders: [], smallTaps: [], tinyText: [] };
  const seen = new Set();

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;

    if (r.right > vw + 1 || r.left < -1) {
      const key = el.tagName + '.' + (el.className?.toString?.().slice(0, 40) || '');
      if (!seen.has(key)) {
        seen.add(key);
        out.offenders.push({ sel: key, right: Math.round(r.right), w: Math.round(r.width) });
      }
    }

    if (el.matches('a,button,[role="button"],input,select,summary') && (r.height < tapMin || r.width < 30)) {
      out.smallTaps.push({
        sel: el.tagName + '.' + (el.className?.toString?.().slice(0, 34) || ''),
        h: Math.round(r.height), w: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 28),
      });
    }

    // Only elements with their own text node — otherwise a wrapper is counted
    // once per level of nesting and the number means nothing.
    const fs = parseFloat(cs.fontSize);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && fs < textMin) {
      out.tinyText.push({
        sel: el.tagName + '.' + (el.className?.toString?.().slice(0, 34) || ''),
        px: fs, text: (el.textContent || '').trim().slice(0, 28),
      });
    }
  }
  return out;
}

// Chromium does not read HTTPS_PROXY from the environment the way curl and node
// do, so behind a proxy every navigation fails while `curl https://ihype.org`
// succeeds from the same shell. Forwarding it is necessary — but NOT always
// sufficient, and that is worth knowing before you spend an hour on it: against
// a TLS-terminating agent proxy this still fails, because Playwright launches a
// throwaway profile with no NSS store and the CA the proxy re-signs with is not
// in it. Verified, not assumed. Do not "fix" that with ignoreHTTPSErrors or
// --ignore-certificate-errors; measure from an environment that can reach the
// target instead, or point --base at a local production build.
// A no-op when HTTPS_PROXY is unset, which is the CI and laptop case.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  // localhost is in NO_PROXY everywhere; --base=http://localhost still works
  // because Chromium bypasses the proxy for loopback by default.
  ...(PROXY ? { proxy: { server: PROXY } } : {}),
});
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: VIEWPORT,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

const results = [];
const unmeasured = [];
console.log(`Measuring ${PAGES.length} pages at ${VIEWPORT.width}x${VIEWPORT.height} against ${BASE}\n`);

for (const path of PAGES) {
  try {
    const resp = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // A 404 or a 500 renders a page whose boxes are real and whose CONTENT is
    // not the page under test, so it must not quietly contribute measurements.
    if (resp && !resp.ok()) throw new Error(`HTTP ${resp.status()}`);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(probe, [TAP_MIN, TEXT_MIN]);
    results.push({ path, ...r });
    const over = r.scrollW - r.clientW;
    console.log(
      `  ${path.padEnd(15)} overflow:${String(over).padStart(4)}px  ` +
      `taps<${TAP_MIN}:${String(r.smallTaps.length).padStart(3)}  ` +
      `text<${TEXT_MIN}px:${String(r.tinyText.length).padStart(3)}`
    );
  } catch (e) {
    unmeasured.push({ path, reason: e.message.slice(0, 80) });
    console.log(`  ${path.padEnd(15)} ERROR ${e.message.slice(0, 60)}`);
  }
}
await browser.close();

const sum = (k) => results.reduce((n, r) => n + (r[k]?.length || 0), 0);
const actual = {
  smallTaps: sum('smallTaps'),
  tinyText: sum('tinyText'),
  overflowingPages: results.filter((r) => r.scrollW > r.clientW).length,
};

console.log('\n─────────────────────────────────────────────');
let failed = false;
for (const [key, budget] of Object.entries(BUDGET)) {
  const got = actual[key];
  const verdict = got > budget ? 'OVER' : got < budget ? 'improved' : 'at budget';
  if (got > budget) failed = true;
  console.log(`  ${key.padEnd(18)} ${String(got).padStart(4)} / ${String(budget).padEnd(4)}  ${verdict}`);
}
console.log('─────────────────────────────────────────────');

// A PAGE THAT DID NOT LOAD CONTRIBUTES ZERO OFFENDERS, AND ZERO LOOKS LIKE A
// PASS. This is the failure mode that matters most in an instrument: every
// budget above is a SUM over `results`, so a run that reached nothing printed
// `0 / 98 improved`, "Budgets beaten — lower them", and exited 0 under
// --strict. It was found by pointing the script at production from a sandbox
// whose Chromium could not route there — sixteen ERROR lines, followed by a
// clean bill of health.
//
// So the counts are only a verdict when the sample is complete. Anything
// missing is reported first, loudly, and is a hard failure under --strict
// regardless of what the numbers say: an incomplete measurement is not a
// smaller measurement, it is an unknown one.
if (unmeasured.length) {
  console.error(`\n${unmeasured.length} of ${PAGES.length} page(s) could not be measured:`);
  for (const u of unmeasured) console.error(`  ${u.path.padEnd(15)} ${u.reason}`);
  console.error(
    '\nThe totals above are a sum over the pages that DID load, so they are not\n' +
    'comparable to the budgets and must not be used to lower them. Fix the run\n' +
    'first. (If the pages are unreachable rather than broken, check the proxy:\n' +
    'this script forwards HTTPS_PROXY to Chromium, which does not read it.)'
  );
  if (STRICT) process.exit(1);
}

if (failed && STRICT) {
  console.error('\nA mobile budget regressed. Fix the new offender — do not raise the budget.');
  process.exit(1);
}
// Only invite a ratchet when every page was actually measured — otherwise the
// suggestion is to bake a gap in coverage into the gate.
if (!failed && !unmeasured.length) {
  const better = Object.entries(BUDGET).filter(([k, v]) => actual[k] < v);
  if (better.length) console.log('\nBudgets beaten — lower them in this file to lock the gain in.');
}
