Setup questions ("How much time per day?") and pack pickers.

```jsx
<ChoiceCard label="Fairly confident" sub="I can hold a chat" selected={level === 'conf'} onClick={() => setLevel('conf')} />
```

Stack them with `gap: 9px`. Selected state = accent tint + accent border + tick; never a radio dot.
