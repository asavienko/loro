The primary way to answer in Loro — always pair it with a one-line hint.

```jsx
<MicButton state={micState} onPointerDown={start} onPointerUp={resolve} onCancel={cancel} />
<span style={{ fontSize: 10, color: 'var(--ink-8)' }}>Hold the mic to talk · tap it to keep listening</span>
```

While listening, replace the composer with the accent-tinted listening bar (waveform + status + × + Done). Never leave the user without a cancel.
