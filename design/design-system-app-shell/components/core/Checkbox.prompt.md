# Checkbox

Controlled boolean input with optional label and detail line.

```jsx
<Checkbox checked={agreed} onChange={setAgreed} label="Show my Hypes publicly" detail="Other fans can see your votes" />
<Checkbox checked={false} onChange={() => {}} label="Receive ads" accent="#22e5d4" />
<Checkbox checked={true} disabled label="Verified member" />
```

## Notable variants
- `accent` — custom checkmark color (default: `--accent`)
- `detail` — secondary line in `--ink-3` below the label
- `disabled` — 45% opacity, pointer-events blocked
- Controlled only — parent manages `checked` state
