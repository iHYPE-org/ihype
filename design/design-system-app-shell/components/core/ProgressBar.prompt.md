# ProgressBar

Animated horizontal progress bar with optional label and percentage readout.

```jsx
<ProgressBar value={72} label="To artists" showValue accent="#ff5029" />
<ProgressBar value={94} label="Clearance rate" showValue accent="#22e5d4" />
<ProgressBar value={280} max={300} label="Tickets sold" showValue />
```

## Notable variants
- `max` — denominator (default 100)
- `accent` — fill color; defaults to `--accent`
- `showValue` — renders `72%` right-aligned in accent color
- `label` — mono-caps label above the bar
- Width: fill parent; wrap in a sized container
