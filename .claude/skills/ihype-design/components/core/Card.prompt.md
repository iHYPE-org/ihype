# Card

Bordered panel with optional header row (title + trailing link). Wraps any content — toggles, stats, track lists.

```jsx
<Card title="Privacy settings" link="View all">
  <Toggle label="Show my Hypes publicly" on={true} />
</Card>
<Card title="This week" style={{ maxWidth: 340 }}>
  <Stat label="Hypes cast" value="9.8k" />
</Card>
```

## Notable variants
- `title` — renders a header row with Syne 700 label
- `link` — optional trailing mono-uppercase link text in the header
- `style` — pass width/margin constraints; the card itself is `width: auto`
