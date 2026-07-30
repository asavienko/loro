Grading is four fixed choices with their real intervals underneath.

```jsx
<GradeRow goodInterval={reps === 0 ? '1 day' : '1 week'} onGrade={grade} />
```

Colours are fixed per grade (brick → gold → green → deeper green) and never take the accent. Always show the interval — the honesty is the point.
