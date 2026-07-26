const _BtnT = {
  bg: '#0a0805', ink: '#f0ebe5', accent: '#ff5029',
  fb: "'DM Sans',system-ui,sans-serif",
};

export function Button({ children, tone = 'solid', accent = _BtnT.accent, disabled = false, leading, full, onClick }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 44, borderRadius: 14, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: _BtnT.fb, fontWeight: 600, fontSize: 14, letterSpacing: '.01em',
    padding: '0 20px', opacity: disabled ? 0.45 : 1, width: full ? '100%' : undefined,
    transition: 'opacity 120ms, background 120ms',
  };
  const styles = {
    solid:   { ...base, background: accent, color: _BtnT.bg },
    ghost:   { ...base, background: `${accent}22`, color: accent },
    outline: { ...base, background: 'transparent', color: accent, border: `1px solid ${accent}40` },
  };
  return React.createElement('button', { style: styles[tone] || styles.solid, disabled, onClick }, leading, children);
}
