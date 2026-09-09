# Import phrases in v1; reviewed OCR Capture in v1.1

- **Requirement IDs:** `P2-07`, `P2-09`, `P2-10`, `P2-15`, `AI-03`
- **Milestone:** Import M2; Capture M3
- **Status:** 🟡 Own-phrase identity/store, language ownership and reviewed offline paste/file
  import exist. Paste review enforces 50 nonempty rows, 20,000 UTF-16 code units per batch and 2,000
  per persisted field through edit/save. Partial saves retain rejected/write-failed rows through
  storage recovery. Edited TSV, pair-scoped storage, browser file reading and request invalidation
  are implemented; native provider acceptance and OCR remain. OCR needs 58, optional translation
  76/86.
- **Depends on:** 56 input/navigation; 59 persistence; 58 camera/OCR substrate; 76/86 only for
  optional guarded text assistance.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 8; file import and durable draft recovery before OCR.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/src/store/phraseFactory.ts` and phrase actions already create stable learner-owned rows
with target and meaning language. Discover/Browse and tagging are built. Add now supplies local line
parsing, reviewed `.txt`/`.tsv` file selection, edit and durable accepted rows. Camera/OCR does not
exist. Plan 63 owns speech, not camera infrastructure; offline local import must not depend on live
AI.

## What already exists

UUIDv7 own-phrase rows, optional catalog identity, factory/store actions, and related tests exist.
Discover/Browse and the difficulty/tag sheet exist. This plan does not rebuild those paths.

## Remaining work

### Import

1. [x] Add bounded offline file selection/reading, supported format/encoding rules and cancellation.
       `.txt` and `.tsv` files decode strictly as UTF-8 within the review budget; format, byte and
       encoding failures leave existing input intact, and cancellation is inert. The result still
       enters the existing normalization, duplicate/field/batch validation and review UI. Web uses
       the picker-provided `File`; native uses its provider URI. Selection is request-scoped and
       stale results cannot replace an edited or switched pair.
2. [x] Extend recovery across relaunch with a local, course-bound draft checkpoint. Stable
       own-phrase ids and the existing transactional phrase/outbox write ensure a crash after a
       partial save can only leave the saved line as a duplicate review row, never create it twice.
       Saved rows leave the checkpoint; remaining edits persist. The checkpoint is device-local and
       excluded from sync. A different course does not consume it.
3. [ ] Treat translation/enrichment as optional asynchronous assistance; failure never blocks the
       local target-language phrase.

### Capture

4. [ ] Add camera permission and on-device OCR behind a native port. Denial/unavailability routes to
       Import with the learner's work preserved.
5. [ ] Show OCR text for correction before add; make cropping/rotation/multiple-lines explicit.
6. [ ] If AI translation is enabled, validate output, mark provenance, apply budgets, and never
       upload an image without a separately approved privacy contract.

### Delivered review limit slice (2026-09-09)

Paste review rejects an entire oversized batch before normalizing or rendering rows; it never
silently imports a prefix. The original text stays editable, and reducing it clears the warning.
CRLF, LF and CR line endings share the same row count and parsing. Preview, every edit and save
recheck the shared persisted field limit and total reviewed batch. Partial save removes only
committed rows; rejected and write-failed edits remain. `PersistenceGate` keeps hydrated routes
mounted behind its recovery modal, retaining the in-memory draft through a failed write/retry.
Parser, store/gate and browser regressions cover these paths. File decoding and durable draft
relaunch/retry now cover the local import boundary; OCR remains under the delivery order below.

## Acceptance criteria

- Import works fully offline and never creates a row without learner review.
- Duplicate/partial/oversize inputs are recoverable and cannot freeze the UI.
- Imported/captured phrases survive relaunch, sync safely, and use device-TTS fallback when needed.
- Camera denial has a tested, non-shaming Import fallback.

## Delivery order and gates

1. Deliver OCR separately after the 58 native permission harness is available; denial returns to
   Import without losing text. Optional text assistance from 76/86 must never gate offline import,
   and OCR images stay on device without a separately approved upload contract.

## Out of scope

Bulk catalog authoring, cloud image retention, handwriting promises, and automatic unreviewed adds.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, resolved import findings and remaining gates.
[Delivered slices](IMPLEMENTED-SLICES.md) are retained in the archive; this plan remains incomplete.
Earlier verification is dated evidence, not acceptance of the current combined branch.
