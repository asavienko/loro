Secondary actions are text, not buttons. Put 3–4 in a row with `gap: 13px`.

```jsx
<div style={{ display: 'flex', gap: 13 }}>
  <InlineAction glyph="♪">Hear</InlineAction>
  <InlineAction>EN</InlineAction>
  <InlineAction tone="accent">Fix 2 ›</InlineAction>
</div>
```

Use `tone="accent"` for the one action that opens something; `tone="grow"` once a thing is saved ("Saved").
