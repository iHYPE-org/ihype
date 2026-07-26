const _EsT = { ink: '#f0ebe5', ink2: '#9e9080', line: 'rgba(255,255,255,.08)', fs: "'Syne',sans-serif", fb: "'DM Sans',system-ui,sans-serif" };

export function EmptyState({ icon, title, detail, action }) {
  const wrap = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    gap: 10, padding: '48px 24px', border: `1px dashed ${_EsT.line}`, borderRadius: 16,
  };
  return React.createElement('div', { style: wrap },
    icon && React.createElement('div', { style: { fontSize: 28, opacity: .5 } }, icon),
    React.createElement('div', { style: { fontFamily: _EsT.fs, fontWeight: 800, fontSize: 17, color: _EsT.ink } }, title),
    detail && React.createElement('div', { style: { fontFamily: _EsT.fb, fontSize: 13, color: _EsT.ink2, maxWidth: 320, lineHeight: 1.5 } }, detail),
    action && React.createElement('div', { style: { marginTop: 6 } }, action),
  );
}
