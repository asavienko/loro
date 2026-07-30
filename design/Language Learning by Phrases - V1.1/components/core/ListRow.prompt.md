The default way to list phrases, topics and saved lines.

```jsx
<ListRow first onClick={pick}>
  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Morning talk</span>
  <span style={{ color: 'var(--accent-ink)' }}>·</span>
</ListRow>
```

Keep the row's own padding vertical only; the screen gutter handles the sides.
