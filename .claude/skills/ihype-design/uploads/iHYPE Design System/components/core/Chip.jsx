const _CT = {
  bg: '#0a0805', bg2: '#1a1612',
  ink2: '#9e9080', ink3: '#5a5048',
  line: 'rgba(255,255,255,.06)', line2: 'rgba(255,255,255,.12)',
  fm: "'JetBrains Mono',monospace",
};

export function Chip({ children, accent = '#ff5029', active = false, leading, onClick }) {
  return React.createElement('button', {
    onClick,
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 28, padding: '0 12px', borderRadius: 9999,
      fontFamily: _CT.fm, fontSize: 9, fontWeight: 600,
      letterSpacing: '.12em', textTransform: 'uppercase',
      background: active ? `${accent}22` : _CT.line,
      color: active ? accent : _CT.ink2,
      border: `1px solid ${active ? accent + '44' : _CT.line2}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 150ms', whiteSpace: 'nowrap',
    },
  }, leading, children);
}
