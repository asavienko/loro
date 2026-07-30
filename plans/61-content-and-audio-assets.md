# Versioned content and audio asset pipeline

- **Requirement IDs:** content targets for M1/M2/M3, `AS-01`, `AS-02`, `P2-12`, `P2-32`, `P2-33`,
  `AS-05`, `AS-06`
- **Milestone:** M1 → M3
- **Status:** Blocked on the licensed voice/TTS provider and source decision
- **Depends on:** plan 53 ✅ content cleanup

## Outcome

Content ships as signed/versioned manifests with production audio and reference artifacts, scales
from 31 to 150 then 600 validated phrases, and can update independently without overwriting learner
state.

## Work

1. Decide voice provenance, licensing, consent, pronunciation review, provider fallback, regional
   storage, and deletion obligations. Record the decision before bulk rendering.
2. Define immutable asset IDs, hashes, codecs, loudness/rate metadata, pack/version manifests,
   ETags, signatures, compatibility, rollback, and retention.
3. Build the authoring pipeline for validation, enrichment, translation review, TTS/render intake,
   audio normalization, reference feature generation, human QA, and publication.
4. Build the client catalog updater/storage/prefetch contract with atomic activation and safe
   fallback to the bundled seed.
5. Produce a small end-to-end seed batch before bulk work; then reach 150 and 600 with the
   documented ten-point content quality bar and independent review.
6. Generate pronunciation/prosody reference data only from approved source audio and keep raw
   learner recordings out of the pipeline.

## Acceptance criteria

- A bad, partial, unsigned, incompatible, or rolled-back pack cannot replace the last good pack.
- Every production phrase has verified text, metadata, audio ownership, checksums, and fallback.
- Content update changes catalog/assets without requiring an app release or mutating learner rows.
- The pipeline is reproducible, budgeted, and reports per-check quality failures.

## Out of scope

Playback implementation, live learner TTS endpoint, UI translation, and DSP scoring.
