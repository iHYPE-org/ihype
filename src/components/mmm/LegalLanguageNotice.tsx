import { getLocale, getServerT } from '@/lib/i18n/server';

/**
 * Tells a reader, IN THEIR OWN LANGUAGE, that the document they are about to
 * read is English and that the English text is the one that governs.
 *
 * WHY THIS EXISTS, AND WHY THE NOTICE IS THE TRANSLATED PART.
 *
 * The charter, the terms, the privacy policy and the DMCA process are the four
 * surfaces in this product that make binding statements. Everything else here
 * is translated into eleven locales; these are not, and that is a decision
 * rather than a gap:
 *
 *   - A machine translation of binding text creates a SECOND text. If the two
 *     disagree, the reader relied on the one they could read, and ambiguity in
 *     a contract nobody negotiated is generally construed against whoever
 *     wrote it. So a translation error here can only ever bind iHYPE to
 *     something it did not mean — the risk runs one way.
 *   - Leaving the document English and saying nothing is worse than either
 *     option, because the reader cannot tell which text is authoritative, or
 *     that there is a question at all.
 *
 * Hence: the DOCUMENT stays English, and the NOTICE ABOUT IT is translated.
 * A governing-language notice written only in English is useless to precisely
 * the person it exists for, which is the trap worth naming — it is easy to add
 * such a line, feel covered, and have communicated nothing.
 *
 * The offer of help is not decoration. It is the mitigation for shipping a
 * document somebody cannot read, and it has to remain true: `admin@ihype.org`
 * is the only address this product uses, and somebody answers it.
 *
 * WHAT THIS IS NOT. It is not a waiver, and it does not make an untranslated
 * document sufficient everywhere. Quebec's Charter of the French Language,
 * France's Loi Toubon and several EU member states require consumer-facing
 * terms in the local language, and a governing-language clause does not
 * displace a consumer-protection statute. The privacy policy on the next
 * screen already offers GDPR and CCPA rights, so the product is addressing
 * those readers. This is the right shape for a US-incorporated, invite-only
 * alpha operating from Portland, Maine; it is a question to re-open with a
 * lawyer before marketing into those jurisdictions.
 *
 * Shown only when the reader's locale is not English — an English speaker
 * reading English needs no notice about which language governs.
 */
export async function LegalLanguageNotice() {
  const [locale, t] = await Promise.all([getLocale(), getServerT()]);
  if (locale === 'en') return null;

  return (
    <aside className="mmm-legal-language" role="note">
      {/* ONE LINE, deliberately. `extract-i18n-keys.mjs` reads a literal
          `t('key', 'English')` and a call split across lines is invisible to
          it — and therefore to the applier, so its translations could never be
          applied. Wrapped, this was the one string in the change that would
          have silently stayed English: the notice telling a non-English reader
          which language governs. */}
      <p>{t('legalLanguageNotice.body', 'This document is published in English, and the English text is the version that governs.')}</p>
      <p>
        {t('legalLanguageNotice.help', 'If you would like help understanding it in your language, write to')}{' '}
        <a href="mailto:admin@ihype.org">admin@ihype.org</a>.
      </p>
    </aside>
  );
}
