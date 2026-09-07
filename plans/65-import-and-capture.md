# Import phrases in v1; reviewed OCR Capture in v1.1

- **Requirement IDs:** `P2-07`, `P2-09`, `P2-10`, `P2-15`, `AI-03`
- **Milestone:** Import M2; Capture M3
- **Status:** 🟡 Own-phrase identity/store and language ownership exist. Import and OCR surfaces
  remain; durable Import needs 56/59, OCR needs 58, and optional translation needs 76/86.
- **Depends on:** 56 input/navigation; 59 persistence; 58 camera/OCR substrate; 76/86 only for
  optional guarded text assistance.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/mobile/src/store/phraseFactory.ts` and phrase actions already create stable learner-owned rows
with target and meaning language. Discover/Browse and tagging are built. No Import parser/route or
camera/OCR module exists. Plan 63 owns speech, not camera infrastructure; offline local import must
not depend on live AI.

## What already exists

UUIDv7 own-phrase rows, optional catalog identity, factory/store actions, and related tests exist.
Discover/Browse and the difficulty/tag sheet exist. This plan does not rebuild those paths.

## Remaining work

### Import

1. [ ] Add paste/file input, local line parsing, normalization, limits, duplicate review,
       invalid-row feedback, and a preview/edit step before writing.
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

## Out of scope

Bulk catalog authoring, cloud image retention, handwriting promises, and automatic unreviewed adds.
