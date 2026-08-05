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
const STAT_LABELS = ['local artists', 'music fans', 'HYPEs sent', 'upcoming shows'] as const;

function StatList({ values }: { values: readonly string[] }) {
  return (
    <>
      {STAT_LABELS.map((label, index) => (
        <div key={label}>
          <strong>{values[index]}</strong>
          <span>{label}</span>
        </div>
      ))}
    </>
  );
}

export function LandingStatsFallback() {
  // U+2007 (figure space) rather than an em dash or a spinner: it occupies the
  // width of a digit in the same font, so the box is already the right size
  // when the real number lands, and it reads as "not yet" rather than "zero".
  return <StatList values={STAT_LABELS.map(() => ' ')} />;
}

export async function LandingStats() {
  const { counters } = await getTransparencySnapshot();
  const format = (value: number) => value.toLocaleString('en-US');

  return (
    <StatList
      values={[
        format(counters.totalArtists),
        format(counters.totalListeners),
        format(counters.profileHypes + counters.showHypes),
        format(counters.upcomingShows)
      ]}
    />
  );
}
