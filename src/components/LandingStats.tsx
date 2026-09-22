import { formatNumber } from '@/lib/format-locale';
import { getLocale, getServerT } from '@/lib/i18n/server';
import { getTransparencySnapshot } from '@/lib/transparency';

/**
 * The four live counters on the landing page.
 *
 * Split out of `page.tsx` so the homepage can stream: the LCP element is the
 * hero (headline + artwork), which needs no database at all, but the page used
 * to await the transparency snapshot before emitting a single byte. That put a
 * Postgres round-trip in front of first paint and made '/' LCP swing between
 * 4218ms and 8782ms across samples of identical commits.
 *
 * The labels are static, so the fallback renders the same four boxes with the
 * same text and only the number withheld. Same DOM shape, same height, so
 * resolving the boundary does not shift layout — '/' currently measures
 * 0.000-0.003 CLS against a real budget and this must not spend it.
 */
/**
 * The four counters, each carrying BOTH English forms.
 *
 * "1 music fans" shipped on the front door of a private alpha, where a count
 * of one is the likeliest count there is. The labels were four bare plural
 * strings in an array, and an array of strings cannot know what number is
 * about to be printed beside it.
 *
 * It is also the shape no instrument here can see: `audit:untranslated` reads
 * JSX text, so a label living in a string constant is invisible to it exactly
 * the way the legal documents' own clauses are -- which is why these four were
 * English in eleven locales as well as ungrammatical in one.
 *
 * Both forms go through `t()` as literals so `extract-i18n-keys.mjs` can see
 * them and `apply-i18n-batch.mjs` can translate them. English is the only
 * language this file chooses BETWEEN the two forms for; every other locale
 * gets whatever its own dictionary supplies for each key. A language with
 * three plural forms would need its own rule, so say "two forms", never
 * "pluralised".
 */
export type T = (key: string, fallback?: string) => string;
type StatLabel = { key: string; one: string; other: string };

function statLabels(t: T): StatLabel[] {
  return [
    { key: 'artists', one: t('landingStats.artistsOne', 'local artist'), other: t('landingStats.artistsOther', 'local artists') },
    { key: 'fans', one: t('landingStats.fansOne', 'music fan'), other: t('landingStats.fansOther', 'music fans') },
    { key: 'hypes', one: t('landingStats.hypesOne', 'HYPE sent'), other: t('landingStats.hypesOther', 'HYPEs sent') },
    { key: 'shows', one: t('landingStats.showsOne', 'upcoming show'), other: t('landingStats.showsOther', 'upcoming shows') },
  ];
}

function StatList({ rows }: { rows: { key: string; value: string; label: string }[] }) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.key}>
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </div>
      ))}
    </>
  );
}

/**
 * Takes `t` rather than awaiting `getServerT()` itself, and that is the whole
 * point of the prop: this renders as a Suspense FALLBACK, so an async version
 * would suspend in the slot whose job is to paint immediately — the boundary
 * would then have nothing to show and the hero's own stream would be the
 * thing waiting. The caller already has `t` in hand.
 */
export function LandingStatsFallback({ t }: { t: T }) {
  // U+2007 (figure space) rather than an em dash or a spinner: it occupies the
  // width of a digit in the same font, so the box is already the right size
  // when the real number lands, and it reads as "not yet" rather than "zero".
  // The plural form is the placeholder's, because no count has arrived to
  // choose with.
  return <StatList rows={statLabels(t).map((l) => ({ key: l.key, value: ' ', label: l.other }))} />;
}

export async function LandingStats() {
  const { counters } = await getTransparencySnapshot();
  const locale = await getLocale();
  const format = (value: number) => formatNumber(locale, value);

  // A counter that is genuinely zero is still a claim, and "0 local artists"
  // on the front door of a request-access alpha argues against the page it is
  // printed on. When every counter is zero — an empty or brand-new database —
  // the whole strip renders nothing and `.fan-entry-stats:empty` removes the
  // section, rather than four boxes of zeroes.
  // This is the marketing-surface version of the rule admin-workbench.ts and
  // analytics-engine.ts already follow: absent beats a misleading number.
  // Note the asymmetry — ONE real number is enough to show the strip; this
  // only suppresses the all-zero case, so it stops applying the moment the
  // platform has anything at all on it.
  const total =
    counters.totalArtists + counters.totalListeners +
    counters.profileHypes + counters.showHypes + counters.upcomingShows;
  if (total === 0) return null;

  const t = await getServerT();
  const counts = [
    counters.totalArtists,
    counters.totalListeners,
    counters.profileHypes + counters.showHypes,
    counters.upcomingShows,
  ];
  return (
    <StatList
      rows={statLabels(t).map((label, index) => ({
        key: label.key,
        value: format(counts[index]),
        label: counts[index] === 1 ? label.one : label.other,
      }))}
    />
  );
}
