# Versioned content and audio asset pipeline

- **Requirement IDs:** content targets for M1/M2/M3, `AS-01`, `AS-02`, `P2-12`, `P2-32`, `P2-33`,
  `AS-05`, `AS-06`
- **Milestone:** M1 → M3
- **Status:** 🟡 Validated starter catalogs and content API contracts exist. Delivery/updater,
  reviewed expansion and production audio remain; Q-15 blocks production audio only, bilingual
  sign-off is coordinated by 87. Asset/update contract work can start now.
- **Depends on:** 53/85 completed; 59 for client atomic activation; 86 for provider/storage
  adapters; 87 for bilingual review.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`packages/content/` supplies 31-phrase es-ES/bg-BG/ru-RU starters and neutral learning catalogs;
`releaseCheck.ts` rejects pending bilingual review. Independent publication, client activation and
approved audio do not exist. Preserve the old English/Spanish API as a compatibility adapter; use
plan 85's delivered content schemas for the new pipeline.

## Outcome

Content ships as signed/versioned manifests with production audio and reference artifacts, scales
from the three 31-phrase starters to the approved release catalog, and can update independently
without overwriting learner state.

## Remaining work

1. [ ] Decide voice provenance, licensing, consent, pronunciation review, provider fallback,
       regional storage, and deletion obligations. Record the decision before bulk rendering.
2. [ ] Define immutable asset IDs, hashes, codecs, loudness/rate metadata, pack/version manifests,
       ETags, signatures, compatibility, rollback, and retention.
3. [ ] Build the authoring pipeline for validation, enrichment, translation review, TTS/render
       intake, audio normalization, reference feature generation, human QA, and publication.
4. [ ] Build the client catalog updater/storage/prefetch contract with atomic activation and safe
       fallback to the bundled seed.
5. [ ] Produce an approved es-ES seed batch before bulk work; preserve the existing 150→600 Spanish
       milestone target. Record separately approved bg-BG/ru-RU expansion and voice coverage rather
       than silently multiplying that target. Plan 87 owns starter bilingual sign-off; expanded
       content uses the same ten-point quality bar and independent review.
6. [ ] Generate pronunciation/prosody reference data only from approved source audio and keep raw
       learner recordings out of the pipeline.

## Acceptance criteria

- A bad, partial, unsigned, incompatible, or rolled-back pack cannot replace the last good pack.
- Every production phrase has verified text, metadata, audio ownership, checksums, and fallback.
- Content update changes catalog/assets without requiring an app release or mutating learner rows.
- The pipeline is reproducible, budgeted, and reports per-check quality failures.

## Out of scope

Playback implementation, live learner TTS endpoint, UI translation, and DSP scoring.
