Confirms saves, fixes and topic changes — and offers the reversal when something was added or removed.

```jsx
<Toast>Saved to your stream</Toast>
<Toast actionLabel="Undo" onAction={undo}>4 phrases added</Toast>
```

Copy is plain, specific and past tense ("Fixed — and saved to practice"), sentence case, no emoji, no "Success!". The undo link uses `--accent-on-dark` because the pill is ink.
