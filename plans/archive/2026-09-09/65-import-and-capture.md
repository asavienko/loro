# Import phrases in v1; reviewed OCR Capture in v1.1

- **Requirement IDs:** `P2-07`, `P2-09`, `P2-10`, `P2-15`, `AI-03`
- **Milestone:** Import M2; Capture M3
- **Status:** 🟡 Own-phrase identity/store, language ownership and reviewed offline paste import
  exist. File import and OCR remain; OCR needs 58, and optional translation needs 76/86.
- **Depends on:** 56 input/navigation; 59 persistence; 58 camera/OCR substrate; 76/86 only for
  optional guarded text assistance.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/src/store/phraseFactory.ts` and phrase actions already create stable learner-owned rows
with target and meaning language. Discover/Browse and tagging are built. Add now supplies local line
parsing, review/edit and durable accepted rows; file input and camera/OCR do not exist. Plan 63 owns
speech, not camera infrastructure; offline local import must not depend on live AI.

## What already exists

UUIDv7 own-phrase rows, optional catalog identity, factory/store actions, and related tests exist.
Discover/Browse and the difficulty/tag sheet exist. This plan does not rebuild those paths.

## Remaining work

### Import

1. [ ] Add file input and extend the implemented paste parser/review with normalization, limits,
       duplicate review and invalid-row feedback before writing.
2. [ ] Preserve the selected target and personal meaning language on every reviewed row. Persist
       every accepted phrase locally with stable ownership and outbox records; make it available
       immediately to detail, Stream, Today, search, tags, and audio fallback.
3. [ ] Treat translation/enrichment as optional asynchronous assistance; failure never blocks the
       local target-language phrase.

### Capture

4. [ ] Add camera permission and on-device OCR behind a native port. Denial/unavailability routes to
       Import with the learner's work preserved.
5. [ ] Show OCR text for correction before add; make cropping/rotation/multiple-lines explicit.
6. [ ] If AI translation is enabled, validate output, mark provenance, apply budgets, and never
       upload an image without a separately approved privacy contract.

## Acceptance criteria

- Import works fully offline and never creates a row without learner review.
- Duplicate/partial/oversize inputs are recoverable and cannot freeze the UI.
- Imported/captured phrases survive relaunch, sync safely, and use device-TTS fallback when needed.
- Camera denial has a tested, non-shaming Import fallback.

## Delivery order and gates

1. Extend the shipped paste-review path with bounded offline file input, encoding/format errors,
   duplicate review and cancellation. Reuse the phrase factory and 59 transaction/outbox boundary.
2. Preserve reviewed target/meaning language and stable identities across retry, partial acceptance
   and relaunch. Define the batch/recovery boundary before writes so retry cannot duplicate rows.
3. Deliver OCR separately after the 58 native permission harness is available; denial returns to
   Import without losing text. Optional text assistance from 76/86 must never gate offline import,
   and OCR images stay on device without a separately approved upload contract.

## Out of scope

Bulk catalog authoring, cloud image retention, handwriting promises, and automatic unreviewed adds.
