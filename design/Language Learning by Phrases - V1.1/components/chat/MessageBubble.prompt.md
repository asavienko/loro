The chat transcript is built entirely from these.

```jsx
<MessageBubble es="¿Cómo va la mañana?" en="How's the morning going?" selected onClick={select}>
  <InlineAction glyph="♪">Hear</InlineAction>
  <InlineAction>EN</InlineAction>
  <InlineAction tone="accent">Open ›</InlineAction>
</MessageBubble>
```

Rules: Loro's lines have no bubble at all (text on paper); the learner's line is an accent tint. English is never shown unless the user taps EN. Action rows appear only on the selected line.
