'use client';

import { useState } from 'react';

import { useI18n } from '@/components/I18nProvider';
import { measureFileLoudness } from '@/lib/measure-upload-loudness';

/**
 * Measure loudness for tracks that were uploaded before the browser did it.
 *
 * WHY THIS EXISTS. Levelling is measured at upload (`src/lib/loudness.ts`),
 * which means it only ever reaches tracks uploaded after that shipped. Every
 * track already in the library would have played un-levelled forever — the
 * feature would be real and inert, which is worse than absent because nothing
 * reports it. There is no server-side backfill available: the Worker gets
 * 128 MB and 1500 ms and cannot decode audio at all, so the only machine that
 * can measure an existing catalogue is the artist's own.
 *
 * ONE TRACK AT A TIME, deliberately. A decoded lossless master is hundreds of
 * megabytes of PCM; measuring a twelve-track album in parallel is a tab
 * crash. Sequential is slower and finishes.
 *
 * A track that cannot be measured is SKIPPED and counted, never retried in a
 * loop and never treated as failure of the whole pass — an unmeasured track
 * plays at unity, which is exactly where it already was.
 */

type Measurable = {
  hexId: string;
  title: string;
  storageUrl: string | null;
  loudnessLufs: number | null;
};

export function LoudnessMeasureButton({
  tracks,
  onMeasured,
}: {
  tracks: Measurable[];
  onMeasured: () => void;
}) {
  const { t } = useI18n();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  /* Only tracks with audio we can actually fetch. A row whose upload never
     reached storage has nothing to decode, and offering to measure it would
     promise something that cannot happen. */
  const pending = tracks.filter((track) => track.loudnessLufs === null && track.storageUrl);
  if (pending.length === 0) return null;

  async function measureAll() {
    setResult(null);
    let measured = 0;
    let skipped = 0;

    for (let index = 0; index < pending.length; index += 1) {
      const track = pending[index];
      setProgress({ done: index, total: pending.length });
      try {
        const response = await fetch(track.storageUrl!);
        if (!response.ok) {
          skipped += 1;
          continue;
        }
        const loudness = await measureFileLoudness(await response.blob());
        if (!loudness) {
          skipped += 1;
          continue;
        }
        const saved = await fetch(`/api/artist-media/${track.hexId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loudness),
        });
        if (saved.ok) measured += 1;
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    }

    setProgress(null);
    setResult(
      skipped === 0
        ? t('pageEditor.loudnessMeasuredAll', '{count} tracks levelled.').replace('{count}', String(measured))
        : t('pageEditor.loudnessMeasuredSome', '{count} levelled, {skipped} could not be read.')
            .replace('{count}', String(measured))
            .replace('{skipped}', String(skipped)),
    );
    onMeasured();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        className="button small"
        disabled={progress !== null}
        onClick={() => { void measureAll(); }}
        type="button"
      >
        {progress
          ? t('pageEditor.loudnessMeasuring', 'Levelling {done} of {total}…')
              .replace('{done}', String(progress.done + 1))
              .replace('{total}', String(progress.total))
          : t('pageEditor.loudnessMeasureButton', 'Level {count} older tracks').replace('{count}', String(pending.length))}
      </button>
      <p className="meta">
        {t(
          'pageEditor.loudnessMeasureHint',
          'Plays every track back at a matched volume. Measured here in your browser, because it needs to decode the audio — leave the tab open while it runs.',
        )}
      </p>
      {result && <p className="meta">{result}</p>}
    </div>
  );
}
