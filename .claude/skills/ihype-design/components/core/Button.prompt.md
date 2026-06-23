# Button

Primary interactive element for iHYPE. Three tones: `solid` (primary CTA), `ghost` (secondary, tinted), `outline` (subtle, bordered).

```jsx
<Button tone="solid">Get ticket</Button>
<Button tone="ghost">RSVP free</Button>
<Button tone="outline">Follow artist</Button>
<Button tone="solid" accent="#22e5d4">Venue CTA</Button>
```

## Notable variants
- `tone="solid"` — filled with accent color, dark text
- `tone="ghost"` — 22% opacity accent bg, accent text
- `tone="outline"` — transparent bg, accent border at 40% opacity
- `accent` prop — override with any role color (`--role-fan`, `--role-venue`, etc.)
- `leading` — pass an SVG icon node to prepend
- `full` — stretches to 100% container width
- `disabled` — reduces opacity to 0.45, cursor not-allowed
