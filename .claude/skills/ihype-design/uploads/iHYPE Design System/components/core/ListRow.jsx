const _LrT = { bg2: '#100d09', ink: '#f0ebe5', ink2: '#9e9080', ink3: '#5a5048', line: 'rgba(255,255,255,.08)', fb: "'DM Sans',system-ui,sans-serif" };

export function ListRow({ leading, title, meta, trailing, onClick }) {
  const row = {
    display: 'flex', alignItems: 'center', gap: 14,
    border: `1px solid ${_LrT.line}`, borderRadius: 12, background: _LrT.bg2,
    padding: '14px 16px', cursor: onClick ? 'pointer' : 'default',
  };
  return React.createElement('div', { style: row, onClick },
    leading && React.createElement('div', { style: { flexShrink: 0 } }, leading),
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { style: { fontFamily: _LrT.fb, fontWeight: 600, fontSize: 14, color: _LrT.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
      meta && React.createElement('div', { style: { fontFamily: _LrT.fb, fontSize: 12, color: _LrT.ink2, marginTop: 3 } }, meta),
    ),
    trailing && React.createElement('div', { style: { flexShrink: 0 } }, trailing),
  );
}
