# Twenty-plan implementation review — 2026-09-09

**Requirement:** F-04, with the feature requirements retained in each owning plan. **Reviewed
range:** `6776cb2..b0e389f` on `codex/F-04-next-plan-review`. **Verdict:** Changes requested. Useful
foundations landed for all 20 selected plans, but none of these deliveries completes its whole plan.
Keep their partial statuses and named acceptance gates. This review changes documentation only;
runtime fixes and commit-history changes are outstanding.

## Follow-up implemented — 2026-09-09

The locally actionable findings below are now addressed on this branch. Import review shares the
2,000 UTF-16-code-unit persisted field bound, revalidates every edit and reviewed batch before a
write, and keeps rejected draft text visible. The normal local check runs the hardware-free native
evidence fixtures; full local CI runs a separate pseudo-locale browser server. More now consumes
shared built-destination route policy and renders authored groups. Review release checks require a
current-material record with complete attributable approvals. Workbench export discovery recurses
through supported source files and named barrel exports. Native evidence requires a retained Git
revision in its manifest.

The review does not fabricate the external evidence its findings called for: bilingual reviewers, a
physical-device/iOS scenario run, an isolated PostgreSQL restore, and off-host retained backups
remain explicit plan 58/87/88 acceptance gates. Content delivery still needs its separate client
activation and API-wire reconciliation under plan 61.

## Required changes

### R1 — P2: enforce field and batch limits throughout import review

**Owner:** [65](../../plans/archive/2026-09-09/65-import-and-capture.md), with 68 for sync/recovery
coverage. **Locations:** `apps/mobile/src/lib/importPhrases.ts:10–16,35–71`,
`apps/mobile/app/add.tsx:567–596`, `packages/core/src/api/sync.ts:33–51`.

The new 20,000-character/50-row guard runs only when the original pasted batch is previewed. The
edit path calls `reviewImportedCandidates` without that guard. A learner can preview a short phrase,
paste 20,001 characters into its review field, and still receive `issue: null` with Add enabled.
Even an original batch below the new cap can contain a 2,001-character phrase or meaning; the sync
contract permits only 2,000 for each field.

The current parser accepts such a phrase, while `userPhraseValues.ownEs.safeParse` rejects it. Local
writes can consequently create an outbox operation that the sync client's existing
`LOCAL_VALIDATION_FAILED` quarantine path cannot upload. This review reproduced the parser/schema
mismatch, not a live multi-device run. The missing per-field guard predates this batch; the new
bounded-import slice does not close it, and its edit path bypasses the newly advertised bound.

**Change:** share the persisted text limits with import validation; enforce them on preview, every
edit, and immediately before save. Recheck the total reviewed batch too. Keep the original text
editable, show a field-specific error, and never silently truncate it. Define whether the UI's word
“characters” means UTF-16 units or a user-perceived character count; current `.length` counts UTF-16
units.

**Acceptance:** cover 2,000/2,001-unit target and meaning fields, a valid row edited over the limit,
several edits that together exceed the batch limit, and emoji/combining text. Prove a valid accepted
draft survives real SQLite persistence and sync encoding. Rejected drafts must not append outbox
work, and correction must recover without losing the draft.

### R2 — P2: fix the four commit subjects before the full CI gate

**Owner:** integration / [72](../../plans/72-release-quality-gates.md). **Locations:** subjects of
`b389109`, `bbe2f16`, `77f417d`, `b0e389f`; `scripts/ci-local.sh:54–57` and `commitlint.config.cjs`.

All four new subjects end in uppercase `(F-04)`. The repository requires lowercase subjects. The
read-only check `pnpm exec commitlint --from 6776cb2 --to HEAD` failed for all four with
`subject must be lower-case [subject-case]`. Thus the earlier passing fast/browser checks do not
establish a passing full local CI run with a base ref.

**Change:** use `(f-04)` in the subjects while retaining canonical uppercase requirement IDs in
documentation. Coordinate any history rewrite with the actual branch publication state; adding a new
lowercase commit does not repair the earlier subjects. No history was rewritten in this review.

**Acceptance:** the same range check passes after correction; then run the full local CI gate with
its base ref. Preserve the policy that GitHub Actions remains disabled.

### R3 — P2: correct completion and screen-inventory claims

**Owner:** [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md),
[81](../../plans/81-navigation-spine-switcher-and-more.md), and integration documentation.
**Locations at reviewed HEAD:** `CLAUDE.md:9–19`, `apps/mobile/src/lib/navigation.ts:36`,
`docs/design/screen-catalog.md:198–207`.

The previous handoff says the selected plans were implemented, although their own status records
correctly leave substantial work open. It should say “implemented one bounded slice per selected
plan.” In particular, the new Review module is a candidate partition, the iOS command collects
simulator artifacts, the consent slice has no Settings control, and the English change adds no
English target course.

More is declared `kind: 'utility'`; it does not increase the eight implemented authored learner
screens to nine. `CLAUDE.md` nevertheless changed the count to nine while retaining “other 15.”
Conversely, the screen catalog still says `/more` has no state behind it.

**Documentation corrected in this review:** restore eight learner screens, identify More as a
utility, update the shell inventory, and link this review from both indexes. Whole-plan completion
remains open. Future completion claims must identify the accepted slice and the evidence that closes
its remaining criteria.

## Improvements to schedule

These are follow-up improvements or explicitly unfinished acceptance work, rather than claims that
every item is a newly introduced runtime regression.

### I1 — automate the new quality tools in the appropriate local gates

`test:native:evidence` exists in `package.json`, but neither `check` nor `ci:local` invokes it. The
new collector fixtures therefore depend on somebody remembering a separate command. Add the
hardware-free fixture suite to the normal gate; keep actual simulator/device runs separate.

The pseudo-locale browser case is skipped unless `EXPO_PUBLIC_PSEUDO_LOCALE=1`, and the local CI
runner never sets that flag. Add a dedicated pseudo-locale command with its own development server,
port and output directory, then make the appropriate local release gate run it. Run only the
pseudo-compatible suite with that flag; existing English-name locators should keep their normal
server. Preserve the explicit production-disable test and expand to the remaining state/text-scale
matrix before claiming layout acceptance. Owners: 58/72.

### I2 — finish route policy before extending More independently

The new More route correctly derives its rows from `DESTINATIONS`, but the authored
`Navigation.dc.html:494–496` calls for grouped recent/phrase/practice/account destinations, useful
counts and search. Plan 56 still lacks the metadata needed by those consumers. Add the shared route
class, parent/home, group, availability and exit/resume metadata first; then consume it in More, the
switcher, deep links and state coverage. Keep unbuilt destinations hidden and avoid a second
independent navigation table. Owners: 56/81.

### I3 — prove restore and artifact identity before accepting operational evidence

The backup collector's lock, archive-read pass, checksums and atomic directory publication are
useful. Its tests stub Docker; they do not restore PostgreSQL data. Before calling it a recovery
solution, restore into an isolated database and verify ownership/grants, migrations, accounts and
tenant isolation against the recorded image. Add verified off-host retention and scheduling under
plan 88's existing operational scope.

The iOS manifest deliberately has `artifactRevision: null` and captures whatever screen is currently
visible. Bind evidence to a retained build identity and explicit scenario results before using it to
close native acceptance. Screenshots and mock command tests cannot substitute for an app build or
physical-device speech/lifecycle evidence. Owners: 58/88.

### I4 — connect review and delivery evidence to the actual shipped material

`reviewPacket.ts` exports useful deterministic UI/catalog material, but no release command consumes
its review records. `releaseCheck.ts` still checks the starter's review-status flag alone. The
review-record README correctly marks digest/sign-off enforcement as future work. Before reviewed
content can ship, validate attributable sign-off records against the exact material digest and
reject missing, stale or incomplete approvals. This is a code integration step in addition to
obtaining human review; no approval can be inferred from a generated packet. Owners: 87/61/72.

The standalone signed delivery verifier and the current API wire contract still need reconciliation
and a transactional client activation path. Do not build a downloader around incompatible manifest
types or mark verification alone as independent content delivery. Owner: 61.

### I5 — make the component-export drift guard cover supported export forms

`apps/mobile/src/dev-tools/specimens.test.ts:15–46` scans only immediate `.tsx` files and exported
declarations. A component declared locally and exported with `export { Component }`, a nested
component module, or an aliased barrel export can escape that scan. Define supported export forms,
then either resolve them recursively or enforce the restricted convention. Add negative fixtures for
an omitted direct export, a named export statement and a nested export. Retain rendered versus
interaction-owned disclosure and continue the multilingual/long-copy state matrix. Owner: 80.

## Next work for each selected plan

The owning plans remain authoritative. This table sequences follow-up work without replacing or
renumbering them. A named external gate blocks only its dependent slice.

| Plan                                                                          | Delivered in the reviewed range                             | Next implementation or acceptance work                                                                                                   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [58](../../plans/archive/2026-09-09/58-native-workspace-and-device-ci.md)     | iOS simulator artifact collector                            | Automate fixtures (I1); correlate build identity, run clean iOS build and device scenarios (I3).                                         |
| [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md) | Route/file/state ownership gate                             | Add shared route laws/metadata, then recovery, keyboard and list behavior; feed 81 (I2).                                                 |
| [57](../../plans/archive/2026-09-09/57-runtime-design-system.md)              | Shared tabular numerals and browser geometry check          | Establish font provenance/loading and native numeric rendering; implement remaining motion, haptics and theme APIs.                      |
| [72](../../plans/72-release-quality-gates.md)                                 | Development pseudo-locale and fixture drift check           | Repair commit validation (R2), automate dedicated pseudo/device-fixture gates (I1), then complete layout/native/performance evidence.    |
| [66](../../plans/66-backend-contract-data-and-security.md)                    | Shared content-v2 schemas/query validation/OpenAPI          | Migrate remaining legacy content/AI boundaries; validate PostgreSQL and exact API image/security/load behavior.                          |
| [88](../../plans/88-low-cost-backend-infrastructure.md)                       | Verified local backup preparation                           | Prove isolated restore, then verified off-host storage, retention and monitoring (I3).                                                   |
| [86](../../plans/86-provider-integrations.md)                                 | Per-Anthropic-instance concurrency admission                | Supply a shared provider-pool lifetime and owning feature integration; add account limits/spend reservation before live use.             |
| [87](../../plans/87-multilingual-app-and-language-selection.md)               | Three-locale/seven-pair review packet                       | Obtain real bilingual reviews and implement exact-digest sign-off validation (I4).                                                       |
| [90](../../plans/90-default-english-content-language.md)                      | Existing sync schemas derive language IDs from the registry | Resolve canonical English dialect, then add registry/catalog/default/migration integration; release needs reviewed content.              |
| [81](../../plans/81-navigation-spine-switcher-and-more.md)                    | Initial More destination list                               | Consume 56 metadata for grouping/search; implement exits/resume/ongoing work; audio depends on 62 (I2).                                  |
| [71](../../plans/71-settings-telemetry-and-experiments.md)                    | Transactional local analytics consent, default off          | Add Settings UI, then consent-aware queue/transport and revocation behavior; Q-05 applies to experiment activation.                      |
| [67](../../plans/67-anonymous-auth-and-account-lifecycle.md)                  | Email auth in-flight guards                                 | Resolve lifecycle/recovery policy, then linking/export/erasure and provider/device acceptance.                                           |
| [68](../../plans/68-sync-and-offline-convergence.md)                          | Bounded expired-cursor recovery and SQLite histories        | Define retention/rescue and review-compensation semantics; implement OS scheduling and device/load convergence proof.                    |
| [61](../../plans/archive/2026-09-09/61-content-and-audio-assets.md)           | Malformed-input and semantic-version verifier hardening     | Reconcile signed wire/trust policy and transactional client activation (I4); Q-15 gates production audio assets.                         |
| [62](../../plans/archive/2026-09-09/62-native-audio-playback.md)              | Cancel queued native commands before execution              | Implement recorded asset/cache/transport and shared native clock/buffer ownership; validate background/interruption behavior.            |
| [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md)    | Reject malformed native speech metadata                     | Integrate 62 clock/buffer substrate for measured onset, then target/model/permission/device acceptance; retain null for unknown latency. |
| [64](../../plans/archive/2026-09-09/64-today-and-refrain-production-loop.md)  | Focused/foreground minute and day refresh                   | Implement timed wave enforcement, filtered drills/banked tail and actual audible orchestration; Q-14 owns peak sign-off.                 |
| [75](../../plans/75-review-and-memory.md)                                     | Review candidate partition and tag-focus policy             | Implement engine and durable grade/session/resume contracts, then routes and real Memory curves; Undo needs 68 compensation semantics.   |
| [65](../../plans/archive/2026-09-09/65-import-and-capture.md)                 | Paste batch caps and recoverable preview error              | Fix R1 first; then file/encoding handling and batch-write recovery; native OCR remains a later slice.                                    |
| [80](../../plans/80-dev-design-system-workbench.md)                           | 33 declared component exports and new specimens             | Close export-discovery gaps (I5), then real multilingual/long-copy and production-state coverage.                                        |

## Verification and limits

Fresh review checks at `b0e389f`:

- Inspected the implementation diff, relevant callers, current schemas and navigation design.
- Ran commitlint for the four-commit range: **failed for all four subjects** (R2).
- Executed a dependency-local parser/schema probe: the 2,001-unit phrase was accepted by import and
  rejected by sync; an edited 20,001-unit phrase also returned no review issue (R1).
- Checked local gate wiring and compared completion claims with source and plan status.
- After documentation edits, `pnpm check` passed (23 Turbo tasks, all cached; route/deployment
  checks also passed). Report formatting, all 24 relative links and diff whitespace checks passed.
  This fast gate does not include the failing commitlint range check above.

The preceding implementation run reported `pnpm check` with 23 successful tasks, learner E2E 165
passed/one opt-in pseudo case skipped, workbench 5 passed, and production browser 4 passed. Its
separate pseudo-locale smoke also passed. Those are retained observations from that run, not new
browser/device results from this review. The fast API suite skipped 35 database-dependent tests; an
isolated PostgreSQL run and full `ci:local` result were not established by that evidence.

No deployment, provider request, device run or runtime code fix was performed in this review. The
recommended order is R1/R2, then the missing local gates and R3 consistency, then the per-plan
dependency work above. Closing this review does not automatically close the plans' release gates.
