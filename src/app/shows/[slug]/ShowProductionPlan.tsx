import type { parseShowProductionPlan } from '@/lib/show-composer';

type ProductionPlan = NonNullable<ReturnType<typeof parseShowProductionPlan>>;

interface ShowProductionPlanProps {
  productionPlan: ProductionPlan;
}

export function ShowProductionPlan({ productionPlan }: ShowProductionPlanProps) {
  return (
    <section className="section">
      <div className="panel composer-plan-panel">
        <div className="composer-header">
          <div>
            <div className="badge">Production plan</div>
            <h2>Promoter run of show</h2>
            <p className="kicker">
              This show was assembled from artist songs and videos, recorded voice-over overdubs, sampler pads, and ad breaks inserted after every three media slots.
            </p>
          </div>
        </div>

        <div className="composer-grid">
          <div className="composer-column">
            <div className="composer-card">
              <h3>Artist media</h3>
              {productionPlan.mediaItems.length ? (
                <div className="composer-library-list">
                  {productionPlan.mediaItems.map((item) => (
                    <div className="composer-media-card" key={item.mediaId}>
                      <div>
                        <div className="composer-media-code">{item.mediaId}</div>
                        <strong>{item.title}</strong>
                        <p className="meta">
                          {item.artistName}
                          {item.notes ? ` | ${item.notes}` : ''}
                        </p>
                      </div>
                      <div className="composer-media-actions">
                        <a className="button small secondary" href={item.url} rel="noreferrer" target="_blank">
                          Open media
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">No artist media is attached to this show.</div>
              )}
            </div>
          </div>

          <div className="composer-column">
            <div className="composer-card">
              <h3>Voice-over cues</h3>
              {productionPlan.voiceOvers.length ? (
                <div className="composer-voice-list">
                  {productionPlan.voiceOvers.map((voiceCue) => (
                    <div className="composer-voice-card" key={voiceCue.id}>
                      <strong>{voiceCue.title}</strong>
                      <p className="meta">
                        {voiceCue.durationSeconds ? `${voiceCue.durationSeconds}s` : 'Open duration'}
                        {voiceCue.cueAfterMediaId ? ` | cue after ${voiceCue.cueAfterMediaId}` : ''}
                      </p>
                      {voiceCue.script ? <p>{voiceCue.script}</p> : <p className="meta">Recorded take with no text notes.</p>}
                      {voiceCue.recordingDataUrl ? (
                        <audio className="composer-audio-preview" controls src={voiceCue.recordingDataUrl} />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">No voice-over cues were saved for this show.</div>
              )}
            </div>

            <div className="composer-card">
              <h3>Sample pad assignments</h3>
              {productionPlan.samplePads.length ? (
                <div className="composer-sample-grid">
                  {productionPlan.samplePads
                    .slice()
                    .sort((left, right) => (left.assignedPad ?? 99) - (right.assignedPad ?? 99))
                    .map((sample) => (
                      <div className="composer-sample-card" key={`${sample.sampleId}-${sample.assignedPad ?? 'open'}`}>
                        <div>
                          {sample.assignedPad ? (
                            <div className="composer-media-code">Pad {String(sample.assignedPad).padStart(2, '0')}</div>
                          ) : null}
                          <strong>{sample.title}</strong>
                          <p className="meta">{sample.notes ?? 'Royalty-free sample.'}</p>
                          <div className="composer-media-code">{sample.sampleId}</div>
                        </div>
                        <a className="button small secondary" href={sample.url}>
                          Open sample
                        </a>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty">No sample pads were saved for this show.</div>
              )}
            </div>
          </div>

          <div className="composer-column">
            <div className="composer-card">
              <h3>Show sequence</h3>
              {productionPlan.sequence.length ? (
                <div className="composer-sequence-list">
                  {productionPlan.sequence.map((item, index) => (
                    <div className="composer-sequence-card" key={item.id}>
                      <div>
                        <span className="composer-sequence-index">{String(index + 1).padStart(2, '0')}</span>
                        <strong>{item.label}</strong>
                      </div>
                      <div className="composer-media-code">{item.kind}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">No run-of-show sequence was saved.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
