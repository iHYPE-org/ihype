const _InT = {
  bg: '#100d09', bg2: '#1a1612',
  ink: '#f0ebe5', ink2: '#9e9080', ink3: '#5a5048',
  line: 'rgba(255,255,255,0.06)', line2: 'rgba(255,255,255,0.14)',
  accent: '#ff5029',
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
};

export function Input({
  label, placeholder = '', value, onChange, hint,
  leading, trailing, error, disabled = false, type = 'text',
}) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error
    ? _InT.accent
    : focused
    ? 'rgba(255,255,255,0.28)'
    : _InT.line2;

  const wrap = {
    display: 'flex', flexDirection: 'column', gap: 6,
    opacity: disabled ? 0.45 : 1,
  };
  const inputRow = {
    display: 'flex', alignItems: 'center', gap: 8,
    background: _InT.bg, border: `1px solid ${borderColor}`,
    borderRadius: 8, padding: '0 12px', height: 42,
    transition: 'border-color 150ms',
  };
  const inputStyle = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    fontFamily: _InT.fb, fontSize: 14, fontWeight: 400,
    color: _InT.ink, caretColor: _InT.accent,
  };

  return React.createElement('div', { style: wrap },
    label && React.createElement('div', {
      style: { fontFamily: _InT.fm, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: _InT.ink3 },
    }, label),
    React.createElement('div', { style: inputRow },
      leading && React.createElement('div', { style: { color: _InT.ink3, display: 'flex', alignItems: 'center', flexShrink: 0 } }, leading),
      React.createElement('input', {
        type, placeholder, value, disabled,
        onChange: e => onChange && onChange(e.target.value),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        style: { ...inputStyle, '::placeholder': { color: _InT.ink3 } },
      }),
      trailing && React.createElement('div', { style: { color: _InT.ink3, display: 'flex', alignItems: 'center', flexShrink: 0 } }, trailing),
    ),
    (hint || error) && React.createElement('div', {
      style: { fontFamily: _InT.fb, fontSize: 12, color: error ? _InT.accent : _InT.ink3 },
    }, error || hint),
  );
}
