The heart of a review session.

```jsx
<RevealCard hint="Say it in Spanish" prompt={card.en} answer={card.es}
  revealed={revealed} onReveal={() => setRevealed(true)} onHear={() => say(card.es)}
  footer={<GradeRow onGrade={grade} goodInterval="3 days" />} />
```

Never show both sides at once, and never auto-reveal — the recall attempt is the exercise.
