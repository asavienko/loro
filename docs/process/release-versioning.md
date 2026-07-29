# Releases and versioning

---

## Versions

Four version numbers, all independent, and conflating them is the usual source of confusion.

| Version             | Format                     | Changes when    | Example |
| ------------------- | -------------------------- | --------------- | ------- |
| **App version**     | SemVer `MAJOR.MINOR.PATCH` | Store release   | `1.3.0` |
| **Build number**    | Monotonic integer          | Every build     | `247`   |
| **Catalog version** | Monotonic integer          | Content publish | `47`    |
| **Schema version**  | Monotonic integer          | Migration       | `12`    |

The app version is what learners see; the build number is what the stores need; the **catalog
version ships without an app release**
([ADR-0009](../architecture/adr/0009-content-pipeline-and-packs.md)); and the schema version gates
whether a binary can open a database.

### App SemVer, for an app

SemVer has no perfect meaning for a mobile app, so we define it:

| Bump      | Means                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------- |
| **MAJOR** | A change in what the product _is_ — a new practice loop becoming the default, a paywall restructure |
| **MINOR** | New features. A new screen, a new engine, a new capability                                          |
| **PATCH** | Fixes and polish, no new capability                                                                 |

`v1.0.0` is the first store release. `v1.1.0` is Loop A and the labs. `v2.0.0` is the Run — a MAJOR
because it changes the product's shape, not because anything broke.

### API versioning

Independent of the app, in the path (`/v1`). Additive changes ship in place; a breaking change means
`/v2` with both live and a documented deprecation window
([`../architecture/api.md`](../architecture/api.md#versioning-and-deprecation)).

---

## Release trains

Every two weeks, cut on a Monday.

```
Week 1 Mon   cut release/x.y from main
Week 1       stabilise: fixes cherry-picked from main; manual gates begin
Week 2 Wed   tag vx.y.0 → store submission
Week 2 Thu+  staged rollout
Week 3 Mon   next train cuts
```

**The train leaves without unfinished work.** A feature that isn't done stays behind its flag and
rides the next one. Slipping a train to fit a feature is how a two-week cadence becomes a two-month
one.

Cutting from `main` rather than a `develop` branch is what makes this work — `main` is always
releasable because unfinished work is flagged off, not branched off
([git-workflow.md](git-workflow.md)).

---

## Hotfixes

For a P0/P1 in production ([incident-response.md](incident-response.md)).

```
1. Decide the fix class:
     JS-only        → OTA update, minutes
     native / core  → hotfix binary, store review
2. Branch from the release tag:  hotfix/1.3.1
3. Minimal fix. No refactors, no cleanups, nothing extra.
4. Manual gate: the affected surface + the airplane-mode test
5. Tag v1.3.1, ship
6. Merge back to release/1.3 AND main
```

Step 6 is the one that gets forgotten, and forgetting it means the fix disappears in the next train.

**Most hotfixes are OTA**, which is the main reason OTA is worth the complexity — a bad string, a
broken layout, or a wrong threshold can be fixed within an hour of being noticed.

---

## Store rollout

| Platform | Mechanism      | Steps                                             |
| -------- | -------------- | ------------------------------------------------- |
| iOS      | Phased release | 1% → 2% → 5% → 10% → 20% → 50% → 100% over 7 days |
| Android  | Staged rollout | 10% → 25% → 50% → 100%, manually advanced         |

**Halt criteria** — any of these stops the rollout:

- Crash-free sessions < 99.3%
- Any P0 incident
- Sync success rate < 95%
- A privacy-class incident of any severity
- A spike in a guardrail metric ([`../product/metrics.md`](../product/metrics.md#guardrails))

Halting is free, expected, and not a failure. Advancing to 100% on day one to save two days is not
worth the blast radius.

---

## Rollback

Three levers, in order of speed.

| Lever                      | Speed      | Use for                                           |
| -------------------------- | ---------- | ------------------------------------------------- |
| **Feature flag off**       | Seconds    | A misbehaving feature. **The first thing to try** |
| **OTA republish**          | Minutes    | A bad JS release                                  |
| **Halt the store rollout** | Minutes    | A bad binary, before most users have it           |
| **Ship a hotfix binary**   | Hours–days | A native bug already widely installed             |

**There is no store rollback.** Once a binary is live you cannot un-publish it to installed users —
you can only halt further rollout and ship forward. That asymmetry is why staged rollout and feature
flags matter more here than on a web product.

### The rollback trap

An OTA rollback can leave a **migrated database behind a downgraded binary**. Guarded by the
schema-floor check: a database at a schema version newer than the binary refuses to open and prompts
for an app update, rather than silently misreading data
([`../architecture/data-model.md`](../architecture/data-model.md#client-rules)).

Every OTA is tagged in crash reporting so an OTA regression is distinguishable from a binary one.

---

## Release notes

Two audiences, two documents.

**For learners** (store listing) — what changed, in their language:

> **Sound more like a local** The prosody lab now traces your pitch against a native speaker's, so
> you can see exactly where your melody diverges — and it strips its hints as you improve.
>
> Also: faster search, and the stream now remembers where you were after a call.

No version numbers, no internal names, no "various bug fixes and performance improvements".

**For the team** (`CHANGELOG.md`, generated from Conventional Commits) — every change with its
requirement IDs, grouped by type, with breaking changes called out.

---

## Deprecation

| Thing                        | Window                             | Mechanism                                                                    |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| App version support for sync | **90 days**                        | `X-Loro-App` header → `SCHEMA_TOO_OLD` after the window; local use continues |
| API version                  | 6 months after the successor ships | Both live                                                                    |
| A database column            | 2 releases                         | Stop writing, then remove                                                    |
| A catalog phrase             | Never removed                      | `deprecated_by`; a learner who owns it keeps it forever                      |
| A feature flag               | 1 release after full rollout       | Remove the flag and the dead path                                            |

Two of these are deliberate kindnesses. **A learner who hasn't updated in four months keeps a
working app** — they lose sync, not learning, because the app is offline-first. And **a deprecated
phrase stays resolvable forever**, because a learner who has practised it 40 times must never see a
broken row.

Stale feature flags are their own problem: a flag left in for six months becomes an untested code
path. Removing it a release after full rollout is a maintenance rule, not a nicety.

---

## Version support policy

|                          | Supported                                         |
| ------------------------ | ------------------------------------------------- |
| OS                       | iOS 16+ · Android 10+ (API 29)                    |
| App versions for sync    | Any release within 90 days                        |
| App versions for content | Any, subject to `min_app_version` in the manifest |
| API                      | Current major + the previous one for 6 months     |

The OS floor moves at most once a year, announced a release ahead, and never in a patch.
