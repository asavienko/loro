Word-by-word breakdown, wrapped in a flex row with `gap: 8px`.

```jsx
<WordChip es="te apetece" gloss="do you fancy" onClick={() => say('te apetece', 0.72)} />
```

Use chips when the words are short and scannable; use hairline rows (ListRow) when glosses run long.
