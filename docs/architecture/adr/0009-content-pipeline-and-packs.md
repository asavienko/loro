# 0009 · Ship content independently of the app, as versioned data

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Content lead, backend lead, tech lead

## Context

The catalog changes far more often than the app. A typo in a Spanish phrase, a stiff-sounding line,
a better memory hook, a new pack for a destination — these are weekly events. App releases are, at
best, fortnightly, and a store review adds days.

The catalog is also structurally rich
([`product/content-model.md`](../../product/content-model.md)):

- Core fields (`es`, `en`, `theme`, `emoji`)
- Enrichment (`resp` respelling, `words[]` glosses, `example`, `hint`, `note`, `register`, `cefr`)
- **Derived audio artefacts** — rendered native TTS, a normalised `f0_native` contour, syllable
  boundaries with stress and duration, and quantised reference MFCC for DTW alignment
  ([prosody-dsp.md](../prosody-dsp.md#native-reference-data))

Those derived artefacts are the reason this is a _pipeline_ and not a JSON file. A phrase is not
publishable until its audio has been rendered, its contour extracted, its syllables aligned, and a
human has listened to it.

## Options considered

### A · Content bundled in the app binary

**Pros** Simplest; no network, no versioning, atomic with the code. **Cons** A typo takes a full
release cycle. Adding a destination pack means shipping an app. Growing to 1 200 phrases with audio
would push the download budget past its limit
([performance.md](../performance.md#bundle-and-install)).

### B · Content fetched entirely at runtime, nothing bundled

**Pros** Smallest binary; content is always current. **Cons** **A fresh install with no network is
an empty app.** That directly violates the blueprint's "never an empty app" principle — onboarding
seeds a real stream from starter packs (`Loro.dc.html:180–196`), and it must work on a plane.

### C · A bundled snapshot plus versioned delta sync

**Pros**

- Fresh install works offline with the onboarding packs.
- A typo fix reaches every learner within a day, no release.
- Growth is unbounded: the binary stays small and the catalog can reach thousands of phrases.
- The derived artefacts are built once, in CI, and served content-addressed.

**Cons** A version/diff mechanism to build and maintain; two sources of catalog truth (bundled
snapshot vs synced) that must reconcile.

## Decision

**Option C.**

- **Authoring** in `packages/content/` as reviewed JSON, validated against a JSON Schema in CI.
- **A build worker** produces the published catalog: renders native TTS, extracts `f0_native`,
  aligns syllables, quantises reference MFCC, computes checksums, and bumps a monotonic
  `catalog_version`.
- **A bundled snapshot** ships in the app binary: the 6 onboarding packs (~50 phrases) with audio,
  plus the 24 fallback roleplay scenes. ~12 MB.
- **Delta sync at runtime:** `GET /content/manifest` → compare `catalog_version` →
  `GET /content/diff?from=N` → apply in one transaction ([api.md](../api.md#content)).
- **Audio and reference blobs from the CDN**, content-addressed by `sha256`, immutable, cached
  forever. `mfcc_ref` blobs are fetched only when the labs are enabled, because they are the only
  large per-phrase artefact.

### Two rules that make this safe

1. **Phrase ids are immutable.** Fixing a typo mutates the row. Changing a phrase's _meaning_
   creates a new id and marks the old one `deprecated_by`. A learner who owns a deprecated phrase
   keeps it, and it stays resolvable forever.
2. **The catalog is never written by the app.** Learner state lives in a separate table joined by
   `phrase_id` ([data-model.md](../data-model.md)), so a catalog update can never clobber a
   learner's ratings, tags, or notes.

### Validated in CI

- Schema conformance for every phrase.
- **Pack counts match their promised label** — if a pack says "8 phrases", exactly 8 are members.
  The count is a promise to the learner
  ([`product/content-model.md`](../../product/content-model.md#packs--onboarding-and-drops)).
- Every phrase referenced by a pack, scenario, or drop schedule exists.
- Every phrase has audio, and every audio checksum resolves.
- Syllable spans cover the phrase; `f0_native` has the expected point count.
- No duplicate `es` within a language.
- `resp` stress marking is consistent with `resp_ipa`.

## Consequences

### Good

- A content fix ships in hours, not a release cycle. This is the single biggest quality lever for a
  language app, because most content problems are only discovered by learners.
- A fresh install works offline, so onboarding is never an empty app.
- The catalog can grow to thousands of phrases without touching the download budget.
- Derived artefacts are computed once, consistently, in CI — not per device, and not by hand.
- Content-addressed audio means aggressive CDN caching and cheap egress, and the client can verify
  integrity before playing ([threat-model.md](../threat-model.md#b9--cdn)).
- The content-quality dashboard closes the loop: a phrase removed by 30% of learners who add it is
  actionable, and fixable the same week ([observability.md](../observability.md#dashboards)).

### Bad — accepted deliberately

- A version/diff mechanism to own. Kept small: a monotonic integer, an upsert list, and a
  deprecation list.
- **Two sources of catalog truth.** The bundled snapshot may be older than the synced catalog.
  Reconciled by materialising the snapshot only when the local `catalog_version` is 0, then letting
  delta sync take over.
- A learner months behind could face a diff larger than the catalog. Handled by
  `full_resync_required` in the diff response ([api.md](../api.md#content)).
- The build worker is a real piece of infrastructure — TTS rendering plus DSP extraction plus
  checksums — and it gates content releases. Mitigated by making it idempotent and
  content-addressed, so a rerun is cheap and safe.
- `mfcc_ref` adds 2–6 KB per phrase. Fetched lazily, per pack, only for lab users.

### Revisit if…

- Learner-authored phrases start needing rendered audio at scale, which would make
  `POST /tts/render` (currently an occasional convenience) a primary pipeline.
- We add a second target language, at which point the pipeline needs per-language syllabification
  and stress rules — a real project, tracked in
  [`process/localization.md`](../../process/localization.md).
- Catalog size grows past the point where a full metadata download on first run is acceptable (~5
  000 phrases), which would need pack-scoped lazy loading rather than a whole-catalog fetch.
