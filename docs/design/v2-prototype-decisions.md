# v2.0 rapid prototype: decisions to carry, or not

The v2.0 rapid UI prototype (`design/design-v2.0/rapid-ui-prototype`) explores a Spotify-shaped,
listening-first Loro. It is a **proposal**, not an authored artifact: the v1.1 design package still
owns screens, navigation and visuals. This page records what the prototype decided across its
review rounds (`design/design-v2.0/ui-ux-review/`), so a decision reaches the app deliberately, and
nothing reaches it by accident.

Requirement IDs touched: `P3-01` (continuous playback), `P2-24` (difficulty drives repetitions),
`F-03` (offline-first), `F-04` (cross-device sync).

## Decisions the prototype made

| Area | Decision | Status for the app |
| --- | --- | --- |
| Vocabulary | Two nouns only: **Set** (a group of phrases) and **Phrase**. No waves, packs, decks or drills. | Proposal; conflicts with authored Stream/Refrain naming, needs Product |
| The loop | Prompt in the native language → silence sized to the measured target → target; repeated; then a short hold for a rating | Proposal; compare with Stream (`P3-01`) |
| Recall rule | The target text stays hidden (player, mini-player, queue, lock screen) until it has been heard | Candidate for the app |
| Grades | Missed / Hard / Easy → FSRS Again / Hard / Good. FSRS Easy is not offered | Proposal; the app's confidence ladder differs |
| Rating window | A rating waits five minutes (change or undo), then counts at its original time. Statuses, due counts and review dates show it at once; points wait for the window | Proposal |
| Points | +1 per phrase listened (once per 5 minutes), +1/+2/+3 per rating, +10 once when learned; derived from the log | Proposal; must stay real and never shame |
| Learned | FSRS review state, stability ≥ 21 days, ≥ 3 successful recalls | Proposal |
| First review | The first successful rating comes back within 1 day when the phrase was first heard that day, however many repetitions, or within 4 days when it was also heard on an earlier day. The cap counts local calendar days, not repetitions, so the preview on the grades stays the same for a whole play. Each heard and rated log entry carries the learner's local day as it was written, so every device replays one log to the same schedule, in any time zone and after travel; entries from before that stamp use the replaying device's day | Proposal on top of the core policy |
| Play modes | At the end of a queue: play it again, or continue with the next phrases of the course | Proposal |
| Repetitions | Auto: 3 while new or shaky, 1 under review; override 1 or 3 | Aligns with `P2-24` |
| Covers | Drawn from content (topic colour + icon), never photos with invented text | Candidate |
| Own content | Learners add phrases and make sets; both sync | Proposal |
| End of a queue | A review, the demo and a Library list play one pass in either mode and end on a panel ("Review done", "That's the loop", "All played"); a set keeps "play again" or "continue" | Proposal |
| Where rating happens | Grades only in the full player. Home's Review, Start here and Continue open it; during the hold the mini-player says "Tap to rate"; a rating given in the hold is confirmed by a message with Undo | Proposal |
| Time to say it | The silence is 1.3× the measured phrase plus 0.6 s (Standard) or 2× plus 1 s, 2.5–12 s (Longer, a setting), and the "Your turn" step fills as it runs. Durations include it and the 4 s hold of each unrated phrase | Proposal; timing stays measured, never estimated |
| Home | One hero at a time: the demo, then the review, then Continue, then the next set once every phrase of the last one has been started and none is due | Proposal |
| Visual system | Terracotta fill only for play and the primary action; a selected state is ink; flat rows, tonal cards, one hero per screen; covers drawn from topic colour, a per-set shape and the whole icon | Proposal; the v1.1 design package owns visuals |

## Engineering the app can reuse

- **Scheduling through core-rs.** The prototype calls `fsrs_initialize`/`fsrs_review` through the
  synchronous browser WASM (`packages/core-rs/browser`). Memory, difficulty and learning steps are
  the core's; display retrievability mirrors `scheduler.rs::retrievability`. The one local policy
  is the review date (see Findings).
- **Event-sourced learner state.** An append-only review log with device-scoped ids; memory and
  points are derived. Merge is a union of logs plus last-writer-wins per like, own item and profile.
  This matches the field-class approach of [sync-protocol.md](../architecture/sync-protocol.md).
- **An explicit player statechart** whose allowed events per status are data, rendered as Mermaid.

## Findings for Product

- **The canonical 50% desired retention makes intervals about 90× stability.** With it, a second
  on-time Easy scheduled the next review years away (see
  [fsrs-model.md](../architecture/fsrs-model.md)), which made the prototype unusable as a daily
  loop. The prototype therefore reviews when predicted recall falls to **90%**, after the stability
  in days, keeping the core's 50% date as the upper bound. The app keeps the authored 50% policy
  until Product decides; this is the evidence for that decision.
- New Spanish, Bulgarian and Russian text in the prototype (phrases, notes, glosses, UI copy)
  awaits native review, as recorded in the prototype's `content/meta.json`.

## Not decided here

Pricing, sign-in, cloud audio (the backend will own voices and clip lengths), and whether the
Spotify shape replaces or sits beside the authored Today/Stream/Refrain structure.
