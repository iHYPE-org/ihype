export default function Loading() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 0 100px' }}>
      <div style={{ padding: '48px 32px 40px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap', borderBottom: '1px solid rgba(34,229,212,.2)' }}>
        <div className="ihype-skeleton" style={{ width: 100, height: 100, borderRadius: 16, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 10 }}>
          <div className="ihype-skeleton" style={{ width: '50%', height: 32, borderRadius: 6 }} />
          <div className="ihype-skeleton" style={{ width: '35%', height: 16, borderRadius: 6 }} />
          <div style={{ display: 'flex', gap: 32, marginTop: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gap: 6 }}>
                <div className="ihype-skeleton" style={{ width: 40, height: 22, borderRadius: 5 }} />
                <div className="ihype-skeleton" style={{ width: 64, height: 10, borderRadius: 4 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <div className="ihype-skeleton" style={{ width: 110, height: 40, borderRadius: 9 }} />
          </div>
        </div>
      </div>
      <div style={{ padding: '32px 32px 0' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ihype-skeleton" style={{ width: 70, height: 16, borderRadius: 5 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ihype-skeleton" style={{ height: 72, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
