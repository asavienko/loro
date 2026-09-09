# Open chat and message inspector surfaces

- **Requirement IDs:** `P3E-01`…`P3E-18`, `F-03`, `AS-01`…`AS-04`
- **Milestone:** M3 / v1.1
- **Status:** — Open chat and inspector routes remain to do. Text/offline slices need
  56/57/59/81/82; voice needs 62/63, Review handoff needs 75, and Q-16 gates release enablement.
- **Depends on:** 79 completed; 56/57/59/81/82 for text UI; 62/63 for real audio/ASR; 75 for Review
  handoff; 72 applicable harness.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

There are no `/chat` or inspector routes. The authored Chat screens remain the interaction source,
with Navigation owning chrome. Language identities and reactive UI copy already exist from 87;
target text and assistance must follow the selected pair, with explicit unavailable states for
unsupported topic/voice capabilities.

## Outcome

Learners can enter the v1.1 open-chat loop, speak or type the supported target language, get real
guarded replies, reveal help on demand, inspect any message, apply an explained correction, keep
useful lines in the same phrase stream, and queue them for Review. The two authored screens work
offline, survive normal interruptions, and never simulate microphone, audio, typing, corrections, or
provider output.

## Source states

`Loro Chat.dc.html` defines two screens and their state machine:

- Open chat: selected/unselected AI and learner bubbles, hidden/revealed English, typing/degraded
  response, suggestions and alternate suggestions, idle/holding/locked/heard microphone states,
  draft correction, topic/pace sheet, empty/populated kept sheet, and toasts.
- Message inspector: previous/next position, AI/learner identity, model and slow audio, optional
  respelling, correction diff/reasoning, fixed-line playback/apply, alternatives, and word glosses.

The `.dc.html` callbacks and `renderVals()` enumerate presentation states. Plan 82 replaces its
fixture language/provider behavior; plans 62/63 replace browser speech and fake recognition.

## Remaining work

1. [ ] Add typed `/chat` and `/chat/message/[turnId]` routes to plan 81's route table. Chat is a
       Push destination whose resolved home comes from the route table; the inspector is Push and
       renders the correct named-back/cold-entry behavior. Declare menu frequency/build state and
       all E2E states in the same commit.
2. [ ] Implement the route-local chat composition and only the repeated production components proven
       by the v1.1 inventory: `MessageBubble`, `PhraseRow`, `DiffRow`, `MicButton`, `VoiceWave`,
       `TypingDots`, and any missing shared bottom-sheet/list primitives. Reuse plan 57/81
       components; do not import the design package's React prototype into production.
3. [ ] Render messages from the coordinator with stable keys and a virtualized, bottom-anchored
       list. Selection reveals the action row without an outline; the native-language translation
       stays hidden until its reveal control; all target text carries its actual target locale in
       `accessibilityLanguage` in native source. Translation reveal uses the native language; do not
       hardcode `EN` outside the authored English/Spanish pair. Hear, Save, Open/Fix, and Say again
       are independent ≥40px controls with explicit accessibility names.
4. [ ] Implement text composition: target-language input, send, inline high-confidence draft
       correction, apply fix, suggestions, “Others”, hide, edit-before-send, and send-as-is.
       Keyboard/safe-area behavior must work at 200%/310% text scale. Empty input cannot send and a
       stale correction cannot apply to changed text.
5. [ ] Implement microphone interaction through plan 63: hold to talk, tap/slide to lock where
       platform gestures support it, Done, cancel, partial/listening state, final “Heard you say”,
       Again, and Send. Permission denied, unavailable language, silence, no match, interruption,
       route change, and background cases use honest states. Web tests use an explicit speech fake;
       production never substitutes a canned transcript.
6. [ ] Implement response lifecycle: immediate submitted turn, real pending indicator, cancellation,
       retry/degraded bundled continuation, out-of-order protection, background resume, and provider
       budget/safety states. Do not add decorative minimum delays or show typing after a response
       has failed.
7. [ ] Implement topic/pace and kept sheets. Topic changes preserve or explicitly start a thread per
       plan 82's contract; pace changes actual playback/provider behavior and optionally reveals the
       native-language translation. Start over confirms destructive clearing when retained turns
       exist. Kept rows support hear, remove, empty state, and queue-for-today with real
       singular/plural counts.
8. [ ] Implement the inspector from the selected durable turn: previous/next, native-language
       translation, respelling, normal/slow playback, explanation, word glosses,
       alternatives/register, save, and learner-line correction diff. “Use it & keep the fix”
       performs one explicit repository transaction and cannot double-add; it does not rewrite
       historical evidence without retaining the original turn.
9. [ ] Integrate phrase/review handoff. Original, fixed, and alternative lines enter through the
       same phrase repository, tagging sheet/default policy, outbox, and audio-availability state as
       other learner-authored phrases. Queue-for-review uses plan 75's queue contract and never
       writes practice progress directly or fabricates a due interval.
10. [ ] Add developer/reference fixtures to plan 80's workbench for every component/state, as
        components land, then add learner E2E and native device coverage. All learner copy goes
        through `src/lib/copy.ts`; fixture conversation content belongs in validated content packs.

## Test matrix

- Browser state manifest: seeded/offline chat, selected AI/learner line, translation reveal,
  suggestions, draft correction, pending/degraded response, mic fake states, topic sheet, kept
  empty/populated, inspector AI/no-fix/fix/applied, start-over confirmation, and provider error
  recovery.
- Unit/component: reducer/coordinator transitions, stale request cancellation, list anchoring,
  duplicate save, correction race, pluralization, focus restore, sheet escape, reduced motion, and
  long target/native-language and respelling text.
- Native/device: permission matrix, real on-device ASR, audio at both rates, headphones/call/route
  interruptions, background/foreground, keyboard, safe areas, screen reader, Dynamic Type, and audio
  egress canary.
- End-to-end data: keep → phrasebook/store → Review queue → relaunch → sync metadata, while thread
  text remains inside the plan-82 privacy boundary.

## Acceptance criteria

- Voice and text conversations work with the network disabled using bundled topics; live service
  availability enhances but never gates entry or basic completion.
- Every visible correction, reply, translation, suggestion, count, playback state, and transcript
  comes from its real owner. No prototype regex, PRNG, timer reply, or canned microphone result
  ships.
- Saving/fixing requires an explicit tap, deduplicates correctly, survives relaunch, and appears in
  the same phrase/review data path as every other learner-authored line.
- Recorded audio never leaves the device; thread/transcript text never enters telemetry.
- All declared browser states pass accessibility and text-scale suites, and native audio/speech
  behavior passes the real-device matrix before the route is release-enabled.
- `pnpm check`, `pnpm test:e2e`, `pnpm test:e2e:bundle`, provider evals, and applicable native
  suites pass.

## Commit sequence

1. [ ] `feat(mobile): add chat routes and static states (P3E-01)`
2. [ ] `feat(mobile): add text turns suggestions and sheets (P3E-04)`
3. [ ] `feat(mobile): connect native speech and response lifecycle (P3E-06)`
4. [ ] `feat(mobile): add message inspector and corrections (P3E-11)`
5. [ ] `feat(mobile): keep and queue chat phrases (P3E-14)`
6. [ ] `test(mobile): cover chat browser and device states (P3E-18)`

## Out of scope

Provider/domain implementation owned by plan 82, cloud audio recognition, voice cloning, unbounded
conversation history, group/social chat, tutor tools, and changing the authored design files.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../docs/reviews/2026-09-09-post-main-plan-review.md) records this plan's
current contribution, remaining work and gates.
[Delivered slices](archive/2026-09-09/IMPLEMENTED-SLICES.md) are retained in the archive; this plan
remains incomplete. Earlier verification is dated evidence, not acceptance of the current combined
branch.
