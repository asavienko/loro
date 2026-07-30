Declared per home route, three or four items, never five.

```jsx
<NavRail items={[{ label: 'Stream' }, { label: 'Review', count: 12 }, { label: 'Add' }]} onMore={goMore} />
```

An item appears only with content behind it (`built: true`), and `expectedUse: 'daily'` earns the slot ahead of `'weekly'`. The bottom of the screen belongs to the single filled control, so the rail lives up here.
