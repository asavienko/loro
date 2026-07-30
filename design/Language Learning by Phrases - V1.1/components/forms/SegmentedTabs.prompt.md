Switches between modes or ranges — never more than four options.

```jsx
<SegmentedTabs value={mode} onChange={setMode}
  items={[{ value: 'discover', label: 'Discover' }, { value: 'browse', label: 'Browse' }, { value: 'import', label: 'Import' }]} />
```

The selected tab is solid ink, not accent — accent is reserved for actions.
