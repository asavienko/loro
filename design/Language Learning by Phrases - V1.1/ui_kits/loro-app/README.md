# Loro app — UI kit

Three live screens of the Loro mobile app, composed from `components/` and themed by `styles.css`.

| File | Screen | Source it recreates |
| --- | --- | --- |
| `ChatScreen.jsx` | The open chat (Loop D) | `Loro Chat.dc.html` — transcript, per-line EN reveal, push-to-talk, ways-to-answer, topic/pace + kept sheets |
| `InspectorScreen.jsx` | One line, opened | `Loro Chat.dc.html` — audio at two speeds, diff + reasoning, alternatives, word glosses |
| `TodayScreen.jsx` | Today · the ritual | `Loro.dc.html` (Loop B "TODAY · THE RITUAL") — today's five, three waves, ambient loop, rolling window |

`App.jsx` owns the shared conversation state (messages, selection, saved lines, mic, sheets) so Chat and Inspector stay in sync, exactly as they do in the blueprint. `index.html` transpiles the component sources in the browser (React + Babel from CDN) — no build step; open it directly.

## Interactions worth trying
- Tap a line → `EN` reveals just that translation; `Open ›` / `Fix 2 ›` jumps to the inspector.
- Type `quiero un cafe` → the live check offers `quiero → me pone` and `cafe → café` before you send.
- Hold the mic → "Keep talking / Release to send"; short tap → locked listening with `Done`.
- Keep a line, then open the counter in the header → kept sheet with **Queue for today's review**.
- Accent swatches top-right re-theme everything (`data-accent`).

## Not yet ported
Onboarding, Add phrases, Phrase detail, Adaptive stream, Speak to progress, Review session, Progress, the advanced loops (refrain, rogue/run, prosody) and the trip arc all exist in `Loro.dc.html` and are described in the root `readme.md` screen map.
