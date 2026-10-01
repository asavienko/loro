# Bilingual review records (F-08)

This directory holds review records: the exact material a bilingual reviewer saw, with their
findings and sign-off. None exists yet, so the release gate fails.

## What the export contains

```bash
pnpm --silent --filter @loro/content review:export > /tmp/loro-review.json
```

The packet (`src/reviewPacket.ts`) holds:

- `ui`: the app's interface strings, `apps/mobile/src/shared/copy/{en,bg,ru}.ts`, as written;
- `courses`: the seven pairs from `loadLearningCatalog`, the first app's Spanish catalog and its
  starter translations (not the `v2/` seed the app is served);
- `topics`: the bundled topic suggestions.

Each entry is identified by a SHA-256 of its JSON, and the packet by a combined `materialSha256`.
The digests identify content, not a reviewer or an approval. Exporting twice from the same source
gives the same digests; the exporter writes only to stdout and invents no dates, reviewers or
findings. It cannot show layout, speech or device behaviour.

## Recording a review

1. Save the packet here as `<materialSha256>.json` before assigning it, keeping its resources,
   catalogs and digests. Commit it alongside the fixes it leads to.
2. Give each locale or pair to an independent bilingual reviewer. In its `review`, record the real
   `reviewer`, `reviewerLanguages`, `reviewedAt` (an ISO date), `findings` and `signOffEvidence` (a
   durable reference to the review). `status` is `pending`, `changes-requested` or `approved`, as
   the review justifies.
3. `reviewerLanguages` uses `en`, `bg`, `ru` and `es`. An interface record must cover English and
   its own language, a course record its native and target languages, and a topic record all four.
4. A finding names a resource key or a phrase, pack or scenario id, the issue, the proposed
   correction and its resolution. Missing teaching fields must be considered explicitly: approving a
   translation does not supply missing pronunciation teaching.
5. Review ICU placeholders and plurals, naturalness, tone, Cyrillic, target text, native meanings,
   teaching guidance and cultural adaptations. Check the rendered screens, including at 200% and
   310% text, separately.
6. After fixes, export again. A changed digest needs review of the changed material; keep the old
   record and never copy an approval onto a new digest without the reviewer's confirmation.

## The release gate

```bash
pnpm --filter @loro/content check:release
```

It exports the current material, loads only the record named after its digest, and fails on a
missing record, a stale digest, an entry that is not approved, or an incomplete reviewer or sign-off
field. Nothing runs it automatically. Who reviews, and when, is open question
[Q-23](../../../docs/decisions/open-questions.md#q-23).
