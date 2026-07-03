export default function Loading() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 0 100px' }}>
      <div style={{ padding: '40px 32px 32px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="ihype-skeleton" style={{ width: 96, height: 96, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 10 }}>
            <div className="ihype-skeleton" style={{ width: '45%', height: 32, borderRadius: 6 }} />
            <div className="ihype-skeleton" style={{ width: '30%', height: 16, borderRadius: 6 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <div className="ihype-skeleton" style={{ width: 100, height: 40, borderRadius: 9 }} />
              <div className="ihype-skeleton" style={{ width: 100, height: 40, borderRadius: 9 }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'grid', gap: 6 }}>
              <div className="ihype-skeleton" style={{ width: 48, height: 22, borderRadius: 5 }} />
              <div className="ihype-skeleton" style={{ width: 64, height: 10, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '28px 32px 0' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ihype-skeleton" style={{ width: 60, height: 16, borderRadius: 5 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ihype-skeleton" style={{ height: 64, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
