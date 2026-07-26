const _ScT = { bg2: 'rgba(255,255,255,.04)', ink: '#f0ebe5', ink2: '#9e9080', ink3: '#5a5048', line: 'rgba(255,255,255,.15)', fs: "'Syne',sans-serif", fm: "'JetBrains Mono',monospace" };

export function StatCard({ value, label, accent = '#ff5029', delta, style }) {
  const card = { border: `1px solid ${_ScT.line}`, borderRadius: 14, background: _ScT.bg2, backdropFilter: 'blur(24px)', padding: '20px 18px', textAlign: 'center', ...style };
  return React.createElement('div', { style: card },
    React.createElement('div', { style: { fontFamily: _ScT.fs, fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', color: accent } }, value),
    React.createElement('div', { style: { fontFamily: _ScT.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: _ScT.ink2, marginTop: 8 } }, label),
    delta && React.createElement('div', { style: { fontFamily: _ScT.fm, fontSize: 10, color: accent, marginTop: 4 } }, delta),
  );
}
