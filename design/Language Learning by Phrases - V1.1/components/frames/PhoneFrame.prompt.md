The device shell for any Loro screen — use it whenever you show app UI, never a bare div.

```jsx
<PhoneFrame accent="coral" surface="chat">
  <StatusBar />
  {/* header / scroller / composer */}
</PhoneFrame>
```

Children lay out as a column: fixed header, `flex:1` scroller with `minHeight:0`, fixed footer. Bottom sheets and toasts are `position:absolute` inside the frame (it is the positioning context). `surface="app"` for the warmer phase screens; `surface="chat"` for conversation.
