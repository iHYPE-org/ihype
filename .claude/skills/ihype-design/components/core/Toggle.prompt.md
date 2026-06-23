# Toggle

iOS-style switch row with label and optional detail line. Used in privacy and settings panels.

```jsx
<Toggle on={true} label="Show my Hypes publicly"
  detail="Other fans can see what you've voted for"
  onChange={val => setOn(val)} />
<Toggle on={false} label="Receive industry-only ads" />
```

## Notable variants
- `on` — controlled boolean state
- `label` — DM Sans 500, primary row text
- `detail` — optional secondary line in `--ink-3`
- `onChange(newVal)` — fires with the toggled boolean
- Active track color: `--accent` (#ff5029); inactive: 12% white
