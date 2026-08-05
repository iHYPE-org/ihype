# Chip

Selectable filter chip for genre tags, role filters, and status labels.

```jsx
<Chip active>Bedroom Pop</Chip>
<Chip accent="#b983ff" active>Fan</Chip>
<Chip accent="#22e5d4" onClick={() => toggle('venue')}>Venue</Chip>
```

## Notable variants
- `active` — accent-tinted bg + border; inactive is muted
- `accent` — role or category color
- `leading` — small leading node (e.g. a colored dot for role colors)
- `onClick` — parent manages toggle state
