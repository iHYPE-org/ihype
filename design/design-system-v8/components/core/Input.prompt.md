# Input

Single-line text input with label, hint, error state, and optional leading/trailing nodes.

```jsx
<Input label="Email" placeholder="you@example.com" value={val} onChange={setVal} />
<Input placeholder="Search artists, shows, venues" leading={searchIcon} />
<Input label="Ticket limit" value="10" error="Must be between 1–500" />
```

## Notable variants
- `label` — mono caps label above field
- `leading` / `trailing` — icon or button nodes inside the field
- `error` — red border + error text; overrides `hint`
- `hint` — muted helper text below
- `disabled` — 45% opacity, pointer-events none
- `type` — pass `"password"` for masked input, `"search"` for search semantics
