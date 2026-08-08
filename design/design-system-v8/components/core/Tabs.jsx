const _TabT = {
  fb: "'Work Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
  fd: "'Bricolage Grotesque',sans-serif",
  ink: '#eef1f6', ink3: '#8792a6',
  line: 'rgba(255,255,255,.06)',
};

export function Tabs({ tabs = [], active, onChange, accent = '#ff5029' }) {
  return React.createElement('div', {
    style: { display: 'flex', borderBottom: `1px solid ${_TabT.line}` },
  }, tabs.map(({ id, label, count }) => {
    const on = id === active;
    return React.createElement('button', {
      key: id,
      onClick: () => onChange && onChange(id),
      style: {
        padding: '10px 16px', background: 'transparent', border: 'none',
        borderBottom: `2px solid ${on ? accent : 'transparent'}`,
        marginBottom: -1, cursor: 'pointer',
        transition: 'color 120ms, border-color 120ms',
        fontFamily: _TabT.fm, fontSize: 9, fontWeight: 600,
        letterSpacing: '.14em', textTransform: 'uppercase',
        color: on ? _TabT.ink : _TabT.ink3,
        display: 'flex', alignItems: 'center', gap: 6,
      },
    },
    label,
    count !== undefined && React.createElement('span', {
      style: {
        fontFamily: _TabT.fd, fontWeight: 800, fontSize: 10,
        color: on ? accent : _TabT.ink3,
      },
    }, count)
    );
  }));
}
