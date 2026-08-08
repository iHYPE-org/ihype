const _SpT = {
  ok: { bg: 'rgba(34,229,212,.15)', color: '#22e5d4' },
  pending: { bg: 'rgba(255,184,74,.15)', color: '#ffb84a' },
  warn: { bg: 'rgba(255,80,41,.15)', color: '#ff5029' },
  neutral: { bg: 'rgba(120,120,120,.15)', color: '#96a1b5' },
};

export function StatusPill({ children, tone = 'neutral', dot }) {
  const t = _SpT[tone] || _SpT.neutral;
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 22, padding: '0 10px', borderRadius: 999,
    fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600,
    letterSpacing: '.1em', textTransform: 'uppercase',
    background: t.bg, color: t.color,
  };
  return React.createElement('span', { style },
    dot && React.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 } }),
    children,
  );
}
