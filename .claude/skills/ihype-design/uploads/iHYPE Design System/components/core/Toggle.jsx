export function Toggle({ on = false, label, detail, onChange }) {
  const trackStyle = { width: 44, height: 26, borderRadius: 13, flexShrink: 0, background: on ? '#ff5029' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 180ms', cursor: 'pointer' };
  const thumbStyle = { position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#f0ebe5', transition: 'left 180ms cubic-bezier(0.2,0.7,0.3,1)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' };
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: "'DM Sans',system-ui,sans-serif" };
  return React.createElement('div', { style: rowStyle, onClick: () => onChange && onChange(!on) },
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontSize: 14, color: '#f0ebe5', fontWeight: 500 } }, label),
      detail && React.createElement('div', { style: { fontSize: 11, color: '#5a5048', marginTop: 3 } }, detail),
    ),
    React.createElement('div', { style: trackStyle },
      React.createElement('div', { style: thumbStyle }),
    ),
  );
}
