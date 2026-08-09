const _T = { bg2: 'rgba(255,255,255,.04)', ink: '#eef1f6', ink3: '#8792a6', line: 'rgba(255,255,255,.13)', fb: "'Work Sans',system-ui,sans-serif", fm: "'JetBrains Mono',monospace" };

export function Card({ children, title, link, style }) {
  const cardStyle = { border: `1px solid ${_T.line}`, borderRadius: 10, background: _T.bg2, backdropFilter: 'blur(24px)', overflow: 'hidden', ...style };
  const headerStyle = { padding: '12px 16px', borderBottom: `1px solid ${_T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  return React.createElement('section', { style: cardStyle },
    title && React.createElement('div', { style: headerStyle },
      React.createElement('div', { style: { fontFamily: _T.fb, fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', color: _T.ink } }, title),
      link && React.createElement('div', { style: { fontFamily: _T.fm, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: _T.ink3 } }, link),
    ),
    children,
  );
}
