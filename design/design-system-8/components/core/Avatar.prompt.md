# Avatar

Circular initials avatar with role-color background. Used in top bars, comment threads, and profile headers.

```jsx
<Avatar name="Maya Reyes" roleColor="#ff5029" size={40} />
<Avatar name="Empty Bottle" roleColor="#22e5d4" size={32} />
```

## Notable variants
- `name` — split on spaces, first letter of each word, max 2 initials
- `roleColor` — background; text is always `--bg-base` (#0a0805)
- `size` — diameter in px; font scales proportionally (38% of size)
