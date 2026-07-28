import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Guards the invariants that make the i18n layer correct but that nothing in
// the type system can express. Each of these has already been violated once in
// this codebase, which is why they are pinned here rather than trusted.

const DICT_DIR = 'src/lib/i18n/dictionaries';

const called: Record<string, string> = JSON.parse(
  execFileSync('node', ['scripts/extract-i18n-keys.mjs'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
);

function dict(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(join(DICT_DIR, `${locale}.json`), 'utf8'));
}

const locales = readdirSync(DICT_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

describe('i18n invariants', () => {
  it('every t() call carries an inline English fallback', () => {
    // Without a fallback, a key missing from the dictionary renders its raw
    // key to the user — and English no longer loads a dictionary at all, so a
    // fallback-less call is broken for English visitors by construction.
    const missing = Object.entries(called).filter(([, v]) => typeof v !== 'string' || v === '');
    expect(missing).toEqual([]);
  });

  it('en.json never disagrees with an inline fallback', () => {
    // Server and client both resolve locale-dictionary -> inline fallback, so
    // a divergent en.json value cannot currently reach a user. If someone
    // reintroduces an en.json tier on either side, this is the drift that
    // would surface as a React hydration mismatch. Keeping them equal means
    // that reintroduction stays harmless.
    const en = dict('en');
    const drift = Object.keys(called)
      .filter((k) => k in en && en[k] !== called[k])
      .map((k) => ({ key: k, enJson: en[k], fallback: called[k] }));
    expect(drift).toEqual([]);
  });

  it('placeholders survive translation in every locale', () => {
    // A dropped {date} renders a sentence promising information that never
    // appears; an invented one renders a literal brace to the user.
    const placeholders = (s: string) => (s.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) ?? []).sort();
    const expected = Object.entries(called).filter(([, v]) => placeholders(v).length > 0);

    const defects: string[] = [];
    for (const locale of locales) {
      const d = dict(locale);
      for (const [key, english] of expected) {
        if (key in d && placeholders(d[key]).join() !== placeholders(english).join()) {
          defects.push(`${locale}/${key}`);
        }
      }
    }
    expect(defects).toEqual([]);
  });

  it('no translation contains characters from a script its language never uses', () => {
    // A real defect once shipped this way: Cyrillic к/а/н spliced into the
    // middle of the Arabic word يمكن. It reads as an ordinary typo to anyone
    // who does not know the language, so only a machine check catches it.
    // Latin is allowed everywhere — brand terms and placeholders stay Latin.
    const scripts: Record<string, RegExp> = {
      cyrillic: /[Ѐ-ӿ]/,
      arabic: /[؀-ۿ]/,
      devanagari: /[ऀ-ॿ]/,
      cjk: /[一-鿿]/,
      kana: /[぀-ヿ]/,
      hangul: /[가-힯]/,
    };
    const allowed: Record<string, string[]> = {
      en: [], es: [], fr: [], pt: [], de: [], it: [],
      ru: ['cyrillic'], ar: ['arabic'], hi: ['devanagari'],
      ja: ['cjk', 'kana'], ko: ['hangul', 'cjk'], zh: ['cjk'],
    };

    const defects: string[] = [];
    for (const locale of locales) {
      const d = dict(locale);
      for (const [key, value] of Object.entries(d)) {
        for (const [name, re] of Object.entries(scripts)) {
          if (!allowed[locale].includes(name) && re.test(value)) {
            defects.push(`${locale}/${key}: unexpected ${name}`);
          }
        }
      }
    }
    expect(defects).toEqual([]);
  });

  it('keeps admin@ihype.org as the only iHYPE contact address', () => {
    // dmca@ihype.org was never a real mailbox; it survived in the legacy
    // dictionary keys after being fixed in the page source.
    const defects: string[] = [];
    for (const locale of locales) {
      for (const [key, value] of Object.entries(dict(locale))) {
        for (const email of value.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? []) {
          if (email.endsWith('ihype.org') && email !== 'admin@ihype.org') {
            defects.push(`${locale}/${key}: ${email}`);
          }
        }
      }
    }
    expect(defects).toEqual([]);
  });

  it('never restates the revenue split as anything but 70/20/10', () => {
    const defects: string[] = [];
    for (const locale of locales) {
      for (const [key, value] of Object.entries(dict(locale))) {
        const m = value.match(/\b\d{2}\/\d{2}\/\d{2}\b/);
        if (m && m[0] !== '70/20/10') defects.push(`${locale}/${key}: ${m[0]}`);
      }
    }
    expect(defects).toEqual([]);
  });

  it('leaves admin surfaces untranslated — they are English-only by decision', () => {
    // Product decision (2026-07-28): the admin/ops console serves staff, not
    // users, and ships in English only. Its t() calls stay put and resolve to
    // their inline English fallbacks, which costs nothing at runtime.
    //
    // This guard exists because translating them is otherwise an easy and
    // expensive mistake to make by accident: ~469 keys x 11 locales, and the
    // dictionaries ship to every visitor as static assets. 697 admin entries
    // had already accumulated before the decision and were removed with it.
    //
    // If admin should be translated later, delete this test — do not work
    // around it.
    const ADMIN_PREFIXED = /^(admin|ops)/;
    // Components under src/components/admin/ whose namespaces are not
    // admin-prefixed. Each is mounted only from an /admin/* route.
    const ADMIN_ONLY_NAMESPACES = new Set([
      'bulkActions',
      'moderationActions',
      'reportPageBulkButtons',
      'featureToggle',
      'socialPostCopy',
      'playlistActions',
      'playlistCreateForm',
    ]);
    const isAdminKey = (key: string) => {
      const ns = key.split('.')[0];
      return ADMIN_PREFIXED.test(ns) || ADMIN_ONLY_NAMESPACES.has(ns);
    };

    // en.json is exempt: it is the extracted English source that the
    // "never disagrees with an inline fallback" test above checks against,
    // not a translation shipped to a visitor.
    const defects: string[] = [];
    for (const locale of locales.filter((l) => l !== 'en')) {
      for (const key of Object.keys(dict(locale))) {
        if (isAdminKey(key)) defects.push(`${locale}/${key}`);
      }
    }
    expect(defects).toEqual([]);
  });
});
