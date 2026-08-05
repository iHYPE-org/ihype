# Radio

Vertical radio group. Controlled — pass value + onChange.

```jsx
<Radio
  options={[{ value:'fan', label:'Fan' }, { value:'artist', label:'Artist' }, { value:'venue', label:'Venue' }]}
  value={role}
  onChange={setRole}
/>
<Radio options={['Local', 'Regional', 'National', 'Global']} value={tier} onChange={setTier} accent="#22e5d4" />
```

## Notable variants
- `options` — array of strings OR `{ value, label }` objects
- `accent` — active dot + border color (default: `--accent`)
- Active label color is `--ink-1`; inactive is `--ink-3`
- Controlled only — parent manages `value` state
