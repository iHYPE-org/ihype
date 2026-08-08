# Select

Dropdown selector with animated popover, active checkmark, and error/hint states.

```jsx
<Select
  label="Coverage area"
  options={[{ value:'local', label:'Local' }, { value:'regional', label:'Regional' }]}
  value={tier}
  onChange={setTier}
/>
<Select options={['Fan', 'Artist', 'Venue']} value={role} onChange={setRole} error="Role is required" />
```

## Notable variants
- `options` — strings or `{ value, label }` objects
- `label` — mono-caps label above trigger
- `error` — red border + message below; overrides `hint`
- `hint` — muted helper text below
- Closes on outside click; animates open with `ihype-scale-in`
