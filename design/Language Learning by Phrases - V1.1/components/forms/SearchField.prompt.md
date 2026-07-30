The search/add field at the top of "Add phrases".

```jsx
<SearchField value={q} focused={focus} onChange={onQuery} onClear={() => setQ('')} />
```

This is the only bordered-and-filled input in the system; inline composers use a bottom hairline instead (see the chat composer).
