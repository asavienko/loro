# Twenty-plan follow-up code review — 2026-09-09

**Requirement:** F-04, P2-09/P2-10, F-08.  
**Branch:** `codex/F-04-next-plan-review`.  
**Reviewed HEAD:** `eb0c36bfc26b7db5f7861f2815ed61de8b0f3f9c`.  
**Comparison:** local `origin/main` at `42f4d574dc1b798714b04848714d2a5693b8bf1f` through reviewed
HEAD. No remote refresh was performed.  
**Verdict at review:** Changes requested — three P2 findings remained.

This is a second review of the twenty-plan implementation and its remediation, with particular
attention to the fixes claimed in the [first review](2026-09-09-twenty-plan-implementation.md). The
review inspected the branch diff and relevant callers, tests and contracts across import,
navigation, content delivery/review, persistence/consent, provider admission, speech, and local
quality/evidence tooling. The concrete findings below were reproduced. This review adds
documentation; it does not implement the fixes or claim whole-plan acceptance.

## Follow-up implemented — 2026-09-09

The three locally actionable findings are implemented on this branch. A partial import save now
removes only rows that committed successfully, preserving rejected and write-failed rows with their
edits for correction. Review-record validation recomputes each retained UI/catalog digest, verifies
UI/course identity and combined material identity, and requires declared reviewer-language coverage
for each entry. The implementation adds focused unit and browser regression coverage. Final local CI
remains the integration gate; real bilingual reviewer evidence remains a separate acceptance
requirement.

## Findings

### R1 — P2: preserve rejected import rows after saving valid rows

**Location:** [apps/mobile/app/add.tsx:605](../../apps/mobile/app/add.tsx#L605), especially lines
612–613. **Owner:** plan 65; P2-09/P2-10. **Classification:** unresolved recovery behavior in the
touched save flow, rather than a claim that clearing drafts first appeared in this branch.

`save()` persists only `acceptedChecked`, but then clears both `input` and the entire `review`. If a
batch contains one valid phrase and an incomplete, duplicate or over-limit row, pressing “Add 1
reviewed phrase” also discards the rejected row and any edits made to it. The learner cannot correct
that row after saving the valid subset. This contradicts the remediation's claim that rejected draft
text stays visible and the original R1 acceptance requirement to recover without losing the draft.

**Reproduction:** in the browser, import `Hola nueva | New hello` followed by an incomplete second
line. Edit the second target to `Edited draft that must survive`, leaving its meaning empty. Save
the one valid row. The stream count increases from 10 to 11, but the import input is empty and the
second review field no longer exists. A temporary Playwright probe confirmed this exact behavior.
The existing mixed-validity E2E checks the successful addition and a later duplicate; it does not
assert survival of rejected work.

**Required change:** remove only successfully persisted candidates from the review. Keep rejected
rows and their edited values available, revalidate them against the updated collection, and clear
the whole draft only when no work remains or the learner explicitly discards it. Preserve the same
rule if a later write in the batch fails.

**Regression acceptance:** mix a valid row with invalid, duplicate and over-limit rows; edit
rejected text, save the valid subset, and verify the remaining text is unchanged. Correct one
retained row and save it without re-adding the first row. Assert rejected rows do not create
persistence/outbox work. Include a write-failure case with explicit saved/remaining state.

### R2 — P2: verify the review packet's contents and identities, not only its digest fields

**Location:**
[packages/content/src/reviewRecords.ts:38](../../packages/content/src/reviewRecords.ts#L38),
especially lines 42–45; combined check at lines 65–69. **Owner:** plans 87/61/72; F-08.

`exactEntries()` compares the supplied `sha256` string with the current packet's string, but never
hashes the saved `resources` or `catalog`. It also ignores `locale`, `nativeLanguage` and
`targetLocale`. The combined digest comparison similarly trusts the supplied label. Consequently, a
saved packet whose review material or course identity was edited while its hash fields were retained
still passes the release validator. The gate cannot establish that the material in the retained
review record is the material being shipped.

**Reproduction:** create a current packet with synthetic approval metadata, replace the first UI
entry's resources with `{ "unrelated": "Material never shipped" }`, empty the first course's phrase
array, and change that course's native language to `ru`. Retain the digest strings.
`validateReviewRecord(currentPacket, changedRecord)` returns successfully. These are test-only
records; no real approval record was created or modified.

**Required change:** validate record structure and entry identities, recompute each digest from the
retained resources/catalog with the exporter's serialization rules, and compare both identity and
digest against current material. Recompute or otherwise validate the combined identity too. If
records are intended to be digest-only attestations instead, make that a distinct explicit schema
and workflow; the current documented workflow retains the full material for review.

**Regression acceptance:** unchanged approved material passes. Mutating a resource value, catalog
phrase, locale or course pair while leaving all hash labels unchanged must fail. Missing payloads,
duplicated identities and stale payloads paired with current hash labels must also fail.

### R3 — P2: require the declared reviewer languages to cover the material

**Location:**
[packages/content/src/reviewRecords.ts:27](../../packages/content/src/reviewRecords.ts#L27), lines
27–29 and the call at line 45. **Owner:** plan 87; F-08.

Approval currently requires only a nonempty array of nonempty strings in `reviewerLanguages`. It
never checks whether those languages cover the reviewed UI locale or both sides of a course pair. An
approval that explicitly declares only English therefore satisfies every Bulgarian, Russian and
Spanish course entry. Even unknown language strings meet the current condition. This accepts
evidence that does not meet the documented bilingual-review requirement.

**Reproduction:** replace `reviewerLanguages` with `["en"]` on all entries in an otherwise current
approved test packet. `validateReviewRecord` accepts all three UI locales and all seven course
pairs. The existing positive test similarly applies an `en`/`bg` reviewer to every entry, including
Russian and Spanish material.

**Required change:** define supported language identifiers for reviewers and pass the material's
identity into approval validation. Require each course approval to cover its native and target
languages, using an explicit mapping between target locales and language identifiers. Require UI
review evidence to cover its locale and the source language where the workflow requires it. This
verifies the declared evidence; actual reviewer identity and competence still need human sign-off.

**Regression acceptance:** an English-only reviewer fails Bulgarian/Russian UI and nonmatching
course approvals; an English/Bulgarian reviewer passes the corresponding pair and fails a
Russian/Spanish pair. Reject unknown or blank identifiers. Use per-entry reviewer-language fixtures
in the positive test.

## Verification performed in this review

- Fresh `pnpm check` after the review — **23 successful tasks**. Report formatting and diff
  whitespace checks also passed.
- Fresh content tests:
  `pnpm --filter @loro/content exec vitest run src/reviewPacket.test.ts src/delivery.test.ts` — **33
  passed**.
- Fresh mobile tests:
  `pnpm --filter @loro/mobile exec vitest run src/lib/importPhrases.test.ts src/lib/navigation.test.ts src/dev-tools/specimens.test.ts`
  — **16 passed**.
- Direct TypeScript validator probes: baseline accepted; changed review payload/identity accepted;
  English-only approval for all entries accepted. The latter two successes reproduce R2/R3.
- A temporary browser probe ran against a dedicated Expo server on port 8189 and **confirmed R1**.
  Its assertions deliberately checked the observed loss of the rejected draft. This is evidence of
  the defect, not a passing recovery acceptance test. The temporary source was removed afterward.
- The previous remediation turn completed `CI_BASE_REF=origin/main pnpm ci:local` at this same HEAD.
  That is prior observed evidence, not a newly rerun full gate. The targeted tests above explain how
  green suites can coexist with these uncovered cases.

## Remaining scope and evidence limits

The earlier field/batch limit bypass is now guarded at review and save, the normal gate runs native
collector fixtures, and full local CI includes the dedicated pseudo-locale command. More grouping
and recursive/named component-export discovery are present. These changes do not close R1–R3 above.

Route metadata still needs broader consumer integration; More search/counts, the full pseudo-locale
state matrix, component-discovery negative fixtures, and signed content/client activation remain
follow-up work in their existing plans. They are not reported here as newly reproduced regressions.
Native artifact revision is declared by the caller and still requires independent retained build
evidence, as the collector itself states.

No native build, physical-device scenario, bilingual sign-off, off-host backup/restore drill,
deployment or live provider request was performed. The plans retain their separate acceptance gates.
Fix the three findings with regression coverage, then run the required local gates before calling
the remediation complete.
