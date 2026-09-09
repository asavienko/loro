# Bilingual review records (F-08, plan 87)

Export the exact bundled UI and runtime catalog material before independent review:

```bash
pnpm --silent --filter @loro/content review:export > /tmp/loro-review.json
```

The packet includes all three UI resources and all seven supported course pairs, including the
legacy English/Spanish pair. Catalogs come from `loadLearningCatalog`, so reviewers see runtime
adaptations, localized labels, translations and teaching fields, including absent teaching fields. A
raw starter translation review alone misses these differences.

Each entry identifies its material with SHA-256 over the UTF-8 JSON serialization; the packet also
has a combined material digest. These digests identify content, not reviewer identity or approval.
Export twice without source changes to obtain the same identifiers. No date is generated and no
reviewer or linguistic findings are invented. The exporter writes only to stdout.

1. Copy the exported packet here as `<materialSha256>.json` before assigning it to reviewers.
   Preserve its resources, catalogs and digest fields. Keep the record in git alongside the eventual
   fixes.
2. Assign each locale/pair to an independent bilingual reviewer. In its `review`, record the real
   `reviewer`, `reviewerLanguages`, `reviewedAt` (ISO date), `findings` and `signOffEvidence` (a
   durable review reference). Use status `pending`, `changes-requested`, or `approved` only as
   justified by that review. Findings should identify a resource key or phrase/pack/scenario id, the
   issue, proposed correction and resolution. Missing teaching fields must be explicitly considered;
   approval of translations does not supply missing pronunciation teaching.
3. Review ICU placeholders/plurals, naturalness, tone, Cyrillic, target text, native meanings,
   teaching guidance and cultural adaptations. Check rendered context and 200%/310% text separately;
   this JSON export cannot establish layout, speech or device behavior.
4. After fixes, export new material. Retain the old record; a changed digest requires review of the
   changed material. Never copy old approval onto a new digest without actual reviewer confirmation.
5. Hand attributable approvals and exact artifacts to plans 61/72. Run
   `pnpm --filter @loro/content check:release`; it loads only the record named after the current
   material digest and rejects stale digests, missing entry approvals and incomplete
   reviewer/sign-off fields. It remains blocked until real bilingual review records exist.

The exporter does not consume sign-offs or relax the release gate. The release check verifies the
supplied evidence against the exact shipped material before changing release status. Actual reviewer
coordination and all-pair physical-device acceptance remain outstanding.
