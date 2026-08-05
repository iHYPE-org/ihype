const _TstC = { success: '#22e5d4', warn: '#ffb84a', error: '#ff5029', info: '#7fb3ff' };
const _icon = (paths, vb = '0 0 24 24') =>
  React.createElement('svg', { width: 14, height: 14, viewBox: vb, fill: 'none' }, ...paths);
const _TstI = {
  success: _icon([React.createElement('path', { key: 0, d: 'M5 12l4 4L19 7', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' })]),
  warn:    _icon([React.createElement('path', { key: 0, d: 'M12 9v4M12 17h.01M10.3 3.6L2.6 18a1 1 0 00.87 1.5h17.1a1 1 0 00.87-1.5L13.7 3.6a1 1 0 00-1.74 0z', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' })]),
  error:   _icon([React.createElement('path', { key: 0, d: 'M6 6l12 12M18 6L6 18', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' })]),
  info:    _icon([React.createElement('circle', { key: 0, cx: '12', cy: '12', r: '9', stroke: 'currentColor', strokeWidth: '1.6' }), React.createElement('path', { key: 1, d: 'M12 11v5M12 8h.01', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' })]),
};

export function Toast({ message, detail, variant = 'info', onClose }) {
  const c = _TstC[variant] || _TstC.info;
  const icon = _TstI[variant] || _TstI.info;
  return React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px 12px 12px', borderRadius: 10,
      background: '#100d09',
      border: '1px solid rgba(255,255,255,.1)',
      boxShadow: `0 8px 32px rgba(0,0,0,.4), 0 0 0 1px ${c}18`,
      minWidth: 280, maxWidth: 380,
      fontFamily: "'DM Sans',system-ui,sans-serif",
    },
  },
  React.createElement('div', {
    style: { width: 22, height: 22, borderRadius: 6, background: `${c}20`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  }, icon),
  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
    React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#f0ebe5', lineHeight: 1.3 } }, message),
    detail && React.createElement('div', { style: { fontSize: 12, color: '#9e9080', marginTop: 3, lineHeight: 1.5 } }, detail)
  ),
  onClose && React.createElement('button', {
    onClick: onClose,
    style: { background: 'transparent', border: 'none', color: '#5a5048', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0, marginTop: 2 },
  }, _icon([React.createElement('path', { key: 0, d: 'M6 6l12 12M18 6L6 18', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' })]))
  );
}
