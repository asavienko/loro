Secondary choices (topic, pace, kept lines) live in a sheet, not a new screen.

```jsx
<BottomSheet open={sheet === 'topic'} onClose={close}
  footer={<><InlineAction tone="alert">Start over</InlineAction><div style={{ flex: 1 }} /><InlineAction tone="strong">Done</InlineAction></>}>
  <SectionLabel>Talk about</SectionLabel>
</BottomSheet>
```

Must be rendered inside a PhoneFrame (it positions against it). Corner radii step from 26px at the top to the screen's 38px at the bottom.
