# Add phrases: Import mode and OCR Capture

- **Requirement IDs:** `P2-09`, `P2-10`, `P2-15`, `AI-03`
- **Milestone:** Import M2 · Capture M3
- **Blueprint:** `Loro.dc.html:222–427`, logic `AddLogic` `2176–2433`
- **Spec:** `docs/product/functional-spec.md#2-add-phrases`
- **Size:** M (Import) · L (Capture)
- **Depends on:** [fix-user-phrase-identity.md](04-fix-user-phrase-identity.md)
- **Status:** 🟡 Partly implemented 2026-07-29. The own-phrase row model, UUIDv7 constructor,
  `addOwnPhrase()` action, rendering fallbacks, undo path, and `own*` merge policies have landed.
  Remaining: Import/Capture UI, optional-translation modelling, catalog/custom dedupe, downstream
  availability tests, persistence/sync wiring, OCR, permissions, and AI assist. Local Import UI is
  unblocked; persistence/sync waits on plans 10 and 15, audio degradation on 11, and Capture on a
  privacy-reviewed OCR choice.

## Current state

`apps/mobile/app/add.tsx` (500 lines) implements Discover and Browse plus the tagging sheet — two of
the blueprint's three tabs. **Import is the missing third.** The screen's input already invites it:
`add.tsx:182` renders the placeholder "Type a phrase, or a topic…" and nothing consumes typed text
as a phrase.

The structural prerequisite has landed with
[fix-user-phrase-identity.md](04-fix-user-phrase-identity.md): `addOwnPhrase()` creates a UUIDv7 row
with `phraseId: null`, `source: 'custom'`, and the `own*` fields; `toView()` renders it; undo
removes it by row id; and every `own*` field already has an `lww` merge policy. The remaining Import
work is the UI, validation/deduplication, downstream availability checks, persistence/sync
integration, and the optional translation path. Do not rebuild the identity or constructor layer in
this plan.

## Import (`P2-09`, `P2-10`)

### 1. Use the landed own-phrase path

Call the existing `addOwnPhrase({ es, en, theme?, emoji? })` seam. Its canonical source value is
`'custom'`, not `'own'`. Extend the draft so a missing translation is representable without
weakening the stored-row invariant: either resolve it in the review step or make absence explicit in
the domain model and every renderer.

### 2. What Import actually has to handle

A learner pasting real text, which is messier than a form:

- A phrase with no translation — offer one, do not require it. A phrase the learner does not
  understand yet is a legitimate thing to save.
- A whole paragraph pasted in — split into candidate phrases and let the learner pick, rather than
  storing a paragraph as one "phrase" that no engine can practise.
- Text that is not Spanish. Detect and say so; do not silently accept English as a Spanish phrase.
- A phrase already in the catalog. Offer the catalog version instead — it has audio, glosses, a
  hook, and reference data that a typed copy never will. This is the single highest-value behaviour
  in Import and the easiest to skip.
- Duplicates of the learner's own phrases.

### 3. Consequences for everything downstream

An own phrase has **no catalog row**, so it has no audio, no `syl`, no `f0_native`, no respelling,
and no cloze annotation. That is not a bug, but every consumer must handle it:

- Audio falls back to device TTS ([audio-playback-module.md](11-audio-playback-module.md)).
- The labs must report `unavailable` for it, per phrase
  ([labs-pronunciation-and-prosody.md](27-labs-pronunciation-and-prosody.md)).
- Cloze falls back to the derived selector
  ([select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md)).
- `toView`'s fallbacks (`'Mine'` theme, `'✍️'` emoji) already exist and should be checked against
  the blueprint's own presentation of own phrases.

Test each of those paths with an own phrase, because "works for catalog phrases" is the default
state of every feature built so far.

### 4. Persistence and sync

The `own*` merge classes already exist. Verify the local repository writes every field, an outbox op
contains them, and two devices converge on edits and deletion. This waits on the remaining wiring in
[sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md) and
[sync-client-loop.md](15-sync-client-loop.md); it is not a reason to block the local Import UI.

## Capture (`P2-15`, `AI-03`) — OCR → review → add

The blueprint's flow: photograph a menu or a sign, extract text, review, add.

### 1. OCR

On-device text recognition (`expo-camera` + platform ML/vision APIs). Photographs of text stay on
the device where possible — the privacy posture in ADR-0011 argues for on-device OCR even though the
printed promise is specifically about _recorded audio_. If any image leaves the device, that is a
decision to document, not to make implicitly.

### 2. Review before add — the essential step

OCR output from a photographed menu in bad light is often wrong, and a phrase added wrong is a
phrase practised wrong for weeks. So: show what was read, let the learner correct it, and require
confirmation. Never auto-add.

### 3. The AI assist (`AI-03`)

Translation, segmentation into phrases, and a suggested theme. Same discipline as the roleplay path
([screen-roleplay-and-ai.md](26-screen-roleplay-and-ai.md)):

- **A bundled fallback** — no provider means Capture still works, with the learner supplying the
  translation. AI is a garnish, never a dependency (`apps/api/src/ai/ai.service.ts:5`).
- **Validate the output** before it is shown, as the scene validator does.
- **Learner text is data, never instructions** — an OCR'd sign is untrusted input reaching a prompt,
  which is the clearest prompt-injection vector in the product.
- Cost controls and rate limits.

### 4. Camera permission

A denied camera permission leaves the Import path fully usable. Ask at the moment of use, with a
reason.

## Acceptance criteria

- Import creates own phrases that work end to end: stream, Refrain, detail, Progress, sync.
- A phrase that exists in the catalog is offered as the catalog version, with the difference
  explained.
- Non-Spanish input is flagged, not silently accepted.
- A pasted paragraph becomes selectable candidates, not one unusable row.
- Every own-phrase path degrades correctly: TTS audio, labs unavailable, derived cloze.
- `own*` fields have declared merge classes; two devices converge on an own phrase.
- Capture: OCR runs on device, output is reviewed before adding, and nothing is auto-added.
- Capture works with no AI provider, with the learner translating.
- OCR'd text can never reach a system prompt as instructions.
- Denied camera permission leaves Import fully usable.

## Tests

- Store tests for own-phrase creation, duplicate detection, and catalog-match suggestion.
- A matrix test running an own phrase through every consumer (audio, labs, cloze, sync, Progress).
- OCR fixtures: clean text, skewed, low light, mixed languages, handwriting.
- Prompt-injection fixtures through the AI assist.
- Language-detection tests including the ambiguous short-string case.

## Risks

- **OCR quality on real menus** is the product risk. Spike it with actual photographs before
  designing the flow around it; if accuracy is poor, the review step becomes the main interaction
  rather than a confirmation, and it should be designed as such.
- **Own phrases dilute the catalog's quality bar.** That is the learner's right, but the labs and
  cloze behaviours above are what keep it from feeling broken.

## Out of scope

Bulk import from a file or another app, and shared phrasebooks (M6).
