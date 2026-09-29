# v2.0 prototype stress fixture

- **Requirement IDs:** `P3-01`, `F-03`, `F-04`
- **Milestone:** Design exploration (v2.0 app); no app release depends on it
- **Status:** — Ready. Requested in round 3 of the prototype review (item 65: "will be implemented
  later, create a plan for this"). Nothing is built yet.
- **Depends on:** nothing new. The web prototype this was written for became the app on 2026-09-30;
  the fixture now works against `apps/mobile/src/shared/` (content, state, selectors) and the app on
  the web (`pnpm --filter @loro/mobile web`).
- **Number allocation:** the highest assigned ID was 101; this plan is **102**. The next new plan
  is 103.

## Outcome

The prototype can be run and tested against a catalog about 20× its bundled size (30 sets, about 500
phrases) and a year of synthetic listening history, to find where scheduling, search, layout and
storage stop scaling, before any of its decisions move toward the app.

## Why

The bundled content is 8 sets and 34 phrases. At that size every list fits on screen, every selector
is instant, and the review log stays small. The prototype derives memory and points by replaying the
log through the WASM core, keeps the whole state in localStorage (about 5 MB), and renders lists
without virtualisation. None of that has been tested at scale.

## Scope

1. **Generator** — `scripts/stress-fixture.mjs` writes `src/content/fixture/*.json` in the same
   schema as the real content (validated by the same zod schema and `contentProblems`). Phrases are
   clearly synthetic ("Frase de prueba 0412"), never plausible language, so no fake linguistic
   content can leak into review.
2. **History** — the generator can also write a learner state with N months of `heard` and `rated`
   log entries, at realistic times, from a seeded PRNG.
3. **Switch** — `?fixture=stress` (dev only) loads the fixture instead of the bundled content and
   uses a separate storage key, so real progress is never touched.
4. **Measurements** — record, in this plan, on a mid-range Android phone and desktop Chrome:
   - time for `derive(log)` from cold and after one appended entry;
   - Home, Explore search and Library render times;
   - serialized state size, and time to save;
   - scroll smoothness of a 100-phrase set page and a 200-item queue.
5. **Follow-ups decided by the numbers** — only if a measurement fails its budget: IndexedDB for the
   log, list virtualisation, log compaction (per-key snapshots), memoised search index.

## Budgets

| Measurement                           | Budget                           |
| ------------------------------------- | -------------------------------- |
| `derive` from cold, 1 year of history | < 150 ms desktop, < 500 ms phone |
| `derive` after one appended entry     | < 5 ms                           |
| Explore keystroke to results          | < 50 ms                          |
| Saved state                           | < 2 MB                           |

## Acceptance

- The fixture passes the content validation unchanged.
- The Playwright suite runs green against the fixture (`FIXTURE=stress npm run test:e2e`).
- The measurements table is filled in here, with device names and dates.
- Real content and real progress are untouched when the switch is off.

## Out of scope

Real linguistic content, the production app, sync servers.
