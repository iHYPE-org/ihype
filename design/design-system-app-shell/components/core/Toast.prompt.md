# Toast

Transient notification with icon, message, optional detail, and close button.

```jsx
<Toast message="HYPE cast!" detail="Collision · 3:38" variant="success" />
<Toast message="Show sold out" variant="warn" onClose={() => setVisible(false)} />
<Toast message="Ad rejected" detail="Copyright issue found in copy" variant="error" onClose={dismiss} />
```

## Notable variants
- `variant` — `success` (teal), `warn` (amber), `error` (accent), `info` (blue)
- `detail` — secondary line in `--ink-2`
- `onClose` — renders × button; omit for non-dismissable
- Position in a `position:fixed; bottom:20px; right:20px` container
