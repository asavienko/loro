The first child after `StatusBar` on **every** screen — root, push, session and flow alike. It is the only persistent chrome in the app.

```jsx
<Spine place="Phrasebook" ongoing={{ label: 'Voy tirando', playing: true }} onOpen={openSwitcher} onResume={expandTransport} />
<Spine place="Evening wave" onOpen={openSwitcher} />   {/* you are in the ongoing thing — no chip */}
```

Two rules make it trustworthy: the left side always names the *current* place (never a logo, never icons), and the right side exists only while something is genuinely running — a paused session, a playing loop, a half-answered flow. Tapping it goes straight back; it never asks a question, because leaving a session pauses it and leaving a flow keeps every answer.

A sheet gets no spine — dismiss the sheet first (law N14).
