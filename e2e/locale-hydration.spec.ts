import { expect, test, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * A member who chose Español gets a Spanish DOCUMENT, not an English one that
 * turns Spanish after it has painted (DESIGN_SYNC row 426).
 *
 * Until this spec existed, `I18nProvider` started every render — on the server
 * as well as in the browser — at English with an empty dictionary and only read
 * the member's locale in a mount effect. So every string a CLIENT component
 * translated (the header's "Sign in", the dock's "Listen", every button and
 * label inside the shell) arrived in the HTML in English beside the server
 * components' Spanish, and flipped to Spanish after hydration: a flash of the
 * wrong language on every page load, and English in the copy a search engine,
 * a translation tool or a screen reader reads first. `<html lang="en">` was
 * hardcoded, so the document also SAID it was English, and Arabic laid out
 * left-to-right until the same effect flipped `dir`.
 *
 * Measured against the pre-fix build, so the reading is recorded rather than
 * reasoned: both pages arrived with `lang="en"`, "Sign in" and "Listen" in the
 * body, and — worth knowing — NO hydration error, because the server rendered
 * the same English the client's first render did; the hypothesis that this was
 * a React mismatch was tested and was wrong. The hydration guard stays because
 * the fix seeds the client from the server and a future drift between the two
 * is exactly what it would catch.
 *
 * Every assertion reads the RESPONSE BODY, never the DOM, because the DOM is
 * what the old effect repaired after the fact.
 */
const HYDRATION_ERROR = /hydrat|Minified React error #(418|423|425)|did not match|Text content does not match/i;

async function loadInSpanish(page: Page, path: string) {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(String(error)));
  const response = await page.goto(path);
  expect(response, `${path} answered`).not.toBeNull();
  const html = await response!.text();
  await page.waitForLoadState('networkidle');
  // Give hydration and any recovery render a moment to report.
  await page.waitForTimeout(1500);
  return { html, errors };
}

test.describe('a Spanish member gets a Spanish document', () => {
  test.use({ locale: 'es-ES' });

  test('the public info hub', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'ihype_locale', value: 'es', url: baseURL! }]);
    const { html, errors } = await loadInSpanish(page, '/info');
    expect(html, 'the document names its language').toMatch(/<html[^>]*\slang="es"/);
    // A SERVER component's string (the root layout's skip link)…
    expect(html).toContain('Saltar al contenido principal');
    // …and a CLIENT component's (HeaderAuthLinks' sign-in link) — the one that used to arrive in English.
    expect(html).toContain('Iniciar sesión');
    expect(html).not.toMatch(/>Sign in</);
    expect(errors.filter((line) => HYDRATION_ERROR.test(line)), errors.join('\n')).toEqual([]);
  });

  test('a signed-in shell page', async ({ page, context, baseURL }) => {
    test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');
    await applySessionCookie(context, 'hydration-probe@example.com');
    await context.addCookies([{ name: 'ihype_locale', value: 'es', url: baseURL! }]);
    const { html, errors } = await loadInSpanish(page, '/app/me/settings');
    expect(html, 'the document names its language').toMatch(/<html[^>]*\slang="es"/);
    // The dock is a client component; its Listen tab used to arrive as "Listen".
    expect(html).toContain('Escuchar');
    expect(html).not.toMatch(/>Listen</);
    expect(errors.filter((line) => HYDRATION_ERROR.test(line)), errors.join('\n')).toEqual([]);
  });
});
