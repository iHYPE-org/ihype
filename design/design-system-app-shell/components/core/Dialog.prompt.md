# Dialog

Modal dialog with backdrop blur, animated scale-in, and optional ✕ button.

```jsx
const [open, setOpen] = React.useState(false);
<Dialog open={open} title="Confirm HYPE" description="Cast your HYPE on this track." onClose={() => setOpen(false)}>
  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
    <Button tone="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
    <Button tone="solid" size="sm" onClick={submit}>Cast HYPE</Button>
  </div>
</Dialog>
```

## Notable variants
- `description` — secondary line below title in `--ink-3`
- `onClose` — wires the ✕ button AND backdrop click; omit for non-closable
- `width` — panel width in px (default 480)
- Focus is NOT yet trapped — add a focus-trap library for production
