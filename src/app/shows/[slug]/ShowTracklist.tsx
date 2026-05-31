interface RadioTrack {
  id: string;
  position: number;
  title: string;
  artistName: string | null;
  externalUrl: string | null;
  durationSecs: number | null;
  blockLabel: string | null;
}

interface ShowTracklistProps {
  tracks: RadioTrack[];
}

export function ShowTracklist({ tracks }: ShowTracklistProps) {
  const totalSecs = tracks.reduce((sum, t) => sum + (t.durationSecs ?? 0), 0);
  const totalDuration = totalSecs > 0
    ? `${Math.floor(totalSecs / 3600) > 0 ? `${Math.floor(totalSecs / 3600)}h ` : ''}${Math.floor((totalSecs % 3600) / 60)}m`
    : null;

  // Group tracks by blockLabel (null label = ungrouped)
  const blocks: { label: string | null; tracks: RadioTrack[] }[] = [];
  for (const track of tracks) {
    const last = blocks[blocks.length - 1];
    if (last && last.label === (track.blockLabel ?? null)) {
      last.tracks.push(track);
    } else {
      blocks.push({ label: track.blockLabel ?? null, tracks: [track] });
    }
  }

  return (
    <section className="section">
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Tracklist</h2>
          {totalDuration && <span className="meta">{tracks.length} tracks · {totalDuration}</span>}
        </div>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {blocks.map((block, bi) => (
            <div key={bi}>
              {block.label && (
                <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.4rem', paddingLeft: '0.75rem' }}>
                  {block.label}
                </div>
              )}
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
                {block.tracks.map((track) => (
                  <li
                    key={track.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2rem 1fr auto',
                      gap: '0.75rem',
                      alignItems: 'center',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.03)'
                    }}
                  >
                    <span className="meta" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {String(track.position + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <strong style={{ display: 'block' }}>{track.title}</strong>
                      {track.artistName && <span className="meta">{track.artistName}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {track.durationSecs && (
                        <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Math.floor(track.durationSecs / 60)}:{String(track.durationSecs % 60).padStart(2, '0')}
                        </span>
                      )}
                      {track.externalUrl && (
                        <a href={track.externalUrl} target="_blank" rel="noreferrer" className="button small secondary" style={{ fontSize: '0.75rem' }}>
                          Play ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
